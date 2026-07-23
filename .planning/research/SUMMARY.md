# Project Research Summary

**Project:** Observatorio del Congreso 360
**Domain:** Panel de actualidad legislativa cuantitativo (landing) + notificaciones por suscripción + capa de relaciones entre parlamentarios (v10.0)
**Researched:** 2026-07-23
**Confidence:** HIGH (señales, panel, relaciones — anclados a código/DB viva); MEDIUM/HIGH (notificaciones — depende de decisiones de seguridad/legal del operador y de un spike de deploy)

> Cinco frentes de research (STACK, FEATURES, ARCHITECTURE, PITFALLS, RELACIONES) convergen en una tesis única: **v10.0 es casi todo re-uso de lo que ya existe, gobernado por gates de honestidad**. La infra net-new es mínima (un proveedor de email + el primer subsistema de dato de usuario). El trabajo REAL es de disciplina: qué señal es honesta, qué ausencia no es un hecho, qué copy no insinúa, y qué dato de usuario merece auth+RLS+consentimiento reales.

## Executive Summary

v10.0 convierte la landing de folleto de producto a **panel de actualidad cuantitativo** ("qué pasó HOY en el Congreso"), añade **notificaciones por suscripción** (el primer dato de usuario del sistema) y hace **exhaustiva la capa de relaciones entre parlamentarios**. La regla de oro que atraviesa los cinco frentes: **casi todo lo necesario ya está en el sobre actual** (Postgres + pgvector 0.8 + pg_cron + GH Actions + R2 + los embeddings 768d de v6.1 + los 548K votos individuales ya en DB). Las únicas piezas verdaderamente net-new son (1) un envío de email transaccional (Resend) y (2) el primer subsistema de datos-de-usuario (Supabase Auth + tablas con RLS real + publishable key). No se añade cola, broker ni cache — el patrón es SQL precomputado + cron.

El cómo lo construyen los expertos (GovTrack, LegiScan, TheyWorkForYou, Congress.gov) es claro y verificado: **velocity + agenda + trending + nuevos ingresos**, suscripción a bill/legislator/keyword/committee, y **digest diario batcheado** (no instantáneo). Pero el research también expone el anti-modelo: openparliament pone "total fabrications" disclaimer en sus resúmenes LLM, y GovTrack **retractó** en 2024 sus report cards de afinidad por no confiables. Para este proyecto —cuyo riesgo existencial #2 es ser una "máquina de sospechas"— esos precedentes son barandas: labels de cluster factuales (moda de `materia`/comisión, JAMÁS LLM), similitud de voto como "coinciden en N de M" sin score ni ranking ni eje ideológico, y timing mostrado como fecha neutra, nunca como anomalía.

El riesgo dominante NO es técnico sino de **honestidad del dato**: la ausencia de filas ("sin movimiento") puede significar "no pasó nada" o "no se scrapeó" — indistinguibles sin metadato de frescura, y la página más visitada del sitio es exactamente donde esa mentira sería creíble. La mitigación es un principio rector: **toda señal se suprime si su fuente está stale** (ausencia ≠ hecho), el panel afirma solo lo positivo observado con cobertura declarada, y el gate de datos (SPIKE de `tramitacion_evento`) precede a todo frontend. El segundo eje de riesgo es de seguridad/legal: el primer login introduce el rol `authenticated` que el lockdown-guard nunca contempló, y el primer email de usuario es la primera PII propia bajo Ley 21.719 (vigencia plena 2026-12-01, dentro del horizonte del milestone). Ambos exigen extender guards y un gate legal humano ANTES de exponer nada.

## Key Findings

### Recommended Stack

Detalle en `STACK.md`. La tesis: **adiciones mínimas al sobre existente, cero infra de cola/broker/cache**. Todo lo demás son patrones SQL sobre datos ya ingeridos.

