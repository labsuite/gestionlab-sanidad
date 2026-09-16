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
