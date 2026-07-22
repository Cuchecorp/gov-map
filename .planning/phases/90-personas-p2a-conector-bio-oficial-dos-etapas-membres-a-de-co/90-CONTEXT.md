# Phase 90: PERSONAS P2a — Conector bio oficial dos-etapas + membresía de comisiones (GATE de 91) - Context

**Gathered:** 2026-07-22
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous — recommendations auto-accepted per run directive)

<domain>
## Phase Boundary

Poblar la biografía oficial del Congreso por ingesta de dos etapas (fuente→R2→Supabase) con allowlist de campos, y modelar+ingerir la membresía de comisiones (hoy NO existe). Esta fase entrega el DATO y el MODELO; el montaje en ficha, las RPCs públicas de lectura y los cross-links son de Phase 91. Gatea 91: sin columna de bio ni membresía de comisiones, la ficha no puede montar el header.

DECISIÓN RECTORA DEL OPERADOR (2026-07-21, NO re-preguntar): partido político + bio oficial del cargo electo se muestran DIRECTO y se correlacionan en todas las superficies (revierte la retención de `partido` en 0020). Siempre fuente+fecha, partido≠comité (Senado), militancia histórica vs actual. Minimización 21.719 sigue PLENA para terceros/familiares/RUT.

</domain>

<decisions>
## Implementation Decisions

### Fuentes y conectores
- Diputados: `WSCamaraDiputados getDiputados` (opendata.congreso.cl, XML por HTTP GET, sin SOAP) — trae `Militancia_Actual`/`Militancias_Periodos` + Distrito. `fast-xml-parser` ya en repo.
- Senadores: SPIKE BCN SPARQL (`datos.bcn.cl`, ontología biografías — MEDIUM, probar EN VIVO durante research/ejecución) con degradación honesta a ficha senado.cl (cheerio) si el endpoint es inestable.
- Membresía de comisiones: fuente elegida por evidencia curl-first durante research (candidatos: opendata Cámara WSComision/getComisiones + integrantes; Senado portal/PHP clásico). No asumir — probar.
- Package nuevo `packages/bio` (`@obs/bio`), espejo estructural de `packages/lobby` (parse-*.ts + run-*.ts + writer + run-*-cli.ts), reusando `@obs/ingest` (Fetcher, HostRateLimiter, RobotsGuard, R2Store, SnapshotWriter, DailyCache).

### Modelo de datos (migración >0058)
- `parlamentario_bio` (1:1 con parlamentario): profesión + campos vetados de bio oficial, provenance inline (origen, fecha_captura, enlace).
- `parlamentario_militancia`: histórico de partidos (partido, desde, hasta, es_actual), clave natural para upsert idempotente, provenance inline.
- `comision` + `comision_membresia`: modelo de comisiones (nombre, cámara, tipo permanente/especial/unida) y membresía (parlamentario_id FK, cargo si la fuente lo trae), provenance inline.
- `parlamentario.partido` (columna existente) se ACTUALIZA desde `Militancia_Actual` con fecha_captura fresca — es el "partido actual"; el histórico vive en la tabla de militancias.
- RLS deny-by-default en TODAS las tablas nuevas (RLS habilitada, CERO policies, cero `grant … to anon` — regla >0044 del lockdown-guard Block A). Las RPCs públicas de lectura (bio/comisiones) nacen en Phase 91 junto con la extensión del allowlist y el linter.

### Allowlist de campos (minimización 21.719)
- PERMITIDOS en tablas servidas: nombre, militancias (partido + fechas), región/distrito/circunscripción, profesión, períodos del cargo, comisiones, cámara.
- EXCLUIDOS (quedan SOLO en R2 crudo): RUT, familiares/terceros, fecha de nacimiento, email/teléfono personal, cualquier PII no esencial al cargo electo.
- El allowlist se implementa EN EL PARSER (los campos excluidos jamás llegan al modelo tipado que ve el writer) y se prueba con test que muerde (fixture con campos PII → el modelo de salida no los contiene).

### Identidad (fail-closed LOCKED)
- Diputados: match determinista por `id_diputado_camara` (DIPID exacto contra la clave natural ya sembrada en la maestra); sin match → skip + reporte, JAMÁS fabricar enlace ni insertar.
- Senadores: `parlid_senado` si la fuente lo trae; si no, `matchDeterminista` de `@obs/identity` (nombre único en cámara+período); ambigüedad → no escribir (fail-closed).
- NO se crean parlamentarios nuevos: la maestra es autoritativa; entradas de fuente sin correspondencia se reportan en el resumen del run, no se insertan.
- FK tipado con `EnlaceConfirmado` (branded type) donde aplique — nunca string crudo.

