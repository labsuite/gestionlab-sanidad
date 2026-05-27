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
MODO = 'B'   # Cambiar a 'B' para cambios distintos por equipo

# Filtro para MODO A (qué equipos modificar)
FILTRO_A = {'Tipo_Equipo': 'Micropipeta'}   # Ejemplo

# Cambios para MODO A
CAMBIOS_A = {
    'Protocolo_Uso': 'Nuevo protocolo de uso...',
    # 'Tipo_Mantenimiento': 'Interno',
    # 'Mes_Inicio_Temporada': '9',
    # 'Mes_Fin_Temporada': '6',
}

_PROTOCOLO_COAG = (
    'Encender y esperar temperatura estable 37°C. '
    'Verificar reactivos: lote, caducidad y nivel suficiente. '
    'CONTROL DE CALIDAD (obligatorio antes de procesar muestras): '
    'determinar TP y APTT en plasma control de nivel normal y comprobar '
    'que los valores están dentro del rango del kit; si no pasan, no procesar '
    'hasta identificar y resolver el problema. '
    'Usar plasma pobre en plaquetas (PPP) obtenido por centrifugación 15 min a 1500 g. '
    'Pipetear muestra y reactivos según protocolo del kit en uso. '
    'Al finalizar: limpiar zona de trabajo, tapar y refrigerar reactivos abiertos (4°C), '
    'desechar cubetas en contenedor de biorriesgo.'
)

# MODO B: cambios distintos para cada equipo (lista explícita)
# -------------------------------------------------------------------
CAMBIOS_B = [
    ('COAG-01', {'Protocolo_Uso': _PROTOCOLO_COAG}),
    ('COAG-02', {'Protocolo_Uso': _PROTOCOLO_COAG}),
    ('COAG-03', {'Protocolo_Uso': _PROTOCOLO_COAG}),
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
