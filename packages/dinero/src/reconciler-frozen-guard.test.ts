// reconciler-frozen-guard.test — GUARD que CONGELA las firmas LOCKED del corte de
// dinero de esta fase (Phase 70): `reconciliar-contrato.ts`, `model.ts` y la migración
// `0023_dinero.sql` NO se debilitan por un refactor "de paso".
//
// COMPLEMENTO a nivel de ARCHIVO-INTACTO del corte CR-01 congelado en Phase 69
// (`name-match-rut-guard.*`). Aquel guard congela el FLUJO DE DATOS (name-match ≠
// write-rut); ESTE guard congela las FIRMAS ESTRUCTURALES que hacen ese flujo posible:
//
//   (LOCKED-1) reconciliar-contrato.ts — la rama JURÍDICA es RUT-EXACTO-ONLY: una
//              persona jurídica NUNCA se name-linkea a un parlamentario. La resolución
//              de entidad jurídica va por `matchDeterministaEntidad` (solo RUT), y la
//              guarda `if (c.tipoPersona !== "natural" ...)` RETORNA antes de tocar
//              `correrPipeline` (el LLM). Si un refactor rutea una jurídica al pipeline
//              por nombre, este guard MUERDE.
//   (LOCKED-2) model.ts — el `monto` es `string | null` VERBATIM (nunca `number`/
//              `numeric`): el listado de ChileCompra NO trae un monto fijo garantizado
//              (CR-02) y el contenido literal se preserva sin cómputo. Si alguien cambia
//              `monto` a numeric, este guard MUERDE.
//   (LOCKED-3) 0023_dinero.sql — el header de la migración está intacto (la migración es
//              un CHECKPOINT DE OPERADOR ya aplicado; no se re-numera ni se altera).
//
// Espejo del molde de guard-como-test de Phase 69: detector PURO y testeable
// (`detectarDebilitamientos`) + un mutation self-check EN MEMORIA que prueba que el guard
// SÍ falla ante cada firma rota (no es un no-op verde). NO modifica ninguno de los tres
// archivos LOCKED — los PROTEGE. Sin red, sin DB.

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// vitest de @obs/dinero corre desde packages/dinero (vitest.config.ts vive ahí).
// Los tres archivos LOCKED viven en packages/dinero/src y en supabase/migrations
// (dos niveles arriba, en la raíz del monorepo).
const DINERO_SRC = __dirname; // packages/dinero/src
const REPO_ROOT = path.resolve(DINERO_SRC, "..", "..", ".."); // raíz del monorepo

const RECONCILIAR_CONTRATO = path.join(DINERO_SRC, "reconciliar-contrato.ts");
const MODEL = path.join(DINERO_SRC, "model.ts");
const MIGRACION_0023 = path.join(
  REPO_ROOT,
  "supabase",
  "migrations",
  "0023_dinero.sql",
);

// ---------------------------------------------------------------------------
// Strip de comentarios (espejo de name-match-rut-guard.test.ts) — evita que la
// PROSA de los JSDoc (que menciona "correrPipeline"/"monto"/"numeric" para EXPLICAR
// el corte) dispare falsos positivos en las aserciones estructurales.
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
// Detector PURO — la pieza que el mutation self-check ejercita. Dado el CÓDIGO CRUDO
// de los tres archivos (o fixtures en memoria), devuelve la lista de firmas LOCKED que
// están DEBILITADAS. Verde (lista vacía) = las tres firmas siguen intactas.
// ---------------------------------------------------------------------------

export interface FuentesLocked {
  /** Contenido crudo de reconciliar-contrato.ts. */
  reconciliar: string;
  /** Contenido crudo de model.ts. */
  model: string;
  /** Contenido crudo de 0023_dinero.sql. */
  migracion: string;
}

