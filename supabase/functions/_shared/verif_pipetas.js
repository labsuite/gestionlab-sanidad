// ═══════════════════════════════════════════════════════════════════════════════
// Verificación anual de las micropipetas: comprobación de datos, cálculo y decisión.
// Encargo del laboratorio del 24/11/2026 (ENCARGO_calculos_verificacion_micropipetas.md,
// carpeta Protocolos/GestionLab). Reproduce Verificacion_fotometrica_micropipetas.xlsx.
//
// UNA SOLA FUENTE del cálculo: la usan la pantalla (js/verif-pipetas.js la carga como
// módulo desde esta misma ruta, que GitHub Pages sirve) y el servidor (Edge Functions
// gestionar-mantenimiento y gestionar-verif-pipetas). Así la decisión no puede salir
// distinta en un sitio y en otro. La página HTML de recogida sin conexión solo lleva el
// bloque «COMPROBAR DATOS» (entre las marcas de abajo): recoge, no calcula ni decide.
//
// Los criterios están en CRITERIOS: si el laboratorio cambia uno (p. ej. la tolerancia
// provisional del 0,5 % de las diluciones de comprobación), se cambia ahí y en la hoja.
// ═══════════════════════════════════════════════════════════════════════════════

/* >>> COMPROBAR DATOS (también va en la página HTML de recogida) */

/** Versión del formato de los archivos que genera la página HTML. */
export const FORMATO_ARCHIVO = 1;

export const CRITERIOS = {
  perdida_tubo_pct: 0.1,      // 5.2: pérdida de agua de un tubo de disolución
  blanco: 0.003,              // 5.3 y 5.7: lectura del blanco
  r2_min: 0.999,              // 5.4
  a_max: 0.01,                // 5.4: |ordenada|
  residuo_max: 0.01,          // 5.4
  comprobacion_pct: 0.5,      // 5.5: tolerancia PROVISIONAL de las diluciones de comprobación
  cv_lectura_max: 0.3,        // 5.6
  comparacion_grav_pct: 1,    // 5.8: fotometría frente a gravimetría a 200 µl
  llenado_max: 0.003,         // 5.8: efecto del volumen de llenado de la cubeta
  rep_balanza_max: 0.001,     // 5.8: repetibilidad de las balanzas de los tubos (g)
  abs_min_tramo: 0.10,        // 7: tramo de la recta
  abs_max_tramo: 1.20,
  max_replicas: 10,
  min_replicas: 4,
};

/** Z (µl/mg) a 1 013 hPa según la temperatura del agua en grados enteros (ISO 8655-6). */
export const Z_TABLA = {
  15: 1.0020, 16: 1.0021, 17: 1.0023, 18: 1.0025, 19: 1.0027, 20: 1.0029, 21: 1.0031, 22: 1.0033,
  23: 1.0035, 24: 1.0038, 25: 1.0040, 26: 1.0043, 27: 1.0045, 28: 1.0048, 29: 1.0051, 30: 1.0054,
};

/** Masa de agua de los tubos fotométricos según la tabla del anexo A (g). */
export const MASAS_TABLA = [0.7, 1.0, 1.3];

/**
 * Lee un número escrito con coma o punto decimal. Rechaza texto y separadores de miles
 * («1.000,5», «1 000»). Devuelve { valor } o { error }; vacío → { vacio: true }.
 */
export function leerNumero(texto) {
  if (texto === null || texto === undefined) return { vacio: true };
  if (typeof texto === 'number') return Number.isFinite(texto) ? { valor: texto } : { error: 'No es un número' };
  const s = String(texto).trim();
  if (!s) return { vacio: true };
  if (/\s/.test(s)) return { error: 'Sin espacios ni separador de miles' };
  if (/[.,].*[.,]/.test(s)) return { error: 'Un solo separador decimal (coma o punto), sin separador de miles' };
  if (!/^[-+]?(\d+([.,]\d*)?|[.,]\d+)$/.test(s)) return { error: 'No es un número' };
  return { valor: Number(s.replace(',', '.')) };
}

/** Decimales escritos (para avisar si una masa no lleva los tres de la balanza). */
function decimalesDe(texto) {
  const m = String(texto ?? '').trim().match(/[.,](\d*)$/);
  return m ? m[1].length : 0;
}

/**
 * Comprueba un dato según su tipo (apartado 7 del encargo). Devuelve
 * { valor?, error?, aviso? }: con error no se guarda; con aviso sí.
 *   tipo: 'masa' | 'masa_tubo' (fotométrico; ctx.masa_tabla) | 'masa_entregada'
 *         (gravimétrico; ctx.v_ajustado, ctx.z) | 'absorbancia' | 'temperatura' | 'blanco'
 *         | 'numero'
 */
