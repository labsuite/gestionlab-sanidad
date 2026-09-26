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

// ── Lotes y stock ─────────────────────────────────────────────────────
// Mismo modelo que gestionar-material: el stock de un material con lotes es
// SIEMPRE la suma de sus lotes; `material.stock_actual` es solo el espejo.
async function lotesDe(supabaseAdmin: any, idMaterial: string) {
  const { data } = await supabaseAdmin.from("material_ubicaciones")
    .select("*").eq("id_material", idMaterial);
  return data || [];
}

async function sincronizarStock(supabaseAdmin: any, idMaterial: string) {
  const lotes = await lotesDe(supabaseAdmin, idMaterial);
  if (!lotes.length) return;   // ítem legacy: su stock_actual se lleva a mano
  const total = lotes.reduce((s: number, l: any) => s + (Number(l.stock_local) || 0), 0);
  await supabaseAdmin.from("material").update({ stock_actual: total }).eq("id_material", idMaterial);
}

/**
 * Un ítem "legacy" (sin ningún lote) lleva su stock en `material.stock_actual`.
 * En cuanto se le cuelga un lote, el stock pasa a ser la suma de los lotes — así
 * que lo que había antes hay que materializarlo primero como bote en su propia
 * ubicación, o se pierde al sincronizar. Devuelve un mensaje de error si no se
 * puede (no hay dónde ponerlo), o null si todo listo.
 */
async function asegurarLoteLegacy(supabaseAdmin: any, mat: any): Promise<string | null> {
  const lotes = await lotesDe(supabaseAdmin, mat.id_material);
  if (lotes.length) return null;
  const stockPrevio = Number(mat.stock_actual) || 0;
  if (stockPrevio <= 0) return null;   // nada que conservar
  if (!mat.ubicacion) {
    return `"${mat.nombre}" tiene ${stockPrevio} de stock pero ninguna ubicación asignada. ` +
      `Ponle su sitio desde el inventario antes de añadirle otro bote, o se perdería ese stock.`;
  }
  const { error } = await supabaseAdmin.from("material_ubicaciones").insert({
    id: genId("LU"), id_material: mat.id_material, id_ubicacion: mat.ubicacion,
    stock_local: stockPrevio, stock_minimo_local: Number(mat.stock_minimo) || 0,
    stock_optimo_local: Number(mat.stock_optimo) || 0,
  });
  if (error) return `No se pudo preparar el material: ${error.message}`;
  return null;
}

