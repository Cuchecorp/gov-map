---
phase: quick/260728-nlb
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - packages/tramitacion/src/descubrimiento-boletines.ts
  - packages/tramitacion/src/descubrimiento-boletines.test.ts
  - packages/tramitacion/src/run-tramitacion-prod-cli.ts
autonomous: false
requirements: [NLB-01, NLB-02, NLB-03]

must_haves:
  truths:
    - "El cron diario de tramitación incorpora boletines del año en curso que aún NO existen en `proyecto` (hasta un cap por corrida), sin cambiar el schedule ni la cadencia."
    - "El descubrimiento agrega COMO MÁXIMO 2 requests extra por corrida (las dos ops de `enumerarProyectosXAnno` del año actual), también en `--dry-run` con credenciales."
    - "Si el WS de enumeración falla, la corrida del cron SIGUE con su set normal y loguea `[WARN] descubrimiento omitido: <causa>` (jamás aborta)."
    - "`--sin-descubrimiento` apaga el paso: CERO llamadas al WS y selección byte-equivalente a la actual (comprobado por test con conector espía)."
    - "El descubrimiento NO expulsa ítems ya contabilizados por la rotación DEBT-04: la ventana rotada se pide con `limite - nuevos.length`."
    - "El boletín 18464-14 existe en `proyecto` en PROD con `titulo` no vacío y ≥1 fila en `tramitacion_evento`."
  artifacts:
    - path: "packages/tramitacion/src/descubrimiento-boletines.ts"
      provides: "Lógica pura de diff/cap/orden + wrapper degradable sobre enumerarProyectosXAnno"
      exports: ["seleccionarNuevos", "intercalarDescubrimiento", "descubrirNuevosDelAnno", "crearConectorDescubrimiento", "CAP_DESCUBRIMIENTO"]
    - path: "packages/tramitacion/src/descubrimiento-boletines.test.ts"
      provides: "Tests de diff, cap, orden de prioridad, invariante de presupuesto de rotación, kill-switch y degradación honesta"
    - path: "packages/tramitacion/src/run-tramitacion-prod-cli.ts"
      provides: "Cableado del descubrimiento dentro de boletinesARefrescar + flag --sin-descubrimiento"
  key_links:
    - from: "packages/tramitacion/src/run-tramitacion-prod-cli.ts"
      to: "packages/tramitacion/src/descubrimiento-boletines.ts"
      via: "import { descubrirNuevosDelAnno, intercalarDescubrimiento, crearConectorDescubrimiento }"
      pattern: "descubrimiento-boletines"
    - from: "packages/tramitacion/src/descubrimiento-boletines.ts"
      to: "packages/tramitacion/src/connector-camara.ts"
      via: "enumerarProyectosXAnno(anno) sobre CamaraConnector (política LOCKED ya interna)"
      pattern: "enumerarProyectosXAnno"
---

<objective>
Cablear DESCUBRIMIENTO de boletines nuevos al cron diario de tramitación e ingerir de inmediato el 18.464-14 (y los faltantes más recientes) en PROD.

Purpose: hoy el set de refresh es `agenda ∪ proyecto` — un proyecto nuevo que nunca pasó por una citación capturada NO existe para la plataforma. El 18464-14 es el caso testigo (ausente de `proyecto` y de agenda).
Output: módulo `descubrimiento-boletines` con tests, cableado acotado en el CLI del cron, y PROD con el 18464-14 más un lote de faltantes recientes.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@CLAUDE.md

@packages/tramitacion/src/run-tramitacion-prod-cli.ts
@packages/tramitacion/src/connector-camara.ts
@packages/tramitacion/src/rotacion-leyes.ts
@packages/tramitacion/src/rotacion-leyes.test.ts

<interfaces>
De packages/tramitacion/src/connector-camara.ts:
```typescript
class CamaraConnector {
  constructor(deps: { fetcher: Fetcher; rateLimiter: HostRateLimiter; robots: RobotsGuard });
  // Política LOCKED YA interna (SSRF allowlist → robots → rate-limit 2-3s → UA).
  // Best-effort por op (2 ops: mociones + mensajes). Si AMBAS fallan → LANZA.
  enumerarProyectosXAnno(anno: number): Promise<string[]>;
}
```

De packages/tramitacion/src/rotacion-leyes.ts:
```typescript
export interface ClienteCorpus { /* .from().select().order().range() */ }
export function leerCorpusPaginado(sb: ClienteCorpus, tabla: string): Promise<string[]>;
export function seleccionarRotado(input: { agenda: string[]; corpus: string[]; offset: number; limite: number }):
  { seleccion: string[]; nuevoOffset: number };
```

