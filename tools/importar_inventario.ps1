# importar_inventario.ps1
# Genera equipos_importar.csv y equipos_sin_id.csv en la misma carpeta.
# Ejecutar con: powershell -ExecutionPolicy Bypass -File importar_inventario.ps1

$inventarioDir = "C:\Users\Paloma\Downloads\Inventario laboratorios"
$scriptDir     = Split-Path -Parent $MyInvocation.MyCommand.Path

# Mapeo lab -> ID_Ubicacion en tu hoja Ubicaciones.
# Sustituye los valores por los IDs reales de tu hoja Ubicaciones en Sheets.
$ubicacionIds = @{
    "Lab 201" = "Lab 201"
    "Lab 203" = "Lab 203"
    "Lab 205" = "Lab 205"
    "Lab 207" = "Lab 207"
}

$archivosLab = [ordered]@{
    "Lab 201" = "Lab 201.csv"
    "Lab 203" = "Lab 203.csv"
    "Lab 205" = "Lab 205.csv"
    "Lab 207" = "Lab 207.csv"
}

$cabecera = @(
    "ID_Activo","Tipo_Equipo","Marca","Modelo","Numero_Serie",
    "Ubicacion","Responsable","Fecha_Adquisicion","Origen_Financiacion",
    "Proveedor_Compra","Proveedor_Servicio_Tecnico","Estado_Operativo",
    "Periodicidad_Mantenimiento","Periodicidad_Custom",
    "Fecha_Ultimo_Preventivo","Fecha_Proximo_Preventivo",
    "Manual_Ficha_Tecnica","Observaciones","Coste",
    "Protocolo_Uso","Tipo_Mantenimiento",
    "Mes_Inicio_Temporada","Mes_Fin_Temporada"
)

# Parser CSV simple: maneja campos con comillas y comas internas
function Parse-CsvLine($line) {
    $fields = @()
    $current = [System.Text.StringBuilder]::new()
    $inQuotes = $false
    $i = 0
    while ($i -lt $line.Length) {
        $ch = $line[$i]
        if ($inQuotes) {
            if ($ch -eq '"') {
                if ($i + 1 -lt $line.Length -and $line[$i+1] -eq '"') {
                    $null = $current.Append('"')
                    $i++
                } else {
                    $inQuotes = $false
                }
            } else {
                $null = $current.Append($ch)
            }
        } else {
            if ($ch -eq '"') {
                $inQuotes = $true
            } elseif ($ch -eq ',') {
                $fields += $current.ToString()
                $current = [System.Text.StringBuilder]::new()
            } else {
                $null = $current.Append($ch)
            }
        }
        $i++
    }
    $fields += $current.ToString()
    return $fields
}

function Escape-Csv($val) {
    if ($null -eq $val) { return "" }
    $s = $val.ToString().Trim()
    if ($s -match '[",\r\n]') { return '"' + $s.Replace('"','""') + '"' }
    return $s
}

function Estado-Operativo($obs) {
    $lower = $obs.ToLower()
    foreach ($p in @("no funciona","no est","forzada","revisar","no pasar")) {
        if ($lower.Contains($p)) { return "En revision" }
    }
    return "Operativo"
}

$todasConId = [System.Collections.Generic.List[object]]::new()
$todasSinId = [System.Collections.Generic.List[object]]::new()

$enc1252 = [System.Text.Encoding]::GetEncoding(1252)

foreach ($lab in $archivosLab.Keys) {
    $archivo  = $archivosLab[$lab]
    $filepath = Join-Path $inventarioDir $archivo

    if (-not (Test-Path $filepath)) {
        Write-Host "  [AVISO] No encontrado: $filepath"
        continue
    }

    $ubicacion = $ubicacionIds[$lab]
    $conId  = 0
    $sinId  = 0
    $filaNum = 0

    $lines = [System.IO.File]::ReadAllLines($filepath, $enc1252)

    foreach ($line in $lines) {
        $filaNum++
        if ($filaNum -le 2) { continue }  # saltar cabeceras

        $f = Parse-CsvLine $line

        # Asegurar al menos 9 campos
        while ($f.Count -lt 9) { $f += "" }

        $id_activo   = $f[0].Trim()
        $tipo        = $f[1].Trim()
        $marca       = $f[2].Trim()
        $modelo      = $f[3].Trim()
        $serie       = $f[4].Trim()
        $responsable = $f[5].Trim()
        $fecha_adq   = $f[6].Trim()
        $origen      = $f[7].Trim()
        $observ      = $f[8].Trim()

        # Fila vacía: saltar
        if (-not $id_activo -and -not $tipo) { continue }

        $estado = Estado-Operativo $observ

        $fila = @(
            $id_activo, $tipo, $marca, $modelo, $serie,
            $ubicacion, $responsable, $fecha_adq, $origen,
            "", "",      # J K proveedores
            $estado,     # L
            "","","","", # M N O P legacy
            "",          # Q manual
            $observ,     # R
            "",          # S coste
            "",          # T protocolo
            "",          # U tipo mant
            "",""        # V W temporada
        )

        if ($id_activo) { $todasConId.Add($fila); $conId++ }
        else            { $todasSinId.Add($fila); $sinId++ }
    }

    Write-Host "${lab}: $conId equipos con ID, $sinId sin ID"
}

function Write-CsvFile($path, $filas) {
    $sb = [System.Text.StringBuilder]::new()
    $null = $sb.AppendLine(($cabecera | ForEach-Object { Escape-Csv $_ }) -join ",")
    foreach ($fila in $filas) {
        $null = $sb.AppendLine(($fila | ForEach-Object { Escape-Csv $_ }) -join ",")
    }
    # UTF-8 con BOM para que Excel/Sheets lo abra correctamente
    [System.IO.File]::WriteAllText($path, $sb.ToString(), (New-Object System.Text.UTF8Encoding $true))
}

$outConId = Join-Path $scriptDir "equipos_importar.csv"
$outSinId = Join-Path $scriptDir "equipos_sin_id.csv"
Write-CsvFile $outConId $todasConId
Write-CsvFile $outSinId $todasSinId

Write-Host ""
Write-Host "Total con ID : $($todasConId.Count) equipos -> $outConId"
Write-Host "Total sin ID : $($todasSinId.Count) equipos -> $outSinId"
Write-Host ""
Write-Host "PROXIMOS PASOS:"
Write-Host "1. Abre equipos_importar.csv y revisa el resultado."
Write-Host "2. Ajusta la col F (Ubicacion) con los IDs reales de tu hoja Ubicaciones en Sheets."
Write-Host "3. En Google Sheets: Archivo > Importar > Subir equipos_importar.csv"
Write-Host "   Elige 'Anadir a la hoja actual' para no machacar la cabecera."
Write-Host "4. Revisa equipos_sin_id.csv - esos equipos necesitan un ID_Activo."
