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
  COBERTURA_MENCIONES_LOBBY,
} from "@/components/lobby-menciones-de-boletin";
import { LEYENDA_SIMILITUD_VOTO } from "@/components/similitud-votacion-comparar";
import { LEYENDA_RECURSO_NO_HUMANO } from "@/lib/recurso-no-humano";

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
 * Superficies PANEL (100-01, PANEL-01). El panel de actualidad de la home lee la RPC
 * precomputada `actualidad_senales_panel` (0066) y agrupa por `tipo_senal` (velocity/
 * nuevos_ingresos/urgencias/agenda/archivados/agrupación). Es el vector #1 de
 * insinuación TEMPORAL/EDITORIAL: describir la velocidad de tramitación, un reingreso,
 * una citación de madrugada o un "top de cámara más activa" editorializa un HECHO
 * observable (conteo + cobertura declarada + fecha) en un juicio de intención.
 *
 * TRIPWIRE ANTES DEL COPY (Pitfall 6 + 3, lección BLOCKER 91): esta superficie se
 * declara en Wave 0 (guards) ANTES de que el componente exista (Wave 2). El loader del
 * bucle de escaneo TOLERA archivos faltantes (try/catch continue) → la ruta declarada
 * se salta hoy (guard VERDE) y MUERDE recién cuando `panel-actualidad.tsx` exista.
 *
 * Si el panel se divide en sub-tiles (p.ej. `panel-tile-senal.tsx`), esos archivos se
 * SUMAN a este array. Rutas relativas a app/, mismo formato que los otros arrays.
 *
 * NOTA NEGACIONES_LOCKED: el germen del copy NO introduce ninguna leyenda que NIEGUE
 * un término prohibido. Si el copy del Plan 02 introduce una leyenda que NIEGA un
 * término prohibido, esa leyenda debe registrarse verbatim en NEGACIONES_LOCKED ANTES
 * de que esta superficie entre al escaneo real (Pitfall 2, lección BLOCKER 91).
 */
const SUPERFICIES_PANEL: string[] = [
  "components/panel-actualidad.tsx",
  // + sub-tiles del panel si el componente se divide (Plan 02)
];

/**
 * Superficies RELACIONES (101-02, REL-02/REL-03). El bloque de relaciones de la
 * ficha (des-enterrado above-the-fold) + la ruta nueva `/comparar` A/B por eje son
 * el vector #1 de insinuación de AFINIDAD/coalición: describir que dos parlamentarios
 * "comparten X" (partido/zona/comisión/co-autoría/militancia histórica) tienta el
 * vocabulario de bancada ("aliado", "cercano a", "bloque de", "afín", "coordina con")
 * y la insinuación de coalición inferida. El copy de estas superficies debe ser
 * estrictamente FACTUAL: la relación es DECLARADA por una fuente oficial, nunca
 * inferida; la comparación muestra hechos con fuente y fecha, jamás ordena ni puntúa.
 *
 * TRIPWIRE ANTES DEL COPY (Pitfall 6 + patrón Wave-0 Phase 100, lección BLOCKER 91):
 * estas 4 superficies se declaran en Wave 0 (guards) ANTES de que el copy nuevo
 * aterrice. `relaciones-section.tsx` existe ya en este plan (Task 2); las otras tres
 * (`relaciones-eje-comparar.tsx`, `app/comparar/page.tsx`, `comparar-selector.tsx`)
 * las crea Plan 03. El loader del bucle de escaneo TOLERA archivos faltantes
 * (try/catch continue) → las rutas aún ausentes se saltan hoy (guard VERDE) y MUERDEN
 * recién cuando el archivo exista.
 *
 * NOTA NEGACIONES_LOCKED: la sección de relaciones REUSA `LEYENDA_CROSS_LINK` verbatim
 * como leyenda de grupo — ya está en NEGACIONES_LOCKED (NIEGA "afinidad"), así que NO
 * requiere entrada nueva. El heading "Relaciones con otros parlamentarios" y el heading
 * del 5º bloque "Militaron en el mismo partido" (WR-03) NO niegan ningún término
 * prohibido → no requieren registro. Si Plan 03 introduce una leyenda nueva que NIEGA
 * un término prohibido (p.ej. en `/comparar`), debe registrarla verbatim ANTES de que
 * la superficie entre al escaneo real (Pitfall 6).
 *
 * Rutas relativas a app/, mismo formato que los otros arrays. Si una ruta no existe,
 * se salta sin fallar (tolerancia try/catch del bucle).
 */
const SUPERFICIES_RELACIONES: string[] = [
  "components/relaciones-section.tsx",
  "components/relaciones-eje-comparar.tsx",
  "app/comparar/page.tsx",
  "components/comparar-selector.tsx",
];

/**
 * Superficies VSIM (102-01, VSIM-02/VSIM-03) — similitud de votación. La sección de
 * coincidencia de votos entre dos parlamentarios (gated legal, anti-DW-NOMINATE) es el
 * vector #1 de insinuación de AFINIDAD/coordinación por co-votación: describir que dos
 * parlamentarios "votan igual/juntos/parecido" o son "aliados" con una "tasa de
 * coincidencia" tienta la lectura de bancada/señal. El copy debe ser estrictamente
 * FACTUAL: la cifra es un CONTEO de coincidencias sobre votaciones compartidas, con
 * caveat de base-alta obligatorio (la coincidencia alta es la NORMA, no una señal);
 * jamás una medida de afinidad ni un ranking.
 *
 * TRIPWIRE ANTES DEL COPY (Wave 0, lección BLOCKER 91): `similitud-votacion-comparar.tsx`
 * existe ya en este plan (contiene SOLO la constante LEYENDA_SIMILITUD_VOTO; su cuerpo
 * presentacional lo llena Plan 03). `app/comparar/page.tsx` NO se duplica aquí — ya está
 * en SUPERFICIES_RELACIONES (Pitfall 4 DEDUPE). El loader del bucle TOLERA archivos
 * faltantes (try/catch continue).
 *
 * NOTA NEGACIONES_LOCKED: la sección VSIM renderiza `LEYENDA_SIMILITUD_VOTO`, que CONTIENE
 * "afinidad" y "señal" (términos prohibidos) para NEGARLOS. Se registra verbatim en
 * NEGACIONES_LOCKED ANTES de que SUPERFICIES_VSIM entre al scan real (Pitfall 3), o el
 * linter se auto-cazaría sobre su propia leyenda.
 */
