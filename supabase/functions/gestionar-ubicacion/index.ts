// Módulo Ubicaciones — mismo patrón que gestionar-proveedor. Solo Admin/Gestor.
// A diferencia de Proveedores, el ID_Ubicacion lo escribe la persona a mano
// (no se genera solo) y puede cambiarlo al editar — por eso "actualizar"
// necesita id_original (la fila que se edita) además de id_ubicacion (el
// valor nuevo, que puede ser el mismo o uno corregido). Ese ID es la clave
// primaria: renombrarlo solo funciona porque las claves ajenas que apuntan
// aquí están en ON UPDATE CASCADE (scripts/migrar_fk_ubicacion_cascade.py) y
// porque al final de "actualizar" se repasan a mano las columnas de texto
// sin FK. Al añadir una tabla nueva que guarde el ID de una ubicación,
// darle la FK con on update cascade en vez de un text suelto.
// "eliminar" solo borra de verdad una ubicación que no usa nadie; si hay
// equipos o lotes dentro devuelve el recuento y el cliente ofrece
// "cambiar_estado" (activa=false), que la retira de los selectores sin
// romper lo que ya apunta a ella.
import { requireAdminOrGestor, jsonError, jsonOk, handleCorsPreflight } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;
  if (req.method !== "POST") return jsonError("Método no permitido", 405);

  const { error: authError, supabaseAdmin } = await requireAdminOrGestor(req);
  if (authError) return authError;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonError("Cuerpo inválido (se esperaba JSON)", 400);
  }

  const accion = String(body.accion || "");
  const idUbicacion = String(body.id_ubicacion || "").trim();
  const laboratorioAula = String(body.laboratorio_aula || "").trim();

  const ACCIONES = ["crear", "actualizar", "eliminar", "cambiar_estado"];
  if (!ACCIONES.includes(accion)) {
    return jsonError(`accion debe ser una de: ${ACCIONES.join(", ")}`, 400);
  }

  // ----------------------------------------------------------
  // ELIMINAR — nunca a ciegas. Una ubicación la referencian equipos, lotes de
  // material y el catalogo legacy de material; `material_ubicaciones` ademas la
  // exige NOT NULL, así que un DELETE con lotes dentro revienta con un 23503
  // ilegible. Se cuenta primero y, si hay algo colgando, se devuelve 200 con el
  // detalle (mismo patrón que el bloqueo de IA en residuos: 200 para que
  // callEdgeFunction no lo convierta en throw y el cliente pueda ofrecer
  // desactivarla en su lugar).
  // ----------------------------------------------------------
  if (accion === "eliminar") {
    if (!idUbicacion) return jsonError("Falta id_ubicacion", 400);

    const cuenta = async (tabla: string, campo: string) => {
      const { count, error } = await supabaseAdmin.from(tabla)
        .select("*", { count: "exact", head: true }).eq(campo, idUbicacion);
      if (error) throw new Error(`${tabla}: ${error.message}`);
      return count ?? 0;
    };

    let enUso;
    try {
      enUso = {
        equipos: await cuenta("equipos", "ubicacion"),
        lotes: await cuenta("material_ubicaciones", "id_ubicacion"),
        material: await cuenta("material", "ubicacion"),
      };
    } catch (e) {
      return jsonError(`No se pudo comprobar si la ubicación está en uso: ${e.message}`, 400);
    }

    const total = enUso.equipos + enUso.lotes + enUso.material;
    if (total > 0) return jsonOk({ eliminada: false, en_uso: enUso });

    const { error } = await supabaseAdmin.from("ubicaciones")
      .delete().eq("id_ubicacion", idUbicacion);
    if (error) {
      if (error.code === "23503") {
        return jsonOk({ eliminada: false, en_uso: { ...enUso, otros: 1 } });
      }
      return jsonError(`No se pudo eliminar: ${error.message}`, 400);
    }
    return jsonOk({ eliminada: true });
  }

  // ----------------------------------------------------------
  // CAMBIAR_ESTADO — la salida digna de una ubicación que ya no se usa pero
  // que sigue nombrada en equipos o lotes: deja de aparecer en los selectores
  // sin romper nada de lo que ya apunta a ella.
  // ----------------------------------------------------------
  if (accion === "cambiar_estado") {
    if (!idUbicacion) return jsonError("Falta id_ubicacion", 400);
    const activa = body.activa === true;
    const { data, error } = await supabaseAdmin.from("ubicaciones")
      .update({ activa }).eq("id_ubicacion", idUbicacion).select().single();
    if (error) return jsonError(`No se pudo cambiar el estado: ${error.message}`, 400);
    if (!data) return jsonError(`No se encontró la ubicación "${idUbicacion}"`, 404);
    return jsonOk({ ubicacion: data });
  }

  if (!idUbicacion || !laboratorioAula) {
    return jsonError("id_ubicacion y laboratorio_aula son obligatorios", 400);
  }

  const datos = {
    id_ubicacion: idUbicacion,
    laboratorio_aula: laboratorioAula,
    zona: body.zona ? String(body.zona) : null,
    subzona: body.subzona ? String(body.subzona) : null,
    descripcion_completa: body.descripcion_completa ? String(body.descripcion_completa) : null,
  };

  if (accion === "crear") {
    const { data, error } = await supabaseAdmin.from("ubicaciones")
      .insert({ ...datos, activa: true }).select().single();
    if (error) {
      if (error.code === "23505") return jsonError(`Ya existe una ubicación con el ID "${idUbicacion}"`, 409);
      return jsonError(`No se pudo crear: ${error.message}`, 400);
    }
    return jsonOk({ ubicacion: data });
  }

  // actualizar
  const idOriginal = String(body.id_original || "").trim();
  if (!idOriginal) return jsonError("Falta id_original para actualizar", 400);

  const { data, error } = await supabaseAdmin.from("ubicaciones")
    .update(datos).eq("id_ubicacion", idOriginal).select().single();
  if (error) {
    if (error.code === "23505") return jsonError(`Ya existe una ubicación con el ID "${idUbicacion}"`, 409);
    return jsonError(`No se pudo actualizar: ${error.message}`, 400);
  }
  if (!data) return jsonError(`No se encontró la ubicación "${idOriginal}"`, 404);

  // ----------------------------------------------------------
  // RENOMBRAR — el ID es la clave primaria, así que cambiarlo arrastra por
  // clave ajena en cascada lo que sí la tiene (`material_ubicaciones`,
  // `propuestas_material`, `propuestas_ubicacion_equipo`). Pero `equipos.ubicacion`
  // y `material.ubicacion` guardan el ID como TEXTO suelto, sin FK (ver el
  // comentario de schema.sql: datos pendientes de limpiar) — si no se repasan
  // aquí, el equipo se queda nombrando una ubicación que ya no existe y
  // desaparece de su laboratorio sin que nadie lo toque. Coincidencia exacta:
  // los campos que aún llevan texto libre tipo "Lab 205" no se tocan.
  // ----------------------------------------------------------
  const renombrada = { equipos: 0, material: 0 };
  if (idUbicacion !== idOriginal) {
    const arrastrar = async (tabla: string, campo: string) => {
      const { data: filas, error: errUp } = await supabaseAdmin.from(tabla)
        .update({ [campo]: idUbicacion }).eq(campo, idOriginal).select(campo);
      if (errUp) throw new Error(`${tabla}: ${errUp.message}`);
      return filas?.length ?? 0;
    };
    try {
      renombrada.equipos  = await arrastrar("equipos", "ubicacion");
      renombrada.material = await arrastrar("material", "ubicacion");
    } catch (e) {
      return jsonError(
        `La ubicación se renombró a "${idUbicacion}", pero no se pudieron actualizar ` +
        `las referencias: ${e.message}. Recarga y revisa los equipos de esa zona.`, 400);
    }
  }

  return jsonOk({ ubicacion: data, id_original: idOriginal, renombrada });
});
