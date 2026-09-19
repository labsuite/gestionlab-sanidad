// Inventario colaborativo — fase A: ubicación concreta de los equipos.
//
// El catálogo `ubicaciones` ya tiene el detalle fino (lab / zona / subzona,
// p.ej. 203-3.7.1 = "203 / Derecha / 3º cajón encimera"), pero la mayoría de
// equipos siguen con "Lab 203" a secas. El alumnado recorre el laboratorio y
// propone el emparejamiento; nada toca `equipos` hasta que se acepta.
//
// Roles:
// - crear: cualquier sesión válida (Alumno incluido). Se auto-aplica en dos
//   casos, ver `aplicarUbicacion`:
//     · quien propone ya es staff (Admin/Gestor/Profesor) — es quien validaría;
//     · doble verificación — otra persona ya propuso esa misma ubicación para
//       ese mismo equipo y sigue pendiente.
// - aceptar / aceptar_varias / rechazar: staff (requireStaff). `revisado_por`
//   lo pone el servidor con el nombre de quien valida — nunca llega del cliente.
import { requireStaff, requireValidSession, firmaAlumnado, jsonError, jsonOk, handleCorsPreflight } from "../_shared/auth.ts";

const ROLES_STAFF = ["Administrador", "Gestor", "Profesor"];

function genId(prefix: string): string {
  return prefix + Date.now().toString(36).toUpperCase().slice(-6) + Math.floor(Math.random() * 36).toString(36).toUpperCase();
}

/** Nombre y rol de quien llama: primero `users` (cuentas con login real), luego el catálogo `usuarios`. */
async function identificar(supabaseAdmin: any, email: string) {
  const { data: u } = await supabaseAdmin
    .from("users").select("nombre, rol, activo").eq("email", email).maybeSingle();
  if (u && u.activo) return { nombre: u.nombre || email, rol: u.rol || "Alumno" };
  const { data: c } = await supabaseAdmin
    .from("usuarios").select("nombre, rol, activo").ilike("email", email).maybeSingle();
  if (c && c.activo) return { nombre: c.nombre || email, rol: c.rol || "Alumno" };
  return { nombre: email, rol: "Alumno" };
}

