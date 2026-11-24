// Casos de prueba del apartado 11 de ENCARGO_calculos_verificacion_micropipetas.md
// (valores de Verificacion_fotometrica_micropipetas.xlsx, recalculada el 24/11/2026).
// La app tiene que dar la misma decisión y los mismos números (±0,01 en %, ±0,01 µl).
// Ejecutar: node tools/verif-pipetas/casos.test.mjs
import * as V from '../../supabase/functions/_shared/verif_pipetas.js';

let fallos = 0, pruebas = 0;
function igual(nombre, real, esperado, tol) {
  pruebas++;
  const ok = tol === undefined ? real === esperado : Math.abs(real - esperado) <= tol;
  if (!ok) { fallos++; console.log(`✗ ${nombre}: ${real} (esperado ${esperado}${tol !== undefined ? ' ± ' + tol : ''})`); }
  else console.log(`✓ ${nombre}: ${typeof real === 'number' ? +real.toFixed(7) : real}`);
}

// ── 11.1 Preparación y sesión ──
const prep = V.calcularPreparacion({
  SB: { m_sa: '10,003', m_agua: '40,002' }, SC: { m_sa: '7,501', m_agua: '142,504' },
  D1: { m_sa: '1,001', m_agua: '9,004' }, D2: { m_d1: '3,001', m_agua: '27,002' },
  P: [{ parte: 'D2', m_partida: '3,003', m_agua: '27,001' }, { parte: 'D2', m_partida: '7,504', m_agua: '22,502' },
      { parte: 'D2', m_partida: '15,002', m_agua: '15,004' }, { parte: 'D1', m_partida: '2,251', m_agua: '27,752' },
      { parte: 'D1', m_partida: '3,002', m_agua: '27,003' }],
});
igual('F_B', prep.F_B, 4.99900, 0.000005);
igual('F_C', prep.F_C, 19.99800, 0.000005);
igual('f_D1', prep.f_D1, 0.100050, 0.0000005);
igual('f_D2', prep.f_D2, 0.0100073, 0.00000005);
[0.00100160, 0.00250267, 0.00500333, 0.00750633, 0.01001000].forEach((f, i) => igual(`f_P${i + 1}`, prep.P[i], f, 0.000000005));

const recta = V.calcularRecta(prep.P, ['0,101', '0,249', '0,497', '0,752', '0,998']);
igual('k', recta.k, 99.7975, 0.00005);
igual('a', recta.a, -0.0000205, 0.00000005);
igual('r²', recta.r2, 0.999978, 0.0000005);
igual('residuo máximo', recta.residuoMax, 0.0029, 0.00005);
igual('recta válida', recta.valida, true);

const cSA = V.calcularComprobacion('S-A', { m1: '1,000', m2: '9,002', m3: '1,001', m4: '9,000', A: '0,998' }, prep, recta);
igual('S-A f esperada', cSA.fEsperada, 0.0100070, 0.00000005); igual('S-A f leída', cSA.fLeida, 0.0100005, 0.00000005);
igual('S-A diferencia %', cSA.dif, -0.07, 0.01); igual('S-A OK', cSA.ok, true);
const cSB = V.calcularComprobacion('S-B', { m: '1,002', m_agua: '24,003', A: '0,797' }, prep, recta);
igual('S-B f esperada', cSB.fEsperada, 0.0080160, 0.00000005); igual('S-B f leída', cSB.fLeida, 0.0079864, 0.00000005);
igual('S-B diferencia %', cSB.dif, -0.37, 0.01); igual('S-B OK', cSB.ok, true);
const cSC = V.calcularComprobacion('S-C', { m: '2,001', m_agua: '10,502', A: '0,799' }, prep, recta);
igual('S-C f esperada', cSC.fEsperada, 0.0080029, 0.00000005); igual('S-C f leída', cSC.fLeida, 0.0080064, 0.00000005);
igual('S-C diferencia %', cSC.dif, 0.04, 0.01); igual('S-C OK', cSC.ok, true);

