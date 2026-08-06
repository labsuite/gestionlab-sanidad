"""
nuevo_residuo.py – INSERT/UPDATE puntual en tipos_residuo.
Rellena ACTUALIZACIONES/INSERCIONES cada vez con lo que toque.

Nota: el ID se calcula manualmente (formato R + 3 dígitos sin guión).
No usar generar_id() — ese helper genera formato PREFIJO+hash, distinto.
"""
import sys
sys.path.insert(0, '.')
from scripts.base import conectar, leer, buscar, actualizar_varios, insertar

# ── CONFIGURACIÓN — Claude rellena esta sección cada vez ──────────

# Lista de (id_residuo, {campo: valor}) a actualizar
ACTUALIZACIONES = [
    # ('R072', {'descripcion': 'Nuevo texto...'}),
]

# Lista de dicts a insertar (id_residuo nuevo, formato R + 3 dígitos)
INSERCIONES = [
    # {'id_residuo': 'R113', 'nombre': '...', 'descripcion': '...',
    #  'riesgo': '', 'contenedor_tipo': '', 'lab': '', 'zona': ''},
]

# ── EJECUCIÓN ────────────────────────────────────────────────────

conn = conectar()
t, columnas, datos = leer(conn, 'tipos_residuo')

for id_residuo, cambios in ACTUALIZACIONES:
    filas = buscar(t, 'id_residuo', id_residuo)
    if not filas:
        print(f'⚠️  {id_residuo} no encontrado')
    else:
        actualizar_varios(t, filas, cambios)
        print(f'✓ {id_residuo} actualizado')

for nuevo in INSERCIONES:
    ya_existe = buscar(t, 'id_residuo', nuevo['id_residuo'])
    if ya_existe:
        print(f'⚠️  {nuevo["id_residuo"]} ya existe — no se inserta de nuevo')
    else:
        insertar(t, nuevo)
        print(f'✓ {nuevo["id_residuo"]} insertado: {nuevo.get("nombre", "")}')

conn.close()