export function comprobarDato(tipo, texto, ctx = {}) {
  const r = leerNumero(texto);
  if (r.vacio) return ctx.opcional ? { vacio: true } : { vacio: true, error: 'Falta el dato' };
  if (r.error) return r;
  const v = r.valor;
  const out = { valor: v };
  if (tipo === 'masa' || tipo === 'masa_tubo' || tipo === 'masa_entregada') {
    if (v <= 0) return { valor: v, error: 'La masa tiene que ser mayor que 0' };
    if (decimalesDe(texto) !== 3 && typeof texto !== 'number') out.aviso = 'Las masas se anotan con tres decimales (g)';
  }
  if (tipo === 'masa_tubo' && ctx.masa_tabla) {
    const d = Math.abs(v - ctx.masa_tabla);
    if (d > 0.2) return { valor: v, error: `A más de 0,2 g de ${fmtG(ctx.masa_tabla)} g: ¿error de tecleo?` };
    if (d > 0.05) out.aviso = `A más de 0,05 g de ${fmtG(ctx.masa_tabla)} g (masa de la tabla)`;
  }
  if (tipo === 'masa_entregada' && ctx.v_ajustado && ctx.z) {
    const esperada = ctx.v_ajustado / 1000 / ctx.z;
    const d = Math.abs(v - esperada) / esperada;
    if (d > 0.30) return { valor: v, error: `Muy lejos de lo esperado (${fmtG(esperada)} g): ¿error de tecleo?` };
    if (d > 0.05) out.aviso = 'A más de un 5 % de lo esperado: comprueba el dato y el volumen ajustado';
  }
  if (tipo === 'absorbancia') {
    if (v < 0 || v > 2) return { valor: v, error: 'La absorbancia va de 0 a 2' };
    if (v < CRITERIOS.abs_min_tramo || v > CRITERIOS.abs_max_tramo) {
      out.aviso = 'Fuera del tramo de la recta (0,10–1,20): cambia de disolución o de masa de agua y repite la serie';
      out.fuera_tramo = true;
    }
  }
  if (tipo === 'blanco') {
    if (v < -2 || v > 2) return { valor: v, error: 'Lectura fuera de escala' };
    if (Math.abs(v) > CRITERIOS.blanco + 1e-12) out.aviso = 'El blanco tiene que dar 0,000 ± 0,003';
  }
  if (tipo === 'temperatura') {
    if (!Number.isInteger(v)) return { valor: v, error: 'En grados enteros' };
    if (v < 15 || v > 30) return { valor: v, error: 'Entre 15 y 30 °C' };
  }
  return out;
}

function fmtG(x) { return Number(x).toFixed(3).replace('.', ','); }

/* <<< COMPROBAR DATOS */

// ═══════════════════════════════════════════════════════════════════════════════
// CÁLCULO (solo en la app)
// ═══════════════════════════════════════════════════════════════════════════════

const num = x => { const r = leerNumero(x); return r.valor === undefined ? null : r.valor; };
const media = xs => xs.reduce((s, x) => s + x, 0) / xs.length;
function desvTipica(xs) {                       // muestral (n − 1), como STDEV de la hoja
  if (xs.length < 2) return null;
  const m = media(xs);
  return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length - 1));
}

export function zDe(temperatura) {
  const t = num(temperatura);
  return Number.isInteger(t) && Z_TABLA[t] ? Z_TABLA[t] : null;
}

// ── Preparación del curso (4.1) ─────────────────────────────────────────────
/**
 * datos: { SA:{m_tartrazina,m_agua}, SB:{m_sa,m_agua}, SC:{m_sa,m_agua}, SC2:{m_sa,m_agua,fecha},
 *          D1:{m_sa,m_agua}, D2:{m_d1,m_agua}, P:[{parte:'D1'|'D2', m_partida, m_agua}×5] }
 */
export function calcularPreparacion(d = {}) {
  const r = { P: [] };
  const sa = d.SA || {}, sb = d.SB || {}, sc = d.SC || {}, sc2 = d.SC2 || {}, d1 = d.D1 || {}, d2 = d.D2 || {};
  const [mt, mw] = [num(sa.m_tartrazina), num(sa.m_agua)];
  r.conc_SA = mt && mw ? mt / (mt + mw) * 1000 : null;           // g/l, solo informativo
  const fac = (a, b) => (num(a) && num(b) ? (num(a) + num(b)) / num(a) : null);
  r.F_B = fac(sb.m_sa, sb.m_agua);
  r.F_C = fac(sc.m_sa, sc.m_agua);
  r.F_C2 = fac(sc2.m_sa, sc2.m_agua);
  r.f_D1 = num(d1.m_sa) && num(d1.m_agua) ? num(d1.m_sa) / (num(d1.m_sa) + num(d1.m_agua)) : null;
  r.f_D2 = r.f_D1 && num(d2.m_d1) && num(d2.m_agua) ? r.f_D1 * num(d2.m_d1) / (num(d2.m_d1) + num(d2.m_agua)) : null;
  for (let i = 0; i < 5; i++) {
    const p = (d.P || [])[i] || {};
    const fPart = p.parte === 'D1' ? r.f_D1 : p.parte === 'D2' ? r.f_D2 : null;
    const [mp, ma] = [num(p.m_partida), num(p.m_agua)];
    r.P.push(fPart && mp && ma ? fPart * mp / (mp + ma) : null);
  }
  return r;
}

/** Factor de dilución de la disolución que se pipetea (6.2). */
export function factorDisolucion(prep, disolucion, loteSC = '1') {
  if (disolucion === 'S-A') return 1;
  if (disolucion === 'S-B') return prep?.F_B ?? null;
  if (disolucion === 'S-C') return (String(loteSC) === '2' ? prep?.F_C2 : prep?.F_C) ?? null;
  return null;
}

// ── Sesión (5.2–5.9) ────────────────────────────────────────────────────────
/** Pérdida de agua de un tubo de disolución cerrado (5.2), en % del contenido. */
export function perdidaTubo(mVacio, mAnterior, mAhora) {
  const [v, a, h] = [num(mVacio), num(mAnterior), num(mAhora)];
  if (v === null || a === null || h === null || a - v <= 0) return null;
  const pct = (a - h) / (a - v) * 100;
  return { pct, ok: pct <= CRITERIOS.perdida_tubo_pct + 1e-12 };
}

/**
 * Recta A = a + k·f por mínimos cuadrados con el blanco (0, 0) y P1–P5, sin forzar el origen
 * (SLOPE / INTERCEPT / RSQ de la hoja). fs y As: los cinco puntos P1–P5.
 */
