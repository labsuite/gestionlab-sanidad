#!/usr/bin/env python3
"""
rellenar_mantenimientos.py
Inserta en registro_mantenimientos todos los periodos del curso indicado
para los planes activos, como si se hubieran realizado.
Omite automáticamente los que ya tienen registro existente.

Con DRY_RUN=True solo muestra qué se insertaría.
"""

import sys
import os
import calendar

sys.path.insert(0, os.path.dirname(__file__))
from base import conectar, leer, insertar_varios, generar_id

# ─────────────── CONFIGURACIÓN ───────────────
CURSO          = '2025-2026'
REALIZADO_POR  = 'Paloma'    # Nombre que aparece en "realizado_por"
DRY_RUN        = True        # Cambiar a False para escribir en Supabase
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
    return bool(plan.get('con_alumnado'))


def get_periodos_curso(plan, equipo):
    """Devuelve todos los periodos esperados del curso completo para un plan."""
    meses = MESES_CURSO
    if es_con_alumnado(plan):
        meses = [(y, m) for y, m in meses if m != 9]

    p      = plan.get('periodicidad', '')
    es_fin = es_momento_fin(plan.get('operacion', ''))

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


def main():
    conn = conectar()
    _, _, planes_list  = leer(conn, 'planes_mantenimiento')
    _, _, equipos_list = leer(conn, 'equipos')
    t_reg, _, registros = leer(conn, 'registro_mantenimientos')

    equipos = {e['id_activo']: e for e in equipos_list}

    # Índice de registros existentes para este curso
    existentes = {
        (r.get('id_plan', ''), r.get('periodo', ''))
        for r in registros
        if r.get('curso_academico') == CURSO
    }
    print(f'Registros existentes en {CURSO}: {len(existentes)}')

    # Construir los registros nuevos
    nuevos = []
    ids_usados = {r.get('id_registro', '') for r in registros}

    for plan in planes_list:
        if not plan.get('activo'):
            continue
        if (plan.get('tipo_intervencion') or '').strip() == 'Externo':
            continue
        equipo = equipos.get(plan.get('id_equipo', ''))
        if not equipo:
            continue

        for periodo in get_periodos_curso(plan, equipo):
            key = (plan['id_plan'], periodo)
            if key in existentes:
                continue  # ya existe, no duplicar

            # Evitar colisión de IDs
            rid = generar_id('RM')
            while rid in ids_usados:
                rid = generar_id('RM')
            ids_usados.add(rid)

            nuevos.append({
                'id_registro'      : rid,
                'id_plan'          : plan['id_plan'],
                'id_equipo'        : plan['id_equipo'],
                'curso_academico'  : CURSO,
                'periodo'          : periodo,
                'fecha_realizacion': fecha_para_periodo(periodo),
                'realizado_por'    : REALIZADO_POR,
                'supervisado_por'  : None,
                'observaciones'    : None,
            })

    print(f'Registros a insertar: {len(nuevos)}')
    if nuevos:
        for r in nuevos[:5]:
            print(f'  {r["id_plan"]} | {r["id_equipo"]} | {r["periodo"]} | {r["fecha_realizacion"]}')
        if len(nuevos) > 5:
            print(f'  … y {len(nuevos) - 5} más')

    if DRY_RUN:
        print('\n[DRY_RUN=True] No se ha escrito nada. Cambia DRY_RUN=False para insertar.')
        conn.close()
        return

    if not nuevos:
        print('Nada que insertar.')
        conn.close()
        return

    print(f'\nInsertando {len(nuevos)} registros…')
    insertar_varios(t_reg, nuevos)
    print('✓ Hecho.')
    conn.close()


if __name__ == '__main__':
    main()
