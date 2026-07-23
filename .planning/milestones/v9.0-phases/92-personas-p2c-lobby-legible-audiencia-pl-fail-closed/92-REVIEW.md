---
phase: 92-personas-p2c-lobby-legible-audiencia-pl-fail-closed
reviewed: 2026-07-22T16:05:00Z
depth: standard
files_reviewed: 10
files_reviewed_list:
  - app/lib/boletin-en-materia.ts
  - app/lib/boletin-en-materia.test.ts
  - supabase/migrations/0062_lobby_menciones_de_boletin.sql
  - supabase/tests/0062_lobby_menciones_de_boletin.test.sql
  - app/components/mencion-boletin-chip.tsx
  - app/components/lobby-de-parlamentario.tsx
  - app/components/lobby-menciones-de-boletin.tsx
  - app/app/parlamentario/[id]/page.tsx
  - app/app/proyecto/[boletin]/page.tsx
  - app/lib/anti-insinuacion-guard.test.ts
  - app/lib/lockdown-guard.test.ts
findings:
  critical: 1
  warning: 3
  info: 2
  total: 6
status: fixed
fixed_at: 2026-07-22T16:10:00Z
fixed_commits:
  CR-01: 8b34c2b
  WR-01: 6d6fa7b
  WR-02: 8b34c2b
  WR-03: 8b34c2b
  IN-01: 8b34c2b
migration_applied: 0063_lobby_menciones_una_fila_por_audiencia.sql (PROD, psql --single-transaction)
pgtap: 21/21 verde contra schema aplicado
cobertura_remedida: 5106|195|82 (INALTERADA — se mide por audiencia distinta)
test_gate: app 1158/1158 + tsc 0 errores
---

# Phase 92: Code Review Report

**Reviewed:** 2026-07-22T16:05:00Z
**Depth:** standard
**Files Reviewed:** 10
**Status:** issues_found

## Summary

Phase 92 wires the audiencia→PL fail-closed channel: an extractor (`extraerBoletines`) plus a mirror SQL RPC (`lobby_menciones_de_boletin`, 0062) that surface lobby audiences whose `materia` explicitly mentions a boletín number. The riesgo #1 (fabricated links from "Ley 20.730", years, money) is genuinely closed on **both** sides — I traced the context-gated pattern against the star cases and confirmed both the TS extractor and the SQL branches reject `Ley 20.730`, bare numbers without the `boletín` trigger, years, and decimal separators. The double fail-closed (explicit mention + existence in `proyecto`) holds; the identity gate (`estado_vinculo='confirmado'` + non-null `parlamentario_id`) holds; PII is minimized (no `rut`/`contraparte_id`); the anti-insinuación linter correctly subtracts the negated legends; degrade-honesto (PGRST202→null) is code-level correct.

However, there is **one BLOCKER**: the proyecto-side view (`LobbyMencionesView`) renders one `<li>` per raw RPC row, but the RPC `left join`s `lobby_contraparte` — an audiencia with multiple contrapartes produces multiple rows, causing duplicate React keys, a **dishonest `total_n` count**, and the same audiencia rendered N times. This case is entirely untested by the pgTAP (which inserts zero contrapartes). Three WARNINGs concern a real TS↔SQL divergence on trailing periods and the overstated "equivalence guard" coverage.

## Critical Issues

### CR-01: `LobbyMencionesView` fans out one `<li>` per contraparte, not per audiencia → dishonest count + duplicate keys + duplicated rows

**STATUS: FIXED** (commit `8b34c2b`, migración 0063 aplicada a PROD). La RPC ahora emite UNA
FILA POR AUDIENCIA (contrapartes agregadas por `identificador` vía lateral `string_agg`), y
`total_n = count(*) over ()` cuenta AUDIENCIAS distintas. Con la RPC fija, la vista existente
ya no puede colisionar keys ni inflar el conteo (un `identificador` = una fila) — el fix vive
en el DDL, no se requiere cambio de vista. Nombres de columna PRESERVADOS (rol/representado
NULL) → la vista vieja del deploy vivo (fa4d4369) sigue funcionando; el fix de UI (agrupar en
la vista) viaja en 93/94 pero ya no es load-bearing para la corrección. NOTA HONESTA: 0
audiencias en PROD tienen hoy >1 contraparte → el bug era LATENTE (ningún boletín real fanea
actualmente; runbook 16849-12=13 filas/13 audiencias correcto). El fix es defensa-en-
profundidad + el pgTAP (T92AW7, 2 contrapartes) prueba la robustez. pgTAP 21/21.

