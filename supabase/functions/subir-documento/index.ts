// Tarea #7 — Subida de documentos (manuales de equipo / adjuntos de
// intervención / facturas / Word de pedido generado). Valida tipo y tamaño
// en el servidor (además del límite que ya tiene el propio bucket) — nunca
// confiar solo en la validación del navegador. Body JSON con el archivo en
// base64 (mismo patrón que ya usa GestionLab para adjuntos, ver
// pendingEqFileBase64 en js/config.js).
//
// Permiso por tipo: "manual" y "documento" (Word de pedido) van con el
// catálogo/pedidos, Admin/Gestor. "actuacion" va con crearIntervenciones,
// que también tiene Profesor (ver PERMISOS en js/ui.js) — restringirlo a
// Admin/Gestor le impediría adjuntar el PDF de sus propias actuaciones.
import { requireAdminOrGestor, requireStaff, jsonError, jsonOk, handleCorsPreflight } from "../_shared/auth.ts";

const TIPOS_MIME_PERMITIDOS = [
  "application/pdf", "image/jpeg", "image/png",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];
const TAMANO_MAXIMO_BYTES = 10 * 1024 * 1024; // 10 MB — igual que el límite del bucket
const CARPETAS: Record<string, string> = {
  manual: "manuales",       // ficha técnica de un equipo (id = ID_Activo)
  factura: "facturas",      // sin uso actual desde el cliente, se deja por compatibilidad
  actuacion: "actuaciones", // adjunto/factura de una intervención (id = ID_Intervencion)
  documento: "documentos-generados", // Word de pedido generado desde la app (id = ID_Pedido)
};
const TIPOS_STAFF = ["actuacion"];

Deno.serve(async (req) => {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;
  if (req.method !== "POST") return jsonError("Método no permitido", 405);

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

  if (!tipo || !(tipo in CARPETAS)) {
    return jsonError(`tipo debe ser uno de: ${Object.keys(CARPETAS).join(", ")}`, 400);
  }

  const { error: authError, supabaseAdmin } = TIPOS_STAFF.includes(tipo)
    ? await requireStaff(req)
    : await requireAdminOrGestor(req);
  if (authError) return authError;

  if (!id || !nombre_archivo || !tipo_mime || !contenido_base64) {
    return jsonError("Faltan campos: id, nombre_archivo, tipo_mime, contenido_base64", 400);
  }
  if (!TIPOS_MIME_PERMITIDOS.includes(tipo_mime)) {
    return jsonError(`Tipo de archivo no permitido: ${tipo_mime} (solo PDF, JPEG, PNG o Word .docx)`, 400);
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
  const carpetaId = `${CARPETAS[tipo]}/${id}`;

  // La folla de pedido generada ("documento") se conserva solo la última:
  // antes de subir la nueva, se borra cualquier hoja anterior de ESTE pedido.
  if (tipo === "documento") {
    const { data: previos } = await supabaseAdmin.storage.from("documentos").list(carpetaId);
    if (previos?.length) {
      await supabaseAdmin.storage.from("documentos").remove(previos.map((f) => `${carpetaId}/${f.name}`));
    }
  }

  const path = `${carpetaId}/${Date.now()}-${nombreSaneado}`;

  const { error: uploadErr } = await supabaseAdmin.storage
    .from("documentos")
    .upload(path, bytes, { contentType: tipo_mime, upsert: false });

  if (uploadErr) {
    return jsonError(`No se pudo subir el archivo: ${uploadErr.message}`, 400);
  }

  return jsonOk({ path, tamano_bytes: bytes.byteLength });
});
