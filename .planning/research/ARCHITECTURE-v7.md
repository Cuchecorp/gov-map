# Architecture Research

**Domain:** Integración de v7.0 (voto individual + dimensión dinero + cierre técnico) a la arquitectura EXISTENTE de Observatorio del Congreso 360
**Researched:** 2026-07-13
**Confidence:** HIGH (verificado contra el código real del monorepo, no contra training data)

## Hallazgo rector (leer PRIMERO)

**v7.0 es mayormente WIRING + DATA + GATING, no construcción net-new.** El código de las dos features "nuevas" YA EXISTE en el repo desde v2.0 ("código completo, data pendiente"):

- **P3 (voto individual):** `packages/votos` (`run-camara-votos.ts`, reconciliación DIPID determinista fail-closed, `fuente_voter_id`), conector `opendata.camara.cl/getVotacion_Detalle` en `packages/tramitacion/src/connector-camara.ts`, modelo `Voto` (`packages/tramitacion/src/model.ts`) con `seleccion ∈ {si,no,abstencion,pareo,ausente}` + `parlamentario_id` FK nullable, migración `0019_voto_asistencia_y_ficha.sql` (CHECK `ausente`, índice parcial, RPCs `votos_de_parlamentario` INVOKER + `rebeldias_de_parlamentario` DEFINER), y superficies en `app/components/` (`votos-chart`, `voto-detalle`, `votos-por-parlamentario`, `voto-ficha-row`, `votacion-card`).
- **P5 (dinero):** `packages/dinero` COMPLETO (`connector-chilecompra.ts`, `connector-servel.ts`, `harvest-rut.ts`, `reconciliar-contrato.ts`/`reconciliar-aporte.ts`, `parse-*`, `writer-supabase*.ts`, `ingest-run.ts`/`ingest-run-servel.ts`), migraciones `0023_dinero.sql` + `0024_servel.sql`, gate `app/lib/money-gate.ts` (`moneyPublicEnabled`), superficies `contratos-de-parlamentario`, `aportes-por-contraparte`, `financiamiento-de-parlamentario`, `contratos-por-contraparte`.

**Consecuencia para el roadmapper:** las fases granulares deben redactarse como **caracterizar-endpoint → wire de dos etapas (R2) → correr a escala → verificar cobertura honesta → montar/gate superficie**, NO como "crear tabla/modelo/conector desde cero". El componente casi siempre es MODIFICADO (o simplemente CABLEADO/EJECUTADO), rara vez NUEVO. Donde algo es net-new, se marca explícito abajo.

## Standard Architecture

### System Overview (arquitectura existente en la que hay que integrarse)

