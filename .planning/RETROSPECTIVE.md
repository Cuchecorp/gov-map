# Retrospective — Observatorio del Congreso 360

> Living retrospective. One section per milestone, newest first.

## Milestone: v1.0 — MVP Proyectos de Ley + Fundaciones de Identidad

**Shipped:** 2026-06-18
**Phases:** 7 | **Plans:** 25 | **Tasks:** ~70 | **Commits:** ~226 (1 día de trabajo concentrado)

### What Was Built
Frente "proyectos" completo end-to-end + fundaciones de identidad: framework de ingesta respetuosa (`@obs/ingest`, R2 inmutable, pgmq/cron), capa de providers LLM/embeddings enchufable y fail-closed, maestra de 186 parlamentarios con reconciliación determinista + adjudicación LLM con golden gate, ficha de proyecto con timeline/votaciones/frescura, agenda de citaciones + tabla de sala, y búsqueda semántica (pgvector HNSW + RPC `match_proyectos`) con fichas estructuradas. Esquema completo (migraciones 0001..0011) desplegado a Supabase nube.

### What Worked
- **Guardarraíles existenciales tratados como código testeable:** la guarda de identidad (link solo si `confirmado`) enforced en 3 capas (código/UI/trigger DB); el golden gate de extracción bloquea CI bajo precisión 0.95. Los riesgos #1/#2 quedaron como invariantes verificadas, no como buenas intenciones.
- **Reuso de política una sola vez:** `@obs/ingest` aplica rate-limit/robots/SSRF/R2 en orden LOCKED; P5/P6/P7 lo consumen sin reimplementar. Cero drift de política entre conectores.
- **Slice E2E en RED como diana:** cada fase dejó un test E2E fallando que las olas siguientes volvían verde — walking skeleton disciplinado.
- **Degradación honesta por diseño:** texto ausente → idea_matriz null → embed título+materia; Cámara 403 → degrada al PDF sin fabricar. Nunca se inventa dato.

### What Was Inefficient
- **El cutover a la nube se descubrió mid-execución, no se planificó.** El checkpoint de Fase 7 asumía Supabase local; el operador quería nube. Resolverlo consumió muchas vueltas (credencial DB password vs API key, host IPv6-only → detección de región del pooler). Lección: decidir el plano de despliegue (local vs nube) en `discuss-phase`, no en el checkpoint de ejecución.
- **`link_mensaje_mocion` no se cableó end-to-end:** SEM-01/02 quedan dormidas (idea matriz null) hasta persistir el link. Se detectó en review/integration, no en planning.
- **`buscar.ts` duplicó el embedder de Gemini inline** en vez de importar `@obs/llm` (frontend desacoplado de paquetes Deno) — riesgo de drift de FND-07.

### Patterns Established
- Golden-set-as-CI-gate (precisión ≥ umbral bloquea deploy) reutilizado de identidad (Fase 4) a extracción (Fase 7).
- RLS public-read EXPLÍCITO + GRANT por migración; `parlamentario`/`rut` deny-by-default a anon.
- Server-only data access (anon key sin `NEXT_PUBLIC_`, RSC) — bypass del WAF + keys fuera del cliente.
- Vectores siempre versionados (model/dims/version), L2-normalizados a 768, cosine HNSW.

### Key Lessons
- **El plano de despliegue es una decisión de fase, no de checkpoint.** Un "aplicar migración" puede esconder un cutover de arquitectura.
- **El esquema ≠ los datos:** aplicar 0011 a la nube da tablas vacías; la capacidad (código + esquema + tests) puede estar completa mientras la carga de corpus es un paso operacional aparte. Distinguirlo evita falsos "no funciona".
- **Las API keys nuevas de Supabase (`sb_secret_`) no autentican Postgres** — el DDL necesita DB password o management PAT. No confundir planos de auth.

### Cost Observations
- Model mix: mayormente Opus (planner/executor/researcher) + Sonnet (checkers/verifier).
- Sessions: trabajo concentrado; la sesión de cierre incluyó un cutover a nube no planificado.
- Notable: el patrón slice-E2E-en-RED + reuso de política mantuvo bajo el rework entre fases; el mayor costo evitable fue el descubrimiento tardío del plano de despliegue.

