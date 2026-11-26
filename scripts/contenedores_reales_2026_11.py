"""
Ajusta las categorías y los contenedores de residuos a los contenedores reales
(lista de la usuaria del 2026-11-26 y clips de «B. Laboratorio/Residuos»).

1. Los bidones de ballesta del 207 toman el nombre con que los reconoce el alumnado:
     Contenedor Inertes → Bidón no halogenados
     Contenedor Ácidos → Bidón ácidos
     Contenedor Halogenados → Bidón halogenados
2. «Bolsa de autoclave» y «Residuo Biológico GII» eran el mismo contenedor: el
   negro con bolsa de autoclave, que va al autoclave del gestor → «Contenedor negro (autoclave)».
3. El contenedor azul de incineración del 207 estaba como «Citotóxicos»: es el de
   «Muestras en formol» (citotóxicos casi no se usan).
4. Categoría nueva «Garrafa etanol y X-Free» (garrafas de 5 L, cerradas con
   parafilm): pasan a ella los tipos de etanol y de X-Free.
5. Categoría nueva «Bidón vidrio vacío»: el tipo R010 (frascos vacíos enjuagados)
   pasa a ser el de envases de vidrio vacíos (los de plástico ya tienen su bolsa).
6. Formato de los bidones del 207 = «Bidón azul de ballesta»; alta de los
   contenedores que faltaban en el 207 (halogenados, vidrio, negro, garrafa de etanol).

No toca las garrafas de colorantes ni los de punzantes (no consta en qué
laboratorios hay): se dan de alta desde la app.

⚠ NO volver a ejecutarlo: la garrafa de etanol y X-Free se dividió en tres después
(garrafas_y_punzantes_2026_11.py) y este script la volvería a crear.

Idempotente. Uso:
  python scripts/contenedores_reales_2026_11.py            (simulación)
  python scripts/contenedores_reales_2026_11.py --aplicar  (guarda)
"""
import sys, datetime
sys.path.insert(0, 'scripts')
from base import conectar, generar_id

DRY_RUN = "--aplicar" not in sys.argv   # simulación por defecto

NO_HAL, ACIDOS, HAL = 'Bidón no halogenados', 'Bidón ácidos', 'Bidón halogenados'
NEGRO = 'Contenedor negro (autoclave)'
FORMOL = 'Muestras en formol'
GARRAFA = 'Garrafa etanol y X-Free'
VIDRIO = 'Bidón vidrio vacío'
BALLESTA = 'Bidón azul de ballesta'
ALMACEN = 'Almacén de residuos'

RENOMBRAR = {
    'Contenedor Inertes': NO_HAL, 'Contenedor Ácidos': ACIDOS, 'Contenedor Halogenados': HAL,
    'Bolsa de autoclave': NEGRO, 'Residuo Biológico GII': NEGRO, 'Citotóxicos': FORMOL,
}
A_GARRAFA = ['Etanol (cualquier graduación)', 'X-Free solo o con restos de etanol']
R010 = ('R010', 'Envases de vidrio vacíos que contuvieron productos químicos',
        'Frascos y botellas de vidrio vacíos que contuvieron reactivos o disolventes. Los envases de plástico y '
        'los metálicos van a sus bolsas de químicos.')

# id_contenedor → formato correcto (bidones de ballesta del 207 y el azul de incineración)
FORMATOS = {'RC7GEDY5': BALLESTA, 'RC7GPRIS': BALLESTA, 'RCQGWSGC': BALLESTA, 'RC7EWAA9': 'Contenedor rígido azul'}

NUEVOS = [  # (categoría, zona, formato) — todos en el 207
    (HAL, ALMACEN, BALLESTA),
    (VIDRIO, ALMACEN, BALLESTA),
    (NEGRO, ALMACEN, 'Contenedor rígido negro'),
    (GARRAFA, 'Bajo la encimera', 'Garrafa 5L'),
]

conn = conectar(); cur = conn.cursor()
cambios = 0

def hacer(msg, sql, args):
    global cambios
    print(msg); cambios += 1
    if not DRY_RUN:
        cur.execute(sql, args)

for viejo, nuevo in RENOMBRAR.items():
    for tabla, col in (('tipos_residuo', 'contenedor_tipo'), ('contenedores_residuo', 'categoria'),
                       ('excepciones_residuo_ia', 'categoria_contenedor')):
        cur.execute(f"select count(*) from {tabla} where {col}=%s", (viejo,))
        n = cur.fetchone()[0]
        if n:
            hacer(f"{tabla}: {n} × «{viejo}» → «{nuevo}»",
                  f"update {tabla} set {col}=%s where {col}=%s", (nuevo, viejo))

for nombre in A_GARRAFA:
    cur.execute("select id_residuo, contenedor_tipo from tipos_residuo where nombre=%s", (nombre,))
    fila = cur.fetchone()
    if not fila: print(f"⚠ NO ENCONTRADO: {nombre}"); continue
    if fila[1] != GARRAFA:
        hacer(f"{fila[0]}  {nombre}  [{fila[1]} → {GARRAFA}]",
              "update tipos_residuo set contenedor_tipo=%s where id_residuo=%s", (GARRAFA, fila[0]))

cur.execute("select nombre, contenedor_tipo, descripcion from tipos_residuo where id_residuo=%s", (R010[0],))
fila = cur.fetchone()
if fila and fila != (R010[1], VIDRIO, R010[2]):
    hacer(f"{R010[0]}  {fila[0]}\n      → {R010[1]}  [{fila[1]} → {VIDRIO}]",
          "update tipos_residuo set nombre=%s, contenedor_tipo=%s, descripcion=%s where id_residuo=%s",
          (R010[1], VIDRIO, R010[2], R010[0]))

for id_c, formato in FORMATOS.items():
    cur.execute("select formato from contenedores_residuo where id_contenedor=%s", (id_c,))
    fila = cur.fetchone()
    if fila and fila[0] != formato:
        hacer(f"contenedor {id_c}: formato «{fila[0]}» → «{formato}»",
              "update contenedores_residuo set formato=%s where id_contenedor=%s", (formato, id_c))

hoy = datetime.date.today()
for cat, zona, formato in NUEVOS:
    # En simulación los renombres no se han guardado: se mira también el nombre antiguo.
    antiguos = [v for v, n in RENOMBRAR.items() if n == cat]
    cur.execute("select 1 from contenedores_residuo where categoria = any(%s) and lab='207' and estado='activo'",
                ([cat] + antiguos,))
    if cur.fetchone(): continue
    hacer(f"+ contenedor  {cat}  lab 207 · {zona} · {formato}",
          """insert into contenedores_residuo
             (id_contenedor, categoria, lab, zona, formato, nivel, estado, fecha_apertura, fecha_actualizacion, actualizado_por)
             values (%s,%s,'207',%s,%s,'vacío','activo',%s,now(),'Paloma Fernández')""",
          (generar_id('RC'), cat, zona, formato, hoy))

if DRY_RUN:
    conn.rollback()
    print(f"\nSIMULACIÓN: {cambios} cambios. Ejecuta con --aplicar para guardarlos.")
else:
    conn.commit()
    print(f"\nGuardado: {cambios} cambios.")
