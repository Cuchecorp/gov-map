# Phase 41: CRUCEN — Research

**Method:** sonnet-swarm (3 Sonnet agents, one per deliverable) + 2 Opus adversarial validators (DDL/grant correctness; gates/PII/dossier). All claims below verified against the live repo. Validators OVERTURNED two Sonnet proposals (the `db reset` conditional-guard and the `pg_get_function_result` pgTAP idiom) and CORRECTED the dossier filename — those corrections are baked in here. **This is the source of truth for planning; do NOT re-derive.**

**Boundary (from 41-CONTEXT, LOCKED):** leave the cruces surface *ready to sign/ignite* — without signing, igniting, or applying the grant. 3 independent deliverables → likely 1 wave, 3 plans.

---

## CRUCEN-01 — `fecha_captura` in the RPC + component (fix WR-02, vertical slice)

### Migration `supabase/migrations/0041_cruces_rpc_fecha_captura.sql`

**Why drop+recreate (CONFIRMED by validator):** Postgres rejects `create or replace` when the `RETURNS TABLE` column set changes (`42P13: cannot change return type`). The TABLE columns are OUT params = part of the signature. Adding `fecha_captura` requires `drop function` first — exact precedent `0028_votos_instructivos.sql:24,32` (which appended 8 cols for the same reason). No way to avoid the drop; the drop is what re-arms the DEFAULT-PRIVILEGES re-grant (see re-revoke below).

