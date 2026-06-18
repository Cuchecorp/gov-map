---
phase: 06-citaciones-tabla-semanal-de-sala
plan: 02
subsystem: agenda
tags: [agenda, citaciones, tabla-sala, parsers, cheerio, json, zod, semana-iso, tdd, fixtures-reales, slice-e2e]

# Dependency graph
requires:
  - "Modelo común Citacion/CitacionInvitado/CitacionPunto/SesionSala/SesionTablaItem + zod (06-01)"
  - "3 fixtures reales en packages/agenda/test/fixtures/ (06-01)"
  - "slice.e2e.test.ts en RED (06-01) — diana ciudadana de la fase"
provides:
  - "Helper ISO-8601 (isoWeekOf/semanaIsoKey/prmSemanaParam/enumerarSemanas/semanasEnAnioIso) — enumeración para la cobertura completa de Cámara"
  - "parseCamaraCitaciones(html, semanaIso) → Citacion[] (cheerio sobre <article.citaciones>)"
  - "parseSenadoCitaciones(json) → Citacion[] (JSON data[].CITACIONES[], boletin desde NUMERO_BOLETIN)"
  - "parseSenadoTabla(json) → SesionSala[] (JSON data[].TABLA[], boletin desde BOLETIN)"
  - "slice.e2e.test.ts VERDE: los 3 parsers cumplen el contrato observable ciudadano"
affects: [agenda, frontend-agenda, tramitacion]

# Tech tracking
tech-stack:
  added: []
  patterns: [parsers-fixture-real, zod-por-fila-drift, boletin-cruce-fase5, iso-week-jueves, tdd-red-green-por-task, invitados-sin-reconciliacion]

key-files:
  created:
    - packages/agenda/src/semana-iso.ts
    - packages/agenda/src/semana-iso.test.ts
    - packages/agenda/src/parse-camara-citaciones.ts
    - packages/agenda/src/parse-camara-citaciones.test.ts
    - packages/agenda/src/parse-senado-citaciones.ts
    - packages/agenda/src/parse-senado-citaciones.test.ts
    - packages/agenda/src/parse-senado-tabla.ts
    - packages/agenda/src/parse-senado-tabla.test.ts
  modified:
    - packages/agenda/src/index.ts
    - packages/agenda/src/slice.e2e.test.ts

key-decisions:
  - "isoWeekOf anclado al jueves (semana 1 contiene el 4 de enero); enumerarSemanas itera lunes-a-lunes y deriva la clave ISO de cada lunes → cruza bordes de año y respeta los 53-week years (2020/2026/2032) sin huecos ni duplicados, sin aritmética naïf (Pitfall 4)"
  - "parser de Cámara maneja AMBAS formas de la última columna: tabla anidada <td colspan=2> con .w40/.w30 (forma A, la real del fixture: 39/39 filas) y 2 <td> hermanos (forma B, defensiva); cada .w40/.w30 fila de la tabla anidada genera un par materia/invitados → soporta múltiples puntos por citación"
  - "boletín como llave de cruce: Cámara desde la materia (regex N°NNNNN-NN), Senado desde NUMERO_BOLETIN/BOLETIN; nullable cuando no hay proyecto (sesiones especiales, seminarios)"
  - "FECHA del Senado 'DD/MM/YYYY' se parsea con helper explícito (NO new Date(str) ambiguo); la fecha es-CL de Cámara 'LUNES, 15 DE JUNIO DE 2026' se parsea con tabla de meses → ISO 'YYYY-MM-DD'"
  - "zod por fila (safeParse) en los 3 parsers: una fila/sesión que no valida se descarta y se registra (console.warn), NUNCA se fabrica (T-06-04); los fixtures reales son el contrato"
  - "invitados del Senado = [] (la API commissions_citations no los expone); invitados de Cámara = texto crudo de .w30 sin reconciliación de identidad (T-06-02)"

requirements-completed: [TRAM-07, TRAM-08]

# Metrics
duration: 9min
completed: 2026-06-18
---

# Phase 6 Plan 02: Parsers de citaciones (Cámara+Senado) + tabla de sala + helper ISO Summary

