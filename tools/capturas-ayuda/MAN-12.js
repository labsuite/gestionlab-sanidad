// Capturas de MAN-12 «Llevar una sesión de verificación de micropipetas» (profesorado).
// `node tools/capturas-ayuda/capturar.js MAN-12` — datos de _demo-pipetas.js (apartado 11.1 del encargo).
async (page, { app: APP, salida: SALIDA }) => {
  const fs = require('fs'), path = require('path');
  const demo = eval(fs.readFileSync(path.join(__dirname, '_demo-pipetas.js'), 'utf8'));
  const pausa = ms => page.waitForTimeout(ms);
  const foto = (nombre, opts = {}) => page.screenshot({ path: SALIDA + nombre, ...opts });
  // Captura desde el elemento `desde` hasta el `hasta` (incluidos), a lo ancho de la ventana.
  const zona = async (desde, hasta, nombre) => {
    const clip = await page.evaluate(([a, b]) => {
      const ea = typeof a === 'string' ? document.querySelector(a) : null;
      const eb = typeof b === 'string' ? document.querySelector(b) : null;
      ea.scrollIntoView({ block: 'start' });
      const ra = ea.getBoundingClientRect(), rb = eb.getBoundingClientRect(), cuerpo = document.getElementById('vp-ses-cuerpo').getBoundingClientRect();
      return { x: cuerpo.left - 6, y: Math.max(0, ra.top - 6), width: cuerpo.width + 12, height: rb.bottom - ra.top + 12 };
    }, [desde, hasta]);
    await page.screenshot({ path: SALIDA + nombre, clip });
  };
  await demo(page, APP, 'Profesor');
  await page.evaluate(() => {
    window._senal = el => { document.querySelectorAll('.ayuda-senal').forEach(e => e.classList.remove('ayuda-senal')); if (el) el.classList.add('ayuda-senal'); };
    // La sesión de hoy aún no existe: solo la primera del curso (con la validación del método).
    DATA.verifSesiones = DATA.verifSesiones.filter(s => s.id === 'VS-EJ0');
    showPage('verif-pipetas');
    const b = [...document.querySelectorAll('#page-verif-pipetas button')].find(x => /Nueva sesión/.test(x.textContent));
    window._senal(b); b.scrollIntoView({ block: 'center' });
  });
  await pausa(400);
  await foto('01-nueva-sesion.png');

  // La sesión del día con los datos del apartado 11.1
  await page.evaluate(() => {
    window._senal(null);
    openModalVerifSesion();
    const e = _vpEstado.ses;
    e.bloque = '1'; e.personas = 'Docente de ejemplo · 1º CS LCB';
    e.datos = { ...e.datos, ...JSON.parse(JSON.stringify(window._demoSes)) };
    delete e.datos.validacion;
    _vpPintarSesion();
    // marcadores para las zonas de las capturas
    const h4 = [...document.querySelectorAll('#vp-ses-cuerpo .vp-h4')];
    h4.forEach((h, i) => { h.id = 'vp-h4-' + i; });
    document.querySelectorAll('#vp-ses-cuerpo .vp-tabla-wrap').forEach((t, i) => { t.id = 'vp-tw-' + i; });
    document.querySelector('#vp-ses-cuerpo [data-res="recta"]').id = 'vp-res-recta';
    document.querySelector('#vp-ses-cuerpo [data-res="cv"]').id = 'vp-res-cv';
    document.querySelector('#vp-ses-cuerpo .form-grid').id = 'vp-ses-cab';
  });
  await page.setViewportSize({ width: 390, height: 1800 });
  await pausa(500);
  await zona('#vp-ses-cab', '#vp-ses-validez', '02-datos-y-validez.png');
  await zona('#vp-h4-0', '#vp-tw-0', '03-tubos.png');
  await page.evaluate(() => window._senal(document.getElementById('vp-res-recta')));
  await zona('#vp-h4-1', '#vp-res-recta', '04-recta.png');
  await page.evaluate(() => { window._senal(null); document.querySelectorAll('#vp-ses-cuerpo [data-res^="comp-"], #vp-res-cv').forEach(e => e.classList.add('ayuda-senal')); });
  await zona('#vp-h4-2', '#vp-res-cv', '05-comprobaciones-y-cv.png');

  // Una comprobación que no cumple: la S-B no se usa hoy
  await page.evaluate(() => {
    document.querySelectorAll('.ayuda-senal').forEach(e => e.classList.remove('ayuda-senal'));
    _vpEstado.ses.datos.comprobaciones['S-B'].A = '0,770';
    _vpPintarSesion();
    [...document.querySelectorAll('#vp-ses-cuerpo .vp-h4')].forEach((h, i) => { h.id = 'vp-h4-' + i; });
    document.querySelectorAll('#vp-ses-cuerpo .vp-tabla-wrap').forEach((t, i) => { t.id = 'vp-tw-' + i; });
    window._senal(document.querySelector('#vp-ses-cuerpo [data-res="comp-S-B"]'));
  });
  await pausa(400);
  await zona('#vp-h4-2', '#vp-tw-2', '06-comprobacion-no-cumple.png');
  await page.setViewportSize({ width: 390, height: 844 });
  return 'ok';
}
