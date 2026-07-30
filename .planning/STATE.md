---
gsd_state_version: 1.0
milestone: v13.0
milestone_name: milestone
status: executing
stopped_at: Phase 127 context gathered
last_updated: "2026-07-30T18:58:24.019Z"
last_activity: 2026-07-30
progress:
  total_phases: 13
  completed_phases: 3
  total_plans: 17
  completed_plans: 10
  percent: 23
---

# Project State

## Project Reference

See: .planning/PROJECT.md (§ Current Milestone: v13.0, updated 2026-07-30)

**Core value:** La ciudadanía puede responder, sobre cualquier proyecto de ley o parlamentario, "qué pasó, cuándo y según qué fuente" — cada dato con fuente, fecha y enlace, sin afirmar intención ni causalidad.
**Current focus:** Phase 131 — DEBT-FICHA

## Current Position

Phase: 132
Plan: Not started
Status: Ready to execute
Last activity: 2026-07-30

Progress: [░░░░░░░░░░░░░] 0/13 phases

### 🔴 Riesgo latente de archivado — migraciones escritas y NO aplicadas

> `0073` (default ACL de `supabase_admin`) y `0075` (revoke de `net`) quedaron **escritas y NO
> aplicadas** por falta de ownership (`postgres` no es superusuario ni miembro de `supabase_admin`).
> **Jamás se editan.** Si algún día se pueden aplicar, va una migración **nueva** con el siguiente
> número libre. Sin esa disciplina, un futuro `supabase db push` o un ledger reconciliado a ciegas
> produciría deriva. NOTA v13.0: **`0080` ya está reservada** para la evidencia del materializador
> (Phase 127, Opción A) — un futuro fix de 0073/0075 toma el número que siga en `ls supabase/migrations`.

### Roadmap v13.0 (Phases 126-138)

Orden de construcción: **126** (Wave-0 guards: `SUPERFICIES_PANEL` + `NEGACIONES_LOCKED` + guard
create-view B-03 — ANTES de cualquier copy o vista) → carril panel **127** (materializador 0080:
evidencia + guard 404 + grafía 4-15) → **128** (contrato RPC/UI: tiles editoriales + links con
helper central + L4 votaciones + fechas + cobertura) → **129** (loop de diseño BrowserOS; cierra
B-02 y H-01). Deuda intercalada, paralelizable con worktrees tras 126: **130** (B-01, el número
falso 1000 vs 3.752) y **131** (H-06 + 3.3). Carril noticias: **132** (RSS dos-etapas) → **133**
(taxonomía + golden congelados ANTES de medir) → **134** (resolver anti-alucinación) → **135**
(clasificador con evals) → **136** (cron L-V) → **137** (vínculo a fichas, carril PII). Cierre:
**138** (deploy agrupado + BrowserOS final).

**Régimen por fase (LOCKED):** discuss granular → research → plan → premortem → plan-checker Opus

+ revisor `model:"fable"` para temas difíciles → executor Sonnet → verifier/code-review Opus.

Spike ante toda decisión no obvia. Criterios visuales = fragmento DOM + captura BrowserOS, jamás
subjetivos. `use_worktrees: true` (gotcha #11: amend inseguro en waves; precondiciones
`core.longpaths` + `allowBuilds` aplicadas en `8f37c7e`).

**Checkpoints de operador previstos:** ratificación VERBATIM de O-1..O-7 en la discusión de la
Phase 128 (cero aprobados por silencio) · veredicto de cierre del loop de diseño (129) · elección
de modelo del clasificador si exige provisión de keys (135) · NINGÚN flag se flipea (VSIM ya está
ON con sign-off; MONEY/NOTIF siguen OFF).

