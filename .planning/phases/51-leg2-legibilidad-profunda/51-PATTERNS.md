# Phase 51: LEG2 — Legibilidad profunda (P2) - Pattern Map

**Mapped:** 2026-07-02
**Files analyzed:** 12 (9 modified, 3 new)
**Analogs found:** 12 / 12 (100% — extend-in-place phase, every target has a live analog)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `app/components/votos-por-parlamentario.tsx` (EXTEND: línea-resumen/arco + `?votosVer`) | component (RSC + pure helper) | transform + request-response (searchParams) | itself — `agruparPorProyecto:180`, `ProyectoGrupo:206` | exact (self-extend) |
| `app/components/voto-ficha-row.tsx` (DELETE dead code B24) | component | transform | itself — `SustanciaYDesenlace:76-106` | exact (self) |
| `app/components/timeline-view.tsx` + `timeline-event.tsx` (2 niveles + colapso urgencia + 1 badge/heading) | component | transform + request-response | itself — `TimelineView`, `TimelineEvent` | exact (self-extend) |
| `app/components/estado-actual-block.tsx` (NEW "¿dónde está hoy?") | component (RSC pure) | transform (derivación honesta) | `timeline-event.tsx` (badge+link idiom) + `patrimonio` degrade pattern | role-match |
| `app/components/patrimonio-de-parlamentario.tsx` (tarjeta-resumen + form GET + filtro URI) | component (RSC + form GET) | transform + request-response | itself — `seriePatrimonio:126`, `buildVerHref:198`, `AtribucionCcBy:206` | exact (self-extend) |
| `app/components/lobby-de-parlamentario.tsx` (agrupar por contraparte + `?vista` + caveat 1×) | component | transform + request-response | itself — `agruparAudiencias:278`, `ContraparteCruda:99` | exact (self-extend) |
| `app/components/parlamentario-header.tsx` (período + chip asistencia) | component | request-response | itself — `cargoPartes:31-37` | exact (self-extend) |
| `app/app/layout.tsx` (footer global nuevo) | layout (RSC) | request-response | itself + `/sobre` copy (CC BY block) | exact (self-extend) |
| `app/app/parlamentario/[id]/page.tsx` (header enriquecido + chip) | route (RSC) | request-response | itself (section-wrapping idiom) | exact (self) |
| `app/app/proyecto/[boletin]/page.tsx` (bloque estado-actual nuevo) | route (RSC) | request-response | itself — `TimelineSection:149-167` | exact (self-extend) |
| `app/app/metodologia/page.tsx` (NEW) | route (RSC static) | request-response | `app/app/sobre/page.tsx` | exact (twin) |
| `supabase/migrations/00XX_rebeldias_honestas.sql` (NEW drop+recreate RPC) | migration | CRUD (DDL) | `0028_votos_instructivos.sql` | exact (drop+recreate twin) |

## Pattern Assignments

### `app/components/votos-por-parlamentario.tsx` (SC1) — línea-resumen por arco + `?votosVer`

**Analog:** itself (`agruparPorProyecto:180`, `ProyectoGrupo:206`) + `patrimonio-de-parlamentario.tsx:198` (href builder)

**Agrupación por arco YA existe** (`agruparPorProyecto:180-198`) — preserva orden por fecha, `titulo`/`idea` de la primera fila (LEFT JOIN → null honesto). El helper NUEVO `resumenDeArco(arco)` cuenta `e.seleccion` sobre `arco.etapas` y saca rango min/max de `e.fecha`. Cero RPC nueva — `agruparPorProyecto` ya tiene todas las etapas del arco en memoria.

