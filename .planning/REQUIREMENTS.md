# Requirements — Milestone v13.0: Portada accionable + noticias vinculadas + cierre de deuda

**Defined:** 2026-07-30 · **Operador:** definición verbatim en `.planning/PROMPT-v13.0-preparar-roadmap.md`
**Insumos pagados:** `research/v13.0-panel-actualidad-hallazgos.md` · `research/v13.0-is-chile-safe-ingesta.md` · 4 spikes en `spikes/v13.0-*` (2026-07-30)
**Decisiones ya adjudicadas:** Opción A (evidencia jsonb en materializador) · worktrees ON · VSIM ON con sign-off legal verbatim (memoria `vsim-signoff-legal-2026-07-30`) · tile materia muere (`sector_id` 1,8%)

> La tabla de trazabilidad se firma al definir, no al cumplir (gotcha §9.10 de v12.0): nada aquí
> es evidencia de cumplimiento.

## v13.0 Requirements

### PANEL — Portada accionable (objetivo 1)

- [ ] **PANEL-01**: Un ciudadano que llega a la portada ve, en cada tile del panel, los sujetos del hecho — boletín + título + fecha con verbo explícito — no contadores mudos. Vía Opción A: los 6 bloques de `materializar_senales()` pueblan `evidencia` jsonb `{"total": N, "items": [...]}` (migración 0080 aditiva; supresión conserva `'{}'`; cap por recencia PROHIBIDO sin total — anti-B-01).
- [ ] **PANEL-02**: Cada ítem enlaza a su ancla de ficha (`/proyecto/{b}#estado|#timeline|#votaciones`) o a `/agenda#...?semana=`; ningún link de agenda produce 404 (guard de existencia en el `left join proyecto` del materializador: ítem siempre emitido con `en_corpus:false` — nunca inner-join, el conteo jamás diverge del detalle). Helper central de links internos (hoy no existe).
- [ ] **PANEL-03**: El panel renderiza la propuesta editorial (spike `v13.0-editorial-portada.md`): sala-semana (L2), comisiones citadas con cruce urgencia↔citación (L1+L5+L6), urgencias por grado (L3, "95" muere, conteo por boletines), movimiento reciente nombrado, archivos/retiros (proyectos, no eventos: "2 eventos de 1 proyecto"), y el tile materia ELIMINADO. Decisiones O-1..O-7 ratificadas por el operador en el loop de diseño.
- [ ] **PANEL-04**: Votaciones recientes (L4) visibles — VSIM ON verificado + sign-off legal dado 2026-07-30. Por votación (jamás agregada por boletín), Senado `resultado` NULL → "resultado no informado por la fuente"; conteo de votantes solo confirmados (283.550, jamás 549k).
- [ ] **PANEL-05**: Semántica de fechas correcta en todo el panel: el hecho (pasado o futuro) vive en el cuerpo con verbo explícito (idioms aprobados `Citado el …`, `Urgencia … vigente desde …`, `En tabla de sala de la Cámara del …`); el footer lleva SOLO frescura `según fuente al …`; `"datos al"` desaparece; `fecha_captura` jamás visible.
- [ ] **PANEL-06**: Grafía de cámara única en todo el panel — fix **4-15/D2** en el materializador (`0065:233,261`), no en el cliente.
- [ ] **PANEL-07**: Cobertura y asimetrías declaradas: citaciones "23 Senado · 0 Cámara"; tabla de Cámara presentada como "tabla semanal" (fila sintética `camara:sesion:2026-W31`, numero/tipo/hora NULL — jamás fabricar "sesión N.º a las HH:MM"); ceros con denominador; vacío honesto con causa.
- [x] **PANEL-08** (Wave-0): guards ANTES del copy — todo archivo nuevo del rediseño alta en `SUPERFICIES_PANEL` antes de escribir copy; `NEGACIONES_LOCKED` extendido con los idioms nuevos; carril PANEL del linter verde (prohibidos `señal`, `exprés`, `los más`, …).
- [ ] **PANEL-09**: Loop de diseño BrowserOS con Opus mirando el deploy hasta que quede bien; cierre por fragmento DOM + captura (baseline ya capturado en `spikes/assets/`); densidad validada a 390px; ningún criterio visual subjetivo. Cierra también **B-02** (el tile con denominador ausente muere con el tile materia) y **H-01** (re-deploy + verificación `/comparar`).

### NEWS — Crons de noticias vinculadas (objetivo 2)

- [ ] **NEWS-01**: Conector RSS en dos etapas LOCKED: robots.txt consultado ANTES de cada host + rate-limit 2-3 s/host + UA identificatorio + RSS **crudo** content-addressed a R2 (`fuente/recurso/fecha/sha256.ext`, `If-None-Match: *`) → parseo SIEMPRE desde R2, jamás de la fuente. Hash-check antes de descargar. Cierra los 4 huecos de régimen de Is Chile Safe.
- [ ] **NEWS-02**: Fuentes 100% RSS: 4 medios directos + Google News RSS Search (`hl=es-419&gl=CL&ceid=CL:es-419`, `when:Nd`); outlet real desde el tag `<source>`; pre-filtro léxico legislativo determinista antes de gastar LLM.
- [ ] **NEWS-03**: Taxonomía legislativa definida y CONGELADA antes de medir; golden set propio con etiquetas revisadas ANTES de cualquier benchmark (lección Is Chile Safe: techo 65,9% era de labels); thresholds pre-registrados y congelados; el input crudo que el LLM vio se guarda re-runnable.
- [ ] **NEWS-04**: Contrato anti-alucinación de tres piezas: el LLM emite boletín/nombre de una lista cerrada inyectada (3.675 boletines / 186 parlamentarios; jamás un id) → resolver determinista offline (REUSA `extraerBoletines` context-gated fail-closed, no lo reescribe) → `null` en cualquier eslabón descarta a dead-letter con `rejection_stage` (tabla Supabase, no repo). `temperature=0`, umbral de confianza, fail-loud si la allowlist llega vacía, gate all-or-nothing que preserva el último estado bueno.
- [ ] **NEWS-05**: Clasificador con evals como gate: golden set corre en CI y bloquea bajo el umbral congelado; elección de modelo por benchmark sobre TieredProvider (veredicto v11.0: Granite APPROVED solo clasificación; extracción VETADA por es-CL); presupuesto de llamadas con cap y ledger; URL marcada vista ANTES de todo reject path.
- [ ] **NEWS-06**: Cron de novedades diario L-V acotado e idempotente (lotes incrementales, hash-check primero, degradación honesta sin key = exit 0 sin datos fabricados); backfill masivo LOCAL.
- [ ] **NEWS-07**: La ficha de proyecto y la de parlamentario muestran sus noticias vinculadas: cita (titular + outlet + fecha + link externo), texto completo SOLO en bucket privado del operador; vínculo noticia→parlamentario pasa el carril PII (`parlamentario` en `PII_TABLES`) con su gate; enlaces internos a nuestras fichas.

