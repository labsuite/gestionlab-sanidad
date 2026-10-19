// Edge Function PÚBLICA «lab-pendientes» — Pendientes del laboratorio (GestionLab).
//
// La usa pendientes.html (GitHub Pages de GestionLab) para que el profesorado
// vea y complete la lista de pendientes SIN iniciar sesión. La seguridad la da
// el token del enlace (?t=…): aquí solo se guarda su SHA-256 en
// lab_pendientes_enlaces, y un token que no coincide con un enlace activo
// recibe siempre el mismo 404 genérico. El navegador manda la anon key del
// proyecto como Authorization (igual que pedido-publico en GestionLab), así que
// verify_jwt sigue activado en el despliegue.
//
// Proyecto: sanidade-cma (compartido con GestionLab para ciclos y módulos).
// Tablas: lab_pendientes, lab_pendientes_notas, lab_pendientes_config,
// lab_pendientes_enlaces (RLS sin políticas: solo service_role).
// Bucket privado: lab-pendientes (20 MB por archivo).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const BUCKET = "lab-pendientes";
const MAX_BYTES = 20 * 1024 * 1024;
const TIPOS_MIME = new Set([
  "image/jpeg", "image/png", "image/webp", "image/gif", "image/heic", "image/heif",
  "application/pdf", "video/mp4", "video/webm", "video/quicktime", "text/plain", "text/csv",
  "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.oasis.opendocument.text", "application/vnd.oasis.opendocument.spreadsheet",
]);
const ESTADOS = ["pendiente", "en_curso", "hecho", "descartado"];
const TIPOS = ["etiqueta", "decision", "documento", "compra", "gestion"];
const LABS = ["201", "203", "205", "207", "209"];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ID_RE = /^[a-z0-9-]{1,40}$/;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", ...CORS } });
const fallo = (mensaje: string, status = 400) => json({ error: mensaje }, status);
const txt = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);

async function sha256(s: string): Promise<string> {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
}

function admin() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });
}
type SB = ReturnType<typeof admin>;

