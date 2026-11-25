# Verificación anual de las micropipetas (desde 2026-11-24)

GestionLab calcula y decide la verificación de cada micropipeta (OK / COMPLETAR / AJUSTAR /
RETIRAR) en su revisión anual. Encargo del laboratorio:
`ENCARGO_calculos_verificacion_micropipetas.md` (carpeta `B. Laboratorio/Protocolos/GestionLab`),
con el procedimiento del anexo A de los protocolos de micropipetas y los casos de prueba de la
hoja `Verificacion_fotometrica_micropipetas.xlsx`, a la que sustituye.

## Una sola fuente del cálculo

`supabase/functions/_shared/verif_pipetas.js` (módulo ES) hace **todo** el cálculo y la decisión:
preparación del curso, sesión (pérdida de los tubos, blanco, recta con el blanco y P1–P5, diluciones
de comprobación, CV de lectura, validación del método, validez), cada volumen (V de cada réplica, V
medio, error sistemático, CV observado, del método y corregido, decisión con 2/3 del límite y 4 o 10
réplicas) y el resultado de la pipeta (multicanal, ajuste, tras el ajuste). También reconoce los
pasos del plan que marca la app (`pasoVerificacion`) y los marca (`marcarPasosVerificacion`).

- **La pantalla** lo carga como módulo desde esa misma ruta (`index.html`: `window.VP`). Por eso el
  repo tiene **`.nojekyll`**: sin él, GitHub Pages (Jekyll) no publica las carpetas que empiezan por
  `_` y `_shared/` daba 404.
- **El servidor** lo importa en `gestionar-mantenimiento` y `gestionar-verif-pipetas`.
- **La página HTML de recogida** lleva solo el bloque `/* >>> COMPROBAR DATOS … <<< */`
  (comprobación de cada dato, apartado 7 del encargo): recoge y comprueba, **no calcula**.
- Los criterios están en `CRITERIOS` (p. ej. la tolerancia provisional del 0,5 % de las diluciones
  de comprobación). Si el laboratorio cambia uno, cambiarlo ahí y en la hoja de cálculo.
- **Pruebas:** `node tools/verif-pipetas/casos.test.mjs` reproduce los casos del apartado 11
  (98 comprobaciones). Pasarlas tras cualquier cambio del módulo.

## Datos

| Dónde | Qué |
|---|---|
| `verif_pipetas_parametros` | Una fila por pipeta: el CSV `verificacion_micropipetas.csv` (volúmenes, método, disolución, masa de agua, límites, `ajuste_usuario`, avisos). Se carga con `scripts/cargar_verificacion_micropipetas.py`. Además, lo que decide el laboratorio desde la app y la recarga **no pisa**: `ajuste_respuesta` (tornillo de ajuste, lo contesta el profesorado) y `v_bajo_elegido` (PIP-005: 100 o 200 µl) |
| `verif_preparaciones` | Preparación del curso (una por curso): masas de S-A, S-B, S-C (y 2.º lote), D1, D2, P1–P5; tubos congelados por bloque (`id`, `disolucion`, `bloque`, `m_vacio`, `m_lleno`) |
| `verif_sesiones` | Una por día: `datos` (temperatura, balanzas, masas de los tubos, blanco, absorbancias de P1–P5, diluciones de comprobación, 10 lecturas del CV, blanco final y, la primera del curso, la validación del método) y `resultados` (los calcula el servidor al guardar; **todas las sesiones del curso se recalculan** en orden al guardar la preparación o cualquier sesión, porque cada una depende de las anteriores: masa de los tubos al cerrarlos, método validado, repetibilidad de las balanzas) |
| `registro_mantenimientos.verificacion` | La verificación de cada pipeta en su revisión anual (o bianual): `fases` (inicial y, si hubo ajuste, `tras_ajuste` con quién ajustó) → volúmenes → canales → réplicas `{m, A}`, la sesión de cada volumen y el lote de S-C; más `calculo` (resultado, límites usados, valores por volumen y canal), `parametros` (la fila del CSV **con la que se juzgó**) e `incidencia` si se retiró |

Esquema: `supabase/verif_pipetas.sql` (también al final de `schema.sql`). Lectura con sesión; las
escrituras, solo por las Edge Functions.

## Flujo

1. **Preparación del curso** (Verificación de pipetas → «Registrar la preparación»; profesorado):
   masas y tubos congelados por bloque. Se calculan F_B, F_C, F_C2, f_D1, f_D2 y la f de cada punto.
2. **Sesión** de cada día (profesorado): temperatura (Z), balanzas (solo las que tengan
   repetibilidad este curso: BTC-223 por especificación; BAL-001/BAL-005, medidas en la
   validación), pérdida de cada tubo, blanco, recta, comprobaciones, CV de lectura, blanco final y,
   en la primera del curso, la validación del método. La pantalla enseña en vivo si la parte
   fotométrica y la gravimétrica son válidas y qué disoluciones se pueden pipetear ese día.
