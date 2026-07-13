/**
 * Helpers de copy del hecho de la isla NET (RED-LAYOUT-B).
 *
 * El layout B renderiza cada hecho seed↔vecino como texto en el detalle inline
 * (ver `red-graph.tsx` → <DetalleVecino>): la etiqueta DESCRIBE el hecho ("Ambos
 * recibieron audiencia de {contraparte}") y su ventana temporal. Este módulo solo
 * exporta los helpers puros de copy; el componente `<AristaHecho>` de xyflow y su
 * `<EtiquetaArista>` fueron eliminados junto con la dependencia @xyflow/react.
 *
 * ANTI-INSINUACIÓN (18-CONTEXT, 17-LEGAL-DOSSIER §2, DESIGN-SYSTEM §8, LOCKED):
 * el copy NUNCA expresa una valoración, una medida de proximidad, ni una relación
 * entre las personas; NUNCA una explicación de motivo. Solo el hecho observable.
 */

/** Fecha ISO → yyyy-mm-dd literal (sin reinterpretar). */
function fechaLiteral(iso: string | null): string | null {
  if (!iso) return null;
  // Tomamos la parte de fecha tal cual viene; no reformateamos a otra zona.
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(iso);
  return m ? m[1] : iso;
}

/**
 * Copy del hecho por tipo de arista. Describe la co-ocurrencia observable, sin
 * afirmar sentido compartido ni relación entre las personas.
 */
export function etiquetaHecho(tipo: string, contexto: string | null): string {
  const quien = contexto?.trim() || "la misma contraparte";
  switch (tipo) {
    case "co_lobby_contraparte":
      return `Ambos recibieron audiencia de ${quien}`;
    case "co_votacion":
      return `Registrados en la misma votación: ${quien}`;
    default:
      return `Hecho público compartido: ${quien}`;
  }
}

/** Texto de ventana temporal ("entre {desde} y {hasta}" / un solo extremo). */
export function ventanaTexto(
  desde: string | null,
  hasta: string | null,
): string | null {
  const d = fechaLiteral(desde);
  const h = fechaLiteral(hasta);
  if (d && h) return d === h ? `el ${d}` : `entre ${d} y ${h}`;
  if (d) return `desde ${d}`;
  if (h) return `hasta ${h}`;
  return null;
}
