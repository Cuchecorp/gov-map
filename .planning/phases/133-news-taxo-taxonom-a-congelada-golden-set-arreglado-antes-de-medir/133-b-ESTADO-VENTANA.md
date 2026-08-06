# 133-b — Estado de la ventana y pendientes resueltos

**Fecha:** 2026-08-06 · **Escrito tras cerrar 133-a.**
Registra lo medido al ejecutar los pendientes que 133-a le heredaba a 133-b. Dos se resolvieron con
evidencia; uno cambió de naturaleza; uno sigue abierto y **no depende del repo**.

---

## 🔴 HALLAZGO — el conector de news NO tiene cron: la ventana NO se acumula sola

**La premisa con la que se planificó 133-b era falsa.** D-133-B2 y el handoff dicen que *"la corrida
diaria del conector es la que acumula la ventana"*. Verificado: hay **13 workflows** en
`.github/workflows/` y **ninguno corre el conector de news** — el único archivo que lo menciona es
`ci.yml`, y es el step de tests que 133-a acaba de añadir.

No es un defecto: **el cron de news es la Phase 136**, todavía no construida. Pero significa que
nadie estaba acumulando nada, y el 2026-08-07 se habrían buscado 3 días de ventana para encontrar 1.

**Consecuencia operativa hasta que exista la 136:** la corrida diaria es **manual y local**
(`pnpm --filter @obs/news ingest`), coherente con el régimen (backfill/corridas masivas = LOCAL,
nunca GitHub Actions). **Alguien tiene que correrla cada día hábil** o la ventana no avanza.

---

## Día 2 ejecutado (2026-08-06)

`pnpm --filter @obs/news ingest` — 5 feeds, 0 skips, rate-limit y hash-check por construcción.

```
news-cli LIVE: feeds=5 descargados=5 skips=0 dbLoaded=true
carga: vistos=245 nuevos=222 duplicados=23 descartados=189 cargados=33 errores=0
```

Estado de PROD tras el día 2:

| Métrica | Día 1 (08-05) | **Tras día 2 (08-06)** |
|---|---|---|
| `noticia` | 25 | **58** |
| `noticia_url_vista` | 245 (220 descarta / 25 pasa) | **467** (409 descarta / 58 pasa) |
| `source_snapshot(news)` | 5 | **10** |

**Reparto por outlet — la debilidad estructural del estrato P quedó reparada:**

| Outlet | Día 1 | **Acumulado** |
|---|---|---|
| latercera | 18 | **40** |
| lacuarta | 7 | **11** |
| exante | 0 | **4** |
| biobiochile | 0 | **2** |
| cooperativa | 0 | **1** |

El premortem (B1) advertía que el estrato P sería *"un censo de latercera+lacuarta, no de la prensa
chilena"*. Con el día 2 **los cinco medios aportan**. Sigue siendo un censo pequeño y sesgado hacia
latercera (69 %), y eso debe declararse en el reporte de 135 — pero ya no es un censo de dos.

---

## ✅ RESUELTO — la estampa de versión del pre-filtro baja de bloqueante a higiene

**La pregunta:** las 25 filas del día 1 se filtraron con el pre-filtro **con el bug**
(`.replace(/\S*$/,"")` incondicional, que arrancaba la última palabra de toda descripción corta).
¿Son comparables con las re-derivadas desde R2 con el filtro arreglado?

**Se midió, no se supuso.** Replay del día 1 desde R2 con el filtro **arreglado**, en `--dry-run`
(cero escritura a Supabase) y **sin red** — el crudo de R2 es la única fuente:

| Feed (día 1, replay con filtro arreglado) | vistos | descartados | **cargados** | Día 1 real (con bug) |
|---|---|---|---|---|
| rss-biobiochile | 20 | 20 | **0** | 0 |
| rss-cooperativa | 15 | 15 | **0** | 0 |
| rss-exante | 10 | 10 | **0** | 0 |
| rss-lacuarta | 100 | 93 | **7** | 7 |
| rss-latercera | 100 | 82 | **18** | 18 |
| **total** | 245 | 220 | **25** | **25** |

