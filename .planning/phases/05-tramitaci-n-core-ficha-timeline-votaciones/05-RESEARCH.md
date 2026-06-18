# Phase 5: Tramitación Core — Ficha + Timeline + Votaciones - Research

**Researched:** 2026-06-18
**Domain:** Conectores de fuentes legislativas chilenas (Cámara opendata XML WS + Senado wspublico XML) + modelo Proyecto/Votacion + timeline cruzado por boletín + frontend Next.js 16 App Router
**Confidence:** HIGH (los 4 endpoints críticos validados LIVE 2026-06-18 con datos reales; cruce cross-cámara confirmado con boletín 18296-05 y 14309-04)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Alcance de ingesta inicial (acotado, live):** votaciones de las sesiones de la **legislatura vigente (ID 58)** vía Cámara `doGet.asmx` (`getSesiones?prmLegiId=58` → `getVotacionesPorSesion`), y la **tramitación de los boletines** que aparezcan en esas votaciones vía Senado `wspublico/tramitacion.php?boletin` + Cámara `getBoletin`. Expandible (más legislaturas) después. NO el universo histórico completo de golpe (WAF + tiempo). Rate-limit 2-3s respetado (framework Fase 1).

**Stack frontend (LOCKED):** Next.js 16 App Router en `/app`; **Server Components** que leen de Supabase (`@supabase/supabase-js` con la service/anon key desde backend); **Tailwind + shadcn/ui**; todas las llamadas a fuentes gubernamentales SOLO en backend/conectores (CORS/WAF), nunca desde el navegador. Corre localmente (deploy a remoto diferido por credenciales).

**UX ficha + timeline:**
- **Ficha de proyecto** (`/proyecto/[boletin]`): título, boletín, iniciativa (mensaje/moción), cámara de origen, autores, estado/etapa actual, materia.
- **Timeline**: eventos de tramitación de AMBAS cámaras fusionados por número de boletín en orden cronológico (urgencias, informes, oficios, etapas) — cada evento con fecha, cámara, y enlace a la fuente.
- **Votaciones**: totales SI/NO/Abstención/Pareo + resultado + quórum + etapa; para el Senado, el desglose voto-a-voto por parlamentario; para la Cámara, los totales (el voto individual por diputado es v2).
- **Frescura + fuente (TRAM-09):** cada dato muestra un badge "actualizado hace X" por fuente y un enlace directo a la fuente oficial.

**Guarda de identidad en capa pública (LOCKED):** cuando una votación del Senado trae el voto por nombre, el parlamentario se muestra vinculado a su ficha SOLO si el vínculo identidad está `confirmado` (Fase 4); si está `probable`/`no_confirmado`, se muestra el nombre crudo con marca visible "identidad no confirmada" — NUNCA se afirma una identidad dudosa como hecho.

**Modelo de datos:** Migración nueva: `proyecto` (boletin PK, titulo, iniciativa, camara_origen, autores, materia, estado/etapa, provenance), `votacion` (id, boletin FK, fecha, etapa, tipo, quorum, resultado, totales si/no/abst/pareo, camara, provenance), `voto` (votacion_id, mencion_nombre, parlamentario_id nullable→solo si confirmado, seleccion si|no|abst|pareo), `tramitacion_evento` (boletin, fecha, camara, tipo, descripcion, enlace). RLS: lectura pública de proyecto/votacion/timeline; `voto.parlamentario_id` solo poblado si confirmado. Crudo (XML/JSON) a R2 cuando haya cred (hoy local/snapshot); normalizado a Postgres local.

### Claude's Discretion

Endpoints finos de la Cámara (método exacto de sesiones/votaciones de la legislatura vigente — research lo confirma en vivo), parsing XML del Senado, esquema fino de columnas, componentes shadcn concretos, y la mecánica de fusión del timeline quedan a discreción respetando lo anterior. El research valida endpoints en vivo.

### Deferred Ideas (OUT OF SCOPE)

- Citaciones de comisiones + tabla semanal de sala → Fase 6.
- Búsqueda semántica + fichas estructuradas por idea matriz → Fase 7.
- Voto individual por diputado (opendata.camara.cl votaciones) → v2/P3 (sin validar). **⚠️ Ver Assumption A1: este research ENCONTRÓ el voto individual de Cámara disponible y validado — el planner/usuario debe decidir si lo incluye aquí o lo mantiene diferido.**
- Deploy a remoto + R2 live → pendiente credenciales.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TRAM-01 | Ingesta votaciones y sesiones de la Cámara vía WS JSON `doGet.asmx` | Endpoint real validado: `opendata.camara.cl` WServices (XML, no JSON). `WSSala.asmx/retornarSesionesXLegislatura?prmLegislaturaID=58` (sesiones); `WSLegislativo.asmx/retornarVotacionesXAnno?prmAnno=2026` y `wscamaradiputados.asmx/getVotaciones_Boletin?prmBoletin={n}` (votaciones con totales). Shapes documentados abajo. |
| TRAM-02 | Ingesta tramitación y votaciones del Senado vía `wspublico` XML | Ambos validados live: `tramitacion.senado.cl/wspublico/tramitacion.php?boletin={n}` (descripcion+tramites+urgencias+informes+oficios) y `votaciones.php?boletin={n}` (voto-a-voto por PARLAMENTARIO). Shapes documentados. |
| TRAM-03 | Modelar `Proyecto` (clave boletín) y `Votacion` normalizando ambas cámaras | Llave de cruce = número de boletín. Shape común derivable de ambas fuentes (sección Modelo de Datos). |
| TRAM-04 | Ficha de proyecto con estado/etapa actual | Senado `descripcion` trae `etapa`/`subetapa`/`estado`/`urgencia_actual`/`titulo`/`iniciativa`/`camara_origen`/`link_mensaje_mocion`. Cámara complementa votaciones. |
| TRAM-05 | Timeline cruzando ambas cámaras por número de boletín | Algoritmo de fusión documentado (sección Timeline Merge). Boletín 18296-05 y 14309-04 confirman el cruce live. |
| TRAM-06 | Resultados de votación (totales SI/NO/Abstención + resultado) | Cámara: `TotalSi/TotalNo/TotalAbstencion/TotalDispensado/Quorum/Resultado`. Senado: `SI/NO/ABSTENCION/PAREO/QUORUM/TIPOVOTACION/ETAPA`. |
| TRAM-09 | Indicador de frescura por fuente + enlace a la fuente original | Reusa `Provenance` (origen/fecha_captura/enlace) de Fase 1 (FND-08), persistida inline por fila. |
</phase_requirements>

## Summary

Los cuatro endpoints críticos fueron validados LIVE el 2026-06-18 con el User-Agent identificatorio y delay 2-3s. **El cruce cross-cámara por número de boletín FUNCIONA**: el boletín `18296-05` (votado en la Cámara el 2026-06-17, Legislatura 58) aparece simultáneamente en la votación de Cámara y en la tramitación del Senado, y `14309-04` tiene votaciones nominales en AMBAS cámaras. El número de boletín es la llave de cruce confirmada.

