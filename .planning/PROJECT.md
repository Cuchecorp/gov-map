# Observatorio del Congreso 360

## What This Is

Plataforma web ciudadana para consultar y cruzar datos públicos del Congreso de Chile, con dos frentes de igual peso: (1) **seguimiento de proyectos de ley** —en qué etapa está cada proyecto, cómo se ha votado, proyectos similares, búsqueda semántica por idea matriz y cuerpos legales— y (2) **análisis de parlamentarios 360** —qué proyectos presentan, cómo votan, con quién se reúnen (lobby), qué declaran en patrimonio e intereses, financiamiento y contratos del Estado que los rodean. Dirigida a público general y prensa, con trazabilidad a la fuente como principio rector.

## Core Value

La ciudadanía puede responder, sobre cualquier proyecto de ley o parlamentario, "qué pasó, cuándo y según qué fuente" — cada dato mostrado lleva fuente, fecha y enlace original, sin afirmar nunca intención ni causalidad.

## Requirements

### Validated

(None yet — ship to validate)

### Active

<!-- Milestone 1: Frente "proyectos" completo + fundaciones de identidad. Frente "parlamentarios" (P3-P6) = milestones siguientes. -->

**Fundaciones (Fase 0)**
- [ ] Framework común de conectores: rate-limit 2–3s, caché diaria, User-Agent identificado, validación de esquema, snapshots versionados
- [ ] Object storage (Cloudflare R2) para todo el crudo (XML/JSON/HTML); Postgres solo modelo normalizado + vectores
- [ ] Interfaces enchufables `LLMProvider` y `EmbeddingProvider` (modelo por configuración, swappable)
- [ ] Tabla maestra `Parlamentario` sembrada (Cámara + Senado vía `senadores_vigentes.php`), con reconciliación de identidad y revisión humana
- [ ] Pipeline de reconciliación de identidad (atajo determinista → candidatos → adjudicación LLM → compuerta de validación → confirmación humana → golden set → auditoría)

**P2 — Tramitación**
- [ ] Conector Cámara (WS JSON `doGet.asmx`) y Senado (`wspublico` XML)
- [ ] Modelo `Proyecto` (clave boletín) + `Votacion`; timeline por boletín cruzando ambas cámaras
- [ ] Citaciones: Cámara (`citaciones_semana.aspx`) y Senado (portal Next.js `__NEXT_DATA__`)
- [ ] Tabla semanal de sala (`getTablaHTML`/`getSesiones`)
- [ ] Frontend: ficha de proyecto con timeline, etapas, votaciones e indicador de frescura por fuente

**P1 — Búsqueda semántica + fichas**
- [ ] Descarga de textos íntegros (links Senado + BCN `obtxml`)
- [ ] Extracción de idea matriz y cuerpos legales (parsing + LLM con prompt-cache)
- [ ] Embeddings (Gemini) + indexado en pgvector
- [ ] Buscador en lenguaje natural que devuelve fichas estructuradas con trazabilidad
- [ ] Búsqueda de "proyectos similares" por vecindad semántica

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
| Producto de dos frentes con igual peso (proyectos + parlamentarios) | El usuario lo enfatizó: no es solo parlamentario-céntrico | — Pending |
| Milestone 1 = Fundaciones + P2 Tramitación + P1 Búsqueda semántica | Entrega el frente "proyectos" completo y siembra identidad para el frente parlamentario; respeta regla "no paralelizar todo" | — Pending |
| TypeScript/Deno full para backend/ingesta | Un solo lenguaje, integración nativa con Supabase Edge Functions | — Pending |
| Next.js para frontend | Maduro para fichas + visualizaciones + grafos a futuro | — Pending |
| Supabase + R2 + capa LLM enchufable (Gemini/MiniMax/DeepSeek) | Free tiers cubren el arranque; crudo fuera de Postgres; modelo swappable por config | — Pending |
| Trazabilidad sobre interpretación como regla rectora | Evitar "máquina de sospechas"; defensa jurídica del producto | — Pending |
| Reconciliación de identidad como subsistema crítico (golden set + revisión humana) | Un match equivocado produce afirmación falsa creíble; riesgo existencial #1 | — Pending |

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
*Last updated: 2026-06-17 after initialization*
