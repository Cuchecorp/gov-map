---
phase: 51-leg2-legibilidad-profunda
reviewed: 2026-07-03T14:00:00Z
depth: deep
iteration: 2
files_reviewed: 26
files_reviewed_list:
  - app/app/layout.test.tsx
  - app/app/layout.tsx
  - app/app/metodologia/page.tsx
  - app/app/proyecto/[boletin]/page.tsx
  - app/components/estado-actual-block.test.tsx
  - app/components/estado-actual-block.tsx
  - app/components/lobby-de-parlamentario.test.tsx
  - app/components/lobby-de-parlamentario.tsx
  - app/components/parlamentario-header.test.tsx
  - app/components/parlamentario-header.tsx
  - app/components/parlamentario-resumen.test.tsx
  - app/components/parlamentario-resumen.tsx
  - app/components/patrimonio-de-parlamentario.test.tsx
  - app/components/patrimonio-de-parlamentario.tsx
  - app/components/timeline-event.tsx
  - app/components/timeline-view.test.tsx
  - app/components/timeline-view.tsx
  - app/components/voto-ficha-row.tsx
  - app/components/votos-por-parlamentario.test.tsx
  - app/components/votos-por-parlamentario.tsx
  - app/lib/lockdown-guard.test.ts
  - app/lib/parlamentario-resumen-conteos.test.ts
  - app/lib/parlamentario-resumen-conteos.ts
  - app/lib/types.ts
  - supabase/migrations/0047_rebeldias_honestas.sql
  - supabase/tests/0047_rebeldias_honestas.test.sql
findings:
  critical: 1
  warning: 2
  info: 2
  total: 5
status: issues_found
---

# Phase 51: Code Review Report — RE-REVIEW (iteración 2, post-fix)

**Reviewed:** 2026-07-03T14:00:00Z
**Depth:** deep
**Files Reviewed:** 26 (foco: los 7 archivos tocados por los fix-commits `5324520..78ecad7` + cross-check contra el resto del scope)
**Status:** issues_found

## Summary

Verificación de los 8 fixes de la iteración 1 (3 Critical + 5 Warnings, commits `5324520..78ecad7`) más búsqueda de regresiones nuevas. Suite completa verde (489/489, 47 archivos); los tres archivos de test tocados pasan; pgTAP 0047 consistente (`plan(10)` = 10 asserts).

**Veredicto por fix de iter1:**

| ID iter1 | Fix | Veredicto |
|---|---|---|
| CR-01 (grant a anon vs 0044) | `5324520`: grant eliminado, prosa "status quo 0019" corregida, pgTAP invertido a `NOT has_function_privilege` — ya consistente con `post-apply/0044_revoke_anon.test.sql` | **RESUELTO** |
| CR-02 (mode() con empate fabrica mayoría) | `db27fd1`: `rank() ... having count(*) = 1` — empate → votación excluida; pgTAP (10) bancada 2/2 → 0 filas | **RESUELTO en el caso empate-limpio**, pero INCOMPLETO ante filas duplicadas de bancada (nuevo **CR-04**, mismo mecanismo de fabricación) |
| CR-03 (bypass multi-función del guard) | `763b677`: exención revertida, guard estricto sin carve-outs + 4 casos sintéticos (incluido el multi-función) | **RESUELTO**; queda un punto ciego hermano preexistente `grant … to public` (**WR-07**) |
| WR-01 (doble revoke) | `8d00080`: `revoke … from public` + `revoke … from anon, authenticated` (idiom 0041), 0047:94-95 | **RESUELTO** |
| WR-02 (`?a`/`?b` → cast `date[]` → 500) | `1c964ec`: filtro `ISO_DATE_RE` + <2 → sin comparación | **INCOMPLETO**: el regex valida SOLO la forma; `?a=2026-99-99&b=2026-98-98` sigue produciendo el 500 (**WR-06**) |
| WR-03 (retiro contado como renovación) | `a4f2afd`: `esRetiroUrgencia` corta el run y se renderiza como hito; copy neutra "N eventos"; 3 tests nuevos | **RESUELTO** |
| WR-04 (rango "ene 1970" fabricado) | `8a7b095`: `desde`/`hasta` solo de fechas válidas, `null` → línea sin rango; tests afirman ausencia de "1970" | **RESUELTO** |
| WR-05 (stripTsComments trunca URLs) | `78ecad7`: lookbehind `(?<!:)\/\//` en lockdown-guard.test.ts y layout.test.tsx, documentado | **RESUELTO** para `http://`/`https://` (residual documentado, IN-07) |