**File:** `app/components/lobby-menciones-de-boletin.tsx:232-236` (view) and `supabase/migrations/0062_lobby_menciones_de_boletin.sql:112` (source of the fan-out)

**Issue:** The RPC does `left join public.lobby_contraparte c on c.identificador = a.identificador` with **no `GROUP BY` / no `DISTINCT`**. `lobby_contraparte` is `unique (identificador, nombre, rol)` (0021_lobby.sql:81) — an audiencia legitimately has *multiple* contrapartes, so the join emits **one row per (audiencia × contraparte)**. `LobbyMencionesView` consumes these raw rows directly:

```tsx
{rows.map((r, idx) => (
  <FilaMencion key={r.identificador ?? idx} row={r} />
))}
```

Consequences for any audiencia with ≥2 contrapartes:
1. **Duplicate React keys** — `key={r.identificador}` collides (same `identificador` repeated) → React reconciliation warning/bug.
2. **Dishonest count** — `total_n = count(*) over ()` counts contraparte-rows, so the "N audiencias registradas mencionan este boletín" line (line 210-221) over-reports. This directly violates the phase's "total_n honesto" claim.
3. **Duplicated display** — the same audiencia (same parlamentario, same materia, same fecha) renders 2–3 times.

This is *the same fan-out* the parlamentario side explicitly handles via `agruparAudiencias` (`lobby-de-parlamentario.tsx:584`, "left join → una fila por contraparte"). The menciones section skipped that step. The pgTAP passed only because its fixtures (`0062_...test.sql:46-55`) insert **zero** `lobby_contraparte` rows, so every audiencia yields exactly one row and the `total_n=2` assertion never exercises the fan-out.

**Fix:** De-duplicate by audiencia. Either (a) collapse contrapartes into a single row per `identificador` in the RPC (`group by` + `string_agg`/`array_agg` for the contraparte fields, and compute `total_n` over the distinct-audiencia set), or (b) re-group in the view before render, mirroring `agruparAudiencias`. SQL option (a), preserving the honest window count over distinct audiencias:

```sql
-- inside the inner select, aggregate contrapartes per audiencia:
select a.identificador, a.fecha, a.materia, a.parlamentario_id,
       coalesce(nullif(trim(concat_ws(' ', p.nombres, p.apellido_paterno, p.apellido_materno)), ''), p.nombre_normalizado) as parlamentario_nombre,
       string_agg(distinct c.nombre, ' · ') as contraparte_nombre,   -- collapse N contrapartes
       ...
from public.lobby_audiencia a
join public.proyecto pr on ...
join public.parlamentario p on p.id = a.parlamentario_id
left join public.lobby_contraparte c on c.identificador = a.identificador
cross join pat
where ...
group by a.identificador, a.fecha, a.materia, a.parlamentario_id, p.nombres, p.apellido_paterno, p.apellido_materno, p.nombre_normalizado, ...
-- then count(*) over () over the grouped set = honest audiencia count
```
And add a pgTAP fixture that inserts ≥2 `lobby_contraparte` rows for one audiencia and asserts the audiencia appears exactly once with `total_n` counting it once.

## Warnings

### WR-01: TS↔SQL divergence — `extraerBoletines` drops a bare-base mention followed by a period; SQL matches it

**STATUS: FIXED** (commit `6d6fa7b`). `NUMERO_SIN_SUFIJO` ahora usa `(?![\d]|\.\d|-\d)` — rechaza
SOLO continuación de token (otro dígito, `.`+dígito de miles/decimal, `-`+dígito de sufijo) y
PERMITE el punto/coma de fin de oración. Verificado: `extraerBoletines("boletín 14309.")` →
`["14309"]`; el decimal/dinero (`$12.345`, `3.14%`) se sigue rechazando. Copia inline del guard
actualizada; fixtures añadidos (`"boletín 14309."`, `"sobre boletín 20730. Fin"`, `"boletín
14309, y otros"`) + pgTAP T92AW8. vitest 20/20, pgTAP test 14 verde.

**File:** `app/lib/boletin-en-materia.ts:48` (`NUMERO_SIN_SUFIJO`) vs `supabase/migrations/0062_lobby_menciones_de_boletin.sql:133` (branch b)

