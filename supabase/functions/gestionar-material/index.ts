// Módulo Material (inventario de fungibles) + Material_Ubicaciones (lotes por
// ubicación). Ver docs/modulo-pedidos.md para el modelo de datos (botes
// madre/hija, ítems "legacy" sin lotes, etc.) — esta función reimplementa
// server-side toda la lógica que antes vivía en js/material.js.
//
// Roles (ver PERMISOS en js/ui.js):
// - editarMaterial (crear/actualizar catálogo, entrada, subdivision, eliminar_lote):
//   Admin/Gestor.
// - eliminarItems (eliminar material del catálogo): solo Administrador.
// - registrarConsumo (consumo, traslado, asegurar_lote_legacy): TODOS los
//   roles autenticados, incluido Alumno (botones 📦/🔀 sin gate en la fila).
// - revisión de inventario: cualquiera puede *proponerla* (revision_crear,
//   gated client-side por Puede_Revisar_Inventario, un flag de datos no de
//   rol); aplicarla/descartarla es Admin/Gestor/Profesor (requireStaff).
import { requireAdminOrGestor, requireAdmin, requireStaff, requireValidSession, jsonError, jsonOk, handleCorsPreflight } from "../_shared/auth.ts";

function genId(prefix: string): string {
  return prefix + Date.now().toString(36).toUpperCase().slice(-6) + Math.floor(Math.random() * 36).toString(36).toUpperCase();
}

const numField = (v: unknown) => (v === "" || v === null || v === undefined) ? null : Number(v);
const strField = (v: unknown) => (v === "" || v === null || v === undefined) ? null : String(v);

async function getLotes(supabaseAdmin: any, idMaterial: string) {
  const { data } = await supabaseAdmin.from("material_ubicaciones").select("*").eq("id_material", idMaterial);
  return data || [];
}

async function stockTotal(supabaseAdmin: any, idMaterial: string, lotesYaCargados?: any[]) {
  const lotes = lotesYaCargados || await getLotes(supabaseAdmin, idMaterial);
  if (!lotes.length) return null; // null = usar Stock_Actual propio del material (ítem legacy)
  return lotes.reduce((s: number, l: any) => s + (Number(l.stock_local) || 0), 0);
}

async function sincronizarStockMaterial(supabaseAdmin: any, idMaterial: string) {
  const total = await stockTotal(supabaseAdmin, idMaterial);
  if (total === null) return; // legacy: el stock_actual ya se gestionó directamente
  await supabaseAdmin.from("material").update({ stock_actual: total }).eq("id_material", idMaterial);
}

