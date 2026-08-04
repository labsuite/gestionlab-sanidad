// Tarea #7 — Genera una URL temporal para ver/descargar un documento del
// bucket privado. Los manuales los puede ver cualquier persona con sesión
// válida; las facturas son más sensibles y quedan solo para Admin/Gestor.
import { requireValidSession, requireAdminOrGestor, jsonError, jsonOk } from "../_shared/auth.ts";

const VALIDEZ_SEGUNDOS = 3600; // 1 hora

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const path = url.searchParams.get("path");
  if (!path) return jsonError("Falta el parámetro path", 400);

  const esFactura = path.startsWith("facturas/");

  const { error: authError, supabaseAdmin } = esFactura
    ? await requireAdminOrGestor(req)
    : await requireValidSession(req);
  if (authError) return authError;

  const { data, error } = await supabaseAdmin.storage
    .from("documentos")
    .createSignedUrl(path, VALIDEZ_SEGUNDOS);

  if (error || !data) {
    return jsonError(`No se pudo generar el enlace: ${error?.message ?? "archivo no encontrado"}`, 404);
  }

  return jsonOk({ url: data.signedUrl, valido_segundos: VALIDEZ_SEGUNDOS });
});
