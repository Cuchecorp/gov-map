---
phase: 15-money-financiamiento-servel-verbatim-sub-maestra-de-donantes
verified: 2026-06-19T17:10:00Z
status: human_needed
score: 4/4 must-have truths verified (code); 3 operator checkpoints require human action
overrides_applied: 0
mode: mvp
re_verification: null
human_verification:
  - test: "Aplicar la migracion 0024_servel.sql al Postgres remoto y correr el pgTAP 0025 contra el schema APLICADO"
    expected: "supabase db push --db-url + supabase test db --db-url -> pgTAP 24/24 verde, en particular los 3 asserts deny-by-default de donante, el NOT NULL de aporte.eleccion, el FK nullable de aporte.parlamentario_id, el col_has_check (WR-04, parlamentario_id is null or estado_vinculo=confirmado) y los 2 asserts del cuerpo del RPC (orden eleccion + sin rut_donante)"
    why_human: "CI no aplica DDL (falso positivo, leccion 0023); requiere credenciales de DB del operador. La migracion fue EDITADA en code-review (WR-04 CHECK, plan 23->24) -> re-apply remoto obligatorio. Checkpoint:human-action gate=blocking, NO auto-aprobable."
  - test: "Crear el bucket privado de Supabase Storage crudo-servel"
    expected: "Bucket privado crudo-servel existe (dashboard Storage -> New bucket privado, o insert into storage.buckets); el conector usa la service key (bypassa Storage RLS)"
    why_human: "Requiere acceso al dashboard/credenciales Supabase del operador; el helper NO crea el bucket en runtime (por diseno)"
  - test: "Corrida LIVE acotada de una eleccion contra la URL .xlsx real de SERVEL (Azure Blob)"
    expected: "(a) el crudo .xlsx aparece en crudo-servel bajo servel/<eleccion>/<fecha>/<hash>.xlsx; (b) el gate de header NO disparo cuarentena (11 headers coinciden); (c) completitud OK (Content-MD5/byte-length); (d) el cruce por NOMBRE poblo parlamentario_id SOLO en deterministas, homonimos/ambiguos -> null + cola identidad_audit (fail-closed); (e) DATA-ROUTING: ningun nombre/RUT de DONANTE viajo al LLM (solo el candidato); (f) re-correr produce los mismos conteos (idempotente) y no duplica el crudo"
    why_human: "Requiere la URL per-eleccion del Azure-blob (la provee el operador), service key, provider LLM real + red; ejercita el pipeline de identidad real + RevisionWriter. Sin la corrida LIVE la cobertura real depende del operador + cola de adjudicacion humana (IDENT-10 standing debt)"
deferred:
  - truth: "Agregacion de aportes por contraparte/donante"
    addressed_in: "Phase 16"
    evidence: "15-CONTEXT.md Deferred Ideas: 'Agregacion de aportes por contraparte/donante — Phase 16'. La sub-maestra donante deny-by-default se construye aqui (no diferida); solo la agregacion publica se difiere."
  - truth: "Encendido real de MONEY_PUBLIC_ENABLED + sign-off legal"
    addressed_in: "Operador (deuda F13)"
    evidence: "15-CONTEXT.md: el gate nace OFF (default); nada se enciende hasta el sign-off legal real (deuda operador F13). Phase 15 ships GATED OFF por diseno."
  - truth: "Poblar el RUT interno de la maestra (IDENT-10); migrar el crudo a R2 cuando el token funcione"
    addressed_in: "Operador (deuda IDENT-10 / R2)"
    evidence: "15-CONTEXT.md Deferred Ideas. El enlace SERVEL es por NOMBRE (A1), NO depende de RUT; R2 401 -> Supabase Storage es el destino de esta fase."
---

# Phase 15: MONEY Financiamiento — SERVEL verbatim + sub-maestra de donantes — Verification Report

**Phase Goal (MVP user-story surface):** El ciudadano ve el financiamiento de campaña de un parlamentario VERBATIM, ingerido por un conector SERVEL artesanal y fragil que se pone en CUARENTENA ante cualquier corrida parcial; la sección de ficha vive detrás de un doble candado (gate de exposición OFF + RLS deny-by-default), el donante es su propio sujeto (RUT nunca expuesto), y el aporte se asocia al candidato por NOMBRE confirmado (no por RUT — SERVEL no trae RUT).
**Verified:** 2026-06-19T17:10:00Z
**Status:** human_needed
**Re-verification:** No — initial verification
**Mode:** mvp (all-or-nothing per phase)

## Goal Achievement

