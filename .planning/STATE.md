---
gsd_state_version: 1.0
milestone: v3.0
milestone_name: Cobertura de datos
status: planning
last_updated: "2026-06-22T18:30:00.000Z"
last_activity: 2026-06-22
progress:
  total_phases: 10
  completed_phases: 4
  total_plans: 4
  completed_plans: 4
  percent: 40
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-06-18)

**Core value:** La ciudadanía puede responder, sobre cualquier proyecto de ley o parlamentario, "qué pasó, cuándo y según qué fuente" — cada dato con fuente, fecha y enlace, sin afirmar intención ni causalidad.
**Current focus:** Phase 27 — VOT: ingesta masiva de votaciones (Phases 23/24/25/26 completas; lobby+patrimonio poblados)

## Current Position

Phase: 27 — VOT: ingesta masiva de votaciones + cobertura real en la ficha
Plan: — (siguiente a planificar)
Status: Phases 23/24/25/26 COMPLETAS. Lobby (5.106) + patrimonio (1.060) poblados. Autónomo v3.0 en curso.
Last activity: 2026-06-22 — Phase 26 completada en autónomo: LIVE a prod 1.060 declaraciones versionadas / 136 parlamentarios (patrimonio era 0); match TARGETED token-superset (InfoProbidad trae segundos nombres + hermanos homónimos). Siguiente = Phase 27 (votaciones masivas, cruce DIPID determinista — sin issue de nombre).

## Performance Metrics

**Velocity:**

- Total plans completed (v2.0): 0
- Average duration: -
- Total execution time: 0 hours

**By Phase (v2.0):**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

**Recent Trend:**

- Last 5 plans: -
- Trend: -

*Updated after each plan completion*

**v1.0 plan history (shipped):**

