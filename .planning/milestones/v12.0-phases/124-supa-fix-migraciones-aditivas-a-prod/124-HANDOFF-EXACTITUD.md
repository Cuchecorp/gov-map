---
fase: 124
plan: 07
tipo: handoff
items: 14
b_items: 3
offenders_diferidos: 2
actos_operador: 4
huecos_al_regimen: 4
deudas_nuevas_de_124: 1
urgencia_elevada: ["OP-1", "OP-4"]
deliverable_padre: 124-SUPA-FIX.md
fecha: 2026-07-29
---

# Phase 124 · Handoff — lo que esta fase **NO** cierra

## Decisión explícita de apertura

**Los tres ítems del backlog de exactitud —`B-01`, `B-02`, `B-03`— NO se toman en la Phase 124.**

La razón es **presupuesto, no dificultad**. La fase consumió su presupuesto íntegro en los **8
offenders de seguridad** con destino `124-aditivo`: 7 migraciones escritas, **5 aplicadas a PROD**
(`0074`, `0076`, `0077`, `0078`, `0079`) y 2 adjudicadas como deuda de operador con evidencia
(`0073`, `0075`), **cada una** con pre-check fail-closed, post-check en la misma transacción, pgTAP
contra el schema aplicado, y re-auditoría verbatim. Dos de esas waves tuvieron que **parar y escalar**
porque el audit contradecía a la DB viva. Tomar además `B-01`/`B-02`/`B-03` habría degradado la
calidad del trabajo de seguridad, que es lo que la fase existía para hacer.

Y son de **otra clase**: exactitud, no boundary. El audit lo separa con una regla **LOCKED** que esta
fase respetó al pie:

> **Separación LOCKED que 124 no debe fundir:** `B-01` es **exactitud**; el `p_limit` sin techo de la
> **misma función** es **seguridad** (`OFF-4-03`). **Dos arreglos distintos.**

Esa separación **se respetó y se puede auditar**: `0078` puso `limit least(coalesce(p_limit, 20),
4000)` en `votos_de_parlamentario` —el clamp de **seguridad**— y **no tocó** el `order by vo.fecha
desc nulls last`, ni el `offset p_offset`, ni el default `20`. El cap de 1.000 que el sitio pasa como
argumento **sigue exactamente donde estaba**, y con él el problema de exactitud de `B-01`. El clamp de
seguridad y la RPC de conteo de `B-01` **no son lo mismo** y no se sustituyen entre sí.

**Nada aquí queda cerrado en silencio.** Cada ítem lleva sus **cinco campos obligatorios**: qué es ·
evidencia · forma del fix aditiva · destino nombrado · quién lo cierra. Un ítem sin destino sería un
ítem cerrado en silencio.

---

## 0. Índice y urgencia

| ítem | clase | urgencia | destino | quién |
|---|---|---|---|---|
| **`OP-1`** | acto de operador | 🔴 **ELEVADA** | checkpoint de operador | operador |
| **`OP-4`** | acto de operador | 🔴 **ELEVADA** | `supabase-architect` + checkpoint de operador | operador → architect |
| `OFF-6-01` | offender diferido | alta (gatea con `OP-1`) | `supabase-architect` + checkpoint (`OP-4`) | architect |
| `OFF-6-02` | offender diferido | baja (documentado) | `supabase-architect` + checkpoint (`OP-4`) | architect |
| `OP-2` | acto de operador | media | checkpoint de operador | operador |
| `OP-3` | acto de operador | baja (desbloqueado) | checkpoint de operador | operador |
| `B-01` | exactitud | media | próxima auditoría de régimen (backlog de exactitud); síntoma verificable en **Phase 125** | agente, fase futura |
| `B-02` | exactitud | media | próxima auditoría de régimen (backlog de exactitud); síntoma verificable en **Phase 125** | agente, fase futura |
| `B-03` | exactitud / guard | baja (cero vacuo hoy) | próxima auditoría de régimen — **aserción de guard**, no fix | agente, fase futura |
| `D-01` (nuevo en 124) | deuda de medición | condicional al flip MONEY | checkpoint de operador (mismo acto que el flip) | operador → agente |
| hueco **2** `pgmq`/`pg_cron` | auditoría | media | próxima auditoría de régimen | agente auditor |
| hueco **3** esquemas fuera de `public` | auditoría | baja | próxima auditoría de régimen | agente auditor |
| hueco **4** Edge Function `ingest-worker` | auditoría | **alta** | próxima auditoría de régimen | agente auditor |
| hueco **5** `graphql_public` | auditoría | media | próxima auditoría de régimen | agente auditor |

