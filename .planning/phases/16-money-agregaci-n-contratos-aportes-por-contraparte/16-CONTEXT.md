# Phase 16: MONEY Agregación — Contratos/aportes por contraparte - Context

**Gathered:** 2026-06-19
**Status:** Ready for planning
**Mode:** mvp

<domain>
## Phase Boundary

El ciudadano ve contratos y aportes **agregados por contraparte** (donante o empresa), usando las sub-maestras `contratista` (Phase 14) y `donante` (Phase 15) — hechos públicos agregados con fuente, sin insinuación. Consumidor puro de los bloques MONEY ya construidos; NO nuevos conectores. Requirement: MONEY-05.

**Gate de exposición (heredado de Phase 13):** toda ruta pública MONEY nace detrás de `moneyPublicEnabled()` (default OFF); las sub-maestras siguen deny-by-default a `anon`. No se enciende nada hasta el sign-off legal (F13).

**Regla rectora dura:** la correlación donación→voto está PROHIBIDA. La vista agregada NUNCA compone una contraparte de dinero junto a un voto en una sola unidad de UI, ni usa lenguaje causal/afinidad. Describe hechos públicos independientes ("X aparece como donante/contratista N veces en periodo Y") sin afirmar conexión ni intención.

</domain>

<decisions>
## Implementation Decisions

### Qué contrapartes se exponen (PII vs fiscalización — principio de finalidad del dato)
- **Solo persona JURÍDICA (empresas)** se agrega públicamente CON nombre: son entidades públicas que contratan con el Estado / financian campañas — no son PII, y su actividad pública es legítima de fiscalizar.
- **Persona NATURAL (individuos privados)** NO se expone por nombre: `contratista.nombre`/`donante.nombre` son "uso interno, nunca público" para personas naturales (PII, terceros). Quedan internas/deny-by-default. (La excepción es un parlamentario confirmado, que es funcionario público — pero ese es el enlace ya existente, no la contraparte privada.)
- Clave: contratista por `rut_proveedor`; donante por `donante_id` (SERVEL sin RUT → nombre normalizado). Vista pública filtra a `tipo_persona = 'juridica'`.
- Hechos: conteo + total + lista de filas (contrato/aporte) con fuente/fecha/enlace por fila; "X aparece como contratista/donante N veces en periodo Y".

### Implementación (DB) + gate
- **RPC security-definer** `agregado_por_contraparte` (y/o listado) que expone SOLO los campos seguros (nombre de jurídica + agregados + filas con fuente/fecha/enlace), y **NUNCA proyecta el nombre interno de una persona natural** ni RUT de donante. Las sub-maestras siguen deny-by-default a `anon`; el acceso público va solo por el RPC filtrado.
- Gate: la ruta y el RPC público van detrás de `moneyPublicEnabled()` (default OFF).
- Migración `0025_agregacion.sql` (siguiente tras 0024); pgTAP que **afirma que el RPC no expone nombres de persona natural** (filtra a jurídica) y que las sub-maestras siguen deny-by-default. Remote apply = OPERATOR checkpoint.

### UI + anti-insinuación
- Nueva ruta `/contraparte/[id]` (gated por `moneyPublicEnabled()`, heading ausente con OFF) que muestra los hechos agregados de esa contraparte (empresa): contratos y aportes en CARRILES SEPARADOS, cada fila con `ProvenanceBadge` + fecha + enlace.
- Anti-insinuación (regla dura): NUNCA componer una contraparte de dinero junto a un voto en una unidad de UI; sin lenguaje causal/afinidad; "hechos públicos independientes sin afirmar conexión ni intención". Atribución por dataset (ChileCompra "mención de la fuente"; SERVEL "términos por verificar").
- Si la contraparte tiene un enlace CONFIRMADO a un parlamentario (del retrofit 14-04 / pipeline), se muestra como hecho separado y trazado, NUNCA insinuando correlación donación→voto.

### Claude's Discretion
- Nombre exacto del RPC/tablas/columnas y si se usa vista materializada (pg_cron) o RPC en runtime — preferir RPC simple para MVP salvo que el volumen lo exija.
- Layout exacto de `/contraparte/[id]` (cómo listar contrapartes para llegar a la ruta — listado o búsqueda).

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- Sub-maestras: `contratista` (`rut_proveedor` PK, `nombre` interno, `tipo_persona`, provenance) en 0023; `donante` (`donante_id` PK, `rut_donante` nullable, `nombre` interno, `tipo_persona`, provenance) en 0024. Ambas deny-by-default + revoke.
- Tablas de hechos: `contrato` (0023) + `aporte` (0024), ambas public-read, con provenance + fecha por fila.
- Gate `app/lib/money-gate.ts` (`moneyPublicEnabled`); patrón de sección/ruta gateada (Phase 14/15); `ProvenanceBadge`; `sourceLabel()` (tiene ramas chilecompra + servel).
- RLS deny-by-default + revoke + RPC security-definer (0021/0022/0023/0024) como patrón.

### Established Patterns
- Migración SQL + pgTAP; RPC security-definer `*_de_parlamentario`. Aquí el RPC es `*_por_contraparte` y filtra a jurídica.
- Secciones/rutas de ficha con carril propio (`mt-12`) + 3 estados honestos + content-gate anti-insinuación.

### Integration Points
- Nueva ruta `app/app/contraparte/[id]/page.tsx` (gated). Posible listado `app/app/contraparte/page.tsx`.
- Lee `contrato`/`aporte` + sub-maestras vía el RPC agregador.

</code_context>

<specifics>
## Specific Ideas

- Phase 16 es consumidor puro: cero conectores nuevos, cero ingesta. Solo agregación + vista.
- El riesgo central es de UI/semántica, no de datos: no insinuar. Contratos y aportes en carriles separados; jamás junto a votos; sin lenguaje de correlación.
- Persona natural privada nunca expuesta por nombre — el pgTAP lo hace verificable, no solo convención.

</specifics>

<deferred>
## Deferred Ideas

- Grafo de influencia (NET) — Phase 18, tras la compuerta legal NET (Phase 17).
- Encendido real de `MONEY_PUBLIC_ENABLED` + sign-off legal — operador (F13).
- Vista materializada por pg_cron si el volumen lo exige (MVP = RPC en runtime salvo necesidad).
