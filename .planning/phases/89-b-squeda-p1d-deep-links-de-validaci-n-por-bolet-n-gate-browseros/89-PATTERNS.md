# Phase 89: BÚSQUEDA P1d — Deep-links de validación + gate BrowserOS - Pattern Map

**Mapped:** 2026-07-21
**Files analyzed:** 7 (1 migración, 3 packages/tramitacion, 2 app, 1 script)
**Analogs found:** 7 / 7 (todos exact/role-match — cero net-new de arquitectura)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `supabase/migrations/0058_proyecto_prm_id_camara.sql` | migration | transform (DDL aditivo) | `supabase/migrations/0008_tramitacion.sql` (proyecto public-read, ya cubre `select to anon`) | exact (columna aditiva sobre tabla ya servida) |
| `packages/tramitacion/src/parse-camara-legislativo.ts` (MODIFICAR) | utility (parser) | transform (XML→objetos) | sí mismo — el `<Id>` ya se lee (`:10-11, :92-95`), solo se descarta | exact (extender return `string[]` → `{boletin, prmId}[]`) |
| `packages/tramitacion/src/connector-camara.ts` (MODIFICAR) | service (connector) | request-response (fetch WSLegislativo) | sí mismo — `enumerarProyectosXAnno` (`:140-170`) ya enumera por año | exact (nuevo método que devuelve pares + persiste crudo R2) |
| `packages/tramitacion/src/run-backfill-prmid-cli.ts` (NUEVO) | cli | batch (backfill LOCAL two-stage) | `run-enumerar-historico-cli.ts` (LOCAL, `--desde/--hasta`, loadEnv BOM-safe, isMain) + `run-tramitacion-prod-cli.ts` (createClient service_role + R2 env) | role-match (compón de ambos: enumerar+persistir R2+UPDATE) |
| `app/components/validacion-fuente.tsx` (NUEVO) + test | component | request-response (SSR read→render) | `app/components/provenance-badge.tsx` (safeExternalHref, `target=_blank`, `↗`, aria-label) | role-match (nuevo componente, mismo idiom de link externo) |
| `app/app/proyecto/[boletin]/page.tsx` (MODIFICAR) | route (SSR ficha) | request-response | sí mismo — secciones hermanas `mt-12` + `leerProyecto` cache + `source_snapshot` read | exact |
| `scripts/validar-deeplinks.mjs` (NUEVO) | script | batch (curl 200 + content-match) | `scripts/bros-cli.mjs` (Node ESM script CLI, sin deps) + comandos curl de RESEARCH §Validación Empírica | role-match |

## Pattern Assignments

### `supabase/migrations/0058_proyecto_prm_id_camara.sql` (migration, DDL aditivo)

**Analog:** `0008_tramitacion.sql` (proyecto public-read; `grant select ... to anon` ya existe — RESEARCH:347).

**Core pattern** — columna aditiva SIN grant nuevo (patrón >0044 LOCKED):
```sql
-- Siguiente número libre = 0058 (última: 0057_busqueda_hibrida_statement_timeout.sql).
-- SIN grant: proyecto ya tiene `grant select ... to anon` (0008:105) → hereda el read público.
alter table proyecto add column prm_id_camara text;  -- nullable: fail-honest cuando no se conoce
comment on column proyecto.prm_id_camara is 'ID interno Cámara (WSLegislativo <Id>) para deep-link tramitacion.aspx?prmID=. NULL = desconocido.';
```

**GUARD QUE MUERDE (lockdown-guard block A):** `app/lib/lockdown-guard.test.ts:290-309` FALLA si cualquier migración `> 0044` contiene `grant … to anon` / `to public` / `create policy … to anon`. La migración 0058 **NO debe llevar ningún GRANT** — el read público ya está heredado. Aplicar por `psql --single-transaction` UTF8 + reconciliar ledger ANTES (drift conocido, RESEARCH:347; MEMORY 85-01 D3).

---

### `packages/tramitacion/src/parse-camara-legislativo.ts` (utility, MODIFICAR)

**Analog:** sí mismo — el `<Id>` YA se parsea, solo se descarta hoy.

**Current shape** (`:58-61, :68`): `parseCamaraLegislativo(xml): string[]` con `ProyectoLeySchema = z.object({ NumeroBoletin, Nombre? })`.

