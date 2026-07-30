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
- ✅ **v12.0 — Validación general producto-a-producto** — Phases 113-125 — shipped 2026-07-29 (deploy `0ea5d97f`; audit `tech_debt`: 11/13 reqs cerrados literalmente, 2 por declaración; **archivado CON la deuda** por decisión del operador); archivo: milestones/v12.0-ROADMAP.md
- 🔄 **v13.0 — Portada accionable + noticias vinculadas + cierre de deuda** — Phases 126-138 — IN PROGRESS

> El cuerpo detallado de los roadmaps anteriores vive en `milestones/` (incluye `PRE-v12.0-ROADMAP-archive.md` con el detalle histórico de v7.0/v11.0).

---

# Milestone v13.0 — Portada accionable + noticias vinculadas + cierre de deuda

**Goal:** La portada anuncia hechos legislativos con sujeto, fecha y link a la ficha (no contadores mudos); un cron de noticias vincula prensa a proyectos y parlamentarios con contrato anti-alucinación; y la deuda de v12.0 que daña al lector queda cerrada.

**Coverage:** 20/20 requirements de `REQUIREMENTS.md` mapeados (PANEL-01..09 · NEWS-01..07 · DEBT-01..04). Cero huérfanos, cero duplicados.

**Decisiones ya adjudicadas (spikes 2026-07-30 — NO re-abrirlas):** Opción A (poblar `evidencia` jsonb en `materializar_senales()`, migración 0080 aditiva) · worktrees ON (`use_worktrees: true`, precondiciones aplicadas) · VSIM ON verificado por comportamiento + sign-off legal verbatim del operador · tile materia MUERE (`sector_id` 1,8%) · flags PROD: NET/CRUCES/VSIM ON, MONEY/NOTIF OFF.

**Régimen por fase (LOCKED, forzado por config):** discuss granular → research → plan → premortem → plan-checker Opus + revisor Fable en los temas difíciles → executor Sonnet → verifier/code-review Opus. Spike ante toda decisión no obvia. Todo criterio visual se cierra con fragmento DOM + captura BrowserOS, jamás subjetivo. Reglas §4 del prompt de preparación son inviolables (identidad fail-closed, anti-insinuación, fechas date-only sin tz, migraciones por psql `--single-transaction` jamás `db push`, RPC nueva = aguja completa, dos etapas R2, flags jamás flipeados por agente, cero PII, vacío honesto, cero aprobados por silencio).

## Phases

**Orden de construcción:** 126 (Wave-0, rector) → carril panel 127→128→129; deuda 130 y 131 intercaladas (independientes del panel tras 126, paralelizables con worktrees); carril noticias 132→133→134→135→136→137; cierre 138 (deploy agrupado + BrowserOS final) depende de todo.

- [x] **Phase 126: PANEL-GUARDS** — Wave-0: guards ANTES de cualquier copy o vista (SUPERFICIES_PANEL, NEGACIONES_LOCKED, guard create view B-03) (completed 2026-07-30)
- [ ] **Phase 127: PANEL-MAT** — Materializador 0080: los 6 bloques pueblan `evidencia` con sujetos reales + guard 404 + grafía única (4-15)
- [ ] **Phase 128: PANEL-UI** — Contrato RPC/UI: tiles editoriales con sujetos nombrados, links con helper central, votaciones L4, semántica de fechas, cobertura declarada
- [ ] **Phase 129: PANEL-DISEÑO** — Loop de diseño BrowserOS con Opus hasta que quede bien; cierre por fragmento DOM + captura; entierra B-02 y H-01
- [ ] **Phase 130: VOTOS-REAL** — B-01: las fichas muestran el conteo REAL de votos (3.752, no 1000) con composición no distorsionada
- [ ] **Phase 131: DEBT-FICHA** — H-06 (regla de selección del timeline por query escrita) + 3.3 (co-autoría /comparar sin truncamiento, RPC v2 paralela)
- [ ] **Phase 132: NEWS-RSS** — Conector RSS dos-etapas LOCKED (robots + rate-limit + R2 crudo content-addressed) cerrando los 4 huecos de Is Chile Safe
- [ ] **Phase 133: NEWS-TAXO** — Taxonomía legislativa congelada + golden set con etiquetas revisadas ANTES de medir + thresholds pre-registrados
- [ ] **Phase 134: NEWS-RESOLVER** — Contrato anti-alucinación de tres piezas: lista cerrada → resolver determinista (reusa extraerBoletines) → dead-letter
- [ ] **Phase 135: NEWS-CLASIF** — Clasificador con evals como gate CI + elección de modelo por benchmark sobre TieredProvider + presupuesto con ledger
- [ ] **Phase 136: NEWS-CRON** — Cron de novedades diario L-V acotado e idempotente; backfill masivo LOCAL
- [ ] **Phase 137: NEWS-FICHAS** — Las fichas de proyecto y parlamentario muestran sus noticias vinculadas (cita pública, texto completo privado, carril PII)
- [ ] **Phase 138: E2E** — Deploy agrupado + pasada BrowserOS final sobre el deploy real