**Core technologies (nuevas / cambios):**
- **Tabla `actualidad_senal` precomputada + refrescada por materializador full-rebuild** (espeja `cruce_senal`/0039) — el panel lee filas ya computadas; el cómputo caro (velocity, clustering) corre offline. Preferida sobre materialized view (evita el lock de `REFRESH` no-concurrente en la superficie más visitada).
- **k-means SQL puro con seed fija** sobre los embeddings 768d ya existentes, k pequeño (8–15) — clustering determinista y reproducible; **label = moda de `materia`/comisión (SQL `mode()`), JAMÁS LLM**.
- **Supabase Auth (Email OTP / Magic Link) + publishable key nueva + RLS estricta** SOLO en `suscripcion`/`usuario_perfil` — primer acceso de baja-privilegio del navegador, sin resucitar la anon muerta; el resto del esquema intacto.
- **Resend** (email transaccional, free 3.000/mes, 100/día) — cubre AMBOS caminos con una sola verificación de dominio: los correos de auth de Supabase (Custom SMTP) y el digest de suscripción (API HTTP). El SMTP interno de Supabase (2 auth-emails/hora) NO es apto para producción.

**Qué NO usar (LOCKED):** reactivar la anon legacy · service_role para escribir suscripciones desde el navegador · LLM para etiquetar clusters por defecto · web push como canal primario (diferir) · BullMQ/Redis · enviar el email del usuario al LLM o loguearlo en repo público.

### Expected Features

Detalle en `FEATURES.md`. Contexto rector LOCKED: cada señal 100% derivable de dato objetivo con fuente+fecha+enlace; JAMÁS insinuar intención/causalidad. El hueco que llena v10.0: los portales oficiales chilenos son **editoriales**, no cuantitativos.

**Must have (table stakes del panel):**
- **Movimiento reciente / velocity** (más trámites en ventana) — señal ancla; computable HOY si `tramitacion_evento` tiene frescura.
- **Agenda próxima** (qué se vota/cita) — ya ingerida, bajo costo, alto valor "coming up".
- **Urgencias vivas del Ejecutivo** — factual, token 3-estados ya existe.
- **Agrupación por materia oficial** — `proyecto.materia` = label factual reusable directo.
- **Nuevos ingresos** — CONDICIONAL: requiere resolver la fecha de ingreso en el SPIKE (`proyecto` NO tiene `fecha_ingreso`; `fecha_captura` = fecha de scrape ≠ ingreso → mentiroso).
- **Trazabilidad por señal** (fuente+fecha+enlace) — no negociable.
- **Suscripción a proyecto/parlamentario + digest diario batcheado + doble opt-in.**

**Should have (diferenciadores, alineados al Core Value):**
- **Panel unificado bicameral** — ningún portal oficial chileno cruza ambas cámaras.
- **Comparación 1-a-1 de parlamentarios** (`/comparar?a=&b=`) — la superficie de MAYOR valor de relaciones; responde "¿se parecen?" con ejes factuales sin construir grafo insinuante.
- **"Proyectos revividos"** (gap largo → trámite nuevo) — alto valor prensa, presentar como fecha neutra.
- **Comisiones más activas de la semana**, **RSS/Atom feeds**, **suscripción por keyword/materia/comisión**.

**Defer (v10.x / v11+):**
- Leyes recién publicadas (requiere conector nuevo BCN portada_ulp / Cámara leyes_promulgadas).
- Coalición/pacto (Servel) — requiere ingesta nueva artesanal.
- Preference center avanzado, clustering por embeddings como vista secundaria, Congress.gov-style "elegir qué campo rastrear", web push.

**Anti-features (LOCKED — editorializan):** timing "anómalo" como señal destacada · resúmenes/word-of-day LLM · rankings de "urgencia"/juicio · notificaciones instantáneas real-time · sentiment/"polémico" · trending por clicks · score de afinidad / eje ideológico (DW-NOMINATE, GovTrack retractado).

### Architecture Approach

Detalle en `ARCHITECTURE.md`. Las tres capacidades nuevas se enchufan al monorepo sin romper invariantes LOCKED (Camino A service_role, dos etapas fuente→R2→Supabase, RPC bounded allowlisted, candados bento + anti-insinuación).

