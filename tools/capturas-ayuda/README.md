# Capturas de la Ayuda

Las capturas de cada tarea de la sección «Ayuda» (`js/ayuda.js`) se generan con un guion,
para poder **rehacerlas cada vez que cambie una pantalla**: una captura desfasada confunde
más que ninguna.

```bash
node tools/capturas-ayuda/capturar.js MAN-2
```

- `capturar.js` sirve la app desde la raíz del repo (la copia local, no la publicada), abre
  Chrome **sin sesión** a tamaño de móvil (390 × 844, densidad 2) y ejecuta `<TAREA>.js`.
- `<TAREA>.js` mete **datos de ejemplo** (una cuenta de grupo ficticia, equipos y planes sin
  nombres de personas), monta cada pantalla del recorrido, señala en naranja dónde se pulsa
  y guarda las imágenes en `assets/ayuda/<TAREA>/`. No llama al servidor: no se guarda nada.
- Necesita el paquete global `@playwright/mcp` (trae `playwright-core`; otra ruta con la
  variable `PLAYWRIGHT_CORE`) y Google Chrome instalado.
- Revisiones sueltas: `node tools/capturas-ayuda/capturar.js <ruta/guion.js> <carpeta>`.

Reglas (del plan del manual, «B. Laboratorio/Manual GestionLab/CLAUDE.md»):
- Datos de ejemplo: sin nombres reales de profesorado ni de alumnado, y sin el enlace con
  token de la página de pendientes.
- Una captura cuando cambia la pantalla, no una por clic, señalando dónde se pulsa.
- Tienen que leerse bien en un móvil.

Al cambiar una pantalla: buscar en `js/ayuda.js` las tareas cuyo `pantallas` la incluyen,
volver a ejecutar su guion y revisar que los pasos siguen diciendo lo que se ve.

Datos de ejemplo compartidos: `_demo-alumno.js` (manual del alumnado) y `_demo-pipetas.js`
(verificación de micropipetas, MAN-10/11/12: tres pipetas reales del 203 y la preparación y la sesión
del apartado 11.1 del encargo, calculadas por la propia app).
