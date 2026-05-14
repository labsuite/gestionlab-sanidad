# generar_planes_mantenimiento.ps1
# Genera planes_mantenimiento.csv para importar en Planes_Mantenimiento (A-G).
# Ejecutar: powershell -ExecutionPolicy Bypass -File generar_planes_mantenimiento.ps1

$scriptDir  = Split-Path -Parent $MyInvocation.MyCommand.Path
$equiposCsv = Join-Path $scriptDir "equipos_importar.csv"
$outputCsv  = Join-Path $scriptDir "planes_mantenimiento.csv"
$encBOM     = New-Object System.Text.UTF8Encoding $true
$enc        = [System.Text.Encoding]::UTF8

# ── Instrucciones (UTF-8, con tildes correctas) ────────────────
# Se leen desde el fichero de datos para evitar problemas de encoding en el .ps1
$datFile = Join-Path $scriptDir "planes_datos.json"

# Si no existe el fichero de datos, lo creamos nosotros mismos
if (-not (Test-Path $datFile)) {

# Escribimos el JSON de plantillas directamente con .NET para garantizar UTF-8
$jsonContent = [System.IO.File]::ReadAllText($datFile, $enc) 2>$null

}

# ── Plantillas inline (ASCII-safe, usamos /// como separador de linea) ────
$T = @{
  BAL = @(
    [pscustomobject]@{ Tipo="Interno"; Per="Trimestral"; Op="Limpieza y verificacion de nivelacion y calibracion";
      Instr="1. Limpiar el platillo de pesaje con pano humedo y jabon diluido. Secar bien.///2. Verificar que todos los botones responden correctamente.///3. Comprobar que la burbuja de nivelacion esta centrada. Si no, ajustar las patas niveladoras.///4. Realizar calibracion interna segun el manual del equipo.///5. Pesar una masa patron conocida y verificar que el resultado es correcto.///6. Registrar cualquier desviacion observada en las observaciones." }
  )
  CEN = @(
    [pscustomobject]@{ Tipo="Interno"; Per="Trimestral"; Op="Limpieza de rotor y camara";
      Instr="1. Apagar la centrifuga y esperar a que se detenga por completo antes de abrir.///2. Retirar el rotor segun las instrucciones del fabricante.///3. Limpiar el rotor y accesorios con pano suave y jabon neutro diluido. NO usar limpiadores abrasivos ni disolventes.///4. Limpiar la camara interior con pano suave y jabon diluido. NO aplicar liquido directamente sobre el motor.///5. Limpiar el exterior: acero inoxidable con alcohol; plastico con alcohol en algodon.///6. Dejar secar completamente (max. 50 grados C) antes de cerrar.///7. Comprobar que el rotor asienta correctamente al recolocarlo.///8. Si se detectan vibraciones anomalas o ruidos, notificar para revision correctiva." }
  )
  AUTC = @(
    [pscustomobject]@{ Tipo="Interno"; Per="Semestral"; Op="Inspeccion visual y limpieza de camara";
      Instr="1. Asegurarse de que el autoclave esta frio y despresurizado antes de abrir.///2. Revisar la junta de la puerta: no debe presentar grietas ni deformaciones.///3. Limpiar la camara con pano humedo y detergente neutro. Aclarar con agua destilada.///4. Revisar el filtro de aire y reemplazarlo si esta sucio.///5. Comprobar que la valvula de seguridad no esta obstruida.///6. Realizar un ciclo de prueba con indicadores quimicos o biologicos.///7. Registrar el resultado del ciclo de prueba en las observaciones." }
    [pscustomobject]@{ Tipo="Externo"; Per="Bianual"; Op="Revision tecnica oficial (normativa aparatos a presion)";
      Instr="Mantenimiento OBLIGATORIO por normativa de seguridad industrial (ITC EP-2 o equivalente).///El responsable de mantenimiento debe:///1. Contactar con una Organizacion de Control Autorizado (OCA) o SAT del fabricante.///2. Facilitar el acceso al equipo y la documentacion tecnica.///3. Guardar el certificado de inspeccion emitido.///4. Si el equipo no supera la inspeccion, ponerlo fuera de servicio hasta su reparacion." }
  )
  PIP = @(
    [pscustomobject]@{ Tipo="Interno"; Per="Anual"; Op="Calibracion gravimetrica interna";
      Instr="Calibracion interna por metodo gravimetrico con balanza analitica certificada ENAC.///Materiales: balanza analitica, agua destilada, papel de pesaje, registros.///1. Dejar la micropipeta y el agua destilada a temperatura ambiente (20-25 grados C) durante 30 min.///2. Ajustar el volumen nominal de la micropipeta.///3. Pesar 10 veces el volumen nominal sobre papel de pesaje y calcular el volumen medio.///   (Densidad agua aproximada 0,998 g/mL a 20 grados C)///4. Calcular el error sistematico (%) y la imprecision (CV%).///5. Criterio de aceptacion (ISO 8655): error menor o igual al 2,5% y CV menor o igual al 1,5%.///6. Si no supera los criterios, enviar a calibracion externa certificada.///7. Anotar resultado, fecha y firmante en el registro de calibracion." }
  )
  PIPA = @(
    [pscustomobject]@{ Tipo="Interno"; Per="Anual"; Op="Limpieza y verificacion de funcionamiento";
      Instr="1. Retirar la punta y limpiar el cono con pano suave y alcohol 70%.///2. Inspeccionar visualmente el piston y el o-ring; sustituir si presentan desgaste.///3. Comprobar que el mecanismo de eyeccion de puntas funciona correctamente.///4. Verificar que dispensa el volumen correcto (metodo de pesada).///5. Lubricar el piston con la grasa recomendada por el fabricante si es necesario." }
  )
  PIPR = @(
    [pscustomobject]@{ Tipo="Interno"; Per="Anual"; Op="Limpieza y verificacion del pipeteador";
      Instr="1. Limpiar el exterior con pano humedo y alcohol 70%.///2. Comprobar que la bateria mantiene carga suficiente (sustituir si no retiene carga).///3. Verificar que el motor de aspiracion funciona en todos los modos.///4. Comprobar el filtro de aerosoles (si lo tiene); reemplazar si esta coloreado.///5. Probar con una pipeta serologica que la velocidad de aspiracion y dispensacion es uniforme." }
  )
  FOT = @(
    [pscustomobject]@{ Tipo="Interno"; Per="Mensual"; Op="Limpieza y verificacion de absorbancia";
      Instr="1. Limpiar la cubeta o camara de flujo con agua destilada y secar con papel de laboratorio.///2. Verificar el cero del equipo con blanco (agua destilada o tampon segun el protocolo).///3. Comprobar con muestra de control conocida que la absorbancia esta dentro del rango esperado.///4. Limpiar el exterior con pano humedo y jabon neutro. Evitar las ventanas opticas.///5. Anotar el valor obtenido con la muestra de control." }
    [pscustomobject]@{ Tipo="Externo"; Per="Anual"; Op="Calibracion y verificacion por servicio tecnico";
      Instr="Mantenimiento por empresa externa o SAT del fabricante.///El responsable gestiona la contratacion e informa de cualquier anomalia observada durante el curso." }
  )
  BAT = @(
    [pscustomobject]@{ Tipo="Interno"; Per="Anual"; Op="Limpieza y tratamiento antiincrustante";
      Instr="1. Vaciar el bano completamente. Dejar enfriar.///2. Si se usaba agua del grifo (depositos calcarios): limpiar con solucion al 10% de acido acetico (vinagre) o acido citrico. Dejar actuar 15-20 min y aclarar con agua destilada.///3. Si se usaba agua destilada: anadir 1 g de carbonato sodico por litro para evitar oxidacion.///4. Limpiar el exterior: acero inoxidable con alcohol; plastico con alcohol en algodon.///5. Rellenar con agua destilada y verificar que alcanza y mantiene la temperatura de trabajo.///6. Comprobar el termostato con termometro calibrado." }
  )
  ELE = @(
    [pscustomobject]@{ Tipo="Interno"; Per="Mensual"; Op="Limpieza tras uso y verificacion de electrodos";
      Instr="Limpiar SIEMPRE despues de cada sesion de electroforesis.///1. Vaciar el tampon (TAE o TBE) de la cubeta.///2. Limpiar con agua tibia (menor de 60 grados) y detergente suave. NO dejar en remojo mas de 30 min.///3. Aclarar con agua destilada para eliminar sales. Secar al aire.///4. Para descontaminacion de RNasas: limpiar con peroxido de hidrogeno al 3% durante 10 min. Aclarar con agua tratada con DEPC (usar guantes y gafas).///5. NUNCA poner en contacto con acetona, fenol, cloroformo, metanol, etanol, alcoholes no diluidos, alcalis.///6. Inspeccionar electrodos y cables: si presentan corrosion o danos, sustituir.///7. Para cubetas verticales: comprobar que los cristales no tienen fisuras." }
  )
  MICR = @(
    [pscustomobject]@{ Tipo="Interno"; Per="Pretemporada"; Op="Puesta en marcha y verificacion";
      Instr="Revision al inicio de la temporada (antes del primer uso del curso).///1. Quitar SIEMPRE la cuchilla antes de cualquier limpieza.///2. Retirar el portacuchillas para facilitar el acceso.///3. Eliminar restos de parafina con papel seco o pincel seco. NO usar alcohol ni xilol en superficies exteriores.///4. Usar limpiador de parafina, detergentes suaves o jabon y agua para las superficies externas.///5. NO dejar que penetre liquido en el interior del instrumento.///6. Lubricar el portacuchillas con el lubricante especifico del fabricante.///7. Verificar que el avance micrometrico funciona en todos los rangos de grosor.///8. Montar cuchilla nueva y hacer secciones de prueba con bloque de parafina." }
    [pscustomobject]@{ Tipo="Interno"; Per="Posttemporada"; Op="Limpieza profunda y proteccion para almacenamiento";
      Instr="Al final de la temporada:///1. RETIRAR la cuchilla. Nunca limpiar con la cuchilla puesta.///2. Eliminar todos los restos de parafina con limpiador especifico y papel absorbente.///3. Limpiar el exterior con detergente suave y agua. Secar completamente.///4. Lubricar todas las partes moviles y el portacuchillas.///5. Cubrir el equipo con su funda de proteccion.///6. Guardar las cuchillas usadas en el contenedor de cortopunzantes." }
    [pscustomobject]@{ Tipo="Externo"; Per="Bianual"; Op="Revision tecnica y ajuste por SAT Leica/Microm";
      Instr="Revision tecnica cada 2 anos por servicio tecnico autorizado (Leica o Microm).///El responsable gestiona la contratacion:///- Revision y ajuste del mecanismo de avance micrometrico.///- Verificacion de alineacion del portacuchillas.///- Sustitucion de piezas desgastadas segun criterio del tecnico." }
  )
  PAR = @(
    [pscustomobject]@{ Tipo="Interno"; Per="Pretemporada"; Op="Puesta en marcha y verificacion de temperatura";
      Instr="Al inicio de la temporada:///1. Retirar restos de parafina solidificada con espatula no metalica (con el equipo templado).///2. Limpiar la placa base y el reborde con trapo seco y jabon neutro.///3. Encender y verificar que los banos de parafina alcanzan los 60 grados C.///4. Comprobar el termostato con termometro calibrado: tolerancia menor o igual a mas/menos 2 grados C.///5. Ajustar temperatura si es necesario (tornillo de ajuste: giro hacia la izquierda = aumenta, hacia la derecha = disminuye)." }
    [pscustomobject]@{ Tipo="Interno"; Per="Posttemporada"; Op="Vaciado y limpieza profunda";
      Instr="Al final de la temporada:///1. Verter la parafina caliente en recipiente adecuado para reutilizacion o eliminacion.///2. Despellejar la parafina residual cuando todavia esta caliente.///3. Limpiar los banos con xilol si es necesario (EPI adecuados: guantes, gafas, ventilacion).///4. Limpiar la placa base y el reborde con espatula no metalica y trapo humedo con detergente.///5. Limpiar la carcasa con trapo humedo y detergente neutro.///6. Apagar y cubrir el equipo hasta el proximo curso." }
  )
  PRO = @(
    [pscustomobject]@{ Tipo="Interno"; Per="Pretemporada"; Op="Preparacion para inicio de temporada";
      Instr="Al inicio de la temporada:///1. Revisar el estado de los recipientes de reactivos. Sustituir los caducados o contaminados.///2. Comprobar que la temperatura del bano de parafina esta a 60 grados C.///3. Realizar un ciclo de prueba sin tejidos.///4. Verificar que el mecanismo de transporte de cestillas funciona correctamente.///5. Comprobar que el cabezal y tapas antievaporacion estan bien sellados." }
    [pscustomobject]@{ Tipo="Interno"; Per="Posttemporada"; Op="Limpieza profunda al cierre";
      Instr="Al final de la temporada:///1. Vaciar todos los recipientes de reactivos y desecharlos segun los protocolos de residuos.///2. Limpiar recipientes con agua caliente y detergente. Banos de parafina: verter caliente, dejar enfriar y despellejar.///3. Limpiar placa base y reborde con espatula no metalica y trapo humedo con detergente.///4. Limpiar la carcasa con trapo humedo y detergente neutro.///5. Limpiar cestillas con xilol (EPI adecuados). Esterilizar con medios quimicos.///6. Cubrir y apagar hasta el proximo curso." }
  )
  CRI = @(
    [pscustomobject]@{ Tipo="Interno"; Per="Pretemporada"; Op="Puesta en marcha y verificacion de temperatura";
      Instr="Al inicio de la temporada:///1. Encender el criostato y dejar que alcance la temperatura de trabajo (-20 a -25 grados C segun el tejido).///2. Limpiar el interior de la camara con pano seco (NO usar agua mientras esta frio).///3. Verificar la temperatura de trabajo con termometro calibrado.///4. Montar cuchilla nueva y realizar secciones de prueba con tejido de control.///5. Comprobar que la luz interior funciona y el estado de la junta de la puerta." }
    [pscustomobject]@{ Tipo="Interno"; Per="Posttemporada"; Op="Descongelacion y limpieza profunda";
      Instr="Al final de la temporada:///1. Apagar el criostato y dejar descongelar completamente (puede tardar horas). Colocar panos absorbentes.///2. Limpiar el interior con pano humedo y desinfectante compatible con acero inoxidable.///3. Eliminar todos los restos de tejido o criomatriz (OCT). Usar EPI (guantes, mascarilla).///4. Retirar la cuchilla y desecharla en contenedor de cortopunzantes.///5. Limpiar el exterior. Dejar la puerta entreabierta para ventilar antes de cubrir." }
  )
  INC = @(
    [pscustomobject]@{ Tipo="Interno"; Per="Semestral"; Op="Limpieza y verificacion de temperatura y CO2";
      Instr="1. Retirar todas las bandejas y rejillas del interior.///2. Limpiar el interior con solucion de etanol al 70% o hipoclorito diluido. Aclarar con agua destilada y dejar secar.///3. Limpiar bandejas y rejillas con detergente neutro, aclarar y secar.///4. Verificar la temperatura con termometro calibrado en distintos puntos (tolerancia: mas/menos 1 grado C).///5. Si tiene CO2: verificar la concentracion con analizador calibrado.///6. Comprobar el nivel de agua del deposito de humidificacion (si lo tiene); rellenar con agua esteril.///7. Verificar el filtro HEPA si dispone de el." }
  )
  EST = @(
    [pscustomobject]@{ Tipo="Interno"; Per="Anual"; Op="Limpieza y verificacion de temperatura";
      Instr="1. Retirar las bandejas interiores.///2. Limpiar el interior con alcohol isopropilico o pano humedo con detergente. Aclarar y secar completamente.///3. Interior acero: con abrillantador para acero inoxidable. Exterior: pano humedo con detergente suave. Pantalla tactil: limpiagafas.///4. Verificar la temperatura real con termometro calibrado en al menos 2 puntos. Tolerancia habitual: mas/menos 5 grados C.///5. Comprobar el estado de los fusibles (parte trasera del equipo). APAGAR antes de revisar.///6. Verificar que la puerta cierra hermeticamente (junta en buen estado)." }
  )
  REF = @(
    [pscustomobject]@{ Tipo="Interno"; Per="Semestral"; Op="Limpieza y verificacion de temperatura";
      Instr="1. Vaciar la nevera o trasladar el contenido temporalmente.///2. Si hay acumulacion de hielo (modelo sin frost-free): apagar y descongelar con puerta abierta.///3. Limpiar el interior con solucion de bicarbonato sodico al 2% (evita olores) o agua y detergente neutro. Aclarar y secar.///4. Limpiar las juntas de la puerta con pano humedo.///5. Verificar la temperatura con termometro calibrado: neveras de reactivos deben mantener 2-8 grados C.///6. Comprobar que el motor no hace ruidos anomalos." }
  )
  CONX = @(
    [pscustomobject]@{ Tipo="Interno"; Per="Semestral"; Op="Descongelacion y limpieza";
      Instr="1. Trasladar el contenido a otro congelador o neverita de hielo seco (planificar con antelacion).///2. Apagar el congelador y dejar la puerta abierta para descongelar. Colocar panos absorbentes.///3. Limpiar el interior con pano humedo y detergente neutro.///4. Aclarar y secar completamente antes de encender.///5. Verificar que alcanza la temperatura de trabajo en 2-3 horas.///6. Controlar temperatura con termometro calibrado: menor o igual a -18 grados C (estandar) o -80 grados C (ultracongelador)." }
  )
  CAB = @(
    [pscustomobject]@{ Tipo="Interno"; Per="Mensual"; Op="Limpieza, desinfeccion y verificacion de filtro";
      Instr="1. Limpiar la superficie de trabajo con alcohol isopropilico al 70% o etanol al 70%. Dejar actuar 1 min.///2. Limpiar las paredes interiores y la rejilla con la misma solucion.///3. Para cabina de flujo laminar: verificar que la alarma de presion no se activa durante el funcionamiento.///4. Revisar el contador horario del filtro. Si llega a la alarma de cambio de filtro, notificar para mantenimiento externo.///5. Limpiar el exterior con pano humedo y detergente neutro. No usar sustancias abrasivas.///6. NUNCA usar llama abierta en el interior de la cabina." }
    [pscustomobject]@{ Tipo="Externo"; Per="Bianual"; Op="Certificacion y validacion de la cabina de bioseguridad";
      Instr="Certificacion obligatoria para cabinas de bioseguridad clase II por empresa acreditada.///Incluye: verificacion del caudal de aire, test de integridad del filtro HEPA (DOP/PAO test), verificacion de alarma de velocidad de aire.///El responsable de mantenimiento gestiona la contratacion y conserva el certificado de validacion." }
  )
  VIT = @(
    [pscustomobject]@{ Tipo="Interno"; Per="Anual"; Op="Limpieza y verificacion de flujo de aire";
      Instr="1. Limpiar las superficies con pano humedo y detergente. Evitar sustancias abrasivas. Limpiar inmediatamente cualquier derrame.///2. Si tiene filtro de carbon activo: verificar el estado del contador horario. Si hay alarma de cambio de filtro (normalmente a las 600 h), contactar con el SAT.///3. Verificar que el caudal de aire es adecuado: encender la vitrina, colocar papel de tissu en la apertura frontal; debe ser atraido hacia el interior.///4. Verificar que la alarma de velocidad de aire funciona.///5. Para resetear el contador tras cambio de filtro (modelo Indelab): pulsar LUZ + AUX a la vez; luego encender y pulsar REARME." }
  )
  WAT_REP = @(
    [pscustomobject]@{ Tipo="Externo"; Per="Anual"; Op="Cambio de filtros, cartuchos y lampara UV (Rephile)";
      Instr="Mantenimiento por empresa externa (Rephile o distribuidor autorizado).///Incluye: cambio de prefiltros, cartucho de resina intercambiadora de iones, cartucho desionizador, membrana de ultrafiltracion y lampara UV.///El responsable gestiona el contacto con el distribuidor y coordina la visita tecnica." }
    [pscustomobject]@{ Tipo="Interno"; Per="Mensual"; Op="Verificacion de conductividad y calidad del agua";
      Instr="1. Verificar el valor de conductividad o resistividad del display del purificador. Agua tipo 1: mayor o igual a 18 MOhm por cm; agua tipo 2: mayor o igual a 1 MOhm por cm.///2. Si el valor esta fuera del rango esperado, consultar el manual (posible saturacion de cartucho o membrana sucia).///3. Hacer pasar 500 mL de agua antes de recoger muestras si el equipo lleva tiempo sin usarse.///4. Anotar el valor registrado en las observaciones." }
  )
  WAT_HIE = @(
    [pscustomobject]@{ Tipo="Interno"; Per="Semestral"; Op="Limpieza y desinfeccion del deposito";
      Instr="1. Vaciar completamente el deposito de hielo.///2. Limpiar el interior con solucion de hipoclorito sodico al 0,5% (1:100 de lejia domestica). Dejar actuar 5 min.///3. Aclarar abundantemente con agua limpia para eliminar todos los restos de cloro.///4. Limpiar el exterior con pano humedo.///5. Encender y verificar que produce hielo en 30-60 min.///6. Desechar el primer lote de hielo producido tras la limpieza." }
  )
  WAT_KJE = @(
    [pscustomobject]@{ Tipo="Interno"; Per="Mensual"; Op="Limpieza del circuito y inspeccion de mangueras";
      Instr="LIMPIEZA DEL CIRCUITO DE DESTILACION (despues de cada sesion):///- Destilar 50 mL de agua destilada durante 5 min para eliminar restos de NaOH.///LIMPIEZA DE LA CAMARA:///- Usar pano mojado con agua para limpiar el interior y sus componentes. Limpiar la bandeja con agua.///LIMPIEZA DE LA JUNTA DE CIERRE (trimestral):///- Limpiar con agua los restos de NaOH en la junta. Extraer tirando y girando hacia abajo.///LIMPIEZA DE LOS CIRCUITOS DE NaOH Y BORICO:///- Limpiar los conectores de manguera con agua destilada. Vaciar el deposito de NaOH y limpiar.///INSPECCION DE MANGUERAS:///- Inspeccion visual de todas las mangueras. Sustituir cualquier manguera deteriorada o con fugas." }
  )
  PCR_qPCR = @(
    [pscustomobject]@{ Tipo="Interno"; Per="Anual"; Op="Calibracion espacial, de fondo y del marcaje";
      Instr="Calibracion del termociclador StepOne (Applied Biosystems). Requiere el kit de calibracion espectral.///CALIBRACION ESPACIAL:///1. Sacar la placa 1 del kit del congelador y atemperar 5 min. Vortexear y centrifugar 2 min a 1500 rpm o mas.///2. En el software: Instrument Maintenance Manager, opcion Spatial, Start Calibration, START RUN.///CALIBRACION DEL FONDO:///3. Mismo procedimiento con la placa de calibrado del fondo. Opcion Background.///CALIBRACION DEL MARCAJE:///4. Mismo procedimiento con la placa de colorante. Opcion Dye, System Dye Calibration.///LIMPIEZA DEL BLOQUE DE MUESTRAS:///5. Si hay pocillos contaminados: limpiar con agua descontaminada, luego etanol 95%, luego lejia al 10%.///NOTA: La calibracion requiere el kit especifico. Si esta pendiente de adquisicion, contactar con compras." }
  )
  PHM = @(
    [pscustomobject]@{ Tipo="Interno"; Per="Mensual"; Op="Calibracion con tampones patron";
      Instr="La calibracion es especialmente importante al inicio de cada serie de medidas, tras sustituir el electrodo, tras medir muestras agresivas, o cuando se requiera alta precision.///1. Preparar tampones patron de dos puntos (ej. pH 4 y 7, o 7 y 10, segun el rango de trabajo).///2. Enjuagar el electrodo con agua destilada. Secar con papel absorbente (NO frotar).///3. Calibrar con el tampon de pH mas bajo primero, luego el segundo segun las instrucciones del modelo.///4. Para el pHmetro portatil HI 9023C: consultar paginas 6-9 del manual.///5. Para el pHmetro Crison Basic: consultar pagina 5 del manual.///6. Tras la calibracion, mantener el electrodo en solucion de KCl 3M. NUNCA en agua destilada." }
    [pscustomobject]@{ Tipo="Interno"; Per="Anual"; Op="Mantenimiento del electrodo y verificacion de pilas";
      Instr="1. Verificar que las pilas tienen carga suficiente. Sustituir si es necesario.///2. Inspeccionar el electrodo: si presenta cristales de KCl o coloracion, limpiar con agua destilada y KCl 3M.///3. Si el electrodo no se calibra correctamente incluso con tampones frescos, puede estar agotado: sustituir.///4. Limpiar el cuerpo del instrumento con pano humedo." }
  )
  PLA = @(
    [pscustomobject]@{ Tipo="Interno"; Per="Anual"; Op="Limpieza y verificacion de fusibles";
      Instr="1. Apagar el equipo.///2. Limpiar la placa de calentamiento o agitacion con pano humedo y jabon neutro diluido. Evitar que entre liquido en el interior.///3. Limpiar el exterior con pano humedo.///4. Comprobar los fusibles: estan en la parte trasera. APAGAR y desenchufar antes de acceder a ellos. Sustituir si estan fundidos por el mismo tipo y valor.///5. Encender y verificar que la agitacion y el calentamiento (si lo tiene) funcionan correctamente." }
  )
  AXI = @(
    [pscustomobject]@{ Tipo="Interno"; Per="Anual"; Op="Limpieza y verificacion";
      Instr="1. Apagar el agitador orbital.///2. Limpiar la plataforma con pano humedo y jabon neutro diluido.///3. Limpiar el exterior.///4. Verificar que la velocidad de agitacion es uniforme y no hay vibraciones excesivas.///5. Comprobar los anclajes de los soportes de recipientes." }
  )
  VOR = @(
    [pscustomobject]@{ Tipo="Interno"; Per="Anual"; Op="Limpieza y verificacion de funcionamiento";
      Instr="1. Apagar el vortex.///2. Limpiar la copa de agitacion con pano humedo y jabon neutro diluido. Si hay restos de muestras, usar guantes y desinfectante.///3. Limpiar el exterior con pano humedo y jabon neutro.///4. Encender y verificar que vibra de forma uniforme sin ruidos anomalos.///5. Comprobar que el ajuste de velocidad funciona correctamente." }
  )
  OSM = @(
    [pscustomobject]@{ Tipo="Interno"; Per="Semestral"; Op="Calibracion y limpieza";
      Instr="1. Calibrar el osmometro con estandares de osmolalidad conocidos (ej. 290 mOsm/kg para estandar de suero).///2. El resultado debe estar dentro de mas/menos 2% del valor certificado.///3. Si hay desviacion, ajustar segun el manual del modelo Gonotec OSMOMAT.///4. Limpiar la celda de medida con pano suave y agua destilada despues de cada sesion." }
  )
  GLI = @(
    [pscustomobject]@{ Tipo="Interno"; Per="Semestral"; Op="Control de calidad con muestra control";
      Instr="1. Usar la muestra de control de nivel normal y anormal del glucometro (o kit de control certificado).///2. Aplicar la muestra control segun las instrucciones del modelo (One Touch Verio).///3. El resultado debe estar dentro del rango impreso en el envase de control.///4. Si el resultado esta fuera de rango: verificar que las tiras reactivas no estan caducadas; que el vial de control no esta caducado; que la temperatura es correcta.///5. Registrar el resultado en las observaciones." }
  )
  COAG = @(
    [pscustomobject]@{ Tipo="Interno"; Per="Trimestral"; Op="Limpieza y control de calidad";
      Instr="1. Limpiar el exterior del equipo con pano humedo y jabon neutro.///2. Limpiar los pocillos de reaccion (si son reutilizables) con agua destilada y secar.///3. Realizar un control de calidad interno con plasma control de nivel normal: TP y APTT deben estar dentro del rango del kit de control.///4. Anotar los resultados en el registro." }
    [pscustomobject]@{ Tipo="Externo"; Per="Anual"; Op="Revision tecnica y calibracion por SAT";
      Instr="Mantenimiento por SAT del fabricante (RAL o Bio-Bas segun modelo).///Incluye verificacion del sistema optico y mecanico, y calibracion certificada.///El responsable gestiona la contratacion." }
  )
  CIT = @(
    [pscustomobject]@{ Tipo="Interno"; Per="Mensual"; Op="Control de calidad con particulas de referencia";
      Instr="1. Realizar el control diario de calidad con las particulas de referencia fluorescentes del fabricante (Celltac MEK-6500K).///2. Verificar que los CV (%) de las poblaciones de control estan dentro del rango aceptable.///3. Limpiar las lineas fluidicas con solucion de limpieza del fabricante segun el protocolo del manual." }
    [pscustomobject]@{ Tipo="Externo"; Per="Anual"; Op="Calibracion y revision tecnica por SAT";
      Instr="Mantenimiento por el servicio tecnico autorizado de Celltac/Nihon Kohden.///El responsable gestiona la contratacion e informa de cualquier desviacion detectada durante el control de calidad mensual." }
  )
  AUT = @(
    [pscustomobject]@{ Tipo="Interno"; Per="Trimestral"; Op="Limpieza y control de calidad";
      Instr="1. Realizar el control de calidad con suero control de nivel normal y patologico.///2. Los resultados deben estar dentro de los rangos del fabricante. Documentar.///3. Limpiar los tubos y conductos con solucion de limpieza del fabricante.///4. Limpiar el exterior con pano humedo y jabon neutro.///5. Verificar que hay reactivos suficientes para la siguiente sesion." }
    [pscustomobject]@{ Tipo="Externo"; Per="Anual"; Op="Revision tecnica y calibracion por SAT";
      Instr="Mantenimiento por SAT del fabricante.///El responsable gestiona la contratacion e informa de cualquier anomalia observada durante el curso." }
  )
  WPL = @(
    [pscustomobject]@{ Tipo="Interno"; Per="Anual"; Op="Limpieza de tuberias, cabezal y agarre";
      Instr="A) LIMPIEZA DE TUBERIAS: tras pulsar apagado, el equipo lava las tuberias con agua destilada automaticamente. Repetir el enjuague varias veces. Mensualmente (en uso intensivo): poner 350 mL de hipoclorito sodico al 1% en las botellas. Encender y enjuagar. Tras 5 min en remojo, limpiar las botellas y rellenar con agua y solucion normales.///B) LIMPIEZA DEL CABEZAL: descolgar el cabezal; quitar los tornillos selladores. Desinfectar en etanol al 75%. Limpiar el espacio interno con jeringuilla y etanol. Limpiar con cepillo suave.///C) MANTENIMIENTO DEL AGARRE: anadir agua destilada al agarre tras el uso. Evitar que entren trozos de papel u otras impurezas en la tuberia." }
  )
  RPL = @(
    [pscustomobject]@{ Tipo="Interno"; Per="Anual"; Op="Limpieza y verificacion del sistema optico";
      Instr="1. Apagar el equipo y desenchufarlo.///2. Limpiar el exterior, el rail y el transportador con balleta humeda y detergente suave (usar guantes).///3. SISTEMA OPTICO: NO tocar las lentes, filtros ni el detector fotoelectrico con los dedos. Evitar el flujo de liquido al interior del equipo. Si es necesaria la limpieza interna del sistema optico, contactar con el SAT.///4. Prevenir la entrada de polvo manteniendo el equipo cubierto cuando no este en uso.///5. Verificar con una placa de absorbancia conocida que los valores son reproducibles." }
  )
  COL = @(
    [pscustomobject]@{ Tipo="Interno"; Per="Anual"; Op="Limpieza y verificacion";
      Instr="1. Limpiar la superficie de la plataforma con pano humedo y alcohol 70%.///2. Verificar que el marcador o el boligrafo de china funciona correctamente y tiene tinta.///3. Comprobar que el contador electronico (si lo tiene) reinicia correctamente.///4. Limpiar el cristal iluminado con pano de microfibra seco para eliminar marcas." }
  )
  DEN = @(
    [pscustomobject]@{ Tipo="Interno"; Per="Semestral"; Op="Calibracion con estandar de densidad optica";
      Instr="1. Encender el densitometro y dejar que se estabilice (5-10 min).///2. Calibrar con el estandar del fabricante (Densimat, BioMerieux) segun las instrucciones del manual.///3. Verificar con una muestra de McFarland conocida (ej. 0,5 McFarland) que el resultado es correcto.///4. Limpiar la cubeta con agua destilada y secar con papel de laboratorio." }
    [pscustomobject]@{ Tipo="Externo"; Per="Anual"; Op="Revision tecnica por SAT";
      Instr="Mantenimiento por SAT de BioMerieux o distribuidor autorizado.///El responsable gestiona la contratacion." }
  )
  MUE = @(
    [pscustomobject]@{ Tipo="Externo"; Per="Anual"; Op="Calibracion por empresa acreditada";
      Instr="El muestreador microbiologico de aire (IUL Spin Air) debe ser calibrado anualmente por empresa acreditada para garantizar que el caudal de aspiracion es correcto (100 L/min).///El responsable gestiona la contratacion del servicio de calibracion." }
    [pscustomobject]@{ Tipo="Interno"; Per="Semestral"; Op="Limpieza y verificacion de caudal";
      Instr="1. Limpiar la cabeza de impacto con alcohol 70% y dejar secar antes de usar.///2. Verificar que la turbina gira libremente y no tiene obstrucciones.///3. Comprobar que la bateria o fuente de alimentacion proporciona el voltaje correcto.///4. Si dispone de caudalimetro: verificar que el caudal es de 100 L/min, mas/menos 5%." }
  )
  LUV = @(
    [pscustomobject]@{ Tipo="Interno"; Per="Semestral"; Op="Limpieza de superficie y verificacion";
      Instr="1. Limpiar la superficie del transiluminador o lampara UV con papel de laboratorio impregnado con etanol antes y despues de cada uso. En la revision semestral, revisar el estado general.///2. Verificar que la lampara se enciende correctamente y emite luz UV uniforme.///3. Comprobar el estado del filtro de visualizacion (si lo tiene).///4. Para el cambio de lampada UV: seguir las instrucciones de la pagina correspondiente del manual.///IMPORTANTE: Nunca mirar directamente la luz UV sin proteccion ocular adecuada. Usar gafas UV y proteger la piel." }
  )
  DIG = @(
    [pscustomobject]@{ Tipo="Interno"; Per="Mensual"; Op="Limpieza de bloques y comprobacion de tubos";
      Instr="1. Dejar enfriar el bloque de digestion completamente antes de limpiar.///2. Limpiar los orificios del bloque con cepillo seco para eliminar restos de muestra.///3. Limpiar el exterior con pano humedo y detergente neutro.///4. Revisar visualmente el estado de las mangueras del sistema scrubber (si lo tiene): sustituir si hay fugas.///5. Comprobar que el sistema de extraccion de vapores funciona correctamente. IMPORTANTE: los acidos concentrados generan vapores corrosivos." }
    [pscustomobject]@{ Tipo="Externo"; Per="Bianual"; Op="Revision tecnica por SAT";
      Instr="Revision tecnica bianual por SAT de JP Selecta o empresa autorizada.///El responsable gestiona la contratacion." }
  )
  VAC = @(
    [pscustomobject]@{ Tipo="Interno"; Per="Mensual"; Op="Cambio de agua y revision de mangueras";
      Instr="1. NUNCA dejar la cubeta llena de agua despues del uso.///2. Cambiar el agua de la bomba en cada sesion de uso (agua limpia, sin reactivos).///3. Revisar visualmente el estado de las mangueras interiores cada tres meses: si hay fugas, sustituirlas. Para acceder al interior, quitar la tapa superior con el equipo DESENCHUFADO.///4. Limpiar el exterior con pano humedo." }
  )
  MUL = @(
    [pscustomobject]@{ Tipo="Interno"; Per="Semestral"; Op="Calibracion de parametros y mantenimiento de electrodos";
      Instr="1. Calibrar el electrodo de pH con tampones patron de dos puntos (ver plan de pHmetros).///2. Calibrar el electrodo de conductividad con solucion estandar de conductividad conocida.///3. Calibrar el electrodo de oxigeno disuelto (si lo tiene) con aire saturado de agua.///4. Limpiar los electrodos con agua destilada antes y despues de cada calibracion.///5. Mantener el electrodo de pH en solucion de KCl 3M cuando no este en uso." }
  )
  MICROO = @(
    [pscustomobject]@{ Tipo="Interno"; Per="Semestral"; Op="Limpieza y verificacion";
      Instr="1. Apagar y desenchufar el microondas.///2. Retirar el plato giratorio y lavarlo con agua y detergente.///3. Limpiar el interior con pano humedo y detergente neutro. Prestar especial atencion a restos de agar o reactivos solidificados.///4. Limpiar la junta de la puerta.///5. Encender y verificar que el plato gira correctamente.///6. PRECAUCION: No calentar medios con agar sin agitar ni en recipientes cerrados (riesgo de ebullicion explosiva)." }
  )
  HOM = @(
    [pscustomobject]@{ Tipo="Interno"; Per="Anual"; Op="Limpieza de camara y verificacion";
      Instr="Stomacher 400 Circulator (SEWARD):///1. Limpiar el exterior con trapo humedo y detergente suave. NO usar disolventes (danarian el acabado).///2. Para la limpieza de la camara interior, desencajar la puerta segun el manual.///3. Limpiar el interior de la camara con pano humedo y detergente neutro.///4. Verificar que las palas de agitacion se mueven libremente.///5. Comprobar que la puerta cierra y abre correctamente." }
  )
  LMP = @(
    [pscustomobject]@{ Tipo="Interno"; Per="Anual"; Op="Verificacion de funcionamiento y limpieza";
      Instr="1. Verificar que la lampara se enciende y funciona correctamente.///2. Limpiar el reflector y la carcasa con pano seco.///3. Si la lampara no enciende o parpadea, sustituir la bombilla por una del mismo tipo y potencia." }
  )
  PCR_CONV = @(
    [pscustomobject]@{ Tipo="Interno"; Per="Anual"; Op="Limpieza y verificacion de temperatura del bloque";
      Instr="1. Limpiar la placa de los pocillos con pano suave humedecido en alcohol absoluto.///2. Si es necesario limpiar la superficie pintada, usar pano con jabon suave.///3. Verificar que la tapa calefactada funciona correctamente.///4. Si dispone de termometro de control de bloque: verificar que la temperatura real coincide con la programada (tolerancia: mas/menos 0,5 grados C)." }
  )
}

