# Phase 18: NET — Grafo de influencia (`@xyflow/react`) - Context

**Gathered:** 2026-06-21
**Status:** Ready for planning
**Mode:** mvp. Decisión macro del operador (2026-06-21): "todo gated-OFF" — construir el grafo COMPLETO (modelo de datos + materialización + RPC + UI) pero **detrás del gate `NET_PUBLIC_ENABLED` apagado**, igual que MONEY 14-16. La exposición pública NO se enciende hasta el sign-off legal (Phase 17, `17-LEGAL-DOSSIER.md` `signoff: approved`).

<domain>
## Phase Boundary

El ciudadano explora una **red de relaciones entre parlamentarios** derivada de los datos YA poblados — cada arista un **hecho público con fuente y ventana temporal**, **ambos extremos con identidad `confirmado`**, **sin lenguaje causal**. NET es **consumidor puro** de los tres bloques (VOTE, INT lobby/patrimonio, MONEY); no ingiere datos nuevos.

**Dentro de alcance (gated-OFF):** (1) modelo `entidad`/`arista` en Postgres; (2) materialización de aristas vía proc `pg_cron` (sin DB de grafos); (3) RPC público con CTE recursiva PII-safe; (4) UI `@xyflow/react@12` como **client island** con filtros por tipo de arista y por tiempo, provenance por arista, copy sobrio ES; (5) gate `NET_PUBLIC_ENABLED` (doble candado RLS + flag server-only, default OFF) + `app/lib/net-gate.ts` espejo de `money-gate.ts`; (6) tests (pgTAP + RTL).

**Fuera de alcance:** encender la exposición pública (gate cerrado hasta sign-off F17); aristas que dependan de MONEY mientras MONEY esté gated (las aristas MONEY-derivadas nacen tras DOBLE gate: `NET_PUBLIC_ENABLED` AND `MONEY_PUBLIC_ENABLED`); aristas inferidas por LLM (PROHIBIDO); cualquier path-finding como feature destacada.
</domain>

<decisions>
## Implementation Decisions

### Anti-insinuación HARD (LOCKED — DESIGN-SYSTEM §6/§8, UI-SPEC §9, 17-LEGAL-DOSSIER)
- **La superficie más insinuante del producto.** El riesgo NUCLEAR (17-LEGAL-DOSSIER §2) es que **una arista o un camino se lea como acusación**. Mitigaciones OBLIGATORIAS:
  - Toda arista es un **hecho tipado, con fuente y ventana temporal**; el copy describe el hecho ("votaron en la misma votación X el DD/MM", "ambos recibieron audiencia de la contraparte Y"), NUNCA una valoración ni una relación de afinidad/cercanía.
  - **PROHIBIDO:** score de sospecha/influencia, ranking de personas, path-finding presentado como feature destacada ("conexión entre A y B"), lenguaje causal ("por eso", "a cambio de"), afinidad/cercanía política, aristas inferidas por LLM.
  - **Ambos extremos `confirmado`** (identidad auditada) — nunca una mención sin verificar como nodo.
  - **Partido NUNCA** llega a anon (piso PII 0018; lobby/probidad 0021/0022). El nodo es el parlamentario sin foto/partido.
