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
DRY_RUN = True   # True = solo muestra qué cambiaría; False = escribe

# Filtro para MODO A (qué equipos modificar). Un valor None busca el campo vacío (is null).
# 2026-10-26: temporada por defecto (curso escolar) en los equipos sin meses de temporada.
FILTRO_A = {'mes_inicio_temporada': None, 'mes_fin_temporada': None}

# Cambios para MODO A
CAMBIOS_A = {
    'mes_inicio_temporada': 9,
    'mes_fin_temporada': 6,
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
    where = ' and '.join(f"{c} is null" if v is None else f"{c} = %s" for c, v in FILTRO_A.items())
    with conn.cursor() as cur:
        cur.execute(f"select id_activo from equipos where {where} order by 1", [v for v in FILTRO_A.values() if v is not None])
        pks = [r[0] for r in cur.fetchall()]
    print(f"Equipos encontrados: {len(pks)}")
    preview_filas(t, pks, ['id_activo', 'tipo_equipo', 'modelo'])
    if not pks:
        print("Nada que modificar.")
        sys.exit(0)
    if DRY_RUN:
        print(f"\n[DRY_RUN] Se cambiaría {CAMBIOS_A} en {len(pks)} equipo(s). Nada escrito.")
        sys.exit(0)
    n = actualizar_varios(t, pks, CAMBIOS_A)
    print(f"\n✅ {n} equipo(s) actualizado(s).")

elif MODO == 'B':
    if DRY_RUN:
        print("[DRY_RUN] En modo B solo se listan los equipos.")
    actualizaciones = []
    for equipo_id, cambios in CAMBIOS_B:
        encontrado = buscar(t, 'id_activo', equipo_id)
        if encontrado:
            actualizaciones.append((equipo_id, cambios))
            print(f"  · {equipo_id} preparado")
        else:
            print(f"  ⚠ {equipo_id} no encontrado")

    if DRY_RUN:
        sys.exit(0)
    n = actualizar_fila_por_fila(t, actualizaciones)
    print(f"\n✅ {n} equipo(s) actualizado(s).")

conn.close()
