# Módulo de mantenimiento preventivo – COMPLETADO

## Hojas en Sheets
- **Planes_Mantenimiento** — columnas A-G: `ID_Plan, ID_Equipo, Tipo_Intervencion, Periodicidad, Operacion, Activo, Instrucciones`
- **Registro_Mantenimientos** — columnas A-I: `ID_Registro, ID_Plan, ID_Equipo, Curso_Academico, Periodo, Fecha_Realizacion, Realizado_Por, Supervisado_Por, Observaciones`

## Lógica de periodos (mantenimiento.js)
- Curso académico: Sep–Jun, formato "YYYY-YYYY+1"
- Periodo mensual: "YYYY-MM"
- Trimestral: meses 0, 3, 6, 9 del curso
- Semestral: meses 0, 6 del curso
- Anual: el primer (o último, si `_esMomentoFin`) mes del curso
- **Bianual/Trianual: igual que Anual, pero solo en los cursos que tocan** —
  `_esCursoDebidoMultianual()` mira el último `Curso_Academico` con un registro real en
  `registro_mantenimientos` para ese `ID_Plan` y solo lo da por "debido" si han pasado 2
  (Bianual) o 3 (Trianual) cursos desde entonces. Si el plan nunca se ha registrado como
  realizado, se sigue pidiendo todos los cursos (para no perder el aviso). Aplica tanto a
  `getPeriodosEsperados` (dashboard) como a `getPeriodosCursoCompleto` dentro de
  `exportarModeloCalidad` (el Excel del plan de mantenimiento).
- Pretemporada: "pretemporada-YYYY-YYYY" (si hoy ≥ Mes_Inicio_Temporada)
- Posttemporada: "posttemporada-YYYY-YYYY" (si hoy ≥ Mes_Fin_Temporada)

## Datos
- 410 planes activos en `planes_mantenimiento` (2026-08-22; el número crece con el tiempo,
  no usar como referencia fija). Distribución de periodicidad: Anual 172, Semestral 78,
  Bianual 72, Mensual 30, Trimestral 25, Posttemporada 22, Pretemporada 9, Trianual 2.
  Los 74 planes Bianual/Trianual son casi todos revisiones/certificaciones externas
  (autoclaves, cabinas de bioseguridad, congeladores, lupas y microscopios por SAT).
- Columna "Supervisado por" se rellena automáticamente con gestores/admins activos.
- Pendiente: actualizar Ubicacion de equipos estacionales (ver pendientes en CLAUDE.md).
