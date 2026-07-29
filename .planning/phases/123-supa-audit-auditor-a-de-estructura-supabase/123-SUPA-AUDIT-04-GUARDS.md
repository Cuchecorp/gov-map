---
fase: 123
fragmento: 04-guards
estado: borrador
fecha: 2026-07-29
ancla_temporal: "2026-07-29 (repo en master; guard corrido con vitest desde app/)"
ejes: [3, 4, 6]
producido_por: 123-05
consumido_por: [123-06]
metodo: 123-SUPA-AUDIT-00-METODO.md
---

# 123 — SUPA-AUDIT · Fragmento 04: extensión de guards ("guard primero")

> Régimen de este plan: **solo** se toca `app/lib/lockdown-guard.test.ts` y este fragmento.
> Cero DDL, cero DML, cero migración nueva, cero deploy, cero flag. `git diff --quiet -- supabase`
> sale 0. Los offenders de **estructura** siguen ruteados a la Phase 124.
>
> El guard corre en **CI sin acceso a la DB** (`ci.yml`: *"Sin secrets de DB: los guards son
> estáticos"*). Toda aserción de este plan es **estática sobre el texto de
> `supabase/migrations/*.sql`**. Ninguna consulta Postgres.

---

## Punto ciego

**Adjudicación: `Rama A` — hay punto ciego, y son TRES, no uno.**

Los tres fragmentos de la auditoría rutearon a `destino: guard` tres offenders distintos. Son el
**mismo defecto estructural visto desde tres ejes**: *el guard mira el texto del repo y la superficie
se abre por fuera del texto que el guard sabe leer.*

| punto ciego candidato | evidencia (fragmento §, Q-NN) | ¿confirmado? | acción |
|---|---|---|---|
| **OFF-02** — el guard es ciego a `alter default privileges … grant … to anon\|public\|authenticated` | Fragmento 01 §Eje 3, `Q-10` (30 filas): las tres filas `supabase_admin \| public \| {S,f,r}` conceden `arwdDxtm`/`X`/`rwU` a `anon` y `authenticated` sobre objetos **futuros**. `0044` revocó el default de `postgres` y **no** el de `supabase_admin`. `Q-09b` → `(0 filas)`: hoy inerte, mañana no | **sí** — el vector es real y **ninguna aserción lo nombra**. Ver §"coincidencia no es cobertura" | **Rama A · Bloque (A4)** |
| **OFF-4-05** — Direction-B solo mira **definiciones**, nunca **grants**; nada exige el `revoke execute … from public` que acompaña a una `create function` | Fragmento 02 §4b, `Q-15` + `comm -13` (8 filas): 8 funciones de `public` con ACL `=X/postgres` (= `EXECUTE TO PUBLIC`, default de Postgres jamás revocado) ⇒ exec-`anon` en la DB viva. `grep` de contraste sobre `supabase/migrations/` para sus revokes → `(0 filas)` | **sí** — es el defecto **exacto** que produjo `OFF-4-01` (`f_unaccent`) y `OFF-4-02` (las 7 trigger) | **Rama A · Bloque (A5)** |
| **OFF-6-05c** — el guard no ve la superficie de **extensiones** instaladas en `public` | Fragmento 03 §Eje 6, `Q-24`/`Q-24b`/`Q-24c`: `pgtap` vive en `public` con **1.079** funciones exec-`anon`, y la ejecución está **probada** (`set role anon; select public.pg_version()` → `17.6`), no inferida. La superficie `anon` real de `public` no es 8 funciones: son **1.209**. Ningún test se pone rojo por ello | **sí** — el filtro `deptype='e'` del método es correcto como regla y **ocultó exactamente esto** | **Rama A · Bloque (A6)** |
| Direction-C — «`grant execute … to anon` en migración ⊆ `PUBLIC_RPC_ALLOWLIST`» (candidato prioritario del plan) | Fragmento 02 §4b + `grep` de contraste (9 `grant execute … to anon` en `0011`–`0024`, todos revocados por `0044`/`0045`; `Q-12` → 34/34 `exec_anon = f`) | **NO — descartado con evidencia.** Ver §"Direction-C: por qué NO se implementa" | ninguna (cubierto por Block A, estrictamente más fuerte) |

### Coincidencia-de-hoy ≠ cobertura (criterio LOCKED aplicado)

Ninguna de las tres ramas A se activa porque la DB de hoy muestre filas. Se activan porque el
**vector** existe: una migración de la Phase 124 podría introducir cualquiera de los tres y pasar CI
**verde**. `Q-09b` sale `(0 filas)` y `OFF-02` sigue siendo punto ciego; los tres bloques nuevos
salen **verdes contra el repo de hoy** (salvo la baseline congelada de `f_unaccent`, §A5) y eso es lo
esperado de un guard anti-regresión: **verde hoy, rojo el día que alguien lo reintroduzca**.

### Direction-C: por qué NO se implementa (desviación RULE-1, evidencia manda)

El plan proponía como candidato prioritario exigir que todo `grant execute … to anon` extraído de las
migraciones fuera **subconjunto** de `PUBLIC_RPC_ALLOWLIST`. Se descartó por dos razones
independientes, ambas verificadas:

1. **Sería estrictamente más débil que el Block A que ya existe.** `anonGrantOffenders`
   (`lockdown-guard.test.ts:240`, ejercitado en `:322`) trata como offender **cualquier**
   `grant … to anon|public` en migraciones > 0044 — allowlisted **o no**. Su propio self-check lo
   afirma en el caso (a) `:378`: `grant execute on function public.rebeldias_de_parlamentario(text)
   to anon` es offender **aunque** `rebeldias_de_parlamentario` esté en `PUBLIC_RPC_ALLOWLIST`. Un
   chequeo `⊆ allowlist` **admitiría** ese grant. Añadirlo no cerraría nada y crearía la falsa
   impresión de que un grant allowlisted a `anon` es aceptable — que es justo la exención de Phase 51
   que el proyecto ya **revirtió** (CR-01/CR-03, documentado en `:226-236`).
2. **Aplicado repo-wide fallaría hoy con 9 falsos positivos.** Los `grant execute … to anon` de
   `0011`–`0024` existen en el texto y fueron **revocados después** por `0044`/`0045`; la DB viva da
   `exec_anon = f` para las nueve (`Q-12`). Plegar grant/revoke en orden de migración para evaluar el
   estado final declarado es posible en principio, pero reconstruiría un motor de ACL en regex sobre
   texto — frágil, y sin ganancia sobre el Block A.

**Además, `PUBLIC_RPC_ALLOWLIST` no gobierna a `anon`.** Lo dice su propio comentario
(`lockdown-guard.test.ts:180-182`): es la lista de RPCs que el árbol público puede llamar **con
`service_role`**. Confundir los dos sentidos es lo que hizo que el sentido A del fragmento 02 diera
"29 de 29 huérfanos" — una alarma total y falsa.

**Conclusión:** el vector queda cubierto por Block A, que es un **superconjunto** del chequeo
propuesto. La celda `¿?` de la tabla de cobertura se resuelve con esa línea, no con código nuevo.

---

## Tabla de cobertura de vectores

Un vector se considera cubierto solo si existe una **aserción estática** con su `archivo:línea`.
Las líneas son las del archivo **tras** esta extensión (las de los bloques preexistentes no se
movieron: la extensión es **aditiva y va al final del archivo**).

| vector | ¿aserción estática que lo cubre? | archivo:línea |
|--------|----------------------------------|---------------|
| `grant … to anon` sobre tabla en migración >0044 | Block A | `app/lib/lockdown-guard.test.ts:322` |
| `to authenticated` sobre tabla fuera de `USER_OWNED_TABLES` | Block D | `app/lib/lockdown-guard.test.ts:454` |
| `grant` sobre `notificacion_envio` a `authenticated` | Block E | `app/lib/lockdown-guard.test.ts:546` |
| entrada de allowlist sin función definida en migraciones | Direction-B | `app/lib/lockdown-guard.test.ts:614` |
| `.rpc()` del árbol público fuera de allowlist | Block B | `app/lib/lockdown-guard.test.ts:749` |
| `crossLinkReader("…")` fuera de allowlist | Direction-A3 | `app/lib/lockdown-guard.test.ts:694` |
| **`grant execute … to anon` en migración sin entrada en la allowlist** | **Block A — cobertura estrictamente MÁS FUERTE: prohíbe *todo* `grant … to anon\|public` en migraciones >0044, esté o no en la allowlist. El caso está ejercitado por fixture nombrado (`grant execute on function public.rebeldias_de_parlamentario(text) to anon` = offender **pese a** estar allowlisted). Ver §"Direction-C: por qué NO se implementa"** | `app/lib/lockdown-guard.test.ts:322` (scan real) + `:378` (fixture caso (a), RPC allowlisted) |
| **`alter default privileges … grant … to anon\|public\|authenticated` en migración >0044** (`OFF-02`) | **Bloque (A4) — NUEVO** | `app/lib/lockdown-guard.test.ts:939` (describe en `:932`, detector `alterDefaultPrivilegesOffenders` en `:919`) |
| **`create function` en `public` sin su `revoke execute … from public`** (`OFF-4-05`) | **Bloque (A5) — NUEVO** | `app/lib/lockdown-guard.test.ts:1119` (describe en `:1102`, detector `missingRevokeFromPublicOffenders` en `:1055`) |
| **`create extension` en `public` fuera de `{vector, unaccent}`** (`OFF-6-05c`) | **Bloque (A6) — NUEVO** | `app/lib/lockdown-guard.test.ts:1271` (describe en `:1256`, detector `publicExtensionOffenders` en `:1235`) |

**Ninguna celda queda en `¿?`.** Las tres últimas filas son el aporte de este plan.

---

## Los tres bloques nuevos

Reglas de construcción respetadas en los tres: reutilizan `stripSqlComments`, `migrationNumber` y
`MIGRATIONS_DIR` (cero duplicación de parsing); el detector es una **función pura** ejercitable en
memoria; el `describe` nombra bloque y fase; el mensaje de fallo nombra el offender y dice qué hacer;
la extensión es **aditiva** — cero renombres de constantes o describes preexistentes.

### (A4) `alter default privileges` — `OFF-02`

Detector `alterDefaultPrivilegesOffenders(strippedLowerSql)`: por sentencia (`split(";")`, mismo
idiom que `anonGrantOffenders`), es offender toda sentencia que contenga `alter default privileges`
**y** un `grant … to …` que nombre `anon`, `public` o `authenticated`.

`revoke` **no** matchea (no contiene `grant`) ⇒ las tres líneas legítimas de `0044`
(`alter default privileges … revoke all on tables from anon, authenticated`) no disparan — y además
`0044` no está en el rango `>0044`.

**Por qué no basta la coincidencia accidental.** Hoy `anonGrantOffenders` *incidentalmente* matchea
la variante `… grant select on tables to anon` (su regex solo exige `grant … to anon`), y
`authenticatedGrantOffenders` la variante `to authenticated` (extrayendo `tables` como "tabla" no
allowlisted). Eso es **coincidencia de regex, no cobertura**: el mensaje de fallo hablaría de "GRANT
a anon en una tabla" cuando el defecto real es un default-ACL sobre **objetos futuros**, y bastaría
una reescritura del regex de Block A (p. ej. anclar `grant` a principio de sentencia) para perderla
en silencio. El bloque (A4) **nombra el vector**, tiene su propio mensaje accionable y su propio
self-check.

**Baseline: verde.** `grep -rniE "alter +default +privileges" supabase/migrations/` solo devuelve
`0044` (líneas 75-78 y 175 son **comentarios**; 185-187 son `revoke`), `0045:12` y `0069:76`
(comentarios) — ninguna migración `>0044` usa el idiom `grant`.

### (A5) `create function` sin `revoke execute … from public` — `OFF-4-05`

Detector `missingRevokeFromPublicOffenders(migrations)`: recibe la lista **ya leída** de migraciones
`>0044` (`{ filename, sql }`, SQL stripeado y en minúscula) y, para cada
`create [or replace] function [public.]<nombre>(`, exige que **alguna** migración del conjunto
contenga un `revoke {all|execute} … on function [public.]<nombre>( … from … public`.

Decisiones de diseño, todas deliberadas:

- **Solo `public`.** Una `create function cruces.materializar_cruces()` (0052) o
  `actualidad.materializar_senales()` (0065) queda **fuera**: no viven en el esquema que PostgREST
  expone. Sin este filtro el bloque nacería rojo por dos falsos positivos.
- **El revoke puede vivir en la misma migración o en una posterior**, no solo en la misma. Es la
  única forma de que el fix aditivo de la Phase 124 (`0073+`) pueda **limpiar** la baseline sin
  reescribir `0055` — que este plan tiene prohibido tocar.
- **Baseline congelada, no exención muda.** Contra el repo real el detector devuelve **exactamente
  un** offender: `0055_busqueda_hibrida.sql: f_unaccent`. **Ese es `OFF-4-01`/`OFF-5-01`**, la única
  función de `public` invocable por `anon` vía `/rest/v1/rpc/f_unaccent` (`Q-15`, ACL `=X/postgres`).
  En vez de silenciarlo, el bloque asserta que el conjunto de offenders es **igual** a la constante
  `KNOWN_MISSING_REVOKE_FROM_PUBLIC = ["0055_busqueda_hibrida.sql: f_unaccent"]`. El assert muerde en
  **ambas** direcciones:
  - si una migración futura crea una función de `public` sin su revoke ⇒ **rojo** (regresión);
  - si la Phase 124 añade `revoke execute on function public.f_unaccent(text) from public` ⇒ **rojo**
    también, obligando a **borrar la entrada** de la baseline y dejando constancia de que la deuda se
    pagó. Una baseline que se limpia sola es una baseline que se olvida.

  **El detector no está exento de nada:** el `f_unaccent` real lo caza contra el repo real. La
  baseline es la resta explícita, no un carve-out dentro del detector.

### (A6) allowlist de extensiones en `public` — `OFF-6-05c`

Detector `extensionOffenders(strippedLowerSql)`: por sentencia, toda
`create extension [if not exists] <nombre>` cuya cláusula `schema` esté **ausente** (⇒ resuelve a
`public` por `search_path`) o sea explícitamente `public`, y cuyo `<nombre>` no esté en
`PUBLIC_EXTENSION_ALLOWLIST = {vector, unaccent}`.

- `vector` sostiene el tipo de columna de `proyecto_embedding` y el índice HNSW; `unaccent` es la
  base de `f_unaccent` y del FTS. Son `OFF-6-02`: **no se mueven** (mover el esquema rompería tipos,
  índices y firmas). Se allowlistean como **excepción documentada**, que es lo que el fragmento 03
  recomienda.
- **Scope `>0044`**, igual que Block A/D/E. `0001_extensions.sql` instala `pg_cron`, `pg_net` y
  `pgmq` en `public` — son **pre-lockdown** e infraestructura de plataforma; `pg_net` ya está
  ruteada como `OFF-6-03` (`124-aditivo`). Un scope repo-wide nacería rojo por historia congelada,
  que es exactamente la trampa de polaridad que `check_drift.sh` demostró con sus 714 falsos
  positivos.
- **Baseline: verde.** La única `create extension` en `>0044` es
  `0055_busqueda_hibrida.sql:21: create extension if not exists unaccent;` — allowlisted.

---

## Límites declarados (lo que esta extensión NO puede cubrir)

Se escriben porque fingir cobertura es peor que no tenerla.

| # | vector | por qué no es cubrible estáticamente | quién lo cierra |
|---|---|---|---|
| LIM-05-01 | El **ACL vivo** del default de `supabase_admin` sobre `public` (`Q-10`) | No proviene de ninguna migración del proyecto: es bootstrap de la plataforma. No hay texto en el repo que leer | `OFF-01` → Phase **124** (o `deuda-operador` si falla por membresía — **jamás se escala privilegio**) |
| LIM-05-02 | Las **1.209** funciones de extensión exec-`anon` ya instaladas en `public` (`pgtap` 1.079, `vector` 118, `unaccent` 4; `Q-24b`) | Ninguna se instala desde una migración del repo. (A6) impide que **una nueva** entre por migración; no ve las que ya están | `OFF-6-01`/`OFF-6-02` → `supabase-architect+checkpoint` |
| LIM-05-03 | El `USAGE TO PUBLIC` sobre `public` y sobre `net` (`Q-22b`, `Q-11`) | Mismo motivo: catálogo vivo, sin origen en el repo | `OFF-6-03` → Phase **124** |
| LIM-05-04 | El `EXECUTE TO PUBLIC` **ya materializado** sobre las 8 funciones de `Q-15` | (A5) impide la **regresión futura** y congela la deuda de `f_unaccent` en una baseline visible; no revoca nada | `OFF-4-01`/`OFF-4-02` → Phase **124** |

**Regla rectora, repetida del fragmento 03:** extender el guard **no cierra** los offenders
existentes; **impide la regresión futura**. Los dos son necesarios y ninguno sustituye al otro.

---

## Suite y guards verdes

Comando real del proyecto (resuelto desde `app/package.json`: `"test": "vitest run"`; el root no
define un `test` que agregue `app/`), ejecutado con `cwd = app/`:

```
$ pnpm --filter ./app exec vitest run lib/lockdown-guard.test.ts
 ✓ lib/lockdown-guard.test.ts (31 tests)
 Test Files  1 passed (1)
      Tests  31 passed (31)

$ pnpm --filter ./app test
 Test Files  107 passed (107)
      Tests  1586 passed (1586)

$ pnpm --filter ./app exec tsc --noEmit
(exit 0, sin salida)
```

| métrica | antes | después |
|---|---|---|
| aserciones de `lockdown-guard.test.ts` | **22** | **31** |
| suite completa de `app/` | **1577** | **1586** |

Referencia previa (fragmento 01 §"Contraste guard estático vs DB viva", ancla `2026-07-29`):
`lockdown-guard` **22/22**, suite de `app/` **107 archivos / 1577 tests**. El total posterior debe ser
`>= 1577`; una bajada sería regresión.

---

## Mutation self-check: la demostración de que MUERDE

Los tres bloques ejercitan el **detector real** (el mismo objeto de función que usa el scan de disco)
sobre fixtures **en memoria** — sin escribir archivos ni tocar `supabase/migrations/`. Afirmar que un
guard muerde no vale; se demuestra.

| bloque | (a) fixture POSITIVO ⇒ offender | (b) fixture NEGATIVO ⇒ 0 offenders | (c) fixture COMENTARIO ⇒ 0 offenders |
|---|---|---|---|
| **(A4)** | `alter default privileges in schema public grant select on tables to anon;` (+ variantes `to public`, `to authenticated`, `on functions`) | `alter default privileges … revoke all on tables from anon, authenticated;` y `… grant … to service_role;` | `-- alter default privileges … grant select on tables to anon` |
| **(A5)** | migración sintética con `create function public.nueva_fn(text)` **sin** revoke | la misma **con** `revoke execute on function public.nueva_fn(text) from public;` — y una `create function otro_schema.x()` (fuera de `public`) | el `create function` dentro de `-- …` |
| **(A6)** | `create extension pgtap;` y `create extension pg_net schema public;` | `create extension if not exists unaccent;`, `create extension vector;` y `create extension pgtap schema extensions;` | `-- create extension pgtap;` |

El fixture (c) prueba dos cosas a la vez: que `stripSqlComments` está en el camino del detector, y que
**la prosa de un header de migración no auto-invalida el guard** — el modo de fallo que ya mordió a
este proyecto (la inversión de polaridad de `check_drift.sh`, 139 falsos positivos por buscar la
cadena literal `supabase db push` que aparece en la frase **`NUNCA supabase db push`**).

Además, la baseline de (A5) es en sí misma una prueba de mordida **contra el repo real, no contra un
fixture**: el detector encuentra `f_unaccent` en `0055`, que es exactamente el offender que la
auditoría halló en la DB viva por otra vía (`Q-15`, ACL `=X/postgres`). Guard estático y catálogo
vivo convergen en el mismo nombre.

---

## Lo que este plan NO hizo

- **Cero migraciones.** `git diff --quiet -- supabase` sale **0**. No se creó `0073` ni se editó
  ninguna existente — ni siquiera `0055`, pese a que aloja el único offender real de (A5).
- **Cero DDL / DML.** No se ejecutó una sola sentencia contra PROD ni contra local. Este plan no
  abrió una conexión a Postgres: toda su evidencia es el texto del repo y las salidas ya transcritas
  en los fragmentos 01-03.
- **Cero deploy.** Ni build de OpenNext, ni `wrangler`, ni publicación.
- **Cero flags.** `CLASIFICACION_ESCALERA`, `MONEY`, `VSIM`, `NOTIF` y `CRUCES_PUBLIC_ENABLED` quedan
  exactamente como estaban; los guards anti-flip siguen verdes.
- **Cero fixes de estructura.** `OFF-01`, `OFF-4-01`..`OFF-4-04`, `OFF-5-01`, `OFF-6-01`..`OFF-6-04`
  **siguen ruteados** a la Phase 124 (`124-aditivo`) o a `supabase-architect+checkpoint`. Este plan
  solo puso la red debajo.

---

## Qué hereda 123-06

1. **Los tres offenders de `destino: guard` quedan CERRADOS**: `OFF-02` (A4), `OFF-4-05` (A5),
   `OFF-6-05c` (A6). Los tres con self-check de mordida.
2. **Direction-C se descarta con evidencia**, no por omisión: Block A es un superconjunto. Si 123-06
   quiere dejarlo escrito en el veredicto, la razón está en §"Direction-C: por qué NO se implementa".
3. **Cuatro `limite-declarado` nuevos** (`LIM-05-01`..`04`): la mitad viva del boundary **no** la
   cierra ningún guard estático. El veredicto de la fase no debe leer "guard extendido" como
   "boundary cerrado".
4. **Una deuda ahora VISIBLE en CI**: `KNOWN_MISSING_REVOKE_FROM_PUBLIC = {0055: f_unaccent}`. La
   Phase 124, al aplicar `OFF-4-01`, **debe** borrar esa entrada o la suite se pone roja. Es el
   enganche mecánico entre esta fase y la siguiente.
