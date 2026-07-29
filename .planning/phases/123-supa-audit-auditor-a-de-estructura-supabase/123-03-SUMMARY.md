---
phase: 123
plan: 03
subsystem: supabase-audit
tags: [rpc, security-definer, allowlist, bounded, splinter, read-only]
requires: ["123-01"]
provides:
  - "123-SUPA-AUDIT-02-RPC-SECDEF.md (ejes 4-5 auditados contra la DB viva)"
  - "6 offenders ruteados: 5 124-aditivo + 1 guard (123-05)"
affects: [123-04, 123-05, 123-06]
tech-stack:
  added: []
  patterns:
    - "toda canalizacion psql -tA | sort | comm exige tr -d '\\r' en Windows"
    - "cero fuerte vs cero vacuo: un 0 offenders sin recuento del denominador oculta la diferencia"
key-files:
  created:
    - .planning/phases/123-supa-audit-auditor-a-de-estructura-supabase/123-SUPA-AUDIT-02-RPC-SECDEF.md
  modified: []
decisions:
  - "PUBLIC_RPC_ALLOWLIST gobierna a service_role, NO a anon: el sentido A del comm (29/29) es regimen correcto, no huerfandad"
  - "huerfano real se mide contra TODAS las funciones vivas (Q-15bis), no contra las exec-anon: da 0"
  - "no-bounded (sin LIMIT ni statement_timeout) = seguridad/DoS = eje 4; p_limit que trunca = exactitud = B-01 de la Phase 124"
  - "secdef+anon es el patron de diseno del proyecto: Q-19 no es tabla de offenders por si sola"
metrics:
  duration: "~35 min"
  completed: 2026-07-29
  tasks: 3
  commits: 1
---

# Phase 123 Plan 03: Ejes 4-5 (RPCs públicas + SECURITY DEFINER) — Summary

Auditadas las 42 funciones de `public` contra PROD: **ninguna RPC de negocio es ejecutable por
`anon`** (el régimen `>0044` está realmente aplicado, contra lo que declaran las migraciones),
**Splinter 0011 limpio sobre 28 secdef**, y **18 RPCs sin `statement_timeout`** confirmando y
ampliando el hallazgo heredado de 123-01. 6 offenders, ninguno destructivo.

## Qué se hizo

Un solo artefacto: `123-SUPA-AUDIT-02-RPC-SECDEF.md` (commit `090f6f5`), con `Q-12`..`Q-19` más tres
queries añadidas por RULE-1 (`Q-13bis`, `Q-14bis`, `Q-15bis`) y la revisión manual obligatoria con
`pg_get_functiondef`. Cero DDL, cero DML, cero RPC invocada, cero PII, `git status` de `supabase/` y
`app/` **vacío**.

## Hallazgos que mandan

### 1. La superficie `anon` sobre `public` es de 8 funciones residuales, ninguna de negocio

`Q-12` sobre las 42: las 34 RPCs de negocio dan `exec_anon = f` **y** `exec_authenticated = f`. Solo
`service_role`. Las 8 que sí alcanza `anon` llegaron por el **default `EXECUTE TO PUBLIC`**
(`proacl = =X/postgres`), nunca por un `grant` deliberado: 7 son `RETURNS trigger` (no invocables
como RPC) y `f_unaccent` es un escalar sin acceso a tablas.

**Contradicción autoritativa vs contraste, registrada:** las migraciones `0011`–`0024` declaran
`grant execute … to anon` para **9** RPCs (`match_proyectos`, `votos_de_parlamentario`,
`rebeldias_de_parlamentario`, `parlamentario_publico`, `lobby_de_parlamentario`,
`declaraciones_de_parlamentario`, `comparar_declaraciones`, `contratos_de_parlamentario`,
`aportes_de_parlamentario`). La DB viva dice `f` para las nueve — `0044`/`0045` revocaron después.
Mismo gotcha del §0.4 aplicado a **grants** en vez de a objetos.