**Decisiones adjudicadas por spike (2026-07-30 — NO re-abrir):** Opción A (evidencia jsonb en
`materializar_senales()`, payload medido 39,7 KB, B violaba SEN-02) · guard 404 = left join
`proyecto` + `en_corpus:false` (nunca inner-join; 10/49 boletines de agenda no existen) · tile
materia MUERE (`sector_id` 65/3.657 = 1,8%) · sala Cámara = "tabla semanal" (fila sintética
`camara:sesion:2026-W31`, numero/tipo/hora NULL) · flags PROD verificados por comportamiento:
NET/CRUCES/VSIM ON, MONEY/NOTIF OFF.

## Performance Metrics

**Velocity:** v12.0 = 13 fases / 59 planes / 360 commits en 3 días (2026-07-27 → 2026-07-29).
Histórico por plan archivado en `milestones/` (STATE de v12.0 y anteriores).

*Updated after each plan completion.*

## Accumulated Context

### Decisions

Las decisiones por-plan de v7.0–v12.0 fueron podadas de este archivo al iniciar v13.0: viven en
`milestones/v*.0-ROADMAP.md`, `milestones/v12.0-MILESTONE-AUDIT.md` (§9 gotchas de método) y en
la memoria del proyecto (`v12-gotchas-metodo`, `v13-milestone-preparado`). Rectoras para v13.0:

- **Opción A LOCKED** (spike `v13.0-spike-panel-arquitectura.md`): poblar `evidencia` en el
  materializador; la RPC 0066 no cambia de firma; cero allowlist nueva para el panel. Cap por
  recencia PROHIBIDO (reproduce B-01); si algún día se cappea, por grado + `total` declarado.

- **La unidad de la evidencia = la unidad del conteo** (regla de coherencia del spike E2):
  urgencias/velocity/archivados = eventos; agenda_citacion = citaciones (puntos anidados);
  agenda_sala = ítems de tabla por cámara. Left join + null, jamás inner-join que divergiría.

- **Fechas**: `citacion.fecha`/`sesion_sala.fecha` son date-only medianoche UTC = día chileno —
  comparar `fecha::date >= current_date` SIN `at time zone`. `fecha_captura` JAMÁS es el hecho
  (44.847 eventos comparten `2026-07-10` por backfill). El footer del panel = frescura de fuente,
  nunca `fecha_max` de hechos futuros.

- **Votaciones L4**: Senado `resultado` NULL → "resultado no informado por la fuente", jamás
  fabricar; una línea por votación; confirmados = 283.550 (jamás 549k). VSIM ON no exige flip.

- **NEWS hereda el contrato de Is Chile Safe, no su código**: lista cerrada → resolver
  determinista (`extraerBoletines` REUSADO, no reescrito) → dead-letter con `rejection_stage`.
  Los 4 huecos de régimen (robots, delay, crudo, hash) NO se heredan. Golden set se arregla
  ANTES de medir; thresholds congelados ANTES de la primera medición.

- **RPC nueva = aguja completa** (B-01 en 130, co-autoría v2 en 131, cualquier RPC de noticias):
  cero-grant, secdef `search_path=''`, `statement_timeout`, LIMIT piso 1.000, doble-revoke,
  `PUBLIC_RPC_ALLOWLIST`, pgTAP contra schema aplicado. Firma viva jamás se altera (`42P13`) —
  firma v2 paralela, precedente `0060`.

### Pending Todos

- [DEUDA OPERADOR — blocking-human diferido, hereda de v11.0/v12.0]: CF secrets
  (`CLOUDFLARE_API_TOKEN`/`ACCOUNT_ID` en Cuchecorp/gov-map) + `GEMINI` · rotación DB password B26
  · RUT-01 + backfills LIVE (votos Cámara/Senado, ChileCompra, SERVEL — runbooks 66/67/70/71) ·
  flip MONEY (legal, dossier F13) · provisión NOTIF (publishable key, OTP template, Resend,
  NOTIF_TOKEN_SECRET) · keys candidato LLM (107-OPERATOR-HANDOFF). Detalle en
  `milestones/v12.0-MILESTONE-AUDIT.md` §8.1 y los checkpoints archivados.

### Blockers/Concerns

