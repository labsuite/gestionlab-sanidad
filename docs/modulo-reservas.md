# Módulo de reservas de equipos – COMPLETADO (2026-05-18)

## Hojas en Sheets
- **Config_Reservas** — columnas A-E: `ID_Equipo, Politica, Params_Template, Max_Horas, Antelacion_Min_Horas`
  - `Params_Template`: JSON con lista de parámetros, p.ej. `[{"nombre":"Temperatura","unidad":"°C","tolerancia":1}]`
- **Reservas_Equipos** — columnas A-L: `ID_Reserva, ID_Equipo, Usuario, Fecha_Inicio, Fecha_Fin, Condiciones, Proposito, Estado, Aprobado_Por, Observaciones_Admin, Inicio_Real, Fin_Real`
  - `Condiciones`: JSON con valores por parámetro, p.ej. `{"Temperatura":"37","CO2":"5"}`

## Equipos reservables pre-configurados (23 equipos)
- **BLOCK** (uso exclusivo): autoclaves (`AUTC-*`), termocicladores PCR (`PCR-*`), cabina de bioseguridad (`CAB-03`)
- **COMPATIBLE_CONDITIONS** con CO2+Temperatura: incubadoras (`INC-*`)
- **COMPATIBLE_CONDITIONS** con Temperatura: estufas (`EST-*`), baños termostáticos (`BAT-*`)

## Políticas de conflicto
- **BLOCK**: solo una reserva activa por tramo horario; cualquier solapamiento = conflicto
- **COMPATIBLE_CONDITIONS**: varias reservas coexisten si parámetros numéricos están dentro de tolerancia y los textuales coinciden exactamente

## Estados de reserva
- Sin conflicto → `Confirmada` (auto-aprobada)
- Con conflicto → `Pendiente` + toast warning
- `Confirmada` → `Activa` (con `iniciarUso()`) → `Completada`
- `Pendiente` → `Confirmada` / `Rechazada` / `En conflicto` (por Gestor)

## Roles
- Todos (incluido Alumno y Profesor): pueden solicitar reservas y ver disponibilidad
- Gestor y Administrador: aprueban/rechazan, marcan conflictos, configuran equipos reservables
- Badge en nav muestra reservas `Pendiente` (solo Gestor/Admin); solo aparece cuando hay conflicto real

## Navegación
Ítem "📅 Reservas" en el sidebar, dentro de la sección **Equipos**, justo debajo de "🛡️ Mantenimiento".

## Pendiente (datos)
- Revisar tolerancias: incubadoras (CO2 ±0.5%, temperatura ±0.5°C) y estufas/baños (temperatura ±1°C) con la gestora.
- Añadir más equipos reservables si procede (procesador de tejidos, citómetro…).
