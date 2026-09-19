# Protección de datos en GestionLab

Registro interno de qué datos personales trata la app, con qué finalidad y durante
cuánto tiempo. No es un dictamen jurídico: es la documentación técnica que respalda
las decisiones tomadas, para poder justificarlas ante quien las pregunte.

**Principio de partida (minimización):** la app solo guarda quién hizo algo cuando
la seguridad del laboratorio lo exige. En todo lo demás el alumnado firma con la
etiqueta genérica `Alumnado`.

---

## 1. Dónde SÍ se identifica a la persona, y por qué

| Tabla | Dato | Justificación |
|---|---|---|
| `registros_cabina` | `usuario` (email) | Registro de calidad del uso de cabina de bioseguridad: nivel de riesgo de la práctica, verificación previa y descontaminación posterior. Ante una contaminación o exposición hay que poder reconstruir quién estuvo y en qué condiciones. |
| `registros_autoclave` | `usuario` (email) | Validación de ciclos de esterilización: si un control falla hay que localizar la carga y a quien la procesó. |
| `registros_vitrina` | `usuario` (email) | Manipulación de productos químicos en vitrina de extracción: verificación previa, productos usados y limpieza posterior. |
| `reservas_equipos` | `usuario` (email) | Gestión operativa de la franja reservada: hay que saber a quién corresponde y con quién hablar si hay solape. |
| `usuarios` (catálogo) | nombre, email, ciclo, módulos, laboratorios | Base del servicio: sin esto no hay login, ni permisos, ni asignación de laboratorios. |
| Supabase Auth | email, contraseña (hash) | Autenticación. |

En los cuatro registros de uso el valor lo escribe **el servidor** a partir del email
de la sesión (`requireValidSession`), nunca el navegador: no es falsificable y no
depende de que el cliente se porte bien.

---

## 2. Dónde NO se identifica: firma genérica `Alumnado`

Estos registros existen y son auditables, pero no señalan a nadie. Lo que los hace
válidos es el equipo, la fecha y —cuando procede— el docente que los supervisa.

| Tabla · columna | Antes | Ahora |
|---|---|---|
| `incidencias.reportado_por` | Nombre del alumno que dio el aviso | `Alumnado` |
| `adiciones_residuo.usuario` | Nombre de quien depositó el residuo | `Alumnado` |
| `contenedores_residuo.actualizado_por` | Nombre | `Alumnado` (si el cambio de nivel viene de una adición) |
| `consultas_residuo.usuario` | Nombre de quien consulta | `Alumnado` — para atender la consulta basta `ubicacion_dejado` |
| `excepciones_residuo_ia.usuario` | Nombre de quien pulsó "registrar igualmente" | `Alumnado` — la auditoría sigue sirviendo sin señalar a nadie |
| `registro_mantenimientos.realizado_por` / `iniciado_por` | Nombre del alumno | `Alumnado` — la validez la da `supervisado_por` (el docente que firma el visto bueno) |
| `movimientos.usuario` | Nombre de quien consumió stock | `Alumnado` |
| `revisiones_inventario.usuario` | Nombre de quien recontó | `Alumnado` |
| `propuestas_*.propuesto_por` | Nombre | `Alumnado` (ver punto 3) |

### Cómo está garantizado

La decisión se toma en el servidor, en `autorRegistro()` (`supabase/functions/_shared/auth.ts`):
mira el rol del email de la sesión y, si no es profesorado, devuelve `"Alumnado"`
**ignorando cualquier nombre que venga en el cuerpo de la petición**. El nombre de un
alumno no puede acabar en la base de datos ni por un fallo del cliente ni por una
llamada manual a la Edge Function.

Funciones que lo aplican: `gestionar-incidencia`, `gestionar-residuo`,
`gestionar-mantenimiento`, `gestionar-material`, `gestionar-propuesta-ubicacion`,
`gestionar-propuesta-material`.

---

## 3. La excepción: propuestas del inventario colaborativo

`propuestas_ubicacion_equipo` y `propuestas_material` guardan
`email_propuesto_por` mientras la propuesta vive, porque el email cumple tres
funciones que no se pueden hacer sin él:

1. **Repropuesta** — sustituir la propuesta pendiente anterior de esa misma persona
   para ese mismo equipo, en vez de acumular dos versiones de lo mismo.
2. **Doble verificación** — comprobar que las dos propuestas coincidentes vienen de
   personas *distintas* antes de aplicar el cambio automáticamente.
3. **"Mis propuestas"** — devolverle a cada quien el resultado de lo que propuso.

El nombre (`propuesto_por`) sí se ha quitado: en la cola de validación consta
`Alumnado`. Y cuando la propuesta se resuelve y el alumnado ha visto el resultado,
las tres funciones se agotan y el email deja de tener finalidad:

```
python scripts/anonimizar_propuestas.py            # informa, no toca nada
python scripts/anonimizar_propuestas.py --aplicar  # borra los emails
```

Borra `email_propuesto_por` de las propuestas resueltas hace más de 60 días. **Hay
que ejecutarlo al cerrar cada curso académico.**

---

## 4. Conservación

| Dato | Plazo |
|---|---|
| Registros de uso (cabina / autoclave / vitrina) | Los del curso en vigor, más los cursos que exija el sistema de calidad del centro. **Plazo a fijar con la dirección**; hoy no se borra nada automáticamente. |
| Reservas | Sin valor una vez pasada la franja; se pueden purgar al cierre de curso. |
| Email en propuestas resueltas | 60 días desde la resolución (`scripts/anonimizar_propuestas.py`). |
| Catálogo `usuarios` y cuentas de Auth | Mientras la persona esté activa en el centro. Al causar baja, dar de baja también la cuenta. |
| Todo lo demás | No contiene datos personales de alumnado. |

---

## 5. Terceros

- **Gemini** (consultorio de residuos y validación de compatibilidad): recibe la
  descripción del residuo, el laboratorio y los contenedores activos. **No recibe
  nombre, email ni ningún identificador de persona.** La llamada la hace la Edge
  Function, nunca el navegador, y la clave vive solo como secreto de servidor.
- **Supabase** (Irlanda, UE): encargado del tratamiento — base de datos, autenticación
  y almacenamiento.
- **GitHub Pages**: sirve el HTML/JS estático. No recibe datos de la aplicación.

---

## 6. Al añadir un campo nuevo

Antes de guardar cualquier "quién hizo esto", responder: **¿la seguridad del
laboratorio exige saber quién fue?**

- **Sí** → escribirlo en el servidor desde el email de la sesión (patrón de
  `gestionar-registro-uso`), añadirlo a la tabla del punto 1 con su justificación,
  y fijarle un plazo de conservación en el punto 4.
- **No** → usar `autorRegistro()` y no tocar nada más.

Ante la duda, la respuesta es **no**: un registro sin nombre sigue sirviendo para
gestionar el laboratorio; uno con nombre hay que justificarlo, protegerlo y borrarlo.
