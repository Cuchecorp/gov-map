---
phase: 122
plan: 01
subsystem: auditoria-cruces
tags: [cruces, sql, prod, metodo, inventario]
requires: ["113-INVENTARIO.md", "122-CONTEXT.md"]
provides: ["122-CRUCES-SQL-00-METODO.md"]
affects: ["122-02", "122-03", "122-04", "122-05", "122-06", "125"]
key-files:
  created:
    - .planning/phases/122-cruce-sql-cruces-visibles-sql-de-prod/122-CRUCES-SQL-00-METODO.md
  modified: []
decisions:
  - "Ancla temporal de la fase 122 = 2026-07-29 (select now()::date contra PROD, TimeZone UTC)"
  - "Los 3 sujetos deterministas se re-verificaron idénticos a 113: cero deriva, cero cambio de sujeto"
  - "El par VSIM de trabajo para 122-02 es D1165 × D1170 (mismo-cámara); D1165 × S1338 queda como caso de empty-state"
metrics:
  tasks: 2
  commits: 1
  files_created: 1
  completed: 2026-07-29
---

# Phase 122 Plan 01: Método y universo de cruces — Summary

Fragmento rector de la Phase 122: fija método re-ejecutable, vocabulario de veredicto de 3 valores,
plantilla de tabla y el universo cerrado de 6 grupos de cruces trazado al catálogo de emisores de
113 — con los 3 sujetos deterministas y los 5 gates re-verificados contra PROD y contra el deploy.

## Qué se hizo

**Task 1 — método, régimen y universo cerrado.** Se creó
`122-CRUCES-SQL-00-METODO.md` con §0 (régimen: psql read-only, prohibición de imprimir el valor de
`SUPABASE_DB_URL`, `-tA` no REST, cero PII, cero fuentes gubernamentales, lectura del deploy por
`curl`), §0.1 (vocabulario `cuadra` / `discrepancia-corregida` / `discrepancia-declarada` + la regla
dura anti-"todo bien"), §0.2 (plantilla de fila de 8 columnas, con las queries fuera de la celda vía
identificador `Q-NN`), §0.3 (los 6 grupos con su plan asignado), §0.4 (emisor huérfano E-008
verbatim) y §0.5 (los 3 límites: nº deploy es PRE-fix, gated OFF fuera del denominador pero
declarado, cero fabricación).

**Task 2 — sujetos y gates re-verificados.** Se re-ejecutaron **verbatim** las 3 queries de
selección de 113 §1.1/§1.2/§1.3 contra PROD y se leyó el DOM del deploy por `curl`.

## Evidencia clave

**Ancla temporal** — `select now()::date, current_setting('TimeZone')` → `2026-07-29|UTC`.

**Sujetos deterministas — cero deriva.** Las 3 queries re-eligen los mismos ids con los mismos
conteos que el 2026-07-27:

| sujeto | salida observada 2026-07-29 | vs. 113 |
|--------|-----------------------------|---------|
| `D1165` | `D1165\|3752\|112\|6\|11\|2\|2\|6` (votos\|lobby\|patrimonio\|cruces\|comisiones\|militancias\|bloques) | **idéntico** |
| `S1338` | `S1338\|949\|0\|9\|0\|0\|1\|3` | **idéntico** |
| `14309-04` | `14309-04\|7\|1\|47\|t` (votaciones\|embedding\|cruces\|tiene_camara) | **idéntico** |

La regla de estabilidad (no cambiar de sujeto ante deriva) no tuvo que aplicarse.

**Gates observados** — coinciden con el CONTEXT y con 113; **ningún flag fue tocado**:

| gate | observado | evidencia |
|------|-----------|-----------|
| CRUCES | **ON** | `id="cruces"` presente en el DOM de `/parlamentario/D1165` |
| VSIM | **ON** | `/comparar?a=D1165&b=D1170` emite `Coinciden en …3655… de …3672… votaciones compartidas (…100…%)` |
| NET | **ON** | `/red?seed=D1165` → HTTP **200** |
| MONEY | **OFF** | `/contraparte/1` → HTTP **404**; sin `id="dinero"` ni `id="financiamiento"` en la ficha |
| NOTIF | **OFF** (ruta viva, inerte) | `/cuenta` → HTTP **200** pero el DOM emite `no están disponible` |

**Seguridad del artefacto:** cero cadenas `postgres://`/`postgresql://`, cero RUT, cero email.
`SUPABASE_DB_URL` aparece 3 veces y **solo como nombre de variable**. `git diff --stat` = 1 archivo,
438 inserciones; cero archivos de `app/` o `supabase/` tocados. Cero DDL/DML: todas las queries son
`select`.

## Desviaciones del plan (RULE-1 — mandó la realidad)

**1. [RULE-1] El comando VSIM que proponía el plan devuelve `0`, y `0` NO significa gate OFF.**
- **Antes (plan, Task 2):** `curl -s "…/comparar?a=D1165&b=S1338" | grep -c "Coinciden en"` como
  prueba del gate VSIM.
