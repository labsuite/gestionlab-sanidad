"""
Recoloca los textos de las ubicaciones en dos ideas (decisión de 2026-11-25):

  zona                 → LOCALIZACIÓN: dónde está, de lo general a lo concreto
                         ("Izquierda · 2º cajón encimera"). El primer tramo
                         (antes del primer " · ") es el que agrupa en los desplegables.
  subzona              → USO / CONTENIDO: qué se guarda ("Micropipetas").
  descripcion_completa → OBSERVACIONES: notas; no sale en las etiquetas.

Hasta ahora la posición estaba repartida entre zona y subzona (y a veces en la
descripción: "1º Cajón", "Encimera"), y el contenido estaba casi siempre en la
descripción (y en dos neveras, en la subzona).

Reglas:
  - Subzona de posición  → se añade a la localización.
  - Subzona de contenido → se queda como uso (SUBZONA_ES_USO).
  - Descripción de posición  → se añade a la localización (DESC_ES_POSICION).
  - Descripción de contenido → pasa a uso; si ya había uso y dice lo mismo, se descarta.
  - Casos especiales en ESPECIALES (texto largo: el uso se resume y el texto
    original se queda en observaciones, sin perder nada).

Guarda antes una copia CSV de la tabla en scripts/copias/.

Uso:  python scripts/reorganizar_ubicaciones_2026_11.py            (simulación)
      python scripts/reorganizar_ubicaciones_2026_11.py --aplicar  (guarda)
"""
import sys, os, csv, re, datetime
sys.path.insert(0, 'scripts')
from base import conectar

DRY_RUN = "--aplicar" not in sys.argv

# Subzonas que en realidad dicen qué se guarda, no dónde está.
SUBZONA_ES_USO = {'205-ZC-REF-02', '205-ZC-REF-03'}

# Descripciones que dicen dónde está, no qué se guarda.
RE_DESC_POSICION = re.compile(r'^(\d+º\s*caj[oó]n|encimera)$', re.I)
DESC_ES_POSICION = {'205-ZC', '205-ZC-CONX-01', '207-1.1'}

# id → (uso, observaciones). Para lo que no encaja en las reglas.
ESPECIALES = {
    '205-AUTOCLAVES': ('Material necesario para poner un autoclave en marcha', None),  # observaciones: el texto original
}


def limpia(s):
    return re.sub(r'\s+', ' ', (s or '').strip()).rstrip('.').strip()


def juntar(partes):
    res = []
    for p in partes:
        p = limpia(p)
        if p and not any(p.lower() in x.lower() for x in res):
            res.append(p)
    return ' · '.join(res)


c = conectar(); cur = c.cursor()
cur.execute("select id_ubicacion, laboratorio_aula, zona, subzona, descripcion_completa, activa "
            "from ubicaciones order by id_ubicacion")
filas = cur.fetchall()

cambios = []
for idu, lab, zona, sub, desc, activa in filas:
    loc, uso, obs = [zona], [], desc   # obs por defecto: se conserva solo si no se mueve
    if sub:
        (uso if idu in SUBZONA_ES_USO else loc).append(sub)
    if idu in ESPECIALES:
        u, o = ESPECIALES[idu]
        uso = [u]
        obs = desc if o is None else o
    elif desc:
        if idu in DESC_ES_POSICION or RE_DESC_POSICION.match(limpia(desc)):
            loc.append(desc); obs = None
        else:
            if not uso:
                uso.append(desc)
            obs = None   # contenido: pasa a uso (o es igual al uso que ya había)
    nueva = (juntar(loc) or None, juntar(uso) or None, (obs or '').strip() or None)
    if nueva != (zona, sub, desc):
        cambios.append((idu, (zona, sub, desc), nueva))

print(f"{len(filas)} ubicaciones, {len(cambios)} cambian.\n")
for idu, antes, despues in cambios:
    print(idu)
    print(f"   antes:   zona={antes[0]!r}  subzona={antes[1]!r}  desc={antes[2]!r}")
    print(f"   después: LOCALIZACIÓN={despues[0]!r}  USO={despues[1]!r}  OBS={despues[2]!r}")

if DRY_RUN:
    print('\nSIMULACIÓN — nada guardado. Ejecutar con --aplicar para guardar.')
    sys.exit(0)

os.makedirs('scripts/copias', exist_ok=True)
copia = f"scripts/copias/ubicaciones_{datetime.datetime.now():%Y%m%d_%H%M%S}.csv"
with open(copia, 'w', newline='', encoding='utf-8') as f:
    w = csv.writer(f)
    w.writerow(['id_ubicacion', 'laboratorio_aula', 'zona', 'subzona', 'descripcion_completa', 'activa'])
    w.writerows(filas)
print(f'\nCopia guardada en {copia}')

for idu, _, (z, s, d) in cambios:
    cur.execute("update ubicaciones set zona=%s, subzona=%s, descripcion_completa=%s where id_ubicacion=%s",
                (z, s, d, idu))
c.commit()
print(f'APLICADO: {len(cambios)} ubicaciones.')
