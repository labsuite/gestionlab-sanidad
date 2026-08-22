// Módulo Equipos — mismo patrón que gestionar-proveedor/gestionar-ubicacion.
// Solo Admin/Gestor. id_activo es la clave primaria; cambiarla es la acción
// "cambiar_id" (por separado de "actualizar", que ya no toca el ID) — todas
// las FK hacia equipos(id_activo) tienen ON UPDATE CASCADE (ver
// scripts/migrar_esquema_equipos_y_pedidos_publico.py), así que un UPDATE
// del id_activo propaga solo a incidencias/intervenciones/mantenimiento/
// reservas/líneas de pedido sin tocarlas una a una.
//
// accion "actualizar_estado" es un atajo ligero: solo cambia estado_operativo,
// usado por actualizarEstadoEquipo() cuando se reporta una incidencia o se
// cierra una intervención — no exige el resto de campos obligatorios.
import { requireAdminOrGestor, requireStaff, jsonError, jsonOk, handleCorsPreflight } from "../_shared/auth.ts";

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
  const idActivo = String(body.id_activo || "").trim();
  if (!idActivo) return jsonError("id_activo es obligatorio", 400);

  // actualizar_estado la dispara el Profesor indirectamente al reportar una
  // incidencia o cerrar una intervención de su equipo — el resto (editar
  // ficha completa, crear, eliminar) sigue reservado a Admin/Gestor.
  const { error: authError, supabaseAdmin } = accion === "actualizar_estado"
    ? await requireStaff(req)
    : await requireAdminOrGestor(req);
  if (authError) return authError;

  if (accion === "actualizar_estado") {
    const estadoOperativo = String(body.estado_operativo || "").trim();
    if (!estadoOperativo) return jsonError("estado_operativo es obligatorio", 400);
    const { data, error } = await supabaseAdmin.from("equipos")
      .update({ estado_operativo: estadoOperativo }).eq("id_activo", idActivo).select().single();
    if (error) return jsonError(`No se pudo actualizar el estado: ${error.message}`, 400);
    if (!data) return jsonError(`No se encontró el equipo "${idActivo}"`, 404);
    return jsonOk({ equipo: data });
  }

  if (accion === "crear" || accion === "actualizar") {
    const tipoEquipo = String(body.tipo_equipo || "").trim();
    const marca = String(body.marca || "").trim();
    if (!tipoEquipo) return jsonError("El tipo de equipo es obligatorio", 400);
    if (!marca) return jsonError("La marca es obligatoria", 400);

    const numField = (v: unknown) => (v === "" || v === null || v === undefined) ? null : Number(v);
    const strField = (v: unknown) => (v === "" || v === null || v === undefined) ? null : String(v);

    const datos = {
      tipo_equipo: tipoEquipo,
      marca,
      modelo: strField(body.modelo),
      numero_serie: strField(body.numero_serie),
      ubicacion: strField(body.ubicacion),
      responsable: strField(body.responsable),
      modulos_responsables: strField(body.modulos_responsables),
      fecha_adquisicion: strField(body.fecha_adquisicion),
      origen_financiacion: strField(body.origen_financiacion),
      proveedor_compra: strField(body.proveedor_compra),
      proveedor_servicio_tecnico: strField(body.proveedor_servicio_tecnico),
      estado_operativo: strField(body.estado_operativo),
      manual_ficha_tecnica: strField(body.manual_ficha_tecnica),
      observaciones: strField(body.observaciones),
      coste: numField(body.coste),
      protocolo_uso: strField(body.protocolo_uso),
      mes_inicio_temporada: numField(body.mes_inicio_temporada),
      mes_fin_temporada: numField(body.mes_fin_temporada),
    };

    if (accion === "crear") {
      const { data, error } = await supabaseAdmin.from("equipos")
        .insert({ id_activo: idActivo, ...datos }).select().single();
      if (error) {
        if (error.code === "23505") return jsonError(`Ya existe un equipo con el ID "${idActivo}"`, 409);
        return jsonError(`No se pudo crear: ${error.message}`, 400);
      }
      return jsonOk({ equipo: data });
    } else {
      const { data, error } = await supabaseAdmin.from("equipos")
        .update(datos).eq("id_activo", idActivo).select().single();
      if (error) return jsonError(`No se pudo actualizar: ${error.message}`, 400);
      if (!data) return jsonError(`No se encontró el equipo "${idActivo}"`, 404);
      return jsonOk({ equipo: data });
    }
  }

  if (accion === "cambiar_id") {
    const nuevoIdActivo = String(body.nuevo_id_activo || "").trim();
    if (!nuevoIdActivo) return jsonError("nuevo_id_activo es obligatorio", 400);
    if (nuevoIdActivo === idActivo) return jsonError("El nuevo ID es igual al actual", 400);

    const { data: existente } = await supabaseAdmin.from("equipos").select("id_activo").eq("id_activo", nuevoIdActivo).maybeSingle();
    if (existente) return jsonError(`Ya existe un equipo con el ID "${nuevoIdActivo}"`, 409);

    const { data, error } = await supabaseAdmin.from("equipos")
      .update({ id_activo: nuevoIdActivo }).eq("id_activo", idActivo).select().single();
    if (error) return jsonError(`No se pudo cambiar el ID: ${error.message}`, 400);
    if (!data) return jsonError(`No se encontró el equipo "${idActivo}"`, 404);
    return jsonOk({ equipo: data });
  }

  if (accion === "eliminar") {
    const { error } = await supabaseAdmin.from("equipos").delete().eq("id_activo", idActivo);
    if (error) return jsonError(`No se pudo eliminar: ${error.message}`, 400);
    return jsonOk({ eliminado: idActivo });
  }

  return jsonError("accion debe ser 'crear', 'actualizar', 'actualizar_estado', 'cambiar_id' o 'eliminar'", 400);
});
