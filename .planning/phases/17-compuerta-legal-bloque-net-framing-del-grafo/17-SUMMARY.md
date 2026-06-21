---
phase: 17-compuerta-legal-bloque-net-framing-del-grafo
plan: 01
subsystem: legal
tags: [ley-21719, dossier, signoff, net, grafo, composicion, minimizacion, cc-by-4.0, net-gate]

# Dependency graph
requires:
  - phase: 13-compuerta-legal-bloque-money-ley-21-719
    provides: "13-LEGAL-DOSSIER.md (plantilla estructural + marco temporal Ley 21.719 reusado por referencia) y patron flag MONEY_PUBLIC_ENABLED espejado por NET_PUBLIC_ENABLED"
  - phase: 09 (LEGAL-03)
    provides: "piso PII / RLS deny-by-default (0018) y postura partido-nunca-a-anon que el grafo hereda"
  - phase: 11-12 (INT lobby/probidad)
    provides: "deny-by-default de terceros (0021/0022) que el grafo hereda; CC BY 4.0 de InfoProbidad"
provides:
  - "17-LEGAL-DOSSIER.md canonico (dossier de preparacion NET, NO dictamen) con YAML signoff: pending"
  - "copia publicable byte-identica en docs/legal/17-LEGAL-DOSSIER-NET.md"
  - "especificacion del gate NET_PUBLIC_ENABLED (doble candado RLS + flag default false) para que Phase 18 lo implemente"
  - "registro verificable por inspeccion del sign-off (prerrequisito duro para exponer NET)"
affects: [Phase 18 (NET grafo de influencia), deuda operador F17]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Dossier centrado en COMPOSICION como riesgo nuclear (no en dato nuevo): el grafo deriva, no agrega"
    - "Garantias de framing descriptivo enumeradas como evidencia (aristas tipadas/fechadas/con fuente, sin score, sin path-finding, sin LLM, sin causalidad)"
    - "CC BY 4.0 propagado POR DATASET en nodos/aristas (solo InfoProbidad), no blanket"
    - "Gate de exposicion NET_PUBLIC_ENABLED especificado (espejo de money-gate.ts) para Phase 18"

key-files:
  created:
    - .planning/phases/17-compuerta-legal-bloque-net-framing-del-grafo/17-LEGAL-DOSSIER.md
    - docs/legal/17-LEGAL-DOSSIER-NET.md
  modified:
    - .planning/REQUIREMENTS.md
    - .planning/STATE.md
    - .planning/ROADMAP.md

key-decisions:
  - "El riesgo NUCLEAR de NET es la COMPOSICION (arista/camino leido como acusacion), no un dato nuevo: el grafo es consumidor puro de VOTE/INT/MONEY"
  - "Framing descriptivo garantizado por construccion: aristas tipadas/fechadas/con fuente, ambos extremos confirmado, sin score, sin path-finding destacado, sin lenguaje causal, sin aristas inferidas por LLM"
  - "CC BY 4.0 propaga SOLO desde InfoProbidad; ChileCompra=mencion de fuente, SERVEL=por verificar, votos/lobby=institucional — NO blanket CC BY 4.0 (misma correccion que 13 §8)"
  - "Gate NET_PUBLIC_ENABLED = doble candado (RLS deny-by-default sobre entidad/arista + flag server-only default false); encenderlo depende de signoff: approved, verificable por inspeccion del YAML"
  - "Marco temporal Ley 21.719 y supuestos A1-A8 reusados POR REFERENCIA de 13-LEGAL-DOSSIER (no re-litigados); se agregan supuestos N1-N5 especificos del framing del grafo"
  - "Copia en docs/legal/ creada por cp a nivel de filesystem para byte-identidad con el canonico"

# Metrics
metrics:
  duration: ~12min
  completed: 2026-06-21
---

# Phase 17 Plan 01: Compuerta Legal — Bloque NET (framing del grafo) Summary

Dossier legal NET de preparacion (`17-LEGAL-DOSSIER.md`) que estructura, para revision de un
abogado externo bajo la Ley 21.719, la superficie de riesgo del grafo de influencia — con el
riesgo de **composicion** (que una arista o un camino se lea como acusacion aunque cada hecho
sea publico y con fuente) como centro de la pregunta nuclear del sign-off. Espeja la estructura
del dossier MONEY (Phase 13). El sign-off humano queda PENDIENTE (deuda de operador F17); la
especificacion del gate `NET_PUBLIC_ENABLED` queda lista para que Phase 18 la implemente.

## What was built

- **`17-LEGAL-DOSSIER.md`** (canonico, en el directorio de la fase) con front-matter
  `signoff: pending` y secciones §0-§9 + Anexo:
  - **§0** Proposito y descargo (preparacion, no dictamen; marco temporal Ley 21.719 por
    referencia a 13).
  - **§1** La superficie NET = relaciones DERIVADAS (composicion, no datos nuevos).
  - **§2** Riesgo NUCLEAR — arista/camino como acusacion + garantias de framing descriptivo.
  - **§3** Datos sensibles en nodos/aristas (partido nunca a anon; ambos extremos confirmado;
    terceros deny-by-default).
  - **§4** Minimizacion por diseño (no-LLM, no-path-as-accusation, copy sobrio, doble candado).
  - **§5** Proposito acotado (transparencia, NUNCA intencion ni causalidad).
  - **§6** CC BY 4.0 por dataset (solo InfoProbidad; resto su propia atribucion).
  - **§7** Base de licitud (interes legitimo + test, con el factor adicional de composicion;
    PENDIENTE).
  - **§8** Trazabilidad y consumo por el gate `NET_PUBLIC_ENABLED` (doble candado; depende de
    `signoff: approved`).
  - **§9** Checklist de sign-off para el asesor.
  - **Anexo** supuestos: A1-A8 por referencia a 13 + N1-N5 especificos del grafo.
- **`docs/legal/17-LEGAL-DOSSIER-NET.md`** — copia byte-identica (publicable).
- **REQUIREMENTS.md** — LEGAL-02 enlazado al dossier; status `Pending` (sign-off humano F17).

## Deviations from Plan

None — el dossier se produjo segun la especificacion de 17-CONTEXT §decisions, espejando la
forma de 13-LEGAL-DOSSIER.

## Sign-off status

**PENDING (deuda de operador F17).** El estado vive en el front-matter YAML (`signoff: pending`).
Mientras `signoff != approved`, el operador NO enciende `NET_PUBLIC_ENABLED`. Un abogado externo
debe revisar, completar el checklist (§9), dictaminar el riesgo de composicion (§2) y setear
`signoff: approved` (o `rejected`) en ambas copias.

## Gate spec'd for Phase 18

`NET_PUBLIC_ENABLED` queda especificado (no implementado aqui): doble candado = (a) tablas
`entidad`/`arista` deny-by-default a `anon` por RLS + RPC PII-safe (ambos extremos confirmado,
sin partido); (b) flag server-only en `app/lib/net-gate.ts` (espejo exacto de `money-gate.ts`,
default `false`, fail-closed). Verificacion pgTAP/test prevista en Phase 18. Encenderlo depende
de `signoff: approved`.

## Self-Check: PASSED
