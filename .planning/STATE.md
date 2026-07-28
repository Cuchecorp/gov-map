---
gsd_state_version: 1.0
milestone: v12.0
milestone_name: — Validación general producto-a-producto
status: executing
stopped_at: Completed 115-01-PLAN.md
last_updated: "2026-07-28T14:52:39.142Z"
last_activity: 2026-07-28
progress:
  total_phases: 13
  completed_phases: 4
  total_plans: 20
  completed_plans: 19
  percent: 31
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-07-13)

**Core value:** La ciudadanía puede responder, sobre cualquier proyecto de ley o parlamentario, "qué pasó, cuándo y según qué fuente" — cada dato con fuente, fecha y enlace, sin afirmar intención ni causalidad.
**Current focus:** Phase 117 — FECHA-FIX — Etiquetas de fecha corregidas

## Current Position

Phase: 117 (FECHA-FIX — Etiquetas de fecha corregidas) — EXECUTING
Plan: 4 of 4
Status: Ready to execute
Last activity: 2026-07-28

### Roadmap v12.0 (Phases 113-125)

Orden de construcción: 113 (inventario, rector) → {114 links internos, 115 links externos, 116→117 fechas, 122 cruces}; carril crons 118→119→120→121 (paralelizable); carril Supabase 123→124 (paralelizable); cierre 125 (deploy + BrowserOS) depende de 114/115/117/119/120/122/124.

Checkpoints de operador previstos: provisión de keys Workers AI antes del flip `CLASIFICACION_ESCALERA=1` (Phase 120). Nada destructivo en Supabase sin checkpoint (Phase 124). Flags MONEY/NOTIF NO se tocan.

Roadmap anterior (detalle v7.0/v11.0) archivado en `milestones/PRE-v12.0-ROADMAP-archive.md`.

### Quick tasks CERRADAS (QT-01, Phase 112)

- 260623-rtl (loadEnv CI-safe) · 260702-rbb (B20/B21 NET /red) · 260713-izo (/red layout B) · 260715-bvd (Dependabot ×3) · 260722-eia (deep-links+urgencia). Marcador CLOSED-v11.0.md en cada dir.

## Performance Metrics

**Velocity:**

- v7.0 plans completed: 0
- v6.1 (62-63): 7 planes, corrida autónoma ~3 días con 2 checkpoints humanos

**By Phase (v7.0):**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 64–75 | TBD | - | - |
| 97 | 3 | - | - |
| 98 | 1 | - | - |
| 99 | 4 | - | - |
| 100 | 4 | - | - |
| 101 | 3 | - | - |
| 102 | 3 | - | - |
| 103 | 5 | - | - |
| 104 | 3 | - | - |
| 113 | 6 | - | - |
| 115 | 3 | - | - |
| 116 | 4 | - | - |

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
| Phase 92 P02 | 6 | 2 tasks | 4 files |
| Phase 92 P03 | 12min | 2 tasks | 4 files |
| Phase 92 P04 | ~55min | 2 tasks | 3 files |
| Phase 93 P01 | ~20min | 2 tasks | 2 files |
| Phase 93 P02 | ~7min | 2 tasks | 1 files |
| Phase 93 P03 | 35min | 2 tasks | 6 files |
| Phase 94 P03 | 35min | 2 tasks | 2 files |
| Phase 94 P02 | ~25 min | 2 tasks | 6 files |
| Phase 97 P02 | ~35min | 1 task | 2 files |
| Phase 97 P03 | ~12 min | 3 tasks | 2 files |
| Phase 98 P01 | ~10 min | 2 tasks | 2 files |
| Phase 99 P01 | 5min | 2 tasks | 2 files |
| Phase 99 P02 | 4min | 2 tasks | 2 files |
| Phase 99 P03 | 8min | 2 tasks | 7 files |
| Phase 99 P04 | 6min | 2 tasks | 1 files |
| Phase 100 P01 | 18min | 2 tasks | 2 files |
| Phase 100 P02 | ~20min | 2 tasks | 2 files |
| Phase 100 P03 | ~10min | 2 tasks | 2 files |
| Phase 101 P01 | 14min | 2 tasks | 1 files |
| Phase 101 P02 | 22min | 2 tasks | 7 files |
| Phase 101 P03 | 35min | 2 tasks | 6 files |
| Phase 102 P01 | 15min | 3 tasks | 11 files |
| Phase 102 P02 | 8 | 2 tasks | 1 files |
| Phase 103 P103-02 | ~18 min | 3 tasks | 6 files |
| Phase 103 P103-03 | ~12 min | 3 tasks | 18 files |
| Phase 103 P103-04 | ~7 min | 3 tasks | 11 files |
| Phase 103 P103-05 | ~40 min | 3 tasks | 2 files |
| Phase 104 P104-01 | ~8 min | 2 tasks | 1 files |
| Phase 104 P104-03 | ~120min | 3 tasks | 7 files |
| Phase 105 P105-02 | 11 min | 4 tasks | 1 files |
| Phase 106 P106-01 | 6min | 3 tasks | 16 files |
| Phase 106 P106-02 | 10 min | 3 tasks | 14 files |
| Phase 107 P107-01 | 6min | 2 tasks | 8 files |
| Phase 107 P107-02 | 7min | 3 tasks | 6 files |
| Phase 107 P107-03 | 9min | 1 tasks | 3 files |
| Phase 108 P02 | 15 | 2 tasks | 6 files |
| Phase 113 P01 | 45m | 3 tasks | 2 files |
| Phase 113 P04 | 1 sesión | 3 tasks | 1 files |
| Phase 113 P05 | 1 sesion | 3 tasks | 2 files |
| Phase 115 P01 | ~30 min | 3 tasks | 3 files |
| Phase 115 P02 | 25m | 2 tasks | 4 files |
| Phase 115 P03 | 35m | 3 tasks | 9 files |
| Phase 116 P116-01 | 35m | 2 tasks | 1 files |
| Phase 116 P04 | 2h | 3 tasks | 2 files |
| Phase 117 P03 | 35m | 3 tasks | 20 files |

