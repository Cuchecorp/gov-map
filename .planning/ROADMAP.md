# Roadmap: Observatorio del Congreso 360

**Core Value:** La ciudadanía puede responder, sobre cualquier proyecto de ley o parlamentario, "qué pasó, cuándo y según qué fuente" — cada dato lleva fuente, fecha y enlace original, sin afirmar intención ni causalidad.

## Milestones

- ✅ **v1.0 MVP — Proyectos de Ley + Fundaciones de Identidad** — Phases 1-7 (shipped 2026-06-18)
- ✅ **v2.0 — Parlamentarios 360** — Phases 8-18 (voto individual, lobby/patrimonio, dinero, grafo de influencia) — shipped (gates F13/F17 = sign-off humano)
- ✅ **v3.0 — Cobertura de datos** — Phases 23-32 (lobby con identidad adjudicada, patrimonio LIVE, votaciones masivas, provenance) — shipped
- ✅ **v4.0 — De datos a cruces verificables** — Phases 33-43 — cruces ENCENDIDOS; lockdown API resuelto vía Camino A (sitio en service_role, anon muerta, web_reader dropeado; cutover a PROD 2026-06-26)
- ✅ **v5.0 — De datos a comprensión (legibilidad + análisis)** — Phases 44-55 — shipped 2026-07-08 (`74e3ad0f`). Audit: milestones/v5.0-MILESTONE-AUDIT.md
- ✅ **v6.0 — Confiabilidad y comprensión** — Phases 56-61 (ingesta E2E confiable, autores F48, ícono, comprensión BrowserOS) — shipped 2026-07-09
- ✅ **v6.1 — Entendible y completo** — Phases 62-63 (/red ego-network radial + búsqueda corpus completo declarado) — shipped 2026-07-11
- ✅ **v7.0 — Votos, dinero y cierre técnico** — Phases 64-75 — CODE-COMPLETE 2026-07-15; **ARCHIVADO 2026-07-27** (fases → milestones/v7.0-phases/). Deuda de operador documentada (RUT-01, backfills LIVE, CF secrets/B26, MONEY OFF honesto)
- ✅ **v8.0 — Rediseño Bento** — Phases 76-81 — shipped 2026-07-15 (`fb88c8a4`); archivo: milestones/v8.0-ROADMAP.md
- ✅ **v8.1 — Demo perfecto** — Phases 82-85 — shipped 2026-07-15 (`3563ecc9`); archivo: milestones/v8.1-ROADMAP.md
- ✅ **v9.0 — Robustez de productos estrella + seguridad final** — Phases 86-96 — shipped 2026-07-23 (deploy `09f1d5c2`, CSP enforced, audit PASSED 29/29); archivo: milestones/v9.0-ROADMAP.md
- ✅ **v10.0 — Panel de actualidad + notificaciones + relaciones** — Phases 97-104 — shipped 2026-07-26 (deploy `e89b79af`, audit PASSED 25/25, VSIM ON, NOTIF inerte); archivo: milestones/v10.0-ROADMAP.md
- ✅ **v11.0 — Capa LLM escalonada + cierre de deuda viva** — Phases 105-112 — shipped 2026-07-27 (audit 20/24, 4 deferred operator-debt); archivo: milestones/v11.0-ROADMAP.md
- 🏗️ **v12.0 — Validación general producto-a-producto** — Phases 113-125 (EN CURSO)

> El cuerpo detallado de los roadmaps anteriores a v12.0 vive en `milestones/` (incluye `PRE-v12.0-ROADMAP-archive.md` con el detalle histórico de v7.0/v11.0).

## 🏗️ v12.0 — Validación general producto-a-producto (EN CURSO)

**Milestone Goal:** Todo el sitio queda validado empíricamente producto por producto (cada página × dato real × fuente): links y fechas verificados, crons robustos con la escalera LLM encendida donde el benchmark aprobó, y cruces + estructura Supabase auditados — en modo validar-y-arreglar.

