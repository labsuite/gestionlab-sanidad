"""
Recoloca el catálogo de residuos según las normas del gestor (2026-10-01),
con las decisiones que tomó la usuaria ese mismo día:

1. Efluente del lavador de ELISA            → Aguas Laboratorio
2. Reactivos de autoanalizadores (Pendiente) → Aguas Laboratorio
3. Tejidos fijados en formol                 → Muestras en formol (categoría del gestor)
4. Agua con formol / fijador de citometría   → Aguas Laboratorio
5. Frotis y portas teñidos                   → Basura normal (protegidos)
6. "Frasco Propio" ES el salvavidas          → se renombra a "Reactivos de laboratorio"
7. Tinciones, también con etanol/metanol     → Aguas Laboratorio
8. Alta de la bolsa plástica de químicos y del salvavidas como contenedores
   (lab 207, Almacén de residuos — donde están los demás químicos) y dos
   tipos nuevos para la bolsa.

Solo cambia Contenedor_Tipo (y la descripción cuando contradecía el destino
nuevo). Idempotente: lo ya movido no se vuelve a tocar.

Uso:  python scripts/recolocar_residuos_2026_10.py            (simulación)
      python scripts/recolocar_residuos_2026_10.py --aplicar  (guarda)
"""
import sys, datetime
sys.path.insert(0, 'scripts')
from base import conectar, generar_id

DRY_RUN = "--aplicar" not in sys.argv   # simulación por defecto

AGUAS = 'Aguas Laboratorio'
FORMOL = 'Muestras en formol'
BASURA = 'Basura normal (protegidos)'
SALVAVIDAS = 'Reactivos de laboratorio'
BOLSA = 'Bolsa plástica (químicos)'

# nombre exacto → (categoría nueva, descripción nueva o None para dejarla)
MOVER = {
    # 1
    'Efluente del lavador de microplacas (ELISA)': (AGUAS,
        'Mezcla de solución de lavado PBS-Tween + trazas de TMB oxidado + solución de parada ácida + restos de muestra '
        'generada en el depósito del lavador de placas HEALEES PW 812. Va a aguas de laboratorio, como lo que generan '
        'los aparatos automáticos de diagnóstico (norma del gestor, 2026-10).'),
    # 2
    'Reactivos bioquímicos de autoanalizador (Metrolab 2300)': (AGUAS, None),
    'Reactivos de quimioluminiscencia (Maglumi 600)': (AGUAS, None),
    'Reactivos de coagulometría (tromboplastina y tampones)': (AGUAS, None),
    'Antisueros y reactivos líquidos del sistema Ortho (inmunohematología)': (AGUAS, None),
    # 3
    'Tejidos fijados en formol': (FORMOL,
        'Piezas anatómicas en formol (o etanol) CON la muestra dentro. Contenedor cuadrado azul: va a incinerar. '
        'El formol ya sin la muestra no va aquí: va a disolventes no halogenados (Contenedor Inertes).'),
    # 4
    'Agua con restos de formol': (AGUAS,
        'Agua de lavado de piezas en tallado histológico; contiene formaldehído (carcinógeno IARC grupo 1). '
        'Va a aguas de laboratorio; nunca al desagüe.'),
    'Reactivos de fijación para citometría de flujo (formaldehído diluido)': (AGUAS,
        'Soluciones de paraformaldehído o formaldehído al 1-4% para fijación de células para citometría; '
        'carcinógeno grupo 1. Va a aguas de laboratorio; nunca al desagüe.'),
    # 5
    'Frotis teñidos con HE': (BASURA, None),
    'Frotis teñidos con Papanicolaou': (BASURA, None),
    'Frotis teñidos con May-Grünwald/Giemsa': (BASURA, None),
    'Frotis teñidos con Diff-Quick': (BASURA, None),
    'Portas con tinción de panóptico': (BASURA, None),
    # 7
    'Eosina en etanol': (AGUAS, None),
    'Colorantes del Papanicolaou (fracciones etanólicas)': (AGUAS, None),
    'Diff-Quick fracción metanólica': (AGUAS, None),
    'May-Grünwald/Giemsa residuo líquido': (AGUAS, None),
    'Solución de Giemsa acuosa (parasitología)': (AGUAS, None),
    'Etanol con restos de colorantes': (AGUAS, None),
    'Lugol (solución yodo-yoduro potásico)': (AGUAS, None),
    'Solución de Coomassie Blue (tinción de proteínas)': (AGUAS, None),
    'Solución de desteñido de Coomassie (destaining)': (AGUAS, None),
}

