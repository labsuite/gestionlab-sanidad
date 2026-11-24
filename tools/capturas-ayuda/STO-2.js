// Capturas de STO-2 «Apuntar el gasto al abrir un envase nuevo» (versión alumnado).
// `node tools/capturas-ayuda/capturar.js STO-2` — ver README.md. Datos de _demo-alumno.js;
// no se guarda nada: el gasto del grupo del historial ya viene en los datos de ejemplo.
async (page, { app: APP, salida: SALIDA }) => {
  const fs = require('fs'), path = require('path');
  const foto = (nombre, opts = {}) => page.screenshot({ path: SALIDA + nombre, ...opts });
  const pausa = ms => page.waitForTimeout(ms);
  await eval(fs.readFileSync(path.join(__dirname, '_demo-alumno.js'), 'utf8'))(page, APP);

  // 1 · El registro de consumo con el material, el bote y 1 envase
  await page.evaluate(() => {
    showPage('dashboard'); window.scrollTo(0, 0);
    openModalConsumo();
    const i = document.getElementById('consumo-search'); i.value = 'puntas'; buscarMaterialConsumo('puntas');
  });
  await pausa(300);
  await page.evaluate(() => {
    document.querySelector('#consumo-autocomplete div')?.click();
    document.getElementById('consumo-motivo').value = 'Práctica de PCR';
    document.getElementById('consumo-ubicacion-sel').closest('.form-group').classList.add('ayuda-senal');
    document.getElementById('consumo-cantidad').classList.add('ayuda-senal');
    document.querySelectorAll('.toast, #toast').forEach(t => { t.style.display = 'none'; });
  });
  await pausa(300);
  await foto('01-registro-de-consumo.png');

  // 2 · El historial del material, con el gasto a nombre del grupo
  await page.evaluate(() => {
    closeModal('modal-consumo');
    document.querySelectorAll('.ayuda-senal').forEach(e => e.classList.remove('ayuda-senal'));
    showPage('material');
    openModalHistorialMaterial('MATEJ1');
    const fila = [...document.querySelectorAll('#historial-mat-contenido > div')].find(d => /Salida/.test(d.textContent));
    fila?.classList.add('ayuda-senal');
    fila?.scrollIntoView({ block: 'center' });
  });
  await pausa(300);
  await foto('02-historial.png');
  return 'ok';
}