3. **Revisión anual de la pipeta** (Mantenimiento → «Ejecutar mantenimiento»): el bloque
   «🧪 Verificación de la pipeta» abre el formulario. Por volumen: la sesión en que se mide, el lote
   de S-C si hay dos, y las réplicas (por canal en las multicanal). La app calcula y decide al
   escribir. Los pasos de verificación del plan (sesión, cada volumen, «Completar», «Resultado»;
   en el antiguo bianual, «Verificación con 10 réplicas») salen con 🧪 y **los marca la app**.
   Desde el 2026-11-25 ya no hay bianual interno: lo sustituye una calibración **externa cada 5
   años** («Quinquenal», sin formulario de verificación); el código del bianual (`sin_cribado`)
   se conserva por los registros antiguos.
4. **Finalizar** solo con resultado OK o RETIRAR (lo exige también el servidor). AJUSTAR: el
   docente ajusta y pulsa «He ajustado la pipeta», y se repiten los volúmenes con 10 réplicas en la
   misma revisión; si sigue sin cumplir, RETIRAR. «Por comprobar» el tornillo: lo contesta el
   profesorado (en la verificación o en la página de pipetas). Gilson (servicio técnico): RETIRAR.
5. **RETIRAR** al finalizar: el servidor abre la incidencia de la pipeta con el volumen o canal que
   falló y sus valores (o lo añade al aviso abierto, sin abrir otro) y la deja «Fuera de servicio».
6. Lo que finaliza el alumnado espera el visto bueno, como cualquier revisión; quien firma ve el
   resultado y los valores en la pestaña de visto bueno.

**Dónde se ve:** ficha del equipo (última verificación con error sistemático y CV de cada volumen,
y la respuesta sobre el tornillo), página «Verificación de pipetas» (preparación, sesiones con las
pipetas medidas en cada una, lista de pipetas con su última verificación) y Excel de calidad
(columna de fechas de realización: «(verificación: OK / AJUSTADA / RETIRADA)»).

La página es una **subsección de Mantenimiento** (desde 2026-11-25): **no tiene entrada en el menú
lateral** (decisión de la usuaria); se entra por la última pestaña de Mantenimiento («🧪 Verificación
de pipetas»), en el menú queda marcado «Mantenimiento» mientras se está en ella, y la página tiene
«← Volver a Mantenimiento».
Sigue siendo una página propia (`page-verif-pipetas`), no un panel dentro de `renderMantenimiento()`.

**Sin rango** (17 pipetas): la verificación dice que no se puede hacer y remite a la tarea
`c-pip-rangos` de la página de pendientes. Al cargar el CSV nuevo, salen sus volúmenes.

## Página HTML de recogida (sin conexión)

«⬇️ Página para recoger datos sin conexión» genera un HTML con las pipetas, volúmenes y límites del
curso elegido, las sesiones ya registradas y los tubos de la preparación (plantilla
`assets/verif-pipetas-recogida.html` + el bloque de comprobación del módulo). Recoge la sesión del
día y las pipetas, comprueba cada dato igual que la app, guarda en el navegador y descarga un
archivo JSON (`tipo: gestionlab-verif-pipetas`, `formato` = `FORMATO_ARCHIVO`). Se importa con
«📥 Importar de la página de recogida» en la sesión (rellena el formulario) y en la verificación de
la pipeta (rellena sus réplicas; «la sesión de este archivo» se casa con la sesión de GestionLab de
la misma fecha, así que **primero se importa la sesión**). Nada se guarda sin revisarlo; si el
archivo es de otro formato, se rechaza.

## Quién puede

- Preparación, sesiones y respuesta sobre el tornillo: Profesor, Gestor y Administrador
  (`gestionar-verif-pipetas` con `requireStaff`).
- Verificación de cada pipeta: quien pueda ejecutar su revisión (alumnado incluido, en sus
  laboratorios y la zona común); el ajuste («He ajustado»), solo profesorado (el servidor rechaza
  la fase `tras_ajuste` si no la crea un docente).

## Pendiente / limitaciones conocidas

- La verificación «que cierra una incidencia de la pipeta» (10 réplicas sin cribado tras una
  reparación) no tiene formulario propio: las incidencias e intervenciones no llevan verificación.
- Editar una revisión ya finalizada (Mantenimiento → Realizados) no recalcula la verificación.
- PIP-005 con 200 µl elegido usa los límites del volumen bajo del CSV (los de 100 µl) hasta que se
  corrija el CSV.
- `scripts/generar_modelo_calidad.py` (alternativa offline del Excel) no añade el resultado de la
  verificación.
