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
   *retiran* (`activa = false`) y se pueden reactivar; retirar exige que esté vacía
   (lo comprueba también el servidor).
2. ✅ **Muestras** (tabla `muestras_congeladas`), ver abajo.
3. ⏳ Usos (restar bolitas / volumen, sumar descongelaciones, sacar tubos de un uso), historial
   y árbol de pases (`id_lote_origen`). Es lo único que podrá hacer el alumnado.

## Muestras (parte 2)

- **Una fila por tubo**, cada una en una casilla. Los tubos del mismo stock comparten
  `id_lote`: al editar, nombre, tipo, formato, fechas, material y `datos` se aplican a todo el
  lote; caja/casilla y cantidad que queda, solo a ese tubo (`editar_muestra`).
- Índice único parcial `uq_muestras_congeladas_casilla (id_caja, posicion) where estado =
  'Disponible'`: un tubo por casilla; los descartados/agotados liberan la casilla.
- Alta (`crear_muestras`): N tubos de golpe desde una casilla, ocupando las siguientes libres
  por filas (A1, A2… B1…), calculado en el cliente con `_congCasillasLibres()` y validado
  otra vez en el servidor (casilla dentro de la caja y libre).
- Los tipos y sus campos propios se definen en `_CONG_TIPOS` (`js/congelados.js`); los campos
  van al jsonb `datos`. Para añadir un tipo hay que tocarlo ahí **y** en el `check` de `tipo`
  de la tabla y en `TIPOS` de la Edge Function.
- Cantidades: `Bolitas` → `cantidad_*` en bolitas (25 por defecto); `Tubo` → siempre 1;
  `Volumen` → en `unidad` (µL/mL). «Queda poco» = ≤ 2 bolitas o < 20 % del volumen inicial.
- Descartar (`descartar_muestra`): motivo obligatorio, el tubo o todo el lote; pasa a
  `Descartada` con `fecha_baja`/`motivo_baja` y no se borra.
- Pulsar una casilla vacía abre el alta en esa casilla; pulsar un tubo, su ficha (los demás
  tubos del mismo lote se marcan con borde discontinuo). El buscador de arriba busca en
  nombre, tipo, caja, material enlazado y datos propios.
