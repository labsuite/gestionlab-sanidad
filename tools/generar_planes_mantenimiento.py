# generar_planes_mantenimiento.py
# Ejecutar: python generar_planes_mantenimiento.py
# Genera planes_mantenimiento.csv para importar en la hoja Planes_Mantenimiento (columnas A-G).

import csv
import os
import re

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
EQUIPOS_CSV = os.path.join(SCRIPT_DIR, "equipos_importar.csv")
OUTPUT_CSV  = os.path.join(SCRIPT_DIR, "planes_mantenimiento.csv")

# ============================================================
# PLANTILLAS DE MANTENIMIENTO
# Cada entrada: (Tipo_Intervencion, Periodicidad, Operacion, Instrucciones)
# ============================================================
T = {
  "BAL": [
    ("Interno", "Trimestral",
     "Limpieza y verificación de nivelación y calibración",
     "1. Limpiar el platillo de pesaje con paño húmedo y jabón diluido. Secar bien.\n"
     "2. Verificar que todos los botones responden correctamente.\n"
     "3. Comprobar que la burbuja de nivelación está centrada. Si no, ajustar las patas niveladoras.\n"
     "4. Realizar calibración interna según el manual del equipo.\n"
     "5. Pesar una masa patrón conocida y verificar que el resultado es correcto.\n"
     "6. Registrar cualquier desviación observada en las observaciones."),
  ],
  "CEN": [
    ("Interno", "Trimestral",
     "Limpieza de rotor y cámara",
     "1. Apagar la centrífuga y esperar a que se detenga por completo antes de abrir.\n"
     "2. Retirar el rotor según las instrucciones del fabricante.\n"
     "3. Limpiar el rotor y accesorios con paño suave y jabón neutro diluido. NO usar limpiadores abrasivos ni disolventes.\n"
     "4. Limpiar la cámara interior con paño suave y jabón diluido. NO aplicar líquido directamente sobre el motor.\n"
     "5. Limpiar el exterior: acero inoxidable con alcohol; plástico con alcohol en algodón.\n"
     "6. Dejar secar completamente (máx. 50 °C) antes de cerrar.\n"
     "7. Comprobar que el rotor asienta correctamente al recolocarlo.\n"
     "8. Si se detectan vibraciones anómalas o ruidos, notificar para revisión correctiva."),
  ],
  "AUTC": [
    ("Interno", "Semestral",
     "Inspección visual y limpieza de cámara",
     "1. Asegurarse de que el autoclave está frío y despresurizado antes de abrir.\n"
     "2. Revisar la junta de la puerta: no debe presentar grietas ni deformaciones.\n"
     "3. Limpiar la cámara con paño húmedo y detergente neutro. Aclarar con agua destilada.\n"
     "4. Revisar el filtro de aire y reemplazarlo si está sucio.\n"
     "5. Comprobar que la válvula de seguridad no está obstruida.\n"
     "6. Realizar un ciclo de prueba con indicadores químicos o biológicos.\n"
     "7. Registrar el resultado del ciclo de prueba en las observaciones."),
    ("Externo", "Bianual",
     "Revisión técnica oficial (normativa aparatos a presión)",
     "Mantenimiento OBLIGATORIO por normativa de seguridad industrial (ITC EP-2 o equivalente).\n"
     "El responsable de mantenimiento debe:\n"
     "1. Contactar con una Organización de Control Autorizado (OCA) o SAT del fabricante.\n"
     "2. Facilitar el acceso al equipo y la documentación técnica.\n"
     "3. Guardar el certificado de inspección emitido.\n"
     "4. Si el equipo no supera la inspección, ponerlo fuera de servicio hasta su reparación."),
  ],
  "PIP": [
    ("Interno", "Anual",
     "Calibración gravimétrica interna",
     "Calibración interna por método gravimétrico con balanza analítica certificada ENAC.\n"
     "Materiales: balanza analítica, agua destilada, papel de pesaje, registros.\n"
     "1. Dejar la micropipeta y el agua destilada a temperatura ambiente (20–25 °C) durante 30 min.\n"
     "2. Ajustar el volumen nominal de la micropipeta.\n"
     "3. Pesar 10 veces el volumen nominal sobre papel de pesaje y calcular el volumen medio.\n"
     "   (Densidad agua ≈ 0,998 g/mL a 20 °C)\n"
     "4. Calcular el error sistemático (%) y la imprecisión (CV%).\n"
     "5. Criterio de aceptación (ISO 8655): error ≤ 2,5 % y CV ≤ 1,5 %.\n"
     "6. Si no supera los criterios, enviar a calibración externa certificada.\n"
     "7. Anotar resultado, fecha y firmante en el registro de calibración."),
  ],
  "PIPA": [
    ("Interno", "Anual",
     "Limpieza y verificación de funcionamiento",
     "1. Retirar la punta y limpiar el cono con paño suave y alcohol 70 %.\n"
     "2. Inspeccionar visualmente el émbolo y el o-ring; sustituir si presentan desgaste.\n"
     "3. Comprobar que el mecanismo de eyección de puntas funciona correctamente.\n"
     "4. Verificar que dispensa el volumen correcto (método de pesada).\n"
     "5. Lubricar el émbolo con la grasa recomendada por el fabricante si es necesario."),
  ],
  "PIPR": [
    ("Interno", "Anual",
     "Limpieza y verificación del pipeteador",
     "1. Limpiar el exterior con paño húmedo y alcohol 70 %.\n"
     "2. Comprobar que la batería mantiene carga suficiente (sustituir si no retiene carga).\n"
     "3. Verificar que el motor de aspiración funciona en todos los modos.\n"
     "4. Comprobar el filtro de aerosoles (si lo tiene); reemplazar si está coloreado.\n"
     "5. Probar con una pipeta serológica que la velocidad de aspiración y dispensación es uniforme."),
  ],
  "FOT": [
    ("Interno", "Mensual",
     "Limpieza y verificación de absorbancia",
     "1. Limpiar la cubeta o cámara de flujo con agua destilada y secar con papel de laboratorio.\n"
     "2. Verificar el cero del equipo con blanco (agua destilada o tampón según el protocolo).\n"
     "3. Comprobar con muestra de control conocida que la absorbancia está dentro del rango esperado.\n"
     "4. Limpiar el exterior con paño húmedo y jabón neutro. Evitar las ventanas ópticas.\n"
     "5. Anotar el valor obtenido con la muestra de control."),
    ("Externo", "Anual",
     "Calibración y verificación por servicio técnico",
     "Mantenimiento por empresa externa o SAT del fabricante.\n"
     "El responsable gestiona la contratación e informa de cualquier anomalía observada durante el curso."),
  ],
  "BAT": [
    ("Interno", "Anual",
     "Limpieza y tratamiento antiincrustante",
     "1. Vaciar el baño completamente. Dejar enfriar.\n"
     "2. Si se usaba agua del grifo (depósitos calcáreos): limpiar con solución al 10 % de ácido acético (vinagre) o ácido cítrico. Dejar actuar 15–20 min y aclarar con agua destilada.\n"
     "3. Si se usaba agua destilada: añadir 1 g de carbonato sódico por litro para evitar oxidación.\n"
     "4. Limpiar el exterior: acero inoxidable con alcohol; plástico con alcohol en algodón.\n"
     "5. Rellenar con agua destilada y verificar que alcanza y mantiene la temperatura de trabajo.\n"
     "6. Comprobar el termostato con termómetro calibrado."),
  ],
  "ELE": [
    ("Interno", "Mensual",
     "Limpieza tras uso y verificación de electrodos",
     "Limpiar SIEMPRE después de cada sesión de electroforesis.\n"
     "1. Vaciar el tampón (TAE o TBE) de la cubeta.\n"
     "2. Limpiar con agua tibia (< 60 °C) y detergente suave. NO dejar en remojo más de 30 min.\n"
     "3. Aclarar con agua destilada para eliminar sales. Secar al aire.\n"
     "4. Para descontaminación de RNasas: limpiar con peróxido de hidrógeno al 3 % durante 10 min. Aclarar con agua tratada con DEPC (usar guantes y gafas).\n"
     "5. NUNCA poner en contacto con acetona, fenol, cloroformo, metanol, etanol, alcoholes no diluidos, álcalis.\n"
     "6. Inspeccionar electrodos y cables: si presentan corrosión o daños, sustituir.\n"
     "7. Para cubetas verticales: comprobar que los cristales no tienen fisuras."),
  ],
  "MICR": [
    ("Interno", "Pretemporada",
     "Puesta en marcha y verificación",
     "Revisión al inicio de la temporada (antes del primer uso del curso).\n"
     "1. Quitar SIEMPRE la cuchilla antes de cualquier limpieza.\n"
     "2. Retirar el portacuchillas para facilitar el acceso.\n"
     "3. Eliminar restos de parafina con papel seco o pincel seco. NO usar alcohol ni xilol en superficies exteriores.\n"
     "4. Usar limpiador de parafina, detergentes suaves o jabón y agua para las superficies externas.\n"
     "5. NO dejar que penetre líquido en el interior del instrumento.\n"
     "6. Lubricar el portacuchillas con el lubricante específico del fabricante.\n"
     "7. Verificar que el avance micrométrico funciona en todos los rangos de grosor.\n"
     "8. Montar cuchilla nueva y hacer secciones de prueba con bloque de parafina."),
    ("Interno", "Posttemporada",
     "Limpieza profunda y protección para almacenamiento",
     "Al final de la temporada:\n"
     "1. RETIRAR la cuchilla. Nunca limpiar con la cuchilla puesta.\n"
     "2. Eliminar todos los restos de parafina con limpiador específico y papel absorbente.\n"
     "3. Limpiar el exterior con detergente suave y agua. Secar completamente.\n"
     "4. Lubricar todas las partes móviles y el portacuchillas.\n"
     "5. Cubrir el equipo con su funda de protección.\n"
     "6. Guardar las cuchillas usadas en el contenedor de cortopunzantes."),
    ("Externo", "Bianual",
     "Revisión técnica y ajuste por SAT Leica/Microm",
     "Revisión técnica cada 2 años por servicio técnico autorizado (Leica o Microm).\n"
     "El responsable gestiona la contratación:\n"
     "- Revisión y ajuste del mecanismo de avance micrométrico.\n"
     "- Verificación de alineación del portacuchillas.\n"
     "- Sustitución de piezas desgastadas según criterio del técnico."),
  ],
  "PAR": [
    ("Interno", "Pretemporada",
     "Puesta en marcha y verificación de temperatura",
     "Al inicio de la temporada:\n"
     "1. Retirar restos de parafina solidificada con espátula no metálica (con el equipo templado).\n"
     "2. Limpiar la placa base y el reborde con trapo seco y jabón neutro.\n"
     "3. Encender y verificar que los baños de parafina alcanzan los 60 °C.\n"
     "4. Comprobar el termostato con termómetro calibrado: tolerancia ≤ ±2 °C.\n"
     "5. Ajustar temperatura si es necesario (tornillo de ajuste: giro hacia la izquierda = aumenta, hacia la derecha = disminuye)."),
    ("Interno", "Posttemporada",
     "Vaciado y limpieza profunda",
     "Al final de la temporada:\n"
     "1. Verter la parafina caliente en recipiente adecuado para reutilización o eliminación.\n"
     "2. Despellejar la parafina residual cuando todavía está caliente.\n"
     "3. Limpiar los baños con xilol si es necesario (EPI adecuados: guantes, gafas, ventilación).\n"
     "4. Limpiar la placa base y el reborde con espátula no metálica y trapo húmedo con detergente.\n"
     "5. Limpiar la carcasa con trapo húmedo y detergente neutro.\n"
     "6. Apagar y cubrir el equipo hasta el próximo curso."),
  ],
  "PRO": [
    ("Interno", "Pretemporada",
     "Preparación para inicio de temporada",
     "Al inicio de la temporada:\n"
     "1. Revisar el estado de los recipientes de reactivos. Sustituir los caducados o contaminados.\n"
     "2. Comprobar que la temperatura del baño de parafina está a 60 °C.\n"
     "3. Realizar un ciclo de prueba sin tejidos.\n"
     "4. Verificar que el mecanismo de transporte de cestillas funciona correctamente.\n"
     "5. Comprobar que el cabezal y tapas antievaporación están bien sellados."),
    ("Interno", "Posttemporada",
     "Limpieza profunda al cierre",
     "Al final de la temporada:\n"
     "1. Vaciar todos los recipientes de reactivos y desecharlos según los protocolos de residuos.\n"
     "2. Limpiar recipientes con agua caliente y detergente. Baños de parafina: verter caliente, dejar enfriar y despellejar.\n"
     "3. Limpiar placa base y reborde con espátula no metálica y trapo húmedo con detergente.\n"
     "4. Limpiar la carcasa con trapo húmedo y detergente neutro.\n"
     "5. Limpiar cestillas con xilol (EPI adecuados). Esterilizar con medios químicos.\n"
     "6. Cubrir y apagar hasta el próximo curso."),
  ],
  "CRI": [
    ("Interno", "Pretemporada",
     "Puesta en marcha y verificación de temperatura",
     "Al inicio de la temporada:\n"
     "1. Encender el criostato y dejar que alcance la temperatura de trabajo (−20 a −25 °C según el tejido).\n"
     "2. Limpiar el interior de la cámara con paño seco (NO usar agua mientras está frío).\n"
     "3. Verificar la temperatura de trabajo con termómetro calibrado.\n"
     "4. Montar cuchilla nueva y realizar secciones de prueba con tejido de control.\n"
     "5. Comprobar que la luz interior funciona y el estado de la junta de la puerta."),
    ("Interno", "Posttemporada",
     "Descongelación y limpieza profunda",
     "Al final de la temporada:\n"
     "1. Apagar el criostato y dejar descongelar completamente (puede tardar horas). Colocar paños absorbentes.\n"
     "2. Limpiar el interior con paño húmedo y desinfectante compatible con acero inoxidable.\n"
     "3. Eliminar todos los restos de tejido o crio-matriz (OCT). Usar EPI (guantes, mascarilla).\n"
     "4. Retirar la cuchilla y desecharla en contenedor de cortopunzantes.\n"
     "5. Limpiar el exterior. Dejar la puerta entreabierta para ventilar antes de cubrir."),
  ],
  "INC": [
    ("Interno", "Semestral",
     "Limpieza y verificación de temperatura y CO₂",
     "1. Retirar todas las bandejas y rejillas del interior.\n"
     "2. Limpiar el interior con solución de etanol al 70 % o hipoclorito diluido. Aclarar con agua destilada y dejar secar.\n"
     "3. Limpiar bandejas y rejillas con detergente neutro, aclarar y secar.\n"
     "4. Verificar la temperatura con termómetro calibrado en distintos puntos (tolerancia: ±1 °C).\n"
     "5. Si tiene CO₂: verificar la concentración con analizador calibrado.\n"
     "6. Comprobar el nivel de agua del depósito de humidificación (si lo tiene); rellenar con agua estéril.\n"
     "7. Verificar el filtro HEPA si dispone de él."),
  ],
  "EST": [
    ("Interno", "Anual",
     "Limpieza y verificación de temperatura",
     "1. Retirar las bandejas interiores.\n"
     "2. Limpiar el interior con alcohol isopropílico o paño húmedo con detergente. Aclarar y secar completamente.\n"
     "3. Interior acero: con abrillantador para acero inoxidable. Exterior: paño húmedo con detergente suave. Pantalla táctil: limpiacristales.\n"
     "4. Verificar la temperatura real con termómetro calibrado en al menos 2 puntos. Tolerancia habitual: ±5 °C.\n"
     "5. Comprobar el estado de los fusibles (parte trasera del equipo). APAGAR antes de revisar.\n"
     "6. Verificar que la puerta cierra herméticamente (junta en buen estado)."),
  ],
  "REF": [
    ("Interno", "Semestral",
     "Limpieza y verificación de temperatura",
     "1. Vaciar la nevera o trasladar el contenido temporalmente.\n"
     "2. Si hay acumulación de hielo (modelo sin frost-free): apagar y descongelar con puerta abierta.\n"
     "3. Limpiar el interior con solución de bicarbonato sódico al 2 % (evita olores) o agua y detergente neutro. Aclarar y secar.\n"
     "4. Limpiar las juntas de la puerta con paño húmedo.\n"
     "5. Verificar la temperatura con termómetro calibrado: neveras de reactivos deben mantener 2–8 °C.\n"
     "6. Comprobar que el motor no hace ruidos anómalos."),
  ],
  "CONX": [
    ("Interno", "Semestral",
     "Descongelación y limpieza",
     "1. Trasladar el contenido a otro congelador o neverita de hielo seco (planificar con antelación).\n"
     "2. Apagar el congelador y dejar la puerta abierta para descongelar. Colocar paños absorbentes.\n"
     "3. Limpiar el interior con paño húmedo y detergente neutro.\n"
     "4. Aclarar y secar completamente antes de encender.\n"
     "5. Verificar que alcanza la temperatura de trabajo en 2–3 horas.\n"
     "6. Controlar temperatura con termómetro calibrado: ≤ −18 °C (estándar) o −80 °C (ultracongelador)."),
  ],
  "CAB": [
    ("Interno", "Mensual",
     "Limpieza, desinfección y verificación de filtro",
     "1. Limpiar la superficie de trabajo con alcohol isopropílico al 70 % o etanol al 70 %. Dejar actuar 1 min.\n"
     "2. Limpiar las paredes interiores y la rejilla con la misma solución.\n"
     "3. Para cabina de flujo laminar: verificar que la alarma de presión no se activa durante el funcionamiento.\n"
     "4. Revisar el contador horario del filtro. Si llega a la alarma de cambio de filtro, notificar para mantenimiento externo.\n"
     "5. Limpiar el exterior con paño húmedo y detergente neutro. No usar sustancias abrasivas.\n"
     "6. NUNCA usar llama abierta en el interior de la cabina."),
    ("Externo", "Bianual",
     "Certificación y validación de la cabina de bioseguridad",
     "Certificación obligatoria para cabinas de bioseguridad clase II por empresa acreditada.\n"
     "Incluye: verificación del caudal de aire, test de integridad del filtro HEPA (DOP/PAO test), verificación de alarma de velocidad de aire.\n"
     "El responsable de mantenimiento gestiona la contratación y conserva el certificado de validación."),
  ],
  "VIT": [
    ("Interno", "Anual",
     "Limpieza y verificación de flujo de aire",
     "1. Limpiar las superficies con paño húmedo y detergente. Evitar sustancias abrasivas. Limpiar inmediatamente cualquier derrame.\n"
     "2. Si tiene filtro de carbón activo: verificar el estado del contador horario. Si hay alarma de cambio de filtro (normalmente a las 600 h), contactar con el SAT.\n"
     "3. Verificar que el caudal de aire es adecuado: encender la vitrina, colocar papel de tisú en la apertura frontal; debe ser atraído hacia el interior.\n"
     "4. Verificar que la alarma de velocidad de aire funciona.\n"
     "5. Para resetear el contador tras cambio de filtro (modelo Indelab): pulsar LUZ + AUX a la vez; luego encender y pulsar REARME."),
  ],
  "WAT_REP": [
    ("Externo", "Anual",
     "Cambio de filtros, cartuchos y lámpara UV (Rephile)",
     "Mantenimiento por empresa externa (Rephile o distribuidor autorizado).\n"
     "Incluye: cambio de prefiltros, cartucho de resina intercambiadora de iones, cartucho desionizador, membrana de ultrafiltración y lámpara UV.\n"
     "El responsable gestiona el contacto con el distribuidor y coordina la visita técnica."),
    ("Interno", "Mensual",
     "Verificación de conductividad y calidad del agua",
     "1. Verificar el valor de conductividad o resistividad del display del purificador. Agua tipo 1: ≥ 18 MΩ·cm; agua tipo 2: ≥ 1 MΩ·cm.\n"
     "2. Si el valor está fuera del rango esperado, consultar el manual (posible saturación de cartucho o membrana sucia).\n"
     "3. Hacer pasar 500 mL de agua antes de recoger muestras si el equipo lleva tiempo sin usarse.\n"
     "4. Anotar el valor registrado en las observaciones."),
  ],
  "WAT_HIE": [
    ("Interno", "Semestral",
     "Limpieza y desinfección del depósito",
     "1. Vaciar completamente el depósito de hielo.\n"
     "2. Limpiar el interior con solución de hipoclorito sódico al 0,5 % (1:100 de lejía doméstica). Dejar actuar 5 min.\n"
     "3. Aclarar abundantemente con agua limpia para eliminar todos los restos de cloro.\n"
     "4. Limpiar el exterior con paño húmedo.\n"
     "5. Encender y verificar que produce hielo en 30–60 min.\n"
     "6. Desechar el primer lote de hielo producido tras la limpieza."),
  ],
  "WAT_KJE": [
    ("Interno", "Mensual",
     "Limpieza del circuito y revisión de mangueras",
     "LIMPIEZA DEL CIRCUITO DE DESTILACIÓN (después de cada sesión):\n"
     "- Destilar 50 mL de agua destilada durante 5 min para eliminar restos de NaOH.\n\n"
     "LIMPIEZA DE LA CÁMARA:\n"
     "- Usar paño mojado con agua para limpiar el interior y sus componentes. Limpiar la bandeja con agua.\n\n"
     "LIMPIEZA DE LA JUNTA DE CIERRE (trimestral):\n"
     "- Limpiar con agua los restos de NaOH en la junta. Extraer tirando y girando hacia abajo.\n\n"
     "LIMPIEZA DE LOS CIRCUITOS DE NaOH Y BÓRICO:\n"
     "- Limpiar los conectores de manguera con agua destilada. Vaciar el depósito de NaOH y limpiar.\n\n"
     "INSPECCIÓN DE MANGUERAS:\n"
     "- Inspección visual de todas las mangueras. Sustituir cualquier manguera deteriorada o con fugas."),
  ],
  "PCR_qPCR": [
    ("Interno", "Anual",
     "Calibración espacial, de fondo y del marcaje",
     "Calibración del termociclador StepOne (Applied Biosystems). Requiere el kit de calibración espectral.\n\n"
     "CALIBRACIÓN ESPACIAL:\n"
     "1. Sacar la placa 1 del kit del congelador y atemperar 5 min. Vortexear y centrifugar 2 min a ≥ 1500 rpm.\n"
     "2. En el software: Instrument Maintenance Manager → Spatial → Start Calibration → START RUN.\n\n"
     "CALIBRACIÓN DEL FONDO:\n"
     "3. Mismo procedimiento con la placa de calibrado del fondo. Opción Background.\n\n"
     "CALIBRACIÓN DEL MARCAJE:\n"
     "4. Mismo procedimiento con la placa de colorante. Opción Dye > System Dye Calibration.\n\n"
     "LIMPIEZA DEL BLOQUE DE MUESTRAS:\n"
     "5. Si hay pocillos contaminados: limpiar con agua descontaminada, luego etanol 95 %, luego lejía al 10 %.\n\n"
     "NOTA: La calibración requiere el kit específico. Si está pendiente de adquisición, contactar con compras."),
  ],
  "PCR_CONV": [
    ("Interno", "Anual",
     "Limpieza y verificación de temperatura del bloque",
     "1. Limpiar la placa de los pocillos con paño suave humedecido en alcohol absoluto.\n"
     "2. Si es necesario limpiar la superficie pintada, usar paño con jabón suave.\n"
     "3. Verificar que la tapa calefactada funciona correctamente.\n"
     "4. Si dispone de termómetro de control de bloque: verificar que la temperatura real coincide con la programada (tolerancia: ±0,5 °C)."),
  ],
  "PHM": [
    ("Interno", "Mensual",
     "Calibración con tampones patrón",
     "La calibración es especialmente importante al inicio de cada serie de medidas, tras sustituir el electrodo, tras medir muestras agresivas, o cuando se requiera alta precisión.\n"
     "1. Preparar tampones patrón de dos puntos (ej. pH 4 y 7, o 7 y 10, según el rango de trabajo).\n"
     "2. Enjuagar el electrodo con agua destilada. Secar con papel absorbente (NO frotar).\n"
     "3. Calibrar con el tampón de pH más bajo primero, luego el segundo según las instrucciones del modelo.\n"
     "4. Para el pHmetro portátil HI 9023C: consultar páginas 6–9 del manual.\n"
     "5. Para el pHmetro Crison Basic: consultar página 5 del manual.\n"
     "6. Tras la calibración, mantener el electrodo en solución de KCl 3 M. NUNCA en agua destilada."),
    ("Interno", "Anual",
     "Mantenimiento del electrodo y verificación de pilas",
     "1. Verificar que las pilas tienen carga suficiente. Sustituir si es necesario.\n"
     "2. Inspeccionar el electrodo: si presenta cristales de KCl o coloración, limpiar con agua destilada y KCl 3 M.\n"
     "3. Si el electrodo no se calibra correctamente incluso con tampones frescos, puede estar agotado: sustituir.\n"
     "4. Limpiar el cuerpo del instrumento con paño húmedo."),
  ],
  "PLA": [
    ("Interno", "Anual",
     "Limpieza y verificación de fusibles",
     "1. Apagar el equipo.\n"
     "2. Limpiar la placa de calentamiento o agitación con paño húmedo y jabón neutro diluido. Evitar que entre líquido en el interior.\n"
     "3. Limpiar el exterior con paño húmedo.\n"
     "4. Comprobar los fusibles: están en la parte trasera. APAGAR y desenchufar antes de acceder a ellos. Sustituir si están fundidos por el mismo tipo y valor.\n"
     "5. Encender y verificar que la agitación y el calentamiento (si lo tiene) funcionan correctamente."),
  ],
  "AXI": [
    ("Interno", "Anual",
     "Limpieza y verificación",
     "1. Apagar el agitador orbital.\n"
     "2. Limpiar la plataforma con paño húmedo y jabón neutro diluido.\n"
     "3. Limpiar el exterior.\n"
     "4. Verificar que la velocidad de agitación es uniforme y no hay vibraciones excesivas.\n"
     "5. Comprobar los anclajes de los soportes de recipientes."),
  ],
  "VOR": [
    ("Interno", "Anual",
     "Limpieza y verificación de funcionamiento",
     "1. Apagar el vórtex.\n"
     "2. Limpiar la copa de agitación con paño húmedo y jabón neutro diluido. Si hay restos de muestras, usar guantes y desinfectante.\n"
     "3. Limpiar el exterior con paño húmedo y jabón neutro.\n"
     "4. Encender y verificar que vibra de forma uniforme sin ruidos anómalos.\n"
     "5. Comprobar que el ajuste de velocidad funciona correctamente."),
  ],
  "OSM": [
    ("Interno", "Semestral",
     "Calibración y limpieza",
     "1. Calibrar el osmómetro con estándares de osmolalidad conocidos (ej. 290 mOsm/kg para estándar de suero).\n"
     "2. El resultado debe estar dentro de ±2 % del valor certificado.\n"
     "3. Si hay desviación, ajustar según el manual del modelo Gonotec OSMOMAT.\n"
     "4. Limpiar la celda de medida con paño suave y agua destilada después de cada sesión."),
  ],
  "GLI": [
    ("Interno", "Semestral",
     "Control de calidad con muestra control",
     "1. Usar la muestra de control de nivel normal y anormal del glucómetro (o kit de control certificado).\n"
     "2. Aplicar la muestra control según las instrucciones del modelo (One Touch Verio).\n"
     "3. El resultado debe estar dentro del rango impreso en el envase de control.\n"
     "4. Si el resultado está fuera de rango: verificar que las tiras reactivas no están caducadas; que el vial de control no está caducado; que la temperatura es correcta.\n"
     "5. Registrar el resultado en las observaciones."),
  ],
  "COAG": [
    ("Interno", "Trimestral",
     "Limpieza y control de calidad",
     "1. Limpiar el exterior del equipo con paño húmedo y jabón neutro.\n"
     "2. Limpiar los pocillos de reacción (si son reutilizables) con agua destilada y secar.\n"
     "3. Realizar un control de calidad interno con plasma control de nivel normal: TP y APTT deben estar dentro del rango del kit de control.\n"
     "4. Anotar los resultados en el registro."),
    ("Externo", "Anual",
     "Revisión técnica y calibración por SAT",
     "Mantenimiento por SAT del fabricante (RAL o Bio-Bas según modelo).\n"
     "Incluye verificación del sistema óptico y mecánico, y calibración certificada.\n"
     "El responsable gestiona la contratación."),
  ],
  "CIT": [
    ("Interno", "Mensual",
     "Control de calidad con partículas de referencia",
     "1. Realizar el control diario de calidad con las partículas de referencia fluorescentes del fabricante (Celltac MEK-6500K).\n"
     "2. Verificar que los CV (%) de las poblaciones de control están dentro del rango aceptable.\n"
     "3. Limpiar las líneas fluídicas con solución de limpieza del fabricante según el protocolo del manual."),
    ("Externo", "Anual",
     "Calibración y revisión técnica por SAT",
     "Mantenimiento por el servicio técnico autorizado de Celltac/Nihon Kohden.\n"
     "El responsable gestiona la contratación e informa de cualquier desviación detectada durante el control de calidad mensual."),
  ],
  "AUT": [
    ("Interno", "Trimestral",
     "Limpieza y control de calidad",
     "1. Realizar el control de calidad con suero control de nivel normal y patológico.\n"
     "2. Los resultados deben estar dentro de los rangos del fabricante. Documentar.\n"
     "3. Limpiar los tubos y conductos con solución de limpieza del fabricante.\n"
     "4. Limpiar el exterior con paño húmedo y jabón neutro.\n"
     "5. Verificar que hay reactivos suficientes para la siguiente sesión."),
    ("Externo", "Anual",
     "Revisión técnica y calibración por SAT",
     "Mantenimiento por SAT del fabricante.\n"
     "El responsable gestiona la contratación e informa de cualquier anomalía observada durante el curso."),
  ],
  "WPL": [
    ("Interno", "Anual",
     "Limpieza de tuberías, cabezal y agarre",
     "A) LIMPIEZA DE TUBERÍAS:\n"
     "Tras pulsar apagado, el equipo lava las tuberías con agua destilada automáticamente. Repetir el enjuague varias veces.\n"
     "Mensualmente (en uso intensivo): poner 350 mL de hipoclorito sódico al 1 % en las botellas. Encender y enjuagar. Tras 5 min en remojo, limpiar las botellas y rellenar con agua y solución normales.\n\n"
     "B) LIMPIEZA DEL CABEZAL:\n"
     "Descolgar el cabezal; quitar los tornillos selladores. Desinfectar en etanol al 75 %. Limpiar el espacio interno con jeringuilla y etanol. Limpiar con cepillo suave.\n\n"
     "C) MANTENIMIENTO DEL AGARRE:\n"
     "Añadir agua destilada al agarre tras el uso. Evitar que entren trozos de papel u otras impurezas en la tubería."),
  ],
  "RPL": [
    ("Interno", "Anual",
     "Limpieza y verificación del sistema óptico",
     "1. Apagar el equipo y desenchufarlo.\n"
     "2. Limpiar el exterior, el rail y el transportador con balleta húmeda y detergente suave (usar guantes).\n"
     "3. SISTEMA ÓPTICO: NO tocar las lentes, filtros ni el detector fotoeléctrico con los dedos. Evitar el flujo de líquido al interior del equipo. Si es necesaria la limpieza interna del sistema óptico, contactar con el SAT.\n"
     "4. Prevenir la entrada de polvo manteniendo el equipo cubierto cuando no esté en uso.\n"
     "5. Verificar con una placa de absorbancia conocida que los valores son reproducibles."),
  ],
  "COL": [
    ("Interno", "Anual",
     "Limpieza y verificación",
     "1. Limpiar la superficie de la plataforma con paño húmedo y alcohol 70 %.\n"
     "2. Verificar que el marcador o el bolígrafo de china funciona correctamente y tiene tinta.\n"
     "3. Comprobar que el contador electrónico (si lo tiene) reinicia correctamente.\n"
     "4. Limpiar el cristal iluminado con paño de microfibra seco para eliminar marcas."),
  ],
  "DEN": [
    ("Interno", "Semestral",
     "Calibración con estándar de densidad óptica",
     "1. Encender el densitómetro y dejar que se estabilice (5–10 min).\n"
     "2. Calibrar con el estándar del fabricante (Densimat, BioMerieux) según las instrucciones del manual.\n"
     "3. Verificar con una muestra de McFarland conocida (ej. 0,5 McFarland) que el resultado es correcto.\n"
     "4. Limpiar la cubeta con agua destilada y secar con papel de laboratorio."),
    ("Externo", "Anual",
     "Revisión técnica por SAT",
     "Mantenimiento por SAT de BioMerieux o distribuidor autorizado.\n"
     "El responsable gestiona la contratación."),
  ],
  "MUE": [
    ("Externo", "Anual",
     "Calibración por empresa acreditada",
     "El muestreador microbiológico de aire (IUL Spin Air) debe ser calibrado anualmente por empresa acreditada para garantizar que el caudal de aspiración es correcto (100 L/min).\n"
     "El responsable gestiona la contratación del servicio de calibración."),
    ("Interno", "Semestral",
     "Limpieza y verificación de caudal",
     "1. Limpiar la cabeza de impacto con alcohol 70 % y dejar secar antes de usar.\n"
     "2. Verificar que la turbina gira libremente y no tiene obstrucciones.\n"
     "3. Comprobar que la batería o fuente de alimentación proporciona el voltaje correcto.\n"
     "4. Si dispone de caudalímetro: verificar que el caudal es de 100 L/min ±5 %."),
  ],
  "LUV": [
    ("Interno", "Semestral",
     "Limpieza de superficie y verificación",
     "1. Limpiar la superficie del transiluminador o lámpara UV con papel de laboratorio impregnado con etanol antes y después de cada uso. En la revisión semestral, revisar el estado general.\n"
     "2. Verificar que la lámpara se enciende correctamente y emite luz UV uniforme.\n"
     "3. Comprobar el estado del filtro de visualización (si lo tiene).\n"
     "4. Para el cambio de lámpara UV: seguir las instrucciones de la página correspondiente del manual.\n"
     "IMPORTANTE: Nunca mirar directamente la luz UV sin protección ocular adecuada. Usar gafas UV y proteger la piel."),
  ],
  "DIG": [
    ("Interno", "Mensual",
     "Limpieza de bloques y comprobación de tubos",
     "1. Dejar enfriar el bloque de digestión completamente antes de limpiar.\n"
     "2. Limpiar los orificios del bloque con cepillo seco para eliminar restos de muestra.\n"
     "3. Limpiar el exterior con paño húmedo y detergente neutro.\n"
     "4. Revisar visualmente el estado de las mangueras del sistema scrubber (si lo tiene): sustituir si hay fugas.\n"
     "5. Comprobar que el sistema de extracción de vapores funciona correctamente.\n"
     "IMPORTANTE: los ácidos concentrados generan vapores corrosivos."),
    ("Externo", "Bianual",
     "Revisión técnica por SAT",
     "Revisión técnica bianual por SAT de JP Selecta o empresa autorizada.\n"
     "El responsable gestiona la contratación."),
  ],
  "VAC": [
    ("Interno", "Mensual",
     "Cambio de agua y revisión de mangueras",
     "1. NUNCA dejar la cubeta llena de agua después del uso.\n"
     "2. Cambiar el agua de la bomba en cada sesión de uso (agua limpia, sin reactivos).\n"
     "3. Revisar visualmente el estado de las mangueras interiores cada tres meses: si hay fugas, sustituirlas. Para acceder al interior, quitar la tapa superior con el equipo DESENCHUFADO.\n"
     "4. Limpiar el exterior con paño húmedo."),
  ],
  "MUL": [
    ("Interno", "Semestral",
     "Calibración de parámetros y mantenimiento de electrodos",
     "1. Calibrar el electrodo de pH con tampones patrón de dos puntos (ver plan de pHmetros).\n"
     "2. Calibrar el electrodo de conductividad con solución estándar de conductividad conocida.\n"
     "3. Calibrar el electrodo de oxígeno disuelto (si lo tiene) con aire saturado de agua.\n"
     "4. Limpiar los electrodos con agua destilada antes y después de cada calibración.\n"
     "5. Mantener el electrodo de pH en solución de KCl 3 M cuando no esté en uso."),
  ],
  "MICROO": [
    ("Interno", "Semestral",
     "Limpieza y verificación",
     "1. Apagar y desenchufar el microondas.\n"
     "2. Retirar el plato giratorio y lavarlo con agua y detergente.\n"
     "3. Limpiar el interior con paño húmedo y detergente neutro. Prestar especial atención a restos de agar o reactivos solidificados.\n"
     "4. Limpiar la junta de la puerta.\n"
     "5. Encender y verificar que el plato gira correctamente.\n"
     "6. PRECAUCIÓN: No calentar medios con agar sin agitar ni en recipientes cerrados (riesgo de ebullición explosiva)."),
  ],
  "HOM": [
    ("Interno", "Anual",
     "Limpieza de cámara y verificación",
     "Stomacher 400 Circulator (SEWARD):\n"
     "1. Limpiar el exterior con trapo húmedo y detergente suave. NO usar disolventes (dañarían el acabado).\n"
     "2. Para la limpieza de la cámara interior, desencajar la puerta según el manual.\n"
     "3. Limpiar el interior de la cámara con paño húmedo y detergente neutro.\n"
     "4. Verificar que las palas de agitación se mueven libremente.\n"
     "5. Comprobar que la puerta cierra y abre correctamente."),
  ],
  "LMP": [
    ("Interno", "Anual",
     "Verificación de funcionamiento y limpieza",
     "1. Verificar que la lámpara se enciende y funciona correctamente.\n"
     "2. Limpiar el reflector y la carcasa con paño seco.\n"
     "3. Si la lámpara no enciende o parpadea, sustituir la bombilla por una del mismo tipo y potencia."),
  ],
}

