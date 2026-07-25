# Phase 102: RELACIONES P2b — Similitud de votación (gated legal) - Research

**Researched:** 2026-07-24
**Domain:** Métrica factual pairwise sobre voto confirmado + gate deny-by-default + linter anti-insinuación + dossier legal (todo con precedente directo en el repo)
**Confidence:** HIGH (todo verificado contra la DB viva y los archivos reales del repo; cero especulación)

## Summary

Phase 102 añade un 5º eje "Coinciden en N de M votaciones compartidas (X%)" al FINAL de `/comparar`, detrás de `VSIM_PUBLIC_ENABLED` (deny-by-default), con caveat base-alta OBLIGATORIO, dossier legal `signoff: pending`, linter anti-insinuación extendido ANTES del copy, y verificación permanente de que `co_votacion` no entra a `/red`. El dato está listo: **283.550 votos confirmados** (186 parlamentarios, 4.855 votaciones) `[VERIFIED: psql]`, todos con `parlamentario_id` no-null. Toda la infraestructura a espejar (gate, anti-flip guard, linter, RPC bounded, dossier, montaje en `/comparar`) tiene **precedente byte-a-byte** en el repo — esta fase es replicación disciplinada de moldes existentes, no diseño nuevo.

Dos hallazgos críticos que el planner DEBE atender: **(1)** `co_votacion` YA EXISTE como label en DOS componentes de `/red` (`app/components/red/red-graph.tsx:81` y `app/components/red/arista-hecho.tsx:32-33`) como ramas latentes — el test estático permanente de VSIM-03 CHOCARÁ con estas líneas si escanea texto crudo; hay que decidir su tratamiento (eliminar las ramas muertas vs. allowlistar por comentario). **(2)** El anti-flip guard Vector 2 exige `VSIM_PUBLIC_ENABLED=false` en `.env.example` — hoy solo `MONEY_PUBLIC_ENABLED` está ahí; la línea nueva es obligatoria o el guard MUERDE en verde-falso.

La query pairwise (self-join sobre `voto` filtrado por `parlamentario_id` + `estado_vinculo='confirmado'` + `seleccion in ('si','no','abstencion')`) corre en **28ms** usando el índice existente `voto_parlamentario_id_idx` — muy dentro del budget de 5s `[VERIFIED: explain analyze]`. Evidencia empírica de base-alta: un diputado real coincide 100% con un par, 29% con otro; sobre 154 pares su coincidencia va de 19% a 100% (promedio 63%, 49% de pares >70%); ~32% de las votaciones son cuasi-unánimes (lado perdedor ≤5%). Esto sustenta el caveat literalmente.

**Primary recommendation:** Espejar money-gate → vsim-gate, money-antiflip-guard → vsim-antiflip-guard (+ línea en `.env.example`), extender el linter con idioms VSIM + leyenda en NEGACIONES_LOCKED, escribir 0068 (mold 0067/0064) con la query verificada, montar el 5º eje como `<section className="mt-12">` al final de `CompararEjes` gated por `vsimPublicEnabled()` con `return null` cuando OFF, y añadir un test estático que resuelva el conflicto `co_votacion`-en-/red.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Métrica y denominador (VSIM-01)**
- "Votación sustantiva" = votaciones de proyectos de ley (con boletín asociado) donde AMBOS parlamentarios registran voto explícito afirmativo/en-contra/abstención; pareos y ausencias EXCLUIDOS del denominador. El criterio SQL exacto se fija en research con evidencia de la DB.
- Cómputo: RPC pairwise ON-DEMAND para el par A/B de /comparar (bounded, secdef, patrón 0067) — un solo par por request. JAMÁS tabla materializada todos-contra-todos.
- Presentación: "Coinciden en N de M votaciones compartidas (X%)" + caveat base-alta VERBATIM obligatorio adyacente + cobertura de voto DECLARADA (Cámara confirmado determinista ~80%, Senado por nombre ~20%).
- Superficie: SOLO /comparar como eje adicional gated — jamás en ficha, jamás en /red, jamás en listados.

**Gate deny-by-default + anti-flip (VSIM-02)**
- Flag `VSIM_PUBLIC_ENABLED` leído SOLO vía `vsimPublicEnabled()` en `app/lib/vsim-gate.ts` — espejo byte-a-byte de `money-gate.ts` (`=== "true"` fail-closed).
- Guard CI `vsim-antiflip-guard.test.ts` espejo de `money-antiflip-guard.test.ts`: 3 vectores (nada `=true` committeado; `.env.example` trae `VSIM_PUBLIC_ENABLED=false`; ningún `process.env.VSIM_PUBLIC_ENABLED` crudo fuera del chokepoint) + mutation self-check.
- Dossier legal `docs/legal/102-LEGAL-DOSSIER-VSIM.md` con la métrica, el caveat, el anti-modelo DW-NOMINATE y campo `signoff: pending` — el flip requiere `approved` firmado por humano.
- Flag OFF ⇒ el eje similitud AUSENTE del DOM por completo (return null server-side) — sin placeholder ni teaser.

