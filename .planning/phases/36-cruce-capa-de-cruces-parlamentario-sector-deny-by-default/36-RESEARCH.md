# Phase 36: CRUCE — Capa de cruces parlamentario↔sector (deny-by-default) - Research

**Researched:** 2026-06-24
**Domain:** Supabase/Postgres derived-data layer (security-definer materializer + deny-by-default RPC) + LLM sector classification (own golden/eval) in a new `@obs/cruces` package
**Confidence:** HIGH (mirror phase — patterns verified verbatim against applied migrations and green pgTAP suites in the repo)

## Summary

Phase 36 is a **mirror-existing-patterns** phase, not greenfield. Every structural decision already exists in the codebase and is LOCKED in `MILESTONE-v4-cruces.md` §2.1 and `36-CONTEXT.md` (D-01..D-13). The job is to assemble four pieces by copying proven patterns: (1) a `sector` catalog + additive `sector_id` columns on three tables; (2) a deny-by-default `cruce_senal` table; (3) a `materializar_cruces()` security-definer proc that is a structural mirror of `materializar_aristas()` in `0030_net.sql`; (4) a `cruces_de_parlamentario` RPC that is **NOT granted to anon** (the one departure from `subgrafo_red`, which IS granted). All migrations apply via `psql --db-url` only; pgTAP is the only valid test. The LLM sector classifier lives in a **separate** `@obs/cruces` CLI with its **own** schema/prompt/golden — it must NOT reuse the literal-extraction flow of `@obs/fichas` (classifying to a closed taxonomy is imputation, which would break the SEM-02 literal contract).

**Resolution of the PRIMARY research question** (MVP signal semantics): The MVP signal must ship as **lobby-pure**. The acceptance (CRUCE-03: ≥1 row for ≥5 parlamentarios "con datos de lobby actuales") is only satisfiable with already-ingested lobby data (Phase 34). Donante/SERVEL aportes are gated until Phase 40, so any signal that depends on `donante` evidence cannot reach ≥5 parlamentarios today. **Recommendation:** name the shipped signal type **`lobby_sector`** (semantics: "N reuniones con gestores del sector X"), reserving `lobby_sector_aporte` as the eventual fused lobby+aporte signal for Phase 40. If the operator insists on keeping the literal token `lobby_sector_aporte` from the acceptance text, ship it but populate `evidencia` **only** from lobby audiencias (zero aporte items) — the column/CHECK must allow the row to be materialized from lobby alone. Either way: the shipped row's evidence is lobby-only; vote-derived and aporte-derived signals start OFF.

**Primary recommendation:** Mirror `0030_net.sql` for the migration + materializer; mirror `0021_lobby.sql`'s RPC projection discipline (but DROP the `grant to anon` line); mirror `pipeline-cli.ts` for the CLI scaffolding (dry-run / degrade-to-dry-run gating); build a brand-new golden in `@obs/cruces` modeled on `golden-set.ts` but scored as single-label top-1 with abstention=not-covered.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Sector catalog (`sector`) | Database / Storage | — | Public-read reference data; lives in Postgres, seeded by migration. |
| `sector_id` labeling on 3 tables | API / Backend (batch CLI) | Database | Classification is a derived ETL stage in `@obs/cruces` CLI; the column is persisted in Postgres but written by a service-role batch, never inline in a writer. |
| LLM sector classification | API / Backend (Deno CLI) | — | Runs in `@obs/cruces` batch CLI (derived stage), never per-row in `writer-supabase.ts`. Split DeepSeek (public projects) / MiniMax (sensitive contrapartes). |
| Signal materialization (`materializar_cruces`) | Database / Storage | — | Security-definer proc invoked by pg_cron; full-rebuild transactional inside Postgres. Reads deny-by-default tables. |
| Public projection (`cruces_de_parlamentario` RPC) | Database / Storage | API / Backend | security-definer RPC is the only channel to deny-by-default `cruce_senal`; consumed later by `CrucesSection` (Phase 37). In Phase 36 it has NO anon grant. |
| Presentation gate (`crucesPublicEnabled()`) | Frontend Server (SSR) | — | Out of scope for Phase 36 (Phase 37); only "no grant to anon" matters here. |

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Catálogo custom curado de ~12-15 macro-sectores legibles para ciudadano/prensa (NO CIIU/ISIC granular, NO data-driven por clustering). Versionado en seed.
- **D-02:** Un solo catálogo compartido para las tres entidades (`proyecto_ficha`, `lobby_contraparte`, `donante`) — habilita el cruce directo sector-a-sector. NO catálogos separados por entidad.
- **D-03:** Claude (planner/researcher) propone la lista concreta de ~12-15 sectores en el seed, basada en las materias reales del Congreso; el operador la confirma antes de aplicar. NO se dicta la lista en este discuss.
- **D-04:** Estable + extensible aditivo: agregar un sector es una migración aditiva; NUNCA renombrar/borrar códigos vivos (clave para el determinismo del golden). Estable durante el milestone, crecible después.
- **D-05:** Sin calce → `sector_id` NULL (honest-state, espejo de "literal o null"). NO existe sector cajón-sastre tipo "Otros".
- **D-06:** Ground-truth construido por LLM-propone + humano-valida sobre ~40 casos reales (proyectos + contrapartes); el set corregido es el golden, fijado en JSON versionado.
- **D-07:** Single-label (top-1): un sector primario por ítem; "correcto" = match exacto con el golden. NO multi-label, NO primario+secundarios en esta fase.
- **D-08:** Política de abstención: el clasificador devuelve NULL cuando no está seguro. En el gate ≥7/10, NULL cuenta como no-cubierto (baja cobertura) pero NUNCA como error; una asignación de sector incorrecta SÍ es error. Prefiere abstenerse a imputar.
- **D-09:** `evidencia` = conteo + lista de eventos trazables: `{ conteo, items: [{ tipo, fecha, contraparte_nombre_crudo, audiencia_id, enlace_fuente }] }`. La ficha (Phase 37) puede renderizar "N reuniones con gestores del sector X" + cada evidencia con su enlace original (FND-08) sin re-query. NO solo-conteo, NO solo-agregado.
- **D-10:** Contraparte se guarda como nombre crudo en la evidencia (independiente del estado de identidad — la clasificación de sector NO requiere `entidad_id` confirmado; maximiza cobertura honesta, conserva el patrón IdentityMarker en la superficie).
- **D-11:** `materializar_cruces()` hace full rebuild transaccional cada corrida (borra + reinserta dentro de una transacción, espejo de `materializar_aristas` en `0030_net.sql`). Sin filas stale/huérfanas. NO upsert incremental, NO append versionado.
- **D-12:** Split por sensibilidad del input: proyectos (idea matriz/materia = público) → DeepSeek V4 (volumen, prompt-cache); contrapartes/donantes (sensible, Ley 21.719) → MiniMax M3 con `sensitivity` ≠ `'public'` (FND-06 / `data-routing.ts`). NO un solo proveedor para todo.
- **D-13:** Salida estructurada por el patrón del proyecto — DeepSeek `json_object` / MiniMax tool-calling forzado — con compuerta zod validando contra el enum del catálogo `sector`; RUT NUNCA cruza al LLM (`assertNoRutInLlmInput`, test-enforced). La clasificación corre en CLI batch de `@obs/cruces` (etapa derivada), NUNCA por fila dentro de `writer-supabase.ts`.