Hallazgo correctivo importante (Assumption A1): la nomenclatura `doGet.asmx`/JSON del CONTEXT/PROJECT es imprecisa — el WS real de la Cámara es **`opendata.camara.cl` y devuelve XML** (`text/xml`), no JSON `{"result":true,"data":[]}`. Más significativo: **el voto INDIVIDUAL por diputado SÍ está disponible y validado** en `WSLegislativo.asmx/retornarVotacionDetalle?prmVotacionID={id}` (155 nodos `<Voto><Diputado><Id>...<OpcionVoto>`), contradiciendo la afirmación de PROJECT.md de que "Votos=null". Esto NO bloquea la fase, pero el planner/usuario debe decidir si se ingiere ahora o se mantiene el deferral.

La arquitectura reusa intensamente lo construido: el seeder de Fase 3 ya demostró el patrón "conector que reusa colaboradores de `@obs/ingest` (assertAllowedUrl→robots→rateLimiter.wait→fetcher.get) + parse con fast-xml-parser + zod"; `normalizarNombre` de `@obs/core` ya tiene el campo `libre` diseñado EXACTAMENTE para el formato de voto del Senado (`"Coloma C., Juan Antonio"`); y `correrPipeline` de Fase 4 reconcilia esas menciones contra la maestra. El frontend Next.js 16.2.9 + React 19.2.4 ya está scaffoldeado en `/app`.

**Primary recommendation:** Construir dos conectores XML (`CamaraConnector`, `SenadoConnector`) que reusan `@obs/ingest` siguiendo el patrón del seeder de Fase 3 (NO `BaseConnector.run` para el ingest acotado, su caché diaria saltaría re-corridas); normalizar ambos al modelo común con boletín como PK de `proyecto`; fusionar timeline por boletín cronológicamente; reconciliar votos-por-nombre del Senado con `correrPipeline` mostrando vínculo solo si `confirmado`; y servir la ficha con Server Components que leen Supabase local. Migración nueva con RLS público-read EXPLÍCITO (el deny-by-default actual no expone nada).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Fetch a fuentes gubernamentales (Cámara/Senado XML) | Backend conector (`@obs/ingest`) | — | CORS/WAF: NUNCA desde el navegador (LOCKED). Reusa Fetcher/RateLimiter/Robots/Allowlist. |
| Parseo XML → modelo normalizado | Backend conector (`@obs/tramitacion`) | — | fast-xml-parser + zod, patrón del seeder Fase 3. |
| Reconciliación voto-por-nombre → maestra | Backend (`@obs/adjudication.correrPipeline`) | DB (vinculo_identidad) | Riesgo existencial #1; solo `confirmado` se vincula. |
| Persistencia normalizada | Database (Supabase Postgres local) | — | proyecto/votacion/voto/tramitacion_evento + RLS. |
| Persistencia crudo (XML) | Object storage (R2) gateado | DB (source_snapshot ref) | r2Enabled=false hoy; snapshot ref + provenance en Postgres. |
| Render ficha `/proyecto/[boletin]` | Frontend Server (Next.js SSR) | DB (lectura supabase-js) | Server Components leen Postgres; sin llamadas a fuentes en el navegador. |
| Badge frescura + enlace fuente | Frontend Server | DB (provenance inline) | Lee origen/fecha_captura/enlace de las filas (FND-08). |
| Timeline merge por boletín | Backend (ingest, materializado) o Frontend Server (al render) | — | Discreción; recomendado materializar en `tramitacion_evento` y ordenar en query. |

## Live Endpoint Validation (2026-06-18)

> Todas las llamadas con `User-Agent: Bot-Ciudadano/1.0 (consulta ciudadana Chile; contacto@dominio.cl)` y delay 2-3s. `[VERIFIED: live curl 2026-06-18]`.

### Hosts y allowlist

| Host | Allowlist Fase 1 | robots.txt | Notas |
|------|-----------------|------------|-------|
| `opendata.camara.cl` | Incluido (camara.cl suffix) | Devuelve HTML 404 (no hay robots.txt real) → `RobotsGuard` fail-open permite | WS XML de la Cámara |
| `tramitacion.senado.cl` | Incluido (senado.cl suffix) | Devuelve 302 redirect (no robots estándar) → fail-open permite | wspublico XML del Senado |

⚠️ Corrección de nomenclatura: `www.camara.cl/.../doGet.asmx` redirige a error404 (302). El WS vivo es **`opendata.camara.cl`**. Las URLs validadas abajo son las correctas.

### 1. Legislaturas — confirmación de ID 58

`GET https://opendata.camara.cl/wscamaradiputados.asmx/getLegislaturas` → HTTP 200, `text/xml`, 12.6 KB.

```xml
<ID>58</ID><Numero>374</Numero>
<FechaInicio>2026-03-11T00:00:00</FechaInicio>
<FechaTermino>2030-03-10T23:59:59</FechaTermino>
```
**Confirmado:** Legislatura ID **58** = Numero **374**, vigente 2026-03-11 → 2030-03-10 (coincide con "Leg 374·58" de Fase 3). `[VERIFIED: live curl 2026-06-18]`

### 2. Cámara — Sesiones de la legislatura 58

`GET https://opendata.camara.cl/camaradiputados/WServices/WSSala.asmx/retornarSesionesXLegislatura?prmLegislaturaID=58` → HTTP 200, `text/xml`, 10.4 KB.

Namespace: `xmlns="http://opendata.camara.cl/camaradiputados/v1"`.

```xml
<SesionesSalaColeccion>
  <Sesion>
    <Id>4757</Id>
    <Numero>2</Numero>
    <FechaInicio>2026-03-18T10:02:40</FechaInicio>
    <FechaTermino>2026-03-18T13:30:11</FechaTermino>
    <Tipo Valor="1">Ordinaria</Tipo>
    <Estado Valor="1">Celebrada</Estado>
  </Sesion>
  ...
</SesionesSalaColeccion>
```
Primera sesión de Leg 58 = Id 4755 (2026-03-11). `[VERIFIED: live curl 2026-06-18]`

> Nota: el WSDL de `wscamaradiputados.asmx` también expone `getSesiones` con param `prmLegislaturaID` (`s:int`). Ambos caminos sirven; `WSSala.asmx/retornarSesionesXLegislatura` fue el validado live.

### 3. Cámara — Votaciones con totales (TRAM-01, TRAM-06)

**Opción A (por año):** `GET https://opendata.camara.cl/camaradiputados/WServices/WSLegislativo.asmx/retornarVotacionesXAnno?prmAnno=2026` → HTTP 200, 277 KB.

```xml
<VotacionesColeccion xmlns="http://opendata.camara.cl/camaradiputados/v1">
  <Votacion>
    <Id>89178</Id>
    <Descripcion>Boletín N° 18296-05</Descripcion>   <!-- boletín embebido en texto libre -->
    <Fecha>2026-06-17T13:16:04</Fecha>
    <TotalSi>94</TotalSi>
    <TotalNo>52</TotalNo>
    <TotalAbstencion>1</TotalAbstencion>
    <TotalDispensado>0</TotalDispensado>
    <Quorum Valor="2">Quórum Calificado</Quorum>
    <Resultado Valor="1">Aprobado</Resultado>
    <Tipo Valor="1">Proyecto de Ley</Tipo>
  </Votacion>
</VotacionesColeccion>
```
- `<Descripcion>` contiene el boletín como texto libre (`Boletín N° 18296-05`) cuando `Tipo=Proyecto de Ley`; para `Proyecto de Resolución`/`Acuerdo` NO hay boletín (no son proyectos de ley).
- Extraer boletín con regex `/Bolet[íi]n N°\s*(\d+-\d+)/`.

