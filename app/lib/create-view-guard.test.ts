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
 * El tokenizador SQL de este archivo NO se importa de `lockdown-guard.test.ts`
 * (los guards no se importan entre sí) y es una versión MÁS estricta: elimina
 * comentarios `--` a mitad de línea y bloques, y es CONSCIENTE de literales de
 * cadena y de dollar-quoting (la de lockdown solo quita líneas que EMPIEZAN
 * por `--`).
 *
 * REVIEW 126 (CR-01/CR-02/WR-01/WR-02) — por qué el parsing es un tokenizador
 * y no `split(";")` sobre un strip ingenuo:
 *   - CR-01: `--` DENTRO de un literal (`values ('a--b');`) hacía desaparecer el
 *     `;` terminador → la sentencia siguiente se fusionaba y el `create view`
 *     dejaba de matchear (regex anclada a inicio de chunk). Bypass silencioso.
 *   - CR-02: el invoker se buscaba en TODO el chunk → una view sin invoker
 *     quedaba "blindada" por el `with (security_invoker=true)` de un vecino, o
 *     por el texto dentro de un literal. Ahora la opción se busca SOLO entre el
 *     nombre de la view y su `as`.
 *   - WR-02 (límite DOCUMENTADO): el contenido de literales `'…'` y de bloques
 *     dollar-quoted `$$…$$` se ENMASCARA (se vacía) antes de partir por `;`.
 *     Consecuencia deliberada: un `create view` emitido por SQL DINÁMICO dentro
 *     del cuerpo de una función NO se detecta (no es texto SQL estático). El
 *     enmascarado es lo que evita el falso positivo simétrico (un cuerpo `$$`
 *     que contiene la frase `create view` no produce un offender espurio). El
 *     caso queda fijado por test en §2.
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
 * Piso anti-cero-vacuo del escaneo real. Baseline 2026-07-30: 77 archivos
 * `.sql` en `supabase/migrations/`. El piso (70) tolera que el árbol crezca
 * pero caza una ruta rota; el assert apareado de que la `0001` está presente
 * distingue "el árbol REAL" de "cualquier carpeta con ≥70 .sql" (IN-02).
 */
const MIN_MIGRACIONES_ESPERADAS = 70;

/**
 * Tokeniza SQL en sentencias separadas por `;` de NIVEL SUPERIOR, eliminando
 * comentarios (`-- …` y bloques) y VACIANDO el contenido de literales de
 * cadena (`'…'`, con `''` como escape) y de bloques dollar-quoted
 * (`$$…$$`, `$tag$…$tag$`).
 *
 * Devuelve las sentencias con las comillas/delimitadores conservados pero su
 * contenido vacío, de modo que:
 *   - un `--` o un `;` dentro de un literal NO parte la sentencia (CR-01);
 *   - el texto dentro de un literal no puede simular opciones ni sentencias
 *     (CR-02 / falsos positivos desde cuerpos `$$`).
 */
export function tokenizarSentenciasSql(sql: string): string[] {
  const statements: string[] = [];
  let actual = "";
  let i = 0;

  while (i < sql.length) {
    const ch = sql[i];
    const dos = sql.slice(i, i + 2);

    // Comentario de línea: -- hasta el fin de línea (fuera de literal, por
    // construcción: este bucle solo llega aquí en estado "código").
    if (dos === "--") {
      const fin = sql.indexOf("\n", i);
      i = fin === -1 ? sql.length : fin; // conserva el \n para el siguiente giro
      continue;
    }

    // Comentario de bloque (puede cruzar líneas).
    if (dos === "/*") {
      const fin = sql.indexOf("*/", i + 2);
      i = fin === -1 ? sql.length : fin + 2;
      continue;
    }

    // Literal de cadena: '...' con '' como escape. Se conserva '' (vacío).
    if (ch === "'") {
      i += 1;
      while (i < sql.length) {
        if (sql[i] === "'") {
          if (sql[i + 1] === "'") {
            i += 2; // comilla escapada, sigue dentro del literal
            continue;
          }
          i += 1;
          break;
        }
        i += 1;
      }
      actual += "''";
      continue;
    }

    // Dollar-quoting: $$ … $$ o $tag$ … $tag$ (tag = identificador válido).
    if (ch === "$") {
      const tagMatch = /^\$([A-Za-z_]\w*)?\$/.exec(sql.slice(i));
      if (tagMatch) {
        const delim = tagMatch[0];
        const fin = sql.indexOf(delim, i + delim.length);
        i = fin === -1 ? sql.length : fin + delim.length;
        actual += `${delim}${delim}`;
        continue;
      }
    }

    // Fin de sentencia de nivel superior.
    if (ch === ";") {
      statements.push(actual);
      actual = "";
      i += 1;
      continue;
    }

    actual += ch;
    i += 1;
  }

  if (actual.trim().length > 0) statements.push(actual);
  return statements;
}

