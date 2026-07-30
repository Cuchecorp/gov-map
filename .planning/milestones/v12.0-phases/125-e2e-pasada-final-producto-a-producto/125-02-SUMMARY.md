---
phase: 125-e2e-pasada-final-producto-a-producto
plan: 02
subsystem: verificacion-e2e
tags: [e2e, dom, deploy, lobby, votos, cruces, fechas, 117, 122, 124]
requires:
  - "125-01 (deploy 0ea5d97f-a172-436e-aad0-add95940ee0e)"
  - "122-CRUCES-SQL.md (queries verbatim Q-04..Q-13, Q-16..Q-25, Q-43, Q-49, Q-69, Q-71, Q-74)"
  - "113-INVENTARIO.md §4.1 / §4.2 / §1.4"
  - "117-DISPOSICION.md F-01/F-03/F-05/F-07/F-09"
provides:
  - "125-E2E-A-FICHAS.md — evidencia DOM por superficie de las 4 rutas densas sobre el deploy real"
  - "cierre de los 2 items post-deploy que 122 dejo human_needed"
  - "re-confirmacion de que las 5 filas discrepancia-declarada de estas rutas siguen declaradas"
affects:
  - "catalogo 113 (2 correcciones de atribucion, sin accion de codigo)"
tech-stack:
  added: []
  patterns:
    - "conteo DOM con `grep -o | wc -l` (jamas `grep -c`: HTML de una sola linea)"
    - "lectura de numeros por offset (`grep -bo` + `tail -c +N | head -c M`) y comparacion NUMERICA"
    - "contenido real de Suspense leido de `<div hidden id=\"S:N\">`, no del placeholder del shell"
    - "separacion explicita payload-RSC vs HTML servido (cada literal aparece 2 veces)"
key-files:
  created:
    - ".planning/phases/125-e2e-pasada-final-producto-a-producto/125-E2E-A-FICHAS.md"
  modified: []
decisions:
  - "El criterio de ausencia de la frase «en las fuentes consultadas» se acota al bloque `id=\"lobby\"`, no a la pagina: la frase es LEGITIMA en `id=\"cruces\"` (estado `vacio`) y esa distincion es justamente lo que CR-01 arreglo"
  - "No se escala por `Q-74`: la cifra horneada (5106|195|82|3.82) no cambio, asi que la condicion de escalada del plan no se cumple"
  - "No se escala por el canario de 124: el clamp de 0078 esta en PROD (topa en 4000) pero el call-site sigue pasando 1000, asi que 1000 es lo esperado y B-01 sigue abierto"
  - "La cardinalidad del timeline de 14309-04 (85 `Hito del` vs 99 eventos) se declara como observacion ABIERTA en vez de veredicto `cuadra`: 117 gobierna el rotulo y el helper, no la seleccion de eventos"
metrics:
  duration: "~50 min"
  completed: 2026-07-29
  rutas_medidas: 7
  requests_al_worker: 7
  queries_sql_reejecutadas: 19
  filas_declaradas_reverificadas: 5
---

# Phase 125 Plan 02: E2E de rutas densas (fichas) Summary

Las 4 rutas densas del inventario 113 quedaron recorridas superficie por superficie sobre el deploy
`0ea5d97f`, con cada número del DOM cruzado contra SQL **re-ejecutado hoy**, y los 2 ítems post-deploy
que 122 dejó `human_needed` quedaron **cerrados con fragmento DOM**.

## Qué se hizo

**Paso 0 (bloqueante) pasado antes de medir nada:** uuid `0ea5d97f-a172-436e-aad0-add95940ee0e` leído
del runbook + marcador `3,8` presente (**2** ocurrencias) en `/proyecto/14309-04`. Sin ese doble
control, todo lo demás sería evidencia "verde" del sitio viejo.

| # | tarea | resultado |
|---|---|---|
| 1 | Cerrar los 2 ítems heredados de 122 | **CERRADOS** — §1 del artefacto |
| 2 | Barrido de `/parlamentario/D1165` y `/parlamentario/S1338` | 5 anclas + 5 chips + 10 filas de relaciones + votos + cruces + 6 controles de fecha por sujeto |
| 3 | Barrido de `/proyecto/14309-04` y `/proyecto/17870-05` | 12 anclas, cruces vs SQL, F-03/F-05/F-07/F-09 de 117, degradación solo-Senado, `Q-71` |

