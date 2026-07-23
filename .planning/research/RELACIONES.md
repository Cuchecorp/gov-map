# RELACIONES entre parlamentarios — Auditoría + diseño

**Frente:** capa de relaciones (agregado por el operador a v10.0, 2026-07-23)
**Researched:** 2026-07-23
**Confianza global:** HIGH (audit contra código + DB viva; fuentes chilenas y precedentes verificados en vivo)

> Pregunta del operador: *"actualmente no se muestra nada [de relaciones] y creo que estamos perdiendo cosas — deberían aparecer si son del mismo partido, coalición, si votan parecido, si están en las mismas comisiones, etc."*

---

## 0. TL;DR — el hallazgo que cambia el diagnóstico

**"No se muestra nada" es en su mayoría FALSO en el código, pero VERDADERO en la experiencia.** Cuatro cross-links factuales ya viven en la ficha (mismo partido / misma zona / misma comisión / co-autoría). Lo que el operador percibe como "vacío" tiene tres causas concretas y arreglables:

1. **`/red` está 404 en producción** — `netPublicEnabled` está OFF (gate F17, firma legal humana pendiente). Toda la superficie de grafo es invisible. Y aun encendida, `/red` sólo dibuja **UN** tipo de arista: `co_lobby_contraparte`. No dibuja partido, comisión ni co-autoría (esos viven sólo en la ficha, como listas).
2. **Los cross-links de la ficha están enterrados** al fondo, después de todos los carriles de dominio, sin superficie de comparación 1-a-1 ni entrada desde el directorio. Son fáciles de no ver.
3. **"Si votan parecido" NO existe en ninguna parte** — es la ausencia REAL. Y aquí está el giro:

**El voto individual NO es thin. Está en la DB HOY.** El `<milestone_context>` dice "backfill LIVE pendiente (66/67), cobertura thin". La DB viva dice lo contrario:

| tabla | filas | detalle |
|---|---|---|
| `voto` | **548.642** | 282.577 confirmados |
| `voto` confirmado por parlamentario | **186/186** | TODOS tienen voto individual |
| `votacion` con votos individuales | **4.839** | ~3.700 votos/diputado |
| ejemplo overlap (D1170 vs D1165) | 3.667 compartidas | **3.650 coinciden (99,5%)** |

La similitud de votación es **trivialmente computable HOY** con SQL puro. No depende del backfill de v7.0. Lo que el `milestone_context` describe como pendiente (`opendata.camara.cl`, backfill 66/67) parece haber sido ejecutado o los datos entraron por otra vía (v3.0 "votaciones masivas" pobló `voto`). **VERIFICAR en la fase de datos, pero la evidencia de la DB viva es concluyente: el dato está.**

---

## 1. AUDIT — relación × dato × superficie (la brecha exacta)

Matriz de lo que existe, lo que se computa y DÓNDE se pierde. Cita a código/DB real.

| Relación | Dato fuente (tabla/RPC) | ¿Computable HOY? | ¿Se MUESTRA hoy? | Superficie donde falta |
|---|---|---|---|---|
| **Mismo partido** | `parlamentario_militancia.es_actual` + `partido_alias`; RPC `copartidarios_de_parlamentario` (0060/0061) | **SÍ** (186 militancias vigentes) | Sí — ficha, bloque "Del mismo partido" (page.tsx L320-333) | /red (no dibuja arista partido); directorio (no agrupa); comparación 1-a-1 (no existe) |
| **Misma comisión** | `comision_membresia` (386 filas) + `comision` (34); RPC `co_comisionados_de_parlamentario` | **SÍ** | Sí — ficha, "En la misma comisión" (L353-366) | /red (no dibuja arista comisión) |
| **Co-autoría de PL** | `proyecto_autor` (19.983 filas, 9.937 confirmadas); RPC `coautores_de_parlamentario` | **SÍ** | Sí — ficha, "Han co-firmado proyectos" (L369-382) | /red (no dibuja arista co-autoría) |
| **Misma zona (distrito/circ.)** | `parlamentario.distrito`/`circunscripcion`; RPC `de_la_misma_zona` | **SÍ** | Sí — ficha, "De la misma zona" (L336-349) | /red; comparación 1-a-1 |
| **Militancia histórica compartida** | `parlamentario_militancia` (363 filas, incl. `hasta`/tramos) | **SÍ** (falta RPC — hoy sólo militancia vigente) | **NO** — copartidarios usa sólo `es_actual` | ficha, /red, comparación |
| **Votan parecido (similitud)** | `voto` (548K), `votacion` (4.842); **falta RPC** | **SÍ (dato listo, métrica por diseñar)** | **NO — ausencia REAL** | TODAS las superficies |
| **Co-lobby (misma contraparte)** | `arista.co_lobby_contraparte` (7.394 aristas); RPC `subgrafo_red` (0030) | **SÍ** | Sólo en /red — y /red está **404** (NET OFF) | ficha (no aparece); comparación |
| **Misma coalición/pacto** | **NO EXISTE columna de pacto/coalición** en la DB | **NO** (requiere ingesta nueva) | NO | TODAS |