NUEVOS_TIPOS = [
    {'nombre': 'Envases vacíos de plástico o aluminio que contuvieron sustancias peligrosas',
     'descripcion': 'Frascos, botellas y botes vacíos de plástico o aluminio. Bien cerrados, para que no se acumule '
                    'líquido en el fondo de la bolsa.',
     'riesgo': None},
    {'nombre': 'Papel, guantes y filtros manchados con sustancias peligrosas',
     'descripcion': 'Sólidos manchados con sustancias peligrosas. Si es con disolventes volátiles, meterlo antes en '
                    'una bolsa zip (la bolsa plástica va abierta).',
     'riesgo': None},
]

NUEVOS_CONTENEDORES = [
    {'categoria': BOLSA, 'lab': '207', 'zona': 'Almacén de residuos', 'formato': 'Bolsa plástica'},
    {'categoria': SALVAVIDAS, 'lab': '207', 'zona': 'Almacén de residuos', 'formato': 'Bidón azul de ballesta'},
]

conn = conectar(); cur = conn.cursor()
cur.execute("select id_residuo, nombre, contenedor_tipo, descripcion from tipos_residuo")
tipos = {r[1]: r for r in cur.fetchall()}

cambios = 0
for nombre, (cat, desc) in MOVER.items():
    if nombre not in tipos:
        print(f"⚠ NO ENCONTRADO: {nombre}"); continue
    id_, _, cat_old, desc_old = tipos[nombre]
    if cat_old == cat and (desc is None or desc == desc_old):
        continue
    print(f"{id_}  {nombre[:60]:<60}  {cat_old} → {cat}{'  (+descripción)' if desc else ''}")
    cambios += 1
    if not DRY_RUN:
        cur.execute("update tipos_residuo set contenedor_tipo=%s, descripcion=coalesce(%s, descripcion) where id_residuo=%s",
                    (cat, desc, id_))

cur.execute("select count(*) from tipos_residuo where contenedor_tipo='Frasco Propio'")
n_fp = cur.fetchone()[0]
if n_fp:
    print(f"Frasco Propio → {SALVAVIDAS}: {n_fp} tipos (los que no se movieron arriba)")
    cambios += 1
    if not DRY_RUN:
        cur.execute("update tipos_residuo set contenedor_tipo=%s where contenedor_tipo='Frasco Propio'", (SALVAVIDAS,))
        cur.execute("update contenedores_residuo set categoria=%s where categoria='Frasco Propio'", (SALVAVIDAS,))
        cur.execute("update excepciones_residuo_ia set categoria_contenedor=%s where categoria_contenedor='Frasco Propio'", (SALVAVIDAS,))

for t in NUEVOS_TIPOS:
    if t['nombre'] in tipos: continue
    print(f"+ tipo  {t['nombre']}  → {BOLSA}")
    cambios += 1
    if not DRY_RUN:
        cur.execute("insert into tipos_residuo (id_residuo, nombre, descripcion, riesgo, contenedor_tipo) values (%s,%s,%s,%s,%s)",
                    (generar_id('RES'), t['nombre'], t['descripcion'], t['riesgo'], BOLSA))

hoy = datetime.date.today()
for c in NUEVOS_CONTENEDORES:
    cur.execute("select 1 from contenedores_residuo where categoria=%s and lab=%s and estado='activo'", (c['categoria'], c['lab']))
    if cur.fetchone(): continue
    print(f"+ contenedor  {c['categoria']}  lab {c['lab']} · {c['zona']} · {c['formato']}")
    cambios += 1
    if not DRY_RUN:
        cur.execute("""insert into contenedores_residuo
            (id_contenedor, categoria, lab, zona, formato, nivel, estado, fecha_apertura, fecha_actualizacion, actualizado_por)
            values (%s,%s,%s,%s,%s,'vacío','activo',%s,now(),'Paloma Fernández')""",
            (generar_id('RC'), c['categoria'], c['lab'], c['zona'], c['formato'], hoy))

if DRY_RUN:
    conn.rollback()
    print(f"\nSIMULACIÓN: {cambios} cambios. Ejecuta con --aplicar para guardarlos.")
else:
    conn.commit()
    print(f"\nGuardado: {cambios} cambios.")
