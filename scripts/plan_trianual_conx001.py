import sys
sys.path.insert(0, 'scripts')
from base import conectar, leer

sh = conectar()
ws_pl, headers_pl, _ = leer(sh, 'Planes_Mantenimiento')
datos = ws_pl.get_all_values()
nums = [int(r[headers_pl.index('ID_Plan')].replace('PM','')) for r in datos[1:] if r[headers_pl.index('ID_Plan')].startswith('PM') and r[headers_pl.index('ID_Plan')][2:].isdigit()]
siguiente_pm = f"PM{max(nums)+1:04d}"

ws_pl.append_row([
    siguiente_pm, 'CONX-001', 'Externo', 'Trianual',
    'Revisión técnica por servicio oficial: compresores, circuito de refrigerante y calibración del sensor de temperatura',
    'Sí', ''
], value_input_option='USER_ENTERED')
print(f"✅ Plan Trianual creado: {siguiente_pm}")
