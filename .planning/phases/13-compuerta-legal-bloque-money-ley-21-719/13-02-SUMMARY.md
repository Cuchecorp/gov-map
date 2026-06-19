---
phase: 13-compuerta-legal-bloque-money-ley-21-719
plan: 02
subsystem: legal
tags: [ley-21719, dossier, signoff, money, chilecompra, servel, minimizacion, licencia]

# Dependency graph
requires:
  - phase: 13-compuerta-legal-bloque-money-ley-21-719 (13-01)
    provides: "flag MONEY_PUBLIC_ENABLED (app/lib/money-gate.ts) que el dossier referencia como consumidor del signoff"
  - phase: 09 (LEGAL-03)
    provides: "compuerta de minimizacion LLM (assertPiiDocumentSafeForLlm) citada como evidencia VERIFIED"
provides:
  - "13-LEGAL-DOSSIER.md canonico (dossier de preparacion, NO dictamen) con YAML signoff: pending"
  - "copia publicable byte-identica en docs/legal/13-LEGAL-DOSSIER.md"
  - "registro verificable por inspeccion del estado de sign-off (prerrequisito duro para encender MONEY_PUBLIC_ENABLED)"
affects: [Phase 14 (MONEY ChileCompra), Phase 15 (MONEY SERVEL), Phase 16 (MONEY agregacion), deuda operador F13]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Front-matter YAML signoff: pending como registro de estado verificable por inspeccion"
    - "Licencia documentada POR DATASET (no licencia blanket)"
    - "Documento de preparacion legal: cada base de licitud cierra con PENDIENTE DE VALIDACION LEGAL"

key-files:
  created:
    - .planning/phases/13-compuerta-legal-bloque-money-ley-21-719/13-LEGAL-DOSSIER.md
    - docs/legal/13-LEGAL-DOSSIER.md
  modified:
    - .planning/ROADMAP.md

key-decisions:
  - "El dossier es PREPARACION, no dictamen: nunca afirma cumplimiento; toda base de licitud cierra con PENDIENTE DE VALIDACION LEGAL"
  - "Licencia por dataset y NO blanket: ChileCompra = mencion de fuente (NO CC BY 4.0); SERVEL = por verificar (MEDIUM); CC BY 4.0 solo InfoProbidad"
  - "El estado de sign-off vive en el YAML (signoff: pending); encender MONEY_PUBLIC_ENABLED depende de signoff: approved, verificable por inspeccion"
  - "Copia en docs/legal/ creada por cp a nivel de filesystem para garantizar byte-identidad con el canonico"

patterns-established:
  - "YAML signoff front-matter: registro de sign-off legal autocontenido y versionado"
  - "Correccion de supuesto via tabla por-dataset: corrige la afirmacion imprecisa 'CC BY 4.0 para MONEY' de CLAUDE.md/CONTEXT"

requirements-completed: [LEGAL-01]

# Metrics
duration: 12min
completed: 2026-06-19
---

# Phase 13 Plan 02: Dossier Legal de Preparacion (Ley 21.719) Summary

**Dossier de preparacion para asesoria legal externa (NO dictamen) que estructura las 3 superficies LEGAL-01 del bloque MONEY bajo la Ley 21.719, con YAML signoff: pending como prerrequisito duro verificable, licencia corregida por dataset, y copia publicable byte-identica en docs/legal/.**

## Performance

- **Duration:** ~12 min
- **Tasks:** 2/2
- **Files created:** 2 (canonico + copia)
- **Files modified:** 1 (ROADMAP.md checkbox)

## Accomplishments

- **`13-LEGAL-DOSSIER.md` canonico** con front-matter YAML (`documento`, `alcance`, `signoff: pending`, `asesor`, `fecha_signoff`, `observaciones`, `depende_de`, `nota`) y cuerpo completo: descargo + marco temporal Ley 21.719, las 3 superficies (a/b/c), minimizacion, proposito, base de licitud con borrador de test de ponderacion, tabla de licencia por dataset, trazabilidad al gate, checklist de sign-off, y anexo de supuestos a verificar.
- **Tono de preparacion sostenido:** ninguna afirmacion "el tratamiento es licito"; cada base de licitud y cada superficie cierra con PENDIENTE DE VALIDACION LEGAL / "a confirmar por el asesor".
- **Correccion critica de licencia por dataset:** ChileCompra = mencion de fuente (NO CC BY 4.0); SERVEL = por verificar (MEDIUM); CC BY 4.0 reservado a InfoProbidad. Nota explicita de que "CC BY 4.0 para MONEY" de CLAUDE.md/CONTEXT es imprecisa y queda corregida.
- **Copia publicable byte-identica** en `docs/legal/13-LEGAL-DOSSIER.md` (nuevo subdir).
- **Trazabilidad:** enlaces a deuda operador F13, ROADMAP Phase 13 success criterion 3, y dependencia de `signoff: approved` para encender `MONEY_PUBLIC_ENABLED`.

