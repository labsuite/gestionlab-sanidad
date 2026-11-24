// Verificación de micropipetas — lo que necesitan las Edge Functions alrededor del cálculo
// (que está en verif_pipetas.js, compartido con la pantalla). Ver
// docs/modulo-verificacion-pipetas.md.
import * as VP from "./verif_pipetas.js";

// deno-lint-ignore no-explicit-any
type Db = any;
// deno-lint-ignore no-explicit-any
type Obj = Record<string, any>;

const ordenSesion = (a: Obj, b: Obj) =>
  String(a.fecha).localeCompare(String(b.fecha)) || String(a.creado).localeCompare(String(b.creado));

/**
 * Recalcula y guarda los resultados de todas las sesiones de un curso, por orden de fecha:
 * cada una depende de las anteriores (masa de los tubos al cerrarlos, método validado,
 * repetibilidad de las balanzas). Se llama al guardar la preparación o cualquier sesión.
 */
export async function recalcularSesionesCurso(db: Db, curso: string): Promise<Obj[]> {
  const [{ data: prepRow }, { data: sesiones }] = await Promise.all([
    db.from("verif_preparaciones").select("*").eq("curso_academico", curso).maybeSingle(),
    db.from("verif_sesiones").select("*").eq("curso_academico", curso),
  ]);
  const prep = VP.calcularPreparacion(prepRow?.datos || {});
  const tubosPrep = Array.isArray(prepRow?.tubos) ? prepRow.tubos : [];
  const lista = (sesiones || []).slice().sort(ordenSesion);
  const anteriores: Obj = {};
  const validaciones: Obj[] = [];
  let cursoValidado = false;
  const salida: Obj[] = [];
  for (const s of lista) {
    const repBalanzas = VP.repetibilidadBalanzas(validaciones.concat(
      s.datos?.validacion ? [VP.calcularValidacion(s.datos.validacion, {})] : []));
    const r = VP.calcularSesion(s, { prep, tubosPrep, anteriores: { ...anteriores }, repBalanzas, cursoValidado });
    r.calculado_en = new Date().toISOString();
    await db.from("verif_sesiones").update({ resultados: r, actualizado: new Date().toISOString() }).eq("id", s.id);
    salida.push({ ...s, resultados: r });
    // Lo que esta sesión deja para las siguientes
    for (const [idTubo, t] of Object.entries((s.datos?.tubos || {}) as Obj)) {
      const cierre = VP.leerNumero(t?.m_cierre).valor ?? VP.leerNumero(t?.m_ahora).valor;
      if (cierre !== undefined && cierre !== null) anteriores[idTubo] = cierre;
    }
    if (r.validacion) validaciones.push(r.validacion);
    if (r.validacion?.ok) cursoValidado = true;
  }
  return salida;
}

/** Fila del CSV de una pipeta tal como se guarda en la verificación (los límites con que se juzgó). */
export function parametrosParaGuardar(par: Obj): Obj {
  const campos = ["id_activo", "marca_modelo", "multicanal", "rango", "confirmar", "ajuste_usuario",
    "v_nominal", "metodo_nominal", "patron_nominal", "masa_nominal_g", "es_nominal_pct", "cv_nominal_pct",
    "v_bajo", "metodo_bajo", "patron_bajo", "masa_bajo_g", "es_bajo_pct", "cv_bajo_pct",
    "fuente_limites", "notas", "version_csv", "ajuste_respuesta"];
  const o: Obj = {};
  for (const c of campos) o[c] = par[c] ?? null;
  return o;
}

const txt = (v: unknown, max = 500) => (v === null || v === undefined ? "" : String(v)).slice(0, max);

/** Deja la verificación que manda el navegador solo con lo que se espera (y con límites de tamaño). */
export function limpiarVerificacion(v: unknown): Obj | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Obj;
  const fases = (Array.isArray(o.fases) ? o.fases : []).slice(0, 2).map((f: Obj, i: number) => {
    const volumenes: Obj = {};
    for (const clave of ["nominal", "bajo"]) {
      const dv = f?.volumenes?.[clave];
      if (!dv || typeof dv !== "object") continue;
      volumenes[clave] = {
        id_sesion: dv.id_sesion ? txt(dv.id_sesion, 40) : null,
        lote_sc: String(dv.lote_sc) === "2" ? "2" : "1",
        canales: (Array.isArray(dv.canales) ? dv.canales : []).slice(0, 8).map((c: Obj) => ({
          replicas: (Array.isArray(c?.replicas) ? c.replicas : []).slice(0, VP.CRITERIOS.max_replicas + 2)
            .map((r: Obj) => ({ m: txt(r?.m, 20), A: txt(r?.A, 20) })),
        })),
      };
    }
    return { tipo: i === 0 ? "inicial" : "tras_ajuste", volumenes,
      ajustada_por: f?.ajustada_por ? txt(f.ajustada_por, 120) : null, ajustada_en: f?.ajustada_en ? txt(f.ajustada_en, 40) : null };
  });
  const vbe = VP.leerNumero(o.v_bajo_elegido).valor;
  return {
    fases: fases.length ? fases : [{ tipo: "inicial", volumenes: {} }],
    v_bajo_elegido: vbe === 100 || vbe === 200 ? vbe : null,
    puntas: txt(o.puntas, 300), observaciones: txt(o.observaciones, 2000),
  };
}

