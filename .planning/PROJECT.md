# Observatorio del Congreso 360

## What This Is

Plataforma web ciudadana para consultar y cruzar datos públicos del Congreso de Chile, con dos frentes de igual peso: (1) **seguimiento de proyectos de ley** —en qué etapa está cada proyecto, cómo se ha votado, proyectos similares, búsqueda semántica por idea matriz y cuerpos legales— y (2) **análisis de parlamentarios 360** —qué proyectos presentan, cómo votan, con quién se reúnen (lobby), qué declaran en patrimonio e intereses, financiamiento y contratos del Estado que los rodean. Dirigida a público general y prensa, con trazabilidad a la fuente como principio rector.

## Core Value

La ciudadanía puede responder, sobre cualquier proyecto de ley o parlamentario, "qué pasó, cuándo y según qué fuente" — cada dato mostrado lleva fuente, fecha y enlace original, sin afirmar nunca intención ni causalidad.

## Current Milestone (history): v12.0 — Validación general producto-a-producto (shipped 2026-07-29)

**Goal:** Todo el sitio queda validado empíricamente producto por producto (cada página × dato real × fuente), con links y fechas verificados, crons robustos con la escalera LLM encendida donde el benchmark aprobó, y cruces + estructura Supabase auditados — corrida autónoma granular (Sonnet ejecuta, validadores Opus validan, Fable decide), en modo validar-y-arreglar.

**Target features (directiva del operador 2026-07-27):**

1. **Links + fechas por producto**: inventario de superficies; links internos exhaustivos; links externos a fuentes (camara.cl, senado.cl, BCN, leylobby) validados por patrón de generación + muestra live estratificada por tipo (rate-limit 2-3s/host); cada fecha mostrada verificada semánticamente — fecha del hecho vs fecha de captura (gotcha LOCKED: `fecha_captura` JAMÁS se presenta como el hecho).
2. **Crons robustos + escalera LLM ON**: auditoría E2E de todos los workflows/crons (GH Actions + pg_cron); flip `CLASIFICACION_ESCALERA=1` **AUTORIZADO por el operador 2026-07-27** — se ejecuta tras shadow-eval verde + drift canary + rollback-by-config, con checkpoint de provisión de keys Workers AI con el operador; extensión de la escalera a otras tareas SOLO con benchmark nuevo que demuestre paridad (regla LOCKED: ante la duda, SIEMPRE calidad; DeepSeek se mantiene donde el benchmark lo confirmó; adjudicación de identidad INTOCABLE).
3. **Cruces + estructura Supabase**: cada cruce visible validado contra SQL de PROD (conteos cuadrados, denominadores honestos); auditoría de schema/RLS/grants/RPCs bounded/PUBLIC_RPC_ALLOWLIST (supabase-reviewer como gate); fixes aditivos a PROD según precedente 0055+.
4. **Modo validar-y-arreglar**: fix inline de lo delegable (código, migraciones aditivas, redeploy); solo lo destructivo/legal bloquea en checkpoint blocking-human. Flags no autorizados (MONEY, NOTIF) NO se tocan; guards de régimen son la vara del validador.

## Current Milestone (history): v11.0 — Capa LLM escalonada + cierre de deuda viva (shipped 2026-07-27)

**Goal:** La capa LLM pasa de dos-modelos-fijos (DeepSeek volumen / MiniMax crítico) a una escalera granular por tarea (Granite-4.0-H-Micro para routing/preguntas simples/clasificación → Phi-4-mini-instruct como juez/validador → selector que escala a modelo mayor), decidida SOLO por benchmark sobre golden set POR TAREA — regla LOCKED del operador: **ante la duda, SIEMPRE calidad**; DeepSeek se mantiene donde el benchmark lo confirme. Además la deuda viva deja de acumularse: parser BCN senadores corregido en ORIGEN (URI-como-partido), quick tasks cerradas formalmente, y pasada de cierre de los gates v7.0 con participación del operador.

**Target features (directiva del operador 2026-07-26):**

1. **SEED-001 — spike de benchmark POR TAREA** (routing, clasificación, juez/validación, extracción) contra Granite-4.0-H-Micro / Phi-4-mini-instruct / DeepSeek actual, midiendo calidad/latencia/costo. Gate duro: NADA se integra sin paridad de calidad demostrada en el golden set de su tarea. Precedente CI: golden 32 (búsqueda) + golden identidad 1263.
2. **SEED-001 — arquitectura respond→validate→escalate** sobre la capa `LLMProvider` enchufable existente (openai SDK multi-baseURL; salida estructurada = tool calling o prompt-forzado + zod POR PROVEEDOR, jamás asumir `response_format json_schema`); integración gradual por producto empezando por la tarea de menor riesgo; adjudicación de identidad JAMÁS se degrada (Phi solo como segunda opinión).
3. **Parser BCN senadores en ORIGEN**: `hasPoliticalParty` URI→label legible en `@obs/bio` + re-corrida de militancias afectadas; `partidoLegible()` (fix display-only 104-03) queda como cinturón o se retira según evidencia.
4. **Pasada de cierre gates v7.0** (HANDOFF-v7.0-operator-gates.md, patrón v10.0 — operador participa en la corrida): agente ejecuta lo delegable (applies 0052-0054, dry-runs, verificaciones, preparación de runbooks) y bloquea en checkpoints blocking-human para RUT-01, backfills LIVE (votos Cámara/Senado, ChileCompra, SERVEL), flip MONEY legal y cold-reads. El agente NUNCA firma ni flipea.
5. **Quick tasks**: marcador formal de cierre en las 5 abiertas (260623-rtl, 260702-rbb, 260713-izo, 260715-bvd, 260722-eia).

## Current Milestone (history): v10.0 — Panel de actualidad legislativa + notificaciones + relaciones (shipped 2026-07-26)

**Goal:** La landing deja de ser un folleto del producto y se convierte en un PANEL DE ACTUALIDAD cuantitativo — "qué está pasando HOY en el Congreso" derivado de datos objetivos (movimiento, urgencias, nuevos ingresos, votaciones próximas, agrupación por tema) — que alguien que va todos los días al Congreso (periodista, tramitador, asesor) pueda usar como primera pantalla del día; más la evaluación/construcción de un modelo de notificaciones por suscripción (proyecto/parlamentario). Entender el Congreso en fácil y mejorar accountability.

**Target features (brief del operador 2026-07-23):**

1. **Señales cuantitativas objetivas** (base empírica, SPIKE primero): proyectos con más movimiento (trámites recientes), nuevos ingresos, urgencias vivas (Ejecutivo apurando), presentados a último momento, votaciones/citaciones próximas (agenda ya ingerida), leyes recién publicadas (BCN), y lo que más se pueda INFERIR de datos objetivos sin afirmar intención — ser creativo explorando qué da BCN/fuentes ya conectadas. Crons más frecuentes OK (repo público, GH Actions).
2. **Etapa datos ANTES que frontend**: establecer QUÉ debería tener el panel con evidencia (qué señales son computables HOY con los datos ya ingeridos, cuáles requieren ingesta nueva, cuáles son útiles para ciudadano vs tramitador) — spikes + iteraciones BrowserOS + diseño→crítica→loop.
3. **Landing = panel informativo de actualidad**: reemplazar el bento producto-céntrico por "lo que está pasando", incl. agrupación de proyectos con movimiento POR TEMA (los embeddings/pgvector ya existen — clustering factual, jamás editorial).
4. **Notificaciones por suscripción (evaluar + construir lo defendible)**: usuarios se suscriben a un proyecto o parlamentario y reciben novedades/alertas. OJO: primer dato DE USUARIO del sistema → auth + RLS real (hoy anon está muerta y el sitio corre service_role) — diseño de seguridad es parte del alcance, deny-by-default.
5. **Benchmark UX/UI contra senado.cl y camara.cl**: comparación empírica BrowserOS de sus páginas de actualidad/tablas, aprender qué hacen bien/mal y superar — cierre con crítica de diseño.
6. **Relaciones entre parlamentarios — revisión profunda y EXHAUSTIVA** (agregado operador 2026-07-23): hoy "no se muestra nada" pese a tener datos — deben aparecer mismo partido, coalición, mismas comisiones, co-autoría, similitud de votación ("si votan parecido" — el operador lo pide explícitamente: entra al alcance con diseño anti-insinuación factual "coinciden en N de M votaciones", cobertura de votos DECLARADA mientras el backfill v7.0 siga pendiente), zona, lobby con la misma contraparte, militancia histórica. Audit de brecha dato-disponible vs superficie-mostrada primero.
7. **Fase final de verificación E2E** (operador): "asegúrate que TODO funciona" — inventario de superficies × datos reales × BrowserOS antes de cerrar.

**Método (LOCKED por el operador):** TODO con base empírica — spikes, iteraciones BrowserOS, revisión, diseño, crítica, loop. Primero QUÉ (señales con evidencia), después CÓMO (frontend). Corrida en contexto limpio con prompt listo (`.planning/PROMPT-v10.0-build-autonomo.md`).

## Current State: v12.0 shipped (2026-07-29) — archivado CON la deuda

