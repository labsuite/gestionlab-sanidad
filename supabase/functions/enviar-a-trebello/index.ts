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
  const aItem = (l: any) => {
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
  };

  // ── Material común: va en una hoja aparte (misma factura) ─────────────
  // Guantes, papel… los usa todo el departamento aunque se pidan desde los
  // laboratorios. Las líneas que lo son (marca de la línea o, si no tiene,
  // la de la ficha del material) viajan como un SEGUNDO pedido de Trebello,
  // con ciclo "Material común", para que la jefa no las impute a Laboratorios.
  const { data: materiales } = await supabaseAdmin.from("material").select("id_material, nombre, material_comun");
  const lineaEsComun = (l: any): boolean => {
    if (pedido.tipo === "Servicio") return false;
    if (l.material_comun === true || l.material_comun === false) return l.material_comun;
    const nombre = String(l.material || "");
    const mat = (materiales || []).find((m: any) => l.id_material && m.id_material === l.id_material)
             || (materiales || []).find((m: any) => m.nombre === nombre || nombre.startsWith(m.nombre));
    return mat?.material_comun === true;
  };
  const lineasComunes = (lineas || []).filter(lineaEsComun);
  const lineasPropias = (lineas || []).filter((l: any) => !lineasComunes.includes(l));

  // Portes/tasas: con la parte del laboratorio, salvo que todo sea común.
  const gastoExtra = parseFloat(pedido.gasto_extra_importe) || 0;
  const cargoExtra = (id: string) => gastoExtra > 0
    ? { id: `${id}-cargo-extra`, concepto: pedido.gasto_extra_concepto || "Gasto extra", importe: gastoExtra }
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
  const base = {
    casa_comercial: pedido.proveedor || null,
    numero_factura: pedido.numero_factura || null,
    data_factura: soloFecha(pedido.fecha_factura),
    data_pedido: soloFecha(pedido.fecha_pedido_enviado || pedido.fecha_aprobacion || pedido.fecha_creacion),
    // Las observaciones NO se mandan: en la hoja de pedido salen impresas en
    // "OBSERVACIÓNS", que es un campo del documento oficial, no un cajón para
    // las notas internas del pedido de laboratorio.
    facturas,
  };

  async function enviar(payload: Record<string, unknown>) {
    let resp: Response;
    try {
      resp = await fetch(TREBELLO_URL!, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-gestionlab-secret": TREBELLO_SECRET! },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(45000),
      });
    } catch (e) {
      return { error: `No se pudo contactar con Trebello: ${e instanceof Error ? e.message : String(e)}`, status: 502 };
    }
    let resultado: any = null;
    try { resultado = await resp.json(); } catch { /* respuesta no JSON */ }
    if (!resp.ok) return { error: resultado?.error || `Trebello respondió ${resp.status}`, status: resp.status === 409 ? 409 : 502 };
    return { resultado };
  }

  // La parte del laboratorio conserva la clave de siempre (ID_Pedido), así
  // los pedidos enviados antes de existir el material común se actualizan en
  // vez de duplicarse. La común usa ID_Pedido + "-COMUN".
  const resultados: any[] = [];
  const cambios: Record<string, unknown> = {};
  const avisos: string[] = [];

  if (lineasPropias.length) {
    const r = await enviar({
      ...base,
      pedido_id: idPedido,
      nombre: pedido.nombre_lista || null,
      ciclo: pedido.ciclo || null,
      modulo: pedido.modulo || null,
      items: lineasPropias.map(aItem),
      cargo_extra: cargoExtra(idPedido),
    });
    if (r.error) return jsonError(r.error, r.status);
    resultados.push(r.resultado);
    cambios.trebello_pedido_id = r.resultado?.pedido_id || null;
  } else if (pedido.trebello_pedido_id) {
    avisos.push("En Trebello sigue la hoja de laboratorio que se envió antes; ahora todo es material común, así que habría que borrarla allí");
  }

  if (lineasComunes.length) {
    const r = await enviar({
      ...base,
      pedido_id: `${idPedido}-COMUN`,
      nombre: `${pedido.nombre_lista || idPedido} · Material común`,
      ciclo: "Material común",
      modulo: null,
      items: lineasComunes.map(aItem),
      cargo_extra: lineasPropias.length ? null : cargoExtra(`${idPedido}-COMUN`),
    });
    if (r.error) {
      // La parte del laboratorio ya llegó: se guarda, para no perder la pista.
      if (Object.keys(cambios).length) await supabaseAdmin.from("pedidos").update(cambios).eq("id_pedido", idPedido);
      return jsonError(`${lineasPropias.length ? "La hoja de laboratorio se envió, pero la de material común no: " : ""}${r.error}`, r.status);
    }
    resultados.push(r.resultado);
    cambios.trebello_pedido_comun_id = r.resultado?.pedido_id || null;
  } else if (pedido.trebello_pedido_comun_id) {
    avisos.push("En Trebello sigue la hoja de material común que se envió antes; ahora no queda ninguna línea común, así que habría que borrarla allí");
  }

  // ── Marcar el envío en el pedido ──────────────────────────────────────
  // doc_enviada_jefatura deja de marcarse a mano: ahora significa "llegó de
  // verdad a Trebello", y solo se pone si el envío respondió OK.
  await supabaseAdmin.from("pedidos").update({
    ...cambios,
    fecha_envio_trebello: new Date().toISOString(),
    doc_enviada_jefatura: true,
  }).eq("id_pedido", idPedido);

  return jsonOk({
    ok: true,
    trebello_pedido_id: cambios.trebello_pedido_id ?? pedido.trebello_pedido_id ?? null,
    trebello_pedido_comun_id: cambios.trebello_pedido_comun_id ?? pedido.trebello_pedido_comun_id ?? null,
    hojas: resultados.length,
    lineas_comunes: lineasComunes.length,
    nuevo: resultados.some((r) => !!r?.novo),
    facturas_enviadas: facturas.length,
    facturas_no_enviadas: noEnviados,
    facturas_rechazadas: [...new Set(resultados.flatMap((r) => r?.facturas_rexeitadas || []))],
    avisos,
  });
});
