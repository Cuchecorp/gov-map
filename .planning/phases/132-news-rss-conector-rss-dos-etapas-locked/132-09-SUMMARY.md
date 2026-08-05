---
phase: 132-news-rss-conector-rss-dos-etapas-locked
plan: 09
subsystem: news-etapa2-ledger
tags: [gap-closure, cr-02, wr-05, wr-15, wr-17, in-04, pgtap, supabase-writer]
dependency-graph:
  requires: [132-05-carga-etapa2, 132-08-run-news-cli]
  provides: [noticia_url_vista.estado=pendiente, contarPorCausa-exacto, SupabaseNewsWriter-testeado]
  affects: [packages/news/src/carga-run.ts, packages/news/src/writer.ts, packages/news/src/writer-supabase.ts]
tech-stack:
  added: []
  patterns: [marcado-provisional-neutro-CR-02, count-exact-head-true, cliente-doble-estructural]
key-files:
  created:
    - supabase/migrations/0085_noticia_url_vista_pendiente.sql
    - supabase/tests/0085_noticia_url_vista_pendiente.test.sql
    - packages/news/src/writer-supabase.test.ts
  modified:
    - packages/news/src/writer.ts
    - packages/news/src/carga-run.ts
    - packages/news/src/carga-run.test.ts
    - packages/news/src/writer-supabase.ts
decisions:
  - "No se agrega 'error_carga' a causa: pendiente+causa=null ya hace el ítem re-evaluable, sin inventar un vocabulario de causas de error que nadie consultaría."
  - "WR-16 (batching por lote) diferido: la pérdida de dato la cierra CR-02 en este plan; lo que queda es rendimiento, no corrección."
  - "IN-05 (canonicalizarUrl elimina ref/source) diferido: invalidaría el url_hash de las 245 filas ya en el ledger sin un caso real de colisión observado."
metrics:
  duration: "~55 min"
  completed: 2026-08-05
---

# Phase 132 Plan 09: Gap closure — ledger honesto + writer de PROD testeado Summary

Cierra CR-02 (fallo transitorio de DB marcaba el ítem como descartado por pre-filtro PARA SIEMPRE),
WR-05 (`contarPorCausa` topaba en el cap de 1.000 de PostgREST — el patrón B-01), WR-15 (el writer
que escribe PROD no tenía ningún test), WR-17 (HTML crudo en `descripcion`) e IN-04
(`errores[].urlHash` contenía una URL cruda).

## Lo que se construyó

**Migración 0085 (aplicada a PROD):** `noticia_url_vista.estado` amplía su dominio a
`('pasa','descarta','pendiente')`. `'pendiente'` es el marcado provisional neutro —sin causa—
que se escribe antes de evaluar el pre-filtro. Aditiva: ninguna de las 245 filas existentes viola
el nuevo check. pgTAP 0085 corrió contra el schema aplicado: 9/9 `ok`, 0 `not ok` (acepta
pendiente, rechaza un estado inventado como control negativo, no-regresión de pasa/descarta,
deny-all de RLS intacto).

**`carga-run.ts` (CR-02):** el marcado provisional ahora escribe `estado='pendiente', causa=null`
— nunca la causa final. La causa final (`prefiltro_lexico`) se promueve en el mismo paso en que
la decisión se toma (inmediatamente tras `esLegislativo`, o tras el éxito de `upsertNoticias` +
`marcarVistas` final). Si cualquiera de esas escrituras finales falla, el ítem queda `pendiente`
y `urlsYaVistas` (contrato nuevo: filtra a `estado in ('pasa','descarta')`) lo trata como NO
visto, así que la corrida siguiente lo re-evalúa desde cero.

**WR-17:** `descripcion` se persiste con `despojarHtml(item.descripcion ?? "") || null` — ya no
se guarda HTML crudo del feed.

**IN-04:** `CargarResult.errores[].urlHash` se renombró a `.ref` (ningún consumidor fuera del
propio módulo lo usaba salvo `.length` en `run-news-cli.ts`, verificado antes del cambio).

**`writer-supabase.ts` (WR-05):** `contarPorCausa()` reescrito para usar
`select("*", { count: "exact", head: true })` una vez por causa conocida (`CAUSAS_CONOCIDAS`,
exportada) más `.is("causa", null)` para `sin_causa`. Cero payload transferido, cero cap de 1.000
filas. `urlsYaVistas` ahora filtra `.in("estado", ["pasa","descarta"])` en el servidor (mismo
contrato de CR-02).

**`writer-supabase.test.ts` (WR-15, nuevo):** 15 tests con un cliente doble estructural (registra
tabla/método/argumentos de la cadena `from().select()/.upsert().eq()/.is()/.in()`, cero red/DB).
Cubre `onConflict`, chunking a 500, dedupe por `url_hash`, `error.message` sin la service key, y
el cap simulado de PostgREST (1.000 filas en `data`, `count` real 3.752).

## Mutaciones (registradas con ambos resultados)

