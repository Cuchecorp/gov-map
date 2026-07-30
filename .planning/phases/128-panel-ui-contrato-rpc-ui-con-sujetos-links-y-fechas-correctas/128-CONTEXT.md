# Phase 128: PANEL-UI — Contrato RPC/UI con sujetos, links y fechas correctas - Context

**Gathered:** 2026-07-30 — **CHECKPOINT DE OPERADOR CERRADO: O-1..O-7 ratificados VERBATIM vía
AskUserQuestion (respuestas reales del operador, cero aprobados por silencio)**
**Status:** Ready for planning

<domain>
## Phase Boundary

La portada renderiza la propuesta editorial ratificada: cada tile nombra sujetos (boletín + título
+ fecha con verbo), cada ítem enlaza vía helper central, votaciones L4 visibles, semántica de
fechas de tres carriles, cobertura declarada. Requirements: PANEL-02..05, PANEL-07.
NO incluye: loop visual BrowserOS (129), materializador (127 — YA en PROD con 0080+0081).
</domain>

<decisions>
## Implementation Decisions

### RATIFICACIONES DEL OPERADOR (2026-07-30 — verbatim, LOCKED)
- **O-1:** Opción A ratificada (evidencia jsonb — ya aplicada a PROD).
- **O-2:** Tile Votaciones L4 se construye VISIBLE (VSIM ON + sign-off legal 2026-07-30).
- **O-3:** Tile materia MUERE sin tombstone.
- **O-4:** Cruce urgencia↔citación (L5) como CHIPS dentro de los tiles 1-2 — yuxtaposición de dos
  hechos fechados, jamás relación. Molde: "Urgencia {grado} fechada el {d} · Citado el {d}".
- **O-5:** Tile SALA primero, comisiones segundo.
- **O-6:** Tile urgencias SIN link agregado de tile (los ítems cargan la navegación); el filtro de
  urgencia en /buscar queda FUERA de v13.0.
- **O-7:** Presupuesto de densidad: 4 ítems + "y N más →" por tile; el loop BrowserOS de 129 lo
  arbitra sobre el deploy real (puede BAJARLO con evidencia, no subirlo).

### Diseño de tiles (spike editorial §3.2, ratificado)
- **D-01:** Grilla: 1 Sala-semana (L2) → 2 Comisiones citadas (L1+L5 chips+L6 ítem+L7 cobertura) →
  3 Urgencias por grado (L3, conteo por BOLETINES distintos, "95" muere) → 4 Movimiento reciente →
  5 Votaciones (L4) → 6 Ingresos/archivos fusionados. Tile materia AUSENTE del DOM.
- **D-02:** Datos desde `evidencia` jsonb de la RPC 0066 (firma intacta): `items[*]`, `total`,
  `consultado_al`, `fuente.{dataset,origen}` (fuenteLabel DESDE DATO, no mapa hardcodeado).
  NOTA post-0081: los ítems de agenda traen `puntos`/`tabla` (con ítems `boletin:null` incluidos,
  `en_corpus:false`) + `puntos_total`/`tabla_total` — renderizar por `materia` cuando no hay
  boletín; jamás asumirlo. `nuevos_ingresos` usa `cobertura_camara` como etiqueta de ventana
  (herencia 0065) — no leerla como cámara.
- **D-03:** Links: helper central NUEVO de links internos (`/proyecto/{b}#estado|#timeline|#votaciones`,
  `/agenda#...?semana=` usando `semana_iso` del jsonb). Ítems `en_corpus:false` → texto plano +
  enlace externo de la fuente. Regla 126 D-05: componentes nuevos con prefijo `components/panel-*`
  (el anti-drift muerde); si el helper emite labels visibles, alta en SUPERFICIES (126 D-08).
- **D-04:** L4 votaciones: una línea por votación (jamás agregada por boletín); Senado `resultado`
  NULL → "resultado no informado por la fuente" (jamás fabricar); conteos solo confirmados
  (283.550 global). Copy del carril más minado — linter como gate.
