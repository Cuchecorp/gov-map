---
phase: 125-e2e-pasada-final-producto-a-producto
plan: 04
fecha: 2026-07-29
version_desplegada: 0ea5d97f-a172-436e-aad0-add95940ee0e
commit_bundle: b4882e9
worker: observatorio-congreso
url: https://observatorio-congreso.thevalis.workers.dev
gates_observados: { NET: ON, CRUCES: ON, VSIM: ON, MONEY: OFF, NOTIF: OFF }
flips_ejecutados: 0
---

# 125-E2E-C-GATES — Estado de los 5 gates sobre el deploy `0ea5d97f`

Verificación **de ausencia** sobre el deploy nuevo. Régimen de este artefacto: **cada control de
ausencia va apareado con un control positivo** que demuestra que el mismo comando *sabría* dar
positivo. Un `0` sin control positivo no es evidencia — es ruido (lección `125-01` §3.2).

**VERSIÓN AUDITADA: `0ea5d97f-a172-436e-aad0-add95940ee0e`** (leída de `125-DEPLOY-RUNBOOK.md` §2)
· commit del bundle `b4882e9` · medido 2026-07-29.

Requests `curl` **secuenciales, 1 s entre cada uno**, User-Agent identificatorio, contra el Worker
propio. **Cero** requests a fuentes gubernamentales. **Cero** navegación a `/admin/revisar-entidades`
(fila EXCLUIDA por decisión LOCKED). Cero DDL/DML. Cero `wrangler secret put`.

---

## §0 Precondición de frescura — BLOQUEANTE, y aprobada

`depends_on` garantiza orden, no frescura. Aquí importa el doble: **un 404 de gate y un 404 de
"deploy a medias" son indistinguibles**, así que sin un marcador **positivo** previo, un deploy roto
se leería como "MONEY correctamente OFF".

| # | control | comando | resultado | veredicto |
|---|---|---|---|:---:|
| 1 | uuid declarado en el runbook | lectura de `125-DEPLOY-RUNBOOK.md` §2 | `0ea5d97f-a172-436e-aad0-add95940ee0e` | ✓ |
| 2 | `/proyecto/14309-04` responde | `curl -s -o … -w "%{http_code}"` | **200**, 1.278.386 bytes | ✓ |
| 3 | **marcador positivo** `3,8` (fix de 122) | `tr -d '\r' < proyecto.html \| grep -o '3,8' \| wc -l` | **2** | ✓ |

Contexto verbatim del marcador (prueba que es la línea de cobertura lobby↔PL, no un `3,8` casual):

```
audiencias registradas con parlamentario identificado y materia publicada citan el número de un
boletín en su materia (3,8 %), según fuente al 29 jul 2026. Est…
```

Coincide con `125-DEPLOY-RUNBOOK.md` §3.3 (`3,8 %` **y** `29 jul 2026`). ⇒ **El deploy auditado es el
nuevo.** Desde aquí, un 404 sí puede contar como evidencia de gate.

### §0.1 Gotcha 1 re-confirmado en vivo, sobre el propio marcador

El HTML del Worker es **una sola línea** (`wc -l` = 1) ⇒ `grep -c` cuenta líneas y topa en 1.

| comando | salida |
|---|---:|
| `grep -o '3,8' \| wc -l` (**correcto**) | **2** |
| `grep -c '3,8'` (**inservible**) | 1 |

Todas las cifras de este artefacto usan `grep -o … | wc -l`.

### §0.2 Gotcha NUEVO (pagado aquí) — `grep -i` + `-F` devuelve 0 SIEMPRE

Hallazgo de método propio de este plan, y **el más peligroso para un plan de ausencia**: en el
`grep` de este entorno (**GNU grep 3.0**, Git Bash/MSYS2), combinar `-i` con `-F` produce **0
coincidencias incluso sobre un positivo sembrado**.

Se detectó porque un control positivo **falló**: `grep -oiF 'suscripciones'` sobre `/cuenta` dio `0`
cuando el copy estaba a la vista. Matriz sobre la cadena sembrada `xx SUSCRIPCIONES yy suscripciones zz`:

| comando | salida | válido |
|---|---:|:---:|
| `grep -oF 'suscripciones'` | 1 | ✓ |
| `grep -o 'suscripciones'` | 1 | ✓ |
| `grep -oi 'suscripciones'` | 2 | ✓ |
| `grep -oiF 'suscripciones'` | **0** | ✗ **falso cero** |
| `grep -o -i -F 'suscripciones'` | **0** | ✗ **falso cero** |
| `grep -oiE 'captura'` | 2 | ✓ |

