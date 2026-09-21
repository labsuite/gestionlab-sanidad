# Protección de datos en GestionLab

Registro interno de qué datos personales trata la app, con qué finalidad y durante
cuánto tiempo. No es un dictamen jurídico: es la documentación técnica que respalda
las decisiones tomadas, para poder justificarlas ante quien las pregunte.

**Principio de partida (minimización):** la app solo guarda quién hizo algo cuando
la seguridad del laboratorio lo exige. Y desde el curso 2026-27 el alumnado ni
siquiera tiene cuenta personal, así que en la práctica **no hay ningún dato
personal de alumnado en la base de datos**.

---

## 1. El alumnado entra por cuentas de grupo

Cada grupo comparte una única cuenta, con su propia contraseña:

| Grupo | Cuenta |
|---|---|
| 1º CS LCB | `1cslcb@gestionlab.cma` |
| 2º CS APC | `2csapc@gestionlab.cma` |
| … | `<curso><ciclo><especialidad>@gestionlab.cma` |

Consecuencias, todas buscadas:

- En `usuarios` y en `public.users` la fila de un grupo tiene `nombre = "1º CS LCB"`.
  No hay nombres ni emails de menores en ninguna tabla.
- Todo lo que firma el alumnado queda a nombre del grupo. Eso **no identifica a
  nadie** y además es más útil que un genérico: sabes qué grupo hizo el
  mantenimiento o dejó el residuo.
- El rol `Alumno` y todos los permisos siguen funcionando igual.
- La contraseña **no** puede derivarse del email (la parte local es el propio
  nombre del grupo, `1cslcb`): se genera aleatoria y dictable
  (`passwordDeGrupo()`, tipo `monte-auga-698`).
- De esa contraseña —y **solo** de la de un grupo— se guarda una copia cifrada
  (`credenciales_grupo`, AES-256-GCM con un secreto que vive en las Edge
  Functions, no en Postgres) para que el profesorado pueda consultarla desde la
  app. No es un dato personal: identifica a un grupo, es compartida a propósito
  y se rota desde el mismo sitio. La contraseña de una **persona** no se guarda
  nunca, ni cifrada: si se olvida, se restablece. Ver `docs/modulo-usuarios.md`.

Alta de cuentas: `scripts/crear_grupos_alumnado.py`. Se hace una vez, no cada
curso — los grupos no cambian. El import de alumnado desde Trebello está
retirado (ver punto 6).

---

## 2. Dónde se identifica a una persona concreta

Solo profesorado, gestión y administración, que firman con su nombre en los
registros que gestionan. Es personal del centro actuando en su puesto de trabajo.

| Tabla | Dato | Justificación |
|---|---|---|
| `usuarios` / `public.users` (profesorado) | nombre, email, módulos, labs | Base del servicio: login, permisos, responsabilidad sobre equipos. |
| `registro_mantenimientos.supervisado_por` | nombre y primer apellido del docente | Es la firma que da validez al mantenimiento hecho por alumnado. |
| `intervenciones.realizado_por`, `incidencias.reportado_por` (staff) | nombre y primer apellido | Trazabilidad de la gestión del equipo. |

El profesorado consta como **nombre y primer apellido** ("Paloma Fernández"),
nunca con el nombre completo: lo impone `nombreCorto()` en el servidor. Ver
CLAUDE.md para la regla exacta y sus excepciones.
| Supabase Auth | email, contraseña (hash) | Autenticación. |

---

## 3. Registros de uso y reservas: ahora son del grupo

| Tabla | Dato | Qué significa ahora |
|---|---|---|
| `registros_cabina` / `registros_autoclave` / `registros_vitrina` | `usuario` (email de grupo) | Identifica **al grupo**, no a la persona. |
| `reservas_equipos` | `usuario` (email de grupo) | Igual. |

⚠ **Esto hay que asumirlo conscientemente.** Estos registros se justificaban por
la trazabilidad de bioseguridad: ante una contaminación o un ciclo de
esterilización fallido había que poder reconstruir quién estuvo. Con cuentas de
grupo se reconstruye **el grupo, la fecha, la franja y el docente presente**, no
la persona. Es una decisión tomada a favor de la protección de datos; si el
sistema de calidad del centro exigiese trazabilidad individual en alguno de esos
tres equipos, habría que registrarlo en papel o volver a cuentas personales solo
para ese registro.

El valor lo sigue escribiendo el servidor a partir del email de la sesión
(`requireValidSession`), nunca el navegador.

---

## 4. La firma del alumnado: cómo está garantizada

La decisión se toma en el servidor, en `autorRegistro()` / `firmaAlumnado()`
(`supabase/functions/_shared/auth.ts`): mira el rol del email de la sesión y,
si no es profesorado, firma con el nombre del grupo **ignorando cualquier nombre
que venga en el cuerpo de la petición**. Si apareciese una cuenta de alumnado
fuera del dominio `@gestionlab.cma`, firma `"Alumnado"` a secas: nunca un nombre
propio.

Tablas afectadas: `incidencias.reportado_por`, `adiciones_residuo.usuario`,
`contenedores_residuo.actualizado_por`, `consultas_residuo.usuario`,
`excepciones_residuo_ia.usuario`, `registro_mantenimientos.realizado_por` e
`iniciado_por`, `movimientos.usuario`, `revisiones_inventario.usuario` y
`propuestas_*.propuesto_por`.

Funciones que lo aplican: `gestionar-incidencia`, `gestionar-residuo`,
`gestionar-mantenimiento`, `gestionar-material`, `gestionar-propuesta-ubicacion`,
`gestionar-propuesta-material`.

