# Phase 50: FIX — Quick wins de bugs del diagnóstico 2026-07-02 (P1) - Context

**Gathered:** 2026-07-02
**Status:** Ready for planning
**Mode:** Autonomous (decisiones derivadas del diagnóstico `.planning/DIAGNOSTICO-govmap-2026-07-02.md` §1, que es la discusión — cada bug trae file:line y fix prescrito; scout de código verificó cada sitio)

<domain>
## Phase Boundary

Eliminar 11 bugs de código acotados y verificados en vivo (B1, B6, B7, B8, B9, B10, B12, B14, B15, B17 + honest-state repetido). Solo código del frontend `app/`: cero DDL, cero RPC nueva, cero flag flipeado, cero deploy (el deploy es checkpoint operador aparte que cubre F45+F46+F50). Los bugs de legibilidad profunda (B3, B4, B5, B11, B19) son Phase 51; los cruces nuevos son Phase 52; B20/B21 (RedGraph) esperan la decisión de flip NET; B26/B27/B28 son operador.

</domain>

<decisions>
## Implementation Decisions

### B1 — Pill del home roto
- Reemplazar `15234-07` (verificado 2026-07-02: NO existe en PROD) por **`14309-04`** (existe, tiene ficha + idea matriz + 7 votaciones — verificado por psql). NO construir validación dinámica contra la DB (el home es estático y los pills son copy LOCKED del UI-SPEC §6; cambiar el valor, no la arquitectura).
- Actualizar los tests que referencian `15234-07` como pill del home (`app/page.test.tsx`). `components/search-result-card.test.tsx` usa el mismo string como fixture arbitrario — puede quedarse (no es el pill), a discreción del executor.

### B6 — Umbral ámbar permanente
- `esStale()` (`lib/format.ts:56-58`) pasa de 48 h fijas a **umbral por cadence de fuente**: default **14 días** (ingesta semanal ⇒ 2× cadence = margen honesto), con parámetro opcional para fuentes con cadence distinto. Firma retro-compatible (parámetro con default) para no tocar todos los call sites.
- El significado se mantiene: ámbar = "más viejo de lo que la cadence de ingesta explica", no "más viejo que 2 días".
- Actualizar el comentario/docstring UI-SPEC §4 y los tests de `esStale`.

