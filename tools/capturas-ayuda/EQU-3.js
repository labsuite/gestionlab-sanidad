// Capturas de EQU-3 «Saber si un equipo se puede usar» (común). `node tools/capturas-ayuda/capturar.js EQU-3`.
// Datos de _demo-alumno.js con un equipo en cada estado y uno fuera del centro. No llama al servidor.
async (page, { app: APP, salida: SALIDA }) => {
  const fs = require('fs'), path = require('path');
  const foto = (nombre, opts = {}) => page.screenshot({ path: SALIDA + nombre, ...opts });
  const pausa = ms => page.waitForTimeout(ms);
  const limpiar = () => page.evaluate(() => document.querySelectorAll('.ayuda-senal').forEach(e => e.classList.remove('ayuda-senal')));
  await eval(fs.readFileSync(path.join(__dirname, '_demo-alumno.js'), 'utf8'))(page, APP);
  await page.evaluate(() => {
    const hace = n => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };
    const enDias = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
    const est = (id, e) => { DATA.equipos.find(x => x.ID_Activo === id).Estado_Operativo = e; };
    est('BAT-06', 'Operativo con fallos');
    est('AUTC-001', 'Revisión planificada');
    est('MIC-21', 'Fuera de servicio');
    DATA.equipos.find(x => x.ID_Activo === 'MIC-21').Ubicacion = 'Lab 205';
    DATA.intervenciones = [
      _intervencionSbToObj({ id_intervencion: 'INT-EJ1', id_equipo: 'AUTC-001', tipo: 'Verificación funcional', estado: 'Planificada', fecha_planificada: enDias(9) }),
      _intervencionSbToObj({ id_intervencion: 'INT-EJ2', id_equipo: 'CON-01', tipo: 'Correctivo', estado: 'En gestión', lugar_intervencion: 'Equipo retirado',
        fecha_retirada: hace(6), proveedor: 'Servicio técnico de ejemplo', fecha_realizacion: hace(6) }),
    ];
    renderAll();
    showPage('equipos'); renderEquipos(); window.scrollTo(0, 0);
  });

  // 1 · Los estados en el inventario
  await page.evaluate(() => {
    // Página entera desde arriba (si no, la cabecera fija sale en medio de la captura)
    document.querySelector('#page-equipos tbody').closest('.card').classList.add('ayuda-senal');
    window.scrollTo(0, 0);
  });
  await pausa(300);
  await foto('01-estados.png', { fullPage: true });

  // 2 · Aviso abierto en la tarjeta del equipo, con el consejo
  await limpiar();
  await page.evaluate(() => {
    const s = document.getElementById('search-equipos'); s.value = 'BAL-003'; filtrarEquipos('BAL-003');
    toggleEquipoExpand('eq-expand-BAL_003');
    const a = document.querySelector('#eq-expand-BAL_003 .aviso-equipo');
    a.classList.add('ayuda-senal'); a.scrollIntoView({ block: 'center' });
  });
  await pausa(400);
  await foto('02-aviso-abierto.png');

  // 3 · Fuera del centro
  await limpiar();
  await page.evaluate(() => {
    const s = document.getElementById('search-equipos'); s.value = 'CON-01'; filtrarEquipos('CON-01');
    toggleEquipoExpand('eq-expand-CON_01');
    const fila = document.querySelector('#page-equipos tbody tr');
    fila.classList.add('ayuda-senal'); fila.scrollIntoView({ block: 'start' }); window.scrollBy(0, -90);
  });
  await pausa(400);
  await foto('03-fuera-del-centro.png');

  // 4 · Panel principal del grupo
  await limpiar();
  await page.evaluate(() => {
    const s = document.getElementById('search-equipos'); s.value = ''; filtrarEquipos('');
    showPage('dashboard'); renderDashboard();
    const c = document.getElementById('card-equipos-aviso');
    c.classList.add('ayuda-senal'); c.scrollIntoView({ block: 'start' }); window.scrollBy(0, -90);
  });
  await pausa(400);
  await foto('04-panel-principal.png');
  return 'ok';
}