```
┌──────────────────────────────────────────────────────────────────────┐
│  FUENTES (gov, WAF, rate-limit 2-3s LOCKED)                           │
│  opendata.camara.cl · wspublico Senado · api.mercadopublico.cl        │
│  · SERVEL (manual) · leylobby · InfoProbidad · BCN/LeyChile           │
├───────────────┬──────────────────────────────────────────────────────┤
│  ETAPA 1: FUENTE → R2 (crudo inmutable content-addressed) LOCKED      │
│  @obs/ingest BaseConnector.run(): cache→robots→rate→fetch→drift→R2    │
│  →snapshot.write(provenance)   ·  source_snapshot registra la ref     │
├───────────────┴──────────────────────────────────────────────────────┤
│  ETAPA 2: R2 → SUPABASE (derivado reconstruible, --from-r2 replay)    │
│  parse (zod gate) → reconciliar identidad (fail-closed) → writer upsert│
│  idempotente por clave natural + provenance inline por fila           │
├──────────────────────────────────────────────────────────────────────┤
│  IDENTIDAD (subsistema crítico)                                       │
│  maestra parlamentario · entidad_tercero (RUT) · matchDeterminista    │
│  → MiniMax adjudicación 0.90 → gate humano → golden set               │
│  RUT NUNCA cruza al LLM · EnlaceConfirmado branded (único mint site)  │
├──────────────────────────────────────────────────────────────────────┤
│  SUPABASE Postgres 15 (RLS deny-by-default, lockdown Camino A)        │
│  proyecto · votacion · voto(AGREGADO+INDIVIDUAL) · lobby · patrimonio │
│  entidad_tercero · contrato/contratista · aporte(servel)             │
│  cruce_senal (derivada, materializador security-definer, pg_cron)    │
│  RPCs PII-safe (INVOKER simple / DEFINER cuando toca PII)             │
├──────────────────────────────────────────────────────────────────────┤
│  FRONTEND Next.js 16 (server-only, service_role) → OpenNext → CF      │
│  gates: crucesPublicEnabled · moneyPublicEnabled · netPublicEnabled   │
│  (deny-by-default; flip = acción humana tras sign-off legal)          │
└──────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities (existentes; v7.0 los reusa)

| Component | Responsibility | Estado para v7.0 |
|-----------|----------------|------------------|
| `@obs/ingest` BaseConnector | Etapa 1 LOCKED: cache→robots→rate-limit→fetch→drift→R2→`snapshot.write`. Es el ÚNICO sitio con la política de red. | Reusar VERBATIM. Los runners que lo bypassean (votos, dinero) son la deuda de dos-etapas. |
| `@obs/votos` `run-camara-votos.ts` | Ingesta acotada del voto individual Cámara; DIPID→`EnlaceConfirmado`; escribe `voto`/`votacion`. | Existe. **No hace R2** (0 snapshot). MODIFICAR para dos etapas + correr a escala + paridad Senado. |
| `@obs/tramitacion` `connector-camara.ts` | `fetchVotacionDetalle` (opendata `getVotacion_Detalle`, verificado LIVE 2026-06-18). | Existe. **Re-caracterizar/re-validar el endpoint** (bloqueante histórico declarado de P3). |
| `@obs/tramitacion` `connector-senado.ts` | `wspublico votaciones.php` (voto por nombre, `seq:<n>`). | Existe. Paridad de voto individual Senado (por nombre → no_confirmado hasta reconciliar). |
| `@obs/identity` `matchDeterminista` / `EnlaceConfirmado` | Reconciliación fail-closed; RUT nunca al LLM; branded type único mint site. | Reusar VERBATIM (votos por DIPID, dinero por RUT-exacto). |
| `@obs/dinero` (todo) | Conectores ChileCompra/SERVEL, harvest-rut, reconciliación RUT-exacta, writers versionados. | Existe COMPLETO. Wire real + correr; SERVEL manual por elección. |
| `@obs/identity` `backfill-rut.ts` / `runBackfillRut` | RUT-01: DV-gate módulo-11 + provenance NOT NULL, writer a maestra remota. | Existe. **Correr contra la maestra REMOTA es checkpoint de operador** (prereq duro de P5). |
| `cruces.materializar_cruces()` (0039) | FULL REBUILD de `cruce_senal`; hoy señal LOBBY-PURA (`lobby_sector`). | MODIFICAR: extender token `lobby_sector_aporte` (RESERVADO explícitamente en 0039 para Phase 40, gated por RUT-01). |
| `app/lib/money-gate.ts` `moneyPublicEnabled` | Candado B de presentación MONEY (fail-closed, solo `"true"`). | Existe. Wire de las superficies MONEY a través de este chokepoint (sin leer el env crudo). |

## Integración por feature: nuevo vs modificado + orden de build

### P3 — Voto individual (opendata.camara.cl)

**Dependencia raíz:** el endpoint `getVotacion_Detalle` es el "bloqueante histórico" declarado → **validar/caracterizar PRIMERO** antes de cablear nada. El conector ya lo llama pero el gate del milestone exige re-confirmar la forma viva (WAF, `Votos=null` en `doGet.asmx` es lo que empuja a opendata).

| Componente | Nuevo/Modificado | Punto de integración |
|-----------|------------------|----------------------|
| Caracterización del endpoint opendata | **Ejecución** (probe LIVE) | `connector-camara.ts::fetchVotacionDetalle` + `parse-camara-votacion.ts` (parsea AMBAS formas). Gate: forma viva == la parseada. |
| Dos etapas fuente→R2→Supabase para votos | **MODIFICADO** (net-new wiring) | `run-camara-votos.ts` hoy NO escribe R2 (0 snapshots). Integrar la Etapa 1 del BaseConnector (o `SnapshotWriter`) antes del parse; habilitar `--from-r2` replay como en `tramitacion/ingest-cli.ts`. Esta es la deuda de dos-etapas Y el requisito de P3 a la vez. |
| Modelo `voto` individual | **YA EXISTE** | `model.ts::Voto` + `0019`. `fuente_voter_id` = DIPID (Cámara) / `seq:<n>` (Senado). Clave natural `(votacion_id, fuente_voter_id)`. NO tocar salvo migración aditiva si aparece un campo nuevo de provenance. |
| Reconciliación DIPID → maestra | **YA EXISTE** | `reconciliar-camara.ts::reconciliarVotosCamara` (único mint de `EnlaceConfirmado` para votos, determinista por DIPID, fail-closed → `no_confirmado`). El diputado de opendata reconcilia por **DIPID**, NO por nombre. |
| Paridad Senado | **MODIFICADO** (ejecución) | `connector-senado.ts` + `reconciliar-senado.ts`: Senado sólo trae nombre → `fuente_voter_id = seq:<n>`, vínculo por nombre normalizado → `probable/no_confirmado` (nunca fabrica FK). Correr a escala tras Cámara. |
| RPCs de superficie | **YA EXISTE** | `votos_de_parlamentario` (INVOKER) + `rebeldias_de_parlamentario` (DEFINER, lee `partido` internamente, emite sólo derivado). Sólo filas `confirmado`. |
| Superficies análisis voto×parlamentario×tema | **MODIFICADO** (montaje + gate BrowserOS) | Componentes existen (`votos-chart`, `voto-detalle`, `votos-por-parlamentario`). v7.0 añade el corte por tema/sesión + leyenda anti-insinuación + gate de comprensión BrowserOS. Descriptivo, nunca causal. |

**Orden de build P3 (respeta dependencias reales):**
1. **Validar/caracterizar** `getVotacion_Detalle` LIVE (bloqueante histórico) → confirmar `parse-camara-votacion` contra la forma viva.
2. **Wire dos etapas** en `run-camara-votos`: fetch→R2 (Etapa 1) + `--from-r2` replay (Etapa 2). Resuelve source_snapshot Y el requisito P3.
3. **Correr a escala** Cámara (acotado por `--boletines`/`limite`, WAF), poblar `voto` individual, verificar reconciliación DIPID confirmada vs no_confirmado (cobertura honesta).
4. **Paridad Senado** (por nombre, no_confirmado hasta reconciliar).
5. **Superficies** análisis por tema/sesión + leyenda + gate BrowserOS. RPCs ya existen.

### P5 — Dimensión dinero (SERVEL + ChileCompra por RUT)

**Dependencia raíz DURA: RUT-01 bloquea TODO lo demás de P5.** Es DATO, no flag: la maestra `entidad_tercero`/`parlamentario` debe tener RUT físicamente antes de que cualquier cruce RUT-exacto rinda algo distinto de `null`. `reconciliar-contrato.ts` fija el enlace SÓLO por RUT-exacto; sin RUT interno todo enlace es `null` (fail-closed, verificado en `model.ts` y `harvest-rut.ts`).

| Componente | Nuevo/Modificado | Punto de integración |
|-----------|------------------|----------------------|
| RUT-01 backfill a la maestra remota | **EJECUCIÓN** (checkpoint operador) | `harvest-rut.ts::runHarvestRut` → `@obs/identity::runBackfillRut` (DV-gate + provenance NOT NULL). El writer Supabase REAL contra la maestra remota es acción de operador (write DB remoto sólo vía db push --db-url). CR-01: RUT por nombre NUNCA escribe (canal separado de revisión humana). **Prereq duro de todo P5.** |
| Tablas `contrato`/`contratista` (ChileCompra) | **YA EXISTE** | `0023_dinero.sql` + `model.ts::Contrato/Contratista` (keyed `(fuenteId, fechaCorte)`, versionado, monto VERBATIM string). |
| Tabla `aporte` (SERVEL) | **YA EXISTE** | `0024_servel.sql` + `model-servel.ts`. SERVEL = conector artesanal frágil (no REST, manual por elección) → correr LOCAL, no cron. |
| Conectores ChileCompra/SERVEL | **YA EXISTE** | `connector-chilecompra.ts` (2 pasos: BuscarProveedor→ordenesdecompra) + `connector-servel.ts`. Barrido SERIAL por RUT respetando 2-3s. Ticket ChileCompra = secreto operador. |
| Dos etapas fuente→R2 para dinero | **MODIFICADO** (deuda) | `ingest-run.ts` menciona "R2 BLOQUEADO → sin snapshot crudo, marca" — el snapshot R2 no está cableado. Añadir Etapa 1 (source_snapshot) igual que votos. |
| Reconciliación RUT-exacta contrato/aporte→parlamentario | **YA EXISTE** | `reconciliar-contrato.ts` / `reconciliar-aporte.ts` (RUT-exacto, `EnlaceEntidadConfirmado` branded). Rinde `null` hasta que RUT-01 puebla la maestra. |
| Materializador `cruce_senal` extendido a dinero | **MODIFICADO** | `cruces.materializar_cruces()` (0039) reserva EXPLÍCITAMENTE el token `lobby_sector_aporte` para Phase 40 (gated RUT-01). Migración aditiva: nuevo CHECK del token + rama del insert que suma la señal de aporte por sector vía RUT de empresas ligadas. FULL REBUILD transaccional (patrón existente). Conteos factuales, NUNCA score. |
| Gate `MONEY_PUBLIC_ENABLED` | **YA EXISTE** | `money-gate.ts::moneyPublicEnabled` (fail-closed). Wire de superficies MONEY por este chokepoint. Flip = sign-off legal humano (Ley 21.719), NUNCA un agente. |
| Superficies dinero | **YA EXISTE (montaje)** | `contratos-de-parlamentario`, `aportes-por-contraparte`, `financiamiento-de-parlamentario`, `contratos-por-contraparte`. Detrás de `moneyPublicEnabled`. |

**Orden de build P5 (RUT-01 gatea todo):**
1. **RUT-01 backfill** a la maestra remota (checkpoint operador). Sin esto, todo cruce dinero rinde `null` — construir superficies antes sería vacío honesto.
2. **Wire dos etapas** ChileCompra (source_snapshot R2 + replay) → correr por RUT (ticket operador).
3. **SERVEL** LOCAL (manual, frágil, por elección) → poblar `aporte`.
4. **Extender materializador** `cruce_senal` con `lobby_sector_aporte` (migración aditiva, gated).
5. **Montar superficies** MONEY detrás de `moneyPublicEnabled` (OFF) + leyenda anti-insinuación + gate BrowserOS.
6. **Gate legal** (sign-off humano) autoriza el flip. El agente construye hasta el gate, NO flipea.

### Deuda técnica — dónde encaja sin bloquear P3/P5

| Ítem | Encaje | Notas |
|------|--------|-------|
| `source_snapshot` en conectores restantes (dos etapas completas) | **SE FUNDE con P3/P5** | Votos y dinero son justamente los conectores sin R2. Hacer el wire de dos etapas AHÍ mata deuda + requisito a la vez. NO es una fase aparte. |
| `--from-r2` replay | **SE FUNDE con P3/P5** | Ya existe en `tramitacion/ingest-cli` y `lobby/ingest-cli`; replicar el patrón en votos/dinero como parte de su wire. |
| Cursor leylobby | **Independiente, paralelizable** | No toca P3/P5; fase de hardening propia, cualquier momento. |
| `CLOUDFLARE_API_TOKEN` en CI | **Independiente** | Crons verdes sin fallback local; no bloquea nada de datos. Fase de hardening. |
| Rotación round-robin cron `leyes-weekly` (corpus 3.657) | **Independiente** | Dilución de frescura del corpus v6.1; no toca votos/dinero. Fase de hardening. |
| Typography island `.net-*` fuera de contrato | **Independiente (frontend)** | Cosmético; agrupar con montaje de superficies o hardening. |
| Rotar DB password (B26) | **Acción operador** | Fuera de código; checkpoint. |

## Architectural Patterns (LOCKED — respetar en cada fase)

### Pattern 1: Dos etapas fuente→R2→Supabase (LOCKED)

**What:** Etapa 1 persiste el crudo inmutable content-addressed en R2 (`fuente/recurso/fecha/sha256.ext`, `If-None-Match: *`, 412=idempotente). Etapa 2 lee de R2 (NUNCA de la fuente) para parsear/cargar. Re-ingesta a Supabase = siempre desde R2.
**When:** TODO conector nuevo o cableado en v7.0 (votos, dinero, servel).
**Trade-offs:** más I/O de escritura, pero R2 = verdad cruda versionada y Supabase = derivado reconstruible; nunca se re-molesta la fuente en errores/re-embed.

```typescript
// El BaseConnector.run() ya materializa la Etapa 1:
// cache.hasToday → robots → hostThrottle.reserve → rateLimiter.wait →
// fetcher.get → validateShape → fingerprint → drift.check → sha256 →
// r2.putImmutable → snapshot.write(provenance)
// Los runners de votos/dinero deben ENRUTAR por aquí, no re-fetchear directo.
```

### Pattern 2: Reconciliación fail-closed con branded `EnlaceConfirmado`

**What:** El FK a la maestra (`parlamentario_id`, `entidad_id`) SÓLO se puebla desde un `EnlaceConfirmado`/`EnlaceEntidadConfirmado` branded que sólo `confirmar()` puede mintear. Un string crudo no compila. Sin match → `null` + `estado_vinculo='no_confirmado'`.
**When:** Voto (DIPID), autor, contrato/aporte (RUT-exacto).
**Trade-offs:** imposibilita afirmación falsa por match silencioso (riesgo existencial #1). RUT nunca cruza al LLM.

### Pattern 3: Doble candado deny-by-default (RLS + gate de presentación)

**What:** Candado A = RLS deny-by-default en la tabla sensible + RPC sin grant a anon. Candado B = flag `*_PUBLIC_ENABLED` server-only fail-closed (`=== "true"`). Nada público hasta el flip humano.
**When:** cruce_senal (dinero), superficies MONEY.
**Trade-offs:** construir "a oscuras" (vacío honesto hasta el gate), pero defensa jurídica (Ley 21.719) y el agente jamás enciende lo sensible.

### Pattern 4: Materializador FULL REBUILD security-definer (cruce_senal)

**What:** `delete from cruce_senal` + re-insert transaccional (NO on-conflict), invocado por pg_cron con offset. Señal = conteo factual + evidencia jsonb con enlaces de fuente, NUNCA score de correlación.
**When:** extender a `lobby_sector_aporte`.
**Trade-offs:** el rebuild garantiza conteo/evidencia coherentes con el estado actual; más costo por corrida pero correcto.

## Data Flow

### Voto individual (P3)

```
opendata.camara.cl getVotacion_Detalle
   → [Etapa 1] fetch (rate-limit 2-3s) → R2 crudo (sha256)
   → [Etapa 2] parse-camara-votacion (zod) → reconciliarVotosCamara (DIPID)
   → EnlaceConfirmado | null → writer upsert voto(votacion_id, fuente_voter_id)
   → RPC votos_de_parlamentario / rebeldias_de_parlamentario (sólo confirmado)
   → superficie ficha (leyenda anti-causal, gate BrowserOS)
