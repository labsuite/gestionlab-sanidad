// Módulo Residuos. "añadir_adicion" (registrar un residuo en un contenedor) y
// "crear_consulta" (avisar a la gestora de un residuo desconocido) están
// abiertas a cualquier sesión válida — ver los botones sin gating de rol en
// renderResiduosContenedores/renderResiduosGuia (js/residuos.js). El resto
// (tipos de residuo) es Admin/Gestor, y los contenedores (crear/editar/cerrar/
// eliminar/recogida) son Admin/Gestor/Profesor (canEdit en
// renderResiduosContenedores). "resolver_consulta" es Admin/Gestor.
import { requireValidSession, requireStaff, requireAdminOrGestor, jsonError, jsonOk, handleCorsPreflight } from "../_shared/auth.ts";

function generarId(prefijo: string): string {
  return prefijo + Date.now().toString(36).toUpperCase().slice(-6);
}

// gemini-1.5-flash y gemini-2.5-flash ya no están disponibles para claves nuevas (Google
// los retiró) — mismo modelo ya confirmado en supabase/functions/leer-documento-proveedor
// el 2026-08-19. Si esto vuelve a dar 404 "is not found for API version v1beta", comprobar
// modelos vigentes con GET /v1beta/models?key=... antes de asumir otra causa.
const GEMINI_MODELO = "gemini-3.6-flash";

