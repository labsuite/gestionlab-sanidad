#!/usr/bin/env python3
"""
quitar_externos_excel.py
Elimina del Excel exportado las filas de mantenimiento Externo.
Manipula el XML interno del XLSX directamente para preservar el formato.

Uso:
  python scripts/quitar_externos_excel.py
  python scripts/quitar_externos_excel.py "C:/ruta/al/archivo.xlsx"
"""

import sys
import re
import zipfile
import io
from pathlib import Path


# ─────────────── CONFIGURACIÓN ───────────────
# Dejar en None para buscar automáticamente en Descargas/OneDrive
RUTA_EXCEL = None
# ─────────────────────────────────────────────

SHEETS_LAB = ['xl/worksheets/sheet2.xml',
               'xl/worksheets/sheet3.xml',
               'xl/worksheets/sheet4.xml',
               'xl/worksheets/sheet5.xml']


def encontrar_excel():
    candidatas = [
        Path.home() / 'Downloads',
        Path.home() / 'Descargas',
        Path.home() / 'OneDrive' / 'Descargas',
        Path.home() / 'OneDrive' / 'Downloads',
    ]
    for carpeta in candidatas:
        if carpeta.exists():
            archivos = sorted(
                carpeta.glob('MD84MAN01_Plan_mantemento_*.xlsx'),
                key=lambda p: p.stat().st_mtime,
                reverse=True,
            )
            if archivos:
                return archivos[0]
    return None


def eliminar_filas_externas(xml: str) -> tuple[str, int]:
    """Elimina <row> cuya celda de columna D contiene 'Externo'."""
    eliminadas = 0

    def filtrar_row(m):
        nonlocal eliminadas
        row_num = m.group(1)
        content = m.group(0)
        # Buscar celda D<n> con valor inline "Externo"
        if re.search(
            rf'<c r="D{row_num}"[^>]*t="inlineStr"[^>]*><is><t>Externo</t></is></c>',
            content,
        ):
            eliminadas += 1
            return ''
        return content

    resultado = re.sub(r'<row r="(\d+)"[^>]*>[\s\S]*?</row>', filtrar_row, xml)
    return resultado, eliminadas


def main():
    # Ruta del archivo
    if len(sys.argv) > 1:
        ruta = Path(sys.argv[1])
    elif RUTA_EXCEL:
        ruta = Path(RUTA_EXCEL)
    else:
        ruta = encontrar_excel()

    if not ruta or not ruta.exists():
        print('No se encontró el archivo. Pasa la ruta como argumento o configura RUTA_EXCEL.')
        sys.exit(1)

    print(f'Archivo: {ruta}')

    # Leer el ZIP y procesar en memoria
    buf = io.BytesIO()
    total_eliminadas = 0

    with zipfile.ZipFile(ruta, 'r') as zin:
        with zipfile.ZipFile(buf, 'w', zipfile.ZIP_DEFLATED) as zout:
            for name in zin.namelist():
                data = zin.read(name)
                info = zin.getinfo(name)

                if name in SHEETS_LAB:
                    xml = data.decode('utf-8')
                    xml, n = eliminar_filas_externas(xml)
                    data = xml.encode('utf-8')
                    sheet_label = name.split('/')[-1].replace('.xml', '')
                    print(f'  {sheet_label}: {n} filas externas eliminadas')
                    total_eliminadas += n

                zout.writestr(info, data)

    # Guardar con sufijo _sin_externos
    salida = ruta.parent / (ruta.stem + '_sin_externos' + ruta.suffix)
    salida.write_bytes(buf.getvalue())
    print(f'\nGuardado: {salida}')
    print(f'Total filas eliminadas: {total_eliminadas}')


if __name__ == '__main__':
    main()
