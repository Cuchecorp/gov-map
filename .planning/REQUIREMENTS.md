# Requirements: Observatorio del Congreso 360 — Milestone v7.0 (Votos, dinero y cierre técnico)

**Defined:** 2026-07-13
**Core Value:** La ciudadanía puede responder, sobre cualquier proyecto de ley o parlamentario, "qué pasó, cuándo y según qué fuente" — cada dato con fuente, fecha y enlace, sin afirmar intención ni causalidad.

> **Hallazgo rector del research (HIGH, convergente entre los 4 investigadores):** el código de AMBOS frentes ya existe desde v2.0 — `packages/votos/` (conector opendata.camara.cl `getVotacion_Detalle`, reconciliación DIPID fail-closed, migración 0019, RPCs, superficies) y `packages/dinero/` (ChileCompra mercadopublico.cl, SERVEL .xlsx/exceljs, harvest-rut, reconciliación RUT-exacta, migraciones 0023/0024, money-gate, materializador con token `lobby_sector_aporte` reservado en 0039). v7.0 es **WIRING dos-etapas + validación de endpoint LIVE + backfill de datos + GATING deny-by-default**, NO construcción net-new. Cada requisito se cumple ejecutando/cableando/verificando cobertura de código existente, no creando tablas/conectores/modelos. Detalle: `.planning/research/SUMMARY.md`.

## v1 Requirements

Requirements de este milestone. Cada uno mapea a una fase del roadmap.

### VOTO — Cómo vota el Congreso (P3, voto individual)

- [x] **VOTO-01**: El ciudadano puede ver cómo votó individualmente cada parlamentario en una votación de sala — el sentido literal (a favor / en contra / abstención / pareo / ausente), con fuente, fecha y enlace al registro oficial.
- [x] **VOTO-02**: El ciudadano puede ver, en la ficha del parlamentario, su historial de votos individuales por sesión/proyecto — descriptivo, nunca presentado como "alineamiento", "disciplina de bancada" ni "rebeldía" con carga de afinidad.
- [x] **VOTO-03**: Cada voto individual está reconciliado fail-closed contra la maestra de identidad (link solo si `confirmado`; un voto jamás se atribuye a la persona equivocada) — golden set DIPID→maestra validado ANTES del backfill masivo.
- [x] **VOTO-04**: Toda superficie de voto lleva leyenda anti-insinuación ("un voto es un hecho observable; ausente/pareo ≠ en contra; no medimos disciplina ni motivo") + provenance inline; el linter anti-vocabulario-insinuante cubre estas superficies.
- [x] **VOTO-05**: La cobertura del voto individual está DECLARADA honestamente en la UI (N/M sesiones cubiertas, techo por causa) — nunca se finge completitud; si el endpoint opendata falla a escala, fallback honesto a lo disponible.

### RUT — Prerrequisito de datos de la dimensión dinero

- [ ] **RUT-01** (mecanismo entregado; write remoto PENDING operador — bloqueante duro P5): La maestra de terceros (`entidad_tercero`) tiene RUT backfilleado para las entidades cruzables, con cobertura N/M declarada como techo honesto — bloqueante duro de TODO cruce de dinero. Guard (69-01) + cobertura (69-02) + runbook (69-03) LISTOS; la ESCRITURA REMOTA de RUTs reales DV-válidos es checkpoint de operador (cobertura HOY ≈ 0/M hasta poblar el seed). El RUT nunca se expone públicamente (minimización) ni cruza al LLM (LOCKED); personas jurídicas solo por RUT exacto, fail-closed.

### MONEY — Dimensión dinero (P5, SERVEL + ChileCompra), deny-by-default

- [x] **MONEY-01**: El ciudadano puede ver los contratos del Estado (ChileCompra / Mercado Público) de empresas ligadas por RUT, con fuente/fecha/enlace — construido detrás de `MONEY_PUBLIC_ENABLED` OFF.
- [x] **MONEY-02**: El ciudadano puede ver el financiamiento electoral declarado (SERVEL: aportes/gastos por elección) asociado por RUT — construido detrás del flag; frescura del dato SERVEL declarada (qué elección/período cubre).
- [x] **MONEY-03**: Los cruces dinero × sector aparecen como conteos factuales en `cruce_senal` (materializador extendido con `lobby_sector_aporte`) — nunca un score de correlación, nunca "financió su voto".
- [x] **MONEY-04**: Toda superficie de dinero lleva procedencia inline + leyenda anti-insinuación; el vínculo "empresa ligada al parlamentario" se afirma solo con base RUT-exacta sólida, nunca por name-match ni LLM.
- [x] **MONEY-05**: `MONEY_PUBLIC_ENABLED` permanece OFF hasta el sign-off legal humano (Ley 21.719); el agente construye TODO hasta el gate deny-by-default, el encendido es acto humano autorizado por el operador.

