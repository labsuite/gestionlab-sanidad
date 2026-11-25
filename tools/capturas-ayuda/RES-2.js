// Capturas de RES-2 «Echar un residuo en un contenedor y apuntarlo» (alumnado).
// `node tools/capturas-ayuda/capturar.js RES-2`. Datos de _demo-alumno.js + _demo-residuos.js.
// No llama al servidor: los bloqueos se pintan con los mensajes reales que da
// gestionar-residuo, sustituyendo la llamada por su respuesta.
async (page, { app: APP, salida: SALIDA }) => {
  const fs = require('fs'), path = require('path');
  const foto = (nombre, opts = {}) => page.screenshot({ path: SALIDA + nombre, ...opts });
  const pausa = ms => page.waitForTimeout(ms);
  const limpiar = () => page.evaluate(() => {
    document.querySelectorAll('.ayuda-senal').forEach(e => e.classList.remove('ayuda-senal'));
    document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open'));
    document.querySelectorAll('.toast, #toast').forEach(t => t.remove());
  });
  await eval(fs.readFileSync(path.join(__dirname, '_demo-alumno.js'), 'utf8'))(page, APP);
  await eval(fs.readFileSync(path.join(__dirname, '_demo-residuos.js'), 'utf8'))(page);
  const idx = id => `DATA.contenedoresResiduo.findIndex(c => c.ID_Contenedor === '${id}')`;

  // 1 · Tarjeta del contenedor con su nivel
  await page.evaluate(() => {
    showPage('residuos-contenedores'); renderResiduosContenedores();
    const tarj = [...document.querySelectorAll('#page-residuos-contenedores .card')].find(c => /Tinciones/.test(c.textContent) && /205/.test(c.textContent));
    tarj?.classList.add('ayuda-senal'); tarj?.scrollIntoView({ block: 'start' }); window.scrollBy(0, -80);
  });
  await pausa(300);
  await foto('01-contenedor.png');

  // 2 · «Añadir residuo» con un residuo de la lista
  await limpiar();
  await page.evaluate((i) => {
    openModalAdicion(eval(i));
    sv('adic-tipo-residuo', 'RESEJ1');
    const tx = document.getElementById('adic-tipo-residuo-texto'); tx.value = 'Restos de tinción de Gram (cristal violeta, lugol, safranina)';
    sv('adic-nivel', '75%');
    sv('adic-observaciones', 'Práctica de Gram, 150 ml');
  }, idx('CONTEJ1'));
  await pausa(400);
  await foto('02-anadir-residuo.png');

  // 3 · Bloqueo por incompatibilidad (lejía en una garrafa con ácido): mensaje real del servidor
  await limpiar();
  await page.evaluate(async (i) => {
    openModalAdicion(eval(i));
    sv('adic-tipo-residuo', ''); document.getElementById('adic-tipo-residuo-texto').value = '';
    sv('adic-descripcion-libre', 'Lejía diluida de limpiar la cubeta');
    window.callEdgeFunction = async () => { throw new Error('No se puede añadir: este contenedor ya tiene algo ácido, y la lejía/hipoclorito con un ácido desprende cloro. Llévalo a otra garrafa sin ácidos o al salvavidas, en su frasco cerrado.'); };
    await guardarAdicion();
  }, idx('CONTEJ4'));
  await pausa(500);
  await foto('03-bloqueo.png');

  // 4 · La IA no lo recomienda: «Entendido, no lo tiro»
  await limpiar();
  await page.evaluate(async (i) => {
    openModalAdicion(eval(i));
    sv('adic-tipo-residuo', ''); document.getElementById('adic-tipo-residuo-texto').value = '';
    sv('adic-descripcion-libre', 'Formol sobrante de un bote de biopsia, ya sin la muestra');
    window.callEdgeFunction = async () => ({ ia_bloqueo: true, contenedor_sugerido: 'Contenedor Inertes',
      mensaje: 'El formol sin muestra no va en Aguas de Laboratorio: va a disolventes no halogenados, que en este centro es el Contenedor Inertes. Si no hay ninguno activo, déjalo en su envase cerrado y rotulado en la zona de residuos pendientes y avisa a tu profesor/a.' });
    await guardarAdicion();
    document.getElementById('adic-ia-resultado').classList.add('ayuda-senal');
    document.getElementById('adic-ia-resultado').scrollIntoView({ block: 'center' });
  }, idx('CONTEJ1'));
  await pausa(500);
  await foto('04-ia-no-lo-recomienda.png');

  // 5 · La tarjeta con la adición registrada (resultado pintado sin servidor)
  await limpiar();
  await page.evaluate(async (i) => {
    const c = DATA.contenedoresResiduo[eval(i)];
    openModalAdicion(eval(i));
    sv('adic-tipo-residuo', 'RESEJ1'); document.getElementById('adic-tipo-residuo-texto').value = 'Restos de tinción de Gram (cristal violeta, lugol, safranina)';
    sv('adic-descripcion-libre', ''); sv('adic-nivel', '75%'); sv('adic-observaciones', 'Práctica de Gram, 150 ml');
    window.callEdgeFunction = async () => ({
      adicion: { id_adicion: 'ADEJ2', id_contenedor: c.ID_Contenedor, id_residuo: 'RESEJ1', fecha: new Date().toISOString().slice(0, 10), usuario: '1º CS EJEMPLO', observaciones: 'Práctica de Gram, 150 ml' },
      contenedor: { id_contenedor: c.ID_Contenedor, categoria: c.Categoria, lab: c.Lab, formato: c.Formato, zona: c.Zona, nivel: '75%', estado: 'activo', fecha_apertura: c.Fecha_Apertura },
    });
    await guardarAdicion();
    const tarj = [...document.querySelectorAll('#page-residuos-contenedores .card')].find(x => /Tinciones/.test(x.textContent) && /205/.test(x.textContent));
    tarj?.classList.add('ayuda-senal'); tarj?.scrollIntoView({ block: 'start' }); window.scrollBy(0, -80);
  }, idx('CONTEJ1'));
  await pausa(500);
  await foto('05-adicion-registrada.png');
  return 'ok';
}