export function calcularRecta(fs, As) {
  const xs = [0], ys = [0];
  for (let i = 0; i < 5; i++) {
    const f = num(fs?.[i]), A = num(As?.[i]);
    if (f === null || A === null) return null;
    xs.push(f); ys.push(A);
  }
  const mx = media(xs), my = media(ys);
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < xs.length; i++) {
    sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) ** 2; syy += (ys[i] - my) ** 2;
  }
  const k = sxy / sxx, a = my - k * mx;
  const r2 = sxy * sxy / (sxx * syy);
  const residuoMax = Math.max(...xs.map((x, i) => Math.abs(ys[i] - (a + k * x))));
  const fallos = [];
  if (!(r2 >= CRITERIOS.r2_min)) fallos.push(`r² = ${r2.toFixed(6)} (< ${CRITERIOS.r2_min})`);
  if (!(Math.abs(a) <= CRITERIOS.a_max)) fallos.push(`|a| = ${Math.abs(a).toFixed(4)} (> ${CRITERIOS.a_max})`);
  if (!(residuoMax <= CRITERIOS.residuo_max)) fallos.push(`residuo máximo ${residuoMax.toFixed(4)} (> ${CRITERIOS.residuo_max})`);
  return { k, a, r2, residuoMax, valida: !fallos.length, fallos };
}

/**
 * Dilución de comprobación (5.5). tipo 'S-A': datos {m1,m2,m3,m4}; 'S-B' / 'S-C' / 'S-C2':
 * {m, m_agua}. Devuelve f esperada, f leída, diferencia (%) y si cumple.
 */
export function calcularComprobacion(tipo, datos, prep, recta) {
  const d = datos || {};
  let fEsp = null;
  if (tipo === 'S-A') {
    const [m1, m2, m3, m4] = [num(d.m1), num(d.m2), num(d.m3), num(d.m4)];
    if (m1 && m2 && m3 && m4) fEsp = m1 / (m1 + m2) * m3 / (m3 + m4);
  } else {
    const F = tipo === 'S-B' ? prep?.F_B : tipo === 'S-C' ? prep?.F_C : tipo === 'S-C2' ? prep?.F_C2 : null;
    const [m, mw] = [num(d.m), num(d.m_agua)];
    if (m && mw && F) fEsp = m / (m + mw) / F;
  }
  const A = num(d.A);
  if (fEsp === null || A === null || !recta) return { fEsperada: fEsp, completa: false };
  const fLeida = (A - recta.a) / recta.k;
  const dif = (fLeida / fEsp - 1) * 100;
  return { fEsperada: fEsp, fLeida, dif, ok: Math.abs(dif) <= CRITERIOS.comprobacion_pct + 1e-12, completa: true };
}

/** CV de lectura de la sesión (5.6): diez lecturas. */
export function calcularCvLectura(lecturas) {
  const xs = (lecturas || []).map(num).filter(x => x !== null);
  if (xs.length < 2) return null;
  const m = media(xs), s = desvTipica(xs);
  const cv = s / m * 100;
  return { n: xs.length, media: m, s, cv, ok: xs.length >= 10 && cv <= CRITERIOS.cv_lectura_max + 1e-12 };
}

/**
 * Volumen medio de una serie (para la comparación con la gravimetría de la validación, 5.8).
 * replicas: [{m}] (gravimétrico) o [{m, A}] (fotométrico).
 */
function volumenesSerie(metodo, replicas, { z, recta, F }) {
  return replicas.map(r => {
    const m = num(r.m);
    if (m === null) return null;
    if (metodo === 'gravimétrico') return m * 1000 * z;
    const A = num(r.A);
    if (A === null || !recta || !F) return null;
    const vd = m * 1000 * z, f = (A - recta.a) / recta.k * F;
    return vd * f / (1 - f);
  }).filter(v => v !== null);
}

/**
 * Validación del método (5.8, una vez por curso). datos: { grav200:[{m}×10], fot200:[{m,A}×10],
 * lote_sc, llenado:[A07, A10, A12], balanzas:{ 'BAL-001': [10 pesadas] … } }.
 */
export function calcularValidacion(datos, { recta, cvLectura, prep, z }) {
  const d = datos || {};
  const pruebas = [];
  pruebas.push({ clave: 'linealidad', titulo: 'Linealidad (la recta del día)', criterio: 'r² ≥ 0,999 y |a| ≤ 0,01',
    valor: recta ? `r² ${recta.r2.toFixed(6)} · a ${recta.a.toFixed(4)}` : null,
    ok: recta ? recta.r2 >= CRITERIOS.r2_min && Math.abs(recta.a) <= CRITERIOS.a_max : null });
  pruebas.push({ clave: 'repetibilidad_fot', titulo: 'Repetibilidad del espectrofotómetro (CV de lectura)', criterio: 'CV ≤ 0,3 %',
    valor: cvLectura ? `${cvLectura.cv.toFixed(3)} %` : null, ok: cvLectura ? cvLectura.ok : null });
  const F = factorDisolucion(prep, 'S-C', d.lote_sc || '1');
  const vg = volumenesSerie('gravimétrico', d.grav200 || [], { z });
  const vf = volumenesSerie('fotométrico', d.fot200 || [], { z, recta, F });
  let comp = null;
  if (vg.length >= 10 && vf.length >= 10) {
    const dif = (media(vf) / media(vg) - 1) * 100;
    comp = { vGrav: media(vg), vFot: media(vf), dif, ok: Math.abs(dif) <= CRITERIOS.comparacion_grav_pct + 1e-12 };
  }
  pruebas.push({ clave: 'comparacion', titulo: 'Comparación con la gravimetría a 200 µl (10 + 10 réplicas)', criterio: 'Diferencia ≤ 1 %',
    valor: comp ? `${comp.vFot.toFixed(3)} frente a ${comp.vGrav.toFixed(3)} µl: ${fmtSigno(comp.dif, 2)} %` : null,
    ok: comp ? comp.ok : null, detalle: comp });
  const ll = (d.llenado || []).map(num).filter(x => x !== null);
  const llDif = ll.length === 3 ? Math.max(...ll) - Math.min(...ll) : null;
  pruebas.push({ clave: 'llenado', titulo: 'Efecto del llenado de la cubeta (P3 con 0,7, 1,0 y 1,2 ml)', criterio: 'Lecturas iguales ± 0,003',
    valor: llDif === null ? null : `diferencia ${llDif.toFixed(3)}`, ok: llDif === null ? null : llDif <= CRITERIOS.llenado_max + 1e-12 });
  const bals = Object.entries(d.balanzas || {}).map(([id, pesadas]) => {
    const xs = (pesadas || []).map(num).filter(x => x !== null);
    const s = xs.length >= 10 ? desvTipica(xs) : null;
    return { id, n: xs.length, s, ok: s === null ? null : s <= CRITERIOS.rep_balanza_max + 1e-12 };
  });
  const balsMedidas = bals.filter(b => b.s !== null);
  // Si solo se usa la BTC-223, vale su especificación (0,001 g), como en la hoja de cálculo.
  const valorBal = balsMedidas.length ? balsMedidas.map(b => `${b.id}: ${b.s.toFixed(4)} g`).join(' · ')
    : 'BAL-003 (BTC-223): 0,001 g (especificación)';
  pruebas.push({ clave: 'balanzas', titulo: 'Repetibilidad de las balanzas de los tubos (10 pesadas)', criterio: 'Desviación típica ≤ 0,001 g',
    valor: valorBal, ok: balsMedidas.length ? balsMedidas.every(b => b.ok) : true, balanzas: bals });
  const completa = pruebas.every(p => p.ok !== null);
  return { pruebas, completa, ok: completa && pruebas.every(p => p.ok) };
}

