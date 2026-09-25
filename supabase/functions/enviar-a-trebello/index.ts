// Envía un pedido de laboratorio al módulo Compras de Trebello, que es donde
// la jefa de departamento tramita TODOS los pedidos del departamento (los de
// laboratorio y los del resto del profesorado). Antes iban por correo con la
// hoja firmada y la factura adjuntas; ahora se depositan allí y la jefa firma
// la hoja ella misma, igual que hace con los demás.
//
// El secreto vive aquí, en el servidor, nunca en el navegador — misma regla
// que la clave de Gemini (ver CLAUDE.md, "Consultorio de residuos").
//
// Es idempotente: reenviar el mismo pedido actualiza el que ya está en
// Trebello (clave `gestionlab_pedido_id`), no crea otro.
import { requireAdminOrGestor, jsonError, jsonOk, handleCorsPreflight } from "../_shared/auth.ts";

const TREBELLO_URL    = Deno.env.get("TREBELLO_INGEST_URL");
const TREBELLO_SECRET = Deno.env.get("TREBELLO_INGEST_SECRET");

const MAX_BYTES = 10 * 1024 * 1024;
const MIME_OK = ["application/pdf", "image/jpeg", "image/png"];

// Los documentos van en el cuerpo JSON, así que hay que pasarlos a base64.
// En trozos, porque String.fromCharCode con un array de varios MB revienta la
// pila de llamadas.
function aBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binario = "";
  const CHUNK = 8192;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binario += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binario);
}

// Postgres `date` no traga un ISO con hora: recortamos a YYYY-MM-DD.
const soloFecha = (v: unknown) => {
  const s = String(v ?? "").trim();
  return s ? s.slice(0, 10) : null;
};

function mimeDesdeNombre(nombre: string): string {
  const ext = nombre.toLowerCase().split(".").pop() || "";
  if (ext === "pdf") return "application/pdf";
  if (ext === "png") return "image/png";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  return "";
}

