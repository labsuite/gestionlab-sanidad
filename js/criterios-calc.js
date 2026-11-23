// ============================================================
// CALCULADORA DE CRITERIOS (mantenimiento → comprobaciones con criterio)
// ============================================================
// Lee el texto libre de un criterio («Δ ≤ 1 °C; junta estanca», «37 ± 0,5 °C»,
// «Velocidad ±5 %, tiempo ±10 s, temperatura ±2 °C»…) y saca de él las tolerancias
// NUMÉRICAS que se pueden calcular. Para cada una, la pantalla pide los datos (lo que
// marca el equipo y lo que mide el instrumento de referencia) y dice si cumple.
//
// Es deliberadamente conservadora: solo reconoce formas sin ambigüedad. Lo que no
// entiende («≤ 1 °C» suelto —¿desviación o temperatura?—, «± 2 d» —¿cuánto es d?—,
// «±0,1 / ±10 %», «≥ 80 % del vacío nominal»…) se queda como condición que juzga la
// persona, igual que «junta estanca». Mejor sin calculadora que con un veredicto
// equivocado en un registro de calidad.
//
// Funciones puras (sin DOM) — se pueden probar en Node.
// Tipos de regla:
//   desviacion  |equipo − referencia| ≤ tol          (± sin nominal, Δ, Error, Consigna…)
//               en %: |equipo − referencia| / |referencia| · 100 ≤ tol
//   nominal     igual, con el valor nominal ya escrito («37 ± 0,5 °C» → 37)
//   rango       mayor − menor de varias lecturas ≤ tol
//   umbral      un valor medido frente a un límite (≥ 0,4 m/s, T ≥ 121 °C, CV ≤ 3 %)

const _CC_NUM = String.raw`[−-]?\d+(?:[.,]\d+)?`;
// Orden importa: m/s antes que min/ml; µl antes que l.
const _CC_UNIDAD = String.raw`°C|%|rpm|m\/s|min|ml|mL|µl|µL|ul|mg|g|nm|s|h|puntos?|bar|kPa|mbar`;
const _CC_ETQ = String.raw`[A-Za-zÁÉÍÓÚÜÑáéíóúüñΔλ₂²][A-Za-zÁÉÍÓÚÜÑáéíóúüñΔλ₂² ]*?`;   // etiqueta: palabras sin cifras

function _ccNum(s) {
  return parseFloat(String(s).replace(/−/g, '-').replace(',', '.'));
}

/** Etiqueta legible para la magnitud («Temperatura», «Velocidad»…) a partir de la unidad. */
function _ccMagnitud(etiqueta, unidad) {
  const e = (etiqueta || '').trim().replace(/^Δ\s*/, '');
  const corta = { 'λ': 'Longitud de onda', 'A': 'Absorbancia', 'T': 'Temperatura' }[e];
  if (corta) return corta;
  if (e && !/^(error|diferencia|consigna|desviación)$/i.test(e)) return e.charAt(0).toUpperCase() + e.slice(1);
  return ({ '°C': 'Temperatura', 'rpm': 'Velocidad', 's': 'Tiempo', 'min': 'Tiempo', 'h': 'Horas',
            'g': 'Masa', 'mg': 'Masa', 'nm': 'Longitud de onda', 'm/s': 'Velocidad del aire',
            'µl': 'Volumen', 'µL': 'Volumen', 'ul': 'Volumen', 'ml': 'Volumen', 'mL': 'Volumen',
            'punto': 'Valor', 'puntos': 'Valor', '%': 'Valor' })[unidad] || 'Valor';
}

/** ¿El «%» de esta magnitud es la unidad (CO₂, humedad) y no un error relativo? */
function _ccPorcentajeEsUnidad(etiqueta) {
  return /co\s*[₂2]|humedad|\bhr\b|o\s*[₂2]\b/i.test(etiqueta || '');
}

