import sys
sys.path.insert(0, 'scripts')
from base import conectar, leer, buscar, actualizar, siguiente_id, insertar

sh = conectar()

# --- 1. Protocolo CEN-02 ---
ws_eq, headers_eq, _ = leer(sh, 'Equipos')

PROTOCOLO_CEN02 = (
    "Verificar fecha de caducidad de las tarjetas y reactivos. "
    "Preparar la muestra según la técnica indicada (tipaje ABO/Rh, escrutinio de anticuerpos...). "
    "Añadir muestra y reactivo a los pocillos de la tarjeta siguiendo el protocolo de la técnica. "
    "Si se requiere incubación a 37 °C, introducir en el bloque de incubación el tiempo indicado. "
    "Cargar las tarjetas en la centrífuga con la orientación correcta y ajustar el tiempo según la técnica. "
    "Leer el resultado: células atrapadas en el gel = aglutinación (positivo); células en el fondo = negativo. "
    "Depositar las tarjetas usadas en la bolsa de autoclave de residuos biológicos para su inactivación. "
    "Al finalizar, bajar la tapa sin cerrar."
)

filas = buscar(ws_eq, 'ID_Activo', 'CEN-02', headers_eq)
n = actualizar(ws_eq, filas, 'Protocolo_Uso', PROTOCOLO_CEN02, headers_eq)
print(f"✅ CEN-02 protocolo actualizado ({n} fila)")

# --- 2. Tipo de residuo: tarjetas de gel usadas ---
ws_res, headers_res, _ = leer(sh, 'Tipos_Residuo')

nuevo_id = siguiente_id(ws_res, 'ID_Residuo', 'RES')

insertar(ws_res, {
    'ID_Residuo':     nuevo_id,
    'Nombre':         'Tarjetas de gel de inmunohematología usadas',
    'Descripcion':    (
        'Tarjetas BioVue utilizadas en técnicas de tipaje sanguíneo y escrutinio de anticuerpos. '
        'Contienen sangre humana (riesgo biológico) y gel de acrilamida polimerizada (componente químico). '
        'Se autoclavan en bolsa de residuos biológicos para inactivar el material biológico; '
        'el componente químico es despreciable a los volúmenes generados en este laboratorio.'
    ),
    'Riesgo':         'Alto',
    'Contenedor_Tipo': 'Bolsa de autoclave',
    'Lab':            '',
    'Zona':           '',
}, headers_res)

print(f"✅ Tipo de residuo creado: {nuevo_id} — Tarjetas de gel de inmunohematología usadas")
