"""
actualizar_planes.py — Modificar planes de mantenimiento preventivo.
Puede cambiar: operacion, periodicidad, tipo_intervencion, instrucciones, activo.
Uso: ! python scripts/actualizar_planes.py
"""
import sys
sys.path.insert(0, 'scripts')
from base import conectar, leer, buscar_multi, buscar_contiene, actualizar_varios, preview_filas

# ===========================================================================
# CONFIGURACIÓN — Claude rellena esta sección cada vez
# ===========================================================================

# -- Filtro: qué planes modificar --
# Opción A: por ID de equipo
FILTRO = {'id_equipo': 'EQU-001'}

# Opción B: por ID de plan concreto (descomentar y ajustar)
# FILTRO = {'id_plan': 'PM0046'}

# Opción C: por tipo de intervención (descomentar y ajustar)
# FILTRO = {'tipo_intervencion': 'Calibración'}

# Opción D: búsqueda por texto en la operación (ver abajo, BUSCAR_TEXTO)
BUSCAR_TEXTO = None   # Ej: 'calibración' — busca en campo operacion

# -- Cambios a aplicar --
CAMBIOS = {
    'operacion': 'Nuevo texto de la operación',
    # 'periodicidad': 'Mensual',
    # 'tipo_intervencion': 'Limpieza',
    # 'instrucciones': 'Nuevas instrucciones detalladas...',
    # 'activo': True,
}

# ===========================================================================
# EJECUCIÓN — no tocar
# ===========================================================================

conn = conectar()
t, columnas, _ = leer(conn, 'planes_mantenimiento')

if BUSCAR_TEXTO:
    pks = buscar_contiene(t, 'operacion', BUSCAR_TEXTO)
else:
    pks = buscar_multi(t, FILTRO)

print(f"Planes encontrados: {len(pks)}")
preview_filas(t, pks, ['id_plan', 'id_equipo', 'operacion', 'periodicidad'])

if not pks:
    print("Nada que modificar.")
    sys.exit(0)

n = actualizar_varios(t, pks, CAMBIOS)
print(f"\n✅ {n} plan(es) actualizado(s).")

conn.close()
