// Configuración de la instalación del CIFP Manuel Antonio (Sanidade):
// https://labsuite.github.io/gestionlab-sanidad/  — la carga js/centro.js.
// ⚠ Solo valores PÚBLICOS: van en el navegador de todo el mundo. Nunca una clave
// secreta (sb_secret_…), una service_role ni una contraseña.
window.GESTIONLAB_CENTRO = {
  // Su proyecto de Supabase y su clave publishable (Project Settings → API Keys).
  supabaseUrl: 'https://vnoecaqldymonkgrmvlj.supabase.co',
  supabaseClavePublica: 'sb_publishable_RG8LDGtNkNdON9Nz4UOfnQ_TDgQ7U1u',

  // Dirección de la app publicada: la usan las etiquetas NFC/QR, que se graban una vez
  // y se quedan pegadas a una puerta durante años (ver «Etiquetas NFC/QR» en CLAUDE.md).
  appUrl: 'https://labsuite.github.io/gestionlab-sanidad/',

  // Trebello del departamento (opcional: sin él, null). Solo para el enlace «Ver en
  // Trebello» de un pedido ya enviado; el envío lo hace la Edge Function enviar-a-trebello.
  trebelloUrl: 'https://trebello.vercel.app',

  // PROVISIONAL, hasta la pestaña de ciclos y módulos (propuesta 3 del plan del PFFP):
  // lectura directa de ciclos y módulos del Supabase de Trebello. Sin Trebello, null.
  trebelloSupabase: {
    url: 'https://clxcjsvkmaydpxvtqesv.supabase.co',
    clavePublica: 'sb_publishable_kFwvda000Self-lRCYGuiA_C1aRHh2u',
  },
};