**Href builder pattern** (copiar exacto de `patrimonio:198-203`):
```tsx
function buildVerHref(id: string, versionId: string | null): string {
  const qs = new URLSearchParams();
  if (versionId) qs.set("ver", versionId);
  const q = qs.toString();
  return `/parlamentario/${id}${q ? `?${q}` : ""}#patrimonio`;
}
// → replicar como buildVotosVerHref(id, boletin) con qs.set("votosVer", boletin) y #votos
```

**Fila-etapa a colapsar en línea-resumen** (`ProyectoGrupo:236-278`): hoy renderiza cada etapa como `<li>` con Badge + etapa + `fechaCorta` + resultado + `conteoVotacion` + `ProvenanceBadge`. En la vista colapsada esto queda detrás de `?votosVer=<boletin>`; el default es una sola línea-resumen. Reusar `conteoVotacion`, `fechaCorta`, `extractoIdea` (NO hand-roll — ver Shared Patterns).

**Rebeldías consumer** (`VotosView:496-537`): hoy muestra `Boletín N°{r.boletin}` (:519). Tras SC5 el `RebeldiaRow` crece con `titulo` → cambiar a título enlazado (mismo idiom que `ProyectoGrupo:210-224`: `titulo ? <Link>{titulo}</Link> : <Link>Boletín N°{boletin}</Link>`). El copy neutro (:531-534 "Se compara el voto...") se mantiene; si se separan ausencias, línea neutra aparte NUNCA mezclada.

---

### `app/components/voto-ficha-row.tsx` (B24) — borrar dead code honest-state por fila

**Analog:** itself (`SustanciaYDesenlace:76-106`)

**Dead path to delete** (`voto-ficha-row.tsx:86-90`):
```tsx
{idea_matriz
  ? `De qué trata: ${extractoIdea(idea_matriz)}`
  : "De qué trata: no disponible aún"}   // ← B24: honest-state POR FILA
```
El honest-state ya se dice 1× por sección en `ProyectoGrupo` (`votos-por-parlamentario.tsx:225-232` — comenta explícitamente "NO se repite el honest-state por arco... una única nota de sección lo cubre"). **Grep `VotoFichaMencionRow` y `VotoFichaRow` por consumidores (tests/fixtures) ANTES de borrar el archivo entero** (Assumption A6). Si `VotoFichaMencionRow` tiene consumidores, refactorizar el camino de menciones en vez de borrar.

---

### `app/components/timeline-view.tsx` + `timeline-event.tsx` (SC2/SC7/B19)

**Analog:** itself

**Estructura actual** (`TimelineView:9-28`): lista plana `<ul>` con rail CSS, mapea `TramitacionEventoRow[]` (fecha ASC, ya ordenado por el server). `TimelineEvent:13-62` renderiza dot por cámara + `CamaraChip` + `fechaCorta` + tipo + descripción + link "Ver fuente oficial ↗" (:41-51) + `ProvenanceBadge` (:53-59) **por evento**.

**SC7 (1 badge/heading):** mover UN `ProvenanceBadge` al heading de la sección timeline (en `proyecto/[boletin]/page.tsx`, no en `TimelineEvent`); conservar el link "Ver fuente oficial ↗" por evento (`TimelineEvent:41-51`). El `ProvenanceBadge` por evento (:53-59) se retira.

**B19 (colapso conservador):** helper puro `esEventoUrgencia(e)` + `paresDeUrgencia(eventos)`. Heurística LOCKED (Pitfall 3):
```ts
function esEventoUrgencia(e: TramitacionEventoRow): boolean {
  return e.tipo === "urgencia" ||
    (e.tipo === "tramite" && /urgencia/i.test(e.descripcion));
}
// TODO evento fuera de este patrón = hito estructural, render normal (TimelineEvent tal cual).
// Colapsar contiguos del mismo tipo → "Urgencia {tipo} renovada N veces entre {mesX} y {mesY} — ver todas"
// Expand server-driven: ?urgencias=<periodo> (mismo idiom que buildVerHref).
```

---

### `app/components/estado-actual-block.tsx` (SC2, NEW) — "¿dónde está hoy?"

**Analog:** `timeline-event.tsx` (link+badge idiom) + `seriePatrimonio` (omisión honesta)

Server Component nuevo, primer elemento tras el header en `proyecto/[boletin]/page.tsx`, antes de `#idea-matriz`. Deriva 3 líneas y **omite la línea si el dato no es derivable** (espejo de `seriePatrimonio:130-137` que excluye el punto cuando el año no parsea):
- etapa/estado (campo directo de tabla `proyecto`)
- último hito (fecha + descripción del último `tramitacion_evento`)
- urgencia vigente: último `hace presente ... urgencia {tipo}` sin `retira ... urgencia` posterior (derivar de eventos; NO hay campo `urgencia_actual` en tabla `proyecto`)
- "hace N días" → usar `relativeTimeEs` (`lib/format.ts`) + fecha absoluta (NO hand-roll)