**Regla para 125-02 … 125-07:** **jamás combinar `-i` con `-F`.** Usar `-oF` (case-sensitive) o
`-oi`/`-oiE` (case-insensitive, BRE/ERE). En este artefacto una única celda quedó contaminada por
`-oiF` y fue **recalculada con `-oi`** (§2.3); todas las demás tablas usaron `-oF` desde el principio
y son válidas.

### §0.3 Gotcha NUEVO (2) — `set -o pipefail` + `grep -q` fabrica falsos negativos

Detectado en el **self-check** de este propio plan, que reportó `MISSING: 873f602` para un commit que
**existe**. Causa: `grep -q` cierra el pipe en la primera coincidencia → `git log` muere por **SIGPIPE**
→ con `pipefail` la tubería completa sale **141** (`128+13`), y el `&&` no dispara.

| forma | exit | veredicto |
|---|---:|:---:|
| `set -o pipefail; git log --oneline --all \| grep -q <hash>` | **141** | ✗ **falso negativo** |
| `git log --oneline --all \| grep -q <hash>` (sin pipefail) | 0 | ✓ |
| `git cat-file -t <hash>` | 0 | ✓ **robusto, sin tubería** |

**Regla:** para comprobar existencia de un commit usar `git cat-file -t <hash>`, nunca `git log | grep -q`
bajo `pipefail`. **Ninguna cifra de este artefacto está afectada**: todas las mediciones usan
`grep -o … | wc -l` (que consume el stream completo y no provoca SIGPIPE), no `grep -q`.

Los gotchas 3 (`<!-- -->` intercalado), 4 (Suspense `<div hidden>`) y 5 (backtracking) también se
respetaron: los greps corren sobre el **archivo completo** —lo que **incluye** los `<div hidden id="S:n">`
y el payload RSC— y ninguna ventana de contexto excede `.{0,300}`.

---

## §1 Tabla final de los 5 gates

| gate | estado | mecanismo | evidencia (comando → salida) |
|---|:---:|---|---|
| **MONEY** | **OFF** | `app/lib/money-gate.ts` · `moneyPublicEnabled` como **primera sentencia** de `app/app/contraparte/[id]/page.tsx:50-52` | secret **AUSENTE** en `wrangler secret list`; `/contraparte/<id>` → **404** en **3** ids; **14** discriminantes de payload/copy MONEY → **0** en **5** rutas (§2.2) |
| **NOTIF** | **OFF** (ausente = OFF) | gate-primero `e7d588a` (v10.0) en `/cuenta` y `/notificaciones/*` | secret **AUSENTE**; `/cuenta` → **200** con copy gated verbatim (**no 500**); `/notificaciones/{baja,confirmar}` → **200** inertes; `Seguir`/`Suscrib`/`notificac` → **0** en 3 rutas (§2.3) |
| **CRUCES** | **ON** | `app/lib/cruces-gate.ts` | secret presente; `grep -oF 'id="cruces"'` → **1** en `/parlamentario/D1165` y **1** en `/proyecto/14309-04` |
| **NET** | **ON** | `app/lib/net-gate.ts` | secret presente; `/red?seed=D1165` → **200**, 1.636.624 bytes con `nodos`+`aristas` poblados y 2 `<svg>`; `id="relaciones"` → **1** en la ficha |
| **VSIM** | **ON** | `app/lib/vsim-gate.ts` | secret presente; `/comparar?a=D1170&b=D1165` (**mismo-cámara**) → `Coinciden en` **2** con `3655 de 3672 votaciones compartidas (100%)` (§3.3) |

`wrangler secret list` (ejecutado en **modo lectura**, devuelve **sólo nombres** — ningún valor se
imprimió ni se conoce; binario de AppData porque el `wrangler` del PATH es el paquete Python de
miniconda que lo sombrea):

