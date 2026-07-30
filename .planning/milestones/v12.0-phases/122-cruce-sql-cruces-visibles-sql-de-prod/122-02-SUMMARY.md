---
phase: 122
plan: 02
subsystem: auditoria-cruces
tags: [cruces, sql, prod, relaciones, comparar, vsim, conteos]
requires: ["122-CRUCES-SQL-00-METODO.md", "113-INVENTARIO.md"]
provides: ["122-CRUCES-SQL-01-RELACIONES-COMPARAR.md"]
affects: ["122-04", "122-05", "122-06", "125"]
key-files:
  created:
    - .planning/phases/122-cruce-sql-cruces-visibles-sql-de-prod/122-CRUCES-SQL-01-RELACIONES-COMPARAR.md
  modified: []
decisions:
  - "Lead VSIM 3655/3672 '(100%)' ADJUDICADO como cuadra: Math.round(99,537)=100 es la cifra firmada del dossier VSIM §43, ya adjudicada por 104-03 — no se cambia round a floor/decimal"
  - "El cap p_limit:1000 (D1165: 3752 real vs 1000 mostrado) se clasifica discrepancia-declarada, NO corregida: exige un RPC de conteo dedicado (aguja completa) fuera del alcance de 122-05"
  - "El contrato RelacionesSection vacio NO es observable en PROD: cero parlamentarios con los 5 ejes en total_n=0 (query con 0 filas) — se declara como límite, no se fabrica sujeto"
  - "ResumenView (E-029) no tiene call-site: sus números no llegan a ningún DOM; los chips los emite el rail desde la misma lib de conteos"
metrics:
  tasks: 2
  commits: 1
  files_created: 1
  filas_veredicto: 32
  completed: 2026-07-29
---

# Phase 122 Plan 02: Relaciones de ficha + `/comparar` × SQL de PROD — Summary

