/**
 * links-internos-manifiesto.mjs — Phase 114 (LINK-02)
 *
 * Universo DECLARATIVO de links internos del sitio, derivado del inventario rector 113
 * (`.planning/phases/113-inv-inventario-rector-de-superficies/113-INVENTARIO.md`, `estado: validado`).
 *
 * Módulo de DATOS PUROS: sin red, sin I/O, sin dependencias. El runner
 * (`scripts/verificar-links-internos.mjs`) lo importa y lo ejecuta contra el deploy real.
 *
 * ── Denominador: 77 referencias del inventario ────────────────────────────────────
 * El universo NO se descubre por crawl: se DERIVA del inventario. Comandos de derivación
 * re-ejecutables (desde `.planning/phases/113-inv-inventario-rector-de-superficies/`):
 *
 *   awk 'NR>=985 && /^\| A[0-9]+ \|/' 113-INVENTARIO.md | wc -l      # → 66  (filas AN de Tabla A, §4)
 *   awk 'NR>=458 && NR<=523 && /^\| [0-9]+ \|/' 113-INVENTARIO.md | wc -l  # → 11 (filas de chrome, §2)
 *
 * Verificado 2026-07-28: 66 + 11 = 77. Si el conteo derivado difiere de 77, DETENERSE y
 * declarar la deriva — el inventario es el denominador, no una cifra recordada.
 *
 * ── Compuerta de cobertura (invariante del módulo) ────────────────────────────────
 * unión(MANIFIESTO[].inventarioRef) ∪ unión(EXCLUIDOS[].inventarioRef) === REFS_INVENTARIO
 * Igualdad EXACTA: ni una ref de menos (gap), ni una ref inventada (deriva).
 *
 * ── Fuera del denominador (no son refs del inventario; se documentan por trazabilidad) ──
 * · Emisores huérfanos E-003 (`voto-ficha-row`) y E-008 (`actualidad-module`): no se montan en
 *   ninguna ruta (evidencia 113 §3) ⇒ no aportan ninguna fila `AN` y por eso no aparecen como ref.
 * · Ruta `/admin/revisar-entidades` (§4.15): EXCLUIDA por decisión LOCKED del CONTEXT de 113;
 *   se LISTA para cerrar el denominador de 15 rutas pero NO se inventaría (cero filas `AN`).
 * Ver `EMISORES_HUERFANOS` y `RUTAS_EXCLUIDAS` al final.
 *
 * ── PII ──────────────────────────────────────────────────────────────────────────
 * CERO RUT. El id de contraparte es el placeholder sintético `c:sujeto-inexistente` que ya usa
 * §5 del inventario. JAMÁS un valor con forma de RUT.
 */

/** Deploy auditado por 113 (§5, observado 2026-07-27 23:04 UTC). */
export const BASE_URL = "https://observatorio-congreso.thevalis.workers.dev";

/**
 * Sujetos deterministas de §1 del inventario, en formato PK string.
 * Gotcha 105-02: el senador es `S1338`, JAMÁS el `parlid_senado = 1338` numérico.
 */
export const SUJETOS = {
  diputado: "D1165",              // §1.1 — 6 bloques visibles poblados
  senador: "S1338",               // §1.2 — estados vacíos honestos (0 lobby / 0 cruces / 0 comisiones)
  boletinBicameral: "14309-04",   // §1.3 — prm_id_camara=14891, 7 votaciones, 47 cruces
  boletinSoloSenado: "17870-05",  // §1.4 — prm_id_camara IS NULL
  // Ids inválidos deterministas para ejercitar las cuatro páginas not-found:
  parlamentarioInexistente: "D0000000",
  boletinInexistente: "00000-00",
  seedInexistente: "D0000000",
  contraparteInexistente: "c:sujeto-inexistente", // placeholder no-RUT de §5
};

const { diputado: DIP, senador: SEN, boletinBicameral: BOL_A, boletinSoloSenado: BOL_B } = SUJETOS;

const P_DIP = `/parlamentario/${DIP}`;
const P_SEN = `/parlamentario/${SEN}`;
const PY_A = `/proyecto/${BOL_A}`;
const PY_B = `/proyecto/${BOL_B}`;

/**
 * Las 77 referencias del inventario 113 que este manifiesto debe cubrir en su totalidad.
 * 66 filas `AN` de Tabla A (§4) + 11 filas de chrome (§2). Congelado — ver comandos de derivación.
 */
