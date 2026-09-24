# -*- coding: utf-8 -*-
"""
asignar_grupos_profesorado.py — primera propuesta de `usuarios.grupos_asignados`.

Qué grupo lleva cada docente se asigna a mano en la app (Usuarios → ✏️ → "Grupos
de alumnado"). Este script solo existe para no empezar con las once fichas
vacías: deduce una propuesta cruzando los módulos del docente con los de cada
grupo, y la escribe SOLO en quien aún no tenga nada asignado.

La regla, por cada módulo del docente:
  - si algún grupo de SU ciclo principal imparte ese módulo → ese grupo;
  - si ninguno lo imparte → los grupos de otros ciclos que sí.
El segundo caso es real: Ana Liste tiene ciclo principal CS LCB y da "Control e
Seguridade Alimentaria", que es de 2º CS QSA. Y el primero evita que un módulo
que comparten tres ciclos ("Bioloxía Molecular e Citoxenética") le cuele a cada
profe los grupos de los otros dos.

Es una propuesta, no la verdad: lo que valga lo dice la usuaria desde la app.

    python scripts/asignar_grupos_profesorado.py            # solo enseña qué haría
    python scripts/asignar_grupos_profesorado.py --aplicar  # lo escribe
"""
import sys

from base import conectar

DRY_RUN = "--aplicar" not in sys.argv

ROLES_DOCENTES = ("Profesor", "Gestor")


def _lista(campo):
    return [x.strip() for x in (campo or "").split(",") if x.strip()]


def main():
    conn = conectar()
    cur = conn.cursor()

    cur.execute("select id_usuario, nombre, ciclo_principal, modulo from usuarios where rol = 'Alumno'")
    grupos = [
        {"id": r[0], "nombre": r[1], "ciclo": (r[2] or "").strip(), "modulos": set(_lista(r[3]))}
        for r in cur.fetchall()
    ]

    cur.execute(
        "select id_usuario, nombre, ciclo_principal, modulo, grupos_asignados from usuarios "
        "where rol in %s order by nombre", (ROLES_DOCENTES,)
    )
    docentes = cur.fetchall()

    cambios, sin_tocar = [], []
    for id_usuario, nombre, ciclo, modulos, ya_asignados in docentes:
        if _lista(ya_asignados):
            sin_tocar.append((nombre, "ya tiene grupos asignados"))
            continue

        ciclo = (ciclo or "").strip()
        mios = []
        for modulo in _lista(modulos):
            mismo_ciclo = [g for g in grupos if modulo in g["modulos"] and ciclo and g["ciclo"] == ciclo]
            otros = [g for g in grupos if modulo in g["modulos"] and g["ciclo"] != ciclo]
            for g in (mismo_ciclo or otros):
                if g not in mios:
                    mios.append(g)

        if not mios:
            sin_tocar.append((nombre, "sin módulos en la ficha o sin grupo que los imparta"))
            continue

        mios.sort(key=lambda g: g["nombre"])
        cambios.append((id_usuario, nombre, mios))

    print(f"{'[DRY RUN] ' if DRY_RUN else ''}Propuesta de grupos por docente\n")
    for _, nombre, mios in cambios:
        print(f"  {nombre:<38} → {', '.join(g['nombre'] for g in mios)}")
    if sin_tocar:
        print("\nSe quedan como están:")
        for nombre, motivo in sin_tocar:
            print(f"  {nombre:<38} ({motivo})")

    if DRY_RUN:
        print("\nNada escrito. Repite con --aplicar para guardarlo.")
        return

    for id_usuario, _, mios in cambios:
        cur.execute(
            "update usuarios set grupos_asignados = %s where id_usuario = %s",
            (",".join(g["id"] for g in mios), id_usuario),
        )
    conn.commit()
    print(f"\n{len(cambios)} ficha(s) actualizadas.")
    cur.close()
    conn.close()


if __name__ == "__main__":
    main()
