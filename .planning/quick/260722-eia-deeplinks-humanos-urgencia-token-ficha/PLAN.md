---
quick: true
id: 260722-eia
title: Deep-links humanos + token de urgencia siempre visible en la ficha del proyecto
type: execute
autonomous: true
files_modified:
  - app/components/validacion-fuente.tsx
  - app/components/enlace-humano-proyecto.test.ts
  - app/components/ficha-header.tsx
  - app/components/proyectos-similares.tsx
  - app/app/proyecto/[boletin]/page.tsx
  - app/components/estado-actual-block.tsx
  - app/components/estado-actual-block.test.tsx
must_haves:
  truths:
    - "Ningún link visible en la ficha del proyecto apunta al endpoint wspublico/tramitacion.php (WS XML)"
    - "El header de la ficha ofrece 'Ver en la Cámara' cuando prm_id_camara != null (ej. 16456-35 → prmID=17024)"
    - "El estado de urgencia es visible en la ficha con 3 estados honestos (vigente / sin urgencia vigente / sin datos)"
  artifacts:
    - path: "app/components/validacion-fuente.tsx"
      provides: "helper enlaceHumanoProyecto(enlace, boletin)"
      contains: "export function enlaceHumanoProyecto"
    - path: "app/components/enlace-humano-proyecto.test.ts"
      provides: "unit del helper (wspublico→boletin_ini, verbatim, camara verbatim)"
  key_links:
    - from: "app/components/ficha-header.tsx"
      to: "enlaceHumanoProyecto"
      via: "sourceUrl del ProvenanceBadge del header"
      pattern: "enlaceHumanoProyecto"
    - from: "app/components/proyectos-similares.tsx"
      to: "enlaceHumanoProyecto"
      via: "provenance.sourceUrl de cada SearchResultCard"
      pattern: "enlaceHumanoProyecto"
---

<objective>
Defecto FUNDAMENTAL reportado por el operador en la ficha del proyecto (/proyecto/[boletin]):

1. El link "fuente oficial ↗" (header + cards de Similares) apunta a
   `proyecto.enlace` = `https://tramitacion.senado.cl/wspublico/tramitacion.php`
   (endpoint WS XML, ROTO para humanos; 3658/3659 filas en PROD). Debe redirigir a la
   ficha humana del Senado (`buildSenadoUrl(boletin)`), y ofrecer también el link Cámara
   cuando exista prm_id_camara.
2. El estado de urgencia (derivable de `tramitacion_evento`; 8092 eventos / 671 proyectos
   en PROD) no está SIEMPRE visible en la ficha: hoy solo aparece si hay urgencia vigente.
   Debe mostrarse con 3 estados honestos, sin fabricar dato ni insinuar.

Purpose: trazabilidad a la fuente que FUNCIONA para un humano (principio rector del
proyecto) + hecho de urgencia fechado y con fuente, siempre presente.
Output: helper `enlaceHumanoProyecto` + su unit; call sites de la ficha reruteados;
token de urgencia 3-estado en el bloque "¿Dónde está hoy?"; suite verde; deploy + verif BrowserOS.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
</execution_context>

<context>
@CLAUDE.md
@.planning/milestones/v6.0-phases/61-comp-comprensi-n-de-visualizaciones-loop-browseros/61-02-SUMMARY.md

<interfaces>
<!-- Contratos ya existentes en el repo. Usarlos directamente, sin explorar. -->

From app/components/validacion-fuente.tsx:
  export function buildSenadoUrl(boletin: string): string
    // → https://tramitacion.senado.cl/appsenado/templates/tramitacion/index.php?boletin_ini={boletin}
  export function buildCamaraUrl(boletin: string, prmId: string): string
    // → https://www.camara.cl/legislacion/ProyectosDeLey/tramitacion.aspx?prmID={prmId}&prmBOLETIN={boletin}

From app/components/estado-actual-block.tsx:
  export function urgenciaVigente(eventos: TramitacionEventoRow[]): { tipo: string; desde: Date } | null
  export interface EstadoActual { etapaLinea?; ultimoHito?; urgenciaVigente?: { tipo; desde: Date }; citacionVigente? }
  export function derivarEstadoActual(proyecto, eventos, citaciones?, hoy?): EstadoActual
  export function EstadoActualView({ estado }: { estado: EstadoActual })  // presentación pura, testeada por RTL
  export async function EstadoActualBlock({ boletin })  // lee proyecto+eventos+citaciones, deriva, renderiza

