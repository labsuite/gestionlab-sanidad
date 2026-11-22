# Módulo Muestras congeladas

Sección **🧊 Muestras congeladas** del bloque «Uso del laboratorio» (`page-congelados`,
`js/congelados.js`, `html/modales-congelados.html`, Edge Function `gestionar-congelados`).
Registro genérico de lo que se guarda congelado: cepario, líneas celulares, ácidos nucleicos,
sueros/plasmas/alícuotas y alícuotas de kits y master mix de PCR.

## Diseño acordado con la usuaria (2026-11-22)

- **Dónde**: congelador → caja → casilla. El congelador **no es una tabla propia**: es un equipo
  del inventario (`_congEquipos()`: tipo que contenga congel/frigor/nevera/nitrógeno/dewar/
  crioconserv, sin los dados de baja; los frigoríficos cuentan por su compartimento congelador).
  Cada caja tiene filas × columnas (máx. 26 × 26) y las casillas se nombran A1, A2… B1…
- **Tipos de muestra** con campos propios: cepas microbianas, líneas celulares, ácidos
  nucleicos, sueros/plasmas/alícuotas (sin datos de pacientes), kits y master mix de PCR.
- **Formato** elegido en cada muestra (el tipo solo sugiere uno):
  - *Bolitas* (cepario en crioviales con bolitas): se cuentan las bolitas; cada uso resta una
    y el tubo vuelve a su casilla.
  - *Tubo o vial de un uso* (cepas en tubo normal, viales de células): el uso saca el tubo y
    libera la casilla.
  - *Volumen* (lo que se congela y descongela: master mix, cebadores, sueros, ADN): volumen
    inicial y restante; cada uso descuenta lo gastado y suma una **descongelación**.
- **Kits y master mix enlazados a Material fungible**: stock, pedidos y caducidad siguen allí;
  aquí solo la caja/casilla de cada alícuota, enlazada a su material. No hay dos inventarios.
- **Historial** de cada muestra: fecha, quién (grupo o docente, con `autorRegistro()`) y para
  qué. Un stock nuevo hecho a partir de otro queda enlazado a su origen con el pase siguiente.
- **Permisos**: el alumnado consulta y apunta usos; el profesorado (Admin/Gestor/Profesor) da
  de alta cajas, muestras y stocks nuevos y hace los descartes.

## Estado

1. ✅ **Cajas y cuadrícula** (tabla `cajas_congelado`). Las cajas no se borran: se
   *retiran* (`activa = false`) y se pueden reactivar; retirar exige que esté vacía.
2. ⏳ Alta de muestras por tipo y formato, enlace con Material fungible.
3. ⏳ Usos, bolitas/volumen/descongelaciones, historial y árbol de pases.

`_congMuestrasDeCaja()` ya lee `DATA.muestrasCongeladas` (campos `ID_Caja`, `Posicion`,
`Nombre`, `Abreviatura`, `Estado`) para pintar la cuadrícula: la parte 2 solo tiene que
cargar esa tabla con esos nombres.
