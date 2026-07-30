---
phase: 118-cron-audit-veredicto-por-cron-con-evidencia
verified: 2026-07-28T00:00:00Z
status: human_needed
score: 4/4 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: none
  previous_score: n/a
deferred:
  - truth: "G8 — CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID ausentes en Cuchecorp/gov-map"
    addressed_in: "Phase 119 + acto de operador"
    evidence: "§4 gap G8 (P2, deuda de operador) + 118-OPERATOR-CHECKPOINT.md (A); no bloquea ninguna ingesta programada"
  - truth: "G9 — GEMINI_API_KEY ausente / posible remapeo SUPABASE_URL en fichas-backfill"
    addressed_in: "Phase 119 + acto de operador"
    evidence: "§4 gap G9 (P2) + 118-OPERATOR-CHECKPOINT.md (B); workflow sin corridas, impacto hoy nulo"
  - truth: "G11 — hueco de cadencia de actualidad-materializar el viernes 2026-07-25"
    addressed_in: "Phase 119"
    evidence: "§4 G11: 'no se cierra por inferencia, se cierra por observación nueva' — re-mirar cron.job_run_details jobid=5"
human_verification:
  - test: "Cargar CLOUDFLARE_API_TOKEN y CLOUDFLARE_ACCOUNT_ID en GitHub → Cuchecorp/gov-map → Settings → Secrets and variables → Actions (permiso mínimo: Account → Workers Scripts → Edit)"
    expected: "gh secret list muestra ambos NOMBRES; el workflow deploy-cloudflare pasa de failure a success"
    why_human: "El agente no tiene acceso al dashboard de GitHub ni de Cloudflare y no debe recibir el valor por ningún canal. Deuda 110-02 confirmada abierta."
  - test: "Decidir sobre GEMINI_API_KEY de fichas-backfill — verificar PRIMERO si SUPABASE_URL es sólo un remapeo faltante (lobby-leylobby-weekly.yml:57 como plantilla)"
    expected: "O bien se carga GEMINI_API_KEY como secret, o se confirma que basta el fix de YAML de una línea que hará Phase 119"
    why_human: "Provisión de credencial = acto de operador; la decisión de si es secret o remapeo requiere criterio del dueño del repo."
---

# Phase 118: CRON-AUDIT — veredicto por cron con evidencia — Verification Report

**Phase Goal:** Se sabe empíricamente qué ingesta programada está viva, cuál está stale y cuál está rota — con evidencia por cron, no por lectura del YAML.
**Verified:** 2026-07-28
**Status:** human_needed (4/4 truths verificados; 2 actos de operador pendientes, no bloqueantes por diseño LOCKED)
**Re-verification:** No — verificación inicial

## Goal Achievement

### Observable Truths

| # | Truth (Success Criteria del ROADMAP) | Status | Evidence |
|---|---|---|---|
| 1 | Todos los workflows GH Actions + todos los jobs pg_cron enumerados; ninguno sin veredicto | ✓ VERIFIED | Universo cerrado 13 W + 2 PM + 5 PG = 20. `ls .github/workflows/*.yml \| wc -l` = 13 **re-derivado por el verificador**, coincide con `conteo_workflows_locales: 13`. `grep -c '^### PG-'` = 5 = `count(*) from cron.job` (P6a) = filas de P6. Gate: `tabla maestra=20 · secciones §2=20 · unidades=20` |
| 2 | Cada cron: veredicto verde/stale/roto respaldado por evidencia observada | ✓ VERIFIED | 12 probes reales (P0–P10) con comando + salida literal: `gh run list`, `gh secret list`, `psql cron.job`, `pnpm freshness --json`, `source_snapshot`. 20 bloques `#### Evidencia observada` = 20 unidades. Resumen: 10 verde · 1 stale · 0 roto · 9 no-cron |
| 3 | Cada veredicto no-verde: causa identificada apuntando a archivo o dato | ✓ VERIFIED | Verificado por muestreo contra el código real (abajo). Todas las citas `archivo:línea` que revisé resolvieron **exactamente** |
| 4 | Gaps priorizados como entrada ejecutable para Phase 119 | ✓ VERIFIED | 11 gaps G1–G11 (0 P0, 5 P1, 6 P2), ordenados por prioridad, con `archivo:línea` + pasos numerados concretos + criterio de cierre verificable por gap. Correspondencia bidireccional §2↔§4 confirmada por el gate (C7) |

