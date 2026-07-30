# Phase 130: VOTOS-REAL — B-01: el número falso muere - Context

**Gathered:** 2026-07-30 (modo autónomo — decisiones adjudicadas con recomendación logged)
**Status:** Ready for planning

<domain>
## Phase Boundary

Las 71/186 fichas afectadas muestran el conteo REAL de votos (ficha testigo: 3.752, no
`Ver detalle (1000)`) con composición no distorsionada. Un clamp de seguridad NO es un fix de
exactitud. Paralelizable con el carril panel (depende solo de 126) vía worktree.

Requirements: DEBT-01. NO incluye: paginación completa del listado (fuera de alcance), /comparar
(131), panel (127-129).
</domain>

<decisions>
## Implementation Decisions

### RPC de conteo dedicada (diseño lo firma el revisor Fable — mandato roadmap)
- **D-01:** RPC ADITIVA de conteo AGRUPADO — no un total pelado: devuelve las agrupaciones que la
  UI desglosa (dimensión exacta la mapea el research desde `VotosSection`/chip) + permite derivar
  el total por suma. Así chip Y composición salen del SQL sobre TODAS las filas — el desglose deja
  de derivar de un `order by fecha desc limit 1000` (raíz de B-01).
- **D-02:** Aguja completa OBLIGATORIA (regla LOCKED "RPC pública nueva"): cero-grant, secdef
  `search_path=''`, `statement_timeout`, LIMIT piso 1.000 (sobre filas agrupadas — trivialmente
  holgado), doble-revoke, alta en `PUBLIC_RPC_ALLOWLIST` del lockdown-guard, pgTAP contra schema
  aplicado. PII-safe: la RPC agrega, jamás emite fila individual con identidad+voto fuera del carril
  existente.
- **D-03:** La RPC existente `votos_de_parlamentario` (p_limit 1000) queda INTACTA y sigue
  sirviendo el listado de detalle — firma viva jamás se altera (42P13). El comentario WR-03 del
  código (parlamentario-resumen-conteos.ts:271-277) prescribe exactamente esto.

### UI simultánea
- **D-04:** Chip del índice above-fold y `VotosSection` cambian en el MISMO commit/deploy: ambos
  leen el conteo real de la RPC nueva; el listado de detalle puede seguir capado a 1000 filas
  mostradas PERO todo número visible es el real y si el render recorta declara "N de M" honesto.
- **D-05:** Test que MUERDE si el cap vuelve a gobernar el número visible (criterio 4): assert de
  que el conteo mostrado NO proviene de `length` del listado capado (forma exacta la decide el
  plan: p.ej. mock de RPC de conteo vs listado con valores distintos → la UI muestra el del conteo).
- **D-06:** Verificación E2E contra PROD por `psql -tA | tr -d '\r'`: número mostrado == recálculo
  SQL verbatim (jamás REST, cap 1k de PostgREST). Sujetos testigo: la ficha con 3.752 y al menos
  otra de la clase afectada (71/186).

### Régimen
- **D-07:** Migración con el siguiente número LIBRE tras 0080 (verificar por `ls supabase/migrations`
  al ejecutar — 130 corre en paralelo con 127 que consume 0080; coordinar numeración al momento de
  crear el archivo, LOCKED: 0080 es de 127). Aplicación psql --single-transaction.
- **D-08:** Guard create-view de 126 vigila; la RPC nueva no crea views. El lockdown-guard L626/L773
  exige: entrada en allowlist correspondiente a función definida en migraciones + todo `.rpc()`
  literal allowlisted.

### Claude's Discretion
- Nombre de la RPC (sugerencia: `votos_conteo_de_parlamentario`).
- Si el desglose agrupa por uno o dos niveles (lo decide el shape actual de VotosSection).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

- `.planning/ROADMAP.md` §Phase 130 — 4 success criteria verbatim
- `.planning/REQUIREMENTS.md` — DEBT-01
- `app/lib/parlamentario-resumen-conteos.ts` L263-281 — el conteo actual capado + comentario WR-03
  que prescribe el fix
- `app/components/votos-por-parlamentario.tsx` — VotosSection actual (desglose a mapear)
- `app/lib/lockdown-guard.test.ts` — PUBLIC_RPC_ALLOWLIST (L195) + asserts L626/L773
- `milestones/v12.0-MILESTONE-AUDIT.md` — B-01 original (71/186 fichas, composición distorsionada)
- Precedente aguja completa: migraciones 0064 (bounded RPCs) / 0077-0079 (timeout/cotas/limit)
</canonical_refs>

<code_context>
## Existing Code Insights

- `contarCarrilesSeguro` (React.cache) lee `votos_de_parlamentario` con p_limit 1000 y usa `.length`
  — el chip sale de ahí. El fix: leer la RPC de conteo nueva en ese módulo (server-only,
  service_role vía Camino A).
- El sitio lee con service_role (Camino A): la barrera real es el allowlist del lockdown-guard, no
  el grant — la aguja completa aplica igual (doble-revoke para anon/authenticated).
- pgTAP fixtures se validan contra schema real (gotcha v5).
</code_context>

<specifics>
## Specific Ideas

- Cifra de referencia: votos confirmados TOTALES = 283.550 (jamás 549k). La ficha testigo de B-01
  muestra 3.752. El research debe identificar el ID de la ficha testigo desde el audit v12.
- Clamp de seguridad ≠ fix de exactitud (B-01 existe por esto — gotcha v12 §9).
</specifics>

<deferred>
## Deferred Ideas

- Paginación real del listado de votos (>1000 filas navegables) — fuera de DEBT-01.
</deferred>

---

*Phase: 130-VOTOS-REAL — B-01: el número falso muere*
*Context gathered: 2026-07-30*
