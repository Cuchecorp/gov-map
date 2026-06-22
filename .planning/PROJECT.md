# Observatorio del Congreso 360

## What This Is

Plataforma web ciudadana para consultar y cruzar datos públicos del Congreso de Chile, con dos frentes de igual peso: (1) **seguimiento de proyectos de ley** —en qué etapa está cada proyecto, cómo se ha votado, proyectos similares, búsqueda semántica por idea matriz y cuerpos legales— y (2) **análisis de parlamentarios 360** —qué proyectos presentan, cómo votan, con quién se reúnen (lobby), qué declaran en patrimonio e intereses, financiamiento y contratos del Estado que los rodean. Dirigida a público general y prensa, con trazabilidad a la fuente como principio rector.

## Core Value

La ciudadanía puede responder, sobre cualquier proyecto de ley o parlamentario, "qué pasó, cuándo y según qué fuente" — cada dato mostrado lleva fuente, fecha y enlace original, sin afirmar nunca intención ni causalidad.

## Current Milestone: v3.0 Cobertura de datos

**Goal:** Llenar las secciones vacías de la ficha del parlamentario poblando datos REALES en la nube (lobby, patrimonio, votaciones), adjudicando identidad y arreglando provenance — sin tocar el shell ya cerrado, manteniendo la regla rectora (trazabilidad sobre interpretación, nunca causalidad). El shell de producto (frontend v1.0+v2.0) está terminado; la brecha para "ser útil" es DATOS + COBERTURA + ADJUDICACIÓN DE IDENTIDAD, no pantallas.

**Target features:**
- **LOBBY** — Adjudicar identidad de las audiencias `no_confirmado` (pipeline de confirmación por nombre) + ampliar la fuente a `camara.cl/transparencia/ley_de_lobby.aspx` (Cámara/Senado NO están en leylobby.gob.cl) → puebla la sección lobby de TODAS las fichas + las aristas del grafo NET.
- **PATRIMONIO** — Corrida LIVE `@obs/probidad` (InfoProbidad, CC BY 4.0) + write a la nube por parlamentario → puebla la sección patrimonio/intereses.
- **VOTACIONES** — Ingesta masiva `opendata.camara.cl` getVotaciones (+ Senado) → de 2 boletines a cobertura real.
- **PROVENANCE** — Poblar el `origen` real de la maestra ("fuente desconocida" → fuente/fecha/enlace real en el header de la ficha).
- **RUT (IDENT-10)** — Backfill operador de `parlamentario-rut.seed.json` (DV-válido + provenance, NUNCA fabricar) → desbloquea el cruce de contratos MONEY.

**Gates de operador y legales (incluidos como precondición explícita, no como deuda separada):** la data se hace visible solo tras aplicar las migraciones remotas pendientes (0026/0028/0030 por `psql --db-url`, NUNCA `supabase db push` — drift `schema_migrations` ≤0025); los sign-offs legales F13 (MONEY) / F17 (NET) son acción humana que mantiene los gates `MONEY_PUBLIC_ENABLED`/`NET_PUBLIC_ENABLED` en OFF hasta firma.

**Postura con datos sensibles:** minimización + trazabilidad estricta. Solo se muestra lo que la fuente pública ya publica (con fuente/fecha/enlace); RUT y datos de familiares quedan en uso interno para reconciliar identidad. Ley 21.719 (plena vigencia 2026-12-01) → pasada de asesoría legal antes de cualquier exposición pública amplia.

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

### Active

<!-- Milestone activo = v3.0 "cobertura de datos". Requisitos detallados en .planning/REQUIREMENTS.md, fases en .planning/ROADMAP.md. -->

- [ ] **v3.0 — cobertura de datos** (en curso): poblar la nube con datos reales (lobby con identidad adjudicada + fuente camara.cl/transparencia, patrimonio LIVE, votaciones masivas), arreglar provenance de la maestra, backfill RUT operador; aplicar las migraciones remotas pendientes como gate.

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
| v3.0 = milestone de DATOS, no de UI (el shell está cerrado) | Barrido de producción 2026-06-22: las fichas se ven como producto pero las secciones están vacías por falta de datos, no de pantallas | En curso (v3.0) |
| Gates de operador (apply remoto 0026/0028/0030) y legales (F13/F17) son precondición explícita en el roadmap v3.0 | La data solo es visible tras aplicar las migraciones; tratarlos como deuda separada deja el milestone "código verde / pantalla vacía" | En curso (v3.0) |

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
*Last updated: 2026-06-22 — started milestone v3.0 (Cobertura de datos)*