| secret | estado |
|---|---|
| `CRUCES_PUBLIC_ENABLED`, `NET_PUBLIC_ENABLED`, `VSIM_PUBLIC_ENABLED` | presentes (**ON**) |
| `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `GEMINI_API_KEY` | presentes (runtime, no son flags) |
| `MONEY_PUBLIC_ENABLED` | **AUSENTE = OFF** ✓ |
| `NOTIF_PUBLIC_ENABLED` | **AUSENTE = OFF** ✓ |

Idéntico a `125-DEPLOY-RUNBOOK.md` §2.3 ⇒ **nada se movió entre el deploy y esta medición.**

---

## §2 MONEY — OFF y ausente del DOM

### §2.1 La ruta gated 404ea, y 404ea *igual* para cualquier id

| id probado | HTTP | bytes |
|---|:---:|---:|
| `/contraparte/S1338` | **404** | 15.664 |
| `/contraparte/D1165` | **404** | 15.664 |
| `/contraparte/zzz-inexistente-999` | **404** | 15.692 |

Ningún id es un RUT: dos son identificadores públicos de parlamentario y el tercero es un
**placeholder sintético**. Cero PII.

**Prueba de que el 404 es del gate y no de "id no encontrado":** normalizando el id, las respuestas
de `S1338` y `D1165` son **byte-idénticas**:

```bash
norm(){ tr -d '\r' < "$1" | sed -e 's/S1338/__ID__/g' -e 's/D1165/__ID__/g'; }
diff <(norm cp_s1338.html) <(norm cp_d1165.html)   # → sin diferencias
```

Contra `zzz-inexistente-999` quedan **8** líneas de diferencia, y son **enteramente** el corrimiento
de los límites de chunk del stream RSC (`self.__next_f.push` parte en otro byte porque el id tiene
otra longitud). **Cero** diferencia semántica: el copy renderizado es el mismo en los tres.

Copy de `not-found` (**E-050**, `app/app/contraparte/[id]/not-found.tsx`) — 1 ocurrencia de cada
literal en los **3** ids:

> **Contraparte no encontrada**
> No encontramos esta página. Es posible que el identificador sea incorrecto.
> Volver al inicio

### §2.2 Discriminantes MONEY → 0 en 5 rutas, cada uno con control positivo

Alcance declarado: `grep -oF <patrón>` sobre el **archivo HTML completo** de cada ruta — incluye el
markup renderizado, los `<div hidden id="S:n">` de Suspense **y** el payload RSC de
`self.__next_f.push`. Case-**sensitive** (`-F` sin `-i`, por §0.2).

| patrón | `/parlamentario/D1165` | `/parlamentario/S1338` | `/` | `/comparar` | `/parlamentarios` | control positivo sembrado |
|---|---:|---:|---:|---:|---:|:---:|
| `href="/contraparte/` | 0 | 0 | 0 | 0 | 0 | 1 ✓ |
| `mercadopublico` | 0 | 0 | 0 | 0 | 0 | 1 ✓ |
| `servel.cl` | 0 | 0 | 0 | 0 | 0 | 1 ✓ |
| `ChileCompra` | 0 | 0 | 0 | 0 | 0 | 1 ✓ |
| `Aportes` | 0 | 0 | 0 | 0 | 0 | 1 ✓ |
| `Contratos del Estado` | 0 | 0 | 0 | 0 | 0 | 1 ✓ |
| `la fuente cubre hasta el` | 0 | 0 | 0 | 0 | 0 | 1 ✓ |
| `fecha_aporte` | 0 | 0 | 0 | 0 | 0 | 1 ✓ |
| `fecha_oc` | 0 | 0 | 0 | 0 | 0 | 1 ✓ |
| `aportes_de_parlamentario` | 0 | 0 | 0 | 0 | 0 | 1 ✓ |
| `contratos_de_parlamentario` | 0 | 0 | 0 | 0 | 0 | 1 ✓ |
| `agregado_por_contraparte` | 0 | 0 | 0 | 0 | 0 | 1 ✓ |
| `Monto total` | 0 | 0 | 0 | 0 | 0 | 1 ✓ |
| `Orden de compra` | 0 | 0 | 0 | 0 | 0 | 1 ✓ |

**Control positivo por archivo** (prueba que cada HTML se leyó y es grepeable — un `0` por archivo
vacío o mal descargado sería indistinguible de un `0` por ausencia real):
`grep -oF 'Observatorio'` → **188** / **8** / **8** / **8** / **8** respectivamente. Los cinco archivos
responden.

⇒ **Cero** links a `/contraparte/[id]`, **cero** links externos a mercadopublico/servel, **cero**
nombres de RPC de dinero, **cero** montos, **cero** fechas de esos bloques. Los emisores **E-013,
E-014, E-015, E-016, E-060** están `no emitidos en el deploy auditado`, tal como declara
`113-INVENTARIO.md` §5.

