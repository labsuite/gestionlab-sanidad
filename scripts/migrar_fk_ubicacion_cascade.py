"""
migrar_fk_ubicacion_cascade.py — que renombrar una ubicación no reviente.

`ubicaciones.id_ubicacion` es la clave primaria Y el ID que la persona escribe a
mano (y corrige al editar). Las tablas que lo referencian se crearon sin
`on update cascade`, así que cambiar el ID daba:

    update or delete on table "ubicaciones" violates foreign key constraint
    "material_ubicaciones_id_ubicacion_fkey" on table "material_ubicaciones"

Este script recrea TODAS las claves ajenas que apuntan a `ubicaciones` con
`on update cascade`, conservando su regla de borrado (`on delete set null` donde
la hubiera). Busca las constraints en el catálogo en vez de nombrarlas a mano,
así que también coge las que se añadan en el futuro; es idempotente (solo toca
las que aún están en NO ACTION).

Ejecutar:  python scripts/migrar_fk_ubicacion_cascade.py
"""
from base import conectar

SQL = """
do $$
declare c record;
begin
  for c in
    select con.conname                      as nombre,
           rel.relname                      as tabla,
           pg_get_constraintdef(con.oid)    as definicion
      from pg_constraint con
      join pg_class rel on rel.oid = con.conrelid
     where con.contype   = 'f'
       and con.confrelid = 'ubicaciones'::regclass
       and con.confupdtype = 'a'   -- 'a' = NO ACTION: aún sin cascada
  loop
    raise notice 'FK % en % -> on update cascade', c.nombre, c.tabla;
    execute format('alter table %I drop constraint %I', c.tabla, c.nombre);
    execute format('alter table %I add constraint %I %s on update cascade',
                   c.tabla, c.nombre, c.definicion);
  end loop;
end $$;
"""


def main():
    conn = conectar()
    cur = conn.cursor()
    cur.execute(SQL)
    conn.commit()
    cur.execute("""
      select rel.relname, con.conname, pg_get_constraintdef(con.oid)
        from pg_constraint con
        join pg_class rel on rel.oid = con.conrelid
       where con.contype = 'f' and con.confrelid = 'ubicaciones'::regclass
       order by rel.relname
    """)
    print("Claves ajenas que apuntan a ubicaciones:")
    for tabla, nombre, definicion in cur.fetchall():
        print(f"  {tabla:<28} {definicion}")
    cur.close()
    conn.close()


if __name__ == "__main__":
    main()
