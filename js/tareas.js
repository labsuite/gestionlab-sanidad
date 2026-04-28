// ============================================================
// TAREAS PERSONALES — DASHBOARD
// Solo visible para roles con verTareas: true (Profesor, Gestor, Admin)
// Columnas Tareas_Usuario: ID_Tarea | Email | Texto | Fecha_Limite | Completada | Fecha_Creacion
// ============================================================

let _mostrarCompletadas = false;

function renderTareas() {
  const cont = document.getElementById('tareas-container');
  if (!cont || !puedeHacer('verTareas')) { if (cont) cont.innerHTML = ''; return; }

  const email   = (currentUser?.email || '').toLowerCase();
  const misTareas = DATA.tareas.filter(t => (t.Email || '').toLowerCase() === email);
  const pending   = misTareas.filter(t => (t.Completada || '').toLowerCase() !== 'true').sort(_sortTareas);
  const done      = misTareas.filter(t => (t.Completada || '').toLowerCase() === 'true').sort(_sortTareas);

  cont.innerHTML = `
    <div class="card">
      <div class="card-header">
        <div class="card-title">📝 Mis tareas</div>
        <div class="card-actions">
          ${done.length ? `<button class="btn btn-secondary" style="font-size:12px;padding:4px 10px" onclick="_toggleCompletadas()">
            ${_mostrarCompletadas ? 'Ocultar' : 'Ver'} completadas (${done.length})
          </button>` : ''}
          <button class="btn btn-primary" style="font-size:12px;padding:4px 10px" onclick="_mostrarFormTarea()">+ Nueva</button>
        </div>
      </div>
      <div style="padding:0 20px 4px">

        <!-- Formulario nueva tarea (oculto por defecto) -->
        <div id="tarea-form" style="display:none;margin:12px 0;padding:12px;background:var(--bg);border-radius:var(--radius-sm);border:1px solid var(--border)">
          <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end">
            <div style="flex:2 1 200px">
              <label style="font-size:11px;color:var(--text-muted);font-weight:600;display:block;margin-bottom:4px">Tarea</label>
              <input id="tarea-texto" type="text" placeholder="Describe la tarea..."
                style="width:100%;padding:7px 10px;border:1px solid var(--border);border-radius:var(--radius-sm);font-size:13px"
                onkeydown="if(event.key==='Enter')_guardarTarea()">
            </div>
            <div style="flex:0 1 150px">
              <label style="font-size:11px;color:var(--text-muted);font-weight:600;display:block;margin-bottom:4px">Fecha límite</label>
              <input id="tarea-fecha" type="date"
                style="width:100%;padding:7px 10px;border:1px solid var(--border);border-radius:var(--radius-sm);font-size:13px">
            </div>
            <div style="display:flex;gap:6px;flex:0 0 auto">
              <button class="btn btn-primary" style="font-size:12px;padding:6px 14px" onclick="_guardarTarea()">Añadir</button>
              <button class="btn btn-secondary" style="font-size:12px;padding:6px 10px" onclick="_ocultarFormTarea()">✕</button>
            </div>
          </div>
        </div>

        <!-- Lista tareas pendientes -->
        ${pending.length === 0 && !(_mostrarCompletadas && done.length) ?
          `<div style="padding:20px 0;text-align:center;color:var(--text-muted);font-size:13px">
            ${done.length ? 'Todas las tareas completadas' : 'Sin tareas pendientes'} · ¡Todo al día! 🎉
          </div>` : ''}
        ${pending.map(t => _renderTarea(t)).join('')}

        <!-- Separador y tareas completadas -->
        ${_mostrarCompletadas && done.length ? `
          <div style="margin:10px 0 6px;font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em">
            Completadas
          </div>
          ${done.map(t => _renderTarea(t)).join('')}
        ` : ''}

      </div>
      <div style="height:8px"></div>
    </div>`;
}

function _renderTarea(t) {
  const completada = (t.Completada || '').toLowerCase() === 'true';
  const fechaColor = _colorFecha(t.Fecha_Limite, completada);
  const fechaTexto = t.Fecha_Limite ? _formatFecha(t.Fecha_Limite) : '';
  const textoStyle = completada ? 'text-decoration:line-through;color:var(--text-muted)' : '';

  return `<div style="display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid var(--border)" id="tarea-row-${t.ID_Tarea}">
    <input type="checkbox" ${completada ? 'checked' : ''}
      style="width:16px;height:16px;cursor:pointer;accent-color:var(--accent);flex-shrink:0"
      onchange="_toggleTarea('${t.ID_Tarea}',this.checked)">
    <span style="flex:1;font-size:13px;${textoStyle}">${_esc(t.Texto)}</span>
    ${fechaTexto ? `<span style="font-size:11px;font-weight:500;padding:2px 7px;border-radius:10px;white-space:nowrap;${fechaColor}">${fechaTexto}</span>` : ''}
    <button class="icon-btn" title="Eliminar" onclick="_eliminarTarea('${t.ID_Tarea}')"
      style="font-size:13px;opacity:0.4;flex-shrink:0" onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=0.4">🗑</button>
  </div>`;
}

