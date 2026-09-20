// Inventario colaborativo — fase B: alta de material fungible no catalogado.
//
// El principio: quien propone NO escribe el nombre del material. Rellena la
// categoría, el tipo de producto y los atributos que importan de ese tipo
// (ficha `atributos_material`), y el nombre se COMPONE aquí. Así no entra el
// nombre comercial en lugar del genérico, que es el problema que originó todo
// esto. Lo que pone literalmente en el bote va a `texto_etiqueta`, que es
// información útil pero no es el nombre.
//
// Tres ayudas antes de que la propuesta llegue al profesorado:
//   1. Nombre compuesto server-side, siempre con la misma convención.
//   2. Antiduplicados contra el catálogo (buscarMaterialParecido).
//   3. Lectura de la foto de la etiqueta con Gemini, PIDIENDO EXACTAMENTE los
//      campos de la ficha — no una descripción libre. Lo que no se vea en la
//      etiqueta vuelve como null: nunca se deduce.
//
// Roles: "leer_etiqueta" y "crear" los puede hacer cualquier sesión válida
// (alumnado incluido); aceptar/fusionar/rechazar es staff, y `revisado_por` lo
// escribe el servidor con el nombre de quien valida.
import {
  requireStaff, requireValidSession, identificarUsuario, ES_STAFF, firmaAlumnado, nombreCorto,
  jsonError, jsonOk, handleCorsPreflight,
} from "../_shared/auth.ts";
import { componerNombreMaterial, buscarMaterialParecido, claveNombre } from "../_shared/material.ts";

const GEMINI_MODELO = "gemini-3.6-flash";

function genId(prefix: string): string {
  return prefix + Date.now().toString(36).toUpperCase().slice(-6) + Math.floor(Math.random() * 36).toString(36).toUpperCase();
}

const numField = (v: unknown) => (v === "" || v === null || v === undefined) ? null : Number(v);
const strField = (v: unknown) => (v === "" || v === null || v === undefined) ? null : String(v);

async function getFicha(supabaseAdmin: any, categoria: string, tipoBase: string | null) {
  if (!tipoBase) return null;
  const { data } = await supabaseAdmin.from("atributos_material")
    .select("*").eq("categoria", categoria).eq("tipo_base", tipoBase).maybeSingle();
  return data || null;
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

// ── Lectura de la etiqueta ────────────────────────────────────────────
// El esquema de respuesta se construye desde la ficha: Gemini devuelve
// exactamente esas claves y nada más. Una etiqueta tiene treinta cosas
// (marca, CE, lote, REF, código de barras, pictogramas); pedir una
// descripción libre devuelve ruido, pedir claves fijas devuelve datos.
function esquemaDesdeFicha(ficha: any) {
  const props: Record<string, unknown> = {
    texto_etiqueta: { type: "STRING" },
    atributos_no_visibles: { type: "ARRAY", items: { type: "STRING" } },
  };
  for (const a of (ficha?.atributos || [])) {
    props[a.clave] = a.tipo === "numero" ? { type: "NUMBER" } : { type: "STRING" };
  }
  return { type: "OBJECT", properties: props };
}

function promptDesdeFicha(ficha: any, categoria: string) {
  const lineas = (ficha?.atributos || []).map((a: any) => {
    const partes = [`- "${a.clave}" (${a.etiqueta})`];
    if (a.tipo === "numero") partes.push(`número${a.unidad ? ` en ${a.unidad}` : ""}, solo la cifra`);
    else if (a.tipo === "booleano") partes.push(`responde "si" o "no"`);
    else if (a.tipo === "opcion") partes.push(`uno de: ${(a.opciones || []).join(", ")}`);
    else partes.push("texto breve");
    return partes.join(": ");
  });

  return `Eres un asistente que lee la ETIQUETA de un producto de laboratorio clínico a partir de una foto.

El producto es de la categoría "${categoria}"${ficha?.tipo_base ? `, del tipo "${ficha.tipo_base}"` : ""}.

Devuelve SOLO un objeto JSON con estos campos:
${lineas.length ? lineas.join("\n") : "- (este tipo no tiene atributos que extraer)"}
- "texto_etiqueta": el nombre comercial y la referencia tal como aparecen escritos en el bote, literalmente, sin interpretarlos.
- "atributos_no_visibles": lista con las claves de arriba cuyo valor NO se ve en la etiqueta.

REGLAS IMPORTANTES:
- Si un dato no se ve claramente en la foto, devuélvelo como null Y añade su clave a "atributos_no_visibles". NO lo deduzcas, no lo estimes y no lo completes por lo que sea habitual en ese producto. Es preferible un hueco a un dato inventado.
- Para las cantidades, devuelve solo el número, sin la unidad.
- No traduzcas ni "corrijas" el texto de la etiqueta en "texto_etiqueta": cópialo tal cual.`;
}

async function leerEtiquetaConGemini(geminiKey: string, base64: string, mimeType: string, ficha: any, categoria: string) {
  const respuesta = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODELO}:generateContent?key=${geminiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          role: "user",
          parts: [
            { text: promptDesdeFicha(ficha, categoria) },
            { inline_data: { mime_type: mimeType, data: base64 } },
          ],
        }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: esquemaDesdeFicha(ficha),
          temperature: 0.1,
          thinkingConfig: { thinkingLevel: "low" },
        },
      }),
      signal: AbortSignal.timeout(22000),
    },
  );
  if (!respuesta.ok) {
    const detalle = await respuesta.text().catch(() => "");
    throw new Error(`Gemini devolvió un error (${respuesta.status}): ${detalle.slice(0, 200)}`);
  }
  const data = await respuesta.json();
  const texto = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!texto) throw new Error("Gemini no devolvió contenido interpretable");
  return JSON.parse(texto);
}