### Operación
- CLI `run-bio-cli` espejo de `run-camara-lobby-cli`: flags `--dry-run`, `--from-r2 <path>`, `--xml-file` (bypass WAF), loadEnv BOM-safe.
- Corrida LIVE acotada la ejecuta el AGENTE (bio = 1-3 requests con rate-limit 2-3s, no es backfill masivo); curl-first si el WAF bloquea fetch de Node (gotcha camara.cl conocido).
- Dos etapas SIEMPRE: primero crudo a R2 content-addressed (`bio/<recurso>/<fecha>/<sha256>.xml`, If-None-Match: *), luego parse+write a Supabase leyendo del crudo; `--from-r2` reconstruye sin tocar la fuente.
- Sin cron nuevo en esta fase (diferido; el roster-weekly existente puede absorber bio después).
- Migración a PROD por `PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" --single-transaction -f` (NUNCA `db push`); pgTAP para las tablas nuevas.

### Claude's Discretion
- Forma exacta de columnas/constraints de las 4 tablas nuevas (guiarse por 0021_lobby.sql como plantilla de provenance+claves naturales).
- Detalles del SPIKE BCN SPARQL (query SPARQL concreta, criterio de estabilidad para degradar).
- Si `parlamentario_bio` amerita ser columnas en `parlamentario` en vez de tabla — decidir en plan según cardinalidad real de los campos.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `packages/ingest/src/`: `Fetcher` (UA identificatorio LOCKED, retry 429/5xx), `HostRateLimiter` (2-3s/host), `RobotsGuard`, `R2Store` (content-addressed, If-None-Match: *, aws4fetch SigV4), `SnapshotWriter` (provenance r2_path+content_hash), `DailyCache` — todos exportados en index.ts:9-50.
- `packages/identity/src/deterministic.ts` (`matchDeterminista`: RUT único → nombre_normalizado único en cámara+período → nombre estricto; ambiguo = no_confirmado) + `enlace-confirmado.ts` (branded type, factory `confirmar()`).
- `packages/lobby/src/run-camara-lobby-cli.ts:1-80` — plantilla CLI (ensambla Fetcher+RateLimiter+R2Store+Writer, --dry-run/--from-r2/--html-file).
- `packages/votos/src/run-camara-votos.ts:1-99` — patrón dos-etapas LOCKED (fetch → R2 putImmutable → parse → reconciliar → upsert; --from-r2 replay).
- `fast-xml-parser`: plantillas en `packages/tramitacion/src/parse-camara-*.ts`; `cheerio`: `packages/lobby/src/parse-leylobby.ts:18-60`.
- pgTAP: `supabase/tests/0020_parlamentario_publico.test.sql`, `0021_lobby.test.sql` como plantillas.

### Established Patterns
- Tabla con provenance inline (origen, fecha_captura, enlace NOT NULL) — 0005/0021.
- Claves naturales con índices únicos PARCIALES para upsert idempotente — 0005:44-50.
- RLS deny-by-default: enable RLS, CERO policies — 0005:60-64; lockdown-guard Block A prohíbe `grant … to anon` en migraciones >0044.
- RPC security-definer PII-safe con `set search_path = ''` — 0020:28-51 (ese patrón se usa en 91, no aquí).

### Integration Points
- `parlamentario` (0005): columnas ya existentes `partido`, `region`, `distrito`, `circunscripcion`, `periodo` (singular), `id_diputado_camara`, `parlid_senado`, `estado`.
- GAPS confirmados por scout: NO existe tabla de comisiones ni membresía; NO existe columna `profesion`; NO existe histórico de períodos/militancias; `citacion.comision` (0010:22) es solo texto de agenda.
- 0020_parlamentario_publico.sql retiene `partido` — la REVERSIÓN de esa retención (mostrar directo) es Phase 91; esta fase solo garantiza que el dato esté poblado y fresco.
- `PUBLIC_RPC_ALLOWLIST` en app/lib/lockdown-guard.test.ts:165-183 — NO se toca en 90 (no hay RPC nueva pública).

</code_context>

<specifics>
## Specific Ideas

- El XML de getDiputados es UN solo documento con todos los diputados → 1 request cubre la cámara completa; el crudo entero va a R2 antes de parsear.
- Reporte del run: N actualizados / M sin match (con nombres para diagnóstico en log local, NO persistidos fuera de la maestra).
- El test del allowlist del parser debe MORDEr: fixture XML con campos PII sintéticos (RUT, fecha nacimiento) → asserts de que el modelo de salida no los contiene.

</specifics>

<deferred>
## Deferred Ideas

- Cron de refresco de bio (absorber en roster-weekly) — post-94 o v9.x.
- Fotos/avatares de parlamentarios — fuera de alcance v9.0.
- Histórico de períodos parlamentarios completo multi-legislatura (si la fuente BCN lo trae bien estructurado, evaluar en v10).

</deferred>
