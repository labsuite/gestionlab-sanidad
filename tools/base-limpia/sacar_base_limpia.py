"""
sacar_base_limpia.py — Saca la LÍNEA BASE de GestionLab (la estructura, más los pocos
datos de partida de DATOS_DE_PARTIDA) a partir de la base de datos real, para instalar
la app desde cero en un proyecto de Supabase vacío.

Uso (desde la raíz del repositorio):

    python tools/base-limpia/sacar_base_limpia.py
        Lee la base real y escribe supabase/base-limpia/base_limpia.sql

    python tools/base-limpia/sacar_base_limpia.py --comparar <credenciales.json>
        Saca la estructura de OTRO proyecto (p. ej. la instalación de prueba) y la
        compara con la de la base real. Sin diferencias = la base limpia reproduce
        la estructura real.

⚠ SOLO LECTURA. La sesión va con default_transaction_read_only=on y pg_dump trabaja
en modo --schema-only: no escribe nada en ninguna base. Nunca añadir aquí nada que
escriba en la base real.

Qué incluye base_limpia.sql (en una sola transacción: o entra entero o no entra nada):
  1. Extensiones que usa el proyecto (CREATE EXTENSION IF NOT EXISTS).
  2. Esquema public completo de pg_dump: tipos, tablas, claves, índices, funciones,
     RLS y políticas, y permisos.
  3. Permisos: pg_dump solo escribe GRANT, suponiendo que cada objeto nace sin
     permisos. En Supabase no es así (las tablas nuevas nacen con TODO para anon), así
     que antes de los GRANT se quitan todos los permisos de anon/authenticated/
     service_role, y los GRANT del volcado los dejan como en la base real. Excepción:
     anon no recibe NINGÚN permiso sobre tablas, secuencias ni funciones (la base real
     aún le deja REFERENCES/TRIGGER/TRUNCATE/MAINTAIN en las tablas).
  Y al final, los datos de partida (DATOS_DE_PARTIDA: las fichas de atributos_material).
  Quita también pg_graphql, que un proyecto nuevo trae activada y GestionLab no usa.
  4. Buckets de Storage (su configuración, no los archivos) y sus políticas.
  5. Disparadores de eventos propios (ensure_rls: toda tabla nueva de public nace con
     RLS activado).
  6. Tablas publicadas en Realtime, si las hay.
Tareas programadas (pg_cron): si algún día existen, el script se para para revisarlas
a mano, porque su orden puede llevar secretos o direcciones del centro.

Lo que NO incluye, a propósito: ningún dato (ni de referencia: ver
supabase/base-limpia/README.md), los secretos de las Edge Functions y los esquemas
que gestiona Supabase (auth, storage, realtime...).

Necesita las herramientas de PostgreSQL 17+ (pg_dump) y scripts/supabase_credentials.json.
"""
import difflib
import json
import os
import re
import subprocess
import sys

import psycopg2

sys.stdout.reconfigure(encoding='utf-8')

RAIZ = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
CREDENCIALES = os.path.join(RAIZ, 'scripts', 'supabase_credentials.json')
SALIDA = os.path.join(RAIZ, 'supabase', 'base-limpia', 'base_limpia.sql')
PG_DUMP_CANDIDATOS = [
    r'C:\Program Files\PostgreSQL\18\bin\pg_dump.exe',
    r'C:\Program Files\PostgreSQL\17\bin\pg_dump.exe',
    'pg_dump',
]
ROLES_API = 'anon, authenticated, service_role'

# Lo que no puede aparecer en la base limpia: si aparece, algo del centro se ha colado
# en la estructura (un valor por defecto, un comentario, una función...).
MARCAS_DEL_CENTRO = re.compile(
    r'cifp|manuel antonio|vigo|sanidad|sanidade|cma\b|@|https?://|vnoecaqldymonkgrmvlj|clxcjsvkmaydpxvtqesv',
    re.I)


def leer_credenciales(ruta):
    with open(ruta, encoding='utf-8') as f:
        return json.load(f)


def conectar(c):
    conn = psycopg2.connect(host=c['pooler_host'], port=c['pooler_port'], user=c['pooler_user'],
                            password=c['db_password'], dbname='postgres', sslmode='require',
                            options='-c default_transaction_read_only=on')
    conn.set_session(readonly=True)
    return conn


