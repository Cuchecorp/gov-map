---
phase: 49-acomp-comparativo-de-ausencias-vs-c-mara
reviewed: 2026-07-08T03:58:39Z
depth: deep
files_reviewed: 5
files_reviewed_list:
  - supabase/migrations/0050_tasa_ausencia_comparada.sql
  - supabase/tests/0050_tasa_ausencia_comparada.test.sql
  - app/components/ausencias-contexto.tsx
  - app/lib/types.ts
  - app/lib/lockdown-guard.test.ts
findings:
  critical: 0
  warning: 2
  info: 3
  total: 5
status: clean
resolved_at: 2026-07-08
resolved_commits:
  - c41c1be  # WR-01 cohorte pgTAP discriminante + IN-02 mensaje
  - cab50f3  # IN-01 guard de K
  - ffef396  # IN-03 doc mediana-de-tasas (migracion + tipo)
  # WR-02: verificado (sin cambio de codigo) — ver nota abajo
---

# Phase 49: Code Review Report

**Reviewed:** 2026-07-08T03:58:39Z
**Depth:** deep
**Files Reviewed:** 5
**Status:** clean (all findings resolved/verified 2026-07-08)

> RESOLUCIÓN (2026-07-08): 2 WR + 3 IN cerrados. WR-01/IN-01/IN-02/IN-03 corregidos
> (commits c41c1be, cab50f3, ffef396); WR-02 VERIFICADO sin cambio de código (ver
> nota). Suite root 720 verde, `tsc -b` limpio. Las migraciones 0050 NO se aplican en
> este pase (solo enmiendas de comentario in-place); el pgTAP lo corre el operador el
> día del apply. Los cambios frontend viajan con el próximo deploy.

## Summary

