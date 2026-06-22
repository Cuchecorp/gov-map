# Roadmap: Observatorio del Congreso 360

**Core Value:** La ciudadanía puede responder, sobre cualquier proyecto de ley o parlamentario, "qué pasó, cuándo y según qué fuente" — cada dato lleva fuente, fecha y enlace original, sin afirmar intención ni causalidad.

## Milestones

- ✅ **v1.0 MVP — Proyectos de Ley + Fundaciones de Identidad** — Phases 1-7 (shipped 2026-06-18)
- 📋 **v2.0 — Parlamentarios 360** — Phases 8-18 (voto individual, lobby/patrimonio, dinero, grafo de influencia) — planned
- 📋 **v3.0 — Cobertura de datos** — Phases 23-32 (lobby con identidad adjudicada + fuente camara.cl, patrimonio LIVE, votaciones masivas, provenance, RUT operador, gates OPS/LEGAL) — planned

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
- [ ] **Phase 17: Compuerta Legal — Bloque NET (framing del grafo)** - Sign-off legal sobre el framing del grafo aprobado ANTES de exponer la red
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

- [ ] 14-01-PLAN.md — Migración 0023_dinero.sql (contrato public-read versionado por (fuente_id, fecha_corte) + contratista deny-by-default + revoke + contratos_ingesta_estado + RPC contratos_de_parlamentario security-definer) + pgTAP 0024_dinero.test.sql; apply remoto + pgTAP verde = checkpoint operador
- [ ] 14-02-PLAN.md — Conector @obs/dinero (espeja @obs/probidad): flujo ChileCompra 2 pasos (BuscarProveedor→ordenesdecompra) + DV módulo-11 + natural/jurídica + sub-maestra contratista + enlace SOLO RUT-exacto (sin correrPipeline) + writer idempotente + MERCADOPUBLICO_TICKET; corrida LIVE acotada (operador)
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
- [ ] **Phase 31: SIGNOFF — Gate legal F17 (NET)** - Acción humana: obtener y registrar el sign-off legal F17 que habilita encender `NET_PUBLIC_ENABLED` (depende de LOBBY-03 confirmado para que el grafo no esté vacío). (DEFERIDO 2026-06-22 — gate humano/legal: el dossier `17-LEGAL-DOSSIER.md` ya existe; el grafo YA tiene 7.394 aristas (Phase 25) → listo para encender en cuanto un abogado externo firme `signoff: approved`)
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

**Plans:** TBD

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

**Plans:** TBD

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

**Plans:** TBD
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

**Plans:** TBD
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

**Plans:** TBD
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
