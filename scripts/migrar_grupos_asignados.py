"""
migrar_grupos_asignados.py — añade `usuarios.grupos_asignados`.

Qué grupo(s) de alumnado lleva cada docente, como IDs de las cuentas de GRUPO
(`USR-A6T7SK,USR-IO7CA6`) separados por coma — mismo estilo de texto que
`modulo` y `ubicaciones_asignadas`. Antes esto se intentaba deducir cruzando los
módulos del profe con los del grupo, y fallaba en los dos sentidos: un módulo con
el mismo nombre lo imparten grupos de tres ciclos distintos, y un profe puede dar
clase fuera de su ciclo principal. Ahora se asigna a mano desde el modal de
usuario (Usuarios → ✏️), y de eso sale el bloque "Mis grupos" de la pestaña
Alumnos, con la cuenta y la contraseña de cada grupo.

Ejecutar una sola vez:  python scripts/migrar_grupos_asignados.py
Para rellenarlo con una primera propuesta: scripts/asignar_grupos_profesorado.py
"""
from base import conectar

SQL = """
alter table usuarios add column if not exists grupos_asignados text;

comment on column usuarios.grupos_asignados is
  'IDs de las cuentas de GRUPO del alumnado que lleva este docente, separados por coma. Se asigna a mano desde el modal de usuario.';
"""


def main():
    conn = conectar()
    cur = conn.cursor()
    cur.execute(SQL)
    conn.commit()
    cur.execute("""
      select column_name, data_type from information_schema.columns
      where table_name = 'usuarios' order by ordinal_position
    """)
    print("Columnas de usuarios:")
    for nombre, tipo in cur.fetchall():
        print(f"  {nombre:<28} {tipo}")
    cur.close()
    conn.close()


if __name__ == "__main__":
    main()
