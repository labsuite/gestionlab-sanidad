"""
Migración puntual: copia Tipos_Residuo, Contenedores_Residuo, Adiciones_Residuo
y Consultas_Residuo de Google Sheets a las tablas ya existentes en el proyecto
Supabase de migración (vnoecaqldymonkgrmvlj). Conexión directa por psycopg2
(pooler), bypassa RLS — mismo patrón usado en las migraciones anteriores.

Lee por POSICIÓN (igual que sheetsGet en la app), no por cabecera de texto,
porque los headers reales de las hojas pueden estar desalineados con COLS.

Uso: python scripts/migrar_residuos_a_supabase.py
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

def filas_hoja(sh, nombre, ncols):
    ws = sh.worksheet(nombre)
    valores = ws.get_all_values()[1:]  # sin cabecera
    return [ (fila + [''] * ncols)[:ncols] for fila in valores if any(c.strip() for c in fila) ]

def nn(v):
    """None si está vacío, si no el string tal cual (para columnas opcionales)."""
    v = (v or '').strip()
    return v if v else None

print('Conectando a Google Sheets...')
sh = conectar()

tipos        = filas_hoja(sh, 'Tipos_Residuo', 7)
contenedores = filas_hoja(sh, 'Contenedores_Residuo', 11)
adiciones    = filas_hoja(sh, 'Adiciones_Residuo', 6)
consultas    = filas_hoja(sh, 'Consultas_Residuo', 6)

print(f'{len(tipos)} tipos de residuo | {len(contenedores)} contenedores | '
      f'{len(adiciones)} adiciones | {len(consultas)} consultas')

print('\nConectando a Supabase (Postgres)...')
conn = conectar_pg()
cur = conn.cursor()

print('Insertando tipos_residuo...')
for r in tipos:
    id_residuo, nombre, descripcion, riesgo, contenedor_tipo, lab, zona = r
    cur.execute("""
        insert into tipos_residuo (id_residuo, nombre, descripcion, riesgo, contenedor_tipo, lab, zona)
        values (%s, %s, %s, %s, %s, %s, %s)
        on conflict (id_residuo) do nothing
    """, (id_residuo, nombre, nn(descripcion), nn(riesgo), nn(contenedor_tipo), nn(lab), nn(zona)))

print('Insertando contenedores_residuo...')
for r in contenedores:
    (id_contenedor, categoria, lab, zona, nivel, estado, fecha_apertura,
     fecha_cierre, fecha_actualizacion, actualizado_por, formato) = r
    cur.execute("""
        insert into contenedores_residuo
            (id_contenedor, categoria, lab, zona, nivel, estado,
             fecha_apertura, fecha_cierre, fecha_actualizacion, actualizado_por, formato)
        values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        on conflict (id_contenedor) do nothing
    """, (id_contenedor, categoria, nn(lab), nn(zona), nn(nivel), estado or 'activo',
          nn(fecha_apertura), nn(fecha_cierre), nn(fecha_actualizacion), nn(actualizado_por), nn(formato)))

print('Insertando adiciones_residuo...')
saltadas_adic = 0
for r in adiciones:
    id_adicion, id_contenedor, id_residuo, fecha, usuario, observaciones = r
    cur.execute("select 1 from contenedores_residuo where id_contenedor=%s", (id_contenedor,))
    if not cur.fetchone():
        saltadas_adic += 1
        continue
    cur.execute("select 1 from tipos_residuo where id_residuo=%s", (id_residuo,))
    if not cur.fetchone():
        saltadas_adic += 1
        continue
    cur.execute("""
        insert into adiciones_residuo (id_adicion, id_contenedor, id_residuo, fecha, usuario, observaciones)
        values (%s, %s, %s, %s, %s, %s)
        on conflict (id_adicion) do nothing
    """, (id_adicion, id_contenedor, id_residuo, nn(fecha), nn(usuario), nn(observaciones)))

print('Insertando consultas_residuo...')
for r in consultas:
    id_consulta, fecha, usuario, descripcion, ubicacion_dejado, estado = r
    cur.execute("""
        insert into consultas_residuo (id_consulta, fecha, usuario, descripcion, ubicacion_dejado, estado)
        values (%s, %s, %s, %s, %s, %s)
        on conflict (id_consulta) do nothing
    """, (id_consulta, nn(fecha), nn(usuario), descripcion, nn(ubicacion_dejado), estado or 'Pendiente'))

conn.commit()

for tabla in ['tipos_residuo', 'contenedores_residuo', 'adiciones_residuo', 'consultas_residuo']:
    cur.execute(f"select count(*) from {tabla}")
    print(f'  {tabla}: {cur.fetchone()[0]} filas en Supabase')
if saltadas_adic:
    print(f'\n⚠ {saltadas_adic} adiciones huérfanas (contenedor o tipo inexistente) descartadas.')

cur.close()
conn.close()
print('\n✓ Migración completada.')
