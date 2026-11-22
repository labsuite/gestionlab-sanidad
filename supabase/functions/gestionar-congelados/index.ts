// Módulo Muestras congeladas — ver docs/modulo-congelados.md.
// Parte 1: cajas (congelador → caja → casilla). Parte 2: muestras (un registro
// por tubo, agrupados por `id_lote`). Todo lo de aquí es del profesorado
// (Admin/Gestor/Profesor), salvo apuntar un uso (`usar_muestra`) y deshacerlo, que
// puede hacer cualquier sesión (el alumnado firma con el nombre del grupo).
import { requireStaff, requireValidSession, autorRegistro, jsonError, jsonOk, handleCorsPreflight } from "../_shared/auth.ts";

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
const numField = (v: unknown) => {
  if (v === null || v === undefined || String(v).trim() === "") return null;
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
};

const TIPOS = ["Cepa", "Línea celular", "Ácido nucleico", "Suero o plasma", "Reactivo"];
const FORMATOS = ["Bolitas", "Tubo", "Volumen"];

function dimension(v: unknown, nombre: string): number | string {
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1 || n > 26) return `${nombre} debe ser un número entero entre 1 y 26`;
  return n;
}

/** "B7" → { fila: 1, col: 6 } dentro de la caja, o null si no cabe. */
function casillaValida(pos: string, caja: { filas: number; columnas: number }) {
  const m = /^([A-Z])(\d{1,2})$/.exec(pos);
  if (!m) return null;
  const fila = m[1].charCodeAt(0) - 65, col = Number(m[2]) - 1;
  if (fila >= caja.filas || col < 0 || col >= caja.columnas) return null;
  return { fila, col };
}

/** Campos comunes a todos los tubos de un lote, validados. Devuelve string si hay error. */
function camposLote(body: Record<string, unknown>): Record<string, unknown> | string {
  const tipo = strField(body.tipo);
  if (!tipo || !TIPOS.includes(tipo)) return "Tipo de muestra no válido";
  const nombre = strField(body.nombre);
  if (!nombre) return "La muestra necesita un nombre";
  const formato = strField(body.formato);
  if (!formato || !FORMATOS.includes(formato)) return "Formato no válido (bolitas, tubo o volumen)";
  const pase = numField(body.pase);
  if (Number.isNaN(pase) || (pase !== null && (!Number.isInteger(pase) || pase < 0))) return "El pase debe ser un número entero";
  const datos = (body.datos && typeof body.datos === "object" && !Array.isArray(body.datos)) ? body.datos as Record<string, unknown> : {};
  const datosLimpios: Record<string, string> = {};
  for (const [k, v] of Object.entries(datos)) {
    const s = strField(v);
    if (s && /^[a-z0-9_]{1,40}$/.test(k)) datosLimpios[k] = s.slice(0, 500);
  }
  const fecha = (v: unknown) => {
    const s = strField(v);
    return s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
  };
  return {
    tipo, nombre, formato,
    abreviatura: strField(body.abreviatura)?.slice(0, 6) ?? null,
    unidad: formato === "Bolitas" ? "bolitas" : formato === "Tubo" ? "tubo" : (strField(body.unidad) || "µL"),
    pase,
    fecha_congelacion: fecha(body.fecha_congelacion),
    caducidad: fecha(body.caducidad),
    // Reactivos: su material; cepas: la cepa de referencia (Material fungible) de la que proceden
    id_material: (tipo === "Reactivo" || tipo === "Cepa") ? strField(body.id_material) : null,
    datos: datosLimpios,
    observaciones: strField(body.observaciones),
  };
}

async function leerCaja(supabaseAdmin: any, idCaja: string | null) {
  if (!idCaja) return null;
  const { data } = await supabaseAdmin.from("cajas_congelado").select("*").eq("id_caja", idCaja).maybeSingle();
  return data;
}

/** Casillas ya ocupadas en una caja (tubos disponibles), sin contar `excluir`. */
async function ocupadas(supabaseAdmin: any, idCaja: string, excluir: string[] = []) {
  const { data } = await supabaseAdmin.from("muestras_congeladas")
    .select("id_muestra, posicion").eq("id_caja", idCaja).eq("estado", "Disponible");
  return new Set((data || []).filter((m: any) => !excluir.includes(m.id_muestra)).map((m: any) => m.posicion));
}

