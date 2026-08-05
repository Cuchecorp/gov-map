# Phase 132: NEWS-RSS — Conector RSS dos-etapas LOCKED - Context

**Gathered:** 2026-08-05
**Status:** Ready for planning
**Mode:** Autónomo — gray areas adjudicadas por Fable (régimen v13.0: Fable decide, Sonnet ejecuta, Opus valida). Cada decisión lleva su razón escrita.

<domain>
## Phase Boundary

El RSS de prensa fluye **fuente → R2 crudo content-addressed → Supabase**, cerrando los 4 huecos
de régimen de Is Chile Safe (robots.txt no consultado, cero delay entre feeds, RSS crudo no
guardado, content-addressing incompleto). Al cierre: 5 fuentes operan (4 medios directos + Google
News RSS Search), el pre-filtro léxico legislativo determinista descarta antes de gastar LLM con
conteo observable, y un replay `--from-r2` reproduce la carga completa sin tocar la red.

**Fuera de alcance:** clasificación LLM (135), taxonomía (133), resolver (134), cron (136),
full-text de artículos y vínculo a fichas (137). En 132 NO se llama a ningún LLM.

</domain>

<decisions>
## Implementation Decisions

### Fuentes (NEWS-02)
- **D-01: Los 4 medios directos parten con las 4 URLs PROBADAS de Is Chile Safe** (BioBioChile,
  Cooperativa, LaTercera, LaCuarta — `feeds.py:65-71` verificadas en producción ajena por meses).
  *Razón:* URLs verificadas > URLs supuestas; la cola de outlets legislativos (Ex-Ante, El
  Mostrador, Emol…) entra igual vía Google News `<source>` (40+ medios con 9 feeds en ICS).
  **Research PUEDE sustituir LaCuarta** por un medio de mayor densidad legislativa (Emol / El
  Mostrador / Ex-Ante) **solo si verifica su RSS vivo durante la investigación** (fetch real, no
  suposición). Si no se verifica, queda el set probado. El total queda en 4 — no se amplía.
- **D-02: Google News RSS Search con 3–5 queries legislativas**, builder heredado
  (`hl=es-419&gl=CL&ceid=CL:es-419`, `when:2d` en la query). Vocabulario de queries lo fija el
  plan (candidatos: `"proyecto de ley"`, `Congreso votación`, `boletín Senado|Cámara`,
  `urgencia legislativa`); las queries quedan congeladas en código con test.
  *Razón:* 5 queries fue suficiente en ICS para 40+ outlets; más queries = más carga al host
  sin señal nueva.
- **D-03: El outlet real de un ítem de Google News sale SIEMPRE del tag `<source>`** — jamás del
  título ni de la URL. (Patrón ICS `feeds.py:141-159`.)

### Decoder de URLs de Google News
- **D-04: Solo decoder OFFLINE (base64url).** Prohibido el fallback por POST a `batchexecute`
  (endpoint interno no documentado de Google — contradice el régimen de ingesta respetuosa y es
  frágil por construcción). Si el decode offline falla: se conserva la URL de Google News y se
  marca `url_decodificada=false`. La URL canónica para dedup es la decodificada cuando existe,
  la de Google News cuando no.
  *Razón:* el contrato del sitio exige link a la fuente; un link vía Google News sigue siendo un
  link válido y trazable — no justifica un endpoint hack.

### Pre-filtro léxico legislativo (NEWS-02, SC4)
- **D-05: El MECANISMO de ICS se hereda, el vocabulario se bota** (research doc §2): set
  determinista congelado en código, matching sobre titular+descripción normalizados
  (NFD → ascii → lowercase), cero LLM. Vocabulario legislativo nuevo: `proyecto de ley`,
  `boletín`, `sala`, `comisión`, `votación`, `indicación`, `veto`, `urgencia`, `moción`,
  `mensaje`, `Tribunal Constitucional`, `tramitación`, `promulgación`, `Senado`, `Cámara de
  Diputados`, `diputado/a`, `senador/a`… — lista exacta la fija el plan y queda con test.