def pg_dump_exe():
    for cand in PG_DUMP_CANDIDATOS:
        try:
            out = subprocess.run([cand, '--version'], capture_output=True, text=True)
        except FileNotFoundError:
            continue
        m = re.search(r'(\d+)\.', out.stdout)
        if m and int(m.group(1)) >= 17:
            return cand
    sys.exit('No encuentro pg_dump 17 o posterior (herramientas de línea de órdenes de PostgreSQL).')


def volcar_public(c):
    """pg_dump --schema-only del esquema public, en solo lectura."""
    env = dict(os.environ, PGPASSWORD=c['db_password'], PGSSLMODE='require',
               PGOPTIONS='-c default_transaction_read_only=on')
    r = subprocess.run([pg_dump_exe(), '-h', c['pooler_host'], '-p', str(c['pooler_port']),
                        '-U', c['pooler_user'], '-d', 'postgres',
                        '--schema-only', '--schema=public', '--no-owner'],
                       env=env, capture_output=True, text=True, encoding='utf-8')
    if r.returncode != 0:
        sys.exit('pg_dump ha fallado:\n' + r.stderr)
    return r.stdout


PERMISO_ANON = re.compile(
    r'^(GRANT .* ON (TABLE|SEQUENCE|FUNCTION) public\..* TO anon;'
    r'|ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT .* TO anon;)$')


def limpiar_volcado(sql):
    """Quita del volcado lo que no se puede (o no se debe) ejecutar en un proyecto nuevo.
    Devuelve (sql, nº de permisos de anon quitados)."""
    fuera = []
    lineas = []
    anon = 0
    for l in sql.splitlines():
        if PERMISO_ANON.match(l):
            # anon no necesita ningún permiso sobre tablas, secuencias ni funciones: sin
            # sesión no se lee ni se escribe nada (decisión 2026-11-27). Solo conserva
            # USAGE en el esquema, que es de Supabase.
            anon += 1
            continue
        if l.startswith('\\restrict') or l.startswith('\\unrestrict'):
            continue  # metaórdenes de psql (pg_dump ≥17.6); el editor SQL de Supabase no las entiende
        if l == 'CREATE SCHEMA public;' or l.startswith('COMMENT ON SCHEMA public IS'):
            continue  # public ya existe en todo proyecto
        if l.startswith('ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin'):
            continue  # son de Supabase; desde la cuenta postgres no se pueden cambiar
        if re.match(r'\s*(COPY|INSERT INTO)\b', l):
            fuera.append(l)
        lineas.append(l)
    if fuera:
        sys.exit('El volcado trae datos (COPY/INSERT); no debería pasar con --schema-only:\n' + '\n'.join(fuera[:5]))
    return '\n'.join(lineas) + '\n', anon


MARCA_PERMISOS = '--\n-- Name: SCHEMA public; Type: ACL;'


def con_reinicio_de_permisos(sql):
    """Antes del primer bloque de permisos, dejar todo sin permisos (ver cabecera, punto 3)."""
    if MARCA_PERMISOS not in sql:
        sys.exit('No encuentro el bloque de permisos en el volcado: revisar el formato de pg_dump.')
    reinicio = f"""--
-- Permisos: en Supabase los objetos nuevos nacen con todos los permisos para la API
-- (también anon). Se quitan aquí y los GRANT de abajo dejan los de la base real,
-- salvo los de anon, que no tiene ninguno. Sin esto, anon volvería a poder leer las
-- tablas.
--

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM {ROLES_API};
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM {ROLES_API};
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, {ROLES_API};
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM {ROLES_API};
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON SEQUENCES FROM {ROLES_API};
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM PUBLIC, {ROLES_API};


"""
    return sql.replace(MARCA_PERMISOS, reinicio + MARCA_PERMISOS, 1)


def lit(v):
    """Literal SQL de un valor de Python (texto, número, booleano, null, lista de texto)."""
    if v is None:
        return 'NULL'
    if isinstance(v, bool):
        return 'true' if v else 'false'
    if isinstance(v, (int, float)):
        return str(v)
    if isinstance(v, list):
        return 'ARRAY[' + ', '.join(lit(x) for x in v) + ']::text[]'
    return "'" + str(v).replace("'", "''") + "'"


# Extensiones que un proyecto nuevo de Supabase trae activadas y GestionLab no usa: si
# la base real no las tiene, la base limpia las quita. pg_graphql: la app no usa GraphQL
# y es una puerta más a la base (decisión 2026-11-27).
EXTENSIONES_A_QUITAR = ['pg_graphql']