**Linter anti-insinuación + co_votacion (VSIM-03)**
- Wave 0 ANTES del copy: idioms vetados "votan juntos", "aliados", "más afín"/"afín a", "tasa de coincidencia" (como ranking), "bloque de votación", "votan parecido"/"votan igual" + variantes con tildes exactas, en superficies VSIM y globales.
- Leyenda del caveat base-alta = constante única exportada VERBATIM (contendrá términos que NIEGA) → restada vía `NEGACIONES_LOCKED` antes del match.
- Mutation self-check: el linter extendido prueba EN MEMORIA que MUERDE con cada idiom nuevo inyectado.
- Test estático PERMANENTE: ningún archivo de /red (`app/app/red/`, componentes NET, schema grafo) contiene `co_votacion`/`covotacion` — verificable en diff y suite.

**Integración en /comparar + datos**
- Posición: eje 5º al FINAL de /comparar, en sección hermana SEPARADA (mt-12 frontera anti-insinuación) con su propia leyenda — nunca mezclado con los 4 ejes factuales no-voto.
- RPC nueva `coincidencia_votos_par(p_a, p_b)` en migración 0068: secdef, search_path='', statement_timeout '5s', doble-revoke CERO grant, returns agregado del par (n_coinciden, m_compartidas, fecha_captura_max) — NUNCA lista de votaciones individuales. Allowlist Direction-B en Wave 0.
- Estados degradados: M=0 o cobertura insuficiente → "sin votaciones compartidas suficientes en las fuentes consultadas"; asimetría de cobertura Cámara/Senado declarada cuando el par es mixto.
- Preview gated: el eje renderiza con flag ON en entorno local/preview para el cold-read del dossier; PROD queda OFF.

### Claude's Discretion
- Definición SQL exacta de "sustantiva" (con evidencia de research sobre los tipos de votación reales en la DB).
- Si el % se muestra redondeado o con decimales; formato exacto del bloque.
- Estructura interna del dossier (siguiendo el molde de 13/17/41).

### Deferred Ideas (OUT OF SCOPE)
- Flip de `VSIM_PUBLIC_ENABLED` a true — acto humano exclusivo tras sign-off legal.
- Comparativo voto vs mayoría de bancada (VOTOX-01) y votos cruzados (VOTOX-02) — v2.
- `co_votacion` como arista de /red — PROHIBIDO permanente.
- Detalle por votación individual del par (lista de en cuáles coinciden) — fuera de alcance de la RPC 0068.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| VSIM-01 | Métrica factual pairwise "coinciden en N de M votaciones compartidas" (denominador honesto) con caveat base-alta OBLIGATORIO, nunca score/ranking (anti-DW-NOMINATE) | Schema `voto`/`votacion` verificado; denominador SQL prototipado y cronometrado (28ms); base-rate empírico medido (19-100%, avg 63%); RPC 0068 diseñada sobre mold 0067/0064; montaje en `CompararEjes` localizado exacto |
| VSIM-02 | Similitud detrás de flag deny-by-default (`VSIM_PUBLIC_ENABLED`); flip = sign-off legal humano (dossier); agente jamás flipea | `money-gate.ts` + `money-antiflip-guard.test.ts` leídos verbatim como mold; `.env.example` gap identificado; dossier 13-LEGAL-DOSSIER mold leído; `return null` server-side documentado |
| VSIM-03 | Linter anti-insinuación extendido ANTES del copy (idioms + leyenda en NEGACIONES_LOCKED + mutation self-check); `co_votacion` JAMÁS entra a /red | `anti-insinuacion-guard.test.ts` estructura completa leída; idioms VSIM listados; conflicto `co_votacion` en 2 componentes /red DESCUBIERTO; superficie /red inventariada (3 archivos + schema) |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Cómputo pairwise coincidencia | Database (RPC secdef) | — | La agregación por par es una query bounded; vive en Postgres con statement_timeout, jamás en JS (evita traer filas al server) |
| Gate deny-by-default | Frontend Server (Next SC) | — | Flag server-only leído antes de cualquier `.rpc()`; nunca cliente (server-only import) |
| Cómputo del % | Frontend Server / componente | — | round(N/M·100) en el server desde valores resueltos; el componente es presentacional puro |
| Presentación (figura + caveat + cobertura) | Frontend Server (RSC) | — | Componente presentacional puro; el SC pasa valores resueltos; nunca toca Supabase |
| Enforcement anti-flip / anti-insinuación / co_votacion∉/red | CI (vitest guards) | — | Tests estáticos que escanean fuente; corren en `pnpm test` + gate GSD verify-work |
| Sign-off legal | Human (operador) | — | El flip a `true` es acto humano tras dossier `approved`; fuera de scope del agente |

## Standard Stack

Sin dependencias net-new. Todo el trabajo usa el stack ya en el repo.

### Core (ya presentes)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| vitest | (repo) | Guards CI (gate, anti-flip, anti-insinuación, co_votacion∉/red) + RTL de la superficie | Molde de todos los guards existentes; corre en `pnpm --filter ./app test` |
| pgTAP | (Supabase) | Prueba del DDL 0068 contra schema aplicado | Única prueba válida del DDL (Pitfall 6); mold 0067 |
| @supabase/supabase-js v2 | (repo) | `sb.rpc("coincidencia_votos_par", {...})` desde el SC | Ya usado en `comparar/page.tsx` con service_role |
| react-dom/server (`renderToStaticMarkup`) | (repo) | RTL de la sección gated (DOM present/absent) | Molde de `page.test.tsx` de comparar |

**Installation:** ninguna. `npm view` / `pip index` no aplican — cero paquetes nuevos.

## Package Legitimacy Audit

