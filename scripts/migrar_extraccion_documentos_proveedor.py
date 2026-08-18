"""
Migración puntual (2026-08-18): añade a documentos_proveedor las columnas
que necesita la lectura con IA de facturas/presupuestos subidos por el
proveedor (Edge Function leer-documento-proveedor):

- datos_extraidos jsonb: resultado completo (items detectados + matching
  contra las líneas del pedido), para no tener que volver a llamar a
  Gemini si se reabre el pedido.
- extraido_en timestamptz: null mientras no se ha leído con IA.

Uso: python scripts/migrar_extraccion_documentos_proveedor.py
"""
from base import conectar

conn = conectar()

with conn.cursor() as cur:
    cur.execute("""
        select column_name from information_schema.columns
        where table_schema = 'public' and table_name = 'documentos_proveedor'
    """)
    existentes = {row[0] for row in cur.fetchall()}

with conn.cursor() as cur:
    if 'datos_extraidos' in existentes:
        print("documentos_proveedor.datos_extraidos ya existía, no se toca")
    else:
        cur.execute("alter table documentos_proveedor add column datos_extraidos jsonb")
        print("✓ documentos_proveedor.datos_extraidos añadida")

    if 'extraido_en' in existentes:
        print("documentos_proveedor.extraido_en ya existía, no se toca")
    else:
        cur.execute("alter table documentos_proveedor add column extraido_en timestamptz")
        print("✓ documentos_proveedor.extraido_en añadida")

conn.commit()
conn.close()
print("\nMigración completada.")
