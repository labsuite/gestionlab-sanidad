// Capturas de INV-1 «Ubicar los equipos de un laboratorio» (alumnado). `node tools/capturas-ayuda/capturar.js INV-1`.
// Datos de _demo-alumno.js + un sitio de poyata y propuestas de ejemplo del grupo. No llama al servidor.
async (page, { app: APP, salida: SALIDA }) => {
  const fs = require('fs'), path = require('path');
  const foto = (nombre, opts = {}) => page.screenshot({ path: SALIDA + nombre, ...opts });
  const pausa = ms => page.waitForTimeout(ms);
  const limpiar = () => page.evaluate(() => document.querySelectorAll('.ayuda-senal').forEach(e => e.classList.remove('ayuda-senal')));
  await eval(fs.readFileSync(path.join(__dirname, '_demo-alumno.js'), 'utf8'))(page, APP);
  await page.evaluate(() => {
    DATA.ubicaciones.push(_ubicacionSbToObj({ id_ubicacion: '205-P1', laboratorio_aula: '205', zona: 'Poyata 1 · Encima', subzona: 'Baños y estufas', descripcion_completa: '', activa: true }));
    const hace = n => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString(); };
    const prop = (id, eq, ubic, estado, extra = {}) => _propuestaUbicacionSbToObj({ id_propuesta: id, id_equipo: eq, id_ubicacion: ubic, estado,
      propuesto_por: '1º CS EJEMPLO', email_propuesto_por: _demo.EMAIL, fecha: hace(1), ...extra });
    DATA.propuestasUbicacion = [
      prop('PUEJ1', 'CON-01', '205-2.3', 'pendiente'),
      prop('PUEJ2', 'AUTC-001', '205-P1', 'aceptada'),
      prop('PUEJ3', 'CAB-01', '205-1.7', 'rechazada', { notas_revision: 'La vitrina no está en un cajón: es la del fondo del laboratorio.' }),
      prop('PUEJ4', 'CEN-08', null, 'pendiente', { no_encontrado: true, observaciones: 'Buscada en las poyatas y en los armarios del 203' }),
    ];
    showPage('ubicar-equipos'); _ubicLabActivo = '205'; _ubicUbicacionActual = ''; renderUbicarEquipos(); window.scrollTo(0, 0);
  });

  // 1 · Elegir el sitio
  await page.evaluate(() => {
    _ubicCambiarUbicacion('205-P1');
    const s = document.getElementById('ubic-ubicacion-actual').parentElement;
    s.classList.add('ayuda-senal'); s.scrollIntoView({ block: 'start' }); window.scrollBy(0, -80);
  });
  await pausa(300);
  await foto('01-elegir-sitio.png');

  // 2 · Marcar los equipos que se ven ahí y «Están aquí»
  await limpiar();
  await page.evaluate(() => {
    _ubicToggleEquipo('BAT-06', true);
    const caja = [...document.querySelectorAll('#page-ubicar-equipos input[type="checkbox"]')].find(c => c.checked && c.closest('div[style*="border"]'))?.closest('div[style*="border"]');
    caja?.classList.add('ayuda-senal');
    const b = [...document.querySelectorAll('#page-ubicar-equipos button')].find(x => x.textContent.includes('Están aquí'));
    b.classList.add('ayuda-senal');
    caja?.scrollIntoView({ block: 'center' });
  });
  await pausa(300);
  await foto('02-marcar-y-estan-aqui.png');

  // 3 · «No lo encuentro» (❓)
  await limpiar();
  await page.evaluate(() => {
    const b = document.querySelector('#page-ubicar-equipos button[title="No lo encuentro"]');
    b.classList.add('ayuda-senal'); b.scrollIntoView({ block: 'center' });
  });
  await pausa(300);
  await foto('03-no-lo-encuentro.png');

  // 4 · Lo que has propuesto
  await limpiar();
  await page.evaluate(() => {
    const t = [...document.querySelectorAll('#page-ubicar-equipos .card-title')].find(x => x.textContent.includes('Lo que has propuesto')).closest('.card');
    t.classList.add('ayuda-senal'); t.scrollIntoView({ block: 'start' }); window.scrollBy(0, -80);
  });
  await pausa(300);
  await foto('04-lo-que-has-propuesto.png');
  return 'ok';
}
