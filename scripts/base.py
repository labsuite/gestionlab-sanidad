"""
base.py — Funciones comunes para todos los scripts de GestionLab.
Conecta directamente por Postgres al proyecto Supabase de migración
(vnoecaqldymonkgrmvlj) vía el pooler, con la contraseña de servicio —
bypassa RLS igual que las Edge Functions con la service_role key.

Importar con: from base import conectar, leer, buscar, buscar_multi,
buscar_contiene, todas_las_filas, actualizar, actualizar_varios,
actualizar_fila_por_fila, eliminar, eliminar_todas, insertar,
insertar_varios, generar_id, preview_filas

Desde que GestionLab dejó de usar Google Sheets (login a Supabase Auth,
2026-08-06), estas funciones ya no hablan con Sheets — el objeto que antes
era el "worksheet" de gspread ahora es una `Tabla` (nombre + PK + conexión).
buscar/buscar_multi/buscar_contiene/todas_las_filas devuelven valores de
clave primaria en vez de índices de fila, porque Postgres no tiene "fila 5".
"""
import json
import random
import string
import sys

import psycopg2
import psycopg2.extras

sys.stdout.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8')

CREDENTIALS_FILE = 'scripts/supabase_credentials.json'

# Clave primaria de cada tabla — hace falta para poder actualizar/eliminar por PK.
_PK = {
    'ciclos': 'id', 'modulos': 'id', 'usuarios': 'id_usuario', 'ubicaciones': 'id_ubicacion',
    'proveedores': 'id_proveedor', 'equipos': 'id_activo', 'intervenciones': 'id_intervencion',
    'incidencias': 'id_incidencia', 'tareas_intervencion': 'id_tarea',
    'planes_mantenimiento': 'id_plan', 'registro_mantenimientos': 'id_registro',
    'tipos_residuo': 'id_residuo', 'contenedores_residuo': 'id_contenedor',
    'adiciones_residuo': 'id_adicion', 'consultas_residuo': 'id_consulta',
    'config_reservas': 'id_equipo', 'reservas_equipos': 'id_reserva',
    'registros_cabina': 'id_registro', 'registros_autoclave': 'id_registro',
    'material': 'id_material', 'material_ubicaciones': 'id', 'pedidos': 'id_pedido',
    'lineas_pedido': 'id_linea', 'solicitudes': 'id_solicitud',
    'historico_precio': 'id_historico', 'movimientos': 'id_movimiento',
    'revisiones_inventario': 'id_revision', 'tareas_personales': 'id_tarea',
}


class Tabla:
    """Nombre de tabla + su PK + la conexión — sustituye al worksheet de gspread."""
    def __init__(self, conn, nombre, pk):
        self.conn = conn
        self.nombre = nombre
        self.pk = pk


# ---------------------------------------------------------------------------
# CONEXIÓN
# ---------------------------------------------------------------------------

def conectar():
    """Devuelve la conexión a Postgres autenticada."""
    with open(CREDENTIALS_FILE, encoding='utf-8') as f:
        creds = json.load(f)
    return psycopg2.connect(
        host=creds['pooler_host'], port=creds['pooler_port'],
        user=creds['pooler_user'], password=creds['db_password'],
        dbname='postgres', sslmode='require',
    )


def leer(conn, tabla):
    """Devuelve (Tabla, columnas, lista_de_dicts) de todas las filas de la tabla."""
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute(f"select * from {tabla}")
        datos = [dict(r) for r in cur.fetchall()]
    columnas = list(datos[0].keys()) if datos else []
    return Tabla(conn, tabla, _PK.get(tabla, 'id')), columnas, datos


# ---------------------------------------------------------------------------
# BÚSQUEDA — devuelven valores de PK
# ---------------------------------------------------------------------------

def buscar(t, campo, valor):
    """PKs de las filas donde campo == valor (coincidencia exacta)."""
    with t.conn.cursor() as cur:
        cur.execute(f"select {t.pk} from {t.nombre} where {campo} = %s", (valor,))
        return [r[0] for r in cur.fetchall()]


def buscar_multi(t, filtros):
    """PKs de las filas donde TODOS los filtros coinciden. filtros = {campo: valor}."""
    where = ' and '.join(f"{c} = %s" for c in filtros)
    with t.conn.cursor() as cur:
        cur.execute(f"select {t.pk} from {t.nombre} where {where}", list(filtros.values()))
        return [r[0] for r in cur.fetchall()]


def buscar_contiene(t, campo, texto):
    """PKs de las filas donde campo contiene texto (sin distinción de mayúsculas)."""
    with t.conn.cursor() as cur:
        cur.execute(f"select {t.pk} from {t.nombre} where {campo} ilike %s", (f'%{texto}%',))
        return [r[0] for r in cur.fetchall()]


def todas_las_filas(t):
    """PKs de todas las filas de la tabla."""
    with t.conn.cursor() as cur:
        cur.execute(f"select {t.pk} from {t.nombre}")
        return [r[0] for r in cur.fetchall()]