## Accumulated Context

### Decisions

- 114-03: el status HTTP se decide ANTES de abrir cualquier `<Suspense>` — un `notFound()` bajo un boundary de streaming pinta la UI de not-found pero deja el status en 200 (las cabeceras ya salieron). Aplicado a `/proyecto/[boletin]`; patrón a revisar en cualquier ruta con guard de existencia bajo Suspense.
- 114-03: SC#3 de la Phase 114 cierra como **PASS con limitación declarada** — el fix está en código con evidencia antes/después y test de respaldo, pero su observación contra el deploy real ocurre en la Phase 125 (deploy diferido, decisión LOCKED v12.0). Nunca se declara verificado sobre el deploy lo que no lo está.

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
- [Phase ?]: 92-02: boletines_mencionados en LobbyAudienciaRow fluye in-place al slice cronologico y a los grupos desde el mismo objeto todas
- [Phase ?]: 92-02: .in() de existencia paginado en IN_CHUNK=500 (< cap PostgREST) -> bound por request siempre < 1000 (MAJOR-5)
- [Phase ?]: 92-03: sección menciones de lobby (carril hermano SEPARADO de 0048, parlamentario ENLAZADO LOB-03, degrade honesto PGRST202 hasta apply 0062 Plan 04); linter con NEGACIONES_LOCKED antes de SUPERFICIES_LOBBY (lección BLOCKER 91) + mutation self-check LOBBY
- [Phase ?]: [Phase 92] 92-04: 0062 APLICADA a PROD (psql --single-transaction, precedente 0059-0061) + pgTAP 13/13 contra schema aplicado (2 fixes Rule-1 de fixture: NOT NULL periodo/origen/enlace + total_n no isolation-safe vs 14309-04 real con audiencias reales); cobertura DECLARADA 195/5106 confirmadas (~3.8%) sobre 82 boletines distintos (query verbatim en runbook); deploy Cloudflare fa4d4369 arrastra fixes UI 91 fuera del bundle e0c969af; gate BrowserOS APROBADO por DOM del deploy real (materia completa+chips fail-closed doble / seccion #lobby-menciones separada de 0048 + leyenda anti-causal + parlamentario enlazado / header partido 91 sin regresion). LOB-01/02/03 LIVE en PROD. Fase 92 CERRADA.
- [Phase 93] 93-01: AUDITORÍA de cobertura de citaciones — secciones MEDIBLES en 93-AUDITORIA-CITACIONES.md (§1-4). Matriz N/M re-medida psql verbatim CERO deriva vs research: comisiones×Cámara 34 (THIN, 2 sem ISO), comisiones×Senado 104 (AL DÍA, forward-only), sala×Cámara 1 sesión (THIN, solo PDF vigente), sala×Senado 11 sesiones (AL DÍA, forward-only). % estado cancelación ~9% Cámara / ~6% Senado (mayoría NO cancelada = honesto; "estado ausente ≠ vigente confirmado" para 94). 10 probes curl: 3 hallazgos previos CONFIRMADOS + REFUTADO "Cámara forward-only" (prmSemana=2026-20 mayo → 200 histórico). CORRECCIÓN #1 (RULE-1): path Cámara comisiones REAL = /legislacion/comisiones/ (el plan decía /sesiones_sala/ → 302 error404) + HOY exige header-set navegador completo (headers-camara.ts), UA simple da 302 (refina research "GET simple pasa WAF"). CORRECCIÓN #2 (RULE-2): endpoint alterno opendata wscamaradiputados.asmx/getComisiones_Vigentes UP 200 XML vivo (el WSComisiones.asmx del research sigue DOWN 302 mantención). cron agenda-weekly.yml EXISTE (lun 11:00 UTC, 7 secrets SUPABASE/DEEPSEEK/R2, mismo CLI); gap = ejecución GH no verificable desde código (billing intermitente) + no hace backfill histórico Cámara. CIT-01 NO completo (spanea 3 planes: wiring frontend = Plan 02 BrowserOS; declaración + backfill = Plan 03).
- [Phase 93] 93-02: auditoría de WIRING de citaciones sobre PROD (fa4d4369) con BrowserOS DOM real → 93-WIRING-EVIDENCIA.md. DOS gaps de WIRING CONFIRMADOS con DOM (no análisis de código). gap #1 = citacionVigente forward-only (estado-actual-block.tsx:122-129, filtro fecha>=hoy) oculta citaciones PASADAS en la ficha — sujeto 18193-06 (cita 2026-07-21) "Citado"=0 ocurrencias; control positivo 11929-13 (cita HOY) SÍ muestra "Citado en de Trabajo…" → aísla que el gap es el filtro, no la query (:311-315 trae todas sin filtro fecha). gap #2 = sesion_tabla_item NO se lee en la ficha (EstadoActualBlock :290-315 no lo consulta; interface EstadoActual :21-45 sin campo sala) — sujeto 13665-07 en sala W28/W29 pero ficha "tabla de sala"=0; contraste /agenda?semana=2026-W28 muestra la fila | 5 | N°13665-07 | … | ORDEN DEL DÍA |. /agenda citaciones NO es forward-only (navega por semana_iso): W26 = 53 pasadas ambas cámaras (acordeón 12+19+22) → refuta sesgo a futuro en /agenda; W30 degrada honesto (Cámara PDF, Senado sin tabla) = gap DATOS. Nota A3 resuelta: token urgencia 260722-eia live pero filtro forward-only NO tocado. Sujetos deterministas por psql; cero fix (fixes = 94). CIT-01 NO completo (declaración + backfill = Plan 03).
- [Phase ?]: 93-03: backfill acotado Cámara W20-W24 (34→164 citaciones, 2→6 semanas ISO) por dos-etapas; Etapa 1 R2 crudo content-addressed cableada en ingest-run step 1 (espejo sala-PDF)
- [Phase ?]: 93-03: --from-r2 para citaciones NO existe hoy; SC#3 satisfecha por runbook operador-LOCAL, no por esta fase; solo la mitad fuente→R2 está viva
- [Phase ?]: 94-03: sesion_sala sin columna semana_iso; semana ISO derivada en TS (Chile tz) en la ficha
- [Phase ?]: 94-04: deploy Cloudflare 9aba6a1a live (OpenNext Docker Linux + wrangler OAuth); gate BrowserOS COMPRENSIBLE sobre el deploy real; SC#1 cerrado por 93; cold-read humano = HANDOFF
- [Phase ?]: 97-01: primer middleware.ts = convencion DEPRECADA Edge (OpenNext la corre Edge); NO proxy.ts/runtime/codemod. Cliente user @supabase/ssr publishable SEPARADO del service_role; /spike-auth no enlazada ejerce OTP. Build Next + suite 1244 + tsc verdes. Deploy OpenNext real = Plan 02.
- [Phase 97] 97-02: SC1 EMPIRICO PASS sobre el DEPLOY REAL — el primer middleware.ts corre como Edge en el build OpenNext (Docker node:22-slim, @opennextjs/cloudflare 1.19.11, Next 16.2.11): warning de deprecacion ESPERADO, NO error "Node.js middleware not supported"; `Bundling middleware function` + `ƒ Proxy (Middleware)` + `OpenNext build complete`. Deploy wrangler global OAuth version 3952f9bc; Camino A 200 (/,+4 rutas), CSP intacta (connect-src 'self'/object-src 'none'/frame-ancestors 'none'). El fallback SC4 (Plan 03) NO se dispara. RULE-1 FIX: la middleware VERBATIM del Plan 01 tumbaba Camino A (matcher global + throw por env ausente -> 500 en TODO el sitio); fix = fail-open (NextResponse.next si falta SUPABASE_PUBLISHABLE_KEY/URL), preserva Camino A; supabase-user.ts SIGUE fail-loud en /spike-auth (500 aislado, espera el secret). GOTCHAS deploy: (1) wrangler REAL sombreado por paquete Python -> usar npm global AppData/Roaming/npm/wrangler.cmd o dentro del contenedor; (2) opennextjs-cloudflare NO en PATH del host -> correr `pnpm run deploy` DENTRO del node:22-slim montando el OAuth del host en /root/.config/.wrangler; (3) robocopy /MIR borra los helper scripts del build dir (no estan en el repo) -> re-escribir tras cada mirror; (4) Cloudflare tarda ~10-30s en propagar la version nueva (500 intermitentes durante el lapso). Plan 03 DESBLOQUEADO en rama POSITIVA (evidencia), PRECONDICION = Task 1 operador (publishable key + config Auth OTP {{ .Token }} + wrangler secret) cerrado primero.
- [Phase ?]: 97-03: evidencia consolidada — SC1 PASS (middleware=Edge), SC3 PASS parcial (Camino A 5/5 200 + CSP frame-ancestors/object-src/connect-src intactos por curl live + Cache-Control anti-leak), SC2 PENDING-operator (Set-Cookie+refresh bloqueado SOLO por el checkpoint de provision diferido, NO por el spike; bloque de reproduccion curl PII-safe listo). Rama A (verde estructural): fallback SC4 NO disparado; NOTIF-103 asume middleware+cookies en Workers sin rewrite server-side-puro. El agente NO intento el flujo OTP live ni creo keys ni toco el dashboard. Fase 97 CIERRA sobre documented-handoff (v7/v9).
- [Phase ?]: 98-01: cifra voto CORREGIDA a 283.550 confirmados / 186 / 4.852 (no 548.642); fail-closed 0 fabricados
- [Phase ?]: 98-01: 2 defectos LOCKED Phase 99 (filtro fecha<=current_date mata filas 2626-05-25; normalizar camara dos grafias); anti-ranking T-52-13; fecha_captura JAMAS es hecho; SEN-06 Camara VIABLE (diferido) / BCN NO-VIABLE; SKILL index on-disk no git-tracked (.gitignore .claude/)
- [Phase ?]: 99-01: actualidad_senal materializado — tabla deny-by-default + proc full-rebuild ACOTADO (delete solo 6 tipos temporales; agrupacion_materia lo posee el CLI 99-03) + pg_cron intradia L-V; 3 defectos LOCKED (fecha<=current_date; regexp_replace camara; camara NULL->sin-camara); supresion-como-fila (sin futuras/stale => fila con causa+conteo 0, nunca ausencia); umbral stale 7d HARDCODEADO (origen packages/freshness/src/catalog.ts leyes/agenda umbralDias:7); sesion_sala CONFIRMADA (A4); validado end-to-end en Postgres 15 efimero; apply PROD+pgTAP = checkpoint 99-04
- [Phase ?]: 99-02: RPC bounded actualidad_senales_panel(p_tipo) aguja-completa espejo 0064 (secdef, search_path='', statement_timeout='5s', LIMIT 200, drop-before-create, doble-revoke, CERO grant); returns table = 9 columnas de actualidad_senal VERBATIM; order by neutral (anti-ranking T-52-13); p_tipo parametrico (ASVS V5); allowlisted PUBLIC_RPC_ALLOWLIST => guard Direction-B verde 14/14; apply PROD = checkpoint 99-04
- [Phase ?]: 99-03: @obs/actualidad k-means CLI — kmeans.ts Lloyd determinista PRNG mulberry32 seed-fija KMEANS_SEED=0x9e3779b9 + init k-means++ + coseno 768d + clamp k [8,15]<=N (checker #2); labelCluster=mode(materia) factual empate-alfabetico JAMAS LLM (T-99-11); run-actualidad-prod-cli service_role lee proyecto_embedding paginado (cap 1k) + join proyecto(materia), full-rebuild ACOTADO delete where tipo_senal=agrupacion_materia (disjunto proc 99-01, T-99-10); dry-run LIVE-READ 3100 embeddings k=10; HALLAZGO: proyecto.materia NULL en 3659 filas PROD -> label (sin materia) honesto (NO bug); suite 96/1252 + tsc 0
- [Phase ?]: 99-04: actualidad-refresh.yml cron intradia L-V (0 11,14,17,20 * * 1-5) clona el scaffold seguro de leyes-weekly SIN el bloque R2 (Phase 99 no toca fuentes: sin R2/rate-limit/robots.txt; solo SUPABASE_API_URL+SUPABASE_SECRET_KEY), corre el CLI k-means @obs/actualidad (run-actualidad-prod-cli), input k por ENV anti-inyeccion, NO --dry-run (escribe LIVE la capa agrupacion_materia). Task 2 apply live-DB DELEGADO al orquestador (aditivo puro: tabla+proc+RPC+cron nuevos, sin flip de regimen ni anon key => fuera de forbidden-gate); el agente NO toco PROD ni bloqueo en human-verify; bloque ready-to-run psql --single-transaction 0065->0066 + pgTAP(12) + verificaciones cron/RPC/conteos escrito en 99-04-SUMMARY.
- [Phase ?]: 100-01: guards extendidos ANTES del copy (Wave 0) — SUPERFICIES_PANEL nuevo (no renombrar SUPERFICIES_HOME, Pitfall 1) + terminos timing/editorial/anti-ranking con tildes exactas; bare 'top' RECHAZADO (colisiona const top de actualidad-module.tsx:407) -> ranking cubierto por frases 'los mas'/'la camara mas activa'. HALLAZGO Rule 3: bento-guards NO toleraba archivo ausente (readFileSync directo) -> añadido try/catch continue a ambos loaders (A). NEGACIONES_LOCKED sin cambios (germen sin negacion de termino prohibido).
- [Phase ?]: 100-03: home monta <PanelActualidad/> bajo un solo Suspense EN LUGAR del cuerpo producto-centrico; hero/accent/entry-cards/EXAMPLE_CHIPS/URL/section[id]/max-w-[1120px]/force-dynamic byte-identicos. actualidad-module.tsx desmontado-no-borrado (import retirado, sigue en SUPERFICIES_HOME). entry-cards movidos debajo del panel (orden DOM preservado). Contract 3 reescrito conservando HomeModule.dynamic===force-dynamic (T-100-09) + asserts de ausencia de germ tiles; Contract 1/2 sin cambio. Suite 1263/1263 + tsc 0 + guards verdes; buscar.test.ts:193 pasa (deuda STALE).
- [Phase ?]: 101-01: audit N/M relaciones GATE — militancia histórica net-new 696 LOCKED (vs shared-ever 1966); lobby-misma-contraparte DIFERIDA (contraparte_id 0/17681 + name-match conflación CGE); zona eje SOLO Senado (diputados 155->0, NO fabricar distrito); coalición Servel VIABLE (dos-etapas R2 documentada NO ejecutada) / comités Senado DIFERIDA (sitio.senado.cl firewalled timeout 21s); RULE-1 name-match 134 parl no 136; CERO write PROD/R2
- [Phase ?]: 101-02: Wave 0 guards ANTES del copy — SUPERFICIES_RELACIONES (4 superficies, loader tolera ausentes) + self-check muerde (aliado/bloque de/coordina con) + militancia_historica_compartida allowlistada; RULE-3: migración 0067 ESCRITA (net-new-only 696, cruce partido_alias) para no dejar huérfana la entrada en Direction-B (allowlist⊆definidas), NO aplicada a PROD; REL-02: RelacionesSection composición pura por children monta bloque relaciones above-the-fold en section id=relaciones con heading+leyenda de grupo+grid 2x2 [&>section]:mt-0 (Pitfall A4), CrossLinkBloque byte-intacto; chip #relaciones omitido del rail (conteo-driven); RULE-1: page.test.tsx resta LEYENDA_CROSS_LINK antes del negative-match
- [Phase ?]: 0067 net-new (696) aplicada a PROD + pgTAP 6/6; /comparar 4 ejes; co-autoría count-only
- [Phase ?]: [Phase 102] 102-01: Wave 0 gate VSIM fail-closed (=== 'true') espejo money + anti-flip V1/V2/V3 + self-check; flip = acto humano anti-DW-NOMINATE (sign-off 102-LEGAL-DOSSIER-VSIM). Linter extendido idioms VSIM DEDUPE (votan juntos/igual/parecido, aliados/aliada, tasa de coincidencia, señal) + LEYENDA_SIMILITUD_VOTO restada de NEGACIONES_LOCKED antes del scan (Pitfall 3). co_votacion ramas muertas borradas de /red + guard estatico permanente strip-comments TS/SQL. 0068_coincidencia_votos_par ESCRITA no aplicada (3 cols agregadas, filtro sustantiva seleccion in si/no/abstencion sobre estado_vinculo=confirmado, doble-revoke CERO grant) + allowlist Direction-B. VSIM_PUBLIC_ENABLED=false en .env.example. RULE-3: */ literal en JSDoc rompia esbuild -> reescrito.
- [Phase ?]: 0068 coincidencia_votos_par APLICADA a PROD (psql --single-transaction) + pgTAP 10/10 contra schema aplicado; denominador VSIM-01 (pareo/no_confirmado excluidos de m_compartidas)
- [Phase 103] 103-01 (PRIMER commit NOTIF-02): lockdown-guard extendido al rol `authenticated` (nuevo esta fase; anon/public era ciego a `to authenticated` — Pitfall 1). Block D = allowlist POSITIVA `USER_OWNED_TABLES={suscripcion,consentimiento}` via `authenticatedGrantOffenders` (clona `anonGrantOffenders` invertido; extrae tabla objetivo por sentencia; scan migraciones >0044 = 0 offenders hoy, MUERDE cuando Plan 02 escriba un grant fuera de la allowlist). Block E = `notificacion_envio` service_role-only (CERO grant a authenticated, cae de Block D + fixture nombrado select/insert/update/delete/all). Mutation self-check ejercita el detector REAL EN MEMORIA (proyecto+queue→offender, suscripcion/consentimiento→0, comentario→0). `.from()` de tablas-de-usuario SCOPEADO a `supabase.ts`; `notif-service.ts` (Plan 03) tolerado explicito via `NOTIF_SERVICE_TS` (el UNICO punto service_role sancionado, espejo de como supabase.ts es el chokepoint PII). notif-gate.ts = chokepoint `=== "true"` (clon vsim-gate) + notif-antiflip-guard 3-vector (V1a-d/V2a-b/V3 app+packages) + self-check. DISTINCION vs VSIM/MONEY: operador PRE-AUTORIZO el flip esta corrida PERO `.env.example=false` y el flip es DEPLOY-TIME (env var Worker), NUNCA committeado; estrictez anti-flip IDENTICA. .env.example += `NOTIF_PUBLIC_ENABLED=false` + `RESEND_API_KEY=` (placeholder Plan 04/05). CERO paquete nuevo. tsc 0; lockdown 22/22 + notif-antiflip 20/20 (money-antiflip verde en foco; timeout 5s bajo carga full-suite = flake pre-existente NO regresion). Commits 6cf3bbc + b4331db.
- [Phase ?]: 103-02: primeras tablas user-owned (0069 suscripcion / 0071 consentimiento) RLS to authenticated + (select auth.uid())=user_id; 0070 notificacion_envio service_role-only cola con cursor idempotente ultimo_evento_visto. RULE-2: post-0044 (ALTER DEFAULT PRIVILEGES FOR ROLE postgres REVOKE ALL ON TABLES FROM authenticated) las tablas net-new dan CERO grant base a authenticated -> RLS owner-scoped MUERTA (permission denied) sin grant explicito; anadido grant select,insert,delete suscripcion + select,insert consentimiento (RLS igual aisla; el grant ES el to-authenticated allowlisted que Block D espera). pgTAP 20/20 (6/6/8) en scratch DB que espeja post-0044; lockdown 22/22. Apply PROD = Plan 05.
- [Phase ?]: [Phase 103] 103-03: user surfaces NOTIF. SUPERFICIES_NOTIF en anti-insinuacion linter ANTES del copy (Wave-0); sin NEGACIONES_LOCKED (niega 'instantáneos', no prohibido). /cuenta OTP (clon spike-auth, WR-01/WR-02) + seguir/dejarDeSeguir con user_id de getClaims().sub SERVER-SIDE (Pitfall 5, RLS with-check backstop) + consentimiento 21.719. token.ts (raw base64url en link, sha256 hex en DB, node:crypto). notif-service.ts = helper service_role DEDICADO separado de supabase.ts (ÚNICO acceso user-table service_role fuera del carril sesión, tolerado por lockdown NOTIF_SERVICE_TS). confirmar/baja login-less noindex (baja one-click). SeguirButton gate-before-render (null si flag OFF = ausente del DOM) en ambas fichas, aria-pressed, petróleo (nunca camara/senado fill). RULE-3: /spike-auth borrado + spike-auth-gate.ts + SPIKE_AUTH_ENABLED .env.example (dead code) + comment middleware→/cuenta; tsc exigió next typegen (.next/types stale). Suite 1401 verde, guards 75/75, tsc 0. Apply PROD 0069-0071 + email confirm = Plan 04/05.
- [Phase 103] 103-04: patrón EGRESO (@obs/notificaciones) — NO es la ingesta de dos etapas: sin fuente, sin R2 crudo, sin rate-limit 2-3s/host, sin robots.txt; el destinatario es Resend, no un WAF → la regla dos-etapas de CLAUDE.md NO aplica (documentado en digest.ts/resend.ts/run-digest-prod-cli.ts/digest-daily.yml). ÚNICA cota = hard-cap 100/día (código, enforceCap) + redacción PII (redactEmail) en TODO log; email JAMÁS crudo en logs/CI/R2. computeNovedades idempotente por cursor (solo id>cursor; nuevoCursor avanza SOLO en envío exitoso → re-run=0); parlamentario fail-closed (proyecto_autor estado_vinculo='confirmado'; no_confirmado/NULL aportan CERO, T-103-21). Envío = global fetch (NO SDK Resend, CERO paquete nuevo T-103-SC) POST api.resend.com/emails + List-Unsubscribe one-click; sin RESEND_API_KEY ⇒ dry-run; 429 respeta retry-after (reintentable, cursor no avanza). renderDigest = la ÚNICA isla de hex inline sancionada (cada hex→su token). digest-daily.yml GATED (workflow_dispatch only, schedule comentado, mirror roster-weekly) + secret NUEVO RESEND_API_KEY (deuda operador). 22 tests + tsc 0. RULE-3: cast supabase-js client a DbLike para tsc -b. Deuda operador Plan 05: apply 0069-0071 + cargar RESEND_API_KEY + dominio verificado + dry-run verde antes de descomentar schedule.
- [Phase ?]: 103-05: Fase 103 CERRADA. Dossier 21.719 signoff:approved (pre-autorización operador-abogado VERBATIM 2026-07-26; agente DOCUMENTA, operador AUTORIZA). 0069/0070/0071 APLICADAS a PROD (psql --single-transaction, orden FK 0069->0070->0071) + pgTAP 20/20 (6/6/8) contra schema APLICADO (RLS user-A-no-ve-B en PROD; notificacion_envio cero grant authenticated; anon no select). schema_migrations retomada en 0069 (0059-0068 applies directos sin traza, quedó en 0058). Task 3 = Flag-OFF closure (NOTIF-05): SUPABASE_PUBLISHABLE_KEY y RESEND_API_KEY AUSENTES de .env (actos operador) -> flag OFF, feature PARKED (migraciones inertes, cron dry-run), CERO email capturado; .env.example=false, notif-antiflip 20/20. DEUDA OPERADOR: publishable key + OTP {{.Token}} + dominio Resend+DPA + RESEND_API_KEY, luego wrangler secret put NOTIF_PUBLIC_ENABLED=true + redeploy (sin tocar .env.example).
- [Phase 104] 104-01: gate pre-deploy verde — suite app 1418 (>1400 base 103) + 21 packages (~1310 tests) + tsc app/root EXIT 0 + 9 guards de régimen v10.0 individualmente verdes (268 tests: anti-insinuación 33, vsim/notif/money-antiflip 20 c/u, lockdown 22, bento 114, bento-coherencia 8, name-match-rut 15, env-example 16). Dossier VSIM firmado signoff:approved transcribiendo la autorización VERBATIM del operador de la corrida de cierre v10.0 ('Sí — firmar y flip ON', 2026-07-26): SOLO front-matter YAML editado (cuerpo del dossier byte-idéntico, 4 líneas cambiadas), .env.example intacto, VSIM anti-flip guard verde POST-firma (el flip VSIM_PUBLIC_ENABLED=true es deploy-time env var Worker Plan 104-02, NUNCA commiteado). El agente DOCUMENTA la autorización; el operador AUTORIZÓ. CERO deviación, cero fix emergente (árbol verde). Commit e0ff591. Gate pre-deploy CERRADO: Plan 02 procede sobre base sólida con flip legítimamente autorizado.
- [Phase ?]: 104-03: E2E v10.0 verificado sobre el deploy real (v b467d41a). VSIM N/M == coincidencia_votos_par para 3 pares; '(100%)' de 3655/3672 es dossier-compliant (round firmado). 101-HUMAN-UAT cerrado 3/3.
- [Phase ?]: 104-03: URI-como-partido (S1344, gap parser BCN Phase 90) corregido display-only con partidoLegible() en 3 chokepoints (PartidoChip/MilitanciasDeParlamentario/ParlamentariosFiltro) + 3 redeploys; clave de filtro serializada RAW por diseno; limpieza en origen = mejora datos futura.
- [Phase ?]: 105-02: re-corrida militancias senadores --from-r2 a PROD (upsert 48 + DELETE acotado 3 filas URI-stale por patron); CERO URI en parlamentario_militancia Y parlamentario post-borrado. GOTCHA: PK id=S1344 pero parlid_senado=1344 numerico (query del plan por parlid_senado=S1344 da 0); testigo por patron URI. Cero omisiones (mapa 105-01 cubre 27 URIs). BCN-02: partidoLegible CONSERVADO defensa-en-profundidad (format.ts sin cambios). Suite bio 70/70 app 1428/1428 tsc 0.
- [Phase ?]: 106-01: @obs/llm-bench scaffolded FUERA de @obs/llm (dep @obs/llm nunca al revés; tsc references NO paths). Barrel src/index.ts = single-owner 106-01 (forward re-exports core+2 guards+4 scorers); Wave-2 solo llena los 6 placeholders export{}, jamás toca el barrel.
- [Phase ?]: 106-01: las dos tasas de fallo son campos SEPARADOS de primera clase — structured_output_fail_rate FUERA de zod_fail_rate.{repaired,terminal} (Pitfall B, test lo asevera). instrumentedFetch devuelve la Response ORIGINAL (lee un clon), sink solo latencia+tokens NUNCA payload (T-106-02); repair round-trips en el wall clock (Pitfall 7). PRICING dated 2026-07-26 [ASSUMED] MEDIUM solo incumbentes (Granite/Phi+secret=107). 18/18 tests + tsc -b root/pkg exit 0; CERO paquete nuevo; @obs/llm intacto.
- [Phase ?]: 106-02: golden sets routing+clasificación es-CL congelados (sha256), scoring top-1+abstención generalizado de cruces, guards que muerden (∩=∅/no-RUT/frozen-hash); SECTOR_CODIGOS inlineado; símbolos con sufijo por el barrel export* plano
- [Phase ?]: 106-03: golden de juez = pares (answer, human_label), accuracy condicional vs humano; extracción parse-rate SEPARADO de value-accuracy
- [Phase ?]: 106-04: harness driver host-agnóstico; baseline LIVE DeepSeek/MiniMax corrido de verdad (provenance real), env-gated NUNCA en CI; el Reporte solo reporta (nada-aprueba-paridad); artefacto commiteado sin secrets
- [Phase ?]: 107-01: GraniteProvider verbatim MiniMax clone + EXPLICIT max_tokens=2048 (Workers AI 256 truncates); host-agnostic baseURL Workers AI/OpenRouter. JudgeProvider SEPARADO en judge.ts, JudgeRequest LOCKED {answer,system?,sensitivity?,temperature?,context?}. PhiJudge determinista temp0 + match-by-name (Phi alucina nombres) + guards IDENTICOS (RUT answer+system, sensitivity). 3 placeholders .env.example VACIOS, guard verde. CERO SDK nuevo. VEREDICTO LIVE=Plan 03 (provision operador).
- [Phase ?]: 107-02: sub-métrica es-CL negacion{total,correctas,accuracy} ADITIVA al scorer de extracción (casos.json+sha256 INTACTOS); correctas ride la MISMA regla de substring literal de idea_matriz. VEREDICTO puro ε-gated (EPSILON_POR_TAREA explícito, extracción la más estricta 0.01) con VETO DURO es-CL que lee negacion.accuracy INDEPENDIENTE de value.precision y CORTOCIRCUITA antes del gate agregado; fixture load-bearing: mejor precision/recall pero peor negacion.accuracy = VETADO. Ausencia de métrica -> pending-evidence; 'nada aprueba' expresable; fallo=gate primera clase. Puente PhiJudge->JuzgarFn (ok->bool, throw->null WR-04) vs human_label, hooks ejercitados; CI mock, LIVE=Plan 03.
- [Phase ?]: 107-03: VEREDICTO LIVE runner (candidatos.live.test.ts) env-gated LLM_BENCH_LIVE + it.skipIf(DEEPSEEK incumbent AND candidate WORKERS_AI/OPENROUTER); same-run DeepSeek incumbent (WARNING-1 pinned baseline); PhiJudge-vs-human (OpenRouter); computarVeredicto per-task asserts provenance + verdict COMPUTED NEVER approval. Candidate keys ABSENT -> VEREDICTO=PENDING-EVIDENCE (outcome VALIDO v7/v9/v10); checkpoint operador surfaceado sin provision; agente NO cargo secreto ni corrio red. CI verde 124/3-skip, tsc 0, .env.example intacto. Handoff 107-OPERATOR-HANDOFF.md.

- [Phase 110] PASADA 3 P4a: live read-only PROD check RESOLVIÓ la contradicción de migraciones — 0053/0054 YA aplicadas (v8.1), solo 0052 faltaba. 0052 APLICADA a PROD (psql --single-transaction, 3 pre-checks fail-closed: nombre constraint / lobby_sector_aporte ABSENTE / MONEY OFF) + pgTAP 7/7 ok contra schema aplicado + count(lobby_sector_aporte)=0 honesto (arista empresa→sector ausente + RUT-01/backfill pendientes, NO bug; materializar_cruces NO invocado manual). 0053/0054 verify-only no-op. V7-07 (CF secrets CLOUDFLARE_API_TOKEN/ACCOUNT_ID ausentes en Cuchecorp/gov-map + rotación B26) = DEUDA OPERADOR diferida por decisión del operador (steps en 110-02-OPERATOR-CHECKPOINT.md; agente NUNCA cargó valor ni rotó). schema_migrations en PROD llega a 0072.
- [Phase ?]: 113-01: deploy auditado anclado por fecha/hora; contraparte NO elegida (contrato/aporte 0 filas + gate MONEY)
- [Phase ?]: 113-03: el link a Senado se registra POST-rewrite de enlaceHumanoProyecto, con la columna cruda en la misma fila
- [Phase ?]: 113-03: todo ProvenanceBadge aporta fila en Tabla B aunque sourceUrl sea null (se declara que el <a> no se emite)
- [Phase ?]: 113-04: header de la raíz como '### 4.4 /' sin comillas para que check-inventario.sh lo matchee; /admin/revisar-entidades EXCLUIDA sin tablas A/B/C
- [Phase ?]: 113-05: inventario rector queda 'estado: validado' — validador Opus independiente PASS 7/7. El id de sonda con forma de RUT del gate MONEY se sustituyo por placeholder no-RUT sin perder poder probatorio (el gate es la PRIMERA sentencia: cualquier id 404ea, verificado con ambos ids). Los 2 falsos positivos del guard de celdas se mantienen (codigo citado verbatim, fuera de tablas) con el limite declarado.
- [Phase ?]: 115-01: se adopta la lectura LITERAL del robots.txt de www.camara.cl (grupo 'User-agent: *' final con 'Disallow: /') por sobre la lectura RFC-9309; 8 casos RETIRADOS de la muestra live, sus patrones se validan solo por construccion. Manifiesto vigente 19 casos / 6 hosts (CASOS_MANIFIESTO/HOSTS_MANIFIESTO son la fuente unica de verdad de los gates del Plan 02, NO las constantes 20/7 del success_criteria).
- [Phase ?]: 115-01: cruce_senal.evidencia NO tiene la clave enlace_fuente (0 filas; claves reales conteo/items); el origen del href de cruces es la columna cruce_senal.enlace (781). Corrige 113-INVENTARIO §3.1.4 filas 6-7.
- [Phase ?]: 115-01: el universo de links externos usa el grep AMPLIADO de sourceUrl (prop JSX + propiedad de objeto); suma 5 call-sites ausentes de §3.1.4, incluido buscar-filtros.tsx:493 (proyecto.enlace CRUDO sin enlaceHumanoProyecto = candidato #1).
- [Phase ?]: 115-02: cero patrones FUENTE-CAIDA-WAF; los 500 de opendata.camara.cl acusan nuestra URL (Falta el parametro: prmBoletin) y los hosts con WAF-en-robots si sirvieron el recurso
- [Phase ?]: 115-02: el fix del timeline no requiere threadear el boletin (TramitacionEventoRow.boletin no-nulable, 0 nulos en PROD); timeline-view.tsx:243,252 son revision obligada por ser los dos call-sites
- [Phase ?]: 115-03: el boletin del timeline NO se threadea (viaja en la fila, types.ts:32-33); el gate de paridad se re-expresa con typecheck + test por call-site + mutacion de :252
- [Phase ?]: 115-03: los fixes de link externo NO se despliegan; viajan con la Phase 125 (SC3 cierra PASS con limitacion declarada)
- [Phase ?]: 116-04: el fix de F-05 NO es aplicar timeZone America/Santiago — 45.618 filas de PROD son date-only disfrazadas de timestamptz
- [Phase ?]: 116-04: el hallazgo de DIA de lobby_audiencia queda REFUTADO por PROD (drift 0/17.762)
- [Phase ?]: 117-03: el rótulo de lobby se compone DENTRO del ternario de fechaTexto, nunca como prefijo en el JSX (el fallback textual viaja verbatim)
- [Phase ?]: 117-03: lobby conserva fechaCorta (no fechaHechoCorta) — PROD refutó el drift de zona en lobby_audiencia.fecha (0/17.762)

### Pending Todos

Backlog v6.x absorbido como DEBT-02..06 en Phases 74-75.

- [Phase 110 DEUDA OPERADOR — blocking-human diferido]: (SC2) cargar `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` como GH secrets en Cuchecorp/gov-map (hoy AUSENTES) + verificar billing GH Actions; (SC3) rotar DB password B26 (Supabase Dashboard → Settings → Database → Reset), re-cargar solo `SUPABASE_DB_URL` en `.env` local, confirmar url-vieja-FALLA / url-nueva-devuelve-1 / CI+sitio verdes. Steps zero-credential-value en `110-02-OPERATOR-CHECKPOINT.md`. Resume: "cargado y rotado" con resultados.

- [Phase 111 DEUDA OPERADOR — blocking-human diferido, LOCAL nunca CI]: orden DURO. (1) RUT-01 (V7-02) — poblar `supabase/seeds/parlamentario-rut.seed.json` con RUTs reales DV-válidos + provenance + correr invocador LOCAL contra REMOTO (GAP: invocador CLI NO construido aún; agente lo materializa on-request; molde backfill-entidad-cli.ts); agente JAMÁS escribe RUT. (2) Votos Cámara (66) + Senado (67), `VOTOS_LIVE=1`, rate-limit 2-3s; invariantes dipids_maestra_no_confirmado=0 + tokens `<SELECCION>`. (3) ChileCompra (70, POST RUT-01, cuota 10k/día, ticket MERCADOPUBLICO_TICKET) + SERVEL (71, .xlsx a R2). Baseline HOY: RUT 0/186, votos 283.550 conf, contrato 0, aporte 0. Maquinaria verde. Steps en `111-OPERATOR-CHECKPOINT.md`. MONEY OFF hasta flip Phase 112.

### Blockers/Concerns

- 97-02 PENDIENTE operador (checkpoint:human-action blocking-human — Task 1): (a) crear la publishable key `sb_publishable_...` en Supabase Dashboard (proyecto bctyygbmqcvizyplktuw), NO la anon legacy ni la secret; (b) Auth → Email provider ON + plantilla OTP que renderice `{{ .Token }}` (NO `{{ .ConfirmationURL }}`); (c) `wrangler secret put SUPABASE_PUBLISHABLE_KEY` (host, OAuth global) + confirmar con `wrangler secret list`; (d) poner el valor en el `.env` LOCAL (NO en `.env.example`). BLOQUEA Plan 03 (sin el secret /spike-auth da 500 y no hay flujo OTP que evidenciar). El agente NO puede crear la key ni tocar el dashboard. Pasos exactos en 97-DEPLOY-RUNBOOK.md §"Estado de runtime pendiente". Resume-signal: "listo" con key cargada + provider/template confirmados, o describir el bloqueo.

- PASADA 2 CERRADA 2026-07-22. Deploy live: `369f9cbe` (dias correctos /agenda). DEUDA que viaja con el PROXIMO deploy (95/96 o cierre): fixes latentes WR-01/02 dedup counts ficha + a11y/accent de 94-UI-REVIEW (ya en master, no bundleados). HANDOFF operador: cold-read humano de /agenda y ficha bio/lobby (gates BrowserOS del agente aprobados con evidencia DOM; el veredicto humano "comprensible" queda abierto, patron v7/v8). Residuo benigno: C:\Temp\obs-build

ode_modules (lock Linux-container, sin secrets — borrar tras reboot).

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
- 107-03 PENDIENTE operador (checkpoint:human-action, VEREDICTO PENDING-EVIDENCE): agregar 3 keys de CANDIDATO a .env (NUNCA .env.example) - WORKERS_AI_API_TOKEN + CLOUDFLARE_ACCOUNT_ID (Granite Workers AI) O OPENROUTER_API_KEY (Granite fallback + Phi juez); DEEPSEEK_API_KEY ya presente (incumbente same-run). Correr: LLM_BENCH_LIVE=1 pnpm --filter @obs/llm-bench exec vitest run src/candidatos.live.test.ts. Sin provision = pending-evidence (outcome VALIDO). Ver 107-OPERATOR-HANDOFF.md. Resume: corrido con veredicto o diferido.

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

Items acknowledged and deferred at v9.0 milestone close on 2026-07-23 (todos pre-v9.0; no bloquean el cierre por directiva de la corrida):

| Category | Item | Status |
|----------|------|--------|
| verification_gap | Phases 64-75 (v7.0): 11 × VERIFICATION.md | human_needed — gates de operador v7.0 (HANDOFF-v7.0-operator-gates.md); cerrar con audit/complete-milestone v7.0 |
| quick_task | 260623-rtl, 260702-rbb, 260713-izo, 260715-bvd, 260722-eia | Completadas en la práctica (commits en tabla Quick Tasks); solo falta marcador formal en su directorio |

## Session Continuity

Last session: 2026-07-28T14:52:23.446Z
Stopped at: Completed 115-01-PLAN.md
Resume file: None

## Operator Next Steps

- Start the next milestone with /gsd:new-milestone

## Deferred Items

Items acknowledged and deferred at milestone close on 2026-07-26:

| Category | Item | Status |
|----------|------|--------|
| uat | 103-HUMAN-UAT (8 provisioning scenarios NOTIF: keys Supabase/Resend, secrets, flip, SC2, dry-run, email UAT) | partial |
| uat | 97-HUMAN-UAT (SC2 evidencia post-provisión) | partial |
| uat | 99-HUMAN-UAT (secrets cron GH) | partial |
| verification | Phases 64-75 (v7.0) human_needed — gates operador históricos (HANDOFF-v7.0-operator-gates.md) | carried-over |
| verification | Phases 97/99/101/103 human_needed — 101 cerrada en 104; resto = provisión operador | partial |
| quick_task | 260623-rtl, 260702-rbb, 260713-izo, 260715-bvd, 260722-eia | unknown (probablemente completas sin marcar) |
| seed | SEED-001 capa LLM escalonada (Granite+Phi) | dormant (por diseño — próximo milestone) |
