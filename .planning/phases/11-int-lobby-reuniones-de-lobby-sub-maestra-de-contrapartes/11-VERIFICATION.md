---
phase: 11-int-lobby-reuniones-de-lobby-sub-maestra-de-contrapartes
verified: 2026-06-19T00:00:00Z
status: human_needed
score: 4/4 truths verified (code + applied schema); 2 operator items pending
overrides_applied: 0
re_verification:
  previous_status: none
  previous_score: n/a
human_verification:
  - test: "Corrida LIVE de ingesta de congreso con maestra cargada + service key"
    expected: "Filas reales en lobby_audiencia/lobby_contraparte/lobby_ingesta_estado; re-corrida → conteos idénticos (idempotencia)"
    why_human: "Entorno autónomo corrió la ingesta en dry-run in-memory (sin maestra ni service key cargados); la escritura real a Supabase remoto es paso de operador"
  - test: "Selección y validación de la fuente de lobby del CONGRESO"
    expected: "Cámara/Senado NO publican en leylobby.gob.cl (búsqueda devolvió solo 'BCN'); la fuente real es camara.cl/transparencia/ley_de_lobby.aspx (ya allowlisted). Confirmar layout y correr el conector column-agnostic contra esa institución"
    why_human: "Decisión de fuente de producción + validación de layout en vivo detrás del WAF gubernamental; no verificable por grep"
deferred: []
---

# Phase 11: INT Lobby — Reuniones de lobby + sub-maestra de contrapartes — Verification Report

**Phase Goal:** El ciudadano ve las reuniones de lobby de un parlamentario con la contraparte trazable a la fuente; primera sección multi-dataset → fija las reglas anti-insinuación para todo el frente.
**Verified:** 2026-06-19
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth (ROADMAP SC) | Status | Evidence |
|---|--------------------|--------|----------|
| 1 | `@obs/lobby` ingiere audiencias + crea sub-maestra de contrapartes (en este bloque) | ✓ VERIFIED | `packages/lobby/src/{parse-leylobby,reconciliar-sujeto,writer,writer-supabase,connector-leylobby,ingest-run}.ts` existen, son sustantivos y están wired (`index.ts` re-exporta; `ingest-run` orquesta el crawl LOCKED de 2 pasos). Migración 0021 crea `lobby_contraparte` como sub-maestra. Suite offline 25/25 PASS. `lobby_audiencia/lobby_contraparte/lobby_ingesta_estado` existen en el remoto (verificado por `pg_tables`). DB write con maestra = operador. |
| 2 | La ficha muestra reuniones con contraparte como TEXTO CRUDO + provenance, enlace solo si confirmado | ✓ VERIFIED | `app/components/lobby-de-parlamentario.tsx`: `ContraparteCruda` renderiza nombre verbatim + `IdentityMarker` SIEMPRE, NUNCA `<Link>`; `ProvenanceBadge` `ml-auto` obligatorio por fila. RPC no emite `contraparte_id` (verificado en la firma SQL). Wired en `page.tsx` `<section id="lobby">`. 11/11 RTL PASS (incluye assertion negativa: contraparte nunca en un `link`, nunca RUT en el DOM). |
| 3 | Enlace reunión→parlamentario solo determinista/confirmado vía `correrPipeline`; fila en `identidad_audit` | ✓ VERIFIED | `reconciliar-sujeto.ts`: SOLO `res.tipo==="determinista"` llama `confirmar()` (mintea `EnlaceConfirmado` branded, IDENT-12) y puebla el FK; resto → `enlace:null` + `no_confirmado`. `correrPipeline` (pipeline.ts:108/132/176/205) hace `appendAudit` a `identidad_audit` por decisión; reconciliar pasa el writer. Test `reconciliar-sujeto.test.ts` confirma `writer.audits.length===1`, `decision==="confirmado"`. FK nullable + `on delete set null` en 0021. |
| 4 | Anti-insinuación: carril propio, sin componer lobby+voto, sin lenguaje causal/afinidad; 3 estados honestos | ✓ VERIFIED | `<section id="lobby" className="mt-12">` es SIBLING de `#votos` en `page.tsx` (no anidada). Content-gate test (§9.1) verde: regex de términos prohibidos (causalidad/afinidad/score/ranking/flag/juicio) sobre `textContent` + sin enlaces a `/proyecto/` `/parlamentario/` + sin texto de voto. 3 estados honestos textualmente distintos (no-ingestado / ingestado-cero / con-audiencias), `noIngestado` REAL desde la ausencia de fila en `lobby_ingesta_estado`. |