**No aplica.** Phase 102 no instala ningún paquete externo. Todo el trabajo es SQL (migración 0068), TypeScript (gate + componente + guards) y Markdown (dossier) sobre el stack existente. slopcheck/registry-check omitidos por ausencia de instalaciones.

## Runtime State Inventory

Aunque no es un rename/refactor puro, VSIM-03 introduce una verificación de estado latente que amerita el inventario:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `voto` (283.550 confirmados, todos con parlamentario_id) + `votacion` (4.855, todas con boletin FK→proyecto) — dato LISTO, cero ingesta nueva | Ninguna — solo lectura vía RPC 0068 |
| Live service config | Ninguna — la fase no toca fuentes externas (sin R2, sin rate-limit, sin robots.txt) | None — verificado: 0068 lee solo tablas ya pobladas |
| OS-registered state | Ninguna — sin crons nuevos, sin GH Actions | None |
| Secrets/env vars | `VSIM_PUBLIC_ENABLED` NUEVO (server-only, sin `NEXT_PUBLIC_`); debe entrar a `.env.example` como `=false` (lo exige el anti-flip guard V2) | Añadir línea a `.env.example`; el operador pone el valor real en `.env` local solo para preview |
| Build artifacts / código latente | **`co_votacion` YA presente en `red-graph.tsx:81` + `arista-hecho.tsx:32-33`** como ramas de label muertas (el schema `arista.tipo` CHECK solo permite `co_lobby_contraparte`; 0 aristas co_votacion en DB) | El test estático VSIM-03 chocará con estas líneas — DECISIÓN de plan requerida (ver Pitfall 1) |

**Verificado en DB viva:** `select tipo, count(*) from arista group by tipo;` → solo `co_lobby_contraparte` (7394). El CHECK constraint `tipo in ('co_lobby_contraparte')` impide físicamente insertar `co_votacion`. El riesgo es de CÓDIGO (labels latentes), no de datos.

## Architecture Patterns

### System Architecture Diagram

```
Usuario elige A y B en /comparar
        │
        ▼
app/comparar/page.tsx (Server Component, force-dynamic)
        │  valida ids (PARLAMENTARIO_ID_RE), orden canónico [a,b].sort()
        ▼
CompararEjes (server child async)
   ├─ ejeMilitancia ─┐
   ├─ ejeComisiones  │  4 ejes factuales no-voto (Phase 101) — SIN CAMBIO
   ├─ ejeCoautoria   │
   ├─ ejeZona ───────┘
   │
   └─ [NUEVO] vsimPublicEnabled(process.env) ?
              │
        false │ (PROD default)          true │ (local/preview)
              ▼                              ▼
         return null              sb.rpc("coincidencia_votos_par",{p_a,p_b})
      (cero DOM, cero rpc)              │  secdef, timeout 5s, agregado
                                        ▼
                            { n_coinciden, m_compartidas, fecha_captura_max }
                                        │  % = round(N/M·100) en el server
                                        ▼
                    <section className="mt-12">  ← 5º sibling, AL FINAL
                        <SimilitudVotacionComparar
                            heading + CAVEAT (verbatim) + figura(neutral)
                            + cobertura declarada + provenance />
                        │  M=0 → copy degradado honesto (jamás "0%")
```

**Enforcement (CI, fuera del flujo de render):**
```
pnpm test / GSD verify-work
   ├─ vsim-gate.test.ts               → === "true" fail-closed
   ├─ vsim-antiflip-guard.test.ts     → V1 gate estricto · V2 .env.example=false · V3 no-raw-env + self-check
   ├─ anti-insinuacion-guard.test.ts  → SUPERFICIES_VSIM + idioms + LEYENDA en NEGACIONES_LOCKED + self-check
   └─ co-votacion-red-guard.test.ts   → co_votacion ∉ superficie /red (NUEVO)
```

### Recommended Project Structure (archivos tocados/nuevos)
```
app/
├── lib/
│   ├── vsim-gate.ts                        # NUEVO — espejo byte-a-byte de money-gate.ts
│   ├── vsim-gate.test.ts                   # NUEVO — espejo de money-gate.test.ts (5 casos)
│   ├── vsim-antiflip-guard.test.ts         # NUEVO — espejo de money-antiflip-guard.test.ts (V1/V2/V3 + self-check)
│   └── anti-insinuacion-guard.test.ts      # EXTENDER — SUPERFICIES_VSIM + idioms + LEYENDA en NEGACIONES_LOCKED
├── components/
│   ├── similitud-votacion-comparar.tsx     # NUEVO — presentacional puro (NO RelacionesEjeComparar; sin petróleo)
│   └── co-votacion-red-guard.test.ts       # NUEVO — test estático co_votacion ∉ /red (ubicación a discreción)
└── app/comparar/
    ├── page.tsx                            # EXTENDER — 5º sección gated al final de CompararEjes
    └── page.test.tsx                       # EXTENDER — sección ON (con flag) + ausencia (flag OFF)
supabase/
├── migrations/0068_coincidencia_votos_par.sql   # NUEVO — mold 0067/0064
└── tests/0068_coincidencia_votos_par.test.sql   # NUEVO — mold 0067 pgTAP
docs/legal/102-LEGAL-DOSSIER-VSIM.md              # NUEVO — mold 13-LEGAL-DOSSIER
.env.example                                       # EXTENDER — VSIM_PUBLIC_ENABLED=false
app/lib/lockdown-guard.test.ts                     # EXTENDER — "coincidencia_votos_par" en PUBLIC_RPC_ALLOWLIST
```

