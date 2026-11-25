// Capturas de MAN-10 «Verificar una micropipeta en su revisión anual» (Ⓥ: alumnado y profesorado).
// `node tools/capturas-ayuda/capturar.js MAN-10` — datos de _demo-pipetas.js (apartado 11 del encargo).
async (page, { app: APP, salida: SALIDA }) => {
  const fs = require('fs'), path = require('path');
  const demo = eval(fs.readFileSync(path.join(__dirname, '_demo-pipetas.js'), 'utf8'));
  const pausa = ms => page.waitForTimeout(ms);
  const foto = (nombre, opts = {}) => page.screenshot({ path: SALIDA + nombre, ...opts });
  const fotoDe = (sel, nombre) => page.locator(sel).first().screenshot({ path: SALIDA + nombre });

  // ── Manual del alumnado (cuenta de grupo) ──────────────────────────────────
  await demo(page, APP, 'Alumno');
  // Réplicas de los casos de prueba del apartado 11.2 (A, B, E, G)
  await page.evaluate(() => {
    const rep = (ms, As) => ms.map((m, i) => ({ m, A: As ? As[i] : '' }));
    const mdC = ['1,000', '1,001', '0,999', '1,002', '1,000', '0,998', '1,001', '1,000', '1,002', '0,999'];
    window._casos = {
      A: rep(['1,001', '0,999', '1,000', '1,002'], ['0,830', '0,831', '0,829', '0,831']),
      B: rep(['1,000', '1,001', '0,999', '1,002'], ['0,395', '0,394', '0,395', '0,396']),
      B10: rep(mdC, ['0,395', '0,394', '0,395', '0,396', '0,395', '0,394', '0,395', '0,395', '0,396', '0,394']),
      E: rep(['0,997', '0,996', '0,997', '0,998']),
      G: rep(['1,000', '1,001', '0,999', '1,000'], ['0,452', '0,453', '0,452', '0,452']),
    };
    window._abrirRevision = id => {
      const plan = DATA.planesMantenimiento.find(p => p.ID_Equipo === id);
      const eq = DATA.equipos.find(e => e.ID_Activo === id);
      const periodo = getPeriodosEsperados(plan, eq, window._demo.curso)[0];
      openModalRegistrarMant(plan.ID_Plan, id, periodo, window._demo.curso);
    };
    window._senal = el => { document.querySelectorAll('.ayuda-senal').forEach(e => e.classList.remove('ayuda-senal')); if (el) el.classList.add('ayuda-senal'); };
  });

  // 1 · La revisión anual de la pipeta, con el recuadro de la verificación
  await page.evaluate(() => {
    showPage('equipos');
    window._abrirRevision('PIP-035');
    window._senal(document.querySelector('#mant-verif button'));
    document.getElementById('mant-verif').scrollIntoView({ block: 'center' });
  });
  await pausa(500);
  await foto('01-abrir-verificacion.png');

  // 2 · Abrir la verificación: cada volumen con su método y límites; elegir la sesión del día
  await page.evaluate(() => {
    window._senal(null);
    openModalVerifPipeta();
    const v = _vpEstado.ver.fases[0].volumenes;
    v.nominal = { id_sesion: 'VS-EJ1', lote_sc: '1', canales: [{ replicas: [] }] };
    _vpPintarVerif();
    window._senal(document.querySelector('#vp-ver-cuerpo .vp-volumen select'));
    document.querySelector('#vp-ver-cuerpo .vp-volumen').scrollIntoView({ block: 'start' });
  });
  await pausa(400);
  await fotoDe('#vp-ver-cuerpo .vp-volumen', '02-volumen-y-sesion.png');

  // 3 · Con colorante: masa de agua de cada tubo y absorbancia → la app calcula y dice «OK»
  await page.evaluate(() => {
    window._senal(null);
    _vpEstado.ver.fases[0].volumenes.nominal.canales[0].replicas = JSON.parse(JSON.stringify(window._casos.A));
    _vpPintarVerif();
    window._senal(document.querySelector('#vp-ver-cuerpo .vp-volumen .vp-bloque-res'));
  });
  await pausa(400);
  await fotoDe('#vp-ver-cuerpo .vp-volumen', '03-colorante-ok.png');

  // 4 · «Completar»: réplicas 5 a 10 con punta nueva
  await page.evaluate(() => {
    _vpEstado.ver.fases[0].volumenes.bajo = { id_sesion: 'VS-EJ1', lote_sc: '1', canales: [{ replicas: JSON.parse(JSON.stringify(window._casos.B)) }] };
    _vpPintarVerif();
    const vol = document.querySelectorAll('#vp-ver-cuerpo .vp-volumen')[1];
    window._senal([...vol.querySelectorAll('button')].find(b => /Hasta 10/.test(b.textContent)));
  });
  await pausa(400);
  await page.locator('#vp-ver-cuerpo .vp-volumen').nth(1).screenshot({ path: SALIDA + '04-completar.png' });

  // 5 · Resultado de la pipeta (con las 10 réplicas del volumen bajo)
  await page.evaluate(() => {
    window._senal(null);
    _vpEstado.ver.fases[0].volumenes.bajo.canales[0].replicas = JSON.parse(JSON.stringify(window._casos.B10));
    _vpPintarVerif();
    window._senal(document.getElementById('vp-ver-resultado'));
  });
  await pausa(400);
  await fotoDe('#vp-ver-resultado', '06-resultado.png');

  // 6 · De vuelta en la revisión: los pasos con 🧪 los ha marcado la app
  await page.evaluate(() => {
    window._senal(null);
    cerrarVerifPipeta();
    document.getElementById('mant-checklist').style.maxHeight = 'none';
    // Solo los pasos que marca la app (los demás, ocultos para la captura)
    document.querySelectorAll('#mant-checklist .mant-check-item:not(.mant-check-auto)').forEach(el => { el.style.display = 'none'; });
  });
  await page.setViewportSize({ width: 390, height: 1800 });
  await pausa(400);
  await fotoDe('#mant-checklist', '07-pasos-marcados.png');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => document.querySelectorAll('#mant-checklist .mant-check-item').forEach(el => { el.style.display = ''; }));

  // 7 · Por pesada (1 000 µl en la BTC-223)
  await page.evaluate(() => {
    document.querySelectorAll('.ayuda-senal').forEach(e => e.classList.remove('ayuda-senal'));
    closeModal('modal-registrar-mant');
    window._abrirRevision('PIP-047');
    openModalVerifPipeta();
    _vpEstado.ver.fases[0].volumenes.nominal = { id_sesion: 'VS-EJ1', lote_sc: '1', canales: [{ replicas: JSON.parse(JSON.stringify(window._casos.E)) }] };
    _vpPintarVerif();
  });
  await pausa(400);
  await fotoDe('#vp-ver-cuerpo .vp-volumen', '05-pesada.png');

  // ── Manual del profesorado ─────────────────────────────────────────────────
  await demo(page, APP, 'Profesor');
  await page.evaluate(() => {
    window._senal = el => { document.querySelectorAll('.ayuda-senal').forEach(e => e.classList.remove('ayuda-senal')); if (el) el.classList.add('ayuda-senal'); };
    const rep = (ms, As) => ms.map((m, i) => ({ m, A: As[i] }));
    const md = ['1,000', '1,001', '0,999', '1,002', '1,000', '0,998', '1,001', '1,000', '1,002', '0,999'];
    // 8 · Lan Technics con el error sistemático fuera y el CV dentro: la app pregunta por el tornillo
    const plan = DATA.planesMantenimiento.find(p => p.ID_Equipo === 'PIP-055');
    const eq = DATA.equipos.find(e => e.ID_Activo === 'PIP-055');
    openModalRegistrarMant(plan.ID_Plan, 'PIP-055', getPeriodosEsperados(plan, eq, window._demo.curso)[0], window._demo.curso);
    openModalVerifPipeta();
    const v = _vpEstado.ver.fases[0].volumenes;
    v.nominal = { id_sesion: 'VS-EJ1', lote_sc: '1', canales: [{ replicas: rep(md, ['0,840', '0,841', '0,839', '0,842', '0,840', '0,838', '0,841', '0,840', '0,842', '0,839']) }] };
    v.bajo = { id_sesion: 'VS-EJ1', lote_sc: '1', canales: [{ replicas: rep(['1,000', '1,001', '0,999', '1,002'], ['0,395', '0,394', '0,395', '0,396']) }] };
    _vpPintarVerif();
    window._senal(document.querySelector('#vp-ver-resultado'));
  });
  await pausa(400);
  await fotoDe('#vp-ver-resultado', '08-tornillo.png');

  // 9 · Pipeta retirada y reparada: el hilo de su incidencia pide la verificación extraordinaria
  await page.evaluate(() => {
    closeModal('modal-verif-pipeta'); closeModal('modal-registrar-mant');
    _vpRev = null; _vpEstado.ver = null;
    const eq = DATA.equipos.find(e => e.ID_Activo === 'PIP-035');
    eq.Estado_Operativo = 'Fuera de servicio';
    const hoy = window._demo.hoy;
    DATA.incidencias = [_incidenciaSbToObj({ id_incidencia: 'INC-EJ5', id_equipo: 'PIP-035', reportado_por: 'Docente de ejemplo',
      descripcion_problema: 'Verificación anual de PIP-035: RETIRAR. 200 µl: CV corregido fuera de límites.', impacto: 'Equipo fuera de servicio',
      urgencia: 'Alta', estado: 'En gestión', fecha_hora: new Date().toISOString(), intervencion_generada: 'INT-EJ5' })];
    DATA.intervenciones = [_intervencionSbToObj({ id_intervencion: 'INT-EJ5', id_equipo: 'PIP-035', tipo: 'Sustitución de pieza', estado: 'Cerrada',
      actuacion_finalizada: true, fecha_realizacion: hoy, resultado: 'Resuelto', realizado_por: 'Docente de ejemplo', descripcion_actuacion: 'Cambio de junta tórica' })];
    DATA.tareasIntervencion = [_tareaSbToObj({ id_tarea: 'TSK-EJ5', id_intervencion: 'INT-EJ5', descripcion: 'Junta tórica nueva', resultado: 'Resuelto' })];
    renderAll();
    abrirHiloIncidencia('INC-EJ5');
    const btn = [...document.querySelectorAll('#hilo-cierre button')].find(b => /verificación extraordinaria/.test(b.textContent));
    window._senal(btn?.closest('div[style*="border"]') || btn);
    document.getElementById('hilo-cierre').scrollIntoView({ block: 'end' });
  });
  await pausa(500);
  await foto('09-extra-hilo.png');

  // 10 · La verificación extraordinaria: mismo formulario, 10 réplicas sin cribado
  await page.evaluate(() => {
    window._senal(null);
    closeModal('modal-hilo-incidencia');
    vpAbrirExtraordinaria('PIP-035', 'INC-EJ5');
    _vpEstado.ver.fases[0].volumenes.nominal = { id_sesion: 'VS-EJ1', lote_sc: '1', canales: [{ replicas: [] }] };
    _vpPintarVerif();
    window._senal(document.querySelector('#vp-ver-cuerpo .vp-cabecera'));
    document.getElementById('vp-ver-cuerpo').scrollIntoView({ block: 'start' });
  });
  await pausa(400);
  await foto('10-extra-formulario.png');
  return 'ok';
}
