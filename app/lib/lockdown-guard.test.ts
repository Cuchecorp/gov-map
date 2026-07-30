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

// (Block D/E, Phase 103) El helper service_role DEDICADO de lookup de tokens/suscripciones
// (`app/lib/notif-service.ts`, creado en Plan 03) es el ÚNICO punto sancionado de acceso
// service_role a tablas de usuario. La prohibición de `.from('<tabla_de_usuario>')` está
// SCOPEADA a `app/lib/supabase.ts` (el chokepoint público, espejo de cómo supabase.ts es el
// chokepoint público de PII); notif-service.ts queda explícitamente tolerado. Si una fase
// futura ensancha el scan de `.from()` de tablas de usuario al árbol `app/` completo, DEBE
// saltar esta ruta (mismo idiom que isAdminAllowlisted para PII).
const NOTIF_SERVICE_TS = path.join(APP_ROOT, "lib", "notif-service.ts");

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
//
// (Phase 123, gate del `supabase-reviewer`) Las cuatro ultimas se anadieron al
// cerrar el hueco de cobertura que el gate declaro BLOQUEANTE: tienen columnas
// de clase RUT en el catalogo vivo de `public` y NO estaban en esta lista, asi
// que un `.from("pii_contraparte_declaracion")` en el arbol publico habria
// pasado el guard en VERDE exponiendo RUTs (service_role bypassa RLS, Q-23).
// Ninguna se referencia hoy desde `app/` (verificado). La aserción de
// completitud (A7) impide que el hueco se reabra.
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
  "pii_contraparte_declaracion", // ← Phase 123 (rut_contraparte)
  "contratista", // ← Phase 123 (rut_proveedor)
  "contrato", // ← Phase 123 (rut_proveedor)
  "declaracion_accion_derecho", // ← Phase 123 (rut_juridica)
];

// (Block D/E, Phase 103) Tablas de-usuario allowlisted para el rol `authenticated`.
// El rol `authenticated` aparece por PRIMERA vez en esta fase (Pitfall 1: el guard
// anon/public es CIEGO a `to authenticated`). Block D invierte a allowlist POSITIVA:
// un `grant/create policy … to authenticated` cuya tabla objetivo NO esté aquí es un
// offender. `suscripcion`/`consentimiento` son las tablas RLS de-usuario (own-row).
// `notificacion_envio` (cola de envío) NO va aquí: es service_role-only (Block E) —
// ningún grant a `authenticated` es legítimo sobre ella.
const USER_OWNED_TABLES = new Set(["suscripcion", "consentimiento"]);

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
  "actualidad_senales_panel",
  "agregado_por_contraparte",
  "aportes_de_parlamentario",
  "bienes_de_parlamentario",
  "buscar_citaciones",
  "buscar_proyectos_hibrido",
  "co_comisionados_de_parlamentario",
  "coautores_de_parlamentario",
  "coautores_de_parlamentario_v2", // ← NEW (debe existir en supabase/migrations/0083_*.sql — firma v2 paralela, membresia de par completa)
  "coincidencia_votos_par", // ← NEW (debe existir en supabase/migrations/0068_*.sql — Direction-B; consumida en Plan 03)
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
  "militancia_historica_compartida", // ← NEW (debe existir en supabase/migrations/0067_*.sql, consumida en Plan 03)
  "militancias_de_parlamentario",
  "parlamentario_publico",
  "parlamentario_publico_v2",
  "parlamentarios_publico",
  "parlamentarios_publico_v2",
  "subgrafo_red",
  "votos_conteo_de_parlamentario", // ← NEW (debe existir en supabase/migrations/0082_*.sql — conteo agregado sobre el universo completo, Phase 130 Plan 02)
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

/**
 * (Block D/E, Phase 103) — Clona `anonGrantOffenders` pero INVIERTE la lógica a una
 * allowlist POSITIVA para el rol `authenticated` (nuevo en esta fase; el guard anon/public
 * es ciego a él — Pitfall 1). Una sentencia `grant … to authenticated` O
 * `create policy … to authenticated` cuya TABLA OBJETIVO no esté en `allowlist`
 * (USER_OWNED_TABLES) es un offender:
 *
 *   - Block D: over-grant a una tabla NO-de-usuario (ej. `to authenticated` sobre `proyecto`).
 *   - Block E: `notificacion_envio` (cola service_role-only) NUNCA está en la allowlist ⇒
 *     cualquier grant/policy a `authenticated` sobre ella cae automáticamente como offender.
 *
 * Extracción de la tabla objetivo por sentencia:
 *   - `grant <privs> on [table] public.<tabla> to authenticated` → token tras `on [table] public.`
 *     (el qualifier `public.` es opcional; `table`/`sequence`/`all tables in schema` no aplican
 *     al idiom real de estas migraciones, pero el regex tolera `public.` ausente).
 *   - `create policy <n> on public.<tabla> for … to authenticated …` → token tras `on public.`
 *     y antes de `for`/`to`/`as`/`using`/`with`.
 *
 * Recibe el SQL YA con comentarios stripeados y en minúscula (mismo contrato que
 * `anonGrantOffenders`) — `stripSqlComments` elimina `-- grant … to authenticated` antes del
 * scan, así que un comentario NO dispara. Por-sentencia (`split(";")`) para reportar el
 * offender exacto.
 */