function fmtSigno(x, dec) { return (x >= 0 ? '+' : '−') + Math.abs(x).toFixed(dec); }

/** Balanzas de 1 mg para los tubos y su repetibilidad (5.1). La BTC-223 vale por especificación. */
export const BALANZAS_TUBOS = {
  'BAL-003': { nombre: 'BTC-223', s_especificacion: 0.001 },
  'BAL-001': { nombre: 'Gram ST-110', s_especificacion: null },
  'BAL-005': { nombre: 'BEL MARK', s_especificacion: null },
};

/**
 * Repetibilidad de cada balanza este curso: la de la especificación (BTC-223) o la medida en
 * la validación (10 pesadas). Sin dato, esa balanza no se puede elegir.
 */
export function repetibilidadBalanzas(validacionesDelCurso) {
  const r = {};
  for (const [id, b] of Object.entries(BALANZAS_TUBOS)) if (b.s_especificacion) r[id] = { s: b.s_especificacion, origen: 'especificación' };
  for (const v of validacionesDelCurso || []) {
    for (const b of v?.pruebas?.find(p => p.clave === 'balanzas')?.balanzas || []) {
      // La BTC-223 se queda con su especificación; las otras, con lo medido si cumple.
      if (b.s !== null && b.ok && !BALANZAS_TUBOS[b.id]?.s_especificacion) r[b.id] = { s: b.s, origen: 'medida' };
    }
  }
  return r;
}

/**
 * Estado completo de una sesión. sesion.datos: { temperatura, balanzas:[ids], tubos:{ idTubo:
 * {m_ahora, m_cierre} }, blanco_inicio, abs_P:[5], comprobaciones:{ 'S-A':{...}, ... },
 * lecturas_cv:[10], blanco_final, validacion:{...} }.
 * ctx: { prep (resultado de calcularPreparacion), tubosPrep:[{id,disolucion,m_vacio,m_lleno}],
 *        anteriores:{ idTubo: masa anterior }, repBalanzas, cursoValidado (otra sesión del curso) }
 */
