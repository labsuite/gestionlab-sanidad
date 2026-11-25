// Módulo Registros de uso (Cabina de bioseguridad / Autoclave / Vitrina de gases) — ver
// docs/modulo-registros-uso.md. Sustituyen a las hojas en papel de esos equipos (decisión de
// Paloma del 23/11/2026): recogen lo que pedía la hoja.
//
// - Alta abierta a cualquier rol logueado (incluido Alumno, ver `registros-uso` en `nav` de
//   PERMISOS). Cerrar una sesión ajena: solo Gestor/Administrador; un ciclo de autoclave en
//   marcha lo completa cualquiera (el ciclo es del autoclave, no de quien lo arrancó).
// - Un registro CERRADO ya no se reescribe con guardar_sesion: solo Gestión lo corrige
//   (`corregir_registro`), y queda constancia en `correcciones` de quién, cuándo, por qué y
//   qué ponía antes.
import { requireAdminOrGestor, requireValidSession, jsonError, jsonOk, handleCorsPreflight, nombreCorto } from "../_shared/auth.ts";

const SI_NO = ["Sí", "No"];
const INDICADOR = ["Viró", "No viró", "No se puso"];

type Cfg = {
  tabla: string; prefix: string;
  // Admite sesión abierta (cabina y vitrina: presencia continua; autoclave: ciclo en marcha).
  sesionAbierta: boolean;
  // El autoclave se arranca con sus datos (programa, carga): no hay inicio rápido sin datos.
  arranqueConDatos?: boolean;
  // Un registro abierto lo puede cerrar cualquier sesión (autoclave), no solo quien lo abrió.
  cierraCualquiera?: boolean;
  campos: string[];                         // columnas que escribe el formulario
  numericos?: Record<string, { min: number; max: number; entero?: boolean }>;
  opciones?: Record<string, string[]>;
  requeridosInicio?: string[];              // al arrancar (autoclave)
  requeridosCierre: string[];               // al cerrar o al registrar entero
};

const TABLAS: Record<string, Cfg> = {
  cabina: {
    tabla: "registros_cabina", prefix: "RC", sesionAbierta: true,
    campos: ["practica_tecnica", "grupo_riesgo", "verificacion_previa", "desinfeccion_inicial", "descontaminacion_posterior", "minutos_uv"],
    numericos: { minutos_uv: { min: 0, max: 600, entero: true } },
    opciones: { grupo_riesgo: ["No aplica", "1", "2"], verificacion_previa: SI_NO, desinfeccion_inicial: SI_NO, descontaminacion_posterior: SI_NO },
    requeridosCierre: ["practica_tecnica", "grupo_riesgo"],
  },
  autoclave: {
    tabla: "registros_autoclave", prefix: "RA", sesionAbierta: true, arranqueConDatos: true, cierraCualquiera: true,
    campos: ["programa_ciclo", "tipo_carga", "indicador_biologico", "temperatura_max", "presion_max", "cinta_indicadora", "integrador_quimico"],
    numericos: { temperatura_max: { min: 0, max: 200 }, presion_max: { min: 0, max: 5 } },
    opciones: { indicador_biologico: SI_NO, cinta_indicadora: INDICADOR, integrador_quimico: INDICADOR },
    requeridosInicio: ["programa_ciclo", "tipo_carga"],
    requeridosCierre: ["programa_ciclo", "tipo_carga", "temperatura_max", "presion_max", "cinta_indicadora", "integrador_quimico"],
  },
  vitrina: {
    tabla: "registros_vitrina", prefix: "RV", sesionAbierta: true,
    campos: ["practica_tecnica", "productos_quimicos", "verificacion_previa", "limpieza_posterior"],
    opciones: { verificacion_previa: SI_NO, limpieza_posterior: SI_NO },
    requeridosCierre: ["practica_tecnica", "productos_quimicos"],
  },
};

// Lo que Gestión puede corregir además de los campos del formulario.
const BASE_CORREGIBLE = ["fecha", "hora_inicio", "hora_fin", "incidencias"];
const BIOLOGICO = ["resultado_biologico", "fecha_lectura_biologico"];
const RESULTADO_BIOLOGICO = ["Negativo", "Positivo"];

// Fecha y hora "de pared" en el laboratorio. Las Edge Functions corren en UTC, así que
// `toTimeString()`/`toISOString()` daban 1 h menos en invierno y 2 en verano — y la hora de
// fin, que pone el navegador, sí iba en hora local (sesiones de "2 h" que duraron un minuto).
function ahoraEnVigo(): { fecha: string; hora: string } {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    }).formatToParts(new Date()).map((x) => [x.type, x.value]),
  );
  return { fecha: `${p.year}-${p.month}-${p.day}`, hora: `${p.hour}:${p.minute}` };
}