**Change to make** — añadir `Id` al schema y al return (RESEARCH:222-233):
```typescript
// Shape confirmado LIVE (:10-11): <ProyectoLey><Id>17140</Id><NumeroBoletin>16572-06</NumeroBoletin>
const ProyectoLeySchema = z.object({
  NumeroBoletin: z.string().regex(BOLETIN_RE),
  Id: z.string().optional(),          // <Id> = prmID; se descarta si el nodo no lo trae
  Nombre: z.string().optional(),
});
// return: [{ boletin: parsed.data.NumeroBoletin, prmId: parsed.data.Id ?? null }]
```

**Idiom LOCKED a preservar** (`:34-51`): `txt()` (string-no-vacío-o-null, maneja `#text`), `asArray()`, y **zod-validate-before-return** (`:92-96`): un elemento inválido se DESCARTA (`continue`), NUNCA lanza. El `<Id>` usa el mismo `txt(p.Id)`.

---

### `packages/tramitacion/src/connector-camara.ts` (service, MODIFICAR)

**Analog:** sí mismo — `enumerarProyectosXAnno(anno)` (`:140-170`).

**Política de fetch LOCKED** (`:69-75`) — reusar `this.fetch`, NUNCA hand-roll:
```typescript
// assertAllowedUrl (SSRF+allowlist) → robots.isAllowed → rateLimiter.wait(host) [2-3s] → fetcher.get
private async fetch(url: string): Promise<string> {
  const parsed = assertAllowedUrl(url, this.deps.allowlist);        // T-05-12
  if (!(await this.deps.robots.isAllowed(url))) throw new RobotsDisallowError(url);
  await this.deps.rateLimiter.wait(parsed.host);                    // 2-3s serial (T-05-11)
  const body = await this.deps.fetcher.get({ url });
  return new TextDecoder().decode(body);
}
```

**Core pattern** — nuevo método `enumerarProyectosConIdXAnno` que espeja `:140-170` pero (a) captura el XML crudo para persistirlo a R2 (ETAPA 1), (b) parsea a pares `{boletin, prmId}`. Reglas load-bearing a copiar:
- `BASE_LEG` + ops `["retornarMocionesXAnno", "retornarMensajesXAnno"]` (`:49-50, :145`).
- **best-effort POR OP con log** (`:152-159`); si AMBAS ops fallan → **LANZA** (`:166-168`, WR-04: fallo total ≠ "año vacío").
- validación de año `1990..2100` + `encodeURIComponent` (`:141-148`, V5).

**Anti-pattern (RESEARCH:163):** prmID NO sale de R2 existente (R2 solo tiene `leyes`/`infoprobidad`). El método hace pasada NUEVA a fuente, persistiendo el crudo XML a R2 PRIMERO (dos-etapas), no `--from-r2`.

---

### `packages/tramitacion/src/run-backfill-prmid-cli.ts` (cli, NUEVO)

**Analogs:** `run-enumerar-historico-cli.ts` (esqueleto LOCAL) + `run-tramitacion-prod-cli.ts` (service_role + R2 env).

**Esqueleto CLI LOCAL** — de `run-enumerar-historico-cli.ts`:
- `flagValue()` (`:29-32`), `loadEnv()` BOM-safe con precedencia `process.env` (`:39-51`).
- validación de rango `--desde/--hasta` 1990..2100 (`:64-76`).
- ensamblado de colaboradores `@obs/ingest` VERBATIM (`:80-84`): `new Fetcher()`, `new HostRateLimiter()`, `new RobotsGuard({ allowlist: {} })`.
- `--dry-run` gate (`:86-93`).
- **isMain regex propio del archivo** (`:129-134`, MEMORY gotcha "dos entrypoints CLI") — debe matchear `run-backfill-prmid-cli`.
- exit 1 si hubo errores (`:126`).

**Cliente Supabase remoto (service_role) + env R2** — de `run-tramitacion-prod-cli.ts`:
```typescript
const createSupabaseClient = (url, serviceKey) => createClient(url, serviceKey);  // :49-50
// loadEnv promueve estas keys de process.env (:75-86):
//   SUPABASE_API_URL, SUPABASE_SECRET_KEY, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_ENDPOINT_URL, R2_BUCKET
const sb = createClient(url, serviceKey, { auth: { persistSession: false } });     // :110
```

**Core two-stage** (RESEARCH diagram :97-108):
1. ETAPA 1: `R2Store.putImmutable("camara-legislativo", String(anno), date, sha, "xml", body)` — crudo primero.
2. ETAPA 2: por par, `sb.from("proyecto").update({ prm_id_camara: prmId }).eq("boletin", boletin)` — SOLO filas que existen (no crea proyectos).

**Fail-loud a preservar:** un error de lectura/escritura LANZA (nunca `?? []` que parezca "DB vacía"), solo propaga `error.message` NUNCA la service key (`run-tramitacion-prod-cli.ts:102, :120`).