---

### `app/components/patrimonio-de-parlamentario.tsx` (SC3/SC4)

**Analog:** itself

**SC3 tarjeta-resumen — reusar `seriePatrimonio:126-159`** (LOCKED por CONTEXT, misma fuente de verdad que chart F46): emite `SeriePunto` con conteos `{ inmueble, mueble, actividad, pasivo, accion_derecho, valor }` por versión. La tarjeta muestra "Declaración de {tipo}" + "Presentada el {fechaCortaSegura}" + conteos con labels de `ORDEN_GRUPOS_BIENES:232-239`. "Ver detalle" mantiene `?ver=<versionId>` vía `buildVerHref:198-203`. Jamás el `<dl>` completo inline.

**Filtro URI CPLT (Pitfall 4):** helper puro `esUriCplt(valor)` — `/^https?:\/\/datos\.cplt\.cl\//.test(valor)` (VALIDAR prefijo exacto contra datos PROD, Assumption A1). Excluir el par de tarjeta Y detalle. Aplica a `paresDeContenido` (BienesDeVersion) y `campos` (VersionRow).

**SC4 comparador — `<form method="get">` nativo, cero JS.** `PatrimonioSection:786-857` YA lee `?comparar` y llama `comparar_declaraciones`. Falta solo el form con dos `<select>` de `version.fecha_presentacion`. Recomendación research (Pattern 3): leer `?a`/`?b` en el section y reconstruir/compat con `?comparar=A,B`. Con <2 versiones: OMITIR el form, conservar `DeclaracionComparacion:576-586` (hecho neutro). Copy: "Elige dos fechas para comparar".

**CC BY reuse** (`AtribucionCcBy:206-222`): NO duplicar — reusar para la atribución de sección.

---

### `app/components/lobby-de-parlamentario.tsx` (SC6/B11)

**Analog:** itself (`agruparAudiencias:278`, `ContraparteCruda:99`)

**El RPC no pagina** (`lobby-de-parlamentario.tsx:341` — `sb.rpc("lobby_de_parlamentario", { p_id: id })` trae TODO). Helper puro NUEVO `agruparPorContraparte(audiencias)` → `Grupo[] { contraparte, n, fechas[] }` ordenado por `n` DESC. Es la **vista DEFAULT**. Toggle `?vista=cronologica` preserva la `LobbyView` paginada actual (`?lobbyPage`, href builder `:95`).

**B11 caveat 1×/sección:** nota única al tope (como `LobbyView:133-139` `intro`), **quitar `<IdentityMarker/>` de `ContraparteCruda:118`**. Contraparte sigue texto crudo VERBATIM (`:103`), NUNCA enlazada (el RPC no emite `contraparte_id`). Reusar el conteo neutro idiom (`:174-180`).

---

### `app/components/parlamentario-header.tsx` (SC1§2.1)

**Analog:** itself (`cargoPartes:31-37`)

**AÑADIR período** a `cargoPartes` (:31-37) — `parlamentario_publico` ya emite `periodo` (verificado 0020). Solo usar campos de `ParlamentarioPublicoRow`: `region`, `distrito`, `circunscripcion`, `periodo`. **NUNCA `partido`/`rut`/`email`** (Pitfall 7, LEGAL-03 — el RPC ni los devuelve; el header comenta la decisión en :14-19). Chip "Presente en N de M" se deriva de `contarCarriles`/datos de votos (ya computado en `VotosView`: `presentes = totalConteos - ausentes`), va en el resumen above-fold (no en el header PII).

