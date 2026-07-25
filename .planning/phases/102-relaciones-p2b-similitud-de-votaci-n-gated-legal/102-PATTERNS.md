# Phase 102: RELACIONES P2b — Similitud de votación (gated legal) - Pattern Map

**Mapped:** 2026-07-24
**Files analyzed:** 12 (new + modified)
**Analogs found:** 12 / 12 (every piece has a byte-level twin in the repo)

> This phase is **disciplined replication of existing molds**, not net-new design.
> The research already located every analog verbatim; this map pins each new/modified
> file to its analog with exact line ranges + the load-bearing excerpts a planner
> should tell an executor to copy.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `app/lib/vsim-gate.ts` | config (server-only flag) | request-response | `app/lib/money-gate.ts` | exact (byte-a-byte) |
| `app/lib/vsim-gate.test.ts` | test | request-response | `app/lib/money-gate.test.ts` | exact |
| `app/lib/vsim-antiflip-guard.test.ts` | test (CI guard) | batch/static-scan | `app/lib/money-antiflip-guard.test.ts` | exact |
| `supabase/migrations/0068_coincidencia_votos_par.sql` | migration (RPC) | CRUD (read-agg) | `supabase/migrations/0067_militancia_historica_compartida.sql` | role-match (agg vs cross-link) |
| `supabase/tests/0068_coincidencia_votos_par.test.sql` | test (pgTAP) | CRUD | `supabase/tests/0067_militancia_historica_compartida.test.sql` | exact |
| `app/components/similitud-votacion-comparar.tsx` | component (presentational) | transform/display | `app/components/relaciones-eje-comparar.tsx` | role-match (STRUCTURE only; neutral display per UI-SPEC) |
| `app/app/comparar/page.tsx` (MODIFY) | route (Server Component) | request-response | itself (Phase 101 `CompararEjes`) | exact (extend) |
| `app/app/comparar/page.test.tsx` (MODIFY) | test (RTL) | request-response | itself | exact (extend) |
| `app/lib/anti-insinuacion-guard.test.ts` (MODIFY) | test (CI guard) | batch/static-scan | itself (100/101 extensions) | exact (extend) |
| `app/lib/lockdown-guard.test.ts` (MODIFY) | test (CI guard) | batch/static-scan | itself (`militancia_historica_compartida` entry) | exact (extend) |
| `app/components/co-votacion-red-guard.test.ts` | test (CI guard, NEW) | batch/static-scan | anti-insinuacion-guard walk/strip helpers | role-match (new static scan) |
| `.env.example` (MODIFY) | config | — | `MONEY_PUBLIC_ENABLED=false` line 70 | exact |
| `docs/legal/102-LEGAL-DOSSIER-VSIM.md` | doc (legal dossier) | — | `docs/legal/13-LEGAL-DOSSIER.md` | exact (structure) |

**Two real gaps to resolve (not molds — DECISIONS):**
1. `co_votacion` latent branches in `red-graph.tsx:81` + `arista-hecho.tsx:32-33` (see "Dead Branch Resolution").
2. `.env.example` has NO `VSIM_PUBLIC_ENABLED` line yet — the anti-flip guard V2 requires it (see Shared Patterns → Env Default).

---

## Pattern Assignments

### `app/lib/vsim-gate.ts` (config, server-only flag) — NEW

**Analog:** `app/lib/money-gate.ts` (34 lines, whole file is the mold)

**Copy the ENTIRE file, swap `money`→`vsim` and `MONEY`→`VSIM`.** The only load-bearing lines:

```typescript
// app/lib/money-gate.ts:1
import "server-only";

// app/lib/money-gate.ts:30-34 — the chokepoint (the ONE thing the anti-flip guard V1 asserts verbatim)
export function moneyPublicEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return env.MONEY_PUBLIC_ENABLED === "true";
}
```

New file must be:
```typescript
import "server-only";
export function vsimPublicEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return env.VSIM_PUBLIC_ENABLED === "true";
}
```