**Mode:** yolo · **Granularity:** fine (fases MUY GRANULARES, precedente v9.0/v10.0/v11.0) · **Numbering:** continúa desde v11.0 (Phase 112 fue la última) → v12.0 arranca en **Phase 113**.

**Modo de trabajo (LOCKED):** corrida autónoma granular — agentes Sonnet ejecutan, validadores Opus validan, Fable (main loop) decide. Fix inline de lo delegable (código, migraciones aditivas, redeploy); solo lo destructivo/legal bloquea en checkpoint blocking-human. Flags no autorizados (MONEY, NOTIF) NO se tocan. Guards de régimen (anti-insinuación, lockdown, anti-flip) son la vara del validador.

**Reglas rectoras del milestone:**

- **Rate-limit 2-3s/host obligatorio** en toda verificación live contra fuentes gubernamentales (WAF). JAMÁS ráfagas. Links externos = patrón por construcción + muestra estratificada, nunca crawl exhaustivo (decisión operador 2026-07-27).
- **Gotcha de fechas LOCKED:** `fecha_captura` es el reloj de scraping y JAMÁS se presenta como la fecha del hecho ("según fuente al…" es el idiom; "captura" pelado prohibido). `citacion.fecha` es date-only: la parte UTC ES el día chileno, jamás convertir tz.
- **Nada destructivo sin checkpoint:** fixes de Supabase = migraciones aditivas por `psql --single-transaction` + pgTAP contra el schema APLICADO (precedente 0055+), nunca `supabase db push`.

### Coverage

- v12.0 requirements: 13 (LINK×3, FECHA×2, CRON×4, CRUCE×1, SUPA×2, E2E×1)
- Mapped to phases (113-125): 13/13 ✓
- Orphaned: 0 · Duplicates: 0

### Build order

```
INVENTARIO (rector — alimenta links, fechas, cruces y E2E):
  113 (inventario de superficies)
        ├► 114 (links internos exhaustivos sobre el deploy)
        ├► 115 (patrones de link externo + muestra live estratificada)
        ├► 116 (auditoría semántica de fechas) ──► 117 (correcciones de etiquetas)
        └► 122 (cruces × SQL de PROD)

CRONS (paralelizable con el carril producto):
  118 (auditoría E2E por cron) ──► 119 (robustez) ──► 120 (flip clasificación, checkpoint operador) ──► 121 (extensión documentada)

SUPABASE (paralelizable):
  123 (auditoría con supabase-reviewer como gate) ──► 124 (migraciones aditivas + pgTAP)

CIERRE:
  125 (deploy + pasada E2E BrowserOS) ← depende de 114, 115, 117, 119, 120, 122, 124
```

Notas de secuencia: el inventario 113 es load-bearing — sin él las fases de links y fechas no tienen denominador. Los fixes de UI (114/117) deben estar DESPLEGADOS antes de 125 (un deploy puede agrupar fixes de varias fases, precedente v10.0). El flip de 120 es lo único que exige provisión de keys por el operador.

### Phases

