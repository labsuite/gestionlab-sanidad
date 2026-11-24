// Verificación anual de las micropipetas: preparación del curso, sesiones de verificación y
// respuesta del profesorado sobre el tornillo de ajuste (2026-11-24). La verificación de
// cada pipeta va dentro de su revisión anual (gestionar-mantenimiento). Cálculo:
// _shared/verif_pipetas.js. Ver docs/modulo-verificacion-pipetas.md.
//
// Quién: la preparación y las sesiones las registra el profesorado (Profesor, Gestor,
// Administrador); el alumnado solo las lee y elige su sesión en la revisión de la pipeta.
// La respuesta sobre el tornillo de ajuste es solo del profesorado (encargo, apartado 9).
import { requireStaff, nombreCorto, jsonError, jsonOk, handleCorsPreflight } from "../_shared/auth.ts";
import { recalcularSesionesCurso } from "../_shared/verif_pipetas_srv.ts";

const CURSO = /^\d{4}-\d{4}$/;
const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const genId = (p: string) => p + Date.now().toString(36).toUpperCase().slice(-6) + Math.random().toString(36).slice(2, 4).toUpperCase();

// Solo objetos y textos cortos: los datos de la preparación y de la sesión son masas,
// absorbancias y elecciones. Se recortan para que nadie guarde aquí otra cosa.
// deno-lint-ignore no-explicit-any
function limpiar(v: any, prof = 0): any {
  if (prof > 6) return null;
  if (v === null || v === undefined) return null;
  if (typeof v === "number" || typeof v === "boolean") return v;
  if (typeof v === "string") return v.slice(0, 200);
  if (Array.isArray(v)) return v.slice(0, 60).map((x) => limpiar(x, prof + 1));
  if (typeof v === "object") {
    // deno-lint-ignore no-explicit-any
    const o: any = {};
    for (const [k, x] of Object.entries(v).slice(0, 80)) o[k.slice(0, 40)] = limpiar(x, prof + 1);
    return o;
  }
  return null;
}

Deno.serve(async (req) => {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;
  if (req.method !== "POST") return jsonError("Método no permitido", 405);
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return jsonError("Cuerpo inválido (se esperaba JSON)", 400); }
  const accion = String(body.accion || "");

  const auth = await requireStaff(req);
  if ("error" in auth) return auth.error;
  // deno-lint-ignore no-explicit-any
  const { user, supabaseAdmin: db } = auth as any;
  const firma = nombreCorto(user?.nombre || "") || user?.email || "";

  if (accion === "guardar_preparacion") {
    const curso = String(body.curso_academico || "");
    if (!CURSO.test(curso)) return jsonError("Curso académico no válido", 400);
    const datos = limpiar(body.datos) || {};
    const tubos = (Array.isArray(body.tubos) ? body.tubos : []).slice(0, 80).map((t) => limpiar(t))
      .filter((t) => t && t.id && t.disolucion);
    const { data: ya } = await db.from("verif_preparaciones").select("id").eq("curso_academico", curso).maybeSingle();
    const fila = { curso_academico: curso, datos, tubos, registrado_por: firma, actualizado: new Date().toISOString() };
    const { data, error } = ya
      ? await db.from("verif_preparaciones").update(fila).eq("id", ya.id).select().single()
      : await db.from("verif_preparaciones").insert({ id: genId("VP"), ...fila }).select().single();
    if (error) return jsonError(`No se pudo guardar la preparación: ${error.message}`, 400);
    const sesiones = await recalcularSesionesCurso(db, curso);
    return jsonOk({ preparacion: data, sesiones });
  }

  if (accion === "guardar_sesion") {
    const curso = String(body.curso_academico || "");
    const fecha = String(body.fecha || "");
    if (!CURSO.test(curso)) return jsonError("Curso académico no válido", 400);
    if (!FECHA.test(fecha)) return jsonError("Fecha no válida", 400);
    const id = body.id ? String(body.id) : null;
    const fila = {
      curso_academico: curso, fecha, bloque: body.bloque ? String(body.bloque).slice(0, 40) : null,
      personas: body.personas ? String(body.personas).slice(0, 300) : null,
      datos: limpiar(body.datos) || {}, registrado_por: firma, actualizado: new Date().toISOString(),
    };
    let guardada;
    if (id) {
      const { data, error } = await db.from("verif_sesiones").update(fila).eq("id", id).select().single();
      if (error || !data) return jsonError(`No se pudo guardar la sesión: ${error?.message || "no existe"}`, 400);
      guardada = data;
    } else {
      const { data, error } = await db.from("verif_sesiones").insert({ id: genId("VS"), ...fila }).select().single();
      if (error) return jsonError(`No se pudo crear la sesión: ${error.message}`, 400);
      guardada = data;
    }
    const sesiones = await recalcularSesionesCurso(db, curso);
    return jsonOk({ sesion: sesiones.find((s) => s.id === guardada.id) || guardada, sesiones });
  }

  if (accion === "eliminar_sesion") {
    const id = String(body.id || "");
    const { data: s } = await db.from("verif_sesiones").select("id, curso_academico").eq("id", id).maybeSingle();
    if (!s) return jsonError("No existe esa sesión", 404);
    // Si alguna pipeta se ha medido en ella, no se borra: sus resultados dependen de ella.
    const { data: conVer } = await db.from("registro_mantenimientos").select("id_registro, id_equipo, verificacion")
      .not("verificacion", "is", null);
    const usos = (conVer || []).filter((r: { verificacion: unknown }) => JSON.stringify(r.verificacion).includes(`"${id}"`));
    if (usos.length) {
      return jsonError(`No se puede borrar: hay pipetas medidas en esta sesión (${usos.map((u: { id_equipo: string }) => u.id_equipo).join(", ")})`, 400);
    }
    await db.from("verif_sesiones").delete().eq("id", id);
    const sesiones = await recalcularSesionesCurso(db, s.curso_academico);
    return jsonOk({ eliminada: id, sesiones });
  }

  // «¿Tiene tornillo de ajuste bajo la tapa del émbolo?» (6.5). Se guarda en los datos de la
  // pipeta y no lo pisa la recarga del CSV; Claude Code lo pasa al CSV del laboratorio.
  if (accion === "responder_ajuste") {
    const idActivo = String(body.id_activo || "");
    const respuesta = body.respuesta === "si" ? "si" : body.respuesta === "no" ? "no" : null;
    if (!idActivo || !respuesta) return jsonError("Falta la pipeta o la respuesta", 400);
    const { data, error } = await db.from("verif_pipetas_parametros")
      .update({ ajuste_respuesta: respuesta, ajuste_respuesta_por: firma, ajuste_respuesta_en: new Date().toISOString() })
      .eq("id_activo", idActivo).select().single();
    if (error || !data) return jsonError(`No se pudo guardar: ${error?.message || "la pipeta no tiene datos de verificación"}`, 400);
    return jsonOk({ parametros: data });
  }

  return jsonError(`Acción desconocida: ${accion}`, 400);
});