Security-sensitive review of the ACOMP surface: the `tasa_ausencia_comparada` RPC
(0050), its pgTAP (0050 test), the `ausencias-contexto.tsx` presentation sub-block, the
`AusenciaContextoRow` type, and the lockdown-guard allowlist entry. Adversarial focus:
SQL injection, PII leakage, ACL (secdef + `search_path=''` + double-revoke + zero grant),
median correctness (`percentile_cont` vs `disc`, universe, subject's cámara), div/0,
anti-insinuación (implicit ranking), verdict-by-color, and degrade that could swallow a
real error.

**Security posture is sound.** The RPC is `security definer set search_path = ''` with all
object references schema-qualified (`public.parlamentario`, `public.voto`); the parameter
`p_parlamentario_id` is used only in equality predicates inside a `language sql` body (no
dynamic SQL, no `format`/`execute` → no injection surface). The `returns table` emits only
counts, neutral ratios and `camara` — never `partido`/`rut`/`email`/`nombre` (LEGAL-03
respected, asserted by pgTAP test 6). The double revoke (`from public` + `from anon,
authenticated`) with zero grant is a verbatim mirror of 0049's Camino-A ACL, and the
lockdown-guard allowlist correctly adds `tasa_ausencia_comparada` (no grant statement in the
migration, so guard Block-A stays green). The div/0 guard (`having count(*) >= 1` →
`m >= 1`) is correct, and the empty-honesto path (M=0 / non-existent subject → 0 rows) is
proven by pgTAP test 10.

**Median correctness is correct as written.** `percentile_cont(0.5) within group (order by
n::numeric / m)` computes the median of the per-parlamentario absence *rates* over the
subject's own cámara — the honest interpretation, and `percentile_cont` (interpolated) is a
defensible choice for a rate in [0,1]. The cámara filter (`join subj on subj.camara =
p.camara`) is deterministic (`parlamentario.id` is PK, `camara` is NOT NULL). No
`ORDER BY` on a multi-row result exists (the result is a single row), so the 0049 WR-01
neutral-order lesson does not apply here.

No blockers. Two warnings: (1) the degrade branch keys ONLY on `error?.code === "PGRST202"`
— a different pre-apply error shape (e.g. a `PGRST203`/schema-cache variant or a null-code
network error) would fall through to `throw`, which is the *intended* fail-loud behavior but
worth pinning against the exact codes cruces-de-proyecto relies on; and (2) `percentile_cont`
vs `percentile_disc` is a genuine contract decision the pgTAP only exercises on a symmetric
3-point cohort where both agree — the test cannot distinguish them. Three info items.

## Warnings

### WR-01: pgTAP median assert cannot distinguish `percentile_cont` from `percentile_disc`

**RESUELTO (c41c1be):** cohorte cambiada de `{0.25,0.50,0.75}` (simétrica, `_cont`=`_disc`=0.50)
a `{0.10,0.20,0.60,0.90}` (par, con gap central) → `percentile_cont(0.5)`=0.40 INTERPOLADO,
distinto de `_disc`=0.20 y de `avg`=0.45. El assert (8) ahora pinea `percentile_cont`
específicamente; una regresión a `_disc` o `avg` fallaría. Fixture y asserts (7)(8)(9)(10)
ajustados (m=10, 4 miembros + PTEST_E para el caso M=0). La migración 0050 NO se tocó.

**File:** `supabase/tests/0050_tasa_ausencia_comparada.test.sql:122-126`
**Issue:** Test 8 asserts `mediana_camara = 0.50` over the cohort `{0.25, 0.50, 0.75}`. For
an odd-sized cohort with a member exactly at the center, `percentile_cont(0.5)` and
`percentile_disc(0.5)` return the **same** value (0.50). So this assert does NOT verify that
the RPC uses the interpolated (`_cont`) median the contract claims — a regression to
`percentile_disc`, or to `avg`, would still pass. On a real even-sized cohort the two
diverge (e.g. `{0.2, 0.4}` → `_cont`=0.30 but `_disc`=0.20), and the choice materially
changes the published "mediana de su cámara". The distinguishing case is untested.
**Fix:** Add a fourth cohort member so the set is even-sized with a gap at the center (e.g.
rates `{0.25, 0.50, 0.75, 1.00}` → `_cont`=0.625, `_disc`=0.50 or 0.75 depending on impl),
and assert the interpolated value — this pins `percentile_cont` specifically. Alternatively
add a 2-member cohort case where `_cont` interpolates.

### WR-02: Degrade branch trusts a single exact error code (`PGRST202`) — verify it is the only pre-apply shape

**VERIFICADO (sin cambio de código):** el check en `votos-por-parlamentario.tsx:1046`
(`acError?.code === "PGRST202"`) es byte-idéntico en estructura al de
`cruces-de-proyecto.tsx:253` (`error?.code === "PGRST202"`) — mismo código, mismo patrón,
mismo fail-loud para cualquier otro error (grep confirma: ambos gatean SOLO por
`code === "PGRST202"`, sin fallback por regex de mensaje). El probe real en PROD ya
ocurrió: el smoke de 49-03 confirmó el degrade honesto pre-apply (la RPC ausente →
PGRST202 → sub-bloque omitido, capa-1 intacta, sin 500). Este es exactamente el mismo
código que PostgREST retorna para function-not-found y el que `cruces-de-proyecto` (ya
aplicado y en PROD) usa. No se justifica sobre-ingeniería (regex de mensaje adicional);
la paridad exacta con el patrón ya probado en PROD es la garantía. `lobby-en-tramitacion`
también replica el mismo patrón con test de regresión (WR-01 de esa fase).

**File:** `app/components/votos-por-parlamentario.tsx:1046-1055`
**Issue:** The degrade omits the sub-block only when `acError?.code === "PGRST202"`; any
other error throws. This is the correct fail-loud posture (no falsa exoneración — a real DB
error must not degrade to a silent empty). The risk is the inverse: if PostgREST/Supabase
returns a *different* not-found signal for a missing function in some client/version
(schema-cache-miss variants have historically surfaced as different codes/messages), a
legitimate pre-apply deploy would **throw a 500** on the parlamentario page instead of
degrading. The 49-UI-SPEC pins this pattern as "mirror cruces-de-proyecto.tsx (lines
253-264)" — confirm the code compared there is byte-identical, because the whole
deploy-before-apply story depends on this exact string matching what PROD returns pre-apply.
**Fix:** Confirm (against the applied cruces-de-proyecto degrade and a real pre-apply probe)
that `PGRST202` is the exact code returned for a missing function. If there is any variability,
match on the documented set (or on `code === "PGRST202"` OR a message test for
"Could not find the function"). Add a regression fixture asserting the degrade branch fires
for the exact `{ code: "PGRST202" }` shape and throws for any other.

