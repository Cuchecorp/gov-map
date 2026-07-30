---
fase: 123
subagente: supabase-reviewer
fecha: 2026-07-29
veredicto: APROBADO
matiz: "PASS CON RESERVAS — aprueba la AUDITORÍA; NO autoriza a la Phase 124 a aplicar nada hasta cumplir 3 precondiciones"
regimen: read-only por diseño (el subagente no aplica ni arregla nada; no escribió este archivo)
procedencia: "respuesta íntegra del subagente `supabase-reviewer`, transcrita VERBATIM por el plan 123-06"
---

# 123 — Veredicto del gate · subagente `supabase-reviewer`

> **Procedencia y régimen de transcripción.** El subagente `supabase-reviewer` es **read-only por
> diseño**: emitió su veredicto como mensaje y **no escribió este archivo**. El plan **123-06** lo
> persiste **verbatim**, atribuido, **sin reescribirlo, resumirlo ni suavizarlo**. Todo lo que sigue
> a la línea `--- INICIO DEL VEREDICTO VERBATIM ---` es palabra del subagente; lo único añadido es
> esta cabecera de procedencia y el frontmatter.
>
> **Este veredicto ES el gate de la Phase 123** (decisión LOCKED del `123-CONTEXT.md`), no una
> opinión consultiva.
>
> **Mapeo al vocabulario LOCKED del §0.1 del método:** el subagente emitió `PASS CON RESERVAS`. Se
> registra como `veredicto: APROBADO` **con el matiz textual en el frontmatter**, porque el propio
> cuerpo lo dice sin ambigüedad: *"Nada de lo hallado alcanza el umbral de BLOQUEO del Gate 2 hoy"*.
> Las **reservas no son decorativas**: son 3 precondiciones + 7 huecos + 5 exigencias que la Phase
> 124 debe cumplir **antes de aplicar nada**, y quedan ancladas en `123-SUPA-AUDIT.md`.
>
> **ÚNICA sustitución editorial del texto verbatim, declarada — RULE-1.** En el hueco nº 2 el
> subagente enumera los patrones que buscó en `cron.job.command` y escribe el **prefijo literal de
> cabecera JWT** como uno de ellos. Ese literal **muerde el grep anti-secreto** del `<verify>` de
> este plan (el mismo control que ya mordió al fragmento 03 por transcribir una fixture). Se
> reemplaza por la **clase sin valor** `<prefijo-JWT>`, marcada con `[›]` en el punto exacto. **No
> hay ninguna otra modificación**: ni una palabra más se toca, y el sentido del hallazgo —*cero
> secrets en `cron.job`*— queda intacto. El control funcionó sobre el archivo de auditoría, que es
> también superficie (mitigación T-123-22).

--- INICIO DEL VEREDICTO VERBATIM ---

## Veredicto global: PASS CON RESERVAS

La Phase 123 pasa el gate como auditoría (el trabajo es real, la evidencia es autoritativa y los ceros están calificados), pero no autoriza a la Phase 124 a aplicar nada todavía: hay 3 precondiciones y 4 huecos, uno de ellos con hallazgo nuevo mío contra la DB viva.

### Justificación por criterio

**Criterio 1 — Cobertura de los seis ejes: CUMPLE.** Los seis están recalculados contra PROD, ninguno se despachó con afirmación. El eje 5 se cierra con `Q-16`/`Q-17` sobre 28 secdef reales (denominador explícito), y el eje 6 es el único que hizo lo que casi ninguna auditoría hace: rompió su propia regla de método cuando la regla escondía la superficie (`§0.6 E` invocada para levantar el filtro `deptype='e'`). El barrido es del corpus completo (42/42, 57/57), no de subconjuntos.

**Criterio 2 — Autoridad de la evidencia: CUMPLE, y es lo mejor de la fase.**
- La evidencia de grants es `aclexplode(pg_class.relacl)` (`Q-08b`/`Q-09b`), y `information_schema.role_table_grants` queda declarada como contraste, no prueba — con la comprobación del supuesto ejecutada (`current_user = postgres`, miembro de `anon`/`authenticated`) y la conclusión correcta: la coincidencia de hoy es un accidente de privilegio, no una propiedad de la vista.
- La distinción cero-fuerte/cero-vacuo está aplicada donde importa: `Q-17` (0 de 28, fuerte) vs `Q-18` (0 vistas, vacuo) vs `Q-20` (0 buckets, vacuo). Splinter 0025 se declara inaplicable, no "resuelto".
- `Q-24c` prueba la exposición por ejecución (`set role anon; select public.pg_version()` → `17.6`), no por inferencia de ACL. Verifiqué el número independientemente: 1.079 funciones `pgtap` exec-`anon` en `public` — exacto, y 3 filas de `pg_default_acl` de `supabase_admin` sobre `public` con `anon=` — exacto.