Los grupos 1 y 2 del universo de cruces recalculados por SQL verbatim contra PROD y contrastados
con el DOM del deploy: **32 filas de veredicto (28 `cuadra`, 4 `discrepancia-declarada`, 0
`discrepancia-corregida`)**, 32 bloques ```sql numerados `Q-01`…`Q-32` y 6 greps de deploy
`Q-D1`…`Q-D6`. Los 10 `total_n` de relaciones y los 3 pares VSIM cuadran RPC ↔ primeros principios
↔ DOM; la única discrepancia grande es el cap `p_limit: 1000` de votos, declarada con ambos números.

**Artefacto:** `.planning/phases/122-cruce-sql-cruces-visibles-sql-de-prod/122-CRUCES-SQL-01-RELACIONES-COMPARAR.md`
**Commit:** `24d223a`

## Qué se hizo

**Task 1 — 5 bloques de relaciones + conteos del resumen.** Para `D1165` y `S1338`: se invocó cada
una de las 5 RPCs por psql (`Q-01`…`Q-05`, filas devueltas + `total_n`) **y** la query de primeros
principios contra las tablas base (`Q-06`…`Q-10`), y se leyó el número renderizado del deploy con
patrones tolerantes a los separadores `<!-- -->` de React. Los 4 chips de carril (votos, lobby,
patrimonio, cruces) más la línea de asistencia se recalcularon con doble lectura (RPC con el mismo
`p_limit` que usa el sitio vs tabla base).

**Task 2 — `/comparar` (4 ejes × 2 pares) + VSIM (3 pares).** Par cross-cámara `D1165 × S1338` y par
mismo-cámara `D1117 × D1177` **elegido por SQL** con desempate estable (`Q-24`). VSIM sobre los 3
pares nombrados verbatim por el SUMMARY de 104-03 (`D1165/D1170`, `D1009/D1012`, `D1009/S1110`),
recuperado de git (`git show 8685e43:…104-03-SUMMARY.md`).

## Hallazgos y veredictos

### Lo que cuadra (28 filas)

- **Los 10 ejes de relaciones cuadran los tres lados.** `total_n` de la RPC == primeros principios ==
  DOM, en los 10 casos: `D1165` → 27 / 0 / 24 / 48 / 2; `S1338` → 9 / 4 / 0 / 21 / 2.
- **Ningún bloque de la ficha muestra el `.length` cap-eado.** Los 3 ejes truncados de `D1165`
  (27, 24, 48 con `limit 20`) muestran el `total_n` honesto **y declaran el truncamiento**
  (`Mostrando los primeros 8 de 27/24/48`). Cero `discrepancia-corregida` en §1.
- **Vacío honesto por bloque verificado dos veces**, en ejes independientes: `de_la_misma_zona` de
  `D1165` (grep → 0 matches) y `co_comisionados` de `S1338` (grep → 0 matches), con
  `id="relaciones"` presente en ambas fichas.
- **Los 3 estados de `/comparar` observados**: compartido (`Comparten 2 comisiones`,
  `Comparten 20 proyectos co-firmados`), no compartido con fuente+fecha, y eje indeterminado que
  declara el límite del canal. **Ningún eje emite un `0` pelado.**
- **Los 3 pares VSIM cuadran** RPC ↔ primeros principios ↔ DOM: 3655/3672, 932/2495 y el
  empty-state honesto de 0/0. La leyenda anti-DW-NOMINATE está presente en los 3 (`grep -c` → 1) y
  la provenance del DOM (`2026-07-28`) es exactamente el `fecha_captura_max` de la RPC.

### Las 4 filas `discrepancia-declarada` (2 causas raíz)

**1. Cap `p_limit: 1000` (filas 2.1 / 2.5 / 2.6) — WR-03.** `D1165` tiene **3.752** votos
confirmados en PROD; el deploy muestra **1.000** en el chip del rail, en el `<h2>` del carril y en
`Ver detalle (1000)`.

| magnitud | SQL | deploy |
|----------|----:|-------:|
| votos | **3.752** | **1.000** |
| presentes / total | 3.723 / 3.752 | 973 / 1.000 |
| desglose | si 1764 · no 1772 · abst 171 · pareo 16 · aus 29 | 469 · 466 · 22 · 16 · 27 |
| asistencia | **99,2 %** | **97,3 %** |

**Agravante que el plan no anticipaba:** el cap no solo trunca el total, **distorsiona la
composición** — la RPC ordena `by fecha desc`, así que el desglose mostrado es el de las 1.000
votaciones más recientes presentado como el histórico completo, y es **inestable** (cada ingesta
cambia los 5 números sin mover el 1000).

**2. Co-autoría `D1165 × S1338` indeterminada (fila 3.3).** El SQL determina el hecho (0 boletines
co-firmados); el deploy declara indeterminación porque ambas listas están cap-eadas (48>20, 21>20) y
`interseccionPar` es fail-closed por diseño CR-01. Es la disciplina correcta (una ausencia falsa con
atribución de fuente es el riesgo #1 del proyecto) — se registra pero **no se toca**.

### El lead heredado del fragmento 00, adjudicado

`D1165 × D1170` = **3.655 de 3.672**, mostrado **100 %**, cociente real **99,537 %**.
**Veredicto: `cuadra`.** Mecanismo exacto: `comparar/page.tsx:518` →
`Math.round((n/m)*100)`; `Math.round(99.537) = 100`. **No es floor, ceil ni bug de formato.** Es la
cifra firmada en el dossier legal VSIM (§43 `X = round(N/M·100)`, §83 base-rate 19-100 %), y el
precedente **104-03** ya la adjudicó explícitamente como dossier-compliant. Cambiar `round` sería
desviar de una cifra legalmente firmada (Rule 4) sin ganancia de honestidad — la lectura deshonesta
la neutraliza el caveat base-alta obligatorio y adyacente, verificado presente. Ambos números quedan
escritos en §4.1 del fragmento.

### Denominador de lobby (must-have del plan)

`lobby_de_parlamentario` **NO** filtra `estado_vinculo`. Contrastadas las tres lecturas:
sin predicado = **112**, con `estado_vinculo='confirmado'` = **112**, vía RPC = **112**, DOM = **112**.
Hoy no existe ninguna audiencia no confirmada para estos sujetos ⇒ el denominador es honesto **de
facto, no por el predicado**. Riesgo latente (una ingesta futura lo inflaría en silencio)
**pasado a 122-04**, dueño del Grupo 5.

## Desviaciones del plan (RULE-1 — mandó la realidad)

**1. [RULE-1] `S1338` no es el caso de vacío honesto que el plan asumía.** El plan pedía verificar el
contrato `RelacionesSection vacio` con los 5 ejes de `S1338` en `total_n = 0`. **Realidad:** `S1338`
tiene 4 de 5 ejes con datos (9/4/0/21/2). Se buscó por SQL, deterministamente, cualquier sujeto con
los 5 ejes en 0 (`Q-12`, `order by p.id asc`) → **0 filas**. **Después:** el contrato se declara
**no observable en PROD** (LÍMITE 1 de §5) con la query que lo prueba, en vez de fabricar un sujeto
o de declararlo "verificado". Lo que sí se verificó es el vacío honesto **por bloque**, en dos ejes
independientes.

**2. [RULE-1] El 4º eje de `/comparar` no es "partido vigente", es "Zona electoral".** El plan pedía
auditar *"el eje de partido vigente vía `parlamentarios_publico_v2`"*. En `comparar/page.tsx:446-492`
el 4º eje es **Zona electoral**, y `parlamentarios_publico_v2` es el **roster** del que sale
`circunscripcion`/`distrito` (`zonaDe`, `:659-668`). No existe eje de partido vigente. **Después:**
se auditó el eje que el deploy realmente emite (filas 3.4 y 3.8).

**3. [RULE-1] Ningún par diputado-diputado puede tener datos en los 4 ejes.** El plan pedía "un par
diputado-diputado con datos en los 4 ejes". `Q-11` prueba en agregado que los **155** diputados de
PROD tienen `distrito` **y** `circunscripcion` en NULL (re-confirmación del hallazgo 101-01).
**Después:** el par se eligió maximizando los **3 ejes determinables** (`D1117 × D1177`: 2
comisiones, 20 co-proyectos, militancia histórica compartida) y el eje de zona queda como caso de
ausencia honesta, declarado como LÍMITE 2.

**4. [RULE-1] El emisor E-029 (`ResumenView`) no emite DOM.** El plan lo trataba como el emisor de
los chips above-the-fold. `grep -rn "ResumenView\|ParlamentarioResumen"` fuera de su propio archivo
y de los tests → **sin resultados**; `page.tsx:7-10` importa solo `construirChips` + el tipo; y
`grep -c 'aria-label="Secciones de la ficha"'` → **0** en ambas fichas. Es el **mismo patrón de
emisor huérfano** de E-003/E-008 (§0.4 del fragmento 00). **Después:** §2.0 declara el hallazgo,
tabula los **emisores reales** (rail, `CarrilHeader`, `DetalleColapsable`, `votos-por-parlamentario`,
`votos-capa1`) y audita los conteos ahí. La superficie no se borra del denominador: se declara.

**5. [RULE-1] "Presente en N de M" no lo emite el resumen.** El plan lo ubicaba en el resumen; lo
emite `votos-por-parlamentario.tsx:717-728`, y **solo cuando `ausentes > 0`**. Por eso `S1338`
(0 ausentes) emite legítimamente `Emitió 949 votos registrados.` en vez del chip de asistencia —
verificado por SQL (`Q-22`: `S1338` no tiene ninguna fila `ausente`). Registrado como fila 2.11
`cuadra`, no como asistencia faltante.

**6. [Desviación de proceso, no de contenido] Un solo commit para las 2 tareas.** Ambas tareas
escriben el **mismo** archivo (así lo declara `files_modified` del plan). Un commit por tarea habría
dejado un commit intermedio con §3–§5 ausentes. Se hizo **un commit** (`24d223a`) cuyo mensaje
enumera explícitamente Task 1 y Task 2. Mismo criterio que 122-01.

## Nota de método (orden de trabajo)

Se respetó el orden exigido por el contexto de ejecución: **primero se ejecutó la query, después se
escribió el número observado**. El artefacto se escribió de una sola vez, al final, con todas las
salidas de `psql` y `curl` ya capturadas. Ninguna cifra se redactó "para confirmarla luego". Los dos
sujetos, los 5 gates y los 3 pares VSIM se tomaron de artefactos previos (fragmento 00, SUMMARY de
104-03) pero **cada número se re-observó hoy** contra PROD y contra el deploy.

## Qué queda para 122-05

**NADA.** Este fragmento produjo **cero** filas `discrepancia-corregida`. Las 4 filas divergentes
son todas `discrepancia-declarada` y ninguna cabe en el alcance de 122-05:

| fila(s) | divergencia | por qué NO entra a 122-05 | a dónde va |
|---------|-------------|---------------------------|------------|
| 2.1 / 2.5 / 2.6 | cap `p_limit: 1000` — 3.752 real vs 1.000 mostrado (+ asistencia y desglose derivados) | exige un **RPC de conteo dedicado** (aguja completa: cero-grant `>0044`, secdef PII-safe con `search_path`, `PUBLIC_RPC_ALLOWLIST`, bounded) **y** el cambio simultáneo de 5 superficies (chip del rail, `<h2>` del carril, `Ver detalle`, asistencia, capa-1) para no desincronizarlas | decisión de milestone / diseño de RPC (123-124) |
| 3.3 | co-autoría `D1165×S1338`: SQL determina 0 compartidos, el deploy declara indeterminación | disciplina **fail-closed CR-01** deliberada; el fix exige rediseñar la RPC para emitir membresía de par | diseño de RPC, fuera de alcance |
| — | denominador de lobby sin predicado `estado_vinculo` en la RPC (hoy inocuo: 112 = 112) | no es discrepancia observable | **122-04** (Grupo 5) |
| — | lead VSIM `(100%)` | **adjudicado `cuadra`**: cifra firmada del dossier §43 | cerrado |

**Para 122-06 (consolidación):** el fragmento tiene §1–§7 completas, 32 filas de veredicto, 32
bloques ```sql (`Q-01`…`Q-32`) y 6 greps de deploy (`Q-D1`…`Q-D6`). **Ningún `cuadra` queda sin
bloque ```sql asociado** (regla dura anti-"todo bien" de §0.1).

## Seguridad del artefacto

- `grep -c "postgres://\|postgresql://"` → **0**. `SUPABASE_DB_URL` aparece 3 veces y **solo como
  nombre de variable**, nunca expandido ni ecoado.
- `grep -c -i -E "\brut\b|[a-z0-9._-]+@[a-z0-9.-]+\."` → **0**. Todas las queries son `count(*)` /
  agregados o proyectan columnas ya expuestas por RPC pública (id/nombre/cámara/zona). Cero `select
  rut`, cero email, cero monto individual.
- **Cero DDL/DML**: todas las sentencias son `select`. Cero `supabase db push`, cero deploy, cero
  flag `*_PUBLIC_ENABLED` tocado, cero fix de código.
- **Cero requests a fuentes gubernamentales** (camara.cl / senado.cl / BCN / leylobby): solo `psql`
  contra PROD y 7 `curl` al Worker propio.

## Self-Check: PASSED

```bash
# el artefacto existe y tiene las 7 secciones
grep -c -E '^## [0-9]\.' 122-CRUCES-SQL-01-RELACIONES-COMPARAR.md              # → 8 (§0–§7)