/** Lo que se guarda del cálculo (sin repetir las réplicas). */
export function calculoParaGuardar(calc: Obj): Obj {
  return {
    resultado: calc.resultado, texto: (VP.RESULTADO as Obj)[calc.resultado] || calc.resultado,
    calidad: calc.calidad || null, final: !!calc.final, avisos: calc.avisos || [],
    limites: calc.limites || [], fuente_limites: calc.fuente_limites || "",
    fases: (calc.fases || []).map((f: Obj) => ({
      tipo: f.tipo, resultado: f.resultado,
      volumenes: Object.fromEntries(Object.entries(f.volumenes || {}).map(([k, v]: [string, Obj]) => [k, {
        id_sesion: v.id_sesion, disolucion: v.disolucion,
        canales: (v.canales || []).map((c: Obj) => ({
          n: c.n, V: c.V, Vmedio: c.Vmedio ?? null, s: c.s ?? null, es: c.es ?? null, cvObs: c.cvObs ?? null,
          cvMet: c.cvMet ?? null, cvCorr: c.cvCorr ?? null, decision: c.decision, motivo: c.motivo || null,
          avisos: c.avisos || [], errores: c.errores || [],
        })),
      }])),
    })),
  };
}

/**
 * Calcula la verificación de un registro con lo que hay en la base de datos: los datos de la
 * pipeta (CSV), la preparación del curso y los resultados de las sesiones que cita.
 */
export async function calcularVerificacionRegistro(db: Db, idEquipo: string, curso: string | null, ver: Obj, sinCribado: boolean) {
  const { data: par } = await db.from("verif_pipetas_parametros").select("*").eq("id_activo", idEquipo).maybeSingle();
  if (!par) return null;
  const ids = [...new Set((ver.fases || []).flatMap((f: Obj) => Object.values(f.volumenes || {}).map((v: Obj) => v.id_sesion)).filter(Boolean))];
  const { data: ses } = ids.length ? await db.from("verif_sesiones").select("id, curso_academico, fecha, resultados").in("id", ids) : { data: [] };
  const sesiones: Obj = {};
  for (const s of ses || []) sesiones[s.id] = s.resultados || {};
  const cursoPrep = curso || (ses || [])[0]?.curso_academico || null;
  const { data: prepRow } = cursoPrep ? await db.from("verif_preparaciones").select("datos").eq("curso_academico", cursoPrep).maybeSingle() : { data: null };
  const calc = VP.calcularVerificacion({ ...ver, sin_cribado: sinCribado }, {
    par, sesiones, prep: VP.calcularPreparacion(prepRow?.datos || {}), ajuste_respuesta: par.ajuste_respuesta,
  });
  return { par, calc };
}

/** Texto de la incidencia de una pipeta retirada: el volumen o canal que ha fallado y sus valores. */
export function textoIncidenciaRetirada(idEquipo: string, calc: Obj): string {
  const ultima = calc.fases?.[calc.fases.length - 1] || {};
  const partes: string[] = [];
  for (const [clave, v] of Object.entries(ultima.volumenes || {}) as [string, Obj][]) {
    const lim = (calc.limites || []).find((l: Obj) => l.clave === clave) || {};
    (v.canales || []).forEach((c: Obj, i: number) => {
      if (c.decision !== "RETIRAR" && c.decision !== "AJUSTAR") return;
      partes.push(`${lim.v} µl${v.canales.length > 1 ? `, canal ${i + 1}` : ""}: ${(VP.DECISION as Obj)[c.decision]} — ` +
        `error sistemático ${VP.fmt(c.es, 2, true)} % (límite ±${VP.fmt(lim.LE, 1)} %), CV corregido ${VP.fmt(c.cvCorr, 2)} % ` +
        `(límite ${VP.fmt(lim.LC, 1)} %), ${c.n} réplicas`);
    });
  }
  return `Verificación anual de ${idEquipo}: ${(VP.RESULTADO as Obj)[calc.resultado] || calc.resultado}. ` +
    (partes.length ? partes.join(" · ") : "") + ". No usar hasta que se resuelva.";
}
