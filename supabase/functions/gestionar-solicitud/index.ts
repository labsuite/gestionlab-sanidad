// Módulo Solicitudes de material — ver docs/modulo-pedidos.md.
// crearSolicitudes (crear/editar/cancelar) lo tiene Profesor además de
// Gestor/Admin (ver PERMISOS en js/ui.js); Alumno no ve la página
// 'solicitudes' en absoluto (no está en su `nav`), así que requireStaff basta
// para todo salvo "rechazar", reservado a quien gestiona pedidos
// (Admin/Gestor, `gestionarPedidos` en PERMISOS).
import { requireAdminOrGestor, requireStaff, jsonError, jsonOk, handleCorsPreflight } from "../_shared/auth.ts";
import { resolverIdMaterial } from "../_shared/material.ts";

function genId(prefix: string): string {
  return prefix + Date.now().toString(36).toUpperCase().slice(-6) + Math.floor(Math.random() * 36).toString(36).toUpperCase();
}

const strField = (v: unknown) => (v === "" || v === null || v === undefined) ? null : String(v);

/**
 * Suma `cant` al bote de `mat` en `idUbicacion` (o crea el bote) y deja un
 * movimiento de Entrada. Si el material es "legacy" (sin botes y con
 * stock_actual propio), antes materializa ese stock como bote en su ubicación,
 * o se perdería al recalcular el total como suma de botes — mismo criterio que
 * asegurarLoteLegacy en gestionar-propuesta-material. Devuelve un mensaje de
 * error o null.
 */
async function entradaStock(supabaseAdmin: any, mat: any, cant: number, idUbicacion: string, usuario: string, motivo: string): Promise<string | null> {
  const { data: lotesData } = await supabaseAdmin.from("material_ubicaciones").select("*").eq("id_material", mat.id_material);
  let lotes = lotesData || [];
  const stockLegacy = Number(mat.stock_actual) || 0;
  if (!lotes.length && stockLegacy > 0) {
    if (!mat.ubicacion) {
      return `"${mat.nombre}" tiene ${stockLegacy} de stock pero ninguna ubicación asignada. ` +
        `Ponle su sitio desde el inventario antes, o se perdería ese stock.`;
    }
    const legacy = {
      id: genId("LU"), id_material: mat.id_material, id_ubicacion: mat.ubicacion,
      stock_local: stockLegacy, stock_minimo_local: Number(mat.stock_minimo) || 0,
      stock_optimo_local: Number(mat.stock_optimo) || 0,
    };
    const { error } = await supabaseAdmin.from("material_ubicaciones").insert(legacy);
    if (error) return `No se pudo preparar el material: ${error.message}`;
    lotes = [legacy];
  }
  const lote = lotes.find((l: any) => l.id_ubicacion === idUbicacion);
  if (lote) {
    lote.stock_local = (Number(lote.stock_local) || 0) + cant;
    await supabaseAdmin.from("material_ubicaciones").update({ stock_local: lote.stock_local }).eq("id", lote.id);
  } else {
    const nuevo = {
      id: genId("LU"), id_material: mat.id_material, id_ubicacion: idUbicacion,
      stock_local: cant, stock_minimo_local: 0, stock_optimo_local: 0,
    };
    const { error } = await supabaseAdmin.from("material_ubicaciones").insert(nuevo);
    if (error) return `No se pudo guardar el stock: ${error.message}`;
    lotes.push(nuevo);
  }
  const total = lotes.reduce((s: number, l: any) => s + (Number(l.stock_local) || 0), 0);
  await supabaseAdmin.from("material").update({ stock_actual: total }).eq("id_material", mat.id_material);
  await supabaseAdmin.from("movimientos").insert({
    id_movimiento: genId("MOV"), material: mat.nombre, id_material: mat.id_material,
    tipo: "Entrada", cantidad: cant, usuario, motivo,
  });
  return null;
}