**Por qué `OP-1` y `OP-4` van en rojo y no como una línea más del backlog:** `OFF-6-03` quedó en
`DEUDA-OPERADOR`, así que **la cadena SSRF sigue abierta** y su único mitigante vigente es el
**accidente** de que `pgtap` no nombra los argumentos de su familia `lives_ok` (`proargnames = NULL`),
lo que impide a PostgREST invocarla. El gate de la Phase 123 calificó ese mitigante, verbatim, de
*«frágil y no intencional»*. Un `alter extension pgtap update` que ponga nombre a esos parámetros lo
elimina **sin aviso y sin un solo test rojo**. `OP-1` y `OP-4` son **hoy** los dos únicos actos que
pueden cerrar o acotar esa superficie.

---

## 1. `B-01` — cap de 1.000 en votos, con distorsión de composición

- **Qué es.** La RPC `votos_de_parlamentario` se invoca desde el sitio con `p_limit = 1000`. Un
  parlamentario con más de 1.000 votos ve su total truncado, y como la RPC ordena
  `by fecha desc nulls last`, el truncamiento **no es solo cuantitativo: distorsiona la composición**
  del desglose (a favor / en contra / abstención / ausente), porque se queda con los 1.000 votos más
  recientes, no con una muestra representativa.
- **Evidencia (la del audit, citada).** `123-SUPA-AUDIT.md` §Backlog de estructura heredado, fila
  `B-01`: *«`D1165` tiene **3.752** votos reales; el deploy muestra **1.000**. La RPC ordena
  `by fecha desc` ⇒ además **distorsiona la composición** del desglose (no es solo truncar)»*, y
  *«el total honesto **no es derivable** del set truncado»*. Corroborado por la medición viva de la
  wave 5 de esta fase: **186** parlamentarios, `max_votos = 3773`, **71** de ellos con más de 1.000
  votos ⇒ el truncamiento afecta a **71 de 186 fichas**, no a un caso de borde.
- **Forma del fix, aditiva.** **RPC de conteo dedicada**, con la aguja completa del régimen:
  `SECURITY DEFINER` PII-safe, `set search_path = ''`, `set statement_timeout = '5s'`, `LIMIT`
  explícito, **doble-revoke** (`revoke execute … from public` + `from anon, authenticated` en la misma
  migración), y entrada nueva en `PUBLIC_RPC_ALLOWLIST`. **Aditiva por construcción**: no altera la
  firma ni el cuerpo de `votos_de_parlamentario`, así que no hay `42P13` ni re-arma de default
  privileges.
- **No confundir con el clamp de `0078`.** El `least(coalesce(p_limit, 20), 4000)` que esta fase
  aplicó es **seguridad** (impide que el llamador elija su propia cardinalidad). `B-01` es
  **exactitud** (emitir el total honesto). Aplicar uno **no** resuelve el otro; de hecho el techo
  original que el audit prescribía (**200**) habría **empeorado** `B-01`, y por eso se paró y se
  adjudicó 4000.
- **Destino nombrado.** **Próxima auditoría de régimen / backlog de exactitud** — anclado aquí para
  que no se pierda. Su **síntoma** es verificable en **Phase 125** (pasada E2E sobre el deploy real:
  el chip "Emitió N votos" de un parlamentario con >1.000 votos), pero **Phase 125 es verificación,
  no fix**: no escribe SQL.