# verify automatizado del plan, Task 1
grep -c "| cuadra \|| discrepancia-corregida \|| discrepancia-declarada " \
  122-CRUCES-SQL-01-RELACIONES-COMPARAR.md                                     # → 36  (≥1 ✓)

# verify automatizado del plan, Task 2
grep -q "## 4. VSIM" 122-CRUCES-SQL-01-RELACIONES-COMPARAR.md \
  && grep -c "coincidencia_votos_par" 122-CRUCES-SQL-01-RELACIONES-COMPARAR.md # → 5 ✓

# filas de veredicto numeradas y su reparto
grep -E '^\| [0-9]+\.[0-9]+ \|' 122-CRUCES-SQL-01-RELACIONES-COMPARAR.md \
  | grep -o -E '\| (cuadra|discrepancia-corregida|discrepancia-declarada)[^|]*\|$' \
  | sort | uniq -c
# → 27 "| cuadra |" + 1 "| cuadra (ver §4.1) |"                = 28
# → 1 "(WR-03)" + 2 "(hereda 2.1)" + 1 "(fail-closed CR-01 …)" = 4     ⇒ 32 filas

# bloques sql numerados e identificadores Q-NN
grep -c '^```sql' 122-CRUCES-SQL-01-RELACIONES-COMPARAR.md                     # → 30 bloques
grep -c -E '^\*\*`Q-' 122-CRUCES-SQL-01-RELACIONES-COMPARAR.md                 # → 36 ids Q-NN/Q-DN

# criterios de aceptación por sección
#   §1 ≥10 filas de veredicto  → 10 ✓ (5 ejes × 2 sujetos)
#   §2 ≥9 filas                → 11 ✓ (4 carriles × 2 sujetos + asistencia × 2 + capa-1)
#   §3 ≥8 filas                →  8 ✓ (4 ejes × 2 pares)
#   §4 exactamente 3 pares     →  3 ✓ (+ 1 par bonus, declarado como tal en §4.3)
#   §5 existe                  → ✓ (5 límites declarados con evidencia)

# aislamiento
git show --stat --oneline 24d223a | tail -2
# → .../122-CRUCES-SQL-01-RELACIONES-COMPARAR.md | 1018 ++++
# → 1 file changed, 1018 insertions(+)
# Cero archivos de app/ o supabase/ tocados; cero archivos de los executors 122-03/122-04.
```
