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

## Cross-Milestone Trends

| Métrica | v1.0 | v5.0 |
|---------|------|------|
| Fases | 7 | 11 (F48 diferida) |
| Planes | 25 | 44 |
| Tareas | ~70 | ~66 |
| Deuda técnica al cierre | 6 items (2 código + 4 operacionales), 0 blockers | tech_debt no-bloqueante (VERIFICATION formales, checkpoints sin re-marcar, cleanup menor) + 16 deferred; 0 blockers funcionales |