export function calcularSesion(sesion, ctx = {}) {
  const d = sesion?.datos || {};
  const r = { motivos_fot: [], motivos_grav: [] };
  r.z = zDe(d.temperatura);
  if (!r.z) r.motivos_grav.push('Falta la temperatura del agua (15–30 °C)');
  const bals = (d.balanzas || []).filter(Boolean);
  const reps = bals.map(id => ctx.repBalanzas?.[id]?.s ?? null);
  r.s_balanza = bals.length && reps.every(x => x !== null) ? Math.max(...reps) : null;
  if (!bals.length) r.motivos_grav.push('Falta la balanza');
  else if (r.s_balanza === null) r.motivos_grav.push('Alguna balanza no tiene la repetibilidad medida este curso');
  // Tubos de disoluciones (5.2)
  r.tubos = {};
  const disolucionesNoValidas = new Set();
  for (const t of ctx.tubosPrep || []) {
    const dt = d.tubos?.[t.id];
    if (!dt || num(dt.m_ahora) === null) continue;
    const anterior = ctx.anteriores?.[t.id] ?? t.m_lleno;
    const p = perdidaTubo(t.m_vacio, anterior, dt.m_ahora);
    r.tubos[t.id] = { disolucion: t.disolucion, anterior, ...(p || {}) };
    if (p && !p.ok) disolucionesNoValidas.add(t.disolucion);
  }
  // Blanco, recta, comprobaciones, CV
  const bi = num(d.blanco_inicio);
  r.blanco_inicio_ok = bi === null ? null : Math.abs(bi) <= CRITERIOS.blanco + 1e-12;
  r.recta = calcularRecta(ctx.prep?.P, d.abs_P);
  r.comprobaciones = {};
  for (const tipo of ['S-A', 'S-B', 'S-C', 'S-C2']) {
    if (d.comprobaciones?.[tipo]) r.comprobaciones[tipo] = calcularComprobacion(tipo, d.comprobaciones[tipo], ctx.prep, r.recta);
  }
  const hechas = Object.values(r.comprobaciones).filter(c => c.completa);
  r.todas_mismo_sentido = hechas.length >= 2 && hechas.every(c => !c.ok) && (hechas.every(c => c.dif > 0) || hechas.every(c => c.dif < 0));
  r.cv_lectura = calcularCvLectura(d.lecturas_cv);
  const bf = num(d.blanco_final);
  r.blanco_final_ok = bf === null ? null : Math.abs(bf) <= CRITERIOS.blanco + 1e-12;
  if (d.validacion) r.validacion = calcularValidacion(d.validacion, { recta: r.recta, cvLectura: r.cv_lectura, prep: ctx.prep, z: r.z });
  // Validez de la parte fotométrica (5.9)
  const f = r.motivos_fot;
  if (!(ctx.cursoValidado || r.validacion?.ok)) f.push('El método no está validado este curso (5.8)');
  if (r.blanco_inicio_ok !== true) f.push(r.blanco_inicio_ok === null ? 'Falta el blanco' : 'El blanco no da 0,000 ± 0,003: las cubetas no están emparejadas');
  if (!r.recta) f.push('Faltan las absorbancias de P1–P5 o la preparación del curso');
  else if (!r.recta.valida) f.push('La recta no cumple: ' + r.recta.fallos.join('; '));
  for (const t of Object.values(r.tubos)) if (t.ok === false && /^P\d$/.test(t.disolucion)) f.push(`El tubo de ${t.disolucion} ha perdido agua: la recta no vale`);
  if (!r.cv_lectura) f.push('Faltan las diez lecturas del CV de lectura');
  else if (!r.cv_lectura.ok) f.push(r.cv_lectura.n < 10 ? 'Faltan lecturas para el CV de lectura (10)' : `CV de lectura ${r.cv_lectura.cv.toFixed(3)} % (> 0,3 %)`);
  if (r.blanco_final_ok === false) f.push('El blanco del final no da 0,000 ± 0,003: las verificaciones fotométricas de la sesión quedan «a repetir»');
  if (r.blanco_final_ok === null) f.push('Falta el blanco del final de la sesión');
  if (r.z === null) f.push('Falta la temperatura del agua');
  if (r.s_balanza === null) f.push('Falta la balanza de los tubos (o su repetibilidad)');
  // Disoluciones que se pueden pipetear en esta sesión (tubo bien conservado y comprobación OK)
  r.disoluciones = {};
  for (const tipo of ['S-A', 'S-B', 'S-C', 'S-C2']) {
    const c = r.comprobaciones[tipo];
    const motivo = disolucionesNoValidas.has(tipo === 'S-C2' ? 'S-C2' : tipo) ? 'el tubo ha perdido agua (DESECHAR)'
      : !c || !c.completa ? 'falta su dilución de comprobación'
      : !c.ok ? `la dilución de comprobación se desvía ${fmtSigno(c.dif, 2)} % (> ${CRITERIOS.comprobacion_pct} %)` : null;
    r.disoluciones[tipo] = { ok: !motivo, motivo };
  }
  r.valida_grav = !r.motivos_grav.length;
  r.valida_fot = r.valida_grav && !f.length;
  return r;
}

// ── Verificación de un volumen (6.2–6.4) ───────────────────────────────────
export const DECISION = {
  SIN_DATOS: 'Sin datos', FALTAN: 'Faltan réplicas (mínimo 4)',
  FALTAN_10: 'Faltan réplicas: sin cribado hacen falta 10',
  COMPLETAR: 'COMPLETAR hasta 10 réplicas (punta nueva)', OK: 'OK',
  FUERA: 'FUERA, orientativo (< 5 µl): no se retira',
  AJUSTAR: 'AJUSTAR (error sistemático fuera)', RETIRAR: 'RETIRAR (CV fuera)',
  SESION: 'La sesión no vale para este volumen', DATOS: 'Hay datos que no cumplen',
  TRAMO: 'Absorbancia fuera del tramo de la recta: repetir la serie',
};

/**
 * Regla de decisión de la hoja (6.3). n réplicas, es y cvCorr en %, LE y LC en %.
 * sinCribado: tras reparación, cambio de junta o ajuste (10 réplicas, sin el margen de 2/3).
 */
export function decidir(n, es, cvCorr, LE, LC, vAjustado, sinCribado = false) {
  if (!n) return 'SIN_DATOS';
  if (n < CRITERIOS.min_replicas) return 'FALTAN';
  if (n < CRITERIOS.max_replicas) {
    if (sinCribado) return 'FALTAN_10';
    return Math.abs(es) <= 2 / 3 * LE && cvCorr <= 2 / 3 * LC ? 'OK' : 'COMPLETAR';
  }
  if (Math.abs(es) <= LE && cvCorr <= LC) return 'OK';
  const pequeno = vAjustado < 5;
  if (pequeno && Math.abs(es) <= 2 * LE && cvCorr <= 2 * LC) return 'FUERA';
  return cvCorr <= LC * (pequeno ? 2 : 1) ? 'AJUSTAR' : 'RETIRAR';
}

/**
 * Cálculo de un volumen. p: { metodo, v_ajustado, LE, LC, masa_tabla, disolucion, replicas:[{m, A}],
 * z, recta, F, cv_lectura (%), s_balanza (g), sin_cribado, sesion_valida, motivo_sesion }.
 */
