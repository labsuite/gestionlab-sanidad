// Capturas de STO-3 «Llevar material de un sitio a otro (y apuntarlo)» (común a todos los roles).
// `node tools/capturas-ayuda/capturar.js STO-3` — ver README.md. Datos de _demo-alumno.js.
// El traslado no llega al servidor: se sustituye la llamada por su resultado (el stock
// movido en los datos de ejemplo), para ver lo que enseña la app al confirmar.
async (page, { app: APP, salida: SALIDA }) => {
  const fs = require('fs'), path = require('path');
  const foto = (nombre, opts = {}) => page.screenshot({ path: SALIDA + nombre, ...opts });
  const pausa = ms => page.waitForTimeout(ms);
  await eval(fs.readFileSync(path.join(__dirname, '_demo-alumno.js'), 'utf8'))(page, APP);

  // 1 · «¿Qué te llevas?» desde la etiqueta del armario del almacén, con 2 cajas marcadas
  await page.evaluate(() => {
    showPage('dashboard'); window.scrollTo(0, 0);
    openModalTransferenciaArmario('205-ZC-1.1');
  });
  await pausa(400);
  await page.evaluate(() => {
    const fila = document.querySelector('#nfc-transfer-items .nfc-item-row[data-mat-id="MATEJ1"]');
    const mas = [...fila.querySelectorAll('button')].find(b => b.textContent.trim() === '+');
    mas.click(); mas.click();
    fila.classList.add('ayuda-senal');
  });
  await pausa(300);
  await foto('01-que-te-llevas.png');

  // 2 · El destino: arriba, los sitios donde ya hay de ese material
  await page.evaluate(() => {
    document.querySelectorAll('.ayuda-senal').forEach(e => e.classList.remove('ayuda-senal'));
    const sug = document.getElementById('nfc-transfer-destino-sugerencias');
    sug?.classList.add('ayuda-senal');
    sug?.scrollIntoView({ block: 'center' });
  });
  await pausa(300);
  await foto('02-destino-donde-ya-hay.png');

  // 3 · Traslado confirmado (resultado pintado sin servidor)
  await page.evaluate(async () => {
    document.querySelectorAll('.ayuda-senal').forEach(e => e.classList.remove('ayuda-senal'));
    document.querySelector('#nfc-transfer-destino-sugerencias button[data-ubic="205-1.7"]')?.click();
    window.callEdgeFunction = async () => ({ procesados: 1 });
    window.loadAllData = async () => {
      const lote = id => DATA.materialUbicaciones.find(l => l.ID === id);
      lote('LUEJ1').Stock_Local = '2'; lote('LUEJ3').Stock_Local = '4';
      DATA.movimientos.push(_movimientoSbToObj({ id_movimiento: 'MOVEJ5', material: 'Puntas de pipeta 200 µL', id_material: 'MATEJ1', tipo: 'Traslado', cantidad: 2,
        fecha: new Date().toISOString().slice(0, 10), motivo: 'NFC · De: 205-ZC-1.1 → 205-1.7', usuario: '1º CS EJEMPLO' }));
      return true;
    };
    await confirmarTransferenciaArmario();
    showPage('material');
    const s = document.getElementById('search-material'); s.value = 'puntas'; filtrarMaterial('puntas');
    document.querySelector('#tabla-material tr.equipo-row').click();
    window.scrollTo(0, 0);
  });
  await pausa(400);
  await page.evaluate(() => {
    const filas = [...document.querySelectorAll('#tabla-material tr.mat-ubic-row[id^="mat-ubic-"]')];
    filas.filter(r => /205-ZC-1\.1|205-1\.7/.test(r.textContent)).forEach(r => r.querySelector('td:nth-child(2)')?.classList.add('ayuda-senal'));
    document.querySelector('#tabla-material tr.equipo-row').scrollIntoView({ block: 'start' });
    window.scrollBy(0, -70);
  });
  await pausa(200);
  await foto('03-traslado-confirmado.png');
  return 'ok';
}
