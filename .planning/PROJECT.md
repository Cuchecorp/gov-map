# Observatorio del Congreso 360

## What This Is

Plataforma web ciudadana para consultar y cruzar datos públicos del Congreso de Chile, con dos frentes de igual peso: (1) **seguimiento de proyectos de ley** —en qué etapa está cada proyecto, cómo se ha votado, proyectos similares, búsqueda semántica por idea matriz y cuerpos legales— y (2) **análisis de parlamentarios 360** —qué proyectos presentan, cómo votan, con quién se reúnen (lobby), qué declaran en patrimonio e intereses, financiamiento y contratos del Estado que los rodean. Dirigida a público general y prensa, con trazabilidad a la fuente como principio rector.

## Core Value

La ciudadanía puede responder, sobre cualquier proyecto de ley o parlamentario, "qué pasó, cuándo y según qué fuente" — cada dato mostrado lleva fuente, fecha y enlace original, sin afirmar nunca intención ni causalidad.

## Current State: v5.0 shipped (2026-07-08)

**Shipped v5.0 — De datos a comprensión (legibilidad + análisis).** La ficha de parlamentario pasó de muro plano (~900 KB, 1 columna) a superficie navegable y comprensible: acordeones por carril + resumen/índice above-fold, gráficos descriptivos (patrimonio, votos por trimestre, comparativo de ausencias — nunca causales), cruces nuevos, y un rediseño cognitivo de 3 capas (resumen preatentivo → disclosure progresivo → fuente). Todo EN VIVO en Cloudflare (`74e3ad0f`), principio rector intacto (fuente+fecha+enlace). 11 fases (44-55), integración E2E 3/3 wired, nyquist 11/11. **F48 (autoría/similares) DIFERIDA** al próximo milestone por gap de datos (autores 0/136). Detalle: `milestones/v5.0-*.md`.

## Current Milestone: v6.0 Confiabilidad y comprensión

**Goal:** Que el dato llegue solo y se entienda solo: (1) toda la ingesta programada corre PERFECTA end-to-end (fuentes→R2 crudo content-addressed, R2→Supabase, hash-check, idempotencia, monitoreo de frescura), (2) gov-map estrena identidad visual propia (ícono serio, public-policy, no estilo-IA), y (3) cada visualización se entiende sin explicación externa (cruces entre parlamentarios primero), validada por iteración fina con BrowserOS.

**Target features:**
- **CRON/INGESTA perfecta** — auditoría E2E de los 9 workflows existentes (agenda, leyes, lobby×2, probidad, fichas-backfill, backup, backfill, deploy); cada conector cumple las DOS ETAPAS LOCKED (fuente→R2, R2→Supabase) re-ejecutables; hash-check antes de descargar; crons de novedades L–V verdes con secrets cargados (o fallback local documentado si billing GH sigue bloqueado); monitoreo de frescura por fuente + alerta de staleness.
- **AUTORÍA de proyectos** — ingesta de autores (hoy 0/136) vía R2→Supabase con reconciliación fail-closed → desbloquea F48 (autoría/similares) diferida de v5.
- **IDENTIDAD VISUAL** — ícono/logo de gov-map: simple, serio, interesante, public-policy oriented; explícitamente NO el estilo típico hecho-con-IA (wordmark con fuentes mezcladas). Integración completa: favicon, OG, header, manifest.
- **VISUALIZACIÓN COMPRENSIBLE** — los cruces entre parlamentarios (y demás superficies: ficha, proyecto, /red, charts) se entienden a la primera; loop BrowserOS captura→corrección→re-captura como gate de cada superficie; leyenda "cómo leer esto" donde falte.

**Modo de trabajo (directiva del operador):** Fable (main loop) planifica/dirime/controla; la ejecución se delega a agentes Sonnet o menores. Todo autónomo y ordenado; los gates humanos/legales NUNCA los flipea un agente.

**Fuera de este milestone:** sign-offs legales F13/MONEY + F17/NET + 0042/cruces-flag (firma humana, Phase 39), RUT-01 + ChileCompra/SERVEL (Phase 40), rotar DB password (B26, acción operador).

<!-- v4.0 shipped (De datos a cruces verificables, Phases 33-43): cruces ENCENDIDOS, lockdown API vía Camino A. Detalle abajo (history) y en milestones/. -->

## Current Milestone (history): v4.0 De datos a cruces verificables