### Pattern 1: Gate chokepoint fail-closed (espejo money-gate.ts)
**What:** Función server-only que enciende SOLO con el literal `"true"`.
**When to use:** El único punto que lee `VSIM_PUBLIC_ENABLED`.
```typescript
// Source: app/lib/money-gate.ts (VERIFIED — byte-a-byte)
import "server-only";
export function vsimPublicEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return env.VSIM_PUBLIC_ENABLED === "true";
}
```

### Pattern 2: RPC bounded agregada (mold 0067 + 0064)
**What:** RPC secdef que devuelve UN agregado del par, cero lista individual.
```sql
-- Source: supabase/migrations/0067_militancia_historica_compartida.sql (VERIFIED — mold)
-- Denominador prototipado y verificado en DB viva (28ms via voto_parlamentario_id_idx).
drop function if exists public.coincidencia_votos_par(text, text);

create or replace function public.coincidencia_votos_par(p_a text, p_b text)
returns table (n_coinciden bigint, m_compartidas bigint, fecha_captura_max timestamptz)
language sql stable security definer
  set search_path = ''
  set statement_timeout = '5s'
as $$
  with a as (
    select v.votacion_id, v.seleccion
    from public.voto v
    where v.parlamentario_id = p_a
      and v.estado_vinculo = 'confirmado'
      and v.seleccion in ('si','no','abstencion')   -- SUSTANTIVA: pareo/ausente excluidos
  ),
  b as (
    select v.votacion_id, v.seleccion
    from public.voto v
    where v.parlamentario_id = p_b
      and v.estado_vinculo = 'confirmado'
      and v.seleccion in ('si','no','abstencion')
  )
  select
    count(*) filter (where a.seleccion = b.seleccion)   as n_coinciden,
    count(*)                                            as m_compartidas,
    (select max(vt.fecha_captura)
       from public.votacion vt
       where vt.id in (select votacion_id from a intersect select votacion_id from b)) as fecha_captura_max
  from a join b using (votacion_id);
$$;

revoke all on function public.coincidencia_votos_par(text, text) from public;
revoke all on function public.coincidencia_votos_par(text, text) from anon, authenticated;
```
> Nota de diseño (Discretion): la query es la MISMA que se cronometró en 28ms. `votacion.boletin` es NOT NULL con FK→proyecto → **toda** votación ya es "de un proyecto de ley"; no hace falta un join extra a `proyecto` para el predicado "sustantiva". El único filtro sustantiva es `seleccion in ('si','no','abstencion')` sobre `estado_vinculo='confirmado'`.

### Pattern 3: Sección gated con return null (mold money en la ficha)
**What:** Chequear el flag ANTES de cualquier `.rpc()`; OFF → `return null` (sin DOM).
```typescript
// Dentro de CompararEjes, DESPUÉS de ejeZona, como último sibling:
let ejeSimilitud: React.ReactNode = null;
if (vsimPublicEnabled(process.env)) {
  const { data, error } = await sb.rpc("coincidencia_votos_par", { p_a: a, p_b: b });
  if (error) throw new Error(`coincidencia_votos_par falló: ${error.message}`); // #34
  // ... resolver N/M/%/fecha, pasar a <SimilitudVotacionComparar>
}
return (<>{ejeMilitancia}{ejeComisiones}{ejeCoautoria}{ejeZona}{ejeSimilitud}</>);
```

### Anti-Patterns to Avoid
- **Reusar `RelacionesEjeComparar`:** su figura de intersección va en `font-semibold text-accent-product` (petróleo) — para VOTO eso codifica "nivel de acuerdo" y cruza la línea anti-DW-NOMINATE. Componente dedicado neutral (UI-SPEC LOCK).
- **Tabla materializada todos-contra-todos:** eso ES la matriz DW-NOMINATE. Solo el par on-demand.
- **`response_format` / lista de votaciones individuales en 0068:** el returns table es EXACTAMENTE 3 columnas agregadas.
- **Leer `process.env.VSIM_PUBLIC_ENABLED` fuera de vsim-gate.ts:** el anti-flip guard V3 lo caza.
- **Emitir "0%" cuando M=0:** copy degradado honesto, jamás una cifra fabricada.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Flag fail-closed | Un `Boolean(env.X)` o `!== "false"` propio | Espejo verbatim de `money-gate.ts` (`=== "true"`) | El anti-flip guard V1 exige EXACTAMENTE esa forma; cualquier variante MUERDE el guard |
| Anti-flip enforcement | Un guard nuevo desde cero | Copiar `money-antiflip-guard.test.ts` cambiando `MONEY`→`VSIM` (incl. helpers `detectarRelajacionGate`/`detectarRawEnvEnRuta` + self-check) | La lógica de detección + mutation self-check ya está probada; re-derivarla arriesga huecos |
| Linter anti-insinuación | Un scanner nuevo | EXTENDER `anti-insinuacion-guard.test.ts` (nuevo array `SUPERFICIES_VSIM`, idioms en `TERMINOS_PROHIBIDOS`, leyenda en `NEGACIONES_LOCKED`, self-check nuevo) | `detectarInsinuaciones` + `buildTermRegex` + tildes-exactas ya resueltos; el bucle escanea todos los `SUPERFICIES_*` juntos |
| RPC bounded segura | Una función sin timeout/secdef/revoke | Mold 0067 (secdef, search_path='', statement_timeout '5s', doble-revoke) + Direction-B allowlist | El lockdown-guard exige allowlist ⊆ definidas; el molde previene DoS y grants residuales |
| Prueba del DDL | Confiar en tsc/typecheck | pgTAP 0068 contra schema APLICADO (mold 0067) | typecheck no prueba que Postgres corrió el DDL (Pitfall 6, LOCKED) |
| Dossier legal | Un doc ad-hoc | Mold `13-LEGAL-DOSSIER.md` (front-matter YAML `signoff: pending`, secciones de superficie de riesgo, checklist) | El gate consume `signoff: approved` por inspección del YAML; la estructura es la esperada |

