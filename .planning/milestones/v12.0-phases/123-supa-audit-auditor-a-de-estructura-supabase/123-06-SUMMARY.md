---
phase: 123
plan: 06
subsystem: supabase-security-audit
tags: [supa-audit, gate, lockdown-guard, pii, consolidacion]
requires: ["123-01", "123-02", "123-03", "123-04", "123-05"]
provides:
  - "123-SUPA-REVIEWER-VEREDICTO.md — el gate de la fase, verbatim y atribuido"
  - "123-SUPA-AUDIT.md — deliverable de SUPA-01, auto-contenido y re-ejecutable"
  - "PII_TABLES completo + aserción de completitud (A7) en el guard CI"
  - "backlog ordenado LOCKED para la Phase 124"
affects: ["124-*", "app/lib/lockdown-guard.test.ts"]
tech-stack:
  added: []
  patterns: ["guard primero", "corpus congelado en test (CI sin acceso a DB)", "mutation self-check en memoria + probe a disco", "cero fuerte vs cero vacuo"]
key-files:
  created:
    - .planning/phases/123-supa-audit-auditor-a-de-estructura-supabase/123-SUPA-REVIEWER-VEREDICTO.md
    - .planning/phases/123-supa-audit-auditor-a-de-estructura-supabase/123-SUPA-AUDIT.md
  modified:
    - app/lib/lockdown-guard.test.ts
decisions:
  - "El veredicto PASS CON RESERVAS se registra como `veredicto: APROBADO` con el matiz textual en el frontmatter — el propio cuerpo dice que nada alcanza el umbral de BLOQUEO hoy"
  - "El hueco de PII_TABLES se cierra como extensión de guard, NO como migración (exigencia nº1 del gate, patrón `guard primero`)"
  - "`declaracion_bien_inmueble.es_su_domicilio` EXCLUIDA de PII_TABLES con razón escrita: booleano, no matchea la clase (RULE-1: manda el catálogo)"
  - "El corpus de columnas PII va CONGELADO en el test con su query documentada — el guard corre en CI sin acceso a DB"
metrics:
  duration: "~1 sesión"
  completed: 2026-07-29
  tasks: 4
  commits: 4
---

# Phase 123 Plan 06: Gate del `supabase-reviewer` y consolidación de SUPA-01 — Summary

El gate de la Phase 123 queda **emitido, persistido verbatim y cumplido en su única reserva
bloqueante**: veredicto `PASS CON RESERVAS` del subagente `supabase-reviewer`, deliverable SUPA-01
consolidado y auto-contenido con los 6 ejes y 13 offenders con destino, y el hueco de `PII_TABLES`
—el modo de fallo más crítico de la fase, en el único eje donde nadie había mirado— cerrado como
extensión de guard con aserción de completitud contra un corpus congelado y mutation probe a disco.

## Estado final de los cuatro criterios del gate

| criterio | veredicto del reviewer | evidencia |
|---|---|---|
| **1 — Cobertura de los seis ejes** | **CUMPLE** | barrido completo 42/42 funciones y 57/57 tablas, ningún subconjunto; el eje 6 invocó §0.6 E para levantar el filtro `deptype='e'` cuando la regla escondía la superficie |
| **2 — Autoridad de la evidencia** | **CUMPLE — "lo mejor de la fase"** | `aclexplode` como prueba y `role_table_grants` como contraste, con el supuesto **comprobado**; cero-fuerte vs cero-vacuo aplicado (`Q-17` vs `Q-18` vs `Q-20`); `Q-24c` prueba por **ejecución**, no por inferencia de ACL |
| **3 — Clasificación de riesgo** | **CUMPLE con una corrección y una precisión** | `OFF-01` sube a primero en orden; `OFF-6-03` sube de severidad; `OFF-6-01` corregido **en las dos direcciones** (~33 alcanzables por REST, pero `runtests()` y `col_is_null` son lo grave) |
| **4 — Extensión del guard** | **CUMPLE** | sonda de mutación *"sí es prueba suficiente"*; la baseline (A5) **muerde en las dos direcciones**; los 4 `limite-declarado` *"honestos, no huecos disfrazados"*; descarte de Direction-C *"bien argumentado"* |

## El veredicto del gate

**`PASS CON RESERVAS`** — registrado como `veredicto: APROBADO` con el matiz en el frontmatter,
porque el propio cuerpo lo dice sin ambigüedad:

> **Nada de lo hallado alcanza el umbral de BLOQUEO del Gate 2 hoy** (RLS 57/57, cero policies
> `to anon`, cero grants a `anon`, 0/28 secdef sin `search_path`, 0 secdef exec-`anon`, cero buckets,
> `.env` no versionado, cero secrets en `cron.job`). El PASS es con reservas por el hueco de
> `PII_TABLES` y por LIM-6-01, no por el estado del boundary diseñado.

