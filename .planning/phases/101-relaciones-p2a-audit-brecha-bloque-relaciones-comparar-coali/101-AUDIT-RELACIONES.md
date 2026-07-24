# 101 — AUDITORÍA de brecha de RELACIONES (gate de diseño de Plan 02/03)

**Fase:** 101-relaciones-p2a-audit-brecha-bloque-relaciones-comparar-coali
**Re-medición:** 2026-07-24 (Plan 01)
**Fuente de las cifras DB:** psql `-tA` directo contra PROD (`$SUPABASE_DB_URL` de `.env`, `PGCLIENTENCODING=UTF8`). **NUNCA vía REST del sitio** (cap 1k PostgREST subestimaría — Pitfall 4 del research, precedente 93).
**Principio rector:** **dato-disponible vs superficie-mostrada, cobertura declarada NUNCA presentada como completa.** Cada relación declara su N/M y dónde se muestra hoy. Los conteos son **datos, jamás sort keys** (anti-ranking T-52-13 LOCKED). Ausencia declarada, nunca fabricada.

> Espejo del patrón validado en v9.0 `93-AUDITORIA-CITACIONES.md`: secciones medibles, matriz N/M re-medida con psql verbatim CERO deriva vs research, probes con veredicto CONFIRMADO/REFUTADO, correcciones RULE-1 documentadas.
>
> Este audit **GATEA** el diseño de los planes UI: sus N/M alimentan el copy de cobertura declarada de **Plan 02** (bloque relaciones en la ficha) y **Plan 03** (`/comparar` + militancia histórica + 5º bloque).

---

## 0. Cómo reproducir

Todas las queries de §1–§4 corren:

```
PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" -tA -c "<query>"
```

`$SUPABASE_DB_URL` vive en `.env` (no versionado). El probe de coalición (§5) corre con `curl` (User-Agent identificatorio, rate-limit 2–3s entre requests, respeto robots.txt) — **CERO write a PROD ni a R2** en toda esta auditoría.

---

## 1. MATRIZ N/M POR RELACIÓN (REL-01)

**Dato-disponible** = filas/pares reales medidos por psql. **Superficie-mostrada-hoy** = dónde y cómo aparece en la app hoy (posición real, estado del wiring). Todos los números de abajo son de la corrida **2026-07-24**; se anota **CONFIRMADO** cuando coincide con el snapshot del research, o **RULE-1** cuando difirió y se corrigió.

### 1.1 Militancia base (insumo de partido + militancia histórica)

Queries verbatim + resultado real:

```sql
select count(*) from parlamentario_militancia;                          -- 363
select count(distinct parlamentario_id) from parlamentario_militancia;  -- 186
select count(*) from parlamentario_militancia where es_actual=false;    -- 177  (histórico)
```

```
363
186
177
```

**CONFIRMADO** (research: 363 / 186 / 177). Promedio 1,95 militancias por parlamentario. La cifra "315 dip + 48 sen" del CONTEXT era phrasing stale; el total 363 sobre 186 distintos es el correcto.

### 1.2 Matriz N/M — las 5 relaciones + zona

| Relación | Dato-disponible (N, psql) | Superficie-mostrada-HOY | Veredicto |
|----------|---------------------------|--------------------------|-----------|
| **Del mismo partido** (militancia vigente) | 186 parlamentarios con militancia; alias vigente agrupa copartidarios | RPC `copartidarios_de_parlamentario` (0061) **montada** en la ficha `app/app/parlamentario/[id]/page.tsx:284` (`<CrossLinkCopartidarios>`), `total_n` honesto, orden neutral, límite visual 8, WR-01/02/05 | **MOSTRADA** (bloque vivo, conteo honesto) |
| **De la misma zona** | **diputados 155 → 0 con distrito/circ/región**; senado **31 → 31 circ/región** (ver §2) | RPC `de_la_misma_zona` (0061) **montada** en `page.tsx:287` (`<CrossLinkMismaZona>`) — pero **rinde 0 para el 100 % de la Cámara** | **MOSTRADA pero SOLO-Senado** (headline §2) |
| **Co-comisionados** | 386 membresías / 34 comisiones (§1.3) | RPC `co_comisionados_de_parlamentario` (0061) **montada** en `page.tsx:290` (`<CrossLinkCoComisionados>`) | **MOSTRADA** |
| **Co-autoría** | 9.937 vínculos `proyecto_autor` confirmados (§1.4) | RPC `coautores_de_parlamentario` (0061) **montada** en `page.tsx:293` (`<CrossLinkCoautores>`); count-only por par (no lista de boletines compartidos) | **MOSTRADA** (sin lista de boletines por par → decisión Plan 03) |
| **Militancia histórica compartida** | **any=1966 · actual=1270 · net-new=696 pares** (§4) | **NO MOSTRADA HOY** — `militancias_de_parlamentario` (0060) emite `partido` display (≠ `partido_alias`), no cruzable por par → requiere RPC nueva `militancia_historica_compartida` (0067) | **ENTERRADA** (canal nuevo = Plan 03) |
| **Lobby misma contraparte** | `contraparte_id` NOT NULL = **0 de 17.681**; name-match fallback = **3.749 pares / 134 parl** (§3) | **NO MOSTRADA** (identidad de contraparte sin resolver) | **DIFERIDA** por default (§3) |
| **Coalición / pacto** | Servel: 5 pactos formalizados 2025 (party-level, §5) | **NO MOSTRADA** (sin ingesta) | **VIABLE Servel / DIFERIDA comités-Senado** (§5) |