- **Quién lo cierra.** Agente, en una fase de estructura Supabase futura. **No** es acto de operador
  ni de architect: no toca ownership ni requiere decisión destructiva.

---

## 2. `B-02` — denominador del tile *Por materia*

- **Qué es.** El tile *Por materia* agrupa **3.100 de 3.675** proyectos (**84,4 %**) y **no declara su
  cobertura**. Un lector ve una distribución que parece completa y no lo es.
- **Evidencia (la del audit, citada).** `123-SUPA-AUDIT.md` §Backlog, fila `B-02`, con evidencia en
  `122-CRUCES-SQL-04-FIXES.md` (Phase 122): *«la RPC hoy **no emite el denominador**; declarar
  cobertura sin denominador es **fabricarla**»*. Es la misma regla de método que gobierna todo el
  audit: **un número sin denominador no es evidencia**.
- **Forma del fix, aditiva.** Añadir el denominador a la salida de la RPC mediante **firma v2
  paralela**, **precedente `0060`** (ya vivo en el repo: `parlamentario_publico_v2`,
  `parlamentarios_publico_v2` conviven con sus v1). **No alterar la firma viva** — cambiar el
  `returns table` de una función existente exige `drop function` (`42P13`), y el `drop`+`create`
  re-arma los default privileges, que es exactamente el mecanismo que `OFF-01` deja abierto mientras
  sea deuda. La v2 nace con su doble-revoke adjunto en la misma migración y su entrada propia en
  `PUBLIC_RPC_ALLOWLIST`; la v1 se retira cuando el frontend haya migrado.
- **Destino nombrado.** **Próxima auditoría de régimen / backlog de exactitud**; síntoma verificable
  en **Phase 125** (el tile debe declarar "3.100 de 3.675" o equivalente).
- **Quién lo cierra.** Agente, fase futura de estructura Supabase + su cambio de UI acompañante.

---

## 3. `B-03` — vista nueva en `public` sin `security_invoker`

- **Qué es.** Cualquier vista que se cree en `public` sin `with (security_invoker = true)` corre con
  los privilegios de su **dueño**, no de quien la consulta (Splinter **0010**) — y en este proyecto el
  dueño es `postgres`, es decir el máximo blast radius.
- **Evidencia (la del audit, citada).** `Q-18` → **0 vistas**. `123-SUPA-AUDIT.md` lo marca
  explícitamente como **cero VACUO**, no fuerte: *«`Q-17` = 28 objetos inspeccionados, 28 conformes
  (cero **fuerte**). `Q-18` = 0 objetos»*. Re-verificado en esta fase por `Q-02`/`Q-03`: `public` no
  tiene vistas ni matviews propias.
- **Forma del fix, aditiva.** **Hoy no hay nada que arreglar** — decirlo así es parte del handoff. Lo
  que falta **no es un fix, es una aserción de guard**: un test estático en `lockdown-guard.test.ts`
  que trate como offender toda `create view` / `create materialized view` en `public` (en migraciones
  posteriores a la actual) que **no** lleve `with (security_invoker = true)`. Es el mismo idiom
  por-sentencia de `anonGrantOffenders` sobre el SQL stripeado y en minúscula, y es **aditivo**: cero
  DDL, cero PROD.
- **Destino nombrado.** **Próxima auditoría de régimen** — junto con el resto de extensiones del guard
  (es trabajo de guard, no de migración).
- **Quién lo cierra.** Agente, en la fase de guards de la próxima auditoría. **Cuando se escriba la
  primera vista de `public`, esta aserción debe existir ANTES**, o el offender nace con el guard en
  verde.

---

## 4. `OFF-6-01` — `pgtap` en el esquema `public` (1.087 objetos, 1.079 funciones)

