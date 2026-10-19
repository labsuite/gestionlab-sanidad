# Pendientes del laboratorio (página pública sin login)

`pendientes.html` es una página suelta de GestionLab —como `subir-factura.html`— para la
lista de **pendientes de los protocolos de equipos**: lo que hay que mirar en la etiqueta de
un equipo, decidir, documentar o comprar para cerrar los protocolos de uso y mantenimiento.
El profesorado la abre **sin iniciar sesión**, con un enlace secreto, deja notas con fotos o
documentos en cada tarea y cambia su estado. Claude lee esas notas, actualiza protocolos e
inventario y deja su respuesta en el hilo de cada tarea.

URL: `https://labsuite.github.io/gestionlab-sanidad/pendientes.html?t=<token>`
(el token no está en el repo; lo tiene Paloma). Al abrirla, la página guarda el token en el
`localStorage` del dispositivo y lo quita de la barra de direcciones.

## Dónde viven los datos

⚠ **No** en el proyecto propio de GestionLab (`vnoecaqldymonkgrmvlj`), sino en el proyecto
compartido **`sanidade-cma`** (`clxcjsvkmaydpxvtqesv`), el mismo que GestionLab ya usa para
ciclos y módulos (`_sb` en `js/config.js`). Se hizo así porque ese proyecto es el que Claude
(chat) tiene conectado, y la gracia del módulo es que Claude lea y responda las notas
directamente.

| Objeto | Qué es |
|---|---|
| `lab_pendientes` | Una fila por tarea: `seccion`, `orden`, `tipo` (etiqueta / decision / documento / compra / gestion), `titulo`, `detalle`, `equipos[]` (id_activo), `labs[]`, `importante`, `estado` (pendiente / en_curso / hecho / descartado), `origen` (claude / enlace), `creado_por`, `archivada` |
| `lab_pendientes_notas` | Hilo de cada tarea: `tipo` = `nota` (escrita desde la página), `respuesta` (de Claude) o `estado` (cambio de estado, `texto` = `antes>después`); `autor`, `texto`, `adjuntos` (jsonb: `path`, `nombre`, `tipo`, `bytes`), `borrada` |
| `lab_pendientes_config` | `secciones` (key, titulo, orden) y `decisiones` (decisiones ya tomadas, se muestran al pie) |
| `lab_pendientes_enlaces` | Enlaces de acceso: solo el **SHA-256** del token, `etiqueta`, `activo` |
| bucket `lab-pendientes` | Privado, 20 MB por archivo: imágenes (también HEIC), PDF, vídeo (mp4/mov/webm), texto/CSV, Word, Excel, ODT/ODS. Ruta `<id_tarea>/<marca>-<aleatorio>-<nombre>` |

Las cuatro tablas tienen RLS activado **sin ninguna política**: la clave anónima no ve nada.
Todo pasa por la Edge Function **`lab-pendientes`** (desplegada en `sanidade-cma`,
`verify_jwt` activado: el navegador manda la anon key, como `pedido-publico`), que comprueba
el token en cada llamada y usa la service_role key.

Fuentes en el repo (no están en `supabase/functions/` para que nadie las despliegue por
error en el proyecto de GestionLab):

- `supabase/sanidade-cma/lab-pendientes/index.ts` — la Edge Function
- `supabase/sanidade-cma/lab-pendientes/schema.sql` — tablas y bucket

## Acciones de la Edge Function

Todas son `POST` con `{t, accion, autor, …}`. Token inválido o revocado → 404 genérico.

| accion | Qué hace |
|---|---|
| `listar` | Config + tareas no archivadas + notas no borradas, con URL firmada (4 h) para cada adjunto |
| `estado` | Cambia el estado y añade una nota `tipo=estado` al hilo |
| `subir` | Valida tipo y tamaño y devuelve una URL firmada de subida (`createSignedUploadUrl`); el navegador hace el `PUT` directamente a Storage |
| `nota` | Guarda la nota; comprueba que cada adjunto está en la carpeta de esa tarea y que existe de verdad en el bucket |
| `borrar_nota` | Borrado lógico (`borrada = true`), solo de notas `tipo=nota` |
| `crear` | Tarea nueva con `origen = 'enlace'`; `labs` se calcula en el navegador a partir del inventario embebido |

Las tareas **no se borran** desde la página: se marcan como Hecho o Descartado y quedan en
«Resueltas» con su hilo. Para quitar una del todo, `archivada = true`.

## La página

- Mismo aspecto que GestionLab (DM Sans / DM Serif Display, paleta de `css/styles.css`) y
  modo oscuro.
- Filtros por estado, laboratorio, tipo, prioritarias y búsqueda (también dentro de las
  notas). Se guardan en `localStorage`, igual que las tareas desplegadas y el borrador de
  cada nota.
- La lista se refresca sola cada minuto y al volver a la pestaña. Con la etiqueta
  «Novedades» se marcan las tareas cerradas que tienen notas o respuestas nuevas desde la
  última vez que se abrieron **en ese dispositivo**.
- Fotos de más de 1,5 MB y HEIC se convierten a JPEG de 2000 px en el navegador cuando el
  navegador sabe decodificarlas (Chrome en Windows no decodifica HEIC: se sube el HEIC tal
  cual).
- El inventario (id_activo → laboratorio y nombre) va embebido en el HTML para la ayuda al
  escribir códigos de equipo en «Añadir una tarea». Si cambia mucho el inventario, regenerar
  esa constante (`INV`).

## Gestión de enlaces

Crear un enlace nuevo (p. ej. uno distinto para otro departamento), desde el SQL de Supabase:

```sql
-- el token lo genera quien crea el enlace (32+ caracteres aleatorios, URL-safe)
insert into lab_pendientes_enlaces (token_hash, etiqueta)
values (encode(extensions.digest('<TOKEN>', 'sha256'), 'hex'), 'Para quién es');
```

Revocar: `update lab_pendientes_enlaces set activo = false, revocado = now() where etiqueta = '…';`

## Protección de datos

`autor` (en notas, cambios de estado y tareas creadas) es **texto libre y opcional**: lo que
escriba quien usa la página en «Firmas como», que se guarda solo en su dispositivo. La
página pide nombre y primer apellido al profesorado y el nombre del grupo al alumnado; no se
puede imponer `nombreCorto()` porque no hay sesión que diga si quien escribe es una persona
o un grupo. Ver `docs/proteccion-datos.md`, punto 2. Al cerrar el curso se puede anonimizar:

```sql
update lab_pendientes_notas set autor = '' where creado < '<fecha de cierre>';
update lab_pendientes set creado_por = '' where creado < '<fecha de cierre>';
```

## Cómo trabaja Claude con la lista

Claude (chat) lee `lab_pendientes_notas` con la conexión de Supabase (por ejemplo, las notas
de `tipo = 'nota'` posteriores a su última respuesta), descarga los adjuntos del bucket,
actualiza protocolos e inventario en la carpeta `Protocolos/GestionLab` y escribe su
respuesta como nota `tipo = 'respuesta'`, `autor = 'Claude'`. También puede cambiar estados
y añadir tareas nuevas con `origen = 'claude'`.
