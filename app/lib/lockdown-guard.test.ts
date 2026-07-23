/**
 * LOCKDOWN-04 — Guard CI anti-regresion (42-04, actualizado Camino A post-legacy)
 *
 * Dos bloques:
 *
 * (A) Ningun migración futura (numero > 0044) re-expone `anon` via
 *     `GRANT … TO anon`, `GRANT … TO public` (anon es miembro IMPLICITO del
 *     pseudo-rol `public` — un grant a public concede a anon igual, WR-07) ni
 *     via `CREATE POLICY … TO anon`. Si no hay migraciones con numero > 0044,
 *     el test pasa trivialmente.
 *
 *     ALCANCE HONESTO (VALIDATION B2): este guard es ESTATICO sobre los
 *     archivos de migracion del repo. NO detecta re-grants a anon que
 *     ocurran a nivel de CATALOGO por el default-ACL de `supabase_admin`
 *     (p.ej. objetos creados por Supabase-managed migrations). Ese hueco
 *     residual lo cubre SOLO la re-corrida periodica del pgTAP post-apply:
 *     `supabase/tests/post-apply/0044_revoke_anon.test.sql`
 *     contra PROD (ver RUNBOOK-lockdown-cutover.md §Riesgo residual).
 *
 * (B) [Camino A] El sitio publico server-side lee con la SERVICE key
 *     (`service_role`, que BYPASSA RLS). La proteccion de PII ya no esta en
 *     la DB para esta ruta -> el guard escanea TODO el arbol de `app/`
 *     (excepto la superficie admin gateada) y FALLA si algun archivo accede
 *     directamente a una tabla PII via `.from('<tabla_pii>')`. Defensa-en-
 *     profundidad: el dato PII debe leerse SOLO via RPCs PII-safe o por el
 *     cliente admin (`createAdminSupabase`) detras de su gate.
 *
 *     NOTA: el literal de config `auth: { persistSession: false, … }` es
 *     VALIDO y no debe ser flaggeado. El guard busca exclusivamente el
 *     patron `.from('<tabla_pii>')`.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
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
 *
 * OJO (WR-05): NO tratar `//` como comentario cuando va precedido de `:` —
 * cortar en el `//` de una URL en un string literal (`"https://x.cl"`)
 * truncaria la linea ANTES de un `.rpc(…)`/`.from(…)` posterior y crearia un
 * FALSO NEGATIVO en el escaner de seguridad (este archivo ES el control CI de
 * la superficie Camino A). Heuristica barata que cubre `http://`/`https://`.
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

/**
 * Camina recursivamente un directorio devolviendo todos los archivos .ts/.tsx
 * que NO son tests ni viven en directorios de build/deps.
 */
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

// Tablas PII catalogadas en _FACTS-live-prod.md §"PII tables" + la tabla maestra
// `parlamentario` (rut + datos crudos). Acceso directo via `.from()` prohibido en
// el arbol publico; permitido SOLO en la superficie admin gateada (ver allowlist).
const PII_TABLES = [
  "parlamentario",
  "donante",
  "cruce_senal",
  "identidad_audit",
  "vinculo_identidad",
  "vinculo_entidad",
  "declaracion_familiar",
  "parlamentario_alias",
  "entidad_tercero",
  "revision_entidad",
];

/**
 * Archivos/dirs autorizados a tocar tablas PII directamente: la superficie admin
 * (detras de `adminRevisionEnabled`) y su cliente service-role dedicado. El resto
 * del arbol publico NO debe aparecer aqui.
 */
function isAdminAllowlisted(file: string): boolean {
  const rel = path.relative(APP_ROOT, file).split(path.sep).join("/");
  return (
    rel.startsWith("app/admin/") ||
    rel === "lib/supabase-admin.ts" ||
    rel.startsWith("lib/admin/")
  );
}

