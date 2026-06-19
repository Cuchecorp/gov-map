---
quick_id: 260618-r7t
slug: fix-code-review-v1
date: 2026-06-18
status: complete
---

# Quick Task: Fix 43 hallazgos del code review v1.0

**Fuente:** `.planning/milestones/v1.0-CODE-REVIEW.md` (43 confirmados, 0 críticos, 0 altos, 9 medios, 34 bajos).
**Branch:** `fix/code-review-v1`.

## Estrategia de ejecución

Secuencial por archivo (no paralelo) por clustering: `parse-camara-citaciones.ts` (#5,#6,#24,#28), `fecha.ts` (#4,#21), `worker.ts` (#40,#41), `buscar/page.tsx` (#9,#32,#36), `adjudication/pipeline.ts` (#12,#18). Commit atómico por archivo/concern. Tests vitest tras cada paquete.

**Restricción conocida (memoria `env-credentials-reality`):** DDL en Supabase remoto bloqueado. Las migraciones nuevas (0012+) se ESCRIBEN como deliverable; su aplicación a la nube queda para `db push` manual del usuario.

## Tandas

### Tanda 1 — seguridad + corrupción (medios)
- #1 `ingest/robots.ts` — gatear fetch robots.txt con `assertAllowedUrl`
- #9 `app/components/provenance-badge.tsx` — validar protocolo https en href + CHECK DB
- #5 `agenda/parse-camara-citaciones.ts:26` — endurecer `BOLETIN_RE`
- #6 `agenda/parse-camara-citaciones.ts:69` — `parseFechaEsCl` → null en vez de texto crudo
- #24 `agenda/parse-camara-citaciones.ts:66-79` — validar día-vs-mes
- #4 `tramitacion/fecha.ts:45-47` — `Date.UTC` en `toIso`

### Tanda 2 — atomicidad/idempotencia
- #7 `fichas/pipeline.ts:164-166` — invertir orden embedding/ficha
- #3 `adjudication/revisor-cli.ts` — RPC transaccional `resolver_identidad` (migración + caller)
- #2 `identity/writer-supabase.ts` — excluir `estado` del update-on-conflict
- #19 `adjudication/writer-revision.ts` + migración — índice único parcial `WHERE parlamentario_id IS NULL`
- #42 migración + `fichas/pipeline.ts` — estado `'error'` en `proyecto_ficha`
- #23 `tramitacion/ingest-run.ts:258` — try/catch en upserts
- #40 `ingest-worker/worker.ts:199` — `else throw` en TOCTOU
- #41 `ingest-worker/worker.ts:329` — no-ACK de TypeError → DLQ

### Tanda 3 — UX/observabilidad
- #8 `app/components/proyectos-similares.tsx` — try/catch + estado vacío
- #34 `app/app/proyecto/[boletin]/page.tsx` — `.maybeSingle()` + chequeo error
- #13 `ingest/drift.ts` — log en catch
- #20 `tramitacion/connector-camara.ts` — log fatales
- #30 `fichas/texto-fuente.ts` — enriquecer mensaje de error
- #28 `agenda/parse-camara-citaciones.ts:123` — off-by-one Forma B
- #43 migración + `agenda/writer-supabase.ts` — clave `citacion_invitado` con `calidad`

### Tanda 4 — higiene/DRY/defense-in-depth
- #10 core/parlamentario.ts, #11 core/nombre.ts, #12/#18 adjudication/pipeline.ts,
  #14/#15 llm/gemini-embeddings.ts, #16/#22 período compartido, #17 identity/seed-cli.ts,
  #21 tramitacion/fecha.ts, #25/#26 agenda/ingest-cli.ts, #27 agenda/connector-senado.ts,
  #29 fichas/golden-set.ts, #31 fichas/writer-supabase.ts, #32/#36 app/buscar/page.tsx,
  #33 app/proyecto/page.tsx, #35 app/lib/buscar.ts, #37/#38/#39 migraciones hygiene.