## Phase Details

### Phase 126: PANEL-GUARDS — Wave-0 de guards

**Goal**: El régimen muerde ANTES de que exista un solo archivo de copy o la primera vista del milestone — nada nuevo aterriza sin su guard esperándolo.
**Depends on**: Nothing (first phase — rector por mandato del operador §3.3)
**Requirements**: PANEL-08, DEBT-02
**Success Criteria** (what must be TRUE):

  1. Todo archivo nuevo previsto para el rediseño del panel está dado de alta en `SUPERFICIES_PANEL` antes de que exista su copy; el carril PANEL del linter anti-insinuación corre verde sobre el árbol actual y un mutation self-check demuestra que muerde (término prohibido inyectado — `señal`, `exprés`, `los más` — produce FAIL).
  2. `NEGACIONES_LOCKED` está extendido con los idioms nuevos aprobados (`Citado el …`, `Urgencia … vigente desde …`, `En tabla de sala de la Cámara del …`, `según fuente al …`) con self-check que prueba que la extensión no abre huecos.
  3. La aserción de guard para `create view` en `public` sin `security_invoker` existe y muerde: control positivo apareado (fixture de vista sin `security_invoker` → el guard FALLA; con `security_invoker` → verde). El cero deja de ser vacuo ANTES de la primera vista del milestone.
  4. Suite `app/` completa + los 14+ guards de régimen corren verdes (por nombre explícito, jamás por glob) tras la extensión.

**Plans**: 2 plans
Plans:
**Wave 1**

- [x] 126-01-PLAN.md — SUPERFICIES_PANEL + anti-drift + NEGACIONES_LOCKED/IDIOMS_APROBADOS + mutation self-checks (PANEL-08)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 126-02-PLAN.md — Guard B-03 create view sin security_invoker + script `guards` por nombre explícito (DEBT-02, criterio 4)

### Phase 127: PANEL-MAT — Materializador 0080 puebla los sujetos

**Goal**: La DB tiene los sujetos del hecho — cada señal positiva de `actualidad_senal` lleva en `evidencia` los boletines, títulos, fechas y enlaces que la UI va a nombrar. La arquitectura es la Opción A adjudicada por spike (no se re-abre).
**Depends on**: Phase 126
**Requirements**: PANEL-01, PANEL-06
**Success Criteria** (what must be TRUE):

  1. Tras correr `materializar_senales()`, cada señal positiva tiene `evidencia = {"total": N, "items": [...]}` con boletín/título/fecha/enlace/`en_corpus` por ítem; las filas de supresión conservan `'{}'` (verificado por `psql -tA` contra PROD, jamás por REST).
  2. Cero cap por recencia (anti-B-01): `total` == número de ítems en toda señal sin cap; `urgencias` emite sus ~95 eventos completos con grado. Si algún día se cappea, va por grado + `total` declarado — regla escrita en la migración.
  3. Guard 404 vivo en el `left join proyecto` del materializador: los ítems de agenda cuyo boletín no existe en `proyecto` (10/49 medidos) se emiten con `en_corpus:false` y título/enlace null — nunca inner-join; una query de paridad demuestra que el conteo jamás diverge del detalle.
  4. Grafía de cámara ÚNICA en las filas de `actualidad_senal` (fix 4-15/D2 en el materializador `0065:233,261`, no en el cliente) y frescura-de-fuente emitida por separado del hecho (habilita el footer `según fuente al …` de la fase UI).
  5. Migración `0080` aditiva aplicada por `PGCLIENTENCODING=UTF8 psql --single-transaction` (jamás `db push`; `0073`/`0075` intactas) + pgTAP contra el schema aplicado: evidencia poblada en positivas, `'{}'` en supresión, boletín fantasma sembrado → `en_corpus:false`.

