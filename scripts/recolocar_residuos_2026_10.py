"""
Recoloca el catálogo de residuos según las normas del gestor (2026-10-01),
con las decisiones que tomó la usuaria ese mismo día:

1. Efluente del lavador de ELISA            → Aguas Laboratorio
2. Reactivos de autoanalizadores (Pendiente) → Aguas Laboratorio
3. Tejidos fijados en formol                 → Muestras en formol (categoría del gestor)
4. Agua con formol / fijador de citometría   → Contenedor Inertes (no halogenados; segunda ronda)
5. Frotis y portas teñidos                   → Basura normal (protegidos; si no, punzantes)
6. "Frasco Propio" ES el salvavidas          → se renombra a "Reactivos de laboratorio"
7. Tinciones, también con etanol/metanol, ácidas y fenólicas → Aguas Laboratorio
   (el gestor: pueden ir juntas mientras no reaccionen entre sí). El ácido
   peryódico (oxidante) se queda en el salvavidas.
10. Tercera ronda: la lejía diluida va al fregadero (categoría "Fregadero", no es
    un contenedor); la indicación va en la descripción, que es lo único que deja
    a las IAs decir "al desagüe".
11. Cuarta ronda: Aguas se divide en DOS garrafas — "Tinciones" (todo lo ácido)
    y "Equipos" (lo que lleva lejía: lavador ELISA, limpieza del citómetro… y los
    neutros). Las dos garrafas que había: la del 203 (donde están casi todos los
    autoanalizadores) pasa a Equipos y la del 205 a Tinciones.
9. Segunda ronda: fuera los portas de Neubauer y los cartuchos DRI-CHEM;
   secciones, bloques de parafina y preparación histológica completa → basura
   (solo trazas de X-Free); frotis con lactofenol → punzantes.
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
BASURA = 'Basura normal'
BASURA_ANTES = 'Basura normal (protegidos)'
INERTES = 'Contenedor Inertes'
CORTANTE = 'Residuo Cortante'
FREGADERO = 'Fregadero'
AGUAS_T = 'Aguas Laboratorio - Tinciones'
AGUAS_E = 'Aguas Laboratorio - Equipos'
# Reparto de lo que iba a Aguas (aprobado por la usuaria 2026-10-01).
DIVISION = {
    **{i: AGUAS_T for i in ['R067', 'R041', 'R023', 'R040', 'R066', 'R042', 'R020', 'R019', 'R021', 'R017', 'R030',
                            'R080', 'R018', 'R065', 'R058', 'R098', 'R031', 'R051', 'R052', 'R104', 'R097', 'R094',
                            'R113']},
    **{i: AGUAS_E for i in ['R072', 'R038', 'R039', 'R111', 'R046', 'R043', 'R055', 'R087', 'R073', 'R101', 'R071',
                            'R100', 'R070', 'R076']},
}
CONTENEDORES_AGUAS = {'RCJ9A6YB': AGUAS_E, 'RCJZJXTU': AGUAS_T}   # 203 → Equipos, 205 → Tinciones
PROTEGIDOS = ' A la basura normal protegidos para que nadie se corte; si no pueden ir a la basura, al contenedor amarillo de punzantes.'
SALVAVIDAS = 'Reactivos de laboratorio'
BOLSA = 'Bolsa plástica (químicos)'

# nombre exacto → (categoría nueva, descripción nueva o None para dejarla)
MOVER = {
    # 1
    'Efluente del lavador de microplacas (ELISA)': (AGUAS,
        'Lo que se acumula en la botella de residuos del lavador de placas HEALEES PW 812: solución de lavado PBS-Tween '
        '+ restos de muestra y conjugado + la lejía diluida del protocolo de limpieza del lavador. NO lleva solución de '
        'parada ni TMB: se añaden después del último lavado y se quedan en la placa (que va a bolsa de autoclave). '
        'Va a aguas de laboratorio, como lo que generan los aparatos automáticos de diagnóstico (norma del gestor, 2026-10); '
        'como lleva lejía, nunca junto a nada ácido.'),
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
    'Agua con restos de formol': (INERTES,
        'Agua de lavado de piezas en tallado histológico; contiene formaldehído (carcinógeno IARC grupo 1). '
        'Formol sin muestra: va a disolventes no halogenados (Contenedor Inertes); nunca al desagüe.'),
    'Reactivos de fijación para citometría de flujo (formaldehído diluido)': (INERTES,
        'Soluciones de paraformaldehído o formaldehído al 1-4% para fijación de células para citometría; '
        'carcinógeno grupo 1. Formol sin muestra: va a disolventes no halogenados (Contenedor Inertes); nunca al desagüe.'),
    # 5
    'Frotis teñidos con HE': (BASURA, 'Portas con extensiones teñidas con hematoxilina-eosina; muestra fijada.' + PROTEGIDOS),
    'Frotis teñidos con Papanicolaou': (BASURA, 'Portas con extensiones teñidas con colorantes del Papanicolaou; muestra fijada.' + PROTEGIDOS),
    'Frotis teñidos con May-Grünwald/Giemsa': (BASURA, 'Portas con extensiones teñidas con May-Grünwald/Giemsa; muestra fijada.' + PROTEGIDOS),
    'Frotis teñidos con Diff-Quick': (BASURA, 'Portas con extensiones teñidas con Diff-Quick; muestra fijada.' + PROTEGIDOS),
    'Portas con tinción de panóptico': (BASURA, 'Portas con extensiones teñidas con panóptico rápido; muestra fijada.' + PROTEGIDOS),
    'Preparación histológica completa (tejido fijado + incluido + teñido HE + montado DPX)': (BASURA,
        'Porta con tejido fijado, incluido, teñido y montado con DPX. Solo lleva trazas de X-Free: el gestor dice que '
        'puede tirarse sin más.' + PROTEGIDOS),
    'Secciones histológicas con tejido (HE)': (BASURA,
        'Preparaciones histológicas definitivas con tejido. Solo llevan trazas de X-Free: el gestor dice que pueden '
        'tirarse sin más.' + PROTEGIDOS),
    'Tejidos incluidos en parafina': (BASURA,
        'Bloques de parafina con tejido incluido. Solo llevan trazas de X-Free: el gestor dice que pueden tirarse sin más.'),
    'Frotis con azul de lactofenol': (CORTANTE,
        'Portas con preparaciones de hongos teñidas con azul de lactofenol (contiene fenol). No van a la basura: '
        'al contenedor amarillo de punzantes.'),
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
    'Alcohol ácido de Ziehl-Neelsen (decolorante)': (AGUAS, None),
    'Hematoxilina de Mayer': (AGUAS, None),
    'Solución de hematoxilina de Weigert o hematoxilina férrica': (AGUAS, None),
    'Reactivo de Perls (tinción del hierro)': (AGUAS, None),
    'Reactivo de Schiff (para PAS)': (AGUAS, None),
    'Reactivos de tinción de Masson (tricrómico)': (AGUAS, None),
    'Rojo de Ponceau': (AGUAS, None),
    'Carbol-fucsina de Ziehl-Neelsen': (AGUAS, None),
    'Azul de lactofenol líquido': (AGUAS, None),
    # 10
    'Lejía diluida (desinfección)': (FREGADERO,
        'Soluciones muy diluidas de hipoclorito residuales de desinfección de superficies. Pueden verterse al '
        'fregadero con abundante agua (indicación del gestor, 2026-10). Nunca mezclarlas antes con ácidos ni con otros '
        'residuos: desprende cloro. Si está concentrada, va al salvavidas "Reactivos de laboratorio".'),
}

# Fuera del catálogo (la usuaria: "no son nada" / "quítalos"); sin adiciones registradas.
BORRAR = [
    'Portas de cámara Neubauer sin azul tripán',
    'Reactivos de química seca (cartuchos DRI-CHEM NX500i usados)',
]

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
cur.execute("select count(*) from tipos_residuo where contenedor_tipo=%s", (BASURA_ANTES,))
n = cur.fetchone()[0]
if n:
    print(f"{BASURA_ANTES} → {BASURA}: {n} tipos"); cambios += 1
    if not DRY_RUN:
        cur.execute("update tipos_residuo set contenedor_tipo=%s where contenedor_tipo=%s", (BASURA, BASURA_ANTES))

for nombre in BORRAR:
    if nombre not in tipos: continue
    id_ = tipos[nombre][0]
    cur.execute("select count(*) from adiciones_residuo where id_residuo=%s", (id_,))
    if cur.fetchone()[0]:
        print(f"⚠ {id_} {nombre}: tiene adiciones, NO se borra"); continue
    print(f"- {id_}  {nombre}"); cambios += 1
    if not DRY_RUN:
        cur.execute("delete from tipos_residuo where id_residuo=%s", (id_,))

for nombre, (cat, desc) in MOVER.items():
    if nombre not in tipos:
        print(f"⚠ NO ENCONTRADO: {nombre}"); continue
    if tipos[nombre][2] == BASURA_ANTES and cat == BASURA and desc is None:
        continue
    if cat == AGUAS:
        cat = DIVISION.get(tipos[nombre][0], cat)
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

cur.execute("select id_residuo, nombre from tipos_residuo where contenedor_tipo=%s", (AGUAS,))
for id_, nombre in cur.fetchall():
    if id_ not in DIVISION:
        print(f"⚠ {id_} {nombre}: en Aguas sin garrafa asignada, se deja"); continue
    print(f"{id_}  {nombre[:60]:<60}  {AGUAS} → {DIVISION[id_]}"); cambios += 1
    if not DRY_RUN:
        cur.execute("update tipos_residuo set contenedor_tipo=%s where id_residuo=%s", (DIVISION[id_], id_))
for id_c, cat in CONTENEDORES_AGUAS.items():
    cur.execute("select categoria, lab from contenedores_residuo where id_contenedor=%s and estado='activo'", (id_c,))
    fila = cur.fetchone()
    if not fila or fila[0] == cat: continue
    print(f"contenedor {id_c} (lab {fila[1]})  {fila[0]} → {cat}"); cambios += 1
    if not DRY_RUN:
        cur.execute("update contenedores_residuo set categoria=%s where id_contenedor=%s", (cat, id_c))

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
