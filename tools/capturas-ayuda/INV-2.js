// Capturas de INV-2 «Contar el stock de un sitio» (alumnado). `node tools/capturas-ayuda/capturar.js INV-2`.
// Datos de _demo-alumno.js, con el permiso de contar dado al grupo. No llama al servidor.
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
  await page.evaluate(() => { DATA.usuarios[0].Puede_Revisar_Inventario = 'TRUE'; showPage('material'); renderMaterial(); window.scrollTo(0, 0); });

  // 1 · El 🔢 en la línea del bote
  await page.evaluate(() => {
    document.querySelector('#tabla-material tr.equipo-row').click();
    const b = document.querySelector('#tabla-material tr.mat-ubic-row button[title="Contar stock en esta ubicación"]');
    b.classList.add('ayuda-senal'); b.closest('tr').scrollIntoView({ block: 'center' });
  });
  await pausa(300);
  await foto('01-boton-contar.png');

  // 2 · La ventana de recuento: lo que dice la app y lo que hay de verdad
  await limpiar();
  await page.evaluate(() => {
    openModalContarStock('MATEJ1', 'lote:LUEJ3');
    sv('contar-stock-real', '1');
    sv('contar-obs', '1 caja con el precinto roto');
    document.getElementById('contar-stock-real').closest('.form-grid-2').classList.add('ayuda-senal');
  });
  await pausa(400);
  await foto('02-ventana-de-recuento.png');

  // 3 · Enviado
  await page.evaluate(async () => {
    window.callEdgeFunction = async () => ({ revision: { id_revision: 'REVEJ1' } });
    window.loadAllData = async () => {};
    document.querySelectorAll('.ayuda-senal').forEach(e => e.classList.remove('ayuda-senal'));
    await guardarConteo();
  });
  await pausa(400);
  await foto('03-enviado.png');
  return 'ok';
}