**Plans**: 3 plans
Plans:
**Wave 1**

- [x] 127-01-PLAN.md — Migración 0080: `actualidad.grafia_camara` + los 6 bloques del proc pueblan `evidencia` con guard 404 (PANEL-01, PANEL-06)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 127-02-PLAN.md — pgTAP 0080 (evidencia/paridad/supresión/boletín fantasma) + fix del assert D2 de `0065_actualidad_senal.test.sql`

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 127-03-PLAN.md — Apply a PROD por `psql --single-transaction` + corrida del proc + las 7 verificaciones + ambos pgTAP + checkpoint de operador

### Phase 128: PANEL-UI — Contrato RPC/UI con sujetos, links y fechas correctas

**Goal**: La portada renderiza la propuesta editorial ratificada: cada tile nombra sujetos con verbo y fecha, cada ítem enlaza a su ficha, las votaciones L4 aparecen, y la semántica de fechas es correcta en todo el panel.
**Depends on**: Phase 127
**Requirements**: PANEL-02, PANEL-03, PANEL-04, PANEL-05, PANEL-07
**Success Criteria** (what must be TRUE):

  1. Cada ítem del panel nombra su sujeto (boletín + título + fecha con verbo explícito) y enlaza vía el helper central de links internos (nuevo) a `/proyecto/{b}#estado|#timeline|#votaciones` o `/agenda#...?semana=`; los ítems `en_corpus:false` se muestran como texto plano + enlace externo de la fuente — ningún link de agenda produce 404; fragmento DOM lo demuestra.
  2. La grilla renderiza la propuesta editorial con las decisiones O-1..O-7 ratificadas VERBATIM por el operador en la discusión de la fase (cero aprobados por silencio): sala-semana, comisiones citadas con chips urgencia↔citación (yuxtaposición de dos hechos fechados, jamás relación), urgencias por grado contando boletines (el "95" muere), movimiento reciente nombrado, ingresos/archivos como proyectos ("2 eventos de 1 proyecto"), y el tile materia AUSENTE del DOM (muere sin tombstone).
  3. Votaciones recientes (L4) visibles — VSIM ON verificado + sign-off legal dado 2026-07-30, cero flip requerido: una línea por votación (jamás agregada por boletín), Senado `resultado` NULL → "resultado no informado por la fuente" (jamás fabricar "Rechazado"), conteos de votantes solo confirmados (283.550, jamás 549k).
  4. Semántica de fechas de tres carriles: el hecho (pasado o futuro) vive en el cuerpo con verbo explícito (idioms aprobados); el footer lleva SOLO `Fuente: … · según fuente al …`; `"datos al"` = 0 ocurrencias en el HTML del panel (medido por `grep -o | wc -l`); `fecha_captura` jamás visible.
  5. Cobertura y asimetrías declaradas con denominador: "23 citaciones del Senado · 0 de la Cámara en las fuentes consultadas"; la tabla de Cámara presentada como "tabla semanal" (fila sintética `camara:sesion:2026-W31` — jamás fabricar "sesión N.º a las HH:MM"); vacío honesto con causa. Linter carril PANEL + suite verdes sobre el copy nuevo.

**Plans**: TBD
**UI hint**: yes

### Phase 129: PANEL-DISEÑO — Loop de diseño BrowserOS hasta que quede bien