De run-enumerar-historico-cli.ts (NO tocar ese archivo; reusar solo el patrón):
```typescript
const BOLETIN_RE = /^\d{3,6}-\d{1,3}$/;
```

Schema real (supabase/migrations/0008_tramitacion.sql) — CRÍTICO para las queries de verificación:
- `proyecto` tiene PRIMARY KEY `boletin`. **NO existe columna `id`.**
- `tramitacion_evento` referencia el proyecto por columna `boletin` (FK directa) — NO hay join por `proyecto_id`.
- `proyecto.titulo` es NOT NULL → `titulo is not null` es TAUTOLÓGICO y no verifica nada.
</interfaces>

Reglas LOCKED (CLAUDE.md): ingesta en dos etapas (fuente→R2 crudo, R2→Supabase), hash-check antes de descargar, rate-limit 2–3s/host + UA + robots, backfill masivo = LOCAL (nunca GitHub Actions), cron de novedades = lotes acotados. Ninguna se relaja aquí: el descubrimiento son 2 requests del año actual y el resto del pipeline es el existente.
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Módulo de descubrimiento + cableado en el CLI del cron</name>
  <files>packages/tramitacion/src/descubrimiento-boletines.ts, packages/tramitacion/src/descubrimiento-boletines.test.ts, packages/tramitacion/src/run-tramitacion-prod-cli.ts</files>
  <read_first>
    - packages/tramitacion/src/run-tramitacion-prod-cli.ts (líneas 90-241: `boletinesARefrescar` y `run`)
    - packages/tramitacion/src/rotacion-leyes.test.ts (patrón de cliente fake y estilo de tests)
    - packages/tramitacion/src/connector-camara.ts líneas 130-170 (contrato de `enumerarProyectosXAnno`)
  </read_first>
  <behavior>
    - `seleccionarNuevos({ enumerados, corpus, cap })`: filtra por `BOLETIN_RE`, deduplica, excluye todo lo ya presente en `corpus` (comparación por string exacto, trim), ordena por RECENCIA (número de boletín descendente: parte antes del guion como entero, desempate por sufijo) y recorta a `cap`. Casos: enumerados vacíos → `[]`; todo ya en corpus → `[]`; más de `cap` nuevos → exactamente `cap`, los de mayor número; entradas malformadas (`"abc"`, `""`, `"18464"`) descartadas.
    - `intercalarDescubrimiento({ seleccion, agenda, nuevos, limite })`: devuelve `dedupe([...agendaPresenteEnSeleccion, ...nuevos, ...restoDeSeleccion])` recortado a `limite`. Casos: `nuevos` vacío → resultado IDÉNTICO a `seleccion`; un `nuevo` que ya estaba en `seleccion` no se duplica; el largo nunca excede `limite`; los ítems de agenda conservan la primera posición.
    - **INVARIANTE de presupuesto (test explícito):** cuando hay `n` nuevos, `seleccionarRotado` se invoca con `limite - n` (piso 0) → NINGÚN boletín que la rotación DEBT-04 contabilizó en su ventana queda expulsado por el recorte final. Test: con `limite=10` y 3 nuevos, se pide la ventana rotada con `limite=7`, el resultado final tiene 10 ítems y los 7 rotados están TODOS presentes.
    - **Kill-switch funcional (test explícito):** con `descubrir=false`, el conector espía registra CERO llamadas a `enumerarProyectosXAnno` y la selección es IDÉNTICA a la que produce `seleccionarRotado(limite)` sin descubrimiento.
    - `descubrirNuevosDelAnno({ conector, anno, corpus, cap, log })`: llama `conector.enumerarProyectosXAnno(anno)` UNA vez y aplica `seleccionarNuevos`. Si la llamada lanza → devuelve `[]` y loguea exactamente `[WARN] descubrimiento omitido: <mensaje>` (nunca relanza).
    - `CAP_DESCUBRIMIENTO === 20`.
  </behavior>
  <action>
Crear `packages/tramitacion/src/descubrimiento-boletines.ts` con las funciones puras `seleccionarNuevos` e `intercalarDescubrimiento`, la constante `CAP_DESCUBRIMIENTO = 20`, un `BOLETIN_RE` local idéntico al de `run-enumerar-historico-cli` (copiar el literal, NO importar de ese archivo: es un entrypoint one-shot que no se toca), y `descubrirNuevosDelAnno` que recibe el conector por parámetro tipado estructuralmente (`{ enumerarProyectosXAnno(anno: number): Promise<string[]> }`) para que los tests puedan mockearlo sin red.