### Observable Truths (ROADMAP success criteria + load-bearing security property)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | SERVEL connector en `@obs/dinero` ingiere aportes VERBATIM + construye la sub-maestra de donantes aquí | VERIFIED | `connector-servel.ts` (fetch .xlsx, host EXACTO, anclas), `parse-servel.ts` (xlsx -> Aporte[] VERBATIM, monto string crudo, sin LLM), `model-servel.ts` (`Donante` sub-maestra), `0024_servel.sql` crea `donante` deny-by-default. 73/73 dinero tests verdes. |
| 2 | Drift es BLOQUEANTE: corrida parcial -> cuarentena con reconciliación de completitud (counts/totals), nunca filas silenciosas; crudo -> Supabase Storage (R2 = 401) | VERIFIED | `ingest-run-servel.ts`: drift de header (parse THROW) -> `continue` antes de cualquier upsert (l.165); mismatch de completitud -> `continue` (l.183); `cuarentena:true`, 0 filas. `reconciliar-completitud.ts` fail-closed (sin ancla -> `{ok:false}`). `storage-supabase.ts` sube a Supabase Storage clave versionada idempotente (WR-03 fix estructurado). Tests asertan 0 upserts en cada path de cuarentena. |
| 3 | Ficha muestra financiamiento verbatim, fuente/fecha/enlace por fila, restringido por periodo electoral (candidatura previa nunca atribuida al mandato actual sin fechar) | VERIFIED | `financiamiento-de-parlamentario.tsx`: agrupa por `eleccion` (DESC vía RPC), `Elección:` por fila (defense in depth), caveat ámbar de candidatura anterior, `ProvenanceBadge` por fila + fecha de corte. `aporte.eleccion` NOT NULL (0024) + RPC `order by eleccion desc`. 20/20 app tests verdes. |
| 4 | Aporte->parlamentario link por PIPELINE DE IDENTIDAD CONFIRMADO (nombre del candidato vía `correrPipeline`; solo determinista/confirmado puebla el FK, auditado), NO RUT-exact; estados honestos (verificado/no-verificado/no-ingestado); empty ≠ clean | VERIFIED | `reconciliar-aporte.ts`: solo `res.tipo==="determinista"` mintea `confirmar()` + puebla FK (l.160-165); el resto -> null + `no_confirmado` (fail-closed, IDENT-12). 3 estados honestos textualmente distintos en la View + tests que asertan ausencia de los otros dos. WR-04 CHECK en DB acopla `parlamentario_id` a `estado_vinculo='confirmado'`. |
| S | SECURITY (load-bearing): SOLO el nombre del candidato llega a `correrPipeline`/LLM; NINGÚN campo del donante (nombre/tipo/rut); `donante` deny-by-default + revoke; el RPC nunca proyecta RUT de donante | VERIFIED | `reconciliar-aporte.ts` l.129-144: la `MencionForanea` se arma SOLO de `candidatoNombreVerbatim`; ningún campo del donante toca el pipeline. `pipeline.ts` l.152-153 corre `assertNoRutInLlmInput`+`assertSensitivityAllowed` sobre el prompt EXACTO antes de `complete`. Test data-routing (`reconciliar-aporte.test.ts` l.191+) aserta que el donante nunca aparece en vínculo/cola/prompt. `0024_servel.sql` `donante`: RLS enabled + 0 policies + `revoke all ... from anon, authenticated` (l.148,156); RPC no selecciona `rut_donante`/`donante_id`. |

