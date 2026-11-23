// Capturas de la tarea MAN-2 (versión alumnado) para la Ayuda — ver README.md de esta carpeta.
// Lo ejecuta tools/capturas-ayuda/capturar.js: `node tools/capturas-ayuda/capturar.js MAN-2`.
// Carga la app SIN sesión, le mete datos de ejemplo (cuenta de grupo ficticia, sin nombres
// reales) y monta cada pantalla del recorrido. No llama al servidor: nada se guarda.
async (page, { app: APP, salida: SALIDA }) => {
  await page.goto(APP + '?capturas=' + Date.now());
  await page.waitForFunction(() => document.getElementById('modal-registrar-mant') && typeof renderAyuda === 'function', null, { timeout: 30000 });

  // ── Datos de ejemplo ────────────────────────────────────────────
  await page.evaluate(() => {
    const PLAN = 'PDEMO01';
    // Todo vacío salvo lo que hace falta (lo que normalmente rellena loadAllData).
    'adicionesResiduo cajasCongelado ciclosModulos configReservas consultasResiduo contenedoresResiduo documentosProveedor equipos evaluacionesCurso excepcionesResiduoIa fichasAtributos historicoPrecio incidencias intervenciones lineasPedido material materialUbicaciones movimientos muestrasCongeladas pedidos planesMantenimiento propuestasMaterial propuestasUbicacion proveedores registroMantenimientos registrosAutoclave registrosCabina registrosVitrina reservas revisionesInventario sbUsuarios solicitudes tareas tareasIntervencion tiposResiduo ubicaciones userModulos usosMuestra usuarios'
      .split(' ').forEach(k => { DATA[k] = []; });
    currentUser = { email: '1cslcb@gestionlab.cma', name: '1º CS LCB' };
    DATA.usuarios = [{ ID_Usuario: 'USR-DEMO', Nombre: '1º CS LCB', Email: '1cslcb@gestionlab.cma', Rol: 'Alumno', Activo: 'TRUE', Ubicaciones_Asignadas: 'Lab 205' }];
    const eq = (id, tipo, marca, modelo, ubic) => _equipoSbToObj({ id_activo: id, tipo_equipo: tipo, marca, modelo, ubicacion: ubic, estado_operativo: 'Operativo' });
    DATA.equipos = [
      eq('BAT-06', 'Baño termostático', 'J.P. Selecta', 'Precisterm', 'Lab 205'),
      eq('BAT-01', 'Baño termostático', 'J.P. Selecta', '', 'Lab 203'),
      eq('BAL-003', 'Balanza', 'Phoenix Instrument', 'BTC-223', '205-ZC'),
    ];
    // Plan real del BAT-06 (los planes no llevan datos personales): una comprobación,
    // un paso normal y otra comprobación.
    DATA.planesMantenimiento = [_planMantenimientoSbToObj({
      id_plan: PLAN, id_equipo: 'BAT-06', tipo_intervencion: 'Interno', periodicidad: 'Trimestral',
      operacion: 'Descalcificación preventiva', activo: true, solo_profesorado: false,
      instrucciones: 'Prueba rápida (6.1): display frente a termómetro de referencia, homogeneidad, nivel, cal, cable (criterio: Δ ≤ 1 °C (≤ 0,5 °C en 37 °C); cubeta sin cal)\nDescalcificación preventiva de cubeta y calefactor (vinagre o HCl 10 %) si el agua es de red\nReposición del carbonato de sodio al cambiar el agua (criterio: Calefactor sin cal)',
    })];
    const curso = getCursoAcademico();
    const [a1, a2] = curso.split('-');
    DATA.evaluacionesCurso = [
      [1, `${a1}-09-01`, `${a1}-12-04`], [2, `${a1}-12-05`, `${a2}-03-05`], [3, `${a2}-03-06`, `${a2}-06-04`],
    ].map(([numero, fecha_inicio, fecha_fin]) => _evaluacionCursoSbToObj({ curso_academico: curso, numero, fecha_inicio, fecha_fin }));
    DATA.registroMantenimientos = [];
    document.getElementById('auth-screen').style.display = 'none';
    showApp();
    renderAll();
    // Señal de «aquí se pulsa»
    const st = document.createElement('style');
    st.textContent = '.ayuda-senal{outline:3px solid #e8590c !important;outline-offset:2px;border-radius:8px;box-shadow:0 0 0 6px rgba(232,89,12,.18) !important}';
    document.head.appendChild(st);
    window._demo = { PLAN, curso };
  });

  const senal = (sel) => page.evaluate((s) => {
    document.querySelectorAll('.ayuda-senal').forEach(e => e.classList.remove('ayuda-senal'));
    const el = typeof s === 'string' ? document.querySelector(s) : null;
    if (el) el.classList.add('ayuda-senal');
  }, sel);
  const foto = (nombre, opts = {}) => page.screenshot({ path: SALIDA + nombre, ...opts });
  const pausa = (ms) => page.waitForTimeout(ms);

  // 1 · Inventario con el código en el buscador
  await page.evaluate(() => {
    showPage('equipos');
    const s = document.getElementById('search-equipos');
    s.value = 'BAT-06'; filtrarEquipos('BAT-06');
    window.scrollTo(0, 0);
  });
  await page.evaluate(() => {
    document.querySelector('#search-equipos').closest('.search-input').classList.add('ayuda-senal');
    document.querySelector('#page-equipos tbody tr').classList.add('ayuda-senal');
  });
  await pausa(300);
  await foto('01-buscar-equipo.png');

  // 2 · Tarjeta desplegada: plan de mantenimiento y «Registrar»
  await page.evaluate(() => {
    document.querySelectorAll('.ayuda-senal').forEach(e => e.classList.remove('ayuda-senal'));
    toggleEquipoExpand('eq-expand-BAT_06');
    const fila = [...document.querySelectorAll('#eq-expand-BAT_06 .mant-plan-row')][0];
    const btn = [...fila.querySelectorAll('button')].find(b => b.textContent.trim().startsWith('Registrar'));
    btn.classList.add('ayuda-senal');
    fila.scrollIntoView({ block: 'center' });
  });
  await pausa(300);
  await foto('02-plan-del-equipo.png');

  // 3 · Ventana «Ejecutar mantenimiento»: comprobar equipo, operación y periodo
  await page.evaluate(() => {
    document.querySelectorAll('.ayuda-senal').forEach(e => e.classList.remove('ayuda-senal'));
    const fila = [...document.querySelectorAll('#eq-expand-BAT_06 .mant-plan-row')][0];
    [...fila.querySelectorAll('button')].find(b => b.textContent.trim().startsWith('Registrar')).click();
  });
  await pausa(500);
  await senal('#mant-info-plan > div');
  await foto('03-comprobar-equipo.png');

  // 4 · Comprobación con calculadora: se teclean equipo y referencia, la app dice si cumple;
  //     lo que el criterio tiene de visual («cubeta sin cal») lo marca la persona.
  await page.evaluate(() => {
    document.querySelectorAll('.ayuda-senal').forEach(e => e.classList.remove('ayuda-senal'));
    const paso = document.querySelector('#mant-checklist [data-idx="0"]');
    const pon = (k, v) => { const inp = paso.querySelector(`.mant-calc input[data-k="${k}"]`); if (inp) { inp.value = v; inp.dispatchEvent(new Event('input')); } };
    pon('equipo', '37,0'); pon('referencia', '36,8');
    _mantMarcarCriterio(0, 'cumple');
    paso.querySelector('.mant-btn-cumple').classList.add('ayuda-senal');
    paso.querySelector('.mant-calc').classList.add('ayuda-senal');
    document.getElementById('mant-checklist').style.maxHeight = 'none';
  });
  await pausa(300);
  await page.locator('#mant-checklist [data-idx="0"]').screenshot({ path: SALIDA + '04-comprobacion-con-calculadora.png' });

  // 5 · Paso normal marcado y comprobación que no cumple, con lo que se ha visto
  await page.evaluate(() => {
    document.querySelectorAll('.ayuda-senal').forEach(e => e.classList.remove('ayuda-senal'));
    const cb = document.querySelector('#mant-checklist [data-idx="1"] input'); cb.checked = true; _mantPasoHecho(1, true);
    _mantMarcarCriterio(2, 'no_cumple');
    const ta = document.querySelector('#mant-checklist [data-idx="2"] textarea');
    ta.value = 'Lectura: restos blancos de cal en el calefactor después de descalcificar; criterio: calefactor sin cal; condiciones: baño vacío y frío.';
    _mantNotaCriterio(2, ta.value); ta.blur();
    ta.style.height = ta.scrollHeight + 4 + 'px';
    document.querySelector('#mant-checklist [data-idx="2"] .mant-btn-nocumple').classList.add('ayuda-senal');
  });
  await pausa(300);
  await page.locator('#mant-checklist [data-idx="2"]').screenshot({ path: SALIDA + '05-no-cumple.png' });

  // 6 · Observaciones y «Finalizar»
  await page.evaluate(() => {
    document.querySelectorAll('.ayuda-senal').forEach(e => e.classList.remove('ayuda-senal'));
    document.getElementById('mant-observaciones').value = 'Agua de red. Descalcificado con vinagre.';
    document.getElementById('mant-btn-principal').classList.add('ayuda-senal');
    document.getElementById('mant-btn-principal').scrollIntoView({ block: 'end' });
  });
  await pausa(300);
  await foto('06-observaciones-y-finalizar.png');

  // 7 · Aviso de avería que se abre al finalizar con un «no cumple»
  await page.evaluate(() => {
    document.querySelectorAll('.ayuda-senal').forEach(e => e.classList.remove('ayuda-senal'));
    const pasos = _leerChecklist();
    const periodo = getPeriodosEsperados(DATA.planesMantenimiento[0], DATA.equipos[0], window._demo.curso)[0];
    window._demo.periodo = periodo;
    closeModal('modal-registrar-mant');
    _ofrecerAvisoNoCumple('BAT-06', window._demo.PLAN, periodo, pasos.filter(p => p.resultado === 'no_cumple'));
  });
  await pausa(900);
  await page.evaluate(() => {
    document.querySelectorAll('.toast, #toast').forEach(t => { t.style.display = 'none'; });
    const btn = [...document.querySelectorAll('#modal-aviso-alumno button')].find(b => /Enviar aviso/.test(b.textContent));
    if (btn) btn.classList.add('ayuda-senal');
    document.querySelector('input[name="aviso-uso"]')?.closest('.form-group')?.classList.add('ayuda-senal');
  });
  await pausa(300);
  await foto('07-aviso-de-averia.png');

  // 8 · Comprobación: la tarjeta del equipo dice «⏳ Espera visto bueno»
  await page.evaluate(() => {
    document.querySelectorAll('.ayuda-senal').forEach(e => e.classList.remove('ayuda-senal'));
    closeModal('modal-aviso-alumno');
    const hoy = new Date().toISOString().slice(0, 10);
    DATA.registroMantenimientos = [_registroMantSbToObj({
      id_registro: 'RMDEMO1', id_plan: window._demo.PLAN, id_equipo: 'BAT-06', curso_academico: window._demo.curso,
      periodo: window._demo.periodo, fecha_realizacion: hoy, realizado_por: '1º CS LCB', estado: 'pendiente_vb', pasos: _leerChecklist(),
    })];
    renderEquipos('BAT-06');
    toggleEquipoExpand('eq-expand-BAT_06');
    const fila = document.querySelector('#eq-expand-BAT_06 .mant-plan-row');
    [...fila.querySelectorAll('.badge')].find(b => /visto bueno/.test(b.textContent))?.classList.add('ayuda-senal');
    fila.scrollIntoView({ block: 'center' });
  });
  await pausa(300);
  await foto('08-espera-visto-bueno.png');

  return 'ok';
}
