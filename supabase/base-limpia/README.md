# Línea base de GestionLab (instalación desde cero)

La **primera migración**, `supabase/migrations/20261127000000_base_limpia.sql`, es la
estructura de la base de datos de GestionLab, más unos pocos **datos de partida** (las
fichas de atributos de material): lo que hay que aplicar en un proyecto de Supabase vacío
para tener la app funcionando. Sale de la base de datos real, no del historial
(`supabase/schema.sql` y los scripts `migrar_*.py` se quedan como registro, pero no se
usan para instalar).

⚠ **No se edita a mano**, y una vez aplicada en una instalación de verdad **queda
congelada**: los cambios de esquema van en migraciones nuevas (ver «Cambios de esquema» en
`CLAUDE.md`). Mientras ninguna instalación de verdad la haya aplicado, se puede volver a
sacar con:

```
python tools/base-limpia/sacar_base_limpia.py --rehacer-migracion-base
```

El script solo **lee** la base real (sesión de solo lectura + `pg_dump --schema-only`).
Necesita las herramientas de línea de órdenes de PostgreSQL 17 o posterior y
`scripts/supabase_credentials.json`. Antes de escribir el archivo comprueba que no trae
datos (`COPY`/`INSERT` del volcado) ni nada que parezca del centro (nombre, ciudad,
correos, direcciones, referencias de proyecto); si lo encuentra, se para.

## Qué lleva

1. **Extensiones**: `pgcrypto`, `uuid-ossp`, `pg_stat_statements` (las tres vienen ya en
   un proyecto nuevo; van con `IF NOT EXISTS`). Y **quita `pg_graphql`** si el proyecto la
   trae: GestionLab no usa GraphQL y es una puerta más a la base (la base real tampoco la
   tiene).
2. **Esquema `public`**: 47 tablas, el tipo `user_role`, las funciones `rol_sesion()` y
   `rls_auto_enable()`, índices, claves, RLS activado en todas y 40 políticas (todas
   `TO authenticated`: sin sesión no se lee nada).
3. **Permisos.** `pg_dump` solo escribe los `GRANT` y da por hecho que cada objeto nace
   sin permisos. En Supabase no es así: las tablas nuevas pueden nacer con permisos para
   `anon`. Por eso, antes de los `GRANT`, la migración quita todos los permisos de
   `anon`/`authenticated`/`service_role` (también los permisos por defecto de lo que se
   cree después). Después, los permisos quedan como en la base real, con una diferencia:
   **`anon` no tiene ningún permiso** sobre tablas, secuencias ni funciones (solo el
   `USAGE` del esquema, que es de Supabase). La base real todavía le deja `REFERENCES`,
   `TRIGGER`, `TRUNCATE` y `MAINTAIN` en las tablas; quitárselos allí está pendiente.
4. **Storage**: los buckets `documentos` (10 MB; PDF, imágenes, Word, Excel) y `videos`
   (50 MB; MP4 y subtítulos), los dos privados, sin archivos, y la política
   `videos_select_authenticated`. `documentos` no tiene política: solo entra por las Edge
   Functions. Los buckets están también en `supabase/config.toml`, para la integración; la
   migración los crea igual, para que la instalación funcione también sin ella.
5. **Disparador de eventos `ensure_rls`**: toda tabla nueva de `public` nace con RLS activado.
   Es la regla de seguridad de los módulos propios («toda tabla nueva con sus reglas de
   acceso») puesta en la propia base.
6. **Realtime**: ninguna tabla publicada.
7. **Datos de partida**: las 18 fichas de `atributos_material` (qué atributos se piden al
   inventariar cada tipo de material: fórmula, concentración, volumen…). Son genéricas de
   laboratorio. Van con `ON CONFLICT DO NOTHING`.

**Tareas programadas:** no hay (`pg_cron` no está instalado). Si algún día se añaden, el
script se para para que se revisen a mano, porque la orden de una tarea puede llevar
secretos o direcciones del centro.

La migración se aplica entera o no se aplica: la integración mete cada migración en una
transacción, y el editor SQL ejecuta todo el texto pegado como una sola.

## ⚠ Tablas y funciones nuevas (módulos propios): los permisos se dan a mano

Como la migración base rehace los permisos por defecto, lo que se cree después (con el
editor SQL o una migración, es decir, como `postgres`) nace así:

| Objeto nuevo | `anon` | `authenticated` | `service_role` |
|---|---|---|---|
| Tabla | nada | todos los permisos, **pero** RLS activado y sin reglas (`ensure_rls`): no ve ni toca ninguna fila | todos (salta el RLS) |
| Función | nada | nada | nada |
| Secuencia | nada | nada | todos |

