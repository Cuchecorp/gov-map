---
phase: 115-link-ext-patrones-de-link-a-fuente-oficial
verified: 2026-07-28T04:10:00Z
status: passed
score: 12/12 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: none
  previous_score: n/a
---

# Phase 115: LINK-EXT — Patrones de link a fuente oficial — Verification Report

**Phase Goal:** Todo enlace a la fuente oficial que el sitio genera está validado sin martillar los servidores gubernamentales: por construcción del patrón + muestra live estratificada por tipo.
**Verified:** 2026-07-28T04:10:00Z
**Status:** passed
**Re-verification:** No — initial verification
**Method:** artifact + code + test evidence only. Zero requests issued to government hosts by this verification.

## Goal Achievement

### Observable Truths (ROADMAP SC + 3 plans' must_haves, merged)

| #  | Truth | Status | Evidence |
| -- | ----- | ------ | -------- |
| SC1 | Cada patrón enumerado con fuente, plantilla, parámetro y caso real | ✓ VERIFIED | `115-PATRONES.md` §1 (27 patrones, 30 KB); `115-VEREDICTO.md` §2 cierra 28 filas (P-03 aporta 2), cero patrones sin veredicto |
| SC2 | Muestra live estratificada ≥1 caso por patrón y por host, rate-limit 2-3s, UA identificatorio, robots.txt, cero ráfagas | ✓ VERIFIED | Recomputado por el verificador desde `115-MUESTRA.json`: 19 registros, 6 hosts, 18 patrones probados. **Gap mínimo intra-host medido `ts_fin[i-1]→ts_inicio[i]`: opendata 2507 ms, tramitacion.senado 2504 ms, web-back 2507 ms, leylobby 2499 ms.** `meta.delay_ms=2500`, `meta.user_agent` con URL de contacto. Cero ráfagas |
| SC3 | Todo patrón roto o genérico corregido, o su limitación declarada honestamente en la UI | ✓ VERIFIED | A-1 en `buscar-filtros.tsx:502`, A-2 en `timeline-event.tsx:33` (`safeExternalHref(enlaceHumanoProyecto(...))`), A-3/A-4/A-5 declarados vía `app/lib/recurso-no-humano.ts`; A-6 = retiro robots; A-5 (ingesta) en `deferred-items.md` D-115-01 |
| SC4 | El resultado distingue "patrón malo" de "fuente caída / WAF" | ✓ VERIFIED | `115-VEREDICTO.md` §1 taxonomía cerrada + regla LOCKED "un WAF no absuelve"; recuento `OK 9 · PATRON-MALO 10 · FUENTE-CAIDA-WAF 0 · sin-probe 9`, consistente con los http_code del JSON crudo |
| P1-T1 | Lector ve por patrón: fuente, plantilla verbatim, parámetro, caso real de PROD | ✓ VERIFIED | `115-PATRONES.md` §1 tabla completa con query verbatim de PROD |
| P1-T2 | Familias no emitidas al DOM excluidas con razón declarada | ✓ VERIFIED | `115-PATRONES.md` §2 tabla de exclusiones |
| P1-T3 | robots.txt de cada host registrado ANTES de cualquier otro recurso | ✓ VERIFIED | `115-ROBOTS.txt` con comando/respuesta/veredicto por host; gate de orden ejecutable en el runner (`violacionesRobots`), no comentario |
| P1-T4 | Runner reproducible ≥2s/host con timestamps que lo prueban | ✓ VERIFIED | `scripts/probar-links-externos.mjs:96` `DELAY_MS = 2500`; timestamps recomputados arriba |
| P2-T1 | ≥1 respuesta live por patrón y por host del manifiesto vigente | ✓ VERIFIED | 19/19 casos, 6/6 hosts, 18/18 patrones probables |
| P2-T3 | Un veredicto de taxonomía cerrada por patrón; sin-probe acotada por gate | ✓ VERIFIED | 9 sin-probe, cada uno citando `Disallow: /` verbatim; self-check (6b)/(6c) prueba que reintroducir un caso de camara.cl sería NEGADO por código |
| P2-T4 | Candidatos #1 (/buscar wspublico) y #2 (timeline) con veredicto y evidencia | ✓ VERIFIED | P-27 → PATRON-MALO → A-1; P-24 → PATRON-MALO → A-2; ambos con snippet XML vacío |
| P3-T4 | Suite en baseline, tsc 0, guards verdes; deploy declarado diferido a 125 | ✓ VERIFIED | Ejecutado por el verificador: `tsc -b` exit 0; `vitest run` → **107 files / 1467 tests passed**; `probar-links-externos.selfcheck.mjs` exit 0. Deploy diferido declarado en `115-VERIFICACION.md` SC3 |

