# Phase 131: DEBT-FICHA — Regla del timeline + co-autoría sin truncamiento - Context

**Gathered:** 2026-07-30 (modo autónomo — decisiones adjudicadas con recomendación logged)
**Status:** Ready for planning

<domain>
## Phase Boundary

Dos deudas de ficha independientes del carril panel (paralelizable con 130 vía worktree tras 126):
(H-06 / DEBT-03) la regla de selección del timeline queda gobernada por una query ESCRITA con
criterio declarado que explica la brecha 85 `Hito del` vs 99 eventos en el boletín testigo
`14309-04`, y el render la obedece (paridad query↔DOM);
(fila 3.3 / DEBT-04) la co-autoría de `/comparar` emite membresía de par COMPLETA sin truncamiento
silencioso — RPC firma v2 PARALELA (precedente 0060; la viva jamás se altera, 42P13).

NO incluye: panel (127-129), conteo de votos (130), rediseño visual del timeline.
</domain>

<decisions>
## Implementation Decisions

### H-06 — regla del timeline (DEBT-03)
- **D-01:** La regla de selección (qué eventos de `tramitacion_evento` se vuelven "Hito del …" en
  la ficha) se ESCRIBE como query SQL con su criterio declarado en comentario (qué tipos entran,
  qué se agrupa, qué se excluye y POR QUÉ) — hoy la regla vive implícita en código TS/SQL disperso.
  Dónde vive la query escrita (view NO — exigiría security_invoker y es superficie nueva; función
  existente/archivo .sql documental + test de paridad) lo adjudica el research según dónde viva hoy
  la selección real.
- **D-02:** La query explica la brecha del testigo: `14309-04` tiene 99 eventos y el render muestra
  85 `Hito del` — la diferencia debe quedar CONTADA por el criterio (p.ej. "14 eventos de tipo X se
  agrupan/excluyen por Y"), no declarada "esperable". Paridad query↔DOM sobre el testigo por conteo
  exacto (gotcha: HTML de 1 línea ⇒ `grep -o | wc -l`; React intercala `<!-- -->` ⇒ extracción
  numérica, no literal con dígitos).
- **D-03:** Si al escribir la regla aparece un DEFECTO real de selección (evento que debería
  mostrarse y no se muestra), se documenta y corrige SOLO si es localizado; si exige rediseño,
  se registra como deuda nueva con evidencia — el criterio de la fase es la regla escrita + paridad.

### 3.3 — co-autoría v2 (DEBT-04)
- **D-04:** RPC `coautores_de_parlamentario` VIVA queda intacta (42P13 re-arma default privileges —
  jamás alterar `returns table`). Se crea firma v2 PARALELA (precedente 0060
  `parlamentario_publico_v2`): emite membresía de par COMPLETA (sin `limit 20` silencioso).
- **D-05:** Aguja completa (regla LOCKED): cero-grant, secdef `search_path=''`,
  `statement_timeout`, LIMIT piso 1.000 declarado (si el universo de coautores de un par supera el
  límite, el copy declara "N de M" — cero truncamiento SILENCIOSO; el research mide el máximo real),
  doble-revoke, `PUBLIC_RPC_ALLOWLIST`, pgTAP contra schema aplicado.
- **D-06:** `/comparar` consume la v2: conteo mostrado == recálculo SQL de PROD (`psql -tA` +
  `tr -d '\r'`); si el render recorta, "N de M" con total honesto. La RPC vieja sigue funcional
  (otros call-sites NO se migran en esta fase salvo que compartan el defecto — research los lista).
- **D-07:** Copy nuevo pasa el linter anti-insinuación (carril RELACIONES ya escanea
  `app/comparar/page.tsx`); cero vocabulario de afinidad; la co-autoría es hecho DECLARADO por
  fuente oficial.

### Régimen
- **D-08:** Numeración de migración: siguiente número libre al momento de crear (después de 0080
  de 127 y la de 130 si ya existe — coordinar por `ls supabase/migrations`; en worktree paralelo,
  la numeración se resuelve al MERGEAR: si colisiona, renombrar antes de aplicar — las migraciones
  se aplican desde master, jamás desde el worktree).
- **D-09:** Suite + guards de régimen verdes (runner `pnpm guards` de 126 + guard-of-the-guards).

### Claude's Discretion
- Nombre de la v2 (sugerencia: `coautores_de_parlamentario_v2`).
- Forma del test de paridad timeline (unit sobre builder TS vs psql+DOM contra deploy — mínimo el
  unit; el DOM real puede quedar para 138 E2E si el deploy no ocurre en esta fase).
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

- `.planning/ROADMAP.md` §Phase 131 — 4 success criteria verbatim
- `.planning/REQUIREMENTS.md` — DEBT-03, DEBT-04
- `app/components/timeline-view.tsx` — builder actual de ítems del timeline (L139+: hitos sueltos +
  períodos de urgencia — la "regla implícita" a escribir)
- `supabase/migrations/0060_bio_partido_publico.sql` L45-50 — PRECEDENTE de firma v2 paralela
  (comentario explica el 42P13) + `copartidarios_de_parlamentario` con su `limit 20` (L204)
- `app/app/comparar/page.tsx` L121 — call-site de `coautores_de_parlamentario`
- `app/lib/lockdown-guard.test.ts` — allowlist + asserts
- `milestones/v12.0-MILESTONE-AUDIT.md` — hallazgos H-06 y fila 3.3 originales
</canonical_refs>

<code_context>
## Existing Code Insights

- Precedente v2 EXACTO en 0060 (firma paralela por 42P13) — copiar el patrón.
- El linter anti-insinuación ya escanea `app/comparar/page.tsx` (SUPERFICIES_RELACIONES).
- Verificaciones por psql -tA + tr -d '\r'; HTML del Worker 1 línea ⇒ grep -o | wc -l.
</code_context>

<specifics>
## Specific Ideas

- ¿Dónde está el `limit 20` de co-autoría? El research debe encontrar la migración que define
  `coautores_de_parlamentario` y confirmar el truncamiento (el `limit 20` visto en 0060 es de
  `copartidarios`; la de coautores puede vivir en otra migración con su propio cap).
- Boletín testigo H-06: `14309-04` (85 vs 99).
</specifics>

<deferred>
## Deferred Ideas

- Migrar otros call-sites de la RPC vieja de co-autoría (si los hay y no comparten el defecto).
- Rediseño del timeline (solo regla escrita + paridad en esta fase).
</deferred>

---

*Phase: 131-DEBT-FICHA — Regla del timeline + co-autoría sin truncamiento*
*Context gathered: 2026-07-30*
