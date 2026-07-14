# Requirements: Observatorio del Congreso 360 — Milestone v7.0 (Votos, dinero y cierre técnico)

**Defined:** 2026-07-13
**Core Value:** La ciudadanía puede responder, sobre cualquier proyecto de ley o parlamentario, "qué pasó, cuándo y según qué fuente" — cada dato con fuente, fecha y enlace, sin afirmar intención ni causalidad.

> **Hallazgo rector del research (HIGH, convergente entre los 4 investigadores):** el código de AMBOS frentes ya existe desde v2.0 — `packages/votos/` (conector opendata.camara.cl `getVotacion_Detalle`, reconciliación DIPID fail-closed, migración 0019, RPCs, superficies) y `packages/dinero/` (ChileCompra mercadopublico.cl, SERVEL .xlsx/exceljs, harvest-rut, reconciliación RUT-exacta, migraciones 0023/0024, money-gate, materializador con token `lobby_sector_aporte` reservado en 0039). v7.0 es **WIRING dos-etapas + validación de endpoint LIVE + backfill de datos + GATING deny-by-default**, NO construcción net-new. Cada requisito se cumple ejecutando/cableando/verificando cobertura de código existente, no creando tablas/conectores/modelos. Detalle: `.planning/research/SUMMARY.md`.

## v1 Requirements

Requirements de este milestone. Cada uno mapea a una fase del roadmap.

### VOTO — Cómo vota el Congreso (P3, voto individual)

- [ ] **VOTO-01**: El ciudadano puede ver cómo votó individualmente cada parlamentario en una votación de sala — el sentido literal (a favor / en contra / abstención / pareo / ausente), con fuente, fecha y enlace al registro oficial.
- [ ] **VOTO-02**: El ciudadano puede ver, en la ficha del parlamentario, su historial de votos individuales por sesión/proyecto — descriptivo, nunca presentado como "alineamiento", "disciplina de bancada" ni "rebeldía" con carga de afinidad.
- [x] **VOTO-03**: Cada voto individual está reconciliado fail-closed contra la maestra de identidad (link solo si `confirmado`; un voto jamás se atribuye a la persona equivocada) — golden set DIPID→maestra validado ANTES del backfill masivo.
- [ ] **VOTO-04**: Toda superficie de voto lleva leyenda anti-insinuación ("un voto es un hecho observable; ausente/pareo ≠ en contra; no medimos disciplina ni motivo") + provenance inline; el linter anti-vocabulario-insinuante cubre estas superficies.
- [x] **VOTO-05**: La cobertura del voto individual está DECLARADA honestamente en la UI (N/M sesiones cubiertas, techo por causa) — nunca se finge completitud; si el endpoint opendata falla a escala, fallback honesto a lo disponible.

### RUT — Prerrequisito de datos de la dimensión dinero

- [ ] **RUT-01**: La maestra de terceros (`entidad_tercero`) tiene RUT backfilleado para las entidades cruzables, con cobertura N/M declarada como techo honesto — bloqueante duro de TODO cruce de dinero. El RUT nunca se expone públicamente (minimización) ni cruza al LLM (LOCKED); personas jurídicas solo por RUT exacto, fail-closed.

### MONEY — Dimensión dinero (P5, SERVEL + ChileCompra), deny-by-default

- [ ] **MONEY-01**: El ciudadano puede ver los contratos del Estado (ChileCompra / Mercado Público) de empresas ligadas por RUT, con fuente/fecha/enlace — construido detrás de `MONEY_PUBLIC_ENABLED` OFF.
- [ ] **MONEY-02**: El ciudadano puede ver el financiamiento electoral declarado (SERVEL: aportes/gastos por elección) asociado por RUT — construido detrás del flag; frescura del dato SERVEL declarada (qué elección/período cubre).
- [ ] **MONEY-03**: Los cruces dinero × sector aparecen como conteos factuales en `cruce_senal` (materializador extendido con `lobby_sector_aporte`) — nunca un score de correlación, nunca "financió su voto".
- [ ] **MONEY-04**: Toda superficie de dinero lleva procedencia inline + leyenda anti-insinuación; el vínculo "empresa ligada al parlamentario" se afirma solo con base RUT-exacta sólida, nunca por name-match ni LLM.
- [ ] **MONEY-05**: `MONEY_PUBLIC_ENABLED` permanece OFF hasta el sign-off legal humano (Ley 21.719); el agente construye TODO hasta el gate deny-by-default, el encendido es acto humano autorizado por el operador.

### DEUDA — Cierre técnico + hardening (backlog v6.x)

