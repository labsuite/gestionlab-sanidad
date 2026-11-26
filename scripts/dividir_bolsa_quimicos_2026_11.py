"""
Divide la categoría "Bolsa plástica (químicos)" en las TRES bolsas reales (2026-11-26).

Las bolsas del gestor son iguales, pero cada una se marca con una X en su
etiqueta para una sola cosa (lo explica el clip «La bolsa del 207» y la usuaria):
  - envases de plástico vacíos que contuvieron sustancias peligrosas
  - envases metálicos (aluminio) vacíos
  - guantes, papel, filtros, absorbentes… manchados con sustancias peligrosas
(la cuarta casilla, decapado y pintura, no aplica al laboratorio).

Qué hace:
  - Renombra la categoría de los dos tipos que había y separa "plástico o
    aluminio" en dos tipos (uno nuevo para metálicos).
  - La bolsa que ya estaba dada de alta (lab 207, Almacén de residuos, vacía,
    sin adiciones) pasa a ser la de envases de plástico, y se dan de alta las
    otras dos en el mismo sitio.
  - Arrastra la categoría en excepciones_residuo_ia (no había ninguna).

Idempotente. Uso:
  python scripts/dividir_bolsa_quimicos_2026_11.py            (simulación)
  python scripts/dividir_bolsa_quimicos_2026_11.py --aplicar  (guarda)
"""
import sys, datetime
sys.path.insert(0, 'scripts')
from base import conectar, generar_id

DRY_RUN = "--aplicar" not in sys.argv   # simulación por defecto

ANTES = 'Bolsa plástica (químicos)'
PLASTICO = 'Bolsa químicos - Envases de plástico'
METAL = 'Bolsa químicos - Envases metálicos'
GUANTES = 'Bolsa químicos - Guantes, papel y absorbentes'

# id_residuo existente → (nombre nuevo, categoría, descripción)
TIPOS = {
    'RESNLOFGQ': ('Envases vacíos de plástico que contuvieron sustancias peligrosas', PLASTICO,
                  'Frascos, botellas y botes de plástico vacíos. Bien cerrados, para que no se acumule líquido '
                  'en el fondo de la bolsa. Los envases metálicos van a su propia bolsa.'),
    'RESBVQHGW': ('Guantes, papel, filtros y absorbentes manchados con sustancias peligrosas', GUANTES,
                  'Absorbentes, materiales de filtración, guantes y ropa de protección que han tocado o absorbido '
                  'un líquido peligroso. Si es con disolventes volátiles (xilol, etanol…), meterlo antes en una '
                  'bolsa zip (la bolsa va abierta). Un guante que no ha tocado nada peligroso no va aquí.'),
}
TIPO_NUEVO = ('Envases vacíos metálicos (aluminio) que contuvieron sustancias peligrosas', METAL,
              'Botes y latas de aluminio u otro metal, vacíos. Bien cerrados, para que no se acumule líquido en el '
              'fondo de la bolsa. Los envases de plástico van a su propia bolsa.')

BOLSA_EXISTENTE = 'RCLU9ARC'   # lab 207, Almacén de residuos
LAB, ZONA, FORMATO = '207', 'Almacén de residuos', 'Bolsa plástica'

conn = conectar(); cur = conn.cursor()
cambios = 0

for id_, (nombre, cat, desc) in TIPOS.items():
    cur.execute("select nombre, contenedor_tipo, descripcion from tipos_residuo where id_residuo=%s", (id_,))
    fila = cur.fetchone()
    if not fila:
        print(f"⚠ NO ENCONTRADO: {id_}"); continue
    if fila == (nombre, cat, desc): continue
    print(f"{id_}  {fila[0]}\n      → {nombre}  [{fila[1]} → {cat}]"); cambios += 1
    if not DRY_RUN:
        cur.execute("update tipos_residuo set nombre=%s, contenedor_tipo=%s, descripcion=%s where id_residuo=%s",
                    (nombre, cat, desc, id_))

cur.execute("select 1 from tipos_residuo where nombre=%s", (TIPO_NUEVO[0],))
if not cur.fetchone():
    print(f"+ tipo  {TIPO_NUEVO[0]}  → {METAL}"); cambios += 1
    if not DRY_RUN:
        cur.execute("insert into tipos_residuo (id_residuo, nombre, descripcion, riesgo, contenedor_tipo) values (%s,%s,%s,null,%s)",
                    (generar_id('RES'), TIPO_NUEVO[0], TIPO_NUEVO[2], METAL))

cur.execute("select categoria from contenedores_residuo where id_contenedor=%s", (BOLSA_EXISTENTE,))
fila = cur.fetchone()
if fila and fila[0] == ANTES:
    print(f"contenedor {BOLSA_EXISTENTE} (lab {LAB})  {ANTES} → {PLASTICO}"); cambios += 1
    if not DRY_RUN:
        cur.execute("update contenedores_residuo set categoria=%s where id_contenedor=%s", (PLASTICO, BOLSA_EXISTENTE))

cur.execute("select count(*) from contenedores_residuo where categoria=%s", (ANTES,))
n = cur.fetchone()[0]
if n:
    print(f"⚠ quedan {n} contenedores más con «{ANTES}» (cerrados/recogidos?) → {PLASTICO}"); cambios += 1
    if not DRY_RUN:
        cur.execute("update contenedores_residuo set categoria=%s where categoria=%s", (PLASTICO, ANTES))

cur.execute("select count(*) from excepciones_residuo_ia where categoria_contenedor=%s", (ANTES,))
n = cur.fetchone()[0]
if n:
    print(f"excepciones IA: {n} con «{ANTES}» → {PLASTICO}"); cambios += 1
    if not DRY_RUN:
        cur.execute("update excepciones_residuo_ia set categoria_contenedor=%s where categoria_contenedor=%s", (PLASTICO, ANTES))

hoy = datetime.date.today()
for cat in (METAL, GUANTES):
    cur.execute("select 1 from contenedores_residuo where categoria=%s and lab=%s and estado='activo'", (cat, LAB))
    if cur.fetchone(): continue
    print(f"+ contenedor  {cat}  lab {LAB} · {ZONA} · {FORMATO}"); cambios += 1
    if not DRY_RUN:
        cur.execute("""insert into contenedores_residuo
            (id_contenedor, categoria, lab, zona, formato, nivel, estado, fecha_apertura, fecha_actualizacion, actualizado_por)
            values (%s,%s,%s,%s,%s,'vacío','activo',%s,now(),'Paloma Fernández')""",
            (generar_id('RC'), cat, LAB, ZONA, FORMATO, hoy))

if DRY_RUN:
    conn.rollback()
    print(f"\nSIMULACIÓN: {cambios} cambios. Ejecuta con --aplicar para guardarlos.")
else:
    conn.commit()
    print(f"\nGuardado: {cambios} cambios.")