**Score:** 4/4 ROADMAP success criteria verified in code + 1 load-bearing security property verified. All automated tests pass. Remaining items are operator checkpoints (human action), not code gaps.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase/migrations/0024_servel.sql` | aporte (public-read, versionada, eleccion NOT NULL, FK confirmado-only) + donante (deny-by-default+revoke) + marcador + RPC | VERIFIED | Todo presente; WR-04 CHECK `aporte_parlamentario_solo_confirmado` (l.112-113) en el shipped migration. Sin BOM/unicode. NO 'CC BY 4.0', NO 'mencion de la fuente', NO cron. |
| `supabase/tests/0025_servel.test.sql` | pgTAP existencia + RLS + 3 asserts deny-by-default + RPC + col_has_check WR-04 | VERIFIED (estructura) | `plan(24)`; 24 asserts contados, incluyen `col_has_check` para WR-04 y RPC body `not ilike rut_donante`. Ejecución contra schema aplicado = operador (human_needed #1). |
| `packages/dinero/src/reconciliar-aporte.ts` | enlace por NOMBRE vía correrPipeline; solo determinista puebla; donante nunca al pipeline | VERIFIED | Data-routing gate estructural; IDENT-12 switch; fail-closed PROVIDER_AUSENTE. |
| `packages/dinero/src/reconciliar-completitud.ts` | reconciliación run-level -> señal de cuarentena | VERIFIED | Content-MD5 + byte-length + TOTAL best-effort; sin ancla -> `{ok:false}`. |
| `packages/dinero/src/storage-supabase.ts` | subida idempotente del crudo, clave versionada | VERIFIED | `.storage.from(...).upload(...)`, clave `servel/<eleccion>/<fecha>/<hash>.xlsx`; idempotencia estructurada (WR-03). |
| `packages/dinero/src/connector-servel.ts` | fetch .xlsx host EXACTO + https forzado + anclas | VERIFIED | Orden LOCKED; host vía `extraHosts`; assertion https; `ServelBloqueadaError`. |
| `packages/dinero/src/ingest-run-servel.ts` | cuarentena BLOQUEANTE run-level | VERIFIED | 0 filas en drift/mismatch; WR-05 boundary guard. |
| `app/components/financiamiento-de-parlamentario.tsx` | FinanciamientoView (pura) + Section (gated) | VERIFIED | Gate re-check antes de Supabase; donante sujeto; RUT nunca renderizado; "por nombre confirmado". |
| `app/app/parlamentario/[id]/page.tsx` | #financiamiento SIBLING de #dinero dentro del gate | VERIFIED | `<section id="financiamiento" mt-12>` con heading dentro de `moneyPublicEnabled(process.env) &&` (l.119-128). |
| `app/lib/types.ts` | rama SERVEL en sourceLabel + AporteRpcRow (sin RUT donante) | VERIFIED | `sourceLabel` -> "SERVEL" (l.410); `AporteRpcRow` sin `rut_donante`. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `0024_servel.sql` | `parlamentario(id)` | FK `parlamentario_id references parlamentario(id) on delete set null` | VERIFIED | l.76 |
| `aportes_de_parlamentario` | `aporte` | `where a.parlamentario_id = p_id order by a.eleccion desc, a.fecha_aporte desc nulls last` | VERIFIED | l.191-194 |
| `connector-servel.ts` | `@obs/ingest assertAllowedUrl` | `extraHosts:[SERVEL_HOST]` + assertion https | VERIFIED | l.134-138,158 |
| `reconciliar-aporte.ts` | `@obs/adjudication correrPipeline` | solo candidato; solo determinista confirma | VERIFIED | l.147,160-165 |
| `ingest-run-servel.ts` | `reconciliar-completitud` | mismatch -> cuarentena run, 0 filas | VERIFIED | l.174-184 |
| `page.tsx` | `FinanciamientoSection` | section dentro de `moneyPublicEnabled() &&` + Suspense + Skeleton | VERIFIED | l.119-128 |
| `financiamiento.tsx` | `aportes_de_parlamentario` RPC | `sb.rpc` después del gate | VERIFIED | l.375,388 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `FinanciamientoSection` | `rpcData` / `todos` | `sb.rpc("aportes_de_parlamentario")` (security-definer RPC sobre `aporte`) | Depende del LIVE run (la tabla está vacía hasta el operador la pueble); el wiring es real (RPC real, error THROWs, no static fallback) | FLOWING (wiring) / dato real pendiente del LIVE run (human_needed #3) |

Nota: con `moneyPublicEnabled` OFF (default) y la DB no aplicada/poblada aún, la sección no renderiza dato real todavía — por diseño (ships GATED OFF). El wiring está completo y es real; la población de datos es el operator LIVE checkpoint, no un hollow-prop.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Suite dinero (parse/drift/completitud/reconciliar/storage/writer/cuarentena) | `pnpm exec vitest run packages/dinero` | 10 files / 73 tests passed | PASS |
| Sección ficha (gate-off, 3 estados, donante-sujeto, sin "por RUT", caveat periodo) | `cd app && pnpm test financiamiento` | 20 tests passed | PASS |

### Probe Execution

| Probe | Command | Result | Status |
|-------|---------|--------|--------|
| pgTAP `0025_servel.test.sql` contra schema APLICADO | `supabase test db --db-url ...` | No ejecutable por el verificador (requiere DB remota del operador; CI no aplica DDL) | DEFERRED -> operador (human_needed #1) |

No hay probes `scripts/*/tests/probe-*.sh` para esta fase; el único probe es el pgTAP contra el schema aplicado, que es explícitamente un checkpoint de operador (no auto-ejecutable sin credenciales remotas).

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| MONEY-03 | 15-01/02/03 | Conector SERVEL verbatim + sub-maestra donantes + drift bloqueante + crudo a object storage | SATISFIED | Truths 1,2; código + tests verdes |
| MONEY-04 | 15-01/02/03 | Enlace candidato confirmado (por NOMBRE, A1) + estados honestos + RUT donante nunca expuesto | SATISFIED | Truths 4,S; código + tests verdes |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| (ninguno) | — | Sin TBD/FIXME/XXX/HACK ni placeholder/not-implemented en los archivos shipped | — | — |

### Human Verification Required

Tres checkpoints de OPERADOR, intencionales y bloqueantes — NO son gaps de código (el código + tests están completos):

#### 1. Aplicar la migración 0024 al remoto + correr pgTAP 0025
**Test:** `supabase db push --db-url "$SUPABASE_DB_URL"` luego `supabase test db --db-url "$SUPABASE_DB_URL"`.
**Expected:** pgTAP 24/24 verde — en particular: 3 asserts deny-by-default de `donante`, NOT NULL de `aporte.eleccion`, FK nullable de `aporte.parlamentario_id`, `col_has_check` (WR-04: `parlamentario_id is null or estado_vinculo='confirmado'`), y los 2 asserts del cuerpo del RPC (orden por eleccion + sin `rut_donante`).
**Why human:** CI no aplica DDL (falso positivo, lección 0023); requiere credenciales de DB. La migración fue editada en code-review (WR-04 CHECK, plan 23->24) -> el re-apply remoto es obligatorio. Un assert rojo es un hueco real del DDL, no un falso positivo de CI.

#### 2. Crear el bucket de Supabase Storage `crudo-servel`
**Test:** Dashboard Storage -> New bucket `crudo-servel` (privado), o `insert into storage.buckets(id,name,public) values('crudo-servel','crudo-servel',false)`.
**Expected:** El bucket privado existe; el conector usa la service key (bypassa Storage RLS).
**Why human:** Requiere acceso al dashboard/credenciales Supabase; el helper no crea el bucket en runtime por diseño.

#### 3. Corrida LIVE acotada con la URL .xlsx real de una elección
**Test:** `pnpm --filter @obs/dinero ingest:servel --eleccion <slug> --url "<blob-url>" --anio <YYYY>` con SUPABASE_URL/SERVICE_KEY + provider LLM en env (delay 2-3s).
**Expected:** (a) crudo en `crudo-servel` bajo `servel/<eleccion>/<fecha>/<hash>.xlsx`; (b) header sin cuarentena (11 headers coinciden); (c) completitud OK (Content-MD5/byte-length); (d) `parlamentario_id` poblado SOLO en deterministas, homónimos/ambiguos -> null + cola `identidad_audit` (fail-closed correcto); (e) DATA-ROUTING: ningún nombre/RUT de DONANTE viajó al LLM; (f) re-correr idempotente, no duplica el crudo. Si el header drifteó -> CUARENTENA con 0 filas (comportamiento correcto).
**Why human:** Requiere la URL per-elección (operador), service key, provider LLM real + red; ejercita el pipeline de identidad real + RevisionWriter contra `identidad_audit`. La cobertura real depende del LIVE run + cola de adjudicación humana (IDENT-10 standing debt — pero el enlace por NOMBRE NO depende de poblar RUT).

### Deferred Items (addressed in later phases / operator debt)

| # | Item | Addressed In | Evidence |
|---|------|-------------|----------|
| 1 | Agregación de aportes por contraparte/donante | Phase 16 | 15-CONTEXT Deferred Ideas. La sub-maestra `donante` se construye AQUÍ; solo la agregación pública se difiere. |
| 2 | Encendido real de MONEY_PUBLIC_ENABLED + sign-off legal | Operador (F13) | Phase 15 ships GATED OFF por diseño; nada se enciende sin sign-off legal. |
| 3 | Poblar RUT interno de la maestra (IDENT-10); migrar crudo a R2 | Operador (IDENT-10 / R2) | El enlace SERVEL es por NOMBRE (A1), NO depende de RUT; R2 401 -> Supabase Storage es el destino de esta fase. |

### Gaps Summary

No code gaps. Las cuatro success criteria del ROADMAP y la propiedad de seguridad load-bearing están verificadas en el código shipped, con 93 tests verdes en total (73 dinero + 20 app). Las correcciones del code-review (WR-01..WR-05) están presentes en los archivos shipped, incluyendo el CHECK constraint WR-04 en la migración. Los tres ítems restantes (apply remoto + pgTAP, creación del bucket, corrida LIVE) son checkpoints de operador intencionales y bloqueantes que requieren credenciales/recursos del operador — están listados como human_verification, no como gaps. Esta fase ship GATED OFF por diseño (doble candado), por lo que la ausencia de dato visible público es el estado correcto, no una carencia.

---

_Verified: 2026-06-19T17:10:00Z_
_Verifier: Claude (gsd-verifier)_