export const REFS_INVENTARIO = Object.freeze([
  // §4.1 /parlamentario/[id] — 20 filas
  "4.1-A1", "4.1-A2", "4.1-A3", "4.1-A4", "4.1-A5", "4.1-A6", "4.1-A7", "4.1-A8", "4.1-A9", "4.1-A10",
  "4.1-A11", "4.1-A12", "4.1-A13", "4.1-A14", "4.1-A15", "4.1-A16", "4.1-A17", "4.1-A18", "4.1-A19", "4.1-A20",
  // §4.1.b not-found parlamentario
  "4.1.b-A1",
  // §4.2 /proyecto/[boletin] — 11 filas
  "4.2-A1", "4.2-A2", "4.2-A3", "4.2-A4", "4.2-A5", "4.2-A6", "4.2-A7", "4.2-A8", "4.2-A9", "4.2-A10", "4.2-A11",
  // §4.2.b not-found proyecto
  "4.2.b-A1",
  // §4.3 /contraparte/[id] — 3 filas (gate MONEY OFF)
  "4.3-A1", "4.3-A2", "4.3-A3",
  // §4.3.b not-found contraparte
  "4.3.b-A1",
  // §4.4 / — 4 filas
  "4.4-A1", "4.4-A2", "4.4-A3", "4.4-A4",
  // §4.5 /agenda — 8 filas
  "4.5-A1", "4.5-A2", "4.5-A3", "4.5-A4", "4.5-A5", "4.5-A6", "4.5-A7", "4.5-A8",
  // §4.6 /buscar — 4 filas
  "4.6-A1", "4.6-A2", "4.6-A3", "4.6-A4",
  // §4.7 /comparar — 1 fila (0 hrefs propios)
  "4.7-A1",
  // §4.8 /parlamentarios — 1 fila
  "4.8-A1",
  // §4.9 /red — 2 filas
  "4.9-A1", "4.9-A2",
  // §4.9.b not-found red
  "4.9.b-A1",
  // §4.10 /metodologia — 1 fila
  "4.10-A1",
  // §4.11 /sobre — 4 filas
  "4.11-A1", "4.11-A2", "4.11-A3", "4.11-A4",
  // §4.12 /cuenta — 1 fila (0 hrefs propios)
  "4.12-A1",
  // §4.13 /notificaciones/baja — 1 fila (0 hrefs propios)
  "4.13-A1",
  // §4.14 /notificaciones/confirmar — 1 fila (0 hrefs propios)
  "4.14-A1",
  // §2 chrome — 11 filas
  "C-01-1", "C-01-2", "C-01-3", "C-01-4",
  "C-02-1", "C-02-2", "C-02-3", "C-02-4", "C-02-5",
  "C-03-1",
  "C-04-1",
]);

/** Helper de construcción, para que cada entrada quede completa y homogénea. */
function e(o) {
  return {
    id: o.id,
    inventarioRef: o.inventarioRef,
    origen: o.origen,
    href: o.href ?? null,
    tipo: o.tipo,
    espera: o.espera ?? (o.tipo === "status" ? "no-404" : undefined),
    destino: o.destino ?? null,
    gate: o.gate ?? "—",
    nota: o.nota,
  };
}

const NOTA_QP =
  "query-param sobre ruta ya verificada — id de PROD no fijado en §1; limitación declarada";