- **D-06: El pre-filtro es RECALL-FIRST**: su trabajo es descartar lo obviamente no-legislativo,
  no clasificar. Falso positivo aceptable (lo filtra el clasificador de 135); falso negativo NO
  (esa noticia se pierde para siempre). Ante duda, pasa.
- **D-07: Todo descarte queda REGISTRADO y consultable**: URL vista → ledger en tabla Supabase
  con causa (`prefiltro_lexico`), jamás en el repo (lección ICS §5: `seen.json` de 887 KB
  commiteado es ruido). El conteo de descartes por corrida sale por query (`psql -tA`).

### Estructura del código
- **D-08: Package nuevo `packages/news`** siguiendo el patrón de `packages/tramitacion` /
  `packages/agenda`. El conector **extiende `BaseConnector` de `@obs/ingest`** — el flujo
  invariante cache→robots→rate-limit→fetch→drift→R2→snapshot ya está construido y probado; el
  conector solo implementa los hooks (`endpoints`, `validateShape`, `fingerprint`).
  **Prohibido reimplementar rate-limit/robots/R2 dentro del package news.**
  *Razón:* los 4 huecos de ICS quedan cerrados POR CONSTRUCCIÓN al usar el framework — ningún
  código nuevo puede saltarse el régimen.
- **D-09: Etapa 2 (R2 → Supabase) es un módulo separado del conector** con CLI local
  (`run-news-cli` con flag `--from-r2`, patrón `ingest-cli` de tramitacion). El replay lee
  EXCLUSIVAMENTE de R2 — un test/corrida con red bloqueada (fetch inyectado que lanza) debe
  reproducir la carga completa.
- **D-10: Parser RSS con `fast-xml-parser@5`** (ya convención del stack para XML) — los feeds
  RSS/Atom son XML plano. Validación de forma con zod en la etapa 2.

### Schema Supabase (etapa 2)
- **D-11: Nombres en español, singular** (convención del schema existente: `proyecto`,
  `citacion`). Tablas nuevas de 132: **`noticia`** (ítems que PASAN el pre-filtro: titular,
  outlet, fecha_pub, url original, url canónica, hash, referencia al crudo R2, estado del
  pipeline) y **`noticia_url_vista`** (seen-ledger: hash de url canónica, estado, causa,
  primera_vista — la idempotencia y el conteo de descartes viven acá).
  El detalle exacto de columnas lo fija el plan; estas dos tablas y su reparto de
  responsabilidades son LOCKED.
- **D-12: RLS habilitado deny-all en ambas tablas, cero policy `anon`, cero RPC pública** en
  132. El sitio no lee noticias hasta la 137 ⇒ no hay aguja nueva que pasar. Migración con el
  siguiente número libre por `ls supabase/migrations`, aplicada con
  `PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" --single-transaction -f` (jamás `db push`).

### Dedup en 132
- **D-13: Solo niveles 1-2 de ICS**: URL exacta contra el ledger + canonicalización (strip
  `utm_*` y tracking params). El id del ítem es `sha256(url_canonica)`. Similitud de títulos
  (nivel 3) y clustering de eventos (nivel 5) NO son de esta fase.

### Claude's Discretion (planner/executor)
- Columnas exactas de las tablas, índices, nombres de archivos dentro de `packages/news`.
- Set exacto de keywords del pre-filtro y de queries de Google News (dentro de D-02/D-05),
  congelados con test.
- Manejo de encoding/CDATA en feeds heterogéneos.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Diseño heredado y sus huecos (el insumo rector)
- `.planning/research/v13.0-is-chile-safe-ingesta.md` — QUÉ copiar (contrato anti-alucinación,
  fuentes RSS, pre-filtro, dedup, degradación honesta) y QUÉ NO (los 4 huecos de régimen §7,
  lo desechable §9, gotchas §10). §2 fuentes exactas, §5 dedup y ledger, §11 traducción al
  dominio del Congreso.

### Régimen LOCKED de ingesta
- `CLAUDE.md` § "Ingesta y Cron (regla arquitectónica — LOCKED)" — dos etapas, hash-check antes
  de descargar, rate-limit 2-3 s/host, backfill LOCAL, cron acotado.
- `.planning/ROADMAP.md` § Phase 132 — los 4 Success Criteria literales.
- `.planning/REQUIREMENTS.md` NEWS-01, NEWS-02.

