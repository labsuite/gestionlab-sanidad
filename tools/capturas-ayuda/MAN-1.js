// Capturas de MAN-1 «Ver qué mantenimientos tocan en tu laboratorio» (alumnado).
// `node tools/capturas-ayuda/capturar.js MAN-1`. Datos de _demo-alumno.js; un mantenimiento a medias de ejemplo.
async (page, { app: APP, salida: SALIDA }) => {
  const fs = require('fs'), path = require('path');
  const foto = (nombre, opts = {}) => page.screenshot({ path: SALIDA + nombre, ...opts });
  const pausa = ms => page.waitForTimeout(ms);
  const limpiar = () => page.evaluate(() => document.querySelectorAll('.ayuda-senal').forEach(e => e.classList.remove('ayuda-senal')));
  await eval(fs.readFileSync(path.join(__dirname, '_demo-alumno.js'), 'utf8'))(page, APP);
  await page.evaluate(() => {
    // La balanza, empezada por el grupo y dejada a medias (1 de 3 pasos)
    const curso = getCursoAcademico();
    const plan = DATA.planesMantenimiento.find(p => p.ID_Plan === 'PEJ2');
    plan.Instrucciones = 'Limpiar el plato y la cámara de pesada\nComprobar la nivelación (burbuja centrada)\nPesar la pesa patrón de 100 g (criterio: 100,0 ± 0,2 g)';
    const eq = DATA.equipos.find(e => e.ID_Activo === 'BAL-003');
    const per = getPeriodosEsperados(plan, eq, curso)[0];
    DATA.registroMantenimientos.push(_registroMantSbToObj({ id_registro: 'RMEJ2', id_plan: 'PEJ2', id_equipo: 'BAL-003', curso_academico: curso, periodo: per,
      estado: 'en_curso', fecha_inicio: new Date().toISOString().slice(0, 10), iniciado_por: '1º CS EJEMPLO',
      pasos: [{ texto: 'Limpiar el plato y la cámara de pesada', hecho: true }, { texto: 'Comprobar la nivelación', hecho: false }, { texto: 'Pesar la pesa patrón', hecho: false }] }));
    DATA.incidencias = [];   // sin avisos: aquí solo interesa la cifra de mantenimientos
    renderAll();
  });

  // 1 · Panel principal: la cifra de preventivos pendientes y su lista
  await page.evaluate(() => {
    showPage('dashboard'); renderDashboard(); window.scrollTo(0, 0);
    document.getElementById('stat-preventivos').closest('.stat-card').classList.add('ayuda-senal');
  });
  await pausa(300);
  await foto('01-panel-principal.png');

  // 2 · Lista de pendientes con los filtros
  await limpiar();
  await page.evaluate(() => {
    showPage('mantenimiento'); renderMantenimiento();
    const s = document.querySelector('#page-mantenimiento input[placeholder^="Buscar equipo"]');
    const filtros = s.closest('.card');
    filtros.classList.add('ayuda-senal');
    filtros.scrollIntoView({ block: 'start' }); window.scrollBy(0, -80);
  });
  await pausa(300);
  await foto('02-lista-de-pendientes.png');

  // 3 · La fila «▶ En curso» y «▸ Cómo» desplegado
  await limpiar();
  await page.evaluate(() => {
    const fila = [...document.querySelectorAll('#page-mantenimiento tbody tr')].find(tr => /BAL-003/.test(tr.textContent));
    const como = [...fila.querySelectorAll('button')].find(b => /Cómo/.test(b.textContent));
    como.click();
  });
  await pausa(300);
  await page.evaluate(() => {
    const fila = [...document.querySelectorAll('#page-mantenimiento tbody tr')].find(tr => /BAL-003/.test(tr.textContent));
    fila.querySelector('.badge-orange')?.classList.add('ayuda-senal');
    // La tabla es ancha: se desplaza hasta «▸ Cómo» como haría quien la usa en el móvil
    const caja = fila.closest('.card');
    const como = [...fila.querySelectorAll('button')].find(b => /Cómo/.test(b.textContent));
    fila.scrollIntoView({ block: 'start' }); window.scrollBy(0, -90);
    caja.scrollLeft = 0;
    como.classList.add('ayuda-senal');
  });
  await pausa(300);
  await foto('03-en-curso-y-como.png');
  return 'ok';
}
