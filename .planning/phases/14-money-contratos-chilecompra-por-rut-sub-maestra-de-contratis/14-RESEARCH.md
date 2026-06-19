# Phase 14: MONEY Contratos — ChileCompra por RUT + sub-maestra de contratistas - Research

**Researched:** 2026-06-19
**Domain:** Conector REST gubernamental (ChileCompra/Mercado Público) + reconciliación RUT-exacto + DB deny-by-default + gate de exposición
**Confidence:** HIGH (arquitectura del conector y DB, espejada de @obs/probidad/@obs/lobby ya en repo); HIGH (forma de la API ChileCompra, verificada contra docs oficiales); MEDIUM (umbral RUT 50M natural/jurídica — convención SII, no confirmada por endpoint)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Conector @obs/dinero — ingesta ChileCompra**
- Estrategia: `api.mercadopublico.cl`, búsqueda por proveedor/RUT; barrido **serial por RUT** de la maestra respetando el delay 2–3s LOCKED vía **pgmq**; escape hatch de GitHub Actions para el barrido masivo/inicial.
- DV módulo-11: reusar/extender la utilidad de RUT existente en `packages/identity` (`backfill-rut.ts` / `deterministic.ts`); **nunca fabricar RUT**; RUT inválido → cuarentena, nunca fila silenciosa.
- Natural vs jurídica + sub-maestra: etiquetar persona natural vs jurídica por tipo de proveedor; crear sub-maestra `contratista` keyed por RUT del proveedor; el sujeto del contrato es la **entidad proveedora**, distinta de cualquier enlace al parlamentario.
- Provenance: provenance + fecha de corte **por fila** (mismo patrón que `@obs/lobby` / `@obs/probidad`). R2 está bloqueado (probado) → omitir el snapshot crudo y dejar marca; no bloquear por R2.

**Enlace RUT-exacto + estados honestos**
- Regla de enlace (criterio duro): el enlace contrato→parlamentario se fija **ÚNICAMENTE por RUT-exacto** contra el RUT interno de la maestra; **nunca por nombre**; un RUT sin match exacto no produce atribución (NULL + mención cruda, vía el invariante tipado `EnlaceConfirmado`).
- Estados honestos: distinguir tres estados — "enlazado" / "consultado sin contratos" / "no consultado todavía" — vía un marcador de ingesta por parlamentario (como `lobby_ingesta_estado` / `probidad_ingesta_estado`). Un vacío nunca se lee como "limpio".
- RUT no poblado (deuda IDENT-10): el RUT interno de la maestra aún NO está poblado. El conector se construye igual; donde no hay RUT interno, el parlamentario queda **"no consultado todavía"** de forma honesta. No inventar RUT, no bloquear la fase.
- Sub-maestra contratistas: tabla `contratista` cruda keyed por RUT proveedor; deny-by-default a `anon` si contiene cualquier PII; la agregación por contraparte vive en Phase 16.

**Sección de ficha + gate de exposición**
- Gate: la sección de ficha y el RPC público de MONEY van detrás de `moneyPublicEnabled()` (default OFF, server-only); las tablas MONEY nacen deny-by-default a `anon` (RLS + `revoke all ... from anon, authenticated`) hasta el sign-off.
- Redacción: título "Contratos del Estado **asociados al RUT**" (NUNCA "del parlamentario"); carril propio (`mt-12`) + `ProvenanceBadge` + fecha de corte por fila; atribución de fuente ChileCompra = **"mención de la fuente"** (NO CC BY 4.0).
- Persona jurídica en UI: el sujeto mostrado es la entidad proveedora, separada visualmente de cualquier enlace al parlamentario; un contrato a persona jurídica nunca se colapsa en una atribución personal.
- Anti-insinuación: sin lenguaje causal ni de afinidad; cada dataset en su propio carril; regla anti-"máquina de sospechas" fijada en Phase 11.

### Claude's Discretion
- Nombres exactos de tablas/columnas y número de migración (siguiente disponible tras 0023), consistentes con el esquema existente.
- Forma exacta de los query builders de `api.mercadopublico.cl` y estructura interna del paquete `@obs/dinero` (espejando `@obs/probidad`).
- Paginación/orden de la lista de contratos en la ficha.

### Deferred Ideas (OUT OF SCOPE)
- Agregación de contratos por contraparte/empresa — Phase 16.
- Encendido real de `MONEY_PUBLIC_ENABLED` + sign-off legal — operador (F13).
- Poblar el RUT interno de la maestra (IDENT-10) — operador; no inventar RUT.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| MONEY-01 | Conector `@obs/dinero` ingiere contratos del Estado por RUT desde ChileCompra (`api.mercadopublico.cl`); DV módulo-11; persona natural vs jurídica; sub-maestra de contratistas | §ChileCompra API (flujo 2-pasos BuscarProveedor→ordenesdecompra), §RUT módulo-11 (reuso `isRutValido`/`normRut`), §Connector Architecture (espejo @obs/probidad), §DB (tablas `contrato`+`contratista`) |
| MONEY-02 | Ficha muestra "contratos asociados al RUL"; enlace SOLO por RUT-exacto; gate de exposición OFF | §Enlace RUT-exacto (reuso `EnlaceConfirmado` rama `metodo:"rut"`), §DB+Gate (RPC `contratos_de_parlamentario` security-definer, `moneyPublicEnabled` chokepoint), §UI (3 estados honestos, ya especificados en 14-UI-SPEC.md) |
</phase_requirements>

---

## Summary

Phase 14 es la **primera rebanada del bloque MONEY** y es estructuralmente un clon de @obs/probidad/@obs/lobby con dos diferencias load-bearing: (1) la fuente es una **REST/JSON gubernamental con ticket** (no SPARQL ni HTML-WebForms), y (2) el enlace contrato→parlamentario es **RUT-exacto y determinista**, no name-only. Toda la maquinaria difícil (writer idempotente versionado, marcador de ingesta de 3 estados, RLS deny-by-default + revoke + RPC security-definer, gate server-only, invariante `EnlaceConfirmado`) **ya existe en el repo** y se reusa archivo-por-archivo. El trabajo nuevo real es: el adaptador REST de ChileCompra (flujo de 2 pasos), el mapeo del modelo `Contrato`, la sub-maestra `contratista` keyed por RUT, una migración SQL nueva, y el componente de ficha (ya completamente especificado en 14-UI-SPEC.md).