**Shipped v12.0 — Validación general producto-a-producto** (Phases 113-125, 59 planes, 360 commits, 2026-07-27 → 2026-07-29; deploy final `0ea5d97f`). v12.0 **no construyó features**: validó producto-a-producto que lo que el sitio muestra es cierto, y arregló o **declaró** lo que no. Inventario rector de 1.959 líneas (15 rutas × 60 emisores × cada fecha con su columna de origen) **consumido de verdad** por 114/115/116/122/125 —los mismos 3 sujetos deterministas `D1165`/`S1338`/`14309-04` atraviesan el milestone de punta a punta—; 95 links internos con cero 404 y patrones externos validados con mesura instrumentada (2,89 s/request, doble sello); idiom de fecha corregido **y desplegado** (`según fuente al` 0→32, `Actualizado` viejo 318→0); 20 unidades de ingesta con veredicto observado (10 verde · 1 stale · **0 roto**) y 8 de 11 gaps cerrados; flip `CLASIFICACION_ESCALERA=1` con rollback probado **y su alcance nulo declarado** (ningún cron invoca clasificación hoy); **82 números de cruce** recalculados con SQL verbatim contra PROD (72 cuadran, 2 corregidos y desplegados, 8 declarados con ambos números y la query); auditoría Supabase de 6 ejes contra la **DB viva** con `supabase-reviewer` como gate bloqueante (13 offenders, 9 cerrados: 6 por migración aditiva + 3 por guard; lockdown 22→35 con mordida probada por mutación); y pasada E2E por 18 de 19 filas de la Tabla D con evidencia DOM. Suite `app/` 1577→1590; guards de régimen 14/14 (172 tests). 7 migraciones escritas (`0073`–`0079`), **5 aplicadas** (`0074`, `0076`, `0077`, `0078`, `0079`).

**Su mayor logro es incómodo, y se dice tal cual:** el milestone **encontró y documentó que el sitio muestra un número falso** — `Ver detalle (1000)` donde son **3.752 votos**, en **71 de 186 fichas**, con la composición distorsionada por `order by fecha desc` — y **dos offenders de seguridad vivos**: la cadena **SSRF** (`net` con `USAGE` para `anon` **y** `PUBLIC`) y **`pgtap` en `public`** con **1.201** funciones ejecutables por `anon`. No los arregló todos; **ninguno quedó oculto**. Audit `tech_debt`: 11 de 13 requisitos cerrados literalmente, **2 por declaración honesta** (`CRUCE-01` — 2 de 10 discrepancias corregidas; `SUPA-01` — 4 offenders vivos de 13). Detalle: `milestones/v12.0-*.md`.

**Deuda que viaja (aceptada por el operador 2026-07-29 — "archivar v12.0 con la deuda"):**
- **Operador (9):** 🔴 `OP-4` destino de `pgtap` en `public` (+ las 7 suites pgTAP que dependen de ella) · 🔴 `OP-1` probe REST con la anon key (3 requests, **gatea la severidad de `OFF-6-01`**) · 🔴 `OFF-6-03` cadena SSRF (`0075` escrita, no aplicada) · `OFF-01` default ACL de `supabase_admin` (`0073` escrita, no aplicada) · CF secrets + `GEMINI` · identidad local · flip MONEY (gatea `F-08`/`D-01`: techos fijados sobre tablas vacías) · provisión NOTIF · rotación B26.
- **Técnica (7):** 🔴 `B-01` el número falso (RPC de conteo aditiva con la aguja completa + chip y `VotosSection` **simultáneos**) · `B-02` denominador del tile *Por materia* (firma v2 paralela) · `B-03` guard de `create view` sin `security_invoker` (**debe existir ANTES de la primera vista**, hoy es cero vacuo) · `H-01` error boundary de `/comparar` · `H-06` regla de selección del timeline · 🆕 `3.3` co-autoría de `/comparar` truncada a 20 · 🆕 `4-15` dos grafías de cámara en la landing (defecto D2 de `0065:233,261`) — las dos últimas **asignadas por la auditoría de cierre**, salían del milestone sin dueño.
- **🔴 Riesgo latente de deriva:** `0073` y `0075` **escritas y NO aplicadas** (bloqueo demostrado: `42501` / 24 × `WARNING 01006`, no alegado). **Jamás se editan.** Un fix futuro va como migración **nueva** (`0080`). Sin esa disciplina, un `supabase db push` o un ledger reconciliado a ciegas produce deriva.
- **No ejercido:** `P-1` (lectura fría de las 82 filas de 122) y `H-03` sigue `NOT OBSERVED` (límite de instrumento, caso mal instanciado).

## Current Milestone: v13.0 — Portada accionable + noticias vinculadas + cierre de deuda

**Goal:** La portada anuncia hechos legislativos con sujeto, fecha y link a la ficha (no contadores mudos); un cron de noticias vincula prensa a proyectos y parlamentarios con contrato anti-alucinación; y la deuda de v12.0 que daña al lector queda cerrada.

**Target features:**
- Panel de actualidad accionable: sujetos reales (boletín+título+fecha+enlace) en `evidencia` jsonb vía materializador (Opción A adjudicada por spike), 6 tiles editoriales con links guarded, votaciones L4 (VSIM ON + sign-off legal dado 2026-07-30), fix transversal de fechas ("datos al" muere), loop de diseño BrowserOS.
- Crons de noticias RSS → R2 crudo → Supabase con contrato anti-alucinación de tres piezas (lista cerrada → resolver determinista → dead-letter), cerrando los 4 huecos de régimen de Is Chile Safe (robots.txt, delay 2-3s, RSS crudo a R2, content-addressing por hash); golden set arreglado ANTES de medir; vínculo a fichas.
- Deuda v12.0: B-01 (número falso 1000 vs 3.752) 🔴, 4-15 + B-02 (convergen con panel), B-03 (guard pre-vista), H-01, H-06, 3.3.

**Decisiones adjudicadas por spike (2026-07-30, `.planning/spikes/v13.0-*`):**
- **Arquitectura panel: Opción A** — poblar `evidencia` en `materializar_senales()` (migración 0080 aditiva). Payload medido 39,7 KB; B violaba SEN-02 y costaba 4 archivos + 2 guards. Guard 404 en el `left join proyecto` del materializador (`en_corpus:false`, nunca inner-join).
- **Flags PROD verificados por comportamiento:** VSIM/NET/CRUCES **ON**, MONEY/NOTIF **OFF**. L4 votaciones NO necesita flip; el sign-off legal VSIM fue dado **verbatim** por el operador el 2026-07-30.
- **`use_worktrees: true`** — gotcha #11 reproducido al 100% (el amend destruye commits hermanos; `index.lock` falla, no serializa); precondiciones aplicadas: `core.longpaths=true` repo-local + fix `allowBuilds` (`8f37c7e`). El gotcha rmdir de v8.0 NO reprodujo.
- **Tile materia MUERE** — `sector_id` cubre 65/3.657 (1,8%), no se rescata sin backfill. `proyecto_autor`: 20.067 filas, ~90% boletines, 49,9% vinculadas `confirmado` (carril PII, usable con copy honesto). `sesion_sala` Cámara es fila sintética semanal (`camara:sesion:2026-W31`, numero/tipo/hora NULL) ⇒ copy "tabla semanal", jamás "sesión N.º a las HH:MM".
- **Editorial de portada:** propuesta de 6 tiles con sujetos reales en `.planning/spikes/v13.0-editorial-portada.md` (baseline BrowserOS capturado); decisiones O-1..O-7 con recomendación, a ratificar por el operador en el loop de diseño.

Definido por el operador el 2026-07-30. **Régimen de trabajo LOCKED**: discusión granular (nada de auto-aceptar en bloque) → research → plan → **premortem** → revisión de plan doble (`gsd-plan-checker` Opus **y** revisor `model: "fable"` para los temas difíciles) → implementación → validación. **Ante cualquier decisión no obvia: SPIKE** — código que corre, no razonamiento. Validación empírica en código **y BrowserOS**; ningún criterio visual puede ser subjetivo (se cierra con fragmento DOM + captura). Política de modelos ya aplicada en `config.json` (commit `dd27099`): **`gsd-executor` → `sonnet`** es el único downgrade; todo lo demás **Opus**; **Fable** reservado para revisión difícil de plan y para dirimir.

**Objetivo 1 — El panel de la landing, accionable y atractivo.** Reporte del operador verbatim: *"actualmente dice x citaciones, x urgencias, no dice cuáles, no entrega información útil accionable"*. Loop de diseño con Opus mirando BrowserOS hasta que quede bien, con **links directos** a los proyectos que anuncia. **Diagnóstico ya pagado** en `research/v13.0-panel-actualidad-hallazgos.md`: `TileSenal` **no emite ni un `href`** (única zona de la home sin salida), y la columna `evidencia` jsonb **está vacía en la DB** porque `materializar_senales()` nunca la puebla ⇒ **no es un cambio de UI, exige tocar el materializador**. La clave `unique (tipo_senal, cobertura_camara, ventana, cluster_id)` impide una fila por sujeto sin DDL: elegir entre poblar `evidencia` (sin cambio de allowlist) o RPC de detalle nueva es **decisión de arquitectura con spike y revisión Fable**. Riqueza latente medida: las 95 urgencias esconden **5 proyectos en discusión inmediata**; la sesión de Cámara del lunes tiene **20+ proyectos con boletín, título, quórum y urgencia** y se muestra como "1 sesiones"; **166 votaciones de 30 días están ausentes**; y hay **6 proyectos con urgencia agendados esta semana** (sujetos verificados). Riesgo de 404 **medido**: 10 de 49 boletines de agenda futura no existen en `proyecto` ⇒ **guard de existencia obligatorio**.

