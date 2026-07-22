"""
preparar_hoja_tareas_intervencion.py — Cambios de esquema para el rediseño del flujo
de incidencias/intervenciones (ver docs/modulo-incidencias.md):

1. Crea la hoja Tareas_Intervencion (si no existe) con su cabecera.
2. Añade la columna Relacionada_Con a Incidencias (si no existe ya).

Ejecutar una sola vez, antes de desplegar el código que usa estos cambios.
Es idempotente: si ya existen, no hace nada.
"""
import sys
sys.path.insert(0, 'scripts')
from base import conectar

TAREAS_HEADERS = ['ID_Tarea', 'ID_Intervencion', 'Descripcion', 'Resultado', 'Operativo', 'Observaciones']

def main():
    sh = conectar()

    # 1. Hoja Tareas_Intervencion
    hojas = [ws.title for ws in sh.worksheets()]
    if 'Tareas_Intervencion' in hojas:
        print("✓ La hoja 'Tareas_Intervencion' ya existe, no se toca.")
    else:
        ws = sh.add_worksheet(title='Tareas_Intervencion', rows=200, cols=len(TAREAS_HEADERS))
        ws.append_row(TAREAS_HEADERS, value_input_option='USER_ENTERED')
        print("✓ Hoja 'Tareas_Intervencion' creada con cabecera.")

    # 2. Columna Relacionada_Con en Incidencias
    inc = sh.worksheet('Incidencias')
    headers = inc.row_values(1)
    if 'Relacionada_Con' in headers:
        print("✓ La columna 'Relacionada_Con' ya existe en Incidencias, no se toca.")
    else:
        col_letra = chr(ord('A') + len(headers))  # siguiente columna libre
        inc.update(range_name=f'{col_letra}1', values=[['Relacionada_Con']])
        print(f"✓ Columna 'Relacionada_Con' añadida en Incidencias!{col_letra}1.")

if __name__ == '__main__':
    main()
