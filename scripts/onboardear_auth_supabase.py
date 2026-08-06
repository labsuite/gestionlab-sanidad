"""
Alta puntual de cuentas reales de Supabase Auth para todo el profesorado y
alumnado activo que todavía solo existe en el catálogo `usuarios` pero no
tiene login real en `auth.users`/`public.users` (Admin y los 2 Gestor ya lo
tienen desde el arranque de la migración).

Mismo patrón que la Edge Function crear-usuario, pero en bloque y llamado
directamente con la service_role key (no hace falta pasar por el token de
Google de un Admin real).

Imprime al final una tabla email -> contraseña temporal para que la gestora
la distribuya. NO se guarda en ningún fichero del repo ni se sube a git.

Uso: python scripts/onboardear_auth_supabase.py
"""
import json
import secrets
import string
import sys

import psycopg2
import requests

sys.stdout.reconfigure(encoding='utf-8')

with open('scripts/supabase_credentials.json', encoding='utf-8') as f:
    CREDS = json.load(f)

SUPABASE_URL = CREDS['project_url']
SERVICE_KEY = CREDS['service_role_key']
HEADERS = {
    'apikey': SERVICE_KEY,
    'Authorization': f'Bearer {SERVICE_KEY}',
    'Content-Type': 'application/json',
}

def generar_password():
    alfabeto = string.ascii_letters + string.digits
    return ''.join(secrets.choice(alfabeto) for _ in range(12))

def conectar_pg():
    return psycopg2.connect(
        host=CREDS['pooler_host'], port=CREDS['pooler_port'],
        user=CREDS['pooler_user'], password=CREDS['db_password'],
        dbname='postgres', sslmode='require',
    )

conn = conectar_pg()
cur = conn.cursor()

cur.execute("""
    select id_usuario, nombre, email, rol, ciclo_principal, puede_revisar_inventario
    from usuarios
    where activo = true and lower(email) not in (select lower(email) from users)
    order by rol, nombre
""")
pendientes = cur.fetchall()
print(f'{len(pendientes)} cuentas por dar de alta.\n')

resultados = []
for id_usuario, nombre, email, rol, ciclo_principal, puede_revisar in pendientes:
    email = email.strip().lower()

    # Resolver/crear ciclo
    ciclo_id = None
    if ciclo_principal:
        cur.execute("select id from ciclos where nombre = %s", (ciclo_principal,))
        row = cur.fetchone()
        if row:
            ciclo_id = row[0]
        else:
            cur.execute("insert into ciclos (nombre) values (%s) returning id", (ciclo_principal,))
            ciclo_id = cur.fetchone()[0]
            conn.commit()

    password = generar_password()
    r = requests.post(
        f'{SUPABASE_URL}/auth/v1/admin/users',
        headers=HEADERS,
        json={'email': email, 'password': password, 'email_confirm': True},
    )
    if not r.ok:
        print(f'  ✗ {email}: no se pudo crear en Auth — {r.status_code} {r.text}')
        continue
    user_id = r.json()['id']

    try:
        cur.execute("""
            insert into users (id, gestionlab_id, nombre, email, rol, activo, ciclo_principal_id, puede_revisar_inventario)
            values (%s, %s, %s, %s, %s, true, %s, %s)
        """, (user_id, id_usuario, nombre, email, rol, ciclo_id, bool(puede_revisar)))
        conn.commit()
    except Exception as e:
        conn.rollback()
        print(f'  ✗ {email}: cuenta Auth creada pero falló el perfil en public.users — {e}')
        continue

    resultados.append((nombre, email, rol, password))
    print(f'  ✓ {nombre} ({rol}) — {email}')

cur.close()
conn.close()

print('\n' + '=' * 70)
print('CONTRASEÑAS TEMPORALES — distribuir y no guardar este listado')
print('=' * 70)
for nombre, email, rol, password in resultados:
    print(f'{nombre:35s} {rol:12s} {email:40s} {password}')
