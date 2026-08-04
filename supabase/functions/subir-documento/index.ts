// Tarea #7 — Subida de documentos (manuales de equipo / facturas de pedido).
// Solo Admin/Gestor. Valida tipo y tamaño en el servidor (además del límite
// que ya tiene el propio bucket) — nunca confiar solo en la validación del
// navegador. Body JSON con el archivo en base64 (mismo patrón que ya usa
// GestionLab para adjuntos, ver pendingEqFileBase64 en js/config.js).
import { requireAdminOrGestor, jsonError, jsonOk } from "../_shared/auth.ts";

const TIPOS_MIME_PERMITIDOS = ["application/pdf", "image/jpeg", "image/png"];
const TAMANO_MAXIMO_BYTES = 10 * 1024 * 1024; // 10 MB — igual que el límite del bucket

Deno.serve(async (req) => {
  if (req.method !== "POST") return jsonError("Método no permitido", 405);

  const { error: authError, supabaseAdmin } = await requireAdminOrGestor(req);
  if (authError) return authError;

  let body: {
    tipo?: string; // 'manual' | 'factura'
    id?: string; // ID_Activo o ID_Pedido
    nombre_archivo?: string;
    tipo_mime?: string;
    contenido_base64?: string;
  };
  try {
    body = await req.json();
  } catch {
    return jsonError("Cuerpo inválido (se esperaba JSON)", 400);
  }

  const { tipo, id, nombre_archivo, tipo_mime, contenido_base64 } = body;

  if (!tipo || !["manual", "factura"].includes(tipo)) {
    return jsonError("tipo debe ser 'manual' o 'factura'", 400);
  }
  if (!id || !nombre_archivo || !tipo_mime || !contenido_base64) {
    return jsonError("Faltan campos: id, nombre_archivo, tipo_mime, contenido_base64", 400);
  }
  if (!TIPOS_MIME_PERMITIDOS.includes(tipo_mime)) {
    return jsonError(`Tipo de archivo no permitido: ${tipo_mime} (solo PDF, JPEG, PNG)`, 400);
  }

  let bytes: Uint8Array;
  try {
    const binario = atob(contenido_base64);
    bytes = new Uint8Array(binario.length);
    for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
  } catch {
    return jsonError("contenido_base64 no es base64 válido", 400);
  }

  if (bytes.byteLength > TAMANO_MAXIMO_BYTES) {
    const mb = (bytes.byteLength / (1024 * 1024)).toFixed(1);
    return jsonError(`El archivo pesa ${mb} MB, el máximo es 10 MB`, 400);
  }

  const nombreSaneado = nombre_archivo.replace(/[^a-zA-Z0-9_.-]/g, "_");
  const carpeta = tipo === "manual" ? "manuales" : "facturas";
  const path = `${carpeta}/${id}/${Date.now()}-${nombreSaneado}`;

  const { error: uploadErr } = await supabaseAdmin.storage
    .from("documentos")
    .upload(path, bytes, { contentType: tipo_mime, upsert: false });

  if (uploadErr) {
    return jsonError(`No se pudo subir el archivo: ${uploadErr.message}`, 400);
  }

  return jsonOk({ path, tamano_bytes: bytes.byteLength });
});
