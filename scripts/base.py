"""
base.py — Funciones comunes para todos los scripts de GestionLab.
Importar con: from base import conectar, leer, buscar, actualizar, eliminar, insertar, siguiente_id
"""
import sys
import gspread
from google.oauth2.service_account import Credentials

sys.stdout.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8')

SHEET_ID = '1YeoIPn3UqvcljptbgJIX-1CdrDLwIiT_3vcOy8k2Acg'
CREDENTIALS_FILE = 'scripts/credentials.json'

# ---------------------------------------------------------------------------
# CONEXIÓN
# ---------------------------------------------------------------------------

def conectar():
    """Devuelve el objeto spreadsheet autenticado."""
    scopes = [
        'https://www.googleapis.com/auth/spreadsheets',
        'https://www.googleapis.com/auth/drive',
    ]
    creds = Credentials.from_service_account_file(CREDENTIALS_FILE, scopes=scopes)
    gc = gspread.authorize(creds)
    return gc.open_by_key(SHEET_ID)

def leer(sh, nombre_hoja):
    """Devuelve (worksheet, headers, lista_de_dicts)."""
    ws = sh.worksheet(nombre_hoja)
    headers = ws.row_values(1)
    datos = ws.get_all_records()
    return ws, headers, datos

# ---------------------------------------------------------------------------
# BÚSQUEDA
# ---------------------------------------------------------------------------

def buscar(ws, campo, valor, headers=None):
    """Filas (índice base 1 real) donde campo == valor (coincidencia exacta)."""
    if headers is None:
        headers = ws.row_values(1)
    datos = ws.get_all_values()
    col = headers.index(campo)
    return [i + 2 for i, row in enumerate(datos[1:]) if str(row[col]) == str(valor)]

def buscar_multi(ws, filtros, headers=None):
    """Filas donde TODOS los filtros coinciden. filtros = {campo: valor}."""
    if headers is None:
        headers = ws.row_values(1)
    datos = ws.get_all_values()
    indices = {col: headers.index(col) for col in filtros}
    return [
        i + 2 for i, row in enumerate(datos[1:])
        if all(str(row[indices[col]]) == str(val) for col, val in filtros.items())
    ]

def buscar_contiene(ws, campo, texto, headers=None):
    """Filas donde campo contiene texto (sin distinción de mayúsculas)."""
    if headers is None:
        headers = ws.row_values(1)
    datos = ws.get_all_values()
    col = headers.index(campo)
    return [i + 2 for i, row in enumerate(datos[1:]) if texto.lower() in str(row[col]).lower()]

def todas_las_filas(ws):
    """Devuelve los índices de todas las filas de datos (sin cabecera)."""
    n = len(ws.get_all_values())
    return list(range(2, n + 1))

# ---------------------------------------------------------------------------
# ACTUALIZACIÓN
# ---------------------------------------------------------------------------

def _col_letra(headers, campo):
    idx = headers.index(campo)
    if idx < 26:
        return chr(ord('A') + idx)
    return chr(ord('A') + idx // 26 - 1) + chr(ord('A') + idx % 26)

def actualizar(ws, filas, campo, valor, headers=None):
    """Actualiza un campo en las filas indicadas (una sola llamada a la API)."""
    if not filas:
        print(f"  ⚠ Sin filas para actualizar '{campo}'")
        return 0
    if headers is None:
        headers = ws.row_values(1)
    col = _col_letra(headers, campo)
    ws.batch_update([{'range': f'{col}{i}', 'values': [[valor]]} for i in filas])
    return len(filas)

def actualizar_varios(ws, filas, cambios, headers=None):
    """Actualiza múltiples campos en las filas indicadas. cambios = {campo: valor}."""
    if not filas:
        print("  ⚠ Sin filas para actualizar")
        return 0
    if headers is None:
        headers = ws.row_values(1)
    batch = []
    for campo, valor in cambios.items():
        col = _col_letra(headers, campo)
        batch.extend({'range': f'{col}{i}', 'values': [[valor]]} for i in filas)
    ws.batch_update(batch)
    return len(filas)

def actualizar_fila_por_fila(ws, actualizaciones, headers=None):
    """Actualiza campos distintos en cada fila. actualizaciones = [(fila, {campo: valor}), ...]"""
    if not actualizaciones:
        print("  ⚠ Sin actualizaciones que aplicar")
        return 0
    if headers is None:
        headers = ws.row_values(1)
    batch = []
    for fila, cambios in actualizaciones:
        for campo, valor in cambios.items():
            col = _col_letra(headers, campo)
            batch.append({'range': f'{col}{fila}', 'values': [[valor]]})
    ws.batch_update(batch)
    return len(actualizaciones)

# ---------------------------------------------------------------------------
# ELIMINACIÓN
# ---------------------------------------------------------------------------

def eliminar(ws, filas):
    """Elimina las filas indicadas de abajo arriba (preserva índices)."""
    if not filas:
        print("  ⚠ Sin filas que eliminar")
        return 0
    for i in sorted(set(filas), reverse=True):
        ws.delete_rows(i)
    return len(filas)

def eliminar_todas(ws):
    """Elimina todos los datos de la hoja manteniendo la cabecera."""
    total = len(ws.get_all_values())
    if total <= 1:
        print("  ⚠ La hoja ya está vacía")
        return 0
    ws.delete_rows(2, total)
    return total - 1

# ---------------------------------------------------------------------------
# INSERCIÓN
# ---------------------------------------------------------------------------

def insertar(ws, fila_dict, headers=None):
    """Inserta una fila nueva a partir de un dict {campo: valor}."""
    if headers is None:
        headers = ws.row_values(1)
    fila = [fila_dict.get(h, '') for h in headers]
    ws.append_row(fila, value_input_option='USER_ENTERED')

def insertar_varios(ws, lista_dicts, headers=None):
    """Inserta múltiples filas a partir de una lista de dicts."""
    if not lista_dicts:
        print("  ⚠ Lista vacía, nada que insertar")
        return 0
    if headers is None:
        headers = ws.row_values(1)
    filas = [[d.get(h, '') for h in headers] for d in lista_dicts]
    ws.append_rows(filas, value_input_option='USER_ENTERED')
    return len(filas)

# ---------------------------------------------------------------------------
# UTILIDADES
# ---------------------------------------------------------------------------

def siguiente_id(ws, campo_id, prefijo):
    """Genera el siguiente ID correlativo: 'PREF-001', 'PREF-002'..."""
    datos = ws.get_all_values()
    headers = datos[0]
    col = headers.index(campo_id)
    nums = []
    for row in datos[1:]:
        val = str(row[col])
        if val.upper().startswith(prefijo.upper() + '-'):
            try:
                nums.append(int(val.split('-')[1]))
            except (IndexError, ValueError):
                pass
    return f"{prefijo}-{(max(nums) + 1 if nums else 1):03d}"

def preview_filas(ws, filas, campos_mostrar, headers=None, max_filas=20):
    """Muestra un preview de las filas encontradas antes de actuar sobre ellas."""
    if not filas:
        print("  (ninguna fila encontrada)")
        return
    if headers is None:
        headers = ws.row_values(1)
    datos = ws.get_all_values()
    indices = [headers.index(c) for c in campos_mostrar if c in headers]
    print(f"  {'  |  '.join(campos_mostrar)}")
    print(f"  {'—' * 60}")
    for n, i in enumerate(filas):
        if n >= max_filas:
            print(f"  ... y {len(filas) - max_filas} más")
            break
        row = datos[i - 1]
        print(f"  {'  |  '.join(str(row[j]) for j in indices)}")
