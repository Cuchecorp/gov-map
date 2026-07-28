---
phase: quick/260728-nlb
plan: 01
subsystem: ingesta-tramitacion
tags: [cron, descubrimiento, camara-ws, rotacion, backfill-local]
requires:
  - packages/tramitacion/src/connector-camara.ts (enumerarProyectosXAnno)
  - packages/tramitacion/src/rotacion-leyes.ts (seleccionarRotado, leerCorpusPaginado)
provides:
  - descubrimiento de boletines nuevos del año en curso en el cron diario de tramitación
  - kill-switch --sin-descubrimiento
affects:
  - packages/tramitacion/src/run-tramitacion-prod-cli.ts
tech-stack:
  added: []
  patterns: [conector-inyectable-para-espía, degradación-honesta-con-WARN, presupuesto-descontado-antes-de-rotar]
key-files:
  created:
    - packages/tramitacion/src/descubrimiento-boletines.ts
    - packages/tramitacion/src/descubrimiento-boletines.test.ts
  modified:
    - packages/tramitacion/src/run-tramitacion-prod-cli.ts
decisions:
  - "ORDEN LOAD-BEARING: descubrir ANTES de rotar y pedir la ventana con `limite - nuevos.length`; descubrir después haría que el recorte final expulse ítems que el `nuevoOffset` ya persistió como vistos."
  - "El kill-switch se verifica FUNCIONALMENTE (conector espía con 0 llamadas), no por grep del flag."
  - "`crearConectorDescubrimiento` se extrae como export para que el CLI la inyecte y los tests la sustituyan sin tocar la red."
metrics:
  duration: ~35 min
  completed: 2026-07-28
---

# Quick Task 260728-nlb: Descubrimiento de boletines nuevos en el cron de tramitación — Summary

Cableado del descubrimiento de boletines del año en curso al cron diario de tramitación (cap 20/corrida, ≤2 requests extra, degradación honesta) más la corrida LOCAL que ingirió el testigo 18.464-14 y 15 faltantes recientes en PROD.

## Qué se construyó

**`descubrimiento-boletines.ts`** (nuevo). Cinco exports:

- `seleccionarNuevos({enumerados, corpus, cap})` — diff puro: filtra por `BOLETIN_RE`, deduplica, excluye lo ya presente en el corpus (comparación exacta tras `trim`), ordena por RECENCIA (número base descendente, desempate por sufijo) y recorta a `cap`.
- `intercalarDescubrimiento({seleccion, agenda, nuevos, limite})` — compone `dedupe([...agendaEnSeleccion, ...nuevos, ...resto])` recortado a `limite`. Con `nuevos` vacío el resultado es idéntico a `seleccion`.
- `descubrirNuevosDelAnno({conector, anno, corpus, cap, log})` — una sola llamada a `enumerarProyectosXAnno`; ante cualquier fallo devuelve `[]` y loguea `[WARN] descubrimiento omitido: <causa>`. Nunca relanza.
- `crearConectorDescubrimiento()` — ensamblado del `CamaraConnector` real, espejo verbatim de `run-enumerar-historico-cli`.
- `CAP_DESCUBRIMIENTO = 20`.

La cabecera del módulo documenta los cuatro puntos exigidos: (a) máximo 2 requests extra por corrida; (b) ese presupuesto también se gasta en `--dry-run` con credenciales; (c) rate-limit/robots/UA/SSRF ya viven dentro del connector y no se hand-rollean; (d) los nuevos que no caben en el cap los absorbe la rotación en corridas siguientes.

**Cableado en `run-tramitacion-prod-cli.ts`.** `boletinesARefrescar` recibe `descubrir: boolean` y un `crearConector` inyectable (default = el real). El paso corre tras leer agenda y corpus y ANTES de `seleccionarRotado`, que ahora se invoca con `limite: Math.max(0, limite - nuevos.length)`; la composición final la hace `intercalarDescubrimiento`. El `nuevoOffset` persistido es el de esa llamada (consistente con la ventana realmente entregada) y `ultimo_boletin` sigue siendo el último de la selección final. El log reporta `+N nuevos descubiertos año YYYY` o `descubrimiento OFF (--sin-descubrimiento)`. El paso no corre con `--boletines` explícito (override sigue siendo override puro). La nota-cabecera "el WS no enumera por año" se marcó OBSOLETA.

## Corrida LOCAL (Task 2 — auto-aprobada)

Auto-approved: el operador pidió esta corrida explícitamente en la sesión del 2026-07-28 ("hay muchos boletines que no están! por ejemplo el boletín N° 18.464-14"). El checkpoint no era de legitimidad de paquete, así que no aplicaba la exclusión `blocking-human`.

