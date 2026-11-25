// Capturas de EQU-4 «Reservar un equipo» (común). `node tools/capturas-ayuda/capturar.js EQU-4`.
// Datos de _demo-alumno.js + una incubadora reservable (configuración real de INC-02) y reservas de
// ejemplo: del grupo y de otro grupo ficticio. No llama al servidor.
async (page, { app: APP, salida: SALIDA }) => {
  const fs = require('fs'), path = require('path');
  const foto = (nombre, opts = {}) => page.screenshot({ path: SALIDA + nombre, ...opts });
  const pausa = ms => page.waitForTimeout(ms);
  const limpiar = () => page.evaluate(() => {
    document.querySelectorAll('.ayuda-senal').forEach(e => e.classList.remove('ayuda-senal'));
    document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open'));
  });
  await eval(fs.readFileSync(path.join(__dirname, '_demo-alumno.js'), 'utf8'))(page, APP);
  await page.evaluate(() => {
    DATA.equipos.push(_equipoSbToObj({ id_activo: 'INC-02', tipo_equipo: 'Incubadora', marca: 'J.P. Selecta', modelo: 'Prebatem-TFT', ubicacion: 'Lab 205', estado_operativo: 'Operativo' }));
    DATA.configReservas = [_configReservaSbToObj({ id_equipo: 'INC-02', politica: 'COMPATIBLE_CONDITIONS', max_horas: 48, antelacion_min_horas: 1,
      params_template: [{ key: 'temperatura', max: 42, min: 4, type: 'number', label: 'Temperatura (°C)', tolerance: 0.5 }, { key: 'co2', max: 10, min: 0, type: 'number', label: 'CO₂ (%)', tolerance: 0.2 }] })];
    const dia = (n, h) => { const d = new Date(); d.setDate(d.getDate() + n); d.setHours(h, 0, 0, 0); return d.toISOString(); };
    const r = (id, usuario, ini, fin, estado, prop, extra = {}) => _reservaSbToObj({ id_reserva: id, id_equipo: 'INC-02', usuario, fecha_inicio: ini, fecha_fin: fin,
      proposito: prop, estado, condiciones: { temperatura: 37, co2: 5 }, ...extra });
    const yo = _demo.EMAIL, otro = 'otrogrupo@gestionlab.cma';
    const ahora = new Date(); const h = ahora.getHours();
    DATA.reservas = [
      r('RSEJ1', yo, dia(0, Math.max(7, h - 1)), dia(0, Math.min(21, h + 3)), 'Activa', 'Incubación de las siembras de Gram · Microbiología', { inicio_real: dia(0, Math.max(7, h - 1)) }),
      r('RSEJ2', yo, dia(1, 9), dia(2, 9), 'Confirmada', 'Antibiograma, lectura a las 24 h · Microbiología'),
      r('RSEJ3', yo, dia(3, 10), dia(3, 14), 'Pendiente', 'Cultivo celular · Biología molecular', { condiciones: { temperatura: 37, co2: 5 } }),
      r('RSEJ4', otro, dia(1, 8), dia(1, 15), 'Confirmada', 'Hemocultivos · Microbiología'),
    ];
    showPage('reservas'); _reservaTab = 'disponibilidad'; _reservaEquipoDisp = 'INC-02'; renderReservas(); window.scrollTo(0, 0);
  });

  // 1 · El calendario de los próximos 14 días
  await page.evaluate(() => {
    document.getElementById('disp-timeline-container').classList.add('ayuda-senal');
  });
  await pausa(300);
  await foto('01-calendario.png');

  // 2 · Nueva reserva con el aviso «Disponible»
  await limpiar();
  await page.evaluate(() => {
    openModalNuevaReserva('INC-02');
    const d = new Date(); d.setDate(d.getDate() + 5);
    const f = d.toISOString().slice(0, 10);
    sv('reserva-fecha', f); sv('reserva-fecha-fin', f);
    sv('reserva-hora-inicio', '09:00'); sv('reserva-hora-fin', '13:00');
    sv('reserva-proposito', 'Siembra de coprocultivos · Microbiología');
    document.querySelectorAll('#reserva-params-container input').forEach((i, k) => { i.value = k === 0 ? '37' : '5'; });
    _actualizarVerificacion();
    const res = document.getElementById('reserva-disponibilidad-result');
    res.classList.add('ayuda-senal'); res.scrollIntoView({ block: 'center' });
  });
  await pausa(400);
  await foto('02-nueva-reserva.png');

  // 3 · Mis reservas: en uso (Finalizar), confirmada (Iniciar uso, Cancelar) y pendiente
  await limpiar();
  await page.evaluate(() => {
    _reservaTab = 'mis-reservas'; renderReservas(); window.scrollTo(0, 0);
    document.getElementById('reserva-tab-mis-reservas').classList.add('ayuda-senal');
  });
  await pausa(300);
  await foto('03-mis-reservas.png', { fullPage: true });
  return 'ok';
}
