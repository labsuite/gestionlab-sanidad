#!/usr/bin/env python3
"""
rellenar_mantenimientos.py
Inserta en Registro_Mantenimientos todos los periodos del curso 2025-2026
para los planes activos, como si se hubieran realizado.
Omite automáticamente los que ya tienen registro existente.

Con DRY_RUN=True solo muestra qué se insertaría.
"""

import sys
import os
import random
import string
import calendar
from datetime import date

sys.path.insert(0, os.path.dirname(__file__))
from base import conectar, leer, insertar_varios

# ─────────────── CONFIGURACIÓN ───────────────
CURSO          = '2025-2026'
REALIZADO_POR  = 'Paloma'    # Nombre que aparece en "Realizado_Por"
DRY_RUN        = True        # Cambiar a False para escribir en Sheets
# ──────────────────────────────────────────────

# Los 10 meses del curso (Sep–Jun) como tuplas (año, mes)
MESES_CURSO = [
    (2025, 9), (2025, 10), (2025, 11), (2025, 12),
    (2026, 1), (2026, 2),  (2026, 3),  (2026, 4), (2026, 5), (2026, 6),
]


def mes_str(año, mes):
    return f'{año}-{str(mes).zfill(2)}'


def es_momento_fin(operacion):
    op = (operacion or '').lower().strip()
    return (
        op.startswith('limpieza') or
        op.startswith('vaciado') or
        op.startswith('descongelaci') or
        op.startswith('cambio de agua') or
        (op.startswith('inspecci') and 'limpieza' in op)
    )


def es_con_alumnado(plan):
    v = str(plan.get('Con_Alumnado', '')).strip()
    return v in ('Sí', '1', '1.0', 'TRUE', 'Yes')


def get_periodos_curso(plan, equipo):
    """Devuelve todos los periodos esperados del curso completo para un plan."""
    meses = MESES_CURSO
    if es_con_alumnado(plan):
        meses = [(y, m) for y, m in meses if m != 9]

    p      = plan.get('Periodicidad', '')
    es_fin = es_momento_fin(plan.get('Operacion', ''))

    if p == 'Mensual':
        return [mes_str(y, m) for y, m in meses]

    if p == 'Trimestral':
        idx = [3, 6, 9] if es_fin else [0, 4, 7]
        return [mes_str(meses[i][0], meses[i][1]) for i in idx if i < len(meses)]

    if p == 'Semestral':
        idx = [4, 9] if es_fin else [0, 5]
        return [mes_str(meses[i][0], meses[i][1]) for i in idx if i < len(meses)]

    if p in ('Anual', 'Bianual', 'Trianual', 'Cada 2 años'):
        m = meses[-1] if es_fin else meses[0]
        return [mes_str(m[0], m[1])]

    if p == 'Pretemporada':
        return [f'pretemporada-{CURSO}']

    if p == 'Posttemporada':
        return [f'posttemporada-{CURSO}']

    return []


def fecha_para_periodo(periodo):
    """Devuelve una fecha de realización plausible para el periodo dado."""
    if periodo.startswith('pretemporada'):
        return '2025-09-10'
    if periodo.startswith('posttemporada'):
        return '2026-06-10'
    # Formato YYYY-MM → último día del mes
    año, mes = int(periodo[:4]), int(periodo[5:7])
    ultimo = calendar.monthrange(año, mes)[1]
    return f'{año}-{str(mes).zfill(2)}-{ultimo}'


def nuevo_id():
    chars = string.ascii_uppercase + string.digits
    return 'RM' + ''.join(random.choices(chars, k=6))


def main():
    sh = conectar()
    _, _, planes_list  = leer(sh, 'Planes_Mantenimiento')
    _, _, equipos_list = leer(sh, 'Equipos')
    ws_reg, headers_reg, registros = leer(sh, 'Registro_Mantenimientos')

    equipos = {e['ID_Activo']: e for e in equipos_list}

    # Índice de registros existentes para este curso
    existentes = {
        (r.get('ID_Plan', ''), r.get('Periodo', ''))
        for r in registros
        if r.get('Curso_Academico') == CURSO
    }
    print(f'Registros existentes en {CURSO}: {len(existentes)}')

    # Construir los registros nuevos
    nuevos = []
    ids_usados = {r.get('ID_Registro', '') for r in registros}

    for plan in planes_list:
        activo = str(plan.get('Activo', '')).strip().upper()
        if activo not in ('TRUE', 'SÍ', 'SI'):
            continue
        if plan.get('Tipo_Intervencion', '').strip() == 'Externo':
            continue
        equipo = equipos.get(plan.get('ID_Equipo', ''))
        if not equipo:
            continue

        for periodo in get_periodos_curso(plan, equipo):
            key = (plan['ID_Plan'], periodo)
            if key in existentes:
                continue  # ya existe, no duplicar

            # Evitar colisión de IDs
            rid = nuevo_id()
            while rid in ids_usados:
                rid = nuevo_id()
            ids_usados.add(rid)

            nuevos.append({
                'ID_Registro'    : rid,
                'ID_Plan'        : plan['ID_Plan'],
                'ID_Equipo'      : plan['ID_Equipo'],
                'Curso_Academico': CURSO,
                'Periodo'        : periodo,
                'Fecha_Realizacion': fecha_para_periodo(periodo),
                'Realizado_Por'  : REALIZADO_POR,
                ' Supervisado_Por': '',    # cabecera lleva espacio en Sheets
                'Observaciones'  : '',
            })

    print(f'Registros a insertar: {len(nuevos)}')
    if nuevos:
        # Muestra muestra de lo que se insertará
        for r in nuevos[:5]:
            print(f'  {r["ID_Plan"]} | {r["ID_Equipo"]} | {r["Periodo"]} | {r["Fecha_Realizacion"]}')
        if len(nuevos) > 5:
            print(f'  … y {len(nuevos) - 5} más')

    if dry_run := DRY_RUN:
        print('\n[DRY_RUN=True] No se ha escrito nada. Cambia DRY_RUN=False para insertar.')
        return

    if not nuevos:
        print('Nada que insertar.')
        return

    print(f'\nInsertando {len(nuevos)} registros…')
    insertar_varios(ws_reg, nuevos, headers=headers_reg)
    print('✓ Hecho.')


if __name__ == '__main__':
    main()
