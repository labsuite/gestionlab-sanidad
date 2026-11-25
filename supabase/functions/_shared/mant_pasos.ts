// Pasos de un mantenimiento (checklist) y las intervenciones que salen de ellos.
// Lo usa la Edge Function gestionar-mantenimiento; está aparte para poder probarlo desde
// Node contra la base (tools/mantenimiento/pasos.test.mjs).
import * as VP from "./verif_pipetas.js";

// Parsea el checklist recibido en el cuerpo. Un paso normal es {texto, hecho}; un paso de
// COMPROBACIÓN (el plan trae "(criterio: …)") es {texto, criterio, resultado, nota, hecho}:
// resultado 'cumple' | 'no_cumple' | null, y la nota (qué se vio) solo si no cumple.
// Una comprobación puede llevar además `medidas`: lo tecleado en la calculadora de
// criterios (js/criterios-calc.js) — por cada tolerancia numérica del criterio, los
// datos del equipo y del instrumento y lo que salió. Se guardan como constancia; el
// resultado del paso sigue siendo `resultado`.
//
// Desde 2026-11-25 cada paso tiene un TIPO (ver docs/modulo-mantenimiento.md, «El preventivo
// verifica»): 'comprobar' (resultado cumple | no_cumple | no_aplica), 'hacer' (casilla) o
// 'sustituir' (sustitución programada de una pieza). Una comprobación que no cumple dice
// además qué se hizo (`accion`): 'corregido' en el momento (engrasar, limpiar…), 'intervencion'
// (se cambió una pieza o se ajustó: queda también como intervención del equipo) o
// 'reparacion' (necesita reparación: aviso de avería). Los pasos sin `tipo` (guardados antes)
// son 'comprobar' si llevan criterio y 'hacer' si no.
type Medida = Record<string, string | boolean | null>;
export type Paso = {
  texto: string; hecho: boolean; tipo?: string; criterio?: string | null; resultado?: string | null; nota?: string | null;
  accion?: string | null; actuacion?: string | null; tipo_intervencion?: string | null; id_intervencion?: string;
  medidas?: Medida[]; auto?: boolean;
};
const TIPOS_PASO = ["comprobar", "hacer", "sustituir"];
const ACCIONES_PASO = ["corregido", "intervencion", "reparacion"];
// Tipos de intervención que puede generar un paso (subconjunto de la lista canónica).
const TIPOS_INT_PASO = ["Sustitución de pieza", "Calibración", "Cambio de consumibles", "Correctivo"];
const RESULTADOS_MANT = ["apto", "apto_tras_intervencion", "no_apto"];
const CAMPOS_MEDIDA = ["regla", "magnitud", "unidad", "equipo", "referencia", "valor", "lecturas", "detalle"];
function parseMedidas(v: unknown): Medida[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const out = v.slice(0, 12).map((m) => {
    const o = (m ?? {}) as Record<string, unknown>;
    const r: Medida = {};
    for (const k of CAMPOS_MEDIDA) if (o[k] != null && o[k] !== "") r[k] = String(o[k]).slice(0, 300);
    r.cumple = o.cumple === true ? true : o.cumple === false ? false : null;
    return r;
  }).filter((m) => m.regla);
  return out.length ? out : undefined;
}
export function parsePasos(v: unknown): Paso[] | null {
  if (!Array.isArray(v)) return null;
  const txt = (x: unknown, max = 1000) => x == null || String(x).trim() === "" ? null : String(x).trim().slice(0, max);
  return v.map((p) => {
    const o = (p ?? {}) as Record<string, unknown>;
    const texto = String(o.texto ?? "");
    const criterio = o.criterio ? String(o.criterio).trim() : "";
    const tipo = TIPOS_PASO.includes(String(o.tipo)) ? String(o.tipo) : (criterio ? "comprobar" : "hacer");
    // Una vez creada la intervención de un paso, su id viaja con él: no se vuelve a crear.
    const idInt = txt(o.id_intervencion, 40);
    const conId = idInt ? { id_intervencion: idInt } : {};
    if (tipo === "hacer") return { texto, tipo, hecho: o.hecho === true };
    if (tipo === "sustituir") {
      const hecho = o.hecho === true;
      return {
        texto, tipo, criterio: criterio || null, hecho,
        actuacion: hecho ? txt(o.actuacion) : null,
        tipo_intervencion: hecho ? (TIPOS_INT_PASO.includes(String(o.tipo_intervencion)) ? String(o.tipo_intervencion) : "Sustitución de pieza") : null,
        ...conId,
      };
    }
    const resultado = ["cumple", "no_cumple", "no_aplica"].includes(String(o.resultado)) ? String(o.resultado) : null;
    const noCumple = resultado === "no_cumple";
    const nota = noCumple ? txt(o.nota) : null;
    const accion = noCumple && ACCIONES_PASO.includes(String(o.accion)) ? String(o.accion) : null;
    const actuacion = accion === "corregido" || accion === "intervencion" ? txt(o.actuacion) : null;
    const tipoInt = accion === "intervencion"
      ? (TIPOS_INT_PASO.includes(String(o.tipo_intervencion)) ? String(o.tipo_intervencion) : "Sustitución de pieza") : null;
    const medidas = criterio ? parseMedidas(o.medidas) : undefined;
    return {
      texto, tipo, criterio: criterio || null, resultado, nota, accion, actuacion, tipo_intervencion: tipoInt,
      hecho: !!resultado, ...(medidas ? { medidas } : {}), ...conId,
    };
  });
}

