// Lee con IA (Gemini) un documento subido por el proveedor a través del link
// público (ver pedido-publico) — factura o presupuesto — y extrae sus líneas
// de artículo, emparejándolas contra las líneas ya existentes en el pedido
// (lineas_pedido). Solo Admin/Gestor puede disparar la lectura, y solo se
// guarda el resultado; no toca cantidad_recibida/precio_unitario de ninguna
// línea — eso lo hace el Gestor a mano en el modal de revisión, precargado
// con lo detectado (gestionar-linea-pedido ya cubre esas escrituras).
import { requireAdminOrGestor, jsonError, jsonOk, handleCorsPreflight } from "../_shared/auth.ts";

const GEMINI_MODELO = "gemini-1.5-flash"; // no usar pro/2.0 en tier gratuito (ver CLAUDE.md)

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

const PROMPT = `Eres un asistente que extrae las líneas de artículo de una factura o presupuesto de un proveedor de material de laboratorio clínico/sanitario.

Devuelve SOLO un array JSON con un objeto por cada línea de artículo del documento (reactivos, material fungible, equipos, kits...). Reglas:
- Ignora completamente cabeceras, totales, subtotales, portes/transporte y el IVA — nunca los devuelvas como si fueran un artículo.
- "precio_unitario" es el precio POR UNIDAD SIN IVA (la base imponible de esa línea, no el total de la línea ni el precio con IVA incluido). Si el documento no lo indica, pon null.
- "cantidad" es el número de unidades de esa línea. Si no aparece, pon null.
- "unidad" es el texto breve de unidad si aparece (ej: "ud", "caja", "L", "kg"); si no aparece, cadena vacía.
- "material" es el nombre del artículo tal como figura en el documento, sin inventar ni completar información que no esté.
- Si además del listado de artículos el documento tiene un cargo aparte por transporte/portes/manipulación (no IVA, no descuento), inclúyelo en el campo "cargo_extra" del nivel superior como {"concepto": "...", "importe": número sin IVA}. Si no hay ninguno, "cargo_extra" debe ser null.
- No inventes artículos que no estén en el documento.`;

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

function normalizar(s: string): string {
  return (s || "")
    .toLowerCase()
    .normalize("NFD").replace(new RegExp("[\\u0300-\\u036f]", "g"), "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function similitud(a: string, b: string): number {
  const na = normalizar(a), nb = normalizar(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) return 0.85;
  const wa = new Set(na.split(" "));
  const wb = new Set(nb.split(" "));
  let comunes = 0;
  for (const w of wa) if (wb.has(w)) comunes++;
  return comunes / Math.max(wa.size, wb.size);
}

const UMBRAL_MATCH = 0.4;

// Empareja cada item detectado con, como mucho, una línea del pedido (y
// viceversa) — greedy por similitud descendente, nunca crea líneas nuevas.
function emparejar(items: any[], lineas: any[]) {
  const pares: { item: any; linea: any; score: number }[] = [];
  for (const item of items) {
    for (const linea of lineas) {
      const score = similitud(item.material || "", linea.material || "");
      if (score >= UMBRAL_MATCH) pares.push({ item, linea, score });
    }
  }
  pares.sort((a, b) => b.score - a.score);

  const itemsUsados = new Set<any>();
  const lineasUsadas = new Set<string>();
  const matches: any[] = [];
  for (const par of pares) {
    if (itemsUsados.has(par.item) || lineasUsadas.has(par.linea.id_linea)) continue;
    itemsUsados.add(par.item);
    lineasUsadas.add(par.linea.id_linea);
    matches.push({
      id_linea: par.linea.id_linea,
      material_linea: par.linea.material,
      cantidad_pedida: par.linea.cantidad_pedida,
      cantidad_recibida: par.linea.cantidad_recibida,
      item_detectado: par.item,
      confianza: Math.round(par.score * 100) / 100,
    });
  }
  const sinMatch = items.filter((i) => !itemsUsados.has(i));
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

  const { data: archivo, error: descargaErr } = await supabaseAdmin.storage.from("documentos").download(doc.path);
  if (descargaErr || !archivo) return jsonError(`No se pudo leer el archivo: ${descargaErr?.message || "desconocido"}`, 400);

  const base64 = arrayBufferABase64(await archivo.arrayBuffer());
  const mimeType = mimeDesdeNombre(doc.nombre_archivo);

  let respuestaGemini: Response;
  try {
    respuestaGemini = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODELO}:generateContent?key=${geminiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: PROMPT }, { inline_data: { mime_type: mimeType, data: base64 } }] }],
          generationConfig: { responseMimeType: "application/json", responseSchema: ESQUEMA_RESPUESTA, temperature: 0.1 },
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
  const { data: lineas } = await supabaseAdmin.from("lineas_pedido").select("id_linea, material, cantidad_pedida, cantidad_recibida").eq("pedido", doc.pedido);
  const { matches, sinMatch } = emparejar(items, lineas || []);

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