const SUPERFICIES_VSIM: string[] = [
  "components/similitud-votacion-comparar.tsx",
  // app/comparar/page.tsx YA está en SUPERFICIES_RELACIONES — NO duplicar (Pitfall 4).
];

/**
 * Superficies NOTIF (103-03, NOTIF-01/04/05) — suscripciones + digest. El frente
 * de notificaciones ("Seguir" en las fichas + el centro de cuenta `/cuenta` + los
 * aterrizajes login-less de confirmación/baja) es un vector de insinuación de
 * INSTANTANEIDAD y de EDITORIALIZACIÓN del resumen: el copy JAMÁS debe prometer un
 * aviso inmediato ("avisos instantáneos" se NIEGA explícitamente), ni describir lo
 * que sigue el usuario con vocabulario de afinidad/ranking. El resumen es un HECHO
 * PROGRAMADO ("una vez al día, de lunes a viernes"), cada ítem con fuente+fecha+
 * enlace; nunca una promesa de tiempo real ni un juicio.
 *
 * TRIPWIRE ANTES DEL COPY (Wave-0, lección BLOCKER 91): estas superficies se
 * declaran ANTES de escribir el copy de `/cuenta`, del botón y de las páginas de
 * confirmar/baja. El loader del bucle TOLERA archivos faltantes (try/catch continue)
 * → las rutas aún ausentes se saltan hoy y MUERDEN recién cuando el archivo exista.
 *
 * NOTA NEGACIONES_LOCKED: el copy NOTIF NIEGA "avisos instantáneos" ("No enviamos
 * avisos instantáneos: los datos se actualizan por procesos programados."), pero
 * "instantáneos"/"instantaneidad" NO están en TERMINOS_PROHIBIDOS → no requieren
 * registro en NEGACIONES_LOCKED (es una negación honesta de un término NO prohibido,
 * mismo caso que las leyendas de AGENDA "completo"/"confirma"). Si un copy futuro de
 * NOTIF negara un término PROHIBIDO, debe registrarse verbatim ANTES de que la
 * superficie entre al scan real (Pitfall 3).
 *
 * El template del email digest (`packages/notificaciones/src/digest.ts`, Plan 04)
 * vive fuera de `app/` (APP_ROOT) → NO se escanea aquí; su copy anti-insinuación se
 * cubre en el Plan 04 con su propio guard de paquete. Rutas relativas a app/, mismo
 * formato que los otros arrays.
 */
const SUPERFICIES_NOTIF: string[] = [
  "app/cuenta/page.tsx",
  "app/cuenta/actions.ts",
  "components/seguir-button.tsx",
  "app/notificaciones/confirmar/page.tsx",
  "app/notificaciones/baja/page.tsx",
];

/**
 * Superficies LINK-EXT (115-03, LINK-03) — patrones de link a fuente oficial. La fase
 * 115 corrige los enlaces externos que apuntaban a un recurso NO humano (XML crudo /
 * API JSON / servicio de datos) y DECLARA la limitación allí donde no existe una URL
 * humana derivable (`115-VEREDICTO.md` §4, acciones A-3/A-4/A-5).
 *
 * El riesgo específico de una fase de LINKS no es el vocabulario de bancada sino
 * insinuar que la fuente OCULTA, ESCONDE, CENSURA o SE NIEGA A publicar el dato. Que
 * un organismo publique un web service en vez de una página de consulta es un HECHO
 * de formato, jamás una intención. Por eso este carril suma su propio vocabulario
 * (abajo, bloque LINK-EXT de TERMINOS_PROHIBIDOS) ANTES de que exista una sola línea
 * del copy nuevo (orden LOCKED 68-01 / 100-01 / 101-02 / 103-03).
 *
 * Las superficies que la fase toca o que emiten copy sobre el origen del enlace:
 *  - `components/timeline-event.tsx`  — el `<a>` "Ver fuente oficial ↗" por evento (A-2).
 *  - `components/timeline-view.tsx`   — el intermediario con los DOS call-sites del evento,
 *                                       y donde se DECLARA la leyenda una vez por contenedor.
 *  - `components/buscar-filtros.tsx`  — el badge de cada resultado de /buscar (A-1).
 *  - `components/provenance-badge.tsx`— el badge que declara la limitación (A-3/4/5).
 *  - `lib/recurso-no-humano.ts`       — donde vive HOY la leyenda (single-source, CR-01).
 *
 * DEDUPE (Pitfall 4, precedente `app/comparar/page.tsx` en VSIM): `buscar-filtros.tsx`
 * ya vive en `SUPERFICIES_BUSQUEDA` y `provenance-badge.tsx` en `SUPERFICIES_DEEPLINK`.
 * Se listan IGUALMENTE aquí porque §4 los nombra y este array debe ser el registro
 * completo del alcance de la fase; la duplicación se disuelve en el propio bucle de
 * escaneo con un `Set` (ver Test (1)), de modo que ningún archivo se escanea dos veces
 * ni un offender se reporta duplicado. Los arrays previos NO se tocan.
 *
 * NOTA NEGACIONES_LOCKED: la leyenda de recurso no-humano propuesta por §4 —«La fuente
 * oficial publica este dato como servicio de datos, no como página de consulta.»— NO
 * contiene ningún término prohibido, ni siquiera para negarlo, de modo que NO requiere
 * registro (mismo caso que las leyendas de AGENDA "completo"/"confirma" y las de NOTIF).
 * Eso se VERIFICA aquí, no se asume: el Test (3) monta la leyenda verbatim y exige `[]`.
 * Si un copy futuro de este carril negara un término PROHIBIDO, debe registrarse
 * verbatim en NEGACIONES_LOCKED ANTES de escribirse (Pitfall 3).
 *
 * Rutas relativas a app/, mismo formato que los otros arrays. Si una ruta no existe,
 * se salta sin fallar (tolerancia try/catch del bucle).
 */
const SUPERFICIES_LINK_EXT: string[] = [
  "components/timeline-event.tsx",
  "components/timeline-view.tsx",
  "components/buscar-filtros.tsx",
  "components/provenance-badge.tsx",
  // CR-01 de la review: la leyenda se mudó a un módulo compartido de `lib/` (el
  // source-scan SC7 prohíbe que `timeline-event.tsx` importe de `provenance-badge`).
  // Es donde vive HOY el copy renderizado → tiene que estar en el escaneo.
  "lib/recurso-no-humano.ts",
];