Así que quien añada un módulo propio tiene que escribir, para cada tabla nueva, **sus
reglas de acceso (políticas RLS)** —sin ellas la app no ve la tabla—, y para cada función
que use la app o una regla de acceso, **su `GRANT EXECUTE ... TO authenticated`**. A
`anon` no se le da nada, nunca. Las escrituras de la app van por Edge Functions, con
`service_role`. Ejemplo:

```sql
create table public.local_muestras (id text primary key, nombre text not null);
-- RLS ya viene activado (ensure_rls); falta decir quién lee:
create policy local_muestras_select on public.local_muestras
  for select to authenticated using (true);
```

## Instalar desde el navegador (integración de Supabase con GitHub)

*En prueba en `gestionlab-prueba` (2026-11-27). Sin Node, sin la herramienta de Supabase
y sin instalar nada en el ordenador.*

La integración de Supabase con GitHub funciona en el plan gratuito. Al subir a la **rama
de producción** del proyecto conectado, aplica las migraciones nuevas de
`supabase/migrations/` y despliega las funciones y los buckets declarados en
`supabase/config.toml`. Lo demás (Auth, API, secretos) no lo toca.

1. **Crear el proyecto.** En *Data access*, dejar marcada **solo «Enable Data API»** y las
   otras dos casillas **sin marcar** (así se creó el proyecto de prueba; en la guía,
   copiar los nombres exactos de las casillas). La app necesita la Data API para leer. El
   RLS automático y los permisos los pone la propia migración, así que no dependen de
   esas casillas.
2. **Conectar GitHub**: Project Settings → Integrations → GitHub → Authorize GitHub; en
   GitHub, dar acceso **solo** al repositorio de la app; de vuelta en Supabase, elegir el
   repositorio, *Working directory* `.`, la rama de producción y activar **Deploy to
   production**.
3. **Desplegar**: la siguiente subida a esa rama aplica la migración base y despliega las
   27 funciones y los 2 buckets.
4. **Secretos** (Edge Functions → Secrets), ver la tabla de abajo. Para generar
   `GRUPO_PASSWORD_KEY` sin herramientas, en el SQL Editor:
   `select encode(extensions.gen_random_bytes(32), 'base64');` y copiar el resultado.
5. **Primera cuenta de Administración**: Authentication → Users → Add user, y después
   `supabase/base-limpia/primer_administrador.sql` en el SQL Editor (instrucciones
   dentro). Sin ella no se puede entrar.
6. *(Opcional)* catálogo de ejemplo de residuos: `ejemplo_tipos_residuo.sql` en el SQL
   Editor.
7. **Archivo de configuración del centro**, en su *fork*, desde la web de GitHub (*Add file →
   Create new file*): `config/<dominio>_<ruta>.js`, copiando el del CMA y cambiando la
   dirección de Supabase, la clave **publishable** (Project Settings → API Keys) y la dirección
   de su app. Por ejemplo, `config/iesejemplo.github.io_gestionlab-sanidad.js` para
   `https://iesejemplo.github.io/gestionlab-sanidad/`. Si falta, la app avisa de cuál es el
   nombre que espera. Ver «Configuración del centro» en `CLAUDE.md`.

**Sin la integración** (si un centro no la quiere): pegar la migración base entera en el
SQL Editor, y desplegar las funciones a mano. Lo primero se puede hacer desde el navegador;
lo segundo, no.

Para comprobar una instalación contra la base real:

```
python tools/base-limpia/sacar_base_limpia.py --comparar scripts/supabase_credentials_prueba.json
```

(`scripts/supabase_credentials_prueba.json`, fuera de git: `pooler_host`, `pooler_port`,
`pooler_user`, `db_password` del proyecto nuevo, sacados de Connect → Session pooler).
Sin diferencias = la base limpia está bien. Además avisa si `anon` tiene algún permiso
en el proyecto nuevo. Enseña aparte las **diferencias esperadas**, en las que la
instalación nueva es más estricta que la real (hoy, una: `PUBLIC` no puede ejecutar
`rls_auto_enable()`, que en todo caso solo la dispara `ensure_rls`).

**Probada el 2026-11-27** en un proyecto vacío (PostgreSQL 17.12), aplicada con `psql`:
entra entera, «Sin diferencias de estructura», 47 tablas todas con RLS, `anon` sin ningún
permiso, y una tabla creada después nace con RLS.

## Catálogo de ejemplo de residuos (opcional)

`ejemplo_tipos_residuo.sql`: 113 tipos de residuo de laboratorio con su nombre y su
riesgo (pictogramas GHS), para quien quiera partir de algo. Se aplica **después** de la
migración base y se puede repetir, porque no pisa lo que ya exista.