| Phase 01 P01 | 11min | 3 tasks | 16 files |
| Phase 01 P02 | 9min | 3 tasks | 25 files |
| Phase 01 P03 | 18min | 2 tasks | 9 files |
| Phase 02 P01 | 8min | 3 tasks | 18 files |
| Phase 02 P02 | 3min | 2 tasks | 7 files |
| Phase 02 P03 | 5min | 1 tasks | 2 files |
| Phase 03 P01 | 14min | 3 tasks | 13 files |
| Phase 03 P02 | 2min | 2 tasks | 2 files |
| Phase 03 P03 | 18min | 3 tasks | 14 files |
| Phase 03 P04 | 14min | 3 tasks | 13 files |
| Phase 04 P01 | 9min | 3 tasks | 13 files |
| Phase 04 P02 | 4min | 2 tasks | 2 files |
| Phase 04 P03 | 12min | 3 tasks | 10 files |
| Phase 05 P01 | 8min | 3 tasks | 16 files |
| Phase 05 P02 | 7min | 3 tasks | 13 files |
| Phase 05 P03 | 8min | 2 tasks | 5 files |
| Phase 05 P04 | 30min | 4 tasks | 36 files |
| Phase 05 P05 | 19min | 3 tasks | 15 files |
| Phase 06 P01 | 12min | 3 tasks | 15 files |
| Phase 06 P02 | 9 | 3 tasks | 10 files |
| Phase 06 P03 | 9min | 2 tasks | 14 files |
| Phase 06 P04 | 17 | 4 tasks | 14 files |
| Phase 07 P02 | 11min | 3 tasks | 14 files |
| Phase 09 P01 | 12min | 2 tasks | 10 files |
| Phase 09 P02 | 7min | 2 tasks | 8 files |
| Phase 09 P03 | 14 | 2 tasks | 4 files |
| Phase 10 P01 | 25min | 3 tasks | 8 files |
| Phase 10 P02 | 20min | 3 tasks | 10 files |
| Phase 10 P03 | 9min | 2 tasks | 11 files |
| Phase 11 P01 | 6min | 3 tasks | 2 files |
| Phase 11 P02 | 20min | 3 tasks | 19 files |
| Phase 11 P03 | 10min | 2 tasks | 4 files |
| Phase 12 P01 | 18min | 3 tasks | 2 files |
| Phase 12 P02 | 38min | 3 tasks | 19 files |
| Phase 12 P03 | 9min | 3 tasks | 5 files |
| Phase 14 P03 | 25min | 2 tasks | 4 files |
| Phase 16 P02 | 13min | 3 tasks | 11 files |
| Phase 19 P01 | 6min | 2 tasks | 1 files |
| Phase 19 P02 | ~7 min | 2 tasks | 1 files |
| Phase 19 P03 | ~5 min | 2 tasks | 1 files |
| Phase 19 P04 | 7 min | 1 tasks | 1 files |
| Phase 19 P05 | 15m | 2 tasks | 1 files |
| Phase 21 P01 | 8min | 2 tasks | 5 files |
| Phase 22 P02 | 8min | 3 tasks | 6 files |
| Phase 22 P03 | 8min | 2 tasks | 3 files |
| Phase 18 P02 | ~5min | 2 tasks | 6 files |
| Phase 18 P03 | 12min | 3 tasks | 7 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Roadmap v3.0]: Numeración continúa desde v2.0 — Phase 22 fue la última; v3.0 arranca en Phase 23 (no reset). 14 reqs mapeados 1:1 a Phases 23–32, 0 huérfanos.
- [Roadmap v3.0]: OPS-01 (apply remoto 0026/0028/0030 por psql --db-url, NUNCA db push) es PRECONDICIÓN (Phase 23) — sin migraciones la data poblada no es visible.
- [Roadmap v3.0]: LOBBY partido en fuente+spike (Phase 24, LOBBY-01) y LIVE+adjudicación+ficha (Phase 25, LOBBY-02/03/04); LOBBY es el mayor impacto (hoy 100% vacío) y desbloquea las aristas NET.
- [Roadmap v3.0]: PAT (Phase 26), VOT (Phase 27), PROV (Phase 28) son fases de poblamiento independientes; RUT-01 (Phase 29) es backfill de operador (nunca fabricar RUT).
- [Roadmap v3.0]: SIGNOFF-01 F13 MONEY (Phase 30) depende de RUT-01; SIGNOFF-02 F17 NET (Phase 31) depende de LOBBY-03 confirmado; OPS-02 (Phase 32) = redeploy + barrido de verificación final.
- [Roadmap v2.0]: Numeración continúa desde v1.0 — Phase 7 fue la última de v1.0; v2.0 arranca en Phase 8 (no reset)
- [Roadmap v2.0]: Build order forzado por dependencias duras — VOTE spike (8, gate) + Identidad (9, paralelo) → VOTE (10) → INT Lobby (11) → INT Probidad (12) → Legal MONEY (13) → MONEY ChileCompra (14) → MONEY SERVEL (15) → MONEY agregación (16) → Legal NET (17) → NET (18)
- [Roadmap v2.0]: VOTE-01 es su propia fase temprana (Phase 8) framed confirm-or-replan; no se dimensiona el bloque VOTE hasta que el spike vuelva
- [Roadmap v2.0]: IDENT-12 (writer-invariant tipado) + LEGAL-03 (RLS/data-routing PII) aterrizan en Phase 9, ANTES de que escriba el primer dataset de atribución nuevo
- [Roadmap v2.0]: Sub-maestras se construyen en su bloque, NO en NET — lobista (11), contratista (14), donante (15); NET (18) es consumidor puro
- [Roadmap v2.0]: LEGAL-01 gate ANTES de exponer MONEY (Phase 13); LEGAL-02 gate ANTES de exponer NET (Phase 17)
- [Roadmap v2.0]: Cada fase de dataset entrega rebanada vertical conector → reconciliación → sección de ficha; "ninguna unidad de UI compone dinero/lobby con un voto" es criterio de éxito desde la primera sección multi-dataset (Phase 11)
- [Roadmap]: M1 = Fundaciones + Identidad + P2 Tramitación + P1 Búsqueda semántica; 7 fases en orden de dependencia dura
- [Roadmap]: Identidad dividida en determinista (P3, desbloquea Tramitación) y adjudicación LLM + gate (P4, sella riesgo existencial #1)
- [Roadmap]: Conectores ordenados por fragilidad ascendente — JSON/XML (P5) antes que WebForms/Next.js (P6)
- [Phase 01]: [01-02]: rate-limiter serial por host (Map host->cola encadenada); BaseConnector Template Method fija el flujo invariante (FND-01)
- [Phase 01]: [01-02]: R2 inmutable via aws4fetch + If-None-Match:* (412=idempotente); drift no-bloqueante (FND-02/FND-04)
- [Phase 02]: [02-02]: MiniMax structured output = tool-calling forzado (tool_choice fija emit_result), NO response_format; valida por compuerta zod externa
- [Phase 02]: [02-02]: data-routing en codigo — assertNoRutInLlmInput (RUT nunca al LLM) + assertSensitivityAllowed reusa SensitiveRoutingError
- [Phase 02]: [02-03]: GeminiEmbeddingProvider L2-normaliza manual a 768 (Gemini no normaliza a dims!=3072); todo vector versionado (FND-07)
- [Phase 03]: [03-01]: matchDeterminista fail-closed, único escritor de estado; confirma solo con length===1 (RUT exacto o nombre único en cámara+periodo)
- [Phase 03]: [03-04]: corrida LIVE → maestra 186 filas (31 senadores + 155 diputados) en Supabase local + snapshot git autoritativo (ID-09); seeder nunca auto-confirma
- [Phase 04]: [04-01]: UMBRAL=0.90 con < ESTRICTO; auto-aceptar mapea SOLO a 'probable', NUNCA 'confirmado'; promocion a confirmado es exclusiva de humano/determinista
- [Phase 04]: [04-02]: identidad_audit inmutable por trigger BEFORE UPDATE OR DELETE + REVOKE (defensa en profundidad, aplica al service role)
- [Phase 05]: [05-01]: RLS public-read EXPLICITO + GRANT SELECT en tablas de tramitacion; parlamentario.rut intacta (deny-by-default)
- [Phase 05]: [05-03]: voto Cámara cruza determinísticamente por Diputado/Id (sin LLM); Senado por nombre vía correrPipeline; solo determinista/confirmado puebla parlamentario_id
- [Phase 05]: Guarda de identidad en UI (TRAM-06): VotoRow enlaza al parlamentario SOLO si estado_vinculo=confirmado; si no, nombre crudo + IdentityMarker
- [Phase 06]: [06-01]: citacion_invitado SIN parlamentario_id ni reconciliacion — invitados son terceros, texto crudo
- [Phase 06]: runIngest degrada honestamente: tabla de Cámara→PDF sin fabricar filas; 403 persistente degrada esa fuente sin abortar el Senado
- [Phase 07]: [07-01]: gate de extracción literal golden (precision>=0.95 BLOQUEA CI); 0011 — RPC match_proyectos ordena por distancia CRUDA `<=>` ASC (HNSW), grant execute a anon
- [Phase 07]: [07-02]: texto-fuente reusa @obs/ingest en orden LOCKED; degradacion encadenada texto null→idea_matriz null→embed titulo+materia (nunca fabrica)
- [Phase 08]: [08-01]: VOTE spike CONFIRMÓ EN VIVO — `getVotacion_Detalle` entrega DIPID+Opcion no-null, totales reconcilian (count(si)===total_si, count(no)===total_no), y DIPID mapea a `id_diputado_camara` determinísticamente al 100% sobre 6 votaciones Leg-58 (boletines 14309/18296). Decisión binaria: **CONFIRMAR** → construir Phase 10 (@obs/votos) tal cual. Corrida LIVE 2026-06-19: 8 requests, 0 errores, delay 2-3s LOCKED reflejado. El allowlist NO requiere edición (camara.cl ya es sufijo)
- [Phase ?]: [Phase 09]: [09-01]: EnlaceConfirmado branded (unique symbol privado, NO exportado) + factory unica confirmar() en @obs/identity; el FK del voto se tipa EnlaceConfirmado|null (string crudo = error de compilacion, IDENT-12)
- [Phase ?]: [Phase 09]: [09-01]: reconciliar-senado + reconciliar-camara (DIPID) son los unicos mint sites de confirmar(); Voto persistido sigue plano string|null (Anti-Pattern A4: input branded, storage plano)
- [Phase ?]: [Phase 09]: [09-02]: backfill-rut DV-gate (isRutValido modulo-11) + provenance + updateRut por id; NUNCA fabrica un RUT (invalido/sin-provenance -> revision). Track B curado entregado; Track A SERVEL NO perseguido (RUT por nombre = candidato, no hecho)
- [Phase ?]: [Phase 09]: [09-02]: golden +3 casos RUT (colision/persona-juridica/colision dura) -> revision/no_match, gate >=0.95 intacto; parlamentario-rut.seed.json filas vacio (operador puebla con DV-validos + provenance)
- [Phase ?]: [Phase 09]: [09-03]: PII nueva nace en tabla deny-by-default (RLS on + cero policies + sin GRANT a anon, espejo de 0005); filas publicas llevan solo el FK, nunca el RUT (LEGAL-03)
- [Phase ?]: [Phase 09]: [09-03]: assertPiiDocumentSafeForLlm COMPONE assertNoRutInLlmInput + assertSensitivityAllowed (RUT primero); cero duplicacion del regex/gate
- [Phase ?]: [Phase 09]: [09-03]: 0018 APLICADA al remoto sa-east-1 (pooler) + pgTAP 11/11 PASS contra schema aplicado; DB password no roto
- [Phase ?]: [Phase 10]: [10-01]: parser emite las 5 opciones del roll-call; ausente deriva del roster (codigo de no-asistencia), NUNCA de la ausencia de fila; abstencion/pareo por texto #text (codigos A1 no confirmados LIVE)
- [Phase ?]: [Phase 10]: [10-01]: 0019 — rebeldias_de_parlamentario security definer (lee partido interno, emite solo derivado publico); votos_de_parlamentario invoker; CERO policy/grant sobre partido (LEGAL-03); aplicada al remoto + pgTAP 13/13
- [Phase ?]: [Phase 10]: [10-02]: @obs/votos producción = runner DELGADO runCamaraVotos que reusa runIngest/reconciliarVotosCamara/SupabaseTramitacionWriter verbatim; corrida acotada obligatoria (boletines o limite); spike eliminado
- [Phase ?]: [Phase 10]: [10-02]: LIVE bounded Leg-58 (14309/18296): 10 votaciones/1389 votos/0 errores/idempotente; A1/A2 CONFIRMADOS — abstencion y ausente traen DIPID por diputado y cruzan determinístico; ratio cruce 83% (fail-closed honesto); escritura a Supabase = paso de operador
- [Phase ?]: [Phase 10]: [10-03]: ficha /parlamentario/[id] = shell de secciones APILABLES (cada sección su <h2>+Suspense+empty honesto) — seam para INT/MONEY; el chip de partido se OMITE (deny-by-default, LEGAL-03)
- [Phase ?]: [Phase 10]: [10-03]: RPC parlamentario_publico (0020, security definer) = único canal público a la maestra deny-by-default; emite solo cabecera, NUNCA partido/rut/email (espejo de rebeldias_de_parlamentario)
- [Phase ?]: [Phase 11]: [11-01]: 0021 lobby — audiencia public-read (PK Identificador estable, FK sujeto-pasivo nullable solo-confirmado) + contraparte deny-by-default + RPC lobby_de_parlamentario security-definer + lobby_ingesta_estado; aplicada al remoto + pgTAP 19/19
- [Phase ?]: [Phase 11]: [11-01]: deny-by-default REAL = RLS-on + cero policies + revoke all from anon,authenticated; el proyecto concede por DEFAULT PRIVILEGES a anon en tablas nuevas de public — patrón a copiar en 12/14/15; threat_flag: tablas PII previas (0018) no revocadas, descansan solo en RLS
- [Phase ?]: [Phase 11]: [11-02]: @obs/lobby crawl LOCKED 2 pasos (listado->detalle, Identificador vive en el detalle); drift BLOQUEANTE (cuarentena); FK sujeto pasivo solo-determinista via EnlaceConfirmado; contrapartes crudas contraparteId null; Camara/Senado NO en leylobby (Open Q2 LIVE), fuente congreso=camara.cl; corrida LIVE acotada AA001/2024 OK, DB write=operador
- [Phase 11]: [11-03]: sección de lobby = primera sección multi-dataset; fija el patrón anti-insinuación de carril propio (section id=lobby sibling a mt-12, nunca compone reunión+voto) para Phases 12/14-16
- [Phase 11]: [11-03]: contraparte SIEMPRE texto crudo + IdentityMarker, NUNCA enlazada (el RPC lobby_de_parlamentario no emite contraparte_id ni RUT — deny-by-default); noIngestado REAL desde ausencia de fila en lobby_ingesta_estado; alias contraparte_rol->contraparte_tipo en el Server Component
- [Phase 12]: [12-01]: 0022 probidad — declaracion VERSIONADA por (fuente_id=URI nodo Declaracion, fecha_presentacion); OQ1 en vivo: identificadorFuente COLISIONA (170562 decl/118624 ids) → la URI del nodo es la clave única. Sub-tablas de bienes public-read con columnas literales pineadas a predicados SPARQL reales (OQ2). tipoDeclaracion SÍ tiene rdfs:label (OQ3)
- [Phase 12]: [12-01]: declaracion_familiar deny-by-default + revoke all from anon,authenticated (lección Phase 11 confirmada operacionalmente: anon→permission denied); sin RUT persona natural; sin FK a parlamentario. comparar_declaraciones devuelve etiqueta/valor literal en filas, CERO delta/veredicto. Aplicada al remoto sa-east-1 + pgTAP 34/34 verde
- [Phase 12]: [12-01]: AccionDerecho.rutJuridica = RUT de EMPRESA declarada (contenido del bien), no de persona natural → vive solo en declaracion_accion_derecho; la assertion pgTAP "sin RUT" se acota a declaracion + declaracion_familiar
- [Phase ?]: 12-02: @obs/probidad parsea SPARQL-JSON LITERAL sin LLM keyed por (fuenteId, fechaPresentacion); writer onConflict incluye fecha_presentacion (versiones acumulan, nunca sobreescribe); declarante name-only solo-determinista (EnlaceConfirmado+identidad_audit); familiares deny-by-default
- [Phase ?]: [Phase 12]: [12-03]: sección patrimonio en carril propio (mt-12, sibling de #lobby); comparación SOLO-datos vía shadcn Table con CERO veredicto/delta (campo ausente = 'No declarado en esta versión'); CC BY 4.0 visible en intro Y caption; fecha de presentación PROMINENTE (mono, 'Presentada el') + ámbar + caveat histórico
- [Phase ?]: [Phase 12]: [12-03]: content-gate test ejerce LISTA Y COMPARACIÓN (cierra la brecha representado de Phase 11); el UI NO computa nada (modelado RPC en el Server Component); comparación SSR ?comparar=A,B sin motor de diff cliente
- [Phase 14]: [14-03]: sección de ficha 'Contratos del Estado asociados al RUT' (carril propio mt-12, sibling de #patrimonio); el gate moneyPublicEnabled() envuelve la <section> ENTERA en page.tsx (heading incluido) — OFF (default) => nodo ausente del HTML, no oculto-con-CSS; ContratosSection igual retorna null antes de tocar Supabase (doble candado). Tres estados honestos distintos (no_consultado/consultado_sin_contratos/enlazado); persona jurídica = sujeto proveedor + 'Enlazado por RUT al parlamentario.' en línea separada (sin posesivo); atribución 'mención de la fuente' (NO CC BY 4.0); throw en rpcError (#34). sourceLabel gana rama chilecompra/mercado->'ChileCompra'. 12 tests RTL verdes.
- [Phase ?]: [Phase 13]: [13-01]: candado B = flag server-only moneyPublicEnabled(env) fail-closed (solo 'true' literal enciende; ausencia/''/'false'/'1'/'TRUE' => false), import 'server-only' linea 1, sin NEXT_PUBLIC_; ubicado en app/lib/ (consumidor = ficha Next.js), sin canal Postgres (diferido a 14-16). pgTAP 0023 re-afirma el piso deny-by-default sobre pii_contraparte_declaracion (RLS + cero policies + anon sin grant SELECT) = contrato que toda money_* de 14-16 hereda; Phase 13 NO introduce DDL MONEY.
- [Phase ?]: 15-02: enlace del candidato SERVEL por NOMBRE via correrPipeline (no RUT); SOLO determinista puebla parlamentario_id; donante PII jamas al LLM (data-routing gate test-enforced)
- [Phase 15]: 15-03: sección de ficha 'Aportes de campaña registrados en SERVEL' (carril propio mt-12, SIBLING de #dinero); gate moneyPublicEnabled() envuelve la <section> ENTERA en page.tsx (heading incluido) — OFF (default) => nodo ausente del HTML; FinanciamientoSection re-chequea antes de Supabase (doble candado). Tres estados honestos distintos (no_ingestado/verificado_sin_aportes/enlazado); agrupación por elección + caveat amber de candidatura anterior + Elección: por fila (defense in depth). Donante = sujeto propio (Aporta:); RUT donante NUNCA renderizado (Ley 21.719). A1 (RE-RESUELTO): la asociación al candidato es 'Asociado por nombre confirmado al candidato.' (SERVEL no trae RUT) — NUNCA 'por RUT' (test lo asierta). Atribución SERVEL 'términos de uso por verificar' (NO CC BY 4.0); throw en rpcError (#34). sourceLabel gana rama servel->'SERVEL'; AporteRpcRow sin RUT donante. 20 tests RTL verdes.
- [Phase 19]: 19-01: DESIGN-SYSTEM.md CERRADO — sistema de diseño consolidado del UI-SPEC §0–§10 en un solo artefacto (257 líneas): crema --background hsl(40 33% 97%) + petróleo --accent-product hsl(183 38% 26%) (60/30/10), Geist Sans/Mono, escala 8-pt con mt-12 como frontera anti-insinuación LOCKED, catálogo de componentes (shipped + NEW spec-only), guía de voz editorial ES con enumeración de vocabulario prohibido VALLADA entre `<!-- BANNED-VOCAB-START/END -->` (el doc pasa su propio negative-match), catálogo de 3 estados honestos + matriz por superficie, 10 invariantes anti-insinuación. EXTIENDE globals.css (nota de wiring para fase futura); civic-tokens.css intacto; cero cambios en app/.
- [Phase 16]: 16-02: ruta ciudadana /contraparte/[id] (empresa = persona jurídica) con DOS carriles mt-12 HERMANOS — contratos (ChileCompra) + aportes (SERVEL) — cada fila trazada (ProvenanceBadge). NUEVO patrón: gate a NIVEL DE PAGINA — `moneyPublicEnabled(process.env) -> notFound()` es la PRIMERA sentencia (antes de await params/RPC/heading); con OFF (default) la ruta entera 404 (sirve not-found.tsx), sin filtración de DOM MONEY (distinto de la ficha, donde el gate envuelve una <section>). CONTRAPARTE_ID_RE=/^[cd]:[A-Za-z0-9 .\-_]+$/ valida 'c:<rut_proveedor>'/'d:<donante_nombre>' ANTES de tocar la DB; HeaderSection: sin fila->notFound, tipo_persona!='jur'->notFound (defensa en profundidad T-16-07), error real->throw (#34). El Section despacha el RPC agregado_por_contraparte por `facet`. ANTI-INSINUACIÓN dura: cero dato de voto, cero lenguaje causal (sweep+RTL), conteo neutral (cero SUM/ranking), montos verbatim, RUT donante nunca renderizado. Atribución por dataset (ChileCompra 'mención de la fuente' / SERVEL 'términos de uso por verificar', NUNCA CC BY 4.0). vitest.config gana app/**/*.test (primer test de ruta). Carril confirmado-parlamentario y /contraparte listado DIFERIDOS. 174 tests RTL verdes (22 nuevos); pendiente de OPERADOR: 16-01 apply remoto + pgTAP 0026.
- [Phase ?]: [Phase 19]: 19-02: BRIEF.md CERRADO — brief de producto cierra SC2 (valor por superficie, IA+nav, landing/hero busqueda-protagonista, onboarding) y SC1 (estudio referencias con 6 capturas refs/*.jpg verificadas en disco). Cero cambios en app/.
- [Phase 19]: 19-03: SCREENS.md CERRADO — contratos por pantalla de las 5 pantallas clave (landing, /buscar, /proyecto/[boletin], /parlamentario/[id], /contraparte/[id]) + GlobalHeader + directorio NEW /parlamentario + /sobre·/metodologia, consolidados desde UI-SPEC §11 (plantilla Route·Layout·Componentes·Estructura·Estados·Anti-insinuación+trazabilidad·Copy). MONEY gated documentado en AMBOS estados (OFF=nodo/ruta ausente; ON futuro descrito); orden de carril LOCKED #votos/#lobby/#patrimonio/#dinero/#financiamiento; NO foto/NO partido; ProvenanceBadge por dato; RUT donante nunca renderizado; vocabulario anti-feature VALLADO (negative-match verde); cero cambios en app/. Cierra SC4 de Phase 19.
- [Phase ?]: Landing mockup (throwaway) hero uses one italic petrol clause 'Con la fuente a la vista.'; no graph motif (deferred); only literal value rendered is boletin 15234-07
- [Phase ?]: Phase 19 design contract CERRADO (BRIEF + DESIGN-SYSTEM + SCREENS + landing mockup): la implementación posterior sigue el brief sin re-abrir decisiones
- [Phase ?]: SC1 (estudio visual browseros) marcado MET por estado en disco: las seis capturas confirmadas presentes en refs/, no por una palabra-veredicto
- [Phase ?]: [Phase 21]: 21-01: globals.css EXTENDIDO a crema/petroleo (DESIGN-SYSTEM 1.1 LOCKED) sobre baseline Slate; --accent-product nueva token + utilidad Tailwind aparte; civic-tokens.css git-diff vacio. GlobalHeader Server Component con active-underline aislado en HeaderNav island (usePathname Client-only Next 16); nav Buscar/Parlamentarios/Agenda/Sobre sin hamburguesa JS, sin foto/partido; generateMetadata noindex intacto.
- [Phase ?]: 21-02: RPC parlamentarios_publico() (0026) = directorio publico sin parametro, espejo EXACTO de 0020 menos provenance (drop p_id + order by neutral por apellido + 7 columnas id/nombre/camara/region/distrito/circunscripcion/periodo); security definer set search_path='' + grant execute a anon; CERO policy/grant select sobre parlamentario; NUNCA partido/rut/email (LEGAL-03). pgTAP 0027 (7 asserts) confirma firma exacta + anon-no-PII. Test del RSC: DirectoryList exportado y probado mockeando sb.rpc (espejo contraparte/[id]). Filtro de nombre literal case-insensitive (sin fold de acentos). DDL al remoto = checkpoint operador pendiente.
- [Phase 22]: 22-01: RPC votos_de_parlamentario EXTENDIDO (0028, additivo, INVOKER, sin PII) — por fila confirmada devuelve titulo + idea_matriz (sustancia; LEFT JOIN proyecto/proyecto_ficha -> null honesto, NUNCA fabricado) + resultado/total_si/total_no/total_abstencion/total_pareo/quorum (desenlace de la votacion ya joinada), evitando los tres .in() N+1 del runbook en el server component. Firma de params (text,int,int) INTACTA; drop+recreate por returns table modificado; grant execute a anon re-emitido; CERO policy/grant sobre parlamentario (LEGAL-03); se queda INVOKER (solo tablas publico-read). pgTAP 0029 (7 asserts) afirma firma + INVOKER + columnas nuevas + anon execute + anon no-PII. VotoFichaRow +8 campos nullable; [Rule 3] dos sitios de construccion del tipo completados con null/de-prueba (voto-ficha-row.tsx + fixture). Aplicacion al remoto = checkpoint operador BLOCKING.
- [Phase 22]: 22-02: VotosView/VotoFichaRow INSTRUCTIVAS (presentacion pura, RTL). Cada voto muestra titulo del proyecto + extracto LITERAL de idea matriz (helper extractoIdea: prefijo de la fuente + elipsis, NUNCA reescribe; honest-state 'De que trata: no disponible aun' cuando idea null, jamas fabrica) + DESENLACE factual 'Voto X · el proyecto fue {resultado} {si-no}' (conteoVotacion en-dash, Mono) solo si resultado != null — hecho de la votacion, no juicio del voto. 'Asistencia' CORREGIDO: el desglose de sentido pasa a heading 'Como voto'; asistencia REAL (presente vs ausente, derivada de conteos.ausente) es metrica propia; sin ausentes degrada a 'Emitio N votos registrados' (no finge asistencia). Votaciones AGRUPADAS POR PROYECTO (el arco: agruparPorProyecto + ProyectoGrupo, titulo+idea una vez como cabecera + etapas votadas debajo). Linea explicativa LOCKED 'A favor / En contra se refiere a aprobar o rechazar el proyecto en esa etapa de su tramitacion'. Cobertura honesta cuando totalProyectos<=5 (el server computa distintos boletines del conjunto completo). honest-state MONEY 'Financiamiento y contratos del Estado' (copy LOCKED 'Pendiente de revision legal (Ley 21.719) antes de publicarse') = carril propio mt-12 sibling, visible cuando moneyPublicEnabled false, MUTUAMENTE EXCLUYENTE con #dinero/#financiamiento reales, cero Supabase/monto/composicion-con-voto. VotoFichaMencion +campos opcionales sustancia/desenlace (mencion cruda conserva IdentityMarker). VotosSection conserva join proyecto.materia (el RPC no trae materia). Vista PURA; suite 209 verde (31 en votos); tsc limpio; cero banned-vocab en copy (negative-match GATE §6/§9.1). Aplicacion remota del RPC 0028 sigue siendo checkpoint operador pendiente, NO bloquea este plan.
- [Phase ?]: [Phase 22]: 22-03: VotacionCard enmarca el desenlace 'El proyecto fue {resultado} {si}-{no}' (conteoVotacion en-dash, Mono) SOBRE el EtapaBadge existente (no lo reemplaza); resultado null omite SOLO la frase (barra/totales intactos). Espejo SC6: la seccion #votaciones del proyecto conecta con su idea matriz via leerFicha cacheada (React.cache, cero query nueva) — linea 'Que se voto: {extractoIdea}' + ancla a #idea-matriz; idea_matriz null omite la linea (honest-state), nunca fabrica. Carriles #votaciones/#idea-matriz siguen hermanos mt-12 (no anidan, no componen con dinero/lobby). Suite 214/214 verde, tsc limpio, cero banned-vocab. RPC 0028 apply remoto pendiente, NO bloquea.
- [Phase ?]: NET Candado B: netPublicEnabled() server-only fail-closed (=== 'true'), espejo de money-gate; ruta /red gatea con notFound() OFF como primera sentencia, sin filtrar DOM; isla RedGraph placeholder real (Plan 18-03 monta xyflow); grafo vacío => estado honesto
- [Phase ?]: NET-02 UI entregada: isla 'use client' @xyflow/react@12.11.0 bajo components/red/ (nodo sobrio nombre+camara, arista=hecho tipado+ventana, provenance siempre en DOM, CC BY 4.0 solo si la fila trae licencia); xyflow contenido en la client island, no infla rutas server. NET sigue gateado-OFF hasta signoff F17

### Pending Todos

None yet for v2.0.

### Blockers/Concerns

- [v2.0 Phase 8 — GATE] ✅ RESUELTO 2026-06-19: spike CONFIRMÓ EN VIVO que `opendata.camara.cl/getVotacion_Detalle` entrega `Diputado/DIPID`+`Opcion` poblados (no null), totales reconcilian y DIPID mapea a `id_diputado_camara` al 100% en la muestra Leg-58. Decisión: **CONFIRMAR** — Phase 10 (@obs/votos) desbloqueada, construir tal cual. (No se replanifica el bloque VOTE.)
- [v2.0 Phase 11 re-validar]: endpoint bulk de `leylobby.gob.cl` devolvió 503 en research — re-validar antes de construir `@obs/lobby`.
- [v2.0 Phase 15 — riesgo conocido]: conector SERVEL artesanal/frágil (no API REST). Drift BLOQUEANTE + reconciliación de completitud obligatorios; una corrida parcial se pone en cuarentena, nunca emite filas silenciosamente. Agregar `servel.cl`/`aportes.servel.cl` al allowlist.
- [v2.0 Phase 14 — quota]: ChileCompra rate/quota (10k req/día) con fan-out por ~186 RUTs → barrido serial vía pgmq + GH Actions; "consultado-cero" ≠ "no-consultado".
- [v2.0 Phases 13/17 — gates legales DUROS]: LEGAL-01 ANTES de exponer MONEY públicamente; LEGAL-02 ANTES de exponer NET. Ley 21.719 plena vigencia 2026-12-01.
- [Deuda v1.0 acarreada]: (1) 🔴 rotar DB password de Supabase (expuesto en transcript); (2) aplicar migración 0011 al Supabase LOCAL (checkpoint humano 07-01 Task 5); (3) cargar corpus a la nube + wiring app→nube; (4) persistir link_mensaje_mocion para activar idea matriz; (5) desplegar Edge Functions + vault secrets. Ver `.planning/v1.0-MILESTONE-AUDIT.md`.
- [Phase 13 — Task 3 OPERADOR pendiente]: correr pgTAP `0023_money_gate.test.sql` contra el remoto Supabase sa-east-1 — extraer `SUPABASE_DB_URL` esquivando BOM U+FEFF (helper Phases 9-12) y `supabase test db --db-url <url>`; confirmar `0023` 3/3 + `0018/0021/0022` verdes. NO hay migración nueva que aplicar (Phase 13 no introduce DDL). Resume-signal: "pgTAP verde". Las dos tareas autónomas (flag server-only + Vitest 5/5; `.env.example`; pgTAP) están completas y verificadas localmente.
- 14-02: checkpoint LIVE probe ChileCompra pendiente (requiere MERCADOPUBLICO_TICKET real; operador). Tareas autonomas 1-2 completas, 24 tests verdes.
- 15-01 Task 3 (checkpoint:human-action, gate=blocking): aplicar 0024_servel.sql al remoto via 'supabase db push --db-url' + 'supabase test db --db-url' (pgTAP 0025 debe pasar 23/23). NO ejecutado por el agente.
- 15-02 OPERADOR: crear bucket privado Supabase Storage crudo-servel + corrida LIVE SERVEL (URL del xlsx por eleccion la provee el operador via --url; ejercita el pipeline de identidad real)
- 21-02 Task 3 checkpoint operador BLOCKING: aplicar 0026 al Supabase remoto via supabase db push --db-url + supabase test db --db-url (pgTAP 0027 = 7/7) + probe psql parlamentarios_publico() 7 columnas sin PII. Codigo Tasks 1-2 commiteado (1965b72, daeb1fc); 6 tests RTL verdes. NO ejecutado por el agente.
- 22-01 Task 3 checkpoint operador BLOCKING: aplicar 0028_votos_instructivos.sql al Supabase remoto via supabase db push --db-url "$SUPABASE_DB_URL" + supabase test db --db-url (pgTAP 0029 verde + 0019/0020/0026/0027 sin regresion) + probe psql votos_de_parlamentario('D1054',50,0) confirmando titulo/idea_matriz/resultado/total_si/total_no/quorum/etapa pobladas para 14309-04/18296-05. Codigo Tasks 1-2 commiteado (d97b845, eb1269f); tsc verde + 13 RTL. NO ejecutado por el agente.
- 18-01 Task 3 checkpoint operador BLOCKING (gate=blocking-human): aplicar 0030_net.sql al Supabase remoto via `psql "$SUPABASE_DB_URL" -f supabase/migrations/0030_net.sql` (NUNCA `supabase db push` — drift schema_migrations ≤0025) + seed `psql "$SUPABASE_DB_URL" -c "select net.materializar_aristas();"` + pgTAP `psql "$SUPABASE_DB_URL" -f supabase/tests/0030_net.test.sql` (16 asserts verdes) + confirmar `select count(*) from cron.job where jobname='net-materializar-aristas'` = 1 + LOGUEAR conteo de aristas materializadas `select tipo, count(*) from arista group by 1;` (un grafo vacío/engañoso se cacha al aplicar, no en producción). Codigo Tasks 1-2 commiteado (2732c53, 60ac5ff); SUMMARY 37ae22e; greps verdes. NO ejecutado por el agente. Gate NET sigue cerrado (NET_PUBLIC_ENABLED OFF hasta signoff F17).

## Deferred Items

Items acknowledged and carried forward from previous milestone close:

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| Búsqueda semántica | Persistir `link_mensaje_mocion` end-to-end (idea matriz dormida hasta cablearlo) | Pending | v1.0 close |
| Infra | Cargar corpus a la nube + wiring app→nube + aplicar 0011 LOCAL + rotar DB password | Pending | v1.0 close |
| v2.1+ | NET-D (contraparte compartida) + cruces inter-bloque — diferidos por riesgo "máquina de sospechas" | Deferred | v2.0 roadmap |

## Session Continuity

Last session: 2026-06-21T05:03:15.732Z
Stopped at: 18-01 Tasks 1-2 code-complete (0030_net.sql entidad/arista deny-by-default + net.materializar_aristas() proc + subgrafo_red RPC PII-safe depth-clamped; 0030_net.test.sql pgTAP 16 asserts incl. plan-checker MEDIUM-2 caso negativo de normalización). DETENIDO en Task 3 = checkpoint de operador BLOCKING (apply remoto por psql --db-url + pgTAP + log conteo de aristas). Gate NET cerrado (NET_PUBLIC_ENABLED OFF hasta signoff F17).
Resume file: None

## Operator Next Steps

- **v3.0 listo para planificar.** Roadmap creado (Phases 23–32). Empezar por `/gsd:plan-phase 23` (OPS — aplicar 0026/0028/0030 al remoto por psql --db-url + pgTAP verde) — precondición de toda la data. Luego LOBBY (24→25), PAT (26), VOT (27), PROV (28), RUT (29), SIGNOFFs (30/31) y cierre OPS-02 (32).
- Phase 8 CONFIRMÓ: planificar Phase 10 (`@obs/votos` producción) con `/gsd:plan-phase 10` — conector + modelo de voto + reconciliación + ficha, reusando los símbolos v1.0 validados.
- Phase 9 (Identidad) puede planificarse/correr en paralelo (VOTE Cámara usa DIPID, no RUT).
- El paquete `packages/votos` es throwaway (spike); Phase 10 lo reemplaza con `src/` de producción.