async function existeTarea(sb: SB, id: string) {
  if (!ID_RE.test(id)) return null;
  const { data } = await sb.from("lab_pendientes").select("id, estado").eq("id", id).eq("archivada", false).maybeSingle();
  return data;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return fallo("Método no permitido", 405);

  const crudo = await req.text();
  if (crudo.length > 200_000) return fallo("Petición demasiado grande", 413);
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(crudo);
  } catch {
    return fallo("Cuerpo inválido (se esperaba JSON)", 400);
  }

  const sb = admin();
  const token = txt(body.t, 200);
  if (token.length < 20) return fallo("Enlace no válido o caducado", 404);
  const { data: enlace } = await sb
    .from("lab_pendientes_enlaces").select("id")
    .eq("token_hash", await sha256(token)).eq("activo", true).maybeSingle();
  if (!enlace) return fallo("Enlace no válido o caducado", 404);

  const accion = txt(body.accion, 30);
  const ahora = new Date().toISOString();
  const autor = txt(body.autor, 80);

  try {
    if (accion === "listar") {
      const [cfg, tareas, notas] = await Promise.all([
        sb.from("lab_pendientes_config").select("clave, valor"),
        sb.from("lab_pendientes").select("*").eq("archivada", false).order("orden", { ascending: true }).limit(2000),
        sb.from("lab_pendientes_notas")
          .select("id, pendiente_id, tipo, autor, texto, adjuntos, creado")
          .eq("borrada", false).order("creado", { ascending: true }).limit(5000),
      ]);
      const error = cfg.error || tareas.error || notas.error;
      if (error) return fallo("No se pudo leer la lista: " + error.message, 500);
      const filas = notas.data || [];
      const rutas = filas.flatMap((n) => (Array.isArray(n.adjuntos) ? n.adjuntos : []).map((a: { path?: string }) => a?.path)).filter(Boolean) as string[];
      const urls: Record<string, string> = {};
      for (let i = 0; i < rutas.length; i += 200) {
        const { data } = await sb.storage.from(BUCKET).createSignedUrls(rutas.slice(i, i + 200), 4 * 3600);
        for (const d of data || []) if (d.path && d.signedUrl) urls[d.path] = d.signedUrl;
      }
      for (const n of filas) {
        n.adjuntos = (Array.isArray(n.adjuntos) ? n.adjuntos : []).map((a: Record<string, unknown>) => ({ ...a, url: urls[String(a.path)] || null }));
      }
      const config = Object.fromEntries((cfg.data || []).map((r) => [r.clave, r.valor]));
      return json({ config, tareas: tareas.data || [], notas: filas, ahora });
    }

    if (accion === "estado") {
      const id = txt(body.id, 40), estado = txt(body.estado, 20);
      if (!ESTADOS.includes(estado)) return fallo("Estado no válido");
      const t = await existeTarea(sb, id);
      if (!t) return fallo("La tarea no existe", 404);
      if (t.estado === estado) return json({ ok: true });
      const u = await sb.from("lab_pendientes").update({ estado, actualizado: ahora }).eq("id", id);
      if (u.error) return fallo("No se pudo cambiar el estado: " + u.error.message, 500);
      await sb.from("lab_pendientes_notas").insert({ pendiente_id: id, tipo: "estado", autor, texto: `${t.estado}>${estado}` });
      return json({ ok: true });
    }

    if (accion === "subir") {
      const id = txt(body.id, 40), nombre = txt(body.nombre, 160), tipo = txt(body.tipo, 120);
      const bytes = Number(body.bytes);
      if (!TIPOS_MIME.has(tipo)) return fallo(`Tipo de archivo no admitido (${tipo || "desconocido"})`);
      if (!(bytes > 0 && bytes <= MAX_BYTES)) return fallo("El archivo pesa más de 20 MB");
      if (!(await existeTarea(sb, id))) return fallo("La tarea no existe", 404);
      const limpio = nombre.normalize("NFD").replace(/[̀-ͯ]/g, "")
        .replace(/[^a-zA-Z0-9_.-]+/g, "_").replace(/^_+/, "").slice(-100) || "archivo";
      const path = `${id}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}-${limpio}`;
      const { data, error } = await sb.storage.from(BUCKET).createSignedUploadUrl(path);
      if (error || !data) return fallo("No se pudo preparar la subida: " + (error?.message || ""), 500);
      return json({ path, signedUrl: data.signedUrl });
    }

    if (accion === "nota") {
      const id = txt(body.id, 40);
      const texto = String(body.texto ?? "").replace(/\s+$/, "").replace(/^\s+/, "").slice(0, 20000);
      if (!(await existeTarea(sb, id))) return fallo("La tarea no existe", 404);
      const lista = Array.isArray(body.adjuntos) ? body.adjuntos.slice(0, 20) : [];
      const adjuntos: Record<string, unknown>[] = [];
      for (const a of lista as Record<string, unknown>[]) {
        const path = txt(a?.path, 400);
        if (!path.startsWith(id + "/") || path.includes("..") || path.split("/").length !== 2) return fallo("Adjunto no válido");
        adjuntos.push({ path, nombre: txt(a.nombre, 160) || path.split("/")[1], tipo: txt(a.tipo, 120), bytes: Number(a.bytes) || 0 });
      }
      if (!texto && !adjuntos.length) return fallo("La nota está vacía");
      if (adjuntos.length) {
        const { data: objs } = await sb.storage.from(BUCKET).list(id, { limit: 1000 });
        const hay = new Set((objs || []).map((o) => `${id}/${o.name}`));
        if (adjuntos.some((a) => !hay.has(String(a.path)))) return fallo("Un adjunto no terminó de subirse; vuelve a intentarlo");
      }
      const ins = await sb.from("lab_pendientes_notas")
        .insert({ pendiente_id: id, tipo: "nota", autor, texto, adjuntos }).select("id").single();
      if (ins.error) return fallo("No se pudo guardar la nota: " + ins.error.message, 500);
      await sb.from("lab_pendientes").update({ actualizado: ahora }).eq("id", id);
      return json({ ok: true, id: ins.data.id });
    }

    if (accion === "borrar_nota") {
      const nid = txt(body.nota_id, 40);
      if (!UUID_RE.test(nid)) return fallo("Nota no válida");
      const { data: n } = await sb.from("lab_pendientes_notas").select("tipo, pendiente_id").eq("id", nid).eq("borrada", false).maybeSingle();
      if (!n || n.tipo !== "nota") return fallo("Esa nota no se puede quitar", 400);
      const u = await sb.from("lab_pendientes_notas").update({ borrada: true }).eq("id", nid);
      if (u.error) return fallo("No se pudo quitar la nota: " + u.error.message, 500);
      await sb.from("lab_pendientes").update({ actualizado: ahora }).eq("id", n.pendiente_id);
      return json({ ok: true });
    }

    if (accion === "crear") {
      const titulo = txt(body.titulo, 300);
      if (!titulo) return fallo("Falta el título");
      const { data: cfg } = await sb.from("lab_pendientes_config").select("valor").eq("clave", "secciones").maybeSingle();
      const claves = Array.isArray(cfg?.valor) ? cfg!.valor.map((s: { key?: string }) => s?.key) : [];
      const seccion = claves.includes(txt(body.seccion, 40)) ? txt(body.seccion, 40) : "general";
      const tipo = TIPOS.includes(txt(body.tipo, 20)) ? txt(body.tipo, 20) : "etiqueta";
      const equipos = Array.isArray(body.equipos)
        ? [...new Set((body.equipos as unknown[]).map((e) => txt(e, 20).toUpperCase()).filter((e) => /^[A-Z0-9][A-Z0-9-]{0,19}$/.test(e)))].slice(0, 60)
        : [];
      const labs = Array.isArray(body.labs) ? [...new Set((body.labs as unknown[]).map(String).filter((l) => LABS.includes(l)))].sort() : [];
      const id = "e-" + Date.now().toString(36) + "-" + crypto.randomUUID().slice(0, 4);
      const ins = await sb.from("lab_pendientes").insert({
        id, seccion, orden: Date.now(), tipo, titulo, detalle: txt(body.detalle, 6000),
        equipos, labs, importante: body.importante === true, origen: "enlace", creado_por: autor,
      });
      if (ins.error) return fallo("No se pudo crear la tarea: " + ins.error.message, 500);
      return json({ ok: true, id });
    }

    return fallo("Acción no válida", 400);
  } catch (e) {
    return fallo("Error interno: " + (e instanceof Error ? e.message : String(e)), 500);
  }
});
