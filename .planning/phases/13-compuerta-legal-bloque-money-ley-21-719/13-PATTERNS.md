# Phase 13: Compuerta Legal — Bloque MONEY (Ley 21.719) - Pattern Map

**Mapped:** 2026-06-19
**Files analyzed:** 4 new artifacts (legal dossier + dossier copy, server-side flag module, pgTAP gate test) + 1 modified (`.env.example`)
**Analogs found:** 5 / 5

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `.planning/phases/13-.../13-LEGAL-DOSSIER.md` | doc (legal dossier) | n/a (Markdown) | `docs/operador-fase3.md` | role-match (operator doc style) |
| `docs/legal/13-LEGAL-DOSSIER.md` (copia) | doc | n/a | `docs/operador-fase3.md` | exact (same `docs/` convention) |
| `app/lib/money-gate.ts` (flag server-side) | config (server-only module) | request-response (server read) | `app/lib/supabase.ts` | exact (server-only env read + fail-closed throw) |
| `supabase/tests/0023_money_gate.test.sql` (o sufijo análogo) | test (pgTAP) | n/a (assertion) | `supabase/tests/0018_piso_pii.test.sql` | exact (deny-by-default RLS assertion) |
| `.env.example` (modificado) | config | n/a | `.env.example` (existente, líneas 21–39) | exact (mismo archivo) |

> **Nota de alcance:** Phase 13 NO crea tablas MONEY (eso es Phase 14, `packages/dinero`). El test pgTAP de esta fase **re-afirma la invariante de gate** sobre el patrón existente (la tabla-exemplar `pii_contraparte_declaracion` de 0018, o las tablas MONEY si 14 las precede) + afirma que el flag nace OFF. La migración SQL nueva es opcional; si Phase 13 no introduce DDL, el test verifica el piso heredado + documenta el contrato que 14–16 heredan.

## Pattern Assignments

### `app/lib/money-gate.ts` (config, server-only flag)

**Analog:** `app/lib/supabase.ts` (server-only env read, fail-closed)
**Discreción de CONTEXT.md:** "Nombre exacto y ubicación del módulo del flag server-side, consistente con `packages/`." Aquí se ubica en `app/lib/` porque el flag se **consume server-side en la ficha Next.js** (oculta secciones/RPC MONEY); el patrón análogo de lectura server-only ya vive en `app/lib/supabase.ts`. Alternativa válida: módulo en `packages/core` si la lectura también la necesitan Edge Functions — pero el consumidor declarado en CONTEXT (secciones de ficha / RPC público) es Next.js.

**Server-only + env read pattern** (`app/lib/supabase.ts:1`, `:20-22`):
```typescript
import "server-only";
// ...
export function createServerSupabase(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
```
- `import "server-only"` garantiza que el flag NUNCA llega al bundle del navegador (mismo razonamiento que `app/lib/supabase.ts:9-14`: vars deliberadamente SIN prefijo `NEXT_PUBLIC_`). `MONEY_PUBLIC_ENABLED` no debe llevar `NEXT_PUBLIC_`.

**Default-OFF / parse pattern** (default literal, espejo de `packages/llm/src/config.ts:50-67`):
```typescript
// loadRouterConfigFromEnv recibe env explícito y aplica defaults con `??`:
critical: env.LLM_CRITICAL_PROVIDER ?? "minimax",
```
- Copiar la forma "env explícito + default literal" para que el flag sea testeable sin tocar `process.env` global. Para un booleano de seguridad, **default fail-closed**: el flag es `true` SOLO si `process.env.MONEY_PUBLIC_ENABLED === "true"` (cualquier otro valor, incluido `undefined`/`""`, ⇒ `false`). Nunca usar truthiness laxa (`Boolean(env.X)` deja pasar `"false"`).

```typescript
// Forma recomendada (fail-closed, default false):
export function moneyPublicEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return env.MONEY_PUBLIC_ENABLED === "true";
}
```

**Fail-closed throw style** (`app/lib/supabase.ts:24-29`): el módulo Supabase lanza si falta config. Para el gate, la ausencia NO es error — es el default seguro (OFF). No lanzar; devolver `false`.

---

### `supabase/tests/0023_money_gate.test.sql` (test, pgTAP deny-by-default)

