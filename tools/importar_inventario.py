"""
Importar inventario de equipos desde CSVs del laboratorio a Google Sheets.

Genera dos archivos de salida en esta misma carpeta:
  - equipos_importar.csv    → filas con ID_Activo, listas para pegar en Sheets
  - equipos_sin_id.csv      → filas sin ID_Activo (requieren revisión manual)

USO:
  python importar_inventario.py

ANTES DE EJECUTAR:
  Ajusta UBICACION_IDS para que coincidan con los IDs reales
  de tu hoja Ubicaciones en Google Sheets.
"""

import csv
import os
import re

INVENTARIO_DIR = r"C:\Users\Paloma\Downloads\Inventario laboratorios"

# Mapeo lab → ID_Ubicacion en tu hoja Ubicaciones.
# Abre la hoja Ubicaciones en Sheets y anota el ID de cada laboratorio.
UBICACION_IDS = {
    "Lab 201": "Lab 201",   # ← sustituye por el ID real, ej. "UB-001"
    "Lab 203": "Lab 203",
    "Lab 205": "Lab 205",
    "Lab 207": "Lab 207",
}

ARCHIVOS_LAB = {
    "Lab 201": "Lab 201.csv",
    "Lab 203": "Lab 203.csv",
    "Lab 205": "Lab 205.csv",
    "Lab 207": "Lab 207.csv",
}

# Columnas A-W (23 columnas) de la hoja Equipos
CABECERA = [
    "ID_Activo", "Tipo_Equipo", "Marca", "Modelo", "Numero_Serie",
    "Ubicacion", "Responsable", "Fecha_Adquisicion", "Origen_Financiacion",
    "Proveedor_Compra", "Proveedor_Servicio_Tecnico", "Estado_Operativo",
    "Periodicidad_Mantenimiento", "Periodicidad_Custom",
    "Fecha_Ultimo_Preventivo", "Fecha_Proximo_Preventivo",
    "Manual_Ficha_Tecnica", "Observaciones", "Coste",
    "Protocolo_Uso", "Tipo_Mantenimiento",
    "Mes_Inicio_Temporada", "Mes_Fin_Temporada",
]

def limpiar(valor):
    """Elimina espacios extra y devuelve el valor limpio."""
    return valor.strip() if valor else ""

def estado_operativo(observaciones):
    """Infiere el estado a partir de las observaciones."""
    obs = observaciones.lower()
    no_funciona = ["no funciona", "no está en uso", "no pasar", "forzada", "revisar"]
    if any(p in obs for p in no_funciona):
        return "En revisión"
    return "Operativo"

def leer_csv(filepath, lab_name):
    """Lee el CSV del lab y devuelve (filas_con_id, filas_sin_id)."""
    con_id = []
    sin_id = []

    ubicacion = UBICACION_IDS.get(lab_name, lab_name)

    with open(filepath, encoding="latin-1") as f:
        reader = csv.reader(f)
        for i, row in enumerate(reader):
            if i < 2:  # saltar las dos filas de cabecera
                continue

            # Columnas 0-8 del CSV (ignorar el resto: tabla de referencia)
            cols = row[:9] if len(row) >= 9 else row + [""] * (9 - len(row))
            cols = [limpiar(c) for c in cols]

            id_activo = cols[0]
            tipo      = cols[1]
            marca     = cols[2]
            modelo    = cols[3]
            serie     = cols[4]
            responsable = cols[5]
            fecha_adq   = cols[6]
            origen      = cols[7]
            observ      = cols[8]

            # Fila vacía (sin ID y sin tipo): saltar
            if not id_activo and not tipo:
                continue

            estado = estado_operativo(observ)

            fila = [
                id_activo,          # A  ID_Activo
                tipo,               # B  Tipo_Equipo
                marca,              # C  Marca
                modelo,             # D  Modelo
                serie,              # E  Numero_Serie
                ubicacion,          # F  Ubicacion
                responsable,        # G  Responsable
                fecha_adq,          # H  Fecha_Adquisicion
                origen,             # I  Origen_Financiacion
                "",                 # J  Proveedor_Compra
                "",                 # K  Proveedor_Servicio_Tecnico
                estado,             # L  Estado_Operativo
                "",                 # M  (legacy)
                "",                 # N  (legacy)
                "",                 # O  (legacy)
                "",                 # P  (legacy)
                "",                 # Q  Manual_Ficha_Tecnica
                observ,             # R  Observaciones
                "",                 # S  Coste
                "",                 # T  Protocolo_Uso
                "",                 # U  Tipo_Mantenimiento
                "",                 # V  Mes_Inicio_Temporada
                "",                 # W  Mes_Fin_Temporada
            ]

            if id_activo:
                con_id.append(fila)
            else:
                sin_id.append(fila)

    return con_id, sin_id

def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    out_con_id  = os.path.join(script_dir, "equipos_importar.csv")
    out_sin_id  = os.path.join(script_dir, "equipos_sin_id.csv")

    todas_con_id  = []
    todas_sin_id  = []

    for lab, archivo in ARCHIVOS_LAB.items():
        filepath = os.path.join(INVENTARIO_DIR, archivo)
        if not os.path.exists(filepath):
            print(f"  [AVISO] No encontrado: {filepath}")
            continue
        con_id, sin_id = leer_csv(filepath, lab)
        print(f"{lab}: {len(con_id)} equipos con ID, {len(sin_id)} sin ID")
        todas_con_id.extend(con_id)
        todas_sin_id.extend(sin_id)

    with open(out_con_id, "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.writer(f)
        writer.writerow(CABECERA)
        writer.writerows(todas_con_id)

    with open(out_sin_id, "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.writer(f)
        writer.writerow(CABECERA)
        writer.writerows(todas_sin_id)

    print(f"\nTotal con ID:  {len(todas_con_id)} equipos → {out_con_id}")
    print(f"Total sin ID:  {len(todas_sin_id)} equipos → {out_sin_id}")
    print("\nPRÓXIMOS PASOS:")
    print("1. Abre equipos_importar.csv y revisa el resultado.")
    print("2. Ajusta la columna F (Ubicacion) con los IDs reales de tu hoja Ubicaciones.")
    print("3. En Google Sheets, selecciona la primera celda vacía bajo la cabecera de Equipos")
    print("   y haz Archivo → Importar → Subir → selecciona equipos_importar.csv")
    print("   (elige 'Añadir a la hoja actual' para no sobreescribir la cabecera).")
    print("4. Revisa equipos_sin_id.csv — esos equipos necesitan un ID_Activo antes de importar.")

if __name__ == "__main__":
    main()