## Info

### IN-01: Component renders `k_parlamentarios` unconditionally under `hayMediana` — no fabrication guard on K

**RESUELTO (cab50f3):** `hayMediana` ahora exige `typeof data.k_parlamentarios === "number"
&& data.k_parlamentarios >= 1` además de `mediana_camara` numérica — misma disciplina
anti-fabricación que la línea propia.

**File:** `app/components/ausencias-contexto.tsx:44,72-82`
**Issue:** `hayMediana` gates only on `typeof data.mediana_camara === "number"`, then the
median line renders `data.k_parlamentarios` with no check that K is a valid number. The RPC
contract guarantees `K >= 1` whenever a row exists, so this is safe today — but the
component's own stated philosophy ("si una cifra falta se OMITE esa línea, nunca se inventa")
is applied to `mediana_camara` and to `n/m` but not to `k`. If the RPC contract ever drifted
(median present, K null), the UI would print "(null parlamentarios)".
**Fix:** Extend the guard to `hayMediana = typeof data.mediana_camara === "number" &&
typeof data.k_parlamentarios === "number" && data.k_parlamentarios >= 1;` — consistent with
the fabrication-guard discipline already applied to the own-rate line.

### IN-02: pgTAP assert (2) message says "6 columnas" but pins 7 names — cosmetic mismatch

**RESUELTO (c41c1be):** el mensaje ahora dice "declara p_parlamentario_id + las 6 columnas
del returns table en el orden pineado del contrato".

**File:** `supabase/tests/0050_tasa_ausencia_comparada.test.sql:28-33`
**Issue:** The pinned `proargnames` string correctly includes `p_parlamentario_id` plus the
6 return columns (7 names total, because `proargnames` includes the IN parameter), but the
assert message reads "emite las 6 columnas". The assertion itself is correct and strict; only
the human-facing message undercounts. Comment at line 27 ("7 nombres") is right — the message
string at line 33 is the one that drifts.
**Fix:** Reword the message to "declara p_parlamentario_id + las 6 columnas del returns table
en el orden pineado" to match the comment and the actual pin.

### IN-03: Median statistic (rate-of-rates) is a non-obvious choice — worth an explicit note in the returns doc

**RESUELTO (ffef396):** nota añadida en el CTE `cohorte` de 0050 y en
`AusenciaContextoRow.mediana_camara`: "mediana de las TASAS individuales (n/m por
parlamentario), NO la tasa agregada/pooled (Σn/Σm)". La migración 0050 no está aplicada →
enmienda de comentario in-place segura.

**File:** `supabase/migrations/0050_tasa_ausencia_comparada.sql:105-111`, `app/lib/types.ts:413`
**Issue:** `mediana_camara` is the median of each parlamentario's individual absence *ratio*
(`n/m`), i.e. an unweighted "median of rates". An alternative reading of "mediana de la
cámara" could be the pooled rate (Σn / Σm). The two differ when parlamentarios have very
different `m`. The chosen statistic is defensible and honest (it is the median colleague's
personal rate, which is what a reader intuits), but the distinction is subtle and the code
comment/type doc does not state which one it is — a future maintainer could "fix" it toward
the pooled rate and silently change every published median. This is a documentation gap, not
a bug.
**Fix:** Add one line to the RPC comment and the `AusenciaContextoRow.mediana_camara` doc:
"mediana de las TASAS individuales (n/m por parlamentario), NO la tasa agregada (Σn/Σm)".

---

_Reviewed: 2026-07-08T03:58:39Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
