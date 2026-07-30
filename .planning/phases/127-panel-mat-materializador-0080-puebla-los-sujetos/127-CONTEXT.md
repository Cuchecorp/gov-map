# Phase 127: PANEL-MAT — Materializador 0080 puebla los sujetos - Context

**Gathered:** 2026-07-30 (modo autónomo — decisiones adjudicadas con recomendación logged)
**Status:** Ready for planning

<domain>
## Phase Boundary

La DB tiene los sujetos del hecho: cada señal positiva de `actualidad_senal` lleva en `evidencia`
jsonb `{"total": N, "items": [...]}` los boletines/títulos/fechas/enlaces que la UI de 128 va a
nombrar. Arquitectura = **Opción A adjudicada por spike (NO se re-abre)**: `create or replace` del
proc `actualidad.materializar_senales()` en migración **0080 aditiva**; la RPC 0066 NO cambia de
firma; cero allowlist nueva; supresión conserva `'{}'`.

Requirements: PANEL-01, PANEL-06. NO incluye: UI/copy (128), RPC nueva (prohibida por Opción A),
tocar `agrupacion_materia` (tipo ajeno al proc, k-means CLI).
</domain>

<decisions>
## Implementation Decisions

### Forma del jsonb (base spike E6 — refinar con revisor Fable)
- **D-01:** `evidencia = {"total": N, "items": [...], "consultado_al": "YYYY-MM-DD"}` por señal
  positiva. `total` == count(*) del conteo de la fila (paridad obligatoria). Ítems ordenados
  `order by fecha desc` DENTRO del agg (orden de presentación, no cap).
- **D-02:** Unidad por señal = la unidad del conteo (spike E2, LOCKED): urgencias/velocity/
  archivados/nuevos_ingresos = eventos `{boletin,titulo,fecha,enlace,en_corpus,(grado en urgencias),(camara en velocity si aplica)}`;
  `agenda_citacion` = citaciones `{fecha,comision,horario,enlace,puntos:[{boletin,titulo,en_corpus}]}`;
  `agenda_sala` = fila por cámara con ítems de tabla `{boletin,titulo,posicion,(urgencia si la fuente la trae),en_corpus}`.
- **D-03:** CERO cap por recencia (anti-B-01, regla escrita como comentario en la migración): si
  algún día se cappea, por grado + `total` declarado. Los ~95 eventos de urgencias van completos.
- **D-04:** Frescura de fuente SEPARADA del hecho vía clave `consultado_al` (= fecha de la corrida,
  `current_date` en zona del dato) dentro del jsonb — NO columna nueva (la firma/shape de 0066 no
  cambia), NO `fecha_captura` (vetada como frescura visible: 44.847 eventos comparten 2026-07-10).
  El footer `según fuente al …` de 128 lee: hechos pasados → `max(fecha del hecho)` (ya viaja como
  `fecha_max`); agenda futura → `consultado_al`.

### Guard 404 (PANEL-02 upstream)
- **D-05:** `left join proyecto p on p.boletin = X` en TODO bloque que emita boletines; ítem SIEMPRE
  emitido con `en_corpus: (p.boletin is not null)`; `titulo`/`enlace` null cuando no está en corpus.
  JAMÁS inner-join en señales cuyo conteo es el evento (el spike midió 20→17 puntos con inner).
  `BOLETIN_RE` NO es guard (deja pasar `2718-09`).
- **D-06:** Query de paridad conteo↔detalle como pgTAP: para cada señal positiva,
  `conteo == (evidencia->>'total')::int` y `total == jsonb_array_length(evidencia->'items')`
  (en agenda_citacion la unidad es citación — los puntos anidados NO cuentan).

### Grafía única 4-15/D2 (PANEL-06)
- **D-07:** Normalización en el MATERIALIZADOR (0065:233,261 y todo bloque que emita
  `cobertura_camara`), no en el cliente. Forma ciudadana única: `Cámara de Diputados` / `Senado`.
  Implementar como expresión CASE single-source repetida idéntica (o función SQL inmutable local al
  schema `actualidad`) — el revisor Fable adjudica la forma final. Mapea: `C.Diputados`→`Cámara de
  Diputados`, `camara`→`Cámara de Diputados`, `senado`→`Senado`, `Senado`→`Senado`.
- **D-08:** `(sin cámara)` se conserva como cobertura para eventos sin cámara (comportamiento actual).

### Migración y verificación
- **D-09:** `supabase/migrations/0080_actualidad_evidencia.sql` — número RESERVADO confirmado (0079
  última; 0073/0075 escritas NO aplicadas JAMÁS se editan). Aditiva: `create or replace function`
  del proc completo; CERO cambio de tabla/RPC/ACL/grants. Header con las reglas: anti-B-01, guard
  404, unidad=conteo, supresión `'{}'`.