## Los 2 ítems heredados de 122 — cerrados

**Ítem 1 — `/parlamentario/S1338`, DOS ausencias (cierre de CR-01).** El bloque de lobby se aisló por
offsets (`id="lobby"` @101630 → `id="patrimonio"` @101890, **260 bytes**):

```html
<section id="lobby" class="mt-12">…<h2 class="text-xl font-semibold">Reuniones de lobby</h2><span class="text-sm text-muted-foreground">—</span></div><div class="space-y-3"></div></section>
```

- dígitos de conteo en el texto visible del bloque: **0** (el encabezado sigue en `—`)
- ocurrencias de `en las fuentes consultadas` en el bloque: **0**

**Alcance declarado con honestidad:** la frase existe **6 veces en la página** (offsets 95232, 107864,
196397, 196600, 217897, 218069) y **ninguna** cae en el bloque de lobby. La de 107864 está en
`id="cruces"` @107141 y es **legítima**: cruces es `vacio` (cron global ⇒ ingestado), lobby es
`no_ingerido`. Ésa es exactamente la distinción de tipo que CR-01 arregló, por eso el `grep -c` global
del `<automated>` del plan **no puede** ser el criterio.

**Ítem 2 — línea de cobertura tras la leyenda y antes del conteo.** Probado por **orden**, no por
presencia, en `/proyecto/14309-04` y `/proyecto/16849-12`, y en **ambas** copias del DOM:

| ruta | copia | leyenda | cobertura | conteo | orden |
|---|---|---:|---:|---:|:---:|
| `14309-04` | HTML real | 1.231.587 | 1.231.877 | 1.232.183 | ✓ |
| `16849-12` | HTML real | 517.731 | 518.021 | 518.328 | ✓ |

Con `3,8 %` **y** `29 jul 2026` presentes, y el conteo cuadrando con `Q-69` (`1|1` → singular
`audiencia registrada menciona`; `13|13` → plural `audiencias registradas mencionan`).

**`Q-74` re-ejecutada: `5106|195|82|3.82` — sin cambio** ⇒ `COBERTURA_MENCIONES_LOBBY` y
`COBERTURA_OBSERVADA_EL` siguen vigentes, no hay que tocarlas, no hay re-deploy, no hay escalada.

## El canario de 124 — PASADO, y explicado hasta el fondo

`Ver detalle` en `D1165` da **1000**, no `3752`. No se dio por bueno: se verificó por qué.

```sql
-- el clamp de 0078 SI esta en PROD
select case when pg_get_functiondef(p.oid) ilike '%least(coalesce(p_limit%'
       then 'clamp PRESENTE' else 'clamp AUSENTE' end from pg_proc p …
-- clamp least(coalesce(p_limit,20),4000) PRESENTE
-- firma real: votos_de_parlamentario(p_id text, p_limit int DEFAULT 20, p_offset int DEFAULT 0)
-- Q-17 con p_limit=1000  →  D1165: 1000   ·   S1338: 949
-- Q-16 primeros principios →  D1165: 3752  ·   S1338: 949
```

El clamp topa en **4000**; el **call-site del sitio sigue pasando 1.000** ⇒ el DOM muestra `1000`.
**`B-01` (exactitud) sigue abierto y fuera del alcance de 124.** Cero escalada.

## Las 8 filas `discrepancia-declarada` de 122

| fila | estado |
|---|:---:|
| **2.1** `Ver detalle (1000)` | **SIGUE DECLARADA** ✓ |
| **2.5** `Presente en 973 de 1000 … Ausente en 27` | **SIGUE DECLARADA** ✓ |
| **2.6** capa-1 `469 / 466 / 22 / 16 / 27` (Σ 1000) | **SIGUE DECLARADA** ✓ |
| **3.b-9** empty-state de E-053 no emitido | **SIGUE DECLARADA** ✓ |
| **5.5** rama truncada (`Q-71` = `13` sobre 82) | **SIGUE DECLARADA** ✓ |
| 3.3 · 4-14 · 4-15 | fuera de alcance (`/comparar` y panel: planes 03/04) |