**Goal:** Convertir gov-map de un cascarón pulido con datos por carril en una plataforma que **cruza** lobby, financiamiento y votos por parlamentario y sector, manteniendo trazabilidad a la fuente y sin afirmar causalidad. Construye los cimientos de datos e identidad (ingesta programada + resolución de entidades de terceros), luego la capa de cruces (señales factuales, nunca scores de correlación), luego las superficies de ficha — todo **deny-by-default**, sin encender nada sensible sin firma humana. El frontend/shell sigue cerrado; v4 agrega datos, identidad de terceros y la capa derivada de cruces.

**Roadmap diseñado y validado:** `.planning/MILESTONE-v4-cruces.md` (Fases 0–5, con WHAT/WHY/REPO TARGETS/ACCEPTANCE/AUTONOMY por sub-fase; correcciones de validadores Opus aplicadas). Es la fuente de verdad del diseño; el ROADMAP transcribe sus fases a numeración continua (Phases 33+).

**Target features:**
- **INGESTA (Fase 1.1)** — Wire de los conectores ETL ya completos de lobby (Cámara + LeyLobby) y patrimonio/InfoProbidad a workflows de GitHub Actions recurrentes + paso R2 crudo faltante en probidad (vía `source_snapshot`/`SnapshotWriter`). ChileCompra/SERVEL diferidos (brecha RUT-01).
- **IDENTIDAD DE TERCEROS (Fase 1.2)** — Maestra `entidad_tercero` (donantes/proveedores con RUT + gestores/contrapartes de lobby): ID estable, alias, matcher determinista, pipeline de adjudicación con gate humano. Personas jurídicas: nunca LLM (solo RUT exacto, fail-closed). RUT nunca cruza al LLM.
- **CRUCES (Fase 2.1)** — Capa derivada `cruce_senal` (parlamentario↔sector, conteos de evidencia, sin score), materializador security-definer, etiquetado de sector por LLM con eval propio (NO el de extracción literal). Deny-by-default; señales de voto OFF hasta sign-off (17-LEGAL-DOSSIER §2).
- **SUPERFICIES (Fase 3)** — `CrucesSection` en ficha de parlamentario (#6) y proyecto (#8, opcional/gated), siblings anti-insinuación, provenance inline, detrás de `crucesPublicEnabled()` OFF.
- **RUT-01 + DINERO (Fase 5, diferido)** — Cosecha de RUT a la maestra; wire real de ChileCompra; SERVEL manual por elección. Bloqueado por RUT-01 (prerrequisito duro no resuelto) + sign-off legal.

**Gate legal transversal (Fase 4, #10):** ningún flag `*_PUBLIC_ENABLED` (`MONEY`, `NET`, `cruces`) se enciende sin firma humana (Ley 21.719). F13 (MONEY) y F17 (NET) + sign-off de cruces son acción exclusivamente humana. Un agente autónomo NUNCA flipea estos flags. Subsume los gates pendientes de v3.0 (29 RUT, 30 F13, 31 F17).

**Postura con datos sensibles:** minimización + trazabilidad estricta. Solo se muestra lo que la fuente pública ya publica (con fuente/fecha/enlace); RUT y datos de familiares quedan en uso interno para reconciliar identidad. Las señales de cruce son conteos factuales, nunca afirmación de causalidad; linter de texto prohíbe vocabulario insinuante. Ley 21.719 (plena vigencia 2026-12-01) → pasada de asesoría legal antes de cualquier exposición pública amplia.

<!-- v3.0 (Cobertura de datos, Phases 23–32): frente automatable CERRADO y desplegado (lobby 5.106 confirmadas/136 dip, NET 7.394 aristas, patrimonio 1.060/136, votos source-limited). Sus 3 gates humanos pendientes (29 RUT, 30 F13 MONEY, 31 F17 NET) NO se descartan: se SUBSUMEN en v4 (Fase 5 = RUT-01; Fase 4 = F13/F17 + cruces). -->
<!-- v4.0 Fase 0 (Desbloqueo CI — loadEnv CI-safe en CLIs lobby/probidad) ya EJECUTADA: quick task 260623-rtl, commits 1844b2f/399e3e2. = Phase 33 (✅ done). -->

## Current Milestone (history): v3.0 Cobertura de datos

**Goal:** Llenar las secciones vacías de la ficha del parlamentario poblando datos REALES en la nube (lobby, patrimonio, votaciones), adjudicando identidad y arreglando provenance. Frente automatable CERRADO (Phases 23–32, desplegado); gates humanos 29/30/31 subsumidos en v4.

## Requirements

### Validated

<!-- v1.0 MVP — Proyectos de Ley + Fundaciones de Identidad (shipped 2026-06-18). Detalle: .planning/milestones/v1.0-*.md -->

**Fundaciones (FND-01..08) — v1.0**
- ✓ Framework de conectores `@obs/ingest` (rate-limit 2–3s serial por host, robots, UA, caché diaria, snapshots versionados, drift no-bloqueante) — v1.0
- ✓ Crudo inmutable content-addressed en Cloudflare R2 (aws4fetch + If-None-Match); Postgres solo modelo normalizado + vectores — v1.0
- ✓ Orquestación pgmq + pg_cron + Edge Function worker + escape hatch GitHub Actions (todo en SQL versionado) — v1.0
- ✓ Interfaces enchufables `LLMProvider`/`EmbeddingProvider` con salida estructurada validada per-proveedor (zod) y vectores versionados (768-dim Gemini) — v1.0

**Identidad (ID-01..09) — v1.0**
- ✓ Maestra `Parlamentario` sembrada (186 filas reales: 31 senadores + 155 diputados) con respaldo externo (snapshot git autoritativo) — v1.0
- ✓ Pipeline de reconciliación: determinista fail-closed → blocking → adjudicación MiniMax (umbral 0.90) → compuerta → revisión humana → golden set (gate CI ≥0.95) → audit inmutable — v1.0

**Tramitación (TRAM-01..09) — v1.0**
- ✓ Conectores Cámara (JSON/XML) + Senado (`wspublico` XML); modelo común `Proyecto`/`Votacion`/`Voto` por boletín — v1.0
- ✓ Ficha `/proyecto/[boletin]` con timeline cross-cámara, votaciones, frescura por fuente y guarda de identidad en UI (link solo si `confirmado`) — v1.0
- ✓ Citaciones Cámara (HTML anti-Cloudflare) + Senado (API backend) y tabla semanal de sala en `/agenda` — v1.0

**Búsqueda semántica (SEM-01..06) — v1.0**
- ✓ Extracción literal de idea matriz + cuerpos legales (DeepSeek + prompt restrictivo, guardrail #2) con golden gate de fidelidad — v1.0
- ✓ Embeddings asimétricos (Gemini RETRIEVAL_DOCUMENT/QUERY) + pgvector HNSW + RPC `match_proyectos`; búsqueda NL y "proyectos similares" kNN — v1.0
  - ⚠️ Follow-up: persistir `link_mensaje_mocion` end-to-end (idea matriz queda dormida hasta cablearlo) + cargar corpus a la nube. Ver `.planning/v1.0-MILESTONE-AUDIT.md`.

**Legibilidad + análisis (v5.0) — shipped 2026-07-08**
- ✓ Navegación de la ficha: acordeones por carril (LEG-01) + resumen/índice above-fold con chips de 3 estados (LEG-02), comportamiento-preservante (LEG-03) — v5.0
- ✓ Gráficos descriptivos (nunca causales): patrimonio conteo/año (VIZ-01/02/03), "Cuándo votó" por trimestre (VIZ-VOTOS), comparativo de ausencias vs mediana de cámara (VIZ-COMP, RPC PII-safe) — v5.0
- ✓ Cruces en ficha de proyecto (SURF-02) + carril lobby×tramitación + cruces ampliados (CRUCE2, `cruce_senal` 30→781) — v5.0
- ✓ UX: nav global de 5 destinos + breadcrumbs (UX-01), pulido presentacional / `formatNombre` / tarjetas home (UX-02), rediseño cognitivo de 3 capas (UX-03) — v5.0

### Active

- [ ] **v6.0 — confiabilidad y comprensión (activo):** crons/ingesta E2E perfecta (R2 dos-etapas, hash-check, monitoreo de frescura) · autoría de proyectos (desbloquea F48) · ícono/identidad visual gov-map · visualización comprensible con loop BrowserOS. Ver REQUIREMENTS.md.
- [ ] **Pendiente de operador (fuera de v6):** RUT-01 backfill + ChileCompra/SERVEL (Phase 40) · sign-offs F13/MONEY + cierre F17/NET (Phase 39) · rotar DB password (B26).
- [x] **v5.0 — de datos a comprensión** (shipped 2026-07-08): legibilidad + gráficos descriptivos + rediseño cognitivo; F48 diferida por datos.
- [x] **v4.0 — de datos a cruces verificables** (shipped): cruces encendidos, lockdown API vía Camino A.

<!-- v3.0 "cobertura de datos": frente automatable cerrado y desplegado (Phases 23–32). Gates humanos 29/30/31 subsumidos en v4. -->
- [x] **v3.0 — cobertura de datos** (frente automatable completo, gates humanos → v4.0): lobby con identidad adjudicada + fuente camara.cl/transparencia, patrimonio LIVE, votaciones masivas, provenance de la maestra; migraciones remotas aplicadas hasta 0033.

<!-- v2.0 "parlamentarios 360": CÓDIGO completo (conectores, modelos, RPCs, secciones de ficha, gates MONEY/NET). El frontend/shell quedó cerrado y en vivo. Lo que falta NO es código sino DATOS poblados en la nube + adjudicación de identidad → eso es v3.0. Detalle del shell: .planning/HANDOFF-2026-06-22.md -->
- [x] **v2.0 — frente "parlamentarios 360"** (código completo, data pendiente → v3.0): voto individual, lobby + patrimonio (InfoProbidad), dimensión dinero (SERVEL/ChileCompra, gated-OFF), grafo de influencia (gated-OFF).

### Out of Scope

<!-- Diferido a milestones siguientes, no descartado. -->
- **P3 — Cómo vota el Congreso** (cruce voto × parlamentario × tema, visualizaciones) — milestone 2; bloqueado por validar `opendata.camara.cl` (voto individual por diputado)
- **P4 — Consultas + alertas integradas** (lobby + patrimonio) — milestone posterior; requiere definir política de datos del LLM
- **P5 — Dimensión dinero** (SERVEL + ChileCompra por RUT) — milestone posterior; SERVEL es conector artesanal frágil, no API REST
- **P6 — Observatorio de redes** (grafo de influencia) — se habilita cuando el modelo esté poblado
- **Conclusiones de causalidad/intención** — el sistema nunca afirma motivo; solo correlaciones con contexto temporal y fuente (regla rectora)
- **Exposición pública de RUT y datos de familiares** — uso interno para reconciliar identidad; minimización por diseño

## Context

- **Endpoints validados en vivo al 17/06/2026.** Existe un Documento Maestro de Implementación v2.0 con fuentes, endpoints, modelo de datos, estrategia de cómputo y marco legal. Sirve como espec de referencia.
- **Cámara:** WS JSON `doGet.asmx` (preferente, devuelve `{"result":true,"data":[...]}`); HTML para citaciones y búsqueda de proyectos. ⚠️ voto individual por diputado NO está en `doGet.asmx` (`Votos`=null) → vive en `opendata.camara.cl` (sin validar, bloquea P3).
- **Senado:** `tramitacion.senado.cl/wspublico/` (`tramitacion.php?boletin`, `votaciones.php?boletin`, `senadores_vigentes.php` con PARLID); citaciones vía portal Next.js (`buildId` cambia por deploy, autodetectar). `citaciones.php` da 404.
- **BCN/LeyChile:** `bcn.cl/leychile/Consulta/obtxml?opt=7&idNorma={ID}` (XML de la norma). `obtenerinfoley` obsoleto (404).
- **Tres llaves de cruce:** número de **boletín** (proyectos/votaciones/tramitación), **nombre normalizado** del parlamentario (puente más usado), **RUT** (el más fuerte, uso interno).
- **Riesgo existencial #1:** reconciliación de identidad falla en silencio → afirmación falsa y creíble. Por eso la identidad es subsistema crítico con golden set y revisión humana.
- **Riesgo existencial #2:** "máquina de sospechas" — cruces que insinúan causalidad. Mitigado con trazabilidad sobre interpretación.
- **WAF gubernamental** bloquea ráfagas → delay 2–3s obligatorio, no opcional. CORS: todas las llamadas externas desde backend, nunca del navegador.
- Marco legal: Ley 21.719 (plena vigencia 01/12/2026); "fuente de acceso público" no exime cumplimiento; dato derivado del cruce queda protegido; LLM vía API = subencargado (tier sin entrenamiento / DPA). InfoProbidad bajo CC BY 4.0 (atribución visible).
- **Estado v1.0 (shipped 2026-06-18):** monorepo pnpm (Next.js 16 + 7 paquetes `@obs/*` + Supabase, ~70 tareas, suite verde). 7 fases completas (frente "proyectos" + fundaciones de identidad). Cutover a **Supabase nube** ejecutado: migraciones 0001..0011 aplicadas y verificadas en el proyecto nube (ref `bctyygbmqcvizyplktuw`, región sa-east-1; pooler IPv4 — el host directo es IPv6-only). `SUPABASE_DB_URL` en `.env`.
- **Follow-ups operativos post-v1.0 (deuda registrada en `.planning/v1.0-MILESTONE-AUDIT.md`):** (1) 🔴 rotar el DB password de Supabase (expuesto en el transcript del cutover); (2) cargar corpus a la nube (conectores P5/P6 + backfill de fichas con `GEMINI_API_KEY`) — hasta entonces la búsqueda muestra estados vacíos honestos; (3) wiring app→nube (`SUPABASE_URL` + anon/publishable key de nube); (4) persistir `link_mensaje_mocion` para activar idea matriz; (5) desplegar Edge Functions + vault secrets para la orquestación automática; (6) verificaciones humanas/visuales diferidas con datos reales.

## Constraints

- **Tech stack**: TypeScript/Deno full (Edge Functions + conectores) — un solo lenguaje, integración nativa Supabase; reescribir el scraping de referencia (Python) a TS
- **Frontend**: Next.js (React, SSR) — ecosistema maduro para fichas, visualizaciones y, a futuro, grafos
- **Infra datos**: Supabase (Postgres + pgvector + auth/RLS); plan Pro ($25/mes, 8 GB) es la línea base de producción, no el free; tabla maestra de identidades respaldada fuera de Supabase sí o sí
- **Object storage**: Cloudflare R2 para el crudo (el free de Supabase da 500 MB de DB)
- **Cómputo LLM**: Gemini solo embeddings (free); MiniMax M3 (45k calls/sem gratis) para lo crítico/sensible (adjudicación de identidad); DeepSeek V4 Flash para volumen (extracción de fichas, prompt-cache). Capa enchufable; modelo final elegido por benchmark sobre golden set
- **Secrets**: todas las API keys en `.env`
- **Ingesta respetuosa**: rate-limit 2–3s, User-Agent identificatorio, respeto robots.txt, caché diaria
- **Legal**: pasada de asesoría legal antes del lanzamiento público; atribución CC BY 4.0 visible

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Producto de dos frentes con igual peso (proyectos + parlamentarios) | El usuario lo enfatizó: no es solo parlamentario-céntrico | ✓ v1.0 (validado al shippear) |
| Milestone 1 = Fundaciones + P2 Tramitación + P1 Búsqueda semántica | Entrega el frente "proyectos" completo y siembra identidad para el frente parlamentario; respeta regla "no paralelizar todo" | ✓ v1.0 (validado al shippear) |
| TypeScript/Deno full para backend/ingesta | Un solo lenguaje, integración nativa con Supabase Edge Functions | ✓ v1.0 (validado al shippear) |
| Next.js para frontend | Maduro para fichas + visualizaciones + grafos a futuro | ✓ v1.0 (validado al shippear) |
| Supabase + R2 + capa LLM enchufable (Gemini/MiniMax/DeepSeek) | Free tiers cubren el arranque; crudo fuera de Postgres; modelo swappable por config | ✓ v1.0 (validado al shippear) |
| Trazabilidad sobre interpretación como regla rectora | Evitar "máquina de sospechas"; defensa jurídica del producto | ✓ v1.0 (validado al shippear) |
| Reconciliación de identidad como subsistema crítico (golden set + revisión humana) | Un match equivocado produce afirmación falsa creíble; riesgo existencial #1 | ✓ v1.0 (validado al shippear) |
| v3.0 = milestone de DATOS, no de UI (el shell está cerrado) | Barrido de producción 2026-06-22: las fichas se ven como producto pero las secciones están vacías por falta de datos, no de pantallas | ✓ v3.0 (frente automatable cerrado) |
| Gates de operador (apply remoto 0026/0028/0030) y legales (F13/F17) son precondición explícita en el roadmap v3.0 | La data solo es visible tras aplicar las migraciones; tratarlos como deuda separada deja el milestone "código verde / pantalla vacía" | ✓ migraciones hasta 0033 aplicadas; gates legales → v4.0 |
| v4.0 = de datos por carril a CRUCES verificables (lobby × dinero × votos por sector) | El diferenciador del producto es conectar los carriles; pero es el dato de mayor impacto reputacional → se construye deny-by-default, se publica solo tras firma humana | En curso (v4.0) |
| Identidad de terceros (`entidad_tercero`) como prerrequisito de los cruces | `lobby_contraparte.contraparte_id`/`contratista` quedan NULL sin maestra de terceros → los cruces contarían entidades duplicadas/incorrectas; jurídicas solo por RUT exacto (sin LLM) | En curso (v4.0 Fase 1.2) |
| Señales de cruce = conteos factuales, nunca scores de correlación; señales de voto OFF hasta sign-off | Anti-insinuación (riesgo existencial #2); 17-LEGAL-DOSSIER §2 excluye co_votacion del MVP | En curso (v4.0 Fase 2.1) |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-07-08 — milestone v6.0 (Confiabilidad y comprensión) iniciado: ingesta/crons E2E perfecta + autoría (F48) + ícono gov-map + visualización comprensible vía BrowserOS; gates humanos/legales quedan como deuda de operador fuera de v6*