// La clave nunca sale de este servidor — el chat del consultorio de residuos
// (js/residuos.js) manda aquí el historial y solo recibe el texto de vuelta.
async function llamarGeminiChat(history: unknown): Promise<string> {
  const geminiKey = Deno.env.get("GEMINI_API_KEY");
  if (!geminiKey) throw new Error("Falta configurar GEMINI_API_KEY en los secretos del proyecto");
  const cuerpo = JSON.stringify({
    contents: history,
    // thinkingLevel "low": sin esto, gemini-3.6-flash gasta una parte variable del
    // presupuesto de tokens en "pensar" internamente antes de responder, y con
    // maxOutputTokens ajustado el texto visible puede quedar cortado a media frase
    // (visto en pruebas reales) — mismo ajuste ya usado en leer-documento-proveedor.
    generationConfig: { maxOutputTokens: 2048, temperature: 0.2, thinkingConfig: { thinkingLevel: "low" } },
  });

  // El modelo flash sufre picos de 503 "high demand" que Google describe como
  // temporales: reintentar un par de veces con espera corta rescata la mayoría.
  // Timeout explícito por intento: si Gemini no responde, el worker de Supabase
  // acaba matando todo el isolate con WORKER_RESOURCE_LIMIT (un 546 sin cuerpo
  // útil) en vez de dejar que este throw lo capture el llamador.
  const REINTENTOS = [0, 1500, 3500];
  let ultimoError = "";
  for (let intento = 0; intento < REINTENTOS.length; intento++) {
    if (REINTENTOS[intento]) await new Promise((r) => setTimeout(r, REINTENTOS[intento]));
    const ctrl = new AbortController();
    const timeoutId = setTimeout(() => ctrl.abort(), 22000);
    let respuesta: Response;
    try {
      respuesta = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODELO}:generateContent?key=${geminiKey}`,
        { method: "POST", headers: { "Content-Type": "application/json" }, signal: ctrl.signal, body: cuerpo },
      );
    } catch (e) {
      ultimoError = e instanceof DOMException && e.name === "AbortError"
        ? "Gemini no respondió a tiempo (timeout de 22 s)"
        : (e instanceof Error ? e.message : String(e));
      continue;
    } finally {
      clearTimeout(timeoutId);
    }
    if (respuesta.status === 503 || respuesta.status === 429 || respuesta.status === 500) {
      ultimoError = `Gemini devolvió ${respuesta.status} (sobrecarga temporal)`;
      await respuesta.body?.cancel().catch(() => {});
      continue;
    }
    if (!respuesta.ok) {
      const detalle = await respuesta.text().catch(() => "");
      throw new Error(`Gemini devolvió un error (${respuesta.status}): ${detalle.slice(0, 300)}`);
    }
    return extraerTextoGemini(await respuesta.json());
  }
  throw new Error(ultimoError || "Gemini no disponible tras varios intentos");
}

function extraerTextoGemini(
  data: { candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[] },
): string {
  const texto = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  const finishReason = data?.candidates?.[0]?.finishReason;
  if (!texto) throw new Error(`Gemini no devolvió contenido interpretable (finishReason: ${finishReason || "desconocido"})`);
  if (finishReason === "MAX_TOKENS") throw new Error("La respuesta de Gemini se cortó por longitud (MAX_TOKENS) — sube maxOutputTokens");
  return texto;
}

// ── Compatibilidad de residuos dentro de un mismo contenedor ──
// Valores idénticos letra por letra a las claves de _GHS en js/residuos.js.
const GHS_INCOMPATIBLES: [string, string][] = [
  ["Comburente", "Inflamable"],
  ["Comburente", "Explosivo"],
  ["Corrosivo", "Comburente"],
  ["Explosivo", "Inflamable"],
  ["Explosivo", "Corrosivo"],
];
// Estas categorías nunca deben convivir con ningún otro tipo de residuo distinto
// en el mismo contenedor, aunque no haya un par específico en la matriz de arriba.
const GHS_EXCLUSIVAS = ["Citotóxico", "Cancerígeno / CMR"];

function parseRiesgo(riesgo: string | null): string[] {
  return (riesgo || "").split(",").map((s) => s.trim()).filter(Boolean);
}

function chequearIncompatibilidad(
  riesgosNuevo: string[],
  riesgosExistentes: string[][],
  hayOtroTipoDistinto: boolean,
): string | null {
  for (const exclusiva of GHS_EXCLUSIVAS) {
    if (hayOtroTipoDistinto && riesgosNuevo.includes(exclusiva)) {
      return `el nuevo residuo es "${exclusiva}": esta categoría no puede convivir con ningún otro tipo de residuo distinto en el mismo contenedor`;
    }
    if (hayOtroTipoDistinto && riesgosExistentes.some((r) => r.includes(exclusiva))) {
      return `el contenedor ya contiene un residuo "${exclusiva}": no se puede añadir ningún otro tipo distinto`;
    }
  }
  for (const [a, b] of GHS_INCOMPATIBLES) {
    const nuevoTieneA = riesgosNuevo.includes(a);
    const nuevoTieneB = riesgosNuevo.includes(b);
    const existeA = riesgosExistentes.some((r) => r.includes(a));
    const existeB = riesgosExistentes.some((r) => r.includes(b));
    if ((nuevoTieneA && existeB) || (nuevoTieneB && existeA)) {
      return `el contenedor ya tiene un residuo "${nuevoTieneA ? b : a}" y el nuevo es "${nuevoTieneA ? a : b}"`;
    }
  }
  return null;
}

// ── Comprobación con IA al añadir a un contenedor concreto ──
// Segunda capa, por encima de la validación determinista de arriba: Gemini revisa
// si el residuo (del catálogo o descrito en texto libre) encaja de verdad en ESE
// contenedor, teniendo en cuenta lo que ya lleva dentro. Devuelve [OK] o
// [BLOQUEO|categoria=..|contenedor_sugerido=..]. La clave nunca sale del servidor.

// Réplica de _WARNINGS_FORMATO en js/residuos.js (matching parcial, minúsculas).
const WARNINGS_FORMATO: { match: string; texto: string }[] = [
  { match: "bidón azul", texto: "Los líquidos van en su propio bote cerrado y rotulado dentro del bidón; no verter directamente." },
  { match: "cubo con tapa", texto: "No cerrar la tapa hasta que esté lleno y listo para Consenur; dejarla apoyada." },
  { match: "contenedor rígido", texto: "No cerrar la tapa hasta que esté lleno y listo para Consenur; dejarla apoyada." },
  { match: "bolsa plástica", texto: "Solo envases vacíos de plástico o aluminio; nada a granel ni con restos líquidos." },
  { match: "garrafa", texto: "Mantener bien cerrada entre adiciones; zona ventilada, lejos de calor e ignición." },
];
function getWarningFormato(formato: string | null): string | null {
  const f = (formato || "").toLowerCase();
  if (!f) return null;
  return WARNINGS_FORMATO.find((w) => f.includes(w.match))?.texto || null;
}

interface ContextoIA {
  contenedor: { categoria: string; lab: string; formato: string | null };
  contenidoActual: { nombre: string; riesgo: string; detalle: string }[];
  itemCatalogo: { nombre: string; riesgo: string; contenedorTipo: string; detalle: string } | null;
  textoLibre: string | null;
  catalogo: { nombre: string; riesgo: string; contenedorTipo: string; detalle: string }[];
  contenedoresActivos: { categoria: string; lab: string; formato: string | null }[];
  excepciones: { que: string; motivo: string }[];
}

function construirHistoryComprobacionIA(ctx: ContextoIA): unknown[] {
  const cont = ctx.contenedor;
  const aviso = getWarningFormato(cont.formato);
  const dentro = ctx.contenidoActual.length
    ? ctx.contenidoActual.map((t) => `- ${t.nombre} | Riesgo GHS: ${t.riesgo || "ninguno"}${t.detalle ? " | Detalle: " + t.detalle : ""}`).join("\n")
    : "(el contenedor está vacío o no tiene adiciones registradas)";
  const aAnadir = ctx.itemCatalogo
    ? `- Tipo del catálogo: ${ctx.itemCatalogo.nombre} | Riesgo GHS: ${ctx.itemCatalogo.riesgo || "ninguno"} | Contenedor asignado en el catálogo: ${ctx.itemCatalogo.contenedorTipo || "sin asignar"}${ctx.itemCatalogo.detalle ? " | Detalle: " + ctx.itemCatalogo.detalle : ""}`
    : "";
  const aAnadirLibre = ctx.textoLibre ? `- Descrito por la persona en texto libre: "${ctx.textoLibre}"` : "";
  const catalogo = ctx.catalogo
    .map((t) => `- ${t.nombre} | Riesgo: ${t.riesgo || "ninguno"} | Contenedor: ${t.contenedorTipo || "sin asignar"}${t.detalle ? " | Detalle: " + t.detalle : ""}`)
    .join("\n");
  const activos = ctx.contenedoresActivos.length
    ? ctx.contenedoresActivos.map((c) => `- Lab ${c.lab} · ${c.categoria}${c.formato ? " (" + c.formato + ")" : ""}`).join("\n")
    : "(no hay contenedores activos registrados)";
  const excepciones = ctx.excepciones.length
    ? ctx.excepciones.map((e) => `- ${e.que}${e.motivo ? ` (se había objetado: ${e.motivo})` : ""}`).join("\n")
    : "(ninguno)";

  const systemText = `Eres el validador de residuos de un laboratorio de FP sanitaria (CIFP Manuel Antonio). Alguien está a punto de tirar un residuo en un contenedor concreto. Tu única tarea es decir si es correcto tirarlo ahí o no.

CONTENEDOR DE DESTINO:
- Categoría: ${cont.categoria || "sin categoría"}
- Laboratorio: ${cont.lab || "?"}
- Formato: ${cont.formato || "sin especificar"}${aviso ? `\n- Aviso de formato: ${aviso}` : ""}

LO QUE YA HAY DENTRO DE ESTE CONTENEDOR (tipos distintos ya registrados):
${dentro}

LO QUE SE QUIERE AÑADIR AHORA:
${[aAnadir, aAnadirLibre].filter(Boolean).join("\n")}

CATÁLOGO COMPLETO DE TIPOS DE RESIDUO DEL CENTRO (para localizar el contenedor correcto si este no lo es; usa el Detalle para desambiguar):
${catalogo}

CONTENEDORES ACTIVOS EN EL CENTRO:
${activos}

CASOS YA REVISADOS Y APROBADOS POR GESTIÓN para contenedores de categoría "${cont.categoria}". Si lo que se quiere añadir coincide claramente con uno de estos, considéralo COMPATIBLE y responde [OK]:
${excepciones}

REGLAS:
- El residuo debe corresponder a la categoría del contenedor de destino. Si es un tipo del catálogo cuyo "Contenedor asignado" NO coincide con la categoría del contenedor de destino, es INCOMPATIBLE (salvo que esté en los casos aprobados de arriba).
- Incompatibilidad química con lo que ya hay dentro: nunca juntar Comburente con Inflamable ni con Explosivo; nunca Corrosivo con Comburente; nunca Explosivo con Inflamable ni con Corrosivo. Un residuo Citotóxico o Cancerígeno / CMR nunca puede convivir con ningún otro tipo distinto en el mismo contenedor.
- Si la descripción en texto libre es ambigua entre varios tipos con contenedor distinto, o no describe un residuo real, es INCOMPATIBLE: mejor parar y que lo revise una persona.
- Nunca propongas verter por el desagüe ni tirar a la basura general, salvo que el "Detalle" del tipo del catálogo coincidente lo indique explícitamente.
- Si detectas un riesgo agudo (derrame, presión/burbujeo, olor fuerte, mezcla accidental de incompatibles), es INCOMPATIBLE y dilo con claridad.

FORMATO DE RESPUESTA — OBLIGATORIO. Tu respuesta debe EMPEZAR exactamente con una de estas dos etiquetas, sin ningún texto antes, y ser BREVE (2 a 4 frases, sin listas largas):
- [OK] → el residuo puede ir en ese contenedor. Añade una frase de confirmación y el aviso de formato si aplica.
- [BLOQUEO|categoria=<una de: Tóxico, Nocivo / Irritante, Inflamable, Comburente, Corrosivo, Cancerígeno / CMR, Peligroso para el medio ambiente, Explosivo, Gas comprimido, Citotóxico, Desconocido>|contenedor_sugerido=<la categoría de contenedor correcta, o "ninguno">] → el residuo NO puede ir ahí. Explica por qué en una frase y di a qué contenedor y laboratorio llevarlo (si existe uno activo compatible en el centro); si no existe ninguno, di que lo deje en su propio envase cerrado y rotulado en la zona de residuos pendientes y avise a su profesor/a.

Nunca uses otra etiqueta ni añadas texto antes de la etiqueta. Nunca omitas la etiqueta inicial.`;

  return [
    { role: "user", parts: [{ text: systemText }] },
    { role: "model", parts: [{ text: "Entendido." }] },
    { role: "user", parts: [{ text: "Contenedor destino categoría 'Aguas Laboratorio'. Se quiere añadir: PBS diluido sobrante de lavados, riesgo ninguno." }] },
    { role: "model", parts: [{ text: "[OK] El PBS diluido es un residuo acuoso de bajo riesgo y encaja en el contenedor de Aguas de Laboratorio. Mantén la garrafa cerrada entre adiciones." }] },
    { role: "user", parts: [{ text: "Contenedor destino categoría 'Aguas Laboratorio'. Se quiere añadir: etanol del paso de decoloración de una tinción de Gram." }] },
    { role: "model", parts: [{ text: "[BLOQUEO|categoria=Inflamable|contenedor_sugerido=Disolventes no halogenados] El etanol de decoloración es un disolvente inflamable y no va en Aguas de Laboratorio. Llévalo al contenedor de Disolventes no halogenados; si no hay ninguno activo, déjalo en su envase cerrado y rotulado en la zona de residuos pendientes y avisa a tu profesor/a." }] },
  ];
}

function parseRespuestaComprobacionIA(texto: string): { ok: boolean; categoria: string; contenedorSugerido: string; cuerpo: string } {
  const limpio = (texto || "").trim();
  if (/^\[OK\]/i.test(limpio)) {
    return { ok: true, categoria: "", contenedorSugerido: "", cuerpo: limpio.replace(/^\[OK\]\s*/i, "") };
  }
  const m = /^\[BLOQUEO\|categoria=([^|\]]+)\|contenedor_sugerido=([^\]]*)\]/i.exec(limpio);
  if (m) {
    return { ok: false, categoria: m[1].trim(), contenedorSugerido: m[2].trim(), cuerpo: limpio.replace(/^\[BLOQUEO\|[^\]]*\]\s*/i, "") };
  }
  // Fail-safe: la IA respondió pero sin respetar el formato → bloquear (más seguro
  // que dejar pasar sin verificar; la persona siempre puede forzar el registro).
  return { ok: false, categoria: "Desconocido", contenedorSugerido: "ninguno", cuerpo: limpio || "No se ha podido interpretar la comprobación de la IA." };
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
  const hoy = () => new Date().toISOString().split("T")[0];

  // ── Añadir residuo a un contenedor (actualiza nivel del contenedor) ──
  if (accion === "añadir_adicion") {
    const { error: authError, supabaseAdmin } = await requireValidSession(req);
    if (authError) return authError;

    const idContenedor = String(body.id_contenedor || "").trim();
    const idResiduo = String(body.id_residuo || "").trim();
    const descripcionLibre = String(body.descripcion_libre || "").trim();
    const nivel = String(body.nivel || "").trim();
    const usuario = String(body.usuario || "").trim();
    // "registrar igualmente" tras un bloqueo de la IA: salta SOLO la capa IA,
    // nunca la validación determinista de Nivel 1/2 de abajo.
    const iaOverride = body.ia_override === true;
    // true solo cuando el override viene de un bloqueo real de la IA (no de "IA no
    // disponible"): así queda registrado en excepciones_residuo_ia y alimenta el prompt.
    const registrarExcepcion = body.registrar_excepcion === true;
    const motivoIa = String(body.motivo_ia || "").trim();

    if (!idContenedor || !nivel || (!idResiduo && !descripcionLibre)) {
      return jsonError("id_contenedor, nivel y (id_residuo o descripcion_libre) son obligatorios", 400);
    }

    const { data: contenedorActual, error: errContActual } = await supabaseAdmin
      .from("contenedores_residuo").select("id_contenedor, categoria, lab, formato")
      .eq("id_contenedor", idContenedor).single();
    if (errContActual || !contenedorActual) return jsonError(`No se encontró el contenedor "${idContenedor}"`, 400);

    type TipoResiduo = { id_residuo: string; contenedor_tipo: string | null; riesgo: string | null; nombre: string; descripcion: string | null };
    let residuo: TipoResiduo | null = null;
    if (idResiduo) {
      const { data, error: errResiduo } = await supabaseAdmin
        .from("tipos_residuo").select("id_residuo, nombre, descripcion, contenedor_tipo, riesgo")
        .eq("id_residuo", idResiduo).single();
      if (errResiduo || !data) return jsonError(`No se encontró el tipo de residuo "${idResiduo}"`, 400);
      residuo = data as TipoResiduo;

      // ── Nivel 1 (determinista, bloqueo duro): categoría del contenedor ──
      if ((residuo.contenedor_tipo || "") !== (contenedorActual.categoria || "")) {
        return jsonError(
          `Este residuo es de tipo "${residuo.contenedor_tipo || "sin categoría"}" y el contenedor es de categoría "${contenedorActual.categoria || "sin categoría"}": no coinciden.`,
          400,
        );
      }
    }

    // ── Contenido actual del contenedor (para Nivel 2 y para la IA) ──
    const { data: adicionesExistentes, error: errAdicExist } = await supabaseAdmin
      .from("adiciones_residuo").select("id_residuo, descripcion_libre").eq("id_contenedor", idContenedor);
    if (errAdicExist) return jsonError(`No se pudo comprobar el contenido actual del contenedor: ${errAdicExist.message}`, 400);

    const idsExistentesDistintos = [...new Set((adicionesExistentes || []).map((a: { id_residuo: string | null }) => a.id_residuo).filter(Boolean))]
      .filter((id) => id !== idResiduo);

    type TipoContenido = { id_residuo: string; nombre: string; descripcion: string | null; riesgo: string | null };
    let tiposExistentes: TipoContenido[] = [];
    if (idsExistentesDistintos.length > 0) {
      const { data } = await supabaseAdmin
        .from("tipos_residuo").select("id_residuo, nombre, descripcion, riesgo")
        .in("id_residuo", idsExistentesDistintos);
      tiposExistentes = (data || []) as TipoContenido[];
    }

    // ── Nivel 2 (determinista, bloqueo duro): incompatibilidad GHS — solo si hay tipo del catálogo ──
    if (residuo && idsExistentesDistintos.length > 0) {
      const riesgosNuevo = parseRiesgo(residuo.riesgo);
      const riesgosExistentes = (tiposExistentes || []).map((t) => parseRiesgo(t.riesgo));
      const conflicto = chequearIncompatibilidad(riesgosNuevo, riesgosExistentes, true);
      if (conflicto) return jsonError(`No se puede añadir este residuo a este contenedor: ${conflicto}.`, 400);
    }

    // ── Capa IA: ¿de verdad se puede tirar esto en ESTE contenedor? ──
    if (!iaOverride) {
      const [{ data: catalogo }, { data: contenedoresActivos }, { data: excepcionesFilas }] = await Promise.all([
        supabaseAdmin.from("tipos_residuo").select("nombre, riesgo, contenedor_tipo, descripcion"),
        supabaseAdmin.from("contenedores_residuo").select("categoria, lab, formato").eq("estado", "activo"),
        supabaseAdmin.from("excepciones_residuo_ia").select("id_residuo, descripcion_libre, motivo_ia")
          .eq("categoria_contenedor", contenedorActual.categoria || ""),
      ]);

      const excepcionesTipoIds = [...new Set((excepcionesFilas || []).map((e: { id_residuo: string | null }) => e.id_residuo).filter(Boolean))];
      const nombreExcepcion = new Map<string, string>();
      if (excepcionesTipoIds.length) {
        const { data: excepcionesTipos } = await supabaseAdmin
          .from("tipos_residuo").select("id_residuo, nombre").in("id_residuo", excepcionesTipoIds);
        for (const t of (excepcionesTipos || []) as { id_residuo: string; nombre: string }[]) nombreExcepcion.set(t.id_residuo, t.nombre);
      }

      const ctx: ContextoIA = {
        contenedor: { categoria: contenedorActual.categoria || "", lab: String(contenedorActual.lab || ""), formato: contenedorActual.formato },
        contenidoActual: (tiposExistentes || []).map((t) => ({ nombre: t.nombre, riesgo: t.riesgo || "", detalle: t.descripcion || "" })),
        itemCatalogo: residuo
          ? { nombre: residuo.nombre || "", riesgo: residuo.riesgo || "", contenedorTipo: residuo.contenedor_tipo || "", detalle: residuo.descripcion || "" }
          : null,
        textoLibre: descripcionLibre || null,
        catalogo: (catalogo || []).map((t) => ({ nombre: t.nombre, riesgo: t.riesgo || "", contenedorTipo: t.contenedor_tipo || "", detalle: t.descripcion || "" })),
        contenedoresActivos: (contenedoresActivos || []).map((c) => ({ categoria: c.categoria || "", lab: String(c.lab || ""), formato: c.formato })),
        excepciones: (excepcionesFilas || []).map((e) => ({
          que: e.id_residuo ? (nombreExcepcion.get(e.id_residuo) || e.id_residuo) : (e.descripcion_libre || "(sin descripción)"),
          motivo: e.motivo_ia || "",
        })),
      };

      let respuestaIa: string | null = null;
      try {
        respuestaIa = await llamarGeminiChat(construirHistoryComprobacionIA(ctx));
      } catch (e) {
        // IA no disponible: si hay tipo del catálogo, ya ha pasado la validación
        // determinista (Nivel 1/2) y se permite; si es solo texto libre, no hay
        // nada que lo respalde, así que se devuelve "no verificado" y decide la persona.
        console.error("Comprobación IA no disponible:", e instanceof Error ? e.message : e);
        if (!residuo) {
          return jsonOk({
            ia_no_verificado: true,
            mensaje: "No se ha podido comprobar la compatibilidad con la IA en este momento. Si estás seguro, puedes registrarlo igualmente; si no, deja el residuo etiquetado en la zona de residuos pendientes y avisa a tu profesor/a.",
          });
        }
      }

      if (respuestaIa !== null) {
        const veredicto = parseRespuestaComprobacionIA(respuestaIa);
        if (!veredicto.ok) {
          return jsonOk({
            ia_bloqueo: true,
            mensaje: veredicto.cuerpo,
            categoria_ia: veredicto.categoria,
            contenedor_sugerido: veredicto.contenedorSugerido,
          });
        }
      }
    }

    // ── Registro de la adición ──
    const fecha = hoy();
    const datosAdicion = {
      id_adicion: generarId("AD"), id_contenedor: idContenedor,
      id_residuo: idResiduo || null,
      descripcion_libre: idResiduo ? null : (descripcionLibre || null),
      fecha, usuario: usuario || null,
      observaciones: body.observaciones ? String(body.observaciones) : null,
    };
    const { data: adicion, error: errAdicion } = await supabaseAdmin
      .from("adiciones_residuo").insert(datosAdicion).select().single();
    if (errAdicion) return jsonError(`No se pudo registrar la adición: ${errAdicion.message}`, 400);

    let excepcion = null;
    if (iaOverride && registrarExcepcion) {
      const { data: exc } = await supabaseAdmin.from("excepciones_residuo_ia").insert({
        id_excepcion: generarId("EXC"),
        id_contenedor: idContenedor,
        categoria_contenedor: contenedorActual.categoria || null,
        id_residuo: idResiduo || null,
        descripcion_libre: idResiduo ? null : (descripcionLibre || null),
        motivo_ia: motivoIa || null,
        usuario: usuario || null,
        fecha: new Date().toISOString(),
      }).select().single();
      excepcion = exc || null;
    }

    const { data: contenedor, error: errCont } = await supabaseAdmin
      .from("contenedores_residuo")
      .update({ nivel, fecha_actualizacion: fecha, actualizado_por: usuario || null })
      .eq("id_contenedor", idContenedor).select().single();
    if (errCont) return jsonError(`Adición guardada pero no se pudo actualizar el nivel: ${errCont.message}`, 400);

    return jsonOk({ adicion, contenedor, excepcion });
  }

  // ── Consultorio de residuos: proxy del chat con Gemini (cualquier sesión válida) ──
  if (accion === "consultar_ia") {
    const { error: authError } = await requireValidSession(req);
    if (authError) return authError;

    const history = body.history;
    if (!Array.isArray(history) || !history.length) {
      return jsonError("history es obligatorio (array de turnos role/parts)", 400);
    }
    try {
      const texto = await llamarGeminiChat(history);
      return jsonOk({ texto });
    } catch (e) {
      return jsonError(e instanceof Error ? e.message : "Error al consultar la IA", 502);
    }
  }

  // ── Consulta de residuo desconocido (cualquiera puede avisar) ──
  if (accion === "crear_consulta") {
    const { error: authError, supabaseAdmin } = await requireValidSession(req);
    if (authError) return authError;

    const descripcion = String(body.descripcion || "").trim();
    const ubicacionDejado = String(body.ubicacion_dejado || "").trim();
    if (!descripcion || !ubicacionDejado) {
      return jsonError("descripcion y ubicacion_dejado son obligatorios", 400);
    }
    const prioridad = String(body.prioridad || "Normal").trim();
    const datos = {
      id_consulta: generarId("CR-"), fecha: hoy(),
      usuario: body.usuario ? String(body.usuario) : null,
      descripcion, ubicacion_dejado: ubicacionDejado, estado: "Pendiente",
      categoria_ia: body.categoria_ia ? String(body.categoria_ia) : null,
      guia_provisional: body.guia_provisional ? String(body.guia_provisional) : null,
      prioridad: prioridad === "Alta" ? "Alta" : "Normal",
    };
    const { data, error } = await supabaseAdmin.from("consultas_residuo").insert(datos).select().single();
    if (error) return jsonError(`No se pudo enviar el aviso: ${error.message}`, 400);
    return jsonOk({ consulta: data });
  }

  // ── Contenedores: crear/editar/cerrar/eliminar/recogida (Admin/Gestor/Profesor) ──
  if (["crear_contenedor", "actualizar_contenedor", "cerrar_contenedor", "eliminar_contenedor", "registrar_recogida"].includes(accion)) {
    const { error: authError, supabaseAdmin } = await requireStaff(req);
    if (authError) return authError;
    const usuario = String(body.usuario || "").trim() || null;
    const fecha = hoy();

    if (accion === "crear_contenedor" || accion === "actualizar_contenedor") {
      const categoria = String(body.categoria || "").trim();
      const lab = String(body.lab || "").trim();
      if (!categoria || !lab) return jsonError("categoria y lab son obligatorios", 400);
      const datos = {
        categoria, lab,
        zona: body.zona ? String(body.zona) : null,
        formato: body.formato ? String(body.formato) : null,
        fecha_actualizacion: fecha, actualizado_por: usuario,
      };
      if (accion === "crear_contenedor") {
        const { data, error } = await supabaseAdmin.from("contenedores_residuo").insert({
          id_contenedor: generarId("RC"), nivel: body.nivel ? String(body.nivel) : "vacío",
          estado: "activo", fecha_apertura: fecha, ...datos,
        }).select().single();
        if (error) return jsonError(`No se pudo crear el contenedor: ${error.message}`, 400);
        return jsonOk({ contenedor: data });
      } else {
        const idContenedor = String(body.id_contenedor || "").trim();
        if (!idContenedor) return jsonError("id_contenedor es obligatorio para actualizar", 400);
        const { data, error } = await supabaseAdmin.from("contenedores_residuo")
          .update(datos).eq("id_contenedor", idContenedor).select().single();
        if (error) return jsonError(`No se pudo actualizar: ${error.message}`, 400);
        if (!data) return jsonError(`No se encontró el contenedor "${idContenedor}"`, 404);
        return jsonOk({ contenedor: data });
      }
    }

    const idContenedor = String(body.id_contenedor || "").trim();
    if (!idContenedor) return jsonError("id_contenedor es obligatorio", 400);

    if (accion === "cerrar_contenedor") {
      const { data: cerrado, error: errCierre } = await supabaseAdmin.from("contenedores_residuo")
        .update({ estado: "cerrado", fecha_cierre: fecha, fecha_actualizacion: fecha, actualizado_por: usuario })
        .eq("id_contenedor", idContenedor).select().single();
      if (errCierre) return jsonError(`No se pudo cerrar el contenedor: ${errCierre.message}`, 400);
      if (!cerrado) return jsonError(`No se encontró el contenedor "${idContenedor}"`, 404);

      const { data: nuevo, error: errNuevo } = await supabaseAdmin.from("contenedores_residuo").insert({
        id_contenedor: generarId("RC"), categoria: cerrado.categoria, lab: cerrado.lab, zona: cerrado.zona,
        nivel: "vacío", estado: "activo", fecha_apertura: fecha, fecha_actualizacion: fecha, actualizado_por: usuario,
      }).select().single();
      if (errNuevo) return jsonError(`Contenedor cerrado pero no se pudo crear el nuevo: ${errNuevo.message}`, 400);
      return jsonOk({ cerrado, nuevo });
    }

    if (accion === "registrar_recogida") {
      // Se elimina físicamente tras la recogida (mismo comportamiento que la app ya tenía en Sheets).
      const { error } = await supabaseAdmin.from("contenedores_residuo").delete().eq("id_contenedor", idContenedor);
      if (error) return jsonError(`No se pudo registrar la recogida: ${error.message}`, 400);
      return jsonOk({ recogido: idContenedor });
    }

    if (accion === "eliminar_contenedor") {
      const { error } = await supabaseAdmin.from("contenedores_residuo").delete().eq("id_contenedor", idContenedor);
      if (error) return jsonError(`No se pudo eliminar: ${error.message}`, 400);
      return jsonOk({ eliminado: idContenedor });
    }
  }

  // ── Tipos de residuo (Admin/Gestor) ──
  const { error: authError, supabaseAdmin } = await requireAdminOrGestor(req);
  if (authError) return authError;

  if (accion === "crear_tipo" || accion === "actualizar_tipo") {
    const nombre = String(body.nombre || "").trim();
    if (!nombre) return jsonError("nombre es obligatorio", 400);
    const datos = {
      nombre,
      descripcion: body.descripcion ? String(body.descripcion) : null,
      riesgo: body.riesgo ? String(body.riesgo) : null,
      contenedor_tipo: body.contenedor_tipo ? String(body.contenedor_tipo) : null,
    };
    if (accion === "crear_tipo") {
      const { data, error } = await supabaseAdmin.from("tipos_residuo")
        .insert({ id_residuo: generarId("RES"), ...datos }).select().single();
      if (error) return jsonError(`No se pudo crear: ${error.message}`, 400);
      return jsonOk({ tipo: data });
    } else {
      const idResiduo = String(body.id_residuo || "").trim();
      if (!idResiduo) return jsonError("id_residuo es obligatorio para actualizar", 400);
      const { data, error } = await supabaseAdmin.from("tipos_residuo")
        .update(datos).eq("id_residuo", idResiduo).select().single();
      if (error) return jsonError(`No se pudo actualizar: ${error.message}`, 400);
      if (!data) return jsonError(`No se encontró el tipo "${idResiduo}"`, 404);
      return jsonOk({ tipo: data });
    }
  }

  if (accion === "eliminar_tipo") {
    const idResiduo = String(body.id_residuo || "").trim();
    if (!idResiduo) return jsonError("id_residuo es obligatorio", 400);
    const { error } = await supabaseAdmin.from("tipos_residuo").delete().eq("id_residuo", idResiduo);
    if (error) {
      if (error.code === "23503") return jsonError("No se puede eliminar: hay adiciones registradas con este tipo de residuo", 400);
      return jsonError(`No se pudo eliminar: ${error.message}`, 400);
    }
    return jsonOk({ eliminado: idResiduo });
  }

  if (accion === "resolver_consulta") {
    const idConsulta = String(body.id_consulta || "").trim();
    if (!idConsulta) return jsonError("id_consulta es obligatorio", 400);
    const { data, error } = await supabaseAdmin.from("consultas_residuo")
      .update({ estado: "Resuelta" }).eq("id_consulta", idConsulta).select().single();
    if (error) return jsonError(`No se pudo actualizar: ${error.message}`, 400);
    if (!data) return jsonError(`No se encontró la consulta "${idConsulta}"`, 404);
    return jsonOk({ consulta: data });
  }

  return jsonError("accion no reconocida", 400);
});