**Issue:** The bare-number regex `(\d{1,3}(?:\.\d{3})*|\d{3,6})(?![\d.-])` uses a negative lookahead `(?![\d.-])` intended to exclude decimals/dinero, but it **also rejects a boletín that ends a sentence with a period**. Verified:
- `extraerBoletines("boletín 14309.")` → `[]`
- `extraerBoletines("sobre boletín 20730. Fin")` → `[]`
- (comma, semicolon, paren, trailing space all work correctly)

The SQL branch (b) `... base_dot\M(?!-[[:digit:]])` correctly *allows* a trailing period (`\M` matches before `.`, and `(?!-[[:digit:]])` only blocks a hyphen+digit). So the **proyecto page (SQL) shows the audiencia while the parlamentario page (TS) omits the chip** for the identical materia. Direction is safe (TS false-negative, never fabricates), but it is a real behavioral inconsistency and drops legitimate mentions that end a sentence — common in free-text `materia`. Note branch (a) (suffix form) is unaffected (`\b` after the suffix handles the period).

**Fix:** Tighten the lookahead to exclude only decimal continuation, not a sentence period. Replace `(?![\d.-])` with a lookahead that rejects `.` **only when followed by a digit** (a real thousands/decimal separator), and rejects a hyphen only when followed by a digit (the suffix already captured by branch a):

```ts
// Reject decimal/thousands continuation (".\d") and suffix continuation ("-\d"),
// but ALLOW a trailing sentence period ("14309." at end of clause).
const NUMERO_SIN_SUFIJO = /(\d{1,3}(?:\.\d{3})*|\d{3,6})(?![\d]|\.\d|-\d)/g;
```
Then add `["boletín 14309.", ["14309"]]` and `["sobre boletín 20730. Fin", ["20730"]]` to `FIXTURE_MATERIA` and the pgTAP so the equivalence is actually asserted.

### WR-02: The "equivalence guard TS↔SQL" is overstated — the pgTAP hardcodes 6 cases and never iterates `FIXTURE_MATERIA`

**STATUS: FIXED** (commit `8b34c2b`). El pgTAP se amplió con los casos de `FIXTURE_MATERIA`
antes ausentes en SQL: base pelada tras gatillo con punto final (T92AW8), multi-boletín en una
materia (T92AW9, `"boletines 14309-04 y 15000-07"`), y base PUNTEADA tras gatillo (T92AWA,
`"boletín 14.309"`). Tests 14/15/16 verdes. (Se optó por expandir la cobertura de branches
distintos en vez de materializar el fixture completo en SQL — cada rama del extractor TS tiene
ahora su aserción espejo.)

**File:** `supabase/tests/0062_lobby_menciones_de_boletin.test.sql:46-100` vs `app/lib/boletin-en-materia.test.ts:20-45`

**Issue:** The JSDoc (boletin-en-materia.ts:37-39) and the pgTAP header both claim the shared `FIXTURE_MATERIA` is the equivalence anchor ("filas mencionadas vs no-mencionadas contra el fixture compartido"). In reality the pgTAP inserts only 6 bespoke materias (`T92AW1`–`T92AW6`) and never iterates `FIXTURE_MATERIA`. Cases present in the TS fixture but **unverified in SQL**: bare-base-only mention (`"boletín 20730"` with no suffix), multi-boletín in one materia (`"boletines 14309-04 y 15000-07"`), punteado base (`"boletín 14.309"`), and the `12345`-excluded-without-trigger case. The divergence in WR-01 is exactly the kind of gap this weak coupling hides.

**Fix:** Either drive the pgTAP from a materialized copy of `FIXTURE_MATERIA` (e.g. a values-list generated from the same source), or expand the pgTAP to cover every distinct branch of `FIXTURE_MATERIA` and add a comment cross-referencing each TS fixture row to its SQL assertion. At minimum add the base-only and multi-boletín cases.

### WR-03: pgTAP never inserts a `lobby_contraparte` row → the multi-contraparte fan-out (CR-01) is structurally untestable by the current suite

