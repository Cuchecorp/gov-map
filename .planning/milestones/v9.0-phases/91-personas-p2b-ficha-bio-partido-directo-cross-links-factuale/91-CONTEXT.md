# Phase 91: PERSONAS P2b — Ficha bio + partido directo + cross-links factuales - Context

**Gathered:** 2026-07-22
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous — recommendations auto-accepted per run directive)

<domain>
## Phase Boundary

Montar el titular de la pasada 2: ficha del parlamentario 360 con biografía oficial (región/distrito, períodos, profesión si existe, comisiones) + PARTIDO DIRECTO correlacionado en todas las superficies (ficha, filtros — cierra FILT-01 —, cruces) + cross-links factuales entre parlamentarios. Los DATOS ya existen (Phase 90: parlamentario.partido refrescado 186/186, parlamentario_militancia 363, comision 34, comision_membresia 386); esta fase construye el CANAL público (RPCs PII-safe + allowlist) y el MONTAJE (UI).

DECISIÓN RECTORA DEL OPERADOR (2026-07-21, registrada — NO re-preguntar): partido político + bio oficial del cargo electo DIRECTO en todas las superficies (revierte la retención de `partido` en 0020_parlamentario_publico.sql). Siempre "según fuente al [fecha]", partido≠comité (Senado), militancia histórica vs actual distinguidas. Minimización 21.719 PLENA para terceros/familiares/RUT/email.

</domain>

<decisions>
## Implementation Decisions

### Canal de datos (migración 0060)
- Migración 0060 con RPC(s) security-definer PII-safe (`set search_path = ''`, patrón 0020) que sirven: cabecera con partido (militancia actual + fecha de fuente), militancias históricas (partido, desde, hasta, es_actual), comisiones del parlamentario (nombre, cámara, tipo, cargo), y cross-links (ver abajo). Cero `grant … to anon` nuevos NO — ojo: el patrón del repo post-Camino A es `revoke execute from public` + el sitio lee con service_role vía `.rpc()`; seguir el patrón de las RPCs recientes (0048+: revoke a anon/authenticated, allowlist en lockdown-guard).
- El SQL de 0060 documenta en comentario la decisión del operador 2026-07-21 que revierte la retención de partido de 0020 (con referencia a PROJECT.md), para que el guard histórico no parezca violado sin contexto.
- `parlamentario_publico` (0020) se amplía o se acompaña con una RPC nueva que SÍ emite partido + fecha_captura de la militancia; decidir en plan cuál es menos invasivo (drop+recreate cambia returns table → 42P13 gotcha: drop obligatorio re-arma default privileges → re-revoke).
- Cada RPC nueva: entrada en PUBLIC_RPC_ALLOWLIST (app/lib/lockdown-guard.test.ts) + pgTAP + LIMIT/bounded.
- Apply 0060 a PROD por el agente vía `PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" --single-transaction -f` (aditivo, precedente 0059) + pgTAP contra schema aplicado.

### Header de la ficha (montaje)
- ParlamentarioHeader muestra: partido actual DIRECTO como chip con "según fuente al [fecha]" (fecha_captura de la militancia), región/distrito (Cámara) o circunscripción (Senado), período, comisiones (lista con tipo), profesión SOLO si parlamentario_bio la tiene (hoy 0 filas — null honesto, no renderizar vacío fabricado).
- Militancia histórica: sección/acordeón con desde/hasta por partido, separada visualmente de la actual; rotulado explícito "partido ≠ comité" donde aplique (Senado).
- NUNCA: RUT, email, terceros/familiares. Solo campos del allowlist de Phase 90.

### Correlación de partido (cierra FILT-01)
- /parlamentarios (directorio): filtro por partido — la RPC del listado se amplía para emitir partido (o RPC nueva), el filtro es client-side island sobre lo ya obtenido (contrato FichaRail: el island JAMÁS toca Supabase).
- /buscar: el partido se correlaciona en resultados según los datos que el flujo ya trae server-side (autores→partido); si requiere columnas nuevas en la respuesta, se serializan desde el server component — sin re-query del island. Alcance mínimo viable: chip de partido en autores mostrados; filtro por partido en /buscar SOLO si el dato ya viaja (no crear un pipeline nuevo de datos para esto).
- Cruces: donde aparece un parlamentario en superficies de cruces, mostrar partido con fuente+fecha (mismo componente chip reutilizable).

