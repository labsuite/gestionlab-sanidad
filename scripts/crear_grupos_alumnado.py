# -*- coding: utf-8 -*-
"""
Da de alta las CUENTAS DE GRUPO del alumnado.

Desde el curso 2026-27 el alumnado no tiene cuenta personal: cada grupo comparte
una única cuenta (`1cslcb@gestionlab.cma` = "1º CS LCB"), con su propia
contraseña. Así no hay nombres ni emails de menores en la base de datos y el rol
`Alumno` sigue funcionando igual que antes.

Crea, por cada grupo y exactamente igual que hacía el import de alumnado:
  1. fila en el catálogo `usuarios` (lo que ve la página Usuarios)
  2. cuenta real de Supabase Auth (el login)
  3. fila en `public.users` (el rol que comprueban las Edge Functions)

Las contraseñas se imprimen al final para repartirlas. **No se guardan en ningún
fichero**: si se pierden, se regeneran con el botón 🔑 de la página Usuarios.

Uso
---
    python scripts/crear_grupos_alumnado.py            # solo informa (DRY_RUN)
    python scripts/crear_grupos_alumnado.py --aplicar  # crea las cuentas

Es idempotente: un grupo que ya exista se omite, no se duplica ni se le cambia
la contraseña.
"""
import json
import secrets
import sys
import urllib.error
import urllib.request

from base import conectar, generar_id

# ── CONFIGURACIÓN ────────────────────────────────────────────────────────
# Un grupo por línea: (nombre visible, parte local del email, ciclo, labs).
#
# El ciclo tiene que coincidir con `ciclos.nombre` / `usuarios.ciclo_principal`
# (están en gallego, como el catálogo de Sanidad CMA — ver docs/modulo-usuarios.md).
#
# `labs` son los números de laboratorio separados por coma ("201,205"); vacío
# significa que ese grupo solo ve la zona común. Se puede dejar vacío aquí y
# asignarlos después desde la app, que es más cómodo.
#
# ⚠ Revisa esta lista antes de ejecutar: está generada con todas las
# combinaciones curso × ciclo, y puede que algún grupo no exista este año.
# Trebello no expone el curso (1º/2º) ni los ciclos ZS, así que no se puede
# sacar de ahí — esta lista es la fuente.
DOMINIO = "@gestionlab.cma"

GRUPOS = [
    ("1º CS APC", "1csapc", "CS Anatomía Patolóxica e Citodiagnóstico", ""),
    ("2º CS APC", "2csapc", "CS Anatomía Patolóxica e Citodiagnóstico", ""),
    ("1º CS LCB", "1cslcb", "CS Laboratorio Clínico e Biomédico", ""),
    ("2º CS LCB", "2cslcb", "CS Laboratorio Clínico e Biomédico", ""),
    ("1º CS QSA", "1csqsa", "CS Química e Saúde Ambiental", ""),
    ("2º CS QSA", "2csqsa", "CS Química e Saúde Ambiental", ""),
    ("1º ZS APC", "1zsapc", "ZS Anatomía Patolóxica e Citodiagnóstico", ""),
    ("2º ZS APC", "2zsapc", "ZS Anatomía Patolóxica e Citodiagnóstico", ""),
    ("1º ZS LCB", "1zslcb", "ZS Laboratorio Clínico e Biomédico", ""),
    ("2º ZS LCB", "2zslcb", "ZS Laboratorio Clínico e Biomédico", ""),
]
# ─────────────────────────────────────────────────────────────────────────

DRY_RUN = "--aplicar" not in sys.argv

# Misma convención que `passwordDeGrupo()` en supabase/functions/_shared/auth.ts:
# dos palabras y tres dígitos. Aleatoria de verdad, pero se dicta en clase sin
# deletrear. NO puede derivarse del email: la parte local es el nombre del grupo.
PALABRAS = [
    "auga", "praia", "vento", "ceo", "pedra", "faro", "ponte", "horta",
    "verde", "azul", "roxo", "dourado", "prata", "ambar", "coral", "malva",
    "lua", "sol", "raio", "brisa", "monte", "rio", "campo", "illa",
]