export function detectarDebilitamientos(fuentes: FuentesLocked): string[] {
  const offenders: string[] = [];

  // (LOCKED-1) reconciliar-contrato.ts — la rama JURÍDICA es RUT-only.
  const rec = stripTsComments(fuentes.reconciliar);

  //  (1a) La guarda que RETORNA antes del pipeline para no-natural DEBE existir: sin ella,
  //       una jurídica caería al fallback `correrPipeline` (name-link). El corte es que la
  //       condición `c.tipoPersona !== "natural"` gatea la salida temprana.
  const tieneGuardaJuridica =
    /c\.tipoPersona\s*!==\s*["']natural["']/.test(rec);
  if (!tieneGuardaJuridica) {
    offenders.push(
      "LOCKED-1a: reconciliar-contrato.ts perdió la guarda `c.tipoPersona !== \"natural\"` que " +
        "retorna ANTES de correrPipeline — una persona JURÍDICA podría name-linkearse a un " +
        "parlamentario (viola el corte RUT-only de jurídica).",
    );
  }

  //  (1b) La resolución de entidad jurídica DEBE ir por el matcher determinista de entidad
  //       (solo RUT para jurídica), no por el pipeline LLM: `resolverEntidadProveedor` +
  //       `matchDeterministaEntidad` deben seguir presentes.
  const tieneResolverEntidad = /\bresolverEntidadProveedor\b/.test(rec);
  const tieneMatchEntidad = /\bmatchDeterministaEntidad\b/.test(rec);
  if (!tieneResolverEntidad || !tieneMatchEntidad) {
    offenders.push(
      "LOCKED-1b: reconciliar-contrato.ts perdió `resolverEntidadProveedor`/`matchDeterministaEntidad` " +
        "(la resolución de entidad jurídica por RUT exacto) — la jurídica dejaría de resolverse " +
        "deterministamente por RUT.",
    );
  }

  //  (1c) La invariante fuerte: NO existe una llamada a `correrPipeline` DENTRO del bloque de
  //       la guarda jurídica. Estructuralmente: entre la guarda `if (c.tipoPersona !== "natural"
  //       ...)` y su `continue`/cierre NO debe aparecer `correrPipeline`. Heurística: la ÚNICA
  //       llamada a correrPipeline debe estar DESPUÉS de esa guarda (en el fallback natural).
  //       Si `correrPipeline` apareciera antes de la guarda jurídica, sería un name-link de
  //       jurídica. Aproximación robusta: la posición del primer `correrPipeline(` debe ser
  //       POSTERIOR a la posición de la guarda jurídica.
  const idxGuardaJuridica = rec.search(
    /c\.tipoPersona\s*!==\s*["']natural["']/,
  );
  const idxPipeline = rec.search(/\bcorrerPipeline\s*\(/);
  if (
    idxPipeline >= 0 &&
    idxGuardaJuridica >= 0 &&
    idxPipeline < idxGuardaJuridica
  ) {
    offenders.push(
      "LOCKED-1c: reconciliar-contrato.ts llama `correrPipeline` ANTES de la guarda jurídica " +
        "`c.tipoPersona !== \"natural\"` — una persona jurídica llegaría al pipeline LLM por nombre " +
        "(viola RUT-only de jurídica, riesgo de atribución falsa).",
    );
  }

  // (LOCKED-2) model.ts — `monto` es string VERBATIM, nunca numeric/number.
  const model = stripTsComments(fuentes.model);

  //  (2a) La interfaz Contrato mantiene `monto: string | null` (no `number`).
  const montoInterfaceString = /\bmonto\s*:\s*string\s*\|\s*null\b/.test(model);
  if (!montoInterfaceString) {
    offenders.push(
      "LOCKED-2a: model.ts — la firma `monto: string | null` (VERBATIM, CR-02) ya no está: el monto " +
        "podría haber pasado a `number`/numeric, introduciendo cómputo sobre un valor que la fuente " +
        "no garantiza (se etiquetaría un no-monto como monto).",
    );
  }

  //  (2b) El schema Zod de `monto` sigue siendo `z.string().nullable()` (no z.number()).
  const montoZodString = /\bmonto\s*:\s*z\.string\(\)\.nullable\(\)/.test(model);
  if (!montoZodString) {
    offenders.push(
      "LOCKED-2b: model.ts — el schema Zod `monto: z.string().nullable()` ya no está: si el monto se " +
        "validara como `z.number()`, la compuerta aceptaría/coaccionaría numérico (viola VERBATIM, CR-02).",
    );
  }

  //  (2c) NO aparece `monto` tipado como number ni validado como z.number() (detección directa
  //       del debilitamiento, por si la firma esperada se reescribe de otra forma).
  if (/\bmonto\s*:\s*number\b/.test(model)) {
    offenders.push(
      "LOCKED-2c: model.ts declara `monto: number` — el monto DEBE ser string VERBATIM (CR-02).",
    );
  }
  if (/\bmonto\s*:\s*z\.number\(\)/.test(model)) {
    offenders.push(
      "LOCKED-2c: model.ts valida `monto: z.number()` — el monto DEBE ser z.string() VERBATIM (CR-02).",
    );
  }

  // (LOCKED-3) 0023_dinero.sql — header + tabla intactos.
  const mig = fuentes.migracion; // SQL: no aplicamos stripTsComments (los `--` son comentarios SQL,
  // pero las firmas que buscamos viven en ellos y en el DDL; buscamos texto crudo).

  //  (3a) El header de la migración (línea 1) sigue identificando el archivo.
  if (!/^--\s*0023_dinero\.sql/m.test(mig)) {
    offenders.push(
      "LOCKED-3a: 0023_dinero.sql perdió su header `-- 0023_dinero.sql` — la migración LOCKED fue " +
        "alterada (es un checkpoint de operador ya aplicado; no se re-numera ni reescribe).",
    );
  }

  //  (3b) La tabla `contratos_ingesta_estado` con la columna `ingestado_hasta` (sobre la que
  //       la señal freshness de Plan 70-02 mide staleness) sigue definida.
  const tieneTabla = /create\s+table\s+contratos_ingesta_estado/i.test(mig);
  const tieneColumna = /\bingestado_hasta\b/.test(mig);
  if (!tieneTabla || !tieneColumna) {
    offenders.push(
      "LOCKED-3b: 0023_dinero.sql perdió `create table contratos_ingesta_estado` / la columna " +
        "`ingestado_hasta` — la señal freshness ChileCompra (Plan 70-02) mide staleness sobre esa " +
        "columna; borrarla rompería el catálogo.",
    );
  }

  return offenders;
}

// ---------------------------------------------------------------------------
// (1) Guard estático — sobre los TRES archivos LOCKED reales del repo.
// ---------------------------------------------------------------------------

function leerFuentes(): FuentesLocked {
  return {
    reconciliar: readFileSync(RECONCILIAR_CONTRATO, "utf-8"),
    model: readFileSync(MODEL, "utf-8"),
    migracion: readFileSync(MIGRACION_0023, "utf-8"),
  };
}

describe("(1) Guard estático — las firmas LOCKED de dinero están intactas", () => {
  it("sanity: los tres archivos LOCKED existen y son legibles", () => {
    const f = leerFuentes();
    expect(f.reconciliar.length).toBeGreaterThan(100);
    expect(f.model.length).toBeGreaterThan(100);
    expect(f.migracion.length).toBeGreaterThan(100);
  });

  it("reconciliar-contrato.ts / model.ts / 0023_dinero.sql: cero debilitamientos de las firmas LOCKED", () => {
    const offenders = detectarDebilitamientos(leerFuentes());
    expect(
      offenders,
      `Firmas LOCKED debilitadas: [${offenders.join("; ")}]. Esta fase (Phase 70) NO debe tocar el ` +
        `reconciliador jurídico RUT-only, el monto VERBATIM ni la migración 0023.`,
    ).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// (2) Aserciones explícitas de cada firma protegida (legibilidad del corte).
// ---------------------------------------------------------------------------

describe("(2) Firmas LOCKED explícitas", () => {
  it("LOCKED-1: la rama jurídica es RUT-only (guarda `!== \"natural\"` retorna antes de correrPipeline; resolución por matchDeterministaEntidad)", () => {
    const rec = stripTsComments(readFileSync(RECONCILIAR_CONTRATO, "utf-8"));
    expect(/c\.tipoPersona\s*!==\s*["']natural["']/.test(rec)).toBe(true);
    expect(/\bmatchDeterministaEntidad\b/.test(rec)).toBe(true);
    // La única llamada a correrPipeline vive DESPUÉS de la guarda jurídica (fallback natural).
    const idxGuarda = rec.search(/c\.tipoPersona\s*!==\s*["']natural["']/);
    const idxPipeline = rec.search(/\bcorrerPipeline\s*\(/);
    expect(idxPipeline).toBeGreaterThan(idxGuarda);
  });

  it("LOCKED-2: `monto` es string VERBATIM (interfaz + Zod), nunca numeric", () => {
    const model = stripTsComments(readFileSync(MODEL, "utf-8"));
    expect(/\bmonto\s*:\s*string\s*\|\s*null\b/.test(model)).toBe(true);
    expect(/\bmonto\s*:\s*z\.string\(\)\.nullable\(\)/.test(model)).toBe(true);
    expect(/\bmonto\s*:\s*number\b/.test(model)).toBe(false);
    expect(/\bmonto\s*:\s*z\.number\(\)/.test(model)).toBe(false);
  });

  it("LOCKED-3: 0023_dinero.sql conserva el header y la tabla contratos_ingesta_estado(ingestado_hasta)", () => {
    const mig = readFileSync(MIGRACION_0023, "utf-8");
    expect(/^--\s*0023_dinero\.sql/m.test(mig)).toBe(true);
    expect(/create\s+table\s+contratos_ingesta_estado/i.test(mig)).toBe(true);
    expect(/\bingestado_hasta\b/.test(mig)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// (3) Mutation self-check — el detector SÍ MUERDE ante cada firma rota (fixtures
//     EN MEMORIA). Sin esto, un detector siempre-verde sería un no-op inútil.
// ---------------------------------------------------------------------------

describe("(3) Mutation self-check — el guard MUERDE ante cada debilitamiento", () => {
  // Base VÁLIDA (las tres firmas intactas) que cada caso rompe en UN solo eje.
  function baseValida(): FuentesLocked {
    return {
      reconciliar: `
        const entidadId = resolverEntidadProveedor(c, maestraEntidad);
        if (c.tipoPersona !== "natural" || proveedorNombre.length === 0) {
          out.push(fila);
          continue;
        }
        const x = matchDeterministaEntidad(a, b);
        pres = await correrPipeline(mencion, maestra, provider, writer);
      `,
      model: `
        export interface Contrato { monto: string | null; }
        export const ContratoSchema = z.object({ monto: z.string().nullable() });
      `,
      migracion: `-- 0023_dinero.sql\ncreate table contratos_ingesta_estado (\n  ingestado_hasta date\n);`,
    };
  }

  it("base válida → 0 offenders (el guard no es un falso-positivo permanente)", () => {
    expect(detectarDebilitamientos(baseValida())).toEqual([]);
  });

  it("LOCKED-1a MUERDE: se borra la guarda `!== \"natural\"` (jurídica caería al pipeline)", () => {
    const roto = baseValida();
    roto.reconciliar = roto.reconciliar.replace(
      /if \(c\.tipoPersona !== "natural"[^\n]*\n[\s\S]*?continue;\n\s*\}/,
      "",
    );
    const offenders = detectarDebilitamientos(roto);
    expect(offenders.some((o) => o.startsWith("LOCKED-1a"))).toBe(true);
  });

  it("LOCKED-1c MUERDE: `correrPipeline` movido ANTES de la guarda jurídica (name-link de jurídica)", () => {
    const roto = baseValida();
    roto.reconciliar = `
      pres = await correrPipeline(mencion, maestra, provider, writer);
      const entidadId = resolverEntidadProveedor(c, maestraEntidad);
      if (c.tipoPersona !== "natural" || proveedorNombre.length === 0) { continue; }
      const x = matchDeterministaEntidad(a, b);
    `;
    const offenders = detectarDebilitamientos(roto);
    expect(offenders.some((o) => o.startsWith("LOCKED-1c"))).toBe(true);
  });

  it("LOCKED-2a MUERDE: `monto` pasa a number en la interfaz", () => {
    const roto = baseValida();
    roto.model = `
      export interface Contrato { monto: number; }
      export const ContratoSchema = z.object({ monto: z.string().nullable() });
    `;
    const offenders = detectarDebilitamientos(roto);
    expect(offenders.some((o) => o.startsWith("LOCKED-2"))).toBe(true);
  });

  it("LOCKED-2b MUERDE: el schema Zod de `monto` pasa a z.number()", () => {
    const roto = baseValida();
    roto.model = `
      export interface Contrato { monto: string | null; }
      export const ContratoSchema = z.object({ monto: z.number() });
    `;
    const offenders = detectarDebilitamientos(roto);
    expect(offenders.some((o) => o.startsWith("LOCKED-2"))).toBe(true);
  });

  it("LOCKED-3a MUERDE: se altera el header de 0023", () => {
    const roto = baseValida();
    roto.migracion = `-- 0099_otra_cosa.sql\ncreate table contratos_ingesta_estado (ingestado_hasta date);`;
    const offenders = detectarDebilitamientos(roto);
    expect(offenders.some((o) => o.startsWith("LOCKED-3a"))).toBe(true);
  });

  it("LOCKED-3b MUERDE: se borra la columna ingestado_hasta / la tabla", () => {
    const roto = baseValida();
    roto.migracion = `-- 0023_dinero.sql\ncreate table otra_cosa (id text);`;
    const offenders = detectarDebilitamientos(roto);
    expect(offenders.some((o) => o.startsWith("LOCKED-3b"))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// (4) Sin falsos positivos — la PROSA de los JSDoc (que menciona correrPipeline,
//     monto, numeric para EXPLICAR el corte) NO cuenta tras stripTsComments.
// ---------------------------------------------------------------------------

describe("(4) Sin falsos positivos — comentarios que EXPLICAN el corte no lo rompen", () => {
  it("un JSDoc que menciona `monto: number` / `correrPipeline` como CONTRAEJEMPLO no dispara", () => {
    const fuentes: FuentesLocked = {
      reconciliar: `
        /* Una jurídica NUNCA llama correrPipeline; correrPipeline vive tras la guarda. */
        // correrPipeline(x) sería un name-link de jurídica — PROHIBIDO.
        const entidadId = resolverEntidadProveedor(c, m);
        if (c.tipoPersona !== "natural") { continue; }
        matchDeterministaEntidad(a, b);
        await correrPipeline(mencion, maestra, provider, writer);
      `,
      model: `
        // NO usar \`monto: number\` — el monto es VERBATIM.
        /* z.number() rompería VERBATIM; usamos z.string().nullable(). */
        export interface Contrato { monto: string | null; }
        export const ContratoSchema = z.object({ monto: z.string().nullable() });
      `,
      migracion: `-- 0023_dinero.sql\ncreate table contratos_ingesta_estado (ingestado_hasta date);`,
    };
    expect(detectarDebilitamientos(fuentes)).toEqual([]);
  });
});