---

### `app/app/layout.tsx` (SC8, footer global)

**Analog:** itself (`:36-43`) + `/sobre` CC BY copy

Body hoy = `<GlobalHeader /> + {children}` SIN footer (:38-41). Añadir `<footer>` tras `{children}`: atribución + CC BY 4.0 con scope-caveat (NO contradecir ChileCompra "mención de la fuente" / SERVEL "términos por verificar" — esas siguen por sección) + links `/metodologia` y `/sobre` + contacto. Reusar la copy y el `<a>` CC BY de `sobre/page.tsx:92-103`.

---

### `app/app/metodologia/page.tsx` (SC8, NEW)

**Analog:** `app/app/sobre/page.tsx` (twin exacto)

Copiar molde de `/sobre`: `export const metadata`, `<main className="max-w-3xl mx-auto px-4 md:px-8 py-8 md:py-16">`, secciones con `<h2>` + `<Separator>`, "← Volver al inicio". Página mínima HONESTA sobre su alcance actual (Pitfall 6) — NO prometer diccionario de datos completo (eso es milestone futuro; `/sobre:9-11` ya lo declara).

---

### `supabase/migrations/00XX_rebeldias_honestas.sql` (SC5, NEW)

**Analog:** `0028_votos_instructivos.sql` (drop+recreate twin) + `0019_voto_asistencia_y_ficha.sql:73-98` (RPC vigente)

**Drop+recreate por 42P13** (el `returns table` crece con `titulo`) — espejo exacto de `0028:31-32`:
```sql
drop function if exists rebeldias_de_parlamentario(text);
```
**Diferencias vs 0028:** rebeldías es `SECURITY DEFINER SET search_path=''` (lee `parlamentario.partido` interno — PII; 0028 es INVOKER porque no toca `parlamentario`). El fix excluye `seleccion <> 'ausente'` del cálculo Y de la salida, `DISTINCT ON (votacion_id)` dedupe, `LEFT JOIN proyecto` para hidratar `titulo` (null honesto). Ver esbozo SQL en 51-RESEARCH.md §Code Examples 4 (marcado [ASSUMED] — validar `mode()`/`DISTINCT ON` con pgTAP).

**Re-emitir doble revoke + grant** (gotcha DEFAULT PRIVILEGES re-concede a anon en función nueva):
```sql
REVOKE ALL ON FUNCTION rebeldias_de_parlamentario(text) FROM public;
GRANT EXECUTE ON FUNCTION rebeldias_de_parlamentario(text) TO anon;
```
**⚠️ OPEN QUESTION — el guard lockdown bloqueará este grant.** Ver Shared Patterns → Lockdown guard.

**Apply = checkpoint operador** (psql `--db-url`, nunca `db push`); pgTAP acompaña (`supabase/tests/`). El comentario de cabecera de `0028:23-29` es el molde exacto de la advertencia "build/typecheck NO prueban que Postgres ejecutó el DDL".

## Shared Patterns

