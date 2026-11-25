// Verificación EXTRAORDINARIA de una micropipeta tras una reparación o un cambio de junta
// (decisión de Paloma, 2026-11-25; plantilla de micropipetas, 6.2 punto 4): fuera de
// calendario, enlazada a la incidencia de la pipeta, sin cribado (10 réplicas a cada volumen)
// y con los mismos cálculos y criterios que la revisión anual (verif_pipetas.js).
//
// - La guarda gestionar-verif-pipetas (acciones extraordinaria_guardar / _eliminar).
// - Al finalizarla, el resultado se añade a la descripción de la incidencia. Si no es OK, la
//   pipeta sigue «Fuera de servicio» con la incidencia abierta.
// - Volver a «Operativo» sigue siendo una decisión explícita (cerrar la incidencia desde su
//   hilo), pero gestionar-incidencia no la deja pasar sin una extraordinaria OK de esa
//   incidencia: cierreOperativoPermitido().
// Pruebas: tools/verif-pipetas/extraordinaria.test.mjs (contra la base, con datos ficticios).
import * as VP from "./verif_pipetas.js";
import { calcularVerificacionRegistro, limpiarVerificacion, calculoParaGuardar, parametrosParaGuardar } from "./verif_pipetas_srv.ts";

// deno-lint-ignore no-explicit-any
type Db = any;
// deno-lint-ignore no-explicit-any
type Obj = Record<string, any>;

const CURSO = /^\d{4}-\d{4}$/;
const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const ABIERTA = ["Abierta", "En gestión"];

function idAleatorio(prefijo: string): string {
  const abc = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const b = crypto.getRandomValues(new Uint8Array(6));
  return prefijo + Array.from(b, (x) => abc[x % abc.length]).join("");
}

/** «200 µl: es +0,17 %, CV 0,05 % · 20 µl: …» de la última fase. */
export function resumenCalculo(calc: Obj): string {
  const ultima = calc?.fases?.[calc.fases.length - 1];
  return Object.entries((ultima?.volumenes || {}) as Obj).map(([clave, v]: [string, Obj]) => {
    const lim = (calc.limites || []).find((l: Obj) => l.clave === clave) || {};
    return (v.canales || []).map((c: Obj, i: number) =>
      `${VP.fmt(lim.v, lim.v < 10 ? 1 : 0)} µl${v.canales.length > 1 ? ` c${i + 1}` : ""}: error sistemático ${VP.fmt(c.es, 2, true)} %, CV corregido ${VP.fmt(c.cvCorr, 2)} % (${(VP.DECISION as Obj)[c.decision] || c.decision})`,
    ).join(" · ");
  }).join(" · ");
}

export const esOK = (resultado: unknown) => /^OK/.test(String(resultado || ""));

/**
 * Crea o actualiza una verificación extraordinaria. `body`: { id?, id_equipo, id_incidencia,
 * curso_academico, verificacion, finalizar?, fecha? }. Devuelve { error, status } o
 * { extra, incidencia?, equipo_estado? }.
 */
