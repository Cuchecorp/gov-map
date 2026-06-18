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

## Cross-Milestone Trends

| Métrica | v1.0 |
|---------|------|
| Fases | 7 |
| Planes | 25 |
| Tareas | ~70 |
| Deuda técnica al cierre | 6 items (2 código + 4 operacionales), 0 blockers |