From app/components/provenance-badge.tsx:
  export interface ProvenanceBadgeProps { capturedAt: Date | null; sourceName: string; sourceUrl: string | null }
  // el link "fuente oficial ↗" solo aparece si sourceUrl pasa safeExternalHref

From app/lib/types.ts:
  interface ProyectoRow { boletin; enlace: string; prm_id_camara: string | null; origen; fecha_captura; etapa; estado; ... }
  interface TramitacionEventoRow { boletin; fecha; descripcion; enlace; origen; fecha_captura }

Call sites que renderizan proyecto.enlace como link (a reordenar):
  - app/components/ficha-header.tsx:64  → ProvenanceBadge sourceUrl={proyecto.enlace || null}
  - app/components/proyectos-similares.tsx:107 → provenance.sourceUrl: p.enlace ?? null (por card SearchResultCard)
  - (page.tsx IdeaMatrizSection ya pasa sourceUrl=null; ValidacionFuenteSection ya usa buildSenadoUrl/buildCamaraUrl — NO tocar)

Convenciones de diseño (CLAUDE.md + repo): chips cívicos vía tokens [var(--…)] u
utilidades registradas (NUNCA hex crudo — el guard de bento-guards.test.ts muerde);
tipografía .net-*/var(--text-*)/text-{size} del sistema; anti-insinuación (solo hecho
fechado con fuente, sin adjetivos — anti-insinuacion-guard.test.ts).
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Helper enlaceHumanoProyecto + unit</name>
  <files>app/components/validacion-fuente.tsx, app/components/enlace-humano-proyecto.test.ts</files>
  <read_first>
    - app/components/validacion-fuente.tsx (buildSenadoUrl :60-62, buildCamaraUrl :67-69 — reusar; NO duplicar host)
    - app/components/validacion-fuente.test.tsx (patrón de test del repo: vitest describe/it/expect)
    - app/lib/utils.ts safeExternalHref (ya usado por el badge — NO re-guardear aquí; el badge lo aplica al render)
  </read_first>
  <behavior>
    - wspublico + boletín con sufijo: enlaceHumanoProyecto("https://tramitacion.senado.cl/wspublico/tramitacion.php", "16456-35") === buildSenadoUrl("16456-35") (contiene "boletin_ini=16456-35", host appsenado)
    - wspublico con querystring/mayúsculas de host: mismo comportamiento (detección por host tramitacion.senado.cl + path que incluye /wspublico/ — case-insensitive en host, robusto a query params)
    - enlace NO-wspublico del Senado (ej. "https://www.senado.cl/appsenado/…/index.php?boletin_ini=16456-35") → devuelto VERBATIM
    - enlace de Cámara ("https://www.camara.cl/legislacion/ProyectosDeLey/tramitacion.aspx?prmID=17024&prmBOLETIN=16456-35") → VERBATIM
    - enlace vacío/whitespace → se respeta verbatim (string vacío pasa tal cual; el guard del badge decide si linkea)
    - enlace malformado que no parsea como URL → VERBATIM (no lanzar; try/catch al construir URL)
  </behavior>
  <action>
    En app/components/validacion-fuente.tsx exportar `enlaceHumanoProyecto(enlace: string, boletin: string): string`.
    Lógica: intentar `new URL(enlace)` dentro de try/catch; si parsea y `url.hostname.toLowerCase() === "tramitacion.senado.cl"` y
    `url.pathname.toLowerCase().includes("/wspublico/")`, devolver `buildSenadoUrl(boletin)`. En CUALQUIER otro caso
    (host distinto, path sin /wspublico/, o parseo fallido) devolver `enlace` VERBATIM. Detección por host+path, NUNCA por
    substring suelto del string completo (un boletín en el query no debe gatillar el rewrite). No usar hex; sin JSX aquí (helper puro).
    Crear app/components/enlace-humano-proyecto.test.ts con los casos de <behavior> (importar enlaceHumanoProyecto y buildSenadoUrl
    desde "./validacion-fuente"). Seguir el idiom vitest del repo (describe/it/expect, sin render — es helper puro).
  </action>
  <verify>
    <automated>cd app && pnpm test -- enlace-humano-proyecto</automated>
  </verify>
  <done>enlaceHumanoProyecto exportado; unit verde cubriendo wspublico→boletin_ini, verbatim Senado-no-ws, verbatim Cámara, y parseo fallido→verbatim.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Rerutear call sites de proyecto.enlace en la ficha (header + Cámara + Similares)</name>
  <files>app/components/ficha-header.tsx, app/components/proyectos-similares.tsx</files>
  <read_first>
    - app/components/ficha-header.tsx (ProvenanceBadge :60-66; importa ProvenanceBadge, sourceLabel)
    - app/components/proyectos-similares.tsx (map de SearchResultCard :96-110, provenance.sourceUrl :107)
    - app/components/provenance-badge.tsx (ProvenanceBadgeProps; el link solo aparece si sourceUrl pasa safeExternalHref)
    - app/components/search-result-card.tsx (recibe provenance: ProvenanceBadgeProps)
    - app/components/validacion-fuente.tsx (buildCamaraUrl para el link Cámara del header)
  </read_first>
  <behavior>
    - ficha-header: el ProvenanceBadge del header recibe sourceUrl = enlaceHumanoProyecto(proyecto.enlace || "", proyecto.boletin) || null (nunca la URL wspublico cruda). Si el enlace era wspublico, el href resultante apunta a appsenado (boletin_ini).
    - ficha-header: cuando proyecto.prm_id_camara != null, se renderiza además un link "Ver en la Cámara ↗" con buildCamaraUrl(proyecto.boletin, proyecto.prm_id_camara), target=_blank rel="noopener noreferrer", usando tokens de diseño existentes (text-accent-product underline …, espejo del link Cámara de validacion-fuente.tsx:135-146). prm_id_camara null → NO se renderiza (fail-honest).
    - proyectos-similares: cada card recibe provenance.sourceUrl = enlaceHumanoProyecto(p.enlace ?? "", p.boletin) || null (nunca wspublico crudo).
  </behavior>
  <action>
    ficha-header.tsx: importar enlaceHumanoProyecto y buildCamaraUrl de "@/components/validacion-fuente". Cambiar el
    sourceUrl del ProvenanceBadge a `enlaceHumanoProyecto(proyecto.enlace || "", proyecto.boletin) || null`. Añadir, tras el
    ProvenanceBadge, un link condicional Cámara SOLO si `proyecto.prm_id_camara` no es null — reusar las mismas clases del link
    Cámara existente en validacion-fuente.tsx:135-146 (text-accent-product underline underline-offset-2 hover:opacity-80
    focus-visible:outline… + target/rel), aria-label "Ver en la Cámara (abre en nueva pestaña)". No introducir hex; usar solo
    utilidades/tokens ya presentes en el repo.
    proyectos-similares.tsx: importar enlaceHumanoProyecto y cambiar `sourceUrl: p.enlace ?? null` a
    `sourceUrl: enlaceHumanoProyecto(p.enlace ?? "", p.boletin) || null`.
    NO tocar: page.tsx IdeaMatrizSection (ya sourceUrl=null), ValidacionFuenteServerSection (ya usa buildSenadoUrl/buildCamaraUrl),
    ni los enlaces por-evento del TimelineView (esos son event.enlace, fuera de alcance — el operador reportó header + Similares).
  </action>
  <verify>
    <automated>cd app && pnpm test -- ficha-header proyectos-similares; pnpm exec tsc --noEmit</automated>
  </verify>
  <done>Header y cards de Similares nunca emiten href a wspublico/tramitacion.php; header muestra link Cámara cuando prm_id_camara != null; tsc limpio. (Si no existe test previo de estos componentes, el executor añade uno mínimo de render que asserta el href reruteado — mirar patrón de search-result-card.test.tsx / provenance-badge.test.tsx.)</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Token de urgencia SIEMPRE visible (3 estados honestos) en el bloque "¿Dónde está hoy?"</name>
  <files>app/components/estado-actual-block.tsx, app/components/estado-actual-block.test.tsx</files>
  <read_first>
    - app/components/estado-actual-block.tsx (urgenciaVigente :51-74; EstadoActual :20-29; derivarEstadoActual :125-164; EstadoActualView :171-223; EstadoActualBlock :230-300)
    - app/components/estado-actual-block.test.tsx (fixtures makeProyecto/makeEvento; patrón RTL render/screen)
    - app/components/provenance-badge.tsx (para el tono "según {fuente} al {fecha}" — solo hecho fechado con fuente)
    - app/lib/format.ts (fechaCorta, relativeTimeEs — ya usados por el bloque)
  </read_first>
  <behavior>
    Nuevo estado 3-valores del token de urgencia (extender EstadoActual/derivarEstadoActual sin romper la firma):
    - (a) urgencia vigente: hay eventos de tramitación Y urgenciaVigente(eventos) != null → token "Urgencia: {tipo}" + "desde el {fecha}" + fuente ("según {sourceLabel(origen)} al {fecha_captura}"). Mantiene el texto existente sin adjetivos.
    - (b) tramitación presente pero sin urgencia vigente: eventos.length > 0 Y urgenciaVigente == null → token "Sin urgencia vigente" (hecho negativo honesto, NO "—", NO adjetivo).
    - (c) sin datos de tramitación: eventos.length === 0 → token OMITIDO (o "—" según convención del bloque, que ya omite líneas no derivables). No fabricar.
    - El token es SIEMPRE parte del render en (a) y (b); solo se omite en (c).
    - Anti-insinuación: solo hecho + fecha + fuente; sin "importante"/"clave"/"prioridad"/juicio.
  </behavior>
  <action>
    Extender EstadoActual con un campo de estado de urgencia de 3 valores (p.ej. `urgenciaEstado?: { kind: "vigente"; tipo: string; desde: Date } | { kind: "sin-vigente" }`)
    derivado en derivarEstadoActual: si eventos.length === 0 → dejar el campo ausente (estado c, se omite); si urgenciaVigente != null → kind "vigente"
    (conservando el campo urgenciaVigente existente para no romper al stepper que lo consume vía derivarEstadoActual); si eventos.length > 0 y sin vigente → kind "sin-vigente".
    En EstadoActualView renderizar el token de urgencia a partir de urgenciaEstado: (a) reusar el texto "Urgencia {tipo} vigente desde el {fechaCorta} ({relativeTimeEs})";
    (b) render "Sin urgencia vigente"; ambos con estilo de chip/línea usando tokens de diseño existentes (NUNCA hex — el guard bento muerde), tipografía del sistema.
    Para la FUENTE del token: EstadoActualBlock ya lee eventos con origen+fecha_captura; pasar a la vista el origen y el fecha_captura más reciente de los eventos
    (mismo patrón "más reciente" que TramitacionSection en page.tsx:435-439) y renderizar "según {sourceLabel(origen)} al {fecha corta}". Si no hay eventos con fecha_captura, omitir la coletilla de fuente (no fabricar).
    Actualizar estado-actual-block.test.tsx con los 3 estados (a/b/c) y un assert anti-insinuación mínimo (el token no contiene adjetivos de juicio). Mantener verdes los tests existentes de derivarEstadoActual (la firma de 2..4 args no cambia).
  </action>
  <verify>
    <automated>cd app && pnpm test -- estado-actual-block; pnpm exec tsc --noEmit</automated>
  </verify>
  <done>El bloque "¿Dónde está hoy?" muestra el token de urgencia en estados (a) y (b), lo omite en (c); test cubre los 3 estados + anti-insinuación; tsc limpio.</done>
