---
phase: 06-citaciones-tabla-semanal-de-sala
verified: 2026-06-18T00:00:00Z
status: human_needed
score: 3/3 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Abrir /agenda?semana=2026-W25 en un navegador con el Supabase local activo"
    expected: >
      Citaciones de ambas cámaras agrupadas por día, tabla del Senado (available) + bloque
      de degradación de Cámara; ProvenanceBadge con fecha y enlace fuente en cada citación;
      invitados listados como texto plano (nombre + calidad) sin ningún enlace;
      WeekNav prev/next funcionando; ningún enlace a /parlamentario/ visible.
    why_human: >
      La firma visual del tono cívico (sobrio, no alarmista), la legibilidad de la
      agrupación por día, el funcionamiento interactivo de WeekNav, y el contraste visual
      entre la tabla del Senado y el bloque de degradación de Cámara no pueden verificarse
      programáticamente. El SUMMARY documenta que el render LIVE pasó un gate por curl;
      la comprobación en navegador real cierra el ciclo.
---

# Phase 6: Citaciones + Tabla Semanal de Sala — Verification Report

**Phase Goal:** Un ciudadano puede ver la agenda de comisiones (citaciones) de Cámara y
Senado y la tabla semanal de sala, con conectores que sobreviven a los formatos más frágiles
(WebForms/Cloudflare + portal Next.js).

**Verified:** 2026-06-18T00:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Citaciones Cámara: conector `citaciones_semana.aspx` con header-set anti-Cloudflare + curl transport; cobertura por semana ISO; 403 por semana aislado sin abortar Senado | VERIFIED | `connector-camara.ts`: `CitacionesCamaraConnector.fetchSemana()` con `BROWSER_HEADERS_CAMARA`; `ingest-run.ts`: bucle por semana, `CamaraBloqueadaError` aísla la semana fallida, registra `semanasOmitidas` y continúa; `transport-curl.ts`: subprocess curl con `--compressed -L -sS -w` que extrae status; SUMMARY confirma 134 citaciones cargadas vía parser+writer reales |
| 2 | Tabla semanal de sala: Senado estructurada (`weekly_table` → `sesion_sala` + `sesion_tabla_item`); Cámara degrada honestamente al PDF oficial sin fabricar filas; CR-01 y CR-02 resueltos | VERIFIED | `ingest-run.ts` §3: `parseSenadoTabla` → `upsertSesiones`; §4: `fetchPdfTabla()` retorna URL canónica, nunca llama a `upsertSesiones` para Cámara; `sala-table-section.tsx`: `mode="degraded"` recibe `camaraPdfUrl: string` (no hardcodeado); `page.tsx`: pasa `CAMARA_TABLA_PDF_URL` importado del mismo módulo que el conector; bloque degraded es Cámara-scoped y se renderiza siempre junto a, no en lugar de, la tabla del Senado (CR-02 resuelto: copy dice "Cámara: tabla no disponible como dato estructurado", sin afirmar que el Senado falló) |
| 3 | Vista /agenda navegable por semana con citaciones de ambas cámaras, frescura + enlace fuente; invitados como terceros sin afirmar identidad | VERIFIED | `page.tsx`: `parseISOWeek` tolerante (fallback semana actual, sin redirect, valida `\d{4}-W\d{2}`); query `citacion` con `eq("semana_iso", key)` + embeds `citacion_invitado`/`citacion_punto`; `CitacionCard`: invitados renderizados como `nombre + (calidad)` texto plano, sin import de `IdentityMarker`, sin enlace `/parlamentario/`; `ProvenanceBadge` presente; `WeekNav` prev/next via `<Link>` server-side; migración `0010_agenda.sql`: RLS `for select to anon using (true)` + `grant select … to anon` en las 5 tablas; LIVE ingest: 134 + 27 citaciones, 146 invitados, 4 sesiones Senado |

