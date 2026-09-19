# -*- coding: utf-8 -*-
"""
Elimina las CUENTAS PERSONALES de alumnado, ya sustituidas por las cuentas de
grupo (`scripts/crear_grupos_alumnado.py`).

Desde el curso 2026-27 el alumnado entra con una cuenta por grupo y en la base
de datos no debe quedar ningún nombre ni email de menores. Este script cierra
esa migración borrando, por cada alumno personal:

  1. la fila del catálogo `usuarios`
  2. la fila de `public.users` (el rol)
  3. la cuenta de Supabase Auth (el login)
  4. sus recordatorios de `tareas_personales`, que van por email

Borra SOLO filas con `rol = 'Alumno'` cuyo email NO esté en el dominio de las
cuentas de grupo. Profesorado, gestión y las propias cuentas de grupo no se
tocan.

Uso
---
    python scripts/borrar_alumnado_personal.py            # solo informa (DRY_RUN)
    python scripts/borrar_alumnado_personal.py --aplicar  # borra de verdad

Es irreversible. Ejecutar DESPUÉS de crear las cuentas de grupo y de comprobar
que el alumnado puede entrar con ellas.
"""
import json
import sys
import urllib.error
import urllib.request

from base import conectar

DOMINIO_GRUPOS = "@gestionlab.cma"
DRY_RUN = "--aplicar" not in sys.argv


def _cred():
    return json.load(open("scripts/supabase_credentials.json", encoding="utf-8"))


def _borrar_auth(user_id):
    c = _cred()
    req = urllib.request.Request(
        f"{c['project_url']}/auth/v1/admin/users/{user_id}",
        headers={"apikey": c["service_role_key"],
                 "Authorization": f"Bearer {c['service_role_key']}"},
        method="DELETE",
    )
    try:
        urllib.request.urlopen(req)
        return True, ""
    except urllib.error.HTTPError as e:
        return False, f"{e.code}: {e.read().decode()[:120]}"


def main():
    conn = conectar()
    cur = conn.cursor()

    cur.execute(
        """select id_usuario, nombre, email
             from usuarios
            where rol = 'Alumno'
              and coalesce(email, '') not ilike %s
            order by nombre""",
        (f"%{DOMINIO_GRUPOS}",),
    )
    alumnos = cur.fetchall()
    if not alumnos:
        print("No hay cuentas personales de alumnado. Nada que borrar.")
        conn.close()
        return

    # Guardarraíl: nadie que sea responsable de un equipo (mismo criterio que la
    # acción `eliminar` de gestionar-usuario — si no, esos equipos quedan
    # apuntando a alguien que ya no existe).
    nombres = [n for _, n, _ in alumnos]
    cur.execute(
        """select e.id_activo, e.responsable from equipos e
            where e.responsable is not null and e.responsable <> ''""")
    responsables = {
        n for _, resp in cur.fetchall()
        for n in nombres
        if n.lower().strip() in [p.strip().lower() for p in (resp or "").split(",")]
    }
    if responsables:
        print("ABORTADO: estas personas son responsables de algún equipo, "
              "reasígnalos antes de borrar:")
        for n in sorted(responsables):
            print("   -", n)
        conn.close()
        sys.exit(1)

    print(f"{len(alumnos)} cuenta(s) personal(es) de alumnado a borrar:")
    for _, nombre, email in alumnos[:5]:
        print(f"   {nombre}  <{email}>")
    if len(alumnos) > 5:
        print(f"   ... y {len(alumnos) - 5} más")

    if DRY_RUN:
        print(f"\nDRY_RUN: no se ha tocado nada. Se borrarían {len(alumnos)} cuenta(s),")
        print("con su login, su rol y sus recordatorios personales.")
        print("Vuelve a ejecutarlo con --aplicar para borrarlas.")
        conn.close()
        return

    borradas, fallos = 0, []
    for id_usuario, nombre, email in alumnos:
        email_norm = (email or "").lower().strip()
        cur.execute("select id from users where lower(email) = %s", (email_norm,))
        fila = cur.fetchone()

        if email_norm:
            cur.execute("delete from tareas_personales where lower(email) = %s", (email_norm,))
        cur.execute("delete from users where lower(email) = %s", (email_norm,))
        cur.execute("delete from usuarios where id_usuario = %s", (id_usuario,))

        if fila:
            ok, motivo = _borrar_auth(fila[0])
            if not ok:
                fallos.append((nombre, motivo))
        conn.commit()
        borradas += 1

    print(f"\nBorradas {borradas} cuenta(s).")
    if fallos:
        print("Ojo — se borró el catálogo y el rol, pero el login sigue vivo en:")
        for nombre, motivo in fallos:
            print(f"   {nombre}: {motivo}")

    cur.execute("select count(*) from usuarios where rol = 'Alumno' "
                "and coalesce(email,'') not ilike %s", (f"%{DOMINIO_GRUPOS}",))
    print("Cuentas personales de alumnado restantes:", cur.fetchone()[0])
    conn.close()


if __name__ == "__main__":
    main()
