// Capturas de EMP-2 «La app te pide volver a entrar (sesión caducada)» (común a todos los roles).
// `node tools/capturas-ayuda/capturar.js EMP-2` — ver README.md.
// La app se abre sin sesión con datos de ejemplo: al pulsar «Guardar progreso» se ve de verdad
// lo que pasa cuando la sesión ha caducado. La vuelta a entrar se simula con showApp(), que es
// lo último que hace la app tras un inicio de sesión correcto.
async (page, { app: APP, salida: SALIDA }) => {
  const fs = require('fs'), path = require('path');
  const pausa = ms => page.waitForTimeout(ms);
  await eval(fs.readFileSync(path.join(__dirname, '_demo-alumno.js'), 'utf8'))(page, APP);

  // Un mantenimiento a medio rellenar
  await page.evaluate(() => {
    const p = getPeriodosEsperados(DATA.planesMantenimiento[0], DATA.equipos.find(e => e.ID_Activo === 'BAT-06'), getCursoAcademico())[0];
    openModalRegistrarMant('PEJ1', 'BAT-06', p, getCursoAcademico());
    const cb = document.querySelector('#mant-checklist [data-idx="1"] input'); if (cb) { cb.checked = true; _mantPasoHecho(1, true); }
    document.getElementById('mant-observaciones').value = 'Termómetro de referencia: TER-02. Agua de red.';
  });
  // 1 · Se pulsa «💾 Guardar progreso» con la sesión caducada → pantalla de entrada con el aviso
  await page.evaluate(() => guardarProgresoMant());
  await pausa(700);
  await page.evaluate(() => {
    document.getElementById('auth-aviso-sesion')?.classList.add('ayuda-senal');
    document.getElementById('login-email').value = 'ejemplo@gestionlab.cma';
    document.getElementById('login-password').value = 'contraseña';
  });
  await pausa(200);
  await page.screenshot({ path: SALIDA + '01-entrada-sesion-caducada.png' });

  // 2 · Vuelta a entrar con la misma cuenta → reaparece la ventana con lo rellenado
  await page.evaluate(() => {
    document.querySelectorAll('.toast, #toast').forEach(t => { t.style.display = 'none'; });
    document.querySelectorAll('.ayuda-senal').forEach(e => e.classList.remove('ayuda-senal'));
    showApp();
  });
  await pausa(400);
  await page.evaluate(() => {
    const t = [...document.querySelectorAll('.toast, #toast')].filter(x => /Ya has vuelto/.test(x.textContent));
    t.forEach(x => { x.style.display = ''; });
    // El aviso queda abajo, sobre los botones, unos segundos: se señala lo que se conserva.
    const obs = document.getElementById('mant-observaciones');
    obs?.classList.add('ayuda-senal');
    obs?.scrollIntoView({ block: 'center' });
  });
  await pausa(300);
  await page.screenshot({ path: SALIDA + '02-ventana-reaparece.png' });
  return 'ok';
}
