# GestionLab – Estado del proyecto

App web de gestión de laboratorio para el CIFP Manuel Antonio (Vigo).
Stack: JS vanilla + HTML/CSS, Google Sheets como base de datos vía REST API, Google OAuth client-side.
URL de la app: `https://palomafedez.github.io/gestionlab-sanidad/`

---

## Documentación de módulos

Ver `docs/` para detalles de módulos completados y patrones de implementación:
- `docs/modulo-mantenimiento.md` — hojas Planes_Mantenimiento / Registro_Mantenimientos, lógica de periodos
- `docs/modulo-residuos.md` — GHS, ciclo de vida de contenedores, consultas, NFC/QR
- `docs/modulo-reservas.md` — políticas BLOCK/COMPATIBLE, estados, 23 equipos configurados
- `docs/modulo-usuarios.md` — columnas Usuarios, lógica alumnos, ciclos/módulos, usuarios _sbOnly
- `docs/modulo-pedidos.md` — estados pedido/solicitud, recepción de líneas, historial, eliminar ítems
- `docs/supabase.md` — integración actual + fases 2-4 pendientes
- `docs/patrones-ui.md` — autocomplete incidencias, tablas/líneas responsive, alertas stock dashboard

---

## Scripts de mantenimiento de base de datos (carpeta `scripts/`)

Permiten modificar Google Sheets directamente desde Claude Code.
Autenticación vía cuenta de servicio (`scripts/credentials.json`, excluido de git).

### Estructura
- `base.py` — conexión y funciones comunes (importar desde aquí)
- `test_conexion.py` — verifica que la conexión funciona
- `nuevo_residuo.py` — INSERT en Tipos_Residuo
- `actualizar_riesgos_ghs.py` — UPDATE masivo del campo Riesgo en Tipos_Residuo con pictogramas GHS; `DRY_RUN = True` por defecto
- `actualizar_planes.py` — UPDATE en Planes_Mantenimiento (operación, periodicidad, tipo...)
- `actualizar_equipos.py` — UPDATE en Equipos (protocolos, temporadas, ubicaciones...)
- `limpiar_hoja.py` — DELETE en cualquier hoja con filtro; `DRY_RUN = True` por defecto
- `limpiar_inventario_fungible.py` — DELETE de todas las filas de las 8 hojas del módulo de fungibles
- `importar_alumnos.py` — INSERT masivo en Usuarios desde Excel (inicio de curso)
- `rellenar_mantenimientos.py` — INSERT en Registro_Mantenimientos de todos los periodos de un curso como realizados (solo Internos); `DRY_RUN = True` por defecto. Usar al inicio de cada curso para poblar el historial.
- `quitar_externos_excel.py` — elimina filas de Tipo_Intervencion=Externo de un XLSX ya exportado; busca automáticamente el más reciente en Descargas o acepta ruta como argumento. Genera `*_sin_externos.xlsx` sin tocar el original.
- `generar_modelo_calidad.py` — genera los dos Excel del modelo de calidad (inventario + plan de mantenimiento) desde Python; alternativa al botón de la app cuando se necesita uso puntual offline.

### Flujo de trabajo
1. Usuario describe el cambio a Claude
2. Claude rellena la sección `CONFIGURACIÓN` del script correspondiente
3. Usuario ejecuta `! python scripts/<nombre>.py`
4. Los cambios aparecen directamente en Sheets

### Funciones de base.py
| Función | Uso |
|---|---|
| `conectar()` | Devuelve el spreadsheet autenticado |
| `leer(sh, hoja)` | Devuelve `(ws, headers, datos)` |
| `buscar(ws, campo, valor)` | Filas con coincidencia exacta |
| `buscar_multi(ws, {campo: valor})` | Filas que cumplen todos los filtros |
| `buscar_contiene(ws, campo, texto)` | Búsqueda parcial sin distinción de mayúsculas |
| `todas_las_filas(ws)` | Índices de todas las filas de datos |
| `actualizar(ws, filas, campo, valor)` | Actualiza un campo (batch) |
| `actualizar_varios(ws, filas, {campo: valor})` | Actualiza varios campos (batch) |
| `actualizar_fila_por_fila(ws, [(fila, {campo: valor})])` | Cambios distintos por equipo |
| `eliminar(ws, filas)` | Borra filas de abajo arriba |
| `eliminar_todas(ws)` | Limpieza total manteniendo cabecera |
| `insertar(ws, dict)` | Añade una fila |
| `insertar_varios(ws, [dicts])` | Añade múltiples filas (batch) |
| `siguiente_id(ws, campo_id, prefijo)` | Genera el siguiente ID correlativo |
| `preview_filas(ws, filas, campos)` | Muestra preview antes de actuar |

