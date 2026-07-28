---
phase: 117-fecha-fix-etiquetas-de-fecha-corregidas
verified: 2026-07-28T00:00:00Z
status: passed
score: 4/4 success criteria verificados (14/14 hallazgos con disposición; 16/16 must-haves de plan)
overrides_applied: 0
re_verification: null
deferred:
  - truth: "Verificación end-to-end de las fechas sobre el HTML del deploy real"
    addressed_in: "Phase 125"
    evidence: "ROADMAP Phase 125 — 'E2E — Pasada final producto-a-producto sobre el deploy real … links, fechas y cruces re-verificados'"
  - truth: "Los rótulos MONEY corregidos (F-08) verificados contra dato real"
    addressed_in: "flip MONEY (deuda de operador, fuera de v12.0)"
    evidence: "117-DISPOSICION §2(d): gate MONEY OFF, contrato/aporte con 0 filas en PROD"
  - truth: "Saneamiento en DB de las filas 2626-05-25 y normalización de tramitacion_evento.fecha"
    addressed_in: "Phase 119 (CRON-FIX — robustez de ingesta)"
    evidence: "ROADMAP Phase 119 — 'reintentos/backoff, cursores, hash-check, señales freshness'; 117-DISPOSICION §2(a)(b) declara el destino en ingesta"
---

# Phase 117: FECHA-FIX — Etiquetas de fecha corregidas — Verification Report

**Phase Goal:** Ninguna fecha del sitio miente ni queda ambigua: el usuario siempre distingue cuándo pasó el hecho de cuándo lo capturamos.
**Verified:** 2026-07-28
**Status:** passed
**Re-verification:** No — verificación inicial

> Nota de método: los fixes de `117-REVIEW.md` (CR-01, WR-01..WR-06, IN-01/02/05) POST-datan los
> SUMMARY. Todo lo de abajo se verificó contra el **código actual del árbol**, no contra los SUMMARY.

## Goal Achievement

### Observable Truths (Success Criteria del ROADMAP)

| # | Truth | Status | Evidencia |
|---|---|---|---|
| SC1 | Cada hallazgo de 116 está corregido o declarado, sin excepciones silenciosas | ✓ VERIFIED | `117-DISPOSICION.md` §1: 14 filas, `grep -oE "F-(0[1-9]\|1[0-4])" \| sort -u \| wc -l` = **14**, cero celdas vacías. §2 declara con causa y destino los 8 residuales (a…h) + §2(i) el cambio de disposición del code-review. Muestreo de 6 fixes contra código real: todos presentes (ver tabla siguiente). |
| SC2 | Captura con idiom LOCKED "según fuente al…", jamás como el hecho; "captura" pelado prohibido | ✓ VERIFIED | `provenance-badge.tsx:126-135` rinde `según fuente al ` / `recalculado por el Observatorio al `. `grep "Actualizado"` en `app/components`+`app/app` (sin tests/comentarios) ⇒ **vacío**. `grep "corte al"` ⇒ **vacío**. `grep "según fuente al"` ⇒ **13** ocurrencias. `grep` de `captura` pelado ⇒ solo JSDoc/comentarios e identificadores (`fecha_captura`, `capturedAt`), **cero copy renderizado**. |
| SC3 | Guards de régimen verdes tras los cambios de texto | ✓ VERIFIED | Ejecutado: `lib/anti-insinuacion-guard.test.ts` **40/40 ✓** con `SUPERFICIES_FECHA` (20 rutas) SUMADO al scan (`...SUPERFICIES_FECHA` en `:805`). Además verdes: `money-antiflip` 20, `notif-antiflip` 20, `vsim-antiflip` 20, `lockdown` 22, `bento-guards` 114, `bento-coherencia` 8, `name-match-rut` 15, `env-example` 16, `co-votacion-red` 14, `busqueda-hibrida-gate`/`admin-gate`/`cruces-gate`/`vsim-gate`/`money-gate` 5 c/u. |
| SC4 | Suite app + packages y typecheck verdes | ✓ VERIFIED | **Ejecutado por el verificador**: `pnpm --filter ./app test` ⇒ exit 0, **107 archivos / 1560 tests passed**. `pnpm -r --filter "./packages/*" test` ⇒ exit 0, 18 paquetes verdes. Typecheck: `tsc -b` en root ⇒ exit 0; `tsc --noEmit` en `app/` ⇒ exit 0. |