### Hallazgos load-bearing del audit

- **`/red` es de un solo tipo de arista.** `0030_net.sql` L22-31 y L69 (`check (tipo in ('co_lobby_contraparte'))`) fijan la taxonomía del MVP a UNA arista. `co_votacion` fue **excluido explícitamente** (L27-31): un roll-call de 155 confirmados produce N·(N-1)/2 ≈ 12.000 aristas → "telaraña conspirativa". `subgrafo_red` (L186) lee sólo esa arista. **Por eso /red ignora partido/comisión/co-autoría: nunca fueron materializados como aristas.** Añadir un tipo exige nueva migración (fricción intencional, L31).
- **`/red` está OFF y 404.** page.tsx L53 `if (!netPublicEnabled(process.env)) notFound();` como PRIMERA sentencia. `NET_PUBLIC_ENABLED` requiere sign-off F17 (17-LEGAL-DOSSIER). Con OFF, `co_votacion` de todos modos no existe.
- **Los cross-links tienen conteo honesto pero orden neutral estricto.** 0061 proyecta `total_n = count(*) over ()` ANTES del `limit 20` (WR-01). El orden es SIEMPRE alfabético por nombre, **nunca** por n_proyectos/afinidad (0061 L154, comentario "sería ranking de afinidad, prohibido"). LIMIT 20 bounded (DoS, Pitfall 12).
- **Ubicación de los cross-links = fácil de perder.** page.tsx L283-294: los cuatro bloques van DESPUÉS de todos los carriles de dominio (votos, lobby, patrimonio, cruces, dinero) y de las militancias. En una ficha de ~5.000px colapsada, están al fondo.
- **Data-quality en `partido`:** militancia vigente tiene ruido — un URI de BCN se filtró como valor de partido (`http://datos.bcn.cl/...democratas-chile`) y hay variantes sin normalizar ("Partido Renovación Nacional" vs "Renovación Nacional", "Partido Socialista" vs "Partido Socialista de Chile"). El match de copartidarios usa `partido_alias` (normalizado) → mitiga parte, pero el `partido` mostrado en la ficha puede verse inconsistente. **Higiene de `partido_alias` es prerrequisito de calidad para cualquier agregación de bloque.**

---

## 2. Relaciones derivables — exhaustivo (dato · computabilidad · riesgo insinuación)

### 2.1 Mismo partido — LIVE, mantener
- **Dato:** `parlamentario_militancia.es_actual`. **Computable:** sí. **Riesgo:** bajo (militancia es hecho público declarado; decisión operador 2026-07-21 lo hace dato esencial de accountability).
- **Acción:** ya está. Sólo higiene de `partido_alias` + exponer como arista en /red y como filtro en directorio.

### 2.2 Misma coalición/pacto — REQUIERE DATO NUEVO (no inventar)
- **NO hay columna de coalición.** Investigación de fuentes chilenas REALES:
  - **Servel — pactos electorales:** al inscribirse las listas, Servel registra los **pactos** ("Unidad por Chile", "Chile Grande y Unido", "Cambio por Chile", etc. para 2025→periodo 2026-2030). Es la fuente **factual y con fecha** de coalición por elección. Un pacto es un hecho jurídico registrado, no una inferencia. (Confianza MEDIUM: Servel no expone API REST limpia; es conector artesanal por elección, mismo perfil que SERVEL-dinero de v7.0.)
  - **Comités parlamentarios (Senado):** `senado.cl/senadores-y-senadoras/comites-parlamentarios` agrupa senadores en comités (p.ej. "RN e Independientes", "UDI", "PS"). Es la unidad orgánica **oficial** de bloque DENTRO de la cámara — más autoritativa que "coalición" difusa, con fuente. PERO: la página es una plantilla que carga la tabla vía JS (WebFetch la vio vacía) → scraping requiere el endpoint de datos o render. La Cámara tiene equivalente ("bancadas"). (Confianza MEDIUM.)
  - **BCN:** publica militancia (`datos.bcn.cl`, ya ingerido) pero **no** una entidad "coalición" estable y factual apta para cruce automático.
