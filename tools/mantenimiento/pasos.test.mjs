// Pruebas de los pasos de un mantenimiento (supabase/functions/_shared/mant_pasos.ts).
//
//   node tools/mantenimiento/pasos.test.mjs            → solo lo que no toca la base
//   node tools/mantenimiento/pasos.test.mjs --base     → además, intervenciones contra la base
//
// Con --base hace falta supabase-js (ruta en SUPABASE_JS, p. ej. un `npm i @supabase/supabase-js`
// en una carpeta temporal) y scripts/supabase_credentials.json. Crea un registro FICTICIO
// (curso 2099-2100) en un equipo cualquiera, comprueba las intervenciones que salen de sus
// pasos y lo borra todo al terminar, también si algo falla.
import { readFileSync } from "node:fs";
import { parsePasos, faltaEnPaso, resultadoMant, registrarIntervencionesDeMant } from "../../supabase/functions/_shared/mant_pasos.ts";

let ok = 0, mal = 0;
function comprueba(nombre, cond) {
  if (cond) { ok++; console.log("✓", nombre); } else { mal++; console.log("✗", nombre); }
}

// ── Sin base ────────────────────────────────────────────────────────────────
{
  const p = parsePasos([
    { texto: "Limpiar el exterior", hecho: true },                                   // antiguo, sin tipo
    { texto: "Temperatura", criterio: "±1 °C", resultado: "cumple" },                  // antiguo con criterio
    { texto: "Revisar junta", tipo: "comprobar", resultado: "no_cumple", nota: "gastada",
      accion: "intervencion", actuacion: "junta nueva", tipo_intervencion: "Inventado" },
    { texto: "Engrasar si procede", tipo: "comprobar", resultado: "no_cumple", nota: "seco",
      accion: "corregido", actuacion: "engrasado", tipo_intervencion: "Calibración" },
    { texto: "Cable", tipo: "comprobar", resultado: "no_aplica", nota: "x", accion: "reparacion" },
    { texto: "Sustituir tapa", tipo: "sustituir", hecho: true, actuacion: "lote 12", id_intervencion: "INT-AAAAAA" },
    { texto: "Sustituir filtro", tipo: "sustituir", hecho: false, actuacion: "no debe quedar" },
  ]);
  comprueba("paso antiguo sin criterio → hacer", p[0].tipo === "hacer" && p[0].hecho === true);
  comprueba("paso antiguo con criterio → comprobar", p[1].tipo === "comprobar" && p[1].resultado === "cumple" && p[1].hecho);
  comprueba("tipo de intervención desconocido → Sustitución de pieza", p[2].tipo_intervencion === "Sustitución de pieza");
  comprueba("«corregido» no lleva tipo de intervención", p[3].tipo_intervencion === null && p[3].actuacion === "engrasado");
  comprueba("«no aplica» cuenta como hecho y no guarda nota ni acción", p[4].hecho && p[4].nota === null && p[4].accion === null);
  comprueba("sustitución conserva el id de su intervención", p[5].id_intervencion === "INT-AAAAAA");
  comprueba("sustitución sin hacer no guarda pieza", p[6].actuacion === null && p[6].hecho === false);

  comprueba("falta nota en un no cumple", /qué se ha visto/.test(faltaEnPaso(parsePasos([{ texto: "A", tipo: "comprobar", resultado: "no_cumple", accion: "reparacion" }])) || ""));
  comprueba("falta qué se hizo al cambiar una pieza", /qué se ha hecho/.test(faltaEnPaso(parsePasos([{ texto: "A", tipo: "comprobar", resultado: "no_cumple", nota: "v", accion: "intervencion" }])) || ""));
  comprueba("no cumple sin acción (pantalla antigua) se acepta", faltaEnPaso(parsePasos([{ texto: "A", criterio: "c", resultado: "no_cumple", nota: "v" }])) === null);
  comprueba("resultado válido", resultadoMant("apto_tras_intervencion") === "apto_tras_intervencion" && resultadoMant("otro") === null);
}