- [ ] **DEBT-01**: Los conectores restantes cumplen las dos etapas LOCKED — `source_snapshot` a R2 crudo content-addressed — y soportan `--from-r2` (replay a Supabase sin volver a molestar la fuente). (Se funde con VOTO/MONEY: votos y dinero son precisamente los conectores hoy sin snapshot R2.)
- [ ] **DEBT-02**: El conector leylobby usa cursor incremental (no re-scrapea todo el histórico en cada corrida).
- [ ] **DEBT-03**: `CLOUDFLARE_API_TOKEN` cargado en CI → crons de novedades verdes en GitHub Actions sin fallback local manual.
- [ ] **DEBT-04**: El cron `leyes-weekly` rota round-robin sobre el corpus 3.657 para no diluir la frescura (hoy 80/sem sobre 3.657 deja proyectos sin refrescar).
- [ ] **DEBT-05**: La typography del island `.net-*` queda alineada al design system (fuera de contrato hoy: nombre 15px, banda 13px).
- [ ] **DEBT-06**: DB password de Supabase rotado (B26) — acción de operador en el dashboard, documentada.

## v2 Requirements

Diferidos a un milestone posterior. Reconocidos, no en este roadmap.

### VOTO avanzado (diferenciadores de alto riesgo)

- **VOTOX-01**: Comparativo de voto individual vs. la mayoría de su bancada/coalición — MUY ALTO riesgo de insinuación; requiere sign-off y va detrás de flag; el producto es válido sin él.
- **VOTOX-02**: Detección de "votos cruzados" entre coaliciones — mismo riesgo; diferido.

### DINERO avanzado

- **MONEYX-01**: Cruce dinero × voto × timeline por sector (¿el aporte precede al voto?) — MUY ALTO riesgo "máquina de sospechas"; co_votación excluida del MVP (17-LEGAL-DOSSIER §2); diferido tras sign-off.

## Out of Scope

Exclusiones explícitas. Documentadas para prevenir scope creep y difamación.

| Feature | Reason |
|---------|--------|
| Score de ideología / liderazgo (estilo GovTrack) | El propio GovTrack advierte que "puede estar midiendo otra cosa" y fluctúa por azar; contamos, no calificamos (riesgo existencial #2) |
| Etiqueta cualitativa de postura ("consistently voted for X", estilo TheyWorkForYou) | Cruza la línea anti-insinuación; nosotros describimos el hecho del voto, no lo interpretamos |
| "Compró/financió su voto" o cualquier afirmación causal dinero→voto | Regla rectora: nunca causalidad ni motivo; linter anti-insinuante lo bloquea |
| Contar ausencias como postura | Ausente/pareo/licencia no son interpretables sin datos de whip (que no tenemos) — TheyWorkForYou los excluye por lo mismo |
| Exposición pública de RUT y datos de familiares | Uso interno para reconciliar identidad; minimización por diseño (Ley 21.719) |
| Vínculo "empresa ligada" por name-match o LLM | Personas jurídicas solo por RUT exacto, fail-closed — un vínculo falso es difamatorio (riesgo #1) |
| Encender MONEY/NET/cruces sin sign-off legal | Acto humano exclusivo; ningún agente flipea `*_PUBLIC_ENABLED` |

## Traceability

Se completa durante la creación del roadmap (gsd-roadmapper). Cada requisito mapea a exactamente una fase.

| Requirement | Phase | Status |
|-------------|-------|--------|
| VOTO-01 | Phase 66 (Cámara) + Phase 67 (Senado) | Pending |
| VOTO-02 | Phase 68 | Pending |
| VOTO-03 | Phase 65 | Complete |
| VOTO-04 | Phase 68 | Pending |
| VOTO-05 | Phase 64 (enabler) + Phase 68 (declarada) | In Progress |
| RUT-01 | Phase 69 | Pending |
| MONEY-01 | Phase 70 | Pending |
| MONEY-02 | Phase 71 | Pending |
| MONEY-03 | Phase 72 | Pending |
| MONEY-04 | Phase 73 | Pending |
| MONEY-05 | Phase 73 | Pending |
| DEBT-01 | Phase 66 (votos) + Phase 70/71 (dinero) — fundido | Pending |
| DEBT-02 | Phase 74 | Pending |
| DEBT-03 | Phase 74 | Pending |
| DEBT-04 | Phase 74 | Pending |
| DEBT-05 | Phase 75 | Pending |
| DEBT-06 | Phase 75 | Pending |

**Coverage:**

- v1 requirements: 17 total (VOTO×5, RUT×1, MONEY×5, DEBT×6)
- Mapped to phases: 17/17 ✓ (Phases 64-75)
- Unmapped: 0 · Orphaned: 0 · Duplicates: 0

**Nota de asignación:** cada requisito mapea a EXACTAMENTE una fase de entrega. VOTO-01 y DEBT-01 listan dos fases porque su alcance abarca ambas cámaras / ambos frentes (Cámara+Senado, votos+dinero), pero ninguna fase reclama el requisito como suyo en solitario de forma duplicada — el criterio de éxito de cada fase cubre su porción.

---
*Requirements defined: 2026-07-13*
*Last updated: 2026-07-13 after v7.0 research synthesis*
