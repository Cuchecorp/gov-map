---
phase: 51-leg2-legibilidad-profunda
reviewed: 2026-07-03T00:00:00Z
depth: deep
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
  critical: 3
  warning: 5
  info: 6
  total: 14
status: issues_found
---

# Phase 51: Code Review Report

**Reviewed:** 2026-07-03T00:00:00Z
**Depth:** deep
**Files Reviewed:** 26
**Status:** issues_found

## Summary

Deep review of the LEG2 legibilidad-profunda surface: proyecto page (EstadoActualBlock, timeline colapso de urgencias), parlamentario surface (resumen/chips, votos por arco, lobby agrupado, patrimonio comparador SSR), the refined lockdown guard, and migration 0047 + its pgTAP.

The invariants mostly hold: SSR-only (cero `"use client"` nuevo en los archivos revisados), degrade honesto de `titulo` null en rebeldías (fallback boletín, pinned by tests), `?votosVer`/`?ver`/`?vista`/`?urgencias` comparados por igualdad contra valores server-derived (sin interpolación), returns de 0047 sin PII, y `search_path=''` con security definer intactos.

Three blockers stand: (1) the 0047 `grant execute ... to anon` factually contradicts the applied 0044 lockdown and makes the two pgTAP verification suites assert opposite ACL states — the "status quo 0019" rationale is false post-0044; (2) `mode()` tie-breaking in 0047 fabricates a "mayoría de bancada" when the bancada is tied, publishing a false disidencia claim (the exact class of insinuation the migration exists to eliminate); (3) the lockdown-guard exemption can be bypassed by a multi-function GRANT statement, widening the surface the refinement promised not to widen. Warnings cover `?a`/`?b` reaching a `date[]` cast unvalidated (crafted-URL 500s), timeline collapse mislabeling urgencia withdrawals as renewals, epoch-fallback dates ("ene 1970") in the collapsed line, missing doble-revoke in 0047, and a comment-stripping blind spot in the guard.

## Critical Issues

### CR-01: Migración 0047 re-concede EXECUTE a `anon` contradiciendo el lockdown 0044 aplicado y su pgTAP post-apply

**File:** `supabase/migrations/0047_rebeldias_honestas.sql:79` (y `supabase/tests/0047_rebeldias_honestas.test.sql:45-47` vs `supabase/tests/post-apply/0044_revoke_anon.test.sql:91-92`)
**Issue:** 0047 ejecuta `grant execute on function rebeldias_de_parlamentario(text) to anon` bajo la justificación de que "preserva el STATUS QUO de 0019, NO abre superficie nueva". Esa premisa es **falsa**: 0044 (aplicada a PROD; anon REST muerta con 401/42501) revocó `all on all routines in schema public from anon, authenticated` (0044:160) y 0045 re-revocó de `public`. El status quo real pre-0047 es anon SIN execute. Aplicar 0047:
1. **Re-abre superficie anon** (REST no autenticada con la anon key legacy, que sigue activa — deuda de operador pendiente) sobre un RPC security-definer que lee la tabla PII `parlamentario` internamente. El output es PII-safe, pero el modelo Camino A es cero-grants para anon.
2. **Rompe la verificación periódica del lockdown**: `0044_revoke_anon.test.sql:91` afirma `NOT has_function_privilege('anon', 'public.rebeldias_de_parlamentario(text)', 'execute')` mientras `0047_rebeldias_honestas.test.sql:45` afirma lo contrario. El propio `lockdown-guard.test.ts:12-16` declara que la re-corrida periódica de ese pgTAP es la ÚNICA cobertura del hueco residual de catálogo — tras 0047, esa re-corrida FALLA siempre y el operador pierde la señal.

**Fix:** Elegir uno, explícitamente:
```sql
-- Opción A (recomendada, mínima superficie): eliminar el grant.
-- El sitio lee con service_role (bypassa ACL); anon no necesita EXECUTE.
revoke all on function rebeldias_de_parlamentario(text) from public;
revoke all on function rebeldias_de_parlamentario(text) from anon, authenticated;
-- (sin grant a anon)
```
Opción B (si la decisión LOCKED es mantener el grant): actualizar `supabase/tests/post-apply/0044_revoke_anon.test.sql` para excluir/invertir el assert de `rebeldias_de_parlamentario`, corregir la prosa "status quo 0019" en 0047 (el status quo post-0044 era deny), y documentar el carve-out en el runbook. Tal como está entregado, los dos artefactos de verificación son mutuamente excluyentes.

### CR-02: `mode()` con empate fabrica una "mayoría de bancada" inexistente — afirmación falsa de disidencia