**No lleva a qué contenedor va cada residuo**, ni laboratorio ni zona: eso depende de las
normas del gestor de residuos de cada centro, y se asigna después en la app. Hasta
entonces, la guía los agrupa en «Sin contenedor asignado». Las descripciones que hablan
de contenedores, laboratorios o normas del gestor (`DESCRIPCION_DEL_CENTRO` en el script:
hoy son 30) **van vacías**, enteras. Se saca con:

```
python tools/base-limpia/sacar_base_limpia.py --ejemplo-residuos
```

## Primera cuenta de Administración

La migración no crea usuarios. **Sin una primera cuenta de Administración no se puede
entrar en la app.** Son tres piezas, las mismas que hace `crear-usuario`:

1. el login en Supabase Auth (email y contraseña): Authentication → Users → Add user;
2. la fila en `public.users` con el `id` de ese login, `rol = 'Administrador'` y
   `activo = true` (es lo que lee `rol_sesion()` en las reglas de acceso);
3. la fila en `public.usuarios` (catálogo de la app), con el mismo email y rol.

Las dos últimas las hace `primer_administrador.sql`, que se puede repetir sin duplicar.

## Lo que no va en la base: secretos de las Edge Functions

Supabase → Edge Functions → Secrets (desde el navegador).

| Secreto | Capa | De dónde sale | Si falta |
|---|:-:|---|---|
| `GRUPO_PASSWORD_KEY` | 1 | **Se genera** (cualquier frase de 16 caracteres o más; se pasa por SHA-256; ver arriba cómo generarla en el SQL Editor). ⚠ Si se cambia, las contraseñas de grupo guardadas ya no se pueden leer: hay que volver a ponerlas | No se pueden consultar ni cambiar las contraseñas de los grupos |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`, `SUPABASE_DB_URL`, `SUPABASE_JWKS`, `SUPABASE_PUBLISHABLE_KEYS`, `SUPABASE_SECRET_KEYS` | 1 | Los pone Supabase sola | — |
| `GEMINI_API_KEY` | 2 | Cuenta de Google AI Studio | Sin consultorio de residuos, sin comprobación IA al añadir a un contenedor ni lectura de facturas |
| `TREBELLO_INGEST_URL`, `TREBELLO_INGEST_SECRET` | 4 | Su Trebello / se genera (el mismo valor va en `GESTIONLAB_INGEST_SECRET` de Trebello) | `enviar-a-trebello` responde 503 «no está configurada» |
| `SANIDAD_CMA_API_URL`, `SANIDAD_CMA_API_KEY` | 4 | Su Trebello (importar profesorado) | `importar-profesores` falla; hoy no se apaga sola |

## Datos de referencia (decidido el 2026-11-27)

| Tabla | Filas hoy | Qué se hace |
|---|--:|---|
| `atributos_material` | 18 | **En la migración base** (datos de partida) |
| `tipos_residuo` | 113 | **Aparte**, como catálogo de ejemplo opcional (`ejemplo_tipos_residuo.sql`), sin las asignaciones a los contenedores del centro |
| `contenedores_residuo`, `config_reservas`, `evaluaciones_curso`, `ciclos`/`modulos`/`modulo_ciclo`, `verif_pipetas_parametros` | 21 / 23 / 3 / 5 / 106 | No: son del centro (sus laboratorios, sus equipos, sus fechas) |

Lo demás (equipos, material, ubicaciones, proveedores, planes y registros de
mantenimiento, incidencias, pedidos…) son datos del centro y los carga cada instalación.

## Las funciones y la comprobación en la entrada (`verify_jwt`)

- Hay **27** Edge Functions (las de `supabase/functions/`, más `_shared/`), las mismas que
  están desplegadas en la base real. Todas van declaradas en `supabase/config.toml`: una
  que no esté ahí no se despliega.
- En la base real, tres están desplegadas **sin** la comprobación en la entrada:
  `gestionar-equipo`, `gestionar-mantenimiento` y `gestionar-propuesta-ubicacion`. Las tres
  comprueban la sesión dentro, en todas sus acciones, y no consta ningún motivo. En
  `config.toml` van **con** la comprobación (`verify_jwt = true`), *pendiente de
  comprobar en `gestionlab-prueba`* (ver la nota siguiente).
- ⚠ Según la documentación de Supabase, la comprobación de la pasarela **solo entiende las
  claves antiguas** (JWT) y, con las claves de firma nuevas, puede romperse: Supabase
  recomienda `verify_jwt = false` y comprobar dentro de cada función. Las dos bases
  (real y prueba) firman ya las sesiones con ES256. Se comprueba en la prueba de la app.
