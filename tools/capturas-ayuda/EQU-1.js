// Capturas de EQU-1 «Encontrar un equipo» (común). `node tools/capturas-ayuda/capturar.js EQU-1`.
// Datos de _demo-alumno.js; la balanza pasa a un sitio concreto de la zona común. No llama al servidor.
async (page, { app: APP, salida: SALIDA }) => {
  const fs = require('fs'), path = require('path');
  const foto = (nombre, opts = {}) => page.screenshot({ path: SALIDA + nombre, ...opts });
  const pausa = ms => page.waitForTimeout(ms);
  const limpiar = () => page.evaluate(() => document.querySelectorAll('.ayuda-senal').forEach(e => e.classList.remove('ayuda-senal')));
  await eval(fs.readFileSync(path.join(__dirname, '_demo-alumno.js'), 'utf8'))(page, APP);
  await page.evaluate(() => {
    DATA.ubicaciones.push(_ubicacionSbToObj({ id_ubicacion: '205-ZC-3.2', laboratorio_aula: '205 - Zona común', zona: 'Armario 3 · Balda 2', subzona: 'Balanzas y termómetros', descripcion_completa: '', activa: true }));
    DATA.equipos.find(e => e.ID_Activo === 'BAL-003').Ubicacion = '205-ZC-3.2';
    DATA.equipos.push(_equipoSbToObj({ id_activo: 'TER-02', tipo_equipo: 'Termómetro de referencia', marca: 'Ejemplo', modelo: '', ubicacion: '205-ZC-3.2', estado_operativo: 'Operativo' }));
    renderAll();
  });

  // 1 · El código en el buscador
  await page.evaluate(() => {
    showPage('equipos');
    const s = document.getElementById('search-equipos'); s.value = 'BAL-003'; filtrarEquipos('BAL-003');
    window.scrollTo(0, 0);
    s.closest('.search-input').classList.add('ayuda-senal');
    document.querySelector('#page-equipos tbody tr').classList.add('ayuda-senal');
  });
  await pausa(300);
  await foto('01-buscar-codigo.png');

  // 2 · Sin código: filtrar por el laboratorio y buscar por tipo
  await limpiar();
  await page.evaluate(() => {
    const s = document.getElementById('search-equipos'); s.value = 'centrífuga';
    const f = document.getElementById('filter-equipos-ubicacion'); f.value = '203';
    renderEquipos('centrífuga', undefined, undefined, '203');
    window.scrollTo(0, 0);
    s.closest('.search-input').classList.add('ayuda-senal');
    f.closest('.search-input').classList.add('ayuda-senal');
  });
  await pausa(300);
  await foto('02-filtrar-por-laboratorio.png');

  // 3 · Dónde está, en la tarjeta del equipo
  await limpiar();
  await page.evaluate(() => {
    document.getElementById('filter-equipos-ubicacion').value = '';
    const s = document.getElementById('search-equipos'); s.value = 'BAL-003';
    renderEquipos('BAL-003', undefined, undefined, '');
    toggleEquipoExpand('eq-expand-BAL_003');
    const ub = [...document.querySelectorAll('#eq-expand-BAL_003 .detail-mobile-only')].find(d => d.textContent.includes('Ubicación'));
    ub.classList.add('ayuda-senal'); ub.scrollIntoView({ block: 'center' });
  });
  await pausa(400);
  await foto('03-donde-esta.png');

  // 4 · Lo que hay en un sitio: Catálogo › Ubicaciones
  await limpiar();
  await page.evaluate(() => {
    _ubiAbiertos.add('205 - Zona común'); _ubiItemsAbiertos.add('205-ZC-3.2');
    showPage('ubicaciones'); renderUbicaciones();
    const fila = document.getElementById('ubi-row-205-ZC-3.2');
    fila.classList.add('ayuda-senal'); fila.scrollIntoView({ block: 'start' }); window.scrollBy(0, -90);
  });
  await pausa(400);
  await foto('04-que-hay-en-un-sitio.png');
  return 'ok';
}
