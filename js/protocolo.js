// ============================================================
// PROTOCOLOS DE USO — visor de equipos.protocolo_uso
// ============================================================
// Los protocolos se guardan en Markdown (título #, tabla de datos, resumen en
// cita y apartados ## numerados: ficha técnica, seguridad, comprobaciones…).
// Aquí se pintan como HTML de verdad: plegados por defecto, cada apartado ##
// es un desplegable, con índice para saltar y un buscador que abre y resalta
// los apartados donde aparece lo buscado.
//
// El renderizador es mínimo a propósito (solo lo que usan los protocolos):
// encabezados, tablas, citas, listas (con casillas [ ] y anidadas), separadores,
// **negrita**, *cursiva*, `código`, [enlaces](url) y URLs sueltas. Todo el texto
// se escapa antes de dar formato, así que no se cuela HTML del campo.

function _mdEsc(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function _mdInline(txt) {
  const codes = [];
  let s = _mdEsc(txt).replace(/`([^`]+)`/g, (_, c) => { codes.push(c); return `\u0000${codes.length - 1}\u0000`; });
  const links = [];
  s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, (_, t, u) => {
    links.push(`<a href="${u}" target="_blank" rel="noopener">${t}</a>`);
    return `\u0001${links.length - 1}\u0001`;
  });
  s = s.replace(/https?:\/\/[^\s<)*]*[^\s<).,;:»*]/g, u => {
    links.push(`<a href="${u}" target="_blank" rel="noopener">${u}</a>`);
    return `\u0001${links.length - 1}\u0001`;
  });
  s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
       .replace(/(^|[^\w*])\*(?!\s)(.+?)\*(?!\w)/g, '$1<em>$2</em>');
  return s.replace(/\u0001(\d+)\u0001/g, (_, i) => links[i])
          .replace(/\u0000(\d+)\u0000/g, (_, i) => `<code>${codes[i]}</code>`);
}

function _mdCeldas(linea) {
  return linea.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim());
}

function _mdRender(md) {
  const lineas = String(md || '').replace(/\r\n?/g, '\n').split('\n');
  const out = [];
  let i = 0;
  const esEspecial = l => /^(#{1,6} |\s*[-*] |\s*\d+[.)] |> ?|\||---\s*$)/.test(l);
  while (i < lineas.length) {
    const l = lineas[i];
    if (!l.trim()) { i++; continue; }
    let m;
    if ((m = l.match(/^(#{1,6}) (.*)$/))) {
      const n = Math.min(m[1].length + 1, 6);   // # del protocolo → h2 (la tarjeta ya tiene su h1)
      out.push(`<h${n}>${_mdInline(m[2])}</h${n}>`); i++; continue;
    }
    if (/^---\s*$/.test(l)) { out.push('<hr>'); i++; continue; }
    if (l.trim().startsWith('|')) {
      const filas = [];
      while (i < lineas.length && lineas[i].trim().startsWith('|')) filas.push(lineas[i++]);
      const sep = filas.length > 1 && /^\|?[\s:|-]+\|?$/.test(filas[1].trim());
      const cab = sep ? _mdCeldas(filas[0]) : null;
      const cuerpo = filas.slice(sep ? 2 : 0).map(_mdCeldas);
      out.push(`<div class="proto-tabla"><table>${cab ? `<thead><tr>${cab.map(c => `<th>${_mdInline(c)}</th>`).join('')}</tr></thead>` : ''}<tbody>${
        cuerpo.map(r => `<tr>${r.map(c => `<td>${_mdInline(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`);
      continue;
    }
    if (/^> ?/.test(l)) {
      const q = [];
      while (i < lineas.length && /^> ?/.test(lineas[i])) q.push(lineas[i++].replace(/^> ?/, ''));
      out.push(`<blockquote>${_mdRender(q.join('\n'))}</blockquote>`);
      continue;
    }
    if (/^\s*([-*]|\d+[.)]) /.test(l)) {
      const items = [];
      while (i < lineas.length && (/^\s*([-*]|\d+[.)]) /.test(lineas[i]) ||
             (lineas[i].trim() && /^\s{2,}/.test(lineas[i]) && items.length))) {
        const x = lineas[i++];
        const mm = x.match(/^(\s*)([-*]|\d+[.)]) (.*)$/);
        if (mm) items.push({ ind: mm[1].replace(/\t/g, '    ').length, ol: /\d/.test(mm[2]), num: parseInt(mm[2]), txt: mm[3] });
        else items[items.length - 1].txt += ' ' + x.trim();   // continuación de la línea anterior
      }
      out.push(_mdLista(items, 0, items.length));
      continue;
    }
    const p = [];
    while (i < lineas.length && lineas[i].trim() && !(p.length && esEspecial(lineas[i]))) p.push(lineas[i++]);
    out.push(`<p>${_mdInline(p.join('\n')).replace(/\n/g, '<br>')}</p>`);
  }
  return out.join('');
}

function _mdLista(items, a, b) {
  const base = items[a].ind, ol = items[a].ol;
  let h = ol ? `<ol${items[a].num > 1 ? ` start="${items[a].num}"` : ''}>` : '<ul>';
  for (let k = a; k < b; ) {
    let fin = k + 1;
    while (fin < b && items[fin].ind > base) fin++;
    const t = items[k].txt.match(/^\[([ xX])\] (.*)$/);
    h += t
      ? `<li class="proto-check"><span class="proto-casilla">${t[1] === ' ' ? '☐' : '☑'}</span> ${_mdInline(t[2])}`
      : `<li>${_mdInline(items[k].txt)}`;
    if (fin > k + 1) h += _mdLista(items, k + 1, fin);
    h += '</li>';
    k = fin;
  }
  return h + (ol ? '</ol>' : '</ul>');
}

// Parte el protocolo en { titulo, intro, secciones:[{titulo, md}] } por los ##.
function _protoPartir(md) {
  const lineas = String(md || '').replace(/\r\n?/g, '\n').split('\n');
  let titulo = '';
  const intro = [], secciones = [];
  let actual = null;
  for (const l of lineas) {
    const h1 = !titulo && !actual && l.match(/^# (.*)$/);
    if (h1) { titulo = h1[1].trim(); continue; }
    const h2 = l.match(/^## (.*)$/);
    if (h2) { actual = { titulo: h2[1].trim(), md: [] }; secciones.push(actual); continue; }
    (actual ? actual.md : intro).push(l);
  }
  // El "---" que separa los apartados queda colgando al final de cada uno.
  const limpiar = arr => arr.join('\n').replace(/\n\s*---\s*\n*$/, '\n').trim();
  return { titulo, intro: limpiar(intro), secciones: secciones.map(s => ({ titulo: s.titulo, md: limpiar(s.md) })) };
}

function buildProtocoloUso(md) {
  if (!md || !String(md).trim()) return '';
  const p = _protoPartir(md);
  const titulo = p.titulo || 'Protocolo de uso';
  const indice = p.secciones.map((s, k) =>
    `<button type="button" class="proto-chip" onclick="protoIr(this,${k})">${_mdInline(s.titulo)}</button>`).join('');
  const secs = p.secciones.map((s, k) =>
    `<details class="proto-sec" data-k="${k}"><summary>${_mdInline(s.titulo)}</summary><div class="proto-cuerpo">${_mdRender(s.md)}</div></details>`).join('');
  return `
    <details class="proto">
      <summary onclick="if(this.parentElement.classList.contains('proto-ampliado'))event.preventDefault()">
        <span class="proto-titulo">📖 ${_mdInline(titulo)}</span>
        <span class="proto-meta">${p.secciones.length} apartados</span>
      </summary>
      <div class="proto-barra">
        <input type="search" class="proto-buscar" placeholder="🔍 Buscar en el protocolo (p. ej. aceite, fusible, error)…" oninput="protoBuscar(this)">
        <span class="proto-res"></span>
        <button type="button" class="btn btn-secondary proto-btn" onclick="protoTodo(this,true)">Abrir todo</button>
        <button type="button" class="btn btn-secondary proto-btn" onclick="protoTodo(this,false)">Cerrar todo</button>
        <button type="button" class="btn btn-secondary proto-btn proto-btn-ampliar" onclick="protoAmpliar(this)">⤢ Ampliar</button>
      </div>
      ${indice ? `<div class="proto-indice">${indice}</div>` : ''}
      ${p.intro ? `<div class="proto-intro proto-cuerpo">${_mdRender(p.intro)}</div>` : ''}
      <div class="proto-secs">${secs}</div>
    </details>`;
}

function protoIr(btn, k) {
  const root = btn.closest('.proto');
  const sec = root.querySelector(`.proto-sec[data-k="${k}"]`);
  if (!sec) return;
  sec.hidden = false;
  sec.open = true;
  sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function protoTodo(btn, abrir) {
  btn.closest('.proto').querySelectorAll('.proto-sec').forEach(s => { if (!s.hidden) s.open = abrir; });
}

function protoAmpliar(btn) {
  const root = btn.closest('.proto');
  const on = root.classList.toggle('proto-ampliado');
  btn.textContent = on ? '✕ Cerrar' : '⤢ Ampliar';
  document.body.style.overflow = on ? 'hidden' : '';
  if (on) root.open = true;
}

// Minúsculas y sin tildes, conservando la longitud (para poder resaltar sobre el original).
function _protoNorm(s) {
  return Array.from(s, c => Array.from(c.normalize('NFD'))[0].toLowerCase()).join('');
}

function _protoQuitarMarcas(el) {
  el.querySelectorAll('mark.proto-hl').forEach(m => m.replaceWith(document.createTextNode(m.textContent)));
  el.normalize();
}

function _protoMarcar(el, q) {
  let n = 0;
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const nodos = [];
  while (walker.nextNode()) nodos.push(walker.currentNode);
  for (const t of nodos) {
    const txt = t.nodeValue, norm = _protoNorm(txt);
    let pos = norm.indexOf(q);
    if (pos < 0) continue;
    const frag = document.createDocumentFragment();
    let ult = 0;
    while (pos >= 0) {
      frag.append(txt.slice(ult, pos));
      const m = document.createElement('mark');
      m.className = 'proto-hl';
      m.textContent = txt.slice(pos, pos + q.length);
      frag.append(m);
      n++;
      ult = pos + q.length;
      pos = norm.indexOf(q, ult);
    }
    frag.append(txt.slice(ult));
    t.replaceWith(frag);
  }
  return n;
}

function protoBuscar(input) {
  clearTimeout(input._t);
  input._t = setTimeout(() => {
    const root = input.closest('.proto');
    const q = _protoNorm(input.value.trim());
    const res = root.querySelector('.proto-res');
    const zonas = [root.querySelector('.proto-intro'), ...root.querySelectorAll('.proto-sec')].filter(Boolean);
    zonas.forEach(_protoQuitarMarcas);
    if (q.length < 2) {
      root.querySelectorAll('.proto-sec').forEach(s => { s.hidden = false; s.open = false; });
      root.querySelectorAll('.proto-chip').forEach(c => { c.hidden = false; });
      res.textContent = '';
      return;
    }
    let total = 0, apartados = 0;
    zonas.forEach(z => {
      const n = _protoMarcar(z, q);
      total += n;
      if (z.classList.contains('proto-sec')) {
        z.hidden = !n;
        z.open = !!n;
        root.querySelector(`.proto-chip:nth-child(${+z.dataset.k + 1})`).hidden = !n;
        if (n) apartados++;
      }
    });
    res.textContent = total ? `${total} ${total === 1 ? 'coincidencia' : 'coincidencias'} en ${apartados} ${apartados === 1 ? 'apartado' : 'apartados'}` : 'Sin resultados';
  }, 200);
}

// Esc cierra la vista ampliada.
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  const amp = document.querySelector('.proto.proto-ampliado .proto-btn-ampliar');
  if (amp) protoAmpliar(amp);
});
