// Capturas de STO-1 «Encontrar un material y ver cuánto hay y dónde» (común a todos los roles).
// `node tools/capturas-ayuda/capturar.js STO-1` — ver README.md. Datos de _demo-alumno.js.
async (page, { app: APP, salida: SALIDA }) => {
  const fs = require('fs'), path = require('path');
  const foto = (nombre, opts = {}) => page.screenshot({ path: SALIDA + nombre, ...opts });
  const pausa = ms => page.waitForTimeout(ms);
  const limpiar = () => page.evaluate(() => document.querySelectorAll('.ayuda-senal').forEach(e => e.classList.remove('ayuda-senal')));
  await eval(fs.readFileSync(path.join(__dirname, '_demo-alumno.js'), 'utf8'))(page, APP);

  // 1 · El buscador con un material encontrado
  await page.evaluate(() => {
    showPage('material'); window.scrollTo(0, 0);
    const s = document.getElementById('search-material'); s.value = 'puntas'; filtrarMaterial('puntas');
    s.closest('.search-input').classList.add('ayuda-senal');
    document.querySelector('#tabla-material tr.equipo-row').classList.add('ayuda-senal');
  });
  await pausa(300);
  await foto('01-buscar-material.png');

  // 2 · La barra de stock: verde, ámbar y rojo
  await limpiar();
  await page.evaluate(() => {
    const s = document.getElementById('search-material'); s.value = ''; filtrarMaterial('');
    document.querySelectorAll('#tabla-material tr.equipo-row .stock-bar-wrap').forEach(b => b.classList.add('ayuda-senal'));
    document.querySelector('#tabla-material tr.equipo-row').scrollIntoView({ block: 'start' });
    window.scrollBy(0, -70);
  });
  await pausa(300);
  await foto('02-barra-de-stock.png');

  // 3 · El material desplegado: cada bote y la línea de antigüedad
  await limpiar();
  await page.evaluate(() => {
    const s = document.getElementById('search-material'); s.value = 'puntas'; filtrarMaterial('puntas');
    document.querySelector('#tabla-material tr.equipo-row').click();
  });
  await pausa(300);
  await page.evaluate(() => {
    document.querySelectorAll('#tabla-material tr.mat-ubic-row[id^="mat-ubic-"] td:nth-child(2)').forEach(td => td.classList.add('ayuda-senal'));
    document.querySelector('#tabla-material tr[id^="mat-antig-"] td:nth-child(2)')?.classList.add('ayuda-senal');
    document.querySelector('#tabla-material tr.equipo-row').scrollIntoView({ block: 'start' });
    window.scrollBy(0, -70);
  });
  await pausa(300);
  await foto('03-material-desplegado.png');
  return 'ok';
}