**Score:** 4/4 success criteria · 14/14 hallazgos con disposición.

> **Nota de entorno (no es un gap del código):** en el árbol de verificación `app/node_modules`
> estaba **vacío** (virtual store presente, symlinks perdidos — sync OneDrive), y pnpm reportaba
> "Already up to date", por lo que `pnpm test` abortaba en el filtro `app` y `tsc` no resolvía
> módulos. Se reparó con `rm -rf app/node_modules node_modules/.modules.yaml && pnpm install --force`
> (solo `node_modules`; **cero archivos del repo tocados**). Tras eso, suite y typecheck verdes.

### Muestreo de fixes contra el código actual (6 pedidos + extras)

| fix | archivo:línea verificada | evidencia |
|---|---|---|
| **F-01** chokepoint | `provenance-badge.tsx:130-131` | ternario `origenFecha === "recalculo" ? "recalculado por el Observatorio al " : "según fuente al "`; `grep "Actualizado"` en el archivo solo en JSDoc (`:78`). |
| **F-09 + CR-01** año en históricas | `dia-calendario.ts:115` `fechaCivilCorta` · `estado-actual-block.tsx:403,407,544,579,588` | `fechaCivilCorta` delega en `diaCalendarioCitacion` (parte fecha UTC, **cero conversión de zona**) y añade el año; texto y `aria-label` pareados (IN-01 hoisting). |
| **F-04 + WR-02** orden del evento implausible | `timeline-view.tsx:68` (`fechaPlausible(d) ? d : null`) · `:157-164` comparador sin `?? 0` · `timeline-event.tsx:100` guard local | las implausibles van al FINAL en orden estable (sort ES2019), sin epoch 0 fabricado; el rango de un run usa solo fechas válidas (`:195-199`). |
| **WR-01** ternario votos | `votos-por-parlamentario.tsx:512` `fechaHechoCortaSegura(e.fecha, "")` + `:544` rótulo compuesto dentro del ternario | fallback **vacío** ⇒ el `<span>` "Votada el" se omite entero; nunca "Votada el fecha no informada". |
| **F-12** chip año con rama nula | `search-result-card.tsx:76` `{anio != null ? \`primer trámite ${anio}\` : "Sin dato"}` · `buscar-filtros.tsx:399` `Año del primer trámite` | el rótulo se compone SOLO en la rama no-nula; el estado vacío queda pelado. |
| **CR-02** guard de Date inválido | `format.ts:84-85` `if (Number.isNaN(d.getTime())) return fallback;` dentro de `fechaHechoCorta`, con `fallback` propagado desde `fechaHechoCortaSegura` (`:106+`) | fail-safe en el chokepoint, patrón de `fechaCortaSegura`; **WR-04** verificado en `:122-126` (acepta `[T ]` y expande `+00` → `+00:00` anclado a `\d{2}:\d{2}`). |
| F-02 (extra) | `cruces-de-parlamentario.tsx:205` · `cruces-de-proyecto.tsx:184` | `origenFecha="recalculo"` presente en ambas. |
| F-03 (extra) | `app/proyecto/[boletin]/page.tsx:519` | `notaAgregacion="evento más reciente"`. |
| F-06 (extra) | `actualidad-module.tsx:452` | `Última consulta a las fuentes` (el copy viejo no existe). |
| F-07 (extra) | `capa1/tramitacion-stepper.tsx:112` `{" — "}` · `timeline-event.tsx:102` `Hito del` · `lobby-*.tsx:161,489,131` `Reunión del` | las dos variantes declaradas en §2(f) están en el árbol. |
| F-08 (extra) | 4 superficies MONEY | `la fuente cubre hasta el` ×4 y `nuestra ingesta llega hasta el` ×2; `corte al` ⇒ **0**. |
| F-10 (extra) | `format.ts:30` `timeZone: "UTC"` · `:43` `America/Santiago` · `timeline-view.tsx:41` `timeZone:"UTC"` | `grep -c 'America/Santiago' app/lib/format.ts` = **1** (solo la rama hora-real). |
| F-11 (extra) | `113-INVENTARIO.md:663,1069` | `grep -ciE "48 *h"` ⇒ **0**; aparece **14 días** con cita a `app/lib/format.ts:10`. |
| F-13 (extra) | `estado-actual-block.tsx` | `grep -c relativeTimeEs` = **0**. |
| F-14 + WR-05 (extra) | `panel-actualidad.tsx:122` `return fechaCivilCorta(iso);` | un solo formato con año en las dos ramas del panel. |