- [x] **Phase 113: INV — Inventario rector de superficies** — toda ruta pública × links que emite (internos/externos por tipo) × fechas que muestra (con su columna de origen); artefacto rector del milestone (completed 2026-07-27)
- [x] **Phase 114: LINK-INT — Links internos exhaustivos** — cero 404 y cero anclas rotas verificados sobre el deploy real, con corrida reproducible (completed 2026-07-28)
- [x] **Phase 115: LINK-EXT — Patrones de link a fuente oficial** — validación por construcción + muestra live estratificada por tipo/host con rate-limit 2-3s; patrón malo se arregla, fuente caída se declara (completed 2026-07-28)
- [x] **Phase 116: FECHA-AUDIT — Semántica de cada fecha visible** — veredicto hecho/captura/ambigua por fecha, cruzado contra dato real de PROD (completed 2026-07-28)
- [x] **Phase 117: FECHA-FIX — Etiquetas de fecha corregidas** — "según fuente al…" donde corresponda; `fecha_captura` nunca como el hecho; guards y suite verdes (completed 2026-07-28)
- [x] **Phase 118: CRON-AUDIT — Veredicto por cron con evidencia** — GH Actions + pg_cron enumerados y clasificados verde/stale/roto con causa (completed 2026-07-28)
- [ ] **Phase 119: CRON-FIX — Robustez de ingesta** — reintentos/backoff, cursores, hash-check, señales freshness; degrade honesto, jamás fabricación
- [ ] **Phase 120: ESCALERA-ON — Flip `CLASIFICACION_ESCALERA=1`** — shadow-eval verde + drift canary + rollback-by-config probado + checkpoint de provisión de keys Workers AI con el operador
- [ ] **Phase 121: ESCALERA-DOC — Extensión solo con benchmark** — estado por tarea (extendida/no) con su evidencia; adjudicación INTOCABLE por decisión
- [ ] **Phase 122: CRUCE-SQL — Cruces visibles × SQL de PROD** — conteos, denominadores honestos y cobertura declarada cuadran; discrepancias corregidas o declaradas
- [ ] **Phase 123: SUPA-AUDIT — Auditoría de estructura Supabase** — schema/RLS/grants/RPCs bounded/allowlist/secdef contra la DB viva, supabase-reviewer como gate
- [ ] **Phase 124: SUPA-FIX — Migraciones aditivas a PROD** — fixes por `psql --single-transaction` + pgTAP contra schema aplicado + re-audit 0 offenders
- [ ] **Phase 125: E2E — Pasada final producto-a-producto sobre el deploy real** — BrowserOS por superficie post-deploy; links, fechas y cruces re-verificados; flags no autorizados OFF

## Phase Details

### Phase 113: INV — Inventario rector de superficies

**Goal**: Existe un artefacto único y exhaustivo que enumera toda ruta pública del sitio con los links que emite y las fechas que muestra, y que alimenta las fases de links, fechas, cruces y la pasada E2E.
**Depends on**: Nothing (primera fase de v12.0)
**Requirements**: LINK-01
**Componentes**: NET-NEW (documento de inventario) + EJECUCIÓN (enumeración de rutas por filesystem + sujetos concretos elegidos por SQL contra PROD)
**Success Criteria** (what must be TRUE):

  1. Un lector puede abrir el inventario y ver cada ruta pública del sitio —incluidas las dinámicas, con sujetos concretos reales elegidos por SQL— sin tener que leer el código
  2. Por cada ruta, el inventario lista los links que emite, clasificados internos vs externos, y los externos por tipo de fuente (camara.cl, senado.cl, BCN, leylobby)
  3. Por cada ruta, el inventario lista cada fecha visible con su columna/RPC de origen, quedando MARCADAS las que provienen de `fecha_captura`
  4. El inventario declara su método y su cobertura (qué se enumeró exhaustivo vs por muestra) — cero rutas "asumidas" sin evidencia

**Plans**: 6 plans

Plans:
**Wave 1**

- [x] 113-01-PLAN.md — (w1) Método + 5 sujetos deterministas por SQL + gates observados + script de checklist

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 113-02-PLAN.md — (w2) Chrome compartido + catálogo de emisores E-NNN

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 113-06-PLAN.md — (w3) Chokepoints (ProvenanceBadge DUAL + safeExternalHref), 4 builders, URL-desde-columna

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 113-03-PLAN.md — (w4) Rutas dinámicas densas: /parlamentario/[id], /proyecto/[boletin], /contraparte/[id]

**Wave 5** *(blocked on Wave 4 completion)*

- [x] 113-04-PLAN.md — (w5) 12 rutas restantes + not-found + Tabla D de cobertura