def password_de_grupo() -> str:
    a, b = secrets.SystemRandom().sample(PALABRAS, 2)
    return f"{a}-{b}-{secrets.randbelow(900) + 100}"


def _cred():
    return json.load(open("scripts/supabase_credentials.json", encoding="utf-8"))


def _auth_admin(metodo, ruta, payload=None):
    c = _cred()
    req = urllib.request.Request(
        f"{c['project_url']}/auth/v1/admin{ruta}",
        data=(json.dumps(payload).encode() if payload is not None else None),
        headers={
            "apikey": c["service_role_key"],
            "Authorization": f"Bearer {c['service_role_key']}",
            "Content-Type": "application/json",
        },
        method=metodo,
    )
    try:
        return json.load(urllib.request.urlopen(req))
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"Auth {e.code}: {e.read().decode()[:200]}") from None


def main():
    conn = conectar()
    cur = conn.cursor()
    creadas, omitidas = [], []

    for nombre, local, ciclo, labs in GRUPOS:
        email = f"{local}{DOMINIO}"
        cur.execute("select id_usuario from usuarios where lower(email) = %s", (email,))
        if cur.fetchone():
            omitidas.append((nombre, email, "ya existe"))
            continue

        print(f"{'[DRY] ' if DRY_RUN else ''}{nombre:<12} {email:<28} {ciclo}")
        if DRY_RUN:
            continue

        # 1. Catálogo `usuarios`
        id_usuario = generar_id("USR-")
        cur.execute(
            """insert into usuarios
                 (id_usuario, nombre, email, rol, activo,
                  ubicaciones_asignadas, modulo, ciclo_principal, puede_revisar_inventario)
               values (%s, %s, %s, 'Alumno', true, %s, '', %s, false)""",
            (id_usuario, nombre, email, labs, ciclo),
        )

        # 2. Cuenta de Supabase Auth
        password = password_de_grupo()
        try:
            auth_user = _auth_admin("POST", "/users",
                                    {"email": email, "password": password, "email_confirm": True})
        except RuntimeError as e:
            conn.rollback()
            omitidas.append((nombre, email, f"no se pudo crear el login: {e}"))
            continue
        user_id = auth_user["id"]

        # 3. Ciclo + fila en `public.users` (rol que comprueban las Edge Functions)
        cur.execute("select id from ciclos where nombre = %s", (ciclo,))
        fila = cur.fetchone()
        if fila:
            ciclo_id = fila[0]
        else:
            cur.execute("insert into ciclos (nombre) values (%s) returning id", (ciclo,))
            ciclo_id = cur.fetchone()[0]

        cur.execute(
            """insert into users
                 (id, gestionlab_id, nombre, email, rol, activo,
                  ciclo_principal_id, puede_revisar_inventario)
               values (%s, %s, %s, %s, 'Alumno', true, %s, false)""",
            (user_id, id_usuario, nombre, email, ciclo_id),
        )
        conn.commit()
        creadas.append((nombre, email, password))

    for nombre, email, motivo in omitidas:
        print(f"  omitido  {nombre:<12} {email:<28} {motivo}")

    if DRY_RUN:
        print(f"\nDRY_RUN: no se ha creado nada. Se crearían {len(GRUPOS) - len(omitidas)} cuenta(s).")
        print("Revisa la lista GRUPOS y vuelve a ejecutarlo con --aplicar.")
    elif creadas:
        print("\n" + "=" * 62)
        print("CONTRASEÑAS — apúntalas ahora, no se guardan en ningún sitio")
        print("=" * 62)
        for nombre, email, password in creadas:
            print(f"  {nombre:<12} {email:<28} {password}")

    conn.close()


if __name__ == "__main__":
    main()
