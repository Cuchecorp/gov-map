# Pitfalls Research

**Domain:** Observatorio ciudadano de datos públicos del Congreso de Chile (scraping gubernamental + reconciliación de identidad + cruces de datos sensibles + LLM/embeddings)
**Researched:** 2026-06-17
**Confidence:** HIGH (riesgos existenciales y legal verificados con fuentes oficiales; detalles técnicos de scraping con endpoints validados en vivo al 17/06/2026 según PROJECT.md)

> Dos riesgos son **existenciales** (matan el producto, no solo lo retrasan): la **reconciliación de identidad** y la **"máquina de sospechas"**. Se tratan primero y a fondo. Todo lo demás es operacional.

---

## Critical Pitfalls

### Pitfall 1: Reconciliación de identidad que falla en silencio (RIESGO EXISTENCIAL #1)

**What goes wrong:**
El sistema asocia un dato (un voto, una reunión de lobby, un contrato del Estado, una declaración de patrimonio) a la **persona equivocada**. Como cada dato lleva fuente, fecha y enlace, la afirmación falsa resulta **creíble y trazable** — exactamente lo que da autoridad al producto se convierte en su mayor pasivo. Un periodista cita "según el Observatorio, el diputado X votó/se reunió/recibió…" sobre un match incorrecto, y el daño reputacional (al parlamentario y al proyecto) es irreversible.

**Por qué es existencial y no operacional:** un bug de scraping se nota (faltan datos, error 500). Un match equivocado **no se nota**: produce un registro perfectamente formado y plausible. El fallo es silencioso por construcción.

**Why it happens:**
- **Homónimos** reales en el Congreso (varios apellidos comunes; familias políticas con mismos apellidos).
- **Nombres de casada** y variantes (aparece con apellido de soltera en una fuente, de casada en otra).
- **Abreviaturas y orden invertido**: "Walker P., Matías" vs "Matías Walker Prieto" vs "Walker, M." — el mismo humano en tres grafías.
- **Dos cámaras con identificadores distintos**: Senado usa `PARLID` (`senadores_vigentes.php`), Cámara usa su propio `ID` en `doGet.asmx`. No hay clave compartida nativa; el puente es el **nombre normalizado**, que es justamente lo ambiguo.
- **Fuzzy-match automático sin umbral ni revisión humana**: la tentación de cerrar el pipeline con `similarity > 0.8 → match` es enorme porque "funciona en el 95% de los casos". El 5% restante es el que destruye el producto.

**How to avoid:**
- **Pipeline de identidad como subsistema crítico explícito** (ya en PROJECT.md): atajo determinista (RUT cuando exista) → generación de candidatos → adjudicación LLM (modelo crítico, MiniMax) → **compuerta de validación con umbral** → **confirmación humana obligatoria** para todo lo que no sea match determinista de alta confianza → **golden set** de casos resueltos → **auditoría** (log de por qué se decidió cada match).
- **RUT como llave fuerte de uso interno** para anclar identidad cuando esté disponible; nunca confiar solo en nombre.
- **Tres estados, no dos**: `confirmado` / `candidato_pendiente_revisión` / `rechazado`. Nada entra a la capa pública en estado "candidato". Un dato sin identidad confirmada **no se muestra**, no se muestra con disclaimer.
- **Umbral conservador asimétrico**: preferir falsos negativos (dato sin asociar, queda pendiente) sobre falsos positivos (dato mal asociado). El costo de un pendiente es trabajo humano; el de un falso positivo es el producto.
- **Golden set versionado** como test de regresión: cada cambio en el algoritmo de match se corre contra el golden set antes de aplicar.
- **Sembrar la tabla maestra `Parlamentario` con revisión humana desde el día uno** (Cámara + Senado), no auto-generarla.

**Warning signs:**
- Tasa de "match automático de alta confianza" sospechosamente alta (>90%) → el umbral está flojo.
- Mismo `PARLID`/`ID` Cámara asociado a dos nombres muy distintos, o dos IDs distintos colapsados en una persona.
- Aparece un parlamentario con datos de dos cámaras pero cero confirmaciones humanas registradas.
- Cola de revisión humana vacía cuando debería tener los homónimos conocidos.

**Phase to address:**
**Fase 0 (Fundaciones)** — es el primer entregable, antes que cualquier cruce de datos. El golden set, la tabla maestra sembrada y la compuerta de validación deben existir antes de P2/P1. **Ninguna fase posterior debe poder asociar datos a personas sin pasar por este subsistema.**