**Goal**: El panel no solo es correcto: queda BIEN — iterado con Opus mirando el deploy real por BrowserOS hasta veredicto de cierre, con cada criterio visual cerrado por evidencia, y la deuda que converge (B-02, H-01) enterrada.
**Depends on**: Phase 128
**Requirements**: PANEL-09
**Success Criteria** (what must be TRUE):

  1. Loop deploy→captura→crítica Opus→corrección iterado hasta veredicto de cierre; cada criterio visual cerrado con fragmento DOM + captura BrowserOS contra el baseline de `spikes/assets/v13-baseline-*.png` — ningún criterio visual subjetivo (gotchas de instrumento aplicados: `textContent` no `innerText`, sleep 8-10 s entre screenshots, retry manual tras `CDP request timeout`).
  2. Densidad validada a 390px: presupuesto de ítems por tile arbitrado en el loop (decisión O-7), con "y N más →" honesto respaldado por el `total` del jsonb.
  3. B-02 cerrado: el tile con denominador ausente ya no existe (la muerte del tile materia verificada en el DOM del deploy — cero "(sin materia)", cero tombstone).
  4. H-01 cerrado: `/comparar` re-verificado tras el re-deploy — sin error boundary transitorio post-hidratación; si reaparece, causa raíz documentada con evidencia (jamás "no reproducible" a secas).

**Plans**: TBD
**UI hint**: yes

### Phase 130: VOTOS-REAL — B-01: el número falso muere

**Goal**: Las 71/186 fichas afectadas muestran el conteo REAL de votos con composición no distorsionada — un clamp de seguridad NO es un fix de exactitud.
**Depends on**: Phase 126 (paralelizable con el carril panel vía worktrees)
**Requirements**: DEBT-01
**Success Criteria** (what must be TRUE):

  1. RPC de conteo dedicada ADITIVA con la aguja completa (cero-grant, secdef PII-safe `search_path=''`, `statement_timeout`, LIMIT piso 1.000, doble-revoke, alta en `PUBLIC_RPC_ALLOWLIST`, pgTAP contra el schema aplicado) aplicada por `psql --single-transaction`.
  2. Chip y `VotosSection` cambian SIMULTÁNEAMENTE (mismo commit/deploy): la ficha testigo muestra 3.752 donde decía `Ver detalle (1000)`, y el número mostrado == recálculo SQL verbatim contra PROD por `psql -tA` (jamás REST, cap 1k).
  3. Composición no distorsionada: el desglose deja de derivar de un `order by fecha desc` capado — paridad desglose↔conteo real demostrada para los sujetos testigo de la clase afectada.
  4. Cero clamp como fix: el conteo proviene de la RPC dedicada, no de un techo; test que muerde si el cap de la RPC vieja vuelve a gobernar el número visible.

**Plans**: TBD
**UI hint**: yes

### Phase 131: DEBT-FICHA — Regla del timeline + co-autoría sin truncamiento

**Goal**: La regla de selección del timeline queda gobernada por una query escrita con criterio declarado, y la co-autoría de /comparar emite membresía de par completa sin truncamiento silencioso.
**Depends on**: Phase 126 (paralelizable con 130 vía worktrees)
**Requirements**: DEBT-03, DEBT-04
**Success Criteria** (what must be TRUE):

  1. La regla de selección del timeline está escrita como query con su criterio declarado, y explica la brecha 85 `Hito del` vs 99 eventos en `14309-04`; el render de la ficha obedece la regla (paridad query↔DOM sobre el sujeto testigo).
  2. RPC de co-autoría con firma v2 PARALELA (precedente `0060`) — la firma viva jamás se altera (`42P13` re-arma default privileges); v2 emite membresía de par sin truncamiento a 20; aguja completa + pgTAP contra el schema aplicado.
  3. `/comparar` consume la v2: el conteo mostrado == recálculo SQL de PROD; si el render recorta, declara "N de M" con total honesto — cero truncamiento silencioso.
  4. Suite + guards de régimen verdes; la RPC vieja sigue intacta y funcional (paralela, no reemplazada en caliente).

**Plans**: TBD
**UI hint**: yes

### Phase 132: NEWS-RSS — Conector RSS dos-etapas LOCKED

