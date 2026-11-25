// Capturas de INC-1 «Avisar de una avería» (alumnado). `node tools/capturas-ayuda/capturar.js INC-1`.
// Datos de _demo-alumno.js (la balanza BAL-003 ya tiene un aviso abierto). No llama al servidor.
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

  // 1 · El 🚨 en la fila del equipo
  await page.evaluate(() => {
    showPage('equipos');
    const s = document.getElementById('search-equipos'); s.value = 'BAT-06'; filtrarEquipos('BAT-06');
    window.scrollTo(0, 0);
    const btn = [...document.querySelectorAll('#page-equipos tbody tr button')].find(b => b.textContent.trim() === '🚨');
    btn.classList.add('ayuda-senal');
    btn.closest('tr').scrollIntoView({ block: 'center' });
  });
  await pausa(300);
  await foto('01-boton-aviso.png');

  // 2 · La ventana del aviso: las tres opciones y una descripción con datos
  await limpiar();
  await page.evaluate(() => {
    abrirAvisoAlumno('BAT-06');
    document.querySelector('input[name="aviso-uso"][value="Equipo fuera de servicio"]').checked = true;
    sv('aviso-descripcion', 'Al encenderlo para la práctica de las 10:00, la pantalla marca «E-03» y no calienta: a los 20 min seguía a 21 °C con consigna 37 °C. Pasa desde hoy. Apagado y desenchufado; etiqueta NO USAR puesta.');
  });
  await pausa(400);
  await foto('02-ventana-del-aviso.png');

  // 3 · Equipo que ya tiene un aviso abierto: se añade a ese aviso
  await limpiar();
  await page.evaluate(() => {
    abrirAvisoAlumno('BAL-003');
    sv('aviso-descripcion', 'Hoy la pesa de 100 g marca 100,8 g después de nivelarla.');
    document.getElementById('aviso-existente-grupo').classList.add('ayuda-senal');
  });
  await pausa(400);
  await foto('03-anadir-al-aviso-abierto.png');

  // 4 · Al enviarlo: el mensaje y la tarjeta del equipo con el aviso abierto (sin servidor)
  await limpiar();
  await page.evaluate(async () => {
    abrirAvisoAlumno('BAT-06');
    document.querySelector('input[name="aviso-uso"][value="Equipo fuera de servicio"]').checked = true;
    const desc = 'Al encenderlo para la práctica de las 10:00, la pantalla marca «E-03» y no calienta. Apagado y desenchufado; etiqueta NO USAR puesta.';
    sv('aviso-descripcion', desc);
    window.callEdgeFunction = async () => ({ incidencia: { id_incidencia: 'INC-EJ2', id_equipo: 'BAT-06', reportado_por: '1º CS EJEMPLO',
      descripcion_problema: desc, impacto: 'Equipo fuera de servicio', urgencia: 'Normal', estado: 'Abierta', fecha_hora: new Date().toISOString() } });
    await guardarAvisoAlumno();
    renderEquipos();
    const s = document.getElementById('search-equipos'); s.value = 'BAT-06'; filtrarEquipos('BAT-06');
    toggleEquipoExpand('eq-expand-BAT_06');
    const av = document.querySelector('#eq-expand-BAT_06 .aviso-equipo') || document.querySelector('#page-equipos .aviso-equipo');
    av?.classList.add('ayuda-senal');
    (av || document.querySelector('#page-equipos tbody tr')).scrollIntoView({ block: 'center' });
  });
  await pausa(500);
  await foto('04-aviso-enviado.png');
  return 'ok';
}
