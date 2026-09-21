"""
migrar_credenciales_grupo.py — crea la tabla credenciales_grupo.

Copia CIFRADA de la contraseña de cada cuenta de GRUPO del alumnado, para que el
profesorado pueda consultarla desde la app (Usuarios → Alumnos → 🔑) y cambiarla
sin salir de ella. Supabase Auth solo guarda el hash, así que sin esta copia no
hay forma de "ver" la contraseña de un grupo, solo de poner una nueva.

Solo cuentas de grupo: la contraseña de una persona no se guarda nunca, ni
cifrada (ver docs/proteccion-datos.md).

La tabla NO se expone al navegador: sin políticas RLS y sin GRANT a anon ni a
authenticated, solo la toca el service_role desde la Edge Function
`gestionar-usuario`, que antes comprueba el rol de quien pregunta. El texto va
cifrado con AES-256-GCM y la clave (`GRUPO_PASSWORD_KEY`) vive en los secretos
de las Edge Functions, nunca en Postgres — ver supabase/functions/_shared/secretos.ts.

Ejecutar una sola vez:  python scripts/migrar_credenciales_grupo.py
"""
import sys
sys.path.insert(0, 'scripts')
from base import conectar

SQL = """
create table if not exists credenciales_grupo (
  id_usuario        text primary key references usuarios(id_usuario) on delete cascade on update cascade,
  password_cifrada  text not null,
  actualizado_en    timestamptz not null default now(),
  actualizado_por   text
);

alter table credenciales_grupo enable row level security;

-- Sin políticas y sin GRANT a anon/authenticated a propósito: esta tabla solo la
-- lee el service_role desde las Edge Functions.
revoke all on credenciales_grupo from anon, authenticated;
grant all on credenciales_grupo to service_role;

comment on table credenciales_grupo is
  'Copia cifrada (AES-256-GCM) de la contraseña de cada cuenta de GRUPO del alumnado, para que el profesorado pueda consultarla. Solo accesible con service_role desde gestionar-usuario. Nunca contraseñas de personas.';
"""

conn = conectar()
cur = conn.cursor()
cur.execute(SQL)
conn.commit()

cur.execute("""
  select column_name, data_type from information_schema.columns
  where table_name = 'credenciales_grupo' order by ordinal_position
""")
print("Tabla credenciales_grupo creada:")
for nombre, tipo in cur.fetchall():
    print(f"  {nombre:18} {tipo}")
conn.close()
