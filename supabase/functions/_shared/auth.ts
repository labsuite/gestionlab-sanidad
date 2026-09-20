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
 * Dominio de las cuentas de grupo del alumnado (una cuenta por grupo, compartida
 * por todo el grupo: `1cslcb@gestionlab.cma` = "1º CS LCB"). No existe ninguna
 * cuenta personal de alumnado — ver docs/modulo-usuarios.md.
 */
export const DOMINIO_GRUPOS_ALUMNADO = "@gestionlab.cma";

/**
 * Etiqueta de reserva para alumnado que NO entra por una cuenta de grupo.
 * No debería darse, pero si apareciese una cuenta personal, firma genérico
 * antes que con un nombre propio.
 */
export const AUTOR_ALUMNADO = "Alumnado";

/**
 * Cómo figura una persona del profesorado en los registros: **nombre y primer
 * apellido** ("Paloma Fernández", no "Paloma Fernández López" ni "Paloma").
 *
 * La regla es quitar el último apellido, no quedarse con las dos primeras
 * palabras: hay nombres compuestos ("Ana Belén Silva Abuín" → "Ana Belén Silva",
 * que con las dos primeras se quedaría en "Ana Belén", sin apellido) y apellidos
 * compuestos ("Sabela Fernández de Sanmamed Girón" → "Sabela Fernández de
 * Sanmamed"). Con menos de tres palabras se deja tal cual ("Marta Alén").
 *
 * ⚠ Solo para personas. NUNCA aplicar a una cuenta de grupo ("1º CS LCB" se
 * quedaría en "1º CS") ni a un nombre de empresa tecleado a mano en "Realizado
 * por" de un mantenimiento externo.
 */
export function nombreCorto(nombre: string): string {
  const partes = String(nombre || "").trim().split(/\s+/).filter(Boolean);
  if (partes.length < 3) return partes.join(" ");
  return partes.slice(0, -1).join(" ");
}

/**
 * Con qué firma el alumnado un registro. Con cuenta de grupo firma el grupo
 * ("1º CS LCB"): no identifica a nadie y dice mucho más que "Alumnado".
 */
export function firmaAlumnado(email: string, nombre: string): string {
  return esCuentaDeGrupo(email) && nombre ? nombre : AUTOR_ALUMNADO;
}

/**
 * Quién consta como autor de un registro, aplicando minimización de datos
 * (RGPD): el profesorado firma con su nombre y el alumnado con el nombre de su
 * grupo ("1º CS LCB"), que no identifica a ninguna persona.
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
  if (!ES_STAFF(rol)) return { autor: firmaAlumnado(email, nombre), rol, esStaff: false };
  // El nombre que manda el navegador se ignora a propósito: en todos estos
  // registros es siempre la propia persona, así que la fuente buena es el
  // catálogo. `nombrePropuesto` se conserva solo como último recurso si el
  // catálogo no tiene nombre.
  const propuesto = typeof nombrePropuesto === "string" ? nombrePropuesto.trim() : "";
  return { autor: nombreCorto(nombre) || propuesto, rol, esStaff: true };
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
/**
 * Contraseña de una cuenta de grupo. NO puede derivarse del email como la del
 * alumnado individual: la parte local es el propio nombre del grupo
 * (`1cslcb`), así que cualquiera de otro grupo la adivinaría a la primera.
 *
 * Dos palabras y tres dígitos: aleatoria de verdad, pero se dicta en clase sin
 * deletrear ("praza-verde-482").
 */
const PALABRAS_PASSWORD = [
  "auga", "praia", "vento", "ceo", "pedra", "faro", "ponte", "horta",
  "verde", "azul", "roxo", "dourado", "prata", "ámbar", "coral", "malva",
  "lúa", "sol", "raio", "brisa", "monte", "río", "campo", "illa",
];

export function passwordDeGrupo(): string {
  const bytes = new Uint8Array(3);
  crypto.getRandomValues(bytes);
  const a = PALABRAS_PASSWORD[bytes[0] % PALABRAS_PASSWORD.length];
  let b = PALABRAS_PASSWORD[bytes[1] % PALABRAS_PASSWORD.length];
  if (b === a) b = PALABRAS_PASSWORD[(bytes[1] + 1) % PALABRAS_PASSWORD.length];
  const n = 100 + (bytes[2] % 100) * 9 % 900;
  return `${a}-${b}-${n}`;
}

/** true si el email es el de una cuenta de grupo del alumnado. */
export function esCuentaDeGrupo(email: string): boolean {
  return String(email || "").toLowerCase().trim().endsWith(DOMINIO_GRUPOS_ALUMNADO);
}

export function passwordDesdeEmail(email: string): string {
  const local = String(email || "").split("@")[0].trim().toLowerCase();
  if (!local) return generarPasswordTemporal();
  return local.length >= 6 ? local : (local + "123456").slice(0, 6);
}
