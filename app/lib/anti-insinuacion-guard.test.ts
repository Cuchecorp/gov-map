/**
 * ANTI-INSINUACION-GUARD (VOTO-04) — Linter anti-vocabulario-insinuante.
 *
 * Espejo EXACTO de `app/lib/lockdown-guard.test.ts`: un guard-como-test de vitest
 * que ESCANEA archivos de fuente (no runtime) y FALLA si el texto renderizado de
 * cualquier superficie de voto contiene un término de insinuación. No es un CLI
 * `node`/`tsx` separado (no hay CI que lo corra); es un `*.test.ts` que la suite
 * recoge → corre en `pnpm test` (root → `pnpm --filter ./app test`) y en el gate
 * GSD verify-work, en el MISMO lugar que el lockdown-guard.
 *
 * Regla rector (CONTEXT §decisions, LOCKED): un voto es un HECHO OBSERVABLE. Está
 * PROHIBIDO en el copy ciudadano el vocabulario de juicio/comparación de bancada:
 * "rebeldía"/"disciplina"/"alineamiento"/"vota como"/"similar a"/"mediana de su
 * cámara"/score/ranking/etc. Una insinuación en el render es difamación/
 * editorialización — el riesgo #1 del proyecto.
 *
 * ALCANCE HONESTO (WR-01): este linter es un TRIPWIRE de idioms conocidos — una
 * denylist EXACTA de frases/tokens. NO previene la insinuación (una denylist no puede
 * ser exhaustiva: paráfrasis, sinónimos, yuxtaposición temporal e inglés se le escapan
 * por construcción). Sólo REDUCE la superficie cazando los idioms obvios. Las garantías
 * REALES contra difamación son (1) el sign-off legal HUMANO del copy (Ley 21.719) y
 * (2) el gate anti-flip MONEY (`money-antiflip-guard.test.ts`), que mantiene las
 * superficies MONEY OFF hasta ese sign-off. No confiar en este linter para atrapar
 * editorialización que estructuralmente no puede ver.
 *
 * DOS piezas críticas heredadas del molde:
 *
 * (1) `stripTsComments` — quita `/* *\/` y `// …` ANTES de aplicar los regex.
 *     Sin esto el guard tendría ~15 falsos positivos: hay usos LEGÍTIMOS de los
 *     términos prohibidos en comentarios/JSDoc (p.ej. `voto-ficha-row.tsx` doc
 *     "el nombre interno 'rebeldías' JAMÁS aparece aquí"; `page.tsx` un comentario
 *     que LISTA los términos prohibidos "influencia/conexiones/afinidad/score").
 *     REUSAR verbatim (incluye el skip de `://` en URLs).
 *
 * (2) `LEYENDA_NEGACIONES` — la leyenda anti-insinuación LOCKED es un STRING
 *     RENDERIZADO que contiene la palabra "disciplina" en un contexto que la
 *     NIEGA ("No medimos disciplina ni motivo."). Es el patrón LOCKED de los
 *     tests de componente (`votos-por-parlamentario.test.tsx`: "la leyenda NIEGA
 *     'disciplina' → se resta antes del negative-match"). Se resta del contenido
 *     ANTES de matchear para no cazar la propia leyenda que enfuerza la regla.
 *
 * MUTATION SELF-CHECK (Test 2): el guard prueba, contra un fixture EN MEMORIA (no
 * un archivo del repo), que SÍ fallaría ante un término inyectado — para que el
 * guard NO sea un no-op verde vacío (T-68-02: tampering del guard mismo).
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { LEYENDA_ANTI_INSINUACION_MONEY } from "@/lib/money-presentacion";
import { LEYENDA_CROSS_LINK } from "@/components/cross-links-parlamentario";
import {
  LEYENDA_MENCIONES_LOBBY,
  EMPTY_MENCIONES_LOBBY,
} from "@/components/lobby-menciones-de-boletin";

// ---------------------------------------------------------------------------
// Helpers (espejo verbatim de lockdown-guard.test.ts)
// ---------------------------------------------------------------------------

// WR-06: anclar a import.meta.dirname (este archivo vive en app/lib/) en lugar de
// process.cwd() para evitar el bug conocido donde pnpm --filter exec cambia cwd
// y el guard escanea cero archivos silenciosamente (memory: v8.1 bug process.cwd).
const APP_ROOT = path.resolve(import.meta.dirname, "..");

/**
 * Eliminar comentarios de TypeScript/JavaScript:
 *  - bloques `/** … *\/` y `/* … *\/`
 *  - líneas `// …`
 * Esto evita que prosa en JSDoc/comentarios dispare los regex de términos.
 *
 * OJO (heredado del molde, WR-05): NO tratar `//` como comentario cuando va
 * precedido de `:` — cortar en el `//` de una URL (`"https://x.cl"`) truncaría la
 * línea y crearía un FALSO NEGATIVO. Heurística barata que cubre `http://`/`https://`.
 */
