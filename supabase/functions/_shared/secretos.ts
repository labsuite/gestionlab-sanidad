/**
 * Cifrado simétrico del único secreto que la app guarda y necesita poder volver
 * a LEER: la contraseña de las cuentas de GRUPO del alumnado.
 *
 * Supabase Auth guarda las contraseñas como hash, así que no se pueden
 * "consultar". Como la cuenta de un grupo es compartida a propósito (es como la
 * clave del wifi del aula), el profesorado tiene que poder decírsela a su grupo
 * y rotarla cuando haga falta — por eso se guarda aquí una copia cifrada en
 * `credenciales_grupo`, que solo descifra el servidor tras comprobar quién
 * pregunta. Mismo planteamiento que `lib/crypto/secret-box.ts` en Trebello.
 *
 * ⚠ Esto vale SOLO para cuentas de grupo. La contraseña de una persona no se
 * guarda nunca, ni cifrada: si se le olvida, se restablece (ver
 * `resetear_password` en gestionar-usuario).
 *
 * AES-256-GCM. La clave sale del secreto de servidor `GRUPO_PASSWORD_KEY`
 * (Supabase → Edge Functions → Secrets), pasada por SHA-256 para tener 32 bytes
 * exactos, así vale cualquier frase larga. Nunca llega a Postgres: la base de
 * datos solo ve el texto cifrado, y quien tenga una copia de la base de datos
 * (o la contraseña del pooler de `scripts/`) no puede leer las contraseñas.
 *
 * Formato almacenado:  v1:<iv_b64>:<ciphertext_b64>   (el tag GCM va dentro del
 * ciphertext, que es como lo devuelve WebCrypto).
 */

const CLAVE_ENV = "GRUPO_PASSWORD_KEY";
const PREFIJO = "v1";

function frase(): string {
  return String(Deno.env.get(CLAVE_ENV) || "").trim();
}

/** true si este entorno tiene configurado el secreto de cifrado. */
export function hayClaveDeCifrado(): boolean {
  return frase().length >= 16;
}

async function clave(usos: KeyUsage[]): Promise<CryptoKey> {
  const raw = frase();
  if (raw.length < 16) {
    throw new Error(`Falta el secreto ${CLAVE_ENV} en las Edge Functions`);
  }
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
  return await crypto.subtle.importKey("raw", hash, { name: "AES-GCM" }, false, usos);
}

const aB64 = (b: ArrayBuffer | Uint8Array) =>
  btoa(String.fromCharCode(...new Uint8Array(b)));

const deB64 = (s: string) =>
  Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export async function cifrar(texto: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    await clave(["encrypt"]),
    new TextEncoder().encode(texto),
  );
  return [PREFIJO, aB64(iv), aB64(ct)].join(":");
}

export async function descifrar(payload: string): Promise<string> {
  const partes = String(payload || "").split(":");
  if (partes.length !== 3 || partes[0] !== PREFIJO) {
    throw new Error("Formato de secreto no válido");
  }
  const plano = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: deB64(partes[1]) },
    await clave(["decrypt"]),
    deB64(partes[2]),
  );
  return new TextDecoder().decode(plano);
}