- **Recomendación:** coalición = **hecho registrado por fuente**, nunca derivado de "votan parecido". Dos rutas:
  1. **Pacto electoral (Servel)** — el más limpio jurídicamente ("se presentaron en el mismo pacto en la elección de 2025, según Servel"). Modelar `pacto_electoral(parlamentario_id, pacto, eleccion, origen, fecha_captura, enlace)`.
  2. **Comité/bancada (Senado/Cámara)** — el más operativo ("integran el mismo comité parlamentario"). Proxy de coalición vigente dentro de la cámara.
- **Riesgo insinuación:** BAJO si se rotula "según [fuente] al [fecha]". ALTO si se infiere coalición de patrones de voto (eso es lo que GovTrack retractó — ver 2.5).
- **Veredicto:** **requiere dato nuevo** → candidato a v10.0 sólo si la ingesta Servel/comités es abordable; si no, DIFERIR. No bloquea el resto.

### 2.3 Misma comisión — LIVE, mantener (386 membresías, 34 comisiones)
- **Dato:** `comision_membresia`. **Computable:** sí. **Riesgo:** bajo (integrar una comisión es hecho orgánico público). Ya en ficha; falta como arista /red.

### 2.4 Co-autoría de PL — LIVE, mantener (9.937 confirmadas, F48)
- **Dato:** `proyecto_autor` (confirmado). **Computable:** sí. **Riesgo:** bajo-medio. Co-firmar un boletín es un hecho registrado; el **orden por n_proyectos está prohibido** (0061 lo respeta: orden alfabético, n_proyectos como dato honesto, no criterio). Ya en ficha; falta como arista /red.

### 2.5 Votan parecido (similitud de votación) — LA AUSENCIA REAL, dato listo, métrica delicada

**Dato:** `voto` (548K filas, 186/186 parlamentarios con voto individual confirmado). **Computable HOY:** sí — el `<milestone_context>` la trata como pendiente de backfill v7.0, pero la DB viva la desmiente (verificar en fase de datos, evidencia concluyente).

**Precedentes (verificados en vivo) — qué EVITAR:**
- **VoteView / DW-NOMINATE:** produce un **score ideológico latente** (eje liberal-conservador) vía descomposición eigen de la matriz de acuerdo. Es exactamente el tipo de **derivación interpretativa** que la regla anti-insinuación del proyecto PROHÍBE ("posición jamás insinúa afinidad", F18). **NO replicar DW-NOMINATE.** Un eje ideológico es una opinión con forma de número.
- **GovTrack ideology score:** mide similitud de co-patrocinio y la llama "left-right". GovTrack mismo advierte que "no hay garantía de que el score tenga que ver con liberal/conservador — quizás mide popularidad o partidismo", y en 2024 **RETRACTÓ** sus report cards de un año por no confiables (fluctuación por datos limitados; llegó a rankear a Kamala Harris como "la más liberal"). **Precedente directo del riesgo:** un score de afinidad derivado de votos es frágil Y editorializante.

**Métrica DEFENDIBLE (factual, sin proyección):**
- **Acuerdo pairwise crudo, declarado, sin score-nombre:** "Coinciden en **N de M** votaciones en que ambos votaron" — N, M explícitos, jamás un porcentaje aislado presentado como "índice", jamás un ranking de "más afín".
- **Denominador honesto:** sólo votaciones donde **ambos** emitieron voto sustantivo (si/no/abstención); ausente/pareo excluidos del cómputo de coincidencia (espejo de la leyenda de voto existente: "ausente o pareo no equivalen a votar en contra").
- **CAVEAT DE BASE ALTA (crítico):** el ejemplo real dio 99,5% de coincidencia entre dos diputados. Muchísimas votaciones son casi-unánimes (de trámite/procedimiento). Un "coinciden en 3.650 de 3.667" sin contexto **insinúa** cercanía extrema que es sólo aritmética de votaciones triviales. La superficie DEBE declarar esto: "muchas votaciones son de trámite y casi unánimes; la coincidencia alta es la norma, no una señal". Sin ese caveat, la métrica miente por omisión.
- **Prohibido:** ordenar parlamentarios por % de coincidencia (ranking de afinidad); llamarlo "aliados"/"vota como"/"nivel de acuerdo" (ya vetados en el linter); proyectarlo a un eje/mapa 2D; colorear por cercanía.
- **Riesgo insinuación:** MEDIO-ALTO. Es la relación que el 17-LEGAL-DOSSIER §2 DIFIRIÓ. El operador HOY la pide explícitamente → entra **con diseño anti-insinuación + cobertura declarada + gate legal**. NO encender sin revisión legal humana (misma clase que MONEY/NET).