**Goal**: El RSS de prensa fluye fuente→R2 crudo→Supabase cerrando los 4 huecos de régimen de Is Chile Safe (robots.txt, delay, crudo no guardado, content-addressing incompleto) — ninguno se hereda.
**Depends on**: Nothing dentro del milestone (carril propio; paralelizable tras 126)
**Requirements**: NEWS-01, NEWS-02
**Success Criteria** (what must be TRUE):

  1. El conector consulta robots.txt ANTES de cada host, respeta rate-limit 2-3 s/host con UA identificatorio, y jamás emite ráfagas — el delay entre feeds es observable en la corrida (los "9 requests en ráfaga" de Is Chile Safe son imposibles por construcción).
  2. El RSS CRUDO se persiste content-addressed en R2 (`fuente/recurso/fecha/sha256.ext`, PUT `If-None-Match: *`, 412 = éxito idempotente) con hash-check ANTES de descargar: una re-corrida sin novedades sale temprano con `[skip]` y cero re-descarga.
  3. El parseo/carga a Supabase lee SIEMPRE desde R2, jamás de la fuente: un replay `--from-r2` reproduce la carga completa sin tocar la red.
  4. Las 5 fuentes operan: 4 medios directos + Google News RSS Search (`hl=es-419&gl=CL&ceid=CL:es-419`, `when:Nd`) con el outlet real extraído del tag `<source>`; el pre-filtro léxico legislativo determinista descarta antes de gastar LLM, con conteo de descartes observable.

**Plans**: TBD

### Phase 133: NEWS-TAXO — Taxonomía congelada + golden set arreglado ANTES de medir

**Goal**: Existe la vara antes que la medición: taxonomía legislativa congelada, golden set con cada etiqueta revisada (la lección pagada de Is Chile Safe: su techo de 65,9% era de labels), y thresholds pre-registrados.
**Depends on**: Phase 132 (los casos golden se construyen sobre input crudo real del conector)
**Requirements**: NEWS-03
**Success Criteria** (what must be TRUE):

  1. Taxonomía legislativa definida y CONGELADA por hash (sha256 del artefacto); cambiarla después de medir es una decisión nueva explícita, jamás drift.
  2. Golden set propio con cada etiqueta revisada ANTES de cualquier benchmark, con la revisión documentada por caso y el set congelado por hash.
  3. Thresholds pre-registrados y CONGELADOS antes de la primera medición (anti-circularidad: el umbral no se ajusta al resultado).
  4. El input crudo que el LLM verá se guarda re-runnable: cada caso del golden es reproducible desde su crudo (jamás "solo el output procesado", la segunda lección de Is Chile Safe).

**Plans**: TBD

### Phase 134: NEWS-RESOLVER — Contrato anti-alucinación de tres piezas

**Goal**: El LLM no puede inventar un vínculo: emite solo nombres de una lista cerrada, un resolver determinista offline los mapea, y cualquier null descarta a dead-letter con causa.
**Depends on**: Phase 133
**Requirements**: NEWS-04
**Success Criteria** (what must be TRUE):

  1. El LLM emite boletín/nombre de la lista cerrada inyectada en el prompt (3.675 boletines / 186 parlamentarios; jamás un id); si la allowlist llega vacía el pipeline falla LOUD (jamás procesa con lista vacía).
  2. El resolver determinista offline REUSA `extraerBoletines` context-gated fail-closed (diff cero sobre el existente — no se reescribe); ambigüedad ⇒ `null`, jamás best-guess.
  3. `null` en cualquier eslabón descarta el registro a dead-letter en tabla Supabase (no repo) con su `rejection_stage` — nada se fabrica, todo rechazo tiene causa consultable.
  4. `temperature=0`, umbral de confianza aplicado, y gate de validación all-or-nothing que preserva el último estado bueno: un lote fallido jamás corrompe el estado publicado.

**Plans**: TBD

### Phase 135: NEWS-CLASIF — Clasificador con evals como gate

**Goal**: El clasificador entra a producción solo si pasa la vara congelada: golden set como gate CI bloqueante, modelo elegido por benchmark sobre TieredProvider respetando el veredicto v11.0, y presupuesto con ledger.
**Depends on**: Phase 134
**Requirements**: NEWS-05
**Success Criteria** (what must be TRUE):

  1. El golden set corre en CI y BLOQUEA bajo el umbral congelado en 133 — con fixture/mutación que demuestra que el gate muerde (un clasificador degradado hace fallar CI).
  2. El modelo se elige por benchmark sobre `TieredProvider` respetando el veredicto full-40 de v11.0 (Granite APPROVED solo para clasificación; extracción VETADA por es-CL); el veredicto es COMPUTADO con evidencia, jamás aprobado por defecto ni por silencio.
  3. Presupuesto de llamadas con cap duro y ledger observable (conteo por corrida consultable).
  4. Toda URL se marca como vista ANTES de cualquier reject path: una re-corrida no reprocesa rechazados (idempotencia del pipeline demostrada).