- **D-05:** Fechas 3 carriles: hecho con verbo en el cuerpo (idioms IMPORTADOS de
  `IDIOMS_APROBADOS` del guard 126 — single-source); footer SOLO `Fuente: {desde dato} · según
  fuente al {d}` (hechos pasados → fecha_max; agenda futura → consultado_al del jsonb);
  `"datos al"` = 0 ocurrencias (grep -o | wc -l); `fecha_captura` jamás visible.
- **D-06:** Cobertura declarada: "23 citaciones del Senado · 0 de la Cámara en las fuentes
  consultadas"; Cámara como "tabla semanal" (fila sintética `camara:sesion:2026-W31`,
  numero/tipo/hora NULL — jamás fabricar "Sesión N.º a las HH:MM"); ceros con denominador.
- **D-07:** Ingresos/archivos: "{N} eventos de {M} proyecto(s)" nombrando boletines — jamás "2
  movimientos" que sugiera 2 proyectos. Urgencias: clave `descripcion` verbatim de fuente (0081
  renombró `grado`→`descripcion`); si la UI muestra grado tipificado, lo deriva ELLA con fallback
  honesto al literal.

### Régimen
- **D-08:** RSC puro (header del panel: NUNCA "use client"); `/` ya es force-dynamic; 1 RPC como
  hoy. Cero RPC nueva, cero allowlist.
- **D-09:** Todo copy nuevo pasa el carril PANEL del linter (SUPERFICIES_PANEL ya declara los 7
  archivos previstos por 126); denylist viva (`señal`/`exprés`/`los más`/`captura` pelado...).
- **D-10:** El "queda bien" visual NO es de esta fase (129); esta fase cierra CORRECTITUD por tests
  + fragmentos DOM del render local.
</decisions>

<canonical_refs>
## Canonical References

- `.planning/spikes/v13.0-editorial-portada.md` §3.2 (tiles con copy de ejemplo REAL) + §4 (fechas)
  + Anexo (mapa tile→señal→destino)
- `.planning/ROADMAP.md` §Phase 128 — 5 success criteria
- `.planning/REQUIREMENTS.md` PANEL-02..05, PANEL-07
- `supabase/migrations/0080_actualidad_evidencia.sql` + `0081_actualidad_evidencia_fix.sql` — el
  shape REAL del jsonb (claves exactas; 0081 cambió `grado`→`descripcion` y añadió
  `puntos_total`/`tabla_total` + ítems boletin:null)
- `app/components/panel-actualidad.tsx` — el componente actual a rediseñar (RSC puro, SenalRow)
- `app/lib/anti-insinuacion-guard.test.ts` — IDIOMS_APROBADOS (import), SUPERFICIES_PANEL,
  anti-drift (1f)
- `.planning/phases/127-panel-mat-materializador-0080-puebla-los-sujetos/127-VERIFICATION.md` —
  estado PROD verificado (7 señales positivas, paridad 0, grafía única)
</canonical_refs>

<code_context>
## Existing Code Insights

- La RPC 0066 ya re-emite `evidencia` (9ª col) — `SenalRow.evidencia` declarado y jamás leído: el
  wiring es leerlo.
- Guards de 126 VIVOS: anti-drift recursivo sobre `components/panel*`; mutation self-check;
  idioms single-source.
- `week-utils.ts` / `dia-calendario.ts` existen para fechas; `estado-bucket.ts` para estados.
</code_context>

<specifics>
## Specific Ideas

- Copy de ejemplo del spike §3.2 usa sujetos REALES verificados — el planner los cita como forma,
  el executor render-iza desde el jsonb vivo.
- Chips L5: el dato de urgencia vigente por boletín sale de `urgencias.items[]` cruzado por
  boletín con los items de agenda — cruce EN RENDER (server), no nueva señal.
</specifics>

<deferred>
## Deferred Ideas

- Filtro de urgencia en /buscar (O-6 lo dejó fuera).
- Tile "Por sector" variante B (REQUIREMENTS §Future).
</deferred>

---

*Phase: 128-PANEL-UI*
*Context gathered: 2026-07-30 — checkpoint O-1..O-7 cerrado con respuestas verbatim del operador*