### Framework existente (reusar, no reescribir)
- `packages/ingest/src/base-connector.ts` — Template Method del flujo invariante; hooks que el
  conector news implementa. El host se DERIVA de la URL (WR-01), no se confía en spec.host.
- `packages/ingest/src/r2-store.ts` — `putImmutable` content-addressed
  (`{source}/{resource}/{date}/{sha256}.{ext}`, `If-None-Match: *`, 412=idempotente).
- `packages/ingest/src/robots.ts`, `rate-limiter.ts`, `host-throttle.ts` — RobotsGuard +
  limiter en proceso + `PgHostThrottle` durable (autoridad cross-invocación del 2-3 s/host).
- `packages/ingest/src/cache.ts`, `snapshot.ts`, `snapshot-store-supabase.ts` — caché diaria y
  provenance de snapshots.
- `packages/tramitacion/src/ingest-cli.ts` y `connector-*.ts` — patrón de conector real + CLI
  que la etapa news imita.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `@obs/ingest` completo (ver canonical refs) — los 4 huecos de ICS ya están resueltos ahí:
  RobotsGuard (hueco 1), HostRateLimiter+PgHostThrottle (hueco 2), R2Store content-addressed
  (huecos 3 y 4). La fase es ENSAMBLAJE, no infraestructura nueva.
- `fast-xml-parser@5` ya en el stack (conectores Senado/BCN) — mismo parser para RSS.
- Convención CLI local con `pnpm --filter` (gotcha v8.1: `process.cwd` bajo
  `pnpm --filter exec` — revisar cómo lo resolvieron los CLIs existentes).

### Established Patterns
- Conector = hooks sobre BaseConnector; la política vive UNA vez en el framework.
- Migraciones por psql directo `--single-transaction`, numeradas por `ls supabase/migrations`
  (0080-0083 ya tomadas; `0073`/`0075` escritas y NO aplicadas — JAMÁS editarlas).
- PostgREST capa en 1k ⇒ conteos de verificación por `psql -tA`.
- Tests: vitest; para cada test nuevo, mutar el código y comprobar que cae (régimen v13.0).

### Integration Points
- `source_snapshot` / provenance existente vía `SnapshotWriter` + `SupabaseSnapshotStore`.
- Tablas nuevas `noticia` / `noticia_url_vista` — consumidas después por 134 (dead-letter),
  135 (clasificador, URL vista antes de reject) y 137 (fichas).
- R2: mismo bucket de crudo existente, `source=news` como namespace nuevo.

</code_context>

<specifics>
## Specific Ideas

- El SC1 pide que "los 9 requests en ráfaga de ICS sean imposibles POR CONSTRUCCIÓN" — la
  evidencia correcta es señalar que el conector pasa por `BaseConnector.run()` (que no es
  sobreescribible) + un test que demuestre que el rate-limiter recibe `wait()` por cada request
  a un mismo host. No basta con "se observó delay una vez".
- Riesgo a verificar en research: **robots.txt de `news.google.com`** — verificar si
  `/rss/search` está permitido para nuestro UA ANTES de planificar; si estuviera bloqueado,
  la decisión de fuentes cambia y hay que escalarlo (RobotsGuard lo bloquearía en runtime).
- La corrida real de verificación descarga feeds VIVOS una vez (respetando régimen) y su
  re-corrida inmediata debe salir `[skip]` por hash-check/caché diaria — ese par de corridas es
  la evidencia del SC2.

</specifics>

<deferred>
## Deferred Ideas

- Full-text de artículos a bucket privado (restricción copyright ICS §8) → Phase 137.
- Clustering de eventos / similitud de títulos (nivel 3-5 de dedup ICS) → si alguna vez, spike
  posterior; no está en el roadmap.
- Warm-up anti-WAF Azure (ICS `cead/client.py`) — solo si un medio directo lo exige; no
  preconstruir.
- Cita APA-7 en español (`format_apa` de ICS) → útil recién en 137 (cita pública).

</deferred>

---

*Phase: 132-NEWS-RSS — Conector RSS dos-etapas LOCKED*
*Context gathered: 2026-08-05*
