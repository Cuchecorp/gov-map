# Roadmap: Observatorio del Congreso 360

**Core Value:** La ciudadanía puede responder, sobre cualquier proyecto de ley o parlamentario, "qué pasó, cuándo y según qué fuente" — cada dato lleva fuente, fecha y enlace original, sin afirmar intención ni causalidad.

## Milestones

- ✅ **v1.0 MVP — Proyectos de Ley + Fundaciones de Identidad** — Phases 1-7 (shipped 2026-06-18)
- ✅ **v2.0 — Parlamentarios 360** — Phases 8-18 (voto individual, lobby/patrimonio, dinero, grafo de influencia) — shipped (gates F13/F17 = sign-off humano)
- ✅ **v3.0 — Cobertura de datos** — Phases 23-32 (lobby con identidad adjudicada + fuente camara.cl, patrimonio LIVE, votaciones masivas, provenance, RUT operador, gates OPS/LEGAL) — shipped
- ✅ **v4.0 — De datos a cruces verificables** — Phases 33-43 (desbloqueo CI, ingesta lobby+probidad programada, entity-resolution de terceros, capa de cruces parlamentario↔sector deny-by-default, superficies de ficha gated, gate legal F13/F17/cruces, lockdown API, deuda técnica; RUT+ChileCompra/SERVEL diferido) — cruces ENCENDIDOS; **lockdown API resuelto vía Camino A** (sitio en service_role, anon muerta, legacy revocado, web_reader dropeado — cutover aplicado a PROD 2026-06-26)
- ✅ **v5.0 — De datos a comprensión (legibilidad + análisis)** — Phases 44-55 (acordeones/navegación, gráficos descriptivos patrimonio/votos/ausencias, cruces nuevos, rediseño cognitivo 3 capas) — shipped 2026-07-08 (`74e3ad0f`); **F48 (autoría) DIFERIDA a milestone de ingesta** por gap de datos (autores 0/136). Audit `tech_debt`: milestones/v5.0-MILESTONE-AUDIT.md
- ✅ **v6.0 — Confiabilidad y comprensión** — Phases 56-61 (ingesta E2E confiable, autores F48, ícono, comprensión BrowserOS) — shipped 2026-07-09
- ✅ **v6.1 — Entendible y completo** — Phases 62-63 (/red ego-network radial + búsqueda corpus completo declarado) — shipped 2026-07-11
- 🚧 **v7.0 — Votos, dinero y cierre técnico** — Phases 64-75 (voto individual P3 → dimensión dinero P5 prereq RUT-01 → cierre de deuda técnica; deny-by-default, gates pre-aprobados) — en curso, arrancado 2026-07-13

## 🚧 v7.0 — Votos, dinero y cierre técnico (En curso)

**Milestone Goal:** Completar los dos frentes de datos que aún faltaban del producto —cómo vota individualmente cada parlamentario, y el dinero que lo rodea (financiamiento electoral + contratos del Estado)— y cerrar la deuda técnica de ingesta acumulada; en fases MUY GRANULARES, deny-by-default, con trazabilidad a la fuente y sin afirmar causalidad.

**Mode:** yolo · **Granularity:** fine (operador: MUY FINA — muchas fases pequeñas y atómicas) · **Numbering:** continúa desde v6.1 (Phase 63 fue la última) → v7.0 arranca en **Phase 64**.

**HALLAZGO RECTOR (research HIGH, convergente 4/4):** el código de AMBOS frentes YA EXISTE desde v2.0 — `packages/votos/` y `packages/dinero/` code-complete, data-pending/gated. v7.0 NO es construcción net-new: es **WIRING dos-etapas + validación de endpoint LIVE + BACKFILL de datos + GATING deny-by-default**. Cada fase se redacta como EJECUCIÓN / WIRING / COBERTURA / GATING, marcando componentes YA-EXISTE / MODIFICADO / EJECUCIÓN. Se RECHAZA cualquier fase redactada como "crear tabla/conector/modelo".

### Coverage

- v7.0 requirements: 17 (VOTO×5, RUT×1, MONEY×5, DEBT×6)
- Mapped to phases (64-75): 17/17 ✓
- Orphaned: 0 · Duplicates: 0

### Build order (dependencias duras de la investigación)

```
P3 VOTO:  64 (validar opendata LIVE, SPIKE) ──► 65 (golden set DIPID) ──► 66 (wire 2-etapas + backfill Cámara) ──► 67 (paridad Senado) ──► 68 (superficies voto + linter + cobertura + BrowserOS)
                                                          │
P5 DINERO: 69 (RUT-01 backfill, CHECKPOINT OPERADOR, bloqueante DURO de todo P5) ──► 70 (wire 2-etapas ChileCompra, SPIKE cuota) ──► 71 (SERVEL LOCAL) ──► 72 (materializador lobby_sector_aporte) ──► 73 (superficies MONEY gated OFF + linter + GATE LEGAL humano)
DEUDA (paralelizable, no bloquea P3/P5): 74 (cursor leylobby + CF token CI + round-robin cron) · 75 (typography .net-* + rotar DB password operador)
```

`source_snapshot`/`--from-r2` (DEBT-01) NO son fases aparte: se FUNDEN con el wire de dos-etapas de votos (66) y dinero (70/71) — votos y dinero son precisamente los conectores hoy sin snapshot R2.

### Phases

- [ ] **Phase 64: VOTO P3a — Validar/caracterizar `opendata.camara.cl` LIVE (SPIKE)** — probe LIVE del endpoint bloqueante histórico; fixtures crudos a R2; mapeo `Valor→Selección` fijado con test; códigos Abstención/Pareo confirmados
- [ ] **Phase 65: VOTO P3b — Golden set DIPID→maestra (gate fail-closed pre-backfill)** — verificar el mapeo DIPID↔id_maestra para los ~155 diputados vigentes ANTES de escalar; un DIPID reciclado es la trampa
- [ ] **Phase 66: VOTO P3c — Wire dos-etapas Cámara + backfill a escala (funde DEBT-01)** — `run-camara-votos` enruta por BaseConnector (fuente→R2→Supabase, `--from-r2`); `voto` individual poblado a escala; cobertura confirmado/no_confirmado
- [ ] **Phase 67: VOTO P3d — Paridad Senado (voto individual por nombre)** — `votaciones.php` a escala; `seq:<n>`, `probable/no_confirmado`, nunca fabrica FK; dos-etapas R2
- [ ] **Phase 68: VOTO P3e — Superficies de voto + linter anti-insinuación + cobertura + gate BrowserOS** — historial en ficha, asistencia con caveat, desglose nominal, leyenda "cómo leer esto", cobertura N/M declarada; linter cubre voto
- [ ] **Phase 69: DINERO P5a — RUT-01 backfill a la maestra (CHECKPOINT OPERADOR, bloqueante duro)** — `runBackfillRut` DV-gate módulo-11 contra la maestra remota; cobertura N/M de RUT DV-válido MEDIDA y DECLARADA; name-match nunca escribe `rut`
- [ ] **Phase 70: DINERO P5b — Wire dos-etapas ChileCompra por RUT (funde DEBT-01, SPIKE cuota)** — `connector-chilecompra` fuente→R2→Supabase; ticket 10k/día operador; contratos por RUT exacto; freshness extendido
- [ ] **Phase 71: DINERO P5c — SERVEL LOCAL (.xlsx artesanal, funde DEBT-01)** — `connector-servel` corre LOCAL (frágil, por elección); aportes/gastos por RUT; fecha de corte/elección declarada; dos-etapas R2
- [ ] **Phase 72: DINERO P5d — Extender materializador `cruce_senal` con `lobby_sector_aporte`** — token ya RESERVADO en 0039; migración aditiva, FULL REBUILD; conteos factuales, nunca score
- [ ] **Phase 73: DINERO P5e — Superficies MONEY gated OFF + linter + GATE LEGAL humano** — superficies detrás de `moneyPublicEnabled` OFF, provenance inline, jurídica solo RUT-exacto, BrowserOS; flip = sign-off 21.719 (acto humano, el agente NO flipea)
- [ ] **Phase 74: DEUDA — Cursor leylobby + `CLOUDFLARE_API_TOKEN` CI + round-robin cron leyes-weekly** — DEBT-02/03/04: cursor incremental, crons verdes sin fallback, dilución de frescura del corpus 3.657 resuelta
- [ ] **Phase 75: DEUDA — Typography island `.net-*` + rotar DB password (operador)** — DEBT-05/06: `.net-*` al design system; rotación de credencial B26 (acción operador, documentada)

## Phase Details

### Phase 64: VOTO P3a — Validar/caracterizar `opendata.camara.cl` LIVE (SPIKE)

**Goal**: Confirmar la forma VIVA del endpoint bloqueante histórico de P3 antes de cablear nada de producción — la semántica del voto no puede quedar asumida.
**Depends on**: Nothing (primera de v7.0; independiente de v6.1)
**Requirements**: VOTO-05 (enabler)
**Componentes**: EJECUCIÓN (probe LIVE) · `connector-camara.ts::fetchVotacionDetalle` y `parse-camara-votacion.ts` YA-EXISTEN
**Success Criteria** (what must be TRUE):

  1. Existe una respuesta LIVE cruda de `getVotacion_Detalle` guardada en R2 como fixture autoritativo (dos namespaces caracterizados)
  2. Un test fija el mapeo `OpcionVoto Valor → Selección` (1→sí, 0→no) y verifica explícitamente Abstención/Pareo/Dispensado contra la fuente — no asumido
  3. El cross-check de totales cuadra: la suma voto-a-voto == `TotalSi/TotalNo/…` del boletín; un mismatch falla RUIDOSO (gate zod)
  4. Si el endpoint NO está UP a escala, queda registrado el fallback honesto (agregados `getVotaciones_Boletin`) y un re-plan del bloque VOTO

**Plans**: 2 plans

