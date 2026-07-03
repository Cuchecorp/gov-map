---
phase: 51-leg2-legibilidad-profunda
plan: 03
subsystem: frontend
tags: [patrimonio, legibilidad, SC3, SC4, LEG2, anti-insinuacion]
requires:
  - seriePatrimonio (chart F46, misma fuente de verdad)
  - RPC comparar_declaraciones / declaraciones_de_parlamentario / bienes_de_parlamentario (ya en PROD)
provides:
  - esUriCplt (filtro de valores-URI CPLT, reusable)
  - tarjeta-resumen por versión de patrimonio (conteos por categoría)
  - comparador form GET nativo (SC4, cero JS)
affects:
  - app/components/patrimonio-de-parlamentario.tsx
tech-stack:
  added: []
  patterns:
    - "Filtro de ruido de fuente por URI absoluta genérica (^https?://), NO por host hardcodeado (drift-proof)"
    - "Detalle progresivo server-driven: tarjeta-resumen + detalle bajo ?ver=<versionId>"
    - "form method=get nativo cero-JS para comparación SSR (?a/?b con compat ?comparar=A,B)"
key-files:
  created: []
  modified:
    - app/components/patrimonio-de-parlamentario.tsx
    - app/components/patrimonio-de-parlamentario.test.tsx
decisions:
  - "esUriCplt filtra por URI absoluta genérica /^https?:\\/\\// (Open Question 3 LOCKED), no por host CPLT, para resistir drift del host"
  - "Conteos de la tarjeta derivan de seriePatrimonio([version])[0] — misma fuente de verdad que el chart F46 (LOCKED por CONTEXT)"
  - "El comparador muestra el form cuando fechasDisponibles>=2 y la tabla cuando columnas>=2 (independientes): así el deep-link ?comparar sigue rindiendo sin form y ningún test existente se rompió al hacer fechasDisponibles opcional"
metrics:
  duration: ~10min
  completed: 2026-07-03
  tasks: 2
  files: 2
---

# Phase 51 Plan 03: Patrimonio tarjeta-resumen + comparador (SC3/SC4) Summary

Cada versión de declaración de patrimonio pasa de un `<dl>` volcado con valores-URI basura a una tarjeta-resumen legible (título + fecha Mono prominente + conteos por categoría desde `seriePatrimonio`), con todo valor-URI de CPLT filtrado por `esUriCplt`; el comparador deja de ser solo deep-link y se cablea con un `<form method="get">` nativo cero-JS.

## What Was Built

**Task 1 — `esUriCplt` + tarjeta-resumen (SC3, TDD):**
- Helper puro exportado `esUriCplt(valor)` = `/^https?:\/\//.test(valor.trim())`: URI absoluta genérica, no host hardcodeado (drift-proof; Open Question 3 LOCKED). Filtra el par completo en `paresDeContenido` (bienes) y `camposVisibles` (campos) — el valor-URI nunca aparece en tarjeta NI en detalle (B3, T-51-08). La trazabilidad queda por ProvenanceBadge.
- `VersionRow` reconvertida en tarjeta-resumen: `<h3>` "Declaración de {tipo}", "Presentada el {fecha}" (Mono, prominente), conteo-resumen por categoría ("{n} inmuebles · {n} valores · …", Mono) derivado de `seriePatrimonio([version])[0]` — misma fuente de verdad que el chart F46. Superficie `rounded-lg border bg-card p-6`.
- El `<dl>` completo de campos + `BienesDeVersion` nunca se vuelca inline: solo se renderiza bajo `?ver=<versionId>` (patrón `buildVerHref` existente); si no está abierta, un enlace "Ver detalle de la declaración".
- `HistoricalCaveat` ámbar y `AtribucionCcBy` conservados (reusados, no duplicados).

**Task 2 — comparador form GET nativo (SC4):**
- `<form method="get" action="/parlamentario/{id}">` con dos `<select>` (name `a`/`b`) de las fechas de presentación (labels Mono) + botón submit "Comparar" (`min-h-11`, petróleo `bg-accent-product`). Label "Elige dos fechas para comparar". Cero JS (sin onClick/onSubmit).
- `PatrimonioSection` lee `?a`/`?b` con prioridad, manteniendo compat con el deep-link histórico `?comparar=A,B` (si vienen `a`+`b` úsalos; si no, `comparar`). Pasa `fechasDisponibles` (fechas únicas no-nulas de todas las versiones).
- Con <2 versiones (`fechasDisponibles.length<2` y sin comparación en curso) el form se OMITE y queda el hecho neutro existente "Se necesita más de una versión para comparar." — cero contradicción con el label.
- La tabla de comparación se mantiene solo-datos, CERO veredicto/delta; campo ausente = "No declarado en esta versión".

## Verification

- `pnpm --dir app test -- --run patrimonio-de-parlamentario` — 432 verde (era 422 baseline + 10 nuevos/actualizados).
- `pnpm --dir app exec tsc -b` — limpio (exit 0).
- Negative-match banned-vocab ejercido sobre el copy nuevo de tarjeta y comparador (PROHIBIDO_VEREDICTO / PROHIBIDO_CONECTIVO).

## Deviations from Plan

None - plan executed exactly as written. Nota de diseño (no desviación): el fixture default `tipo` se cambió de "Declaración de patrimonio" a "periódica" (valor realista de la fuente: periódica/rectificación/cese) para que el título "Declaración de {tipo}" no duplicara la palabra; ningún assert dependía del valor previo.

## TDD Gate Compliance

- RED: `test(51-03)` commit `1f9f170` — 7 tests failing (esUriCplt no exportado + card sin implementar).
- GREEN: `feat(51-03)` commit `6a5f430` — implementación, 428 verde.
- Task 2 (type auto, no-TDD): `feat(51-03)` commit `7767f6c` — form + tests + wiring, 432 verde.

## Threat Model Compliance

- T-51-08 (Information Disclosure, valores-URI CPLT): mitigado — `esUriCplt` excluye todo valor `^https?://` de tarjeta Y detalle.
- T-51-09 (Tampering ?a/?b): las fechas se pasan como argumentos a `.rpc(comparar_declaraciones)` (parametrizado por supabase-js), nunca SQL crudo; `single()`/split saneados.
- T-51-10 (Repudiation <2 versiones): form omitido + hecho neutro; campo ausente = "No declarado en esta versión".
- T-51-SC (npm installs): cero deps nuevas.

## Notes for Downstream

- Los cambios son solo-frontend (presentación pura + wiring server-side de searchParams). Cero DDL, cero RPC nueva, cero flag flip, cero `.env`. Camino A intacto.
- El deploy a Cloudflare (build Docker Linux) queda como checkpoint de operador, agregado con el resto de la fase 51.