**Plans**: TBD

### Phase 136: NEWS-CRON — Novedades diarias solas y honestas

**Goal**: Las noticias llegan solas: cron diario L-V acotado e idempotente que degrada honesto, con el backfill masivo como corrida LOCAL del operador.
**Depends on**: Phase 135
**Requirements**: NEWS-06
**Success Criteria** (what must be TRUE):

  1. Cron L-V acotado e idempotente: lotes incrementales, hash-check primero; re-corrida sin novedades = salida temprana `[skip]` sin escribir ni fabricar.
  2. Degradación honesta observada: sin API key el cron sale exit 0 SIN datos fabricados (la rama se ejercita, no se presume).
  3. Backfill masivo documentado como runbook de corrida LOCAL (jamás GH Actions — minimizar minutos), idempotente/reanudable.
  4. Al menos una corrida real del workflow observada verde (dispatch o schedule) con sus conteos reportados.

**Plans**: TBD

### Phase 137: NEWS-FICHAS — Noticias vinculadas en las fichas

**Goal**: El punto del objetivo 2 se cierra: la ficha de proyecto y la de parlamentario muestran su prensa vinculada con cita pública y trazabilidad, el texto completo queda privado, y el vínculo a parlamentario pasa el carril PII.
**Depends on**: Phase 136 (y 126 para superficies/linter)
**Requirements**: NEWS-07
**Success Criteria** (what must be TRUE):

  1. La ficha de proyecto y la de parlamentario muestran sus noticias vinculadas: titular + outlet + fecha + link externo, más enlaces internos a nuestras fichas — verificado por fragmento DOM.
  2. El texto completo de artículos vive SOLO en el bucket privado del operador; lo público es la cita — verificación de que el texto íntegro no se emite en ninguna superficie ni RPC pública.
  3. El vínculo noticia→parlamentario pasa el carril PII con su gate (`parlamentario` ∈ `PII_TABLES`): lectura por chokepoint/RPC sancionado en allowlist, jamás `.from` PII fuera del carril; guards de lockdown verdes con la superficie nueva registrada.
  4. Vacío honesto: una ficha sin noticias vinculadas muestra ausencia honesta con causa (o nada), jamás relleno; copy del carril pasa el linter anti-insinuación (cero causalidad noticia↔actor).

**Plans**: TBD
**UI hint**: yes

### Phase 138: E2E — Deploy agrupado + pasada BrowserOS final

**Goal**: Todo lo que el milestone promete queda verificado sobre el deploy real — panel accionable, número de votos real, noticias en fichas — con evidencia DOM y flags no autorizados intactos.
**Depends on**: Phases 129, 130, 131, 137 (integra todos los carriles)
**Requirements**: (integrativa — verifica PANEL-01..09, NEWS-01..07, DEBT-01..04 sobre el deploy real; no introduce requirements nuevos)
**Success Criteria** (what must be TRUE):

  1. Deploy agrupado con todos los fixes del milestone (build OpenNext en Docker `node:22-slim`, wrangler OAuth global, ventana de propagación 10-30 s respetada) — versión anclada por id.
  2. Pasada BrowserOS final: panel con links vivos y sujetos nombrados, ficha testigo con conteo real de votos, /comparar sin truncamiento, noticias visibles en fichas — cada superficie con fragmento DOM (`textContent`, no `innerText`) + captura.
  3. Flags no autorizados siguen OFF con control positivo apareado (marcadores MONEY/NOTIF ausentes + rama OFF renderizada observable; VSIM/NET/CRUCES presentes) — ningún flag fue flipeado por agente en todo el milestone.
  4. Suite completa + guards de régimen verdes; los conteos clave del milestone cuadrados contra `psql -tA` verbatim (jamás REST, cap 1k).

