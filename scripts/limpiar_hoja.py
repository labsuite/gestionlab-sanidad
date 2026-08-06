"""
limpiar_hoja.py — Eliminar registros de cualquier tabla de Supabase.
Sirve para: incidencias, solicitudes, movimientos, intervenciones, tareas_personales,
            consultas_residuo, adiciones_residuo, registro_mantenimientos, etc.
Uso: ! python scripts/limpiar_hoja.py
"""
import sys
sys.path.insert(0, 'scripts')
from base import conectar, leer, buscar, buscar_multi, buscar_contiene, todas_las_filas, eliminar, eliminar_todas, preview_filas

# ===========================================================================
# CONFIGURACIÓN — Claude rellena esta sección cada vez
# ===========================================================================

# Tabla a limpiar
TABLA = 'consultas_residuo'

# Modo de selección de filas a eliminar:
#   'todas'      → elimina todas las filas (limpieza total)
#   'filtro'     → elimina las filas que coincidan con FILTRO
#   'contiene'   → elimina las filas donde CAMPO_TEXTO contiene TEXTO

MODO = 'filtro'

# Para MODO 'filtro': dict con uno o varios campos exactos
FILTRO = {'estado': 'Resuelta'}

# Para MODO 'contiene': campo y texto a buscar
CAMPO_TEXTO = 'observaciones'
TEXTO = 'curso 2023-2024'

# Columnas que se mostrarán en el preview antes de borrar
PREVIEW_CAMPOS = ['id_consulta', 'fecha', 'estado', 'descripcion']

# Poner en False para ejecutar de verdad; True solo muestra qué se borraría
DRY_RUN = True

# ===========================================================================
# EJECUCIÓN — no tocar
# ===========================================================================

conn = conectar()
t, columnas, _ = leer(conn, TABLA)

if MODO == 'todas':
    pks = todas_las_filas(t)
elif MODO == 'filtro':
    pks = buscar_multi(t, FILTRO)
elif MODO == 'contiene':
    pks = buscar_contiene(t, CAMPO_TEXTO, TEXTO)
else:
    print(f"⚠ MODO '{MODO}' no reconocido. Usa 'todas', 'filtro' o 'contiene'.")
    sys.exit(1)

print(f"Filas seleccionadas en '{TABLA}': {len(pks)}")
campos_preview = [c for c in PREVIEW_CAMPOS if c in columnas]
preview_filas(t, pks, campos_preview)

if not pks:
    print("Nada que eliminar.")
    sys.exit(0)

if DRY_RUN:
    print(f"\n🔍 DRY_RUN activado — no se ha eliminado nada.")
    print(f"   Cambia DRY_RUN = False para ejecutar el borrado real.")
else:
    if MODO == 'todas':
        n = eliminar_todas(t)
    else:
        n = eliminar(t, pks)
    print(f"\n✅ {n} fila(s) eliminada(s) de '{TABLA}'.")

conn.close()