### 2.6 Misma zona — LIVE, mantener. Bajo riesgo (distrito/circunscripción son hechos electorales). Ya en ficha.

### 2.7 Co-lobby (misma contraparte) — LIVE en dato, invisible en superficie
- **Dato:** `arista.co_lobby_contraparte` (7.394 aristas materializadas). **Computable:** sí. **Se muestra:** sólo en /red, que está 404. **Riesgo:** MEDIO — "ambos recibieron audiencia de la misma contraparte" es factual, pero yuxtaponer parlamentarios por contraparte de lobby es precisamente lo que puede leerse como insinuación. Vive detrás del gate NET (F17) por esa razón.
- **Limitación conocida (0030 L120-126):** el join es por `lower(trim(nombre))` de contraparte (no hay `contraparte_id` autoritativo) → no funde variantes ("Fundación X" vs "Fundacion X A.G.") ni distingue homónimos. Sobre/sub-cuenta. La `entidad_tercero` maestra (v4.0) tensaría esto pero no está cableada a las aristas.

### 2.8 Militancia histórica compartida — DATO listo, RPC faltante
- **Dato:** `parlamentario_militancia` tiene 363 filas con `hasta`/tramos (vs 186 vigentes) → hay historia. **Computable:** sí, pero el RPC actual (`copartidarios`) filtra `es_actual`. **Riesgo:** bajo. **Acción:** RPC nuevo "compartieron partido en el pasado (desde X hasta Y)" con ventana temporal explícita.

---

## 3. Superficies — dónde mostrar

### Estado actual
- **Ficha** (`/parlamentario/[id]`): 4 cross-links al FONDO (L283-294). Funcional pero enterrado. Enlace gated a `/red?seed=` (L253, OFF).
- **/red** (`/red`): ego-network radial, seed + vecinos, **una arista** (co-lobby), **404 en prod** (NET OFF).
- **Comparación 1-a-1:** **NO EXISTE.**

### Qué hacen los comparables
- **TheyWorkForYou (UK):** NO grafo. Por diputado: "votó a favor de X, en contra de Y" en temas, con enlace a cada división. Enfoque en **hechos de voto rastreables**, no en scores de afinidad. Modelo a seguir para el framing factual.
- **VoteView:** mapa 2D ideológico (DW-NOMINATE) — **anti-modelo** para este proyecto (derivación interpretativa prohibida).
- **abgeordnetenwatch (DE):** perfil por diputado con votaciones y respuestas; comparación por tema, no score global de "aliados".
- **Consenso:** los buenos exponen **votos concretos con fuente**; los riesgos (VoteView/GovTrack) **derivan un número de ideología** — el que este proyecto tiene prohibido.

### Recomendación de superficies (v10.0)
1. **Ficha — subir y agrupar los cross-links** en un bloque "Relaciones con otros parlamentarios" MÁS ALTO (tras la bio, antes de los carriles densos), con la leyenda anti-insinuación ya existente (`LEYENDA_CROSS_LINK`). Añadir el eje "votan parecido" (gated) y "militancia histórica compartida". Cero ranking.
2. **Directorio (`/parlamentarios`)** — filtro por partido (el listado v2 ya trae `partido`); agrupación factual, no por afinidad.
3. **Comparación 1-a-1 (NUEVA, la de mayor valor)** — `/comparar?a=D1&b=D2`: dos parlamentarios lado a lado, ejes FACTUALES: mismo/distinto partido, comisiones compartidas, boletines co-firmados (lista), zona, y "coinciden en N de M votaciones" (gated + caveat base-alta). Es la superficie que responde directo "¿se parecen?" sin construir un grafo insinuante. Espejo del comparativo de ausencias que ya existe (VIZ-COMP, RPC PII-safe).
4. **/red — añadir tipos de arista con leyenda** SÓLO tras encender NET (F17). Nueva migración por cada tipo (partido/comisión/co-autoría/co-lobby) con su color/leyenda; **co_votacion NO va a /red** (explosión de clique, 0030 L27) — la similitud de voto vive en la comparación 1-a-1, no en el grafo.

