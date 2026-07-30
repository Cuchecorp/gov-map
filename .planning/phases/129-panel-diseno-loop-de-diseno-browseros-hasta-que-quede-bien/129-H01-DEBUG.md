# H-01 — `/comparar` intermitente: tasa observada, causa raíz y diferido

**Plan:** 129-02 · **Requisito:** PANEL-09 · **Cierra:** ROADMAP §Phase 129 SC4
**Deploy medido:** `4c6fdbda-61ae-485e-9a4d-4197db35cf61`
**URL bajo prueba:** `https://observatorio-congreso.thevalis.workers.dev/comparar?a=D1178&b=D1099`
**Este documento no toca código de la app.** (`git diff --name-only -- app/` vacío.)

---

## Resumen ejecutivo

H-01 son **DOS modos de fallo distintos**, y confundirlos fue el error de diagnóstico anterior:

| Modo | Qué se observó | Cuándo | Estado |
|---|---|---|---|
| **M-A — boundary post-hidratación** | El error boundary raíz aparece en el navegador con el HTML SSR sano detrás | **REPRODUCIDO** por la ola 1 contra `4c6fdbda` | Causa raíz **acotada a un mecanismo, con control apareado**; el componente exacto que lanza **no quedó aislado** (§Aislamiento) |
| **M-B — `500 __next_error__`** | Body `<html id="__next_error__">`, una sola observación del premortem | **1 vez**, contra el deploy anterior | Sin explicación confirmada; el `Promise.all` de `page.tsx:246` es el amplificador estructural que lo haría posible (§Causa raíz de M-B). **Se registra como observación real, NO se descarta.** |

Lo medido en esta corrida: **36/36 respuestas HTTP 200** (24 documento + 12 RSC), **15/15 cuerpos byte-idénticos y completos**, **6/6 invocaciones del Worker con `outcome: "ok"` y `exceptions: []`**. El servidor está sano; M-A es de cliente.

---

## §Tasa observada

**Ventana:** `2026-07-30T23:51:21Z` → `2026-07-30T23:52:16Z` (UTC), bucle **seriado**, 1 s entre iteraciones.
**Comando:** `curl -s -o /dev/null -w "%{http_code}\n"`.
**Version-id vigente:** `4c6fdbda-61ae-485e-9a4d-4197db35cf61`.

### Histograma principal — N = 24 sobre `/comparar?a=D1178&b=D1099`

```
     24 200
```

Secuencia cruda tal cual salió (24 valores, sin resumir):

```
200 200 200 200 200 200 200 200 200 200 200 200 200 200 200 200 200 200 200 200 200 200 200 200
```

### Control apareado — N = 24 sobre `/` (portada)

```
     24 200
```

El control positivo importa: si `/` también hubiera dado 24×200 *sin* que el path de datos se ejercitara, el cero sería vacuo. `/` es `force-dynamic` y lee el módulo de actualidad, así que sus 24×200 acreditan que el canal Worker→Supabase estuvo vivo durante toda la ventana.

### Control adicional — N = 12 sobre el canal **RSC** (navegación de cliente)

La ola 1 observó M-A *después* de la hidratación, así que el canal que usa el router de cliente (`RSC: 1`) se midió aparte. Ventana `2026-07-30T23:52:34Z` →`23:53:00Z` aprox.:

```
     12 200
```

### Integridad del cuerpo — N = 15

No basta con el código HTTP: un `200` truncado a mitad de stream rompe la hidratación igual que un `500`. Por eso se midió el cuerpo:

```
req=1  bytes=109384 cierra_html=1 flight_pushes=14
req=2  bytes=109384 cierra_html=1 flight_pushes=14
req=3  bytes=109384 cierra_html=1 flight_pushes=14
req=4  bytes=109384 cierra_html=1 flight_pushes=14
req=5  bytes=109384 cierra_html=1 flight_pushes=14
req=6  bytes=109384 cierra_html=1 flight_pushes=14
req=7  bytes=109384 cierra_html=1 flight_pushes=14
req=8  bytes=109384 cierra_html=1 flight_pushes=14
req=9  bytes=109384 cierra_html=1 flight_pushes=14
req=10 bytes=109384 cierra_html=1 flight_pushes=14
req=11 bytes=109384 cierra_html=1 flight_pushes=14
req=12 bytes=109384 cierra_html=1 flight_pushes=14
req=13 bytes=109384 cierra_html=1 flight_pushes=14
req=14 bytes=109384 cierra_html=1 flight_pushes=14
req=15 bytes=109384 cierra_html=1 flight_pushes=14
```