**Score:** 12/12 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `115-PATRONES.md` | Universo + exclusiones + manifiesto | ✓ VERIFIED | 30 KB; `CASOS_MANIFIESTO: 19` / `HOSTS_MANIFIESTO: 6` |
| `115-ROBOTS.txt` | robots por host + retirados | ✓ VERIFIED | `RETIRADOS: 8 ids` del host `www.camara.cl`; **ambas lecturas del robots documentadas** (A = RFC 9309, B = literal), se adopta la conservadora B con razón escrita |
| `scripts/probar-links-externos.mjs` | Runner curl-first rate-limited | ✓ VERIFIED | 26 KB, ejecutable; contiene `MSYS_NO_PATHCONV`, `DELAY_MS`, `USER_AGENT`, gate robots por parseo |
| `115-MUESTRA.json` / `.txt` | Registros crudos + tabla legible | ✓ VERIFIED | `meta` + 19 `registros` con `ts_inicio`/`ts_fin`/`http_code`/`url_effective`/`snippet` |
| `115-VEREDICTO.md` | Veredicto cerrado + acciones | ✓ VERIFIED | `## 2. Veredicto por patrón` presente; §4 lista cerrada A-1..A-6 |
| `app/components/buscar-filtros.tsx` | sourceUrl vía `enlaceHumanoProyecto` | ✓ VERIFIED | `:27` import, `:502` aplicación |
| `app/components/timeline-event.tsx` | href vía `safeExternalHref` | ✓ VERIFIED | `hrefFuenteDeEvento()` compone rewrite + guard anti-XSS; null → no se emite `<a>` |
| `app/components/timeline-view.tsx` | threading del boletín | ✓ VERIFIED (con desviación justificada) | Ver Key Links |
| `app/lib/recurso-no-humano.ts` | Módulo compartido (post-review CR-01) | ✓ VERIFIED | `LEYENDA_RECURSO_NO_HUMANO` + `esServicioDeDatos()` por host+segmento de path (IN-05), fail-safe `false` en URL malformada |
| `115-VERIFICACION.md` | Evidencia antes/después + 4 SC | ✓ VERIFIED | `## Veredicto por success criterion` presente, 4 SC con veredicto |
| `deferred-items.md` | Deuda A-5 declarada | ✓ VERIFIED | D-115-01, 9.441 filas, dueño futuro nombrado |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| `115-PATRONES.md` | `113-INVENTARIO.md` | cita builder/tabla.columna | ✓ WIRED | filas citan `§3.2`/`§3.3.3` |
| runner | `115-PATRONES.md` §4 | array `CASOS` con ids P-NN-cNN | ✓ WIRED | ids del JSON coinciden 1:1 con el manifiesto |
| `115-VEREDICTO.md` | `115-MUESTRA.json` | cada veredicto cita id + http_code | ✓ WIRED | verificado contra los códigos crudos |
| `buscar-filtros.tsx` | `validacion-fuente.tsx` | import `enlaceHumanoProyecto` | ✓ WIRED | `:27` |
| `timeline-view.tsx` | `timeline-event.tsx` | prop `boletin` en ambos call-sites | ⚠️ DESVIACIÓN JUSTIFICADA — no es gap | El boletín **no se threadea por prop**: viaja dentro de la fila (`TramitacionEventoRow.boletin: string` no-nulable, `lib/types.ts:32-33`). Efecto idéntico, menos superficie; documentado en el JSDoc de `hrefFuenteDeEvento`. Ambos call-sites (`:264`, `:273`) reciben `evento` con boletín |
| `115-VERIFICACION.md` | `115-VEREDICTO.md` §4 | una entrada por acción | ✓ WIRED | A-1..A-6 cubiertas |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| `timeline-event.tsx` | `hrefFuente` | `evento.enlace` (PROD, `tramitacion_evento`) → rewrite → guard | Sí — el rewrite se prueba contra URLs reales de la muestra | ✓ FLOWING |
| `buscar-filtros.tsx` | `sourceUrl` | `row.enlace` + `row.boletin` del mismo `.map` | Sí — sin threading nuevo | ✓ FLOWING |
| `recurso-no-humano.ts` | `esServicioDeDatos` | host+path de la URL real | Sí — lista cerrada derivada de `115-MUESTRA.json` | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Typecheck limpio | `pnpm exec tsc -b` | exit 0, sin salida | ✓ PASS |
| Suite en baseline | `pnpm exec vitest run` (app) | 107 files / **1467 tests passed** | ✓ PASS |
| Gate robots muerde | `node scripts/probar-links-externos.selfcheck.mjs` | exit 0; (6a) 19 casos permitidos, (6b) camara.cl `Disallow: /`, (6c) reintroducción NEGADA por código | ✓ PASS |
| Rate-limit real | recomputo de `ts_inicio`/`ts_fin` del JSON | min gap 2499 ms (≥2000) en los 4 hosts multi-caso | ✓ PASS |
| Live probes contra hosts gubernamentales | — | NO ejecutados (instrucción explícita) | ? SKIP |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| LINK-03 | 115-01/02/03 | Todo patrón de link externo validado por construcción + muestra live estratificada (rate-limit 2-3s/host), con hallazgos corregidos | ✓ SATISFIED | SC1-SC4 verificados arriba; `REQUIREMENTS.md:13` `[x]`, `:63` Phase 115 → Complete |