```

### Dinero (P5, gated)

```
RUT-01: harvest-rut → runBackfillRut (DV-gate) → maestra remota  [PRE-REQ DURO]
   ↓ (sin esto, todo lo de abajo rinde null)
api.mercadopublico.cl / SERVEL
   → [Etapa 1] fetch serial por RUT → R2 crudo
   → [Etapa 2] parse (zod) → reconciliar-contrato/aporte (RUT-exacto)
   → contrato/contratista/aporte (versionado) + entidad_tercero FK
   → cruces.materializar_cruces() (lobby_sector_aporte) [pg_cron, FULL REBUILD]
   → superficie MONEY detrás de moneyPublicEnabled (OFF) → flip = sign-off humano
```

## Anti-Patterns (específicos de esta integración)

### Anti-Pattern 1: Tratar P3/P5 como construcción net-new

**What people do:** planificar "crear tabla `voto_individual`", "escribir conector ChileCompra", "modelar `aporte_electoral`".
**Why it's wrong:** todo eso YA EXISTE (0019/0023/0024, `@obs/votos`, `@obs/dinero`). Re-crearlo forkea el modelo, duplica writers y rompe idempotencia por clave natural.
**Do this instead:** fases de **caracterizar → cablear dos etapas → correr → verificar cobertura honesta → montar/gate**. Marcar cada componente como YA-EXISTE / MODIFICADO / EJECUCIÓN.

### Anti-Pattern 2: Construir superficies MONEY/cruces-dinero antes de RUT-01

**What people do:** montar `financiamiento-de-parlamentario` y extender el materializador antes del backfill de RUT.
**Why it's wrong:** sin RUT en la maestra, `reconciliar-contrato`/`aporte` rinde `null` → superficie vacía y materializador sin filas. RUT-01 es DATO bloqueante, no un flag.
**Do this instead:** RUT-01 backfill (checkpoint operador) SIEMPRE primero en la secuencia P5.

### Anti-Pattern 3: Bypassear el BaseConnector para el fetch

**What people do:** `fetch` directo en el runner de votos/dinero (como hoy: 0 snapshots en `run-camara-votos`).
**Why it's wrong:** salta la política LOCKED (rate-limit 2-3s, robots, SSRF allowlist, drift, R2) → viola dos-etapas y arriesga bloqueo del WAF.
**Do this instead:** enrutar por `BaseConnector.run()` / `SnapshotWriter`; la política vive UNA vez en `@obs/ingest`.

### Anti-Pattern 4: Reconciliar voto de Cámara por nombre

**What people do:** matchear el diputado de opendata por nombre normalizado.
**Why it's wrong:** Cámara trae DIPID oficial → el match DEBE ser por DIPID (determinista, no colisionante). El nombre es el puente SÓLO para el Senado (que no trae ID), y ahí queda `probable/no_confirmado`.
**Do this instead:** `reconciliarVotosCamara` por DIPID; Senado por nombre con `seq:<n>` y estado degradado.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| opendata.camara.cl | `getVotacion_Detalle?prmVotacionId` (ns tempuri.org), XML, dos etapas | Verificado LIVE 2026-06-18; RE-validar (bloqueante histórico). `retornarVotacionDetalle` NO existe (500). |
| wspublico Senado | `votaciones.php?boletin`, XML | Voto por nombre → `seq:<n>`, `probable/no_confirmado`. |
| api.mercadopublico.cl | BuscarProveedor→ordenesdecompra, 2 pasos, ticket operador | Serial por RUT, 2-3s; monto VERBATIM string (hoy null si la fuente no da total). |
| SERVEL | Artesanal, manual por elección (no REST) | Correr LOCAL, no cron. Frágil. |
| Cloudflare R2 | S3-compat, `If-None-Match: *` | Etapa 1 de dos-etapas; 412 = ya existía = éxito. |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| `@obs/votos` ↔ `@obs/ingest` | reusa BaseConnector (hoy lo bypassa el fetch → deuda) | Wire de Etapa 1. |
| `@obs/votos`/`@obs/dinero` ↔ `@obs/identity` | `matchDeterminista` + branded `EnlaceConfirmado` | Único mint site; RUT nunca al LLM. |
| `@obs/dinero` ↔ maestra remota (RUT-01) | `runBackfillRut` vía db-url (checkpoint operador) | Prereq duro; write remoto = acción humana. |
| materializador ↔ cruce_senal | `security definer` FULL REBUILD, pg_cron | Extender token `lobby_sector_aporte` (aditivo). |
| Frontend ↔ gates | `moneyPublicEnabled`/`crucesPublicEnabled` server-only | Flip = sign-off legal humano, nunca agente. |

## Sources

- Código del monorepo (verificación directa, HIGH): `packages/votos/src/run-camara-votos.ts`, `packages/tramitacion/src/{model,connector-camara,connector-senado}.ts`, `packages/dinero/src/{model,ingest-run,harvest-rut}.ts`, `packages/cruces/src/model.ts`, `packages/ingest/src/base-connector.ts`, `packages/identity/src/{backfill-rut,harvest-rut}`, `app/lib/money-gate.ts`, `app/components/*`
- Migraciones aplicadas (HIGH): `supabase/migrations/{0019_voto_asistencia_y_ficha,0023_dinero,0024_servel,0039_cruce_senal}.sql`
- `.planning/PROJECT.md` — Current Milestone v7.0, gates, prereq RUT-01 + Ley 21.719 (HIGH)
- `CLAUDE.md` — dos etapas LOCKED, pipeline identidad fail-closed, deny-by-default (HIGH)

---
*Architecture research for: integración v7.0 (voto individual + dinero + cierre técnico) a Observatorio del Congreso 360*
*Researched: 2026-07-13*