### DEUDA — Cierre técnico + hardening (backlog v6.x)

- [x] **DEBT-01**: Los conectores restantes cumplen las dos etapas LOCKED — `source_snapshot` a R2 crudo content-addressed — y soportan `--from-r2` (replay a Supabase sin volver a molestar la fuente). (Se funde con VOTO/MONEY: votos y dinero son precisamente los conectores hoy sin snapshot R2.)
- [x] **DEBT-02**: El conector leylobby usa cursor incremental (no re-scrapea todo el histórico en cada corrida).
- [x] **DEBT-03**: `CLOUDFLARE_API_TOKEN` cargado en CI → crons de novedades verdes en GitHub Actions sin fallback local manual.
- [x] **DEBT-04**: El cron `leyes-weekly` rota round-robin sobre el corpus 3.657 para no diluir la frescura (hoy 80/sem sobre 3.657 deja proyectos sin refrescar).
- [x] **DEBT-05**: La typography del island `.net-*` queda alineada al design system (fuera de contrato hoy: nombre 15px, banda 13px).
- [x] **DEBT-06**: DB password de Supabase rotado (B26) — acción de operador en el dashboard, documentada.

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
| VOTO-01 | Phase 66 (Cámara) + Phase 67 (Senado) | Complete |
| VOTO-02 | Phase 68 | Complete |
| VOTO-03 | Phase 65 | Complete |
| VOTO-04 | Phase 68 | Complete |
| VOTO-05 | Phase 64 (enabler) + Phase 68 (declarada) | In Progress |
| RUT-01 | Phase 69 | In Progress (write remoto PENDING operador) |
| MONEY-01 | Phase 70 | Complete |
| MONEY-02 | Phase 71 | Complete |
| MONEY-03 | Phase 72 | Complete |
| MONEY-04 | Phase 73 | Complete |
| MONEY-05 | Phase 73 | Complete |
| DEBT-01 | Phase 66 (votos) + Phase 70/71 (dinero) — fundido | Complete |
| DEBT-02 | Phase 74 | Complete |
| DEBT-03 | Phase 74 | Complete |
| DEBT-04 | Phase 74 | Complete |
| DEBT-05 | Phase 75 | Complete |
| DEBT-06 | Phase 75 | Complete |

**Coverage:**

- v1 requirements: 17 total (VOTO×5, RUT×1, MONEY×5, DEBT×6)
- Mapped to phases: 17/17 ✓ (Phases 64-75)
- Unmapped: 0 · Orphaned: 0 · Duplicates: 0

**Nota de asignación:** cada requisito mapea a EXACTAMENTE una fase de entrega. VOTO-01 y DEBT-01 listan dos fases porque su alcance abarca ambas cámaras / ambos frentes (Cámara+Senado, votos+dinero), pero ninguna fase reclama el requisito como suyo en solitario de forma duplicada — el criterio de éxito de cada fase cubre su porción.

---
*Requirements defined: 2026-07-13*
*Last updated: 2026-07-13 after v7.0 research synthesis*

---

# Requirements — Milestone v8.0 (Rediseño Bento)

**Defined:** 2026-07-15 · **Documento rector:** `.planning/MILESTONE-v8-bento.md` · **Mockup:** `.planning/design/bento/home-bento.dc.html`

> **Hallazgo rector:** el mockup está dibujado SOBRE la paleta y tipografía actuales del sitio (petróleo `--accent-product`, crema `--background`, civic tokens, Geist vía next/font — verificado por conversión HSL). v8.0 es **layout y primitivas** (grid bento, tiles radio 16px, contenedor 1120px, header sticky), NO migración de colores. Regla: cero hex nuevos en componentes; todo color referencia tokens existentes.

