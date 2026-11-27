# Línea base de GestionLab (instalación desde cero)

`base_limpia.sql` es la **estructura** de la base de datos de GestionLab, sin un solo dato:
lo que hay que aplicar en un proyecto de Supabase vacío para tener la app funcionando.
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
   un proyecto nuevo; van con `IF NOT EXISTS`).
2. **Esquema `public`**: 47 tablas, el tipo `user_role`, las funciones `rol_sesion()` y
   `rls_auto_enable()`, índices, claves, RLS activado en todas y 40 políticas (todas
   `TO authenticated`: sin sesión no se lee nada).
3. **Permisos.** `pg_dump` solo escribe los `GRANT` y da por hecho que cada objeto nace
   sin permisos. En Supabase no es así: las tablas nuevas nacen con **todos** los permisos
   para `anon`. Por eso, antes de los `GRANT`, la base limpia quita todos los permisos de
   `anon`/`authenticated`/`service_role` (también los permisos por defecto de lo que se
   cree después). Sin ese paso, `anon` volvería a tener lectura en todas las tablas, que es
   lo que se cerró el 2026-11-23 (el RLS seguiría sin dejarle ver filas, pero se perdería
   esa segunda barrera).
4. **Storage**: los buckets `documentos` (10 MB; PDF, imágenes, Word, Excel) y `videos`
   (50 MB; MP4 y subtítulos), los dos privados, con su configuración pero sin archivos, y la
   política `videos_select_authenticated`. `documentos` no tiene política: solo entra
   por las Edge Functions.
5. **Disparador de eventos `ensure_rls`**: toda tabla nueva de `public` nace con RLS activado.
   Es la regla de seguridad de los módulos propios («toda tabla nueva con sus reglas de
   acceso») puesta en la propia base.
6. **Realtime**: ninguna tabla publicada.

**Tareas programadas:** no hay (`pg_cron` no está instalado). Si algún día se añaden, el
script se para para que se revisen a mano, porque la orden de una tarea puede llevar
secretos o direcciones del centro.

Todo va en una sola transacción: o entra entero o no entra nada.

## Cómo se aplica

En el proyecto **vacío**: Supabase → SQL Editor → pegar `base_limpia.sql` entero → Run.
(O `psql -f base_limpia.sql` con la cadena de conexión del proyecto.)

Para comprobar que reproduce la estructura real:

```
python tools/base-limpia/sacar_base_limpia.py --comparar <credenciales_del_proyecto_nuevo.json>
```

(mismo formato que `scripts/supabase_credentials.json`: `pooler_host`, `pooler_port`,
`pooler_user`, `db_password`). Sin diferencias = la base limpia está bien.

## Lo que no va en la base: secretos de las Edge Functions

Para el guion de instalación. Supabase → Edge Functions → Secrets.

| Secreto | Capa | De dónde sale | Si falta |
|---|:-:|---|---|
| `GRUPO_PASSWORD_KEY` | 1 | **Se genera** (cualquier frase de 16 caracteres o más; se pasa por SHA-256). ⚠ Si se cambia, las contraseñas de grupo guardadas ya no se pueden leer: hay que volver a ponerlas | No se pueden consultar ni cambiar las contraseñas de los grupos |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`, `SUPABASE_DB_URL`, `SUPABASE_JWKS`, `SUPABASE_PUBLISHABLE_KEYS`, `SUPABASE_SECRET_KEYS` | 1 | Los pone Supabase sola | — |
| `GEMINI_API_KEY` | 2 | Cuenta de Google AI Studio | Sin consultorio de residuos, sin comprobación IA al añadir a un contenedor ni lectura de facturas |
| `TREBELLO_INGEST_URL`, `TREBELLO_INGEST_SECRET` | 4 | Su Trebello / se genera (el mismo valor va en `GESTIONLAB_INGEST_SECRET` de Trebello) | `enviar-a-trebello` responde 503 «no está configurada» |
| `SANIDAD_CMA_API_URL`, `SANIDAD_CMA_API_KEY` | 4 | Su Trebello (importar profesorado) | `importar-profesores` falla; hoy no se apaga sola |

## Datos de referencia: pendiente de decidir

La base limpia no lleva **ningún** dato. Estas tablas tienen filas que quizá hagan falta
en una instalación nueva. **Falta decidir** cuáles se ofrecen como datos de partida y
cuáles son solo del centro:

| Tabla | Filas hoy | Qué es |
|---|--:|---|
| `atributos_material` | 18 | Fichas de atributos por tipo de material (fórmula, concentración, volumen…) para nombrar el material al inventariar |
| `tipos_residuo` | 113 | Catálogo de residuos y a qué contenedor va cada uno; de aquí salen las categorías de contenedor |
| `contenedores_residuo` | 21 | Contenedores físicos de cada laboratorio |
| `config_reservas` | 23 | Qué equipos se reservan y con qué política (va por ID de equipo) |
| `evaluaciones_curso` | 3 | Fechas de las tres evaluaciones del curso (temporada de los equipos) |
| `ciclos`, `modulos`, `modulo_ciclo` | 5 / 0 / 0 | Ciclos y módulos del departamento |
| `verif_pipetas_parametros` | 106 | Volúmenes y límites de verificación de cada micropipeta (va por ID de equipo) |
| `users` / `usuarios` | — | Una instalación nueva necesita **al menos una cuenta de Administración**: es un paso del guion, no un dato de la base |

Lo demás (equipos, material, ubicaciones, proveedores, planes y registros de
mantenimiento, incidencias, pedidos…) son datos del centro y los carga cada instalación.

## Notas para el despliegue de las funciones

- Hay **27** Edge Functions (las 27 de `supabase/functions/`, más `_shared/`), las mismas que
  están desplegadas.
- Tres están desplegadas **sin** verificación de JWT en la pasarela (`--no-verify-jwt`):
  `gestionar-equipo`, `gestionar-mantenimiento` y `gestionar-propuesta-ubicacion`. El
  repositorio no tiene `supabase/config.toml` que lo diga, así que el guion tiene que
  saberlo.
