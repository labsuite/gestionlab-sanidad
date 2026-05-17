import sys
sys.path.insert(0, 'scripts')
from base import conectar, leer, buscar, actualizar, actualizar_varios

sh = conectar()

# --- 1. Protocolo CAB-03 ---
ws_eq, headers_eq, _ = leer(sh, 'Equipos')

PROTOCOLO = (
    "Antes de empezar: limpiar la superficie de trabajo, paredes laterales y bandeja con etanol 70%. "
    "Encender el ventilador; la propia cabina avisa cuando el flujo de aire es estable. "
    "Es normal que emita pitidos al subir la ventana, encender el aire o bajarla — se silencian pulsando la tecla A.\n"
    "Durante el trabajo: mantenerse siempre dentro de la zona protegida sin bloquear la rejilla frontal. "
    "Si es necesario abandonar el puesto, <strong>NO bajar la ventana</strong>: "
    "la zona estéril solo existe mientras hay flujo; dejar el ventilador encendido y, "
    "si se quiere ahorrar energía, apagar la luz.\n"
    "Al finalizar: limpiar toda la superficie con etanol 70%. "
    "Bajar la ventana completamente. "
    "Apagar el ventilador. "
    "Encender la luz UV durante 15 minutos. "
    "Al terminar, apagar la UV y desenchufar la cabina."
)

filas = buscar(ws_eq, 'ID_Activo', 'CAB-03', headers_eq)
n = actualizar(ws_eq, filas, 'Protocolo_Uso', PROTOCOLO, headers_eq)
print(f"✅ Protocolo CAB-03 actualizado ({n} fila)")

# --- 2. Actualizar planes existentes ---
ws_pl, headers_pl, _ = leer(sh, 'Planes_Mantenimiento')

# PM0125: mensual → trimestral, inspección visual lámpara UV
filas_125 = buscar(ws_pl, 'ID_Plan', 'PM0125', headers_pl)
actualizar_varios(ws_pl, filas_125, {
    'Periodicidad': 'Trimestral',
    'Operacion': (
        'Inspección visual de la lámpara UV: comprobar que no presenta oscurecimiento en los extremos ni reducción del brillo.'
    ),
}, headers_pl)
print("✅ PM0125 actualizado (trimestral — inspección lámpara UV)")

# PM0126: bianual → anual, certificación sin sustitución de lámpara
filas_126 = buscar(ws_pl, 'ID_Plan', 'PM0126', headers_pl)
actualizar_varios(ws_pl, filas_126, {
    'Periodicidad': 'Anual',
    'Operacion': (
        'Certificación por empresa acreditada: prueba de integridad del filtro HEPA (test PAO), '
        'verificación de velocidad de flujo de entrada y de bajada, '
        'prueba de presión estática y comprobación de alarmas.'
    )
}, headers_pl)
print("✅ PM0126 actualizado (anual — certificación)")

# --- 3. Nuevo plan semestral ---
datos_pl = ws_pl.get_all_values()
nums = [int(r[headers_pl.index('ID_Plan')].replace('PM','')) for r in datos_pl[1:]
        if r[headers_pl.index('ID_Plan')].startswith('PM') and r[headers_pl.index('ID_Plan')][2:].isdigit()]
siguiente_pm = f"PM{max(nums)+1:04d}"

ws_pl.append_row([
    siguiente_pm, 'CAB-03', 'Interno', 'Semestral',
    'Verificar el indicador de estado del filtro HEPA en el panel de control digital. '
    'Limpiar el exterior de la cabina y la rejilla frontal con paño humedecido en etanol 70%, pasando de dentro hacia fuera.',
    'Sí', ''
], value_input_option='USER_ENTERED')
print(f"✅ Plan semestral creado: {siguiente_pm}")

# Plan trianual: sustitución de lámpara UV
datos_pl2 = ws_pl.get_all_values()
nums2 = [int(r[headers_pl.index('ID_Plan')].replace('PM','')) for r in datos_pl2[1:]
         if r[headers_pl.index('ID_Plan')].startswith('PM') and r[headers_pl.index('ID_Plan')][2:].isdigit()]
pm_trianual = f"PM{max(nums2)+1:04d}"

ws_pl.append_row([
    pm_trianual, 'CAB-03', 'Interno', 'Trianual',
    'Sustitución de la lámpara UV.',
    'Sí', ''
], value_input_option='USER_ENTERED')
print(f"✅ Plan trianual creado: {pm_trianual} (sustitución lámpara UV)")