- **Qué es.** La extensión `pgtap` vive en `public`, el esquema que PostgREST expone. Sus **1.079**
  funciones son ejecutables por `anon`, están **fuera de la allowlist, fuera del corpus auditado y
  fuera de todo guard**. Un cliente no autenticado puede enumerar tablas, columnas y funciones — mapa
  completo de las 57 tablas, PII incluida. El gate agravó el diagnóstico: `runtests()` es **ejecución
  no gobernada + DoS**, y `col_is_null`/`col_not_null` son **oráculo de enumeración**.
- **Evidencia (la del audit, citada).** `Q-24`, `Q-24b`, `Q-24c` de
  `123-SUPA-AUDIT-03-EXPOSICION-GUARDS.md` — *«divulgación de estructura a `anon`, **probada por
  ejecución** (`Q-24c`)»*. `Q-24b` cuenta **1.209** funciones de extensión exec-`anon` en `public`,
  de las cuales 1.079 son de `pgtap`.
- **Forma del fix.** **NO es aditiva, y ése es exactamente el motivo del diferimiento.** Las dos
  opciones son (a) `drop extension pgtap;` en PROD o (b) `alter extension pgtap set schema
  extensions;` — **destructiva** y **de reubicación** respectivamente. Ambas exigen **decidir antes el
  destino de las suites pgTAP del proyecto**, que hoy dependen de que la extensión viva donde vive
  (las 7 suites `supabase/tests/post-apply/*.test.sql` de esta misma fase, entre otras). Hacerlo a
  ciegas deja al proyecto sin su mecanismo de verificación post-apply.
- **Destino nombrado.** **`supabase-architect` + checkpoint de operador (`OP-4`)** — el destino que el
  audit le asignó y que el `124-CONTEXT.md` confirmó como fuera del alcance de esta fase. **Declarado,
  no aplicado.**
- **Quién lo cierra.** El operador decide (`OP-4`); `supabase-architect` diseña la migración y el
  destino de las suites.
- **Gate de escalada, vivo:** si `OP-1` devuelve **200** en el probe REST, `OFF-6-01` deja de ser
  "divulgación de estructura" y pasa a **BLOQUEANTE**.

---

## 5. `OFF-6-02` — `vector` y `unaccent` en `public`

- **Qué es.** `vector` (237 objetos / **118** funciones exec-`anon`) y `unaccent` (6 objetos / **4**
  funciones) viven en `public`: **122 funciones más** en el esquema expuesto, invisibles para la
  allowlist. Splinter **0014**.
- **Evidencia (la del audit, citada).** `Q-24`, `Q-24b`. El audit es explícito sobre la magnitud del
  riesgo: *«fuga **nula** (operadores de distancia y normalización, sin acceso a tablas); riesgo de
  **régimen**»*.
- **Forma del fix, aditiva.** **No moverlas.** `vector(768)` es el tipo de columna de
  `proyecto_embedding` y sostiene el índice HNSW; `unaccent` es la base de `f_unaccent` y del FTS.
  Moverlas **rompería tipos, índices y firmas**. Lo aditivo y correcto es **documentar la excepción**,
  que **ya está hecho**: `PUBLIC_EXTENSION_ALLOWLIST` en `lockdown-guard.test.ts`, con la aserción
  `(A6)(c)` que falla si una migración instala en `public` una extensión fuera de esa allowlist.
- **Destino nombrado.** **`supabase-architect` + checkpoint de operador (`OP-4`)** — formalmente
  diferido junto a `OFF-6-01` porque comparten la decisión sobre extensiones en `public`. En la
  práctica su resolución esperada es **"aceptado y documentado"**, no "movido".
- **Quién lo cierra.** `supabase-architect`, ratificando la excepción en el checkpoint de `OP-4`.

---

## 6. `OP-1` — probe REST con la anon key 🔴 **URGENCIA ELEVADA**

- **Qué es.** Un probe **read-only** con la `SUPABASE_ANON_KEY` contra `/rest/v1/rpc/pg_version`,
  `/rest/v1/rpc/runtests` y `/rest/v1/rpc/col_is_null`.
