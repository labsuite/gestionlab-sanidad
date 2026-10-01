"""
Corrección puntual del inventario de material fungible (revisión 2026-09-30,
decisiones de la usuaria del 2026-10-01). Se ejecuta UNA vez.

1. Materiales con un número como unidad (el alumnado puso ahí la cantidad):
   se les pone la unidad real y, donde el stock se había quedado a 0, el
   número que escribieron pasa a ser el stock.
2. Botes con un número como unidad: se corrige o se vacía (= la del material).
3. Materiales duplicados ("ya existía" validado como nuevo): se fusionan en
   uno; los botes, el historial, los pedidos y las propuestas pasan al que se
   queda, y el duplicado se borra.

Uso:  python scripts/corregir_inventario_2026_09.py            (simulación)
      python scripts/corregir_inventario_2026_09.py --aplicar  (guarda)
"""
import sys
sys.path.insert(0, 'scripts')
from base import conectar

DRY_RUN = '--aplicar' not in sys.argv   # simulación por defecto

# ── CONFIGURACIÓN ──────────────────────────────────────────────────────
# id_material: (unidad nueva, stock nuevo o None = no tocar el stock)
UNIDADES = {
    'TRY-01': ('bote/s', None),
    'PLA-01': ('unidad/es', None),
    'TUB-03': ('caja/s', None),   # tiene dos botes: el stock va abajo, en BOTES
    'TUB-04': ('caja/s', 10),
    'ABS-01': ('unidad/es', 3),
    'BIS-01': ('caja/s', 2),
    'BOL-03': ('caja/s', 3),
    'FRA-05': ('caja/s', 3),
    'LIM-01': ('bote/s', 1),
    'BOL-02': ('caja/s', None),   # se fusiona con BOL-01 abajo
}
# id del bote: (unidad_lote nueva, stock nuevo o None)
BOTES = {
    'LUOK3ET61': (None, None),    # guantes nitrilo S, 205-1.2: "1" → la del material (caja/s)
    'LUOK4CAOC': (None, None),    # guantes nitrilo M, 205-1.2: "1" → caja/s
    'LUHBSPYZV': (None, 2),       # tubos de ensayo, 205-3.4: 200 tubos contados = 2 cajas
    'LUOK75ZQC': (None, 3),       # tubos de ensayo, 205-3.8: "3" con stock 0 → 3 cajas
}
# duplicado → (se queda, nombre final o None = el que ya tiene)
FUSIONES = {
    'ÁCS-01': ('ACS-01', 'Ácido sulfúrico, H2SO4, 96%'),
    'BOL-02': ('BOL-01', None),
    'GUA-01': ('GUN-10', None),
    'GUA-02': ('GUN-07', None),
}
# ───────────────────────────────────────────────────────────────────────

c = conectar(); cur = c.cursor()

def stock_desde_botes(idm):
    cur.execute('select count(*), coalesce(sum(stock_local),0) from material_ubicaciones where id_material=%s', (idm,))
    n, total = cur.fetchone()
    if n:
        cur.execute('update material set stock_actual=%s where id_material=%s', (total, idm))
    return n, total

print('== 1. Unidades de material')
for idm, (unidad, stock) in UNIDADES.items():
    cur.execute('select nombre, unidad, stock_actual from material where id_material=%s', (idm,))
    fila = cur.fetchone()
    if not fila: print(f'  {idm}: NO EXISTE, se salta'); continue
    cur.execute('update material set unidad=%s where id_material=%s', (unidad, idm))
    txt = f'  {idm} {fila[0]}: unidad {fila[1]!r} → {unidad!r}'
    if stock is not None:
        cur.execute('select id from material_ubicaciones where id_material=%s', (idm,))
        botes = [r[0] for r in cur.fetchall()]
        if len(botes) == 1:
            cur.execute('update material_ubicaciones set stock_local=%s where id=%s', (stock, botes[0]))
        elif len(botes) > 1:
            print(f'  {idm}: tiene {len(botes)} botes, no sé en cuál poner el stock — se salta el stock'); stock = None
        if stock is not None:
            cur.execute('update material set stock_actual=%s where id_material=%s', (stock, idm))
            txt += f'; stock {fila[2]} → {stock}'
    print(txt)

print('== 2. Botes')
for idl, (unidad, stock) in BOTES.items():
    cur.execute('select id_material, unidad_lote, stock_local from material_ubicaciones where id=%s', (idl,))
    fila = cur.fetchone()
    if not fila: print(f'  {idl}: NO EXISTE, se salta'); continue
    cur.execute('update material_ubicaciones set unidad_lote=%s where id=%s', (unidad, idl))
    if stock is not None:
        cur.execute('update material_ubicaciones set stock_local=%s where id=%s', (stock, idl))
    n, total = stock_desde_botes(fila[0])
    print(f'  {idl} ({fila[0]}): unidad {fila[1]!r} → {unidad!r}; stock {fila[2]} → {stock if stock is not None else fila[2]}; total material {total}')

print('== 3. Fusiones')
for dup, (queda, nombre) in FUSIONES.items():
    cur.execute('select nombre from material where id_material=%s', (dup,)); a = cur.fetchone()
    cur.execute('select nombre from material where id_material=%s', (queda,)); b = cur.fetchone()
    if not a or not b: print(f'  {dup} → {queda}: falta alguno, se salta'); continue
    nombre_final = nombre or b[0]
    # Botes: si el que se queda ya tiene bote en esa misma ubicación, es el
    # mismo bote contado dos veces → se descarta el del duplicado (no se suma).
    cur.execute('select id, id_ubicacion, stock_local from material_ubicaciones where id_material=%s', (dup,))
    for idl, ubi, st in cur.fetchall():
        cur.execute('select id from material_ubicaciones where id_material=%s and id_ubicacion=%s', (queda, ubi))
        if cur.fetchone():
            cur.execute('delete from material_ubicaciones where id=%s', (idl,))
            print(f'  {dup}: bote en {ubi} ({st}) ya existe en {queda} → se descarta (mismo bote)')
        else:
            cur.execute('update material_ubicaciones set id_material=%s where id=%s', (queda, idl))
            print(f'  {dup}: bote en {ubi} ({st}) → pasa a {queda}')
    for tabla, col in [('movimientos', 'id_material'), ('historico_precio', 'id_material'),
                       ('lineas_pedido', 'id_material'), ('solicitudes', 'id_material'),
                       ('revisiones_inventario', 'id_material'),
                       ('propuestas_material', 'id_material_creado'),
                       ('propuestas_material', 'id_material_sugerido')]:
        cur.execute(f'update {tabla} set {col}=%s where {col}=%s', (queda, dup))
        if cur.rowcount: print(f'  {dup}: {cur.rowcount} fila(s) de {tabla}.{col} → {queda}')
    cur.execute('update material set nombre=%s where id_material=%s', (nombre_final, queda))
    for tabla, col in [('movimientos', 'material'), ('historico_precio', 'nombre_material'),
                       ('lineas_pedido', 'material'), ('solicitudes', 'material'),
                       ('revisiones_inventario', 'nombre_material')]:
        cur.execute(f'update {tabla} set {col}=%s where id_material=%s', (nombre_final, queda))
    cur.execute('delete from material where id_material=%s', (dup,))
    n, total = stock_desde_botes(queda)
    print(f'  {dup} fusionado en {queda} "{nombre_final}": {n} bote(s), stock total {total}')

if DRY_RUN:
    c.rollback(); print('\nSIMULACIÓN — no se ha guardado nada. Repite con --aplicar.')
else:
    c.commit(); print('\nAPLICADO.')
