# -*- coding: utf-8 -*-
"""
Borra el email de quien propuso, en las propuestas del inventario colaborativo
que ya están resueltas (aceptada / rechazada / fusionada).

Por qué existe
--------------
`propuestas_ubicacion_equipo` y `propuestas_material` son el ÚNICO sitio donde
la app guarda un dato identificativo de alumnado sin justificación de seguridad
del laboratorio — y lo hace porque mientras la propuesta vive el email cumple
tres funciones reales (ver docs/proteccion-datos.md):

  1. repropuesta: sustituir la propuesta pendiente anterior de esa misma persona
     para ese mismo equipo, en vez de acumular dos versiones de lo mismo;
  2. doble verificación: comprobar que las dos propuestas que coinciden vienen
     de personas distintas antes de aplicar el cambio solo;
  3. "Mis propuestas": devolverle a cada persona el resultado de lo que propuso.

En cuanto la propuesta está resuelta y el alumnado ha visto el resultado, esas
tres funciones se agotan y el email deja de tener finalidad: hay que borrarlo.
Lo suyo es ejecutar esto al cerrar cada curso académico.

Uso
---
    python scripts/anonimizar_propuestas.py            # solo informa (DRY_RUN)
    python scripts/anonimizar_propuestas.py --aplicar  # borra de verdad

El borrado es irreversible y NO elimina la propuesta: se queda el qué (equipo,
ubicación, material, fecha, estado, quién la revisó), se va el quién la hizo.
"""
import sys
from datetime import date, timedelta

from base import conectar

# ── CONFIGURACIÓN ────────────────────────────────────────────────────────
# Días que tiene que llevar resuelta una propuesta para borrarle el email.
# 60 días da margen de sobra para que el alumnado vea el resultado en
# "Mis propuestas" antes de que desaparezca su rastro.
DIAS_DE_GRACIA = 60

ESTADOS_RESUELTOS = ("aceptada", "rechazada", "fusionada")
TABLAS = ("propuestas_ubicacion_equipo", "propuestas_material")
# ─────────────────────────────────────────────────────────────────────────

DRY_RUN = "--aplicar" not in sys.argv


def main():
    corte = date.today() - timedelta(days=DIAS_DE_GRACIA)
    conn = conectar()
    cur = conn.cursor()
    total = 0

    for tabla in TABLAS:
        cur.execute(
            f"""select count(*) from {tabla}
                 where estado = any(%s)
                   and email_propuesto_por is not null
                   and coalesce(fecha_revision, fecha) < %s""",
            (list(ESTADOS_RESUELTOS), corte),
        )
        n = cur.fetchone()[0]
        total += n
        print(f"{tabla}: {n} propuesta(s) resuelta(s) antes de {corte} con email guardado")

        if n and not DRY_RUN:
            cur.execute(
                f"""update {tabla}
                       set email_propuesto_por = null,
                           propuesto_por = 'Alumnado'
                     where estado = any(%s)
                       and email_propuesto_por is not null
                       and coalesce(fecha_revision, fecha) < %s""",
                (list(ESTADOS_RESUELTOS), corte),
            )
            print(f"  → {cur.rowcount} fila(s) anonimizada(s)")

    if DRY_RUN:
        print(f"\nDRY_RUN: no se ha tocado nada. {total} fila(s) se anonimizarían.")
        print("Vuelve a ejecutarlo con --aplicar para borrar los emails.")
    else:
        conn.commit()
        print(f"\nListo: {total} fila(s) sin email de quien propuso.")
    conn.close()


if __name__ == "__main__":
    main()
