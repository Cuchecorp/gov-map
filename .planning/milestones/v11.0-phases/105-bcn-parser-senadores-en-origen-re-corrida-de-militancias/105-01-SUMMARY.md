---
phase: 105-bcn-parser-senadores-en-origen-re-corrida-de-militancias
plan: 01
subsystem: bio (ingesta @obs/bio — parser militancias senadores BCN)
tags: [bcn, sparql, militancia, senadores, fail-closed, uri-a-label, BCN-01]
requires:
  - "packages/bio/src/parse-bcn-senadores.ts (parseBcnSenadores, línea 111 — locus del bug)"
  - "crudo R2 bio/envelope/2026-07-22/1fab3cb0…json (senadoresSparql — evidencia primaria)"
provides:
  - "resolverPartido(b) — resolución de partido fail-closed URI→label"
  - "PARTIDO_URI_A_LABEL — mapa determinista de 27 URIs BCN reales"
  - "parseBcnSenadoresConReporte(json) → { militancias, partidosDesconocidos }"
affects:
  - "105-02 (re-corrida --from-r2): re-parsea el mismo envelope; mapa cubre las 7 URIs SIN_LABEL"
  - "app/lib/format.ts partidoLegible() (cinturón display-only 104-03): conservado, ya no debería activarse"
tech-stack:
  added: []
  patterns:
    - "Fail-closed en el mapeo de partido (espejo del idiom sinMatch del paquete)"
    - "Mapa determinista anclado en evidencia real del crudo R2 + corroboración SPARQL en vivo"
key-files:
  created:
    - "packages/bio/src/__fixtures__/bcn-militancy-uri.json"
  modified:
    - "packages/bio/src/parse-bcn-senadores.ts"
    - "packages/bio/src/parse-bcn-senadores.test.ts"
    - "packages/bio/src/index.ts"
decisions:
  - "Mapa cubre las 27 URIs del crudo R2 (7 SIN_LABEL con nombre oficial SERVEL + 20 con label como defensa en profundidad); ninguna derivada del slug"
  - "URI desconocida → fail-closed: omite militancia + reporta URI en partidosDesconocidos (LOCKED 'ante la duda, calidad')"
  - "Contrato retro-compatible: parseBcnSenadores devuelve el array delegando en parseBcnSenadoresConReporte; run-bio.ts/enlazarSenadoresPorParlid intactos"
metrics:
  duration: "~8 min"
  tasks: 2
  files: 4
  completed: "2026-07-27"
---

# Phase 105 Plan 01: BCN parser senadores en ORIGEN (URI→label fail-closed) Summary

Cierra en la FUENTE el defecto "URI-como-partido" del parser de militancias de senadores de BCN: `resolverPartido` resuelve `hasPoliticalParty` URI→label por un mapa determinista construido con las 27 URIs reales del crudo R2 (corroboradas 1:1 por SPARQL en vivo), y una URI desconocida se OMITE + reporta (fail-closed), nunca fabrica ni deriva del slug.

## What Was Built

- **Task 1 (evidencia primaria)** — Enumeración de las URIs de partido de senadores desde el crudo R2 (`R2Store` desde `.env`, ListObjectsV2 SigV4 sobre el prefijo `bio/envelope/`) + corroboración SPARQL en vivo. La URL/endpoint/credenciales de R2 NUNCA se imprimieron; solo la key relativa.
- **Task 2 (fix + mapa + tests, TDD)** — `resolverPartido(b)` + `PARTIDO_URI_A_LABEL` (27 URIs) + `parseBcnSenadoresConReporte` que expone `partidosDesconocidos`. `parseBcnSenadores` delega y mantiene el contrato array.

## Task 1 — URIs de partido enumeradas (evidencia real)

**Fuente PRIMARIA:** crudo R2 `bio/envelope/2026-07-22/1fab3cb0939333c45cb01b20dcdd9232ca3e584f8d6a78aa2e02589ca4329549.json` (`senadoresSparql` — el MISMO envelope que 105-02 re-parseará).
**CORROBORACIÓN:** `datos.bcn.cl/sparql` en vivo (GET anónimo) → **idéntico 1:1** (27 URIs, mismas 7 SIN_LABEL).

**27 URIs DISTINCT** de `hasPoliticalParty`. De ellas **7 SIN `rdfs:label`** en BCN (verificado: el recurso no expone literal alguno — cero `rdfs:label`/`foaf:name`/`dc:title`) — esas eran las que disparaban el bug URI-como-partido:

| URI (slug) | rdfs:label BCN | Label del mapa |
|---|---|---|
| `…/movimiento-amarillos-por-chile` | **SIN_LABEL** | Amarillos por Chile |
| `…/partido-convergencia-social` | **SIN_LABEL** | Convergencia Social |
| `…/partido-democratas-chile` **(testigo S1344)** | **SIN_LABEL** | Partido Demócratas de Chile |
| `…/partido-frente-amplio` | **SIN_LABEL** | Frente Amplio |
| `…/partido-nacional-libertario` | **SIN_LABEL** | Partido Nacional Libertario |
| `…/partido-republicano-de-chile` | **SIN_LABEL** | Partido Republicano de Chile |
| `…/partido-social-cristiano` | **SIN_LABEL** | Partido Social Cristiano |