</task>

<task type="auto">
  <name>Task 4: Suite completa + guards verdes (app)</name>
  <files>app/</files>
  <read_first>
    - app/lib/anti-insinuacion-guard.test.ts (escanea fuentes por vocabulario insinuante)
    - app/lib/bento-guards.test.ts (guard anti-hex-crudo)
  </read_first>
  <action>
    Correr la suite completa de app y tsc. Resolver cualquier fallo introducido por Tasks 1-3 (imports, tipos, snapshots RTL, guards
    anti-insinuación / anti-hex). NO introducir hex crudo ni vocabulario insinuante en los nuevos strings del token de urgencia ni en el link Cámara.
  </action>
  <verify>
    <automated>cd app && pnpm test && pnpm exec tsc --noEmit</automated>
  </verify>
  <done>`pnpm test` (app) verde completo incluyendo anti-insinuacion-guard y bento-guards; `tsc --noEmit` limpio.</done>
</task>

<task type="auto">
  <name>Task 5: Deploy Cloudflare (Docker node:22-slim + wrangler global OAuth)</name>
  <files>app/.open-next/</files>
  <read_first>
    - .planning/milestones/v6.0-phases/61-comp-comprensi-n-de-visualizaciones-loop-browseros/61-02-SUMMARY.md (runbook completo, gotchas)
    - CLAUDE.md (build OpenNext en Linux/Docker — Windows produce worker roto 500ea)
  </read_first>
  <action>
    Deploy siguiendo el runbook de 61-02-SUMMARY: build OpenNext dentro de Docker `node:22-slim` (NUNCA Windows, NUNCA node:22-alpine —
    workerd requiere glibc). Pre-copiar el source a un path local no-OneDrive (C:/Temp/obs-build) vía robocopy/PowerShell para evitar el
    cuello de botella virtiofs de OneDrive; construir `.open-next` en el volumen Docker; extraer a app/.open-next vía `docker cp`.
    Deploy con wrangler 4 GLOBAL vía OAuth ya autenticado:
    `node "C:/Users/Carlo/AppData/Roaming/npm/node_modules/wrangler/bin/wrangler.js" deploy --config wrangler.jsonc` desde el dir app/.
    (El path CI está bloqueado: falta CLOUDFLARE_API_TOKEN en Cuchecorp/gov-map — usar el path local.)
    Registrar el Version ID del output de wrangler.
  </action>
  <verify>
    <automated>node -e "fetch('https://observatorio-congreso.thevalis.workers.dev/proyecto/16456-35').then(r=>{if(r.status!==200)process.exit(1);console.log('200 OK')})"</automated>
  </verify>
  <done>Deploy exitoso; Version ID capturado; /proyecto/16456-35 responde 200 en el worker de PROD.</done>
