---
phase: 118
plan: 01
subsystem: auditoría de ingesta programada
tags: [cron, github-actions, pg_cron, freshness, r2, read-only, audit]
requires:
  - .github/workflows/*.yml
  - cron.job (DB PROD viva)
  - packages/freshness/src/catalog.ts
provides:
  - 118-PROBES-RAW.md (bitácora de 12 probes con comando + salida verbatim)
  - 118-CRON-VERDICTS.md (§front-matter, §0 Método, §1 Inventario + tabla maestra de 20 filas)
affects:
  - 118-02 (secciones por unidad — citan los ids de probe)
  - 118-03 (gap-list priorizada — consume §1.6)
  - 119 (CRON-FIX — backlog directo)
tech-stack:
  added: []
  patterns:
    - "audit-artifact v12.0: front-matter YAML + §0 Método + §1 Inventario (chasis de 116)"
    - "universo DERIVADO por conteo, nunca hardcodeado (líneas conteo_* máquina-parseables)"
    - "evidencia OBSERVADA con comando al lado; un veredicto sin comando citado es inválido"
key-files:
  created:
    - .planning/phases/118-cron-audit-veredicto-por-cron-con-evidencia/118-PROBES-RAW.md
    - .planning/phases/118-cron-audit-veredicto-por-cron-con-evidencia/118-CRON-VERDICTS.md
  modified: []
decisions:
  - "El universo de cron cierra en 20 unidades = 13 workflows locales + 2 platform-managed + 5 jobs pg_cron vivos. Se añade la etiqueta `no-cron` a la taxonomía LOCKED (verde/stale/roto) porque sin ella el criterio 'ninguna unidad sin clasificar' es inalcanzable: CI, deploy manual, backfills de dispatch y estrenos gated existen en el inventario pero no son ingesta programada. `no-cron` no es un juicio de salud y siempre lleva causa en archivo:línea."
  - "La cifra de workflows con schedule ACTIVO es 6, no 8. Se reporta el diff contra 118-CONTEXT.md:18 y NO se ajusta ninguna de las dos: digest-daily.yml:24-25 y roster-weekly.yml:29-30 tienen el bloque schedule comentado (estreno gated por diseño)."
  - "backup-parlamentario NO escribe Supabase (asunción A4 resuelta): su bloque env: sólo mapea los 4 R2_*, y el YAML declara 'SIN service key local en CI → la carga a DB se omite; el snapshot git es autoritativo'. La pata 2 se sustituyó por la observación del destino REAL — el commit del bot sobre supabase/seeds/parlamentario.seed.json — que muestra 3 lunes consecutivos, 1 minuto después de cada corrida."
  - "El discriminante 'skip legítimo vs cursor detenido' (Pitfall 4) se opera contra las tablas *_ingesta_estado / *_cursor_estado, no contra el conteo de filas. Produjo el único stale del audit: lobby-leylobby corre verde y escribe lobby_audiencia, pero lobby_ingesta_estado sigue congelado en 2026-06-22 mientras leylobby_cursor_estado sí avanzó."
  - "Las 8 corridas de actualidad-materializar en 14 días NO son ventanas perdidas: la primera corrida registrada del job es 2026-07-24 17:07 y ése es su historial completo. Se descartó la poda de job_run_details porque cleanup-net-http conserva sus 1344 filas del mismo período. Cadencia post-arranque = 100%."
metrics:
  duration: ~50 min
  tasks: 3
  files: 2
  probes: 12
  unidades_auditadas: 20
  completed: 2026-07-28
---

# Phase 118 Plan 01: Probes y esqueleto de veredictos — Summary

Auditoría empírica de las 20 unidades de ingesta programada del proyecto, con las cuatro
patas de evidencia corridas en vivo (gh / psql / freshness / source_snapshot) y capturadas
verbatim: **10 verde, 1 stale, 0 roto, 9 no-cron — ningún cron programado está roto.**

## Qué se construyó

Dos artefactos, ambos bajo `.planning/phases/118-*/`:

1. **`118-PROBES-RAW.md`** — bitácora de **12 probes** (`P0`…`P10`, con `P3` subdividida en
   `P3.a`/`P3.b`). Cada sección lleva el comando exacto en bloque bash y su salida recortada.
   Es la única fuente de la que la tabla maestra se puebla.
2. **`118-CRON-VERDICTS.md`** — front-matter de audit-artifact (chasis de 116), `§0 Método`
   (0.1 qué / 0.2 cómo / 0.3 qué NO hace / 0.4 taxonomía LOCKED citada verbatim / 0.5 comandos
   re-ejecutables) y `§1 Inventario` con el universo cerrado, las cuatro líneas de conteo
   máquina-parseables y la tabla maestra de 20 filas.

## El universo cerrado

```
conteo_workflows_locales: 13     (= ls .github/workflows/*.yml | wc -l — sin diff)
conteo_platform_managed:   2     (Dependabot Updates 314034212, CodeQL 301076402)
conteo_pg_cron_vivos:      5     (filas de cron.job — delta CERO vs migraciones)
conteo_total_unidades:    20     (== nº de veredictos emitidos)
```

## Hallazgos principales

**Los que cambian el mapa:**

- **6 workflows con `schedule:` activo, no 8** — corrige `118-CONTEXT.md:18`. Los dos
  faltantes tienen el bloque comentado por diseño.
- **pg_cron: delta CERO.** Los 5 jobs esperados están vivos y activos, con el mismo nombre,
  schedule y comando. La rama condicional de `0003_orchestration.sql` que quedó activa es
  `:214` (`30 seconds`, pg_cron ≥ 1.5), no el fallback `:221` — Open Question 1 cerrada con
  dato vivo.
- **Billing de GitHub Actions NO bloqueado** al 2026-07-28: corridas `schedule` con
  `conclusion: success` el mismo día del audit. Retira "billing" como causa candidata, a
  diferencia de v6.0.
- **El único stale es un cursor detenido**, no una fuente sin novedades: `lobby-leylobby-weekly`
  corre verde cada miércoles y escribe `lobby_audiencia` (2026-07-22), pero
  `lobby_ingesta_estado.ingestado_hasta` sigue en **2026-06-22 (36 días)** mientras
  `leylobby_cursor_estado` sí avanzó. Dos cursores desincronizados para la misma fuente.

**Los que alimentan a Phase 119** (§1.6 del documento, sin priorizar todavía):

- Catálogo de freshness apuntando a `chilecompra-weekly.yml` y `servel-weekly.yml`
  inexistentes — los dos **404 capturados en vivo** en P9. Distinto de "MONEY/SERVEL gated":
  lo gated es el dato, esto es el catálogo apuntando a un archivo fantasma.
- 8 de las 20 unidades no tienen pata 3 (el catálogo no cubre `actualidad-refresh`,
  `digest-daily`, `backup-parlamentario` ni ninguno de los 5 jobs pg_cron).
- `source_snapshot` sólo registra **2 fuentes** (`leyes` 4380, `infoprobidad` 3). Ausentes
  `agenda`, `lobby-leylobby`, `lobby-camara`, `bio`, `fichas`, `actualidad` → compliance
  dos-etapas de `CLAUDE.md` sin traza en DB.
- Dos señales de freshness miden una tabla que llena **otro** cron (`lobby-camara` mide
  `lobby_audiencia`; `fichas` mide `proyecto`), y por eso reportan `stale=false` gracias al
  trabajo ajeno: estructuralmente incapaces de detectar la avería del cron que dicen vigilar.
- Deuda de operador **110-02 confirmada abierta**: `CLOUDFLARE_API_TOKEN` y
  `CLOUDFLARE_ACCOUNT_ID` se expanden vacíos en el runner.

## Desviaciones del plan

### Correcciones auto-aplicadas

**1. [Rule 1 - Bug] La asunción A2 del RESEARCH es falsa: `creado_en` no existe**
- **Encontrado en:** Task 2, antes de correr el lote de P7 (el plan exigía verificar con `\d`).
- **Problema:** el lote del RESEARCH consultaba `max(creado_en)` sobre `actualidad_senal`,
  `notificacion_envio` y `source_snapshot`. Ninguna de las tres tiene esa columna.
- **Fix:** verificación previa contra `information_schema.columns` y sustitución por los
  nombres reales — `actualidad_senal.fecha_captura`, `notificacion_envio.created_at`,
  `source_snapshot.fetched_at` (y `source`, no `fuente`). Registrado en P7 y P10.
- **Commit:** `6cf9079`

**2. [Rule 3 - Bloqueante] `sesion_tabla_item` no tiene `fecha_captura`**
- **Encontrado en:** Task 2, primer intento del lote de P7 (`ERROR: column "fecha_captura"
  does not exist`).
- **Fix:** sustituida por `sesion_sala`, que sí la tiene y es la tabla de sala que
  `agenda-weekly` escribe. Error literal registrado en la bitácora.
- **Commit:** `6cf9079`

**3. [Rule 3 - Bloqueante] `pnpm freshness` no resuelve `tsx` en este entorno**
- **Encontrado en:** Task 2, probe P9.
- **Problema:** el script raíz (`package.json:12`) falla con `"tsx" no se reconoce como un
  comando…`; `pnpm exec tsx` tampoco resuelve. El binario vive en
  `packages/freshness/node_modules/.bin/tsx`.
- **Fix:** invocación por ruta explícita al binario **manteniendo el cwd en la raíz** (que es
  lo que el gotcha v8.1 exige para que `cli.ts:296` encuentre `.env`). El fallo se registró
  como evidencia y se levantó como hallazgo para 119 — **no se tocó `package.json`**
  (régimen read-only).
- **Commit:** `6cf9079`

**4. [Rule 2 - Cobertura] Probe `P0` añadida (no estaba numerada en el plan)**
- **Encontrado en:** Task 1.
- **Razón:** el plan exigía declarar el conteo de `schedule:` activo con su `archivo:línea` y
  citar los 13 workflows, pero no le asignaba id de probe. Sin `P0`, esas afirmaciones no
  podrían citarse desde la tabla maestra, violando la regla de validación del RESEARCH ("un
  veredicto sin comando citado es inválido").
- **Commit:** `4aff8d8`

**5. [Rule 2 - Taxonomía] Etiqueta `no-cron` declarada explícitamente en §0.4**
- **Razón:** la taxonomía LOCKED del CONTEXT sólo define verde/stale/roto, pero 9 de las 20
  unidades no son ingesta programada. Se citó la taxonomía verbatim y se añadió `no-cron`
  como clasificación (no juicio de salud), siempre con causa en `archivo:línea`. Sin ella el
  criterio "ninguna unidad sin clasificar" sería inalcanzable.
- **Commit:** `5d6c142`

### Sin desviación

El pre-check **P6a pasó** (`select count(*) from cron.job` → 5), así que **no se disparó el
fallback** de expectativa-de-migraciones: todas las cifras de pg_cron son estado vivo
observado. No se marcó nada `heredada: true` y no se levantó el gap P1 de acceso.

## Régimen y seguridad

- **Cero escritura:** sólo `select`. Ningún `insert/update/delete/alter`, ninguna migración
  aplicada, ningún CLI de ingesta invocado.
- **Cero fuga:** `grep -icE "(sk|ghp|gho|eyJ|sb_secret_|sb_publishable_)[-_a-z0-9]{12,}|[0-9a-f]{40}|postgres(ql)?://"` → **0** en ambos artefactos. `gh secret list` sólo nombres +
  fecha; `psql` siempre por variable. El log de `gh run view` se recortó a las líneas de error.
- **Cero archivo fuera de `.planning/`:** `git diff --name-only | grep -v '^\.planning/'`
  devuelve únicamente `pnpm-workspace.yaml`, que **ya estaba modificado antes de iniciar esta
  sesión** (aparece en el `git status` inicial) y no fue tocado por esta fase.

## Verificación

| criterio | resultado |
|---|---|
| `grep -c '^## P' 118-PROBES-RAW.md` ≥ 10 | 12 ✓ |
| `P6a` registrada | ✓ (pre-check pasó, 5 jobs) |
| 13 workflows citados en P2 | ✓ (bucle de verificación no imprime nada) |
| `conteo_workflows_locales` == `ls .github/workflows/*.yml \| wc -l` | 13 == 13 ✓ |
| `conteo_total_unidades` == suma de sumandos | 20 == 13+2+5 ✓ |
| `grep -c 'Veredicto: '` == `conteo_total_unidades` | 20 == 20 ✓ |
| filas con id de probe citado | 24 coincidencias `\| P[0-9]` ≥ 20 filas ✓ |
| gate anti-secreto en ambos artefactos | 0 / 0 ✓ |
| régimen read-only intacto | ✓ |

## Notas para 118-02 / 118-03

- Las secciones por unidad de 118-02 deben usar los prefijos `### PM-<n>` (platform-managed,
  filas #14-15) y `### PG-<n>` (pg_cron, filas #16-20) que el RESEARCH ya anticipó.
- El delta migración↔vivo de pg_cron es **CERO** — 118-02 §2 debe declararlo como resultado
  negativo fechado, no omitirlo.
- La gap-list de 118-03 arranca desde `§1.6` (7 hallazgos enunciados sin priorizar) y debe
  mantener `§1.5` (estados esperados) fuera de ella.
- El checkpoint de operador de 118-03 tiene su insumo listo: deuda 110-02 confirmada abierta
  con evidencia fechada en `P3.b` y `P4`.

## Self-Check: PASSED

Archivos verificados presentes:
- `.planning/phases/118-cron-audit-veredicto-por-cron-con-evidencia/118-PROBES-RAW.md` — FOUND
- `.planning/phases/118-cron-audit-veredicto-por-cron-con-evidencia/118-CRON-VERDICTS.md` — FOUND

Commits verificados en `git log`:
- `4aff8d8` — FOUND (Task 1)
- `6cf9079` — FOUND (Task 2)
- `5d6c142` — FOUND (Task 3)
