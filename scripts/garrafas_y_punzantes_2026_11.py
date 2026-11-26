"""
Garrafas de 5 L y punzantes (2026-11-26, indicaciones de la usuaria).

1. Las garrafas de 5 L son como las bolsas: cada una es para UNA cosa. La
   categoría «Garrafa etanol y X-Free» se divide en tres:
     Garrafa 5 L - Etanol / Garrafa 5 L - X-Free / Garrafa 5 L - Parafina
   La garrafa que ya estaba dada de alta (207, bajo la encimera) pasa a ser la de
   etanol y se dan de alta las otras dos en el mismo sitio. La «Parafina con restos
   de X-Free» (antes en el bidón de no halogenados) va a la de parafina.
2. Contenedores amarillos de punzantes («Residuo Cortante») en los labs 203 y 207.

Idempotente. Uso:
  python scripts/garrafas_y_punzantes_2026_11.py            (simulación)
  python scripts/garrafas_y_punzantes_2026_11.py --aplicar  (guarda)
"""
import sys, datetime
sys.path.insert(0, 'scripts')
from base import conectar, generar_id

DRY_RUN = "--aplicar" not in sys.argv   # simulación por defecto

ANTES = 'Garrafa etanol y X-Free'
ETANOL, XFREE, PARAFINA = 'Garrafa 5 L - Etanol', 'Garrafa 5 L - X-Free', 'Garrafa 5 L - Parafina'
CORTANTE = 'Residuo Cortante'

TIPOS = {  # id_residuo → (categoría, descripción nueva o None)
    'R015': (ETANOL, None),
    'R016': (XFREE, None),
    'R001': (PARAFINA, 'Parafina usada, con restos de sustituto de xileno (X-Free), tras el procesado histológico. '
                       'Va a su garrafa de 5 L; los bloques con tejido y los cortes van a la basura normal.'),
}
NUEVOS = [  # (categoría, lab, zona, formato)
    (XFREE, '207', 'Bajo la encimera', 'Garrafa 5L'),
    (PARAFINA, '207', 'Bajo la encimera', 'Garrafa 5L'),
    (CORTANTE, '203', None, 'Contenedor rígido amarillo'),
    (CORTANTE, '207', None, 'Contenedor rígido amarillo'),
]

conn = conectar(); cur = conn.cursor()
cambios = 0

def hacer(msg, sql, args):
    global cambios
    print(msg); cambios += 1
    if not DRY_RUN:
        cur.execute(sql, args)

for tabla, col in (('contenedores_residuo', 'categoria'), ('excepciones_residuo_ia', 'categoria_contenedor')):
    cur.execute(f"select count(*) from {tabla} where {col}=%s", (ANTES,))
    n = cur.fetchone()[0]
    if n:
        hacer(f"{tabla}: {n} × «{ANTES}» → «{ETANOL}»", f"update {tabla} set {col}=%s where {col}=%s", (ETANOL, ANTES))

for id_, (cat, desc) in TIPOS.items():
    cur.execute("select nombre, contenedor_tipo, descripcion from tipos_residuo where id_residuo=%s", (id_,))
    fila = cur.fetchone()
    if not fila: print(f"⚠ NO ENCONTRADO: {id_}"); continue
    if fila[1] == cat and (desc is None or fila[2] == desc): continue
    hacer(f"{id_}  {fila[0]}  [{fila[1]} → {cat}]{'  (+descripción)' if desc else ''}",
          "update tipos_residuo set contenedor_tipo=%s, descripcion=coalesce(%s, descripcion) where id_residuo=%s",
          (cat, desc, id_))

cur.execute("select count(*) from tipos_residuo where contenedor_tipo=%s", (ANTES,))
n = cur.fetchone()[0]
if n: print(f"⚠ quedan {n} tipos en «{ANTES}» sin garrafa asignada")

hoy = datetime.date.today()
for cat, lab, zona, formato in NUEVOS:
    cur.execute("select 1 from contenedores_residuo where categoria=%s and lab=%s and estado='activo'", (cat, lab))
    if cur.fetchone(): continue
    hacer(f"+ contenedor  {cat}  lab {lab} · {zona or '—'} · {formato}",
          """insert into contenedores_residuo
             (id_contenedor, categoria, lab, zona, formato, nivel, estado, fecha_apertura, fecha_actualizacion, actualizado_por)
             values (%s,%s,%s,%s,%s,'vacío','activo',%s,now(),'Paloma Fernández')""",
          (generar_id('RC'), cat, lab, zona, formato, hoy))

if DRY_RUN:
    conn.rollback()
    print(f"\nSIMULACIÓN: {cambios} cambios. Ejecuta con --aplicar para guardarlos.")
else:
    conn.commit()
    print(f"\nGuardado: {cambios} cambios.")