---

### Pitfall 2: "Máquina de sospechas" — el framing que insinúa causalidad (RIESGO EXISTENCIAL #2)

**What goes wrong:**
El sistema yuxtapone hechos correctos (reunión de lobby en fecha X + voto en fecha X+n + contrato del Estado a empresa relacionada) de forma que el **diseño mismo insinúa intención o causalidad** que el dato no sustenta. Una alerta titulada "⚠️ Conflicto detectado", un grafo que dibuja una arista gruesa entre "parlamentario" y "empresa", o un timeline que pone reunión y voto adyacentes, **comunican una acusación** aunque cada nodo sea verídico. El producto deja de ser un observatorio y se vuelve un generador automático de señalamientos — jurídicamente indefendible (injuria/calumnia) y éticamente corrosivo.

**Por qué es existencial:** el valor declarado del producto es "qué pasó, cuándo y según qué fuente, **sin afirmar nunca intención ni causalidad**" (Core Value, PROJECT.md). Si el framing rompe esa regla, el producto contradice su propia razón de ser y queda expuesto legalmente con la Ley 21.719 ya vigente.

**Why it happens:**
- Las visualizaciones "potentes" (grafos de influencia, alertas, scores de riesgo) son atractivas y demoables, pero su lenguaje visual es inherentemente acusatorio.
- La correlación temporal es fácil de computar y tentadora de destacar; la causalidad requiere prueba que el sistema no tiene.
- Presión de producto por "insights" en vez de datos: un timeline neutro parece menos impresionante que una alerta roja.
- Los LLM, al resumir, tienden a "explicar" y conectar — introducen narrativa causal donde solo hay coincidencia.

**How to avoid:**
- **Regla rectora codificada, no aspiracional**: "trazabilidad sobre interpretación". Cada elemento de UI debe responder "¿esto afirma un hecho con fuente, o insinúa un motivo?". Si insinúa motivo → se rediseña.
- **Lenguaje neutro obligatorio**: "se registra reunión el DD/MM (fuente)" y "se registra voto el DD/MM (fuente)" como hechos separados; **nunca** "reunión que precedió al voto" ni "posible conflicto".
- **Prohibir elementos de framing acusatorio en M1**: nada de scores de riesgo, alertas de "conflicto", aristas valoradas en grafos, ni adyacencia visual sugestiva. El grafo (P6) se difiere y, cuando llegue, las aristas son "co-ocurrencia documentada con fuente", no "influencia".
- **LLM con prompt restrictivo**: el LLM extrae y estructura (idea matriz, cuerpos legales, ficha), **no interpreta ni conecta**. Prompt que prohíbe explícitamente afirmar causa, intención o juicio de valor. Validar salidas contra esta regla.
- **Contexto temporal con fuente, no narrativa**: mostrar cronología es legítimo; **escribir** la conexión causal no lo es.
- **Pasada de asesoría legal antes del lanzamiento público** (ya en Constraints) revisando específicamente el framing de la UI, no solo el manejo de datos.

**Warning signs:**
- Aparece la palabra "conflicto", "sospechoso", "vínculo", "influencia" en copy de UI o salidas de LLM.
- Un diseño de alerta o grafo que un abogado describiría como "imputación".
- Stakeholders pidiendo "que se note la conexión" entre dos hechos.
- El LLM produciendo frases que conectan hechos con "por lo tanto", "lo que sugiere", "tras reunirse".

**Phase to address:**
**Transversal, con guardarraíl en Fase 0** (definir el "lenguaje neutro" y el contrato de prompts del LLM) y **enforcement en cada fase de frontend** (P2 ficha de proyecto, futuros P3-P6). Las funcionalidades de mayor riesgo (P4 alertas lobby+patrimonio, P6 grafo) están **diferidas a propósito** hasta tener política de datos y framing resueltos.

---

### Pitfall 3: WAF gubernamental que bloquea ráfagas de scraping

**What goes wrong:**
El conector dispara requests en paralelo o sin delay; el WAF de camara.cl/senado.cl/BCN detecta el patrón de bot y bloquea por IP — temporal o permanentemente. El proyecto pierde acceso a su fuente primaria, posiblemente desde la única IP de las Edge Functions.