**Las reservas no son decorativas:** 3 precondiciones + **7 huecos** + **5 exigencias**, todas
escritas sin suavizar en `123-SUPA-AUDIT.md`. Las 3 que son acto de operador (probe REST con anon
key, Database Advisors, decisión sobre `pgtap`) quedan marcadas como **checkpoint de operador**
(`OP-1`..`OP-4`), no como tarea de agente.

**El gate NO autoriza a la Phase 124 a aplicar nada** hasta que se cumplan las precondiciones. La
nº1 se cumplió en esta fase; la nº3 y la nº4 quedan ancladas como orden LOCKED; la nº2 y la nº5 son
del operador.

## El hueco de `PII_TABLES` cerrado, con su mutación

Reserva bloqueante del gate: *"la fase demuestra que el guard es la única capa […] pero nunca audita
la cobertura de su propia lista de PII contra las 57 tablas […] Es el modo de fallo que la fase
declara como el más crítico, en el único eje donde no miró."*

**Cuatro tablas con columna de clase RUT estaban fuera de `PII_TABLES`** — incluida
`pii_contraparte_declaracion`, **literalmente prefijada `pii_`**. Ninguna se referencia hoy desde
`app/` (verificado) ⇒ no había fuga activa; pero un `.from("pii_contraparte_declaracion")` habría
pasado el guard **en verde** exponiendo RUTs, con RLS bypassada por `service_role` (`Q-23`).

| qué | cómo |
|---|---|
| `PII_TABLES` **+4** | `pii_contraparte_declaracion`, `contratista`, `contrato`, `declaracion_accion_derecho` |
| **Aserción de completitud (A7)** | falla si una tabla del catálogo con columna `(rut\|email\|telefono\|direccion)` no está cubierta |
| **Corpus CONGELADO** | 8 filas, con la query read-only que lo produjo **documentada en el propio archivo** — el guard corre en CI **sin acceso a DB** |
| **Mutation self-check (memoria)** | tabla PII ficticia ⇒ offender; corpus real ⇒ 0; **quitar** una cobertura existente ⇒ offender (**muerde en las dos direcciones**) |
| **Mutation probe (disco)** | inyectar `tabla_mutacion_probe` al corpus congelado ⇒ **2 tests rojos** con mensaje accionable; restaurar ⇒ **35/35 verde** |

**Adjudicación de la quinta candidata, escrita y no silenciosa:** `declaracion_bien_inmueble ::
es_su_domicilio` **EXCLUIDA con razón** — no matchea la clase (contiene *domicilio*, no *dirección*)
y es un **booleano** que indica si el inmueble declarado es el domicilio del declarante, **no porta
la dirección**. RULE-1: manda el catálogo. La adjudicación vive en el guard
(`PII_ADJUDICACION_EXCLUIDA`) con una aserción de que la fila **no** se cuela en el corpus.

## Backlog ordenado para la Phase 124

**Orden LOCKED, load-bearing** (invertirlo abre superficie):

1. **`OFF-01`** — default ACL de `supabase_admin` en `public`. **ANTES de toda otra migración.**
2. **`OFF-6-04`** — default ACL de `postgres` en `storage`. **ANTES de crear cualquier bucket.**
3. **`OFF-6-03`** — `revoke` de `net` a roles públicos, **en la misma tanda** (corta la cadena SSRF).
4. **`OFF-4-01` + `OFF-5-01`** — `f_unaccent`. Al aplicarlo, **borrar la entrada de
   `KNOWN_MISSING_REVOKE_FROM_PUBLIC`** o la suite se pone roja: **es el diseño**.
5. **`OFF-4-02`** — `revoke execute` sobre las 7 funciones trigger.
6. **`OFF-4-03` + `OFF-4-04`** — `statement_timeout` a las 17 + cotas duras + `LIMIT` explícito.
7. **`B-01`, `B-02`, `B-03`** — backlog de estructura heredado de la Phase 122.
— **`OFF-6-01`/`OFF-6-02`** quedan **fuera** de la secuencia: `supabase-architect` + checkpoint.

**Escape obligatorio para los pasos 1-2:** `postgres.rolsuper = f` ⇒ el `alter default privileges
for role supabase_admin` **probablemente falle**. En ese caso se reclasifica a `deuda-operador`, **se
reporta explícitamente y JAMÁS se escala privilegio**. El gate: *"exijo que 124 no lo trague en
silencio"*.

**B-01** (cap `p_limit: 1000` — `D1165` = **3.752** votos reales, deploy muestra **1.000**, y el
`order by fecha desc` **distorsiona la composición**) y **B-02** (tile *Por materia*,
**3.100/3.675 = 84,4 %** sin denominador) quedan anclados **con su forma aditiva del fix**: el
ROADMAP de 124 no los nombra.

## Identidad aritmética de la consolidación

```
13 offenders (tabla consolidada) == 2 (frag 01) + 6 (frag 02) + 5 (frag 03) + 0 (frag 04)
```

