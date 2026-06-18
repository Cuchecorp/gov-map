---
phase: 05-tramitaci-n-core-ficha-timeline-votaciones
verified: 2026-06-18T18:00:00Z
status: human_needed
score: 5/5 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Abrir /proyecto/14309-04 en el navegador con datos reales"
    expected: "Header muestra título, estado y etapa del proyecto; timeline cross-cámara cronológico con eventos de Cámara y Senado; sección de votaciones con totales SI/NO/Abstención, barra visual y voto-a-voto. ProvenanceBadge visible en cada sección mostrando frescura y enlace a la fuente. Votos de Cámara con confirmado muestran enlace a /parlamentario/[id]; votos de Senado sin confirmación muestran nombre crudo + IdentityMarker. Tono descriptivo en español, sin framing causal."
    why_human: "El render visual (tono, colores cívicos, accesibilidad, legibilidad en pantalla real) y la experiencia de flujo ciudadano no pueden ser verificados por grep o build. La corrección funcional está probada programáticamente (22 tests RTL + pnpm build + curl end-to-end contra Supabase local), pero la firma visual del operador sigue pendiente por diseño de la fase."
  - test: "Verificar que /proyecto/18296-05 también funciona (boletín con solo tramitación, sin votos de Cámara)"
    expected: "Header con estado/etapa del Senado; timeline con los eventos de tramitación; sección de votaciones muestra el mensaje 'Este proyecto no tiene votaciones registradas en la legislatura vigente' o las votaciones del Senado si las hay."
    why_human: "Verifica el caso de borde de un boletín con una sola cámara activa, observable solo en el navegador."
deferred:
  - truth: "Push al Supabase remoto con datos LIVE"
    addressed_in: "Paso de operador post-fase"
    evidence: "05-05-SUMMARY.md: 'Remoto + R2 diferidos por credencial (r2Enabled=false, heredado de Fases 1/3). El Supabase LOCAL tiene los datos reales; el push remoto es paso de operador documentado.'"
  - truth: "R2 object storage para snapshots crudos de la ingesta de tramitación"
    addressed_in: "Paso de operador post-fase"
    evidence: "05-05-SUMMARY.md checkpoint: 'r2Enabled=false'. FND-02/FND-03 (R2) fue implementado en Fase 1; la integración con el CLI de tramitación requiere credenciales del operador."
---

# Phase 5: Tramitación Core — Ficha + Timeline + Votaciones — Verification Report

**Phase Goal:** Un ciudadano puede ver la ficha de cualquier proyecto de ley con su estado actual, el timeline de tramitación cruzando ambas cámaras por boletín y los resultados de votación, cada dato con indicador de frescura y enlace a la fuente — el primer valor ciudadano end-to-end visible.

**Verified:** 2026-06-18T18:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Ingesta XML de Cámara (opendata.camara.cl) y Senado (wspublico) producen datos reales con provenance | VERIFIED | `connector-camara.ts` / `connector-senado.ts` usan `assertAllowedUrl → robots → rateLimiter.wait → fetcher.get` (orden LOCKED de @obs/ingest). Corrida LIVE: 2 proyectos / 10 votaciones / 1213 votos / 115 eventos, 0 errores 403/429/500. |
| 2 | Modelo Proyecto/Votacion/Voto normalizado ambas cámaras; votos atribuidos pasan por reconciliación de identidad con la guarda LOCKED | VERIFIED | `model.ts` define el modelo común. `reconciliar-camara.ts` cruza por DIPID determinista. `reconciliar-senado.ts` solo puebla `parlamentario_id` cuando `tipo==='determinista'`; `probable` → null. 100 tests en @obs/tramitacion; 356 en el workspace. |
| 3 | Ficha `/proyecto/[boletin]` muestra estado/etapa y timeline cross-cámara fusionado | VERIFIED | `app/app/proyecto/[boletin]/page.tsx` lee `proyecto` (.single), `tramitacion_evento` (orden fecha ASC) y `votacion(*, voto(*))` de Supabase con anon key. Componentes `FichaHeader`, `TimelineView`, `VotacionCard` presentes y exportados. `pnpm build` OK; 22 tests RTL verdes. Render end-to-end confirmado por curl (HTTP 200 con header/timeline/votaciones). |
| 4 | Resultados de votación (SI/NO/Abstención + resultado) asociados a un proyecto | VERIFIED | Tablas `votacion` (total_si/total_no/total_abstencion/total_pareo/resultado) + `voto` (voto-a-voto). `VotacionCard` renderiza `VotacionBar` (barra CSS 4 segmentos) + `VotoDetalle` para AMBAS cámaras (WR-05 fixed). Datos reales: 10 votaciones / 1213 votos persistidos. |
| 5 | Cada dato muestra frescura (ProvenanceBadge) + enlace a fuente; copy neutro sin framing causal | VERIFIED | `ProvenanceBadge` con umbral 48h (amber si stale, nunca oculto). Provenance inline (`origen/fecha_captura/enlace`) en las 4 tablas (migración 0008). 3 tests RTL de ProvenanceBadge. Copy en español descriptivo confirmado en review (05-REVIEW.md: "UI copy is descriptive, no causal framing"). |

