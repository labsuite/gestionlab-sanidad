"""
test_conexion.py — Verifica que la conexión con Google Sheets funciona.
Uso: ! python scripts/test_conexion.py
"""
import sys
sys.path.insert(0, 'scripts')
from base import conectar

sh = conectar()
hojas = [ws.title for ws in sh.worksheets()]
print("✅ Conexión correcta. Hojas encontradas:")
for h in hojas:
    print(f"  - {h}")
