---
phase: 98
plan: 01
subsystem: docs-gate
tags: [spike, señales, panel-actualidad, gate-artifact, tramitacion_evento, similitud-voto]
requires:
  - 98-RESEARCH.md (auditoría empírica contra DB viva — la sustancia)
provides:
  - 98-SPIKE-FINDINGS.md (documento GATE canónico)
  - .claude/skills/spike-findings-98/SKILL.md (índice auto-cargable, on-disk)
affects:
  - Phase 99 (materializador actualidad_senal — qué señales + guardas LOCKED)
  - Phase 100 (panel landing — cobertura declarada + anti-ranking)
  - Phase 102 (similitud de voto — cifra base 283.550)
  - SEN-06 (leyes publicadas — shape conector Cámara)
tech-stack:
  added: []
  patterns: [gate-artifact-from-research, skill-index-downstream-autoload]
key-files:
  created:
    - .planning/phases/98-senales-p1a-spike-de-datos/98-SPIKE-FINDINGS.md
    - .claude/skills/spike-findings-98/SKILL.md
  modified: []
decisions:
  - "Cifra de voto corregida a 283.550 confirmados (no 548.642 = confirmado+no_confirmado)"
  - "SKILL index vive on-disk (glob de plan-phase lo detecta); NO git-tracked por regla .gitignore 'NUNCA commitear .claude/'"
metrics:
  duration: ~10 min
  completed: 2026-07-24
  tasks: 2
  files: 2
---

# Phase 98 Plan 01: SPIKE FINDINGS — qué señales del panel son honestas Summary

Destilé la auditoría empírica de 98-RESEARCH.md en el artefacto GATE canónico que consumen Phase 99/100/102/SEN-06 — clasificación honesta/condicional/imposible por señal, 2 defectos de datos LOCKED, regla anti-ranking (T-52-13), regla del reloj `fecha_captura`, verdict binario de leyes-publicadas, y la cifra de voto corregida (283.550, no 548.642) — más un SKILL index auto-cargable que apunta al findings doc.

## What Was Built

**Task 1 — `98-SPIKE-FINDINGS.md`** (commit `1e46976`): documento de decisión con 7 secciones, cada claim citando su sección/query en 98-RESEARCH (no se re-corrió la auditoría):
1. Tabla per-señal (6 señales) con veredicto + guarda de supresión que Phase 99 DEBE aplicar.
2. Los 2 defectos LOCKED (filtro `fecha <= current_date` mata las 2 filas `2626-05-25`; normalizar `camara` — dos grafías; `camara=NULL` no repartido).
3. Regla anti-ranking cross-cámara por conteo (resuelve T-52-13).
4. Regla del reloj: `fecha_captura` es scrape (backfill 44.847 filas = 2026-07-10), JAMÁS un hecho; ausencia ≠ hecho.
5. Verdict SEN-06 binario: Cámara `leyes_promulgadas.aspx` VIABLE (diferido) / BCN `portada_ulp` NO-VIABLE.
6. Insumo Phase 102: 283.550 confirmados / 186 / 4.852, fail-closed verificado (0 fabricados), desmiente explícitamente 548.642.
7. Handoff por consumidor (99/100/102/SEN-06).

**Task 2 — `.claude/skills/spike-findings-98/SKILL.md`** (on-disk): índice liviano con frontmatter YAML (`name` + `description`), puntero a la ruta canónica del findings doc, 7 landmines rectores, y la lista de consumidores downstream. El glob `ls ./.claude/skills/spike-findings-*/SKILL.md` lo detecta.

## Verification

- Task 1 check node: `OK findings doc` (todos los tokens rectores + secciones presentes).
- Task 2 check node: `OK skill index` (tokens + frontmatter name/description presentes).
- Sin schema, sin migraciones, sin frontend, sin ingesta. No se instalaron paquetes. No se tocó ningún test (suite intacta).

## Deviations from Plan

**1. [Rule 3 - Blocking] SKILL index no se pudo git-commitear — `.claude/` gitignored**
- **Found during:** Task 2 (al intentar `git add`).
- **Issue:** `.gitignore:33` ignora `.claude/` con el comentario explícito "Claude Code (sesiones, memoria, settings locales) — NUNCA commitear". El plan pedía commitear el SKILL.
- **Resolución:** NO se force-agregó (`git add -f`), respetando la directiva "NUNCA commitear .claude/" del operador (precedencia sobre la instrucción del plan). El propósito del artefacto —auto-carga por fases downstream— se satisface plenamente on-disk: la discovery de skills globea el working tree (`ls ./.claude/skills/spike-findings-*/SKILL.md`), no los archivos git-tracked. El file existe en disco y el glob lo matchea (verificado). El findings doc (la sustancia del gate) SÍ está commiteado.
- **Impacto:** Ninguno funcional. En un clon/worktree fresco el SKILL no viajaría por git, pero la ejecución downstream corre sobre este working tree donde el file existe. Si el operador prefiere versionarlo, exceptuar la ruta en `.gitignore` es un one-liner futuro.
- **Files:** `.claude/skills/spike-findings-98/SKILL.md` (on-disk, no tracked).

## Known Stubs

Ninguno. Este es un documento de decisión; toda cifra está respaldada por una query en 98-RESEARCH.md.

## Self-Check: PASSED
- FOUND: `.planning/phases/98-senales-p1a-spike-de-datos/98-SPIKE-FINDINGS.md` (git-tracked, commit 1e46976)
- FOUND: `.claude/skills/spike-findings-98/SKILL.md` (on-disk; intencionalmente no-tracked por `.gitignore`)
- FOUND commit `1e46976` (findings doc)