**STATUS: FIXED** (commit `8b34c2b`). Se añadió la audiencia T92AW7 con DOS filas
`lobby_contraparte` (nombre/rol distintos). Aserciones nuevas: (f-1) T92AW7 aparece
EXACTAMENTE 1 vez (`count = 1`, no per-contraparte); (f-2) ambas contrapartes se AGREGAN en
`contraparte_nombre` (ninguna se pierde); (f-3) `total_n == count(distinct identificador)`
(audiencia multi-contraparte contada 1 vez). Este test FALLABA contra la RPC 0062 y PASA
contra 0063 — cierra el hueco estructural. Tests 17/18/19 verdes.

**File:** `supabase/tests/0062_lobby_menciones_de_boletin.test.sql:46-55, 93-100`

**Issue:** Every fixture audiencia is inserted with **no** contraparte, so the `left join` always yields exactly one row per audiencia and both `total_n` assertions (`= 2`, and `count(distinct total_n) = 1`) pass trivially. The test therefore *cannot* catch CR-01: it asserts count honesty precisely in the one configuration where the bug is invisible. The SUMMARY's claim that `total_n` is "honesto" is unverified against the real (multi-contraparte) shape.

**Fix:** Add a fixture: one confirmed audiencia (e.g. `T92AW7`) mentioning `14309-04` with **two** `lobby_contraparte` rows (distinct `nombre`/`rol`). Assert `count(*) from lobby_menciones_de_boletin('14309-04') where identificador = 'T92AW7'` equals **1** (audiencia counted once, not per-contraparte) and that `total_n` counts it once. This test should fail against the current RPC and pass after the CR-01 fix.

## Info

### IN-01: RPC concatenates `p_boletin` into a regex without internal sanitization (defense-in-depth)

**STATUS: FIXED** (commit `8b34c2b`, en 0063). Guard interno al tope de la RPC: `req.ok =
p_boletin ~ '^(\d{3,6}|\d{1,3}(\.\d{3})+)(-\d{1,2})?$'` (espejo de `BOLETIN_RE`, acepta plano
y punteado, con/sin sufijo). Si `ok=false`, el `where pat.ok` corta a 0 filas ANTES de
construir/aplicar el patrón → metacaracteres regex o base vacía (`(|)`, `''`) NUNCA producen
falsos positivos. El fail-closed ya no depende de que cada caller valide. pgTAP tests 20/21
verdes (`'(|)'` → 0 filas, `''` → 0 filas).

**File:** `supabase/migrations/0062_lobby_menciones_de_boletin.sql:76-90, 122, 133`

**Issue:** `base` is derived from `p_boletin` and concatenated raw into regex strings (`base_dot`, and the `~`/`~*` patterns). This is safe **today** only because the sole caller (`LobbyMencionesSection`) is reached from `/proyecto/[boletin]`, which validates against `BOLETIN_RE = /^\d{3,6}(-\d{1,2})?$/` before rendering. But `lobby_menciones_de_boletin` is in `PUBLIC_RPC_ALLOWLIST` (lockdown-guard) — invokable from anywhere in the tree — and the RPC itself does not constrain `p_boletin` (no `base` length/format check). A future caller passing an unvalidated `p_boletin` with regex metacharacters (or an empty base → `base_dot = (|)` matching everywhere) would cause pattern misbehavior or false positives.

**Fix:** Add an internal guard at the top of the RPC: if `p_boletin !~ '^\d{3,6}(-\d{1,2})?$'` return zero rows early (or `raise`), so the fail-closed does not depend on every caller remembering to validate.

### IN-02: `RailSkeleton` fixed entry count undercounts when `autores` entry is present (minor CLS)

**File:** `app/app/proyecto/[boletin]/page.tsx:674` vs `ProyectoRail.navEntries:283-319`

**Issue:** `RailSkeleton` hardcodes `nEntries = crucesPublicEnabled ? 10 : 9`, but `ProyectoRail` conditionally adds an `autores` entry only when `nAutores > 0` (line 296-298). So the real rail is 10/11 (autores present) or 9/10 (no autores), while the skeleton always assumes no-autores. Projects with authors get a 1-row layout shift on rail resolution. This conditionality predates Phase 92 (Phase 92 only added the always-present `lobby-menciones` entry and correctly bumped the base), so it is a pre-existing minor issue surfaced here, not introduced by this phase.

**Fix:** If exact anti-CLS matching is desired, derive the skeleton count with the same authors signal (or accept the ±1 as acceptable jitter and document it). Low priority.

---

_Reviewed: 2026-07-22T16:05:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
