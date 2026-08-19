// Lee con IA (Gemini) un documento subido por el proveedor a través del link
// público (ver pedido-publico) — factura o presupuesto — y extrae sus líneas
// de artículo, emparejándolas contra las líneas ya existentes en el pedido
// (lineas_pedido). Solo Admin/Gestor puede disparar la lectura, y solo se
// guarda el resultado; no toca cantidad_recibida/precio_unitario de ninguna
// línea — eso lo hace el Gestor a mano en el modal de revisión, precargado
// con lo detectado (gestionar-linea-pedido ya cubre esas escrituras).
//
// El emparejamiento lo hace el propio Gemini, no una comparación de texto
// local: en pruebas reales, facturas de proveedor usan nombres comerciales
// muy distintos al nombre genérico del catálogo interno (p.ej. "Aquatex
// 50 mL" = "Medio de montaje para muestras hidratadas", "Calcofluor White
// Stain" = "Tinción blanco de calcoflúor") — comparar palabras nunca
// reconoce eso, pero el modelo sí (conoce marcas/sinónimos del sector). Por
// eso se le pasa la lista de líneas del pedido en el propio prompt y es él
// quien elige el id_linea de cada artículo. El servidor solo valida que el
// id devuelto exista de verdad entre las líneas del pedido (nunca se fía a
// ciegas de lo que diga el modelo) y resuelve duplicados si asigna el mismo
// id_linea a dos artículos distintos.
import { requireAdminOrGestor, jsonError, jsonOk, handleCorsPreflight } from "../_shared/auth.ts";

// gemini-1.5-flash y gemini-2.5-flash ya no están disponibles para claves
// nuevas (Google los retiró) — confirmado a mano contra la API el
// 2026-08-19; gemini-3.6-flash es el que Google recomienda en su lugar. Si
// esto vuelve a dar 404 "is not found for API version v1beta", comprobar
// modelos vigentes con GET /v1beta/models?key=... antes de asumir otra causa.
const GEMINI_MODELO = "gemini-3.6-flash";

function mimeDesdeNombre(nombre: string): string {
  const ext = nombre.toLowerCase().split(".").pop() || "";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "png") return "image/png";
  return "application/pdf";
}

function arrayBufferABase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binario = "";
  const CHUNK = 8192;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binario += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binario);
}

function construirPrompt(lineas: { id_linea: string; material: string; cantidad_pedida: number | null }[]): string {
  const listaLineas = lineas.length
    ? lineas.map((l) => `- id_linea "${l.id_linea}": ${l.material} (cantidad pedida: ${l.cantidad_pedida ?? "?"})`).join("\n")
    : "(este pedido no tiene ninguna línea todavía)";

  return `Eres un asistente que extrae las líneas de artículo de una factura o presupuesto de un proveedor de material de laboratorio clínico/sanitario, y las empareja con las líneas ya existentes de un pedido interno.

Estas son las líneas del pedido interno con las que debes comparar cada artículo del documento:
${listaLineas}

Devuelve SOLO un objeto JSON. Reglas:
- "items": un array con un objeto por cada línea de artículo del documento (reactivos, material fungible, equipos, kits...). Ignora completamente cabeceras, totales, subtotales y el IVA — nunca los devuelvas como si fueran un artículo.
  - "material": el nombre del artículo tal como figura en el documento (incluye referencia/SKU si aparece), sin inventar ni completar información que no esté.
  - "cantidad": número de unidades de esa línea, o null si no aparece.
  - "precio_unitario": el precio POR UNIDAD SIN IVA (la base imponible de esa línea, no el total de la línea ni el precio con IVA incluido). Null si no se indica.
  - "unidad": texto breve de unidad si aparece (ej: "ud", "caja", "L", "kg"); si no aparece, cadena vacía.
  - "id_linea_sugerida": el "id_linea" de la lista de arriba que corresponde a este artículo, aunque el nombre comercial o la marca sean muy distintos del nombre genérico interno — usa tu conocimiento de productos de laboratorio (marcas, sinónimos, nombres técnicos equivalentes) para reconocerlo. Si no corresponde a ninguna línea de la lista, o tienes dudas razonables, pon null — mejor no emparejar que emparejar mal.
  - "confianza_match": tu confianza en ese emparejamiento, de 0 a 1 (0 si id_linea_sugerida es null).
- "cargo_extra": si el documento tiene, aparte del listado de artículos, algún cargo que NO es un artículo del inventario ni el IVA — transporte, portes, envasado especial, hielo, tasas de manipulación, etc. — inclúyelo aquí como {"concepto": "...", "importe": número sin IVA}. Si hay varios, súmalos en uno solo con un concepto conjunto. Si no hay ninguno, "cargo_extra" debe ser null. Nunca metas estos cargos dentro de "items".
- No inventes artículos que no estén en el documento.`;
}