### 2. `Q-13` tal como venía escrita era casi vacía

Su filtro es `exec_anon`, que es prácticamente cero ⇒ habría declarado el eje 4 sobre 8 funciones
triviales, dejando sin mirar las 34 que el sitio llama. `Q-13bis` (las 42) es la que sostiene el
veredicto.

**Confirmado el hallazgo heredado:** exactamente **13** funciones llevan `statement_timeout=5s`;
`cruces_de_parlamentario` **no**, tal como 123-01 corrigió.

### 3. La heurística de `LIMIT` falló en 4 casos — todos rescatados a mano

`agregado_por_contraparte` (`limit public.agregado_por_contraparte_cap()` = 500),
`match_proyectos` (`limit match_count`), `votos_de_parlamentario` (`limit p_limit`) y
`buscar_citaciones` (`limit greatest(1, least(coalesce(limite,50),100))` = techo 100). Ninguna se
declaró offender por regex; las cuatro se leyeron con `pg_get_functiondef`. Además se rescataron por
construcción: `coincidencia_votos_par` (agregación 1-fila), `agregado_por_contraparte_cap`
(constante), `parlamentario_publico` (PK), las 7 trigger y las 2 admin-write.

### 4. Eje 5 sustancialmente limpio

28 secdef, **las 28** con `search_path=""` y `owner = postgres`. `Q-17` (Splinter 0011) = **0 filas**
sobre un denominador de 28 ⇒ **cero fuerte**. `Q-19` (secdef exec-`anon`) = 0 filas. `Q-18`
(Splinter 0010) = 0 filas **pero cero vacuo**: hay **0 vistas** en `public`, y así queda dicho.

Único hueco: **`f_unaccent` es la única función de las 42 sin `search_path`** en `proconfig`. No es
secdef (corre como invoker ⇒ sin escalada) y su cuerpo ya califica `public.unaccent`, así que hoy no
es explotable — es offender de **régimen**, no de riesgo vivo.

## Offenders — separados por naturaleza

### Seguridad (eje 4 / eje 5)

| # | objeto | riesgo | destino |
|---|---|---|---|
| OFF-4-01 | `f_unaccent` | invocable por `anon` fuera de toda allowlist (no filtra datos) | `124-aditivo` |
| OFF-4-02 | 7 funciones `RETURNS trigger` | `EXECUTE TO PUBLIC` nunca revocado; latente, no explotable hoy | `124-aditivo` |
| OFF-4-03 | **17 RPCs sin `statement_timeout`** (12 sin `LIMIT` alguno; 3 con techo; 2 con `LIMIT` sin techo) | DoS: barrido de tabla completa o cardinalidad elegida por el cliente | `124-aditivo` |
| OFF-4-04 | `subgrafo_red` | fan-out por nivel sin cota + sin timeout (la profundidad **sí** está clampeada 1..2) | `124-aditivo` |
| OFF-4-05 | guard Direction-B | punto ciego: **nunca mira grants**, solo definiciones | **`guard`** → 123-05 |
| OFF-5-01 | `f_unaccent` | única función sin `search_path` en el corpus | `124-aditivo` |

**Cero filas `supabase-architect+checkpoint`** — la regla se evaluó y no se gatilló: los 6 fixes son
`alter function … set`, `revoke execute` y una extensión de guard. Todos aditivos y reversibles.
Queda escrito que si 124 descubre que acotar `match_proyectos`/`votos_de_parlamentario` exige
**cambiar la firma**, eso obliga a `drop function` (`42P13`) y **entonces** pasa a
`architect+checkpoint`.

### Exactitud (NO seguridad → backlog de 124)

`votos_de_parlamentario` cae en dos casillas: `p_limit` sin techo es OFF-4-03 (seguridad), y el cap
de **1.000** que trunca (`D1165`: 1.000 sobre 3.752 reales) es **`B-01`**, exactitud, anclado en
123-06. Son dos arreglos distintos y el fragmento prohíbe explícitamente fundirlos.

