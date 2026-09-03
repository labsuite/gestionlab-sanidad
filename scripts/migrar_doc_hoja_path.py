"""
Migración puntual (2026-09-03): añade a pedidos la columna

- doc_hoja_path text: ruta en Storage (bucket "documentos", carpeta
  documentos-generados/<id_pedido>/) de la ÚLTIMA folla de pedido generada.
  Se reemplaza en cada regeneración — subir-documento borra la anterior
  antes de subir la nueva. Sirve para poder reabrir la hoja desde la
  ficha del pedido ("Documentación interna"), no solo justo tras generarla.

Uso: python scripts/migrar_doc_hoja_path.py
"""
from base import conectar

conn = conectar()

with conn.cursor() as cur:
    cur.execute("""
        select column_name from information_schema.columns
        where table_schema = 'public' and table_name = 'pedidos'
    """)
    existentes = {row[0] for row in cur.fetchall()}

with conn.cursor() as cur:
    if 'doc_hoja_path' in existentes:
        print("pedidos.doc_hoja_path ya existía, no se toca")
    else:
        cur.execute("alter table pedidos add column doc_hoja_path text")
        print("✓ pedidos.doc_hoja_path añadida")

conn.commit()
conn.close()
print("\nMigración completada.")