- **Taxonomía de aristas (Claude's Discretion, guiada por anti-insinuación):** definir en research/plan el set MÍNIMO de tipos de arista defendibles como hechos públicos descriptivos. Candidatos a evaluar (cada uno con su fuente + ventana): co-asistencia a una misma audiencia de lobby (misma contraparte, fuente lobby), co-votación en una misma votación (con sentido, fuente votación). Las aristas **MONEY-derivadas** (mismo contratista/donante) quedan tras DOBLE gate. NO incluir ninguna arista que solo tenga sentido como insinuación.

### Modelo de datos y materialización (NET-01)
- Tablas `entidad` (nodo: parlamentario confirmado; tipo) y `arista` (tipo, extremo_a, extremo_b, fuente/provenance, ventana temporal `desde`/`hasta`, dataset de origen, licencia). RLS deny-by-default a anon (mismo patrón 0018/0021/0022).
- **Materialización por `pg_cron`** (no on-the-fly): un proc puebla `arista` desde los bloques ya poblados; ambos extremos deben ser `confirmado` o la arista no se materializa. Idempotente.
- **RPC público con CTE recursiva** PII-safe: devuelve el subgrafo (nodos + aristas) para exploración, SIN partido/rut, solo extremos confirmados, con provenance + ventana por arista. Mismo gate LEGAL-03 que 0020/0026.

### UI (NET-02)
- `@xyflow/react@12` (instalar en `app/`), **client island** (Client Component) — el resto del sitio sigue server-first. La ruta NET (p.ej. `/red`) está **gateada por `NET_PUBLIC_ENABLED`** (server-side, `notFound()` o honest-state cuando OFF, espejo del patrón MONEY).
- Filtros por **tipo de arista** y por **tiempo** (ventana temporal). Cada arista trazable a su fuente (tooltip/panel con enlace).
- **CC BY 4.0 (NET-02 / 17-DOSSIER §6):** nodos/aristas derivados de **InfoProbidad** propagan la atribución CC BY 4.0 (en nodo/tooltip). Otros datasets llevan su atribución por fila.
- Diseño Phase 19: tokens crema/petróleo, voz editorial ES, estados honestos. EXTIENDE `globals.css`, NO toca `civic-tokens.css`.

### Gate de exposición (espejo de Phase 13/MONEY)
- `app/lib/net-gate.ts`: flag server-only `NET_PUBLIC_ENABLED` (default `false`, fail-closed). Oculta la ruta NET y el RPC del grafo mientras esté OFF.
- Doble candado: RLS deny-by-default sobre `entidad`/`arista` + flag de presentación.
- Encender depende de `17-LEGAL-DOSSIER.md` `signoff: approved` (deuda operador F17). Verificable por inspección.

### Claude's Discretion
- Taxonomía final de aristas (set mínimo defendible); nombre de la ruta y del flag; estructura del proc pg_cron y de la CTE recursiva; layout del grafo (xyflow); si el subgrafo se acota por nodo seleccionado o se sirve completo (acotado es más sobrio).
</decisions>

<code_context>
## Precedentes a reusar
- **Gate:** `app/lib/money-gate.ts` (`MONEY_PUBLIC_ENABLED`) → `net-gate.ts` lo espeja. Ruta gateada: ver `/contraparte/[id]` (notFound() gate) y secciones MONEY de la ficha.
- **RLS + RPC PII-safe:** `supabase/migrations/0018_piso_pii.sql`, `0020_parlamentario_publico.sql`, `0021_lobby.sql`, `0022_probidad.sql`, `0026_parlamentarios_publico_listado.sql` + sus pgTAP (0027). Patrón: revoke all from anon; RPC security INVOKER/DEFINER PII-safe; pgTAP afirma no-PII.
- **Identidad confirmada:** `estado_vinculo='confirmado'` (usado en votos/lobby); ambos extremos de toda arista lo exigen.
- **Datos fuente ya poblados:** `voto`/`votacion` (VOTE), `lobby`/`lobby_contraparte` (INT), `dinero`/`servel`/`agregacion` (MONEY, gated). NET deriva de estos; NO ingiere.
- **Migración siguiente:** la última aplicada es 0028 → NET arranca en 0030+ (0029 es el pgTAP de votos). OJO: `schema_migrations` remoto tiene drift (registra hasta 0025; aplicar por psql directo, NO `supabase db push`).
- **Build/deploy:** SOLO Linux (Docker obsbuild) + `wrangler deploy`. Como NET nace gated-OFF, el deploy NO expone nada nuevo públicamente (la ruta da notFound/honest-state).

## Anti-deuda
- `@xyflow/react@12` es una dep nueva client-side → confirmar bundle size aceptable y que sea client island (no infla el server bundle de las rutas existentes).
</code_context>

<specifics>
## Gate de verificación de la fase
- Modelo `entidad`/`arista` materializado por pg_cron; cada arista con provenance + ventana + ambos extremos `confirmado` (NET-01).
- RPC con CTE recursiva PII-safe (sin partido/rut); pgTAP lo afirma.
- UI `@xyflow/react` client island con filtros por tipo y tiempo; provenance por arista; CC BY 4.0 propagado desde InfoProbidad (NET-02).
- Gate `NET_PUBLIC_ENABLED` default OFF (test lo afirma); ruta NET da notFound/honest-state mientras OFF; ninguna arista inferida por LLM; cero score/path-as-accusation/causal en copy (negative-match grep).
- Tests verdes (vitest RTL + pgTAP); tsc limpio. Redeploy Linux (sin exponer NET).
</specifics>

<deferred>
## Deferred Ideas
- **Encender NET públicamente** — espera sign-off F17 (`17-LEGAL-DOSSIER` `signoff: approved`).
- **Aristas MONEY-derivadas expuestas** — doble gate (NET + MONEY).
- **Path-finding / centralidad / métricas de red** — riesgo de insinuación; fuera de alcance (no se diseña como feature).
- **Aristas inferidas por LLM** — PROHIBIDO permanentemente (solo aristas con fuente verificable).
</deferred>