**LOCKED invariants (the guard MUERDE otherwise):** `=== "true"` exactly — no `Boolean(...)`, no `!== "false"`, no `||`, no `NODE_ENV`, no `.trim()`, no `==` lax. Keep it a one-liner. `import "server-only"` on line 1. The var carries NO `NEXT_PUBLIC_` prefix (must not reach the client bundle). `env` is injectable (default `process.env`) for testability.

---

### `app/lib/vsim-gate.test.ts` (test) — NEW

**Analog:** `app/lib/money-gate.test.ts` (25 lines, whole file is the mold)

5 cases, verbatim structure (money-gate.test.ts:5-25):
```typescript
// var ausente -> false (default fail-closed)      → vsimPublicEnabled({})
// "false" -> false
// "1" -> false (sin truthiness laxa)
// "TRUE" -> false (case-sensitive: solo el literal "true")
// "true" -> true (unico valor que enciende)
```
Import: `import { vsimPublicEnabled } from "./vsim-gate";`

---

### `app/lib/vsim-antiflip-guard.test.ts` (test, CI guard) — NEW

**Analog:** `app/lib/money-antiflip-guard.test.ts` (436 lines — copy WHOLE, swap `MONEY`→`VSIM` and `money`→`vsim`)

**Constants to rebind (money-antiflip-guard.test.ts:43-47):**
```typescript
const MONEY_GATE = path.join(APP_ROOT, "lib", "money-gate.ts");   // → vsim-gate.ts
const ENV_EXAMPLE = path.join(REPO_ROOT, ".env.example");          // unchanged
const MONEY_GATE_REL = "lib/money-gate.ts";                        // → "lib/vsim-gate.ts"
```

**Reuse verbatim (do NOT re-derive — proven helpers):**
- `stripTsComments` (lines 55-65) — includes the `(?<!:)//` URL skip.
- `walkSourceFiles` + `SKIP_DIRS` (lines 73-114) — scans `.ts/.tsx/.mjs/.cjs/.js`, excludes `*.test.*`.
- `RAW_ENV_ALLOWLIST` (lines 123-132) — the ONE non-test file that may name the flag is the chokepoint.
- `detectarRelajacionGate` (lines 150-225) — Vectors 1a/1b/1c/1d + 2a/2b. Every regex references `MONEY_PUBLIC_ENABLED` → swap to `VSIM_PUBLIC_ENABLED`.
- `detectarRawEnvEnRuta` (lines 232-236) — Vector 3.

**The 3 vectors + mutation self-check (lines 241-435):**
- **V1** (fail-closed): `vsim-gate.ts` keeps `VSIM_PUBLIC_ENABLED === "true"`, no lax truthiness, single ignition path (CR-01: no `||`/`NODE_ENV`/`.trim()`/`==`).
- **V2** (`.env.example`): `/^VSIM_PUBLIC_ENABLED\s*=\s*false\s*$/m` present, `=true` never.
- **V3** (no raw env): also scans `packages/` — no source file outside the chokepoint names `VSIM_PUBLIC_ENABLED`.
- **§4 mutation self-check** (lines 338-435): fixtures IN MEMORY prove the detector MUERDE for each relaxation (`Boolean(...)`, `!== "false"`, `|| === "1"`, `|| NODE_ENV`, `.trim()`, `== lax`, `.env=true`, raw-env-in-route). Copy each `it(...)` swapping the flag name.

**Pitfall (RESEARCH Pitfall 4 for the guard):** `SKIP_DIRS` + `PACKAGES_ROOT` sanity asserts (`> 0`) prevent silent empty scans — keep them.

---

### `supabase/migrations/0068_coincidencia_votos_par.sql` (migration, RPC) — NEW

**Analog:** `supabase/migrations/0067_militancia_historica_compartida.sql` (mold for secdef/search_path/timeout/double-revoke). The **query body** is the one already benchmarked at 28ms (RESEARCH Pattern 2 + Code Examples).

