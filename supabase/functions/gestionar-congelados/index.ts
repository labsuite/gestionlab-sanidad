// Módulo Muestras congeladas — ver docs/modulo-congelados.md.
// Parte 1: cajas (congelador → caja → casilla). Crear, editar y retirar cajas es
// del profesorado (Admin/Gestor/Profesor); el alumnado solo consulta.
import { requireStaff, autorRegistro, jsonError, jsonOk, handleCorsPreflight } from "../_shared/auth.ts";

function genId(prefix: string): string {
  const abc = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return prefix + Array.from(bytes, (b) => abc[b % abc.length]).join("");
}

const strField = (v: unknown) => {
  const s = (v === null || v === undefined) ? "" : String(v).trim();
  return s === "" ? null : s;
};

function dimension(v: unknown, nombre: string): number | string {
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1 || n > 26) return `${nombre} debe ser un número entero entre 1 y 26`;
  return n;
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

  if (["crear_caja", "editar_caja", "retirar_caja", "reactivar_caja"].includes(accion)) {
    const auth = await requireStaff(req);
    if ("error" in auth && auth.error) return auth.error;
    const { user, supabaseAdmin } = auth as { user: any; supabaseAdmin: any };

    if (accion === "crear_caja" || accion === "editar_caja") {
      const nombre = strField(body.nombre);
      const idEquipo = strField(body.id_equipo);
      if (!nombre) return jsonError("La caja necesita un nombre", 400);
      if (!idEquipo) return jsonError("Elige en qué congelador está la caja", 400);
      const filas = dimension(body.filas, "Filas");
      if (typeof filas === "string") return jsonError(filas, 400);
      const columnas = dimension(body.columnas, "Columnas");
      if (typeof columnas === "string") return jsonError(columnas, 400);

      const { data: eq } = await supabaseAdmin.from("equipos").select("id_activo").eq("id_activo", idEquipo).maybeSingle();
      if (!eq) return jsonError("Ese congelador no existe en el inventario de equipos", 400);

      const datos = {
        nombre, id_equipo: idEquipo, filas, columnas,
        compartimento: strField(body.compartimento),
        descripcion: strField(body.descripcion),
      };

      if (accion === "crear_caja") {
        const { autor } = await autorRegistro(supabaseAdmin, user.email, user.nombre);
        const { data, error } = await supabaseAdmin.from("cajas_congelado")
          .insert({ id_caja: genId("CJ"), ...datos, creado_por: autor }).select().single();
        if (error) return jsonError(`No se pudo crear la caja: ${error.message}`, 400);
        return jsonOk({ caja: data });
      }

      const idCaja = strField(body.id_caja);
      if (!idCaja) return jsonError("id_caja es obligatorio", 400);
      const { data, error } = await supabaseAdmin.from("cajas_congelado")
        .update(datos).eq("id_caja", idCaja).select().maybeSingle();
      if (error) return jsonError(`No se pudo guardar la caja: ${error.message}`, 400);
      if (!data) return jsonError("Caja no encontrada", 404);
      return jsonOk({ caja: data });
    }

    // retirar / reactivar: la caja no se borra (las muestras de la parte 2 guardarán su historial)
    const idCaja = strField(body.id_caja);
    if (!idCaja) return jsonError("id_caja es obligatorio", 400);
    const { data, error } = await supabaseAdmin.from("cajas_congelado")
      .update({ activa: accion === "reactivar_caja" }).eq("id_caja", idCaja).select().maybeSingle();
    if (error) return jsonError(`No se pudo actualizar la caja: ${error.message}`, 400);
    if (!data) return jsonError("Caja no encontrada", 404);
    return jsonOk({ caja: data });
  }

  return jsonError("accion no reconocida", 400);
});