### DEBT — Deuda técnica v12.0 (objetivo 3)

- [ ] **DEBT-01** 🔴 (**B-01**): Las fichas muestran el conteo REAL de votos (3.752, no `Ver detalle (1000)`) con composición no distorsionada, en las 71/186 fichas afectadas: RPC de conteo dedicada ADITIVA con aguja completa (cero-grant, secdef PII-safe `search_path=''`, `statement_timeout`, LIMIT piso 1000, doble-revoke, `PUBLIC_RPC_ALLOWLIST`, pgTAP contra schema aplicado) + cambio SIMULTÁNEO de chip y `VotosSection`. Un clamp de seguridad NO es un fix de exactitud.
- [x] **DEBT-02** (**B-03**): Aserción de guard para `create view` en `public` sin `security_invoker` existe ANTES de la primera vista del milestone (hoy cero vacuo), con control positivo apareado que demuestre que mordería.
- [ ] **DEBT-03** (**H-06**): La regla de selección del timeline queda gobernada por una query escrita (85 `Hito del` vs 99 eventos en `14309-04`), con su criterio declarado.
- [ ] **DEBT-04** (**fila 3.3**): La co-autoría de `/comparar` emite membresía de par (RPC rediseñada, firma v2 paralela — precedente `0060`, jamás alterar la viva `42P13`), sin truncamiento silencioso a 20.

## Future Requirements (deferred)

- Agrupación por materia con nombre real — exige backfill del clasificador de sectores (`sector_id` 65/3.657 = 1,8%). Umbral editorial para revivirla: ≥60% poblado + ≥3 sectores.
- Autoría por parlamentario en el panel (`proyecto_autor` 49,9% vinculado confirmado) — usable pero carril PII; diferido a un milestone con su propio gate.
- Clustering de eventos de noticias (quinto nivel dedupe, union-find + LLM) — Is Chile Safe lo dejó como spike no wired; nosotros igual.
- Leyes publicadas (SEN-06) — BCN `portada_ulp` NO-VIABLE (SPA + reCAPTCHA).

## Out of Scope

- **Deuda de operador** (§8.1 audit v12.0): `OFF-01`, `OFF-6-03` (exigen `supabase_admin`; `0073`/`0075` escritas y NO aplicadas, JAMÁS editarlas — futuro fix = migración nueva), `OP-1` (probe REST, gatea severidad OFF-6-01), `OP-4` (`pgtap` en `public`, destructivo), CF secrets + GEMINI, identidad local, RUT-01, flip MONEY (legal), provisión NOTIF, rotación B26.
- **Flips de flags por agente** — prohibido siempre; MONEY/NOTIF siguen OFF y gated.
- **Invitados a citaciones futuras** — `citacion_invitado` da 0 filas para futuras.
- **Scraping HTML de medios** — el objetivo 2 es 100% RSS.
- **Port del código Python de Is Chile Safe** — se reimplementa el diseño en TS/Deno + Supabase.

## Traceability

(firmada por el roadmap 2026-07-30 — mapeo 20/20, cero huérfanos, cero duplicados; **no es evidencia de cumplimiento**)

| REQ | Phase |
|---|---|
| PANEL-01 | 127 — PANEL-MAT |
| PANEL-02 | 128 — PANEL-UI |
| PANEL-03 | 128 — PANEL-UI |
| PANEL-04 | 128 — PANEL-UI |
| PANEL-05 | 128 — PANEL-UI |
| PANEL-06 | 127 — PANEL-MAT |
| PANEL-07 | 128 — PANEL-UI |
| PANEL-08 | 126 — PANEL-GUARDS |
| PANEL-09 | 129 — PANEL-DISEÑO |
| NEWS-01 | 132 — NEWS-RSS |
| NEWS-02 | 132 — NEWS-RSS |
| NEWS-03 | 133 — NEWS-TAXO |
| NEWS-04 | 134 — NEWS-RESOLVER |
| NEWS-05 | 135 — NEWS-CLASIF |
| NEWS-06 | 136 — NEWS-CRON |
| NEWS-07 | 137 — NEWS-FICHAS |
| DEBT-01 | 130 — VOTOS-REAL |
| DEBT-02 | 126 — PANEL-GUARDS |
| DEBT-03 | 131 — DEBT-FICHA |
| DEBT-04 | 131 — DEBT-FICHA |

*Phase 138 (E2E) es integrativa: verifica todos los requirements sobre el deploy real; no posee requirements propios.*