// ── Helpers ──────────────────────────────────────────────────

function _sortTareas(a, b) {
  if (!a.Fecha_Limite && !b.Fecha_Limite) return 0;
  if (!a.Fecha_Limite) return 1;
  if (!b.Fecha_Limite) return -1;
  return new Date(a.Fecha_Limite) - new Date(b.Fecha_Limite);
}

function _colorFecha(fecha, completada) {
  if (!fecha || completada) return 'background:#f5f5f5;color:var(--text-muted)';
  const diff = (new Date(fecha) - new Date()) / 86400000;
  if (diff < 0)  return 'background:#fde8e8;color:var(--danger)';
  if (diff < 2)  return 'background:#fff3e0;color:#e65c00';
  return 'background:#eaf4ed;color:var(--success)';
}

function _formatFecha(iso) {
  try {
    const d = new Date(iso + 'T12:00:00');
    const diff = Math.round((d - new Date()) / 86400000);
    if (diff === 0)  return 'Hoy';
    if (diff === 1)  return 'Mañana';
    if (diff === -1) return 'Ayer';
    if (diff < 0)   return `Vencida hace ${Math.abs(diff)}d`;
    return d.toLocaleDateString('es-ES', { day:'numeric', month:'short' });
  } catch { return iso; }
}

function _esc(str) {
  return (str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function _mostrarFormTarea() {
  document.getElementById('tarea-form').style.display = '';
  setTimeout(() => document.getElementById('tarea-texto')?.focus(), 50);
}

function _ocultarFormTarea() {
  document.getElementById('tarea-form').style.display = 'none';
  document.getElementById('tarea-texto').value = '';
  document.getElementById('tarea-fecha').value = '';
}

function _toggleCompletadas() {
  _mostrarCompletadas = !_mostrarCompletadas;
  renderTareas();
}

// ── CRUD ─────────────────────────────────────────────────────

async function _guardarTarea() {
  const texto = (document.getElementById('tarea-texto')?.value || '').trim();
  if (!texto) { document.getElementById('tarea-texto')?.focus(); return; }
  const fecha   = document.getElementById('tarea-fecha')?.value || '';
  const email   = (currentUser?.email || '').toLowerCase();
  const id      = genId('TAR-');
  const hoy     = new Date().toISOString().split('T')[0];
  const row     = [id, email, texto, fecha, 'false', hoy];

  showLoading('Guardando tarea...');
  try {
    await sheetsAppend('Tareas_Usuario', row);
    DATA.tareas.push(rowToObj(row, 'tareas'));
    _ocultarFormTarea();
    renderTareas();
  } catch(e) { showToast('Error guardando tarea', 'error'); console.error(e); }
  hideLoading();
}

async function _toggleTarea(id, completada) {
  const idx = DATA.tareas.findIndex(t => t.ID_Tarea === id);
  if (idx === -1) return;
  const fila = idx + 2;
  try {
    await sheetsUpdate(`Tareas_Usuario!E${fila}`, [String(completada)]);
    DATA.tareas[idx].Completada = String(completada);
    renderTareas();
  } catch(e) {
    showToast('Error actualizando tarea', 'error');
    // Revertir checkbox visualmente
    const cb = document.querySelector(`#tarea-row-${id} input[type=checkbox]`);
    if (cb) cb.checked = !completada;
    console.error(e);
  }
}

async function _eliminarTarea(id) {
  const idx = DATA.tareas.findIndex(t => t.ID_Tarea === id);
  if (idx === -1) return;
  const fila = idx + 2;
  showLoading('Eliminando...');
  try {
    await sheetsUpdate(`Tareas_Usuario!A${fila}:F${fila}`, ['','','','','','']);
    DATA.tareas.splice(idx, 1);
    renderTareas();
  } catch(e) { showToast('Error eliminando tarea', 'error'); console.error(e); }
  hideLoading();
}