# ============================================================
# ASIGNAR PLANTILLA POR EQUIPO
# ============================================================
def get_plantilla(id_activo, tipo_equipo, marca, modelo):
    id_u  = id_activo.upper()
    pref  = id_activo.split("-")[0].upper()
    txt   = f"{tipo_equipo} {marca} {modelo}".lower()

    # Casos específicos por ID
    if id_u == "WAT-001":  return T["WAT_REP"]
    if id_u == "WAT-002":  return T["WAT_HIE"]
    if id_u == "WAT-003":  return T["WAT_KJE"]
    if id_u == "PCR-001":  return T["PCR_qPCR"]

    # Por texto del tipo/marca/modelo
    if re.search(r"vortex|vórtex|vortice", txt):                         return T["VOR"]
    if re.search(r"vitrina|extracción.*gas|extraccion.*gas", txt):       return T["VIT"]
    if re.search(r"stomacher|homogen", txt):                              return T["HOM"]
    if re.search(r"coagulomet|coagul", txt):                             return T["COAG"]
    if re.search(r"glucomet|glucómet", txt):                             return T["GLI"]
    if re.search(r"lavador.*microplac|microplate.wash", txt):            return T["WPL"]
    if re.search(r"lector.*microplac|microplate.read", txt):             return T["RPL"]
    if re.search(r"cuentacolon", txt):                                    return T["COL"]
    if re.search(r"densit", txt):                                         return T["DEN"]
    if re.search(r"muestreador", txt):                                    return T["MUE"]
    if re.search(r"multipar", txt):                                       return T["MUL"]
    if re.search(r"microond", txt):                                       return T["MICROO"]
    if re.search(r"bomba.*vac", txt):                                     return T["VAC"]
    if re.search(r"digest", txt):                                         return T["DIG"]
    if re.search(r"ultraviolet|lampara.*uv|lámpara.*uv|uv.*lamp", txt):  return T["LUV"]
    if re.search(r"osmomet|osmómet", txt):                               return T["OSM"]
    if re.search(r"citomet|citómet|citom", txt):                         return T["CIT"]
    if re.search(r"fotometr|espectrofot|fotóm", txt):                    return T["FOT"]
    if re.search(r"autoanal|analizad", txt):                             return T["AUT"]
    if re.search(r"termocicl.*step|steponr|stepone", txt):               return T["PCR_qPCR"]
    if re.search(r"termocicl", txt):                                      return T["PCR_CONV"]
    if re.search(r"phmet|ph metro|phm", txt):                            return T["PHM"]
    if re.search(r"placa.*agit|agit.*plac|axitad.*plac|placa.*axitad", txt): return T["PLA"]
    if re.search(r"axitad.*orbital|agit.*orbital", txt):                 return T["AXI"]
    if re.search(r"lampada.*lab|lampara.*lab|lámpara.*lab|lector.*elec", txt): return T["LMP"]

    # Por prefijo
    mapping = {
        "BAL": "BAL", "CEN": "CEN", "AUTC": "AUTC",
        "PIP": "PIP", "PIPA": "PIPA", "PIPR": "PIPR",
        "FOT": "FOT", "BAT": "BAT", "ELE": "ELE",
        "MICR": "MICR", "PAR": "PAR", "PRO": "PRO",
        "CRI": "CRI", "INC": "INC", "EST": "EST",
        "REF": "REF", "CONX": "CONX", "CAB": "CAB",
        "WAT": "WAT_REP",
        "COL": "COL", "WPL": "WPL", "RPL": "RPL",
        "CIT": "CIT", "COAG": "COAG", "GLI": "GLI",
        "OSM": "OSM", "AUT": "AUT", "AXI": "AXI",
        "PLA": "PLA", "VOR": "VOR", "HOM": "HOM",
        "DIG": "DIG", "VAC": "VAC", "LUV": "LUV",
        "DEN": "DEN", "MUE": "MUE", "MUL": "MUL",
        "LMP": "LMP", "MICROO": "MICROO", "PHM": "PHM",
        "PCR": "PCR_CONV",
        "VIT": "VIT",
    }
    key = mapping.get(pref)
    return T.get(key) if key else None


