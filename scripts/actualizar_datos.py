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

# ---------------------------------------------------------------
# 1. MICROPIPETAS: añadir instrucción de guardado al protocolo
# ---------------------------------------------------------------
equipos_ws = sh.worksheet('Equipos')
equipos_data = equipos_ws.get_all_values()
headers = equipos_data[0]
col_id = headers.index('ID_Activo')
col_tipo = headers.index('Tipo_Equipo')
col_protocolo = headers.index('Protocolo_Uso')

INSTRUCCION = "Guardar siempre ajustada al volumen superior del rango al finalizar el uso."
ANTES_DE = "Calibrar según el plan de mantenimiento."

print("=== 1. MICROPIPETAS ===")
pip_count = 0
batch_pip = []
for i, row in enumerate(equipos_data[1:], start=2):
    tipo = str(row[col_tipo]).lower()
    protocolo = str(row[col_protocolo])
    equipo_id = str(row[col_id])

    if 'micropipeta' not in tipo:
        continue

    if INSTRUCCION in protocolo:
        continue  # ya está correcto

    if 'Guardar ajustada al volumen superior.' in protocolo:
        # Normalizar PIP-068 al texto estándar
        nuevo = protocolo.replace('Guardar ajustada al volumen superior.', INSTRUCCION)
    elif ANTES_DE in protocolo:
        nuevo = protocolo.replace(ANTES_DE, INSTRUCCION + ' ' + ANTES_DE)
    else:
        # Multicanal u otros sin "Calibrar...": añadir al final
        nuevo = protocolo.rstrip() + ' ' + INSTRUCCION

    col_letra = chr(ord('A') + col_protocolo)
    batch_pip.append({'range': f'{col_letra}{i}', 'values': [[nuevo]]})
    print(f"  · {equipo_id} preparado")
    pip_count += 1

if batch_pip:
    equipos_ws.batch_update(batch_pip)
print(f"  Total micropipetas actualizadas: {pip_count}")

# ---------------------------------------------------------------
# 2. INC-01: actualizar protocolo de uso
# ---------------------------------------------------------------
PROTOCOLO_INC01 = (
    "Verificar temperatura (37 °C) y nivel de CO₂ (5 %) en el display antes de introducir cultivos. "
    "Comprobar que la bandeja de agua está llena con agua estéril o destilada. "
    "Manipular el interior con guantes y en condiciones de esterilidad; no introducir materiales sin descontaminar. "
    "Registrar temperatura y CO₂ diariamente en el cuaderno de incubadora. "
    "Abrir la puerta el mínimo tiempo necesario para mantener la estabilidad del ambiente. "
    "Ante cualquier alarma de temperatura o CO₂, avisar inmediatamente a la gestora."
)

print("\n=== 2. INC-01 PROTOCOLO ===")
for i, row in enumerate(equipos_data[1:], start=2):
    if str(row[col_id]) == 'INC-01':
        equipos_ws.update_cell(i, col_protocolo + 1, PROTOCOLO_INC01)
        print(f"  ✓ INC-01 protocolo actualizado (fila {i})")
        break

# ---------------------------------------------------------------
# 3. PLANES DE MANTENIMIENTO
# ---------------------------------------------------------------
planes_ws = sh.worksheet('Planes_Mantenimiento')
planes_data = planes_ws.get_all_values()
ph = planes_data[0]
col_plan_id = ph.index('ID_Plan')
col_operacion = ph.index('Operacion')

print("\n=== 3. PLANES DE MANTENIMIENTO ===")

cambios_planes = {
    # pHmetros: sustituir calibración mensual por mantenimiento real del electrodo
    'PM0046': "Cambio de solución de almacenamiento del electrodo; inspección visual del bulbo y verificación del nivel de KCl",
    'PM0171': "Cambio de solución de almacenamiento del electrodo; inspección visual del bulbo y verificación del nivel de KCl",
    # INC-01: adaptar mantenimiento semestral a incubadora de CO₂ para cultivos de mamífero
    'PM0115': (
        "Limpieza completa del interior con etanol 70 % y luz UV; "
        "verificación y calibración de temperatura y CO₂; "
        "cambio del agua de la bandeja humidificadora con agua estéril; "
        "inspección del filtro HEPA"
    ),
}

col_letra_op = chr(ord('A') + col_operacion)
batch_planes = []
for i, row in enumerate(planes_data[1:], start=2):
    plan_id = str(row[col_plan_id])
    if plan_id in cambios_planes:
        batch_planes.append({'range': f'{col_letra_op}{i}', 'values': [[cambios_planes[plan_id]]]})
        print(f"  · {plan_id} preparado")

if batch_planes:
    planes_ws.batch_update(batch_planes)
    print(f"  ✓ {len(batch_planes)} planes actualizados")

print("\n¡Todas las actualizaciones completadas!")