**Key insight:** cada pieza de esta fase tiene un gemelo funcionando en PROD. El valor está en replicar con precisión (mismas invariantes, mismos self-checks) y en resolver los DOS gaps reales (co_votacion latente + línea `.env.example`), no en inventar.

## Common Pitfalls

### Pitfall 1: `co_votacion` YA vive en /red — el test estático VSIM-03 chocará
**What goes wrong:** El test permanente "ningún archivo de /red contiene `co_votacion`" falla de inmediato: `app/components/red/red-graph.tsx:81` tiene `co_votacion: "Misma votación"` en `TIPO_LABEL`, y `app/components/red/arista-hecho.tsx:32-33` tiene un `case "co_votacion": return "Registrados en la misma votación: ..."`. Ambas son ramas LATENTES (el schema `arista.tipo` CHECK solo admite `co_lobby_contraparte`; 0 aristas co_votacion en DB).
**Why it happens:** Fueron previstas como labels defensivos para un tipo de arista que el MVP excluyó explícitamente (0030_net.sql:27 "co_votacion queda EXCLUIDO... explosión de clique").
**How to avoid:** DECISIÓN DE PLAN requerida — dos rutas válidas:
  - **(A) Eliminar las ramas muertas** de `red-graph.tsx` (entrada TIPO_LABEL) y `arista-hecho.tsx` (case) → el test escanea texto CRUDO y queda verde permanente. Es la lectura literal de VSIM-03 ("JAMÁS entra a /red"). Verificar que `red-graph.test.tsx` no dependa de esos labels.
  - **(B) Escanear texto RENDERIZADO** (post-`stripTsComments`) y allowlistar las 2 líneas por comentario — más frágil (las líneas NO son comentarios, son código vivo aunque inalcanzable). Menos alineado con "JAMÁS entra".
  Recomendación: **(A)** — es lo que el requisito pide literalmente y deja el árbol limpio. El plan debe incluir la verificación de `red-graph.test.tsx`.
**Warning signs:** El test nace ROJO si escanea crudo sin resolver esto primero.

### Pitfall 2: `.env.example` sin la línea VSIM → anti-flip guard V2 muerde en verde-falso
**What goes wrong:** El Vector 2 del anti-flip guard afirma `/^VSIM_PUBLIC_ENABLED\s*=\s*false\s*$/m` en `.env.example`. Hoy SOLO `MONEY_PUBLIC_ENABLED=false` está ahí (línea 70) `[VERIFIED: grep]`; `NET_/CRUCES_PUBLIC_ENABLED` NO están (esos gates no tienen entrada en `.env.example`).
**Why it happens:** El molde anti-flip exige la entrada `=false` como "default versionado OFF". Sin ella el guard V2 falla legítimamente.
**How to avoid:** Añadir `VSIM_PUBLIC_ENABLED=false` a `.env.example` en Wave 0, junto al gate. Es parte del molde, no opcional.
**Warning signs:** `vsim-antiflip-guard.test.ts` falla en V2 apenas se crea.

### Pitfall 3: La leyenda caveat NIEGA "afinidad"/"señal" → falso positivo del linter si no se resta
**What goes wrong:** La leyenda LOCKED contiene "no indica afinidad" y "no una señal". "afinidad" YA está en `TERMINOS_PROHIBIDOS` → el scan de la superficie VSIM se auto-cazaría sobre su propia leyenda (mismo bug que BLOQUEÓ Phase 91).
**Why it happens:** El copy honesto usa el término prohibido para NEGARLO.
**How to avoid:** Exportar la leyenda como constante única (p.ej. `LEYENDA_SIMILITUD_VOTO` en `similitud-votacion-comparar.tsx`), importarla verbatim y añadirla a `NEGACIONES_LOCKED` ANTES de que `SUPERFICIES_VSIM` entre al scan real. "señal" NO está hoy en TERMINOS_PROHIBIDOS — si el plan lo añade como idiom, la resta también lo cubre. Patrón idéntico a `LEYENDA_CROSS_LINK`/`LEYENDA_MENCIONES_LOBBY`.
**Warning signs:** El guard falla sobre `similitud-votacion-comparar.tsx → "afinidad"` en su primer run con la leyenda montada.