Las otras **20 URIs SÍ traen `rdfs:label`** en BCN (amplitud, evopoli, federacion-regionalista-verde-social, independiente, movimiento-amplio-social, partido-amplio-de-izquierda-socialista, partido-comunista-de-chile, partido-democrata-cristiano, partido-humanista, partido-liberal-de-chile, partido-pais-progresista, partido-por-la-democracia, partido-radical-socialdemocrata, partido-regionalista-de-los-independientes, partido-renovacion-nacional, partido-socialista-de-chile, partido-union-democrata-independiente, revolucion-democratica, union-de-centro-centro, union-de-centro-centro-progresista) → el mapa las incluye como **defensa en profundidad** (si BCN dejara de exponer su label, el mapa mantiene el dato limpio); el happy path usa el `rdfs:label` verbatim, el mapa no lo pisa.

**Caso testigo confirmado:** `partido-democratas-chile` (S1344, Matías Walker) = **SIN_LABEL** → antes caía al URI crudo; ahora resuelve a "Partido Demócratas de Chile". OJO: es DISTINTO de `partido-democrata-cristiano` (que SÍ trae label "Partido Demócrata Cristiano").

## Task 2 — Fix fail-closed

- **`resolverPartido(b)`**: (1) `rdfs:label` presente → verbatim; (2) ausente + URI en `PARTIDO_URI_A_LABEL` → label del mapa; (3) URI ausente del mapa (o vacía) → `null` = no resoluble → el caller OMITE la militancia y ACUMULA la URI en `partidosDesconocidos`. JAMÁS deriva del slug ni emite el URI.
- **`parseBcnSenadoresConReporte(json)`** → `{ militancias, partidosDesconocidos }`. **`parseBcnSenadores(json)`** delega y devuelve solo el array (retro-compatible con `run-bio.ts` sección B y `enlazarSenadoresPorParlid`).
- **Tests A–D** (TDD RED→GREEN): A label verbatim (3 bindings originales intactos), B URI conocida→label (S1344), C URI desconocida→omite+reporta, D anti-URI (ningún `partido` empieza con http/https en TODO output). + test de delegación.

## Verification

- `pnpm --filter @obs/bio test` → **70/70 verde** (parser 15/15, +4 nuevos).
- `pnpm --filter @obs/bio exec tsc --noEmit` → **EXIT 0**.
- `app/lib/format.test.ts` (partidoLegible display-only) → **42/42 verde** (sin regresión; belt conservado BCN-02).
- Ningún `partido` de salida empieza con `http`/`https` (Test D).
- Mapa auditable en el diff: 27 URIs REALES de la Task 1, cero cadena inventada, cero derivación de slug.

## Deviations from Plan

None — plan ejecutado exactamente como fue escrito. Cero fix emergente (árbol verde). Se añadió `parseBcnSenadoresConReporte`/`resolverPartido`/`PARTIDO_URI_A_LABEL`/`ParseSenadoresResult` al barrel `index.ts` (extensión aditiva) para que 105-02 pueda contar las omisiones.

## Authentication Gates

None. El acceso R2 usó las credenciales de `.env` (evidencia primaria) sin exponer URL/keys; SPARQL BCN es GET anónimo.

## Known Stubs

None. El mapa cubre las 27 URIs reales del crudo R2 (evidencia primaria = los bytes exactos que 105-02 re-parsea); las 7 SIN_LABEL están cubiertas → la re-corrida 105-02 no debería reportar ninguna omisión sobre este envelope.

## Notes for 105-02 (re-corrida)

- El envelope a re-parsear con `--from-r2` es `bio/envelope/2026-07-22/1fab3cb0…json` (senadoresSparql poblado, 27 URIs). Hay 3 envelopes más del 2026-07-22 sin/otros contenidos; este es el de senadores.
- La verificación PROD post-re-corrida (CONTEXT LOCKED): `militancia.partido ~* '^https?://'` y `parlamentario.partido ~* '^https?://'` → **cero** en filas de senadores. `partidosDesconocidos` debería quedar vacío para este envelope.

## Self-Check: PASSED

- FOUND: packages/bio/src/parse-bcn-senadores.ts (resolverPartido, PARTIDO_URI_A_LABEL, parseBcnSenadoresConReporte)
- FOUND: packages/bio/src/__fixtures__/bcn-militancy-uri.json
- FOUND: packages/bio/src/parse-bcn-senadores.test.ts (Tests A–D)
- FOUND commit f21b66b (test RED), 7fb6f7f (feat GREEN), 4ec3bcf (chore barrel)
