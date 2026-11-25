// Capturas de USO-2 «Apuntar un ciclo de autoclave» (común). `node tools/capturas-ayuda/capturar.js USO-2`.
// Datos de _demo-alumno.js. No llama al servidor: las respuestas se simulan.
async (page, { app: APP, salida: SALIDA }) => {
  const fs = require('fs'), path = require('path');
  const foto = (nombre, opts = {}) => page.screenshot({ path: SALIDA + nombre, ...opts });
  const pausa = ms => page.waitForTimeout(ms);
  const limpiar = () => page.evaluate(() => {
    document.querySelectorAll('.ayuda-senal').forEach(e => e.classList.remove('ayuda-senal'));
    document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open'));
    document.querySelectorAll('.toast').forEach(t => t.remove());
  });
  await eval(fs.readFileSync(path.join(__dirname, '_demo-alumno.js'), 'utf8'))(page, APP);
  await page.evaluate(() => {
    window._hoy = new Date().toISOString().slice(0, 10);
    const ayer = new Date(); ayer.setDate(ayer.getDate() - 1); window._ayer = ayer.toISOString().slice(0, 10);
    window._ciclo = (extra) => _registroAutoclaveSbToObj({ id_registro: 'RAEJ1', id_equipo: 'AUTC-001', usuario: _demo.EMAIL, fecha: _ayer, hora_inicio: '10:05',
      programa_ciclo: '121 °C / 20 min', tipo_carga: 'Medios', indicador_biologico: 'Sí', estado: 'Abierta', correcciones: [], ...extra });
    showPage('registros-uso'); _regTab = 'autoclave'; renderRegistrosUso(); window.scrollTo(0, 0);
  });

  // 1 · Arrancar el ciclo
  await page.evaluate(() => {
    openModalSesionRegistro('autoclave', 'AUTC-001', true);
    sv('reg-sesion-hora-inicio', '10:05');
    sv('reg-campo-programa_ciclo', '121 °C / 20 min');
    sv('reg-campo-tipo_carga', 'Medios');
    document.getElementById('reg-campo-indicador_biologico').checked = true;
    document.getElementById('reg-sesion-campos').classList.add('ayuda-senal');
  });
  await pausa(400);
  await foto('01-arrancar-ciclo.png');

  // 2 · Ciclo en marcha: «Completar ciclo»
  await limpiar();
  await page.evaluate(() => {
    DATA.registrosAutoclave = [_ciclo({})];
    renderRegistrosUso(); window.scrollTo(0, 0);
    [...document.querySelectorAll('#reg-tab-autoclave button')].find(b => b.textContent.includes('Completar ciclo')).classList.add('ayuda-senal');
  });
  await pausa(300);
  await foto('02-ciclo-en-marcha.png');

  // 3 · Completar el ciclo: hora de fin, temperatura y presión máximas e indicadores
  await limpiar();
  await page.evaluate(() => {
    openModalCerrarSesion('autoclave', 0);
    sv('reg-sesion-hora-fin', '10:58');
    sv('reg-campo-temperatura_max', '121,4');
    sv('reg-campo-presion_max', '1,1');
    sv('reg-campo-cinta_indicadora', 'Viró');
    sv('reg-campo-integrador_quimico', 'Viró');
    const t = document.getElementById('reg-campo-temperatura_max').closest('.form-group');
    document.getElementById('reg-sesion-campos').classList.add('ayuda-senal');
    t.scrollIntoView({ block: 'start' });
  });
  await pausa(400);
  await foto('03-completar-ciclo.png');

  // 4 · Indicador biológico por leer, y su resultado
  await limpiar();
  await page.evaluate(() => {
    DATA.registrosAutoclave = [_ciclo({ estado: 'Cerrada', hora_fin: '10:58', temperatura_max: 121.4, presion_max: 1.1, cinta_indicadora: 'Viró', integrador_quimico: 'Viró' })];
    renderRegistrosUso();
    const b = [...document.querySelectorAll('#reg-tab-autoclave button')].find(x => x.textContent.includes('Apuntar resultado'));
    b.closest('.card').classList.add('ayuda-senal');
    b.closest('.card').scrollIntoView({ block: 'center' });
  });
  await pausa(300);
  await foto('04-biologico-por-leer.png');
  await limpiar();
  await page.evaluate(() => {
    openModalBiologico('RAEJ1');
    sv('reg-bio-resultado', 'Negativo');
    document.getElementById('reg-bio-resultado').classList.add('ayuda-senal');
  });
  await pausa(300);
  await foto('05-resultado-biologico.png');

  // 5 · Historial con el ciclo completo y el resultado del biológico
  await limpiar();
  await page.evaluate(() => {
    DATA.registrosAutoclave = [_ciclo({ estado: 'Cerrada', hora_fin: '10:58', temperatura_max: 121.4, presion_max: 1.1, cinta_indicadora: 'Viró', integrador_quimico: 'Viró',
      resultado_biologico: 'Negativo', fecha_lectura_biologico: _hoy })];
    renderRegistrosUso();
    // En el móvil la tabla se desplaza de lado: llegar a temperatura, presión e indicadores
    const card = document.querySelector('#reg-tab-autoclave tbody tr').closest('.card');
    const th = [...card.querySelectorAll('th')].find(t => t.textContent.includes('T máx'));
    card.classList.add('ayuda-senal');
    card.scrollIntoView({ block: 'center' });
    card.scrollLeft = th.offsetLeft - 12;
  });
  await pausa(300);
  await foto('06-historial.png');
  return 'ok';
}