### Formatos de ID por hoja
| Hoja | Formato | Ejemplo |
|---|---|---|
| Tipos_Residuo | `R` + 3 dígitos sin guión | `R001`, `R112` |
| Usuarios | `USR-` + 3 dígitos | `USR-001` |
| Planes_Mantenimiento | `PM` + 4 dígitos | `PM0046` |
| Equipos | prefijo tipo + guión + número | `CEN-02`, `PIP-035` |

⚠ Usar `siguiente_id()` solo si el formato es `PREF-NNN`. Para formatos sin guión (como Tipos_Residuo), calcular el ID manualmente.

### Formato Excel para importar alumnos
Cabecera: `Nombre | Apellidos | Email | Ciclo | Modulos | Labs`
- Ciclo: nombre completo coincidente con Ciclos_Modulos
- Modulos: separados por coma
- Labs: números de lab separados por coma (ej: `201,203`)

---

## Exportación de documentos de calidad

Dos botones en el módulo de mantenimiento (`js/mantenimiento.js`) generan los Excel del modelo de calidad usando JSZip sobre las plantillas de `assets/templates/`. No requieren servidor; se ejecutan en el navegador.

### 📄 Exportar plan de mantenimiento (`exportarModeloCalidad`)
Plantilla: `assets/templates/MD84MAN01_Plan_mantemento_Sanidade.xlsx`
Salida: `MD84MAN01_Plan_mantemento_YYYY-YYYY.xlsx`
**Una fila por plan** (no por equipo × tipo). Columnas:

| Col | Contenido |
|-----|-----------|
| A | Denominación `Tipo_Equipo Marca Modelo (ID_Activo) · ID_Plan` |
| B | Nº de laboratorio extraído de Ubicacion (ej. `205`) |
| C | Responsable del equipo; si vacío → Gestores y Admins activos |
| D | Interno / Externo |
| E | Periodicidad del plan (normalizada; Pre/Posttemporada → `Anual`) |
| F | Operación del plan |
| G | Fechas previstas (`01/MM/YYYY` de cada periodo del curso completo) |
| H | Fechas de realización registradas en Registro_Mantenimientos |
| I | Gestores y Admins activos (supervisores) |
| J | Si hay incidencia abierta: `Descripcion_Problema (ID_Incidencia)` |

**Notas de implementación:**
- Los periodos se calculan con `getPeriodosCursoCompleto` (incluye futuros, aplica filtro `Con_Alumnado` igual que el script Python).
- Al generar el XLSX se normalizan todas las fuentes del `xl/styles.xml`: Arial→Xunta Sans, `color theme="1"` (negro)→`#002B4A`, fuentes sin color→`#002B4A`, 8pt→10pt. El template tiene zonas de estilos que degeneran a negro a partir de la fila ~33-66 según hoja.
- Para eliminar los Externos del documento ya generado: usar `scripts/quitar_externos_excel.py`.

### 📋 Exportar inventario (`exportarInventario`)
Plantilla: `assets/templates/CIFP Manuel Antonio_Inventarios_Curso 2025-26.xlsx` (hoja `Sanidade`)
Salida: `Inventario_Sanidade_YYYY-YYYY.xlsx`
Una fila por equipo, ordenados por ubicación y tipo. Columnas:

| Col | Contenido |
|-----|-----------|
| A | Tipo_Equipo (ID_Activo) |
| B | Nº de laboratorio extraído de Ubicacion |
| C | Marca Modelo |
| D | Numero_Serie |
| E | 1 (unidades) |
| F | Si incidencia abierta: `Incidencia abierta. Impacto (ID_Incidencia)`; si no: Estado_Operativo |

**Extracción de nº de lab:** regex `\b(\d{3})\b` sobre el campo Ubicacion — funciona tanto con `Lab 205` como con `205-ZC-2.1`.

---

## Rangos de carga en sheets.js

⚠ Al añadir una columna nueva a una hoja de Sheets, **actualizar el rango** en `loadAllData()` (`js/sheets.js`) y las columnas en `COLS` (`js/config.js`). Si no, el campo llega siempre `undefined` en el navegador.

Rangos actuales relevantes:
| Hoja | Rango | Última col |
|------|-------|-----------|
| Planes_Mantenimiento | `A2:H` | H = Con_Alumnado |
| Registro_Mantenimientos | `A2:I` | I = Observaciones |
| Equipos | `A2:W` | W = Mes_Fin_Temporada |
| Pedidos | `A2:U` | U = Gasto_Extra_Importe |
| Material_Ubicaciones | `A2:H` | H = Unidad_Lote |
| Solicitudes | `A2:K` | K = Snooze_Hasta |

---

## Arquitectura general

