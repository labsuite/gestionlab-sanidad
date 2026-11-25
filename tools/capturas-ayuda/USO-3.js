// Capturas de USO-3 «Cerrar las sesiones de cabina o vitrina que se quedaron abiertas» (alumnado).
// `node tools/capturas-ayuda/capturar.js USO-3`. Datos de _demo-alumno.js + una sesión de cabina
// del grupo abierta desde hace dos días. No llama al servidor.
async (page, { app: APP, salida: SALIDA }) => {
  const fs = require('fs'), path = require('path');
  const foto = (nombre, opts = {}) => page.screenshot({ path: SALIDA + nombre, ...opts });
  const pausa = ms => page.waitForTimeout(ms);
  const limpiar = () => page.evaluate(() => {
    document.querySelectorAll('.ayuda-senal').forEach(e => e.classList.remove('ayuda-senal'));
    document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open'));
    document.querySelectorAll('.toast, #toast').forEach(t => t.remove());
  });
  await eval(fs.readFileSync(path.join(__dirname, '_demo-alumno.js'), 'utf8'))(page, APP);
  await page.evaluate(() => {
    const hace = n => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };
    DATA.registrosCabina = [
      _registroCabinaSbToObj({ id_registro: 'RCEJ1', id_equipo: 'CAB-03', usuario: _demo.EMAIL, fecha: hace(2), hora_inicio: '10:15',
        practica_tecnica: 'Siembra en agar sangre', grupo_riesgo: '2', verificacion_previa: 'Sí', desinfeccion_inicial: 'Sí', estado: 'Abierta' }),
      _registroCabinaSbToObj({ id_registro: 'RCEJ0', id_equipo: 'CAB-03', usuario: _demo.EMAIL, fecha: hace(9), hora_inicio: '09:00', hora_fin: '10:30',
        practica_tecnica: 'Tinción de Gram', grupo_riesgo: '2', verificacion_previa: 'Sí', desinfeccion_inicial: 'Sí', descontaminacion_posterior: 'Sí', estado: 'Cerrada' }),
    ];
    DATA.incidencias = [];
    renderAll();
  });

  // 1 · El aviso al entrar y el número junto a «Registros de uso»
  await page.evaluate(() => {
    showPage('dashboard'); window.scrollTo(0, 0);
    _regAvisoMostrado = false; _avisarSesionesAbiertasAntiguas(); _updateBadgeRegistrosUso();
  });
  await pausa(500);
  await foto('01-aviso-sesiones-sin-cerrar.png');
  await page.evaluate(() => {
    document.querySelectorAll('.toast, #toast').forEach(t => t.remove());
    if (typeof toggleSidebar === 'function') toggleSidebar(); else document.querySelector('.sidebar')?.classList.add('open');
    const nav = document.getElementById('badge-registros-uso')?.closest('.nav-item');
    nav?.classList.add('ayuda-senal'); nav?.scrollIntoView({ block: 'center' });
  });
  await pausa(400);
  await foto('02-menu-registros-de-uso.png');

  // 3 · Sesiones abiertas en Registros de uso
  await limpiar();
  await page.evaluate(() => {
    if (typeof toggleSidebar === 'function') toggleSidebar(); else document.querySelector('.sidebar')?.classList.remove('open');
    showPage('registros-uso'); _regTab = 'cabina'; renderRegistrosUso();
    const t = [...document.querySelectorAll('#reg-tab-cabina div')].find(d => d.textContent.trim() === 'Sesiones abiertas');
    const tarj = t.nextElementSibling;
    tarj.classList.add('ayuda-senal');
    t.scrollIntoView({ block: 'start' }); window.scrollBy(0, -90);
  });
  await pausa(300);
  await foto('03-sesiones-abiertas.png');

  // 4 · El formulario de cierre con la hora de fin cambiada y la nota en incidencias
  await limpiar();
  await page.evaluate(() => {
    const idx = DATA.registrosCabina.findIndex(r => r.ID_Registro === 'RCEJ1');
    openModalCerrarSesion('cabina', idx);
    sv('reg-sesion-hora-fin', '11:40');
    document.getElementById('reg-sesion-hora-fin').classList.add('ayuda-senal');
    sv('reg-sesion-incidencias', 'Cerrada después; hora de fin aproximada.');
    const desc = [...document.querySelectorAll('#modal-reg-sesion input[type="checkbox"]')];
    desc.forEach(c => { c.checked = true; });
  });
  await pausa(400);
  await foto('04-cerrar-con-la-hora-real.png');
  return 'ok';
}
