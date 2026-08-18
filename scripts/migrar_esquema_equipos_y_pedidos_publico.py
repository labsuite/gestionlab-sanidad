"""
Migración puntual de esquema (2026-08-18):

1. Añade ON UPDATE CASCADE a las FK que referencian equipos(id_activo) — hoy
   solo tienen ON DELETE CASCADE. Con esto, cambiar el ID de un equipo
   (UPDATE equipos SET id_activo = nuevo WHERE id_activo = actual) propaga
   automáticamente a las 9 tablas dependientes en vez de dejarlas huérfanas.
   Necesario para permitir editar el ID de un equipo desde la app.

2. Añade la columna pedidos.token_publico (para el link de subida de
   facturas/presupuestos del proveedor, sin login).

3. Crea la tabla documentos_proveedor (archivos subidos por el proveedor a
   través de ese link, uno por fila).

Uso: python scripts/migrar_esquema_equipos_y_pedidos_publico.py
"""
from base import conectar

conn = conectar()

# ── 1. ON UPDATE CASCADE en las FK hacia equipos(id_activo) ──────────────
with conn.cursor() as cur:
    cur.execute("""
        select tc.table_name, tc.constraint_name, kcu.column_name, rc.delete_rule
        from information_schema.table_constraints tc
        join information_schema.key_column_usage kcu
            on tc.constraint_name = kcu.constraint_name and tc.table_schema = kcu.table_schema
        join information_schema.constraint_column_usage ccu
            on tc.constraint_name = ccu.constraint_name and tc.table_schema = ccu.table_schema
        join information_schema.referential_constraints rc
            on tc.constraint_name = rc.constraint_name and tc.table_schema = rc.constraint_schema
        where tc.constraint_type = 'FOREIGN KEY'
          and ccu.table_name = 'equipos' and ccu.column_name = 'id_activo'
          and tc.table_schema = 'public'
    """)
    fks = cur.fetchall()

print(f"FK encontradas hacia equipos(id_activo): {len(fks)}")
for tabla, constraint, columna, delete_rule in fks:
    print(f"  {tabla}.{columna}  (constraint {constraint}, on delete {delete_rule})")

DELETE_CLAUSE = {
    'CASCADE': 'on delete cascade',
    'SET NULL': 'on delete set null',
    'SET DEFAULT': 'on delete set default',
    'RESTRICT': 'on delete restrict',
    'NO ACTION': '',  # comportamiento por defecto, no hace falta escribirlo
}

with conn.cursor() as cur:
    for tabla, constraint, columna, delete_rule in fks:
        clausula_delete = DELETE_CLAUSE.get(delete_rule, '')
        cur.execute(f'alter table {tabla} drop constraint "{constraint}"')
        cur.execute(
            f'alter table {tabla} add constraint "{constraint}" '
            f'foreign key ({columna}) references equipos(id_activo) '
            f'{clausula_delete} on update cascade'
        )
        print(f"  ✓ {tabla}: ON UPDATE CASCADE añadido (mantiene {delete_rule or 'NO ACTION'} en el borrado)")
conn.commit()

# ── 2. pedidos.token_publico ──────────────────────────────────────────────
with conn.cursor() as cur:
    cur.execute("""
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'pedidos' and column_name = 'token_publico'
    """)
    ya_existe = cur.fetchone() is not None
    if ya_existe:
        print("pedidos.token_publico ya existía, no se toca")
    else:
        cur.execute("alter table pedidos add column token_publico text unique")
        print("✓ pedidos.token_publico añadida")
conn.commit()

# ── 3. documentos_proveedor ───────────────────────────────────────────────
with conn.cursor() as cur:
    cur.execute("""
        select 1 from information_schema.tables
        where table_schema = 'public' and table_name = 'documentos_proveedor'
    """)
    ya_existe = cur.fetchone() is not None
    if ya_existe:
        print("documentos_proveedor ya existía, no se toca")
    else:
        cur.execute("""
            create table documentos_proveedor (
                id_documento    text primary key,
                pedido          text not null references pedidos(id_pedido) on delete cascade,
                nombre_archivo  text not null,
                path            text not null,
                tamano_bytes    integer,
                fecha_subida    timestamptz not null default now()
            )
        """)
        print("✓ tabla documentos_proveedor creada")
conn.commit()

# ── 4. RLS de documentos_proveedor ────────────────────────────────────────
# Supabase activa RLS por defecto en toda tabla nueva de public (vía event
# trigger) pero sin políticas — sin esto, la REST API (anon/authenticated)
# devuelve [] aunque la fila exista (falló así la primera vez, detectado
# probando el flujo real: el archivo se subía y se veía por SQL directo,
# pero DATA.documentosProveedor se quedaba vacío en el navegador). Mismo
# patrón que el resto de tablas (ver "POLÍTICAS RLS" en supabase/schema.sql):
# RLS "true" para todos, el control de acceso real lo hacen las Edge
# Functions, no RLS.
with conn.cursor() as cur:
    cur.execute("select 1 from pg_policies where tablename = 'documentos_proveedor'")
    ya_existe = cur.fetchone() is not None
    if ya_existe:
        print("Política RLS de documentos_proveedor ya existía, no se toca")
    else:
        cur.execute(
            "create policy documentos_proveedor_select_anon on documentos_proveedor "
            "for select to anon, authenticated using (true)"
        )
        print("✓ Política RLS de documentos_proveedor creada")
conn.commit()

conn.close()
print("\nMigración completada.")
