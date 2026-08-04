// Verifica que quien llama a la función es un Admin/Gestor de GestionLab.
//
// Mientras el login de GestionLab siga siendo Google OAuth directo (hasta la
// tarea #8 de migración), esto reutiliza ese mismo token: el navegador envía
// el access_token de Google que ya tiene, aquí lo verificamos contra Google y
// comprobamos el rol en la tabla users. No depende de Supabase Auth en el
// navegador — solo se usa server-side, con la service_role key.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ROLES_PERMITIDOS = ["Administrador", "Gestor"];

// El client_id público de GestionLab (js/config.js) — comprobamos que el
// token venga de nuestro propio login, no de cualquier token de Google.
const GESTIONLAB_CLIENT_ID = "617390713769-milqb8jfdk9l6bd63bh52bbronivablb.apps.googleusercontent.com";

function adminClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

async function verificarTokenGoogle(req: Request): Promise<{ email: string } | { error: Response }> {
  const googleToken = req.headers.get("x-google-token");
  if (!googleToken) {
    return { error: jsonError("Falta el token de Google (header x-google-token)", 401) };
  }

  const infoRes = await fetch(
    `https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=${encodeURIComponent(googleToken)}`,
  );
  if (!infoRes.ok) {
    return { error: jsonError("Token de Google inválido o caducado", 401) };
  }
  const info = await infoRes.json();
  if (info.aud !== GESTIONLAB_CLIENT_ID && info.azp !== GESTIONLAB_CLIENT_ID) {
    return { error: jsonError("Token de Google de otra aplicación, no válido aquí", 401) };
  }
  const email = (info.email || "").toLowerCase().trim();
  if (!email) {
    return { error: jsonError("No se pudo verificar el email de Google", 401) };
  }
  return { email };
}

// Cualquier persona con sesión válida de GestionLab (Admin/Gestor/Profesor/Alumno).
// No exige que ya exista fila en public.users — útil mientras la importación
// de alumnado (tarea #4) todavía no se ha ejecutado para todo el mundo.
export async function requireValidSession(req: Request) {
  const resultado = await verificarTokenGoogle(req);
  if ("error" in resultado) return resultado;
  return { email: resultado.email, supabaseAdmin: adminClient() };
}

export async function requireAdminOrGestor(req: Request) {
  const resultado = await verificarTokenGoogle(req);
  if ("error" in resultado) return resultado;
  const { email } = resultado;

  const supabaseAdmin = adminClient();

  const { data: user, error } = await supabaseAdmin
    .from("users")
    .select("id, nombre, email, rol, activo")
    .eq("email", email)
    .maybeSingle();

  if (error || !user || !user.activo || !ROLES_PERMITIDOS.includes(user.rol)) {
    return { error: jsonError("No tienes permiso para esta acción (solo Admin/Gestor)", 403) };
  }

  return { user, supabaseAdmin };
}

// Las Edge Functions de Supabase no añaden cabeceras CORS por defecto: sin
// esto, el navegador bloquea la respuesta al preflight (OPTIONS) con
// "Failed to fetch" aunque la función funcione perfectamente por curl/Python
// (esas herramientas no aplican CORS). Se detectó este bug con Playwright
// (fetch real desde el navegador) — las pruebas anteriores por HTTP directo
// no lo habían detectado porque no simulaban un navegador real.
export const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-google-token",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

// Llamar al principio de cada Deno.serve, antes de cualquier otra lógica:
// devuelve la respuesta al preflight si aplica, o null si hay que continuar.
export function handleCorsPreflight(req: Request): Response | null {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  return null;
}

export function jsonError(mensaje: string, status: number) {
  return new Response(JSON.stringify({ error: mensaje }), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

export function jsonOk(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

export function generarPasswordTemporal(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes)).replace(/[^a-zA-Z0-9]/g, "").slice(0, 16);
}