function strField(v: unknown) {
  return (v === "" || v === null || v === undefined) ? null : String(v).trim() || null;
}

async function nextIdReg(supabaseAdmin: any, tabla: string, prefix: string): Promise<string> {
  const { data } = await supabaseAdmin.from(tabla).select("id_registro");
  const nums = (data || []).map((r: { id_registro: string }) => parseInt((r.id_registro || "").replace(prefix, "")) || 0);
  const max = nums.length ? Math.max(0, ...nums) : 0;
  return prefix + String(max + 1).padStart(4, "0");
}

/** Lee y valida los campos del formulario. Devuelve { campos } o { error }. */
function leerCampos(cfg: Cfg, input: unknown): { campos: Record<string, unknown> } | { error: string } {
  const entrada = (input && typeof input === "object") ? input as Record<string, unknown> : {};
  const campos: Record<string, unknown> = {};
  for (const c of cfg.campos) {
    const v = strField(entrada[c]);
    if (v !== null && cfg.numericos?.[c]) {
      const n = Number(v.replace(",", "."));
      const lim = cfg.numericos[c];
      if (!Number.isFinite(n) || n < lim.min || n > lim.max || (lim.entero && !Number.isInteger(n))) {
        return { error: `Valor no válido en ${c.replace(/_/g, " ")}: «${v}»` };
      }
      campos[c] = n;
    } else if (v !== null && cfg.opciones?.[c] && !cfg.opciones[c].includes(v)) {
      return { error: `Valor no válido en ${c.replace(/_/g, " ")}: «${v}»` };
    } else {
      campos[c] = v;
    }
  }
  return { campos };
}

function faltan(campos: Record<string, unknown>, lista: string[] = []) {
  return lista.filter((c) => campos[c] === null || campos[c] === undefined || campos[c] === "");
}