# ---------------------------------------------------------------------------
# ACTUALIZACIÓN — reciben PKs (de buscar/buscar_multi/buscar_contiene/todas_las_filas)
# ---------------------------------------------------------------------------

def actualizar(t, pks, campo, valor):
    """Actualiza un campo en las filas indicadas (una sola sentencia UPDATE)."""
    if not pks:
        print(f"  ⚠ Sin filas para actualizar '{campo}'")
        return 0
    with t.conn.cursor() as cur:
        cur.execute(f"update {t.nombre} set {campo} = %s where {t.pk} = any(%s)", (valor, pks))
        n = cur.rowcount
    t.conn.commit()
    return n


def actualizar_varios(t, pks, cambios):
    """Actualiza múltiples campos (los mismos valores) en las filas indicadas. cambios = {campo: valor}."""
    if not pks:
        print("  ⚠ Sin filas para actualizar")
        return 0
    set_clause = ', '.join(f"{c} = %s" for c in cambios)
    with t.conn.cursor() as cur:
        cur.execute(f"update {t.nombre} set {set_clause} where {t.pk} = any(%s)", [*cambios.values(), pks])
        n = cur.rowcount
    t.conn.commit()
    return n


def actualizar_fila_por_fila(t, actualizaciones):
    """Actualiza campos distintos por fila. actualizaciones = [(pk, {campo: valor}), ...]"""
    if not actualizaciones:
        print("  ⚠ Sin actualizaciones que aplicar")
        return 0
    with t.conn.cursor() as cur:
        for pk_val, cambios in actualizaciones:
            set_clause = ', '.join(f"{c} = %s" for c in cambios)
            cur.execute(f"update {t.nombre} set {set_clause} where {t.pk} = %s", [*cambios.values(), pk_val])
    t.conn.commit()
    return len(actualizaciones)


# ---------------------------------------------------------------------------
# ELIMINACIÓN
# ---------------------------------------------------------------------------

def eliminar(t, pks):
    """Borra las filas con esas PKs."""
    if not pks:
        print("  ⚠ Sin filas que eliminar")
        return 0
    with t.conn.cursor() as cur:
        cur.execute(f"delete from {t.nombre} where {t.pk} = any(%s)", (pks,))
        n = cur.rowcount
    t.conn.commit()
    return n


def eliminar_todas(t):
    """Borra todas las filas de la tabla."""
    with t.conn.cursor() as cur:
        cur.execute(f"select count(*) from {t.nombre}")
        total = cur.fetchone()[0]
        if total == 0:
            print("  ⚠ La tabla ya está vacía")
            return 0
        cur.execute(f"delete from {t.nombre}")
    t.conn.commit()
    return total


# ---------------------------------------------------------------------------
# INSERCIÓN
# ---------------------------------------------------------------------------

def insertar(t, fila_dict):
    """Inserta una fila nueva a partir de un dict {columna: valor}."""
    campos = list(fila_dict.keys())
    with t.conn.cursor() as cur:
        cur.execute(
            f"insert into {t.nombre} ({', '.join(campos)}) values ({', '.join(['%s'] * len(campos))})",
            [fila_dict[c] for c in campos],
        )
    t.conn.commit()


def insertar_varios(t, lista_dicts):
    """Inserta múltiples filas a partir de una lista de dicts {columna: valor}."""
    if not lista_dicts:
        print("  ⚠ Lista vacía, nada que insertar")
        return 0
    campos = sorted({c for d in lista_dicts for c in d})
    with t.conn.cursor() as cur:
        for d in lista_dicts:
            cur.execute(
                f"insert into {t.nombre} ({', '.join(campos)}) values ({', '.join(['%s'] * len(campos))})",
                [d.get(c) for c in campos],
            )
    t.conn.commit()
    return len(lista_dicts)


# ---------------------------------------------------------------------------
# UTILIDADES
# ---------------------------------------------------------------------------

def generar_id(prefijo):
    """Mismo formato que genId() en js/config.js: PREFIJO + 6 caracteres alfanuméricos al azar."""
    alfabeto = string.ascii_uppercase + string.digits
    return prefijo + ''.join(random.choices(alfabeto, k=6))


def preview_filas(t, pks, campos_mostrar, max_filas=20):
    """Muestra un preview de las filas encontradas antes de actuar sobre ellas."""
    if not pks:
        print("  (ninguna fila encontrada)")
        return
    with t.conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute(f"select {t.pk}, {', '.join(campos_mostrar)} from {t.nombre} where {t.pk} = any(%s)", (pks,))
        filas = cur.fetchall()
    print(f"  {'  |  '.join(campos_mostrar)}")
    print(f"  {'—' * 60}")
    for n, row in enumerate(filas):
        if n >= max_filas:
            print(f"  ... y {len(filas) - max_filas} más")
            break
        print(f"  {'  |  '.join(str(row[c]) for c in campos_mostrar)}")
