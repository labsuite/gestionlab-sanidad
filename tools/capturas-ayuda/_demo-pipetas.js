// Datos de ejemplo para las capturas de la verificación de micropipetas (MAN-10, MAN-11, MAN-12).
// Lo cargan los guiones con:
//   await eval(fs.readFileSync(path.join(__dirname, '_demo-pipetas.js'), 'utf8'))(page, APP, 'Alumno' | 'Profesor', { sinPreparacion })
// - Pipetas reales del laboratorio 203 (sus datos de verificación y su revisión anual, copiados
//   de la base el 25/11/2026; no son datos personales): PIP-035 (Socorex Acura 825, 20–200 µl),
//   PIP-047 (Socorex Acura 821, 100–1 000 µl) y PIP-055 (Lan Technics, tornillo «por comprobar»).
// - Preparación del curso y sesión: los datos de ejemplo del apartado 11.1 del encargo
//   (ENCARGO_calculos_verificacion_micropipetas.md), los mismos de tools/verif-pipetas/casos.test.mjs.
//   La app calcula la sesión con su propio módulo (no hay resultados inventados), salvo la
//   validación del método, que se da por hecha en una sesión anterior.
// - Cuenta de grupo y docente ficticios, ningún nombre de persona. No llama al servidor.
async (page, APP, rol, opciones = {}) => {
  await page.goto(APP + '?capturas=' + Date.now());
  await page.waitForFunction(() => document.getElementById('modal-verif-pipeta') && typeof renderAyuda === 'function' && window.VP, null, { timeout: 30000 });
  await page.evaluate(({ rol, PIP, opciones }) => {
    'adicionesResiduo cajasCongelado ciclosModulos configReservas consultasResiduo contenedoresResiduo documentosProveedor equipos evaluacionesCurso excepcionesResiduoIa fichasAtributos historicoPrecio incidencias intervenciones lineasPedido material materialUbicaciones movimientos muestrasCongeladas pedidos planesMantenimiento propuestasMaterial propuestasUbicacion proveedores registroMantenimientos registrosAutoclave registrosCabina registrosVitrina reservas revisionesInventario sbUsuarios solicitudes tareas tareasIntervencion tiposResiduo ubicaciones userModulos usosMuestra usuarios verifParametros verifPreparaciones verifSesiones verifExtraordinarias'
      .split(' ').forEach(k => { DATA[k] = []; });
    const alumno = rol === 'Alumno';
    const EMAIL = alumno ? '1cslcb@gestionlab.cma' : 'docente@ejemplo.invalid';
    currentUser = { email: EMAIL, name: alumno ? '1º CS LCB' : 'Docente de ejemplo' };
    DATA.usuarios = [
      { ID_Usuario: 'USR-EJ', Nombre: alumno ? '1º CS LCB' : 'Docente de ejemplo', Email: EMAIL, Rol: rol, Activo: 'TRUE', Ubicaciones_Asignadas: '203' },
    ];
    DATA.equipos = Object.entries(PIP).map(([id, p]) => _equipoSbToObj({ id_activo: id, tipo_equipo: p.tipo, marca: p.marca, modelo: p.modelo,
      ubicacion: p.ubicacion, estado_operativo: 'Operativo', responsable: 'Docente de ejemplo' }));
    DATA.planesMantenimiento = Object.entries(PIP).map(([id, p]) => _planMantenimientoSbToObj({ id_plan: 'PDEMO-' + id, id_equipo: id,
      tipo_intervencion: 'Interno', periodicidad: 'Pretemporada', operacion: p.operacion, instrucciones: p.instrucciones, activo: true, solo_profesorado: false }));
    DATA.verifParametros = Object.values(PIP).map(p => ({ ...p.par }));
    const curso = getCursoAcademico();
    const [a1, a2] = curso.split('-');
    DATA.evaluacionesCurso = [[1, `${a1}-09-01`, `${a1}-12-04`], [2, `${a1}-12-05`, `${a2}-03-05`], [3, `${a2}-03-06`, `${a2}-06-04`]]
      .map(([numero, fecha_inicio, fecha_fin]) => _evaluacionCursoSbToObj({ curso_academico: curso, numero, fecha_inicio, fecha_fin }));
    // Preparación del curso (apartado 11.1)
    const PREP = {
      SA: { m_tartrazina: '0,101', m_agua: '50,014' },
      SB: { m_sa: '10,003', m_agua: '40,002' }, SC: { m_sa: '7,501', m_agua: '142,504' },
      D1: { m_sa: '1,001', m_agua: '9,004' }, D2: { m_d1: '3,001', m_agua: '27,002' },
      P: [{ parte: 'D2', m_partida: '3,003', m_agua: '27,001' }, { parte: 'D2', m_partida: '7,504', m_agua: '22,502' },
          { parte: 'D2', m_partida: '15,002', m_agua: '15,004' }, { parte: 'D1', m_partida: '2,251', m_agua: '27,752' },
          { parte: 'D1', m_partida: '3,002', m_agua: '27,003' }],
    };
    const TUBOS = [['S-A', '13,251', '43,203'], ['S-B', '13,248', '43,262'], ['S-C', '13,250', '43,262'],
      ['P1', '6,812', '16,840'], ['P2', '6,807', '16,833'], ['P3', '6,815', '16,846'], ['P4', '6,810', '16,838'], ['P5', '6,809', '16,842']]
      .map(([d, v, l]) => ({ id: 'T1-' + d, disolucion: d, bloque: '1', m_vacio: v, m_lleno: l }));
    if (!opciones.sinPreparacion) {
      DATA.verifPreparaciones = [{ id: 'VP-EJ', curso_academico: curso, datos: PREP, tubos: TUBOS, registrado_por: 'Docente de ejemplo' }];
    }
    window._demoPrep = { PREP, TUBOS };
    // Sesión del día (apartado 11.1): tubos pesados antes de abrirlos, recta, comprobaciones y CV de lectura.
    const hoy = new Date().toISOString().slice(0, 10);
    const menos = (x, d) => (parseFloat(x.replace(',', '.')) - d).toFixed(3).replace('.', ',');
    const SES = {
      temperatura: '22', balanzas: ['BAL-003'], blanco_inicio: '0,001', blanco_final: '0,002',
      tubos: Object.fromEntries(TUBOS.map(t => [t.id, { m_ahora: t.disolucion === 'S-C' ? '43,240' : menos(t.m_lleno, t.disolucion.startsWith('P') ? 0.004 : 0.012) }])),
      abs_P: ['0,101', '0,249', '0,497', '0,752', '0,998'],
      comprobaciones: { 'S-A': { m1: '1,000', m2: '9,002', m3: '1,001', m4: '9,000', A: '0,998' },
        'S-B': { m: '1,002', m_agua: '24,003', A: '0,797' }, 'S-C': { m: '2,001', m_agua: '10,502', A: '0,799' } },
      lecturas_cv: ['0,799', '0,800', '0,799', '0,798', '0,800', '0,799', '0,801', '0,799', '0,800', '0,799'],
    };
    window._demoSes = SES;
    if (!opciones.sinSesion && !opciones.sinPreparacion) {
      DATA.verifSesiones = [
        // La validación del método se dio por buena en la primera sesión del curso.
        { id: 'VS-EJ0', curso_academico: curso, fecha: `${a1}-09-02`, bloque: '1', datos: {}, resultados: { validacion: { ok: true, pruebas: [] }, valida_fot: true, valida_grav: true, motivos_fot: [], motivos_grav: [], disoluciones: {} } },
        { id: 'VS-EJ1', curso_academico: curso, fecha: hoy, bloque: '1', personas: 'Docente de ejemplo · 1º CS LCB', datos: JSON.parse(JSON.stringify(SES)) },
      ];
      const s = DATA.verifSesiones[1];
      s.resultados = VP.calcularSesion(s, _vpCtxSesion(s));
    }
    document.getElementById('auth-screen').style.display = 'none';
    showApp();
    renderAll();
    const st = document.createElement('style');
    st.textContent = '.ayuda-senal{outline:3px solid #e8590c !important;outline-offset:2px;border-radius:8px;box-shadow:0 0 0 6px rgba(232,89,12,.18) !important}';
    document.head.appendChild(st);
    window._demo = { curso, hoy };
  }, { rol, PIP: {"PIP-055": {"par": {"id_activo": "PIP-055", "marca_modelo": "Lan Technics", "multicanal": false, "rango": "20–200 µl", "confirmar": null, "ajuste_usuario": "por comprobar (tornillo bajo la tapa del émbolo)", "v_nominal": 200.0, "metodo_nominal": "fotométrico", "patron_nominal": "S-C", "masa_nominal_g": 1.0, "es_nominal_pct": 0.8, "cv_nominal_pct": 0.3, "v_bajo": 20.0, "metodo_bajo": "fotométrico", "patron_bajo": "S-B", "masa_bajo_g": 1.0, "es_bajo_pct": 8.0, "cv_bajo_pct": 3.0, "fuente_limites": "ISO 8655-2", "notas": null}, "operacion": "Revisión anual de arranque de temporada", "instrucciones": "Limpiar el exterior y el eyector\nDesmontar la parte inferior (9.1–9.2)\nRevisar junta tórica y pistón\nRevisar el engrase del pistón (9.4)\nMontar\nPrueba de estanqueidad al máximo y al mínimo (6.1) (criterio: Sin gota ni descenso en 30 s; si falla, apartado 10 y no se verifica)\nComprobar que hay puntas de la marca validada para esta pipeta (apartado 5) y usarlas en la verificación (criterio: Puntas compatibles en stock)\nVerificar en una sesión fotométrica en la que la recta y las diluciones de comprobación hayan salido bien (anexo A, 5.1)\n200 µl (nominal): 4 réplicas fotométricas, disolución S-C, tubos con 1,000 g de agua pesada (criterio: error sistemático ≤ ±0,8 %; CV ≤ 0,3 %)\n20 µl (mínimo): 4 réplicas fotométricas, disolución S-B, tubos con 1,000 g de agua pesada (criterio: error sistemático ≤ ±8 %; CV ≤ 3 %)\nSi GestionLab marca «Completar» en algún volumen: réplicas 5 a 10 con punta nueva; decide con las 10\nResultado según el cálculo de GestionLab: OK, ajustar (6.3, y después 10 réplicas a los dos volúmenes) o retirar («NO USAR» e incidencia en GestionLab)\nEtiqueta en la pipeta con la fecha y el resultado (criterio: Etiqueta puesta)\nGuardar vertical en su soporte", "tipo": "Micropipeta", "marca": "Lan Technics", "modelo": "no presenta", "ubicacion": "Lab 203"}, "PIP-047": {"par": {"id_activo": "PIP-047", "marca_modelo": "Socorex Acura 821", "multicanal": false, "rango": "100–1 000 µl", "confirmar": null, "ajuste_usuario": "sí", "v_nominal": 1000.0, "metodo_nominal": "gravimétrico", "patron_nominal": null, "masa_nominal_g": null, "es_nominal_pct": 0.5, "cv_nominal_pct": 0.2, "v_bajo": 100.0, "metodo_bajo": "fotométrico", "patron_bajo": "S-C", "masa_bajo_g": 1.0, "es_bajo_pct": 1.5, "cv_bajo_pct": 0.5, "fuente_limites": "Socorex", "notas": null}, "operacion": "Revisión anual de arranque de temporada", "instrucciones": "Limpiar el exterior y el eyector\nDesmontar la parte inferior (9.1–9.2)\nRevisar junta tórica y pistón\nRevisar el engrase del pistón (9.4)\nMontar\nPrueba de estanqueidad al máximo y al mínimo (6.1) (criterio: Sin gota ni descenso en 30 s; si falla, apartado 10 y no se verifica)\nComprobar que hay puntas de la marca validada para esta pipeta (apartado 5) y usarlas en la verificación (criterio: Puntas compatibles en stock)\nVerificar en una sesión fotométrica en la que la recta y las diluciones de comprobación hayan salido bien (anexo A, 5.1) y con la BTC-223 encendida 30 min y agua y pipeta en la sala desde 2 h antes (6.2)\n1 000 µl (nominal): 4 pesadas en la BTC-223 (6.2) (criterio: error sistemático ≤ ±0,5 %; CV ≤ 0,2 %)\n100 µl (mínimo): 4 réplicas fotométricas, disolución S-C, tubos con 1,000 g de agua pesada (criterio: error sistemático ≤ ±1,5 %; CV ≤ 0,5 %)\nSi GestionLab marca «Completar» en algún volumen: réplicas 5 a 10 con punta nueva; decide con las 10\nResultado según el cálculo de GestionLab: OK, ajustar (6.3, y después 10 réplicas a los dos volúmenes) o retirar («NO USAR» e incidencia en GestionLab)\nEtiqueta en la pipeta con la fecha y el resultado (criterio: Etiqueta puesta)\nGuardar vertical en su soporte", "tipo": "Micropipeta", "marca": "Socorex", "modelo": "Acura 821", "ubicacion": "Lab 203"}, "PIP-035": {"par": {"id_activo": "PIP-035", "marca_modelo": "Socorex Acura 825", "multicanal": false, "rango": "20–200 µl", "confirmar": null, "ajuste_usuario": "sí", "v_nominal": 200.0, "metodo_nominal": "fotométrico", "patron_nominal": "S-C", "masa_nominal_g": 1.0, "es_nominal_pct": 0.6, "cv_nominal_pct": 0.2, "v_bajo": 20.0, "metodo_bajo": "fotométrico", "patron_bajo": "S-B", "masa_bajo_g": 1.0, "es_bajo_pct": 1.5, "cv_bajo_pct": 0.6, "fuente_limites": "Socorex", "notas": null}, "operacion": "Revisión anual de arranque de temporada", "instrucciones": "Limpiar el exterior y el eyector\nDesmontar la parte inferior (9.1–9.2)\nRevisar junta tórica y pistón\nRevisar el engrase del pistón (9.4)\nMontar\nPrueba de estanqueidad al máximo y al mínimo (6.1) (criterio: Sin gota ni descenso en 30 s; si falla, apartado 10 y no se verifica)\nComprobar que hay puntas de la marca validada para esta pipeta (apartado 5) y usarlas en la verificación (criterio: Puntas compatibles en stock)\nVerificar en una sesión fotométrica en la que la recta y las diluciones de comprobación hayan salido bien (anexo A, 5.1)\n200 µl (nominal): 4 réplicas fotométricas, disolución S-C, tubos con 1,000 g de agua pesada (criterio: error sistemático ≤ ±0,6 %; CV ≤ 0,2 %)\n20 µl (mínimo): 4 réplicas fotométricas, disolución S-B, tubos con 1,000 g de agua pesada (criterio: error sistemático ≤ ±1,5 %; CV ≤ 0,6 %)\nSi GestionLab marca «Completar» en algún volumen: réplicas 5 a 10 con punta nueva; decide con las 10\nResultado según el cálculo de GestionLab: OK, ajustar (6.3, y después 10 réplicas a los dos volúmenes) o retirar («NO USAR» e incidencia en GestionLab)\nEtiqueta en la pipeta con la fecha y el resultado (criterio: Etiqueta puesta)\nGuardar vertical en su soporte", "tipo": "Micropipeta", "marca": "Socorex", "modelo": "Acura 825", "ubicacion": "Lab 203"}}, opciones });
}