**Score:** 3/3 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/agenda/src/connector-camara.ts` | Conector Cámara con header-set anti-CF + `fetchPdfTabla()` | VERIFIED | Sustantivo: `CitacionesCamaraConnector`, `CamaraBloqueadaError`, `CAMARA_TABLA_PDF_URL`; wired: usado por `ingest-run.ts` |
| `packages/agenda/src/transport-curl.ts` | Transporte curl subprocess compatible con `Fetcher` | VERIFIED | Sustantivo: `createCurlTransport` con marker `__CURL_HTTP_STATUS__`, `CurlUnavailableError`; wired: `scripts/load-camara-live.mts` lo inyecta como `fetchFn` |
| `packages/agenda/src/ingest-run.ts` | Orquestación completa con 4 pasos (Cámara cit, Senado cit, Senado tabla, Cámara degradación) | VERIFIED | Sustantivo: `runIngest` con los 4 pasos documentados, `RunIngestResult`, aislamiento por semana (WR-04 resuelto), idempotente |
| `supabase/migrations/0010_agenda.sql` | 5 tablas con RLS public-read anon; sin `parlamentario_id` en `citacion_invitado` | VERIFIED | 5 tablas creadas, `enable row level security` + policy `for select to anon using (true)` + `grant select` en todas; `citacion_invitado` solo tiene `nombre` y `calidad` (sin FK a parlamentario) |
| `app/app/agenda/page.tsx` | Ruta /agenda Server Component, semana navegable, citaciones de ambas cámaras, tabla de sala | VERIFIED | Sustantivo: `AgendaPage` async, `searchParams: Promise<…>`, `CitacionesSection` + `SalaTableServer`, ambas en `<Suspense>`; wired: lee Supabase anon vía `createServerSupabase()` |
| `app/components/citacion-card.tsx` | CitacionCard con invitados como texto crudo, sin IdentityMarker | VERIFIED | Invitados: `{inv.nombre}{inv.calidad && <span>({inv.calidad})</span>}` — texto plano; sin import de IdentityMarker; sin enlace `/parlamentario/` |
| `app/components/sala-table-section.tsx` | SalaTableSection mode=available (tabla Senado) + mode=degraded (PDF Cámara, Cámara-scoped) | VERIFIED | `mode="available"`: tabla `<table>` con boletín link; `mode="degraded"`: `CamaraDegradedState` recibe `camaraPdfUrl: string`, copy Cámara-scoped, sin "próximamente", sin estilo destructive |
| `app/lib/week-utils.ts` | `parseISOWeek` tolerante, `getWeekBounds`, `prevISOWeek`/`nextISOWeek`, `formatWeekLabel` | VERIFIED (existencia confirmada; SUMMARY: 15 tests de bordes ISO verdes) |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `ingest-run.ts` | `connector-camara.ts` | `opts.conectorCamara.fetchSemana()` + `fetchPdfTabla()` | WIRED | Importa `CamaraBloqueadaError`, `CAMARA_TABLA_PDF_URL`; usa los métodos en §1 y §4 |
| `ingest-run.ts` | `connector-senado.ts` | `opts.conectorSenado.fetchCitaciones()` + `fetchTablaSala()` | WIRED | Pasos §2 y §3 del `runIngest` |
| `transport-curl.ts` | `connector-camara.ts` | inyección como `fetchFn` en `scripts/load-camara-live.mts` | WIRED | El transport no modifica el conector; se inyecta por configuración |
| `page.tsx` → Supabase | `citacion` + embeds | `createServerSupabase().from("citacion").select("*, citacion_invitado(*), citacion_punto(*)")` | WIRED | Query parametrizada con `.eq("semana_iso", key)`; data fluye a `CitacionCard` |
| `page.tsx` → Supabase | `sesion_sala` + `sesion_tabla_item` | `createServerSupabase().from("sesion_sala").select("*, sesion_tabla_item(*)")` con rango semi-abierto | WIRED | Datos fluyen a `SalaTableSection mode="available"` |
| `page.tsx` | `sala-table-section.tsx` | `<SalaTableSection mode="degraded" camaraPdfUrl={CAMARA_TABLA_PDF_URL} />` | WIRED | URL canónica importada de `agenda-types.ts` (re-exporta desde el conector); no hardcodeada en el componente (CR-01 resuelto) |
| `citacion_invitado` schema | CitacionCard render | sin FK a parlamentario; render como texto plano | WIRED | La guarda de identidad existe en ambas capas: schema (sin `parlamentario_id`) y UI (sin IdentityMarker) |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `CitacionesSection` | `citaciones: CitacionRow[]` | `sb.from("citacion").select(…).eq("semana_iso", key)` | Sí — DB query parametrizada; LIVE ingest cargó 134+27 filas reales | FLOWING |
| `SalaTableServer` (available) | `sesiones: SesionSalaRow[]` | `sb.from("sesion_sala").select("*, sesion_tabla_item(*)")` + rango fecha | Sí — DB query; LIVE: 4 sesiones / 7 ítems Senado | FLOWING |
| `SalaTableSection mode="degraded"` | `camaraPdfUrl` | `CAMARA_TABLA_PDF_URL` constante importada de `agenda-types.ts` (re-export del conector) | Sí — URL canónica real de Cámara; no fabricada | FLOWING |
| `CitacionCard` invitados | `invitados: CitacionInvitado[]` | `citacion_invitado(*)` embed en la query de citaciones | Sí — 146 invitados reales cargados desde Cámara | FLOWING |

---

### Requirements Coverage

| Requirement | Description | Status | Evidence |
|-------------|-------------|--------|---------|
| TRAM-07 | Sistema ingesta y muestra citaciones de comisiones de Cámara (`citaciones_semana.aspx`) y Senado (portal Next.js, autodetección `buildId`) | SATISFIED | Conector Cámara (header-set CF + curl transport); conector Senado (`commissions_citations` API); `runIngest` orquesta ambas; `/agenda` las muestra; LIVE: 134+27 citaciones |
| TRAM-08 | Un usuario puede ver la tabla semanal de sala (orden del día) | SATISFIED (partial-by-design para Cámara) | Senado: `sesion_sala`+`sesion_tabla_item` estructurada, renderizada en `SalaTableSection mode="available"`; Cámara: degradación honesta al PDF oficial (`verDoc.aspx?prmTipo=TABLASEMANAL`) — la ausencia de fuente estructurada está documentada y es la degradación correcta, no un gap |

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| Ninguno | — | No se encontraron marcadores TBD/FIXME/XXX sin referencia en los archivos de la fase | — | — |

No debt markers unreferenced. No hardcoded empty returns in rendering paths. No placeholder copy ("próximamente", "coming soon"). El bloque degraded de Cámara usa copy honesto y explícito.

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| `ingest-run.ts` aísla 403 por semana (WR-04 resuelto) | Lectura de código: bucle `for (const semana of opts.semanas)` con `semanasBloqueadas.push(clave)` y `continue` (sin `break`) | El loop continúa con la siguiente semana; `semanasOmitidas` en el reporte | PASS |
| CR-01: URL del PDF en UI = URL del conector | `CAMARA_TABLA_PDF_URL` en `connector-camara.ts:62-63` vs import en `page.tsx` + `agenda-types.ts` | Mismo valor `"https://www.camara.cl/verDoc.aspx?prmId=0&prmTipo=TABLASEMANAL"` en la cadena | PASS |
| CR-02: bloque degraded Cámara-scoped, no afirma fallo del Senado | `sala-table-section.tsx:140-162` copy + heading | Heading: "Cámara: tabla no disponible como dato estructurado"; no menciona Senado | PASS |
| Invitados sin enlace `/parlamentario/` | grep en `citacion-card.tsx` | 0 matches de `IdentityMarker` o `/parlamentario/` en código funcional | PASS |
| RLS anon en 5 tablas (no en `parlamentario`) | `0010_agenda.sql:97-115` | `alter table … enable row level security` + policy `to anon` + `grant select to anon` en las 5 tablas; `parlamentario` no tocada | PASS |
| Suite tests | SUMMARY 06-04: 55 app + 88 @obs/agenda + typecheck exit 0 + build OK | Documentado; no re-ejecutado en esta verificación (sin runner activo) | SKIP (no runner) |

---

### Human Verification Required

#### 1. Firma visual de /agenda con datos LIVE

**Test:** Con Supabase local activo (datos de la corrida W23–W26 ya cargados), abrir
`http://localhost:3000/agenda?semana=2026-W25` en un navegador.