**Hallazgo decisivo de la API (VERIFICADO contra docs oficiales ChileCompra):** `api.mercadopublico.cl` **NO permite consultar órdenes de compra directamente por RUT**. El flujo obligatorio es de **dos pasos**: (1) `GET .../Publico/Empresas/BuscarProveedor?rutempresaproveedor=<RUT>&ticket=<T>` → devuelve `CodigoEmpresa` + `NombreEmpresa`; (2) `GET .../publico/ordenesdecompra.json?fecha=<ddmmaaaa>&CodigoProveedor=<codigo>&ticket=<T>`. El parámetro `fecha` es **un solo día** (ddmmaaaa) → un barrido histórico por proveedor requiere iterar ventanas de día (esto multiplica el costo de requests y refuerza la necesidad del escape-hatch de GitHub Actions). El `ticket` es un **secreto de operador** (se obtiene con Clave Única, límite 10.000 solicitudes/día/ticket) → nuevo `.env` `MERCADOPUBLICO_TICKET`, sin él la corrida degrada a dry-run (NUNCA fabrica).

**Primary recommendation:** Crear `packages/dinero/src/*` espejando @obs/probidad 1:1 (mismos nombres de archivo y roles), con un `ContratoConnector` REST que reusa `@obs/ingest` en el ORDEN LOCKED (`assertAllowedUrl`→`robots.isAllowed`→`rateLimiter.wait`→`fetcher.get`); reconciliación por **RUT-exacto** que mintea `EnlaceConfirmado` SOLO vía `matchDeterminista` rama `metodo:"rut"`; migración **0023_money_contratos.sql** con `contrato` (public-read), `contratista` (deny-by-default + revoke), `contratos_ingesta_estado` (public-read), y RPC `contratos_de_parlamentario` security-definer. Remote apply = checkpoint de operador.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Fetch de ChileCompra (ticket, rate-limit, SSRF) | Connector (Deno/TS, server-only) | GitHub Actions (barrido masivo) | El WAF + el ticket secreto + el delay 2-3s exigen server-only; recurrente→Edge, masivo→Actions (CLAUDE.md regla §6) |
| Resolución RUT→CodigoEmpresa | Connector | — | Paso obligatorio de la API antes de pedir órdenes |
| DV módulo-11 + natural/jurídica | Connector (reuso `@obs/identity`) | — | Validación pura, sin red; `isRutValido` ya existe |
| Enlace contrato→parlamentario (RUT-exacto) | Reconciliación (reuso `matchDeterminista`+`confirmar`) | — | Único escritor del FK; fail-closed por tipo (`EnlaceConfirmado`) |
| Persistencia idempotente + 3 estados | Writer (Supabase service key) | — | `upsert onConflict` + marcador de ingesta; bypassa RLS |
| Sub-maestra `contratista` | DB + Writer | — | Tabla cruda keyed por RUT; agregación difere a Phase 16 |
| Exposición pública (gate + RPC) | Frontend Server (Next.js RSC) | DB (RLS+RPC) | Doble candado: `moneyPublicEnabled` (presentación) + deny-by-default+RPC (datos) |
| Orquestación del barrido (cron→cola→worker) | DB (pg_cron + pgmq) | Connector (worker) | Encola por RUT, worker desencola con delay 2-3s |

---

## Standard Stack

### Core (todo ya en el repo — NO se instala nada nuevo)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@obs/ingest` | workspace | `Fetcher`+`HostRateLimiter`+`RobotsGuard`+`assertAllowedUrl`+`FetchError`+`DriftStore` | El ORDEN LOCKED de fetch (SSRF→robots→rate-limit→get) ya implementado y testeado; `mercadopublico.cl` ya en `DEFAULT_ALLOWED_SUFFIXES` [VERIFIED: allowlist.ts:27] |
| `@obs/identity` | workspace | `isRutValido` (módulo-11), `normRut`, `matchDeterminista` (rama RUT), `confirmar`/`EnlaceConfirmado` | DV-validación y enlace RUT-exacto determinista YA existen [VERIFIED: deterministic.ts:63, enlace-confirmado.ts:59] |
| `@obs/core` | workspace | tipo `Parlamentario`, `normalizarNombre` | Maestra para el cruce por RUT interno |
| `@obs/adjudication` | workspace | `correrPipeline` (NO necesario si el enlace es RUT-only) | Solo si se quisiera fallback name-only — NO en esta fase (enlace SOLO por RUT) |
| `@supabase/supabase-js` | v2 | `SupabaseDineroWriter` | Espejo de `SupabaseProbidadWriter` [VERIFIED: writer-supabase.ts] |
| `zod` | 3.x/4.x | validación de la respuesta JSON de ChileCompra (compuerta de contrato) | Validar `BuscarProveedor` y `ordenesdecompra.json` antes de mapear; un drift de forma → cuarentena |

### Supporting (frontend ficha)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `app/lib/money-gate.ts` (`moneyPublicEnabled`) | existente | Candado B (presentación) server-only | Gatea TODA ruta pública MONEY; chokepoint único (WR-02) [VERIFIED: money-gate.ts] |
| `ProvenanceBadge` / `IdentityMarker` | existente | Provenance por fila + marca de identidad no confirmada | Reuso directo (14-UI-SPEC §Design System) |
| shadcn `Table`/`Badge`/`Skeleton`/`Tooltip` | ya vendored | UI | No se instala nada (14-UI-SPEC §Registry Safety) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `fetch` + `@obs/ingest` directo (REST JSON) | Puppeteer / SDK propio | ChileCompra es REST/JSON puro con ticket → `fetch` basta; sin DOM, sin headless (mismo razonamiento que CLAUDE.md "What NOT to Use") |
| `BuscarProveedor` → `CodigoProveedor` (2 pasos) | filtrar órdenes directamente por RUT | La API **no soporta** filtro por RUT en `ordenesdecompra.json` — el 2-pasos es obligatorio [CITED: chilecompra.cl/api] |
| pgmq (cola por RUT) | iterar maestra en un loop síncrono en una Edge Function | El barrido por-día × por-RUT excede el límite de 10 min/Edge; pgmq + Actions es el patrón LOCKED (CLAUDE.md §2/§6) |