**Score:** 4/4 truths verified (code + applied remote schema). 2 operator/human items pending (DB write de producción + fuente de congreso).

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase/migrations/0021_lobby.sql` | 3 tablas + RPC, RLS correcta | ✓ VERIFIED | Aplicada al remoto; tablas existen; privilegios verificados (abajo) |
| `packages/lobby/src/reconciliar-sujeto.ts` | guarda IDENT-12 determinista-only | ✓ VERIFIED | `confirmar()` solo en determinista; contraparteId siempre null |
| `packages/lobby/src/writer.ts` + `writer-supabase.ts` | upsert idempotente por clave natural | ✓ VERIFIED | onConflict identificador / (identificador,nombre,rol) / parlamentario_id; dedupe pre-lote; service key nunca en errores |
| `packages/lobby/src/ingest-run.ts` | drift BLOQUEANTE + crawl 2 pasos | ✓ VERIFIED | cuarentena (0 filas) ante drift; degradación honesta; nunca fabrica |
| `app/components/lobby-de-parlamentario.tsx` | LobbyView puro + LobbySection SC | ✓ VERIFIED | wired en page.tsx; contraparte cruda + IdentityMarker |
| `app/components/lobby-de-parlamentario.test.tsx` | content-gate + carril aislado | ✓ VERIFIED | 11/11 PASS |

### Key Link Verification (verificado contra el schema APLICADO en remoto sa-east-1)

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `lobby_contraparte` | anon | RLS deny + revoke | ✓ WIRED | `has_table_privilege(anon,...,SELECT)=false`, 0 policies → deny-by-default real (LEGAL-03) |
| `lobby_audiencia` | anon | public-read | ✓ WIRED | anon SELECT=true, 1 policy |
| `lobby_ingesta_estado` | anon | public-read | ✓ WIRED | anon SELECT=true |
| `lobby_de_parlamentario(text)` | anon | RPC security definer | ✓ WIRED | proc existe, anon EXECUTE=true, único canal a la sub-maestra |
| `LobbySection` | RPC | `sb.rpc("lobby_de_parlamentario")` | ✓ WIRED | error real ≠ 0 filas; agruparAudiencias left-join → N contrapartes |
| `reconciliarSujeto` | `identidad_audit` | `correrPipeline`→`appendAudit` | ✓ WIRED | 1 fila audit por decisión (test verde) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Connector suite | `pnpm --filter @obs/lobby test` | 25/25 PASS (4 files) | ✓ PASS |
| UI lobby suite | `pnpm --filter app test -t lobby` | 11/11 PASS (incluye content-gate §9.1) | ✓ PASS |
| Lobby tables exist remote | `pg_tables` query | lobby_audiencia, lobby_contraparte, lobby_ingesta_estado | ✓ PASS |
| RLS/privilege invariants | `has_table_privilege` / `pg_policies` | contraparte deny, audiencia/ingesta public, RPC anon-exec | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| INT-01 | 11-01, 11-02 | Ingesta de audiencias + sub-maestra de contrapartes en este bloque | ✓ SATISFIED | Conector + 0021 + sub-maestra deny-by-default (DB write producción = operador) |
| INT-02 | 11-02, 11-03 | Ficha con contraparte cruda + provenance; enlace solo confirmado | ✓ SATISFIED | LobbyView + RPC sin contraparte_id + IdentityMarker siempre |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| (ninguno) | — | Sin TBD/FIXME/XXX en los archivos de la fase; `contraparte_id` null es por diseño (Pitfall 4), no stub; el no-scrapeo del acta es alcance LOCKED documentado, no stub | — | Sin blocker |

### Threat Flag Assessment (executor flag: default-privileges en PII previa)

**CONFIRMADO como gap real de defensa-en-profundidad (NO bloquea Phase 11).** Verificado contra el remoto:
- `parlamentario`: rls=true, 0 policies, **anon_select=true**
- `pii_contraparte_declaracion`: rls=true, 0 policies, **anon_select=true**

Ambas tablas PII previas dependen SOLO de la RLS para negar filas a anon; el privilegio de tabla heredado por `ALTER DEFAULT PRIVILEGES` del proyecto sigue concedido. 0021 cerró este hueco para `lobby_contraparte` con `revoke all from anon, authenticated`, pero las tablas previas (0018/maestra) no lo tienen. Hoy no hay fuga (RLS niega las filas), pero la defensa-en-profundidad de LEGAL-03 no está completa.

**Recomendación (follow-up, NO de Phase 11):** aplicar `revoke all on parlamentario, pii_contraparte_declaracion from anon, authenticated` (más un `ALTER DEFAULT PRIVILEGES ... REVOKE ... FROM anon` para tablas futuras) como hardening de LEGAL-03. Pertenece al piso PII de Phase 9 / a un hardening transversal, no a esta fase. Se reporta para decisión del operador, no como blocker de Phase 11.

### Human Verification Required

1. **Corrida LIVE de ingesta de congreso (DB write de producción)** — correr `ingest-cli` con la maestra cargada + service key contra la institución de congreso elegida; verificar filas en las 3 tablas; re-correr → conteos idénticos (idempotencia). El entorno autónomo solo pudo correr dry-run in-memory.
2. **Selección/validación de la fuente de lobby del congreso** — Cámara/Senado NO publican en `leylobby.gob.cl` (confirmado LIVE: la búsqueda solo devolvió "BCN"). La fuente real es `camara.cl/transparencia/ley_de_lobby.aspx` (ya allowlisted; el parser es column-agnostic). Confirmar layout y correr contra esa institución.

### Gaps Summary

No se encontraron gaps de código ni de test. Las 4 success criteria están verificadas en el código y contra el schema APLICADO en el remoto: el conector ingiere y construye la sub-maestra, la ficha muestra contraparte cruda + provenance sin enlazar, el enlace reunión→parlamentario es determinista-only con audit, y la regla anti-insinuación (carril aislado + content-gate + 3 estados honestos) está enforced por test verde. Las 25/25 (conector) + 11/11 (UI) pruebas pasan.

El estado es **human_needed** por dos items de operador/verificación humana inherentes al diseño LIVE-gated del plan (no son fallas): (1) la escritura real a producción con la maestra cargada, y (2) la selección/validación de la fuente de lobby del congreso (camara.cl/transparencia, no leylobby).

Hallazgo adicional reportado para decisión: el privilegio de tabla anon heredado sobre las tablas PII previas (`parlamentario`, `pii_contraparte_declaracion`) — defensa-en-profundidad LEGAL-03 incompleta, hardening transversal recomendado, no bloquea Phase 11.

---

_Verified: 2026-06-19_
_Verifier: Claude (gsd-verifier)_
