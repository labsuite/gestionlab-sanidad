"""
limpiar_inventario_fungible.py
Borra todos los datos de prueba del módulo de material fungible.
Conserva las cabeceras de todas las hojas.
DRY_RUN = True  →  solo muestra lo que se borraría (sin tocar nada)
DRY_RUN = False →  borra de verdad
"""
import sys
sys.path.insert(0, '.')
from scripts.base import conectar, leer, eliminar_todas

# ── CONFIGURACIÓN ────────────────────────────────────────────────
DRY_RUN = False  # cambiar a False para ejecutar de verdad

HOJAS = [
    'Material',
    'Movimientos',
    'Material_Ubicaciones',
    'Historico_Precios',
    'Solicitudes',
    'Lineas_Pedido',
    'Pedidos',
    'Revisiones_Inventario',
]
# ────────────────────────────────────────────────────────────────

sh = conectar()

total = 0
for nombre in HOJAS:
    try:
        ws, headers, datos = leer(sh, nombre)
        n = len(datos)
        total += n
        if DRY_RUN:
            print(f'  [DRY] {nombre:30s} {n:4d} filas se borrarían')
        else:
            if n > 0:
                eliminar_todas(ws)
                print(f'  ✓ {nombre:30s} {n:4d} filas eliminadas')
            else:
                print(f'  — {nombre:30s} ya estaba vacía')
    except Exception as e:
        print(f'  ✗ {nombre:30s} ERROR: {e}')

print()
if DRY_RUN:
    print(f'[DRY RUN] Se borrarían {total} filas en total. Cabeceras conservadas.')
    print('Pon DRY_RUN = False y vuelve a ejecutar para borrar de verdad.')
else:
    print(f'✅ Limpieza completada — {total} filas eliminadas. Cabeceras conservadas.')