**Ninguna se cerró sola** ⇒ cero hallazgo de cierre espontáneo.

## Números que cuadran contra SQL re-ejecutado

- **Relaciones (10 filas):** `27 / 0 / 24 / 48 / 2` (D1165) y `9 / 4 / 0 / 21 / 2` (S1338) — DOM ==
  `total_n`. Los 5 literales `Mostrando los primeros 8 de M` idénticos a 122. Vacío honesto por bloque
  en 1.2 y 1.8 (bloque **ausente** del DOM, no relleno).
- **Chips del rail:** `1000 / 112 / 6 / 11 / pendiente` y `949 / — / 9 / sin registros / pendiente`.
  Los 3 estados-valores (`dato` / `vacio` / `no_ingerido`) se distinguen y ninguno se rellena.
- **Cruces:** `Explorar los 47 cruces` == `cruces_de_proyecto('14309-04')` = **47**; `Ver las 11
  señales de lobby por sector` == `cruces_de_parlamentario('D1165')` = **11**.
- **Rótulos de hito, cuadre 1 a 1:** `Votada el` en HTML = **7** = `votacion` de `14309-04`; = **256**
  = `votacion` de `17870-05`. `Hito del` en HTML de `17870-05` = **355** = `tramitacion_evento`.
- **`Q-71`:** `13` sobre `82` boletines — el techo no se movió, la rama `LIMIT 50` sigue inalcanzable.

## Fechas (117) — los 6 controles, en las 4 rutas

`según fuente al ` presente (14 / 20 / 32 / 527) · `Actualizado` (idiom viejo) **0** ·
`Actualizado hace` **0** (declarado **INERTE**: ya era 0 pre-deploy) · `corte al` **0** ·
`captura` pelado **0** · `recalculado por el Observatorio al ` presente donde aplica.

**El gotcha rector de v12.0 probado con un caso real:** la última votación real de `17870-05` es
`2025-11-26 20:32:50+00` en la base y el DOM rinde `Votada el 26 nov 2025` — **`26`, no `25`**. Una
conversión de zona global habría fabricado el día anterior. `fechaHechoCorta` preserva el día.

## Degradación honesta de la zona solo-Senado (`17870-05`, `prm_id_camara = NULL`)

| host | `14309-04` | `17870-05` |
|---|---:|---:|
| `www.camara.cl` (**construido** desde `prm_id_camara`) | 146 | **0** |
| `tramitacion.senado.cl` | 9 | 279 |

`<ul>` de «Valida este dato en la fuente» con **un solo** `<li>` (Senado) frente a **dos** en el
bicameral (donde el `prmID=14891` del href es exactamente el `prm_id_camara` de la base). **Cero
relleno, cero link roto, cero "no disponible":** la ausencia es un nodo ausente.

## Deviations from Plan

### Auto-fixed / RULE-1

**1. [RULE-1] Falso negativo de medición propio, corregido y publicado**
- **Found during:** Task 3
- **Issue:** la primera pasada midió `Votada el ` **con espacio final** y leyó **0** en ambas rutas de
  proyecto — habría reportado que el rótulo de votación no llega al deploy, que es falso.
- **Causa:** el fuente es `Votada el{" "}` (`votacion-card.tsx:48`) y React rinde
  `Votada el<!-- --> <span…`; el espacio **nunca** sigue al literal. Misma familia de gotcha que el
  plan advierte para los dígitos.
- **Fix:** patrón sin espacio final + verificación por vecindad. Valores correctos **7** y **256**.
- **Se publicó el error junto al número bueno**, no sólo el número bueno.

**2. [RULE-1] HALLAZGO-125-02-01 — el copy de `not-found` no viaja en el HTML SSR**
- **Found during:** Task 2 (re-confirmado en Task 3)
- **Issue:** `/parlamentario/NOEXISTE` y `/proyecto/00000-00` devuelven **404** correcto y el copy de
  E-049/E-023 es byte-idéntico al fuente, pero vive **sólo en el payload de RSC**:
  `grep -o "<main" nf_proy.html | wc -l` → **0**; `digest: NEXT_HTTP_ERROR_FALLBACK;404`. El shell
  servido trae sólo chrome y el `notFound` se resuelve tras hidratación.