**Criterio 3 — Clasificación de riesgo: CUMPLE CON UNA CORRECCIÓN Y UNA PRECISIÓN.**

**Criterio 4 — Extensión del guard: CUMPLE.** Confirmé 31 tests, `PUBLIC_EXTENSION_ALLOWLIST = {vector, unaccent}` (`:1226`) y `KNOWN_MISSING_REVOKE_FROM_PUBLIC` (`:1098`). La sonda de mutación sí es prueba suficiente: inyectó los tres vectores a disco, obtuvo 5 rojos con mensaje accionable, restauró y verificó `git diff --quiet -- supabase` = 0. Y el detalle que la hace creíble: la baseline (A5) muerde en las dos direcciones — se pone roja también cuando la deuda se paga, obligando a 124 a borrar la entrada. Los 4 `limite-declarado` (`LIM-05-01..04`) son honestos, no huecos disfrazados. El descarte de Direction-C está bien argumentado (Block A es superconjunto; un `⊆ allowlist` sería más débil y resucitaría la exención de Phase 51 que el proyecto ya revirtió).

### Clasificación de los 13 offenders

| # | offender | clasif. fase | mi clasif. | nota |
|---|---|---|---|---|
| OFF-01 | default ACL `supabase_admin` en `public` (r/f/S) | 124-aditivo | confirmo, sube a PRIMERO EN ORDEN | Verificado: 3 filas con `anon=`. Es el único mecanismo que reabre el boundary sin línea de código. Debe aplicarse antes que cualquier otra migración de 124. Prevengo: `postgres` no es superusuario (`rolsuper=f`, `Q-23`) ⇒ el `alter default privileges for role supabase_admin` probablemente falle. El escape a `deuda-operador` está bien escrito; exijo que 124 no lo trague en silencio. |
| OFF-02 | guard ciego a `alter default privileges` | guard | confirmo — CERRADO (A4) | |
| OFF-4-01 | `f_unaccent` exec-`anon` | 124-aditivo | confirmo, riesgo bajo | Escalar sin acceso a tablas. |
| OFF-4-02 | 7 funciones trigger con `EXECUTE TO PUBLIC` | 124-aditivo | confirmo, riesgo bajo-latente | La lectura ("hoy no explotable, un cambio de tipo de retorno lo vuelve explotable en silencio") es correcta. |
| OFF-4-03 | 17 RPCs sin `LIMIT`/`statement_timeout` | 124-aditivo | confirmo, y NO lo bajen | El dato de `pg_db_role_setting` (`anon`=3s, `authenticated`=8s, `service_role`= nada) agrava: la ruta que el sitio usa es la única sin techo. |
| OFF-4-04 | `subgrafo_red` fan-out sin cota | 124-aditivo | confirmo | |
| OFF-4-05 | Direction-B nunca mira grants | guard | confirmo — CERRADO (A5) | |
| OFF-5-01 | `f_unaccent` sin `search_path` | 124-aditivo | confirmo, menor | Splinter 0011 = 0/28, cero fuerte. |
| OFF-6-01 | `pgtap` en `public` | architect+checkpoint | confirmo el destino; CORRIJO la magnitud en ambas direcciones | Ver abajo. |
| OFF-6-02 | `vector`/`unaccent` en `public` | architect+checkpoint | confirmo, y suscribo "documentar, no mover" | Mover rompe tipos, HNSW y firmas. Cerrado por (A6) contra regresión. |
| OFF-6-03 | `net` con USAGE+EXECUTE para `anon` | 124-aditivo | confirmo, SUBE de severidad | Verifiqué: `net.http_get` y `net.http_post` = `EXECUTE` para `anon`. `pg_net` es infraestructura de `pg_cron`; ningún rol público lo necesita. Aplíquenlo en 124 sin esperar al architect. |
| OFF-6-04 | default ACL `postgres` en `storage` | 124-aditivo | confirmo; orden load-bearing | Cerrar antes de crear cualquier bucket. |
| OFF-6-05 | guard ciego a la superficie de plataforma | guard | confirmo — CERRADO (A6) + límites | |

