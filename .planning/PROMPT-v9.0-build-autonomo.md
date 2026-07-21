# PROMPT — Corrida autónoma v9.0 "Robustez de productos estrella + seguridad final" (Phases 86–96, TRES PASADAS)

> Pegar en una sesión LIMPIA de Claude Code (repo Observatorio), tras `/clear` — **una pasada por sesión**. El scaffolding ya existe: ROADMAP.md §v9.0 (11 fases 86-96 con success criteria, 27/27 reqs), REQUIREMENTS.md (RETR/RANK/FILT/TRACE/BIO/LOB/CIT/SEC), research v9.0 en `.planning/research/` (STACK/FEATURES/ARCHITECTURE/PITFALLS/SUMMARY — los archivos `-v7` son historia, ignorar). NO re-descubrir; ejecutar.
>
> **Al terminar cada pasada: `/clear` y pegar el prompt de la siguiente.** Al terminar la pasada 3: audit-milestone → complete-milestone v9.0.

---

## PASADA 1 — Búsqueda/PL (pegar tras `/clear`)

```
/gsd-autonomous --from 86 --to 89
```

Contexto rector de la pasada (leer ROADMAP.md §v9.0 + research/SUMMARY.md antes de planificar):

- **EL BUG ESTRELLA**: `/buscar` es SOLO-semántico (`app/lib/buscar.ts` → `match_proyectos`, embeddings de ficha, 84,6% cobertura) → palabras LITERALES del título o un boletín pegado pueden dar "sin resultados". Inaceptable: es el producto estrella.
- **86 gatea 87 (LOCKED)**: primero golden set CONGELADO ≥30 queries (título literal, paráfrasis NL, normas, boletín en TODOS los formatos `14309-04`/`14309`/`14.309-04`, ñ/acentos/topónimos) + medición FTS-solo vs semántico-solo vs RRF. NADA de schema hasta que el algoritmo esté elegido por evidencia. El golden set queda como test de regresión permanente en CI.
- **El fix es 100% Postgres nativo, CERO librerías nuevas**: FTS `spanish` + `unaccent` (envuelto IMMUTABLE para indexar) + `pg_trgm`, tsvector STORED con pesos A título / B idea matriz / C normas, GIN; fusión con pgvector por **RRF sobre RANK** (patrón oficial Supabase, `websearch_to_tsquery` SIEMPRE, jamás `to_tsquery` crudo ni suma ponderada de scores); **boletín short-circuit determinista FUERA del RRF** (siempre #1). Template probado en repo: `0032_agenda_search.sql`. SQL detallado: research/STACK.md.
- **Aguja de todo camino público nuevo**: migración >0044 (cero `grant … to anon`) + RPC security-definer PII-safe acotada + entrada `PUBLIC_RPC_ALLOWLIST` (`lockdown-guard.test.ts`) + `service_role .rpc()`. RPC vieja tras flag hasta que la híbrida domine el golden set.
- **88**: normalizador estado texto-libre→buckets enum (definirlo y testearlo — `proyecto.estado`/`etapa` son texto libre) + island `buscar-filtros.tsx` (contrato FichaRail: el island JAMÁS toca Supabase) que reordena/filtra lo YA obtenido sin re-query (año, mensaje/moción, estado, cámara; partido llega en P2) + counts honestos "de estos N" + ranking mensaje>moción + recencia por reglas declaradas.
- **89**: deep-links de validación por boletín — Senado `?boletin_ini={boletín-completo}` (sin sufijo = lista, no ficha), Cámara `tramitacion.aspx?prmID={ID}&prmBOLETIN=` (**requiere persistir `prmID` en ingesta** — plumbing, no solo UI), BCN `idNorma`; fecha de captura visible + snapshot R2 ("esto decía la fuente ese día"). Validación EMPÍRICA (HTTP 200 + content-match + gate BrowserOS); jamás buildId ni URL de sesión.

## PASADA 2 — Personas/Agenda (pegar tras `/clear`)

```
/gsd-autonomous --from 90 --to 94
```

Contexto rector de la pasada:

- **DECISIÓN RECTORA DEL OPERADOR (2026-07-21, ya registrada en PROJECT.md/ROADMAP.md — NO re-preguntar)**: partido político + bio oficial del cargo electo se muestran **DIRECTO** y se correlacionan en todas las superficies (revierte la retención de `partido` en 0020). Siempre con fuente+fecha ("según fuente al [fecha]"), partido≠comité (Senado), militancia histórica vs actual. La minimización 21.719 sigue PLENA para **terceros/familiares/RUT** (allowlist de campos en el parser; PII cruda solo en R2).
- **90 gatea 91 (LOCKED)**: conector bio dos-etapas fuente→R2→Supabase. Diputados: `WSCamaraDiputados getDiputados` (opendata.congreso.cl, XML por HTTP GET, sin SOAP — trae `Militancia_Actual`/`Militancias_Periodos` + Distrito; `fast-xml-parser` ya en repo). Senadores: SPIKE BCN SPARQL (`datos.bcn.cl`, ontología biografías — MEDIUM, probar en vivo) con degradación honesta a ficha senado.cl. **Membresía de comisiones se ingiere y modela aquí** (hoy NO existe; prerequisito de bio, cross-links y filtros de agenda). Solo identidad `confirmado`/`determinista` (fail-closed LOCKED).
- **91**: ficha con bio oficial (región/distrito, períodos, profesión, comisiones) + partido directo correlacionado (ficha, filtros de /buscar — cierra FILT-01 partido—, cruces) + cross-links factuales (mismo partido/región/comisión, co-autoría F48) — relaciones DECLARADAS, jamás afinidad inferida; linter anti-insinuación cubre lo nuevo.
- **92**: lobby — la materia COMPLETA ya está entera en DB (`lobby_audiencia.materia` verbatim; la falla es presentacional). Audiencia→PL SOLO por mención explícita de boletín (reusa `lobby_en_tramitacion` 0048), leyenda anti-causal, NUNCA regex de keywords/tema. Navegación bidireccional audiencia↔PL↔parlamentario.
- **93 gatea 94 (LOCKED)**: AUDITORÍA de cobertura de citaciones ANTES de tocar UI — qué se scrapea hoy vs qué publica cada fuente (sala+comisiones × Cámara+Senado), N/M declarado. Hallazgos previos A CONFIRMAR midiendo: Senado comisiones forward-only (sin histórico), Cámara sala thin (PDF→DeepSeek). Endpoints candidatos (curl-first, WAF): Senado PHP clásico `?mo=comisiones&ac=citacionesComision` (SIN buildId, más estable que el portal Next.js), Cámara `citaciones_semana.aspx?prmSemana=AAAA-NN` + `getComisiones_Vigentes`. Backfill por dos-etapas/`--from-r2` LOCAL.
- **94**: /agenda POR DÍA (tz **America/Santiago**, nunca UTC para agrupar), sala vs comisiones y Cámara vs Senado distinguidas, filtros periodista (cámara, comisión, rango fechas, boletín mencionado, "esta semana"), canceladas/reagendadas modeladas honestamente, cobertura parcial DECLARADA. Gate BrowserOS "comprensible".

## PASADA 3 — Seguridad (pegar tras `/clear`)

```
/gsd-autonomous --from 95 --to 96
```

Contexto rector de la pasada:

- **Modelo de amenaza real**: repo PÚBLICO + sujetos capaces de hostilidad (parlamentarios) + service_role bypassa RLS → el guard ES el muro. NO es OWASP genérico.
- **95**: re-correr y EXTENDER los guards existentes (lockdown/allowlist, PII-guard, anti-insinuación, pgTAP) sobre TODAS las RPCs/superficies nuevas de P1/P2; toda RPC nueva acotada (LIMIT, `statement_timeout`, cap de `match_count`) contra DoS; allowlist sin drift (toda RPC servida enumerada); mutation self-check — los guards MUERDEN sobre lo nuevo.
- **96**: audit final net-new — scan de secretos sobre TODO el historial git (lo alguna vez commiteado se rota), `.env.example` sin valores reales, errores genéricos, headers verificados, **CSP Report-Only → ENFORCED**; Splinter + grants/RLS sobre la DB VIVA (no solo migraciones), re-derivación del allowlist, pgvector ≥0.8.2 (CVE-2026-3172), `pnpm audit` limpio; re-verificar el golden gate de identidad (la correctitud ES la defensa legal). **B26 (rotación DB password) = checkpoint de OPERADOR** — el agente documenta, NO rota (runbook ya existe: `75-DB-PASSWORD-ROTATION-OPERATOR-NOTE.md`).
- **Al cerrar la pasada 3**: `/gsd:audit-milestone` → `/gsd:complete-milestone v9.0` → cleanup → tag v9.0 → push a Cuchecorp/gov-map. Deuda de operador que quede viva (B26, sign-offs, gates v7.0 de `HANDOFF-v7.0-operator-gates.md`) se documenta como handoff, NO bloquea el cierre.

---

## Directivas comunes a las TRES pasadas (mismas de v6.x/v7/v8, que cerraron completas)

- **Fable es el jefe**: planifica, dirime y controla; delega ejecución a agentes Sonnet o menores. Smart-discuss auto-acepta recomendaciones; las decisiones del operador (partido directo, tres pasadas, ciclo por producto) YA ESTÁN RESUELTAS — no re-preguntar.
- **Ciclo por producto (LOCKED)**: diseño → prueba empírica BrowserOS → rediseño → validación empírica + de seguridad. Los gates BrowserOS de 89 y 94 son criterios de éxito, no opcionales. Si el MCP BrowserOS está caído, pedir al operador levantarlo — no fingir capturas.
- **Autónomo y ordenado**: sin preguntas al operador. Si un checkpoint humano no responde, documentar como handoff con evidencia lista y la corrida CIERRA igual (patrón v7).
- **Gates que un agente JAMÁS cruza**: flags `*_PUBLIC_ENABLED` (MONEY/NET siguen como estén), sign-offs legales, aplicar DDL a PROD sin runbook de operador cuando la fase lo marque checkpoint, imprimir secrets, rotar credenciales.
- **Reglas LOCKED de siempre**: dos-etapas fuente→R2→Supabase (`--from-r2` replay), rate-limit 2-3s + curl-first ante WAF (camara.cl bloquea fetch de Node; backfill masivo LOCAL, jamás ráfagas), identidad fail-closed (name-match nunca mintea FK), anti-insinuación (leyendas, linter verde), migraciones por `PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" --single-transaction -f` (NUNCA `db push`), PostgREST cap 1k (`.order().range()` paginado SIEMPRE).

## Contexto operativo (gotchas ya pagados)

- **Deploy**: build OpenNext en Docker `node:22-slim` (NUNCA alpine ni Windows); robocopy a `C:/Temp/obs-build`; `docker run -w /app` vía PowerShell; wrangler global (OAuth local); pnpm 11 `dangerouslyAllowAllBuilds true` antes del install en contenedor. Runbook: `milestones/v6.0-phases/61-*/61-02-SUMMARY.md`.
- **BrowserOS**: MCP `http://127.0.0.1:9200/mcp`, wrapper `scripts/bros-cli.mjs`; `save_screenshot` en ráfaga tumba el MCP → sleep 8-10s y reabrir página; `evaluate_script` usa `expression`, `click` usa `element`; móvil 390px vía CSS inyectado/iframe same-origin.
- **jsdom no ve layout**: tests validan estructura/gates; la evidencia visual real va por BrowserOS sobre deploy (cascada CSS solo se caza con getComputedStyle en deploy). jsdom rompe `new URL(import.meta.url)` → `import.meta.dirname`.
- **Suite al inicio**: app 991 + packages 1103 verdes + `tsc --noEmit` limpio. Cada plan la deja verde. Guards que muerden: lockdown-guard (PUBLIC_RPC_ALLOWLIST), PII-guard CI, anti-insinuación (201 términos), cero-hex, tipografía.
- **Sitio PROD**: https://observatorio-congreso.thevalis.workers.dev (v8.1 `3563ecc9`). Supabase ref `bctyygbmqcvizyplktuw` (sa-east-1, pooler IPv4).
- **Relación con v7.0**: cero dependencia dura. v7 sigue code-complete con gates de operador abiertos (`HANDOFF-v7.0-operator-gates.md`) — esta corrida NO los toca ni los espera. Las fases 64-75 viven aún en `.planning/phases/` (no archivadas); las fases v9.0 crean sus propios directorios 86+.