**Installation:** Ninguna. `packages/dinero/package.json` declara dependencias de workspace (`@obs/ingest`, `@obs/identity`, `@obs/core`, `@supabase/supabase-js`, `zod`) — copiar de `packages/probidad/package.json`.

---

## Package Legitimacy Audit

> **N/A para paquetes externos nuevos.** Phase 14 NO instala ningún paquete de registro externo: reusa dependencias de workspace (`@obs/*`) y paquetes ya presentes en el monorepo (`@supabase/supabase-js`, `zod`). slopcheck no aplica — no hay superficie de slopsquatting nueva. La única dependencia "externa" conceptual es la **API HTTP de ChileCompra** (`api.mercadopublico.cl`), ya en el allowlist SSRF y verificada contra docs oficiales (ver §Sources).

---

## Architecture Patterns

### System Architecture Diagram

```
                         pg_cron (diario)
                              │ encola una tarea por RUT interno de la maestra
                              ▼
                      ┌──────────────┐
                      │   pgmq cola  │  (durable, exactly-once, visibility timeout)
                      └──────┬───────┘
                             │ worker desencola en lotes pequeños
                             ▼
   ┌──────────────────────────────────────────────────────────────────┐
   │  @obs/dinero  (Edge Function worker  /  GitHub Actions escape)     │
   │                                                                    │
   │  por cada RUT (delay 2-3s entre requests, ORDEN LOCKED):           │
   │                                                                    │
   │   [1] isRutValido(rut) ── inválido ──► CUARENTENA (0 filas, marca) │
   │        │ válido (normRut)                                          │
   │        ▼                                                           │
   │   [2] GET BuscarProveedor?rutempresaproveedor=RUT&ticket=T         │
   │        │ → { CodigoEmpresa, NombreEmpresa } (zod-validado)         │
   │        │   sin match / 0 proveedor ──► "consultado sin contratos"  │
   │        ▼                                                           │
   │   [3] por cada ventana de día:                                     │
   │        GET ordenesdecompra.json?fecha=ddmmaaaa&CodigoProveedor=..  │
   │        │ → Listado[] (zod-validado)  │ drift de forma ──► cuarent. │
   │        ▼                                                           │
   │   [4] mapear → Contrato (montos/organismo/fechas VERBATIM)         │
   │        + etiqueta persona natural/jurídica (RUT < / ≥ 50M)         │
   │        + provenance inline + fecha_corte por fila                  │
   │        ▼                                                           │
   │   [5] reconciliar RUT-EXACTO contra maestra (matchDeterminista):   │
   │        metodo "rut" único ──► confirmar() ──► EnlaceConfirmado     │
   │        cualquier otro caso ──► enlace null + mención cruda         │
   └──────────────────────────────┬───────────────────────────────────┘
                                   │ writer.upsert (service key, bypassa RLS)
                                   ▼
   ┌───────────────────────────────────────────────────────────────────┐
   │ Supabase Postgres (migración 0023)                                 │
   │  contrato (public-read)  ── parlamentario_id FK nullable           │
   │  contratista (DENY-BY-DEFAULT + revoke)  keyed por rut_proveedor   │
   │  contratos_ingesta_estado (public-read)  marcador 3-estados        │
   │  RPC contratos_de_parlamentario(p_id)  security definer            │
   └───────────────────────────────┬───────────────────────────────────┘
                                    │ SOLO si moneyPublicEnabled()===true
                                    ▼
   ┌───────────────────────────────────────────────────────────────────┐
   │ Next.js RSC  ContratosSection → RPC → ContratosView (3 estados)     │
   │  <section id="dinero" className="mt-12">  (carril propio)           │
   │  gate OFF (default) ⇒ sección ENTERA ausente del HTML               │
   └───────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure (espejo de `packages/probidad/src/`)
```
packages/dinero/
├── package.json                  # copia de probidad (deps workspace)
└── src/
    ├── model.ts                  # Contrato + Contratista + Zod schemas + ORIGEN/sin-licencia-CCBY
    ├── connector-chilecompra.ts  # ContratoConnector REST (BuscarProveedor + ordenesdecompra) + ChileCompraBloqueadaError
    ├── query.ts                  # builders de URL (urlBuscarProveedor, urlOrdenesDeCompra) + ventanas de fecha
    ├── parse-chilecompra.ts      # JSON crudo → Contrato[] (Zod-validado, VERBATIM)
    ├── reconciliar-contrato.ts   # cruce RUT-EXACTO contra maestra → EnlaceConfirmado|null
    ├── writer.ts                 # DineroWriter (interface) + InMemoryDineroWriter (fake)
    ├── writer-supabase.ts        # SupabaseDineroWriter (upsert onConflict idempotente)
    ├── ingest-run.ts             # runIngestDinero: por RUT → fetch (orden LOCKED) → drift → parse → reconcilia → upsert
    ├── ingest-cli.ts             # entry-point acotado; ticket/serviceKey SOLO de env; sin ticket → dry-run
    ├── live-chilecompra.probe.ts # probe live (operador, requiere ticket real)
    └── index.ts                  # barrel