**Objetivo 2 — Crons de noticias vinculadas a proyectos y parlamentarios.** Replicar el enfoque de `Is Chile Safe` **reimplementado en TS/Deno + Supabase** (ese repo es Python + JSON en git: no es un port). Lo que se copia es el **contrato anti-alucinación de tres piezas**: el LLM emite un nombre de una **lista cerrada inyectada en el prompt** (jamás un id) → resolver determinista offline → `null` en cualquier eslabón **descarta a dead-letter con `rejection_stage`**. Fuentes **100% RSS** (4 medios + Google News RSS Search). **Cuatro huecos de régimen que NO se heredan**: ese repo **no consulta robots.txt** (0 hits), **no tiene delay entre feeds**, **no guarda el RSS crudo** y su content-addressing es incompleto — los cuatro contradicen reglas LOCKED nuestras. Dos lecciones heredadas: **su golden set tiene etiquetas malas** (el techo de 65,9 % es "parcialmente un problema de labels, no de modelo") ⇒ arreglarlo **antes** de medir; y **guardar el input crudo que el LLM vio**. `extraerBoletines` ya existe context-gated fail-closed ⇒ **reusarlo**. Detalle en `research/v13.0-is-chile-safe-ingesta.md`.

**Objetivo 3 — Cerrar la deuda técnica de v12.0.** Prioridad por daño al lector: 🔴 **`B-01`** (el número falso: 1.000 vs 3.752 en 71/186 fichas, con composición distorsionada — **un clamp de seguridad NO es un fix de exactitud**) · `4-15` y `B-02` **convergen con el objetivo 1** · `B-03` debe existir **antes de la primera vista** · `H-01`, `H-06`, `3.3`. Fuera de alcance de agente: `OFF-01`, `OFF-6-03`, `OP-1`, `OP-4` (deuda de operador, bloqueo demostrado).

**Arranque:** `.planning/PROMPT-v13.0-preparar-roadmap.md` en sesión limpia tras `/clear`. Fases numeradas desde **126**.

<details>
<summary>Current State (history): v12.0 en curso — Phases 113-114 (2026-07-28)</summary>

**Phase 114 completa (2026-07-28):** links internos verificados exhaustivos sobre el deploy real — cobertura 77/77 refs del inventario, 95 entradas: 94 PASS + 1 FAIL único (H-01: `/proyecto/<inexistente>` daba 200 por notFound() dentro del boundary de streaming) FIXEADO en código (404 antes del primer Suspense, 3 tests con mordida probada); 20/20 anclas existen por SSR. Runner reproducible `scripts/verificar-links-internos.mjs` endurecido por review (9 findings fixed: integridad de emisión CR-02, WARN-STREAM para secciones bajo Suspense, timeout+retry, selfcheck 28 fixtures). Verification passed 4/4; re-verify en 125: 404 real post-deploy + WARN-STREAM por DOM (expectativa anclada: "cero FAIL", no "95/95 PASS").

**Phase 113 completa (2026-07-28):** inventario rector `113-INVENTARIO.md` `estado: validado` (validador Opus independiente PASS 7/7; verificación 21/21): 15 rutas + 4 not-found, 60 emisores E-NNN, chokepoint DUAL ProvenanceBadge (16 call-sites `sourceUrl` trazados), 4 builders verbatim, 34 columnas URL/8 hosts vía information_schema, 5 sujetos SQL deterministas, gates observados en vivo (NET/CRUCES/VSIM ON, MONEY/NOTIF OFF). Alimenta 114/115/116/122/125. Candidatos ya detectados: `/buscar` pasa `proyecto.enlace` crudo a wspublico XML (115), `estado-actual-block.tsx:429` y `partido-chip.tsx:65-70` muestran `fecha_captura` (116).

</details>

## Current State (history): v10.0 shipped (2026-07-26)

**Phase 104 completa (2026-07-26):** verificación E2E "todo funciona" + deploy final. Cadena de deploys: `027efdf6` → `3cd2511d` (fix /cuenta gate-primero, era 500) → `b467d41a` (3 fixes URI-como-partido en render: PartidoChip, Militancias, faceta) → **`e89b79af` FINAL** (fixes review WR-01/02/04). **VSIM ON en PROD** (dossier 102 firmado con autorización operador verbatim "Sí — firmar y flip ON" 2026-07-26; flip por wrangler secret; `.env.example` intacto): eje "Coinciden en N de M" vivo en /comparar con caveat base-alta, cuadrado contra SQL para 3 pares. Inventario E2E: panel 6 señales vivas × SQL, relaciones conteos == total_n + truncamiento >20 + alfabético, flags OFF DOM-ausentes (NOTIF `/cuenta` gated 200, MONEY), empty states honestos, cero URI-como-partido visible, 101-HUMAN-UAT cerrada 3/3. Verificación: passed 4/4 criterios. Suite 1428 app + guards verdes.

## Current State (history): v10.0 pasada 3

**Phase 103 completa (2026-07-26):** primer dato de usuario — suscripciones + digest email. Lockdown-guard extendido a `authenticated` como PRIMER commit (Block D/E + self-check, 22/22); migraciones 0069-0072 APLICADAS a PROD (suscripcion RLS user-owned pgTAP dos-usuarios, cola `notificacion_envio` zero-grant service_role-only con índice de idempotencia, consentimiento 21.719); /cuenta OTP + botón Seguir gated en ambas fichas + confirmar/baja por token opaco sin login (HMAC-derivado, hash-at-rest, baja one-click a NIVEL USUARIO por CR-03); `@obs/notificaciones` EGRESO (cursor idempotente, cap 100/día, PII redactada, dry-run sin key) + `run-confirmaciones-prod-cli` cerrando el loop doble opt-in + cron `digest-daily.yml` dispatch-only; /spike-auth ELIMINADO. Dossier legal `103-LEGAL-DOSSIER-NOTIF.md` signoff:approved (pre-autorización verbatim del operador-abogado). Review 2 iteraciones: 12 hallazgos TODOS fixed (CR-01 unsubscribe muerto, CR-02 raw tokens descartados, CR-03 granularidad baja). **Flag-OFF closure ejecutado** (NOTIF-05): feature completa e INERTE — provisión operador pendiente (publishable key, OTP template, Resend dominio/DPA/key, NOTIF_TOKEN_SECRET ×2) en `103-HUMAN-UAT.md`; deploy viaja con Phase 104.

## Current State (history): v10.0 pasada 2

**Phases 97-100 completas** (auth spike PASS, señales honestas gate 98, materializador+cron 99, panel actualidad LIVE deploy `3198e159`). **Phase 101 completa (2026-07-24):** relaciones des-enterradas — bloque "Relaciones con otros parlamentarios" above-the-fold (5 bloques, grid 2×2), `/comparar?a=&b=` con 4 ejes factuales no-voto e intersección honesta 3-estados, RPC `militancia_historica_compartida` (0067, net-new 696) aplicada a PROD con pgTAP 9/9; audit REL: zona = solo-Senado (Cámara sin distrito en fuente), lobby-misma-contraparte DIFERIDA (contraparte_id 0/17.681), coalición Servel VIABLE (ingesta pendiente de decisión) / comités Senado DIFERIDA (host firewalled). Review clean tras fix-loop (CR-01..03, WR-01..06). Deploy + BrowserOS de 101 quedan para Phase 104 E2E (101-HUMAN-UAT.md). **Phase 102 completa (2026-07-24):** similitud de votación GATED — RPC `coincidencia_votos_par` (0068) en PROD (pgTAP 14/14, denominador sustantiva + dedupe + self-pair guard), 5º eje neutral en /comparar detrás de `VSIM_PUBLIC_ENABLED` fail-closed OFF (DOM ausente, cero RPC con flag OFF), vsim-gate + anti-flip guard espejo MONEY, linter con 7 idioms VSIM + leyenda base-alta en NEGACIONES_LOCKED, co_votacion excluido de /red (ramas muertas borradas + guard estático permanente + tripwire de prosa), dossier legal `102-LEGAL-DOSSIER-VSIM.md` signoff:pending (base-rate empírica 154 pares avg 63%). Re-review clean. El flip = acto humano exclusivo.

## Current State (history): v9.0 shipped (2026-07-23)

**Shipped v9.0 — Robustez de productos estrella + seguridad final** (Phases 86-96, tres pasadas autónomas). El bug estrella de /buscar quedó FIXEADO (búsqueda híbrida RRF 100% Postgres — FTS unaccent + pgvector HNSW + short-circuit boletín — golden set 32 como regresión CI permanente), con ranking explicable, filtros island de counts honestos y deep-links de validación a la fuente oficial. Parlamentario 360 ganó bio oficial dos-etapas (155 diputados + 31 senadores + 386 membresías de comisión, 0 FK fabricado), partido DIRECTO con fuente+fecha y 4 cross-links factuales anti-causales. Lobby legible (materia completa + audiencia→PL fail-closed por boletín explícito, cobertura declarada) y /agenda por día tz Chile con cobertura parcial DECLARADA. Pasada 3 de seguridad: 9 RPCs nuevas bounded (0064), guards que MUERDEN (Direction-B, crossLinkReader, env-example — 57 tests), gitleaks historial limpio, pnpm audit 14→0 (Next 16.2.11), DB viva 0 offenders, golden gates identidad 1263 verdes, y **CSP ENFORCED en ambas superficies** (deploy final `09f1d5c2`). Audit: PASSED 29/29 reqs, integración 8/8. Detalle: `milestones/v9.0-*.md`.

**Deuda de operador viva:** consolidada en `phases/96-*/96-OPERATOR-HANDOFF.md` — B26 (rotación DB password, runbook 75), pgvector 0.8.0 (plataforma sin ≥0.8.2, CVE-2026-3172, exposición baja), HSTS preload, cold-reads /agenda+ficha; más los gates v7.0 (`HANDOFF-v7.0-operator-gates.md`) y sign-offs F13/F17.