**Major components:**
1. **`actualidad_senal` (tabla) + `actualidad.materializar_senales()` (proc full-rebuild)** — espeja `cruce_senal`/0039. El cómputo caro (velocity, clustering, recencia) offline; la landing lee vía RPC bounded trivial (`select … order … limit`, cabe en el `statement_timeout 5s`).
2. **`app/page.tsx` (panel) reusando BentoGrid/BentoTile** — los 3 tiles de `actualidad-module.tsx` (votado/urgencias/frescura) son el germen; se amplían, no se botan. El hero producto-céntrico se degrada.
3. **`suscripcion` + `notificacion_envio` (tablas user-owned) + Supabase Auth + `middleware.ts` + `supabase-user.ts`** — PRIMER dato de usuario, PRIMER middleware, PRIMER uso de RLS con policies (`to authenticated USING (auth.uid()=user_id)`).
4. **`@obs/notificaciones` (cron de EGRESO en GH Actions)** — patrón NUEVO legítimo (NO dos etapas): lee Supabase → computa novedades por cursor `ultima_notificacion` → envía Resend → idempotente vía `notificacion_envio`.

**Build order sugerido por Architecture:** (0) spike auth-on-Workers → (1) señales+panel intercalados → (2) notificaciones, con checkpoint humano legal antes de exponer captura de emails.

### Critical Pitfalls

Top 6 de `PITFALLS.md` (ranking likelihood × impacto para ESTE sistema):