## Milestone: v5.0 — De datos a comprensión (legibilidad + análisis)

**Shipped:** 2026-07-08
**Phases:** 11 (44-55; F48 diferida) | **Plans:** 44

### What Was Built
Ficha de parlamentario de muro plano → navegable: acordeones por carril + resumen/índice above-fold (F45), gráficos descriptivos nunca causales (patrimonio F46, votos por trimestre F47, comparativo de ausencias F49), cruces ampliados + lobby×tramitación (F52, `cruce_senal` 30→781), quick-wins + legibilidad profunda (F50/F51), UX navegada + pulido (F53/F54), y rediseño cognitivo de 3 capas (F55, ficha 28k→~2.1k px). Todo EN VIVO (`74e3ad0f`).

### What Worked
- **Isla-cliente alimentada por transform puro server-side** (patrón F46 reusado verbatim en F47): los charts Recharts cruzan la frontera RSC→cliente sin arrastrar el cliente Supabase; `import type` + agregador puro serializable. Cero fricción de build.
- **Degrade honesto de 3 caminos** (PGRST202→null / error→throw #34 / 0 filas→empty) como patrón compartido: permitió DEPLOY-antes-de-APPLY (código en vivo degradando honesto mientras la RPC no existía), desacoplando el deploy del checkpoint de DDL.
- **pgTAP como única prueba válida del DDL**: los tests vitest/tsc verdes NO prueban que Postgres ejecutó la migración; el pgTAP post-apply atrapó bugs latentes de fixture (`fuente_voter_id` NOT NULL, FK de proyecto padre) que ningún test de app habría visto.
- **Auditoría UX navegada real (BrowserOS)** en F53: journeys × viewports con screenshots destaparon P0 de navegación invisibles a los tests unitarios.

### What Was Inefficient
- **Colisión de IDs de requisito** (VIZ-02/VIZ-03 reusados por F47/F49 para superficies distintas al chart de patrimonio de F46) — deriva de trazabilidad que hubo que reconciliar en el audit. Lección: asignar IDs propios al planear cada superficie nueva.
- **Artefactos de verificación desincronizados**: 4 fases quedaron sin VERIFICATION.md formal y 4 con VALIDATION en estado estrategia — todo el trabajo de test existía y estaba verde, pero los artefactos no se cerraron durante la ejecución. Requirió una pasada retroactiva de `/gsd:validate-phase` ×8 en el cierre.
- **Checkpoints human_needed sin re-marcar**: operador resolvió (deploys, sign-off F55, apply DDL) pero los VERIFICATION.md quedaron en `human_needed`, inflando el audit-open al cierre.
- **Screenshots de evidencia**: dos gotchas recurrentes (harness file:// clipping OOPIF → iframe same-origin; `save_screenshot` escribe al perfil BrowserOS no al repo) costaron reintentos en F54/F55.

### Patterns Established
- Deploy-before-apply con degrade honesto (código en vivo tolera la ausencia de la RPC).
- Isla-cliente-viz + transform puro server-side (F46→F47).
- Screenshot iframe same-origin in-process (rasteriza fullPage completo; evita clipping OOPIF).
- `formatNombre` display-only: passthrough Unicode `\p{Lu}`, keys/hrefs/params SIEMPRE RAW.

### Key Lessons
- Asignar IDs de requisito únicos por superficie al planear; nunca reusar un ID para algo distinto.
- Cerrar VERIFICATION/VALIDATION en la misma fase que el código; el retroactivo es barato pero infla el audit y esconde el estado real.
- El gap del producto ya no es UI sino DATOS (autoría 0/136) + firmas humanas — el próximo milestone es de ingesta/gates, no de features.

### Cost Observations
- Model mix: Opus (planner/executor/verifier/integration-checker) + Sonnet (swarms/checkers).
- Sessions: múltiples; varias corridas autónomas (`/gsd-autonomous`) + cierres de continuación tras session-limit.
- Notable: session-limit mató subagentes en vuelo repetidamente → disciplina de spot-check (commits/archivos) + relanzar con estado explícito.

## Milestone: v6.1 — Entendible y completo

**Shipped:** 2026-07-11
**Phases:** 2 (62-63) | **Plans:** 7

### What Was Built
`/red` reconstruido como ego-network radial determinista (seed + ≤24 vecinos alfabéticos, "Ver N más" honesto, lista móvil <48rem, borde por cámara, leyenda anti-afinidad; F18 LOCKED) validado por lectura fría BrowserOS. Búsqueda completa: corpus 156→3.657 proyectos (legislatura 2022-2026 vía WSLegislativo + backfill LOCAL R2-first), 3.100 embeddings, ideas 60→1.504, techo honesto 565 por causa, cobertura declarada en /buscar + `pnpm freshness`. Deploy final `af1cfcaf`.

### What Worked
- **Backfill como driver por chunks en background + monitor del orquestador**: corridas de horas (ingesta ~15h, pipeline ~18h) corrieron desatendidas con marcadores DONE/STALLED y checkpoints reanudables (R2 hash-check); el orquestador durmió sobre un Monitor en vez de poll.
- **Review→fix→redeploy como ciclo estándar post-ejecución**: 1 CR + 13 WR cazados y corregidos en las dos fases (incl. CR-01 orphan-seed y WR-02 "Busca sobre 0" cacheado 1h) ANTES de la verificación final; el deploy siempre re-corrió tras los fixes para que PROD == master.
- **Lectura fría BrowserOS con getComputedStyle sobre el deploy real** cazó el P1 de cascada CSS (lista móvil filtrada a desktop) que 747 tests jsdom verdes no podían ver.
- **Adelantar trabajo seguro durante esperas**: cron-check, seed y el código de 63-04 avanzaron mientras la ingesta corría — sin tocar el presupuesto rate-limit del host en uso.

### What Was Inefficient
- **PostgREST cap de 1.000 filas mordió DOS veces** (seed Set-diff sin paginar → loop sin avance; ya conocido en otros contextos). Lección aplicada: paginar con `.order().range()` SIEMPRE que se lea una tabla completa.
- **Tope de línea de comandos de Windows (~32KB)** rompió `--boletines` por año completo → driver por chunks de 250 (deviation Rule 3).
- **`state.record-metric`/`add-decision` siguen rotos** (conocido) — fallback manual a STATE.md; ruido menor repetido en cada plan.
- Accomplishments auto-extraídos de MILESTONES.md trajeron headings de deviations como logros — requirió limpieza manual.

### Patterns Established
- Driver bash por chunks reanudable (`run-*-chunks.sh` + logs + marcador DONE/STALLED) para toda corrida LOCAL larga.
- Monitor persistente del orquestador (grep de marcador + detección de log estancado) en vez de esperar dentro del subagente.
- Enumeración histórica: `WSLegislativo.asmx` `retornarMocionesXAnno`/`retornarMensajesXAnno` (el WS de votaciones enumera []).
- Cobertura honesta de 3 piezas: SQL único (`verify-cobertura.sql`) → banner server-only en UI → señal N/M en freshness.

### Key Lessons
- El techo honesto es un feature: 84,6% declarado con causa por boletín vale más que 100% fabricado; los guards LOCKED (RUT, zod) son el mecanismo, no un obstáculo.
- A escala >1k filas, TODO lector de tabla completa vía PostgREST necesita paginación explícita — auditar los existentes antes del próximo backfill.
- La dilución de frescura del cron (80/sem sobre 3.657) es la nueva deuda estructural de datos: planificar rotación round-robin.

### Cost Observations
- Model mix: Opus (researcher/planner/checker/executors/verifier/reviewers) orquestado por Fable en el main loop.
- Sessions: 1 corrida autónoma `--from 62 --to 63` (~3 días de reloj, dominados por las corridas LOCAL de ingesta/pipeline, no por tokens).
- Notable: 2 checkpoints humanos reales (aprobación /red, espera del backfill) — el resto corrió solo.

## Milestone: v9.0 — Robustez de productos estrella + seguridad final

**Shipped:** 2026-07-23
**Phases:** 11 (86-96) | **Plans:** 34 | **Corrida:** 3 pasadas autónomas con /clear entre ellas (2026-07-21 → 2026-07-23, ~3 días)

### What Was Built
Búsqueda híbrida RRF Postgres-nativa que arregla el bug estrella (literal/boletín sin resultados) con golden set 32 como regresión CI; ranking explicable + filtros island; deep-links de validación a la fuente; bio oficial dos-etapas con partido directo y cross-links factuales; lobby audiencia→PL fail-closed; /agenda por día con cobertura declarada; pasada final de seguridad (bounded RPCs 0064, guards Direction-B/crossLinkReader/env-example, gitleaks historial, pnpm audit 14→0, DB viva 0 offenders, CSP enforced ambas superficies).

### What Worked
- Estructura de TRES PASADAS con /clear + prompt por pasada: contexto siempre fresco, cero degradación por longitud; el patrón v7/v8 de "checkpoint sin respuesta = handoff documentado" permitió cerrar sin esperar al operador.
- Gate-antes-de-schema (86 gatea 87; 93 gatea 94): el golden set y la auditoría de cobertura convirtieron decisiones de diseño en evidencia ANTES de escribir migraciones/UI.
- Guards con mutation self-check como contrato: cada extensión de seguridad demuestra que MUERDE; el reviewer cazó un self-check tautológico (WR-02/95) precisamente porque el patrón lo hace visible.
- Orquestador cerrando gates empíricos que el subagente no puede (BrowserOS del deploy real): el ejecutor degradó honesto y el main loop completó la evidencia interactiva.

### What Was Inefficient
- El planner doble-contó RPCs (10 vs 9 en 0064) por sumar firmas re-emitidas — el ejecutor lo reconcilió, pero costó un ciclo de review (WR-01).
- Override brace-expansion ^2.1.2 rompió el build Docker (minimatch ESM) — el fix del audit tuvo que revertirse en pleno deploy (Rule 1); pin de overrides transitivos merece verificación de build antes de commit.
- gitleaks sin config generó 6 FP que había que triar dos veces (research y ejecución) hasta que la allowlist quirúrgica por VALOR los cerró.

### Patterns Established
- "Bounded RPC" como idiom: set statement_timeout como atributo de función (proconfig) + LIMIT + cap interno, probado por pgTAP contra el schema APLICADO.
- Allowlist drift bidireccional: served ⊆ allowlist (con blind-spot de wrappers tipo crossLinkReader) Y allowlist ⊆ definidas; la comparación contra pg_proc VIVO cierra el triángulo repo↔allowlist↔PROD.
- Auditoría DB viva SIEMPRE con filtro pg_depend deptype='e' (sin él, 1201 falsos positivos de pgTAP).
- CSP en dos superficies (next.config.ts + public/_headers) que deben mantenerse ESPEJO.

### Key Lessons
- La plataforma gestionada puede capar el fix de un CVE (pgvector 0.8.0 sin 0.8.2 disponible): medición honesta + clasificación de exposición + handoff > forzar DDL.
- Un "audit limpio" es alcanzable pero es TRABAJO (Next bump + overrides), no una verificación.
- Los self-checks deben ejercitar el detector REAL (regex compartido por constante), no una copia que puede derivar.

### Cost Observations
- Model mix: Fable orquestando; Opus para research/plan/check/verify/review; Sonnet para ejecutores/fixer/pattern-map.
- Sesiones: 3 (una por pasada).
- Notable: pasada 3 completa (2 fases, 5 planes, audit + lifecycle) en una sola sesión de orquestador con ~35 checkpoints de subagente.

## Cross-Milestone Trends

| Métrica | v1.0 | v5.0 | v6.1 |
|---------|------|------|------|
| Fases | 7 | 11 (F48 diferida) | 2 |
| Planes | 25 | 44 | 7 |
| Tareas | ~70 | ~66 | 17 |
| Deuda técnica al cierre | 6 items (2 código + 4 operacionales), 0 blockers | tech_debt no-bloqueante + 16 deferred; 0 blockers funcionales | tech_debt 7 items (UAT rotate, typography island, dilución cron, techo honesto documentado); 0 blockers |