### Claude's Discretion
- Estrategia de prompt-cache/batch del clasificador, offset exacto del pg_cron (`~23 3 * * *` sugerido por diseño), forma precisa de columnas vs jsonb en `cruce_senal` más allá de D-09, y manejo de drift/throttle de fuente — a criterio del planner siguiendo patrones existentes (`materializar_aristas`, `pipeline-cli`, `money-gate`).

### Deferred Ideas (OUT OF SCOPE)
- Señales derivadas de voto (`lobby_sector_voto`, `aporte_sector_voto`): construibles deny-by-default pero arrancan OFF; requieren re-justificación legal vs 17-LEGAL-DOSSIER §2 + sign-off (Phase 39). NO encender en Phase 36.
- Multi-label / sector primario+secundarios: diferido; arrancamos single-label top-1 (D-07).
- Sector vía aportes/donantes reales (SERVEL): depende de RUT-01 + ChileCompra/SERVEL (Phase 40) — la dimensión `aporte` del cruce no tiene evidencia poblada hasta entonces.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description (verbatim from REQUIREMENTS.md) | Research Support |
|----|-------------|------------------|
| CRUCE-01 | Existe el catálogo `sector` (public-read) + `sector_id` en `proyecto_ficha`, `lobby_contraparte` y `donante`; la tabla `cruce_senal` (deny-by-default, fila única parlamentario+sector+evidencia jsonb — NO espejo de `arista`); el materializador `materializar_cruces()` (security definer, `search_path=''`, pg_cron con offset); y el RPC `cruces_de_parlamentario` SIN grant a anon hasta firma. Migraciones por `psql --db-url`, pgTAP: `sector` public-read, `cruce_senal` deny-by-default, el cuerpo del materializador no referencia partido ni RUT. | §Standard Stack (migration sequence 0038-0040), §Architecture Pattern 1 (materializer mirror), §Pattern 3 (deny-by-default), §Code Examples (sector seed, cruce_senal DDL, RPC), §pgTAP assertions. |
| CRUCE-02 | El etiquetado de sector usa un schema/pipeline/golden SEPARADO del flujo de extracción literal. La clasificación corre en un CLI batch de `@obs/cruces` (etapa derivada), NUNCA por fila dentro del writer. Sensibilidad LLM correcta para contrapartes (no `sensitivity:'public'`, Ley 21.719 / FND-06). CLI `--dry-run` sobre 10 proyectos: ≥7 con `sector_id` no nulo medido contra su propio golden. | §Pattern 2 (classifier pipeline), §Pattern 4 (CLI scaffolding mirror), §Don't Hand-Roll (data-routing gates), §Code Examples (classifier schema + golden), §Validation Architecture (dry-run gate). |
| CRUCE-03 | Tras materializar con los datos de lobby actuales, `cruce_senal` tiene ≥1 fila `lobby_sector_aporte` para ≥5 parlamentarios. Señales de voto OFF. Wording factual obligatorio ("N reuniones con gestores del sector X", sin verbo causal); el RPC nunca proyecta rut/partido/email/donante_id (pgTAP). | §Summary (MVP signal resolution — lobby-pure), §Open Question 1, §Pattern 1 (materializer reads lobby_audiencia+lobby_contraparte.sector_id), §pgTAP (projection exclusion). |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

These directives carry the same authority as locked decisions. The planner must verify compliance:

- **DDL apply path:** `psql --db-url --single-transaction` + row in `schema_migrations`. NEVER `supabase db push` (schema_migrations drift; remote registers ≤0025). pgTAP is the ONLY valid test. `.env` BOM breaks the CLI → pass `--db-url` explicitly. `[VERIFIED: codebase grep — 0021/0030 headers, MEMORY]`
- **RUT never to LLM:** `assertNoRutInLlmInput` over the final prompt, test-enforced (test fails if a RUT leaks). `[VERIFIED: packages/llm/src/data-routing.ts]`
- **Personas jurídicas:** identified ONLY by exact RUT, never LLM (fail-closed) — relevant because most lobby contrapartes are jurídicas with no RUT → many stay `no_confirmado`, but sector classification does NOT require `entidad_id` (D-10), so coverage is not blocked by this. `[CITED: MILESTONE §1.2 KEY NOTES]`
- **Deny-by-default REAL:** RLS-on + zero policies + explicit `revoke all from anon, authenticated` (the project grants to anon by DEFAULT PRIVILEGES). `[VERIFIED: 0021_lobby.sql:98, 0034:80]`
- **Two-stage ingest:** classification is a derived stage, separate from the writer; never inline LLM per-row. `[CITED: CLAUDE.md Conventions]`
- **Wording factual:** no causal verbs ("corrupción/influencia/benefició/a cambio de"). Linter banned-vocab (DESIGN-SYSTEM / 17-LEGAL-DOSSIER). `[CITED: 36-CONTEXT.md specifics]`
- **GSD workflow enforcement:** edits must go through a GSD command (`/gsd:execute-phase`). `[CITED: CLAUDE.md]`

## Standard Stack

This phase introduces **no new external packages**. It uses libraries already vendored and proven in the repo. The "stack" is the set of existing patterns/modules to mirror.