**Copy the RPC skeleton from 0067:41-47 + 0067:86-87:**
```sql
-- 0067:40 — drop before create (idempotent apply)
drop function if exists public.militancia_historica_compartida(text);

-- 0067:42-47 — the secdef header (LOCKED shape, mold 0064):
create or replace function public.militancia_historica_compartida(p_id text)
returns table (id text, nombre text, camara text, total_n bigint)
language sql stable security definer
  set search_path = ''
  set statement_timeout = '5s'
as $$ ... $$;

-- 0067:86-87 — double-revoke (Camino A, CERO grant):
revoke all on function public.militancia_historica_compartida(text) from public;
revoke all on function public.militancia_historica_compartida(text) from anon, authenticated;
```

**Adapt to 0068 (verbatim query from RESEARCH Pattern 2, lines 194-227):**
```sql
drop function if exists public.coincidencia_votos_par(text, text);

create or replace function public.coincidencia_votos_par(p_a text, p_b text)
returns table (n_coinciden bigint, m_compartidas bigint, fecha_captura_max timestamptz)
language sql stable security definer
  set search_path = ''
  set statement_timeout = '5s'
as $$
  with a as (
    select v.votacion_id, v.seleccion
    from public.voto v
    where v.parlamentario_id = p_a
      and v.estado_vinculo = 'confirmado'
      and v.seleccion in ('si','no','abstencion')   -- SUSTANTIVA: pareo/ausente excluidos
  ),
  b as ( ... same for p_b ... )
  select
    count(*) filter (where a.seleccion = b.seleccion) as n_coinciden,
    count(*)                                          as m_compartidas,
    (select max(vt.fecha_captura)
       from public.votacion vt
       where vt.id in (select votacion_id from a intersect select votacion_id from b)) as fecha_captura_max
  from a join b using (votacion_id);
$$;

revoke all on function public.coincidencia_votos_par(text, text) from public;
revoke all on function public.coincidencia_votos_par(text, text) from anon, authenticated;
```

