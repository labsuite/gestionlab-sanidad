// Edge Function PÚBLICA (sin sesión de usuario) — link que se comparte con
// una casa comercial para que suba la factura/presupuesto de un pedido
// concreto, sin darle acceso al resto de la app. La seguridad la da el
// `token` (aleatorio, generado por gestionar-pedido/accion=generar_link_publico
// y guardado en pedidos.token_publico), no una sesión de Supabase Auth — por
// eso este fichero NO usa requireAdminOrGestor/requireStaff. El navegador
// sigue mandando la anon key como Authorization (igual que hace
// callEdgeFunction() sin sesión), así que no hace falta desactivar verify_jwt
// en el despliegue.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { jsonError, jsonOk, handleCorsPreflight } from "../_shared/auth.ts";

const TIPOS_MIME_PERMITIDOS = ["application/pdf", "image/jpeg", "image/png"];
const TAMANO_MAXIMO_BYTES = 10 * 1024 * 1024; // 10 MB — igual que subir-documento

function adminClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

function genId(prefix: string): string {
  return prefix + Date.now().toString(36).toUpperCase().slice(-6) + Math.floor(Math.random() * 36).toString(36).toUpperCase();
}

Deno.serve(async (req) => {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;
  if (req.method !== "POST") return jsonError("Método no permitido", 405);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonError("Cuerpo inválido (se esperaba JSON)", 400);
  }

  const accion = String(body.accion || "");
  const idPedido = String(body.pedido || "").trim();
  const token = String(body.token || "").trim();
  if (!idPedido || !token) return jsonError("Enlace no válido", 404);

  const supabaseAdmin = adminClient();
  const { data: pedido } = await supabaseAdmin.from("pedidos").select("*").eq("id_pedido", idPedido).maybeSingle();
  // Mensaje genérico en todos los casos de token/pedido inválido — no revelar
  // si el pedido existe o no a quien no tiene el token correcto.
  if (!pedido || !pedido.token_publico || pedido.token_publico !== token) {
    return jsonError("Enlace no válido o caducado", 404);
  }

  if (accion === "info") {
    return jsonOk({
      nombre_lista: pedido.nombre_lista,
      proveedor: pedido.proveedor,
      estado: pedido.estado,
    });
  }

  if (accion === "subir") {
    const nombreArchivo = String(body.nombre_archivo || "").trim();
    const tipoMime = String(body.tipo_mime || "").trim();
    const contenidoBase64 = String(body.contenido_base64 || "");
    if (!nombreArchivo || !tipoMime || !contenidoBase64) {
      return jsonError("Faltan campos: nombre_archivo, tipo_mime, contenido_base64", 400);
    }
    if (!TIPOS_MIME_PERMITIDOS.includes(tipoMime)) {
      return jsonError(`Tipo de archivo no permitido: ${tipoMime} (solo PDF, JPEG, PNG)`, 400);
    }

    let bytes: Uint8Array;
    try {
      const binario = atob(contenidoBase64);
      bytes = new Uint8Array(binario.length);
      for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
    } catch {
      return jsonError("contenido_base64 no es base64 válido", 400);
    }
    if (bytes.byteLength > TAMANO_MAXIMO_BYTES) {
      const mb = (bytes.byteLength / (1024 * 1024)).toFixed(1);
      return jsonError(`El archivo pesa ${mb} MB, el máximo es 10 MB`, 400);
    }

    const nombreSaneado = nombreArchivo.replace(/[^a-zA-Z0-9_.-]/g, "_");
    const path = `facturas-proveedor/${idPedido}/${Date.now()}-${nombreSaneado}`;

    const { error: uploadErr } = await supabaseAdmin.storage
      .from("documentos")
      .upload(path, bytes, { contentType: tipoMime, upsert: false });
    if (uploadErr) return jsonError(`No se pudo subir el archivo: ${uploadErr.message}`, 400);

    const { error: insertErr } = await supabaseAdmin.from("documentos_proveedor").insert({
      id_documento: genId("DOCP"),
      pedido: idPedido,
      nombre_archivo: nombreArchivo,
      path,
      tamano_bytes: bytes.byteLength,
    });
    if (insertErr) return jsonError(`Archivo subido pero no se pudo registrar: ${insertErr.message}`, 400);

    return jsonOk({ ok: true });
  }

  return jsonError("accion debe ser 'info' o 'subir'", 400);
});
