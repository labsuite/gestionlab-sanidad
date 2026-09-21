"""
Migración puntual (2026-09-21): líneas añadidas a un pedido que ya tiene el
presupuesto solicitado.

En la práctica se siguen metiendo artículos después de pedir presupuesto a la
casa comercial. Esas líneas no van en el presupuesto ya solicitado: hay que
pedirlas aparte. Se marcan con presupuesto_pendiente = true y la app las
muestra en un apartado separado hasta que se solicita su presupuesto; entonces
la marca se quita y se juntan con las demás.

- lineas_pedido.presupuesto_pendiente boolean not null default false

Uso: python scripts/migrar_presupuesto_pendiente.py
"""
from base import conectar

conn = conectar()

with conn.cursor() as cur:
    cur.execute("""
        select column_name from information_schema.columns
        where table_schema = 'public' and table_name = 'lineas_pedido'
    """)
    existentes = {row[0] for row in cur.fetchall()}

with conn.cursor() as cur:
    if 'presupuesto_pendiente' in existentes:
        print("lineas_pedido.presupuesto_pendiente ya existía, no se toca")
    else:
        cur.execute("alter table lineas_pedido add column presupuesto_pendiente boolean not null default false")
        print("✓ lineas_pedido.presupuesto_pendiente añadida")

conn.commit()
conn.close()
print("\nMigración completada.")