- **Por qué es del operador.** La `SUPABASE_ANON_KEY` **no está en `.env`** — buena higiene, y no se
  va a romper para esto. Sale del dashboard del proyecto. Exigencia **nº2** del gate de la Phase 123.
- **Evidencia.** `LIM-6-01`/`LIM-6-02` de `123-SUPA-AUDIT.md` siguen abiertos: *«no se pudo verificar
  desde la sesión qué esquemas expone PostgREST (`pgrst.db_schemas` no es visible)»*. El gate:
  *«Se resuelve en 60 segundos con la anon key del dashboard»*.
- **Forma del fix.** Tres `GET`/`POST` REST, sin escritura, con la respuesta HTTP registrada.
- **Qué desbloquea.** Cierra `LIM-6-01`/`LIM-6-02`. **Y adjudica `OFF-6-01`:** si responden **200**,
  `OFF-6-01` pasa a **bloqueante de Gate 2** ⇒ `alter extension pgtap set schema extensions` (o
  `drop extension` en PROD) con checkpoint, decidiendo antes el destino de las suites pgTAP.
- **Por qué sube de urgencia ahora.** Con `OFF-6-03` en deuda, `anon` conserva `USAGE` sobre `net` y
  `EXECUTE` sobre `net.http_post`. La cadena SSRF **completa** requiere alcanzar `net` desde
  PostgREST, y `pgtap` en `public` es el puente candidato. **`OP-1` es la medición que dice si el
  puente existe.** Mientras no se corra, el proyecto no sabe si está expuesto — y no saberlo no es lo
  mismo que estar a salvo.
- **Destino nombrado.** **Checkpoint de operador.**
- **Quién lo cierra.** El operador (60 segundos, read-only). El `124-CONTEXT.md` registra que el
  checkpoint fue respondido *"seguir con lo no bloqueado"* — es decir, **el probe sigue sin correrse**.

---

## 7. `OP-4` — destino de `pgtap` y de las suites pgTAP 🔴 **URGENCIA ELEVADA**

- **Qué es.** La decisión sobre `pgtap` en PROD: dejarla, moverla a `extensions`, o dropearla — y, en
  los dos últimos casos, **dónde viven entonces las suites pgTAP del proyecto**.
- **Por qué es del operador.** `drop extension` y `alter extension … set schema` son **destructivos /
  de reubicación** sobre PROD, y la decisión tiene consecuencias sobre el mecanismo de verificación de
  todas las fases futuras. No es acto de agente.
- **Evidencia.** `OFF-6-01` (`Q-24`/`Q-24b`/`Q-24c`). Y la evidencia **nueva de esta fase**: las 7
  suites `supabase/tests/post-apply/007[3-9]_*.test.sql` que sostienen los veredictos de la Phase 124
  **corren contra la `pgtap` instalada en `public`**. Mover o dropear la extensión sin plan las deja
  sin ejecutar — incluidas las dos que hoy son la **prueba viva** de las deudas `0073` y `0075`.
- **Forma del fix.** Decisión + migración diseñada por `supabase-architect`, con el destino de las
  suites resuelto **antes** de tocar la extensión.
- **Qué desbloquea.** `OFF-6-01` y la ratificación de `OFF-6-02`. Y, junto con el pago de la deuda de
  `OFF-6-03`, **elimina la dependencia del mitigante-accidente `proargnames`**.
- **Destino nombrado.** **`supabase-architect` + checkpoint de operador.**
- **Quién lo cierra.** Operador (decisión) → `supabase-architect` (diseño y migración).

---

## 8. `OP-2` — Database Advisors + `DEBT.md`

- **Qué es.** Correr los Database Advisors de Supabase contra el remoto y reconciliar su salida con el
  mapeo Splinter de la Phase 123.
- **Por qué es del operador.** **No son invocables por SQL** desde la sesión (declarado en
  `123-SUPA-AUDIT.md` §0.6 B). Exigencia **nº5** del gate.