### Core (existing modules to reuse)
| Module | Source | Purpose | Why Standard |
|--------|--------|---------|--------------|
| `@obs/llm` `assertNoRutInLlmInput` / `assertSensitivityAllowed` | `packages/llm/src/data-routing.ts` | PII/sensitivity gates before any `complete()` | Already test-enforced (≥10 tests); FND-06 compliance. `[VERIFIED: codebase read]` |
| `@obs/llm` `DeepSeekProvider` / `MiniMaxProvider` | `packages/llm/src/providers/{deepseek,minimax}.ts` | LLM classification | `id="deepseek"/"minimax"`, both `trainsOnInputs=false`. Router maps `critical→minimax`, `bulk→deepseek`. `[VERIFIED: config.ts:51-63, providers grep]` |
| `zod` (3.x/4.x) | already vendored | Closed-enum validation gate against `sector` codes | Project convention; provider `complete(req, schema)` applies it internally. `[VERIFIED: model.ts uses zod]` |
| pg_cron | Supabase extension | Schedule `materializar_cruces()` daily | Mirror of `cron.schedule` guard + post-assertion in `0030_net.sql:149-178`. `[VERIFIED: 0030_net.sql]` |

### Supporting
| Module | Source | Purpose | When to Use |
|--------|--------|---------|-------------|
| `pipeline-cli.ts` scaffolding | `packages/fichas/src/pipeline-cli.ts` | CLI shape: `parseArgs`, `--dry-run`, `decidirDryRun` (degrade-to-dry-run without service key), env-driven URL/keys | Mirror SHAPE for `@obs/cruces` classifier CLI; do NOT mirror the literal-extraction CONTENT. `[VERIFIED: read]` |
| `golden-set.ts` harness | `packages/fichas/src/golden/golden-set.ts` | Golden-set test gate structure (`evaluarGolden`, metrics, threshold) | Mirror the harness STRUCTURE; replace literal-substring scoring with single-label top-1 + abstention scoring (D-07/D-08). `[VERIFIED: read]` |
| `materializar_aristas()` | `supabase/migrations/0030_net.sql:105-147` | Security-definer full-rebuild proc invoked by cron | EXACT structural mirror for `materializar_cruces()`. `[VERIFIED: read]` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `cruce_senal` single-row-per-(parlamentario,sector,tipo) | mirror `arista` binary edge | REJECTED by D-09 / MILESTONE: `cruce_senal` is NOT an arista — it is a single aggregated row with `evidencia` jsonb, not a binary edge. Do not transfer arista invariants. |
| MiniMax for everything | DeepSeek for everything | REJECTED by D-12: split by input sensitivity. Public project text → DeepSeek (volume, prompt-cache); sensitive contraparte names → MiniMax. |
| Inline classification in `writer-supabase.ts` | per-row LLM call | REJECTED by D-13 / two-stage convention: classification is a separate derived batch stage. |

**Installation:** None. All imports are `@obs/*` workspace packages or existing Supabase extensions. `@obs/cruces` is a new workspace package (mirror `package.json` of `@obs/fichas`).

## Package Legitimacy Audit

> Not applicable. This phase installs **zero** external packages. All dependencies are existing internal workspace packages (`@obs/llm`, `@obs/ingest`, `@obs/identity`) and Postgres extensions already present (pg_cron). slopcheck/registry verification is moot — no registry install occurs.

## Architecture Patterns

### System Architecture Diagram

```
                         ┌─────────────────────────────────────────────┐
                         │  DERIVED STAGE 1: sector labeling (batch CLI) │
                         │            @obs/cruces                         │
                         └─────────────────────────────────────────────┘
 proyecto_ficha (public) ──idea_matriz/titulo──┐
                                               ▼
                                    ┌──────────────────┐   public      ┌───────────┐
                                    │ clasificar-fichas │──sensitivity─▶│ DeepSeek  │
                                    │      -cli          │◀──sector_id──│  (bulk)   │
                                    └──────────────────┘               └───────────┘
                                               │  zod gate (sector enum) + abstain→NULL
                                               ▼ service-role UPDATE
                                    proyecto_ficha.sector_id

 lobby_contraparte (deny) ─nombre/representado─┐
                                               ▼
                                    ┌──────────────────┐  personal     ┌───────────┐
                                    │ clasificar-lobby  │──sensitivity─▶│ MiniMax   │
                                    │      -cli          │◀──sector_id──│ (critical)│
                                    └──────────────────┘               └───────────┘
                                               │  assertNoRutInLlmInput FIRST
                                               ▼ service-role UPDATE
                                    lobby_contraparte.sector_id  (+ donante.sector_id later)

                         ┌─────────────────────────────────────────────┐
                         │  DERIVED STAGE 2: signal materialization      │
                         │       materializar_cruces() (pg_cron ~23 3)   │
                         └─────────────────────────────────────────────┘
 lobby_audiencia (confirmado) ┐
 lobby_contraparte.sector_id  ┼──security definer, search_path='' ──▶  cruce_senal
                              │   (TRUNCATE + INSERT in one txn,        (deny-by-default,
                              │    full rebuild, D-11)                   1 row per parl+sector+tipo,
                              ▼                                          evidencia jsonb)
                       count reuniones por (parlamentario, sector)
                                               │
                                               ▼ security definer, NO grant to anon (Phase 36)
                                    cruces_de_parlamentario(p_id) RPC
                                    projects: sector, conteo, evidencia.items[].enlace
                                    NEVER: rut / partido / email / donante_id
                                               │
                                               ▼ (Phase 37, gated)
                                       CrucesSection
```