def extensiones(cur):
    cur.execute("""select e.extname, n.nspname from pg_extension e
                   join pg_namespace n on n.oid = e.extnamespace
                   where e.extname not in ('plpgsql', 'supabase_vault') order by 1""")
    filas = cur.fetchall()
    hay = {n for n, _ in filas}
    out = ''.join(f'CREATE EXTENSION IF NOT EXISTS "{n}" WITH SCHEMA {s};\n' for n, s in filas)
    out += ''.join(f'DROP EXTENSION IF EXISTS "{n}";\n' for n in EXTENSIONES_A_QUITAR if n not in hay)
    return out


# Datos de partida: lo único con datos que lleva la base limpia (decisión 2026-11-27).
# Las demás tablas de referencia son del centro; tipos_residuo va aparte como catálogo
# de ejemplo opcional.
DATOS_DE_PARTIDA = {'atributos_material': 'id_ficha'}


def datos_de_partida(cur):
    out = []
    for tabla, pk in DATOS_DE_PARTIDA.items():
        cur.execute(f'select * from public.{tabla} order by {pk}')
        cols = [d[0] for d in cur.description]
        filas = cur.fetchall()
        out.append(f'-- {tabla}: {len(filas)} filas')
        for f in filas:
            vals = ', '.join(lit_json(v) for v in f)
            out.append(f'INSERT INTO public.{tabla} ({", ".join(cols)}) VALUES ({vals})\n'
                       f'  ON CONFLICT ({pk}) DO NOTHING;')
    return '\n'.join(out) + '\n'


def lit_json(v):
    """Como lit(), pero las listas y diccionarios (jsonb) van como JSON."""
    if isinstance(v, (list, dict)):
        return lit(json.dumps(v, ensure_ascii=False)) + '::jsonb'
    return lit(v)


def storage(cur):
    out = []
    cur.execute("""select id, name, public, file_size_limit, allowed_mime_types
                   from storage.buckets order by id""")
    for id_, name, public, limite, mimes in cur.fetchall():
        out.append(
            'INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)\n'
            f'VALUES ({lit(id_)}, {lit(name)}, {lit(public)}, {lit(limite)}, {lit(mimes)})\n'
            'ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public, file_size_limit = EXCLUDED.file_size_limit,\n'
            '  allowed_mime_types = EXCLUDED.allowed_mime_types;\n')
    cur.execute("""select tablename, policyname, permissive, roles, cmd, qual, with_check
                   from pg_policies where schemaname = 'storage' order by tablename, policyname""")
    for tabla, nombre, permisiva, roles, cmd, qual, check in cur.fetchall():
        roles = roles if isinstance(roles, list) else roles.strip('{}').split(',')
        p = (f'DROP POLICY IF EXISTS "{nombre}" ON storage.{tabla};\n'
             f'CREATE POLICY "{nombre}" ON storage.{tabla} AS {permisiva} FOR {cmd} TO {", ".join(roles)}')
        if qual:
            p += f' USING ({qual})'
        if check:
            p += f' WITH CHECK ({check})'
        out.append(p + ';\n')
    return '\n'.join(out)


def disparadores_de_eventos(cur):
    """Los disparadores de eventos propios (los de Supabase son de supabase_admin)."""
    cur.execute("""select evtname, evtevent, evttags, evtfoid::regprocedure::text
                   from pg_event_trigger where pg_get_userbyid(evtowner) = 'postgres' order by 1""")
    out = []
    for nombre, evento, tags, funcion in cur.fetchall():
        tags = tags if isinstance(tags, list) else (tags.strip('{}').replace('"', '').split(',') if tags else [])
        cuando = (' WHEN TAG IN (' + ', '.join(lit(t) for t in tags) + ')') if tags else ''
        fn = funcion if funcion.startswith('public.') else 'public.' + funcion
        out.append(f'DROP EVENT TRIGGER IF EXISTS {nombre};\n'
                   f'CREATE EVENT TRIGGER {nombre} ON {evento}{cuando}\n  EXECUTE FUNCTION {fn};\n')
    return '\n'.join(out)


def realtime(cur):
    cur.execute("""select schemaname, tablename from pg_publication_tables
                   where pubname = 'supabase_realtime' and schemaname = 'public' order by 2""")
    return ''.join(f'ALTER PUBLICATION supabase_realtime ADD TABLE public.{t};\n' for _, t in cur.fetchall())


