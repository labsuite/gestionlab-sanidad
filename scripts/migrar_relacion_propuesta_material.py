"""
migrar_relacion_propuesta_material.py — añade a `propuestas_material` la
relación declarada con el catálogo.

El alumnado que inventaría encuentra tres cosas distintas y hasta ahora solo
sabía decir una ("esto es nuevo"):

  - `nuevo`     → material que no está en la app. Se crea al aceptarla.
  - `mismo`     → es un material que YA está en el catálogo, pero en un sitio
                  donde la app no lo tenía. No se crea una segunda entrada:
                  se le añade un bote (`material_ubicaciones`) en esa ubicación.
  - `alicuota`  → es un trasvase/alícuota de algo que ya está. Se cuelga como
                  bote hijo (`id_lote_padre`) del bote del que salió.

`id_material_relacionado` es el material que señala quien propone (distinto de
`id_material_sugerido`, que lo calcula el antiduplicados del servidor).

Ejecutar una sola vez:  python scripts/migrar_relacion_propuesta_material.py
"""
from base import conectar

SQL = """
alter table propuestas_material
  add column if not exists relacion text not null default 'nuevo';

alter table propuestas_material
  add column if not exists id_material_relacionado text
  references material(id_material) on delete set null;

comment on column propuestas_material.relacion is
  'nuevo | mismo (ya existe, otra ubicacion) | alicuota (trasvase de otro material)';
comment on column propuestas_material.id_material_relacionado is
  'Material del catalogo que senala quien propone; id_material_sugerido lo calcula el antiduplicados.';
"""


def main():
    conn = conectar()
    cur = conn.cursor()
    cur.execute(SQL)
    conn.commit()
    cur.execute("""
      select column_name, data_type from information_schema.columns
      where table_name = 'propuestas_material' order by ordinal_position
    """)
    print("Columnas de propuestas_material:")
    for nombre, tipo in cur.fetchall():
        print(f"  {nombre:<28} {tipo}")
    cur.close()
    conn.close()


if __name__ == "__main__":
    main()
