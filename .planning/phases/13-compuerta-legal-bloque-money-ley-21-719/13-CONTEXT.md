# Phase 13: Compuerta Legal — Bloque MONEY (Ley 21.719) - Context

**Gathered:** 2026-06-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Gate de proceso (no de construcción) que cubre la superficie de mayor sensibilidad del milestone: obtener la aprobación legal explícita (Ley 21.719) antes de exponer públicamente cualquier dato de dinero (MONEY, Phases 14–16). Esta fase entrega (1) un **dossier legal** verificable que documenta la postura sobre republicación de datos públicos, datos sensibles (afiliación política) y terceros privados (donantes/lobistas), más minimización y propósito; y (2) el **mecanismo de gate de exposición** (doble candado RLS + flag server-side) que las fases MONEY usarán, naciendo apagado hasta el sign-off humano real.

**Decisión macro del operador (2026-06-19):** preparar + construir con exposición gateada. El dossier se produce ahora; el sign-off legal humano queda como **deuda de operador** (F13). Las fases 14–16 se construyen (ingesta/DB/conector/RUT interno), pero toda ruta pública MONEY nace detrás de un feature-gate apagado. La construcción es reversible; la exposición no se enciende sin sign-off.

</domain>

<decisions>
## Implementation Decisions

### Dossier legal — contenido y forma
- Ubicación/formato: Markdown versionado `13-LEGAL-DOSSIER.md` en el directorio de la fase + copia en `docs/legal/`.
- Estructura del análisis: secciones por las 3 superficies de LEGAL-01 (republicación de datos públicos / datos sensibles de afiliación política / terceros privados donantes-lobistas) + sección de minimización + sección de propósito (transparencia legislativa / control ciudadano) + base de licitud.
- Destinatario/firmante: dossier preparado para asesoría legal externa; incluye checklist de sign-off con campos (nombre del asesor, fecha, alcance cubierto, observaciones).
- Atribución/licencia: documentar CC BY 4.0 y la cita de fuente por dataset MONEY (ChileCompra, SERVEL) dentro del dossier; la fase de UI hereda esta atribución.

### Mecanismo de gate de exposición
- Capa del gate: **doble candado** — (a) las tablas MONEY nacen deny-by-default a `anon` por RLS (mismo patrón que `parlamentario.rut`), y (b) flag server-side `MONEY_PUBLIC_ENABLED` (default `false`) que oculta secciones de ficha / RPC público de MONEY.
- Default e override: default OFF en código y en `.env.example`; encender requiere un cambio explícito de operador realizado después del sign-off.
- Qué se construye bajo el gate: ingesta + esquema DB + conector + cruce RUT interno + tests pueden construirse en 14–16; ninguna ruta pública se enciende.
- Verificación: pgTAP/test que afirma que las tablas MONEY niegan acceso a `anon`, y test que afirma que el flag `MONEY_PUBLIC_ENABLED` es `false` por defecto.

### Sign-off como prerrequisito verificable
- Registro: bloque YAML en el encabezado del dossier (`signoff: pending`, fecha, alcance) + marca en la deuda de operador (memoria F13).
- Consumo por el gate: encender `MONEY_PUBLIC_ENABLED` queda documentado como dependiente de `signoff: approved`; verificable por inspección del dossier.
- Trazabilidad: el dossier enlaza a la deuda F13 y al success criterion 3 del ROADMAP (sign-off como prerrequisito duro).
- Alcance: este sign-off cubre **solo MONEY**; el framing del grafo (NET) es LEGAL-02 / Phase 17, fuera de alcance.

### Claude's Discretion
- Redacción exacta del análisis legal dentro de cada superficie (al nivel de un dossier de preparación, no de un dictamen — el dictamen lo emite la asesoría externa).
- Nombre exacto y ubicación del módulo del flag server-side, consistente con los patrones de `packages/`.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- Patrón RLS deny-by-default ya establecido para PII (`parlamentario.rut`, `lobby_contraparte`, `declaracion_familiar`) en migraciones previas (0018, 0021, 0022) — el gate RLS de MONEY lo reusa.
- Compuerta `data-routing` del LLM (`assertNoRutInLlmInput` / `assertSensitivityAllowed`) de Phase 9 (LEGAL-03) — referencia para minimización.
- Patrón de secretos/flags vía `.env` + `app.settings.*` documentado en `.env.example` — base para `MONEY_PUBLIC_ENABLED`.

### Established Patterns
- Migraciones SQL en `supabase/migrations/` con pgTAP para verificar RLS.
- Monorepo `packages/` por dominio (`votos`, `lobby`, `probidad`, ...); MONEY sería `packages/dinero` (Phase 14).
- Secciones de ficha en `app/components/*-de-parlamentario.tsx` con carril propio + ProvenanceBadge.

### Integration Points
- `.env.example` (nuevo flag), `docs/legal/` (nuevo, copia del dossier), `.planning` operator-debt (memoria F13).
- El flag y la postura RLS los consumen Phases 14–16 al construir las rutas públicas.

</code_context>

<specifics>
## Specific Ideas

- El dossier NO es un dictamen legal: es un documento de preparación que el operador lleva a asesoría legal real. No afirma cumplimiento; estructura la superficie de riesgo para que un abogado la revise.
- Coherencia con el principio rector del proyecto: solo se muestra lo que la fuente ya publica; RUT y datos de familiares quedan internos (no expuestos).

</specifics>

<deferred>
## Deferred Ideas

- Sign-off del framing del grafo (NET) — LEGAL-02, Phase 17.
- Encendido real de `MONEY_PUBLIC_ENABLED` tras sign-off — acción de operador, fuera de esta corrida autónoma.

</deferred>