**Implementa los 3 parsers núcleo de la fase contra fixtures reales — `parseCamaraCitaciones` (cheerio sobre el HTML de `citaciones_semana.aspx`: `<article.citaciones>` → `<p.fecha>` → `<table.tabla>` con columnas Comisión|Horario|Sala|Citación|Invitados, estado desde `<p color:red>`, tabla anidada `.w40`/`.w30`, boletín `N°NNNNN-NN` de la materia), `parseSenadoCitaciones` (JSON `data[].CITACIONES[]` con `boletin` desde `PUNTOS_PROPUESTOS[].NUMERO_BOLETIN`) y `parseSenadoTabla` (JSON `data[].TABLA[]` → `SesionSala` + `items[]` con `boletin` desde `BOLETIN`) — más el helper ISO-8601 (`isoWeekOf`/`enumerarSemanas`/`prmSemanaParam`, anclado al jueves, con bordes de año y 53-week years cubiertos), todos con zod por fila (drift se descarta, no se fabrica) y el boletín como llave de cruce hacia la ficha de Fase 5. El `slice.e2e.test.ts` de 06-01 pasa a VERDE.**

## Performance

- **Duration:** ~9 min
- **Tasks:** 3 (los 3 con ciclo TDD RED→GREEN por task)
- **Files:** 8 creados, 2 modificados
- **Tests:** 56 verdes (14 semana-iso + 10 parse-camara + 9 parse-senado-citaciones + 8 parse-senado-tabla + 12 model + 3 slice.e2e); `pnpm -w typecheck` exit 0

## Accomplishments

- **Helper ISO-8601 (`semana-iso.ts`)** — `isoWeekOf(date)` anclado al jueves (la semana 1 contiene el 4 de enero), `semanaIsoKey(year,week)` → `YYYY-Www` con padding, `prmSemanaParam(year,week)` → `{year}-{week}` (param de Cámara, `2026-25`), `enumerarSemanas(desde,hasta)` que itera lunes-a-lunes derivando la clave ISO de cada lunes (cruza bordes de año, respeta los 53-week years sin huecos ni duplicados) y `semanasEnAnioIso(year)`. Tests de bordes: 2026-01-01→2026-W01, 2021-01-01→2020-W53, 2023-01-01→2022-W52, 2026-12-31→2026-W53; enumeración plurianual contigua con W53 sólo en años de 53 semanas.
- **Parser de Cámara (`parse-camara-citaciones.ts`)** — cheerio sobre el HTML real (`prmSemana=2026-25`, 4 `article.citaciones` / 39 filas): itera `article.citaciones` → `p.fecha` (es-CL → ISO) → `table.tabla > tbody > tr`, separa la comisión del estado (`<p style*="color:red">` → "Suspendida"/"Sin efecto"/null), lee sala de la 3ª columna, y la última columna como **tabla anidada** (`.w40` materia / `.w30` invitados, una fila por punto) o 2 `<td>` hermanos (defensivo). Extrae boletines `N°NNNNN-NN` de la materia → `CitacionPunto` cruzable. Ids sintéticos estables (`camara:semana:comision:fecha:horario`, con sufijo `#n` ante colisión). Provenance inline (origen `camara-citaciones-semana`, enlace `citaciones_semana.aspx`).
- **Parser de citaciones del Senado (`parse-senado-citaciones.ts`)** — recorre `data[].CITACIONES[]` → `Citacion` (camara=senado, comision=COMINOMBRE, sala=LUGAR, horario=HORARIO, materia=MATERIA, estado= SIN_EFECTO?"Sin efecto":null), `puntos` desde `PUNTOS_PROPUESTOS[]` (boletin=NUMERO_BOLETIN nullable, id_proyecto=ID_PROYECTO, tipo_tramite=TIPO_TRAMITE). `FECHA` "DD/MM/YYYY" → ISO + `semana_iso` calculada con el helper. `invitados:[]` (la API no los expone). Provenance origen `senado-commissions-citations`.
- **Parser de tabla de sala del Senado (`parse-senado-tabla.ts`)** — recorre `data[]` → `SesionSala` (id=`senado:sesion:ID_SESION`, numero=NUMERO_SESION, hora_inicio=HORA_INICIO, tipo=TIPO_SESION), `items` desde `TABLA[]` (posicion=POSICION int, parte_sesion=PARTE_SESION, materia=MATERIA, boletin=BOLETIN nullable, id_proyecto, alias, quorum como texto crudo nullable). Provenance origen `senado-weekly-table`.
- **`slice.e2e.test.ts` VERDE** — los 3 parsers existen en el barrel y cumplen el contrato observable ciudadano (≥1 Citacion de Cámara con comisión/horario/materia; Citacion[] del Senado con ≥1 punto con boletín cruzable; SesionSala con items[] del Senado). Se eliminó el `@ts-expect-error` (ahora obsoleto) que rompía el typecheck.