- **D-10:** Aplicación a PROD por `PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" --single-transaction -f`
  (método LOCKED; JAMÁS `db push`; JAMÁS ecoar la URL). Post-aplicación: ejecutar
  `select actualidad.materializar_senales()` una vez y verificar por `psql -tA | tr -d '\r'`
  (jamás REST, cap 1k) evidencia poblada / supresión `'{}'` / paridad / grafía.
- **D-11:** pgTAP `supabase/tests/0080_actualidad_evidencia.test.sql` contra schema aplicado:
  siembra propia + boletín fantasma → `en_corpus:false` con titulo/enlace null; positivas pobladas;
  supresión `'{}'`; paridad D-06; cuerpo del proc sin `partido`/`rut` (el test de 0065 ya muerde).
  Correr con el runner real (`psql -tA -f`, precedente v4).
- **D-12:** El cron `actualidad-materializar` (7 11,14,17,20 * * 1-5) NO se toca — invoca el proc
  por nombre, el replace es transparente.

### Claude's Discretion
- Forma exacta del CASE de grafía (expresión inline repetida vs función) — la adjudica el revisor
  Fable en el gate de plan.
- Si `velocity` lleva `titulo`/`enlace` por evento vía left join (spike E6 lo muestra) — sí, mismo patrón.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Adjudicado (NO re-abrir)
- `.planning/spikes/v13.0-spike-panel-arquitectura.md` — VEREDICTO Opción A + E2 (payload medido
  39,7 KB, unidad=conteo) + E5 (guard 404: 10/49) + E6 (borrador de la migración — BASE del plan)
- `.planning/ROADMAP.md` §Phase 127 — 5 success criteria verbatim
- `.planning/REQUIREMENTS.md` — PANEL-01, PANEL-06

### Código fuente de verdad
- `supabase/migrations/0065_actualidad_senal.sql` — el proc actual completo (6 bloques INSERT:
  velocity L127-135, nuevos_ingresos L157-169, urgencias L195-203, agenda_citacion L230-237,
  agenda_sala L258-265, archivados L285-295; grafía defectuosa L233,261; cron L326-330)
- `supabase/migrations/0066_actualidad_rpc.sql` — la RPC (firma INTACTA; verificar qué columnas
  re-emite: evidencia 9ª, ¿origen/dataset/fecha_captura?)
- `supabase/tests/` — pgTAP precedentes (0065/0066 si existen; runner `psql -tA -f`)
- `.planning/phases/126-panel-guards-wave-0-de-guards/126-02-SUMMARY.md` — guard create-view VIVO:
  0080 NO crea views; si alguna vez creara una, exige `security_invoker` (no aplica: es function)

### Régimen
- `.planning/PROMPT-v13.0-build-autonomo.md` §Reglas LOCKED + §Gotchas (fechas date-only SIN
  `at time zone`; `fecha::date >= current_date`; psql -tA emite CRLF ⇒ `tr -d '\r'`)
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Borrador E6 del spike: patrón por bloque ya escrito para urgencias/velocity/agenda_citacion — los
  otros 3 son mecánicos.
- `SenalRow.evidencia: Record<string, unknown>` ya declarado en `panel-actualidad.tsx:44` — cero
  cambio de contrato TS en esta fase.

### Established Patterns
- Migraciones por psql `--single-transaction` con `PGCLIENTENCODING=UTF8` (v10-v12).
- pgTAP contra schema aplicado con siembra propia (0065/0066, fixtures validados contra schema real).
- Verificación de conteos por `psql -tA` + `tr -d '\r'`, jamás REST (cap 1k).

### Integration Points
- Phase 128 consume: `evidencia.items[*].{boletin,titulo,fecha,enlace,en_corpus}`,
  `evidencia.total`, `evidencia.consultado_al`, grafía única en `cobertura_camara`.
- El cron existente re-materializa 4×/día L-V — la evidencia se refresca sola tras aplicar.
</code_context>

<specifics>
## Specific Ideas

- Revisor Fable OBLIGATORIO en el gate de plan (mandato del roadmap): forma final del jsonb +
  migración 0080. Sus objeciones se cierran ANTES de ejecutar.
- La fila sintética `camara:sesion:2026-W31` (agenda_sala Cámara) tiene numero/tipo/hora NULL — la
  evidencia de agenda_sala NO debe fabricar esos campos; emitir lo que hay.
- Senado `resultado` NULL en votaciones NO es de esta fase (L4 es 128 y lee de `votacion`, no del
  materializador).
</specifics>

<deferred>
## Deferred Ideas

- Adelgazar los 314,8 KB de evidencia k-means de `agrupacion_materia` (tipo ajeno al proc; el tile
  muere en 128 — si la RPC empieza a pesar, fase futura).
- Cap por grado con `total` declarado — SOLO si una legislatura cargada triplica urgencias (umbral
  documentado en la migración, no implementado).
</deferred>

---

*Phase: 127-PANEL-MAT — Materializador 0080 puebla los sujetos*
*Context gathered: 2026-07-30*