Variantes de tamaño observadas: **una sola** (`15 × bytes=109384`). `cierra_html` = el cuerpo termina en `</html>`; `flight_pushes` = número de `self.__next_f.push` (el payload RSC embebido). Los tres invariantes son constantes ⇒ **cero truncamiento de stream en 15 muestras**.

Conteos sobre el cuerpo servido (contadores por `grep -oF … | wc -l`, nunca `grep -c`, que topa en 1 sobre HTML de una línea):

| Métrica | Valor | Lectura |
|---|---|---|
| `No pudimos cargar la portada` | **0** | el boundary NO está en el HTML servido |
| `__next_error__` | **0** | no hay 500 de Next en el documento |
| `D1178` | **10** | control positivo: la comparación real se renderizó |
| `<option` | **374** | roster completo ×2 selects (`page.tsx:202` → `comparar-selector.tsx:38`) |

Los ceros de boundary son **fuertes**, no vacuos: van apareados con `D1178`=10 y `<option>`=374 sobre el mismo cuerpo.

### Cabeceras del deploy medido (verbatim, recortadas)

```
HTTP/1.1 200 OK
Cache-Control: private, no-cache, no-store, max-age=0, must-revalidate
Transfer-Encoding: chunked
Vary: rsc, next-router-state-tree, next-router-prefetch, next-router-segment-prefetch
content-security-policy: default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'
x-opennext: 1
```

**La tasa ES el hallazgo y se publica tal cual: 0/24 fallos en el documento, 0/12 en RSC, 0/15 cuerpos degradados.** No se redondea a una conclusión sobre M-A, porque M-A no vive en esta capa.

---

## §Causa raíz

### El hecho que reordena el diagnóstico

La ola 1 reprodujo el boundary **con el SSR sano detrás**: HTTP 200, 109.384 bytes, `D1178`/`D1099` ×10 en el HTML servido, boundary = 0 en ese mismo HTML. Y re-navegar lo curó. Por lo tanto **M-A es un `throw` en el cliente durante/después de la hidratación**, no un fallo de datos ni un 500. Esto **refuta** la hipótesis del premortem de que lo reproducido fuera un fallo de Server Component, y **confirma** la formulación original de D-05.

### Por qué el fallo se come la página entera (mecanismo compartido por M-A y M-B)

`ls app/comparar/` devuelve exactamente `page.test.tsx` y `page.tsx`: **la ruta `/comparar` NO tiene `error.tsx` propio.** Los boundaries de ruta existentes son `app/agenda/error.tsx`, `app/buscar/error.tsx`, `app/contraparte/[id]/error.tsx`, `app/parlamentario/[id]/error.tsx`, `app/parlamentarios/error.tsx`, `app/proyecto/[boletin]/error.tsx` y el raíz `app/error.tsx`. Como `/comparar` no aporta el suyo, **cualquier `throw` de su subárbol sube hasta el boundary RAÍZ** (`app/app/error.tsx:17`), que reemplaza toda la página por copy de portada — de ahí que un usuario en `/comparar` lea literalmente `No pudimos cargar la portada` (`app/app/error.tsx:30`), un mensaje que ni siquiera corresponde a la ruta en que está.

### M-A — hipótesis principal: chunk del bundle anterior tras el re-deploy

**La superficie de cliente de `/comparar` es mínima.** Verificado por lectura, con `"use client"` anclado a la línea 1 (el `grep -rl` ingenuo da falsos positivos: `components/comparar-selector.tsx` menciona la directiva **en un comentario**, línea 20, y NO es cliente):

| Archivo del árbol de `/comparar` | `"use client"` en línea 1 | Veredicto |
|---|---|---|
| `app/app/comparar/page.tsx` | no | Server Component (`export const dynamic = "force-dynamic"`, `:43`) |
| `components/comparar-selector.tsx` | **no** (falso positivo del grep) | server, `<form method="get">`, cero JS |
| `components/relaciones-eje-comparar.tsx` | no (único import: `type { ReactNode }`) | server puro |
| `components/similitud-votacion-comparar.tsx` | no (cero imports) | server puro; además inerte aquí |
| `components/global-header.tsx` | no | server |
| `components/header-nav.tsx` | **sí** | **el ÚNICO islote cliente de la página** |

