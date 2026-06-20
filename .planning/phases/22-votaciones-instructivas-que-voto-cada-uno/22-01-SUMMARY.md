---
phase: 22-votaciones-instructivas-que-voto-cada-uno
plan: 01
subsystem: database
tags: [postgres, supabase, pgtap, rpc, rls, legal-03, pgvector-adjacent, typescript]

# Dependency graph
requires:
  - phase: 10-votos
    provides: "RPC votos_de_parlamentario (0019) + tabla votacion público-read + voto confirmado"
  - phase: 07-fichas
    provides: "proyecto_ficha.idea_matriz (0011)"
provides:
  - "RPC votos_de_parlamentario EXTENDIDO (0028): por fila confirmada devuelve titulo + idea_matriz (sustancia) + resultado/total_si/total_no/total_abstencion/total_pareo/quorum (desenlace), sin N+1 joins"
  - "pgTAP 0029: afirma firma intacta + INVOKER + columnas nuevas + anon execute + anon no-PII sobre parlamentario"
  - "Tipo VotoFichaRow extendido con 8 campos nullable (sustancia + desenlace) para los consumidores de Wave 2"
affects: [22-02, votos-por-parlamentario, VotosView, voto-ficha-row]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "RPC additivo: drop+recreate cuando cambia el returns table; firma de parámetros (text,int,int) intacta; grant execute a anon re-emitido"
    - "LEFT JOIN para honest-state: idea_matriz/titulo null nunca descarta la fila del voto (NUNCA fabricar)"
    - "RPC sobre tablas público-read se queda INVOKER (no escala privilegios); cero PII (LEGAL-03)"

key-files:
  created:
    - "supabase/migrations/0028_votos_instructivos.sql"
    - "supabase/tests/0029_votos_instructivos.test.sql"
  modified:
    - "app/lib/types.ts"
    - "app/components/voto-ficha-row.tsx"
    - "app/components/votos-por-parlamentario.test.tsx"

key-decisions:
  - "Se extendió el RPC votos_de_parlamentario (decisión LOCKED del plan: RPC, no join-en-server-component) para evitar los tres .in() N+1 que el runbook marca"
  - "Columnas nuevas DESPUÉS de las 9 existentes y en el mismo orden; firma de parámetros intacta → additivo puro"
  - "LEFT JOIN a proyecto y proyecto_ficha (no INNER): un proyecto sin idea matriz (17/74) devuelve null, jamás filtra la fila"
  - "El RPC se mantiene security INVOKER (toca solo tablas público-read); cero policy/grant sobre parlamentario (LEGAL-03)"

patterns-established:
  - "Migración additiva de RPC con returns-table modificado = drop+recreate + grant re-emitido + checkpoint de operador para aplicar al remoto"

requirements-completed: []

# Metrics
duration: ~12min
completed: 2026-06-20
---

# Phase 22 Plan 01: Votos instructivos (capa de datos) Summary

**RPC `votos_de_parlamentario` extendido (additivo, sin PII) para que cada voto confirmado traiga su SUSTANCIA (titulo + idea_matriz) y su DESENLACE (resultado/totales/quorum) sin N+1 joins; pgTAP 0029 + tipo VotoFichaRow extendido. APLICACIÓN AL REMOTO = checkpoint de operador PENDIENTE.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-06-20T19:09:00Z (aprox)
- **Completed:** 2026-06-20 (Tasks 1-2; Task 3 pendiente de operador)
- **Tasks:** 2 de 3 (Task 3 = checkpoint de operador, BLOCKING, no ejecutable por el agente)
- **Files modified:** 5 (2 creados, 3 modificados)

## Accomplishments
- **Migración 0028:** `votos_de_parlamentario` extendido — el `returns table` crece 8 columnas (`titulo`, `idea_matriz`, `resultado`, `total_si`, `total_no`, `total_abstencion`, `total_pareo`, `quorum`) tras las 9 existentes. LEFT JOIN a `proyecto` y `proyecto_ficha` (honest-state). Firma de parámetros intacta; `security INVOKER`; `grant execute … to anon` re-emitido. Cero PII.
- **pgTAP 0029 (7 asserts):** función existe con firma `(text,int,int)`; sigue INVOKER; `returns table` contiene las columnas nuevas (titulo/idea_matriz/resultado/total_si/total_no/quorum/etapa); anon tiene execute; anon NO lee `parlamentario.partido`; invocación efectiva puebla sustancia+desenlace para una fila confirmada sembrada.
- **Tipo `VotoFichaRow`:** +8 campos nullable (sustancia null por LEFT JOIN; desenlace null si la votación no lo publica). JSDoc actualizado (honest-state, solo filas confirmadas).

## Task Commits

1. **Task 1: Extender RPC votos_de_parlamentario** — `d97b845` (feat)
2. **Task 2: pgTAP 0029 + extender VotoFichaRow** — `eb1269f` (test; incluye 2 fixes Rule 3)
3. **Task 3: Aplicar 0028 al remoto + pgTAP** — CHECKPOINT DE OPERADOR (no ejecutado por el agente)

