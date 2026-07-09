# Phase 59: AUTOR — Autoría ingest + ficha de proyecto (F48) - Research

**Researched:** 2026-07-08
**Domain:** tramitacion XML parsing (Senado `wspublico`), identity reconciliation, DDL migration, Next.js ficha sección
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Tabla relacional `proyecto_autor` (NO campo jsonb en proyecto): boletín FK, `autor_crudo`, `parlamentario_id` nullable (SOLO match determinista/confirmado — EnlaceConfirmado branded como en votos), `camara_origen` si la fuente lo da, provenance inline. Clave natural `(boletin, autor_crudo_norm)` para upsert idempotente.
- Migración ADDITIVA nueva (`0051_proyecto_autor.sql`) con RLS public-read explícito (espejo 0008) + pgTAP. APPLY a PROD vía psql --db-url --single-transaction + fila schema_migrations; NUNCA db push.
- Fuente de autores: lo que decida el researcher. Preferencia: R2 primero; si crudo existente no trae autores, Etapa 1 (fuente→R2) luego Etapa 2 (R2→Supabase) con seams Phase 57.
- Mociones tienen autores parlamentarios; Mensajes no → estado honesto "Mensaje del Ejecutivo". Modelo distingue `iniciativa`.
- SOLO `matchDeterminista` puebla `parlamentario_id`. CERO LLM. Espejo exacto del patrón de votos Senado.
- RUT jamás involucrado.
- Corrida LIVE acotada (~74–136 boletines). Idempotente. Segunda corrida = 0 upserts nuevos.
- Nueva sección/carril `#autores` en `/proyecto/[boletin]`: DetalleColapsable colapsado por defecto, guarda identidad LOCKED (link a `/parlamentario/[id]` SOLO si confirmado), ProvenanceBadge, ausente del DOM si 0 filas, "Mensaje del Ejecutivo" si aplica.
- SELECT public-read directo (sin RPC nuevo, salvo que el patrón existente lo exija). Anti-insinuación: carril propio, no compone con votos/dinero/lobby.
- No se genera UI-SPEC separado: DESIGN-SYSTEM.md + patrón F55 + guarda TRAM-06 son el contrato.

### Claude's Discretion
- Nombre exacto de columnas, orden de la sección entre carriles existentes, textos de copy (es-CL sobrio, vocabulario no-causal).

### Deferred Ideas (OUT OF SCOPE)
- Vista agregada "proyectos por autor" en ficha de parlamentario — milestone futuro.
- Similares v2 (mejoras kNN) — fuera de alcance.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AUTOR-01 | Poblar autoría de proyectos vía pipeline conforme a la convención LOCKED (crudo→R2→Supabase) con reconciliación fail-closed contra la maestra | Parser fix (PARLAMENTARIO key), nueva tabla `proyecto_autor`, parser autor, reconciliar-autor, writer method, ingest-run hook, CLI |
| AUTOR-02 | Montar sección de autoría en la ficha de proyecto (F48) | AutoresSection server component, rail entry, DetalleColapsable, IdentityMarker, ProvenanceBadge, honest-state (Mensaje / sin filas) |
</phase_requirements>

---

## Summary

Phase 59 implements author ingestion and display for the project ficha (F48, deferred from v5). The research resolved three critical questions with live verification.

**Author source verdict:** Senado `tramitacion.php` XML is the single authoritative source. The `<autores><autor><PARLAMENTARIO>Nombre completo</PARLAMENTARIO></autor></autores>` structure is present for mociones and empty for mensajes — confirmed by live fetch of boletin 16588-xx (moción, 5 autores) and 14309-04/18296-05 (mensajes, `<autores></autores>`). Crucially, the `<iniciativa>` tag (`Mensaje`/`Moción`) is present in `<descripcion>` for every boletín.

**Critical parser bug discovered:** The existing `parse-senado-tramitacion.ts` calls `txt(a)` on each `<autor>` node. `txt()` looks for a `#text` key — but fast-xml-parser parses `<autor><PARLAMENTARIO>Name</PARLAMENTARIO></autor>` as `{PARLAMENTARIO: "Name"}`, not `{#text: "Name"}`. Result: **all mociones currently ingest with `autores: []`** even though the XML contains names. Phase 59 must fix this in the parser before the author pipeline can work. The fix is: read `(a as Record<string,unknown>).PARLAMENTARIO ?? txt(a)` to handle both the nested tag form and any hypothetical `#text` form.

