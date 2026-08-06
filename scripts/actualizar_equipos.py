"""
actualizar_equipos.py — Modificar campos de la tabla equipos.
Sirve para: protocolo_uso, tipo_mantenimiento, mes_inicio/fin_temporada,
            ubicacion, responsable, estado_operativo, observaciones, etc.
Uso: ! python scripts/actualizar_equipos.py
"""
import sys
sys.path.insert(0, 'scripts')
from base import conectar, leer, buscar, buscar_multi, buscar_contiene, actualizar, actualizar_varios, actualizar_fila_por_fila, preview_filas

# ===========================================================================
# CONFIGURACIÓN — Claude rellena esta sección cada vez
# ===========================================================================

# MODO A: mismo cambio para varios equipos que comparten un filtro
# MODO B: cambios distintos por equipo (lista explícita)
MODO = 'A'

# Filtro para MODO A (qué equipos modificar)
FILTRO_A = {'tipo_equipo': 'Micropipeta'}   # Ejemplo

# Cambios para MODO A
CAMBIOS_A = {
    'protocolo_uso': 'Nuevo protocolo de uso...',
    # 'tipo_mantenimiento': 'Interno',
    # 'mes_inicio_temporada': '9',
    # 'mes_fin_temporada': '6',
}

# MODO B: cambios distintos para cada equipo (lista explícita)
CAMBIOS_B = [
    # ('COAG-01', {'protocolo_uso': '...'}),
]

# ===========================================================================
# EJECUCIÓN — no tocar
# ===========================================================================

conn = conectar()
t, columnas, _ = leer(conn, 'equipos')

if MODO == 'A':
    pks = buscar_multi(t, FILTRO_A)
    print(f"Equipos encontrados: {len(pks)}")
    preview_filas(t, pks, ['id_activo', 'tipo_equipo', 'modelo'])
    if not pks:
        print("Nada que modificar.")
        sys.exit(0)
    n = actualizar_varios(t, pks, CAMBIOS_A)
    print(f"\n✅ {n} equipo(s) actualizado(s).")

elif MODO == 'B':
    actualizaciones = []
    for equipo_id, cambios in CAMBIOS_B:
        encontrado = buscar(t, 'id_activo', equipo_id)
        if encontrado:
            actualizaciones.append((equipo_id, cambios))
            print(f"  · {equipo_id} preparado")
        else:
            print(f"  ⚠ {equipo_id} no encontrado")

    n = actualizar_fila_por_fila(t, actualizaciones)
    print(f"\n✅ {n} equipo(s) actualizado(s).")

conn.close()
