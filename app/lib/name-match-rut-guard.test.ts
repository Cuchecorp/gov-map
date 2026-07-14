/**
 * NAME-MATCH-RUT-GUARD (RUT-01, CR-01) — Guard-guardián del corte estructural
 * "un name-match NUNCA escribe el `rut` de la maestra".
 *
 * Espejo EXACTO de `app/lib/lockdown-guard.test.ts` /
 * `app/lib/anti-insinuacion-guard.test.ts`: un guard-como-test de vitest que la
 * suite de `app/` recoge (`pnpm --filter ./app test`) y que corre en el gate GSD
 * verify-work, en el MISMO lugar que los otros guards. NO es un CLI aparte.
 *
 * Regla rector (CONTEXT §decisions, LOCKED; riesgo #1 = atribución financiera
 * falsa por difamación): un RUT derivado por NOMBRE prueba unicidad de nombre, NO
 * propiedad del RUT (name-uniqueness != RUT-ownership). El único caso donde la
 * igualdad RUT<->parlamentario está establecida es la CORROBORACIÓN: la maestra YA
 * tenía un `rut` que coincide. El corte YA es estructural en
 * `packages/dinero/src/reconciliar-contrato.ts:369-407`:
 *
 *   if (rutMaestra != null && rutMaestra === rutNorm)  → cosechas.push(...)   [CORROBORA → writer]
 *   else if (nombreGlobalUnico)                        → revisionesRut.push(...) + encolarRevisionRut(...) [COLA HUMANA]
 *   else (homónimo global)                             → enlace se mantiene, NO propone RUT
 *
 * El canal `cosechas` (CandidatoCosechaRut) es el ÚNICO input de
 * `runHarvestRut`/`runBackfillRut`/`updateRut`. El canal `revisionesRut`
 * (CandidatoRevisionRut) viaja SOLO por `enqueueRevision` (cola humana) y NUNCA
 * alimenta un writer de escritura de RUT. Este guard CONGELA ese corte contra
 * refactors futuros — MUERDE (Test 5) si alguien empuja un RUT name-only a
 * `cosechas` o pasa `revisionesRut` a un writer.
 *
 * DOS piezas críticas heredadas del molde:
 *
 * (1) `stripTsComments` — quita `/* *\/` y `// …` ANTES de aplicar los regex, con
 *     skip de `://` (WR-05: no truncar URLs en string literals → falsos negativos).
 *     REUSAR verbatim. Sin esto, la prosa de los JSDoc de `reconciliar-contrato.ts`
 *     (que menciona `revisionesRut` junto a `updateRut`/`runBackfillRut` para
 *     EXPLICAR el corte) dispararía falsos positivos.
 *
 * (2) `detectarViolacionesCorteRut` — detector PURO y testeable (espejo de
 *     `detectarInsinuaciones`) que el mutation self-check (Test 5) ejercita contra
 *     un fixture EN MEMORIA, probando que el guard SÍ falla ante el corte roto.
 *
 * DÓNDE VIVE EL COMPORTAMIENTO (deviation Rule 4, arquitectura frontend↔pipeline):
 * el frontend `app/` NO depende de `@obs/dinero`/`@obs/adjudication`/`@obs/core`
 * (CLAUDE.md: el frontend lee de Supabase; la ingesta vive en packages/Edge). Igual
 * que sus hermanos `lockdown-guard`/`anti-insinuacion-guard`, ESTE guard es
 * ESTÁTICO (fs, sin import cross-package) → corre en la suite de app sin acoplar el
 * frontend al pipeline. El test de COMPORTAMIENTO fail-closed (name-only → 0
 * cosechas, 1 revisión; corroboración → 1 cosecha) que EJERCITA `reconciliarContrato`
 * vive en `packages/dinero/src/name-match-rut-guard.behavior.test.ts`, donde el
 * paquete resuelve nativamente. Ambos archivos congelan el MISMO corte CR-01.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// ---------------------------------------------------------------------------
// Helpers de path (espejo de lockdown-guard.test.ts)
// ---------------------------------------------------------------------------

// vitest corre desde app/ (vitest.config.ts vive ahí). Las fuentes de dinero /
// identity viven en el monorepo, un nivel arriba.
const APP_ROOT = process.cwd(); // app/
const REPO_ROOT = path.resolve(APP_ROOT, ".."); // monorepo root

const DINERO_SRC = path.join(REPO_ROOT, "packages", "dinero", "src");
const IDENTITY_SRC = path.join(REPO_ROOT, "packages", "identity", "src");
const RECONCILIAR_CONTRATO = path.join(DINERO_SRC, "reconciliar-contrato.ts");

// ---------------------------------------------------------------------------
// Helpers de strip / walk (espejo VERBATIM de lockdown-guard.test.ts)
// ---------------------------------------------------------------------------

/**
 * Eliminar comentarios de TypeScript/JavaScript:
 *  - bloques `/** … *\/` y `/* … *\/`
 *  - líneas `// …`
 * Evita que la prosa de los JSDoc de `reconciliar-contrato.ts` (que menciona
 * `revisionesRut`/`updateRut`/`runBackfillRut` para EXPLICAR el corte) dispare los
 * detectores estáticos.
 *
 * OJO (WR-05, heredado del molde): NO tratar `//` como comentario cuando va
 * precedido de `:` — cortar en el `//` de una URL (`"https://x.cl"`) truncaría la
 * línea ANTES de un `.push(…)`/llamada posterior y crearía un FALSO NEGATIVO.
 * Heurística barata que cubre `http://`/`https://`.
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

const SKIP_DIRS = new Set([
  "node_modules",
  ".next",
  ".open-next",
  ".turbo",
  "dist",
  "coverage",
  ".vercel",
  ".wrangler",
]);

/** Camina .ts/.tsx no-test, saltando dirs de build/deps (espejo lockdown). */
function walkSourceFiles(dir: string): string[] {
  const out: string[] = [];
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) {
      if (SKIP_DIRS.has(entry)) continue;
      out.push(...walkSourceFiles(full));
    } else if (/\.(ts|tsx)$/.test(entry) && !/\.test\.(ts|tsx)$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Detector puro y testeable — la pieza que el mutation self-check ejercita.
// ---------------------------------------------------------------------------

/**
 * Los writers de escritura del `rut` de la maestra. Un name-derived RUT (canal
 * `revisionesRut`) que llegue a cualquiera de estos = atribución financiera falsa.
 */
const WRITERS_RUT = ["runBackfillRut", "runHarvestRut", "updateRut"];

/** El canal de cola humana (name-only): NUNCA debe alimentar un writer de RUT. */
const CANAL_REVISION = "revisionesRut";

/**
 * Detector PURO (espejo de `detectarInsinuaciones`): dado el CONTENIDO CRUDO de un
 * archivo (o un fixture en memoria), devuelve las violaciones del corte CR-01.
 * Aplica `stripTsComments` antes de analizar, así que la prosa de los JSDoc no
 * cuenta. Es la pieza que el mutation self-check (Test 5) ejercita.
 *
 * Detecta DOS clases de violación:
 *
 *  (A) `revisionesRut` pasado como ARGUMENTO a un writer de RUT
 *      (`runBackfillRut(revisionesRut, …)`, `runHarvestRut(revisionesRut, …)`,
 *      `updateRut(revisionesRut)`). El canal de cola humana JAMÁS alimenta el
 *      writer de escritura.
 *
 *  (B) un `cosechas.push({...})` que NO está dominado por la comparación de
 *      corroboración `rutMaestra === rutNorm` (heurística estructural: el
 *      `cosechas.push` debe estar precedido, en el mismo bloque abierto, por un
 *      `if (rutMaestra ... === ... rutNorm)` sin cierre de bloque intermedio). Un
 *      `cosechas.push` fuera de ese guardado = un RUT name-only escrito al writer.
 */
export function detectarViolacionesCorteRut(rawContent: string): string[] {
  const texto = stripTsComments(rawContent);
  const offenders: string[] = [];

  // (A) `revisionesRut` como CUALQUIER argumento de un writer de RUT. Para cada
  //     llamada `writer( … )`, extraemos la lista de argumentos completa (balance de
  //     paréntesis, tolerando args anidados como `construirFilas(x)`) y buscamos el
  //     token `revisionesRut` con límite de palabra. Cubre `updateRut(revisionesRut)`,
  //     `runBackfillRut(x, revisionesRut)`, `runHarvestRut(map(revisionesRut), w)`, etc.
  for (const w of WRITERS_RUT) {
    const callRe = new RegExp(`\\b${w}\\s*\\(`, "g");
    let call: RegExpExecArray | null;
    callRe.lastIndex = 0;
    while ((call = callRe.exec(texto)) !== null) {
      const args = extraerArgumentos(texto, call.index + call[0].length - 1);
      if (/(?<![A-Za-z0-9_])revisionesRut(?![A-Za-z0-9_])/.test(args)) {
        offenders.push(
          `${w}(… ${CANAL_REVISION} …): el canal \`revisionesRut\` es COLA HUMANA; ` +
            `NUNCA debe alimentar ${WRITERS_RUT.join("/")} — un name-match NO escribe el RUT de la maestra (CR-01, riesgo #1)`,
        );
      }
    }
  }

  // (B) cada `cosechas.push` debe estar dominado por `if (rutMaestra === rutNorm)`.
  //     Heurística: para cada índice de `cosechas.push`, buscar hacia atrás el
  //     `if (…rutMaestra…rutNorm…)` más cercano y confirmar que entre ese `if` y el
  //     `push` no hay un cierre de bloque `}` de nivel superior que lo saque del
  //     guardado. Aproximación robusta: contar el balance de llaves entre el `if`
  //     guardado y el `push`; si el balance nunca baja de 1 (el bloque del if sigue
  //     abierto), el push está dentro.
  const pushRe = /\bcosechas\.push\s*\(/g;
  let m: RegExpExecArray | null;
  pushRe.lastIndex = 0;
  while ((m = pushRe.exec(texto)) !== null) {
    const pushIdx = m.index;
    if (!pushDominadoPorCorroboracion(texto, pushIdx)) {
      const linea = texto.slice(0, pushIdx).split("\n").length;
      offenders.push(
        `cosechas.push (línea ~${linea}) NO está dentro del bloque guardado por ` +
          `\`if (rutMaestra === rutNorm)\` (corroboración): un RUT name-only estaría ` +
          `entrando al canal de escritura (cosechas → runBackfillRut) — CR-01, riesgo #1`,
      );
    }
  }

  return offenders;
}

/**
 * Extrae la sub-cadena de la lista de argumentos de una llamada, dado el índice del
 * `(` de apertura. Devuelve el texto entre `(` y su `)` de cierre balanceado (sin los
 * paréntesis). Tolera args anidados (`construirFilas(x)`) contando el balance.
 */
function extraerArgumentos(texto: string, abreIdx: number): string {
  let balance = 0;
  for (let i = abreIdx; i < texto.length; i++) {
    const ch = texto[i];
    if (ch === "(") balance++;
    else if (ch === ")") {
      balance--;
      if (balance === 0) return texto.slice(abreIdx + 1, i);
    }
  }
  return texto.slice(abreIdx + 1); // sin cierre (código truncado): devolver el resto
}

/**
 * ¿El `cosechas.push` en `pushIdx` está sintácticamente dentro del bloque abierto
 * por un `if (…rutMaestra…rutNorm…)` que lo precede? Busca el `if` de corroboración
 * más cercano ANTES del push y verifica que el balance de llaves desde el `{` de ese
 * `if` hasta el push nunca cierra el bloque (balance ≥ 1 en todo el tramo).
 */
function pushDominadoPorCorroboracion(texto: string, pushIdx: number): boolean {
  // El `if (rutMaestra ... rutNorm ...)` de corroboración, antes del push.
  const guardRe = /if\s*\([^)]*\brutMaestra\b[^)]*\brutNorm\b[^)]*\)\s*\{/g;
  let guard: RegExpExecArray | null;
  let ultimoBraceGuardado = -1;
  guardRe.lastIndex = 0;
  while ((guard = guardRe.exec(texto)) !== null) {
    if (guard.index >= pushIdx) break;
    // Posición del `{` que abre el bloque del if guardado.
    ultimoBraceGuardado = guard.index + guard[0].length - 1;
  }
  if (ultimoBraceGuardado < 0) return false; // no hay if de corroboración antes → violación

  // Balance de llaves desde el `{` del if guardado (inclusivo) hasta el push.
  // El `{` inicial pone el balance en 1; el bloque sigue abierto mientras balance ≥ 1.
  let balance = 0;
  for (let i = ultimoBraceGuardado; i < pushIdx; i++) {
    const ch = texto[i];
    if (ch === "{") balance++;
    else if (ch === "}") {
      balance--;
      // Si el balance baja a 0 antes del push, el bloque del if guardado se cerró:
      // el push quedó FUERA de la corroboración.
      if (balance === 0) return false;
    }
  }
  return balance >= 1;
}

