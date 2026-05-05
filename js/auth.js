// ============================================================
// GOOGLE AUTH — flujo GIS (popup)
// El tokenClient.requestAccessToken() de GIS funciona en GitHub Pages
// a pesar del header COOP:same-origin porque Google gestiona la
// comunicación internamente, sin depender de window.opener.
//
// Sesión persistente (1 año):
//   - El access token de Google siempre caduca en ~1h (no modificable).
//   - Los datos del usuario (email, nombre, foto) se guardan 1 año en
//     localStorage.
//   - Al recargar: si conocemos al usuario pero el token caducó, se
//     lanza requestAccessToken({ prompt:'' }) — renovación silenciosa.h
//     Google completa sin mostrar ningún diálogo si la sesión de Google
//     sigue activa en el navegador (el caso habitual).
//   - Solo se muestra la pantalla de login si el usuario se desconectó
//     manualmente de Google (raro).
// ============================================================
const TOKEN_STORAGE_KEY = 'gestionlab_token';
const USER_STORAGE_KEY  = 'gestionlab_user';
const USER_EXPIRY_DAYS  = 365;

let tokenClient = null;

// ── Sesión persistente en localStorage ──────────────────────

function saveSession(token, user) {
  try {
    // Token: guardamos con la caducidad real (~55 min)
    const tokenExpires = Date.now() + 55 * 60 * 1000;
    localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify({ token, expires: tokenExpires }));
    // Usuario: guardamos 1 año (para poder hacer silent re-auth)
    const userExpires = Date.now() + USER_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify({ ...user, _expires: userExpires }));
  } catch(e) {}
}

function loadSession() {
  try {
    const raw = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (!raw) return null;
    const { token, expires } = JSON.parse(raw);
    if (Date.now() > expires) {
      // Solo borramos el token, conservamos el usuario para silent re-auth
      localStorage.removeItem(TOKEN_STORAGE_KEY);
      return null;
    }
    return token;
  } catch(e) { return null; }
}

function loadSavedUser() {
  try {
    const raw = localStorage.getItem(USER_STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (data._expires && Date.now() > data._expires) {
      localStorage.removeItem(USER_STORAGE_KEY);
      return null;
    }
    const { _expires, ...user } = data;
    return user;
  } catch(e) { return null; }
}

// Borra solo el token (silent re-auth seguirá funcionando)
function clearSession() {
  try { localStorage.removeItem(TOKEN_STORAGE_KEY); } catch(e) {}
}

// Borra todo — solo en signOut explícito
function clearFullSession() {
  try {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(USER_STORAGE_KEY);
  } catch(e) {}
}

// ── Carga dinámica del script GIS ────────────────────────────

function _loadGIS() {
  return new Promise((resolve) => {
    if (window.google?.accounts?.oauth2) { resolve(); return; }
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.onload = resolve;
    s.onerror = () => { console.error('No se pudo cargar GIS'); resolve(); };
    document.head.appendChild(s);
  });
}

// ── initAuth ─────────────────────────────────────────────────

async function initAuth() {
  await _loadGIS();

  if (!window.google?.accounts?.oauth2) {
    showToast('Error al cargar la autenticación de Google. Recarga la página.', 'error');
    _mostrarPantallaLogin();
    return;
  }

  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope:     SCOPES,
    callback:  _onTokenReceived
  });

  const savedToken = loadSession();
  const savedUser  = loadSavedUser();

  // Caso 1: token vigente + usuario conocido → entrar directamente
  if (savedToken && savedUser) {
    accessToken = savedToken;
    currentUser = savedUser;
    try {
      await loadAllData();
      showApp();
      return;
    } catch(e) {
      clearSession();
      accessToken = null;
      currentUser = null;
    }
  }

  // Caso 2: token caducado pero usuario conocido → silent re-auth (sin diálogo)
  if (savedUser) {
    currentUser = savedUser;
    tokenClient.requestAccessToken({ prompt: '' });
    return; // _onTokenReceived gestionará el resultado
  }

  // Caso 3: usuario desconocido → pantalla de login
  _mostrarPantallaLogin();
}

// ── Callback tras obtener token (login o silent re-auth) ─────

async function _onTokenReceived(response) {
  if (response.error) {
    console.error('Error OAuth:', response);
    // Silent re-auth fallida (sesión Google caducada) → limpiar y pedir login
    if (response.error !== 'access_denied') {
      showToast('Sesión expirada. Vuelve a iniciar sesión.', 'error');
    }
    clearFullSession();
    currentUser = null;
    accessToken = null;
    _mostrarPantallaLogin();
    return;
  }

  accessToken = response.access_token;
  try {
    // Si ya tenemos datos de usuario (silent re-auth), no hace falta volver a pedirlos
    if (!currentUser?.email) {
      await getUserInfo();
    }
    saveSession(accessToken, currentUser);
    await loadAllData();
    showApp();
  } catch(e) {
    console.error('Error tras login:', e);
    showToast('Error cargando datos. Inténtalo de nuevo.', 'error');
    clearFullSession();
    accessToken = null;
    currentUser = null;
    _mostrarPantallaLogin();
  }
}

// ── signIn ───────────────────────────────────────────────────

function signIn() {
  if (!tokenClient) {
    initAuth();
    return;
  }
  tokenClient.requestAccessToken({ prompt: 'select_account' });
}

// ── signOut ──────────────────────────────────────────────────

function signOut() {
  const tok = accessToken;
  clearFullSession(); // borra token Y usuario
  accessToken = null;
  currentUser = null;
  if (tok) { try { google.accounts.oauth2.revoke(tok, () => {}); } catch(e) {} }
  _mostrarPantallaLogin();
}

// ── getUserInfo ──────────────────────────────────────────────

async function getUserInfo() {
  const r = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!r.ok) throw new Error('No se pudo obtener información del usuario');
  currentUser = await r.json();
}

// ── Helpers ──────────────────────────────────────────────────

function _mostrarPantallaLogin() {
  const app  = document.getElementById('app');
  const auth = document.getElementById('auth-screen');
  const noAuth = document.getElementById('no-auth-screen'); if (noAuth) noAuth.style.display = 'none'; if (app)  app.style.display  = 'none';
  if (auth) auth.style.display = 'flex';
}

// scheduleTokenRenewal es llamado desde showApp() en ui.js.
// Con GIS no necesitamos timers: authFetch detecta el 401
// automáticamente cuando el token expira de verdad.
function scheduleTokenRenewal() { /* no-op con flujo GIS */ }

// Stub de compatibilidad
function renewTokenPromise() {
  return Promise.reject(new Error('Usar signIn() para renovar'));
}