- `index.html` — página principal, carga todos los scripts y modales
- `js/config.js` — constantes globales: DATA, COLS, ROLES, SHEETS_ID
- `js/auth.js` — OAuth Google (token management)
- `js/sheets.js` — helpers sheetsGet/sheetsAppend/sheetsUpdate/sheetsDeleteRow + loadAllData()
- `js/ui.js` — navegación, renderAll(), badges, carga de modales
- `js/mantenimiento.js` — sistema completo de mantenimiento preventivo
- `js/residuos.js` — módulo de gestión de residuos
- `js/reservas.js` — módulo de reservas de equipos de laboratorio
- `js/equipos-render.js` — renderDashboard(), renderEquipos()
- `js/equipos-acciones.js` — guardarEquipo(), guardarIntervencion(), guardarActuacion()…
- `js/ubicaciones.js` — proveedores, ubicaciones, usuarios (incluye CRUD y modal de alumnos)
- `html/modales-equipos.html` — modales de equipo, intervención, actuación
- `html/modales-mantenimiento.html` — modales de registrar mantenimiento y gestionar plan
- `html/modales-residuos.html` — modales de residuos (tipo residuo, nivel, contenedor)
- `html/modales-reservas.html` — modales de reservas (nueva reserva, gestión, configurar equipo)
- `html/modales-catalogo.html` — modales de proveedor, ubicación, usuario
- `css/styles.css`

**Orden de carga de scripts en index.html:**
config.js → mantenimiento.js → auth.js → sheets.js → ui.js → equipos-render.js → equipos-acciones.js → … → tareas.js → residuos.js → reservas.js

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

## Tipos de intervención – lista canónica

Aplica a los tres selects: `int-tipo` (modal intervención), `plan-tipo` (plan desde incidencia) y `act-tipo-int` (modal actuación). **No incluir "Preventivo"** — el mantenimiento preventivo se gestiona desde Planes_Mantenimiento.

`Correctivo` / `Calibración` / `Verificación funcional` / `Validación` / `Limpieza` / `Descontaminación` / `Sustitución de pieza` / `Cambio de consumibles` / `Control de temperatura` / `Puesta en marcha` / `Actualización de software`

---

## Categorías de material – lista canónica

Select `mat-categoria` en `html/modales-material.html`:

- Reactivo químico — ácidos, disolventes, bases, sales...
- Solución y tampón — formol, PBS, fijadores, diluciones...
- Colorante y tinción — HE, Giemsa, Papanicolaou, Diff-Quick...
- Medio de cultivo — agares, caldos, medios selectivos...
- Kit diagnóstico — ELISA, pruebas rápidas, tiras...
- Material de vidrio — portas, cubreobjetos, matraces, pipetas...
- Material fungible — puntas, tubos, placas, Eppendorf...
- Papel y filtración — papel de filtro, membranas, papel secante...
- EPI y seguridad — guantes, gafas, batas, mascarillas...
- Equipamiento menor — aparatos pequeños no inventariados como activo fijo
- Otro

---

## Pendiente de hacer – CÓDIGO

### Árbol de decisión en Guía de residuos

**Pendiente:** esperando esquema definitivo de Consenur para estructurar el árbol.

Rediseñar `renderResiduosGuia()` para que la página tenga dos modos:

1. **Árbol de decisión** (vista por defecto) — estructura JS estática con nodos de pregunta y nodos hoja. Cada nodo hoja referencia un `Contenedor_Tipo` y opcionalmente IDs de `Tipos_Residuo`. Solo visible con login.
2. **Lista filtrada** (activada al escribir en el buscador) — el comportamiento actual de `_renderGuia()` agrupado por contenedor.

**Interactividad del árbol:**
- Clic en un **contenedor** (nodo hoja) → muestra los contenedores activos de ese tipo en `DATA.contenedoresResiduo` + botón "Añadir residuo aquí" que pre-selecciona el contenedor en el modal de adición (`openModalAdicion`).
- Clic en una **categoría de residuo** en el árbol → despliega inline los `tiposResiduo` de `DATA.tiposResiduo` que corresponden a esa rama.

**Archivos a modificar:** `js/residuos.js` (funciones `renderResiduosGuia`, `_renderGuia`, `filtrarGuia`). El árbol se define como objeto JS estático en el mismo archivo o en un bloque separado al inicio.

---

### Asistente de IA guiado (Gemini Flash)

Añadir un asistente de IA contextual accesible desde cualquier página de la app.