/**
 * Superficies FECHA (117-01, FECHA-02) — semántica de la fecha visible. La Phase 116
 * auditó cada fecha renderizada y encontró que el copy CONFUNDE dos hechos distintos:
 * la fecha del HECHO (cuándo se votó / se citó / se tramitó) y la fecha de nuestra
 * consulta a la fuente (`fecha_captura`).
 *
 * El riesgo específico de este carril NO es el vocabulario de bancada sino afirmar que
 * el DATO cambió cuando lo que cambió es NUESTRO scraping: decir "Actualizado hace 2
 * horas" sobre un proyecto sin movimiento desde 2023 insinúa actividad legislativa que
 * no ocurrió. La fecha de captura JAMÁS es el hecho; el idiom LOCKED de la fase es
 * "según fuente al {fecha}" (y "recalculado por el Observatorio al {fecha}" cuando el
 * reloj es un recálculo interno nuestro).
 *
 * TRIPWIRE ANTES DEL COPY (Wave-0 LOCKED, orden 68-01 / 100-01 / 101-02 / 103-03):
 * estas superficies se declaran ANTES de que aterrice una sola línea del copy nuevo de
 * la fase. El loader del bucle TOLERA archivos faltantes (try/catch continue).
 *
 * DEDUPE (Pitfall 4, precedente `SUPERFICIES_LINK_EXT`): varias de estas rutas ya viven
 * en otros carriles (`provenance-badge.tsx` en DEEPLINK/LINK-EXT, `panel-actualidad.tsx`
 * en PANEL, `search-result-card.tsx`, `timeline-event.tsx` en LINK-EXT…). Se listan
 * IGUALMENTE aquí porque este array debe ser el registro COMPLETO del alcance del carril
 * FECHA; la duplicación se disuelve en el `Set` de `TODAS_LAS_SUPERFICIES`.
 *
 * NOTA NEGACIONES_LOCKED: el copy nuevo de 117 NO niega ningún término prohibido — el
 * idiom "según fuente al…" y sus hermanos son afirmaciones factuales de procedencia y
 * fecha. Por eso NO se agregan entradas a `NEGACIONES_LOCKED` ni términos nuevos a
 * `TERMINOS_PROHIBIDOS` (117 no introduce vocabulario insinuante). Lo que sí se agrega
 * es el test `(1d)`, que VERIFICA (no asume) que los idioms elegidos están limpios.
 *
 * Rutas relativas a app/, mismo formato que los otros arrays.
 */
const SUPERFICIES_FECHA: string[] = [
  "components/provenance-badge.tsx",
  "components/cruces-de-parlamentario.tsx",
  "components/cruces-de-proyecto.tsx",
  "app/proyecto/[boletin]/page.tsx",
  "components/timeline-event.tsx",
  "components/capa1/tramitacion-stepper.tsx",
  "components/estado-actual-block.tsx",
  "components/votacion-card.tsx",
  "components/votos-por-parlamentario.tsx",
  "components/lobby-de-parlamentario.tsx",
  "components/lobby-menciones-de-boletin.tsx",
  "components/panel-actualidad.tsx",
  "components/actualidad-module.tsx",
  "components/search-result-card.tsx",
  "components/contratos-de-parlamentario.tsx",
  "components/financiamiento-de-parlamentario.tsx",
  "components/contratos-por-contraparte.tsx",
  "components/aportes-por-contraparte.tsx",
  "lib/format.ts",
  "lib/dia-calendario.ts",
];

/**
 * Leyenda de RECURSO NO-HUMANO (115-03, A-3/A-4/A-5). El Test (3) prueba que está
 * limpia; si alguien la edita hacia la insinuación ("la fuente no quiere publicarlo",
 * "lo esconde"), el detector la caza.
 *
 * WR-02: se IMPORTA la constante REAL de `@/lib/recurso-no-humano` — antes era una
 * COPIA literal, de modo que el test verificaba la copia y no el copy renderido: editar
 * la constante real hacia vocabulario insinuante dejaba este test verde. La copia era el
 * drift silencioso que el propio test decía prevenir.
 */
const LEYENDA_RECURSO_NO_HUMANO_FIXTURE = LEYENDA_RECURSO_NO_HUMANO;

/**
 * Vocabulario del carril LINK-EXT (115-03, LINK-03) — insinuación de INTENCIÓN DE LA
 * FUENTE. Que un enlace oficial lleve a un XML crudo, a una API o a un endpoint sin
 * parámetro es un HECHO de formato (y, en los casos A-1/A-2, un defecto NUESTRO), jamás
 * una voluntad del organismo de ocultar.
 *
 * Se extrae a su propia constante por WR-03 de la review: estos términos se agregaron a
 * la lista GLOBAL (que se aplica a ~50 archivos de TODOS los carriles) pero la
 * verificación declarada se había hecho por grep sobre 4 superficies. Términos genéricos
 * del español ("oculta", "esconde", "censura") son minas de falso positivo para copy
 * factual futuro de superficies ajenas ("la tabla oculta las columnas sin dato") y
 * bloquearían fases no relacionadas. Con la constante nombrada, el test
 * "(1b) WR-03" de abajo verifica —POR CÓDIGO y sobre el conjunto COMPLETO de superficies
 * de todos los carriles, no por grep manual sobre 4— que ninguno tiene hit hoy, y
 * nombra el archivo exacto si mañana lo tuviera.
 *
 * TILDES EXACTAS (buildTermRegex NO es accent-insensitive) y CERO tokens genéricos que
 * colisionen con identificadores (lección del `top` pelado rechazado en 100-01).
 * DEDUPE: "influencia"/"captura" ya están en el carril MONEY → NO se re-agregan.
 */
const TERMINOS_LINK_EXT: string[] = [
  "oculta",
  "ocultan",
  "esconde",
  "esconden",
  "no quiere",
  "se niega a",
  "bloquea a propósito",
  "censura",
];