### Recommended Project Structure
```
packages/cruces/
├── package.json              # mirror @obs/fichas package.json (name "@obs/cruces")
├── src/
│   ├── index.ts
│   ├── sector.ts             # SECTOR catalog as TS const (codes+labels) — source of seed + zod enum
│   ├── model.ts              # ClasificacionSectorSchema (zod): { sector_codigo: enum | null }
│   ├── prompt.ts             # SYSTEM_CLASIFICACION + construirPrompt (project text)  [DeepSeek]
│   ├── prompt-lobby.ts       # SYSTEM + construirPrompt (contraparte name+materia)   [MiniMax]
│   ├── clasificar.ts         # clasificarFicha / clasificarContraparte (provider.complete)
│   ├── clasificar-fichas-cli.ts   # batch CLI (mirror pipeline-cli.ts shape)
│   ├── clasificar-lobby-cli.ts    # batch CLI (sensitivity: personal → MiniMax)
│   ├── writer-supabase.ts    # service-role UPDATE of sector_id (NEVER calls LLM)
│   ├── mock-provider.ts      # CI mock (no network), keyed by case id
│   └── golden/
│       ├── golden-set.ts     # ~40 cases, single-label top-1, abstention scoring
│       └── golden-set.test.ts# gate: ≥7/10 non-null AND zero misclassifications
supabase/migrations/
├── 0038_sector.sql           # sector catalog (public-read) + sector_id on 3 tables
├── 0039_cruce_senal.sql      # cruce_senal (deny-by-default) + materializar_cruces() + cron
└── 0040_cruces_rpc.sql       # cruces_de_parlamentario RPC (NO grant to anon)
supabase/tests/
├── 0038_sector.test.sql
├── 0039_cruce_senal.test.sql
└── 0040_cruces_rpc.test.sql
```

> Migration split into 3 files mirrors the 0034/0035/0036 entity split (one concern per migration, one pgTAP per migration). The planner may combine 0039+0040 if preferred, but 3 files is the established convention and keeps pgTAP suites focused. Number from **0038** — latest applied in PROD is **0037** `[VERIFIED: ls supabase/migrations, MEMORY]`.

### Pattern 1: Security-definer full-rebuild materializer (mirror `materializar_aristas`)
**What:** A `security definer set search_path = ''` proc that reads deny-by-default lobby tables and writes `cruce_senal`. Per D-11 it does a **full rebuild** (delete-all + reinsert) inside one transaction — *different* from `materializar_aristas`, which uses `on conflict do nothing` append (lobby facts are append-only there). For `cruce_senal`, full rebuild keeps evidence current and avoids stale rows.

**When to use:** The cron-invoked derived materialization. NEVER inline.

**Example (skeleton — adapt the SELECT to count lobby audiencias by sector):**
```sql
-- Source: mirror of supabase/migrations/0030_net.sql:105-147 (security definer + cron),
--         but FULL REBUILD per D-11 (not on-conflict append).
create schema if not exists cruces;

create or replace function cruces.materializar_cruces()
returns void language plpgsql security definer set search_path = '' as $$
begin
  -- Full rebuild (D-11): TRUNCATE inside the txn → no stale/orphan rows.
  delete from public.cruce_senal;

  -- MVP signal: count of confirmed lobby audiencias per (parlamentario, sector),
  -- where the contraparte of the audiencia has a non-null sector_id. Evidence is
  -- lobby-only (aporte items empty until Phase 40). NO partido, NO rut referenced.
  insert into public.cruce_senal (parlamentario_id, sector_id, tipo_senal, conteo, evidencia, ...provenance)
  select a.parlamentario_id,
         c.sector_id,
         'lobby_sector',                          -- see Open Question 1 (lobby-pure name)
         count(*),
         jsonb_build_object(
           'conteo', count(*),
           'items', jsonb_agg(jsonb_build_object(
             'tipo', 'reunion',
             'fecha', a.fecha,
             'contraparte_nombre_crudo', c.nombre, -- raw name (D-10), independent of entidad_id
             'audiencia_id', a.identificador,
             'enlace_fuente', a.enlace
           ) order by a.fecha desc)
         ),
         'lobby', min(a.origen), now(), min(a.enlace)
  from public.lobby_audiencia a
  join public.lobby_contraparte c on c.identificador = a.identificador
  where a.estado_vinculo = 'confirmado'
    and a.parlamentario_id is not null
    and c.sector_id is not null
  group by a.parlamentario_id, c.sector_id;
end;
$$;
```
Mirror the cron block VERBATIM from `0030_net.sql:149-178` (pg_cron version guard + `cron.schedule('cruces-materializar', '23 3 * * *', ...)` + post-migration assertion that the job exists). Offset `23 3 * * *` avoids collision with `net-materializar-aristas` at `17 3`. `[VERIFIED: 0030_net.sql read]`

### Pattern 2: Separate classifier pipeline (NOT the literal-extraction flow)
**What:** Sector classification is **imputation to a closed taxonomy**, the opposite of `@obs/fichas` literal extraction (which verifies idea_matriz is a substring of the source). Reusing `FichaSchema`/`SYSTEM_EXTRACCION`/`evaluarGolden` would corrupt the SEM-02 literal contract.

**Reuse (CLI scaffolding only):** `parseArgs`, `--dry-run`, `decidirDryRun` (degrade-to-dry-run when no service key), env-driven config, `isMain` entry-point — all from `pipeline-cli.ts`.

**Do NOT reuse:** `FichaSchema`, `SYSTEM_EXTRACCION`, `construirPromptExtraccion`, `extraer.ts` (`sensitivity: "public"` is correct ONLY for project text, WRONG for contrapartes), the substring-based `evaluarGolden` scoring, the `≥0.95 precision / ≥0.80 recall` thresholds.

**Routing (D-12), the critical correctness detail:**
- Project text (idea_matriz/título = public) → `criticality: "bulk"` + `sensitivity: "public"` → router selects DeepSeek. Mirror `extraer.ts`.
- Contraparte name + materia (sensitive, Ley 21.719) → `criticality: "critical"` + `sensitivity: "personal"` → router selects MiniMax. Call `assertNoRutInLlmInput(prompt)` FIRST (the contraparte name should carry no RUT by design, but the gate is fail-closed).
- NOTE: `Sensitivity` is a **binary** type `"public" | "personal"` — there is no third value. "≠ public" means literally `"personal"`. Both DeepSeek and MiniMax have `trainsOnInputs=false`, so `assertSensitivityAllowed` passes for both; the DeepSeek/MiniMax split is driven by `criticality`, not by the sensitivity gate. The sensitivity value still matters for FND-06 audit correctness — mislabeling contraparte text as `"public"` is the violation MILESTONE §2.1 KEY NOTES warns about. `[VERIFIED: types.ts, providers grep, config.ts]`

### Pattern 3: Deny-by-default with explicit revoke (mirror 0021/0034)
**What:** This Supabase project grants ALL privileges to `anon`/`authenticated` on every new `public` table via DEFAULT PRIVILEGES. RLS-without-policy denies the ROWS, but the PRIVILEGE must also be revoked explicitly.

