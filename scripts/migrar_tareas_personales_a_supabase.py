"""
Migración puntual: copia Tareas_Usuario (recordatorios personales) de Google
Sheets a la tabla tareas_personales ya existente en el proyecto Supabase de
migración (vnoecaqldymonkgrmvlj). Conexión directa por psycopg2 (pooler).

Lee por POSICIÓN, igual que sheetsGet('Tareas_Usuario!A2:F') en la app.

Uso: python scripts/migrar_tareas_personales_a_supabase.py
"""
import json
import sys
import psycopg2
from base import conectar

sys.stdout.reconfigure(encoding='utf-8')

with open('scripts/supabase_credentials.json', encoding='utf-8') as f:
    CREDS = json.load(f)

def conectar_pg():
    return psycopg2.connect(
        host=CREDS['pooler_host'], port=CREDS['pooler_port'],
        user=CREDS['pooler_user'], password=CREDS['db_password'],
        dbname='postgres', sslmode='require',
    )

def nn(v):
    v = (v or '').strip()
    return v if v else None

print('Conectando a Google Sheets...')
sh = conectar()
ws = sh.worksheet('Tareas_Usuario')
filas = [(f + [''] * 6)[:6] for f in ws.get_all_values()[1:] if any(c.strip() for c in f)]
print(f'{len(filas)} tareas encontradas')

print('\nConectando a Supabase (Postgres)...')
conn = conectar_pg()
cur = conn.cursor()

for r in filas:
    id_tarea, email, texto, fecha_limite, completada, fecha_creacion = r
    cur.execute("""
        insert into tareas_personales (id_tarea, email, texto, fecha_limite, completada, fecha_creacion)
        values (%s, %s, %s, %s, %s, %s)
        on conflict (id_tarea) do nothing
    """, (id_tarea, email, texto, nn(fecha_limite), (completada or '').strip().lower() == 'true', nn(fecha_creacion)))

conn.commit()
cur.execute("select count(*) from tareas_personales")
print(f'  tareas_personales: {cur.fetchone()[0]} filas en Supabase')

cur.close()
conn.close()
print('\n✓ Migración completada.')
