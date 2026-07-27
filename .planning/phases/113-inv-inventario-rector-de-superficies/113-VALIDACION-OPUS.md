---
fase: 113
artefacto: 113-INVENTARIO.md
commit_juzgado: 65476e5
validador: Opus (contexto fresco, independiente)
ronda: 1
rondas_registradas: [1, 2]
fecha: 2026-07-27
veredicto: PASS
---

# 113 — Validación Opus del gate de cierre

Juicio independiente del artefacto rector `113-INVENTARIO.md` (1.915 líneas) contra los 7
criterios de aceptación de `113-VALIDATION.md` §"Criterios de aceptación del validador Opus".
Método: verificación empírica (filesystem + grep contra el árbol real), **cero** consulta a DB,
**cero** edición del artefacto ni del código.

## Tabla criterio por criterio

| # | Criterio | Veredicto | Evidencia (comando → resultado) |
|---|----------|-----------|----------------------------------|
| 1 | **Rutas**: las 15 de `find`; `/admin/revisar-entidades` EXCLUIDA con razón; `/cuenta` y `/notificaciones/*` marcadas por naturaleza; las 4 `not-found.tsx` apendizadas | **PASS** | `find app/app -name page.tsx \| sort` → **15**, uno a uno presentes en §4.1-4.15 y en la Tabla D de §0.4. `find app/app -name not-found.tsx` → **4**, todas apendizadas (§4.1.b, §4.2.b, §4.3.b, §4.9.b). `find app/app -name route.ts \| wc -l` → **0** (cierre por vacío, §0.2, correcto). §4.15 EXCLUIDA con razón LOCKED + mitigación T-113-04, y **listada** para que el denominador cierre. §4.12 marcada "auth (OTP)", §4.13/§4.14 "token-based + noindex, sin token inventado". `STRICT=1 bash check-inventario.sh` → **exit 0**, checks 1 y 2 OK |
| 2 | **Links internos**: toda plantilla `href="/..."` del catálogo aparece en ≥1 ruta; chrome inventariado una vez y referenciado | **PASS** | Recorrido E-001…E-050 contra §4: cada emisor con hrefs tiene fila en alguna Tabla A (p. ej. E-045→§4.2 A5, E-012→§4.8 A1, E-007→§4.5 A5/A6, E-022→§4.1 A4/A5, E-011→§4.9 A1/A2, E-023/047/049/050→las 4 `not-found`). Los 4 emisores sin ruta están **declarados con causa**: E-003/E-008 huérfanos (§3.0.1, verificado: `grep -rn "VotoFichaRow\|ActualidadModule"` non-test → solo tipos en `app/lib/types.ts` y comentarios, **cero call-sites**), E-037 primitiva `asChild`, E-029/E-026 con nota de import en §4.1. Chrome en §2 (`C-01`..`C-04`) con regla explícita de no-repetición; §4 lo referencia por id en las 15 rutas. Verificado `layout.tsx:58,70-71,83` y `header-nav.tsx:36-42,61-63` verbatim |
| 3 | **Links externos**: 4 builders con plantilla verbatim; toda familia URL-desde-columna con su columna; `safeExternalHref` como chokepoint; clasificación por fuente completa | **PASS** | §3.2 cita los 4 con plantilla verbatim; contrastado contra el código: `buildSenadoUrl` (`validacion-fuente.tsx:60-62`), `buildCamaraUrl` (`:67-69`, firma `(boletin, prmId)` y orden `prmID`/`prmBOLETIN` **coinciden**), `enlaceHumanoProyecto` (`:87`), `partidoLegible` (`app/lib/format.ts:153`) — los 4 byte-consistentes. §3.3.1 descubre **34 columnas / 33 tablas** por catálogo (con el hallazgo correcto de que `data_type like '%char%'` daba 0 filas), §3.3.2 da host+conteo por columna, §3.3.3 mapea cada familia a su emisor y §3.3.5 declara las 10 columnas con 0 filas. §3.1.3 reproduce `safeExternalHref` verbatim — verificado idéntico contra `app/lib/utils.ts:15-23`. Las 4 clases del ROADMAP (camara/senado/BCN/leylobby) resueltas con host+conteo en §3.3.4. `grep -rl "sourceUrl=" app/components app/app \| wc -l` → **16**, exactamente el denominador que §3.1.4 declara y reconcilia (15 producción + 1 test) |
| 4 | **Fechas**: formatter + origen por fecha; `capturedAt`/`ProvenanceBadge` MARCADAS como `fecha_captura`; nombres de RPC/tabla dentro de las listas cerradas | **PASS** | Toda fila de Tabla C lleva las 8 columnas fijas incluyendo *formatter*, *origen*, *¿es fecha_captura?* y *¿vía ProvenanceBadge?*; cero celdas vacías (ver crit. 6). La regla LOCKED de §3.1.1 ("toda fecha por `capturedAt` se marca `fecha_captura` sin más análisis") se cumple en cada ruta y se **audita** con el bloque "Correspondencia badge ↔ tablas" (§4.1, §4.2, §4.3, §4.5, §4.6): cero badges solo-C. `grep -rn ".rpc("` non-test → **44** call-sites y `grep .from(` → **18** tablas: coinciden con §0.2; los 7+3 nombres fuera de esa lista están **ampliados con evidencia archivo:línea** en §3. Muestreo de nombres citados: `parlamentario_publico_v2`, `coincidencia_votos_par`, `actualidad_senales_panel`, `agregado_por_contraparte`, `subgrafo_red`, `cruces_de_proyecto`, `buscar_citaciones`, `militancias_de_parlamentario`, `buscar_proyectos_hibrido`, `lobby_menciones_de_boletin` → **los 10 existen** en el código. Muestreo de líneas: `buscar/page.tsx:160` (comentario T-88-10 verbatim), `comparar/page.tsx:524-525` (`fecha_captura_max`), `provenance-badge.tsx:21,25,33,37,52,62` → **todas exactas** |
| 5 | **Sujetos**: 5 con query verbatim + resultado inline + URL PROD + `ORDER BY` con desempate; ancla temporal y deploy; PK bio string | **PASS** | §1.1-§1.5: los 5 sujetos (A `D1165`, B `S1338`, C `14309-04`, D `17870-05`, E no-elegible) llevan query SQL verbatim, resultado **inline** en comentario, URL PROD y `ORDER BY` con desempate estable por PK (`id asc`, `p.boletin asc`, `contraparte_id asc`) ⇒ determinismo. Ancla temporal `select now()::date → 2026-07-27` y deploy observado (§5, `2026-07-27 23:04 UTC`, honesto sobre que Cloudflare no expone versión en headers). §1.2 declara explícitamente la PK bio en **formato string** (`S1338`, jamás `1338` numérico, gotcha 105-02). Sujeto E es **degradación honesta** (`contrato`/`aporte` con 0 filas + gate MONEY) y **no inventa** id. `check-inventario.sh` check 4 → 8 bloques SQL ≥ 5 |
| 6 | **Cobertura**: tabla método×ruta sin celdas vacías; límite "links externos desde columnas" declarado; cero rutas sin evidencia | **PASS** | Tabla D (§0.4): **19 filas de datos** (15 rutas + 4 `not-found`), vocabulario CERRADO de 3 valores para las columnas de método, columna *sujeto usado* y *¿exhaustivo o muestra?* pobladas en todas. Guard acotado a filas de tabla `grep -nE '^\|.*\|[[:space:]]*\|'` menos separadoras → **0 matches** en todo el documento. Los **3 límites** están declarados en §0.4.1: LÍMITE 1 (externos desde columna se enumeran por familia de host, no por plantilla; conteos re-corribles por 115), LÍMITE 2 (sin verificación contra DOM — es 114/125), LÍMITE 3 (bloques gate-OFF inventariados pero `no emitido en el deploy auditado`). Cero rutas sin evidencia: cada fila cita §, archivo y líneas |
| 7 | **Régimen**: no corrige nada; `fecha_captura` jamás presentada como el hecho; ninguna URL de conexión impresa | **PASS** | `git status --porcelain app/ packages/` → vacío (declarado en §0.7 y consistente con que la fase es documental); el documento repite el régimen en §0.1, §4.5, §4.6 y en el cierre ("registra, no corrige"; los candidatos #1 y #2 de 115 quedan **anotados sin arreglar**). `fecha_captura` nunca se presenta como el hecho: §4.2 lo separa explícitamente (C2/C8/C20/C21 = relojes de scraping vs. C3-C7/C9-C10 = el hecho), §4.6 C1 documenta la prohibición T-88-10, §4.7 C3 respeta el veto de vocabulario ("según fuente al", no "captura" pelado). `grep -cE 'postgres(ql)?://'` → **0** (cero credenciales/URL de conexión). `grep -nE '[0-9]{7,8}-[0-9kK]'` → **sin match** (exit 1): cero RUT. Un solo email, el buzón institucional del footer. §3.3 registra solo `split_part(col,'/',3)` + `count(*)`, jamás una URL de fila |

**Ejecuciones de gate reproducidas por el validador:**

```
STRICT=1 bash check-inventario.sh   → exit 0 (checks 1-5 OK)
grep -cE 'postgres(ql)?://' 113-INVENTARIO.md          → 0
grep -nE '[0-9]{7,8}-[0-9kK]' 113-INVENTARIO.md        → sin match (exit 1)
grep -E '^\|.*\|[[:space:]]*\|' (menos separadoras)    → 0
ids E-NNN: 60 definiciones / 60 únicos
```

## Hallazgos

Ningún FAIL. Dos observaciones **no bloqueantes** de precisión de evidencia (misma clase que el
límite H3 ya aceptado por el orquestador: la afirmación sustantiva es correcta, lo impreciso es el
comando citado). Se registran para que 114/116 no tropiecen; **no** exigen ronda 2.

1. **§4.8 — el `grep` citado no da "sin match" literal.** El documento escribe
   `grep -n "ProvenanceBadge" app/app/parlamentarios/page.tsx app/components/parlamentario-directory-row.tsx app/components/partido-chip.tsx` → *sin match*. Re-corrido:
   `app/components/partido-chip.tsx:27` **sí** matchea — pero es un **comentario**
   (*"(idiom ProvenanceBadge) para no saturar la fila de chips"*), no un render; no hay import ni
   JSX del badge. La conclusión sustantiva del inventario (cero `sourceUrl`, cero links externos,
   procedencia por `title`/`aria-label`) queda **confirmada**. Cierre opcional en cualquier fase
   futura: acotar el comando citado (`grep -n "<ProvenanceBadge"`) o anotar el falso positivo,
   igual que se hizo con H3.

2. **§4.3.c contiene texto obsoleto tras el cierre de H2.** La "Excepción declarada" afirma que §5
   *"conserva verbatim […] un id de sonda sintético (RUT de empresa con ceros)"* y que es *"el único
   match del patrón de RUT en todo el archivo"*. Tras la corrección documentada en §0.7, §5 usa
   `c:sujeto-inexistente` y el patrón de RUT tiene **cero** matches (verificado). Es una
   contradicción interna **cosmética y en el sentido seguro** (el documento se declara menos limpio
   de lo que está); no afecta a ningún consumidor. Cierre: reescribir esas 6 líneas cuando se toque
   el archivo por otra razón.

**Fortalezas que sostienen el PASS** (relevantes para los consumidores 114/115/116/122/125):

- El **límite rector** de §0.3/§0.4.1 (los hrefs externos viven mayoritariamente en columnas, no en
  TSX) está descubierto **por catálogo** y no por lista adivinada — y el propio documento demuestra
  que el patrón de nombres del research habría encontrado **cero** columnas. Sin esto, 115 habría
  trabajado sobre un universo falso.
- La regla de **badge DUAL** convierte una omisión fácil (badge inventariado solo como fecha) en un
  defecto detectable, y cada ruta trae su propio bloque de reconciliación.
- Los **hallazgos entregados sin corregir** son accionables y trazables: candidato #1 de 115
  (`tramitacion_evento.enlace`, 982 filas sin `enlaceHumanoProyecto`), candidato #2 (`/buscar` pasa
  `proyecto.enlace` crudo al badge, 3.658 URLs a XML), emisores huérfanos (13 hrefs que 114/125 no
  deben perseguir) y las columnas presentes-en-DB-no-emitidas-al-DOM (`lobby_contraparte.enlace`
  17.681, `source_snapshot.source_url` 4.383).
