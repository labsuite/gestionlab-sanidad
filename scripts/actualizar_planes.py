"""
actualizar_planes.py — Modificar planes de mantenimiento preventivo.
Puede cambiar: Operacion, Periodicidad, Tipo_Intervencion, Instrucciones, Activo.
Uso: ! python scripts/actualizar_planes.py
"""
import sys
sys.path.insert(0, 'scripts')
from base import conectar, leer, buscar, buscar_multi, buscar_contiene, actualizar_varios, preview_filas

# ===========================================================================
# CONFIGURACIÓN — Claude rellena esta sección cada vez
# ===========================================================================

# -- Filtro: qué planes modificar --
# Opción A: por ID de equipo
FILTRO = {'ID_Equipo': 'EQU-001'}

# Opción B: por ID de plan concreto (descomentar y ajustar)
# FILTRO = {'ID_Plan': 'PM0046'}

# Opción C: por tipo de intervención (descomentar y ajustar)
# FILTRO = {'Tipo_Intervencion': 'Calibración'}

# Opción D: búsqueda por texto en la operación (ver abajo, BUSCAR_TEXTO)
BUSCAR_TEXTO = None   # Ej: 'calibración' — busca en campo Operacion

# -- Cambios a aplicar --
CAMBIOS = {
    'Operacion': 'Nuevo texto de la operación',
    # 'Periodicidad': 'Mensual',
    # 'Tipo_Intervencion': 'Limpieza',
    # 'Instrucciones': 'Nuevas instrucciones detalladas...',
    # 'Activo': 'Sí',
}

# ===========================================================================
# EJECUCIÓN — no tocar
# ===========================================================================

sh = conectar()
ws, headers, _ = leer(sh, 'Planes_Mantenimiento')

if BUSCAR_TEXTO:
    filas = buscar_contiene(ws, 'Operacion', BUSCAR_TEXTO, headers)
else:
    filas = buscar_multi(ws, FILTRO, headers)

print(f"Planes encontrados: {len(filas)}")
preview_filas(ws, filas, ['ID_Plan', 'ID_Equipo', 'Operacion', 'Periodicidad'], headers)

if not filas:
    print("Nada que modificar.")
    sys.exit(0)

n = actualizar_varios(ws, filas, CAMBIOS, headers)
print(f"\n✅ {n} plan(es) actualizado(s).")