**Task 2 (carga-run.ts):**

1. **Rectora CR-02** — restaurar `causa: "prefiltro_lexico"` en el marcado provisional:
   - Test "ledger tras fallo transitorio" → **FALLÓ** (`expected 'prefiltro_lexico' to be null`). ✓
   - Test "re-evaluación en la corrida siguiente" → siguió PASANDO (la re-evaluación depende de
     `estado`, no de `causa`; la causa envenenada no afecta el filtro de `urlsYaVistas`).
   - Control positivo (sin fallo inyectado) → siguió PASANDO. ✓
   - Revertido; suite verde de nuevo.
2. `urlsYaVistas` (InMemoryNewsWriter) vuelve a incluir los `pendiente` como vistos:
   - Test de re-evaluación → **FALLÓ** (`expected 1 to be 0` en duplicados). ✓
   - Test "descarte terminal cuenta como duplicado" → siguió PASANDO. ✓
   - Revertido.
3. Quitar `despojarHtml` (persistir `item.descripcion` crudo):
   - Test del `<script>` → **FALLÓ** (`expected '<b>...' not to contain '<'`). ✓
   - Revertido.

**Task 3 (writer-supabase.ts):**

1. **Rectora WR-05** — `contarPorCausa` vuelve al `select("causa")` sin `count`:
   - Test del cap (3.752 vs 1.000) → **FALLÓ** (`expected {} to deeply equal {...}` — el mock
     devuelve `count` que la impl vieja ignora). ✓
   - Otros 2 tests de `contarPorCausa` también cayeron (esperado: dependen del mismo mecanismo).
   - Revertido.
2. Quitar `onConflict: "url_hash"` de `upsertNoticias`:
   - Test de `onConflict` → **FALLÓ** (`expected "url_hash" to be undefined`). ✓
   - Revertido.
3. Subir `CHUNK` a 5.000:
   - Tests de "1.200 filas → 3 lotes" (`upsertNoticias` y `marcarVistas`) → **FALLARON**
     (`expected 3 to be 1`). ✓
   - Revertido.

Verificado tras cada mutación con `diff` contra el backup: archivos idénticos al estado
pre-mutación antes de continuar.

## Verificación final

- `pnpm --filter @obs/news exec vitest run src/carga-run.test.ts` → 16/16 (piso: ≥15).
- `pnpm --filter @obs/news exec vitest run src/writer-supabase.test.ts` → 15/15 (piso: ≥10).
- `pnpm --filter @obs/news test` → 154/154 (piso: ≥123, no-regresión).
- `pnpm typecheck` → 0.
- `pnpm guards` → 388/388 (bento, lockdown, money/notif/vsim-antiflip, dinero, llm) — 0 fallos.
- `grep -c 'causa: "prefiltro_lexico"' packages/news/src/carga-run.ts` → 1 (única aparición, en la
  promoción posterior a la decisión).
- `grep -c "head: true" packages/news/src/writer-supabase.ts` → 3.
- `grep -Ec '\.select\("causa"\)' packages/news/src/writer-supabase.ts` → 0.
- pgTAP 0085 contra PROD: 9 `ok`, 0 `not ok`.
- Migración 0085 aplicada a PROD; ledger `supabase_migrations.schema_migrations` contiene `'0085'`.
- `git diff --name-only 7b188f3..HEAD | grep -c "007[35]"` → 0 (0073/0075 intactas).

## Deviations from Plan

None — plan ejecutado exactamente como escrito. El nombre real de la constraint descubierto
(`noticia_url_vista_estado_check`) coincidió con el nombre propuesto en el plan, así que la
migración no necesitó ajuste.

## Deferred (con razón, ya en el plan)

- **WR-16** (batching de `marcarVistas`/`upsertNoticias` por lote): la pérdida de dato grave la
  cierra CR-02 en este mismo plan; queda solo rendimiento (~270 requests/corrida sobre 245
  ítems). Reabrir si la Phase 136 mide latencia inaceptable en el cron.
- **IN-05** (`canonicalizarUrl` elimina `ref`/`source`): cambiarlo invalidaría el `url_hash` de
  las 245 filas ya en el ledger. Sin un caso real de colisión, se documenta el riesgo en la
  cabecera del archivo para cuando alguna fase lo toque.

## Threat Flags

None — todo el cambio cae dentro del threat model declarado en el plan (T-132-31..35), sin
superficie nueva no prevista.

## Self-Check: PASSED

- `supabase/migrations/0085_noticia_url_vista_pendiente.sql` — FOUND
- `supabase/tests/0085_noticia_url_vista_pendiente.test.sql` — FOUND
- `packages/news/src/writer-supabase.test.ts` — FOUND
- Commit `ea66f9e` (migración 0085) — FOUND en `git log --oneline`
- Commit `6aeac94` (carga-run CR-02) — FOUND en `git log --oneline`
- Commit `befcd33` (writer-supabase WR-05/WR-15) — FOUND en `git log --oneline`