// Para comparar «antes» y «después» sin que 121 vs "121" o "10:15:00" vs "10:15" cuenten como
// cambio; en una casilla, vacío (registros antiguos) y «No» son lo mismo.
function normal(cfg: Cfg, col: string, v: unknown) {
  if (cfg.opciones?.[col] === SI_NO && (v === null || v === undefined || v === "")) return "No";
  if (v === null || v === undefined || v === "") return null;
  if (col.startsWith("hora_")) return String(v).slice(0, 5);
  return String(v);
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
  const tipo = String(body.tipo || "");
  const cfg = TABLAS[tipo];
  if (!cfg) return jsonError(`tipo debe ser uno de: ${Object.keys(TABLAS).join(", ")}`, 400);
  const { tabla, prefix } = cfg;

  // ── acciones de cualquier sesión válida ──
  if (["iniciar_rapido", "deshacer_inicio", "guardar_sesion", "resultado_biologico"].includes(accion)) {
    const { error: authError, email, supabaseAdmin } = await requireValidSession(req);
    if (authError) return authError;

    if (accion === "iniciar_rapido") {
      if (!cfg.sesionAbierta) return jsonError("Este tipo de equipo no admite sesión abierta", 400);
      if (cfg.arranqueConDatos) return jsonError("El ciclo se arranca con sus datos (programa y tipo de carga)", 400);
      const idEquipo = String(body.id_equipo || "").trim();
      if (!idEquipo) return jsonError("id_equipo es obligatorio", 400);
      const ahora = ahoraEnVigo();
      const idRegistro = await nextIdReg(supabaseAdmin, tabla, prefix);
      const datos = {
        id_registro: idRegistro, id_equipo: idEquipo, usuario: email,
        fecha: ahora.fecha, hora_inicio: ahora.hora,
        estado: "Abierta",
      };
      const { data, error } = await supabaseAdmin.from(tabla).insert(datos).select().single();
      if (error) return jsonError(`No se pudo iniciar la sesión: ${error.message}`, 400);
      return jsonOk({ registro: data });
    }

    if (accion === "deshacer_inicio") {
      const idRegistro = String(body.id_registro || "").trim();
      if (!idRegistro) return jsonError("id_registro es obligatorio", 400);
      const { data: reg } = await supabaseAdmin.from(tabla).select("*").eq("id_registro", idRegistro).maybeSingle();
      if (!reg) return jsonError("Registro no encontrado", 404);
      if ((reg.usuario || "").toLowerCase().trim() !== email.toLowerCase().trim()) {
        return jsonError("Solo quien inició la sesión puede deshacerla", 403);
      }
      if (reg.estado !== "Abierta") return jsonError("Esa sesión ya está cerrada", 400);
      const { error } = await supabaseAdmin.from(tabla).delete().eq("id_registro", idRegistro);
      if (error) return jsonError(`No se pudo deshacer: ${error.message}`, 400);
      return jsonOk({ eliminado: idRegistro });
    }

    // Resultado del indicador biológico, 24–48 h después del ciclo: lo apunta cualquiera, una vez.
    // Cambiarlo después es una corrección (Gestión).
    if (accion === "resultado_biologico") {
      if (tipo !== "autoclave") return jsonError("Solo los ciclos de autoclave llevan indicador biológico", 400);
      const idRegistro = String(body.id_registro || "").trim();
      const resultado = String(body.resultado || "").trim();
      if (!RESULTADO_BIOLOGICO.includes(resultado)) return jsonError("El resultado debe ser Negativo o Positivo", 400);
      const { data: reg } = await supabaseAdmin.from(tabla).select("*").eq("id_registro", idRegistro).maybeSingle();
      if (!reg) return jsonError("Registro no encontrado", 404);
      if (reg.indicador_biologico !== "Sí") return jsonError("Ese ciclo no lleva indicador biológico", 400);
      if (reg.estado !== "Cerrada") return jsonError("Primero hay que completar el ciclo", 400);
      if (reg.resultado_biologico) return jsonError("El resultado ya está apuntado: si hay que cambiarlo, lo corrige Gestión", 400);
      const { data, error } = await supabaseAdmin.from(tabla).update({
        resultado_biologico: resultado, fecha_lectura_biologico: ahoraEnVigo().fecha, biologico_leido_por: email,
      }).eq("id_registro", idRegistro).select().single();
      if (error) return jsonError(`No se pudo guardar: ${error.message}`, 400);
      return jsonOk({ registro: data });
    }

    // guardar_sesion: crear (registro entero, siempre Cerrada; o un ciclo de autoclave que
    // arranca, `abrir`) o cerrar una sesión Abierta que ya existe.
    const idRegistro = strField(body.id_registro);
    const fecha = String(body.fecha || "").trim();
    const horaInicio = String(body.hora_inicio || "").trim();
    const horaFin = strField(body.hora_fin);
    const incidencias = strField(body.incidencias);
    const abrir = body.abrir === true;
    const leidos = leerCampos(cfg, body.campos);
    if ("error" in leidos) return jsonError(leidos.error, 400);
    const { campos } = leidos;

    const requeridos = abrir ? (cfg.requeridosInicio || []) : cfg.requeridosCierre;
    const sinRellenar = faltan(campos, requeridos);
    if (sinRellenar.length) return jsonError(`Falta: ${sinRellenar.map((c) => c.replace(/_/g, " ")).join(", ")}`, 400);
    if (!abrir && cfg.sesionAbierta && !horaFin) return jsonError("Falta la hora de fin", 400);

    if (idRegistro) {
      const { data: reg } = await supabaseAdmin.from(tabla).select("*").eq("id_registro", idRegistro).maybeSingle();
      if (!reg) return jsonError("Registro no encontrado", 404);
      if (reg.estado !== "Abierta") {
        return jsonError("Este registro ya está cerrado: si hay algo mal, avisa al profesorado y lo corrige Gestión", 400);
      }
      if (!cfg.cierraCualquiera) {
        const { data: userRow } = await supabaseAdmin.from("users").select("rol").eq("email", email).maybeSingle();
        const esStaff = userRow && ["Administrador", "Gestor"].includes(userRow.rol);
        if ((reg.usuario || "").toLowerCase().trim() !== email.toLowerCase().trim() && !esStaff) {
          return jsonError("No tienes permiso para cerrar esta sesión", 403);
        }
      }
      const datos = { fecha, hora_inicio: horaInicio, hora_fin: horaFin, incidencias, estado: "Cerrada", ...campos };
      const { data, error } = await supabaseAdmin.from(tabla).update(datos).eq("id_registro", idRegistro).select().single();
      if (error) return jsonError(`No se pudo guardar: ${error.message}`, 400);
      return jsonOk({ registro: data });
    }

    const idEquipo = String(body.id_equipo || "").trim();
    if (!idEquipo || !fecha || !horaInicio) return jsonError("id_equipo, fecha y hora_inicio son obligatorios", 400);
    if (abrir && !cfg.arranqueConDatos) return jsonError("Esta sesión se empieza con «Empezar sesión»", 400);
    if (abrir) {
      const { data: enMarcha } = await supabaseAdmin.from(tabla).select("id_registro")
        .eq("id_equipo", idEquipo).eq("estado", "Abierta").limit(1);
      if (enMarcha?.length) return jsonError("Ese autoclave ya tiene un ciclo en marcha: complétalo antes de arrancar otro", 400);
    }
    const nuevoId = await nextIdReg(supabaseAdmin, tabla, prefix);
    const datos = {
      id_registro: nuevoId, id_equipo: idEquipo, usuario: email, fecha, hora_inicio: horaInicio,
      hora_fin: abrir ? null : horaFin, incidencias, estado: abrir ? "Abierta" : "Cerrada", ...campos,
    };
    const { data, error } = await supabaseAdmin.from(tabla).insert(datos).select().single();
    if (error) return jsonError(`No se pudo guardar: ${error.message}`, 400);
    return jsonOk({ registro: data });
  }

  // ── corregir_registro: Gestión corrige un registro cerrado, dejando constancia ──
  if (accion === "corregir_registro") {
    const { error: authError, user, supabaseAdmin } = await requireAdminOrGestor(req);
    if (authError) return authError;
    const idRegistro = String(body.id_registro || "").trim();
    const motivo = String(body.motivo || "").trim();
    if (!idRegistro) return jsonError("id_registro es obligatorio", 400);
    if (!motivo) return jsonError("Escribe el motivo de la corrección", 400);
    const { data: reg } = await supabaseAdmin.from(tabla).select("*").eq("id_registro", idRegistro).maybeSingle();
    if (!reg) return jsonError("Registro no encontrado", 404);
    if (reg.estado !== "Cerrada") return jsonError("Solo se corrigen registros cerrados", 400);

    const leidos = leerCampos(cfg, body.campos);
    if ("error" in leidos) return jsonError(leidos.error, 400);
    const nuevo: Record<string, unknown> = {
      ...leidos.campos,
      fecha: strField(body.fecha), hora_inicio: strField(body.hora_inicio),
      hora_fin: strField(body.hora_fin), incidencias: strField(body.incidencias),
    };
    if (!nuevo.fecha || !nuevo.hora_inicio) return jsonError("La fecha y la hora de inicio no pueden quedar vacías", 400);
    if (tipo === "autoclave" && (nuevo.indicador_biologico === "Sí" || reg.resultado_biologico)) {
      const res = strField(body.resultado_biologico);
      if (res !== null && !RESULTADO_BIOLOGICO.includes(res)) return jsonError("El resultado del biológico debe ser Negativo o Positivo", 400);
      nuevo.resultado_biologico = res;
      nuevo.fecha_lectura_biologico = res ? (strField(body.fecha_lectura_biologico) || reg.fecha_lectura_biologico) : null;
    }

    const cols = [...BASE_CORREGIBLE, ...cfg.campos, ...(tipo === "autoclave" ? BIOLOGICO : [])];
    const cambios: Record<string, { antes: unknown; despues: unknown }> = {};
    const update: Record<string, unknown> = {};
    for (const c of cols) {
      if (!(c in nuevo)) continue;
      if (normal(cfg, c, reg[c]) !== normal(cfg, c, nuevo[c])) {
        cambios[c] = { antes: reg[c] ?? null, despues: nuevo[c] ?? null };
        update[c] = nuevo[c];
      }
    }
    if (!Object.keys(cambios).length) return jsonError("No has cambiado nada", 400);

    const correccion = {
      fecha_hora: new Date().toISOString(),
      corregido_por: nombreCorto(user.nombre || "") || user.email,
      motivo, cambios,
    };
    update.correcciones = [...(Array.isArray(reg.correcciones) ? reg.correcciones : []), correccion];
    const { data, error } = await supabaseAdmin.from(tabla).update(update).eq("id_registro", idRegistro).select().single();
    if (error) return jsonError(`No se pudo guardar la corrección: ${error.message}`, 400);
    return jsonOk({ registro: data });
  }

  // ── descartar_sesion: solo Admin/Gestor, y solo sesiones abiertas (abiertas por error) ──
  if (accion === "descartar_sesion") {
    const { error: authError, supabaseAdmin } = await requireAdminOrGestor(req);
    if (authError) return authError;
    const idRegistro = String(body.id_registro || "").trim();
    if (!idRegistro) return jsonError("id_registro es obligatorio", 400);
    const { data: reg } = await supabaseAdmin.from(tabla).select("estado").eq("id_registro", idRegistro).maybeSingle();
    if (!reg) return jsonError("Registro no encontrado", 404);
    if (reg.estado !== "Abierta") return jsonError("Un registro cerrado no se borra: se corrige", 400);
    const { error } = await supabaseAdmin.from(tabla).delete().eq("id_registro", idRegistro);
    if (error) return jsonError(`No se pudo eliminar: ${error.message}`, 400);
    return jsonOk({ eliminado: idRegistro });
  }

  return jsonError("accion no reconocida", 400);
});