// El test de COMPORTAMIENTO fail-closed (name-only → 0 cosechas, 1 revisión;
// corroboración → 1 cosecha) vive en packages/dinero, donde `reconciliarContrato`
// resuelve. Este guard estático confirma su EXISTENCIA (link_key) para que el corte
// nunca quede solo-estático sin cobertura de comportamiento.
const BEHAVIOR_TEST = path.join(
  DINERO_SRC,
  "name-match-rut-guard.behavior.test.ts",
);

// ---------------------------------------------------------------------------
// (1) Guard estático — corroboración es el ÚNICO input del writer
// ---------------------------------------------------------------------------

describe("(1) Guard estático — cosechas guardado por corroboración; revisionesRut nunca al writer", () => {
  it("sanity: reconciliar-contrato.ts existe y es legible", () => {
    expect(readFileSync(RECONCILIAR_CONTRATO, "utf-8").length).toBeGreaterThan(100);
  });

  it("en reconciliar-contrato.ts: cero violaciones del corte (post-strip de comentarios)", () => {
    const raw = readFileSync(RECONCILIAR_CONTRATO, "utf-8");
    const offenders = detectarViolacionesCorteRut(raw);
    expect(
      offenders,
      `Violaciones del corte name-match≠write-rut en reconciliar-contrato.ts: ` +
        `[${offenders.join("; ")}]. El canal \`revisionesRut\` (cola humana) JAMÁS ` +
        `alimenta ${WRITERS_RUT.join("/")}; todo \`cosechas.push\` debe estar dentro ` +
        `del bloque \`if (rutMaestra === rutNorm)\` (corroboración).`,
    ).toHaveLength(0);
  });

  it("en TODO el árbol de packages/dinero/src + packages/identity/src: revisionesRut nunca se pasa a un writer de RUT", () => {
    const offenders: string[] = [];
    for (const dir of [DINERO_SRC, IDENTITY_SRC]) {
      for (const file of walkSourceFiles(dir)) {
        const raw = readFileSync(file, "utf-8");
        for (const off of detectarViolacionesCorteRut(raw)) {
          const rel = path.relative(REPO_ROOT, file).split(path.sep).join("/");
          offenders.push(`${rel}: ${off}`);
        }
      }
    }
    expect(
      offenders,
      `Violaciones del corte CR-01 en el árbol dinero/identity: [${offenders.join("; ")}]`,
    ).toHaveLength(0);
  });

  it("sanity: el walker encontró las fuentes de dinero e identity", () => {
    expect(walkSourceFiles(DINERO_SRC).length).toBeGreaterThan(5);
    expect(walkSourceFiles(IDENTITY_SRC).length).toBeGreaterThan(3);
  });
});