#### Requisito previo (usuario)
1. Ir a [Google AI Studio](https://aistudio.google.com/) → "Get API key" → copiar la clave (formato `AIza…`).
2. En Google Cloud Console → "Credenciales" → hacer clic en la clave → "Restricciones de aplicación" → "Referentes HTTP" → añadir `https://palomafedez.github.io/*`.
3. En "Cuotas" del servicio "Generative Language API", poner un límite diario razonable (p.ej. 500 peticiones/día).
4. Proporcionar la clave a Claude para incluirla en `js/config.js` como `GEMINI_API_KEY`.

#### Archivos a crear/modificar
- **`js/asistente.js`** — lógica completa (nuevo archivo)
- **`html/modal-asistente.html`** — HTML del modal (nuevo archivo)
- **`css/styles.css`** — estilos del botón flotante y el modal
- **`index.html`** — cargar `asistente.js` al final; cargar `modal-asistente.html`; añadir `<button id="btn-asistente">` antes de `</body>`
- **`js/config.js`** — añadir constante `GEMINI_API_KEY`

#### Interfaz de usuario
- **Botón flotante** en esquina inferior derecha, solo tras login: icono 🤖, circular, color `var(--primary)`.
- Al hacer clic: modal centrado (~560px). Dos pantallas:
  1. **Selección de tema** — grid de 6 tarjetas.
  2. **Chat** — área de mensajes + campo de texto + botón Enviar + botón "← Volver".
- El historial se borra al cambiar de tema o al cerrar el modal.

#### Temas y contexto inyectado
| Tema | Icono | Contexto inyectado |
|---|---|---|
| Residuos | 🧪 | `DATA.tiposResiduo` (ID, nombre, Riesgo GHS, contenedor_tipo) + contenedores activos |
| Uso de equipos | ⚙️ | Ficha del equipo seleccionado (tipo, marca, modelo, ubicación, Protocolo_Uso, estado) |
| Mantenimiento | 🔧 | Planes del equipo + tipos de intervención canónicos + últimos 10 registros |
| Resultados analíticos | 📊 | Solo prompt genérico sobre técnicas de laboratorio clínico y anatomía patológica |
| Gestión de incidencias | 🚨 | Tipos de intervención canónicos + estados de equipos (ID, tipo, estado, ubicación) |
| Búsqueda de SAT | 📋 | Marca y modelo del equipo; Gemini sugiere cómo localizar el SAT oficial en España |

Para "Uso de equipos", "Mantenimiento" y "Búsqueda de SAT": mostrar `<select>` con equipos antes de activar el chat.

#### Llamada a la API de Gemini
```js
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;
const body = {
  contents: _chatHistory, // [{role:'user'|'model', parts:[{text:'...'}]}]
  generationConfig: { maxOutputTokens: 1024, temperature: 0.3 }
};
// _chatHistory[0]: mensaje de sistema como role:'user' + respuesta ficticia role:'model' "Entendido."
```
Respuesta en `response.candidates[0].content.parts[0].text`. Mostrar spinner mientras espera.

#### Lo que NO hacer
- No historial persistente (sin localStorage, sin Sheets).
- No enviar el contenido completo de todas las hojas — solo los campos relevantes.
- No usar `gemini-1.5-pro` ni `gemini-2.0` en el tier gratuito — solo `gemini-1.5-flash`.
- No enviar datos personales de usuarios a Gemini.

`asistente.js` se carga después de `reservas.js` (al final de todo).

---

## Pendiente de hacer – DATOS

*(Pendientes que requieren acceso físico al instituto)*

### Campos en equipos – pendiente
- `Mes_Inicio_Temporada` / `Mes_Fin_Temporada` — **PENDIENTE (instituto)** para los 15 equipos estacionales (criostatos, microtomos, procesadores, estaciones de parafina, coagulómetros, citómetro, densitómetro, lámpara hemaglutinación)
- `Ubicacion` — **PENDIENTE (instituto)**: actualizar al ID correcto de la tabla Ubicaciones para coherencia interna. Los exports de calidad ya extraen el nº de lab por regex y funcionan con ambos formatos (`Lab 205` y `205-ZC-2.1`).

### Residuos
- Revisar que todos los tipos tengan `Contenedor_Tipo` relleno.
- Contenedores físicos: **PENDIENTE (instituto)** introducir en Contenedores_Residuo con nivel inicial.

### Reservas
- Revisar tolerancias de incubadoras (CO2 ±0.5%, temperatura ±0.5°C) y estufas/baños (temperatura ±1°C) con la gestora.
- Añadir más equipos reservables si procede.

---

## Notas de diseño importantes

- Los **protocolos de uso** NO generan alertas; se muestran solo al expandir la card del equipo.
- Las **temporadas** (mes inicio/fin) son ajustables por Administrador y Gestor desde la app.
- El **lavador de microplacas** tiene operación específica: limpieza periódica con disolución agua+lejía.
- Equipos muy específicos de una especialidad → estacionales. Equipos de uso general → periódicos.
- El modelo de calidad se entrega una vez al año; la app debe poder generarlo por curso académico.
- Las **categorías de contenedor de residuos** son dinámicas: emergen de los valores únicos de `Contenedor_Tipo` en Tipos_Residuo.
