# -*- coding: utf-8 -*-
"""
migrar_atributos_material.py — ficha de atributos por tipo de material (fase B).

El alumnado no escribe el nombre de un material: rellena los atributos que
importan de ese tipo de producto y el nombre se COMPONE a partir de ellos. Así
no puede colar el nombre comercial, y de paso se acaban las variantes del mismo
material ("Cristalizador 180mm" frente a "Cristalizador, 100 mm").

La ficha es DATO, no código: vive en `atributos_material` para que se pueda
retocar desde la app sin tocar el JS. Este script solo la siembra con lo
acordado con la usuaria el 2026-09-16, a partir de sus 52 materiales reales.

Forma de cada atributo:
  clave        identificador interno, sin espacios
  etiqueta     lo que ve quien rellena
  tipo         numero | texto | opcion | booleano
  unidad       sufijo de la unidad (mL, µL, mm...)
  opciones     valores posibles (solo tipo=opcion)
  obligatorio  si hay que rellenarlo para poder proponer
  nombre       cómo entra en el nombre compuesto:
                 sep     coma | espacio | omitir   (omitir = no sale en el nombre)
                 prefijo texto delante del valor    ("talla ")
                 sufijo  texto detrás del valor     (" mL")
                 textoSi para booleanos: qué se escribe cuando es que sí

Convención de nombre acordada: `Base, atributo, atributo`, punto decimal (0.5%,
no 0,5%) y en reactivos el orden nombre → fórmula → concentración
("Ácido clorhídrico, HCl, 37%").

El nombre se compone recorriendo los atributos EN EL ORDEN DE LA FICHA y pegando
cada uno al texto acumulado con su separador. Por eso lo que se une con espacio
va declarado antes que lo que se separa con coma:
  Pipetas serológicas + estériles(espacio) + 10 mL(coma) = "Pipetas serológicas estériles, 10 mL"

Ejecutar una sola vez:  python scripts/migrar_atributos_material.py
"""
import json
import sys

sys.path.insert(0, 'scripts')
sys.stdout.reconfigure(encoding='utf-8')
from base import conectar

DDL = """
create table if not exists atributos_material (
  id_ficha     text primary key,
  categoria    text not null,
  tipo_base    text not null,
  -- Nombre con el que empieza el nombre compuesto. Null en las familias donde
  -- la base cambia con cada producto (cada ácido se llama distinto): ahí lo
  -- elige quien propone, con autocompletado contra el catálogo.
  nombre_base  text,
  orden        integer not null default 0,
  atributos    jsonb not null default '[]'::jsonb,
  activa       boolean not null default true,
  unique (categoria, tipo_base)
);

-- Por si la tabla ya existía de una ejecución anterior: `create table if not
-- exists` no añade columnas nuevas.
alter table atributos_material add column if not exists nombre_base text;

create index if not exists idx_atributos_material_categoria on atributos_material (categoria);

alter table atributos_material enable row level security;
grant all on atributos_material to service_role;
grant select, insert, update, delete on atributos_material to authenticated;
grant select on atributos_material to anon;
drop policy if exists "atributos_material_select_anon" on atributos_material;
create policy "atributos_material_select_anon"
  on atributos_material for select to anon, authenticated using (true);

-- Los valores concretos de cada material del catálogo. jsonb y no columnas
-- porque los atributos dependen del tipo de producto y cambian con la ficha.
alter table material add column if not exists atributos jsonb not null default '{}'::jsonb;
"""


# "%" y "º" van pegados al número (37%, 96º); las unidades de medida llevan
# espacio delante (10 mL, 180 mm). Es la convención tipográfica normal y la que
# ya usa el catálogo en casi todos los casos.
PEGADAS = ("%", "º")


def num(clave, etiqueta, unidad, sep="coma", obligatorio=True, prefijo="", sufijo=None):
    if sufijo is None:
        sufijo = unidad if unidad in PEGADAS else ((" " + unidad) if unidad else "")
    return {"clave": clave, "etiqueta": etiqueta, "tipo": "numero", "unidad": unidad,
            "obligatorio": obligatorio,
            "nombre": {"sep": sep, "prefijo": prefijo, "sufijo": sufijo}}


def txt(clave, etiqueta, sep="coma", obligatorio=False, prefijo="", sufijo=""):
    return {"clave": clave, "etiqueta": etiqueta, "tipo": "texto", "obligatorio": obligatorio,
            "nombre": {"sep": sep, "prefijo": prefijo, "sufijo": sufijo}}


def opc(clave, etiqueta, opciones, sep="coma", obligatorio=True, prefijo="", sufijo=""):
    return {"clave": clave, "etiqueta": etiqueta, "tipo": "opcion", "opciones": opciones,
            "obligatorio": obligatorio,
            "nombre": {"sep": sep, "prefijo": prefijo, "sufijo": sufijo}}


def boo(clave, etiqueta, texto_si, sep="espacio", obligatorio=False):
    return {"clave": clave, "etiqueta": etiqueta, "tipo": "booleano", "obligatorio": obligatorio,
            "nombre": {"sep": sep, "prefijo": "", "sufijo": "", "textoSi": texto_si}}


