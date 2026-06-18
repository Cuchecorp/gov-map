---
phase: 07-b-squeda-sem-ntica-fichas-estructuradas
verified: 2026-06-18T18:20:00Z
status: human_needed
score: 6/6 must-have truths verified (capability basis)
overrides_applied: 0
human_verification:
  - test: "Búsqueda en lenguaje natural end-to-end con corpus real"
    expected: "La home muestra landing de búsqueda; una consulta como 'protección de datos personales' devuelve tarjetas con boletín, título, EtapaBadge, CamaraChip, ProvenanceBadge — sin ningún porcentaje de relevancia ni score; el log de red confirma que ninguna llamada a Gemini sale del cliente"
    why_human: "Requiere corpus backfill operacional (datos en proyecto_ficha / proyecto_embedding) para producir resultados reales; las pruebas automatizadas verifican el código con mocks. El operator acepta que el corpus está vacío en la nube hasta que corra el backfill."
  - test: "Atajo de boletín redirige sin embeber"
    expected: "Escribir un número de boletín (p.ej. 15234-07) en /buscar redirige directo a /proyecto/15234-07 sin llamar Gemini"
    why_human: "Comportamiento de redirect Next.js verificable solo en navegador; el test unitario de buscar.ts cubre la lógica pero no el render de la página completa."
  - test: "Secciones de ficha /proyecto/[boletin] con texto disponible"
    expected: "La sección 'Idea matriz' muestra una cita literal en blockquote con ProvenanceBadge; 'Cuerpos legales afectados' lista normas; 'Proyectos similares' muestra vecinos kNN excluyendo el propio boletín"
    why_human: "Requiere corpus real; aprobado por el operator sobre evidencia automatizada (build + tests) según verification_context."
  - test: "Estado 'no disponible' honesto cuando texto ausente"
    expected: "Ficha sin texto disponible muestra 'Idea matriz no disponible' en bloque gris (bg-muted/40), sin fabricar resumen ni usar rojo (border-destructive)"
    why_human: "Estado visible solo con datos reales o storybook; grep confirma ausencia de border-destructive y presencia de 'no disponible' en el componente."
---

# Phase 7: Búsqueda Semántica + Fichas Estructuradas — Verification Report

**Phase Goal:** Un ciudadano puede buscar proyectos de ley en lenguaje natural por idea matriz o cuerpos legales y descubrir "proyectos similares", recibiendo fichas estructuradas con plena trazabilidad a la fuente.

**Verified:** 2026-06-18T18:20:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

**Operator-accepted context:** Cloud DB schema (migrations 0001..0011) is live and confirmed. Cloud corpus is empty pending backfill — this is an operational follow-up, not a phase gap. Capability (code + schema + tests) is the verification target. Visual checkpoint (Task 4 of 07-03) was operator-approved on automated evidence; live visual deferred until corpus exists.

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | SEM-01: Sistema descarga texto íntegro con SSRF guard via @obs/ingest | VERIFIED | `texto-fuente.ts` contiene `assertAllowedUrl` (grep count 3); 7 tests verde incluyendo caso R2-401-degrada y link-ausente |
| 2 | SEM-02: Extracción idea matriz + cuerpos legales vía DeepSeek con gate golden ≥0.95 precisión | VERIFIED | `extraer.ts` + `golden/golden-set.test.ts` (8 tests verde, 1 skip LIVE-gated); `PRECISION_MIN` presente; `FICHAS_GOLDEN_LIVE` env-gated; FichaSchema valida nullable idea_matriz |
| 3 | SEM-03: Embeddings Gemini 768-dim indexados en pgvector HNSW + RPC anon-accessible | VERIFIED | Migration 0011 con `vector_cosine_ops`, `grant execute on function match_proyectos` (count=1), `for select to anon using (true)` (count=2); `RETRIEVAL_DOCUMENT` en embed-ficha.ts (count=4); `taskType` en gemini-embeddings.ts (count=4); schema aplicado en cloud |
| 4 | SEM-04: Usuario busca en lenguaje natural server-only sin exponer key | VERIFIED (code) | `buscar.ts`: `server-only` (count=6), `match_proyectos` (count=3), `BOLETIN_RE` (count=4), `NEXT_PUBLIC_` (count=0); 9 tests verde; atajo boletín implementado |
| 5 | SEM-05: Proyectos similares por kNN excluyendo el propio boletín | VERIFIED (code) | `proyectos-similares.tsx` existe; `exclude_boletin` parametrizado en RPC; `buscar/page.tsx` compila; build Next verde con ruta `/buscar` dynamic |
| 6 | SEM-06: Ficha unifica boletín/título/iniciativa/autores/cámara/materia/idea matriz/cuerpos/estado/enlace | VERIFIED (code) | `search-result-card.tsx` + `idea-matriz-block.tsx` + `cuerpos-legales-list.tsx` existen; `no disponible` (count=2), `border-destructive` absent (count=0), score/similarity absent en card (grep=0); `/proyecto/[boletin]/page.tsx` retiene secciones existentes + 3 nuevas secciones |