/** Lo que le falta a un paso para poder finalizar, o null. Un «no cumple» sin anotar qué
 *  se vio no sirve de registro; si se corrigió o se cambió una pieza, hay que decir qué se
 *  hizo. Los pasos de la verificación de una pipeta (auto) los rellena el servidor. Un «no
 *  cumple» sin `accion` (lo manda una pantalla antigua) se toma como «necesita reparación». */
export function faltaEnPaso(pasos: Paso[] | null): string | null {
  for (const p of pasos || []) {
    if (p.auto || VP.pasoVerificacion(p.texto)) continue;
    if (p.resultado !== "no_cumple") continue;
    if (!p.nota) return `Anota qué se ha visto en «${p.texto}», que no cumple`;
    if ((p.accion === "corregido" || p.accion === "intervencion") && !p.actuacion) {
      return `Escribe qué se ha hecho en «${p.texto}»`;
    }
  }
  return null;
}

export function resultadoMant(v: unknown): string | null {
  return RESULTADOS_MANT.includes(String(v)) ? String(v) : null;
}

/** id tipo PREFIJO + 6 caracteres al azar (varias en la misma llamada no chocan). */
function idAleatorio(prefijo: string): string {
  const abc = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const b = crypto.getRandomValues(new Uint8Array(6));
  return prefijo + Array.from(b, (x) => abc[x % abc.length]).join("");
}

/**
 * Cambiar una pieza o ajustar un equipo durante un mantenimiento es una INTERVENCIÓN del
 * equipo, y además queda en el paso del mantenimiento (decisión de Paloma, 2026-11-25): así
 * el historial del equipo dice qué pieza se cambió y cuándo, y que vino de un preventivo.
 * Se crea, ya cerrada y con su tarea resuelta, cuando el registro es válido ('finalizado'):
 * al finalizar si lo hace el profesorado, al dar el visto bueno si lo hizo el alumnado, y al
 * corregir un finalizado. Cada paso guarda el id: nunca se crea dos veces. Lo mismo con el
 * ajuste de una micropipeta (verificación AJUSTAR → repetición tras ajustar).
 * Un fallo aquí no deshace el mantenimiento: se devuelve como aviso.
 */