**Expected:**
- Encabezado "Agenda legislativa" + WeekNav prev/next funcionales (navegar a W24 y W26)
- Citaciones de Cámara y Senado agrupadas por día (lunes a viernes), cada una con
  `CamaraChip`, fecha+horario monoespacio, nombre de comisión, sala, materia y
  `ProvenanceBadge` con fecha de captura y enlace a fuente
- Invitados listados como "Nombre (Calidad)" en texto plano — ningún enlace, ningún
  chip de parlamentario
- Bloque de tabla del Senado (available) con 7 ítems en formato tabla
- Bloque de degradación de Cámara con copy "Cámara: tabla no disponible como dato
  estructurado" y enlace al PDF oficial
- Tono cívico sobrio: sin alertas rojas, sin "próximamente", sin fabricaciones
- Parámetro malformado (`?semana=2026-W99` o `?semana=inyeccion`) → 200 con fallback
  a la semana actual, sin crash

**Why human:** La estética cívica, el contraste visual entre la tabla disponible del Senado
y el bloque degradado de Cámara, la legibilidad de la agrupación por día, y el
funcionamiento interactivo de WeekNav no son verificables programáticamente. El curl
end-to-end del SUMMARY confirma el HTML, pero el ojo humano cierra el ciclo de calidad.

---

### Gaps Summary

No hay gaps bloqueantes. Los dos blockers del code review (CR-01: URL del PDF desconectada;
CR-02: bloque degraded sin scope de Cámara) están verificados como resueltos en el código
actual. Las warnings de la revisión (WR-01..WR-06) fueron marcadas como resueltas en el
REVIEW.md (`status: fixed`), y la resolución de WR-04 (aislamiento por semana) es
observable directamente en `ingest-run.ts`. La única condición pendiente es la firma visual
humana, que es el único bloqueante formal para `status: passed`.

**Items diferidos (no-gaps):**
- Ingesta incremental en producción (pgmq + pg_cron) y resolución del 403 de Cloudflare
  desde el egreso de CI son trabajo posterior (WR-03 resuelto para el local por curl transport;
  la cadencia remota está fuera del alcance de la Fase 6).
- DEBT-01 (Cámara tabla PDF→estructurada vía LLM) está en BACKLOG.md — la degradación
  honesta al PDF es la entrega correcta y completa para TRAM-08.
- IN-04 (smoke test para `fetchVia_NextData` fallback del Senado) deferred en REVIEW.md.
- Push a Supabase remoto + R2 requieren credenciales de operador.

---

_Verified: 2026-06-18T00:00:00Z_
_Verifier: Claude (gsd-verifier)_