### Required Artifacts (must_haves de los 4 planes)

| Artifact | Esperado | Status | Detalle |
|---|---|---|---|
| `app/lib/format.ts` | `fechaPlausible` + `fechaHechoCorta(Segura)` + timeZone | ✓ VERIFIED | `:84`, `:106`, `:170`, `:30`, `:43`. |
| `app/components/provenance-badge.tsx` | idiom LOCKED + `origenFecha`/`notaAgregacion` | ✓ VERIFIED | `:126-135`, props documentadas `:72-86`. |
| `app/lib/anti-insinuacion-guard.test.ts` | `SUPERFICIES_FECHA` declarada | ✓ VERIFIED | `:491-511` (20 rutas), spread real en `:805`. |
| `app/components/estado-actual-block.tsx` | date-only + guard + urgencia sin relativo | ⚠️ VERIFIED (supersesión documentada) | El plan 02 pedía `contains: badgeFechaCitacion`; el código usa **`fechaCivilCorta`** por **CR-01** (§2(i)). `fechaCivilCorta` delega en `diaCalendarioCitacion` ⇒ la verdad de fondo ("date-only sin conversión de zona") se cumple y **mejora** (añade el año en superficies históricas). El literal del frontmatter quedó stale, no el código. |
| `app/app/proyecto/[boletin]/page.tsx` | `notaAgregacion` | ✓ VERIFIED | `:519`. |
| `app/components/timeline-view.tsx` | `fechaValida` + `timeZone: UTC` | ✓ VERIFIED | `:68`, `:41`. |
| `app/components/cruces-de-parlamentario.tsx` | `origenFecha` | ✓ VERIFIED | `:205`. |
| `app/components/financiamiento-de-parlamentario.tsx` | fuente vs ingesta | ✓ VERIFIED | `:225`, `:366`. |
| `117-DISPOSICION.md` | tabla F-01..F-14 + evidencia + commit | ✓ VERIFIED | 14 ids únicos, columnas ANTES/DESPUÉS/commit pobladas; >60 líneas. |
| `app/components/panel-actualidad.tsx` | rótulo legible es-CL | ⚠️ VERIFIED (supersesión documentada) | Mismo caso: `contains: badgeFechaCitacion` stale; el código usa `fechaCivilCorta` por **WR-05** (§2(i)) — con año, coherente entre las dos ramas. |

### Key Link Verification

