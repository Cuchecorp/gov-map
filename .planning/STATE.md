---
gsd_state_version: 1.0
milestone: v9.0
milestone_name: — Robustez de productos estrella + seguridad final
status: verifying
stopped_at: "Roadmap v9.0 creado — 11 fases (86-96) en tres pasadas; 27/27 requisitos mapeados; listo para /gsd:plan-phase 86"
last_updated: "2026-07-22T18:13:03.374Z"
last_activity: 2026-07-22
progress:
  total_phases: 11
  completed_phases: 6
  total_plans: 22
  completed_plans: 19
  percent: 55
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-07-13)

**Core value:** La ciudadanía puede responder, sobre cualquier proyecto de ley o parlamentario, "qué pasó, cuándo y según qué fuente" — cada dato con fuente, fecha y enlace, sin afirmar intención ni causalidad.
**Current focus:** Phase 91 — PERSONAS P2b — Ficha bio + partido directo + cross-links factuales

## Current Position

Phase: 91 (PERSONAS P2b — Ficha bio + partido directo + cross-links factuales) — EXECUTING
Plan: 3 of 3 complete
Status: Phase complete — ready for verification
Last activity: 2026-07-22

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
| Phase 89 P02 | 30 | 2 tasks | 6 files |
| Phase 90 P01 | ~15min | 3 tasks | 10 files |
| Phase 90 P03 | ~55min | 3 tasks | 8 files |
| Phase 91 P01 | 8min | 3 tasks | 5 files |
| Phase 91 P02 | ~8min | 3 tasks | 8 files |
| Phase 91 P03 | ~26min | 3 tasks | 7 files |
| Phase 92 P01 | ~14min | 2 tasks | 5 files |

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
- [Phase 90] 90-01: @obs/bio scaffolded (espejo @obs/lobby; SIN @obs/adjudication porque bio no usa LLM; +fast-xml-parser@^5 ya en el monorepo; tsconfig references NO paths por gotcha Phase 43; vitest.config.ts verbatim evita CI-DARK). model.ts = ALLOWLIST POR CONSTRUCCION: los 4 contratos (BioParlamentario/Militancia/Comision/ComisionMembresia) NO declaran fechaNacimiento/rut/sexo → PII imposible de persistir; zod .strict() por entidad muerde con campo extra (11 tests). Migracion 0059 = 4 tablas deny-by-default (parlamentario_bio 1:1, parlamentario_militancia, comision, comision_membresia) VERBATIM de 0021: provenance inline NOT NULL + clave natural unique + RLS habilitada SIN policies + revoke all from anon,authenticated + CERO grant a anon (lockdown-guard Block A >0044; RPCs publicas = Phase 91) + pgTAP plan(28). OFFLINE: NO aplicada a PROD (apply + pgTAP contra schema aplicado = 90-03, psql --single-transaction nunca db push). parlamentario NO alterado (partido lo refresca el writer en 90-02). BIO-01/BIO-05 completos. GOTCHA: el <automated> check node del Task 3 da falso-FAIL si se corre inline en bash (doble-escape colapsa [\\s\\S]→sS); correrlo desde archivo .cjs. DEUDA PRE-EXISTENTE fuera de alcance: app/lib/buscar.test.ts:193 falla (drift Phase 89 commit 2a4a6a9 similarity 0→null), root pnpm test en rojo por eso; ver deferred-items.md.
- [Phase ?]: 90-02: bio parsers allowlist por construccion; BCN Militancy = hasPoliticalParty/hasBeginning.originalDate/hasEnd; comisiones = camara.cl integrantes.aspx por DIPID
- [Phase ?]: [Phase 90] 90-03: run-bio-cli dos-etapas + 0059 APLICADA a PROD (pgTAP 28/28). LIVE por el agente: diputados 155/155 (315 militancias, 155 partidos frescos), senadores 31/31 vigentes (48 militancias; 85 historicos BCN sin match=fail-closed), comisiones 34+386 membresias+154 dip (curl-first WAF). CERO FK fabricado. FIX RULE-1: query BCN clase bio:Senador inexistente->0 filas; corregida a bio:idSenado + join DETERMINISTA por parlid_senado (supera name-match A3). parlamentario_bio=0 (Known Stub). Gate 91 DESBLOQUEADO.
- [Phase ?]: [Phase 91] 91-01: canal de datos ficha 360 en PROD — migración 0060 con 8 RPCs security-definer PII-safe (cabecera_v2/listado_v2 con partido DIRECTO desde militancia vigente +fecha_captura+origen, militancias, comisiones, 4 cross-links factuales bounded orden-neutral); firmas v2 PARALELAS (no altera 0020/0026: evita 42P13+re-arma default-privileges, 0020 intacto para guard LEGAL-03); partido revierte retencion de 0020 por decision operador 2026-07-21 (dato publico del cargo electo; minimizacion 21.719 plena solo terceros/RUT/email); doble-revoke CERO grant VERBATIM 0055; anti-ranking (coautores n_proyectos honesto pero orden por nombre); APLICADA a PROD por el agente (DDL aditivo, precedente 0055-0059), pgTAP 30/30 verde contra schema aplicado, partido no-null confirmado (D1074 Independientes), cero rut/email; 8 RPCs en PUBLIC_RPC_ALLOWLIST; suite app 1097 verde + tsc 0; montaje UI diferido a 02/03.
- [Phase ?]: 91-03: cross-links factuales + filtro partido island + linter extendido; deploy Cloudflare e0c969af verificado BrowserOS
- [Phase 92] 92-01: canal de datos audiencia→PL fail-closed. extraerBoletines context-gated (regla LOCKED riesgo #1): (a) sufijo -NN inequívoco en cualquier posición; (b) base pelada/punteada SOLO tras gatillo boletín/bol. ≤3 tokens; JAMÁS keywords → "Ley 20.730"/"año 2024"/"20730 suelto"/"$14.309" = []. DIVERGENCIA deliberada vs detectarBoletin (aquél valida query completa). Migración 0062 RPC lobby_menciones_de_boletin: fail-closed doble (regex SQL espeja el TS + join proyecto por existencia), SOLO confirmado+parlamentario_id, PII-safe (nombre público+contraparte cruda sin RUT/contraparte_id), total_n honesto, LIMIT 50, doble-revoke CERO grant. Guard equivalencia TS↔SQL vía FIXTURE_MATERIA compartido asertado en vitest Y pgTAP; VALIDADO local en pg efímero 14/14 espejados (CERO contacto PROD). FIX RULE-1: branch (b) aplica SIEMPRE (con/sin sufijo en p_boletin) con \M(?!-[[:digit:]]) anti-doble-conteo; tokens intermedios sin dígitos [^space:digit:]+ para robustez backtracking. 0062 NO aplicada a PROD (apply+pgTAP contra schema aplicado + métrica cobertura honesta = Plan 04). lobby_menciones_de_boletin en PUBLIC_RPC_ALLOWLIST. Suite app 1129 verde + tsc 0. LOB-02 canal cerrado; montaje UI = Plan 02/03.

### Pending Todos

Backlog v6.x absorbido como DEBT-02..06 en Phases 74-75.

### Blockers/Concerns

- OPERADOR 2026-07-22 (durante pasada 2): deep-links tramitación FIXEADOS y deployados (quick 260722-eia, versión d99b8fa9 — enlaceHumanoProyecto + link Cámara prmID + token urgencia 3-estados). PENDIENTE del mismo reporte: citaciones (sala y comisiones) y tablas de sesión están MAL WIRED en el frontend — es requisito EXPLÍCITO de Phase 93 (auditoría debe medir el wiring frontend, no solo el scraping) y Phase 94 (fix de /agenda + wiring en ficha), iterando con BrowserOS.

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
| 260722-eia | Deep-links humanos (wspublico→ficha Senado + link Cámara) + token urgencia 3 estados en la ficha; deploy PROD d99b8fa9 | 2026-07-22 | b1ee8f7 | [260722-eia-deeplinks-humanos-urgencia-token-ficha](./quick/260722-eia-deeplinks-humanos-urgencia-token-ficha/) |

## Deferred Items

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| VOTO avanzado | Comparativo voto vs mayoría bancada (VOTOX-01), votos cruzados (VOTOX-02) | v2 (alto riesgo insinuación, tras sign-off) | 2026-07-13 |
| DINERO avanzado | Cruce dinero × voto × timeline por sector (MONEYX-01), co_votación | v2 (máquina de sospechas, 17-LEGAL-DOSSIER §2) | 2026-07-13 |
| Legal | Sign-offs F13/MONEY + F17/NET | Human gate — F13 vive en Phase 73 (v7.0) | v4.0 |
| verification_gap | Phase 62: 62-VERIFICATION.md | human_needed (mismo ítem UAT) | v6.1 close 2026-07-11 |

## Session Continuity

Last session: 2026-07-22T18:13:03.364Z
Stopped at: Roadmap v9.0 creado — 11 fases (86-96) en tres pasadas; 27/27 requisitos mapeados; listo para /gsd:plan-phase 86
Resume file: None

## Operator Next Steps

- v9.0: `/gsd:plan-phase 86` para descomponer el SPIKE de retrieval híbrido; luego `/clear` + prompt de pasada en `.planning/PROMPT-v9.0-build-autonomo.md` (pasada 1 = fases 86-89)
- v9.0 checkpoints de operador (no los flipea el agente): sign-off de deep-links/agenda (gate BrowserOS 89/94), rotación DB password B26 (Phase 96, SEC-04)
- v7.0 (paralelo, cuando quieras): gates de operador según `.planning/HANDOFF-v7.0-operator-gates.md`; al cerrarlos, `/gsd:audit-milestone` → `/gsd:complete-milestone v7.0`