**La corrección a OFF-6-01 (hallazgo del reviewer, en las dos direcciones).** La fase dice "1.079 funciones expuestas". A nivel de catálogo es exacto; a nivel de Data API está sobredimensionado, y el riesgo cualitativo está a la vez subestimado:
- PostgREST exige argumentos con nombre. Casi todo `pgtap` tiene `proargnames = NULL` ⇒ no invocable por `/rest/v1/rpc/`. Lo realmente alcanzable son ~33: 20 de cero argumentos (incl. `pg_version()` y `runtests()`) + 13 con nombre (`col_is_null(table_name,column_name,…)`, `col_not_null`, `diag`, `skip`, `todo`, `finish`, `_prokind`).
- De esas 33, dos son las que importan: `col_is_null`/`col_not_null` son un oráculo de enumeración de schema para un cliente `anon` (confirman existencia y nulabilidad de tabla+columna, incluidas las de PII); y `runtests()` sin argumentos ejecuta como `anon` todo lo que matchee `^test` en el `search_path` — ejecución no gobernada + DoS.
- Lo que NO es alcanzable por REST y conviene decir para no inflarlo: la familia `lives_ok`/`throws_ok`/`results_eq` ejecuta SQL arbitrario del llamador (verificado: `prosecdef = f`, exec-`anon` = true) y `anon` tiene `EXECUTE` sobre `net.http_post` ⇒ el encadenamiento `lives_ok('select net.http_post(…)')` sería SSRF real por la Data API. Está bloqueado hoy solo por el accidente de que `pgtap` no nombra sus argumentos. Es un mitigante frágil y no intencional. Esto refuerza que `pgtap` no puede quedarse en `public`, y refuerza OFF-6-03.

### Huecos: lo que la fase NO auditó y debió auditar

1. **Completitud de `PII_TABLES` — el hueco grave.** La fase demuestra que el guard es la única capa (§0.5, `Q-23`: `service_role.rolbypassrls = t`) y luego audita sus puntos ciegos de plataforma, pero nunca audita la cobertura de su propia lista de PII contra las 57 tablas. Hay 5 tablas con columnas de clase RUT fuera de `PII_TABLES` (`app/lib/lockdown-guard.test.ts:142`): `pii_contraparte_declaracion :: rut_contraparte` (literalmente prefijada `pii_` y no está en la lista), `contratista :: rut_proveedor`, `contrato :: rut_proveedor`, `declaracion_accion_derecho :: rut_juridica`, `declaracion_bien_inmueble :: es_su_domicilio`. Hoy ninguna se referencia desde `app/` (verificado), así que no hay fuga activa — pero un `.from("pii_contraparte_declaracion")` en el árbol público pasaría el guard en verde y expondría RUTs, con RLS bypassada por `service_role`. Es el modo de fallo que la fase declara como el más crítico, en el único eje donde no miró. Hallazgo bloqueante para 124.
2. **`pgmq`, `pg_cron` y la superficie de jobs.** No auditados. Los revisé yo: 5 jobs activos, todos SQL puro (`process-ingest-jobs`, `cleanup-net-http`, `*-materializar`), cero con `Bearer`/`Authorization`/`service_role`/`<prefijo-JWT>` [›] en `command` ⇒ sin fuga de key en `cron.job`, que es el leak clásico de Supabase. Está limpio, pero por suerte, no por auditoría. Debe entrar al régimen.
3. **Esquemas del proyecto fuera de `public`.** El corpus son las 57 de `public`; existe `util.host_throttle` fuera del barrido (RLS = on, `anon` sin `USAGE` ⇒ no offender). Que dé cero no borra que el universo declarado era incompleto.
4. **Edge Function `ingest-worker`**: `verify_jwt`, CORS y manejo de secrets no auditados en ningún eje, pese a estar en `corpus.live_efs` del manifiesto.
5. **`graphql_public` con `EXECUTE` para `anon` sobre `graphql.resolve`**: enumerado en `Q-22` como "default de plataforma" y despachado. Con cero grants probablemente devuelve un schema vacío, pero es una segunda superficie de introspección y no se probó.
6. **LIM-6-01/02 siguen abiertos y son resolubles.** La severidad real de OFF-6-01/6-03 depende de `pgrst.db_schemas`. Intenté cerrarlo: no hay `SUPABASE_ANON_KEY` en `.env` (buena higiene) y sin `apikey` PostgREST responde `401`. Se resuelve en 60 segundos con la anon key del dashboard.
7. **Splinter/Database Advisors no corridos** (declarado en §0.6 B, correctamente). Hay que correr los Advisors contra el remoto y reconciliar con el mapeo Splinter de la fase (0007/0010/0011/0013/0014/0025/0028/0029 ya reclamados por SQL; 0001/0003/0005/0009/0020 —FKs sin índice, `auth.*` sin `(select …)`, índices duplicados/sin uso, bloat— no los tocó nadie y son deuda, no bloqueo).

### Lo que exijo antes de que la Phase 124 aplique nada

