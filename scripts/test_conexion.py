"""
test_conexion.py — Verifica que la conexión con Supabase (Postgres) funciona.
Uso: ! python scripts/test_conexion.py
"""
import sys
sys.path.insert(0, 'scripts')
from base import conectar

conn = conectar()
with conn.cursor() as cur:
    cur.execute("select tablename from pg_tables where schemaname = 'public' order by tablename")
    tablas = [r[0] for r in cur.fetchall()]
conn.close()

print("✅ Conexión correcta. Tablas encontradas:")
for t in tablas:
    print(f"  - {t}")
