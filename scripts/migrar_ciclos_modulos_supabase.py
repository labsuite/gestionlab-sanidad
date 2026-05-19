"""
Migra Ciclos_Modulos de Google Sheets a Supabase.
Crea los ciclos y módulos en las tablas correspondientes.
Los campos lab_teoria y lab_practicas se dejan vacíos — rellenar desde la nueva app.

Uso: python scripts/migrar_ciclos_modulos_supabase.py
"""
import requests
from base import conectar, leer

SUPABASE_URL  = 'https://clxcjsvkmaydpxvtqesv.supabase.co'
SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNseGNqc3ZrbWF5ZHB4dnRxZXN2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwNDI1OTEsImV4cCI6MjA5NDYxODU5MX0._uu-RO_AtA88mh3eC8oPBf7ikD2X5w-otl91pHSJ7GA'

HEADERS = {
    'apikey': SUPABASE_ANON,
    'Authorization': f'Bearer {SUPABASE_ANON}',
    'Content-Type': 'application/json',
}

def sb_get(tabla, select='*'):
    r = requests.get(f'{SUPABASE_URL}/rest/v1/{tabla}?select={select}', headers=HEADERS)
    r.raise_for_status()
    return r.json()

def sb_insert(tabla, datos):
    r = requests.post(
        f'{SUPABASE_URL}/rest/v1/{tabla}',
        json=datos,
        headers={**HEADERS, 'Prefer': 'return=representation'}
    )
    r.raise_for_status()
    return r.json()

# ── Leer Ciclos_Modulos de Sheets ──────────────────────────────
print('Conectando a Google Sheets...')
sh = conectar()
_, _, filas = leer(sh, 'Ciclos_Modulos')

# Propagar ciclo hacia abajo (celdas vacías heredan el anterior)
datos = []
ultimo_ciclo = ''
for fila in filas:
    ciclo  = fila[0].strip() if fila and fila[0].strip() else ultimo_ciclo
    modulo = fila[1].strip() if len(fila) > 1 else ''
    if ciclo: ultimo_ciclo = ciclo
    if ciclo and modulo:
        datos.append((ciclo, modulo))

ciclos_unicos = sorted(set(c for c, _ in datos))
print(f'{len(datos)} pares ciclo-módulo, {len(ciclos_unicos)} ciclos únicos.')

# ── Insertar ciclos ────────────────────────────────────────────
print('\nInsertando ciclos...')
existentes = {c['nombre']: c['id'] for c in sb_get('ciclos', 'id,nombre')}

for nombre in ciclos_unicos:
    if nombre in existentes:
        print(f'  [ya existe] {nombre}')
        continue
    result = sb_insert('ciclos', {'nombre': nombre})
    existentes[nombre] = result[0]['id']
    print(f'  ✓ {nombre}')

# ── Insertar módulos ───────────────────────────────────────────
print('\nInsertando módulos...')
existentes_mod = {
    (m['nombre'], m['ciclo_id'])
    for m in sb_get('modulos', 'nombre,ciclo_id')
}

insertados = 0
for ciclo, modulo in datos:
    ciclo_id = existentes.get(ciclo)
    if not ciclo_id:
        print(f'  [sin ciclo_id] {ciclo}')
        continue
    if (modulo, ciclo_id) in existentes_mod:
        continue
    sb_insert('modulos', {'nombre': modulo, 'ciclo_id': ciclo_id})
    existentes_mod.add((modulo, ciclo_id))
    insertados += 1

print(f'\n✓ Migración completada: {insertados} módulos insertados.')
print('Recuerda rellenar lab_teoria y lab_practicas para cada módulo desde la app de gestión.')