1. **"Sin movimiento" ≠ "no se scrapeó"** — la señal factual miente por cobertura parcial. Mitigación: toda señal se computa SOLO sobre fuentes con frescura conocida; si stale → se SUPRIME ("sin datos frescos de esta fuente"), NUNCA se emite como "sin movimiento". Banner de cobertura declarada. **Ausencia ≠ hecho** (riesgo existencial #1, ahora en la página más visitada).
2. **Sesgo de cámara amplificado** — "más movimiento" domina por mejor cobertura de una cámara (Cámara HTML/WAF frágil vs Senado XML limpio), no por actividad real. Mitigación: señales por proyecto/tema homogéneas o asimetría declarada; criterio = hecho discreto verificable, no conteo acumulado que premia al mejor-scrapeado.
3. **Insinuación disfrazada de señal** — vocabulario NUEVO que el linter (denylist EXACTA) aún no veta: "último momento", "revivido", "exprés", "madrugada". Mitigación: **extender `TERMINOS_PROHIBIDOS` + array `SUPERFICIES_PANEL` como PRIMER commit de la fase frontend**; labels de cluster factuales; el linter es tripwire, no garantía → sign-off legal humano del copy.
4. **El primer login re-abre la superficie REST que el lockdown mató** — `authenticated` es un tercer rol que `lockdown-guard` (veta solo anon/public) nunca contempló. Mitigación: **extender el guard a `authenticated` como PRIMER commit** (grants solo a tablas-de-usuario con RLS `auth.uid()=user_id`, cero PII); pgTAP usuario-A-no-ve-B.
5. **Emails de usuario = PII REAL bajo 21.719** — primera PII propia recolectada. Mitigación: doble opt-in obligatorio + registro de consentimiento (fecha/versión/método) + DPA del proveedor + minimización + supresión efectiva en baja. **Gate legal humano** análogo a MONEY/NET.
6. **Romper los candados de régimen v8/v9 en el rewrite de la landing** — copy hero LOCKED byte-idéntico, cero-hex, whitelist tipográfica, `-[--var]` bare inválido Tailwind v4 (reaparecido 3×, invisible en local), `force-dynamic` (sin él la home se hornea estática → 500). Mitigación: guards como contrato; gate BrowserOS en DEPLOY real (getComputedStyle); copy hero solo con autorización operador.

Moderados relevantes: crons más frecuentes → ráfagas WAF (hash-check antes de descargar; la frecuencia refresca la AGREGACIÓN interna, no re-scrapea la fuente); GH Actions cron drift/skip (mostrar `UltimaActualizacion` siempre); enumeración de suscriptores + unsubscribe token sin auth (respuesta idéntica exista o no; token opaco firmado un-solo-uso).

## Implications for Roadmap

Basado en los cinco frentes, estructura de fases sugerida. **Método LOCKED del operador: primero QUÉ (evidencia), después CÓMO (frontend); todo empírico con BrowserOS.** Dos frentes corren casi independientes: el **panel+señales** (puro dato ya ingerido, sin riesgo estructural) y las **notificaciones** (auth/RLS/legal, el cambio estructural). Las **relaciones** son mayormente re-superficie de dato ya existente. Numeración de fases continúa desde v9.0 (última fase 96) → v10.0 arranca en **97**.

### Fase 0 (spike): Auth-on-Workers de-risk
**Rationale:** El mayor riesgo desconocido es OpenNext+middleware+cookies. El sitio HOY no tiene `middleware.ts`; auth introduce el primer middleware → riesgo de deploy (build OpenNext delicado, symlinks Windows). CAVEAT verificado: OpenNext soporta middleware clásico Edge-style pero NO el Node Middleware 15.2+. Sin dependencia con el panel de datos → paralelizable.
**Delivers:** `middleware.ts` mínimo + `@supabase/ssr` desplegado, verificando `Set-Cookie` + refresh de sesión sobrevive el pipeline OpenNext.
**Avoids:** descubrir en la fase de notificaciones que el deploy no sostiene la sesión.

### Fase 1: SPIKE de datos — QUÉ señales son honestas (gate del operador)
**Rationale:** El operador pidió "QUÉ antes que CÓMO". Auditoría empírica de `tramitacion_evento` (frescura, cobertura, ¿primer-evento fiable por boletín?) decide qué señales son honestas. **Gatea TODO el panel.** Incluye VERIFICAR (para relaciones) que `voto.estado_vinculo='confirmado'` cubre las 548K filas / 186 parlamentarios (la DB viva desmiente el "backfill pendiente" del contexto — evidencia concluyente pero verificar).
**Delivers:** clasificación de cada señal candidata ("¿requiere frescura declarada? ¿cross-cámara sesgada? ¿el label afirma intención?"); decisión de ingesta (`fecha_ingreso` explícito vs primer `tramitacion_evento`; cron más frecuente); confirmación de que la similitud de voto es computable HOY.
**Addresses:** movimiento/velocity, nuevos ingresos (condicional), higiene de `partido_alias`.
**Avoids:** Pitfalls 1 (ausencia≠hecho), 2 (sesgo de cámara), 8 (cron drift).

### Fase 2: Materializador de señales + RPCs bounded
**Rationale:** El cómputo caro (velocity, clustering k-means, recencia) debe correr offline; la landing lee filas precomputadas. Espeja `cruce_senal`/0039.
**Delivers:** `0065_actualidad_senal.sql` (tabla + proc materializador) + `0066_actualidad_rpc.sql` (RPCs bounded PII-safe) + YAML `actualidad-refresh.yml` intradía L-V.
**Uses:** tabla precomputada + k-means SQL seed-fija + embeddings 768d + pg_cron/GH Actions.
**Implements:** componente `actualidad_senal` + materializador.
**Conflicto resuelto:** Stack sugiere pg_cron; Architecture sugiere CLI en GH Actions. **Regla: cómputo 100% SQL puro (agregados, k-means expresable en SQL) → pg_cron interno (como 0039). Lógica TS de clustering o cualquier cosa que no quepa en SQL → CLI en GH Actions (`actualidad-refresh.yml`).** NADA aquí toca fuentes → NO aplica rate-limit 2-3s. Si una señal futura SÍ requiere fuente nueva (leyes publicadas BCN) → pipeline de dos etapas aparte.

### Fase 3: Panel (frontend) — intercalado con validación por señal
**Rationale:** El operador pide señales antes que panel, pero intercalar (cada señal validada → un tile) permite validar con BrowserOS sin esperar todas. Reemplaza el bento producto-céntrico conservando primitivas.
**Delivers:** `app/page.tsx` panel + tiles reusando BentoGrid; benchmark UX vs senado.cl/camara.cl (aprender qué EVITAR, no copiar tablas ASP.NET densas).
**Avoids:** Pitfalls 3 (extender linter + `SUPERFICIES_PANEL` como PRIMER commit), 6 (candados bento/copy/force-dynamic), 9 (agregación cara on-read), 13 (anti-patterns gubernamentales), 14 (SEO/anchors — no cambiar URL home).
**Gate:** BrowserOS lectura fría en DEPLOY real.

### Fase 4: Relaciones entre parlamentarios (mayormente re-superficie)
**Rationale:** "No se muestra nada" es FALSO en código, VERDADERO en experiencia — 4 cross-links ya viven en la ficha pero enterrados al fondo; la ausencia REAL es "votan parecido". El voto individual ya está en DB (548K, 186/186) → similitud es computable HOY con SQL puro, sin depender del backfill v7.0.
**Delivers:** reubicar/agrupar los 4 cross-links above-the-fold (bloque "Relaciones con otros parlamentarios") + RPC "militancia histórica compartida" + filtro por partido en directorio + **comparación 1-a-1 `/comparar`** (ejes NO-voto: partido, comisiones, co-autoría, zona) + higiene `partido_alias`.
**Avoids:** DW-NOMINATE / eje ideológico / score de afinidad (anti-modelo); orden SIEMPRE alfabético (nunca por conteo/coincidencia).

### Fase 5: Similitud de votación (dato listo, gate legal)
**Rationale:** El operador la re-pide explícitamente; el 17-LEGAL-DOSSIER §2 la difirió. Dato listo, riesgo medio-alto (clase NET/MONEY).
**Delivers:** eje "coinciden en N de M votaciones" en `/comparar`, detrás de flag deny-by-default, con **caveat de base-alta obligatorio** ("muchas votaciones son de trámite y casi unánimes; la coincidencia alta es la norma, no una señal" — el ejemplo real dio 99,5%), denominador honesto (solo donde ambos votaron sustantivo). Extender linter con idioms de similitud de voto + registrar la leyenda en `NEGACIONES_LOCKED`.
**Avoids:** score/ranking/eje/mapa; llamarlo "aliados"/"vota como".
**Gate:** dossier + sign-off legal humano NUEVO (jamás un agente). `co_votacion` NUNCA va a /red (explosión de clique).

### Fase 6: Notificaciones por suscripción (el cambio estructural)
**Rationale:** Primer dato de usuario, primer auth, primer RLS con policies, primer egreso. El ÚNICO con checkpoint legal humano → aislarlo al final evita que su riesgo bloquee el panel.
**Delivers:** `0067_auth_suscripcion.sql` (RLS `to authenticated`) → auth UI (login/verify) → `@obs/notificaciones` egreso cron (Resend) → doble opt-in + unsubscribe token opaco.
**Avoids:** Pitfalls 4 (**extender lockdown-guard a `authenticated` como PRIMER commit**), 5 (PII 21.719), 11 (enumeración/token), 12 (SPF/DKIM/DMARC).
**Gate:** CHECKPOINT HUMANO LEGAL (Ley 21.719, vigencia 2026-12-01) antes de exponer captura de emails al público. DPA del proveedor como gate de operador.

### Fase 7: Verificación E2E (pedido del operador)
**Rationale:** "Asegúrate que TODO funciona" — inventario de cada superficie × dato real × BrowserOS antes de cerrar.
**Delivers:** verificación de las 4 relaciones con datos reales (conteo honesto, truncamiento >20), comparación 1-a-1 con caveat visible, similitud de voto contra recálculo SQL (D1170/D1165 = 3.650/3.667), flag OFF = ausente del DOM, linter verde con nuevos términos + nuevas superficies, empty states honestos, cero URI-como-partido.

### Phase Ordering Rationale

- **Datos antes que frontend** (gate del operador): el SPIKE decide qué señales son honestas; sin él el panel sería mentiroso (Pitfall 1).
- **Panel/relaciones (dato) vs notificaciones (usuario) son frentes separables**: el primero es puro dato ya ingerido, cero riesgo estructural; el segundo es auth/RLS/legal. Aislar notificaciones al final evita que su gate legal bloquee el panel.
- **Spike de auth en paralelo desde el día 0**: el mayor riesgo desconocido, de-riskeado temprano sin bloquear nada.
- **Similitud de voto separada de las relaciones no-voto**: mismo dato listo, pero diferente gate (legal vs ninguno) → no mezclar el flujo gated con el no-gated.
- **Cada fase de frontend cierra con BrowserOS en deploy real**: la cascada CSS Tailwind v4, el force-dynamic y los anchors solo se cazan en deploy (precedente v6.1/v8.0/F81).

### Research Flags

Fases que probablemente necesiten `/gsd:plan-phase --research-phase` durante planificación:
- **Fase 0 (spike auth):** OpenNext+middleware+cookies sobre Workers — confianza MEDIUM (docs lo dicen, NO probado en este repo). Es el bloqueante estructural.
- **Fase 6 (notificaciones):** Resend + Custom SMTP + verificación DKIM + encaje con `.env`/secrets — confianza MEDIUM; y el diseño de consentimiento 21.719 merece research legal específico.
- **Fase 5 (similitud de voto):** métrica defendible + framing anti-insinuación — el diseño del caveat y del gate legal es delicado (precedente GovTrack retractado).

Fases con patrones estándar (skip research-phase):
- **Fase 2 (materializador):** precedente directo en el repo (`cruce_senal`/0039, `materializar_cruces()`) — patrón conocido.
- **Fase 3 (panel):** re-usa BentoGrid + patrón `.from()` de `actualidad-module.tsx`; el riesgo es de disciplina (guards), no de patrón desconocido.
- **Fase 4 (relaciones no-voto):** RPCs cross-link ya existen (0060/0061); es re-superficie + un RPC nuevo (militancia histórica) sobre patrón conocido.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Resend/publishable-key/pg_cron/k-means verificados en docs oficiales; único MEDIUM = Custom SMTP encaje real y web push (diferido) |
| Features | HIGH | Comparables (GovTrack/LegiScan/TheyWorkForYou/Congress.gov) inspeccionados en fuente; señales mapeadas al schema real del repo |
| Architecture | HIGH | Anclada a código real leído (page.tsx, guards, migraciones 0039/0064, YAMLs); único MEDIUM = OpenNext middleware (no probado en repo) |
| Pitfalls | HIGH | Locks del sistema leídos en código; precedentes externos (GovTrack scrapers, cron drift, 21.719) verificados |
| Relaciones | HIGH | Audit contra código + DB viva (`psql` 2026-07-23, conteos y overlap reales); único MEDIUM = fuentes Servel/comités para coalición |

**Overall confidence:** HIGH

### Gaps to Address

- **`tramitacion_evento` frescura/cobertura:** SPIKE (Fase 1) resuelve si velocity/nuevos-ingresos/revividos son honestos. Si `proyecto.fecha_captura` es la única fecha, "nuevos ingresos" es mentiroso → decidir ingesta de `fecha_ingreso` o primer-evento fiable.
- **Auth-on-Workers no probado en este repo:** spike Fase 0 de-riskea `middleware.ts` clásico + cookies sobre OpenNext. Si falla → replantear auth (el panel de datos NO depende de esto).
- **Materializador: pg_cron vs GH Actions:** verificar si el clustering k-means es expresable en SQL puro (→ pg_cron) o necesita TS (→ GH Actions). Regla resuelta arriba; la validación es empírica en Fase 2.
- **Coalición/pacto:** requiere ingesta nueva (Servel pactos / comités parlamentarios, conector artesanal frágil, tabla JS-render). Candidato a DIFERIR — es el único hueco declarado honesto si no cabe. NO inventar coalición desde votos.
- **Voto confirmado cubre lo esperado:** la DB viva dice 548K/186-de-186, contradiciendo el "backfill pendiente" del contexto — VERIFICAR en Fase 1 que la reconciliación de identidad no fabrica votantes antes de exponer similitud.
- **Leyes recién publicadas:** no hay endpoint XML de recency directo; requiere scrapear portada_ulp BCN o tabla Cámara → conector nuevo, segunda ola (v10.x).
- **Cache de Cloudflare sobre la home dinámica:** verificar en deploy real que `force-dynamic` + no-store no sirve portada cacheada vieja (precedente en memoria de deploys).

## Sources

### Primary (HIGH confidence)
- Repo real leído: `app/app/page.tsx`, `app/components/actualidad-module.tsx`, `app/lib/{supabase,lockdown-guard,bento-guards,anti-insinuacion-guard}.test.ts`, `app/app/parlamentario/[id]/page.tsx`, `app/app/red/page.tsx`, `supabase/migrations/{0008,0010,0030,0039,0060,0061,0064}.sql`, `.github/workflows/*.yml`, `.planning/PROJECT.md`, `CLAUDE.md`
- DB viva (Supabase nube, `psql` 2026-07-23): conteos `voto`/`votacion`/`proyecto_autor`/`comision_membresia`/`arista`/`parlamentario_militancia`; overlap D1170/D1165
- [Supabase — API keys / publishable / Custom SMTP / server-side auth Next.js](https://supabase.com/docs) — publishable = privilegio bajo con RLS, SMTP interno no-prod, @supabase/ssr middleware
- [Resend — quotas](https://resend.com/docs/knowledge-base/account-quotas-and-limits) — free 3.000/mes, 100/día
- [GovTrack how-to-use / analysis / retractó report cards 2024](https://www.govtrack.us) — módulos panel + precedente score de afinidad frágil/retractado
- [Congress.gov alerts](https://www.congress.gov/help/alerts) / [TheyWorkForYou alerts](https://www.theyworkforyou.com/alert/) — granularidad + digest diario batcheado
- [Voteview / DW-NOMINATE](https://voteview.com/about) — anti-modelo (eje ideológico prohibido)

### Secondary (MEDIUM confidence)
- [@opennextjs/cloudflare docs](https://opennext.js.org/cloudflare) — middleware clásico soportado, Node Middleware 15.2+ no (no probado en repo)
- [LegiScan features/trends](https://legiscan.com/features) — National Trends 72h, Topic labels
- [openparliament alerts/home](https://openparliament.ca/alerts/) — word-of-day LLM con disclaimer de fabricaciones
- [kmeans PGXN](https://pgxn.org/dist/kmeans/) / pgvector production 2026 — k-means en PG, clusters semánticos de embeddings
- [Ley 21.719 email marketing — Fidelizador / Confidata / RSM Chile](https://blog.fidelizador.com) — doble opt-in, consentimiento, encargado requiere DPA
- [GitHub cron delays/suspend](https://github.com/orgs/community/discussions/156282) — drift/drop en high load, suspende tras 60 días
- [BCN portada_ulp](https://www.bcn.cl/leychile/Consulta/portada_ulp) / [Servel pactos 2025](https://cslatinoamericana.org) / [Comités Senado](https://www.senado.cl/senadores-y-senadoras/comites-parlamentarios) — fuentes de leyes publicadas y coalición (ingesta nueva)

### Tertiary (LOW confidence)
- [PushForge](https://github.com/draphy/pushforge) — web push VAPID Workers-compat (diferido, no evaluado a fondo)
- [Cloudflare Workers Cron limits](https://runhooks.app/blog/cloudflare-workers-cron-triggers-limits/) — 10ms CPU / 100k req/día (por eso digest va en GH Actions)

---
*Research completed: 2026-07-23*
*Ready for roadmap: yes*