/**
 * Términos COBERTURA (122-05, fila 5.12 de `122-CRUCES-SQL-03-LOBBY.md`) — Wave-0.
 *
 * POR QUÉ EXISTE: la fila 5.12 obliga a DECLARAR en la superficie que el canal
 * lobby↔proyecto-de-ley es parcial (195 de 5.106 audiencias confirmadas citan un
 * número de boletín ⇒ 3,8 %, observado 2026-07-29). Escribir una cifra de cobertura
 * parcial abre un vector de insinuación NUEVO que ningún carril previo cubría: el de
 * editorializar el HUECO. Decir "3,8 %" es un HECHO; decir que ese 3,8 % es "la punta
 * del iceberg", una "cifra negra", un "subregistro" o que las audiencias reales "en
 * realidad son" más, afirma un número que NO se observó y atribuye ocultamiento a la
 * fuente. Es exactamente el riesgo #1 del proyecto (una ausencia falsa con atribución
 * de fuente), aplicado a la declaración de cobertura.
 *
 * Estos términos se declaran ANTES de que el copy de 5.12 exista (patrón Wave-0
 * LOCKED, lección BLOCKER 91) y se escanean sobre TODAS las superficies vía el spread
 * en `TERMINOS_PROHIBIDOS`.
 *
 * DEDUPE (Pitfall 4): "oculta"/"esconde"/"censura" ya viven en `TERMINOS_LINK_EXT` y
 * "captura" en el carril MONEY → NO se re-agregan. Verificado por grep sobre
 * `app/{components,app,lib}` (sin tests): CERO ocurrencias de los 6 términos en el
 * árbol actual ⇒ no introducen falso positivo. TILDES EXACTAS (buildTermRegex NO es
 * accent-insensitive) y CERO tokens genéricos que colisionen con identificadores
 * (lección del `top` pelado rechazado en 100-01): los 6 son multi-palabra o
 * sustantivos que ningún identificador del repo usa.
 */