**Example:**
```sql
-- Source: verbatim convention from 0021_lobby.sql:90-98, 0034_entidad_tercero.sql:72-81
alter table cruce_senal enable row level security;
-- (intentionally ZERO policies, intentionally NO grant select to anon)
revoke all on cruce_senal from anon, authenticated;
```
The `sector` catalog, by contrast, IS public-read (reference data, no PII): mirror the `lobby_audiencia` public-read pattern (`create policy ... for select to anon using (true)` + `grant select to anon`). `[VERIFIED: 0021_lobby.sql:52-56, :90-98]`

### Pattern 4: RPC mirror with the ONE departure (no anon grant)
`cruces_de_parlamentario` mirrors `lobby_de_parlamentario`/`subgrafo_red`: `security definer set search_path = ''`, projects only safe columns, `revoke execute ... from public`. **The single difference:** DO NOT add `grant execute ... to anon`. Until the Phase 39 legal sign-off, the RPC is grantable to `service_role` only (or to no public role at all). pgTAP must assert anon has NO execute privilege (inverse of the `0030_net.test.sql:92-94` assertion). `[VERIFIED: 0021_lobby.sql:124-125, 0030_net.sql:253-254]`

### Anti-Patterns to Avoid
- **Treating `cruce_senal` as an `arista`:** binary-edge invariants (`extremo_a < extremo_b`, both-FK-to-entidad) do NOT apply. `cruce_senal` is a single aggregated row keyed `(parlamentario_id, sector_id, tipo_senal)`.
- **`grant execute ... to anon` on the RPC:** would expose sensitive cross data before legal sign-off. The whole phase is deny-by-default.
- **Inline LLM call in the writer:** breaks two-stage idempotency.
- **Reusing `FichaSchema`/literal golden for sector:** breaks SEM-02.
- **`sensitivity: "public"` for contraparte text:** FND-06 violation.
- **Causal wording in any string/comment surfaced to users:** linter-banned vocab.
- **`supabase db push`:** schema_migrations drift. Use `psql --db-url`.
- **A catch-all "Otros" sector:** D-05 forbids it; absence of match → NULL.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| RUT detection in LLM input | Custom regex | `assertNoRutInLlmInput` | Deliberately broad fail-closed regex, ≥10 tests, error never leaks the RUT. `[VERIFIED: data-routing.ts]` |
| Sensitivity→provider gate | Manual provider pick | `assertSensitivityAllowed` + router `byCriticality` | Fail-closed, shared `SensitiveRoutingError`. `[VERIFIED: data-routing.ts, router.ts]` |
| Structured LLM output + repair | Manual `safeParse` | `provider.complete(req, ZodSchema)` | Provider applies zod gate + repair loop internally (SEM-02 convention). `[VERIFIED: extraer.ts comment]` |
| Cron scheduling + version guard | Raw `cron.schedule` | Copy the guarded block from `0030_net.sql:149-178` | Includes pg_cron-installed guard + post-migration assertion that the job registered. `[VERIFIED: 0030_net.sql]` |
| Deny-by-default table | RLS policy juggling | RLS-on + zero policies + `revoke all from anon, authenticated` | The DEFAULT PRIVILEGES hole requires the explicit revoke. `[VERIFIED: 0021/0034]` |
| CLI dry-run / degrade gating | Custom arg parsing | Mirror `parseArgs`/`decidirDryRun` | No service key → degrade to dry-run with warning (never silent no-write). `[VERIFIED: pipeline-cli.ts]` |

**Key insight:** Every safety-critical primitive this phase needs already exists and is test-enforced. The risk is in NOT reusing them (e.g., a fresh RUT regex, a fresh provider pick) — which is exactly the kind of drift the conventions guard against.

## Common Pitfalls

### Pitfall 1: The MVP signal cannot reach ≥5 parlamentarios if it depends on aporte/donante evidence
**What goes wrong:** Naming the signal `lobby_sector_aporte` and sourcing evidence from `donante` (SERVEL) yields zero rows — donante data is gated until Phase 40, so the acceptance fails.
**Why it happens:** The acceptance text's token `lobby_sector_aporte` suggests lobby+aporte fusion, but only lobby data exists today.
**How to avoid:** Ship a **lobby-pure** signal (`tipo_senal='lobby_sector'` recommended, or `lobby_sector_aporte` with lobby-only evidence). Source evidence ONLY from `lobby_audiencia` (confirmed) + `lobby_contraparte.sector_id`. See Open Question 1.
**Warning signs:** pgTAP/materializer produces <5 distinct parlamentarios; `evidencia.items` references donante.

### Pitfall 2: Coverage depends on `lobby_contraparte.sector_id` being populated BEFORE materialization
**What goes wrong:** `materializar_cruces()` runs but `c.sector_id is null` everywhere → zero rows, because the classifier CLI never ran (or ran dry).
**Why it happens:** Two derived stages with an ordering dependency; CI green on build/typecheck does not prove the classifier wrote `sector_id`.
**How to avoid:** The plan must sequence: (1) apply migrations, (2) run `clasificar-lobby-cli` LIVE to populate `lobby_contraparte.sector_id`, (3) THEN run `materializar_cruces()`. The CRUCE-03 acceptance is an **operator LIVE step**, not a unit test. pgTAP can seed `sector_id` directly to prove the materializer logic; the ≥5-parlamentarios acceptance needs real classified lobby data.
**Warning signs:** materializer green in pgTAP (seeded) but zero rows in PROD.

### Pitfall 3: Abstention scored as error inflates the failure rate
**What goes wrong:** Golden gate counts NULL (abstain) as wrong → classifier looks worse than it is and the ≥7/10 gate fails spuriously.
**Why it happens:** Copying `evaluarGolden`'s scoring, where a missing value is an `fn`.
**How to avoid:** Per D-08, score: correct = exact sector match; NULL = not-covered (lowers coverage, NOT an error); wrong sector = error. Gate = "≥7/10 with non-null sector AND zero misclassifications among the non-null." A run of 10 abstentions = 0/10 coverage (fails the ≥7 bar) but produces zero *errors* — the distinction matters for the metric report.
**Warning signs:** Gate fails with high abstention but zero wrong assignments.

