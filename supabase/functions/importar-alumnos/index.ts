// Tarea #4 — Importación masiva de alumnado desde Sanidad CMA.
// Solo Admin/Gestor (ver _shared/auth.ts). Dos acciones:
//   GET  ?action=preview        -> lista de alumnos de Sanidad CMA + si ya existen
//   POST ?action=import         -> body { emails: string[] } crea cuenta+perfil+módulo
// Replica el patrón de BioDesk (lib/sanidadCma.ts + importar-action.ts), pero
// contra el proyecto Supabase propio de GestionLab.
import { requireAdminOrGestor, jsonError, jsonOk, generarPasswordTemporal, handleCorsPreflight } from "../_shared/auth.ts";

interface AlumnoCMA {
  nombre: string;
  email: string;
  ciclo: string;
  modulo: string;
  laboratorio: string;
}

async function fetchAlumnosCMA(): Promise<AlumnoCMA[]> {
  const baseUrl = Deno.env.get("SANIDAD_CMA_API_URL")!;
  const apiKey = Deno.env.get("SANIDAD_CMA_API_KEY")!;
  const res = await fetch(`${baseUrl}/api/bioDesk/alumnos`, {
    headers: { "x-api-key": apiKey },
  });
  if (!res.ok) {
    throw new Error(`Sanidad CMA respondió ${res.status}: ${await res.text()}`);
  }
  const data = await res.json();
  return Array.isArray(data) ? data : (data.alumnos ?? []);
}

function cursoAcademicoActual(): string {
  const hoy = new Date();
  const anioInicio = hoy.getMonth() >= 8 ? hoy.getFullYear() : hoy.getFullYear() - 1; // curso empieza en sept
  return `${anioInicio}-${anioInicio + 1}`;
}

Deno.serve(async (req) => {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;
  const { error: authError, supabaseAdmin } = await requireAdminOrGestor(req);
  if (authError) return authError;

  const url = new URL(req.url);
  const action = url.searchParams.get("action") || "preview";

  // ── Preview: lista de alumnos de Sanidad + si ya existen en GestionLab ──
  if (req.method === "GET" && action === "preview") {
    let alumnos: AlumnoCMA[];
    try {
      alumnos = await fetchAlumnosCMA();
    } catch (e) {
      return jsonError(`No se pudo consultar Sanidad CMA: ${(e as Error).message}`, 502);
    }

    const emails = alumnos.map((a) => a.email.toLowerCase().trim());
    const { data: existentes } = await supabaseAdmin.from("users").select("email").in("email", emails);
    const yaExisten = new Set((existentes ?? []).map((u: { email: string }) => u.email.toLowerCase()));

    const conEstado = alumnos.map((a) => ({ ...a, existe: yaExisten.has(a.email.toLowerCase().trim()) }));
    return jsonOk({ alumnos: conEstado });
  }

  // ── Import: crea cuenta + perfil + módulo para los seleccionados ──
  if (req.method === "POST" && action === "import") {
    let body: { emails?: string[] };
    try {
      body = await req.json();
    } catch {
      return jsonError("Cuerpo inválido, se esperaba { emails: [...] }", 400);
    }
    const seleccionados = new Set((body.emails ?? []).map((e) => e.toLowerCase().trim()));
    if (!seleccionados.size) return jsonError("No se seleccionó ningún alumno", 400);

    let alumnos: AlumnoCMA[];
    try {
      alumnos = await fetchAlumnosCMA();
    } catch (e) {
      return jsonError(`No se pudo consultar Sanidad CMA: ${(e as Error).message}`, 502);
    }

    const aImportar = alumnos.filter((a) => seleccionados.has(a.email.toLowerCase().trim()));
    const cursoAcademico = cursoAcademicoActual();
    const resultados: Array<
      { email: string; ok: boolean; motivo?: string; password_temporal?: string }
    > = [];

    for (const a of aImportar) {
      const email = a.email.toLowerCase().trim();

      const { data: yaExiste } = await supabaseAdmin.from("users").select("id").eq("email", email).maybeSingle();
      if (yaExiste) {
        resultados.push({ email, ok: false, motivo: "Ya existía, omitido" });
        continue;
      }

      const password = generarPasswordTemporal();
      const { data: authUser, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (createErr || !authUser?.user) {
        resultados.push({ email, ok: false, motivo: createErr?.message ?? "error creando cuenta" });
        continue;
      }
      const userId = authUser.user.id;

      let cicloId: string | null = null;
      if (a.ciclo) {
        let { data: ciclo } = await supabaseAdmin.from("ciclos").select("id").eq("nombre", a.ciclo).maybeSingle();
        if (!ciclo) {
          const { data: nuevoCiclo } = await supabaseAdmin.from("ciclos").insert({ nombre: a.ciclo }).select("id")
            .single();
          ciclo = nuevoCiclo;
        }
        cicloId = ciclo?.id ?? null;
      }

      const { error: profileErr } = await supabaseAdmin.from("users").insert({
        id: userId,
        nombre: a.nombre,
        email,
        rol: "Alumno",
        activo: true,
        ciclo_principal_id: cicloId,
        puede_revisar_inventario: false,
      });
      if (profileErr) {
        await supabaseAdmin.auth.admin.deleteUser(userId);
        resultados.push({ email, ok: false, motivo: profileErr.message });
        continue;
      }

      if (a.modulo) {
        let { data: modulo } = await supabaseAdmin.from("modulos").select("id").eq("nombre", a.modulo)
          .maybeSingle();
        if (!modulo) {
          const { data: nuevoModulo } = await supabaseAdmin.from("modulos")
            .insert({ nombre: a.modulo, lab_teoria: a.laboratorio, lab_practicas: a.laboratorio })
            .select("id").single();
          modulo = nuevoModulo;
        }
        if (modulo) {
          await supabaseAdmin.from("user_modulos").insert({
            user_id: userId,
            modulo_id: modulo.id,
            curso_academico: cursoAcademico,
          });
        }
      }

      resultados.push({ email, ok: true, password_temporal: password });
    }

    return jsonOk({ resultados });
  }

  return jsonError("Acción no reconocida (usa ?action=preview o ?action=import)", 400);
});
