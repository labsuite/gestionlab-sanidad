import sys
import gspread
from google.oauth2.service_account import Credentials

sys.stdout.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8')

SHEET_ID = '1YeoIPn3UqvcljptbgJIX-1CdrDLwIiT_3vcOy8k2Acg'
CREDENTIALS_FILE = 'scripts/credentials.json'

scopes = [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive',
]

creds = Credentials.from_service_account_file(CREDENTIALS_FILE, scopes=scopes)
gc = gspread.authorize(creds)
sh = gc.open_by_key(SHEET_ID)

# --- Equipos relevantes ---
equipos_ws = sh.worksheet('Equipos')
equipos = equipos_ws.get_all_records()

keywords = ['phm', 'p h', 'micropipeta', 'inc-01']
print("=== EQUIPOS RELEVANTES ===")
for eq in equipos:
    nombre = (str(eq.get('Tipo_Equipo','')) + ' ' + str(eq.get('Modelo','')) + ' ' + str(eq.get('ID_Activo',''))).lower()
    if any(k in nombre for k in keywords):
        print(f"ID: {eq['ID_Activo']} | Tipo: {eq['Tipo_Equipo']} | Modelo: {eq.get('Modelo','')} | Serie: {eq.get('Numero_Serie','')}")
        print(f"   Protocolo_Uso: {str(eq.get('Protocolo_Uso','(vacío)'))}")
        print()

# --- Planes de mantenimiento para esos equipos ---
planes_ws = sh.worksheet('Planes_Mantenimiento')
planes = planes_ws.get_all_records()

ids_phmetro = [eq['ID_Activo'] for eq in equipos if 'ph' in (str(eq.get('Tipo_Equipo','')) + ' ' + str(eq.get('Modelo',''))).lower()]
ids_inc01 = [eq['ID_Activo'] for eq in equipos if 'inc-01' in str(eq.get('ID_Activo','')).lower()]

print("=== PLANES DE MANTENIMIENTO – pH METROS ===")
for p in planes:
    if p.get('ID_Equipo') in ids_phmetro:
        print(f"ID_Plan: {p['ID_Plan']} | Equipo: {p['ID_Equipo']} | Tipo: {p['Tipo_Intervencion']} | Period.: {p['Periodicidad']} | Op: {p['Operacion']}")

print()
print("=== PLANES DE MANTENIMIENTO – INC-01 ===")
for p in planes:
    if p.get('ID_Equipo') in ids_inc01:
        print(f"ID_Plan: {p['ID_Plan']} | Equipo: {p['ID_Equipo']} | Tipo: {p['Tipo_Intervencion']} | Period.: {p['Periodicidad']} | Op: {p['Operacion']}")