**Score:** 6/6 truths verified at capability level

**Corpus data load:** Out of phase scope — operational backfill step. Empty corpus returns honest empty states, not errors.

---

### Required Artifacts

| Artifact | Status | Details |
|----------|--------|---------|
| `packages/fichas/src/model.ts` | VERIFIED | FichaSchema + CuerpoLegalSchema con idea_matriz nullable, max constraints |
| `packages/fichas/src/golden/golden-set.test.ts` | VERIFIED | PRECISION_MIN=0.95 gate, FICHAS_GOLDEN_LIVE env-gated LIVE block, 8 tests (1 skip) |
| `supabase/migrations/0011_fichas_embeddings.sql` | VERIFIED | proyecto_ficha, proyecto_embedding vector(768), HNSW, match_proyectos, grant execute anon, 2x RLS public-read |
| `packages/fichas/src/texto-fuente.ts` | VERIFIED | assertAllowedUrl, r2Enabled gate, null-degradation |
| `packages/fichas/src/embed-ficha.ts` | VERIFIED | RETRIEVAL_DOCUMENT, compose defensivo ante idea_matriz null |
| `packages/fichas/src/pipeline.ts` | VERIFIED | correrPipeline exportado, error-collection-not-abort, --reembed |
| `packages/fichas/src/writer-supabase.ts` | VERIFIED | onConflict (count=5), deduplication |
| `packages/fichas/src/pipeline-cli.ts` | VERIFIED | FichasCliArgsError, dry-run-without-key, isMain guard |
| `.github/workflows/fichas-backfill.yml` | VERIFIED | workflow_dispatch (count=2), secrets via ${{ secrets.* }} |
| `app/lib/buscar.ts` | VERIFIED | server-only, match_proyectos, BOLETIN_RE, no NEXT_PUBLIC_ |
| `app/app/buscar/page.tsx` | VERIFIED | Dynamic route in build; BOLETIN_RE redirect present |
| `app/components/idea-matriz-block.tsx` | VERIFIED | 'no disponible' present, border-destructive absent |
| `supabase/tests/0011_fichas_embeddings.test.sql` | VERIFIED | File exists with pgTAP assertions |

---

### Key Link Verification

| From | To | Via | Status |
|------|----|-----|--------|
| `packages/fichas/src/extraer.ts` | `DeepSeekProvider.complete` | FichaSchema import | VERIFIED |
| `supabase/migrations/0011_fichas_embeddings.sql` | anon role | grant execute on function match_proyectos | VERIFIED (count=1) |
| `packages/fichas/src/texto-fuente.ts` | `@obs/ingest assertAllowedUrl` | LOCKED order fetch policy | VERIFIED (count=3) |
| `packages/fichas/src/embed-ficha.ts` | `GeminiEmbeddingProvider.embed RETRIEVAL_DOCUMENT` | asymmetric embedding | VERIFIED (count=4) |
| `app/lib/buscar.ts` | `rpc match_proyectos` | `createServerSupabase().rpc` | VERIFIED (count=3) |
| `app/app/buscar/page.tsx` | `redirect(/proyecto/...)` | BOLETIN_RE shortcut | VERIFIED |

---

### Test Suite Results

All test suites ran clean:

- `packages/fichas`: 9 files, 53 passed, 1 skipped (LIVE-gated golden test — expected)
- `packages/tramitacion`: 14 files, 102 passed (includes link_mensaje_mocion assertions)
- `packages/llm`: passes (gemini-embeddings taskType tests green)
- `app`: 9 files, 67 passed
- `packages/core`, `packages/adjudication`, `packages/ingest`, `packages/identity`: all green
- `pnpm -r test`: full workspace green

`pnpm build` (Next.js 16): compiles without error; routes `/`, `/buscar` (dynamic), `/proyecto/[boletin]` (dynamic) present.

---

### Behavioral Spot-Checks

