---
gsd_state_version: 1.0
milestone: v8.0
milestone_name: — Rediseño Bento
status: Scaffolding listo; arrancar con /gsd-autonomous --from 76 --to 81 (PROMPT-v8.0-build-autonomo.md)
stopped_at: Phase 80 complete (verified 5/5, guards endurecidos, 917 tests)
last_updated: "2026-07-15T18:52:44.846Z"
last_activity: 2026-07-15
progress:
  total_phases: 6
  completed_phases: 5
  total_plans: 10
  completed_plans: 10
  percent: 83
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-07-13)

**Core value:** La ciudadanía puede responder, sobre cualquier proyecto de ley o parlamentario, "qué pasó, cuándo y según qué fuente" — cada dato con fuente, fecha y enlace, sin afirmar intención ni causalidad.
**Current focus:** v8.0 Rediseño Bento — Phase 76 (BENTO-BASE) lista para planificar. Documento rector: MILESTONE-v8-bento.md; decisiones D1-D4 RESUELTAS por delegación (REQUIREMENTS.md §v8).

## Current Position

Phase: 76 (BENTO-BASE — primitivas bento + chrome global) — NOT STARTED
Plan: —
Status: Scaffolding listo; arrancar con /gsd-autonomous --from 76 --to 81 (PROMPT-v8.0-build-autonomo.md)
Last activity: 2026-07-15

Progress: [░░░░░░░░░░] 0% (v8.0: 0/6 fases; v1.0–v6.1 shipped; v7.0 code-complete con gates de operador abiertos — HANDOFF-v7.0-operator-gates.md)

## Performance Metrics

**Velocity:**

- v7.0 plans completed: 0
- v6.1 (62-63): 7 planes, corrida autónoma ~3 días con 2 checkpoints humanos

**By Phase (v7.0):**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 64–75 | TBD | - | - |

**Recent Trend:**

- Trend: Stable

*Updated after each plan completion*
| Phase 64 P02 | ~25 min | 2 tasks | 5 files |
| Phase 66 P01 | ~8 min | 3 tasks | 6 files |
| Phase 66 P02 | 6 | 2 tasks | 1 files |
| Phase 67 P02 | ~10min | 1 tasks | 1 files |
| Phase 68 P03 | ~9 min | 2 tasks | 6 files |
| Phase 68 P01 | ~5 min | 1 tasks | 1 files |
| Phase 68 P02 | ~12min | 2 tasks | 4 files |
| Phase 68 P04 | ~4 min | 2 tasks | 1 files |
| Phase 69 P01 | 35min | 1 tasks | 2 files |
| Phase 69 P02 | 14min | 2 tasks | 4 files |
| Phase 69 P03 | 20min | 1 tasks | 1 files |
| Phase 70 P01 | 7 | 3 tasks | 5 files |
| Phase 70 P02 | ~6 min | 2 tasks | 3 files |
| Phase 72 P01 | 22min | 2 tasks | 2 files |
| Phase 73 P02 | ~25m | 2 tasks | 8 files |
| Phase 73 P03 | 10 | 2 tasks | 1 files |
| Phase 73 P04 | 15 | 1 tasks | 2 files |
| Phase 74 P01 | 40 | 2 tasks | 7 files |
| Phase 75 P02 | ~8 min | 2 tasks | 1 files |

## Accumulated Context

### Decisions

Decisiones en PROJECT.md Key Decisions. Rectoras para v7.0:

- HALLAZGO RECTOR (research HIGH, 4/4): el código de P3 (`packages/votos/`) y P5 (`packages/dinero/`) YA EXISTE desde v2.0 → v7.0 = WIRING dos-etapas + validación endpoint LIVE + BACKFILL + GATING. Se rechaza cualquier fase "crear tabla/conector/modelo".
- Secuencia dura: P3 (64→68) antes que P5; dentro de P5, RUT-01 (69) SIEMPRE primero (dato bloqueante, no flag).
- DEBT-01 (source_snapshot/`--from-r2`) se FUNDE con el wire de votos (66) y dinero (70/71), no es fase aparte.
- Gates que el agente NO flipea: RUT-01 (checkpoint operador, Phase 69) + sign-off legal 21.719 (Phase 73). El operador pre-aprobó el encendido; la aprobación NO reemplaza la revisión.
- Voto reconciliado por DIPID determinista PUNTO; nunca name-match para votos (riesgo #1). Senado por nombre → probable/no_confirmado.
- [Phase ?]: Phase 64: codigo 2 -> abstencion CONFIRMADO LIVE 2026-07-13; pareo desde bloque Pareos por DIPID, NUNCA codigo 3
- [Phase ?]: Phase 64: getVotacion_Detalle UP a escala; PAREO confirmado LIVE desde <Pareos> (A1b resuelto, 5/5); Dispensado no observado (no fabricado); crudo LIVE en R2
- [Phase ?]: Phase 65: golden set DIPID->id_maestra DERIVADO del seed + gate CI fail-closed 4-aristas; reconciliador y branded type NO tocados
- [Phase 66]: wire dos-etapas votos por RUTA A (threadear runCamaraVotos r2Store/snapshotWriter/fromR2 a runIngest); --from-r2 REUSA el writer resuelto (W-1, no re-deriva como ingest-cli); CLI operador construye R2Store real de .env R2_* (W-2)
- [Phase 66]: cobertura = conteo por estado_vinculo (head+count, sin cap 1k) + invariante duro '0 DIPID-maestra no_confirmado' (D-SC4-MET), NUNCA name-match; @obs/votos gana dep @supabase/supabase-js@^2.108.2 (ya en el monorepo)
- [Phase ?]: 66-02: backfill de votos a escala documentado como runbook operador-LOCAL; corrida LIVE + write PROD PENDIENTE (checkpoint human-action)
- [Phase ?]: 67-01: votXmlSenado en el envelope R2 → --from-r2 reconstruye los votos del Senado; mapSeleccion fail-loud (D-A4); reconciliar-senado.ts intacto (D-A1)
- [Phase ?]: 67-02: runbook operador-LOCAL del backfill Senado (67-BACKFILL-SENADO-RUNBOOK.md) espeja 66; corrida LIVE votaciones.php + write PROD + confirmacion tokens SELECCION = checkpoint operador PENDIENTE (agente NO toco WAF ni PROD)
- [Phase ?]: [Phase 68] 68-03: carril de voto PODADO (rebeldía + mediana de cámara FUERA del render; RPC inertes en DB y fuera de PUBLIC_RPC_ALLOWLIST). Leyenda anti-insinuación VERBATIM bloque 0; N/M incondicional; techo por causa condicional. Ejecutado ANTES de 68-01.
- [Phase ?]: [Phase 68] 68-01: linter anti-insinuacion = test de vitest (app/lib/anti-insinuacion-guard.test.ts), espejo lockdown-guard; caza texto RENDERIZADO post-stripTsComments (no identificadores), resta la leyenda LOCKED que NIEGA disciplina, mutation self-check prueba que muerde; 0 offenders sobre arbol podado 68-03, suite app 758 verde.
- [Phase ?]: [Phase 68] 68-02: cobertura del voto individual en pnpm freshness = array COBERTURA_VOTO_SENALES SEPARADO (denominador = sesiones de sala conocidas, count(DISTINCT votacion.id), NO proyecto) + renderCoberturaVoto; evaluateCobertura se reusa tal cual (array marca su propio esDenominador); Camara solo confirmado determinista, Senado por nombre (probable/no_confirmado, techo honesto); degrada a null NO 0; en vivo 4731 sesiones, Camara 80%, Senado 20%.
- [Phase ?]: Phase 69 69-01: guard-guardian name-match no escribe rut BIFURCADO (estatico app/lib fs + companion comportamiento packages/dinero, app NO depende de @obs/dinero); detector cubre revisionesRut->writer y cosechas.push fuera de corroboracion; mutation self-check probado contra el archivo real; reconciliar-contrato/harvest-rut intactos.
- [Phase ?]: [Phase 69] 69-02: cobertura de RUT DV-valido en pnpm freshness = DOS arrays SEPARADOS (parlamentario confirmado / entidad_tercero juridica), cada uno con denom propio, evaluados por separado (evaluateCobertura toma un esDenominador por eval, no se toca); numerador = presencia de RUT no vacio, DV-validez la resuelve isRutValido en la capa de identidad (sub-techo declarado en CLI); degrada por causa (no-data n/d, cero real 0%, M=0 n/d); counts agregados NUNCA SELECT rut (minimizacion T-69-06); en vivo parl 0/186=0%, entidades 0=n/d; corpus/voto intactos.
- [Phase ?]: Phase 70-01: --from-r2 deriva la tarea del envelope (rut+dias); wire dinero dos-etapas R2 put-gatea-upsert
- [Phase ?]: Phase 70-03: runbook backfill ChileCompra operador-LOCAL (70-BACKFILL-CHILECOMPRA-RUNBOOK.md, espejo 66/67, flags reales run-dinero-masivo-cli --ruts-file/--dia/--from-r2) + SPIKE (70-SPIKE-CUOTA-OCDS.md): cuota 10k/dia NO modificable -> particion multi-dia reanudable OBLIGATORIA (hash-check R2 salta lo hecho, upsert clave-natural no-op); OCDS bulk esquiva cuota pero parser DEFERRED (fuera de alcance); universo RUT depende de RUT-01. El agente NO corrio el crawl LIVE (deuda operador-LOCAL como 66/67), NO consumio cuota, MONEY-01 NO cerrado, MONEY_PUBLIC_ENABLED OFF (flip=Phase 73); ticket MERCADOPUBLICO_TICKET solo en .env (redactado).
- [Phase ?]: Phase 70-02: señal freshness ChileCompra = entrada CATALOG declarativa sobre contratos_ingesta_estado.ingestado_hasta (marcador de barrido, espejo lobby-leylobby: distingue "sin contratos" de "no barrido"), umbral 30d, evaluate.ts reusado tal cual, CERO migraciones; degrada honesto (STALE ~= 0 hoy, sin crawl; GH n/d porque chilecompra-weekly.yml no existe hasta el flip de Phase 73). Guard frozen-reconciler (packages/dinero/reconciler-frozen-guard.test.ts, misma suite que name-match-rut-guard) congela 3 firmas LOCKED: rama juridica RUT-only (correrPipeline DESPUES de la guarda !==natural), monto string|null VERBATIM no numeric, header+tabla 0023 intactos; detector puro + mutation self-check EN MEMORIA (muerde por eje) + no-falsos-positivos. MONEY gate re-verificado OFF (=== "true"; .env.example=false; anti-flip Phase 69 verde). Archivos LOCKED git diff exit 0.
- [Phase ?]: Phase 71-03: runbook backfill SERVEL operador-LOCAL POR ELECCION (71-BACKFILL-SERVEL-RUNBOOK.md, espeja 70/66/67, flags reales run-servel-local-cli --eleccion/--r2-path/--from-r2/--anio). MAS simple que ChileCompra: SERVEL no depende de RUT-01 (cruce por NOMBRE determinista, no trae RUT) ni de ticket/cuota (GET anonimo). Etapa 1 = acto humano (colocar .xlsx en R2 content-addressed servel/<eleccion>/<fecha>/<sha>.xlsx). El agente NO obtuvo/coloco .xlsx, NO toco SERVEL, NO flipeo MONEY. MONEY-02 NO cerrado (porcion LIVE = deuda operador); MONEY_PUBLIC_ENABLED OFF (flip=Phase 73).
- [Phase ?]: Phase 72-01: senal lobby_sector_aporte = STUB ESTRUCTURAL correcto-por-construccion (0052): cruce dinero x sector por RUT de la EMPRESA contratista (contrato->contratista->CTE empresa_sector 'where false' = arista company-rut->sector ausente => 0 filas honestas), NUNCA por parlamentario_id (yuxtaposicion persona-nivel rechazada); rama lobby_sector byte-identica (0039), un delete, evidencia PII-safe, cuerpo sin partido/rut (rut_proveedor no cuenta), sin causalidad; pgTAP 7/7 validado en vivo contra scratch DB; apply PROD + RUT-01 + backfill ChileCompra = Plan 02 operador; MONEY OFF (flip=Phase 73).
- [Phase ?]: Phase 72-02: runbook operador-LOCAL apply 0052 (72-APPLY-RUNBOOK.md, espeja 69/70/71): psql --db-url --single-transaction + PGCLIENTENCODING=UTF8 + BOM esquivado, NUNCA supabase db push; precondicion verifica cruce_senal_tipo_senal_check contra pg_constraint antes del drop (Pitfall A1); pgTAP 0052 contra schema APLICADO (7/7 ok, build/typecheck falso positivo); aplicar UNA vez (Bloque1 drop+add no re-ejecutable). Vacio honesto (0 filas) documentado por DOS razones: arista company-rut->sector ausente (stub, sustancia diferida = columna sector_id en la empresa + clasificador) + RUT-01 0%/backfill pendiente. MONEY_PUBLIC_ENABLED OFF (flip=Phase 73). Rollback aditivo. El agente NO aplico a PROD (checkpoint blocking-human PENDIENTE).
- [Phase ?]: 73-02: leyenda MONEY (constante unica) contiene 'vinculo por RUT' como concepto NEGADO, valida en superficies by-name; invariante RUT-vs-nombre se preserva restando la leyenda (sinLeyenda) antes de asserts anti-'por RUT', no suprimiendola
- [Phase ?]: 73-03: linter anti-insinuación extendido a las 4 superficies MONEY + /contraparte; leyenda MONEY restada de NEGACIONES_LOCKED; 'empresa ligada a' bloqueado, 'Enlazado por RUT' permitido.
- [Phase ?]: 74-01: cursor leylobby deny-by-default; avanza solo con datos
- [Phase ?]: 74-02: leyes-weekly lee corpus COMPLETO paginado (.range) cap 1k resuelto; cursor singleton leyes_rotacion_estado (0054) round-robin wrap-around; agenda-prioridad, MONEY/SERVEL excluidos, fail-loud; 0054 NO aplicada a PROD (validada local begin/rollback)
- [Phase ?]: DEBT-03: CF token es concern de deploy; deuda de operador cargar el valor, no cablearlo en crons de ingesta
- [Phase ?]: Freshness: señal MIN-edad de leyes (leyes-min-edad, MIN fecha_captura, umbral 45) revela la cola sin rotar sin regresionar las señales MAX v6.0 (FuenteConfig.agregado default MAX)
- [Phase ?]: DEBT-05: .net-* font-size migrado a tokens var(--text-*) pixel-identico; .net-chip 0.6875rem preservado; guard source-scan bloquea rem ad-hoc; /red F18 diferida a ui-review+operador
- [Phase ?]: DEBT-06: rotación del DB password de Supabase (B26) documentada como runbook de operador zero-credential-values (75-DB-PASSWORD-ROTATION-OPERATOR-NOTE.md); el agente NO rota (acto exclusivo de operador). Radio de impacto solo SUPABASE_DB_URL; CI + sitio usan SUPABASE_SECRET_KEY por REST (no afectados).

### Pending Todos

Backlog v6.x absorbido como DEBT-02..06 en Phases 74-75.

### Blockers/Concerns

- [Phase 64] opendata.camara.cl UP a escala HOY = MEDIUM confidence → SPIKE bloqueante; fallback honesto a agregados si falla. Códigos Abstención/Pareo (A1) nunca confirmados live → fijar con test.
- [Phase 69] RUT-01 = write remoto vía db-url = checkpoint de OPERADOR (bloquea TODO P5).
- [Phase 70] Cuota ChileCompra (10k/día) + ticket operador; SERVEL sin feed estable (toil operador por elección).
- [Phase 73] Flip de MONEY_PUBLIC_ENABLED = acto humano (sign-off dossier legal 13); guard CI anti-flip.
- 66-02 PENDIENTE operador-LOCAL: correr el backfill LIVE de votos (VOTOS_LIVE=1 --boletines-file, rate-limit 2-3s) + reportar cobertura N/M e invariante dipidsMaestraNoConfirmados===0. Ver 66-BACKFILL-RUNBOOK.md
- 67-02 PENDIENTE operador-LOCAL: correr el backfill LIVE del Senado (VOTOS_LIVE=1 --boletines-file, rate-limit 2-3s) + confirmar tokens <SELECCION> LIVE + reportar cobertura por porEstado (N confirmado/M probable/K no_confirmado) y SC#4 (senado_no_confirmado_con_fk===0). Ver 67-BACKFILL-SENADO-RUNBOOK.md
- 68-04 gate BrowserOS comprensible PENDING operador: requiere backfill votos 66/67 (LOCAL) + deploy Cloudflare, luego cold-read segun 68-BROWSEROS-GATE.md. Resume: escribir comprensible o listar puntos fallidos.
- RUT-01 write remoto a la maestra PENDIENTE checkpoint operador blocking-human (bloqueante duro P5)
- 70-03 PENDIENTE operador-LOCAL (checkpoint human-action bloqueante): correr el backfill LIVE de ChileCompra por RUT (cuota 10k/día, ticket MERCADOPUBLICO_TICKET solo en .env, rate-limit 2-3s, partición multi-día reanudable vía --ruts-file/--dia + replay --from-r2). BLOQUEANTE DURO: RUT-01 (Phase 69) debe estar poblado primero (sin RUTs no hay universo). MONEY_PUBLIC_ENABLED se queda OFF hasta el flip legal de Phase 73. MONEY-01 NO cerrado. Ver 70-BACKFILL-CHILECOMPRA-RUNBOOK.md + 70-SPIKE-CUOTA-OCDS.md
- 72-02 PENDIENTE operador-LOCAL (checkpoint blocking-human): aplicar la migracion aditiva 0052 al remoto PROD por `PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" --single-transaction -f supabase/migrations/0052_cruce_senal_lobby_sector_aporte.sql` (NUNCA supabase db push; BOM esquivado; UNA vez), verificar el constraint cruce_senal_tipo_senal_check contra pg_constraint ANTES del drop, correr el pgTAP `supabase/tests/0052_...test.sql` contra el schema APLICADO (7/7 ok, 0 not ok), y confirmar `count(*) where tipo_senal='lobby_sector_aporte'` = 0 HOY (vacio honesto: arista empresa->sector ausente + RUT-01/backfill pendientes, NO un bug). El agente NO toco PROD. MONEY_PUBLIC_ENABLED OFF hasta el flip legal de Phase 73. Resume-signal: "aplicado" (con pgTAP + count=0) o describir el fallo. Ver 72-APPLY-RUNBOOK.md
- 71-03 PENDIENTE operador-LOCAL (checkpoint human-action blocking-human): poblar SERVEL POR ELECCION — obtener el .xlsx de financiamiento electoral a mano desde SERVEL, colocarlo en R2 content-addressed servel/<eleccion>/<fecha_corte>/<sha>.xlsx (Etapa 1 = acto humano), y correr run-servel-local-cli.ts --eleccion <slug> --r2-path <r2Path> [--anio YYYY] (Etapa 2, lee de R2, 0 fetch). SERVEL NO trae RUT (cruce por NOMBRE determinista) -> RUT-01 NO es prerrequisito. MONEY-02 NO cerrado; MONEY_PUBLIC_ENABLED OFF hasta flip legal Phase 73. Ver 71-BACKFILL-SERVEL-RUNBOOK.md
- MONEY (Phase 73) gated OFF pendiente de 3 actos de operador exclusivos (deuda F13): (1) cold-read BrowserOS comprensible en gated-preview; (2) sign-off legal 21.719 -> signoff: approved en docs/legal/13-LEGAL-DOSSIER.md; (3) flip MONEY_PUBLIC_ENABLED=true en prod SOLO tras approved. El agente no firma ni flipea.
- Operador: rotar DB password Supabase (B26) en Dashboard; re-cargar SUPABASE_DB_URL en .env local + revisar *_DB_URL en Cuchecorp/gov-map; confirmar url-vieja-falla + url-nueva-funciona + CI/sitio verdes. Checkpoint BLOCKING plan 75-02 (agente NO rota).

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260713-izo | Rediseñar /red: layout B seed→columna con conectores fan-out (sketch 002) | 2026-07-13 | 75a8617 | [260713-izo-redisenar-red-layout-b-seed-columna-con-](./quick/260713-izo-redisenar-red-layout-b-seed-columna-con-/) |
| 260715-bvd | Parchar 3 alertas Dependabot (postcss/uuid/esbuild) vía pnpm overrides | 2026-07-15 | 72be412 | [260715-bvd-parchar-3-alertas-dependabot-bump-transi](./quick/260715-bvd-parchar-3-alertas-dependabot-bump-transi/) |

## Deferred Items

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| VOTO avanzado | Comparativo voto vs mayoría bancada (VOTOX-01), votos cruzados (VOTOX-02) | v2 (alto riesgo insinuación, tras sign-off) | 2026-07-13 |
| DINERO avanzado | Cruce dinero × voto × timeline por sector (MONEYX-01), co_votación | v2 (máquina de sospechas, 17-LEGAL-DOSSIER §2) | 2026-07-13 |
| Legal | Sign-offs F13/MONEY + F17/NET | Human gate — F13 vive en Phase 73 (v7.0) | v4.0 |
| verification_gap | Phase 62: 62-VERIFICATION.md | human_needed (mismo ítem UAT) | v6.1 close 2026-07-11 |

## Session Continuity

Last session: 2026-07-15T18:52:44.815Z
Stopped at: Phase 80 complete (verified 5/5, guards endurecidos, 917 tests)
Resume file: .planning/ROADMAP.md

## Operator Next Steps

- v8.0: `/clear` + pegar el prompt de `.planning/PROMPT-v8.0-build-autonomo.md` (corrida autónoma 76-81)
- v7.0 (paralelo, cuando quieras): gates de operador según `.planning/HANDOFF-v7.0-operator-gates.md`; al cerrarlos, `/gsd:audit-milestone` → `/gsd:complete-milestone v7.0`