def comprobar_cron(cur):
    cur.execute("select 1 from pg_extension where extname = 'pg_cron'")
    if cur.fetchone():
        sys.exit('El proyecto tiene pg_cron. Revisar a mano las tareas programadas (su orden puede llevar\n'
                 'secretos o direcciones del centro) y añadirlas a este script antes de volver a sacar la base.')


def estructura(c, con_datos=False):
    """Las piezas de la estructura de un proyecto. Devuelve (piezas, nº de permisos de anon)."""
    conn = conectar(c)
    cur = conn.cursor()
    comprobar_cron(cur)
    public, anon = limpiar_volcado(volcar_public(c))
    partes = {
        'ext': extensiones(cur),
        'public': public,
        'storage': storage(cur),
        'eventos': disparadores_de_eventos(cur),
        'realtime': realtime(cur),
    }
    if con_datos:
        partes['datos'] = datos_de_partida(cur)
    conn.close()
    return partes, anon


def componer(p):
    return f"""-- ============================================================
-- GestionLab — LÍNEA BASE para instalar desde cero (solo estructura, sin datos)
-- ============================================================
-- Generado por tools/base-limpia/sacar_base_limpia.py a partir de la base real.
-- ⚠ NO EDITAR A MANO: se vuelve a sacar con el script. Ver supabase/base-limpia/README.md.
--
-- Cómo se aplica: en un proyecto de Supabase VACÍO, pegar entero en el editor SQL y
-- ejecutar (o con psql -f). Va en una sola transacción: si algo falla, no queda nada
-- a medias.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1. Extensiones
-- ------------------------------------------------------------
{p['ext']}
-- ------------------------------------------------------------
-- 2. Esquema public (pg_dump --schema-only)
-- ------------------------------------------------------------
{con_reinicio_de_permisos(p['public'])}
-- ------------------------------------------------------------
-- 3. Storage: buckets (configuración, sin archivos) y políticas
-- ------------------------------------------------------------
{p['storage']}
-- ------------------------------------------------------------
-- 4. Disparadores de eventos propios
-- ------------------------------------------------------------
SET search_path = public, pg_catalog;
{p['eventos']}
-- ------------------------------------------------------------
-- 5. Realtime
-- ------------------------------------------------------------
{p['realtime'] or '-- (ninguna tabla publicada)\n'}
-- ------------------------------------------------------------
-- 6. Datos de partida (los únicos datos de la base limpia)
-- ------------------------------------------------------------
{p['datos']}
COMMIT;
"""


def normalizar(sql):
    """Para comparar dos volcados: fuera comentarios, líneas vacías y metaórdenes."""
    return [l for l in sql.splitlines()
            if l.strip() and not l.startswith('--') and not l.startswith('\\')]


def main():
    real = leer_credenciales(CREDENCIALES)
    if '--comparar' in sys.argv:
        otro = leer_credenciales(sys.argv[sys.argv.index('--comparar') + 1])
        (a, _), (b, anon_otro) = estructura(real), estructura(otro)
        hay = False
        for clave in a:
            d = list(difflib.unified_diff(normalizar(a[clave]), normalizar(b[clave]),
                                          f'real/{clave}', f'otro/{clave}', lineterm='', n=1))
            if d:
                hay = True
                print('\n'.join(d))
        if anon_otro:
            hay = True
            print(f'\n⚠ En el otro proyecto anon tiene {anon_otro} permisos sobre tablas, secuencias o '
                  'funciones de public (en la base limpia, ninguno).')
        print('\nSin diferencias de estructura.' if not hay else '\nHay diferencias (arriba).')
        return

    partes, anon = estructura(real, con_datos=True)
    print(f'Quitados {anon} permisos de anon que tiene la base real.')
    sql = componer(partes)
    for n, l in enumerate(sql.splitlines(), 1):
        if MARCAS_DEL_CENTRO.search(l):
            sys.exit(f'Línea {n} parece llevar algo del centro; revisar antes de publicar:\n  {l}')
    os.makedirs(os.path.dirname(SALIDA), exist_ok=True)
    with open(SALIDA, 'w', encoding='utf-8', newline='\n') as f:
        f.write(sql)
    print(f'Escrito {os.path.relpath(SALIDA, RAIZ)} ({len(sql.splitlines())} líneas).')


if __name__ == '__main__':
    main()