// ── Con base ────────────────────────────────────────────────────────────────
if (process.argv.includes("--base")) {
  const ruta = process.env.SUPABASE_JS;
  if (!ruta) throw new Error("Pon en SUPABASE_JS la ruta de @supabase/supabase-js (…/node_modules/@supabase/supabase-js/dist/index.mjs)");
  const { createClient } = await import(ruta.startsWith("file:") ? ruta : "file:///" + ruta.replace(/\\/g, "/"));
  const cred = JSON.parse(readFileSync("scripts/supabase_credentials.json", "utf8"));
  const db = createClient(cred.project_url, cred.service_role_key, { auth: { persistSession: false } });

  const { data: plan } = await db.from("planes_mantenimiento").select("id_plan, id_equipo").eq("activo", true).eq("tipo_intervencion", "Interno").limit(1).single();
  const idReg = "RMTEST" + Math.random().toString(36).slice(2, 6).toUpperCase();
  const creadas = [];
  try {
    const { data: reg, error } = await db.from("registro_mantenimientos").insert({
      id_registro: idReg, id_plan: plan.id_plan, id_equipo: plan.id_equipo, curso_academico: "2099-2100",
      periodo: "2099-09", estado: "finalizado", fecha_realizacion: "2099-09-15", realizado_por: "Prueba automática",
      resultado: "apto_tras_intervencion",
      pasos: parsePasos([
        { texto: "Sustituir la tapa del rotor", tipo: "sustituir", hecho: true, actuacion: "tapa nueva, lote 7" },
        { texto: "Revisar junta tórica", tipo: "comprobar", resultado: "no_cumple", nota: "agrietada", accion: "intervencion", actuacion: "junta nueva" },
        { texto: "Engrasar si procede", tipo: "comprobar", resultado: "no_cumple", nota: "seco", accion: "corregido", actuacion: "engrasado" },
        { texto: "Cable", tipo: "comprobar", resultado: "no_cumple", nota: "pelado", accion: "reparacion" },
        { texto: "Limpiar", tipo: "hacer", hecho: true },
      ]),
      verificacion: { fases: [{ tipo: "inicial" }, { tipo: "tras_ajuste", ajustada_por: "Prueba", ajustada_en: "2099-09-15T10:00:00Z" }] },
    }).select().single();
    if (error) throw error;

    const r1 = await registrarIntervencionesDeMant(db, reg);
    r1.intervenciones.forEach((i) => creadas.push(i.id_intervencion));
    comprueba("crea 3 intervenciones (sustitución, pieza cambiada, ajuste de pipeta)", r1.intervenciones.length === 3);
    comprueba("…con su tarea resuelta cada una", r1.tareas.length === 3 && r1.tareas.every((t) => t.resultado === "Resuelto"));
    comprueba("…cerradas y con origen en el mantenimiento", r1.intervenciones.every((i) => i.estado === "Cerrada" && i.actuacion_finalizada && i.origen === `Mantenimiento preventivo ${idReg}`));
    const tipos = r1.intervenciones.map((i) => i.tipo).sort().join(",");
    comprueba("tipos: Calibración + 2 Sustitución de pieza", tipos === "Calibración,Sustitución de pieza,Sustitución de pieza");
    comprueba("los pasos guardan el id de su intervención", r1.registro.pasos[0].id_intervencion && r1.registro.pasos[1].id_intervencion && !r1.registro.pasos[2].id_intervencion && !r1.registro.pasos[3].id_intervencion);
    comprueba("la verificación guarda el id del ajuste", !!r1.registro.verificacion?.intervencion_ajuste);
    comprueba("sin aviso de fallo", !r1.aviso);

    const r2 = await registrarIntervencionesDeMant(db, r1.registro);
    comprueba("repetir no duplica nada", r2.intervenciones.length === 0);

    const r3 = await registrarIntervencionesDeMant(db, { ...r1.registro, estado: "pendiente_vb", pasos: parsePasos([{ texto: "Sustituir X", tipo: "sustituir", hecho: true }]) });
    comprueba("pendiente de visto bueno: no crea intervenciones", r3.intervenciones.length === 0);
  } finally {
    if (creadas.length) {
      await db.from("tareas_intervencion").delete().in("id_intervencion", creadas);
      await db.from("intervenciones").delete().in("id_intervencion", creadas);
    }
    await db.from("registro_mantenimientos").delete().eq("id_registro", idReg);
    const { count } = await db.from("intervenciones").select("id_intervencion", { count: "exact", head: true }).like("origen", `%${idReg}%`);
    comprueba("limpieza: no queda nada de la prueba", !count);
  }
}

console.log(`\n${ok}/${ok + mal} comprobaciones correctas`);
if (mal) process.exit(1);