export function calcularVolumen(p) {
  const r = { n: 0, V: [], avisos: [], errores: [] };
  const fot = p.metodo === 'fotométrico';
  let fueraTramo = false;
  const filas = (p.replicas || []).filter(x => x && (String(x.m ?? '').trim() !== '' || String(x.A ?? '').trim() !== ''));
  if (filas.length > CRITERIOS.max_replicas) r.errores.push(`Más de ${CRITERIOS.max_replicas} réplicas`);
  const masas = [];
  filas.forEach((x, i) => {
    const cm = fot ? comprobarDato('masa_tubo', x.m, { masa_tabla: p.masa_tabla })
                   : comprobarDato('masa_entregada', x.m, { v_ajustado: p.v_ajustado, z: p.z });
    if (cm.error) { r.errores.push(`Réplica ${i + 1}: ${cm.error}`); return; }
    if (cm.aviso) r.avisos.push(`Réplica ${i + 1}: ${cm.aviso}`);
    if (!fot) { masas.push(cm.valor); return; }
    const ca = comprobarDato('absorbancia', x.A);
    if (ca.error) { r.errores.push(`Réplica ${i + 1}: absorbancia: ${ca.error}`); return; }
    if (ca.fuera_tramo) fueraTramo = true;
    masas.push(cm.valor);
    r._A = (r._A || []).concat(ca.valor);
  });
  r.n = r.errores.length ? 0 : masas.length;
  if (r.errores.length) { r.decision = 'DATOS'; return r; }
  if (!r.n) { r.decision = 'SIN_DATOS'; return r; }
  if (!p.z) { r.decision = 'SESION'; r.motivo = 'Falta la temperatura del agua de la sesión'; return r; }
  if (fot && (!p.recta || !p.F)) { r.decision = 'SESION'; r.motivo = 'Falta la recta de la sesión o el factor de la disolución'; return r; }
  r.V = masas.map((m, i) => {
    if (!fot) return m * 1000 * p.z;
    const vd = m * 1000 * p.z, f = (r._A[i] - p.recta.a) / p.recta.k * p.F;
    return vd * f / (1 - f);
  });
  delete r._A;
  if (r.n >= 2) {
    r.Vmedio = media(r.V);
    r.s = desvTipica(r.V);
    r.es = (r.Vmedio - p.v_ajustado) / p.v_ajustado * 100;
    r.cvObs = r.s / r.Vmedio * 100;
    const mMedia = media(masas);
    const sBal = p.s_balanza;
    if (sBal !== null && sBal !== undefined) {
      const termBal = Math.SQRT2 * sBal / mMedia * 100;
      r.cvMet = fot ? (p.cv_lectura !== null && p.cv_lectura !== undefined ? Math.sqrt(p.cv_lectura ** 2 + termBal ** 2) : null) : termBal;
    } else r.cvMet = null;
    r.cvCorr = r.cvMet === null ? null : Math.sqrt(Math.max(r.cvObs ** 2 - r.cvMet ** 2, 0));
  }
  if (r.cvMet !== undefined && r.cvMet !== null && r.cvMet > 2 / 3 * p.LC) r.avisos.push('CV orientativo: el del método pasa de 2/3 del límite');
  if (p.v_ajustado < 5) r.avisos.push('Resultado orientativo (< 5 µl)');
  if (r.n < 2 || r.cvCorr === null || r.cvCorr === undefined) {
    r.decision = r.n < CRITERIOS.min_replicas ? 'FALTAN' : 'SESION';
    if (r.decision === 'SESION') r.motivo = fot ? 'Falta el CV de lectura o la balanza de la sesión' : 'Falta la balanza de la sesión';
    return r;
  }
  r.decision_calculada = decidir(r.n, r.es, r.cvCorr, p.LE, p.LC, p.v_ajustado, p.sin_cribado);
  r.decision = r.decision_calculada;
  if (fueraTramo && r.n >= CRITERIOS.min_replicas) { r.decision = 'TRAMO'; }
  // En una sesión no válida no se da OK a una verificación fotométrica (5.9)
  if (p.sesion_valida === false && ['OK', 'FUERA', 'COMPLETAR', 'AJUSTAR', 'RETIRAR', 'FALTAN_10'].includes(r.decision)) {
    r.decision = 'SESION';
    r.motivo = p.motivo_sesion || 'La sesión no es válida';
  }
  return r;
}

// ── Pipeta entera (6.5–6.7) ─────────────────────────────────────────────────
export const RESULTADO = {
  OK: 'OK', OK_FUERA: 'OK (con un volumen < 5 µl fuera de límites, orientativo)',
  AJUSTAR: 'AJUSTAR (6.3); después, 10 réplicas a los dos volúmenes',
  RETIRAR: 'RETIRAR: etiqueta «NO USAR» e incidencia en GestionLab',
  RETIRAR_SAT: 'RETIRAR y enviar al servicio técnico (no se ajusta en el laboratorio)',
  PREGUNTAR_AJUSTE: 'AJUSTAR: el profesorado tiene que comprobar si tiene tornillo de ajuste',
  PENDIENTE: 'Pendiente: faltan réplicas o volúmenes',
  SIN_RANGO: 'No se puede verificar: falta el rango de la pipeta',
};

/** Volúmenes que le tocan a una pipeta según sus parámetros (CSV). */
export function volumenesDe(par, vBajoElegido) {
  if (!par || !num(par.v_nominal)) return [];
  const vs = [{ clave: 'nominal', titulo: 'Volumen nominal', v: num(par.v_nominal), metodo: par.metodo_nominal,
    disolucion: par.patron_nominal || null, masa_tabla: num(par.masa_nominal_g), LE: num(par.es_nominal_pct), LC: num(par.cv_nominal_pct) }];
  const vb = num(vBajoElegido) || num(par.v_bajo);
  if (vb) vs.push({ clave: 'bajo', titulo: 'Volumen bajo', v: vb, metodo: par.metodo_bajo,
    disolucion: par.patron_bajo || null, masa_tabla: num(par.masa_bajo_g), LE: num(par.es_bajo_pct), LC: num(par.cv_bajo_pct) });
  return vs;
}

export function canalesDe(par) { return par?.multicanal === true || /^s[ií]$/i.test(String(par?.multicanal || '')) ? 8 : 1; }

/**
 * Resultado de la pipeta a partir de las decisiones de cada volumen y canal de una fase.
 * decisiones: [{volumen, canal, decision}] — una por volumen×canal que le toca.
 */
