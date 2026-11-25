// Capturas de USO-1 «Apuntar un uso de la cabina o de la vitrina» (común). `node tools/capturas-ayuda/capturar.js USO-1`.
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
    const hoy = new Date().toISOString().slice(0, 10);
    const hace = n => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };
    DATA.registrosCabina = [_registroCabinaSbToObj({ id_registro: 'RCEJ0', id_equipo: 'CAB-03', usuario: _demo.EMAIL, fecha: hace(7), hora_inicio: '09:00', hora_fin: '10:30',
      practica_tecnica: 'Tinción de Gram', grupo_riesgo: '2', verificacion_previa: 'Sí', desinfeccion_inicial: 'Sí', descontaminacion_posterior: 'Sí', estado: 'Cerrada' })];
    window._hoy = hoy;
  });

  // 1 · Empezar la sesión
  await page.evaluate(() => {
    showPage('registros-uso'); _regTab = 'cabina'; renderRegistrosUso(); window.scrollTo(0, 0);
    [...document.querySelectorAll('#reg-tab-cabina button')].find(b => b.textContent.includes('Empezar sesión')).classList.add('ayuda-senal');
  });
  await pausa(300);
  await foto('01-empezar-sesion.png');

  // 2 · Sesión empezada (con «Deshacer» unos segundos)
  await limpiar();
  await page.evaluate(async () => {
    window.callEdgeFunction = async () => ({ registro: { id_registro: 'RCEJ1', id_equipo: 'CAB-03', usuario: _demo.EMAIL, fecha: _hoy, hora_inicio: '10:15', estado: 'Abierta', correcciones: [] } });
    await _iniciarSesionRapida('cabina', 'CAB-03');
    window.scrollTo(0, 0);
    [...document.querySelectorAll('#reg-tab-cabina button')].find(b => b.textContent.includes('Terminar mi sesión')).classList.add('ayuda-senal');
  });
  await pausa(300);
  await foto('02-sesion-empezada.png');

  // 3 · Terminar la sesión de la cabina
  await limpiar();
  await page.evaluate(() => {
    const idx = DATA.registrosCabina.findIndex(r => r.Estado === 'Abierta');
    openModalCerrarSesion('cabina', idx);
    sv('reg-sesion-hora-fin', '11:40');
    sv('reg-campo-practica_tecnica', 'Siembra en agar sangre');
    sv('reg-campo-grupo_riesgo', '2');
    sv('reg-campo-minutos_uv', '15');
    ['verificacion_previa', 'desinfeccion_inicial', 'descontaminacion_posterior'].forEach(c => { document.getElementById('reg-campo-' + c).checked = true; });
    document.getElementById('reg-sesion-campos').classList.add('ayuda-senal');
    document.getElementById('reg-sesion-campos').scrollIntoView({ block: 'start' });
  });
  await pausa(400);
  await foto('03-terminar-cabina.png');

  // 4 · Terminar la sesión de la vitrina
  await limpiar();
  await page.evaluate(() => {
    DATA.registrosVitrina = [_registroVitrinaSbToObj({ id_registro: 'RVEJ1', id_equipo: 'CAB-01', usuario: _demo.EMAIL, fecha: _hoy, hora_inicio: '12:00', estado: 'Abierta' })];
    _regTab = 'vitrina'; renderRegistrosUso();
    openModalCerrarSesion('vitrina', 0);
    sv('reg-sesion-hora-fin', '12:45');
    sv('reg-campo-practica_tecnica', 'Preparación de una disolución de HCl 1 M');
    sv('reg-campo-productos_quimicos', 'Ácido clorhídrico 37 %');
    ['verificacion_previa', 'limpieza_posterior'].forEach(c => { document.getElementById('reg-campo-' + c).checked = true; });
    document.getElementById('reg-sesion-campos').classList.add('ayuda-senal');
    document.getElementById('reg-sesion-campos').scrollIntoView({ block: 'start' });
  });
  await pausa(400);
  await foto('04-terminar-vitrina.png');

  // 5 · Historial de la cabina con la sesión cerrada
  await limpiar();
  await page.evaluate(() => {
    const i = DATA.registrosCabina.findIndex(r => r.ID_Registro === 'RCEJ1');
    DATA.registrosCabina[i] = _registroCabinaSbToObj({ id_registro: 'RCEJ1', id_equipo: 'CAB-03', usuario: _demo.EMAIL, fecha: _hoy, hora_inicio: '10:15', hora_fin: '11:40',
      practica_tecnica: 'Siembra en agar sangre', grupo_riesgo: '2', minutos_uv: 15, verificacion_previa: 'Sí', desinfeccion_inicial: 'Sí', descontaminacion_posterior: 'Sí', estado: 'Cerrada' });
    _regTab = 'cabina'; renderRegistrosUso();
    // En el móvil la tabla se desplaza de lado: llegar a lo que se ha apuntado
    const card = document.querySelector('#reg-tab-cabina tbody tr').closest('.card');
    const th = [...card.querySelectorAll('th')].find(t => t.textContent.includes('Práctica'));
    card.classList.add('ayuda-senal');
    card.scrollIntoView({ block: 'center' });
    card.scrollLeft = th.offsetLeft - 12;
  });
  await pausa(300);
  await foto('05-historial.png');
  return 'ok';
}