**Why it happens:**
- Default de cualquier cliente HTTP es ir lo más rápido posible.
- En desarrollo, con pocos requests, nunca se gatilla el WAF; aparece recién al hacer un backfill completo en producción.
- `Promise.all` sobre una lista de boletines = ráfaga instantánea.

**How to avoid:**
- **Delay 2–3s entre requests obligatorio, no opcional** (Constraints). Implementar en el framework común de conectores como un rate-limiter serial, no por-conector.
- **User-Agent identificatorio** (quién somos + contacto) — ingesta respetuosa y reduce probabilidad de bloqueo arbitrario.
- **Cola serial, no paralelismo** para ingesta de fuentes gubernamentales.
- **Caché diaria**: no re-pedir lo que no cambia más de una vez al día.
- **Respeto a robots.txt** (Constraints).
- **Backoff exponencial ante 429/403**, con cola que pausa toda la ingesta de ese host.

**Warning signs:**
- Primer 403/429/captcha en logs.
- Latencia creciente o timeouts desde un host antes saludable.
- Funciona en local pero falla en producción (IP distinta, volumen distinto).

**Phase to address:**
**Fase 0 (Fundaciones)** — el "framework común de conectores: rate-limit 2–3s, caché diaria, User-Agent identificado" es un entregable explícito. Ningún conector de P2/P1 debe poder saltarse el rate-limiter.

---

### Pitfall 4: Datos personales y cumplimiento Ley 21.719 (legal, no solo técnico)

**What goes wrong:**
El sistema procesa RUT, nombres y datos de **familiares** para reconciliar identidad, y los cruza. Bajo la **Ley 21.719** (publicada 13/12/2024, **plena vigencia 1/12/2026** — antes del lanzamiento previsto) esto es tratamiento de datos personales sujeto a la nueva Agencia de Protección de Datos (APDP), con multas de hasta 20.000 UTM (gravísimas) o 4% de ingresos anuales por reincidencia. Errores típicos: (a) creer que "fuente de acceso público" exime de cumplimiento — **no lo hace**; (b) tratar el **dato derivado del cruce** como público cuando queda protegido; (c) enviar datos personales a un LLM en un tier que entrena con los inputs; (d) exponer RUT o datos de familiares en la capa pública.

**Why it happens:**
- Asumir que "es información pública del Congreso" = "puedo hacer cualquier cosa con ella".
- No leer la letra chica de los tiers de LLM (free tiers suelen reservarse el derecho de entrenar con inputs).
- Minimización tratada como opcional en vez de principio de diseño.

**How to avoid:**
- **"Fuente de acceso público" NO exime de cumplimiento** — el cruce genera dato derivado protegido. Asumir cumplimiento desde el diseño.
- **LLM vía API = subencargado del tratamiento**: usar solo tiers **sin entrenamiento con inputs** y con DPA/contrato de encargo (requisito Ley 21.719). Documentar la cadena responsable→encargado→subencargado.
- **NUNCA enviar dato personal por Gemini free** ni por ningún tier que entrene con inputs. Gemini queda restringido a **embeddings de textos legislativos** (que no son datos personales sensibles), no a adjudicación de identidad de personas.
- **Adjudicación de identidad (que toca RUT/nombres/familiares) → modelo crítico con tier protegido** (MiniMax M3 en tier sin entrenamiento), no el de volumen.
- **Minimización por diseño**: RUT y datos de familiares son **uso interno para reconciliar**, **nunca** se exponen en la capa pública (ya en Out of Scope).
- **Atribución CC BY 4.0 visible** para InfoProbidad (Constraints).
- **Pasada de asesoría legal antes del lanzamiento público** (Constraints) — bloqueante de release público, no opcional.

**Warning signs:**
- Un RUT o dato de familiar aparece en una respuesta de API pública o en el frontend.
- Un prompt enviado a Gemini/DeepSeek free contiene nombres+RUT de personas reales.
- No existe registro de qué tier/DPA cubre cada proveedor de LLM.
- Tratamiento de datos sin base de licitud documentada.

**Phase to address:**
**Fase 0 (Fundaciones)** define la política de datos del LLM y la minimización (qué va a qué proveedor). **Bloqueante para el lanzamiento público** la pasada legal. P4 (lobby+patrimonio) está diferido explícitamente hasta "definir política de datos del LLM".

---

### Pitfall 5: Cambiar el modelo de embeddings obliga a re-embeder TODO

