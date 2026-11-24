"""
Marca como REUTILIZABLE el material que no se gasta (vidrio, gradillas, pinzas, aspiradores…)
— decisión de Paloma, 2026-11-24: con la norma «el gasto es el envase que se abre», esos
objetos no se gastan; se rompen o se dan de baja. El material reutilizable no tiene «📦» y el
servidor no admite apuntarle consumo.

Es solo el relleno inicial: a partir de aquí se marca y desmarca a mano en la ficha del
material (casilla «♻️ Reutilizable»). Crea la columna si no existe. Idempotente.

Uso:  python scripts/marcar_material_reutilizable.py            (simulación)
      python scripts/marcar_material_reutilizable.py --aplicar  (guarda)
"""
import sys
from base import conectar

APLICAR = "--aplicar" in sys.argv

# Todo el material de vidrio que se cuenta por unidades (matraces, vasos, probetas, botes,
# cristalizadores, buretas, cámaras Neubauer…). Los portas y cubreobjetos van en cajas: no entran.
REGLA_VIDRIO = "categoria like 'Material de vidrio%%' and unidad = 'unidad/es'"

# El resto, por nombre exacto.
NOMBRES = [
    # Colorante y tinción
    "Pinzas de tinción", "Soporte de tinción", "Bandeja de tinción para portaobjetos", "Cestilla de tinción",
    # EPI y seguridad
    "Gafas de protección Contour II", "Pantallas de seguridad", "Gafas de seguridad",
    # Equipamiento menor
    "Gradillas de plástico", "Bandeja para muestras, plástico", "Aspirador de cremalleira, 10 mL",
    "Aspirador de cremalleira, 2 mL", "Aspirador de cremalleira, 25 mL", "Gradilla de metal",
    "Gradilla metálica, 12 tubos, 16 mm", "Papelera con pedal", "Pera goma", "Cuenta unidades",
    "Pinzas para crisol", "Varilla para soporte", "Timer clock", "Batidora de mano con picadora",
    "Refractómetro de Abbe", "Linterna de luz UV",
    # Material fungible (mal categorizados: no son fungibles)
    "Pinceles, histología", "Afilador",
    # Otro
    "Pulverizadores", "Pincel, nº 2", "Brocha pequeña", "Exprimidor de plástico",
    "Caja de cartón congelable para criotubos", "Caja de plástico congelable para criotubos",
    "Gradilla Stomacher", "Jarra graduada de plástico, 2 L", "Tope puerta",
]

conn = conectar()
cur = conn.cursor()
cur.execute("select 1 from information_schema.columns where table_name='material' and column_name='reutilizable'")
existe = cur.fetchone() is not None
if not existe:
    print("La columna material.reutilizable no existe" + (": se crea." if APLICAR else " (se creará con --aplicar)."))
    if APLICAR:
        cur.execute("alter table material add column if not exists reutilizable boolean not null default false")
        conn.commit()
        existe = True

cur.execute(f"select id_material, nombre from material where {REGLA_VIDRIO} order by nombre")
vidrio = cur.fetchall()
cur.execute("select id_material, nombre from material where nombre = any(%s) order by nombre", (NOMBRES,))
otros = cur.fetchall()
encontrados = {n for _, n in otros}
faltan = [n for n in NOMBRES if n not in encontrados]
if faltan:
    print("⚠ No encontrados (revisar el nombre):", faltan)
repetidos = [n for n in encontrados if sum(1 for _, x in otros if x == n) > 1]
if repetidos:
    print("⚠ Nombres repetidos (se marcan todos):", repetidos)

ids = sorted({i for i, _ in vidrio} | {i for i, _ in otros})
print(f"\nMaterial de vidrio por unidades: {len(vidrio)}")
for _, n in vidrio: print("  ·", n)
print(f"\nOtros por nombre: {len(otros)}")
for _, n in otros: print("  ·", n)
print(f"\nTotal a marcar como reutilizable: {len(ids)}")

if not APLICAR:
    print("\nSimulación: no se ha guardado nada. Ejecuta con --aplicar para guardar.")
    sys.exit(0)

cur.execute("update material set reutilizable = true where id_material = any(%s) and reutilizable = false", (ids,))
print(f"Marcados ahora: {cur.rowcount}")
conn.commit()
cur.execute("select count(*) from material where reutilizable")
print("Reutilizables en total:", cur.fetchone()[0])