const MINUTOS_DESHACER = 15;

/**
 * Gasta de un tubo: una bolita, el tubo entero (un solo uso) o `volumen`.
 * Devuelve los campos a actualizar en el tubo y lo gastado/restante, o un string de error.
 * Si no queda nada, el tubo pasa a 'Agotada' y libera la casilla.
 */
function consumir(m: any, volumen: unknown) {
  const actual = Number(m.cantidad_actual ?? 0);
  let gastado: number;
  const cambios: Record<string, unknown> = {};
  if (m.formato === "Bolitas") {
    if (actual < 1) return "Este tubo ya no tiene bolitas";
    gastado = 1;
  } else if (m.formato === "Tubo") {
    gastado = 1;
  } else {
    const v = numField(volumen);
    if (v === null || Number.isNaN(v) || v <= 0) return "Indica cuánto volumen has gastado";
    if (v > actual + 1e-9) return `En el tubo solo quedan ${actual} ${m.unidad || ""}`.trim();
    gastado = v;
    cambios.descongelaciones = Number(m.descongelaciones || 0) + 1;
  }
  const restante = Math.max(0, Math.round((actual - gastado) * 1000) / 1000);
  cambios.cantidad_actual = restante;
  if (restante <= 0) {
    cambios.estado = "Agotada";
    cambios.fecha_baja = new Date().toISOString().slice(0, 10);
    cambios.motivo_baja = "Agotado";
  }
  return { cambios, gastado, restante };
}