export async function guardarExtraordinaria(db: Db, body: Obj, firma: string): Promise<Obj> {
  const ahora = new Date().toISOString();
  const id = body.id ? String(body.id) : null;
  let fila: Obj | null = null;
  if (id) {
    const { data } = await db.from("verif_extraordinarias").select("*").eq("id", id).maybeSingle();
    if (!data) return { error: "No existe esa verificación extraordinaria", status: 404 };
    if (data.estado === "finalizada") return { error: "Esa verificación extraordinaria ya está finalizada", status: 400 };
    fila = data;
  }
  const idEquipo = String(fila?.id_equipo || body.id_equipo || "").trim();
  const idInc = String(fila?.id_incidencia || body.id_incidencia || "").trim();
  const curso = String(fila?.curso_academico || body.curso_academico || "");
  if (!idEquipo || !idInc) return { error: "Faltan la pipeta o la incidencia", status: 400 };
  if (!CURSO.test(curso)) return { error: "Curso académico no válido", status: 400 };
  if (!fila) {
    const { data: inc } = await db.from("incidencias").select("id_incidencia, id_equipo, estado").eq("id_incidencia", idInc).maybeSingle();
    if (!inc || inc.id_equipo !== idEquipo) return { error: `La incidencia ${idInc} no es de ${idEquipo}`, status: 400 };
    if (!ABIERTA.includes(inc.estado)) return { error: `La incidencia ${idInc} ya está cerrada`, status: 400 };
  }

  const previa: Obj | null = fila?.verificacion || null;
  const ver: Obj = limpiarVerificacion(body.verificacion) || limpiarVerificacion(previa) || { fases: [{ tipo: "inicial", volumenes: {} }] };
  // Repetición tras un AJUSTE: la firma el servidor (como en la revisión anual).
  if (ver.fases.length > 1) {
    const pt = previa?.fases?.[1];
    if (pt?.ajustada_en) {
      ver.fases[1].ajustada_por = pt.ajustada_por; ver.fases[1].ajustada_en = pt.ajustada_en;
    } else {
      const solo = await calcularVerificacionRegistro(db, idEquipo, curso, { ...ver, fases: [ver.fases[0]] }, true);
      if (solo?.calc?.resultado !== "AJUSTAR") return { error: "Solo se repite tras ajustar cuando la verificación ha dado AJUSTAR", status: 400 };
      ver.fases[1].ajustada_por = firma; ver.fases[1].ajustada_en = ahora;
    }
  }
  const r = await calcularVerificacionRegistro(db, idEquipo, curso, ver, true);
  if (!r) return { error: `${idEquipo} no tiene datos de verificación (tabla 6.4)`, status: 400 };
  const finalizar = body.finalizar === true;
  if (finalizar && !r.calc.final) {
    return { error: `La verificación no tiene resultado todavía: ${VP.resumenPendiente(r.calc)}. Guarda el progreso y termínala.`, status: 400 };
  }
  const verif = { ...ver, sin_cribado: true, calculo: calculoParaGuardar(r.calc), parametros: parametrosParaGuardar(r.par), calculado_en: ahora };
  const fecha = FECHA.test(String(body.fecha || "")) ? String(body.fecha) : ahora.slice(0, 10);
  const datos: Obj = { verificacion: verif, actualizado: ahora, realizado_por: firma };
  if (finalizar) Object.assign(datos, { estado: "finalizada", resultado: r.calc.resultado, fecha });

  const { data: extra, error } = fila
    ? await db.from("verif_extraordinarias").update(datos).eq("id", fila.id).select().single()
    : await db.from("verif_extraordinarias").insert({ id: idAleatorio("VX"), id_equipo: idEquipo, id_incidencia: idInc, curso_academico: curso, ...datos }).select().single();
  if (error || !extra) return { error: `No se pudo guardar: ${error?.message || "sin respuesta"}`, status: 400 };
  if (!finalizar) return { extra };

  // Finalizada: el resultado queda en la incidencia; si no es OK, la pipeta sigue fuera de servicio.
  const ok = esOK(r.calc.resultado);
  const texto = `Verificación extraordinaria ${extra.id} (10 réplicas, sin cribado): ${(VP.RESULTADO as Obj)[r.calc.resultado] || r.calc.resultado}. ` +
    `${resumenCalculo(r.calc)}. ` +
    (ok ? "Con este resultado la pipeta puede volver a estar operativa al cerrar la incidencia."
        : "La pipeta sigue fuera de servicio con la incidencia abierta.");
  const { data: inc } = await db.from("incidencias").select("descripcion_problema").eq("id_incidencia", idInc).maybeSingle();
  const fechaTxt = new Date().toLocaleDateString("es-ES", { timeZone: "Europe/Madrid" });
  const { data: incAct } = await db.from("incidencias").update({
    descripcion_problema: `${inc?.descripcion_problema || ""}\n\n[${fechaTxt} · ${firma}] ${texto}`.trim(),
  }).eq("id_incidencia", idInc).select().single();
  let equipoEstado: string | null = null;
  if (!ok) {
    await db.from("equipos").update({ estado_operativo: "Fuera de servicio" }).eq("id_activo", idEquipo);
    equipoEstado = "Fuera de servicio";
  }
  return { extra, incidencia: incAct, equipo_estado: equipoEstado };
}

/**
 * ¿Se puede cerrar como «Resuelta» la incidencia dejando el equipo «Operativo…»? Para una
 * micropipeta con datos de verificación que no está operativa, solo con una verificación
 * extraordinaria OK de esa incidencia. Devuelve el motivo si no se puede, o null.
 */
export async function cierreOperativoPermitido(db: Db, idIncidencia: string, estado: string, estadoEquipo: string): Promise<string | null> {
  if (estado !== "Resuelta" || !/^Operativo/i.test(estadoEquipo || "")) return null;
  const { data: inc } = await db.from("incidencias").select("id_equipo").eq("id_incidencia", idIncidencia).maybeSingle();
  if (!inc) return null;
  const { data: par } = await db.from("verif_pipetas_parametros").select("id_activo").eq("id_activo", inc.id_equipo).maybeSingle();
  if (!par) return null;
  const { data: eq } = await db.from("equipos").select("estado_operativo").eq("id_activo", inc.id_equipo).maybeSingle();
  if (/^Operativo/i.test(String(eq?.estado_operativo || ""))) return null;
  const { data: extras } = await db.from("verif_extraordinarias").select("resultado")
    .eq("id_incidencia", idIncidencia).eq("estado", "finalizada").order("actualizado", { ascending: false }).limit(1);
  if (extras?.[0] && esOK(extras[0].resultado)) return null;
  return `${inc.id_equipo} solo vuelve a estar operativa con una verificación extraordinaria OK de esta incidencia ` +
    "(10 réplicas a cada volumen, 6.2 de su protocolo). Hazla desde «🧪 Verificación extraordinaria» del hilo o desde «Verificación de pipetas». " +
    "Mientras, se puede cerrar dejándola fuera de servicio, o descartar la incidencia si no había avería.";
}