**What goes wrong:**
Se generan embeddings con Gemini, se indexan en pgvector, y meses después se cambia de modelo (o el proveedor cambia su modelo por defecto). Los vectores nuevos **no son comparables** con los viejos — viven en otro espacio vectorial. La búsqueda semántica devuelve basura porque mezcla vectores de modelos distintos. La única salida es **re-embeder todo el corpus**, que con miles de textos legislativos largos consume cuota y tiempo.

**Why it happens:**
- Asumir que los embeddings son intercambiables entre modelos (no lo son: distinta dimensión, distinto espacio).
- No versionar el modelo junto al vector.
- Proveedor deprecando o cambiando silenciosamente su modelo de embeddings.

**How to avoid:**
- **Versionar el modelo en cada vector**: guardar `embedding_model` y `embedding_version` junto al vector. Nunca un vector "anónimo".
- **Nunca mezclar vectores de modelos distintos en la misma búsqueda**: la query se embebe con el mismo modelo que el corpus, o no se compara.
- **Interfaz `EmbeddingProvider` enchufable** (ya en Fundaciones) que registre modelo/versión y permita re-embeber por lotes.
- **Plan de re-embedding como operación de primera clase**: idempotente, reanudable, respetuoso de cuota Gemini. Asumir que ocurrirá al menos una vez.
- **Fijar dimensión del campo pgvector** al modelo elegido y documentar que cambiarla = migración.

**Warning signs:**
- La columna de vectores no tiene columna hermana de modelo/versión.
- Resultados de "proyectos similares" degradados tras un cambio de configuración de embeddings.
- Dos modelos de embeddings configurados en distintos momentos sin marca de cuál generó qué.

**Phase to address:**
**Fase 0 (Fundaciones)** define `EmbeddingProvider` con versionado. **P1 (Búsqueda semántica)** implementa el indexado con modelo/versión por vector y el plan de re-embedding reanudable.

---

### Pitfall 6: Infra free tier de Supabase que pausa y pierde datos

**What goes wrong:**
El proyecto Supabase **free** se **pausa tras 7 días sin actividad de base de datos**, tiene **500 MB de DB** y **cero backups** (verificado, jun 2026). Si se usa free en producción: (a) la tabla maestra de identidades — el activo más caro de reconstruir, fruto de revisión humana — puede perderse sin snapshot; (b) volcar el **crudo** (XML/JSON/HTML) en Postgres revienta los 500 MB en poco tiempo; (c) un periodo de baja actividad pausa el sitio público.

**Why it happens:**
- Empezar en free "para ahorrar" y no migrar a tiempo.
- Tratar Postgres como almacén de todo, incluido el crudo.
- Asumir que hay backups automáticos (no los hay en free).

**How to avoid:**
- **Plan Pro ($25/mes, 8 GB) es la línea base de producción**, no el free (Constraints). El free sirve solo para prototipado desechable.
- **El crudo NO va en Postgres**: todo XML/JSON/HTML a **Cloudflare R2**; Postgres solo modelo normalizado + vectores (entregable de Fundaciones).
- **Respaldar la tabla maestra de identidades FUERA de Supabase, sí o sí** (Constraints) — export periódico a R2/git/otro, porque es irreemplazable y el free no la respalda.
- **Pro elimina la pausa por inactividad y añade backups diarios** — razón adicional para no quedarse en free en producción.

**Warning signs:**
- Tamaño de DB acercándose a 500 MB (señal de crudo filtrándose a Postgres).
- Proyecto pausado tras vacaciones / baja actividad.
- No existe un job de export de la tabla de identidades fuera de Supabase.

**Phase to address:**
**Fase 0 (Fundaciones)** — separación crudo→R2 / normalizado→Postgres, y job de respaldo de identidades fuera de Supabase, son entregables de fundaciones. Migración a Pro antes de cualquier exposición pública.

---

### Pitfall 7: Cuotas de LLM agotadas y 429 ante ráfagas (extracción de fichas)

**What goes wrong:**
La extracción de idea matriz / cuerpos legales y la adjudicación de identidad disparan llamadas en ráfaga. **MiniMax** tiene **45k calls/semana** gratis; ante ráfagas devuelve **429**; sin backoff ni cola, el pipeline se cae o quema la cuota semanal de golpe, bloqueando lo crítico (adjudicación de identidad).

