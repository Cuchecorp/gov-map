# Phase 117: FECHA-FIX — Etiquetas de fecha corregidas - Context

**Gathered:** 2026-07-28
**Status:** Ready for planning
**Mode:** Smart discuss autónomo (recomendaciones auto-aceptadas por directiva de la corrida v12.0)

<domain>
## Phase Boundary

Corregir (o declarar con causa) CADA hallazgo F-01..F-14 de `116-FECHAS-AUDIT.md` §3, de modo
que ninguna fecha del sitio mienta ni quede ambigua: el usuario siempre distingue cuándo pasó
el hecho de cuándo lo capturamos. Cambios acotados a copy y formateo de fecha en las superficies
afectadas (+ filtros de higiene mínimos como el de F-04). El deploy NO viaja en esta fase
(viaja con Phase 125). Guards de régimen + suite + tsc quedan verdes.

</domain>

<decisions>
## Implementation Decisions

### Contrato de entrada
- El contrato ES `116-FECHAS-AUDIT.md` §3 (F-01..F-14, cada uno con archivo:línea, superficie, qué dice hoy, por qué está mal, fix sugerido) + §6 Límites. Cero re-investigación del universo; los anchors del artefacto ya fueron verificados por símbolo (verifier 116) — re-localizar con grep solo al editar (el archivo puede haber cambiado de líneas).
- Disposición por hallazgo: **corregido** (con evidencia antes/después) o **declarado** (con causa y por qué no se corrige en 117). CERO excepciones silenciosas — tabla de disposición F-01..F-14 completa en el artefacto de cierre de la fase.

### Reglas LOCKED del copy
- Idiom aprobado para captura: **"según fuente al…"** (o equivalente ya aprobado en producción, ej. `estado-actual-block.tsx:429` que el audit confirmó como contraejemplo limpio). "captura" pelado PROHIBIDO en copy visible. `fecha_captura` JAMÁS presentada como el hecho.
- Si un fix introduce superficie nueva o vocabulario nuevo para el linter anti-insinuación → **extender el linter ANTES del copy** (patrón Wave-0 de v10.0/v11.0).
- Date-only (citacion.fecha, sesion_sala.fecha): la parte fecha UTC ES el día chileno — el fix de F-09 usa `diaCalendarioCitacion` (el patrón que el propio archivo manda), JAMÁS conversión tz.
- F-05/F-10 — REGLA DURA del audit: NO aplicar `timeZone: "America/Santiago"` como fix global: fabricaría el día anterior en ~45.618 filas "date-only disfrazadas de timestamptz". Seguir el fix sugerido del audit por hallazgo (drift real acotado: 27+27 filas); si el fix honesto requiere distinguir subtipos de dato que el código no puede distinguir, se DECLARA como límite, no se adivina.

### Alcance de superficies
- Gated MONEY (E-013..E-016, F-08): el copy se corrige en el código aunque las superficies no se emitan en el deploy (flags NO se tocan).
- Huérfanos E-003/E-008 (F-06): fix de copy barato en el componente aunque esté huérfano, O declaración explícita si el fix correcto es eliminar el huérfano (eso sería alcance de otra fase — declarar, no borrar).
- F-04 (fecha corrupta 2626 visible): filtro de higiene `fecha <= current_date` (o equivalente) en el carril proyecto ES parte del alcance ("formateo de fecha en superficies afectadas"). OJO límite del audit: las 17 citaciones futuras son agenda legítima — el filtro NO puede ser global sobre agenda.
- F-11 (umbral comentado 48h vs real 14 días): corregir el comentario/JSDoc al valor real (o el valor al comentado SI el audit lo recomienda — seguir el fix sugerido; cambiar el umbral real es decisión de producto → si el audit no lo zanja, corregir la documentación y declarar).

### Verificación de la fase
- Suite app (~1428) + packages + `tsc -b` 0 + guards de régimen (anti-insinuación, lockdown, anti-flip, bento, name-match-rut, env-example, integ-scope, provider-guard) verdes al cierre de cada plan.
- Tests nuevos SOLO si el fix cambia comportamiento verificable (ej. filtro F-04, helper de formateo); copy puro se verifica por assertion de string en tests existentes o grep reproducible.
- Artefacto de cierre: `117-DISPOSICION.md` (tabla F-01..F-14 → corregido/declarado, evidencia antes/después con archivo:línea, commit por fix).

### Claude's Discretion
- Agrupación de fixes en planes/commits (sugerencia: por chokepoint/transversal vs por superficie).
- Detalles de redacción del copy dentro del idiom LOCKED.
- Si un helper nuevo de formateo amerita ubicación en `app/lib/format.ts` u otro módulo existente (seguir convenciones del archivo).

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `116-FECHAS-AUDIT.md` — contrato completo: §1 veredictos, §2 evidencia PROD, §3 hallazgos con fix sugerido, §6 límites.
- `116-FORMATTERS.md` — semántica por formatter + 17 call-sites del chokepoint `ProvenanceBadge`.
- Contraejemplos limpios que el audit manda copiar: `estado-actual-block.tsx:429` ("según … al …"), `partido-chip.tsx:73`, `comparar/page.tsx:324`/`:293`, `militancias-de-parlamentario.tsx:27`.
- `diaCalendarioCitacion` (`app/lib/dia-calendario.ts`) — patrón correcto date-only ya existente.
- Linter anti-insinuación existente (extender antes del copy si hay vocabulario nuevo).

### Established Patterns
- Fix con evidencia antes/después + commit atómico por hallazgo (precedente 115-review).
- Guards corren en suite; `pnpm test` + `tsc -b` como gate por plan.
- `ProvenanceBadge` es chokepoint: F-01 se arregla UNA vez en el componente, no 17 veces.

### Integration Points
- Phase 125 (E2E) re-verifica fechas sobre el deploy final: el deploy de estos fixes viaja con 125.
- REQUIREMENTS: FECHA-02.

</code_context>

<specifics>
## Specific Ideas

- Success criteria ROADMAP: (1) cada hallazgo de 116 corregido o declarado sin excepciones silenciosas; (2) captura siempre con idiom LOCKED, "captura" pelado prohibido; (3) guards de régimen verdes tras los cambios de texto; (4) suite + typecheck verdes.
- Requirement: FECHA-02.

</specifics>

<deferred>
## Deferred Ideas

- Deploy a Cloudflare → Phase 125.
- Saneamiento de las 2 filas corruptas del año 2626 en DB (DML) → deuda operador / Phase 124 si aplica (117 solo filtra el render).
- Eliminación de componentes huérfanos E-003/E-008 → fuera de alcance (declarar).
- Cambio del umbral de frescura real (14 días) como decisión de producto → declarar si el audit no lo zanja.

</deferred>