**Opción B (por boletín — RECOMENDADA):** `GET https://opendata.camara.cl/wscamaradiputados.asmx/getVotaciones_Boletin?prmBoletin=14309` → HTTP 200, 5.8 KB. Namespace `http://tempuri.org/` (distinto de la Opción A).

```xml
<Votaciones xmlns="http://tempuri.org/">
  <Votacion>
    <ID>88813</ID>
    <Fecha>2026-05-11T19:21:07</Fecha>
    <Tipo Codigo="6">Única</Tipo>
    <Resultado Codigo="2">Rechazado</Resultado>
    <Quorum Codigo="1">Quorum Simple</Quorum>
    <Sesion>
      <ID>4776</ID><Numero>21</Numero><Fecha>2026-05-11T17:00:19</Fecha>
      <Tipo Codigo="60">Ordinaria</Tipo>
    </Sesion>
    <Boletin>14309-04</Boletin>          <!-- boletín ESTRUCTURADO, no texto libre -->
    <Articulo>Enmienda del Senado que agrega un nuevo artículo...</Articulo>
  </Votacion>
</Votaciones>
```
✅ **Opción B es preferible:** trae `<Boletin>` como elemento estructurado (sin regex), incluye la `<Sesion>` anidada, y es directamente "votaciones de este boletín" — encaja con el alcance acotado (ingesta dirigida por boletín). Diferencia: usa `Codigo` en vez de `Valor` para los enums y `<ID>` en vez de `<Id>`. `[VERIFIED: live curl 2026-06-18]`

### 4. Cámara — Voto individual por diputado (⚠️ Assumption A1)

`GET https://opendata.camara.cl/camaradiputados/WServices/WSLegislativo.asmx/retornarVotacionDetalle?prmVotacionID=89178` → HTTP 200, 43 KB.

```xml
<Votacion xmlns="http://opendata.camara.cl/camaradiputados/v1">
  <Id>89178</Id> ... <TotalSi>94</TotalSi> ...
  <Votos>
    <Voto>
      <Diputado>
        <Id>803</Id>
        <Nombre>René</Nombre>
        <ApellidoPaterno>Alinco</ApellidoPaterno>
        <ApellidoMaterno>Bustos</ApellidoMaterno>
      </Diputado>
      <OpcionVoto Valor="0">En Contra</OpcionVoto>
    </Voto>
    ... (155 nodos <Voto>, OpcionVoto Valor 0=En Contra / 1=Afirmativo) ...
  </Votos>
</Votacion>
```
**El voto individual de Cámara EXISTE, con `Diputado/Id` (cruza directo a `id_diputado_camara` de la maestra — match determinista por id, sin reconciliación por nombre).** Esto contradice PROJECT.md ("Votos=null → vive en opendata.camara.cl sin validar"). `[VERIFIED: live curl 2026-06-18]`

→ **Decisión para el usuario (A1):** CONTEXT lo defiere a v2. Pero está disponible, validado, y el cruce es por `Id` (más fuerte que nombre, sin riesgo de identidad). El planner debe presentar esto como opción: incluir voto-individual-Cámara en `voto` (con `parlamentario_id` resuelto por `id_diputado_camara`) sería bajo riesgo y alto valor. **Mantener como ASSUMED hasta confirmación del usuario** — la fase puede shipear sin esto (totales son suficientes para TRAM-06).

### 5. Senado — Tramitación (TRAM-02, TRAM-04, TRAM-05)

`GET https://tramitacion.senado.cl/wspublico/tramitacion.php?boletin=18296` → HTTP 200, `application/xml`, 6 KB. (El param es solo el número sin sufijo de comisión: `18296`, no `18296-05`.)

```xml
<proyectos><proyecto>
  <descripcion>
    <boletin>18296-05</boletin>
    <titulo>Autoriza mayor endeudamiento del gobierno central durante el año 2026</titulo>
    <fecha_ingreso>03/06/2026</fecha_ingreso>           <!-- dd/mm/yyyy -->
    <iniciativa>Mensaje</iniciativa>                     <!-- Mensaje | Moción -->
    <camara_origen>C.Diputados</camara_origen>
    <urgencia_actual>Suma</urgencia_actual>
    <etapa>Segundo trámite constitucional (Senado)</etapa>
    <subetapa>Primer informe de comisión de Hacienda</subetapa>
    <leynro></leynro>
    <diariooficial></diariooficial>
    <estado>En tramitación </estado>
    <link_mensaje_mocion>http://www.senado.cl/appsenado/index.php?mo=tramitacion&ac=getDocto&iddocto=18974&tipodoc=mensaje_mocion</link_mensaje_mocion>
  </descripcion>
  <autores>...</autores>
  <tramitacion>
    <tramite>
      <SESION>29/374</SESION>
      <FECHA>03/06/2026</FECHA>
      <DESCRIPCIONTRAMITE>Ingreso de proyecto. Incluye IF N° 119/03.06.2026.</DESCRIPCIONTRAMITE>
      <ETAPDESCRIPCION>Primer trámite constitucional</ETAPDESCRIPCION>
      <CAMARATRAMITE>C.Diputados</CAMARATRAMITE>      <!-- C.Diputados | Senado -->
    </tramite>
    ... (12 <tramite> nodos) ...
  </tramitacion>
  <urgencias><urgencia>...</urgencia></urgencias>
  <informes><informe>
    <FECHAINFORME>16/06/2026</FECHAINFORME>
    <TRAMITE>Primer informe de comisión de Economía...</TRAMITE>
    <ETAPA>Primer trámite constitucional</ETAPA>
    <LINK_INFORME>http://www.senado.cl/.../iddocto=28047&tipodoc=info</LINK_INFORME>
  </informe></informes>
  <comparados></comparados>
  <oficios><oficio>
    <NUMERO>21.320</NUMERO>
    <FECHA>17/06/2026</FECHA>
    <TRAMITE>Oficio de ley a Cámara Revisora</TRAMITE>
    <ETAPA>Primer trámite constitucional</ETAPA>
    <TIPO>Ley</TIPO>
    <CAMARA>C. Diputados</CAMARA>
    <LINK_OFICIO>http://www.senado.cl/.../iddocto=36752&tipodoc=ofic</LINK_OFICIO>
  </oficio></oficios>
  <indicaciones></indicaciones>
  <observaciones></observaciones>
  <materias></materias>
  <votaciones></votaciones>   <!-- vacío aquí: aún en primer trámite -->
</proyecto></proyectos>
```
**Secciones del timeline** (todas con FECHA + enlace cuando aplica): `tramitacion/tramite`, `urgencias/urgencia`, `informes/informe` (LINK_INFORME), `oficios/oficio` (LINK_OFICIO). El `descripcion` alimenta toda la ficha (TRAM-04). `[VERIFIED: live curl 2026-06-18]`

**⚠️ Encoding:** servido como UTF-8 válido (`file` confirma UTF-8), pero contiene `&amp;` en URLs y caracteres acentuados. Históricamente el wspublico del Senado mezcla Latin-1; usar `fast-xml-parser` con la respuesta como texto y verificar. Las fechas son `dd/mm/yyyy` (parsear, NO `Date()` directo). Listas pueden venir como objeto único o array → forzar array con `[].concat()` (patrón ya usado en `parse-senado.ts`).

### 6. Senado — Votaciones nominales (TRAM-06, guarda de identidad)