const t1 = V.perdidaTubo('13,250', '43,262', '43,240');
igual('tubo pérdida %', t1.pct, 0.073, 0.0005); igual('tubo OK', t1.ok, true);
const t2 = V.perdidaTubo('13,250', '43,262', '43,225');
igual('tubo pérdida % (2)', t2.pct, 0.123, 0.0005); igual('tubo DESECHAR', t2.ok, false);

igual('Z a 22 °C', V.zDe(22), 1.0033);

// ── 11.2 Verificaciones (límites de una Socorex Acura 825) ──
const z = 1.0033, cvLect = 0.15, sBal = 0.001;
function caso(nombre, p, esperado) {
  const r = V.calcularVolumen({ z, recta, cv_lectura: cvLect, s_balanza: sBal, sesion_valida: true, ...p });
  igual(`${nombre} V medio`, r.Vmedio, esperado.V, 0.01);
  igual(`${nombre} es %`, r.es, esperado.es, 0.01);
  igual(`${nombre} CV obs %`, r.cvObs, esperado.cvObs, 0.01);
  igual(`${nombre} CV método %`, r.cvMet, esperado.cvMet, 0.01);
  igual(`${nombre} CV corregido %`, r.cvCorr, esperado.cvCorr, 0.01);
  igual(`${nombre} decisión`, r.decision, esperado.decision);
  igual(`${nombre} aviso CV orientativo`, r.avisos.some(a => /CV orientativo/.test(a)), !!esperado.cvOrientativo);
  return r;
}
const rep = (ms, As) => ms.map((m, i) => ({ m, A: As ? As[i] : undefined }));
const mdC = ['1,000', '1,001', '0,999', '1,002', '1,000', '0,998', '1,001', '1,000', '1,002', '0,999'];

caso('A', { metodo: 'fotométrico', v_ajustado: 200, LE: 0.6, LC: 0.2, masa_tabla: 1.0, F: prep.F_C,
  replicas: rep(['1,001', '0,999', '1,000', '1,002'], ['0,830', '0,831', '0,829', '0,831']) },
  { V: 200.338, es: 0.17, cvObs: 0.20, cvMet: 0.21, cvCorr: 0, decision: 'OK', cvOrientativo: true });
caso('B', { metodo: 'fotométrico', v_ajustado: 20, LE: 1.5, LC: 0.6, masa_tabla: 1.0, F: prep.F_B,
  replicas: rep(['1,000', '1,001', '0,999', '1,002'], ['0,395', '0,394', '0,395', '0,396']) },
  { V: 20.263, es: 1.32, cvObs: 0.28, cvMet: 0.21, cvCorr: 0.19, decision: 'COMPLETAR' });
caso('C', { metodo: 'fotométrico', v_ajustado: 20, LE: 1.5, LC: 0.6, masa_tabla: 1.0, F: prep.F_B,
  replicas: rep(mdC, ['0,398', '0,397', '0,398', '0,399', '0,398', '0,397', '0,398', '0,398', '0,399', '0,397']) },
  { V: 20.409, es: 2.05, cvObs: 0.30, cvMet: 0.21, cvCorr: 0.21, decision: 'AJUSTAR' });
caso('D', { metodo: 'fotométrico', v_ajustado: 200, LE: 0.6, LC: 0.2, masa_tabla: 1.0, F: prep.F_C,
  replicas: rep(mdC, ['0,822', '0,838', '0,829', '0,845', '0,826', '0,834', '0,819', '0,841', '0,831', '0,836']) },
  { V: 200.818, es: 0.41, cvObs: 1.22, cvMet: 0.21, cvCorr: 1.20, decision: 'RETIRAR', cvOrientativo: true });
caso('E', { metodo: 'gravimétrico', v_ajustado: 1000, LE: 0.5, LC: 0.2, replicas: rep(['0,997', '0,996', '0,997', '0,998']) },
  { V: 1000.290, es: 0.03, cvObs: 0.08, cvMet: 0.14, cvCorr: 0, decision: 'OK', cvOrientativo: true });