1. **Cerrar el hueco de `PII_TABLES` primero, como extensión de guard (no como migración):** añadir `pii_contraparte_declaracion`, `contratista`, `contrato`, `declaracion_accion_derecho` a `PII_TABLES` + una aserción que falle si existe en el catálogo una tabla de `public` con columna que matchee `(rut|email|telefono|direccion)` y no esté cubierta. Es "guard primero" aplicado al único control efectivo del boundary.
2. **Probe REST con la anon key** (acto de operador, read-only) contra `/rest/v1/rpc/pg_version`, `/rest/v1/rpc/runtests` y `/rest/v1/rpc/col_is_null`. Si responden 200, `OFF-6-01` deja de ser "divulgación de estructura" y pasa a bloqueante de Gate 2: `alter extension pgtap set schema extensions` (o `drop extension` en PROD) con checkpoint de operador, decidiendo antes el destino de las suites pgTAP.
3. **Orden LOCKED de 124:** `OFF-01` (default ACL `supabase_admin`) y `OFF-6-04` (default ACL `storage`) antes de toda otra migración y antes de crear cualquier bucket. Con el escape a `deuda-operador` ejecutado y reportado, jamás con escalada de privilegio. `OFF-6-03` (revoke de `net` a roles públicos) en la misma tanda: corta la cadena SSRF aunque el mitigante de `proargnames` desaparezca.
4. **Al aplicar `OFF-4-01`**, borrar la entrada de `KNOWN_MISSING_REVOKE_FROM_PUBLIC` — el guard se pondrá rojo si no, y eso es el diseño.
5. **Correr los Database Advisors** y abrir `DEBT.md` con la deuda no-bloqueante: FKs sin índice (0001), índices sin uso/duplicados (0005/0009), `auth.*` sin `(select …)` (0003), bloat (0020), extensiones en `public` (0014, ya con dueño en `OFF-6-02`), el escáner de secretos que grita 51 falsos positivos desde `.pnpm-store/` (control que entrena a ignorarlo), y `B-01` (exactitud del cap de 1.000 en votos).

**Nada de lo hallado alcanza el umbral de BLOQUEO del Gate 2 hoy** (RLS 57/57, cero policies `to anon`, cero grants a `anon`, 0/28 secdef sin `search_path`, 0 secdef exec-`anon`, cero buckets, `.env` no versionado, cero secrets en `cron.job`). El PASS es con reservas por el hueco de `PII_TABLES` y por LIM-6-01, no por el estado del boundary diseñado.

--- FIN DEL VEREDICTO VERBATIM ---

## Estado de las exigencias al cierre de la Phase 123

Registro del plan 123-06 (**fuera** del texto verbatim). No modifica el veredicto: lo rastrea.

| exigencia | tipo | estado al cierre de 123 | dónde |
|---|---|---|---|
| **1** — cerrar el hueco de `PII_TABLES` como extensión de guard | **agente, en esta fase** (`guard primero`) | ✅ **CUMPLIDA** — `PII_TABLES` +4, aserción de completitud `(A7)` contra corpus congelado, mutation self-check en memoria y contra disco. Suite `app/` 1586 → **1590**, `lockdown-guard` 31 → **35**, `tsc --noEmit` exit 0, `git diff --quiet -- supabase` exit 0 | `app/lib/lockdown-guard.test.ts` (`PII_TABLES`, bloque `(A7)`) |
| **2** — probe REST con la anon key | **checkpoint de operador** (la anon key no está en `.env`, por higiene) | ⏸️ **PENDIENTE** — no es acto de agente; gatea la severidad de `OFF-6-01` y cierra `LIM-6-01`/`LIM-6-02` | `123-SUPA-AUDIT.md` §Checkpoints de operador |
| **3** — orden LOCKED de 124 (`OFF-01` y `OFF-6-04` primero; `OFF-6-03` en la misma tanda) | entrada a la Phase 124 | 📌 **ANCLADA** — escrita como orden LOCKED, no como sugerencia | `123-SUPA-AUDIT.md` §Backlog ordenado para la Phase 124 |
| **4** — al aplicar `OFF-4-01`, borrar la entrada de `KNOWN_MISSING_REVOKE_FROM_PUBLIC` | entrada a la Phase 124 | 📌 **ANCLADA** — el enganche es mecánico: la suite se pone roja si no se borra | `123-SUPA-AUDIT.md` §Backlog + `lockdown-guard.test.ts` (A5) |
| **5** — correr los Database Advisors y abrir `DEBT.md` | **checkpoint de operador** (no invocables por SQL, §0.6 B) | ⏸️ **PENDIENTE** — deuda no-bloqueante enumerada por el reviewer | `123-SUPA-AUDIT.md` §Checkpoints de operador |

**Adjudicación escrita sobre la quinta candidata del hueco nº1** (`declaracion_bien_inmueble ::
es_su_domicilio`): **EXCLUIDA con razón**, no omitida en silencio. Contra el catálogo vivo **no
matchea** la clase `(rut|email|telefono|direccion)` —contiene *domicilio*, no *dirección*— y es un
**booleano** de la declaración de patrimonio: indica si el inmueble declarado es el domicilio del
declarante, **no porta la dirección**. RULE-1: manda el catálogo. La adjudicación está escrita en el
propio guard (`PII_ADJUDICACION_EXCLUIDA`) y aserta que la fila **no** se cuela en el corpus.
