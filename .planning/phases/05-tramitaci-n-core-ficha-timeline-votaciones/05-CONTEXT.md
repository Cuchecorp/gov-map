# Phase 5: Tramitación Core — Ficha + Timeline + Votaciones - Context

**Gathered:** 2026-06-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Primer valor ciudadano end-to-end VISIBLE: conectores reales de tramitación + votaciones de ambas cámaras, modelo `Proyecto`/`Votacion`, timeline por boletín cruzando cámaras, y un frontend Next.js donde un ciudadano ve la ficha de un proyecto con su estado, timeline y votaciones — cada dato con frescura + enlace a fuente. Cubre TRAM-01 (votaciones/sesiones Cámara doGet), TRAM-02 (tramitación/votaciones Senado wspublico XML), TRAM-03 (modelo Proyecto+Votacion normalizado), TRAM-04 (ficha con estado/etapa), TRAM-05 (timeline cruzado por boletín), TRAM-06 (resultados de votación), TRAM-09 (indicador de frescura + enlace fuente). NO incluye citaciones/tabla semanal (Fase 6), ni búsqueda semántica (Fase 7), ni voto INDIVIDUAL por diputado (eso es P3/v2, bloqueado por opendata votaciones — aquí votaciones a nivel agregado/totales + el voto-a-voto del Senado que sí está en wspublico).
</domain>

<decisions>
## Implementation Decisions

### Alcance, stack, UX y guarda de identidad
- **Alcance de ingesta inicial (acotado, live):** votaciones de las sesiones de la **legislatura vigente (ID 58)** vía Cámara `doGet.asmx` (`getSesiones?prmLegiId=58` → `getVotacionesPorSesion`), y la **tramitación de los boletines** que aparezcan en esas votaciones vía Senado `wspublico/tramitacion.php?boletin` + Cámara `getBoletin`. Expandible (más legislaturas) después. NO el universo histórico completo de golpe (WAF + tiempo). Rate-limit 2-3s respetado (framework Fase 1).
- **Stack frontend (LOCKED):** Next.js 16 App Router en `/app`; **Server Components** que leen de Supabase (cliente `@supabase/supabase-js` con la service/anon key desde backend); **Tailwind + shadcn/ui** para componentes; todas las llamadas a fuentes gubernamentales SOLO en backend/conectores (CORS/WAF), nunca desde el navegador. Corre localmente (deploy a remoto diferido por credenciales).
- **UX ficha + timeline:**
  - **Ficha de proyecto** (`/proyecto/[boletin]`): título, boletín, iniciativa (mensaje/moción), cámara de origen, autores, estado/etapa actual de tramitación, materia.
  - **Timeline**: eventos de tramitación de AMBAS cámaras fusionados por número de boletín en orden cronológico (urgencias, informes, oficios, etapas) — cada evento con fecha, cámara, y enlace a la fuente.
  - **Votaciones**: totales SI/NO/Abstención/Pareo + resultado + quórum + etapa; para el Senado, el desglose voto-a-voto por parlamentario (de `wspublico/votaciones.php?boletin`); para la Cámara, los totales (el voto individual por diputado es v2).
  - **Frescura + fuente (TRAM-09):** cada dato muestra un badge "actualizado hace X" por fuente y un enlace directo a la fuente oficial (la procedencia capturada en ingesta de Fase 1).
- **Guarda de identidad en capa pública (LOCKED):** cuando una votación del Senado trae el voto por nombre, el parlamentario se muestra vinculado a su ficha SOLO si el vínculo identidad está `confirmado` (Fase 4); si está `probable`/`no_confirmado`, se muestra el nombre crudo tal como viene de la fuente con una marca visible "identidad no confirmada" — NUNCA se afirma una identidad dudosa como hecho. (Reconciliar esos votos-por-nombre contra la maestra usa el pipeline de Fase 4.)

### Modelo de datos
- Migración nueva: `proyecto` (boletin PK, titulo, iniciativa, camara_origen, autores, materia, estado/etapa, provenance), `votacion` (id, boletin FK, fecha, etapa, tipo, quorum, resultado, totales si/no/abst/pareo, camara, provenance), `voto` (votacion_id, mencion_nombre, parlamentario_id nullable→solo si confirmado, seleccion si|no|abst|pareo) para el desglose del Senado. `tramitacion_evento` (boletin, fecha, camara, tipo, descripcion, enlace) para el timeline. RLS: lectura pública de proyecto/votacion/timeline (son datos públicos); `voto.parlamentario_id` solo poblado si confirmado.
- Crudo (XML/JSON) a R2 cuando haya cred (hoy local/snapshot); normalizado a Postgres local.

### Claude's Discretion
- Endpoints finos de la Cámara (método exacto de sesiones/votaciones de la legislatura vigente — research lo confirma en vivo), parsing XML del Senado, esquema fino de columnas, componentes shadcn concretos, y la mecánica de fusión del timeline quedan a discreción respetando lo anterior. El research valida endpoints en vivo.
</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `@obs/ingest` (Fase 1): Fetcher (rate-limit/UA/robots/SSRF allowlist), R2Store, XML parsing, provenance, cola pgmq, BaseConnector. Los conectores Cámara/Senado son consumidores del framework.
- `@obs/identity` + `@obs/adjudication` (Fases 3-4): reconciliar votos-por-nombre del Senado contra la maestra (186 reales) antes de vincular.
- Migraciones 0001-0007 + RLS deny-by-default + pgTAP. Supabase local.
- Next.js 16 ya scaffoldeado en `/app` (Fase 1).

### Established Patterns
- TDD vitest + mock fetch + fixtures reales; pgTAP; provenance; allowlist ya incluye camara.cl/senado.cl.
- Endpoints confirmados live: doGet.asmx (getLegislaturas/getSesiones/getVotacionesPorSesion/getBoletin), Senado wspublico tramitacion.php/votaciones.php.

### Integration Points
- Fase 6 agrega citaciones/tabla semanal (reusa conectores). Fase 7 agrega búsqueda semántica sobre los proyectos cargados aquí.
- La ficha de parlamentario (frente 2, milestone siguiente) reutilizará votaciones/proyectos.
</code_context>

<specifics>
## Specific Ideas

- El número de boletín es la llave que cruza ambas cámaras — el timeline lo usa para fusionar.
- Trazabilidad sobre interpretación: cada dato con fuente/fecha/enlace; nada de causalidad.
- Votos del Senado por nombre → reconciliar con Fase 4; solo `confirmado` se muestra como vínculo.
</specifics>

<deferred>
## Deferred Ideas

- Citaciones de comisiones + tabla semanal de sala → Fase 6.
- Búsqueda semántica + fichas estructuradas por idea matriz → Fase 7.
- Voto individual por diputado (opendata.camara.cl votaciones) → v2/P3 (sin validar).
- Deploy a remoto + R2 live → pendiente credenciales.
</deferred>