### Pitfall 4: Idiom "más afín"/"afín a" vs. el término existente "afín"
**What goes wrong:** `TERMINOS_PROHIBIDOS` ya tiene `"afín"` (carril PERSONAS). Añadir "más afín"/"afín a" es redundante (el límite de palabra ya caza "afín" en cualquier contexto) y podría duplicar. CONTEXT lo advierte ("afinidad may already be covered; confirm no double-registration conflict").
**How to avoid:** Verificar la lista antes de añadir. Los idioms REALMENTE nuevos son: "votan juntos", "votan igual", "votan parecido", "aliados/aliado/aliada" (hoy solo "aliado" está — añadir plurales/femenino), "tasa de coincidencia", "bloque de votación"/"bloque de voto" (hoy "bloque de" ya caza ambos), "vota como"/"votan como" (YA presentes), "cercano"/"cercanía" (cuidado: "cercano a" ya está; "cercanía política" ya está). El plan debe DEDUPE contra la lista actual y añadir solo lo genuinamente ausente + tests de mutación por cada idiom nuevo.
**Warning signs:** Tests de self-check que pasan trivialmente porque el idiom ya estaba cubierto por otro término.

### Pitfall 5: Emitir el número con petróleo/bold (anti-DW-NOMINATE)
**What goes wrong:** Reusar el patrón de `InterseccionCompartida` (`font-semibold text-accent-product`) para la figura N/M/% codifica "nivel de acuerdo" visualmente.
**How to avoid:** Componente dedicado `SimilitudVotacionComparar` con la figura en `text-sm` weight-400, `--foreground`, cero petróleo, cero bold, cero barra/gauge. La leyenda caveat pesa MÁS que el número (UI-SPEC LOCK). NO reusar `RelacionesEjeComparar`.

### Pitfall 6: pgTAP contra scratch DB, no PROD; y aplicar 0068 con psql --single-transaction
**What goes wrong:** `supabase db push` deriva `schema_migrations`; typecheck no prueba el DDL.
**How to avoid:** Aplicar `PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" --single-transaction -f 0068_*.sql` (última migración = 0067, esta es la 0068). Correr pgTAP contra el schema aplicado. El agente PUEDE aplicar migraciones aditivas (precedente 0059-0067). Nota: 0068 es aditiva pura (una función nueva + revokes) → dentro de forbidden-gate permitido.

## Code Examples

### Verificar el denominador y timing (reproducible)
```sql
-- Source: prototipado en DB viva (VERIFIED, 28ms, usa voto_parlamentario_id_idx)
explain (analyze, buffers)
with a as (select votacion_id, seleccion from voto
           where parlamentario_id='D1170' and estado_vinculo='confirmado'
             and seleccion in ('si','no','abstencion')),
     b as (select votacion_id, seleccion from voto
           where parlamentario_id='D1165' and estado_vinculo='confirmado'
             and seleccion in ('si','no','abstencion'))
select count(*) m_compartidas,
       count(*) filter (where a.seleccion=b.seleccion) n_coinciden
from a join b using (votacion_id);
-- → m=3672, n=3655 (100%); Execution Time: 27.998 ms
```

### Extensión del linter (esqueleto)
```typescript
// Source: app/lib/anti-insinuacion-guard.test.ts (VERIFIED — estructura a extender)
const SUPERFICIES_VSIM: string[] = [
  "components/similitud-votacion-comparar.tsx",
  // app/comparar/page.tsx ya está en SUPERFICIES_RELACIONES (no duplicar)
];
// TERMINOS_PROHIBIDOS += idioms VSIM DEDUPE-ados (ver Pitfall 4)
// NEGACIONES_LOCKED += LEYENDA_SIMILITUD_VOTO (importada verbatim, ver Pitfall 3)
// bucle: [...SUPERFICIES_VOTO, ..., ...SUPERFICIES_RELACIONES, ...SUPERFICIES_VSIM]
// + un test de mutación EN MEMORIA por cada idiom nuevo ("votan parecido", "tasa de coincidencia", ...)
```