## Task Commits

1. **Task 1 RED: tests del helper ISO** — `67f034c` (test)
2. **Task 1 GREEN: helper ISO-8601 (semana-iso)** — `c904319` (feat)
3. **Task 2 RED: tests del parser de Cámara** — `6499a8e` (test)
4. **Task 2 GREEN: parser de Cámara (cheerio sobre HTML real)** — `63f6676` (feat)
5. **Task 3 RED: tests de los parsers del Senado** — `cdf3072` (test)
6. **Task 3 GREEN: parsers del Senado + slice E2E verde** — `fbcc632` (feat)

## TDD Gate Compliance

Los 3 tasks (`type=tdd`) siguieron el ciclo RED→GREEN con commits separados verificables en el historial: cada `feat(...)` va precedido de su `test(...)`. No hubo fase REFACTOR (la implementación quedó limpia en GREEN). En Task 1, un test de la fase RED asumió erróneamente que 2024 era un año de 53 semanas; se corrigió la EXPECTATIVA del test (2026 es el 53-week year real, validado contra la implementación y la regla ISO) durante RED — no se saltó RED con un test que pasara antes de la implementación.

## Decisions Made

- **ISO anclado al jueves + iteración lunes-a-lunes** — `enumerarSemanas` deriva la clave ISO de cada lunes en vez de incrementar un contador `week`, de modo que los bordes de año (la W1 puede caer en diciembre) y los 53-week years (2020/2026/2032) se resuelven solos, sin tablas especiales ni aritmética naïf (Pitfall 4 del RESEARCH).
- **Doble forma de la última columna de Cámara** — el fixture real usa 100% la forma A (tabla anidada `<td colspan=2>` con `.w40`/`.w30`), pero el parser también acepta la forma B (2 `<td>` hermanos) por robustez ante drift. Cada fila de la tabla anidada produce un par materia/invitados → una citación puede tener múltiples puntos/boletines.
- **Boletín como única llave de cruce** — Cámara lo extrae de la materia (regex), el Senado lo toma de `NUMERO_BOLETIN`/`BOLETIN`. Nullable cuando no hay proyecto (seminarios, sesiones especiales) → enlace a la ficha opcional.
- **zod `safeParse` por fila (no `parse`)** — para descartar+registrar las filas con drift sin abortar toda la corrida; los fixtures reales son el contrato de forma (T-06-04).
- **Parseo de fecha explícito** — `parseFechaDmy` ("DD/MM/YYYY") y `parseFechaEsCl` ("LUNES, 15 DE JUNIO DE 2026") evitan el `new Date(str)` ambiguo entre husos/locales.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Import de `domhandler` rompía `pnpm -w typecheck`**
- **Found during:** Task 3 (typecheck de cierre tras los parsers del Senado)
- **Issue:** `parse-camara-citaciones.ts` tipaba un helper con `import type { AnyNode } from "domhandler"`. `domhandler` es una dependencia transitiva de `cheerio`, no un dep directo de `@obs/agenda` → `error TS2307: Cannot find module 'domhandler'`.
- **Fix:** Se eliminó el import de `domhandler` y se derivó el tipo del parámetro de la propia API de cheerio (`ReturnType<CheerioAPI>`), sin añadir ninguna dependencia nueva.
- **Files modified:** packages/agenda/src/parse-camara-citaciones.ts
- **Verification:** `pnpm -w typecheck` exit 0; suite de agenda 56/56 verde tras el cambio.
- **Committed in:** `fbcc632` (Task 3 GREEN)