// RPCs PII-safe que el arbol publico SI puede invocar (security-definer, nunca
// proyectan rut/donante crudo; auditadas en RESEARCH §1). Bajo Camino A el cliente
// publico es `service_role` -> puede EJECUTAR cualquier RPC, incluso admin/write
// (`resolver_entidad`, materializadores). La DB ya no lo bloquea, asi que el guard
// FALLA si el arbol publico llama un RPC fuera de esta lista. Mantener en sync.
const PUBLIC_RPC_ALLOWLIST = new Set([
  "agregado_por_contraparte",
  "aportes_de_parlamentario",
  "bienes_de_parlamentario",
  "buscar_citaciones",
  "buscar_proyectos_hibrido",
  "co_comisionados_de_parlamentario",
  "coautores_de_parlamentario",
  "comisiones_de_parlamentario",
  "comparar_declaraciones",
  "contratos_de_parlamentario",
  "copartidarios_de_parlamentario",
  "cruces_de_parlamentario",
  "cruces_de_proyecto",
  "de_la_misma_zona",
  "declaraciones_de_parlamentario",
  "lobby_de_parlamentario",
  "lobby_en_tramitacion",
  "lobby_menciones_de_boletin",
  "match_proyectos",
  "militancias_de_parlamentario",
  "parlamentario_publico",
  "parlamentario_publico_v2",
  "parlamentarios_publico",
  "parlamentarios_publico_v2",
  "subgrafo_red",
  "votos_de_parlamentario",
]);

/**
 * Extrae los `grant … to … anon` Y `grant … to … public` de una migración
 * (SQL ya con comentarios stripeados y en minúscula). Guard ESTRICTO, SIN
 * EXENCIONES.
 *
 * WR-07: `public` cuenta como offender porque anon es miembro IMPLICITO del
 * pseudo-rol `public` en Postgres — `grant execute … to public` re-abre la
 * superficie REST no autenticada EXACTAMENTE igual que un grant a anon
 * (`has_function_privilege('anon', …)` pasa a true). `revoke … from public`
 * NO matchea (no contiene `grant`); ninguna migración >0044 usa grant-to-public
 * legítimamente (verificado al cerrar WR-07).
 *
 * La exención de Phase 51 ("grant execute on function <RPC allowlisted> to anon")
 * se REVIRTIÓ en el review-fix de la fase (CR-01/CR-03): (1) su premisa
 * ("status quo desde 0019") era STALE — 0044 (aplicada a PROD) revocó todas las
 * rutinas de anon y el status quo real es DENY; re-conceder re-abriría superficie
 * REST no autenticada y rompería el pgTAP post-apply 0044; (2) la implementación
 * era bypasseable con listas multi-función (`grant execute on function a(text),
 * b(text) to anon` eximía la sentencia entera si el PRIMER nombre estaba
 * allowlisted). Bajo Camino A el sitio lee con service_role → NINGÚN grant a
 * anon es legítimo.
 *
 * Decisión POR-SENTENCIA (se parte el SQL por `;`) para reportar el offender
 * exacto en el mensaje de fallo.
 */
function anonGrantOffenders(strippedLowerSql: string): string[] {
  const offenders: string[] = [];
  const grantToAnon = /grant\s+\S[\s\S]*?\bto\s+[\w,\s]*\b(anon|public)\b/;
  for (const stmt of strippedLowerSql.split(";")) {
    if (!grantToAnon.test(stmt)) continue;
    offenders.push(stmt.trim().replace(/\s+/g, " ").slice(0, 100));
  }
  return offenders;
}