export const MANIFIESTO = [
  // ── §2 Chrome ────────────────────────────────────────────────────────────────
  e({ id: "C-01-2", inventarioRef: ["C-01-2"], origen: "chrome", href: "/metodologia", tipo: "status", destino: "/metodologia",
      nota: "footer global, app/app/layout.tsx:70-71" }),
  e({ id: "C-01-3", inventarioRef: ["C-01-3"], origen: "chrome", href: "/sobre", tipo: "status", destino: "/sobre",
      nota: "footer global, app/app/layout.tsx:76-77" }),
  e({ id: "C-02-1", inventarioRef: ["C-02-1"], origen: "chrome", href: "/buscar", tipo: "status", destino: "/buscar",
      nota: "nav principal, app/components/header-nav.tsx:37 (render :72-73)" }),
  e({ id: "C-02-2", inventarioRef: ["C-02-2"], origen: "chrome", href: "/parlamentarios", tipo: "status", destino: "/parlamentarios",
      nota: "nav principal, header-nav.tsx:38" }),
  e({ id: "C-02-3", inventarioRef: ["C-02-3"], origen: "chrome", href: "/agenda", tipo: "status", destino: "/agenda",
      nota: "nav principal, header-nav.tsx:39" }),
  e({ id: "C-02-4", inventarioRef: ["C-02-4"], origen: "chrome", href: "/red", tipo: "status", destino: "/red", gate: "NET",
      nota: "nav principal, header-nav.tsx:40; NET ON en el deploy auditado (§5) ⇒ el ítem se emite" }),
  e({ id: "C-02-5", inventarioRef: ["C-02-5"], origen: "chrome", href: "/sobre", tipo: "status", destino: "/sobre",
      nota: "nav principal, header-nav.tsx:41 (mismo destino que C-01-3, emisor distinto)" }),
  e({ id: "C-03-1", inventarioRef: ["C-03-1"], origen: "chrome", href: "/", tipo: "status", destino: "/",
      nota: "wordmark, app/components/global-header.tsx:35-36" }),

  // ── §4.1 /parlamentario/[id] ─────────────────────────────────────────────────
  e({ id: "4.1-A1", inventarioRef: ["4.1-A1"], origen: P_DIP, href: `/comparar?a=${DIP}`, tipo: "status", destino: `/comparar?a=${DIP}`,
      nota: "E-036 app/app/parlamentario/[id]/page.tsx:305 — navegación pura" }),
  e({ id: "4.1-A2", inventarioRef: ["4.1-A2"], origen: P_DIP, href: `/red?seed=${DIP}`, tipo: "status", destino: `/red?seed=${DIP}`, gate: "NET",
      nota: "E-036 page.tsx:328 — NET ON; nodo AUSENTE del DOM si OFF (page.tsx:325)" }),
  e({ id: "4.1-A3-votos", inventarioRef: ["4.1-A3"], origen: P_DIP, href: "#votos", tipo: "ancla", espera: "votos", destino: P_DIP,
      nota: "E-042 ficha-rail.tsx:59 — carril gate-aware (construirChips, page.tsx:527)" }),
  e({ id: "4.1-A3-lobby", inventarioRef: ["4.1-A3"], origen: P_DIP, href: "#lobby", tipo: "ancla", espera: "lobby", destino: P_DIP,
      nota: "E-042 ficha-rail.tsx:59" }),
  e({ id: "4.1-A3-patrimonio", inventarioRef: ["4.1-A3"], origen: P_DIP, href: "#patrimonio", tipo: "ancla", espera: "patrimonio", destino: P_DIP,
      nota: "E-042 ficha-rail.tsx:59" }),
  e({ id: "4.1-A3-cruces", inventarioRef: ["4.1-A3"], origen: P_DIP, href: "#cruces", tipo: "ancla", espera: "cruces", destino: P_DIP, gate: "CRUCES",
      nota: "E-042 ficha-rail.tsx:59 — CRUCES ON (§5); sujeto A tiene 11 cruces" }),
  e({ id: "4.1-A3-S-votos", inventarioRef: ["4.1-A3"], origen: P_SEN, href: "#votos", tipo: "ancla", espera: "votos", destino: P_SEN,
      nota: "Diferencia por sujeto (§4.1): S1338 tiene 949 votos ⇒ la entrada #votos sí se ofrece" }),
  e({ id: "4.1-A3-S-patrimonio", inventarioRef: ["4.1-A3"], origen: P_SEN, href: "#patrimonio", tipo: "ancla", espera: "patrimonio", destino: P_SEN,
      nota: "Diferencia por sujeto (§4.1): S1338 tiene 9 declaraciones" }),
  e({ id: "4.1-A3-S-cruces", inventarioRef: ["4.1-A3"], origen: P_SEN, href: "#cruces", tipo: "ancla", espera: "cruces", destino: P_SEN, gate: "CRUCES",
      nota: "DIVERGENCIA CON EL INVENTARIO (declarada, no corregida aquí): §4.1 'Diferencia por sujeto' dice que con S1338 el carril no ofrece la entrada #cruces; el deploy SÍ emite href=\"#cruces\" y SÍ tiene id=\"cruces\" (observado 2026-07-28). El link NO está roto: se verifica como ancla existente y la divergencia se reporta a 114-02/114-03" }),
  e({ id: "4.1-A4", inventarioRef: ["4.1-A4"], origen: P_DIP, href: P_DIP, tipo: "status", destino: P_DIP,
      nota: "E-022 cross-links-parlamentario.tsx:112 — filas de los 5 bloques de relaciones" }),
  e({ id: "4.1-A6", inventarioRef: ["4.1-A6"], origen: P_DIP, href: PY_A, tipo: "status", destino: PY_A,
      nota: "E-001 votos-por-parlamentario.tsx:483,490 — dentro de DetalleColapsable" }),
  e({ id: "4.1-A7", inventarioRef: ["4.1-A7"], origen: P_DIP, href: P_DIP, tipo: "status", destino: P_DIP,
      nota: `E-001 votos-por-parlamentario.tsx:561 buildVotosVerHref (?votosVer=<boletin>#votos) — ${NOTA_QP}` }),
  e({ id: "4.1-A8", inventarioRef: ["4.1-A8"], origen: P_DIP, href: "/parlamentarios", tipo: "status", destino: "/parlamentarios",
      nota: "E-001 votos-por-parlamentario.tsx:597" }),
  e({ id: "4.1-A9", inventarioRef: ["4.1-A9"], origen: P_DIP, href: `${P_DIP}#votos`, tipo: "status", destino: P_DIP,
      nota: "E-001 votos-por-parlamentario.tsx:726 buildHref(id,{materia:null}) = limpiar filtro ⇒ ruta base + #votos" }),
  e({ id: "4.1-A10", inventarioRef: ["4.1-A10"], origen: P_DIP, href: `${P_DIP}?votosPage=2#votos`, tipo: "status", destino: `${P_DIP}?votosPage=2`,
      nota: "E-001 votos-por-parlamentario.tsx:819,835 — param REAL `votosPage` (buildHref, :101-111)" }),
  e({ id: "4.1-A11", inventarioRef: ["4.1-A11"], origen: P_DIP, href: `${P_DIP}#lobby`, tipo: "status", destino: P_DIP,
      nota: "E-002 lobby-de-parlamentario.tsx:255 — conmutador de vista (agrupada)" }),
  e({ id: "4.1-A12", inventarioRef: ["4.1-A12"], origen: P_DIP, href: `${P_DIP}?vista=cronologica#lobby`, tipo: "status", destino: `${P_DIP}?vista=cronologica`,
      nota: "E-002 lobby-de-parlamentario.tsx:262 — conmutador de vista (cronológica)" }),
  e({ id: "4.1-A13", inventarioRef: ["4.1-A13"], origen: P_SEN, href: "/buscar", tipo: "status", destino: "/buscar",
      nota: "E-002 lobby-de-parlamentario.tsx:352,376 — empty-state; lo ejercita el sujeto B (0 audiencias)" }),
  e({ id: "4.1-A14", inventarioRef: ["4.1-A14"], origen: P_DIP, href: `${P_DIP}?lobbyPage=2&vista=cronologica#lobby`, tipo: "status", destino: `${P_DIP}?lobbyPage=2&vista=cronologica`,
      nota: "E-002 lobby-de-parlamentario.tsx:552,565 — params REALES `lobbyPage` + `vista` (buildHref, :?)" }),
  e({ id: "4.1-A15", inventarioRef: ["4.1-A15"], origen: P_DIP, href: PY_A, tipo: "status", destino: PY_A,
      nota: "E-030 mencion-boletin-chip.tsx:41, montado en lobby-de-parlamentario.tsx:450,529" }),
  e({ id: "4.1-A16", inventarioRef: ["4.1-A16"], origen: P_DIP, href: P_DIP, tipo: "status", destino: P_DIP,
      nota: `E-005 patrimonio-de-parlamentario.tsx:502 buildVerHref (?ver=<version_id>#patrimonio) — ${NOTA_QP}` }),
  e({ id: "4.1-A17", inventarioRef: ["4.1-A17"], origen: P_DIP, href: `${P_DIP}?patrimonioPage=2#patrimonio`, tipo: "status", destino: `${P_DIP}?patrimonioPage=2`,
      nota: "E-005 patrimonio-de-parlamentario.tsx:595,608 — param REAL `patrimonioPage` (buildHistorialHref, :201-206)" }),
  e({ id: "4.1-A18", inventarioRef: ["4.1-A18"], origen: P_DIP, href: null, tipo: "ausencia", espera: "/cuenta?next=", destino: P_DIP, gate: "NOTIF",
      nota: "E-039 seguir-button.tsx:73 — NOTIF OFF (§5) ⇒ `no emitido en el deploy auditado`; ausencia = PASS" }),
  e({ id: "4.1-A19", inventarioRef: ["4.1-A19"], origen: P_DIP, href: null, tipo: "ausencia", espera: 'id="dinero"', destino: P_DIP, gate: "MONEY",
      nota: "E-015 contratos-de-parlamentario.tsx:268,281 (ancla #dinero) — MONEY OFF (§5)" }),
  e({ id: "4.1-A19-contratos", inventarioRef: ["4.1-A19"], origen: P_DIP, href: null, tipo: "ausencia", espera: 'id="contratos"', destino: P_DIP, gate: "MONEY",
      nota: "ancla MONEY #contratos ausente con el gate OFF (§5)" }),
  e({ id: "4.1-A20", inventarioRef: ["4.1-A20"], origen: P_DIP, href: null, tipo: "ausencia", espera: 'id="financiamiento"', destino: P_DIP, gate: "MONEY",
      nota: "E-013 financiamiento-de-parlamentario.tsx:420,433 (ancla #financiamiento) — MONEY OFF (§5)" }),
  e({ id: "4.1-A20-aportes", inventarioRef: ["4.1-A20"], origen: P_DIP, href: null, tipo: "ausencia", espera: 'id="aportes"', destino: P_DIP, gate: "MONEY",
      nota: "ancla MONEY #aportes ausente con el gate OFF (§5)" }),
  e({ id: "4.1-A20-pendiente", inventarioRef: ["4.1-A20"], origen: P_DIP, href: "#financiamiento-pendiente", tipo: "ancla", espera: "financiamiento-pendiente", destino: P_DIP, gate: "MONEY",
      nota: "presencia declarada por §5: con MONEY OFF la ficha emite el placeholder honesto id=\"financiamiento-pendiente\"" }),

  // §4.1.b not-found de parlamentario
  e({ id: "4.1.b-404", inventarioRef: ["4.1.b-A1"], origen: "—", href: `/parlamentario/${SUJETOS.parlamentarioInexistente}`, tipo: "status", espera: 404, destino: `/parlamentario/${SUJETOS.parlamentarioInexistente}`,
      nota: "§4.1.b — el guard PARLAMENTARIO_ID_RE / RPC 0 filas dispara notFound() (page.tsx:215-217,864-866)" }),
  e({ id: "4.1.b-A1", inventarioRef: ["4.1.b-A1"], origen: `/parlamentario/${SUJETOS.parlamentarioInexistente}`, href: "/", tipo: "status", destino: "/",
      nota: "E-049 app/app/parlamentario/[id]/not-found.tsx:17 — único link de la página 404" }),

  // ── §4.2 /proyecto/[boletin] ─────────────────────────────────────────────────
  ...["estado", "timeline", "votaciones", "autores", "lobby-tramitacion", "lobby-menciones", "cruces", "idea-matriz", "cuerpos-legales", "similares", "validacion-fuente"].map((sec) =>
    e({
      id: `4.2-A1-${sec}`,
      // #timeline cubre además 4.2-A5: el stepper (E-045) emite
      // `/proyecto/{boletin}?urgencias={periodoId}#timeline` (app/components/capa1/tramitacion-stepper.tsx:120,133),
      // cuyo ancla COLISIONA con la entrada #timeline del carril ⇒ se colapsa aquí, declarado.
      inventarioRef: sec === "timeline" ? ["4.2-A1", "4.2-A5"] : ["4.2-A1"],
      origen: PY_A,
      href: `#${sec}`,
      tipo: "ancla",
      espera: sec,
      destino: PY_A,
      gate: sec === "cruces" ? "CRUCES" : "—",
      nota: sec === "timeline"
        ? "E-042 ficha-rail.tsx:59 (entradas page.tsx:290-337). COLISIÓN declarada con 4.2-A5: app/components/capa1/tramitacion-stepper.tsx:120,133 emite `?urgencias=<id>#timeline`, mismo ancla."
        : "E-042 ficha-rail.tsx:59 — entradas armadas en page.tsx:290-337 (10 ON / 9 OFF según CRUCES)",
    }),
  ),
  e({ id: "4.2-A2", inventarioRef: ["4.2-A2"], origen: PY_A, href: "#idea-matriz", tipo: "ancla", espera: "idea-matriz", destino: PY_A,
      nota: "E-048 app/app/proyecto/[boletin]/page.tsx:568 — 'Ver la idea matriz completa' (solo si ficha.idea_matriz != null)" }),
  e({ id: "4.2-A3", inventarioRef: ["4.2-A3"], origen: PY_A, href: "/agenda?semana=2026-W30", tipo: "status", destino: "/agenda?semana=2026-W30",
      nota: "E-032 estado-actual-block.tsx:477,492 — semana ISO instanciada (solo si el boletín está en tabla de sala)" }),
  e({ id: "4.2-A4", inventarioRef: ["4.2-A4"], origen: PY_A, href: PY_A, tipo: "status", destino: PY_A,
      nota: `E-010 timeline-view.tsx:256,273 buildUrgenciasHref (?urgencias=<periodo_id>) — ${NOTA_QP}` }),
  e({ id: "4.2-A6", inventarioRef: ["4.2-A6"], origen: PY_A, href: P_DIP, tipo: "status", destino: P_DIP,
      nota: "E-026 voto-row.tsx:43 ← voto-detalle.tsx:51 ← votacion-card.tsx:108 — solo menciones confirmadas" }),
  e({ id: "4.2-A7", inventarioRef: ["4.2-A7"], origen: PY_A, href: P_DIP, tipo: "status", destino: P_DIP,
      nota: "E-035 autor-row.tsx:44 — solo autores confirmados; si no, IdentityMarker sin link" }),
  e({ id: "4.2-A8", inventarioRef: ["4.2-A8"], origen: PY_A, href: P_DIP, tipo: "status", destino: P_DIP,
      nota: "E-020 lobby-menciones-de-boletin.tsx:138 — LOB-03" }),
  e({ id: "4.2-A9", inventarioRef: ["4.2-A9"], origen: PY_A, href: P_DIP, tipo: "status", destino: P_DIP, gate: "CRUCES",
      nota: "E-044 cruces-de-proyecto.tsx:130 — CRUCES ON; la contraparte de lobby va en texto plano, nunca enlazada (52-03)" }),
  e({ id: "4.2-A10", inventarioRef: ["4.2-A10"], origen: PY_A, href: PY_B, tipo: "status", destino: PY_B,
      nota: "E-028 search-result-card.tsx:80 ← proyectos-similares.tsx:98 — tarjetas kNN; instanciado con el sujeto D" }),
  e({ id: "4.2-A11", inventarioRef: ["4.2-A11"], origen: PY_A, href: null, tipo: "ausencia", espera: "/cuenta?next=", destino: PY_A, gate: "NOTIF",
      nota: "E-039 seguir-button.tsx:73 (page.tsx:112-116) — NOTIF OFF (§5) ⇒ ausencia = PASS" }),

  // §4.2.b not-found de proyecto
  e({ id: "4.2.b-404", inventarioRef: ["4.2.b-A1"], origen: "—", href: `/proyecto/${SUJETOS.boletinInexistente}`, tipo: "status", espera: 404, destino: `/proyecto/${SUJETOS.boletinInexistente}`,
      nota: "§4.2.b — boletín inexistente debe disparar notFound() (page.tsx:60-62 valida BOLETIN_RE antes de tocar la DB)" }),
  e({ id: "4.2.b-A1", inventarioRef: ["4.2.b-A1"], origen: `/proyecto/${SUJETOS.boletinInexistente}`, href: "/", tipo: "status", destino: "/",
      nota: "E-023 app/app/proyecto/[boletin]/not-found.tsx:37" }),

  // ── §4.3 /contraparte/[id] — gate MONEY OFF ─────────────────────────────────
  e({ id: "4.3-A1-desde-parlamentario", inventarioRef: ["4.3-A1"], origen: P_DIP, href: null, tipo: "ausencia", espera: 'href="/contraparte/', destino: P_DIP, gate: "MONEY",
      nota: "§5: MONEY OFF ⇒ ninguna superficie pública emite links a /contraparte/[id]; ausencia = PASS" }),
  e({ id: "4.3-A1-desde-proyecto", inventarioRef: ["4.3-A1"], origen: PY_A, href: null, tipo: "ausencia", espera: 'href="/contraparte/', destino: PY_A, gate: "MONEY",
      nota: "§5: MONEY OFF ⇒ ninguna superficie pública emite links a /contraparte/[id]; ausencia = PASS" }),
  e({ id: "4.3-A2-A3", inventarioRef: ["4.3-A2", "4.3-A3"], origen: "—", href: `/contraparte/${SUJETOS.contraparteInexistente}`, tipo: "status", espera: 404, destino: `/contraparte/${SUJETOS.contraparteInexistente}`,
      nota: "§4.3 + §5: la ruta entera 404ea por gate MONEY (page.tsx:50-52 notFound() como primera sentencia) ⇒ las paginaciones #contratos (A2) y #aportes (A3) no se emiten; el 404 NO es defecto. Id = placeholder sintético, jamás un RUT" }),
  e({ id: "4.3.b-A1", inventarioRef: ["4.3.b-A1"], origen: `/contraparte/${SUJETOS.contraparteInexistente}`, href: "/", tipo: "status", destino: "/",
      nota: "E-050 app/app/contraparte/[id]/not-found.tsx:19 — es lo que se sirve con MONEY OFF" }),

  // ── §4.4 / ───────────────────────────────────────────────────────────────────
  e({ id: "4.4-A1", inventarioRef: ["4.4-A1"], origen: "/", href: "/sobre", tipo: "status", destino: "/sobre",
      nota: "E-024 app/app/page.tsx:110 — accent tile '¿Cómo leer esto?'" }),
  e({ id: "4.4-A2", inventarioRef: ["4.4-A2"], origen: "/", href: "/buscar", tipo: "status", destino: "/buscar",
      nota: "E-024 page.tsx:146, href literal en ENTRY_CARDS (page.tsx:62)" }),
  e({ id: "4.4-A3", inventarioRef: ["4.4-A3"], origen: "/", href: "/parlamentarios", tipo: "status", destino: "/parlamentarios",
      nota: "E-024 page.tsx:146, ENTRY_CARDS (page.tsx:68)" }),
  e({ id: "4.4-A4", inventarioRef: ["4.4-A4"], origen: "/", href: "/agenda", tipo: "status", destino: "/agenda",
      nota: "E-024 page.tsx:146, ENTRY_CARDS (page.tsx:74)" }),

  // ── §4.5 /agenda ─────────────────────────────────────────────────────────────
  e({ id: "4.5-A1", inventarioRef: ["4.5-A1"], origen: "/agenda?q=trabajo", href: "/agenda", tipo: "status", destino: "/agenda",
      nota: "E-004 app/app/agenda/page.tsx:119-120 — '← Volver a la vista semanal' (rama buscando)" }),
  e({ id: "4.5-A2", inventarioRef: ["4.5-A2"], origen: "/agenda?q=trabajo", href: "/agenda?q=trabajo&camara=diputados", tipo: "status", destino: "/agenda?q=trabajo&camara=diputados",
      nota: "E-004 agenda/page.tsx:171-172 (render :178-180) — chips Ambas/Cámara/Senado" }),
  e({ id: "4.5-A3", inventarioRef: ["4.5-A3"], origen: "/agenda?q=trabajo", href: PY_A, tipo: "status", destino: PY_A,
      nota: "E-004 agenda/page.tsx:267-268 — resultado de búsqueda con boletín" }),
  e({ id: "4.5-A4", inventarioRef: ["4.5-A4"], origen: "/agenda", href: "/buscar", tipo: "status", destino: "/buscar",
      nota: "E-004 agenda/page.tsx:413-415 — empty-state de semana sin citaciones" }),
  e({ id: "4.5-A5", inventarioRef: ["4.5-A5"], origen: "/agenda", href: "/agenda?semana=2026-W30", tipo: "status", destino: "/agenda?semana=2026-W30",
      nota: "E-007 week-nav.tsx:29-30 — semana previa (semanaIsoKey)" }),
  e({ id: "4.5-A6", inventarioRef: ["4.5-A6"], origen: "/agenda", href: "/agenda?semana=2026-W32", tipo: "status", destino: "/agenda?semana=2026-W32",
      nota: "E-007 week-nav.tsx:40-41 — semana siguiente (semanaIsoKey)" }),
  e({ id: "4.5-A7", inventarioRef: ["4.5-A7"], origen: "/agenda", href: PY_A, tipo: "status", destino: PY_A,
      nota: "E-033 citacion-card.tsx:129-130 ← agenda-filtros.tsx:346-373 — primerBoletin (page.tsx:480-486)" }),
  e({ id: "4.5-A8", inventarioRef: ["4.5-A8"], origen: "/agenda", href: PY_A, tipo: "status", destino: PY_A,
      nota: "E-018 sala-table-section.tsx:93-94 — fila de la tabla de sala (modo available)" }),

  // ── §4.6 /buscar ─────────────────────────────────────────────────────────────
  e({ id: "4.6-A1", inventarioRef: ["4.6-A1"], origen: "/buscar", href: "/agenda", tipo: "status", destino: "/agenda",
      nota: "E-017 app/app/buscar/page.tsx:119-120 — empty-state 'Sin resultados'" }),
  e({ id: "4.6-A2", inventarioRef: ["4.6-A2"], origen: "/buscar?q=pension&page=2", href: "/buscar?q=pension&page=1", tipo: "status", destino: "/buscar?q=pension&page=1",
      nota: "E-017 buscar/page.tsx:263 — página anterior (solo si page > 1)" }),
  e({ id: "4.6-A3", inventarioRef: ["4.6-A3"], origen: "/buscar?q=pension&page=1", href: "/buscar?q=pension&page=2", tipo: "status", destino: "/buscar?q=pension&page=2",
      nota: "E-017 buscar/page.tsx:272 — página siguiente (solo si hayMas)" }),
  e({ id: "4.6-A4", inventarioRef: ["4.6-A4"], origen: "/buscar?q=pension&page=1", href: PY_A, tipo: "status", destino: PY_A,
      nota: "E-028 search-result-card.tsx:79-80 ← buscar-filtros.tsx:481 — título de cada tarjeta" }),

  // ── §4.7 /comparar ───────────────────────────────────────────────────────────
  e({ id: "4.7-A1", inventarioRef: ["4.7-A1"], origen: "—", href: "/comparar", tipo: "status", destino: "/comparar",
      nota: "§4.7: la ruta emite 0 hrefs propios fuera del chrome (E-051) ⇒ se verifica la ruta misma como destino alcanzable" }),

  // ── §4.8 /parlamentarios ─────────────────────────────────────────────────────
  e({ id: "4.8-A1-dip", inventarioRef: ["4.8-A1"], origen: "/parlamentarios", href: P_DIP, tipo: "status", destino: P_DIP,
      nota: "E-012 parlamentario-directory-row.tsx:40 — la fila entera es el anchor (WR-04)" }),
  e({ id: "4.8-A1-sen", inventarioRef: ["4.8-A1"], origen: "/parlamentarios", href: P_SEN, tipo: "status", destino: P_SEN,
      nota: "E-012 parlamentario-directory-row.tsx:40 — misma fila instanciada con el sujeto B (senador)" }),

  // ── §4.9 /red ────────────────────────────────────────────────────────────────
  e({ id: "4.9-A1", inventarioRef: ["4.9-A1"], origen: `/red?seed=${DIP}`, href: `/red?seed=${DIP}`, tipo: "status", destino: `/red?seed=${DIP}`, gate: "NET",
      nota: "E-011 red/red-graph.tsx:210 — 'Ver la red de esta persona →' (NET ON)" }),
  e({ id: "4.9-A2", inventarioRef: ["4.9-A2"], origen: `/red?seed=${SEN}`, href: "/parlamentarios", tipo: "status", destino: "/parlamentarios", gate: "NET",
      nota: "E-011 red/red-graph.tsx:435-436 — empty-state de grafo sin aristas (rama del sujeto B)" }),
  e({ id: "4.9.b-404", inventarioRef: ["4.9.b-A1"], origen: "—", href: `/red?seed=${SUJETOS.seedInexistente}`, tipo: "status", espera: 404, destino: `/red?seed=${SUJETOS.seedInexistente}`,
      gate: "NET", nota: "§4.9.b — seed inexistente dispara la página not-found de /red" }),
  e({ id: "4.9.b-A1", inventarioRef: ["4.9.b-A1"], origen: `/red?seed=${SUJETOS.seedInexistente}`, href: "/", tipo: "status", destino: "/",
      nota: "E-047 app/app/red/not-found.tsx:19" }),

  // ── §4.10 /metodologia ───────────────────────────────────────────────────────
  e({ id: "4.10-A1", inventarioRef: ["4.10-A1"], origen: "/metodologia", href: "/", tipo: "status", destino: "/",
      nota: "E-025 app/app/metodologia/page.tsx:129 — 'Volver al inicio'" }),

  // ── §4.11 /sobre ─────────────────────────────────────────────────────────────
  e({ id: "4.11-A1", inventarioRef: ["4.11-A1"], origen: "/sobre", href: "/buscar", tipo: "status", destino: "/buscar",
      nota: "E-009 app/app/sobre/page.tsx:62" }),
  e({ id: "4.11-A2", inventarioRef: ["4.11-A2"], origen: "/sobre", href: "/agenda", tipo: "status", destino: "/agenda",
      nota: "E-009 sobre/page.tsx:70" }),
  e({ id: "4.11-A3", inventarioRef: ["4.11-A3"], origen: "/sobre", href: "/parlamentarios", tipo: "status", destino: "/parlamentarios",
      nota: "E-009 sobre/page.tsx:78" }),
  e({ id: "4.11-A4", inventarioRef: ["4.11-A4"], origen: "/sobre", href: "/", tipo: "status", destino: "/",
      nota: "E-009 sobre/page.tsx:107 — 'Volver al inicio'" }),

  // ── §4.12 /cuenta · §4.13-§4.14 /notificaciones/* (NOTIF OFF, 0 hrefs propios) ─
  e({ id: "4.12-A1", inventarioRef: ["4.12-A1"], origen: "—", href: "/cuenta", tipo: "status", destino: "/cuenta", gate: "NOTIF",
      nota: "§4.12: 0 hrefs propios (E-052); la interacción es por Server Actions. Se verifica respuesta no-404 (contenido gated es esperado)" }),
  e({ id: "4.13-A1", inventarioRef: ["4.13-A1"], origen: "—", href: "/notificaciones/baja", tipo: "status", destino: "/notificaciones/baja", gate: "NOTIF",
      nota: "§4.13: 0 hrefs propios; feature inerte con NOTIF OFF. Se verifica respuesta no-404" }),
  e({ id: "4.14-A1", inventarioRef: ["4.14-A1"], origen: "—", href: "/notificaciones/confirmar?token=x", tipo: "status", destino: "/notificaciones/confirmar?token=x", gate: "NOTIF",
      nota: "§4.14 + §5: 0 hrefs propios; el inventario observó 200 con token dummy. Se verifica respuesta no-404" }),
];

