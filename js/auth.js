// ============================================================
// AUTH — Supabase Auth (email + contraseña)
// ============================================================
// La sesión (JWT + refresco automático) la gestiona supabase-js internamente
// en localStorage — no hace falta guardar/leer nada a mano como con el
// antiguo flujo de Google GIS. onAuthStateChange nos avisa de cualquier
// cambio (login, logout, refresco de token en otra pestaña...).
// ============================================================

async function initAuth() {
  _sbMigracion.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT') {
      currentUser = null;
      _mostrarPantallaLogin();
    } else if (event === 'PASSWORD_RECOVERY') {
      _mostrarPantallaNuevaPassword();
    }
  });

  // ¿Volvemos del enlace de recuperación de contraseña del email?
  const hash = window.__authRecoveryHash || window.location.hash || '';
  const params = new URLSearchParams(hash.replace(/^#/, ''));

  if (params.get('error') || params.get('error_code')) {
    const code = params.get('error_code') || '';
    _limpiarHashAuth();
    _mostrarPantallaLogin();
    const msg = (code === 'otp_expired' || code === 'access_denied')
      ? 'El enlace de recuperación ya se usó o ha caducado. Pide uno nuevo con "Olvidé mi contraseña".'
      : ((params.get('error_description') || '').replace(/\+/g, ' ') || 'No se pudo validar el enlace de recuperación');
    showToast(msg, 'error');
    return;
  }

  if (params.get('type') === 'recovery' && params.get('access_token')) {
    const { error } = await _sbMigracion.auth.setSession({
      access_token: params.get('access_token'),
      refresh_token: params.get('refresh_token') || ''
    });
    _limpiarHashAuth();
    if (error) {
      _mostrarPantallaLogin();
      showToast('El enlace de recuperación ya no es válido. Pide uno nuevo con "Olvidé mi contraseña".', 'error');
      return;
    }
    _mostrarPantallaNuevaPassword();
    return;
  }

  const { data: { session } } = await _sbMigracion.auth.getSession();
  if (session) {
    await _onSessionReady(session);
  } else {
    _mostrarPantallaLogin();
  }
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
  // redirectTo explícito: así el enlace del email vuelve SIEMPRE a esta app, sin
  // depender del "Site URL" del proyecto de Supabase.
  const redirectTo = window.location.origin + window.location.pathname;
  const { error } = await _sbMigracion.auth.resetPasswordForEmail(email, { redirectTo });
  if (error) { showToast(error.message, 'error'); return; }
  showToast('Si el email existe, te hemos enviado un enlace (remitente Supabase) para restablecer la contraseña', 'success');
}

// ── Nueva contraseña tras el enlace de recuperación ──────────

async function guardarNuevaPassword() {
  const p1 = document.getElementById('rec-pass')?.value || '';
  const p2 = document.getElementById('rec-pass2')?.value || '';
  if (!p1 || !p2) { showToast('Rellena los dos campos', 'error'); return; }
  if (p1.length < 8) { showToast('La contraseña debe tener al menos 8 caracteres', 'error'); return; }
  if (p1 !== p2) { showToast('Las dos contraseñas no coinciden', 'error'); return; }

  const btn = document.getElementById('btn-rec-pass');
  if (btn) btn.disabled = true;
  const { error } = await _sbMigracion.auth.updateUser({ password: p1 });
  if (error) {
    if (btn) btn.disabled = false;
    showToast(/same/i.test(error.message)
      ? 'La nueva contraseña debe ser distinta de la anterior'
      : ('No se pudo cambiar la contraseña: ' + error.message), 'error');
    return;
  }
  _limpiarHashAuth();
  const rec = document.getElementById('recovery-screen');
  if (rec) rec.style.display = 'none';
  showToast('Contraseña actualizada. Ya puedes usar la app.', 'success');
  const { data: { session } } = await _sbMigracion.auth.getSession();
  if (session) await _onSessionReady(session);
  else _mostrarPantallaLogin();
}

// ── Cambiar mi contraseña desde el perfil (con sesión iniciada) ──

async function cambiarMiPassword() {
  const actual = document.getElementById('perfil-pass-actual')?.value || '';
  const nueva  = document.getElementById('perfil-pass-nueva')?.value || '';
  const nueva2 = document.getElementById('perfil-pass-nueva2')?.value || '';
  if (!actual || !nueva || !nueva2) { showToast('Rellena los tres campos', 'error'); return; }
  if (nueva.length < 8) { showToast('La nueva contraseña debe tener al menos 8 caracteres', 'error'); return; }
  if (nueva !== nueva2) { showToast('La nueva contraseña y su confirmación no coinciden', 'error'); return; }
  if (nueva === actual) { showToast('La nueva contraseña debe ser distinta de la actual', 'error'); return; }

  const btn = document.getElementById('btn-cambiar-pass');
  if (btn) btn.disabled = true;

  // 1. Verificar la contraseña actual reautenticando
  const { error: errLogin } = await _sbMigracion.auth.signInWithPassword({ email: currentUser.email, password: actual });
  if (errLogin) {
    if (btn) btn.disabled = false;
    showToast('La contraseña actual no es correcta', 'error');
    return;
  }
  // 2. Cambiarla
  const { error } = await _sbMigracion.auth.updateUser({ password: nueva });
  if (btn) btn.disabled = false;
  if (error) { showToast(error.message, 'error'); return; }

  ['perfil-pass-actual', 'perfil-pass-nueva', 'perfil-pass-nueva2'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  showToast('Contraseña actualizada', 'success');
}

// ── Página "Mi perfil" ──────────────────────────────────────

function renderPerfil() {
  const cont = document.getElementById('perfil-contenido');
  if (!cont) return;
  const nombre = currentUser?.name || '—';
  const email  = currentUser?.email || '—';
  const rol    = (typeof getRealUserRole === 'function') ? getRealUserRole() : '—';
  const enPreview = typeof previewRole !== 'undefined' && !!previewRole;
  const inputCss = 'width:100%;padding:9px 12px;border:1px solid var(--border);border-radius:var(--radius-sm);font-size:14px';
  const labelCss = 'font-size:12px;font-weight:600;color:var(--text-muted);display:block;margin-bottom:4px';

  cont.innerHTML = `
    <div class="card">
      <div class="card-header"><div class="card-title">Mis datos</div></div>
      <div style="padding:8px 4px;display:grid;grid-template-columns:auto 1fr;gap:8px 16px;font-size:14px;max-width:480px">
        <div style="color:var(--text-muted)">Nombre</div><div>${nombre}</div>
        <div style="color:var(--text-muted)">Email</div><div>${email}</div>
        <div style="color:var(--text-muted)">Rol</div><div>${rol}</div>
      </div>
    </div>
    <div class="card" style="margin-top:16px">
      <div class="card-header"><div class="card-title">Cambiar contraseña</div></div>
      ${enPreview
        ? `<p style="padding:8px 4px;color:var(--text-muted);font-size:13px">Sal de la vista previa de rol para cambiar tu contraseña.</p>`
        : `<form onsubmit="event.preventDefault(); cambiarMiPassword();" style="padding:8px 4px;display:flex;flex-direction:column;gap:12px;max-width:360px">
        <div>
          <label for="perfil-pass-actual" style="${labelCss}">Contraseña actual</label>
          <input type="password" id="perfil-pass-actual" autocomplete="current-password" style="${inputCss}">
        </div>
        <div>
          <label for="perfil-pass-nueva" style="${labelCss}">Nueva contraseña</label>
          <input type="password" id="perfil-pass-nueva" autocomplete="new-password" style="${inputCss}">
        </div>
        <div>
          <label for="perfil-pass-nueva2" style="${labelCss}">Repite la nueva contraseña</label>
          <input type="password" id="perfil-pass-nueva2" autocomplete="new-password" style="${inputCss}">
        </div>
        <button type="submit" class="btn btn-primary" id="btn-cambiar-pass" style="align-self:flex-start">Guardar contraseña</button>
      </form>`}
    </div>`;
}

// ── Helpers ──────────────────────────────────────────────────

function _mostrarPantallaLogin() {
  const app  = document.getElementById('app');
  const auth = document.getElementById('auth-screen');
  const noAuth = document.getElementById('no-auth-screen'); if (noAuth) noAuth.style.display = 'none';
  const rec = document.getElementById('recovery-screen'); if (rec) rec.style.display = 'none';
  if (app)  app.style.display  = 'none';
  if (auth) auth.style.display = 'flex';
}

function _mostrarPantallaNuevaPassword() {
  const app  = document.getElementById('app');            if (app)  app.style.display = 'none';
  const auth = document.getElementById('auth-screen');    if (auth) auth.style.display = 'none';
  const noAuth = document.getElementById('no-auth-screen'); if (noAuth) noAuth.style.display = 'none';
  const rec = document.getElementById('recovery-screen'); if (rec) rec.style.display = 'flex';
}

function _limpiarHashAuth() {
  try { history.replaceState(null, '', window.location.pathname + window.location.search); } catch (e) {}
  window.__authRecoveryHash = '';
}