export function resultadoFase(decisiones, { ajuste_usuario, ajuste_respuesta, tras_ajuste } = {}) {
  if (!decisiones.length) return 'PENDIENTE';
  const ds = decisiones.map(d => d.decision);
  if (ds.includes('RETIRAR')) return 'RETIRAR';
  if (ds.includes('AJUSTAR')) {
    if (tras_ajuste) return 'RETIRAR';           // 6.7: después del ajuste sigue sin cumplir
    const au = String(ajuste_usuario || '').toLowerCase();
    if (au.startsWith('no')) return 'RETIRAR_SAT';
    if (au.startsWith('por comprobar')) {
      if (ajuste_respuesta === 'no') return 'RETIRAR';
      if (ajuste_respuesta === 'si') return 'AJUSTAR';
      return 'PREGUNTAR_AJUSTE';
    }
    return 'AJUSTAR';
  }
  if (ds.every(d => d === 'OK' || d === 'FUERA')) return ds.includes('FUERA') ? 'OK_FUERA' : 'OK';
  return 'PENDIENTE';
}

/**
 * Calcula toda la verificación guardada en un registro.
 * ver: { fases:[{tipo:'inicial'|'tras_ajuste', volumenes:{ nominal:{id_sesion, lote_sc,
 *        canales:[{replicas:[{m,A}]}]}, bajo:{…} } }], sin_cribado, v_bajo_elegido }
 * ctx: { par (fila del CSV), sesiones:{ id: resultado de calcularSesion }, prep (calcularPreparacion),
 *        ajuste_respuesta }
 * Devuelve { fases:[{tipo, volumenes:{clave:{canales:[calc]}} , resultado}], resultado, limites,
 *            final:true si se puede finalizar }.
 */
export function calcularVerificacion(ver, ctx) {
  const par = ctx.par;
  const out = { fases: [], avisos: [] };
  if (!par || !num(par.v_nominal)) { out.resultado = 'SIN_RANGO'; out.final = false; return out; }
  const vols = volumenesDe(par, ver?.v_bajo_elegido);
  const nCan = canalesDe(par);
  out.limites = vols.map(v => ({ clave: v.clave, v: v.v, metodo: v.metodo, disolucion: v.disolucion, masa_tabla: v.masa_tabla, LE: v.LE, LC: v.LC }));
  out.fuente_limites = par.fuente_limites || '';
  if (par.confirmar) out.avisos.push(par.confirmar);
  const fases = ver?.fases?.length ? ver.fases : [{ tipo: 'inicial', volumenes: {} }];
  fases.forEach((fase, fi) => {
    const tras = fase.tipo === 'tras_ajuste';
    const sinCribado = !!ver?.sin_cribado || tras;
    const fr = { tipo: fase.tipo, volumenes: {}, decisiones: [] };
    for (const v of vols) {
      const dv = fase.volumenes?.[v.clave] || {};
      const ses = dv.id_sesion ? ctx.sesiones?.[dv.id_sesion] : null;
      const fot = v.metodo === 'fotométrico';
      const disol = fot && v.disolucion === 'S-C' && String(dv.lote_sc) === '2' ? 'S-C2' : v.disolucion;
      let sesionValida = null, motivo = null;
      if (ses) {
        if (fot) {
          sesionValida = ses.valida_fot && ses.disoluciones?.[disol]?.ok;
          motivo = !ses.valida_fot ? ses.motivos_fot.join('; ') : ses.disoluciones?.[disol]?.ok ? null : `${disol}: ${ses.disoluciones?.[disol]?.motivo}`;
        } else { sesionValida = ses.valida_grav; motivo = ses.motivos_grav.join('; '); }
      }
      const canales = [];
      for (let c = 0; c < nCan; c++) {
        const reps = dv.canales?.[c]?.replicas || [];
        const calc = calcularVolumen({
          metodo: v.metodo, v_ajustado: v.v, LE: v.LE, LC: v.LC, masa_tabla: v.masa_tabla, replicas: reps,
          z: ses?.z ?? null, recta: ses?.recta ?? null, F: fot ? factorDisolucion(ctx.prep, v.disolucion, dv.lote_sc || '1') : 1,
          cv_lectura: ses?.cv_lectura?.cv ?? null, s_balanza: ses?.s_balanza ?? null,
          sin_cribado: sinCribado, sesion_valida: ses ? sesionValida : false,
          motivo_sesion: ses ? motivo : 'Elige la sesión en que se ha medido',
        });
        if (!ses && calc.n) { calc.decision = 'SESION'; calc.motivo = 'Elige la sesión en que se ha medido'; }
        canales.push(calc);
        fr.decisiones.push({ volumen: v.clave, canal: c + 1, decision: calc.decision });
      }
      fr.volumenes[v.clave] = { canales, id_sesion: dv.id_sesion || null, disolucion: disol };
    }
    fr.resultado = resultadoFase(fr.decisiones, { ajuste_usuario: par.ajuste_usuario, ajuste_respuesta: ctx.ajuste_respuesta, tras_ajuste: tras });
    out.fases.push(fr);
  });
  const ultima = out.fases[out.fases.length - 1];
  out.resultado = ultima.resultado;
  // Resultado para el documento de calidad: OK / AJUSTADA / RETIRADA
  const huboAjuste = out.fases.some(f => f.tipo === 'tras_ajuste');
  out.calidad = /^OK/.test(out.resultado) ? (huboAjuste ? 'AJUSTADA' : 'OK') : /^RETIRAR/.test(out.resultado) ? 'RETIRADA' : null;
  out.final = /^(OK|RETIRAR)/.test(out.resultado);
  return out;
}

// ── Pasos del plan que marca la app (8) ─────────────────────────────────────
/**
 * ¿Es este paso del plan de la revisión una línea de la verificación? Devuelve
 * { tipo: 'volumen', clave } | { tipo: 'sesion' } | { tipo: 'completar' } |
 * { tipo: 'resultado' } | { tipo: 'bianual' } | null. Esas líneas no se marcan a mano.
 */
