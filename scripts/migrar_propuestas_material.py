# -*- coding: utf-8 -*-
"""
migrar_propuestas_material.py — cuarentena del material propuesto (fase B).

Nada de lo que propone el alumnado entra en `material`: se guarda aquí y lo
resuelve el profesorado. Tres salidas posibles:
  · aceptar   → se crea el material con el nombre compuesto de los atributos
  · fusionar  → resulta que ya existía: se descarta el alta y, si procede, la
                cantidad contada se convierte en un ajuste de stock
  · rechazar  → con motivo, que ve quien lo propuso

No hay columna "nombre": ese es justo el campo que no se le pide a nadie. El
nombre se compone de `nombre_base` + `atributos` con la ficha de
`atributos_material`, y `nombre_generado` guarda el resultado del momento para
que el profesorado vea exactamente lo que se va a crear.

`texto_etiqueta` es lo que pone literalmente en el bote (nombre comercial, REF
del proveedor...). Ahí es donde acaba "FUCH-BZD-500" o "Trizol", que es
información útil pero NO es el nombre del material.

Ejecutar una sola vez:  python scripts/migrar_propuestas_material.py
"""
import sys

sys.path.insert(0, 'scripts')
sys.stdout.reconfigure(encoding='utf-8')
from base import conectar

SQL = """
create table if not exists propuestas_material (
  id_propuesta          text primary key,

  -- Qué se propone
  categoria             text not null,
  tipo_base             text,          -- ficha aplicada; null = "no está en la lista"
  nombre_base           text,
  atributos             jsonb not null default '{}'::jsonb,
  texto_etiqueta        text,          -- lo que pone literalmente en el bote
  nombre_generado       text,          -- compuesto al proponer, para que se vea qué se creará
  unidad                text,
  cantidad              numeric,
  id_ubicacion          text references ubicaciones(id_ubicacion) on delete set null,
  foto_path             text,          -- ruta en Storage (bucket privado)

  -- Ayudas automáticas
  id_material_sugerido  text references material(id_material) on delete set null,  -- antiduplicados
  ia_extraido           jsonb,         -- lo que Gemini leyó de la etiqueta
  ia_avisos             text,          -- discrepancias entre lo leído y lo escrito

  -- Quién y cuándo
  propuesto_por         text,
  email_propuesto_por   text,
  observaciones         text,
  fecha                 timestamptz not null default now(),

  -- Resolución
  estado                text not null default 'pendiente',  -- pendiente|aceptada|fusionada|rechazada
  revisado_por          text,
  fecha_revision        timestamptz,
  notas_revision        text,
  id_material_creado    text references material(id_material) on delete set null
);

create index if not exists idx_propuestas_material_estado on propuestas_material (estado);
create index if not exists idx_propuestas_material_fecha  on propuestas_material (fecha desc);

alter table propuestas_material enable row level security;
grant all on propuestas_material to service_role;
grant select, insert, update, delete on propuestas_material to authenticated;
grant select on propuestas_material to anon;
drop policy if exists "propuestas_material_select_anon" on propuestas_material;
create policy "propuestas_material_select_anon"
  on propuestas_material for select to anon, authenticated using (true);
"""

conn = conectar()
cur = conn.cursor()
cur.execute(SQL)
conn.commit()

cur.execute("""
  select column_name, data_type from information_schema.columns
  where table_name = 'propuestas_material' order by ordinal_position
""")
print("Tabla propuestas_material creada:")
for nombre, tipo in cur.fetchall():
    print(f"  {nombre:22} {tipo}")
conn.close()
