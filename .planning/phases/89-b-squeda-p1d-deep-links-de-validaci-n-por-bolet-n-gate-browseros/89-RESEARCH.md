# Phase 89: BÚSQUEDA P1d — Deep-links de validación por boletín + gate BrowserOS - Research

**Researched:** 2026-07-21
**Domain:** Trazabilidad accionable en ficha de proyecto (deep-links a fuente oficial + fecha captura + respaldo R2) + deploy pasada 1 + gate BrowserOS empírico
**Confidence:** HIGH (URLs validadas live; censo DB read-only real; plumbing con evidencia file:line)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Senado deep-link**: `?boletin_ini={boletín-COMPLETO-con-sufijo}` — sin sufijo devuelve lista, no ficha. Boletín completo SIEMPRE.
- **Cámara deep-link**: `tramitacion.aspx?prmID={ID}&prmBOLETIN={boletín}` — REQUIERE persistir `prmID` (plumbing de ingesta, no solo UI). Columna nueva aditiva en `proyecto` (p.ej. `prm_id_camara`) + backfill LOCAL vía dos-etapas (R2 primero; solo tocar fuente si el crudo no lo trae, rate-limit 2-3s + curl-first por WAF).
- **BCN/LeyChile**: `idNorma` — SOLO cuando el dato exista (¿viene en `cuerpos_legales` jsonb?); si no hay idNorma, NO se inventa ni se linkea búsqueda genérica.
- **Fail-honest en todos**: sin dato → sin link. Cada link con etiqueta de fuente clara.
- **Jamás**: rutas `/_next/data/{buildId}`, URLs de sesión, links con IDs adivinados.
- **`fecha_captura`** visible junto a los links: "según fuente al {fecha}".
- **Snapshot R2**: el acceso NO puede exponer el bucket crudo (PII cruda vive en R2). Resolución de key SERVER-side a partir del boletín (cero input de key del usuario), allowlist de prefijos. Si no hay camino seguro y barato → degradación honesta: fecha + procedencia + hash SIN descarga pública, deuda documentada (95/96 la endurecería). **La seguridad gana al feature.**
- **Leyenda anti-causal/honesta**: "esto decía la fuente ese día".
- **DEPLOY** con runbook probado (Docker node:22-slim, robocopy a C:/Temp/obs-build, wrangler local OAuth, pnpm 11 dangerouslyAllowAllBuilds). Con el deploy queda LIVE búsqueda híbrida (flag default ON), filtros island (88), deep-links (89).
- **Gate empírico en deploy real** (4 puntos): /buscar literal+boletín → encuentra; filtros operables; ficha → deep-links Senado/Cámara abren la página oficial correcta (HTTP 200 + content-match, curl-first Cámara); evidencia visual BrowserOS (desktop + móvil 390px iframe same-origin).
- **BrowserOS MCP** en `http://127.0.0.1:9200/mcp` (wrapper `scripts/bros-cli.mjs`; save_screenshot en ráfaga tumba el MCP → sleep 8-10s). Si caído: pedir al operador; si no responde, documentar handoff con curl content-match y cerrar (patrón v7) — JAMÁS fingir capturas.
- **Validación empírica ADEMÁS por script** (curl HTTP 200 + content-match) para muestra de boletines.
- **Dos-etapas LOCKED**: si prmID está en el crudo R2 existente → `--from-r2`, cero requests a fuente. Backfill masivo LOCAL.
- **Migración aditiva** para columna(s) nueva(s) (patrón >0044, sin grants); `proyecto` es tabla pública ya servida — el campo nuevo viaja por los reads existentes.

### Claude's Discretion
- Nombre de columna(s) y ubicación exacta del componente UI en la ficha.
- Muestra de boletines para validación empírica (≥10, incluyendo golden set).
- Si idNorma no existe: documentar y acotar BCN a "cuando exista" sin bloquear la fase.

### Deferred Ideas (OUT OF SCOPE)
- Descarga pública de snapshots si el diseño seguro no es barato ahora (documentar deuda → 95/96).
- P2 personas/agenda (90-94); seguridad final (95-96).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TRACE-01 | Deep-link preciso por fuente (Senado/Cámara/BCN) | URLs validadas live (§Deep-links). Senado + Cámara HIGH; BCN sin dato → scope honesto. |
| TRACE-02 | Validación empírica HTTP 200 + content-match, jamás buildId | Comandos curl con UA identificatorio + string de match verificados (§Validación Empírica). |
| TRACE-03 | Fecha captura + snapshot como respaldo | `fecha_captura` ya persistido (0008/0011); manifiesto R2 = `source_snapshot` (§Snapshot R2). Degradación honesta recomendada. |
</phase_requirements>

## Summary

Fase de **plumbing de ingesta + UI de trazabilidad + deploy/gate**, casi sin librerías nuevas. El censo read-only contra PROD (3659 proyectos) resuelve las tres incógnitas duras:

1. **prmID de Cámara NO está en ningún dato ingerido** (0/3659 filas con `prmID=` en `proyecto.enlace`; 3658/3659 `origen=senado-wspublico` con `enlace` uniforme al WS del Senado). Tampoco está en el crudo R2 existente (`source_snapshot` solo tiene `source='leyes'` = XML wspublico del Senado, y `infoprobidad`; NO hay snapshot de WSLegislativo de la Cámara). **Consecuencia:** el backfill de prmID NO puede salir de R2 — requiere una pasada nueva a la fuente Cámara (WSLegislativo `retornarMocionesXAnno`/`retornarMensajesXAnno`, que YA trae `<Id>` junto a `<NumeroBoletin>`, verificado en `parse-camara-legislativo.ts:11-18`). Esto es LOCAL, rate-limited 2-3s, curl-first por WAF, y **debe persistir el crudo a R2 primero** (dos-etapas) para no violar la convención.

2. **idNorma de BCN NO existe en los datos.** El shape de `cuerpos_legales` es exactamente `{norma: string, articulos: string[]}` (`model.ts:25-30`, confirmado por censo: las únicas keys jsonb son `articulos`/`norma` sobre 1499 fichas con cuerpos). El LLM extrae solo el nombre textual de la norma ("Ley N° 19.628"), jamás un id. **BCN se acota honestamente a "cuando exista" y NO se implementa en esta fase** (Claude's Discretion lo autoriza).

3. **El manifiesto de snapshots R2 SÍ existe** (`source_snapshot`, mig 0002): mapea `(source, resource=boletin, date_bucket) → r2_path`. Es RLS deny-by-default (solo service_role). Prefijos: `tramitacion/{boletin}/...` (público, servible) vs `infoprobidad/declaraciones/...` (PII, JAMÁS). El cliente R2 (`R2Store`, aws4fetch) tiene `getObject` pero **NO tiene presign** → servir descarga pública exigiría escribir presign o hacer proxy server-side. Dado que "la seguridad gana al feature", **se recomienda la degradación honesta**: mostrar fecha + procedencia + `content_hash` del snapshot SIN descarga, deuda → 95/96.

**Primary recommendation:** Senado deep-link (cero plumbing, URL directa desde `boletin`) + Cámara deep-link (columna aditiva `prm_id_camara` + backfill LOCAL desde fuente con dos-etapas a R2) + BCN scope-out honesto + respaldo R2 como fecha+hash sin descarga. Migración **0058**. Gate BrowserOS con curl content-match como respaldo reproducible (ambas URLs validadas live 2026-07-21).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Deep-link Senado (URL desde boletin) | Frontend Server (SSR ficha) | — | El boletín ya está en el server component; la URL se construye sin dato extra. |
| Deep-link Cámara (prmID) | Ingesta (backfill LOCAL) + DB (columna) + SSR | — | Requiere plumbing: persistir prmID en `proyecto`, luego el SSR lo lee. |
| Deep-link BCN (idNorma) | — (sin dato) | — | El dato no existe → no hay tier que lo posea; scope-out. |
| Fecha captura visible | Frontend Server (SSR) | — | `fecha_captura` ya llega en `leerProyecto`/`leerFicha`. |
| Respaldo snapshot R2 | Database (manifiesto `source_snapshot`) | Ingesta (R2Store) | La resolución key server-side lee el manifiesto; descarga descartada por seguridad. |
| Validación empírica (curl 200 + match) | Script / CI reproducible | BrowserOS (evidencia visual) | curl es la prueba automatizable; BrowserOS es evidencia humana. |
| Deploy Cloudflare | Build (Docker) + Deploy (wrangler) | — | Runbook probado; flags horneados default ON. |

## Standard Stack

### Core (todo YA en el repo — cero dependencias nuevas)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `fast-xml-parser` | 5.x (`npm:`/workspace) | Parsear WSLegislativo XML (extraer `<Id>` = prmID) | Ya usado en `parse-camara-legislativo.ts`; el `<Id>` ya se parsea (solo se descarta hoy). |
| `@obs/ingest` (Fetcher/RateLimiter/RobotsGuard/assertAllowedUrl) | workspace | Política LOCKED de fetch (SSRF+robots+rate-limit 2-3s+UA) para el backfill Cámara | `connector-camara.ts` ya la ensambla; el backfill reusa `enumerarProyectosXAnno`. |
| `aws4fetch` (`R2Store`) | workspace `@obs/ingest` | Escribir crudo WSLegislativo a R2 (dos-etapas) + leer manifiesto | `r2-store.ts` — `putImmutable`/`getObject`. **NO tiene presign.** |
| `@supabase/supabase-js` v2 | app | SSR reads (`proyecto` con columna nueva) | El campo nuevo viaja por `leerProyecto` (`select("*")`) sin cambio de query. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| prmID desde WSLegislativo `<Id>` | prmID desde HTML `tramitacion.aspx` scraping | WSLegislativo es XML estructurado (ya scrapeado, zod-validado); el HTML es frágil ASP.NET WebForms. Preferir WSLegislativo. |
| Degradación honesta R2 (fecha+hash sin descarga) | Presign GET / proxy server-side con allowlist | Presign no existe en `R2Store` y expone URL firmada; proxy añade superficie. Ambos contradicen "seguridad gana al feature" ahora → deuda 95/96. |

**Installation:** ninguna. Cero `package.json` nuevo.

## Package Legitimacy Audit

No se instalan paquetes externos nuevos en esta fase. Todo es workspace (`@obs/*`) o dependencias ya presentes (`fast-xml-parser`, `aws4fetch`, `@supabase/supabase-js`). **Package Legitimacy Gate: N/A (cero instalaciones).**

## Architecture Patterns

### System Architecture Diagram

```
BACKFILL prmID (LOCAL, one-shot, operador)
  run-*-cli --desde YYYY --hasta YYYY
     │ (enumerarProyectosXAnno → política @obs/ingest: SSRF→robots→rate-limit 2-3s→fetcher)
     ▼
  WSLegislativo.asmx/retornarMocionesXAnno?prmAnno=  ──► XML <ProyectoLey><Id>17140</Id><NumeroBoletin>16572-06</NumeroBoletin>
     │                                                        │
     │ ETAPA 1: persistir crudo XML a R2 (putImmutable)       │ ETAPA 2: parsear <Id>+<NumeroBoletin>
     ▼                                                        ▼
  R2  camara-legislativo/{anno}/{sha}.xml            UPDATE proyecto SET prm_id_camara=<Id> WHERE boletin=<NumeroBoletin>
                                                              │
                                                              ▼  (solo filas que ya existen; no crea proyectos)
                                                        proyecto.prm_id_camara (nullable, aditivo)

FICHA (SSR, server-only)
  /proyecto/[boletin]/page.tsx
     │ leerProyecto(boletin) → proyecto.{boletin, enlace, fecha_captura, prm_id_camara}
     ▼
  <ValidacionFuenteSection>  (NUEVO, hermano mt-12)
     ├─ Senado: https://tramitacion.senado.cl/.../index.php?boletin_ini={boletin}      (SIEMPRE — dato en boletin)
     ├─ Cámara: https://www.camara.cl/.../tramitacion.aspx?prmID={prm_id_camara}&prmBOLETIN={boletin}  (SOLO si prm_id_camara != null)
     ├─ BCN:    (omitido — sin idNorma)
     ├─ "según fuente al {fecha_captura}"  (ProvenanceBadge existente)
     └─ respaldo R2: fecha + content_hash del snapshot (SIN descarga)  ← resuelto server-side por boletín

VALIDACIÓN (script reproducible + BrowserOS)
  script: curl -A "<UA identificatorio>" <deep-link> → assert HTTP 200 + grep boletin (curl-first Cámara por WAF)
  BrowserOS: bros-cli open <deep-link deploy> → shot desktop + móvil 390px (sleep 8-10s entre shots)
```

### Recommended Project Structure (archivos tocados/nuevos)
```
supabase/migrations/0058_proyecto_prm_id_camara.sql   # NUEVO: alter table add column, sin grant (0008 ya dio select a anon)
packages/tramitacion/src/
  parse-camara-legislativo.ts   # MODIFICAR: devolver {boletin, id} en vez de solo boletin (el <Id> ya se lee)
  connector-camara.ts           # MODIFICAR/nuevo método: enumerarProyectosConId (persiste crudo R2 + devuelve pares)
  run-backfill-prmid-cli.ts     # NUEVO (o extender run-enumerar-historico-cli): LOCAL, dos-etapas, UPDATE por boletin
app/
  components/validacion-fuente.tsx   # NUEVO: sección deep-links + fecha + respaldo R2
  app/proyecto/[boletin]/page.tsx    # MODIFICAR: montar <ValidacionFuenteSection> (hermano mt-12) + entrada rail
scripts/validar-deeplinks.mjs        # NUEVO: curl 200 + content-match sobre muestra de boletines
```

### Pattern 1: Columna aditiva servida por reads existentes
**What:** `alter table proyecto add column prm_id_camara text` (nullable). `proyecto` ya tiene `grant select to anon` + RLS public-read (0008). El campo viaja por `leerProyecto`'s `select("*")` sin tocar la query.
**When to use:** Campo público adicional en tabla ya servida.
**Example:**
```sql
-- Source: patrón de 0008_tramitacion.sql (proyecto ya es public-read).
-- Migración 0058 (>0044, sin grants nuevos — el grant select de anon sobre proyecto ya existe).
alter table proyecto add column prm_id_camara text;  -- nullable: fail-honest cuando no se conoce
comment on column proyecto.prm_id_camara is 'ID interno Cámara (WSLegislativo <Id>) para deep-link tramitacion.aspx?prmID=. NULL = desconocido.';
```

### Pattern 2: Deep-link server-side, fail-honest
**What:** El SSR construye la URL solo si el dato existe. Senado siempre (boletín en mano); Cámara solo si `prm_id_camara != null`; BCN nunca (sin idNorma).
**Example:**
```tsx
// Source: patrón de la ficha (page.tsx) + safeExternalHref (utils.ts:15).
const senadoUrl = `https://tramitacion.senado.cl/appsenado/templates/tramitacion/index.php?boletin_ini=${encodeURIComponent(proyecto.boletin)}`;
const camaraUrl = proyecto.prm_id_camara
  ? `https://www.camara.cl/legislacion/proyectosdeley/tramitacion.aspx?prmID=${encodeURIComponent(proyecto.prm_id_camara)}&prmBOLETIN=${encodeURIComponent(proyecto.boletin)}`
  : null;
// BCN: omitido — cuerpos_legales no trae idNorma.
```

### Anti-Patterns to Avoid
- **prmID desde R2:** el crudo R2 NO tiene WSLegislativo — el `--from-r2` NO aplica a prmID (censo: solo `leyes`/`infoprobidad`). Requiere pasada a fuente. NO fingir que sale de R2.
- **`prmBOLETIN` solo:** sin `prmID` la ficha Cámara puede no resolver (STACK.md). Persistir prmID sí o sí.
- **Descarga pública del bucket R2:** expone PII cruda; `R2Store` no presigna. Degradación honesta.
- **Link BCN genérico de búsqueda:** prohibido (link genérico presentado como preciso viola fail-honest).
- **`sourceUrl` = key R2 interna:** la ficha actual ya lo evita a propósito (`page.tsx:326` comenta que `texto_r2_path` NO es enlace público). No repetir el error.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Fetch respetuoso a Cámara (WAF) | fetch crudo | `@obs/ingest` (Fetcher+RateLimiter+RobotsGuard+assertAllowedUrl) vía `CamaraConnector` | Política LOCKED 2-3s + UA + robots + SSRF ya ensamblada (`connector-camara.ts:69-75`). |
| Firma SigV4 a R2 | firma manual | `R2Store` (aws4fetch) | `r2-store.ts` — NUNCA hand-roll firma (T-01-05). |
| Sanitizar href externo | regex propio | `safeExternalHref` (`utils.ts:15`) | Solo http/https; rechaza `javascript:`/`data:` (#9). Ya usado en `ProvenanceBadge`. |
| Badge fecha+fuente | markup nuevo | `<ProvenanceBadge>` (`provenance-badge.tsx`) | Ya renderiza "Actualizado hace X · {fuente}" + esStale amber. |
| Idempotencia de snapshot R2 | insert propio | `putImmutable` (If-None-Match: *, 412=OK) | `r2-store.ts:56-81`. |

**Key insight:** casi todo el plumbing (fetch, R2, badge, href-safe) ya existe. El net-new real es: una columna, extraer un `<Id>` que ya se parsea, un CLI de backfill LOCAL, y una sección UI.

## Runtime State Inventory

Fase aditiva (no rename). Aun así, hay **estado de datos** que la fase crea/puebla:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `proyecto.prm_id_camara` — columna NUEVA, se puebla por backfill. 0/3659 filas la tienen hoy. | Migración 0058 (code) + backfill LOCAL (data migration — poblar filas existentes). **Ambas tareas.** |
| Live service config | Ninguno — no hay cron/servicio externo que embeba prmID. El cron leyes-weekly seguiría poblando prmID solo si el connector de tramitación normal lo agrega (fuera de scope: el cron usa Senado wspublico, que no trae prmID). | Documentar: el cron NO poblará prmID; solo el backfill LOCAL + una futura pasada Cámara lo haría. Deuda honesta. |
| OS-registered state | Ninguno. | None. |
| Secrets/env vars | `BUSQUEDA_HIBRIDA_ENABLED` (default ON, `busqueda-hibrida-gate.ts:26`) — NO necesita setearse en Cloudflare (default ON; solo `="false"` apaga). R2 creds (`R2_*`) ya en `.env` para el backfill LOCAL. | None nuevo para el deploy. El backfill LOCAL usa R2 creds existentes. |
| Build artifacts | Ninguno relevante (no hay egg-info/binarios; el build OpenNext se regenera). | None. |

**prmID population es la única data migration.** Cobertura esperada del backfill: acotada a los años que se enumeren (`--desde/--hasta`); los proyectos fuera de rango o que Cámara no liste quedan con `prm_id_camara = NULL` → deep-link Cámara ausente para ellos (fail-honest correcto).

## Common Pitfalls

### Pitfall 1: Asumir que prmID sale de R2 (`--from-r2`)
**What goes wrong:** El plan intenta backfill desde R2 y no encuentra el dato → falla silenciosa o backfill vacío.
**Why:** El censo demuestra que R2 solo tiene `source='leyes'` (Senado wspublico) e `infoprobidad`. NO hay crudo de WSLegislativo Cámara.
**How to avoid:** El backfill de prmID es una pasada NUEVA a la fuente Cámara (con dos-etapas: persistir crudo XML a R2 PRIMERO, luego parsear). El `--from-r2` clásico no aplica aquí. Documentarlo explícito en el plan.
**Warning signs:** `run --from-r2` para prmID devuelve 0 filas.

### Pitfall 2: BCN deep-link inventado desde el nombre de la norma
**What goes wrong:** Se intenta mapear "Ley N° 19.628" → idNorma vía búsqueda BCN y se linkea el primer resultado como si fuera preciso.
**Why:** `cuerpos_legales` no tiene idNorma (solo `{norma, articulos}`). Mapear nombre→id es heurística falible = fail-honest violado.
**How to avoid:** BCN se omite en esta fase. Documentar como "cuando exista idNorma" (deuda). Autorizado por Claude's Discretion.

### Pitfall 3: Senado sin sufijo → lista, no ficha
**What goes wrong:** Usar `boletin_num` (sin sufijo) devuelve página de "boletines encontrados", no la ficha.
**How to avoid:** Usar SIEMPRE `proyecto.boletin` (completo con sufijo). Validado live: `boletin_ini=17441-15` → ficha con hidden input `value="17441-15"`.

### Pitfall 4: Cámara fetch desde Node sin curl-first (WAF)
**What goes wrong:** La validación empírica/backfill con fetch de Node contra `camara.cl` es bloqueada por el WAF (MEMORY: v3.0 gotcha).
**How to avoid:** curl-first para la validación (verificado: curl con UA → HTTP 200). El backfill usa `@obs/ingest` Fetcher (que ya maneja la política); la validación de deep-links usa curl en el script.

### Pitfall 5: Exponer key R2 como href público
**What goes wrong:** Renderizar `r2_path`/`texto_r2_path` como `sourceUrl` → "fuente oficial" muerta o expone estructura del bucket.
**How to avoid:** El respaldo R2 muestra fecha + `content_hash` (del `source_snapshot`), NO un href al bucket. La ficha actual ya sienta el precedente (`page.tsx:322-328`).

## Code Examples

### Extraer prmID del XML WSLegislativo (el `<Id>` ya se lee, solo se descarta)
```typescript
// Source: packages/tramitacion/src/parse-camara-legislativo.ts:11-18 (shape confirmado LIVE 2026-07-10)
// <ProyectoLey><Id>17140</Id><NumeroBoletin>16572-06</NumeroBoletin>...</ProyectoLey>
// Hoy parseCamaraLegislativo(xml) devuelve string[] de boletines (descarta <Id>).
// MODIFICAR para devolver [{ boletin, prmId }]:
const parsed = ProyectoLeySchema.safeParse({
  NumeroBoletin: txt(p.NumeroBoletin) ?? "",
  Id: txt(p.Id) ?? undefined,   // <Id> = prmID; nullable, se descarta si el elemento no lo trae
});
// → { boletin: "16572-06", prmId: "17140" }
```

### Resolver el snapshot R2 server-side por boletín (respaldo, sin descarga)
```typescript
// Source: source_snapshot (mig 0002) — RLS deny-by-default, solo service_role.
// El sitio lee con service_role (guard = la muralla). Prefijo servible = tramitacion/*.
const sb = createServerSupabase(); // service_role
const { data } = await sb
  .from("source_snapshot")
  .select("content_hash, fetched_at, r2_path")
  .eq("source", "leyes")
  .eq("resource", boletin)          // resource = boletín (censo: 3583 boletines)
  .order("date_bucket", { ascending: false })
  .limit(1)
  .maybeSingle();
// Mostrar: "Respaldo al {fetched_at} · hash {content_hash.slice(0,12)}" — NUNCA r2_path como href.
// ALLOWLIST de prefijo: solo servir cuando r2_path empieza con "tramitacion/" (público).
// JAMÁS "infoprobidad/", "servel", "money", "rut".
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `sourceUrl: null` en idea matriz (sin link real) | Deep-link Senado/Cámara preciso por boletín | Esta fase (89) | La ficha gana trazabilidad accionable a la fuente. |
| prmID descartado en el parse | prmID persistido en `proyecto.prm_id_camara` | Esta fase (89) | Habilita el deep-link Cámara. |

**Deprecated/outdated:**
- **Runbook path del CONTEXT** (`milestones/v6.0-phases/61-*/61-02-SUMMARY.md`): **NO existe** en el repo. El runbook de deploy VIGENTE es `.planning/milestones/v8.1-phases/85-sec-ship-seguridad-deploy-final/85-01-SUMMARY.md` (§Deploy v8.1, método idéntico a 81-01).

## Validation Architecture

`workflow.nyquist_validation` no está en `false` → sección incluida.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest (app) + vitest (packages) |
| Config file | `app/vitest.config.*`; workspace por-paquete |
| Quick run command | `pnpm --filter ./app test -- --run` |
| Full suite command | `pnpm test` (raíz) — cubre app/ + packages/ (suite ~1103 packages + ~991 app, MEMORY v8.1) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TRACE-01 | Senado URL construida con boletín completo | unit | `pnpm --filter ./app test -- --run validacion-fuente` | ❌ Wave 0 |
| TRACE-01 | Cámara URL solo si prm_id_camara != null; BCN omitido | unit | idem | ❌ Wave 0 |
| TRACE-01 | prmID extraído del `<Id>` de WSLegislativo | unit | `pnpm --filter ./packages/tramitacion test -- --run parse-camara-legislativo` | ✅ (extender) |
| TRACE-02 | Deep-links vivos HTTP 200 + content-match | script/e2e | `node scripts/validar-deeplinks.mjs` (curl 200 + grep boletin) | ❌ Wave 0 |
| TRACE-03 | fecha_captura visible + respaldo R2 sin href de bucket | unit | `pnpm --filter ./app test -- --run validacion-fuente` | ❌ Wave 0 |
| TRACE-03 | prefijo R2 allowlist (solo tramitacion/*) | unit | idem (guard de prefijo) | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `pnpm --filter ./app test -- --run <archivo>`
- **Per wave merge:** `pnpm --filter ./app test -- --run` + `pnpm --filter ./packages/tramitacion test -- --run`
- **Phase gate:** `pnpm test` verde + `node scripts/validar-deeplinks.mjs` verde + gate BrowserOS/curl en deploy real.

### Wave 0 Gaps
- [ ] `app/components/validacion-fuente.test.tsx` — cubre TRACE-01/03 (URL fail-honest, prefijo R2 allowlist).
- [ ] `scripts/validar-deeplinks.mjs` — cubre TRACE-02 (curl 200 + content-match, curl-first Cámara).
- [ ] Extender `packages/tramitacion/src/parse-camara-legislativo.test.ts` — cubre extracción de `<Id>`.
- [ ] Fixture XML WSLegislativo con `<Id>` para el test del parse (ya existe shape en el test actual `:11-29`).

## Validación Empírica (TRACE-02) — comandos verificados live 2026-07-21

**UA identificatorio respetuoso** (User-Agent obligatorio, CLAUDE.md ingesta respetuosa):
```
UA="ObservatorioCongreso360/1.0 (+https://observatorio-congreso.thevalis.workers.dev; contacto: sanchez.rossi@gmail.com)"
```

**Senado** (validado: HTTP 200, 59KB, `--connect-timeout 15 --max-time 40` por lentitud del portal):
```bash
curl -sL -A "$UA" --max-time 40 --connect-timeout 15 \
  "https://tramitacion.senado.cl/appsenado/templates/tramitacion/index.php?boletin_ini=17441-15" \
  -o /tmp/sen.html -w "HTTP %{http_code}\n"
# content-match: grep -o 'name="boletin_ini"[^>]*value="17441-15"' /tmp/sen.html  ← el boletín se re-emite en el hidden input
# (más simple y robusto: grep -F "17441-15" /tmp/sen.html)
```

**Cámara** (validado: HTTP 200, 65KB; curl-first pasa el WAF; `16572-06` aparece 3× en el HTML):
```bash
curl -s -A "$UA" --max-time 25 \
  "https://www.camara.cl/legislacion/proyectosdeley/tramitacion.aspx?prmID=17140&prmBOLETIN=16572-06" \
  -o /tmp/cam.html -w "HTTP %{http_code}\n"
# content-match: grep -F "16572-06" /tmp/cam.html   (aparece ≥1×)
```

**Rate-limit:** `sleep 3` entre boletines de la muestra (2-3s LOCKED). Muestra ≥10 boletines incluyendo golden set (`14309-04` es el caso canónico de MEMORY). Nota: el `prmID` de la muestra debe salir del backfill ya poblado — no adivinarlo.

## Deploy Runbook (VIGENTE — de 85-01-SUMMARY.md §Deploy v8.1)

**Método (idéntico a 81-01 y 85-01):**
1. **Build:** Docker `node:22-slim`, mount `C:/Temp/obs-build:/host` + `C:/Temp/obs-build/app/.open-next:/open-next-out`, `cp -r /build/app/.open-next/. /open-next-out/` inline al final del build. (pnpm 11: `dangerouslyAllowAllBuilds` en Docker, MEMORY.) Copia previa vía robocopy a `C:/Temp/obs-build` (Windows OneDrive → build path limpio).
2. **Deploy:** `node C:/Users/Carlo/AppData/Roaming/npm/node_modules/wrangler/bin/wrangler.js deploy --config wrangler.jsonc` desde `C:/Temp/obs-build/app/` (wrangler global, OAuth local — CI no tiene creds CF).
3. **Worker:** https://observatorio-congreso.thevalis.workers.dev

**Flags en Cloudflare — censo del mecanismo:**
- Flags se leen de `process.env` en server components/lib vía funciones gate testeables (`busquedaHibridaEnabled`, `crucesPublicEnabled`), con `import "server-only"` (nunca al bundle cliente, sin prefijo `NEXT_PUBLIC_`).
- `BUSQUEDA_HIBRIDA_ENABLED`: **default ON** (`!== "false"`, `busqueda-hibrida-gate.ts:26`). **NO requiere setearse en Cloudflare** — viaja horneado ON. Solo `="false"` (rollback explícito) lo apaga.
- `CRUCES_PUBLIC_ENABLED`: ON en PROD desde 2026-07-02 (default OFF en código, `="true"` requerido) — **NO se toca** en esta fase.
- **No hay flag nuevo para deep-links** (89): la sección se monta siempre; el fail-honest es por-dato (sin prmID → sin link Cámara), no por flag.

**Verificación HTTP post-deploy** (patrón 85-01): `GET /` → 200 + copy SSR presente; headers de seguridad presentes; `GET /proyecto/{boletin}` → 200 con la sección de validación + deep-links.

## Gate BrowserOS (wrapper `scripts/bros-cli.mjs`)

- MCP en `http://127.0.0.1:9200/mcp`. Comandos: `open <url>` (new_hidden_page, imprime `Page ID: N`), `shot <page> <abs-path>`, `content <page>`, `snapshot`, `close`.
- **Gotchas (del wrapper + CONTEXT):** page ID INCREMENTA por sesión — parsear `Page ID: N` del output. Esperar 4-5s tras open (SSR+hidratación). `save_screenshot` puede fallar 1× con "CDP request timeout" → reintentar tras sleep 3. **save_screenshot en ráfaga tumba el MCP → sleep 8-10s entre shots** (CONTEXT).
- **Móvil 390px:** iframe same-origin (patrón v8.0 MEMORY: móvil 390px vía iframe same-origin).
- **Si el MCP está caído:** pedir al operador levantarlo; si no responde → documentar handoff con la evidencia curl (content-match) y cerrar (patrón v7). **JAMÁS fingir capturas.**

## Migración: siguiente número libre

Última migración: `0057_busqueda_hibrida_statement_timeout.sql`. **Siguiente libre = `0058`.**
Patrón: `alter table proyecto add column prm_id_camara text;` — **sin grant nuevo** (>0044, patrón CONTEXT): `proyecto` ya tiene `grant select ... to anon` (0008:105) → el campo nuevo hereda el read público. Aplicar por psql `--single-transaction` UTF8 + reconciliar ledger (D3 de 85-01: el ledger tiene drift — reconciliar antes de cualquier `supabase db push`; aplicar 0058 por psql directo como las anteriores).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | El `<Id>` de WSLegislativo ES el `prmID` que `tramitacion.aspx?prmID=` espera | Deep-links Cámara | Verificado indirecto: censo live con `prmID=17140&prmBOLETIN=16572-06` (Id 17140 del fixture `parse-camara-legislativo.test.ts` corresponde a boletín 16572-06) → HTTP 200 + content-match. **Riesgo BAJO** pero el backfill debe validar 1-2 pares live antes de la corrida masiva. |
| A2 | El backfill Cámara cubrirá un subconjunto (años enumerados), no el 100% de 3659 | Runtime State Inventory | Proyectos fuera de rango quedan sin deep-link Cámara (fail-honest correcto, no un bug). |
| A3 | La lentitud del portal Senado (33s observados) es intermitente, no un bloqueo | Validación Empírica | Si es sistemático, el script curl necesita `--max-time 60`; no bloquea la fase (el link igual funciona en navegador). |

## Open Questions

1. **¿El cron leyes-weekly debería poblar prmID a futuro?**
   - Qué sabemos: el cron usa Senado wspublico (no trae prmID). El backfill Cámara es one-shot LOCAL.
   - Qué falta: decidir si se añade una pasada Cámara incremental al cron (nuevos proyectos quedarían sin prmID hasta un re-backfill).
   - Recomendación: fuera de scope de 89. Documentar como deuda: "prmID solo se puebla por backfill LOCAL; proyectos nuevos quedan NULL hasta re-correrlo". Fail-honest cubre el gap (sin link Cámara para esos).

2. **¿Muestra exacta de boletines para la validación empírica?**
   - Recomendación (Claude's Discretion): ≥10 con prmID ya poblado, incluir `14309-04` (golden canónico) + los del fixture (`16572-06`). Ejecutar tras el backfill, no antes.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| psql | Censo + aplicar 0058 | ✓ | (PROD reachable, 3659 filas leídas) | — |
| curl | Validación empírica deep-links | ✓ | HTTP 200 Senado+Cámara verificado | — |
| SUPABASE_DB_URL | Censo/migración | ✓ | en `.env` | — |
| R2 creds (R2_*) | Backfill dos-etapas (persistir crudo) | ✓ (MEMORY: token R&W válido) | — | — |
| Docker (node:22-slim) | Build deploy | Asumido ✓ (runbook 85-01) | — | build Windows roto (500ea) → Docker obligatorio |
| wrangler (global) | Deploy | Asumido ✓ (OAuth local) | — | CI no tiene creds CF |
| BrowserOS MCP (127.0.0.1:9200) | Gate visual | Runtime (operador) | — | curl content-match + handoff (patrón v7) |

**Missing dependencies with no fallback:** ninguna bloqueante confirmada.
**Missing dependencies with fallback:** BrowserOS MCP → curl content-match + handoff si está caído.

## Security Domain

`security_enforcement` no está en `false` → sección incluida.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V4 Access Control | yes | `source_snapshot` RLS deny-by-default (0002); sitio usa service_role → **guard = la muralla** (lockdown-guard.test). Solo prefijo `tramitacion/*` servible. |
| V5 Input Validation | yes | `boletin` validado por `BOLETIN_RE` (`buscar.ts:30`) antes de tocar DB/URL; `encodeURIComponent` en las URLs; prmID viene de fuente zod-validada. |
| V6 Cryptography | no | Sin cripto nuevo (aws4fetch ya firma R2, no hand-roll). |
| V5 Output (href) | yes | `safeExternalHref` (solo http/https) para todo link externo. |

### Known Threat Patterns for este stack
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Exponer PII cruda de R2 (infoprobidad/servel) | Information Disclosure | Allowlist de prefijo (`tramitacion/*` únicamente); degradación honesta (sin descarga); manifiesto server-side, cero input de key del usuario. |
| Path/SSRF en deep-link | Tampering/SSRF | `BOLETIN_RE` + `encodeURIComponent`; URLs a hosts fijos (senado.cl/camara.cl), nunca construidas con input libre. |
| XSS vía href de fuente | XSS | `safeExternalHref` (rechaza `javascript:`/`data:`, #9). |
| WAF Cámara bloquea validación | DoS (self) | curl-first (verificado 200); rate-limit 2-3s. |
| Guard drift (columna nueva servida) | Info Disclosure | La columna es pública por diseño (prmID no es PII); re-correr lockdown-guard en 95. |

## Sources

### Primary (HIGH confidence — verificados esta sesión)
- Censo DB PROD (psql `SUPABASE_DB_URL`): 3659 proyectos, 0 con `prmID=` en enlace, 3658 `origen=senado-wspublico`; `cuerpos_legales` keys = {articulos, norma} sobre 1499 fichas; `source_snapshot` sources = `leyes` (3583 resources, prefijo `tramitacion/*`) + `infoprobidad` (prefijo PII).
- Deep-link Senado validado live: `boletin_ini=17441-15` → HTTP 200, hidden input `value="17441-15"`.
- Deep-link Cámara validado live: `prmID=17140&prmBOLETIN=16572-06` → HTTP 200, `16572-06` 3× en HTML (curl-first, UA identificatorio).
- Repo reads: `parse-camara-legislativo.ts:11-104` (`<Id>` shape), `connector-camara.ts:41-170`, `r2-store.ts` (sin presign), `snapshot-store-supabase.ts` + `0002_control_tables.sql` (manifiesto), `0008_tramitacion.sql` (proyecto public-read), `0011_fichas_embeddings.sql` + `fichas/src/model.ts:25-30` (cuerpos sin idNorma), `proyecto/[boletin]/page.tsx` (ficha SSR + `sourceUrl:null` precedente), `busqueda-hibrida-gate.ts` (flag default ON), `provenance-badge.tsx`, `utils.ts:15` (safeExternalHref), `scripts/bros-cli.mjs`, `85-01-SUMMARY.md` (runbook deploy vigente).

### Secondary (MEDIUM confidence)
- `.planning/research/STACK.md` §2 — patrones URL (verificados live y reconfirmados aquí).
- MEMORY.md — WAF camara.cl (curl-first), Docker deploy, móvil 390px iframe, ledger drift.

### Tertiary (LOW confidence)
- Lentitud portal Senado (33s) — observada 1×, posiblemente intermitente.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — cero deps nuevas, todo workspace ya presente.
- Architecture (plumbing prmID): HIGH — censo demuestra prmID ausente de datos+R2; fuente (`<Id>`) confirmada en parser + validada live.
- BCN scope-out: HIGH — `cuerpos_legales` sin idNorma confirmado por censo (keys jsonb) + model.ts.
- Snapshot R2 design: HIGH — manifiesto existe (0002); presign ausente en R2Store; degradación honesta recomendada.
- Deep-link URLs: HIGH — ambas validadas live (200 + content-match).
- Deploy/flags: HIGH — runbook 85-01 vigente + flag default ON confirmado en código.

**Research date:** 2026-07-21
**Valid until:** ~2026-08-20 (portales gubernamentales estables; re-verificar URLs si Senado/Cámara cambian templates).