**Why it happens:**
- Procesar un backfill completo en paralelo sin throttling.
- No distinguir trabajo crítico (identidad) de trabajo de volumen (fichas) — la cuota crítica se gasta en volumen.
- Sin reintento, un 429 transitorio aborta el lote.

**How to avoid:**
- **Backoff exponencial + cola** ante 429 (mismo patrón que el WAF de scraping).
- **Separar pools por criticidad**: MiniMax (45k/sem) reservado para adjudicación de identidad (lo crítico/sensible); **DeepSeek V4 Flash para volumen** (extracción de fichas) con **prompt-cache** (Constraints). No gastar la cuota crítica en volumen.
- **Prompt-cache** para extracción de fichas reduce llamadas/costo.
- **Interfaz `LLMProvider` enchufable**: throttling y cuota gestionados en la capa, no por-caller. Modelo final elegido por benchmark sobre golden set.
- **Procesamiento por lotes reanudable**: un 429 pausa, no aborta.

**Warning signs:**
- Primer 429 en logs de LLM.
- Cuota semanal de MiniMax consumida a mitad de semana.
- Extracción de volumen tocando el pool crítico.

**Phase to address:**
**Fase 0 (Fundaciones)** define `LLMProvider` con throttling/cola/backoff y la separación de pools. **P1** lo ejercita con la extracción de fichas a escala.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Fuzzy-match automático de identidad sin revisión humana | Pipeline "cierra" rápido, demo impresiona | Afirmación falsa creíble = riesgo existencial #1 | **Nunca** |
| Volcar crudo (XML/HTML) en Postgres | Una sola base, menos piezas | Revienta 500 MB free; mezcla crudo con modelo; caro de separar después | **Nunca** (R2 desde día 1) |
| Quedarse en Supabase free en producción | $0/mes | Pausa a 7 días, sin backups, pierde tabla de identidades | Solo prototipo desechable |
| Embeddings sin columna de modelo/versión | Un campo menos | Re-embeder todo a ciegas al cambiar modelo; búsqueda contaminada | **Nunca** |
| Scraping en paralelo sin delay | Backfill más rápido | Bloqueo por WAF, pierde la fuente primaria | **Nunca** (rate-limiter serial obligatorio) |
| Hardcodear `buildId` del portal Next.js del Senado | Menos código | Se rompe en cada deploy del Senado | **Nunca** (autodetectar) |
| LLM que "interpreta"/conecta hechos en sus salidas | Texto más "rico" | Máquina de sospechas, exposición legal | **Nunca** |
| Mostrar datos con identidad en estado "candidato" + disclaimer | Más cobertura aparente | Un disclaimer no protege de un match falso publicado | **Nunca** (solo `confirmado` se muestra) |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Senado portal Next.js (citaciones, `__NEXT_DATA__`) | Cachear `buildId` >1 día / hardcodearlo | **Autodetectar `buildId` en cada corrida**; cambia por deploy. No cachear >1 día. |
| Cámara/Senado ASP.NET WebForms (`.aspx`, `citaciones_semana.aspx`) | Ignorar `__VIEWSTATE`/`__EVENTVALIDATION` | Capturar y reenviar los hidden fields del POST; el `__VIEWSTATE` es frágil y específico de la sesión/página. |
| Cualquier fuente gubernamental | Llamar desde el navegador (CORS) | **Todas las llamadas externas desde backend/Edge Functions**, nunca del navegador (Constraints). |
| Endpoints gubernamentales en general | Asumir esquema estable | Cambios de esquema **silenciosos**: validar esquema en cada ingesta (entregable Fundaciones), snapshot versionado, alertar ante drift. |
| Cámara `doGet.asmx` | Buscar voto individual por diputado ahí | **No está** (`Votos`=null); vive en `opendata.camara.cl` (sin validar). Bloquea P3, **no M1** — anotar como pendiente. |
| BCN/LeyChile | Usar `obtenerinfoley` | Obsoleto (404). Usar `obtxml?opt=7&idNorma={ID}`. |
| Senado `wspublico` | Usar `citaciones.php` | Da 404; citaciones van por el portal Next.js. |
| Gemini (embeddings) | Enviarle datos personales (nombres+RUT) | Gemini **solo embeddings de texto legislativo**; nunca dato personal (tier free entrena). |
| LLM de adjudicación de identidad | Usar tier que entrena con inputs | Tier sin entrenamiento + DPA (subencargado Ley 21.719). |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Scraping en ráfaga | 403/429, IP bloqueada | Cola serial + delay 2–3s + backoff | Al primer backfill completo en prod |
| DB free 500 MB con crudo dentro | DB creciendo rápido, cerca de 500 MB | Crudo a R2; Postgres solo normalizado+vectores | Pocas semanas de ingesta |
| Cuota LLM en ráfaga | 429, cuota semanal agotada a mitad de semana | Backoff+cola, pools separados por criticidad, prompt-cache | Backfill de fichas a escala |
| pgvector sin índice / dimensión mal fijada | Búsqueda semántica lenta o incomparable | Índice adecuado, dimensión = modelo elegido, versionar | Al crecer el corpus de textos |
| Re-embedding no reanudable | Re-embed quema cuota Gemini y no termina | Operación idempotente, por lotes, reanudable | Al primer cambio de modelo |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Exponer RUT / datos de familiares en API o frontend | Infracción Ley 21.719 (hasta 20.000 UTM / 4% ingresos); daño a personas | Minimización por diseño: uso interno, nunca capa pública (Out of Scope) |
| API keys de LLM/Supabase en el cliente o en git | Filtración de credenciales, abuso de cuota, costo | Todas las keys en `.env`/secrets del backend (Constraints), nunca en frontend |
| Enviar datos personales a LLM tier que entrena | Cesión no autorizada a subencargado sin DPA | Solo tiers sin entrenamiento + DPA para datos personales; Gemini solo texto legislativo |
| Tabla maestra de identidades sin respaldo externo | Pérdida del activo más caro (revisión humana) si Supabase free pausa/colapsa | Export periódico fuera de Supabase, sí o sí (Constraints) |
| Publicar dato con identidad no confirmada | Afirmación falsa creíble | Solo estado `confirmado` llega a capa pública |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Alertas/scores/grafos con framing acusatorio | Periodista publica un señalamiento injusto basado en correlación | Lenguaje neutro, hechos con fuente; nada de "conflicto"/"sospechoso"; diferir grafo (P6) |
| Adyacencia visual sugestiva (reunión junto a voto) | Insinúa causalidad que el dato no prueba | Cronología neutra con fuente; nunca redactar la conexión |
| Datos sin indicador de frescura por fuente | Usuario asume que un dato viejo es actual | Indicador de frescura por fuente en la ficha (entregable P2) |
| Datos sin trazabilidad (fuente/fecha/enlace) | Pierde el valor rector del producto y su defensa | Cada dato lleva fuente, fecha y enlace original (Core Value) |
| Mostrar match de identidad dudoso sin marca | Usuario confía en un dato potencialmente mal atribuido | No mostrar candidatos; solo confirmados |

