// Capturas de EMP-1 «Entrar en GestionLab y saber qué puede hacer tu grupo» (alumnado).
// `node tools/capturas-ayuda/capturar.js EMP-1` — ver README.md.
async (page, { app: APP, salida: SALIDA }) => {
  const fs = require('fs'), path = require('path');
  const foto = (nombre, opts = {}) => page.screenshot({ path: SALIDA + nombre, ...opts });
  const pausa = ms => page.waitForTimeout(ms);
  const limpiar = () => page.evaluate(() => document.querySelectorAll('.ayuda-senal').forEach(e => e.classList.remove('ayuda-senal')));

  // 1 · Pantalla de entrada (sin sesión)
  await page.goto(APP + '?capturas=' + Date.now());
  await page.waitForFunction(() => getComputedStyle(document.getElementById('auth-screen')).display !== 'none', null, { timeout: 30000 });
  await page.evaluate(() => {
    const st = document.createElement('style');
    st.textContent = '.ayuda-senal{outline:3px solid #e8590c !important;outline-offset:2px;border-radius:8px;box-shadow:0 0 0 6px rgba(232,89,12,.18) !important}';
    document.head.appendChild(st);
    document.getElementById('login-email').value = 'ejemplo@gestionlab.cma';
    document.getElementById('login-password').value = 'contraseña';
    document.getElementById('btn-login').classList.add('ayuda-senal');
  });
  await pausa(300);
  await foto('01-pantalla-de-entrada.png');

  // Datos de ejemplo y app abierta como el grupo ficticio
  await eval(fs.readFileSync(path.join(__dirname, '_demo-alumno.js'), 'utf8'))(page, APP);

  // 2 · Panel principal
  await page.evaluate(() => { showPage('dashboard'); window.scrollTo(0, 0); document.querySelector('.stats-grid')?.classList.add('ayuda-senal'); });
  await pausa(300);
  await foto('02-panel-principal.png');

  // 3 · Menú abierto: las secciones del grupo (en el móvil el pie queda más abajo)
  await limpiar();
  await page.evaluate(() => toggleSidebar());
  await pausa(500);
  await foto('03-menu.png');

  // 4 · Pie del menú: nombre del grupo, rol y botón «↩» para cerrar la sesión
  await page.evaluate(() => {
    document.querySelector('.user-info')?.classList.add('ayuda-senal');
    document.querySelector('.btn-signout')?.classList.add('ayuda-senal');
  });
  await pausa(200);
  await page.locator('.sidebar-footer').screenshot({ path: SALIDA + '04-pie-del-menu.png' });

  // 5 · Mi perfil (nombre, email y rol)
  await limpiar();
  await page.evaluate(() => { toggleSidebar(); showPage('perfil'); window.scrollTo(0, 0); });
  await pausa(300);
  await foto('05-mi-perfil.png', { clip: { x: 0, y: 0, width: 390, height: 420 } });
  return 'ok';
}