Extraer también el ENSAMBLADO del conector a una función exportada `crearConectorDescubrimiento()` (que hace `new CamaraConnector({ fetcher: new Fetcher(), rateLimiter: new HostRateLimiter(), robots: new RobotsGuard({ allowlist: {} }) })`, espejo verbatim de `run-enumerar-historico-cli`). Así el CLI la inyecta y los tests pueden sustituirla por un espía — el kill-switch se verifica FUNCIONALMENTE (cero llamadas al WS), no por grep.

`descubrirNuevosDelAnno` envuelve la llamada en try/catch y degrada a `[]` con el log `[WARN] descubrimiento omitido: <causa>`. Documentar en el header del módulo: (a) el descubrimiento agrega COMO MÁXIMO 2 requests extra por corrida (las 2 ops internas de `enumerarProyectosXAnno` del año actual); (b) ese presupuesto de 2 requests también se gasta en `--dry-run` CON credenciales — es coherente con el diseño existente ("el dry-run ejercita el gather + el fetch a las fuentes, solo se salta la escritura"); (c) la política LOCKED (rate-limit/robots/UA) ya vive dentro del connector y NO se hand-rollea aquí; (d) los nuevos que no caben en el cap los absorbe la rotación en corridas siguientes (tras la primera ingesta ya existen en `proyecto`).

Escribir `descubrimiento-boletines.test.ts` cubriendo TODOS los casos del bloque `<behavior>` — incluidos el invariante de presupuesto de rotación y el kill-switch con conector espía — en el estilo de `rotacion-leyes.test.ts` (mock del conector: uno que resuelve lista, uno que lanza, uno espía que cuenta llamadas).

Cablear en `run-tramitacion-prod-cli.ts`:
- Nuevo flag `--sin-descubrimiento` leído en `run()` y propagado a `boletinesARefrescar` como parámetro `descubrir: boolean`. Aceptar también un parámetro opcional `crearConector` (default `crearConectorDescubrimiento`) para poder inyectar el espía desde los tests.
- Dentro de `boletinesARefrescar`, tras obtener `agenda` y `corpus` (que ya viene paginado vía `leerCorpusPaginado` → cap 1k de PostgREST resuelto) y ANTES de llamar `seleccionarRotado`: si `descubrir`, ejecutar `descubrirNuevosDelAnno({ conector: crearConector(), anno: new Date().getUTCFullYear(), corpus, cap: CAP_DESCUBRIMIENTO, log })`.
- **ORDEN LOAD-BEARING:** con `nuevos.length = n`, llamar `seleccionarRotado({ agenda, corpus, offset, limite: Math.max(0, limite - n) })` y luego componer con `intercalarDescubrimiento({ seleccion, agenda, nuevos, limite })`. Descubrir DESPUÉS de la rotación haría que el recorte final expulse ítems que la rotación ya dio por cubiertos y que el `nuevoOffset` persiste como vistos — silenciosamente saltados hasta el próximo wrap-around.
- El upsert del `offset_rotacion` (id=1) usa el `nuevoOffset` que devuelve esa llamada de `seleccionarRotado` (ya consistente con la ventana realmente entregada); `ultimo_boletin` sigue siendo el último de la selección FINAL.
- Añadir el conteo de descubiertos al log existente de `boletinesARefrescar` (ej. `+N nuevos descubiertos año YYYY`).
- Actualizar el comentario-cabecera del archivo: la nota "el WS no enumera por año" quedó OBSOLETA — `enumerarProyectosXAnno` sí enumera y ahora alimenta el set.
- El paso solo corre cuando NO hay `--boletines` explícito (override sigue siendo override puro).
NO cambiar `.github/workflows/leyes-weekly.yml` (ya es diario L–V). NO tocar `run-enumerar-historico-cli.ts`.
  </action>
  <verify>
    <automated>pnpm --filter @obs/tramitacion test -- descubrimiento-boletines && pnpm --filter @obs/tramitacion exec tsc --noEmit</automated>
  </verify>
  <acceptance_criteria>
    - `descubrimiento-boletines.test.ts` verde con los casos de diff, cap, orden de prioridad, invariante de presupuesto de rotación (`limite - n`) y degradación.
    - Test de kill-switch: con `--sin-descubrimiento` / `descubrir=false`, el conector espía registra 0 llamadas y la selección coincide con la baseline sin descubrimiento.
    - `tsc --noEmit` limpio en el paquete.
    - `.github/workflows/leyes-weekly.yml` y `run-enumerar-historico-cli.ts` SIN cambios (`git diff --name-only` no los lista).
  </acceptance_criteria>
  <done>El cron descubre hasta 20 boletines nuevos del año en curso por corrida sin canibalizar la ventana de rotación, degrada honesto ante fallo del WS, y `--sin-descubrimiento` no toca el WS.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 2: Corrida LOCAL — enumerar 2025+2026 e ingerir 18464-14 + faltantes recientes</name>
  <files>(ninguno del repo — corrida de operador; salida se pega en el SUMMARY)</files>
  <read_first>
    - CLAUDE.md sección "Ingesta y Cron (LOCKED)" (backfill masivo = LOCAL, dos etapas, hash-check)
  </read_first>
  <what-built>
