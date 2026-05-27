# Módulo de residuos – COMPLETADO (2026-05-18)

## Hojas en Sheets
- **Tipos_Residuo** — columnas A-G: `ID_Residuo, Nombre, Descripcion, Riesgo, Contenedor_Tipo, Lab, Zona`
  - `Lab` y `Zona` existen en el sheet pero ya no se usan en la UI
- **Contenedores_Residuo** — columnas A-K: `ID_Contenedor, Categoria, Lab, Zona, Nivel, Estado, Fecha_Apertura, Fecha_Cierre, Fecha_Actualizacion, Actualizado_Por, Formato`
  - `Estado`: `activo` / `cerrado` (listo para recogida) / `recogido` (eliminado físicamente)
- **Adiciones_Residuo** — columnas A-F: `ID_Adicion, ID_Contenedor, ID_Residuo, Fecha, Usuario, Observaciones`
- **Consultas_Residuo** — columnas A-F: `ID_Consulta, Fecha, Usuario, Descripcion, Ubicacion_Dejado, Estado`
  - Estado: `Pendiente` / `Resuelta`

## Niveles de contenedor
`vacío` / `25%` / `50%` / `75%` / `lleno`. Badge en nav cuando hay alguno al 75%, lleno o cerrado.

## Ciclo de vida de un contenedor
1. Se crea como `activo` con nivel inicial.
2. Se registran adiciones (cada una actualiza el nivel).
3. Al cerrarlo: `Estado=cerrado`, `Fecha_Cierre` registrada, se crea automáticamente un contenedor nuevo vacío de la misma categoría+lab.
4. Al registrar la recogida de Consenur: `Estado=recogido`, la fila se elimina físicamente del sheet.

## Roles
- Todos los roles (incluido Alumno): pueden ver la Guía y registrar adiciones en contenedores
- Admin / Gestor / **Profesor**: pueden crear, editar, cerrar y eliminar **contenedores**
- Admin / Gestor (solo): pueden crear, editar y eliminar **tipos de residuo** (Profesor no tiene este permiso)

## Peligrosidad GHS
- `Riesgo` almacena pictogramas como string con comas: `"Tóxico, Inflamable"` (vacío = sin peligrosidad)
- Valores canónicos: `Tóxico` / `Nocivo / Irritante` / `Inflamable` / `Comburente` / `Corrosivo` / `Cancerígeno / CMR` / `Peligroso para el medio ambiente` / `Explosivo` / `Gas comprimido` / `Citotóxico`
- `_GHS` — constante con mapa `{nombre: {icon, bg, color}}` para los 10 pictogramas
- `_riesgoBadges(riesgo)` — renderiza cada valor GHS como chip de color; valores no reconocidos → chip genérico ⚠️ naranja
- Los 113 tipos R001–R113 tienen Riesgo actualizado con `scripts/actualizar_riesgos_ghs.py`

## Avisos de seguridad por formato (`_WARNINGS_FORMATO`)
| Formato (matching parcial) | Aviso |
|---|---|
| bidón azul | Líquidos en bote propio, cerrado y rotulado dentro del bidón |
| cubo con tapa / contenedor rígido | NO cerrar tapa hasta que esté lleno y listo para Consenur |
| bolsa plástica | Solo envases vacíos de plástico/aluminio; nada a granel |
| garrafa | Mantener cerrada entre adiciones; zona ventilada sin calor |

## Consultas de residuo desconocido
- Badge en nav suma consultas pendientes + contenedores al 75%/lleno/cerrado
- Banner en dashboard para Gestor/Admin cuando hay consultas pendientes
- Stat card en dashboard: "Residuos por clasificar"
- Cuando la búsqueda no encuentra resultados: mensaje "No lo tires todavía" + botón "Avisar a la gestora"
- Desde el panel de consultas: botón "＋ Añadir a guía" abre modal de nuevo tipo con descripción pre-rellenada

## Etiquetas NFC/QR
La URL codifica **categoría + lab** (no el ID del contenedor) → la etiqueta nunca necesita reprogramarse al cerrar un contenedor. `_checkPendingNfcAction()` en `ui.js` detecta los parámetros tras el login y redirige al modal de adición correcto.

## Categorías de contenedor
Dinámicas: emergen de los valores únicos de `Contenedor_Tipo` en Tipos_Residuo. Crear un tipo con nombre de contenedor nuevo crea una nueva categoría automáticamente.

## Pendiente (datos)
- Revisar que todos los tipos tengan `Contenedor_Tipo` relleno.
- Contenedores físicos: introducir en Contenedores_Residuo con nivel inicial (requiere acceso al instituto).