async function registrarMovimiento(
  supabaseAdmin: any, mat: any, tipo: string, cantidad: number, usuario: string, motivo: string,
) {
  await supabaseAdmin.from("movimientos").insert({
    id_movimiento: genId("MOV"), material: mat?.nombre || "", id_material: mat?.id_material || null,
    tipo, cantidad, usuario, motivo,
  });
}

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

    // Lo que dice quien inventaría sobre lo que tiene en la mano: si es el
    // mismo producto que ya está en la app pero en otro sitio, o una alícuota
    // de otro, NO hay que dar de alta nada — hay que colgarle un bote. Se
    // guarda tal cual y lo confirma el profesorado al validar.
    let relacion = String(body.relacion || "nuevo");
    if (!["nuevo", "mismo", "alicuota"].includes(relacion)) relacion = "nuevo";
    let idRelacionado = strField(body.id_material_relacionado);
    if (relacion !== "nuevo") {
      if (!idRelacionado) return jsonError("Dinos con qué material del inventario se corresponde", 400);
      const { data: rel } = await supabaseAdmin.from("material")
        .select("id_material").eq("id_material", idRelacionado).maybeSingle();
      if (!rel) return jsonError("Ese material del inventario no existe", 404);
    } else {
      idRelacionado = null;
    }

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
      relacion, id_material_relacionado: idRelacionado,
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
      // No era nuevo: ya estaba en el catálogo. NUNCA se crea una segunda
      // entrada de material — lo que suele faltar es el BOTE en el sitio donde
      // lo han encontrado. `modo_stock` dice qué se hace con lo que se contó:
      //   nuevo_lote → bote nuevo de ese material en la ubicación del recuento
      //   alicuota   → bote hijo (id_lote_padre) del bote del que se trasvasó
      //   sumar      → se suma al bote que ya había en ese mismo sitio
      //   ninguno    → solo se marca la propuesta; el stock no se toca
      const idMaterial = String(
        body.id_material || p.id_material_relacionado || p.id_material_sugerido || "",
      ).trim();
      if (!idMaterial) return jsonError("Indica con qué material se fusiona", 400);
      const { data: mat } = await supabaseAdmin.from("material")
        .select("*").eq("id_material", idMaterial).maybeSingle();
      if (!mat) return jsonError("El material con el que fusionar no existe", 404);

      const modo = String(body.modo_stock || "ninguno");
      if (!["nuevo_lote", "alicuota", "sumar", "ninguno"].includes(modo)) {
        return jsonError("modo_stock no reconocido", 400);
      }
      const cantidad = Number(p.cantidad) || 0;
      const idUbicacion = strField(body.id_ubicacion) || p.id_ubicacion;
      const unidadLote = (p.unidad && p.unidad !== mat.unidad) ? String(p.unidad) : null;
      const unidadTexto = p.unidad || mat.unidad || "";
      let detalle = "";
      let lote: any = null;

      if (modo === "nuevo_lote" || modo === "alicuota") {
        if (!idUbicacion) return jsonError("La propuesta no dice dónde estaba: no se puede crear el bote", 400);
        const problema = await asegurarLoteLegacy(supabaseAdmin, mat);
        if (problema) return jsonError(problema, 400);

        let idLotePadre: string | null = null;
        if (modo === "alicuota") {
          idLotePadre = strField(body.id_lote_padre);
          if (!idLotePadre) return jsonError("Indica de qué bote salió la alícuota", 400);
          const { data: padre } = await supabaseAdmin.from("material_ubicaciones")
            .select("*").eq("id", idLotePadre).maybeSingle();
          if (!padre) return jsonError("El bote del que sale la alícuota ya no existe", 404);
          if (padre.id_material !== idMaterial) return jsonError("Ese bote no es de este material", 400);
        }

        const { data: creado, error: errLote } = await supabaseAdmin.from("material_ubicaciones").insert({
          id: genId("LU"), id_material: idMaterial, id_ubicacion: idUbicacion,
          stock_local: cantidad, stock_minimo_local: 0, stock_optimo_local: 0,
          unidad_lote: unidadLote, id_lote_padre: idLotePadre,
        }).select().single();
        if (errLote) return jsonError(`No se pudo crear el bote: ${errLote.message}`, 400);
        lote = creado;
        await sincronizarStock(supabaseAdmin, idMaterial);

        // La madre NO se descuenta: quien inventaría cuenta lo que ve, y lo que
        // quedó en el bote grande es otro recuento. Queda dicho en la nota para
        // que se ajuste desde el inventario si hace falta.
        await registrarMovimiento(
          supabaseAdmin, mat, modo === "alicuota" ? "Subdivisión" : "Entrada", cantidad, revisor,
          modo === "alicuota"
            ? `Alícuota encontrada al inventariar (propuso: ${p.propuesto_por || "—"})`
            : `Bote encontrado al inventariar (propuso: ${p.propuesto_por || "—"})`,
        );
        detalle = modo === "alicuota"
          ? ` · alícuota de ${cantidad} ${unidadTexto} en ${idUbicacion}`
          : ` · bote nuevo de ${cantidad} ${unidadTexto} en ${idUbicacion}`;

      } else if (modo === "sumar") {
        const idLote = strField(body.id_lote);
        if (!idLote) return jsonError("Indica a qué bote se suma", 400);
        const { data: destino } = await supabaseAdmin.from("material_ubicaciones")
          .select("*").eq("id", idLote).maybeSingle();
        if (!destino) return jsonError("Ese bote ya no existe", 404);
        if (destino.id_material !== idMaterial) return jsonError("Ese bote no es de este material", 400);
        // Bloqueo optimista, igual que en las subdivisiones: si alguien tocó el
        // bote mientras tanto, la escritura no cuela.
        const { data: actualizado } = await supabaseAdmin.from("material_ubicaciones")
          .update({ stock_local: (Number(destino.stock_local) || 0) + cantidad })
          .eq("id", idLote).eq("stock_local", destino.stock_local).select().maybeSingle();
        if (!actualizado) return jsonError("El stock de ese bote cambió mientras se procesaba — vuelve a intentarlo", 409);
        lote = actualizado;
        await sincronizarStock(supabaseAdmin, idMaterial);
        await registrarMovimiento(
          supabaseAdmin, mat, "Entrada", cantidad, revisor,
          `Recuento al inventariar (propuso: ${p.propuesto_por || "—"})`,
        );
        detalle = ` · +${cantidad} ${unidadTexto} en ${destino.id_ubicacion}`;
      }

      const nota = [strField(body.notas_revision), `Ya existía como "${mat.nombre}"${detalle}`]
        .filter(Boolean).join(" · ");
      const { data } = await supabaseAdmin.from("propuestas_material")
        .update({
          estado: "fusionada", revisado_por: revisor, fecha_revision: ahora,
          notas_revision: nota, id_material_creado: idMaterial,
        }).eq("id_propuesta", idPropuesta).select().single();
      const { data: matFinal } = await supabaseAdmin.from("material")
        .select("*").eq("id_material", idMaterial).maybeSingle();
      return jsonOk({ propuesta: data, material: matFinal || mat, lote, revisado_por: revisor });
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