### Propuestas del inventario colaborativo

`propuestas_*.email_propuesto_por` guarda ahora el email **del grupo**, que ya no
es un dato personal. Sigue siendo funcional (dedupe, doble verificación y "mis
propuestas") y `scripts/anonimizar_propuestas.py` sigue disponible para limpiarlo.

Dos cosas cambiaron al pasar a cuentas compartidas:

- **Dedupe.** Antes se borraba toda propuesta pendiente del mismo email para el
  mismo equipo. Con cuenta compartida eso hacía que la propuesta de un alumno
  borrase la de su compañero, así que ahora solo se sustituye si es **exactamente
  la misma ubicación**. Si dos personas del grupo dicen sitios distintos, se
  guardan las dos y la cola las muestra en conflicto.
- **Doble verificación.** Exige dos cuentas distintas, o sea **dos grupos
  distintos**. Dos alumnos del mismo grupo ya no se validan entre sí, que es lo
  correcto: la confirmación debe ser independiente.

---

## 5. Conservación

| Dato | Plazo |
|---|---|
| Registros de uso (cabina / autoclave / vitrina) | Ya no contienen datos personales (identifican al grupo). Conservar lo que pida el sistema de calidad del centro. |
| Reservas | Sin valor pasada la franja; purgables al cierre de curso. |
| Email de grupo en propuestas resueltas | 60 días (`scripts/anonimizar_propuestas.py`). No es dato personal, pero la limpieza sigue siendo buena higiene. |
| Catálogo `usuarios` y cuentas de Auth del **profesorado** | Mientras la persona esté activa en el centro. Al causar baja, dar de baja también la cuenta. |
| Cuentas de grupo | Permanentes. Cambiar la contraseña al inicio de cada curso con el botón 🔑 (Usuarios → Alumnos). |

---

## 6. Cuentas personales de alumnado: retiradas

Las 36 cuentas personales del curso anterior se eliminan con
`scripts/borrar_alumnado_personal.py` (catálogo + rol + login + recordatorios).

⚠ **La baja del login falla a menudo.** En la ejecución real (2026-09-19) la API
de Auth devolvió 504 en 34 de las 36: el catálogo y el rol quedaron borrados pero
la cuenta de acceso siguió viva, y una cuenta sin fila en el catálogo se trata
como **Alumno** en `getRealUserRole()` — o sea, podían seguir entrando. Rematar
siempre con `scripts/limpiar_logins_huerfanos.py --aplicar`, que borra los logins
sin fila en `usuarios` **ni** en `public.users` (ese doble filtro deja fuera al
profesorado sin catálogo).

Los tres caminos que creaban cuentas personales están cerrados:

| Camino | Estado |
|---|---|
| Botón "📥 Importar alumnado" en la página Usuarios | Eliminado (botón, modal y funciones JS) |
| Edge Function `importar-alumnos` | Responde **410** con el motivo |
| `scripts/importar_alumnos.py` | Aborta al arrancar |

### Barrido de comprobación (2026-09-20)

Borrar las cuentas no basta: un nombre escrito **a mano** en un campo de texto
sobrevive a la baja de la persona. Tras la migración se revisaron todas las
columnas de texto de todas las tablas con tres criterios (email de alumnado,
dos o más partes de un nombre en el mismo valor, y revisión una a una de las
columnas de "quién hizo esto").

Apareció **un** rastro: `movimientos.usuario = "nadia muñiz"`, tres filas del
20/05/2026 anteriores a la firma automática. Cambiado a `Alumnado`, conservando
el histórico de stock.

⚠ Lección para futuras bajas: comparar por **nombre completo no sirve**. Ese
valor estaba en minúsculas y sin el segundo apellido, así que no casaba con el
"Nadia Muñiz González" del catálogo. Hay que buscar por nombres y apellidos
sueltos, descartando después las coincidencias de palabra (saltaron "blanco" por
*blanco de calcoflúor* y "conde" dentro de *condensador*).

Estado tras el barrido: 0 emails de alumnado, 0 nombres de alumnado, 0 logins sin
ficha. En las columnas de firma solo quedan profesorado y `Alumnado`.

El import de **profesorado** sigue activo y no cambia: son adultos, personal del
centro, y su nombre es necesario para la responsabilidad sobre equipos.

---

## 7. Terceros

- **Gemini** (consultorio de residuos y validación de compatibilidad): recibe la
  descripción del residuo, el laboratorio y los contenedores activos. **No recibe
  nombre, email ni ningún identificador de persona.** La llamada la hace la Edge
  Function, nunca el navegador, y la clave vive solo como secreto de servidor.
- **Supabase** (Irlanda, UE): encargado del tratamiento — base de datos, autenticación
  y almacenamiento.
- **GitHub Pages**: sirve el HTML/JS estático. No recibe datos de la aplicación.

---

## 8. Al añadir un campo nuevo

Antes de guardar cualquier "quién hizo esto", responder: **¿la seguridad del
laboratorio exige saber quién fue?**

- **Sí** → escribirlo en el servidor desde el email de la sesión (patrón de
  `gestionar-registro-uso`), añadirlo a la tabla del punto 2 con su justificación,
  y fijarle un plazo de conservación en el punto 5.
- **No** → usar `autorRegistro()` y no tocar nada más.

Ante la duda, la respuesta es **no**: un registro sin nombre sigue sirviendo para
gestionar el laboratorio; uno con nombre hay que justificarlo, protegerlo y borrarlo.