**File:** `supabase/migrations/0047_rebeldias_honestas.sql:49-57`
**Issue:** `mode() within group (order by v.seleccion)` devuelve, ante empate de frecuencias, un valor arbitrario (en la práctica el primero en orden de sort: `abstencion` < `no` < `pareo` < `si`). En una bancada empatada (p.ej. 3 `si` / 3 `no` — plausible en bancadas chicas o independientes agrupados), NO existe opción mayoritaria, pero el RPC emite igual una `mayoria_bancada` y lista como "votó distinto a la mayoría de su bancada" a la mitad que votó la otra opción. El copy de la UI ("Se compara el voto del parlamentario con la opción mayoritaria de su bancada", `votos-por-parlamentario.tsx:711-714`) publica entonces un HECHO falso sobre una persona — exactamente la clase de insinuación fabricada que esta migración ("rebeldías honestas") existe para eliminar, y en la superficie más sensible del proyecto (doctrina anti-insinuación como release gate). El pgTAP no cubre el caso empate.
**Fix:** Computar la moda con verificación de unicidad estricta y excluir votaciones empatadas:
```sql
mayoria as (
  select votacion_id, mayoria from (
    select v.votacion_id, v.seleccion as mayoria,
           count(*) as n,
           rank() over (partition by v.votacion_id order by count(*) desc) as rk,
           count(*) over (partition by v.votacion_id) as opciones_empatadas_check
    from public.voto v
    join public.parlamentario p on p.id = v.parlamentario_id
    where p.partido = (select partido from yo)
      and v.estado_vinculo = 'confirmado'
      and v.seleccion <> 'ausente'
    group by v.votacion_id, v.seleccion
  ) t
  where rk = 1
  group by votacion_id, mayoria
  having count(*) over () is not null  -- pseudo: emitir SOLO si hay UN rk=1 por votación
)
```
(Implementación concreta: agrupar por votación, quedarse solo con votaciones donde exista exactamente una selección con `rank()=1`.) Añadir un caso pgTAP de bancada empatada → 0 filas.

### CR-03: La exención del lockdown-guard es bypasseable con un GRANT multi-función — ensancha la superficie que el refinamiento prometió no ensanchar

**File:** `app/lib/lockdown-guard.test.ts:193-206` (función `anonGrantOffenders`)
**Issue:** La exención por-sentencia extrae UN solo nombre de función (`exemptExecute.exec(stmt)` toma el primer match) y exime la sentencia completa si ese primer nombre está en `PUBLIC_RPC_ALLOWLIST`. PostgreSQL permite listas: `grant execute on function public.rebeldias_de_parlamentario(text), public.resolver_entidad(text) to anon;` es una sola sentencia válida que el guard EXIME (primer nombre allowlisted) pese a conceder execute a anon sobre una función admin/write NO allowlisted. Esto viola directamente el invariante de la fase: "exención por-sentencia SOLO para grant execute on function de RPCs en PUBLIC_RPC_ALLOWLIST". Una migración futura con un grant multi-función (accidental o no) pasa CI en silencio.
**Fix:** Extraer TODOS los nombres de función de la sentencia y exigir que todos estén allowlisted, y que la sentencia no conceda nada más:
```ts
function anonGrantOffenders(strippedLowerSql: string): string[] {
  const offenders: string[] = [];
  const grantToAnon = /grant\s+\S[\s\S]*?\bto\s+[\w,\s]*\banon\b/;
  const isExecuteOnFunctions = /^\s*grant\s+execute\s+on\s+function\s/;
  const fnNames = /(?:^|,)\s*(?:public\.)?(\w+)\s*\(/g;
  for (const stmt of strippedLowerSql.split(";")) {
    if (!grantToAnon.test(stmt)) continue;
    if (isExecuteOnFunctions.test(stmt.trimStart())) {
      const names = [...stmt.matchAll(fnNames)].map((m) => m[1]);
      if (names.length > 0 && names.every((n) => PUBLIC_RPC_ALLOWLIST.has(n))) continue;
    }
    offenders.push(stmt.trim().replace(/\s+/g, " ").slice(0, 100));
  }
  return offenders;
}
```
Añadir el caso sintético multi-función al test de la regla (línea 275+): allowlisted+no-allowlisted → 1 offender.

## Warnings

### WR-01: 0047 omite el doble-revoke del idiom 0041 — el estado ACL final depende del rol que aplica la migración

**File:** `supabase/migrations/0047_rebeldias_honestas.sql:78`
**Issue:** Solo se emite `revoke all ... from public` antes del grant. El patrón establecido en 0041 (`revoke ... from public;` + `revoke ... from anon, authenticated;`) no se replica — y el invariante de la fase pedía "doble revoke re-emitido". Con el `alter default privileges for role postgres ... revoke` de 0044, el create vía psql-como-postgres queda limpio; pero si el DDL se aplica con OTRO rol (p.ej. SQL editor del dashboard como `supabase_admin`, cuyos default privileges siguen auto-concediendo a anon/authenticated), `authenticated` retendría EXECUTE y el `revoke from public` no lo limpiaría. El "ACL determinista" del comentario solo es determinista condicionado al rol de aplicación.
**Fix:** Añadir antes del grant:
```sql
revoke all on function rebeldias_de_parlamentario(text) from anon, authenticated;
```
(inofensivo si ya no hay grant; belt-and-suspenders idéntico a 0041:50-51). Nota: interactúa con CR-01 — si se elimina el grant a anon (Opción A), este doble revoke es el estado final correcto.