El paso de descubrimiento ya está en el CLI y testeado. Esta corrida es LOCAL (LOCKED: backfill masivo nunca en GitHub Actions) y hace dos cosas: medir cuántos boletines faltan de verdad, e ingerir el lote acotado pedido por el operador.
  </what-built>
  <how-to-verify>
1. Enumerar (solo lectura del WS, rate-limited, sin escribir DB) y volcar la lista a archivo:
   `pnpm exec tsx packages/tramitacion/src/run-enumerar-historico-cli.ts --desde 2025 --hasta 2026 > /tmp/enum.txt`
   Extraer solo las líneas de boletín (descartar cabeceras de log y la línea final `--boletines ...`) y ordenar:
   `grep -E '^[0-9]{3,6}-[0-9]{1,3}$' /tmp/enum.txt | sort -u > /tmp/enumerados.txt`
   Anotar la cifra HONESTA: `wc -l < /tmp/enumerados.txt`.
2. Volcar el corpus actual y diferenciar (psql SOLO SELECT; la URL de conexión nunca se imprime):
   `psql "$PGURL" -tA -c "select boletin from proyecto" | sort -u > /tmp/corpus.txt`
   `comm -23 /tmp/enumerados.txt /tmp/corpus.txt > /tmp/faltantes.txt`
   Reportar `wc -l < /tmp/faltantes.txt` como N faltantes TOTAL — sin maquillar.
3. Elegir el lote con el MISMO criterio que `seleccionarNuevos` (número de boletín DESCENDENTE):
   `sort -t- -k1,1nr -k2,2nr /tmp/faltantes.txt | grep -vx '18464-14' | head -15 > /tmp/lote.txt`
   Componer con el testigo PRIMERO: `LOTE="18464-14,$(paste -sd, /tmp/lote.txt)"`.
4. Ingerir el lote acotado con el CLI de PROD (el resto lo absorbe el cron diario):
   `pnpm exec tsx packages/tramitacion/src/run-tramitacion-prod-cli.ts --boletines "$LOTE"`
   Las dos etapas (fuente→R2 crudo, R2→Supabase) y el rate-limit 2–3s ya viven en el pipeline; no se fuerza nada.
5. Pegar en el SUMMARY: N faltantes, el lote usado, y los contadores `proyectos/votaciones/votos/eventos/errores`. NUNCA pegar secretos ni la URL de conexión.
  </how-to-verify>
  <acceptance_criteria>
    - Cifra de faltantes 2025+2026 registrada (número real de `wc -l /tmp/faltantes.txt`, no estimado).
    - Lote de ingesta con ≤16 boletines y `18464-14` en PRIMERA posición.
    - Corrida LIVE terminada con `errores=0` o cada error listado con su boletín y etapa.
    - Ninguna credencial ni URL de Supabase en la salida pegada.
  </acceptance_criteria>
  <resume-signal>Escribe "aprobado" con la cifra de faltantes y el resumen de contadores, o describe los errores.</resume-signal>
  <done>18464-14 y hasta 15 faltantes más recientes ingeridos en PROD desde la corrida LOCAL, con la cifra honesta de faltantes registrada.</done>
</task>

<task type="auto">
  <name>Task 3: Verificación en PROD + guards</name>
  <files>(ninguno — verificación read-only)</files>
  <read_first>
    - salida de la Task 2 (contadores y lista de boletines)
    - supabase/migrations/0008_tramitacion.sql (confirmar PK `boletin` de `proyecto` y FK `boletin` de `tramitacion_evento`)
  </read_first>
  <action>