- **Realidad:** `D1165` es **diputado** y `S1338` **senador** ⇒ no comparten ninguna votación. El eje
  *sí* se renderiza (VSIM ON) pero en su **empty-state honesto** (`…votaciones compartidas
  suficientes en las fuentes consultadas al…`), así que el literal no aparece y el `grep -c` da `0`.
  Tomado al pie de la letra, el plan habría registrado **VSIM OFF**, que es falso.
- **Después:** se añadió un comando complementario con par **mismo-cámara** `D1165 × D1170` (los dos
  diputados con más votos: 3.773 y 3.752), que sí emite el número. Ambos comandos quedan en §2.1 y
  el porqué en §2.3 (HALLAZGO A). El par cross-cámara se conserva, pero reclasificado como caso de
  **empty-state**, no de número.

**2. [RULE-1] El grep del literal completo nunca matchea: React intercala `<!-- -->`.**
- **Realidad observada:** el DOM real es
  `Coinciden en <!-- -->3655<!-- --> de <!-- -->3672<!-- --> votaciones compartidas (<!-- -->100<!-- -->%).`
  Un grep del literal armado (`"Coinciden en 3655 de 3672…"`) devuelve **0 matches** y se leería,
  falsamente, como "el sitio no emite el número".
- **Después:** §2.3 (HALLAZGO B) obliga a los fragmentos 01/02/03 a extraer el "nº deploy" con un
  patrón tolerante a separadores (`grep -o -E ".{40}Coinciden en.{160}"`), jamás con el literal.

**3. [RULE-1] Referencia de líneas corregida.** El plan citaba
`app/app/parlamentario/[id]/page.tsx:197-206` para los 5 readers de relaciones. En el archivo real
los 5 `crossLinkReader(...)` están en **`:198-206`** (`:197` es una línea en blanco; el lector
genérico se define en `:190-195`). El fragmento registra `:198-206` y además el rango del lector.

**4. [Desviación de proceso, no de contenido] Un solo commit para las 2 tareas.** Ambas tareas
escriben el **mismo** archivo y el plan lo declara así en su `files_modified`. Un commit por tarea
habría dejado un commit intermedio con §1/§2 sin datos. Se hizo **un commit** (`8b47d41`) cuyo
mensaje enumera explícitamente Task 1 y Task 2.

## Nota de honestidad sobre el orden de trabajo

El borrador de §1/§2 se redactó tomando los valores de 113 **antes** de ejecutar las queries, y
**después** se ejecutaron las 3 queries y los `curl` para confirmarlos. Los valores coincidieron, de
modo que el archivo committeado contiene solo números observados. Se deja constancia porque el
método correcto es ejecutar primero: si hubieran diferido, el riesgo era publicar cifras heredadas.
Ninguna cifra del artefacto quedó sin verificación de PROD/deploy.

## Lo que queda para los planes 02/03/04

- **122-02** — Grupo 1 (5 bloques de relaciones vía `cross-links-parlamentario.tsx` E-022 + conteos
  de `app/lib/parlamentario-resumen-conteos.ts`, dependencia de E-029) y Grupo 2 (`/comparar`: 4 ejes
  E-051 + VSIM en §4.7 C3/C4). **Usar el par `D1165 × D1170`** para el literal.
  **Lead sin adjudicar:** ese par emite **3.655 de 3.672** con un porcentaje mostrado de **100 %**,
  cuando el cociente real es **99,5 %** — 122-02 debe recalcularlo contra `RPC:coincidencia_votos_par`
  y emitir veredicto. Este fragmento deliberadamente **no** lo adjudicó.
- **122-03** — Grupo 3 (cruces de ficha/proyecto: E-044, E-053, `cruce_senal`, migraciones 0047–0050;
  línea base `14309-04` → **47** cruces) y Grupo 4 (panel de actualidad, E-055,
  `RPC:actualidad_senales_panel`, 0065/0066 — **audita E-055, nunca el huérfano E-008**).
- **122-04** — Grupo 5 (lobby↔PL: E-020 `total_n` en `:212-213`, E-002; **denominador honesto**
  excluye `estado_vinculo <> 'confirmado'`; recalcular la cobertura declarada ~3,8 %) y Grupo 6
  (`lobby_sector_aporte` = 0 filas **HONESTAS**, stub de 0052).
- **122-05** aplica los fixes; **122-06** consolida los fragmentos; el **deploy y la
  re-verificación post-fix son la Phase 125**.

## Self-Check: PASSED

- `122-CRUCES-SQL-00-METODO.md` existe; las 8 secciones (§0, §0.1–0.5, §1, §2) presentes por `grep -F`
- Los 6 grupos presentes (`grep -c "^### Grupo"` → 6); ids citados: E-002, E-003, E-008, E-020,
  E-022, E-029, E-044, E-051, E-053, E-055
- Los 3 términos de veredicto definidos; los 3 sujetos presentes
- Cero `postgres://` y cero PII en el artefacto
- Commit `8b47d41` existe; `git diff --stat` = solo el artefacto
