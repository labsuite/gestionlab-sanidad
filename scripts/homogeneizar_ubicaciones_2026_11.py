"""
Aplica a TODAS las ubicaciones el mismo criterio para el texto de cada sitio (Paloma, 2026-11-25).
En pantalla sale «código – zona · localización · contenido» (getNombreUbicacion, js/config.js):

  zona          = apellido del laboratorio («205 - Zona común» → «Zona común»); no se toca aquí.
  Localización  (columna `zona`): SOLO dónde está físicamente, de lo general a lo concreto:
                lado o pared · mueble · balda, cajón o posición. Un equipo puede servir de
                referencia, pero escrito como posición («Debajo del procesador», «Al lado de los
                cubos»), no como un nombre suelto.
  Uso / contenido / apodo (columna `subzona`): lo que se guarda ahí o el nombre con el que se
                conoce el mueble («Reactivos», «Micropipetas»). Si hay apodo y contenido, el apodo
                va delante: «Reactivos · Ácidos».
  Observaciones (columna `descripcion_completa`): lo demás; no se toca aquí.

Lo que corrige (revisadas las 182 ubicaciones; el resto ya cumplía):
  - Armarios de la zona común con su apodo como primer tramo de la localización
    («Reactivos · Inferior» → localización «Inferior», contenido «Reactivos»).
  - 205-AUTOCLAVES: «Autoclaves · Inferior» era una referencia física (sus observaciones dicen
    «armarito de al lado de los autoclaves»): se escribe como posición.
  - Mayúscula inicial de cada tramo y la errata «fragadero».

Simulación por defecto; `--aplicar` para guardar (deja antes una copia CSV en scripts/copias/,
que no va a git). Idempotente: si ya está aplicado, no cambia nada.
"""
import csv
import datetime
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from base import conectar

APLICAR = '--aplicar' in sys.argv
SEP = ' · '

# Apodos de los armarios de la zona común (nombre del mueble, no su sitio).
APODOS_ZONA_COMUN = {'Aguas', 'Reactivos', 'Centrífugas'}

# Correcciones puntuales: id → {columna: valor nuevo}
PUNTUALES = {
    '205-AUTOCLAVES': {'zona': 'Al lado de los autoclaves · Inferior'},
}
ERRATAS = {'fragadero': 'fregadero'}


def tramos(texto):
    return [t.strip() for t in (texto or '').split(SEP.strip()) if t.strip()]


def mayuscula(t):
    return t[0].upper() + t[1:] if t and t[0].isalpha() and t[0].islower() else t


def normalizar(texto):
    if not texto:
        return texto
    partes = [mayuscula(t) for t in tramos(texto)]
    nuevo = SEP.join(partes)
    for mal, bien in ERRATAS.items():
        nuevo = nuevo.replace(mal, bien)
    return nuevo


def propuesta(fila):
    idu, lab, zona, subzona = fila['id_ubicacion'], fila['laboratorio_aula'], fila['zona'], fila['subzona']
    nueva_zona, nueva_sub = zona, subzona
    t = tramos(zona)
    if (lab or '').endswith('Zona común') and t and t[0] in APODOS_ZONA_COMUN and len(t) > 1:
        apodo = t[0]
        nueva_zona = SEP.join(t[1:])
        nueva_sub = apodo if not (subzona or '').strip() else (subzona if subzona.startswith(apodo) else apodo + SEP + subzona)
    if idu in PUNTUALES:
        nueva_zona = PUNTUALES[idu].get('zona', nueva_zona)
        nueva_sub = PUNTUALES[idu].get('subzona', nueva_sub)
    return normalizar(nueva_zona), normalizar(nueva_sub)


def main():
    conn = conectar()
    cur = conn.cursor()
    cur.execute("select id_ubicacion, laboratorio_aula, zona, subzona, descripcion_completa, activa from ubicaciones order by id_ubicacion")
    cols = [d[0] for d in cur.description]
    filas = [dict(zip(cols, r)) for r in cur.fetchall()]

    cambios = []
    for f in filas:
        z, s = propuesta(f)
        if (z or None) != (f['zona'] or None) or (s or None) != (f['subzona'] or None):
            cambios.append((f, z, s))

    print(f"{len(filas)} ubicaciones revisadas; {len(cambios)} cambian.\n")
    for f, z, s in cambios:
        print(f"{f['id_ubicacion']}")
        print(f"   localización: {f['zona']!r} → {z!r}")
        if (s or None) != (f['subzona'] or None):
            print(f"   contenido:    {f['subzona']!r} → {s!r}")

    if not cambios:
        return
    if not APLICAR:
        print("\nSimulación: no se ha guardado nada. Para guardar: python scripts/homogeneizar_ubicaciones_2026_11.py --aplicar")
        return

    os.makedirs('scripts/copias', exist_ok=True)
    ruta = f"scripts/copias/ubicaciones_{datetime.datetime.now():%Y%m%d_%H%M%S}.csv"
    with open(ruta, 'w', newline='', encoding='utf-8') as fh:
        w = csv.DictWriter(fh, fieldnames=cols)
        w.writeheader()
        w.writerows(filas)
    for f, z, s in cambios:
        cur.execute("update ubicaciones set zona = %s, subzona = %s where id_ubicacion = %s", (z or None, s or None, f['id_ubicacion']))
    conn.commit()
    print(f"\nGuardado. Copia de antes en {ruta}")


if __name__ == '__main__':
    main()
