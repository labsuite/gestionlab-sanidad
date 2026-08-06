"""
actualizar_riesgos_ghs.py – asigna pictogramas GHS a los tipos de residuo
Clasifica por fragmentos de nombre (insensible a mayúsculas/tildes).
Overrides por id_residuo cuando el matching de nombre produce falsos positivos.
DRY_RUN = True  → solo muestra los cambios propuestos
DRY_RUN = False → escribe en Supabase
"""
import sys, unicodedata
sys.path.insert(0, '.')
from scripts.base import conectar, leer, actualizar_fila_por_fila

DRY_RUN = True  # ← cambiar a False para aplicar

# ── Valores GHS canónicos (deben coincidir con los checkboxes de la UI) ────────
T   = 'Tóxico'
N   = 'Nocivo / Irritante'
F   = 'Inflamable'
O   = 'Comburente'
C   = 'Corrosivo'
CMR = 'Cancerígeno / CMR'
ENV = 'Peligroso para el medio ambiente'
EXP = 'Explosivo'
GAS = 'Gas comprimido'
CIT = 'Citotóxico'

def ghs(*args):
    return ', '.join(args)

def norm(s):
    return unicodedata.normalize('NFD', s.lower()).encode('ascii', 'ignore').decode()

# ── Overrides por ID (toman prioridad sobre las reglas de nombre) ──────────────
# Necesarios cuando el matching de nombre produce falsos positivos.
OVERRIDES = {
    # HE (Hematoxilina-Eosina) sin regla específica
    'R003': ghs(N),         # Frotis teñidos con HE
    'R013': ghs(N),         # Secciones histológicas con tejido (HE)

    # Falso positivo: "SIN azul tripán" matcheaba la regla de azul tripán
    'R009': '',

    # Colorantes Papanicolaou en fracción etanólica — disolvente + colorantes
    'R020': ghs(F, N),

    # "Etanol:Éter" — el éter es más peligroso que el etanol solo
    'R028': ghs(F, N),

    # "Bases diluidas varias" — la regla genérica "base" no estaba en REGLAS
    'R035': ghs(C),

    # Azul de bromofenol muy diluido — indicador de pH, sin peligrosidad GHS real
    'R041': '',

    # "Medios de cultivo SIN DMSO o con DMSO <1%" — falso positivo de "dmso"
    'R043': '',

    # "Frascos vacíos enjuagados (NO halogenados)" — falso positivo de "halogena"
    'R010': '',

    # "PCR sin fluorocromo" — falso positivo de "cromo" en "fluorocromo"
    'R046': '',

    # β-mercaptoetanol — tóxico por inhalación/piel, no solo inflamable
    'R053': ghs(T, F),

    # Cuchillas (sharps biológicos, sin clasificación GHS química)
    'R056': '',
    'R057': '',

    # "Solución de Bouin" — formol + ácido pícrico (explosivo si seco)
    'R060': ghs(T, CMR, C),

    # "Solución de Carnoy" — cloroformo + metanol + ácido acético
    'R061': ghs(T, CMR, F),

    # Alcohol ácido de Ziehl-Neelsen = etanol + HCl → inflamable + corrosivo
    'R067': ghs(F, C),

    # H₂SO₄ y NaOH concentrados del Kjeldahl
    'R084': ghs(C),
    'R085': ghs(C),

    # OsO₄ — extremadamente tóxico por inhalación (no solo Tóxico)
    'R099': ghs(T, ENV),

    # Tampones del osmómetro = soluciones NaCl de calibración, NO osmio
    'R100': '',

    # Efluente lavador de microplacas ELISA — muy diluido, sin GHS
    'R111': '',

    # Tarjetas BioVue — residuo biológico, sin clasificación GHS química
    'R112': '',

    # Eosina en etanol — el colorante añade componente irritante al solvente
    'R021': ghs(F, N),

    # Preparación histológica completa — formol (fijación) + DPX (montaje xileno)
    'R109': ghs(T, CMR, F),
}

