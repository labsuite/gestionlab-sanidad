"""
reasignar_modulos_labs_207_209.py — corrige `equipos.modulos_responsables` en los
laboratorios 207 y 209, donde el módulo etiquetado no coincide con lo que se
imparte allí según los horarios de Sanidad CMA.

CRITERIO (confirmado por la usuaria, 2026-09-14): la etiqueta de módulo identifica
el MÓDULO al que pertenece el equipo, no "material de uso común". Por tanto un
equipo no puede llevar un módulo que no se imparte en su laboratorio.

  - Lab 207: según horarios sólo se imparte Procesamento Citolóxico e Tisular.
    Los 51 equipos etiquetados "Técnicas Xerais de Laboratorio" (TGL se da en
    203 y 201, no en 207) pasan a Procesamento. Igual PIPR-001, que llevaba
    "Bioloxía Molecular e Citoxenética, Control e Seguridade Alimentaria"
    —ninguno de los dos se imparte en el 207— por copia de los PIPR-002..008
    del Lab 205.
  - Lab 209: se imparten Citoloxía Xeral, Citoloxía Xinecolóxica, Necropsias y
    Bioloxía Molecular e Citoxenética. Sus 16 microscopios y cámaras estaban
    como TGL; pasan a "Citoloxía Xeral, Citoloxía Xinecolóxica".

NO toca el Lab 205 (90 equipos aún como TGL): allí conviven Bioloxía Molecular,
Microbioloxía Clínica y Control e Seguridade Alimentaria y hace falta decidir el
reparto antes de tocarlo.

Ejecutar con DRY_RUN = True primero.
"""
import re
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from base import conectar, leer, actualizar_fila_por_fila

# =========================== CONFIGURACIÓN ===========================
DRY_RUN = True

TGL = 'Técnicas Xerais de Laboratorio'

# lab -> módulo(s) que sustituyen a la etiqueta incorrecta
DESTINO = {
    '207': 'Procesamento Citolóxico e Tisular',
    '209': 'Citoloxía Xeral, Citoloxía Xinecolóxica',
}

# Equipos concretos con etiqueta importada de otro laboratorio.
PUNTUALES = {
    'PIPR-001': 'Procesamento Citolóxico e Tisular',
}
# =====================================================================


def lab_de(ubicacion):
    m = re.search(r'\b(\d{3})\b', ubicacion or '')
    return m.group(1) if m else None


def main():
    conn = conectar()
    t, cols, datos = leer(conn, 'equipos')

    cambios = []
    for fila in datos:
        pk = fila['id_activo']
        actual = (fila.get('modulos_responsables') or '').strip()
        nuevo = None

        if pk in PUNTUALES:
            nuevo = PUNTUALES[pk]
        else:
            lab = lab_de(fila.get('ubicacion'))
            if lab in DESTINO and actual == TGL:
                nuevo = DESTINO[lab]

        if nuevo and nuevo != actual:
            cambios.append((pk, {'modulos_responsables': nuevo}, actual, nuevo,
                            fila.get('tipo_equipo'), fila.get('ubicacion')))

    print(f"Equipos a actualizar: {len(cambios)}\n")
    for pk, _, antes, despues, tipo, ubi in cambios:
        print(f"  {pk:<10} {(ubi or '?'):<10} {(tipo or '')[:38]:<38}")
        print(f"             {antes!r} -> {despues!r}")

    if DRY_RUN:
        print("\nDRY_RUN = True — no se ha escrito nada.")
        return

    actualizar_fila_por_fila(t, [(pk, d) for pk, d, *_ in cambios])
    print(f"\n✅ Actualizados {len(cambios)} equipos.")


if __name__ == '__main__':
    main()