/**
 * Allowlist de matviews toleradas sin `security_invoker` (las materialized
 * views NO soportan esa opción — siempre son violación bajo este detector
 * salvo justificación explícita AQUÍ).
 * DELIBERADAMENTE VACÍA: sumar una entrada exige una decisión documentada
 * (no es un escape hatch silencioso). Se compara por nombre SIN el prefijo
 * `public.` y sin comillas (WR-01: antes era código muerto y el mensaje de
 * error mentía al desarrollador).
 */
const MATVIEW_ALLOWLIST: readonly string[] = [];

/**
 * `create [or replace] [materialized] view [if not exists] [schema.]nombre`.
 * Sin ancla `^`: el tokenizador ya garantiza una sentencia por chunk y que
 * literales/comentarios están enmascarados (CR-01).
 * Grupos: 1 = `materialized `, 2 = schema (opcional), 3 = nombre.
 * IN-04: identificadores citados (`"v-x"`) se capturan enteros.
 */
const CREATE_VIEW_RE =
  /create\s+(?:or\s+replace\s+)?(materialized\s+)?view\s+(?:if\s+not\s+exists\s+)?(?:("[^"]+"|\w+)\s*\.\s*)?("[^"]+"|\w+)/i;

/** `with ( … security_invoker = true|on … )` — se aplica SOLO a la lista de opciones (CR-02). */
const SECURITY_INVOKER_RE =
  /with\s*\(\s*[^)]*security_invoker\s*=\s*(?:true|on)\b[^)]*\)/i;

function desacomillar(ident: string): string {
  return ident.startsWith('"') && ident.endsWith('"') ? ident.slice(1, -1) : ident;
}

/**
 * Detector PURO (sin I/O): dado el texto de una migración, devuelve la lista
 * de nombres de view en violación (create view/materialized view en `public`
 * — o no-calificada — sin `security_invoker = true|on` en la lista de opciones
 * de SU PROPIA sentencia).
 */