### §2.3 DESVIACIÓN RULE-1 — el criterio `Financiamiento → 0` es falso, y su propio `read_first` lo dice

El plan pedía que **`Financiamiento`** diera **0**. **Da 6 en `/parlamentario/D1165` y 4 en
`/parlamentario/S1338`.** Se investigó antes de concluir nada, y el resultado **confirma** MONEY OFF
en lugar de contradecirlo:

| # hits | qué es en realidad | ¿es fuga de MONEY? |
|---:|---|:---:|
| 4 (D1165) · 3 (S1338) | el **placeholder del gate**: `<section id="financiamiento-pendiente" class="mt-12 opacity-60">` → `<h2>Financiamiento y contratos del Estado</h2>` + `<p>Pendiente de revisión legal (Ley 21.719) antes de publicarse.</p>`, más su ítem de rail `Financiamiento y contratos` con `count: "pendiente"` (aparece 2× cada uno: markup + payload RSC) | **NO** — es el copy *de que no hay datos* |
| 2 (D1165) | dato **real de lobby**, ajeno a MONEY: `Asunto: Financiamiento SENDA para programas de tratamiento, adicciones con jóvenes que han infringido la ley` (reunión del 14 oct 2024) | **NO** — materia de audiencia |

`113-INVENTARIO.md` §5, que es `read_first` de este mismo plan, **ya documentaba el placeholder
palabra por palabra**: «la ficha emite en su lugar `<section id="financiamiento-pendiente" class="mt-12 opacity-60">`
con el rótulo "Financiamiento y contratos" y `count: "pendiente"`». El criterio del plan contradecía
su propia fuente.

**Resolución (RULE-1, la realidad manda):** el criterio se **sustituye**, no se relaja. La intención
—«ningún bloque MONEY aparece en el DOM»— se prueba con los **14 discriminantes** de §2.2, que son
exactamente los que el inventario define como señal de emisión (links a `/contraparte/`, links a
mercadopublico/servel, fechas y montos de esos bloques). Los 14 dan **0**. El patrón `Financiamiento`
queda **descartado como control**: es un falso positivo estructural, porque el propio texto del gate
OFF contiene la palabra.

**Antes / después del criterio:**

| | criterio | resultado |
|---|---|:---:|
| antes (plan) | `Financiamiento` → 0 | **falla** (6 / 4) — control inválido |
| después (RULE-1) | 14 discriminantes de emisión MONEY → 0 | **pasa** (0 en 5 rutas) |

### §2.4 Nota de honestidad — F-08 de 117 NO es observable aquí

Con MONEY **OFF**, el fix **F-08** de `117-DISPOSICION.md` (copy de dinero corregido a
`la fuente cubre hasta el …`, con `corte al` eliminado) **no puede verificarse contra dato real**:
los bloques que lo renderizarían no se emiten. Se registra que `la fuente cubre hasta el` da **0** en
las 5 rutas **por ausencia del bloque**, no por ausencia del fix. Esto **ya venía declarado** en
117 §2(d). **F-08 no se afirma verificado.** Su verificación queda pendiente del flip de MONEY, que es
deuda de operador y está fuera del alcance de la Phase 125.

---

## §3 NOTIF — OFF e inerte

### §3.1 `/cuenta` → 200, no 500: la regresión de v10.0 queda descartada

| ruta | HTTP | bytes |
|---|:---:|---:|
| `/cuenta` | **200** | 18.104 |
| `/notificaciones/baja` | **200** | 18.789 |
| `/notificaciones/confirmar` | **200** | 18.827 |

Copy gated de `/cuenta`, **verbatim** del DOM servido:

```html
<h1 ...>Tu cuenta</h1><p class="text-sm text-muted-foreground">Las suscripciones no están
disponibles en este momento.</p></main>
```

Coincide literalmente con el criterio de `104-DEPLOY-RUNBOOK.md` §"Verificación post-deploy #2".
**El 500 histórico que motivó el gate-primero `e7d588a` NO reaparece.** Cero hallazgo, cero escalación.

### §3.2 `/notificaciones/*` sin token — cero tokens inventados

Ambas rutas se probaron **sin token**, como manda el régimen LOCKED del inventario (§4.13/§4.14).
**No se inventó, adivinó ni construyó ningún token.** Responden **200** con copy inerte:

- `/notificaciones/baja` → **Enlace no válido** · «Este enlace de baja no es válido o ya se usó. Si sigues recibiendo correos, escríbenos.»
- `/notificaciones/confirmar` → **Enlace no válido** · «Este enlace de confirmación no es válido o ya expiró. Vuelve a tu cuenta e intenta seguirlo de nuevo.»

Ambas degradan a un 200 informativo — nunca a 500 ni a un estado que revele si un token existiría.

### §3.3 «Seguir» ausente, con el control positivo que hizo falta

Recuento con `grep -oi` (no `-oiF`, por §0.2):

| ruta | `seguir` | `Seguirlo` | `Suscrib` | `notificac` |
|---|---:|---:|---:|---:|
| `/` | **0** | 0 | 0 | **0** |
| `/parlamentario/D1165` | **0** | 0 | 0 | **0** |
| `/proyecto/14309-04` | **0** | 0 | 0 | **0** |

Ajuste declarado: se midió `seguir` **case-insensitive** (más ancho que el `Seguir` del plan, para no
perder `seguirlo`/`seguir` en minúscula) y además la familia `Suscrib`/`notificac`. Los cuatro dan 0.
No hizo falta acotar con límites de palabra porque no hubo ni una ocurrencia.

**Control positivo apareado** (sin él estos `0` no valdrían):

| control | comando | salida |
|---|---|---:|
| el idiom NOTIF **sí** se detecta donde existe | `grep -oi 'suscrip'` sobre `/cuenta` | **2** ✓ |
| patrón `Seguir` sembrado | `printf 'aa Seguir bb' \| grep -oF 'Seguir'` | 1 ✓ |
| patrón `Suscrib` sembrado | `printf 'aa Suscribirse bb' \| grep -oF 'Suscrib'` | 1 ✓ |

Es decir: el mismo comando que da **0** en las 3 rutas da **2** en `/cuenta`. La ausencia es real, no
un artefacto de medición.

---

## §4 NET, CRUCES y VSIM — estado observado

### §4.1 CRUCES ON

`grep -oF 'id="cruces"'` → **1** en `/parlamentario/D1165` y **1** en `/proyecto/14309-04`.
Rail completo de la ficha (`<section id="…">`, 1 vez cada una):
`cruces`, `financiamiento-pendiente`, `lobby`, `militancias`, `patrimonio`, `relaciones`, `votos`.

### §4.2 NET ON

`/red?seed=D1165` → **200**, 1.636.624 bytes. No es una cáscara: el payload trae grafo poblado.

```
"subgrafo":{"nodos":[{"id":"D1009","camara":"diputados","nombre":"Jorge Alessandri Vergara"},…
…"aristas":[{"a":"D1180","b":"D1251","tipo":"co_lobby_contraparte","desde":"2026-06…
```

`<svg` → 2. `id="relaciones"` → **1** en `/parlamentario/D1165`.
Nota de alcance: `id="relaciones"` → **0** en `/proyecto/14309-04`; el rail de relaciones es de la
**ficha de parlamentario**, no de la de proyecto (el plan pedía la ancla «en la ficha»). No es hallazgo.

### §4.3 VSIM ON — verificado con par mismo-cámara, y el HALLAZGO A honrado

| par | cámaras | `Coinciden en` | lectura |
|---|---|---:|---|
| `?a=D1170&b=D1165` | **misma** (Cámara) | **2** | **VSIM ON** ✓ |
| `?a=D1165&b=S1338` | distintas | **0** | **HALLAZGO A**, *no* «VSIM OFF» |

Literal servido (gotcha 3 a la vista: React intercala `<!-- -->` entre texto y dígitos, así que el
literal pelado nunca habría matcheado):

```
Coinciden en <!-- -->3655<!-- --> de <!-- -->3672<!-- --> votaciones compartidas (<!-- -->100<!-- -->%).
```

**Caveat de base alta, servido junto a la cifra** (verbatim):

> Cobertura del voto: Cámara ~80% confirmado por identificador; Senado ~20% por nombre (probable).
> El denominador refleja solo votaciones registradas en las fuentes al 2026-07-29.

El `100 %` se lee **con** ese caveat: 3.655/3.672 sobre el subconjunto de votaciones **compartidas y
registradas**, no sobre «todo lo que votaron».