caso('F', { metodo: 'fotométrico', v_ajustado: 2, LE: 2.5, LC: 1.7, masa_tabla: 0.7, F: 1,
  replicas: rep(['0,700', '0,701', '0,699', '0,700', '0,702', '0,700', '0,699', '0,701', '0,700', '0,700'],
                ['0,293', '0,294', '0,292', '0,295', '0,293', '0,294', '0,292', '0,293', '0,294', '0,293']) },
  { V: 2.071, es: 3.54, cvObs: 0.39, cvMet: 0.25, cvCorr: 0.29, decision: 'FUERA' });
caso('G (100 µl)', { metodo: 'fotométrico', v_ajustado: 100, LE: 1.5, LC: 0.5, masa_tabla: 1.0, F: prep.F_C,
  replicas: rep(['1,000', '1,001', '0,999', '1,000'], ['0,452', '0,453', '0,452', '0,452']) },
  { V: 99.990, es: -0.01, cvObs: 0.19, cvMet: 0.21, cvCorr: 0, decision: 'OK' });   // 0,21 % < 2/3 × 0,5: sin aviso

// Caso C en una Gilson (ajuste_usuario «no (servicio técnico)»): RETIRAR y servicio técnico
igual('C en una Gilson', V.resultadoFase([{ decision: 'AJUSTAR' }], { ajuste_usuario: 'no (servicio técnico)' }), 'RETIRAR_SAT');
igual('C en una Socorex', V.resultadoFase([{ decision: 'AJUSTAR' }], { ajuste_usuario: 'sí' }), 'AJUSTAR');
igual('C en una Huawei sin respuesta', V.resultadoFase([{ decision: 'AJUSTAR' }], { ajuste_usuario: 'por comprobar (tornillo bajo la tapa del émbolo)' }), 'PREGUNTAR_AJUSTE');
igual('C en una Huawei sin tornillo', V.resultadoFase([{ decision: 'AJUSTAR' }], { ajuste_usuario: 'por comprobar', ajuste_respuesta: 'no' }), 'RETIRAR');
// G: pipeta de 100–1 000 µl con los dos volúmenes OK
igual('G pipeta', V.resultadoFase([{ decision: 'OK' }, { decision: 'OK' }], { ajuste_usuario: 'sí' }), 'OK');
// Solo el volumen F: OK con un volumen < 5 µl fuera, orientativo
igual('F solo', V.resultadoFase([{ decision: 'FUERA' }], {}), 'OK_FUERA');
igual('texto F solo', V.RESULTADO.OK_FUERA, 'OK (con un volumen < 5 µl fuera de límites, orientativo)');
// Tras el ajuste no hay cribado: con 4 réplicas no se da OK
igual('sin cribado con 4', V.decidir(4, 0.1, 0, 1.5, 0.6, 20, true), 'FALTAN_10');
igual('tras ajuste sigue AJUSTAR → RETIRAR', V.resultadoFase([{ decision: 'AJUSTAR' }], { ajuste_usuario: 'sí', tras_ajuste: true }), 'RETIRAR');

// Comprobación de datos (apartado 7)
igual('número con coma', V.leerNumero('1,234').valor, 1.234);
igual('separador de miles', !!V.leerNumero('1.000,5').error, true);
igual('texto', !!V.leerNumero('abc').error, true);
igual('masa del tubo a 0,25 g', !!V.comprobarDato('masa_tubo', '1,250', { masa_tabla: 1 }).error, true);
igual('masa del tubo a 0,06 g: aviso', !!V.comprobarDato('masa_tubo', '1,060', { masa_tabla: 1 }).aviso, true);
igual('absorbancia 2,5', !!V.comprobarDato('absorbancia', '2,5').error, true);
igual('absorbancia 0,05: fuera de tramo', !!V.comprobarDato('absorbancia', '0,050').fuera_tramo, true);
igual('temperatura 31', !!V.comprobarDato('temperatura', '31').error, true);
igual('masa entregada a +40 %', !!V.comprobarDato('masa_entregada', '1,400', { v_ajustado: 1000, z }).error, true);

console.log(`\n${pruebas - fallos}/${pruebas} comprobaciones correctas`);
process.exit(fallos ? 1 : 0);