supabase/migrations/0023_money_contratos.sql
supabase/tests/0024_money_contratos.test.sql   # pgTAP (siguiente nº de test tras 0023)
app/components/contratos-de-parlamentario.tsx  # ContratosView + ContratosSection (ya especificado en UI-SPEC)
```

### Pattern 1: Conector REST en el ORDEN LOCKED (espejo de connector-leylobby/infoprobidad)
**What:** El conector NO usa `BaseConnector.run` (su caché diaria saltaría re-corridas). Reusa `@obs/ingest` en el ORDEN LOCKED y mapea 403/503/timeout a un error de bloqueo reconocible (`ChileCompraBloqueadaError`) para degradar honestamente ese RUT sin abortar.
**When to use:** Todo fetch de ChileCompra.
**Example:**
```typescript
// Source: espejo VERIFICADO de packages/probidad/src/connector-infoprobidad.ts:87-103
// y packages/lobby/src/connector-leylobby.ts
private async fetch(url: string): Promise<string> {
  const parsed = assertAllowedUrl(url, this.deps.allowlist);    // SSRF + allowlist (mercadopublico.cl ya allowlisted)
  if (!(await this.deps.robots.isAllowed(url))) throw new RobotsDisallowError(url);
  await this.deps.rateLimiter.wait(parsed.host);                // delay 2-3s serial por host (LOCKED)
  try {
    const body = await this.deps.fetcher.get({ url, headers: { ...HEADERS_CHILECOMPRA } });
    return new TextDecoder().decode(body);
  } catch (err) {
    if (err instanceof FetchError && (err.status === 403 || err.status === 503)) {
      throw new ChileCompraBloqueadaError(url, err.status);
    }
    throw err;
  }
}
```

### Pattern 2: Flujo de 2 pasos RUT→CodigoEmpresa→Órdenes
**What:** ChileCompra no filtra órdenes por RUT. Hay que resolver el `CodigoEmpresa` primero.
**Example:**
```typescript
// Source: CITED chilecompra.cl/api + api.mercadopublico.cl/modules/api.aspx
// Paso 1 — RUT → CodigoEmpresa (el RUT lleva puntos+guión+DV)
//   GET https://api.mercadopublico.cl/servicios/v1/Publico/Empresas/BuscarProveedor
//        ?rutempresaproveedor=70.017.820-k&ticket=<TICKET>
//   → { CodigoEmpresa: "17793", NombreEmpresa: "..." }   (forma exacta: validar en vivo con ticket)
//
// Paso 2 — CodigoEmpresa + día → órdenes (fecha = UN SOLO DÍA, ddmmaaaa)
//   GET https://api.mercadopublico.cl/servicios/v1/publico/ordenesdecompra.json
//        ?fecha=02022014&CodigoProveedor=17793&ticket=<TICKET>
//   → { Cantidad, Listado: [{ Codigo, Nombre, ... }] }
```

### Pattern 3: Enlace RUT-EXACTO determinista (el corazón de la fase)
**What:** El enlace contrato→parlamentario se mintea SOLO con `matchDeterminista` rama RUT (`metodo:"rut"`, único match) → `confirmar(id,"determinista")` → `EnlaceConfirmado`. Cualquier ambigüedad/0/2+ → `null` + mención cruda. **Nunca por nombre.**
**Example:**
```typescript
// Source: espejo de matchDeterminista (deterministic.ts:92-105) + confirmar (enlace-confirmado.ts:59)
// La rama RUT de matchDeterminista YA confirma por RUT exacto único:
const res = matchDeterminista(
  { rut: contrato.rutProveedor, nombreNormalizado: "", camara: ..., periodo: ... },
  maestra,                                    // maestra con `rut` interno poblado
);
const enlace = res.estado === "confirmado" && res.metodo === "rut"
  ? confirmar(res.id, "determinista")         // ÚNICA factory legítima
  : null;                                     // sin RUT interno (IDENT-10) → SIEMPRE null hoy