</task>

<task type="auto">
  <name>Task 6: Verificación post-deploy con BrowserOS + evidencia en SUMMARY</name>
  <files>.planning/quick/260722-eia-deeplinks-humanos-urgencia-token-ficha/SUMMARY.md</files>
  <read_first>
    - scripts/bros-cli.mjs (wrapper MCP BrowserOS: open/content/links/shot/close; gotchas: esperar 4-5s tras open, page id incrementa, reintentar screenshot 1x)
    - .planning/milestones/v6.0-phases/61-02-SUMMARY.md (formato de tabla LIVE Verification)
  </read_first>
  <action>
    Con el wrapper scripts/bros-cli.mjs (o los tools MCP BrowserOS si están registrados en sesión), abrir en página OCULTA
    https://observatorio-congreso.thevalis.workers.dev/proyecto/16456-35, esperar 4-5s, y extraer content + links. Verificar los 3
    criterios del operador: (a) NINGÚN link visible apunta a wspublico/tramitacion.php (grep de los links extraídos → 0 matches de
    "/wspublico/"); (b) link Cámara presente con prmID=17024 (grep de los links → contiene "prmID=17024"); (c) el token de urgencia es
    visible en el content (buscar "Urgencia" o "Sin urgencia vigente"). Capturar un screenshot como evidencia. Cerrar la página.
    Escribir SUMMARY.md en el task dir con: cambios por archivo, Version ID del deploy, y la tabla de evidencia BrowserOS (los 3 criterios
    con su resultado). Registrar cualquier desviación.
  </action>
  <verify>
    <human-check>SUMMARY.md contiene la tabla de evidencia BrowserOS con los 3 criterios verificados (0 links wspublico, link Cámara prmID=17024 presente, token urgencia visible) sobre /proyecto/16456-35 en PROD.</human-check>
  </verify>
  <done>SUMMARY.md escrito con Version ID + evidencia BrowserOS de los 3 criterios; screenshot capturado.</done>
</task>

</tasks>

<verification>
- `enlaceHumanoProyecto` reruta wspublico→appsenado y respeta todo lo demás verbatim (unit).
- Header + Similares nunca emiten href a wspublico/tramitacion.php; header ofrece link Cámara cuando prm_id_camara != null.
- Token de urgencia visible con 3 estados honestos; sin insinuación; sin hex crudo.
- `pnpm test` (app) + `tsc --noEmit` verdes.
- Deploy LIVE + BrowserOS confirma los 3 criterios sobre /proyecto/16456-35 (prmID=17024).
</verification>

<success_criteria>
Un ciudadano en /proyecto/16456-35 (PROD) puede: (1) hacer clic en la fuente del Senado y
aterrizar en la FICHA HUMANA (no el XML del WS); (2) ver también el link a la Cámara; (3)
leer el estado de urgencia del proyecto siempre, como hecho fechado con fuente, sin adjetivos.
</success_criteria>

<output>
Crear `.planning/quick/260722-eia-deeplinks-humanos-urgencia-token-ficha/SUMMARY.md` al terminar.
</output>
