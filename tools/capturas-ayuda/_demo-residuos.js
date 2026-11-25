// Residuos de ejemplo para las capturas de RES-1 y RES-2 (se cargan DESPUÉS de _demo-alumno.js).
// Categorías reales del catálogo; residuos y contenedores ficticios. Sin nombres de personas.
async (page) => {
  await page.evaluate(() => {
    const a1 = getCursoAcademico().slice(0, 4);
    const t = (id, nombre, cat, riesgo = '') => _tipoResiduoSbToObj({ id_residuo: id, nombre, contenedor_tipo: cat, riesgo, descripcion: '' });
    DATA.tiposResiduo = [
      t('RESEJ1', 'Restos de tinción de Gram (cristal violeta, lugol, safranina)', 'Aguas Laboratorio - Tinciones', 'Nocivo / Irritante'),
      t('RESEJ2', 'Restos de tinción de hematoxilina-eosina', 'Aguas Laboratorio - Tinciones', 'Nocivo / Irritante'),
      t('RESEJ3', 'Material fungible contaminado con muestras biológicas', 'Bolsa de autoclave'),
      t('RESEJ4', 'Medios de cultivo líquidos con crecimiento bacteriano', 'Bolsa de autoclave'),
      t('RESEJ5', 'Formol al 10 % sin muestra', 'Contenedor Inertes', 'Cancerígeno / CMR'),
      t('RESEJ6', 'Ácido clorhídrico diluido', 'Contenedor Ácidos', 'Corrosivo'),
      t('RESEJ7', 'Lejía diluida de la limpieza de equipos', 'Aguas Laboratorio - Equipos', 'Corrosivo'),
    ];
    const c = (id, cat, lab, formato, nivel, zona) => _contenedorResiduoSbToObj({ id_contenedor: id, categoria: cat, lab, formato, nivel, zona, estado: 'activo', fecha_apertura: `${a1}-10-05` });
    DATA.contenedoresResiduo = [
      c('CONTEJ1', 'Aguas Laboratorio - Tinciones', '205', 'Garrafa 20L', '50%', 'Fregadero central'),
      c('CONTEJ2', 'Bolsa de autoclave', '205', 'Bolsa de autoclave', '25%', 'Junto a la cabina'),
      c('CONTEJ3', 'Aguas Laboratorio - Tinciones', '203', 'Garrafa 20L', 'vacío', 'Bajo la poyata 1'),
      c('CONTEJ4', 'Contenedor Ácidos', '207', 'Bidón azul 30L', '25%', 'Almacén de residuos'),
      c('CONTEJ5', 'Contenedor Inertes', '207', 'Bidón 30L', '25%', 'Almacén de residuos'),
    ];
    DATA.adicionesResiduo = [_adicionResiduoSbToObj({ id_adicion: 'ADEJ1', id_contenedor: 'CONTEJ1', id_residuo: 'RESEJ1',
      fecha: `${a1}-11-18`, usuario: '1º CS EJEMPLO', observaciones: 'Práctica de Gram, 200 ml' })];
    renderAll();
  });
}
