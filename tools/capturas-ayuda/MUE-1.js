// Capturas de MUE-1 «Encontrar una muestra congelada» (común). `node tools/capturas-ayuda/capturar.js MUE-1`.
// Datos de _demo-alumno.js + _demo-congelados.js. No llama al servidor.
async (page, { app: APP, salida: SALIDA }) => {
  const fs = require('fs'), path = require('path');
  const foto = (nombre, opts = {}) => page.screenshot({ path: SALIDA + nombre, ...opts });
  const pausa = ms => page.waitForTimeout(ms);
  const limpiar = () => page.evaluate(() => document.querySelectorAll('.ayuda-senal').forEach(e => e.classList.remove('ayuda-senal')));
  await eval(fs.readFileSync(path.join(__dirname, '_demo-alumno.js'), 'utf8'))(page, APP);
  await eval(fs.readFileSync(path.join(__dirname, '_demo-congelados.js'), 'utf8'))(page);

  // 1 · El buscador con resultados
  await page.evaluate(() => {
    showPage('congelados'); _congBusqueda = ''; _congCajaAbierta = ''; _congMuestraSel = ''; renderCongelados();
    const i = document.getElementById('cong-busqueda'); i.value = 'coli'; _congBuscar('coli');
    document.getElementById('cong-busqueda').classList.add('ayuda-senal');
    window.scrollTo(0, 0);
  });
  await pausa(400);
  await foto('01-buscador.png');

  // 2 · La caja abierta con el tubo elegido
  await limpiar();
  await page.evaluate(() => {
    _congBusqueda = ''; document.getElementById('cong-busqueda').value = '';
    _congCajaAbierta = 'CAJEJ1'; _congMuestraSel = 'MEJ3'; renderCongelados();
    const sel = document.querySelector('#cong-cuerpo .cong-casilla.sel, #cong-cuerpo [class*="sel"]');
    const caja = document.querySelector('#cong-cuerpo .cong-grid, #cong-cuerpo table, #cong-cuerpo .cong-caja');
    (caja || sel)?.classList.add('ayuda-senal');
    (caja || sel)?.scrollIntoView({ block: 'start' }); window.scrollBy(0, -90);
  });
  await pausa(400);
  await foto('02-caja-abierta.png');

  // 3 · La ficha de la cepa: queda, pase y procedencia
  await limpiar();
  await page.evaluate(() => {
    const f = document.getElementById('cong-ficha');
    f.classList.add('ayuda-senal'); f.scrollIntoView({ block: 'start' }); window.scrollBy(0, -90);
  });
  await pausa(400);
  await foto('03-ficha-de-la-cepa.png');
  return 'ok';
}