- **Degradación honesta** en los tres puntos donde era tentador inventar: sujeto E (no se inventó
  contraparte), `/notificaciones/*` (no se inventó token), `/contraparte/[id]` (404 declarado, no
  disfrazado).

## Veredicto

**PASS.** El inventario cierra su denominador (19/19 superficies), es re-ejecutable (todo comando
verbatim, todo `ORDER BY` determinista), respeta el régimen de no-corrección y las compuertas de
PII/secretos, y es **mecánicamente consumible** por 114, 115, 116, 122 y 125 mediante los ids
`E-NNN` / `C-0N` y las tablas A/B/C por ruta. Los dos hallazgos son imprecisiones de comando citado,
no brechas de inventario.

---

## Ronda 2 — cierre de hallazgos y re-verificación mecánica (2026-07-27)

> **Naturaleza de esta ronda — declarada sin adorno.** La ronda 1 dio **PASS en los 7 criterios** y
> su propio texto dice que los 2 hallazgos **"no exigen ronda 2"**. Por lo tanto esta ronda 2 **NO
> es un segundo juicio Opus independiente**: es la **re-verificación mecánica** ejecutada por el
> **ejecutor del Plan 05** (parte, no juez) tras cerrar los 2 hallazgos cosméticos. Se registra por
> trazabilidad, no como veredicto nuevo. El único veredicto de calidad sobre este inventario es el
> de la ronda 1, emitido por el juez independiente sobre el commit `65476e5`.