### RTL de ausencia con flag OFF (mold page.test.tsx)
```typescript
// Source: app/app/comparar/page.test.tsx (VERIFIED — patrón renderEjes/renderToStaticMarkup)
// Con VSIM_PUBLIC_ENABLED ausente/"false": la sección NO está en el DOM.
it("flag OFF → la sección de similitud está AUSENTE del DOM", async () => {
  // vsimPublicEnabled lee process.env; el test controla el env (vi.stubEnv o inyección)
  const html = await renderEjes("D1001", "D1002");
  expect(html).not.toContain("Similitud de votación");
  expect(html).not.toContain("La coincidencia alta es la norma");
});
// Con flag ON: la sección + caveat + figura presentes; RPC mockeada devuelve {n,m,fecha}.
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Cifra de voto "548.642" (memoria vieja) | **283.550 confirmados** (186 parl, 4.855 votaciones) | Phase 98 (2026-07-24) | El denominador y la cobertura salen de esta cifra corregida, no de la vieja |
| `co_votacion` como arista candidata | EXCLUIDO permanente del /red (explosión de clique + insinuación espacial) | 0030_net.sql / v10.0 REQUIREMENTS Out of Scope | El test estático VSIM-03 lo enforza; las ramas latentes deben resolverse |

**Deprecated/outdated:**
- Backfill de votos 66/67 (deuda operador): parcialmente pendiente → la cobertura del denominador refleja SOLO lo confirmado HOY (Cámara 261.736 / Senado 21.814 votos confirmados). El copy de cobertura ~80%/~20% viene del audit Phase 98.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Los % de cobertura ~80% (Cámara) / ~20% (Senado) del UI-SPEC provienen del audit Phase 98 y son el techo honesto | Copy de cobertura | Bajo — son cifras declaradas del audit, no del research; el research confirmó que AMBAS cámaras tienen confirmados con parlamentario_id (261.736 dip / 21.814 sen votos). El % de cobertura de la 68-02 (Cámara 80% determinista, Senado 20% por nombre) sigue vigente; se debe citar del audit, no recomputar aquí |
| A2 | `fecha_captura_max` del par (max fecha_captura de las votaciones compartidas) es el valor de provenance esperado | RPC 0068 diseño | Bajo — CONTEXT lo especifica explícitamente; rango DB actual 2026-07-09..2026-07-24 |

**Nota:** el denominador SQL, el timing, la base-rate empírica, el schema, el mold del gate/guard/linter/dossier/RPC y el conflicto co_votacion están TODOS verificados (no asumidos).

## Open Questions

1. **Tratamiento de `co_votacion` en /red (Pitfall 1)**
   - What we know: dos líneas de código vivo (pero inalcanzable) en `red-graph.tsx` + `arista-hecho.tsx`; 0 aristas en DB; CHECK constraint las bloquea.
   - What's unclear: si eliminar (recomendado, opción A) o allowlistar (opción B).
   - Recommendation: eliminar las ramas muertas + verificar `red-graph.test.tsx`; deja el árbol limpio y el test escanea crudo, verde permanente.

2. **Cómo el test controla `VSIM_PUBLIC_ENABLED` en la RTL**
   - What we know: `vsimPublicEnabled(process.env)` lee el env; los tests de comparar mockean supabase pero no tocan env hoy.
   - What's unclear: usar `vi.stubEnv("VSIM_PUBLIC_ENABLED", ...)` vs. inyectar el env como parámetro.
   - Recommendation: como `moneyPublicEnabled` acepta `env` inyectado, el componente/rama puede recibir el booleano ya resuelto (o el SC llama `vsimPublicEnabled()` y el test usa `vi.stubEnv`). Decisión menor de plan.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Supabase Postgres (SUPABASE_DB_URL) | 0068 apply + pgTAP + denominador research | ✓ | Postgres (Supabase) | — |
| psql (PGCLIENTENCODING=UTF8) | Aplicar 0068 + pgTAP | ✓ (usado en este research) | — | — |
| voto/votacion tablas pobladas | RPC 0068 | ✓ | 283.550 conf / 4.855 votaciones | — |
| índice voto_parlamentario_id_idx | Performance pairwise | ✓ | (existe) | — |
| vitest / node | Guards + RTL | ✓ (repo) | — | — |

**Missing dependencies with no fallback:** ninguna.
**Missing dependencies with fallback:** ninguna. La fase es code/SQL/docs sobre infraestructura existente.

## Validation Architecture

> nyquist_validation asumido enabled (config no lo marca `false`).

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest (app) + pgTAP (DB) |
| Config file | `app/vitest.config.ts` (existe) |
| Quick run command | `pnpm --filter ./app test` |
| Full suite command | `pnpm test` (root) + `PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" -tA -f supabase/tests/0068_*.test.sql` |
| pgTAP run | contra schema APLICADO tras el psql --single-transaction de 0068 |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| VSIM-01 | RPC 0068 existe, secdef, timeout 5s, doble-revoke, emite n_coinciden/m_compartidas/fecha_captura_max, NO lista individual | pgTAP | `psql -tA -f supabase/tests/0068_coincidencia_votos_par.test.sql` | ❌ Wave 0 (mold 0067) |
| VSIM-01 | Denominador "sustantiva" (si/no/abstencion, confirmado) correcto sobre un fixture | pgTAP | idem (fixture de par con pareo/ausente que NO deben contar) | ❌ Wave 0 |
| VSIM-01 | Sección similitud renderiza figura+caveat+cobertura con flag ON; figura neutral (sin petróleo/bold) | RTL (vitest) | `pnpm --filter ./app test comparar` | ❌ Wave 2 |
| VSIM-01 | M=0 → copy degradado honesto, jamás "0%" | RTL | idem | ❌ Wave 2 |
| VSIM-02 | Gate `=== "true"` fail-closed (5 casos) | vitest | `pnpm --filter ./app test vsim-gate` | ❌ Wave 0 |
| VSIM-02 | Anti-flip V1 (gate estricto) · V2 (.env.example=false) · V3 (no raw env) + mutation self-check | vitest | `pnpm --filter ./app test vsim-antiflip` | ❌ Wave 0 |
| VSIM-02 | Flag OFF → sección AUSENTE del DOM (return null, cero rpc) | RTL | `pnpm --filter ./app test comparar` | ❌ Wave 2 |
| VSIM-02 | `coincidencia_votos_par` en PUBLIC_RPC_ALLOWLIST (Direction-B) | vitest | `pnpm --filter ./app test lockdown-guard` | ❌ Wave 0 (allowlist + migración escrita) |
| VSIM-03 | Idioms VSIM en TERMINOS_PROHIBIDOS + leyenda en NEGACIONES_LOCKED + self-check por idiom | vitest | `pnpm --filter ./app test anti-insinuacion` | ✅ (extender) |
| VSIM-03 | `co_votacion`/`covotacion` ∉ superficie /red (test estático permanente) | vitest | `pnpm --filter ./app test co-votacion-red` | ❌ Wave 0 (NUEVO) |