## "Looks Done But Isn't" Checklist

- [ ] **Conector de scraping:** suele faltar el rate-limiter serial real (no por-conector) — verificar que un backfill completo respeta 2–3s entre requests y hace backoff ante 429/403.
- [ ] **Reconciliación de identidad:** suele faltar la compuerta de revisión humana y el golden set — verificar que ningún dato llega a público sin identidad `confirmada` y que el golden set corre como test de regresión.
- [ ] **Conector Senado citaciones:** suele faltar autodetección de `buildId` — verificar que sobrevive a un deploy del portal del Senado.
- [ ] **Conector `.aspx` Cámara:** suele faltar manejo de `__VIEWSTATE` — verificar que el POST reenvía los hidden fields.
- [ ] **Embeddings:** suele faltar columna de modelo/versión — verificar que cada vector sabe qué modelo lo generó y que existe plan de re-embedding reanudable.
- [ ] **Infra:** suele faltar el respaldo externo de identidades y la separación crudo→R2 — verificar export fuera de Supabase y que Postgres no contiene crudo.
- [ ] **Política de datos LLM:** suele faltar el mapeo "qué dato va a qué proveedor/tier" — verificar que ningún dato personal toca un tier que entrena.
- [ ] **Framing de UI:** suele "verse neutro" pero colar lenguaje causal — verificar copy y salidas de LLM contra la regla "sin intención ni causalidad".
- [ ] **Validación de esquema:** suele faltar la detección de drift silencioso — verificar que un cambio de esquema en la fuente alerta en vez de corromper en silencio.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Match de identidad equivocado publicado | **HIGH** (reputacional, posiblemente legal) | Corrección visible + auditoría de cómo pasó la compuerta + endurecer umbral + caso al golden set. Prevenir > recuperar. |
| Máquina de sospechas en producción | **HIGH** | Retirar el elemento de framing, comunicar, pasada legal. El daño reputacional puede ser irreversible. |
| Bloqueo por WAF | MEDIUM | Pausar ingesta de ese host, contactar (User-Agent identificado ayuda), bajar ritmo, esperar; rotar no es respetuoso. |
| Supabase free pausado / datos perdidos | MEDIUM (alto si no había respaldo) | Restaurar identidades desde respaldo externo; migrar a Pro; re-derivar normalizado desde crudo en R2. |
| Modelo de embeddings cambiado | MEDIUM | Re-embeber corpus completo con plan reanudable; invalidar índice viejo; verificar columna de versión. |
| Cuota LLM agotada | LOW | Esperar reset semanal / failover a otro provider del pool de volumen; nunca tocar el pool crítico. |
| Esquema de fuente cambió silenciosamente | MEDIUM | Snapshot versionado permite diff; reparar parser; re-procesar desde crudo en R2. |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Reconciliación de identidad (existencial #1) | **Fase 0** | Golden set corre como test; 0 datos públicos sin identidad `confirmada`; auditoría de cada match |
| Máquina de sospechas (existencial #2) | **Fase 0 (guardarraíl) + cada fase de frontend** | Revisión de copy y prompts contra regla "sin causalidad"; pasada legal pre-release |
| WAF / scraping en ráfaga | **Fase 0** | Backfill completo sin 403/429; rate-limiter serial demostrado |
| Datos personales / Ley 21.719 | **Fase 0 (política) + bloqueante pre-release (legal)** | Mapeo dato→proveedor/tier; 0 datos personales a tiers que entrenan; pasada legal |
| Embeddings sin versionar | **Fase 0 (interfaz) + P1 (indexado)** | Cada vector con modelo/versión; re-embedding reanudable probado |
| Infra free / pérdida de identidades | **Fase 0** | Crudo en R2 (no Postgres); export de identidades fuera de Supabase; Pro antes de público |
| Cuotas LLM / 429 | **Fase 0 (interfaz) + P1 (escala)** | Backoff+cola; pools separados; cuota crítica intacta tras backfill de volumen |
| `buildId` Senado / `__VIEWSTATE` / esquema | **P2 (conectores)** | Sobrevive a deploy del Senado; POST `.aspx` válido; validación de esquema alerta drift |
| `opendata.camara.cl` sin validar | **No M1 — anotar** | Pendiente que **bloquea P3** (voto individual por diputado); validar antes de milestone 2 |

## Sources

- `.planning/PROJECT.md` — endpoints validados en vivo al 17/06/2026, Documento Maestro v2.0, riesgos existenciales, constraints, marco legal (HIGH — fuente primaria del proyecto)
- [Ley Chile — Ley 21.719, BCN](https://www.bcn.cl/leychile/navegar?idNorma=1209272) — texto oficial (HIGH)
- [Guía práctica implementación Ley 21.719, Secretaría de Gobierno Digital](https://wikiguias.digital.gob.cl/datos-personales/guia-practica-implementacion-nueva-ley-datos-personales) — encargado/subencargado del tratamiento (HIGH)
- [Mirada Sur TV — vigencia diciembre 2026](https://miradasurtv.cl/la-nueva-ley-de-datos-personales-entra-en-vigencia-en-diciembre-lo-que-empresas-y-ciudadanos-deben-saber/) — confirma vigencia 1/12/2026 (MEDIUM)
- [Supabase Pricing](https://supabase.com/pricing) — free tier: 500 MB, pausa 7 días, sin backups; Pro $25 con backups diarios (HIGH)
- [Supabase free tier paused & lost data, SimpleBackups](https://simplebackups.com/blog/supabase-free-tier-paused) — pausa por inactividad y pérdida de datos sin backup (MEDIUM)
- Conocimiento de dominio: ASP.NET WebForms `__VIEWSTATE`, comportamiento de `buildId` de Next.js, espacios vectoriales de embeddings incompatibles entre modelos (MEDIUM — verificado con práctica establecida)

---
*Pitfalls research for: Observatorio ciudadano de datos públicos del Congreso de Chile*
*Researched: 2026-06-17*
