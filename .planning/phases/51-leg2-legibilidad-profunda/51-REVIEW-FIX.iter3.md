---
phase: 51-leg2-legibilidad-profunda
fixed_at: 2026-07-03T13:52:00Z
review_path: .planning/phases/51-leg2-legibilidad-profunda/51-REVIEW.md
iteration: 2
findings_in_scope: 3
fixed: 3
skipped: 0
tests_passed: true
test_command: "pnpm --dir app test -- --run"
status: all_fixed
---

# Phase 51: Code Review Fix Report (iteración 2)

**Fixed at:** 2026-07-03T13:52:00Z
**Source review:** .planning/phases/51-leg2-legibilidad-profunda/51-REVIEW.md (re-review iter 2)
**Iteration:** 2

**Summary:**
- Findings in scope: 3 (1 Critical + 2 Warning; scope = critical+warning — IN-07/IN-08 fuera de alcance, documentados abajo)
- Fixed: 3
- Skipped: 0
- Test gate: PASSED (`pnpm --dir app test -- --run`)

## Test Gate

- **PASSED** — `pnpm --dir app test -- --run` exited 0 tras los 3 fixes: **47 test files, 496 tests green** (489 → 496: +7 tests unitarios de `esFechaISOValida`, WR-06). `pnpm --dir app exec tsc -b` limpio.
- Nota (misma que iter 1): el pgTAP de 0047 (`supabase/tests/0047_rebeldias_honestas.test.sql`, ahora `plan(11)`) NO corre en vitest — lo ejecuta el operador vía `psql -tA -f` el día del apply. La migración 0047 sigue SIN aplicar a PROD, por lo que editarla en sitio fue seguro (sin drift).
- Nota de aislamiento: esta iteración corrió sobre el árbol principal directamente (secuencial), NO en worktree — la iteración anterior falló `git worktree remove` con "Filename too long" en `node_modules` (Windows). Cero riesgo de carrera: proceso único, commits atómicos por hallazgo.

## Fixed Issues

### CR-04: La "mayoría única" de 0047 contaba FILAS, no parlamentarios

**Files modified:** `supabase/migrations/0047_rebeldias_honestas.sql`, `supabase/tests/0047_rebeldias_honestas.test.sql`
**Commit:** `c3ccc5b`
**Applied fix:** En la CTE `mayoria`, el rank ahora ordena por `count(distinct v.parlamentario_id)` en vez de `count(*)` — una fila duplicada de bancada ya no puede romper un empate real ni voltear la mayoría (la misma fabricación que motivó eliminar `mode()` en CR-02). Comentarios de cabecera (a) y de la CTE actualizados para pinear la semántica. pgTAP: `plan(10)` → `plan(11)`; fixture nuevo `PART_EMPDUP` (2 `si` / 2 `no` con UNA fila `si` duplicada → 3/2 crudas, 2/2 distintas) y assert (11): `rebeldias_de_parlamentario('PTEST_D3')` devuelve 0 filas (el duplicado no rompe el empate).
**Estado:** fixed — **requires human verification**: es un fix de lógica SQL; vitest/tsc no lo ejecutan. La prueba ejecutable es el pgTAP (11) el día del apply (checkpoint de operador ya establecido para 0047). Nota de borde documentada en el fix del review: un parlamentario con filas CONTRADICTORIAS (una `si` y una `no`) contaría en ambas opciones; `count(distinct)` elimina la clase dominante (duplicados de la misma opción), la contradictoria queda como dato sucio conocido.

### WR-06: El saneo de `?a`/`?b`/`?comparar` validaba solo la forma — `2026-99-99` seguía produciendo el 500

**Files modified:** `app/components/patrimonio-de-parlamentario.tsx`, `app/components/patrimonio-de-parlamentario.test.tsx`
**Commit:** `ccedd2b`
**Applied fix:** Nuevo helper exportado `esFechaISOValida(f)` (junto a `esHistorica`, mismo patrón del archivo): forma ISO + round-trip semántico `new Date(\`${f}T00:00:00Z\`).toISOString().slice(0,10) === f` (el rollover de V8 — `2026-02-30` → mar-02 sin NaN — obliga al round-trip; anclado a UTC para no cruzar de día por timezone). `PatrimonioSection` filtra `fechasComparar` con el helper; fecha inválida = param AUSENTE (sin comparación), nunca 500. +7 tests unitarios: `2026-99-99`, `2026-02-30` (rollover), `2023-02-29` vs `2024-02-29` (bisiesto), mes/día `00`, basura/forma corta/timestamp. El export NO es muerto (los tests lo importan — evita repetir IN-08).

### WR-07: El guard estricto era ciego a `GRANT … TO public`

**Files modified:** `app/lib/lockdown-guard.test.ts`
**Commit:** `852dc55`
**Applied fix:** Regex de `anonGrantOffenders` ampliado a `\bto\s+[\w,\s]*\b(anon|public)\b` (anon es miembro implícito del pseudo-rol `public`; un grant a public re-abre la superficie REST igual que un grant a anon). Precondición verificada por grep ANTES de aplicar: **ninguna migración >0044 usa `grant … to public`** (los únicos matches de `to public` son inexistentes; lo que hay es `revoke … from public` e `insert into public.*`, que no matchean — `revoke` no contiene `grant`). Casos sintéticos nuevos: (e) `grant execute … to public` → 1 offender; (f) el doble-revoke idiomático 0041/0047 → 0 offenders (negativo, pinea que el idiom real del repo no dispara); (g) `grant … on function public.f(text) to service_role` → 0 offenders (el `public.` de schema-qualification ANTES del `to` no dispara falsos positivos). Docs del header (A) y mensajes de fallo actualizados. La suite completa verde confirma que las migraciones reales >0044 (0045/0046/0047) pasan el guard ampliado.

## Out of Scope (Info — documentados, sin acción)

- **IN-07** (residual de WR-05: `//` no precedido de `:` dentro de un string aún trunca la línea escaneada): heurística declarada honestamente en el código; la dirección de fallo nueva es fail-loud. No bloqueante, no tocado.
- **IN-08** (`esRetiroUrgencia` exportada sin consumidor externo): export muerto menor en `app/components/timeline-view.tsx:56`. No tocado en esta iteración.

---

_Fixed: 2026-07-03T13:52:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 2_
