/**
 * LOCKDOWN-04 — Guard CI anti-regresion (42-04)
 *
 * Dos bloques:
 *
 * (A) Ningun migración futura (numero > 0044) re-expone `anon` via
 *     `GRANT … TO anon` ni via `CREATE POLICY … TO anon`. Si no hay
 *     migraciones con numero > 0044, el test pasa trivialmente.
 *
 *     ALCANCE HONESTO (VALIDATION B2): este guard es ESTATICO sobre los
 *     archivos de migracion del repo. NO detecta re-grants a anon que
 *     ocurran a nivel de CATALOGO por el default-ACL de `supabase_admin`
 *     (p.ej. objetos creados por Supabase-managed migrations). Ese hueco
 *     residual lo cubre SOLO la re-corrida periodica del pgTAP post-apply:
 *     `supabase/tests/post-apply/0044_revoke_anon.test.sql`
 *     contra PROD (ver RUNBOOK-lockdown-cutover.md §Riesgo residual).
 *
 * (B) El chokepoint web_reader (`app/lib/supabase.ts`) no usa
 *     métodos `.auth.` en el cliente Supabase ni selecciona columnas
 *     o tablas PII conocidas. Esto es defensa-en-profundidad: RLS ya
 *     protege el dato en la DB, pero el guard atrapa el intento en código.
 *
 *     NOTA: el literal de config `auth: { persistSession: false, … }` es
 *     VALIDO y no debe ser flaggeado. El guard busca exclusivamente el
 *     patron `.auth.` (punto antes de auth) que indica una llamada a metodo
 *     como `client.auth.signIn(…)` / `supabase.auth.getSession()`.
 */

import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// vitest runs from the app/ directory (vitest.config.ts lives there).
// Resolve the migrations dir relative to the monorepo root (one level up from app/).
const APP_ROOT = process.cwd(); // app/
const REPO_ROOT = path.resolve(APP_ROOT, ".."); // monorepo root

const MIGRATIONS_DIR = path.join(REPO_ROOT, "supabase", "migrations");
const SUPABASE_TS = path.join(APP_ROOT, "lib", "supabase.ts");

/** Parse el prefijo numerico de un nombre de archivo de migracion (ej. "0044_foo.sql" -> 44) */
function migrationNumber(filename: string): number | null {
  const m = /^(\d+)_/.exec(filename);
  return m ? parseInt(m[1], 10) : null;
}

/** Eliminar lineas que son comentarios SQL (comienzan con --) para no contar prosa */
function stripSqlComments(content: string): string {
  return content
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("--"))
    .join("\n");
}

/**
 * Eliminar comentarios de TypeScript/JavaScript:
 *  - bloques `/** … *\/` y `/* … *\/`
 *  - lineas `// …`
 * Esto evita que prosa en JSDoc/comentarios dispare los guards de Block B.
 */