`GET https://tramitacion.senado.cl/wspublico/votaciones.php?boletin=14309` → HTTP 200, `application/xml`.

⚠️ **El boletín debe estar en/pasado trámite Senado con votos nominales.** Boletín 18296 (primer trámite Cámara) devuelve `<votaciones></votaciones>` vacío. Boletines validados CON votos: 10634 (11 votaciones), 11608 (11), 14309 (1), 15096 (3), 16374 (4).

```xml
<votaciones>
  <votacion>
    <SESION>47/372</SESION>
    <FECHA>27/08/2024</FECHA>
    <TEMA>Proyecto de ley, en segundo trámite... (Boletín N° 14.309-04).</TEMA>
    <SI>30</SI><NO>1</NO><ABSTENCION>4</ABSTENCION><PAREO>0</PAREO>
    <QUORUM>Mayoría simple</QUORUM>
    <TIPOVOTACION>Discusión general</TIPOVOTACION>
    <ETAPA>Segundo trámite constitucional</ETAPA>
    <DETALLE_VOTACION>
      <VOTO>
        <PARLAMENTARIO>Coloma C., Juan Antonio</PARLAMENTARIO>   <!-- "Paterno Inicial-materno., Nombres" -->
        <SELECCION>Si</SELECCION>                                <!-- Si | No | Abstencion | Pareo -->
      </VOTO>
      ... (un VOTO por senador presente) ...
    </DETALLE_VOTACION>
  </votacion>
</votaciones>
```
**Formato del nombre** = `"Coloma C., Juan Antonio"` (apellido paterno + inicial del materno + coma + nombres). ⚠️ Algunos traen **whitespace al final** (`"Durana S., José Miguel "`) → trim obligatorio. El `<TEMA>` trae el boletín con puntos de millar (`14.309-04`) — no usar como llave; usar el param de consulta. `[VERIFIED: live curl 2026-06-18]`

→ Este formato es EXACTAMENTE el que `normalizarNombre({ libre })` de `@obs/core` ya maneja (ver Reusable Assets). `correrPipeline` lo reconcilia contra la maestra (Fase 4).

## Standard Stack

> Sin paquetes nuevos vs. el stack ya instalado (Fase 1-4). Esta fase ENSAMBLA, no agrega dependencias de runtime nuevas (salvo, a discreción, shadcn/ui + tailwind para el frontend, que es codegen/CSS, no un paquete de scraping).

### Core (ya instalado — reuso)
| Library | Version (instalada) | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `fast-xml-parser` | 5.x | Parseo XML Cámara + Senado | Ya EN USO en `@obs/identity` (parse-senado/camara). `[VERIFIED: package.json + 03-03-SUMMARY]` |
| `zod` | 3.x/4.x | Validación de shape de respuesta + contrato | Patrón establecido (ParlamentarioSeedSchema). `[CITED: PROJECT.md STACK]` |
| `@obs/ingest` | workspace | Fetcher/RateLimiter/Robots/Allowlist/R2/Snapshot/Provenance | Reuso obligatorio (NO nueva infra). `[VERIFIED: 01-02-SUMMARY]` |
| `@obs/core` | workspace | `normalizarNombre` (campo `libre`), `Provenance`, `makeProvenance` | `libre` diseñado para el formato de voto Senado. `[VERIFIED: packages/core/src/nombre.ts]` |
| `@obs/adjudication` | workspace | `correrPipeline` reconcilia voto-por-nombre → maestra | Solo `confirmado` se vincula (LOCKED). `[VERIFIED: 04-03-SUMMARY]` |
| `@supabase/supabase-js` | v2 | Cliente DB desde Server Components + writer de ingesta | `[CITED: PROJECT.md STACK]` |
| Next.js | 16.2.9 | App Router, Server Components, ficha `/proyecto/[boletin]` | Ya scaffoldeado en `/app`. `[VERIFIED: app/package.json]` |
| React | 19.2.4 | UI | Viene con Next 16. `[VERIFIED: app/package.json]` |

### Supporting (frontend — a discreción del planner)
| Library | Purpose | When to Use |
|---------|---------|-------------|
| Tailwind + shadcn/ui | Componentes de ficha (Card, Badge, Tabs, Table) | LOCKED en CONTEXT. shadcn es codegen (copia componentes), no dependencia pesada. |
| `visx` (`@visx/*`) | Timeline a medida cruzando cámaras | Recomendado en STACK; SSR-friendly. Opcional: una lista vertical ordenada cubre TRAM-05 sin librería. |
| Recharts | Barras de votación (SI/NO/Abst) | Opcional; una barra CSS simple basta para MVP. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `getVotaciones_Boletin` (boletín, `tempuri.org` ns) | `retornarVotacionesXAnno` (año, `opendata...v1` ns) | Por-año trae TODO 2026 (277 KB) y exige regex sobre `Descripcion`; por-boletín trae `<Boletin>` estructurado y encaja con el ingest dirigido. Usar por-boletín. |
| `visx` para timeline | Lista `<ol>` ordenada con Tailwind | visx da gráfico Gantt; una lista cronológica con badge de cámara cumple TRAM-05 con menos código. Empezar simple. |
| Materializar `tramitacion_evento` en ingesta | Fusionar timeline en el Server Component al render | Materializar es más simple de consultar y versionar; recomendado. |

**Installation:** Ninguna nueva dependencia de scraping. Para frontend (a discreción): `npx shadcn@latest init` (codegen) + `tailwindcss` (ya probable en scaffold Next 16). Verificar antes de instalar visx/recharts.

## Package Legitimacy Audit

> Esta fase NO instala paquetes de runtime nuevos para el backend de ingesta — reusa `@obs/*` (workspace) + `fast-xml-parser`/`zod` ya auditados en Fase 1-3. Solo el frontend PODRÍA agregar `visx`/`recharts`/shadcn deps si el planner lo decide.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| `fast-xml-parser` | npm | años | ~30M/wk | github.com/NaturalIntelligence/fast-xml-parser | [OK] auditado Fase 3 (03-RESEARCH) | Approved (ya en uso) |
| `zod` | npm | años | ~30M/wk | github.com/colinhacks/zod | [OK] | Approved (ya en uso) |
| `@visx/*` | npm | años | ~1M/wk | github.com/airbnb/visx | no corrido (frontend opcional) | [ASSUMED] — gate si el planner lo adopta |
| `recharts` | npm | años | ~10M/wk | github.com/recharts/recharts | no corrido (frontend opcional) | [ASSUMED] — gate si el planner lo adopta |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

*slopcheck NO se corrió en esta sesión (entorno Windows, no se instaló). Los paquetes de backend ya fueron auditados en fases previas; los de frontend (visx/recharts) quedan `[ASSUMED]` y el planner debe gatear su install con `checkpoint:human-verify` si los adopta. shadcn/ui copia componentes al repo (no es una dependencia npm clásica).*

## Architecture Patterns

### System Architecture Diagram

