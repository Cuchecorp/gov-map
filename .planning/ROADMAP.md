# Roadmap: Observatorio del Congreso 360

**Core Value:** La ciudadanía puede responder, sobre cualquier proyecto de ley o parlamentario, "qué pasó, cuándo y según qué fuente" — cada dato lleva fuente, fecha y enlace original, sin afirmar intención ni causalidad.

## Milestones

- ✅ **v1.0 MVP — Proyectos de Ley + Fundaciones de Identidad** — Phases 1-7 (shipped 2026-06-18)
- 📋 **v2.0 — Parlamentarios 360** — Phases 8-18 (voto individual, lobby/patrimonio, dinero, grafo de influencia) — planned

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
- [ ] **Phase 18: NET — Grafo de influencia (`@xyflow/react`)** - Aristas materializadas por `pg_cron` + RPC con CTE recursiva; ambos extremos confirmados, provenance y ventana por arista, sin lenguaje causal
- [ ] **Phase 19: Producto + Diseño — Brief y cierre de diseño del frontend** - Brief de producto y sistema de diseño CERRADO (implementation-ready) que saca el máximo partido a la data ya disponible; estudio visual de referencias (legalatlas.cl, tributalab.com, ischilesafe.com) vía browseros; correr en autónomo, Opus sin economía de tokens

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

**Plans:** TBD

### Phase 17: Compuerta Legal — Bloque NET (framing del grafo)

**Goal:** Obtener el sign-off legal sobre el framing del grafo de influencia antes de exponer la superficie más insinuante del producto — gate de proceso previo a NET.
**Mode:** mvp
**Depends on:** Phase 16 (los tres bloques de datos poblados; el grafo deriva de ellos)
**Requirements:** LEGAL-02
**Success Criteria** (what must be TRUE):

  1. Un sign-off legal sobre el framing del grafo queda registrado y aprobado, cubriendo específicamente el riesgo de que una arista o un camino se lea como acusación (clasificación de datos sensibles party/voto + terceros privados como nodos)
  2. La revisión confirma que el framing es descriptivo (aristas tipadas y con fuente, ventana temporal, sin score de sospecha ni path-finding como feature destacada) y que la atribución CC BY 4.0 se propaga a los nodos derivados de InfoProbidad
  3. El sign-off es prerrequisito duro: Phase 18 no se expone públicamente hasta su aprobación

**Plans:** TBD

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

**Plans:** TBD

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

**Plans:** 1/5 plans executed

Plans:

- [x] 19-01-PLAN.md — DESIGN-SYSTEM.md (CERRADO): tokens crema+petróleo, tipografía Geist, espaciado 8-pt, catálogo de componentes, voz editorial ES, estados honestos, invariantes anti-insinuación
- [ ] 19-02-PLAN.md — BRIEF.md: propuesta de valor por superficie, IA + navegación global, landing/hero (búsqueda semántica protagonista), onboarding, veredictos de referencia browseros, ideas diferidas
- [ ] 19-03-PLAN.md — SCREENS.md: specs ejecutables por pantalla (landing, resultados, ficha proyecto, ficha parlamentario, contraparte) + GlobalHeader + directorio parlamentarios + sobre/metodología
- [ ] 19-04-PLAN.md — mockup/landing.html: mockup HTML/Tailwind throwaway del landing (ancla visual: fondo crema + hero display + 1 acento itálico petróleo + búsqueda-hero + pills + línea de confianza)
- [ ] 19-05-PLAN.md — CLOSURE.md: consolidación + cierre (cross-check de los 5 criterios de éxito, auditoría de principios rectores, sign-off CERRADO)

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
| 17. Compuerta Legal — Bloque NET | v2.0 | 0/? | Not started | - |
| 18. NET — Grafo de influencia | v2.0 | 0/? | Not started | - |
| 19. Producto + Diseño — Brief y cierre de diseño | v2.0 | 1/5 | In Progress|  |
