import sys
sys.path.insert(0, 'scripts')
from base import conectar, leer, buscar

ID_EQUIPO = 'CONX-001'

sh = conectar()
ws_eq, headers_eq, _ = leer(sh, 'Equipos')
datos_raw = ws_eq.get_all_values()
col_id = headers_eq.index('ID_Activo')

print(f"=== EQUIPO {ID_EQUIPO} ===")
for row in datos_raw[1:]:
    if str(row[col_id]) == ID_EQUIPO:
        for h, v in zip(headers_eq, row):
            if v:
                print(f"  {h}: {v}")
        break

ws_pl, headers_pl, _ = leer(sh, 'Planes_Mantenimiento')
planes = ws_pl.get_all_values()
col_eq = headers_pl.index('ID_Equipo')
print(f"\n=== PLANES DE MANTENIMIENTO ===")
for row in planes[1:]:
    if str(row[col_eq]) == ID_EQUIPO:
        print(f"  {row[headers_pl.index('ID_Plan')]} | {row[headers_pl.index('Tipo_Intervencion')]} | {row[headers_pl.index('Periodicidad')]} | {row[headers_pl.index('Operacion')]}")
