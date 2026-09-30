"""
Normaliza el inventario de material fungible (revisión 2026-09-30):

1. Unidades del material escritas de mil formas (Caja, Caja/s, cajas, caja/es…)
   → una sola forma en minúscula: caja/s, bote/s, bolsa/s, unidad/es…
2. Unidad de cada bote: igual; si coincide con la del material se deja vacía
   (unidad_lote es la excepción, no la copia).
3. Categorías cortas ("Medio de cultivo") → el texto completo de la opción del
   desplegable, que es lo que guarda el modal de material.
4. Propuestas pendientes con un NÚMERO en la unidad (el alumnado ponía la
   cantidad ahí): el número pasa a la cantidad si estaba vacía y la unidad se
   vacía, para que quien valida la elija.

Los materiales ya creados con un número como unidad NO se tocan aquí: hace
falta saber qué hay en el armario para elegir su unidad.

Uso:  python scripts/normalizar_unidades_material.py            (simulación)
      python scripts/normalizar_unidades_material.py --aplicar  (guarda)
"""
import sys, re
sys.path.insert(0, 'scripts')
from base import conectar

DRY_RUN = "--aplicar" not in sys.argv   # simulación por defecto

CANON = {
    'caja': 'caja/s', 'cajas': 'caja/s', 'caja/s': 'caja/s', 'caja/es': 'caja/s',
    'bote': 'bote/s', 'botes': 'bote/s', 'bote/s': 'bote/s', 'bote/es': 'bote/s',
    'bolsa': 'bolsa/s', 'bolsas': 'bolsa/s', 'bolsa/s': 'bolsa/s',
    'unidad': 'unidad/es', 'unidades': 'unidad/es', 'unidad/es': 'unidad/es', 'unidad/s': 'unidad/es',
    'botella': 'botella/s', 'botella/s': 'botella/s', 'botella/as': 'botella/s',
    'kit': 'kit/s', 'kit/s': 'kit/s',
    'garrafa': 'garrafa/s', 'garrafa/as': 'garrafa/s', 'garrafa/s': 'garrafa/s',
    'rollo/s': 'rollo/s', 'frasco/os': 'frasco/s', 'frasco': 'frasco/s',
    'gotero': 'gotero/s', 'gotero/s': 'gotero/s', 'bala/s': 'bala/s', 'pinza/s': 'pinza/s',
    'cuña': 'cuña/s', 'pulverizadores': 'pulverizador/es', 'turulo/s': 'turulo/s',
}

def canon(u):
    if u is None: return None
    s = u.strip()
    if not s or re.fullmatch(r'[\d\s.,]+', s): return u  # los números se tratan aparte
    return CANON.get(s.lower(), s)

c = conectar(); cur = c.cursor()
cambios = []

# 1. Unidades del material
cur.execute('select id_material, unidad from material')
for idm, u in cur.fetchall():
    n = canon(u)
    if n != u: cambios.append(('material.unidad', idm, u, n)); cur.execute('update material set unidad=%s where id_material=%s', (n, idm))

# 2. Unidades de bote: normalizar; si coincide con la del material, se deja vacía
cur.execute('select l.id, l.unidad_lote, m.unidad from material_ubicaciones l join material m using(id_material) where l.unidad_lote is not null')
for idl, u, um in cur.fetchall():
    n = canon(u)
    if n == um: n = None
    if n != u: cambios.append(('bote.unidad_lote', idl, u, n)); cur.execute('update material_ubicaciones set unidad_lote=%s where id=%s', (n, idl))

# 3. Categorías: siempre el texto completo de la opción del desplegable
LARGAS = ["Reactivo químico — ácidos, disolventes, bases, sales...",
 "Solución y tampón — formol, PBS, fijadores, diluciones...",
 "Colorante y tinción — HE, Giemsa, Papanicolaou, Diff-Quick...",
 "Medio de cultivo — agares, caldos, medios selectivos...",
 "Reactivo de biología molecular — extracción de ácidos nucleicos, electroforesis, cultivo celular...",
 "Kit diagnóstico — ELISA, pruebas rápidas, tiras...",
 "Material de vidrio — portas, cubreobjetos, matraces, pipetas...",
 "Material fungible — puntas, tubos, placas, Eppendorf...",
 "Papel y filtración — papel de filtro, membranas, papel secante...",
 "EPI y seguridad — guantes, gafas, batas, mascarillas...",
 "Equipamiento menor — aparatos pequeños no inventariados como activo fijo", "Otro"]
POR_BASE = {l.split(' — ')[0]: l for l in LARGAS}
cur.execute('select id_material, categoria from material')
for idm, cat in cur.fetchall():
    n = POR_BASE.get((cat or '').split(' — ')[0].strip(), cat)
    if n != cat: cambios.append(('material.categoria', idm, cat, n)); cur.execute('update material set categoria=%s where id_material=%s', (n, idm))

# 4. Propuestas pendientes: número en la unidad -> pasa a cantidad si estaba vacía; unidad vacía
cur.execute("select id_propuesta, unidad, cantidad from propuestas_material where estado='pendiente'")
for idp, u, cant in cur.fetchall():
    s = (u or '').strip()
    if s and re.fullmatch(r'[\d\s.,]+', s):
        nc = cant if cant is not None else float(s.replace(',', '.'))
        cambios.append(('propuesta', idp, f'{u} / cant {cant}', f'None / cant {nc}'))
        cur.execute('update propuestas_material set unidad=null, cantidad=%s where id_propuesta=%s', (nc, idp))
    else:
        n = canon(u)
        if n != u: cambios.append(('propuesta.unidad', idp, u, n)); cur.execute('update propuestas_material set unidad=%s where id_propuesta=%s', (n, idp))

from collections import Counter
print(Counter(t for t, *_ in cambios))
for ch in cambios:
    if ch[0] != 'material.categoria': print(ch)
if DRY_RUN: c.rollback(); print('DRY RUN — nada guardado')
else: c.commit(); print('APLICADO')