**Cero diferencia — 25 = 25, y por outlet también.** Conclusiones:

1. **El bug no afectó a ningún veredicto del día 1.** Las 25 filas de PROD son indistinguibles de las
   que produce el filtro corregido, no por falta de trazabilidad sino **porque son las mismas**. El
   golden puede usarlas sin salvedad.
2. **La estampa de versión deja de ser condición para etiquetar.** Sigue siendo buena higiene para el
   futuro (hoy `carga-run.ts` escribe `causa: "prefiltro_lexico"` a secas), pero **no bloquea 133-b**.
   Queda como deuda menor, con esta medición como respaldo.
3. **Los 3 outlets nuevos del día 2 son contenido real, no un artefacto del fix** — con el filtro
   arreglado seguían dando 0 en el día 1.

Esto es además la primera validación end-to-end del régimen de dos etapas: se re-derivó un día
entero **desde R2, sin volver a tocar la fuente**.

---

## ⏳ ABIERTO — no se ha visto un run verde de CI, y no depende del repo

- El push llegó (`origin/master` == local, 282 commits incluidos los de 133-a).
- **`ci.yml` NO generó run**, pese a tener `on: push: branches: [master]` y estar `active`. Su última
  corrida es del **2026-07-30**.
- CodeQL quedó **encolado >6 min** sin arrancar.
- `ci.yml` **no tiene `workflow_dispatch`**, así que no se puede forzar desde la CLI.

Apunta a la cola/límites de GitHub Actions, no al repo. **Sigue pendiente confirmar el primer run
verde del step de `@obs/news`.**

**Mitigación aplicada al riesgo concreto** (que era case-sensitivity en Linux: G1/G2 caminan el
filesystem y una verificación local en Windows no la caza): los 5 caminos que ambos guards tienen
hardcodeados se compararon **contra el índice de git** —que es lo que produce un checkout en Linux—
y los 5 coinciden exacto: `app/lib/terminos-insinuacion.ts`, `app/lib/anti-insinuacion-guard.test.ts`,
`app/lib/idioms-panel.ts`, `app/app/buscar/page.tsx`, `pnpm-workspace.yaml`. No sustituye el run,
pero desactiva la causa esperada.

---

## 🟡 SEPARADO — el cron `actualidad-refresh` lleva todo el día fallando

No es de 133 y no bloquea 133-b, pero es **producción rota hoy**: tres fallos consecutivos
(13:00, 16:09, 18:35 del 2026-08-06); los dos últimos colgaron **15 minutos** antes de morir.

**Causa raíz:** el endpoint REST de Supabase devuelve **Cloudflare Error 522** (*"el request conectó
con el servidor pero no terminó"*). El Postgres directo **sí responde** (se consultó `noticia` sin
problemas durante toda esta sesión), así que el problema está en el gateway REST, no en la base.

Los runs del 2026-08-05 pasaban en <1 min. Merece diagnóstico propio.

---

## Para retomar 133-b (desde el 2026-08-07)

1. **Correr el conector cada día hábil, a mano**, hasta que exista la Phase 136. Sin eso no hay
   ventana. Día 3 = 2026-08-07.
2. Con 3 días, construir el golden: censo de P + 50 `N-alea` (semilla fija) + 30 `N-sonda` +
   `P-dirigido` hasta n≥25 en `tramitacion_legislativa` y `actividad_parlamentaria`. **Piso 100.**
3. **Antes de etiquetar:** correr el chequeo de cobertura de `prefiltro.terminos` (D-133-F2.2). Si
   <95 %, el límite sube **antes** de etiquetar un solo caso.
4. **Compromisos del operador, indelegables:** 20 casos etiquetados **a ciegas** antes de ver
   cualquier etiqueta de máquina, y la sesión de arbitraje (≤25). Si los hiciera una máquina,
   κ(humano↔máquina) sería κ(máquina↔máquina) — el falso verde exacto que D-133-C2 existe para
   evitar.
5. Anotadores de **modelos distintos**. Cierre con **segunda firma**, con κ, n por clase e IC a la
   vista.