# ============================================================
# GENERAR CSV
# ============================================================
def main():
    if not os.path.exists(EQUIPOS_CSV):
        print(f"ERROR: No se encuentra {EQUIPOS_CSV}")
        print("Ejecuta primero importar_inventario.py (o el .ps1) para generar equipos_importar.csv")
        return

    with open(EQUIPOS_CSV, encoding="utf-8-sig") as f:
        equipos = list(csv.DictReader(f))

    planes  = []
    sin_plan = []
    counter = 0

    for eq in equipos:
        id_activo = eq.get("ID_Activo", "").strip()
        if not id_activo:
            continue

        plantilla = get_plantilla(
            id_activo,
            eq.get("Tipo_Equipo", ""),
            eq.get("Marca", ""),
            eq.get("Modelo", ""),
        )

        if plantilla is None:
            sin_plan.append(f"{id_activo} | {eq.get('Tipo_Equipo','')} {eq.get('Marca','')}")
            continue

        for tipo, per, op, instr in plantilla:
            counter += 1
            plan_id = f"PM{counter:04d}"
            planes.append([plan_id, id_activo, tipo, per, op, "TRUE", instr])

    with open(OUTPUT_CSV, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f)
        w.writerow(["ID_Plan", "ID_Equipo", "Tipo_Intervencion", "Periodicidad",
                    "Operacion", "Activo", "Instrucciones"])
        w.writerows(planes)

    print(f"Planes generados: {len(planes)}  ->  {OUTPUT_CSV}")
    if sin_plan:
        print(f"\nEquipos SIN plantilla ({len(sin_plan)}):")
        for s in sin_plan:
            print(f"  {s}")
    else:
        print("Todos los equipos tienen plan asignado.")

    print("\nSIGUIENTE PASO:")
    print("  Importar planes_mantenimiento.csv en la hoja Planes_Mantenimiento de Google Sheets.")
    print("  Archivo > Importar > Subir > 'Aniadir a la hoja actual' (NO reemplazar).")
    print("  IMPORTANTE: asegurate de que la fila 1 ya tiene las cabeceras A-G.")
    print("  Al importar, selecciona 'No convertir tipos' para que TRUE se guarde como texto.")


if __name__ == "__main__":
    main()