/** Interpreta UN tramo del criterio. Devuelve una regla o null si no es calculable. */
function _ccRegla(seg) {
  const s = seg.trim().replace(/\s+/g, ' ');
  if (!s || /\//.test(s.replace(/m\/s/g, '')) || /\bo\b(?! \d)/.test(s.replace(/\(o [^)]*\)/, ''))) return null;   // alternativas «a / b», «x o display»
  const N = _CC_NUM, U = _CC_UNIDAD, E = _CC_ETQ;
  let m;

  // nominal: «37 ± 0,5 °C», «0,0 ± 0,4 °C», «1509 ± 10 rpm (o 1032 ± 10)»
  m = s.match(new RegExp(`^(${E})?\\s*(${N})\\s*±\\s*(${N})\\s*(${U})(?:\\s*\\(o (${N})\\s*±\\s*(${N})\\s*(?:${U})?\\))?$`, 'u'));
  if (m) {
    const unidad = m[4];
    return {
      tipo: 'nominal', texto: s, magnitud: _ccMagnitud(m[1], unidad), unidad,
      nominal: _ccNum(m[2]), tol: _ccNum(m[3]),
      alternativa: m[5] != null ? { nominal: _ccNum(m[5]), tol: _ccNum(m[6]) } : null,
      relativo: false,
    };
  }

  // desviación ±: «±1 °C», «Velocidad ±5 %», «Consigna ± 3 °C», «±2 % fotométrico», «λ ±2 nm»
  m = s.match(new RegExp(`^(${E})?\\s*±\\s*(${N})\\s*(${U})(?:\\s+(${E}))?$`, 'u'));
  if (m) {
    const unidad = m[3], etq = (m[1] || m[4] || '').trim();
    return {
      tipo: 'desviacion', texto: s, magnitud: _ccMagnitud(etq, unidad), unidad,
      tol: _ccNum(m[2]), op: '≤',
      relativo: unidad === '%' && !_ccPorcentajeEsUnidad(etq),
      consigna: /consigna/i.test(etq),
    };
  }

  // desviación ≤: «Δ ≤ 1 °C», «Δ termómetro ≤ 1 °C», «Diferencia ≤ 3 % en las dos velocidades»,
  // «Error ≤ 0,02 g», «Error ≤ 0,03 g en cada tramo», «Δ ≤ 1 °C (≤ 0,5 °C en 37 °C)»
  m = s.match(new RegExp(`^(Δ|Diferencia|Error|Desviación)(?:\\s+(${E}))?\\s*(≤|<)\\s*(${N})\\s*(${U})(?:\\s+(?:en|de) [^()≤<≥>±]+?)?(?:\\s*\\(≤\\s*(${N})\\s*(?:${U})? en (${N})\\s*(?:${U})?\\))?$`, 'u'));
  if (m && !/entre la mayor y la menor/i.test(s)) {
    const unidad = m[5];
    return {
      tipo: 'desviacion', texto: s, magnitud: _ccMagnitud(m[2] || '', unidad), unidad,
      tol: _ccNum(m[4]), op: m[3],
      relativo: unidad === '%',
      dosValores: /^diferencia/i.test(m[1]),
      // tolerancia más estricta cerca de un punto: «(≤ 0,5 °C en 37 °C)»
      estricta: m[6] != null ? { tol: _ccNum(m[6]), en: _ccNum(m[7]) } : null,
    };
  }

  // desviación con «de desviación»: «CO₂ ≤ 0,3 % de desviación»
  m = s.match(new RegExp(`^(${E})\\s*(≤|<)\\s*(${N})\\s*(${U}) de desviación$`, 'u'));
  if (m) {
    const unidad = m[4], etq = m[1].trim();
    return {
      tipo: 'desviacion', texto: s, magnitud: _ccMagnitud(etq, unidad), unidad,
      tol: _ccNum(m[3]), op: m[2],
      relativo: unidad === '%' && !_ccPorcentajeEsUnidad(etq),
    };
  }

  // rango: «Diferencia entre la mayor y la menor ≤ 0,8 °C»
  m = s.match(new RegExp(`^Diferencia entre la mayor y la menor (≤|<)\\s*(${N})\\s*(${U})$`, 'u'));
  if (m) {
    return { tipo: 'rango', texto: s, magnitud: _ccMagnitud('', m[3]), unidad: m[3], tol: _ccNum(m[2]), op: m[1] };
  }

  // umbral mínimo: «≥ 0,4 m/s», «T ≥ 121 °C en meseta», «r² > 0,998»
  m = s.match(new RegExp(`^(${E})?\\s*(≥|>)\\s*(${N})\\s*(${U})?(?:\\s+en [^()≤<≥>±]+)?$`, 'u'));
  if (m) {
    const etq = (m[1] || '').trim(), unidad = m[4] || '';
    return { tipo: 'umbral', texto: s, magnitud: etq === 'T' ? 'Temperatura' : _ccMagnitud(etq, unidad), unidad, limite: _ccNum(m[3]), op: m[2] };
  }

  // umbral máximo: solo con una etiqueta que no sea de desviación («CV ≤ 3 %»,
  // «lámpara < 1000 h», «residuo ≤ 5 µl»), o sin etiqueta y con un límite negativo
  // («≤ −5 °C en 45 min»). «≤ 1 °C» suelto o «T ≤ 0,5 °C» son ambiguos: fuera.
  m = s.match(new RegExp(`^(${E})?\\s*(≤|<)\\s*(${N})\\s*(${U})?(?:\\s+en [^()≤<≥>±]+)?$`, 'u'));
  if (m) {
    const etq = (m[1] || '').trim(), unidad = m[4] || '', limite = _ccNum(m[3]);
    const etqValida = etq.length > 1 && !/error|excentricidad|desviación|diferencia|Δ|\by\b/i.test(etq);
    if (etqValida || (!etq && limite < 0)) {
      return { tipo: 'umbral', texto: s, magnitud: etq ? _ccMagnitud(etq, unidad) : _ccMagnitud('', unidad), unidad, limite, op: m[2] };
    }
  }
  return null;
}

/** Trocea un criterio en tramos: por «;» y, si todos los trozos llevan tolerancia,
 *  también por «, » («Velocidad ±5 %, tiempo ±10 s, temperatura ±2 °C»). */
function _ccTramos(criterio) {
  const out = [];
  String(criterio || '').split(';').map(t => t.trim()).filter(Boolean).forEach(t => {
    const partes = t.split(/,\s+(?=\p{L})/u);
    if (partes.length > 1 && partes.every(p => /[±≤≥<>]/.test(p))) out.push(...partes.map(p => p.trim()));
    else out.push(t);
  });
  return out;
}

/** Analiza un criterio entero: { reglas: [regla…], resto: [texto que juzga la persona] }. */
function analizarCriterio(criterio) {
  const reglas = [], resto = [];
  _ccTramos(criterio).forEach(t => {
    const r = _ccRegla(t);
    if (r) reglas.push(r); else resto.push(t);
  });
  return { reglas, resto };
}

function _ccFmt(n, dec, fijo) {
  if (n == null || !isFinite(n)) return '—';
  const d = dec != null ? dec : Math.min(4, Math.max(0, (String(n).split('.')[1] || '').length));
  return n.toLocaleString('es-ES', { minimumFractionDigits: fijo ? d : 0, maximumFractionDigits: Math.max(d, 1) });
}

/** Decimales que conviene enseñar: los de la tolerancia y los de los datos, +1. */
function _ccDecimales(...vals) {
  return Math.min(4, Math.max(...vals.map(v => (String(v ?? '').replace(',', '.').split('.')[1] || '').length)) + 1);
}

/**
 * Calcula una regla con los datos tecleados.
 * datos = { equipo, referencia, valor, lecturas } (strings tal cual del input).
 * Devuelve null si faltan datos, o { cumple, detalle, tolAplicada }.
 */
function calcularRegla(regla, datos) {
  const d = datos || {};
  const u = regla.unidad ? ' ' + regla.unidad : '';
  const cmp = (x, op, lim) => op === '<' ? x < lim : op === '>' ? x > lim : op === '≥' ? x >= lim : x <= lim;
  const EPS = 1e-9;   // 0,1 + 0,2 no debe suspender un «≤ 0,3»

  if (regla.tipo === 'umbral') {
    const v = _ccNum(d.valor);
    if (!isFinite(v)) return null;
    const ok = cmp(v + (regla.op === '≥' || regla.op === '>' ? EPS : -EPS), regla.op, regla.limite);
    return { cumple: ok, detalle: `${_ccFmt(v)}${u} ${ok ? '' : 'no '}${regla.op} ${_ccFmt(regla.limite)}${u}`.replace(' no ', ' — no es ') };
  }

  if (regla.tipo === 'rango') {
    const vals = String(d.lecturas || '').split(/[\s;]+/).map(_ccNum).filter(isFinite);
    if (vals.length < 2) return null;
    const dif = Math.max(...vals) - Math.min(...vals);
    const ok = cmp(dif - EPS, regla.op, regla.tol);
    const dec = _ccDecimales(regla.tol, ...String(d.lecturas).split(/[\s;]+/));
    return { cumple: ok, detalle: `lecturas ${vals.map(v => _ccFmt(v)).join(' · ')}${u} → diferencia ${_ccFmt(dif, dec)}${u} (${ok ? '≤' : '>'} ${_ccFmt(regla.tol)}${u})` };
  }

  // desviacion / nominal
  const eq = _ccNum(d.equipo), ref = _ccNum(d.referencia);
  if (!isFinite(eq) || !isFinite(ref)) return null;
  let tol = regla.tol, notaTol = '';
  if (regla.tipo === 'nominal' && regla.alternativa && Math.abs(eq - regla.alternativa.nominal) < Math.abs(eq - regla.nominal)) {
    tol = regla.alternativa.tol;
  }
  if (regla.estricta && Math.abs(eq - regla.estricta.en) <= Math.max(regla.tol, 1)) {
    tol = regla.estricta.tol; notaTol = ` a ${_ccFmt(regla.estricta.en)}${u}`;
  }
  const dif = eq - ref;
  const dec = _ccDecimales(tol, d.equipo, d.referencia);
  if (regla.relativo) {
    if (ref === 0) return { cumple: false, detalle: 'la referencia es 0: no se puede calcular un error en %' };
    const pct = Math.abs(dif) / Math.abs(ref) * 100;
    const ok = pct <= tol + EPS;
    return { cumple: ok, tolAplicada: tol,
      detalle: `${_ccFmt(eq)} frente a ${_ccFmt(ref)} → ${dif >= 0 ? '+' : '−'}${_ccFmt(Math.abs(dif), dec)} (${_ccFmt(pct, 2)} %; ${ok ? '≤' : '>'} ${_ccFmt(tol)} %${notaTol})` };
  }
  const ok = Math.abs(dif) <= tol + EPS;
  return { cumple: ok, tolAplicada: tol,
    detalle: `${_ccFmt(eq)}${u} frente a ${_ccFmt(ref)}${u} → ${dif >= 0 ? '+' : '−'}${_ccFmt(Math.abs(dif), dec)}${u} (${ok ? '≤' : '>'} ±${_ccFmt(tol)}${u}${notaTol})` };
}

/** Texto que explica la regla en la pantalla, antes de teclear nada. */
function describirRegla(regla) {
  const u = regla.unidad ? ' ' + regla.unidad : '';
  switch (regla.tipo) {
    case 'nominal':
      return `Cumple si lo medido está a ±${_ccFmt(regla.tol)}${u} de ${_ccFmt(regla.nominal, _ccDecimales(regla.tol) - 1, true)}${u}` +
        (regla.alternativa ? ` (o ±${_ccFmt(regla.alternativa.tol)}${u} de ${_ccFmt(regla.alternativa.nominal)}${u})` : '');
    case 'desviacion':
      return regla.relativo
        ? `Cumple si la diferencia es ≤ ${_ccFmt(regla.tol)} % del valor de referencia`
        : `Cumple si la diferencia es ≤ ${_ccFmt(regla.tol)}${regla.unidad === '%' ? ' puntos de %' : u}` +
          (regla.estricta ? ` (≤ ${_ccFmt(regla.estricta.tol)}${u} trabajando a ${_ccFmt(regla.estricta.en)}${u})` : '');
    case 'rango':
      return `Cumple si entre la lectura mayor y la menor hay ≤ ${_ccFmt(regla.tol)}${u}`;
    case 'umbral':
      return `Cumple si el valor medido es ${regla.op} ${_ccFmt(regla.limite)}${u}`;
  }
  return '';
}

/** Rótulos de las casillas según el tipo de regla. */
function camposRegla(regla) {
  if (regla.tipo === 'umbral') return [{ k: 'valor', label: 'Valor medido' }];
  if (regla.tipo === 'rango')  return [{ k: 'lecturas', label: 'Lecturas (separadas por espacios)', ancho: true }];
  if (regla.tipo === 'nominal') return [
    { k: 'equipo', label: 'Valor nominal / programado' },
    { k: 'referencia', label: 'Valor medido (instrumento)' },
  ];
  if (regla.dosValores) return [
    { k: 'equipo', label: 'Primer valor' },
    { k: 'referencia', label: 'Segundo valor (referencia)' },
  ];
  return [
    // Lo que marca la pantalla en ese momento, no la consigna: «Equipo (pantalla /
    // programado)» invitaba a poner lo programado (Paloma, 2026-11-23).
    { k: 'equipo', label: regla.consigna ? 'Consigna del equipo' : 'Pantalla del equipo (si no tiene: lo programado)' },
    { k: 'referencia', label: 'Instrumento de referencia' },
  ];
}

function _ccEsc(t) {
  return String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

if (typeof module !== 'undefined') module.exports = { analizarCriterio, calcularRegla, describirRegla, camposRegla };
