// Capturas de RES-1 «Saber a qué contenedor va un residuo» (común). `node tools/capturas-ayuda/capturar.js RES-1`.
// Datos de _demo-alumno.js + _demo-residuos.js. El consultorio no se usa de verdad (no llama a la IA).
async (page, { app: APP, salida: SALIDA }) => {
  const fs = require('fs'), path = require('path');
  const foto = (nombre, opts = {}) => page.screenshot({ path: SALIDA + nombre, ...opts });
  const pausa = ms => page.waitForTimeout(ms);
  const limpiar = () => page.evaluate(() => {
    document.querySelectorAll('.ayuda-senal').forEach(e => e.classList.remove('ayuda-senal'));
    document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open'));
  });
  await eval(fs.readFileSync(path.join(__dirname, '_demo-alumno.js'), 'utf8'))(page, APP);
  await eval(fs.readFileSync(path.join(__dirname, '_demo-residuos.js'), 'utf8'))(page);

  // 1 · Buscador de la guía con un resultado
  await page.evaluate(() => {
    showPage('residuos-guia'); renderResiduosGuia();
    const s = document.getElementById('res-search'); s.value = 'tinción'; filtrarGuia();
    s.classList.add('ayuda-senal');
    s.scrollIntoView({ block: 'start' }); window.scrollBy(0, -80);
  });
  await pausa(300);
  await foto('01-buscar-en-la-guia.png');

  // 2 · Asistente «¿Dónde lo tiro?» a mitad de camino
  await limpiar();
  await page.evaluate(() => {
    const s = document.getElementById('res-search'); s.value = ''; filtrarGuia();
    arbolReiniciar(); arbolResponder('inicio', 4);   // «Un líquido»
    const a = document.getElementById('arbol-residuos').closest('.card');
    a.classList.add('ayuda-senal'); a.scrollIntoView({ block: 'start' }); window.scrollBy(0, -80);
  });
  await pausa(300);
  await foto('02-asistente.png');

  // 3 · Asistente en un resultado, con los contenedores de ese tipo
  await limpiar();
  await page.evaluate(() => {
    arbolReiniciar(); arbolResponder('inicio', 2); arbolResponder('biologico', 1);   // biológico → bolsa de autoclave
    const a = document.getElementById('arbol-residuos').closest('.card');
    a.classList.add('ayuda-senal'); a.scrollIntoView({ block: 'start' }); window.scrollBy(0, -80);
  });
  await pausa(300);
  await foto('03-asistente-resultado.png');

  // 4 · Normas generales del gestor, desplegadas
  await limpiar();
  await page.evaluate(() => {
    arbolReiniciar();
    const d = [...document.querySelectorAll('#page-residuos-guia details')].find(x => /Normas generales/.test(x.textContent));
    d.open = true; d.classList.add('ayuda-senal'); d.scrollIntoView({ block: 'start' }); window.scrollBy(0, -80);
  });
  await pausa(300);
  await foto('04-normas-del-gestor.png');

  // 5 · Consultorio con el laboratorio elegido
  await limpiar();
  await page.evaluate(() => {
    window.scrollTo(0, 0);
    abrirChatResiduo();
    document.getElementById('chat-res-lab').classList.add('ayuda-senal');
  });
  await pausa(400);
  await foto('05-consultorio.png');

  // 6 · Avisar a la gestora
  await limpiar();
  await page.evaluate(() => {
    openModalConsultaResiduo();
    sv('consulta-descripcion', 'Reactivo caducado de una práctica de bioquímica: no aparece en la guía.');
    sv('consulta-ubicacion', 'Lab 205, zona de residuos pendientes, cerrado y rotulado');
  });
  await pausa(400);
  await foto('06-avisar-a-la-gestora.png');
  return 'ok';
}