Los invariantes del proyecto se re-verificaron sobre el estado final: Camino A (0047 ya no concede nada a anon; ambos pgTAP ahora afirman deny coherentemente), deny-by-default (doble revoke), SSR-only (cero `"use client"` nuevo), anti-insinuación (empate excluido, retiros fuera del colapso, cero epoch). Quedan 1 Critical y 2 Warnings, todos residuos de fixes incompletos o puntos ciegos hermanos del mismo invariante — no regresiones de comportamiento nuevas.

## Critical Issues

### CR-04: La "mayoría única" de 0047 cuenta FILAS, no parlamentarios — una fila duplicada de bancada fabrica o voltea la mayoría (el mismo defecto que CR-02 dijo eliminar)

**File:** `supabase/migrations/0047_rebeldias_honestas.sql:58-71`
**Issue:** El fix de CR-02 reemplazó `mode()` por `rank() over (... order by count(*) desc) ... having count(*) = 1`, pero `count(*)` en el subquery `conteos` cuenta **filas crudas** de `voto`, no parlamentarios distintos. La propia migración declara que existen "datos con filas repetidas de un mismo parlamentario en una votación" (cabecera, cambio (c)) y por eso deduplica el lado propio con `distinct on` — pero deja el lado **bancada** sin dedupe. Consecuencias concretas y provables:
1. **Empate real roto por un duplicado**: bancada 2 `si` / 2 `no` con una fila `si` duplicada → conteos 3/2 → `having count(*) = 1` se satisface → se emite `mayoria='si'` y los 2 `no` se publican como "votó distinto a la mayoría de su bancada" cuando la bancada estaba EMPATADA. Es exactamente la fabricación que el comentario de la CTE promete que "jamás" ocurre (líneas 53-57).
2. **Mayoría volteada**: 3 `no` / 2 `si` con una fila `si` duplicada dos veces → 4/3 → la mayoría real (`no`) se publica como disidencia para sus 3 miembros.
El pgTAP (10) solo cubre el empate limpio; el caso duplicado-en-bancada no está cubierto (el fixture duplica al REBELDE, cuya inflación 3 `si` / 2 `no` casualmente no cambia el resultado). Bajo la doctrina anti-insinuación (release gate) esto es una afirmación falsa sobre una persona bajo una condición de datos que el propio archivo documenta como real.
**Fix:** Contar parlamentarios distintos, no filas:
```sql
      select v.votacion_id, v.seleccion,
             rank() over (partition by v.votacion_id
                          order by count(distinct v.parlamentario_id) desc) as rk
```
(resto de la CTE intacto). Añadir un caso pgTAP: bancada 2 `si` / 2 `no` donde UNA fila `si` está duplicada → sigue devolviendo 0 filas (el duplicado no rompe el empate). Nota de borde: un parlamentario con filas contradictorias (una `si` y una `no`) contaría en ambas opciones — datos contradictorios; si se quiere, excluir esas votaciones también, pero el `count(distinct)` ya elimina la clase dominante del problema.

## Warnings

### WR-06: El saneo de `?a`/`?b`/`?comparar` valida solo la FORMA — `2026-99-99` pasa el regex y sigue produciendo el 500 que WR-02 debía eliminar

