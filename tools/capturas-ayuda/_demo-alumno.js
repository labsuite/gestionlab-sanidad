// Datos de ejemplo comunes para las capturas del manual del alumnado (EMP-1, EMP-6…).
// Lo cargan los guiones de tarea con: await eval(fs.readFileSync(path.join(__dirname, '_demo-alumno.js'), 'utf8'))(page, APP)
// Cuenta de grupo ficticia, equipos y planes reales (no son datos personales) y ningún
// nombre de persona. No llama al servidor: la app se abre sin sesión.
async (page, APP) => {
  await page.goto(APP + '?capturas=' + Date.now());
  await page.waitForFunction(() => document.getElementById('modal-registrar-mant') && typeof renderAyuda === 'function', null, { timeout: 30000 });
  await page.evaluate(() => {
    'adicionesResiduo cajasCongelado ciclosModulos configReservas consultasResiduo contenedoresResiduo documentosProveedor equipos evaluacionesCurso excepcionesResiduoIa fichasAtributos historicoPrecio incidencias intervenciones lineasPedido material materialUbicaciones movimientos muestrasCongeladas pedidos planesMantenimiento propuestasMaterial propuestasUbicacion proveedores registroMantenimientos registrosAutoclave registrosCabina registrosVitrina reservas revisionesInventario sbUsuarios solicitudes tareas tareasIntervencion tiposResiduo ubicaciones userModulos usosMuestra usuarios'
      .split(' ').forEach(k => { DATA[k] = []; });
    const EMAIL = 'ejemplo@gestionlab.cma';
    currentUser = { email: EMAIL, name: '1º CS EJEMPLO' };
    DATA.usuarios = [{ ID_Usuario: 'USR-EJ', Nombre: '1º CS EJEMPLO', Email: EMAIL, Rol: 'Alumno', Activo: 'TRUE', Ubicaciones_Asignadas: '203,205' }];
    const eq = (id, tipo, marca, modelo, ubic) => _equipoSbToObj({ id_activo: id, tipo_equipo: tipo, marca, modelo, ubicacion: ubic, estado_operativo: 'Operativo', responsable: 'Docente de ejemplo' });
    DATA.equipos = [
      eq('CAB-03', 'Cabina de seguridad biológica', 'Telstar', 'BioVanguard Green Line', 'Lab 205'),
      eq('AUTC-001', 'Autoclave', 'J.P. Selecta', 'Presoclave', 'Lab 205'),
      eq('BAT-06', 'Baño termostático', 'J.P. Selecta', 'Precisterm', 'Lab 205'),
      eq('BAL-003', 'Balanza', 'Phoenix Instrument', 'BTC-223', '205-ZC'),
      eq('CON-01', 'Congelador -80 °C', 'Ejemplo', '', 'Lab 205'),
      eq('CEN-08', 'Centrífuga', 'Ortoalresa', 'Digicen 21', 'Lab 203'),
      eq('MIC-21', 'Microscopio', 'Olympus', 'CX22LED', 'Lab 207'),   // de otro laboratorio: el grupo no lo ve en su panel
    ];
    DATA.equipos.find(e => e.ID_Activo === 'CEN-08').Estado_Operativo = 'Averiado';
    DATA.equipos.find(e => e.ID_Activo === 'MIC-21').Estado_Operativo = 'Averiado';
    DATA.incidencias = [_incidenciaSbToObj({ id_incidencia: 'INC-EJ1', id_equipo: 'BAL-003', reportado_por: '1º CS EJEMPLO',
      descripcion_problema: 'La pesa de 100 g marca 100,6 g; criterio ± 0,2 g.', impacto: 'Uso limitado', urgencia: 'Normal', estado: 'Abierta', fecha_hora: new Date().toISOString() })];
    const curso = getCursoAcademico();
    const [a1, a2] = curso.split('-');
    DATA.evaluacionesCurso = [[1, `${a1}-09-01`, `${a1}-12-04`], [2, `${a1}-12-05`, `${a2}-03-05`], [3, `${a2}-03-06`, `${a2}-06-04`]]
      .map(([numero, fecha_inicio, fecha_fin]) => _evaluacionCursoSbToObj({ curso_academico: curso, numero, fecha_inicio, fecha_fin }));
    DATA.planesMantenimiento = [
      _planMantenimientoSbToObj({ id_plan: 'PEJ1', id_equipo: 'BAT-06', tipo_intervencion: 'Interno', periodicidad: 'Trimestral', operacion: 'Descalcificación preventiva', activo: true, solo_profesorado: false,
        instrucciones: 'Prueba rápida (6.1): display frente a termómetro de referencia, homogeneidad, nivel, cal, cable (criterio: Δ ≤ 1 °C (≤ 0,5 °C en 37 °C); cubeta sin cal)\nDescalcificación preventiva de cubeta y calefactor (vinagre o HCl 10 %) si el agua es de red\nReposición del carbonato de sodio al cambiar el agua (criterio: Calefactor sin cal)' }),
      _planMantenimientoSbToObj({ id_plan: 'PEJ2', id_equipo: 'BAL-003', tipo_intervencion: 'Interno', periodicidad: 'Trimestral', operacion: 'Verificación con pesa', activo: true, solo_profesorado: false, instrucciones: 'Paso' }),
    ];
    // Ubicaciones, material y residuos de ejemplo
    DATA.ubicaciones = [
      _ubicacionSbToObj({ id_ubicacion: '205-ZC-1.1', laboratorio_aula: '205 - Zona común', zona: 'Armario 1', subzona: 'Balda 1', descripcion_completa: 'Zona común · Armario 1 · Balda 1', activa: true }),
      _ubicacionSbToObj({ id_ubicacion: '205-1.7', laboratorio_aula: '205', zona: 'Poyata 1', subzona: 'Cajón 7', descripcion_completa: 'Lab 205 · Poyata 1 · Cajón 7', activa: true }),
    ];
    DATA.material = [
      _materialSbToObj({ id_material: 'MATEJ1', nombre: 'Puntas de pipeta 200 µL', categoria: 'Material fungible', unidad: 'caja/s', stock_actual: 6, stock_minimo: 2, stock_optimo: 8 }),
      _materialSbToObj({ id_material: 'MATEJ2', nombre: 'Guantes de nitrilo talla M', categoria: 'EPI y seguridad', unidad: 'caja/s', stock_actual: 1, stock_minimo: 3, stock_optimo: 10 }),
    ];
    DATA.materialUbicaciones = [
      _materialUbicacionSbToObj({ id: 'LUEJ1', id_material: 'MATEJ1', id_ubicacion: '205-ZC-1.1', stock_local: 6, stock_minimo_local: 2, stock_optimo_local: 8 }),
      _materialUbicacionSbToObj({ id: 'LUEJ2', id_material: 'MATEJ2', id_ubicacion: '205-ZC-1.1', stock_local: 1, stock_minimo_local: 3, stock_optimo_local: 10 }),
    ];
    DATA.tiposResiduo = [
      _tipoResiduoSbToObj({ id_residuo: 'RESEJ1', nombre: 'Puntas de pipeta contaminadas', riesgo: '', contenedor_tipo: 'Biosanitario', lab: '205', zona: '' }),
      _tipoResiduoSbToObj({ id_residuo: 'RESEJ2', nombre: 'Placas de Petri con cultivos', riesgo: '', contenedor_tipo: 'Biosanitario', lab: '205', zona: '' }),
    ];
    DATA.contenedoresResiduo = [
      _contenedorResiduoSbToObj({ id_contenedor: 'CONTEJ1', categoria: 'Biosanitario', lab: '205', zona: 'Poyata 1', nivel: '25%', estado: 'activo', fecha_apertura: `${a1}-11-02` }),
    ];
    // Congelador con una caja y algunos tubos
    DATA.cajasCongelado = [_cajaCongeladoSbToObj({ id_caja: 'CAJEJ1', nombre: 'Cepario docente', id_equipo: 'CON-01', compartimento: 'Balda 2', filas: 9, columnas: 9, activa: true })];
    const tubo = (id, pos, nombre, abrev) => _muestraCongeladaSbToObj({ id_muestra: id, id_lote: 'LOTEJ-' + abrev, tipo: 'Cepa', nombre, abreviatura: abrev, id_caja: 'CAJEJ1', posicion: pos, formato: 'Bolitas', cantidad_inicial: 25, cantidad_actual: 18, unidad: 'bolitas', estado: 'Disponible', fecha_congelacion: `${a1}-10-15` });
    DATA.muestrasCongeladas = [tubo('MEJ1', 'A1', 'Escherichia coli ATCC 25922', 'ECO'), tubo('MEJ2', 'A2', 'Escherichia coli ATCC 25922', 'ECO'),
      tubo('MEJ3', 'A3', 'Staphylococcus aureus ATCC 25923', 'SAU'), tubo('MEJ4', 'B1', 'Pseudomonas aeruginosa ATCC 27853', 'PAE')];
    document.getElementById('auth-screen').style.display = 'none';
    showApp();
    renderAll();
    const st = document.createElement('style');
    st.textContent = '.ayuda-senal{outline:3px solid #e8590c !important;outline-offset:2px;border-radius:8px;box-shadow:0 0 0 6px rgba(232,89,12,.18) !important}';
    document.head.appendChild(st);
    window._demo = { EMAIL, curso };
  });
}