- **Deuda de operador v12.0 (fuera de alcance de agente en v13.0):** 🔴 `OP-4` destino de `pgtap`
  en `public` (1.201 fn exec-anon; destructivo) · 🔴 `OP-1` probe REST con anon key (3 requests,
  gatea severidad de `OFF-6-01`) · 🔴 `OFF-6-03` cadena SSRF `net`→`anon`/`PUBLIC` (`0075` escrita,
  no aplicada) · `OFF-01` default ACL `supabase_admin` (`0073` escrita, no aplicada). Un ticket a
  soporte Supabase con las 7 sentencias zero-credential-value: ver `124-SUPA-FIX.md` (archivado).

- **H-03 sigue NOT OBSERVED** (límite de instrumento v12.0) y **P-1 no ejercido** (lectura fría de
  las 82 filas de la Phase 122) — no bloquean v13.0, se registran para no perderse.

- **Estado de flags en PROD**: verificado por comportamiento 2026-07-30 (spike flags-y-datos):
  NET ON · CRUCES ON · VSIM ON · MONEY OFF · NOTIF OFF. Ningún flag se flipea por agente.

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260713-izo | Rediseñar /red: layout B seed→columna con conectores fan-out (sketch 002) | 2026-07-13 | 75a8617 | [260713-izo](./quick/260713-izo-redisenar-red-layout-b-seed-columna-con-/) |
| 260715-bvd | Parchar 3 alertas Dependabot (postcss/uuid/esbuild) vía pnpm overrides | 2026-07-15 | 72be412 | [260715-bvd](./quick/260715-bvd-parchar-3-alertas-dependabot-bump-transi/) |
| 260722-eia | Deep-links humanos + token urgencia 3 estados; deploy PROD d99b8fa9 | 2026-07-22 | b1ee8f7 | [260722-eia](./quick/260722-eia-deeplinks-humanos-urgencia-token-ficha/) |
| 260728-nlb | Descubrimiento de boletines nuevos en el cron de tramitación; corpus 3.659→3.675 | 2026-07-28 | 3aba04a | [260728-nlb](./quick/260728-nlb-descubrimiento-boletines-nuevos-cron-tra/) |

## Deferred Items

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| VOTO avanzado | Comparativo voto vs mayoría bancada (VOTOX-01), votos cruzados (VOTOX-02) | v2 (alto riesgo insinuación, tras sign-off) | 2026-07-13 |
| DINERO avanzado | Cruce dinero × voto × timeline por sector (MONEYX-01), co_votación | v2 (máquina de sospechas, 17-LEGAL-DOSSIER §2) | 2026-07-13 |
| Legal | Sign-offs F13/MONEY | Human gate — F13 vive en Phase 73 (v7.0, archivada) | v4.0 |
| verification_gap | Phases 64-75 (v7.0): 11 × VERIFICATION.md human_needed | gates de operador (HANDOFF-v7.0-operator-gates.md) | v9.0 close |
| uat | 97/99/103-HUMAN-UAT (provisión NOTIF/keys/secrets cron) | partial — provisión operador | v10.0 close |
| seed | SEED-001 capa LLM escalonada (Granite+Phi) — veredicto full-40 emitido en v11.0 | dormant | v11.0 |
| panel | Tile "Por sector" (variante B) — exige backfill clasificador (≥60% + ≥3 sectores) | deferred (REQUIREMENTS § Future) | 2026-07-30 |
| news | Clustering de eventos de noticias (dedupe union-find + LLM) | deferred (REQUIREMENTS § Future) | 2026-07-30 |

## Session Continuity

Last session: 2026-07-30T14:17:49.108Z
Stopped at: Phase 127 context gathered
Resume file: .planning/phases/127-panel-mat-materializador-0080-puebla-los-sujetos/127-CONTEXT.md

## Operator Next Steps

- Revisar el roadmap (`.planning/ROADMAP.md`) y arrancar con `/gsd:plan-phase 126`
- La construcción autónoma usa `.planning/PROMPT-v13.0-build-autonomo.md` (a generar al cierre de la sesión de preparación, según §3.5 del prompt)