Es decir: `/comparar` **no tiene ni un solo componente cliente propio**. El único es `HeaderNav`, que está en `app/app/layout.tsx:40` y por tanto en **todas** las rutas — y las demás rutas no exhiben M-A. Eso empuja la causa fuera de "un componente de `/comparar` que lanza al hidratar" y hacia **la carga del bundle**.

**Mecanismo propuesto, con control apareado medido:**

1. La ola 1 desplegó un bundle **nuevo** (`4c6fdbda`) sobre uno **preexistente** (`b69f2ec2`) durante la misma sesión de navegador.
2. Los nombres de chunk son content-addressed y cambian con el bundle. La página servida por `4c6fdbda` referencia **9 chunks únicos**; los 9 responden **200**:
   ```
        9 200
   ```
   (control positivo, primera fila: `200 /_next/static/chunks/0cz1d0mv5g_q7.js`)
3. **Control negativo apareado** — un hash de chunk que ya no existe en el bundle vigente (exactamente la situación de un cliente que retuvo el mapa de chunks del deploy anterior):
   ```
   stale_chunk_http=404
   ```
4. Un `404` al importar un chunk durante la hidratación produce un `ChunkLoadError` **en el cliente**, que sube al boundary raíz por la ausencia de `error.tsx` en la ruta.

Este mecanismo explica, sin residuo, **cada** hecho observado: SSR 200 e íntegro ✓ · boundary sólo tras hidratar ✓ · re-navegar cura de forma permanente (el documento nuevo trae el mapa de chunks vigente) ✓ · sólo ocurrió en el **primer** load posterior al deploy ✓ · `get_console_logs` vacío en 3 intentos, porque el buffer se limpió en la navegación que curó el fallo ✓.

Descartes que sostienen la hipótesis, y cómo se descartaron:

- **Mismatch de hidratación por fecha/tz** (`page.tsx:54-61`, `fechaConsultaHoy()` con `Intl.DateTimeFormat` y `America/Santiago`): descartado. Es un Server Component; su salida viaja **serializada** en el payload RSC y el cliente **no re-ejecuta** la función, así que no hay dos valores que puedan discrepar.
- **Truncamiento del stream** (109 KB, `Transfer-Encoding: chunked`, `no-store`): descartado en 15 muestras — cuerpo byte-idéntico, `</html>` presente y 14 `self.__next_f.push` en las 15.
- **Bloqueo por CSP del fetch RSC**: descartado. La política declara `connect-src 'self'` y `script-src 'self' 'unsafe-inline'`, y el canal RSC dio 12/12 → 200.
- **Fallo de datos / RPC**: descartado para M-A. `wrangler tail` sobre la ventana de recargas: 6/6 `"outcome": "ok"`, `"exceptions": []`, `"status": 200`.
- **`<select defaultValue>` con 374 `<option>`** (`comparar-selector.tsx:57-64` y `:68-75`): no descartado del todo como coste de hidratación, pero no es un `throw`: React reconcilia el valor del `select` sin lanzar.

### §Aislamiento — lo que NO se logró determinar

**No se logró aislar el componente exacto que lanza en M-A**, y se dice con esas palabras en vez de disfrazarlo. Lo que lo impide es concreto: `get_console_logs` volvió `{"entries":[],"totalCount":0}` en los 3 intentos de la ola 1, así que **no existe stack trace**, y M-A no volvió a presentarse en 36 requests + una ventana de `wrangler tail`. La hipótesis del chunk stale queda sostenida por un control apareado (9×200 real / 404 inventado) y por eliminación de las cuatro alternativas de arriba — es **la explicación mejor sostenida, no un hecho verificado por reproducción**. El criterio de cierre futuro está en §DIFERIDO.

### §Causa raíz de M-B — el 500 `__next_error__` observado una vez

M-B **no se explica** por lo anterior y **no se descarta**: el premortem observó un body `<html id="__next_error__">` real. La estructura que lo hace posible sigue en pie, y es la que SC4 pide nombrar con `archivo:línea`. Cada lector server-only **lanza** ante cualquier error de DB/red, sin timeout, sin retry y sin aislamiento por eje:

| Sitio | RPC | Qué hace ante error |
|---|---|---|
| `app/app/comparar/page.tsx:81` | `parlamentarios_publico_v2` (roster) | `throw` en `:83` — y se ejecuta **antes** de todo (`:194`), así que tumba incluso el estado vacío |
| `app/app/comparar/page.tsx:92` | `militancia_historica_compartida` | `throw` en `:95-98` |
| `app/app/comparar/page.tsx:108` | `comisiones_de_parlamentario` | `throw` en `:112` |
| `app/app/comparar/page.tsx:124` | `coautores_de_parlamentario_v2` | `throw` en `:128` |
| `app/app/comparar/page.tsx:510` | `coincidencia_votos_par` (VSIM, gated) | `throw` en `:517` |

**El amplificador es `app/app/comparar/page.tsx:246`**: un único `await Promise.all([...])` dispara **seis** de esas lecturas a la vez (`getMilitanciaHistorica(a)`, `getMilitanciaHistorica(b)`, `getComisiones(a)`, `getComisiones(b)`, `getCoautores(a)`, `getCoautores(b)`). `Promise.all` rechaza con el **primer** rechazo: **basta que UNA de las seis reviente** — un timeout transitorio del upstream, un `503` de PostgREST, un corte de red del Worker — para que las otras cinco, ya resueltas o en vuelo, se descarten y la página entera caiga. Con `page.tsx:510` (VSIM ON en PROD) son **siete** RPCs en total sin un solo punto de contención.

**Mecanismo completo, enunciado de punta a punta:**

> fallo transitorio de UNA RPC → el lector correspondiente hace `throw` (`page.tsx:81`/`:92`/`:108`/`:124`/`:510`) → `Promise.all` de `page.tsx:246` rechaza entero → el Server Component de la ruta rechaza → **`/comparar` no tiene `error.tsx` de ruta** → el error sube al boundary raíz `app/app/error.tsx` → Next responde **`500` con `<html id="__next_error__">`**, y el usuario lee `No pudimos cargar la portada` estando en `/comparar`.

Ninguna de las siete lecturas tiene `AbortSignal.timeout`, ni reintento, ni `Promise.allSettled`, ni degradación por eje. Verificado por lectura del archivo completo (699 líneas).

---

## §Log capturado

`wrangler tail observatorio-congreso --format json`, con `XDG_CONFIG_HOME=C:/Users/Carlo/AppData/Roaming/xdg.config` y `MSYS_NO_PATHCONV=1`.

**Ventana:** `2026-07-30T23:54:46Z` → `2026-07-30T23:56:26Z` (≈100 s), con 10 recargas de `/comparar?a=D1178&b=D1099` inyectadas dentro de la ventana. `stderr` de wrangler: vacío.

Eventos capturados por el muestreo del tail: **6**.

```
outcome:     6 × "ok"
exceptions:  6 × []
logs:        6 × []
status:      6 × 200
```

Extracto verbatim de un evento:

```
    "outcome": "ok",
    ...
    "exceptions": [],
    "logs": [],
    "eventTimestamp": 1785455702103,
```

**Ventana de ~100 segundos y 10 recargas sin que el fallo se presentara; la tasa observada en la misma sesión fue 0/24 en el documento y 0/12 en RSC.** La ausencia de log no bloquea el cierre: es coherente con M-A siendo de cliente (el Worker jamás vería ese error) y con M-B siendo un evento raro ligado a un fallo transitorio del upstream.

---

## DIFERIDO — fix de resiliencia SSR de /comparar

### 1. El mecanismo

Seis lectores server-only se disparan juntos en el `Promise.all` de `app/app/comparar/page.tsx:246`, y **cada uno lanza** ante cualquier error de DB/red: `page.tsx:81` (roster), `:92` (militancia), `:108` (comisiones), `:124` (co-autoría) y `:510` (VSIM). `Promise.all` rechaza con el primer rechazo ⇒ **un fallo transitorio de UNA RPC tumba la página entera a 500**, y como `/comparar` no tiene `error.tsx` de ruta, el usuario recibe el boundary raíz con copy de portada. Ese es el modo M-B, el `500 __next_error__` que el premortem observó una vez.