# (categoría, tipo base, nombre base sugerido, [atributos])
FICHAS = [
    # ── Reactivo químico ────────────────────────────────────────────────
    ("Reactivo químico", "Ácidos y bases", None, [
        txt("formula", "Fórmula", obligatorio=True),
        num("concentracion", "Concentración", "%"),
        txt("pureza", "Grado de pureza", sep="omitir"),
    ]),
    ("Reactivo químico", "Disolventes", None, [
        num("concentracion", "Concentración", "%"),
    ]),
    ("Reactivo químico", "Sólidos", None, [
        txt("pureza", "Pureza", sep="omitir"),
    ]),
    ("Reactivo químico", "Indicadores", None, [
        opc("presentacion", "Presentación", ["solución", "polvo"], obligatorio=False),
        num("concentracion", "Concentración", "%", obligatorio=False),
    ]),
    ("Reactivo químico", "Reactivos en ampolla", None, []),

    # ── Material fungible ───────────────────────────────────────────────
    ("Material fungible", "Pipetas serológicas", "Pipetas serológicas", [
        boo("esteril", "Estériles", "estériles"),
        num("volumen", "Volumen", "mL"),
    ]),
    ("Material fungible", "Puntas de micropipeta", "Puntas micropipeta", [
        boo("esteril", "Estériles", "estériles"),
        num("volumen", "Volumen", "µL"),
        boo("con_filtro", "Con filtro", "con filtro", sep="coma"),
    ]),
    ("Material fungible", "Placas Petri", "Placas Petri", [
        boo("esteril", "Estériles", "estériles"),
        num("diametro", "Diámetro", "mm"),
    ]),
    ("Material fungible", "Flask cultivo celular", "Flask cultivo celular", [
        opc("superficie", "Superficie", ["T25", "T75", "T175"]),
        opc("tapon", "Tipo de tapón", ["tapón con filtro", "tapón normal"], obligatorio=False),
    ]),
    ("Material fungible", "Jeringuillas", "Jeringuillas", [
        boo("esteril", "Estériles", "estériles"),
        num("volumen", "Volumen", "mL"),
    ]),
    ("Material fungible", "Pinzas", "Pinzas", [
        boo("esteril", "Estériles", "estériles"),
        txt("material", "Material", obligatorio=False),
    ]),

    # ── Material de vidrio ──────────────────────────────────────────────
    ("Material de vidrio", "Cristalizadores", "Cristalizador", [
        num("diametro", "Diámetro", "mm"),
    ]),
    ("Material de vidrio", "Cámaras de recuento", "Cámara", [
        txt("modelo", "Modelo", obligatorio=True),
    ]),

    # ── EPI y seguridad ─────────────────────────────────────────────────
    ("EPI y seguridad", "Guantes", "Guantes", [
        opc("material", "Material", ["nitrilo", "látex", "vinilo"], sep="espacio"),
        opc("talla", "Talla", ["XS", "S", "M", "L", "XL"], prefijo="talla "),
        boo("con_polvo", "Con polvo", "con polvo", sep="coma"),
    ]),

    # ── Papel y filtración ──────────────────────────────────────────────
    ("Papel y filtración", "Papel secante", "Papel secante", [
        opc("formato", "Formato", ["rollo", "hoja"], sep="coma"),
        txt("tamano", "Tamaño", sep="espacio", obligatorio=False),
    ]),

    # ── Colorante y tinción ─────────────────────────────────────────────
    ("Colorante y tinción", "Colorantes y tinciones", None, [
        opc("presentacion", "Presentación", ["solución", "polvo"], obligatorio=False),
        num("concentracion", "Concentración", "%", obligatorio=False),
    ]),
    ("Colorante y tinción", "Medios de montaje", None, [
        opc("tipo_medio", "Tipo de medio", ["acuoso", "resina", "fluorescencia"]),
    ]),

    # ── Kit diagnóstico ─────────────────────────────────────────────────
    ("Kit diagnóstico", "Kits", None, [
        num("determinaciones", "Nº de determinaciones o usos", "", sep="omitir", obligatorio=False),
    ]),
]


def generar_id(categoria, tipo_base):
    import re
    base = re.sub(r'[^a-z0-9]+', '_', (categoria[:4] + '_' + tipo_base).lower()).strip('_')
    return ('FAT_' + base)[:60]


conn = conectar()
cur = conn.cursor()
cur.execute(DDL)
conn.commit()
print("Tabla atributos_material lista y columna material.atributos creada.\n")

for orden, (categoria, tipo_base, nombre_base, attrs) in enumerate(FICHAS):
    cur.execute("""
        insert into atributos_material (id_ficha, categoria, tipo_base, nombre_base, orden, atributos, activa)
        values (%s, %s, %s, %s, %s, %s::jsonb, true)
        on conflict (categoria, tipo_base) do update
          set atributos = excluded.atributos, nombre_base = excluded.nombre_base,
              orden = excluded.orden, activa = true
    """, (generar_id(categoria, tipo_base), categoria, tipo_base, nombre_base, orden,
          json.dumps(attrs, ensure_ascii=False)))
conn.commit()

cur.execute("select categoria, tipo_base, coalesce(nombre_base,'(lo elige quien propone)'), jsonb_array_length(atributos) from atributos_material order by orden")
print(f"{'CATEGORÍA':22} {'TIPO BASE':24} {'NOMBRE BASE':28} ATRS")
for c, t, nb, n in cur.fetchall():
    print(f"{c:22} {t:24} {nb:28} {n}")
conn.close()