Cuadra ítem por ítem con la clasificación del gate. Por destino: `124-aditivo` **8** +
`supabase-architect+checkpoint` **2** + `guard` **3** (cerrados en esta fase por A4/A5/A6) +
`deuda-operador` **0** = **13**.

## Desviaciones del plan

### 1. [RULE-1 — Realidad] El grep anti-secreto mordió el veredicto verbatim

- **Encontrado durante:** Task 1, `<verify>` del propio plan.
- **Issue:** el hueco nº2 del veredicto enumera los patrones que el reviewer buscó en
  `cron.job.command` e incluye el **prefijo literal de cabecera JWT**. Ese literal dispara el grep
  anti-secreto del plan. Conflicto directo entre *transcribir verbatim* y *cero patrones de
  credencial*.
- **Fix:** sustituir **solo ese token** por la clase sin valor `<prefijo-JWT>`, marcado con `[›]` en
  el punto exacto, y **declarar la sustitución en la cabecera** como única modificación. Precedente
  del proyecto: el fragmento 03 sufrió lo mismo y aplicó el mismo remedio. El sentido del hallazgo
  —*cero secrets en `cron.job`*— queda intacto.
- **Nota:** el control funcionó **sobre el artefacto de auditoría**, que es también superficie
  (mitigación T-123-22). Es el tercer executor al que muerde.

### 2. [RULE-1 — Realidad] La quinta candidata del gate no matchea el catálogo

- **Encontrado durante:** el trabajo extra ordenado por el gate.
- **Issue:** el reviewer listó `declaracion_bien_inmueble :: es_su_domicilio` como quinta tabla con
  columna de clase PII. Contra el catálogo vivo **no matchea** `(rut|email|telefono|direccion)`.
- **Fix:** **excluida con razón escrita** (booleano, no dato de contacto), adjudicada explícitamente
  en el guard y en el veredicto persistido. Ni se metió por inercia ni se omitió en silencio.

### 3. [RULE-1 — Realidad] El recuento por destino del consolidado

- **Issue:** al agrupar los 13 offenders por destino, el conteo de `124-aditivo` es **8**, no 7.
- **Fix:** la corrección queda **escrita en el propio artefacto** en vez de cambiar el número en
  silencio. `8 + 2 + 3 + 0 = 13`, cuadra con la tabla y con el gate.

### 4. [RULE-1 — Realidad] El detector (A7) emite una fila por columna, no por tabla

- **Issue:** el primer mutation self-check esperaba `["parlamentario (email)"]` al quitar la
  cobertura de `parlamentario`; el detector emite las **dos** columnas (`email` y `rut`).
- **Fix:** expectativa corregida a la salida real del detector. Es más informativo así: nombra todas
  las columnas descubiertas, no solo la primera.

## Régimen respetado

- **Cero DDL, cero DML, cero migración, cero deploy, cero flag.** `git diff --quiet -- supabase`
  sale **0**; **no existe** ningún `supabase/migrations/0073*`.
- Único acceso a PROD: **un `SELECT` read-only** sobre `pg_class`/`pg_attribute` para congelar el
  corpus PII. `SUPABASE_DB_URL` **jamás ecoado, expandido ni escrito** — solo su nombre.
- **Cero PII**: nombres de tabla y de columna, jamás valores. Grep anti-secreto verde sobre ambos
  artefactos.
- Las dos únicas correcciones de la fase son **extensiones de guard** (patrón "guard primero").

## Verificación

| control | resultado |
|---|---|
| `pnpm exec vitest run lib/lockdown-guard.test.ts` | **35 passed (35)** — antes 31 |
| `pnpm exec vitest run` (suite `app/`) | **1590 passed (1590)** / 107 archivos — antes 1586, umbral ≥ 1586 ✅ |
| `pnpm exec tsc --noEmit` | **exit 0**, sin salida |
| `git diff --quiet -- supabase app` | **exit 0** |
| `ls supabase/migrations/0073*` | **0 archivos** |
| grep anti-secreto sobre `123-SUPA-REVIEWER-VEREDICTO.md` | **OK** (cero matches) |
| grep anti-secreto sobre `123-SUPA-AUDIT.md` | **OK** (cero matches) |
| encabezados literales del consolidado | **6/6 presentes** |
| bloques ```sql transcritos en el consolidado | **36** (umbral ≥ 10) |
| mutation probe a disco (A7) | inyectar ⇒ **2 rojos**; restaurar ⇒ **35/35 verde** |

## Known Stubs

Ninguno. Los dos artefactos son documentación consolidada con evidencia real, y la extensión de
guard está completamente cableada (detector puro + scan + self-check + probe a disco).

## Self-Check: PASSED

- Archivos declarados: 3/3 encontrados en disco.
- Commits declarados: 3/3 encontrados en `git log --all` (`d33d424`, `02fd068`, `e5054bc`) + el
  commit de metadatos de este SUMMARY.
- Grep anti-secreto verde sobre los tres artefactos.