## Current Milestone (history): v9.0 — Robustez de productos estrella + seguridad final (shipped 2026-07-23)

**Goal:** Los 6 productos de cara al ciudadano quedan robustos y validados empíricamente —retrieval de PL que nunca falla lo obvio, ranking+filtros, trazabilidad al punto exacto de la fuente oficial, parlamentario 360 con bio oficial cruzada, lobby legible y enlazado a PLs, citaciones completas (sala+comisiones, ambas cámaras)— cerrando con validación final de seguridad del sitio (repo público) y de Supabase. Máxima legalidad, defensa robusta.

**Estructura: TRES PASADAS autónomas** (con `/clear` entre pasadas, prompt por pasada en `.planning/PROMPT-v9.0-build-autonomo.md`):

1. **Pasada 1 — Búsqueda/PL (productos 1-3):** (a) retrieval híbrido de proyectos de ley (título/nombre, idea matriz, normas afectadas, número de boletín, lenguaje natural) elegido por SPIKE empírico con golden queries — HOY falla con palabras LITERALES del título, eso es inaceptable en el producto estrella; (b) ranking (mensajes del Ejecutivo > mociones, recencia) + filtros client-side que reordenan/filtran resultados YA obtenidos sin re-buscar (año, mensaje/moción, partido, archivado/en tramitación, …); (c) deep-link de validación por boletín a la parte precisa de la página oficial.
2. **Pasada 2 — Personas/Agenda (productos 4-6):** (d) ficha de parlamentario con partido político + biografía oficial del Congreso, cruzada con las demás variables (p.ej. relaciones entre parlamentarios); (e) lobby legible: título completo de lo solicitado + relación con PLs en movimiento con links específicos; (f) citaciones COMPLETAS: auditoría de cobertura de scraping (sala + comisiones, ambas cámaras) antes de tocar UI, estructuradas por día con filtros para periodistas/ciudadanos.
3. **Pasada 3 — Seguridad (productos 7-8):** validación final de seguridad del sitio y de Supabase.

**Ciclo por producto (LOCKED para este milestone):** diseño → prueba empírica BrowserOS → rediseño → validación empírica + de seguridad.

**Modo de trabajo:** Fable (main loop) planifica/dirime/controla; ejecución delegada a agentes Sonnet o menores; BrowserOS como gate empírico de cada superficie; fases muy granulares; numbering continúa desde 85 → v9.0 arranca en **Phase 86**. Gates humanos/legales jamás los flipea un agente.

## Current Milestone (history): v7.0 — Votos, dinero y cierre técnico (code-complete 2026-07-15; gates de operador abiertos — HANDOFF-v7.0-operator-gates.md)

**Goal:** Completar los dos frentes de datos que aún faltaban del producto —cómo vota individualmente cada parlamentario, y el dinero que lo rodea (financiamiento electoral + contratos del Estado)— y cerrar la deuda técnica de ingesta acumulada; todo en fases MUY GRANULARES, deny-by-default, con trazabilidad a la fuente y sin afirmar causalidad.

**Frentes (en orden de ejecución):**

1. **P3 — Cómo vota el Congreso (voto individual).** Hoy el voto por diputado es `Votos=null` en `doGet.asmx` → vive en `opendata.camara.cl` (endpoint SIN VALIDAR, bloqueante histórico de P3). Secuencia: (a) validar/caracterizar el endpoint opendata; (b) conector TS de dos etapas fuente→R2→Supabase con hash-check e idempotencia; (c) modelo de voto individual reconciliado contra la maestra de identidad (fail-closed); (d) superficies de análisis voto × parlamentario × tema/sesión, descriptivas nunca causales, con leyenda anti-insinuación.

2. **P5 — Dimensión dinero (SERVEL + ChileCompra por RUT).** El cruce de mayor impacto reputacional → deny-by-default hasta gate. **Prerrequisito duro REAL: RUT-01** (backfill de RUT a la maestra `entidad_tercero`) debe existir físicamente antes de cruzar — es dato, no un flag. SERVEL es conector artesanal frágil (no API REST, manual por elección); ChileCompra por RUT. Señales de cruce = conteos factuales, nunca scores de correlación. Flag `MONEY_PUBLIC_ENABLED` OFF hasta encendido autorizado.

3. **Deuda técnica + hardening (backlog v6.x).** `source_snapshot` en los conectores restantes (dos etapas LOCKED completas), lobby/probidad `--from-r2` (replay sin molestar la fuente), cursor leylobby, `CLOUDFLARE_API_TOKEN` en CI (crons verdes sin fallback local), rotación round-robin del cron leyes-weekly sobre el corpus 3.657 (dilución de frescura), typography island `.net-*` fuera de contrato, rotar DB password (B26).

**Gates (autorización del operador, 2026-07-13):** el operador PRE-APRUEBA encender los flags `MONEY/NET/cruces` cuando cada fase llegue a su gate con la suite verde. DOS prerrequisitos del mundo real siguen vigentes y el roadmap los secuencia como tales, no como flags que un agente inventa: (1) **RUT-01** — los RUT deben estar backfilleados antes de que P5 cruce; (2) **Ley 21.719** (plena vigencia 2026-12-01) — la pasada de asesoría legal es un acto humano real que el operador provee; su aprobación autoriza el flip, no reemplaza la revisión. El agente construye TODO hasta el gate deny-by-default; el encendido queda autorizado.

**Modo de trabajo (directiva del operador):** Fable (main loop) planifica/dirime/controla; ejecución delegada a agentes Sonnet o menores; BrowserOS como gate de comprensión de cada superficie nueva; fases muy granulares; corrida autónoma tras contexto limpio (ver `.planning/PROMPT-v7.0-build-autonomo.md`).

## Current State: v8.0 shipped (2026-07-15)

**Shipped v8.0 — Rediseño Bento.** La home (y el chrome de todo el sitio) vive en el estilo bento del mockup del operador: `BentoGrid`/`BentoTile` (spans 2/4/6, variants default/accent), tokens `--radius-tile` 16px / `--radius-control` 11px (el `--radius` shadcn intacto — D4), contenedor 1120px, header sticky, footer border-top. Hero con kicker mono + copy LOCKED byte-idéntico (D1); tile accent "¿Cómo leer esto?" con fórmula /sobre y tokens AA nuevos; actualidad (votado/urgencias/frescura) migrada a tiles con queries idénticas y empty states honestos; coherencia acotada a 8 rutas interiores (D3) con /red EXCLUIDO y pixel-idéntico (gate visual fase 75 CERRADO: `.net-chip` 11px por getComputedStyle en deploy). 3 candados de régimen mordiendo (cero-hex, tipografía whitelist, linter home). Deploy `fb88c8a4` (incluye fix de anchors hallado por el gate). Suite 918 app + 1103 packages. Audit: PASSED (7/7, 0 blockers). Gate lectura fría = handoff (`phases/81-*/81-BROWSEROS-GATE.md`). Detalle: `milestones/v8.0-*.md`.

**Deuda de operador viva:** sign-off lectura fría bento (81-BROWSEROS-GATE) + gates v7.0 (`HANDOFF-v7.0-operator-gates.md`).

## Previous State: v6.1 shipped (2026-07-11)

**Shipped v6.1 — Entendible y completo.** Las dos quejas del operador (2026-07-09) quedaron resueltas y en PROD (deploy `af1cfcaf`): (1) `/red` es ENTENDIBLE — ego-network radial determinista (seed + ≤24 vecinos alfabéticos, "Ver N más" honesto, lista móvil <48rem, borde institucional por cámara, leyenda "posición = orden alfabético, no cercanía"; F18 LOCKED intacto), validado por lectura fría BrowserOS ("comprensible") y aprobado por el operador; (2) la búsqueda es COMPLETA — corpus 156→3.657 proyectos (legislatura 2022-2026, enumeración WSLegislativo + backfill LOCAL R2-first reanudable), 3.100 embeddings (84,6% cobertura semántica), ideas matrices 60→1.504, techo honesto 565 por causa (478 RUT-guard LOCKED + 87 schema-fail), y la cobertura DECLARADA en /buscar ("Busca sobre 3100 proyectos…") + señal N/M en `pnpm freshness`. Audit: tech_debt (0 gaps, 6/6 reqs). Detalle: `milestones/v6.1-*.md`.

**Próximo (a planificar con /gsd:new-milestone):** gates humanos/legales (F13/MONEY + F17/NET + 0042 sign-offs, RUT-01 + ChileCompra/SERVEL Phase 40, rotar DB password B26) + backlog v6.0/v6.1 (source_snapshot multi-fuente, lobby --from-r2, cursor leylobby, token CI Cloudflare, UAT rotate /red, rotación round-robin del cron leyes-weekly sobre corpus 3657, typography island .net-*).

## Previous State: v6.0 shipped (2026-07-09)

**Shipped v6.0 — Confiabilidad y comprensión.** Ingesta programada confiable end-to-end: dos etapas fuente→R2→Supabase con hash-check y `--from-r2`, leyes-weekly VERDE en GH Actions (billing activo, secrets cargados), fallback local documentado para lo WAF-bloqueado, y CLI `pnpm freshness` de monitoreo por fuente. Autoría de proyectos poblada (763 autores, 75,9% confirmados fail-closed) → **F48 LIVE** en la ficha. Identidad visual propia (ícono "Capas que se cruzan", selección del operador) integrada en favicon/OG/header/manifest. Comprensión validada por loop BrowserOS: leyenda "Cómo leer esto" anti-causal en cruces + triple requisito en charts; 6/6 hallazgos P0/P1 corregidos con evidencia before/after. Deploys `cd7deb4b` + `051a6cf0`. Audit: tech_debt (0 gaps; backlog: source_snapshot multi-fuente, lobby --from-r2, cursor leylobby, token CI Cloudflare). Detalle: `milestones/v6.0-*.md`.