# ============================================================
# ASIGNAR PLANTILLA POR EQUIPO
# ============================================================
function Get-Plantilla($id, $tipo, $marca, $modelo) {
  $idU  = $id.ToUpper()
  $pref = ($id -split "-")[0].ToUpper()
  $txt  = ("$tipo $marca $modelo").ToLower()

  # Casos especificos por ID
  if ($idU -eq "WAT-001")   { return $T.WAT_REP }
  if ($idU -eq "WAT-002")   { return $T.WAT_HIE }
  if ($idU -eq "WAT-003")   { return $T.WAT_KJE }
  if ($idU -eq "PCR-001")   { return $T.PCR_qPCR }

  # Por tipo de equipo (texto)
  if ($txt -match "vortex|vortice")                   { return $T.VOR }
  if ($txt -match "vitrina|extraccion.*gas")           { return $T.VIT }
  if ($txt -match "stomacher|homogen")                 { return $T.HOM }
  if ($txt -match "coagulomet|coagul")                 { return $T.COAG }
  if ($txt -match "glucomet")                          { return $T.GLI }
  if ($txt -match "lavador.*microplac|microplate.wash") { return $T.WPL }
  if ($txt -match "lector.*microplac|microplate.read") { return $T.RPL }
  if ($txt -match "cuentacolon")                       { return $T.COL }
  if ($txt -match "densit")                            { return $T.DEN }
  if ($txt -match "muestreador")                       { return $T.MUE }
  if ($txt -match "multipar")                          { return $T.MUL }
  if ($txt -match "microond")                          { return $T.MICROO }
  if ($txt -match "bomba.*vac")                        { return $T.VAC }
  if ($txt -match "digest")                            { return $T.DIG }
  if ($txt -match "ultraviolet|lampara.*uv|uv.*lamp")  { return $T.LUV }
  if ($txt -match "osmomet")                           { return $T.OSM }
  if ($txt -match "citomet|citom")                     { return $T.CIT }
  if ($txt -match "fotometr|espectrofot|fotom")        { return $T.FOT }
  if ($txt -match "autoanal|analizad")                 { return $T.AUT }
  if ($txt -match "termocicl.*step|steponr|stepone")   { return $T.PCR_qPCR }
  if ($txt -match "termocicl")                         { return $T.PCR_CONV }
  if ($txt -match "phmet|ph metro|phm")                { return $T.PHM }
  if ($txt -match "placa.*agit|agit.*plac|axitad.*plac|placa.*axitad") { return $T.PLA }
  if ($txt -match "axitad.*orbital|agit.*orbital")     { return $T.AXI }
  if ($txt -match "lampada.*lab|lampara.*lab|lector.*elec") { return $T.LMP }

  # Por prefijo
  switch ($pref) {
    "BAL"    { return $T.BAL }
    "CEN"    { return $T.CEN }
    "AUTC"   { return $T.AUTC }
    "PIP"    { return $T.PIP }
    "PIPA"   { return $T.PIPA }
    "PIPR"   { return $T.PIPR }
    "FOT"    { return $T.FOT }
    "BAT"    { return $T.BAT }
    "ELE"    { return $T.ELE }
    "MICR"   { return $T.MICR }
    "PAR"    { return $T.PAR }
    "PRO"    { return $T.PRO }
    "CRI"    { return $T.CRI }
    "INC"    { return $T.INC }
    "EST"    { return $T.EST }
    "REF"    { return $T.REF }
    "CONX"   { return $T.CONX }
    "CAB"    { return $T.CAB }
    "WAT"    { return $T.WAT_REP }
    "COL"    { return $T.COL }
    "WPL"    { return $T.WPL }
    "RPL"    { return $T.RPL }
    "CIT"    { return $T.CIT }
    "COAG"   { return $T.COAG }
    "GLI"    { return $T.GLI }
    "OSM"    { return $T.OSM }
    "AUT"    { return $T.AUT }
    "AXI"    { return $T.AXI }
    "PLA"    { return $T.PLA }
    "VOR"    { return $T.VOR }
    "HOM"    { return $T.HOM }
    "DIG"    { return $T.DIG }
    "VAC"    { return $T.VAC }
    "LUV"    { return $T.LUV }
    "DEN"    { return $T.DEN }
    "MUE"    { return $T.MUE }
    "MUL"    { return $T.MUL }
    "LMP"    { return $T.LMP }
    "MICROO" { return $T.MICROO }
    "PHM"    { return $T.PHM }
    "PCR"    { return $T.PCR_CONV }
    default  { return $null }
  }
}