```
> NOTA CRÍTICA: mientras el `rut` interno de la maestra esté vacío (deuda IDENT-10), `matchDeterminista` cae a la rama nombre — que **NO debe correr** en esta fase (enlace SOLO por RUT). El reconciliador de @obs/dinero debe llamar SOLO la rama RUT (o cortar antes de la rama nombre): si no hay RUT interno, el resultado es SIEMPRE `enlace: null` y el parlamentario queda "no consultado todavía". No reusar `correrPipeline` (arrastra el fallback name-only del LLM).

### Pattern 4: Persona natural vs jurídica por umbral de RUT
**What:** Etiquetar el contratista por el cuerpo del RUT.
```typescript
// Source: ASSUMED (convención SII) — el cuerpo numérico ≥ 50.000.000 ⇒ persona jurídica
function tipoPersona(rut: string): "natural" | "juridica" {
  const cuerpo = Number(normRut(rut).slice(0, -1)); // sin DV
  return cuerpo >= 50_000_000 ? "juridica" : "natural";
}
```
> Verificar en vivo: el campo `tipoPersona` puede venir también en la respuesta de `BuscarProveedor`/órdenes. Preferir el campo de la fuente si existe; el umbral 50M es el fallback. NUNCA afirmar "del parlamentario" sobre una persona jurídica (UI-SPEC §Persona jurídica LOCKED).

### Anti-Patterns to Avoid
- **Filtrar órdenes por RUT directamente:** la API no lo soporta — usar siempre BuscarProveedor primero.
- **Reusar `correrPipeline` para el enlace:** arrastra el fallback name-only del LLM; el enlace de esta fase es RUT-only (rama RUT de `matchDeterminista`).
- **Cast a `EnlaceConfirmado`:** el grep gate de la fase lo rechaza; `confirmar()` es la única factory (enlace-confirmado.ts:18).
- **Keyear `contrato` por proveedor solo:** colapsaría órdenes distintas; la PK es el código único de la orden de compra.
- **Leer `MONEY_PUBLIC_ENABLED` crudo:** SIEMPRE vía `moneyPublicEnabled()` (chokepoint WR-02).
- **Un vacío como "limpio":** los 3 estados deben ser textualmente distintos (UI-SPEC LOCKED).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| DV módulo-11 de RUT | Validador propio | `isRutValido` / `normRut` (`@obs/identity`) | Ya testeado; reimplementar arriesga la k mayúscula/minúscula y el cómputo del DV [VERIFIED: deterministic.ts:63] |
| Enlace confirmado | `parlamentario_id: string` desnudo | `EnlaceConfirmado` + `confirmar()` | Sube la guarda de match-equivocado de convención a TIPO (error de compilación) [VERIFIED: enlace-confirmado.ts] |
| Match RUT-exacto | Comparación ad-hoc de strings | `matchDeterminista` rama RUT | Fail-closed por construcción (2+ matches → no confirma) [VERIFIED: deterministic.ts:98] |
| Fetch con SSRF/robots/rate-limit | `fetch` crudo | `@obs/ingest` ORDEN LOCKED | Allowlist gov + delay 2-3s + robots ya implementados; `mercadopublico.cl` ya allowlisted |
| Cola de barrido | Loop síncrono / BullMQ+Redis | pgmq + pg_cron | Exactly-once dentro de Postgres, sin infra extra (CLAUDE.md §2) |
| RLS deny-by-default + revoke | Policies ad-hoc | Patrón VERBATIM de 0021/0022 | Cierra el hueco de default-privileges de Supabase (lección Phase 11) [VERIFIED: 0022_probidad.sql:271-279] |
| Upsert idempotente versionado | Insert + dedup manual | `upsert({onConflict})` + `dedupePorClave` | Patrón de `SupabaseProbidadWriter` [VERIFIED: writer-supabase.ts] |
| Gate de exposición | Truthiness de env | `moneyPublicEnabled()` | Solo el literal "true" enciende; ausencia = OFF seguro [VERIFIED: money-gate.ts:33] |

**Key insight:** Esta fase es ~90% reuso. El único código genuinamente nuevo es el adaptador REST de ChileCompra (forma de URL + Zod de la respuesta) y el mapeo del modelo `Contrato`. Todo lo "peligroso" (identidad, RLS, gate, versionado) ya está resuelto y testeado en fases previas; copiarlo reduce el riesgo a casi cero.

---

## Runtime State Inventory

> Phase 14 es mayormente greenfield (paquete + tablas + componente nuevos). Pero hay estado de runtime que el código no resuelve:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | El `rut` interno de `parlamentario` está **vacío** (deuda IDENT-10) → todo enlace RUT-exacto da `null` hoy. Las tablas `contrato`/`contratista`/`contratos_ingesta_estado` no existen aún. | Data migration (operador, IDENT-10): poblar `parlamentario.rut`. Sin esto la cobertura real es 0 ("no consultado todavía"). El código se construye igual. |
| Live service config | `ticket` de ChileCompra: se obtiene con Clave Única (formulario, email), límite 10.000/día/ticket. NO vive en git ni en el código. | Secreto de operador → nuevo `.env` `MERCADOPUBLICO_TICKET` (ver §Secrets). |
| OS-registered state | pg_cron job para encolar el barrido por RUT: se registra en Postgres, NO en git salvo que la migración lo cree. | Decidir si la migración 0023 crea el cron job (espejar el patrón de fases previas si existe) o si queda como checkpoint de operador. Verificar si fases 11/12 registraron cron. |
| Secrets/env vars | `MONEY_PUBLIC_ENABLED=false` ya en `.env.example` [VERIFIED]. `MERCADOPUBLICO_TICKET` NO existe aún. `SUPABASE_SERVICE_KEY`/`SUPABASE_DB_URL` ya presentes (writer + apply). | Agregar `MERCADOPUBLICO_TICKET=` a `.env.example`; documentar que sin él el CLI degrada a dry-run. |
| Build artifacts | `packages/dinero/` no existe → el workspace (pnpm/turbo) debe reconocerlo tras crearlo. `app/lib/types.ts` `sourceLabel()` no tiene rama ChileCompra. | Crear `package.json`; agregar rama `o.includes("chilecompra")||o.includes("mercado") → "ChileCompra"` a `sourceLabel()` (UI-SPEC §Copywriting nota). |

**R2 (snapshot crudo):** BLOQUEADO (probado 2026-06-18, 401). CONTEXT LOCKED: omitir el snapshot crudo a R2, dejar marca, NO bloquear por R2.

---

## Common Pitfalls

### Pitfall 1: Asumir filtro de órdenes por RUT
**What goes wrong:** Construir `ordenesdecompra.json?RutProveedor=...` → no existe ese parámetro; la consulta ignora el filtro o devuelve error.
**Why it happens:** Es la forma "obvia" desde el dominio.
**How to avoid:** Flujo de 2 pasos OBLIGATORIO (`BuscarProveedor` → `CodigoEmpresa` → `ordenesdecompra` por `CodigoProveedor`). [CITED: chilecompra.cl/api]
**Warning signs:** Respuestas vacías para proveedores que sí tienen órdenes.

### Pitfall 2: `fecha` es un solo día
**What goes wrong:** Pasar un rango o omitir `fecha` esperando "todo el histórico" del proveedor → la API espera UN día (ddmmaaaa).
**Why it happens:** Otras APIs aceptan rangos.
**How to avoid:** Iterar ventanas de día; el barrido histórico por proveedor es N días × M proveedores → usar GitHub Actions (escape hatch) para el snapshot inicial, pgmq para el incremental. Diseñar `query.ts` con un generador de fechas.
**Warning signs:** El barrido inicial revienta el límite de 10 min de Edge Functions o el límite de 10.000 req/día del ticket.

### Pitfall 3: Confiar en CI para "el DDL se aplicó"
**What goes wrong:** `build`/`typecheck` pasan, pero Postgres NUNCA ejecutó la migración (falso positivo, lección de 0022).
**Why it happens:** El DDL no corre en CI.
**How to avoid:** La única prueba válida es el pgTAP corriendo contra un schema APLICADO. Apply remoto = **checkpoint de operador** vía `supabase db push --db-url "$SUPABASE_DB_URL"` esquivando el BOM del `.env` [VERIFIED: env-credentials-reality.md]. [VERIFIED: 0022_probidad.sql:12-17]
**Warning signs:** Tests verdes en CI, ficha en blanco en runtime.

### Pitfall 4: Enlace por nombre cuando no hay RUT interno
**What goes wrong:** Caer al fallback name-only de `matchDeterminista`/`correrPipeline` y atribuir un contrato por homonimia.
**Why it happens:** `matchDeterminista` cae a la rama nombre si el RUT no matchea.
**How to avoid:** El reconciliador de @obs/dinero llama SOLO la rama RUT; sin RUT interno → `enlace:null` SIEMPRE. NO reusar `correrPipeline`. Un grep gate puede prohibir `correrPipeline`/`normalizarNombre` en `packages/dinero`.
**Warning signs:** Algún `parlamentario_id` poblado mientras `parlamentario.rut` está vacío → bug existencial.

### Pitfall 5: Default privileges de Supabase exponen `contratista`
**What goes wrong:** `enable row level security` sin policy niega FILAS, pero el PRIVILEGIO SELECT sigue concedido a `anon` por default privileges → la tabla PII queda con grant.
**Why it happens:** Lección Phase 11: Supabase concede privilegios por default a `anon` en cada tabla nueva de `public`.
**How to avoid:** `revoke all on contratista from anon, authenticated;` VERBATIM (como 0021:98 / 0022:279). El pgTAP lo codifica (3 asserts: RLS enabled + 0 policies + 0 grant SELECT). [VERIFIED: 0023_money_gate.test.sql]
**Warning signs:** pgTAP de "anon SIN grant SELECT" en rojo.

### Pitfall 6: Drift de la respuesta JSON leído como "sin contratos"
**What goes wrong:** ChileCompra cambia la forma del JSON → el parser produce 0 filas que se leen como "consultado sin contratos".
**Why it happens:** Sin compuerta de forma.
**How to avoid:** Validar con Zod; una forma inesperada (sin `Listado`/`Cantidad`) → **cuarentena** (0 filas + degradación), NUNCA filas vacías. Mismo patrón que `runIngestProbidad` drift BLOQUEANTE [VERIFIED: ingest-run.ts:137-180].
**Warning signs:** Caída abrupta a 0 contratos para muchos proveedores a la vez.

---

## Code Examples

### RLS deny-by-default + revoke (sub-maestra `contratista`)
```sql
-- Source: VERIFIED — VERBATIM de 0022_probidad.sql:268-279 (declaracion_familiar)
alter table contratista enable row level security;
-- intencionalmente NINGÚN create policy ... to anon; NINGÚN grant select ... to anon
revoke all on contratista from anon, authenticated;   -- cierra el hueco de default privileges
```

### RPC público security-definer (espejo de declaraciones_de_parlamentario)
```sql
-- Source: VERIFIED — espejo de 0022_probidad.sql:287-302
create function public.contratos_de_parlamentario(p_id text)
returns table ( /* SOLO campos que la fuente publica + fecha_corte; SIN parlamentario_id interno, SIN rut_proveedor PII si aplica */ )
language sql stable security definer set search_path = '' as $$
  select c.codigo_orden, c.proveedor_nombre, c.tipo_persona, c.organismo,
         c.monto, c.fecha_oc, c.origen, c.fecha_captura, c.fecha_corte, c.enlace, c.licencia
  from public.contrato c
  where c.parlamentario_id = p_id           -- SOLO confirmados (RUT-exacto) → nunca un no-confirmado bajo el parlamentario
  order by c.fecha_oc desc;
