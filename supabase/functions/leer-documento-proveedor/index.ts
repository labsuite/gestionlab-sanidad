// Lee con IA (Gemini) la factura subida por el proveedor a través del link
// público (ver pedido-publico; solo facturas, no presupuestos — el precio de
// un presupuesto no es firme) y extrae sus líneas de artículo, emparejándolas
// contra las líneas ya existentes en el pedido
// (lineas_pedido). Solo Admin/Gestor puede disparar la lectura, y solo se
// guarda el resultado; no toca cantidad_recibida/precio_unitario de ninguna
// línea — eso lo hace el Gestor a mano en el modal de revisión, precargado
// con lo detectado (gestionar-linea-pedido ya cubre esas escrituras).
//
// DOS llamadas a Gemini, no una — probado a mano contra una factura real
// (2026-08-19): pedirle en una sola llamada que extraiga del PDF Y empareje
// contra las líneas del pedido a la vez hacía que el modelo "pensara en voz
// alta" dentro de un campo string de la respuesta (p.ej. el campo "unidad"
// del primer artículo se llenaba con un vuelco de razonamiento tipo
// "Correct parse: 1. ... 2. ..." en vez del texto de unidad), rompiendo el
// JSON y dejando solo 1 de 14 artículos. Separando en dos llamadas simples
// —(1) extraer del PDF, sin matching; (2) emparejar los nombres ya
// extraídos contra la lista de líneas, sin el PDF— cada llamada es un
// problema de una sola cosa y Gemini responde limpio las dos veces. El
// emparejamiento no es comparación de texto local: facturas reales usan
// nombre comercial/marca muy distinto del nombre genérico interno (p.ej.
// "Aquatex 50 mL" = "Medio de montaje para muestras hidratadas") — hace
// falta el conocimiento de producto del modelo, no un umbral de similitud.
// El servidor nunca se fía a ciegas: resolverMatches descarta cualquier
// id_linea que no exista de verdad entre las líneas del pedido y resuelve
// duplicados si el modelo asigna la misma línea a dos artículos.
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

async function llamarGemini(geminiKey: string, parts: unknown[], schema: unknown) {
  const respuesta = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODELO}:generateContent?key=${geminiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts }],
        generationConfig: {
          responseMimeType: "application/json", responseSchema: schema, temperature: 0.1,
          thinkingConfig: { thinkingLevel: "low" }, // tareas simples y ya separadas — no hace falta razonamiento largo, ahorra tokens/coste
        },
      }),
    },
  );
  if (!respuesta.ok) {
    const detalle = await respuesta.text().catch(() => "");
    throw new Error(`Gemini devolvió un error (${respuesta.status}): ${detalle.slice(0, 300)}`);
  }
  const data = await respuesta.json();
  const texto = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!texto) throw new Error("Gemini no devolvió contenido interpretable");
  return JSON.parse(texto);
}

// ── Paso 1: extracción pura del documento, sin matching ────────────────
const PROMPT_EXTRACCION = `Eres un asistente que extrae las líneas de artículo de una factura de un proveedor de material de laboratorio clínico/sanitario.

Devuelve SOLO un objeto JSON. Reglas:
- "items": un array con un objeto por cada línea de artículo del documento (reactivos, material fungible, equipos, kits...). Ignora completamente cabeceras, totales, subtotales y el IVA — nunca los devuelvas como si fueran un artículo.
  - "material": el nombre del artículo tal como figura en el documento (incluye referencia/SKU si aparece), sin inventar ni completar información que no esté.
  - "cantidad": número de unidades de esa línea tal como lo indica la factura (no lo recalcules), o null si no aparece.
  - "precio_unitario": el precio POR UNIDAD SIN IVA (la base imponible de esa línea, no el total de la línea ni el precio con IVA incluido). Null si no se indica.
  - "unidad": texto breve de unidad si aparece (ej: "ud", "caja", "L", "kg"); si no aparece, cadena vacía.
  - "unidades_por_envase": si el propio nombre/descripción del artículo indica cuántas unidades trae cada paquete/caja/envase (ej. "pack 10 uds", "c/100 uds", "c/480 uds"), extrae ese número tal cual aparece escrito. Si el texto no menciona ningún tamaño de envase, pon null. No hagas ningún cálculo ni intentes adivinarlo — solo repórtalo si está escrito explícitamente.
- "cargo_extra": si el documento tiene, aparte del listado de artículos, algún cargo que NO es un artículo del inventario ni el IVA — transporte, portes, envasado especial, hielo, tasas de manipulación, etc. — inclúyelo aquí como {"concepto": "...", "importe": número sin IVA}. Si hay varios, súmalos en uno solo con un concepto conjunto. Si no hay ninguno, "cargo_extra" debe ser null. Nunca metas estos cargos dentro de "items".
- No inventes artículos que no estén en el documento.`;

