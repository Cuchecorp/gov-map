# Phase 70: DINERO P5b — Wire dos-etapas ChileCompra por RUT (funde DEBT-01, SPIKE cuota) - Research

**Researched:** 2026-07-14
**Domain:** Ingesta dos-etapas (fuente→R2→Supabase) sobre un conector REST ya existente; gating deny-by-default; SPIKE de cuota/OCDS
**Confidence:** HIGH (código y patrones localizados en el repo; SPIKE externo MEDIUM)

## Summary

Esta fase es **wiring, no net-new**. Todos los componentes de dinero ya existen desde v2.0: `connector-chilecompra.ts` (REST 2-pasos, redacción de ticket ya implementada), `reconciliar-contrato.ts` (rama jurídica RUT-exacto fail-closed intacta), `runIngestDinero` (`ingest-run.ts`, barrido serial por RUT con degradación honesta), tablas `contrato`/`contratista`/`contratos_ingesta_estado` (migración 0023, gated deny-by-default), y el flag `moneyPublicEnabled()` (server-only, fail-closed). El trabajo real: **inyectar la Etapa 1 R2 en `runIngestDinero`** espejando exactamente el patrón que Phase 66 puso en `runIngest` de tramitación (forward `r2Store`/`snapshotWriter`/`fromR2`; put del crudo LOCKED que gatea la Etapa 2 ante fallo), añadir un modo `--from-r2` replay al CLI de operador, y añadir una **señal de freshness/staleness de ChileCompra** al catálogo de `pnpm freshness`.

**Hallazgo crítico #1:** hoy `ingest-run.ts` de dinero **NO tiene Etapa 1 R2** — fetchea directo del conector a Supabase. La frase "R2 BLOQUEADO" del objetivo se refiere a la marca de **degradación honesta** (`ChileCompraBloqueadaError` → "sin snapshot crudo, marca") en la línea 14 del comentario y en el flujo de bloqueo, NO a un flag deshabilitando R2. "Desbloquear" = **añadir el wire de dos-etapas que hoy no existe en dinero**, replicando `packages/tramitacion/src/ingest-run.ts:293-357`.

**Hallazgo crítico #2 (discrepancia de nombre):** CONTEXT.md dice `CHILECOMPRA_TICKET`; el código real usa **`MERCADOPUBLICO_TICKET`** (`.env.example:87`, `ingest-cli.ts:106`, `live-chilecompra.probe.ts`, `connector-chilecompra.test.ts`). El planner DEBE reusar `MERCADOPUBLICO_TICKET` (ya cableado + testeado + redactado), no introducir un nombre nuevo.

**Hallazgo crítico #3 (matiz de la regla LOCKED):** CONTEXT dice "persona jurídica reconcilia SOLO por RUT exacto fail-closed — nunca name-match/LLM". El código ya cumple esto **para jurídica** (`reconciliar-contrato.ts:310-315`, `resolverEntidadProveedor` juridica = RUT-only). PERO `reconciliar-contrato.ts` **sí name-matchea persona NATURAL** vía `correrPipeline` (retrofit "finalidad del dato", aprobado por operador, super-seeds la regla absoluta previa). Phase 69 congeló el corte "name-match ≠ escribir rut". El wire de esta fase **no debe tocar `reconciliar-contrato.ts`** — solo threadear R2 alrededor de él. Grep-gate `git diff` vacío en el reconciliador (espejo de Phase 66 SC).

**Primary recommendation:** Threadear `r2Store`/`snapshotWriter`/`fromR2` en `runIngestDinero` (envelope por-RUT content-addressed en R2 ANTES de reconciliar/upsert; put fallido gatea Etapa 2), añadir `--from-r2` al CLI, añadir señal freshness `contratos`/ChileCompra al `CATALOG`, todo con datos fake offline. Reusar `MERCADOPUBLICO_TICKET`. Dejar `reconciliar-contrato.ts` / `model.ts` / `0023` intactos. El crawl LIVE cuota-limitado es operador-LOCAL (runbook).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Fetch REST ChileCompra (2 pasos por RUT) | Conector Deno/TS (`@obs/dinero`) | — | Ya existe; server-only, rate-limit 2-3s, SSRF/robots vía @obs/ingest |
| Etapa 1: crudo→R2 content-addressed | Conector/orquestador (`ingest-run.ts` + `@obs/ingest` R2Store) | Cloudflare R2 (storage) | Regla LOCKED CLAUDE.md: crudo PRIMERO en R2, immutable, hash-check |
| Etapa 2: R2→Supabase (parse+reconcilia+upsert) | Orquestador (`ingest-run.ts`) | Supabase Postgres | Derivado reconstruible desde R2; `--from-r2` replay sin tocar la fuente |
| Reconciliación RUT-exacto / name (natural) | `reconciliar-contrato.ts` (identidad) | — | INTACTO; jurídica RUT-only fail-closed; Phase 69 lo congela |
| Persistencia versionada (contrato/contratista) | `writer-supabase.ts` (service_role) | Supabase | PK (fuente_id, fecha_corte); contratista deny-by-default |
| Gate de exposición pública MONEY | `app/lib/money-gate.ts` (frontend server-only) | RLS 0023 (candado A datos) | Doble candado: datos existen, presentación OFF hasta flip legal |
| Señal de staleness ChileCompra | `packages/freshness` (CLI operador) | Supabase (read-only) | Espejo del CATALOG existente (leyes/probidad/lobby) |
| Crawl LIVE cuota-limitado multi-día | Operador-LOCAL (runbook) | — | 10k/día, ticket secreto; NO GitHub Actions (CLAUDE.md backfill masivo LOCAL) |

## Standard Stack

Cero paquetes externos nuevos. Todo el stack ya está en el monorepo y verificado en producción.

