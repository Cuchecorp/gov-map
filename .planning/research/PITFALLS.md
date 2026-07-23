# Domain Pitfalls

**Domain:** Panel de actualidad legislativa cuantitativo (landing) + clustering por tema + notificaciones por suscripción, sobre Observatorio del Congreso 360
**Milestone:** v10.0
**Researched:** 2026-07-23
**Overall confidence:** HIGH (los locks del sistema están leídos en código; los patrones externos verificados)

> Ranking por likelihood × impacto PARA ESTE SISTEMA. Pitfalls específicos de AÑADIR estas features a este sistema — no OWASP genérico. Cada uno declara qué fase debería abordarlo y las señales de alerta.

---

## Critical Pitfalls

Mistakes that cause a false public claim, a legal breach under 21.719, a broken security regime, or a rewrite.

### Pitfall 1: "Sin movimiento" ≠ "no se scrapeó" — la señal factual miente por cobertura parcial

**What goes wrong:** El panel dice "Este proyecto no tuvo movimiento esta semana" cuando en realidad la fuente de ese proyecto NO se ingirió esta semana (cron saltado, WAF, boletín fuera del corpus 2022-2026, embedding faltante del 15,4%). El usuario objetivo (periodista/tramitador) toma "sin movimiento" como un HECHO del Congreso; es un hecho del scraper. GovTrack documenta exactamente esto: "screen scrapers can be easily confused… unanticipated cases (like bills without sponsors) cause incorrect information being shown."

**Why it happens:** El panel deriva señales de la ausencia de filas (`WHERE fecha >= inicio_semana` → 0 rows). Ausencia de filas tiene DOS causas indistinguibles sin metadato de frescura: (a) no pasó nada, (b) no se miró. El `actualidad-module.tsx` ya tiene el molde correcto para el caso positivo ("Sin votaciones registradas **en las fuentes consultadas**") pero una señal NUEVA de "actividad reciente por proyecto/tema" invierte el riesgo: ahora la AUSENCIA es la señal, y la ausencia es donde vive la mentira.

**Consequences:** Afirmación falsa y creíble — el riesgo existencial #1 del proyecto, ahora en la página más visitada. Un periodista publica "el proyecto X está congelado" cuando solo estaba el cron caído.