Sin requisitos huérfanos: `REQUIREMENTS.md` mapea sólo LINK-03 a la Phase 115.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| — | — | Escaneo `TBD\|FIXME\|XXX` sobre los 7 archivos de código modificados | — | **Cero hallazgos.** Gate de debt markers: verde |

Nota: la deuda de ingesta A-5 **no** es un marcador suelto — está formalizada en `deferred-items.md` como D-115-01 con evidencia, alcance (9.441 filas) y dueño futuro, y su limitación queda declarada en la UI.

### Human Verification Required

Ninguna. La única limitación viva —los fixes están verificados **en código y en test**, no observados contra el deploy real— es la **decisión LOCKED del rector de v12.0** de diferir el deploy a la Phase 125. Está declarada honestamente en `115-VERIFICACION.md` SC3 y no constituye gap ni acto humano pendiente de esta fase.

### Gaps Summary

Ninguno. Los tres planes entregan artefactos sustantivos, no stubs: el manifiesto cierra el denominador (19 casos / 6 hosts vigentes tras el retiro conservador de `www.camara.cl` con ambas lecturas del robots documentadas), la muestra live prueba su propio rate-limit con timestamps que el verificador recomputó de forma independiente, el veredicto 9 OK / 10 PATRON-MALO / 0 WAF es consistente con los códigos HTTP crudos, y los fixes A-1/A-2 más la leyenda A-3/A-4 están efectivamente cableados en las superficies (incluido el timeline, vía el módulo compartido `app/lib/recurso-no-humano.ts` que la review CR-01 introdujo para no duplicar el copy). La review de fase cerró 13/13. La honestidad del régimen se sostiene: el linter anti-insinuación importa la constante **real** (WR-02) en vez de una copia, y el gate robots niega por código (WR-01) en vez de por comentario.

---

_Verified: 2026-07-28T04:10:00Z_
_Verifier: Claude (gsd-verifier)_