| From | To | Via | Status |
|---|---|---|---|
| `provenance-badge.tsx` | `lib/format.ts` | `fechaCorta` | ✓ WIRED |
| `anti-insinuacion-guard.test.ts` | `TODAS_LAS_SUPERFICIES` | `...SUPERFICIES_FECHA` (`:805`) | ✓ WIRED — el scan real cubre las 20 rutas de la fase |
| `timeline-view.tsx` | `lib/format.ts` | `fechaPlausible` (`:7`) | ✓ WIRED |
| `estado-actual-block.tsx` | `lib/dia-calendario.ts` | `diaCalendarioCitacion` / `fechaCivilCorta` (`:3`) | ✓ WIRED (vía `fechaCivilCorta`, ver supersesión) |
| `cruces-de-parlamentario.tsx` | `provenance-badge.tsx` | `origenFecha="recalculo"` | ✓ WIRED |
| `votacion-card.tsx` | `lib/format.ts` | `fechaHechoCorta` | ✓ WIRED |
| `117-DISPOSICION.md` | `116-FECHAS-AUDIT.md §3` | una fila por hallazgo | ✓ WIRED — 14/14 |

### Data-Flow Trace (Level 4)

| Artifact | Variable | Fuente | Dato real | Status |
|---|---|---|---|---|
| `provenance-badge.tsx` | `capturedAt` | prop desde 17 call-sites (RPC `fecha_captura`) | sí | ✓ FLOWING |
| `estado-actual-block.tsx` | `citacionVigente.fecha`, `enTablaSala[].fecha` | RPC de agenda | sí | ✓ FLOWING |
| `timeline-view.tsx` | `eventos[].fecha` | `tramitacion_evento` (48.368 filas, min `1995-01-10` — WR-03) | sí | ✓ FLOWING |
| `search-result-card.tsx` | `anio` | `buscar-filtros.tsx:495` `anio={row.anio}` | sí — la premisa "prop muerta" del audit quedó refutada (§2(g)) | ✓ FLOWING |
| superficies MONEY (4) | `fechaCorteTexto` | `contrato`/`aporte`: **0 filas en PROD**, gate OFF | no | ⚠️ declarado §2(d) — deferred al flip |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|---|---|---|---|
| Suite `app` | `pnpm --filter ./app test` | exit 0 — 107 archivos / **1560 passed** | ✓ PASS |
| Suite `packages/*` | `pnpm -r --filter "./packages/*" test` | exit 0 — 18 paquetes verdes | ✓ PASS |
| Typecheck root | `node node_modules/typescript/bin/tsc -b` | exit 0 | ✓ PASS |
| Typecheck app | `node ../node_modules/typescript/bin/tsc --noEmit` (en `app/`) | exit 0 | ✓ PASS |
| Guard anti-insinuación | incluido en la suite | 40/40 ✓ | ✓ PASS |
| `Actualizado` en copy | `grep -rn "Actualizado" app/components app/app --include=*.tsx \| grep -v .test. \| grep -v '^\S*: *[*/]'` | vacío | ✓ PASS |
| `corte al` en MONEY | `grep -rn "corte al" app/components --include=*.tsx \| grep -v .test.` | vacío | ✓ PASS |
| idiom LOCKED | `grep -rn "según fuente al" …` | 13 | ✓ PASS |
| `America/Santiago` en `format.ts` | `grep -c` | **1** | ✓ PASS |
| Flags/.env intactos | `git diff --name-only d560d64..HEAD \| grep -iE "\.env\|gate\|PUBLIC_ENABLED"` | **vacío** (70 commits en el rango) | ✓ PASS |

### Probe Execution

No aplica: la fase no declara probes (`scripts/*/tests/probe-*.sh` no referenciado en PLAN/SUMMARY;
tampoco es fase de migración/tooling). La verificación ejecutable es la suite + los greps de arriba.

### Requirements Coverage

| Requirement | Source Plan | Descripción | Status | Evidencia |
|---|---|---|---|---|
| FECHA-02 | 117-01..04 | "Toda etiqueta de fecha incorrecta o ambigua queda corregida ('según fuente al…' donde corresponda)" | ✓ SATISFIED | SC1..SC4 verificados; 14/14 hallazgos con disposición; idiom LOCKED en el chokepoint y en las 13 ocurrencias del árbol. `REQUIREMENTS.md:65` ya lo mapea a Phase 117 = Complete. |

Sin requisitos huérfanos: `REQUIREMENTS.md` mapea a Phase 117 exclusivamente FECHA-02.