**Disposición de los 2 hallazgos** — ambos **cerrados en el inventario** (ninguno diferido):

| # | Hallazgo (ronda 1) | Disposición | Cierre |
|---|--------------------|-------------|--------|
| 1 | §4.8: el `grep` citado no da "sin match" literal (`partido-chip.tsx:27` matchea, es comentario) | **cerrado en el inventario** | §4.8 declara ahora el **1 match-comentario** con su cita verbatim y añade el comando que separa mención de uso: `grep -n "import.*ProvenanceBadge\|<ProvenanceBadge"` → **sin match**. Se corrigió el comando, **no** la conclusión (cero badge renderizado sigue en pie) |
| 2 | §4.3.c obsoleta: declaraba una "excepción" de RUT que ya no existe | **cerrado en el inventario** | La nota se reescribió al estado actual: **no hay excepción**; `grep -cE '[0-9]{7,8}-[0-9kK]'` → **0** en todo el archivo |

**Re-verificación mecánica post-cierre** (mismas compuertas que la ronda 1 verificó):

```
STRICT=1 bash check-inventario.sh                      → exit 0 (5/5 OK)
grep -cE '[0-9]{7,8}-[0-9kK]'  (RUT)                   → 0
grep -cE 'postgres(ql)?://'                            → 0
grep -E '^\|.*\|[[:space:]]*\|' (menos separadoras)    → 0
ids E-NNN: 60 definiciones / 60 únicos                 → 0 duplicados
git status --porcelain app/ packages/                  → vacío
```

Las dos remediaciones son **documentales y en el sentido seguro** (precisan un comando citado y
retiran una excepción ya inexistente): no introducen afirmaciones nuevas sobre el código ni reabren
ninguno de los 7 criterios. Cada afirmación nueva de §4.8 fue verificada contra el repo antes de
commitear.

**Estado final del artefacto:** `113-INVENTARIO.md` queda con `estado: validado` en su front-matter
— 7/7 criterios PASS, **cero** hallazgos abiertos, **cero** límites diferidos a otra fase.