**File:** `app/components/patrimonio-de-parlamentario.tsx:918-920, 984-993`
**Issue:** `ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/` acepta cualquier dígito en cada posición. Verificado en runtime: `ISO_DATE_RE.test('2026-99-99') === true`. Ese valor llega a `comparar_declaraciones(p_id, fechas)` → Postgres `date/time field value out of range` → `cmpError` → `throw` (línea 990) → página de error para TODA la ficha. También `?a=2026-02-30` (que JS incluso normaliza a mar-02 con rollover, pero Postgres rechaza). El fix de iter1 cerró el caso `?a=zzz` pero la clase de ataque (URL manipulada barata y repetible → 500 en ruta pública) persiste con fechas shape-válidas/calendario-inválidas.
**Fix:** Validación semántica round-trip además de la forma (el rollover de V8 obliga al round-trip, un check de NaN solo no basta):
```ts
const esFechaISOValida = (f: string): boolean => {
  if (!ISO_DATE_RE.test(f)) return false;
  const d = new Date(`${f}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === f;
};
fechasComparar = fechasComparar.filter(esFechaISOValida);
if (fechasComparar.length < 2) fechasComparar = [];
```
Alternativa aún más fail-safe (y que además cierra el caso "fechas que no calzan con ninguna versión" de IN-03): intersectar `fechasComparar` con `fechasDisponibles` justo antes del RPC (línea 984 — `fechasDisponibles` ya está computada en la 954, el orden lo permite): solo fechas que EXISTEN como versiones pueden compararse.

### WR-07: El guard estricto sigue ciego a `GRANT … TO public` — anon es miembro implícito de `public`, la misma re-exposición que CR-03 cerró pasa CI por la puerta de al lado

**File:** `app/lib/lockdown-guard.test.ts:198-206`
**Issue:** `anonGrantOffenders` solo matchea `to … anon`. En Postgres, `grant execute on function f(text) to public;` concede EXECUTE a **todos los roles, incluido anon** (`has_function_privilege('anon', …)` pasa a true) — re-abre la superficie REST no autenticada exactamente igual que un grant a anon, y el guard Block A lo deja pasar en silencio. Preexistente (mismo regex desde 42-04, no introducido por el fix), y hoy ninguna migración >0044 lo usa (verificado por grep: los matches de `to public` son `insert into public.…`); la re-corrida periódica del pgTAP post-apply lo detectaría — pero ese es el mismo backstop "residual" que el propio guard documenta como insuficiente por sí solo. Cerrarlo es un cambio de una línea y es el mismo invariante que motivó CR-03.
**Fix:**
```ts
const grantToAnon = /grant\s+\S[\s\S]*?\bto\s+[\w,\s]*\b(anon|public)\b/;
```
(el SQL ya viene en minúscula y sin comentarios; `revoke … from public` no contiene `grant` y no matchea). Añadir el caso sintético al test de la regla: `grant execute on function public.f(text) to public;` → 1 offender.

## Info

### IN-07: Residual documentado de WR-05 — un `//` dentro de un string NO precedido de `:` sigue truncando la línea escaneada

**File:** `app/lib/lockdown-guard.test.ts:73-85` (mismo idiom en `app/app/layout.test.tsx:30-40`)
**Issue:** La heurística `(?<!:)\/\//` cubre `http://`/`https://` (el caso real del repo) pero un string como `"a//b"` o una URL protocol-relative `"//cdn.x.cl"` en la misma línea que un `.rpc(…)` posterior aún lo ocultaría del escáner. El comentario del código lo declara honestamente como heurística. La dirección de fallo nueva (un comentario real precedido de `:`, p.ej. `case "x"://prosa`, queda SIN stripear) es fail-loud (falso positivo que rompe CI), no fail-silent — aceptable.
**Fix:** Si se quiere cerrar del todo: correr los patrones offenders también sobre el contenido CRUDO y usar el stripeado solo para descartar hits que caen en comentarios (opción 2 de iter1). No bloqueante.

### IN-08: `esRetiroUrgencia` se exporta pero ningún consumidor externo (ni los tests) la importa

**File:** `app/components/timeline-view.tsx:56`
**Issue:** El fix WR-03 exporta `esRetiroUrgencia` pero solo se usa internamente en `construirItems`; los tests nuevos verifican vía `paresDeUrgencia`/render. Export muerto (superficie pública innecesaria).
**Fix:** Quitar `export` (o añadir un test unitario directo si se quería pinear la heurística `/retira/i` por sí sola).

---

## Verificación adicional realizada (sin hallazgos)

- **pgTAP 0047:** `plan(10)` = 10 asserts; fixture empate correcto (PART_EMPATE 2/2 en `vtest:1` no contamina PART_TEST: 3 `si` / 2 `no` → mayoría única `si`); test (5) ahora es espejo exacto de `post-apply/0044_revoke_anon.test.sql` (CR-01 cerrado en ambas puntas).
- **SQL de la CTE `mayoria`:** `rank()` sobre agregado es válido (window post-GROUP BY); `min(seleccion)` con `having count(*) = 1` devuelve la única opción rk=1 — correcto en el caso sin duplicados.
- **Timeline:** run interrumpido por retiro se reanuda como período NUEVO (u1, hito retiro, u2) — semántica correcta; ids `uN` server-derived en render y comparación (T-51-17 intacto); `desde`/`hasta` siempre ambos null o ambos válidos (derivados del mismo array); copy "en {mes}" para rangos mismo-mes es nueva y correcta.
- **Guard estricto vs repo real:** las migraciones >0044 (0045/0046/0047) pasan los 3 asserts de Block A; los casos sintéticos (a)-(d) cubren el bypass multi-función que motivó la reversión.
- **Suite completa:** 489/489 verde (47 archivos) — cero regresión introducida por los 7 fix-commits.
- **Lookbehind regex** (`(?<!:)`): soportado por el runtime del proyecto (V8/Node ≥ 8.3); verificado ejecutando los tests.

_Reviewed: 2026-07-03T14:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep (iteración 2 — verificación de fixes CR-01..CR-03, WR-01..WR-05 + regresiones)_