| Paso | Resultado |
|------|-----------|
| Enumeración WS 2025+2026 (`run-enumerar-historico-cli`) | 707 (2025) + 463 (2026) = **1.170 boletines únicos**, errores=0 |
| Corpus en `proyecto` (psql, SELECT) | 3.659 |
| **Faltantes 2025+2026** | **60** (cifra real de `wc -l`, sin maquillar) |
| Lote ingerido | 16 boletines, testigo primero |
| Contadores de la corrida LIVE | `proyectos=16 votaciones=0 votos=0 eventos=38 errores=0` |

Lote usado: `18464-14, 18500-13, 18499-02, 18498-19, 18497-11, 18496-06, 18495-04, 18494-06, 18493-07, 18492-13, 18491-03, 18490-06, 18489-07, 18488-07, 18487-12, 18486-03`.

El WS de enumeración respondió a Node fetch sin problemas (`opendata.camara.cl`); no hizo falta el fallback curl-first. Las dos etapas se respetaron: cada boletín dejó su crudo content-addressed en R2 (`tramitacion/<boletin>/2026-07-28/<sha256>.json`) antes del upsert a Supabase. Rate-limit 2–3s intacto (política dentro del connector). Los 44 faltantes restantes los absorbe el cron diario ahora que el descubrimiento está cableado.

`votaciones=0 / votos=0` es honesto, no un fallo: son proyectos recién ingresados en primer trámite, sin votaciones registradas todavía.

## Verificación en PROD (Task 3 — solo SELECT)

- `select boletin, length(btrim(titulo)) > 0 ... where boletin='18464-14'` → `18464-14|t` (una fila, título con contenido real).
- `select count(*) from tramitacion_evento where boletin='18464-14'` → **6**.
- Trazabilidad a la fuente POBLADA: `origen = senado-wspublico`, `enlace = https://tramitacion.senado.cl/wspublico/tramitacion.php`, `fecha_captura = 2026-07-28 21:10:41+00`. Único campo vacío: `materia` (NULL) y `prm_id_camara` — coherente con el hallazgo previo de `proyecto.materia NULL` en PROD (99-03), no es regresión de esta tarea.
- Título del testigo: "Modifica el decreto ley N° 2.695, de 1979, estableciendo un nuevo procedimiento para la regularización de la posesión de la pequeña propiedad raíz…".
- **Delta de corpus: 3.659 → 3.675 (+16)**, exactamente los del lote.

Ninguna sentencia distinta de SELECT se ejecutó contra PROD. La URL de conexión nunca se imprimió (se lee de `.env` a variable y se pasa por argumento sin echo).

## Verificación de código

| Check | Resultado |
|-------|-----------|
| `pnpm --filter @obs/tramitacion test` | **188 tests / 19 archivos verdes** (17 nuevos) |
| `pnpm -r exec tsc --noEmit` | exit 0 |
| `pnpm test` (workspace completo) | **107 archivos / 1.560 tests verdes** en la app + 18 paquetes verdes |
| Guards de régimen | verdes dentro de la suite (env-example 16, bento-coherencia 8, gates money/vsim/net/cruces/admin/busqueda-hibrida) |
| `git diff --name-only` | NO lista `.github/workflows/leyes-weekly.yml` ni `run-enumerar-historico-cli.ts` |

Tests nuevos cubren: enumerados vacíos, todo-ya-en-corpus, malformados descartados, dedupe con trim, orden por recencia, desempate por sufijo, cap exacto, `nuevos` vacío ⇒ selección idéntica, no-duplicación, largo ≤ límite, **invariante de presupuesto** (limite=10 con 3 nuevos ⇒ rotación pedida con 7, final de 10 con los 7 rotados presentes), **kill-switch** (0 llamadas al espía + selección == baseline) y degradación con el `[WARN]` exacto.

## Ciclo TDD

| Gate | Commit |
|------|--------|
| RED | `8840e1e` — `test(260728-nlb): add failing tests…` (falla por módulo inexistente) |
| GREEN | `3aba04a` — `feat(260728-nlb): descubrir boletines nuevos del anno en curso en el cron` |

REFACTOR no fue necesario (implementación limpia al primer paso).

## Deviations from Plan

None — plan ejecutado tal como está escrito. Sin auto-fixes Rule 1-3, sin escalaciones Rule 4.

Nota de alcance: `pnpm-workspace.yaml` y `.planning/phases/119-.../119-REVIEW.md` aparecían modificados en el árbol ANTES de esta tarea (pre-existentes, ajenos al plan). No se tocaron ni se commitearon.

## Known Stubs

Ninguno. El módulo no tiene valores hardcodeados que fluyan a UI ni placeholders.

## Threat Flags

Ninguna superficie de seguridad nueva fuera del `<threat_model>` del plan. El descubrimiento consume un WS público ya allowlisted, no abre endpoints, no toca auth ni schema.

## Self-Check: PASSED

Archivos creados verificados en disco (modulo, tests, SUMMARY) y los 3 commits (8840e1e RED, 3aba04a GREEN, 093f9ec docs) presentes en el historial.