export function detectarViewsSinInvoker(sql: string): string[] {
  const offenders: string[] = [];

  for (const stmt of tokenizarSentenciasSql(sql)) {
    const m = CREATE_VIEW_RE.exec(stmt);
    if (!m) continue;

    const esMaterialized = !!m[1];
    const schema = m[2] ? desacomillar(m[2]) : undefined;
    const nombreSimple = m[3];

    // Solo nos importan views no calificadas o calificadas a public.
    if (schema && schema.toLowerCase() !== "public") continue;

    const nombreCompleto = schema ? `${m[2]}.${nombreSimple}` : nombreSimple;

    if (esMaterialized) {
      // WR-01: la allowlist se CONSULTA de verdad (comparación sin `public.`
      // y sin comillas). Sigue vacía: hoy toda matview es violación.
      if (!MATVIEW_ALLOWLIST.includes(desacomillar(nombreSimple))) {
        offenders.push(nombreCompleto);
      }
      continue;
    }

    // CR-02: las opciones válidas viven ENTRE el nombre de la view y su `as`.
    // Todo lo posterior al `as` (el cuerpo del select) es irrelevante, y un
    // `with (...)` de otra sentencia ya no puede alcanzarnos porque el
    // tokenizador separa sentencias correctamente.
    const resto = stmt.slice(m.index + m[0].length);
    const idxAs = resto.search(/\bas\b/i);
    const opciones = idxAs >= 0 ? resto.slice(0, idxAs) : resto;

    if (!SECURITY_INVOKER_RE.test(opciones)) {
      offenders.push(nombreCompleto);
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
    ).toBeGreaterThanOrEqual(MIN_MIGRACIONES_ESPERADAS);

    // IN-02: el piso numérico solo prueba "una carpeta con muchos .sql". Este
    // assert ancla el listado al árbol REAL del repo.
    expect(
      archivos.filter((f) => /^0001_/.test(f)),
      "MIGRATIONS_DIR no contiene la migración 0001 — no es el árbol de migraciones del repo",
    ).toHaveLength(1);
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

  // ---- Bypasses reproducidos en el review 126 (CR-01 / CR-02) --------------

  it("CR-01: `--` dentro de un literal NO traga el `;` — la view siguiente SÍ se detecta", () => {
    const sql = [
      "insert into t(x) values ('a--b');",
      "create view public.v_leak as select 1;",
    ].join("\n");
    expect(
      detectarViewsSinInvoker(sql),
      "bypass CR-01: el strip ingenuo cortaba en el `--` del literal y fusionaba sentencias",
    ).toEqual(["public.v_leak"]);
  });

  it("CR-01 (variante): `--` dentro de un bloque $$ … $$ tampoco traga el `;`", () => {
    const sql = [
      "create function f() returns void as $$ begin -- nota; con guiones",
      "  perform 1;",
      "end $$ language plpgsql;",
      "create view public.v_leak2 as select 1;",
    ].join("\n");
    expect(detectarViewsSinInvoker(sql)).toEqual(["public.v_leak2"]);
  });

  it("CR-02: `with (security_invoker = true)` DENTRO de un literal no blinda la view", () => {
    const sql = "create view public.v8 as select 'with (security_invoker = true)'::text;";
    expect(
      detectarViewsSinInvoker(sql),
      "bypass CR-02: el invoker se buscaba en todo el chunk, incluidos literales",
    ).toEqual(["public.v8"]);
  });

  it("CR-02: la view correcta NO blinda a su vecina sin invoker (dos views, una mala)", () => {
    const sql = [
      "create view public.v_bad as select 'a--b';",
      "create view public.v_good with (security_invoker=true) as select 1;",
    ].join("\n");
    expect(
      detectarViewsSinInvoker(sql),
      "bypass CR-02 compuesto: el invoker del vecino blindaba a v_bad",
    ).toEqual(["public.v_bad"]);
  });

  it("CR-02: un `with (security_invoker=true)` POSTERIOR al `as` no cuenta como opción de la view", () => {
    const sql =
      "create view public.v9 as select 1 from t where c = 'with (security_invoker=true)';";
    expect(detectarViewsSinInvoker(sql)).toEqual(["public.v9"]);
  });

  it("WR-02 (límite documentado): SQL dinámico dentro de $$ … $$ NO se detecta ni produce offender espurio", () => {
    const sql =
      "create function f() returns void as $$ begin execute 'create view public.v_dyn as select 1'; end $$ language plpgsql;";
    expect(
      detectarViewsSinInvoker(sql),
      "límite conocido: el guard es ESTÁTICO — el cuerpo dollar-quoted se enmascara " +
        "(evita el falso positivo simétrico). Una view creada por SQL dinámico es deuda de operador.",
    ).toEqual([]);
  });

  it("IN-04: identificador citado se reporta completo (`public.\"v-x\"`)", () => {
    const sql = 'create view public."v-x" as select 1;';
    expect(detectarViewsSinInvoker(sql)).toEqual(['public."v-x"']);
  });

  it("WR-01: MATVIEW_ALLOWLIST está vacía → hoy toda matview es violación", () => {
    expect(
      MATVIEW_ALLOWLIST,
      "sumar una matview a la allowlist exige decisión explícita documentada",
    ).toHaveLength(0);
    // La allowlist se consulta de verdad: con ella vacía la matview se reporta.
    expect(detectarViewsSinInvoker("create materialized view public.mv_a as select 1;")).toEqual([
      "public.mv_a",
    ]);
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

// ---------------------------------------------------------------------------
// (4) Guard-of-the-guards (WR-05) — el script `pnpm guards` de app/package.json
// lista por NOMBRE los guards de régimen (D-13 mata el glob-trap). Pero una
// lista derivada tiene su propia trampa: `passWithNoTests: true` hace que un
// nombre fantasma (guard renombrado/borrado) salga 0 en silencio, y un guard
// NUEVO no entra al script salvo que alguien lo recuerde. Este test cierra
// ambas direcciones contra el filesystem.
// ---------------------------------------------------------------------------

describe("(4) Guard-of-the-guards — `pnpm guards` cubre exactamente los guards en disco", () => {
  /** Guards en disco de un directorio de `app/`, como ruta relativa a `app/`. */
  function guardsEnDisco(dir: string): string[] {
    return readdirSync(path.join(APP_ROOT, dir))
      .filter((f) => f.endsWith(".test.ts") && f.includes("guard"))
      .map((f) => `${dir}/${f}`)
      .sort();
  }

  const pkg = JSON.parse(readFileSync(path.join(APP_ROOT, "package.json"), "utf-8")) as {
    scripts: Record<string, string>;
  };
  const enScript = (pkg.scripts.guards ?? "")
    .split(/\s+/)
    .filter((tok) => tok.endsWith(".test.ts"))
    .sort();
  const enDisco = [...guardsEnDisco("lib"), ...guardsEnDisco("components")].sort();

  it("el script `guards` existe y lista archivos (anti-cero-vacuo)", () => {
    expect(pkg.scripts.guards, "falta el script `guards` en app/package.json").toBeDefined();
    expect(
      enScript.length,
      "el script `guards` no lista ningún .test.ts — el runner por nombre explícito desapareció",
    ).toBeGreaterThanOrEqual(11);
    expect(
      enDisco.length,
      "el escaneo de guards en disco dio menos de 11 — sospechar APP_ROOT mal resuelto",
    ).toBeGreaterThanOrEqual(11);
  });

  it("todo guard EN DISCO está listado en el script `guards`", () => {
    const faltantes = enDisco.filter((f) => !enScript.includes(f));
    expect(
      faltantes,
      `Guard(s) en disco NO listado(s) en \`pnpm guards\`: [${faltantes.join("; ")}]. ` +
        `Añádelo(s) al script en el mismo commit que crea el guard (D-13/D-14).`,
    ).toHaveLength(0);
  });

  it("el script `guards` no contiene nombres fantasma (archivo inexistente)", () => {
    const fantasmas = enScript.filter((f) => !enDisco.includes(f));
    expect(
      fantasmas,
      `Nombre(s) fantasma en \`pnpm guards\`: [${fantasmas.join("; ")}]. ` +
        `Con passWithNoTests:true el script saldría 0 corriendo de MENOS, en silencio.`,
    ).toHaveLength(0);
  });
});
