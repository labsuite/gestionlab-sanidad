"""
asignar_tandas_calibracion.py — Reparte la calibración externa de micropipetas y Multipette
en tandas (decisión de Paloma, 2026-11-25): una tanda por curso, por modelos enteros.

Lee calibracion_externa_tandas.csv de la carpeta de protocolos (id_activo, marca, modelo,
grupo, tanda, curso_primera_calibracion) y escribe ese curso en
planes_mantenimiento.curso_inicio de cada plan ACTIVO «Calibración externa» (Quinquenal).
La app no pide el plan antes de ese curso; desde entonces, hasta que se haga, y luego cada
5 años desde la última vez (_esCursoDebidoMultianual en js/mantenimiento.js).

Los planes cuyo equipo no está en la lista van a la tanda de su modelo (misma marca y
modelo en la lista; si no, mismo modelo; si no, misma marca con una sola tanda) y se listan
para avisar. Si alguno no encaja en una tanda clara, no se escribe nada.

Solo toca curso_inicio. Ejecutar de nuevo si el chat del laboratorio regenera el CSV
(idempotente). Desde la app también se cambia, plan a plan («Primer curso» en el plan).

Simulación por defecto; `--aplicar` para guardar.
Uso: python scripts/asignar_tandas_calibracion.py [--aplicar]
"""
import collections
import csv
import sys

sys.path.insert(0, 'scripts')
from base import conectar

CARPETA = r"C:/Users/Paloma/OneDrive/Escritorio/CIFP Manuel Antonio/B. Laboratorio/Protocolos/GestionLab/"
ARCHIVO = CARPETA + 'calibracion_externa_tandas.csv'
APLICAR = '--aplicar' in sys.argv
OPERACION = 'Calibración externa'


def norm(s):
    return ' '.join((s or '').lower().split())


filas = list(csv.DictReader(open(ARCHIVO, encoding='utf-8-sig')))
lista = {f['id_activo'].strip(): f for f in filas}
print('MODO:', 'APLICAR' if APLICAR else 'SIMULACIÓN (nada se escribe)')
print(f'{ARCHIVO}: {len(lista)} unidades')
print('  por curso:', dict(sorted(collections.Counter(f['curso_primera_calibracion'] for f in filas).items())))

# Tanda de cada modelo, para lo que no esté en la lista. Un modelo con dos cursos distintos
# en la lista no sirve para deducir nada.
def indice(clave):
    idx = collections.defaultdict(set)
    for f in filas:
        idx[clave(f)].add(f['curso_primera_calibracion'])
    return idx
por_marca_modelo = indice(lambda f: (norm(f['marca']), norm(f['modelo'])))
por_modelo = indice(lambda f: norm(f['modelo']))
por_marca = indice(lambda f: norm(f['marca']))

conn = conectar()
cur = conn.cursor()
cur.execute("""select p.id_plan, p.id_equipo, p.curso_inicio, e.marca, e.modelo, e.estado_operativo
               from planes_mantenimiento p join equipos e on e.id_activo = p.id_equipo
               where p.activo and p.periodicidad = 'Quinquenal' and p.operacion = %s
               order by p.id_equipo""", (OPERACION,))
planes = cur.fetchall()
print(f'Planes activos «{OPERACION}» (Quinquenal): {len(planes)}')

problemas, cambios, deducidos = [], [], []
for id_plan, id_eq, actual, marca, modelo, estado in planes:
    if id_eq in lista:
        curso = lista[id_eq]['curso_primera_calibracion'].strip()
    else:
        curso = None
        for idx, k, como in [(por_marca_modelo, (norm(marca), norm(modelo)), 'marca y modelo'),
                             (por_modelo, norm(modelo), 'modelo'),
                             (por_marca, norm(marca), 'marca')]:
            if len(idx.get(k, ())) == 1:
                curso = next(iter(idx[k]))
                deducidos.append((id_eq, marca, modelo, estado, curso, como))
                break
        if not curso:
            problemas.append(f'{id_eq} ({marca} {modelo}) no está en la lista y su modelo no tiene una tanda clara')
            continue
    if actual != curso:
        cambios.append((id_plan, id_eq, actual, curso))

en_lista_sin_plan = sorted(set(lista) - {p[1] for p in planes})
if en_lista_sin_plan:
    print('⚠ En la lista pero sin plan activo de calibración externa (no se tocan):', en_lista_sin_plan)
if deducidos:
    print(f'\nNo están en la lista; van a la tanda de su modelo ({len(deducidos)}):')
    for id_eq, marca, modelo, estado, curso, como in deducidos:
        print(f'  {id_eq}  {marca} {modelo} [{estado}] → {curso} (por {como})')

print(f'\nCambian {len(cambios)} planes; {len(planes) - len(cambios) - len(problemas)} ya tenían su curso.')
print('  resultado por curso:', dict(sorted(collections.Counter(
    c for _, _, _, c in cambios).items())))
for id_plan, id_eq, actual, curso in cambios[:200]:
    print(f'  {id_plan} {id_eq}: {actual or "—"} → {curso}')

if problemas:
    print('\n✗ No se escribe nada:')
    for p in problemas:
        print('  -', p)
    sys.exit(1)

if not APLICAR:
    conn.rollback()
    print('\n(simulación: nada escrito — `--aplicar` para guardar)')
    sys.exit(0)

for id_plan, _, _, curso in cambios:
    cur.execute('update planes_mantenimiento set curso_inicio = %s where id_plan = %s', (curso, id_plan))
conn.commit()
print(f'\n✓ COMMIT hecho — curso_inicio en {len(cambios)} planes')
