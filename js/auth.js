// ============================================================
// AUTH — Supabase Auth (email + contraseña)
// ============================================================
// La sesión (JWT + refresco automático) la gestiona supabase-js internamente
// en localStorage — no hace falta guardar/leer nada a mano como con el
// antiguo flujo de Google GIS. onAuthStateChange nos avisa de cualquier
// cambio (login, logout, refresco de token en otra pestaña...).
// ============================================================

async function initAuth() {
  const { data: { session } } = await _sbMigracion.auth.getSession();
  if (session) {
    await _onSessionReady(session);
  } else {
    _mostrarPantallaLogin();
  }

  _sbMigracion.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT') {
      currentUser = null;
      _mostrarPantallaLogin();
    }
  });
}

async function _onSessionReady(session) {
  currentUser = { email: (session.user.email || '').toLowerCase().trim() };
  try {
    await loadAllData();
    const u = DATA.usuarios.find(u => (u.Email || '').toLowerCase().trim() === currentUser.email);
    if (u?.Nombre) currentUser.name = u.Nombre;
    showApp();
  } catch (e) {
    console.error('Error tras login:', e);
    showToast('Error cargando datos. Inténtalo de nuevo.', 'error');
  }
}

// ── signIn ───────────────────────────────────────────────────

async function signIn() {
  const email = v('login-email').toLowerCase();
  const password = document.getElementById('login-password')?.value || '';
  if (!email || !password) { showToast('Introduce tu email y contraseña', 'error'); return; }

  const btn = document.getElementById('btn-login');
  if (btn) btn.disabled = true;
  const { data, error } = await _sbMigracion.auth.signInWithPassword({ email, password });
  if (btn) btn.disabled = false;

  if (error) {
    showToast(error.message === 'Invalid login credentials' ? 'Email o contraseña incorrectos' : error.message, 'error');
    return;
  }
  await _onSessionReady(data.session);
}

// ── signOut ──────────────────────────────────────────────────

async function signOut() {
  await _sbMigracion.auth.signOut();
  currentUser = null;
  previewRole = null;
  previewUser = null;
  _mostrarPantallaLogin();
}

// ── Recuperar contraseña ─────────────────────────────────────

async function recuperarPassword() {
  const email = v('login-email').toLowerCase();
  if (!email) { showToast('Escribe tu email arriba antes de pulsar "Olvidé mi contraseña"', 'error'); return; }
  const { error } = await _sbMigracion.auth.resetPasswordForEmail(email);
  if (error) { showToast(error.message, 'error'); return; }
  showToast('Si el email existe, te hemos enviado un enlace para restablecer la contraseña', 'success');
}

// ── Helpers ──────────────────────────────────────────────────

function _mostrarPantallaLogin() {
  const app  = document.getElementById('app');
  const auth = document.getElementById('auth-screen');
  const noAuth = document.getElementById('no-auth-screen'); if (noAuth) noAuth.style.display = 'none';
  if (app)  app.style.display  = 'none';
  if (auth) auth.style.display = 'flex';
}