**Plan metadata:** (commit final docs)

## Files Created/Modified
- `supabase/migrations/0028_votos_instructivos.sql` — RPC extendido additivo, sin PII (creado)
- `supabase/tests/0029_votos_instructivos.test.sql` — pgTAP, firma + columnas + anon no-PII (creado)
- `app/lib/types.ts` — `VotoFichaRow` +8 campos nullable (modificado)
- `app/components/voto-ficha-row.tsx` — literal de mención→fila completado con los 8 campos null (Rule 3)
- `app/components/votos-por-parlamentario.test.tsx` — fixture `makeVoto` completado con los campos nuevos (Rule 3)

## Decisions Made
- Extender el RPC (no join-en-server-component) — decisión LOCKED del plan; evita los tres `.in()` N+1 del runbook.
- Columnas nuevas al final, mismo orden; firma de parámetros intacta → additivo puro.
- LEFT JOIN (no INNER) a proyecto/proyecto_ficha → idea_matriz/titulo null nunca descarta la fila (honest-state, NUNCA fabricado).
- RPC se queda INVOKER (toca solo tablas público-read); cero policy/grant sobre `parlamentario` (LEGAL-03).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Completar dos construcciones de `VotoFichaRow` rotas por el cambio additivo del tipo**
- **Found during:** Task 2 (extensión de `VotoFichaRow`)
- **Issue:** Al añadir 8 campos requeridos a `VotoFichaRow`, `tsc` rompió en dos sitios que construyen el tipo por literal: el mapeo mención→fila en `voto-ficha-row.tsx` (TS2740) y el fixture `makeVoto` en `votos-por-parlamentario.test.tsx` (TS2322). Eran construcciones preexistentes sin los campos nuevos.
- **Fix:** Añadidos los 8 campos a ambos literales — `null` honesto en la fila de mención (la mención cruda no trae sustancia/desenlace), valores de prueba en el fixture.
- **Files modified:** app/components/voto-ficha-row.tsx, app/components/votos-por-parlamentario.test.tsx
- **Verification:** `npx tsc --noEmit` verde (exit 0); 13 tests RTL de `votos-por-parlamentario.test.tsx` pasan.
- **Committed in:** eb1269f (parte del commit de Task 2)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** El fix era necesario para que el cambio additivo del tipo no rompa el build; sin scope creep (solo completar literales existentes con campos null/de-prueba). El plan anticipaba que los consumidores aún no usan los campos nuevos — confirmado: ningún consumidor LEE los campos todavía (Wave 2 los consume).

## Issues Encountered
- El `<verify>` de Task 2 solo greppea errores en `lib/types.ts`; una corrida `tsc` completa reveló que el cambio additivo rompía dos sitios de construcción río abajo. Resuelto vía Rule 3 (ver arriba). No es un problema del diseño del RPC, sino del contrato de tipo more-strict.

## Operator Checkpoint Required (Task 3 — BLOCKING)

**El agente NO aplica el DDL al remoto.** build/typecheck NO prueban que Postgres ejecutó la migración (los tipos vienen del config generado, no de la DB viva → riesgo de falso positivo). El operador debe:

1. `source ~/obs_env.sh` (carga `$SUPABASE_DB_URL` esquivando BOM/CRLF).
2. Aplicar 0028 al remoto: `supabase db push --db-url "$SUPABASE_DB_URL"`.
3. Correr pgTAP: `supabase test db --db-url "$SUPABASE_DB_URL"` — confirmar 0029 verde **y** que 0019/0020/0026/0027 siguen verdes (no regresión).
4. Probe psql: `psql "$SUPABASE_DB_URL" -c "select titulo, idea_matriz, resultado, total_si, total_no, quorum, etapa from votos_de_parlamentario('D1054', 50, 0) limit 3;"` — confirmar columnas nuevas pobladas para los boletines con votación (14309-04 / 18296-05) y que `idea_matriz` no es null donde el proyecto la tiene.

**Resume-signal:** "0028 aplicada, pgTAP verde" o pegar el error.

## Next Phase Readiness
- **Capa de datos lista para Wave 2** (22-02): `VotoFichaRow` tipado con sustancia+desenlace; `VotosView` puede consumir titulo/idea/resultado para SC1/SC2/SC4 sin N+1.
- **BLOQUEANTE:** la aplicación remota de 0028 + pgTAP 0029 (checkpoint operador) debe completarse antes de que Wave 2 dependa de los campos en producción.

## Self-Check: PASSED

- FOUND: supabase/migrations/0028_votos_instructivos.sql
- FOUND: supabase/tests/0029_votos_instructivos.test.sql
- FOUND: app/lib/types.ts (VotoFichaRow extended)
- FOUND: 22-01-SUMMARY.md
- FOUND commit: d97b845 (Task 1)
- FOUND commit: eb1269f (Task 2)

---
*Phase: 22-votaciones-instructivas-que-voto-cada-uno*
*Completed (code): 2026-06-20 — operator remote-apply pending*
