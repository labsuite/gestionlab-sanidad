// Prueba de la verificación extraordinaria tras una reparación (supabase/functions/_shared/verif_extra.ts)
// CONTRA LA BASE, con datos ficticios que se borran al terminar (también si algo falla):
//   SUPABASE_JS=…/node_modules/@supabase/supabase-js/dist/index.mjs node tools/verif-pipetas/extraordinaria.test.mjs
// Usa PIP-038 (5 ml, los dos volúmenes por balanza) y una sesión ficticia del curso 2099-2100 con
// sus resultados gravimétricos ya escritos (es lo que lee el cálculo). Deja la pipeta como estaba.
import { readFileSync } from "node:fs";
import { guardarExtraordinaria, cierreOperativoPermitido } from "../../supabase/functions/_shared/verif_extra.ts";

const ruta = process.env.SUPABASE_JS;
if (!ruta) throw new Error("Pon en SUPABASE_JS la ruta de @supabase/supabase-js (…/dist/index.mjs)");
const { createClient } = await import("file:///" + ruta.replace(/\\/g, "/").replace(/^file:\/+/, ""));
const cred = JSON.parse(readFileSync("scripts/supabase_credentials.json", "utf8"));
const db = createClient(cred.project_url, cred.service_role_key, { auth: { persistSession: false } });

let ok = 0, mal = 0;
const comprueba = (n, c) => { if (c) { ok++; console.log("✓", n); } else { mal++; console.log("✗", n); } };

const PIP = "PIP-038", CURSO = "2099-2100";
const sufijo = Math.random().toString(36).slice(2, 6).toUpperCase();
const INC = "INC-T" + sufijo, SES = "VS-T" + sufijo;
const { data: eq } = await db.from("equipos").select("estado_operativo").eq("id_activo", PIP).single();
const estadoAntes = eq.estado_operativo;
const ids = [];
// Réplicas por balanza: g de agua entregada (Z = 1,0033 → 5000 µl ≈ 4,9836 g; 500 µl ≈ 0,4984 g)
const reps = (a, b) => Array.from({ length: 10 }, (_, i) => ({ m: i % 2 ? a : b, A: "" }));
const ver = (r5000, r500) => ({ fases: [{ tipo: "inicial", volumenes: {
  nominal: { id_sesion: SES, lote_sc: "1", canales: [{ replicas: r5000 }] },
  bajo: { id_sesion: SES, lote_sc: "1", canales: [{ replicas: r500 }] } } }] });

