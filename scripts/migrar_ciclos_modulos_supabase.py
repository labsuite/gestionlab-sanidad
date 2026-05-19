"""
Migra Ciclos_Modulos de Google Sheets a Supabase.
Usa la tabla pivot modulo_ciclo (muchos-a-muchos), que ya existe en Supabase.
Los campos lab_teoria y lab_practicas quedan vacíos — rellenar desde la nueva app.

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
    r = requests.get(f'{SUPABASE_URL}/rest/v1/{tabla}?select={select}&limit=1000', headers=HEADERS)
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
pares = []
ultimo_ciclo = ''
for fila in filas:
    ciclo  = str(fila.get('Ciclos',  fila.get('Ciclo',  '')) or '').strip()
    modulo = str(fila.get('Modulos', fila.get('Modulo', '')) or '').strip()
    if ciclo: ultimo_ciclo = ciclo
    else: ciclo = ultimo_ciclo
    if ciclo and modulo:
        pares.append((ciclo, modulo))

ciclos_unicos  = sorted(set(c for c, _ in pares))
modulos_unicos = sorted(set(m for _, m in pares))
print(f'{len(pares)} pares ciclo-módulo | {len(ciclos_unicos)} ciclos | {len(modulos_unicos)} módulos únicos')

# ── Leer estado actual de Supabase ─────────────────────────────
existentes_ciclos  = {c['nombre']: c['id'] for c in sb_get('ciclos',  'id,nombre')}
existentes_modulos = {m['nombre']: m['id'] for m in sb_get('modulos', 'id,nombre')}
existentes_pivot   = {(r['ciclo_id'], r['modulo_id']) for r in sb_get('modulo_ciclo', 'ciclo_id,modulo_id')}

# ── Insertar ciclos nuevos ─────────────────────────────────────
print('\nInsertando ciclos...')
for nombre in ciclos_unicos:
    if nombre in existentes_ciclos:
        print(f'  [existe] {nombre}')
        continue
    result = sb_insert('ciclos', {'nombre': nombre})
    existentes_ciclos[nombre] = result[0]['id']
    print(f'  ✓ {nombre}')

# ── Insertar módulos nuevos ────────────────────────────────────
print('\nInsertando módulos...')
for nombre in modulos_unicos:
    if nombre in existentes_modulos:
        continue
    result = sb_insert('modulos', {'nombre': nombre})
    existentes_modulos[nombre] = result[0]['id']
    print(f'  ✓ {nombre}')

# ── Insertar relaciones en modulo_ciclo ───────────────────────
print('\nInsertando relaciones ciclo-módulo...')
insertados = 0
for ciclo, modulo in pares:
    ciclo_id  = existentes_ciclos.get(ciclo)
    modulo_id = existentes_modulos.get(modulo)
    if not ciclo_id or not modulo_id:
        print(f'  [sin ID] {ciclo} / {modulo}')
        continue
    if (ciclo_id, modulo_id) in existentes_pivot:
        continue
    sb_insert('modulo_ciclo', {'ciclo_id': ciclo_id, 'modulo_id': modulo_id})
    existentes_pivot.add((ciclo_id, modulo_id))
    insertados += 1

print(f'\n✓ Migración completada: {insertados} relaciones insertadas.')
print('Recuerda rellenar lab_teoria y lab_practicas para cada módulo desde la app de gestión.')
