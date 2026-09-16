"""
migrar_propuestas_ubicacion.py — crea la tabla propuestas_ubicacion_equipo.

Inventario colaborativo, fase A: el alumnado propone la ubicación concreta de
cada equipo y nada toca `equipos` hasta que se acepta (o hasta que dos personas
distintas coinciden). Ver supabase/schema.sql sección 9.

Ejecutar una sola vez:  python scripts/migrar_propuestas_ubicacion.py
"""
import sys
sys.path.insert(0, 'scripts')
from base import conectar

SQL = """
create table if not exists propuestas_ubicacion_equipo (
  id_propuesta          text primary key,
  id_equipo             text not null references equipos(id_activo) on delete cascade on update cascade,
  id_ubicacion          text references ubicaciones(id_ubicacion) on delete set null,
  no_encontrado         boolean not null default false,
  ubicacion_anterior    text,
  propuesto_por         text,
  email_propuesto_por   text,
  observaciones         text,
  fecha                 timestamptz not null default now(),
  estado                text not null default 'pendiente',
  revisado_por          text,
  fecha_revision        timestamptz,
  notas_revision        text
);

create index if not exists idx_propuestas_ubic_estado on propuestas_ubicacion_equipo (estado);
create index if not exists idx_propuestas_ubic_equipo on propuestas_ubicacion_equipo (id_equipo);

alter table propuestas_ubicacion_equipo enable row level security;

grant all on propuestas_ubicacion_equipo to service_role;
grant select, insert, update, delete on propuestas_ubicacion_equipo to authenticated;
grant select on propuestas_ubicacion_equipo to anon;

drop policy if exists "propuestas_ubicacion_equipo_select_anon" on propuestas_ubicacion_equipo;
create policy "propuestas_ubicacion_equipo_select_anon"
  on propuestas_ubicacion_equipo for select to anon, authenticated using (true);
"""

conn = conectar()
cur = conn.cursor()
cur.execute(SQL)
conn.commit()

cur.execute("""
  select column_name, data_type from information_schema.columns
  where table_name = 'propuestas_ubicacion_equipo' order by ordinal_position
""")
print("Tabla propuestas_ubicacion_equipo creada:")
for nombre, tipo in cur.fetchall():
    print(f"  {nombre:22} {tipo}")
conn.close()