## Current Milestone (history): v6.1 Entendible y completo (shipped 2026-07-11)

**Goal:** Dos quejas directas del operador (2026-07-09): (1) `/red` "se ve muy confuso" → grafo ENTENDIBLE: ego-network real del seed + layout radial determinista que no implica afinidad (LOCKED F18: nunca force-simulation) + gate BrowserOS; (2) la búsqueda "no funciona con todos los históricos, muchas veces no tiene todas las ideas matrices o las leyes" → búsqueda COMPLETA: fichas+embeddings 100% del corpus (hoy 74/156), corpus histórico ampliado (backfill LOCAL, R2 primero), ideas matrices al máximo con techo honesto, y cobertura DECLARADA en /buscar.

**Fases:** 62 (RED) + 63 (BUSQ). Preparado para corrida autónoma con contexto limpio: ver `.planning/PROMPT-v6.1-build-autonomo.md`.

**Modo de trabajo:** Fable planifica/dirime/controla; ejecutores Sonnet o menores; BrowserOS como gate de comprensión; gates humanos jamás los flipea un agente.

**Después de v6.1 (a planificar):** gates humanos/legales (F13/MONEY + F17/NET + 0042 sign-offs, RUT-01 + ChileCompra/SERVEL Phase 40, rotar DB password B26) + backlog v6.0 (source_snapshot en los 5 conectores restantes, lobby replay R2, cursor leylobby, CLOUDFLARE_API_TOKEN CI).

<!-- v5.0 shipped (2026-07-08): -->
## Previous State: v5.0 shipped (2026-07-08)

**Shipped v5.0 — De datos a comprensión (legibilidad + análisis).** La ficha de parlamentario pasó de muro plano (~900 KB, 1 columna) a superficie navegable y comprensible: acordeones por carril + resumen/índice above-fold, gráficos descriptivos (patrimonio, votos por trimestre, comparativo de ausencias — nunca causales), cruces nuevos, y un rediseño cognitivo de 3 capas (resumen preatentivo → disclosure progresivo → fuente). Todo EN VIVO en Cloudflare (`74e3ad0f`), principio rector intacto (fuente+fecha+enlace). 11 fases (44-55), integración E2E 3/3 wired, nyquist 11/11. **F48 (autoría/similares) DIFERIDA** al próximo milestone por gap de datos (autores 0/136). Detalle: `milestones/v5.0-*.md`.

## Current Milestone (history): v6.0 Confiabilidad y comprensión (shipped 2026-07-09)

**Goal:** Que el dato llegue solo y se entienda solo: (1) toda la ingesta programada corre PERFECTA end-to-end (fuentes→R2 crudo content-addressed, R2→Supabase, hash-check, idempotencia, monitoreo de frescura), (2) gov-map estrena identidad visual propia (ícono serio, public-policy, no estilo-IA), y (3) cada visualización se entiende sin explicación externa (cruces entre parlamentarios primero), validada por iteración fina con BrowserOS.

**Target features:**
- **CRON/INGESTA perfecta** — auditoría E2E de los 9 workflows existentes (agenda, leyes, lobby×2, probidad, fichas-backfill, backup, backfill, deploy); cada conector cumple las DOS ETAPAS LOCKED (fuente→R2, R2→Supabase) re-ejecutables; hash-check antes de descargar; crons de novedades L–V verdes con secrets cargados (o fallback local documentado si billing GH sigue bloqueado); monitoreo de frescura por fuente + alerta de staleness.
- **AUTORÍA de proyectos** — ingesta de autores (hoy 0/136) vía R2→Supabase con reconciliación fail-closed → desbloquea F48 (autoría/similares) diferida de v5.
- **IDENTIDAD VISUAL** — ícono/logo de gov-map: simple, serio, interesante, public-policy oriented; explícitamente NO el estilo típico hecho-con-IA (wordmark con fuentes mezcladas). Integración completa: favicon, OG, header, manifest.
- **VISUALIZACIÓN COMPRENSIBLE** — los cruces entre parlamentarios (y demás superficies: ficha, proyecto, /red, charts) se entienden a la primera; loop BrowserOS captura→corrección→re-captura como gate de cada superficie; leyenda "cómo leer esto" donde falte.

**Modo de trabajo (directiva del operador):** Fable (main loop) planifica/dirime/controla; la ejecución se delega a agentes Sonnet o menores. Todo autónomo y ordenado; los gates humanos/legales NUNCA los flipea un agente.

**Fuera de este milestone:** sign-offs legales F13/MONEY + F17/NET + 0042/cruces-flag (firma humana, Phase 39), RUT-01 + ChileCompra/SERVEL (Phase 40), rotar DB password (B26, acción operador).

<!-- v4.0 shipped (De datos a cruces verificables, Phases 33-43): cruces ENCENDIDOS, lockdown API vía Camino A. Detalle abajo (history) y en milestones/. -->

## Current Milestone (history): v4.0 De datos a cruces verificables

**Goal:** Convertir gov-map de un cascarón pulido con datos por carril en una plataforma que **cruza** lobby, financiamiento y votos por parlamentario y sector, manteniendo trazabilidad a la fuente y sin afirmar causalidad. Construye los cimientos de datos e identidad (ingesta programada + resolución de entidades de terceros), luego la capa de cruces (señales factuales, nunca scores de correlación), luego las superficies de ficha — todo **deny-by-default**, sin encender nada sensible sin firma humana. El frontend/shell sigue cerrado; v4 agrega datos, identidad de terceros y la capa derivada de cruces.

**Roadmap diseñado y validado:** `.planning/MILESTONE-v4-cruces.md` (Fases 0–5, con WHAT/WHY/REPO TARGETS/ACCEPTANCE/AUTONOMY por sub-fase; correcciones de validadores Opus aplicadas). Es la fuente de verdad del diseño; el ROADMAP transcribe sus fases a numeración continua (Phases 33+).

