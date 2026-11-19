// Lógica de pedidos compartida entre gestionar-linea-pedido y
// gestionar-intervencion (2026-11-19): una línea de pedido de tipo "Servicio"
// es la parte económica de una intervención (lineas_pedido.id_intervencion) y
// la intervención es la parte técnica. Por eso:
//   · la línea se da por realizada cuando se CIERRA la actuación en el hilo
//     (y vuelve a pendiente si se reabre) — sincronizarLineasDeIntervencion;
//   · el coste de la intervención sale del precio de sus líneas (el de la
//     factura) — sincronizarCosteIntervencion.

export const hoy = () => new Date().toISOString().split("T")[0];
const normNombre = (n: string) => (n || "").normalize("NFC").replace(/\s*\[.*?\]/g, "").trim().toLowerCase();

export async function actualizarEstadoPedidoPostRecepcion(supabaseAdmin: any, pedidoId: string) {
  const { data: p } = await supabaseAdmin.from("pedidos").select("*").eq("id_pedido", pedidoId).maybeSingle();
  if (!p) return;
  const { data: lineas } = await supabaseAdmin.from("lineas_pedido").select("estado_linea").eq("pedido", pedidoId);
  const todasRecibidas = (lineas || []).length > 0 && lineas.every((l: any) => l.estado_linea === "Recibido");
  if (todasRecibidas && p.estado !== "Recepción completa" && p.estado !== "Factura recibida" && p.estado !== "Archivado") {
    await supabaseAdmin.from("pedidos").update({ estado: "Recepción completa", fecha_recepcion_completa: hoy() }).eq("id_pedido", pedidoId);
  } else if (!todasRecibidas && (p.estado === "Presupuesto aprobado" || p.estado === "Recepción completa")) {
    // "Recepción completa" vuelve atrás si una línea deja de estar recibida
    // (p.ej. se reabre la actuación de un servicio).
    await supabaseAdmin.from("pedidos").update({ estado: "Recepción parcial" }).eq("id_pedido", pedidoId);
  }
}

export async function actualizarSolicitudOrigen(supabaseAdmin: any, linea: any, pedidoId: string) {
  const solIdMatch = (linea.observaciones || "").match(/Desde solicitud (SOL\S+)/);
  let solOrigen = null;
  if (solIdMatch) {
    const { data } = await supabaseAdmin.from("solicitudes").select("*").eq("id_solicitud", solIdMatch[1]).neq("estado", "Recibido").maybeSingle();
    solOrigen = data;
  }
  if (!solOrigen) {
    const { data: candidatas } = await supabaseAdmin.from("solicitudes").select("*").eq("lista_pedido", pedidoId).neq("estado", "Recibido");
    solOrigen = (candidatas || []).find((s: any) => normNombre(s.material) === normNombre(linea.material)) || null;
  }
  if (!solOrigen) return;
  const obsSinFecha = (solOrigen.observaciones || "").replace(/\[Recibido:\d{4}-\d{2}-\d{2}\]\s*/g, "").trim();
  const nuevaObs = (obsSinFecha ? obsSinFecha + " " : "") + `[Recibido:${hoy()}]`;
  await supabaseAdmin.from("solicitudes").update({
    estado: "Recibido", observaciones: nuevaObs,
    lista_pedido: solOrigen.lista_pedido || pedidoId,
  }).eq("id_solicitud", solOrigen.id_solicitud);
}

// Las líneas de servicio unidas a una intervención siguen a su actuación:
// cerrada → "Recibido" (realizado); reabierta → otra vez "Pendiente".
export async function sincronizarLineasDeIntervencion(supabaseAdmin: any, idIntervencion: string) {
  const { data: interv } = await supabaseAdmin.from("intervenciones")
    .select("actuacion_finalizada").eq("id_intervencion", idIntervencion).maybeSingle();
  if (!interv) return;
  const { data: lineas } = await supabaseAdmin.from("lineas_pedido").select("*").eq("id_intervencion", idIntervencion);
  const pedidos = new Set<string>();
  for (const l of lineas || []) {
    const cerrada = interv.actuacion_finalizada === true;
    if (cerrada && l.estado_linea !== "Recibido") {
      const { data: act } = await supabaseAdmin.from("lineas_pedido")
        .update({ estado_linea: "Recibido", cantidad_recibida: Number(l.cantidad_pedida) || 1 })
        .eq("id_linea", l.id_linea).select().single();
      if (act) await actualizarSolicitudOrigen(supabaseAdmin, act, l.pedido);
      pedidos.add(l.pedido);
    } else if (!cerrada && l.estado_linea === "Recibido") {
      await supabaseAdmin.from("lineas_pedido")
        .update({ estado_linea: "Pendiente", cantidad_recibida: 0 }).eq("id_linea", l.id_linea);
      pedidos.add(l.pedido);
    }
  }
  for (const p of pedidos) await actualizarEstadoPedidoPostRecepcion(supabaseAdmin, p);
}

// El coste de la intervención es la suma de sus líneas de pedido con precio
// (precio sin IVA × cantidad). Si ninguna tiene precio todavía, no se toca.
export async function sincronizarCosteIntervencion(supabaseAdmin: any, idIntervencion: string | null) {
  if (!idIntervencion) return;
  const { data: lineas } = await supabaseAdmin.from("lineas_pedido")
    .select("precio_unitario, cantidad_pedida").eq("id_intervencion", idIntervencion);
  const conPrecio = (lineas || []).filter((l: any) => l.precio_unitario != null);
  if (!conPrecio.length) return;
  const total = conPrecio.reduce((s: number, l: any) => s + Number(l.precio_unitario) * (Number(l.cantidad_pedida) || 1), 0);
  await supabaseAdmin.from("intervenciones")
    .update({ coste_intervencion: Math.round(total * 100) / 100 }).eq("id_intervencion", idIntervencion);
}
