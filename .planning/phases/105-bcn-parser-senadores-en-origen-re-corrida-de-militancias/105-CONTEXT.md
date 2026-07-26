# Phase 105: BCN — Parser senadores en ORIGEN + re-corrida de militancias - Context

**Gathered:** 2026-07-26
**Status:** Ready for planning
**Mode:** Smart-discuss (autónomo) — decisiones operador-LOCKED, auto-aceptadas (sin re-preguntar)

<domain>
## Phase Boundary

Cerrar EN LA FUENTE el defecto "URI-como-partido" que 104-03 tapó display-only. El parser
`@obs/bio` (`parseBcnSenadores`) resuelve `hasPoliticalParty` URI→label legible por mapeo
determinista FAIL-CLOSED; se re-corren las militancias de senadores afectadas a PROD leyendo el
crudo desde R2 (dos-etapas, `--from-r2`, SIN re-molestar a BCN); y se DOCUMENTA con evidencia si
`partidoLegible()` (cinturón display-only de 104-03) se retira o se conserva como defensa en
profundidad.

FUERA de alcance: capa LLM (106+), cualquier cambio a diputados (ya tienen partido legible por
fuente Cámara), adjudicación de identidad, frontend nuevo. La clave de faceta serializada RAW es
POR DISEÑO (104-03) — no se toca.
</domain>

<decisions>
## Implementation Decisions

### Fix del parser (ORIGEN, fail-closed) — LOCKED operador
- El defecto vive en `parseBcnSenadores` (`parse-bcn-senadores.ts:111`): `partyLabel =
  (b.partyLabel?.value ?? b.party?.value ?? "").trim()` — cuando el `rdfs:label` del partido no
  liga (OPTIONAL vacío), cae al **URI crudo** como valor de partido. Ese fallback URI es el bug.
- FIX: cuando `partyLabel` (rdfs:label) esté ausente, resolver la URI vía un **mapeo determinista
  URI→label** (tabla explícita de URIs de partido conocidas de `datos.bcn.cl`). Una URI que NO
  esté en el mapa → **fail-closed**: NO se fabrica partido (no se deriva del slug en el parser),
  se OMITE la militancia y se reporta con causa (`sinMatch`/log con la URI desconocida), nunca
  inventa. "Ante la duda, calidad": mejor omitir que publicar un partido dudoso.
- El mapa se construye con las URIs realmente presentes en el crudo R2 (evidencia real), más las
  que el spike de vocabulario/consulta EN VIVO revele. Determinista y auditable.
- Preferir que la re-corrida traiga el `rdfs:label` correcto (la query ya lo pide vía OPTIONAL);
  el mapa es la red de seguridad para las URIs cuyo recurso BCN no expone label.

### Re-corrida a PROD (dos-etapas) — LOCKED CLAUDE.md
- Re-ejecutar la ingesta de senadores con `--from-r2` sobre el/los envelope(s) BCN ya en R2
  (Etapa 2 relee del crudo, JAMÁS re-scrapea la fuente). Writer idempotente (upsert militancias +
  `actualizarPartidoParlamentario` desde la vigente).
- VERIFICACIÓN post-re-corrida: query a PROD que cuente filas de `militancia` (y `parlamentario.
  partido`) cuyo valor de partido empiece con `http`/`https` (URI) → debe ser **cero** en las
  filas de senadores afectadas. Evidencia registrada en el SUMMARY.
- Write a PROD es acción de datos, no un flag `*_PUBLIC_ENABLED` ni sign-off legal → el agente
  puede ejecutar la re-corrida (a diferencia de RUT/MONEY). Read-only DB checks con
  `set -a; source .env; set +a`, jamás imprimir la URL.

### Decisión sobre `partidoLegible()` (BCN-02) — LOCKED: conservar como defensa en profundidad
- Postura por defecto (operador, "ante la duda calidad"): CONSERVAR `partidoLegible()` como
  cinturón display-only **defensa en profundidad**, documentando que tras el fix en origen ya NO
  debería activarse (el dato llega limpio). Razón: es un helper barato e idempotente que protege
  la superficie ciudadana ante cualquier regresión futura del parser o dato BCN nuevo con URI.
