// Muestras congeladas de ejemplo para MUE-1 y MUE-2 (se cargan DESPUÉS de _demo-alumno.js).
// Cepas de colección y un ADN de práctica: nunca datos de pacientes.
async (page) => {
  await page.evaluate(() => {
    const a1 = getCursoAcademico().slice(0, 4);
    const cepa = (id, pos, nombre, abrev, especie, coleccion, gr, pase, actual, extra = {}) => _muestraCongeladaSbToObj({
      id_muestra: id, id_lote: 'LOTEJ-' + abrev + pase, tipo: 'Cepa', nombre, abreviatura: abrev, id_caja: 'CAJEJ1', posicion: pos,
      formato: 'Bolitas', cantidad_inicial: 25, cantidad_actual: actual, unidad: 'bolitas', estado: 'Disponible', fecha_congelacion: `${a1}-10-15`, pase,
      datos: { especie, coleccion, grupo_riesgo: gr, medio: 'Crioviales con bolitas (Microbank o similar)', pase_max: '5',
        ref_nombre: `${nombre} (cepa de referencia comercial)`, ref_lote: '485-112-3', ref_apertura: `${a1}-10-03` }, creado_por: 'Docente de ejemplo', ...extra });
    DATA.muestrasCongeladas = [
      cepa('MEJ1', 'A1', 'Escherichia coli ATCC 25922', 'ECO', 'Escherichia coli', 'ATCC 25922', '1', 2, 18),
      cepa('MEJ2', 'A2', 'Escherichia coli ATCC 25922', 'ECO', 'Escherichia coli', 'ATCC 25922', '1', 2, 25),
      cepa('MEJ3', 'A3', 'Staphylococcus aureus ATCC 25923', 'SAU', 'Staphylococcus aureus', 'ATCC 25923', '2', 5, 4),
      cepa('MEJ4', 'B1', 'Pseudomonas aeruginosa ATCC 27853', 'PAE', 'Pseudomonas aeruginosa', 'ATCC 27853', '2', 1, 22),
      _muestraCongeladaSbToObj({ id_muestra: 'MEJ5', id_lote: 'LOTEJ-ADN1', tipo: 'Ácido nucleico', nombre: 'ADN genómico de E. coli (práctica de PCR)', abreviatura: 'ADN',
        id_caja: 'CAJEJ1', posicion: 'C1', formato: 'Volumen', cantidad_inicial: 100, cantidad_actual: 60, unidad: 'µL', descongelaciones: 2, estado: 'Disponible',
        fecha_congelacion: `${a1}-11-04`, datos: { tipo_an: 'ADN genómico', origen: 'Cultivo de E. coli ATCC 25922, práctica 4', concentracion: '85' }, creado_por: 'Docente de ejemplo' }),
    ];
    DATA.usosMuestra = [_usoMuestraSbToObj({ id_uso: 'USEJ1', id_muestra: 'MEJ1', id_lote: 'LOTEJ-ECO2', evento: 'Uso', motivo: 'Práctica', cantidad: 1, unidad: 'bolitas',
      restante: 18, autor: '2º CS EJEMPLO', fecha: `${a1}-11-20T10:12:00` })];
    renderAll();
  });
}