**Wave 6** *(blocked on Wave 5 completion)*

- [x] 113-05-PLAN.md — (w6) Gate de cierre: checklist estricto + validador Opus independiente (7 criterios, 2 rondas)

### Phase 114: LINK-INT — Links internos exhaustivos

**Goal**: Ningún link interno del sitio lleva a un 404 ni a un ancla inexistente, verificado sobre el deploy real.
**Depends on**: Phase 113
**Requirements**: LINK-02
**Componentes**: EJECUCIÓN (verificación sobre el deploy) + MODIFICADO (fixes de links/anclas en las superficies afectadas)
**Success Criteria** (what must be TRUE):

  1. Cada link interno emitido por las rutas del inventario 113 fue solicitado contra el deploy real y devolvió respuesta no-404
  2. Cada ancla `#id` referenciada existe en el DOM de la página destino (no basta con que la página cargue) — precedente scroll-margin/`section[id]` de v8.0
  3. Todo link o ancla roto quedó corregido en el código, con evidencia antes/después
  4. La corrida de verificación es reproducible (comando + salida guardada), no un chequeo manual irrepetible

**Plans**: 3 plans
**UI hint**: yes

Plans:
**Wave 1**

- [x] 114-01-PLAN.md — (w1) Manifiesto del universo de links + runner reproducible + corrida PRE-FIX

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 114-02-PLAN.md — (w2) Veredicto de anclas (SSR + fallback BrowserOS) + lista cerrada de hallazgos

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 114-03-PLAN.md — (w3) Fixes con evidencia antes/despues + corrida POST-FIX + no-regresion + cierre

### Phase 115: LINK-EXT — Patrones de link a fuente oficial

**Goal**: Todo enlace a la fuente oficial que el sitio genera está validado sin martillar los servidores gubernamentales: por construcción del patrón + muestra live estratificada por tipo.
**Depends on**: Phase 113
**Requirements**: LINK-03
**Componentes**: EJECUCIÓN (probes live acotadas) + MODIFICADO (fixes de patrón / declaración honesta en UI)
**Success Criteria** (what must be TRUE):

  1. Cada patrón de URL externa que el sitio construye está enumerado con su fuente, su plantilla y el dato que lo parametriza (boletín, prmID, idNorma, id de audiencia), y probado por construcción con casos reales
  2. Existe una muestra live estratificada —al menos un caso por patrón y por host— con su respuesta registrada, respetando rate-limit 2-3s/host, User-Agent identificatorio y robots.txt; cero ráfagas
  3. Todo patrón roto, o que apunta a una página genérica en vez del recurso específico, quedó corregido — o su limitación quedó declarada honestamente en la UI
  4. El resultado distingue "patrón malo" (defecto nuestro, se arregla) de "fuente caída / WAF" (se declara, jamás se evade)

**Plans**: 3 plans

Plans:
**Wave 1**

