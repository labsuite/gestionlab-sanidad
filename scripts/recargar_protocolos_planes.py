"""
recargar_protocolos_planes.py — Recarga en GestionLab los protocolos de uso y los planes
de mantenimiento generados en la carpeta de protocolos (protocolos.jsonl y
mantenimientos.jsonl, ver README_claude_code.md de esa carpeta).

1. equipos.protocolo_uso ← protocolos.jsonl (una línea por id_activo).
2. Planes: los activos de cada equipo del JSONL pasan a inactivos (no se borran) y se
   crean los del JSONL (sin la clave informativa `origen`). Los equipos «Dado de baja»
   no reciben planes nuevos.
3. Los registros que cuelgan de un plan ACTIVO (los del curso en marcha) pasan al plan
   nuevo del mismo equipo y la misma periodicidad. Si alguno no tiene equivalente, se
   para sin escribir nada. Los históricos (ya en planes inactivos) no se tocan.
4. Antes de escribir guarda una copia CSV de planes y registros en la carpeta de origen.

Simulación por defecto; `--aplicar` escribe todo en UNA transacción.
Uso: python scripts/recargar_protocolos_planes.py [--aplicar]
"""
import collections
import csv
import datetime
import json
import sys

sys.path.insert(0, 'scripts')
from base import conectar, generar_id
import psycopg2.extras

# ===========================================================================
# CONFIGURACIÓN
# ===========================================================================
CARPETA = r"C:/Users/Paloma/OneDrive/Escritorio/CIFP Manuel Antonio/B. Laboratorio/Protocolos/GestionLab/"
PERIODICIDADES = {'Mensual', 'Trimestral', 'Semestral', 'Anual', 'Bianual', 'Trianual',
                  'Pretemporada', 'Posttemporada'}
# ===========================================================================

APLICAR = '--aplicar' in sys.argv
conn = conectar()
cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)


def q(sql, args=None):
    cur.execute(sql, args)
    return [dict(r) for r in cur.fetchall()] if cur.description else cur.rowcount


print('MODO:', 'APLICAR' if APLICAR else 'SIMULACIÓN (nada se escribe)')
prot = [json.loads(l) for l in open(CARPETA + 'protocolos.jsonl', encoding='utf-8')]
mant = [json.loads(l) for l in open(CARPETA + 'mantenimientos.jsonl', encoding='utf-8')]
equipos = {r['id_activo']: r for r in q("select id_activo, estado_operativo, protocolo_uso from equipos")}
bajas = {i for i, e in equipos.items() if e['estado_operativo'] == 'Dado de baja'}

# ── Comprobaciones: si algo no cuadra, no se escribe nada ─────────────────
problemas = []
ids_prot = [p['id_activo'] for p in prot]
problemas += [f'protocolo de {i}: no existe en equipos' for i in ids_prot if i not in equipos]
problemas += [f'protocolo duplicado: {i}' for i, n in collections.Counter(ids_prot).items() if n > 1]
problemas += [f'protocolo vacío: {p["id_activo"]}' for p in prot if not (p.get('protocolo_uso') or '').strip()]
problemas += [f'plan de {m["id_equipo"]}: no existe en equipos' for m in mant if m['id_equipo'] not in equipos]
problemas += [f'periodicidad no reconocida: {m["id_equipo"]} {m["periodicidad"]}' for m in mant if m['periodicidad'] not in PERIODICIDADES]
problemas += [f'tipo raro: {m["id_equipo"]} {m["tipo_intervencion"]}' for m in mant if m['tipo_intervencion'] not in ('Interno', 'Externo')]
problemas += [f'equipo×periodicidad duplicado: {k}' for k, n in collections.Counter((m['id_equipo'], m['periodicidad']) for m in mant).items() if n > 1]

# ── 1. Protocolos ─────────────────────────────────────────────────────────
iguales = sum(1 for p in prot if p['id_activo'] in equipos and (equipos[p['id_activo']]['protocolo_uso'] or '') == p['protocolo_uso'])
print(f"\n1. Protocolos: {len(prot)} en el JSONL — {len(prot) - iguales} cambian, {iguales} ya eran idénticos")
sin = sorted(i for i in equipos if i not in set(ids_prot))
print(f"   equipos fuera del JSONL (no se tocan): {sin}")

