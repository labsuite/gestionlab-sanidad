"""
limpiar_hoja.py — Eliminar registros de cualquier hoja de la base de datos.
Sirve para: Incidencias, Solicitudes, Movimientos, Intervenciones, Tareas_Usuario,
            Consultas_Residuo, Adiciones_Residuo, Registro_Mantenimientos, etc.
Uso: ! python scripts/limpiar_hoja.py
"""
import sys
sys.path.insert(0, 'scripts')
from base import conectar, leer, buscar, buscar_multi, buscar_contiene, todas_las_filas, eliminar, eliminar_todas, preview_filas

# ===========================================================================
# CONFIGURACIÓN — Claude rellena esta sección cada vez
# ===========================================================================

# Hoja a limpiar
HOJA = 'Consultas_Residuo'

# Modo de selección de filas a eliminar:
#   'todas'      → elimina todas las filas de datos (limpieza total)
#   'filtro'     → elimina las filas que coincidan con FILTRO
#   'contiene'   → elimina las filas donde CAMPO_TEXTO contiene TEXTO

MODO = 'filtro'

# Para MODO 'filtro': dict con uno o varios campos exactos
FILTRO = {'Estado': 'Resuelta'}

# Para MODO 'contiene': campo y texto a buscar
CAMPO_TEXTO = 'Observaciones'
TEXTO = 'curso 2023-2024'

# Columnas que se mostrarán en el preview antes de borrar
PREVIEW_CAMPOS = ['ID_Consulta', 'Fecha', 'Estado', 'Descripcion']

# Poner en False para ejecutar de verdad; True solo muestra qué se borraría
DRY_RUN = True

# ===========================================================================
# EJECUCIÓN — no tocar
# ===========================================================================

sh = conectar()
ws, headers, _ = leer(sh, HOJA)

if MODO == 'todas':
    filas = todas_las_filas(ws)
elif MODO == 'filtro':
    filas = buscar_multi(ws, FILTRO, headers)
elif MODO == 'contiene':
    filas = buscar_contiene(ws, CAMPO_TEXTO, TEXTO, headers)
else:
    print(f"⚠ MODO '{MODO}' no reconocido. Usa 'todas', 'filtro' o 'contiene'.")
    sys.exit(1)

print(f"Filas seleccionadas en '{HOJA}': {len(filas)}")
campos_preview = [c for c in PREVIEW_CAMPOS if c in headers]
preview_filas(ws, filas, campos_preview, headers)

if not filas:
    print("Nada que eliminar.")
    sys.exit(0)

if DRY_RUN:
    print(f"\n🔍 DRY_RUN activado — no se ha eliminado nada.")
    print(f"   Cambia DRY_RUN = False para ejecutar el borrado real.")
else:
    if MODO == 'todas':
        n = eliminar_todas(ws)
    else:
        n = eliminar(ws, filas)
    print(f"\n✅ {n} fila(s) eliminada(s) de '{HOJA}'.")