const TERMINOS_COBERTURA: string[] = [
  "punta del iceberg",
  "subregistro",
  "cifra negra",
  "zona oscura",
  "en realidad son",
  "muy por debajo",
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
  // --- Carril PANEL (100-01, PANEL-01) — timing/editorial insinuante + anti-ranking
  //     que el panel de actualidad (velocidad de tramitación, reingresos, citaciones,
  //     archivados) tienta. TILDES EXACTAS (Pitfall 3: buildTermRegex NO es
  //     accent-insensitive → "exprés"/"resucitó"/"último"/"afín" se buscan CON tilde).
  //     Timing: describir CUÁNDO/A-QUÉ-HORA pasó algo como si insinuara maniobra
  //     ("de madrugada"/"a última hora"/"último momento"). Editorial de reingreso:
  //     "revivido"/"reactivado"/"zombie"/"resucitó"/"colado" editorializan un
  //     reingreso factual. Anti-ranking: "la cámara más activa"/"top"/"los más"
  //     rankean cross-cámara un conteo NEUTRO (T-52-13 LOCKED, regla B de
  //     actualidad-module: NUNCA "top/los más/la cámara más activa").
  //     Verificado por grep (100-01): "los más"/"la cámara más activa"/"reactivado"
  //     NO estaban en la lista → se añaden. "índice"/"ranking"/"score"/"puntaje" ya
  //     cubren el ranking numérico arriba (NO se re-agregan).
  //     OJO (verificado en la corrida 100-01): el token bare "top" NO se añade — el
  //     límite de palabra lo cazaría sobre `const top = vigentes.slice(…)` de
  //     actualidad-module.tsx:407 (identificador de código, NO copy renderido) → falso
  //     positivo. El idiom de ranking se cubre con las frases multi-palabra "los más"
  //     y "la cámara más activa" (que NO colisionan con identificadores). Si el copy
  //     del panel usara literalmente la palabra "top" en un ranking, registrar la FRASE
  //     exacta (p.ej. "top de cámaras") en Plan 02, no el token bare.
  "último momento",
  "a última hora",
  "de madrugada",
  "exprés",
  "revivido",
  "reactivado",
  "zombie",
  "resucitó",
  "colado",
  "la cámara más activa",
  "los más",
  // --- Carril VSIM (102-01, VSIM-02/VSIM-03) — similitud de votación. Vocabulario de
  //     afinidad/coalición por CO-VOTACIÓN + la metáfora de "señal"/"tasa" que la sección
  //     de coincidencia de votos tienta. DEDUPE (Pitfall 4): NO se re-agregan
  //     "afín"/"afinidad"/"aliado"/"nivel de acuerdo"/"bloque de"/"vota como"/"votan como"
  //     — ya cubiertos arriba (carriles VOTO/PERSONAS). GENUINAMENTE NUEVOS: las variantes
  //     "votan juntos/igual/parecido" (paráfrasis de bancada por co-votación), los plurales
  //     "aliados"/"aliada" (el singular "aliado" ya está, pero el límite de palabra no
  //     cubre el plural/femenino), "tasa de coincidencia" (numeraliza la afinidad) y "señal"
  //     (la metáfora que el propio caveat NIEGA — restado vía LEYENDA_SIMILITUD_VOTO en
  //     NEGACIONES_LOCKED). TILDES/plurales exactos (buildTermRegex NO es accent-insensitive).
  "votan juntos",
  "votan igual",
  "votan parecido",
  "aliados",
  "aliada",
  "tasa de coincidencia",
  "señal",
  // --- Carril LINK-EXT (115-03, LINK-03) — insinuación de INTENCIÓN DE LA FUENTE.
  //     WR-03: la lista vive en `TERMINOS_LINK_EXT` (arriba, con su JSDoc) y su ausencia
  //     se verifica POR CÓDIGO sobre TODAS las superficies de todos los carriles —no por
  //     grep manual sobre 4— en el test "(1b) WR-03".
  ...TERMINOS_LINK_EXT,
  // --- Carril COBERTURA (122-05, fila 5.12) — editorialización del HUECO de una
  //     cobertura parcial declarada. La lista vive en `TERMINOS_COBERTURA` (arriba,
  //     con su JSDoc) y entra al scan de TODAS las superficies por este spread.
  ...TERMINOS_COBERTURA,
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
  // Leyenda SIMILITUD-VOTO (102-01, single-source en similitud-votacion-comparar.tsx).
  // CONTIENE "señal" y "afinidad" (términos prohibidos) para NEGARLOS ("La coincidencia
  // alta es la norma, no una señal… no indica afinidad, coordinación ni bancada…"). Sin
  // restarla, el scan de SUPERFICIES_VSIM se auto-cazaría sobre la propia superficie que
  // renderiza la leyenda (Pitfall 3, lección BLOCKER 91: registrar la negación ANTES de
  // añadir la superficie al scan). Importada verbatim.
  LEYENDA_SIMILITUD_VOTO,
  // FECHA-117-OFFENDER-01 (117-01, decisión A del orquestador). Al sumar
  // SUPERFICIES_FECHA entraron al scan `cruces-de-parlamentario.tsx` y
  // `cruces-de-proyecto.tsx`, cuyo bloque "Cómo leer esto" (copy PREEXISTENTE, idéntico
  // en ambos) usa la palabra "señal" —prohibida desde el carril VSIM (102-01)— en un
  // contexto que la DEFINE como un conteo de hechos, es decir que NIEGA precisamente la
  // lectura metafórica de "señal" que el término existe para bloquear ("la cifra es una
  // señal de bancada"). Mismo tratamiento que LEYENDA_SIMILITUD_VOTO / LEYENDA_CROSS_LINK:
  // se resta ANTES de matchear en vez de relajar el linter o reescribir copy ciudadano
  // ya publicado.
  //
  // Se registra como literal (precedente: la leyenda VOTO de la primera entrada) porque
  // el copy vive inline en el JSX de ambos componentes, no en una constante exportada.
  // Esa es justamente la propiedad AUTO-CORRECTIVA de la resta: si alguien edita la
  // frase —hacia la insinuación o hacia cualquier otra cosa— el literal deja de calzar
  // y el guard vuelve a morder sobre esas superficies, forzando una decisión explícita.
  // El detector normaliza whitespace antes de restar, así que el JSX line-wrapped de
  // ambos archivos calza con este string de espacios simples.
  "Cada señal es un conteo de hechos públicos fechados: reuniones de lobby registradas bajo la Ley 20.730, agrupadas por sector de la contraparte.",
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
/**
 * Union DEDUPEada de las superficies de TODOS los carriles. `Set` = una ruta repetida
 * entre carriles se escanea (y se reporta) UNA vez; el orden de inserción se conserva.
 * Extraída del bucle del Test (1) para que el Test (1b) —verificación por carril del
 * vocabulario nuevo, WR-03— escanee exactamente el mismo conjunto y no una copia que
 * derive.
 */
const TODAS_LAS_SUPERFICIES: string[] = [
  ...new Set([
    ...SUPERFICIES_VOTO,
    ...SUPERFICIES_MONEY,
    ...SUPERFICIES_HOME,
    ...SUPERFICIES_BUSQUEDA,
    ...SUPERFICIES_PERSONAS,
    ...SUPERFICIES_LOBBY,
    ...SUPERFICIES_AGENDA,
    ...SUPERFICIES_DEEPLINK,
    ...SUPERFICIES_PANEL,
    ...SUPERFICIES_RELACIONES,
    ...SUPERFICIES_VSIM,
    ...SUPERFICIES_NOTIF,
    ...SUPERFICIES_LINK_EXT,
    ...SUPERFICIES_FECHA,
  ]),
];

/**
 * Igual que `detectarInsinuaciones` pero restringido a un SUBCONJUNTO de términos.
 * Sirve para verificar el impacto de un carril concreto sobre el árbol completo (WR-03)
 * sin re-implementar el strip de comentarios ni la resta de negaciones LOCKED.
 */
function detectarTerminos(rawContent: string, terminos: string[]): string[] {
  let texto = stripTsComments(rawContent).replace(/\s+/g, " ");
  for (const neg of NEGACIONES_LOCKED) {
    texto = texto.split(neg.replace(/\s+/g, " ")).join(" ");
  }
  return terminos.filter((t) => buildTermRegex(t).test(texto));
}

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
    // `Set` = DEDUPE de rutas repetidas entre carriles (115-03: SUPERFICIES_LINK_EXT
    // re-lista buscar-filtros.tsx y provenance-badge.tsx, que ya viven en BUSQUEDA y
    // DEEPLINK). Sin él, un offender se reportaría dos veces y el archivo se leería
    // dos veces. El orden de escaneo se conserva (Set preserva orden de inserción).
    for (const rel of TODAS_LAS_SUPERFICIES) {
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

  it("(1b) WR-03: el vocabulario LINK-EXT no tiene hits en NINGUNA superficie de NINGÚN carril", () => {
    // El vocabulario nuevo del carril LINK-EXT se agregó a la lista GLOBAL (aplicada a
    // ~50 archivos de todos los carriles) pero su verificación declarada se había hecho
    // por grep manual sobre 4 superficies. "oculta"/"esconde"/"censura" son términos
    // genéricos del español: un copy factual futuro de una superficie ajena ("la tabla
    // oculta las columnas sin dato") los dispararía y bloquearía una fase no
    // relacionada. Este test hace la verificación POR CÓDIGO sobre el conjunto COMPLETO
    // y nombra archivo + término si algún día hubiera un hit.
    const offenders: string[] = [];
    for (const rel of TODAS_LAS_SUPERFICIES) {
      let raw: string;
      try {
        raw = readFileSync(path.join(APP_ROOT, rel), "utf-8");
      } catch {
        continue; // ausencia legítima (mismo criterio que el Test (1))
      }
      for (const term of detectarTerminos(raw, TERMINOS_LINK_EXT)) {
        offenders.push(`${rel} → "${term}"`);
      }
    }
    expect(
      offenders,
      `El vocabulario LINK-EXT caza copy de superficies AJENAS al carril: ` +
        `[${offenders.join("; ")}]. Si el copy es factual y correcto, el término es ` +
        `demasiado genérico para la lista GLOBAL: muévelo a un escaneo por carril en ` +
        `vez de relajar el copy.`,
    ).toHaveLength(0);
  });

  it("(1c) WR-03: el escaneo cubre TODAS las superficies declaradas (no un subconjunto)", () => {
    // Sanity de la extracción: el conjunto único incluye cada carril y es estrictamente
    // mayor que cualquiera de ellos. Si alguien añade un array de superficies y olvida
    // sumarlo a TODAS_LAS_SUPERFICIES, el guard escanearía de menos en silencio.
    for (const carril of [
      SUPERFICIES_VOTO, SUPERFICIES_MONEY, SUPERFICIES_HOME, SUPERFICIES_BUSQUEDA,
      SUPERFICIES_PERSONAS, SUPERFICIES_LOBBY, SUPERFICIES_AGENDA, SUPERFICIES_DEEPLINK,
      SUPERFICIES_PANEL, SUPERFICIES_RELACIONES, SUPERFICIES_VSIM, SUPERFICIES_NOTIF,
      SUPERFICIES_LINK_EXT, SUPERFICIES_FECHA,
    ]) {
      for (const rel of carril) expect(TODAS_LAS_SUPERFICIES).toContain(rel);
    }
    // Muy por encima de las 4 superficies contra las que se declaró el grep original.
    expect(TODAS_LAS_SUPERFICIES.length).toBeGreaterThan(20);
  });

  /**
   * (1d) FECHA-02 (117-01) — los idioms de fecha de la fase están limpios.
   *
   * POR QUÉ EXISTE: la palabra "captura" (pelada) está en `TERMINOS_PROHIBIDOS`
   * (carril MONEY). La Phase 117 reescribe TODO el copy de fecha del sitio, y el
   * término natural para nombrar lo que hacemos —"capturado el…"— es justamente el
   * prohibido. Este test es la PRUEBA de que el idiom elegido para 117 ("según fuente
   * al…", "recalculado por el Observatorio al…", "la fuente cubre hasta el…") no
   * re-introduce el término prohibido ni ningún otro, y se corre ANTES de que el copy
   * aterrice en las superficies (Wave-0 LOCKED).
   *
   * El fixture es EN MEMORIA (no un archivo del repo): son los strings VERBATIM que la
   * fase renderiza, y CADA UNO pasa por `detectarInsinuaciones` — el detector real, el
   * mismo que corre sobre los archivos en (1).
   *
   * ALCANCE HONESTO (WR-06 de `117-REVIEW.md` — corrige una afirmación falsa del JSDoc
   * anterior): este test NO tiene propiedad de detección sobre el repo. Es un FIXTURE
   * MANUAL: agregar copy nuevo a un componente no toca esta lista, así que el
   * `toHaveLength` NO "muerde" solo — es un ancla de MANTENCIÓN (obliga a tocar la
   * cuenta, y con ella a leer este comentario), no un guard automático. Quien cubre el
   * copy REALMENTE renderizado es el test (1), que escanea los archivos de
   * `SUPERFICIES_FECHA` con el mismo detector. Este (1d) aporta otra cosa: verifica los
   * idioms ANTES de que aterricen (Wave-0 LOCKED) y los deja escritos en un solo lugar
   * legible. La lista se completó con los 6 idioms que la fase introdujo y que nunca
   * habían pasado por el detector.
   */
  it("(1d) FECHA-02: los idioms de fecha de 117 están limpios", () => {
    const IDIOMS_FECHA_117: string[] = [
      "según fuente al 14 may 2026",
      "recalculado por el Observatorio al 28 jul 2026",
      "la fuente cubre hasta el 31 dic 2025",
      "nuestra ingesta llega hasta el 31 dic 2025",
      "Hito del 7 jul 2026",
      "Votada el 16 nov 2023",
      "Reunión del 12 jun 2026",
      "Consolidado por el Observatorio",
      "primer trámite 2021",
      "Última consulta a las fuentes",
      // WR-06: los 6 que la fase introdujo y faltaban en el fixture.
      "Citado el 20 jul 2026",
      "Urgencia Suma vigente desde el 10 mar 2026",
      "En tabla de sala de la Cámara del 15 jul 2026",
      "Consultado por nombre del candidato; la fuente cubre hasta el 31 dic 2025",
      "Año del primer trámite",
      "desde 12 jun 2026",
    ];
    expect(
      IDIOMS_FECHA_117,
      "La lista de idioms de fecha de 117 cambió de tamaño: registra el idiom nuevo " +
        "aquí (y actualiza la cuenta) para que el linter lo verifique ANTES de renderizarlo. " +
        "Ancla de MANTENCIÓN, no guard automático — la cobertura real del copy renderizado " +
        "la da el test (1) sobre SUPERFICIES_FECHA.",
    ).toHaveLength(16);

    const offenders: string[] = [];
    const verificados: string[] = [];
    for (const idiom of IDIOMS_FECHA_117) {
      // Se monta como copy renderizado (JSX) para pasar por el MISMO detector real.
      const fixture = `export const F = <span>${idiom}</span>;`;
      for (const term of detectarInsinuaciones(fixture)) {
        offenders.push(`"${idiom}" → "${term}"`);
      }
      verificados.push(idiom);
    }
    // WR-06: el valor del test está en que TODOS pasen por `detectarInsinuaciones`,
    // no en la cuenta de la lista. Este assert fija esa propiedad explícitamente.
    expect(
      verificados,
      "Algún idiom no llegó al detector (¿un `continue`/filtro colado en el bucle?).",
    ).toEqual(IDIOMS_FECHA_117);
    expect(
      offenders,
      `Un idiom de fecha de la Phase 117 contiene vocabulario prohibido: ` +
        `[${offenders.join("; ")}]. NO relajes el linter: cambia el idiom. ` +
        `Recordatorio: "captura" (pelada) está prohibida — el idiom LOCKED es ` +
        `"según fuente al {fecha}".`,
    ).toHaveLength(0);
  });

  /**
   * (1e) COBERTURA-122 (122-05, fila 5.12) — el idiom de cobertura parcial está limpio
   * ANTES de aterrizar en la superficie (Wave-0 LOCKED).
   *
   * Mismo contrato que (1d), con una DEPARTURE: el idiom se IMPORTA del componente
   * (`COBERTURA_MENCIONES_LOBBY`), no se re-tipea. Pasa por el detector REAL. No tiene
   * propiedad de detección sobre el repo (eso lo da el test (1) sobre
   * `SUPERFICIES_LOBBY`, donde el componente ya vive): aporta la verificación previa y
   * deja el idiom escrito en un solo lugar legible.
   *
   * Recordatorios que este test ancla: "captura" (pelada) está PROHIBIDA — el idiom
   * LOCKED es "según fuente al {fecha}"; y la cifra parcial viaja SIEMPRE con su fecha,
   * nunca sola, y nunca se presenta como total.
   */
  it("(1e) COBERTURA-122: el idiom de cobertura parcial de lobby↔PL está limpio", () => {
    // W-01 (code-review de 122): el literal se IMPORTA del componente, NO se re-tipea.
    // En el commit `45cdac4` esto era una copia en memoria porque el copy aún no
    // existía (Wave-0, ANTES del componente); en HEAD el copy ya existe y exporta la
    // constante, así que la copia era deuda pura — exactamente la regresión que este
    // mismo archivo documenta en `LEYENDA_RECURSO_NO_HUMANO_FIXTURE` (WR-02): "el test
    // verificaba la copia y no el copy renderizado; la copia era el drift silencioso
    // que el propio test decía prevenir". Demostrado: con la copia, inyectar "punta del
    // iceberg"/"subregistro" en la constante REAL dejaba este test en verde.
    const IDIOMS_COBERTURA_122: string[] = [
      COBERTURA_MENCIONES_LOBBY,
      "195 de 5.106 audiencias (3,8 %), según fuente al 29 jul 2026",
    ];

    const offenders: string[] = [];
    const verificados: string[] = [];
    for (const idiom of IDIOMS_COBERTURA_122) {
      const fixture = `export const F = <span>${idiom}</span>;`;
      for (const term of detectarInsinuaciones(fixture)) {
        offenders.push(`"${idiom}" → "${term}"`);
      }
      verificados.push(idiom);
    }
    expect(
      verificados,
      "Algún idiom de cobertura no llegó al detector (¿un `continue`/filtro colado?).",
    ).toEqual(IDIOMS_COBERTURA_122);
    expect(
      offenders,
      `El idiom de cobertura parcial contiene vocabulario prohibido: ` +
        `[${offenders.join("; ")}]. NO relajes el linter: cambia el idiom.`,
    ).toHaveLength(0);

    // La cifra NUNCA viaja sola: el literal LOCKED debe traer su fecha con el idiom
    // aprobado, y JAMÁS la palabra "captura" pelada.
    expect(COBERTURA_MENCIONES_LOBBY).toContain("según fuente al");
    expect(COBERTURA_MENCIONES_LOBBY).not.toMatch(/captura/i);
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

  it("PANEL (100): caza timing insinuante inyectado (exprés / de madrugada) sobre lo NUEVO", () => {
    // Términos de timing/editorial FRESCOS inyectados en un fixture EN MEMORIA que
    // simula el panel de actualidad. Prueba que el guard MUERDE sobre el carril PANEL —
    // un conteo de velocidad/reingreso es un HECHO NEUTRO, jamás "ley exprés" ni
    // "aprobada de madrugada" (que insinúan maniobra/intención). Cero contacto con disco.
    const fixtureMutado = `
      export function PanelActualidad() {
        return (
          <section aria-label="Actualidad del Congreso">
            <p>Proyecto reactivado: ley exprés aprobada de madrugada, la cámara más activa.</p>
          </section>
        );
      }
    `;
    const hits = detectarInsinuaciones(fixtureMutado);
    expect(
      hits,
      "El detector NO cazó timing/editorial insinuante inyectado → el guard PANEL sería un no-op",
    ).toEqual(
      expect.arrayContaining([
        "exprés",
        "de madrugada",
        "reactivado",
        "la cámara más activa",
      ]),
    );
  });

  it("RELACIONES (101-02): caza vocabulario de bancada/coalición inyectado (aliado / bloque de / coordina con) sobre lo NUEVO", () => {
    // Términos de afinidad/coalición FRESCOS inyectados en un fixture EN MEMORIA que
    // simula la sección de relaciones o una fila de /comparar. Prueba que el guard
    // MUERDE sobre el carril RELACIONES aunque la leyenda cross-link (que NIEGA
    // 'afinidad') esté restada en NEGACIONES_LOCKED — que dos parlamentarios
    // "comparten X" es un HECHO DECLARADO, jamás un juicio de bancada ni una
    // insinuación de coalición ("bloque de", "aliado", "coordina con"). Cero disco.
    const fixtureMutado = `
      export function RelacionesSection() {
        return (
          <section id="relaciones">
            <p>Este parlamentario es aliado del mismo bloque de derecha y coordina con la bancada.</p>
          </section>
        );
      }
    `;
    const hits = detectarInsinuaciones(fixtureMutado);
    expect(
      hits,
      "El detector NO cazó vocabulario de bancada/coalición inyectado → el guard RELACIONES sería un no-op",
    ).toEqual(
      expect.arrayContaining(["aliado", "bloque de", "coordina con"]),
    );
  });

  it("VSIM (102-01): caza vocabulario de afinidad por co-votación inyectado (votan igual / votan juntos / votan parecido / tasa de coincidencia / señal / aliados) sobre lo NUEVO", () => {
    // Idioms VSIM FRESCOS inyectados en un fixture EN MEMORIA que simula la sección de
    // similitud de votación. Prueba que el guard MUERDE sobre el carril VSIM aunque la
    // LEYENDA_SIMILITUD_VOTO (que NIEGA 'afinidad'/'señal') esté restada en
    // NEGACIONES_LOCKED — que dos parlamentarios COINCIDAN en votaciones es un CONTEO de
    // hechos, jamás un juicio de bancada ni una insinuación de coordinación. La cifra NO
    // es una "señal", la coincidencia NO es una "tasa de afinidad".
    const fixtureMutado = `
      export function SimilitudMala() {
        return (
          <section>
            <p>Estos parlamentarios votan igual, votan juntos y votan parecido; son aliados.</p>
            <p>Su tasa de coincidencia es una señal de bancada.</p>
          </section>
        );
      }
    `;
    const hits = detectarInsinuaciones(fixtureMutado);
    expect(
      hits,
      "El detector NO cazó vocabulario de afinidad por co-votación inyectado → el guard VSIM sería un no-op",
    ).toEqual(
      expect.arrayContaining([
        "votan igual",
        "votan juntos",
        "votan parecido",
        "aliados",
        "tasa de coincidencia",
        "señal",
      ]),
    );
  });

  it("VSIM (102-01): caza el femenino/plural `aliada` inyectado (el límite de palabra no lo cubre desde `aliado`)", () => {
    const fixtureMutado = `<p>Es aliada de la misma bancada.</p>`;
    expect(detectarInsinuaciones(fixtureMutado)).toContain("aliada");
  });

  it("NOTIF (103-03): caza vocabulario de afinidad/ranking inyectado en el frente de suscripciones (aliado / afín / ranking) sobre lo NUEVO", () => {
    // Idioms FRESCOS inyectados en un fixture EN MEMORIA que simula /cuenta, el botón
    // Seguir o una página de confirmar/baja. Prueba que el guard MUERDE sobre el carril
    // NOTIF — lo que el usuario SIGUE es una lista de objetos, jamás un juicio de
    // afinidad ni un ranking; el resumen es un HECHO PROGRAMADO, no una editorialización.
    const fixtureMutado = `
      export function CuentaMala() {
        return (
          <main>
            <p>Sigues a un parlamentario afín; es un aliado bien rankeado en tu ranking.</p>
          </main>
        );
      }
    `;
    const hits = detectarInsinuaciones(fixtureMutado);
    expect(
      hits,
      "El detector NO cazó vocabulario de afinidad/ranking inyectado → el guard NOTIF sería un no-op",
    ).toEqual(expect.arrayContaining(["afín", "aliado", "ranking"]));
  });

  it("LINK-EXT (115-03): caza insinuación de INTENCIÓN DE LA FUENTE inyectada (oculta / esconde / se niega a / censura) sobre lo NUEVO", () => {
    // Fixture EN MEMORIA que simula el copy de una superficie de SUPERFICIES_LINK_EXT
    // (el badge de procedencia o el link del timeline) declarando la limitación de un
    // recurso no-humano CON insinuación de voluntad. Que la fuente publique un servicio
    // de datos es un HECHO de formato; afirmar que "oculta" o "se niega a" publicar el
    // dato le atribuye INTENCIÓN, que es lo que el régimen prohíbe. Cero disco.
    const fixtureMutado = `
      export function BadgeMalo() {
        return (
          <span>
            <p>La fuente oculta este dato y se niega a publicarlo como página.</p>
            <p>El organismo lo esconde: censura la consulta ciudadana.</p>
          </span>
        );
      }
    `;
    const hits = detectarInsinuaciones(fixtureMutado);
    expect(
      hits,
      "El detector NO cazó insinuación de intención de la fuente inyectada → el guard LINK-EXT sería un no-op",
    ).toEqual(
      expect.arrayContaining(["oculta", "se niega a", "esconde", "censura"]),
    );
  });

  it("COBERTURA (122-05): caza editorialización del HUECO inyectada (punta del iceberg / cifra negra / subregistro / en realidad son) sobre lo NUEVO", () => {
    // Fixture EN MEMORIA que simula el copy de cobertura parcial de 5.12 escrito MAL:
    // declarar "3,8 %" es un HECHO, pero afirmar que es "la punta del iceberg" o que las
    // audiencias "en realidad son" más inventa un número NO observado y atribuye
    // ocultamiento a la fuente. Cero disco: el fixture no toca ningún archivo del repo.
    const fixtureMutado = `
      export function CoberturaMala() {
        return (
          <p>
            Solo el 3,8 % cita un boletín: es la punta del iceberg de un subregistro,
            una cifra negra en la zona oscura del registro. En realidad son muchas más,
            muy por debajo de lo que la fuente publica.
          </p>
        );
      }
    `;
    const hits = detectarInsinuaciones(fixtureMutado);
    expect(
      hits,
      "El detector NO cazó editorialización de cobertura inyectada → el guard COBERTURA sería un no-op",
    ).toEqual(
      expect.arrayContaining([
        "punta del iceberg",
        "subregistro",
        "cifra negra",
        "zona oscura",
        "en realidad son",
        "muy por debajo",
      ]),
    );
  });

  it("LINK-EXT (115-03): caza 'no quiere' / 'bloquea a propósito' inyectados (voluntad atribuida al organismo)", () => {
    const hits = detectarInsinuaciones(
      `<p>El servicio no quiere entregar la ficha y bloquea a propósito el acceso.</p>`,
    );
    expect(hits).toEqual(
      expect.arrayContaining(["no quiere", "bloquea a propósito"]),
    );
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

  it("VSIM (102-01): la leyenda de similitud de voto (que NIEGA 'señal'/'afinidad') NO es offender", () => {
    // Restada en NEGACIONES_LOCKED (Pitfall 3, lección BLOCKER 91): la leyenda CONTIENE
    // "señal" y "afinidad" (términos prohibidos) pero los NIEGA ("La coincidencia alta es
    // la norma, no una señal… no indica afinidad, coordinación ni bancada…") → montar
    // verbatim → []. Sin la resta, el linter daría falso-positivo y BLOQUEARÍA la fase.
    const conLeyenda = `
      const LEYENDA = ${JSON.stringify(LEYENDA_SIMILITUD_VOTO)};
      export const V = <p>{LEYENDA}</p>;
    `;
    expect(detectarInsinuaciones(conLeyenda)).toEqual([]);
  });

  it("LINK-EXT (115-03): la leyenda de recurso no-humano NO es offender y NO requiere NEGACIONES_LOCKED", () => {
    // Se VERIFICA (no se asume) que la leyenda de A-3/A-4/A-5 está limpia: describe el
    // FORMATO en que la fuente publica el dato, sin atribuir intención. Como no contiene
    // ningún término prohibido, no necesita restarse en NEGACIONES_LOCKED (mismo caso
    // que las leyendas de AGENDA y NOTIF). Este test es el que sostiene esa afirmación.
    const conLeyenda = `
      export const LEYENDA_RECURSO_NO_HUMANO = ${JSON.stringify(LEYENDA_RECURSO_NO_HUMANO_FIXTURE)};
      export const P = <p>{LEYENDA_RECURSO_NO_HUMANO}</p>;
    `;
    expect(detectarInsinuaciones(conLeyenda)).toEqual([]);
  });

  it("LINK-EXT (115-03): `Ocultar urgencias` (copy real del timeline) NO dispara `oculta` (límite de palabra)", () => {
    // El término nuevo "oculta" NO puede cazar el label factual de plegado del timeline
    // (`timeline-view.tsx`), ni el verbo "esconderse". Si lo hiciera, el guard sería un
    // falso-positivo que bloquearía la fase (lección BLOCKER 91).
    expect(detectarInsinuaciones(`<Link>Ocultar urgencias</Link>`)).toEqual([]);
    expect(detectarInsinuaciones(`<p>Ver fuente oficial ↗</p>`)).toEqual([]);
  });
});
