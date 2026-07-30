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
 * por el operador es "Urgencia {grado} fechada el {d} · Citado el {d}". El
 * molde `vigente desde` sigue registrado y sigue siendo legal donde aplique.
 *
 * W-3 (plan-checker 128): el inventario incluye TODAS las variantes de
 * género/número/cámara que el copy de los tiles emite — el alta precede al
 * copy (Wave-0 LOCKED); una variante usada y no registrada erosiona el
 * single-source aunque el linter no la muerda.
 */
export const IDIOMS_APROBADOS: string[] = [
  "Citado el",
  "vigente desde",
  "En tabla de sala de la Cámara del",
  "según fuente al",
  "fechada el",
  // W-3 — variantes de los tiles 03/04/05 (registradas ANTES de su copy):
  "fechado el", // masculino: "Archivo o retiro fechado el {d}" (tile ingresos)
  // Plural del tile votaciones: el stem registrado es "sin votaciones fechadas" (NO "fechadas en"
  // — el guard WR-03 mordió: "en" abre el término prohibido multi-palabra "en realidad son" y la
  // resta lo partiría; se corta el stem ANTES de la preposición, el copy sigue legal).
  "sin votaciones fechadas",
  "En tabla de sala del", // Senado (sin "de la Cámara"): "En tabla de sala del {d}" (tile sala)
];
