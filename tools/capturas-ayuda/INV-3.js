// Capturas de INV-3 «Inventariar material que no está en la app» (alumnado). `node tools/capturas-ayuda/capturar.js INV-3`.
// Datos de _demo-alumno.js + la ficha real de «Placas Petri» y una etiqueta dibujada. No llama al servidor ni a la IA.
async (page, { app: APP, salida: SALIDA }) => {
  const fs = require('fs'), path = require('path');
  const foto = (nombre, opts = {}) => page.screenshot({ path: SALIDA + nombre, ...opts });
  const pausa = ms => page.waitForTimeout(ms);
  const limpiar = () => page.evaluate(() => document.querySelectorAll('.ayuda-senal').forEach(e => e.classList.remove('ayuda-senal')));
  await eval(fs.readFileSync(path.join(__dirname, '_demo-alumno.js'), 'utf8'))(page, APP);
  await page.evaluate(() => {
    try { localStorage.removeItem('gestionlab_invmat_sitio'); } catch (e) {}
    DATA.fichasAtributos = [_fichaAtributosSbToObj({ id_ficha: 'FAT_mate_placas_petri', categoria: 'Material fungible', tipo_base: 'Placas Petri', orden: 7, activa: true, nombre_base: 'Placas Petri',
      atributos: [{ tipo: 'booleano', clave: 'esteril', nombre: { sep: 'espacio', sufijo: '', prefijo: '', textoSi: 'estériles' }, etiqueta: 'Estériles', obligatorio: false },
                  { tipo: 'numero', clave: 'diametro', nombre: { sep: 'coma', sufijo: ' mm', prefijo: '' }, unidad: 'mm', etiqueta: 'Diámetro', obligatorio: true }] })];
    const hace = n => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString(); };
    const prop = (id, nombre, estado, extra = {}) => _propuestaMaterialSbToObj({ id_propuesta: id, nombre_generado: nombre, estado, propuesto_por: '1º CS EJEMPLO',
      email_propuesto_por: _demo.EMAIL, fecha: hace(2), ...extra });
    DATA.propuestasMaterial = [
      prop('PMEJ1', 'Placas Petri estériles, 90 mm', 'pendiente'),
      prop('PMEJ2', 'Tubos Falcon 50 ml', 'fusionada'),
      prop('PMEJ3', 'Portaobjetos esmerilados', 'aceptada'),
    ];
    // Etiqueta de ejemplo dibujada (sin marcas reales)
    const c = document.createElement('canvas'); c.width = 480; c.height = 260;
    const x = c.getContext('2d');
    x.fillStyle = '#f4f1ea'; x.fillRect(0, 0, 480, 260);
    x.fillStyle = '#1d3557'; x.fillRect(0, 0, 480, 56);
    x.fillStyle = '#fff'; x.font = 'bold 28px sans-serif'; x.fillText('LABORATORIO EJEMPLO', 18, 38);
    x.fillStyle = '#222'; x.font = 'bold 30px sans-serif'; x.fillText('Placas Petri 90 mm', 18, 110);
    x.font = '22px sans-serif'; x.fillText('20 uds', 18, 148); x.fillText('Ref. PP-9015', 18, 182);
    x.font = '18px sans-serif'; x.fillText('Lote 2026-07 · Cad. 2029-07', 18, 224);
    window._etiqueta = c.toDataURL('image/png');
    showPage('inventariar-material'); window.scrollTo(0, 0);
  });

  // 1 · Elegir el sitio
  await page.evaluate(() => {
    _invMatCambiarLabSitio('205');
    _invMatCambiarUbicSitio('205-2.3');
    const s = document.getElementById('invmat-sitio');
    s.classList.add('ayuda-senal'); s.scrollIntoView({ block: 'start' }); window.scrollBy(0, -80);
  });
  await pausa(300);
  await foto('01-elegir-sitio.png');

  // 2 · Foto de la etiqueta, categoría y tipo
  await limpiar();
  await page.evaluate(() => {
    Object.assign(_invMat, { fotoPath: 'propuestas/ejemplo.jpg', fotoNombre: 'etiqueta.jpg', fotoPreview: _etiqueta,
      categoria: [..._invMatCategorias()].find(c => c.startsWith('Material fungible')), tipoBase: 'Placas Petri' });
    renderInventariarMaterial();
    const b = [...document.querySelectorAll('#page-inventariar-material button')].find(x => x.textContent.includes('Leer la etiqueta'));
    b.classList.add('ayuda-senal');
    b.closest('div[style*="surface2"]').scrollIntoView({ block: 'start' }); window.scrollBy(0, -80);
  });
  await pausa(400);
  await foto('02-foto-de-la-etiqueta.png');

  // 3 · Datos leídos por la IA, con un campo que no se ve en la foto; cantidad: los envases cerrados
  await limpiar();
  await page.evaluate(() => {
    Object.assign(_invMat, { iaExtraido: { texto_etiqueta: 'Placas Petri 90 mm · Ref. PP-9015' }, iaNoVisibles: ['esteril'],
      atributos: { diametro: 90 }, textoEtiqueta: 'Placas Petri 90 mm · Ref. PP-9015', cantidad: '3', unidad: 'caja/s' });
    renderInventariarMaterial();
    const marca = [...document.querySelectorAll('#page-inventariar-material span')].find(x => x.textContent.includes('no se ve en la foto'));
    marca?.closest('.form-group')?.classList.add('ayuda-senal');
    marca?.closest('.form-group')?.scrollIntoView({ block: 'center' });
  });
  await pausa(400);
  await foto('03-datos-leidos.png');
  // 4 · Lo que has propuesto
  await limpiar();
  await page.evaluate(() => {
    const t = [...document.querySelectorAll('#page-inventariar-material .card-title')].find(x => x.textContent.includes('Lo que has propuesto')).closest('.card');
    t.classList.add('ayuda-senal'); t.scrollIntoView({ block: 'start' }); window.scrollBy(0, -80);
  });
  await pausa(300);
  await foto('05-lo-que-has-propuesto.png');
  return 'ok';
}
