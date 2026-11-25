// Capturas de MUE-2 «Usar una muestra congelada» (común). `node tools/capturas-ayuda/capturar.js MUE-2`.
// Datos de _demo-alumno.js + _demo-congelados.js. No llama al servidor: la respuesta se simula.
async (page, { app: APP, salida: SALIDA }) => {
  const fs = require('fs'), path = require('path');
  const foto = (nombre, opts = {}) => page.screenshot({ path: SALIDA + nombre, ...opts });
  const pausa = ms => page.waitForTimeout(ms);
  const limpiar = () => page.evaluate(() => {
    document.querySelectorAll('.ayuda-senal').forEach(e => e.classList.remove('ayuda-senal'));
    document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open'));
    document.querySelectorAll('.toast').forEach(t => t.remove());
  });
  await eval(fs.readFileSync(path.join(__dirname, '_demo-alumno.js'), 'utf8'))(page, APP);
  await eval(fs.readFileSync(path.join(__dirname, '_demo-congelados.js'), 'utf8'))(page);

  // 1 · La ficha del tubo con «📋 Cómo se usa» desplegado
  await page.evaluate(() => {
    showPage('congelados'); _congBusqueda = ''; _congCajaAbierta = 'CAJEJ1'; _congMuestraSel = 'MEJ1'; renderCongelados();
    const d = document.querySelector('#cong-ficha details.cong-instrucciones');
    d.open = true; d.classList.add('ayuda-senal');
    document.getElementById('cong-ficha').scrollIntoView({ block: 'start' }); window.scrollBy(0, -90);
  });
  await pausa(400);
  await foto('01-como-se-usa.png');

  // 2 · «Apuntar uso» de bolitas
  await limpiar();
  await page.evaluate(() => {
    openModalUsarMuestra('MEJ1');
    sv('usar-muestra-motivo', 'Práctica');
    document.getElementById('usar-muestra-motivo').classList.add('ayuda-senal');
  });
  await pausa(400);
  await foto('02-apuntar-uso-bolitas.png');

  // 3 · «Apuntar uso» de volumen: lo que de verdad se ha tomado
  await limpiar();
  await page.evaluate(() => {
    _congMuestraSel = 'MEJ5'; renderCongelados();
    openModalUsarMuestra('MEJ5');
    sv('usar-muestra-cantidad', '5');
    sv('usar-muestra-motivo', 'PCR / ensayo');
    document.getElementById('usar-muestra-cantidad').classList.add('ayuda-senal');
    document.getElementById('usar-muestra-cantidad').scrollIntoView({ block: 'center' });
  });
  await pausa(400);
  await foto('03-apuntar-uso-volumen.png');

  // 4 · Apuntado: el aviso con «Deshacer» y el aviso en la ficha
  await limpiar();
  await page.evaluate(async () => {
    _congMuestraSel = 'MEJ1'; renderCongelados();
    openModalUsarMuestra('MEJ1');
    sv('usar-muestra-motivo', 'Práctica');
    const m = DATA.muestrasCongeladas.find(x => x.ID_Muestra === 'MEJ1');
    window.callEdgeFunction = async () => ({
      muestra: { id_muestra: 'MEJ1', id_lote: m.ID_Lote, tipo: 'Cepa', nombre: m.Nombre, abreviatura: m.Abreviatura, id_caja: 'CAJEJ1', posicion: 'A1', formato: 'Bolitas',
        cantidad_inicial: 25, cantidad_actual: 17, unidad: 'bolitas', estado: 'Disponible', fecha_congelacion: m.Fecha_Congelacion, pase: m.Pase, datos: m.Datos, creado_por: m.Creado_Por },
      uso: { id_uso: 'USEJ2', id_muestra: 'MEJ1', id_lote: m.ID_Lote, evento: 'Uso', motivo: 'Práctica', cantidad: 1, unidad: 'bolitas', restante: 17,
        autor: '1º CS EJEMPLO', fecha: new Date().toISOString() },
    });
    await confirmarUsarMuestra();
    const av = document.querySelector('#cong-ficha .cong-aviso-deshacer');
    av?.classList.add('ayuda-senal');
    document.getElementById('cong-ficha').scrollIntoView({ block: 'start' }); window.scrollBy(0, -90);
  });
  await pausa(500);
  await foto('04-deshacer.png');
  return 'ok';
}