| Behavior | Check | Result |
|----------|-------|--------|
| Migration grant execute anon | `grep -c "grant execute on function match_proyectos" 0011_fichas_embeddings.sql` | 1 — PASS |
| HNSW order by distance | `grep -c "order by e.embedding"` | 1 — PASS |
| RLS both tables | `grep -c "for select to anon using (true)"` | 2 — PASS |
| Gemini key not public | `grep -c "NEXT_PUBLIC_" app/lib/buscar.ts` | 0 — PASS |
| Score not shown in UI | `grep -Eic "similarity\|distance\|% match\|score" search-result-card.tsx` | 0 — PASS |
| Scaffold removed | `grep -c "page.module.css" app/app/page.tsx` | 0 — PASS |
| Backfill workflow secrets | file uses `${{ secrets.* }}` | workflow_dispatch count=2 — PASS |

---

### Requirements Coverage

| Requirement | Description | Status | Evidence |
|-------------|-------------|--------|----------|
| SEM-01 | Descarga texto íntegro mensajes y mociones | SATISFIED | texto-fuente.ts + link_mensaje_mocion en parser Senado |
| SEM-02 | Extrae idea matriz + cuerpos legales via LLM | SATISFIED | extraer.ts + FichaSchema + golden gate ≥0.95 |
| SEM-03 | Embeddings Gemini 768-dim + HNSW + pgvector | SATISFIED | migration 0011 on cloud + embed-ficha.ts RETRIEVAL_DOCUMENT |
| SEM-04 | Búsqueda lenguaje natural con fichas trazables | SATISFIED (code) | buscar.ts server-only + /buscar page + 9 tests |
| SEM-05 | Proyectos similares kNN | SATISFIED (code) | proyectos-similares.tsx + match_proyectos exclude_boletin |
| SEM-06 | Ficha unifica todos los campos con trazabilidad | SATISFIED (code) | idea-matriz-block + cuerpos-legales-list + search-result-card |

---

### Anti-Patterns Found

No blockers found.

| File | Pattern | Severity | Assessment |
|------|---------|----------|------------|
| `packages/fichas/src/slice.e2e.test.ts` | Previously RED (design intent) | Info | Now GREEN (3 tests pass) — slice E2E closed by ola 2/3 as intended |
| `app/components/proyectos-similares.tsx` | Renders empty state when corpus empty | Info | Honest degradation per spec — "Aún no hay proyectos similares" copy acceptable |

No TBD/FIXME/XXX markers found in phase files. No hardcoded secrets in fichas-backfill.yml.

---

### Human Verification Required

#### 1. Búsqueda en lenguaje natural con corpus real

**Test:** Run `cd app && pnpm dev`, open http://localhost:3000. After running the backfill to populate at least some fichas, enter a natural language query (e.g. "protección de datos personales") in the search box.
**Expected:** Results page shows cards with boletín, título as link, EtapaBadge, CamaraChip, ProvenanceBadge. No relevance percentage or score appears anywhere. DevTools Network tab shows no calls to Gemini from the browser.
**Why human:** Requires operational corpus data; all automated evidence (code + tests + build) is green but real output needs real data.

#### 2. Atajo de boletín redirect

**Test:** Type a boletín number (e.g. `15234-07`) in the search box on /buscar.
**Expected:** Immediate redirect to `/proyecto/15234-07` without triggering a Gemini embed call.
**Why human:** Next.js redirect behavior under user interaction is not covered by unit tests alone.

#### 3. Ficha estructurada con texto disponible

**Test:** Navigate to a /proyecto/[boletin] page for a project that has been processed by the pipeline (estado='embebido').
**Expected:** "Idea matriz" section shows literal quote in blockquote with ProvenanceBadge; "Cuerpos legales afectados" lists norms; "Proyectos similares" shows kNN neighbors excluding the current project's boletín.
**Why human:** Requires corpus. Operator approved this checkpoint on automated evidence per verification_context.

#### 4. Estado honesto cuando texto no disponible

**Test:** Navigate to /proyecto/[boletin] for a project with idea_matriz=null in proyecto_ficha.
**Expected:** Section shows "Idea matriz no disponible" in grey block (bg-muted/40), not red, not a fabricated summary.
**Why human:** Requires data row with null idea_matriz in the live database.

---

### Gaps Summary

No gaps. All capability artifacts exist, are substantive, wired, and test-green. The four human verification items above are operational readiness checks (corpus data dependency) that the operator has explicitly accepted as deferred. They do not represent missing code or schema.

---

_Verified: 2026-06-18T18:20:00Z_
_Verifier: Claude (gsd-verifier)_