**Anti-ranking:** los N de arriba son cobertura, NO afinidad. Ningún bloque se ordena por `n_proyectos`/`total_n` — el orden lo emite la RPC en alfabético (T-52-13 LOCKED).

### 1.3 Comisiones — membresías y comisiones distintas

```sql
select count(*) as membresias from comision_membresia;   -- 386
select count(*) as comisiones from comision;             -- 34
```

```
386
34
```

**CONFIRMADO** (research: 386 / 34).

### 1.4 Co-autoría — vínculos confirmados

```sql
select count(*) from proyecto_autor where estado_vinculo='confirmado';   -- 9937
```

```
9937
```

**CONFIRMADO** (research: 9.937). Nota: el count por par entre A y B es derivable de `coautores_de_parlamentario(A)` (que retorna B con `n_proyectos`), pero la **lista de boletines compartidos con enlace** NO la retorna la RPC vigente → si Plan 03 la quiere, decide una RPC `boletines_compartidos(a,b)` (Claude's Discretion, CONTEXT).

---

## 2. HALLAZGO ZONA-GAP (headline — REL-01)

Query verbatim:

```sql
select camara, count(*) total, count(distrito) con_distrito,
       count(circunscripcion) con_circ, count(region) con_region
  from parlamentario group by camara;
```

Resultado real (2026-07-24):

```
diputados|155|0|0|0
senado|31|0|31|31
```

| Cámara | Total | con distrito | con circunscripción | con región |
|--------|-------|--------------|---------------------|------------|
| **diputados** | 155 | **0** | **0** | **0** |
| **senado** | 31 | 0 | 31 | 31 |

**CONFIRMADO** (research). **Declaración honesta:** `de_la_misma_zona` **rinde 0 para los 155 diputados** — `distrito`, `circunscripcion` y `region` son NULL para el 100 % de la Cámara. El eje **zona es SOLO Senado (31)**.

- **NO se fabrica distrito.** No se infiere zona a partir de ningún otro campo.
- **NO es un bug de la RPC** (Pitfall 2): la RPC casa por distrito/circunscripción no-null → senadores solamente. "Arreglar la RPC" sería un error.
- **Cámara-zona = tarea de INGESTA** (poblar `distrito`/`region` de los 155 diputados desde la fuente de la Cámara) — **fuera del alcance de Phase 101**. Se registra como **Future Requirement** (ingesta de zona de la Cámara).
- **Consecuencia para Plan 02/03:** el bloque "De la misma zona" en la ficha aparece SOLO en fichas de senador; en `/comparar`, dos diputados dan siempre "no comparten zona" (**vacío honesto declarado**, jamás presentado como "sin relación"). El copy de cobertura debe declarar "eje disponible solo para senadores en las fuentes consultadas al 2026-07-24".

---

## 3. DECISIÓN LOBBY-MISMA-CONTRAPARTE (REL-04)

### 3.1 `contraparte_id` es 100 % NULL

```sql
select count(*) filter (where contraparte_id is not null) as con_id,
       count(*) as total from lobby_contraparte;
```

```
0|17681
```

**CONFIRMADO** (research). **0 de 17.681** filas de `lobby_contraparte` tienen `contraparte_id` no-null → **la resolución de identidad de contrapartes NUNCA corrió.** El supuesto del CONTEXT ("`contraparte_id` confirmadas") es **factualmente falso** y queda REFUTADO aquí.

### 3.2 Fallback por nombre normalizado

```sql
with pa as (
  select distinct la.parlamentario_id, lower(trim(lc.nombre)) cp
  from lobby_audiencia la join lobby_contraparte lc on lc.identificador=la.identificador
  where la.estado_vinculo='confirmado' and trim(coalesce(lc.nombre,''))<>'' and la.parlamentario_id is not null),
pairs as (
  select distinct least(x.parlamentario_id,y.parlamentario_id) a,
         greatest(x.parlamentario_id,y.parlamentario_id) b
  from pa x join pa y on y.cp=x.cp and y.parlamentario_id<>x.parlamentario_id)
select count(*) as pares from pairs;
-- parlamentarios distintos involucrados:
select count(distinct pid) from (select a pid from pairs union select b pid from pairs) u;
```

Resultado real (2026-07-24):

```
3749       -- pares
134        -- parlamentarios distintos
```

**RULE-1 (corrección de snapshot):** research decía **3.749 pares / 136 parl**; la re-corrida da **3.749 pares / 134 parlamentarios distintos**. Los pares CONFIRMAN idénticos (3.749); el conteo de parlamentarios se corrige a **134** (el snapshot 136 del research contaba con una variante de la query; el conteo simétrico union(a,b) da 134). El universo M de audiencias confirmadas es **5.106** (`select count(*) from lobby_audiencia where estado_vinculo='confirmado'` → `5106`, CONFIRMADO).

### 3.3 Top-15 contrapartes compartidas (inspección de provenance)

```sql
with pa as (
  select distinct la.parlamentario_id, lower(trim(lc.nombre)) cp
  from lobby_audiencia la join lobby_contraparte lc on lc.identificador=la.identificador
  where la.estado_vinculo='confirmado' and trim(coalesce(lc.nombre,''))<>'' and la.parlamentario_id is not null)
select cp, count(distinct parlamentario_id) n_parl
from pa group by cp having count(distinct parlamentario_id)>1
order by n_parl desc, cp limit 15;
```

Resultado real (2026-07-24):

```
fundación derecho y defensa animal|40
cge s.a.|31
felipe von muhlenbrock|29
fundacion ronda|25
cámara chilena de centros comerciales a.g.|24
cámara chilena de la construcción|21
movimiento comunidad y maternidad|21
corporación comunidad y justicia|20
cge s.a|19
cge|18
fundación escazú ahora|18
camila galván|16
fundación skansen|16
cámara nacional de comercio|15
compañía general de electricidad|15
```

**Evidencia de conflación (riesgo #1 del proyecto).** La misma entidad **CGE** aparece fragmentada en **cuatro** filas distintas por nombre: `cge s.a.` (31), `cge s.a` (19), `cge` (18) y `compañía general de electricidad` (15). El name-match las trataría como cuatro contrapartes diferentes (o, con normalización agresiva, las fusionaría con riesgo de falsos positivos). También hay **nombres de personas naturales** (`felipe von muhlenbrock`, `camila galván`) que no son organizaciones — provenance frágil.

### 3.4 VEREDICTO — DIFERIDA por default

> **DECISIÓN TOMADA: la relación "lobby misma contraparte" queda DIFERIDA.**

Fundamento (con N):
- `contraparte_id` = **0 / 17.681** → **identidad no resuelta**; no existe una clave estable para afirmar "misma contraparte" como hecho.
- El fallback por nombre da **3.749 pares / 134 parl**, pero la evidencia §3.3 muestra **conflación** (CGE en 4 grafías) → shippear "misma contraparte" sobre nombres crudos **insinuaría** un vínculo que la fuente no sostiene con identidad.
- **NO se shippea name-match sin decisión explícita del operador.** Ambas rutas quedan documentadas (DIFERIDA + query name-based reproducible arriba) para que el operador decida con evidencia. Si el operador aceptara la provenance por nombre, se requiere primero una **normalización de contraparte** (colapsar variantes CGE) + framing factual "audiencias registradas con la misma contraparte por nombre declarado", nunca "vínculo".
- Mitiga T-101-02 (integridad / conflación) del threat model.

**Consecuencia para Plan 02/03:** la relación lobby-misma-contraparte **NO** entra al bloque relaciones ni a `/comparar` en esta pasada. Queda como Future Requirement gated a (a) resolución de identidad de contraparte o (b) decisión operador + normalización.

---

## 4. MILITANCIA HISTÓRICA — NET-NEW vs SHARED-EVER (REL-04)

Query verbatim (pares por `partido_alias`, la clave correcta — Pitfall 1):

```sql
with actual_pairs as (
  select distinct least(m1.parlamentario_id,m2.parlamentario_id) a,
         greatest(m1.parlamentario_id,m2.parlamentario_id) b
  from parlamentario_militancia m1 join parlamentario_militancia m2
    on m2.partido_alias=m1.partido_alias and m1.es_actual and m2.es_actual
   and m2.parlamentario_id<>m1.parlamentario_id),
any_pairs as (
  select distinct least(m1.parlamentario_id,m2.parlamentario_id) a,
         greatest(m1.parlamentario_id,m2.parlamentario_id) b
  from parlamentario_militancia m1 join parlamentario_militancia m2
    on m2.partido_alias=m1.partido_alias and m2.parlamentario_id<>m1.parlamentario_id)
select (select count(*) from any_pairs), (select count(*) from actual_pairs),
       (select count(*) from any_pairs)-(select count(*) from actual_pairs);
```

Resultado real (2026-07-24):

```
1966|1270|696
```

| Métrica | N | Significado |
|---------|---|-------------|
| `any_pairs` (shared-ever) | **1.966** | pares que comparten militancia por `partido_alias` en CUALQUIER momento (vigente o histórico) |
| `actual_pairs` | **1.270** | pares que comparten el **alias VIGENTE** (= el bloque "Del mismo partido") |
| **net-new** (`any − actual`) | **696** | pares que **SOLO** comparten militancia **histórica** (no comparten el partido vigente) |

**CONFIRMADO** (research: 1966 / 1270 / 696).

### 4.1 Evidencia Pitfall 1 (display ≠ alias)

```sql
select partido, count(distinct partido_alias) from parlamentario_militancia
  group by partido having count(distinct partido_alias)>1;
```

```
Partido Demócrata Cristiano|2
Partido Liberal de Chile|2
Partido Por la Democracia|2
```

**CONFIRMADO.** Tres partidos (DC, Liberal, PPD) mapean **un display a dos `partido_alias`** → cruzar por el string `partido` (display) daría resultados silenciosamente mal. La RPC nueva `militancia_historica_compartida` (0067) DEBE casar por `m2.partido_alias = m1.partido_alias` server-side, y **NUNCA** exponer `partido_alias` (interno) — emitir solo id/nombre/camara.

### 4.2 N LOCKED para el copy downstream

> **RECOMENDACIÓN LOCKED: net-new-only = 696 pares.**

El 5º bloque de la ficha y el eje de militancia de `/comparar` usan **net-new (696)**: pares que SOLO comparten militancia histórica, **excluyendo** los que ya comparten el alias vigente (= el bloque "Del mismo partido", 1.270). Así el 5º bloque **añade información** que el bloque copartidarios no da (evita duplicar). Este **N = 696** es el que alimenta el copy de cobertura declarada de Plan 02 (5º bloque) y Plan 03 (eje /comparar). El shared-ever (1.966) queda documentado como alternativa si el operador prefiriera "cualquier militancia compartida", pero **no es la recomendación** (duplicaría copartidarios).

---

## 5. COALICIÓN (REL-05) — probe empírico

**Regla LOCKED:** coalición **JAMÁS inferida desde votos**. El probe evalúa SOLO fuentes oficiales declaradas. **Protocolo:** curl-first con User-Agent identificatorio (`ObservatorioCongreso360/1.0 (+https://gov-map.com; contacto <redacted>)`), rate-limit 2–3s entre requests, robots.txt respetado, NUNCA ráfaga. **CERO write a PROD ni a R2** — solo lectura/evidencia.

**Criterio de viabilidad por fuente:** (1) fuente oficial estable (URL responde, formato parseable) + (2) machable a parlamentarios por nombre determinista.

### 5.1 Fuente A — Servel pactos parlamentarios 2025 · **VIABLE**

Evidencia cruda:

```
curl -sS -A "$UA" "https://www.servel.cl/2025/08/19/pactos-elecciones-parlamentarias-2025/"
→ HTTP=200  SIZE=144473  CT=text/html; charset=UTF-8   (WordPress)

robots.txt (https://www.servel.cl/robots.txt → HTTP=200):
  User-agent: *  Disallow: /feed /trackback /wp-admin /wp-content /wp-includes /wp-.
  → la ruta /2025/... NO está en Disallow → scraping permitido
```

Contenido factual extraído del cuerpo del artículo (texto plano, HTML estable):

```
"El sábado 16 de agosto, concluyó el plazo para el proceso de formalización de pactos
 ante el Servicio Electoral para las Elecciones Parlamentarias del 16 de noviembre.
 Hasta esa fecha fueron oficializados los siguientes pactos:"

1. Cambio por Chile — Partido Republicano de Chile, Partido Nacional Libertario,
   Partido Social Cristiano e Independientes.
2. Izquierda Ecologista Popular Animalista y Humanista — Partido Humanista, Igualdad e Independientes.
3. Unidad por Chile — Partido Socialista de Chile, Frente Amplio, Partido Comunista de Chile,
   Partido Demócrata Cristiano, Partido Liberal de Chile, Partido por la Democracia,
   Partido Radical de Chile e Independientes.
4. Chile Grande y Unido — Renovación Nacional, Unión Demócrata Independiente,
   Evolución Política, Partido Demócratas Chile e Independientes.
5. Verdes, Regionalistas y Humanistas — Federación Regionalista Verde Social,
   Partido Acción Humanista e Independientes.
```

**Veredicto VIABLE:**
- (1) fuente oficial estable ✓ — servel.cl, 200 OK, HTML plano parseable con cheerio, robots-allowed.
- (2) machable determinista ✓ — los pactos son **party-level** (listan partidos, no personas). Se mapean a parlamentarios vía la militancia existente (`parlamentario_militancia.partido` / `partido_alias`): los nombres de partido del pacto (Republicano, Frente Amplio, PDC, Liberal, PPD, RN, UDI, Evópoli, etc.) casan con los displays de militancia vigente. El eslabón "Independientes" **no** es machable a un parlamentario específico (declarado como límite honesto: un independiente en un pacto no queda cubierto por el mapeo party→miembro).

**Ruta de ingesta dos-etapas R2 recomendada (NO ejecutada en este plan):**
- **Etapa 1 — fuente → R2 crudo, content-addressed:** `servel/pactos/2025/<fecha>/<sha256>.html` (PUT `If-None-Match: *`; 412 = ya existía = éxito idempotente). Guardar el HTML crudo del artículo.
- **Etapa 2 — R2 → Supabase:** parsear desde R2 (cheerio) → tabla `coalicion_pacto` (pacto, partido) + derivar `parlamentario × pacto` por join con militancia vigente. Cobertura declarada: "pactos formalizados ante Servel para las Parlamentarias 2025; independientes no mapeados".
- Backfill = **LOCAL** (operador), no GH Actions (convención 4). Sin cron (dato estático por elección).
- Queda como **recomendación para el operador / plan futuro** — NO se ejecuta aquí.

### 5.2 Fuente B — Comités del Senado · **DIFERIDA (bloqueo de red)**

Evidencia cruda:

```
curl "https://www.senado.cl/senadores/comites"  (sin -L)
→ HTTP/1.1 301 Moved Permanently
   Location: https://sitio.senado.cl/senadores/comites

curl -L "https://sitio.senado.cl/senadores/comites"
→ curl (6) Could not resolve host: sitio.senado.cl        (DNS falla en el egress del conector)

getent hosts sitio.senado.cl → 200.28.4.130
curl --resolve sitio.senado.cl:443:200.28.4.130 "https://sitio.senado.cl/senadores/comites"
→ curl (28) Failed to connect ... port 443 after 21034 ms: Could not connect to server
   (bloqueo a nivel IP/firewall del egress — timeout de conexión, no 4xx)

Host alterno www.senado.cl (raíz) SÍ responde:
  curl -L "https://www.senado.cl/"  → HTTP=200 SIZE=271471  (Next.js: __NEXT_DATA__ + buildId 4EMldF3oxKIqItY1dHAUe)
  pero el _next/data de la ruta comités NO existe en www:
  curl "https://www.senado.cl/_next/data/4EMldF3oxKIqItY1dHAUe/senadores/comites.json" → HTTP=404
  sitemap (https://www.senado.cl/sitemap.xml → 200) NO lista ninguna ruta de comité.
```

**Veredicto DIFERIDA:**
- (1) fuente oficial estable ✗ — la ruta de comités vive **solo** en `sitio.senado.cl`, host **inalcanzable desde el egress de esta corrida** (DNS falla vía curl; con IP resuelta, la conexión TCP a :443 **hace timeout a 21 s** = bloqueo IP/firewall, no un 301 recuperable). El único host alcanzable (`www.senado.cl`) 404ea la ruta y no la lista en su sitemap.
- No se pudo obtener el DOM ni el `__NEXT_DATA__` de la página de comités → **formato/machabilidad no verificables** en esta corrida.
- REFUTA el supuesto "301 desde www recuperable siguiendo redirect": el redirect apunta a un host firewalled desde este contexto.
- Se DIFIERE con evidencia del bloqueo. **Re-probe recomendado desde una red no bloqueada** (operador / entorno con egress a `sitio.senado.cl`), donde debe leerse `__NEXT_DATA__` del portal Next.js (`buildId` dinámico, NUNCA hardcodear la ruta `/_next/data/<buildId>` — leerlo de la página SSR, per CLAUDE.md). Enlaza al **Future Requirement** de comités-Senado.

### 5.3 Resumen coalición

| Fuente | Estable | Machable | Veredicto | Ruta |
|--------|---------|----------|-----------|------|
| **Servel pactos 2025** | ✓ 200, robots-allowed | ✓ party-level → militancia vigente | **VIABLE** | dos-etapas R2 `servel/pactos/2025/…` (NO ejecutada) |
| **Comités del Senado** | ✗ host firewalled (timeout 21s) | ? no verificable | **DIFERIDA** | re-probe desde red no bloqueada; Future Requirement |

**Coalición NO inferida desde votos** (regla LOCKED explícita). Global: **al menos una fuente VIABLE (Servel)** → el eje coalición tiene ruta de ingesta documentada; comités-Senado queda diferido por bloqueo de red, no por inviabilidad de la fuente.

---

## 6. INSUMOS PARA PLAN 02 / PLAN 03 (resumen ejecutable)

| Insumo | Valor (2026-07-24) | Consume |
|--------|--------------------|---------|
| Militancia base | 363 filas / 186 parl / 177 histórico | copy contexto |
| Militancia histórica **net-new (LOCKED)** | **696 pares** | 5º bloque ficha (Plan 02) + eje /comparar (Plan 03) |
| Militancia shared-ever (alternativa NO recomendada) | 1.966 pares | — |
| Copartidarios vigentes (= "Del mismo partido") | 1.270 pares | bloque existente |
| Zona | **eje SOLO Senado (31)**; diputados 0 | copy cobertura "solo senadores" (Plan 02/03) |
| Comisiones | 386 membresías / 34 comisiones | bloque + eje comparar |
| Co-autoría | 9.937 vínculos confirmados | bloque + eje (count-only; boletines-por-par = decisión Plan 03) |
| Lobby misma contraparte | **DIFERIDA** (contraparte_id 0/17.681; name-match 3.749 pares/134 parl con conflación) | NO entra esta pasada |
| Coalición Servel | **VIABLE** (5 pactos party-level, dos-etapas R2 documentada) | Future / plan de ingesta |
| Coalición comités-Senado | **DIFERIDA** (host firewalled) | Future / re-probe |

**Pitfall 1 recordatorio (Plan 03):** cruzar militancia por `partido_alias`, nunca por el `partido` display (DC/Liberal/PPD → 2 alias c/u). La RPC 0067 emite solo id/nombre/camara; `partido_alias` es interno.

---

## 7. INTEGRIDAD DE LA AUDITORÍA

- **CERO write a PROD** — todas las queries son `select` de solo lectura.
- **CERO write a R2** — el probe de coalición fue solo lectura (curl GET); la ruta dos-etapas R2 queda documentada, no ejecutada.
- **CERO paquete instalado** — Phase 101 no instala paquetes (RESEARCH § Package Legitimacy Audit; T-101-SC del threat model).
- **PII:** este documento emite SOLO conteos N/M agregados. Los nombres de contraparte de §3.3 se muestran **únicamente para justificar la decisión de provenance** (evidencia de conflación), NO como hecho publicable; jamás rut/email (T-101-01).
- **Rate-limit:** ≥2–3 s entre requests a fuentes oficiales; User-Agent identificatorio; robots.txt respetado (T-101-03).

**Corrección RULE-1 registrada:** §3.2 — parlamentarios distintos del name-match lobby = **134** (no 136 del snapshot research); pares 3.749 CONFIRMADOS idénticos.
