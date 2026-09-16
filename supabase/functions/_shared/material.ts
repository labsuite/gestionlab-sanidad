// Enlace estable entre los historiales del fungible y el catálogo `material`.
//
// `movimientos`, `historico_precio`, `lineas_pedido` y `solicitudes` guardan el
// material por NOMBRE en texto libre, y eso no se puede quitar: hace falta para
// pedir material que no está catalogado (ver docs/modulo-pedidos.md). El problema
// es que renombrar un material dejaba su historial huérfano en silencio.
//
// Desde la migración `scripts/migrar_id_material.py` esas cuatro tablas llevan
// además `id_material`, que es el enlace de verdad porque sobrevive al renombrado.
// La columna de texto se mantiene para que los listados muestren el nombre y para
// el material no catalogado, que por definición no tiene ID.

/**
 * ID de catálogo del material con ese nombre, o null si no está catalogado
 * (caso legítimo: material pedido puntualmente sin darlo de alta).
 *
 * Usa limit(1) y no maybeSingle() a propósito: en el catálogo hay nombres
 * duplicados reales (p. ej. "Acido sulfurico, H2SO4, 96%" y "Ácido sulfúrico,
 * H2SO4, 96%"), y maybeSingle() daría error en vez de resolver.
 */
export async function resolverIdMaterial(
  supabaseAdmin: any,
  nombre: string | null | undefined,
): Promise<string | null> {
  const n = String(nombre || "").trim();
  if (!n) return null;
  const { data } = await supabaseAdmin
    .from("material").select("id_material").eq("nombre", n).limit(1);
  return (data && data[0]?.id_material) || null;
}

// ============================================================
// NOMBRE COMPUESTO A PARTIR DE LOS ATRIBUTOS (fase B)
// ============================================================
// Quien propone un material no escribe su nombre: rellena los atributos y el
// nombre sale de aquí. Esto es la versión del SERVIDOR, que es la que manda;
// el cliente tiene una copia para la vista previa en vivo (js/material.js,
// `componerNombreMaterial`). Si se toca una, hay que tocar la otra.
//
// Regla: se recorren los atributos EN EL ORDEN DE LA FICHA y cada uno se pega
// al texto acumulado con su separador (espacio o coma). Por eso lo que va
// pegado a la base se declara antes que lo que va tras coma:
//   "Pipetas serológicas" + estériles(espacio) + 10 mL(coma)
//   = "Pipetas serológicas estériles, 10 mL"

/** Punto decimal y sin ceros sobrantes: 0.5 → "0.5", 10.0 → "10". */
export function formatearNumero(v: unknown): string {
  const n = Number(v);
  if (!isFinite(n)) return String(v ?? "");
  return Number.isInteger(n) ? String(n) : String(n);
}

export function componerNombreMaterial(
  nombreBase: string,
  ficha: any[],
  valores: Record<string, unknown>,
): string {
  let txt = String(nombreBase || "").trim();
  for (const a of (ficha || [])) {
    const n = a?.nombre || {};
    const sep = n.sep || "coma";
    if (sep === "omitir") continue;
    const v = valores?.[a.clave];
    if (v === null || v === undefined || v === "" || v === false) continue;

    let trozo: string;
    if (a.tipo === "booleano") trozo = String(n.textoSi || a.etiqueta || "");
    else if (a.tipo === "numero") trozo = `${n.prefijo || ""}${formatearNumero(v)}${n.sufijo || ""}`;
    else trozo = `${n.prefijo || ""}${String(v)}${n.sufijo || ""}`;

    trozo = trozo.trim();
    if (!trozo) continue;
    txt += (sep === "espacio" ? " " : ", ") + trozo;
  }
  return txt.trim();
}

/** Clave de comparación: sin tildes, mayúsculas, puntuación ni espacios. */
export function claveNombre(s: string): string {
  return String(s || "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Busca en el catálogo un material que sea "el mismo" que el nombre propuesto.
 * Primero por clave exacta; si no, por solapamiento de palabras — así
 * "Puntas micropipeta 1000 µL" encuentra a "Puntas micropipeta, 1000uL".
 * Devuelve null si nada pasa del umbral: es preferible un alta de más que
 * fusionar dos materiales distintos por parecido.
 */
export function buscarMaterialParecido(nombre: string, materiales: any[]): any | null {
  const clave = claveNombre(nombre);
  if (!clave) return null;
  const exacto = materiales.find((m) => claveNombre(m.nombre) === clave);
  if (exacto) return exacto;

  const palabras = (s: string) =>
    new Set(String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .toLowerCase().split(/[^a-z0-9]+/).filter((p) => p.length > 1));
  const mias = palabras(nombre);
  if (!mias.size) return null;

  let mejor: any = null, mejorPunt = 0;
  for (const m of materiales) {
    const suyas = palabras(m.nombre);
    if (!suyas.size) continue;
    let comunes = 0;
    for (const p of mias) if (suyas.has(p)) comunes++;
    const punt = comunes / Math.max(mias.size, suyas.size);
    if (punt > mejorPunt) { mejorPunt = punt; mejor = m; }
  }
  return mejorPunt >= 0.7 ? mejor : null;
}
