"""
importar_alumnos.py — Importar alumnos en masa desde un archivo Excel.

Formato esperado del Excel (una fila por alumno, con cabecera):
  Nombre | Apellidos | Email | Ciclo | Modulos | Labs

  - Nombre y Apellidos: se combinan en "Apellidos, Nombre"
  - Email: opcional; si está vacío se deja en blanco
  - Ciclo: nombre completo del ciclo (debe coincidir con Ciclos_Modulos)
  - Modulos: nombres separados por coma
  - Labs: números de lab separados por coma (ej: "201,203")

Uso: ! python scripts/importar_alumnos.py
"""
import sys
sys.path.insert(0, 'scripts')
from base import conectar, leer, buscar, siguiente_id, insertar_varios

try:
    import openpyxl
except ImportError:
    print("❌ Falta openpyxl. Instala con: pip install openpyxl")
    sys.exit(1)

# ===========================================================================
# CONFIGURACIÓN — Claude rellena esta sección cada vez
# ===========================================================================

# Ruta al archivo Excel con los alumnos nuevos
ARCHIVO_EXCEL = 'scripts/alumnos_nuevos.xlsx'

# Nombre de la pestaña del Excel (None = primera pestaña)
HOJA_EXCEL = None

# Si el alumno ya existe (mismo email), ¿actualizar sus datos?
ACTUALIZAR_DUPLICADOS = False

# ===========================================================================
# EJECUCIÓN — no tocar
# ===========================================================================

# Leer Excel
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

# Conectar a Sheets
sh = conectar()
ws_usuarios, headers, datos_actuales = leer(sh, 'Usuarios')

# Emails ya existentes para detectar duplicados
emails_existentes = {str(d.get('Email', '')).lower() for d in datos_actuales}

# Generar filas nuevas
nuevos = []
omitidos = 0

for fila in filas_excel[1:]:
    if not any(fila):
        continue  # fila vacía

    nombre    = col(fila, 'Nombre').strip()
    apellidos = col(fila, 'Apellidos').strip()
    email     = col(fila, 'Email').strip()
    ciclo     = col(fila, 'Ciclo').strip()
    modulos   = col(fila, 'Modulos').strip()
    labs      = col(fila, 'Labs').strip()

    nombre_completo = f"{apellidos}, {nombre}" if apellidos else nombre

    if email and email.lower() in emails_existentes:
        if not ACTUALIZAR_DUPLICADOS:
            print(f"  ⚠ Ya existe: {email} — omitido")
            omitidos += 1
            continue

    nuevo_id = siguiente_id(ws_usuarios, 'ID_Usuario', 'USR')

    nuevos.append({
        'ID_Usuario':            nuevo_id,
        'Nombre':                nombre_completo,
        'Email':                 email,
        'Rol':                   'Alumno',
        'Activo':                'Sí',
        'Ubicaciones_Asignadas': labs,
        'Modulo':                modulos,
        'Ciclo_Principal':       ciclo,
    })
    print(f"  · {nuevo_id} — {nombre_completo} ({ciclo})")

    # Registrar email para detectar duplicados dentro del mismo lote
    if email:
        emails_existentes.add(email.lower())

if not nuevos:
    print("\nNada que insertar.")
    sys.exit(0)

insertar_varios(ws_usuarios, nuevos, headers)
print(f"\n✅ {len(nuevos)} alumno(s) importado(s). {omitidos} omitido(s) por duplicado.")
