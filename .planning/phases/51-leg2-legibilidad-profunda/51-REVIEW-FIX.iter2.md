---
phase: 51-leg2-legibilidad-profunda
fixed_at: 2026-07-03T13:35:00Z
review_path: .planning/phases/51-leg2-legibilidad-profunda/51-REVIEW.md
iteration: 1
findings_in_scope: 8
fixed: 8
skipped: 0
tests_passed: true
test_command: "pnpm --dir app test -- --run"
status: all_fixed
---

# Phase 51: Code Review Fix Report

**Fixed at:** 2026-07-03T13:35:00Z
**Source review:** .planning/phases/51-leg2-legibilidad-profunda/51-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 8 (3 Critical + 5 Warning; scope = critical+warning, 6 Info fuera de alcance)
- Fixed: 8
- Skipped: 0
- Test gate: PASSED (`pnpm --dir app test -- --run`)

## Test Gate

- **PASSED** — `pnpm --dir app test -- --run` exited 0 after all fixes: **47 test files, 489 tests green** (la suite creció desde 483 con los casos nuevos de WR-03/WR-04). `pnpm --dir app exec tsc -b` limpio tras cada fix TS.
- Nota: los pgTAP de 0047 (`supabase/tests/0047_rebeldias_honestas.test.sql`, ahora `plan(10)`) NO corren en vitest — los ejecuta el operador vía `psql -tA -f` el día del apply (checkpoint conocido; la migración 0047 aún NO está aplicada a PROD, por lo que editarla en sitio fue seguro, sin drift).

## Fixed Issues

### CR-01: Migración 0047 re-concedía EXECUTE a `anon` contradiciendo el lockdown 0044

**Files modified:** `supabase/migrations/0047_rebeldias_honestas.sql`, `supabase/tests/0047_rebeldias_honestas.test.sql`
**Commit:** 5324520
**Applied fix:** Opción A (recomendada, mínima superficie). Se ELIMINÓ el `grant execute ... to anon` (el sitio lee con service_role, que bypassa ACL; anon = cero grants desde 0044). Se corrigió la prosa stale ("status quo 0019" → el status quo real post-0044 es DENY) en la cabecera y en el bloque ACL. El assert (5) del pgTAP 0047 se INVIRTIÓ a `not has_function_privilege('anon', ...)`, espejo exacto de `post-apply/0044_revoke_anon.test.sql:91` — los dos artefactos de verificación ya no son mutuamente excluyentes y la re-corrida periódica del pgTAP post-apply conserva su señal.

### CR-02: `mode()` con empate fabricaba una "mayoría de bancada" inexistente

**Files modified:** `supabase/migrations/0047_rebeldias_honestas.sql`, `supabase/tests/0047_rebeldias_honestas.test.sql`
**Commit:** db27fd1 — **fixed: requires human verification** (lógica SQL; el pgTAP que la prueba corre solo al apply del operador, no en CI)
**Applied fix:** El CTE `mayoria` ya no usa `mode()`: agrupa por (votación, selección), calcula `rank() over (partition by votacion_id order by count(*) desc)`, se queda con `rk = 1` y exige `having count(*) = 1` — exactamente UNA opción mayoritaria o la votación se EXCLUYE (sin mayoría única no se afirma disidencia). pgTAP: `plan(9)` → `plan(10)`, fixture nuevo de bancada empatada (PART_EMPATE: 2 'si' / 2 'no' en vtest:1) y assert (10): `rebeldias_de_parlamentario('PTEST_E1')` = 0 filas (bajo `mode()` habría emitido una fila falsa). **Verificar la lógica del CTE en el checkpoint de apply (pgTAP 10/10).**

### CR-03: Exención del lockdown-guard bypasseable con GRANT multi-función

**Files modified:** `app/lib/lockdown-guard.test.ts`
**Commit:** 763b677
**Applied fix:** Resolución preferida (consecuencia de CR-01): la exención quedó SIN caso de uso → se REVIRTIÓ `anonGrantOffenders` al guard estricto original (todo `grant … to anon` en migraciones > 0044 es offender, sin carve-outs). Esto elimina el bypass multi-función de raíz. Los tests sintéticos se conservaron/adaptaron para documentar que TODO grant a anon queda bloqueado, incluyendo: (a) grant execute de RPC allowlisted, (b) grant select de tabla, (c) **lista multi-función en una sentencia (el bypass histórico)**, (d) grant execute de función no listada. El doc-comment registra por qué se revirtió la decisión LOCKED de Phase 51 (premisa stale post-0044 + bypasseable). Guard verde contra el árbol real (0047 ya no tiene grant).