const ESQUEMA_EXTRACCION = {
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
          unidades_por_envase: { type: "NUMBER", nullable: true },
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

// ── Paso 2: emparejar los nombres ya extraídos contra las líneas del pedido ──
function construirPromptMatching(
  items: { material: string }[],
  lineas: { id_linea: string; material: string; cantidad_pedida: number | null }[],
): string {
  const listaLineas = lineas.map((l) => `- id_linea "${l.id_linea}": ${l.material} (cantidad pedida: ${l.cantidad_pedida ?? "?"})`).join("\n");
  const listaItems = items.map((it, idx) => `${idx}. ${it.material}`).join("\n");

  return `Tienes una lista de artículos detectados en una factura de proveedor de laboratorio, numerados, y una lista de líneas de un pedido interno con su id.

Líneas del pedido interno:
${listaLineas}

Artículos detectados en la factura:
${listaItems}

Para cada artículo (por su índice numérico), indica qué id_linea del pedido interno le corresponde, si alguna. Usa tu conocimiento de productos de laboratorio: marcas comerciales, sinónimos y nombres técnicos equivalentes pueden ser el mismo producto aunque el texto no se parezca (ejemplo: "Aquatex" es un medio de montaje acuoso; "Calcofluor White Stain" es una tinción de blanco de calcoflúor). Si tienes dudas razonables o no hay ninguna línea que corresponda, usa null — mejor no emparejar que emparejar mal. Si dos artículos podrían corresponder a la misma línea, quédate solo con el que tengas más confianza y deja el otro en null.

Devuelve SOLO un array JSON, uno por artículo en el mismo orden, con: indice (el número del artículo), id_linea (el id o null), confianza (0 a 1, 0 si id_linea es null).`;
}

const ESQUEMA_MATCHING = {
  type: "ARRAY",
  items: {
    type: "OBJECT",
    properties: {
      indice: { type: "INTEGER" },
      id_linea: { type: "STRING", nullable: true },
      confianza: { type: "NUMBER" },
    },
    required: ["indice", "confianza"],
  },
};

// Nunca se fía a ciegas de lo que devuelva Gemini: descarta cualquier
// id_linea que no exista de verdad entre las líneas del pedido, y si dos
// artículos apuntan a la misma línea se queda solo con el de mayor
// confianza (el otro pasa a sin_match, no se descarta la información).
function resolverMatches(
  items: any[],
  asignaciones: { indice: number; id_linea: string | null; confianza: number }[],
  lineas: any[],
) {
  const porId = new Map(lineas.map((l) => [l.id_linea, l]));
  const mejorPorLinea = new Map<string, { itemIdx: number; confianza: number }>();

  for (const a of asignaciones) {
    if (a.id_linea == null || !porId.has(a.id_linea) || a.indice == null || !items[a.indice]) continue;
    const actual = mejorPorLinea.get(a.id_linea);
    if (!actual || a.confianza > actual.confianza) mejorPorLinea.set(a.id_linea, { itemIdx: a.indice, confianza: a.confianza });
  }

  const indicesEmparejados = new Set(Array.from(mejorPorLinea.values()).map((v) => v.itemIdx));
  const matches = Array.from(mejorPorLinea.entries()).map(([idLinea, { itemIdx, confianza }]) => {
    const linea = porId.get(idLinea);
    return {
      id_linea: idLinea,
      material_linea: linea.material,
      cantidad_pedida: linea.cantidad_pedida,
      cantidad_recibida: linea.cantidad_recibida,
      item_detectado: items[itemIdx],
      confianza: Math.round(confianza * 100) / 100,
    };
  });

  const sinMatch = items.filter((_, idx) => !indicesEmparejados.has(idx));
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

  let extraido: { items?: any[]; cargo_extra?: { concepto: string; importe: number } | null };
  try {
    extraido = await llamarGemini(
      geminiKey,
      [{ text: PROMPT_EXTRACCION }, { inline_data: { mime_type: mimeType, data: base64 } }],
      ESQUEMA_EXTRACCION,
    );
  } catch (e) {
    return jsonError(`Error extrayendo el documento: ${(e as Error).message}`, 502);
  }

  const items = Array.isArray(extraido.items) ? extraido.items : [];

  let matches: any[] = [];
  let sinMatch = items;
  if (items.length && (lineas || []).length) {
    try {
      const asignaciones = await llamarGemini(
        geminiKey,
        [{ text: construirPromptMatching(items, lineas || []) }],
        ESQUEMA_MATCHING,
      );
      ({ matches, sinMatch } = resolverMatches(items, Array.isArray(asignaciones) ? asignaciones : [], lineas || []));
    } catch {
      // Si falla el emparejamiento, no perdemos la extracción — se guarda
      // todo como sin_match y el Gestor puede aplicarlo a mano igualmente.
    }
  }

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
