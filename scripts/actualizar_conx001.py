import sys
sys.path.insert(0, 'scripts')
from base import conectar, leer, buscar, actualizar, buscar_multi, actualizar_varios

sh = conectar()

# --- 1. Protocolo CONX-001 ---
ws_eq, headers_eq, _ = leer(sh, 'Equipos')

PROTOCOLO = (
    "Verificar la temperatura diariamente en el display (rango normal: -38 °C a -42 °C). "
    "Cada usuario debe utilizar su cajón asignado para almacenar sus muestras. "
    "No mantener la puerta abierta más del tiempo imprescindible. "
    "Etiquetar todas las muestras con contenido, fecha y usuario antes de introducirlas. "
    "No almacenar muestras inflamables. "
    "Ante cualquier alarma de temperatura, avisar inmediatamente a la gestora y trasladar "
    "las muestras a otro equipo de frío si la temperatura supera -30 °C."
)

filas = buscar(ws_eq, 'ID_Activo', 'CONX-001', headers_eq)
n = actualizar(ws_eq, filas, 'Protocolo_Uso', PROTOCOLO, headers_eq)
print(f"✅ Protocolo CONX-001 actualizado ({n} fila)")

# --- 2. Actualizar PM0097 ---
ws_pl, headers_pl, _ = leer(sh, 'Planes_Mantenimiento')

filas_pm = buscar(ws_pl, 'ID_Plan', 'PM0097', headers_pl)
n = actualizar(ws_pl, filas_pm, 'Operacion',
    'Descongelación completa y limpieza interior. Trasladar previamente todas las muestras a otro equipo de frío. Revisión del burlete de la puerta.',
    headers_pl)
print(f"✅ PM0097 actualizado ({n} fila)")

# --- 3. Plan mensual nuevo ---
datos_pl = ws_pl.get_all_values()
ids_plan = [row[headers_pl.index('ID_Plan')] for row in datos_pl[1:]]
nums = [int(p.replace('PM','')) for p in ids_plan if p.startswith('PM') and p[2:].isdigit()]
siguiente_pm = f"PM{max(nums)+1:04d}"

ws_pl.append_row([
    siguiente_pm, 'CONX-001', 'Interno', 'Mensual',
    'Verificación del estado del burlete de la puerta; comprobación del sistema de alarmas de temperatura',
    'Sí', ''
], value_input_option='USER_ENTERED')
print(f"✅ Plan mensual creado: {siguiente_pm}")
