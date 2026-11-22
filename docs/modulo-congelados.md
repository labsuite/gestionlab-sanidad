# Módulo Muestras congeladas

Sección **🧊 Muestras congeladas** del bloque «Uso del laboratorio» (`page-congelados`,
`js/congelados.js`, `html/modales-congelados.html`, Edge Function `gestionar-congelados`).
Registro genérico de lo que se guarda congelado: cepario, líneas celulares, ácidos nucleicos,
sueros o plasmas y reactivos (master mix, alícuotas de antibiótico, FBS, enzimas, cebadores…).

## Diseño acordado con la usuaria (2026-11-22)

- **Dónde**: congelador → caja → casilla. El congelador **no es una tabla propia**: es un equipo
  del inventario (`_congEquipos()`: tipo que contenga congel/frigor/nevera/nitrógeno/dewar/
  crioconserv, sin los dados de baja; los frigoríficos cuentan por su compartimento congelador).
  Cada caja tiene filas × columnas (máx. 26 × 26) y las casillas se nombran A1, A2… B1…
- **Tipos de muestra** con campos propios: `Cepa`, `Línea celular`, `Ácido nucleico`,
  `Suero o plasma` (sin datos de pacientes) y `Reactivo` (master mix, antibiótico, FBS,
  enzimas, cebadores…; renombrado de «Kit o master mix» a petición de la usuaria, 2026-11-22).
- **Formato** elegido en cada muestra (el tipo solo sugiere uno):
  - *Bolitas* (cepario en crioviales con bolitas): se cuentan las bolitas; cada uso resta una
    y el tubo vuelve a su casilla.
  - *Tubo o vial de un uso* (cepas en tubo normal, viales de células): el uso saca el tubo y
    libera la casilla.
  - *Volumen* (lo que se congela y descongela: master mix, cebadores, sueros, ADN): volumen
    inicial y restante; cada uso descuenta lo gastado y suma una **descongelación**.
- **Reactivos enlazados a Material fungible** (opcional): stock, pedidos y caducidad siguen allí;
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
3. ✅ **Usos, historial, árbol de pases y etiquetas NFC/QR** (tabla `usos_muestra`), ver abajo.

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

## Usos, historial y pases (parte 3)

- **Usar** (`usar_muestra`, cualquier sesión, alumnado incluido): bolitas → −1; tubo de un
  uso → se gasta entero; volumen → lo gastado y +1 descongelación. Si no queda nada, el tubo
  pasa a `Agotada` y libera la casilla. Motivo obligatorio. El `update` lleva
  `.eq('cantidad_actual', valor leído)` para que dos usos simultáneos no se pisen (409).
- `usos_muestra.autor` lo pone el servidor con `autorRegistro()`: nombre corto del docente o
  **nombre del grupo**; no se guarda email.
- **Deshacer** (`deshacer_uso`): solo el último uso del tubo, solo quien lo apuntó (mismo
  `autor`) y en los 15 minutos siguientes. En el cliente sale en el toast y en la ficha, solo
  para usos apuntados desde esa pestaña (`_congMisUsos`).
- Eventos del historial: `Uso`, `Nuevo stock`, `Descarte`, `Ajuste` (cuando un docente corrige
  a mano lo que queda desde «Editar»). Tras acciones que escriben usos en el servidor, el
  cliente los relee con `_congRecargarUsos()`.
- **Nuevo stock a partir de un tubo** (docente, solo cepas y líneas celulares): el modal de
  muestra se rellena con los datos del origen y el pase siguiente; `crear_muestras` con
  `id_muestra_origen` gasta del origen (1 bolita, el tubo, o el volumen indicado), pone
  `id_lote_origen` en los tubos nuevos y apunta el evento `Nuevo stock` en el origen. La ficha
  enseña «Procede de pase 2 ← pase 1» y «Stocks hechos a partir de este».

## Instrucciones de uso

`_CONG_INSTRUCCIONES` (`js/congelados.js`): pasos por **formato** (bolitas: una sola, sin
descongelar el tubo; tubo: un solo uso, no se recongela; volumen: descongelar y trabajar en
hielo, devolver cuanto antes) más los de cada **tipo** (líneas celulares: descongelación rápida
a 37 °C, quitar el DMSO, no recongelar; ARN; sueros potencialmente infecciosos; reactivos en
glicerol) y un aviso por **grupo de riesgo** 2/3 de la cepa. Se ven abiertos en el modal
«Usar», desplegables en la ficha y en resumen bajo el formato en el alta. Redactados a partir
de la práctica habitual (2026-11-22); la usuaria puede corregirlos.

## Etiquetas NFC / QR

- 🔗 **Etiqueta** en cada caja (`?action=congelados&caja=ID`) y en cada congelador
  (`?action=congelados&congelador=ID_ACTIVO`). URL con `urlEtiqueta()`, nunca
  `window.location`. Entrada en `_checkPendingNfcAction()` (`js/ui.js`) →
  `_abrirCongeladosPorNfc()`.
- El modal da la URL para el NFC, el QR (api.qrserver.com, como el resto de etiquetas) y
  **🖨️ Imprimir QR** (hoja con QR de 30 mm + nombre).
- Consejos que da la propia app: puerta metálica → NFC «anti-metal»; caja a −20 °C → NFC en
  la tapa suele aguantar; −80 °C o N₂ → QR en etiqueta criogénica.
- Solo el profesorado ve el botón 🔗; escanear y usar lo puede hacer cualquiera con sesión.
