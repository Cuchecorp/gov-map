/**
 * IDIOMS_APROBADOS (single-source real, Phase 128 FIX B-4) — inventario de stems
 * FIJOS aprobados para el copy de fecha/procedencia del rediseño del panel
 * (126→128, PANEL-08, D-09/D-11). Registrados SIN las partes variables
 * (fechas/grados) — literales fijos exactos.
 *
 * Dirección prod→test (mismo patrón que las LEYENDA_* existentes en
 * `anti-insinuacion-guard.test.ts`): este módulo es el ÚNICO lugar donde el
 * inventario se tipea. El guard IMPORTA este array — no lo re-tipea — así un
 * stem mal escrito rompe el import (falla en compilación/resolución), no pasa
 * en silencio como pasaría con dos copias que divergen.
 *
 * v13.0 (Phase 128, mandato O-4): se suma `"fechada el"` — el molde ratificado
 * por el operador es "Urgencia {grado} fechada el {d} · Citado el {d}". Son 5
 * stems en total (4 previos de 126 + 1 nuevo de 128). El molde `vigente desde`
 * sigue registrado y sigue siendo legal donde aplique.
 */
export const IDIOMS_APROBADOS: string[] = [
  "Citado el",
  "vigente desde",
  "En tabla de sala de la Cámara del",
  "según fuente al",
  "fechada el",
];
