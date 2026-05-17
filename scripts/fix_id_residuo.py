import sys
sys.path.insert(0, 'scripts')
from base import conectar, leer, buscar, actualizar

sh = conectar()
ws, headers, _ = leer(sh, 'Tipos_Residuo')

filas = buscar(ws, 'ID_Residuo', 'RES-001', headers)
n = actualizar(ws, filas, 'ID_Residuo', 'R112', headers)
print(f"✅ ID corregido a R112 ({n} fila)")