### Pitfall 4: RPC accidentally projects `donante_id`/`partido` via `select *` or join
**What goes wrong:** The RPC joins to `donante` or `parlamentario` and a `select *` leaks `donante_id`/`partido`/`rut`/`email`.
**Why it happens:** Convenience `select *` or `jsonb_agg(row_to_json(...))`.
**How to avoid:** Explicit column projection only (mirror `lobby_de_parlamentario`'s named `returns table(...)`). pgTAP asserts the function body does not contain `partido`/`rut`/`donante_id`/`email` (regex with comment-stripping, mirror `0030_net.test.sql:100-105`).
**Warning signs:** pgTAP regex assertion fails.

### Pitfall 5: DDL applied via `db push` instead of `psql --db-url`
**What goes wrong:** `schema_migrations` drift re-applies or skips migrations; pgTAP runs against an inconsistent schema.
**Why it happens:** Habit / CLI convenience.
**How to avoid:** Apply each migration with `psql --db-url --single-transaction` + explicit `schema_migrations` row insert. Operator checkpoint. `[VERIFIED: MEMORY, 0030 header]`
**Warning signs:** PROD pgTAP red where mock was green (MEMORY: "pgTAP-vs-PROD ve bugs que el mock NO").

## Code Examples

### Proposed sector catalog seed (D-03: Claude proposes, operator confirms)
~13 macro-sectors grounded in the real materias/comisiones of the Chilean Congress, citizen/press-legible, additive-stable (D-04). **This is a proposal for operator confirmation, not a locked list.**
```sql
-- Source: derived from Chilean Congress comisiones permanentes + lobby/aporte sector reality.
-- ASSUMED — requires operator confirmation per D-03/D-04. Codes are STABLE once live (never rename).
insert into sector (codigo, etiqueta) values
  ('salud',            'Salud y farmacéutica'),
  ('educacion',        'Educación'),
  ('mineria_energia',  'Minería y energía'),
  ('medio_ambiente',   'Medio ambiente y recursos hídricos'),
  ('trabajo_prevision','Trabajo y previsión social'),
  ('vivienda_urbanismo','Vivienda, urbanismo y obras públicas'),
  ('transporte',       'Transporte y telecomunicaciones'),
  ('agricultura_pesca','Agricultura, pesca y alimentos'),
  ('banca_finanzas',   'Banca, finanzas y seguros'),
  ('comercio_industria','Comercio, industria y retail'),
  ('tecnologia',       'Tecnología y economía digital'),
  ('seguridad_justicia','Seguridad, justicia y defensa'),
  ('gremios_trabajadores','Gremios, sindicatos y asociaciones');
-- D-05: NO 'otros'/catch-all. No match → sector_id NULL.
```

### `cruce_senal` table (deny-by-default, single row per parl+sector+tipo)
```sql
-- Source: shape per D-09; deny-by-default convention per 0021_lobby.sql:90-98.
create table cruce_senal (
  id               bigint generated always as identity primary key,
  parlamentario_id text not null references parlamentario(id) on delete cascade,
  sector_id        text not null references sector(codigo),
  -- allow-list of ONE signal type in the MVP (vote/aporte signals start OFF).
  -- Adding a type requires a new migration (correct friction; mirror arista's CHECK).
  tipo_senal       text not null check (tipo_senal in ('lobby_sector')),
  conteo           int  not null,
  evidencia        jsonb not null,   -- { conteo, items: [{ tipo, fecha, contraparte_nombre_crudo, audiencia_id, enlace_fuente }] }
  -- provenance inline NOT NULL (FND-08), derived from the lobby source rows.
  dataset          text not null,    -- 'lobby'
  origen           text not null,
  fecha_captura    timestamptz not null default now(),
  enlace           text not null,
  unique (parlamentario_id, sector_id, tipo_senal)   -- single-row key
);
alter table cruce_senal enable row level security;
revoke all on cruce_senal from anon, authenticated;
create index cruce_senal_parlamentario_idx on cruce_senal (parlamentario_id);
create index cruce_senal_sector_idx        on cruce_senal (sector_id);
```

### `sector_id` additive columns (3 tables)
```sql
-- Source: additive ALTER pattern (mirror 0036 column adds). NULL = honest no-match (D-05).
alter table proyecto_ficha   add column sector_id text references sector(codigo);
alter table lobby_contraparte add column sector_id text references sector(codigo);
alter table donante           add column sector_id text references sector(codigo);
```

### Classifier zod schema (closed enum, abstention)
```typescript
// Source: new in @obs/cruces/model.ts. NOT FichaSchema. Single-label top-1 + abstention.
import { z } from "zod";
import { SECTOR_CODIGOS } from "./sector"; // const tuple of codes from the catalog

export const ClasificacionSectorSchema = z.object({
  // exact catalog code, or null when not confident (D-05/D-08 abstention is first-class).
  sector_codigo: z.enum(SECTOR_CODIGOS).nullable(),
});
export type ClasificacionSector = z.infer<typeof ClasificacionSectorSchema>;
```

### pgTAP projection-exclusion assertion (mirror 0030_net.test.sql)
```sql
-- Source: mirror of 0030_net.test.sql:100-105 (comment-stripped regex, word boundaries).
select ok(
  (select regexp_replace(pg_get_functiondef(p.oid), '--[^\n]*', '', 'g')
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'cruces_de_parlamentario')
    !~* '\y(partido|rut|email|donante_id)\y',
  'cruces_de_parlamentario body never projects partido/rut/email/donante_id');

-- anon has NO execute (the inverse of subgrafo_red — deny until legal sign-off):
select ok(
  not has_function_privilege('anon', 'public.cruces_de_parlamentario(text)', 'execute'),
  'anon has NO execute on cruces_de_parlamentario (deny-by-default until Phase 39)');
```

## Runtime State Inventory

> This is primarily a greenfield-additive phase (new tables, new columns, new package), but it has one cron registration and one materialized table. Inventory:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | New: `cruce_senal` (materialized), `sector` (seed), `sector_id` columns on 3 existing tables. No rename of existing data. | Migrations create them; classifier CLI + materializer populate them. |
| Live service config | pg_cron job `cruces-materializar` (new schedule `23 3 * * *`) registered by migration 0039. Lives in `cron.job` (DB), created by DDL — captured in git via the migration. | None beyond applying the migration; post-migration assertion verifies registration (mirror 0030). |
| OS-registered state | None — no OS scheduler, no pm2, no Task Scheduler involvement. | None — verified by scope (DB-only + Deno CLI run by operator/CI). |
| Secrets/env vars | Reuses existing `DEEPSEEK_API_KEY`, `MINIMAX_API_KEY`, `SUPABASE_SECRET_KEY`, `SUPABASE_URL`. No new secret names. | None — verified against `pipeline-cli.ts` env usage. |
| Build artifacts | New workspace package `@obs/cruces` → pnpm workspace must include it; `dist/` built on `pnpm build`. | Add package to workspace; `pnpm install` once. |

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `arista` binary edge (NET) | `cruce_senal` single aggregated row + evidencia jsonb | This phase (validator correction) | Do not transfer arista invariants. |
| `sector_id` inside `FichaSchema` | Separate `@obs/cruces` schema/golden | This phase (validator correction) | Preserves SEM-02 literal contract. |
| RPC granted to anon (`subgrafo_red`, `lobby_de_parlamentario`) | RPC NOT granted to anon | This phase | Deny-by-default until Phase 39 legal sign-off. |

**Deprecated/outdated:** none relevant — the patterns being mirrored (0030, 0021, 0034) are the current PROD state (latest applied 0037).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The MVP signal should be lobby-pure and named `lobby_sector` (or `lobby_sector_aporte` with lobby-only evidence). | Summary / Open Question 1 | If operator wants strict `lobby_sector_aporte` semantics requiring aporte evidence, acceptance is unmeetable until Phase 40 — must confirm before planning. |
| A2 | The proposed ~13-sector catalog (codes + labels). | Code Examples | D-03 explicitly requires operator confirmation. Wrong codes → golden built against wrong taxonomy. Operator MUST review before seed is applied. |
| A3 | `evidencia.items[].tipo` value `'reunion'` for lobby audiencias. | Pattern 1 | Cosmetic; rendering in Phase 37 depends on it but is adjustable. |
| A4 | pg_cron offset `23 3 * * *` (suggested by design, Claude's discretion). | Pattern 1 | Low — any off-peak slot not colliding with `17 3` (net) works. |
| A5 | Migration numbering 0038/0039/0040. | Standard Stack | Low — verified latest is 0037; if another phase lands first, renumber. |
| A6 | Both DeepSeek and MiniMax pass `assertSensitivityAllowed` for personal data (both `trainsOnInputs=false`). | Pattern 2 | Verified in code; if a provider's flag changes, the `personal` route to it would throw. |

## Open Questions

1. **MVP signal semantics — `lobby_sector_aporte` name (PRIMARY).**
   - What we know: CRUCE-03 acceptance needs ≥1 row for ≥5 parlamentarios from CURRENT lobby data; donante/aporte (SERVEL) is gated to Phase 40; the design (MILESTONE §2.1) says "arrancar con `lobby_sector_aporte` (la menos insinuante)".
   - What's unclear: whether the token `lobby_sector_aporte` is meant literally (implying aporte evidence, which doesn't exist yet) or as the name of the lobby-derived signal.
   - **Recommendation:** Ship the signal as **lobby-pure**. Preferred: `tipo_senal = 'lobby_sector'` with evidence sourced only from `lobby_audiencia` + `lobby_contraparte.sector_id` ("N reuniones con gestores del sector X"). If the operator wants to retain the exact acceptance token, use `tipo_senal = 'lobby_sector_aporte'` but with lobby-only `evidencia` (zero aporte items) — the CHECK allow-list and materializer must permit a row built from lobby alone. The aporte dimension fuses in Phase 40. Surface this to the operator in discuss/plan as the one open naming decision.

2. **Where does the project's sector classification read its input text?**
   - What we know: `proyecto_ficha` has `idea_matriz` (public) usable as classification input.
   - What's unclear: whether to also use `titulo`/materia, and whether `idea_matriz` NULL rows (honest-degraded) are simply skipped (→ `sector_id` NULL).
   - Recommendation: classify from `idea_matriz` when present, else `titulo`; NULL idea AND null-confident → abstain → `sector_id` NULL. The planner decides the exact input concatenation; it does not affect the deny-by-default architecture.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| pg_cron | `materializar_cruces()` schedule | ✓ (used by 0030) | installed | post-migration assertion fails loudly if absent |
| DeepSeek API | project sector classification | ✓ (env `DEEPSEEK_API_KEY`) | per config `deepseek-v4-flash` | CLI degrades to dry-run without key |
| MiniMax API | contraparte sector classification | ✓ (env `MINIMAX_API_KEY`, MEMORY: M3 validated) | `MiniMax-M3` | CLI degrades to dry-run without key |
| psql + `--db-url` | apply migrations | ✓ (operator path, MEMORY) | — | none — operator checkpoint, only valid apply path |
| Supabase service key | classifier writes `sector_id` | ✓ (env `SUPABASE_SECRET_KEY`) | — | dry-run (no write) |

**Missing dependencies with no fallback:** none — all are present in the established v3/v4 toolchain.
**Missing dependencies with fallback:** classification CLIs degrade to dry-run without API/service keys (mirror `pipeline-cli.ts` `decidirDryRun`).

## Validation Architecture

> nyquist_validation: config not inspected as explicitly false → treated as enabled.

### Test Framework
| Property | Value |
|----------|-------|
| Framework (TS) | vitest (workspace convention; `*.test.ts` co-located, mock-provider for CI) |
| Framework (DB) | pgTAP via `psql --db-url` against APPLIED schema (the ONLY valid DB test) |
| Quick run command | `pnpm --filter @obs/cruces test` |
| Full suite command | `pnpm test` + `psql --db-url < supabase/tests/0038..0040_*.test.sql` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CRUCE-01 | `sector` public-read; `cruce_senal` deny-by-default; materializer body no partido/rut | pgTAP | `psql --db-url < supabase/tests/0038_sector.test.sql 0039_cruce_senal.test.sql` | ❌ Wave 0 |
| CRUCE-01 | RPC exists, security definer, NO anon execute | pgTAP | `psql --db-url < supabase/tests/0040_cruces_rpc.test.sql` | ❌ Wave 0 |
| CRUCE-02 | classifier `--dry-run` over 10 projects ≥7 non-null vs OWN golden; zero misclassifications | vitest (golden gate) | `pnpm --filter @obs/cruces test golden` | ❌ Wave 0 |
| CRUCE-02 | `assertNoRutInLlmInput` fails test if RUT in contraparte prompt | vitest | `pnpm --filter @obs/cruces test` | ❌ Wave 0 |
| CRUCE-03 | materializer produces ≥1 `lobby_sector` row for ≥5 parlamentarios (seeded in pgTAP; LIVE for real) | pgTAP (seeded) + operator LIVE | `psql --db-url < supabase/tests/0039_cruce_senal.test.sql` | ❌ Wave 0 |
| CRUCE-03 | RPC never projects rut/partido/email/donante_id | pgTAP | included in 0040 test | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `pnpm --filter @obs/cruces test`
- **Per wave merge:** `pnpm test`
- **Phase gate:** full vitest green + all three pgTAP suites green against APPLIED PROD schema before `/gsd:verify-work`. (MEMORY: pgTAP-vs-PROD finds bugs the mock does not — PROD run is mandatory.)

### Wave 0 Gaps
- [ ] `packages/cruces/src/golden/golden-set.ts` + `.test.ts` — single-label top-1 + abstention scoring (covers CRUCE-02)
- [ ] `packages/cruces/src/clasificar.test.ts` — RUT gate + sensitivity routing (covers CRUCE-02)
- [ ] `supabase/tests/0038_sector.test.sql` — sector public-read + sector_id columns (CRUCE-01)
- [ ] `supabase/tests/0039_cruce_senal.test.sql` — deny-by-default + materializer no-PII + ≥5-parl seeded path (CRUCE-01/03)
- [ ] `supabase/tests/0040_cruces_rpc.test.sql` — RPC projection exclusion + NO anon execute (CRUCE-01/03)
- [ ] `packages/cruces/package.json` + workspace registration + `mock-provider.ts`

## Security Domain

> security_enforcement assumed enabled (not explicitly false in config).

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No auth surface added; service-role only for writes. |
| V3 Session Management | no | No session state. |
| V4 Access Control | **yes** | Deny-by-default RLS + explicit `revoke all` on `cruce_senal`; RPC NOT granted to anon until legal sign-off (Phase 39). pgTAP asserts both. |
| V5 Input Validation | **yes** | zod closed-enum gate on LLM output (`ClasificacionSectorSchema`); provider repair loop. |
| V6 Cryptography | no | None hand-rolled; no crypto in scope. |
| (project-specific) PII minimization (Ley 21.719) | **yes** | `assertNoRutInLlmInput` (RUT never to LLM); RPC never projects rut/partido/email/donante_id; contraparte sensitivity = `personal`. |

### Known Threat Patterns for this stack
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| PII leak via RPC over-projection (`select *`, join leak) | Information Disclosure | Explicit named-column projection; pgTAP body regex excludes partido/rut/email/donante_id. |
| RUT exfiltration into LLM prompt | Information Disclosure | `assertNoRutInLlmInput` fail-closed BEFORE `complete()`; test fails if RUT leaks. |
| Premature public exposure of cross signals | Information Disclosure / Elevation | No anon grant on RPC; `cruce_senal` deny-by-default; presentation gate deferred to Phase 37/39. |
| Causal insinuation in surfaced text | (reputational / legal) | Factual wording only; banned-vocab linter; vote-derived signals OFF. |
| Sensitive contraparte data routed to a training provider | Information Disclosure | `sensitivity: "personal"` + `assertSensitivityAllowed`; both DeepSeek/MiniMax `trainsOnInputs=false`. |

## Sources

### Primary (HIGH confidence — codebase reads)
- `supabase/migrations/0030_net.sql` — `materializar_aristas` security-definer + cron + `subgrafo_red` RPC PII-safe projection. EXACT mirror source.
- `supabase/migrations/0021_lobby.sql` — `lobby_audiencia`/`lobby_contraparte` shape, deny-by-default + explicit revoke, RPC projection discipline.
- `supabase/migrations/0034_entidad_tercero.sql`, `0036_entidad_fk.sql` — entity master, FK conventions, RPC grant-by-exact-signature, donante.entidad_id deferral note.
- `supabase/migrations/0024_servel.sql` — `donante` table (deny-by-default; `donante_id`/`rut_donante` never public).
- `supabase/tests/0030_net.test.sql` — pgTAP mirror (deny-by-default, security-definer, no-PII body regex, RPC execute privilege assertions).
- `packages/llm/src/data-routing.ts` + `types.ts` + `config.ts` — `assertNoRutInLlmInput`, `assertSensitivityAllowed`, binary `Sensitivity`, `byCriticality` routing (critical→minimax, bulk→deepseek).
- `packages/fichas/src/{pipeline-cli,extraer,model,prompt,golden/golden-set}.ts` — CLI scaffolding to mirror; literal-extraction flow to NOT reuse; golden harness structure.
- `packages/adjudication/src/pipeline-entidad.ts` — proven DeepSeek/MiniMax split + RUT/sensitivity gate ordering for sensitive (third-party) classification.

### Secondary (MEDIUM confidence)
- `.planning/MILESTONE-v4-cruces.md` §2.1, `.planning/REQUIREMENTS.md` (CRUCE-01/02/03), `.planning/phases/36-.../36-CONTEXT.md` (D-01..D-13) — LOCKED design.
- MEMORY notes: latest PROD migration = 0037; pgTAP-vs-PROD bug discovery; MiniMax-M3 validated.

### Tertiary (LOW confidence — needs operator confirmation)
- Proposed 13-sector catalog (A2) — Claude-proposed per D-03, requires operator sign-off before seeding.

## Metadata

**Confidence breakdown:**
- Standard stack (patterns to mirror): HIGH — all verified against applied migrations + green pgTAP suites.
- Architecture (materializer/RPC/deny-by-default): HIGH — verbatim mirror of 0030/0021/0034.
- Classifier pipeline + golden: HIGH — structure mirrors fichas; scoring semantics locked by D-07/D-08.
- MVP signal semantics: MEDIUM — resolved to lobby-pure with a documented naming decision the operator should confirm (Open Question 1).
- Sector catalog: LOW — proposal only; D-03 requires operator confirmation.

**Research date:** 2026-06-24
**Valid until:** ~2026-07-24 (stable internal patterns; only the operator-confirmation items and any intervening migration numbering can drift).