**Column placement:** append `fecha_captura` LAST in the returns table (mirror 0028's "new cols last" — lowest positional churn; the frontend maps by position).

```sql
-- 0041_cruces_rpc_fecha_captura.sql
-- CRUCEN-01 (Phase 41) — Proyecta `cruce_senal.fecha_captura` en el RPC
-- `cruces_de_parlamentario` (fix WR-02: frescura honesta). Cambia el `returns
-- table` (añade columna `fecha_captura timestamptz` AL FINAL) → requiere DROP +
-- recreate (Postgres prohíbe `create or replace` al cambiar el tipo de retorno,
-- 42P13; espejo de 0028_votos_instructivos.sql:24,32). Tras el recreate, re-emitir
-- AMBOS revokes: Supabase re-concede EXECUTE a anon/authenticated por DEFAULT
-- PRIVILEGES sobre CADA función nueva en public (lección Phase 36, cazada por
-- pgTAP-vs-PROD; ver 0040:56-61). El RPC sigue deny-by-default (SIN grant a anon —
-- eso es CRUCEN-02/0042). Proyección PII-safe: sin rut/partido/donante_id.
--
-- La última migración APLICADA es 0040. Esta es la 0041.
--
-- APLICACIÓN = CHECKPOINT DE OPERADOR: build/typecheck NO prueban que Postgres
-- ejecutó este DDL. La única prueba válida es el pgTAP (0041_*.test.sql) corriendo
-- contra el schema APLICADO vía `psql -tA -f`. Aplicar por `psql --db-url
-- --single-transaction`, NUNCA `supabase db push` (drift schema_migrations).
-- PGCLIENTENCODING=UTF8 en Windows.

-- Cambiar el returns table requiere drop previo (firma de parámetro intacta).
drop function if exists public.cruces_de_parlamentario(text);

create or replace function public.cruces_de_parlamentario(p_id text)
returns table (
  sector_id        text,
  sector_etiqueta  text,
  tipo_senal       text,
  conteo           int,
  evidencia        jsonb,
  fecha_captura    timestamptz   -- frescura real del cruce (cuándo materializó materializar_cruces())
)
language sql stable security definer set search_path = '' as $$
  select
    cs.sector_id,
    s.etiqueta,           -- etiqueta del catálogo público (dato no-PII)
    cs.tipo_senal,
    cs.conteo,
    cs.evidencia,         -- jsonb PII-safe (nombre crudo + enlace_fuente; sin rut, sin donante_id)
    cs.fecha_captura      -- nivel SEÑAL: todos los items de una señal comparten esta fecha
  from public.cruce_senal cs
  join public.sector s on s.codigo = cs.sector_id
  where cs.parlamentario_id = p_id
  order by cs.conteo desc, cs.sector_id asc;
$$;

-- DEFENSA EN PROFUNDIDAD (verbatim mirror de 0040:55-61). El `revoke from public`
-- NO toca los grants explícitos de rol que DEFAULT PRIVILEGES re-concede a la
-- función NUEVA; hay que revocarlos directamente. El pgTAP que asserta el deny de
-- anon es lo único que caza una omisión de la segunda línea.
revoke execute on function public.cruces_de_parlamentario(text) from public;
revoke execute on function public.cruces_de_parlamentario(text) from anon, authenticated;
-- INTENCIONALMENTE NO HAY `grant execute ... to anon` (deny-by-default hasta
-- sign-off legal + apply de 0042 — Candado A del doble candado).
```

### pgTAP `supabase/tests/0041_cruces_rpc_fecha_captura.test.sql` (new file)

**CORRECTION (validator SEV-3):** Do NOT use `pg_get_function_result(oid) ~* regex` (Sonnet-1's first idea — brittle: `'…\s+timestamp'` also matches a plain `timestamp` without tz). Use the repo's canonical idiom from `0029_votos_instructivos.test.sql:32-49`: `bag_has` over `unnest(proargnames)` + an exact `array_to_string(proargnames,',')` ordered-list assertion (positional contract — a reorder would silently break the frontend). `proargnames` lists IN params THEN OUT/table cols, so the ordered string is `p_id,sector_id,sector_etiqueta,tipo_senal,conteo,evidencia,fecha_captura`.

```sql
-- 0041_cruces_rpc_fecha_captura.test.sql
-- Verifica 0041 (CRUCEN-01: fecha_captura en el RPC) CONTRA SCHEMA APLICADO.
-- Corre vía `psql -tA -f` contra PROD aplicado (Phase 23 pattern), begin;…;rollback;.
begin;
select plan(4);

-- ── el returns table EMITE fecha_captura (set de nombres lo CONTIENE) ──────────
select bag_has(
  $$ select unnest(proargnames)
       from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = 'cruces_de_parlamentario' $$,
  $$ values ('fecha_captura') $$,
  'cruces_de_parlamentario emite la columna fecha_captura');

-- ── ORDEN posicional exacto (el cliente mapea por posición; reorder = bug silente) ─
select is(
  (select array_to_string(proargnames, ',')
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'cruces_de_parlamentario'),
  'p_id,sector_id,sector_etiqueta,tipo_senal,conteo,evidencia,fecha_captura',
  'cruces_de_parlamentario conserva el orden posicional exacto (fecha_captura al final)');

-- ── anon SIGUE sin EXECUTE tras drop+recreate (regresión del re-revoke) ────────
-- Si falla: el segundo revoke (from anon, authenticated) no se emitió → leak silencioso.
select ok(
  not has_function_privilege('anon', 'public.cruces_de_parlamentario(text)', 'execute'),
  'anon SIGUE sin EXECUTE sobre cruces_de_parlamentario tras drop+recreate (re-revoke OK)');

-- ── no-PII: el cuerpo NO referencia partido/rut/email/donante_id (LEGAL-03) ─────
select ok(
  (select regexp_replace(pg_get_functiondef(p.oid), '--[^\n]*', '', 'g')
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'cruces_de_parlamentario')
    !~* '\y(partido|rut|email|donante_id)\y',
  'el cuerpo de cruces_de_parlamentario NO contiene partido/rut/email/donante_id (no-PII)');

select * from finish();
rollback;
```

### Component `app/components/cruces-de-parlamentario.tsx`

1. Add import: `import { fechaCorta } from "@/lib/format";` (confirmed exported, `format.ts:17`).
2. Inside the `<li>`, after `ContraparteCruda`, add plain factual meeting-date text (no causal verb — §9.1-safe):
   ```tsx
   {item.fecha && (
     <span className="text-xs text-muted-foreground">
       Reunión registrada el {fechaCorta(new Date(item.fecha))}
     </span>
   )}
   ```
3. Replace the `ProvenanceBadge` `capturedAt` prop and DELETE the whole "LIMITACIÓN CONOCIDA (WR-02 …)" comment block (lines ~139-158). New:
   ```tsx
   {/*
     ProvenanceBadge por evidencia (FND-08). capturedAt = s.fecha_captura
     (fecha de materialización del cruce, nivel señal — proyectada por 0041,
     CRUCEN-01), NO item.fecha. Mata el stale-amber falso del WR-02.
   */}
   <span className="ml-auto">
     <ProvenanceBadge
       capturedAt={new Date(s.fecha_captura)}
       sourceName={sourceLabel("lobby")}
       sourceUrl={item.enlace_fuente}
     />
   </span>
   ```
   `s` is in scope at `cruces.map((s) => …)`; `item` at the inner `items.map`.

**Honesty note (validator R6 — document in code comment + SUMMARY):** the badge now reflects **pipeline-rebuild freshness** (`fecha_captura = now()` at the daily FULL REBUILD, cron `'23 3 * * *'`), not source/meeting freshness. That is the correct fix for WR-02 (kills false stale-amber and the `null→"fuente desconocida"` trap at `provenance-badge.tsx:34`), but it means: if the cron pauses, all badges age to amber together — an honest signal. The meeting date is preserved as plain "Reunión registrada el …" text.

### Types `app/lib/types.ts`

Add to `CruceSenalRpcRow` (after `evidencia`, mirroring column order):
```ts
  /**
   * Fecha de materialización del cruce (cuándo corrió `materializar_cruces()`).
   * Nivel SEÑAL: todos los items comparten esta fecha. Proyectada por 0041
   * (CRUCEN-01). ISO string del timestamptz → `ProvenanceBadge.capturedAt`.
   */
  fecha_captura: string;
```
Update the `CruceEvidenciaItem` JSDoc (lines ~324-329) to drop the stale "Pitfall 1: el item NO trae fecha_captura" text — frescura ahora viene de `CruceSenalRpcRow.fecha_captura`; `item.fecha` es solo texto factual de la reunión.

### Test `app/components/cruces-de-parlamentario.test.tsx`

1. `makeSenal` default needs `fecha_captura: new Date().toISOString()` (recent → never stale; deterministic within a run). `relativeTimeEs`/`esStale` use default `now=new Date()` (badge passes no `now`), so a now-ISO fixture is fresh.
2. New describe block (WR-02 fix):
   ```ts
   describe("CrucesView — frescura honesta (CRUCEN-01 / WR-02)", () => {
     it("fecha_captura reciente → badge SIN text-amber-700 (no stale falso)", () => {
       const ahora = new Date().toISOString();
       const { container } = render(
         <CrucesView data={makeViewData({ cruces: [makeSenal({
           fecha_captura: ahora,
           evidencia: { conteo: 1, items: [makeItem({ fecha: "2020-03-10T10:00:00Z" })] },
           conteo: 1,
         })] })} />,
       );
       const badges = container.querySelectorAll('span[class*="rounded-md"]');
       expect(badges.length).toBeGreaterThan(0);
       for (const b of badges) expect(b.className).not.toContain("text-amber-700");
     });
     it("muestra 'Actualizado' y NO 'Sin fecha de actualización'", () => {
       render(<CrucesView data={makeViewData({ cruces: [makeSenal({ fecha_captura: new Date().toISOString() })] })} />);
       expect(screen.queryByText(/Sin fecha de actualización/i)).not.toBeInTheDocument();
       expect(screen.getByText(/Actualizado/i)).toBeInTheDocument();
     });
   });
   ```
   The amber class `text-amber-700` lives on the badge's outer `<span>` with `rounded-md` (`provenance-badge.tsx:41-45`). Also assert the new "Reunión registrada el …" plain text renders when `item.fecha` is set, and is absent when `item.fecha` is null.

### CRUCEN-01 landmines (kept)
- Both revokes mandatory; omitting the 2nd leaves anon EXECUTE silently — the pgTAP anon-deny assert is the only guard.
- `fecha_captura` trips no PII regex token — no-PII assert stays green.
- Stale-case fixtures (if ever added): use a far-past date (e.g. `2020-…`), never "48h-ago ± ε" (boundary flake).
- Apply = operator checkpoint: `psql --db-url --single-transaction -f` + manual `schema_migrations` row; Windows `PGCLIENTENCODING=UTF8`, heredoc/stdin for any multibyte.

---

## CRUCEN-02 — grant gated (`0042`, written, NOT applied)

### Migration `supabase/migrations/0042_cruces_grant_anon.sql`

The single line `0040` intentionally omits. Mirror `0030_net.sql:253-254` / `0021` grant. **Add a LOUD precondition guard (validator SEV-2)** so applying 0042 before 0041 fails hard instead of silently no-op'ing (the drop+recreate of 0041 would otherwise discard a grant applied to the old function). This honors CONTEXT's "un único grant" intent — the grant is the payload; the guard is a fail-loud precondition (the repo's culture: every migration self-checks, cf. 0039 post-asserts).

```sql
-- 0042_cruces_grant_anon.sql
--
-- ████ MIGRACIÓN DE RELEASE — NO APLICAR EN CORRIDAS AUTÓNOMAS ████
--
-- Válvula de release del doble candado (Candado A). UNA SOLA acción: el
-- `grant execute ... to anon` que 0040 omite intencionalmente. Levanta el
-- deny-by-default SOLO tras el sign-off legal de cruces (CRUCEN-03, firma humana).
-- Espejo de 0030_net.sql:254 (subgrafo_red) y 0021 (lobby_de_parlamentario).
--
-- ORDEN DE DEPENDENCIA (CRÍTICO): aplicar DESPUÉS de 0041. 0041 dropea+recrea el
-- RPC → un grant aplicado antes de 0041 se PIERDE silenciosamente (el drop lo
-- descarta y el recreate re-revoca). El guard de abajo lo convierte en error duro.
--
-- NO APLICAR EN AUTÓNOMO: se commitea pero NO se aplica a PROD ni se registra en
-- schema_migrations durante el run de Phase 41. Apply = checkpoint humano/operador,
-- post-sign-off. Guard de regresión: 0040_cruces_rpc.test.sql (anon NO execute)
-- corre en la suite y fallaría ante una aplicación prematura.
--
-- ORDEN DE ENCENDIDO (documentado, NO ejecutado por el agente):
--   1. Firmar dossier CRUCEN-03 (humano → signoff: approved)
--   2. Aplicar esta migración: psql "$DATABASE_URL" --single-transaction -f
--      supabase/migrations/0042_cruces_grant_anon.sql  + fila en schema_migrations
--   3. Verificar: supabase/tests/post-apply/0042_cruces_grant_anon.test.sql
--   4. Flip CRUCES_PUBLIC_ENABLED=true en Cloudflare. Los 4 pasos juntos.
-- ████████████████████████████████████████████████████████████████████████████████

-- Precondición fail-loud: 0041 DEBE estar aplicada (fecha_captura en el retorno),
-- o el grant caería sobre una función que 0041 luego dropea.
do $$
begin
  if not exists (
    select 1 from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'cruces_de_parlamentario'
       and 'fecha_captura' = any(p.proargnames)
  ) then
    raise exception '0042 abortada: 0041 no está aplicada (cruces_de_parlamentario sin columna fecha_captura). Aplicar 0041 primero.';
  end if;
end;
$$;

grant execute on function public.cruces_de_parlamentario(text) to anon;
```

### The GUARD (validator OVERTURNED Sonnet-2 here)

**REJECTED:** Sonnet-2 proposed making `0040_cruces_rpc.test.sql` assert #3 (`anon NOT has execute`) *conditional* on whether `0042` is in `schema_migrations`, to survive a hypothetical local `supabase db reset` applying 0042. **Validator verdict: MOOT + a security regression.** Evidence:
- This repo NEVER runs `supabase db reset`/`db push` in the autonomous path. Migrations apply by `psql --db-url --single-transaction` to PROD; pgTAP runs by `psql -tA -f` against applied PROD (0040:14-15; Phase 23 pattern; zero `db push|db reset` hits across `.github/workflows/`). The "Corre vía `supabase test db`" comment in test headers is stale boilerplate, not the real runner.
- In PROD, 0042 is NOT applied → 0040 assert #3 stays green naturally.
- Conditionalizing the *only* always-on deny assertion would silently pass once 0042 appears — gutting Candado A (gate #5). **Do NOT touch 0040's test.**

**The guard, therefore, is the EXISTING `0040_cruces_rpc.test.sql` assert #3** (anon NO execute, runs every suite) + **0042 simply never applied** + the SUMMARY statement. No new guard code. Plus the fail-loud precondition in 0042 covers the ordering trap.

### Post-apply pgTAP `supabase/tests/post-apply/0042_cruces_grant_anon.test.sql`

Lives in a `post-apply/` subdir so it is NOT picked up by any suite glob and never runs pre-ignition (it asserts the OPPOSITE state of 0040 assert #3). Run manually by the operator on ignition day.

```sql
-- 0042_cruces_grant_anon.test.sql  (POST-APPLY ONLY — corre tras aplicar 0042)
-- Espejo INVERTIDO de 0040 assert #3. Si pasa, Candado A está abierto → paso 4 (flip flag).
begin;
select plan(2);
select ok(
  has_function_privilege('anon', 'public.cruces_de_parlamentario(text)', 'execute'),
  'anon TIENE EXECUTE sobre cruces_de_parlamentario (0042 aplicada — Candado A abierto)');
select is(
  (select p.prosecdef from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'cruces_de_parlamentario'),
  true, 'cruces_de_parlamentario sigue security definer post-0042');
select * from finish();
rollback;
```

### SUMMARY language (mandatory, verbatim-ish)
> **CRUCEN-02:** `0042_cruces_grant_anon.sql` fue escrita y commiteada. Contiene la precondición fail-loud + el único `grant execute … to anon` que `0040` omite. **NO fue aplicada a PROD y NO está en `schema_migrations`.** Apply = checkpoint humano post-sign-off CRUCEN-03. Guard de regresión = `0040_cruces_rpc.test.sql` assert #3 (anon NO execute), intacto. El pgTAP de encendido vive en `supabase/tests/post-apply/`, fuera de la suite autónoma.

### CRUCEN-02 landmines
- 0041-before-0042 ordering trap → covered by the fail-loud `do $$` guard.
- Exact signature `(text)` in the grant (matches `lobby_de_parlamentario(text)`, `0030` firma-exacta convention).
- post-apply test must stay OUT of `supabase/tests/` root (else it contradicts 0040 assert #3 when run pre-ignition).
- Nothing auto-applies migrations — confirmed; 0042 is inert in the repo until the operator runs it.

---

## CRUCEN-03 — legal dossier (prepared, `signoff: pending`, NOT signed)

### Filename + location (validator CORRECTED Sonnet-3: 41, not 36)

Convention = dossier number is the **legal-gate phase that PRODUCES it**, not the capability phase: F13→Phase 13 (MONEY capability was 14-16); F17→Phase 17 (NET capability was 18). CRUCES is produced by **Phase 41** → **`41`**. Sonnet-3's `36-` breaks the pattern.
- **Canonical:** `docs/legal/41-LEGAL-DOSSIER-CRUCES.md`
- **Phase-dir twin:** `.planning/phases/41-crucen-habilitaci-n-de-cruces-grant-gated-dossier-fecha-capt/41-LEGAL-DOSSIER.md` (twins drop the block suffix — confirmed: `17-LEGAL-DOSSIER.md`, `13-LEGAL-DOSSIER.md`).
- Both created **identical**, `signoff: pending`. (At sign-off, the human updates BOTH — 17's §9 says "este archivo y su copia en `docs/legal/`".)

### Front-matter (validator R4: reworded `nota` to avoid the literal `signoff: approved` substring)

```yaml
---
documento: 41-LEGAL-DOSSIER-CRUCES
alcance: CRUCES (señales parlamentario↔sector)
signoff: pending          # pending | approved | rejected
asesor: ""                # nombre del asesor legal externo (vacío hasta firmar)
fecha_signoff: ""         # ISO 8601 al firmar
observaciones: ""
depende_de: "deuda operador Phase 39; CRUCEN-03 deliverable de Phase 41"
nota: "Para encender crucesPublicEnabled se requiere la firma legal (estado aprobado) y aplicar el grant 0042."
---
```

### Content — CRUCES-specific (validator R2: NO NET copy-paste)

Use the full Sonnet-3 draft (it is already CRUCES-specific and validated as accurate against the surface) with these corrections applied: `documento: 41-LEGAL-DOSSIER-CRUCES`, the reworded `nota`, §8 "depende de Phase 39 + aplicar 0042", and the 0042 filename reference as `0042_cruces_grant_anon.sql`. The draft's substance MUST stay distinct from 17-NET:
- **§1** = composición INTRA-bloque (lobby-puro `tipo_senal='lobby_sector'` only; `lobby_sector_aporte` reserved Phase 40) — NOT NET's tri-block VOTE/INT/MONEY.
- **§2 nuclear** = "agregación por sector se lee como afinidad/captura" — NOT "arista/camino como acusación". CRUCES has no edges/paths/two-node relations.
- **§3** = third-party lobby contrapartes (raw name + IdentityMarker) + sector-pattern as derived datum. **No `partido`, no sentido-de-voto** (the RPC `0040:30-36` emits neither — a copied NET §3 would invent attributes that don't exist and misrepresent the surface to the lawyer).
- **§6** = single source (lobby = leylobby.gob.cl institutional, NOT CC BY 4.0; InfoProbidad — the only CC BY 4.0 source — is not even in this surface). Collapse NET's 5-row table to lobby.
- **§7** = interés legítimo + composition factor = sector-aggregation; every claim defers ("no se concluye" / "A confirmar por el asesor" / "PENDIENTE DE VALIDACION LEGAL"); close "el abogado dictamina y firma".
- **§4** doble candado table: Candado A part1 = RLS deny on `cruce_senal` (0039); part2 = RPC sin grant (0040) + grant gated en 0042 (NO aplicado); Candado B = `crucesPublicEnabled` default OFF (`cruces-gate.ts`).

(The complete draft body is in the CRUCEN-03 research agent output / will be written verbatim by the executor with the corrections above. PII-safety of the described surface CONFIRMED by validator: RPC emits only `sector_id/sector_etiqueta/tipo_senal/conteo/evidencia(+fecha_captura)`; evidence jsonb = `tipo/fecha/contraparte_nombre_crudo/audiencia_id/enlace_fuente`; no rut/partido/donante_id; contraparte raw text + IdentityMarker, never linked.)

### CRUCEN-03 landmines
- NEVER set `signoff: approved` / fill `asesor`/`fecha_signoff` (gate 3). §9 checklist stays blank (`[ ]`/`____`).
- The `nota` must not embed the literal `signoff: approved` (grep-hygiene; an inspection gate-check greps for it).
- Write BOTH locations identical; verify `grep "signoff:" docs/legal/41-LEGAL-DOSSIER-CRUCES.md` → `signoff: pending`.
- Preparation, not verdict: no sentence asserts the treatment is lawful or the test passes.

---

## Validation Architecture (test map)

| Deliverable | Artifact | Test / proof | Runner | When | Asserts |
|---|---|---|---|---|---|
| CRUCEN-01 | `0041` migration | `supabase/tests/0041_*.test.sql` (plan 4) | `psql -tA -f` vs PROD | after operator applies 0041 | fecha_captura emitted; exact positional order; **anon NO execute (re-revoke regression)**; no-PII |
| CRUCEN-01 | component | `cruces-de-parlamentario.test.tsx` (+2 new) | `npx vitest run` (app/) | CI, pre-apply | fresh capture → no `text-amber-700`; "Actualizado" not "Sin fecha"; meeting-date plain text present/absent |
| CRUCEN-01 | types | `npx tsc -b` | tsc | CI | `fecha_captura: string` compiles through component |
| CRUCEN-02 | `0042` migration | **(not applied)** | — | — | inert in repo; fail-loud guard if applied before 0041 |
| CRUCEN-02 | guard | `0040_cruces_rpc.test.sql` assert #3 (UNCHANGED) | `psql -tA -f` vs PROD | every suite | anon NO execute = 0042 not applied early |
| CRUCEN-02 | ignition proof | `supabase/tests/post-apply/0042_*.test.sql` | `psql -f` manual | ignition day ONLY | anon HAS execute; still security definer |
| CRUCEN-03 | dossier ×2 | grep + manual review | grep / human | CI + sign-off | `signoff: pending`; no `signoff: approved` substring; CRUCES-specific (not NET); defers to asesor |

**Gate proofs (the 6 LOCKED gates):** (1) no flip — chokepoint `CRUCES_PUBLIC_ENABLED` only read in `cruces-gate.ts`, untouched; (2) 0042 unapplied — not in `schema_migrations`, SUMMARY states it; (3) dossier `pending` — grep; (4) 0041 = operator checkpoint, agent does not apply unless explicitly authorized in-run; (5) re-revoke — 0041 pgTAP assert #3; (6) PII/§9.1 — no-PII pgTAP + existing component anti-insinuación tests stay green.

## Adversarial findings that changed the plan
1. **db-reset conditional guard → REJECTED** (moot + security regression). 0040 test untouched.
2. **pgTAP `pg_get_function_result` regex → REPLACED** with `proargnames` bag_has + ordered-string (0029 idiom).
3. **Dossier filename `36` → `41`** (gate-phase numbering convention).
4. **`nota` substring `signoff: approved` → reworded** (grep-hygiene footgun).
5. **0042 ordering trap → fail-loud `do $$` precondition guard** added (not just a comment).
6. **Honesty note:** badge now = pipeline-rebuild freshness, not source freshness (document).