const ESQUEMA_RESPUESTA = {
  type: "OBJECT",
  properties: {
    items: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          material: { type: "STRING" },
          cantidad: { type: "NUMBER", nullable: true },
          precio_unitario: { type: "NUMBER", nullable: true },
          unidad: { type: "STRING" },
          id_linea_sugerida: { type: "STRING", nullable: true },
          confianza_match: { type: "NUMBER" },
        },
        required: ["material"],
      },
    },
    cargo_extra: {
      type: "OBJECT",
      nullable: true,
      properties: {
        concepto: { type: "STRING" },
        importe: { type: "NUMBER" },
      },
    },
  },
  required: ["items"],
};

// Nunca se fía a ciegas del id_linea_sugerida del modelo: descarta
// cualquiera que no exista de verdad entre las líneas del pedido, y si dos
// artículos apuntan a la misma línea se queda solo con el de mayor
// confianza (el otro pasa a sin_match, no se descarta la información).
function resolverMatches(items: any[], lineas: any[]) {
  const porId = new Map(lineas.map((l) => [l.id_linea, l]));
  const mejorPorLinea = new Map<string, any>();

  for (const item of items) {
    const idSugerido = item.id_linea_sugerida;
    if (!idSugerido || !porId.has(idSugerido)) continue;
    const actual = mejorPorLinea.get(idSugerido);
    const confianza = typeof item.confianza_match === "number" ? item.confianza_match : 0;
    if (!actual || confianza > actual.confianza) mejorPorLinea.set(idSugerido, { item, confianza });
  }

  const itemsEmparejados = new Set(Array.from(mejorPorLinea.values()).map((v) => v.item));
  const matches = Array.from(mejorPorLinea.entries()).map(([idLinea, { item, confianza }]) => {
    const linea = porId.get(idLinea);
    return {
      id_linea: idLinea,
      material_linea: linea.material,
      cantidad_pedida: linea.cantidad_pedida,
      cantidad_recibida: linea.cantidad_recibida,
      item_detectado: item,
      confianza: Math.round(confianza * 100) / 100,
    };
  });

  const sinMatch = items.filter((i) => !itemsEmparejados.has(i));
  return { matches, sinMatch };
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

  const { error: authError, supabaseAdmin } = await requireAdminOrGestor(req);
  if (authError) return authError;

  const idDocumento = String(body.id_documento || "").trim();
  if (!idDocumento) return jsonError("id_documento es obligatorio", 400);

  const geminiKey = Deno.env.get("GEMINI_API_KEY");
  if (!geminiKey) return jsonError("Falta configurar GEMINI_API_KEY en los secretos del proyecto", 500);

  const { data: doc } = await supabaseAdmin.from("documentos_proveedor").select("*").eq("id_documento", idDocumento).maybeSingle();
  if (!doc) return jsonError(`No se encontró el documento "${idDocumento}"`, 404);

  const { data: lineas } = await supabaseAdmin.from("lineas_pedido").select("id_linea, material, cantidad_pedida, cantidad_recibida").eq("pedido", doc.pedido);

  const { data: archivo, error: descargaErr } = await supabaseAdmin.storage.from("documentos").download(doc.path);
  if (descargaErr || !archivo) return jsonError(`No se pudo leer el archivo: ${descargaErr?.message || "desconocido"}`, 400);

  const base64 = arrayBufferABase64(await archivo.arrayBuffer());
  const mimeType = mimeDesdeNombre(doc.nombre_archivo);
  const prompt = construirPrompt(lineas || []);

  let respuestaGemini: Response;
  try {
    respuestaGemini = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODELO}:generateContent?key=${geminiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }, { inline_data: { mime_type: mimeType, data: base64 } }] }],
          generationConfig: {
            responseMimeType: "application/json", responseSchema: ESQUEMA_RESPUESTA, temperature: 0.1,
            thinkingConfig: { thinkingLevel: "low" }, // extracción + emparejamiento simple, no hace falta razonamiento largo — ahorra tokens/coste
          },
        }),
      },
    );
  } catch (e) {
    return jsonError(`No se pudo contactar con Gemini: ${(e as Error).message}`, 502);
  }

  if (!respuestaGemini.ok) {
    const detalle = await respuestaGemini.text().catch(() => "");
    return jsonError(`Gemini devolvió un error (${respuestaGemini.status}): ${detalle.slice(0, 300)}`, 502);
  }

  const dataGemini = await respuestaGemini.json();
  const textoJson = dataGemini?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!textoJson) return jsonError("Gemini no devolvió contenido interpretable", 502);

  let extraido: { items?: any[]; cargo_extra?: { concepto: string; importe: number } | null };
  try {
    extraido = JSON.parse(textoJson);
  } catch {
    return jsonError("La respuesta de Gemini no es JSON válido", 502);
  }

  const items = Array.isArray(extraido.items) ? extraido.items : [];
  const { matches, sinMatch } = resolverMatches(items, lineas || []);

  const resultado = {
    items,
    matches,
    sin_match: sinMatch,
    cargo_extra: extraido.cargo_extra || null,
    generado_en: new Date().toISOString(),
  };

  const { error: updateErr } = await supabaseAdmin
    .from("documentos_proveedor")
    .update({ datos_extraidos: resultado, extraido_en: new Date().toISOString() })
    .eq("id_documento", idDocumento);
  if (updateErr) return jsonError(`No se pudo guardar el resultado: ${updateErr.message}`, 400);

  return jsonOk({ resultado });
});
