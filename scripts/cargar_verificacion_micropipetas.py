"""
cargar_verificacion_micropipetas.py — Carga en GestionLab los datos de verificación de cada
micropipeta (verificacion_micropipetas.csv de la carpeta de protocolos: volúmenes de prueba,
método, disolución, masa de agua y límites; es la tabla 6.4 de los protocolos).

Tabla destino: verif_pipetas_parametros (una fila por id_activo). Se actualizan SOLO las
columnas del CSV: lo que decide el laboratorio desde la app (respuesta sobre el tornillo de
ajuste, volumen bajo elegido de PIP-005) no se toca. Las filas que ya no estén en el CSV no
se borran: se listan para revisarlas.

Cada verificación guardada conserva los límites con los que se juzgó, así que recargar el CSV
no cambia las ya hechas: solo las siguientes.

Ejecutar cada vez que el chat del laboratorio regenere el CSV (rangos nuevos, límites).
Simulación por defecto; `--aplicar` para guardar.
Uso: python scripts/cargar_verificacion_micropipetas.py [--aplicar]
"""
import csv
import datetime
import os
import sys

sys.path.insert(0, 'scripts')
from base import conectar

CARPETA = r"C:/Users/Paloma/OneDrive/Escritorio/CIFP Manuel Antonio/B. Laboratorio/Protocolos/GestionLab/"
ARCHIVO = CARPETA + 'verificacion_micropipetas.csv'
APLICAR = '--aplicar' in sys.argv

TEXTO = ['archivo', 'marca_modelo', 'estado', 'rango', 'origen_rango', 'confirmar', 'ajuste_usuario',
         'metodo_nominal', 'patron_nominal', 'metodo_bajo', 'patron_bajo', 'fuente_limites', 'notas']
NUMERO = ['v_nominal', 'masa_nominal_g', 'es_nominal_pct', 'cv_nominal_pct',
          'v_bajo', 'masa_bajo_g', 'es_bajo_pct', 'cv_bajo_pct']


def numero(v):
    v = (v or '').strip()
    return float(v) if v else None


filas = list(csv.DictReader(open(ARCHIVO, encoding='utf-8-sig')))
version = datetime.date.fromtimestamp(os.path.getmtime(ARCHIVO)).isoformat()
print('MODO:', 'APLICAR' if APLICAR else 'SIMULACIÓN (nada se escribe)')
print(f'{ARCHIVO} ({version}): {len(filas)} pipetas')

conn = conectar()
cur = conn.cursor()
cur.execute('select id_activo from equipos')
equipos = {r[0] for r in cur.fetchall()}
cur.execute('select id_activo from verif_pipetas_parametros')
ya = {r[0] for r in cur.fetchall()}

faltan = [f['id_activo'] for f in filas if f['id_activo'] not in equipos]
if faltan:
    print('⚠ No existen en equipos (no se cargan):', faltan)
validas = [f for f in filas if f['id_activo'] in equipos]
sin_rango = [f['id_activo'] for f in validas if not (f['v_nominal'] or '').strip()]
print(f'Se cargan {len(validas)} ({len(validas) - len(ya & {f["id_activo"] for f in validas})} nuevas). Sin rango: {len(sin_rango)} {sin_rango}')
fuera = sorted(ya - {f['id_activo'] for f in filas})
if fuera:
    print('⚠ En GestionLab pero ya no en el CSV (no se borran, revisar):', fuera)

if not APLICAR:
    print('\nSimulación: no se ha guardado nada. Ejecuta con --aplicar para guardar.')
    sys.exit(0)

cols = ['id_activo', 'multicanal'] + TEXTO + NUMERO + ['version_csv']
for f in validas:
    vals = [f['id_activo'], (f.get('multicanal') or '').strip().lower() in ('sí', 'si')]
    vals += [(f.get(c) or '').strip() or None for c in TEXTO]
    vals += [numero(f.get(c)) for c in NUMERO]
    vals += [version]
    sets = ', '.join(f'{c} = excluded.{c}' for c in cols[1:]) + ', cargado_en = now()'
    cur.execute(f"insert into verif_pipetas_parametros ({', '.join(cols)}) values ({', '.join(['%s'] * len(cols))}) "
                f"on conflict (id_activo) do update set {sets}", vals)
conn.commit()
cur.execute('select count(*) from verif_pipetas_parametros')
print(f'✓ Cargado. Filas en verif_pipetas_parametros: {cur.fetchone()[0]}')