---

### `app/components/validacion-fuente.tsx` (component, NUEVO) + `.test.tsx`

**Analog:** `app/components/provenance-badge.tsx` (`:58-71`) — idiom de link externo seguro.

**Link externo seguro (LOCKED, copiar verbatim el idiom):**
```tsx
import { safeExternalHref } from "@/lib/utils";          // provenance-badge.tsx:7
const safeUrl = safeExternalHref(url);                    // :37 — solo http(s); javascript:/data: → null
// render:
<a href={safeUrl} target="_blank" rel="noopener noreferrer"
   aria-label={`Ver en el Senado (abre en nueva pestaña)`}>  // :62-67
  Ver en el Senado ↗
</a>
```
`safeExternalHref` (`app/lib/utils.ts:15-23`): solo `https:`/`http:`, si no → `null` (#9).

**Deep-link fail-honest server-side** (RESEARCH:150-159, page.tsx no-leak precedente):
```tsx
const senadoUrl = `https://tramitacion.senado.cl/appsenado/templates/tramitacion/index.php?boletin_ini=${encodeURIComponent(proyecto.boletin)}`;  // SIEMPRE
const camaraUrl = proyecto.prm_id_camara
  ? `https://www.camara.cl/legislacion/proyectosdeley/tramitacion.aspx?prmID=${encodeURIComponent(proyecto.prm_id_camara)}&prmBOLETIN=${encodeURIComponent(proyecto.boletin)}`
  : null;                                                  // Cámara SOLO si prm_id_camara != null
// BCN: omitido del DOM (sin idNorma — cuerpos_legales = {norma, articulos}). NO fila, NO placeholder.
```

**Respaldo R2 sin descarga (allowlist de prefijo — RESEARCH:235-251):**
```tsx
// Mostrar: "Respaldo del {fetched_at} · hash {content_hash.slice(0,12)}…"  — NUNCA r2_path como href
// SOLO servir cuando r2_path empieza con "tramitacion/". JAMÁS "infoprobidad/"/"servel"/"money"/"rut".
```

**GUARDS QUE MUERDEN:**
- **Anti-insinuación** (UI-SPEC §Color, page.tsx:37 CAVEAT): Senado vs Cámara se distinguen por TEXTO (label), NUNCA por color; petróleo `--accent-product` solo para el link, nunca fill. Copy factual: leyenda "Esto decía la fuente ese día" (no causal). Linter prohíbe `score`/`ranking`/`nivel`.
- **Key-R2-como-href PROHIBIDO** — precedente ya sentado en `page.tsx:322-328` (`texto_r2_path` = key interna, `sourceUrl: null`). No repetir el error (RESEARCH:167).
- **honest-error #34** (page.tsx:307, :472): un fallo real de DB/red se LANZA — nunca se degrada a un empty fabricado.

**Test (`.test.tsx`)** cubre TRACE-01/03: URL Senado con boletín completo; Cámara solo si prm_id != null; BCN omitido; prefijo R2 allowlist (`tramitacion/*`). Framework: vitest, `pnpm --filter ./app test -- --run validacion-fuente`.

---

### `app/app/proyecto/[boletin]/page.tsx` (route, MODIFICAR)

**Analog:** sí mismo — patrón de sección hermana + read cacheado + source_snapshot.

**Montaje de sección hermana `mt-12`** (frontier rule LOCKED, `:102-106, :185-190`):
```tsx
<section id="validacion-fuente" className="mt-12">
  <Suspense fallback={<ValidacionFuenteSkeleton />}>
    <ValidacionFuenteSection boletin={boletin} />
  </Suspense>
</section>
```
Entrada del rail correspondiente en `navEntries` (`:245-274`) — `{ id: "validacion-fuente", label: "..." }`. **Actualizar `RailSkeleton` count** (`:580-595`): el skeleton DEBE igualar el nº de entradas o hay CLS visible (WR-02).

**Read cacheado** — `leerProyecto` (`:344-359`) ya hace `select("*")` → `prm_id_camara` viaja SIN cambiar la query (columna aditiva). `createServerSupabase()` = service_role.

**Read de source_snapshot** (RESEARCH:236-251) — nuevo read server-side por boletín:
```tsx
const sb = createServerSupabase();  // service_role
const { data } = await sb.from("source_snapshot")
  .select("content_hash, fetched_at, r2_path")
  .eq("source", "leyes").eq("resource", boletin)
  .order("date_bucket", { ascending: false }).limit(1).maybeSingle();
```

**GUARD QUE MUERDE (lockdown-guard block B):** `app/lib/lockdown-guard.test.ts:133-144` — `source_snapshot` NO está en `PII_TABLES` → `.from("source_snapshot")` en el árbol público es **PERMITIDO** bajo Camino A (service_role). NO se necesita RPC nueva ni tocar `PUBLIC_RPC_ALLOWLIST` (`:165-182`). Si en su lugar se creara una RPC para leer el snapshot, esa RPC habría que añadirla al allowlist Y no llevar `grant to anon` (block A). Recomendado: read directo `.from()`, sin RPC.

---

### `scripts/validar-deeplinks.mjs` (script, NUEVO)

**Analog:** `scripts/bros-cli.mjs` (Node ESM script, `#!/usr/bin/env node`, sin deps, MCP en 127.0.0.1:9200).

**Comandos curl VERIFICADOS LIVE 2026-07-21** (RESEARCH:296-320):
```bash
UA="ObservatorioCongreso360/1.0 (+https://observatorio-congreso.thevalis.workers.dev; contacto: sanchez.rossi@gmail.com)"
# Senado (portal lento → --max-time 40 --connect-timeout 15): grep -F "$boletin"
# Cámara (curl-first pasa el WAF, --max-time 25): grep -F "$boletin"
# sleep 3 entre boletines (2-3s LOCKED). Muestra ≥10 incl. golden 14309-04 + fixture 16572-06.
```
El prmID de la muestra sale del backfill ya poblado — NO adivinar (RESEARCH:320).

**BrowserOS gate** (RESEARCH:337-342) via `scripts/bros-cli.mjs`: `open <url>` (parsear `Page ID: N`), esperar 4-5s, `shot <page> <abs-path>`, **sleep 8-10s entre shots** (ráfaga tumba el MCP). Móvil 390px = iframe same-origin (MEMORY v8.0). Si MCP caído → curl content-match + handoff, JAMÁS fingir capturas (patrón v7).

## Shared Patterns

### Link externo seguro
**Source:** `app/lib/utils.ts:15-23` (`safeExternalHref`) + `app/components/provenance-badge.tsx:37, :58-71`.
**Apply to:** `validacion-fuente.tsx` — todo `<a href>` externo pasa por `safeExternalHref`; `target="_blank" rel="noopener noreferrer"`; glyph `↗`; `aria-label` con fuente + "(abre en nueva pestaña)".

### Política de fetch respetuosa (@obs/ingest)
**Source:** `connector-camara.ts:69-75` (`assertAllowedUrl → robots → rateLimiter.wait [2-3s] → fetcher`).
**Apply to:** connector-camara (nuevo método) + run-backfill-prmid-cli. NUNCA hand-roll fetch a camara.cl.

### Idempotencia R2 (dos-etapas)
**Source:** `packages/ingest/src/r2-store.ts:56-81` (`putImmutable`, `If-None-Match:*`, 412=OK). **NO tiene presign.**
**Apply to:** run-backfill-prmid-cli ETAPA 1 (persistir crudo XML antes de UPDATE). Descarga pública R2 = DEUDA (sin presign; seguridad gana al feature).

### honest-error (#34)
**Source:** `page.tsx:307, :395, :472`; `run-tramitacion-prod-cli.ts:102, :120`.
**Apply to:** todos los reads/writes nuevos. Fallo real de DB/red → LANZA, NUNCA degrada a empty/dígito fabricado. Solo propaga `error.message`, NUNCA la service key.

### CLI LOCAL one-shot
**Source:** `run-enumerar-historico-cli.ts:29-51, :80-84, :129-134`.
**Apply to:** run-backfill-prmid-cli — `flagValue`, `loadEnv` BOM-safe, colaboradores `@obs/ingest` verbatim, isMain con regex del PROPIO archivo. LOCAL, NUNCA GitHub Actions (CLAUDE.md: backfill masivo = LOCAL).

## No Analog Found

Ninguno. Todos los archivos tienen análogo exacto o role-match en el repo — la fase es plumbing/wiring sin arquitectura net-new (RESEARCH §"Don't Hand-Roll": casi todo ya existe).

## Metadata

**Analog search scope:** `packages/tramitacion/src/`, `packages/ingest/src/`, `app/components/`, `app/app/proyecto/[boletin]/`, `app/lib/`, `supabase/migrations/`, `scripts/`.
**Files scanned:** 9 leídos (7 análogos + lockdown-guard.test.ts + bros-cli.mjs).
**Pattern extraction date:** 2026-07-21