**Sobre el par cruzado:** el `0` se explica **enteramente** por el HALLAZGO A de
`122-CRUCES-SQL.md` §1.2 — un diputado y un senador no comparten votaciones, así que el bloque no
tiene base que mostrar. **No se afirma en ningún punto que VSIM esté OFF**: el par mismo-cámara lo
prueba ON, y el secret está presente. Éste es el caso de libro de «control de ausencia sin control
positivo»: medido solo, el par cruzado habría producido un veredicto falso.

### §4.4 Guards de régimen sobre el DOM servido (4 rutas de mayor densidad)

| ruta | `Actualizado hace` | `Actualizado` | `corte al` | `captura` (palabra) | `fecha_captura` (payload) | `según … al ` |
|---|---:|---:|---:|---:|---:|---:|
| `/parlamentario/D1165` | **0** | **0** | **0** | **0** | 0 | 16 |
| `/proyecto/14309-04` | **0** | **0** | **0** | **0** | 0 | 32 |
| `/red?seed=D1165` | **0** | **0** | **0** | **0** | 0 | 0 |
| `/parlamentarios` | **0** | **0** | **0** | **0** | 186 | 372 |

Controles positivos apareados:

| control | comando | salida |
|---|---|---:|
| `Actualizado hace` sembrado | `printf 'x Actualizado hace 3 dias' \| grep -oF 'Actualizado hace'` | 1 ✓ |
| `corte al` sembrado | `printf 'x corte al 30 jun' \| grep -oF 'corte al'` | 1 ✓ |
| `captura` como palabra, sembrado | `printf 'la captura de datos' \| grep -oiE '(^\|[^a-záéíóúñ_])captura([^a-záéíóúñ_]\|$)'` | 1 ✓ |
| el mismo regex **NO** cuenta el identificador | `printf 'fecha_captura' \| grep -oiE '…'` | 0 ✓ |
| idiom `según … al ` sembrado | `printf 'x según fuente al 29 jul' \| grep -oE 'según [A-Za-z…]+ al '` | 1 ✓ |

**`Actualizado hace` es un control INERTE — se declara como tal.** Da 0, pero ya daba 0 antes del
deploy (`125-01` §3.2): el build viejo renderizaba `Actualizado <fecha absoluta>`, no `Actualizado hace`.
El **discriminante real** del fix de 117 es el par **`Actualizado` 318 → 0** (aquí: **0**, confirmado
en las 4 rutas) junto a **`según fuente al ` 0 → 32**. Ese par sí prueba el reemplazo del idiom.

**`captura` pelado: 0 en las 15 rutas capturadas** (barrido sobre todos los HTML de la corrida, no
sólo las 4). Las 186 apariciones de `fecha_captura` en `/parlamentarios` son el **identificador del
payload RSC**, se declaran explícitamente y **no cuentan** — el regex con clase excluyente
(que incluye `_`) lo demuestra: no matchea `fecha_captura` ni siquiera sembrado.

**Hallazgo de método sobre `según fuente al `** (no es una violación, es un control demasiado
estrecho): el idiom LOCKED se sirve en una **familia** de variantes que **nombran la fuente concreta**:

| ruta | `según fuente al ` | `según Cámara al ` | `según Senado al ` | total familia |
|---|---:|---:|---:|---:|
| `/parlamentario/D1165` | 14 | 2 | 0 | **16** |
| `/proyecto/14309-04` | 32 | 0 | 0 | **32** |
| `/comparar?a=D1170&b=D1165` | 2 | 0 | 0 | **2** |
| `/parlamentarios` | **0** | 310 | 62 | **372** |
| `/red?seed=D1165` | 0 | 0 | 0 | **0** |
| `/` | 0 | 0 | 0 | **0** |

⇒ El criterio «`según fuente al ` ≥ 1 por ruta con dato fechado» **se cumple** una vez leído
correctamente:

- `/parlamentario/D1165`, `/proyecto/14309-04`, `/comparar` → **14, 32, 2**. ✓
- `/parlamentarios` → 0 del literal exacto, pero **372** del idiom en su variante
  `según Cámara al 22 jul 2026` / `según Senado al …`. Nombrar la fuente es **más específico**, no
  menos: la trazabilidad está intacta. No es hallazgo; es que el grep literal del plan no cubre la familia.
- `/red?seed=D1165` → **no es ruta con dato fechado**: renderiza **0** fechas es-CL
  (`grep -oiE '[0-9]{1,2} (ene|feb|…) 20[0-9]{2}'` → **0**). Las 8.990 fechas ISO viven **sólo** en el
  payload del grafo (`"desde":"2026-06-…"`), sin superficie renderizada. El criterio no le aplica.
  Se declara en lugar de forzarlo.