---

## 4. Anti-insinuación aplicada

### Framing factual por relación (VETADO ↔ CORRECTO)
| Relación | ❌ Prohibido | ✅ Factual |
|---|---|---|
| Partido | "aliado de", "del bloque de" | "Comparte el partido de la militancia vigente (según BCN al [fecha])" |
| Coalición | "coalición", "alianza con" (si derivado) | "Se presentaron en el mismo pacto en la elección 2025 (Servel)" / "Integran el mismo comité parlamentario" |
| Comisión | "coordina con", "afín en la comisión" | "Comparten al menos una comisión: [nombre]" |
| Co-autoría | "impulsan juntos", ranking por n° | "Han co-firmado al menos un proyecto (N boletines)", orden alfabético |
| Votan parecido | "vota como", "nivel de acuerdo", "afín", score, ranking, mapa ideológico | "Coinciden en N de M votaciones en que ambos votaron. Muchas votaciones son de trámite y casi unánimes." |
| Co-lobby | "conexión", "vínculo con" | "Ambos recibieron audiencia de [contraparte] (leylobby)" |

### Reglas duras (LOCKED)
- **Orden SIEMPRE neutral** (alfabético). Nunca por conteo/coincidencia/afinidad → ordenar = rankear afinidad.
- **Conteo honesto** (`total_n` antes del cap, patrón 0061).
- **La similitud de voto NUNCA se proyecta** a eje/mapa/score. N y M explícitos. Caveat base-alta obligatorio.
- **Leyenda anti-causal** una vez por superficie (`CAVEAT_RAIL`, `LEYENDA_CROSS_LINK` ya existen).

### Vocabulario a VETAR en el linter (`anti-insinuacion-guard.test.ts`)
Ya vetados y reutilizables: `aliado`, `cercano a`, `bloque de`, `afín`, `coordina con`, `afinidad`, `alineado/a`, `vota como`, `votan como`, `similar a`, `nivel de acuerdo`, `score`, `ranking`, `índice`, `puntaje`, `mediana de su cámara`.

**Añadir para el eje de similitud de voto** (nuevos idioms de alto riesgo):
- `"votan igual"`, `"votan juntos"`, `"vota parecido"`, `"votan parecido"`, `"coinciden siempre"`, `"casi siempre coincide"`, `"tasa de coincidencia"`, `"porcentaje de afinidad"`, `"índice de coincidencia"`, `"votante afín"`, `"cercanía de voto"`, `"aliados en la votación"`, `"bancada de facto"`, `"coalición de facto"`, `"eje ideológico"`, `"mapa de afinidad"`, `"más cercano"`, `"más afín"`.
- Añadir las superficies nuevas al scan: `components/comparar-*.tsx`, `app/comparar/page.tsx`, y el/los componente(s) de "relaciones agrupadas" de la ficha.
- Registrar en `NEGACIONES_LOCKED` la nueva leyenda del eje de similitud (contendrá "coincidencia"/"afinidad" NEGÁNDOLAS → si no se resta, el guard se auto-caza — lección BLOCKER 91).

---

## 5. Fase final E2E (pedido: "asegúrate que todo funciona en una fase final")

Inventario a verificar: **cada superficie de relación × dato real × BrowserOS**.

| Verificación | Cómo |
|---|---|
| Ficha: 4 cross-links renderizan con datos reales | Elegir un parlamentario con N>0 en cada eje (D1170 tiene voto+comisión+co-autoría); confirmar conteo honesto (`total_n`) y truncamiento visible si >20 |
| Ficha: bloque "relaciones" reubicado above-the-fold | BrowserOS lectura fría — ¿se ve sin scroll profundo? |
| Comparación 1-a-1 (si entra): `/comparar?a=&b=` con dos reales | Ejes factuales correctos; "N de M votaciones" con caveat base-alta visible; sin ranking |
| Similitud de voto: número correcto contra SQL | Recalcular N/M en SQL y comparar con la superficie (el ejemplo D1170/D1165 = 3.650/3.667) |
| Gate legal del eje de voto | Con flag OFF (default) la superficie de similitud **ausente del DOM** (espejo NET/MONEY); ON sólo tras firma |
| /red (si NET encendido): aristas por tipo + leyenda | Cada tipo con color/leyenda; co_votacion AUSENTE; seed sin vecinos = estado honesto no error |
| Linter anti-insinuación verde | `pnpm test` — nuevos términos vetados + nuevas superficies escaneadas + mutation self-check muerde |
| Empty states honestos | Parlamentario con N=0 en un eje → bloque omitido o "sin registros", nunca dígito fabricado |
| Data-quality partido | Ninguna ficha muestra el URI de BCN como partido; variantes de nombre no fragmentan copartidarios |

