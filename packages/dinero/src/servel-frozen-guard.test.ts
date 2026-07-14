// servel-frozen-guard.test — GUARD que CONGELA las firmas LOCKED del corte de SERVEL de esta fase
// (Phase 71): `reconciliar-aporte.ts`, `model-servel.ts`, `parse-servel.ts` y la migración
// `0024_servel.sql` NO se debilitan por un refactor "de paso" (T-71-07).
//
// Espejo del molde de `reconciler-frozen-guard.test.ts` (Phase 70): detector PURO y testeable
// (`detectarDebilitamientosServel`) + un mutation self-check EN MEMORIA que prueba que el guard SÍ
// falla ante cada firma rota (no es un no-op verde). NO modifica ninguno de los archivos LOCKED —
// los PROTEGE. Sin red, sin DB.
//
// Las 4 firmas LOCKED (las invariantes existenciales de SERVEL):
//   (LOCKED-1) reconciliar-aporte.ts — el CRUCE es por NOMBRE (SERVEL no trae RUT): SOLO el
//              `res.tipo === "determinista"` mintea un `EnlaceConfirmado` + `estado_vinculo:
//              "confirmado"`; `probable`/`revision`/`no_confirmado` → `enlace: null` +
//              `no_confirmado`. El DONANTE JAMÁS va al pipeline. Si un refactor afloja la guarda
//              determinista o rutea el donante al LLM, este guard MUERDE.
//   (LOCKED-2) model-servel.ts — la fuente NO trae RUT del donante ni del candidato: `rutDonante`
//              es `string | null` (null HOY) y el `monto` es `string | null` VERBATIM (nunca number).
//              Si alguien añade un RUT obligatorio o convierte el monto a numeric, este guard MUERDE.
//   (LOCKED-3) parse-servel.ts — el gate de header vive en la FILA 4 (`HEADER_ROW = 4`) con los 11
//              `EXPECTED_HEADERS`; un header renombrado/reordenado LANZA (cuarentena). Si el gate
//              posicional se relaja, este guard MUERDE.
//   (LOCKED-4) 0024_servel.sql — el header + la tabla `aportes_ingesta_estado(ingestado_hasta)`
//              (sobre la que la señal freshness `servel` mide staleness) intactos.
//
// Además re-verifica el candado B (MONEY gate OFF): `moneyPublicEnabled` solo enciende con el literal
// "true" y `.env.example` trae `MONEY_PUBLIC_ENABLED=false`. Este plan NO toca `money-gate.ts`.

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// vitest de @obs/dinero corre desde packages/dinero. Los archivos LOCKED viven en packages/dinero/src
// y en supabase/migrations / .env.example (dos niveles arriba, en la raíz del monorepo).
const DINERO_SRC = __dirname; // packages/dinero/src
const REPO_ROOT = path.resolve(DINERO_SRC, "..", "..", ".."); // raíz del monorepo

const RECONCILIAR_APORTE = path.join(DINERO_SRC, "reconciliar-aporte.ts");
const MODEL_SERVEL = path.join(DINERO_SRC, "model-servel.ts");
const PARSE_SERVEL = path.join(DINERO_SRC, "parse-servel.ts");
const MIGRACION_0024 = path.join(REPO_ROOT, "supabase", "migrations", "0024_servel.sql");
const ENV_EXAMPLE = path.join(REPO_ROOT, ".env.example");
const MONEY_GATE = path.join(REPO_ROOT, "app", "lib", "money-gate.ts");

