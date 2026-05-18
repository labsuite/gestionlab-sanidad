"""
fix_reservas_cabecera.py
Arregla la hoja Reservas_Equipos que fue creada sin cabecera.
Situación actual:
  Fila 1: RSV-001 (datos reales, sin cabecera encima)
  Fila 2: fila fantasma con solo "Confirmada" + email en cols H-I
Resultado:
  Fila 1: cabecera canónica
  Fila 2: RSV-001 con Estado=Confirmada y Aprobado_Por correcto
  Fila 3: eliminada
"""
import sys
sys.path.insert(0, '.')
from scripts.base import conectar

HEADERS = [
    'ID_Reserva','ID_Equipo','Usuario','Fecha_Inicio','Fecha_Fin',
    'Condiciones','Proposito','Estado','Aprobado_Por',
    'Observaciones_Admin','Inicio_Real','Fin_Real'
]

sh = conectar()
ws = sh.worksheet('Reservas_Equipos')

todas = ws.get_all_values()
print("Filas actuales en la hoja:")
for i, fila in enumerate(todas, 1):
    print(f"  Fila {i}: {fila}")

if not todas:
    print("La hoja está vacía. Añadiendo solo la cabecera.")
    ws.insert_row(HEADERS, 1)
    sys.exit(0)

fila1 = todas[0]

# Detectar si ya tiene cabecera
if fila1[0] == 'ID_Reserva':
    print("La hoja ya tiene cabecera — no es necesario actuar.")
    sys.exit(0)

# Insertar cabecera en fila 1 (empuja todo hacia abajo)
ws.insert_row(HEADERS, 1)
print("✓ Cabecera insertada en fila 1")

# Ahora RSV-001 está en fila 2. Corregir Estado y Aprobado_Por.
# Los índices en gspread son base-1; col H = 8, col I = 9
ws.update_cell(2, 8, 'Confirmada')
ws.update_cell(2, 9, 'palomafedez@gmail.com')
print("✓ Estado → Confirmada, Aprobado_Por → palomafedez@gmail.com en fila 2")

# Eliminar la fila 3 (la fila fantasma con solo "Confirmada" + email)
todas_post = ws.get_all_values()
if len(todas_post) >= 3:
    fila3 = todas_post[2]
    print(f"  Fila 3 actual: {fila3}")
    if not fila3[0]:  # Col A vacía → es la fila fantasma
        ws.delete_rows(3)
        print("✓ Fila fantasma (fila 3) eliminada")
    else:
        print("  Fila 3 tiene datos en col A — no se elimina")

print("\nEstado final:")
for i, fila in enumerate(ws.get_all_values(), 1):
    print(f"  Fila {i}: {fila}")
