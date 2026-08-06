"""
importar_alumnos.py — Importar alumnos en masa desde un archivo Excel.

Formato esperado del Excel (una fila por alumno, con cabecera):
  Nombre | Apellidos | Email | Ciclo | Modulos | Labs

  - Nombre y Apellidos: se combinan en "Apellidos, Nombre"
  - Email: obligatorio — con el login de Supabase Auth, sin email no hay
    forma de acceder a la app
  - Ciclo: nombre completo del ciclo
  - Modulos: nombres separados por coma
  - Labs: números de lab separados por coma (ej: "201,203")

Además de la fila en el catálogo `usuarios`, crea una cuenta real de
Supabase Auth con contraseña temporal para cada alumno nuevo (igual que
scripts/onboardear_auth_supabase.py) — sin esto el alumno no podría
iniciar sesión. Las contraseñas se muestran al final para repartirlas;
no se guardan en ningún fichero.

Uso: ! python scripts/importar_alumnos.py
"""
import sys
sys.path.insert(0, 'scripts')
from base import conectar, leer, buscar, insertar, generar_id

try:
    import openpyxl
except ImportError:
    print("❌ Falta openpyxl. Instala con: pip install openpyxl")
    sys.exit(1)

import json
import secrets
import string
import requests

# ===========================================================================
# CONFIGURACIÓN — Claude rellena esta sección cada vez
# ===========================================================================

ARCHIVO_EXCEL = 'scripts/alumnos_nuevos.xlsx'
HOJA_EXCEL = None  # None = primera pestaña

# ===========================================================================
# EJECUCIÓN — no tocar
# ===========================================================================

with open('scripts/supabase_credentials.json', encoding='utf-8') as f:
    CREDS = json.load(f)
SUPABASE_URL = CREDS['project_url']
HEADERS_AUTH = {
    'apikey': CREDS['service_role_key'],
    'Authorization': f"Bearer {CREDS['service_role_key']}",
    'Content-Type': 'application/json',
}


def generar_password():
    alfabeto = string.ascii_letters + string.digits
    return ''.join(secrets.choice(alfabeto) for _ in range(12))


wb = openpyxl.load_workbook(ARCHIVO_EXCEL)
ws_excel = wb.active if HOJA_EXCEL is None else wb[HOJA_EXCEL]
filas_excel = list(ws_excel.values)
if not filas_excel:
    print("❌ El archivo Excel está vacío.")
    sys.exit(1)

cabecera = [str(c).strip() if c else '' for c in filas_excel[0]]
print(f"Columnas detectadas: {cabecera}")

def col(fila, nombre):
    try:
        return str(fila[cabecera.index(nombre)]).strip() if nombre in cabecera else ''
    except (ValueError, IndexError):
        return ''

conn = conectar()
t_usuarios, _, usuarios_actuales = leer(conn, 'usuarios')
t_ciclos, _, ciclos_actuales = leer(conn, 'ciclos')

emails_existentes = {str(d.get('email', '')).lower() for d in usuarios_actuales if d.get('email')}
ciclos_por_nombre = {c['nombre']: c['id'] for c in ciclos_actuales}

resultados = []  # (nombre, email, password) para el resumen final
omitidos = 0
sin_email = 0

for fila in filas_excel[1:]:
    if not any(fila):
        continue  # fila vacía

    nombre    = col(fila, 'Nombre').strip()
    apellidos = col(fila, 'Apellidos').strip()
    email     = col(fila, 'Email').strip().lower()
    ciclo     = col(fila, 'Ciclo').strip()
    modulos   = col(fila, 'Modulos').strip()
    labs      = col(fila, 'Labs').strip()

    nombre_completo = f"{apellidos}, {nombre}" if apellidos else nombre

    if not email:
        print(f"  ⚠ {nombre_completo} sin email — omitido (no podría iniciar sesión)")
        sin_email += 1
        continue

    if email in emails_existentes:
        print(f"  ⚠ Ya existe: {email} — omitido")
        omitidos += 1
        continue

    # 1. Fila en el catálogo usuarios
    nuevo_id = generar_id('USR-')
    insertar(t_usuarios, {
        'id_usuario':             nuevo_id,
        'nombre':                 nombre_completo,
        'email':                  email,
        'rol':                    'Alumno',
        'activo':                 True,
        'ubicaciones_asignadas':  labs,
        'modulo':                 modulos,
        'ciclo_principal':        ciclo,
    })

    # 2. Cuenta real de Supabase Auth (si no la tenía ya)
    with conn.cursor() as cur:
        cur.execute("select 1 from users where lower(email) = %s", (email,))
        ya_tiene_auth = cur.fetchone() is not None

    password = None
    if not ya_tiene_auth:
        password = generar_password()
        r = requests.post(f'{SUPABASE_URL}/auth/v1/admin/users', headers=HEADERS_AUTH,
                           json={'email': email, 'password': password, 'email_confirm': True})
        if not r.ok:
            print(f"  ✗ {email}: catálogo creado pero falló la cuenta de acceso — {r.status_code} {r.text}")
        else:
            user_id = r.json()['id']
            ciclo_id = ciclos_por_nombre.get(ciclo)
            if ciclo and not ciclo_id:
                with conn.cursor() as cur:
                    cur.execute("insert into ciclos (nombre) values (%s) returning id", (ciclo,))
                    ciclo_id = cur.fetchone()[0]
                conn.commit()
                ciclos_por_nombre[ciclo] = ciclo_id
            with conn.cursor() as cur:
                cur.execute("""
                    insert into users (id, gestionlab_id, nombre, email, rol, activo, ciclo_principal_id, puede_revisar_inventario)
                    values (%s, %s, %s, %s, 'Alumno', true, %s, false)
                """, (user_id, nuevo_id, nombre_completo, email, ciclo_id))
            conn.commit()

    print(f"  · {nuevo_id} — {nombre_completo} ({ciclo}){' [cuenta nueva]' if password else ''}")
    emails_existentes.add(email)
    if password:
        resultados.append((nombre_completo, email, password))

print(f"\n✅ {len(resultados)} alumno(s) importado(s) con cuenta nueva. "
      f"{omitidos} omitido(s) por duplicado. {sin_email} omitido(s) sin email.")

if resultados:
    print("\n" + "=" * 70)
    print("CONTRASEÑAS TEMPORALES — distribuir y no guardar este listado")
    print("=" * 70)
    for nombre, email, password in resultados:
        print(f"{nombre:35s} {email:40s} {password}")

conn.close()