**Prevention:**
- Toda señal de "actualidad" se computa SOLO sobre fuentes con frescura conocida y RECIENTE. Cruzar cada señal contra `fecha_captura` de su tabla (ya existe `pnpm freshness` con umbral por fuente): si la fuente está STALE, la señal NO se emite — se degrada a "sin datos frescos de esta fuente", nunca a "sin movimiento".
- **Jamás emitir una señal NEGATIVA como afirmación** ("no se movió", "proyecto inactivo", "sin actividad"). El panel afirma solo lo POSITIVO observado ("se registró trámite X el día Y"). La ausencia se muestra como cobertura, no como hecho.
- Banner de cobertura declarada en el panel, igual que /buscar ("sobre 3.100 proyectos…") y /agenda (cobertura N/M por celda) — patrón LOCKED del proyecto. El panel hereda ese contrato: "muestra actividad de las N fuentes con datos al día DD/MM".
- Nunca leer `?? []` un error de query como "sin actividad" — el molde `throw` de `actualidad-module.tsx` (#34) es LOCKED y debe replicarse en toda señal nueva.

**Detection:** Test que inyecta una tabla STALE (fecha_captura vieja) y verifica que la señal se SUPRIME, no que muestra 0. Cold-read BrowserOS del panel un lunes tras un cron saltado del viernes.

**Phase:** Etapa DATOS (la primera — "QUÉ señales son computables con evidencia"). Es la decisión rectora: cada señal candidata se clasifica "requiere frescura declarada" antes de tocar frontend.

---

### Pitfall 2: Sesgo de cámara amplificado — "más movimiento" porque una cámara se scrapea mejor

**What goes wrong:** El ranking "proyectos con más movimiento" o el conteo de actividad por tema queda dominado por la Cámara o el Senado no porque haya más actividad real, sino porque una fuente tiene mejor cobertura. El brief lo nombra: "citaciones thin en Cámara". Un ranking que ordena por conteo de eventos ingeridos amplifica la asimetría del scraping y la presenta como asimetría del Congreso.

**Why it happens:** Los conectores de las dos cámaras tienen cobertura desigual por construcción (Cámara = HTML/WAF frágil vs Senado = XML limpio; voto individual de Cámara aún backfill pendiente; citaciones Cámara delgadas). Cualquier agregación cross-cámara sin normalizar por cobertura hereda ese sesgo. Un "top 10 de proyectos más activos" es un top 10 de "proyectos mejor scrapeados".

**Consequences:** Sesgo sistemático presentado como señal editorial ("el Senado está más activo"). Cruza la línea anti-insinuación por la puerta de atrás: es una comparación institucional que el dato no sostiene.

**Prevention:**
- NO construir rankings cross-cámara que sumen eventos de cobertura desigual sin declararlo. Preferir señales POR proyecto/POR tema dentro de una misma fuente homogénea, o declarar explícitamente la asimetría.
- Si hay "top de movimiento", que el criterio sea un HECHO discreto y verificable (p.ej. "tuvo votación en sala esta semana" — evento único, no conteo acumulado que premia al mejor-scrapeado).
- Evitar el vocabulario comparativo ya vetado por el linter ("los más…", "ranking" está PROHIBIDO en `TERMINOS_PROHIBIDOS`). El `actualidad-module.tsx` ya lo dice: "CERO ranking / score / 'los más…' / porcentaje-como-veredicto / 'quién ganó' (T-52-13)". Una feature de "más movimiento" choca de frente con este lock — hay que resolverlo en diseño, no rodearlo.

**Detection:** Comparar el "top de actividad" contra la distribución de `fecha_captura`/conteo de filas por fuente: si el top correlaciona con cobertura y no con actividad independiente, está sesgado. Revisión de diseño explícita.

**Phase:** Etapa DATOS. El conflicto ranking-vs-linter debe resolverse ANTES del frontend (el linter home ya bloqueará "los más movidos").

---

### Pitfall 3: Insinuación disfrazada de señal — el vocabulario NUEVO que el linter aún no veta

**What goes wrong:** Señales que suenan factuales pero afirman intención: "presentado a último momento", "proyecto zombie revivido", "urgencia de madrugada", "colgado en comisión", "tramitación exprés", "ingreso sospechoso". Cada una cruza de hecho fechado a editorial. El clustering por tema con labels LLM es el vector más peligroso: un cluster etiquetado "proyectos polémicos de seguridad" o "leyes contra la delincuencia" editorializa por construcción.

**Why it happens:** El linter `anti-insinuacion-guard.test.ts` es una **denylist EXACTA** — su propio JSDoc (WR-01) admite que "NO previene la insinuación: paráfrasis, sinónimos, yuxtaposición temporal e inglés se le escapan por construcción". El vocabulario de una feature de "actualidad" es TODO nuevo (temporal: "último momento", "madrugada", "revivido", "exprés") y NO está en `TERMINOS_PROHIBIDOS`. El linter pasará verde sobre copy insinuante que nunca vio.

**Consequences:** Difamación/editorialización — riesgo existencial #2 ("máquina de sospechas"). "Presentado a último momento" afirma una intención (esconder, apurar) que el dato no prueba.

**Prevention:**
- **Extender `TERMINOS_PROHIBIDOS` con el vocabulario temporal/editorial NUEVO ANTES de escribir el panel** — no después. Candidatos a vetar: "último momento", "última hora", "a escondidas", "madrugada", "exprés", "express", "zombie", "revivido", "resucitado", "colgado", "estancado", "durmiente", "sospechoso/a", "polémico/a", "controvertido/a", "silencioso/a", "a la rápida", "de apuro", "maniobra", "aprovechando". El panel entra a un array `SUPERFICIES_PANEL` nuevo del linter (patrón idéntico a `SUPERFICIES_AGENDA`/`SUPERFICIES_HOME`).
- **Clustering por tema = etiquetas FACTUALES, jamás editoriales.** El label de un cluster debe ser descriptivo-neutro derivable del contenido literal (palabras clave de las ideas matrices), no un juicio LLM. Riesgo LLM: el modelo etiquetará "proyectos anti-inmigración" o "leyes punitivas" si se le deja. Usar el eval propio del proyecto (el patrón de "etiquetado de sector con eval propio, NO el de extracción literal", ya establecido en v4 cruces) y un gate de fidelidad. Preferir labels neutros tipo "Seguridad pública", "Trabajo y previsión" sobre cualquier adjetivo.
- **Señales temporales = solo el hecho fechado, nunca la interpretación.** "Ingresó el 2026-07-22" bien. "Ingresó a último momento" mal. "Urgencia calificada suma el DD/MM a las HH:MM" bien (si la fuente da la hora); "urgencia de madrugada" mal (el "de madrugada" es el juicio).
- El linter es un TRIPWIRE, no una garantía (su JSDoc lo dice). La garantía real es (1) sign-off legal humano del copy del panel y (2) revisión de diseño anti-insinuación. No confiar en el linter verde como aprobación.

**Detection:** Mutation self-check nuevo en el guard (el patrón ya existe: inyecta término, verifica que muerde). Revisión humana del copy de cada señal contra "¿esto afirma una intención?".

**Phase:** Etapa DATOS (definir qué señales) + fase FRONTEND del panel (extender el linter con el array + vocabulario NUEVO como PRIMER commit de la fase, antes del copy).

---

### Pitfall 4: El primer login re-abre la superficie REST que el lockdown mató

**What goes wrong:** Notificaciones = primer dato de usuario = primer uso de auth. Hoy `anon` está MUERTA (0044 revocó todo; el sitio lee con `service_role` que bypassa RLS — Camino A). Añadir auth introduce el rol `authenticated`. Una policy `CREATE POLICY … TO authenticated` mal escrita sobre una tabla de suscripciones puede, por herencia o por un `GRANT … TO authenticated` amplio, re-exponer lectura de tablas que se creían cerradas. Peor: el `lockdown-guard.test.ts` solo veta grants a `anon`/`public` — **NO menciona `authenticated`**. El guard pasará verde mientras un grant a `authenticated` abre superficie.

**Why it happens:** El régimen de seguridad actual asume DOS roles (anon-muerto, service_role-todo). `authenticated` es un tercer rol que el guard nunca contempló. `anonGrantOffenders` matchea `to anon|public` — un `grant … to authenticated` no dispara. El modelo mental "el sitio lee con service_role" se rompe: ahora hay un camino de lectura autenticado real por PostgREST.

**Consequences:** Regresión de seguridad silenciosa en un repo público con sujetos hostiles (parlamentarios). Un usuario autenticado podría leer tablas PII vía REST si una policy se escribe mal. El lockdown-guard da falsa confianza.

**Prevention:**
- **Extender `lockdown-guard.test.ts` para tratar `authenticated` con el mismo rigor que `anon`/`public`** ANTES de la primera migración de auth. Regla: `authenticated` obtiene grants SOLO sobre las tablas de suscripción del propio usuario, con RLS `USING (user_id = auth.uid())`, y CERO sobre cualquier tabla del modelo de datos público o PII. El guard debe FALLAR ante `grant … to authenticated` sobre cualquier tabla que no sea la allowlist explícita de tablas-de-usuario.
- **Tablas de usuario nuevas (suscripción, consentimiento) NO viven en el mismo plano de grants que el modelo público.** RLS deny-by-default, policy por `auth.uid()`, probada con pgTAP (el usuario A no ve las suscripciones del usuario B).
- Deny-by-default es directiva del brief ("auth + RLS real… diseño de seguridad es parte del alcance").
- No usar `service_role` para operaciones de usuario (bypassa RLS → cualquier bug expone todo). Las lecturas/escrituras de suscripción van con el token del usuario (`authenticated`), no con la service key.

**Detection:** pgTAP: usuario A no lee filas de usuario B; `authenticated` no lee `parlamentario.rut` ni ninguna PII_TABLE. Guard extendido que muerde ante grant-to-authenticated fuera de la allowlist de tablas-de-usuario.

**Phase:** Fase NOTIFICACIONES / AUTH (diseño de seguridad primero). El guard extendido es prerrequisito de la primera migración de auth, no un follow-up.

---

### Pitfall 5: Emails de usuario = PII REAL bajo 21.719 — consentimiento, baja, DPA del proveedor de email

**What goes wrong:** Hasta hoy TODA la PII del sistema es de terceros públicos (parlamentarios, declarada por fuentes oficiales, minimizada). Un email de suscriptor es la PRIMERA PII de un DATA SUBJECT PRIVADO que el sistema RECOLECTA directamente. Cambia el régimen legal: bajo 21.719 (plena vigencia 2026-12-01, DENTRO del horizonte de este milestone) el consentimiento debe ser "libre, específico, informado e inequívoco y revocable"; el proveedor de email (Resend/SendGrid/etc.) es un ENCARGADO DE TRATAMIENTO que requiere contrato/DPA escrito; y hay que registrar consentimiento (fecha/hora, versión del aviso, método).

**Why it happens:** El equipo trata la PII como "dato de tercero público minimizado" (el régimen entero del proyecto). Un email de usuario NO es eso: es dato recolectado, con un titular que tiene derechos de acceso/supresión/portabilidad. El instinto de "solo mostramos lo que la fuente ya publicó" no aplica — aquí el sistema ES la fuente.

**Consequences:** Incumplimiento de 21.719 en el único punto donde el sistema recolecta PII propia. El proyecto tiene "pasada de asesoría legal antes del lanzamiento" como constraint LOCKED — notificaciones AÑADE una superficie legal nueva que esa pasada debe cubrir.

**Prevention:**
- **Doble opt-in (double opt-in) obligatorio:** el email no entra a ninguna lista hasta que el titular confirma vía enlace enviado a ese email. Estándar recomendado explícitamente para 21.719 (Fidelizador, Confidata). Sin confirmar = registro pendiente, nunca activo.
- **Registro de consentimiento:** fecha/hora, versión del aviso de privacidad, método de recolección — como fila auditada (el proyecto ya tiene el patrón `identidad_audit` inmutable; reusar la disciplina).
- **Baja (unsubscribe) en cada email + en la cuenta.** Revocable = requisito legal, no cortesía. Supresión efectiva de la fila, no solo un flag.
- **DPA del proveedor de email:** el proveedor es subencargado (igual que el LLM tier "sin entrenamiento/DPA" ya en el modelo mental del proyecto). Elegir un proveedor con DPA firmable y tier de no-reuso. Documentar el contrato como gate de operador (acción humana, no de agente — igual que los sign-offs legales).
- **Minimización:** recolectar SOLO el email (y quizás un nombre opcional). Nunca cruzar el email del suscriptor con la maestra de identidad ni con PII de terceros.
- **Retención:** política explícita — cuánto se guarda un email tras la baja (idealmente supresión inmediata + log de la baja sin el email).

**Detection:** Checklist legal como gate de operador (no lo flipea un agente, igual que MONEY/NET). pgTAP de que un email no-confirmado nunca aparece en la lista de envío.

**Phase:** Fase NOTIFICACIONES. El sign-off legal 21.719 sobre emails de usuario es un GATE HUMANO nuevo, análogo a los sign-offs MONEY/NET — el agente construye deny-by-default hasta el gate.

---

### Pitfall 6: Romper los candados de régimen v8/v9 en el rewrite de la landing

**What goes wrong:** La landing es la superficie MÁS candada del proyecto. El rewrite del bento producto-céntrico a panel de actualidad puede romper, silenciosamente y en verde local: (a) el copy hero LOCKED byte-idéntico ("Busca cualquier proyecto de ley por tema o número de boletín", decisión operador 2026-07-15); (b) `bento-guards.test.ts` cero-hex; (c) la whitelist tipográfica dura (`text-[11px]`/`[13px]`/`[15px]`… — cualquier `text-[Npx]` nuevo ad-hoc FALLA); (d) el shorthand `-[--var]` de Tailwind v4 (compila a valor inválido → elemento sin color, INVISIBLE hasta getComputedStyle en deploy real — este defecto ha reaparecido 3 veces); (e) `export const dynamic = "force-dynamic"` en `page.tsx` (sin él Next hornea `/` estática → panel congelado/500 en runtime — gotcha F50 LOCKED).

**Why it happens:** El régimen bento es invisible al ojo — vive en tests de guard y en tokens. Un ejecutor que "solo cambia el layout" puede meter un hex, un `text-[16px]`, o borrar el `force-dynamic` sin que el navegador local lo delate. La cascada CSS de Tailwind v4 (`-[--var]` bare) solo se caza en deploy real (memoria: v6.1/v8.0).

**Consequences:** Deploy roto en runtime (force-dynamic), o degradación visual invisible en local que solo aparece en producción. Re-trabajo. El copy hero cambiado sin autorización viola una decisión de operador LOCKED.

**Prevention:**
- Tratar `bento-guards.test.ts` + `anti-insinuacion-guard.test.ts` + el copy hero como CONTRATO. Cualquier token/tipografía nueva del panel se AÑADE a `WHITELIST_ARBITRARIOS` con razón documentada, o usa un paso Tailwind estándar. Cero hex, cero `-[--var]` bare.
- `export const dynamic = "force-dynamic"` es LOCKED en la home — nunca removerlo. El panel lee datos vivos por request; es dinámico por definición.
- Gate BrowserOS de comprensión en DEPLOY REAL (no local) — es donde se cazan la cascada CSS, el scroll-margin, el `-[--var]` (patrón LOCKED del proyecto: getComputedStyle en deploy).
- El copy hero solo cambia con autorización explícita del operador (precedente: el copy es MOCKUP, el operador ANULÓ cambios de copy en v8.1).

**Detection:** `pnpm test` (guards muerden) + build (force-dynamic) + BrowserOS en deploy. El scan de `page.tsx`/`actualidad-module.tsx` ya está en los tres guards; el panel nuevo debe entrar a esos arrays.

**Phase:** Fase FRONTEND del panel. Añadir el panel a los arrays de los 3 guards es parte del scaffolding, no un cierre.

---

## Moderate Pitfalls

### Pitfall 7: Crons más frecuentes → ráfagas que el WAF gubernamental bloquea

**What goes wrong:** El brief autoriza "crons más frecuentes" para frescura del panel. Más frecuencia intradía contra las fuentes gubernamentales choca con el WAF que bloquea ráfagas (rate-limit 2-3s LOCKED, "no opcional"). Un cron cada hora que reingiere sin hash-check puede gatillar bloqueo del WAF → paradójicamente CERO frescura.

**Prevention:** La frecuencia mayor NO significa más requests a la fuente. Respetar el patrón LOCKED de DOS ETAPAS: hash-check ANTES de descargar (`If-None-Match`/sha256 en R2) → salir temprano si no cambió. Lotes acotados, solo novedades. El rate-limit 2-3s/host es intocable. Preferir refrescar la VISTA/agregación (barata, interna) más seguido que re-scrapear la fuente.

**Phase:** Etapa DATOS / fase de ingesta del panel.

### Pitfall 8: GH Actions cron drift/skip → panel de "actualidad" sirviendo actualidad vieja

**What goes wrong:** Las señales de actualidad DEPENDEN de frescura, y los crons de GH Actions se retrasan o se SALTAN — confirmado: "delays or even be dropped during high load (midnight UTC)", "no SLA", y GH SUSPENDE crons en repos sin commit en 60 días. Un cron saltado el viernes → panel muestra "actualidad" del jueves como si fuera de hoy, sin avisar.

**Prevention:** El panel muestra SIEMPRE la fecha de última actualización por fuente (el bloque `UltimaActualizacion` ya existe — reusarlo como contrato). NUNCA implicar "hoy" sin respaldarlo con `fecha_captura`. Evitar cron a medianoche UTC (pico de load → drops); usar horario off-peak. Añadir `workflow_dispatch` para disparo manual. Monitoreo de staleness (`pnpm freshness` ya existe, exit 1 si stale) como alerta. Pitfall 1 (no emitir señal si la fuente está stale) es la red de seguridad de esto.

**Phase:** Etapa DATOS + operacional.

### Pitfall 9: statement_timeout vs agregaciones caras en la página más visitada

**What goes wrong:** El panel agrega ("proyectos con más movimiento", conteos por tema, clustering) sobre las tablas más grandes (3.657 proyectos, eventos de tramitación, embeddings). En la página más visitada, una agregación cara por request choca con `statement_timeout` (las RPCs nuevas son bounded con timeout por diseño — key decision v9) → 500 en la home. Además `force-dynamic` = sin cache = cada visita re-computa.

**Prevention:** Agregaciones de actualidad = vistas materializadas o RPCs bounded refrescadas por cron, NO computadas por request. El panel LEE un resultado pre-computado barato. Toda RPC nueva enhebra la aguja LOCKED (v9): migración >0044 cero-grant + security-definer PII-safe + `PUBLIC_RPC_ALLOWLIST` + bounded (LIMIT + statement_timeout + cap). Clustering pgvector se pre-computa offline, jamás en el request de la home.

**Phase:** Etapa DATOS (definir qué es pre-computable) + FRONTEND.

### Pitfall 10: Vista materializada stale sirviendo "actualidad" vieja + cache de Cloudflare

**What goes wrong:** La solución al Pitfall 9 (materializar) crea su espejo: una MV que no se refresca sirve "actualidad" congelada, ahora con apariencia de dato fresco. Y Cloudflare puede cachear la respuesta del panel sirviendo una versión vieja a usuarios distintos.

**Prevention:** La MV lleva su propio `refreshed_at` y el panel lo muestra (misma disciplina que `fecha_captura`). Si la MV está stale, degradar honestamente. Verificar los headers de cache de Cloudflare sobre la home dinámica: `force-dynamic` + no-store donde corresponda; validar en deploy real que no se sirve una portada cacheada. (El proyecto ya lidió con "cache de Cloudflare sirviendo panel viejo" en memoria de deploys.)

**Phase:** Etapa DATOS + operacional/deploy.

### Pitfall 11: Enumeración de suscriptores + unsubscribe token sin auth

**What goes wrong:** Endpoints de suscripción que revelan si un email ya está suscrito (respuesta distinta para existe/no-existe) = enumeración de suscriptores (quién sigue a qué parlamentario → dato sensible en sí mismo). Unsubscribe por link sin token firmado = cualquiera da de baja a cualquiera; token adivinable = igual.

**Prevention:** Respuesta idéntica exista o no el email ("te enviamos un correo si corresponde"). Unsubscribe con token opaco firmado, de un solo uso, ligado al email — sin exponer el id de usuario ni requerir login (pero criptográficamente ligado). Nunca listar suscriptores en ninguna superficie pública ni admin sin gate.

**Phase:** Fase NOTIFICACIONES.

---

## Minor Pitfalls

### Pitfall 12: Spam/bounce quema el dominio de envío

**What goes wrong:** Envío masivo sin SPF/DKIM/DMARC configurados, o a emails no confirmados (bounces altos) → el dominio entra en blocklists → ningún email llega (ni los de confirmación). El doble opt-in (Pitfall 5) ya reduce bounces; falta la infra DNS.

**Prevention:** SPF/DKIM/DMARC en el dominio antes del primer envío. Proveedor con buena reputación IP. Solo enviar a emails confirmados. Monitorear tasa de bounce/complaint.

**Phase:** Fase NOTIFICACIONES (config de infra, gate de operador — DNS es acción humana).

### Pitfall 13: Copiar los anti-patterns de UX de senado.cl / camara.cl

**What goes wrong:** El brief pide benchmark UX contra senado.cl y camara.cl "para superar". Riesgo: copiar sus patrones porque "así lo hace el sitio oficial" — tablas densas ASP.NET WebForms, paginación con postback, jerga interna ("prmID", "boletín" sin explicar), fechas ambiguas, cero jerarquía visual. Son sitios de tramitación interna, no de comprensión ciudadana.

**Prevention:** El benchmark es para APRENDER QUÉ EVITAR tanto como qué imitar. El proyecto ya tiene un régimen de comprensión (gate BrowserOS "cold read", leyenda "cómo leer esto", 3 capas cognitivas). El panel se mide contra ESE estándar, no contra los sitios oficiales. Traducir jerga (nunca mostrar "prmID" a un ciudadano). Cierre con crítica de diseño (parte del brief).

**Phase:** Fase de benchmark + FRONTEND.

### Pitfall 14: SEO/deep-links existentes rotos por el rewrite de la landing

**What goes wrong:** El rewrite de `/` puede romper deep-links, anchors, o metadata OG existentes que prensa/redes ya enlazan. El proyecto ya cazó "scroll-margin no cubría section[id]" solo en deploy.

**Prevention:** Preservar rutas y anchors existentes; verificar OG/metadata; el gate BrowserOS en deploy real caza los anchors rotos (precedente F81). No cambiar la URL de la home.

**Phase:** Fase FRONTEND del panel.

---

## Phase-Specific Warnings

| Fase | Pitfall probable | Mitigación |
|------|------------------|------------|
| **Etapa DATOS (QUÉ señales)** | Señal falsa por cobertura parcial (P1); sesgo de cámara (P2); ranking choca con linter (P2); definir vocabulario a vetar (P3) | Clasificar cada señal candidata: "¿requiere frescura declarada? ¿es cross-cámara sesgada? ¿el label afirma intención?" ANTES de tocar frontend |
| **Fase NOTIFICACIONES / AUTH** | Login re-abre REST (P4); email = PII 21.719 (P5); enumeración/token (P11); bounce (P12) | Extender lockdown-guard a `authenticated` como PRIMER commit; doble opt-in + registro de consentimiento + DPA como gate humano; deny-by-default RLS por `auth.uid()` |
| **Fase FRONTEND del panel** | Romper candados bento/copy/force-dynamic (P6); vocabulario insinuante nuevo (P3); SEO/anchors (P14); anti-patterns gubernamentales (P13) | Añadir panel a los 3 arrays de guards + extender `TERMINOS_PROHIBIDOS` como scaffolding; gate BrowserOS en DEPLOY real; copy hero solo con autorización operador |
| **Operacional / crons** | WAF por ráfagas (P7); cron drift/skip (P8); MV stale + cache CF (P10); timeout en home (P9) | Hash-check antes de descargar; frescura declarada siempre; off-peak + workflow_dispatch; agregaciones pre-computadas bounded, nunca por request |
| **Clustering por tema** | Labels LLM editoriales (P3) | Labels factuales derivados de contenido literal + eval propio + gate de fidelidad; pre-computado offline, nunca en el request |

---

## Sources

- `app/lib/anti-insinuacion-guard.test.ts` (leído) — denylist EXACTA, `TERMINOS_PROHIBIDOS`, arrays `SUPERFICIES_*`, JSDoc WR-01 ("NO previene insinuación… paráfrasis/temporal se escapan"), `NEGACIONES_LOCKED` — HIGH
- `app/lib/lockdown-guard.test.ts` (leído) — guard veta SOLO `anon`/`public`, NO `authenticated`; `PUBLIC_RPC_ALLOWLIST`; Camino A service_role bypassa RLS; PII_TABLES — HIGH
- `app/components/actualidad-module.tsx` (leído) — molde "en las fuentes consultadas", `throw` no `?? []` (#34), "CERO ranking/score/los más… (T-52-13)", frescura NO-PII, tz Chile — HIGH
- `app/lib/bento-guards.test.ts` (leído) — cero-hex, whitelist tipográfica dura, `-[--var]` shorthand inválido Tailwind v4 (reaparecido 3×) — HIGH
- `app/app/page.tsx` (leído) — copy hero LOCKED, `force-dynamic` gotcha F50, EXAMPLE_CHIPS/ENTRY_CARDS LOCKED — HIGH
- `.planning/PROJECT.md` / `.planning/MILESTONES.md` (leídos) — anti-insinuación LOCKED, Camino A, cobertura declarada, 21.719 (2026-12-01), WAF 2-3s, gates humanos — HIGH
- [GovTrack — About Our Data](https://www.govtrack.us/about-our-data) / [JoshData Medium](https://medium.com/civic-tech-thoughts-from-joshdata/govtrack-now-actually-uses-open-government-data-5fc16f377e86) — screen-scrapers se confunden, casos no anticipados (bills sin sponsor) → info incorrecta mostrada — MEDIUM
- [OpenSecrets — coverage disclosure](https://www.opensecrets.org/about/policy) — cobertura desigual declarada (19/50 estados con datos de lobbying) — MEDIUM
- [GitHub community #156282 — cron delays](https://github.com/orgs/community/discussions/156282) / [Monitoring GH Actions scheduled workflows — DEV](https://dev.to/krissv/monitoring-github-actions-scheduled-workflows-a-practical-guide-31h7) / [Prevent GitHub suspending cron — DEV](https://dev.to/gautamkrishnar/how-to-prevent-github-from-suspending-your-cronjob-based-triggers-knf) — cron delayed/dropped en high load, sin SLA, suspende tras 60 días sin commit — MEDIUM/HIGH
- [Ley 21.719 y email marketing — Fidelizador](https://blog.fidelizador.com/2025/11/26/nueva-ley-de-proteccion-de-datos-en-chile-como-redefine-el-email-marketing-responsable/) / [Gestión de consentimiento — Confidata](https://confidata.cl/blog/como-implementar-gestion-consentimiento) / [RSM Chile](https://www.rsm.global/chile/es/news/ley-21719-proteccion-de-datos-personales) — doble opt-in recomendado, consentimiento libre/específico/informado/revocable, registro (fecha/hora/versión/método), encargado de tratamiento requiere contrato escrito — MEDIUM/HIGH
