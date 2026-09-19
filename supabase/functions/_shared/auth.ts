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

export const ES_STAFF = (rol: string) => ROLES_STAFF.includes(rol);

/**
 * Nombre y rol de quien llama, para acciones abiertas a cualquier rol
 * (requireValidSession) que luego necesitan saber si es alumnado o profesorado.
 * Busca primero en `users` (cuentas con login real) y cae al catálogo `usuarios`.
 * Quien no aparezca en ninguna se trata como Alumno: el permiso más bajo.
 */
export async function identificarUsuario(supabaseAdmin: any, email: string) {
  const { data: u } = await supabaseAdmin
    .from("users").select("nombre, rol, activo").eq("email", email).maybeSingle();
  if (u && u.activo) return { nombre: u.nombre || email, rol: u.rol || "Alumno" };
  const { data: c } = await supabaseAdmin
    .from("usuarios").select("nombre, rol, activo").ilike("email", email).maybeSingle();
  if (c && c.activo) return { nombre: c.nombre || email, rol: c.rol || "Alumno" };
  return { nombre: email, rol: "Alumno" };
}

/**
 * Etiqueta genérica con la que firma el alumnado cualquier registro que NO
 * tenga una justificación de seguridad para identificar a la persona.
 */
export const AUTOR_ALUMNADO = "Alumnado";

/**
 * Quién consta como autor de un registro, aplicando minimización de datos
 * (RGPD): el profesorado firma con su nombre, el alumnado con la etiqueta
 * genérica `AUTOR_ALUMNADO`.
 *
 * La decisión se toma AQUÍ, en el servidor, a partir del rol del email de la
 * sesión — nunca a partir de lo que mande el navegador. Así el nombre de un
 * alumno no puede acabar en la base de datos ni por error del cliente ni por
 * una llamada manual a la función.
 *
 * Excepciones deliberadas, donde sí se guarda identidad porque la seguridad
 * del laboratorio lo justifica y NO deben usar este helper:
 *   - registros_cabina / registros_autoclave / registros_vitrina
 *   - reservas_equipos
 * Ver docs/proteccion-datos.md.
 */
export async function autorRegistro(supabaseAdmin: any, email: string, nombrePropuesto?: unknown) {
  const { nombre, rol } = await identificarUsuario(supabaseAdmin, email);
  if (!ES_STAFF(rol)) return { autor: AUTOR_ALUMNADO, rol, esStaff: false };
  const propuesto = typeof nombrePropuesto === "string" ? nombrePropuesto.trim() : "";
  return { autor: propuesto || nombre, rol, esStaff: true };
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

/**
 * Contraseña del alumnado: la parte del email anterior a "@", en minúsculas — la misma
 * convención que usa TRebello, para que no tengan que aprenderse dos contraseñas distintas.
 * Es la que reparte el import de alumnado y a la que vuelve "Restablecer contraseña".
 * Supabase Auth exige 6 caracteres mínimo, así que los correos con parte local más corta
 * se completan con dígitos (p.ej. "ana" -> "ana123").
 */
export function passwordDesdeEmail(email: string): string {
  const local = String(email || "").split("@")[0].trim().toLowerCase();
  if (!local) return generarPasswordTemporal();
  return local.length >= 6 ? local : (local + "123456").slice(0, 6);
}