### Anti-Patterns Found

| File | Line | Pattern | Severidad | Impacto |
|---|---|---|---|---|
| — | — | `TBD` / `FIXME` / `XXX` en archivos tocados por la fase | — | **ninguno**: cero marcadores de deuda sin referencia formal en los 25 archivos revisados. |
| `117-01-PLAN.md` / `117-04-PLAN.md` | frontmatter `must_haves.artifacts[].contains` | literal `badgeFechaCitacion` stale tras CR-01/WR-05 | ℹ️ Info | El PLAN no se re-escribió al aplicar la supersesión del code-review. El **código** es correcto y la supersesión está documentada en `117-DISPOSICION.md` §2(i) y `117-REVIEW.md`. No afecta comportamiento ni el goal. |

### Human Verification Required

Ninguna que bloquee esta fase. Lo que requiere ojo humano está **declarado y deferido** por el
propio alcance de 117 (§5) y cubierto por fases posteriores del milestone:

- Fechas sobre el HTML del **deploy real** → **Phase 125** (E2E). 117 prueba render en jsdom +
  source-scan + grep reproducible sobre el árbol; el deploy no viaja en esta fase.
- Rótulos MONEY (F-08) sobre **dato real** → al momento del flip legal (gate OFF, 0 filas en PROD).
- **IN-04** (¿el idiom "según fuente al…" se explica SIEMPRE o NUNCA?) → decisión de producto de
  alcance sitio completo, declarada con causa en `117-REVIEW.md`; **no** es un hallazgo de 116, así
  que no afecta SC1.
- **IN-03** (borrar el huérfano `actualidad-module.tsx`) → declarado en §2(c) con destino "fase de
  limpieza de huérfanos"; el copy de fechas se corrigió igual, de modo que el veredicto de 117 vale
  si alguien re-monta el componente.

Los 2 findings `skipped` del review están, por tanto, **declarados con causa y destino** — cumplen la
regla "cero excepciones silenciosas" de SC1.

### Gaps Summary

Sin gaps. El goal se verifica en el árbol, no en los SUMMARY:

1. **El sitio ya no confunde el hecho con la captura.** El chokepoint (`ProvenanceBadge`) rinde el
   idiom LOCKED y nombra el recálculo como recálculo (`origenFecha`) y el MAX como MAX
   (`notaAgregacion`); `Actualizado` desapareció del copy renderizado.
2. **Las fechas del hecho dejan de mentir por huso.** `fechaHechoCorta` ramifica por presencia de
   hora en vez de convertir a ciegas (45.618 date-only disfrazadas vs 7.603 con hora real), y
   `format.ts` tiene una sola aparición de `America/Santiago` — la rama hora-real. La regla date-only
   LOCKED (parte fecha UTC, cero conversión) sigue intacta en `dia-calendario.ts`.
3. **La fecha implausible ya no se apropia de la cronología.** `fechaPlausible` filtra el render y el
   comparador manda las implausibles al final sin fabricarles un 1970 (WR-02); el hecho sigue visible.
4. **El régimen se endureció, no se relajó.** El linter anti-insinuación pasó a escanear 20 rutas más
   y sigue 40/40; el único crecimiento de `NEGACIONES_LOCKED` fue una decisión explícita registrada
   (§2h), con `TERMINOS_PROHIBIDOS` sin cambios.
5. **Lo que 117 no cerró está declarado con causa y destino** (8 puntos en §2 + los 2 findings
   skipped), y la disposición que el code-review cambió (F-09/F-14 → `fechaCivilCorta` con año) está
   registrada en §2(i) para que la Phase 125 no la lea como inconsistencia.

Única observación (Info, no bloqueante): dos `contains` del frontmatter de PLAN quedaron stale
respecto de la supersesión CR-01/WR-05. El código es el correcto.

---

_Verified: 2026-07-28_
_Verifier: Claude (gsd-verifier)_
