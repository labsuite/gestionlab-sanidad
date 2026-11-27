# Línea base de GestionLab (instalación desde cero)

`base_limpia.sql` es la **estructura** de la base de datos de GestionLab, más unos pocos
**datos de partida** (las fichas de atributos de material): lo que hay que aplicar en un
proyecto de Supabase vacío para tener la app funcionando.
Sale de la base de datos real, no del historial (`supabase/schema.sql` y los scripts
`migrar_*.py` se quedan como registro, pero no se usan para instalar).

⚠ **No se edita a mano.** Se vuelve a sacar con:

```
python tools/base-limpia/sacar_base_limpia.py
```

El script solo **lee** la base real (sesión de solo lectura + `pg_dump --schema-only`).
Necesita las herramientas de línea de órdenes de PostgreSQL 17 o posterior y
`scripts/supabase_credentials.json`. Antes de escribir el archivo comprueba que no trae
datos (`COPY`/`INSERT` del volcado) ni nada que parezca del centro (nombre, ciudad,
correos, direcciones, referencias de proyecto); si lo encuentra, se para.

## Qué lleva

1. **Extensiones**: `pgcrypto`, `uuid-ossp`, `pg_stat_statements` (las tres vienen ya en
   un proyecto nuevo; van con `IF NOT EXISTS`). Y **quita `pg_graphql`**, que un proyecto
   nuevo trae activada: GestionLab no usa GraphQL y es una puerta más a la base (la base
   real tampoco la tiene).
2. **Esquema `public`**: 47 tablas, el tipo `user_role`, las funciones `rol_sesion()` y
   `rls_auto_enable()`, índices, claves, RLS activado en todas y 40 políticas (todas
   `TO authenticated`: sin sesión no se lee nada).
3. **Permisos.** `pg_dump` solo escribe los `GRANT` y da por hecho que cada objeto nace
   sin permisos. En Supabase no es así: las tablas nuevas nacen con **todos** los permisos
   para `anon`. Por eso, antes de los `GRANT`, la base limpia quita todos los permisos de
   `anon`/`authenticated`/`service_role` (también los permisos por defecto de lo que se
   cree después). Sin ese paso, `anon` volvería a tener lectura en todas las tablas, que es
   lo que se cerró el 2026-11-23 (el RLS seguiría sin dejarle ver filas, pero se perdería
   esa segunda barrera). Después, los permisos quedan como en la base real, con una
   diferencia: **`anon` no tiene ningún permiso** sobre tablas, secuencias ni funciones
   (solo el `USAGE` del esquema, que es de Supabase). La base real todavía le deja
   `REFERENCES`, `TRIGGER`, `TRUNCATE` y `MAINTAIN` en las tablas; quitárselos allí está
   pendiente.
4. **Storage**: los buckets `documentos` (10 MB; PDF, imágenes, Word, Excel) y `videos`
   (50 MB; MP4 y subtítulos), los dos privados, con su configuración pero sin archivos, y la
   política `videos_select_authenticated`. `documentos` no tiene política: solo entra
   por las Edge Functions.
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

Todo va en una sola transacción: o entra entero o no entra nada.

## ⚠ Tablas y funciones nuevas (módulos propios): los permisos se dan a mano