/**
 * Refs del inventario deliberadamente FUERA del manifiesto verificable.
 * Una razón individual por ref — sin agrupar.
 */
export const EXCLUIDOS = [
  {
    id: "C-01-1",
    inventarioRef: ["C-01-1"],
    razon:
      "Link EXTERNO (https://creativecommons.org/licenses/by/4.0/deed.es, app/app/layout.tsx:58): no es navegación interna. Los patrones externos son alcance de la Phase 115.",
  },
  {
    id: "C-01-4",
    inventarioRef: ["C-01-4"],
    razon:
      "Esquema `mailto:` (app/app/layout.tsx:83): no es navegación interna ni tiene status HTTP verificable.",
  },
  {
    id: "C-04-1",
    inventarioRef: ["C-04-1"],
    razon:
      "Placeholder dinámico: `Breadcrumbs` (app/components/breadcrumbs.tsx:38-39) no emite href propio — renderiza los `items` literales de la página llamante. Sus hrefs reales ya viven en las filas de la ruta llamante (§2, regla de no-repetición).",
  },
  {
    id: "4.1-A5",
    inventarioRef: ["4.1-A5"],
    razon:
      "`verTodosHref` es null en los 5 bloques de esta ruta (app/app/parlamentario/[id]/page.tsx:430,446,462,479,505) ⇒ el <a> NO se emite (E-022 cross-links-parlamentario.tsx:130). No hay href que solicitar: la fila declara ausencia por diseño, no un destino.",
  },
];

/**
 * Emisores huérfanos del inventario 113 (§3): existen en el árbol pero NO se montan en ninguna
 * ruta ⇒ no aportan ninguna fila `AN` y por eso no aparecen en REFS_INVENTARIO.
 * Se declaran aquí para que la exclusión quede trazable, no para cubrir una ref.
 */
export const EMISORES_HUERFANOS = Object.freeze([
  { id: "E-003", archivo: "app/components/voto-ficha-row.tsx", razon: "no se monta en ninguna ruta (evidencia 113 §3)" },
  { id: "E-008", archivo: "app/components/actualidad-module.tsx", razon: "no se monta en ninguna ruta (evidencia 113 §3)" },
]);

/** Rutas del universo de 15 que quedan fuera del inventario público (§4.15). */
export const RUTAS_EXCLUIDAS = Object.freeze([
  {
    ruta: "/admin/revisar-entidades",
    razon: "gated admin, no pública — decisión LOCKED del CONTEXT de 113; se lista para cerrar el denominador de 15 rutas pero NO se inventaría (cero filas AN).",
  },
]);
