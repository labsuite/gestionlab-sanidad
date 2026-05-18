"""
nuevo_residuo.py – gestión de Tipos_Residuo
Acciones configuradas:
  1. Actualizar descripción de R072 (aclarar que solo cubre reactivos líquidos, no tarjetas)
  2. Insertar R113 – Calibradores de pHmetro (tampones de calibración usados)

Nota: el ID se calcula manualmente (formato R + 3 dígitos sin guión).
No usar siguiente_id() — ese helper genera formato PREF-NNN.
"""
import sys
sys.path.insert(0, '.')
from scripts.base import conectar, leer, buscar, actualizar_varios, insertar

# ── CONFIGURACIÓN ────────────────────────────────────────────────

ACTUALIZAR_R072 = True
INSERTAR_R113   = True

R072_NUEVO = {
    'Nombre': 'Antisueros y reactivos líquidos del sistema Ortho (inmunohematología)',
    'Descripcion': (
        'Antisueros (anti-A, anti-B, anti-D y otros) y solución LISS del sistema '
        'Ortho TM Workstation, utilizados en tipaje ABO/Rh y escrutinio de anticuerpos. '
        'Contienen anticuerpos monoclonales murinos o policlonales humanos. '
        'Pueden contener azida sódica como conservante (ver R074 — NUNCA al desagüe). '
        'Las tarjetas BioVue usadas se gestionan por separado en bolsa de autoclave (ver R112).'
    ),
}

R113 = {
    'ID_Residuo':     'R113',
    'Nombre':         'Calibradores de pHmetro (tampones de calibración usados)',
    'Descripcion':    (
        'Soluciones tampón de calibración del pHmetro usadas: pH 4,0 (ftalato ácido de potasio '
        '0,05 M), pH 7,0 (mezcla de fosfatos) y pH 10,0 (carbonatos o boratos). '
        'No son residuos peligrosos a las concentraciones y volúmenes de calibración habituales. '
        'Recoger en el contenedor de aguas de laboratorio; si el pH de la mezcla está entre '
        '5,5 y 9,5 pueden verterse al desagüe con abundante agua. '
        'No mezclar con disolventes orgánicos ni ácidos concentrados.'
    ),
    'Riesgo':         'Bajo',
    'Contenedor_Tipo': 'Aguas Laboratorio',
    'Lab':            '',
    'Zona':           '',
}

# ── EJECUCIÓN ────────────────────────────────────────────────────

sh = conectar()
ws, headers, datos = leer(sh, 'Tipos_Residuo')

if ACTUALIZAR_R072:
    filas_r072 = buscar(ws, 'ID_Residuo', 'R072')
    if not filas_r072:
        print('⚠️  R072 no encontrado')
    else:
        actualizar_varios(ws, filas_r072, R072_NUEVO)
        print(f'✓ R072 actualizado (filas: {filas_r072})')

if INSERTAR_R113:
    ya_existe = buscar(ws, 'ID_Residuo', 'R113')
    if ya_existe:
        print('⚠️  R113 ya existe — no se inserta de nuevo')
    else:
        insertar(ws, R113)
        print(f'✓ R113 insertado: {R113["Nombre"]}')
