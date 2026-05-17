"""
nuevo_residuo.py — Añadir nuevos tipos de residuo a Tipos_Residuo.
Uso: ! python scripts/nuevo_residuo.py
"""
import sys
sys.path.insert(0, 'scripts')
from base import conectar, leer, siguiente_id, insertar_varios

# ===========================================================================
# CONFIGURACIÓN — Claude rellena esta sección cada vez
# ===========================================================================

NUEVOS_RESIDUOS = [
    {
        # Nombre corto que aparece en la guía
        'Nombre': 'Ejemplo: Ácido clorhídrico concentrado',
        # Descripción para que el alumno lo reconozca
        'Descripcion': 'Ejemplo: Líquido corrosivo incoloro con olor fuerte y sofocante.',
        # Alto / Medio / Bajo
        'Riesgo': 'Alto',
        # Nombre del tipo de contenedor (debe coincidir con uno existente o crear uno nuevo)
        'Contenedor_Tipo': 'Ejemplo: Bidón azul',
    },
    # Añadir más bloques si se insertan varios a la vez
]

# ===========================================================================
# EJECUCIÓN — no tocar
# ===========================================================================

sh = conectar()
ws, headers, _ = leer(sh, 'Tipos_Residuo')

filas_nuevas = []
for r in NUEVOS_RESIDUOS:
    nuevo_id = siguiente_id(ws, 'ID_Residuo', 'RES')
    fila = {
        'ID_Residuo':     nuevo_id,
        'Nombre':         r['Nombre'],
        'Descripcion':    r['Descripcion'],
        'Riesgo':         r['Riesgo'],
        'Contenedor_Tipo': r['Contenedor_Tipo'],
        'Lab':            '',
        'Zona':           '',
    }
    filas_nuevas.append(fila)
    # Reservar el ID para el siguiente del lote
    ws.append_row([nuevo_id] + [''] * (len(headers) - 1), value_input_option='USER_ENTERED')
    print(f"  ✓ {nuevo_id} — {r['Nombre']}")

print(f"\n✅ {len(filas_nuevas)} tipo(s) de residuo añadido(s).")
print("Recuerda verificar en Sheets que el Contenedor_Tipo coincide con los existentes.")