### Server-driven detail toggle (searchParams) — SC1, SC2, SC4, SC6
**Source:** `app/components/patrimonio-de-parlamentario.tsx:198-203` (`buildVerHref`)
**Apply to:** `?votosVer`, `?urgencias`, `?vista`, comparador
```tsx
function buildVerHref(id: string, versionId: string | null): string {
  const qs = new URLSearchParams();
  if (versionId) qs.set("ver", versionId);
  const q = qs.toString();
  return `/parlamentario/${id}${q ? `?${q}` : ""}#patrimonio`;
}
```
Sections reciben `searchParams` YA RESUELTO como objeto plano (Next 16: la Promise se hace `await` en la page, NO re-await en el section — Pitfall 5). Usar helper `single(k)` de `PatrimonioSection:779-782` para `string[]`.

### Formatters/helpers — NO hand-roll (todos en `lib/format.ts`)
**Apply to:** todos los componentes de esta fase
- `fechaCorta` / `fechaCortaSegura` (guard ISO anti-"Invalid Date")
- `extractoIdea` (truncado literal en límite de palabra)
- `conteoVotacion(si, no)` → "58–81" (en-dash U+2013)
- `relativeTimeEs` ("hace N días" + fecha absoluta ≥7d) — para EstadoActualBlock
- `esStale` / `STALE_THRESHOLD_MS` (14d, F50) — umbral ámbar de provenance
- `ProvenanceBadge` — trazabilidad canónica (NO nuevo badge)

### Lockdown guard — grant a anon en migración >0044 (SC5 blocker)
**Source:** `app/lib/lockdown-guard.test.ts:191-202` (regex `/grant\s+\S[\s\S]*?\bto\s+[\w,\s]*\banon\b/`)
**Apply to:** migración de rebeldías
El `GRANT EXECUTE ON FUNCTION rebeldias_de_parlamentario(text) TO anon` **casa el regex y falla la suite** (LOCKDOWN_CUTOFF=44). El RPC YA está en `PUBLIC_RPC_ALLOWLIST` (`:170`) — el intent es que anon lo ejecute. **OPEN QUESTION (decisión operador/seguridad):** (a) refinar el regex del guard para no marcar `grant execute on function` (no expone filas, solo ejecuta security-definer PII-safe), con test que lo documente [research recomienda esto]; o (b) mover el grant a sección/archivo exento. NO asumir la resolución — el planner la confirma con el operador.

### Anti-insinuación doctrine (SC9) — invariantes LOCKED
**Source:** `page-estructura.test.ts` (source-scan) + tests RTL por componente (banned-vocab)
**Apply to:** todos los agregados/conteos/colapsos nuevos
- `mt-12` entre carriles hermanos — frontera LOCKED (Test 1 falla si se colapsa)
- cero composición cross-dominio (voto + reunión/declaración en un mismo `<li>/<article>/<tr>`)
- honest-state 1× por sección (todo el punto de borrar B24)
- conteos NEUTROS (único agregado permitido; nunca suma de montos/delta/veredicto/ranking)
- NUNCA colapsar un evento de timeline que no sea par de urgencia (hitos estructurales siempre visibles)

### Tests (SC9) — convención del repo
**Source:** `*.test.tsx` (RTL con fixtures) + `page-estructura.test.ts` / `lockdown-guard.test.ts` (source-scan)
**Apply to:** helpers puros nuevos (`resumenDeArco`, `agruparPorContraparte`, `paresDeUrgencia`, `derivarEstadoActual`, `esUriCplt`)
- Vistas puras RTL con fixtures + asserts banned-vocab/atribución
- Source-scan estructural resuelve rutas por `process.cwd()` + `path.join`, **NUNCA `import.meta.url`/`import.meta.dirname`** (Pitfall 8, OneDrive rompe `file://`)
- pgTAP por migración (SC5): fixture Alessandri (7 filas hoy todas ausencias → debe quedar 0 tras el fix, Assumption A2)

## No Analog Found

Ninguno. Esta fase es 90% extend-in-place: cada archivo objetivo tiene un analog exacto (a menudo él mismo) en el codebase. El único componente 100% nuevo (`estado-actual-block.tsx`) compone idioms ya existentes (link+badge de `timeline-event`, omisión honesta de `seriePatrimonio`). La única migración nueva es un drop+recreate twin de `0028`.

## Metadata

**Analog search scope:** `app/components/`, `app/app/`, `supabase/migrations/`, `app/lib/`
**Files scanned:** 12 read in full/targeted (patrimonio, votos, lobby, timeline×2, layout, parlamentario-header, sobre, proyecto page, voto-ficha-row, lockdown-guard, 0028 migration)
**Pattern extraction date:** 2026-07-02