## Task Commits

Cada tarea se commiteo atomicamente:

1. **Task 1: Redactar 13-LEGAL-DOSSIER.md canonico** - `77aa3ff` (docs)
2. **Task 2: Copiar dossier a docs/legal/** - `5f47db3` (docs)

## Files Created/Modified

- `.planning/phases/13-compuerta-legal-bloque-money-ley-21-719/13-LEGAL-DOSSIER.md` - dossier canonico con YAML signoff + 3 superficies + minimizacion + proposito + base de licitud + licencia por dataset + checklist
- `docs/legal/13-LEGAL-DOSSIER.md` - copia publicable byte-identica
- `.planning/ROADMAP.md` - checkbox de 13-02-PLAN.md marcado completo

## Deviations from Plan

None - plan ejecutado exactamente como fue escrito. Decision de implementacion (dentro del alcance): la copia de Task 2 se creo via `cp` a nivel de filesystem en lugar de re-escribir el contenido, para garantizar byte-identidad — el plan exige "copia byte-identica" y el verify de igualdad es la condicion de done.

## Verification Results

- **Task 1 verify (grep estructura):** PASS — `signoff: pending`, Superficie (a)/(b)/(c), PENDIENTE, ChileCompra, mencion presentes.
- **Task 1 verify (grep -c "CC BY 4.0"):** 8 ocurrencias, TODAS en contexto correctivo (InfoProbidad-only / "NO es CC BY 4.0" / "NO etiquetar ChileCompra ni SERVEL como CC BY 4.0"). Ninguna etiqueta ChileCompra/SERVEL como CC BY.
- **Guard (afirmacion de licitud):** PASS — `grep "el tratamiento es l"` no encuentra coincidencias; ninguna afirmacion de cumplimiento.
- **Guard (BOM):** PASS — primeros bytes 45 45 45 ("---"), sin BOM UTF-8, sin unicode invisible.
- **Task 2 verify (byte-identico):** PASS — `node` confirma `a === b` entre canonico y copia ("copia identica OK").

## Success Criteria Mapping (ROADMAP Phase 13)

- **SC1** (pasada legal cubriendo 3 superficies): el dossier estructura explicitamente republicacion / afiliacion politica sensible / terceros privados como material para la asesoria; el REGISTRO del estado es el YAML `signoff: pending` (la APROBACION humana es deuda F13).
- **SC2** (minimizacion + proposito visible): secciones de minimizacion (RUT/familiares internos, RUT nunca al LLM — evidencia VERIFIED) y de proposito (transparencia legislativa / control ciudadano, sin causalidad) explicitas.
- **SC3** (sign-off prerrequisito duro verificable): el YAML `signoff: pending` es verificable por inspeccion; el dossier documenta que encender el gate depende de `signoff: approved` y enlaza a F13/SC3.

## Known Stubs

None. El `signoff: pending` y los campos `asesor`/`fecha_signoff`/`observaciones` vacios NO son stubs: son el estado inicial intencional del registro de sign-off (la aprobacion humana es deuda de operador F13, fuera de esta corrida autonoma — documentado en el dossier y en el plan).

## Threat Flags

None. El plan no introduce superficie de seguridad nueva fuera del threat_model (T-13-05/06/07 mitigados: descargo "preparacion no dictamen" + PENDIENTE por base de licitud; licencia por dataset; copia byte-identica verificada).

## Self-Check: PASSED

- FOUND: `.planning/phases/13-compuerta-legal-bloque-money-ley-21-719/13-LEGAL-DOSSIER.md`
- FOUND: `docs/legal/13-LEGAL-DOSSIER.md`
- FOUND: `.planning/phases/13-compuerta-legal-bloque-money-ley-21-719/13-02-SUMMARY.md`
- FOUND commit: `77aa3ff` (Task 1)
- FOUND commit: `5f47db3` (Task 2)
