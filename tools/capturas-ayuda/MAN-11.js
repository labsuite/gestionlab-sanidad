// Capturas de MAN-11 «Preparar las disoluciones de verificación de micropipetas del curso» (profesorado).
// `node tools/capturas-ayuda/capturar.js MAN-11` — datos de _demo-pipetas.js (apartado 11.1 del encargo).
async (page, { app: APP, salida: SALIDA }) => {
  const fs = require('fs'), path = require('path');
  const demo = eval(fs.readFileSync(path.join(__dirname, '_demo-pipetas.js'), 'utf8'));
  const pausa = ms => page.waitForTimeout(ms);
  const foto = (nombre, opts = {}) => page.screenshot({ path: SALIDA + nombre, ...opts });
  const fotoDe = (sel, nombre, n = 0) => page.locator(sel).nth(n).screenshot({ path: SALIDA + nombre });
  await demo(page, APP, 'Profesor', { sinPreparacion: true });
  await page.evaluate(() => {
    window._senal = el => { document.querySelectorAll('.ayuda-senal').forEach(e => e.classList.remove('ayuda-senal')); if (el) el.classList.add('ayuda-senal'); };
  });

  // 1 · Mantenimiento → pestaña «🧪 Verificación de pipetas»
  await page.evaluate(() => {
    showPage('mantenimiento');
    const t = document.getElementById('tab-btn-verifpipetas');
    window._senal(t); t.scrollIntoView({ block: 'center', inline: 'center' });
  });
  await pausa(400);
  await foto('01-entrar.png');

  // 2 · Sin preparación este curso: «+ Registrar la preparación»
  await page.evaluate(() => {
    showPage('verif-pipetas');
    const b = [...document.querySelectorAll('#page-verif-pipetas button')].find(x => /Registrar la preparación/.test(x.textContent));
    window._senal(b); b.scrollIntoView({ block: 'center' });
  });
  await pausa(400);
  await foto('02-registrar.png');

  // 3–5 · La preparación con las masas: factores, puntos de la recta y tubos del bloque 1
  await page.evaluate(() => {
    window._senal(null);
    openModalVerifPrep();
    const { PREP, TUBOS } = window._demoPrep;
    _vpEstado.prep.datos = JSON.parse(JSON.stringify(PREP));
    _vpEstado.prep.tubos = JSON.parse(JSON.stringify(TUBOS));
    _vpPintarPrep();
    document.querySelectorAll('#vp-prep-cuerpo [data-res]').forEach(el => el.classList.add('ayuda-senal'));
  });
  await page.setViewportSize({ width: 390, height: 1800 });
  await pausa(400);
  await fotoDe('#vp-prep-cuerpo .vp-tabla-wrap', '03-disoluciones-y-factores.png', 0);
  await fotoDe('#vp-prep-cuerpo .vp-tabla-wrap', '04-puntos-de-la-recta.png', 1);
  await page.evaluate(() => document.querySelectorAll('.ayuda-senal').forEach(e => e.classList.remove('ayuda-senal')));
  await fotoDe('#vp-prep-cuerpo .vp-tabla-wrap', '05-tubos.png', 2);
  await page.setViewportSize({ width: 390, height: 844 });
  return 'ok';
}