try {
  await db.from("incidencias").insert({ id_incidencia: INC, id_equipo: PIP, reportado_por: "Prueba automática",
    descripcion_problema: "Prueba: junta cambiada.", impacto: "Equipo fuera de servicio", urgencia: "Media", estado: "Abierta" });
  await db.from("equipos").update({ estado_operativo: "Fuera de servicio" }).eq("id_activo", PIP);
  await db.from("verif_sesiones").insert({ id: SES, curso_academico: CURSO, fecha: "2099-10-01", datos: {}, registrado_por: "Prueba",
    resultados: { valida_grav: true, valida_fot: false, motivos_grav: [], motivos_fot: [], z: 1.0033, s_balanza: 0.001, disoluciones: {} } });

  comprueba("sin extraordinaria: no deja volver a «Operativo»", !!(await cierreOperativoPermitido(db, INC, "Resuelta", "Operativo")));
  comprueba("…pero sí cerrar dejándola fuera de servicio", (await cierreOperativoPermitido(db, INC, "Resuelta", "Fuera de servicio")) === null);
  comprueba("…y descartar la incidencia", (await cierreOperativoPermitido(db, INC, "Descartada", "Operativo")) === null);

  // Con 4 réplicas no hay resultado: sin cribado hacen falta 10
  const cuatro = { fases: [{ tipo: "inicial", volumenes: { nominal: { id_sesion: SES, canales: [{ replicas: reps("4,984", "4,983").slice(0, 4) }] } } }] };
  const r0 = await guardarExtraordinaria(db, { id_equipo: PIP, id_incidencia: INC, curso_academico: CURSO, verificacion: cuatro, finalizar: true }, "Prueba");
  comprueba("con 4 réplicas no se puede finalizar", !!r0.error && /no tiene resultado/.test(r0.error));

  // Guardar a medias y finalizar con mucha dispersión → RETIRAR
  const r1 = await guardarExtraordinaria(db, { id_equipo: PIP, id_incidencia: INC, curso_academico: CURSO, verificacion: cuatro }, "Prueba");
  comprueba("guarda el progreso", !r1.error && r1.extra?.estado === "en_curso");
  if (r1.extra) ids.push(r1.extra.id);
  const r2 = await guardarExtraordinaria(db, { id: r1.extra.id, verificacion: ver(reps("4,984", "4,983"), reps("0,480", "0,520")), finalizar: true }, "Prueba");
  comprueba("réplicas muy dispersas → RETIRAR", r2.extra?.estado === "finalizada" && /^RETIRAR/.test(r2.extra?.resultado || ""));
  comprueba("…la pipeta sigue fuera de servicio", r2.equipo_estado === "Fuera de servicio");
  comprueba("…y el resultado queda en la incidencia", /Verificación extraordinaria .*RETIRAR/.test(r2.incidencia?.descripcion_problema || ""));
  comprueba("…sigue sin dejar volver a «Operativo»", !!(await cierreOperativoPermitido(db, INC, "Resuelta", "Operativo")));
  const r2b = await guardarExtraordinaria(db, { id: r1.extra.id, verificacion: ver(reps("4,984", "4,983"), reps("0,498", "0,499")) }, "Prueba");
  comprueba("una finalizada ya no se cambia", !!r2b.error);

  // Nueva extraordinaria, buena → OK
  const r3 = await guardarExtraordinaria(db, { id_equipo: PIP, id_incidencia: INC, curso_academico: CURSO,
    verificacion: ver(reps("4,984", "4,983"), reps("0,498", "0,499")), finalizar: true, fecha: "2099-10-02" }, "Prueba");
  if (r3.extra) ids.push(r3.extra.id);
  comprueba("réplicas buenas → OK", /^OK/.test(r3.extra?.resultado || ""), r3.error);
  comprueba("…sin tocar el estado de la pipeta (lo decide quien cierra)", r3.equipo_estado === null);
  comprueba("…10 réplicas por volumen, sin cribado", r3.extra?.verificacion?.sin_cribado === true &&
    r3.extra.verificacion.calculo.fases[0].volumenes.nominal.canales[0].n === 10);
  comprueba("con la OK ya deja cerrar como «Operativo»", (await cierreOperativoPermitido(db, INC, "Resuelta", "Operativo")) === null);

  const r4 = await guardarExtraordinaria(db, { id_equipo: "PIP-007", id_incidencia: INC, curso_academico: CURSO, verificacion: cuatro }, "Prueba");
  comprueba("la incidencia tiene que ser de esa pipeta", !!r4.error);
} finally {
  if (ids.length) await db.from("verif_extraordinarias").delete().in("id", ids);
  await db.from("verif_extraordinarias").delete().eq("id_incidencia", INC);
  await db.from("verif_sesiones").delete().eq("id", SES);
  await db.from("incidencias").delete().eq("id_incidencia", INC);
  await db.from("equipos").update({ estado_operativo: estadoAntes }).eq("id_activo", PIP);
  const { data: e2 } = await db.from("equipos").select("estado_operativo").eq("id_activo", PIP).single();
  const { count } = await db.from("verif_extraordinarias").select("id", { count: "exact", head: true }).eq("id_incidencia", INC);
  comprueba(`limpieza: nada de la prueba y ${PIP} vuelve a «${estadoAntes}»`, !count && e2.estado_operativo === estadoAntes);
}
console.log(`\n${ok}/${ok + mal} comprobaciones correctas`);
if (mal) process.exit(1);