$$;
revoke execute on function public.contratos_de_parlamentario(text) from public;
grant  execute on function public.contratos_de_parlamentario(text) to anon;
```

### Marcador de 3 estados (server-derivado en la ficha)
```typescript
// Source: VERIFIED — espejo de LobbySection (lobby-de-parlamentario.tsx:311-323), pero con TRES outcomes
// 1) sin RUT interno (IDENT-10) O sin fila en contratos_ingesta_estado → "no consultado todavía" (DEFAULT)
// 2) fila presente + 0 contratos RUT-exactos → "consultado sin contratos (corte al {fecha})"
// 3) fila presente + >=1 contrato → "enlazado" (lista paginada)
const noConsultado = estadoData === null;             // ausencia de marcador
const consultadoSinContratos = estadoData !== null && contratos.length === 0;
// (la ausencia de RUT interno se modela igual que ausencia de marcador → estado 1)
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Endpoints `.aspx` legacy de ejemplo | `servicios/v1/publico/ordenesdecompra.json` (REST JSON v1) | API v1 vigente | Usar siempre la ruta `servicios/v1/...json` (no las páginas `.aspx` de doc) |
| Acceso sin ticket | Ticket obligatorio vía Clave Única, 10.000/día | actual | El ticket es secreto de operador; sin él la corrida degrada a dry-run |

**Deprecated/outdated:**
- Las páginas `api.mercadopublico.cl/modules/*.aspx` redirigen a `chilecompra.cl/api/` — son documentación, no endpoints de datos. Los endpoints de datos viven en `servicios/v1/...`.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Umbral persona jurídica = cuerpo de RUT ≥ 50.000.000 | Pattern 4 | Etiqueta natural/jurídica equivocada en la ficha; mitigado si la fuente trae el campo `tipoPersona` directamente (preferirlo). Convención SII ampliamente usada pero no confirmada por el endpoint. |
| A2 | Forma exacta de la respuesta de `BuscarProveedor` (`CodigoEmpresa`,`NombreEmpresa`) y de `ordenesdecompra.json` (`Cantidad`,`Listado[]`) | Pattern 2 | El Zod schema y el mapeo del modelo dependen de esto; debe verificarse en vivo con un ticket real (probe de operador) antes de cerrar el parser. Forma derivada de docs + libs comunitarias, no de respuesta capturada. |
| A3 | `fecha` en `ordenesdecompra.json` es un solo día (ddmmaaaa), sin parámetro de rango | Pitfall 2 | Si aceptara rango, el diseño de ventanas-de-día es sub-óptimo (no incorrecto). Confirmado por docs oficiales como ddmmaaaa por-día. |
| A4 | El RPC `contratos_de_parlamentario` puede emitir el RUT del proveedor (¿PII? persona natural) | Code Examples / DB | Si el RUT de una persona natural cuenta como PII bajo Ley 21.719, el RPC NO debe emitirlo (igual que lobby oculta `contraparte_id`). Decisión legal pendiente → por defecto NO emitir RUT crudo; mostrar nombre + tipo. |
| A5 | El número de migración es 0023 (no existe `0023_*.sql`; el `0023_money_gate.test.sql` es solo un test) | DB+Gate | Si un `0023_*.sql` se agrega antes, usar el siguiente nº libre. Verificado: max migración SQL = 0022; existe `supabase/tests/0023_money_gate.test.sql` (test, no migración). |