async function registrarUso(supabaseAdmin: any, fila: Record<string, unknown>) {
  const { data, error } = await supabaseAdmin.from("usos_muestra")
    .insert({ id_uso: genId("US"), ...fila }).select().single();
  if (error) console.error("usos_muestra:", error.message);
  return data;
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

  // ── USOS: cualquier sesión ─────────────────────────────────────────────
  if (accion === "usar_muestra" || accion === "deshacer_uso") {
    const { error: authError, email, supabaseAdmin } = await requireValidSession(req) as any;
    if (authError) return authError;
    const { autor } = await autorRegistro(supabaseAdmin, email);

    if (accion === "usar_muestra") {
      const idMuestra = strField(body.id_muestra);
      const motivo = strField(body.motivo);
      if (!idMuestra) return jsonError("id_muestra es obligatorio", 400);
      if (!motivo) return jsonError("Indica para qué lo usas", 400);
      const { data: m } = await supabaseAdmin.from("muestras_congeladas").select("*").eq("id_muestra", idMuestra).maybeSingle();
      if (!m) return jsonError("Muestra no encontrada", 404);
      if (m.estado !== "Disponible") return jsonError("Este tubo ya no está en la caja", 400);
      const r = consumir(m, body.cantidad);
      if (typeof r === "string") return jsonError(r, 400);
      // Solo se actualiza si nadie lo ha cambiado mientras tanto
      const { data: nuevo, error } = await supabaseAdmin.from("muestras_congeladas")
        .update(r.cambios).eq("id_muestra", idMuestra).eq("cantidad_actual", m.cantidad_actual).select().maybeSingle();
      if (error) return jsonError(`No se pudo apuntar el uso: ${error.message}`, 400);
      if (!nuevo) return jsonError("Alguien acaba de usar este tubo; recarga y vuelve a intentarlo", 409);
      const uso = await registrarUso(supabaseAdmin, {
        id_muestra: idMuestra, id_lote: m.id_lote, evento: "Uso", autor, motivo: motivo.slice(0, 300),
        cantidad: r.gastado, restante: r.restante, unidad: m.unidad,
      });
      return jsonOk({ muestra: nuevo, uso });
    }

    // deshacer_uso: solo el último uso del tubo, de quien lo apuntó y en los primeros minutos
    const idUso = strField(body.id_uso);
    if (!idUso) return jsonError("id_uso es obligatorio", 400);
    const { data: uso } = await supabaseAdmin.from("usos_muestra").select("*").eq("id_uso", idUso).maybeSingle();
    if (!uso || uso.evento !== "Uso") return jsonError("Uso no encontrado", 404);
    if (uso.autor !== autor) return jsonError("Solo quien apuntó el uso puede deshacerlo", 403);
    if (Date.now() - new Date(uso.fecha).getTime() > MINUTOS_DESHACER * 60000) {
      return jsonError(`Solo se puede deshacer en los ${MINUTOS_DESHACER} minutos siguientes; pide a un docente que corrija la cantidad`, 400);
    }
    const { data: ultimo } = await supabaseAdmin.from("usos_muestra").select("id_uso")
      .eq("id_muestra", uso.id_muestra).order("fecha", { ascending: false }).limit(1).maybeSingle();
    if (ultimo?.id_uso !== idUso) return jsonError("Después de este uso ya se apuntó otro: pide a un docente que corrija la cantidad", 400);
    const { data: m } = await supabaseAdmin.from("muestras_congeladas").select("*").eq("id_muestra", uso.id_muestra).maybeSingle();
    if (!m) return jsonError("Muestra no encontrada", 404);
    const cambios: Record<string, unknown> = {
      cantidad_actual: Number(uso.restante || 0) + Number(uso.cantidad || 0),
      estado: "Disponible", fecha_baja: null, motivo_baja: null,
    };
    if (m.formato === "Volumen") cambios.descongelaciones = Math.max(0, Number(m.descongelaciones || 0) - 1);
    const { data: nuevo, error } = await supabaseAdmin.from("muestras_congeladas")
      .update(cambios).eq("id_muestra", m.id_muestra).select().maybeSingle();
    if (error) {
      if (error.code === "23505") return jsonError(`La casilla ${m.posicion} ya la ocupa otro tubo`, 409);
      return jsonError(`No se pudo deshacer: ${error.message}`, 400);
    }
    await supabaseAdmin.from("usos_muestra").delete().eq("id_uso", idUso);
    return jsonOk({ muestra: nuevo, eliminado: idUso });
  }

  const ACCIONES_STAFF = ["crear_caja", "editar_caja", "retirar_caja", "reactivar_caja",
    "crear_muestras", "editar_muestra", "descartar_muestra"];
  if (!ACCIONES_STAFF.includes(accion)) return jsonError("accion no reconocida", 400);

  const auth = await requireStaff(req);
  if ("error" in auth && auth.error) return auth.error;
  const { user, supabaseAdmin } = auth as { user: any; supabaseAdmin: any };

  // ── CAJAS ──────────────────────────────────────────────────────────────
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
    // Al encoger la caja no puede quedar ningún tubo fuera de la cuadrícula
    const fuera = [...await ocupadas(supabaseAdmin, idCaja)]
      .filter((p) => !casillaValida(String(p), { filas, columnas }));
    if (fuera.length) return jsonError(`No se puede encoger la caja: hay tubos en ${fuera.join(", ")}`, 400);
    const { data, error } = await supabaseAdmin.from("cajas_congelado")
      .update(datos).eq("id_caja", idCaja).select().maybeSingle();
    if (error) return jsonError(`No se pudo guardar la caja: ${error.message}`, 400);
    if (!data) return jsonError("Caja no encontrada", 404);
    return jsonOk({ caja: data });
  }

  if (accion === "retirar_caja" || accion === "reactivar_caja") {
    // La caja no se borra: las muestras guardan su historial
    const idCaja = strField(body.id_caja);
    if (!idCaja) return jsonError("id_caja es obligatorio", 400);
    if (accion === "retirar_caja" && (await ocupadas(supabaseAdmin, idCaja)).size) {
      return jsonError("La caja todavía tiene tubos: sácalos o dalos de baja antes de retirarla", 400);
    }
    const { data, error } = await supabaseAdmin.from("cajas_congelado")
      .update({ activa: accion === "reactivar_caja" }).eq("id_caja", idCaja).select().maybeSingle();
    if (error) return jsonError(`No se pudo actualizar la caja: ${error.message}`, 400);
    if (!data) return jsonError("Caja no encontrada", 404);
    return jsonOk({ caja: data });
  }

  // ── MUESTRAS ───────────────────────────────────────────────────────────
  if (accion === "crear_muestras") {
    const lote = camposLote(body);
    if (typeof lote === "string") return jsonError(lote, 400);
    const caja = await leerCaja(supabaseAdmin, strField(body.id_caja));
    if (!caja) return jsonError("Caja no encontrada", 404);
    if (!caja.activa) return jsonError("Esa caja está retirada", 400);

    const posiciones = Array.isArray(body.posiciones) ? body.posiciones.map((p) => String(p).trim().toUpperCase()) : [];
    if (!posiciones.length) return jsonError("Indica al menos una casilla", 400);
    if (posiciones.length > 200) return jsonError("Demasiados tubos de una vez", 400);
    if (new Set(posiciones).size !== posiciones.length) return jsonError("Hay casillas repetidas", 400);
    const invalidas = posiciones.filter((p) => !casillaValida(p, caja));
    if (invalidas.length) return jsonError(`Casillas fuera de la caja: ${invalidas.join(", ")}`, 400);
    const yaOcupadas = await ocupadas(supabaseAdmin, caja.id_caja);
    const choque = posiciones.filter((p) => yaOcupadas.has(p));
    if (choque.length) return jsonError(`Casillas ya ocupadas: ${choque.join(", ")}`, 409);

    let cantidad: number | null = 1;
    if (lote.formato !== "Tubo") {
      cantidad = numField(body.cantidad_inicial);
      if (cantidad === null || Number.isNaN(cantidad) || cantidad <= 0) {
        return jsonError(lote.formato === "Bolitas" ? "Indica cuántas bolitas tiene cada tubo" : "Indica el volumen de cada tubo", 400);
      }
    }
    if (lote.id_material) {
      const { data: mat } = await supabaseAdmin.from("material").select("id_material").eq("id_material", lote.id_material).maybeSingle();
      if (!mat) return jsonError("El material enlazado no existe en el inventario", 400);
    }

    // Stock nuevo hecho a partir de un tubo: se enlaza al lote de origen y se gasta de él
    let origen: any = null;
    let consumoOrigen: any = null;
    const idOrigen = strField(body.id_muestra_origen);
    if (idOrigen) {
      const { data } = await supabaseAdmin.from("muestras_congeladas").select("*").eq("id_muestra", idOrigen).maybeSingle();
      if (!data) return jsonError("El tubo de origen no existe", 404);
      if (data.estado !== "Disponible") return jsonError("El tubo de origen ya no está en la caja", 400);
      origen = data;
      const r = consumir(origen, body.cantidad_origen);
      if (typeof r === "string") return jsonError(`Tubo de origen: ${r}`, 400);
      consumoOrigen = r;
      (lote as Record<string, unknown>).id_lote_origen = origen.id_lote;
    }

    const { autor } = await autorRegistro(supabaseAdmin, user.email, user.nombre);
    const idLote = genId("LT");
    const filas = posiciones.map((posicion) => ({
      id_muestra: genId("MC"), id_lote: idLote, id_caja: caja.id_caja, posicion,
      cantidad_inicial: cantidad, cantidad_actual: cantidad,
      ...lote, creado_por: autor,
    }));
    const { data, error } = await supabaseAdmin.from("muestras_congeladas").insert(filas).select();
    if (error) {
      if (error.code === "23505") return jsonError("Alguna de esas casillas se acaba de ocupar; recarga la caja", 409);
      return jsonError(`No se pudieron guardar las muestras: ${error.message}`, 400);
    }
    let muestraOrigen = null;
    if (origen) {
      const { data: o } = await supabaseAdmin.from("muestras_congeladas")
        .update(consumoOrigen.cambios).eq("id_muestra", origen.id_muestra).select().maybeSingle();
      muestraOrigen = o;
      await registrarUso(supabaseAdmin, {
        id_muestra: origen.id_muestra, id_lote: origen.id_lote, evento: "Nuevo stock", autor,
        motivo: `Nuevo stock: ${filas.length} tubo${filas.length > 1 ? "s" : ""}${lote.pase != null ? ` (pase ${lote.pase})` : ""}`,
        cantidad: consumoOrigen.gastado, restante: consumoOrigen.restante, unidad: origen.unidad, id_lote_nuevo: idLote,
      });
    }
    return jsonOk({ muestras: muestraOrigen ? [...data, muestraOrigen] : data });
  }

  if (accion === "editar_muestra") {
    const idMuestra = strField(body.id_muestra);
    if (!idMuestra) return jsonError("id_muestra es obligatorio", 400);
    const { data: actual } = await supabaseAdmin.from("muestras_congeladas").select("*").eq("id_muestra", idMuestra).maybeSingle();
    if (!actual) return jsonError("Muestra no encontrada", 404);
    const lote = camposLote(body);
    if (typeof lote === "string") return jsonError(lote, 400);

    // Lo propio del tubo: caja, casilla y cantidad que queda
    const tubo: Record<string, unknown> = {};
    const idCaja = strField(body.id_caja) || actual.id_caja;
    const posicion = (strField(body.posicion) || actual.posicion).toUpperCase();
    if (idCaja !== actual.id_caja || posicion !== actual.posicion) {
      const caja = await leerCaja(supabaseAdmin, idCaja);
      if (!caja) return jsonError("Caja no encontrada", 404);
      if (!caja.activa) return jsonError("Esa caja está retirada", 400);
      if (!casillaValida(posicion, caja)) return jsonError(`La casilla ${posicion} no existe en esa caja`, 400);
      if (actual.estado === "Disponible" && (await ocupadas(supabaseAdmin, idCaja, [idMuestra])).has(posicion)) {
        return jsonError(`La casilla ${posicion} ya está ocupada`, 409);
      }
      tubo.id_caja = idCaja;
      tubo.posicion = posicion;
    }
    if (lote.formato === "Tubo") {
      tubo.cantidad_inicial = 1;
      if (actual.formato !== "Tubo") tubo.cantidad_actual = 1;
    } else if (body.cantidad_actual !== undefined) {
      const c = numField(body.cantidad_actual);
      if (c === null || Number.isNaN(c) || c < 0) return jsonError("La cantidad que queda no es válida", 400);
      tubo.cantidad_actual = c;
      const ini = numField(body.cantidad_inicial);
      if (ini !== null && !Number.isNaN(ini) && ini > 0) tubo.cantidad_inicial = ini;
    }

    // Lo común se aplica a todos los tubos del lote
    const { error: e1 } = await supabaseAdmin.from("muestras_congeladas").update(lote).eq("id_lote", actual.id_lote);
    if (e1) return jsonError(`No se pudo guardar: ${e1.message}`, 400);
    if (tubo.cantidad_actual !== undefined && Number(tubo.cantidad_actual) !== Number(actual.cantidad_actual)) {
      const { autor } = await autorRegistro(supabaseAdmin, user.email, user.nombre);
      await registrarUso(supabaseAdmin, {
        id_muestra: idMuestra, id_lote: actual.id_lote, evento: "Ajuste", autor,
        motivo: `Corregido: de ${actual.cantidad_actual} a ${tubo.cantidad_actual}`,
        restante: tubo.cantidad_actual, unidad: lote.unidad,
      });
    }
    if (Object.keys(tubo).length) {
      const { error: e2 } = await supabaseAdmin.from("muestras_congeladas").update(tubo).eq("id_muestra", idMuestra);
      if (e2) {
        if (e2.code === "23505") return jsonError(`La casilla ${posicion} ya está ocupada`, 409);
        return jsonError(`No se pudo guardar: ${e2.message}`, 400);
      }
    }
    const { data } = await supabaseAdmin.from("muestras_congeladas").select("*").eq("id_lote", actual.id_lote);
    return jsonOk({ muestras: data });
  }

  // descartar_muestra: el tubo sale de la caja (la casilla queda libre) pero no se borra
  const idMuestra = strField(body.id_muestra);
  if (!idMuestra) return jsonError("id_muestra es obligatorio", 400);
  const motivo = strField(body.motivo);
  if (!motivo) return jsonError("Indica el motivo del descarte", 400);
  const { data: actual } = await supabaseAdmin.from("muestras_congeladas").select("id_lote").eq("id_muestra", idMuestra).maybeSingle();
  if (!actual) return jsonError("Muestra no encontrada", 404);
  let q = supabaseAdmin.from("muestras_congeladas")
    .update({ estado: "Descartada", fecha_baja: new Date().toISOString().slice(0, 10), motivo_baja: motivo })
    .eq("estado", "Disponible");
  q = body.todo_el_lote === true ? q.eq("id_lote", actual.id_lote) : q.eq("id_muestra", idMuestra);
  const { data, error } = await q.select();
  if (error) return jsonError(`No se pudo descartar: ${error.message}`, 400);
  const { autor } = await autorRegistro(supabaseAdmin, user.email, user.nombre);
  for (const t of data || []) {
    await registrarUso(supabaseAdmin, {
      id_muestra: t.id_muestra, id_lote: t.id_lote, evento: "Descarte", autor, motivo,
      restante: t.cantidad_actual, unidad: t.unidad,
    });
  }
  return jsonOk({ muestras: data });
});
