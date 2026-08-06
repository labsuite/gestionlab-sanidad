// Verifica que quien llama a la función tiene una sesión válida de Supabase
// Auth y, si hace falta, que su rol (tabla users) es el adecuado.
//
// El navegador manda el access_token de la sesión de Supabase Auth en la
// cabecera Authorization — la misma cabecera que ya exige el gateway de
// Edge Functions para verificar la firma del JWT, así que no hace falta una
// cabecera aparte. Aquí solo identificamos al usuario (auth.getUser) y,
// si procede, comprobamos su rol en public.users con la service_role key.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ROLES_PERMITIDOS = ["Administrador", "Gestor"];
const ROLES_STAFF = ["Administrador", "Gestor", "Profesor"];

function adminClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

async function verificarSesion(req: Request, supabaseAdmin: ReturnType<typeof adminClient>): Promise<{ email: string } | { error: Response }> {
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    return { error: jsonError("Falta la sesión (header Authorization)", 401) };
  }
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user?.email) {
    return { error: jsonError("Sesión inválida o caducada", 401) };
  }
  return { email: data.user.email.toLowerCase().trim() };
}

// Cualquier persona con sesión válida de GestionLab (Admin/Gestor/Profesor/Alumno).
// No exige que ya exista fila en public.users — útil para acciones abiertas
// a cualquier rol (p.ej. registrar consumo de material).
export async function requireValidSession(req: Request) {
  const supabaseAdmin = adminClient();
  const resultado = await verificarSesion(req, supabaseAdmin);
  if ("error" in resultado) return resultado;
  return { email: resultado.email, supabaseAdmin };
}

async function requireRoles(req: Request, roles: string[], etiqueta: string) {
  const supabaseAdmin = adminClient();
  const resultado = await verificarSesion(req, supabaseAdmin);
  if ("error" in resultado) return resultado;
  const { email } = resultado;

  const { data: user, error } = await supabaseAdmin
    .from("users")
    .select("id, nombre, email, rol, activo")
    .eq("email", email)
    .maybeSingle();

  if (error || !user || !user.activo || !roles.includes(user.rol)) {
    return { error: jsonError(`No tienes permiso para esta acción (solo ${etiqueta})`, 403) };
  }

  return { user, supabaseAdmin };
}

export async function requireAdminOrGestor(req: Request) {
  return requireRoles(req, ROLES_PERMITIDOS, "Admin/Gestor");
}

// Eliminar ítems (material, equipos...) es solo para Administrador — ver
// `eliminarItems` en PERMISOS (js/ui.js), que Gestor no tiene.
export async function requireAdmin(req: Request) {
  return requireRoles(req, ["Administrador"], "Administrador");
}

// Intervenciones/Incidencias: el Profesor también puede gestionar las de sus
// propios equipos (ver crearIntervenciones/crearIncidencias en js/ui.js).
export async function requireStaff(req: Request) {
  return requireRoles(req, ROLES_STAFF, "Admin/Gestor/Profesor");
}

// Las Edge Functions de Supabase no añaden cabeceras CORS por defecto: sin
// esto, el navegador bloquea la respuesta al preflight (OPTIONS) con
// "Failed to fetch" aunque la función funcione perfectamente por curl/Python
// (esas herramientas no aplican CORS). Se detectó este bug con Playwright
// (fetch real desde el navegador) — las pruebas anteriores por HTTP directo
// no lo habían detectado porque no simulaban un navegador real.
export const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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