**LOCKED design notes (RESEARCH §Pattern 2 + Discretion):**
- returns table = EXACTLY 3 aggregate columns — NEVER a per-votacion list (that's out of scope, deferred).
- `votacion.boletin` is NOT NULL w/ FK→proyecto → every votación is already "de un proyecto de ley"; the only "sustantiva" filter is `seleccion in ('si','no','abstencion')` on `estado_vinculo='confirmado'`. No extra join to `proyecto`.
- Header block should mirror 0067:24-38 (apply order comment: "Última migración = 0067, ésta es la 0068"; apply via `psql --single-transaction`, NEVER `db push`).

**Apply command (RESEARCH Pitfall 6, precedent 0059-0067 — agent MAY apply additive migrations):**
```
PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" --single-transaction -f supabase/migrations/0068_coincidencia_votos_par.sql
```

---

### `supabase/tests/0068_coincidencia_votos_par.test.sql` (pgTAP) — NEW

**Analog:** `supabase/tests/0067_militancia_historica_compartida.test.sql` (63 lines, mold: `begin; select plan(N); ... select * from finish(); rollback;`)

**Swap the signature to 2-arg `text, text` and the returns contract. Copy each assertion (0067:19-60), re-scoped by `regprocedure`:**
```sql
-- 0067:20 → has_function con firma [text, text]
select has_function('public','coincidencia_votos_par', ARRAY['text','text'], '...');
-- 0067:23-26 → prosecdef = true (::regprocedure, WR-05: scope por regprocedure no proname a secas)
-- 0067:29 → anon SIN execute (doble-revoke)
-- 0067:32 → authenticated SIN execute
-- 0067:35-38 → proconfig ~ 'search_path='
-- 0067:41-44 → proconfig ~ 'statement_timeout=5s'
-- 0067:57-60 → returns EXACTO:
select is(
  pg_get_function_result('public.coincidencia_votos_par(text,text)'::regprocedure),
  'TABLE(n_coinciden bigint, m_compartidas bigint, fecha_captura_max timestamptz)',
  'coincidencia_votos_par emite SOLO n_coinciden/m_compartidas/fecha_captura_max');
```

**Add (VSIM-01 denominator test, RESEARCH Test Map row 2):** a fixture pair with a pareo/ausencia row that must NOT count in `m_compartidas` (proves the `seleccion in (...)` + `estado_vinculo='confirmado'` filter). Adjust `plan(N)` accordingly.

Run against APPLIED schema (Pitfall 6 — pgTAP is the ONLY valid DDL test):
```
PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" -tA -f supabase/tests/0068_coincidencia_votos_par.test.sql
```

---

### `app/components/similitud-votacion-comparar.tsx` (component, presentational) — NEW

**Analog:** `app/components/relaciones-eje-comparar.tsx` — **STRUCTURE ONLY** (the `<section className="mt-12">` sibling shape, presentational-pure contract). **DO NOT reuse the component itself and DO NOT copy its color.**

**Copy the wrapper structure (relaciones-eje-comparar.tsx:63-83):**
```tsx
<section className="mt-12">
  <h2 className="text-xl font-semibold">{heading}</h2>
  {/* ...content... */}
  <p className="mt-2 text-xs text-muted-foreground">{provenance}</p>
</section>
```
Presentational-pure contract (lines 3-25 JSDoc): receives everything serialized by the server; NEVER touches Supabase, NEVER re-orders, NEVER re-counts.

**ANTI-PATTERN — DO NOT COPY (RESEARCH Pitfall 5, UI-SPEC LOCK):**
`relaciones-eje-comparar.tsx` renders the intersection figure in `font-semibold text-accent-product` (petróleo). And `page.tsx`'s `InterseccionCompartida` (page.tsx:144-160) does the same:
```tsx
// page.tsx:156-157 — THE thing to NOT replicate for VOTO
<span className="font-semibold text-accent-product">Comparten {n}</span>
```
For VOTO, petróleo/bold encodes "nivel de acuerdo" → crosses the anti-DW-NOMINATE line.

**REQUIRED neutral display (RESEARCH Pitfall 5):** figure in `text-sm`, weight-400, `--foreground`/`text-muted-foreground`, ZERO petróleo, ZERO bold, ZERO bar/gauge. The caveat legend weighs MORE than the number.

**Export the caveat as a single constant** (RESEARCH Pitfall 3): e.g. `export const LEYENDA_SIMILITUD_VOTO = "..."` — it will contain "afinidad"/"señal" (terms it NEGATES), so it MUST be imported verbatim into `NEGACIONES_LOCKED` before the surface enters the scan (see Shared Patterns → Negated Legend).

**Caveat copy (CONTEXT/RESEARCH VERBATIM):** "La coincidencia alta es la norma, no una señal" + declared coverage (Cámara confirmado determinista ~80%, Senado por nombre ~20% — from Phase 98 audit). M=0 → honest degraded copy "sin votaciones compartidas suficientes en las fuentes consultadas" — NEVER a fabricated "0%".

---

### `app/app/comparar/page.tsx` (route, Server Component) — MODIFY

**Analog:** itself — the Phase 101 `CompararEjes` function (page.tsx:215-466).

**Insertion point:** `CompararEjes`, AFTER `ejeZona`, as the LAST sibling in the return (page.tsx:458-465):
```tsx
// current return (page.tsx:459-464):
return (<>{ejeMilitancia}{ejeComisiones}{ejeCoautoria}{ejeZona}</>);
// →  add {ejeSimilitud} as 5th sibling.
```

**Gated block (RESEARCH Pattern 3, lines 232-241) — check flag BEFORE any `.rpc()`:**
```tsx
let ejeSimilitud: React.ReactNode = null;
if (vsimPublicEnabled(process.env)) {
  const { data, error } = await sb.rpc("coincidencia_votos_par", { p_a: a, p_b: b });
  if (error) throw new Error(`coincidencia_votos_par falló: ${error.message}`); // #34 (mirror page.tsx:80-82,93-97)
  // resolver N/M, % = round(N/M·100) en el server, fecha → <SimilitudVotacionComparar>
}
return (<>{ejeMilitancia}{ejeComisiones}{ejeCoautoria}{ejeZona}{ejeSimilitud}</>);
```

**Reuse from existing page (LOCKED, load-bearing):**
- `export const dynamic = "force-dynamic"` (page.tsx:41) — already there.
- `PARLAMENTARIO_ID_RE` id validation BEFORE `.rpc()` (page.tsx:185, V5).
- The React.cache reader pattern that THROWS on real DB error (page.tsx:87-100 mold; #34).
- `fechaConsultaHoy()` tz America/Santiago (page.tsx:52-59) if a "consultado al" line is needed.

**Import needed:** `import { vsimPublicEnabled } from "@/lib/vsim-gate";` — this is the ONLY reader of the flag (anti-flip V3 enforces it). Add `<SimilitudVotacionComparar>` import.

**Flag OFF ⇒ `return null` (ejeSimilitud stays null) ⇒ zero DOM, zero rpc.**

---

### `app/app/comparar/page.test.tsx` (RTL) — MODIFY

**Analog:** itself (55+ lines read; mock-supabase harness + `renderEjes`/`renderToStaticMarkup`).

**Reuse the harness (page.test.tsx:22-55):** `rpcImpl = vi.fn(...)`, `ROSTER_DEFAULT` two-diputado fixture, `@/lib/supabase` mocked.

**Add two cases (RESEARCH Code Examples, lines 334-340):**
```typescript
it("flag OFF → la sección de similitud está AUSENTE del DOM", async () => {
  // vsimPublicEnabled reads process.env → control via vi.stubEnv("VSIM_PUBLIC_ENABLED", "false"/absent)
  const html = await renderEjes("D1001", "D1002");
  expect(html).not.toContain("Similitud de votación");
  expect(html).not.toContain("La coincidencia alta es la norma");
});
// flag ON (vi.stubEnv "true") + rpcImpl returns {n_coinciden, m_compartidas, fecha_captura_max}:
//   section + caveat + neutral figure present; M=0 → degraded copy, never "0%".
```
**Open question (RESEARCH Q2 — minor plan decision):** control env via `vi.stubEnv("VSIM_PUBLIC_ENABLED", ...)`, mirroring how `moneyPublicEnabled` accepts injected env.

---

### `app/lib/anti-insinuacion-guard.test.ts` (CI guard) — MODIFY

**Analog:** itself (913 lines; established extension pattern across VOTO/MONEY/HOME/BUSQUEDA/PERSONAS/LOBBY/AGENDA/DEEPLINK/PANEL/RELACIONES).

**1. Add `SUPERFICIES_VSIM`** (mirror the array pattern at lines 305-344):
```typescript
const SUPERFICIES_VSIM: string[] = [
  "components/similitud-votacion-comparar.tsx",
  // app/comparar/page.tsx YA está en SUPERFICIES_RELACIONES (339-344) — NO duplicar
];
```

**2. Add to the scan loop** (line 565): append `...SUPERFICIES_VSIM` to the spread.

**3. Add idioms to `TERMINOS_PROHIBIDOS`** (lines 355-463) — **DEDUPE FIRST (RESEARCH Pitfall 4):**
- Already covered, DO NOT re-add: `"afín"` (line 430 covers "más afín"/"afín a"), `"afinidad"` (364), `"aliado"` (427 — but plurals `aliados`/`aliada` are NEW), `"nivel de acuerdo"` (373), `"bloque de"` (429 covers "bloque de votación"), `"vota como"`/`"votan como"` (375-376).
- Genuinely NEW: `"votan juntos"`, `"votan igual"`, `"votan parecido"`, `"aliados"`, `"aliada"`, `"tasa de coincidencia"`, and `"señal"` (NOT present today — if added as idiom, the negated-legend subtraction covers it).

**4. Register the caveat legend in `NEGACIONES_LOCKED`** (lines 471-493, mirror `LEYENDA_CROSS_LINK` at 482):
```typescript
import { LEYENDA_SIMILITUD_VOTO } from "@/components/similitud-votacion-comparar";
// ...in NEGACIONES_LOCKED array:
LEYENDA_SIMILITUD_VOTO,  // NIEGA "afinidad"/"señal" — sin restarla el scan se auto-caza (Pitfall 3)
```

**5. Add a mutation self-check** (mirror the RELACIONES self-check at lines 784-807) — one `it(...)` per genuinely-new idiom, IN MEMORY, proving the guard MUERDE (`"votan parecido"`, `"tasa de coincidencia"`, etc.). Plus a no-false-positive test that the LEYENDA_SIMILITUD_VOTO mounted verbatim → `[]` (mirror lines 881-889).

**Pitfall 3 (LOCKED, blocked Phase 91):** the legend negates a prohibited term → without the `NEGACIONES_LOCKED` subtraction the guard self-catches on its own surface.

---

### `app/lib/lockdown-guard.test.ts` (CI guard) — MODIFY

**Analog:** itself — the `militancia_historica_compartida` entry added in Phase 101 (lockdown-guard.test.ts:186).

**Add ONE line to `PUBLIC_RPC_ALLOWLIST`** (the `new Set([...])` at line 165), alphabetically near line 168:
```typescript
"coincidencia_votos_par", // ← NEW (debe existir en supabase/migrations/0068_*.sql — Direction-B)
```
**Direction-B (lines 388-400):** `allowlist ⊆ definidas` — every allowlist entry must have a `create (or replace) function` in some migration. This is why **0068 must be WRITTEN in Wave 0** (RESEARCH lección 101-02: the allowlist entry can't be orphaned). `RPC_DEF_REGEX` (line 372) picks up `create ... function public.coincidencia_votos_par`.

**Direction-A (lines 528-552):** `servida ⊆ allowlist` — the `.rpc("coincidencia_votos_par")` call in page.tsx is caught here; the allowlist entry satisfies it.

---

### `app/components/co-votacion-red-guard.test.ts` (CI guard) — NEW

**Analog:** the `stripTsComments` + `walkSourceFiles` helpers in `anti-insinuacion-guard.test.ts:76-88` / `money-antiflip-guard.test.ts:84-114` (reuse the walk/read pattern). Location at agent discretion (RESEARCH: next to guards).

**What it asserts (VSIM-03, permanent static test):** no file under the /red surface contains `co_votacion`/`covotacion`. Scan the /red surface inventory:
```
app/app/red/**                    (route)
app/components/red/**             (NET components: red-graph.tsx, arista-hecho.tsx, ...)
supabase/migrations/0030_net.sql  (graph schema — CHECK constraint tipo)
```
**This test is born RED** unless the dead branches are removed first (see below). Add a mutation self-check (IN MEMORY) proving it MUERDE if `co_votacion` is injected into a fixture.

---

## Dead Branch Resolution (RESEARCH Pitfall 1 — DECISION, was Open Question 1)

`co_votacion` is a LATENT label in two /red components. The CHECK constraint on `arista.tipo` only allows `co_lobby_contraparte` (0 `co_votacion` rows in DB), so these are dead branches:

| File:Line | Current content | Action (Option A — recommended, RESEARCH) |
|-----------|-----------------|-------------------------------------------|
| `app/components/red/red-graph.tsx:81` | `co_votacion: "Misma votación",` (in `TIPO_LABEL` record, lines 79-82) | **Delete the line** — `TIPO_LABEL` keeps only `co_lobby_contraparte`. |
| `app/components/red/arista-hecho.tsx:32-33` | `case "co_votacion":\n  return \`Registrados en la misma votación: ${quien}\`;` (in `etiquetaHecho` switch, lines 29-36) | **Delete the case** — the `default` branch (line 34-35) already handles any unknown tipo honestly. |

**Verified safe:** `red-graph.test.tsx` has **NO** dependency on `co_votacion`/`TIPO_LABEL`/`etiquetaHecho` (grep returned no matches) → deleting the branches will not break that test. Option A leaves the tree clean and lets `co-votacion-red-guard.test.ts` scan RAW text, green permanently. This is the literal reading of VSIM-03 ("JAMÁS entra a /red").

---

## Shared Patterns

### Fail-closed gate chokepoint
**Source:** `app/lib/money-gate.ts:30-34`
**Apply to:** `app/lib/vsim-gate.ts` (the ONLY reader of `VSIM_PUBLIC_ENABLED`)
```typescript
return env.MONEY_PUBLIC_ENABLED === "true";   // exact `=== "true"`, no lax forms
```

### Env default (deny-by-default, versioned OFF)
**Source:** `.env.example:70` (`MONEY_PUBLIC_ENABLED=false`) — the ONLY `_PUBLIC_ENABLED` line present today; `NET_`/`CRUCES_` are NOT there.
**Apply to:** `.env.example` — add `VSIM_PUBLIC_ENABLED=false` (with a comment block mirroring lines 66-69).
**Why mandatory (RESEARCH Pitfall 2):** the anti-flip guard V2 asserts `/^VSIM_PUBLIC_ENABLED\s*=\s*false\s*$/m` — without this line the guard MUERDE in a false-green.

### RPC bounded + double-revoke (Camino A, CERO grant)
**Source:** `supabase/migrations/0067_*.sql:42-47,86-87` (secdef, `search_path=''`, `statement_timeout='5s'`, drop-before-create, double-revoke `from public` + `from anon, authenticated`)
**Apply to:** `0068_coincidencia_votos_par.sql`
**pgTAP is the ONLY valid DDL proof** (Pitfall 6): apply via `psql --single-transaction`, test against applied schema, `::regprocedure` scoping (WR-05).

### Negated legend subtraction
**Source:** `anti-insinuacion-guard.test.ts:471-493` (`NEGACIONES_LOCKED` array; `LEYENDA_CROSS_LINK` at 482 negates "afinidad")
**Apply to:** `LEYENDA_SIMILITUD_VOTO` — export as single constant from the component, import verbatim, subtract BEFORE `SUPERFICIES_VSIM` enters the real scan.
**Why (Pitfall 3, blocked Phase 91):** honest copy uses the prohibited term to NEGATE it.

### Allowlist Direction-B requires the migration written
**Source:** `lockdown-guard.test.ts:186` (`militancia_historica_compartida` entry) + Direction-B (388-400)
**Apply to:** `coincidencia_votos_par` allowlist entry ⇒ 0068 MUST be written in Wave 0 (lección 101-02).

### Legal dossier front-matter (signoff gate)
**Source:** `docs/legal/13-LEGAL-DOSSIER.md:1-10` (YAML front-matter: `signoff: pending`, `alcance`, `asesor`, `nota: "Encender ... requiere signoff: approved."`)
**Apply to:** `docs/legal/102-LEGAL-DOSSIER-VSIM.md` — same front-matter shape, `alcance: VSIM (coincidencia de votación)`, add the anti-DW-NOMINATE anti-model + the base-alta caveat + the metric. Flip requires human `approved`.

---

## No Analog Found

None. Every file has an exact or role-match analog in the repo. The two "novel" pieces
(`co-votacion-red-guard.test.ts` static scan; the `SimilitudVotacionComparar` neutral
display) are assembled from existing helpers/structures, not net-new patterns.

---

## Wave Ordering (from RESEARCH Test Map — planner input)

- **Wave 0 (guards + allowlist + migration WRITTEN, BEFORE copy):** `vsim-gate.ts` + test, `vsim-antiflip-guard.test.ts`, `.env.example` line, `anti-insinuacion-guard.test.ts` extension, `co-votacion-red-guard.test.ts` + dead-branch removal, `0068_*.sql` written, `coincidencia_votos_par` allowlist entry.
- **Wave 1 (DB):** apply 0068 via psql; pgTAP green against applied schema.
- **Wave 2 (copy + mount):** `similitud-votacion-comparar.tsx`, `comparar/page.tsx` 5th gated section, `page.test.tsx` ON/OFF cases, dossier.

---

## Metadata

**Analog search scope:** `app/lib/`, `app/components/`, `app/components/red/`, `app/app/comparar/`, `supabase/migrations/`, `supabase/tests/`, `docs/legal/`, repo-root `.env.example`
**Files scanned (read/grep):** money-gate.ts, money-gate.test.ts, money-antiflip-guard.test.ts, 0067_*.sql, 0067_*.test.sql, anti-insinuacion-guard.test.ts, comparar/page.tsx, comparar/page.test.tsx, relaciones-eje-comparar.tsx, red-graph.tsx, arista-hecho.tsx, red-graph.test.tsx, lockdown-guard.test.ts, .env.example, 13-LEGAL-DOSSIER.md
**Pattern extraction date:** 2026-07-24