/**
 * Compara lo que escribió la persona con lo que se lee en la etiqueta.
 * Se saltan las claves de `atributos_no_visibles`: el esquema de respuesta obliga
 * a Gemini a devolver un valor de cada tipo, así que ahí vienen ceros y "no" que
 * no están en la etiqueta. Compararlos daría discrepancias fantasma.
 */
function avisosDiscrepancia(ficha: any, escritos: Record<string, unknown>, leidos: Record<string, unknown>) {
  const avisos: string[] = [];
  const noVisibles = new Set(
    Array.isArray(leidos?.atributos_no_visibles) ? leidos.atributos_no_visibles.map(String) : [],
  );
  for (const a of (ficha?.atributos || [])) {
    if (noVisibles.has(a.clave)) continue;
    const mio = escritos?.[a.clave];
    const suyo = leidos?.[a.clave];
    if (mio === null || mio === undefined || mio === "") continue;
    if (suyo === null || suyo === undefined || suyo === "") continue;
    const iguales = a.tipo === "numero"
      ? Number(mio) === Number(suyo)
      : claveNombre(String(mio)) === claveNombre(String(suyo));
    if (!iguales) avisos.push(`${a.etiqueta}: se escribió "${mio}" y en la etiqueta pone "${suyo}"`);
  }
  return avisos.join(" · ");
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

  // ── Leer la etiqueta: abierto a cualquier sesión ────────────────────
  if (accion === "leer_etiqueta") {
    const { error: authError, supabaseAdmin } = await requireValidSession(req);
    if (authError) return authError;

    const geminiKey = Deno.env.get("GEMINI_API_KEY");
    if (!geminiKey) return jsonError("Falta configurar GEMINI_API_KEY en el servidor", 500);

    const fotoPath = String(body.foto_path || "").trim();
    if (!fotoPath) return jsonError("foto_path es obligatorio", 400);
    const categoria = String(body.categoria || "").trim();
    const ficha = await getFicha(supabaseAdmin, categoria, strField(body.tipo_base));

    const { data: archivo, error: descargaErr } = await supabaseAdmin.storage.from("documentos").download(fotoPath);
    if (descargaErr || !archivo) return jsonError("No se pudo leer la foto subida", 404);
    const base64 = arrayBufferABase64(await archivo.arrayBuffer());
    const mimeType = archivo.type || "image/jpeg";

    // La lectura es una ayuda, no un requisito: si Gemini falla (503 por
    // demanda, timeout...), se devuelve el fallo sin romper el flujo. Quien
    // propone puede rellenar los campos a mano igual.
    try {
      const leido = await leerEtiquetaConGemini(geminiKey, base64, mimeType, ficha, categoria);
      return jsonOk({ leido, ficha });
    } catch (e) {
      return jsonOk({ leido: null, ficha, error_ia: String((e as Error).message || e) });
    }
  }

  // ── Crear la propuesta: abierto a cualquier sesión ──────────────────
  if (accion === "crear") {
    const { error: authError, email, supabaseAdmin } = await requireValidSession(req);
    if (authError) return authError;
    const { nombre, rol } = await identificarUsuario(supabaseAdmin, email);
    // Igual que en propuestas de ubicación: en la cola consta el grupo
    // ("1º CS LCB"), no una persona. Ver docs/proteccion-datos.md.
    const firma = ES_STAFF(rol) ? nombreCorto(nombre) : firmaAlumnado(email, nombre);

    const categoria = String(body.categoria || "").trim();
    if (!categoria) return jsonError("La categoría es obligatoria", 400);
    const fotoPath = strField(body.foto_path);
    if (!fotoPath) return jsonError("La foto de la etiqueta es obligatoria", 400);

    const tipoBase = strField(body.tipo_base);
    const ficha = await getFicha(supabaseAdmin, categoria, tipoBase);
    const atributos = (body.atributos && typeof body.atributos === "object")
      ? body.atributos as Record<string, unknown> : {};

    // Obligatorios de la ficha
    for (const a of (ficha?.atributos || [])) {
      if (!a.obligatorio) continue;
      const v = atributos[a.clave];
      if (v === null || v === undefined || v === "") {
        return jsonError(`Falta rellenar "${a.etiqueta}"`, 400);
      }
    }

    const nombreBase = String(body.nombre_base || ficha?.nombre_base || "").trim();
    if (!nombreBase) return jsonError("Falta el nombre base del producto", 400);
    const nombreGenerado = componerNombreMaterial(nombreBase, ficha?.atributos || [], atributos);

    // Antiduplicados: ¿esto ya existe en el catálogo?
    const { data: materiales } = await supabaseAdmin.from("material").select("id_material, nombre");
    const parecido = buscarMaterialParecido(nombreGenerado, materiales || []);

    // Discrepancias con lo leído de la etiqueta, si el cliente lo trae.
    const leidos = (body.ia_extraido && typeof body.ia_extraido === "object")
      ? body.ia_extraido as Record<string, unknown> : null;
    const avisos = leidos ? avisosDiscrepancia(ficha, atributos, leidos) : "";

    const datos = {
      id_propuesta: genId("PMAT"),
      categoria, tipo_base: tipoBase, nombre_base: nombreBase,
      atributos, texto_etiqueta: strField(body.texto_etiqueta),
      nombre_generado: nombreGenerado,
      unidad: strField(body.unidad),
      cantidad: numField(body.cantidad),
      id_ubicacion: strField(body.id_ubicacion),
      foto_path: fotoPath,
      id_material_sugerido: parecido?.id_material || null,
      ia_extraido: leidos,
      ia_avisos: avisos || null,
      propuesto_por: firma,
      email_propuesto_por: email,
      observaciones: strField(body.observaciones),
      estado: "pendiente",
    };
    const { data, error } = await supabaseAdmin.from("propuestas_material").insert(datos).select().single();
    if (error) return jsonError(`No se pudo guardar la propuesta: ${error.message}`, 400);

    return jsonOk({
      propuesta: data,
      nombre_generado: nombreGenerado,
      ya_existe: parecido ? { id_material: parecido.id_material, nombre: parecido.nombre } : null,
      es_staff: ES_STAFF(rol),
    });
  }

  // ── Resolver la propuesta: solo staff ───────────────────────────────
  if (accion === "aceptar" || accion === "fusionar" || accion === "rechazar") {
    const { error: authError, user, supabaseAdmin } = await requireStaff(req);
    if (authError) return authError;
    const revisor = nombreCorto(user.nombre) || user.email;
    const ahora = new Date().toISOString();

    const idPropuesta = String(body.id_propuesta || "").trim();
    if (!idPropuesta) return jsonError("id_propuesta es obligatorio", 400);
    const { data: p } = await supabaseAdmin.from("propuestas_material")
      .select("*").eq("id_propuesta", idPropuesta).maybeSingle();
    if (!p) return jsonError("Propuesta no encontrada", 404);
    if (p.estado !== "pendiente") return jsonError("Esta propuesta ya está resuelta", 400);

    if (accion === "rechazar") {
      const { data } = await supabaseAdmin.from("propuestas_material")
        .update({
          estado: "rechazada", revisado_por: revisor, fecha_revision: ahora,
          notas_revision: strField(body.notas_revision),
        }).eq("id_propuesta", idPropuesta).select().single();
      return jsonOk({ propuesta: data, revisado_por: revisor });
    }

    if (accion === "fusionar") {
      // No era nuevo: ya existía. No se crea nada; si se contó una cantidad,
      // se deja anotada para que se revise como ajuste de stock, no se aplica
      // sola (el stock es dato de gestión, no de una propuesta).
      const idMaterial = String(body.id_material || p.id_material_sugerido || "").trim();
      if (!idMaterial) return jsonError("Indica con qué material se fusiona", 400);
      const { data: mat } = await supabaseAdmin.from("material")
        .select("id_material, nombre").eq("id_material", idMaterial).maybeSingle();
      if (!mat) return jsonError("El material con el que fusionar no existe", 404);

      const nota = [strField(body.notas_revision), `Ya existía como "${mat.nombre}"`]
        .filter(Boolean).join(" · ");
      const { data } = await supabaseAdmin.from("propuestas_material")
        .update({
          estado: "fusionada", revisado_por: revisor, fecha_revision: ahora,
          notas_revision: nota, id_material_creado: idMaterial,
        }).eq("id_propuesta", idPropuesta).select().single();
      return jsonOk({ propuesta: data, material: mat, revisado_por: revisor });
    }

    // ── aceptar: se crea el material ──────────────────────────────────
    // El nombre puede venir corregido por quien valida; si no, el compuesto.
    const nombreFinal = String(body.nombre || p.nombre_generado || "").trim();
    if (!nombreFinal) return jsonError("El material necesita un nombre", 400);
    const unidad = String(body.unidad || p.unidad || "").trim();
    if (!unidad) return jsonError("El material necesita una unidad", 400);

    // ID con el mismo criterio que generarIdMaterial() del cliente: 3 letras
    // de la primera palabra útil + número correlativo.
    const palabras = nombreFinal.split(/[\s/,]+/).filter((x) => x.length > 1);
    const prefijo = (palabras[0] || nombreFinal).slice(0, 3).toUpperCase()
      .normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Z]/g, "X");
    const { data: existentes } = await supabaseAdmin.from("material")
      .select("id_material").like("id_material", `${prefijo}-%`);
    const siguiente = (existentes || [])
      .map((m: any) => parseInt(String(m.id_material).split("-")[1]) || 0)
      .reduce((a: number, b: number) => Math.max(a, b), 0) + 1;
    const idMaterial = `${prefijo}-${String(siguiente).padStart(2, "0")}`;

    const cantidad = Number(p.cantidad) || 0;
    const { data: mat, error: errMat } = await supabaseAdmin.from("material").insert({
      id_material: idMaterial,
      nombre: nombreFinal,
      categoria: p.categoria,
      unidad,
      atributos: p.atributos || {},
      ubicacion: p.id_ubicacion,
      stock_actual: cantidad,
      stock_minimo: 0,
      stock_optimo: 0,
      observaciones: [p.texto_etiqueta ? `En la etiqueta: ${p.texto_etiqueta}` : null, p.observaciones]
        .filter(Boolean).join("\n") || null,
      gestion_automatica: false,
    }).select().single();
    if (errMat) return jsonError(`No se pudo crear el material: ${errMat.message}`, 400);

    // Lote en la ubicación donde se contó, si la hay.
    if (p.id_ubicacion) {
      await supabaseAdmin.from("material_ubicaciones").insert({
        id: genId("LU"), id_material: idMaterial, id_ubicacion: p.id_ubicacion,
        stock_local: cantidad, stock_minimo_local: 0, stock_optimo_local: 0,
      });
    }

    // Entrada en el historial: así el material nace con su fecha de alta y
    // encaja con la "antigüedad del stock" del resto del inventario.
    if (cantidad > 0) {
      await supabaseAdmin.from("movimientos").insert({
        id_movimiento: genId("MOV"), material: nombreFinal, id_material: idMaterial,
        tipo: "Entrada", cantidad, usuario: revisor,
        motivo: `Alta por inventario del alumnado (propuso: ${p.propuesto_por || "—"})`,
      });
    }

    const { data: prop } = await supabaseAdmin.from("propuestas_material")
      .update({
        estado: "aceptada", revisado_por: revisor, fecha_revision: ahora,
        notas_revision: strField(body.notas_revision), id_material_creado: idMaterial,
      }).eq("id_propuesta", idPropuesta).select().single();

    return jsonOk({ propuesta: prop, material: mat, revisado_por: revisor });
  }

  return jsonError("accion no reconocida", 400);
});