---

## 6. Build order (v10.0 vs dependencias)

**Entra en v10.0 sin bloqueo (dato listo, bajo riesgo):**
- Reubicar/agrupar los 4 cross-links de la ficha (partido/zona/comisión/co-autoría) más arriba.
- RPC + bloque "militancia histórica compartida" (dato en `parlamentario_militancia`, RPC nuevo).
- Filtro por partido en el directorio.
- Comparación 1-a-1 con ejes NO-voto (partido, comisiones, co-autoría, zona).
- Higiene de `partido_alias` / limpieza del URI-como-partido (prerrequisito de calidad).

**Entra en v10.0 CON diseño anti-insinuación + gate legal (dato listo, riesgo medio-alto):**
- Similitud de votación "N de M" en la comparación 1-a-1, detrás de flag deny-by-default (nueva firma legal, clase NET/MONEY). **NO depende del backfill v7.0** — el dato ya está (VERIFICAR en fase de datos como primer paso). El 17-LEGAL-DOSSIER §2 lo difirió; el operador lo re-pide → requiere dossier/sign-off nuevo.

**DIFERIR salvo que la ingesta sea abordable:**
- Coalición/pacto (Servel) o comité/bancada (Senado/Cámara) — **requiere ingesta nueva** (conector artesanal, mismo perfil frágil que SERVEL-dinero). No inventar coalición desde votos. Si no cabe en v10.0, dejar como el único hueco declarado honesto.

**Sólo tras F17 (firma humana, NO un agente):**
- Encender `/red` y ampliar sus aristas (partido/comisión/co-autoría/co-lobby con leyenda). `co_votacion` NUNCA va al grafo (explosión de clique).

**Dependencia explícita del backfill de votos:** **NINGUNA para computar similitud** — la DB tiene 548K votos, 186/186 parlamentarios. El único paso previo es VERIFICAR en la fase de datos que `voto.estado_vinculo='confirmado'` cubre las votaciones esperadas y que la reconciliación de identidad no fabrica votantes. El gate que sí aplica es LEGAL (sign-off), no de datos.

---

## Sources
- Audit contra código: `app/app/parlamentario/[id]/page.tsx`, `app/app/red/page.tsx`, `supabase/migrations/0030_net.sql`, `0060_bio_partido_publico.sql`, `0061_cross_links_conteo_honesto_orden.sql`, `0009`/`0028` (voto), `0021` (lobby), `app/lib/anti-insinuacion-guard.test.ts` — HIGH
- DB viva (Supabase nube, `psql` 2026-07-23): conteos de `voto`/`votacion`/`proyecto_autor`/`comision_membresia`/`arista`/`parlamentario_militancia`; overlap de coincidencia D1170/D1165 — HIGH
- [Elecciones parlamentarias de Chile de 2025 — Wikipedia](https://es.wikipedia.org/wiki/Elecciones_parlamentarias_de_Chile_de_2025) / [Listas, pactos y partidos 2025 — CSL](https://cslatinoamericana.org/las-listas-pactos-y-partidos-politicos-confirmados-para-las-elecciones-parlamentarias-de-chile-de-2025/) — pactos electorales Servel como fuente factual de coalición — MEDIUM
- [Comités parlamentarios — Senado](https://www.senado.cl/senadores-y-senadoras/comites-parlamentarios) — comité como bloque orgánico oficial (tabla JS-render, requiere endpoint de datos) — MEDIUM
- [GovTrack Analysis Methodology](https://www.govtrack.us/about/analysis) / [GovTrack retractó los report cards de un año](https://www.govtrack.us/posts/434/2024-07-26_we-retracted-our-single-year-legislator-report-cards-after-warning-about-their-unreliability) — precedente: score de afinidad derivado de votos es frágil y editorializante — HIGH
- [Voteview / DW-NOMINATE about](https://voteview.com/about) — anti-modelo: score ideológico latente (derivación interpretativa prohibida por F18) — HIGH