### Core (todo existente — reuso, no instalación)
| Módulo | Ubicación | Propósito | Estado |
|--------|-----------|-----------|--------|
| `ChileCompraConnector` | `packages/dinero/src/connector-chilecompra.ts` | Fetch REST 2-pasos + redacción ticket | EXISTE, intacto |
| `runIngestDinero` | `packages/dinero/src/ingest-run.ts` | Orquestación serial por RUT | EXISTE — **añadir R2 wire** |
| `reconciliarContrato` | `packages/dinero/src/reconciliar-contrato.ts` | Cruce RUT-exacto (jurídica) / nombre (natural) | EXISTE, **NO tocar** |
| `R2Store` (`putImmutable`/`getObject`) | `packages/ingest/src/r2-store.ts` | Crudo content-addressed a R2 (aws4fetch SigV4) | EXISTE, reusar |
| `SnapshotWriter` | `@obs/ingest` (`snapshot.ts`) | Provenance source_snapshot (best-effort) | EXISTE, reusar |
| `SupabaseDineroWriter` / `InMemoryDineroWriter` | `packages/dinero/src/writer*.ts` | Upsert versionado (fuente_id, fecha_corte) | EXISTE |
| `moneyPublicEnabled` | `app/lib/money-gate.ts` | Gate presentación server-only fail-closed | EXISTE |
| `redactarTicket` | `packages/dinero/src/query.ts` | Redacción `ticket=***` idempotente | EXISTE, testeado |
| `packages/freshness` CATALOG | `packages/freshness/src/catalog.ts` | Señales staleness por fuente | EXISTE — **añadir ChileCompra** |

### Pattern de referencia (el molde a copiar)
`packages/tramitacion/src/ingest-run.ts:293-357` (Etapa 1 R2) + `packages/tramitacion/src/ingest-cli.ts:219-266` (modo `--from-r2` con conectores fake que sirven el envelope). Phase 66 lo aplicó a votos por "RUTA A"; Phase 70 lo aplica a dinero.

### Alternatives Considered
| En vez de | Se podría usar | Tradeoff |
|-----------|----------------|----------|
| Crawl per-RUT (2 pasos, 10k/día) | **OCDS bulk mensual** (datos-abiertos.chilecompra.cl, JSONL comprimido por mes) | Bulk esquiva la cuota pero (a) su forma OCDS difiere del REST ya parseado por `parse-chilecompra.ts`, (b) requiere filtrar por RUT localmente sobre millones de filas, (c) es SPIKE/deferred. Ver §SPIKE. |
| Etapa 1 en `runIngestDinero` | Etapa 1 en `ingest-cli.ts` (como hizo tramitación originalmente) | Phase 66 (W-1) prefirió threadear el runner, NO reusar el CLI como entry-point. Seguir RUTA A por consistencia. |

**Installation:** Ninguna. Si `tsc -b` de `@obs/dinero` no resolviera `SupabaseClient` para la señal freshness (como pasó a `@obs/votos` en Phase 66), añadir `@supabase/supabase-js@^2.108.2` (ya en el monorepo, `pnpm install --offline`, 0 descargas). No es paquete externo nuevo.

**Version verification:** N/A — cero paquetes nuevos del registro. `aws4fetch`, `zod`, `@supabase/supabase-js` ya pinneados y en el store pnpm.

## Package Legitimacy Audit

No aplica: esta fase **NO instala paquetes externos nuevos**. Todos los símbolos (`R2Store`, `SnapshotWriter`, `ChileCompraConnector`, `reconciliarContrato`, `moneyPublicEnabled`) resuelven dentro del monorepo. La única dependencia potencial (`@supabase/supabase-js@^2.108.2`) ya vive en el monorepo (pinneada por `@obs/tramitacion`/`@obs/identity`/`@obs/votos`) — un `pnpm install --offline` la symlinkea sin descargar. slopcheck no aplicable (0 registry installs).

## Architecture Patterns

### System Architecture Diagram