# ── Reglas de nombre: (fragmento_normalizado, clasificación_GHS) ───────────────
# Se aplica la PRIMERA regla que coincida. Más específicas primero.
REGLAS = [
    # Formaldehído / formol (prioridad antes de "alcohol")
    ('formaldeh',                   ghs(T, CMR, C)),
    ('formol',                      ghs(T, CMR, C)),
    ('fijador',                     ghs(T, CMR)),
    ('reactivo de fijacion',        ghs(T, CMR, C)),
    ('reactivos de fijacion',       ghs(T, CMR, C)),

    # TRIzol y otros reactivos fenólicos (fenol = tóxico + corrosivo)
    ('trizol',                      ghs(T, C)),
    ('fenolico',                    ghs(T, C)),
    ('fenol',                       ghs(T, C)),
    ('carbol',                      ghs(T, C)),         # Carbol-fucsina = fenol + fucsina
    ('lactofenol',                  ghs(T, N)),

    # DAB (diaminobencidina) — carcinógeno grupo 2B
    ('dab',                         ghs(T, CMR)),
    ('diaminobencidina',            ghs(T, CMR)),

    # SYBR Green — mutagénico (intercala en ADN)
    ('sybr',                        ghs(T, CMR)),

    # Yoduro de propidio (PI) — mutagénico
    ('yoduro de propidio',          ghs(T, CMR)),

    # Osmio (OsO₄) — extremadamente tóxico
    ('osm',                         ghs(T, ENV)),

    # Disolventes halogenados (antes de "halogena" genérico)
    ('cloroformo',                  ghs(T, CMR)),
    ('diclorometano',               ghs(T, CMR)),
    ('tricloroetilen',              ghs(T, CMR)),
    ('tetraclorur',                 ghs(T, CMR)),
    ('no halogen',                  ''),               # "no halogenados" → sin peligro GHS
    ('halogena',                    ghs(T, CMR)),       # solventes halogenados genérico

    # Xileno / xilol
    ('xilol',                       ghs(T, F, N)),
    ('xileno',                      ghs(T, F, N)),
    ('x-free',                      ghs(F, N)),         # sustituto de xileno

    # Reactivo de Schiff (contiene HCl + pararosanilina)
    ('reactivo de schiff',          ghs(T, C)),
    ('schiff',                      ghs(T, C)),

    # DPX / Entellan (medios de montaje con xileno/benceno)
    ('dpx',                         ghs(T, F)),
    ('entellan',                    ghs(T, F)),
    ('cola de montaje',             ghs(T, F)),

    # Vectashield / Mowiol (medios de montaje acuosos — riesgo bajo)
    ('vectashield',                 ghs(N)),
    ('mowiol',                      ghs(N)),
    ('montaje para inmunofluor',    ghs(N)),

    # OCT compound (polietilenglicol, baja toxicidad)
    ('oct compound',                ''),
    ('tissue-tek',                  ''),

    # Glutaraldehído
    ('glutaraldeh',                 ghs(T, C)),

    # β-mercaptoetanol (debe ir ANTES de "etanol" genérico)
    ('mercaptoetanol',              ghs(T, F)),

    # Metanol
    ('metanol',                     ghs(T, F)),

    # Disolventes orgánicos específicos
    ('acetona',                     ghs(F, N)),
    ('isopropanol',                 ghs(F, N)),
    ('etanol',                      ghs(F)),
    ('alcohol',                     ghs(F)),
    ('eter',                        ghs(F, N)),

    # Azida sódica (conservante — muy tóxico)
    ('azida',                       ghs(T)),

    # Oxidantes
    ('permanganato',                ghs(O, N)),
    ('agua oxigenada',              ghs(O, C)),
    ('peroxido',                    ghs(O, C)),
    ('h2o2',                        ghs(O, C)),

    # Ácidos concentrados (orden: específicos antes de genérico)
    ('h2so4',                       ghs(C)),
    ('acido sulfurico',             ghs(C)),
    ('acido nitrico',               ghs(C, O)),
    ('acido clorhidrico',           ghs(C)),
    ('acido acetico',               ghs(C, F)),
    ('acido peryodico',             ghs(C, O)),
    ('acido borico',                ghs(N)),            # baja toxicidad a concentraciones diluidas
    ('parada de elisa',             ghs(C)),            # H₂SO₄ o HCl diluido para parar ELISA
    ('acido',                       ghs(C)),

    # Bases concentradas
    ('naoh',                        ghs(C)),
    ('koh',                         ghs(C)),
    ('hidroxido',                   ghs(C)),
    ('amoniaco',                    ghs(T, C)),
    ('destilado kjeldahl',          ghs(C)),            # ácido bórico + destilado nitrogenado

    # Hipoclorito / lejía
    ('hipoclorito',                 ghs(C, N)),
    ('lejia',                       ghs(C, N)),

    # Mercurio
    ('mercurio',                    ghs(T, ENV)),

    # Metales pesados / fluorocromos con cromo (antes de "cromo" genérico)
    ('fluorocromo',                 ghs(T, CMR)),       # DAPI es mutagénico
    ('plomo',                       ghs(T, ENV)),
    ('cromo',                       ghs(T, CMR, ENV)),
    ('cadmio',                      ghs(T, CMR, ENV)),
    ('arsenico',                    ghs(T, CMR, ENV)),

    # Citostáticos
    ('citostatico',                 ghs(T, CMR, CIT)),
    ('antineoplasico',              ghs(T, CMR, CIT)),
    ('quimioterapi',                ghs(T, CMR, CIT)),

    # Reactivo de Perls / azul de Prusia (baja toxicidad)
    ('perls',                       ghs(N)),
    ('azul de prusia',              ghs(N)),

    # Azul de toluidina, azul de metileno, violeta de genciana
    ('azul de toluidina',           ghs(N)),
    ('azul de metileno',            ghs(N)),
    ('violeta de genciana',         ghs(N)),
    ('azul de bromofenol',          ''),                # trazador, baja toxicidad
    ('rojo de ponceau',             ghs(N)),

    # Azul tripán — posiblemente carcinógeno (IARC grupo 2B)
    ('azul tripan',                 ghs(T, CMR)),

    # Tinciones / colorantes
    ('hematoxilina',                ghs(N)),
    ('eosina',                      ghs(N)),
    ('giemsa',                      ghs(N)),
    ('papanicolaou',                ghs(N)),
    ('diff-quick',                  ghs(N)),
    ('may-grunwald',                ghs(N)),
    ('may grünwald',                ghs(N)),
    ('coomassie',                   ghs(N)),
    ('lugol',                       ghs(N)),
    ('fucsina',                     ghs(T, N)),         # fucsina + fenol
    ('panoptico',                   ghs(N)),
    ('tincion',                     ghs(N)),
    ('colorante',                   ghs(N)),

    # Reactivos de Western blot / stripping (β-ME + SDS)
    ('stripping',                   ghs(T, N)),

    # SDS-PAGE / poliacrilamida (acrilamida es neurotóxica y cancerígena)
    ('poliacrilamida',              ghs(T, CMR)),
    ('page',                        ghs(T, CMR)),       # SDS-PAGE

    # Resina de parafina y parafina
    ('parafina',                    ghs(N)),
    ('resina',                      ghs(T, N)),

    # DMSO (carrier, mejora absorción percutánea)
    ('dmso',                        ghs(N)),

    # Buffer TAE, PBS, tampones — baja toxicidad
    ('buffer tae',                  ''),
    ('tae',                         ''),
    ('pbs',                         ''),
    ('tampón',                      ''),
    ('tampon',                      ''),
    ('buffers de electroforesis',   ''),
    ('buffer de electroforesis',    ''),

    # Medios de cultivo con DMSO
    ('cultivo con dmso',            ghs(N)),
    ('congelacion fbs',             ghs(N)),

    # Lisante de eritrocitos, soluciones de limpieza de analizadores
    ('lisante',                     ghs(N)),
    ('solucion de limpieza',        ghs(N)),
    ('solución de limpieza',        ghs(N)),

    # TMB (sustrato ELISA)
    ('tmb',                         ghs(N)),

    # Quimioluminiscencia
    ('quimioluminiscencia',         ghs(N)),

    # Reactivos de coagulometría (bajo riesgo químico)
    ('coagulometri',                ''),
    ('tromboplastina',              ''),

    # Reactivos bioquímicos de autoanalizador
    ('autoanalizador',              ghs(N)),
    ('metrolab',                    ghs(N)),
    ('dri-chem',                    ''),

    # Reactivos de inmunohistoquímica
    ('desenmascaramiento',          ghs(N)),
    ('inmunohistoquimica',          ghs(N)),

    # Antisueros, anticuerpos, reactivos de inmunología
    ('antisuero',                   ghs(N)),
    ('anticuerpo',                  ghs(N)),
    ('ortho',                       ghs(N)),
    ('liss',                        ghs(N)),

    # Reactivos de aglutinación en látex
    ('latex',                       ''),

    # Reactivos de oxidasa, antibiograma (microbiología)
    ('oxidasa',                     ghs(N)),
    ('antibiograma',                ghs(N)),
    ('galeria api',                 ghs(N)),
    ('identificacion bioquimica',   ghs(N)),
    ('imvic',                       ghs(N)),

    # Aceite de inmersión
    ('aceite',                      ghs(ENV)),

    # Gases comprimidos
    ('co2',                         ghs(GAS)),
    ('nitrogeno',                   ghs(GAS)),
    ('gas comprimido',              ghs(GAS)),

    # Pilas / baterías / fluorescentes
    ('pila',                        ghs(ENV)),
    ('bateria',                     ghs(ENV)),
    ('fluorescent',                 ghs(T, ENV)),
    ('lampara',                     ghs(ENV)),

    # Glicerol (baja toxicidad)
    ('glicerol',                    ''),
    ('glicerina',                   ''),

    # Material biológico / residuos sanitarios (sin pictograma GHS)
    ('biologic',                    ''),
    ('sangre',                      ''),
    ('orina',                       ''),
    ('heces',                       ''),
    ('cultivo',                     ''),
    ('microorgani',                 ''),
    ('residuo sanitario',           ''),
    ('material cortante',           ''),
    ('punzante',                    ''),
    ('agujas',                      ''),
    ('lanceta',                     ''),
    ('bisturi',                     ''),
    ('biovue',                      ''),
    ('autoclave',                   ''),
    ('stomacher',                   ''),
    ('placa de elisa',              ''),
    ('cartucho',                    ''),

    # Calibradores y tampones de calibración
    ('calibrador',                  ''),
    ('tampon del osmometro',        ''),
    ('osmometro',                   ''),
    ('aguas de laborator',          ''),
    ('agua de laborator',           ''),

    # Transparentador de tiras de acetato
    ('transparentador',             ghs(N)),

    # Gel de agarosa (baja toxicidad — el BrEt sería el problema, pero aquí es post-uso)
    ('agarosa',                     ''),
    ('gel de agarosa',              ''),
]