---

## Open Questions

1. **¿La respuesta de ChileCompra trae el RUT del proveedor en las órdenes, o solo el nombre/código?**
   - What we know: `BuscarProveedor` mapea RUT→CodigoEmpresa; las órdenes se piden por CodigoProveedor.
   - What's unclear: si cada orden re-expone el RUT del proveedor (necesario para la sub-maestra `contratista` keyed por RUT) o si hay que conservar el RUT de entrada.
   - Recommendation: keyear `contratista` por el RUT de ENTRADA (el que se consultó, ya DV-validado), no por un campo de la respuesta. Verificar la respuesta con probe de operador.

2. **¿La migración 0023 crea el pg_cron job del barrido, o queda como checkpoint de operador?**
   - What we know: pgmq+pg_cron es el patrón LOCKED.
   - What's unclear: si fases previas (11/12) ya registraron cron en migración o lo dejaron manual.
   - Recommendation: revisar 0021/0022 por `cron.schedule`; si no lo hacen, dejar el cron como checkpoint de operador y construir solo el worker + CLI.

3. **¿El RUT de persona natural del proveedor es PII bajo Ley 21.719?**
   - What we know: lobby/probidad ocultan identificadores de tercero en el RPC público.
   - What's unclear: el alcance legal para RUT de proveedor del Estado (dato ya público en ChileCompra).
   - Recommendation: por defecto NO emitir el RUT crudo en el RPC público; esperar el sign-off legal (F13). El gate OFF cubre el riesgo mientras tanto.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `MERCADOPUBLICO_TICKET` | Fetch de ChileCompra | ✗ (no existe) | — | Sin ticket → CLI degrada a dry-run (InMemory writer); NUNCA fabrica |
| `parlamentario.rut` poblado | Enlace RUT-exacto | ✗ (deuda IDENT-10) | — | Todo enlace → null → "no consultado todavía" honesto |
| `SUPABASE_DB_URL` / `SUPABASE_SERVICE_KEY` | Apply migración + writer | ✓ | pooler sa-east-1 | — (BOM del .env → pasar `--db-url` explícito) |
| `mercadopublico.cl` allowlist SSRF | Conector | ✓ | — | Ya en `DEFAULT_ALLOWED_SUFFIXES` [VERIFIED] |
| `moneyPublicEnabled` gate | Ficha pública | ✓ | — | Default OFF (correcto hasta sign-off legal) |
| R2 (snapshot crudo) | Archivo histórico | ✗ (401, probado) | — | LOCKED: omitir snapshot, dejar marca, no bloquear |

**Missing dependencies with no fallback that block PRODUCTION (no la construcción):**
- `MERCADOPUBLICO_TICKET` y `parlamentario.rut` — ambos son **deudas de operador**; la fase se CONSTRUYE completa, la cobertura real queda baja y se muestra honestamente.

**Missing dependencies with fallback:**
- ChileCompra inalcanzable / sin ticket → dry-run; RUT inválido → cuarentena; R2 bloqueado → marca sin snapshot.

---

## Validation Architecture

> `.planning/config.json` no leído en esta sesión; se asume `nyquist_validation` habilitado (default). Ajustar si está `false`.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (paquetes TS) + pgTAP (migraciones SQL) — espejo de @obs/probidad |
| Config file | el del workspace (cada `packages/*/src/*.test.ts`); pgTAP en `supabase/tests/*.test.sql` |
| Quick run command | `pnpm --filter @obs/dinero test` (unit, sin red/DB) |
| Full suite command | `pnpm test` + `supabase test db` (pgTAP contra schema aplicado) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MONEY-01 | DV módulo-11 rechaza RUT inválido → cuarentena | unit | `pnpm --filter @obs/dinero test` | ❌ Wave 0 (`parse/reconciliar.test.ts`) |
| MONEY-01 | parse JSON ChileCompra VERBATIM + drift→cuarentena | unit | idem | ❌ Wave 0 (`parse-chilecompra.test.ts`) |
| MONEY-01 | writer idempotente (re-run = mismos conteos) | unit | idem | ❌ Wave 0 (`writer.test.ts`) |
| MONEY-01 | natural vs jurídica por umbral RUT | unit | idem | ❌ Wave 0 |
| MONEY-02 | enlace SOLO RUT-exacto; sin RUT interno → null | unit | idem | ❌ Wave 0 (`reconciliar-contrato.test.ts`) |
| MONEY-02 | `contratista` deny-by-default + revoke (RLS enabled, 0 policies, 0 grant) | pgTAP | `supabase test db` | ❌ Wave 0 (`0024_money_contratos.test.sql`) |
| MONEY-02 | RPC `contratos_de_parlamentario` revocado de public + grant anon, SOLO confirmados | pgTAP | idem | ❌ Wave 0 |
| MONEY-02 | gate OFF ⇒ sección ausente del HTML | unit (RTL/RSC) | `pnpm --filter app test` | ❌ Wave 0 (consumidor de `moneyPublicEnabled`, WR-02) |
| MONEY-02 | 3 estados honestos textualmente distintos | unit (RTL) | idem | ❌ Wave 0 (`contratos-de-parlamentario` con fixtures) |