### WR-02: `?a`/`?b`/`?comparar` llegan sin validar al cast `date[]` — cualquier URL manipulada produce un 500

**File:** `app/components/patrimonio-de-parlamentario.tsx:904-913, 977-991`
**Issue:** `a`/`b` solo se `trim()`ean y se pasan como `fechas` al RPC `comparar_declaraciones(text, date[])` (firma confirmada en 0044:63). Un valor no-fecha (`?a=zzz&b=zzz`, o `?comparar=x,y`) provoca `invalid input syntax for type date` en Postgres → `cmpError` → `throw` → página de error (500) para TODA la ficha. No es inyección (parametrizado), pero (a) contradice el invariante de la fase de searchParams saneados, (b) convierte un typo/URL hostil en un 500 barato y repetible sobre una ruta pública, y (c) rompe el degrade honesto (la página entera cae por un param de comparación decorativo).
**Fix:** Validar formato ISO antes de invocar el RPC; input inválido → sin comparación (fail-safe, espejo de `normalizarVista`):
```ts
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
fechasComparar = fechasComparar.filter((f) => ISO_DATE_RE.test(f));
if (fechasComparar.length < 2) fechasComparar = [];
```

### WR-03: El colapso de urgencias etiqueta un "retira la urgencia" como renovación — "Urgencia Suma renovada N veces" puede ser falso

**File:** `app/components/timeline-view.tsx:52-63, 104-128, 166-171`
**Issue:** `esEventoUrgencia` marca también los eventos "retira ... la urgencia Suma", y `tipoUrgenciaKey` extrae el MISMO tipo (`"suma"`) tanto de "hace presente la urgencia Suma" como de "retira la urgencia Suma". Un run contiguo `[hace presente Suma, retira Suma]` se colapsa como "Urgencia Suma renovada 2 veces" — un retiro contado como renovación es una afirmación fabricada (y contradice a `urgenciaVigente` de `estado-actual-block.tsx:55-58`, que sí distingue retira). Adicionalmente, el conteo "renovada N veces" incluye la presentación inicial (un par presenta+renueva se reporta como "renovada 2 veces" cuando hubo 1 renovación); el test (timeline-view.test.tsx:110) pinnea esta copy, así que el fix requiere ajustar ambos.
**Fix:** Excluir los eventos "retira" del colapso (que corten el run y se rendericen como `TimelineEvent` normal — hito estructural del arco de urgencia), p.ej. en `construirItems` tratar `/retira/i.test(descripcion)` como no-colapsable; y cambiar la copy a un conteo neutro sin semántica de renovación: "Urgencia {tipo}: {n} eventos entre {mesX} y {mesY}".

### WR-04: Fechas época-Unix fabricadas en la línea de período colapsado ("ene 1970")

**File:** `app/components/timeline-view.tsx:117-118, 166-171`
**Issue:** `construirItems` incluye en el run eventos con `fecha` no parseable (el sort les asigna time 0) y el período usa `desde = fechaValida(run[0].fecha) ?? new Date(0)`. Si el primer o último evento del run tiene fecha inválida/null, `periodoLinea` renderiza "entre ene 1970 y ..." — una fecha fabricada mostrada como dato, violando el idiom del propio repo (fechaValida/fechaCortaSegura existen exactamente para esto; T-51-14/WR-03 de fases previas).
**Fix:** Derivar `desde`/`hasta` del primer/último evento CON fecha válida dentro del run; si ningún evento del run tiene fecha válida, omitir el rango de la línea (solo "Urgencia {tipo}, {n} eventos"), nunca epoch:
```ts
const fechasValidas = run.map((e) => fechaValida(e.fecha)).filter((d): d is Date => d !== null);
const desde = fechasValidas[0] ?? null; // null → periodoLinea omite el rango
```

### WR-05: `stripTsComments` del lockdown-guard trunca líneas en `//` dentro de strings — punto ciego de falso negativo en el escáner PII/RPC