// ---------------------------------------------------------------------------
// (2) Guard estático — el canal humano co-ocurre con enqueueRevision, no con writers
// ---------------------------------------------------------------------------

describe("(2) Guard estático — revisionesRut.push co-ocurre con enqueueRevision/encolarRevisionRut", () => {
  it("cada `revisionesRut.push` en reconciliar-contrato.ts va acompañado de encolarRevisionRut/enqueueRevision, no de un writer", () => {
    const texto = stripTsComments(readFileSync(RECONCILIAR_CONTRATO, "utf-8"));
    // Hay al menos un revisionesRut.push (el canal existe).
    expect(/\brevisionesRut\.push\s*\(/.test(texto)).toBe(true);
    // El canal humano se enfuerza via encolarRevisionRut/enqueueRevision en el archivo…
    expect(/\b(encolarRevisionRut|enqueueRevision)\b/.test(texto)).toBe(true);
    // …y NUNCA aparece un writer de RUT recibiendo revisionesRut (ya cubierto por el detector,
    // aquí lo afirmamos explícitamente sobre el mismo archivo).
    for (const w of WRITERS_RUT) {
      const re = new RegExp(`\\b${w}\\s*\\([^)]*\\brevisionesRut\\b`);
      expect(
        re.test(texto),
        `${w} recibe revisionesRut en reconciliar-contrato.ts (viola CR-01)`,
      ).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// (3+4) Cobertura de comportamiento — el companion en packages/dinero existe y
//       ejercita reconciliarContrato (0 cosechas / 1 revisión; corroboración → 1).
// ---------------------------------------------------------------------------

describe("(3+4) Comportamiento — el companion fail-closed existe y aserta el corte", () => {
  it("packages/dinero/src/name-match-rut-guard.behavior.test.ts existe (el corte no queda solo-estático)", () => {
    // El frontend no puede importar @obs/dinero (decoupling); el test que EJERCITA
    // reconciliarContrato vive donde el paquete resuelve. Aquí exigimos su presencia.
    expect(() => readFileSync(BEHAVIOR_TEST, "utf-8")).not.toThrow();
  });

  it("el companion aserta fail-closed (0 cosechas, 1 revisión) y corroboración (1 cosecha) sobre reconciliarContrato", () => {
    const behavior = readFileSync(BEHAVIOR_TEST, "utf-8");
    // Debe importar y ejercitar el pipeline real (no un fixture estático).
    expect(behavior).toContain("reconciliarContrato");
    // Debe aserar el fail-closed (0 cosechas) y la cola humana (1 revisión).
    expect(/cosechas\.length\)\.toBe\(0\)/.test(behavior)).toBe(true);
    expect(/revisionesRut\.length\)\.toBe\(1\)/.test(behavior)).toBe(true);
    // Debe aserar la corroboración (la única vía al writer): 1 cosecha.
    expect(/cosechas\.length\)\.toBe\(1\)/.test(behavior)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// (5) Mutation self-check — el guard MUERDE (no es un no-op verde)
// ---------------------------------------------------------------------------

describe("(5) Mutation self-check — el detector SÍ falla ante el corte roto (fixture en memoria)", () => {
  it("reporta offender: un `cosechas.push` FUERA del bloque `if (rutMaestra === rutNorm)`", () => {
    // Fixture EN MEMORIA que simula un refactor roto: empuja un RUT name-only a
    // cosechas SIN la guarda de corroboración.
    const fixtureRoto = `
      export async function reconciliarRoto() {
        const rutNorm = normRut(c.rutProveedor);
        if (nombreGlobalUnico) {
          cosechas.push({ parlamentarioId: pres.parlamentarioId, rutHarvested: rutNorm });
        }
      }
    `;
    const offenders = detectarViolacionesCorteRut(fixtureRoto);
    expect(
      offenders.length,
      "El detector NO cazó un cosechas.push fuera de la corroboración → el guard sería un no-op",
    ).toBeGreaterThan(0);
    expect(offenders.join(" ")).toContain("cosechas.push");
  });

  it("reporta offender: `runBackfillRut(revisionesRut, …)` (canal humano alimentando el writer)", () => {
    const fixtureRoto = `
      export async function reconciliarRoto() {
        await runBackfillRut(revisionesRut, writer);
      }
    `;
    const offenders = detectarViolacionesCorteRut(fixtureRoto);
    expect(offenders.length).toBeGreaterThan(0);
    expect(offenders.join(" ")).toContain("runBackfillRut");
  });

  it("reporta offender: `updateRut(revisionesRut)` y `runHarvestRut(revisionesRut, w)`", () => {
    expect(
      detectarViolacionesCorteRut(`updateRut(revisionesRut);`).length,
    ).toBeGreaterThan(0);
    expect(
      detectarViolacionesCorteRut(`await runHarvestRut(revisionesRut, w);`).length,
    ).toBeGreaterThan(0);
  });

  it("reporta offender: `runBackfillRut(otraCosa, revisionesRut)` (revisionesRut como 2.º argumento)", () => {
    const offenders = detectarViolacionesCorteRut(
      `runBackfillRut(construirFilas(x), revisionesRut);`,
    );
    expect(offenders.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// (6) Sin falsos positivos — comentarios, corroboración correcta, URLs
// ---------------------------------------------------------------------------

describe("(6) Sin falsos positivos — strip de comentarios, corroboración legítima, URLs", () => {
  it("un comentario/JSDoc que menciona revisionesRut junto a updateRut NO cuenta (stripTsComments lo remueve)", () => {
    const conComentarios = `
      // El canal revisionesRut JAMÁS debe alimentar updateRut/runBackfillRut.
      /* revisionesRut → enqueueRevision (cola humana); nunca updateRut(revisionesRut). */
      export function ok() {
        cosechas.push({ x: 1 }); // fuera de un if, pero en comentario-adyacente
      }
    `;
    // El cosechas.push del fixture NO está guardado, así que SÍ sería offender por (B).
    // Lo que se prueba aquí es que las MENCIONES en comentarios de la variante (A)
    // (revisionesRut → updateRut) NO disparan. Aislamos (A) con un fixture solo-comentario:
    const soloComentarios = `
      // updateRut(revisionesRut) sería una violación — este comentario la DOCUMENTA, no la comete.
      /* runBackfillRut(revisionesRut, writer) está PROHIBIDO. */
      export const X = 1;
    `;
    expect(detectarViolacionesCorteRut(soloComentarios)).toEqual([]);
    // (y el fixture con comentarios + push guardado no dispara (A))
    void conComentarios;
  });

  it("un `cosechas.push` DENTRO del bloque `if (rutMaestra === rutNorm)` NO es offender", () => {
    const fixtureBueno = `
      export function ok() {
        const rutNorm = normRut(c.rutProveedor);
        if (rutMaestra != null && rutMaestra === rutNorm) {
          if (provenanceCompleta(c)) {
            cosechas.push({ parlamentarioId: pres.parlamentarioId, rutHarvested: rutNorm });
          }
        }
      }
    `;
    expect(detectarViolacionesCorteRut(fixtureBueno)).toEqual([]);
  });

  it("`enqueueRevision(caso)` / `encolarRevisionRut(writer, m, candidato)` NO son offenders (canal humano legítimo)", () => {
    const fixtureBueno = `
      revisionesRut.push(candidato);
      await encolarRevisionRut(writer, mencion, candidato);
      await writer.enqueueRevision(caso);
    `;
    expect(detectarViolacionesCorteRut(fixtureBueno)).toEqual([]);
  });

  it("edge: `://` en una URL de string literal no rompe el strip (heredado del molde)", () => {
    const conUrl = `const src = "https://api.mercadopublico.cl"; // fuente oficial`;
    expect(stripTsComments(conUrl)).toContain("https://api.mercadopublico.cl");
    expect(detectarViolacionesCorteRut(conUrl)).toEqual([]);
  });
});
