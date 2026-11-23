// Rehace las capturas de una tarea de la Ayuda: `node tools/capturas-ayuda/capturar.js MAN-2`
//
// - Sirve la app desde la raíz del repo (el código de la copia local, no el publicado).
// - Abre Chrome sin sesión y ejecuta tools/capturas-ayuda/<TAREA>.js, que mete datos de
//   ejemplo y guarda las imágenes en assets/ayuda/<TAREA>/.
// - Usa el playwright-core del paquete global @playwright/mcp (o la ruta de PLAYWRIGHT_CORE)
//   y el Chrome instalado en el equipo. Ver README.md.
const fs = require('fs');
const http = require('http');
const path = require('path');
const { execSync } = require('child_process');

const tarea = process.argv[2];
if (!tarea) { console.error('Uso: node tools/capturas-ayuda/capturar.js <TAREA>   (p. ej. MAN-2)'); process.exit(1); }
const RAIZ = path.resolve(__dirname, '..', '..');
// También acepta la ruta de otro guion (.js) y una carpeta de salida, para revisiones sueltas.
const ESCENA = tarea.endsWith('.js') ? path.resolve(tarea) : path.join(__dirname, tarea + '.js');
const SALIDA = process.argv[3] ? path.resolve(process.argv[3]) : path.join(RAIZ, 'assets', 'ayuda', tarea);
if (!fs.existsSync(ESCENA)) { console.error('No existe ' + ESCENA); process.exit(1); }
fs.mkdirSync(SALIDA, { recursive: true });

const pwCore = process.env.PLAYWRIGHT_CORE ||
  path.join(execSync('npm root -g').toString().trim(), '@playwright', 'mcp', 'node_modules', 'playwright-core');
const { chromium } = require(pwCore);

const TIPOS = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png',
  '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.xlsx': 'application/octet-stream' };

const servidor = http.createServer((req, res) => {
  let ruta = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (ruta.endsWith('/')) ruta += 'index.html';
  const archivo = path.join(RAIZ, ruta);
  if (!archivo.startsWith(RAIZ) || !fs.existsSync(archivo) || fs.statSync(archivo).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': TIPOS[path.extname(archivo)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  fs.createReadStream(archivo).pipe(res);
});

(async () => {
  await new Promise(r => servidor.listen(0, '127.0.0.1', r));
  const app = `http://127.0.0.1:${servidor.address().port}/`;
  const navegador = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    // Móvil (390 × 844) a densidad 2: las capturas tienen que leerse bien en un móvil.
    const contexto = await navegador.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'es-ES', timezoneId: 'Europe/Madrid', serviceWorkers: 'block' });
    const page = await contexto.newPage();
    page.on('pageerror', e => console.error('Error en la página:', e.message));
    const escena = eval(fs.readFileSync(ESCENA, 'utf8'));
    const r = await escena(page, { app, salida: SALIDA.replace(/\\/g, '/') + '/' });
    console.log(r || 'ok', '→', SALIDA);
  } finally {
    await navegador.close();
    servidor.close();
  }
})().catch(e => { console.error(e); process.exit(1); });
