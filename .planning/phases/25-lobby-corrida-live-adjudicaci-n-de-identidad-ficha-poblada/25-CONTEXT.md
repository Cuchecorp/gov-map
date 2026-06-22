# Phase 25: LOBBY — Corrida LIVE + adjudicación de identidad + ficha poblada - Context

**Gathered:** 2026-06-22
**Status:** Ready for planning
**Mode:** Auto-generated (autonomous — investigación + corrida LIVE inline)

<domain>
## Phase Boundary

Poblar la sección lobby de TODAS las fichas elegibles: ingerir las audiencias de camara.cl a
escala (crudo a R2), adjudicar la identidad del sujeto pasivo por el pipeline de confirmación
por nombre (auditado, deterministic-only), y dejar que la ficha de un parlamentario con audiencias
confirmadas muestre sus reuniones reales. Desbloquea las aristas del grafo NET.
</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
- **Match por TOKEN-SET COMPLETO (incl. materno):** la maestra tiene `nombre_normalizado` materno-LESS
  (2 tokens); el lobby trae el nombre COMPLETO (3-4 tokens). Se recomputa el `nombre_normalizado` de
  la maestra al token-set completo SOLO para este cruce → match MÁS ESTRICTO (nunca menos), único en
  (cámara,periodo), fail-closed. NO se toca el núcleo de identidad (matchDeterminista/correrPipeline).
- **deterministic-only (sin LLM):** 0 homónimos entre los 155 diputados actuales (0 colisiones de
  clave completa) → el LLM no aporta; los no-match (ex-diputados/variantes) quedan no_confirmado.
- **WAF bypass por `--html-file`:** el WAF de www.camara.cl bloquea Node fetch (403, TLS-fingerprint)
  pero permite curl → el operador baja el crudo con curl y el runner corre Etapa 1+2 desde él.
</decisions>

<code_context>
## Existing Code Insights

- `@obs/lobby` Phase 24: parser+conector camara. `reconciliarSujeto` (guarda IDENT-12: solo
  determinista mintea FK) + `SupabaseLobbyWriter` (upsert idempotente 0021).
- Blocking (`@obs/adjudication/candidatos`): cámara+periodo DUROS → camara="diputados", periodo="2026-2030".
- R2Store (`@obs/ingest`), maestra del seed `supabase/seeds/parlamentario.seed.json` (186).
</code_context>

<specifics>
## Specific Ideas

- 17.730 audiencias parseadas; deterministic-only confirma 5.106 (136/155 diputados); 0 ambiguas.
- El sujeto pasivo asesor ("X (Asesor(a) H.D. <Diputado>)") cruza por el diputado extraído;
  mención almacenada = RAW.
</specifics>

<deferred>
## Deferred Ideas

- Persistir `Lugar` (migración 0021).
- LLM adjudication para variantes/ex-diputados (no aporta hoy; quedan no_confirmado honestos).
- Encender NET públicamente → Phase 31 (sign-off F17).
</deferred>