// deno-lint-ignore no-explicit-any
export async function registrarIntervencionesDeMant(supabaseAdmin: any, reg: any) {
  // deno-lint-ignore no-explicit-any
  const out: { registro: any; intervenciones: any[]; tareas: any[]; aviso?: string } = { registro: reg, intervenciones: [], tareas: [] };
  if (!reg || reg.estado !== "finalizado") return out;
  const { data: plan } = await supabaseAdmin.from("planes_mantenimiento")
    .select("operacion, tipo_intervencion").eq("id_plan", reg.id_plan).maybeSingle();
  const origen = `Mantenimiento preventivo ${reg.id_registro}`;
  const obs = `Registrada desde el mantenimiento «${plan?.operacion || "preventivo"}»${reg.periodo ? ` (${reg.periodo})` : ""}`;
  const fallos: string[] = [];

  async function crear(tipo: string, descripcion: string, tareaTxt: string, tareaObs: string | null, realizadoPor: string | null) {
    const idInt = idAleatorio("INT-");
    const { data: int, error } = await supabaseAdmin.from("intervenciones").insert({
      id_intervencion: idInt, id_equipo: reg.id_equipo, tipo, origen,
      fecha_realizacion: reg.fecha_realizacion, realizado_por: realizadoPor,
      proveedor: plan?.tipo_intervencion === "Externo" ? reg.realizado_por : null,
      descripcion_actuacion: descripcion, resultado: "Resuelto", estado: "Cerrada",
      actuacion_finalizada: true, lugar_intervencion: "En el centro", observaciones: obs,
    }).select().single();
    if (error || !int) { fallos.push(error?.message || "sin respuesta"); return null; }
    const { data: tarea } = await supabaseAdmin.from("tareas_intervencion").insert({
      id_tarea: idAleatorio("TSK-"), id_intervencion: idInt, descripcion: tareaTxt,
      resultado: "Resuelto", operativo: null, observaciones: tareaObs,
    }).select().single();
    out.intervenciones.push(int);
    if (tarea) out.tareas.push(tarea);
    return idInt;
  }

  let cambiado = false;
  const pasos: Paso[] = Array.isArray(reg.pasos) ? reg.pasos.map((p: Paso) => ({ ...p })) : [];
  for (const p of pasos) {
    if (p.id_intervencion) continue;
    const hecho = (p.actuacion || "").trim();
    if (p.tipo === "sustituir" && p.hecho) {
      const id = await crear(p.tipo_intervencion || "Sustitución de pieza",
        `${p.texto}${hecho ? ` — ${hecho}` : ""}`, hecho || p.texto, null, reg.realizado_por);
      if (id) { p.id_intervencion = id; cambiado = true; }
    } else if (p.tipo === "comprobar" && p.resultado === "no_cumple" && p.accion === "intervencion") {
      const id = await crear(p.tipo_intervencion || "Sustitución de pieza",
        `${hecho} (al revisar «${p.texto}»)`, hecho || p.texto, p.nota ? `Visto: ${p.nota}` : null, reg.realizado_por);
      if (id) { p.id_intervencion = id; cambiado = true; }
    }
  }
  // Micropipeta ajustada tras la verificación (AJUSTAR): el ajuste es una calibración.
  let verif = reg.verificacion;
  const tras = verif?.fases?.[1];
  if (tras?.ajustada_en && !verif.intervencion_ajuste) {
    const id = await crear("Calibración",
      "Ajuste de la micropipeta tras la verificación (resultado AJUSTAR) y repetición de la verificación",
      "Ajuste de la micropipeta", null, tras.ajustada_por || reg.realizado_por);
    if (id) { verif = { ...verif, intervencion_ajuste: id }; cambiado = true; }
  }
  if (cambiado) {
    const { data } = await supabaseAdmin.from("registro_mantenimientos")
      .update({ pasos, verificacion: verif ?? null }).eq("id_registro", reg.id_registro).select().single();
    if (data) out.registro = data;
  }
  if (fallos.length) out.aviso = `El mantenimiento se ha guardado, pero no se pudo registrar ${fallos.length} intervención(es): ${fallos[0]}`;
  return out;
}
