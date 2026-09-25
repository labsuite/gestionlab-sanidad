"""
migrar_solo_profesorado.py — `planes_mantenimiento.con_alumnado` → `solo_profesorado`.

Cambia de criterio quién realiza los mantenimientos preventivos: los INTERNOS los
hace el alumnado y el profesorado se limita a supervisar (visto bueno), en vez de
tener que marcar plan a plan cuáles se podían hacer con alumnado. Los EXTERNOS
siguen siendo del profesorado, por su `tipo_intervencion` — no hace falta marcarlos.

La columna se renombra y pasa a ser la EXCEPCIÓN: marcarla reserva ese plan
concreto al profesorado. Por eso se ponen todas las filas a `false`: el criterio
antiguo (una lista blanca de 247 planes) ya no significa nada con el nuevo.

Ejecutar una sola vez:  python scripts/migrar_solo_profesorado.py
"""
from base import conectar

SQL = """
alter table planes_mantenimiento rename column con_alumnado to solo_profesorado;

update planes_mantenimiento set solo_profesorado = false where solo_profesorado;

comment on column planes_mantenimiento.solo_profesorado is
  'Excepción: reserva este plan al profesorado. Por defecto los mantenimientos internos los realiza el alumnado y el profesorado da el visto bueno; los externos quedan fuera por tipo_intervencion.';
"""


def main():
    conn = conectar()
    cur = conn.cursor()

    cur.execute("""
      select column_name from information_schema.columns
      where table_name = 'planes_mantenimiento' and column_name = 'solo_profesorado'
    """)
    if cur.fetchone():
        print("La columna solo_profesorado ya existe — nada que migrar.")
        cur.close(); conn.close()
        return

    cur.execute(SQL)
    conn.commit()

    cur.execute("""
      select tipo_intervencion, solo_profesorado, count(*)
      from planes_mantenimiento where activo is not false
      group by 1, 2 order by 1, 2
    """)
    print("Planes activos tras la migración:")
    for tipo, solo_prof, n in cur.fetchall():
        quien = "profesorado" if (solo_prof or tipo == "Externo") else "alumnado"
        print(f"  {tipo:<10} solo_profesorado={str(solo_prof):<5} {n:>4}  → lo realiza el {quien}")
    cur.close()
    conn.close()


if __name__ == '__main__':
    main()