**Score:** 5/5 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase/migrations/0008_tramitacion.sql` | 4 tablas + RLS public-read + grants anon | VERIFIED | DDL presente: proyecto/votacion/voto/tramitacion_evento + enable RLS + policy `for select to anon using(true)` + `grant select to anon` en las 4 tablas. `parlamentario` intacta (deny-by-default). |
| `supabase/migrations/0009_voto_fuente_voter_id.sql` | Fix CR-02: columna `fuente_voter_id` + unique `(votacion_id, fuente_voter_id)` | VERIFIED | Migración presente: `add column fuente_voter_id text not null`, drop de la unique colisionante `(votacion_id, mencion_nombre)`, nueva unique `(votacion_id, fuente_voter_id)`. Backfill de filas previas por `id::text`. |
| `packages/tramitacion/src/model.ts` | Modelo común Proyecto/Votacion/Voto/TramitacionEvento + zod | VERIFIED | Exportado desde barrel `index.ts`. Incluye `parlamentario_id` nullable + `estado_vinculo` + `fuente_voter_id` (post CR-02). |
| `packages/tramitacion/src/reconciliar-senado.ts` | Guarda LOCKED: solo `determinista` puebla parlamentario_id | VERIFIED | Leído directamente: `case "determinista"` → parlamentario_id poblado; `case "probable"` → `parlamentario_id: null, metodo: "llm", estado_vinculo: "probable"`; `default` → null. Comentario GUARDA LOCKED explícito. |
| `packages/tramitacion/src/reconciliar-camara.ts` | Cruce determinista por DIPID, fail-closed si Id ausente | VERIFIED | 05-03-SUMMARY confirma: Map por `id_diputado_camara`; Id ausente → `parlamentario_id=null, estado_vinculo='no_confirmado'` (fail-closed). WR-02 fixed: indexa SOLO `camara='diputados'` con filtro de periodo. |
| `packages/tramitacion/src/ingest-run.ts` + `ingest-cli.ts` | Orquestación idempotente + CLI con flags validados antes de red/DB | VERIFIED | 05-05-SUMMARY: `runIngest` orquesta descubrir→fetch→parse→reconciliar→timeline→upsert. CLI valida flags antes de red/DB. Corrida LIVE idempotente (mismos conteos en 2ª corrida). |
| `app/app/proyecto/[boletin]/page.tsx` | Server Component con regex guard + 3 lecturas Supabase + Suspense | VERIFIED | Leído directamente: regex `^\d{3,6}(-\d{1,2})?$` + `notFound()` antes de DB. Lecturas: `.from("proyecto")`, `.from("tramitacion_evento")`, `.from("votacion").select("*, voto(*)")`. 3 secciones con `<Suspense>`. |
| `app/components/voto-row.tsx` | Link a /parlamentario SOLO si `estado_vinculo==='confirmado'` && `parlamentario_id != null` | VERIFIED | Leído directamente: `const confirmado = voto.estado_vinculo === 'confirmado' && voto.parlamentario_id != null`. Rama true → `<Link href="/parlamentario/...">`. Rama false → `<span> + <IdentityMarker/>`. Belt-and-suspenders: incluso un `probable` con id no enlaza. |
| `app/components/provenance-badge.tsx` | Frescura + fuente; amber >48h; nunca oculto | VERIFIED | 05-04-SUMMARY + 3 tests RTL de ProvenanceBadge (stale detection). `esStale` con umbral 48h en `lib/format.ts`. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `connector-camara.ts` / `connector-senado.ts` | opendata.camara.cl / tramitacion.senado.cl | `assertAllowedUrl → robots → rateLimiter.wait → fetcher.get` (orden LOCKED @obs/ingest) | WIRED | SSRF allowlist activa. Corrida LIVE sin errores 403/429/500. |
| `ingest-run.ts` | `voto` table | `reconciliarVotosCamara` → `upsertVotos` (DIPID); `reconciliarVotosSenado` → `upsertVotos` (seq) | WIRED | 996 votos Cámara con `parlamentario_id` (determinista); 35 Senado con null + mención cruda. Idempotente. |
| `page.tsx` | Supabase (anon) | `createServerSupabase()` (`server-only`, anon key sin `NEXT_PUBLIC_`) | WIRED | RLS public-read activa en las 4 tablas. `parlamentario.rut` vacío para anon (confirmado por pgTAP + curl live). |
| `voto-row.tsx` | `/parlamentario/[id]` link | `estado_vinculo === 'confirmado' && parlamentario_id != null` | WIRED | Guarda de identidad leída directamente en el código. 6 tests RTL cubren los casos confirmado / probable / no_confirmado. |
| `reconciliar-senado.ts` | `correrPipeline` (Fase 4) | `mencion → normalizarNombre → MencionForanea → correrPipeline(mencion, maestra, provider, writer)` | WIRED | Imports presentes. Guarda LOCKED: `case "probable"` → null (verificado en código fuente). |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|--------------------|--------|
| `page.tsx` → `FichaHeader` | `data` (ProyectoRow) | `sb.from("proyecto").select("*").eq("boletin", boletin).single()` | Sí — 2 proyectos reales (14309-04, 18296-05) con `titulo`/`estado`/`etapa` reales del Senado | FLOWING |
| `page.tsx` → `TimelineView` | `data` (TramitacionEventoRow[]) | `sb.from("tramitacion_evento").select("*").eq("boletin", boletin).order("fecha", asc)` | Sí — 115 eventos reales con `tipo`/`descripcion`/`enlace`/`fecha`/`origen` | FLOWING |
| `page.tsx` → `VotacionCard` | `votaciones` (VotacionRow[]) | `sb.from("votacion").select("*, voto(*)").eq("boletin", boletin)` | Sí — 10 votaciones con 1213 votos reales | FLOWING |

### Behavioral Spot-Checks

Step 7b omitido para este proyecto: los checks requieren servidor corriendo (Next.js dev/start). Los comportamientos clave están cubiertos por: (a) `pnpm build` verde, (b) 22 tests RTL, (c) curl end-to-end documentado en 05-04-SUMMARY (HTTP 200, contenido confirmado, guarda de identidad sin fugas, 404 en paths inválidos).

### Probe Execution

No se declararon probes convencionales (`scripts/*/tests/probe-*.sh`) para esta fase. La "probe" equivalente fue la corrida LIVE acotada documentada en 05-05-SUMMARY y el curl end-to-end de 05-04-SUMMARY; ambas con condiciones objetivas verificadas (conteos > 0, 0 errores HTTP, idempotencia).

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| TRAM-01 | 05-01, 05-02, 05-05 | Ingesta votaciones/sesiones Cámara vía opendata.camara.cl XML | SATISFIED | `connector-camara.ts` + `parseCamaraVotacion`/`parseCamaraVotoDetalle`. Endpoint real `getVotacion_Detalle` (fix de 05-05). Corrida LIVE: 10 votaciones, 1178 votos Cámara. |
| TRAM-02 | 05-01, 05-02, 05-05 | Ingesta tramitación/votaciones Senado vía wspublico XML | SATISFIED | `connector-senado.ts` + `parseSenadoTramitacion`/`parseSenadoVotaciones`. Corrida LIVE: 12 tramites + votaciones Senado. |
| TRAM-03 | 05-01, 05-02 | Modelo Proyecto/Votacion normalizado ambas cámaras, boletín como llave | SATISFIED | `model.ts` + migración 0008. `boletin` PK en `proyecto`; FK en `votacion` y `tramitacion_evento`. |
| TRAM-04 | 05-02, 05-04 | Ficha de proyecto con estado/etapa actual | SATISFIED | `page.tsx` → `FichaHeader` con datos de `proyecto.estado`/`etapa`/`titulo` reales. |
| TRAM-05 | 05-02, 05-04 | Timeline cross-cámara por boletín | SATISFIED | `TimelineView` renderiza `tramitacion_evento` ordenados por fecha. `fusionarTimeline` materializa el orden cross-cámara en la ingesta. |
| TRAM-06 | 05-02, 05-03, 05-04 | Resultados de votación (totales + resultado) + voto-a-voto con guarda de identidad | SATISFIED | `VotacionCard` + `VotacionBar` + `VotoDetalle` (ambas cámaras post WR-05). `VotoRow` guarda LOCKED verificada en código. |
| TRAM-09 | 05-01, 05-04 | Frescura por fuente + enlace a fuente original; copy neutro | SATISFIED | Provenance inline en las 4 tablas (columnas `origen`/`fecha_captura`/`enlace`). `ProvenanceBadge` con umbral 48h. Review confirma copy sin causalidad. |

**Orphaned requirements:** Ninguno. Los 7 requisitos de Fase 5 (TRAM-01 a TRAM-06, TRAM-09) están cubiertos.

### Anti-Patterns Found

Scan de archivos modificados en la fase (reconciliar-senado.ts, voto-row.tsx, page.tsx, 0008/0009 migrations):

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `supabase/migrations/0008_tramitacion.sql:65` | 65 | `unique (votacion_id, mencion_nombre)` — clave colisionante original | INFO | CR-02 corregido en migración 0009 con `fuente_voter_id`. La tabla productiva usa la clave correcta tras aplicar ambas migraciones en orden. |
| `app/app/proyecto/[boletin]/page.tsx:88` | 88 | `voto(*)` selecciona todas las columnas incluyendo `metodo` | INFO | IN-03 (deferred): optimización de payload, no corrección. La guarda de identidad en `VotoRow` es correcta independientemente. |
| `app/app/proyecto/[boletin]/page.tsx:74-80` | 74 | Orden SQL por `fecha` no reproduce el desempate de `fusionarTimeline` | INFO | IN-04 (deferred): cosmético para eventos con la misma fecha. No afecta corrección del dato individual. |

No se encontraron marcadores TBD/FIXME/XXX sin referencia en los archivos verificados.

**Deferred info-level findings (no bloqueantes):**
- IN-01: RLS `using(true)` expone columnas `metodo`/`estado_vinculo` al anon — bajo riesgo, consciente.
- IN-02: `descubrirBoletines` traga errores con `catch {}` — diagnosticabilidad, no corrección.
- IN-03: `voto(*)` selección superset — optimización de payload.
- IN-04: Orden timeline en SQL no reproduce desempate estable — cosmético.

### Critical Issues Fixed (Pre-Verification)

Los dos defectos críticos identificados en el code review (05-REVIEW.md) fueron corregidos antes de esta verificación:

- **CR-01 (Senado votación id collision):** Discriminador estable incorporado al id de votación del Senado (SESION/TIPOVOTACION/ETAPA/QUORUM + índice posicional). Verificado: 14309-04 preserva 7 votaciones distintas (6 Cámara + 1 Senado) en lugar de colapsar.
- **CR-02 (voto key collapsed voters):** Migración 0009 añade `fuente_voter_id` (DIPID en Cámara, `seq:<n>` en Senado) y reemplaza la unique colisionante. Verificado: 1213 votos == 1213 claves distintas; idempotente en 2ª corrida.

### Human Verification Required

#### 1. Firma visual de la ficha ciudadana con datos reales

**Test:** Abrir `/proyecto/14309-04` (y `/proyecto/18296-05`) en el navegador con el Supabase local (o remoto tras el push) corriendo. Navegar las tres secciones: header, timeline y votaciones.

**Expected:**
- Header: título real del proyecto, estado y etapa actuales (del Senado), boletín en monospace, autores.
- Timeline: lista cronológica con eventos de ambas cámaras, cada evento con fecha, tipo (badge de cámara) y descripción; fechas ordenadas correctamente.
- Votaciones: barra CSS de 4 segmentos con porcentajes SI/NO/Abstención/Pareo, totales numéricos, resultado ("Aprobado"/"Rechazado"), expandible a voto-a-voto. Votos de Cámara con `confirmado` muestran enlace; votos del Senado sin confirmación muestran nombre crudo + IdentityMarker ("identidad no verificada").
- ProvenanceBadge visible en cada sección mostrando fuente (ej. "tramitacion.senado.cl") y cuándo se capturó. Amber si tiene >48 h.
- Tono descriptivo en español, sin afirmaciones de causalidad o intención.
- `/proyecto/abc-injection` → 404 (página en español, enlaces de vuelta al Senado/Cámara).

**Why human:** El render visual completo (colores de tokens cívicos, accesibilidad, legibilidad, experiencia de flujo) no puede verificarse por grep o build. El build OK + 22 tests RTL + curl confirman corrección funcional, pero la firma del operador sobre el tono/apariencia en pantalla real es el último gate declarado por la fase (05-04-SUMMARY, Checkpoint Handling).

#### 2. Push al Supabase remoto (paso de operador)

**Test:** Configurar credenciales (`SUPABASE_URL`/`SUPABASE_ANON_KEY`/`SUPABASE_SERVICE_ROLE_KEY` del proyecto remoto), aplicar migraciones 0008 + 0009, re-ejecutar `pnpm --filter @obs/tramitacion ingest -- --boletines 14309-04,18296-05`, verificar que la ficha en producción muestra los mismos datos que la local.

**Expected:** Mismos conteos (2/10/1213/115), 0 errores, provenance por fila, guarda de identidad intacta.

**Why human:** Las credenciales del Supabase remoto no están disponibles en el entorno de ejecución. El push es un paso de operador declarado como diferido por diseño (r2Enabled=false heredado de Fases 1/3).

---

## Gaps Summary

No se encontraron gaps bloqueantes. Las 5 criterios de éxito del roadmap están satisfechos a nivel de código:

1. Ingesta XML real de ambas cámaras con la política de @obs/ingest — VERIFIED en código y en corrida LIVE acotada.
2. Modelo normalizado + reconciliación con guarda LOCKED — VERIFIED en código (`reconciliar-senado.ts` leído directamente, guarda comprobada línea por línea) y en tests (100 en @obs/tramitacion).
3. Ficha con estado/etapa + timeline cross-cámara — VERIFIED por código (`page.tsx` leído, componentes presentes, `pnpm build` OK, curl end-to-end con HTTP 200).
4. Resultados de votación asociados a un proyecto — VERIFIED (tablas, componentes VotacionCard/VotacionBar/VotoDetalle para ambas cámaras, datos LIVE).
5. Frescura + enlace a fuente + copy neutro — VERIFIED (ProvenanceBadge, provenance inline en migración, review confirma copy).

Los 2 Critical del code review (CR-01, CR-02) fueron resueltos con la migración 0009 y re-ingesta verificada. Los 5 Warnings también fueron corregidos. Los 4 Info fueron conscientemente diferidos por el reviewer.

El estado `human_needed` refleja únicamente la firma visual del operador sobre la experiencia ciudadana en pantalla real — gate declarado por la propia fase — y el push al Supabase remoto (bloqueo operativo de credenciales, no de código).

---

_Verified: 2026-06-18T18:00:00Z_
_Verifier: Claude (gsd-verifier)_