### 2. La propuesta de fix

- Sustituir el `Promise.all` de `:246` por un **aislamiento por eje** (`Promise.allSettled` o un envoltorio por lector) de modo que el fallo de un eje no arrastre a los otros cuatro.
- Introducir un **tercer estado `fallo`, DISTINTO del estado `vacío`**, para no violar el contrato #34. Hoy el eje tiene `presente` / `ausente` / `indeterminado` (`page.tsx:625-628`, tipo `InterseccionPar`); el estado nuevo declara *"no pudimos cargar este eje"* — que es afirmar un fallo del canal, **jamás** afirmar que no hay registros. La distinción es la línea roja: degradar un error a `[]` fabricaría un hecho negativo con atribución de fuente, el riesgo #1 del proyecto.
- **Retry acotado** (uno o dos intentos con backoff corto) y `AbortSignal.timeout` en cada lector, hoy ausentes en las siete lecturas.
- Añadir un `app/comparar/error.tsx` propio, para que un fallo residual muestre copy de *comparación*, no `No pudimos cargar la portada`.
- **El harness de test ya existe**: `app/app/comparar/page.test.tsx:218-231` (`describe("(6) error de RPC LANZA (#34, jamás 'sin relaciones')")`) monta `rpcImpl.mockImplementation` por nombre de RPC y hoy asserta `rejects.toThrow(/comisiones_de_parlamentario/)`. Un fix futuro reutiliza ese mismo mock y **invierte la aserción**: el render ya no rechaza, y el HTML debe contener la declaración de eje caído **sin** contener ninguna frase de ausencia (control apareado obligatorio: cero de "no comparten…" + presencia positiva del copy de fallo).

### 3. Por qué NO se implementa aquí

- Implementarlo exige **enmendar el contrato LOCKED #34** (`app/app/comparar/page.tsx:74-76`: *"Cada lector LANZA ante un error real de DB/red (#34) — un vacío honesto es `[]` SIN error, jamás una degradación a 'sin relaciones'"*) **e invertir su test** (`page.test.tsx:218-231`). Enmendar una regla LOCKED que existe precisamente para impedir que un error se lea como ausencia **requiere pronunciamiento del operador**; no es decisión de un plan autónomo.
- Introduce **copy nuevo en producción** (la frase de eje caído) fuera del único checkpoint humano de la fase, en el que al operador se le muestran 3 capturas del happy path — es decir, entraría copy que nadie le pone delante.
- **Excede SC4**, que se satisface entero con la cuantificación y la causa raíz de este documento.

### 4. Nota para 129-03

`129-03` Task 1 debe arrastrar este ítem a `129-CRITICA.md` §Diferidos como fila **`DIFERIR`**, con este criterio de cierre futuro:

> **Criterio de cierre:** un test de fallo de upstream sobre el harness de `app/app/comparar/page.test.tsx:218-231` que, con una RPC en error, (a) NO rechace el render, (b) muestre la declaración de eje caído, y (c) NO emita ninguna frase de ausencia — verificado con control apareado (cero de la frase de ausencia + control positivo del copy de fallo). Requisito previo: pronunciamiento del operador sobre la enmienda al contrato LOCKED #34.

Se arrastra además, como ítem separado, el **aislamiento de M-A**: reproducir el `ChunkLoadError` forzando un deploy con la pestaña abierta y capturando el stack **antes** de re-navegar (la re-navegación borra el buffer de consola, que es lo que impidió capturarlo en la ola 1).

---

## Método de medición (anti-falso-verde)

- Todos los conteos usan `grep -oF … | wc -l`, nunca `grep -c` (topa en 1 sobre HTML de una línea).
- Ningún `grep -q` bajo `pipefail`; ningún `grep -i` combinado con `-F`.
- Cada cero va apareado con un control positivo sobre el mismo cuerpo (`D1178`=10, `<option>`=374, chunk real=200 frente a chunk inventado=404).
- Primer intento del bucle: las redirecciones apuntaban a una ruta inválida (`$HOME/../AppData`, permiso denegado) y **cero requests se ejecutaron**. Se detectó, se descartó por completo y se relanzó con ruta absoluta — ninguna de las cifras de este documento proviene de esa corrida fallida.