Deno.serve(async (req) => {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;
  if (req.method !== "POST") return jsonError("Método no permitido", 405);

  if (!TREBELLO_URL || !TREBELLO_SECRET) {
    return jsonError("La integración con Trebello no está configurada (faltan TREBELLO_INGEST_URL / TREBELLO_INGEST_SECRET)", 503);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonError("Cuerpo inválido (se esperaba JSON)", 400);
  }

  const { error: authError, supabaseAdmin } = await requireAdminOrGestor(req);
  if (authError) return authError;

  const idPedido = String(body.id_pedido || "").trim();
  if (!idPedido) return jsonError("Falta id_pedido", 400);

  const { data: pedido } = await supabaseAdmin
    .from("pedidos").select("*").eq("id_pedido", idPedido).maybeSingle();
  if (!pedido) return jsonError("Pedido no encontrado", 404);

  const { data: lineas } = await supabaseAdmin
    .from("lineas_pedido").select("*").eq("pedido", idPedido);

  // ── Validaciones: las mismas que Trebello exige para poder sacar el PDF ──
  // Mejor descubrirlo aquí que al otro lado, con el pedido ya creado.
  const faltan: string[] = [];
  if (!String(pedido.numero_factura || "").trim()) faltan.push("el número de factura");
  if (!(lineas || []).length) faltan.push("alguna línea en el pedido");
  const sinPrecio = (lineas || []).filter((l: any) => !(parseFloat(l.precio_unitario) > 0));
  if (sinPrecio.length === 1) faltan.push(`el precio de "${sinPrecio[0].material}"`);
  else if (sinPrecio.length > 1) faltan.push(`el precio de ${sinPrecio.length} artículos`);
  if (faltan.length) {
    return jsonError(`Faltan datos para enviar a Trebello: ${faltan.join(" y ")}.`, 400);
  }

  // ── Líneas → items ────────────────────────────────────────────────────
  // Forma canónica de `PedidoItem` en Trebello (lib/actions/pedidos.ts). Dos
  // cosas que no son opcionales aunque lo parezcan:
  //   · `id` — el modal de la hoja indexa los precios por él
  //     (`prices[item.id]`), así que sin id todos los artículos caen en la
  //     misma clave y el modal los muestra a 0,00.
  //   · la unidad va SOLO en `unidade`, nunca pegada al concepto: el
  //     generador ya la imprime junto a la cantidad, y duplicarla descuadra
  //     la tabla del Word.
  // El id es el de la línea de GestionLab, no un UUID al azar: así reenviar
  // el pedido no le cambia la identidad a cada artículo.
  const items = (lineas || []).map((l: any) => {
    const pedida   = parseFloat(l.cantidad_pedida)   || 0;
    const recibida = parseFloat(l.cantidad_recibida) || 0;
    return {
      id: String(l.id_linea),
      concepto: String(l.material || ""),
      cantidade: pedida,
      unidade: String(l.unidad || "").trim() || null,
      prezo_sin_iva: parseFloat(l.precio_unitario) || 0,
      received: pedida > 0 && recibida >= pedida,
      solicitude_id: null,
      requester_name: null,
    };
  });

  const gastoExtra = parseFloat(pedido.gasto_extra_importe) || 0;
  const cargoExtra = gastoExtra > 0
    ? {
        id: `${idPedido}-cargo-extra`,
        concepto: pedido.gasto_extra_concepto || "Gasto extra",
        importe: gastoExtra,
      }
    : null;

  // ── Facturas del proveedor ────────────────────────────────────────────
  const { data: docs } = await supabaseAdmin
    .from("documentos_proveedor").select("*").eq("pedido", idPedido).order("fecha_subida");

  const facturas: { nombre: string; mime: string; base64: string }[] = [];
  const noEnviados: string[] = [];
  for (const d of docs || []) {
    const nombre = String(d.nombre_archivo || "documento");
    const mime = mimeDesdeNombre(nombre);
    if (!MIME_OK.includes(mime)) { noEnviados.push(`${nombre} (formato no admitido)`); continue; }
    if (d.tamano_bytes && Number(d.tamano_bytes) > MAX_BYTES) { noEnviados.push(`${nombre} (supera 10 MB)`); continue; }
    const { data: archivo, error: descargaErr } = await supabaseAdmin.storage.from("documentos").download(d.path);
    if (descargaErr || !archivo) { noEnviados.push(`${nombre} (no se pudo leer)`); continue; }
    const buf = await archivo.arrayBuffer();
    if (buf.byteLength > MAX_BYTES) { noEnviados.push(`${nombre} (supera 10 MB)`); continue; }
    facturas.push({ nombre, mime, base64: aBase64(buf) });
  }

  // ── Envío ─────────────────────────────────────────────────────────────
  const payload = {
    pedido_id: idPedido,
    nombre: pedido.nombre_lista || null,
    casa_comercial: pedido.proveedor || null,
    ciclo: pedido.ciclo || null,
    modulo: pedido.modulo || null,
    numero_factura: pedido.numero_factura || null,
    data_factura: soloFecha(pedido.fecha_factura),
    data_pedido: soloFecha(pedido.fecha_pedido_enviado || pedido.fecha_aprobacion || pedido.fecha_creacion),
    // Las observaciones NO se mandan: en la hoja de pedido salen impresas en
    // "OBSERVACIÓNS", que es un campo del documento oficial, no un cajón para
    // las notas internas del pedido de laboratorio.
    items,
    cargo_extra: cargoExtra,
    facturas,
  };

  let resp: Response;
  try {
    resp = await fetch(TREBELLO_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-gestionlab-secret": TREBELLO_SECRET },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(45000),
    });
  } catch (e) {
    return jsonError(`No se pudo contactar con Trebello: ${e instanceof Error ? e.message : String(e)}`, 502);
  }

  let resultado: any = null;
  try { resultado = await resp.json(); } catch { /* respuesta no JSON */ }

  if (!resp.ok) {
    return jsonError(resultado?.error || `Trebello respondió ${resp.status}`, resp.status === 409 ? 409 : 502);
  }

  // ── Marcar el envío en el pedido ──────────────────────────────────────
  // doc_enviada_jefatura deja de marcarse a mano: ahora significa "llegó de
  // verdad a Trebello", y solo se pone si el envío respondió OK.
  await supabaseAdmin.from("pedidos").update({
    trebello_pedido_id: resultado?.pedido_id || null,
    fecha_envio_trebello: new Date().toISOString(),
    doc_enviada_jefatura: true,
  }).eq("id_pedido", idPedido);

  return jsonOk({
    ok: true,
    trebello_pedido_id: resultado?.pedido_id || null,
    nuevo: !!resultado?.novo,
    facturas_enviadas: facturas.length,
    facturas_no_enviadas: noEnviados,
    facturas_rechazadas: resultado?.facturas_rexeitadas || [],
  });
});