### WR-01: 0047 omitía el doble-revoke del idiom 0041

**Files modified:** `supabase/migrations/0047_rebeldias_honestas.sql`
**Commit:** 8d00080
**Applied fix:** Se re-emitió `revoke all on function rebeldias_de_parlamentario(text) from anon, authenticated;` tras el `from public` (idiom 0041:50-51). Con el grant eliminado (CR-01), este doble revoke es el estado ACL final correcto y determinista sea cual sea el rol que aplique el DDL (cubre los default privileges de `supabase_admin` vía SQL editor del dashboard).

### WR-02: `?a`/`?b`/`?comparar` llegaban sin validar al cast `date[]` (500 con URL manipulada)

**Files modified:** `app/components/patrimonio-de-parlamentario.tsx`
**Commit:** 1c964ec
**Applied fix:** Validación fail-safe antes de invocar `comparar_declaraciones`: `ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/`, se filtran las fechas no-ISO y si quedan < 2 la comparación se trata como AUSENTE (degrade honesto, espejo de `normalizarVista`). `?a=zzz&b=zzz` o `?comparar=x,y` ya no tumban la ficha completa.

### WR-03: El colapso de urgencias contaba un "retira la urgencia" como renovación

**Files modified:** `app/components/timeline-view.tsx`, `app/components/timeline-view.test.tsx`
**Commit:** a4f2afd
**Applied fix:** Nuevo helper exportado `esRetiroUrgencia` (`/retira/i`); en `construirItems` los retiros NO son colapsables (cortan el run y se renderizan como `TimelineEvent` normal, siempre visibles — espejo de `urgenciaVigente` en estado-actual-block). Copy neutra sin semántica de renovación: `"Urgencia {tipo}: {n} eventos {rango}"` (el conteo "renovada N veces" incluía la presentación inicial). Tests: pin actualizado + assert de que "renovada" NUNCA aparece + 2 casos nuevos (retiro fuera del período y visible como hito; par [hace presente, retira] no forma período).

### WR-04: Fechas época-Unix fabricadas ("ene 1970") en la línea de período colapsado

**Files modified:** `app/components/timeline-view.tsx`, `app/components/timeline-view.test.tsx`
**Commit:** 8a7b095
**Applied fix:** `PeriodoUrgencia.desde/hasta` ahora son `Date | null` derivados SOLO de las fechas válidas del run (`fechaValida`); si ningún evento del run tiene fecha válida → `null` y `periodoLinea` OMITE el rango ("Urgencia {tipo}: {n} eventos"), nunca epoch. Sin consumidores externos del tipo (verificado por grep). Test nuevo: run sin fechas válidas → sin "1970" y sin rango; run con fecha inválida mezclada → rango solo con las válidas.

### WR-05: `stripTsComments` truncaba líneas en `//` dentro de strings (falso negativo del escáner)

**Files modified:** `app/lib/lockdown-guard.test.ts`, `app/app/layout.test.tsx`
**Commit:** 78ecad7
**Applied fix:** `line.indexOf("//")` → `line.search(/(?<!:)\/\//)` en ambos strippers (mismo idiom): un `//` precedido de `:` (URLs `http://`/`https://` en string literals) ya no se trata como comentario, así que una línea `const u = "https://x.cl"; await sb.rpc("...")` ya no queda truncada antes del `.rpc(` — se cierra el punto ciego del control CI de la superficie Camino A.

## Notas de ejecución

- Todo el trabajo corrió en un worktree aislado (`gsd-reviewfix/51-18016`) y se integró a `master` vía fast-forward (`12f8090` → `78ecad7`, 8 commits). Worktree, rama temporal y sentinel de recuperación limpiados.
- Interacción CR-01 ↔ CR-03: al eliminar el grant (CR-01, Opción A), el refinamiento del guard quedó sin caso de uso; la reversión al guard estricto (CR-03) elimina el bypass multi-función de raíz en vez de parcharlo.
- Checkpoint de operador pendiente (pre-existente, no introducido aquí): aplicar 0047 vía `psql --single-transaction` y correr el pgTAP `0047_rebeldias_honestas.test.sql` (ahora 10 asserts, incluye empate de bancada) + re-correr `post-apply/0044_revoke_anon.test.sql` (ahora consistente con 0047).

---

_Fixed: 2026-07-03T13:35:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
