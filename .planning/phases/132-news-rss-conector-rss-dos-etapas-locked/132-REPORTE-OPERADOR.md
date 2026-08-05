# Phase 132 — Reporte al Operador (handoff, NO gate)

**Fecha de la corrida:** 2026-08-05
**Estado:** artefacto de handoff. La fase 132 se cierra sin esperar respuesta de este reporte
(precedente Phase 129 `AUSENTE-HANDOFF`). El operador lo revisa cuando pueda y decide alcance
para una fase futura si corresponde.

---

## 1. Qué se ingirió

Corrida LIVE única contra los **N=5** feeds directos vivos (`FEEDS.length`, congelados en 132-01,
D-132-A): biobiochile, cooperativa, latercera, lacuarta, exante.

| Outlet | ítems parseados (vistos) | cargados en `noticia` | descartados por `prefiltro_lexico` |
|--------|--------------------------:|-----------------------:|-------------------------------------:|
| BioBioChile | 20 | 0 | 20 |
| Cooperativa | 15 | 0 | 15 |
| La Tercera | 100 | 18 | 82 |
| La Cuarta | 100 | 7 | 93 |
| Ex-Ante | 10 | 0 | 10 |
| **Total** | **245** | **25** | **220** |

Cargados por outlet en `noticia` (PROD, `select outlet, count(*) from noticia group by 1`):
`La Tercera=18`, `La Cuarta=7` (el resto de outlets no aportó ítems que pasaran el prefiltro
léxico en esta corrida — el prefiltro es intencionalmente recall-first pero exigente, ver
132-04-T3).

`noticia_url_vista` por causa: `prefiltro_lexico=220`, `(pasa)=25`. La suma (245) coincide con el
total de ítems parseados (`vistos=245`) reportado por el CLI.

## 2. D-132-A destacado: Google News RSS Search DESCARTADO

`news.google.com/robots.txt` declara `Disallow: /` para `User-agent: *`, con una allowlist de
`Allow:` que **no incluye `/rss/`** (solo `/`, `/?`, `/home`, `/nwshp`, `/topics/`,
`/publications/`, `/stories/`, `/swg/`, `/about`). Verificado con `robots-parser@3.0.1` (la misma
librería de `RobotsGuard`) bajo el `IDENTIFIED_UA` del framework.

**Re-verificación de hoy (2026-08-05):** `GET https://news.google.com/robots.txt` → HTTP 200,
`isAllowed("https://news.google.com/rss/search?q=test", IDENTIFIED_UA)` → **`false`**. El
documento **no cambió** respecto de lo registrado en `132-RESEARCH.md`.

Costo real del descarte: se pierde el fan-out a 40+ outlets vía el tag `<source>` de Google News.
La cobertura de la fase queda en los **5 feeds directos vivos** (N=5; ningún host fue retirado
por el riesgo A4 — los 5 respondieron 200 tanto en el probe de 132-01 como en la corrida LIVE de
hoy).

Evadir el guard (UA spoofeado, saltarse robots) **no es una opción disponible** — viola
CLAUDE.md §Ingesta respetuosa y el propio SC1 de esta fase — salvo que Google reabra `/rss/` en
el futuro.

## 3. Opciones de alcance para el operador (a decidir cuando quiera, fuera de esta fase)

- **(a)** Confirmar D-132-A tal cual: 5 medios directos, sin Google News.
- **(b)** Confirmar D-132-A + encargar a una fase futura la ampliación de medios directos (cada
  candidato exige verificar robots.txt + RSS vivo antes de sumarlo a `FEEDS`).
- **(c)** Revisar el descarte de Google News solo si en el futuro `/rss/search` deja de estar en
  `Disallow: /`.

## 4. Qué NO entrega esta fase

- Sin clasificación LLM (fase 135).
- Sin taxonomía (fase 133).
- Sin resolución de identidad/entidades (fase 134).
- Sin cron de novedades (fase 136).
- Sin lectura pública (fase 137). `noticia` es **deny-all**: nada del sitio público lee esta
  tabla todavía.

## 5. Nota honesta sobre el SC2 (evidencia de la re-corrida `[skip]`)

**SC2 tal como está redactado (N líneas `[skip]`, cero requests HTTP en la re-corrida inmediata)
NO se cumplió literalmente.** La evidencia recogida durante la ejecución (`132-07-SUMMARY.md`
§Deviations) muestra que:

- El `[skip]` derivado (D-132-B, 132-06) depende de que `cache.hasToday` reporte un cache-hit; en
  producción real ese componente es el doble no-op de `buildNewsDeps()` (`async () => false`), así
  que `BaseConnector.run()` **jamás** hace el `continue` del que depende la derivación.
- No hay un **412 de R2** que sustituya al `[skip]` tampoco: `<lastBuildDate>` cambia el sha256 en
  cada corrida (esto SÍ estaba anticipado por el research, Pitfall 5 — la nota "no confiar en el
  412" era correcta).
- La re-corrida inmediata (paso 2 del plan) terminó ejecutando un **segundo fetch real** contra
  los 5 medios. Los datos en PROD se mantuvieron correctos e idempotentes (`source_snapshot` no
  duplicó filas gracias a la recuperación de la violación `23505` de unicidad
  `(source,resource,date_bucket)` en `SupabaseSnapshotStore`, y `noticia`/`noticia_url_vista` no
  duplicaron ítems gracias a la dedup por URL de `cargar()`), pero el mecanismo de **evitar la
  red** en la re-corrida no funcionó como el plan prometía.
- Impacto de red: la fase consumió **más** del presupuesto planeado (2N+1=11): se hicieron
  N=5 requests en el paso 1 y **N=5 requests adicionales** en el paso 2 (en vez de 0), más el
  request de robots.txt de esta sección → **3N+1 = 16** requests reales contra los medios/Google
  en el día, no 2N+1. Ningún medio devolvió 403/429/5xx en ninguna de las dos pasadas.

Esto es un hallazgo de implementación (132-06), no una regresión de este plan: `run-news-cli.ts`
nunca wireó un `DailyCache`/`SnapshotLookup` Postgres-backed real (decisión explícita documentada
en `132-06-SUMMARY.md` §Decisions Made, aceptada en su momento porque ningún acceptance criterion
de 132-06 exigía literalmente instanciarlo). Recomendación: antes de que el cron diario (fase 136)
dependa del `[skip]` para no re-scrapear cada día, wirear un `DailyCache` real (o una consulta
directa a `source_snapshot` por `date_bucket`) en `buildNewsDeps`/`run-news-cli.ts`.

## 6. Incidencias de fuentes

Ningún medio (biobiochile, cooperativa, latercera, lacuarta, exante) devolvió 403/429/5xx en
ninguna de las dos pasadas reales de hoy. Los 5 feeds respondieron 200 consistentemente, igual que
en el probe de 132-01.

---

*Fase: 132-news-rss-conector-rss-dos-etapas-locked*
*Generado: 2026-08-05 por 132-07 (ejecución autónoma)*