### `limite-declarado`

`Q-14`/`Q-14bis` inspeccionan **nombres de columna de la firma de retorno**, no contenido. Una RPC
que emitiera un RUT dentro de un `evidencia jsonb` o un `materia text` **no sería detectada**.
`cruces_de_parlamentario` retorna precisamente un `evidencia jsonb` cuyo comentario *afirma* ser
PII-safe — afirmación del código, no verificación. Verificarla exigiría leer filas, prohibido.
Herencia para 123-04 y 124.

## Desviaciones (RULE-1: manda la realidad)

**1. [RULE-1 · Bug] `psql -tA` emite CRLF en este host Windows ⇒ el `comm` del Paso 3 dio resultados falsos.**

- **Encontrado en:** Task 2, Paso 3.
- **Antes:** el plan encadena `psql -tA … | sort -u > /tmp/exec_anon.txt` y luego `comm`. Ejecutado
  literalmente, cada línea queda como `nombre\r` y **no coincide** con la lista `\n` de `node`.
- **Cómo se cazó:** una comparación de control («allowlist vs. TODAS las funciones vivas») devolvió
  las 29 entradas como huérfanas — **imposible**, porque `Q-12` había enumerado esas mismas funciones
  tres pasos antes. `od -c` confirmó `\r\n`.
- **Después:** `tr -d '\r'` interpuesto tras cada `psql`. Todas las salidas `comm` del fragmento se
  produjeron así.
- **Advertencia que hereda la fase:** **`sort -c` NO protege contra esto** — una lista CRLF está
  perfectamente ordenada y pasa el chequeo. El plan confiaba en `sort -c` como salvaguarda del
  `comm`; es insuficiente. Documentado como §0 del fragmento.

**2. [RULE-1 · Cobertura] `Q-13` y `Q-14` filtran por `exec_anon`, que vale ~0 ⇒ habrían auditado 8 de 42.**

- **Después:** se añadieron `Q-13bis` (acotamiento de las 42) y `Q-14bis` (PII sobre las 42), ambas
  transcritas con su salida. `Q-14bis` da el **cero fuerte**: ninguna de las 42 firmas nombra `rut`,
  `email`, `correo`, `telefono`, `donante_id` ni `direccion`. Las queries originales se conservan
  íntegras con su salida; las bis se marcan como añadido.
- **Justificación:** el §0.3 exige barrer el corpus completo (42 funciones); auditar 8 habría exigido
  un `limite-declarado` sobre 34.

**3. [RULE-1 · Semántica] El sentido A del `comm` no mide huérfandad; se añadió el sentido C.**

- **Antes:** el plan define `comm -23 allowlist exec_anon` como «HUÉRFANOS».
- **Realidad:** da **29 de 29**, y no es una alarma: `PUBLIC_RPC_ALLOWLIST` gobierna lo que el árbol
  público llama **con `service_role`**, no lo que `anon` ejecuta — lo dice su propio comentario en
  `lockdown-guard.test.ts:180-182`. Que ninguna sea exec-`anon` **es el régimen `>0044` funcionando**.
- **Después:** se conservó el sentido A **con su salida literal**, reclasificado como `conforme`
  informativo, y se añadió `Q-15bis` + **sentido C** (`allowlist` vs **todas** las funciones vivas) =
  el huérfano semánticamente correcto ⇒ **0 filas**. Los dos sentidos del plan quedan entregados; el
  tercero es el que cierra el boundary.

**4. [RULE-1 · Método] Se distinguió "cero fuerte" de "cero vacuo".**

- `Q-17` = 0 sobre 28 objetos inspeccionados. `Q-18` = 0 sobre **0 objetos** (no hay vistas en
  `public`). El plan las trataba igual. Se añadieron los recuentos de denominador (`28|42` y
  `vistas_en_public = 0`) y una nota que obliga a 123-06 a leerlas distinto.

**5. [Protocolo] Un solo commit en vez de tres.**