Deno.serve(async (req) => {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;
  if (req.method !== "POST") return jsonError("Método no permitido", 405);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonError("Cuerpo inválido (se esperaba JSON)", 400);
  }

  const accion = String(body.accion || "");

  if (accion === "rechazar") {
    const { error: authError, supabaseAdmin } = await requireAdminOrGestor(req);
    if (authError) return authError;
    const idSolicitud = String(body.id_solicitud || "").trim();
    if (!idSolicitud) return jsonError("id_solicitud es obligatorio", 400);
    const { data, error } = await supabaseAdmin.from("solicitudes").update({ estado: "Rechazado" }).eq("id_solicitud", idSolicitud).select().single();
    if (error) return jsonError(`No se pudo rechazar: ${error.message}`, 400);
    if (!data) return jsonError(`No se encontró la solicitud "${idSolicitud}"`, 404);
    return jsonOk({ solicitud: data });
  }

  if (accion === "comprado_aparte") {
    // Lo pidieron por la app pero alguien lo compró por su cuenta (gamuzas en
    // el súper…): no pasa por ningún pedido. Se cierra la solicitud con estado
    // propio, para que quien la pidió no vea "Rechazado" ni "Recibido" de un
    // pedido que no existe. Importe y nota son opcionales; la entrada de stock
    // solo si el material está catalogado y se elige ubicación.
    const { error: authError, supabaseAdmin, user } = await requireAdminOrGestor(req);
    if (authError) return authError;
    const idSolicitud = String(body.id_solicitud || "").trim();
    if (!idSolicitud) return jsonError("id_solicitud es obligatorio", 400);
    const { data: sol } = await supabaseAdmin.from("solicitudes").select("*").eq("id_solicitud", idSolicitud).maybeSingle();
    if (!sol) return jsonError("Solicitud no encontrada", 404);
    if (sol.estado !== "Pendiente") {
      return jsonError("Solo se puede marcar como comprada aparte una solicitud Pendiente (si ya está en un pedido, quita antes la línea)", 400);
    }
    const importe = body.importe === "" || body.importe === null || body.importe === undefined ? null : Number(body.importe);
    if (importe !== null && (isNaN(importe) || importe < 0)) return jsonError("Importe no válido", 400);
    const fecha = String(body.fecha || "").trim() || new Date().toISOString().split("T")[0];

    const cantStock = Number(body.cantidad_stock) || 0;
    const idUbicacion = strField(body.id_ubicacion);
    let stock: { material: string; cantidad: number } | null = null;
    if (cantStock > 0) {
      if (!idUbicacion) return jsonError("Elige en qué ubicación se guarda", 400);
      const idMat = sol.id_material || await resolverIdMaterial(supabaseAdmin, sol.material);
      if (!idMat) return jsonError("Este material no está en el inventario: no se le puede dar entrada de stock", 400);
      const { data: mat } = await supabaseAdmin.from("material").select("*").eq("id_material", idMat).maybeSingle();
      if (!mat) return jsonError("Material no encontrado", 404);
      const problema = await entradaStock(supabaseAdmin, mat, cantStock, idUbicacion,
        String(user?.nombre || user?.email || "Usuario"), `Comprado aparte (${idSolicitud})`);
      if (problema) return jsonError(problema, 400);
      stock = { material: mat.nombre, cantidad: cantStock };
    }

    const { data, error } = await supabaseAdmin.from("solicitudes").update({
      estado: "Comprado aparte", compra_fecha: fecha, compra_importe: importe, compra_nota: strField(body.nota),
    }).eq("id_solicitud", idSolicitud).select().single();
    if (error) return jsonError(`No se pudo guardar: ${error.message}`, 400);
    return jsonOk({ solicitud: data, stock });
  }

  const { error: authError, supabaseAdmin } = await requireStaff(req);
  if (authError) return authError;

  if (accion === "crear") {
    const material = String(body.material || "").trim();
    const cantidad = Number(body.cantidad_solicitada);
    if (!material) return jsonError("Indica el material", 400);
    if (!cantidad || cantidad <= 0) return jsonError("Indica la cantidad", 400);
    const datos = {
      id_solicitud: genId("SOL"), material,
      id_material: await resolverIdMaterial(supabaseAdmin, material),
      cantidad_solicitada: cantidad,
      solicitante: String(body.solicitante || "Usuario"),
      motivo: strField(body.motivo), proveedor_requerido: strField(body.proveedor_requerido),
      estado: "Pendiente", observaciones: strField(body.observaciones),
    };
    const { data, error } = await supabaseAdmin.from("solicitudes").insert(datos).select().single();
    if (error) return jsonError(`No se pudo guardar la solicitud: ${error.message}`, 400);
    return jsonOk({ solicitud: data });
  }

  if (accion === "editar") {
    const idSolicitud = String(body.id_solicitud || "").trim();
    if (!idSolicitud) return jsonError("id_solicitud es obligatorio", 400);
    const { data: actual } = await supabaseAdmin.from("solicitudes").select("*").eq("id_solicitud", idSolicitud).maybeSingle();
    if (!actual) return jsonError("Solicitud no encontrada", 404);
    if (actual.estado !== "Pendiente") return jsonError("Esta solicitud no se puede editar", 400);
    const cantidad = Number(body.cantidad_solicitada);
    if (!cantidad || cantidad <= 0) return jsonError("Indica la cantidad", 400);
    const datos: Record<string, unknown> = {
      cantidad_solicitada: cantidad, motivo: strField(body.motivo),
      proveedor_requerido: strField(body.proveedor_requerido), observaciones: strField(body.observaciones),
    };
    if (body.material) datos.material = String(body.material).trim();
    const { data, error } = await supabaseAdmin.from("solicitudes").update(datos).eq("id_solicitud", idSolicitud).select().single();
    if (error) return jsonError(`No se pudo actualizar: ${error.message}`, 400);
    return jsonOk({ solicitud: data });
  }

  if (accion === "cancelar") {
    const idSolicitud = String(body.id_solicitud || "").trim();
    if (!idSolicitud) return jsonError("id_solicitud es obligatorio", 400);
    const { data: actual } = await supabaseAdmin.from("solicitudes").select("*").eq("id_solicitud", idSolicitud).maybeSingle();
    if (!actual) return jsonError("Solicitud no encontrada", 404);
    if (actual.estado !== "Pendiente") return jsonError("Solo se pueden cancelar solicitudes Pendientes", 400);
    const { data, error } = await supabaseAdmin.from("solicitudes").update({ estado: "Cancelado" }).eq("id_solicitud", idSolicitud).select().single();
    if (error) return jsonError(`No se pudo cancelar: ${error.message}`, 400);
    return jsonOk({ solicitud: data });
  }

  if (accion === "snooze" || accion === "unsnooze") {
    const idSolicitud = String(body.id_solicitud || "").trim();
    if (!idSolicitud) return jsonError("id_solicitud es obligatorio", 400);
    const snoozeHasta = accion === "snooze" ? String(body.fecha || "").trim() : null;
    if (accion === "snooze" && !snoozeHasta) return jsonError("Indica una fecha", 400);
    const { data, error } = await supabaseAdmin.from("solicitudes").update({ snooze_hasta: snoozeHasta }).eq("id_solicitud", idSolicitud).select().single();
    if (error) return jsonError(`No se pudo guardar: ${error.message}`, 400);
    return jsonOk({ solicitud: data });
  }

  return jsonError("accion no reconocida", 400);
});
