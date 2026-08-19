"""
Migración puntual (2026-08-19): permite elegir la unidad pedida en una línea
de pedido cuando un material se compra en más de un formato (ej: azul de
lactofenol en botella o en gotero).

- material.unidades_extra text: unidades alternativas del material,
  coma-separadas (la unidad "de serie" sigue siendo material.unidad).
- lineas_pedido.unidad text: unidad elegida al añadir esa línea al pedido;
  vacío = se usa la Unidad del material como hasta ahora.

Uso: python scripts/migrar_unidad_pedido.py
"""
from base import conectar

conn = conectar()

with conn.cursor() as cur:
    cur.execute("""
        select table_name, column_name from information_schema.columns
        where table_schema = 'public' and table_name in ('material', 'lineas_pedido')
    """)
    existentes = {(row[0], row[1]) for row in cur.fetchall()}

with conn.cursor() as cur:
    if ('material', 'unidades_extra') in existentes:
        print("material.unidades_extra ya existía, no se toca")
    else:
        cur.execute("alter table material add column unidades_extra text")
        print("✓ material.unidades_extra añadida")

    if ('lineas_pedido', 'unidad') in existentes:
        print("lineas_pedido.unidad ya existía, no se toca")
    else:
        cur.execute("alter table lineas_pedido add column unidad text")
        print("✓ lineas_pedido.unidad añadida")

conn.commit()
conn.close()
print("\nMigración completada.")