### B7 — Agenda traga errores de DB
- `CitacionesSection` y `SalaTableServer` (`app/agenda/page.tsx:276-284, 404-421`): chequear `.error` de cada respuesta Supabase y **`throw`** (doctrina #34, patrón exacto de las demás secciones del sitio — ver ContratosSection/HeaderSection). Nunca renderizar "No hay citaciones esta semana" ante fallo de red.
- El error lo captura el `error.tsx` de `/agenda` (creado en B9).

### B8 — "Cámara origen desconocida"
- `components/camara-chip.tsx:32`: el fallback deja de ser un chip-alarma literal. Para eventos donde la cámara no aplica o no viene (tipo `informe`), **omitir el chip** (null) en vez de fabricar un label; si el diseño exige placeholder, usar copy neutro sin la palabra "desconocida". Decisión fina de omitir-vs-neutro a discreción del executor según los call sites del timeline.

### B9 — error.tsx faltantes ×4
- Crear `error.tsx` para `/proyecto/[boletin]`, `/parlamentarios`, `/buscar`, `/agenda` **espejando el patrón existente** de `app/parlamentario/[id]/error.tsx` (mismo copy es-CL, misma estructura, botón reintentar). Cero inglés.

### B10 — Copy lobby hardcodeado a la Cámara
- `components/lobby-de-parlamentario.tsx`: parametrizar el copy por cámara del parlamentario (senado → "el Senado (senado.cl…)" o registro que corresponda a la fuente real de la fila; diputados → Cámara). La cámara ya está disponible en la ficha (header). Trazabilidad: el enlace debe seguir apuntando a la fuente REAL del dato (fuente de la fila), no a un supuesto.

### B12 — Locale mal capitalizado
- `app/agenda/page.tsx:216,242,304,315`: el problema es `capitalize` de Tailwind sobre TODO el string ("2 De Julio"). Quitar `className="capitalize"` y capitalizar solo la primera letra en el formatter (helper en `lib/format.ts` o inline). Resultado: "Jueves 2 de julio".

### B14 — Votación sin desenlace
- `components/votacion-card.tsx:72`: cuando `resultado` es null, en vez de omitir la frase (decisión Phase 22, superada por el diagnóstico), mostrar línea honest-state explícita: **"Desenlace no informado por la fuente."** (mismo estilo que los demás honest-states). Totales/barra intactos. Actualizar `votacion-card.test.tsx:62` (hoy asierta la omisión).

### B15 — Copy Mensaje
- `components/autores-list.tsx`: si `iniciativa`/origen del proyecto es Mensaje → **"Iniciativa del Ejecutivo (Mensaje)."**; solo las Mociones sin autores dicen "Autores no informados." El campo que distingue Mensaje/Moción ya existe en `proyecto` (`iniciativa`/`origen` — verificar cuál está poblado y pasarlo como prop).

### B17 — Guard fecha en VersionRow
- `components/patrimonio-de-parlamentario.tsx:383` (`fechaCorta(new Date(version.fecha_presentacion))`) y `:607` (misma expresión en comparación): aplicar el mismo guard WR-03 que ya usa el chart (`:130-134` — null/empty/no-ISO → fallback honesto "fecha no informada"), extraído a helper compartido si es limpio.

### Honest-state repetido
- `components/votos-por-parlamentario.tsx:228` y `components/voto-ficha-row.tsx:89`: "De qué trata: no disponible aún" se muestra **a lo más una vez por sección** (nota a nivel de sección cuando ≥1 arco no tiene idea matriz), no por cada arco/fila. La honestidad va una vez; la repetición es ruido. Actualizar tests (`votos-por-parlamentario.test.tsx:210-217`).

### Claude's Discretion
- Copy exacto de los honest-states nuevos (dentro de la voz editorial DESIGN-SYSTEM §6, sin vocabulario prohibido).
- B8: omitir chip vs placeholder neutro, según call sites.
- Extraer o no helpers compartidos (guard de fecha, capitalización) — según DRY vs blast radius.
- Orden de los fixes en planes/commits (sugerido: un commit atómico por bug).

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `app/parlamentario/[id]/error.tsx` y `app/contraparte/[id]/error.tsx` — patrón de error boundary a espejar (B9).
- Guard WR-03 ya escrito en `patrimonio-de-parlamentario.tsx:130-134` (slice ISO sin `new Date`) — patrón para B17.
- `lib/format.ts` — `fechaCorta`, `esStale`, `extractoIdea` viven aquí; B6 y B12 tocan este archivo.
- Patrón throw-on-`.error` (doctrina #34) en todas las secciones salvo agenda — copiar para B7.

### Established Patterns
- Suite actual: **377 verde** en `app/` (`pnpm --filter app test`), `tsc -b` limpio, `lockdown-guard.test.ts` = muralla PII (Camino A: toda lectura vía RPC allowlisted o tabla public-read; esta fase NO agrega RPCs).
- Tests RTL colocados junto al componente (`*.test.tsx`); negative-match de vocabulario prohibido en copy nuevo.
- Commits atómicos por fix con prefijo `fix(50):`.

### Integration Points
- `app/app/page.tsx` (B1) · `app/lib/format.ts` (B6, B12 helper) · `app/app/agenda/page.tsx` (B7, B12) · `app/components/camara-chip.tsx` (B8) · `app/app/{proyecto/[boletin],parlamentarios,buscar,agenda}/error.tsx` nuevos (B9) · `app/components/lobby-de-parlamentario.tsx` (B10) · `app/components/votacion-card.tsx` (B14) · `app/components/autores-list.tsx` (B15) · `app/components/patrimonio-de-parlamentario.tsx` (B17) · `app/components/{votos-por-parlamentario,voto-ficha-row}.tsx` (honest-state repetido).

</code_context>

<specifics>
## Specific Ideas

- Boletín real para el pill: **14309-04** (verificado en PROD con ficha + votaciones; es además el proyecto usado como evidencia del diagnóstico). Alternativa igualmente válida: 18296-05.
- B14 revierte deliberadamente una decisión de Phase 22 ("resultado null omite la frase") — el diagnóstico en vivo mostró que la omisión se lee como inconsistencia entre cards de Cámara y Senado.
- Restricciones vigentes LOCKED: doctrina anti-insinuación (nunca causalidad, fuente en todo dato), Camino A (RPC nueva ⇒ allowlist del guard — esta fase no debería necesitar ninguna), MONEY gated (F13), builds de deploy solo Docker Linux (fuera de fase).

</specifics>

<deferred>
## Deferred Ideas

- B3 (URIs CPLT en lista), B4 (comparador), B5 (rebeldías), B11 (caveat identidad por fila), B19 (urgencias duplicadas) → **Phase 51**.
- B13 (nombre comisión truncado — ingesta), B16 (distrito diputados — datos), B18 (pertinencia búsqueda — producto/datos), B22 (cap 1000 — necesita RPC count), B23 (noIngestado hardwired — tocará VotosSection en Phase 51 junto al resumen), B24 (paginación/onboarding/LEGISLATURA hardcode), B25 (forceMount peso) → backlog / Phase 51+.
- B20/B21 (RedGraph huérfanos + /red sin selector) → resolver antes del flip `NET_PUBLIC_ENABLED` (P0 operador decide cuándo).
- B26 (rotar DB password), B27 (CI quality gate), B28 (legacy JWT) → operador.

</deferred>
