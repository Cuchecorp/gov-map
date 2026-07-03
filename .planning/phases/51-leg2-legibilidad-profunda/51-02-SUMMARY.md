---
phase: 51-leg2-legibilidad-profunda
plan: 02
subsystem: frontend-ficha-votos
tags: [legibilidad, votos, rebeldias, server-driven, anti-insinuacion, dead-code]
requires:
  - "rebeldias_de_parlamentario RPC (0047 escrita en 51-01; apply remoto = checkpoint operador)"
  - "votos_de_parlamentario RPC (0028, ya en PROD)"
provides:
  - "linea-resumen por arco de proyecto (SC1) con detalle a un clic server-driven ?votosVer"
  - "RebeldiaRow extendido con titulo/etapa (contrato de 0047)"
  - "consumidor de rebeldias con titulo hidratado + fallback honesto (SC5)"
  - "B24 cerrado: sin honest-state duplicado por fila en voto-ficha-row"
affects:
  - "app/components/votos-por-parlamentario.tsx (ficha #votos)"
  - "app/components/voto-ficha-row.tsx"
tech-stack:
  added: []
  patterns:
    - "href server-driven espejo de buildVerHref (patrimonio) — searchParam ?votosVer + ancla #votos"
    - "helper puro exportado + testeado (resumenDeArco) fuera del Server Component"
    - "degradacion honesta pre-apply: titulo null -> fallback boletin, nunca fabrica"
key-files:
  created: []
  modified:
    - app/lib/types.ts
    - app/components/votos-por-parlamentario.tsx
    - app/components/voto-ficha-row.tsx
    - app/components/votos-por-parlamentario.test.tsx
decisions:
  - "buildVotosVerHref replica buildVerHref de patrimonio (solo votosVer + #votos); no preserva materia/votosPage — mismo trade-off que el patron referenciado"
  - "rango de un solo mes: 'en {mes}' en vez de 'entre X y X' (variacion de puntuacion permitida por UI-SPEC, evita repeticion awkward)"
  - "pluralizacion 'ocasion'/'ocasiones' segun n (correccion gramatical, no cambia registro ni significado)"
  - "componentes VotoFichaRow/VotoFichaMencionRow CONSERVADOS (consumidos por el test); se borro SOLO el path muerto B24, no el archivo"
metrics:
  duration: ~6min
  completed: 2026-07-03
  tasks: 2
  files: 4
  commits: 3
  suite: 422 verde
---

# Phase 51 Plan 02: Votos agregados por proyecto + rebeldías con título + B24 Summary

Colapsa cada arco de proyecto de la ficha en UNA línea-resumen (conteos por sentido + rango de meses) con el detalle expandible a un clic server-driven (`?votosVer=<boletin>`), hidrata el título del proyecto en las filas de "votó distinto a su bancada" con fallback honesto al boletín, y elimina el dead code B24 (honest-state duplicado por fila). Cero dato perdido, copy neutro, cero dependencias nuevas.

## What Was Built

### Task 1 — Línea-resumen por arco + toggle `?votosVer` (SC1, TDD)
- **`resumenDeArco(arco)`** — helper PURO exportado y testeado: `n` = etapas del arco, conteos por `seleccion` (`si/no/abstencion/pareo/ausente`), y `mesInicio`/`mesFin` = min/max de `e.fecha` formateado `"mmm AAAA"` (es-CL). Cadena vacía cuando no hay fechas válidas → el llamador omite el rango.
- **`ResumenLinea`** — render de la línea-resumen: `"Votó en {N} ocasiones sobre este proyecto: {a} a favor · {b} en contra …, entre {mesInicio} y {mesFin}."` Mono para `N`/tallies/rango. OMITE cualquier sentido en 0 (nunca "· 0 ausente"). Rango de un solo mes → "en {mes}".
- **`ProyectoGrupo`** — por defecto muestra SOLO la línea-resumen; con `?votosVer === grupo.boletin` para ESE arco expande las etapas individuales (comportamiento previo). Afford petróleo underline "Ver detalle" / "Ocultar detalle" vía `buildVotosVerHref`.
- **`buildVotosVerHref(id, boletin, abierto)`** — replica `buildVerHref` de patrimonio: setea/quita `?votosVer` + ancla `#votos`.
- `votosVer` fluye `VotosSection` (leído del searchParam ya resuelto, normalizado como los demás params del repo) → `derivarVotosViewData` → `VotosViewData.votosVer` → `VotosView` → `ProyectoGrupo`.

