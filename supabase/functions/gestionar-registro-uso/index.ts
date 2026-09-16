// Módulo Registros de uso (Cabina de bioseguridad / Autoclave / Vitrina de gases) — ver
// docs/modulo-registros-uso.md. Alta abierta a cualquier rol logueado
// (incluido Alumno, ver `registros-uso` en `nav` de PERMISOS); cerrar/
// descartar sesiones ajenas es solo Gestor/Administrador
// (`_puedeGestionarRegistros()` en js/registros-uso.js).
import { requireAdminOrGestor, requireValidSession, jsonError, jsonOk, handleCorsPreflight } from "../_shared/auth.ts";

// `sesionAbierta`: el uso tiene presencia continua, así que admite abrir sesión al entrar y
// cerrarla al salir (cabina y vitrina). El autoclave es un ciclo automático: se registra de una vez.
const TABLAS: Record<string, { tabla: string; prefix: string; campos: string[]; sesionAbierta: boolean }> = {
  cabina: {
    tabla: "registros_cabina", prefix: "RC", sesionAbierta: true,
    campos: ["practica_tecnica", "nivel_riesgo", "verificacion_previa", "descontaminacion_posterior"],
  },
  autoclave: {
    tabla: "registros_autoclave", prefix: "RA", sesionAbierta: false,
    campos: ["programa_ciclo", "tipo_carga", "resultado_control"],
  },
  vitrina: {
    tabla: "registros_vitrina", prefix: "RV", sesionAbierta: true,
    campos: ["practica_tecnica", "productos_quimicos", "verificacion_previa", "limpieza_posterior"],
  },
};

function strField(v: unknown) {
  return (v === "" || v === null || v === undefined) ? null : String(v);
}

async function nextIdReg(supabaseAdmin: any, tabla: string, prefix: string): Promise<string> {
  const { data } = await supabaseAdmin.from(tabla).select("id_registro");
  const nums = (data || []).map((r: { id_registro: string }) => parseInt((r.id_registro || "").replace(prefix, "")) || 0);
  const max = nums.length ? Math.max(0, ...nums) : 0;
  return prefix + String(max + 1).padStart(4, "0");
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
  const tipo = String(body.tipo || "");
  const cfg = TABLAS[tipo];
  if (!cfg) return jsonError(`tipo debe ser uno de: ${Object.keys(TABLAS).join(", ")}`, 400);
  const { tabla, prefix } = cfg;

  // ── acciones de cualquier sesión válida ──
  if (["iniciar_rapido", "deshacer_inicio", "guardar_sesion"].includes(accion)) {
    const { error: authError, email, supabaseAdmin } = await requireValidSession(req);
    if (authError) return authError;

    if (accion === "iniciar_rapido") {
      if (!cfg.sesionAbierta) return jsonError("Este tipo de equipo no admite sesión abierta", 400);
      const idEquipo = String(body.id_equipo || "").trim();
      if (!idEquipo) return jsonError("id_equipo es obligatorio", 400);
      const ahora = new Date();
      const idRegistro = await nextIdReg(supabaseAdmin, tabla, prefix);
      const datos = {
        id_registro: idRegistro, id_equipo: idEquipo, usuario: email,
        fecha: ahora.toISOString().split("T")[0], hora_inicio: ahora.toTimeString().slice(0, 5),
        estado: "Abierta",
      };
      const { data, error } = await supabaseAdmin.from(tabla).insert(datos).select().single();
      if (error) return jsonError(`No se pudo iniciar la sesión: ${error.message}`, 400);
      return jsonOk({ registro: data });
    }

    if (accion === "deshacer_inicio") {
      const idRegistro = String(body.id_registro || "").trim();
      if (!idRegistro) return jsonError("id_registro es obligatorio", 400);
      const { data: reg } = await supabaseAdmin.from(tabla).select("*").eq("id_registro", idRegistro).maybeSingle();
      if (!reg) return jsonError("Registro no encontrado", 404);
      if ((reg.usuario || "").toLowerCase().trim() !== email.toLowerCase().trim()) {
        return jsonError("Solo quien inició la sesión puede deshacerla", 403);
      }
      const { error } = await supabaseAdmin.from(tabla).delete().eq("id_registro", idRegistro);
      if (error) return jsonError(`No se pudo deshacer: ${error.message}`, 400);
      return jsonOk({ eliminado: idRegistro });
    }

    // guardar_sesion: crear (sesión completa / ciclo, siempre Cerrada) o cerrar una Abierta existente
    const idRegistro = strField(body.id_registro);
    const fecha = String(body.fecha || "").trim();
    const horaInicio = String(body.hora_inicio || "").trim();
    const horaFin = strField(body.hora_fin);
    const incidencias = strField(body.incidencias);
    const camposPermitidos = cfg.campos;
    const camposInput = (body.campos && typeof body.campos === "object") ? body.campos as Record<string, unknown> : {};
    const campos: Record<string, unknown> = {};
    for (const c of camposPermitidos) campos[c] = strField(camposInput[c]);

    if (idRegistro) {
      // Cerrar una sesión existente: solo el dueño o Admin/Gestor.
      const { data: reg } = await supabaseAdmin.from(tabla).select("*").eq("id_registro", idRegistro).maybeSingle();
      if (!reg) return jsonError("Registro no encontrado", 404);
      const { data: userRow } = await supabaseAdmin.from("users").select("rol").eq("email", email).maybeSingle();
      const esStaff = userRow && ["Administrador", "Gestor"].includes(userRow.rol);
      if ((reg.usuario || "").toLowerCase().trim() !== email.toLowerCase().trim() && !esStaff) {
        return jsonError("No tienes permiso para cerrar esta sesión", 403);
      }
      const datos = { fecha, hora_inicio: horaInicio, hora_fin: horaFin, incidencias, estado: "Cerrada", ...campos };
      const { data, error } = await supabaseAdmin.from(tabla).update(datos).eq("id_registro", idRegistro).select().single();
      if (error) return jsonError(`No se pudo guardar: ${error.message}`, 400);
      return jsonOk({ registro: data });
    } else {
      const idEquipo = String(body.id_equipo || "").trim();
      if (!idEquipo || !fecha || !horaInicio) return jsonError("id_equipo, fecha y hora_inicio son obligatorios", 400);
      const nuevoId = await nextIdReg(supabaseAdmin, tabla, prefix);
      const datos = {
        id_registro: nuevoId, id_equipo: idEquipo, usuario: email, fecha, hora_inicio: horaInicio,
        hora_fin: horaFin, incidencias, estado: "Cerrada", ...campos,
      };
      const { data, error } = await supabaseAdmin.from(tabla).insert(datos).select().single();
      if (error) return jsonError(`No se pudo guardar: ${error.message}`, 400);
      return jsonOk({ registro: data });
    }
  }

  // ── descartar_sesion: solo Admin/Gestor ──
  if (accion === "descartar_sesion") {
    const { error: authError, supabaseAdmin } = await requireAdminOrGestor(req);
    if (authError) return authError;
    const idRegistro = String(body.id_registro || "").trim();
    if (!idRegistro) return jsonError("id_registro es obligatorio", 400);
    const { error } = await supabaseAdmin.from(tabla).delete().eq("id_registro", idRegistro);
    if (error) return jsonError(`No se pudo eliminar: ${error.message}`, 400);
    return jsonOk({ eliminado: idRegistro });
  }

  return jsonError("accion no reconocida", 400);
});