**Score:** 4/4 truths verified

### Falsificación intentada — citas verificadas contra el código real

No acepté ninguna cita del documento sin resolverla. Muestreo:

| Cita del audit | Resultado de la verificación independiente |
|---|---|
| 6 schedules activos con su línea | Los 6 `- cron:` resuelven exactos (`actualidad-refresh.yml:17`, `agenda-weekly.yml:15`, `backup-parlamentario.yml:21`, `leyes-weekly.yml:19`, `lobby-leylobby-weekly.yml:16`, `probidad-weekly.yml:16`). `grep -c "^ *- cron:"` confirma 6 archivos, no 8 |
| Corrección al CONTEXT (8 → 6) | Confirmada: `digest-daily.yml:24-25` y `roster-weekly.yml:29-30` están **comentados**. El audit reportó el diff en vez de ajustar la cifra — regla de oro respetada |
| Entrypoints invocados (gotcha 57-05) | 6/6 resuelven a la línea exacta del `pnpm --filter … exec tsx src/<cli>.ts` |
| G6: `agenda/ingest-run.ts:155` descarta `existed` | **CONFIRMADO**: `const { r2Path: key } = await opts.r2.putImmutable(` — `existed` efectivamente descartado. Contraste con `tramitacion/ingest-run.ts:330` (`if (existed) … [skip] sin novedades`) verificado literal |
| G6: contrato en `r2-store.ts:71,79` | Confirmado: `"If-None-Match": "*"` y `const existed = res.status === 412` |
| G4 "verde prestado" | **CONFIRMADO y es el hallazgo más filoso del audit**: `catalog.ts` mapea `lobby-camara` → `lobby_audiencia` (tabla que llena `lobby-leylobby`) y `fichas` → `proyecto` (tabla que llena `leyes-weekly`). Ambas señales son estructuralmente incapaces de detectar la avería del cron que nombran |
| G2: `catalog.ts:313,337` | Confirmado: `workflowYml: "chilecompra-weekly.yml"` y `"servel-weekly.yml"`, ninguno de los dos existe en `.github/workflows/` |
| `lobby-camara-weekly.yml:14-17` (WAF) | Confirmado verbatim, incluido el fallback `docs/runbooks/cron-local-fallback.md` |

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| Tabla maestra §1.3 | 118-PROBES-RAW.md | id de probe por fila | ✓ WIRED | Las 20 filas citan `P0..P10` |
| Secciones §2 | Gap-list §4 | ids `G1..G11` | ✓ WIRED | Gate C7: §2=[G1..G11] == §4=[G1..G11], sin huérfanos en ninguna dirección |
| check-crons.sh | 118-CRON-VERDICTS.md | greps de conteo + anti-secreto | ✓ WIRED | `STRICT=1 bash check-crons.sh` → **exit 0**, 0 faltas, re-corrido por el verificador |
| §4 G8/G9 | 118-OPERATOR-CHECKPOINT.md | enlace explícito | ✓ WIRED | El checkpoint referencia G8/G9 y §4 referencia el checkpoint |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|---|---|---|---|
| Gate de cierre | `STRICT=1 bash check-crons.sh` | exit 0 · `0 falta(s)` · C1–C7 verdes | ✓ PASS |
| Denominador derivado, no hardcodeado | `ls .github/workflows/*.yml \| wc -l` | 13 == `conteo_workflows_locales: 13` | ✓ PASS |
| Suma del universo | aritmética sobre §1 | 13 + 2 + 5 = 20 == `conteo_total_unidades` == nº de veredictos | ✓ PASS |
| Anti-secreto (patrón canónico, corrido por el verificador) | `grep -icE "(sk\|ghp\|gho\|eyJ\|sb_secret_\|sb_publishable_)[-_a-z0-9]{12,}\|[0-9a-f]{40}\|postgres(ql)?://"` | 0 · 0 · 0 en los tres artefactos | ✓ PASS |
| Régimen read-only | `git status --porcelain` | sólo `M pnpm-workspace.yaml`, **preexistente al inicio de la fase**; cero archivos de producto tocados | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|---|---|---|---|---|
| CRON-01 | 118-01/02/03 | Auditoría E2E de TODOS los workflows (GH Actions + pg_cron) con veredicto por cron (verde/stale/roto) y evidencia | ✓ SATISFIED | `REQUIREMENTS.md:22` marcado `[x]`, `:66` mapeado a Phase 118 · Complete. Las 20 unidades tienen veredicto con evidencia observada |

