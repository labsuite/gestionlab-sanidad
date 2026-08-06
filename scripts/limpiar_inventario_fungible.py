"""
limpiar_inventario_fungible.py
Borra todos los datos de prueba del módulo de material fungible.
DRY_RUN = True  →  solo muestra lo que se borraría (sin tocar nada)
DRY_RUN = False →  borra de verdad
"""
import sys
sys.path.insert(0, '.')
from scripts.base import conectar, leer, eliminar_todas

# ── CONFIGURACIÓN ────────────────────────────────────────────────
DRY_RUN = True  # cambiar a False para ejecutar de verdad

TABLAS = [
    'material',
    'movimientos',
    'material_ubicaciones',
    'historico_precio',
    'solicitudes',
    'lineas_pedido',
    'pedidos',
    'revisiones_inventario',
]
# ────────────────────────────────────────────────────────────────

conn = conectar()

total = 0
for nombre in TABLAS:
    try:
        t, columnas, datos = leer(conn, nombre)
        n = len(datos)
        total += n
        if DRY_RUN:
            print(f'  [DRY] {nombre:30s} {n:4d} filas se borrarían')
        else:
            if n > 0:
                eliminar_todas(t)
                print(f'  ✓ {nombre:30s} {n:4d} filas eliminadas')
            else:
                print(f'  — {nombre:30s} ya estaba vacía')
    except Exception as e:
        print(f'  ✗ {nombre:30s} ERROR: {e}')

print()
if DRY_RUN:
    print(f'[DRY RUN] Se borrarían {total} filas en total.')
    print('Pon DRY_RUN = False y vuelve a ejecutar para borrar de verdad.')
else:
    print(f'✅ Limpieza completada — {total} filas eliminadas.')

conn.close()
