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
- `js/residuos.js` — módulo de gestión de residuos
- `js/equipos-render.js` — renderDashboard(), renderEquipos()
- `js/equipos-acciones.js` — guardarEquipo(), guardarIntervencion(), guardarActuacion()…
- `js/ubicaciones.js` — proveedores, ubicaciones, usuarios (incluye CRUD y modal de alumnos)
- `html/modales-equipos.html` — modales de equipo, intervención, actuación
- `html/modales-mantenimiento.html` — modales de registrar mantenimiento y gestionar plan
- `html/modales-residuos.html` — modales de residuos (tipo residuo, nivel, contenedor)
- `html/modales-catalogo.html` — modales de proveedor, ubicación, usuario
- `css/styles.css`

**Orden de carga de scripts en index.html:**
config.js → mantenimiento.js → auth.js → sheets.js → ui.js → equipos-render.js → equipos-acciones.js → … → tareas.js → residuos.js

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
- **Planes_Mantenimiento** — columnas A-G: `ID_Plan, ID_Equipo, Tipo_Intervencion, Periodicidad, Operacion, Activo, Instrucciones`
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
- `renderMantenimiento()` — página completa con tabs: Pendientes (filtros lab+período) y Planes configurados
- `exportarModeloCalidad(cursoAcademico)` — genera xlsx usando JSZip sobre la plantilla `assets/templates/MD84MAN01_Plan_mantemento_Sanidade.xlsx`, preservando 100% del formato original. Una fila por equipo × tipo (Interno/Externo), todas las fechas previstas separadas por comas. Portada=sheet1, LAB201=sheet2, LAB203=sheet3, LAB205=sheet4, LAB207=sheet5.
- `_detectarLabEquipo(eq)` — devuelve el lab de un equipo buscando en tabla Ubicaciones o inferiendo del campo Ubicacion (busca "201"/"203"/"205"/"207" con includes)
- `_labAHoja(labAula)` — mapea el lab detectado al nombre del sheet Excel

### Limpieza del sistema legado (COMPLETADO)
- Eliminadas funciones: `calcProximoPreventivo`, `togglePeriodicidadCustom`
- Eliminados campos del modal de equipos: eq-periodicidad, eq-periodicidad-custom, eq-ultimo-preventivo
- Eliminado campo "¿Actualizar próximo preventivo?" del modal de intervenciones
- Dashboard y tabla de equipos actualizados para usar el nuevo sistema

---

## Módulo de residuos – COMPLETADO (2025-05-15)

### Hojas en Sheets
- **Tipos_Residuo** — columnas A-G: `ID_Residuo, Nombre, Descripcion, Riesgo, Contenedor_Tipo, Lab, Zona`
  - `Lab` y `Zona` existen en el sheet pero ya no se usan en la UI (los residuos se generan en cualquier sitio)
- **Contenedores_Residuo** — columnas A-H: `ID_Contenedor, ID_Residuo, Lab, Zona, Nivel, Fecha_Actualizacion, Actualizado_Por, Tipo_Contenedor`

### Niveles de contenedor
`vacío` / `25%` / `50%` / `75%` / `lleno`. Badge en nav cuando hay alguno al 75% o lleno.

### Roles
- Todos los roles (incluido Alumno): pueden ver la Guía y actualizar el nivel de contenedores
- Admin / Gestor / **Profesor**: pueden crear, editar y eliminar tipos de residuo y contenedores

### Código implementado (`js/residuos.js`)
- `renderResiduosGuia()` — página con buscador y tabla agrupada por **Contenedor_Tipo** (categorías dinámicas)
- `openModalTipoResiduo / guardarTipoResiduo / eliminarTipoResiduo` — CRUD de tipos de residuo (Admin/Gestor/Profesor). El campo Contenedor_Tipo usa `<datalist>` con autocompletado de los tipos ya existentes — crear un nombre nuevo crea una nueva categoría automáticamente. No se puede eliminar un tipo si tiene contenedores asociados.
- `renderResiduosContenedores()` — tabla con nivel actual y badge de alerta
- `openModalNivel / guardarNivel` — actualizar nivel de un contenedor
- `openModalContenedor / guardarContenedor / eliminarContenedor` — CRUD de contenedores
- `anadirGarrafa / registrarRecogida` — gestión de contenedores rotativos (garrafas 5L)
- `_updateBadgeResiduos()` — badge en nav (definida en ui.js)

### Navegación
Sección "Residuos" independiente en el sidebar, con dos items: "Guía de residuos" y "Contenedores".

---

