"""
actualizar_equipos.py — Modificar campos de la hoja Equipos.
Sirve para: Protocolo_Uso, Tipo_Mantenimiento, Mes_Inicio/Fin_Temporada,
            Ubicacion, Responsable, Estado_Operativo, Observaciones, etc.
Uso: ! python scripts/actualizar_equipos.py
"""
import sys
sys.path.insert(0, 'scripts')
from base import conectar, leer, buscar, buscar_multi, buscar_contiene, actualizar, actualizar_varios, actualizar_fila_por_fila, preview_filas

# ===========================================================================
# CONFIGURACIÓN — Claude rellena esta sección cada vez
# ===========================================================================

# MODO A: mismo cambio para varios equipos que comparten un filtro
# -------------------------------------------------------------------
MODO = 'A'   # Cambiar a 'B' para cambios distintos por equipo

# Filtro para MODO A (qué equipos modificar)
FILTRO_A = {'Tipo_Equipo': 'Micropipeta'}   # Ejemplo

# Cambios para MODO A
CAMBIOS_A = {
    'Protocolo_Uso': 'Nuevo protocolo de uso...',
    # 'Tipo_Mantenimiento': 'Interno',
    # 'Mes_Inicio_Temporada': '9',
    # 'Mes_Fin_Temporada': '6',
}

# MODO B: cambios distintos para cada equipo (lista explícita)
# -------------------------------------------------------------------
# MODO = 'B'
CAMBIOS_B = [
    # (ID_Activo, {campo: valor})
    ('EQU-001', {'Mes_Inicio_Temporada': '9', 'Mes_Fin_Temporada': '6'}),
    ('EQU-002', {'Mes_Inicio_Temporada': '10', 'Mes_Fin_Temporada': '5'}),
]

# ===========================================================================
# EJECUCIÓN — no tocar
# ===========================================================================

sh = conectar()
ws, headers, _ = leer(sh, 'Equipos')

if MODO == 'A':
    filas = buscar_multi(ws, FILTRO_A, headers)
    print(f"Equipos encontrados: {len(filas)}")
    preview_filas(ws, filas, ['ID_Activo', 'Tipo_Equipo', 'Modelo'], headers)
    if not filas:
        print("Nada que modificar.")
        sys.exit(0)
    n = actualizar_varios(ws, filas, CAMBIOS_A, headers)
    print(f"\n✅ {n} equipo(s) actualizado(s).")

elif MODO == 'B':
    datos = ws.get_all_values()
    col_id = headers.index('ID_Activo')
    id_a_fila = {str(row[col_id]): i + 2 for i, row in enumerate(datos[1:])}

    actualizaciones = []
    for equipo_id, cambios in CAMBIOS_B:
        fila = id_a_fila.get(equipo_id)
        if fila:
            actualizaciones.append((fila, cambios))
            print(f"  · {equipo_id} preparado")
        else:
            print(f"  ⚠ {equipo_id} no encontrado en la hoja")

    n = actualizar_fila_por_fila(ws, actualizaciones, headers)
    print(f"\n✅ {n} equipo(s) actualizado(s).")