# ── EJECUCIÓN ──────────────────────────────────────────────────────────────────
conn = conectar()
t, columnas, datos = leer(conn, 'tipos_residuo')

print(f'\n{"ID":6s}  {"Nombre":55s}  {"Actual":25s}  {"Propuesto":40s}')
print('-' * 140)

actualizaciones = []
sin_regla = []

for d in datos:
    id_res  = d.get('id_residuo', '')
    nombre  = d.get('nombre', '') or ''
    actual  = d.get('riesgo', '') or ''
    nombre_n = norm(nombre)

    # Overrides por ID tienen prioridad
    if id_res in OVERRIDES:
        propuesto = OVERRIDES[id_res]
        regla_usada = f'OVERRIDE({id_res})'
    else:
        propuesto = None
        regla_usada = ''
        for fragmento, clasificacion in REGLAS:
            if norm(fragmento) in nombre_n:
                propuesto = clasificacion
                regla_usada = fragmento
                break

    if propuesto is None:
        sin_regla.append((id_res, nombre, actual))
        continue

    cambio = propuesto != actual
    marca = '→' if cambio else '='
    print(f'{id_res:6s}  {nombre[:55]:55s}  {actual[:25]:25s}  {marca} {propuesto}')

    if cambio:
        actualizaciones.append((id_res, propuesto))

print()
if sin_regla:
    print(f'⚠️  SIN REGLA ({len(sin_regla)} residuos — no se modificarán):')
    for id_res, nombre, actual in sin_regla:
        print(f'  {id_res:6s}  {nombre}')
    print()

print(f'Cambios a aplicar: {len(actualizaciones)} / {len(datos)} residuos')

if not DRY_RUN and actualizaciones:
    print('\nActualizando Supabase...')
    cambios = [(id_res, {'riesgo': ghs_val}) for id_res, ghs_val in actualizaciones]
    actualizar_fila_por_fila(t, cambios)
    print(f'✅ {len(actualizaciones)} residuos actualizados.')
elif DRY_RUN:
    print('\n[DRY RUN] Pon DRY_RUN = False y vuelve a ejecutar para escribir en Supabase.')

conn.close()