- `/` → sin dato fechado renderizado. No aplica.

---

## §5 Cierre — cero `*_PUBLIC_ENABLED` tocados en la Phase 125

| criterio | resultado |
|---|---|
| `wrangler secret put` ejecutados | **0** — sólo `secret list` (lectura, nombres) |
| valores de secrets impresos | **0** — `secret list` no los devuelve y no se consultaron por otra vía |
| `SUPABASE_DB_URL` expandida o ecoada | **jamás** |
| DDL / DML | **0** |
| fixes de código, deploys | **0** |
| navegación a `/admin/revisar-entidades` | **0** (fila EXCLUIDA, LOCKED) |
| requests a fuentes gubernamentales | **0** — todo contra el Worker propio, secuencial, 1 s |
| PII | **0** — ids públicos + un placeholder sintético; ningún RUT |

**Diff acotado a código y config** (base = `338ffa4`, último commit antes de la Phase 125; HEAD = `fa64f5d`):

```bash
git diff --name-only 338ffa4..HEAD -- app/ packages/ supabase/ .github/ ':!.planning/'
# → 0 archivos
| grep -iE "\.env|wrangler|gate"
# → VACÍO ✓
```

**La Phase 125 no ha tocado un solo archivo bajo `app/`, `packages/`, `supabase/` ni `.github/`.**
Los 5 gates están donde estaban: `CRUCES`/`NET`/`VSIM` ON desde v4.0/v5.0/v10.0, `MONEY` y `NOTIF`
OFF por ausencia de secret.

**Por qué el diff va acotado** (y por qué el sin acotar **no** es criterio válido): los artefactos de
esta misma fase llevan `gate` y `wrangler` en su propio nombre y texto — este archivo se llama
literalmente `125-E2E-C-GATES.md`. Un `grep -iE "\.env|wrangler|gate"` sobre el diff **completo** se
**auto-falsaría** con la evidencia de que no hubo flips. La acotación a `app/ packages/ supabase/ .github/`
con `':!.planning/'` es lo que hace la prueba significativa.

Y no es hipotético — **queda demostrado empíricamente**. Re-corridos ambos diffs con este artefacto ya
commiteado (`873f602`, base `338ffa4`):

| variante | comando | salida |
|---|---|---|
| **acotada** (válida) | `git diff --name-only 338ffa4..HEAD -- app/ packages/ supabase/ .github/ ':!.planning/' \| grep -iE "\.env\|wrangler\|gate"` | **VACÍA** ✓ (0 archivos en el diff) |
| sin acotar (se auto-falsa) | `git diff --name-only 338ffa4..HEAD \| grep -iE "\.env\|wrangler\|gate"` | `.planning/phases/125-…/125-E2E-C-GATES.md` |

El único «hit» del criterio sin acotar es **este mismo archivo de evidencia**. Un plan que hubiera
usado el diff completo habría reportado un flip inexistente causado por su propio informe.

---

## §6 Deuda y límites declarados

| # | ítem | disposición |
|---|---|---|
| 1 | **F-08 de 117 no verificable** contra dato real con MONEY OFF | declarado (§2.4); pendiente del flip de MONEY = deuda de operador, fuera de alcance |
| 2 | Flip de `MONEY_PUBLIC_ENABLED` (revisión legal Ley 21.719) | deuda de operador, **fuera de alcance** por `125-CONTEXT.md` |
| 3 | Provisión de `NOTIF_PUBLIC_ENABLED` | deuda de operador, **fuera de alcance** |
| 4 | `og:image` / `twitter:image` apuntan a `http://localhost:3000/opengraph-image.png` en el deploy | **observado, no arreglado** — ajeno a los 5 gates y a este plan; registrado en `deferred-items.md` |
| 5 | Criterio `Financiamiento → 0` del plan | **inválido**, sustituido por los 14 discriminantes (§2.3, RULE-1) |
| 6 | Gotcha `grep -i` + `-F` = falso cero (GNU grep 3.0) | **nuevo**, documentado en §0.2 para 125-02 … 125-07 |
| 7 | Gotcha `pipefail` + `grep -q` = falso negativo por SIGPIPE (exit 141) | **nuevo**, documentado en §0.3; usar `git cat-file -t` para existencia de commits |