### Cross-links factuales (ficha)
- Bloques "declarados u observables": mismo partido / misma región-distrito / misma comisión (RPCs bounded con LIMIT, orden alfabético o por cámara — NUNCA ranking por afinidad) + co-autoría (reusa el dato F48 de cruces-proyecto/autoría existente).
- Cada bloque con leyenda anti-causal: relación DECLARADA por fuente oficial (militancia/comisión/autoría), no implica afinidad ni coordinación.
- Linter anti-insinuación (app/lib/anti-insinuacion-guard.test.ts) extendido a TODAS las superficies nuevas; mutation self-check debe morder sobre lo nuevo.
- Términos prohibidos en lo nuevo: "aliado", "cercano a", "bloque de", "afín", ranking/score de relación.

### Operación
- Deploy Cloudflare al cierre de la fase (runbook Docker node:22-slim); 92/94 re-deployan después.
- Suite verde por plan (app + packages + tsc); guards muerden (lockdown allowlist, anti-insinuación, cero-hex, PII-guard).
- UI-SPEC antes de plan (fase frontend); ui-review tras ejecución.

### Claude's Discretion
- Forma exacta de las RPCs (una consolidada vs varias pequeñas) y sus nombres.
- Diseño visual del chip de partido y las secciones (respetando tokens del design system).
- Si el filtro por partido en /buscar entra en esta fase o queda mínimo (chip en autores) — según lo que el flujo de datos ya permita sin pipeline nuevo.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- Datos poblados (Phase 90): parlamentario.partido (186 refrescados con fecha), parlamentario_militancia (363), comision (34), comision_membresia (386). parlamentario_bio existe pero 0 filas (profesión sin fuente — null honesto).
- app/app/parlamentario/[id]/page.tsx — ficha RSC con rail + secciones capa-1; ParlamentarioHeader (app/components/parlamentario-header.tsx:23-60, HOY sin partido por LEGAL-03 — revertir con la decisión del operador).
- RPC patrón: 0020_parlamentario_publico.sql (security definer, search_path=''); 0048 (revoke total, servido via service_role) — seguir el patrón MÁS RECIENTE del repo.
- PUBLIC_RPC_ALLOWLIST: app/lib/lockdown-guard.test.ts:165-183.
- Linter anti-insinuación: app/lib/anti-insinuacion-guard.test.ts (escanea texto renderizado post-stripTsComments, mutation self-check).
- ProvenanceBadge + fechaCorta/relativeTimeEs (app/lib/format.ts) para "según fuente al [fecha]".
- Contrato FichaRail para islands client-side (el island jamás toca Supabase) — buscar-filtros.tsx de Phase 88 como analog.
- Gotcha 42P13: cambiar returns table de una RPC exige drop+recreate → re-arma DEFAULT PRIVILEGES → re-revoke explícito (v4 memoria).

### Established Patterns
- Chips cívicos con tokens [--var] (Tailwind 4); cero hex crudo (guard).
- Conteos 3-estado honestos (dato/vacío/no_ingerido) — page.tsx:77-88.
- Leyendas anti-causal por sección (lobby-de-parlamentario.tsx:14-46 como plantilla).

### Integration Points
- 0020 retiene partido con comentarios LEGAL-03 — la migración 0060 debe documentar la reversión (decisión operador 2026-07-21).
- /parlamentarios usa parlamentarios_publico (RPC listado) — ampliar para partido.
- Co-autoría: F48 cruces_de_proyecto / autores existentes (proyecto_autor) — verificar la fuente exacta del dato de co-autoría en plan.

</code_context>

<specifics>
## Specific Ideas

- Chip de partido reutilizable (mismo componente en ficha, listado, cruces) con tooltip/subtexto "según {origen} al {fecha}".
- Sección comisiones en el header o bloque propio con cargo si existe (386 membresías tienen el dato de la fuente integrantes.aspx).
- Cross-links con counts honestos ("12 parlamentarios en la Comisión de Hacienda") y links a fichas.

</specifics>

<deferred>
## Deferred Ideas

- Profesión/estudios (parlamentario_bio) — poblar cuando exista fuente estructurada (BCN prosa vetada, v9.x).
- Filtro por partido en /buscar con pipeline de datos nuevo (si no viaja ya) — evaluar en 93/94 o v9.x.
- Grafo de relaciones (P6) — fuera de milestone.

</deferred>
