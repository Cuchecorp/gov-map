# Phase 10: VOTE — Voto individual por parlamentario en la ficha - Context

**Gathered:** 2026-06-19
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous)

<domain>
## Phase Boundary

El ciudadano ve, en la ficha del parlamentario, cómo vota cada uno — lista de votos, asistencia, voto por tema y una métrica de rebeldías — con la guarda de identidad aplicada y provenance por fila. Entrega: (1) conector de producción `@obs/votos` que enriquece el modelo `voto`/`votacion` existente (NO forka) cruzando por `DIPID` → `id_diputado_camara` sin LLM; (2) la PRIMERA página `/parlamentario/[id]` con su sección de votos. El spike de Phase 8 ya CONFIRMÓ la fuente (opendata.camara.cl entrega el voto individual; mapeo DIPID 100%). NO construye INT/MONEY/NET.

</domain>

<decisions>
## Implementation Decisions

### VOTE en ficha + conector
- **Página nueva `/parlamentario/[id]`:** crear la primera ficha del parlamentario, con sección de votos. INT (Phase 11/12) y MONEY (14-16) agregan secciones después. Reusa VERBATIM el design system cívico de v1.0 (ProvenanceBadge, IdentityMarker, CamaraChip, tokens `--camara`/`--senado`/`--provenance`/`--identity-warn`).
- **Conector `@obs/votos` de producción:** promueve el spike de Phase 8 (`packages/votos/spike` → `packages/votos/src`). Reusa `@obs/ingest` en el orden LOCKED (assertAllowedUrl → robots → rateLimiter.wait → fetcher.get), reusa los parsers de v1.0 (`parseCamaraVotoDetalle`) y `reconciliarVotosCamara`. Cruce determinista por `DIPID` → `id_diputado_camara`, sin LLM, provenance por fila. Enriquece `voto`/`votacion` (modelo 0008/0009), NO crea modelo nuevo. Writer idempotente por clave natural. Usa el invariante tipado `EnlaceConfirmado` de Phase 9 para fijar el FK.
- **Layout de votos:** agrupada por votación/fecha, paginada; cada fila = opción (A favor/En contra/Abstención/Pareo/Ausente) + boletín enlazado a `/proyecto/[boletin]` + ProvenanceBadge. Reusa el patrón voto-a-voto de la ficha de proyecto v1.0.
- **Voto × tema:** faceta/filtro por materia reusando los embeddings/materia de v1.0; vista de lista. SIN score, SIN lenguaje de afinidad ("vota alineado con X" prohibido).
- **Rebeldías:** conteo bruto + lista de esas votaciones; etiqueta neutra ("votó distinto a su bancada N veces"); SIN juicio ni interpretación. Requiere conocer la bancada/partido del parlamentario (ya en la maestra) y el voto mayoritario de su bancada por votación.
- **Tres estados honestos por fila:** (a) enlazado-confirmado → link al parlamentario/voto (estado_vinculo='confirmado'); (b) presente-no-verificado → mención cruda + IdentityMarker, nunca link; (c) no-ingestado → vacío honesto explícito. Un vacío NUNCA se lee como "limpio/sin votos".

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `packages/votos/spike/` (Phase 8) — parsers/flujo ya validados LIVE; promover a `src/`.
- v1.0 `@obs/tramitacion`: `parseCamaraVotoDetalle`, `reconciliarVotosCamara`, `CamaraConnector`, modelo `voto`/`votacion` (migración 0008/0009), writer idempotente.
- Phase 9 `@obs/identity`: `EnlaceConfirmado` + `confirmar()` factory (el FK del voto YA se tipa branded).
- v1.0 frontend: ficha `/proyecto/[boletin]` (Server Components, anon, RLS public-read), design system (ProvenanceBadge, IdentityMarker, VotoRow, CamaraChip), barra/timeline CSS puro.
- Maestra `parlamentario` (partido/bancada para rebeldías; id_diputado_camara).
- Embeddings/materia de v1.0 (`@obs/fichas`, RPC) para voto×tema.

### Established Patterns
- Server Components leen Supabase con anon key server-only; RLS public-read EXPLÍCITO en tablas públicas.
- Conectores reusan `@obs/ingest` (NO BaseConnector.run para flujos acotados); writer idempotente por clave natural; corrida LIVE acotada.
- Guarda de identidad UI (TRAM-06): link SOLO si estado_vinculo='confirmado'.

### Integration Points
- Nueva ruta `app/parlamentario/[id]`.
- Enriquecimiento del voto: el voto de Cámara ya cruza por DIPID en v1.0; este conector amplía cobertura (más votaciones) manteniendo el cruce.
- Posible migración menor si falta un índice por parlamentario_id para la query de la ficha (verificar; reusa 0008/0009).

</code_context>

<specifics>
## Specific Ideas

- Reusar el spike de Phase 8 verbatim donde se pueda; no reescribir parsers ya validados LIVE.
- Voto×tema y rebeldías son DATOS observables: cero lenguaje causal o de afinidad (riesgo existencial #2).
- El conector LIVE puede correr acotado (legislatura vigente); si el entorno no permite la corrida LIVE completa, degradar a una corrida acotada + documentar, sin fabricar votos.

</specifics>

<deferred>
## Deferred Ideas

- Secciones INT (lobby/patrimonio) y MONEY de la ficha → Phases 11/12/14-16.
- Grafo NET → Phase 18.
- Backfill histórico masivo de todas las legislaturas → follow-up operativo (corrida LIVE grande vía GitHub Actions).

</deferred>