## v8 Requirements

- [ ] **BENTO-01**: Existen las primitivas bento (`BentoGrid` 6-col gap 14px, `BentoTile` variants default/accent con spans 2/4/6, tokens `--radius-tile` 16px + `--radius-control` 11px) y el chrome global del mockup (header sticky con contenedor 1120px, footer border-top sin fondo) — sin cambiar aún el layout interno de ninguna página.
- [ ] **BENTO-02**: La mitad superior de la home es el bento del mockup: hero span-4 (kicker Geist Mono uppercase + copy LOCKED intacto + SearchBox reestilada + pills LOCKED a 44px), tile acento teal "¿Cómo leer esto?" span-2 (copy alineado a /sobre, CTA a metodología), y 3 tarjetas de entrada span-2 con marcador diamante + flecha →.
- [ ] **BENTO-03**: La actualidad vive como tiles del grid: "Votado esta semana" span-4 (barra 3px por cámara con civic tokens, tally mono, "Fuente ↗" por ítem), "Urgencias vigentes" span-2 (chip pill tipo suma/simple), strip "Última actualización" span-6 — mismas queries/RPCs de hoy, empty states honestos, el ActualidadModule lineal viejo retirado.
- [ ] **BENTO-04**: Las rutas interiores reciben coherencia ACOTADA (contenedor 1120px + `--radius-tile` en tarjetas de primer nivel) sin re-layout interno; `/red` tratado como decisión consciente con verificación visual propia si el ancho cambia.
- [ ] **BENTO-05**: El bento es responsive (colapso ≤md a 1 columna con orden definido), accesible (focus-visible, contraste AA en tile acento, 44px touch targets, landmarks) y tiene par dark derivado de los tokens dark existentes.
- [ ] **BENTO-06**: Candados de régimen verdes y mordiendo (mutation self-check): cero-hex-hardcodeado en componentes bento, guard tipográfico extendido a tiles, linter anti-insinuación cubre el copy nuevo de home si roza votos/dinero.
- [ ] **BENTO-07**: El bento está EN VIVO (deploy Docker+wrangler) con verificación visual BrowserOS archivada (home desktop/móvil vs mockup, 1 ruta interior por tipo, `/red` no-regresión) y el gate humano de lectura fría queda documentado como handoff si el operador no está presente.

## Decisiones D1-D4 (RESUELTAS por delegación del operador, 2026-07-15 — "corra entero de modo autónomo")

- **D1 = conservar copy LOCKED** (h1 "Qué pasó con cada proyecto…", cursiva "Con la fuente a la vista.", trust line, 4 pills). El h1 del mockup NO entra. Se AÑADE el kicker mono "OBSERVATORIO DEL CONGRESO".
- **D2 = marcador diamante** (default del mockup).
- **D3 = propagación acotada**: chrome global + contenedor + radios de primer nivel; re-layout interior de /buscar//parlamentarios//agenda/fichas queda FUERA (v9).
- **D4 = token nuevo `--radius-tile`**: `--radius` shadcn (8px) NO se toca; cero regresión de forma en rutas interiores.

## Out of Scope (v8)

| Feature | Reason |
|---------|--------|
| Re-layout interno de rutas interiores | D3: solo chrome+radios; v9 si se quiere |
| Rediseño del grafo /red | Layout B recién aprobado 2026-07-13; island `.net-*` pixel-intocable |
| Animaciones del grid | El mockup no las define |
| Cambios de datos/RPCs/schema | v8 es 100% presentación |
| Copy o datos placeholder del mockup en producción | Datos de ejemplo inventados (tallies, títulos) — riesgo de fabricación |

## Traceability (v8)

| Requirement | Phase | Status |
|-------------|-------|--------|
| BENTO-01 | Phase 76 | Pending |
| BENTO-02 | Phase 77 | Pending |
| BENTO-03 | Phase 78 | Pending |
| BENTO-04 | Phase 79 | Pending |
| BENTO-05 | Phase 80 | Pending |
| BENTO-06 | Phase 80 | Pending |
| BENTO-07 | Phase 81 | Pending |

**Coverage:** 7/7 mapped (Phases 76-81) · Unmapped: 0 · Orphaned: 0

---
*v8 requirements defined: 2026-07-15 (delegación D1-D4 incluida)*