// ---------------------------------------------------------------------------
// (A) Ningun archivo de migracion con numero > 0044 re-concede acceso a anon
//     (guard ESTRICTO, sin exenciones: anon = cero grants bajo Camino A).
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

  it("no existe ningun `GRANT … TO … anon/public` en migraciones > 0044 (sin contar comentarios)", () => {
    const offenders: string[] = [];
    for (const filename of futureMigrations) {
      const raw = readFileSync(`${MIGRATIONS_DIR}/${filename}`, "utf-8");
      const stripped = stripSqlComments(raw).toLowerCase();
      // Por-sentencia, sin exenciones (anon = cero grants bajo Camino A).
      for (const off of anonGrantOffenders(stripped)) {
        offenders.push(`${filename}: ${off}`);
      }
    }
    expect(offenders, `Migraciones con GRANT a anon/public (LOCKDOWN-regresion; anon es miembro implicito de public): ${offenders.join(", ")} — bajo Camino A anon tiene CERO grants (el sitio lee con service_role); elimina el grant`).toHaveLength(0);
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
    expect(offenders, `Migraciones con CREATE POLICY to anon (LOCKDOWN-regresion): ${offenders.join(", ")}`).toHaveLength(0);
  });

  it("las migraciones > 0044 existentes son revoke/hardening y NINGUNA concede acceso a anon", () => {
    // El placeholder original ("exactamente 0 migraciones > 0044") se reemplazó al
    // landear 0045 (DEBT DB-01/03/07/08): una migración de SOLO revoke-from-public.
    // Los guards A1/A2 (arriba) son la protección activa; aquí confirmamos que el set
    // >0044 no está vacío y que ninguna re-expone anon (ni grant ni policy).
    expect(futureMigrations.length).toBeGreaterThan(0);
    for (const filename of futureMigrations) {
      const stripped = stripSqlComments(
        readFileSync(`${MIGRATIONS_DIR}/${filename}`, "utf-8"),
      ).toLowerCase();
      // grant a anon: por-sentencia, sin exenciones.
      const reExponeAnon =
        anonGrantOffenders(stripped).length > 0 ||
        /create\s+policy\s+[\s\S]*?\bto\s+[\w,\s]*\banon\b/.test(stripped) ||
        /for\s+select\s+to\s+[\w,\s]*\banon\b/.test(stripped);
      expect(reExponeAnon, `${filename} re-expone anon`).toBe(false);
    }
  });

  // Regla documentada por casos sintéticos in-memory (sin tocar disco): TODO
  // `grant … to anon` es offender — incluso `grant execute` de un RPC que está en
  // PUBLIC_RPC_ALLOWLIST (la exención de Phase 51 se REVIRTIÓ: premisa stale
  // post-0044 + bypasseable con listas multi-función, ver doc de
  // anonGrantOffenders).
  it("BLOQUEA todo `grant … to anon/public`: RPC allowlisted, tabla, listas multi-función y la puerta de al lado `to public`", () => {
    // (a) grant execute de un RPC allowlisted → TAMBIÉN offender (sin carve-out;
    // anon quedó a cero grants desde 0044).
    expect(
      anonGrantOffenders(
        "grant execute on function public.rebeldias_de_parlamentario(text) to anon;",
      ),
    ).toHaveLength(1);
    // (b) grant select sobre tabla → offender.
    expect(
      anonGrantOffenders("grant select on public.parlamentario to anon;"),
    ).toHaveLength(1);
    // (c) lista multi-función en UNA sentencia (el bypass que motivó la reversión:
    // la exención tomaba solo el PRIMER nombre) → offender.
    expect(
      anonGrantOffenders(
        "grant execute on function public.rebeldias_de_parlamentario(text), public.resolver_entidad(text) to anon;",
      ),
    ).toHaveLength(1);
    // (d) grant execute de una función NO allowlisted → offender.
    expect(
      anonGrantOffenders(
        "grant execute on function public.funcion_no_listada(text) to anon;",
      ),
    ).toHaveLength(1);
    // (e) WR-07: grant a `public` → offender (anon es miembro implicito del
    // pseudo-rol public; re-abre la superficie REST igual que un grant a anon).
    expect(
      anonGrantOffenders(
        "grant execute on function public.f(text) to public;",
      ),
    ).toHaveLength(1);
    // (f) el DOBLE revoke idiomático (0041/0047) NO matchea: `revoke … from
    // public` no contiene `grant`; el `public.` de schema-qualification antes
    // del `to` tampoco dispara (el regex exige anon|public DESPUÉS del `to`).
    expect(
      anonGrantOffenders(
        "revoke all on function public.f(text) from public; revoke all on function public.f(text) from anon, authenticated;",
      ),
    ).toHaveLength(0);
    // (g) grant a un rol NO-anon/public con nombres schema-qualified `public.…`
    // en la sentencia → NO offender (cero falsos positivos sobre el idiom real).
    expect(
      anonGrantOffenders(
        "grant execute on function public.f(text) to service_role;",
      ),
    ).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// (A2) Guard — toda entrada del allowlist existe en migraciones (Direction-B, SC#3)
//
// Direction-A (Block B arriba) verifica: servida ⊆ allowlist (RPC llamada desde el
// árbol público → debe estar en PUBLIC_RPC_ALLOWLIST).
// Direction-B (este bloque) verifica: allowlist ⊆ definidas (cada entrada del
// allowlist debe tener una función `create (or replace) function` en alguna migración).
//
// Regex CRÍTICO: `public.` es OPCIONAL (`(?:public\.)?`) porque match_proyectos,
// parlamentario_publico y parlamentarios_publico se definen SIN el qualifier `public.`
// (0011:55, 0020:28, 0026:30). Un regex que exija `public.` produce 3 falsos orphans
// y llevaría a relajar o borrar el guard perdiendo la protección.
//
// Scope: repo-wide (TODAS las migraciones, sin filtro >0044) porque las 3 RPCs
// mencionadas son pre-0044 y siguen en el allowlist (sus definiciones deben respaldarse).
// ---------------------------------------------------------------------------

/**
 * Detector puro y testeable: recolecta todos los nombres de función SQL definidos
 * en las migraciones (repo-wide). Usado por Direction-B y su mutation self-check.
 */
function definedRpcNames(migrationsDir: string): Set<string> {
  const defined = new Set<string>();
  for (const f of readdirSync(migrationsDir).filter((x) => x.endsWith(".sql"))) {
    const sql = stripSqlComments(
      readFileSync(path.join(migrationsDir, f), "utf-8"),
    );
    for (const m of sql.matchAll(
      /create\s+(?:or\s+replace\s+)?function\s+(?:public\.)?(\w+)/gi,
    )) {
      defined.add(m[1]);
    }
  }
  return defined;
}

describe("(A2) Guard — toda entrada del allowlist existe en migraciones (Direction-B, SC#3)", () => {
  it("sanity: definedRpcNames encontró al menos 20 funciones (el glob no está vacío)", () => {
    expect(definedRpcNames(MIGRATIONS_DIR).size).toBeGreaterThan(20);
  });

  it("toda entrada de PUBLIC_RPC_ALLOWLIST corresponde a una función definida en migraciones (SC#3 Direction-B)", () => {
    const defined = definedRpcNames(MIGRATIONS_DIR);
    const orphans = [...PUBLIC_RPC_ALLOWLIST].filter((n) => !defined.has(n));
    expect(
      orphans,
      `Allowlist con entradas sin función en supabase/migrations/ (typo/stale): [${orphans.join(", ")}] — corrige el nombre o elimina la entrada`,
    ).toHaveLength(0);
  });

  it("Direction-B self-check: detecta entrada fantasma en allowlist (SC#4)", () => {
    // Allowlist sintético con una entrada inventada, set de funciones definidas vacío.
    // Prueba que el guard MUERDE — no es un no-op verde vacío.
    const ghostAllowlist = new Set(["funcion_fantasma_typo"]);
    const emptyDefined = new Set<string>();
    const orphans = [...ghostAllowlist].filter((n) => !emptyDefined.has(n));
    expect(orphans).toHaveLength(1);
    expect(orphans[0]).toBe("funcion_fantasma_typo");
  });
});

// ---------------------------------------------------------------------------
// (A3) Guard — cross-links via crossLinkReader ⊆ allowlist (SC#1/SC#3)
//
// BLIND-SPOT de Direction-A (Block B): el rpcPattern=/\.rpc\(\s*['"`](\w+)['"`]/g
// matchea `.rpc("literal")` pero NO matchea `crossLinkReader("literal")`, que llama
// `.rpc(rpc)` con una VARIABLE (app/parlamentario/[id]/page.tsx:185-199). Los 4 RPCs
// de cross-link aparecen sólo como argumento de `crossLinkReader("...")` en las
// líneas 196-199, por lo que Block B los MISS.
//
// Este bloque (A3) cierra el hueco: extrae los literales de `crossLinkReader("...")`
// del call site y verifica que todos estén en PUBLIC_RPC_ALLOWLIST. Si en el futuro
// se añade un 5° cross-link vía este helper, (A3) lo atrapa.
// ---------------------------------------------------------------------------

/**
 * Detector puro: extrae los nombres de RPC pasados como literales a crossLinkReader().
 * Testeable con fixtures en memoria (mutation self-check, SC#4).
 */
function crossLinkRpcNames(tsSource: string): string[] {
  const names: string[] = [];
  for (const m of tsSource.matchAll(/crossLinkReader\(\s*['"`](\w+)['"`]\)/g)) {
    names.push(m[1]);
  }
  return names;
}

describe("(A3) Guard — cross-links via crossLinkReader ⊆ allowlist (SC#1/SC#3)", () => {
  const crossLinkPage = path.join(
    APP_ROOT,
    "app",
    "parlamentario",
    "[id]",
    "page.tsx",
  );

  it("sanity: el archivo de cross-links tiene al menos 4 literales de crossLinkReader", () => {
    const source = readFileSync(crossLinkPage, "utf-8");
    const names = crossLinkRpcNames(source);
    expect(names.length).toBeGreaterThanOrEqual(4);
  });

  it("todos los literales de crossLinkReader(\"...\") están en PUBLIC_RPC_ALLOWLIST (SC#1/SC#3)", () => {
    const source = readFileSync(crossLinkPage, "utf-8");
    const names = crossLinkRpcNames(source);
    const offenders = names.filter((n) => !PUBLIC_RPC_ALLOWLIST.has(n));
    expect(
      offenders,
      `crossLinkReader llama RPCs no-allowlisted (escapan al rpcPattern estático de Block B): [${offenders.join(", ")}] — añáde la RPC a PUBLIC_RPC_ALLOWLIST si es PII-safe`,
    ).toHaveLength(0);
  });

  it("crossLinkReader self-check: detecta un literal no-listado en fixture EN MEMORIA (SC#4)", () => {
    // Fixture sintético con una RPC que no está en el allowlist.
    const fixture = `const x = crossLinkReader("rpc_no_listada");`;
    const names = crossLinkRpcNames(fixture);
    expect(names).toContain("rpc_no_listada");
    const offenders = names.filter((n) => !PUBLIC_RPC_ALLOWLIST.has(n));
    expect(offenders).toContain("rpc_no_listada");
  });
});

// ---------------------------------------------------------------------------
// (B) [Camino A] El arbol publico server-side no accede a tablas PII directas
// ---------------------------------------------------------------------------

describe("(B) Guard — el arbol publico (service-role) no toca tablas PII", () => {
  const sourceFiles = walkSourceFiles(APP_ROOT);

  it("escanea al menos los modulos del sitio (sanity: el walker encontro archivos)", () => {
    expect(sourceFiles.length).toBeGreaterThan(10);
  });

  it("ningun archivo fuera de la superficie admin gateada hace `.from('<tabla_pii>')`", () => {
    const offenders: string[] = [];
    for (const file of sourceFiles) {
      if (isAdminAllowlisted(file)) continue;
      const stripped = stripTsComments(readFileSync(file, "utf-8"));
      for (const table of PII_TABLES) {
        const pattern = new RegExp(
          `\\.from\\(\\s*['"\`]${table}['"\`]\\s*\\)`,
          "i",
        );
        if (pattern.test(stripped)) {
          const rel = path.relative(APP_ROOT, file).split(path.sep).join("/");
          offenders.push(`${rel} -> ${table}`);
        }
      }
    }
    expect(
      offenders,
      `Acceso directo a tabla PII desde el arbol publico (service_role bypassa RLS): ` +
        `[${offenders.join("; ")}]. Lee via RPC PII-safe o por createAdminSupabase() ` +
        `detras del gate admin.`,
    ).toHaveLength(0);
  });

  it("ningun archivo del arbol publico invoca un `.rpc()` fuera del allowlist PII-safe", () => {
    const offenders: string[] = [];
    // Scan sobre el contenido completo (no linea-a-linea) para capturar
    // llamadas `.rpc(\n  "nombre"` multilinea.
    const rpcPattern = /\.rpc\(\s*['"`]([a-zA-Z_][\w]*)['"`]/g;
    for (const file of sourceFiles) {
      if (isAdminAllowlisted(file)) continue;
      const stripped = stripTsComments(readFileSync(file, "utf-8"));
      let m: RegExpExecArray | null;
      rpcPattern.lastIndex = 0;
      while ((m = rpcPattern.exec(stripped)) !== null) {
        const name = m[1];
        if (!PUBLIC_RPC_ALLOWLIST.has(name)) {
          const rel = path.relative(APP_ROOT, file).split(path.sep).join("/");
          offenders.push(`${rel} -> ${name}`);
        }
      }
    }
    expect(
      offenders,
      `RPC no-allowlisted invocado desde el arbol publico (service_role puede ejecutar ` +
        `admin/write RPCs que la DB ya no bloquea): [${offenders.join("; ")}]. ` +
        `Si es PII-safe agregalo a PUBLIC_RPC_ALLOWLIST; si es admin, muevelo tras el gate.`,
    ).toHaveLength(0);
  });

  it("el chokepoint publico supabase.ts no proyecta columnas PII conocidas (rut, donante_id)", () => {
    const stripped = stripTsComments(readFileSync(SUPABASE_TS, "utf-8"));
    const PII_COLUMNS = ["rut", "donante_id"];
    const hits: string[] = [];
    for (const col of PII_COLUMNS) {
      const pattern = new RegExp(`\\.select\\([^)]*\\b${col}\\b[^)]*\\)`, "i");
      if (pattern.test(stripped)) hits.push(col);
    }
    expect(hits, `app/lib/supabase.ts proyecta columnas PII: [${hits.join(", ")}]`).toHaveLength(0);
  });
});