function stripTsComments(content: string): string {
  // Remove block comments (including JSDoc /** … */ and /* … */)
  let stripped = content.replace(/\/\*[\s\S]*?\*\//g, "");
  // Remove line comments (// …) — skipping `://` (URLs inside string literals)
  stripped = stripped
    .split("\n")
    .map((line) => {
      const idx = line.search(/(?<!:)\/\//);
      return idx >= 0 ? line.slice(0, idx) : line;
    })
    .join("\n");
  return stripped;
}

// ---------------------------------------------------------------------------
// Alcance: las superficies de voto ciudadanas (UI-SPEC §Linter).
// ---------------------------------------------------------------------------

/**
 * Rutas EXPLÍCITAS a escanear (relativas a app/). Lista dura — el linter cubre
 * exactamente el carril de voto ciudadano + la fuente de verdad de labels + la
 * sección VOTE de la ficha. Si una ruta no existe (p.ej. `ausencias-contexto.tsx`
 * borrado por la poda 68-03), se SALTA sin fallar (su ausencia es correcta).
 */
const SUPERFICIES_VOTO: string[] = [
  "components/votos-por-parlamentario.tsx",
  "components/votos-chart.tsx",
  "components/voto-detalle.tsx",
  "components/voto-row.tsx",
  "components/voto-ficha-row.tsx",
  "lib/voto-presentacion.ts",
  "app/parlamentario/[id]/page.tsx",
];

/**
 * Superficies MONEY (MONEY-04, 73-UI-SPEC §Linter). Las 4 superficies de dinero
 * (contratos/financiamiento por ficha; contratos/aportes por contraparte) + la
 * página `/contraparte`. `app/parlamentario/[id]/page.tsx` NO se duplica aquí: ya
 * está en `SUPERFICIES_VOTO` (monta las secciones MONEY gated). Se conserva el
 * corte voto/dinero en arrays separados por legibilidad (RESEARCH §Pattern 3 (b));
 * el bucle del guard escanea `[...SUPERFICIES_VOTO, ...SUPERFICIES_MONEY]`.
 *
 * WR-02: `components/parlamentario-resumen.tsx` renderiza los LABELS de los chips
 * MONEY gated (`construirChips` → "Contratos del Estado" / "Aportes de campaña" /
 * "Financiamiento y contratos" tras `moneyPublicEnabled(env)`). Esos labels ciudadanos
 * viven en el componente, NO en `page.tsx`, así que se agregan explícitamente aquí para
 * que cualquier label insinuante futuro se lintee (hoy son factuales → superficie limpia).
 */
const SUPERFICIES_MONEY: string[] = [
  "components/contratos-de-parlamentario.tsx",
  "components/financiamiento-de-parlamentario.tsx",
  "components/contratos-por-contraparte.tsx",
  "components/aportes-por-contraparte.tsx",
  "components/parlamentario-resumen.tsx",
  "app/contraparte/[id]/page.tsx",
];

/**
 * Superficies HOME (BENTO-06, 80-02). El copy de la home roza la lectura de datos:
 * el tile "¿Cómo leer esto?" usa la fórmula /sobre ("Cada dato lleva su fuente…
 * nunca se inventa") y el módulo de actualidad describe hechos de votaciones/urgencias.
 * Este guard es PREVENTIVO para copy FUTURO — el copy actual ya pasa (A2, research 80-02
 * §Pattern 3).
 *
 * Nota: `app/page.tsx` es la home (`/`), distinto de
 * `app/parlamentario/[id]/page.tsx` que ya está en SUPERFICIES_VOTO.
 * Si una ruta no existiera, el guard la salta sin fallar (misma tolerancia que las otras
 * superficies ante archivos borrados).
 */
const SUPERFICIES_HOME: string[] = [
  "app/page.tsx",
  "components/actualidad-module.tsx",
];

/**
 * Superficies BÚSQUEDA (88-03, RANK-01 / FILT-01-03). El carril de "ranking
 * explicable" y filtros client-side island es especialmente tentador para vocabulario
 * prohibido: `ranking`, `score`, `índice`, `puntaje`, `afinidad`. Este guard asegura
 * que el copy del island y del server component /buscar sea estrictamente factual.
 *
 * Rutas relativas a app/, mismo formato que los otros arrays.
 * Si una ruta no existe (p.ej. durante despliegue incremental), se salta sin fallar
 * (la tolerancia try/catch del bucle ya lo cubre).
 */
const SUPERFICIES_BUSQUEDA: string[] = [
  "components/buscar-filtros.tsx",
  "app/buscar/page.tsx",
];

/**
 * Superficies PERSONAS (91-03, BIO-03/BIO-04). El frente parlamentario 360 es el
 * vector #1 de insinuación de AFINIDAD: el chip de partido, las militancias, las
 * comisiones, y sobre todo los BLOQUES CROSS-LINK (mismo partido/zona/comisión/
 * co-autoría) + el filtro por partido tientan al vocabulario de bancada/afinidad
 * ("aliado", "cercano a", "bloque de", "afín", "coordina con", "alineado"). El copy
 * de estas superficies debe ser estrictamente FACTUAL: la relación es DECLARADA por
 * una fuente oficial, nunca inferida.
 *
 * NOTA (Pitfall 1, LOCKED): `cross-links-parlamentario.tsx` renderiza la leyenda
 * anti-causal `LEYENDA_CROSS_LINK`, que CONTIENE "afinidad" en un contexto que lo
 * NIEGA ("No implica afinidad…"). Por eso la leyenda se AÑADE a NEGACIONES_LOCKED
 * (abajo) ANTES de que esta superficie entre al scan — mismo tratamiento que las
 * leyendas VOTO/MONEY. Sin esa resta, el guard se auto-cazaría sobre la propia
 * superficie que enfuerza la regla.
 *
 * Rutas relativas a app/, mismo formato que los otros arrays. Si una ruta no existe,
 * se salta sin fallar (tolerancia try/catch del bucle).
 */
const SUPERFICIES_PERSONAS: string[] = [
  "components/partido-chip.tsx",
  "components/comisiones-de-parlamentario.tsx",
  "components/militancias-de-parlamentario.tsx",
  "components/cross-links-parlamentario.tsx",
  "components/parlamentarios-filtro.tsx",
  "components/parlamentario-directory-row.tsx",
  "components/parlamentario-header.tsx",
];

/**
 * Superficies LOBBY (92-03, LOB-02/LOB-03). El enlace audiencia→PL por mención
 * EXPLÍCITA de boletín es un vector de insinuación de causalidad: una "mención en el
 * registro" NO es "influencia en la tramitación" ni "relación causal", y el linter
 * debe garantizar que el copy de estas superficies lo mantenga estrictamente factual.
 *
 * Las 3 superficies nuevas de la fase:
 *  - `lobby-menciones-de-boletin.tsx`: la SECCIÓN nueva de la ficha proyecto
 *    (heading + leyenda anti-causal + filas con parlamentario enlazado + empty).
 *  - `mencion-boletin-chip.tsx`: el chip-link "Menciona boletín N" (ficha parlamentario).
 *  - `lobby-de-parlamentario.tsx`: la sección de lobby de la ficha parlamentario, que
 *    la fase EXTENDIÓ con materia legible + chips de mención.
 *
 * NOTA (Pitfall 1, LOCKED — lección BLOCKER 91): `lobby-menciones-de-boletin.tsx`
 * renderiza `LEYENDA_MENCIONES_LOBBY` (CONTIENE "influencia"/"relación causal" en un
 * contexto que los NIEGA) y `EMPTY_MENCIONES_LOBBY` (CONTIENE "actividad de lobby" en
 * un contexto que la NIEGA). Ambas se AÑADEN a NEGACIONES_LOCKED (abajo) ANTES de que
 * estas superficies entren al scan — sin esa resta, el guard se auto-cazaría sobre la
 * propia superficie que enfuerza la regla.
 *
 * Rutas relativas a app/, mismo formato que los otros arrays. Si una ruta no existe,
 * se salta sin fallar (tolerancia try/catch del bucle).
 */
const SUPERFICIES_LOBBY: string[] = [
  "components/lobby-menciones-de-boletin.tsx",
  "components/mencion-boletin-chip.tsx",
  "components/lobby-de-parlamentario.tsx",
];

/**
 * Superficies AGENDA (94-02, CIT-04/CIT-05). La /agenda por día + filtros de
 * periodista + banner de cobertura declarada es un vector de insinuación temporal/
 * causal: el estado de cancelación ("Suspendida"/"Sin efecto") y la cobertura
 * parcial NO deben editorializarse, y el island de filtros no debe agrupar por
 * afinidad inferida. El copy de estas superficies debe ser estrictamente FACTUAL.
 *
 * Las 5 superficies:
 *  - `agenda-filtros.tsx`: el island de filtros de periodista (94-02) — el ÚNICO
 *    renderer del listado por día post-hidratación (facetas + counts + reagrupación).
 *  - `agenda-cobertura.tsx`: el banner de cobertura declarada (94-01).
 *  - `estado-actual-block.tsx` (WR-03): el bloque "¿Dónde está hoy?" de la ficha
 *    de proyecto, que renderiza el copy NUEVO de la fase — "Citado el … (sesión
 *    pasada)" y "En tabla de sala N veces". Es EXACTAMENTE la superficie temporal/
 *    causal-adyacente que el linter existe para proteger, y la más tentada a
 *    derivar hacia editorialización ("citado reiteradamente", "insiste", etc.).
 *  - `citacion-card.tsx` (WR-03): la tarjeta de citación (island + SSR), que
 *    renderiza el estado de cancelación verbatim ("Suspendida"/"Sin efecto") + el
 *    bloque de invitados. Copy actual factual → superficie limpia; tripwire
 *    PREVENTIVO para copy futuro.
 *  - `app/agenda/page.tsx`: el Server Component de /agenda (serializa el slice,
 *    monta el island, mantiene el buscador FTS + leyendas de estado/cobertura).
 *
 * NOTA (Pitfall 1, lección BLOCKER 91): las leyendas LOCKED del banner/estado
 * ("…no es un calendario completo del Congreso.", "…no confirma que la sesión se
 * realizará.") usan "completo"/"confirma", que NO están en TERMINOS_PROHIBIDOS —
 * son negaciones honestas de términos NO prohibidos, así que NO requieren registro
 * en NEGACIONES_LOCKED (verificado 94-01/94-02: el diff de TERMINOS_PROHIBIDOS no
 * contiene "completo" ni "confirma"). El copy de `estado-actual-block.tsx` y
 * `citacion-card.tsx` se VERIFICÓ igualmente limpio (WR-03): "(sesión pasada)",
 * "En tabla de sala N veces", "Sin urgencia vigente", "Suspendida"/"Sin efecto"
 * no contienen ni NIEGAN término prohibido → NO requieren NEGACIONES_LOCKED. Si
 * alguna leyenda futura negara un término prohibido, debe registrarse verbatim
 * ANTES de escanear.
 *
 * Rutas relativas a app/, mismo formato que los otros arrays. Si una ruta no existe,
 * se salta sin fallar (tolerancia try/catch del bucle).
 */
const SUPERFICIES_AGENDA: string[] = [
  "components/agenda-filtros.tsx",
  "components/agenda-cobertura.tsx",
  "components/estado-actual-block.tsx",
  "components/citacion-card.tsx",
  "app/agenda/page.tsx",
];

/**
 * Superficies DEEP-LINK (89-03, TRACE-01/02/03). El bloque "Valida este dato en la
 * fuente" de la ficha de proyecto renderiza URLs de fuente oficial (Senado/BCN/R2)
 * + fecha de captura + hash. Copy actual factual (TRACE: URLs reproducibles, fecha,
 * hash) → superficie limpia; tripwire PREVENTIVO para copy futuro. Si el componente
 * de provenance-badge existe también se incluye (mismo rationale que SUPERFICIES_HOME).
 *
 * NO se necesita NEGACIONES_LOCKED nueva: el copy de validacion-fuente.tsx no usa
 * ningún término prohibido ni siquiera para negarlo (verificado 95-02 TRACE-01/02/03).
 */
const SUPERFICIES_DEEPLINK: string[] = [
  "components/validacion-fuente.tsx",
  "components/provenance-badge.tsx",
];

/**
 * Términos prohibidos (lista dura VERBATIM de 68-UI-SPEC §Linter). Se buscan en el
 * texto RENDERIZADO (post-strip de comentarios), con límite de palabra en español
 * para no cazar identificadores snake_case: `rebeldias_de_parlamentario` (nombre de
 * RPC, sin tilde, con `_`) NO dispara; `rebeldía`/`rebeldías` en prosa SÍ.
 *
 * Los acentos importan: los términos con tilde se buscan CON la tilde (`rebeldía`,
 * `índice`, `díscolo`, `traición`, `cercanía`).
 */
const TERMINOS_PROHIBIDOS: string[] = [
  "rebeldía",
  "rebeldías",
  "rebelde",
  "disciplina",
  "indisciplina",
  "alineamiento",
  "alineado",
  "alineada",
  "afinidad",
  "cercanía política",
  "lealtad",
  "traición",
  "díscolo",
  "score",
  "puntaje",
  "índice",
  "ranking",
  "nivel de acuerdo",
  "vota como",
  "votan como",
  "similar a",
  "mediana de su cámara",
  "financió su voto",
  "a cambio de",
  // --- Carril MONEY (MONEY-04, 73-UI-SPEC §Linter) — causalidad dinero→decisión
  //     e insinuación. TILDES EXACTAS (Pitfall 2: buildTermRegex NO es
  //     accent-insensitive). "empresa ligada a" bloquea la construcción
  //     insinuante (con la preposición `a`); el HECHO "Enlazado por RUT" /
  //     "ligada por RUT" / el identificador `empresa_ligada_por_rut` NO disparan
  //     por el límite de palabra (Pitfall 3). "a cambio de" ya viene por el carril
  //     de voto y cubre "a cambio de un contrato".
  "financió",
  "a cambio del voto",
  "compró",
  "compró su voto",
  "pagó por",
  "soborno",
  "coima",
  "corrupción",
  "favoreció",
  "empresa ligada a",
  "conflicto de interés",
  "influencia",
  "captura",
  "lobby a cambio",
  "contrato a dedo",
  "direccionado",
  // --- WR-01: paráfrasis insinuantes de alta frecuencia que la denylist exacta
  //     dejaba pasar (verificadas como falsos-negativos en la review). Se cierran
  //     los idioms obvios; NO es exhaustivo (ver JSDoc del detector abajo).
  "influencias", // plural: "tráfico de influencias" (la denylist tenía sólo "influencia")
  "tráfico de influencias",
  "vinculado a irregularidades",
  "vinculado a",
  "ligado a",
  "beneficiado por",
  "beneficiado",
  "favores",
  "puerta giratoria",
  "puertas giratorias",
  "recibió aportes y luego votó",
  "a dedo",
  "direccionamiento",
  "quid pro quo",
  "kickback",
  // --- Carril PERSONAS (91-03, BIO-03/BIO-04) — vocabulario de bancada/afinidad
  //     que el frente parlamentario 360 (partido, militancias, cross-links, filtro)
  //     tienta. TILDES EXACTAS. Dedupe verificado: "alineado"/"alineada" ya viven
  //     arriba (carril VOTO) y "vinculado a" en el carril MONEY → NO se re-agregan.
  //     "cercano a" cubre "cercano a su bloque/partido"; "bloque de" cubre
  //     "bloque de derecha/izquierda"; "coordina con" cubre coordinación inferida.
  "aliado",
  "cercano a",
  "bloque de",
  "afín",
  "coordina con",
];

/**
 * Fragmentos LOCKED que contienen un término prohibido en un contexto que lo NIEGA
 * (la propia leyenda anti-insinuación). Se restan del contenido ANTES de matchear —
 * patrón idéntico a los tests de componente ("la leyenda NIEGA 'disciplina' → se
 * resta antes del negative-match"). Verbatim de 68-UI-SPEC §Leyenda / §Copywriting.
 */
const NEGACIONES_LOCKED: string[] = [
  "Un voto es un hecho observable. Ausente o pareo no equivalen a votar en contra. No medimos disciplina ni motivo.",
  // Leyenda MONEY (single-source en money-presentacion.ts). NIEGA "influencia"/
  // "intención"/"irregularidad" y usa "compre una decisión" → sin restarla el
  // guard se auto-cazaría sobre la propia superficie que la renderiza (Pitfall 1).
  // Importada verbatim para no re-tipearla (si el copy cambia, cambia aquí solo).
  LEYENDA_ANTI_INSINUACION_MONEY,
  // Leyenda CROSS-LINK (91-03, single-source en cross-links-parlamentario.tsx).
  // NIEGA "afinidad" ("No implica afinidad, coordinación ni causalidad."). Sin
  // restarla, el scan de SUPERFICIES_PERSONAS se auto-cazaría sobre la propia
  // superficie que renderiza la leyenda (Pitfall 1). Importada verbatim.
  LEYENDA_CROSS_LINK,
  // Leyenda MENCIONES-LOBBY (92-03, single-source en lobby-menciones-de-boletin.tsx).
  // NIEGA "influencia" y "relación causal" ("…no implica influencia en la tramitación
  // ni relación causal con el proyecto."). Sin restarla, el scan de SUPERFICIES_LOBBY
  // se auto-cazaría sobre la propia superficie que renderiza la leyenda (Pitfall 1,
  // lección BLOCKER 91: registrar la negación ANTES de añadir la superficie).
  LEYENDA_MENCIONES_LOBBY,
  // Empty state de la sección de menciones (92-03, single-source). NIEGA "actividad de
  // lobby" ("Esto no describe la actividad de lobby en torno al proyecto…"). Misma
  // razón que arriba — el copy honesto usa el término para NEGARLO explícitamente.
  EMPTY_MENCIONES_LOBBY,
];

/**
 * Construye el regex de un término con límite de palabra tolerante a acentos.
 * `\b` de JS no maneja bien caracteres acentuados (los trata como no-palabra), así
 * que usamos lookarounds sobre la clase de "carácter de palabra en español"
 * (letras ASCII + acentuadas + dígitos + `_`). Con esto:
 *  - `rebeldía` en " la rebeldía de …" → MATCH.
 *  - `rebeldias_de_parlamentario` → NO match (`s` seguido de `_`, que es palabra).
 *  - `score` en "un score de" → MATCH; `scoreboard` → NO match.
 * Los términos multi-palabra (con espacio) usan `\s+` entre tokens.
 */
const WORD = "A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9_";

function buildTermRegex(term: string): RegExp {
  const tokens = term.trim().split(/\s+/).map(escapeRegex);
  const body = tokens.join("\\s+");
  // (?<![WORD]) antes y (?![WORD]) después = límite de palabra tolerante a acentos.
  return new RegExp(`(?<![${WORD}])${body}(?![${WORD}])`, "i");
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Detector puro y testeable: dado el CONTENIDO CRUDO de un archivo (o fixture),
 * devuelve los términos prohibidos que aparecen en el texto RENDERIZADO. Aplica
 * `stripTsComments` y resta las negaciones LOCKED antes de matchear.
 *
 * Es la pieza que el mutation self-check (Test 2) ejercita contra un string inyectado.
 */
function detectarInsinuaciones(rawContent: string): string[] {
  let texto = stripTsComments(rawContent);
  // IN-03 fix: normalizar whitespace antes de restar negaciones LOCKED,
  // para que JSX line-wrapping / espacios extra no impidan la sustracción.
  texto = texto.replace(/\s+/g, " ");
  for (const neg of NEGACIONES_LOCKED) {
    // Restar cada aparición de la negación LOCKED (post-normalización).
    const negNorm = neg.replace(/\s+/g, " ");
    texto = texto.split(negNorm).join(" ");
  }
  const hits: string[] = [];
  for (const term of TERMINOS_PROHIBIDOS) {
    if (buildTermRegex(term).test(texto)) hits.push(term);
  }
  return hits;
}

// ---------------------------------------------------------------------------
// (1) Guard — CERO términos de insinuación en el render de las superficies de voto
// ---------------------------------------------------------------------------

describe("(1) Guard — ninguna superficie de voto ni MONEY insinúa (texto renderizado)", () => {
  it("sanity: al menos escanea votos-por-parlamentario.tsx (existe y es legible)", () => {
    const principal = path.join(
      APP_ROOT,
      "components",
      "votos-por-parlamentario.tsx",
    );
    expect(readFileSync(principal, "utf-8").length).toBeGreaterThan(100);
  });

  it("sanity WR-06: buscar-filtros.tsx es scannable con contenido no trivial", () => {
    // Si APP_ROOT está mal (cwd vs dirname mismatch), readFileSync lanza y el test falla
    // explícitamente en lugar de que el guard pase verde habiendo escaneado cero archivos.
    const buscarFiltros = path.join(APP_ROOT, "components", "buscar-filtros.tsx");
    expect(readFileSync(buscarFiltros, "utf-8").length).toBeGreaterThan(100);
  });

  it("ningún término prohibido aparece en el texto renderizado (post-strip de comentarios)", () => {
    const offenders: string[] = [];
    for (const rel of [...SUPERFICIES_VOTO, ...SUPERFICIES_MONEY, ...SUPERFICIES_HOME, ...SUPERFICIES_BUSQUEDA, ...SUPERFICIES_PERSONAS, ...SUPERFICIES_LOBBY, ...SUPERFICIES_AGENDA, ...SUPERFICIES_DEEPLINK]) {
      const full = path.join(APP_ROOT, rel);
      let raw: string;
      try {
        raw = readFileSync(full, "utf-8");
      } catch {
        // Ausencia legítima (p.ej. ausencias-contexto.tsx borrado por la poda 68-03).
        continue;
      }
      for (const term of detectarInsinuaciones(raw)) {
        offenders.push(`${rel} → "${term}"`);
      }
    }
    expect(
      offenders,
      `Vocabulario de insinuación en el render de superficies de voto ` +
        `(un voto es un HECHO DESCRIPTIVO, no un juicio): [${offenders.join("; ")}]. ` +
        `Elimina el término del copy renderizado; si es un comentario/doc, envuélvelo ` +
        `en // o /* */ (el guard strippea comentarios); si es la leyenda LOCKED que ` +
        `NIEGA el término, añádela a NEGACIONES_LOCKED verbatim.`,
    ).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// (2) Mutation self-check — el guard NO es un no-op: FALLA ante un término inyectado
// ---------------------------------------------------------------------------

describe("(2) Mutation self-check — el guard SÍ muerde", () => {
  it("detecta un término inyectado en un fixture EN MEMORIA (no un archivo del repo)", () => {
    // Un string que simula JSX renderizado con una insinuación PROHIBIDA.
    const fixtureMutado = `
      export function Malo() {
        return <p>Este parlamentario vota por rebeldía contra su bancada.</p>;
      }
    `;
    const hits = detectarInsinuaciones(fixtureMutado);
    expect(
      hits,
      "El detector NO cazó 'rebeldía' inyectado en render → el guard sería un no-op",
    ).toContain("rebeldía");
  });

  it("detecta varios términos inyectados (score, disciplina, mediana de su cámara)", () => {
    const fixture = `
      <span>score de disciplina: 7 — falta más que la mediana de su cámara</span>
    `;
    const hits = detectarInsinuaciones(fixture);
    expect(hits).toEqual(
      expect.arrayContaining([
        "score",
        "disciplina",
        "mediana de su cámara",
      ]),
    );
  });

  it("MONEY: caza causalidad dinero→voto inyectada (financió / a cambio de)", () => {
    const fixtureMoney = `
      <p>esta empresa financió su voto a cambio de un contrato</p>
    `;
    const hits = detectarInsinuaciones(fixtureMoney);
    expect(
      hits,
      "El detector NO cazó causalidad de dinero inyectada → el guard MONEY sería un no-op",
    ).toEqual(
      expect.arrayContaining(["financió", "financió su voto", "a cambio de"]),
    );
  });

  it("MONEY: caza insinuación patrimonial inyectada (empresa ligada a / corrupción / conflicto de interés)", () => {
    const fixtureMoney = `
      <p>empresa ligada a un caso de corrupción; conflicto de interés evidente</p>
    `;
    const hits = detectarInsinuaciones(fixtureMoney);
    expect(hits).toEqual(
      expect.arrayContaining([
        "empresa ligada a",
        "corrupción",
        "conflicto de interés",
      ]),
    );
  });

  it("MONEY: caza 'contrato a dedo' inyectado (idiom singular del término)", () => {
    const hits = detectarInsinuaciones(`<p>fue un contrato a dedo</p>`);
    expect(hits).toContain("contrato a dedo");
  });

  it("MONEY (WR-01): caza paráfrasis antes-omitidas (tráfico de influencias / beneficiado por / vinculado a / a dedo)", () => {
    const hits = detectarInsinuaciones(
      `<p>tráfico de influencias: beneficiado por el contrato, vinculado a
        irregularidades y adjudicado a dedo</p>`,
    );
    expect(hits).toEqual(
      expect.arrayContaining([
        "tráfico de influencias",
        "influencias",
        "beneficiado por",
        "vinculado a",
        "a dedo",
      ]),
    );
  });

  it("MONEY (WR-01): caza inglés y puertas giratorias (quid pro quo / kickback / puerta giratoria)", () => {
    const hits = detectarInsinuaciones(
      `<p>quid pro quo evidente: un kickback y una puerta giratoria</p>`,
    );
    expect(hits).toEqual(
      expect.arrayContaining(["quid pro quo", "kickback", "puerta giratoria"]),
    );
  });

  it("PERSONAS (91-03): caza un término de bancada/afinidad FRESCO inyectado (cercano a su bloque)", () => {
    // Término NO-negado por ninguna leyenda LOCKED → prueba que el guard MUERDE
    // sobre lo nuevo aunque la leyenda cross-link (que NIEGA 'afinidad') esté restada.
    // "cercano a" y "bloque de" son términos nuevos del carril PERSONAS.
    const fixtureMutado = `
      <p>Este parlamentario es cercano a su bloque de derecha y aliado del comité.</p>
    `;
    const hits = detectarInsinuaciones(fixtureMutado);
    expect(
      hits,
      "El detector NO cazó vocabulario de bancada inyectado → el guard PERSONAS sería un no-op",
    ).toEqual(
      expect.arrayContaining(["cercano a", "bloque de", "aliado"]),
    );
  });

  it("PERSONAS (91-03): caza 'afín' / 'coordina con' inyectados (afinidad/coordinación explícita)", () => {
    const hits = detectarInsinuaciones(
      `<span>es afín al oficialismo y coordina con la bancada</span>`,
    );
    expect(hits).toEqual(expect.arrayContaining(["afín", "coordina con"]));
  });

  it("AGENDA (94-02): caza editorialización temporal/causal inyectada en el island de agenda (influencia / disciplina) sobre lo NUEVO", () => {
    // Término causal/de-juicio FRESCO inyectado en un fixture EN MEMORIA que simula
    // el island de agenda o el banner. Prueba que el guard MUERDE sobre el carril
    // AGENDA — el estado de cancelación es un HECHO NEUTRO, jamás un juicio de
    // "disciplina" ni una insinuación de "influencia" en la citación.
    const fixtureMutado = `
      export function AgendaFiltros() {
        return (
          <section aria-label="Filtrar la agenda de esta semana">
            <p>La suspensión revela falta de disciplina y la influencia del comité.</p>
          </section>
        );
      }
    `;
    const hits = detectarInsinuaciones(fixtureMutado);
    expect(
      hits,
      "El detector NO cazó editorialización de agenda inyectada → el guard AGENDA sería un no-op",
    ).toEqual(expect.arrayContaining(["disciplina", "influencia"]));
  });

  it("DEEPLINK (95-02): caza insinuación inyectada en fixture de validacion-fuente (SC#4)", () => {
    // Fixture EN MEMORIA que simula copy insinuante en la superficie deep-link 89.
    // Prueba que el guard MUERDE sobre lo nuevo — cero contacto con disco en el self-check.
    const fixtureDeepLink = `
      <p>Este dato fue obtenido gracias a la influencia del parlamentario sobre la tramitación.</p>
    `;
    const hits = detectarInsinuaciones(fixtureDeepLink);
    expect(
      hits,
      "El detector NO cazó 'influencia' inyectado en fixture deep-link → el guard DEEPLINK sería un no-op",
    ).toContain("influencia");
  });

  it("LOBBY (92-03): caza causalidad de mención inyectada (influencia / a cambio de) sobre lo NUEVO", () => {
    // Término causal FRESCO inyectado en un fixture EN MEMORIA que simula la sección
    // de menciones. Prueba que el guard MUERDE sobre el carril LOBBY aunque la leyenda
    // LOCKED (que NIEGA 'influencia') esté restada en NEGACIONES_LOCKED.
    const fixtureMutado = `
      export function SeccionMenciones() {
        return (
          <section id="lobby-menciones">
            <p>Este lobby tuvo influencia en la tramitación, a cambio de un voto.</p>
          </section>
        );
      }
    `;
    const hits = detectarInsinuaciones(fixtureMutado);
    expect(
      hits,
      "El detector NO cazó causalidad de mención inyectada → el guard LOBBY sería un no-op",
    ).toEqual(expect.arrayContaining(["influencia", "a cambio de"]));
  });
});

// ---------------------------------------------------------------------------
// (3) No-falsos-positivos — comentarios, identificadores y la leyenda LOCKED
// ---------------------------------------------------------------------------

describe("(3) Sin falsos positivos — strip de comentarios, límites de palabra, negación LOCKED", () => {
  it("un término dentro de un comentario `//` o `/* */` NO cuenta como offender", () => {
    const conComentarios = `
      // esto documenta la regla: prohibido el término disciplina y rebeldía
      /* el nombre interno "rebeldías" JAMÁS se renderiza; score/ranking tampoco */
      export const X = <p>Cómo votó</p>;
    `;
    expect(detectarInsinuaciones(conComentarios)).toEqual([]);
  });

  it("el identificador snake_case `rebeldias_de_parlamentario` en `.rpc()` NO dispara", () => {
    // Sin tilde y con `_` a ambos lados del token → no es palabra renderizada.
    const conRpc = `const r = sb.rpc("rebeldias_de_parlamentario", { id });`;
    expect(detectarInsinuaciones(conRpc)).toEqual([]);
  });

  it("la leyenda anti-insinuación LOCKED (que NIEGA 'disciplina') NO es offender", () => {
    const conLeyenda = `
      const LEYENDA =
        "Un voto es un hecho observable. Ausente o pareo no equivalen a votar en contra. No medimos disciplina ni motivo.";
      export const V = <p>{LEYENDA}</p>;
    `;
    expect(detectarInsinuaciones(conLeyenda)).toEqual([]);
  });

  it("edge: `://` en una URL de string literal no rompe el strip (heredado del molde)", () => {
    const conUrl = `const src = "https://www.camara.cl/votacion"; // fuente oficial`;
    // No hay término prohibido; lo que se verifica es que el strip no truncó el string.
    expect(detectarInsinuaciones(conUrl)).toEqual([]);
    expect(stripTsComments(conUrl)).toContain("https://www.camara.cl/votacion");
  });

  it("`similar a` (contexto de voto) se caza pero `similares` NO (límite de palabra)", () => {
    expect(detectarInsinuaciones(`<p>vota similar a su bancada</p>`)).toContain(
      "similar a",
    );
    expect(detectarInsinuaciones(`<p>proyectos similares</p>`)).toEqual([]);
  });

  // --- MONEY: el HECHO factual NO se conflaciona con la insinuación (Pitfall 3) ---

  it("MONEY: el HECHO `Enlazado por RUT al parlamentario.` NO dispara (RUT-exacto es hecho)", () => {
    const factual = `<p className="muted">Enlazado por RUT al parlamentario.</p>`;
    expect(detectarInsinuaciones(factual)).toEqual([]);
  });

  it("MONEY: `Asociado por nombre confirmado al candidato.` NO dispara", () => {
    const factual = `<p className="muted">Asociado por nombre confirmado al candidato.</p>`;
    expect(detectarInsinuaciones(factual)).toEqual([]);
  });

  it("MONEY: el identificador snake_case `empresa_ligada_por_rut` en `.rpc()` NO dispara", () => {
    // `empresa ligada a` está bloqueado, pero el token snake_case con `_` a los
    // lados no es palabra renderizada → no caza por el límite de palabra.
    const conRpc = `const r = sb.rpc("empresa_ligada_por_rut", {});`;
    expect(detectarInsinuaciones(conRpc)).toEqual([]);
  });

  it("MONEY: la leyenda anti-insinuación MONEY completa (que NIEGA 'influencia'/'irregularidad') NO es offender", () => {
    // Restada en NEGACIONES_LOCKED (Pitfall 1): montar la leyenda verbatim → [].
    const conLeyenda = `
      const LEYENDA = ${JSON.stringify(LEYENDA_ANTI_INSINUACION_MONEY)};
      export const M = <p>{LEYENDA}</p>;
    `;
    expect(detectarInsinuaciones(conLeyenda)).toEqual([]);
  });

  it("PERSONAS (91-03): la leyenda cross-link (que NIEGA 'afinidad') NO es offender", () => {
    // Restada en NEGACIONES_LOCKED (Pitfall 1): la leyenda CONTIENE "afinidad" pero
    // la NIEGA ("No implica afinidad, coordinación ni causalidad.") → montar verbatim → [].
    const conLeyenda = `
      const LEYENDA = ${JSON.stringify(LEYENDA_CROSS_LINK)};
      export const C = <p>{LEYENDA}</p>;
    `;
    expect(detectarInsinuaciones(conLeyenda)).toEqual([]);
  });

  it("LOBBY (92-03): la leyenda de menciones (que NIEGA 'influencia'/'relación causal') NO es offender", () => {
    // Restada en NEGACIONES_LOCKED (Pitfall 1, lección BLOCKER 91): la leyenda CONTIENE
    // "influencia" pero la NIEGA ("…no implica influencia en la tramitación ni relación
    // causal con el proyecto.") → montar verbatim → []. Sin la resta, el linter daría
    // falso-positivo y BLOQUEARÍA la fase (como en 91).
    const conLeyenda = `
      const LEYENDA = ${JSON.stringify(LEYENDA_MENCIONES_LOBBY)};
      export const M = <p>{LEYENDA}</p>;
    `;
    expect(detectarInsinuaciones(conLeyenda)).toEqual([]);
  });

  it("LOBBY (92-03): el empty state de menciones (que NIEGA 'actividad de lobby') NO es offender", () => {
    // El empty CONTIENE "actividad de lobby" pero la NIEGA ("…no describe la actividad
    // de lobby en torno al proyecto…"). Restado en NEGACIONES_LOCKED → montar verbatim → [].
    const conEmpty = `
      const EMPTY = ${JSON.stringify(EMPTY_MENCIONES_LOBBY)};
      export const E = <p>{EMPTY}</p>;
    `;
    expect(detectarInsinuaciones(conEmpty)).toEqual([]);
  });
});