Como la base limpia rehace los permisos por defecto, lo que se cree después (con el
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

## Cómo se aplica

**Al crear el proyecto** (para la guía de instalación): en *Data access*, dejar marcada
**solo «Enable Data API»** y las otras dos casillas **sin marcar** (así se creó el
proyecto de prueba del 2026-11-27; en la guía, copiar los nombres exactos de las casillas
de la pantalla). La app necesita la Data API para leer. El RLS automático y los permisos
los pone la propia base limpia, así que no dependen de esas casillas.

En el proyecto **vacío**: Supabase → SQL Editor → pegar `base_limpia.sql` entero → Run.
(O `psql -f base_limpia.sql` con la cadena de conexión del proyecto.)

Para comprobar que reproduce la estructura real:

```
python tools/base-limpia/sacar_base_limpia.py --comparar scripts/supabase_credentials_prueba.json
```

(`scripts/supabase_credentials_prueba.json`, fuera de git: `pooler_host`, `pooler_port`,
`pooler_user`, `db_password` del proyecto nuevo, sacados de Connect → Session pooler).
Sin diferencias = la base limpia está bien. Además avisa si `anon` tiene algún permiso
en el proyecto nuevo.

## Lo que hace el guion de instalación después

La base limpia no crea usuarios. **Sin una primera cuenta de Administración no se puede
entrar en la app**, y la crea el guion de instalación. Son tres piezas, las mismas que
hace `crear-usuario`:

1. el login en Supabase Auth (email y contraseña);
2. la fila en `public.users` con el `id` de ese login, `rol = 'Administrador'` y
   `activo = true` (es lo que lee `rol_sesion()` en las reglas de acceso);
3. la fila en `public.usuarios` (catálogo de la app), con el mismo email y rol.

## Lo que no va en la base: secretos de las Edge Functions

Para el guion de instalación. Supabase → Edge Functions → Secrets.

| Secreto | Capa | De dónde sale | Si falta |
|---|:-:|---|---|
| `GRUPO_PASSWORD_KEY` | 1 | **Se genera** (cualquier frase de 16 caracteres o más; se pasa por SHA-256). ⚠ Si se cambia, las contraseñas de grupo guardadas ya no se pueden leer: hay que volver a ponerlas | No se pueden consultar ni cambiar las contraseñas de los grupos |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`, `SUPABASE_DB_URL`, `SUPABASE_JWKS`, `SUPABASE_PUBLISHABLE_KEYS`, `SUPABASE_SECRET_KEYS` | 1 | Los pone Supabase sola | — |
| `GEMINI_API_KEY` | 2 | Cuenta de Google AI Studio | Sin consultorio de residuos, sin comprobación IA al añadir a un contenedor ni lectura de facturas |
| `TREBELLO_INGEST_URL`, `TREBELLO_INGEST_SECRET` | 4 | Su Trebello / se genera (el mismo valor va en `GESTIONLAB_INGEST_SECRET` de Trebello) | `enviar-a-trebello` responde 503 «no está configurada» |
| `SANIDAD_CMA_API_URL`, `SANIDAD_CMA_API_KEY` | 4 | Su Trebello (importar profesorado) | `importar-profesores` falla; hoy no se apaga sola |

## Datos de referencia (decidido el 2026-11-27)

| Tabla | Filas hoy | Qué se hace |
|---|--:|---|
| `atributos_material` | 18 | **En la base limpia** (datos de partida) |
| `tipos_residuo` | 113 | **Aparte**, como catálogo de ejemplo opcional, sin las asignaciones a los contenedores del centro |
| `contenedores_residuo`, `config_reservas`, `evaluaciones_curso`, `ciclos`/`modulos`/`modulo_ciclo`, `verif_pipetas_parametros` | 21 / 23 / 3 / 5 / 106 | No: son del centro (sus laboratorios, sus equipos, sus fechas) |

Lo demás (equipos, material, ubicaciones, proveedores, planes y registros de
mantenimiento, incidencias, pedidos…) son datos del centro y los carga cada instalación.

## Notas para el despliegue de las funciones

- Hay **27** Edge Functions (las 27 de `supabase/functions/`, más `_shared/`), las mismas que
  están desplegadas.
- Tres están desplegadas **sin** verificación de JWT en la pasarela (`--no-verify-jwt`):
  `gestionar-equipo`, `gestionar-mantenimiento` y `gestionar-propuesta-ubicacion`. El
  repositorio no tiene `supabase/config.toml` que lo diga, así que el guion tiene que
  saberlo.