- **Evidencia.** Splinter **`0001`** (FKs sin índice), **`0003`** (`auth.*` sin `(select …)`),
  **`0005`**/**`0009`** (índices sin uso / duplicados) y **`0020`** (bloat) figuran en el audit como
  **«sin reclamar (deuda de `OP-2`)»** — nadie los tocó. También queda registrado el **escáner de
  secretos que grita 51 falsos positivos desde `.pnpm-store/`**, un control que *entrena a
  ignorarlo* — y un control que se ignora no es un control.
- **Forma del fix, aditiva.** Abrir `DEBT.md` con la deuda **no bloqueante**, un ítem por Splinter, con
  su evidencia y su forma de fix. Cero DDL.
- **Destino nombrado.** **Checkpoint de operador**, y de ahí a la **próxima auditoría de régimen**.
- **Quién lo cierra.** Operador (corre los Advisors) → agente (redacta `DEBT.md`).

---

## 9. `OP-3` — creación del bucket de Storage

- **Qué es.** La creación de un bucket de Supabase Storage (`crudo-servel`), si alguna vez se decide
  usarlo.
- **Por qué es del operador.** DDL/DML sobre `storage` ⇒ `deuda-operador` por vocabulario, **jamás
  acto de agente**.
- **Evidencia.** `Q-20` → **0 buckets** (cero **vacuo**). `Q-21` → **0 policies** sobre
  `storage.objects` (también cero vacuo).
- **Estado tras esta fase: DESBLOQUEADO.** `OFF-6-04` está **`CERRADO`** — el paso 2 del orden LOCKED
  se consumó **antes** de que exista bucket alguno, que era justo la condición que el gate exigía. Un
  bucket creado a partir de ahora **no nace con grants a `anon`/`authenticated` por default ACL**
  (`Q-10`: las 3 filas `postgres`/`storage` sin `anon=`; pgTAP `0074` 4 ok).
- **Advertencia que sigue viva y que esta fase NO cierra.** `Q-21` da **0 policies**. **El default ACL
  cerrado evita el grant automático; NO sustituye a la RLS.** Al crear el bucket, el operador debe
  escribir su **policy explícita** en la misma tanda, o el objeto queda gobernado por nada.
- **Destino nombrado.** **Checkpoint de operador.**
- **Quién lo cierra.** Operador, si y cuando se decida usar Storage.

---

## 10. `D-01` — deuda NUEVA de esta fase: re-medir `aportes` / `contratos` tras el flip de MONEY

- **Qué es.** Los techos de `LIMIT` de `aportes_de_parlamentario` y `contratos_de_parlamentario`
  (**20.000** cada uno, en `0079`) son **provisionales**: se fijaron sobre tablas **vacías**.
- **Evidencia (generada en esta fase, wave 6).** Medición sobre el dominio completo (los 186
  parlamentarios, 100 % de cobertura): máximo **0** filas para ambas. Corpus al medir: **`aporte = 0`**,
  **`contrato = 0`** — están vacías **por el gate MONEY, que está OFF**. `4 × 0 = 0` **no es un
  techo**. En consecuencia, las aserciones **(1)** y **(4)** del pgTAP `0079` son hoy **verdes pero
  VACUAS**, y **el propio mensaje del test lo declara** en vez de dejar que alguien las lea como
  prueba.
- **Forma del fix, aditiva.** El día del flip de MONEY: re-correr la medición `M-PARL` sobre el
  dominio completo, y si el máximo real supera **5.000**, re-derivar el techo con el criterio **≥4×**
  en una migración **nueva** (`create or replace` conservando `set statement_timeout = '5s'` —
  omitirlo lo borra en silencio) y reescribir las dos aserciones para que dejen de ser vacuas.
- **Destino nombrado.** **Checkpoint de operador — el mismo acto que el flip de MONEY.** No antes:
  medir sobre tablas vacías volvería a dar cero.
- **Quién lo cierra.** Operador (flip) → agente (re-medición + migración).

---

## 11-14. Los 4 huecos del gate marcados **"al régimen"**

El gate de la Phase 123 declaró **7 huecos**: 1 quedó cerrado en la propia fase (`PII_TABLES`), 2 son
checkpoints de operador (`OP-1` → hueco 6, `OP-2` → hueco 7, ya arriba), y **4 van "al régimen"** — es
decir, a la próxima auditoría, como **ampliación del universo auditado**. Son **auditoría, no fix**.

### 11. Hueco 2 — `pgmq`, `pg_cron` y la superficie de jobs

- **Qué es.** La superficie de jobs de ingesta no fue auditada en ningún eje de la Phase 123.
- **Evidencia (la del gate, citada).** El gate los revisó a mano: **5 jobs activos, todos SQL puro,
  cero secrets en `cron.job.command`** — y su veredicto es la frase que importa: *«Está limpio, pero
  **por suerte, no por auditoría**. Debe entrar al régimen»*. Corroborado hoy: `Q-22` da `cron|f|f` y
  `pgmq|f|f` (cerrados a roles públicos), y la wave 2 verificó 5/5 jobs `active` y 8/8 últimas
  corridas `succeeded` tras el intento de `0075`.
- **Forma del fix, aditiva.** Añadir un **eje de jobs** al manifiesto de la próxima auditoría: una
  query que enumere `cron.job` con su `command`, `nodename`, `username` y `active`, y una aserción de
  guard estática que trate como offender cualquier literal con forma de secreto en `cron.job.command`.
  Cero DDL.
- **Destino nombrado.** **Próxima auditoría de régimen.**
- **Quién lo cierra.** Agente auditor.

### 12. Hueco 3 — esquemas del proyecto fuera de `public`

- **Qué es.** El universo declarado de la Phase 123 era `public`; existen esquemas propios fuera
  (`util`, `actualidad`, `cruces`, `grafo`) que no se barrieron.
- **Evidencia (la del gate, citada).** *«Existe `util.host_throttle` fuera del barrido (RLS on, `anon`
  sin `USAGE` ⇒ no offender). **Que dé cero no borra que el universo declarado era incompleto**»*.
  Re-verificado hoy por `Q-22`: `util|f|f`, `actualidad|f|f`, `cruces|f|f`, `grafo|f|f` — los cuatro
  cerrados a roles públicos.
- **Forma del fix, aditiva.** Ampliar el `where n.nspname = 'public'` del manifiesto de queries a la
  lista completa de esquemas propios, y declarar el universo nuevo en el §Método de la próxima
  auditoría. Cero DDL.
- **Destino nombrado.** **Próxima auditoría de régimen.**
- **Quién lo cierra.** Agente auditor.

### 13. Hueco 4 — Edge Function `ingest-worker`

- **Qué es.** `verify_jwt`, CORS y manejo de secrets de la Edge Function `ingest-worker` **no fueron
  auditados en ningún eje**, pese a estar en `corpus.live_efs` del manifiesto de la Phase 123.
- **Evidencia (la del gate, citada).** Literal: *«`verify_jwt`, CORS y manejo de secrets **no
  auditados en ningún eje**, pese a estar en `corpus.live_efs` del manifiesto»*. Es el hueco de mayor
  severidad de los cuatro: una Edge Function con `verify_jwt = false` es una superficie pública
  **fuera del boundary de Postgres por completo** — ni RLS, ni grants, ni el guard la ven.
- **Forma del fix, aditiva.** Eje nuevo en la próxima auditoría: leer `supabase/config.toml` (o el
  `--no-verify-jwt` del deploy) por función, enumerar las cabeceras CORS emitidas y verificar que
  ningún secreto se lea desde el cliente. Aserción de guard estática sobre el repo. Cero DDL, cero
  deploy.
- **Destino nombrado.** **Próxima auditoría de régimen** — con prioridad **alta** dentro de ella.
- **Quién lo cierra.** Agente auditor.

### 14. Hueco 5 — `graphql_public` con `EXECUTE` para `anon` sobre `graphql.resolve`

- **Qué es.** `graphql_public` es un esquema **expuesto por PostgREST por diseño**, y `anon` tiene
  `EXECUTE` sobre `graphql.resolve`. Es una **segunda superficie de introspección**, distinta de la
  REST.
- **Evidencia (la del gate, citada).** *«enumerado en `Q-22` como "default de plataforma" y
  **despachado**. Segunda superficie de introspección, **no probada**»*. Confirmado hoy: `Q-22` da
  `graphql|t|t` y `graphql_public|t|t`; `Q-22b` muestra `anon=U` **explícito** en ambos (no es
  herencia de `PUBLIC`); y `Q-10` muestra que el default ACL de `supabase_admin` sobre `graphql` y
  `graphql_public` **concede `arwdDxtm`/`EXECUTE`/`rwU` a `anon`** — el mismo defecto que `OFF-01`, en
  otros dos esquemas, **fuera del alcance declarado de 123 y de 124**.
- **Forma del fix, aditiva.** Probar la superficie (query GraphQL de introspección con la anon key —
  se puede encadenar con `OP-1`, misma key, mismo momento) y, según resultado, evaluar
  `graphql.graphql_is_visible` / la desactivación de `pg_graphql` si el proyecto no lo usa. Auditar
  primero, decidir después.
- **Destino nombrado.** **Próxima auditoría de régimen** — y su probe puede **encadenarse a `OP-1`**,
  que ya requiere la anon key.
- **Quién lo cierra.** Agente auditor (probe) → operador (decisión si hay que desactivar algo).

---

## Anexo — las 4 discrepancias audit ↔ PROD halladas durante la Phase 124

No son ítems de handoff (ya están resueltas), pero salen nombradas porque **el patrón es la lección**,
y la próxima fase que consuma un audit debe partir de aquí. Detalle completo, con las consecuencias de
haberlas creído, en `124-SUPA-FIX.md` §Las cuatro transcripciones del audit que no cuadraron.

| # | wave | qué decía el audit | qué dice PROD | resuelto en |
|---|---|---|---|---|
| 1 | 03 | el ACL de las 8 fn exec-`anon` es solo `=X/postgres` | llevan **además** grant explícito a `service_role` — asertar `service_role=false` habría roto el **Camino A** | `0076` + aserción (E) reescrita |
| 2 | 04 | `OFF-4-03` = 18 funciones | contar "sin `statement_timeout`" da **29** (incluye las 11 acotadas por construcción); el pre-check original habría abortado siempre | `0077` con encuadre `13+18+11=42` |
| 3 | 05 | `f_unaccent` es la **única** de `public` sin `search_path`; techos 100/200 | quedan `match_proyectos` y `votos_de_parlamentario`, que **no deben** recibirlo; y 100/200 estaban **bajo la demanda viva** (1001/1000) | `0078`, techo **4000** adjudicado |
| 4 | 06 | `comparar_declaraciones` es clase AGREGADO | el `functiondef` vivo la desmiente: es clase **FILAS** (11 FILAS / 1 AGREGADO) | `0079` + `124-CARDINALIDAD-MEDIDA.md` |

**Precedente que la Phase 124 deja escrito:** *los números de un audit son hipótesis a verificar contra
PROD, no hechos*. Pre-check fail-closed **sobre el conjunto enumerado**, medición contra la DB viva
antes de escribir un valor, y **parar y escalar** cuando la medición contradice al audit.

---

## Cierre

**14 ítems, 14 destinos nombrados, 0 cerrados en silencio.**

Ningún ítem de este documento dice "más adelante". Cada uno dice **Phase 125** (solo como superficie
de verificación de síntoma, nunca como fix), **`supabase-architect`**, **checkpoint de operador**, o
**próxima auditoría de régimen** — y nombra a quién le toca.

Deliverable padre: **[`124-SUPA-FIX.md`](./124-SUPA-FIX.md)**.
