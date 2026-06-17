# Walking Skeleton — Observatorio del Congreso 360

**Phase:** 1
**Generated:** 2026-06-17

## Capability Proven End-to-End

> Fase 1 es backend puro (la UI llega en Fase 5). El "usuario" del walking skeleton es el operador del sistema; la capacidad probada es la rebanada de ingesta end-to-end.

Un `DummyConnector` corre dirigido por la cola (pg_cron → pgmq → pg_net → Edge Function): hace fetch respetando rate-limit 2-3s + User-Agent identificatorio + robots.txt, computa el fingerprint de drift, guarda el crudo en Cloudflare R2 content-addressed (sha256, inmutable via `If-None-Match: *`), registra `source_snapshot` con procedencia en Postgres, y es re-procesable desde R2 sin re-scrapear — sin tocar ninguna fuente gubernamental real.

## Architectural Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Monorepo tooling | pnpm workspaces (NO turbo) | Un solo build Node (`/app`); Deno no se buildea. turbo no aporta en M1 (RESEARCH §1) |
| Layout | `/app` (Next.js 16), `/supabase` (migraciones + Edge Functions Deno), `/packages/core` (tipos+zod+interfaces), `/packages/ingest` (framework conectores) | Decision LOCKED en CONTEXT.md; un solo lenguaje TS en todo el stack |
| TS compartido a Deno | import map en `supabase/functions/deno.json` + `npm:` specifiers, sin build step | Deno consume `@obs/*` por path relativo; evita build orchestration |
| Raw storage | Cloudflare R2 via `aws4fetch@1.0.20` (NO @aws-sdk/client-s3), content-addressed sha256, `If-None-Match: *` | aws-sdk v3 pesado/fragil en edge; aws4fetch usa fetch+SubtleCrypto nativos (RESEARCH §4) |
| Control plane | Postgres: `ingest_run`, `source_snapshot` (r2_path, hash, fingerprint, provenance), `drift_alert`; RLS deny-by-default | Crudo NUNCA en Postgres (limite 8 GB); solo referencias + procedencia |
| Orquestacion | pgmq + pg_cron + pg_net + Edge Function worker (clon de "automatic embeddings" de Supabase) | Todo en Supabase, sin Redis/proceso persistente; vt = backoff, archive = DLQ |
| Escape hatch backfill | GitHub Actions (Deno) corre el MISMO BaseConnector | Sin limite de ~400s de Edge Functions para crawls masivos |
| Drift | Fingerprint estructural (set de paths+tipos hasheado); registra `drift_alert`, no falla | Endpoints gubernamentales cambian esquema sin aviso; capturar el crudo igual |

## Stack Touched in Phase 1

- [x] Project scaffold (pnpm workspaces, tsconfig, vitest + deno test, Next.js 16 scaffold)
- [x] Routing — N/A en Fase 1 (backend puro; routing de UI diferido a Fase 5)
- [x] Database — read AND write reales: `source_snapshot` insert (write) + cache `hasToday` lookup (read) + migraciones aplicadas
- [x] "UI" interaction → reemplazado por: DummyConnector ejercitando el flujo invariante via la cola (la interaccion E2E del backend)
- [x] Deployment — Edge Function `ingest-worker` desplegable + workflow CI; run local full-stack via `supabase start` (docker disponible) + `supabase functions serve`

## Out of Scope (Deferred to Later Slices)

- Conectores de fuentes reales (Camara `doGet.asmx`, Senado `wspublico`, BCN `obtxml`, WebForms `__VIEWSTATE`, portal Next.js `__NEXT_DATA__`) → Fases 5-7. Solo DummyConnector en Fase 1.
- Providers LLM/Embeddings (adaptadores reales) → Fase 2. (Interfaces stub opcionales en `@obs/core`.)
- Parsers concretos (cheerio, fast-xml-parser) → Fases 5-7. El framework define el hook de parseo, no parsers.
- Validacion zod ESTRICTA → normalizadores Fase 5+. En ingesta solo shape-guard suave.
- UI / frontend (fichas, timeline, buscador) → Fases 5-7.
- Respaldo de tabla de identidades fuera de Supabase → Fase 3.
- Apache AGE / grafo → P6 (no disponible en Supabase managed).

## Subsequent Slice Plan

Cada fase posterior añade una rebanada vertical sobre este esqueleto sin alterar sus decisiones arquitectonicas:

- Phase 2: capa de Providers LLM/Embeddings (interfaces enchufables, salida estructurada per-proveedor, versionado de vectores) sobre `@obs/core`.
- Phase 3: tabla maestra Parlamentario + identidad determinista, heredando el framework `@obs/ingest` y la cola.
- Phase 4: adjudicacion de identidad + compuerta humana + golden set.
- Phase 5: tramitacion core — conectores reales JSON/XML (primer valor ciudadano visible: ficha + timeline + votaciones).
- Phase 6: citaciones + tabla de sala (conectores frágiles WebForms/Next.js).
- Phase 7: busqueda semantica + fichas estructuradas (embeddings Gemini + HNSW).