function stripTsComments(content: string): string {
  // Remove block comments (including JSDoc /** … */ and /* … */)
  let stripped = content.replace(/\/\*[\s\S]*?\*\//g, "");
  // Remove line comments (// …)
  stripped = stripped
    .split("\n")
    .map((line) => {
      const idx = line.indexOf("//");
      return idx >= 0 ? line.slice(0, idx) : line;
    })
    .join("\n");
  return stripped;
}

// ---------------------------------------------------------------------------
// (A) Ningun archivo de migracion con numero > 0044 re-concede acceso a anon
// ---------------------------------------------------------------------------

describe("(A) Guard — ninguna migracion nueva re-expone anon", () => {
  const LOCKDOWN_CUTOFF = 44;

  // Leer migraciones con numero > 0044
  const futureMigrations = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .filter((f) => {
      const n = migrationNumber(f);
      return n !== null && n > LOCKDOWN_CUTOFF;
    })
    .sort();

  it("no existe ningun `GRANT … TO … anon` en migraciones > 0044 (sin contar comentarios)", () => {
    const offenders: string[] = [];
    for (const filename of futureMigrations) {
      const raw = readFileSync(`${MIGRATIONS_DIR}/${filename}`, "utf-8");
      const stripped = stripSqlComments(raw).toLowerCase();
      // Patron: grant <cualquier cosa> to <cualquier cosa> anon
      if (/grant\s+\S[\s\S]*?\bto\s+[\w,\s]*\banon\b/.test(stripped)) {
        offenders.push(filename);
      }
    }
    expect(offenders, `Migraciones con GRANT a anon (LOCKDOWN-regresion): ${offenders.join(", ")} — elimina el grant o muevelo a una seccion post-0044 que use web_reader`).toHaveLength(0);
  });

  it("no existe ningun `CREATE POLICY … TO anon` en migraciones > 0044 (sin contar comentarios)", () => {
    const offenders: string[] = [];
    for (const filename of futureMigrations) {
      const raw = readFileSync(`${MIGRATIONS_DIR}/${filename}`, "utf-8");
      const stripped = stripSqlComments(raw).toLowerCase();
      // Patron: create policy … to anon  /  for select to anon
      if (
        /create\s+policy\s+[\s\S]*?\bto\s+[\w,\s]*\banon\b/.test(stripped) ||
        /for\s+select\s+to\s+[\w,\s]*\banon\b/.test(stripped)
      ) {
        offenders.push(filename);
      }
    }
    expect(offenders, `Migraciones con CREATE POLICY to anon (LOCKDOWN-regresion): ${offenders.join(", ")} — usa web_reader en lugar de anon`).toHaveLength(0);
  });

  it("hay exactamente 0 migraciones > 0044 en el estado inicial del repo (pasa trivialmente)", () => {
    // Este test documenta el estado base. Una vez que existan migraciones
    // > 0044, los tests de arriba son los que importan; este puede ignorarse.
    expect(futureMigrations).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// (B) Chokepoint web_reader (app/lib/supabase.ts) — sin .auth. ni selects PII
// ---------------------------------------------------------------------------

describe("(B) Guard — chokepoint supabase.ts no usa .auth. ni selecciona PII", () => {
  const content = readFileSync(SUPABASE_TS, "utf-8");
  // Strip TS/JS comments (JSDoc, block comments, line comments) so that
  // documentation prose like `client.auth.signIn` in a JSDoc comment does NOT
  // trigger the guard — only actual source code is scanned.
  const stripped = stripTsComments(content);

  it("no contiene uso de metodo .auth. (e.g. client.auth.signIn, supabase.auth.getSession)", () => {
    // Buscar el patron `.auth.` (punto antes de auth + punto despues).
    // Esto distingue la llamada a metodo `client.auth.signIn()` del literal
    // de config `auth: { persistSession: false }` que usa `auth:` (sin punto antes).
    const hasAuthMethod = /\.auth\./.test(stripped);
    expect(hasAuthMethod, `app/lib/supabase.ts contiene una llamada a metodo .auth.* — el cliente web_reader NO debe usar auth de usuarios (supabase-js lanza cuando accessToken esta seteado). Elimina el uso o muevelo al cliente admin.`).toBe(false);
  });

  it("no contiene .select() nombrando columnas PII conocidas (rut, donante_id, partido)", () => {
    // PII columns catalogadas en _FACTS-live-prod.md
    const PII_COLUMNS = ["rut", "donante_id", "partido"];
    const selectMatches: string[] = [];
    for (const col of PII_COLUMNS) {
      // Buscar `.select(…col…)` — columna PII en un string de select
      const pattern = new RegExp(`\\.select\\([^)]*\\b${col}\\b[^)]*\\)`, "i");
      if (pattern.test(stripped)) {
        selectMatches.push(col);
      }
    }
    expect(selectMatches, `app/lib/supabase.ts contiene un .select() con columnas PII: [${selectMatches.join(", ")}]. El servidor web_reader NO debe proyectar PII directamente — usa un RPC secdef si necesitas datos de parlamentario.`).toHaveLength(0);
  });

  it("no contiene .from('parlamentario') ni .from(\"parlamentario\") (tabla PII directa)", () => {
    // `parlamentario` es la tabla PII maestra (rut + datos crudos); nunca debe
    // ser accedida directamente por el chokepoint web_reader.
    const hasPiiTable =
      /\.from\(\s*['"]parlamentario['"]\s*\)/.test(stripped);
    expect(hasPiiTable, `app/lib/supabase.ts contiene un .from('parlamentario') — tabla PII; accede via RPC parlamentario_publico() en su lugar.`).toBe(false);
  });

  it("no contiene .from() con otras tablas PII conocidas (donante, cruce_senal, identidad_audit)", () => {
    // Tablas PII adicionales de _FACTS-live-prod.md §"PII tables"
    const PII_TABLES = [
      "donante",
      "cruce_senal",
      "identidad_audit",
      "vinculo_identidad",
      "vinculo_entidad",
      "declaracion_familiar",
      "parlamentario_alias",
      "entidad_tercero",
    ];
    const offenders: string[] = [];
    for (const table of PII_TABLES) {
      const pattern = new RegExp(`\\.from\\(\\s*['"]${table}['"]\\s*\\)`, "i");
      if (pattern.test(stripped)) {
        offenders.push(table);
      }
    }
    expect(offenders, `app/lib/supabase.ts contiene acceso directo a tablas PII: [${offenders.join(", ")}]. El chokepoint web_reader debe acceder SOLO a las 26 tablas public-read o via RPCs curadas.`).toHaveLength(0);
  });
});
