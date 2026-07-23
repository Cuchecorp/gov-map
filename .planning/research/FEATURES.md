# Feature Research

**Domain:** Panel de actualidad legislativa (landing cuantitativa) + notificaciones por suscripción — producto cívico chileno (Observatorio del Congreso 360, v10.0)
**Researched:** 2026-07-23
**Confidence:** HIGH (comparables verificados en fuente; señales mapeadas a schema real del repo)

---

## Contexto rector (LOCKED — filtra TODA señal)

Cada señal del panel debe ser **100% derivable de dato objetivo con fuente+fecha+enlace** y **JAMÁS insinuar intención, causalidad ni anomalía valorativa** (riesgo existencial #2 = "máquina de sospechas"). Una señal factual sobre *timing* ("presentado un viernes a las 19:00", "sin movimiento 400 días") es permisible **solo si se presenta como conteo/fecha neutra**; en cuanto el copy sugiere que el timing fue *deliberado* o *sospechoso*, se convierte en anti-feature. El linter de texto anti-insinuante ya existe en el proyecto y debe cubrir el panel.

**Dos audiencias, mismo dato, distinta densidad:**
- **Ciudadano/prensa general:** "qué pasó esta semana en el Congreso" — pocas señales, lenguaje claro, titulares navegables.
- **Tramitador/periodista/asesor:** "mi primera pantalla del día" — densidad, velocity, filtros por comisión/tema, suscripción granular.

---

## Hallazgos de comparables (empírico)

| Producto | Qué muestra en home/panel | Granularidad de suscripción | Digest vs instantáneo |
|----------|---------------------------|-----------------------------|-----------------------|
| **GovTrack** (US) | "Coming Up" (agendados esta semana), "Trending" (bills con más interés), Roll Call Votes recientes, bills en las noticias, "Track all legislative activity" (feed de introducción/acción mayor) | bill · legislator (nuevos bills + votos) · **subject/keyword** · committee · toda actividad · **tracker lists** (listas propias) | Email + RSS; feeds por lista |
| **LegiScan** (US, 50 estados) | **"National Trends"** = bill activity de las **últimas 72h medido por interés público + actividad**; hot bills; monitor list; mapas | full-text saved search · bill monitor list con **Topic/Client labels** propios | Email **de semanal a diario**; alerta cuando bill monitoreado tiene hearing/cambio, y cuando saved search matchea nuevo/enmendado |
| **Congress.gov** (LoC) | Saved-search alerts; bill alerts granulares | measure · nomination · treaty · **Member** · committee · saved search — y por bill puedes elegir **qué campos** rastrear (cosponsors, actions, amendments, committees, summary, subject) | Email; **consolidación** de varias saved-searches en 1 email opcional |
| **TheyWorkForYou** (UK, mySociety) | (home = transcripciones + actividad) | **keyword/frase exacta** (con OR/comillas) · **persona específica (tu MP) al hablar** | **1 email/día** batcheado (chequeo diario automatizado); preference center para suspender/reanudar/borrar |
| **openparliament.ca** | Debates recientes + **"word of the day"** (término más discutido, **LLM-generado, con disclaimer de posibles fabricaciones**), bills por etapa, votos recientes; búsqueda/filtro de bills/votes/MPs/debates/committees; **RSS de todo** | alertas por interés que matchean; RSS por MP y por contenido | Email "cada vez que pasa algo que matchea"; RSS |
| **senado.cl** (oficial CL) | **Editorial-first**: "Noticias" (titulares redactados), "Actividad legislativa" (Sala/Comisiones), "Lo que está pasando", "Interés ciudadano". NO es panel cuantitativo. | — (sin suscripción granular pública) | — |
| **camara.cl** (oficial CL) | "Destacados", "Actividad Legislativa", "Sesiones de Sala", **"Últimos Proyectos Ingresados"** (señal factual real), "Diputada/o", Leyes y Normas | — | — |

**Lecturas rectoras:**
1. El estándar de clase mundial es **velocity + agenda + trending + nuevos ingresos**, con suscripción a **bill · legislator · keyword · committee** y **listas/labels propias del usuario**. Congress.gov añade granularidad de *qué campo del bill* rastrear.
2. El modelo de notificación dominante para cívico es **digest diario batcheado** (TheyWorkForYou), no instantáneo — encaja con nuestros crons diarios y evita alert-fatigue (unsubscribe se quintuplica >5 emails/semana).
3. Los portales chilenos oficiales son **editoriales/redactados**, no cuantitativos — ahí está el hueco que v10.0 llena. camara.cl ya valida "Últimos Proyectos Ingresados" como señal esperada; senado.cl no da nada factual-agregado.
4. openparliament demuestra el **riesgo**: su "word of the day"/resúmenes LLM llevan disclaimer de "total fabrications". Para nosotros eso es anti-feature salvo clustering estrictamente factual con label oficial.

---

## Datos ya en el sistema (base de mapeo de señales)

| Tabla / columna | Contenido | Frescura |
|-----------------|-----------|----------|
| `tramitacion_evento(boletin, fecha, camara, tipo, descripcion)`, `tipo ∈ {tramite, urgencia, informe, oficio, votacion}` | **El reloj real del movimiento**: cada trámite/urgencia/informe con su fecha | cron leyes-weekly (semanal hoy) |
| `proyecto(boletin, titulo, iniciativa, camara_origen, autores[], materia, estado, etapa, subetapa, fecha_captura, enlace)` | Ficha base. **`materia` = taxonomía oficial factual**. **`iniciativa` = Mensaje/Moción** (Ejecutivo vs parlamentario). **NO hay `fecha_ingreso`** — solo `fecha_captura` (cuándo scrapeamos) | 3.657 proyectos (2022-2026) |
| `citacion`, `citacion_punto(boletin)`, `sesion_sala`, `sesion_tabla_item(boletin)` | **Agenda**: citaciones de comisión + tabla de sala, ligadas a boletín | cron agenda-weekly |
| `votacion(boletin, fecha, etapa, resultado…)`, `voto` | Votaciones registradas | — |
| `proyecto_ficha` + embeddings pgvector 768-dim (HNSW) | Idea matriz + vectores → **clustering temático factual disponible sin costo nuevo** | 84,6% cobertura |
| `cruce_senal`, lobby, `citacion_punto`→PL | Cruces factuales existentes | gated donde aplica |

**Consecuencia dura para el roadmap:** el reloj de "cuándo entró/se movió un proyecto" es `tramitacion_evento.fecha`, **no** una fecha de ingreso en `proyecto`. Toda señal temporal ("nuevos ingresos", "revividos", "presentado viernes tarde") depende de tener `tramitacion_evento` poblado con la fecha del **primer trámite** (o de ingerir `fecha_ingreso` explícito). Hoy `tramitacion_evento` existe pero su **cobertura/frescura debe auditarse en el SPIKE** antes de prometer cualquier señal de velocity — ese es el gate de datos que el operador pide "antes que frontend".

---

## Feature Landscape

### Table Stakes (el panel se siente incompleto sin esto)

| Feature | Por qué se espera | Complejidad | Dato fuente concreto |
|---------|-------------------|-------------|----------------------|
| **Nuevos ingresos** (proyectos ingresados en ventana N días) | camara.cl ya lo destaca ("Últimos Proyectos Ingresados"); es la señal #1 esperada | MEDIUM | `tramitacion_evento` primer evento por boletín, **o** ingerir `fecha_ingreso` (dato nuevo). **NO computable fielmente hoy con `proyecto.fecha_captura`** (fecha de scrape ≠ ingreso) → **requiere SPIKE/ingesta** |
| **Movimiento reciente / velocity** (proyectos con más trámites en ventana temporal) | GovTrack "Trending", LegiScan "National Trends 72h" — estándar de clase mundial | MEDIUM | `count(tramitacion_evento) where fecha in [ventana]` group by boletín. **Computable HOY** si `tramitacion_evento` tiene frescura; **requiere cron más frecuente** para ser "de hoy" |
| **Agenda: qué se vota/cita próximamente** | GovTrack "Coming Up"; ya tenemos /agenda | LOW | `citacion.fecha`, `sesion_sala.fecha`, `sesion_tabla_item` (futuro). **Computable HOY** (agenda ya ingerida) |
| **Urgencias vivas del Ejecutivo** (proyectos con urgencia vigente esta semana) | Señal factual de "el Ejecutivo está apurando esto"; ya hay token 3-estados en la ficha | MEDIUM | `tramitacion_evento where tipo='urgencia'` + estado urgencia 3-estados ya modelado. **Computable HOY** si el evento urgencia se ingiere; agregación nueva |
| **Leyes recién publicadas** (normas promulgadas en ventana) | GovTrack/openparliament cierran el ciclo "de proyecto a ley"; el ciudadano quiere ver el resultado | MEDIUM | **Requiere ingesta nueva**: BCN "últimas leyes publicadas" (portada_ulp, últimos 12 meses) o Cámara `leyes_promulgadas.aspx` / Senado "leyes publicadas". No hay endpoint XML de recency directo — `obtxml opt=6` es por categoría estática, no por fecha. Scrapear la portada ULP o la tabla Cámara |
| **Agrupación por tema/materia** (proyectos con movimiento agrupados por materia oficial) | LegiScan Topic labels; el usuario piensa por tema, no por boletín | MEDIUM | `proyecto.materia` (**taxonomía oficial BCN/comisión = label factual, reusable directo**). **Computable HOY**. Clustering por embeddings como capa secundaria opcional |
| **Trazabilidad por señal** (cada dato del panel con fuente+fecha+enlace) | Principio rector del proyecto; sin esto el panel no puede existir | LOW | `origen`/`fecha_captura`/`enlace` ya inline en cada tabla |
| **Suscripción a un proyecto** (novedades de un boletín) | GovTrack/Congress.gov/LegiScan lo tienen todos | MEDIUM-HIGH | `tramitacion_evento` diff por boletín. **Requiere auth + RLS + tabla de suscripción + email** (primer dato de usuario) |
| **Suscripción a un parlamentario** (nuevos proyectos que presenta, cómo vota) | GovTrack "track legislators", Congress.gov "Member" | MEDIUM-HIGH | `proyecto.autores[]` + `voto`; misma infra de auth/email |
| **Digest por email** (diario o semanal, batcheado) | TheyWorkForYou modelo dominante cívico; encaja con crons | MEDIUM | Cron que arma digest desde diffs; doble opt-in + unsubscribe en footer (legal + deliverability) |

### Differentiators (ventaja competitiva, alineados al Core Value)

| Feature | Propuesta de valor | Complejidad | Dato fuente concreto |
|---------|--------------------|-------------|----------------------|
| **Panel unificado bicameral** (Cámara + Senado en una pantalla) | Ningún portal oficial chileno cruza ambas cámaras en un panel de actualidad; los oficiales son mono-cámara y editoriales | MEDIUM | `tramitacion_evento.camara` + `citacion` ambas cámaras — ya bicameral en el modelo |
| **"Proyectos revividos"** (sin movimiento largo → trámite nuevo) | Señal factual valiosa para prensa: "esto estaba dormido y volvió"; nadie más la ofrece | MEDIUM | gap entre penúltimo y último `tramitacion_evento.fecha` por boletín > umbral. Presentar como **fecha neutra** ("último movimiento previo: hace 412 días"), JAMÁS "revivido sospechosamente". Requiere `tramitacion_evento` con historia completa |
| **Comisiones más activas de la semana** | Tramitador quiere saber dónde está el trabajo real; factual puro | LOW-MEDIUM | `count(citacion)` group by comisión en ventana + `tramitacion_evento` por etapa/comisión. **Computable HOY** (agenda) |
| **Clustering temático factual sobre materia + embeddings** | Agrupar "lo que se mueve" por tema legible sin categoría editorial; los embeddings YA existen | MEDIUM-HIGH | `proyecto.materia` como label primario (oficial) + pgvector para agrupar los que comparten idea matriz. **Label debe ser la materia oficial**, nunca un tema inventado por LLM |
| **Suscripción por keyword/materia** (no solo bill/persona) | TheyWorkForYou keyword + LegiScan Topic; potente para asesores temáticos | HIGH | FTS `websearch_to_tsquery` (ya existe RRF) + `proyecto.materia`; matchear diffs contra el término suscrito |
| **Suscripción por comisión** | Tramitador sigue "su" comisión entera | MEDIUM | `citacion`/`tramitacion_evento` filtrado por comisión |
| **Ventana "hoy / esta semana" con tz Chile explícita** | Gotcha ya conocido del proyecto (date-only UTC = día chileno); hacerlo bien es diferenciador de confianza | LOW | Reusar la lógica tz de /agenda ya resuelta |
| **RSS/feeds además de email** | GovTrack y openparliament lo dan; barato, sirve a power-users y evita fricción de auth | LOW-MEDIUM | Render de los mismos diffs a Atom/RSS server-side |

### Anti-Features (parecen buenas, editorializan o rompen el principio rector)

| Feature | Por qué se pide | Por qué es problemático | Alternativa |
|---------|-----------------|-------------------------|-------------|
| **"Presentado a último momento / anomalías de timing"** como señal destacada | El brief lo menciona; suena revelador | En cuanto se rotula "a último momento", "viernes tarde", "pre-receso" con framing de sospecha → **insinúa intención deliberada** = máquina de sospechas (riesgo existencial #2). Un viernes tarde puede ser rutina | Mostrar **solo la fecha/hora factual neutra** dentro de la ficha ("ingresado vie 18/07 19:14"), **sin** módulo de panel que lo destaque como anomalía ni ranking de "sospechosos". El usuario saca su conclusión |
| **Resúmenes/"word of the day" generados por LLM** | openparliament lo hace; da narrativa | openparliament mismo advierte "inaccuracies or total fabrications" → un resumen alucinado con la marca del Observatorio destruye la credibilidad y viola trazabilidad | Titulares = **texto oficial literal** (título del proyecto, materia oficial). Clustering factual por materia/embedding, sin prosa generada |
| **Ranking de "urgencia" que ordene parlamentarios/proyectos por juicio** | Parece útil priorizar | Un score compuesto = afirmación editorial; el proyecto prohíbe scores de correlación (ya LOCKED en cruces) | Conteos factuales ordenables por el usuario (más trámites, más reciente), nunca un "índice" propietario |
| **Notificaciones instantáneas / real-time push** | "Enterarme al segundo" | Alert-fatigue (unsubscribe 5x >5 emails/sem); nuestros datos llegan por cron, no en tiempo real → "instantáneo" sería una promesa falsa | **Digest diario batcheado** (modelo TheyWorkForYou), con opción semanal en preference center |
| **Feed público de "toda la actividad" sin auth pero con datos de usuario** | Simplicidad | El primer dato de usuario exige auth+RLS real (anon está muerta, sitio corre service_role) — mezclar suscripciones en superficie anon reabre el boundary de seguridad | Panel de actualidad = **público sin auth** (solo datos oficiales agregados); suscripciones = **detrás de auth con RLS deny-by-default** |
| **Sentiment / clasificación de "polémico" o "importante"** | Editorializa lo relevante | Juicio de valor no derivable de dato objetivo | "Con más movimiento" / "más citaciones" — factual, deja el juicio al lector |
| **Trending por vistas del propio sitio** | GovTrack usa "public interest" | Requiere analytics de usuarios y sesga hacia lo ya popular; frágil y no factual-legislativo | Trending = **actividad legislativa objetiva** (conteo de trámites en ventana), no popularidad de clicks |

---

## Feature Dependencies

```
[Panel de actualidad público]
    └──requires──> [Auditoría de frescura/cobertura de tramitacion_evento]  (SPIKE, gate de datos)
                       └──requires──> [Cron más frecuente que semanal]  (para "hoy")

[Nuevos ingresos] ──requires──> [fecha de ingreso real]
    (tramitacion_evento primer evento  O  ingesta de fecha_ingreso)   ← NO existe en proyecto hoy

[Movimiento/velocity] ──requires──> [tramitacion_evento fresco]
[Proyectos revividos] ──requires──> [tramitacion_evento con HISTORIA completa por boletín]
[Urgencias vivas] ──requires──> [tramitacion_evento tipo=urgencia + estado 3-estados]
[Leyes recién publicadas] ──requires──> [ingesta nueva BCN portada_ulp / Cámara leyes_promulgadas]
[Agrupación por tema] ──uses──> [proyecto.materia (oficial)] ──enhanced-by──> [embeddings pgvector (ya existen)]

[Suscripciones a proyecto/parlamentario]
    └──requires──> [Auth + RLS real (deny-by-default)]   ← primer dato de usuario del sistema
                       └──requires──> [tabla suscripcion + email provider + doble opt-in]
                              └──requires──> [motor de diff por boletín/autor]
                                     └──requires──> [digest cron batcheado]

[Suscripción por keyword] ──requires──> [FTS websearch_to_tsquery (ya existe, RRF)]
[Suscripción por comisión] ──requires──> [tramitacion_evento/citacion por comisión]

[Benchmark UX senado.cl/camara.cl] ──informs──> [diseño del panel]  (empírico BrowserOS, milestone frontend)
```

### Notas de dependencia

- **El SPIKE de datos gatea TODO el panel:** el operador pidió "QUÉ antes que CÓMO". La pregunta empírica #1 es *¿tiene `tramitacion_evento` la frescura y cobertura para sostener velocity/nuevos ingresos/revividos?* Si no, la primera obra es ingesta (fecha de ingreso + cron más frecuente), no frontend.
- **`proyecto` no tiene `fecha_ingreso`:** cualquier señal de "nuevo" hoy usaría `fecha_captura` (fecha de scrape), que es **incorrecto** — un backfill masivo capturó proyectos viejos con `fecha_captura` reciente. Esto haría un panel mentiroso. Resolver en el SPIKE.
- **Suscripciones = subsistema de seguridad, no un feature UI:** es el primer dato de usuario. Auth + RLS deny-by-default es parte del alcance, no un add-on. Bajo Camino A (service_role bypassa RLS), el diseño debe aislar datos de usuario en un boundary con RLS real, no en el mismo plano service_role del sitio público.
- **Digest depende de motor de diff:** para notificar hay que comparar el estado de ayer vs hoy por boletín/autor — requiere snapshot o log de cambios (`tramitacion_evento` ya es append-only, sirve como log).

---

## MVP Definition

### Launch With (v10.0 core)

**Etapa datos (SPIKE primero — gate del operador):**
- [ ] Auditoría empírica de `tramitacion_evento`: frescura, cobertura, ¿sirve para velocity? ¿hay primer-evento fiable por boletín? — **decide qué señales son honestas**
- [ ] Decisión de ingesta: ¿`fecha_ingreso` explícito? ¿cron diario/más frecuente? (repo público, GH Actions OK)

**Panel público (frontend, tras el SPIKE):**
- [ ] **Movimiento reciente** (velocity, ventana semana) — computable si el SPIKE valida frescura; señal ancla del panel
- [ ] **Agenda próxima** (votaciones/citaciones) — ya ingerido, bajo costo, alto valor "coming up"
- [ ] **Urgencias vivas del Ejecutivo** — factual, diferenciador, token 3-estados ya existe
- [ ] **Agrupación por materia oficial** — `proyecto.materia`, label factual reusable directo
- [ ] **Nuevos ingresos** — condicionado a resolver la fecha de ingreso en el SPIKE
- [ ] **Trazabilidad por señal** (fuente+fecha+enlace) — no negociable
- [ ] **Ventana hoy/semana tz Chile** — reusar lógica /agenda

### Add After Validation (v10.x)

- [ ] **Leyes recién publicadas** (ingesta BCN portada_ulp / Cámara leyes_promulgadas) — cierra el ciclo, requiere conector nuevo → segunda ola
- [ ] **Proyectos revividos** — requiere historia completa de `tramitacion_evento`; alto valor prensa, presentar neutro
- [ ] **Comisiones más activas** — barato una vez el panel existe
- [ ] **Suscripciones a proyecto + parlamentario** con **digest diario** — el bloque de auth/RLS/email; construir "lo defendible" tras validar el panel público
- [ ] **RSS/Atom feeds** de las mismas señales

### Future Consideration (v11+)

- [ ] **Suscripción por keyword/materia y por comisión** — potente para asesores, pero exige el motor de matching sobre diffs maduro
- [ ] **Congress.gov-style: elegir qué campo del proyecto rastrear** (solo urgencias, solo votos) — granularidad fina, tras validar demanda
- [ ] **Preference center** completo (frecuencia diaria/semanal, pausar/reanudar) — cuando haya volumen de suscriptores
- [ ] **Clustering por embeddings como vista temática secundaria** — cuando la materia oficial se quede corta

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority | Audiencia |
|---------|------------|---------------------|----------|-----------|
| SPIKE frescura/cobertura tramitacion_evento | HIGH (gatea todo) | LOW-MEDIUM | **P1** | interno |
| Movimiento/velocity semanal | HIGH | MEDIUM | **P1** | tramitador + ciudadano |
| Agenda próxima (coming up) | HIGH | LOW | **P1** | ambos |
| Urgencias vivas del Ejecutivo | HIGH | MEDIUM | **P1** | tramitador + prensa |
| Agrupación por materia oficial | HIGH | MEDIUM | **P1** | ambos |
| Nuevos ingresos | HIGH | MEDIUM (depende fecha_ingreso) | **P1** (condicional) | ambos |
| Trazabilidad por señal | HIGH (rector) | LOW | **P1** | ambos |
| Leyes recién publicadas | MEDIUM-HIGH | MEDIUM (ingesta nueva) | **P2** | ciudadano |
| Comisiones más activas | MEDIUM | LOW-MEDIUM | **P2** | tramitador |
| Proyectos revividos | MEDIUM-HIGH (prensa) | MEDIUM | **P2** | periodista |
| Suscripción proyecto/parlamentario + digest | HIGH | HIGH (auth+RLS+email) | **P2** | ambos |
| RSS/Atom feeds | MEDIUM | LOW-MEDIUM | **P2** | power-user |
| Suscripción keyword/materia/comisión | HIGH (asesor) | HIGH | **P3** | tramitador/asesor |
| Preference center avanzado | MEDIUM | MEDIUM | **P3** | suscriptores |

**Clave:** P1 = imprescindible v10.0 · P2 = segunda ola misma milestone / v10.x · P3 = futuro.

---

## Competitor Feature Analysis

| Feature | GovTrack | LegiScan | TheyWorkForYou | Congress.gov | Nuestro enfoque |
|---------|----------|----------|----------------|--------------|-----------------|
| Panel "qué pasa ahora" | Coming Up + Trending + votos | National Trends 72h | debates+word-of-day | (search-céntrico) | **Velocity + agenda + urgencias + materia, bicameral, factual** |
| Trending | interés público (clicks) | actividad 72h | — | — | **Actividad legislativa objetiva** (conteo trámites), no clicks |
| Nuevos ingresos | feed de introducción | monitor | — | alerts | Sí, **si el SPIKE resuelve fecha de ingreso** |
| Agrupación temática | subject areas | Topic labels propios | keyword | subject | **Materia oficial BCN** (factual) + embeddings opcional |
| Suscripción granular | bill/legislator/subject/committee/lista | bill/topic/full-text | keyword/persona | measure/member/committee/campo | proyecto/parlamentario → luego keyword/comisión |
| Modelo notificación | email+RSS | email semanal→diario | **1 email/día batcheado** | email consolidable | **Digest diario batcheado + doble opt-in + RSS** |
| Resúmenes LLM | no | no | no | no | **NO** (anti-feature; solo texto oficial literal) |
| Timing "anómalo" | no | no | no | no | **NO como señal destacada** (solo fecha neutra en ficha) |

---

## Sources

- [GovTrack — home + how-to-use](https://www.govtrack.us/how-to-use) — módulos Coming Up/Trending/votos, granularidad bill/legislator/subject/committee/tracker-lists — HIGH (home HTML inspeccionado directo)
- [GovTrack — Track All Legislative Activity](https://www.govtrack.us/events/bill-activity) — feed de introducción/acción mayor — HIGH
- [LegiScan — features](https://legiscan.com/features) / [National Trends](https://legiscan.com/trends) / [monitor](https://legiscan.com/gaits/monitor) — "National Trends = bill activity últimas 72h por interés público + actividad"; Topic labels; email semanal→diario — MEDIUM-HIGH (search verificado, página 403 a fetch directo)
- [Congress.gov — About Alerts](https://www.congress.gov/help/alerts) / [Get Alerts](https://www.congress.gov/get-alerts) — granularidad por campo del bill; consolidación de saved-searches — HIGH
- [TheyWorkForYou — Email Alerts](https://www.theyworkforyou.com/alert/) / [mySociety — keyword alerts](https://www.mysociety.org/2014/07/23/want-to-know-what-your-mp-is-saying-subscribe-to-a-theyworkforyou-alert/) / [improving alerts 2025](https://www.mysociety.org/2025/10/23/improving-theyworkforyou-email-alerts/) — 1 email/día batcheado; keyword/persona; preference center — HIGH
- [openparliament.ca — Email alerts](https://openparliament.ca/alerts/) / [home](https://openparliament.ca/) — word-of-day LLM con disclaimer de fabricaciones; RSS de todo — MEDIUM (home 403 a fetch, corroborado por search + páginas de debate)
- [BCN LeyChile — Últimas leyes publicadas (portada_ulp)](https://www.bcn.cl/leychile/Consulta/portada_ulp) — leyes publicadas últimos 12 meses ordenadas por número/fecha; **fuente para "leyes recién publicadas"** (no hay endpoint XML de recency directo; `obtxml opt=6/opt=30` son categorías estáticas, verificado) — MEDIUM
- [Cámara — Leyes Promulgadas](https://www.camara.cl/legislacion/ProyectosDeLey/leyes_promulgadas.aspx) / [Senado — Leyes publicadas](https://www.senado.cl/actividad-legislativa/informacion-legislativa/leyes-publicadas) — alternativas de ingesta de leyes publicadas — MEDIUM
- senado.cl / camara.cl homes (HTML inspeccionado directo, UA identificatorio) — oficiales = editorial-first; camara.cl destaca "Últimos Proyectos Ingresados", ambos "Actividad Legislativa"/"Sesiones de Sala" — HIGH
- Repo `supabase/migrations/0008_tramitacion.sql` + `0010_agenda.sql` — schema real: `tramitacion_evento(tipo urgencia/tramite/…)`, `proyecto.materia`, **sin `fecha_ingreso`**, agenda ligada a boletín — HIGH
- [Notification best practices — alert fatigue / unsubscribe](https://www.smtp2go.com/blog/15-email-unsubscribe-best-practices/) — digest vs instant, doble opt-in, unsubscribe 5x >5 emails/sem, preference center — MEDIUM

---
*Feature research for: panel de actualidad legislativa + notificaciones (Observatorio del Congreso 360 v10.0)*
*Researched: 2026-07-23*