**2. [Rule 3 - Blocking] `@ts-expect-error` obsoleto en slice.e2e tras añadir los parsers**
- **Found during:** Task 3 (al volver verde el slice)
- **Issue:** `slice.e2e.test.ts` (de 06-01) marcaba el import de los parsers con `// @ts-expect-error` porque en RED no existían. Con los parsers ya exportados, la directiva queda sin usar → habría reportado error de typecheck (unused `@ts-expect-error`).
- **Fix:** Se reemplazó el comentario `@ts-expect-error` por una nota "VERDE (ola 06-02)" y se conservó el import real (ahora resoluble).
- **Files modified:** packages/agenda/src/slice.e2e.test.ts
- **Verification:** slice.e2e 3/3 verde; typecheck exit 0.
- **Committed in:** `fbcc632` (Task 3 GREEN)

**Total deviations:** 2 auto-fixed (ambas blocking/typecheck, ningún cambio funcional ni de alcance).

## Threat Model Coverage

- **T-06-04 (Tampering / drift de esquema de la fuente):** mitigado — `CitacionSchema.safeParse` / `SesionSalaSchema.safeParse` por fila en los 3 parsers; una fila que no valida se descarta y se registra con `console.warn`, nunca se fabrica. Los fixtures reales de 06-01 son el contrato de forma.
- **T-06-05 (DoS / HTML-JSON gigante):** mitigado — cheerio no ejecuta scripts ni resuelve entidades externas; parseo de tamaño acotado (fixture Cámara ~235KB); sin recursión sobre input no acotado (iteración plana sobre artículos/filas/items).
- **T-06-02 (Tampering / identidad de invitados):** mitigado — invitados de Cámara como texto crudo de `.w30` (nombre + `calidad:null`), sin `parlamentario_id` ni afirmación de identidad/cargo verificado; el Senado no expone invitados (`invitados:[]`).

## Known Stubs

- Ninguno de datos. Los parsers emiten el modelo común real desde los fixtures reales. Los conectores (`@obs/ingest` + header-set anti-Cloudflare + enumeración ISO), el writer idempotente, la orquestación de ingesta y el frontend `/agenda` **no existen aún por diseño** — son las olas 06-03/06-04 de la fase. No es un stub que engañe a la UI: es el plan declarado de la fase (el helper `enumerarSemanas` ya queda listo para que el conector de Cámara haga la cobertura completa).

## Next Phase Readiness

- **Conectores (06-03/06-04):** `parseCamaraCitaciones`/`parseSenadoCitaciones`/`parseSenadoTabla` listos para que los conectores (que reusan `@obs/ingest`: assertAllowedUrl → robots → rateLimiter.wait → fetcher.get) los alimenten con HTML/JSON LIVE. El helper `enumerarSemanas` + `prmSemanaParam` da el plan de semanas ISO para la cobertura completa de Cámara. Falta añadir `web-back.senado.cl` a la SSRF allowlist y el header-set anti-Cloudflare en Cámara.
- **Writer idempotente:** las claves naturales (`citacion.id`, `sesion_sala.id`, unique(citacion_id,posicion)) ya están en la migración 0010; los ids sintéticos de los parsers casan con ellas.
- **Frontend `/agenda`:** los parsers emiten `semana_iso` (navegación), `boletin` (link a `/proyecto/[boletin]` de Fase 5) y provenance inline (ProvenanceBadge).

## Self-Check: PASSED

- Archivos creados verificados en disco: semana-iso(.test), parse-camara-citaciones(.test), parse-senado-citaciones(.test), parse-senado-tabla(.test) — todos FOUND.
- Commits verificados en el historial: 67f034c, c904319, 6499a8e, 63f6676, cdf3072, fbcc632 — todos FOUND.
- Suite: `pnpm --filter @obs/agenda test` → 56/56 verde; `pnpm -w typecheck` → exit 0; `slice.e2e.test.ts` → VERDE.

---
*Phase: 06-citaciones-tabla-semanal-de-sala*
*Completed: 2026-06-18*
