// Capturas de EQU-2 «Consultar cómo se usa un equipo» (común). `node tools/capturas-ayuda/capturar.js EQU-2`.
// Datos de _demo-alumno.js + el protocolo real de BAL-003 (de protocolos.jsonl: no lleva datos personales).
async (page, { app: APP, salida: SALIDA }) => {
  const fs = require('fs'), path = require('path');
  const foto = (nombre, opts = {}) => page.screenshot({ path: SALIDA + nombre, ...opts });
  const pausa = ms => page.waitForTimeout(ms);
  const limpiar = () => page.evaluate(() => document.querySelectorAll('.ayuda-senal').forEach(e => e.classList.remove('ayuda-senal')));
  const JSONL = 'C:/Users/Paloma/OneDrive/Escritorio/CIFP Manuel Antonio/B. Laboratorio/Protocolos/GestionLab/protocolos.jsonl';
  const prot = fs.readFileSync(JSONL, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)).find(p => p.id_activo === 'BAL-003').protocolo_uso;
  await eval(fs.readFileSync(path.join(__dirname, '_demo-alumno.js'), 'utf8'))(page, APP);
  await page.evaluate((prot) => {
    const eq = DATA.equipos.find(e => e.ID_Activo === 'BAL-003');
    eq.Protocolo_Uso = prot; eq.Tiene_Protocolo = true; eq.Manual_Ficha_Tecnica = 'manuales/ejemplo.pdf';
    showPage('equipos');
    const s = document.getElementById('search-equipos'); s.value = 'BAL-003'; filtrarEquipos('BAL-003');
    toggleEquipoExpand('eq-expand-BAL_003');
  }, prot);
  await pausa(500);

  // 1 · El protocolo desplegado, con su índice de apartados
  await page.evaluate(() => {
    const p = document.querySelector('#eq-expand-BAL_003 details.proto');
    p.open = true;
    const ind = p.querySelector('.proto-indice');
    ind.classList.add('ayuda-senal');
    p.querySelector('summary').scrollIntoView({ block: 'start' }); window.scrollBy(0, -90);
  });
  await pausa(400);
  await foto('01-protocolo-indice.png');

  // 2 · Buscar dentro del protocolo
  await limpiar();
  await page.evaluate(() => {
    const i = document.querySelector('#eq-expand-BAL_003 .proto-buscar');
    i.value = 'tara'; protoBuscar(i);
    i.classList.add('ayuda-senal');
    i.scrollIntoView({ block: 'start' }); window.scrollBy(0, -90);
  });
  await pausa(400);
  await foto('02-buscar-en-el-protocolo.png');

  // 3 · Ampliado, a pantalla completa
  await limpiar();
  await page.evaluate(() => {
    const i = document.querySelector('#eq-expand-BAL_003 .proto-buscar');
    i.value = ''; protoBuscar(i);
    protoAmpliar(document.querySelector('#eq-expand-BAL_003 .proto-btn-ampliar'));
  });
  await pausa(500);
  await foto('03-ampliado.png');

  // 4 · La tabla del principio: versión del protocolo
  await limpiar();
  await page.evaluate(() => {
    protoAmpliar(document.querySelector('#eq-expand-BAL_003 .proto-btn-ampliar'));
    const fila = [...document.querySelectorAll('#eq-expand-BAL_003 .proto-intro tr')].find(tr => /Versión del protocolo/.test(tr.textContent));
    fila.classList.add('ayuda-senal');
    fila.scrollIntoView({ block: 'center' });
  });
  await pausa(400);
  await foto('04-version-del-protocolo.png');
  return 'ok';
}