### Sampling Rate
- **Per task commit:** `pnpm --filter @obs/dinero test`
- **Per wave merge:** `pnpm test` (workspace)
- **Phase gate:** `supabase test db` verde contra schema APLICADO (checkpoint operador) antes de `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `packages/dinero/src/*.test.ts` — toda la suite unit del conector (no existe el paquete)
- [ ] `supabase/tests/0024_money_contratos.test.sql` — pgTAP de RLS/revoke/RPC
- [ ] Test del consumidor de `moneyPublicEnabled` (chokepoint WR-02 — Phase 13 lo dejó sin consumidor)
- [ ] Fixtures de respuesta ChileCompra (capturados con probe de operador, o sintéticos VERBATIM de docs)

---

## Security Domain

> `security_enforcement` asumido habilitado (default). Dominio crítico: esta es una fuente con secreto (ticket) + datos potencialmente PII (RUT proveedor) + gate legal.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | sí (al servicio) | `MERCADOPUBLICO_TICKET` en `.env`, server-only, NUNCA al cliente ni al log; SOLO de env (nunca argv) — espejo de service key (ingest-cli.ts) |
| V4 Access Control | sí | RLS deny-by-default + revoke + RPC security-definer; gate `moneyPublicEnabled` server-only |
| V5 Input Validation | sí | Zod sobre la respuesta de ChileCompra; `isRutValido` sobre el RUT; drift→cuarentena |
| V6 Cryptography | no | sin cripto propia |
| V7 Logging | sí | NUNCA interpolar el ticket ni la service key en mensajes de error (espejo writer-supabase) |
| V9 SSRF | sí | `assertAllowedUrl` + allowlist (`mercadopublico.cl`) ANTES de cada fetch [VERIFIED] |

### Known Threat Patterns for este stack
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Filtración del ticket en logs/bundle | Information Disclosure | Ticket SOLO de env, server-only, jamás interpolado en errores |
| Exposición prematura MONEY (sin sign-off legal) | Information Disclosure | Doble candado: gate OFF (presentación) + deny-by-default+revoke (datos); ambos fail-closed |
| Atribución equivocada por homonimia | Tampering / Repudiation | Enlace SOLO RUT-exacto (`EnlaceConfirmado`), nunca por nombre; sin RUT interno → null |
| RUT de tercero (persona natural) expuesto | Information Disclosure | RPC NO emite RUT crudo por defecto; `contratista` deny-by-default; decisión legal pendiente (OQ3) |
| SSRF a metadata/loopback vía URL fabricada | Tampering | `assertAllowedUrl` rechaza no-gov ANTES del fetch |

---

## Sources

### Primary (HIGH confidence)
- `packages/probidad/src/*` (repo) — análogo de conector completo (connector/parse/reconciliar/writer/writer-supabase/ingest-run/ingest-cli/model) — HIGH
- `packages/lobby/src/connector-leylobby.ts` (repo) — análogo REST/HTTP con `*Bloqueada Error` — HIGH
- `packages/identity/src/{deterministic,backfill-rut,enlace-confirmado}.ts` (repo) — `isRutValido`/`normRut`/`matchDeterminista`/`confirmar`/`EnlaceConfirmado` — HIGH
- `supabase/migrations/0022_probidad.sql` (repo) — RLS public-read + deny-by-default + revoke + RPC security-definer + marcador de ingesta — HIGH
- `supabase/tests/0023_money_gate.test.sql` (repo) — candado A (deny-by-default + revoke) que money_* hereda — HIGH
- `app/lib/money-gate.ts` + `app/components/lobby-de-parlamentario.tsx` (repo) — gate server-only + patrón de sección de ficha con estados honestos — HIGH
- `packages/ingest/src/allowlist.ts` (repo) — `mercadopublico.cl` ya en `DEFAULT_ALLOWED_SUFFIXES` — HIGH
- `14-UI-SPEC.md` (repo) — contrato visual completo de la sección (3 estados, persona jurídica, copy) — HIGH
- MEMORY `env-credentials-reality.md` — DB apply remoto vía `--db-url`; BOM del `.env`; R2 bloqueado — HIGH

### Secondary (MEDIUM confidence — docs oficiales ChileCompra)
- [API de Mercado Público — ChileCompra](https://www.chilecompra.cl/api/) — endpoints, ticket, formato de fecha — MEDIUM-HIGH
- [Utilización — API Mercado Público](https://api.mercadopublico.cl/modules/api.aspx) (redirige a chilecompra.cl/api) — métodos por proveedor/fecha — MEDIUM
- [Diccionario de Datos — Órdenes de Compra (PDF)](http://www.chilecompra.cl/wp-content/uploads/2026/03/Documentacion-API-Mercado-Publico-oc.pdf) — campos de respuesta (PDF binario, no extraído en sesión) — MEDIUM
- [BuscarProveedor — rutempresaproveedor→CodigoEmpresa](https://api.mercadopublico.cl/modules/api.aspx) — flujo RUT→código — MEDIUM

### Tertiary (LOW — comunidad, requieren verificación en vivo)
- [github.com/gepd/MercadoPublico](https://github.com/gepd/MercadoPublico) — confirma `buscarProveedor(rut)` + `buscarProveedorFecha(codigo,fecha)` — LOW (nombres de método, no forma de respuesta)
- Umbral RUT 50M natural/jurídica — convención SII (no confirmada por endpoint) — LOW/ASSUMED

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — todo reuso de workspace ya testeado.
- Architecture (conector/DB/gate/ficha): HIGH — espejo archivo-por-archivo de @obs/probidad + 0022 + UI-SPEC.
- ChileCompra API (flujo, ticket, fecha-por-día): MEDIUM-HIGH — verificado contra docs oficiales; forma EXACTA de la respuesta JSON pendiente de probe live con ticket (A2).
- RUT natural/jurídica: MEDIUM — convención SII; preferir campo de la fuente si existe.
- Pitfalls: HIGH — derivados de fases previas + constraints verificados de la API.

**Research date:** 2026-06-19
**Valid until:** 2026-07-19 (estable; la API ChileCompra cambia poco, pero la forma EXACTA de la respuesta debe confirmarse con ticket antes de cerrar el parser)