function authenticatedGrantOffenders(
  strippedLowerSql: string,
  allowlist: Set<string>,
): string[] {
  const offenders: string[] = [];
  const grantToAuth =
    /grant\s+\S[\s\S]*?\bto\s+[\w,\s]*\bauthenticated\b/;
  const policyToAuth =
    /create\s+policy\s+[\s\S]*?\bto\s+[\w,\s]*\bauthenticated\b/;
  // Tabla de un GRANT: token tras `on [table|sequence] [public.]` (qualifier opcional).
  const grantTable =
    /\bon\s+(?:table\s+|sequence\s+)?(?:public\.)?([a-z_][\w]*)/;
  // Tabla de un CREATE POLICY: token tras `on [public.]`, antes de for/to/as/using/with.
  const policyTable =
    /create\s+policy\s+[\s\S]*?\bon\s+(?:public\.)?([a-z_][\w]*)/;

  for (const stmt of strippedLowerSql.split(";")) {
    const isGrant = grantToAuth.test(stmt);
    const isPolicy = policyToAuth.test(stmt);
    if (!isGrant && !isPolicy) continue;
    const m = isPolicy
      ? policyTable.exec(stmt)
      : grantTable.exec(stmt);
    const table = m ? m[1] : null;
    // Si no logramos extraer la tabla, o la tabla NO está allowlisted → offender.
    if (!table || !allowlist.has(table)) {
      offenders.push(stmt.trim().replace(/\s+/g, " ").slice(0, 100));
    }
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
// (D) Guard — `to authenticated` SOLO sobre tablas de-usuario allowlisted (Phase 103)
//
// El rol `authenticated` aparece por PRIMERA vez en esta fase. El guard anon/public (A)
// es CIEGO a `to authenticated` (Pitfall 1): una migración >0044 podría `grant all on
// <tabla_no_de_usuario> to authenticated` y pasar CI verde. Block D invierte a allowlist
// POSITIVA: un `grant/create policy … to authenticated` cuya tabla objetivo NO esté en
// USER_OWNED_TABLES (suscripcion/consentimiento) es offender. Se escribe RED-first: hoy
// no hay migración >0068 con `to authenticated`, así que el scan da 0 offenders; MUERDE
// en cuanto Plan 02 escriba un grant fuera de la allowlist.
// ---------------------------------------------------------------------------

describe("(D) Guard — `to authenticated` SOLO sobre tablas de-usuario allowlisted (Phase 103)", () => {
  const LOCKDOWN_CUTOFF = 44;

  const futureMigrations = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .filter((f) => {
      const n = migrationNumber(f);
      return n !== null && n > LOCKDOWN_CUTOFF;
    })
    .sort();

  it("USER_OWNED_TABLES contiene EXACTAMENTE suscripcion y consentimiento (NO notificacion_envio)", () => {
    expect([...USER_OWNED_TABLES].sort()).toEqual(["consentimiento", "suscripcion"]);
    // Block E: la cola de envío es service_role-only; jamás allowlisted para authenticated.
    expect(USER_OWNED_TABLES.has("notificacion_envio")).toBe(false);
  });

  it("ninguna migracion > 0044 concede `authenticated` sobre una tabla fuera de USER_OWNED_TABLES", () => {
    const offenders: string[] = [];
    for (const filename of futureMigrations) {
      const raw = readFileSync(`${MIGRATIONS_DIR}/${filename}`, "utf-8");
      const stripped = stripSqlComments(raw).toLowerCase();
      for (const off of authenticatedGrantOffenders(stripped, USER_OWNED_TABLES)) {
        offenders.push(`${filename}: ${off}`);
      }
    }
    expect(
      offenders,
      `Migraciones con GRANT/POLICY a authenticated fuera de la allowlist de tablas-de-usuario ` +
        `(over-grant al rol authenticated — Pitfall 1): [${offenders.join(", ")}] — ` +
        `authenticated solo puede tocar suscripcion/consentimiento (own-row RLS); si la tabla ` +
        `es de-usuario legítima, añádela a USER_OWNED_TABLES.`,
    ).toHaveLength(0);
  });

  it("mutation self-check: authenticatedGrantOffenders MUERDE por fixture (proyecto+notificacion_envio) y tolera suscripcion", () => {
    // Ejercita el detector REAL (mismo objeto de función) sobre SQL en memoria — un no-op
    // verde es imposible. Espeja el idiom del self-check de Direction-B (parseDefinedRpcNames).
    const norm = (sql: string) => stripSqlComments(sql).toLowerCase();

    // (a) grant sobre tabla NO-de-usuario → offender (Block D).
    expect(
      authenticatedGrantOffenders(
        norm("grant select on public.proyecto to authenticated;"),
        USER_OWNED_TABLES,
      ),
    ).toHaveLength(1);

    // (b) grant sobre notificacion_envio → offender (Block E: cola service_role-only).
    expect(
      authenticatedGrantOffenders(
        norm("grant insert on public.notificacion_envio to authenticated;"),
        USER_OWNED_TABLES,
      ),
    ).toHaveLength(1);

    // (c) create policy own-row sobre suscripcion → NO offender (allowlisted).
    expect(
      authenticatedGrantOffenders(
        norm(
          "create policy x on suscripcion for select to authenticated using ((select auth.uid()) = user_id);",
        ),
        USER_OWNED_TABLES,
      ),
    ).toHaveLength(0);

    // (d) create policy sobre consentimiento → NO offender (allowlisted).
    expect(
      authenticatedGrantOffenders(
        norm(
          "create policy c on public.consentimiento for insert to authenticated with check ((select auth.uid()) = user_id);",
        ),
        USER_OWNED_TABLES,
      ),
    ).toHaveLength(0);

    // (e) comentario SQL `-- grant … to authenticated` → 0 offenders (stripSqlComments lo borra).
    expect(
      authenticatedGrantOffenders(
        norm("-- grant select on public.proyecto to authenticated\nselect 1;"),
        USER_OWNED_TABLES,
      ),
    ).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// (E) Guard — notificacion_envio: CERO grant a authenticated (cola service_role-only)
//
// Cae automáticamente de Block D (notificacion_envio NO está en USER_OWNED_TABLES), pero
// se afirma EXPLÍCITAMENTE con un fixture nombrado: la cola de envío del digest se drena
// SOLO por el cron service_role; el rol authenticated no debe tener NINGÚN privilegio
// sobre ella. Un grant a authenticated en notificacion_envio es siempre offender.
// ---------------------------------------------------------------------------

describe("(E) Guard — notificacion_envio es service_role-only (CERO grant a authenticated)", () => {
  it("un `grant … on notificacion_envio to authenticated` es SIEMPRE offender (Block E)", () => {
    const norm = (sql: string) => stripSqlComments(sql).toLowerCase();
    for (const priv of ["select", "insert", "update", "delete", "all"]) {
      expect(
        authenticatedGrantOffenders(
          norm(`grant ${priv} on public.notificacion_envio to authenticated;`),
          USER_OWNED_TABLES,
        ),
        `grant ${priv} on notificacion_envio to authenticated debe ser offender`,
      ).toHaveLength(1);
    }
  });

  it("ninguna migracion > 0044 concede authenticated sobre notificacion_envio (scan real)", () => {
    const offenders: string[] = [];
    const migs = readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith(".sql"))
      .filter((f) => {
        const n = migrationNumber(f);
        return n !== null && n > 44;
      });
    const patron =
      /(?:grant\s+\S[\s\S]*?\bon\s+(?:table\s+)?(?:public\.)?notificacion_envio|create\s+policy\s+[\s\S]*?\bon\s+(?:public\.)?notificacion_envio)[\s\S]*?\bto\s+[\w,\s]*\bauthenticated\b/;
    for (const filename of migs) {
      const stripped = stripSqlComments(
        readFileSync(`${MIGRATIONS_DIR}/${filename}`, "utf-8"),
      ).toLowerCase();
      for (const stmt of stripped.split(";")) {
        if (patron.test(stmt)) offenders.push(`${filename}: ${stmt.trim().slice(0, 80)}`);
      }
    }
    expect(
      offenders,
      `notificacion_envio (cola service_role-only) recibe grant/policy a authenticated: ` +
        `[${offenders.join(", ")}] — la cola se drena SOLO por el cron service_role.`,
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
const RPC_DEF_REGEX =
  /create\s+(?:or\s+replace\s+)?function\s+(?:public\.)?(\w+)/gi;

function definedRpcNames(migrationsDir: string): Set<string> {
  const defined = new Set<string>();
  for (const f of readdirSync(migrationsDir).filter((x) => x.endsWith(".sql"))) {
    const sql = stripSqlComments(
      readFileSync(path.join(migrationsDir, f), "utf-8"),
    );
    for (const m of sql.matchAll(RPC_DEF_REGEX)) {
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

  it("Direction-B self-check: detecta entrada fantasma en allowlist ejercitando el detector REAL (SC#4)", () => {
    // Helper puro que aplica RPC_DEF_REGEX (el MISMO objeto regex del detector
    // real) sobre SQL en memoria. Si el regex se rompe (p.ej. se elimina
    // `(?:public\.)?` o `\w`), este test falla — sin copia que pueda derivar.
    function parseDefinedRpcNames(sql: string): Set<string> {
      const out = new Set<string>();
      for (const m of stripSqlComments(sql).matchAll(RPC_DEF_REGEX)) {
        out.add(m[1]);
      }
      return out;
    }

    // Fixture: migración sintética con UNA función definida.
    const sqlWithOneFunction =
      "create or replace function public.solo_esta(p_id text) returns table(x int) language sql as $$ select 1; $$;";

    // El detector REAL reconoce la función definida en el fixture.
    const defined = parseDefinedRpcNames(sqlWithOneFunction);
    expect(defined).toContain("solo_esta");

    // Allowlist fantasma con una entrada que NO existe en el fixture.
    const ghostAllowlist = new Set(["funcion_fantasma_typo"]);
    const orphans = [...ghostAllowlist].filter((n) => !defined.has(n));

    // El filtro de huérfanos caza al fantasma — el guard MUERDE.
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

  // (Block D/E, Phase 103) — El chokepoint público `app/lib/supabase.ts` NUNCA toca las
  // tablas de-usuario ni la cola de envío. El acceso service_role a tablas de-usuario vive
  // SOLO en el helper dedicado `app/lib/notif-service.ts` (Plan 03) — que NO se escanea aquí
  // (el scan está scopeado a SUPABASE_TS), quedando tolerado por construcción.
  it("el chokepoint supabase.ts nunca hace .from('suscripcion'|'consentimiento'|'notificacion_envio')", () => {
    const stripped = stripTsComments(readFileSync(SUPABASE_TS, "utf-8"));
    const hits: string[] = [];
    for (const table of ["suscripcion", "consentimiento", "notificacion_envio"]) {
      const pattern = new RegExp(
        `\\.from\\(\\s*['"\`]${table}['"\`]\\s*\\)`,
        "i",
      );
      if (pattern.test(stripped)) hits.push(table);
    }
    expect(
      hits,
      `app/lib/supabase.ts (chokepoint público) accede tablas de-usuario/cola: [${hits.join(", ")}]. ` +
        `El acceso service_role a suscripcion/consentimiento vive SOLO en app/lib/notif-service.ts (Plan 03); ` +
        `notificacion_envio es cron-only.`,
    ).toHaveLength(0);
  });

  it("ningun archivo del arbol app/ hace .from('notificacion_envio') (cola cron-only, service_role)", () => {
    const offenders: string[] = [];
    const pattern = /\.from\(\s*['"`]notificacion_envio['"`]\s*\)/i;
    for (const file of sourceFiles) {
      const stripped = stripTsComments(readFileSync(file, "utf-8"));
      if (pattern.test(stripped)) {
        const rel = path.relative(APP_ROOT, file).split(path.sep).join("/");
        offenders.push(rel);
      }
    }
    expect(
      offenders,
      `Acceso a la cola notificacion_envio desde app/ (es cron-only, service_role): ` +
        `[${offenders.join("; ")}]. La cola se drena SOLO desde el CLI del digest (packages/notificaciones).`,
    ).toHaveLength(0);
  });

  it("app/lib/notif-service.ts (Plan 03) NO es flaggeado por la prohibición de tablas de-usuario (tolerancia explícita)", () => {
    // La prohibición de `.from('suscripcion'|'consentimiento')` está SCOPEADA a SUPABASE_TS;
    // notif-service.ts es el ÚNICO punto service_role sancionado (allowlist NOTIF_SERVICE_TS).
    // Aunque el archivo aún no exista (lo crea Plan 03), la ruta allowlisted está declarada;
    // este assert documenta el contrato: si un scan futuro se ensancha a app/, DEBE saltar esta ruta.
    const rel = path.relative(APP_ROOT, NOTIF_SERVICE_TS).split(path.sep).join("/");
    expect(rel).toBe("lib/notif-service.ts");
    // El chokepoint escaneado (SUPABASE_TS) y el helper tolerado (NOTIF_SERVICE_TS) son distintos.
    expect(NOTIF_SERVICE_TS).not.toBe(SUPABASE_TS);
  });
});

// ===========================================================================
// EXTENSIÓN Phase 123 (plan 123-05) — "guard primero", ANTES de que la Phase
// 124 toque estructura de datos.
//
// La auditoría SUPA-AUDIT (fragmentos 01/02/03) enumeró la DB VIVA de PROD y
// contrastó cada eje contra este guard. Donde el guard decía "0 offenders" y el
// catálogo mostraba superficie, hay un PUNTO CIEGO: un fix futuro podría
// reintroducir el mismo defecto y pasar CI verde. Tres offenders salieron con
// `destino: guard` y los cierran los bloques (A4), (A5) y (A6) de abajo.
//
// LÍMITE RECTOR, declarado (ci.yml: "Sin secrets de DB: los guards son
// estáticos"): CI NO tiene acceso a Postgres. Todo lo de abajo es ESTÁTICO
// sobre el texto de `supabase/migrations/*.sql`. Por tanto NO puede ver:
//   - el default-ACL vivo de `supabase_admin` sobre `public` (Q-10)
//   - las 1.209 funciones de extensión exec-anon ya instaladas (Q-24b)
//   - el `USAGE TO PUBLIC` sobre `public`/`net` (Q-11, Q-22b)
//   - el `EXECUTE TO PUBLIC` ya materializado sobre las 8 fn de Q-15
// Esa mitad la cierra la Phase 124. Extender el guard NO cierra los offenders
// existentes: IMPIDE LA REGRESIÓN FUTURA. Ver
// `.planning/phases/123-supa-audit-*/123-SUPA-AUDIT-04-GUARDS.md` §Límites.
//
// NOTA sobre Direction-C (descartada con evidencia, NO por omisión): un chequeo
// «`grant execute … to anon` ⊆ PUBLIC_RPC_ALLOWLIST» sería estrictamente MÁS
// DÉBIL que el Block A ya existente (que prohíbe TODO grant a anon en >0044,
// allowlisted o no — ver su caso (a) de fixture), y aplicado repo-wide daría 9
// falsos positivos (los grants de 0011–0024 revocados después por 0044/0045;
// la DB viva da exec_anon=f para las nueve). Además PUBLIC_RPC_ALLOWLIST
// gobierna `service_role`, NO `anon` (ver su doc en :180-182).
// ===========================================================================

/** Migraciones con número > LOCKDOWN_CUTOFF, leídas una sola vez. */
const LOCKDOWN_CUTOFF_123 = 44;

function readFutureMigrations(): { filename: string; sql: string }[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .filter((f) => {
      const n = migrationNumber(f);
      return n !== null && n > LOCKDOWN_CUTOFF_123;
    })
    .sort()
    .map((filename) => ({
      filename,
      // Mismo contrato que anonGrantOffenders: SQL ya stripeado y en minúscula.
      sql: stripSqlComments(
        readFileSync(path.join(MIGRATIONS_DIR, filename), "utf-8"),
      ).toLowerCase(),
    }));
}

// ---------------------------------------------------------------------------
// (A4) `ALTER DEFAULT PRIVILEGES … GRANT … TO anon|public|authenticated`
//      — cierra OFF-02 (fragmento 01, Q-10)
//
// La superficie a `anon` puede abrirse SIN UN SOLO `GRANT` sobre un objeto
// concreto: `ALTER DEFAULT PRIVILEGES` concede sobre objetos FUTUROS. Q-10 lo
// demuestra en PROD: `alter default privileges for role supabase_admin in
// schema public` sigue concediendo `arwdDxtm` a anon/authenticated sobre toda
// tabla futura — 0044 revocó el default de `postgres` y NO tocó ése. Ninguna
// línea de código del repo lo delata, y el guard no tenía NINGUNA aserción
// sobre esta clase de sentencia.
//
// Por qué un bloque propio y no confiar en Block A/D: hoy `anonGrantOffenders`
// matchea INCIDENTALMENTE la variante `… grant select on tables to anon` (su
// regex solo exige `grant … to anon`), y `authenticatedGrantOffenders` la
// variante `to authenticated`. Eso es coincidencia de regex, no cobertura: el
// mensaje de fallo hablaría de "GRANT a anon sobre una tabla" cuando el defecto
// real es un default-ACL sobre objetos FUTUROS, y una reescritura del regex de
// Block A la perdería en silencio. Este bloque NOMBRA el vector.
// ---------------------------------------------------------------------------

/**
 * Detector puro: sentencias `alter default privileges` que CONCEDEN a un rol
 * público (`anon`, `public` o `authenticated`).
 *
 * Recibe el SQL YA stripeado de comentarios y en minúscula (mismo contrato que
 * `anonGrantOffenders` / `authenticatedGrantOffenders`). Decisión POR-SENTENCIA
 * (`split(";")`) para reportar el offender exacto.
 *
 * `alter default privileges … REVOKE all … from anon` NO matchea (no contiene
 * `grant`) — es justamente el idiom legítimo de 0044:185-187.
 */
function alterDefaultPrivilegesOffenders(strippedLowerSql: string): string[] {
  const offenders: string[] = [];
  const isAdp = /alter\s+default\s+privileges/;
  const grantsToPublicRole =
    /\bgrant\b[\s\S]*?\bto\s+[\w,\s]*\b(?:anon|public|authenticated)\b/;
  for (const stmt of strippedLowerSql.split(";")) {
    if (!isAdp.test(stmt)) continue;
    if (!grantsToPublicRole.test(stmt)) continue;
    offenders.push(stmt.trim().replace(/\s+/g, " ").slice(0, 120));
  }
  return offenders;
}

describe("(A4) Guard — ningun `ALTER DEFAULT PRIVILEGES … GRANT` a rol publico (OFF-02, Phase 123)", () => {
  const futureMigrations = readFutureMigrations();

  it("sanity: el set de migraciones > 0044 no esta vacio (el glob resuelve)", () => {
    expect(futureMigrations.length).toBeGreaterThan(0);
  });

  it("ninguna migracion > 0044 emite `alter default privileges … grant … to anon/public/authenticated`", () => {
    const offenders: string[] = [];
    for (const { filename, sql } of futureMigrations) {
      for (const off of alterDefaultPrivilegesOffenders(sql)) {
        offenders.push(`${filename}: ${off}`);
      }
    }
    expect(
      offenders,
      `ALTER DEFAULT PRIVILEGES concediendo a un rol publico (OFF-02: abre TODA tabla/funcion ` +
        `FUTURA de public a anon sin que exista un solo GRANT que lo delate; anon ya tiene USAGE ` +
        `sobre el esquema, Q-11): [${offenders.join(", ")}] — elimina el ALTER DEFAULT PRIVILEGES. ` +
        `El unico idiom legitimo es el REVOKE de 0044 (…revoke all on tables from anon, authenticated).`,
    ).toHaveLength(0);
  });

  it("mutation self-check (A4): el detector MUERDE por fixture y tolera el REVOKE legitimo", () => {
    const norm = (sql: string) => stripSqlComments(sql).toLowerCase();

    // (a) POSITIVO — las tres variantes de rol publico y los tres tipos de objeto.
    expect(
      alterDefaultPrivilegesOffenders(
        norm(
          "alter default privileges in schema public grant select on tables to anon;",
        ),
      ),
    ).toHaveLength(1);
    expect(
      alterDefaultPrivilegesOffenders(
        norm(
          "alter default privileges for role supabase_admin in schema public grant all on tables to public;",
        ),
      ),
    ).toHaveLength(1);
    expect(
      alterDefaultPrivilegesOffenders(
        norm(
          "alter default privileges in schema public grant execute on functions to authenticated;",
        ),
      ),
    ).toHaveLength(1);
    // El offender reportado nombra la sentencia (mensaje accionable).
    expect(
      alterDefaultPrivilegesOffenders(
        norm(
          "alter default privileges in schema public grant usage on sequences to anon;",
        ),
      )[0],
    ).toContain("alter default privileges");

    // (b) NEGATIVO — el REVOKE de 0044 (idiom legitimo) y un grant a service_role.
    expect(
      alterDefaultPrivilegesOffenders(
        norm(
          "alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;",
        ),
      ),
    ).toHaveLength(0);
    expect(
      alterDefaultPrivilegesOffenders(
        norm(
          "alter default privileges for role postgres in schema public grant all on tables to service_role;",
        ),
      ),
    ).toHaveLength(0);
    // Un GRANT normal (sin ALTER DEFAULT PRIVILEGES) no es asunto de este bloque: lo caza Block A.
    expect(
      alterDefaultPrivilegesOffenders(
        norm("grant select on public.parlamentario to anon;"),
      ),
    ).toHaveLength(0);

    // (c) COMENTARIO — la prosa de un header NO auto-invalida el guard.
    // (0044:76-78 documenta el ROLLBACK con exactamente estas lineas comentadas.)
    expect(
      alterDefaultPrivilegesOffenders(
        norm(
          "-- alter default privileges in schema public grant select on tables to anon\nselect 1;",
        ),
      ),
    ).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// (A5) Toda `CREATE FUNCTION` en `public` lleva su `REVOKE EXECUTE … FROM PUBLIC`
//      — cierra OFF-4-05 (fragmento 02, Q-15 + comm -13)
//
// Postgres concede `EXECUTE TO PUBLIC` por DEFAULT a toda funcion nueva, y anon
// es miembro implicito de `public`. Q-15 encontro 8 funciones de public con ACL
// `=X/postgres` (= el default nunca revocado) => exec-anon en la DB viva, fuera
// de PUBLIC_RPC_ALLOWLIST y fuera de todo guard. Direction-B solo verifica que
// la allowlist tenga funcion DEFINIDA; nunca mira grants. Ese es el defecto
// exacto que produjo OFF-4-01 (f_unaccent) y OFF-4-02 (las 7 RETURNS trigger).
// ---------------------------------------------------------------------------

/** Regex de `create [or replace] function [<schema>.]<nombre>(` con captura del schema. */
const CREATE_FUNCTION_SCHEMA_REGEX =
  /create\s+(?:or\s+replace\s+)?function\s+(?:(\w+)\.)?(\w+)\s*\(/g;

/**
 * Detector puro: funciones creadas en `public` (schema ausente => public por
 * search_path, o `public.` explicito) para las que NINGUNA migracion del
 * conjunto emite un `revoke {all|execute} … on function [public.]<n>( … from …
 * public`.
 *
 * El revoke puede vivir en la MISMA migracion o en una POSTERIOR: es la unica
 * forma de que un fix aditivo futuro (Phase 124, 0073+) pueda limpiar la
 * baseline sin reescribir una migracion ya aplicada a PROD.
 *
 * Funciones de otros esquemas (`cruces.materializar_cruces`,
 * `actualidad.materializar_senales`) quedan FUERA por diseno: no viven en el
 * esquema que PostgREST expone.
 *
 * Recibe migraciones YA leidas, con el SQL stripeado y en minuscula.
 */
function missingRevokeFromPublicOffenders(
  migrations: { filename: string; sql: string }[],
): string[] {
  const offenders: string[] = [];
  const allSql = migrations.map((m) => m.sql).join("\n");
  for (const { filename, sql } of migrations) {
    CREATE_FUNCTION_SCHEMA_REGEX.lastIndex = 0;
    let m: RegExpExecArray | null;
    const seen = new Set<string>();
    while ((m = CREATE_FUNCTION_SCHEMA_REGEX.exec(sql)) !== null) {
      const schema = m[1];
      const name = m[2];
      if (schema && schema !== "public") continue;
      if (seen.has(name)) continue;
      seen.add(name);
      const revoke = new RegExp(
        "revoke\\s+(?:all|execute)[^;]*?\\bon\\s+function\\s+(?:public\\.)?" +
          name +
          "\\s*\\([^;]*?\\bfrom\\s+[\\w,\\s]*\\bpublic\\b",
      );
      if (!revoke.test(allSql)) offenders.push(`${filename}: ${name}`);
    }
  }
  return offenders;
}

/**
 * BASELINE CONGELADA — deuda REAL, visible en CI, NO una exencion muda.
 *
 * ── VACIA PORQUE LA DEUDA SE PAGO, no porque nunca hubiera habido deuda. ──
 *
 * Historia (no borrar: una baseline vacia sin historia es una baseline que se
 * olvida, y este comentario ES el registro del pago):
 *
 *   La unica entrada fue `"0055_busqueda_hibrida.sql: f_unaccent"`. `f_unaccent`
 *   era la unica funcion de `public` invocable por anon via
 *   POST /rest/v1/rpc/f_unaccent (Q-15 de 123-SUPA-AUDIT.md: ACL `=X/postgres`,
 *   el `EXECUTE TO PUBLIC` que Postgres concede por default y al que nunca se le
 *   aplico el revoke). Era OFF-4-01 / OFF-5-01, con `destino: 124-aditivo`. La
 *   Phase 123 tenia PROHIBIDO tocar `supabase/`, asi que la deuda se congelo
 *   aqui, a la vista, en vez de silenciarse dentro del detector.
 *
 *   PAGADA en la Phase 124 (wave 3) por `0076_revoke_execute_public_residual.sql`,
 *   aplicada a PROD: `revoke execute on function public.f_unaccent(text) from
 *   public` (+ `from anon, authenticated`, + `set search_path = ''`, + el mismo
 *   doble-revoke sobre las 7 funciones `RETURNS trigger` de OFF-4-02). Evidencia:
 *   Q-12 paso de 8/42 a 0/42 exec-anon; pgTAP post-apply 5 ok / 0 not ok.
 *   Al aparecer ese revoke, el detector dejo de reportar el offender y ESTE
 *   assert se puso ROJO — obligando a borrar la entrada. Eso fue el diseno.
 *
 * El assert de abajo sigue comparando por IGUALDAD, no por subconjunto, asi que
 * sigue mordiendo en AMBAS direcciones:
 *   - migracion futura que cree una fn de public sin su revoke => ROJO (regresion)
 *   - un revoke que cubra una entrada listada aqui             => ROJO tambien,
 *     obligando a borrarla y a dejar constancia de que se pago.
 * Vacia es el estado CORRECTO, no el estado por defecto: si algun dia vuelve a
 * tener entradas, es deuda nueva y debe llevar su propia historia escrita.
 */
const KNOWN_MISSING_REVOKE_FROM_PUBLIC: string[] = [];

describe("(A5) Guard — toda `create function` en public lleva su `revoke execute … from public` (OFF-4-05, Phase 123)", () => {
  const futureMigrations = readFutureMigrations();

  it("sanity: el detector ve funciones de public en las migraciones > 0044 (el scan no es vacuo)", () => {
    // Denominador explicito: un "0 offenders" sobre 0 objetos inspeccionados seria
    // un cero VACUO (nota anti-"todo bien" del fragmento 02, Q-17 vs Q-18).
    let publicFns = 0;
    for (const { sql } of futureMigrations) {
      CREATE_FUNCTION_SCHEMA_REGEX.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = CREATE_FUNCTION_SCHEMA_REGEX.exec(sql)) !== null) {
        if (!m[1] || m[1] === "public") publicFns++;
      }
    }
    expect(publicFns).toBeGreaterThan(20);
  });

  it("el set de funciones de public SIN `revoke … from public` es EXACTAMENTE la baseline congelada", () => {
    const offenders = missingRevokeFromPublicOffenders(futureMigrations).sort();
    expect(
      offenders,
      `Funciones de public sin su \`revoke execute … from public\` (OFF-4-05: Postgres concede ` +
        `EXECUTE TO PUBLIC por default y anon es miembro implicito de public => la funcion nace ` +
        `invocable por anon via /rest/v1/rpc/, fuera de PUBLIC_RPC_ALLOWLIST). ` +
        `Encontrado: [${offenders.join(", ")}] — esperado exactamente ` +
        `[${KNOWN_MISSING_REVOKE_FROM_PUBLIC.join(", ")}]. ` +
        `Si SOBRA una entrada: anade \`revoke execute on function public.<f>(<args>) from public;\` ` +
        `a tu migracion. Si FALTA una: la deuda se pago (Phase 124) — BORRA la entrada de ` +
        `KNOWN_MISSING_REVOKE_FROM_PUBLIC.`,
    ).toEqual([...KNOWN_MISSING_REVOKE_FROM_PUBLIC].sort());
  });

  it("mutation self-check (A5): el detector MUERDE por fixture en memoria y tolera el revoke y los otros esquemas", () => {
    const norm = (filename: string, sql: string) => [
      { filename, sql: stripSqlComments(sql).toLowerCase() },
    ];

    // (a) POSITIVO — create function en public SIN revoke => offender.
    expect(
      missingRevokeFromPublicOffenders(
        norm(
          "9001_fixture.sql",
          "create or replace function public.nueva_fn(p_id text) returns table(x int) language sql as $$ select 1; $$;",
        ),
      ),
    ).toEqual(["9001_fixture.sql: nueva_fn"]);
    // Sin qualifier de schema => resuelve a public por search_path => tambien offender.
    expect(
      missingRevokeFromPublicOffenders(
        norm(
          "9001_fixture.sql",
          "create function sin_qualifier(p_id text) returns int language sql as $$ select 1; $$;",
        ),
      ),
    ).toEqual(["9001_fixture.sql: sin_qualifier"]);

    // (b) NEGATIVO — la misma CON su revoke => 0 offenders.
    expect(
      missingRevokeFromPublicOffenders(
        norm(
          "9001_fixture.sql",
          "create or replace function public.nueva_fn(p_id text) returns table(x int) language sql as $$ select 1; $$;\n" +
            "revoke execute on function public.nueva_fn(text) from public;\n" +
            "revoke all on function public.nueva_fn(text) from anon, authenticated;",
        ),
      ),
    ).toHaveLength(0);
    // Funcion de OTRO esquema (no lo expone PostgREST) => fuera de alcance por diseno.
    expect(
      missingRevokeFromPublicOffenders(
        norm(
          "9001_fixture.sql",
          "create or replace function cruces.materializar_cruces() returns void language plpgsql as $$ begin end; $$;",
        ),
      ),
    ).toHaveLength(0);
    // El revoke puede venir en una migracion POSTERIOR (asi la Phase 124 podra limpiar la baseline).
    expect(
      missingRevokeFromPublicOffenders([
        {
          filename: "9001_fixture.sql",
          sql: "create function public.tardia(p text) returns int language sql as $$ select 1; $$;",
        },
        {
          filename: "9002_fixture.sql",
          sql: "revoke execute on function public.tardia(text) from public;",
        },
      ]),
    ).toHaveLength(0);

    // (c) COMENTARIO — un `create function` dentro de `-- …` no dispara.
    expect(
      missingRevokeFromPublicOffenders(
        norm(
          "9001_fixture.sql",
          "-- create or replace function public.solo_prosa(p text) returns int\nselect 1;",
        ),
      ),
    ).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// (A6) Allowlist de EXTENSIONES instalables en `public`
//      — cierra OFF-6-05c (fragmento 03, Q-24/Q-24b/Q-24c)
//
// El filtro `pg_depend deptype='e'` que usa toda la auditoria (correcto como
// regla) OCULTA la superficie de extensiones. Q-24b/Q-24c la destaparon: `pgtap`
// vive en `public` con 1.079 funciones EJECUTABLES por anon — ejecucion PROBADA
// (`set role anon; select public.pg_version()` -> 17.6), no inferida. La
// superficie anon real de public no son 8 funciones: son 1.209. Ni un solo test
// se pone rojo por ello.
//
// Este bloque no puede desinstalar nada (LIM-05-02: las ya instaladas no vienen
// de ninguna migracion del repo). Impide que UNA NUEVA entre por migracion.
// ---------------------------------------------------------------------------

/**
 * Extensiones toleradas en `public` — excepcion DOCUMENTADA, no descuido.
 * `vector` sostiene el tipo de columna de `proyecto_embedding` y el indice HNSW;
 * `unaccent` es la base de `f_unaccent` y del FTS. Moverlas de esquema romperia
 * tipos de columna, indices y firmas (OFF-6-02: "lo razonable es documentar la
 * excepcion, no mover"). Cualquier OTRA extension va a `extensions`.
 */
const PUBLIC_EXTENSION_ALLOWLIST = new Set(["vector", "unaccent"]);

/**
 * Detector puro: `create extension [if not exists] <nombre>` cuya clausula
 * `schema` esta AUSENTE (=> public por search_path) o es explicitamente
 * `public`, y cuyo nombre no esta allowlisted.
 *
 * Recibe el SQL YA stripeado y en minuscula. Por-sentencia (`split(";")`).
 */
function publicExtensionOffenders(
  strippedLowerSql: string,
  allowlist: Set<string>,
): string[] {
  const offenders: string[] = [];
  const createExt =
    /create\s+extension\s+(?:if\s+not\s+exists\s+)?"?([a-z0-9_]+)"?/;
  const schemaClause = /\bschema\s+"?([a-z0-9_]+)"?/;
  for (const stmt of strippedLowerSql.split(";")) {
    const m = createExt.exec(stmt);
    if (!m) continue;
    const name = m[1];
    const sm = schemaClause.exec(stmt.slice(m.index + m[0].length));
    const schema = sm ? sm[1] : "public"; // sin clausula => search_path => public
    if (schema !== "public") continue;
    if (allowlist.has(name)) continue;
    offenders.push(`${name} (schema ${schema})`);
  }
  return offenders;
}

describe("(A6) Guard — ninguna extension nueva se instala en `public` fuera de la allowlist (OFF-6-05c, Phase 123)", () => {
  const futureMigrations = readFutureMigrations();

  it("PUBLIC_EXTENSION_ALLOWLIST contiene EXACTAMENTE vector y unaccent", () => {
    expect([...PUBLIC_EXTENSION_ALLOWLIST].sort()).toEqual([
      "unaccent",
      "vector",
    ]);
    // pgtap NUNCA es allowlisted en public: 1.079 funciones exec-anon (Q-24b) que
    // permiten a un cliente no autenticado enumerar tablas y columnas (has_table,
    // columns_are, findfuncs) => mapa completo de las 57 tablas, PII incluida.
    expect(PUBLIC_EXTENSION_ALLOWLIST.has("pgtap")).toBe(false);
    expect(PUBLIC_EXTENSION_ALLOWLIST.has("pg_net")).toBe(false);
  });

  it("ninguna migracion > 0044 instala una extension en `public` fuera de la allowlist", () => {
    // SCOPE >0044 deliberado: 0001_extensions.sql instala pg_cron/pg_net/pgmq en
    // public y es PRE-lockdown (historia congelada; pg_net ya esta ruteada como
    // OFF-6-03 -> 124-aditivo). Un scope repo-wide naceria rojo por historia, que
    // es la trampa de polaridad que check_drift.sh demostro con 714 falsos positivos.
    const offenders: string[] = [];
    for (const { filename, sql } of futureMigrations) {
      for (const off of publicExtensionOffenders(sql, PUBLIC_EXTENSION_ALLOWLIST)) {
        offenders.push(`${filename}: ${off}`);
      }
    }
    expect(
      offenders,
      `Extension instalada en el esquema que PostgREST expone, fuera de la allowlist ` +
        `(OFF-6-05c: sus funciones nacen exec-anon por el default EXECUTE TO PUBLIC y quedan ` +
        `fuera de PUBLIC_RPC_ALLOWLIST y de todo guard — es el caso pgtap, 1.079 fn): ` +
        `[${offenders.join(", ")}] — instalala con \`create extension <n> schema extensions;\` ` +
        `(patron que el proyecto ya aplica a pgcrypto/uuid-ossp/pg_stat_statements), o ` +
        `justifica la excepcion anadiendola a PUBLIC_EXTENSION_ALLOWLIST.`,
    ).toHaveLength(0);
  });

  it("mutation self-check (A6): el detector MUERDE por fixture y tolera allowlist y `schema extensions`", () => {
    const norm = (sql: string) => stripSqlComments(sql).toLowerCase();
    const A = PUBLIC_EXTENSION_ALLOWLIST;

    // (a) POSITIVO — pgtap sin clausula schema (=> public) y pg_net con `schema public`.
    expect(publicExtensionOffenders(norm("create extension pgtap;"), A)).toEqual([
      "pgtap (schema public)",
    ]);
    expect(
      publicExtensionOffenders(
        norm("create extension if not exists pg_net schema public;"),
        A,
      ),
    ).toHaveLength(1);

    // (b) NEGATIVO — allowlisted, y cualquier extension fuera de `public`.
    expect(
      publicExtensionOffenders(
        norm("create extension if not exists unaccent;"),
        A,
      ),
    ).toHaveLength(0);
    expect(
      publicExtensionOffenders(norm("create extension vector;"), A),
    ).toHaveLength(0);
    expect(
      publicExtensionOffenders(
        norm("create extension if not exists pgtap schema extensions;"),
        A,
      ),
    ).toHaveLength(0);

    // (c) COMENTARIO — la prosa de un header no auto-invalida el guard.
    expect(
      publicExtensionOffenders(
        norm("-- create extension pgtap;\nselect 1;"),
        A,
      ),
    ).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// (A7) COMPLETITUD de PII_TABLES contra el catalogo de `public` (Phase 123)
//
// Exigencia nº1 del gate del subagente `supabase-reviewer` (veredicto
// "PASS CON RESERVAS", 2026-07-29), su unica reserva BLOQUEANTE:
//
//   "La fase demuestra que el guard es la unica capa (Q-23: service_role
//    .rolbypassrls = t) y luego audita sus puntos ciegos de plataforma, pero
//    nunca audita la cobertura de su propia lista de PII contra las 57 tablas."
//
// Block B es el UNICO control efectivo sobre la superficie del sitio, y su
// universo es `PII_TABLES`. Una tabla con columna de clase RUT/email fuera de
// esa lista es una fuga con el guard en verde. Este bloque lo impide.
//
// CORPUS CONGELADO, no consultado en runtime: el guard corre en CI SIN acceso
// a la DB (`ci.yml`: "Sin secrets de DB: los guards son estaticos"). La query
// que produjo el corpus esta documentada abajo y debe re-ejecutarse cuando el
// schema cambie; si el corpus queda stale, la deuda es visible aqui y no en
// un `.from()` silencioso.
// ---------------------------------------------------------------------------

/**
 * Clase de columna considerada PII de contacto/identificacion.
 * Deliberadamente la MISMA que exigio el gate: `(rut|email|telefono|direccion)`.
 */
const PII_COLUMN_CLASS = /(rut|email|telefono|direccion)/i;

/**
 * Corpus CONGELADO de columnas de clase PII en `public`, ancla 2026-07-29
 * (PostgreSQL 17.6). Producido por esta query read-only contra PROD:
 *
 *   select c.relname, a.attname
 *   from pg_class c
 *   join pg_namespace n on n.oid = c.relnamespace
 *   join pg_attribute a on a.attrelid = c.oid
 *        and a.attnum > 0 and not a.attisdropped
 *   where n.nspname = 'public' and c.relkind = 'r'
 *     and a.attname ~* '(rut|email|telefono|direccion)'
 *     and not exists (select 1 from pg_depend d
 *                      where d.objid = c.oid and d.deptype = 'e')
 *   order by 1, 2;
 *
 * Salida real (8 filas) — solo NOMBRES de tabla y columna, cero valores.
 */
const PUBLIC_PII_COLUMN_CATALOG: ReadonlyArray<{
  table: string;
  column: string;
}> = [
  { table: "contratista", column: "rut_proveedor" },
  { table: "contrato", column: "rut_proveedor" },
  { table: "declaracion_accion_derecho", column: "rut_juridica" },
  { table: "donante", column: "rut_donante" },
  { table: "entidad_tercero", column: "rut" },
  { table: "parlamentario", column: "email" },
  { table: "parlamentario", column: "rut" },
  { table: "pii_contraparte_declaracion", column: "rut_contraparte" },
];

/**
 * ADJUDICACION EXPLICITA — `declaracion_bien_inmueble :: es_su_domicilio`.
 *
 * El gate la listo como quinta candidata "por matchear direccion". Contra el
 * catalogo vivo NO matchea `PII_COLUMN_CLASS` (contiene "domicilio", no
 * "direccion") y ademas es un BOOLEANO de la declaracion de patrimonio, no un
 * dato de contacto: no porta domicilio alguno, solo si el inmueble declarado
 * es el domicilio del declarante. Se EXCLUYE con razon escrita (RULE-1: manda
 * la realidad del catalogo), no por inercia ni en silencio. Si alguna vez se
 * anade una columna con la direccion literal, entrara por el corpus congelado.
 */
const PII_ADJUDICACION_EXCLUIDA = "declaracion_bien_inmueble.es_su_domicilio";

/**
 * Detector puro: tablas del corpus que NO estan cubiertas por `PII_TABLES`.
 */
function uncoveredPiiTables(
  catalog: ReadonlyArray<{ table: string; column: string }>,
  piiTables: readonly string[],
): string[] {
  const covered = new Set(piiTables);
  const out = new Set<string>();
  for (const { table, column } of catalog) {
    if (!covered.has(table)) out.add(`${table} (${column})`);
  }
  return [...out].sort();
}

describe("(A7) Guard — PII_TABLES cubre TODA tabla de `public` con columna de clase PII (gate Phase 123)", () => {
  it("el corpus congelado es coherente: toda fila matchea PII_COLUMN_CLASS", () => {
    const malas = PUBLIC_PII_COLUMN_CATALOG.filter(
      (r) => !PII_COLUMN_CLASS.test(r.column),
    ).map((r) => `${r.table}.${r.column}`);
    expect(
      malas,
      `Fila del corpus congelado que no pertenece a la clase PII declarada: [${malas.join(", ")}]`,
    ).toHaveLength(0);
    // La adjudicacion excluida NO esta en el corpus: se documenta, no se cuela.
    expect(
      PUBLIC_PII_COLUMN_CATALOG.some(
        (r) => `${r.table}.${r.column}` === PII_ADJUDICACION_EXCLUIDA,
      ),
    ).toBe(false);
  });

  it("ninguna tabla del corpus PII queda fuera de PII_TABLES", () => {
    const offenders = uncoveredPiiTables(
      PUBLIC_PII_COLUMN_CATALOG,
      PII_TABLES,
    );
    expect(
      offenders,
      `Tabla de \`public\` con columna de clase PII que NO esta en PII_TABLES: ` +
        `[${offenders.join(", ")}]. Block B es la UNICA capa sobre la superficie del ` +
        `sitio (service_role bypassa RLS, Q-23): fuera de PII_TABLES un \`.from()\` ` +
        `en el arbol publico pasa el guard en VERDE y expone el dato. ` +
        `Anadela a PII_TABLES, o justifica por escrito por que su columna no es PII.`,
    ).toHaveLength(0);
  });

  it("las cuatro tablas que el gate destapo estan cubiertas", () => {
    for (const t of [
      "pii_contraparte_declaracion",
      "contratista",
      "contrato",
      "declaracion_accion_derecho",
    ]) {
      expect(PII_TABLES, `${t} debe estar en PII_TABLES`).toContain(t);
    }
  });

  it("mutation self-check (A7): el detector MUERDE con una tabla PII ficticia y vuelve a verde al restaurar", () => {
    // (a) POSITIVO — corpus + una tabla PII ficticia SIN entrada en PII_TABLES.
    const corpusMutado = [
      ...PUBLIC_PII_COLUMN_CATALOG,
      { table: "tabla_probe_ficticia", column: "rut_probe" },
    ];
    expect(uncoveredPiiTables(corpusMutado, PII_TABLES)).toEqual([
      "tabla_probe_ficticia (rut_probe)",
    ]);

    // (b) RESTAURADO — el corpus real vuelve a 0 offenders.
    expect(uncoveredPiiTables(PUBLIC_PII_COLUMN_CATALOG, PII_TABLES)).toHaveLength(0);

    // (c) INVERSO — quitar una cobertura existente tambien muerde: la lista no
    //     puede encogerse en silencio.
    const sinParlamentario = PII_TABLES.filter((t) => t !== "parlamentario");
    expect(
      uncoveredPiiTables(PUBLIC_PII_COLUMN_CATALOG, sinParlamentario),
    ).toEqual(["parlamentario (email)", "parlamentario (rut)"]);
  });
});