- **Severidad:** **baja** — no es dato erróneo ni relleno, el status HTTP es correcto y el contenido
  llega al usuario.
- **Disposición:** **cero fix** (este plan es read-only por régimen). Handoff a catálogo 113.

**3. [RULE-1] Corrección de catálogo 113 §4.1 — `S1338` sí ofrece la entrada `#cruces`**
- El inventario afirma que con `S1338` *"A3 no ofrece la entrada `#cruces`"*. El deploy lo contradice:
  `href="#cruces"` × **1** y `id="cruces"` × **1**. Es coherente con 122 §2.4.4 (chip con estado
  `vacio` = `sin registros`, porque el cron de cruces es global). Corrección de catálogo, sin acción
  de código.

**4. [declarada, no cerrada] `85` `Hito del` vs `99` eventos en `14309-04`**
- Se muestran **menos**, nunca más ⇒ no hay relleno ni invención. Pero este plan **no** audita la
  regla de selección del timeline (117 gobierna el rótulo y el helper, no la cardinalidad). Se declara
  como observación **abierta** en vez de emitir un `cuadra` sin la query que lo demuestre.

## Límites declarados

1. **Cobertura por sujeto, no exhaustiva:** 4 rutas (7 requests). El barrido completo de links es el
   plan 05; la re-lectura de las 82 filas de cruces, el plan 06.
2. **`16849-12` no es sujeto determinista de 113:** se midió porque 122 §"Qué queda pendiente" lo
   nombra como segundo caso de la fila 5.12 (y porque ejercita el **plural** del conteo).
3. **La rama truncada de lobby no es observable:** `max(total_n)` = 13 contra un techo de 50. No se
   verifica una rama inalcanzable; se registra que el techo no se movió.
4. **`S1338` no es el caso de vacío total** (LÍMITE 1 de 122, re-confirmado): tiene 4 de 5 ejes con
   datos. El contrato `RelacionesSection vacio` no se dispara para ningún sujeto de PROD.

## Emisores huérfanos — declarados, no buscados en el DOM

`E-029` `ResumenView` (`aria-label="Secciones de la ficha"` → **0** en ambas fichas; `page.tsx`
importa sólo `construirChips`) · `E-053` empty-state (sólo se monta con `tipo === "dato"`) ·
`E-003` · `E-008` `actualidad-module.tsx`.

## Régimen cumplido

`curl` **secuencial**, 1 s entre requests, User-Agent identificatorio, **sólo** contra el Worker
propio · **cero** requests a fuentes gubernamentales · **sólo `SELECT`** (19 queries, todas verbatim
de 122 o de lectura de catálogo `pg_proc`/`information_schema`) · `SUPABASE_DB_URL` **jamás** expandida
ni ecoada · cero DDL/DML · cero deploy · cero flags · cero fixes de código · cero PII (sólo conteos y
copy institucional; los nombres que aparecen en fragmentos de relaciones son de parlamentarios en
ejercicio, dato público del registro, y ningún RUT se cita).

## Commits

| # | hash | qué |
|---|---|---|
| 1 | `fa64f5d` | §1 — cierre de los 2 ítems post-deploy de 122 |
| 2 | `105da06` | §2 — barrido de `/parlamentario/D1165` y `S1338` |
| 3 | `5d39092` | §3/§4 — barrido de `/proyecto/14309-04` y `17870-05` + cierre |

## Self-Check: PASSED

- `125-E2E-A-FICHAS.md` existe (**642** líneas) y contiene `S1338` (**27** ocurrencias, exige
  `must_haves.artifacts.contains`) y `Q-74` (**2**, exige `key_links.pattern`).
- Los 3 commits existen: `fa64f5d`, `105da06`, `5d39092` (verificados con `git cat-file -e`).
- Cero afirmaciones sin fragmento DOM o sin salida SQL citada.

## Nota para el orquestador

**`STATE.md`, `ROADMAP.md` y `REQUIREMENTS.md` NO se tocaron a propósito.** Los planes 125-03/04/05/06
corren **en paralelo** sobre la misma wave; escribir esos archivos compartidos desde este ejecutor
produciría carreras de escritura. La actualización de estado y el `roadmap update-plan-progress`
quedan para el orquestador al cerrar la wave.
