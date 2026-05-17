import sys
sys.path.insert(0, 'scripts')
from base import conectar, leer, actualizar_fila_por_fila

INSTRUCCION_TAPA = "Al finalizar el uso, bajar la tapa sin cerrar para proteger el rotor de la acumulación de polvo y materia orgánica."

PROTOCOLO_ESTANDAR = (
    "Equilibrar los tubos en pares opuestos (diferencia máxima ±0,1 g). "
    "Comprobar que los rotores están bien fijados. "
    "Cerrar la tapa antes de poner en marcha. "
    "No abrir hasta que el rotor esté completamente parado. "
    "Limpiar el rotor y la cámara si hay derrames. "
    + INSTRUCCION_TAPA
)

sh = conectar()
ws, headers, _ = leer(sh, 'Equipos')
datos = ws.get_all_values()
col_id = headers.index('ID_Activo')
col_tipo = headers.index('Tipo_Equipo')
col_protocolo = headers.index('Protocolo_Uso')

id_a_fila = {str(row[col_id]): i + 2 for i, row in enumerate(datos[1:])}

actualizaciones = []
for i, row in enumerate(datos[1:], start=2):
    tipo = str(row[col_tipo]).lower()
    protocolo = str(row[col_protocolo])
    equipo_id = str(row[col_id])

    if 'centr' not in tipo:
        continue
    if equipo_id in ('CEN-02',):
        # Protocolo específico pendiente de revisar
        print(f"  ⚠ {equipo_id} omitido (requiere revisión manual)")
        continue
    if INSTRUCCION_TAPA in protocolo:
        print(f"  · {equipo_id} ya tiene la instrucción, omitido")
        continue

    if not protocolo.strip():
        # CEN-03: protocolo vacío, usar el estándar completo
        nuevo = PROTOCOLO_ESTANDAR
        print(f"  · {equipo_id} — protocolo creado desde cero")
    else:
        # Añadir instrucción al final
        nuevo = protocolo.rstrip() + " " + INSTRUCCION_TAPA
        print(f"  · {equipo_id} — instrucción añadida")

    actualizaciones.append((i, {'Protocolo_Uso': nuevo}))

n = actualizar_fila_por_fila(ws, actualizaciones, headers)
print(f"\n✅ {n} centrífuga(s) actualizada(s).")