**Analog:** `supabase/tests/0018_piso_pii.test.sql` (RLS deny-by-default + cero policies)
**Analogs de refuerzo:** `0021_lobby.test.sql:36-42` y `0022_probidad.test.sql:55-62` (asersión `anon` SIN grant SELECT).

**Estructura pgTAP** (`0018_piso_pii.test.sql:7-8`, `:60-61`):
```sql
begin;
select plan(N);
-- ...asserts...
select * from finish();
rollback;
```

**Assertion CLAVE — RLS habilitada + cero policies = deny-by-default a `anon`** (el patrón que Phase 13 copia, `0018_piso_pii.test.sql:28-42`):
```sql
-- RLS habilitada en la tabla:
select is(
  (select count(*)::int from pg_class
     where relname = '<tabla_money>' and relrowsecurity = true),
  1,
  'RLS enabled en <tabla_money>');

-- Sin policies => deny-by-default efectivo (anon nunca lee):
select is_empty(
  $$ select polname from pg_policy p
     join pg_class c on c.oid = p.polrelid
     where c.relname = '<tabla_money>' $$,
  'ninguna policy en <tabla_money> (deny-by-default)');
```

**Assertion de refuerzo — `anon` SIN grant SELECT** (más explícita, `0022_probidad.test.sql:59-62`):
```sql
select is(
  (select count(*)::int from information_schema.role_table_grants
     where table_name = '<tabla_money>' and grantee = 'anon' and privilege_type = 'SELECT'),
  0, 'anon NO tiene grant SELECT sobre <tabla_money> (tercero privado, Ley 21.719)');
```

**Re-asersión del piso heredado** (`0018_piso_pii.test.sql:47-58`): el test de 0018 ya re-afirma que `parlamentario` sigue anon-denied tras el backfill de RUT. Phase 13 hace lo análogo para la(s) superficie(s) MONEY (o re-afirma `lobby_contraparte` / `declaracion_familiar` como las tres superficies PII que el dossier cubre).

**Comentario-cabecera obligatorio** (`0018_piso_pii.test.sql:1-5`): documenta que el pgTAP es la ÚNICA prueba válida (build/typecheck dan falso positivo — Pitfall "el DDL no se aplicó en CI"). Copiar esa advertencia textual.

> **Verificación del flag OFF (CONTEXT decision 28):** además del pgTAP RLS, Phase 13 necesita un test que afirme `MONEY_PUBLIC_ENABLED === false` por defecto. Eso NO es pgTAP — es un test de `app/lib/money-gate.ts` en el estilo vitest del repo (ver `packages/llm/src/config.test.ts`, junto a `config.ts`). Patrón: invocar `moneyPublicEnabled({})` (env vacío) ⇒ espera `false`; `moneyPublicEnabled({ MONEY_PUBLIC_ENABLED: "false" })` ⇒ `false`; solo `"true"` ⇒ `true`.

---

### `docs/legal/13-LEGAL-DOSSIER.md` + copia en fase (doc)

**Analog:** `docs/operador-fase3.md` (único archivo en `docs/`; convención establecida).

**Convención de docs:** existe un solo `docs/` con `operador-fase3.md`. `docs/legal/` es nuevo subdir — coherente. La fuente autoritativa del dossier es `13-LEGAL-DOSSIER.md` en el directorio de la fase (CONTEXT decision 19); `docs/legal/` lleva la **copia** publicable.

**Estilo de doc de operador** (`docs/operador-fase3.md:1-12`): título de fase + propósito + bloque de estado + secciones numeradas con pasos accionables y bloques de código. El dossier reusa esa estructura pero su contenido son las 3 superficies legales + minimización + propósito + base de licitud (CONTEXT decision 20).

**Bloque YAML de sign-off en la cabecera** (CONTEXT decision 31) — NO hay analog directo de front-matter YAML en el repo; es nuevo. Forma:
```yaml
---
signoff: pending        # pending | approved
asesor:                 # nombre del asesor externo (vacío hasta sign-off)
fecha:                  # fecha del sign-off
alcance: MONEY          # este sign-off cubre SOLO MONEY (NET/grafo = LEGAL-02/Phase 17)
observaciones:
---
```
El gate documenta que encender `MONEY_PUBLIC_ENABLED` depende de `signoff: approved` (verificable por inspección). Enlazar a la deuda de operador F13 (memoria) y al success criterion 3 del ROADMAP.

**Atribución CC BY 4.0 dentro del dossier** (CONTEXT decision 22) — copiar el patrón ya renderizado en UI:

**Analog de atribución:** `app/components/patrimonio-de-parlamentario.tsx:64`, `:94-111`
```typescript
const CC_BY_40_URL = "https://creativecommons.org/licenses/by/4.0/";
// AtribucionCcBy():
//   "Fuente: InfoProbidad — Consejo para la Transparencia. Datos bajo licencia CC BY 4.0."
```
- El dossier documenta esta cadena por dataset MONEY (ChileCompra, SERVEL) en lugar de InfoProbidad. La fase de UI MONEY (14–16) hereda el componente `AtribucionCcBy` exactamente como `patrimonio-de-parlamentario.tsx` lo usa (intro + caption).

---

### `.env.example` (modificado)

**Analog:** el propio `.env.example` existente (líneas 21–39, sección "Ingest worker" con comentarios `# CR-01...`).

**Patrón de var documentada** (`.env.example:21-32`): cada flag lleva comentario explicando origen, default y contrato. Añadir:
```bash
# --- Gate de exposición MONEY (Ley 21.719, Phase 13) ---
# Default OFF. Encender SOLO tras sign-off legal humano (signoff: approved en
# docs/legal/13-LEGAL-DOSSIER.md). Server-only, leído por app/lib/money-gate.ts;
# NUNCA prefijar NEXT_PUBLIC_ (no debe llegar al bundle del navegador).
MONEY_PUBLIC_ENABLED=false
```
Espeja el mapeo canónico documentado en `.env.example:34-39` si el flag también se refleja en Postgres (`app.settings.money_public_enabled`) — opcional; el consumidor declarado es Next.js server-side, no SQL.

## Shared Patterns

### RLS deny-by-default a `anon` (Ley 21.719)
**Source:** `supabase/migrations/0018_piso_pii.sql:64-68` (DDL) + `supabase/tests/0018_piso_pii.test.sql:28-42` (test)
**Apply to:** toda tabla MONEY de Phases 14–16 y el test de gate de Phase 13.
```sql
alter table <tabla> enable row level security;
-- (intencionalmente NINGÚN create policy ... to anon; NINGÚN grant select ... to anon)
```
La convención copy-paste está documentada literalmente en `0018_piso_pii.sql:21-30`. Es el "candado A" del doble candado de CONTEXT decision 25.

### Server-only feature flag (candado B)
**Source:** `app/lib/supabase.ts:1` (`import "server-only"`) + `packages/llm/src/config.ts:47-67` (default literal vía `??`)
**Apply to:** `app/lib/money-gate.ts` y su consumo en las secciones de ficha MONEY (14–16).
Default fail-closed (`=== "true"`), sin prefijo `NEXT_PUBLIC_`.

### Atribución CC BY 4.0 + provenance
**Source:** `app/components/patrimonio-de-parlamentario.tsx:64,94-111` (CC BY) + `app/components/provenance-badge.tsx` (frescura + fuente)
**Apply to:** dossier (documentación de licencia por dataset) y, heredado, las secciones de ficha MONEY.

### Minimización / RUT nunca al LLM (referencia para el dossier)
**Source:** `packages/llm/src/data-routing.ts:90-96` (`assertPiiDocumentSafeForLlm`)
**Apply to:** la sección de minimización del dossier cita esta compuerta existente (LEGAL-03, Phase 9) como evidencia de minimización ya implementada; el RUT de contraparte/donante es uso interno y nunca cruza a un prompt.

## No Analog Found

| Artifact | Role | Reason |
|----------|------|--------|
| Bloque YAML `signoff:` en cabecera del dossier | doc front-matter | No hay front-matter YAML en docs existentes; es nuevo. Forma propuesta arriba; el contenido legal es discreción de CONTEXT (decision 37). |
| Redacción del análisis legal por superficie | doc | Contenido nuevo (preparación, no dictamen). Sin analog de código; la estructura (3 superficies + minimización + propósito + base de licitud) viene de CONTEXT decision 20. |

## Metadata

**Analog search scope:** `supabase/migrations/`, `supabase/tests/`, `app/lib/`, `app/components/`, `packages/llm/`, `docs/`, `.env.example`
**Files scanned:** ~14 (3 RLS migrations/tests, 2 config modules, 2 UI components, 1 docs file, `.env.example`)
**Pattern extraction date:** 2026-06-19
