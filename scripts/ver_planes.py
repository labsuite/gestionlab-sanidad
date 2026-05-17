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

planes_ws = sh.worksheet('Planes_Mantenimiento')
planes = planes_ws.get_all_records()

ids_buscar = ['pHm-01', 'pHm-02', 'INC-01']

for equipo_id in ids_buscar:
    print(f"\n=== PLANES DE {equipo_id} ===")
    encontrados = [p for p in planes if str(p.get('ID_Equipo','')) == equipo_id]
    if not encontrados:
        print("  (sin planes)")
    for p in encontrados:
        print(f"  ID_Plan: {p['ID_Plan']} | Tipo: {p['Tipo_Intervencion']} | Periodicidad: {p['Periodicidad']} | Operacion: {p['Operacion']}")