function Escape-Csv($val) {
  if ($null -eq $val) { return "" }
  $s = $val.ToString().Trim()
  if ($s -match '[",\r\n]') { return '"' + $s.Replace('"','""') + '"' }
  return $s
}

# ============================================================
# GENERAR PLANES
# ============================================================
$cabecera = "ID_Plan,ID_Equipo,Tipo_Intervencion,Periodicidad,Operacion,Activo,Instrucciones"
$filas    = [System.Collections.Generic.List[string]]::new()
$sinPlan  = [System.Collections.Generic.List[string]]::new()
$counter  = 0

$equipos = Import-Csv -Path $equiposCsv -Encoding UTF8

foreach ($eq in $equipos) {
  $id = $eq.ID_Activo.Trim()
  if (-not $id) { continue }

  $planes = Get-Plantilla $id $eq.Tipo_Equipo $eq.Marca $eq.Modelo

  if (-not $planes) {
    $sinPlan.Add("$id | $($eq.Tipo_Equipo) $($eq.Marca)")
    continue
  }

  foreach ($p in $planes) {
    $counter++
    $planId = "PM{0:D4}" -f $counter
    # Convertir /// en salto de linea real para la instruccion
    $instruccion = $p.Instr -replace "///", "`n"
    $fila = (@(
      $planId, $id, $p.Tipo, $p.Per, $p.Op, "TRUE", $instruccion
    ) | ForEach-Object { Escape-Csv $_ }) -join ","
    $filas.Add($fila)
  }
}

$contenido = $cabecera + "`r`n" + ($filas -join "`r`n") + "`r`n"
[System.IO.File]::WriteAllText($outputCsv, $contenido, $encBOM)

Write-Host "Planes generados: $($filas.Count) -> $outputCsv"
if ($sinPlan.Count -gt 0) {
  Write-Host "Equipos SIN plantilla ($($sinPlan.Count)):"
  $sinPlan | ForEach-Object { Write-Host "  $_" }
} else {
  Write-Host "Todos los equipos tienen plan asignado."
}
Write-Host ""
Write-Host "SIGUIENTE PASO: Importar planes_mantenimiento.csv en la hoja Planes_Mantenimiento"
Write-Host "  Archivo - Importar - Subir - 'Anadir a la hoja actual'"
Write-Host "  IMPORTANTE: la hoja debe tener cabecera en fila 1 (A-G). El CSV incluye la cabecera,"
Write-Host "  asi que al importar elige 'No convertir' y 'Anadir filas'. Borra la fila de cabecera del CSV si ya existe en Sheets."