```
                          ┌─────────────────────────────────────────────┐
   FUENTES (gov)          │            INGESTA (backend / Deno)          │
                          │                                              │
 opendata.camara.cl ──────┼─► CamaraConnector ──┐                        │
   getVotaciones_Boletin  │   (reusa @obs/ingest:│                        │
   retornarVotacionDetalle│    allowlist→robots→ ├─► parse (fast-xml +    │
   retornarSesiones...58   │    rateLimiter.wait→│    zod) ─► normalizar  │
                          │    fetcher.get)      │    al modelo común     │
 tramitacion.senado.cl ───┼─► SenadoConnector ───┘    (boletín = PK)      │
   tramitacion.php?boletin│                          │                    │
   votaciones.php?boletin │     voto-por-nombre ─────┤                    │
                          │            │             ▼                    │
                          │            ▼      ┌──────────────┐            │
                          │   correrPipeline  │  Provenance  │            │
                          │   (Fase 4) ──────►│  (origen/    │            │
                          │   solo 'confirmado'│  fecha/link) │            │
                          │   vincula a maestra└──────────────┘            │
                          └────────────┬─────────────────────────────────┘
                                       ▼  (upsert idempotente por boletín / votacion_id)
                          ┌─────────────────────────────────────────────┐
                          │   SUPABASE POSTGRES (local)                  │
                          │   proyecto ◄─FK─ votacion ◄─FK─ voto         │
                          │   proyecto ◄─FK─ tramitacion_evento          │
                          │   voto.parlamentario_id → parlamentario      │
                          │     (NULL salvo vínculo 'confirmado')        │
                          │   RLS: anon SELECT en proyecto/votacion/     │
                          │        tramitacion_evento/voto (datos públ.) │
                          └────────────┬─────────────────────────────────┘
                                       ▼  (supabase-js, service/anon key, server-only)
                          ┌─────────────────────────────────────────────┐
                          │   NEXT.JS 16 APP ROUTER (Server Components)  │
                          │   /proyecto/[boletin]:                       │
                          │     ficha (descripcion) + votaciones (totales│
                          │     + voto-a-voto Senado) + TIMELINE fusionado│
                          │     (eventos ambas cámaras ordenados x fecha)│
                          │     + badge frescura/enlace fuente (TRAM-09) │
                          └─────────────────────────────────────────────┘
        Navegador ◄── HTML SSR (NUNCA llama a fuentes gov directamente: CORS/WAF)
```

### Recommended Project Structure
```
packages/
  tramitacion/                 # nuevo paquete @obs/tramitacion
    src/
      parse-camara-votacion.ts # getVotaciones_Boletin XML → Votacion[]  (+ detalle opcional A1)
      parse-camara-sesion.ts   # retornarSesionesXLegislatura → Sesion[]
      parse-senado-tramitacion.ts # tramitacion.php → Proyecto + TramitacionEvento[]
      parse-senado-votacion.ts # votaciones.php → Votacion + Voto[] (por nombre)
      connector-camara.ts      # reusa @obs/ingest (NO BaseConnector.run para ingest acotado)
      connector-senado.ts
      normalizar.ts            # mapea ambas cámaras al modelo común (boletín = PK)
      timeline.ts              # fusiona eventos de ambas fuentes por boletín, cronológico
      ingest-run.ts            # corrida LIVE acotada (Leg 58 → boletines → tramitación)
      writer.ts                # upsert idempotente (proyecto/votacion/voto/evento) inyectable
app/
  app/
    proyecto/
      [boletin]/
        page.tsx               # Server Component: ficha + timeline + votaciones
    _components/               # Card, Badge frescura, Timeline, VotacionTotales, VotoSenadoLista
supabase/
  migrations/
    0008_tramitacion.sql       # proyecto, votacion, voto, tramitacion_evento + RLS público-read
```

### Pattern 1: Conector que reusa `@obs/ingest` (NO `BaseConnector.run` para ingest acotado)
**What:** Igual que el seeder de Fase 3: el conector orquesta `assertAllowedUrl → robots.isAllowed → rateLimiter.wait(host) → fetcher.get`, luego parse + zod. NO usa `BaseConnector.run` porque su caché diaria saltaría re-corridas del mismo día (anti-pattern documentado en 03-RESEARCH).
**When to use:** Ingesta dirigida/acotada (Leg 58 → lista de boletines) que puede re-correrse.
```typescript
// Patrón establecido — Source: packages/identity/src/seeder.ts (03-03-SUMMARY)
await assertAllowedUrl(url);                 // SSRF deny-by-default
if (!(await robots.isAllowed(url))) return;  // fail-open
await rateLimiter.wait(host);                // 2-3s serial por host (LOCKED)
const { body } = await fetcher.get({ url }); // UA identificatorio + backoff 429/5xx
const rows = parseCamaraVotacion(body);      // fast-xml-parser + zod
```

### Pattern 2: Reconciliación voto-por-nombre → maestra (guarda de identidad)
**What:** Por cada `<VOTO><PARLAMENTARIO>`, construir `MencionForanea` con `normalizarNombre({ libre: nombre.trim() })`, correr `correrPipeline` contra la maestra (186 reales). `voto.parlamentario_id` se puebla SOLO si el resultado es `determinista`/`confirmado`; `probable`/`no_confirmado`/`revision` → `parlamentario_id = null` + se conserva `mencion_nombre` crudo para display con marca "identidad no confirmada".
**When to use:** Votos nominales del Senado (`votaciones.php`).
```typescript
// Source: 04-03-SUMMARY (correrPipeline) + @obs/core normalizarNombre.libre
const { nombre_normalizado } = normalizarNombre({ libre: voto.PARLAMENTARIO.trim() });
const res = await correrPipeline(mencion, maestra, provider, writer);
const parlamentarioId = res.tipo === "determinista" ? res.id : null; // 'probable' NO vincula
```

### Pattern 3: Timeline merge por boletín
**What:** Unir en una sola lista los eventos de ambas fuentes, normalizados a `{ fecha: Date, camara, tipo, descripcion, enlace }`, ordenar cronológicamente.
**When to use:** TRAM-05.
```
eventos = [
  ...senado.tramitacion.tramite   → { fecha, camara: CAMARATRAMITE, tipo:'tramite',  descripcion: DESCRIPCIONTRAMITE, enlace:null },
  ...senado.urgencias.urgencia    → { ..., tipo:'urgencia' },
  ...senado.informes.informe      → { fecha: FECHAINFORME, tipo:'informe', enlace: LINK_INFORME },
  ...senado.oficios.oficio        → { fecha: FECHA, camara: CAMARA, tipo:'oficio', enlace: LINK_OFICIO },
  ...camara.votaciones            → { fecha, camara:'C.Diputados', tipo:'votacion', descripcion: resultado+totales },
  ...senado.votaciones            → { fecha, camara:'Senado', tipo:'votacion' },
].sort((a,b) => a.fecha - b.fecha)   // fechas dd/mm/yyyy parseadas a Date ANTES de ordenar
```