Verificar con psql SOLO SELECT (la URL de conexión jamás se imprime en logs ni en el SUMMARY). Las queries respetan el schema real: `proyecto` tiene PK `boletin` y NO columna `id`; `tramitacion_evento` referencia por `boletin` directo (nada de join por `proyecto_id`); `titulo` es NOT NULL, así que se verifica CONTENIDO, no nulidad:
- `select boletin, length(btrim(titulo)) > 0 as titulo_util from proyecto where boletin = '18464-14';` → 1 fila con `titulo_util = t`.
- `select count(*) from tramitacion_evento where boletin = '18464-14';` → ≥ 1.
- Trazabilidad a la fuente (principio rector del proyecto): confirmar que las columnas de origen/enlace de esa fila de `proyecto` no vienen vacías — inspeccionar la fila con `select * from proyecto where boletin = '18464-14';` y registrar en el SUMMARY que fuente/enlace están poblados (o el detalle exacto de cuál falta).
- `select count(*) from proyecto;` → comparar con el conteo previo (3.659) y registrar el delta.
Luego correr suite + typecheck + guards del repo y registrar los resultados en el SUMMARY junto al delta de conteo.
  </action>
  <verify>
    <automated>pnpm --filter @obs/tramitacion test && pnpm -r exec tsc --noEmit && pnpm test</automated>
  </verify>
  <acceptance_criteria>
    - `18464-14` presente en `proyecto` con `length(btrim(titulo)) > 0` y ≥1 fila en `tramitacion_evento where boletin = '18464-14'`.
    - Enlace/origen de la fila registrados en el SUMMARY (poblados, o el faltante declarado explícitamente).
    - Delta de `count(*) from proyecto` registrado (antes 3.659 → después N).
    - Suite de `@obs/tramitacion`, typecheck y guards del repo verdes.
    - Ninguna sentencia distinta de SELECT ejecutada contra PROD.
  </acceptance_criteria>
  <done>PROD verificado con el testigo presente y trazable, delta de corpus registrado y verde en suite/tsc/guards.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| WS Cámara → conector | XML de tercero no confiable entra al pipeline de enumeración |
| CLI → Supabase PROD | escritura con service key (bypassa RLS) |
| Operador → psql PROD | conexión con credenciales de superusuario |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-nlb-01 | Tampering | `enumerarProyectosXAnno` → set del cron | mitigate | `BOLETIN_RE` + dedupe + `cap` 20 antes de que nada entre al set; el connector ya valida el XML con zod |
| T-nlb-02 | Denial of Service | WS gubernamental (WAF) | mitigate | máximo 2 requests extra por corrida (también en dry-run con creds); rate-limit 2–3s/robots/UA LOCKED dentro del connector, no re-implementados |
| T-nlb-03 | Denial of Service | corrida del cron | mitigate | fallo del descubrimiento degrada a `[]` + `[WARN]`; jamás aborta la corrida |
| T-nlb-04 | Information Disclosure | logs de CLI y SUMMARY | mitigate | credenciales solo desde `.env`/secrets, nunca por argv; URL de psql y service key nunca impresas |
| T-nlb-05 | Elevation of Privilege | psql sobre PROD | mitigate | verificación restringida a SELECT; sin DDL ni DML (no se toca schema en esta task) |
| T-nlb-06 | Repudiation | cobertura del corpus (rotación DEBT-04) | mitigate | rotación pedida con `limite - n` → el `offset` persistido nunca declara vistos boletines que el recorte expulsó; invariante con test |
| T-nlb-SC | Tampering | instalación de paquetes | accept | no se instalan dependencias nuevas; todo reusa módulos ya presentes en el workspace |
</threat_model>

<verification>
- `pnpm --filter @obs/tramitacion test` verde (incluye `descubrimiento-boletines.test.ts` y `rotacion-leyes.test.ts` sin regresión).
- `tsc --noEmit` limpio; guards del repo verdes.
- `git diff --name-only` NO incluye `.github/workflows/leyes-weekly.yml` ni `run-enumerar-historico-cli.ts`.
- PROD: `18464-14` en `proyecto` con título no vacío y ≥1 evento por `boletin`.
</verification>

<success_criteria>
- El cron diario incorpora boletines nuevos del año en curso (cap 20/corrida) con a lo más 2 requests extra y sin canibalizar la ventana de rotación.
- Degradación honesta y kill-switch comprobados por test (0 llamadas al WS con `--sin-descubrimiento`).
- 18464-14 consultable en la plataforma; cifra honesta de faltantes 2025+2026 registrada.
</success_criteria>

<output>
Create `.planning/quick/260728-nlb-descubrimiento-boletines-nuevos-cron-tra/260728-nlb-SUMMARY.md` when done
</output>