**Plans**: TBD
**UI hint**: yes

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 126. PANEL-GUARDS | 2/2 | Complete    | 2026-07-30 |
| 127. PANEL-MAT | 3/3 | Complete   | 2026-07-30 |
| 128. PANEL-UI | 0/? | Not started | - |
| 129. PANEL-DISEÑO | 0/? | Not started | - |
| 130. VOTOS-REAL | 0/? | Not started | - |
| 131. DEBT-FICHA | 0/? | Not started | - |
| 132. NEWS-RSS | 0/? | Not started | - |
| 133. NEWS-TAXO | 0/? | Not started | - |
| 134. NEWS-RESOLVER | 0/? | Not started | - |
| 135. NEWS-CLASIF | 0/? | Not started | - |
| 136. NEWS-CRON | 0/? | Not started | - |
| 137. NEWS-FICHAS | 0/? | Not started | - |
| 138. E2E | 0/? | Not started | - |

---

<details>
<summary>✅ v12.0 — Validación general producto-a-producto (Phases 113-125) — SHIPPED 2026-07-29</summary>

- [x] Phase 113: INV — Inventario rector de superficies (6/6 plans) — 2026-07-28
- [x] Phase 114: LINK-INT — Links internos exhaustivos (3/3) — 2026-07-28
- [x] Phase 115: LINK-EXT — Patrones de link a fuente oficial (3/3) — 2026-07-28
- [x] Phase 116: FECHA-AUDIT — Semántica de cada fecha visible (4/4) — 2026-07-28
- [x] Phase 117: FECHA-FIX — Etiquetas de fecha corregidas (4/4) — 2026-07-28
- [x] Phase 118: CRON-AUDIT — Veredicto por cron con evidencia (3/3) — 2026-07-28
- [x] Phase 119: CRON-FIX — Robustez de ingesta (7/7) — 2026-07-28
- [x] Phase 120: ESCALERA-ON — Flip `CLASIFICACION_ESCALERA=1` (2/2) — 2026-07-28
- [x] Phase 121: ESCALERA-DOC — Extensión solo con benchmark (1/1) — 2026-07-28
- [x] Phase 122: CRUCE-SQL — Cruces visibles × SQL de PROD (6/6) — 2026-07-29
- [x] Phase 123: SUPA-AUDIT — Auditoría de estructura Supabase (6/6) — 2026-07-29
- [x] Phase 124: SUPA-FIX — Migraciones aditivas a PROD (7/7) — 2026-07-29
- [x] Phase 125: E2E — Pasada final producto-a-producto sobre el deploy real (7/7) — 2026-07-29

**13 fases · 59 planes · 13/13 con VERIFICATION.md · 360 commits · 355 archivos (+81.158/−3.580) · 2026-07-27 → 2026-07-29.**
Suite `app/` 1577→1590 · guard lockdown 22→35 · guards de régimen 14/14 (172 tests). 7 migraciones escritas (`0073`–`0079`), **5 aplicadas** (`0074`, `0076`, `0077`, `0078`, `0079`).

**Deuda que viaja (aceptada por el operador, no oculta):** 🔴 `B-01` — el sitio muestra `Ver detalle (1000)` donde son **3.752** votos (71 de 186 fichas, composición distorsionada); 🔴 `OFF-6-03` cadena **SSRF** `net`→`anon`/`PUBLIC` viva; 🔴 `OP-4` `pgtap` en `public` con **1.201** funciones exec-`anon`; `OP-1` (probe REST, 3 requests) **gatea la severidad**. `0073`/`0075` **escritas y NO aplicadas** — jamás se editan, un fix futuro va como `0080`. Detalle completo: milestones/v12.0-ROADMAP.md · Audit: milestones/v12.0-MILESTONE-AUDIT.md · Requirements: milestones/v12.0-REQUIREMENTS.md

**Nota v13.0:** la deuda técnica de esa lista entra a este roadmap así — `B-01`→Phase 130 · `B-02`/`H-01`→129 · `B-03`→126 · `4-15`→127 · `H-06`/`3.3`→131. La deuda de OPERADOR (`OFF-01`, `OFF-6-03`, `OP-1`, `OP-4`, flip MONEY, provisión NOTIF, B26) queda FUERA del alcance de agente. `0080` la consume la Phase 127 (evidencia del materializador); un futuro fix de `0073`/`0075` tomará el siguiente número libre.

</details>

---
*Roadmap v13.0 creado: 2026-07-30 (fases 126-138). v12.0 archivado 2026-07-29 (con su deuda). Milestones anteriores archivados en `.planning/milestones/`.*