**Target features:**
- **INGESTA (Fase 1.1)** — Wire de los conectores ETL ya completos de lobby (Cámara + LeyLobby) y patrimonio/InfoProbidad a workflows de GitHub Actions recurrentes + paso R2 crudo faltante en probidad (vía `source_snapshot`/`SnapshotWriter`). ChileCompra/SERVEL diferidos (brecha RUT-01).
- **IDENTIDAD DE TERCEROS (Fase 1.2)** — Maestra `entidad_tercero` (donantes/proveedores con RUT + gestores/contrapartes de lobby): ID estable, alias, matcher determinista, pipeline de adjudicación con gate humano. Personas jurídicas: nunca LLM (solo RUT exacto, fail-closed). RUT nunca cruza al LLM.
- **CRUCES (Fase 2.1)** — Capa derivada `cruce_senal` (parlamentario↔sector, conteos de evidencia, sin score), materializador security-definer, etiquetado de sector por LLM con eval propio (NO el de extracción literal). Deny-by-default; señales de voto OFF hasta sign-off (17-LEGAL-DOSSIER §2).
- **SUPERFICIES (Fase 3)** — `CrucesSection` en ficha de parlamentario (#6) y proyecto (#8, opcional/gated), siblings anti-insinuación, provenance inline, detrás de `crucesPublicEnabled()` OFF.
- **RUT-01 + DINERO (Fase 5, diferido)** — Cosecha de RUT a la maestra; wire real de ChileCompra; SERVEL manual por elección. Bloqueado por RUT-01 (prerrequisito duro no resuelto) + sign-off legal.

**Gate legal transversal (Fase 4, #10):** ningún flag `*_PUBLIC_ENABLED` (`MONEY`, `NET`, `cruces`) se enciende sin firma humana (Ley 21.719). F13 (MONEY) y F17 (NET) + sign-off de cruces son acción exclusivamente humana. Un agente autónomo NUNCA flipea estos flags. Subsume los gates pendientes de v3.0 (29 RUT, 30 F13, 31 F17).

**Postura con datos sensibles:** minimización + trazabilidad estricta. Solo se muestra lo que la fuente pública ya publica (con fuente/fecha/enlace); RUT y datos de familiares quedan en uso interno para reconciliar identidad. Las señales de cruce son conteos factuales, nunca afirmación de causalidad; linter de texto prohíbe vocabulario insinuante. Ley 21.719 (plena vigencia 2026-12-01) → pasada de asesoría legal antes de cualquier exposición pública amplia.

<!-- v3.0 (Cobertura de datos, Phases 23–32): frente automatable CERRADO y desplegado (lobby 5.106 confirmadas/136 dip, NET 7.394 aristas, patrimonio 1.060/136, votos source-limited). Sus 3 gates humanos pendientes (29 RUT, 30 F13 MONEY, 31 F17 NET) NO se descartan: se SUBSUMEN en v4 (Fase 5 = RUT-01; Fase 4 = F13/F17 + cruces). -->
<!-- v4.0 Fase 0 (Desbloqueo CI — loadEnv CI-safe en CLIs lobby/probidad) ya EJECUTADA: quick task 260623-rtl, commits 1844b2f/399e3e2. = Phase 33 (✅ done). -->

## Current Milestone (history): v3.0 Cobertura de datos

**Goal:** Llenar las secciones vacías de la ficha del parlamentario poblando datos REALES en la nube (lobby, patrimonio, votaciones), adjudicando identidad y arreglando provenance. Frente automatable CERRADO (Phases 23–32, desplegado); gates humanos 29/30/31 subsumidos en v4.

## Requirements

### Validated

<!-- v1.0 MVP — Proyectos de Ley + Fundaciones de Identidad (shipped 2026-06-18). Detalle: .planning/milestones/v1.0-*.md -->

**Validación general producto-a-producto (v12.0) — shipped 2026-07-29 (audit `tech_debt`, archivado CON la deuda)**
- ✓ Inventario rector de superficies (1.959 líneas: 15 rutas × 60 emisores × cada fecha con su columna de origen), consumido por 114/115/116/122/125 (LINK-01) — v12.0
- ✓ Links internos exhaustivos sobre el deploy real: 95 links, cero 404, cero anclas rotas (LINK-02) — v12.0
- ✓ Patrones de link externo validados por construcción + muestra estratificada con mesura instrumentada 2,89 s/request; fuente caída declarada, cero reintento (LINK-03) — v12.0
- ✓ Semántica de cada fecha visible auditada (63 ocurrencias de `fecha_captura` marcadas) y corregida **y desplegada** (`según fuente al` 0→32, `Actualizado` viejo 318→0) (FECHA-01, FECHA-02) — v12.0
- ✓ 20 unidades de ingesta con veredicto **observado** (10 verde · 1 stale · **0 roto**) + 8 de 11 gaps de robustez cerrados; degrade honesto, cero fabricación (CRON-01, CRON-02) — v12.0
- ✓ Escalera LLM encendida en clasificación con rollback probado ON→OFF→ON, y su **alcance nulo declarado** (ningún cron invoca clasificación hoy); extensión a otras tareas documentada como NO por falta de benchmark (CRON-03, CRON-04) — v12.0
- ⚠️ 82 números de cruce recalculados con SQL verbatim contra PROD: 72 cuadran, 2 corregidos y desplegados, **8 declarados sin corregir** — `CRUCE-01` **cerrado por declaración, no por corrección** (puntero `B-01`: el sitio muestra 1.000 donde son 3.752) — v12.0
- ⚠️ Auditoría Supabase de 6 ejes contra la **DB viva** con `supabase-reviewer` como gate bloqueante: 13 offenders, 9 cerrados, **4 vivos** — `SUPA-01` **cerrado por declaración** (punteros `OP-1`/`OP-4`: SSRF `net`→`anon`/`PUBLIC` y `pgtap` en `public` con 1.201 funciones exec-`anon`) — v12.0
- ✓ 5 migraciones aditivas aplicadas a PROD con pgTAP contra el schema aplicado (`0074`, `0076`, `0077`, `0078`, `0079`); `0073`/`0075` escritas y NO aplicadas por ownership, **jamás se editan** (SUPA-02) — v12.0
- ✓ Pasada E2E producto-a-producto sobre el deploy real: 18 de 19 filas de la Tabla D con evidencia DOM, flags no autorizados ausentes con control positivo apareado (E2E-01) — v12.0

**Panel de actualidad + notificaciones + relaciones (v10.0) — shipped 2026-07-26**
- ✓ Auth-on-Workers de-riskeado: middleware Edge + @supabase/ssr sobreviven OpenNext; patrón LOCKED para dato de usuario (AUTH-01) — v10.0
- ✓ Señales honestas con gate empírico previo (spike 98) + materializador `actualidad_senal` + RPCs bounded + cron intradía (SEN-01..06) — v10.0
- ✓ Landing = panel de actualidad cuantitativo con supresión-como-fila, fuente+fecha, benchmark senado/cámara (PANEL-01..04) — v10.0
- ✓ Relaciones des-enterradas: bloque above-the-fold + /comparar 4 ejes factuales + militancia histórica (0067) (REL-01..05) — v10.0
- ✓ Similitud de votación "coinciden en N de M" con caveat base-alta — VSIM ON en PROD con dossier firmado por operador 2026-07-26 (VSIM-01..03) — v10.0
- ✓ Primer dato de usuario: suscripciones RLS `to authenticated` + lockdown-guard extendido + digest EGRESO Resend + doble opt-in con tokens HMAC + dossier 21.719 firmado; INERTE tras Flag-OFF closure hasta provisión operador (NOTIF-01..05) — v10.0
- ✓ Verificación E2E: inventario × dato real × BrowserOS sobre deploy final `e89b79af`, cero URI-como-partido visible (E2E-01) — v10.0

**Robustez de productos estrella + seguridad final (v9.0) — shipped 2026-07-23**
- ✓ Retrieval híbrido RRF Postgres-nativo con short-circuit boletín + golden set 32 CI (RETR-01..05) — v9.0
- ✓ Ranking explicable (mensaje>moción, sin scores) + filtros island counts honestos incl. partido (RANK-01, FILT-01..03) — v9.0
- ✓ Deep-links de validación por boletín (Senado/Cámara prmID/BCN) + fecha captura + snapshot R2 (TRACE-01..03) — v9.0
- ✓ Bio oficial dos-etapas con allowlist por construcción + comisiones + partido directo + cross-links factuales (BIO-01..05) — v9.0
- ✓ Lobby legible: materia completa + audiencia→PL fail-closed por boletín explícito, bidireccional (LOB-01..03) — v9.0
- ✓ Citaciones: cobertura auditada N/M declarada + /agenda por día tz Chile + filtros periodista (CIT-01..05) — v9.0
- ✓ Seguridad final: guards extendidos + bounded RPCs 0064 + audit repo/DB viva + CSP enforced (SEC-01..04) — v9.0

**Fundaciones (FND-01..08) — v1.0**
- ✓ Framework de conectores `@obs/ingest` (rate-limit 2–3s serial por host, robots, UA, caché diaria, snapshots versionados, drift no-bloqueante) — v1.0
- ✓ Crudo inmutable content-addressed en Cloudflare R2 (aws4fetch + If-None-Match); Postgres solo modelo normalizado + vectores — v1.0
- ✓ Orquestación pgmq + pg_cron + Edge Function worker + escape hatch GitHub Actions (todo en SQL versionado) — v1.0
- ✓ Interfaces enchufables `LLMProvider`/`EmbeddingProvider` con salida estructurada validada per-proveedor (zod) y vectores versionados (768-dim Gemini) — v1.0

**Identidad (ID-01..09) — v1.0**
- ✓ Maestra `Parlamentario` sembrada (186 filas reales: 31 senadores + 155 diputados) con respaldo externo (snapshot git autoritativo) — v1.0
- ✓ Pipeline de reconciliación: determinista fail-closed → blocking → adjudicación MiniMax (umbral 0.90) → compuerta → revisión humana → golden set (gate CI ≥0.95) → audit inmutable — v1.0

**Tramitación (TRAM-01..09) — v1.0**
- ✓ Conectores Cámara (JSON/XML) + Senado (`wspublico` XML); modelo común `Proyecto`/`Votacion`/`Voto` por boletín — v1.0
- ✓ Ficha `/proyecto/[boletin]` con timeline cross-cámara, votaciones, frescura por fuente y guarda de identidad en UI (link solo si `confirmado`) — v1.0
- ✓ Citaciones Cámara (HTML anti-Cloudflare) + Senado (API backend) y tabla semanal de sala en `/agenda` — v1.0

**Búsqueda semántica (SEM-01..06) — v1.0**
- ✓ Extracción literal de idea matriz + cuerpos legales (DeepSeek + prompt restrictivo, guardrail #2) con golden gate de fidelidad — v1.0
- ✓ Embeddings asimétricos (Gemini RETRIEVAL_DOCUMENT/QUERY) + pgvector HNSW + RPC `match_proyectos`; búsqueda NL y "proyectos similares" kNN — v1.0
  - ⚠️ Follow-up: persistir `link_mensaje_mocion` end-to-end (idea matriz queda dormida hasta cablearlo) + cargar corpus a la nube. Ver `.planning/v1.0-MILESTONE-AUDIT.md`.

**Entendible y completo (v6.1) — shipped 2026-07-11**
- ✓ `/red` ego-network radial determinista (RED-01/02/03): seed + ≤24 vecinos alfabéticos, cero force-simulation (F18), lista móvil, leyenda honesta; gate BrowserOS "comprensible" — v6.1
- ✓ Búsqueda sobre corpus completo declarado (BUSQ-01/02/03): 3.657 proyectos (2022-2026), 3.100 embeddings, ideas 1.504, techo honesto por causa, banner de cobertura en /buscar + freshness N/M — v6.1

**Legibilidad + análisis (v5.0) — shipped 2026-07-08**
- ✓ Navegación de la ficha: acordeones por carril (LEG-01) + resumen/índice above-fold con chips de 3 estados (LEG-02), comportamiento-preservante (LEG-03) — v5.0
- ✓ Gráficos descriptivos (nunca causales): patrimonio conteo/año (VIZ-01/02/03), "Cuándo votó" por trimestre (VIZ-VOTOS), comparativo de ausencias vs mediana de cámara (VIZ-COMP, RPC PII-safe) — v5.0
- ✓ Cruces en ficha de proyecto (SURF-02) + carril lobby×tramitación + cruces ampliados (CRUCE2, `cruce_senal` 30→781) — v5.0
- ✓ UX: nav global de 5 destinos + breadcrumbs (UX-01), pulido presentacional / `formatNombre` / tarjetas home (UX-02), rediseño cognitivo de 3 capas (UX-03) — v5.0

### Active

- [ ] **Deuda que viaja desde v12.0 (próximo milestone la recibe):** 🔴 `B-01` el número falso (`Ver detalle (1000)` vs 3.752 en 71/186 fichas) · 🔴 `OP-1` probe REST (gatea `OFF-6-01`) · 🔴 `OP-4` `pgtap` en `public` · 🔴 `OFF-6-03` cadena SSRF · `OFF-01` default ACL · `B-02`/`B-03`/`H-01`/`H-06` · 🆕 `3.3` y `4-15` (asignadas por la auditoría de cierre) · `0073`/`0075` escritas-no-aplicadas (**jamás editarlas: un fix va como `0080`**) · `P-1` lectura fría no ejercida. Detalle: `milestones/v12.0-MILESTONE-AUDIT.md` §8.
- [x] **v12.0 — validación general producto-a-producto** (shipped 2026-07-29, archivado CON la deuda): inventario rector consumido · links + fechas verificados y desplegados · 20 crons con veredicto observado (0 roto) + flip escalera con alcance nulo declarado · 82 números de cruce contra SQL de PROD · auditoría Supabase contra la DB viva (13 offenders, 9 cerrados) · E2E sobre el deploy real. Audit `tech_debt`: 11/13 literales, 2 por declaración.
- [x] **v11.0 — capa LLM escalonada + cierre de deuda viva** (shipped 2026-07-27): benchmark por tarea (Granite APPROVED solo clasificación) · TieredProvider respond→validate→escalate default-OFF · parser BCN en origen · 0052 a PROD + quick tasks cerradas. Audit 20/24 (4 deferred operator-debt).
- [x] **v10.0 — panel de actualidad + notificaciones + relaciones** (shipped 2026-07-26): panel señales honestas · relaciones + /comparar + VSIM ON (dossier firmado) · primer dato de usuario (auth+RLS, digest EGRESO, inerte hasta provisión) · E2E final deploy e89b79af. Audit PASSED 25/25.
- [x] **v9.0 — robustez de productos estrella + seguridad final** (shipped 2026-07-23): búsqueda híbrida RRF + ranking/filtros + deep-links de validación · bio oficial + partido directo + cross-links · lobby legible audiencia→PL · /agenda por día con cobertura declarada · seguridad final (bounded RPCs, guards, gitleaks, audit DB viva, CSP enforced). Audit PASSED 29/29.
- [~] **v7.0 — votos, dinero y cierre técnico** (code-complete 2026-07-15, gates de operador abiertos — HANDOFF-v7.0-operator-gates.md): P3 voto individual (opendata.camara.cl) → P5 dimensión dinero (SERVEL + ChileCompra por RUT, prereq RUT-01) → deuda técnica/hardening. Gates pre-aprobados por el operador; RUT-01 y revisión legal 21.719 siguen como prerrequisitos reales.
- [x] **v6.1 — entendible y completo** (shipped 2026-07-11): /red ego-network radial legible + búsqueda sobre corpus completo declarado (3.657 proyectos, techo honesto).
- [x] **v6.0 — confiabilidad y comprensión** (shipped 2026-07-09): crons/ingesta E2E perfecta (R2 dos-etapas, hash-check, monitoreo de frescura) · autoría de proyectos (desbloquea F48) · ícono/identidad visual gov-map · visualización comprensible con loop BrowserOS.
- [ ] **Pendiente de operador (fuera de v6):** RUT-01 backfill + ChileCompra/SERVEL (Phase 40) · sign-offs F13/MONEY + cierre F17/NET (Phase 39) · rotar DB password (B26).
- [x] **v5.0 — de datos a comprensión** (shipped 2026-07-08): legibilidad + gráficos descriptivos + rediseño cognitivo; F48 diferida por datos.
- [x] **v4.0 — de datos a cruces verificables** (shipped): cruces encendidos, lockdown API vía Camino A.

<!-- v3.0 "cobertura de datos": frente automatable cerrado y desplegado (Phases 23–32). Gates humanos 29/30/31 subsumidos en v4. -->
- [x] **v3.0 — cobertura de datos** (frente automatable completo, gates humanos → v4.0): lobby con identidad adjudicada + fuente camara.cl/transparencia, patrimonio LIVE, votaciones masivas, provenance de la maestra; migraciones remotas aplicadas hasta 0033.

<!-- v2.0 "parlamentarios 360": CÓDIGO completo (conectores, modelos, RPCs, secciones de ficha, gates MONEY/NET). El frontend/shell quedó cerrado y en vivo. Lo que falta NO es código sino DATOS poblados en la nube + adjudicación de identidad → eso es v3.0. Detalle del shell: .planning/HANDOFF-2026-06-22.md -->
- [x] **v2.0 — frente "parlamentarios 360"** (código completo, data pendiente → v3.0): voto individual, lobby + patrimonio (InfoProbidad), dimensión dinero (SERVEL/ChileCompra, gated-OFF), grafo de influencia (gated-OFF).

### Out of Scope

<!-- Diferido a milestones siguientes, no descartado. -->
- **P3 — Cómo vota el Congreso** (cruce voto × parlamentario × tema, visualizaciones) — milestone 2; bloqueado por validar `opendata.camara.cl` (voto individual por diputado)
- **P4 — Consultas + alertas integradas** (lobby + patrimonio) — milestone posterior; requiere definir política de datos del LLM
- **P5 — Dimensión dinero** (SERVEL + ChileCompra por RUT) — milestone posterior; SERVEL es conector artesanal frágil, no API REST
- **P6 — Observatorio de redes** (grafo de influencia) — se habilita cuando el modelo esté poblado
- **Conclusiones de causalidad/intención** — el sistema nunca afirma motivo; solo correlaciones con contexto temporal y fuente (regla rectora)
- **Exposición pública de RUT y datos de familiares** — uso interno para reconciliar identidad; minimización por diseño

## Context

- **Endpoints validados en vivo al 17/06/2026.** Existe un Documento Maestro de Implementación v2.0 con fuentes, endpoints, modelo de datos, estrategia de cómputo y marco legal. Sirve como espec de referencia.
- **Cámara:** WS JSON `doGet.asmx` (preferente, devuelve `{"result":true,"data":[...]}`); HTML para citaciones y búsqueda de proyectos. ⚠️ voto individual por diputado NO está en `doGet.asmx` (`Votos`=null) → vive en `opendata.camara.cl` (sin validar, bloquea P3).
- **Senado:** `tramitacion.senado.cl/wspublico/` (`tramitacion.php?boletin`, `votaciones.php?boletin`, `senadores_vigentes.php` con PARLID); citaciones vía portal Next.js (`buildId` cambia por deploy, autodetectar). `citaciones.php` da 404.
- **BCN/LeyChile:** `bcn.cl/leychile/Consulta/obtxml?opt=7&idNorma={ID}` (XML de la norma). `obtenerinfoley` obsoleto (404).
- **Tres llaves de cruce:** número de **boletín** (proyectos/votaciones/tramitación), **nombre normalizado** del parlamentario (puente más usado), **RUT** (el más fuerte, uso interno).
- **Riesgo existencial #1:** reconciliación de identidad falla en silencio → afirmación falsa y creíble. Por eso la identidad es subsistema crítico con golden set y revisión humana.
- **Riesgo existencial #2:** "máquina de sospechas" — cruces que insinúan causalidad. Mitigado con trazabilidad sobre interpretación.
- **WAF gubernamental** bloquea ráfagas → delay 2–3s obligatorio, no opcional. CORS: todas las llamadas externas desde backend, nunca del navegador.
- Marco legal: Ley 21.719 (plena vigencia 01/12/2026); "fuente de acceso público" no exime cumplimiento; dato derivado del cruce queda protegido; LLM vía API = subencargado (tier sin entrenamiento / DPA). InfoProbidad bajo CC BY 4.0 (atribución visible).
- **Estado v1.0 (shipped 2026-06-18):** monorepo pnpm (Next.js 16 + 7 paquetes `@obs/*` + Supabase, ~70 tareas, suite verde). 7 fases completas (frente "proyectos" + fundaciones de identidad). Cutover a **Supabase nube** ejecutado: migraciones 0001..0011 aplicadas y verificadas en el proyecto nube (ref `bctyygbmqcvizyplktuw`, región sa-east-1; pooler IPv4 — el host directo es IPv6-only). `SUPABASE_DB_URL` en `.env`.
- **Follow-ups operativos post-v1.0 (deuda registrada en `.planning/v1.0-MILESTONE-AUDIT.md`):** (1) 🔴 rotar el DB password de Supabase (expuesto en el transcript del cutover); (2) cargar corpus a la nube (conectores P5/P6 + backfill de fichas con `GEMINI_API_KEY`) — hasta entonces la búsqueda muestra estados vacíos honestos; (3) wiring app→nube (`SUPABASE_URL` + anon/publishable key de nube); (4) persistir `link_mensaje_mocion` para activar idea matriz; (5) desplegar Edge Functions + vault secrets para la orquestación automática; (6) verificaciones humanas/visuales diferidas con datos reales.

## Constraints

- **Tech stack**: TypeScript/Deno full (Edge Functions + conectores) — un solo lenguaje, integración nativa Supabase; reescribir el scraping de referencia (Python) a TS
- **Frontend**: Next.js (React, SSR) — ecosistema maduro para fichas, visualizaciones y, a futuro, grafos
- **Infra datos**: Supabase (Postgres + pgvector + auth/RLS); plan Pro ($25/mes, 8 GB) es la línea base de producción, no el free; tabla maestra de identidades respaldada fuera de Supabase sí o sí
- **Object storage**: Cloudflare R2 para el crudo (el free de Supabase da 500 MB de DB)
- **Cómputo LLM**: Gemini solo embeddings (free); MiniMax M3 (45k calls/sem gratis) para lo crítico/sensible (adjudicación de identidad); DeepSeek V4 Flash para volumen (extracción de fichas, prompt-cache). Capa enchufable; modelo final elegido por benchmark sobre golden set
- **Secrets**: todas las API keys en `.env`
- **Ingesta respetuosa**: rate-limit 2–3s, User-Agent identificatorio, respeto robots.txt, caché diaria
- **Legal**: pasada de asesoría legal antes del lanzamiento público; atribución CC BY 4.0 visible

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Producto de dos frentes con igual peso (proyectos + parlamentarios) | El usuario lo enfatizó: no es solo parlamentario-céntrico | ✓ v1.0 (validado al shippear) |
| Milestone 1 = Fundaciones + P2 Tramitación + P1 Búsqueda semántica | Entrega el frente "proyectos" completo y siembra identidad para el frente parlamentario; respeta regla "no paralelizar todo" | ✓ v1.0 (validado al shippear) |
| TypeScript/Deno full para backend/ingesta | Un solo lenguaje, integración nativa con Supabase Edge Functions | ✓ v1.0 (validado al shippear) |
| Next.js para frontend | Maduro para fichas + visualizaciones + grafos a futuro | ✓ v1.0 (validado al shippear) |
| Supabase + R2 + capa LLM enchufable (Gemini/MiniMax/DeepSeek) | Free tiers cubren el arranque; crudo fuera de Postgres; modelo swappable por config | ✓ v1.0 (validado al shippear) |
| Trazabilidad sobre interpretación como regla rectora | Evitar "máquina de sospechas"; defensa jurídica del producto | ✓ v1.0 (validado al shippear) |
| Reconciliación de identidad como subsistema crítico (golden set + revisión humana) | Un match equivocado produce afirmación falsa creíble; riesgo existencial #1 | ✓ v1.0 (validado al shippear) |
| v3.0 = milestone de DATOS, no de UI (el shell está cerrado) | Barrido de producción 2026-06-22: las fichas se ven como producto pero las secciones están vacías por falta de datos, no de pantallas | ✓ v3.0 (frente automatable cerrado) |
| Gates de operador (apply remoto 0026/0028/0030) y legales (F13/F17) son precondición explícita en el roadmap v3.0 | La data solo es visible tras aplicar las migraciones; tratarlos como deuda separada deja el milestone "código verde / pantalla vacía" | ✓ migraciones hasta 0033 aplicadas; gates legales → v4.0 |
| v4.0 = de datos por carril a CRUCES verificables (lobby × dinero × votos por sector) | El diferenciador del producto es conectar los carriles; pero es el dato de mayor impacto reputacional → se construye deny-by-default, se publica solo tras firma humana | En curso (v4.0) |
| Identidad de terceros (`entidad_tercero`) como prerrequisito de los cruces | `lobby_contraparte.contraparte_id`/`contratista` quedan NULL sin maestra de terceros → los cruces contarían entidades duplicadas/incorrectas; jurídicas solo por RUT exacto (sin LLM) | En curso (v4.0 Fase 1.2) |
| Señales de cruce = conteos factuales, nunca scores de correlación; señales de voto OFF hasta sign-off | Anti-insinuación (riesgo existencial #2); 17-LEGAL-DOSSIER §2 excluye co_votacion del MVP | En curso (v4.0 Fase 2.1) |
| /red = ego-network por seed con layout radial determinista (nunca grafo completo, nunca force-simulation) | La franja de ~136 nodos era ilegible; la posición jamás debe insinuar afinidad (F18 LOCKED) — orden alfabético como orden neutro | ✓ v6.1 (veredicto BrowserOS "comprensible") |
| Alcance histórico de búsqueda = legislatura vigente completa (2022-2026), no "todo el archivo" | Valor de búsqueda decae con antigüedad; ~20h ingesta + ~12h pipeline es el costo real; alcance declarado honesto en la UI | ✓ v6.1 (3.657 proyectos, cobertura declarada) |
| Techo honesto en vez de fabricar: 565 fichas en `estado='error'` con causa (478 RUT-guard, 87 schema-fail) | El guard RUT es LOCKED (nunca PII a LLM) y el gate zod no acepta salidas malformadas; mejor cobertura declarada 84,6% que 100% inventado | ✓ v6.1 |
| Seed de fichas como paso propio (`seedFichasPendientes` ON CONFLICT DO NOTHING) | Root cause BUSQ-01: `runIngest` escribe `proyecto` pero el pipeline solo ve `proyecto_ficha` — sin seed, 82→1.643 proyectos invisibles; paginar lecturas PostgREST (cap 1k) fue imprescindible a escala | ✓ v6.1 |
| Partido político + bio oficial del cargo electo se muestran DIRECTO y se correlacionan en todas las superficies (revierte la retención de `partido` en 0020) | Decisión del operador 2026-07-21: la militancia y la biografía oficial de un político electo son datos públicos esenciales para accountability ("¡son políticos!"); siempre con fuente+fecha, partido≠comité, militancia histórica vs actual. La minimización 21.719 sigue PLENA para terceros/familiares/RUT | ✓ v9.0 (validado al shippear) |
| Búsqueda híbrida = RRF sobre RANK 100% Postgres (jamás suma ponderada de scores; websearch_to_tsquery siempre) + short-circuit boletín fuera de la fusión | Escalas incomparables entre ts_rank y cosine; el boletín exacto debe ser determinista #1; golden set congelado ANTES del schema (86 gatea 87) | ✓ v9.0 (gate DOMINA, flag ON) |
| Cada RPC pública nueva enhebra la misma aguja: migración >0044 cero-grant + security-definer PII-safe + PUBLIC_RPC_ALLOWLIST + bounded (LIMIT + statement_timeout + cap match_count) | Bajo Camino A service_role bypassa RLS → cada RPC ES el boundary; DoS barato en repo público con sujetos hostiles (Pitfall 12) | ✓ v9.0 (0064 + guards que muerden) |
| CSP enforced pragmático (script-src 'self' 'unsafe-inline') > Report-Only perfecto | Report-Only-forever = cero protección; nonce exige dynamic rendering no disponible en OpenNext estático; validación empírica BrowserOS en deploy real | ✓ v9.0 (ambas superficies, deploy 09f1d5c2) |
| Audiencia lobby→PL SOLO por mención explícita de boletín (regex context-gated, jamás keywords/tema) | Riesgo #1: un enlace temático inventado fabrica una relación; fail-closed doble TS↔SQL con fixture compartido | ✓ v9.0 (cobertura declarada ~3.8%, honesta) |
| Un clamp de seguridad **no** es un fix de exactitud: se rechazó el techo 200 que el audit prescribía y se adjudicó 4000 | 200 habría **empeorado** `B-01`; ante un audit que contradice a la DB viva se **para y se adjudica**, no se obedece | ✓ v12.0 (documentado en `124-HANDOFF-EXACTITUD.md` §1) |
| Un requisito que no se cumplió como está escrito se cierra **por declaración honesta con puntero y dueño**, jamás marcándolo verde | `CRUCE-01` ("discrepancias corregidas": 2 de 10) y `SUPA-01` ("0 offenders": 4 vivos). Ocultarlo violaría el principio rector del proyecto | ⚠️ v12.0 (archivado CON la deuda por decisión del operador) |
| La tabla de trazabilidad de `REQUIREMENTS.md` **no es evidencia** de cierre | Se firma al **definir** el milestone, no al cumplirlo (las 13 filas decían `Complete` antes de ejecutar una fase). La evidencia son los `*-VERIFICATION.md` y el audit | ✓ v12.0 (defecto de proceso registrado) |
| Cero aprobados por silencio: un ítem de juicio humano sólo se aprueba con respuesta **verbatim** del operador | La ausencia produce handoff, jamás PASS; y el alcance de lo aprobado se escribe para que nadie lo sobre-lea | ✓ v12.0 (`aprobados_por_silencio: 0`) |
| Una migración escrita y no aplicada **jamás se edita**: si algún día se puede aplicar, va como `0080` nueva | `0073`/`0075` quedaron bloqueadas por ownership demostrado; editarlas produciría deriva ante un `db push` o un ledger reconciliado a ciegas | ✓ v12.0 (anotado en el archivo del milestone) |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-07-29 — **v12.0 SHIPPED y ARCHIVADO CON LA DEUDA** (decisión del operador). Audit `tech_debt` en `milestones/v12.0-MILESTONE-AUDIT.md`; deuda viva: 9 ítems de operador (`OP-1`/`OP-4`/`OFF-6-03`/`OFF-01` en rojo) + 7 técnicos (`B-01` el número falso, `B-02`, `B-03`, `H-01`, `H-06`, `3.3`, `4-15`); `0073`/`0075` escritas-no-aplicadas (jamás editarlas). `REQUIREMENTS.md` archivado y borrado — el próximo milestone crea uno fresco.*

<!-- histórico: 2026-07-27 — milestone v12.0 iniciado (validación general producto-a-producto: links+fechas, crons+escalera clasificación flip autorizado, cruces+Supabase). Deuda operador viva: CF secrets + rotación B26 (110), RUT-01 + backfills LIVE (111), flip MONEY (112), provisión NOTIF (103-HUMAN-UAT).* -->