/** Escribe la ubicación en el equipo y marca la(s) propuesta(s) como aceptadas. */
async function aplicarUbicacion(supabaseAdmin: any, propuesta: any, revisadoPor: string, idsExtra: string[] = []) {
  await supabaseAdmin.from("equipos")
    .update({ ubicacion: propuesta.id_ubicacion })
    .eq("id_activo", propuesta.id_equipo);
  const ids = [propuesta.id_propuesta, ...idsExtra];
  await supabaseAdmin.from("propuestas_ubicacion_equipo")
    .update({ estado: "aceptada", revisado_por: revisadoPor, fecha_revision: new Date().toISOString() })
    .in("id_propuesta", ids);
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

  // ── crear: abierto a cualquier sesión válida ──────────────────────────
  if (accion === "crear") {
    const { error: authError, email, supabaseAdmin } = await requireValidSession(req);
    if (authError) return authError;

    const idEquipo = String(body.id_equipo || "").trim();
    const noEncontrado = body.no_encontrado === true;
    const idUbicacion = String(body.id_ubicacion || "").trim();
    if (!idEquipo) return jsonError("id_equipo es obligatorio", 400);
    if (!noEncontrado && !idUbicacion) return jsonError("Elige una ubicación", 400);

    const { data: equipo } = await supabaseAdmin
      .from("equipos").select("id_activo, ubicacion").eq("id_activo", idEquipo).maybeSingle();
    if (!equipo) return jsonError("Equipo no encontrado", 404);

    if (!noEncontrado) {
      const { data: ubic } = await supabaseAdmin
        .from("ubicaciones").select("id_ubicacion").eq("id_ubicacion", idUbicacion).maybeSingle();
      if (!ubic) return jsonError("Ubicación no encontrada en el catálogo", 404);
    }

    const { nombre, rol } = await identificar(supabaseAdmin, email);
    // En la cola de validación consta el grupo ("1º CS LCB"), no una persona.
    const firma = ROLES_STAFF.includes(rol) ? nombre : firmaAlumnado(email, nombre);

    // Repetición: si esta misma cuenta ya propuso EXACTAMENTE esto mismo para este
    // equipo y sigue pendiente, se sustituye en vez de acumular duplicados.
    //
    // Ojo: la condición incluye la ubicación propuesta a propósito. El alumnado
    // entra con una cuenta compartida por todo su grupo, así que borrar "todo lo
    // pendiente de este email para este equipo" haría que la propuesta de un
    // alumno borrase la de su compañero. Si dos personas del mismo grupo dicen
    // sitios distintos, las dos propuestas se guardan y la cola de validación las
    // muestra en conflicto, que es justo lo que hay que revisar a mano.
    let repetidas = supabaseAdmin.from("propuestas_ubicacion_equipo")
      .delete()
      .eq("id_equipo", idEquipo)
      .eq("estado", "pendiente")
      .eq("no_encontrado", noEncontrado)
      .ilike("email_propuesto_por", email);
    repetidas = noEncontrado
      ? repetidas.is("id_ubicacion", null)
      : repetidas.eq("id_ubicacion", idUbicacion);
    await repetidas;

    const datos = {
      id_propuesta: genId("PUB"),
      id_equipo: idEquipo,
      id_ubicacion: noEncontrado ? null : idUbicacion,
      no_encontrado: noEncontrado,
      ubicacion_anterior: equipo.ubicacion || null,
      propuesto_por: firma,
      email_propuesto_por: email,
      observaciones: String(body.observaciones || "") || null,
      estado: "pendiente",
    };
    const { data: propuesta, error } = await supabaseAdmin
      .from("propuestas_ubicacion_equipo").insert(datos).select().single();
    if (error) return jsonError(`No se pudo guardar la propuesta: ${error.message}`, 400);

    // Un aviso de "no lo encuentro" nunca se aplica solo: no propone ubicación.
    if (noEncontrado) return jsonOk({ propuesta, aplicada: false });

    // 1) Quien propone ya es quien validaría → se aplica directa.
    if (ROLES_STAFF.includes(rol)) {
      await aplicarUbicacion(supabaseAdmin, propuesta, nombre);
      return jsonOk({ propuesta: { ...propuesta, estado: "aceptada", revisado_por: nombre }, aplicada: true, motivo: "staff" });
    }

    // 2) Doble verificación: otra persona ya propuso lo mismo y sigue pendiente.
    const { data: coincidencias } = await supabaseAdmin
      .from("propuestas_ubicacion_equipo")
      .select("id_propuesta, propuesto_por, email_propuesto_por")
      .eq("id_equipo", idEquipo)
      .eq("id_ubicacion", idUbicacion)
      .eq("estado", "pendiente")
      .neq("id_propuesta", propuesta.id_propuesta);
    const otra = (coincidencias || []).find((c: any) =>
      (c.email_propuesto_por || "").toLowerCase() !== email);
    if (otra) {
      // Ya no hay nombres propios en `propuesto_por` (grupo o docente), así que
      // se puede decir quién coincidió: "1º CS LCB + 2º CS LCB".
      const revisadoPor = `Doble verificación (${otra.propuesto_por} + ${firma})`;
      await aplicarUbicacion(supabaseAdmin, propuesta, revisadoPor,
        (coincidencias || []).map((c: any) => c.id_propuesta));
      return jsonOk({
        propuesta: { ...propuesta, estado: "aceptada", revisado_por: revisadoPor },
        aplicada: true, motivo: "doble_verificacion",
      });
    }

    return jsonOk({ propuesta, aplicada: false });
  }

  // ── validar: solo staff ───────────────────────────────────────────────
  if (accion === "aceptar" || accion === "aceptar_varias" || accion === "rechazar") {
    const { error: authError, user, supabaseAdmin } = await requireStaff(req);
    if (authError) return authError;
    const revisadoPor = user.nombre || user.email;

    const ids: string[] = accion === "aceptar_varias"
      ? (Array.isArray(body.ids_propuesta) ? body.ids_propuesta.map(String) : [])
      : [String(body.id_propuesta || "").trim()];
    if (!ids.length || ids.some((i) => !i)) return jsonError("Falta el id de la propuesta", 400);

    const { data: propuestas } = await supabaseAdmin
      .from("propuestas_ubicacion_equipo").select("*").in("id_propuesta", ids);
    if (!propuestas || !propuestas.length) return jsonError("Propuesta no encontrada", 404);

    if (accion === "rechazar") {
      await supabaseAdmin.from("propuestas_ubicacion_equipo")
        .update({
          estado: "rechazada", revisado_por: revisadoPor,
          fecha_revision: new Date().toISOString(),
          notas_revision: String(body.notas_revision || "") || null,
        })
        .in("id_propuesta", ids);
      return jsonOk({ rechazadas: ids, revisado_por: revisadoPor });
    }

    // Aceptar. Un aviso de "no lo encuentro" se archiva sin tocar el equipo.
    const equiposTocados: string[] = [];
    for (const p of propuestas) {
      if (p.no_encontrado || !p.id_ubicacion) {
        await supabaseAdmin.from("propuestas_ubicacion_equipo")
          .update({ estado: "aceptada", revisado_por: revisadoPor, fecha_revision: new Date().toISOString() })
          .eq("id_propuesta", p.id_propuesta);
        continue;
      }
      await aplicarUbicacion(supabaseAdmin, p, revisadoPor);
      equiposTocados.push(p.id_equipo);
    }

    // Las demás propuestas pendientes de esos equipos quedan obsoletas.
    if (equiposTocados.length) {
      await supabaseAdmin.from("propuestas_ubicacion_equipo")
        .update({
          estado: "rechazada", revisado_por: revisadoPor,
          fecha_revision: new Date().toISOString(),
          notas_revision: "Se aceptó otra propuesta para el mismo equipo",
        })
        .in("id_equipo", equiposTocados)
        .eq("estado", "pendiente");
    }

    const { data: equipos } = equiposTocados.length
      ? await supabaseAdmin.from("equipos").select("*").in("id_activo", equiposTocados)
      : { data: [] };
    return jsonOk({ aceptadas: ids, equipos: equipos || [], revisado_por: revisadoPor });
  }

  return jsonError("accion no reconocida", 400);
});