### Sampling Rate
- **Per task commit:** `pnpm --filter ./app test <archivo tocado>` (gate/guard/linter/RTL)
- **Per wave merge:** `pnpm --filter ./app test` completo + tsc
- **Phase gate:** suite app verde + pgTAP 0068 verde contra schema aplicado + guards (gate/anti-flip/anti-insinuación/co_votacion∉red) verdes antes de `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `app/lib/vsim-gate.ts` + `app/lib/vsim-gate.test.ts` — VSIM-02 (mold money-gate)
- [ ] `app/lib/vsim-antiflip-guard.test.ts` — VSIM-02 (mold money-antiflip; + línea `.env.example`)
- [ ] `.env.example` línea `VSIM_PUBLIC_ENABLED=false` — VSIM-02 (lo exige el guard V2)
- [ ] `app/lib/anti-insinuacion-guard.test.ts` extendido — VSIM-03 (SUPERFICIES_VSIM + idioms + NEGACIONES_LOCKED)
- [ ] `app/.../co-votacion-red-guard.test.ts` — VSIM-03 (NUEVO) + RESOLVER co_votacion latente en 2 componentes /red
- [ ] `supabase/migrations/0068_coincidencia_votos_par.sql` ESCRITA — VSIM-01 (para que la allowlist Direction-B no quede huérfana, lección 101-02)
- [ ] `"coincidencia_votos_par"` en `PUBLIC_RPC_ALLOWLIST` (lockdown-guard) — VSIM-02

## Security Domain

> security_enforcement asumido enabled.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Ruta pública read-only; sin auth de usuario en esta fase |
| V3 Session Management | no | — |
| V4 Access Control | yes | RPC secdef + doble-revoke CERO grant (anon/authenticated/public); sitio corre service_role (Camino A); flag server-only decide exposición |
| V5 Input Validation | yes | `p_a`/`p_b` validados contra `PARLAMENTARIO_ID_RE` en el SC ANTES del `.rpc()`; parámetros bind (no interpolación); statement_timeout '5s' (DoS día-1) |
| V6 Cryptography | no | Sin datos cifrados nuevos |

### Known Threat Patterns for {Next SC + Postgres RPC}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| SQL injection vía id de parlamentario | Tampering | Parámetros bind en `.rpc()` + `PARLAMENTARIO_ID_RE` pre-validación (V5) |
| DoS por query pesada | Denial of Service | `statement_timeout = '5s'` en la función; query prototipada en 28ms |
| Fuga de superficie REST no autenticada | Elevation of Privilege | doble-revoke `from anon, authenticated` + `from public` (lockdown-guard bloquea cualquier grant residual) |
| Encendido accidental del gate por código | Tampering | anti-flip guard (V1/V2/V3 + mutation self-check); flip = acto humano tras dossier `approved` |
| Insinuación/difamación en el copy (riesgo #1) | Information Disclosure / Repudiation | linter anti-insinuación + caveat VERBATIM + sign-off legal humano (el linter REDUCE, el sign-off GARANTIZA) |
| Exposición espacial de co-votación (DW-NOMINATE) | Information Disclosure | co_votacion ∉ /red (test estático) + figura neutral sin petróleo/gauge + anti-modelo en dossier |

## Sources

### Primary (HIGH confidence)
- DB viva (`SUPABASE_DB_URL`, psql PGCLIENTENCODING=UTF8) — schema `voto`/`votacion`, counts (283.550 conf/186/4.855), distribución seleccion, denominador prototipado (28ms explain analyze), base-rate empírica (19-100%, avg 63%), aristas por tipo (solo co_lobby_contraparte 7394)
- `app/lib/money-gate.ts` + `money-gate.test.ts` + `money-antiflip-guard.test.ts` — mold exacto del gate + anti-flip (V1/V2/V3 + self-check)
- `app/lib/anti-insinuacion-guard.test.ts` — estructura completa del linter (SUPERFICIES_*, TERMINOS_PROHIBIDOS, NEGACIONES_LOCKED, buildTermRegex, detectarInsinuaciones, self-check)
- `app/app/comparar/page.tsx` + `page.test.tsx` — mount point exacto (CompararEjes return), disciplina de validación/error, patrón renderEjes/renderToStaticMarkup
- `supabase/migrations/0067_*.sql` + `supabase/tests/0067_*.test.sql` — mold RPC bounded + pgTAP
- `app/lib/lockdown-guard.test.ts` — PUBLIC_RPC_ALLOWLIST (Direction-B)
- `app/components/red/red-graph.tsx` + `arista-hecho.tsx` + `supabase/migrations/0030_net.sql` — co_votacion latente + CHECK constraint
- `docs/legal/13-LEGAL-DOSSIER.md` — mold dossier (front-matter signoff, secciones, checklist)
- `.env.example` — solo MONEY_PUBLIC_ENABLED presente (gap VSIM confirmado)

### Secondary (MEDIUM confidence)
- Cifras de cobertura ~80%/~20% (audit Phase 98 / STATE 68-02) — citadas, no recomputadas en este research

### Tertiary (LOW confidence)
- Ninguna. Todo verificado contra DB o archivos reales.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — cero paquetes nuevos; todo el stack ya en el repo y verificado
- Architecture: HIGH — cada pieza tiene mold funcionando en PROD, leído verbatim
- Pitfalls: HIGH — el co_votacion latente y el gap de `.env.example` se verificaron por grep/read; los otros derivan de moldes leídos
- Datos/denominador: HIGH — schema, counts, timing y base-rate medidos en DB viva

**Research date:** 2026-07-24
**Valid until:** 2026-08-23 (30 días — stack estable; los counts de voto pueden crecer con backfill operador, pero el diseño no cambia)