# ── 2. Planes ─────────────────────────────────────────────────────────────
nuevos = [m for m in mant if m['id_equipo'] not in bajas]
omitidos = [(m['id_equipo'], m['periodicidad']) for m in mant if m['id_equipo'] in bajas]
eqs = sorted({m['id_equipo'] for m in mant})
activos = q("select id_plan, id_equipo, periodicidad from planes_mantenimiento where activo and id_equipo = any(%s)", (eqs,))
print(f"\n2. Planes: se desactivan {len(activos)}:", dict(collections.Counter(p['periodicidad'] for p in activos)))
print(f"   se crean {len(nuevos)}:", dict(collections.Counter(m['periodicidad'] for m in nuevos)))
print(f"   omitidos por equipo dado de baja: {omitidos}")
print("   operaciones de arranque/cierre:", dict(collections.Counter(
    m['operacion'] for m in nuevos if m['periodicidad'] in ('Pretemporada', 'Posttemporada'))))
fuera = q("select id_equipo, count(*) n from planes_mantenimiento where activo and not (id_equipo = any(%s)) group by 1", (eqs,))
print(f"   planes activos de equipos fuera del JSONL (no se tocan): {fuera}")

existentes = {r['id_plan'] for r in q("select id_plan from planes_mantenimiento")}
nuevo_id = {}
for m in nuevos:
    pid = generar_id('PM')
    while pid in existentes:
        pid = generar_id('PM')
    existentes.add(pid)
    nuevo_id[(m['id_equipo'], m['periodicidad'])] = pid

# ── 3. Registros que cuelgan de planes activos ────────────────────────────
regs = q("""select r.id_registro, r.id_equipo, r.curso_academico, r.periodo, r.estado, p.id_plan, p.periodicidad
            from registro_mantenimientos r join planes_mantenimiento p using(id_plan)
            where p.activo and p.id_equipo = any(%s) order by r.id_equipo""", (eqs,))
print(f"\n3. Registros en planes activos que se reasignan: {len(regs)}")
for r in regs:
    dest = nuevo_id.get((r['id_equipo'], r['periodicidad']))
    print(f"   {r['id_registro']} {r['id_equipo']} {r['curso_academico']} {r['periodo']} [{r['estado']}]: "
          f"{r['id_plan']} ({r['periodicidad']}) → {dest or 'SIN EQUIVALENTE'}")
    if not dest:
        problemas.append(f"registro {r['id_registro']} sin plan nuevo equivalente")
hist = q("""select r.curso_academico, r.estado, count(*) n from registro_mantenimientos r
            join planes_mantenimiento p using(id_plan) where not p.activo group by 1, 2""")
print(f"   en planes ya inactivos (no se tocan): {[(h['curso_academico'], h['estado'], h['n']) for h in hist]}")

if problemas:
    print('\n‼ NO CUADRA — no se escribe nada:')
    for p in problemas:
        print('  -', p)
    sys.exit(1)

if not APLICAR:
    conn.rollback()
    print('\n(simulación: nada escrito — `--aplicar` para guardar)')
    sys.exit(0)

# ── Copia previa y escritura ──────────────────────────────────────────────
hoy = datetime.date.today().isoformat()
for t in ['planes_mantenimiento', 'registro_mantenimientos']:
    with conn.cursor() as c2:
        c2.execute(f'select * from {t} order by 1')
        ruta = CARPETA + f'copia_{t}_antes_recarga_{hoy}.csv'
        with open(ruta, 'w', newline='', encoding='utf-8-sig') as f:
            w = csv.writer(f)
            w.writerow([d[0] for d in c2.description])
            w.writerows(c2.fetchall())
    print(f'Copia: {ruta}')

for p in prot:
    q("update equipos set protocolo_uso=%s where id_activo=%s", (p['protocolo_uso'], p['id_activo']))
for m in nuevos:
    q("""insert into planes_mantenimiento (id_plan, id_equipo, tipo_intervencion, periodicidad, operacion,
                                           instrucciones, solo_profesorado, activo)
         values (%s, %s, %s, %s, %s, %s, %s, %s)""",
      (nuevo_id[(m['id_equipo'], m['periodicidad'])], m['id_equipo'], m['tipo_intervencion'], m['periodicidad'],
       m['operacion'], m['instrucciones'], bool(m['solo_profesorado']), bool(m.get('activo', True))))
for r in regs:
    q("update registro_mantenimientos set id_plan=%s, actualizado_en=now() where id_registro=%s",
      (nuevo_id[(r['id_equipo'], r['periodicidad'])], r['id_registro']))
q("update planes_mantenimiento set activo=false where id_plan = any(%s)", ([p['id_plan'] for p in activos],))

n = q("select count(*) n from planes_mantenimiento where activo and id_equipo = any(%s)", (eqs,))[0]['n']
assert n == len(nuevos), f'activos {n} ≠ creados {len(nuevos)}'
conn.commit()
print(f'\n✓ COMMIT hecho — {len(prot)} protocolos, {n} planes activos, {len(regs)} registros reasignados')