### Anti-Patterns to Avoid
- **Usar `BaseConnector.run` para el ingest acotado:** su caché diaria saltaría re-corridas (03-RESEARCH). Reusar colaboradores sueltos.
- **Parsear boletín del `<TEMA>`/`<Descripcion>` del Senado/Cámara-por-año:** trae puntos de millar (`14.309-04`) y texto variable. Usar `getVotaciones_Boletin/<Boletin>` (estructurado) o el param de consulta como llave.
- **`new Date("03/06/2026")`:** las fechas del Senado son `dd/mm/yyyy`; el parser JS las interpreta como `mm/dd` o `Invalid`. Parsear explícitamente.
- **Vincular `probable` a la ficha del parlamentario:** viola la guarda LOCKED. Solo `confirmado`.
- **Llamar fuentes gov desde Client Components:** CORS/WAF. Server-only.
- **RLS sin policy explícita esperando que "datos públicos" se lean:** el deny-by-default actual (RLS enabled, sin policy) bloquea a `anon`. Hay que AÑADIR `create policy ... for select to anon using (true)`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Rate-limit / robots / SSRF allowlist / UA | Tu propio fetch con sleep | `@obs/ingest` (Fetcher/RateLimiter/RobotsGuard/assertAllowedUrl) | Ya centralizado y testeado (Fase 1); reimplementarlo = anti-pattern WAF. |
| Normalización de nombre chileno | tu propio split de "Apellido P., Nombre" | `normalizarNombre({ libre })` de `@obs/core` | Maneja partículas, materno inicial vs completo, alias; converge catálogo↔votación. |
| Decisión "este voto es de este parlamentario" | fuzzy-match casero | `correrPipeline` (Fase 4) | Riesgo existencial #1; golden set + compuerta humana. NUNCA fuzzy sin umbral. |
| Provenance (origen/fecha/enlace) | columnas ad-hoc | `makeProvenance` + patrón inline (FND-08) | Ya es el contrato de frescura (TRAM-09). |
| Upsert idempotente | INSERT con catch de duplicado | upsert por clave natural (boletín / votacion id) vía writer inyectable | Patrón del seeder Fase 3; re-corridas sin duplicar. |
| Parseo XML con listas opcionales | acceso directo `doc.x.y[0]` | `[].concat(doc.x?.y ?? [])` (fuerza array) | fast-xml-parser colapsa nodo único a objeto; patrón en parse-senado.ts. |

**Key insight:** Esta fase es 80% ensamblaje de subsistemas ya construidos. El valor nuevo es el modelo de datos, los parsers de las 4 respuestas, la fusión del timeline, y el frontend. Todo lo "difícil y peligroso" (rate-limit, identidad) ya existe.

## Runtime State Inventory

> Greenfield para los datos de tramitación (no hay tablas proyecto/votacion previas), pero hay state heredado relevante a verificar.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | Maestra `parlamentario` (186 filas reales, Supabase local) + `parlamentario.seed.json` en git. `voto` debe FK a `parlamentario.id` (texto, p.ej. `S123`/`P00001`). | Ninguna migración de datos; `voto` referencia la maestra existente. |
| Live service config | Ninguno (esta fase no registra servicios externos). | None — verificado: no hay cron/queue nuevo obligatorio (ingest acotado corre manual/CLI como el seeder de Fase 3). |
| OS-registered state | Ninguno. | None — verificado: no hay Task Scheduler/cron del SO. |
| Secrets/env vars | `SUPABASE_LOCAL_SERVICE_KEY` (ya usado por writers Fase 4); R2 creds gateadas por `r2Enabled=false` (401 hoy). El frontend necesita `NEXT_PUBLIC_SUPABASE_URL` + anon key (o service key server-only). | Documentar las env vars del frontend; reusar la service key local existente para el writer de ingesta. |
| Build artifacts | Nuevo paquete `@obs/tramitacion` requiere alta como workspace (`pnpm-workspace.yaml` ya tiene `packages/*` → auto-incluido) + project reference en `tsconfig` + path mapping en `tsconfig.base.json` (mismo patrón que el alta de `@obs/ingest` en Fase 3). | `pnpm install` tras crear el paquete; agregar reference + path mapping. |

## Common Pitfalls

### Pitfall 1: Boletín con/sin sufijo de comisión
**What goes wrong:** El boletín se ve como `18296-05` (con sufijo `-05` = comisión/materia), pero el param de `tramitacion.php?boletin=` espera SOLO `18296`. Pasar `18296-05` puede devolver vacío.
**Why it happens:** El número de boletín base identifica el proyecto; el sufijo es la materia.
**How to avoid:** Llave de `proyecto` = boletín completo (`18296-05`) para display/PK, pero query al Senado con el número base. Documentar ambos en el modelo (`boletin` completo + `boletin_num` base).
**Warning signs:** `<votaciones></votaciones>` o `<proyectos></proyectos>` vacíos con HTTP 200.

### Pitfall 2: Votaciones Senado vacías en proyectos jóvenes
**What goes wrong:** `votaciones.php?boletin=18296` (primer trámite Cámara) → `<votaciones></votaciones>` vacío. Si el ingest asume que todo boletín votado en Cámara tiene voto Senado, falla silencioso.
**Why it happens:** El Senado solo tiene votos nominales una vez el proyecto llega a su sala.
**How to avoid:** Tratar votaciones Senado como opcionales; el timeline/ficha funciona con solo datos de Cámara. Probar con boletines en/pasado trámite Senado (validados: 10634, 11608, 14309, 15096, 16374).
**Warning signs:** 0 votos Senado en proyectos de origen Cámara recientes (esperado, no error).

### Pitfall 3: Fechas `dd/mm/yyyy` y nombres con whitespace
**What goes wrong:** `new Date("03/06/2026")` → fecha errónea (mm/dd) o `Invalid`. `"Durana S., José Miguel "` con espacio final no matchea la maestra.
**Why it happens:** Formato chileno + datos sin sanitizar en la fuente.
**How to avoid:** Parser de fecha `dd/mm/yyyy` explícito; `.trim()` en todo `<PARLAMENTARIO>` y `<FECHA>` antes de usar (la guarda ya está en `normalizarNombre` via fold, pero trim antes de pasarlo).
**Warning signs:** Eventos del timeline desordenados; menciones que no resuelven en la maestra pese a ser senadores vigentes.

### Pitfall 4: Dos namespaces XML distintos en la Cámara
**What goes wrong:** `retornarVotacionesXAnno` usa `xmlns=http://opendata.camara.cl/camaradiputados/v1` con `<Id>`/`Valor`; `getVotaciones_Boletin` usa `xmlns=http://tempuri.org/` con `<ID>`/`Codigo`. Un parser que asume un solo shape rompe con el otro.
**Why it happens:** Distintos `.asmx` legacy.
**How to avoid:** Un parser por endpoint; zod schema distinto por respuesta. Preferir `getVotaciones_Boletin` (estructurado) y `retornarVotacionDetalle` (detalle) consistentemente.
**Warning signs:** `undefined` en campos que "deberían existir".

### Pitfall 5: RLS deny-by-default bloquea la ficha pública
**What goes wrong:** Se crea la tabla con `enable row level security` (como todas las de Fase 1-4) pero SIN policy → `anon` (el rol del frontend) lee 0 filas; la ficha sale vacía sin error.
**Why it happens:** El patrón heredado es deny-by-default para datos sensibles (maestra con rut/email). Pero proyecto/votacion/timeline SON públicos.
**How to avoid:** Añadir explícitamente `create policy public_read on proyecto for select to anon using (true)` (y votacion/voto/tramitacion_evento). `voto` puede exponerse completo (el `parlamentario_id` ya es null si no confirmado; no hay PII). Verificar con pgTAP que `anon` lee proyecto y NO lee `parlamentario.rut`.
**Warning signs:** Ficha en blanco en el navegador; consultas server-side con service key funcionan pero el cliente anon no.

## Code Examples