## Módulo de usuarios – COMPLETADO (2025-05-15)

### Hoja Usuarios – columnas (A–H)
| Col | Campo |
|-----|-------|
| A | ID_Usuario |
| B | Nombre |
| C | Email |
| D | Rol |
| E | Activo |
| F | Ubicaciones_Asignadas |
| G | Modulo |
| H | Ciclo_Principal |

- `sheetsGet('Usuarios!A2:H')` — rango actualizado para incluir la columna H
- `Modulo` (col G): nombres de módulos separados por coma, sin prefijo de ciclo (formato plano)
- `Ciclo_Principal` (col H): ciclo formativo explícito, determina el grupo en la UI. **La columna H debe existir en el sheet con ese encabezado.**

### Lógica de alumnos
- La pantalla de usuarios tiene 3 pestañas: **Admins y gestores | Profesores | Alumnos**
- La pestaña Alumnos agrupa por `Ciclo_Principal` (columna H). Fallback para registros antiguos: lee el prefijo embebido "Ciclo|Módulo" o hace lookup en DATA.ciclosModulos.
- Al crear/editar un alumno: se selecciona el ciclo en un dropdown (pobla desde DATA.ciclosModulos), luego se eligen los módulos de ese ciclo en una lista filtrada. Cambiar de ciclo elimina las selecciones que no pertenezcan al nuevo ciclo.
- `Ubicaciones_Asignadas` almacena números de lab ("201,203"), NO IDs de zona. `getUbicacionesAlumno()` en config.js los expande a IDs de zona al acceder.
- Búsqueda global por nombre/email y filtro por módulo dentro de la pestaña Alumnos.

### Ciclos_Modulos — estructura crítica
Varios módulos comparten nombre entre ciclos (ej. "Técnicas Xerais de Laboratorio" aparece en CS Lab Clínico, ZS Lab Clínico y CS Anatomía). Por eso el ciclo se guarda explícitamente en columna H y NO se infiere de los módulos. Los módulos se guardan como nombres planos.

---

## Pendiente de hacer

### 1. Datos – Planes_Mantenimiento (entrada de datos, no código)
Ya introducidos 272 planes. Revisar cobertura completa de todos los equipos.

### 2. Datos – Campos nuevos en equipos existentes (entrada de datos, en la app)
Para cada equipo actualizar via modal de edición:
- `Protocolo_Uso` — texto con instrucciones de uso básicas
- `Tipo_Mantenimiento` — Periódico o Estacional
- `Mes_Inicio_Temporada` / `Mes_Fin_Temporada` — solo si Estacional
- `Ubicacion` — actualizar al ID correcto de la tabla Ubicaciones (necesario para que el modelo de calidad los asigne al lab correcto)

### 3. Modelo de calidad – FUNCIONAL
- `exportarModeloCalidad()` genera xlsx con JSZip sobre la plantilla oficial
- Pendiente: verificar formato con más registros reales en Registro_Mantenimientos
- Pendiente: actualizar las ubicaciones de los equipos al formato correcto de la BD para que aparezcan todos en el xlsx

### 4. Datos – Residuos (entrada de datos, en la app) – EN CURSO
- Tipos de residuo: ya introducidos. Revisar que todos tengan `Contenedor_Tipo` relleno (es el campo que agrupa la guía).
- Contenedores físicos: introducir en Contenedores_Residuo con su nivel inicial.

### 5. Datos – Usuarios (entrada de datos, en la app)
- Alumnos existentes: al editarlos, seleccionar el `Ciclo_Principal` en el nuevo dropdown y guardar para que queden correctamente agrupados.
- Verificar que la columna H (`Ciclo_Principal`) existe en el sheet Usuarios con ese encabezado.

---

## Notas de diseño importantes

- Los **protocolos de uso** NO generan alertas; se muestran solo al expandir la card del equipo.
- Las **temporadas** (mes inicio/fin) son ajustables por Administrador y Gestor desde la app.
- El **lavador de microplacas** tiene una operación específica: limpieza periódica con disolución agua+lejía (incluir en su plan).
- Equipos muy específicos de una especialidad (densitómetro, etc.) → estacionales. Equipos de uso general (centrífugas, balanzas) → periódicos.
- El modelo de calidad se entrega una vez al año; la app debe poder generarlo con los datos del curso académico seleccionado.
- Las **categorías de contenedor de residuos** son dinámicas: emergen de los valores únicos de `Contenedor_Tipo` en Tipos_Residuo. Crear un tipo con un nombre de contenedor nuevo crea una nueva categoría automáticamente.
