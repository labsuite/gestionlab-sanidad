# GestionLab – Estado del proyecto

App web de gestión de laboratorio para el CIFP Manuel Antonio (Vigo).
Stack: JS vanilla + HTML/CSS, Google Sheets como base de datos vía REST API, Google OAuth client-side.

---

## Arquitectura general

- `index.html` — página principal, carga todos los scripts y modales
- `js/config.js` — constantes globales: DATA, COLS, ROLES, SHEETS_ID
- `js/auth.js` — OAuth Google (token management)
- `js/sheets.js` — helpers sheetsGet/sheetsAppend/sheetsUpdate/sheetsDeleteRow + loadAllData()
- `js/ui.js` — navegación, renderAll(), badges, carga de modales
- `js/mantenimiento.js` — sistema completo de mantenimiento preventivo
- `js/equipos-render.js` — renderDashboard(), renderEquipos()
- `js/equipos-acciones.js` — guardarEquipo(), guardarIntervencion(), guardarActuacion()…
- `html/modales-equipos.html` — modales de equipo, intervención, actuación
- `html/modales-mantenimiento.html` — modales de registrar mantenimiento y gestionar plan
- `css/styles.css`

**Orden de carga de scripts en index.html:**
config.js → mantenimiento.js → auth.js → sheets.js → ui.js → equipos-render.js → equipos-acciones.js → …

---

## Hoja de Equipos – columnas (A–W)

| Col | Campo |
|-----|-------|
| A | ID_Activo |
| B | Tipo_Equipo |
| C | Marca |
| D | Modelo |
| E | Numero_Serie |
| F | Ubicacion |
| G | Responsable |
| H | Fecha_Adquisicion |
| I | Origen_Financiacion |
| J | Proveedor_Compra |
| K | Proveedor_Servicio_Tecnico |
| L | Estado_Operativo |
| M | Periodicidad_Mantenimiento *(legado, no usar)* |
| N | Periodicidad_Custom *(legado, no usar)* |
| O | Fecha_Ultimo_Preventivo *(legado, no usar)* |
| P | Fecha_Proximo_Preventivo *(legado, no usar)* |
| Q | Manual_Ficha_Tecnica |
| R | Observaciones |
| S | Coste |
| T | Protocolo_Uso |
| U | Tipo_Mantenimiento |
| V | Mes_Inicio_Temporada |
| W | Mes_Fin_Temporada |

**Columnas M-P:** existen en Sheets pero la app las deja vacías. NO eliminar (desplazaría el resto).

---

## Sistema de mantenimiento preventivo – COMPLETADO

### Hojas nuevas en Sheets (ya creadas)
- **Planes_Mantenimiento** — columnas A-F: `ID_Plan, ID_Equipo, Tipo_Intervencion, Periodicidad, Operacion, Activo`
- **Registro_Mantenimientos** — columnas A-I: `ID_Registro, ID_Plan, ID_Equipo, Curso_Academico, Periodo, Fecha_Realizacion, Realizado_Por, Supervisado_Por, Observaciones`

### Lógica de periodos (mantenimiento.js)
- Curso académico: Sep–Jun, formato "YYYY-YYYY+1"
- Periodo mensual: "YYYY-MM"
- Trimestral: meses 0, 3, 6, 9 del curso
- Semestral: meses 0, 6 del curso
- Anual/Bianual: solo el primer mes del curso
- Pretemporada: "pretemporada-YYYY-YYYY" (si hoy ≥ Mes_Inicio_Temporada)
- Posttemporada: "posttemporada-YYYY-YYYY" (si hoy ≥ Mes_Fin_Temporada)

### Código implementado
- `buildMantenimientoEquipo(equipoId)` — sección en card de equipo: protocolo de uso + filas de plan con botón Registrar
- `openModalRegistrarMant / guardarRegistroMant` — modal y guardado de registro
- `openModalPlan / guardarPlan / eliminarPlan` — CRUD de planes
- `renderMantenimiento()` — página completa: stats, tabla pendientes, tabla gestión de planes
- `exportarModeloCalidad(cursoAcademico)` — genera documento HTML imprimible en formato modelo de calidad oficial

### Limpieza del sistema legado (COMPLETADO)
- Eliminadas funciones: `calcProximoPreventivo`, `togglePeriodicidadCustom`
- Eliminados campos del modal de equipos: eq-periodicidad, eq-periodicidad-custom, eq-ultimo-preventivo
- Eliminado campo "¿Actualizar próximo preventivo?" del modal de intervenciones
- Dashboard y tabla de equipos actualizados para usar el nuevo sistema

---

## Pendiente de hacer

### 1. Datos – Planes_Mantenimiento (entrada de datos, no código)
Hay que introducir los planes diseñados en la app. Se diseñaron tres grupos:

**Grupo A – Equipos periódicos comunes** (centrífugas, balanzas, autoclaves, microscopios, etc.)
- Planes mensual, trimestral, semestral o anual según tipo
- Tipo_Mantenimiento = Periódico

**Grupo B – Equipos estacionales** (microtomos, criostatos, procesadores de tejidos, densitómetros, etc.)
- Pretemporada + posttemporada
- Tipo_Mantenimiento = Estacional; ajustar Mes_Inicio y Mes_Fin según realidad del centro

**Grupo C – Equipos varios** (micropipetas, pipetores, agitadores magnéticos, vórtex, glucómetro,
cubetas de electroforesis, transiluminador UV, cuentacolonias, neveras, microondas)
- Planes diseñados en sesión; introducir en la app

### 2. Datos – Campos nuevos en equipos existentes (entrada de datos, en la app)
Para cada equipo actualizar via modal de edición:
- `Protocolo_Uso` — texto con instrucciones de uso básicas
- `Tipo_Mantenimiento` — Periódico o Estacional
- `Mes_Inicio_Temporada` / `Mes_Fin_Temporada` — solo si Estacional

### 3. Archivo huérfano
- `js/equipos.js` — archivo antiguo, NO está cargado en index.html, puede eliminarse
  (verificar que no hay referencias antes de borrar)

### 4. Modelo de calidad
- Probar `exportarModeloCalidad()` cuando haya datos en Registro_Mantenimientos
- Verificar que el formato generado coincide con el documento oficial
  (referencia: `inventario/MD84MAN01_Plan_mantemento_Sanidade (1).xlsx`)

---

## Notas de diseño importantes

- Los **protocolos de uso** NO generan alertas; se muestran solo al expandir la card del equipo.
- Las **temporadas** (mes inicio/fin) son ajustables por Administrador y Gestor desde la app.
- El **lavador de microplacas** tiene una operación específica: limpieza periódica con disolución agua+lejía (incluir en su plan).
- Equipos muy específicos de una especialidad (densitómetro, etc.) → estacionales. Equipos de uso general (centrífugas, balanzas) → periódicos.
- El modelo de calidad se entrega una vez al año; la app debe poder generarlo con los datos del curso académico seleccionado.
