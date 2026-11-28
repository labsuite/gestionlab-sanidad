// ============================================================
// CONFIGURACIÓN DEL CENTRO — carga config/<dominio>_<ruta>.js
// ============================================================
// Cada instalación de GestionLab (un centro, un taller) tiene su propio archivo en
// config/, con su Supabase, su clave pública y la dirección de su app. Las
// actualizaciones del código común no lo tocan nunca, así que sincronizar no da
// conflictos (decisión 2026-11-28, propuesta 2 del plan del PFFP).
//
// El nombre sale de la dirección COMPLETA de la web, dominio y primer tramo de la
// ruta: varios talleres pueden publicar en la misma cuenta de GitHub
// (cuenta.github.io/gestionlab-a, …/gestionlab-b), y con solo el dominio uno podría
// acabar conectado a la base de otro. Ejemplos:
//   https://labsuite.github.io/gestionlab-sanidad/  → config/labsuite.github.io_gestionlab-sanidad.js
//   https://gestionlab.micentro.es/                → config/gestionlab.micentro.es.js
//   http://127.0.0.1:8080/                          → config/127.0.0.1.js
//
// Si no hay archivo para esa dirección exacta, js/config.js no arranca la app y lo
// dice: NUNCA se usa la configuración de otro centro como reserva.
//
// Se carga con document.write a propósito: tiene que estar leído ANTES que
// js/config.js, que se ejecuta justo después y crea la conexión con Supabase.
(function () {
  var tramo = location.pathname.split('/').filter(Boolean)[0] || '';
  if (/\.html?$/i.test(tramo)) tramo = '';   // index.html en la raíz del dominio
  window.__nombreConfigCentro = location.hostname + (tramo ? '_' + tramo : '');
  document.write('<script src="config/' + window.__nombreConfigCentro + '.js"><\/script>');
})();

// Icono de la instalación, elegido con UNA PALABRA en su archivo de configuración
// (`icono: 'diente'`): nada de pegar emojis. Una palabra que no esté da 🧪. La lista
// crece a demanda. La usan js/config.js y subir-factura.html.
var ICONOS_APP = {
  laboratorio: '🧪', microscopio: '🔬', quimica: '⚗️', diente: '🦷', oido: '👂',
  salud: '🩺', farmacia: '💊', textil: '🧵', cocina: '🍳', planta: '🌱',
  herramienta: '🔧', electricidad: '⚡', madera: '🪵', coche: '🚗', belleza: '💇',
  informatica: '💻',
};
function iconoDeInstalacion(palabra) {
  var p = String(palabra || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  return ICONOS_APP[p] || '🧪';
}
