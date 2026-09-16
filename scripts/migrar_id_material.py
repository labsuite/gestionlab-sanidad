# -*- coding: utf-8 -*-
"""
migrar_id_material.py — engancha por ID los históricos del material fungible.

`movimientos`, `historico_precio`, `lineas_pedido` y `solicitudes` guardan el
material por NOMBRE en texto libre, sin FK. Consecuencia: renombrar un material
deja su historial huérfano en silencio (gestionar-material nunca propagó el
cambio). Con el inventario colaborativo el nombre pasa a generarse a partir de
los atributos, así que renombrar deja de ser excepcional.

Esta migración añade `id_material` a esas cuatro tablas y lo rellena casando por
nombre MIENTRAS los nombres todavía cuadran. La columna de texto se conserva:
sigue siendo la única forma de pedir material no catalogado (ver docs/modulo-pedidos.md).

Ejecutar una sola vez:  python scripts/migrar_id_material.py
"""
import sys
sys.path.insert(0, 'scripts')
sys.stdout.reconfigure(encoding='utf-8')
from base import conectar

# (tabla, columna con el nombre)
TABLAS = [
    ('movimientos',      'material'),
    ('historico_precio', 'nombre_material'),
    ('lineas_pedido',    'material'),
    ('solicitudes',      'material'),
]

DDL = """
alter table {t} add column if not exists id_material text
  references material(id_material) on update cascade on delete set null;
create index if not exists idx_{t}_id_material on {t} (id_material);
"""

# Casado en dos pasadas: exacta primero, y luego tolerante a mayúsculas,
# espacios y tildes (unaccent no está instalado: se normaliza a mano).
BACKFILL_EXACTO = """
update {t} h set id_material = m.id_material
from material m
where h.id_material is null and h.{c} is not null and btrim(h.{c}) = btrim(m.nombre);
"""

BACKFILL_LAXO = """
update {t} h set id_material = m.id_material
from material m
where h.id_material is null and h.{c} is not null
  and translate(lower(btrim(h.{c})), 'áéíóúàèìòùäëïöüñç', 'aeiouaeiouaeiounc')
    = translate(lower(btrim(m.nombre)), 'áéíóúàèìòùäëïöüñç', 'aeiouaeiouaeiounc');
"""


# Tercera pasada: ignorar también comas, puntos, guiones y espacios. Recupera
# historiales rotos por pura puntuación ("Puntas micropipeta 1000uL" frente a
# "Puntas micropipeta, 1000uL"). Solo se aplica cuando la clave normalizada
# apunta a UN único material: si hay empate, no se toca y se revisa a mano.
NORM = "translate(lower(btrim({expr})), 'áéíóúàèìòùäëïöüñç ,.-/', 'aeiouaeiouaeiounc')"

BACKFILL_PUNTUACION = """
with unicos as (
  select {norm_mat} as k, min(id_material) as id_material
  from material group by 1 having count(*) = 1
)
update {t} h set id_material = u.id_material
from unicos u
where h.id_material is null and h.{c} is not null and {norm_col} = u.k;
"""


def pasada_puntuacion(cur, tabla, col):
    sql = BACKFILL_PUNTUACION.format(
        t=tabla, c=col,
        norm_mat=NORM.format(expr='nombre'),
        norm_col=NORM.format(expr='h.' + col),
    )
    cur.execute(sql)
    return cur.rowcount

conn = conectar()
cur = conn.cursor()

for tabla, col in TABLAS:
    cur.execute(DDL.format(t=tabla))
conn.commit()
print("Columnas id_material creadas.\n")

for tabla, col in TABLAS:
    cur.execute(BACKFILL_EXACTO.format(t=tabla, c=col))
    exactas = cur.rowcount
    cur.execute(BACKFILL_LAXO.format(t=tabla, c=col))
    laxas = cur.rowcount
    puntuacion = pasada_puntuacion(cur, tabla, col)
    conn.commit()

    cur.execute(f"select count(*) from {tabla}")
    total = cur.fetchone()[0]
    cur.execute(f"select count(*) from {tabla} where id_material is null and {col} is not null")
    sin_casar = cur.fetchone()[0]
    print(f"{tabla:18} {total:4} filas · {exactas:3} exactas + {laxas:2} tildes + {puntuacion:2} puntuación · {sin_casar:3} sin casar")

# Las que no casan suelen ser material no catalogado (legítimo) o nombres que ya
# se renombraron y perdieron el enlace: se listan para revisarlas a mano.
print("\nSin casar (material no catalogado, o nombres ya rotos):")
for tabla, col in TABLAS:
    cur.execute(f"""select distinct {col} from {tabla}
                    where id_material is null and {col} is not null
                    order by 1 limit 15""")
    filas = [r[0] for r in cur.fetchall()]
    if filas:
        print(f"  {tabla}:")
        for f in filas:
            print(f"     · {f}")

conn.close()
