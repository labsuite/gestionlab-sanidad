// Capturas de EMP-6 «Usar GestionLab en el móvil: instalarla y leer las etiquetas NFC/QR»
// (común a todos los roles). `node tools/capturas-ayuda/capturar.js EMP-6` — ver README.md.
// Lo que abre cada etiqueta se monta llamando a la misma función que usa la URL de la
// etiqueta, con datos de ejemplo; donde la etiqueta guardaría algo (empezar la sesión de la
// cabina) se pinta el resultado sin llamar al servidor.
async (page, { app: APP, salida: SALIDA }) => {
  const fs = require('fs'), path = require('path');
  const foto = (nombre, opts = {}) => page.screenshot({ path: SALIDA + nombre, ...opts });
  const pausa = ms => page.waitForTimeout(ms);
  const cerrarTodo = () => page.evaluate(() => {
    document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open'));
    document.querySelectorAll('.toast, #toast').forEach(t => { t.style.display = 'none'; });
    document.querySelectorAll('.ayuda-senal').forEach(e => e.classList.remove('ayuda-senal'));
  });

  await eval(fs.readFileSync(path.join(__dirname, '_demo-alumno.js'), 'utf8'))(page, APP);

  // 1 · Cabina: la primera lectura empieza la sesión (resultado pintado sin servidor)
  await page.evaluate(() => {
    const ahora = new Date();
    const hora = String(ahora.getHours()).padStart(2, '0') + ':' + String(ahora.getMinutes()).padStart(2, '0');
    DATA.registrosCabina.push(_registroCabinaSbToObj({ id_registro: 'RCEJ1', id_equipo: 'CAB-03', usuario: window._demo.EMAIL,
      fecha: ahora.toISOString().slice(0, 10), hora_inicio: hora, estado: 'Abierta' }));
    _regTab = 'cabina';
    showPage('registros-uso');
    renderRegistrosUso();
    window.scrollTo(0, 0);
    mostrarToastConAccion(`Sesión iniciada a las ${hora} ✓ — vuelve aquí (o escanea de nuevo) para terminarla`, 'Deshacer', () => {}, 60000);
  });
  await pausa(500);
  await foto('01-cabina-sesion-empezada.png');

  // 2 · Autoclave: el registro del ciclo con el autoclave ya elegido
  await cerrarTodo();
  await page.evaluate(() => _abrirRegistroPorNfc('autoclave', 'AUTC-001'));
  await pausa(500);
  await foto('02-autoclave-registro.png');

  // 3 · Caja de muestras
  await cerrarTodo();
  await page.evaluate(() => { _abrirCongeladosPorNfc('CAJEJ1', null); window.scrollTo(0, 0); });
  await pausa(500);
  await foto('03-caja-de-muestras.png');

  // 4 · Armario: «¿Qué te llevas?»
  await cerrarTodo();
  // Al leer la etiqueta de verdad, la app entra por el Panel principal y abre la ventana encima.
  await page.evaluate(() => { showPage('dashboard'); window.scrollTo(0, 0); openModalTransferenciaArmario('205-ZC-1.1'); });
  await pausa(500);
  await foto('04-armario-que-te-llevas.png');

  // 5 · Contenedor de residuos: «Añadir residuo»
  await cerrarTodo();
  await page.evaluate(() => _abrirAdicionPorNfc('Biosanitario', '205'));
  await pausa(600);
  await page.evaluate(() => document.querySelectorAll('.toast, #toast').forEach(t => { t.style.display = 'none'; }));
  await foto('05-contenedor-anadir-residuo.png');
  return 'ok';
}