- La decisión se DOCUMENTA en el SUMMARY con la evidencia post-re-corrida (cero URI en PROD). Si
  la evidencia mostrara que el origen basta de forma robusta y el helper añade deuda, se
  re-evalúa retirarlo — pero el default es conservar con justificación escrita.

### Sin regresión — LOCKED
- El cruce por partido (filtros/facetas de `/parlamentarios`) sigue funcionando: la clave de
  agrupación serializada RAW se mantiene (identidad de grupo intacta, jamás fusiona partidos
  distintos). Solo cambia el VALOR almacenado de partido (URI→label) en las filas afectadas.
- Suite verde al cierre: app 1428 + packages + tsc 0 + 9 guards v10.0. Tests nuevos del parser
  cubren: URI conocida→label, URI desconocida→fail-closed (omite+reporta), label presente→verbatim.

### Claude's Discretion
- Forma exacta del mapa URI→label (objeto const vs. helper), ubicación (dentro de
  `parse-bcn-senadores.ts` o módulo hermano), y estructura de los tests. Nombre del reporte de
  URIs desconocidas. Todo dentro del patrón existente del paquete.
</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `packages/bio/src/parse-bcn-senadores.ts` — `parseBcnSenadores()` (locus del fix, línea 111),
  `enlazarSenadoresPorParlid()` (fail-closed por parlid), `aliasDePartido()`.
- `packages/bio/src/run-bio.ts` — orquestador dos-etapas con modo `--from-r2` (replay desde R2 SIN
  red); sección (B) senadores. Writer idempotente `upsertMilitancias` + `actualizarPartidoParlamentario`.
- `packages/bio/src/run-bio-cli.ts` — CLI de la re-corrida (flags incl. `--from-r2`).
- `app/lib/format.ts:153` — `partidoLegible()` (display-only, 6 tests en `format.test.ts:198`);
  enchufado en `partido-chip.tsx`, `militancias-de-parlamentario.tsx`, `parlamentarios-filtro.tsx`.
- Fixtures: `packages/bio/src/__fixtures__` + `parse-bcn-senadores.test.ts`.

### Established Patterns
- FAIL-CLOSED en todo enlace de identidad: sin match único → skip + `sinMatch`, jamás fabrica.
  El mismo idiom aplica al mapeo de partido (URI desconocida → skip + reporte, jamás fabrica).
- Dos-etapas fuente→R2→Supabase LOCKED (CLAUDE.md Conventions). Re-ingesta SIEMPRE desde R2.
- Allowlist estricta: solo partido+fechas+nombre; cero PII (BCN no expone RUT en esta consulta).
- Provenance por fila (origen/fechaCaptura/enlace).

### Integration Points
- Crudo BCN en R2: `bio/envelope/<fecha>/<sha>.json` (`senadoresSparql`). Localizar la(s) key(s)
  vigente(s) para el replay `--from-r2`.
- PROD Supabase ref `bctyygbmqcvizyplktuw`; tabla `militancia` + `parlamentario.partido`.
- Caso testigo conocido: S1344 (Matías Walker) — "partido-democratas-chile" llegaba como URI.
</code_context>

<specifics>
## Specific Ideas

- Caso testigo de regresión: `/parlamentario/S1344` y `/parlamentarios` deben mostrar el partido
  legible SIN que `partidoLegible()` tenga que actuar (el dato ya limpio en origen).
- Query de verificación PROD: contar `militancia` con `partido ~* '^https?://'` → 0 (filtrar
  `not exists (pg_depend deptype='e')` no aplica aquí; es data check simple).
</specifics>

<deferred>
## Deferred Ideas

- Poblar `bio` 1:1 (profesión etc.) — fuera de alcance, es mejora de datos separada.
- Retiro definitivo de `partidoLegible()` — solo si evidencia futura lo justifica; este phase lo
  conserva documentado como cinturón.
</deferred>
