import sys
sys.path.insert(0, 'scripts')
from base import conectar, leer, buscar_contiene

sh = conectar()
ws, headers, datos = leer(sh, 'Equipos')

col_tipo = headers.index('Tipo_Equipo')
col_id = headers.index('ID_Activo')
col_protocolo = headers.index('Protocolo_Uso')

print("=== CENTRÍFUGAS ENCONTRADAS ===")
datos_raw = ws.get_all_values()
for i, row in enumerate(datos_raw[1:], start=2):
    tipo = str(row[col_tipo]).lower()
    if 'centr' in tipo:
        print(f"\nID: {row[col_id]} | Tipo: {row[col_tipo]}")
        print(f"   Protocolo: {str(row[col_protocolo])[:200]}")