**R2 crudo status:** The R2 crudos stored by the leyes-weekly cron (post-Phase 57) contain the full `tramXml` string in the envelope `{boletin, tramXml, votXml, detalles}`. The XML includes the `<autores>` subtree. Therefore `--from-r2` replay CAN feed a new author parser without any new government fetches — provided the parser bug is fixed first. The plan must: (1) fix the parser, (2) add `proyecto_autor` writer method, (3) add `upsertAutores` call in `ingest-run`, (4) run `--from-r2` on each existing R2 path OR re-run the standard cron with the fixed parser (since `putImmutable {existed=true}` will short-circuit at the hash-check and skip Etapa 1, the `--from-r2` path is strictly cleaner for a backfill that doesn't want to re-hit government servers).

**Primary recommendation:** Fix parser, add `proyecto_autor` table + writer method + reconciliation, hook into existing ingest-run pipeline, backfill via CLI, then add ficha section.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Author XML parsing | `@obs/tramitacion` package | — | All Senado XML parsing lives here; `parse-senado-tramitacion.ts` already owns `<autores>` handling (incorrectly) |
| Author reconciliation | `@obs/tramitacion` package | `@obs/identity` (matchDeterminista) | Same tier as `reconciliar-senado.ts`; calls `matchDeterminista` from `@obs/identity` |
| Author persistence | `SupabaseTramitacionWriter` | — | Mirrors `upsertVotos`; service-key writer, bypasses RLS |
| DDL / migration | `supabase/migrations/0051_proyecto_autor.sql` | — | Additive; public-read RLS mirrors 0008 |
| Ficha display | `app/app/proyecto/[boletin]/page.tsx` | `@/components/autores-list.tsx` | Server Component fetches `proyecto_autor`, existing `AutoresList` needs identity-guard upgrade |
| Rail nav entry | `ProyectoRail` in page.tsx | — | Count drives rail badge; already has `id_autores` slot to add |

---

## Standard Stack

No new packages required. All libraries already present in the codebase.

### Core (already installed)
| Library | Version | Purpose | Source |
|---------|---------|---------|--------|
| `fast-xml-parser` | `^5.9.2` | Parse `<autores>` nodes from Senado XML | `@obs/tramitacion` package.json |
| `@obs/identity` | workspace | `matchDeterminista` + `confirmar` (EnlaceConfirmado) | existing |
| `@supabase/supabase-js` | v2 | `SupabaseTramitacionWriter.upsertAutores` | existing |
| `zod` | 3.x | `ProyectoAutorSchema` validation | existing |

### Package Legitimacy Audit

No new external packages. Audit skipped (zero new installs).

---

## Architecture Patterns

### System Architecture Diagram

```
Senado tramitacion.php XML (in R2 envelope)
       │ tramXml
       ▼
parse-senado-tramitacion.ts  ← PARSER FIX: read .PARLAMENTARIO key
       │ Proyecto.autores: string[]  (raw names)
       │ Proyecto.iniciativa: "Moción" | "Mensaje" | null
       ▼
reconciliarAutores(autores, maestra, boletin)
       │ matchDeterminista(nombre, camara="*", periodo)
       │   → {estado: "confirmado", id} → confirmar(id) → EnlaceConfirmado
       │   → {estado: "no_confirmado"} → parlamentario_id = null
       ▼
ProyectoAutor[] (autor_crudo, parlamentario_id | null, provenance)
       │
       ▼
SupabaseTramitacionWriter.upsertAutores(autores)
       │  ON CONFLICT (boletin, autor_crudo_norm) DO UPDATE
       ▼
proyecto_autor table (Supabase, RLS public-read)
       │
       ▼
AutoresSection server component (app/proyecto/[boletin]/page.tsx)
       │  SELECT * FROM proyecto_autor WHERE boletin = $1
       │  → 0 rows + iniciativa=Mensaje → "Mensaje del Ejecutivo" line
       │  → 0 rows + iniciativa=Moción  → section absent from DOM
       │  → N rows                      → DetalleColapsable + AutoresRow per row
       ▼
FichaRail: { id: "autores", label: "Autores", count: N (if > 0) }
```

### Recommended Project Structure additions

```
packages/tramitacion/src/
├── parse-senado-tramitacion.ts   # FIX: .PARLAMENTARIO key reader
├── reconciliar-autor.ts          # NEW: matchDeterminista by name for authors
├── reconciliar-autor.test.ts     # NEW: unit tests
├── writer.ts                     # ADD: upsertAutores to TramitacionWriter interface
├── writer-supabase.ts            # ADD: upsertAutores implementation
├── ingest-run.ts                 # ADD: call upsertAutores after upsertProyecto
├── model.ts                      # ADD: ProyectoAutor type + ProyectoAutorSchema
supabase/migrations/
├── 0051_proyecto_autor.sql       # NEW: DDL + RLS + pgTAP
app/app/proyecto/[boletin]/
├── page.tsx                      # ADD: AutoresSection + rail entry "autores"
app/components/
├── autores-list.tsx              # UPGRADE: add identity-guard (link if confirmado)
├── autores-list.test.tsx         # ADD: tests for IdentityMarker / link states
```

### Pattern 1: Parser fix — reading nested `<PARLAMENTARIO>` tag

```typescript
// Source: verified live — fast-xml-parser 5.9.2 parses
// <autor><PARLAMENTARIO>Name</PARLAMENTARIO></autor>
// as { PARLAMENTARIO: "Name" }, NOT as { "#text": "Name" }

// BEFORE (BUG — returns null for all moción authors):
const autores = asArray<unknown>(autoresRaw?.autor)
  .map((a) => txt(a))         // txt() looks for #text → null
  .filter((a): a is string => a != null);

// AFTER (FIX):
function txtAutor(a: unknown): string | null {
  if (a == null) return null;
  if (typeof a === "string") return a.trim() || null;
  if (typeof a === "object") {
    // Nested element form: <autor><PARLAMENTARIO>Name</PARLAMENTARIO></autor>
    const rec = a as Record<string, unknown>;
    const parlamentario = rec["PARLAMENTARIO"];
    if (parlamentario != null) return String(parlamentario).trim() || null;
    // Fallback: #text form (defensive, not observed in live data)
    const t = rec["#text"];
    if (t != null) return String(t).trim() || null;
  }
  return null;
}

const autores = asArray<unknown>(autoresRaw?.autor)
  .map(txtAutor)
  .filter((a): a is string => a != null);
```

### Pattern 2: ProyectoAutor model + schema

```typescript
// Source: mirrors Voto model pattern in model.ts

export interface ProyectoAutor {
  boletin: string;             // FK → proyecto.boletin
  autor_crudo: string;         // nombre literal de la fuente
  autor_crudo_norm: string;    // normalizado para upsert key (trim + lower + spaces)
  parlamentario_id: string | null;  // SOLO determinista; null = no confirmado
  metodo: "determinista" | null;
  estado_vinculo: "confirmado" | "no_confirmado" | null;
  origen: string;
  fecha_captura: string;
  enlace: string;
}
```

### Pattern 3: reconciliarAutores — name-only matchDeterminista

```typescript
// Source: mirrors reconciliar-camara.ts + reconciliar-senado.ts patterns
// Key insight: <autores> gives ONLY names (no PARLID/DIPID), so we use
// matchDeterminista by nombre — same as Senado vote reconciliation.
// autor_crudo_norm = simple normalization for the upsert key (not the matchDeterminista
// key, which uses normalizarNombre from @obs/core).

import { matchDeterminista, normalizarNombre } from "@obs/identity"; // via @obs/core
import { confirmar } from "@obs/identity";
import type { Parlamentario } from "@obs/core";

export function reconciliarAutores(
  autores: string[],           // raw names from parser
  maestra: Parlamentario[],
  boletin: string,
  provenance: { origen: string; fecha_captura: string; enlace: string },
): ProyectoAutor[] {
  // Build mention for matchDeterminista — cámara is UNKNOWN (autor can be dip or sen).
  // Search across both cámaras: try "diputados" first, then "senado".
  // If determinista in either → confirmado; if conflict or none → no_confirmado.
  return autores.map((nombre) => {
    const norm = nombre.toLowerCase().replace(/\s+/g, " ").trim();
    const { nombre_normalizado } = normalizarNombre({ paterno: nombre, nombres: "" });
    // Try both cámaras; pick the first confirmado (same name won't appear in both in same periodo)
    const camaras: Array<Parlamentario["camara"]> = ["diputados", "senado"];
    let resolved: { id: string; metodo: "determinista" } | null = null;
    for (const camara of camaras) {
      const r = matchDeterminista(
        { nombreNormalizado: nombre_normalizado, camara, periodo: "2022-2026" },
        maestra,
      );
      if (r.estado === "confirmado") {
        resolved = { id: r.id, metodo: "determinista" };
        break;
      }
    }
    return {
      boletin,
      autor_crudo: nombre,
      autor_crudo_norm: norm,
      parlamentario_id: resolved ? confirmar(resolved.id).parlamentarioId : null,
      metodo: resolved ? "determinista" : null,
      estado_vinculo: resolved ? "confirmado" : "no_confirmado",
      ...provenance,
    };
  });
}
```

> **Note on cámara scoping:** The Senado XML does not indicate which cámara each `<autor>` belongs to. Authors of a moción can be from either cámara (co-authorship across chambers is common). The reconciliation tries both cámaras; if a name is unique in the maestra across both, it resolves. If it appears in both (rare homonym across chambers in the same periodo), it degrades to `no_confirmado`.

> **Period assumption:** Authors are matched against the current periodo (2022–2026). Boletines in the corpus date from the current legislature. If a boletín predates the current periodo, the author may not be in the current maestra → `no_confirmado` (correct degradation — they may no longer be in office). [ASSUMED: that the current maestra seeded in Phase 3 covers only the 2022–2026 periodo; this is consistent with the blocking in reconciliar-camara.ts]

### Pattern 4: upsertAutores in writer-supabase.ts

```typescript
// Source: mirrors upsertVotos pattern in writer-supabase.ts

async upsertAutores(autores: ProyectoAutor[]): Promise<void> {
  if (autores.length === 0) return;
  const deduped = dedupePorClave(
    autores,
    (a) => `${a.boletin}\x00${a.autor_crudo_norm}`,
  );
  for (const lote of chunk(deduped, CHUNK)) {
    const { error } = await this.client
      .from("proyecto_autor")
      .upsert(lote, {
        onConflict: "boletin,autor_crudo_norm",
        ignoreDuplicates: false,
      });
    if (error) throw new Error(`upsert proyecto_autor falló: ${error.message}`);
  }
}
```

### Pattern 5: DDL — 0051_proyecto_autor.sql

```sql
-- 0051_proyecto_autor.sql
-- Autoría de proyectos de ley (AUTOR-01).
-- Tabla relacional separada (NOT jsonb en proyecto): trazabilidad por fila,
-- reconciliación fail-closed nullable (espejo de voto.parlamentario_id).

create table proyecto_autor (
  id               bigint generated always as identity primary key,
  boletin          text not null references proyecto(boletin),
  autor_crudo      text not null,        -- nombre literal de la fuente
  autor_crudo_norm text not null,        -- normalizado (upsert key)
  parlamentario_id text references parlamentario(id),  -- nullable: solo determinista
  metodo           text check (metodo in ('determinista', 'humano')),
  estado_vinculo   text check (estado_vinculo in ('confirmado', 'no_confirmado')),
  origen           text not null,
  fecha_captura    timestamptz not null default now(),
  enlace           text not null,
  unique (boletin, autor_crudo_norm)     -- clave natural para upsert idempotente
);

create index proyecto_autor_boletin_idx on proyecto_autor (boletin);
create index proyecto_autor_parlamentario_idx on proyecto_autor (parlamentario_id)
  where parlamentario_id is not null;

alter table proyecto_autor enable row level security;
create policy proyecto_autor_public_read on proyecto_autor for select to anon using (true);
grant select on proyecto_autor to anon;

-- pgTAP (inline)
-- select has_table('public', 'proyecto_autor', 'tabla proyecto_autor existe');
-- select col_is_nullable('public', 'proyecto_autor', 'parlamentario_id', 'parlamentario_id nullable');
-- select col_not_null('public', 'proyecto_autor', 'autor_crudo', 'autor_crudo not null');
```

### Pattern 6: ingest-run.ts hook

```typescript
// After upsertProyecto (which creates the FK) and after parsing:
const autores = reconciliarAutores(
  proyecto.autores,   // string[] from parse-senado-tramitacion (after parser fix)
  opts.maestra,
  boletinKey,
  provCols,
);
await opts.writer.upsertAutores(autores);
nAutores += autores.length;
```

### Pattern 7: AutoresSection — ficha (mirrors VotacionesSection)

```typescript
// Source: mirrors leerProyecto + VotacionesSection patterns in page.tsx
// New server component; author names are already available in proyecto.autores
// BUT proyecto_autor gives us parlamentario_id for identity-linking.

async function AutoresSection({ boletin }: { boletin: string }) {
  const [autoresResult, proyecto] = await Promise.all([
    createServerSupabase()
      .from("proyecto_autor")
      .select("*")
      .eq("boletin", boletin)
      .order("id", { ascending: true }),
    leerProyecto(boletin),
  ]);
  if (autoresResult.error) throw new Error(...);

  const autores = autoresResult.data ?? [];
  const iniciativa = proyecto?.iniciativa ?? null;

  // Honest-state 1: Mensaje del Ejecutivo (no parliamentary authors)
  if (autores.length === 0 && iniciativa === "Mensaje") {
    return (
      <p className="text-sm text-muted-foreground">
        Iniciativa del Ejecutivo (Mensaje presidencial).
      </p>
    );
  }

  // Honest-state 2: no author rows at all
  if (autores.length === 0) return null;  // section absent from DOM

  // Honest-state 3: authors with identity guard
  return (
    <DetalleColapsable n={autores.length}>
      {autores.map((a) => (
        <AutorRow key={a.id} autor={a} />
      ))}
    </DetalleColapsable>
  );
}
```

### Anti-Patterns to Avoid

- **Reading `#text` for `<autor>` node:** fast-xml-parser 5.x returns `{PARLAMENTARIO: "Name"}` for `<autor><PARLAMENTARIO>Name</PARLAMENTARIO></autor>`. Reading `#text` always returns null → silent empty autores array for all mociones.
- **Storing `autor_crudo_norm` via normalizarNombre:** `normalizarNombre` is for maestra matching, not for the upsert dedup key. Use simple `toLowerCase().trim().replace(/\s+/g,' ')` for `autor_crudo_norm` to avoid coupling the key to the matching library.
- **Skipping Mensaje detection:** `iniciativa: "Mensaje"` is already in `Proyecto`. If absent (null), fall back honestly to "Autores no informados" — do not assume moción.
- **Linking autor to parlamentario without EnlaceConfirmado:** The branded type prevents accidental string assignment. `upsertAutores` must accept `parliamentario_id: string | null` (the `.parlamentarioId` field of `EnlaceConfirmado`, or null).
- **Cross-periodo false match:** Matching authors of a boletín from 2021 against the 2022–2026 maestra will produce `no_confirmado` for former MPs. This is correct fail-closed behavior — do not relax the periodo filter.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Name normalization for match | Custom strip/lower | `normalizarNombre` from `@obs/core` | Already handles materno, paterno, nombres consistently |
| Deterministic identity linking | Custom string comparison | `matchDeterminista` from `@obs/identity` | Handles homonym detection, fail-closed, cross-cámara blocking |
| EnlaceConfirmado factory | Manual string cast to branded type | `confirmar()` from `@obs/identity` | The unique symbol prevents fabrication; grep gate enforces |
| Idempotent upsert | Manual insert-if-not-exists | Supabase `.upsert(... onConflict)` | Standard pattern for all tables in this codebase |
| RLS public-read | Grant without policy | Policy + grant pair (mirror of 0008) | 0044 revoked broad grants; both policy AND grant are required |

---

## Common Pitfalls

### Pitfall 1: Parser bug — PARLAMENTARIO key, not #text
**What goes wrong:** `txt(a)` on `{PARLAMENTARIO: "Name"}` looks for `a["#text"]` → null → filtered out → `autores: []` for every moción.
**Why it happens:** `txt()` was written for scalar values (`<field>text</field>` → `{#text: "text"}`). `<autor><PARLAMENTARIO>Name</PARLAMENTARIO></autor>` produces a nested object where the child tag name is the key.
**How to avoid:** Use `txtAutor()` helper that checks `rec["PARLAMENTARIO"]` first (see Pattern 1).
**Warning signs:** Integration test of parse-senado-tramitacion with a moción fixture returns `autores: []`.

### Pitfall 2: `--from-r2` replay and the parser bug timing
**What goes wrong:** If the parser bug existed when the R2 crudos were stored, re-reading the same envelope with `--from-r2` still contains the correct XML — the bug was in the parser, not in what was stored. The full `tramXml` string is in the envelope, `<autores>` intact.
**How to avoid:** Fix the parser BEFORE running the author backfill. The R2 crudos are fine; the bug is read-time only.

### Pitfall 3: Upsert key collision on `autor_crudo_norm`
**What goes wrong:** Two distinct authors whose names normalize identically (e.g., if normalizing removes all accents produces a collision) would be deduplicated to one row.
**How to avoid:** `autor_crudo_norm` uses only `toLowerCase + trim + collapse spaces` — not accent-stripping. Chilean MP names with accents remain distinct after this normalization.

### Pitfall 4: `iniciativa` null for some boletines
**What goes wrong:** The Cámara path (fallback proyecto) sets `iniciativa: null`. The ficha's Mensaje-detection relies on `iniciativa === "Mensaje"`. A null initiative should display "Autores no informados" (honest), not "Mensaje del Ejecutivo".
**How to avoid:** The existing `AutoresList` component already handles this correctly (B15 fix). The server component must use the same three-state logic.

### Pitfall 5: `autor_crudo_norm` in migration vs code
**What goes wrong:** If the DB column uses a different normalization than the code, the same author from two corridas produces two rows instead of one upsert.
**How to avoid:** The normalization function for `autor_crudo_norm` must be defined once (a pure TS function) and called identically in reconciliarAutores and any test fixtures.

### Pitfall 6: ingest-run orden de upsert FK
**What goes wrong:** `upsertAutores` before `upsertProyecto` → FK violation (`proyecto_autor.boletin` references `proyecto.boletin`).
**How to avoid:** Call `upsertAutores` AFTER `upsertProyecto` (already the case for `upsertVotos`).

### Pitfall 7: pgTAP applied via db push
**What goes wrong:** `supabase db push` drifts `schema_migrations`; pgTAP test functions may not exist in the remote schema.
**How to avoid:** Apply via `psql --db-url --single-transaction < 0051_proyecto_autor.sql` + manual insert into `schema_migrations`. pgTAP checks via `psql -tA -f` against PROD (same as v5 pattern).

---

## Author Source: Verified Findings

### Live XML verification (3 fetches, 2–3s apart, identifying UA)

| Boletín | Iniciativa | `<autores>` content | PARLID present? |
|---------|-----------|---------------------|-----------------|
| 14309-04 | Mensaje | `<autores></autores>` (empty) | N/A |
| 18296-05 | Mensaje | `<autores></autores>` (empty) | N/A |
| 16588-xx | Moción | 5 `<autor><PARLAMENTARIO>Name</PARLAMENTARIO></autor>` | NO — names only |

[VERIFIED: live fetch 2026-07-08 — tramitacion.senado.cl/wspublico/tramitacion.php]

**Author ID availability:** The Senado `<autores>` XML provides **names only** — no PARLID, no DIPID. Identity linking requires `matchDeterminista` by name (same approach as Senado vote reconciliation, not the DIPID shortcut available for Cámara votes).

**`<iniciativa>` tag:** Present in `<descripcion>` for all fetched boletines (`Mensaje`/`Moción`). Already parsed by existing code; already stored in `proyecto.iniciativa`.

**R2 crudo format (from ingest-run.ts):**
```json
{
  "boletin": "16588-xx",
  "tramXml": "<proyectos><proyecto>...<autores>...</autores>...</proyecto></proyectos>",
  "votXml": "...",
  "detalles": [...]
}
```
The full `tramXml` is stored — the `<autores>` subtree is present and correct in R2. Re-parse via `--from-r2` will extract authors once the parser is fixed. [VERIFIED: ingest-run.ts L267]

**Current `proyecto.autores text[]` column:** Exists in `proyecto` table (migration 0008, `autores text[] not null default '{}'`). Currently populated as `[]` for all rows because of the parser bug. The new `proyecto_autor` table is ADDITIVE — `proyecto.autores` column is left in place (the CONTEXT.md decision is a separate relational table; the legacy column is harmless and can be deprecated later).

---

## Runtime State Inventory

This phase is not a rename/refactor. However, relevant runtime state:

| Category | Items Found | Action Required |
|----------|-------------|-----------------|
| Stored data | `proyecto.autores` column → all rows currently `{}` due to parser bug | Code fix in parser + re-ingestion populates `proyecto_autor`; `proyecto.autores` column left as-is |
| Live service config | leyes-weekly.yml cron (GitHub Actions) — runs `run-tramitacion-prod-cli.ts` | If author ingestion is added to `ingest-run`, the next cron run will populate new rows automatically |
| Secrets/env vars | No new secrets needed; R2/Supabase creds already in `.env` | None |
| Build artifacts | None | None |

**Nothing found in other categories** — verified by inspection of code.

---

## Code Examples

### Existing `txt()` function (for reference — NOT used for autor nodes)

```typescript
// Source: parse-senado-tramitacion.ts L26-35
function txt(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === "object") {
    const t = (v as Record<string, unknown>)["#text"];  // ← wrong for <autor>
    if (t == null) return null;
    return String(t).trim().length === 0 ? null : String(t).trim();
  }
  return String(v).trim().length === 0 ? null : String(v).trim();
}
```

### matchDeterminista call signature (from deterministic.ts)

```typescript
// Source: packages/identity/src/deterministic.ts
matchDeterminista(
  mention: Mention,   // { nombreNormalizado, camara, periodo, claveEstricta? }
  maestra: MaestraRow[],
): Resolution   // { estado: "confirmado", id } | { estado: "no_confirmado", razon }
```

### DetalleColapsable usage (from page.tsx L414–427)

```typescript
// Source: app/app/proyecto/[boletin]/page.tsx L414-427
<DetalleColapsable n={eventos.length} defaultOpen={urgenciaExpandida != null}>
  <TimelineView ... />
</DetalleColapsable>
// For #autores: defaultOpen={false} (colapsado por defecto per CONTEXT.md)
```

### Existing AutoresList component

`app/components/autores-list.tsx` already exists and handles the Mensaje/Moción/null+autores cases with B15 fix. However, it renders names as plain text — **no identity links**. The CONTEXT.md requires identity-guard: link to `/parlamentario/[id]` if confirmed. This component must be upgraded (or a new `AutorRow` component created) to accept `parlamentario_id` and render with `IdentityMarker` if null.

```typescript
// CURRENT (text only):
export function AutoresList({ autores, iniciativa }) { ... }

// NEEDED (identity-aware):
// Option A: upgrade AutoresList to accept ProyectoAutorRow[] with parlamentario_id
// Option B: new AutorRow component mirroring VotoRow (voto-row.tsx) — RECOMMENDED
// because VotoRow pattern is established for identity-guard display
```

### VotoRow identity-guard analog (existing pattern to mirror)

```typescript
// Source: app/components/voto-row.tsx (established identity-guard pattern)
// AutorRow should mirror: link if parlamentario_id, IdentityMarker if null
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `autores text[]` in proyecto | Separate `proyecto_autor` table with reconciliation | Phase 59 | Trazabilidad + linking |
| AutoresList renders plain text | AutorRow with identity link if confirmado | Phase 59 | Links to parlamentario ficha |

**Existing parser state:** `autores: string[]` in `Proyecto` model and `proyecto.autores text[]` in DB are both present but currently always empty due to the parser bug. They remain after Phase 59 (the DB column is harmless; the TS model field is still used to carry parsed names into `reconciliarAutores`).

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Supabase local | dev/test upsert | ✓ | (existing) | — |
| R2 credentials | `--from-r2` replay | ✓ per MEMORY.md | (existing) | dry-run without |
| `psql` with `--db-url` | migration apply to PROD | ✓ per MEMORY.md | (existing) | — |
| `normalizarNombre` from `@obs/core` | reconciliarAutores | ✓ | workspace | — |
| `matchDeterminista` from `@obs/identity` | reconciliarAutores | ✓ | workspace | — |

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest (pnpm -w test) |
| Config file | packages/tramitacion/vitest.config.ts (inferred from existing *.test.ts) |
| Quick run command | `pnpm --filter @obs/tramitacion test` |
| Full suite command | `pnpm -w test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AUTOR-01 | parser fix: moción XML with `<autor><PARLAMENTARIO>` returns non-empty names | unit | `pnpm --filter @obs/tramitacion test -- parse-senado-tramitacion` | ❌ Wave 0 fixture |
| AUTOR-01 | reconciliarAutores: confirmado match → parlamentario_id populated | unit | `pnpm --filter @obs/tramitacion test -- reconciliar-autor` | ❌ Wave 0 |
| AUTOR-01 | reconciliarAutores: unknown name → no_confirmado + null parlamentario_id | unit | same | ❌ Wave 0 |
| AUTOR-01 | reconciliarAutores: Mensaje → empty input → 0 rows (not an error) | unit | same | ❌ Wave 0 |
| AUTOR-01 | upsertAutores: second call with same data → 0 new rows (idempotence) | integration (writer-supabase.test.ts) | `pnpm --filter @obs/tramitacion test -- writer-supabase` | ❌ Wave 0 |
| AUTOR-01 | ingest-run: runIngest calls upsertAutores after upsertProyecto | unit (ingest-run.test.ts if exists, or new) | `pnpm --filter @obs/tramitacion test` | ❌ Wave 0 |
| AUTOR-01 | CLI backfill: second run → log contains "[skip] sin novedades" for all boletines | manual smoke | `node run-tramitacion-prod-cli --dry-run --limite 3` | manual |
| AUTOR-02 | AutoresSection: 0 rows + Mensaje → "Iniciativa del Ejecutivo" | RTL | `pnpm --filter app test -- autores` | ❌ Wave 0 |
| AUTOR-02 | AutoresSection: 0 rows + Moción → null (section absent) | RTL | same | ❌ Wave 0 |
| AUTOR-02 | AutoresSection: row with parlamentario_id → renders link `/parlamentario/[id]` | RTL | same | ❌ Wave 0 |
| AUTOR-02 | AutoresSection: row with null parlamentario_id → renders IdentityMarker | RTL | same | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `pnpm --filter @obs/tramitacion test`
- **Per wave merge:** `pnpm -w test`
- **Phase gate:** Full suite (720+) green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `packages/tramitacion/src/__fixtures__/mocion-with-autores.xml` — XML fixture for parser test (use boletín 16588 live response)
- [ ] `packages/tramitacion/src/reconciliar-autor.test.ts` — unit tests for reconciliarAutores
- [ ] `packages/tramitacion/src/parse-senado-tramitacion.test.ts` — add test case: parser with moción fixture returns non-empty `autores`
- [ ] `app/components/autores-list.test.tsx` — already exists (B15 tests); add identity-guard cases for upgraded component

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | yes | RLS public-read policy + grant pair (mirror 0008 pattern); service key for writes |
| V5 Input Validation | yes | zod ProyectoAutorSchema; BOLETIN_RE for path param in server component |
| V6 Cryptography | no | — |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Path injection in `/proyecto/[boletin]` | Tampering | `BOLETIN_RE` already validates; `.eq()` parameterizes |
| Service key leak in error message | Info Disclosure | Mirror existing pattern: only propagate `error.message` from PostgREST |
| PII exposure via `parlamentario` join | Info Disclosure | `proyecto_autor` does NOT join parlamentario table client-side; `parlamentario_id` is a UUID reference, not PII. Frontend reads `parlamentario_id` and constructs `/parlamentario/[id]` link — no PII in `proyecto_autor` rows |

---

## Open Questions

1. **Multi-periodo backfill scope**
   - What we know: the cron corpus is ~74–136 boletines from the current legislatura (2022–2026). Some boletines (e.g., 14309-04, ingresado 2021) predate the current periodo.
   - What's unclear: whether pre-2022 authors should be reconciled against the 2022–2026 maestra or left as `no_confirmado` always (an author who presented in 2021 might have continued in 2022).
   - Recommendation: default to `no_confirmado` for authors not found in the current maestra. This is the fail-closed behavior. The operator can extend the maestra to include prior periodos if needed (out of scope for Phase 59).

2. **`AutoresList` upgrade vs new `AutorRow` component**
   - What we know: `AutoresList` currently renders plain text. `VotoRow` is the identity-guard analog.
   - What's unclear: whether to upgrade `AutoresList` in-place (changing its props signature) or add a new `AutorRow` that mirrors `VotoRow`.
   - Recommendation: create new `AutorRow` component (mirrors `VotoRow`). Keep `AutoresList` for legacy plain-text use cases elsewhere if any. If `AutoresList` has no other callers, upgrade it in place.

3. **`proyecto.autores` legacy column**
   - What we know: exists in DB, always `{}`, parser was buggy. The CONTEXT.md decision is a new `proyecto_autor` table.
   - What's unclear: whether to keep filling `proyecto.autores` (now correctly) or stop.
   - Recommendation: keep filling `proyecto.autores` from the fixed parser (it's already in the Proyecto model and ingest-run). It serves as a quick-access array for display without a join. The new `proyecto_autor` table adds reconciliation. Both coexist without conflict.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Current maestra covers only 2022–2026 periodo | reconciliarAutores pattern | Authors from prior periodos would not resolve; already the safe/fail-closed default |
| A2 | All boletines in R2 crudos have intact `tramXml` with `<autores>` subtree | R2 crudo status | If some envelopes lack tramXml (edge case), those boletines need a fresh fetch; not blocking since ingest-run tolerates Senado errors |
| A3 | `normalizarNombre` from `@obs/core` is accessible in `@obs/tramitacion` package | reconciliarAutores | `@obs/identity` re-exports it via `parse-senado.ts`; if not in identity barrel, import directly from `@obs/core` |

---

## Sources

### Primary (HIGH confidence)
- Live fetch: `tramitacion.senado.cl/wspublico/tramitacion.php?boletin=14309,18296,16588` — verified `<autores>` structure, iniciativa tags, 2026-07-08 [VERIFIED: live fetch]
- `packages/tramitacion/src/parse-senado-tramitacion.ts` — existing parser logic, `txt()` bug confirmed [VERIFIED: codebase]
- `packages/tramitacion/src/model.ts` — `Proyecto.autores: string[]` field confirmed [VERIFIED: codebase]
- `supabase/migrations/0008_tramitacion.sql` — RLS pattern to mirror [VERIFIED: codebase]
- `supabase/migrations/0050_tasa_ausencia_comparada.sql` — last migration = 0050; next = 0051 [VERIFIED: codebase]
- `packages/identity/src/index.ts` — `matchDeterminista`, `confirmar`, `normalizarNombre` available [VERIFIED: codebase]
- `app/components/autores-list.tsx` — existing component (plain text, no identity-guard) [VERIFIED: codebase]
- `app/app/proyecto/[boletin]/page.tsx` — ficha structure, carrils, DetalleColapsable usage [VERIFIED: codebase]
- fast-xml-parser 5.9.2 runtime behavior — verified via `node -e` with actual installed package [VERIFIED: live test]
- `packages/tramitacion/src/ingest-run.ts` — R2 envelope format `{boletin, tramXml, votXml, detalles}` [VERIFIED: codebase]

### Secondary (MEDIUM confidence)
- `packages/identity/src/parse-senado.ts` — `normalizarNombre` import path confirms it flows from `@obs/core` [VERIFIED: codebase]

---

## Metadata

**Confidence breakdown:**
- Author source (XML structure): HIGH — live-verified
- Parser bug: HIGH — confirmed via fast-xml-parser runtime test
- R2 crudo availability: HIGH — confirmed in ingest-run.ts envelope format
- DDL number (0051): HIGH — confirmed last migration is 0050
- Reconciliation pattern: HIGH — mirrors existing reconciliar-camara.ts / reconciliar-senado.ts
- Ficha seam: HIGH — page.tsx structure fully read

**Research date:** 2026-07-08
**Valid until:** 2026-08-08 (Senado API XML structure changes infrequently)
