// Módulo Pedidos — ver docs/modulo-pedidos.md. Todas las acciones son
// Admin/Gestor (`gestionarPedidos` en PERMISOS, js/ui.js) — Profesor no ve
// la página de pedidos en absoluto.
import { requireAdminOrGestor, jsonError, jsonOk, handleCorsPreflight } from "../_shared/auth.ts";

function genId(prefix: string): string {
  return prefix + Date.now().toString(36).toUpperCase().slice(-6) + Math.floor(Math.random() * 36).toString(36).toUpperCase();
}

const strField = (v: unknown) => (v === "" || v === null || v === undefined) ? null : String(v);
const hoy = () => new Date().toISOString().split("T")[0];

// Al aprobar presupuesto, las solicitudes vinculadas pasan a "En espera de
// recepción" — mismo mapa que MAPA_SOL en pedidos-acciones.js. Los estados
// finales (Recibido/Rechazado/Cancelado) no se tocan aquí.
const ESTADOS_FINALES_SOL = ["Recibido", "Rechazado", "Cancelado"];
async function cascadaSolicitudes(supabaseAdmin: any, idPedido: string, nuevoEstadoPedido: string) {
  const mapa: Record<string, string> = { "Presupuesto aprobado": "En espera de recepción" };
  const nuevoEstadoSol = mapa[nuevoEstadoPedido];
  if (!nuevoEstadoSol) return;
  const { data: sols } = await supabaseAdmin.from("solicitudes").select("id_solicitud, estado").eq("lista_pedido", idPedido);
  for (const s of sols || []) {
    if (ESTADOS_FINALES_SOL.includes(s.estado)) continue;
    await supabaseAdmin.from("solicitudes").update({ estado: nuevoEstadoSol }).eq("id_solicitud", s.id_solicitud);
  }
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
  const { error: authError, supabaseAdmin } = await requireAdminOrGestor(req);
  if (authError) return authError;

  if (accion === "crear") {
    const nombreLista = String(body.nombre_lista || "").trim();
    if (!nombreLista) return jsonError("El nombre es obligatorio", 400);
    const datos = {
      id_pedido: genId("PED"), nombre_lista: nombreLista, proveedor: strField(body.proveedor),
      fecha_creacion: hoy(), estado: "Abierto", observaciones: strField(body.observaciones),
      tipo: String(body.tipo || "Material"),
    };
    const { data, error } = await supabaseAdmin.from("pedidos").insert(datos).select().single();
    if (error) return jsonError(`No se pudo crear la lista: ${error.message}`, 400);
    return jsonOk({ pedido: data });
  }

  const idPedido = String(body.id_pedido || "").trim();
  if (!idPedido) return jsonError("id_pedido es obligatorio", 400);

  if (accion === "actualizar_estado" || accion === "avanzar_estado") {
    const { data: p } = await supabaseAdmin.from("pedidos").select("*").eq("id_pedido", idPedido).maybeSingle();
    if (!p) return jsonError(`No se encontró el pedido "${idPedido}"`, 404);

    let nuevoEstado: string;
    if (accion === "avanzar_estado") {
      const secuencia = ["Abierto", "Presupuesto solicitado", "Presupuesto aprobado", "Recepción parcial", "Recepción completa"];
      const pos = secuencia.indexOf(p.estado);
      if (pos === -1 || pos >= secuencia.length - 1) return jsonError("El pedido ya está en el estado final", 400);
      nuevoEstado = secuencia[pos + 1];
    } else {
      nuevoEstado = String(body.estado || "").trim();
      if (nuevoEstado === "Recepción parcial" || nuevoEstado === "Recepción completa") {
        return jsonError("Este estado se asigna automáticamente al registrar recepciones de líneas", 400);
      }
      if (!nuevoEstado) return jsonError("estado es obligatorio", 400);
    }

    const datos: Record<string, unknown> = { estado: nuevoEstado };
    if (nuevoEstado === "Presupuesto solicitado") datos.fecha_presupuesto = hoy();
    if (nuevoEstado === "Presupuesto aprobado") datos.fecha_aprobacion = hoy();
    if (nuevoEstado === "Recepción completa") datos.fecha_recepcion_completa = hoy();
    if (accion === "actualizar_estado") {
      if (body.numero_presupuesto) datos.numero_presupuesto = String(body.numero_presupuesto);
      if (body.numero_factura) datos.numero_factura = String(body.numero_factura);
      if (body.proveedor) datos.proveedor = String(body.proveedor);
    }

    const { data, error } = await supabaseAdmin.from("pedidos").update(datos).eq("id_pedido", idPedido).select().single();
    if (error) return jsonError(`No se pudo actualizar: ${error.message}`, 400);
    await cascadaSolicitudes(supabaseAdmin, idPedido, nuevoEstado);
    // Aprobar el presupuesto cierra el pedido en firme: si quedaba alguna
    // línea marcada como "pendiente de solicitar aparte", con el presupuesto
    // aprobado ya no tiene sentido tenerla en un apartado propio.
    if (nuevoEstado !== "Abierto" && nuevoEstado !== "Presupuesto solicitado") {
      await supabaseAdmin.from("lineas_pedido").update({ presupuesto_pendiente: false })
        .eq("pedido", idPedido).eq("presupuesto_pendiente", true);
    }
    return jsonOk({ pedido: data });
  }

  if (accion === "archivar") {
    const { data, error } = await supabaseAdmin.from("pedidos").update({ estado: "Archivado" }).eq("id_pedido", idPedido).select().single();
    if (error) return jsonError(`No se pudo archivar: ${error.message}`, 400);
    if (!data) return jsonError(`No se encontró el pedido "${idPedido}"`, 404);
    return jsonOk({ pedido: data });
  }

  // Excepcional: sacar del archivo un pedido archivado por error (p.ej. se
  // tramitó con material aún sin recibir). No se guarda el estado anterior, así
  // que se deduce de las líneas: todas recibidas → Recepción completa; alguna →
  // Recepción parcial; ninguna → Presupuesto aprobado (deja recibir el albarán).
  if (accion === "desarchivar") {
    const { data: p } = await supabaseAdmin.from("pedidos").select("estado").eq("id_pedido", idPedido).maybeSingle();
    if (!p) return jsonError(`No se encontró el pedido "${idPedido}"`, 404);
    if (p.estado !== "Archivado") return jsonError("El pedido no está archivado", 400);
    const { data: lineas } = await supabaseAdmin.from("lineas_pedido").select("estado_linea").eq("pedido", idPedido);
    const ls = lineas || [];
    const recibidas = ls.filter((l: any) => l.estado_linea === "Recibido").length;
    const algoRecibido = ls.some((l: any) => l.estado_linea === "Recibido" || l.estado_linea === "Recibido parcialmente");
    const estado = ls.length && recibidas === ls.length ? "Recepción completa"
      : algoRecibido ? "Recepción parcial" : "Presupuesto aprobado";
    const { data, error } = await supabaseAdmin.from("pedidos").update({ estado }).eq("id_pedido", idPedido).select().single();
    if (error) return jsonError(`No se pudo desarchivar: ${error.message}`, 400);
    return jsonOk({ pedido: data });
  }

  if (accion === "actualizar_campos") {
    // Whitelist — cubre proveedor, gasto extra, ciclo/módulo, factura, docs.
    const permitidos = [
      "proveedor", "gasto_extra_concepto", "gasto_extra_importe", "ciclo", "modulo",
      "numero_factura", "fecha_factura", "numero_presupuesto", "doc_hoja_generada", "doc_hoja_path", "doc_enviada_jefatura",
    ];
    const campos = (body.campos && typeof body.campos === "object") ? body.campos as Record<string, unknown> : {};
    const datos: Record<string, unknown> = {};
    for (const k of permitidos) {
      if (!(k in campos)) continue;
      if (k === "doc_hoja_generada" || k === "doc_enviada_jefatura") {
        datos[k] = campos[k] === true || campos[k] === "TRUE";
      } else if (k === "gasto_extra_importe") {
        datos[k] = campos[k] === "" || campos[k] === null ? null : Number(campos[k]);
      } else {
        datos[k] = strField(campos[k]);
      }
    }
    if (!Object.keys(datos).length) return jsonError("Nada que actualizar", 400);
    const { data, error } = await supabaseAdmin.from("pedidos").update(datos).eq("id_pedido", idPedido).select().single();
    if (error) return jsonError(`No se pudo actualizar: ${error.message}`, 400);
    if (!data) return jsonError(`No se encontró el pedido "${idPedido}"`, 404);
    return jsonOk({ pedido: data });
  }

  if (accion === "hoja_factura") {
    // Artículos de la factura que, en la HOJA de pedido, sustituyen a TODAS las
    // líneas (caso real: una "Reparación" facturada como cámaras Neubauer,
    // guantes y disolventes). Solo la hoja (.docx y enviar-a-trebello): las
    // líneas, el inventario y la contabilidad no cambian. [] / null = la hoja usa las líneas.
    //
    // Precios (2026-11-23): cada artículo puede enlazarse a un material del
    // catálogo (`id_material`). Los enlazados con precio pasan a
    // historico_precio — el precio medio del material y el proveedor más
    // barato los cuentan como cualquier precio de línea. La hoja es la fuente:
    // cada artículo guarda el `id_historico` de su fila, y al volver a guardar
    // se borran las filas de antes (leídas de la BD, no del navegador) y se
    // crean las de ahora. Guardar la lista vacía las quita todas.
    const num = (v: unknown) => {
      if (v === "" || v === null || v === undefined) return null;
      const n = Number(String(v).replace(",", "."));
      return Number.isFinite(n) ? n : null;
    };
    const { data: previo } = await supabaseAdmin.from("pedidos")
      .select("hoja_factura, proveedor, fecha_factura").eq("id_pedido", idPedido).maybeSingle();
    if (!previo) return jsonError(`No se encontró el pedido "${idPedido}"`, 404);

    const conceptos: Record<string, unknown>[] = (Array.isArray(body.conceptos) ? body.conceptos as Record<string, unknown>[] : [])
      .map((c) => ({
        concepto: String(c?.concepto ?? "").trim(),
        cantidad: num(c?.cantidad),
        unidad: strField(String(c?.unidad ?? "").trim()),
        precio_unitario: num(c?.precio_unitario),
        id_material: strField(String(c?.id_material ?? "").trim()),
      }))
      .filter((c) => c.concepto);

    // Solo vale un material que exista de verdad.
    const idsMat = [...new Set(conceptos.map((c) => c.id_material).filter(Boolean))] as string[];
    const materiales = new Map<string, string>();
    if (idsMat.length) {
      const { data: mats } = await supabaseAdmin.from("material").select("id_material, nombre").in("id_material", idsMat);
      for (const m of mats || []) materiales.set(m.id_material, m.nombre);
    }

    const idsPrevios = (Array.isArray(previo.hoja_factura) ? previo.hoja_factura : [])
      .map((c: any) => c?.id_historico).filter(Boolean) as string[];
    // Materiales cuyo precio ya consta en este pedido por una LÍNEA (💶 o
    // «Aplicar lo seleccionado» de la factura): es la misma factura, así que
    // no se registra dos veces.
    const { data: delPedido } = await supabaseAdmin.from("historico_precio")
      .select("id_historico, id_material, fecha").eq("id_pedido", idPedido);
    const yaPorLineas = new Set((delPedido || [])
      .filter((h: any) => !idsPrevios.includes(h.id_historico) && h.id_material).map((h: any) => h.id_material));
    // Al volver a guardar se conserva la fecha con que se registró.
    const fechaPrevia = (delPedido || []).find((h: any) => idsPrevios.includes(h.id_historico))?.fecha || null;
    const fecha = previo.fecha_factura || fechaPrevia || hoy();

    const filas: Record<string, unknown>[] = [];
    let omitidosPorLinea = 0;
    for (const c of conceptos) {
      if (c.id_material && !materiales.has(c.id_material as string)) c.id_material = null;
      const precio = c.precio_unitario as number | null;
      if (!c.id_material || precio == null || !(precio > 0)) continue;
      if (yaPorLineas.has(c.id_material)) { omitidosPorLinea++; continue; }
      const fila = {
        id_historico: genId("HP"), nombre_material: materiales.get(c.id_material as string),
        id_material: c.id_material, id_pedido: idPedido,
        proveedor: previo.proveedor || null, fecha, precio_unitario: precio,
      };
      c.id_historico = fila.id_historico;
      filas.push(fila);
    }

    if (idsPrevios.length) {
      const { error: errBorrar } = await supabaseAdmin.from("historico_precio").delete()
        .in("id_historico", idsPrevios).eq("id_pedido", idPedido);
      if (errBorrar) return jsonError(`No se pudieron quitar los precios anteriores: ${errBorrar.message}`, 400);
    }
    if (filas.length) {
      const { error: errHist } = await supabaseAdmin.from("historico_precio").insert(filas);
      if (errHist) return jsonError(`No se pudieron guardar los precios en el histórico: ${errHist.message}`, 400);
    }
    const { data, error } = await supabaseAdmin.from("pedidos")
      .update({ hoja_factura: conceptos.length ? conceptos : null }).eq("id_pedido", idPedido).select().single();
    if (error) return jsonError(`No se pudo guardar: ${error.message}`, 400);
    return jsonOk({ pedido: data, historico_nuevo: filas, historico_quitado: idsPrevios, omitidos_por_linea: omitidosPorLinea });
  }

  if (accion === "generar_link_publico") {
    // El token vive en `pedidos_token`, que solo lee el servidor (RLS sin políticas):
    // en `pedidos` lo podía leer cualquier cuenta con sesión, alumnado incluido (2026-11-23).
    const { data: p } = await supabaseAdmin.from("pedidos").select("id_pedido").eq("id_pedido", idPedido).maybeSingle();
    if (!p) return jsonError(`No se encontró el pedido "${idPedido}"`, 404);
    const { data: t } = await supabaseAdmin.from("pedidos_token").select("token").eq("id_pedido", idPedido).maybeSingle();
    if (t?.token) return jsonOk({ token: t.token });

    const bytes = new Uint8Array(24);
    crypto.getRandomValues(bytes);
    const token = btoa(String.fromCharCode(...bytes)).replace(/[^a-zA-Z0-9]/g, "");

    const { error } = await supabaseAdmin.from("pedidos_token").upsert({ id_pedido: idPedido, token });
    if (error) return jsonError(`No se pudo generar el link: ${error.message}`, 400);
    return jsonOk({ token });
  }

  if (accion === "eliminar") {
    // Las líneas de Lineas_Pedido caen en cascada (FK on delete cascade).
    const { error } = await supabaseAdmin.from("pedidos").delete().eq("id_pedido", idPedido);
    if (error) return jsonError(`No se pudo eliminar: ${error.message}`, 400);
    return jsonOk({ eliminado: idPedido });
  }

  if (accion === "eliminar_documento") {
    // Para cuando el proveedor sube el archivo equivocado (o duplicado) por
    // el link público — borra el archivo de Storage además de la fila.
    const idDocumento = String(body.id_documento || "").trim();
    if (!idDocumento) return jsonError("id_documento es obligatorio", 400);
    const { data: doc } = await supabaseAdmin.from("documentos_proveedor").select("*").eq("id_documento", idDocumento).eq("pedido", idPedido).maybeSingle();
    if (!doc) return jsonError("Documento no encontrado", 404);
    await supabaseAdmin.storage.from("documentos").remove([doc.path]); // best-effort: si falla, no bloquea el borrado de la fila
    const { error } = await supabaseAdmin.from("documentos_proveedor").delete().eq("id_documento", idDocumento);
    if (error) return jsonError(`No se pudo eliminar el documento: ${error.message}`, 400);
    return jsonOk({ eliminado: idDocumento });
  }

  return jsonError("accion no reconocida", 400);
});