### Construir mención foránea desde voto Senado y reconciliar
```typescript
// Source: @obs/core (nombre.ts campo `libre`) + @obs/adjudication (04-03-SUMMARY)
const nombreCrudo = voto.PARLAMENTARIO.trim();          // "Coloma C., Juan Antonio"
const { nombre_normalizado, tokens } = normalizarNombre({ libre: nombreCrudo });
const mencion = { nombreOriginal: nombreCrudo, nombre_normalizado, tokens,
                  camara: "senado", periodo: "senado-vigente-2026", region: null };
const res = await correrPipeline(mencion, maestra, provider, writer);
// guarda de identidad LOCKED:
const parlamentarioId = res.tipo === "determinista" ? res.id : null;
// display: si parlamentarioId != null → link a ficha; si null → nombreCrudo + "identidad no confirmada"
```

### Server Component ficha (lectura supabase-js, server-only)
```typescript
// Source: Next 16 App Router (PROJECT.md STACK) — app/app/proyecto/[boletin]/page.tsx
export default async function FichaProyecto({ params }: { params: Promise<{ boletin: string }> }) {
  const { boletin } = await params;                     // Next 16: params es async
  const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_KEY!); // server-only
  const { data: proyecto } = await sb.from("proyecto").select("*").eq("boletin", boletin).single();
  const { data: eventos } = await sb.from("tramitacion_evento").select("*")
    .eq("boletin", boletin).order("fecha", { ascending: true });
  const { data: votaciones } = await sb.from("votacion").select("*, voto(*)").eq("boletin", boletin);
  // render ficha + Timeline(eventos) + Votaciones(votaciones) + Badge(proyecto.fecha_captura, proyecto.enlace)
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `www.camara.cl/.../doGet.asmx` (JSON `{result,data}`) | `opendata.camara.cl` WServices (XML, namespaced) | Portal nuevo Cámara | El nombre/forma del CONTEXT es legacy; usar opendata XML. |
| "Voto individual Cámara no disponible (Votos=null)" | `retornarVotacionDetalle` SÍ trae 155 `<Voto><Diputado><Id>` | Validado 2026-06-18 | A1: voto-individual-Cámara disponible y de bajo riesgo (cruce por Id). |
| Next.js Pages Router | App Router + Server Components + `params` async | Next 13→16 | `params` es `Promise` en Next 16. |

**Deprecated/outdated:**
- `www.camara.cl/legislacion/sesiones_sala/doGet.asmx`: redirige a error404 (302). No usar.
- Asumir JSON de la Cámara: devuelve `text/xml`. Parsear con fast-xml-parser.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | El voto INDIVIDUAL por diputado de la Cámara (`retornarVotacionDetalle`) está disponible y validado, contradiciendo el deferral de CONTEXT/PROJECT. Recomendación: presentar al usuario incluirlo (cruce por `Diputado/Id`, sin riesgo de identidad). | Live Validation §4, State of the Art | Si el usuario mantiene el deferral, la fase shipea con solo totales (TRAM-06 cumplido igual). Bajo riesgo: es una mejora opcional, no un bloqueo. |
| A2 | El encoding del Senado wspublico es UTF-8 estable (file lo confirma hoy). Históricamente mezcla Latin-1. | Live Validation §5 | Si llega Latin-1, acentos corruptos en display; mitigar detectando charset y re-decodificando. |
| A3 | shadcn/ui + Tailwind se integran limpio en el scaffold Next 16 existente (no verificado el estado de Tailwind en `/app`). | Standard Stack | Si Tailwind no está configurado, +1 paso de setup. Verificar `app/` antes de planificar componentes. |
| A4 | `visx`/`recharts` no fueron pasados por slopcheck en esta sesión (entorno Windows). | Package Legitimacy | Bajo: ambos son librerías masivas y conocidas; el planner debe gatear su install si los adopta. |

## Open Questions (RESOLVED)

> Resueltas vía el ADDENDUM de 05-CONTEXT.md (decisión del usuario 2026-06-18): **Q1 RESUELTA → INCLUIR voto-individual-Cámara** (determinista por `Diputado/Id`); **Q2 RESUELTA → materializar el timeline en `tramitacion_evento`**; **Q3 RESUELTA → descubrir boletines con `retornarVotacionesXAnno?prmAnno=2026`**.

1. **¿Incluir voto-individual-Cámara (A1) en esta fase o respetar el deferral?** — RESUELTA: INCLUIR (usuario, ADDENDUM).
   - What we know: está disponible, validado, cruza por `Diputado/Id` (match determinista, sin reconciliación por nombre, sin riesgo de identidad).
   - What's unclear: si el usuario prefiere mantener el scope acotado de CONTEXT.
   - Recommendation: el planner lo plantea como decisión explícita al usuario en discuss/plan; default = respetar CONTEXT (totales solamente) y dejar el voto-individual-Cámara como tarea opcional/diferida.

2. **¿Materializar el timeline en `tramitacion_evento` o fusionar al render?**
   - What we know: ambas funcionan; materializar simplifica la consulta y versiona los eventos.
   - What's unclear: discreción del planner.
   - Recommendation: materializar en ingesta (una fila por evento, con provenance) → el Server Component solo ordena.

3. **¿Cómo obtener la LISTA de boletines a ingerir (alcance Leg 58)?**
   - What we know: `getVotaciones_Boletin` requiere un boletín; `retornarVotacionesXAnno?prmAnno=2026` lista TODAS las votaciones 2026 con boletín en `Descripcion`.
   - Recommendation: usar `retornarVotacionesXAnno` (2026, y 2025 si se quiere cobertura de la legislatura previa al corte) para DESCUBRIR el conjunto de boletines votados, luego por cada uno traer tramitación Senado + votaciones de ambas cámaras.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| opendata.camara.cl WS | TRAM-01/06 | ✓ (HTTP 200 live) | XML v1/tempuri | — |
| tramitacion.senado.cl wspublico | TRAM-02/04/05/06 | ✓ (HTTP 200 live) | XML | — |
| Supabase local | persistencia + RLS + frontend read | ✓ (Fase 1-4) | Postgres 15 | — |
| `SUPABASE_LOCAL_SERVICE_KEY` | writer de ingesta | ✓ (usado Fase 4) | — | — |
| R2 credentials | crudo a R2 | ✗ (401, gateado) | — | snapshot local / `r2Enabled=false` (deferred, CONTEXT) |
| Next.js dev server | ficha | ✓ (16.2.9 scaffold) | 16.2.9 | — |
| MiniMax API (para `correrPipeline` LLM live) | reconciliar menciones dudosas | ✗ por defecto (gated) | — | Etapas determinista/blocking resuelven sin LLM; menciones dudosas → cola revisión (no bloquea ingest) |

**Missing dependencies with no fallback:** Ninguna que bloquee el objetivo.
**Missing dependencies with fallback:** R2 (snapshot local), MiniMax LLM (determinista + cola).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest (workspace, ya en uso Fase 1-4) |
| Config file | `packages/*/vitest.config.ts` (nuevo `packages/tramitacion/vitest.config.ts`) |
| Quick run command | `pnpm --filter @obs/tramitacion test --run` |
| Full suite command | `pnpm -w test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TRAM-01 | parse votaciones Cámara (totales) desde fixture XML real | unit | `pnpm --filter @obs/tramitacion test --run parse-camara-votacion` | ❌ Wave 0 |
| TRAM-02 | parse tramitación + votaciones Senado desde fixtures XML reales | unit | `pnpm --filter @obs/tramitacion test --run parse-senado` | ❌ Wave 0 |
| TRAM-03 | normalizar ambas cámaras al modelo común (boletín PK) | unit | `pnpm --filter @obs/tramitacion test --run normalizar` | ❌ Wave 0 |
| TRAM-04 | ficha deriva estado/etapa de `descripcion` Senado | unit | `pnpm --filter @obs/tramitacion test --run parse-senado-tramitacion` | ❌ Wave 0 |
| TRAM-05 | timeline fusiona eventos de ambas cámaras cronológicamente | unit | `pnpm --filter @obs/tramitacion test --run timeline` | ❌ Wave 0 |
| TRAM-06 | totales SI/NO/Abst/Pareo + resultado mapeados correctamente | unit | incluido en parse tests | ❌ Wave 0 |
| TRAM-06b | voto-por-nombre Senado reconciliado; solo `confirmado` vincula | unit | `pnpm --filter @obs/tramitacion test --run reconciliar` | ❌ Wave 0 |
| TRAM-09 | provenance (origen/fecha/enlace) presente por fila | unit | incluido en parse/normalizar tests | ❌ Wave 0 |
| RLS | `anon` lee proyecto/votacion/timeline; NO lee `parlamentario.rut` | pgTAP | `supabase test db` (0008 tests) | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `pnpm --filter @obs/tramitacion test --run`
- **Per wave merge:** `pnpm -w test` + `supabase test db`
- **Phase gate:** suite completa verde + pgTAP RLS verde antes de `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `packages/tramitacion/` scaffold (package.json + vitest.config.ts + tsconfig + alta workspace/path-mapping)
- [ ] Fixtures XML reales capturados live (patrón Fase 3): `camara-votacion-boletin.xml` (14309), `camara-votacion-detalle.xml` (89178, para A1), `camara-sesiones-58.xml`, `senado-tramitacion.xml` (18296), `senado-votacion.xml` (14309)
- [ ] `supabase/migrations/0008_tramitacion.sql` + pgTAP de RLS público-read y guarda de `voto.parlamentario_id`
- [ ] Fixture mínimo de `correrPipeline` (writer espía in-memory, patrón Fase 4) para el test de reconciliación

*Fixtures: capturar con el mismo método de Fase 3 (curl live con UA + delay, guardar en `test/fixtures/`). Boletines con votos Senado validados: 14309, 10634, 11608, 15096, 16374.*

## Security Domain

> `security_enforcement: true`, `security_asvs_level: 1`, `security_block_on: high`.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Frontend público read-only; sin login en esta fase. |
| V3 Session Management | no | Sin sesiones de usuario. |
| V4 Access Control | yes | RLS Postgres: público-read EXPLÍCITO en proyecto/votacion/voto/tramitacion_evento; deny-by-default en maestra (rut/email NUNCA al anon). Verificar con pgTAP. |
| V5 Input Validation | yes | zod sobre cada respuesta XML (contrato de fuente); `boletin` param sanitizado (solo dígitos + guion) antes de query y antes del path `/proyecto/[boletin]`. |
| V6 Cryptography | no | Sin secretos nuevos; R2 SigV4 ya en @obs/ingest. |
| V12/V13 (API/SSRF) | yes | `assertAllowedUrl` (deny-by-default) antes de cada fetch; reuso de @obs/ingest. |

### Known Threat Patterns for {Next.js SSR + Postgres RLS + XML ingest}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Identidad falsa: voto atribuido al parlamentario equivocado | Tampering / falsa afirmación creíble (riesgo existencial #1) | `correrPipeline` + solo `confirmado` vincula; resto muestra nombre crudo con marca. NUNCA fuzzy sin umbral. |
| XML malformado / entity expansion (XXE/billion laughs) | DoS / disclosure | fast-xml-parser (sin expansión de entidades externas); zod valida shape; respuestas < 300 KB. Patrón T-03-09 de Fase 3. |
| SSRF vía URL de fuente | — | `assertAllowedUrl` (allowlist camara.cl/senado.cl). |
| RLS mal configurada expone rut/email de la maestra | Information Disclosure | pgTAP: `anon` NO lee `parlamentario.rut`; `voto.parlamentario_id` solo confirmado; deny-by-default heredado. |
| Path injection en `/proyecto/[boletin]` | Tampering | Validar `boletin` con regex `^\d{3,6}(-\d{1,2})?$` antes de query; usar `.eq()` parametrizado de supabase-js (no SQL string). |
| WAF gov bloquea por ráfaga | DoS auto-infligido | rate-limit 2-3s serial por host (LOCKED, @obs/ingest). |

## Sources

### Primary (HIGH confidence)
- **Live curl 2026-06-18** (UA Bot-Ciudadano/1.0, delay 2-3s) — los 4 endpoints críticos + legislaturas + sesiones + voto detalle:
  - `https://opendata.camara.cl/wscamaradiputados.asmx/getLegislaturas` (ID 58 = Numero 374 confirmado)
  - `https://opendata.camara.cl/camaradiputados/WServices/WSSala.asmx/retornarSesionesXLegislatura?prmLegislaturaID=58`
  - `https://opendata.camara.cl/camaradiputados/WServices/WSLegislativo.asmx/retornarVotacionesXAnno?prmAnno=2026`
  - `https://opendata.camara.cl/wscamaradiputados.asmx/getVotaciones_Boletin?prmBoletin=14309`
  - `https://opendata.camara.cl/camaradiputados/WServices/WSLegislativo.asmx/retornarVotacionDetalle?prmVotacionID=89178` (voto individual presente)
  - `https://tramitacion.senado.cl/wspublico/tramitacion.php?boletin=18296`
  - `https://tramitacion.senado.cl/wspublico/votaciones.php?boletin=14309`
- **Codebase** (`@obs/ingest`, `@obs/core` nombre.ts, `@obs/identity` parse-senado.ts seeder.ts, `@obs/adjudication` pipeline) — patrones de reuso verificados.
- **Summaries** 01-02, 03-03, 04-03 — contratos estables (Fetcher/correrPipeline/normalizarNombre.libre).

### Secondary (MEDIUM confidence)
- PROJECT.md STACK (Next 16 / fast-xml-parser / Server Components / pgmq) — corroborado con package.json instalado.
- WSDL discovery (`?WSDL` de wscamaradiputados/WSLegislativo/WSSala) — operaciones y params confirmados.

### Tertiary (LOW confidence)
- WebSearch opendata.camara.cl portal (corroboró que el WS vive en opendata, no en www.camara.cl/doGet) — solo direccional; los shapes vienen del curl live.

## Metadata

**Confidence breakdown:**
- Endpoints / shapes: HIGH — los 4 críticos validados live con respuestas reales 2026-06-18.
- Cruce cross-cámara por boletín: HIGH — confirmado con 18296-05 (ambas fuentes) y 14309-04 (votos ambas cámaras).
- Reuso de subsistemas (ingest/identity/adjudication): HIGH — patrones verificados en código + summaries.
- Modelo de datos / RLS: HIGH — derivado de shapes reales + patrón de migraciones existente.
- Frontend Next 16: MEDIUM-HIGH — scaffold confirmado; estado de Tailwind/shadcn no verificado (A3).
- A1 (voto individual Cámara): HIGH técnicamente (validado), pero requiere DECISIÓN del usuario sobre scope.

**Research date:** 2026-06-18
**Valid until:** ~2026-07-18 (30 días; los WS gov son estables, pero re-validar el sufijo de boletín y el encoding del Senado si pasa más tiempo). El `buildId` no aplica aquí (sin portal Next.js del Senado en esta fase — eso es Fase 6).
