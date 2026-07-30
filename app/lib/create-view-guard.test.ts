/**
 * B-03 — Guard CI: `create view` en `public` sin `security_invoker` (DEBT-02).
 *
 * Amenaza mitigada: una view en `public` creada SIN `security_invoker = true`
 * (o `= on`) corre con los privilegios del OWNER de la view, no del caller —
 * esto bypassa la RLS del rol que hace la consulta (`anon`/`authenticated`).
 * Bajo Camino A el sitio ya lee con `service_role` (ver `lockdown-guard.test.ts`
 * bloque B), pero una view mal declarada seguiría siendo una elevación de
 * privilegio silenciosa para cualquier consumidor futuro que use un rol
 * restringido (p.ej. `web_reader` si se reintrodujera, o acceso directo).
 *
 * El cero de HOY (2026-07-30, 77 migraciones, 0 `create view`) es VACUO por
 * construcción: nadie ha creado una view todavía. La 0080 (Phase 127) va a
 * crear la primera. Lo que vuelve el cero FUERTE es el control positivo
 * apareado (§2): fixtures STRING inline que demuestran que el detector SÍ
 * muerde ante una view sin `security_invoker`, y que el mismo detector deja
 * pasar la variante correcta.
 *
 * Espejo del molde `vsim-antiflip-guard.test.ts` / `lockdown-guard.test.ts`:
 * helpers module-local, detector PURO (sin I/O), describes numerados
 * (1) escaneo real, (2) control positivo apareado, (3) mutation self-check.
 * `stripSqlComments` de este archivo NO se importa de `lockdown-guard.test.ts`
 * (los guards no se importan entre sí) y es una versión MÁS estricta: también
 * elimina comentarios `--` a mitad de línea y bloques `/* … *\/` (la de
 * lockdown solo quita líneas que EMPIEZAN por `--`).
 */

import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// ---------------------------------------------------------------------------
// Rutas — WR-06: anclar a import.meta.dirname (NUNCA process.cwd(), Pitfall 6 /
// bug v8.1: pnpm --filter exec cambia cwd y el guard escanearía cero archivos
// silenciosamente).
// ---------------------------------------------------------------------------
const APP_ROOT = path.resolve(import.meta.dirname, "..");
const REPO_ROOT = path.resolve(APP_ROOT, "..");
const MIGRATIONS_DIR = path.join(REPO_ROOT, "supabase", "migrations");

/**
 * Elimina comentarios SQL: líneas/tramos que empiezan por `--` (incluso a
 * mitad de línea) y bloques `/* … *\/`. Más estricto que el `stripSqlComments`
 * de `lockdown-guard.test.ts` (ese solo quita líneas que EMPIEZAN por `--`).
 */
