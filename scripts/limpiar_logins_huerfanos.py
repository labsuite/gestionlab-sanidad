# -*- coding: utf-8 -*-
"""
Elimina de Supabase Auth los logins que ya no corresponden a nadie.

Por qué existe
--------------
`borrar_alumnado_personal.py` borra catálogo, rol y login de cada alumno. La
API de Auth devolvió **504 upstream request timeout** en 34 de las 36 bajas
(2026-09-19): el catálogo y el rol se borraron, pero la cuenta de acceso
sobrevivió. Eso es peor que no haber borrado nada — una persona sin fila en el
catálogo sigue pudiendo iniciar sesión y `getRealUserRole()` (js/ui.js) la trata
como **Alumno**, además de dejar su email en Auth.

Qué borra
---------
Solo las cuentas de Auth que cumplen **las dos** condiciones a la vez:
  - no tienen fila en el catálogo `usuarios`, y
  - no tienen fila en `public.users`.

Ese doble filtro es el guardarraíl: el profesorado y la gestión que no están en
el catálogo (cuentas `_sbOnly`, altas antiguas) sí tienen fila en `public.users`,
así que quedan fuera por construcción.

Uso
---
    python scripts/limpiar_logins_huerfanos.py            # solo informa (DRY_RUN)
    python scripts/limpiar_logins_huerfanos.py --aplicar  # borra de verdad

Reintenta cada baja y va en paralelo: la API de Auth tarda mucho por cuenta y en
serie esto son 25 minutos.
"""
import json
import sys
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor

from base import conectar

DRY_RUN = "--aplicar" not in sys.argv
REINTENTOS = 3
HILOS = 6

_CRED = json.load(open("scripts/supabase_credentials.json", encoding="utf-8"))
_H = {"apikey": _CRED["service_role_key"],
      "Authorization": f"Bearer {_CRED['service_role_key']}"}


def _listar_auth():
    req = urllib.request.Request(
        f"{_CRED['project_url']}/auth/v1/admin/users?page=1&per_page=1000", headers=_H)
    return json.load(urllib.request.urlopen(req))["users"]


def _borrar(uid):
    for intento in range(1, REINTENTOS + 1):
        req = urllib.request.Request(
            f"{_CRED['project_url']}/auth/v1/admin/users/{uid}", headers=_H, method="DELETE")
        try:
            urllib.request.urlopen(req, timeout=90)
            return True, ""
        except urllib.error.HTTPError as e:
            # 404 = ya no está: la baja anterior sí había surtido efecto pese al 504
            if e.code == 404:
                return True, "ya no existía"
            motivo = f"{e.code}"
        except Exception as e:
            motivo = type(e).__name__
        if intento == REINTENTOS:
            return False, motivo
    return False, "?"


def main():
    conn = conectar()
    cur = conn.cursor()
    cur.execute("select lower(email) from usuarios where email is not null")
    catalogo = {r[0] for r in cur.fetchall()}
    cur.execute("select lower(email) from users where email is not null")
    perfiles = {r[0] for r in cur.fetchall()}
    conn.close()

    huerfanos = [
        (u["id"], (u.get("email") or "").lower())
        for u in _listar_auth()
        if (u.get("email") or "").lower() not in catalogo
        and (u.get("email") or "").lower() not in perfiles
    ]

    if not huerfanos:
        print("No hay logins huérfanos. Nada que borrar.")
        return

    print(f"{len(huerfanos)} login(s) huérfano(s) — sin fila en `usuarios` ni en `public.users`:")
    for _, email in huerfanos[:5]:
        print("   ", email)
    if len(huerfanos) > 5:
        print(f"    ... y {len(huerfanos) - 5} más")

    if DRY_RUN:
        print("\nDRY_RUN: no se ha tocado nada.")
        print("Vuelve a ejecutarlo con --aplicar para borrar esos logins.")
        return

    with ThreadPoolExecutor(max_workers=HILOS) as pool:
        resultados = list(pool.map(lambda h: (h[1], *_borrar(h[0])), huerfanos))

    ok = [e for e, bien, _ in resultados if bien]
    mal = [(e, m) for e, bien, m in resultados if not bien]
    print(f"\nBorrados {len(ok)} login(s).")
    if mal:
        print("No se pudieron borrar:")
        for email, motivo in mal:
            print(f"   {email}: {motivo}")

    restantes = [
        (u.get("email") or "") for u in _listar_auth()
        if (u.get("email") or "").lower() not in catalogo
        and (u.get("email") or "").lower() not in perfiles
    ]
    print("Logins huérfanos restantes:", len(restantes))


if __name__ == "__main__":
    main()
