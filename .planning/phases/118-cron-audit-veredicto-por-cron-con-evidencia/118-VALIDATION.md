---
phase: 118
slug: cron-audit-veredicto-por-cron-con-evidencia
status: final
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-28
updated: 2026-07-28
---

# Phase 118 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Fase READ-ONLY: no se produce código de producto. La "unidad bajo prueba" es el artefacto
> `118-CRON-VERDICTS.md` y su evidencia; los gates son greps de completitud, conteos derivados y
> el gate anti-secreto — todos re-ejecutables en segundos.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | greps POSIX + `check-crons.sh` (gate del artefacto) · vitest sólo como control de no-regresión |
| **Config file** | `.planning/phases/118-cron-audit-veredicto-por-cron-con-evidencia/check-crons.sh` (creado en 118-03) |
| **Quick run command** | `bash check-crons.sh` (STRICT=0, modo reporte) |
| **Full suite command** | `STRICT=1 bash check-crons.sh` + `pnpm --filter ./app test -- --run` (control: la suite NO debe moverse de 1560) |
| **Estimated runtime** | < 5 s el gate · ~120 s el control de suite |

---

## Sampling Rate

- **After every task commit:** correr el `<automated>` de la task (todos < 5 s salvo el control de suite)
- **After every plan wave:** `bash check-crons.sh` en modo reporte una vez exista (wave 3); antes, los greps de conteo embebidos en los verify
- **Before `/gsd:verify-work`:** `STRICT=1 bash check-crons.sh` verde + suite sin delta
- **Max feedback latency:** 180 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 118-01-01 | 01 | 1 | CRON-01 | T-118-02, T-118-03 | `gh secret list` sólo nombres; logs de runs recortados; 0 secretos en la bitácora | CLI + grep | `test -f 118-PROBES-RAW.md && [ "$(grep -c '^## P' 118-PROBES-RAW.md)" -ge 5 ] && [ "$(grep -icE '<patrón anti-secreto>' 118-PROBES-RAW.md)" -eq 0 ]` | ⬜ (lo crea la task) | ⬜ pending |
| 118-01-02 | 01 | 1 | CRON-01 | T-118-01, T-118-04 | psql sólo `select`, URL siempre por variable, nunca impresa | CLI + grep | `[ "$(grep -c '^## P' 118-PROBES-RAW.md)" -ge 10 ] && grep -q '^## P6a' 118-PROBES-RAW.md && grep -q 'cron.job' 118-PROBES-RAW.md && [ "$(grep -icE '<patrón anti-secreto>' 118-PROBES-RAW.md)" -eq 0 ]` | ⬜ (apenda al anterior) | ⬜ pending |
| 118-01-03 | 01 | 1 | CRON-01 | T-118-01 | conteos derivados, no hardcodeados; 0 secretos en el documento | grep + aritmética derivada | `D=$(ls .github/workflows/*.yml \| wc -l)`; W/PM/N/T parseados de las líneas `conteo_*` de §1; `[ "$W" -eq "$D" ] && [ "$T" -eq "$((W+PM+N))" ] && [ "$(grep -c 'Veredicto: ' 118-CRON-VERDICTS.md)" -eq "$T" ]` | ⬜ (lo crea la task) | ⬜ pending |
| 118-02-01 | 02 | 2 | CRON-01 | T-118-05, T-118-07 | causa con `archivo:línea`; `return_message` y logs recortados | grep de completitud | `N=$(ls .github/workflows/*.yml \| wc -l)`; `[ "$(grep -c '^### W-')" -eq "$N" ] && [ "$(grep -c '^### PM-')" -eq 2 ] && [ "$(grep -c '#### Cómo re-verificar')" -ge 15 ] && [ "$(grep -c '#### Evidencia observada')" -ge 15 ]` | ✅ | ⬜ pending |
| 118-02-02 | 02 | 2 | CRON-01 | T-118-05, T-118-06 | probes complementarias sólo `select`, apendadas a la bitácora | grep de completitud | `grep -q '^### PG-' && grep -q '^### 3.1' && grep -q '^### 3.3' && grep -q '^### 3.4' && grep -q 'catalog.ts' && [ "$(grep -icE '<patrón anti-secreto>' 118-CRON-VERDICTS.md)" -eq 0 ]` | ✅ | ⬜ pending |
| 118-03-01 | 03 | 3 | CRON-01 | T-118-07 | todo gap con puntero real; nada sobre-afirmado | grep de punteros | `grep -q '^## 4\.' && grep -q '^### 4.1' && grep -q '^## 5\.' && grep -q '^## 6\. Límites' && [ "$(grep -cE 'G[0-9]+.*\.(ts\|yml\|sql):[0-9]+')" -ge 10 ]` | ✅ | ⬜ pending |
| 118-03-02 | 03 | 3 | CRON-01 | T-118-08 | checkpoint zero-credential-value; el valor jamás pasa por el agente | grep anti-secreto | `test -f 118-OPERATOR-CHECKPOINT.md && [ "$(grep -icE '<patrón anti-secreto>' 118-OPERATOR-CHECKPOINT.md)" -eq 0 ]` | ⬜ (lo crea la task) | ⬜ pending |
| 118-03-03 | 03 | 3 | CRON-01 | T-118-09, T-118-10, T-118-11 | el gate no se ajusta para pasar (el ancla se reporta); greps sobre los artefactos, no sobre sí mismo | script gate + suite | `bash check-crons.sh && STRICT=1 bash check-crons.sh && grep -q '^## 7\. Verificación de cierre' 118-CRON-VERDICTS.md && [ "$(grep -c 'grep -P' check-crons.sh)" -eq 0 ]` · control: `pnpm --filter ./app test -- --run` | ⬜ (lo crea la task) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*`<patrón anti-secreto>` = `(sk|ghp|gho|eyJ|sb_secret_|sb_publishable_)[-_a-z0-9]{12,}|[0-9a-f]{40}|postgres(ql)?://` — idéntico en las 8 tasks y en C6 de `check-crons.sh`. Cubre tokens OpenAI/GitHub/JWT, las keys Supabase `sb_secret_`/`sb_publishable_`, tokens hex de 40 y cualquier URL de Postgres.*

**Continuidad de muestreo:** las 8 tasks tienen `<automated>`; ninguna secuencia de 3 sin verificación automática.

---

## Wave 0 Requirements

Ninguno. No hay infraestructura de test que crear: los gates son greps POSIX sobre artefactos que
las propias tasks producen, y el gate consolidado (`check-crons.sh`) se crea en 118-03-03 clonando
el contrato de `check-fechas.sh` (Phase 116). Ningún `<automated>` queda en estado MISSING.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| El veredicto verde/stale/roto es el correcto para cada unidad | CRON-01 | El juicio cruza 3-4 patas e interpreta "sin novedades honesto" vs "cursor detenido" — un grep verifica que la evidencia esté citada, no que la conclusión sea acertada | Revisar `118-CRON-VERDICTS.md` §2: cada unidad cita comando + salida; contrastar el veredicto contra §3.4 Cursores |
| El fix propuesto por gap es ejecutable sin re-investigar | CRON-01 | Utilidad para Phase 119; no verificable por regex | Leer §4: cada fila con pasos concretos, no un verbo genérico |
| El checkpoint de operador no induce a exponer credenciales | CRON-01 | Juicio sobre redacción | Leer `118-OPERATOR-CHECKPOINT.md`: ningún paso pide el valor al agente ni pegarlo en el repo |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (no hay MISSING)
- [x] No watch-mode flags
- [x] Feedback latency < 180s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** final — 2026-07-28