### Task 2 — RebeldiaRow con título + consumidor (SC5) + B24
- **`RebeldiaRow`** extendido a `votacion_id, boletin, titulo (string|null), etapa (string|null), fecha, seleccion_propia, mayoria_bancada` — mismo orden que el `returns table` de 0047 (verificado contra la migración).
- **Consumidor de rebeldías** (`VotosView`): fila con `r.titulo` → `<Link>` al título + etapa cuando existe; `r.titulo` null → fallback al boletín (degradación honesta pre-apply: mientras 0047 no esté aplicada, `titulo` llega null y cae al boletín sin romper). Copy neutro existente intacto; lógica de conteo sin cambios (viene del RPC).
- **B24 cerrado** en `voto-ficha-row.tsx`: eliminado el path muerto `"De qué trata: no disponible aún"` por fila (ahora se omite la línea cuando `idea_matriz` es null); comentario doc actualizado. `grep` confirma 0 ocurrencias de "no disponible aún" en el archivo. Los componentes `VotoFichaRow`/`VotoFichaMencionRow` se conservaron (los consume el test); se borró SOLO el path muerto.

## Verification

- `pnpm --dir app test -- --run votos-por-parlamentario` → **422 verde** (43 archivos). +9 tests nuevos (resumenDeArco ×2, línea-resumen/toggle ×4, rebeldías título/fallback ×2, B24 ×1).
- `pnpm --dir app exec tsc -b` → **limpio**.
- `grep "no disponible aún" voto-ficha-row.tsx` → **0 matches**.
- Negative-match banned-vocab sobre el copy nuevo (línea-resumen + rebeldías) → verde (test dedicado GATE §9.1).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixtures de `RebeldiaRow` en tests existentes sin `titulo`/`etapa`**
- **Found during:** Task 2 (al extender `RebeldiaRow` con campos requeridos)
- **Issue:** Dos fixtures `const rebeldias: RebeldiaRow[]` (tests de "votó distinto" y GATE §9.1) construían el objeto sin los nuevos campos requeridos → `tsc -b` habría fallado.
- **Fix:** Añadido `titulo: null, etapa: null` a ambos fixtures (honest-state, no fabricado).
- **Files modified:** app/components/votos-por-parlamentario.test.tsx
- **Commit:** 40e0d2f

**2. [Rule 3 - Blocking] Test AGRUPA asumía etapas siempre visibles**
- **Found during:** Task 1 (el colapso por defecto oculta las etapas)
- **Issue:** El test existente "AGRUPA dos votos del mismo boletín" asertaba visibilidad de "Primer trámite"/"Tercer trámite", que ahora quedan colapsadas por defecto.
- **Fix:** Añadido `votosVer: "18296-05"` al fixture del test para abrir el detalle de ESE arco y conservar la aserción de agrupación.
- **Files modified:** app/components/votos-por-parlamentario.test.tsx
- **Commit:** 551d604 (RED) / 269ee67 (GREEN)

## Threat Register Compliance

- **T-51-05** (Tampering `?votosVer`): normalizado vía el patrón del repo (`Array.isArray → [0]`, trim → null); usado SOLO como comparación de igualdad contra boletines conocidos, nunca interpolado en SQL. Mitigado.
- **T-51-06** (Information Disclosure rebeldías): el consumidor sólo lee campos de `RebeldiaRow` (derivado público del RPC); título viene del RPC, no de una query nueva; cero partido/rut. Mitigado.
- **T-51-07** (dato falso pre-apply): `titulo` null → fallback boletín; nunca fabrica título. Mitigado.
- **T-51-SC** (npm installs): cero dependencias nuevas. Aceptado.

## TDD Gate Compliance

Task 1 (`tdd="true"`): RED (`551d604` test que falla) → GREEN (`269ee67` feat que pasa). Gate cumplido.

## Notes / Handoff

- **Dependencia de operador (heredada de 51-01):** la migración 0047 (`rebeldias_de_parlamentario` con título/etapa) está ESCRITA pero NO aplicada a PROD (checkpoint operador diferido). Este plan degrada honesto pre-apply: mientras 0047 no esté aplicada, el RPC vigente (0019) NO emite `titulo`/`etapa` → llegan null → fallback al boletín. Al aplicar 0047, los títulos aparecen sin cambio de código.
- Sin stubs: el fallback al boletín es degradación honesta documentada, no un placeholder.

## Self-Check: PASSED

- FOUND: app/components/votos-por-parlamentario.tsx (resumenDeArco, buildVotosVerHref, votosVer)
- FOUND: app/components/voto-ficha-row.tsx (dead path B24 removido)
- FOUND: app/lib/types.ts (RebeldiaRow con titulo/etapa)
- FOUND: app/components/votos-por-parlamentario.test.tsx (+9 tests)
- FOUND commit 551d604 (test RED), 269ee67 (feat Task 1), 40e0d2f (feat Task 2)