El artefacto es un documento único y cohesivo cuyas tres secciones se escribieron de una vez; tres
commits habrían exigido partirlo artificialmente. Commit `090f6f5`, ámbito `123-03`.

## Qué heredan 123-04 / 123-05 / 123-06

**123-05 (guard, el más cargado) — OFF-4-05, con su trampa ya identificada:**

- Direction-B (`lockdown-guard.test.ts:614`) compara la allowlist contra `definedRpcNames()`, es
  decir contra **definiciones** en los `.sql`. **Nunca mira grants.** No caza ni los 9
  `grant … to anon` ya revocados ni las 8 funciones abiertas por el default `TO PUBLIC`.
- **El guard corre en CI sin DB** ⇒ la extensión debe ser **estática**.
- **Trampa demostrada:** un chequeo ingenuo «`grant execute … to anon` declarado ⊆ allowlist»
  **fallaría hoy con 9 falsos positivos**, porque esos grants existen en los archivos y fueron
  revocados después. Una extensión correcta debe **plegar grant/revoke en orden de número de
  migración**, o limitarse a lo estáticamente decidible sin ambigüedad: **exigir que toda
  `create function` en `public` lleve su `revoke execute … from public`** — que es exactamente el
  defecto que produjo OFF-4-01 y OFF-4-02.

**123-04 (eje 6):**

- Confirmar si `app/` invoca `rebeldias_de_parlamentario` o `tasa_ausencia_comparada`: existen, son
  secdef con `search_path`, **no** están en la allowlist. Si el árbol público las llama, el guard ya
  está rojo y el hallazgo es suyo.
- El `limite-declarado` de PII-en-`jsonb` (`cruces_de_parlamentario.evidencia`) pasa a su eje.

**123-06 (consolidación):**

- 6 offenders: **5 `124-aditivo`**, **1 `guard`**, **0 `architect+checkpoint`**, **0
  `deuda-operador`**.
- Anclar **`B-01`** (exactitud, cap de 1.000 en votos) **separado** de OFF-4-03 (seguridad).
- Leer `Q-17` (cero fuerte) y `Q-18` (cero vacuo) como cosas distintas.
- Nota para 124: **no hay ninguna vista en `public`**; cualquier vista nueva nace bajo Splinter 0010
  y debe crearse con `with (security_invoker = true)`. Hoy no hay guard que lo exija.

## Known Stubs

Ninguno. Todo veredicto lleva su bloque ```sql con salida real; los dos `limite-declarado` llevan la
razón por la que no son verificables bajo este régimen.

## Threat Flags

Ninguno. Cero superficie introducida: el plan es read-only y el único artefacto es documentación.
Mitigaciones del `<threat_model>` cubiertas: T-123-08 (`Q-17`, 0/28), T-123-09 (`Q-13bis` + revisión
manual, 18 offenders), T-123-10 (`Q-15` + `comm` ambos sentidos + sentido C, OFF-4-05), T-123-11
(`Q-14`/`Q-14bis`, 0 filas + `limite-declarado`), T-123-12 (**ninguna RPC fue invocada**).

## Verificación

- Task 1 `<automated>` → `T1 OK`; Task 2 → `T2 OK`; Task 3 → `T3 OK`
- Anti-secreto sobre el fragmento (connection strings, claves secretas/publicables, PAT, prefijo JWT,
  access-key-id, `SERVICE_ROLE_KEY`) → **0 coincidencias**
- `git status --porcelain supabase/ app/` → **vacío** (cero DDL, cero toque al guard)
- Sucios preexistentes no tocados: `119-REVIEW.md`, `pnpm-workspace.yaml`, `122-VERIFICATION.md`
- `git diff --diff-filter=D HEAD~1 HEAD` → **0 deleciones**

## Self-Check: PASSED

- FOUND: `.planning/phases/123-supa-audit-auditor-a-de-estructura-supabase/123-SUPA-AUDIT-02-RPC-SECDEF.md`
- FOUND: commit `090f6f5`