function stripSqlComments(sql: string): string {
  // Bloques /* ... */ (pueden cruzar líneas)
  let stripped = sql.replace(/\/\*[\s\S]*?\*\//g, "");
  // -- hasta fin de línea, incluso a mitad de línea
  stripped = stripped
    .split("\n")
    .map((line) => {
      const idx = line.indexOf("--");
      return idx >= 0 ? line.slice(0, idx) : line;
    })
    .join("\n");
  return stripped;
}

/**
 * Allowlist de matviews toleradas sin `security_invoker` (las materialized
 * views NO soportan esa opción — siempre son violación bajo este detector).
 * DELIBERADAMENTE VACÍA: sumar una entrada aquí exige una decisión explícita
 * documentada (no es un escape hatch silencioso).
 */
const MATVIEW_ALLOWLIST: readonly string[] = [];
void MATVIEW_ALLOWLIST; // referenciada solo como documentación del punto de decisión

const CREATE_VIEW_RE =
  /^\s*create\s+(or\s+replace\s+)?(materialized\s+)?view\s+(if\s+not\s+exists\s+)?(public\.)?["\w]+/i;
const SECURITY_INVOKER_RE = /with\s*\(\s*[^)]*security_invoker\s*=\s*(true|on)/i;

/** Extrae el nombre de la view del match de CREATE_VIEW_RE (grupo final del identificador). */
function extraerNombreView(stmt: string): string {
  const m = /create\s+(?:or\s+replace\s+)?(?:materialized\s+)?view\s+(?:if\s+not\s+exists\s+)?((?:public\.)?["\w]+)/i.exec(
    stmt,
  );
  return m ? m[1] : "(nombre no resuelto)";
}

/**
 * Detector PURO (sin I/O): dado el texto de una migración, devuelve la lista
 * de nombres de view en violación (create view/materialized view en `public`
 * — o no-calificada — sin `security_invoker = true|on` en la misma sentencia).
 */
export function detectarViewsSinInvoker(sql: string): string[] {
  const stripped = stripSqlComments(sql);
  const statements = stripped.split(";");
  const offenders: string[] = [];

  for (const stmt of statements) {
    const m = CREATE_VIEW_RE.exec(stmt);
    if (!m) continue;

    const esMaterialized = !!m[2];
    const qualifier = m[4]; // "public." o undefined (no calificado)

    // Solo nos importan views no calificadas o calificadas a public.
    // (m[4] captura literalmente "public." cuando está presente; si el CREATE
    // VIEW referencia otro schema, CREATE_VIEW_RE no matchea el prefijo y
    // fallamos a "no calificado" — pero eso ya excluiría otros schemas porque
    // el regex ancla justo después de VIEW/IF NOT EXISTS.)
    const schemaOtro = /create\s+(?:or\s+replace\s+)?(?:materialized\s+)?view\s+(?:if\s+not\s+exists\s+)?(\w+)\./i.exec(
      stmt,
    );
    if (schemaOtro && schemaOtro[1].toLowerCase() !== "public") {
      continue; // fuera de public → no nos concierne
    }
    void qualifier;

    if (esMaterialized) {
      offenders.push(extraerNombreView(stmt));
      continue;
    }

    if (!SECURITY_INVOKER_RE.test(stmt)) {
      offenders.push(extraerNombreView(stmt));
    }
  }

  return offenders;
}

// ---------------------------------------------------------------------------
// (1) Escaneo real de supabase/migrations/*.sql
// ---------------------------------------------------------------------------

describe("(1) Guard B-03 — escaneo real de supabase/migrations", () => {
  const archivos = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql"));

  it("MIGRATIONS_DIR resuelve al árbol real (cero fuerte, no vacuo por ruta rota)", () => {
    expect(
      archivos.length,
      "MIGRATIONS_DIR mal resuelto — el cero sería vacuo por ruta rota",
    ).toBeGreaterThanOrEqual(70);
  });

  it("ninguna migración crea una view en public sin security_invoker", () => {
    const offenders: string[] = [];
    for (const filename of archivos) {
      const raw = readFileSync(path.join(MIGRATIONS_DIR, filename), "utf-8");
      for (const viewName of detectarViewsSinInvoker(raw)) {
        offenders.push(`${filename} → ${viewName}`);
      }
    }
    expect(
      offenders,
      "View(s) en public sin security_invoker — añade `with (security_invoker = true)` a la view, o —si es matview— justifícala explícitamente en MATVIEW_ALLOWLIST",
    ).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// (2) Control positivo apareado — fixtures STRING inline (D-03: JAMÁS .sql en
// supabase/migrations/).
// ---------------------------------------------------------------------------

describe("(2) Control positivo apareado — el detector muerde y deja pasar lo correcto", () => {
  it("create view public.v_x sin invoker → 1 violación", () => {
    const sql = "create view public.v_x as select 1;";
    expect(detectarViewsSinInvoker(sql)).toEqual(["public.v_x"]);
  });

  it("create or replace view v_y (no calificado) sin invoker → reporta", () => {
    const sql = "create or replace view v_y as select 1;";
    expect(detectarViewsSinInvoker(sql)).toEqual(["v_y"]);
  });

  it("create materialized view public.mv_z → SIEMPRE reporta (matviews no soportan security_invoker)", () => {
    const sql = "create materialized view public.mv_z as select 1;";
    expect(detectarViewsSinInvoker(sql)).toEqual(["public.mv_z"]);
  });

  it("create view public.v_x with (security_invoker = true) → []", () => {
    const sql = "create view public.v_x with (security_invoker = true) as select 1;";
    expect(detectarViewsSinInvoker(sql)).toEqual([]);
  });

  it("variante security_invoker = on → []", () => {
    const sql = "create view public.v_x with (security_invoker = on) as select 1;";
    expect(detectarViewsSinInvoker(sql)).toEqual([]);
  });

  it("create view otro_schema.v_w (fuera de public) → []", () => {
    const sql = "create view otro_schema.v_w as select 1;";
    expect(detectarViewsSinInvoker(sql)).toEqual([]);
  });

  it("view sin invoker COMENTADA (-- y bloque /* */) → [] (prueba del strip)", () => {
    const sql = `
      -- create view public.v_c as select 1;
      /* create view public.v_c2 as select 1; */
      select 1;
    `;
    expect(detectarViewsSinInvoker(sql)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// (3) Mutation self-check — el mismo código que da 0 sobre el árbol real
// SÍ muerde ante el fixture sin security_invoker (T-126-07: guard no-op).
// ---------------------------------------------------------------------------

describe("(3) Mutation self-check — el guard no es un no-op verde", () => {
  it("el detector aplicado a un fixture sin security_invoker devuelve length > 0", () => {
    const sqlSinInvoker = "create view public.v_mutation_check as select 1;";
    expect(
      detectarViewsSinInvoker(sqlSinInvoker).length,
      "el guard sería un no-op verde",
    ).toBeGreaterThan(0);
  });
});