```
                     ┌─────────────────────── run-dinero-masivo-cli (operador-LOCAL) ───────────────────────┐
                     │  MERCADOPUBLICO_TICKET (env, redactado) · maestra · TareaRut[] (rut + días) · --from-r2 │
                     └───────────────────────────────────────┬──────────────────────────────────────────────┘
                                                              │
                          ┌───────────────────────────────────┴─── runIngestDinero(opts) ───┐
                          │  (por cada TareaRut, serial, delay 2-3s LOCKED)                   │
                          │                                                                    │
    NORMAL ───────────────┤                                        --from-r2 REPLAY ───────────┤
                          │                                                                    │
   1. isRutValido (DV)    │                                    getObject(r2Path) ← R2 crudo    │
      inválido→CUARENTENA  │                                          │                          │
          │               │                                    envelope JSON.parse              │
   2. buscarProveedor ────┼──► ChileCompra REST (paso 1)              │ conector FAKE (0 fetch)  │
      →CodigoEmpresa       │    api.mercadopublico.cl                  │                          │
          │               │                                          ▼                          │
   3. ordenesDeCompra ────┼──► ChileCompra REST (paso 2, por día)   parseContratos              │
          │               │                                          │                          │
          ▼               │                                          ▼                          │
   ┌───── ETAPA 1 R2 (NUEVO, LOCKED) ─────┐                    reconciliarContrato               │
   │ envelope{rut, buscarJson, ordenes[]} │                    (INTACTO)                          │
   │ sha256 → putImmutable("dinero",…)    │                          │                          │
   │  412=existed → skip Etapa 2 (idem)   │                          ▼                          │
   │  ERROR → gatea Etapa 2 (no upsert)   │                    upsert versionado                 │
   └──────────────────┬───────────────────┘                    (contrato/contratista)           │
                      │                                                                          │
                      ▼                                                                          │
   ETAPA 2: parseContratos → reconciliarContrato (RUT-exacto jurídica / nombre natural)          │
                      │                                                                          │
                      ▼                                                                          │
   writer.upsertContratos / upsertContratistas / marcarIngestado  →  Supabase (0023, gated OFF) ─┘
                      │
                      ▼
   ┌─── GATE (candado A datos): contratista deny-by-default; contrato public-read pero ───┐
   │     RPC contratos_de_parlamentario solo emite CONFIRMADOS; sin rut_proveedor crudo    │
   └───────────────────────────────────────────────────────────────────────────────────────┘
                      │
   ┌─── GATE (candado B presentación): moneyPublicEnabled()=OFF → ficha NO muestra MONEY ──┐  ← flip legal Phase 73
   └───────────────────────────────────────────────────────────────────────────────────────┘

   ┌─── pnpm freshness: nueva señal ChileCompra staleness (MAX fecha_captura/ingestado_hasta) ──┐
   └────────────────────────────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Archivo | Cambio | Responsabilidad |
|---------|--------|------------------|
| `packages/dinero/src/ingest-run.ts` | **MODIFICAR** | Añadir `r2Store?`/`snapshotWriter?`/`fromR2?` a `RunIngestDineroOpts`; envelope por-RUT + `putImmutable` ANTES del upsert; put fallido gatea Etapa 2 (espejo tramitación:293-357) |
| `packages/dinero/src/ingest-cli.ts` (o nuevo `run-dinero-masivo-cli.ts`) | **MODIFICAR/CREAR** | Construir `R2Store` real de `.env R2_*`; aceptar `--from-r2`; conector fake que sirve el envelope; logar destino LOCAL/REMOTO |
| `packages/dinero/src/reconciliar-contrato.ts` | **NO TOCAR** | grep-gate `git diff` vacío (Phase 69 lo congela) |
| `packages/dinero/src/model.ts` | **NO TOCAR** (monto VERBATIM ya modelado) | `monto: text` VERBATIM; hoy null (CR-02) |
| `supabase/migrations/0023_dinero.sql` | **NO TOCAR** | Tablas ya existen; gate candado A ya codificado |
| `packages/freshness/src/catalog.ts` | **MODIFICAR** | Añadir entrada CATALOG ChileCompra (staleness) |

### Pattern 1: Etapa 1 R2 con put-gatea-upsert (LOCKED)
**What:** Antes de escribir a Supabase, persistir el crudo por-RUT como envelope content-addressed en R2. Si `putImmutable` devuelve `existed=true` (412) → skip Etapa 2 (idempotente). Si LANZA (HTTP no-412 / red) → registrar en `errores` y OMITIR el upsert (el derivado no debe existir sin crudo reconstruible).
**When to use:** Toda corrida con `r2Store` configurado.
**Example:**
```typescript
// Source: packages/tramitacion/src/ingest-run.ts:301-335 (patrón a copiar)
if (opts.r2Store) {
  const envelope = { rut: tarea.rut, buscarProveedor: buscarJson, ordenes: ordenesPorDia };
  const bytes = new TextEncoder().encode(JSON.stringify(envelope));
  const sha = await sha256Hex(bytes);
  const today = new Date().toISOString().slice(0, 10);
  let r2Path: string, existed: boolean;
  try {
    ({ r2Path, existed } = await opts.r2Store.putImmutable("dinero", tarea.rut, today, sha, "json", bytes));
  } catch (err) {
    errores.push({ fuente: ORIGEN_DINERO, clave, mensaje: redactarTicket(String(err)) });
    continue; // Etapa-1-primero LOCKED: sin crudo en R2, NO upsert
  }
  if (existed) { log(`[skip] sin novedades — dinero ${tarea.rut}`); continue; }
  // ...snapshotWriter best-effort... luego Etapa 2 (parse+reconcilia+upsert)
}
```
**Nota clave:** el envelope de dinero es **por-RUT** (no por-boletín). La clave R2 `dinero/<rut>/<fecha>/<sha>.json`. El RUT en la key es un identificador de empresa público (proveedor), no PII de parlamentario — pero verificar con el operador si el RUT en la clave R2 es aceptable, o si se prefiere el `CodigoEmpresa`.

### Pattern 2: `--from-r2` replay con conector fake
**What:** Leer el envelope de R2, inyectar un `ChileCompraConnector` fake cuyos `buscarProveedor`/`ordenesDeCompra` devuelven el crudo del envelope (0 fetch a mercadopublico.cl).
**Example:**
```typescript
// Source: packages/tramitacion/src/ingest-cli.ts:221-265 (patrón a espejar)
if (opts.fromR2) {
  if (!r2Store) throw new DineroCliArgsError("--from-r2 requiere R2 configurado");
  const bytes = await r2Store.getObject(opts.fromR2);
  const envelope = JSON.parse(new TextDecoder().decode(bytes));
  const conectorFake = {
    async buscarProveedor() { return envelope.buscarProveedor; },
    async ordenesDeCompra(_c: string, dia: string) { return envelope.ordenes[dia] ?? { Cantidad: 0, Listado: [] }; },
  } as unknown as ChileCompraConnector;
  // runIngestDinero con conectorFake → 0 fetch a la fuente
}
```

### Anti-Patterns to Avoid
- **Tocar `reconciliar-contrato.ts` para "reforzar" el fail-closed jurídico:** ya está fail-closed; Phase 69 lo congela con guard + companion de comportamiento. Cualquier diff rompe la SC.
- **Renombrar `MERCADOPUBLICO_TICKET` a `CHILECOMPRA_TICKET`:** rompe el CLI, la probe y el test de redacción. Reusar el nombre existente.
- **Parsear/formatear el `monto` a número:** LOCKED VERBATIM string. Hoy `monto` es null (CR-02: el listado no trae monto fijo garantizado). NUNCA etiquetar un no-monto como "Monto".
- **`BaseConnector.run` (caché diaria):** el conector ya lo evita a propósito (comentario connector-chilecompra.ts:2). No introducirlo.
- **Correr el crawl LIVE en esta corrida del agente:** es operador-LOCAL (cuota/ticket). El agente entrega wire + tests fake + runbook.
- **Escribir el RPC público / encender el gate:** MONEY_PUBLIC_ENABLED nace OFF; el flip es Phase 73 (acto humano legal).

## Don't Hand-Roll

| Problema | No construir | Usar | Por qué |
|----------|--------------|------|---------|
| Crudo content-addressed a R2 | Cliente S3/SigV4 propio | `R2Store` (`@obs/ingest`) | aws4fetch SigV4 vía SubtleCrypto ya probado (T-01-05); `If-None-Match:*` atómico |
| Redacción del ticket | regex ad-hoc por sitio | `redactarTicket` (`query.ts`) | idempotente, null-safe, testeada (connector test 500-path) |
| Rate-limit 2-3s / robots / SSRF | delays manuales | `@obs/ingest` (Fetcher+HostRateLimiter+RobotsGuard) | el conector ya los cablea en el ORDEN LOCKED |
| Reconciliación RUT/nombre | matcher inline | `reconciliarContrato` (INTACTO) | corte CR-01 congelado por Phase 69; jurídica RUT-only |
| Señal de staleness | query ad-hoc | `packages/freshness` CATALOG + `evaluateCobertura` | patrón declarativo, SQL estática, no imprime dbUrl |
| Gate de presentación | leer env crudo | `moneyPublicEnabled()` | server-only, fail-closed (`=== "true"`), chokepoint único |

**Key insight:** el 95% de esta fase es threading de símbolos que ya existen y ya están probados. El riesgo no es construir mal — es **tocar lo que debe quedar intacto** (reconciliador, modelo, migración, nombre del ticket).

## Runtime State Inventory

Fase de wire + gating (no rename/refactor puro), pero con estado de runtime relevante:

| Categoría | Items | Acción requerida |
|-----------|-------|------------------|
| Stored data | Tablas `contrato`/`contratista`/`contratos_ingesta_estado` (0023) ya aplicadas al remoto (Phases 9-12 aplicaron 0018-0023). Hoy VACÍAS de datos ChileCompra. | El crawl LIVE (operador-LOCAL) las puebla; el agente no. |
| Live service config | ChileCompra API ticket = secreto de operador `MERCADOPUBLICO_TICKET` (env, no en git). Cuota 10k/día atada al ticket. | Runbook operador; el agente no consume cuota. |
| OS-registered state | Ningún cron registra el barrido por RUT (0023 nota: pg_cron = checkpoint operador, NO en el DDL; espejo 0021/0022). | Ninguna — el cron de dinero es deferred/operador. |
| Secrets/env vars | `MERCADOPUBLICO_TICKET`, `R2_ACCESS_KEY_ID`/`R2_SECRET_ACCESS_KEY`/`R2_ENDPOINT_URL`/`R2_BUCKET`, `SUPABASE_SERVICE_KEY`. Todos en `.env` (BOM UTF-8 → extraer esquivando el BOM). `MONEY_PUBLIC_ENABLED` NO seteado (=OFF). | El CLI construye R2Store de `.env R2_*` (espejo Phase 66 W-2). NUNCA cambiar `MONEY_PUBLIC_ENABLED`. |
| Build artifacts | `packages/dinero/dist/*` (compilado). Se regenera con `tsc -b`. | `pnpm --filter @obs/dinero build` tras el cambio. |

**Nada nuevo en OS-registered state ni en cron:** verificado — 0023 explícitamente deja el cron como checkpoint operador; no hay workflow `.yml` de dinero en `.github/workflows/` (solo leyes/agenda/lobby/probidad/fichas).

## Common Pitfalls

### Pitfall 1: Confundir "R2 BLOQUEADO" (degradación) con "R2 wire ausente"
**What goes wrong:** Interpretar la marca de degradación honesta (`ChileCompraBloqueadaError`) como si R2 estuviera "desactivado por flag" y buscar un flag inexistente.
**Why:** `ingest-run.ts:14` dice "R2 BLOQUEADO -> sin snapshot crudo, marca" — pero eso describe el flujo de degradación cuando la FUENTE bloquea, no un R2 wire deshabilitado. **De hecho `runIngestDinero` NO tiene R2 wire hoy.**
**How to avoid:** El trabajo = **añadir** el wire (no destrabar uno existente). Comparar `ingest-run.ts` de dinero (sin `r2Store` en opts) vs `ingest-run.ts` de tramitación (con `r2Store`).
**Warning signs:** buscar un `MONEY_R2_ENABLED` o similar — no existe.

### Pitfall 2: Envelope por-boletín vs por-RUT
**What goes wrong:** Copiar el envelope de tramitación (por-boletín, `tramXml`/`votXml`/`detalles`) sin adaptarlo a la forma de dinero.
**Why:** dinero itera por RUT y, dentro, por día (2 pasos: buscarProveedor una vez + ordenesDeCompra por día).
**How to avoid:** Envelope de dinero = `{ rut, buscarProveedor: <json paso1>, ordenes: { [dia]: <json paso2> } }`. Un solo envelope por RUT captura la corrida completa de ese RUT → replay reconstruye todos los días.

### Pitfall 3: Filtrar el ticket en la clave R2 o en logs del nuevo path
**What goes wrong:** El nuevo código del wire loguea una URL cruda o incluye el ticket en el envelope.
**Why:** El ticket viaja en la querystring del paso 1/2; el envelope debe guardar la RESPUESTA JSON (sin ticket), nunca la URL con `&ticket=`.
**How to avoid:** Guardar solo el JSON de respuesta en el envelope. Todo `log`/`errores.push` del nuevo path pasa por `redactarTicket`. Extender el test CR-01 al nuevo path.

### Pitfall 4: Romper la idempotencia versionada al añadir R2
**What goes wrong:** Poner el `putImmutable` con la fecha de HOY como parte de la clave content-addressed en una posición que rompe el 412-skip.
**Why:** tramitación usa `date=today` en la key pero el sha del contenido decide el 412. Si el contenido no cambió pero la fecha sí, la key cambia y nunca da 412.
**How to avoid:** Espejar exacto: `putImmutable(source, resource, today, sha, ext, bytes)`. El 412 se logra cuando el MISMO contenido produce la MISMA key completa. (Nota: tramitación acepta este comportamiento — un re-run el mismo día da 412; un re-run otro día re-escribe. Documentar que el skip es por-día, consistente con el patrón existente.)

### Pitfall 5: Tocar el reconciliador o el modelo "de paso"
**What goes wrong:** Un refactor "menor" en `reconciliar-contrato.ts` o cambiar `monto` a numeric.
**Why:** Phase 69 congela el corte CR-01 con guard estático + companion; `monto` VERBATIM es LOCKED.
**How to avoid:** SC de la fase = `git diff` VACÍO en `reconciliar-contrato.ts`, `model.ts`, `0023_dinero.sql`. Espejo de la SC de Phase 66.

### Pitfall 6: Aplicación de migración = falso positivo de CI
**What goes wrong:** Asumir que `build`/`typecheck` prueban que Postgres ejecutó el DDL.
**Why:** 0023 ya lo advierte. Pero esta fase **no añade migración** — si accidentalmente se añade una, aplicarla es checkpoint operador (pgTAP contra schema aplicado, `--db-url` esquivando BOM).
**How to avoid:** Preferir cero migraciones. Si la señal freshness necesitara una columna nueva, evitarla (usar `MAX(fecha_captura)` sobre columnas existentes).

## Code Examples

### Añadir la señal de staleness ChileCompra al CATALOG
```typescript
// Source: packages/freshness/src/catalog.ts:210-259 (patrón CATALOG existente)
// Staleness = ¿hace cuánto no ingirió ChileCompra? MAX(fecha_captura) de contrato.
// GATED: no hay workflow .yml de dinero todavía (cron = checkpoint operador). Umbral generoso
// (30d, como probidad) porque la fuente OCDS se actualiza mensualmente (día 20).
{
  fuente: "chilecompra",
  tabla: "contrato",              // o contratos_ingesta_estado.ingestado_hasta
  columna: "fecha_captura",
  umbralDias: 30,
  overrideEnv: "FRESHNESS_UMBRAL_CHILECOMPRA",
  workflowYml: "chilecompra-weekly.yml", // aún no existe → señal GH Actions ausente hasta el flip
}
```
**Decisión abierta para el planner (ver Open Questions):** ¿medir staleness sobre `contrato.fecha_captura` (hay contratos) o `contratos_ingesta_estado.ingestado_hasta` (se consultó, con o sin contratos)? La segunda distingue "consultado sin contratos" de "no consultado" — más honesta, espejo de `lobby-leylobby`. Recomendación: `contratos_ingesta_estado.ingestado_hasta` (no PII, señal de barrido).

### Modo `--from-r2` en el CLI de dinero
Ver Pattern 2. Espejo VERBATIM de `packages/tramitacion/src/ingest-cli.ts:221-265`, adaptando conector fake a `buscarProveedor`/`ordenesDeCompra`.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Dinero fetchea directo fuente→Supabase (sin R2) | Dos etapas fuente→R2→Supabase con `--from-r2` replay | Phase 70 (esta) | DEBT-01 fundido; re-ingesta sin molestar la fuente |
| "RUT-exacto, nunca por nombre" absoluto | Jurídica RUT-only; natural por nombre vía pipeline (finalidad del dato) | retrofit pre-v7 (reconciliar-contrato.ts) | El wire NO revierte esto; Phase 69 lo congela |
| Votos sin snapshot R2 | Votos con dos etapas (RUTA A) | Phase 66 | Molde a copiar para dinero |

**Deprecated/outdated:**
- El nombre `CHILECOMPRA_TICKET` (CONTEXT.md) → usar `MERCADOPUBLICO_TICKET` (real).
- `BaseConnector.run` (caché diaria) → evitado a propósito en el conector.

## SPIKE — Cuota ChileCompra + mecánica bulk OCDS

**Cuota (VERIFIED, ayuda oficial ChileCompra):** cada ticket tiene un límite **no modificable de 10.000 requests/día**; uso excesivo → suspensión temporal o bloqueo permanente. `[VERIFIED: ayuda.mercadopublico.cl/preguntasfrecuentes]`

**Costo por RUT (cálculo):** cada RUT = 1 request paso 1 (BuscarProveedor) + N requests paso 2 (1 por día del rango). Para un rango de ~4 años (backfill), N ≈ 1.460 días/RUT. Universo diputados ≈ 155 + senadores ≈ 50 = ~205 parlamentarios, PERO el cruce es por RUT de EMPRESAS ligadas, no por RUT de parlamentario directamente (el proveedor es una entidad). El universo real de RUTs a consultar depende del set de RUTs derivado del cruce — indeterminado hasta que RUT-01 (Phase 69, checkpoint operador) puble la maestra. **Cota superior grosera:** si se consultara 1 RUT × 1.460 días = 1.460 requests → ~6 RUTs completos/día bajo la cuota. Con ventanas más cortas (solo días con actividad) baja mucho. **Partición LOCAL multi-día resumible es obligatoria.**

**Estrategia de partición (recomendada):** `TareaRut[]` ya modela `{ rut, dias[] }`. El runbook parte el universo en lotes de RUTs × ventanas de día que sumen < 10k requests/día, con checkpoint de progreso (qué RUTs/días ya en R2 → hash-check salta los ya hechos). El `--from-r2` permite re-cargar a Supabase sin re-consultar. Idempotente/reanudable por diseño (CLAUDE.md: backfill masivo LOCAL, reanudable).

**Mecánica bulk OCDS (ALTERNATIVA, MEDIUM):** `datos-abiertos.chilecompra.cl/descargas/procesos-ocds` publica **JSON comprimido agrupado por mes, actualizado a diario** (y JSON/Excel/CSV por año o histórico completo; cada proceso = 1 línea JSONL). Órdenes de compra del mes anterior se actualizan mensualmente (≤ día 20). `[VERIFIED: datos-abiertos.chilecompra.cl]` `[CITED: data.open-contracting.org/en/publication/144]` El bulk **esquiva la cuota de 10k/día** por completo (es descarga de archivos, no API). **Tradeoff:** la forma OCDS difiere del REST que `parse-chilecompra.ts` ya parsea → requeriría un parser OCDS nuevo + filtrado local por RUT sobre archivos grandes. **Recomendación:** el bulk es la vía correcta para el snapshot histórico masivo, PERO su parser es fuera de alcance de esta fase (wire del REST existente). Documentar como opción de operador; el SPIKE lo caracteriza, no lo implementa.

**Fallback honesto:** el crawl LIVE (REST per-RUT bajo cuota) es la vía cableada por esta fase. El operador decide, en el runbook, si (a) corre el REST per-RUT particionado multi-día, o (b) descarga el bulk OCDS mensual y lo procesa aparte. La caracterización de la forma exacta de los archivos OCDS + el mapeo a `Contrato` es trabajo del operador/fase futura (el probe LIVE `live-chilecompra.probe.ts` valida solo la forma REST).

**Reachability in-session:** No se probó el endpoint LIVE en esta sesión (requiere ticket secreto de operador; `MERCADOPUBLICO_TICKET` no está disponible al agente y consumir cuota sería irrespetuoso). El probe existente (`live-chilecompra.probe.ts`) es la herramienta del operador para confirmar forma. Honestidad: la forma Zod de `model.ts` está derivada de docs; el operador la confirma con el probe antes del backfill.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | El envelope R2 de dinero debe ser por-RUT (no por-día ni por-orden) | Pattern 1/2 | Si por-orden, la key R2 explota en cardinalidad; por-RUT es el análogo a por-boletín. Bajo riesgo (sigue el patrón). |
| A2 | Poner el `rut` del proveedor (empresa) en la clave R2 es aceptable (es público, no PII de parlamentario) | Pattern 1 | Si el operador considera el RUT de proveedor persona-natural sensible en la clave, usar `CodigoEmpresa` o sha del RUT. Confirmar. |
| A3 | La señal freshness debe medir `contratos_ingesta_estado.ingestado_hasta` (no `contrato.fecha_captura`) | Code Examples | Elegir mal da una señal menos honesta (no distingue "consultado sin contratos"). Confirmar con operador. |
| A4 | El universo de RUTs a consultar viene de la maestra que RUT-01 (Phase 69) puebla — hoy vacía | SPIKE | Sin RUT-01 aplicado (checkpoint operador PENDIENTE), el crawl no tiene RUTs → la fase entrega el wire + tests fake, no datos. Consistente con "backfill LIVE = operador". |
| A5 | `MERCADOPUBLICO_TICKET` es el nombre correcto (no `CHILECOMPRA_TICKET`) | Summary | Usar el del CONTEXT rompería el CLI/probe/test existentes. Alta confianza (grep confirma el nombre real). |
| A6 | No se requiere migración nueva (0023 ya tiene las tablas; freshness usa columnas existentes) | Runtime Inventory | Si se añade columna, aplicar es checkpoint operador. Evitable. |

## Open Questions

1. **¿Sobre qué columna/tabla mide staleness la señal ChileCompra?**
   - Sabemos: `contrato.fecha_captura` (hay contratos) vs `contratos_ingesta_estado.ingestado_hasta` (se barrió).
   - Recomendación: `contratos_ingesta_estado.ingestado_hasta` (espejo de `lobby-leylobby`; distingue "consultado sin contratos"; no PII).

2. **¿El RUT del proveedor en la clave R2 es aceptable o se prefiere `CodigoEmpresa`/hash?**
   - Recomendación: RUT de empresa es público; si hay proveedores persona-natural, considerar `CodigoEmpresa` (ya resuelto en paso 1) como resource de la key. Confirmar con operador (A2).

3. **¿Un nuevo `run-dinero-masivo-cli.ts` o extender `ingest-cli.ts`?**
   - Phase 66 creó `run-votos-masivo-cli.ts` separado del `ingest-cli.ts`. Recomendación: seguir el precedente (CLI masivo operador separado del CLI acotado de demo).

4. **¿La señal freshness necesita el gate (solo visible tras el flip) o es señal operador siempre-visible?**
   - `pnpm freshness` es herramienta de operador (no ficha pública) → siempre visible es correcto (mide el barrido, no expone contratos). Bajo riesgo.

## Environment Availability

| Dependency | Required By | Available (agente) | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `@obs/ingest` R2Store | Etapa 1 R2 | ✓ | monorepo | — |
| `@obs/dinero` (conector/reconciliador/writer) | wire | ✓ | monorepo | — |
| `packages/freshness` | señal staleness | ✓ | monorepo | — |
| `MERCADOPUBLICO_TICKET` | crawl LIVE | ✗ (operador) | — | dry-run (InMemory), tests fake — NO consume cuota |
| R2 creds (`R2_*`) | put/get real | ✗ en tests (fake) / ✓ operador | — | FakeR2Store en tests (offline) |
| Supabase service key | upsert real | ✗ en tests / ✓ operador | — | InMemoryDineroWriter (dry-run) |
| Cuota ChileCompra 10k/día | backfill LIVE | ✗ (operador-LOCAL) | — | OCDS bulk (deferred) |

**Missing dependencies with fallback (todos offline-testables):**
- El wire completo, la reconciliación RUT-exacto con datos fake, el gate, la redacción y la señal freshness se prueban **sin red**: `FakeR2Store` (putImmutable/getObject), `InMemoryDineroWriter`, conector fake, maestra fake, `moneyPublicEnabled({...})` con env inyectado.

**Operator-LOCAL (fuera de la corrida del agente):**
- El crawl LIVE cuota-limitado (ticket + 10k/día + rate-limit 2-3s), multi-día reanudable, y el write remoto a Supabase. El agente entrega wire + tests fake + runbook (espejo de `66-BACKFILL-RUNBOOK.md`).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (monorepo) |
| Config file | `packages/dinero/vitest.config.ts` (existe; suite dinero 100 tests verde tras Phase 69) |
| Quick run command | `pnpm --filter @obs/dinero test` |
| Full suite command | `pnpm --filter @obs/dinero test && pnpm --filter ./app test && pnpm --filter @obs/freshness test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MONEY-01 / DEBT-01 | Etapa 1 (putImmutable) precede al upsert (por orden de captura) | unit | `pnpm --filter @obs/dinero test ingest-run` | ❌ Wave 0 (extender) |
| DEBT-01 | `--from-r2` replay puebla contratos con conector fake que LANZA si se toca (0 fetch) | unit | `pnpm --filter @obs/dinero test` | ❌ Wave 0 |
| DEBT-01 | put fallido (no-412) GATEA el upsert (registra error, no escribe) | unit | `pnpm --filter @obs/dinero test ingest-run` | ❌ Wave 0 |
| DEBT-01 | idempotencia: 2ª putImmutable = 412 → skip Etapa 2 | unit | `pnpm --filter @obs/dinero test` | ❌ Wave 0 |
| MONEY-01 | jurídica sin RUT-match → enlace null (fail-closed, nunca por nombre) | unit | `pnpm --filter @obs/dinero test reconciliar-contrato` | ✅ (existe + Phase 69 companion) |
| MONEY-01 | `monto` VERBATIM string preservado por reconciliador+writer | unit | `pnpm --filter @obs/dinero test writer` | ✅ (writer.test.ts) |
| CR-01 | ticket redactado `ticket=***` en el NUEVO path del wire | unit | `pnpm --filter @obs/dinero test connector-chilecompra` | ✅ molde (extender al wire) |
| Gate | `moneyPublicEnabled` OFF salvo literal "true" | unit | `pnpm --filter ./app test money-gate` | ✅ (money-gate.test.ts) |
| Gate | corte CR-01 name-match ≠ write-rut congelado | static+behavior | `pnpm --filter ./app test name-match-rut-guard` + `pnpm --filter @obs/dinero test name-match-rut-guard.behavior` | ✅ (Phase 69) |
| freshness | señal ChileCompra staleness (stale si null o > umbral) | unit | `pnpm --filter @obs/freshness test evaluate` | ✅ molde (extender CATALOG) |
| SC | `git diff` VACÍO en reconciliar-contrato/model/0023 | grep-gate | `git diff --exit-code -- packages/dinero/src/reconciliar-contrato.ts packages/dinero/src/model.ts supabase/migrations/0023_dinero.sql` | Wave 0 (script) |

### Sampling Rate
- **Per task commit:** `pnpm --filter @obs/dinero test` (suite dinero, ~100+ tests)
- **Per wave merge:** dinero + freshness + app (guards CR-01 + money-gate)
- **Phase gate:** las 3 suites verdes + grep-gate `git diff` vacío en el reconciliador/modelo/migración antes de `/gsd:verify-work`

### Wave 0 Gaps
- [ ] Extender `packages/dinero/src/ingest-run.test.ts` (o crear) — Test A (put antes de upsert), B (`--from-r2` replay 0-fetch), C (put fallido gatea), D (412 idempotente). Espejo de `run-camara-votos.test.ts` de Phase 66 con `FakeR2Store` + `OrderTrackingWriter`.
- [ ] Extender el CLI test (o crear `run-dinero-masivo-cli.test.ts`) — construcción de R2Store de `.env`, threading de `--from-r2`, log destino LOCAL/REMOTO.
- [ ] Extender `connector-chilecompra.test.ts` — CR-01 aplicado al nuevo path del envelope/wire (el ticket nunca en el envelope ni en logs).
- [ ] Extender `packages/freshness/src/evaluate.test.ts` / catalog — señal ChileCompra (stale/fresh).
- [ ] Script grep-gate `git diff --exit-code` sobre reconciliar-contrato/model/0023.

## Security Domain

### Applicable ASVS Categories (Level 1)

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Sin auth de usuario en el pipeline |
| V3 Session Management | no | N/A |
| V4 Access Control | yes | RLS 0023 (contratista deny-by-default; RPC solo confirmados); gate B `moneyPublicEnabled` OFF |
| V5 Input Validation | yes | Zod schemas (`BuscarProveedorResponseSchema`, `OrdenesResponseSchema`); drift → cuarentena, nunca fila silenciosa; `isRutValido` DV módulo-11 |
| V6 Cryptography | yes | R2 SigV4 vía aws4fetch/SubtleCrypto (NUNCA hand-roll — T-01-05); sha256 Web Crypto |
| V7 Errors & Logging | yes | `redactarTicket` — el `MERCADOPUBLICO_TICKET` NUNCA en logs/errores/envelope/consola |
| V9 Communications | yes | `assertAllowedUrl` (SSRF allowlist mercadopublico.cl); robots.txt; HTTPS |
| V12 Files/Resources | yes | R2 immutable append-only content-addressed; sin sobreescritura |

### Known Threat Patterns for {ChileCompra REST + R2 + Supabase gated}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Fuga del ticket en logs/errores/envelope | Information Disclosure | `redactarTicket` en todo path (incl. el nuevo wire); envelope guarda respuesta JSON, no URL con `&ticket=` |
| RUT de proveedor persona-natural en clave R2 pública | Information Disclosure | A2: considerar `CodigoEmpresa` como resource key; contratista tabla deny-by-default |
| Falso enlace parlamentario por nombre (defamación) | Tampering | Jurídica RUT-only fail-closed (INTACTO); Phase 69 guard congela name-match ≠ write-rut |
| Flip accidental del gate MONEY | Elevation of Privilege | `moneyPublicEnabled` fail-closed (`=== "true"`); no tocar `MONEY_PUBLIC_ENABLED`; SC grep-gate |
| Monto alterado por parseo numérico | Tampering | `monto` VERBATIM string (LOCKED); NO numeric |
| Derivado sin crudo reconstruible (R2 put falla, upsert procede) | Tampering/Integridad | Etapa-1-primero LOCKED: put fallido gatea el upsert (espejo tramitación) |
| SSRF vía URL de fuente manipulada | Tampering | `assertAllowedUrl` allowlist (mercadopublico.cl) — ya cableado |
| Abuso de cuota / bloqueo del ticket | DoS (auto-infligido) | rate-limit 2-3s LOCKED; partición multi-día bajo 10k/día; hash-check salta lo ya en R2 |

**Nota:** `security_enforcement: true`, ASVS L1, block_on high. Sin superficie de auth/endpoint nueva; el wire reduce la superficie de red en replay (`--from-r2` = 0 fetch).

## Sources

### Primary (HIGH confidence)
- Código del repo (grep/read verificado): `packages/dinero/src/{ingest-run,connector-chilecompra,reconciliar-contrato,model,writer,query,ingest-cli,live-chilecompra.probe}.ts`, `packages/tramitacion/src/{ingest-run,ingest-cli}.ts` (patrón a copiar), `packages/ingest/src/r2-store.ts`, `packages/freshness/src/catalog.ts`, `supabase/migrations/0023_dinero.sql`, `app/lib/money-gate.ts`
- `.planning/phases/66-*/66-01-SUMMARY.md` (patrón RUTA A del wire dos-etapas)
- `.planning/phases/69-*/69-01-SUMMARY.md` (corte CR-01 congelado name-match ≠ write-rut)
- `.env.example:87` (`MERCADOPUBLICO_TICKET`), `.planning/STATE.md`, `.planning/REQUIREMENTS.md` (MONEY-01/DEBT-01)
- `./CLAUDE.md` (ingesta dos-etapas LOCKED, backfill LOCAL, gate deny-by-default)

### Secondary (MEDIUM confidence — verificado con fuente oficial)
- [Ayuda Mercado Público — límite 10k/día](https://ayuda.mercadopublico.cl/preguntasfrecuentes/articulo/?id=KA-01967) — cuota no modificable, suspensión por abuso
- [ChileCompra API](https://www.chilecompra.cl/api/) — API de datos abiertos, órdenes de compra
- [Datos abiertos OCDS — descargas](https://datos-abiertos.chilecompra.cl/descargas/procesos-ocds) — JSONL comprimido por mes, actualizado a diario; JSON/Excel/CSV por año/histórico
- [OCP Data Registry — Chile DCCP API](https://data.open-contracting.org/en/publication/144) — cumplimiento OCDS

### Tertiary (LOW confidence — no verificado en sesión)
- Forma exacta de los archivos bulk OCDS y su mapeo a `Contrato` — NO probado en sesión; el operador lo caracteriza con descarga real (fuera de alcance de esta fase)
- Universo real de RUTs a consultar — depende de RUT-01 (Phase 69, checkpoint operador PENDIENTE)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — todo el código existe y está localizado; cero paquetes nuevos
- Architecture (wire dos-etapas): HIGH — patrón idéntico ya en producción (tramitación) y aplicado a votos (Phase 66)
- Reconciliación/gate/redacción: HIGH — intactos, testeados, congelados por Phase 69
- SPIKE cuota: MEDIUM — 10k/día confirmado por ayuda oficial; universo de RUTs indeterminado hasta RUT-01
- SPIKE bulk OCDS: MEDIUM — existencia y formato confirmados; mapeo exacto no probado en sesión
- Freshness: HIGH — patrón CATALOG declarativo existente, extensión trivial

**Research date:** 2026-07-14
**Valid until:** 2026-08-13 (30 días — código estable; verificar cuota/OCDS si ChileCompra cambia su API)

## RESEARCH COMPLETE

**Phase:** 70 - DINERO P5b — Wire dos-etapas ChileCompra por RUT (funde DEBT-01, SPIKE cuota)
**Confidence:** HIGH (wire + gate + freshness); MEDIUM (SPIKE cuota/OCDS externo)

### Key Findings
- **Es wiring puro:** todos los componentes existen. El trabajo = añadir Etapa 1 R2 a `runIngestDinero` (hoy NO la tiene) espejando `packages/tramitacion/src/ingest-run.ts:293-357` (patrón Phase 66 RUTA A), + `--from-r2`, + señal freshness.
- **"R2 BLOQUEADO" ≠ flag deshabilitado:** es la marca de degradación honesta cuando la FUENTE bloquea; el wire R2 simplemente no existe aún en dinero. Desbloquear = añadirlo.
- **Discrepancia de nombre:** usar `MERCADOPUBLICO_TICKET` (real, testeado), NO `CHILECOMPRA_TICKET` (CONTEXT).
- **NO tocar** `reconciliar-contrato.ts` / `model.ts` / `0023` — jurídica RUT-only fail-closed ya cumple; Phase 69 lo congela; `monto` VERBATIM string ya modelado (hoy null, CR-02). SC = `git diff` vacío.
- **SPIKE:** cuota 10k/día no modificable (verificado); crawl per-RUT particionado multi-día LOCAL reanudable (el agente entrega wire+tests fake+runbook, no consume cuota). OCDS bulk mensual esquiva la cuota pero su parser es fuera de alcance (deferred). Universo de RUTs depende de RUT-01 (checkpoint operador PENDIENTE).

### File Created
`.planning/phases/70-dinero-p5b-wire-dos-etapas-chilecompra-por-rut-funde-debt-01-spike-cuota/70-RESEARCH.md`

### Confidence Assessment
| Area | Level | Reason |
|------|-------|--------|
| Standard Stack | HIGH | Cero paquetes nuevos; todo localizado en el repo |
| Architecture | HIGH | Patrón idéntico en producción (tramitación) + votos (Phase 66) |
| Pitfalls | HIGH | Derivados de diffs concretos entre dinero y tramitación |
| SPIKE cuota/OCDS | MEDIUM | 10k/día confirmado oficial; forma OCDS y universo RUT no probados en sesión |

### Open Questions
- Columna/tabla de la señal freshness (`contratos_ingesta_estado.ingestado_hasta` recomendado)
- RUT de proveedor en la clave R2 vs `CodigoEmpresa` (A2)
- CLI masivo separado vs extender `ingest-cli.ts` (precedente Phase 66 = separado)

### Ready for Planning
Research completa. El planner puede crear PLAN.md: Wave 0 (tests fake del wire + freshness), wire de `runIngestDinero`, CLI `--from-r2`, señal CATALOG, runbook operador-LOCAL. Reconciliador/modelo/migración/ticket-name intactos.