// ---------------------------------------------------------------------------
// Strip de comentarios (espejo de reconciler-frozen-guard.test.ts) — la PROSA de los JSDoc menciona
// "RUT"/"monto"/"determinista" para EXPLICAR el corte; no debe disparar falsos positivos.
// OJO (WR-05): NO tratar `//` como comentario cuando va precedido de `:` (URLs).
// ---------------------------------------------------------------------------
function stripTsComments(content: string): string {
  let stripped = content.replace(/\/\*[\s\S]*?\*\//g, "");
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
// Detector PURO — dado el CÓDIGO CRUDO de los 4 archivos LOCKED (o fixtures en memoria), devuelve la
// lista de firmas DEBILITADAS. Verde (lista vacía) = las 4 firmas siguen intactas.
// ---------------------------------------------------------------------------

export interface FuentesServelLocked {
  /** Contenido crudo de reconciliar-aporte.ts. */
  reconciliar: string;
  /** Contenido crudo de model-servel.ts. */
  model: string;
  /** Contenido crudo de parse-servel.ts. */
  parse: string;
  /** Contenido crudo de 0024_servel.sql. */
  migracion: string;
}

export function detectarDebilitamientosServel(fuentes: FuentesServelLocked): string[] {
  const offenders: string[] = [];

  // (LOCKED-1) reconciliar-aporte.ts — cruce por NOMBRE, SOLO determinista confirma.
  const rec = stripTsComments(fuentes.reconciliar);

  //  (1a) La rama `case "determinista":` sigue siendo la ÚNICA que setea `estadoVinculo = "confirmado"`.
  //       Si un refactor confirma en otra rama (probable/revision), sería una atribución falsa.
  const tieneRamaDeterminista = /case\s+["']determinista["']\s*:/.test(rec);
  const confirmaEstado = /estadoVinculo\s*=\s*["']confirmado["']/.test(rec);
  if (!tieneRamaDeterminista || !confirmaEstado) {
    offenders.push(
      'LOCKED-1a: reconciliar-aporte.ts perdió la rama `case "determinista":` que confirma ' +
        '(`estadoVinculo = "confirmado"`) — el cruce por NOMBRE solo confirma en determinista (IDENT-12).',
    );
  }

  //  (1b) `confirmar(...)` (mint del EnlaceConfirmado) DEBE seguir presente: sin él, ningún FK se puebla.
  if (!/\bconfirmar\s*\(/.test(rec)) {
    offenders.push(
      "LOCKED-1b: reconciliar-aporte.ts perdió `confirmar(...)` — sin el mint branded ningún FK del " +
        "candidato se puebla (el enlace de identidad se rompe).",
    );
  }

  //  (1c) SOLO el candidato viaja al pipeline: la mención se arma de `candidatoNombreVerbatim`, NUNCA
  //       del donante. Si `donanteNombre` apareciera como llave de la mención, sería un routing del
  //       donante al LLM (PII, T-15-09b). Heurística: `correrPipeline(` recibe una `mencion` armada
  //       del candidato; el guard exige que `candidatoNombreVerbatim` siga siendo la fuente del nombre
  //       y que NO exista `nombreOriginal: aporte.donanteNombre` / `donanteNombre` dentro de la MencionForanea.
  const usaCandidato = /candidatoNombreVerbatim/.test(rec);
  if (!usaCandidato) {
    offenders.push(
      "LOCKED-1c: reconciliar-aporte.ts ya no usa `candidatoNombreVerbatim` como llave del enlace — " +
        "el cruce por NOMBRE debe partir del CANDIDATO (funcionario público), nunca del donante.",
    );
  }
  //       El donante NUNCA arma la mención: prohibir `nombreOriginal: <algo>.donanteNombre` o
  //       `nombreOriginal: donanteNombre` (routing del donante al pipeline).
  if (/nombreOriginal\s*:\s*[A-Za-z0-9_.]*donanteNombre/.test(rec)) {
    offenders.push(
      "LOCKED-1c: reconciliar-aporte.ts arma la mención del pipeline con `donanteNombre` — el DONANTE " +
        "JAMÁS viaja al LLM (data-routing gate T-15-09b, PII deny-by-default).",
    );
  }

  // (LOCKED-2) model-servel.ts — sin RUT obligatorio; monto VERBATIM string.
  const model = stripTsComments(fuentes.model);

  //  (2a) El `monto` es `string | null` (interfaz Aporte). Nunca number.
  if (!/\bmonto\s*:\s*string\s*\|\s*null\b/.test(model)) {
    offenders.push(
      "LOCKED-2a: model-servel.ts — la firma `monto: string | null` (VERBATIM) ya no está: el monto " +
        "podría haber pasado a `number`/numeric, introduciendo cómputo sobre un valor crudo (viola VERBATIM).",
    );
  }
  //  (2b) NO aparece `monto: number` ni `monto: z.number()` (detección directa del debilitamiento).
  if (/\bmonto\s*:\s*number\b/.test(model)) {
    offenders.push("LOCKED-2b: model-servel.ts declara `monto: number` — el monto DEBE ser string VERBATIM.");
  }
  if (/\bmonto\s*:\s*z\.number\(\)/.test(model)) {
    offenders.push("LOCKED-2b: model-servel.ts valida `monto: z.number()` — el monto DEBE ser z.string() VERBATIM.");
  }
  //  (2c) El `rutDonante` sigue siendo NULLABLE (`string | null`): SERVEL no trae RUT. Si alguien lo
  //       hace obligatorio (`rutDonante: string` no-null), estaría fabricando un dato que la fuente no
  //       provee (o insinuando que el donante se identifica por RUT).
  const rutDonanteNullable = /\brutDonante\s*:\s*string\s*\|\s*null\b/.test(model);
  if (!rutDonanteNullable) {
    offenders.push(
      "LOCKED-2c: model-servel.ts — `rutDonante: string | null` (NULLABLE) ya no está: SERVEL NO trae " +
        "RUT del donante; hacerlo obligatorio fabricaría un dato inexistente.",
    );
  }

  // (LOCKED-3) parse-servel.ts — gate de header en la FILA 4, 11 headers esperados.
  const parse = stripTsComments(fuentes.parse);

  //  (3a) `HEADER_ROW = 4` sigue siendo el ancla posicional del gate de header.
  if (!/\bHEADER_ROW\s*=\s*4\b/.test(parse)) {
    offenders.push(
      "LOCKED-3a: parse-servel.ts perdió `HEADER_ROW = 4` — el gate de header vive en la fila 4; " +
        "moverlo/relajarlo abriría la puerta a mapear por índice posicional (0 filas silenciosas).",
    );
  }
  //  (3b) `EXPECTED_HEADERS` sigue definido (la lista de los 11 literales que gatea el drift).
  if (!/\bEXPECTED_HEADERS\b/.test(parse)) {
    offenders.push(
      "LOCKED-3b: parse-servel.ts perdió `EXPECTED_HEADERS` — sin la lista de headers esperados un " +
        "header renombrado/reordenado no dispararía el THROW de drift (cuarentena).",
    );
  }
  //  (3c) El THROW de drift estructural sigue presente (un header inválido LANZA, no degrada a 0 filas).
  if (!/drift estructural SERVEL/.test(parse)) {
    offenders.push(
      "LOCKED-3c: parse-servel.ts perdió el THROW `drift estructural SERVEL` — un header inválido debe " +
        "LANZAR (cuarentena aguas arriba), NUNCA mapear 0 filas en silencio.",
    );
  }

  // (LOCKED-4) 0024_servel.sql — header + tabla del marcador intactos.
  const mig = fuentes.migracion; // SQL: no strip (los `--` son comentarios SQL, pero las firmas viven en ellos).

  if (!/^--\s*0024_servel\.sql/m.test(mig)) {
    offenders.push(
      "LOCKED-4a: 0024_servel.sql perdió su header `-- 0024_servel.sql` — la migración LOCKED fue " +
        "alterada (es un checkpoint de operador; no se re-numera ni reescribe).",
    );
  }
  const tieneTabla = /create\s+table\s+aportes_ingesta_estado/i.test(mig);
  const tieneColumna = /\bingestado_hasta\b/.test(mig);
  if (!tieneTabla || !tieneColumna) {
    offenders.push(
      "LOCKED-4b: 0024_servel.sql perdió `create table aportes_ingesta_estado` / la columna " +
        "`ingestado_hasta` — la señal freshness `servel` (Plan 71-02) mide staleness sobre esa columna.",
    );
  }

  return offenders;
}

function leerFuentes(): FuentesServelLocked {
  return {
    reconciliar: readFileSync(RECONCILIAR_APORTE, "utf-8"),
    model: readFileSync(MODEL_SERVEL, "utf-8"),
    parse: readFileSync(PARSE_SERVEL, "utf-8"),
    migracion: readFileSync(MIGRACION_0024, "utf-8"),
  };
}

// ---------------------------------------------------------------------------
// (1) Guard estático — sobre los 4 archivos LOCKED reales del repo.
// ---------------------------------------------------------------------------

describe("(1) Guard estático — las firmas LOCKED de SERVEL están intactas", () => {
  it("sanity: los 4 archivos LOCKED existen y son legibles", () => {
    const f = leerFuentes();
    expect(f.reconciliar.length).toBeGreaterThan(100);
    expect(f.model.length).toBeGreaterThan(100);
    expect(f.parse.length).toBeGreaterThan(100);
    expect(f.migracion.length).toBeGreaterThan(100);
  });

  it("reconciliar-aporte / model-servel / parse-servel / 0024_servel: cero debilitamientos de las firmas LOCKED", () => {
    const offenders = detectarDebilitamientosServel(leerFuentes());
    expect(
      offenders,
      `Firmas LOCKED debilitadas: [${offenders.join("; ")}]. Esta fase (Phase 71) NO debe aflojar el ` +
        `cruce por NOMBRE, meter un RUT en SERVEL, relajar el gate de header fila-4, ni tocar la migración 0024.`,
    ).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// (2) Aserciones explícitas de cada firma protegida (legibilidad del corte).
// ---------------------------------------------------------------------------

describe("(2) Firmas LOCKED explícitas de SERVEL", () => {
  it("LOCKED-1: el cruce por NOMBRE solo confirma en determinista; el donante nunca va al pipeline", () => {
    const rec = stripTsComments(readFileSync(RECONCILIAR_APORTE, "utf-8"));
    expect(/case\s+["']determinista["']\s*:/.test(rec)).toBe(true);
    expect(/estadoVinculo\s*=\s*["']confirmado["']/.test(rec)).toBe(true);
    expect(/\bconfirmar\s*\(/.test(rec)).toBe(true);
    expect(/candidatoNombreVerbatim/.test(rec)).toBe(true);
    // El donante NUNCA arma la mención.
    expect(/nombreOriginal\s*:\s*[A-Za-z0-9_.]*donanteNombre/.test(rec)).toBe(false);
  });

  it("LOCKED-2: `monto` string VERBATIM + `rutDonante` NULLABLE (SERVEL no trae RUT)", () => {
    const model = stripTsComments(readFileSync(MODEL_SERVEL, "utf-8"));
    expect(/\bmonto\s*:\s*string\s*\|\s*null\b/.test(model)).toBe(true);
    expect(/\bmonto\s*:\s*number\b/.test(model)).toBe(false);
    expect(/\bmonto\s*:\s*z\.number\(\)/.test(model)).toBe(false);
    expect(/\brutDonante\s*:\s*string\s*\|\s*null\b/.test(model)).toBe(true);
  });

  it("LOCKED-3: el gate de header vive en la fila 4 con EXPECTED_HEADERS + THROW de drift", () => {
    const parse = stripTsComments(readFileSync(PARSE_SERVEL, "utf-8"));
    expect(/\bHEADER_ROW\s*=\s*4\b/.test(parse)).toBe(true);
    expect(/\bEXPECTED_HEADERS\b/.test(parse)).toBe(true);
    expect(/drift estructural SERVEL/.test(readFileSync(PARSE_SERVEL, "utf-8"))).toBe(true);
  });

  it("LOCKED-4: 0024_servel.sql conserva el header y la tabla aportes_ingesta_estado(ingestado_hasta)", () => {
    const mig = readFileSync(MIGRACION_0024, "utf-8");
    expect(/^--\s*0024_servel\.sql/m.test(mig)).toBe(true);
    expect(/create\s+table\s+aportes_ingesta_estado/i.test(mig)).toBe(true);
    expect(/\bingestado_hasta\b/.test(mig)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// (3) Mutation self-check — el detector SÍ MUERDE ante cada firma rota (fixtures EN MEMORIA).
// ---------------------------------------------------------------------------

describe("(3) Mutation self-check — el guard MUERDE ante cada debilitamiento", () => {
  function baseValida(): FuentesServelLocked {
    return {
      reconciliar: `
        const candidatoNombre = aporte.candidatoNombreVerbatim?.trim() ?? "";
        const mencion = { nombreOriginal: candidatoNombre, tokens };
        res = await correrPipeline(mencion, maestra, provider, writer);
        switch (res.tipo) {
          case "determinista":
            enlace = confirmar(res.parlamentarioId, "determinista");
            estadoVinculo = "confirmado";
            break;
          default:
            estadoVinculo = "no_confirmado";
        }
      `,
      model: `
        export interface Aporte { monto: string | null; }
        export interface Donante { rutDonante: string | null; }
      `,
      parse: `
        export const HEADER_ROW = 4;
        export const EXPECTED_HEADERS = ["A"];
        throw new Error("drift estructural SERVEL: header inválido");
      `,
      migracion: `-- 0024_servel.sql\ncreate table aportes_ingesta_estado (\n  ingestado_hasta date\n);`,
    };
  }

  it("base válida → 0 offenders (el guard no es un falso-positivo permanente)", () => {
    expect(detectarDebilitamientosServel(baseValida())).toEqual([]);
  });

  it("LOCKED-1a MUERDE: se borra la rama determinista que confirma", () => {
    const roto = baseValida();
    roto.reconciliar = roto.reconciliar
      .replace(/case "determinista":[\s\S]*?break;/, "")
      .replace(/estadoVinculo = "confirmado";/g, "");
    expect(detectarDebilitamientosServel(roto).some((o) => o.startsWith("LOCKED-1a"))).toBe(true);
  });

  it("LOCKED-1c MUERDE: la mención se arma del `donanteNombre` (routing del donante al LLM)", () => {
    const roto = baseValida();
    roto.reconciliar = roto.reconciliar.replace(
      "nombreOriginal: candidatoNombre",
      "nombreOriginal: aporte.donanteNombre",
    );
    expect(detectarDebilitamientosServel(roto).some((o) => o.startsWith("LOCKED-1c"))).toBe(true);
  });

  it("LOCKED-2a/2b MUERDE: `monto` pasa a number", () => {
    const roto = baseValida();
    roto.model = `
      export interface Aporte { monto: number; }
      export interface Donante { rutDonante: string | null; }
    `;
    expect(detectarDebilitamientosServel(roto).some((o) => o.startsWith("LOCKED-2"))).toBe(true);
  });

  it("LOCKED-2c MUERDE: `rutDonante` se hace obligatorio (SERVEL no trae RUT)", () => {
    const roto = baseValida();
    roto.model = `
      export interface Aporte { monto: string | null; }
      export interface Donante { rutDonante: string; }
    `;
    expect(detectarDebilitamientosServel(roto).some((o) => o.startsWith("LOCKED-2c"))).toBe(true);
  });

  it("LOCKED-3a MUERDE: HEADER_ROW deja de ser 4 (gate posicional relajado)", () => {
    const roto = baseValida();
    roto.parse = roto.parse.replace("HEADER_ROW = 4", "HEADER_ROW = 1");
    expect(detectarDebilitamientosServel(roto).some((o) => o.startsWith("LOCKED-3a"))).toBe(true);
  });

  it("LOCKED-3c MUERDE: se borra el THROW de drift estructural", () => {
    const roto = baseValida();
    roto.parse = roto.parse.replace(/throw new Error\("drift estructural SERVEL[^)]*\);/, "");
    expect(detectarDebilitamientosServel(roto).some((o) => o.startsWith("LOCKED-3c"))).toBe(true);
  });

  it("LOCKED-4a MUERDE: se altera el header de 0024", () => {
    const roto = baseValida();
    roto.migracion = `-- 0099_otra_cosa.sql\ncreate table aportes_ingesta_estado (ingestado_hasta date);`;
    expect(detectarDebilitamientosServel(roto).some((o) => o.startsWith("LOCKED-4a"))).toBe(true);
  });

  it("LOCKED-4b MUERDE: se borra la tabla/columna del marcador", () => {
    const roto = baseValida();
    roto.migracion = `-- 0024_servel.sql\ncreate table otra_cosa (id text);`;
    expect(detectarDebilitamientosServel(roto).some((o) => o.startsWith("LOCKED-4b"))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// (4) Sin falsos positivos — la PROSA de los JSDoc (que menciona monto/number/RUT/determinista para
//     EXPLICAR el corte) NO cuenta tras stripTsComments.
// ---------------------------------------------------------------------------

describe("(4) Sin falsos positivos — comentarios que EXPLICAN el corte no lo rompen", () => {
  it("un JSDoc que menciona `monto: number` / `donanteNombre` al LLM como CONTRAEJEMPLO no dispara", () => {
    const fuentes: FuentesServelLocked = {
      reconciliar: `
        // NUNCA armar la mención con donanteNombre (routing PII prohibido).
        /* El donante (donanteNombre) JAMÁS viaja a correrPipeline. */
        const candidatoNombre = aporte.candidatoNombreVerbatim ?? "";
        const mencion = { nombreOriginal: candidatoNombre };
        await correrPipeline(mencion, m, p, w);
        switch (res.tipo) { case "determinista": confirmar(x, "determinista"); estadoVinculo = "confirmado"; break; }
      `,
      model: `
        // NO usar \`monto: number\` — el monto es VERBATIM string.
        /* rutDonante es NULLABLE: SERVEL no trae RUT. */
        export interface Aporte { monto: string | null; }
        export interface Donante { rutDonante: string | null; }
      `,
      parse: `
        // El gate vive en HEADER_ROW = 4; un header inválido LANZA drift estructural SERVEL.
        export const HEADER_ROW = 4;
        export const EXPECTED_HEADERS = ["A"];
        throw new Error("drift estructural SERVEL: x");
      `,
      migracion: `-- 0024_servel.sql\ncreate table aportes_ingesta_estado (ingestado_hasta date);`,
    };
    expect(detectarDebilitamientosServel(fuentes)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// (5) Candado B MONEY OFF re-verificado — `moneyPublicEnabled` fail-closed + .env.example OFF.
//     Este plan NO toca money-gate.ts; se re-afirma la invariante por lectura del texto (el archivo
//     vive en app/ = otro proyecto vitest, no se importa el módulo server-only aquí).
// ---------------------------------------------------------------------------

describe("(5) MONEY gate OFF re-verificado (candado B, T-71-08)", () => {
  it("money-gate.ts enciende SOLO con el literal \"true\" (fail-closed, sin truthiness laxa)", () => {
    const gate = readFileSync(MONEY_GATE, "utf-8");
    // La comparación estricta contra el literal "true" sigue siendo el ÚNICO camino de encendido.
    expect(/MONEY_PUBLIC_ENABLED\s*===\s*["']true["']/.test(gate)).toBe(true);
    // NO usa Boolean(...) laxo ni != — solo el === estricto.
    expect(/Boolean\s*\(\s*[^)]*MONEY_PUBLIC_ENABLED/.test(gate)).toBe(false);
  });

  it(".env.example trae MONEY_PUBLIC_ENABLED=false (OFF por defecto; el flip es acto humano Phase 73)", () => {
    const env = readFileSync(ENV_EXAMPLE, "utf-8");
    expect(/^MONEY_PUBLIC_ENABLED\s*=\s*false\s*$/m.test(env)).toBe(true);
    // NUNCA =true en el ejemplo versionado.
    expect(/^MONEY_PUBLIC_ENABLED\s*=\s*true\s*$/m.test(env)).toBe(false);
  });
});