export function pasoVerificacion(texto) {
  const t = String(texto || '').trim();
  if (/^Verificar (en una sesi[oó]n fotom[eé]trica|con la BTC-223 encendida)/i.test(t)) return { tipo: 'sesion' };
  if (/^Si la hoja de c[aá]lculo marca|^Si (GestionLab|el c[aá]lculo) marca/i.test(t)) return { tipo: 'completar' };
  if (/^Resultado seg[uú]n (la hoja de c[aá]lculo|el c[aá]lculo)/i.test(t)) return { tipo: 'resultado' };
  if (/^Verificaci[oó]n con 10 r[eé]plicas/i.test(t)) return { tipo: 'bianual' };
  if (/^Volumen nominal\s*:/i.test(t)) return { tipo: 'volumen', clave: 'nominal' };
  if (/^Volumen bajo\b/i.test(t)) return { tipo: 'volumen', clave: 'bajo' };
  const m = t.match(/^[\d\s.,]+(?:\s*o\s*[\d\s.,]+)?\s*(?:µl|ml)\s*\(([^)]*)\)\s*:/i);
  if (m) return { tipo: 'volumen', clave: /nominal/i.test(m[1]) ? 'nominal' : 'bajo' };
  return null;
}

/**
 * Volumen bajo a elegir según lo grabado en la pipeta («100 o 200 µl (mínimo grabado)»,
 * PIP-005): devuelve [100, 200] si el plan lo deja elegir; si no, null.
 */
export function opcionesVolumenBajo(instrucciones) {
  for (const l of String(instrucciones || '').split(/\r?\n/)) {
    const m = l.trim().match(/^([\d.,]+)\s*o\s*([\d.,]+)\s*µl\s*\(m[ií]nimo/i);
    if (m) return [num(m[1]), num(m[2])].filter(x => x);
  }
  return null;
}

function notaVolumen(calcCanales, lim) {
  return calcCanales.map((c, i) => `${calcCanales.length > 1 ? `canal ${i + 1}: ` : ''}${DECISION[c.decision] || c.decision}` +
    (c.es !== undefined ? ` (error sistemático ${fmt(c.es, 2, true)} %, límite ±${fmt(lim.LE, 1)} %; CV corregido ${fmt(c.cvCorr, 2)} %, límite ${fmt(lim.LC, 1)} %; ${c.n} réplicas)` : ''))
    .join(' · ');
}

/**
 * Marca los pasos de verificación según el cálculo (la persona no los marca). Los demás
 * pasos se quedan como vengan. pasos: [{texto, criterio, hecho, resultado, nota}].
 */
export function marcarPasosVerificacion(pasos, calc) {
  if (!Array.isArray(pasos) || !calc) return pasos;
  const ultima = calc.fases?.[calc.fases.length - 1];
  const final = !!calc.final;
  return pasos.map(p => {
    const pv = pasoVerificacion(p.texto);
    if (!pv) return p;
    const q = { ...p, auto: true };
    const conCriterio = !!q.criterio;
    const pon = (estado, nota) => {
      if (conCriterio) { q.resultado = estado; q.hecho = !!estado; q.nota = estado === 'no_cumple' ? nota : null; }
      else q.hecho = !!estado;
    };
    if (pv.tipo === 'volumen') {
      const v = ultima?.volumenes?.[pv.clave];
      const lim = calc.limites?.find(l => l.clave === pv.clave);
      const ds = (v?.canales || []).map(c => c.decision);
      if (!v || !ds.length) pon(null);
      else if (ds.every(d => d === 'OK' || d === 'FUERA')) pon('cumple');
      else if (final && ds.some(d => d === 'AJUSTAR' || d === 'RETIRAR')) pon('no_cumple', notaVolumen(v.canales, lim || {}));
      else pon(null);
    } else if (pv.tipo === 'bianual') {
      if (/^OK/.test(calc.resultado)) pon('cumple');
      else if (/^RETIRAR/.test(calc.resultado)) pon('no_cumple', RESULTADO[calc.resultado]);
      else pon(null);
    } else if (pv.tipo === 'sesion') {
      const vols = Object.values(ultima?.volumenes || {});
      const conDatos = vols.filter(v => v.canales.some(c => c.n));
      pon(conDatos.length && conDatos.every(v => v.canales.every(c => !c.n || c.decision !== 'SESION')) ? 'cumple' : null);
    } else {
      pon(final ? 'cumple' : null);   // «Completar» y «Resultado»: hechos cuando hay resultado
    }
    return q;
  });
}

/** Qué falta para tener resultado: «20 µl: COMPLETAR hasta 10 réplicas (punta nueva)…». */
export function resumenPendiente(calc) {
  if (!calc) return '';
  if (calc.resultado === 'SIN_RANGO') return RESULTADO.SIN_RANGO;
  if (calc.resultado === 'PREGUNTAR_AJUSTE') return RESULTADO.PREGUNTAR_AJUSTE;
  if (calc.resultado === 'AJUSTAR') return RESULTADO.AJUSTAR;
  const ultima = calc.fases?.[calc.fases.length - 1];
  const partes = [];
  for (const [clave, v] of Object.entries(ultima?.volumenes || {})) {
    const lim = calc.limites?.find(l => l.clave === clave);
    v.canales.forEach((c, i) => {
      if (c.decision === 'OK' || c.decision === 'FUERA') return;
      partes.push(`${fmt(lim?.v, lim?.v < 10 ? 1 : 0)} µl${v.canales.length > 1 ? ` canal ${i + 1}` : ''}: ${DECISION[c.decision] || c.decision}${c.motivo ? ` (${c.motivo})` : ''}`);
    });
  }
  return partes.join(' · ') || RESULTADO[calc.resultado] || '';
}

/** Texto corto de un número con coma decimal, para la pantalla. */
export function fmt(x, dec = 2, signo = false) {
  if (x === null || x === undefined || !Number.isFinite(x)) return '—';
  const s = Math.abs(x).toFixed(dec).replace('.', ',');
  return signo ? (x >= 0 ? '+' : '−') + s : (x < 0 ? '−' + s : s);
}