Sin requisitos huérfanos: CRON-01 es el único ID mapeado a Phase 118 en REQUIREMENTS.md y los tres planes lo declaran.

### Anti-Patterns Found

Ninguno. Los tres artefactos son documentación de auditoría; no hay stubs, TODO/FIXME/XXX sin referencia, ni datos hardcodeados que simulen cobertura. Al contrario, el audit **rechaza explícitamente** fabricar cobertura (G2: "crear YAML vacíos para callar un 404 es fabricar cobertura").

### Observaciones menores (no bloquean)

1. **Porcentaje de éxito de `process-ingest-jobs` inconsistente entre artefactos**: P6 dice `99.8 %` (contra el teórico 40320) y §1.3 fila 16 dice `99.998 %` (contra las 40239 corridas observadas). Ambas lecturas son defendibles y ninguna cambia el veredicto (verde); es una diferencia de denominador, no un dato inventado.
2. La caducidad de ~14 días de los veredictos está declarada como límite — Phase 119 debe consumirlos pronto o re-probar.

### Human Verification Required

Ambos ítems son **actos de operador** y están declarados NO BLOQUEANTES por diseño LOCKED (`118-CONTEXT.md:37`). La fase cierra igual; los ítems viajan a Phase 119 como deuda de operador. Ninguna ingesta programada está bloqueada por ellos: los 6 workflows con `schedule:` activo tienen todos sus secrets presentes (P4).

#### 1. Secrets de Cloudflare (G8 — deuda 110-02)

**Test:** Cargar `CLOUDFLARE_API_TOKEN` y `CLOUDFLARE_ACCOUNT_ID` en GitHub → `Cuchecorp/gov-map` → Settings → Secrets and variables → Actions. Permiso mínimo: Account → Workers Scripts → Edit, acotado a la cuenta/zona del proyecto.
**Expected:** `gh secret list --repo Cuchecorp/gov-map` muestra ambos NOMBRES; `deploy-cloudflare` pasa de `failure` a `success`.
**Why human:** El agente no tiene acceso a los dashboards y no debe recibir el valor por ningún canal.

#### 2. `GEMINI_API_KEY` / remapeo `SUPABASE_URL` (G9)

**Test:** Verificar PRIMERO si `SUPABASE_URL` en `fichas-backfill.yml` es sólo un remapeo faltante de `secrets.SUPABASE_API_URL` (plantilla: `lobby-leylobby-weekly.yml:57`). Si lo es, no hay nada que cargar. Cargar `GEMINI_API_KEY` sólo si procede.
**Expected:** O bien el secret queda cargado, o se confirma que es un fix de YAML de una línea para Phase 119.
**Why human:** Provisión de credencial + decisión sobre el remapeo requieren al dueño del repo.

### Gaps Summary

**Sin gaps de verificación.** El objetivo de la fase se cumple y sobrevive al escrutinio adversarial: intenté falsificar el relato de los SUMMARY resolviendo las citas contra el código y los YAML reales, y **todas resolvieron exactamente**. El audit no infla su cobertura — corrige al CONTEXT (8 → 6 schedules) reportando el diff en vez de ajustar el esperado, declara 9 límites, separa "estados esperados" de gaps (§4.1), marca G11 como observación abierta en vez de cerrarla por inferencia, y se abstiene de declarar P0 donde no lo hay explicando por qué.

Los tres ítems del bloque `deferred` (G8, G9, G11) están explícitamente enrutados a Phase 119 y/o al operador; no son huecos de esta fase.

**Confianza en la evidencia:** alta. La verificación cruzó cuatro fuentes independientes (filesystem, `cron.job` vivo, código de los conectores, y el propio gate re-ejecutable) y ninguna contradijo al documento.

---

_Verified: 2026-07-28_
_Verifier: Claude (gsd-verifier)_