**File:** `app/lib/lockdown-guard.test.ts:67-79` (mismo idiom en `app/app/layout.test.tsx:26-36`)
**Issue:** El strip de comentarios corta cada línea en el primer `//`, incluidos los de URLs en string literals (`"https://..."`). Una línea como `const u = "https://x.cl"; await sb.rpc("rpc_no_listado")` queda truncada ANTES del `.rpc(` → el guard de Block B no ve la llamada (falso negativo en el control de seguridad). Análogamente puede ocultar un `.from('parlamentario')` tras un string con `//` en la misma línea. Como este archivo ES el control CI de la superficie Camino A, un punto ciego de escaneo es una degradación real de la defensa (no solo estilo).
**Fix:** No tratar `//` como comentario cuando va precedido de `:` (heurística barata que cubre `http://`/`https://`):
```ts
const idx = line.search(/(?<!:)\/\//);
```
o, más robusto: correr los patrones offenders sobre el contenido CRUDO además del stripeado, y solo usar el stripeado para los patrones susceptibles a prosa.

## Info

### IN-01: 0047 ordena por `votacion_id` (text) y el DISTINCT ON no tiene desempate secundario

**File:** `supabase/migrations/0047_rebeldias_honestas.sql:59-69`
**Issue:** El resultado llega a la UI en orden lexicográfico de `votacion_id` ("camara:10" antes que "camara:2"), no cronológico — la lista "Votó distinto" se muestra en orden arbitrario para el ciudadano. Además, `distinct on (v.votacion_id)` sin clave de orden secundaria hace no-determinista qué fila duplicada gana (hoy inocuo porque los duplicados comparten valores).
**Fix:** `order by v.votacion_id, vo.fecha desc` en el DISTINCT ON y envolver con orden externo `order by fecha desc` para la presentación.

### IN-02: Los hrefs de faceta/paginación de votos pierden el ancla `#votos` y el param `votosVer`

**File:** `app/components/votos-por-parlamentario.tsx:156-166, 548-572, 623-658`
**Issue:** `buildHref` no añade `#votos` (a diferencia de lobby `#lobby` y patrimonio `#patrimonio`): al facetear por tema o paginar, el navegador salta al tope de la ficha y el usuario pierde la sección. También descarta `votosVer` (el arco abierto se colapsa al paginar/facetear — quizá deseado al facetear, pero sorprendente al paginar).
**Fix:** Anexar `#votos` al retorno de `buildHref` y preservar `votosVer` en la paginación si el arco sigue en la página.

### IN-03: Comparador de patrimonio sin feedback cuando `?a === ?b` o cuando las fechas no calzan con ninguna versión

**File:** `app/components/patrimonio-de-parlamentario.tsx:634-650, 854-884`
**Issue:** Elegir la misma fecha en ambos selects produce dos columnas idénticas (el mismo objeto columna duplicado por `orden.map`), una "comparación" de X contra X sin aviso; y fechas válidas que no calzan con ninguna versión producen `columnas.length < 2` → el form re-renderiza sin ningún mensaje (silencio, no un estado honesto).
**Fix:** Deduplicar `fechasComparar` (`a === b` → tratar como sin comparación) y, cuando se pidió comparar pero `columnas.length < 2`, mostrar una línea honesta ("No se encontraron dos versiones para las fechas pedidas").

### IN-04: `lobbyPage` acepta basura final ("3abc" → 3), inconsistente con el idiom WR-04 de votos

**File:** `app/components/lobby-de-parlamentario.tsx:539` (mismo patrón en `patrimonio-de-parlamentario.tsx:901`)
**Issue:** `Number.parseInt(single("lobbyPage") ?? "1", 10) || 1` acepta `"3abc"` como 3, mientras votos usa `normalizarPagina` (dígitos puros o 1). Inofensivo (queda clampeado), pero dos higienes distintas para el mismo tipo de param.
**Fix:** Reusar `normalizarPagina` (exportada en votos-por-parlamentario.tsx:727) en lobby y patrimonio.

### IN-05: El form GET del comparador pierde el fragmento `#patrimonio` y los params previos

**File:** `app/components/patrimonio-de-parlamentario.tsx:665-668`
**Issue:** `action={`/parlamentario/${id}`}` sin fragmento: tras el submit la página carga en el tope (el usuario debe volver a bajar a la sección); también se descartan `patrimonioPage`/`ver`.
**Fix:** `action={`/parlamentario/${id}#patrimonio`}` (los GET forms preservan el fragmento del action) y, si se quiere conservar página/detalle, inputs hidden con los valores vigentes.

### IN-06: `aria-label` sobre `<span>` sin rol en el chip "no ingerido"

**File:** `app/components/parlamentario-resumen.tsx:42-47`
**Issue:** `aria-label="no ingerido todavía"` en un span estático sin role es ignorado por la mayoría de los lectores de pantalla (aria-label solo es fiable en elementos interactivos o con role); el "—" queda sin explicación accesible.
**Fix:** Usar texto visually-hidden (`<span className="sr-only">no ingerido todavía</span>`) junto al guion, o `role="img"` + aria-label.

---

_Reviewed: 2026-07-03T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