- [x] 64-01-PLAN.md — Fijar mapeo offline: abstención por código (2), pareo desde bloque <Pareos> (no código 3), cross-check ruidoso Σ==totales (SC#2/SC#3)
- [x] 64-02-PLAN.md — Probe LIVE gated (VOTOS_LIVE=1): persist crudo a R2, hunt Pareo/Dispensado, cross-check LIVE, fallback documentado (SC#1/SC#4)

**Research**: yes (SPIKE — opendata UP-a-escala-hoy es MEDIUM; códigos Abstención/Pareo nunca confirmados live)

### Phase 65: VOTO P3b — Golden set DIPID→maestra (gate fail-closed pre-backfill)

**Goal**: Garantizar que el cruce DIPID→id_maestra es correcto para los diputados vigentes ANTES de escalar — un voto mal atribuido es difamatorio y verificable como falso.
**Depends on**: Phase 64
**Requirements**: VOTO-03
**Componentes**: EJECUCIÓN (golden set) · `reconciliar-camara.ts::reconciliarVotosCamara` y `EnlaceConfirmado` branded YA-EXISTEN
**Success Criteria** (what must be TRUE):

  1. Existe un golden set DIPID→id_maestra validado para los ~155 diputados vigentes (los DIPID se reciclan entre legislaturas — la trampa está cubierta)
  2. El cruce de voto es DIPID-determinista PUNTO: no aparece name-match ni `normalizarNombre` ni LLM en el camino de votos (verificable en el diff)
  3. Un DIPID fuera de la maestra queda `no_confirmado` con `parlamentario_id=null` — jamás se atribuye a la persona equivocada
  4. El FK del voto sigue siendo `EnlaceConfirmado | null` branded (un string crudo no compila)

**Plans**: 1 plan

- [x] 65-01-PLAN.md — golden set DIPID→id_maestra derivado+validado del seed + gate fail-closed (invariantes, fail-closed contra reconciliador real, grep-gate anti-name-match, aserción branded-FK)

### Phase 66: VOTO P3c — Wire dos-etapas Cámara + backfill a escala (funde DEBT-01)

**Goal**: Poblar el voto individual de Cámara a escala por la ingesta de dos etapas fuente→R2→Supabase — el mismo wire mata la deuda de dos-etapas Y cumple el requisito de P3.
**Depends on**: Phase 65
**Requirements**: VOTO-01, DEBT-01 (parcial — votos)
**Componentes**: MODIFICADO (wiring net-new: `run-camara-votos` enruta por BaseConnector; hoy 0 snapshots R2) · modelo `voto` (0019) YA-EXISTE
**Success Criteria** (what must be TRUE):

  1. La ingesta de votos de Cámara escribe PRIMERO crudo content-addressed a R2 y LUEGO R2→Supabase, re-ejecutables por separado (`--from-r2` replay)
  2. El ciudadano ve cómo votó individualmente cada diputado en una votación de sala (sí/no/abstención/pareo/ausente) con fuente, fecha y enlace
  3. El voto individual se puebla a escala acotado por `--boletines`/`limite` respetando rate-limit 2-3s (WAF); backfill masivo LOCAL reanudable, paginando PostgREST `.range()`
  4. El % `confirmado` NO baja al escalar (ningún name-match entró); la cobertura confirmado/no_confirmado queda medida

**Plans**: 2 plans

- [x] 66-01-PLAN.md — Wire dos-etapas (r2Store/snapshotWriter/--from-r2) en runCamaraVotos + reporte de cobertura + tests fake-R2
- [x] 66-02-PLAN.md — Runbook operador-LOCAL del backfill a escala (LIVE gated, reanudable, cobertura)

### Phase 67: VOTO P3d — Paridad Senado (voto individual por nombre)

**Goal**: Cerrar el voto individual del Senado a escala, degradando fail-closed donde solo hay nombre — sin fabricar FK.
**Depends on**: Phase 66
**Requirements**: VOTO-01 (Senado)
**Componentes**: MODIFICADO (ejecución) · `connector-senado.ts` + `reconciliar-senado.ts` YA-EXISTEN
**Success Criteria** (what must be TRUE):

  1. El voto individual del Senado se puebla a escala vía `votaciones.php` con dos etapas R2 (`--from-r2`)
  2. El vínculo Senado es por nombre normalizado → `probable/no_confirmado` con `fuente_voter_id = seq:<n>`; nunca fabrica un FK confirmado
  3. `runIngest` degrada fail-closed sin provider Senado — no inventa votos del Senado
  4. La UI solo muestra como atribuido lo `confirmado`; lo demás no se presenta como voto de la persona

**Plans**: TBD

### Phase 68: VOTO P3e — Superficies de voto + linter anti-insinuación + cobertura + gate BrowserOS

**Goal**: Cerrar el 360 del voto en la ficha del parlamentario — descriptivo, nunca "alineamiento/disciplina/rebeldía" — con cobertura honesta y comprensión validada.
**Depends on**: Phase 67
**Requirements**: VOTO-02, VOTO-04, VOTO-05
**Componentes**: MODIFICADO (montaje + gate) · RPCs `votos_de_parlamentario`/`rebeldias_de_parlamentario` y componentes (`votos-chart`, `voto-detalle`, `votos-por-parlamentario`) YA-EXISTEN
**Success Criteria** (what must be TRUE):

  1. El ciudadano ve, en la ficha del parlamentario, su historial de votos individuales por sesión/proyecto — con enlace a la votación y al proyecto; nunca como "alineamiento" ni "rebeldía"
  2. Cada superficie de voto lleva leyenda anti-insinuación ("un voto es un hecho observable; ausente/pareo ≠ en contra; no medimos disciplina ni motivo") + provenance inline; pareo/ausente en slate neutro, nunca fundidos con "en contra"
  3. El linter anti-vocabulario-insinuante corre TAMBIÉN sobre los componentes de voto nuevos; no existe vista "parlamentarios que votan como X" ni matriz de similitud
  4. La cobertura del voto individual está DECLARADA (N/M sesiones cubiertas, techo por causa) en la UI y en `pnpm freshness`; el veredicto BrowserOS es "comprensible"

**Plans**: TBD
**UI hint**: yes

### Phase 69: DINERO P5a — RUT-01 backfill a la maestra (CHECKPOINT OPERADOR, bloqueante duro)

**Goal**: Poblar físicamente el RUT en la maestra — DATO bloqueante de TODO P5; sin RUT presente, cualquier cruce de dinero rinde `null` (o, peor, falso por name-match).
**Depends on**: Nothing de P5 (arranca P5); paralelizable con P3
**Requirements**: RUT-01
**Componentes**: EJECUCIÓN (checkpoint operador, write remoto vía db-url) · `harvest-rut.ts`/`runBackfillRut` YA-EXISTEN
**Success Criteria** (what must be TRUE):

  1. La maestra `entidad_tercero`/`parlamentario` tiene RUT backfilleado para las entidades cruzables (Track B seed curado como default + Track A SERVEL como corroboración), con DV-gate módulo-11 y provenance NOT NULL
  2. La cobertura de RUT DV-válido está MEDIDA y DECLARADA como techo honesto (N/M); "sin dato de RUT" ≠ "sin vínculos"
  3. Un name-match NUNCA escribe el `rut` de la maestra (name-uniqueness ≠ RUT-ownership); solo corrobora un RUT presente o encola a revisión humana — guard CI lo enforça
  4. El RUT nunca cruza al LLM ni a una tabla/ruta pública (minimización, RLS deny-by-default)

**Plans**: TBD

### Phase 70: DINERO P5b — Wire dos-etapas ChileCompra por RUT (funde DEBT-01, SPIKE cuota)

**Goal**: Poblar los contratos del Estado por RUT exacto vía ingesta de dos etapas — construido detrás del flag, con el mismo wire que mata la deuda de dos-etapas para ChileCompra.
**Depends on**: Phase 69
**Requirements**: MONEY-01, DEBT-01 (parcial — dinero)
**Componentes**: MODIFICADO (wire R2; `ingest-run` hoy marca "R2 BLOQUEADO") · `connector-chilecompra.ts` + `reconciliar-contrato.ts` + tablas `contrato/contratista` (0023) YA-EXISTEN
**Success Criteria** (what must be TRUE):

  1. ChileCompra ingesta fuente→R2→Supabase re-ejecutable (`--from-r2`), serial por RUT respetando 2-3s, ticket `CHILECOMPRA_TICKET` redactado en logs
  2. Detrás de `MONEY_PUBLIC_ENABLED` OFF, existen los contratos del Estado de empresas ligadas por RUT exacto con fuente/fecha/enlace (monto VERBATIM string)
  3. La rama de persona jurídica reconcilia SOLO por RUT exacto fail-closed — nunca `correrPipeline`/LLM/name-match
  4. Si el universo excede la cuota (10k/día), el crawl se parte en varios días (LOCAL reanudable); freshness cubre ChileCompra con staleness

**Plans**: TBD
**Research**: yes (SPIKE — cuota ChileCompra por universo de diputados; bulk OCDS mecánica no documentada)

### Phase 71: DINERO P5c — SERVEL LOCAL (.xlsx artesanal, funde DEBT-01)

**Goal**: Poblar el financiamiento electoral declarado (aportes/gastos) por RUT — conector artesanal frágil, LOCAL por elección, con frescura declarada.
**Depends on**: Phase 69 (RUT-01); paralelizable con Phase 70
**Requirements**: MONEY-02, DEBT-01 (parcial — servel)
**Componentes**: MODIFICADO (wire R2) · `connector-servel.ts` (exceljs) + `reconciliar-aporte.ts` + tabla `aporte` (0024) YA-EXISTEN
**Success Criteria** (what must be TRUE):

  1. El operador deja el `.xlsx` correcto en R2 y el pipeline re-corre SIN volver a tocar la fuente (dos etapas; SERVEL LOCAL, no cron)
  2. Detrás del flag OFF, existen los aportes/gastos SERVEL asociados por RUT con fuente/fecha/enlace
  3. La fecha de corte y qué elección/período cubre el dato SERVEL están VISIBLES por dato (nunca dato viejo presentado como actual)
  4. `ServelBloqueadaError` degrada ESA elección sin abortar la corrida; SERVEL aparece en `pnpm freshness` con staleness

**Plans**: TBD

### Phase 72: DINERO P5d — Extender materializador `cruce_senal` con `lobby_sector_aporte`

**Goal**: Sumar la señal de aporte por sector a la capa de cruces como conteo factual — el token ya está reservado para esta fase.
**Depends on**: Phase 70, Phase 71
**Requirements**: MONEY-03
**Componentes**: MODIFICADO (migración aditiva) · `cruces.materializar_cruces()` (0039, token `lobby_sector_aporte` RESERVADO) YA-EXISTE
**Success Criteria** (what must be TRUE):

  1. `cruce_senal` incluye la señal de aporte por sector vía RUT de empresas ligadas, como CONTEO factual con evidencia jsonb (enlaces de fuente), NUNCA un score de correlación
  2. La migración es aditiva (nuevo CHECK del token + rama del insert) y el materializador es FULL REBUILD transaccional (patrón existente)
  3. La señal solo cuenta parlamentarios con RUT presente (depende de RUT-01); sin RUT rinde vacío honesto, no falso
  4. Ninguna afirmación causal ("financió su voto") aparece en la señal ni en su etiqueta

**Plans**: TBD

### Phase 73: DINERO P5e — Superficies MONEY gated OFF + linter + GATE LEGAL humano

**Goal**: Montar todas las superficies de dinero detrás del gate deny-by-default; el agente construye hasta el gate, el encendido es acto humano (sign-off 21.719).
**Depends on**: Phase 72
**Requirements**: MONEY-04, MONEY-05
**Componentes**: MODIFICADO (montaje + gate) · `money-gate.ts::moneyPublicEnabled` + superficies (`contratos-de-parlamentario`, `financiamiento-de-parlamentario`, `aportes/contratos-por-contraparte`) YA-EXISTEN
**Success Criteria** (what must be TRUE):

  1. Todas las superficies MONEY se renderizan SOLO a través de `moneyPublicEnabled(process.env)` (fail-closed, literal `"true"`) — OFF por defecto; ninguna ruta lee la env cruda
  2. Toda superficie de dinero lleva procedencia inline + leyenda anti-insinuación; el vínculo "empresa ligada" se afirma solo con base RUT-exacta, nunca por name-match/LLM; conteos factuales, nunca "empresa ligada a"
  3. Un guard CI impide que un commit de agente cambie el flag/default a `"true"`; el flip requiere `signoff: approved` en el dossier legal 13 (acto humano exclusivo, el operador lo provee)
  4. El veredicto BrowserOS de comprensión sobre las superficies MONEY (en modo gated-preview) es "comprensible"

**Plans**: TBD
**UI hint**: yes

### Phase 74: DEUDA — Cursor leylobby + `CLOUDFLARE_API_TOKEN` CI + round-robin cron leyes-weekly

**Goal**: Cerrar la deuda de ingesta independiente de P3/P5 — que los crons corran verdes y la frescura no se diluya.
**Depends on**: Nothing (paralelizable en cualquier momento)
**Requirements**: DEBT-02, DEBT-03, DEBT-04
**Componentes**: MODIFICADO (conectores/CI/cron existentes) · independientes de votos/dinero
**Success Criteria** (what must be TRUE):

  1. El conector leylobby usa cursor incremental — no re-scrapea todo el histórico en cada corrida
  2. `CLOUDFLARE_API_TOKEN` está cargado en CI → los crons de novedades corren verdes en GitHub Actions sin fallback local manual
  3. El cron `leyes-weekly` rota round-robin sobre el corpus 3.657 (lotes acotados incrementales L–V) → ningún proyecto queda indefinidamente sin refrescar; MONEY/SERVEL fuera del cron mientras gated
  4. La frescura por fuente (`pnpm freshness`) refleja la rotación sin regresionar los conectores v6.0 (leyes/lobby/probidad)

**Plans**: TBD

### Phase 75: DEUDA — Typography island `.net-*` + rotar DB password (operador)

**Goal**: Cerrar la deuda cosmética/operacional restante — alinear la typography fuera de contrato y rotar la credencial expuesta.
**Depends on**: Nothing (paralelizable)
**Requirements**: DEBT-05, DEBT-06
**Componentes**: MODIFICADO (frontend `.net-*`) + EJECUCIÓN (checkpoint operador para B26)
**Success Criteria** (what must be TRUE):

  1. La typography del island `.net-*` queda alineada al design system (hoy fuera de contrato: nombre 15px, banda 13px)
  2. El DB password de Supabase (B26) queda rotado por el operador en el dashboard, con la acción documentada
  3. El cambio de typography no regresiona el layout radial de `/red` (F18 LOCKED intacto)

**Plans**: TBD
**UI hint**: yes

## Phases

<details>
<summary>✅ v1.0 MVP — Proyectos de Ley + Fundaciones de Identidad (Phases 1-7) — SHIPPED 2026-06-18</summary>

- [x] Phase 1: Framework de Conectores + Almacenamiento + Orquestación (3/3 plans) — 2026-06-18
- [x] Phase 2: Capa de Providers LLM/Embeddings (3/3 plans) — 2026-06-18
- [x] Phase 3: Tabla Maestra Parlamentario + Identidad Determinista (4/4 plans) — 2026-06-18
- [x] Phase 4: Adjudicación de Identidad + Compuerta Humana + Golden Set (3/3 plans) — 2026-06-18
- [x] Phase 5: Tramitación Core — Ficha + Timeline + Votaciones (5/5 plans) — 2026-06-18
- [x] Phase 6: Citaciones + Tabla Semanal de Sala (4/4 plans) — 2026-06-18
- [x] Phase 7: Búsqueda Semántica + Fichas Estructuradas (3/3 plans) — 2026-06-18

Full detail archived: `.planning/milestones/v1.0-ROADMAP.md` · Requirements: `.planning/milestones/v1.0-REQUIREMENTS.md` · Audit: `.planning/milestones/v1.0-MILESTONE-AUDIT.md`

</details>

## 📋 v2.0 — Parlamentarios 360

**Mode:** mvp (Vertical MVP — cada fase entrega una rebanada conector → reconciliación → sección de ficha ciudadana verificable end-to-end)
**Granularity:** fine
**Milestone:** v2.0 — frente "análisis de parlamentarios 360" (voto individual, lobby + patrimonio, dinero, grafo de influencia)
**Numbering:** continúa desde v1.0 — Phase 7 fue la última de v1.0; v2.0 arranca en **Phase 8**.

### Coverage

- v2.0 requirements: 24 (IDENT 3, VOTE 5, INT 5, MONEY 5, NET 2, LEGAL 3)
- Mapped to phases: 24/24 ✓
- Orphaned: 0

### Build order (forzado por dependencias duras de la investigación)

```
VOTE spike (Phase 8, GATE confirm-or-replan) ──┐
                                               ├──► VOTE block (Phase 10)
Identity completeness (Phase 9, prerrequisito)─┘
        │  (writer-invariant tipado IDENT-12 + RLS/data-routing PII LEGAL-03 = piso antes del primer dataset de atribución)
        ▼
INT — Lobby (Phase 11)  ──►  INT — Patrimonio/Intereses (Phase 12)
        ▼
LEGAL gate MONEY (Phase 13, ANTES de exponer MONEY) ──► MONEY — ChileCompra (Phase 14) ──► MONEY — SERVEL (Phase 15) ──► MONEY — Agregación (Phase 16)
        ▼
LEGAL gate NET (Phase 17, ANTES de exponer NET) ──► NET — Grafo de influencia (Phase 18, consumidor puro de los tres bloques)
```

Sub-maestras se construyen en su bloque, NO se difieren a NET: lobista/gestor (Phase 11), contratista (Phase 14), donante (Phase 15).

### Phases

- [x] **Phase 8: VOTE Spike — Validación en vivo de `opendata.camara.cl`** - Gate confirm-or-replan: ✅ CONFIRMADO (2026-06-19) — voto por diputado con `Diputado/DIPID` + `Opcion` no nulos, mapeo determinista 100%.
- [x] **Phase 9: Completitud de Identidad — Backfill RUT + Invariante de Writer + Piso PII** - Prerrequisito de toda atribución por RUT; el writer-guard tipado y la RLS/data-routing PII aterrizan antes del primer dataset nuevo (completed 2026-06-19)
- [x] **Phase 10: VOTE — Voto individual por parlamentario en la ficha** - Conector `@obs/votos` enriquece el voto existente por DIPID; lista de votos, asistencia, voto×tema y rebeldías en `/parlamentario/[id]` (completed 2026-06-19)
- [x] **Phase 11: INT Lobby — Reuniones de lobby + sub-maestra de contrapartes** - `@obs/lobby` ingiere audiencias; primera sección multi-dataset de la ficha del parlamentario (completed 2026-06-19)
- [x] **Phase 12: INT Patrimonio/Intereses — Declaraciones con historial y comparación** - `@obs/probidad` (InfoProbidad CC BY 4.0) con fecha de presentación, versiones y comparación lado a lado sin veredicto (completed 2026-06-19)
- [x] **Phase 13: Compuerta Legal — Bloque MONEY (Ley 21.719)** - Pasada legal sobre republicación, datos sensibles y terceros privados aprobada ANTES de exponer dinero (completed 2026-06-19)
- [x] **Phase 14: MONEY Contratos — ChileCompra por RUT + sub-maestra de contratistas** - `@obs/dinero` (ChileCompra) con DV módulo-11, persona natural/jurídica y enlace RUT-exacto (completed 2026-06-19 — gated OFF; 4/4 código, operador: aplicar 0023 al remoto + LIVE probe + RUT)
- [x] **Phase 15: MONEY Financiamiento — SERVEL verbatim + sub-maestra de donantes** - Conector SERVEL artesanal con drift bloqueante y reconciliación de completitud (cuarentena, nunca filas silenciosas) (completed 2026-06-19 — gated OFF; 4/4 código; enlace por NOMBRE confirmado vía pipeline de identidad (A1/finalidad del dato, no RUT); crudo→Supabase Storage (R2 401); operador: aplicar 0024 al remoto + bucket crudo-servel + corrida LIVE)
- [x] **Phase 16: MONEY Agregación — Contratos/aportes por contraparte** - Vistas agregadas por donante o empresa usando las sub-maestras (completed 2026-06-19 — gated OFF; 3/3 código; RPC `agregado_por_contraparte` solo jurídica/empresas (PII-safe, persona natural nunca expuesta), ruta `/contraparte/[id]` con notFound() gate, anti-insinuación (sin votos, count-only); operador: aplicar 0025 al remoto + pgTAP 0026)
- [~] **Phase 17: Compuerta Legal — Bloque NET (framing del grafo)** - Dossier CONSTRUIDO; sign-off F17 ahora `approved` (2026-06-24, Sánchez Rossi). Encender NET = acción de operador (flag `NET_PUBLIC_ENABLED`)
- [x] **Phase 18: NET — Grafo de influencia (`@xyflow/react`)** - Aristas materializadas por `pg_cron` + RPC con CTE recursiva; ambos extremos confirmados, provenance y ventana por arista, sin lenguaje causal (completed 2026-06-21)
- [x] **Phase 19: Producto + Diseño — Brief y cierre de diseño del frontend** - Brief de producto y sistema de diseño CERRADO (implementation-ready) que saca el máximo partido a la data ya disponible; estudio visual de referencias (legalatlas.cl, tributalab.com, ischilesafe.com) vía browseros; correr en autónomo, Opus sin economía de tokens (completed 2026-06-20)

## Phase Details

### Phase 8: VOTE Spike — Validación en vivo de `opendata.camara.cl`

**Goal:** Confirmar o replanificar el bloque VOTE: validar en vivo, detrás del WAF, que `opendata.camara.cl` entrega el voto individual por diputado utilizable para enlace determinista — no se dimensiona ninguna historia VOTE aguas abajo hasta que el spike vuelva.
**Mode:** mvp
**Depends on:** Phase 7 (v1.0)
**Requirements:** VOTE-01
**Success Criteria** (what must be TRUE):

  1. Una corrida en vivo contra `getVotaciones_Boletin` → detalle de votación devuelve, para boletines reales, el contenedor de votos por diputado con `Diputado` y `Opcion` **poblados (no null)** y reconciliables contra los totales (`TotalAfirmativos/Negativos/Abstenciones/Dispensados` + `Pareos`)
  2. El identificador `Diputado/Id` mapea al `id_diputado_camara` oficial de la maestra v1.0 — habilitando enlace determinista sin LLM (el "buen camino")
  3. El spike documenta cobertura histórica (qué legislaturas/años) y comportamiento de rate detrás del WAF respetando el delay 2–3s LOCKED
  4. El resultado es una decisión binaria registrada: **confirmar y construir** Phase 10 tal cual, o **replanificar solo el bloque VOTE** (sin bloquear INT/MONEY)

**Plans:** 1 plan

- [ ] 08-01-PLAN.md — Spike confirm-or-replan: corrida LIVE-gated reusando @obs/ingest + parsers v1.0, reconcilia DIPID→id_diputado_camara, registra FINDINGS + decisión binaria

### Phase 9: Completitud de Identidad — Backfill RUT + Invariante de Writer + Piso PII

**Goal:** Generalizar la guarda de identidad de v1.0 a las nuevas fuentes ANTES de que escriba el primer dataset de atribución: completar el RUT interno de la maestra, convertir la guarda de enlace-confirmado en un invariante tipado a nivel de writer, y dejar el piso de RLS/data-routing para toda PII nueva.
**Mode:** mvp
**Depends on:** Phase 7 (v1.0). Puede correr en paralelo con Phase 8 (VOTE Cámara usa DIPID, no RUT).
**Requirements:** IDENT-10, IDENT-11, IDENT-12, LEGAL-03
**Success Criteria** (what must be TRUE):

  1. El `rut` de la maestra de parlamentarios queda completado (backfill) server-side, de uso interno, nunca legible por `anon` (verificado por RLS deny-by-default, como `parlamentario.rut` en v1.0) — habilita el cruce por RUT de dinero/probidad
  2. Existe un invariante tipado: ningún `*Writer` puede fijar un FK `parlamentario_id` salvo match `determinista`/`confirmado`; en caso contrario fija NULL + mención cruda + marca de identidad no verificada (rechazado estructuralmente, no por convención)
  3. El golden set de reconciliación se extiende con casos de homónimos y colisión de RUT (persona natural vs jurídica, DV inválido) propios de SERVEL/ChileCompra; el gate CI ≥0.95 sigue bloqueando
  4. Toda columna PII nueva nace oculta a `anon` por RLS y la compuerta `data-routing` del LLM se extiende a los nuevos datos sensibles: ningún RUT/PII puede llegar al LLM (reusa `assertNoRutInLlmInput`/`assertSensitivityAllowed`)

**Plans:** 3/3 plans complete

- [x] 09-01-PLAN.md — Invariante de writer tipado (IDENT-12): branded EnlaceConfirmado + factory única; refactor del choke point + voto writer; prueba de compilación
- [x] 09-02-PLAN.md — Backfill RUT (IDENT-10): Track A spike SERVEL + Track B lista curada, DV-validado nunca fabricado, re-export del seed; golden set extendido (IDENT-11)
- [x] 09-03-PLAN.md — Piso RLS/PII (LEGAL-03): migración 0018 deny-by-default + pgTAP (apply gateado operador) + extensión data-routing del LLM

### Phase 10: VOTE — Voto individual por parlamentario en la ficha

**Goal:** El ciudadano ve, en la ficha del parlamentario, cómo vota cada uno — lista de votos, asistencia, voto por tema y una métrica observable de rebeldías — con la guarda de identidad aplicada y provenance por fila.
**Mode:** mvp
**Depends on:** Phase 8 (spike confirmado), Phase 9 (invariante de writer + RLS PII)
**Requirements:** VOTE-02, VOTE-03, VOTE-04, VOTE-05
**Success Criteria** (what must be TRUE):

  1. El conector `@obs/votos` ingiere el voto individual por diputado y enriquece el modelo `voto`/`votacion` existente (NO forka el modelo), cruzando determinísticamente por `DIPID` → `id_diputado_camara` sin LLM, con provenance por fila
  2. La ficha `/parlamentario/[id]` muestra la lista de votos del parlamentario (A favor / En contra / Abstención / Pareo / Ausente) y su asistencia; el enlace al voto solo aparece si `estado_vinculo='confirmado'` (guarda de identidad LOCKED), si no, mención cruda + IdentityMarker
  3. El ciudadano puede ver cómo vota un parlamentario por tema/materia del proyecto (reusa los embeddings de v1.0), sin lenguaje de afinidad ni score
  4. La ficha muestra una métrica de rebeldías (cuántas veces votó distinto a su bancada) presentada como dato bruto, sin juicio ni etiqueta
  5. Cada fila distingue tres estados honestos (enlazado-confirmado / presente-no-verificado / no-ingestado) — un vacío nunca se lee como "limpio"

**Plans:** 3/3 plans complete

Plans:

- [x] 10-01-PLAN.md — Base de datos/parser (VOTE-03/04/05): parser a 5 opciones (ausente) + migración 0019 (CHECK ausente, índice voto(parlamentario_id), RPCs votos/rebeldías security-definer) + pgTAP
- [x] 10-02-PLAN.md — Conector @obs/votos producción (VOTE-02): promueve el spike a src/, cruce DIPID determinista, idempotente, provenance por fila; corrida LIVE acotada (operador)
- [x] 10-03-PLAN.md — Ficha /parlamentario/[id] (VOTE-03/04/05): shell apilable + asistencia + lista paginada + voto×tema + rebeldías + 3 estados honestos + gate anti-afinidad/causal

**UI hint**: yes

### Phase 11: INT Lobby — Reuniones de lobby + sub-maestra de contrapartes

**Goal:** El ciudadano ve las reuniones de lobby de un parlamentario con la contraparte trazable a la fuente; esta es la primera sección donde aparece más de un dataset, así que fija las reglas anti-insinuación para todo el frente.
**Mode:** mvp
**Depends on:** Phase 9 (invariante de writer + RLS PII)
**Requirements:** INT-01, INT-02
**Success Criteria** (what must be TRUE):

  1. El conector `@obs/lobby` ingiere las reuniones de la Ley del Lobby (`leylobby.gob.cl`) y crea una sub-maestra de contrapartes (lobistas/gestores de interés) — construida en este bloque, no diferida a NET
  2. La ficha del parlamentario muestra su lista de reuniones de lobby con la contraparte como texto crudo (sin enlazar a una identidad salvo que esté confirmada) y provenance por fila
  3. El enlace reunión→parlamentario solo se fija con match `determinista`/`confirmado` vía `correrPipeline`; cada decisión deja una fila en `identidad_audit`
  4. Ninguna unidad de UI compone una reunión de lobby junto a un voto como una sola unidad destacada (regla anti-"máquina de sospechas"); cada dataset vive en su propio carril con fuente, sin lenguaje causal/afinidad

**Plans:** 3/3 plans complete

Plans:

- [x] 11-01-PLAN.md — Migración 0021 (lobby_audiencia public-read + lobby_contraparte deny-by-default + RPC lobby_de_parlamentario + marcador lobby_ingesta_estado) + pgTAP; aplicación gateada (operador)
- [x] 11-02-PLAN.md — Conector @obs/lobby (espeja @obs/agenda): parser cheerio keyed por Identificador + reconciliación del sujeto pasivo (EnlaceConfirmado solo-determinista) + sub-maestra de contrapartes cruda + writer idempotente + drift bloqueante; corrida LIVE acotada (operador)
- [x] 11-03-PLAN.md — Sección de lobby en /parlamentario/[id]: carril propio (mt-12), contraparte cruda + ProvenanceBadge, 3 estados honestos, gate anti-insinuación

**UI hint**: yes

### Phase 12: INT Patrimonio/Intereses — Declaraciones con historial y comparación

**Goal:** El ciudadano ve las declaraciones de patrimonio e intereses de un parlamentario, su historial de versiones y una comparación en el tiempo — literal, fechada y atribuida, sin ningún veredicto de enriquecimiento ni de conflicto.
**Mode:** mvp
**Depends on:** Phase 11 (sección de ficha del parlamentario establecida)
**Requirements:** INT-03, INT-04, INT-05
**Success Criteria** (what must be TRUE):

  1. El conector `@obs/probidad` ingiere las declaraciones de patrimonio e intereses (InfoProbidad, CSV/SPARQL) de forma literal, con fecha de presentación y atribución CC BY 4.0 visible (incluso en vistas derivadas)
  2. La ficha muestra las declaraciones con su historial de versiones (qué declaró y cuándo); cada declaración exhibe su fecha de presentación de forma prominente (badge de frescura ámbar si está vieja) — nunca una declaración vieja se presenta como estado actual
  3. El ciudadano puede comparar las declaraciones de patrimonio de un parlamentario lado a lado en el tiempo, mostrando solo los datos — sin ningún campo de veredicto de "enriquecimiento" ni de "conflicto de interés"
  4. La extracción LLM de estos documentos PII pasa obligatoriamente por la compuerta `data-routing` (tier sin entrenamiento, ningún RUT al LLM); el drift de esta fuente PII es bloqueante (cuarentena, no degradación silenciosa)

**Plans:** 3/3 plans complete

Plans:

- [x] 12-01-PLAN.md — Migración 0022 (declaracion public-read VERSIONADA por (fuente_id, fecha_presentacion) + sub-tablas de bienes + declaracion_familiar deny-by-default + revoke + RPCs declaraciones_de_parlamentario/comparar_declaraciones + marcador probidad_ingesta_estado) + pgTAP; APLICADA al remoto + pgTAP 34/34 verde; OQ1/2/3 resueltas en vivo SPARQL
- [x] 12-02-PLAN.md — Conector @obs/probidad (espeja @obs/lobby): query builders SPARQL + parser zod LITERAL sin LLM keyed por (fuente_id, fecha_presentacion) + reconciliación name-only del declarante (EnlaceConfirmado solo-determinista) + familiares deny-by-default + writer VERSIONADO (acumula, nunca sobreescribe) + drift bloqueante; corrida LIVE acotada (operador)
- [x] 12-03-PLAN.md — Sección de patrimonio en /parlamentario/[id]: carril propio (mt-12), historial fechado (fecha prominente + frescura ámbar, vieja nunca actual) + comparación lado-a-lado (shadcn Table, CERO veredicto/delta) + CC BY 4.0 visible en intro y caption; content-gate sobre lista Y comparación

**UI hint**: yes

### Phase 13: Compuerta Legal — Bloque MONEY (Ley 21.719)

**Goal:** Obtener la aprobación legal explícita antes de exponer públicamente cualquier dato de dinero — gate de proceso, no de construcción, que cubre la superficie de mayor sensibilidad del milestone.
**Mode:** mvp
**Depends on:** Phase 12 (frente INT poblado; contexto de terceros privados disponible para la revisión)
**Requirements:** LEGAL-01
**Success Criteria** (what must be TRUE):

  1. Una pasada de asesoría legal (Ley 21.719) queda registrada y aprobada, cubriendo explícitamente: republicación de datos públicos, datos sensibles (afiliación política) y terceros privados (donantes/lobistas)
  2. La revisión confirma que la postura de minimización se sostiene (solo se muestra lo que la fuente ya publica; RUT y datos de familiares quedan internos) y que el propósito (transparencia legislativa / control ciudadano) está fijado y visible
  3. El sign-off es un prerrequisito duro y verificable: ninguna ruta pública de MONEY (Phases 14–16) se expone hasta que esta compuerta esté aprobada

**Plans:** 2/2 plans complete

Plans:

- [x] 13-01-PLAN.md — Gate de exposición MONEY: flag server-only fail-closed (app/lib/money-gate.ts) + Vitest + .env.example + pgTAP de re-afirmación del piso PII deny-by-default (apply remoto gateado operador)
- [x] 13-02-PLAN.md — Dossier legal de preparación (Ley 21.719) con YAML signoff:pending, 3 superficies + minimización + propósito + base de licitud + licencia por dataset (ChileCompra=mención de fuente, NO CC BY) + copia en docs/legal/

### Phase 14: MONEY Contratos — ChileCompra por RUT + sub-maestra de contratistas

**Goal:** El ciudadano ve los contratos del Estado asociados al RUT de un parlamentario, redactados estrictamente como tales, con la regla RUT-exacto como único camino de enlace y una sub-maestra de contratistas para agregación futura.
**Mode:** mvp
**Depends on:** Phase 13 (compuerta legal MONEY aprobada), Phase 9 (RUT backfill)
**Requirements:** MONEY-01, MONEY-02
**Success Criteria** (what must be TRUE):

  1. El conector `@obs/dinero` ingiere contratos del Estado por RUT desde ChileCompra (`api.mercadopublico.cl`), valida el DV del RUT (módulo-11), etiqueta persona natural vs jurídica y crea una sub-maestra de contratistas; el barrido serial por RUT respeta el delay 2–3s vía pgmq + escape hatch de GitHub Actions
  2. La ficha muestra los contratos del Estado asociados al RUT de un parlamentario, redactados estrictamente como "contratos asociados al RUT" (nunca "del parlamentario"), con provenance y fecha de corte por fila
  3. El enlace contrato→parlamentario se fija ÚNICAMENTE por RUT-exacto contra el RUT interno de la maestra (nunca por nombre); un RUT sin match exacto no produce atribución; "consultado sin contratos" se distingue de "no consultado todavía"
  4. Un contrato a una persona jurídica nunca se colapsa en una atribución personal; el sujeto del contrato es la entidad proveedora, distinta de cualquier enlace al parlamentario

**Plans:** 4 plans (14-04 = retrofit finalidad del dato)

Plans:

- [x] 14-01-PLAN.md — Migración 0023_dinero.sql (contrato public-read versionado por (fuente_id, fecha_corte) + contratista deny-by-default + revoke + contratos_ingesta_estado + RPC contratos_de_parlamentario security-definer) + pgTAP 0024_dinero.test.sql; apply remoto + pgTAP verde = checkpoint operador
- [x] 14-02-PLAN.md — Conector @obs/dinero (espeja @obs/probidad): flujo ChileCompra 2 pasos (BuscarProveedor→ordenesdecompra) + DV módulo-11 + natural/jurídica + sub-maestra contratista + enlace SOLO RUT-exacto (sin correrPipeline) + writer idempotente + MERCADOPUBLICO_TICKET; corrida LIVE acotada (operador)
- [x] 14-03-PLAN.md — Sección /parlamentario/[id] "Contratos del Estado asociados al RUT": carril propio (mt-12) gateado por moneyPublicEnabled() (default OFF), 3 estados honestos, persona jurídica nunca posesivo, ProvenanceBadge + fecha de corte por fila, rama ChileCompra en sourceLabel ✅ (ContratosView/ContratosSection + 12 tests RTL verdes; tsc limpio en archivos del plan)
- [x] 14-04-PLAN.md — RETROFIT (finalidad del dato, 2026-06-19): proveedor persona NATURAL se enlaza al parlamentario vía `correrPipeline` por nombre confirmado (no solo RUT-exacto); persona jurídica sin cambios. Cosecha de RUT en DOS canales separados: CORROBORACIÓN (solo si el master ya tiene el RUT — nunca escribe RUT nuevo) vs REVISIÓN HUMANA (match solo-por-nombre → cola de adjudicación, master jamás mutado). Un nombre único NO prueba propiedad del RUT (code-review CR-01 arreglado). Data-routing: RUT nunca al LLM. 84 tests verdes; escritura remota al master + LIVE = operador

### Phase 15: MONEY Financiamiento — SERVEL verbatim + sub-maestra de donantes

**Goal:** El ciudadano ve el financiamiento de campaña de un parlamentario verbatim, ingerido por un conector artesanal frágil que se pone en cuarentena ante cualquier corrida parcial — una declaración por omisión es inaceptable.
**Mode:** mvp
**Depends on:** Phase 14 (patrón `@obs/dinero` + cruce RUT establecido)
**Requirements:** MONEY-03, MONEY-04
**Success Criteria** (what must be TRUE):

  1. El conector SERVEL de `@obs/dinero` (con `servel.cl`/`aportes.servel.cl` agregados al allowlist) ingiere los aportes de campaña verbatim y crea una sub-maestra de donantes — construida en este bloque, no diferida a NET
  2. El drift es BLOQUEANTE para SERVEL (no el default no-bloqueante de v1.0): una corrida parcial se pone en cuarentena con reconciliación de completitud (conteos/totales), nunca emite filas silenciosamente; el crudo va a R2 para recuperabilidad
  3. La ficha muestra el financiamiento de campaña de un parlamentario verbatim, con fuente/fecha/enlace por fila, restringido por periodo electoral (un aporte de una candidatura previa nunca se atribuye al mandato actual sin fecharlo)
  4. El enlace aporte→parlamentario es RUT-exacto del candidato contra la maestra interna; estados honestos (verificado / no-verificado / no-ingestado) — un vacío nunca se lee como "limpio"

> **Desviaciones aprobadas (2026-06-19):** (SC2) el crudo va a **Supabase Storage**, no a R2 (R2 devuelve 401; deuda de operador). (SC4) el enlace candidato→parlamentario es por **NOMBRE confirmado vía el pipeline de identidad** (`correrPipeline`, auditado), NO RUT-exacto — la fuente SERVEL no trae RUT y el principio de finalidad del dato exige no perder la fiscalización del político (ver memoria `finalidad-del-dato-linking-politicos`). El RUT/PII de donantes/familiares queda deny-by-default, nunca llave de enlace ni expuesto.

**Plans:** 3/3 plans complete

- [x] 15-01-PLAN.md — Migración `0024_servel.sql` + pgTAP `0025_servel.test.sql`: `aporte` public-read versionada + `donante` deny-by-default+revoke + marcador + RPC `aportes_de_parlamentario` (security-definer, nunca proyecta RUT donante) + CHECK `parlamentario_id null OR estado=confirmado`; apply remoto + pgTAP (operador)
- [x] 15-02-PLAN.md — Conector SERVEL en `@obs/dinero`: parser xlsx (`exceljs`) verbatim, drift BLOQUEANTE run-level (Content-MD5/byte-length → cuarentena, 0 filas), crudo→Supabase Storage, host EXACTO Azure-blob via extraHosts, enlace por NOMBRE confirmado vía `correrPipeline` (data-routing gate: donante nunca al LLM); bucket + corrida LIVE (operador)
- [x] 15-03-PLAN.md — Sección "Aportes de campaña registrados en SERVEL": carril mt-12 gateado por moneyPublicEnabled() (heading ausente con OFF), 3 estados honestos, agrupación por elección + caveat candidatura anterior, donante sujeto propio (RUT nunca renderizado), atribución "términos por verificar", "Asociado por nombre confirmado al candidato"

**UI hint**: yes

### Phase 16: MONEY Agregación — Contratos/aportes por contraparte

**Goal:** El ciudadano puede ver contratos y aportes agregados por contraparte (donante o empresa), usando las sub-maestras construidas en los bloques MONEY — hechos agregados con fuente, sin insinuación.
**Mode:** mvp
**Depends on:** Phase 14 (sub-maestra de contratistas), Phase 15 (sub-maestra de donantes)
**Requirements:** MONEY-05
**Success Criteria** (what must be TRUE):

  1. El ciudadano ve contratos/aportes agregados por contraparte (donante o empresa) usando las sub-maestras de donantes/contratistas, con cada fila trazable a su fuente/fecha/enlace
  2. La vista agregada por contraparte no compone una contraparte de dinero junto a un voto en una sola unidad de UI ni usa lenguaje causal/afinidad (la correlación donación→voto está prohibida por la regla rectora)
  3. La agregación describe hechos públicos independientes (X aparece como donante/contratista N veces en periodo Y) sin afirmar conexión ni intención

**Plans:** 6 plans

Plans:

- [x] 20-01-PLAN.md — Poblar la maestra de parlamentarios (~186) en la nube
- [x] 20-02-PLAN.md — Ingesta de tramitación (proyectos/votaciones/eventos) a la nube
- [x] 20-03-PLAN.md — Embeddings/fichas (Gemini 768) para la búsqueda semántica
- [x] 20-04-PLAN.md — Votos + lobby + patrimonio a la nube (MONEY excluido)
- [x] 20-05-PLAN.md — Wiring + noindex + secrets + deploy a Cloudflare Workers
- [x] 20-06-PLAN.md — Verificación end-to-end del sitio desplegado

### Phase 17: Compuerta Legal — Bloque NET (framing del grafo)

**Goal:** Obtener el sign-off legal sobre el framing del grafo de influencia antes de exponer la superficie más insinuante del producto — gate de proceso previo a NET.
**Mode:** mvp
**Depends on:** Phase 16 (los tres bloques de datos poblados; el grafo deriva de ellos)
**Requirements:** LEGAL-02
**Success Criteria** (what must be TRUE):

  1. Un sign-off legal sobre el framing del grafo queda registrado y aprobado, cubriendo específicamente el riesgo de que una arista o un camino se lea como acusación (clasificación de datos sensibles party/voto + terceros privados como nodos)
  2. La revisión confirma que el framing es descriptivo (aristas tipadas y con fuente, ventana temporal, sin score de sospecha ni path-finding como feature destacada) y que la atribución CC BY 4.0 se propaga a los nodos derivados de InfoProbidad
  3. El sign-off es prerrequisito duro: Phase 18 no se expone públicamente hasta su aprobación

**Plans:** 1 plan

Plans:

- [x] 17-01 — Dossier legal NET (`17-LEGAL-DOSSIER.md`, `signoff: pending`) + copia en `docs/legal/` + especificación del gate `NET_PUBLIC_ENABLED`

**Status:** Entregable construido (dossier de preparación + spec del gate). **El sign-off legal humano queda PENDIENTE — deuda de operador F17**; la compuerta permanece CERRADA: `NET_PUBLIC_ENABLED` no se enciende hasta `signoff: approved`. SC1/SC2 (revisión legal que dictamina y confirma framing descriptivo + propagación CC BY 4.0) son humanos; SC3 (prerrequisito duro para Phase 18) queda registrado y verificable por inspección del YAML.

### Phase 18: NET — Grafo de influencia (`@xyflow/react`)

**Goal:** El ciudadano explora una red de relaciones entre parlamentarios derivada de los datos ya poblados — cada arista un hecho público con fuente y ventana temporal, ambos extremos con identidad confirmada, sin ningún lenguaje causal.
**Mode:** mvp
**Depends on:** Phase 10 (VOTE), Phase 12 (INT), Phase 16 (MONEY), Phase 17 (sign-off legal NET)
**Requirements:** NET-01, NET-02
**Success Criteria** (what must be TRUE):

  1. El sistema materializa un modelo de aristas `entidad`/`arista` (vía proc `pg_cron` + RPC con CTE recursiva, sin base de datos de grafos), donde cada arista lleva provenance y ventana temporal, y AMBOS extremos tienen identidad `confirmado`
  2. El ciudadano explora un grafo de relaciones (UI `@xyflow/react@12`, client island) con filtros por tipo de arista y por tiempo, con la fuente de cada arista trazable
  3. Ninguna arista es inferida por LLM (solo aristas con fuente verificable); ningún camino se presenta como acusación; el copy es sobrio en español, sin lenguaje causal ni score de persona
  4. La atribución CC BY 4.0 (InfoProbidad) se propaga dentro de nodos/tooltips derivados de esa fuente

**Plans:** 4/4 plans complete

Plans:

- [x] 18-01-PLAN.md — Modelo grafo: entidad/arista deny-by-default + proc pg_cron + RPC subgrafo_red (NET-01)
- [x] 18-02-PLAN.md — net-gate.ts (server-only fail-closed) + ruta /red gateada consumiendo subgrafo_red (NET-01/02)
- [x] 18-03-PLAN.md — Isla @xyflow/react: nodo/arista sobrios, filtros tipo/tiempo, provenance + CC BY 4.0 (NET-02)
- [x] 18-04-PLAN.md — Verificación de fase + redeploy Linux gated-OFF (/red 404 en producción)

### Phase 19: Producto + Diseño — Brief y cierre de diseño del frontend

**Goal:** Producir un **brief de producto** y un **sistema de diseño CERRADO** (implementation-ready) para el frontend del Observatorio, que saque el **máximo partido a la data ya disponible** (no inventa features), con calidad de producto comparable a las otras propiedades del usuario, y benchmarkeado **visualmente** contra ellas vía **browseros**. Al terminar, el diseño queda cerrado: cualquier implementación posterior sigue el brief sin re-abrir decisiones.
**Mode:** mvp
**Depends on:** frontend v1.0+v2.0 ya construido (rutas `/`, `/buscar`, `/proyecto/[boletin]`, `/parlamentario/[id]`, `/agenda`, `/contraparte/[id]`). Independiente de Phases 17/18.
**Requirements:** (producto/diseño — no mapea a un REQ de datos; cierra la capa de presentación)
**Success Criteria** (what must be TRUE):

  1. Las **3 propiedades de referencia** del usuario — **legalatlas.cl**, **tributalab.com**, **ischilesafe.com** — se estudian **visualmente con browseros** (screenshots de home + 1–2 flujos clave de cada una); se extrae un análisis de marca, arquitectura de información, hero, densidad, tono y componentes, documentado con un veredicto explícito de **adoptar / adaptar / evitar** para el Observatorio
  2. Un **brief de producto** cubre: propuesta de valor por superficie, jerarquía de IA y navegación global, landing/hero (la **búsqueda semántica de proyectos** como protagonista), onboarding/primer-uso, y cómo CADA superficie existente (buscar, proyecto, parlamentario, agenda, contraparte) saca el máximo de la data REAL — sin inventar features ni datos que no existen
  3. Un **sistema de diseño cerrado**: tokens (color, tipografía, espaciado), voz/tono editorial en español, set de componentes, y los **estados honestos** (vacío/carga/error que nunca se leen como "limpio"), todo implementation-ready y consistente con lo ya shippeado
  4. **Diseños de las pantallas clave** (landing, resultados de búsqueda, ficha de proyecto, ficha de parlamentario, contraparte) entregados como mockups/specs ejecutables (HTML/Tailwind throwaway o UI-SPEC detallado por pantalla) — nada queda "abierto" ni "por decidir"
  5. **Principios rectores intactos** y visibles en el diseño: trazabilidad (fuente/fecha/enlace por dato), **anti-insinuación** (jamás componer dinero+voto como acusación; sin lenguaje causal/afinidad/score), MONEY sigue gated hasta sign-off legal; un entregable consolidado (brief + design system + pantallas) queda **revisado y cerrado**

**Notas de ejecución (LOCKED para el run autónomo):**

- **Correr en autónomo con Opus, SIN economía de tokens** — priorizar exhaustividad y calidad de diseño sobre costo (subir el perfil de modelo a todo-Opus para esta fase).
- **browseros es OBLIGATORIO** para el estudio visual de las 3 referencias. browseros vive en el contexto ORQUESTADOR (no en los sub-agentes gsd-ui-researcher), así que el estudio visual + screenshots se hace durante el **discuss/research del orquestador** y se vuelca a CONTEXT.md, que luego alimenta el UI-SPEC. Visitar: `https://legalatlas.cl`, `https://tributalab.com`, `https://ischilesafe.com`.
- **No inventar features ni datos.** El diseño exprime lo YA disponible (v1.0 búsqueda semántica + ficha de tramitación + timeline + votaciones; v2.0 parlamentario 360 + MONEY gated). Lo que "sería lindo" pero no tiene data → idea diferida marcada, no se diseña como real.
- **Es una fase de DISEÑO/PRODUCTO**: el entregable son artefactos de diseño (brief, design system, mockups, UI-SPEC por pantalla), no código de producción de features nuevas. La implementación es una fase posterior que seguirá este brief.

**Plans:** 5/5 plans complete

Plans:

- [x] 19-01-PLAN.md — DESIGN-SYSTEM.md (CERRADO): tokens crema+petróleo, tipografía Geist, espaciado 8-pt, catálogo de componentes, voz editorial ES, estados honestos, invariantes anti-insinuación
- [x] 19-02-PLAN.md — BRIEF.md: propuesta de valor por superficie, IA + navegación global, landing/hero (búsqueda semántica protagonista), onboarding, veredictos de referencia browseros, ideas diferidas
- [x] 19-03-PLAN.md — SCREENS.md: specs ejecutables por pantalla (landing, resultados, ficha proyecto, ficha parlamentario, contraparte) + GlobalHeader + directorio parlamentarios + sobre/metodología
- [x] 19-04-PLAN.md — mockup/landing.html: mockup HTML/Tailwind throwaway del landing (ancla visual: fondo crema + hero display + 1 acento itálico petróleo + búsqueda-hero + pills + línea de confianza)
- [x] 19-05-PLAN.md — CLOSURE.md: consolidación + cierre (cross-check de los 5 criterios de éxito, auditoría de principios rectores, sign-off CERRADO)

### Phase 20: Deploy + Carga de Datos — Preview privado gov-map.com

**Goal:** Dejar el sitio del Observatorio **DESPLEGADO EN PRODUCCIÓN** (accesible por URL para mostrar a una ONG; en Cloudflare Workers vía **wrangler directo** — usuario logueado, sin GitHub Actions) y **ENTREGANDO INFORMACIÓN real**, con el Supabase de la nube **poblado por ingesta LIVE corrida LOCALMENTE**. MONEY y NET **apagados** (gated). Dominio: **gov-map.com**. Recomendado `noindex` hasta la pasada legal del lanzamiento masivo (flipeable). **Cambio 2026-06-20: preview-privado → producción** por decisión del usuario.
**Mode:** mvp
**Depends on:** Phase 19 (diseño cerrado, opcional para implementación), schema remoto aplicado (migraciones 0001–0025 YA en la nube al 2026-06-20), R2 con escritura OK, `.env` sin BOM. Independiente de Phases 17/18 (NET off).
**Requirements:** (deploy/infra — no mapea a un REQ de datos; pone el producto en vivo)
**Success Criteria** (what must be TRUE):

  1. **Supabase remoto poblado** con data real vía ingesta LIVE **corrida localmente** (idempotente, rate-limit 2–3s, en lotes acotados): maestra de parlamentarios, tramitación (proyectos/votaciones/eventos), embeddings de búsqueda semántica, votos, lobby, patrimonio. Conteos > 0 verificados con psql. MONEY/SERVEL **excluidos** (gated).
  2. **Frontend cableado a la nube**: `SUPABASE_URL` + `SUPABASE_ANON_KEY` del proyecto cloud (`bctyygbmqcvizyplktuw.supabase.co`) seteados como secrets del Worker (`wrangler secret put`), más `GEMINI_API_KEY` (embeddings de búsqueda en runtime). `MONEY_PUBLIC_ENABLED` ausente/false.
  3. **Producción accesible** (URL real para la ONG), con `noindex` recomendado hasta la pasada legal del lanzamiento masivo (toggle). MONEY y NET apagados. El gate legal Ley 21.719 sigue aplicando para indexar/lanzar amplio y para encender MONEY.
  4. **Deploy a Cloudflare Workers vía wrangler** (`pnpm --filter app deploy`, worker `observatorio-congreso`): sitio accesible en `*.workers.dev`. `gov-map.com` se adjunta cuando el dominio esté en la cuenta CF (paso DNS de operador).
  5. **Verificación end-to-end**: el sitio desplegado responde y muestra data real (la búsqueda devuelve proyectos; una ficha de parlamentario muestra votos/lobby/patrimonio). Principios rectores intactos (anti-insinuación, MONEY/NET gated, sin foto/partido, trazabilidad).

**Notas de ejecución (LOCKED para el run autónomo):**

- **Ingesta LIVE corre LOCAL, no en GitHub Actions** (preferencia del usuario: no gastar Actions). Idempotente/reanudable (pgmq + content-addressed R2). Respetar rate-limit 2–3s. Correr en **lotes acotados** (por boletín/periodo) para no exceder tiempos de subagente.
- **Deploy vía wrangler directo** (usuario logueado). **⚠️ Windows EPERM:** el build de OpenNext usa symlinks que Windows bloquea sin Modo Desarrollador → **activar Modo Desarrollador de Windows** o correr el build en **WSL**. Si ambos fallan, fallback al workflow `deploy-cloudflare.yml` (única excepción a "no Actions").
- **Preview PRIVADO**: `noindex` obligatorio; NUNCA lanzar público sin sign-off legal (CLAUDE.md). MONEY (`MONEY_PUBLIC_ENABLED`) y NET (grafo) **apagados**.
- **El runbook operativo completo (comandos exactos, gotchas, orden) está en `20-CONTEXT.md`** — leerlo es obligatorio antes de planificar.
- **Input de operador requerido**: `SUPABASE_ANON_KEY` (dashboard → Settings → API Keys) y, para el dominio, agregar `gov-map.com` a la cuenta Cloudflare (DNS). Sin el anon key el frontend no lee la nube.

**Plans:** 6/6 plans complete

### Phase 21: Producto en vivo — Diseño Phase 19 + directorio de parlamentarios + ideas matrices

**Goal:** Llevar el sitio EN VIVO (hoy frontend v1.0 plano) al **producto de Phase 19** (diseño CERRADO: fondo crema + acento petróleo, header global, tipografía/espaciado del DESIGN-SYSTEM) y cerrar las dos brechas de contenido que el deploy de Phase 20 expuso: (a) las **ideas matrices salen vacías** (0/74 — el texto fuente del proyecto no se ingirió, `texto_r2_path` nulo) y (b) **no se pueden descubrir parlamentarios** desde la UI (no hay directorio; solo `/parlamentario/[id]` por id directo). Calidad de producto comparable a las otras propiedades del usuario (legalatlas.cl, tributalab.com, ischilesafe.com).
**Mode:** mvp
**Depends on:** Phase 20 (sitio EN VIVO + data ya cargada en la nube), Phase 19 (diseño cerrado: `19-UI-SPEC.md` + `DESIGN-SYSTEM.md` + `mockup/landing.html`).
**Requirements:** (producto/UI — no mapea a un REQ de datos nuevo; eleva el producto ya desplegado)
**Success Criteria** (what must be TRUE):

  1. **Diseño Phase 19 implementado** en todas las rutas (`/`, `/buscar`, `/proyecto/[boletin]`, `/parlamentario/[id]`, `/agenda`): fondo crema `hsl(40 33% 97%)` + acento petróleo `hsl(183 38% 26%)` (60/30/10), header global, ramp Geist y espaciado 8-pt del `DESIGN-SYSTEM.md`. Benchmark visual (browseros) vs `mockup/landing.html` y las 3 referencias del usuario. EXTIENDE `globals.css`, NO toca `civic-tokens.css`.
  2. **Directorio de parlamentarios navegable** (nueva ruta, p.ej. `/parlamentarios`): lista los 186, con búsqueda/filtro por cámara/región/distrito, cada uno enlazando a su ficha. El ciudadano DESCUBRE parlamentarios sin conocer el id. (Ids reales son `D####`/`S####`.)
  3. **Ideas matrices + cuerpos legales visibles** en la ficha de proyecto: ingerir el **texto fuente** del proyecto (BCN/LeyChile `obtxml?opt=7&idNorma=` o el documento del proyecto) → re-correr el pipeline de fichas (`@obs/fichas`, sin `--dry-run`, con `--reembed` si aplica) para poblar `proyecto_ficha.idea_matriz` (hoy 0/74). Verificar con psql `count(idea_matriz) > 0`.
  4. **Honest-states correctos**: donde lobby/patrimonio no estén enlazados a un parlamentario (hoy 0/0 linkeados — fuente AA001/bianchi no es del Congreso), mostrar el estado honesto del `DESIGN-SYSTEM.md §7`, nunca vacío silencioso ni dato fabricado.
  5. **Redeploy verificado**: rebuild del bundle **en Linux (Docker, `docker-cf-build.sh`)** + `wrangler deploy`; verificación e2e (browseros) del diseño nuevo en producción. `noindex` sigue activo; MONEY/NET off; sin foto/partido; trazabilidad por dato.

**Notas de ejecución (LOCKED):**

- **NO re-ingestar** maestra/tramitación/votos/lobby/patrimonio: la nube YA está poblada (Phase 20). Lo único que FALTA ingerir es el **texto fuente de proyectos** para las ideas matrices (SC3).
- **Build/deploy SOLO en Linux:** el build de OpenNext en Windows produce un bundle que **500ea en runtime** (`dynamic require de middleware-manifest.json`). Usar `docker-cf-build.sh` (node:22) → `docker cp obsbuild:/build/app/.open-next` → `wrangler deploy` desde el host (OAuth ya autenticado). `pnpm --filter app run deploy` (NO `pnpm deploy`).
- **El runbook completo (diagnóstico vivo, comandos, gotchas) está en `21-CONTEXT.md`** — leerlo es obligatorio antes de planificar. El diseño autoritativo es `19-UI-SPEC.md` + `DESIGN-SYSTEM.md`.
- Principios rectores intactos (anti-insinuación, sin foto/partido, MONEY/NET gated, trazabilidad). Sitio en vivo: `https://observatorio-congreso.thevalis.workers.dev`.

**Plans:** 4/4 plans complete

Plans:

- [x] 21-01-PLAN.md — Diseño Phase 19: tokens crema/petróleo en globals.css + GlobalHeader montado en layout.tsx (SC1/SC4)
- [x] 21-02-PLAN.md — Directorio de parlamentarios: RPC publico parlamentarios_publico() (0026, PII-safe) + ruta /parlamentarios con filtro (SC2/SC4)
- [x] 21-03-PLAN.md — Ideas matrices: cablear el link_mensaje_mocion real (re-fetch Senado) + backfill LIVE @obs/fichas, psql count(idea_matriz)>0 (SC3/SC4)
- [x] 21-04-PLAN.md — Redeploy Linux (Docker) + verificacion e2e browseros en produccion: diseno, directorio, idea matriz, noindex, MONEY/NET off (SC5/SC4)

### Phase 22: Votaciones instructivas — qué votó cada uno y para qué

**Goal:** Hacer que la sección de votaciones de la ficha del parlamentario (y su espejo en la ficha del proyecto) sea **INSTRUCTIVA**: que el ciudadano entienda de un vistazo **QUÉ se votó** (la idea del proyecto, no solo el número de boletín), **CÓMO votó** (a favor/en contra) y **QUÉ pasó** (resultado y conteo de la votación), sin insinuar intención ni causalidad. Hoy cada voto se muestra como `En contra · Boletín N°18296-05` — opaco: no se ve de qué trataba, ni el desenlace, ni qué significó ese voto. Aprovechar las **ideas matrices ya pobladas** (Phase 21, 57/74) para dar sustancia. Calidad de producto comparable a las otras propiedades del usuario.
**Mode:** mvp
**Depends on:** Phase 21 (idea_matriz poblada + diseño Phase 19 en vivo), Phase 20 (data en la nube), Phase 19 (DESIGN-SYSTEM §6/§7/§8 + UI-SPEC §3/§9).
**Requirements:** (producto/UI — no mapea a un REQ de datos nuevo; eleva la instructividad de los datos ya cargados)
**Success Criteria** (what must be TRUE):

  1. **Sustancia por voto:** cada voto muestra el **título del proyecto** + un extracto de la **idea matriz** (cuando exista) — no solo el número de boletín. El ciudadano entiende de qué trataba lo que se votó sin hacer clic. Honest-state cuando el proyecto no tiene idea matriz.
  2. **Desenlace por votación:** cada votación muestra su **resultado y conteo** (Aprobado/Rechazado, total a favor–en contra, quórum, etapa) y enmarca el voto del parlamentario respecto a ese resultado (p.ej. "Votó En contra · el proyecto fue Rechazado 58–81"). Sin juicio.
  3. **Corregir la etiqueta "Asistencia":** separar la **asistencia real** (presente vs ausente) del **sentido del voto** (a favor/en contra/abstención). El desglose de sentido se renombra a algo honesto ("Cómo votó" / "Sentido de sus votos"); la asistencia es su propia métrica observable.
  4. **Agrupar por proyecto (el arco):** bajo cada proyecto (título + idea), mostrar las etapas en que votó y el desenlace del proyecto — trayectoria, no lista plana cronológica.
  5. **Honest-states + cobertura + funds:** explicar qué significa "a favor/en contra" (de **avanzar/aprobar el proyecto en esa etapa**) sin lenguaje causal; cuando hay pocas votaciones (hoy 2 boletines/10 votaciones) decirlo honestamente; "Financiamiento y contratos del Estado" (MONEY) muestra un **honest-state explícito** ("pendiente de revisión legal — Ley 21.719") en vez de silencio.
  6. **Espejo en la ficha del proyecto + redeploy:** la sección de votaciones del proyecto muestra resultado+conteo y conecta con la idea matriz del propio proyecto. Rebuild Linux (Docker) + `wrangler deploy` + verificación e2e (browseros) en producción; `noindex`/MONEY/NET intactos; sin foto/partido; trazabilidad por dato.

**Notas de ejecución (LOCKED):**

- **Anti-insinuación HARD** (UI-SPEC §9.1 / DESIGN-SYSTEM §6,§8): PROHIBIDO ranking/score/índice, juicio/adjetivo sobre un voto, relación/cercanía política, y lenguaje causal. "A favor/En contra" describe el **sentido del voto sobre el proyecto en esa etapa**, jamás una valoración. El nombre interno "rebeldías" nunca aparece en UI (heading neutro "Votó distinto a su bancada").
- **Datos disponibles SIN nueva ingesta ni RPC obligatoria nueva:** anon YA lee `votacion` (resultado/total_si/total_no/total_abstencion/quorum/etapa), `proyecto` (titulo/materia) y `proyecto_ficha` (idea_matriz). La `VotosSection` (server component, `app/components/votos-por-parlamentario.tsx`) ya joina `proyecto.materia` por boletín → extender ese join a `titulo` + `idea_matriz` + la fila de `votacion`. Opcional (más limpio): extender el RPC `votos_de_parlamentario` para devolver resultado/totales/titulo.
- **NO re-ingestar.** La cobertura fina de votaciones (solo 2 boletines) es una **deuda de datos separada**; esta fase es de **presentación instructiva** sobre los datos existentes, degradando honesto donde falten.
- **El runbook completo (análisis browseros en vivo, componentes, esquema de datos, gotchas) está en `22-CONTEXT.md`** — leerlo es obligatorio antes de planificar. Diseño autoritativo: `19-UI-SPEC.md` (§3 ficha parlamentario, §9 copy de votos) + `DESIGN-SYSTEM.md`.
- **Build/deploy SOLO Linux:** `docker start -a obsbuild` (container ya existe, reusa node_modules) → `docker cp obsbuild:/build/app/.open-next` → `cd app && npx wrangler deploy`. NO `pnpm deploy`. Sitio: `https://observatorio-congreso.thevalis.workers.dev`.

**Plans:** 4/4 plans complete

Plans:

- [x] 22-01-PLAN.md — Bloque A datos/tipos: extender el RPC votos_de_parlamentario (titulo + idea_matriz + resultado/totales/quorum), pgTAP 0029, VotoFichaRow extendido (SC1/SC2/SC4)
- [x] 22-02-PLAN.md — Bloque B VotosView instructiva: sustancia+desenlace por voto, corregir Asistencia, agrupar por proyecto (arco), linea explicativa, honest-state MONEY (SC1/SC2/SC3/SC4/SC5)
- [x] 22-03-PLAN.md — Bloque C espejo proyecto: VotacionCard con resultado+conteo enmarcado conectado a la idea matriz del proyecto (SC6)
- [x] 22-04-PLAN.md — Bloque D redeploy Linux (Docker obsbuild + wrangler deploy) + verificacion e2e browseros en produccion; noindex/MONEY/NET intactos (SC6)

## 📋 v3.0 — Cobertura de datos

**Mode:** data-coverage (milestone BROWNFIELD — el código de v2.0 ya existe y está validado; v3.0 ejerce esos conectores LIVE a escala, escribe el resultado en producción, adjudica identidad, arregla provenance y abre los gates operador/legal. NO se construye UI nueva — el shell de Phase 19 está cerrado.)
**Granularity:** fine
**Milestone:** v3.0 — Cobertura de datos (poblar la nube con datos REALES + adjudicación de identidad + provenance + gates)
**Numbering:** continúa desde v2.0 — Phase 22 fue la última de v2.0; v3.0 arranca en **Phase 23** (no reset).

### Coverage

- v3.0 requirements: 14 (LOBBY 4, PAT 2, VOT 2, PROV 1, RUT 1, OPS 2, SIGNOFF 2)
- Mapped to phases: 14/14 ✓
- Orphaned: 0 · Duplicated: 0

### Build order (forzado por dependencias duras del HANDOFF-2026-06-22)

```
OPS-01 apply remoto (Phase 23, PRECONDICIÓN — la data no es visible sin las migraciones 0026/0028/0030 + pgTAP verde)
   │
   ├──► LOBBY-01 fuente camara.cl/transparencia + spike (Phase 24)
   │        └──► LOBBY-02/03/04 LIVE + adjudicación de identidad + ficha poblada (Phase 25)  ──┐
   │                                                                                          │
   ├──► PAT-01/02 patrimonio LIVE + ficha (Phase 26)        (independiente)                   │
   ├──► VOT-01/02 votaciones masivas + ficha (Phase 27)     (independiente)                   │
   ├──► PROV-01 provenance de la maestra (Phase 28)         (independiente, ligera)           │
   └──► RUT-01 backfill operador del RUT interno (Phase 29) ──┐                               │
                                                              ▼                               │
                                          SIGNOFF-01 F13 MONEY (Phase 30, depende de RUT-01)  │
                                                              ▼                               ▼
                                          SIGNOFF-02 F17 NET (Phase 31, depende de LOBBY-03 confirmado)
                                                              ▼
                          OPS-02 redeploy + barrido de verificación en producción (Phase 32, consumidor final)
```

**Reglas LOCKED que enmarcan todas las fases de datos:** ingesta en DOS ETAPAS (fuente→R2 crudo, luego R2→Supabase, re-ejecutable independiente); rate-limit 2–3s/host; nunca fabricar un RUT; PII deny-by-default; anti-insinuación (sin lenguaje causal, jamás componer dinero/lobby con voto); migraciones aplicadas por `psql "$SUPABASE_DB_URL" --single-transaction -v ON_ERROR_STOP=1 -f`, NUNCA `supabase db push` (drift `schema_migrations` ≤0025).

### Phases

- [x] **Phase 23: OPS — Aplicar migraciones remotas pendientes + pgTAP verde** - Precondición dura: aplicar 0026/0028/0030 al Supabase remoto por `psql --db-url`, pgTAP verde sin regresión, probes de RPC — sin esto ninguna data poblada es visible. (completed 2026-06-22 — 0026/0028/0030 ya aplicadas y verificadas por introspección; pgTAP verde 0027 7/7 + 0029 8/8 + 0030 17/17 (fix throws_ok 42501 + plan count); RPC live como anon: parlamentarios_publico()=186, votos 17 cols, subgrafo_red no-null)
- [x] **Phase 24: LOBBY — Fuente camara.cl/transparencia + spike de estructura** - Ampliar `@obs/lobby` a `camara.cl/transparencia/ley_de_lobby.aspx` (la fuente real, ausente de leylobby.gob.cl), validada por un spike antes de cablear el crawl. (completed 2026-06-22 — spike LIVE: la fuente real es `listadodeaudiencias.aspx` (1 página ~12MB, 17.776 filas, sin paginación); parser+conector nuevos en @obs/lobby, clave natural sintetizada CAMARA-<sha256> (Detalles HTML-comentada), nombre RAW preservado para adjudicación; validado end-to-end 17.730 audiencias 100% fecha ISO + 1.184 vía Asesor H.D.; 33 tests verde + typecheck limpio)
- [x] **Phase 25: LOBBY — Corrida LIVE + adjudicación de identidad + ficha poblada** - Ingesta LIVE a escala, write desde R2, adjudicación de identidad por nombre (auditada) y la sección lobby de las fichas con audiencias confirmadas deja de estar vacía. (completed 2026-06-22 — LIVE a prod: 17.730 audiencias + 17.681 contrapartes; **5.106 confirmadas en 136/155 diputados** (fichas eran 0); fix causa-raíz identidad = match por token-set COMPLETO incl. materno (maestra era materno-less); WAF camara.cl bloquea Node fetch→`--html-file` con curl; NET materializado 136 nodos/7.394 aristas (gated-OFF hasta F17); 43 tests verde)
- [x] **Phase 26: PAT — Patrimonio/intereses LIVE en la nube + ficha poblada** - Corrida LIVE `@obs/probidad` (InfoProbidad, CC BY 4.0) por parlamentario, versionada, y la sección patrimonio muestra declaraciones reales con historial. (completed 2026-06-22 — LIVE a prod: 186 consultados → **1.060 declaraciones versionadas confirmadas / 136 parlamentarios** (era 0); match TARGETED token-superset (InfoProbidad trae segundos nombres + hermanos homónimos → ni materno-less ni full-equality; superset sí); bienes detallados diferidos (query SPARQL trae metadata+fecha); 34 tests verde)
- [x] **Phase 27: VOT — Ingesta masiva de votaciones + cobertura real en la ficha** - De 2 boletines a cobertura de legislatura desde `opendata.camara.cl` (+ Senado), cruce determinista DIPID, y la ficha refleja el conjunto ampliado. (completed 2026-06-22 — runner masivo `run-votos-masivo-cli` (--boletines-file) construido y corrido sobre los 74 boletines trackeados, idempotente, cruce DIPID determinista. HALLAZGO: cobertura SOURCE-LIMITED — opendata NO enumera votaciones en bulk (solo getVotaciones_Boletin) y la leg 58 arrancó 2026-03 → solo 2/74 boletines votados = 10 votaciones. El mecanismo escala cuando haya fuente de enumeración; bug writer tramitacion_evento diferido)
- [x] **Phase 28: PROV — Provenance real de la maestra** - Poblar el `origen` de cada fila de `parlamentario` con su fuente oficial (catálogo Cámara/Senado) + fecha de snapshot; el header deja de decir "fuente desconocida". (completed 2026-06-22 — la provenance YA estaba completa en el remoto (origen/fecha_captura/enlace 186/186, origen canónico "diputados"/"senado"); el gap real era de RENDERIZADO: `sourceLabel("diputados")` no mapeaba a "Cámara" + bug latente lobby→"InfoProbidad" por "transparencia". Fix en `app/lib/types.ts sourceLabel` (diputad→Cámara; lobby antes que transparencia) + 6 tests. NO se alteró el origen canónico)
- [ ] **Phase 29: RUT — Backfill operador del RUT interno** - El operador puebla `parlamentario-rut.seed.json` con RUTs DV-válidos + provenance (nunca fabricados) y corre el backfill; habilita el cruce MONEY una vez firmado el gate legal. (DEFERIDO 2026-06-22 — gate humano: ninguna fuente oficial cruzable expone el RUT de los parlamentarios (InfoProbidad confirmado no); fabricar un RUT está prohibido. La máquina de backfill (updateRut, DV-gate) ya existe (Phase 9). Requiere acción de operador con RUTs reales + adjudicación humana)
- [ ] **Phase 30: SIGNOFF — Gate legal F13 (MONEY, Ley 21.719)** - Acción humana: obtener y registrar el sign-off legal F13 que habilita encender `MONEY_PUBLIC_ENABLED` (depende de RUT-01 para que el cruce tenga datos). (DEFERIDO 2026-06-22 — gate humano/legal: el dossier `13-LEGAL-DOSSIER.md` ya existe; falta el sign-off de un abogado externo (`signoff: approved`). Además depende de Phase 29 RUT)
- [~] **Phase 31: SIGNOFF — Gate legal F17 (NET)** - Sign-off F17 FIRMADO `approved` (2026-06-24, Sánchez Rossi; front-matter de `17-LEGAL-DOSSIER-NET.md`). Resta SOLO la acción de operador: flip `NET_PUBLIC_ENABLED=true` en Cloudflare + redeploy (el RPC `subgrafo_red` ya está granted a anon; grafo = 7.394 aristas). DEUDA DOC (DEBT/PLAN-06): el §8 del cuerpo del dossier aún dice `pending` — reconciliar (no editar firma sin operador).
- [x] **Phase 32: OPS — Redeploy + barrido de verificación en producción** - Tras poblar y aplicar, redeploy + barrido browseros que confirma data real en las secciones y los invariantes (noindex, sin foto/partido, provenance por dato, MONEY/NET gated-OFF) intactos. (completed 2026-06-22 — redeploy version e4347898 (OpenNext Docker/Linux + wrangler deploy); verificación PASSED: lobby/patrimonio poblados, "fuente desconocida"→0, lobby="Ley del Lobby", header Cámara/Senado; invariantes intactos: /red 404, /contraparte 404, noindex, sin partido. 252 app tests verde)

## Phase Details (v3.0)

### Phase 23: OPS — Aplicar migraciones remotas pendientes + pgTAP verde

**Goal:** Hacer visible cualquier dato poblado de v3.0 aplicando al Supabase remoto las migraciones/RPC pendientes (0026 `parlamentarios_publico`, 0028 `votos_instructivos`, 0030 `net` si falta) por `psql --db-url` —NUNCA `supabase db push` (drift `schema_migrations` ≤0025)— con pgTAP verde y las RPC probadas en vivo. Es la precondición dura de todas las fases de datos: sin esto, la data poblada queda "código verde / pantalla vacía".
**Mode:** data-coverage (operador/gate)
**Depends on:** Phase 22 (v2.0). Primera fase de v3.0 — habilita la visibilidad de todo lo que sigue.
**Requirements:** OPS-01
**Success Criteria** (what must be TRUE):

  1. Las migraciones/RPC pendientes (0026, 0028, 0030) quedan aplicadas al Supabase remoto sa-east-1 por `psql "$SUPABASE_DB_URL" --single-transaction -v ON_ERROR_STOP=1 -f`, sin usar `supabase db push` (el drift `schema_migrations` ≤0025 se preserva)
  2. pgTAP corre VERDE contra el remoto para 0027/0029/0030 y SIN regresión en 0019/0020/0023/0026
  3. Un probe en vivo de las RPC confirma que `parlamentarios_publico()`, `votos_de_parlamentario(...)` (con titulo/idea_matriz/resultado/totales) y, si aplica, el modelo `net` responden con la firma esperada y sin filtrar PII
  4. Queda registrado que ninguna sección dependiente (lobby/patrimonio/votaciones/provenance) se considera "poblada" hasta que esta compuerta esté verde

**Plans:** 5 plans in 3 waves

Plans:

- [x] 54-01-PLAN.md — formatNombre() + aplicar a 11 superficies de nombres + tests + línea de tildes en metodología
- [x] 54-02-PLAN.md — microcopy "cómo leer esto" (cruces integra, rebeldías reubica, patrimonio agrega)
- [x] 54-03-PLAN.md — 3 tarjetas de entrada en el home (server, cero JS, fold 1280×800)
- [x] 54-04-PLAN.md — F-04 grafo móvil + botón /buscar petróleo + identity-warn @theme + skeletons anti-CLS + minors + F-05 diferido
- [x] 54-05-PLAN.md — gate de fase + redeploy final + smoke + docs/demo (≥6 screenshots)

### Phase 24: LOBBY — Fuente camara.cl/transparencia + spike de estructura

**Goal:** Ampliar la fuente del conector `@obs/lobby` a `camara.cl/transparencia/ley_de_lobby.aspx` —la fuente REAL de las audiencias de parlamentarios, ausentes de `leylobby.gob.cl`— validando primero la estructura de la página con un spike antes de cablear el crawl a escala. Doble causa raíz del lobby vacío (fuente + identidad); esta fase ataca la fuente.
**Mode:** data-coverage
**Depends on:** Phase 23 (esquema lobby aplicado al remoto). El conector `@obs/lobby` ya existe (Phase 11).
**Requirements:** LOBBY-01
**Success Criteria** (what must be TRUE):

  1. Un spike documenta la estructura real de `camara.cl/transparencia/ley_de_lobby.aspx` (campos de la audiencia, sujeto pasivo, contraparte, fecha, enlace) sobre páginas reales, antes de cablear el crawl
  2. El conector `@obs/lobby` queda ampliado para descubrir y descargar las audiencias desde esa fuente (allowlisted), respetando el rate-limit 2–3s LOCKED y persistiendo el crudo inmutable en R2 PRIMERO (Etapa 1)
  3. El drift de esta fuente es BLOQUEANTE (cuarentena, nunca filas silenciosas); una corrida acotada de prueba demuestra el camino fuente→R2 sin escribir aún a Supabase
  4. Queda registrada la cobertura esperada (qué parlamentarios/periodos cubre la fuente) y cualquier desviación frente a `leylobby.gob.cl`

**Plans:** 3 plans

Plans:

- [x] 62-01-PLAN.md — Layout radial ego-céntrico + cap 24 alfabético + "N vecinos más" + leyenda reescrita (RED-01, RED-02)
- [x] 62-02-PLAN.md — Fallback móvil lista de vecinos <768px + borde institucional por cámara + CSS (RED-02)
- [x] 62-03-PLAN.md — Loop BrowserOS: captura antes/después seed+no-seed × desktop+390px, deploy 61-02, veredicto "comprensible" (RED-03)

### Phase 25: LOBBY — Corrida LIVE + adjudicación de identidad + ficha poblada

**Goal:** Poblar la sección lobby de TODAS las fichas elegibles: ingerir las audiencias a escala desde el crudo en R2, adjudicar la identidad del sujeto pasivo por el pipeline de confirmación por nombre (auditado), y dejar que la ficha de un parlamentario con audiencias confirmadas muestre sus reuniones reales en vez del honest-state vacío. Esta fase también desbloquea las aristas del grafo NET.
**Mode:** data-coverage
**Depends on:** Phase 24 (fuente camara.cl cableada + crudo en R2)
**Requirements:** LOBBY-02, LOBBY-03, LOBBY-04
**Success Criteria** (what must be TRUE):

  1. Una corrida LIVE acotada ingiere las audiencias de lobby a escala (todos los parlamentarios elegibles) y escribe a la nube LEYENDO del crudo en R2 (Etapa 2), idempotente y reanudable
  2. El operador adjudica la identidad de las audiencias por el pipeline de confirmación por nombre: SOLO un match `determinista`/`confirmado` puebla el FK del sujeto pasivo; el resto queda `no_confirmado` + texto crudo, y cada decisión deja fila en `identidad_audit`
  3. El RPC `lobby_de_parlamentario` deja de devolver vacío para los parlamentarios con audiencias confirmadas
  4. El ciudadano ve, en la ficha de un parlamentario con audiencias confirmadas, sus reuniones de lobby reales (contraparte como texto crudo + provenance por fila), nunca enlazando la contraparte salvo identidad confirmada, sin componer la reunión con un voto

**Plans:** 3 plans (2 waves)

Plans:

**Wave 1**

- [x] 37-01-PLAN.md — Gate de presentacion crucesPublicEnabled (Candado B, server-only, fail-closed, espejo de money-gate) + tabla de verdad (SURF-01)
- [x] 37-02-PLAN.md — CrucesView (puro) + CrucesSection (Server Component, RPC cruces_de_parlamentario) + tipos del RPC + test RTL (empty-honesto/provenance/identidad/anti-insinuacion negative-match/conteo neutro) (SURF-01)

**Wave 2** *(blocked on Wave 1)*

- [x] 37-03-PLAN.md — Cablear <section id=cruces> gated (sibling mt-12, envuelta entera por el gate) + CrucesSkeleton en page.tsx + test de seccion-ausente (gate OFF) / presente (gate ON) (SURF-01)

**UI hint**: yes

### Phase 26: PAT — Patrimonio/intereses LIVE en la nube + ficha poblada

**Goal:** Poblar la sección patrimonio/intereses ejerciendo `@obs/probidad` (InfoProbidad) LIVE por parlamentario y escribiendo las declaraciones versionadas a la nube, de modo que el ciudadano vea declaraciones reales con su historial de versiones y fecha de presentación prominente en lugar del honest-state vacío.
**Mode:** data-coverage
**Depends on:** Phase 23 (esquema 0022 probidad aplicado). El conector `@obs/probidad` ya existe (Phase 12). Independiente de LOBBY/VOT.
**Requirements:** PAT-01, PAT-02
**Success Criteria** (what must be TRUE):

  1. Una corrida LIVE `@obs/probidad` ingiere las declaraciones de patrimonio e intereses por parlamentario y las escribe a la nube versionadas por `(fuente_id, fecha_presentacion)`, idempotente, con el crudo en R2 PRIMERO y atribución CC BY 4.0 visible
  2. La extracción de estos documentos PII pasa obligatoriamente por la compuerta `data-routing` (ningún RUT al LLM) y el drift de esta fuente PII es bloqueante (cuarentena, no degradación silenciosa)
  3. El ciudadano ve las declaraciones reales de un parlamentario con historial de versiones y fecha de presentación prominente (frescura ámbar si vieja), sin ningún veredicto de enriquecimiento ni de conflicto
  4. Una declaración vieja nunca se presenta como estado actual; los datos de familiares quedan deny-by-default, nunca expuestos

**Plans:** 3 plans (2 waves)

Plans:

**Wave 1**

- [x] 37-01-PLAN.md — Gate de presentacion crucesPublicEnabled (Candado B, server-only, fail-closed, espejo de money-gate) + tabla de verdad (SURF-01)
- [x] 37-02-PLAN.md — CrucesView (puro) + CrucesSection (Server Component, RPC cruces_de_parlamentario) + tipos del RPC + test RTL (empty-honesto/provenance/identidad/anti-insinuacion negative-match/conteo neutro) (SURF-01)

**Wave 2** *(blocked on Wave 1)*

- [x] 37-03-PLAN.md — Cablear <section id=cruces> gated (sibling mt-12, envuelta entera por el gate) + CrucesSkeleton en page.tsx + test de seccion-ausente (gate OFF) / presente (gate ON) (SURF-01)

**UI hint**: yes

### Phase 27: VOT — Ingesta masiva de votaciones + cobertura real en la ficha

**Goal:** Llevar la cobertura de votaciones de 2 boletines / 10 votaciones a escala de legislatura ejerciendo `@obs/votos` masivamente desde `opendata.camara.cl` (+ Senado donde aplique), con cruce determinista DIPID, de modo que las fichas muestren cobertura real con la guarda de identidad aplicada y la línea de cobertura honesta refleje el conjunto ampliado.
**Mode:** data-coverage
**Depends on:** Phase 23 (RPC 0028 votos_instructivos aplicado). El código `@obs/votos` + RPC ya validados (Phases 8/10/22). Independiente de LOBBY/PAT.
**Requirements:** VOT-01, VOT-02
**Success Criteria** (what must be TRUE):

  1. Una corrida masiva (escape hatch GitHub Actions o pgmq por lotes) ingiere votaciones desde `opendata.camara.cl` (`getVotaciones`/`getVotacion_Detalle`) a escala de legislatura, idempotente, rate-limit 2–3s LOCKED, con el crudo en R2 PRIMERO
  2. El cruce voto→parlamentario es determinista DIPID→`id_diputado_camara` sin LLM (Senado por nombre vía pipeline donde aplique); solo `determinista`/`confirmado` puebla `parlamentario_id`, el resto queda mención cruda
  3. El ciudadano ve, en las fichas, cobertura real de votaciones (muchos proyectos, no 2), con el desenlace factual de cada votación y la guarda de identidad aplicada
  4. La línea de cobertura honesta refleja el conjunto ampliado (deja de decir "solo 2 proyectos" cuando ya hay más); un vacío nunca se lee como "limpio"

**Plans:** 3 plans (2 waves)

Plans:

**Wave 1**

- [x] 37-01-PLAN.md — Gate de presentacion crucesPublicEnabled (Candado B, server-only, fail-closed, espejo de money-gate) + tabla de verdad (SURF-01)
- [x] 37-02-PLAN.md — CrucesView (puro) + CrucesSection (Server Component, RPC cruces_de_parlamentario) + tipos del RPC + test RTL (empty-honesto/provenance/identidad/anti-insinuacion negative-match/conteo neutro) (SURF-01)

**Wave 2** *(blocked on Wave 1)*

- [ ] 37-03-PLAN.md — Cablear <section id=cruces> gated (sibling mt-12, envuelta entera por el gate) + CrucesSkeleton en page.tsx + test de seccion-ausente (gate OFF) / presente (gate ON) (SURF-01)

**UI hint**: yes

### Phase 28: PROV — Provenance real de la maestra

**Goal:** Reemplazar "fuente desconocida" en el header de la ficha del parlamentario por la provenance real de la maestra: poblar el campo `origen` de cada fila de `parlamentario` con su fuente oficial (catálogo Cámara/Senado) y fecha de snapshot, de modo que cada dato del header lleve fuente/fecha/enlace conforme a la regla rectora.
**Mode:** data-coverage (ligera)
**Depends on:** Phase 23 (esquema remoto consistente). Independiente de LOBBY/PAT/VOT.
**Requirements:** PROV-01
**Success Criteria** (what must be TRUE):

  1. El campo `origen` de cada fila de `parlamentario` queda poblado con su fuente oficial (catálogo Cámara/Senado) y la fecha de snapshot, con provenance trazable a la fuente
  2. El header de la ficha del parlamentario muestra la provenance real (fuente/fecha/enlace) en lugar de "fuente desconocida"
  3. El poblamiento es idempotente y reconstruible desde el catálogo oficial; ninguna fila queda con provenance fabricada o genérica

**Plans:** TBD

### Phase 29: RUT — Backfill operador del RUT interno

**Goal:** Dotar a la maestra del `rut` interno de los parlamentarios enlazables para habilitar el cruce de contratos ChileCompra (MONEY), mediante un backfill de OPERADOR con adjudicación humana: poblar `parlamentario-rut.seed.json` con RUTs DV-válidos (módulo-11) + provenance por fila y correr `updateRut` por id — NUNCA fabricando un RUT. Un nombre único NO prueba propiedad del RUT.
**Mode:** data-coverage (operador / adjudicación humana)
**Depends on:** Phase 23. La máquina de backfill (`updateRut`, DV-gate) ya existe (Phase 9). Independiente de LOBBY/PAT/VOT.
**Requirements:** RUT-01
**Success Criteria** (what must be TRUE):

  1. El operador puebla `parlamentario-rut.seed.json` con RUTs DV-válidos (módulo-11) + provenance por fila; un RUT inválido o sin provenance va a revisión, nunca se escribe
  2. El backfill `updateRut` por id deja la maestra con el `rut` interno de los parlamentarios enlazables, deny-by-default (nunca legible por `anon`, nunca al LLM)
  3. La adjudicación distingue CORROBORACIÓN (solo cuando hay match confirmado) de CANDIDATO a revisión; un nombre único NO promueve un RUT; NUNCA se fabrica
  4. Queda registrado que el cruce MONEY queda habilitado por datos pero sigue gated hasta el sign-off legal F13 (Phase 30)

**Plans:** TBD

### Phase 30: SIGNOFF — Gate legal F13 (MONEY, Ley 21.719)

**Goal:** Obtener y registrar el sign-off legal humano F13 (`13-LEGAL-DOSSIER.md`, Ley 21.719) que es la condición para encender `MONEY_PUBLIC_ENABLED`. Acción humana, no código: el gate permanece en OFF hasta la firma. Depende de RUT-01 para que el cruce de contratos tenga datos cuando se encienda.
**Mode:** gate (acción humana / legal)
**Depends on:** Phase 29 (RUT-01 — el cruce MONEY necesita datos). Dossier de preparación ya existe (Phase 13).
**Requirements:** SIGNOFF-01
**Success Criteria** (what must be TRUE):

  1. El sign-off legal F13 (Ley 21.719) queda obtenido y registrado (YAML `signoff: approved` en `13-LEGAL-DOSSIER.md`), cubriendo republicación de datos públicos, datos sensibles y terceros privados
  2. Con la firma registrada, encender `MONEY_PUBLIC_ENABLED` queda habilitado como acción de operador; mientras no esté firmado, el gate sigue fail-closed (OFF) y ninguna ruta MONEY se expone
  3. Queda verificable por inspección que el cruce de contratos tiene datos (RUT-01 aplicado) antes de cualquier exposición pública de MONEY

**Plans:** TBD

### Phase 31: SIGNOFF — Gate legal F17 (NET)

**Goal:** Obtener y registrar el sign-off legal humano F17 (`17-LEGAL-DOSSIER.md`) que es la condición para encender `NET_PUBLIC_ENABLED`. Acción humana, no código: el gate permanece en OFF hasta la firma. Depende de LOBBY-03 (lobby confirmado) para que el grafo no esté vacío cuando se encienda.
**Mode:** gate (acción humana / legal)
**Depends on:** Phase 25 (LOBBY-03 confirmado — el grafo deriva de las aristas de lobby). Dossier de preparación ya existe (Phase 17).
**Requirements:** SIGNOFF-02
**Success Criteria** (what must be TRUE):

  1. El sign-off legal F17 queda obtenido y registrado (YAML `signoff: approved` en `17-LEGAL-DOSSIER.md`), cubriendo el framing descriptivo del grafo (sin lectura de acusación) y la propagación CC BY 4.0 a nodos derivados de InfoProbidad
  2. Con la firma registrada, encender `NET_PUBLIC_ENABLED` queda habilitado como acción de operador; mientras no esté firmado, el gate sigue fail-closed (OFF) y `/red` 404
  3. Queda verificable que el grafo NO está vacío (LOBBY-03 confirmado pobló aristas) antes de cualquier exposición pública de NET

**Plans:** TBD

### Phase 32: OPS — Redeploy + barrido de verificación en producción

**Goal:** Cerrar el milestone con un redeploy y un barrido de verificación en producción que confirme que las secciones pobladas (lobby, patrimonio, votaciones, provenance) muestran datos reales y que los invariantes rectores siguen intactos. Consumidor final de todas las fases de datos.
**Mode:** data-coverage (operador / verificación)
**Depends on:** Phases 25, 26, 27, 28 (data poblada) y 23 (esquema aplicado). SIGNOFF-01/02 informan el estado de los gates pero MONEY/NET pueden seguir OFF.
**Requirements:** OPS-02
**Success Criteria** (what must be TRUE):

  1. Un rebuild (Linux/Docker) + `wrangler deploy` deja en producción la versión que lee la data poblada de la nube
  2. Un barrido de verificación (browseros) confirma que la sección lobby de una ficha con audiencias confirmadas muestra reuniones reales, la de patrimonio muestra declaraciones reales, las votaciones muestran cobertura ampliada y el header muestra provenance real (ya no "fuente desconocida")
  3. Los invariantes siguen intactos en vivo: `noindex` presente, sin foto, sin partido, provenance por dato, MONEY/NET gated-OFF (salvo que su sign-off se haya encendido explícitamente), anti-insinuación (sin lenguaje causal, sin componer dinero/lobby con voto)
  4. Las brechas residuales (secciones aún honestamente vacías por cobertura de fuente) quedan documentadas como honest-state correcto, nunca como vacío silencioso

**Plans:** TBD

## Progress

| Phase | Milestone | Plans | Status | Completed |
|-------|-----------|-------|--------|-----------|
| 1. Framework Conectores + Almacenamiento + Orquestación | v1.0 | 3/3 | Complete | 2026-06-18 |
| 2. Capa Providers LLM/Embeddings | v1.0 | 3/3 | Complete | 2026-06-18 |
| 3. Maestra Parlamentario + Identidad Determinista | v1.0 | 4/4 | Complete | 2026-06-18 |
| 4. Adjudicación Identidad + Compuerta Humana + Golden Set | v1.0 | 3/3 | Complete | 2026-06-18 |
| 5. Tramitación Core — Ficha + Timeline + Votaciones | v1.0 | 5/5 | Complete | 2026-06-18 |
| 6. Citaciones + Tabla Semanal de Sala | v1.0 | 4/4 | Complete | 2026-06-18 |
| 7. Búsqueda Semántica + Fichas Estructuradas | v1.0 | 3/3 | Complete | 2026-06-18 |
| 8. VOTE Spike — Validación `opendata.camara.cl` | v2.0 | 1/1 | ✅ Complete (CONFIRMAR) | 08-01 |
| 9. Completitud de Identidad — RUT + Writer-invariant + Piso PII | v2.0 | 3/3 | Complete   | 2026-06-19 |
| 10. VOTE — Voto individual en la ficha | v2.0 | 3/3 | Complete   | 2026-06-19 |
| 11. INT Lobby — Reuniones + sub-maestra contrapartes | v2.0 | 3/3 | Complete   | 2026-06-19 |
| 12. INT Patrimonio/Intereses — Declaraciones + comparación | v2.0 | 3/3 | Complete   | 2026-06-19 |
| 13. Compuerta Legal — Bloque MONEY | v2.0 | 2/2 | Complete   | 2026-06-19 |
| 14. MONEY Contratos — ChileCompra + sub-maestra contratistas | v2.0 | 0/3 | Planned | - |
| 15. MONEY Financiamiento — SERVEL + sub-maestra donantes | v2.0 | 0/? | Not started | - |
| 16. MONEY Agregación — por contraparte | v2.0 | 0/? | Not started | - |
| 17. Compuerta Legal — Bloque NET | v2.0 | 1/1 | Dossier listo · sign-off F17 pendiente | 2026-06-21 |
| 18. NET — Grafo de influencia | v2.0 | 4/4 | Complete (gated-OFF) | 2026-06-21 |
| 19. Producto + Diseño — Brief y cierre de diseño | v2.0 | 5/5 | Complete   | 2026-06-20 |
| 20. Deploy + Carga de Datos — Preview gov-map.com | v2.0 | 6/6 | Complete   | 2026-06-20 |
| 21. Producto en vivo — Diseño Phase 19 + directorio + ideas matrices | v2.0 | 4/4 | Complete   | 2026-06-20 |
| 22. Votaciones instructivas — qué votó cada uno y para qué | v2.0 | 4/4 | Complete   | 2026-06-21 |
| 23. OPS — Aplicar migraciones remotas + pgTAP verde | v3.0 | 0/? | Not started | - |
| 24. LOBBY — Fuente camara.cl/transparencia + spike | v3.0 | 0/? | Not started | - |
| 25. LOBBY — Corrida LIVE + adjudicación identidad + ficha | v3.0 | 0/? | Not started | - |
| 26. PAT — Patrimonio/intereses LIVE + ficha | v3.0 | 0/? | Not started | - |
| 27. VOT — Ingesta masiva de votaciones + ficha | v3.0 | 0/? | Not started | - |
| 28. PROV — Provenance real de la maestra | v3.0 | 0/? | Not started | - |
| 29. RUT — Backfill operador del RUT interno | v3.0 | 0/? | Not started | - |
| 30. SIGNOFF — Gate legal F13 (MONEY) | v3.0 | 0/? | Not started | - |
| 31. SIGNOFF — Gate legal F17 (NET) | v3.0 | 0/? | Not started | - |
| 32. OPS — Redeploy + barrido de verificación producción | v3.0 | 0/? | Not started | - |
| 33. INFRA — Desbloqueo de CI (loadEnv CI-safe) | v4.0 | 1/1 | Complete (quick 260623-rtl) | 2026-06-24 |
| 34. INGEST — Ingesta lobby + probidad programada | v4.0 | 0/? | Not started | - |
| 35. ENT — Resolución de identidades de terceros | v4.0 | 7/7 | Complete (gaps 35-05/06/07 cerrados; pgTAP 0034/35/36/37 verdes en PROD; ENT-01..05 SATISFIED) | 2026-06-24 |
| 36. CRUCE — Capa de cruces parlamentario↔sector (deny-by-default) | v4.0 | 4/4 | Complete   | 2026-06-24 |
| 37. SURF — Cruces en ficha de parlamentario (gated) | v4.0 | 3/3 | Complete    | 2026-06-24 |
| 38. SURF — Cruces en ficha de proyecto (DESTRABADA: sign-off señales-voto 2026-07-07) | v4.0 | 3/3 | Complete   | 2026-07-08 |
| 39. LEGAL — Gate legal F13/F17/cruces (sign-off humano) | v4.0 | 0/? | Not started | - |
| 40. RUTM — RUT-01 + ChileCompra/SERVEL (diferido, needs-human) | v4.0 | 0/? | Not started | - |
| 41. CRUCEN — Habilitación de cruces (grant gated + dossier) | v4.0 | 3/3 | Complete (encendido 2026-06-24) | 2026-06-24 |
| 42. LOCKDOWN — API Supabase rol web_reader | v4.0 | 4/4 | Complete (cutover Camino A aplicado a PROD) | 2026-06-26 |
| 43. DEBT — Eliminación de deuda técnica (exhaustiva) | v4.0 | — | Complete (24 FIX-NOW; suite 316→341) | 2026-06-24 |
| 44. LEG — Auditoría UX + inventario + plan (v5) | v5.0 | 3/3 | Complete (UI-SPEC + auditoría + inventario) | 2026-06-26 |
| 45. LEG — Navegación: acordeones por carril + resumen above-fold | v5.0 | 3/3 | Complete   | 2026-06-26 |
| 46. VIZ — Chart patrimonio (conteo de ítems/año) | v5.0 | 2/2 | Complete (deploy 2026-07-02) | 2026-07-02 |
| 47. VIZ — Chart votos/ausencias | v5.0 | 2/2 | Complete   | 2026-07-08 |
| 48. VIZ — Autoría + similares-del-parlamentario | v5.0 | 0/? | **DIFERIDA a milestone de ingesta** (decisión operador 2026-07-08; gated por autores 0/136, gap de DATOS no de UI) | 2026-07-08 |
| 49. VIZ — Comparativo vs cámara (ausencias/actividad) | v5.0 | 3/3 | Complete   | 2026-07-08 |
| 50. FIX — Quick wins diagnóstico (P1) | v5.0 | 4/4 | Complete | 2026-07-02 |
| 51. LEG2 — Legibilidad profunda (P2) | v5.0 | 7/7 | Complete | 2026-07-03 |
| 52. CRUCE2 — Cruces nuevos (P3) | v5.0 | 6/6 | Complete (deploy ee6b7544) | 2026-07-06 |
| 53. UXNAV — Auditoría UX navegada (BrowserOS) + fixes P0 | v5.0 | 5/5 | Complete    | 2026-07-07 |
| 54. UXDEMO — Pulido presentacional demo | v5.0 | 5/5 | Complete   | 2026-07-07 |
| 55. UXCOG — Rediseño cognitivo: jerarquía visual + detalle progresivo | v5.0 | 6/6 | Complete (`74e3ad0f`) | 2026-07-08 |
| 56. CRON-AUDIT — Auditoría E2E de los 9 workflows de ingesta | v6.0 | 1/1 | Complete   | 2026-07-08 |
| 57. CRON-FIX — Hardening dos-etapas + hash-check + crons verdes | v6.0 | 4/4 | Complete   | 2026-07-09 |
| 58. CRON-FRESH — Monitoreo de frescura por fuente | v6.0 | 1/1 | Complete   | 2026-07-09 |
| 59. AUTOR — Autoría ingest + ficha de proyecto (F48) | v6.0 | 3/3 | Complete   | 2026-07-09 |
| 60. BRAND — Ícono/identidad visual gov-map | v6.0 | 1/1 | Complete   | 2026-07-09 |
| 61. COMP — Comprensión de visualizaciones (loop BrowserOS) | v6.0 | 4/4 | Complete   | 2026-07-09 |
| 62. RED — /red ego-network radial legible | v6.1 | 4/4 | Complete   | 2026-07-11 |
| 63. BUSQ — Búsqueda sobre corpus completo declarado | v6.1 | 3/3 | Complete   | 2026-07-11 |
| 64. VOTO P3a — Validar/caracterizar opendata.camara.cl LIVE (SPIKE) | v7.0 | 2/2 | Complete   | 2026-07-14 |
| 65. VOTO P3b — Golden set DIPID→maestra (gate pre-backfill) | v7.0 | 1/1 | Complete   | 2026-07-14 |
| 66. VOTO P3c — Wire dos-etapas Cámara + backfill a escala | v7.0 | 2/2 | Complete   | 2026-07-14 |
| 67. VOTO P3d — Paridad Senado (voto individual por nombre) | v7.0 | 0/? | Not started | - |
| 68. VOTO P3e — Superficies de voto + linter + cobertura + BrowserOS | v7.0 | 0/? | Not started | - |
| 69. DINERO P5a — RUT-01 backfill (checkpoint operador, bloqueante) | v7.0 | 0/? | Not started | - |
| 70. DINERO P5b — Wire dos-etapas ChileCompra por RUT (SPIKE cuota) | v7.0 | 0/? | Not started | - |
| 71. DINERO P5c — SERVEL LOCAL (.xlsx artesanal) | v7.0 | 0/? | Not started | - |
| 72. DINERO P5d — Extender materializador cruce_senal (lobby_sector_aporte) | v7.0 | 0/? | Not started | - |
| 73. DINERO P5e — Superficies MONEY gated OFF + linter + gate legal | v7.0 | 0/? | Not started | - |
| 74. DEUDA — Cursor leylobby + CF token CI + round-robin cron | v7.0 | 0/? | Not started | - |
| 75. DEUDA — Typography .net-* + rotar DB password (operador) | v7.0 | 0/? | Not started | - |

## ✅ v4.0 — De datos a cruces verificables

**Mode:** data-coverage + capability (milestone BROWNFIELD/cruces — transcripción del diseño LOCKED `.planning/MILESTONE-v4-cruces.md`, validado por Opus. v4 construye los cimientos de datos e identidad de terceros, luego la capa derivada de cruces parlamentario↔sector, luego las superficies de ficha — todo deny-by-default. Nada sensible se enciende sin firma humana.)
**Granularity:** fine
**Milestone:** v4.0 — De datos a cruces verificables y publicables (cruzar lobby, financiamiento y votos por parlamentario y sector, con trazabilidad y sin causalidad)
**Numbering:** continúa desde v3.0 — Phase 32 fue la última de v3.0; v4.0 arranca en **Phase 33** (no reset).

> **Fuente de verdad:** `.planning/MILESTONE-v4-cruces.md` (Fases 0–5 con WHAT/WHY/REPO TARGETS/KEY NOTES/DEPENDS-ON/EFFORT/AUTONOMY/ACCEPTANCE por sub-fase). Este roadmap es la transcripción a numeración continua — NO re-diseña ni cambia el alcance ni el orden.

### Coverage

- v4.0 requirements: 22 (INFRA 1, INGEST 4, ENT 5, CRUCE 3, SURF 2, CRUCEN 3, LEGAL 1, RUTM 3)
- Mapped to phases: 22/22 ✓
- Orphaned: 0 · Duplicated: 0
- Nota: CRUCEN (3) es deuda destapada por el code-review de Phase 37 → Phase 41 (añadida 2026-06-24).

### Mapeo Fase-doc → Phase-roadmap (LOCKED)

| Phase | Fase (doc) | Requisitos | Autonomy |
|-------|-----------|------------|----------|
| 33 | Fase 0 — Desbloqueo de CI | INFRA-01 | autónomo ✅ DONE |
| 34 | Fase 1.1 — Ingesta lobby + probidad programada | INGEST-01..04 | autónomo (build/dry-run) · needs-human-checkpoint (LIVE) |
| 35 | Fase 1.2 — Resolución de identidades de terceros | ENT-01..05 | autónomo (tablas/matcher/pipeline) · needs-human-checkpoint (matches dudosos) |
| 36 | Fase 2.1 — Capa de cruces parlamentario↔sector | CRUCE-01..03 | autónomo deny-by-default · needs-legal-signoff (grant anon / encender) |
| 37 | Fase 3.1 — Superficie de cruces en ficha de parlamentario | SURF-01 | autónomo (build) · needs-legal-signoff (encender) |
| 38 | Fase 3.2 — Superficie de cruces en ficha de proyecto | SURF-02 | needs-legal-signoff (diferido si señales de voto OFF) |
| 39 | Fase 4.1 — Gate legal F13/F17/cruces | LEGAL-01 | needs-legal-signoff (exclusivamente humano) |
| 40 | Fase 5.1 — RUT-01 + ChileCompra/SERVEL | RUTM-01..03 | needs-human-checkpoint (RUT/ticket/URL) · exposición needs-legal-signoff |
| 41 | 3/3 | Complete   | 2026-06-24 |

### Insight de ruta crítica (LOCKED)

```
INFRA-01 desbloqueo CI (Phase 33, ✅ DONE) — sin esto ningún workflow programado corre
   │
   ├──► INGESTA lobby+probidad (Phase 34, #1 slice) ──────────┐  (cimiento de datos)
   │                                                          │
   └──► ENTITY-RESOLUTION de terceros (Phase 35, #3) ─────────┤  (cimiento de identidad)
                                                              ▼
                          CRUCES parlamentario↔sector (Phase 36, #2, deny-by-default)
                                                              ▼
                    ┌─────────────────────────────────────────┴───────────────┐
                    ▼                                                          ▼
   SUPERFICIE ficha parlamentario (Phase 37, #6, gated OFF)   SUPERFICIE ficha proyecto (Phase 38, #8, gated/diferido)
                    │                                                          │
                    └──────────────────────► GATE LEGAL F13/F17/cruces (Phase 39, #10) ◄──── atraviesa TODO; controla la exposición
                                                              │
                                          RUT-01 + ChileCompra/SERVEL (Phase 40, #1 resto, diferido) — gateado por RUT-01 (prerrequisito duro) + F13
```

**Gates LOCKED transversales:** (a) Phase 36 `cruce_senal` deny-by-default, RPC SIN grant a anon hasta firma; (b) Phases 37/38 detrás de `crucesPublicEnabled()` default OFF; (c) Phase 39 = firma humana exclusiva — **un agente NUNCA flipea un flag `*_PUBLIC_ENABLED`**; (d) las señales de voto (`lobby_sector_voto`/`aporte_sector_voto`) y la Phase 38 se DIFIEREN hasta sign-off explícito (17-LEGAL-DOSSIER §2, anti-insinuación); (e) Phase 40 bloqueada por RUT-01 (prerrequisito duro no resuelto) + ticket/URL de operador.

**Reglas LOCKED que enmarcan todas las fases:** ingesta en DOS ETAPAS (fuente→R2 crudo vía `SnapshotWriter`/`source_snapshot`, luego R2→Supabase, re-ejecutable independiente); rate-limit 2–3s/host; RUT NUNCA al LLM (`assertNoRutInLlmInput`); personas jurídicas se identifican SOLO por RUT exacto (sin LLM, fail-closed); terceros deny-by-default; RPCs públicos jamás proyectan rut/partido/email/donante_id; señales de cruce = conteos factuales (nunca scores de correlación), linter de texto prohíbe vocabulario causal/insinuante; migraciones por `psql --db-url --single-transaction` + fila en `schema_migrations` (NUNCA `db push`); pgTAP única prueba válida.

### Phases (v4.0)

- [x] **Phase 33: INFRA — Desbloqueo de CI (loadEnv CI-safe)** - Parchar los CLIs estrella de lobby/probidad para cargar credenciales con fallback a `process.env` (no solo `.env` en disco) → corren en GitHub Actions sin `.env`. ✅ COMPLETA (quick task 260623-rtl, commits 1844b2f/399e3e2)
- [x] **Phase 34: INGEST — Ingesta lobby + probidad programada** - Wire de los conectores ETL ya completos (lobby Cámara + LeyLobby, probidad InfoProbidad) a workflows recurrentes de GitHub Actions + paso R2 crudo faltante en probidad vía `SnapshotWriter`. NO programa ChileCompra/SERVEL. NO toca `MONEY_PUBLIC_ENABLED`. ✅ build autónomo + dry-run verificados (3/3 plans, 9 commits, tests verdes); LIVE = checkpoint operador pendiente.
- [x] **Phase 35: ENT — Resolución de identidades de terceros** - Maestra `entidad_tercero` (ID estable, alias, matcher determinista, pipeline de adjudicación con gate humano, deny-by-default) que extiende el subsistema de identidad a donantes/proveedores y gestores de lobby; conecta los reconciliadores existentes (antes dejaban `contraparte_id`/`contratista` NULL). (completed 2026-06-24)
- [x] **Phase 36: CRUCE — Capa de cruces parlamentario↔sector (deny-by-default)** - Modelar relaciones parlamentario↔sector cruzando lobby/aportes/votos; materializar señales factuales (conteos de evidencia, sin score); etiquetado de sector por LLM con su propio eval/golden SEPARADO. Construible deny-by-default; expuesto solo tras gate legal. (completed 2026-06-24)
- [x] **Phase 37: SURF — Superficie de cruces en ficha de parlamentario (gated)** - `CrucesSection` (Server Component) que llama al RPC y renderiza señales factuales con provenance inline, sibling de `#lobby`/`#patrimonio`, detrás de `crucesPublicEnabled()` (default OFF). Construible; visible solo tras gate. (completed 2026-06-24)
- [x] **Phase 38: SURF — Superficie de cruces en ficha de proyecto (DESTRABADA 2026-07-07)** - `cruces_de_proyecto(boletin)` → parlamentarios que votaron a favor con cruces en el sector del proyecto, PII-safe, mismo gate. Sign-off de señales de voto FIRMADO 2026-07-07 (Carlos Sánchez Rossi, `docs/legal/SIGNOFF-senales-voto.md`) → construible y publicable bajo caveat anti-causal. (completed 2026-07-08)
- [ ] **Phase 39: LEGAL — Gate legal transversal F13/F17/cruces (sign-off humano)** - Revisión legal humana (Ley 21.719) que habilita `MONEY_PUBLIC_ENABLED`, `netPublicEnabled` y `crucesPublicEnabled`. Acción exclusivamente humana — un agente NUNCA flipea estos flags. PARCIALES firmados: cruces (dossier 41, 2026-06-24), señales-voto/SURF-02 (2026-07-07, `docs/legal/SIGNOFF-senales-voto.md`). Pendientes: F13/MONEY y cierre formal F17/NET.
- [ ] **Phase 40: RUTM — RUT-01 + ChileCompra/SERVEL (diferido, needs-human)** - Cosecha de RUT a la maestra; wire real de ChileCompra (hoy CLI demo) + workflow; workflow manual SERVEL por elección. Bloqueado por RUT-01 (prerrequisito duro) + ticket/URL de operador; exposición pública requiere LEGAL-01.
- [x] **Phase 41: CRUCEN — Habilitación de cruces (grant gated + dossier + fecha_captura)** - Cierra las 3 deudas del code-review de Phase 37 para dejar la superficie de cruces LISTA para firmar/encender (sin encenderla): fix WR-02 (proyectar `cruce_senal.fecha_captura` en el RPC → frescura honesta, migración aplicable ya), migración de grant del RPC a anon ESCRITA pero NO aplicada (deny-by-default hasta sign-off), y dossier legal de cruces (prep para firma humana, espejo F17). CERO flip de flag. (completed 2026-06-24) — ENCENDIDO 2026-06-24: dossier firmado + 0041/0042 aplicadas a PROD.
- [x] **Phase 42: LOCKDOWN — Cierre de la API pública de Supabase (rol `web_reader`)** - Eliminar la superficie de API pública (rol `anon`): el servidor de la página lee como un rol dedicado de mínimo privilegio `web_reader` (NO service_role — preserva RLS/PII), y se revocan TODOS los grants de `anon`/`authenticated`. Tras el cambio la anon key es inútil para extraer datos; todo se sirve solo a través de la página. Motivada por el temor a uso indiscriminado de la API tras el encendido de cruces. (added 2026-06-24) — **WRITE-COMPLETE 2026-06-24 (verifier PASS 4/4, suite 316); cutover EJECUTADO 2026-06-26 (Camino A: anon REST muerta 401/42501, sitio lee service_role, web_reader dropeado — supersede el diseño web_reader; ver memoria camino-a-post-legacy-cutover).**
- [x] **Phase 43: DEBT — Eliminación de deuda técnica (exhaustiva, premortem swarm + Opus 1-a-1)** - ✅ COMPLETE 2026-06-24: ~71 hallazgos → Opus 1-a-1 → 24 FIX-NOW (21 commits), 11 checkpoints operador, 23 won't-fix/falso-pos. Suite 316→341 verde, tsc limpio, dinero un-darkened (0→97), migración 0045 escrita (apply=operador). Cero regresión. Ledger: `43-DEBT-LEDGER.md`. (added 2026-06-24)

## Phase Details (v4.0)

### Phase 33: INFRA — Desbloqueo de CI (loadEnv CI-safe)

**Goal:** Desbloquear cualquier workflow programado de ingesta parchando los CLIs estrella de lobby y probidad para que carguen credenciales con fallback a `process.env`, no solo desde `.env` en disco — sin esto, toda la Fase 1 muere con ENOENT antes del primer fetch en GitHub Actions. Blocker transversal barato que desbloquea todo lo demás.
**Mode:** infra (blocker transversal)
**Depends on:** ninguno (primera fase de v4.0; arranca tras Phase 32 de v3.0).
**Requirements:** INFRA-01
**Autonomy:** autónomo
**Success Criteria** (what must be TRUE):

  1. `run-camara-lobby-cli.ts` y `run-probidad-todos-cli.ts` cargan credenciales con `process.env` tomando precedencia y fallback al `.env` en disco (patrón de `run-agenda-prod-cli.ts`: wrap del read en try/catch), backwards-compatible (local sigue leyendo `.env`)
  2. Los CLIs corren en un entorno sin `.env` cuando las vars están en `process.env` (no más ENOENT antes del primer fetch)
  3. `pnpm test` queda verde

**Status:** ✅ COMPLETA — ejecutada como quick task **260623-rtl** (2026-06-24, commits 1844b2f/399e3e2): loadEnv CI-safe en `run-camara-lobby-cli` + `run-probidad-todos-cli` (fallback a `process.env`). Desbloquea los workflows lobby/probidad de Phase 34.

**Plans:** N/A (quick task)

### Phase 34: INGEST — Ingesta lobby + probidad programada

**Goal:** Poner a correr de forma recurrente los conectores ETL ya completos de lobby (Cámara + LeyLobby) y patrimonio/InfoProbidad — que existen completos (writers reales, reconciliación de identidad) pero nunca fueron programados — cableándolos a workflows de GitHub Actions y añadiendo el paso R2 crudo faltante en probidad. El slice shippable HOY es solo lobby + probidad (cruzan por nombre, sin RUT); ChileCompra/SERVEL quedan diferidos a Phase 40 tras RUT-01, y `MONEY_PUBLIC_ENABLED` NO se toca.
**Mode:** data-coverage
**Depends on:** Phase 33 (loadEnv CI-safe — sin esto los workflows mueren con ENOENT).
**Requirements:** INGEST-01, INGEST-02, INGEST-03, INGEST-04
**Autonomy:** autónomo para construir + correr en dry-run; **needs-human-checkpoint** para encender LIVE (secrets del operador: `R2_*`, ya en `agenda-weekly.yml`).
**Success Criteria** (what must be TRUE):

  1. El workflow `lobby-camara-weekly` corre en dispatch manual, pasa el WAF de camara.cl vía `curl -A 'Bot-Ciudadano/1.0'` (fail si respuesta < 10 KB) con `--html-file`, loguea `audiencias=N>0` y escribe `lobby_audiencia` con `estado_vinculo='confirmado'` para los matches deterministas (INGEST-01)
  2. El workflow `lobby-leylobby-weekly` (solo instituciones del ejecutivo; Cámara/Senado NO publican en leylobby.gob.cl) loguea `audiencias=N>0` o degrada honesto con `LeylobbyBloqueadaError` (INGEST-02)
  3. El workflow `probidad-weekly` corre las ~155–200 consultas SPARQL (rate-limit 3s, dentro de límites GH ≈6–10 min), loguea `declaraciones/bienes/confirmados>0` y escribe filas `declaracion` con `parlamentario_id` no nulo (INGEST-03)
  4. Tras un run LIVE, `source_snapshot` (tabla existente, migración 0002) tiene una fila por run con `r2_path` poblado vía `SnapshotWriter` — NO un `crudo_r2_key` paralelo sobre tablas per-parlamentario; incluye el bloque R2 crudo faltante en `run-probidad-todos.ts` (espejo de `run-camara-lobby.ts` L88–105, best-effort try/catch) (INGEST-04)
  5. `pnpm test` queda verde

**Plans:** 3 plans (2 waves) — ✅ EJECUTADAS (build autónomo + dry-run verificados; LIVE = checkpoint operador pendiente)

Plans:

- [x] 34-01-PLAN.md — SupabaseSnapshotStore Node-side (gap de API; SnapshotStore reusable, 23505 idempotente) exportado desde @obs/ingest (INGEST-04) — commits b51038a/b0c8693/de39d67
- [x] 34-02-PLAN.md — Bloque R2 Etapa-1 + SnapshotWriter en run-probidad-todos (crudo agregado por run + fila source_snapshot) + wire R2Store/SnapshotWriter en el CLI (INGEST-04) — commits 149ef8c/7b8d9d4/8b7920b
- [x] 34-03-PLAN.md — 3 workflows GitHub Actions: lobby-camara-weekly (curl anti-WAF + --html-file), lobby-leylobby-weekly (env names divergentes + assert acepta degradacion), probidad-weekly (SPARQL + R2_*) (INGEST-01/02/03) — commits d369f7d/5518f3b/6cdd7ce

**Status:** ✅ build autónomo COMPLETO y verificado (34-VERIFICATION.md: 5/5 in-scope; ingest 63/63, probidad 46/46, root `pnpm test` verde; cero DDL; cero `${{}}` en `run:`). **Checkpoint operador (needs-human):** encender los 3 workflows LIVE = cargar/confirmar secrets `SUPABASE_*`+`R2_*` en Cuchecorp/gov-map (no se transfieren entre repos) y correr `workflow_dispatch`. Tras run LIVE: SC1 `audiencias>0`, SC3 `declaraciones>0`, SC4 fila `source_snapshot` con `r2_path`.

### Phase 35: ENT — Resolución de identidades de terceros

**Goal:** Extender el subsistema de identidad (hoy solo parlamentarios) a (A) donantes/proveedores con RUT y (B) gestores/contrapartes de lobby, creando la maestra `entidad_tercero` con ID estable, alias, matcher determinista, pipeline de adjudicación con gate humano y conexión de los reconciliadores existentes — que hoy dejan `lobby_contraparte.contraparte_id` y `contratista` NULL por falta de maestra de terceros, lo que haría que los cruces contaran entidades duplicadas o incorrectas. Prerrequisito de la corrección de la capa de cruces.
**Mode:** capability (identidad)
**Depends on:** ninguno duro (extiende el andamiaje existente). Conviene tras Phase 34 para tener contrapartes pobladas que resolver.
**Requirements:** ENT-01, ENT-02, ENT-03, ENT-04, ENT-05
**Autonomy:** autónomo para construir tablas/matcher/pipeline; **needs-human-checkpoint** para la revisión de matches dudosos (cola `revision_entidad` → revisor humano vía RPC `resolver_entidad`). Ningún match dudoso se promueve a `confirmado` sin humano.
**Success Criteria** (what must be TRUE):

  1. Existe la maestra `entidad_tercero` (+ `entidad_tercero_alias`, sequence `entidad_id_seq`, trigger anti-demotion espejo de 0007/0012) y las tablas `vinculo_entidad` + `revision_entidad` (espejo de `revision_identidad`), con RLS deny-by-default en las 3 tablas nuevas, aplicadas por `psql --db-url` con pgTAP verde (ENT-01)
  2. `matchDeterministaEntidad` confirma por RUT-único o nombre-único-por-tipo; toda ambigüedad → `no_confirmado` (fail-closed, ≥10 tests). Personas jurídicas: SOLO por RUT exacto, nombre-sin-RUT → siempre `no_confirmado` (nunca LLM). Persona natural usa LLM solo ante homónimos, con `assertNoRutInLlmInput` sobre el prompt (el test falla si un RUT se cuela al prompt) (ENT-02)
  3. `reconciliar-sujeto.ts` puebla `lobby_contraparte.contraparte_id` confirmado (antes siempre null) y `reconciliar-contrato.ts` puebla `contratista.entidad_id`, vía RPC transaccional `resolver_entidad` (espejo de 0015) (ENT-03)
  4. Los matches dudosos van a la cola `revision_entidad` (estado `pendiente`); ningún match dudoso se promueve a `confirmado` sin revisor humano vía RPC `resolver_entidad`; UI admin protegida `revisar-entidades` (ENT-04)
  5. El backfill de entidades es LOCAL (operador), idempotente/reanudable: una 2ª corrida produce 0 entidades/vínculos nuevos; la maestra se exporta a JSON fuera de Supabase (custodia, espejo de `backup.ts`) (ENT-05)

**Plans:** 7 plans (35-05/06/07 = gap-closure + apply PROD)

Plans:

**Wave 1**

- [x] 35-01-PLAN.md — Migraciones 0034/0035/0036 + 3 pgTAP (maestra entidad_tercero + vinculo/revision + FK/RPC resolver_entidad, deny-by-default); apply a PROD = checkpoint operador (ENT-01/03/04)
- [x] 35-02-PLAN.md — @obs/identity: matchDeterministaEntidad (juridica-solo-RUT) + EnlaceEntidadConfirmado + writer/seeder idempotente + backup JSON + backfill-cli LOCAL (ENT-02/05)
- [x] 35-05-PLAN.md — GAP-CLOSURE: indice unico TOTAL entidad_tercero_clave_natural (cierra CR-01/42P10) + pgTAP (no-parcial + 23505) + docstring fix; apply 0034(fijada)/0035/0036 a PROD = checkpoint operador (ENT-01/05) — destapó Issues 1/2 → 35-06/07
- [x] 35-06-PLAN.md — GAP-CLOSURE Issue 1: forward-fix migración 0037 (identidad_audit.vinculo_entidad_id FK→vinculo_entidad + CHECK num_nonnulls<=1 + CREATE OR REPLACE resolver_entidad); aplicada a PROD, pgTAP 0037 12/12 + 0036 15/15 (ENT-03/04)
- [x] 35-07-PLAN.md — GAP-CLOSURE Issue 2: +2 asserts reales a 0035 pgTAP (force-RLS asimetría + anon NO INSERT); 0035 18/18 verde en PROD → cierra ENT-01

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 35-03-PLAN.md — @obs/adjudication: pipeline-entidad (juridica salta LLM) + prompt-entidad + writer-revision-entidad + revisor-cli; gate RUT + UMBRAL 0.9 (ENT-02/04)
- [x] 35-04-PLAN.md — Reconciliadores (reconciliar-sujeto -> contraparte_id; reconciliar-contrato -> contratista.entidad_id) + UI admin revisar-entidades protegida (ENT-03/04)

### Phase 36: CRUCE — Capa de cruces parlamentario↔sector (deny-by-default)

**Goal:** Construir el valor diferenciador del producto — la capa que CRUZA los carriles — modelando relaciones explícitas parlamentario↔sector sobre lobby, aportes y votos, materializando señales factuales (conteos de evidencia, nunca un score de correlación) y exponiéndolas SOLO tras gate legal. Es el dato de mayor impacto reputacional: se construye entero deny-by-default, con el etiquetado de sector por LLM gobernado por su propio eval/golden SEPARADO del flujo de extracción literal.
**Mode:** capability (cruces, deny-by-default)
**Depends on:** Phase 34 (lobby confirmado), Phase 35 (entidades resueltas para sector de donante/contraparte). Phase 39 para publicar.
**Requirements:** CRUCE-01, CRUCE-02, CRUCE-03
**Autonomy:** autónomo para tablas/materializador/CLI/eval **deny-by-default**; **needs-legal-signoff** para grant del RPC a anon y encender `crucesPublicEnabled()`. Las señales de voto requieren sign-off adicional vs 17-LEGAL-DOSSIER §2.
**Success Criteria** (what must be TRUE):

  1. Existe el catálogo `sector` (public-read) + `sector_id` en `proyecto_ficha`, `lobby_contraparte` y `donante`; la tabla `cruce_senal` (deny-by-default, fila única parlamentario+sector+evidencia jsonb — NO espejo de `arista`); el materializador `materializar_cruces()` (security definer, `search_path=''`, pg_cron con offset ~`23 3 * * *`); y el RPC `cruces_de_parlamentario` SIN grant a anon hasta firma. Migraciones por `psql --db-url`; pgTAP: `sector` public-read, `cruce_senal` deny-by-default, el cuerpo del materializador no referencia partido ni RUT (CRUCE-01)
  2. El etiquetado de sector usa un schema/pipeline/golden SEPARADO del flujo de extracción literal (clasificar a taxonomía cerrada es imputación, no extracción literal — rompería SEM-02); la clasificación corre en un CLI batch de `@obs/cruces` (etapa derivada), NUNCA por fila dentro del writer; sensibilidad LLM correcta para contrapartes (no `sensitivity:'public'`, Ley 21.719 / FND-06). CLI `--dry-run` sobre 10 proyectos: ≥7 con `sector_id` no nulo medido contra su propio golden (CRUCE-02)
  3. Tras materializar con los datos de lobby actuales, `cruce_senal` tiene ≥1 fila `lobby_sector_aporte` para ≥5 parlamentarios; las señales derivadas de voto (`lobby_sector_voto`/`aporte_sector_voto`) arrancan OFF (chocan con 17-LEGAL-DOSSIER §2) hasta sign-off explícito; wording factual obligatorio ("N reuniones con gestores del sector X", sin verbo causal); el RPC nunca proyecta rut/partido/email/donante_id (pgTAP). Con `crucesPublicEnabled()=false` la sección no monta (CRUCE-03)

**Plans:** 4/4 plans complete

- [x] 36-01-PLAN.md — Migraciones 0038/0039/0040 (sector public-read + cruce_senal deny-by-default + materializar_cruces + RPC sin grant a anon) + pgTAP (CRUCE-01/03)
- [x] 36-02-PLAN.md — @obs/cruces: sector.ts (taxonomía) + model.ts (zod cerrado/abstención) + clasificar.ts (gate RUT first, split DeepSeek/MiniMax) + RUT-gate test (CRUCE-02)
- [x] 36-03-PLAN.md — CLIs batch (fichas DeepSeek / lobby MiniMax) + writer service-role (sin LLM) + golden top-1/abstención gate ≥7/10 (CRUCE-02)
- [x] 36-04-PLAN.md — [BLOCKING] aplicar migraciones psql --db-url + pgTAP verde + corrida LIVE clasificar lobby + materializar → ≥5 parlamentarios (CRUCE-01/02/03)

### Phase 37: SURF — Superficie de cruces en ficha de parlamentario (gated)

**Goal:** Dejar construida (pero no encendida) la `CrucesSection` de la ficha del parlamentario: un Server Component que llama al RPC `cruces_de_parlamentario` y renderiza las señales factuales con provenance inline, sibling de `#lobby`/`#patrimonio` (nunca anidado — convención anti-insinuación §9.1), detrás del gate `crucesPublicEnabled()` (default OFF). Consume `cruce_senal` de Phase 36; visible solo tras el gate legal.
**Mode:** capability (UI, gated)
**Depends on:** Phase 36 (capa de cruces), Phase 39 (gate legal para encender).
**Requirements:** SURF-01
**Autonomy:** autónomo para construir; **needs-legal-signoff** para encender.
**Success Criteria** (what must be TRUE):

  1. `CrucesSection` (Server Component) en la ficha de parlamentario renderiza las señales factuales con provenance inline, sibling de `#lobby`/`#patrimonio` (nunca anidado), detrás de `crucesPublicEnabled()` (default OFF, espejo de `money-gate.ts`/`net-gate.ts`)
  2. Con gate ON renderiza sin error de hidratación; con gate OFF la sección no monta (nodo ausente del HTML, no oculto-con-CSS)
  3. Empty honesto si cero cruces; sin verbo causal (linter); cada evidencia trazable al enlace original (FND-08)

**Plans:** 3/3 plans complete

Plans:

**Wave 1**

- [x] 37-01-PLAN.md — Gate de presentacion crucesPublicEnabled (Candado B, server-only, fail-closed, espejo de money-gate) + tabla de verdad (SURF-01)
- [ ] 37-02-PLAN.md — CrucesView (puro) + CrucesSection (Server Component, RPC cruces_de_parlamentario) + tipos del RPC + test RTL (empty-honesto/provenance/identidad/anti-insinuacion negative-match/conteo neutro) (SURF-01)

**Wave 2** *(blocked on Wave 1)*

- [ ] 37-03-PLAN.md — Cablear <section id=cruces> gated (sibling mt-12, envuelta entera por el gate) + CrucesSkeleton en page.tsx + test de seccion-ausente (gate OFF) / presente (gate ON) (SURF-01)

**UI hint**: yes

### Phase 38: SURF — Superficie de cruces en ficha de proyecto (DESTRABADA 2026-07-07)

**Goal:** Construir `cruces_de_proyecto(boletin)` + la `CrucesSection` de la ficha del proyecto, que muestra los parlamentarios que votaron a favor con cruces en el sector del proyecto, PII-safe (proyección vía `parlamentario_publico`, nunca rut/partido). El sign-off de señales de voto fue FIRMADO el 2026-07-07 (Carlos Sánchez Rossi, `docs/legal/SIGNOFF-senales-voto.md`) bajo las condiciones anti-insinuación heredadas de 17-LEGAL-DOSSIER §2 y 41-LEGAL-DOSSIER-CRUCES: caveat anti-causal 1×/sección, negative-match de vocabulario causal, conteo neutro, trazabilidad por evidencia. Nota de contexto post-Camino A: el sitio lee con service_role y las RPC nuevas siguen el idiom 0047/0048 (security definer, doble revoke, cero grant, allowlist lockdown-guard); el gate `crucesPublicEnabled()` ya está ON en PROD desde 2026-07-02.
**Mode:** capability (UI)
**Depends on:** Phase 36 (capa de cruces), Phase 37 (patrón de superficie), sign-off señales-voto (FIRMADO — `docs/legal/SIGNOFF-senales-voto.md`).
**Requirements:** SURF-02
**Autonomy:** autónomo para código + RPC escrita (idiom 0047: doble revoke, pgTAP, allowlist); apply DDL a PROD = checkpoint operador (patrón 52-06).
**Success Criteria** (what must be TRUE):

  1. `cruces_de_proyecto(boletin)` + `CrucesSection` en la ficha de proyecto muestra los parlamentarios que votaron a favor con cruces en el sector del proyecto, PII-safe (proyección vía `parlamentario_publico`, nunca rut/partido) — verificado por pgTAP
  2. La sección degrada honesta pre-apply (RPC ausente → null, patrón PGRST202 de 52-03) y monta con el RPC aplicado
  3. Cada evidencia es trazable; el copy es factual sin verbo causal (negative-match en tests); caveat anti-causal 1×/sección

**Plans:** 3/3 plans complete

Plans:

- [x] 38-01-PLAN.md — RPC cruces_de_proyecto (security definer, doble revoke, cero grant) + pgTAP + allowlist + tipo CruceProyectoRow (escrita, NO aplicada)
- [x] 38-02-PLAN.md — CrucesSection/CrucesView (degrade PGRST202) + carril #cruces + rail "Cruces ◆" + RTL (nombre como link, caveat 1×, negative-match)
- [x] 38-03-PLAN.md — gate + redeploy caliente + smoke + evidencia demo (14309-04) + checkpoint operador (apply DDL + pgTAP + veredicto visual)

**UI hint**: yes

### Phase 39: LEGAL — Gate legal transversal F13/F17/cruces (sign-off humano)

**Goal:** Resolver el gate transversal que controla la exposición pública de TODO lo sensible de las Fases 1–3: una revisión legal humana (Ley 21.719) que habilita los flags `MONEY_PUBLIC_ENABLED` (aportes/contratos), `netPublicEnabled` (datos de red) y `crucesPublicEnabled` (señales de cruce). No es una fase tardía sino el candado que atraviesa el milestone — el código se construye entero deny-by-default, pero nada se enciende sin firma humana. **Un agente autónomo NUNCA flipea estos flags.**
**Mode:** gate (acción exclusivamente humana / legal)
**Depends on:** datos de Fases 1–2 listos para revisar (Phases 34/35/36); RUT-01 (Phase 40) para MONEY. NET es doble-candado (RLS + flag).
**Requirements:** LEGAL-01
**Autonomy:** **needs-legal-signoff** (exclusivamente humano). El "quality floor flip" del diseño #1 está ELIMINADO (contradice gate LOCKED).
**Success Criteria** (what must be TRUE):

  1. Las firmas F13 (MONEY, `docs/legal/13-LEGAL-DOSSIER.md`) y F17 (NET, `17-LEGAL-DOSSIER.md`) + el sign-off de cruces quedan registrados (YAML `signoff: approved`), cubriendo republicación de datos públicos, datos sensibles y terceros privados bajo Ley 21.719
  2. Con las firmas registradas, encender `MONEY_PUBLIC_ENABLED`/`netPublicEnabled`/`crucesPublicEnabled` queda habilitado como acción de operador en Cloudflare Pages; mientras no estén firmados, los gates siguen fail-closed (OFF) y ninguna superficie sensible se expone
  3. MONEY depende además de RUT-01 (Phase 40) para que el cruce tenga datos; NET es doble-candado (RLS + flag); el despliegue con los flags encendidos queda verificado

**Plans:** TBD (proceso humano — ningún código de flag se flipea por un agente)

### Phase 40: RUTM — RUT-01 + ChileCompra/SERVEL (diferido, needs-human)

**Goal:** Cerrar el resto de la ingesta de dinero —diferido explícitamente— cosechando RUT a la maestra y cableando el wire real de ChileCompra (hoy es un CLI demo: maestra vacía, un RUT hardcodeado `76.123.456-0`, falta `MERCADOPUBLICO_TICKET`) más un workflow manual de SERVEL por elección. Sin RUT, ChileCompra cruza cero parlamentarios y la señal `aporte_sector_voto`/MONEY no tiene evidencia; por eso se difiere en lugar de fingir que el CLI demo es un pipeline.
**Mode:** data-coverage (diferido / operador)
**Depends on:** RUT-01 (prerrequisito duro, NO resuelto por estos diseños), Phase 39 (para exponer). ChileCompra/SERVEL no son shippables hoy.
**Requirements:** RUTM-01, RUTM-02, RUTM-03
**Autonomy:** **needs-human-checkpoint** (RUT, `MERCADOPUBLICO_TICKET`, URL SERVEL); exposición pública **needs-legal-signoff**.
**Success Criteria** (what must be TRUE):

  1. Cosecha de RUT a la maestra (`backfill-rut.ts`), DV-válido (módulo-11) + provenance, NUNCA fabricando un RUT; acción de operador (RUTM-01)
  2. Wire real de ChileCompra: `run-dinero-prod-cli.ts` (carga maestra + `TareaRut[]` de la semana actual) + workflow `dinero-chilecompra-weekly` + bloque R2/`SnapshotWriter` en `ingest-run.ts` (hoy "R2 BLOQUEADO"); degrada a dry-run sin ticket → assert post-run `if [ $CONTRATOS -eq 0 ]; exit 1`; con ticket y RUTs reales `contratos=N>0` y cruce por RUT confirmado (RUTM-02)
  3. Workflow `dinero-servel-manual` (`workflow_dispatch` only, URL Azure Blob por elección provista por el operador): con datos reales `aportes=N>0`; la exposición pública requiere LEGAL-01 (RUTM-03)

**Plans:** TBD

### Phase 41: CRUCEN — Habilitación de cruces (grant gated + dossier + fecha_captura)

**Goal:** Cerrar las tres deudas que destapó el code-review de Phase 37 para dejar la superficie de cruces (`crucesPublicEnabled`) LISTA para ser firmada y encendida — **sin encenderla ni firmarla** (eso sigue siendo humano). (1) Fix WR-02: el `ProvenanceBadge` de cruces marca stale-amber falso porque usa la fecha de la REUNIÓN como `capturedAt` (el RPC 0040 no proyecta la fecha de captura real); proyectar `cruce_senal.fecha_captura` en el RPC y consumirla en el componente. (2) El RPC `cruces_de_parlamentario` no tiene grant a anon → encender el flag hoy rompería `/parlamentario/[id]`; escribir la migración de grant (espejo `subgrafo_red`/`lobby_de_parlamentario`) **sin aplicarla** (deny-by-default hasta el sign-off). (3) No existe dossier legal de cruces; crearlo (espejo F17) como prep para la firma humana.
**Mode:** capability (deuda de superficie / gated)
**Depends on:** Phase 37 (superficie construida), Phase 36 (RPC/`cruce_senal` en PROD). Para ENCENDER: Phase 39 (firma del dossier de cruces).
**Requirements:** CRUCEN-01, CRUCEN-02, CRUCEN-03
**Autonomy:** autónomo para construir (WR-02 fix, migración de grant escrita, dossier); **needs-human-checkpoint** para aplicar la migración de `fecha_captura` (CRUCEN-01) a PROD (`psql --db-url` + `schema_migrations`); **needs-legal-signoff** para firmar el dossier + aplicar el grant (CRUCEN-02) + flipear `crucesPublicEnabled`. Un agente NUNCA aplica el grant ni flipea el flag.
**Success Criteria** (what must be TRUE):

  1. **CRUCEN-01:** nueva migración `create or replace public.cruces_de_parlamentario(text)` que añade `fecha_captura` (de `cruce_senal`) a la fila de retorno SIN tocar el grant (sigue revocado de anon/authenticated); `CrucesSection`/`CrucesView` usan `fecha_captura` como `capturedAt` del `ProvenanceBadge` (frescura real del materializado); tipos + tests RTL actualizados; el stale-amber falso desaparece. pgTAP verifica la nueva columna y que el RPC sigue deny-by-default. Aplicación a PROD = checkpoint operador.
  2. **CRUCEN-02:** nueva migración con `grant execute on function public.cruces_de_parlamentario(text) to anon` (espejo de `subgrafo_red`/0030 y `lobby_de_parlamentario`/0021), **escrita y commiteada pero NO aplicada** (su aplicación es checkpoint humano post-sign-off); pgTAP que afirma el grant para cuando se aplique; un grep/test garantiza que ninguna corrida autónoma la aplica. CERO flip de `crucesPublicEnabled`.
  3. **CRUCEN-03:** `docs/legal/XX-LEGAL-DOSSIER-CRUCES.md` (espejo estructural de `17-LEGAL-DOSSIER-NET.md`): `signoff: pending`, propósito = preparación para asesoría legal, secciones de superficie de riesgo (composición lobby↔sector como posible insinuación, minimización Ley 21.719, atribución por dataset, doble candado RPC-grant + flag), checklist de sign-off §9. La firma es acción humana (como F17). Documenta la secuencia de encendido: firmar dossier → aplicar grant CRUCEN-02 → flip `crucesPublicEnabled`.

**Plans:** 3/3 plans complete

- [x] 41-01-PLAN.md — CRUCEN-01: fix WR-02 (frescura honesta) — migración 0041 (drop+recreate proyecta fecha_captura) + pgTAP + tipo + componente + RTL; apply 0041 = checkpoint operador DIFERIDO (gate 4); suite 298/298 verde, tsc limpio [ff2dd63, 807f08b]
- [x] 41-02-PLAN.md — CRUCEN-02: grant gated — migración 0042 (grant a anon, ESCRITA NO aplicada / NO en schema_migrations, gate 2) + precondición fail-loud do$$ + pgTAP post-apply en supabase/tests/post-apply/ fuera del glob; guard = 0040 assert #3 intacto; suite 298/298 verde [a5e410a, 0ad6f1c]
- [x] 41-03-PLAN.md — CRUCEN-03: dossier legal de cruces — 41-LEGAL-DOSSIER-CRUCES.md ×2 idénticos, signoff: pending, CRUCES-específico, jamás firmado

**UI hint**: yes (CRUCEN-01 toca `cruces-de-parlamentario.tsx`)

### Phase 42: LOCKDOWN — Cierre de la API pública de Supabase (rol `web_reader`)

**Goal:** Eliminar la superficie de API pública de Supabase (rol `anon`). Hoy el servidor de Next.js y el público usan el MISMO rol `anon`; cualquiera con la anon key puede llamar a PostgREST directamente y extraer datos sin pasar por la página. Crear un rol Postgres dedicado de mínimo privilegio `web_reader` con EXACTAMENTE los permisos curados que hoy tiene `anon`; hacer que `createServerSupabase` lea como `web_reader` (JWT firmado con `role: web_reader`, NO la service key — eso bypassearía RLS); y revocar TODO de `anon`/`authenticated`. Tras el cutover, la anon key devuelve `permission denied` en cada RPC/tabla, el sitio sigue renderizando todas sus superficies, y el PII sigue protegido por RLS (web_reader es un rol restringido normal). Auditado: TODAS las lecturas ya son server-only (no hay cliente browser, no hay login) → cerrar la API no rompe features de cliente.
**Mode:** security / arquitectura (cambio de canal de datos)
**Depends on:** ninguna funcional; toca el modelo de grants de todas las migraciones previas. Cutover coordinado con deploy de Cloudflare (operador).
**Requirements:** LOCKDOWN-01, LOCKDOWN-02, LOCKDOWN-03, LOCKDOWN-04
**Autonomy:** autónomo para ESCRIBIR (rol + re-grants, revokes, switch del server, tests, pgTAP, runbook); **needs-human-checkpoint** para el cutover ORDENADO a PROD (aplicar 01 → deployar 03 a Cloudflare → aplicar 02; revoke último). El agente NUNCA revoca anon antes de que el server web_reader esté vivo en prod.
**Success Criteria** (what must be TRUE):

  1. **LOCKDOWN-01:** rol `web_reader` (NOLOGIN) creado + `grant web_reader to authenticator`; migración que concede a `web_reader` EXACTAMENTE el set vivo de `anon` (execute en RPCs + select en tablas public-read + policies `for select` equivalentes), enumerado desde PROD (information_schema/pg_policies), no desde los .sql. Idempotente. pgTAP: web_reader ejecuta un RPC representativo y lee una tabla public-read. NO revoca nada aún.
  2. **LOCKDOWN-03:** `createServerSupabase` se autentica como `web_reader` (JWT `role: web_reader` firmado con el JWT secret del proyecto), manteniéndose server-only; tests del cliente. Deploy a Cloudflare ANTES del revoke (gate de cutover).
  3. **LOCKDOWN-02:** migración que revoca TODO de `anon` y `authenticated` (execute en RPCs + select en tablas + drop policies `to anon`). Se aplica ÚLTIMA, tras el server web_reader vivo en prod. pgTAP: anon/authenticated sin execute/select en TODO el inventario; web_reader intacto.
  4. **LOCKDOWN-04:** verificación end-to-end — probe live con la anon key → permission denied en cada RPC/tabla; el sitio renderiza votaciones, lobby, patrimonio, dinero, NET, cruces, búsqueda, agenda, parlamentarios, proyecto. Guard anti-regresión (CI falla ante un nuevo `grant ... to anon` o un select de columna PII en el server). Runbook de cutover + rollback documentado.

**Plans:** 4 plans — **WRITE-COMPLETE 2026-06-24** (gsd-verifier PASS 4/4, suite 316/316, tsc limpio). Cutover a PROD = checkpoint operador pendiente (aplicar 0043 → deploy 03 a Cloudflare → aplicar 0044). Runbook: `docs/RUNBOOK-lockdown-cutover.md`.

Plans:

- [x] 42-01-PLAN.md — LOCKDOWN-01: migración 0043 (crear web_reader + grants enumerados + 26 policies _wr) + pgTAP — ESCRITA (apply=operador)
- [x] 42-02-PLAN.md — LOCKDOWN-02: migración 0044 (revoke anon/authenticated + default privileges FOR ROLE postgres) + pgTAP post-apply — ESCRITA (apply ÚLTIMO=operador)
- [x] 42-03-PLAN.md — LOCKDOWN-03: createServerSupabase lee como web_reader (JWT HS256 fail-closed) + tests — ESCRITO (deploy=operador)
- [x] 42-04-PLAN.md — LOCKDOWN-04: guard CI anti-regresión + runbook de cutover ordenado — HECHO

**UI hint**: no (cambio de credencial/permisos; sin cambios visuales)

### Phase 43: DEBT — Eliminación de deuda técnica (exhaustiva)

**Status:** ✅ COMPLETE 2026-06-24. ~71 hallazgos (swarm 6 dims) → Opus 1-a-1 → **24 FIX-NOW aplicados (21 commits atómicos)**, 11 checkpoints operador, 23 won't-fix/falso-positivo, 5 fold-into-closure. Suite **316→341 verde**, `tsc -b` limpio, dinero un-darkened (0→97). Cero regresión. Ledger: `43-DEBT-LEDGER.md`. CERO apply a PROD (migración 0045 ESCRITA, apply=operador).

**Goal:** Hacer UNA pasada exhaustiva de deuda técnica del repo completo (app/ Next.js + 13 packages + supabase/ + .planning/ + config/build): descubrir TODA la deuda con evidencia (swarm premortem Sonnet, 1 agente por dimensión), validar cada hallazgo UNO POR UNO (Opus adversarial: ¿real? causa raíz, qué rompe, test que lo protege), arreglar SOLO lo seguro y autónomo (test + commit atómico, suite verde entre fixes) y documentar el resto en un DEBT-LEDGER (fixed / deferred-con-razón / won't-fix). Mandato del operador: "nada por sentado" — nada sin evidencia entra; nada se arregla sin su veredicto Opus individual. Higiene, NO rediseño.
**Mode:** mantenimiento / calidad (cero cambio de comportamiento sin prueba)
**Depends on:** ninguna funcional; audita todo lo construido (v2–v4). NO ejecuta el cutover de Phase 42 (acción operador).
**Requirements:** DEBT-01, DEBT-02, DEBT-03, DEBT-04
**Autonomy:** autónomo para DESCUBRIR, VALIDAR, ARREGLAR-lo-seguro y DOCUMENTAR; **needs-human-checkpoint** para cualquier fix que toque PROD (DDL → migración escrita, apply=operador), deploy, secret, flag o firma. El agente NUNCA aplica a PROD ni ejecuta el cutover de Phase 42.
**Success Criteria** (what must be TRUE):

  1. **DEBT-01:** inventario EXHAUSTIVO con evidencia (`43-DEBT-LEDGER.md`): swarm premortem Sonnet (≥6 dimensiones) → cada hallazgo con archivo:línea, repro, severidad, blast radius. Nada por sentado (sin evidencia verificable no entra).
  2. **DEBT-02:** validación adversarial Opus UNO POR UNO de cada hallazgo → veredicto FIX-NOW / CHECKPOINT-OPERADOR / WON'T-FIX + causa raíz + qué rompe + test que lo protege. Ledger clasificado.
  3. **DEBT-03:** fixes FIX-NOW aplicados con test + commit atómico por fix; suite app ≥316 verde + `tsc -b` limpio + `packages/*` test verdes mantenidos entre cada fix; migraciones nuevas (si las hay) ESCRITAS no aplicadas (apply=operador).
  4. **DEBT-04:** DEBT-LEDGER final (fixed / deferred-con-razón-y-dueño / won't-fix-con-razón) + guards anti-regresión donde apliquen (p.ej. CI que corra app/ tests; linter si se decide) + reporte de checkpoints de operador + memoria/STATE actualizadas.

**Plans:** TBD (research/descubrimiento → plan-phase)

**UI hint**: no (higiene de código/config/docs; sin cambios visuales)

## ✅ v5.0 — De datos a comprensión (legibilidad + análisis) — SHIPPED 2026-07-08

> **SHIPPED 2026-07-08.** 11 fases ejecutadas (44-47, 49-55; F48 DIFERIDA a milestone de ingesta por gap de datos), 44 planes, ~66 tareas. Ficha de parlamentario de muro plano → navegable (acordeones + resumen above-fold F45) + gráficos descriptivos (patrimonio F46, votos F47, comparativo ausencias F49) + rediseño cognitivo de 3 capas (F55), todo EN VIVO (Cloudflare `74e3ad0f`). Integración E2E 3/3 wired, nyquist 11/11 compliant. Audit: `milestones/v5.0-MILESTONE-AUDIT.md`. Archivo: `milestones/v5.0-ROADMAP.md` · `milestones/v5.0-REQUIREMENTS.md`.

**Mode:** producto (legibilidad + viz descriptiva) · **Numbering:** continúa desde v4.0 — arranca en **Phase 44**.
**Milestone:** transformar la ficha de parlamentario de muro plano (~900 KB, 1 columna) a navegable (acordeones + resumen above-fold) + gráficos descriptivos. Principio rector intacto (fuente+fecha+enlace, nunca causal).

### Hallazgo de Phase 44 que reordena el milestone

El inventario de datos (PROD real) muestra que **la mayoría de los charts propuestos están bloqueados por gaps de DATOS, no de UI**: votos=10 votaciones (≤9/persona), `proyecto.autores`=0/74, montos de patrimonio=URIs (no números), sin RPC agregada cross-cámara. → Se **desacopla navegación (ship ya) de charts (gated por ingesta)**. Docs: `phases/44-legibilidad-auditoria-plan/{UI-SPEC,44-AUDIT-UX,44-DATA-INVENTORY}.md`.

### Build order (re-secuenciado por evidencia)

```
F45 (navegación: acordeones + resumen)  ──►  F46 (chart patrimonio: conteo/año)   [v5 CONSTRUIBLE HOY]
                                                   │
   ────────────── gap de ingesta (milestone aparte) ──────────────
   ingesta votaciones masiva ✅ CORRIÓ (verificado PROD 2026-07-02: 133 votaciones/18.700 votos) ──► F47 DESBLOQUEADA ──► F49 DESBLOQUEADA (falta solo RPC)
   ingesta autores + identidad (PENDIENTE: autores 0/136) ──► F48 (autoría + similares-del-parlamentario: RPC proyectos_de_parlamentario)
```

### Diagnóstico 2026-07-02 (post-F46) — fases P1/P2/P3

Auditoría completa del sitio en vivo (`.planning/DIAGNOSTICO-govmap-2026-07-02.md`: 28 bugs B1–B28, propuestas anti-sobrecarga, catálogo de cruces) → Phases 50 (quick wins), 51 (legibilidad profunda), 52 (cruces nuevos).

**P0 EJECUTADO 2026-07-02 (autorización directa del usuario):** deploy F45+F46+F50 EN VIVO (build Docker Linux + wrangler, versión `3ade68b8`) · B20/B21 arreglados (quick `260702-rbb` + fix `/red` force-dynamic — el gate OFF en build horneaba notFound estático → 500 con flag ON) · **`NET_PUBLIC_ENABLED=true` FLIPEADO** (dossier F17 firmado; `/red` LIVE con selector de semilla, grafo verificado con D1012 = 305 aristas, semilla inválida → 404) · `CRUCES_PUBLIC_ENABLED` ya estaba ON (Camino A). **Pendiente único de P0: rotar DB password (usuario, B26).** Bug latente anotado: `/admin/revisar-entidades` = misma clase estática-con-gate-horneado (fix force-dynamic cuando se encienda).

### Phases (v5.0)

- [x] **Phase 44: Auditoría UX + Inventario de datos + Plan** — ✅ COMPLETE 2026-06-26 (browseros sobre PROD + psql + lectura `app/`). Entregables: `UI-SPEC.md`, `44-AUDIT-UX.md`, `44-DATA-INVENTORY.md`. Hallazgo: navegación ROI-alto data-independiente; charts mayormente data-gated.
- [x] **Phase 45: Navegación — acordeones por carril + resumen/índice above-fold.** Construible hoy. Dep: `@radix-ui/react-accordion`. Preserva frontera de carril `mt-12` (un acordeón por dominio, header siempre visible). **Mayor ROI del milestone.** (completed 2026-06-26)
- [x] **Phase 46: Chart patrimonio (conteo de bienes/pasivos por año).** Recharts (instalar + validar build CF Docker). Único chart con cobertura densa hoy (135 parlamentarios ≥2 años); solo conteos (montos=URI → degrade). Dep: F45. (completed 2026-07-02 — 46-02 deploy ejecutado: F45+F46+F50 EN VIVO)
- [x] **Phase 47: Chart votos/ausencias** — **DESBLOQUEADA 2026-07-02**: gate de datos CUMPLIDO verificado contra PROD (133 votaciones / 18.700 votos / 17.378 confirmados / 186 parlamentarios con voto). La ingesta masiva ya corrió; construible. (completed 2026-07-08)
- [ ] **Phase 48: Autoría + similares-del-parlamentario** — GATED (re-verificado 2026-07-02: `proyecto.autores` vacío 136/136). Pre-req: ingesta `proyecto.autores` + resolución nombre→`parlamentario_id` + RPC `proyectos_de_parlamentario`.
- [x] **Phase 49: Comparativo vs cámara (ausencias/actividad)** — **gate de datos CUMPLIDO 2026-07-02** (546 ausencias / 18.700 votos en PROD; F47 desbloqueada). Falta solo: RPC `tasa_ausencia_comparada` (security definer, PII-safe, allowlist). (completed 2026-07-08)
- [x] **Phase 50: FIX — Quick wins de bugs del diagnóstico 2026-07-02 (P1)** — 11 fixes de código acotados (B1, B6, B7, B8, B9, B10, B12, B14, B15, B17 + supresión de honest-state repetido). Sin DDL, sin deploy (checkpoint operador aparte). (completed 2026-07-02)
- [x] **Phase 51: LEG2 — Legibilidad profunda (P2)** — votos agregados por proyecto, timeline dos niveles + "¿dónde está hoy?", patrimonio tarjeta-resumen sin URIs (B3), comparador cableado (B4), rebeldías honestas (B5), lobby agrupado por contraparte, provenance por sección, footer global. (completed 2026-07-03)
- [x] **Phase 52: CRUCE2 — Cruces nuevos con datos ya disponibles (P3)** — clasificador sectorial (enciende `cruce_senal` de verdad), lobby×tramitación temporal, proyecto→agenda inverso, módulo de actualidad en home. (Asistencia comparada = Phase 49; chart votos = Phase 47 — ya desbloqueadas.) (completed 2026-07-06)
- [x] **Phase 53: UXNAV — Auditoría UX navegada (BrowserOS) + fixes de orientación (P0 demo)** — recorrer los journeys clave del sitio EN VIVO con navegador real (desktop + viewport móvil, screenshots como evidencia), producir informe UX priorizado y corregir los P0 de navegación/orientación en el mismo ciclo. El sitio "está difícil de maniobrar" (operador, 2026-07-07); demo para centro de estudios. (added 2026-07-07) (completed 2026-07-07)
- [x] **Phase 54: UXDEMO — Pulido presentacional para demo (centro de estudios)** — nombres presentables (hoy `nombre_normalizado` minúsculas), home con rutas de entrada guiadas, microcopy "cómo leer esto", P1 del informe F53, QA final navegado + set de screenshots de demo. (added 2026-07-07) (completed 2026-07-07)

### Decisión (RESUELTA 2026-06-26): A + B — ambas pistas en paralelo

El usuario eligió **A y B**: legibilidad construible ahora **y** ingesta que desbloquea los charts gated, todo dentro de v5 (no se difiere a v6). Dos pistas concurrentes:

- **LEGIBILIDAD (empieza ya):** F45 navegación → F46 chart patrimonio.
- **INGESTA (en paralelo):** votaciones masivas (reabrir Phase 27) → desbloquea F47→F49; ingesta autores+identidad → desbloquea F48.

Cada fase de chart pasa de GATED a construible cuando su gap de ingesta cierra; la pista de legibilidad no espera. Ver `UI-SPEC.md §5`.

## Phase Details (v5.0)

### Phase 45: LEG — Navegación: acordeones por carril + resumen/índice above-fold

**Goal:** Transformar la ficha de parlamentario de un muro de 1 columna apilada (~900 KB, sin resumen ni navegación) a una ficha **navegable**: cada carril de dominio se vuelve un acordeón independiente (header siempre visible, cuerpo colapsable) y se agrega un resumen+índice arriba del pliegue con conteo/estado honesto y anclas de salto por carril — todo SIN romper la frontera de carril anti-insinuación (DESIGN-SYSTEM §3/§8, LOCKED), el SSR, ni el guard de lockdown (Camino A). Es la pista de legibilidad: data-independiente, mayor ROI del milestone.
**Mode:** producto (UI / legibilidad; comportamiento-preservante de datos y seguridad)
**Depends on:** Phase 44 (auditoría+plan: `UI-SPEC.md`, `44-AUDIT-UX.md`, `44-DATA-INVENTORY.md`). Ninguna dependencia de datos.
**Requirements:** LEG-01, LEG-02, LEG-03
**Autonomy:** autónomo para construir + testear; build/deploy a Cloudflare = checkpoint operador (Docker Linux + wrangler, no build Windows).
**Success Criteria** (what must be TRUE):

  1. **LEG-01:** cada carril (`#votos`/`#lobby`/`#patrimonio`/`#cruces`/MONEY gated) es un acordeón independiente (uno por dominio, header con `<h2>` siempre visible, cuerpo colapsable); la frontera `mt-12` nunca se colapsa; jamás dos dominios en una unidad; `@radix-ui/react-accordion`, SSR + thin client wrapper.
  2. **LEG-02:** resumen+índice above-fold (tras la cabecera, antes del primer carril) con un chip por carril que muestra conteo/estado honesto (3-estado: dato/vacío-honesto/no-ingerido) y ancla al carril.
  3. **LEG-03:** comportamiento-preservante: contenido de secciones intacto (fuente+fecha+enlace por dato), sin `.from('parlamentario')` ni RPC fuera del allowlist (guard verde), SSR intacto (solo el toggle es cliente), default colapsa carriles vacíos/ralos; suite `app/` verde + `tsc -b` limpio.

**Plans:** 3/3 plans complete

- [x] 45-01-PLAN.md — Instalar @radix-ui/react-accordion@1.2.14 + CarrilAccordion (wrapper cliente; <h2> en header siempre visible, forceMount, no-leak) [LEG-01]
- [x] 45-02-PLAN.md — Resumen+índice above-fold: contarCarriles (server-only, RPCs allowlisted + ingesta-estado) + ParlamentarioResumen/ResumenView 3-estado [LEG-02]
- [x] 45-03-PLAN.md — Re-layout de page.tsx (cada carril en CarrilAccordion; mt-12 + gates intactos) + test estructural + suite app/ verde [LEG-01/LEG-03]

**UI hint**: sí (re-layout de la ficha de parlamentario; UI-SPEC ya existe en `phases/44-...`)

### Phase 46: VIZ — Chart de patrimonio (conteo de ítems por año)

**Goal:** Agregar a la sección de patrimonio de la ficha (dentro del acordeón creado en F45) un gráfico descriptivo de **evolución del conteo de ítems** (bienes/pasivos) por año de declaración, rotulando el tipo de declaración. Es el único chart con cobertura densa hoy (135 parlamentarios con ≥2 años); solo conteos, NO montos (son URIs → caveat honesto). Instala Recharts como isla cliente sin romper el build de Cloudflare. Descriptivo, nunca causal, con fuente+fecha+enlace.
**Mode:** producto (UI / visualización descriptiva; sin cambios de datos ni RPC nueva)
**Depends on:** Phase 45 (el chart vive dentro del acordeón de patrimonio). Phase 44 (inventario: cobertura + caveat montos-como-URI).
**Requirements:** VIZ-01, VIZ-02, VIZ-03
**Autonomy:** autónomo para construir + testear (incluye `pnpm add recharts` + validar build OpenNext en Docker Linux); deploy a Cloudflare = checkpoint operador (wrangler, no build Windows).
**Success Criteria** (what must be TRUE):

  1. **VIZ-01:** chart = serie temporal del conteo de ítems por `declaracion.fecha_presentacion`, rotulado por tipo de declaración, vía RPCs ya allowlisted; sin montos (caveat honesto); degrada a "datos insuficientes" con <2 declaraciones.
  2. **VIZ-02:** Recharts instalado, chart como isla `"use client"`, resto SSR; build OpenNext/Cloudflare no se rompe (Docker Linux); `pnpm test` + `tsc -b` verdes.
  3. **VIZ-03:** descriptivo/neutro (negative-match vocabulario prohibido verde), fuente+fecha+enlace (CC BY 4.0 CPLT) al pie; sin RPC nueva ni `.from('parlamentario')`; guard verde.

**Plans:** 1/2 plans executed

- [x] 46-01-PLAN.md — Recharts + seriePatrimonio() transform + isla cliente patrimonio-chart.tsx + shell server (caveat/degrade/footer) + tests
- [x] 46-02-PLAN.md — Checkpoint operador: build OpenNext Docker Linux + deploy wrangler (ejecutado 2026-07-02, versión `3ade68b8`)

**UI hint**: sí (gráfico en la sección de patrimonio; depende del acordeón de F45)

### Phase 50: FIX — Quick wins de bugs del diagnóstico 2026-07-02 (P1)

**Goal:** Eliminar los bugs de código acotados y verificados en vivo del diagnóstico `.planning/DIAGNOSTICO-govmap-2026-07-02.md` (§1) — cada uno con file:line conocido, sin DDL nuevo, sin deploy (el deploy F45+F46+F50 es un checkpoint operador único). La primera impresión del sitio deja de estar rota y la doctrina de estados honestos vuelve a cumplirse en el 100% de las rutas.
**Mode:** fix (código puro; comportamiento-corrector, cero cambio de schema/RPC salvo copy)
**Depends on:** Phase 46 (código; el deploy pendiente NO bloquea). Diagnóstico: `.planning/DIAGNOSTICO-govmap-2026-07-02.md`.
**Requirements:** (bugs del diagnóstico — no mapea a REQ nuevo)
**Autonomy:** autónomo para construir + testear; deploy = checkpoint operador (Docker Linux + wrangler).
**Success Criteria** (what must be TRUE):

  1. **B1** — el pill del hero del home no apunta a un boletín inexistente: ejemplos validados contra la DB o reemplazados por boletines reales (`app/app/page.tsx:23-28`).
  2. **B6** — el umbral ámbar del ProvenanceBadge deja de estar en alarma permanente: umbral por cadence de fuente (~10-14 días para ingesta semanal), no 48 h fijas (`lib/format.ts:56-58`).
  3. **B7** — `/agenda` deja de tragar errores de DB: `CitacionesSection` y `SalaTableServer` chequean `.error` y lanzan (doctrina #34; `agenda/page.tsx:276-284,404-421`) — un fallo de red nunca se renderiza como "No hay citaciones esta semana".
  4. **B8** — el timeline nunca muestra el chip literal "Cámara origen desconocida" (fallback de label honesto).
  5. **B9** — `/proyecto/[boletin]`, `/parlamentarios`, `/buscar` y `/agenda` tienen `error.tsx` propio en español (paridad con parlamentario/contraparte).
  6. **B10** — el copy de lobby se parametriza por cámara: la ficha de un senador nunca dice "la Cámara (camara.cl/transparencia)".
  7. **B12** — fechas con locale correcto ("jueves 2 de julio", no "Jueves, 2 De Julio") en headers de agenda.
  8. **B14** — votación sin resultado en la fuente muestra línea explícita "desenlace no informado por la fuente" (paridad Cámara/Senado, honest-state, nunca silencio).
  9. **B15** — proyectos de tipo Mensaje dicen "Iniciativa del Ejecutivo", nunca "Autores no informados.".
  10. **B17** — `VersionRow` guarda `fecha_presentacion` contra null/empty antes de `new Date()` (paridad con el guard WR-03 del chart; `patrimonio-de-parlamentario.tsx:383,713-720`).
  11. **Honest-state repetido suprimido** — "De qué trata: no disponible aún" aparece a lo más UNA vez por sección, no por cada arco de proyecto.
  12. Suite `app/` verde (≥377, cero regresión), `tsc -b` limpio, lockdown-guard verde; cero vocabulario prohibido nuevo.

**Plans:** 5/5 plans complete

Plans:

- [x] 50-01-PLAN.md — Helpers puros lib/format (B6 umbral 14d, B12 capitalizarPrimera, B17 fechaCortaSegura) + tests dependientes
- [x] 50-02-PLAN.md — Pill home 14309-04 (B1), votación sin desenlace (B14), honest-state 1x/sección (HS-rep)
- [x] 50-03-PLAN.md — CamaraChip omite null (B8), autores Mensaje (B15), 4 error.tsx (B9)
- [x] 50-04-PLAN.md — Copy lobby por cámara (B10) vía RPC allowlisted
- [x] 50-05-PLAN.md — Agenda throw-on-error (B7), locale (B12-app), guard fecha patrimonio (B17-app) [wave 2]

### Phase 51: LEG2 — Legibilidad profunda (P2)

**Goal:** Ejecutar las propuestas anti-sobrecarga del diagnóstico (§2): que la ficha de parlamentario y la ficha de proyecto se lean en minutos sin perder un solo dato ni violar la doctrina anti-insinuación. El volumen repetitivo se agrega y colapsa; el detalle queda a un clic, server-driven.
**Mode:** producto (UI / legibilidad; puede requerir ajuste de RPC existente — toda RPC tocada/nueva entra al allowlist del lockdown-guard)
**Depends on:** Phase 50 (bugs de base limpios), Phase 45/46 (acordeones + chart como marco). Diseño de referencia: `DIAGNOSTICO-govmap-2026-07-02.md §2` + `phases/44-legibilidad-auditoria-plan/UI-SPEC.md`.
**Requirements:** (legibilidad — extiende LEG-01..03 de F45)
**Autonomy:** autónomo para construir + testear; deploy = checkpoint operador.
**Success Criteria** (what must be TRUE):

  1. **Votos agregados por proyecto:** cada arco de proyecto muestra UNA línea-resumen (conteos por sentido + rango de fechas) con las líneas individuales bajo "ver detalle" — las ~90 líneas idénticas por proyecto desaparecen sin perder dato.
  2. **Timeline dos niveles + "¿dónde está hoy?":** la ficha de proyecto abre con bloque de estado actual (etapa + último hito + urgencia vigente + hace cuánto); hitos estructurales siempre visibles; pares repetitivos de urgencia colapsados en una línea por período (B19).
  3. **Patrimonio tarjeta-resumen (B3):** cada versión = tarjeta (fecha, tipo, conteos por categoría) con "Ver detalle" server-driven; ningún campo cuyo valor sea URI de CPLT se renderiza como valor; jamás el `<dl>` completo inline.
  4. **Comparador cableado (B4):** UI para seleccionar dos versiones (el deep-link `?comparar=A,B` deja de ser el único camino); copy no contradictorio.
  5. **Rebeldías honestas (B5):** ausencias excluidas o separadas de "votó distinto a su bancada" (ajuste RPC `rebeldias_de_parlamentario` si hace falta, allowlisted), título del proyecto hidratado, dedupe por votación.
  6. **Lobby agrupado por contraparte:** vista "con quién se reúne más" (contraparte + conteo + fechas) además del cronológico; caveat de identidad UNA vez por sección, no por fila (B11).
  7. **Provenance por sección** donde hoy hay 100+ badges idénticos (timeline de proyecto), sin perder trazabilidad por dato.
  8. **Footer global:** licencia CC BY 4.0, metodología, fuentes y contacto en toda página.
  9. Suite verde + tsc limpio + lockdown-guard verde; anti-insinuación intacta (negative-match).

**Plans:** 7/7 plans complete

Plans:

- [x] 51-01-PLAN.md — SC5: ajuste RPC rebeldias_de_parlamentario (sin ausencias + titulo + dedupe) + guard refinado + pgTAP + checkpoint operador
- [x] 51-02-PLAN.md — SC1/SC5-consumidor/B24: linea-resumen por arco de votos + ?votosVer + titulo en rebeldias + borrar dead code
- [x] 51-03-PLAN.md — SC3/SC4: patrimonio tarjeta-resumen + filtro URI + comparador form GET
- [x] 51-04-PLAN.md — SC6: lobby agrupado por contraparte + toggle ?vista + caveat 1x/seccion
- [x] 51-05-PLAN.md — SC2/SC7: bloque "Donde esta hoy?" + timeline 2 niveles + 1 ProvenanceBadge/seccion
- [x] 51-06-PLAN.md — SC8: footer global CC BY (scope-caveat) + pagina /metodologia
- [x] 51-07-PLAN.md — SC1 §2.1: header con periodo + chip "Presente en N de M" (sin PII)

### Phase 52: CRUCE2 — Cruces nuevos con datos ya disponibles (P3)

**Goal:** Encender los cruces de mayor ROI que NO requieren ingesta nueva (diagnóstico §3.2): clasificador sectorial (des-raquitiza `cruce_senal`: hoy 30 señales porque solo 34/17.681 contrapartes tienen sector), lobby×tramitación por ventana temporal (yuxtaposición pura "en el mismo período", jamás causal), cruce inverso proyecto→agenda, y módulo de actualidad en el home. Los comparativos de votos (F47) y asistencia (F49) son fases propias ya desbloqueadas — no se duplican aquí.
**Mode:** producto+datos (pipeline clasificador ya escrito + RPCs nuevas allowlisted + UI)
**Depends on:** Phase 50. Independiente de Phase 51 (puede paralelizarse). Pipeline CRUCE de Phase 36 (`@obs/cruces`) ya escrito.
**Requirements:** (cruces — extiende CRUCE-01..03 de v4)
**Autonomy:** autónomo para código + clasificador local acotado; toda RPC nueva = security definer PII-safe + allowlist lockdown-guard; ningún flag `*_PUBLIC_ENABLED` se flipea (doctrina LOCKED).
**Success Criteria** (what must be TRUE):

  1. **Clasificador sectorial corrido** (local, lotes acotados, golden gate vigente) sobre contrapartes y `proyecto_ficha` → `cruce_senal` re-materializado con cobertura real (>>30 señales); resultado verificado con psql.
  2. **Lobby×tramitación temporal:** RPC + UI "reuniones registradas mientras se tramitaba el boletín" presentado estrictamente como yuxtaposición fechada con fuente ("en el mismo período"), cero lenguaje causal (negative-match).
  3. **Proyecto→agenda inverso:** la ficha de proyecto muestra "citado en comisión el {fecha}" cuando `citacion_punto.boletin` matchea.
  4. **Módulo de actualidad en home:** qué se votó esta semana / urgencias vigentes / última actualización por fuente — el home deja de ser solo un buscador.
  5. Suite verde + tsc limpio + lockdown-guard verde (RPCs nuevas allowlisted); anti-insinuación intacta.

**Plans:** 6/6 plans complete

Plans:

- [x] 52-01-PLAN.md — SC1: filtro --solo-confirmadas + sector_id is null en clasificar-lobby-cli (carga incremental de alto-ROI) + unit test
- [x] 52-02-PLAN.md — SC2/SC5: migracion 0048 RPC lobby_en_tramitacion (idiom 0047, PII-safe, semana ISO) + pgTAP + allowlist
- [x] 52-03-PLAN.md — SC2/SC3: carril lobby x tramitacion en ficha proyecto (degrade honesto) + linea de citacion en Donde esta hoy
- [x] 52-04-PLAN.md — SC4: modulo de actualidad en el home (3 bloques no-PII, force-dynamic) + RTL
- [x] 52-05-PLAN.md — SC1: corrida LIVE del clasificador (golden gate -> dry-run -> lotes -> materializar_cruces() -> verificacion psql)
- [x] 52-06-PLAN.md — SC2/SC5: checkpoint operador — apply 0047+0048 por psql + pgTAP + stamping schema_migrations

### Phase 47: VCHART — Chart de votos/ausencias del parlamentario

**Goal:** Dar a la ficha de parlamentario su visualización de votos: distribución del sentido de voto (sí/no/abstención/ausente/pareo) y su evolución en el tiempo, sobre los datos YA ingestados (133 votaciones / 18.700 votos / 17.378 confirmados / 186 parlamentarios con voto — gate de datos verificado contra PROD 2026-07-02). Patrón F46 (chart patrimonio Recharts): solo hechos contables con fuente, conteo neutro, sin score ni ranking; degrade honesto donde el dato falte. Reusar la infraestructura de lectura existente (RPCs allowlisted / tablas no-PII) — RPC nueva solo si es imprescindible, con idiom 0047 (security definer, doble revoke, cero grant, pgTAP, allowlist) y apply = checkpoint operador.
**Mode:** producto (UI / visualización)
**Depends on:** Phase 46 (patrón chart Recharts + build CF validado), datos de votaciones masivas (CUMPLIDO 2026-07-02).
**Requirements:** VIZ-02 (chart votos), extiende VOTE de v2
**Autonomy:** autónomo para código+tests; DDL nueva (si la hay) escrita con pgTAP y aplicada en checkpoint operador (patrón 52-06); redeploy Cloudflare al cierre (patrón docker-cf-build.sh + wrangler, autorizado por operador 2026-07-06).
**Success Criteria** (what must be TRUE):

  1. La ficha de parlamentario muestra un chart de distribución de votos (sí/no/abstención/ausente) con conteos reales y fuente/fecha visibles; parlamentario sin votos ingestados → empty-state honesto (jamás barra en cero fabricada)
  2. El chart respeta el design system (tokens, Mono para cifras, sin arbitrary values) y la frontera de carril `mt-12`; cero lenguaje causal o de ranking ("el más ausente" PROHIBIDO — negative-match)
  3. Suite verde + tsc limpio + lockdown-guard verde; SSR intacto (Recharts client wrapper patrón F46)

**Plans:** 2/2 plans complete

Plans:

- [x] 47-01-PLAN.md — agregador VotoPeriodo[] por trimestre + isla votos-chart.tsx + sub-bloque "Cuándo votó" en el detalle + RTL
- [x] 47-02-PLAN.md — gate completo + redeploy caliente (arrastra fixes F38) + smoke + evidencia visual

**UI hint**: yes

### Phase 49: ACOMP — Comparativo de ausencias vs cámara

**Goal:** Contexto factual para la asistencia: junto a las ausencias del parlamentario, mostrar la referencia de su cámara (p.ej. "ausente en N de M votaciones (X%); mediana de su cámara: Y%") vía RPC `tasa_ausencia_comparada` (security definer, PII-safe, allowlist, idiom 0047) sobre los datos ya ingestados (546 ausencias / 18.700 votos — gate CUMPLIDO 2026-07-02). ESTRICTAMENTE factual-comparativo: números y mediana, sin adjetivos, sin ranking nominal ("top ausentes" PROHIBIDO), sin porcentaje-como-veredicto; caveat de cobertura (el universo es el ingestado, no la historia completa).
**Mode:** producto (RPC + UI)
**Depends on:** Phase 47 (superficie de votos donde vive el comparativo), datos masivos (CUMPLIDO).
**Requirements:** VIZ-03 (comparativo), extiende VOTE de v2
**Autonomy:** autónomo para código+RPC escrita+pgTAP; apply DDL = checkpoint operador (patrón 52-06); redeploy al cierre (autorizado 2026-07-06).
**Success Criteria** (what must be TRUE):

  1. RPC `tasa_ausencia_comparada` live-verificable: emite tasa propia + mediana de cámara + universo (N/M), PII-safe, doble revoke, pgTAP, allowlisted
  2. La ficha muestra el comparativo como hechos con universo explícito y caveat de cobertura; cero adjetivos/ranking (negative-match en tests)
  3. Suite verde + tsc limpio + lockdown-guard verde

**Plans:** 3/3 plans complete

- [x] 49-01-PLAN.md — RPC tasa_ausencia_comparada (escrita+pgTAP, espejo 0049) + tipo + allowlist; research psql PROD del shape/números D1012
- [x] 49-02-PLAN.md — Sub-bloque AusenciasContexto tras "Cómo votó" + fetch/degrade PGRST202 + RTL negative-match extendido
- [x] 49-03-PLAN.md — Gate + redeploy caliente + smoke degrade + checkpoint operador consolidado (apply 0049+0050 + pgTAP + veredicto visual)

**UI hint**: yes

### Phase 53: UXNAV — Auditoría UX navegada (BrowserOS) + fixes de orientación (P0 demo)

**Goal:** El operador reporta que el sitio "está difícil de maniobrar" y necesita presentarlo a un centro de estudios: esta fase audita la UX NAVEGANDO el sitio en vivo (https://observatorio-congreso.thevalis.workers.dev) con un navegador real — BrowserOS vía MCP HTTP local (`http://127.0.0.1:9200/mcp`, wrapper `scripts/bros-cli.mjs`; usar `new_hidden_page`/ventanas ocultas para no molestar al operador) — y corrige los P0 de orientación en el mismo ciclo. Journeys mínimos, cada uno en desktop Y viewport móvil, con screenshots archivados (`.planning/phases/<dir>/ux-evidence/`): (1) visitante aterriza en `/` y debe entender qué es el sitio y qué puede hacer; (2) ciudadano busca un proyecto por idea → llega a la ficha → entiende "qué pasó, cuándo, según qué fuente"; (3) periodista investiga un parlamentario 360 (votos→lobby→patrimonio→red); (4) navegación transversal: ficha proyecto ↔ ficha parlamentario ↔ agenda ↔ contraparte ↔ home. Producir `53-UX-AUDIT.md` con hallazgos P0 (desorientación/bloqueo) / P1 (fricción) / P2 (pulido), cada uno con screenshot de evidencia, y ARREGLAR TODOS los P0: navegación global consistente y visible, back-links/breadcrumbs, cross-links entre superficies, estados vacíos que orientan ("no hay X; prueba Y"), affordances confusas. Redeploy + re-walkthrough con screenshots before/after.
**Mode:** producto (auditoría UX navegada + fixes de orientación)
**Depends on:** Phase 52 (sitio desplegado con todas las superficies). BrowserOS corriendo en el host (verificado 2026-07-07).
**Requirements:** UX-01 (navegabilidad), extiende LEG de F45/F51
**Autonomy:** autónomo (código UI + navegación browser + screenshots); redeploy Cloudflare al cierre autorizado por operador (2026-07-06, patrón docker-cf-build.sh + wrangler local). CERO DDL, CERO flags. Si BrowserOS no responde, fallback documentado: análisis de HTML servido por curl + suite RTL (la evidencia visual queda como deuda).
**Success Criteria** (what must be TRUE):

  1. `53-UX-AUDIT.md` existe con ≥4 journeys navegados en vivo (desktop + móvil), screenshots archivados, y hallazgos clasificados P0/P1/P2 con evidencia visual y ubicación exacta
  2. TODOS los P0 corregidos con suite verde y redeploy; re-walkthrough posterior demuestra cada fix con screenshot before/after
  3. Desde cualquier superficie se puede volver al home y saltar a las demás en ≤2 clicks; toda página muestra dónde estás (título/sección visible); ningún callejón sin salida (página sin links de continuación)
  4. Cero regresión: anti-insinuación intacta (negative-match), lockdown-guard verde, tsc limpio; frontera de carril `mt-12` y gates existentes intactos

**Plans:** 5/5 plans complete

- [x] 53-01-PLAN.md — Auditoría navegada BrowserOS (2 pistas) → 53-UX-AUDIT.md + ux-evidence/
- [x] 53-02-PLAN.md — Nav global: +Red, orden por journey, label "Sobre", active-state
- [x] 53-03-PLAN.md — Breadcrumbs server puro + montaje en 3 fichas
- [x] 53-04-PLAN.md — Líneas de continuación en empty states flagged (P0 callejón sin salida)
- [x] 53-05-PLAN.md — Gate no-regresión + redeploy PROD + re-walkthrough before/after

**UI hint**: yes

### Phase 54: UXDEMO — Pulido presentacional para demo (centro de estudios)

**Goal:** Dejar el sitio presentable para mostrarlo a un centro de estudios. (1) **Nombres presentables:** hoy las superficies muestran `nombre_normalizado` en minúsculas ("gonzalez sofia") — introducir un formatter de display puro en el frontend (Title Case + orden consistente Nombre Apellido, manejo de partículas "de/del/la" y tildes) aplicado en TODAS las superficies ciudadanas, SIN tocar la proyección PII ni la DB. (2) **Home que explica:** bajo el hero, rutas de entrada guiadas (explora proyectos / parlamentarios / agenda — 3 tarjetas con 1 línea de valor cada una) para que un visitante entienda el sitio en <5 segundos. (3) **Microcopy de lectura:** 1 línea "cómo leer esto" en las secciones complejas (cruces, rebeldías, patrimonio, red) — factual, sin promesas. (4) **P1 del informe F53** corregidos o explícitamente diferidos con razón. (5) **QA final navegado** con BrowserOS: re-recorrer los 4 journeys, capturar el set de screenshots de demo en `docs/demo/` (home, búsqueda, ficha proyecto con cruce lobby, ficha parlamentario, agenda, red) y verificar cero errores de consola. Redeploy final.
**Mode:** producto (pulido presentacional + QA navegado)
**Depends on:** Phase 53 (informe UX + P0 corregidos).
**Requirements:** UX-02 (presentabilidad demo)
**Autonomy:** autónomo; redeploy autorizado (2026-07-06); CERO DDL, CERO flags; el formatter de nombres es frontend-only (la proyección `nombre_normalizado` NO se toca — es contrato PII-safe).
**Success Criteria** (what must be TRUE):

  1. Ningún nombre en minúscula cruda en superficie ciudadana (formatter puro con tests de partículas/tildes; los datos subyacentes intactos)
  2. El home comunica qué es el sitio y ofrece ≥3 rutas de entrada guiadas visibles sin scroll en desktop; hero LOCKED intacto
  3. P1 de `53-UX-AUDIT.md` corregidos o diferidos con razón escrita en el informe
  4. `docs/demo/` contiene el set de screenshots actuales del sitio desplegado (≥6 superficies) y el QA navegado no registra errores de consola
  5. Suite verde + tsc limpio + lockdown-guard verde; anti-insinuación intacta

**Plans:** 5/5 plans complete

**UI hint**: yes

### Phase 55: UXCOG — Rediseño cognitivo: jerarquía visual + detalle progresivo en superficies ciudadanas (corrección de operador post-demo)

**Goal:** El operador revisó el set de demo de F54 y RECHAZÓ el checkpoint T4 con esta corrección textual: "información no organizada, difícil de leer, mucho texto muy genérico; énfasis UI y UX, usa estrategias visuales; la idea es que sea claro y uno pueda ir aumentando el detalle, viendo cruces; no tanta información; piensa de modo cognitivo". Rediseñar las superficies ciudadanas con arquitectura de información en 3 capas: **capa 1 = resumen VISUAL escaneable** (atributos preatentivos —color/tamaño/posición— antes que texto; chunking ≤7 unidades por vista), **capa 2 = detalle bajo demanda** (progressive disclosure, mantra de Shneiderman: overview → zoom/filter → details-on-demand), **capa 3 = fuente/trazabilidad** (el enlace oficial nunca desaparece, pero deja de competir por atención). Evidencia dura del problema (docs/demo/ post-F54): ficha parlamentario = 28.048px lógicos de listas crudas apiladas (141 votaciones + 107 reuniones de lobby listadas completas, todo expandido); ficha proyecto = 10.391px con ~84 hitos de tramitación crudos tipo "Cuenta del Mensaje 384-389 que retira y hace presente la urgencia Suma"; agenda = 11.606px; /red abre con fitView de 136 nodos ilegibles. Dirección por superficie: (a) **ficha parlamentario** → dashboard resumen arriba del fold (asistencia, cómo votó, lobby por materia top-N, mini-chart patrimonio, cruces destacados) + secciones colapsadas por defecto que muestran su resumen visual + listas truncadas "mostrar ~5 / ver los N"; (b) **ficha proyecto** → stepper visual de etapas (¿dónde está hoy? ya existe — elevarlo) + timeline comprimido a hitos CLAVE (cambios de etapa, votaciones con desenlace, informes; los trámites repetitivos de urgencia agrupados en 1 línea con conteo) + tramitación completa colapsada; (c) **cruces = el diferenciador del producto** → elevarlos visualmente y hacerlos el destino natural del drill-down (el usuario "va aumentando el detalle, viendo cruces"); (d) **agenda** → agrupar por día/comisión con jerarquía visual, colapsar; (e) **/red** → vista inicial legible del ego-network del seed (no fitView global de toda la red). Restricciones LOCKED intactas: anti-insinuación/negative-match, PII-safe (nunca rut/partido), tokens del design system (sin arbitrary values), CERO DDL, hero LOCKED, caveat anti-causal 1×/sección, frontera de carril `mt-12`.
**Mode:** producto (rediseño IA/UX de superficies existentes)
**Depends on:** Phase 54 (complete). REORDENA LA COLA: 55 va antes de 38/47/49 — F47 (chart votos) y F49 (comparativo ausencias) se montan después SOBRE esta estructura; F38 (cruces en ficha proyecto) hereda el patrón de drill-down.
**Requirements:** UX-03 (legibilidad cognitiva), extiende UX-01/UX-02
**Autonomy:** autónomo para código+tests; sketch/UI-SPEC con checkpoint de operador ANTES de ejecutar (la corrección es de gusto/percepción — validar dirección visual primero); redeploy autorizado (2026-07-06); CERO DDL, CERO flags.
**Success Criteria** (what must be TRUE):

  1. Cada ficha comunica su resumen en el primer viewport (desktop 1280): qué es, números clave y dónde profundizar, SIN scroll; las listas completas existen solo bajo demanda (colapsadas/truncadas por defecto)
  2. La ficha de parlamentario baja de ~28.000px a un orden de ~5.000px lógicos en su estado por defecto sin perder ningún dato (todo accesible vía disclosure); la de proyecto agrupa los trámites repetitivos y destaca los hitos clave
  3. Los cruces quedan visualmente elevados como destino del drill-down en ambas fichas; /red abre legible (ego-network del seed)
  4. Cero regresión: anti-insinuación (negative-match), lockdown-guard, tsc, suite completa verdes; PII-safe intacto; tokens design system
  5. Checkpoint humano de dirección visual (sketch o UI-SPEC) aprobado ANTES de la ejecución masiva; set de demo recapturado al cierre

**Plans:** 6/6 plans complete

Plans:

- [x] 55-01-PLAN.md — Primitivas compartidas: token --accent-product-soft + useScrollspy + DetalleColapsable + FichaRail (wave 1)
- [x] 55-02-PLAN.md — Ficha parlamentario capa-1: conteos extendidos + 4 vistas capa-1 votos/lobby/patrimonio/cruces (wave 2)
- [x] 55-03-PLAN.md — Ficha parlamentario wiring: rail + grid + capa-1 visible + detalle colapsado (wave 3)
- [x] 55-04-PLAN.md — Ficha proyecto: rail + stepper de tramitacion + urgencia agrupada (wave 2)
- [x] 55-05-PLAN.md — Agenda dia->comision colapsable + /red ego-network del seed (wave 1)
- [x] 55-06-PLAN.md — Integracion: gate completo + deploy + recaptura demo + checkpoint operador (wave 4)

**UI hint**: yes

---

## ✅ v6.1 — Entendible y completo (Shipped: 2026-07-11)

- **2 fases (62-63), 7 planes, 6/6 reqs** — `/red` ego-network radial determinista (cap 24, móvil lista, leyenda honesta, veredicto BrowserOS "comprensible") + búsqueda completa: corpus 156→3.657 proyectos (legislatura 2022-2026, backfill LOCAL R2-first), 3.100 embeddings, ideas 60→1.504, techo honesto 565 por causa, cobertura declarada en /buscar y `pnpm freshness`. Detalle: [milestones/v6.1-ROADMAP.md](milestones/v6.1-ROADMAP.md) · Audit: tech_debt (0 gaps). Deploy `af1cfcaf`.

## ✅ v6.0 — Confiabilidad y comprensión (Shipped: 2026-07-09)

- **6 fases (56-61), 15 planes, 12/12 reqs** — ingesta E2E confiable (dos etapas R2 + hash-check + crons verdes + freshness CLI), 763 autores poblados (F48 LIVE), ícono propio "Capas que se cruzan", comprensión validada por loop BrowserOS (6/6 P0+P1). Detalle: [milestones/v6.0-ROADMAP.md](milestones/v6.0-ROADMAP.md) · Audit: tech_debt (backlog acotado).
