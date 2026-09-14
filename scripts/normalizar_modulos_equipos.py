"""
normalizar_modulos_equipos.py — pasa `equipos.modulos_responsables` al nombre
canónico (gallego) de los módulos de Sanidad CMA.

MOTIVO
------
El campo se rellenó en castellano ("Análisis Bioquímico", "Microbiología Clínica"...)
pero el catálogo real de módulos —el que llega de Sanidad CMA y se guarda en
`usuarios.modulo`— está en gallego ("Análise Bioquímica", "Microbioloxía Clínica"...).

El premarcado por módulo al importar profesorado (`_pasoDosImportarProfesores` en
`js/ubicaciones.js`, línea ~1139) compara con `_normCiclo()`, que sólo quita tildes
y mayúsculas: NO traduce. Resultado: ninguna etiqueta en castellano casaba nunca con
el módulo de un profesor, así que el afinado por módulo no premarcaba nada.

Ejecutar con DRY_RUN = True primero para ver el plan.
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from base import conectar, leer, actualizar_fila_por_fila

# =========================== CONFIGURACIÓN ===========================
DRY_RUN = True

# castellano (como está hoy en equipos) -> gallego canónico (Sanidad CMA)
MAPEO = {
    'Técnicas Generales de Laboratorio':  'Técnicas Xerais de Laboratorio',
    'Análisis Bioquímico':                'Análise Bioquímica',
    'Biología Molecular y Citogenética':  'Bioloxía Molecular e Citoxenética',
    'Microbiología Clínica':              'Microbioloxía Clínica',
    'Control y Seguridad Alimentaria':    'Control e Seguridade Alimentaria',
    'Procesamiento Citológico y Tisular': 'Procesamento Citolóxico e Tisular',
    'Técnicas de Análisis Hematológica':  'Técnicas de Análise Hematolóxica',
    # 'Técnicas de Inmunodiagnóstico' se escribe igual en los dos idiomas.
}
# =====================================================================


def _norm(s):
    """Misma normalización que _normCiclo() en js/ubicaciones.js."""
    return (s or '').strip().lower().translate(
        str.maketrans('áéíóúñ', 'aeioun'))


_MAPEO_NORM = {_norm(k): v for k, v in MAPEO.items()}
_CANONICOS = {_norm(v) for v in MAPEO.values()} | {_norm('Técnicas de Inmunodiagnóstico')}


def traducir(valor):
    """Devuelve (valor_nuevo, desconocidos) para un campo modulos_responsables."""
    partes = [p.strip() for p in (valor or '').split(',') if p.strip()]
    nuevas, desconocidos = [], []
    for p in partes:
        n = _norm(p)
        if n in _MAPEO_NORM:
            nuevas.append(_MAPEO_NORM[n])
        else:
            if n not in _CANONICOS:
                desconocidos.append(p)
            nuevas.append(p)           # ya canónico (o desconocido): se deja igual
    # quita duplicados conservando el orden
    vistos, out = set(), []
    for m in nuevas:
        if _norm(m) not in vistos:
            vistos.add(_norm(m))
            out.append(m)
    return ', '.join(out), desconocidos


def main():
    conn = conectar()
    t, cols, datos = leer(conn, 'equipos')

    cambios, desconocidos_total = [], {}
    for fila in datos:
        actual = fila.get('modulos_responsables') or ''
        nuevo, desc = traducir(actual)
        for d in desc:
            desconocidos_total.setdefault(d, []).append(fila['id_activo'])
        if nuevo != actual.strip():
            cambios.append((fila['id_activo'], {'modulos_responsables': nuevo}, actual, nuevo))

    print(f"Equipos totales: {len(datos)}")
    print(f"Equipos a actualizar: {len(cambios)}\n")

    resumen = {}
    for _, _, antes, despues in cambios:
        resumen[(antes, despues)] = resumen.get((antes, despues), 0) + 1
    for (antes, despues), n in sorted(resumen.items(), key=lambda x: -x[1]):
        print(f"  {n:>4} × {antes!r}\n         -> {despues!r}")

    if desconocidos_total:
        print("\n⚠ Módulos que no están en el catálogo de Sanidad CMA (se dejan tal cual):")
        for d, ids in desconocidos_total.items():
            print(f"   {d!r} — {len(ids)} equipos: {', '.join(ids[:8])}")

    if DRY_RUN:
        print("\nDRY_RUN = True — no se ha escrito nada. Poner DRY_RUN = False para aplicar.")
        return

    actualizar_fila_por_fila(t, [(pk, d) for pk, d, _, _ in cambios])
    print(f"\n✅ Actualizados {len(cambios)} equipos.")


if __name__ == '__main__':
    main()
