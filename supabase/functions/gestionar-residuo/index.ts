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
    const nivel = String(body.nivel || "").trim();
    const usuario = String(body.usuario || "").trim();
    if (!idContenedor || !idResiduo || !nivel) {
      return jsonError("id_contenedor, id_residuo y nivel son obligatorios", 400);
    }

    // ── Nivel 1: el tipo de residuo debe coincidir con la categoría del contenedor ──
    const { data: residuo, error: errResiduo } = await supabaseAdmin
      .from("tipos_residuo").select("id_residuo, contenedor_tipo, riesgo")
      .eq("id_residuo", idResiduo).single();
    if (errResiduo || !residuo) return jsonError(`No se encontró el tipo de residuo "${idResiduo}"`, 400);

    const { data: contenedorActual, error: errContActual } = await supabaseAdmin
      .from("contenedores_residuo").select("id_contenedor, categoria")
      .eq("id_contenedor", idContenedor).single();
    if (errContActual || !contenedorActual) return jsonError(`No se encontró el contenedor "${idContenedor}"`, 400);

    if ((residuo.contenedor_tipo || "") !== (contenedorActual.categoria || "")) {
      return jsonError(
        `Este residuo es de tipo "${residuo.contenedor_tipo || "sin categoría"}" y el contenedor es de categoría "${contenedorActual.categoria || "sin categoría"}": no coinciden.`,
        400,
      );
    }

    // ── Nivel 2: incompatibilidad GHS con lo que ya hay dentro de este contenedor ──
    const { data: adicionesExistentes, error: errAdicExist } = await supabaseAdmin
      .from("adiciones_residuo").select("id_residuo").eq("id_contenedor", idContenedor);
    if (errAdicExist) return jsonError(`No se pudo comprobar el contenido actual del contenedor: ${errAdicExist.message}`, 400);

    const idsExistentesDistintos = [...new Set((adicionesExistentes || []).map((a) => a.id_residuo))]
      .filter((id) => id !== idResiduo);

    if (idsExistentesDistintos.length > 0) {
      const { data: tiposExistentes, error: errTiposExist } = await supabaseAdmin
        .from("tipos_residuo").select("id_residuo, riesgo").in("id_residuo", idsExistentesDistintos);
      if (errTiposExist) return jsonError(`No se pudo comprobar la compatibilidad: ${errTiposExist.message}`, 400);

      const riesgosNuevo = parseRiesgo(residuo.riesgo);
      const riesgosExistentes = (tiposExistentes || []).map((t) => parseRiesgo(t.riesgo));
      const conflicto = chequearIncompatibilidad(riesgosNuevo, riesgosExistentes, true);
      if (conflicto) return jsonError(`No se puede añadir este residuo a este contenedor: ${conflicto}.`, 400);
    }

    const fecha = hoy();
    const datosAdicion = {
      id_adicion: generarId("AD"), id_contenedor: idContenedor, id_residuo: idResiduo,
      fecha, usuario: usuario || null,
      observaciones: body.observaciones ? String(body.observaciones) : null,
    };
    const { data: adicion, error: errAdicion } = await supabaseAdmin
      .from("adiciones_residuo").insert(datosAdicion).select().single();
    if (errAdicion) return jsonError(`No se pudo registrar la adición: ${errAdicion.message}`, 400);

    const { data: contenedor, error: errCont } = await supabaseAdmin
      .from("contenedores_residuo")
      .update({ nivel, fecha_actualizacion: fecha, actualizado_por: usuario || null })
      .eq("id_contenedor", idContenedor).select().single();
    if (errCont) return jsonError(`Adición guardada pero no se pudo actualizar el nivel: ${errCont.message}`, 400);

    return jsonOk({ adicion, contenedor });
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