async function registrarMovimiento(supabaseAdmin: any, nombreMaterial: string, tipo: string, cantidad: number, usuario: string, motivo: string, observaciones = "") {
  const datos = {
    id_movimiento: genId("MOV"), material: nombreMaterial, tipo, cantidad,
    usuario, motivo, observaciones,
  };
  await supabaseAdmin.from("movimientos").insert(datos);
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

  // ── acciones abiertas a cualquier sesión válida (Alumno incluido) ──
  if (accion === "consumo" || accion === "traslado" || accion === "asegurar_lote_legacy" || accion === "revision_crear") {
    const { error: authError, email, supabaseAdmin } = await requireValidSession(req);
    if (authError) return authError;
    const usuarioNombre = String(body.usuario || email || "Usuario");
    const idMaterial = String(body.id_material || "").trim();
    if (!idMaterial) return jsonError("id_material es obligatorio", 400);
    const { data: mat } = await supabaseAdmin.from("material").select("*").eq("id_material", idMaterial).maybeSingle();
    if (!mat) return jsonError(`No se encontró el material "${idMaterial}"`, 404);

    if (accion === "asegurar_lote_legacy") {
      const lotes = await getLotes(supabaseAdmin, idMaterial);
      if (lotes.length) return jsonOk({ lote: lotes[0] });
      if (!mat.ubicacion) return jsonError("Este ítem no tiene ubicación asignada todavía", 400);
      const nuevo = {
        id: genId("LU"), id_material: idMaterial, id_ubicacion: mat.ubicacion,
        stock_local: mat.stock_actual || 0, stock_minimo_local: mat.stock_minimo || 0,
        stock_optimo_local: mat.stock_optimo || 0, unidad_lote: null,
      };
      const { data, error } = await supabaseAdmin.from("material_ubicaciones").insert(nuevo).select().single();
      if (error) return jsonError(`No se pudo preparar el ítem: ${error.message}`, 400);
      return jsonOk({ lote: data });
    }

    if (accion === "consumo") {
      const cantidad = Number(body.cantidad);
      if (!cantidad || cantidad <= 0) return jsonError("Introduce una cantidad válida", 400);
      const loteId = strField(body.lote_id);
      const lotes = await getLotes(supabaseAdmin, idMaterial);
      let loteElegido = loteId ? lotes.find((l: any) => l.id === loteId) : null;
      if (lotes.length > 0 && !loteElegido) return jsonError("Selecciona una ubicación", 400);
      await registrarMovimiento(supabaseAdmin, mat.nombre, "Salida", cantidad, usuarioNombre, String(body.motivo || "Consumo"), String(body.observaciones || ""));
      if (loteElegido) {
        const nuevoLocal = Math.max(0, (Number(loteElegido.stock_local) || 0) - cantidad);
        await supabaseAdmin.from("material_ubicaciones").update({ stock_local: nuevoLocal }).eq("id", loteElegido.id);
        await sincronizarStockMaterial(supabaseAdmin, idMaterial);
      } else {
        const nuevoStock = Math.max(0, (Number(mat.stock_actual) || 0) - cantidad);
        await supabaseAdmin.from("material").update({ stock_actual: nuevoStock }).eq("id_material", idMaterial);
      }
      const { data: matFinal } = await supabaseAdmin.from("material").select("*").eq("id_material", idMaterial).single();
      return jsonOk({ material: matFinal });
    }

    if (accion === "traslado") {
      const loteOrigenId = String(body.lote_origen_id || "").trim();
      const cantidad = Number(body.cantidad);
      if (!loteOrigenId) return jsonError("lote_origen_id es obligatorio", 400);
      if (!cantidad || cantidad <= 0) return jsonError("Indica una cantidad válida", 400);
      const { data: loteOrigen } = await supabaseAdmin.from("material_ubicaciones").select("*").eq("id", loteOrigenId).maybeSingle();
      if (!loteOrigen) return jsonError("Bote de origen no encontrado", 404);
      const stockOrigen = Number(loteOrigen.stock_local) || 0;
      if (cantidad > stockOrigen) return jsonError(`Stock insuficiente en origen (${stockOrigen})`, 400);
      const loteDestinoId = strField(body.lote_destino_id);
      const idDestinoUbicacion = String(body.id_destino_ubicacion || "").trim();
      if (!loteDestinoId && !idDestinoUbicacion) return jsonError("Selecciona el destino", 400);

      await supabaseAdmin.from("material_ubicaciones").update({ stock_local: stockOrigen - cantidad }).eq("id", loteOrigenId);

      let loteDestino = loteDestinoId
        ? (await supabaseAdmin.from("material_ubicaciones").select("*").eq("id", loteDestinoId).maybeSingle()).data
        : (await supabaseAdmin.from("material_ubicaciones").select("*").eq("id_material", idMaterial).eq("id_ubicacion", idDestinoUbicacion).maybeSingle()).data;
      if (loteDestino) {
        const nuevoStockDest = (Number(loteDestino.stock_local) || 0) + cantidad;
        await supabaseAdmin.from("material_ubicaciones").update({ stock_local: nuevoStockDest }).eq("id", loteDestino.id);
      } else {
        const nuevo = { id: genId("LU"), id_material: idMaterial, id_ubicacion: idDestinoUbicacion, stock_local: cantidad, stock_minimo_local: 0, stock_optimo_local: 0 };
        await supabaseAdmin.from("material_ubicaciones").insert(nuevo);
      }
      await registrarMovimiento(supabaseAdmin, mat.nombre, "Traslado", cantidad, usuarioNombre, String(body.motivo || "Traslado"));
      const lotesFinal = await getLotes(supabaseAdmin, idMaterial);
      return jsonOk({ lotes: lotesFinal });
    }

    if (accion === "revision_crear") {
      const stockReal = Number(body.stock_real);
      if (body.stock_real === "" || body.stock_real === undefined || isNaN(stockReal) || stockReal < 0) {
        return jsonError("Introduce la cantidad real que has contado", 400);
      }
      const stockApp = await stockTotal(supabaseAdmin, idMaterial);
      const stockAppFinal = stockApp !== null ? stockApp : (Number(mat.stock_actual) || 0);
      const diferencia = stockReal - stockAppFinal;
      const datos = {
        id_revision: genId("REV"), id_material: idMaterial, nombre_material: mat.nombre,
        stock_app: stockAppFinal, stock_real: stockReal, diferencia,
        usuario: usuarioNombre, observaciones: String(body.observaciones || ""),
      };
      const { data, error } = await supabaseAdmin.from("revisiones_inventario").insert(datos).select().single();
      if (error) return jsonError(`No se pudo enviar la revisión: ${error.message}`, 400);
      return jsonOk({ revision: data });
    }
  }

  // ── acciones de Admin/Gestor ──
  if (accion === "crear" || accion === "actualizar" || accion === "entrada" || accion === "subdivision" || accion === "eliminar_lote" || accion === "transferencia_masiva") {
    const { error: authError, supabaseAdmin } = await requireAdminOrGestor(req);
    if (authError) return authError;

    if (accion === "crear" || accion === "actualizar") {
      const idMaterial = String(body.id_material || "").trim();
      const nombre = String(body.nombre || "").trim();
      const categoria = String(body.categoria || "").trim();
      const unidad = String(body.unidad || "").trim();
      if (!idMaterial) return jsonError("id_material es obligatorio", 400);
      if (!nombre || !categoria || !unidad) return jsonError("Nombre, categoría y unidad son obligatorios", 400);

      const datos = {
        nombre, categoria, unidad,
        unidades_extra: strField(body.unidades_extra),
        referencia_proveedor: strField(body.referencia_proveedor),
        proveedor: strField(body.proveedor),
        ubicacion: strField(body.ubicacion),
        stock_actual: numField(body.stock_actual) || 0,
        stock_minimo: numField(body.stock_minimo) || 0,
        stock_optimo: numField(body.stock_optimo) || 0,
        observaciones: strField(body.observaciones),
        gestion_automatica: body.gestion_automatica === true || body.gestion_automatica === "TRUE",
      };

      let matFinal;
      if (accion === "crear") {
        const { data, error } = await supabaseAdmin.from("material").insert({ id_material: idMaterial, ...datos }).select().single();
        if (error) {
          if (error.code === "23505") return jsonError(`Ya existe un material con el ID "${idMaterial}"`, 409);
          return jsonError(`No se pudo crear: ${error.message}`, 400);
        }
        matFinal = data;
      } else {
        const { data, error } = await supabaseAdmin.from("material").update(datos).eq("id_material", idMaterial).select().single();
        if (error) return jsonError(`No se pudo actualizar: ${error.message}`, 400);
        if (!data) return jsonError(`No se encontró el material "${idMaterial}"`, 404);
        matFinal = data;
      }

      // Lotes: cada item con `id` se actualiza, sin `id` se crea.
      const lotesInput = Array.isArray(body.lotes) ? body.lotes as Record<string, unknown>[] : [];
      const lotesFinal = [];
      for (const l of lotesInput) {
        const loteId = strField(l.id);
        if (loteId) {
          const { data, error } = await supabaseAdmin.from("material_ubicaciones").update({
            stock_local: numField(l.stock_local) || 0,
            stock_minimo_local: numField(l.stock_minimo_local) || 0,
            stock_optimo_local: numField(l.stock_optimo_local) || 0,
            unidad_lote: strField(l.unidad_lote),
          }).eq("id", loteId).select().single();
          if (error) return jsonError(`No se pudo actualizar un lote: ${error.message}`, 400);
          lotesFinal.push(data);
        } else {
          const nuevo = {
            id: genId("LU"), id_material: idMaterial, id_ubicacion: String(l.id_ubicacion || ""),
            stock_local: numField(l.stock_local) || 0, stock_minimo_local: numField(l.stock_minimo_local) || 0,
            stock_optimo_local: numField(l.stock_optimo_local) || 0, unidad_lote: strField(l.unidad_lote),
          };
          const { data, error } = await supabaseAdmin.from("material_ubicaciones").insert(nuevo).select().single();
          if (error) return jsonError(`No se pudo crear un lote: ${error.message}`, 400);
          lotesFinal.push(data);
        }
      }
      if (lotesFinal.length) {
        await sincronizarStockMaterial(supabaseAdmin, idMaterial);
        const { data: matSync } = await supabaseAdmin.from("material").select("*").eq("id_material", idMaterial).single();
        matFinal = matSync;
      }
      return jsonOk({ material: matFinal, lotes: lotesFinal });
    }

    if (accion === "entrada") {
      const idMaterial = String(body.id_material || "").trim();
      const cantidad = Number(body.cantidad);
      if (!idMaterial) return jsonError("id_material es obligatorio", 400);
      if (!cantidad || cantidad <= 0) return jsonError("Introduce una cantidad válida", 400);
      const { data: mat } = await supabaseAdmin.from("material").select("*").eq("id_material", idMaterial).maybeSingle();
      if (!mat) return jsonError(`No se encontró el material "${idMaterial}"`, 404);
      const loteId = strField(body.lote_id);
      await registrarMovimiento(supabaseAdmin, mat.nombre, "Entrada", cantidad, String(body.usuario || "Usuario"), String(body.motivo || "Entrada"), String(body.observaciones || ""));
      if (loteId) {
        const { data: lote } = await supabaseAdmin.from("material_ubicaciones").select("*").eq("id", loteId).maybeSingle();
        if (!lote) return jsonError("Lote no encontrado", 404);
        await supabaseAdmin.from("material_ubicaciones").update({ stock_local: (Number(lote.stock_local) || 0) + cantidad }).eq("id", loteId);
        await sincronizarStockMaterial(supabaseAdmin, idMaterial);
      } else {
        await supabaseAdmin.from("material").update({ stock_actual: (Number(mat.stock_actual) || 0) + cantidad }).eq("id_material", idMaterial);
      }
      const { data: matFinal } = await supabaseAdmin.from("material").select("*").eq("id_material", idMaterial).single();
      return jsonOk({ material: matFinal });
    }

    if (accion === "subdivision") {
      const idMaterial = String(body.id_material || "").trim();
      const loteOrigenId = String(body.lote_origen_id || "").trim();
      const destinos = Array.isArray(body.destinos) ? body.destinos as Record<string, unknown>[] : [];
      if (!idMaterial || !loteOrigenId) return jsonError("id_material y lote_origen_id son obligatorios", 400);
      const validos = destinos.filter(f => f.id_ubicacion && Number(f.cantidad) > 0);
      if (!validos.length) return jsonError("Añade al menos un destino con cantidad", 400);
      const { data: loteOrigen } = await supabaseAdmin.from("material_ubicaciones").select("*").eq("id", loteOrigenId).maybeSingle();
      if (!loteOrigen) return jsonError("Bote de origen no encontrado", 404);
      const { data: mat } = await supabaseAdmin.from("material").select("*").eq("id_material", idMaterial).maybeSingle();
      if (!mat) return jsonError(`No se encontró el material "${idMaterial}"`, 404);
      const stockOrigen = Number(loteOrigen.stock_local) || 0;
      const totalRepartido = validos.reduce((s, f) => s + Number(f.cantidad), 0);
      if (totalRepartido > stockOrigen) return jsonError(`Stock insuficiente en el bote madre (${stockOrigen})`, 400);

      // Bloqueo optimista: la condición eq("stock_local", stockOrigen) hace que la escritura
      // solo tenga efecto si nadie más ha tocado el bote madre desde que lo leímos arriba. Sin
      // esto, dos subdivisiones simultáneas del mismo bote podrían leer el mismo stock, pasar
      // ambas la validación, y la segunda escritura pisaría a la primera (double-spend).
      const { data: loteActualizado, error: updateError } = await supabaseAdmin
        .from("material_ubicaciones")
        .update({ stock_local: stockOrigen - totalRepartido })
        .eq("id", loteOrigenId)
        .eq("stock_local", loteOrigen.stock_local)
        .select()
        .maybeSingle();
      if (updateError) return jsonError(`No se pudo actualizar el bote madre: ${updateError.message}`, 400);
      if (!loteActualizado) return jsonError("El stock del bote madre cambió mientras se procesaba la subdivisión — vuelve a intentarlo", 409);

      const creados = [];
      for (const f of validos) {
        const cant = Number(f.cantidad);
        const nuevo = {
          id: genId("LU"), id_material: idMaterial, id_ubicacion: String(f.id_ubicacion),
          stock_local: cant, stock_minimo_local: numField(f.stock_min) || 0, stock_optimo_local: numField(f.stock_opt) || 0,
          id_lote_padre: loteOrigenId, unidad_lote: strField(f.unidad),
        };
        const { data, error } = await supabaseAdmin.from("material_ubicaciones").insert(nuevo).select().single();
        if (error) return jsonError(`No se pudo subdividir: ${error.message}`, 400);
        creados.push(data);
        await registrarMovimiento(supabaseAdmin, mat.nombre, "Subdivisión", cant, String(body.usuario || "Usuario"), `Subdividido de bote ${loteOrigenId} a ${f.id_ubicacion}`);
      }
      return jsonOk({ creados });
    }

    if (accion === "eliminar_lote") {
      const loteId = String(body.lote_id || "").trim();
      if (!loteId) return jsonError("lote_id es obligatorio", 400);
      const { data: lote } = await supabaseAdmin.from("material_ubicaciones").select("*").eq("id", loteId).maybeSingle();
      if (!lote) return jsonError("Bote no encontrado", 404);
      const { error } = await supabaseAdmin.from("material_ubicaciones").delete().eq("id", loteId);
      if (error) return jsonError(`No se pudo eliminar: ${error.message}`, 400);
      await sincronizarStockMaterial(supabaseAdmin, lote.id_material);
      return jsonOk({ eliminado: loteId });
    }

    if (accion === "transferencia_masiva") {
      const idOrigen = String(body.id_origen_ubicacion || "").trim();
      const idDestino = String(body.id_destino_ubicacion || "").trim();
      const items = Array.isArray(body.items) ? body.items as Record<string, unknown>[] : [];
      if (!idOrigen || !idDestino) return jsonError("Origen y destino son obligatorios", 400);
      if (!items.length) return jsonError("Introduce la cantidad de al menos un material", 400);
      let procesados = 0;
      for (const item of items) {
        const idMaterial = String(item.id_material || "");
        const cant = Number(item.cantidad) || 0;
        if (!idMaterial || cant <= 0) continue;
        const { data: mat } = await supabaseAdmin.from("material").select("*").eq("id_material", idMaterial).maybeSingle();
        if (!mat) continue;
        if (item.es_lote) {
          const { data: loteOrigen } = await supabaseAdmin.from("material_ubicaciones").select("*").eq("id_material", idMaterial).eq("id_ubicacion", idOrigen).maybeSingle();
          if (!loteOrigen) continue;
          const stockOrigen = Number(loteOrigen.stock_local) || 0;
          await supabaseAdmin.from("material_ubicaciones").update({ stock_local: Math.max(0, stockOrigen - cant) }).eq("id", loteOrigen.id);
        } else {
          await supabaseAdmin.from("material").update({ stock_actual: 0 }).eq("id_material", idMaterial);
          const restante = (Number(mat.stock_actual) || 0) - cant;
          if (restante > 0) {
            await supabaseAdmin.from("material_ubicaciones").insert({ id: genId("LU"), id_material: idMaterial, id_ubicacion: idOrigen, stock_local: restante, stock_minimo_local: 0, stock_optimo_local: 0 });
          }
        }
        const { data: loteDestino } = await supabaseAdmin.from("material_ubicaciones").select("*").eq("id_material", idMaterial).eq("id_ubicacion", idDestino).maybeSingle();
        if (loteDestino) {
          await supabaseAdmin.from("material_ubicaciones").update({ stock_local: (Number(loteDestino.stock_local) || 0) + cant }).eq("id", loteDestino.id);
        } else {
          await supabaseAdmin.from("material_ubicaciones").insert({ id: genId("LU"), id_material: idMaterial, id_ubicacion: idDestino, stock_local: cant, stock_minimo_local: 0, stock_optimo_local: 0 });
        }
        await registrarMovimiento(supabaseAdmin, mat.nombre, "Traslado", cant, String(body.usuario || "Usuario"), `NFC · De: ${idOrigen} → ${idDestino}`);
        procesados++;
      }
      return jsonOk({ procesados });
    }
  }

  // ── eliminar material del catálogo: solo Administrador ──
  if (accion === "eliminar") {
    const { error: authError, supabaseAdmin } = await requireAdmin(req);
    if (authError) return authError;
    const idMaterial = String(body.id_material || "").trim();
    if (!idMaterial) return jsonError("id_material es obligatorio", 400);
    // Los lotes de material_ubicaciones caen en cascada (FK on delete cascade).
    const { error } = await supabaseAdmin.from("material").delete().eq("id_material", idMaterial);
    if (error) return jsonError(`No se pudo eliminar: ${error.message}`, 400);
    return jsonOk({ eliminado: idMaterial });
  }

  // ── revisión de inventario: aplicar/descartar (Admin/Gestor/Profesor) ──
  if (accion === "revision_aplicar" || accion === "revision_descartar") {
    const { error: authError, supabaseAdmin } = await requireStaff(req);
    if (authError) return authError;
    const idRevision = String(body.id_revision || "").trim();
    if (!idRevision) return jsonError("id_revision es obligatorio", 400);
    const { data: rev } = await supabaseAdmin.from("revisiones_inventario").select("*").eq("id_revision", idRevision).maybeSingle();
    if (!rev) return jsonError("Revisión no encontrada", 404);

    if (accion === "revision_descartar") {
      await supabaseAdmin.from("revisiones_inventario").delete().eq("id_revision", idRevision);
      return jsonOk({ descartada: idRevision });
    }

    // aplicar
    const { data: mat } = await supabaseAdmin.from("material").select("*").eq("id_material", rev.id_material).maybeSingle();
    if (!mat) return jsonError("Material no encontrado", 404);
    const lotes = await getLotes(supabaseAdmin, rev.id_material);
    const stockRealNum = Number(rev.stock_real);
    if (lotes.length > 0) {
      const stockAppActual = lotes.reduce((s: number, l: any) => s + (Number(l.stock_local) || 0), 0);
      const diferencia = stockRealNum - stockAppActual;
      const primerLote = lotes[0];
      const nuevoLocal = Math.max(0, (Number(primerLote.stock_local) || 0) + diferencia);
      await supabaseAdmin.from("material_ubicaciones").update({ stock_local: nuevoLocal }).eq("id", primerLote.id);
      await sincronizarStockMaterial(supabaseAdmin, rev.id_material);
    } else {
      await supabaseAdmin.from("material").update({ stock_actual: stockRealNum }).eq("id_material", rev.id_material);
    }
    await registrarMovimiento(supabaseAdmin, mat.nombre, "Ajuste", Math.abs(Number(rev.diferencia) || 0), String(body.usuario || "Usuario"), `Ajuste por revisión de inventario (alumno: ${rev.usuario})`);
    await supabaseAdmin.from("revisiones_inventario").delete().eq("id_revision", idRevision);
    const { data: matFinal } = await supabaseAdmin.from("material").select("*").eq("id_material", rev.id_material).single();
    return jsonOk({ material: matFinal, aplicada: idRevision });
  }

  return jsonError("accion no reconocida", 400);
});