- [x] 115-01-PLAN.md — (w1) Universo cerrado de patrones + exclusiones con razón + runner curl-first rate-limited + robots.txt por host

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 115-02-PLAN.md — (w2) Muestra live estratificada con evidencia de rate-limit + veredicto trinario por patrón (candidatos #1 y #2 resueltos)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 115-03-PLAN.md — (w3) Linter extendido ANTES del copy + fixes con tests + re-probe acotado + veredicto de los 4 SC (deploy diferido a 125)

### Phase 116: FECHA-AUDIT — Semántica de cada fecha visible

**Goal**: Se sabe, para cada fecha que el sitio muestra, si representa el hecho o la captura — y cuáles están mal etiquetadas.
**Depends on**: Phase 113
**Requirements**: FECHA-01
**Componentes**: EJECUCIÓN (auditoría código + dato real) → documento de hallazgos con archivo:línea
**Success Criteria** (what must be TRUE):

  1. Cada fecha del inventario 113 tiene veredicto explícito —fecha del hecho / fecha de captura / ambigua— con su columna de origen citada
  2. Toda ocurrencia donde `fecha_captura` se presenta como si fuera el hecho queda listada con archivo:línea y superficie
  3. Las fechas date-only del Congreso (p.ej. `citacion.fecha`, medianoche UTC = día chileno) quedan verificadas contra el gotcha LOCKED: no se convierten de zona horaria
  4. El veredicto está cruzado contra el dato real en PROD (un sujeto concreto por superficie), no solo contra el código

**Plans**: 4 plans

Plans:
**Wave 1**

- [x] 116-01-PLAN.md — Base compartida: semántica por formatter + chokepoint ProvenanceBadge

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 116-02-PLAN.md — Veredicto grupo A: carril parlamentario, /comparar, /cuenta, gate MONEY
- [x] 116-03-PLAN.md — Veredicto grupo B: /proyecto, /agenda, home, /buscar + auditoría date-only

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 116-04-PLAN.md — Cruce PROD + ensamblado 116-FECHAS-AUDIT.md + hallazgos F-xx + check-fechas.sh

### Phase 117: FECHA-FIX — Etiquetas de fecha corregidas

**Goal**: Ninguna fecha del sitio miente ni queda ambigua: el usuario siempre distingue cuándo pasó el hecho de cuándo lo capturamos.
**Depends on**: Phase 116
**Requirements**: FECHA-02
**Componentes**: MODIFICADO (copy y formateo de fecha en las superficies afectadas)
**Success Criteria** (what must be TRUE):

  1. Cada hallazgo de 116 está corregido o declarado, sin excepciones silenciosas
  2. Las fechas de captura se presentan con el idiom LOCKED "según fuente al…" (o equivalente aprobado), jamás como el hecho — el término "captura" pelado sigue prohibido
  3. Los guards de régimen (anti-insinuación, linter de copy, negaciones LOCKED) siguen verdes tras los cambios de texto
  4. Suite de app + packages y typecheck quedan verdes con los cambios incluidos

**Plans**: 4 plans (3 waves)

- [x] 117-01-PLAN.md — Capa: linter-first + formatters (F-10, helpers F-05/F-04) + chokepoint ProvenanceBadge (F-01, F-11)
- [x] 117-02-PLAN.md — Carril proyecto: F-03, F-04, F-05, F-07, F-09, F-13
- [x] 117-03-PLAN.md — Carril parlamentario/lobby/cruces/MONEY: F-02, F-05, F-07, F-08
- [x] 117-04-PLAN.md — Home (F-06, F-14) + /buscar (F-12) + F-11 documental + 117-DISPOSICION.md + verificacion global

**UI hint**: yes

### Phase 118: CRON-AUDIT — Veredicto por cron con evidencia

**Goal**: Se sabe empíricamente qué ingesta programada está viva, cuál está stale y cuál está rota — con evidencia por cron, no por lectura del YAML.
**Depends on**: Nothing (carril independiente)
**Requirements**: CRON-01
**Componentes**: EJECUCIÓN (probes gh / psql / R2 / `pnpm freshness`) → documento de veredictos + gaps priorizados
**Success Criteria** (what must be TRUE):

  1. Todos los workflows de GitHub Actions y todos los jobs de `pg_cron` están enumerados; ninguno queda sin veredicto
  2. Cada cron tiene veredicto verde/stale/roto respaldado por evidencia observada (última corrida, última fila escrita, señal de freshness)
  3. Cada veredicto no-verde tiene causa identificada (secret ausente, cursor detenido, fuente WAF, entrypoint equivocado) apuntando a archivo o a dato — precedente gap 57-05 (el cron usaba otro entrypoint sin R2)
  4. Los gaps quedan priorizados como entrada ejecutable para la fase de fixes

**Plans**: 3 plans

Plans:
**Wave 1**

- [x] 118-01-PLAN.md — (w1) Probes de las 4 patas (gh / psql / freshness / source_snapshot) + esqueleto: método, inventario cerrado y tabla maestra con veredicto

**Wave 2**

- [x] 118-02-PLAN.md — (w2) Sección por unidad de cron (13 workflows + 2 platform-managed + N jobs pg_cron) + tablas de estado observado

**Wave 3**

- [x] 118-03-PLAN.md — (w3) Gap-list P0/P1/P2 para Phase 119 + assumptions resueltas + límites + checkpoint operador + check-crons.sh

### Phase 119: CRON-FIX — Robustez de ingesta

**Goal**: La ingesta programada degrada honesto en vez de fallar en silencio o fabricar: reintentos, cursores, hash-check y señales de frescura cerradas donde faltaban.
**Depends on**: Phase 118
**Requirements**: CRON-02
**Componentes**: MODIFICADO (conectores/workflows con gaps) + DOC (deuda de operador donde el fix exige un acto humano)
**Success Criteria** (what must be TRUE):

  1. Cada gap accionable de 118 está cerrado en código, o explícitamente diferido como deuda de operador con su razón y sus pasos
  2. Un cron que no puede obtener datos deja señal honesta (freshness stale, `[skip] sin novedades`, error visible) y JAMÁS escribe filas inventadas
  3. Las dos etapas LOCKED (fuente→R2 crudo content-addressed, R2→Supabase) y el hash-check-antes-de-descargar siguen respetados en cada conector tocado; rate-limit 2-3s intacto
  4. `pnpm freshness` refleja el estado real por fuente tras los fixes

**Plans**: 7 plans

Plans:
**Wave 1**

- [x] 119-01-PLAN.md — (w1) Instrumento de frescura: G10 tsx + G2 workflowYml null + G4 verde prestado (ghRun en el stale)
- [x] 119-03-PLAN.md — (w1) G6 `existed` -> `[skip] sin novedades` en agenda, probidad e identity

**Wave 2** *(blocked on Wave 1 completion)*

- [ ] 119-02-PLAN.md — (w2) G3 cobertura de frescura: actualidad-refresh + senal pg_cron + huecos declarados
- [ ] 119-04-PLAN.md — (w2) G5 SnapshotWriter en agenda, identity y lobby-leylobby (source_snapshot 2 -> 5 fuentes)

**Wave 3** *(blocked on Wave 2 completion)*

- [ ] 119-05-PLAN.md — (w3) G7 `--from-r2` en agenda y probidad + W-9 lobby-camara re-procesable desde R2
- [ ] 119-06-PLAN.md — (w3) G1 cursor `lobby_ingesta_estado` + G9 parte YAML (remapeo SUPABASE_URL)

**Wave 4** *(blocked on Wave 3 completion)*

- [ ] 119-07-PLAN.md — (w4) Re-verificacion G8/G9-gemini/G11 + bateria de regimen + `119-GAP-CLOSURES.md`

### Phase 120: ESCALERA-ON — Flip `CLASIFICACION_ESCALERA=1`

**Goal**: La escalera LLM queda encendida en la única tarea donde el benchmark la aprobó (clasificación), con red de seguridad para apagarla por config.
**Depends on**: Phase 119
**Requirements**: CRON-03
**Componentes**: EJECUCIÓN (shadow-eval LIVE + drift canary ya construidos en 109-03) + CHECKPOINT operador (provisión de keys Workers AI)
**Success Criteria** (what must be TRUE):

  1. La shadow-eval Granite vs DeepSeek corre LIVE y resulta verde ANTES de cualquier flip; si no lo es, el flip no ocurre y eso queda documentado
  2. El drift canary confirma que el modelo servido es el mismo que produjo el veredicto full-40; un mismatch invalida el veredicto y aborta el flip
  3. El rollback-by-config está probado: quitar `CLASIFICACION_ESCALERA` devuelve el comportamiento DeepSeek incumbente byte-idéntico, sin migración ni deploy especial
  4. `CLASIFICACION_ESCALERA=1` queda activo solo DESPUÉS del checkpoint de provisión de keys con el operador — el agente jamás carga la key ni firma el flip
  5. La adjudicación de identidad y la extracción strict-schema permanecen intocadas (integ-scope-guard + provider-guard verdes)

**Plans**: TBD

### Phase 121: ESCALERA-DOC — Extensión solo con benchmark

**Goal**: Queda registrado, tarea por tarea, por qué la escalera se extiende o no — de modo que nadie la extienda por intuición.
**Depends on**: Phase 120
**Requirements**: CRON-04
**Componentes**: DOC (estado por tarea con la evidencia del veredicto full-40 de v11.0)
**Success Criteria** (what must be TRUE):

  1. Cada tarea LLM (routing, clasificación, juez, extracción, adjudicación) tiene estado explícito —extendida / no extendida— con la evidencia de benchmark que lo respalda
  2. Las tareas sin benchmark de paridad quedan marcadas NO extendidas, citando la regla LOCKED "ante la duda, siempre calidad" (routing flipeó a incumbent-stays en full-40; extracción vetada por es-CL)
  3. La adjudicación de identidad queda marcada INTOCABLE por decisión explícita, no por omisión
  4. El documento dice qué evidencia concreta haría falta para extender cada tarea pendiente

**Plans**: TBD

### Phase 122: CRUCE-SQL — Cruces visibles × SQL de PROD

**Goal**: Ningún número de cruce mostrado en el sitio difiere de lo que dice la base: conteos, denominadores y cobertura declarada cuadran.
**Depends on**: Phase 113
**Requirements**: CRUCE-01
**Componentes**: EJECUCIÓN (recálculo SQL verbatim contra PROD + comparación con el deploy) + MODIFICADO (fixes de conteo/denominador/declaración)
**Success Criteria** (what must be TRUE):

  1. Cada cruce visible —relaciones entre parlamentarios, `/comparar` (incl. VSIM), cruces de ficha y de proyecto, panel de actualidad, lobby↔PL— está recalculado con SQL verbatim contra PROD y comparado con lo que muestra el deploy
  2. Todo denominador mostrado es el honesto (excluye lo no confirmado donde corresponde) y su cobertura queda declarada donde es parcial
  3. Toda discrepancia queda corregida o declarada, con la query y ambos números registrados
  4. Los vacíos siguen siendo vacíos honestos: cero filas se presenta como cero, jamás se rellena; el copy sigue sin insinuar causalidad

**Plans**: TBD

### Phase 123: SUPA-AUDIT — Auditoría de estructura Supabase

**Goal**: La superficie de datos queda auditada como boundary de seguridad real — cada tabla, política, grant y RPC pública revisada contra la DB viva.
**Depends on**: Nothing (carril independiente)
**Requirements**: SUPA-01
**Componentes**: EJECUCIÓN (subagente `supabase-reviewer` como gate + queries a la DB viva)
**Success Criteria** (what must be TRUE):

  1. El subagente supabase-reviewer emite veredicto sobre schema, RLS, grants, RPCs bounded, `PUBLIC_RPC_ALLOWLIST` y security-definer/`search_path`, y ese veredicto ES el gate
  2. La auditoría corre contra la DB viva, no solo contra los archivos de migración (precedente: `pg_depend deptype=e` y las 0059-0068 aplicadas sin traza en `schema_migrations`)
  3. Cada offender queda listado con su riesgo y su fix propuesto; "0 offenders" se demuestra con la consulta, no se afirma
  4. Los guards existentes (lockdown Block A-E, Direction-B allowlist) siguen verdes y se EXTIENDEN si el audit encontró un punto ciego

**Plans**: TBD

### Phase 124: SUPA-FIX — Migraciones aditivas a PROD

**Goal**: Los defectos de estructura encontrados quedan corregidos en PROD sin nada destructivo y con no-regresión demostrable.
**Depends on**: Phase 123
**Requirements**: SUPA-02
**Componentes**: NET-NEW (migraciones numeradas aditivas + pgTAP) + EJECUCIÓN (apply a PROD)
**Success Criteria** (what must be TRUE):

  1. Cada fix viaja como migración aditiva numerada (precedente 0055+), nunca como cambio destructivo sin checkpoint blocking-human
  2. Las migraciones se aplican a PROD por `psql --single-transaction` con pre-checks fail-closed (`PGCLIENTENCODING=UTF8`), JAMÁS por `supabase db push`
  3. pgTAP corre contra el schema APLICADO y pasa, cubriendo específicamente el defecto que la migración arregla
  4. La re-corrida del audit de 123 sobre la DB viva da 0 offenders en lo corregido

**Plans**: TBD

### Phase 125: E2E — Pasada final producto-a-producto sobre el deploy real

**Goal**: Alguien puede recorrer el sitio producto por producto sobre el deploy real y confirmar que todo lo validado en el milestone sigue verde después de los fixes.
**Depends on**: Phases 114, 115, 117, 119, 120, 122, 124
**Requirements**: E2E-01
**Componentes**: EJECUCIÓN (deploy Cloudflare + BrowserOS por superficie + re-verificaciones)
**Success Criteria** (what must be TRUE):

  1. Los fixes de UI de links y fechas están desplegados a Cloudflare ANTES de la pasada (un deploy puede agrupar fixes de varias fases, precedente v10.0)
  2. Cada superficie del inventario 113 se recorre con BrowserOS sobre el deploy real, con evidencia DOM por superficie
  3. Los links internos y una muestra de links externos se re-verifican post-deploy y siguen resolviendo (rate-limit respetado)
  4. Las fechas visibles siguen correctamente etiquetadas y los cruces siguen cuadrando contra SQL en el deploy final
  5. Los flags no autorizados (MONEY, NOTIF) siguen OFF y ausentes del DOM; guards de régimen y suite verdes

**Plans**: TBD
**UI hint**: yes

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 113. INV | 6/6 | Complete    | 2026-07-28 |
| 114. LINK-INT | 3/3 | Complete    | 2026-07-28 |
| 115. LINK-EXT | 3/3 | Complete    | 2026-07-28 |
| 116. FECHA-AUDIT | 4/4 | Complete    | 2026-07-28 |
| 117. FECHA-FIX | 4/4 | Complete    | 2026-07-28 |
| 118. CRON-AUDIT | 3/3 | Complete    | 2026-07-28 |
| 119. CRON-FIX | 2/7 | In Progress|  |
| 120. ESCALERA-ON | 0/? | Not started | - |
| 121. ESCALERA-DOC | 0/? | Not started | - |
| 122. CRUCE-SQL | 0/? | Not started | - |
| 123. SUPA-AUDIT | 0/? | Not started | - |
| 124. SUPA-FIX | 0/? | Not started | - |
| 125. E2E | 0/? | Not started | - |

### Requirement coverage map (v12.0)

| Requirement | Phase |
|-------------|-------|
| LINK-01 | Phase 113 |
| LINK-02 | Phase 114 |
| LINK-03 | Phase 115 |
| FECHA-01 | Phase 116 |
| FECHA-02 | Phase 117 |
| CRON-01 | Phase 118 |
| CRON-02 | Phase 119 |
| CRON-03 | Phase 120 |
| CRON-04 | Phase 121 |
| CRUCE-01 | Phase 122 |
| SUPA-01 | Phase 123 |
| SUPA-02 | Phase 124 |
| E2E-01 | Phase 125 |

**Coverage: 13/13 · Orphaned: 0 · Duplicates: 0**

---
*v12.0 roadmap creado: 2026-07-27. Milestones anteriores archivados en `.planning/milestones/`.*
