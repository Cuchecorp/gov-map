---
phase: 125-e2e-pasada-final-producto-a-producto
plan: 06
fecha: 2026-07-29
version_desplegada: 0ea5d97f-a172-436e-aad0-add95940ee0e
url_base: https://observatorio-congreso.thevalis.workers.dev
herramienta: BrowserOS MCP (http://127.0.0.1:9200/mcp) via scripts/bros-cli.mjs
---

# 125-E2E-D-BROWSEROS — Pasada BrowserOS sobre el DOM hidratado

Este documento cubre la parte **BrowserOS** del SC2 del ROADMAP v12.0. Su razón de ser es que los
planes 02/03/04/05 midieron el **HTML servido** (`curl` + `grep -o … | wc -l`), y ese método no ve:
Suspense resuelto, islas `"use client"`, ni el payload RSC hidratado. Este plan mide el **DOM
hidratado**.

**§0 se escribió y se commiteó ANTES de abrir la primera página.** Declarar el criterio después de
medir sería racionalizar, no estratificar.

---

## §0 Criterio de estratificación — declarado por adelantado

### §0.1 La regla en una línea

La estratificación gradúa la **profundidad** del examen, **no el denominador**. SC2 dice "cada
superficie", así que **las 18 filas no-EXCLUIDAS de la Tabla D reciben carga + captura + fragmento
DOM verbatim**. Lo que varía por estrato es si además se toma `snapshot` de elementos interactivos.

### §0.2 Los tres estratos, con su regla de pertenencia

| estrato | regla de pertenencia (falsable) | profundidad |
|---------|----------------------------------|-------------|
| **A — hidratación-dependiente** | la superficie contiene al menos una isla `"use client"` o al menos un límite de Suspense cuyo contenido el HTML servido entrega como `<!--$?--><template>` + `animate-pulse` | `content` + `snapshot` + captura + fragmento |
| **B — estática / gated / inerte** | sin islas propias relevantes: página de texto, o feature con gate OFF que sólo emite copy inerte, o ruta token-based sin token | `content` + captura + fragmento (sin `snapshot`) |
| **C — `not-found`** | sub-superficie `not-found.tsx`; su copy viaja **sólo en el payload RSC** (`grep -o "<main"` → 0 en el HTML servido) y por eso únicamente es observable hidratada | `content` + captura + fragmento |

### §0.3 Tabla de cobertura — las 19 filas de la Tabla D y el plan que cubrió cada una

| # | fila de la Tabla D (113 §0.4) | cubierta por HTML servido en | cubierta por BrowserOS aquí | URL(s) de este plan | estrato |
|---|---|---|---|---|---|
| 1 | `/parlamentario/[id]` | 125-02, 125-05 | **sí** | `/parlamentario/D1165` · `/parlamentario/S1338` | A |
| 2 | `/proyecto/[boletin]` | 125-02, 125-05 | **sí** | `/proyecto/14309-04` · `/proyecto/17870-05` | A / B |
| 3 | `/contraparte/[id]` | 125-04 (gate MONEY) | **sí** | `/contraparte/S1338` | B |
| 4 | `/` | 125-03 (**límite: 0 fechas, shell**) | **sí** | `/` | A |
| 5 | `/agenda` | 125-03 (**límite: 0 fechas, shell**) | **sí** | `/agenda` | A |
| 6 | `/buscar` | 125-03 | **sí** | `/buscar?q=pensiones` | A |
| 7 | `/comparar` | 125-03, 125-04 (VSIM) | **sí** | `/comparar?a=D1170&b=D1165` | A |
| 8 | `/parlamentarios` | 125-03 (**límite: 0 fechas, shell**) | **sí** | `/parlamentarios` | A |
| 9 | `/red` | 125-03, 125-04 (**límite: isla cliente**) | **sí** | `/red?seed=D1165` · `/red?seed=S1338` | A |
| 10 | `/metodologia` | 125-03 | **sí** | `/metodologia` | B |
| 11 | `/sobre` | 125-03 | **sí** | `/sobre` | B |
| 12 | `/cuenta` | 125-04 (gate NOTIF) | **sí** | `/cuenta` | B |
| 13 | `/notificaciones/baja` | 125-04 (gate NOTIF) | **sí** | `/notificaciones/baja` | B |
| 14 | `/notificaciones/confirmar` | 125-04 (gate NOTIF) | **sí** | `/notificaciones/confirmar` (sin token) | B |
| 15 | `/admin/revisar-entidades` | **`n/a — EXCLUIDA`** | **NO — y no se navega** | — | — |
| 16 | `parlamentario/[id]/not-found.tsx` (E-049) | 125-03 (**límite: sólo payload RSC**) | **sí** | `/parlamentario/NOEXISTE` | C |
| 17 | `proyecto/[boletin]/not-found.tsx` (E-023) | 125-03 (**límite: sólo payload RSC**) | **sí** | `/proyecto/00000-00` | C |
| 18 | `contraparte/[id]/not-found.tsx` (E-050) | 125-03, 125-04 | **sí** | `/contraparte/NOEXISTE` | C |
| 19 | `red/not-found.tsx` (E-047) | 125-03 | **sí** | `/red?seed=NOEXISTE` | C |

**Denominador de este plan: 18 filas de 19.** La fila 15 es `n/a — EXCLUIDA` por decisión LOCKED del
CONTEXT §Alcance de rutas y por el threat model T-125-16 de este plan: **`/admin/revisar-entidades`
no se navega ni se captura.** Total de URLs del recorrido: **21** (10 A + 7 B + 4 C).

### §0.4 Lo que este plan cierra de los límites declarados por wave 2

| límite declarado en wave 2 | por qué el HTML servido no lo veía | cómo se cierra aquí |
|---|---|---|
| `/`, `/agenda`, `/parlamentarios` → **0 fechas**, no contadas como aprobadas (125-05) | el dato fechado viaja tras el límite de Suspense (`hidden id="S:` = 6/3/1) | `content` del DOM hidratado |
| `/red` → 0 fechas, "no es ruta con dato fechado" (125-04) | el grafo entero es isla `"use client"` | `content` + `snapshot` del grafo |
| `17870-05`: 11 de 12 secciones sólo en `<div hidden id="S:8">` (125-02) | shell de streaming | `content` hidratado |
| copy de `not-found` E-049/E-023: `grep -o "<main" \| wc -l` → **0** (125-03) | el copy viaja sólo en el payload RSC | las 4 filas del estrato C |
| `4.9-A1` de links internos: href emitido en `red-graph.tsx:210` (`"use client"`) (125-05) | no observable sin hidratar | `links` / `content` de `/red?seed=D1165` |

### §0.5 Lo NO cubierto por BrowserOS en este plan (explícito)

1. **`/admin/revisar-entidades`** — fila 15, `n/a — EXCLUIDA`. Ningún plan la recorre; decisión LOCKED.
2. **Enumeración exhaustiva de links internos y externos** — la cubre el **Plan 05** por runner sobre
   HTML servido (`125-LINKS-INT.json`, `125-MUESTRA-EXT.json`). Aquí sólo se observa el subconjunto
   hidratado que el runner no podía ver (`4.9-A1`).
3. **Ausencia de emisión MONEY/NOTIF con sus 14 discriminantes** — la cubre el **Plan 04** sobre HTML
   servido. Aquí se **confirma** hidratado (una isla cliente podría emitir lo que el shell no), pero
   el denominador de discriminantes sigue siendo el de 04, no se reconstruye.
4. **Cruce DOM ↔ SQL de conteos** — lo cubren los Planes 02 y 03 por `psql` read-only. Este plan **no
   ejecuta SQL**.
5. **Rate-limit y robots.txt** — Plan 05. No aplica a una pasada de navegador sobre el propio deploy.
6. **Las 82 filas de `122-CRUCES-SQL.md`** — su re-lectura vive en el gate humano de §3, no en el
   recorrido automatizado.

*(Este documento no afirma en ningún punto haber recorrido la totalidad de las superficies: la
cobertura se declara siempre por lista, con su denominador y sus exclusiones a la vista. La cadena
que el plan prohíbe —el verbo de recorrido seguido del cuantificador universal— está ausente por
construcción, y el check de §0.9 lo verifica.)*

### §0.6 Emisores huérfanos — se listan, NO se buscan en el DOM

Regla L-3 de 122 y §3.0.1 de 113: un emisor sin call-site no se renderiza en ninguna ruta, así que
buscarlo en el DOM produciría un falso hallazgo. **No se les toma fragmento DOM.**

| emisor | archivo | evidencia de ausencia de call-site |
|--------|---------|------------------------------------|
| `E-003` | `app/components/voto-ficha-row.tsx` (8 hrefs) | 113 §3.0.1: `grep -rn "VotoFichaRow" app --include=*.tsx \| grep -v "\.test\."` → sólo su propia definición y tipos; cero call-sites |
| `E-008` | `app/components/actualidad-module.tsx` (5 hrefs) | 113 §3.0.1 ídem; **re-probado vivo por el 125-03**: `/` monta `PanelActualidad` (E-055), el near-clone que lo reemplazó |
| `E-029` | `ResumenView` de `/parlamentario/[id]` | 113 §3.0/§3.0.1: emisor inventariado sin call-site vivo |
| `E-053` (empty-state) | rama de estado vacío no alcanzable con los sujetos elegibles de 113 §1 | el sujeto que la activaría no existe en PROD (113 §1.5) |

Consecuencia registrada: el criterio **F-06** (`Última consulta a las fuentes` ≥ 1 en `/`) ya fue
declarado **insatisfacible** por el 125-03 precisamente porque el copy vive sólo en el huérfano
`E-008`. Este plan **no lo re-intenta**.

### §0.7 Método y mesura

- Páginas **ocultas** (`new_hidden_page`), una a la vez, `close` antes de abrir la siguiente (T-125-17).
- `Page ID` **parseado** de la salida de `open`, nunca asumido.
- `sleep 5` tras `open` (SSR + hidratación); `sleep 8-10` entre capturas (la ráfaga tumba el MCP).
- Reintento único ante `CDP request timeout`; si persiste, se reabre la página.
- Cero sesión autenticada, cero navegación a `/admin`, cero capturas del navegador del operador.
- **Cero fixes de código, cero DDL/DML, cero deploy, cero flips de flags.** Un `hallazgo` se escala,
  no se arregla: un fix exigiría re-deploy y esta fase ya desplegó.

### §0.8 Verificación del MCP (antes de abrir la primera página)

```
$ node scripts/bros-cli.mjs tools 2>&1 | head -5
get_active_page — Get the currently active (focused) page in the browser
list_pages — List all pages (tabs) currently open in the browser
navigate_page — Navigate a page to a URL, or go back/forward/reload
new_page — Open a new page (tab) and navigate to a URL. Opens in background by default…
new_hidden_page — Open a new hidden page (tab) and navigate to a URL. Hidden pages are not visible…
```

MCP **vivo**. Gate de operador (arrancar BrowserOS) **no requiere escalada**.

### §0.9 Auto-check de §0 (corrido antes de abrir la primera página)

| check | comando | esperado | observado |
|---|---|---:|---:|
| filas de la Tabla D en §0.3 | `sed -n '/§0.3/,/Denominador/p' … \| grep -oE '^\| [0-9]+ \|' \| wc -l` | 19 | **19** ✓ |
| cadena prohibida ausente | `grep -oE "se[ ]recorri[oó] tod" … \| wc -l` (regex, para no reintroducir el literal en el propio check — el `[ ]` rompe la coincidencia consigo mismo) | 0 | **0** ✓ |
| control positivo apareado del grep anterior | `grep -o "recorrido" … \| wc -l` | >0 | **4** ✓ (el grep sí encuentra cuando hay qué encontrar) |
| huérfanos listados | `sed -n '/§0.6/,/§0.7/p' … \| grep -cE '^\| .E-0'` | 4 | **4** ✓ |
| la palabra `estratificación` presente (must_have `contains`) | `grep -o "estratificación" … \| wc -l` | ≥1 | **2** ✓ |

---

## §0.10 Nota de método — cómo se leyó el DOM hidratado (y por qué NO por el extractor markdown)

Esta pasada tuvo que corregir su propio instrumento dos veces. Se registra porque cualquier fase
futura que use BrowserOS pisará las mismas minas.

**Gotcha M-1 — `bros-cli` sale 0 aunque imprima el error.** `save_screenshot` que falla con
`CDP request timeout` imprime el error **por stdout y termina con exit 0**. El patrón del plan
`cmd || (sleep 3; cmd)` por lo tanto **nunca dispara**. En la primera corrida eso produjo **12 de 21
capturas ausentes** sin una sola señal de fallo. Corregido detectando el **texto** del error y la
existencia/tamaño del `.png`, con hasta 3 intentos. Resultado final: **21/21**.

**Gotcha M-2 — `get_page_content` (markdown) y `innerText` NO ven el contenido de Suspense.** En
`/proyecto/14309-04` el extractor devolvió **645 bytes**: sólo los `##` de las secciones, sin nada
debajo. Medido en la página:

| medición | valor | lectura |
|---|---:|---|
| `document.body.innerHTML.length` | 1.262.985 | el HTML completo llegó |
| `document.body.textContent.length` | **914.556** | **el contenido real está en el DOM** |
| `document.body.innerText.length` | 594 | `innerText` excluye lo no pintado |
| `document.querySelectorAll("template").length` | 13 | límites de Suspense sin revelar al instante de la medición |

Es decir: el contenido **sí** está en el árbol (dentro de `<div hidden id="S:N">`), y la **captura de
pantalla lo muestra pintado**, pero `innerText`/markdown lo reportan como vacío. Por eso **todo
fragmento verbatim de este documento se leyó de `document.body.textContent`** vía `evaluate_script`,
no del extractor. Consecuencia honesta: si esta pasada hubiera confiado en `content`, habría
declarado "secciones vacías" en las fichas densas — exactamente el falso hallazgo que el 125-02
anticipó.

**Gotcha M-3 — `take_snapshot` sub-reporta los elementos interactivos.** En `/buscar?q=pensiones` el
snapshot listó **1** botón; la enumeración directa del DOM listó **16** (facetas + orden). El
snapshot es útil como evidencia de *presencia* (así se documentó el grafo de `/red`), pero **no** como
denominador. Donde el criterio exige "elementos interactivos presentes", este documento cita la
enumeración DOM.

**Gotcha M-4 — el MCP se cayó una vez** (`ECONNREFUSED 127.0.0.1:9200`) tras una ráfaga de
interacciones, y **se recuperó solo** en <12 s. No hubo que escalar. Se confirma T-125-17: una página
a la vez y `sleep` entre capturas es obligatorio, no cosmético.

**Gotcha M-5 — argumentos del MCP.** `evaluate_script` usa `expression` (no `script`); `click` usa
`element` (no `elementId`). Ambos costaron un intento fallido cada uno.

**Gotcha M-6 — MSYS convierte `" / "` en ruta.** Un control positivo imprimió
`true C:/Program Files/Git/ true`: Git Bash expandió el separador `/`. Los dos `true` son válidos;
el separador quedó mangleado. Usar separadores sin `/` en salidas de control.

---

## §1 Recorrido — Grupo A (hidratación-dependientes, examen profundo)

Página oculta, una a la vez, `close` antes de la siguiente. `sleep 7` tras `open`; fragmento leído de
`textContent`; captura con hasta 3 intentos.

### §1.1 Tabla de veredictos del Grupo A

| # | URL | fila Tabla D | textContent | idiom `según … al <fecha>` | `Actualizado` (viejo) | MONEY (3 discrim.) | NOTIF (2 discrim.) | captura | veredicto |
|---|-----|--------------|------------:|---:|---:|:---:|:---:|---|:---:|
| A1 | `/` | 4 | 39.344 | 0 | **0** | 0/0/0 | 0/0 | `home.png` | **ok** |
| A2 | `/parlamentario/D1165` | 1 | 580.582 | **8** | **0** | 0/0/0 | 0/0 | `parlamentario-D1165.png` | **ok** |
| A3 | `/parlamentario/S1338` | 1 | 147.184 | **11** | **0** | 0/0/0 | 0/0 | `parlamentario-S1338.png` | **ok** |
| A4 | `/proyecto/14309-04` | 2 | 914.556 | **18** | **0** | 0/0/0 | 0/0 | `proyecto-14309-04.png` | **ok** |
| A5 | `/buscar?q=pensiones` | 6 | 38.049 | **20** | **0** | 0/0/0 | 0/0 | `buscar-pensiones.png` | **ok** |
| A6 | `/parlamentarios` | 8 | 90.067 | 0 | **0** | 0/0/0 | 0/0 | `parlamentarios.png` | **ok** |
| A7 | `/red?seed=D1165` | 9 | 1.615.886 | 0 | **0** | 0/0/0 | 0/0 | `red-seed-D1165.png` | **ok** |
| A8 | `/red?seed=S1338` | 9 | 13.769 | 0 | **0** | 0/0/0 | 0/0 | `red-seed-S1338.png` | **ok** (vacío honesto) |
| A9 | `/comparar?a=D1170&b=D1165` | 7 | 59.524 | 0 | **0** | 0/0/0 | 0/0 | `comparar-D1170-D1165.png` | **hallazgo H-01** (ver §1.6) |
| A10 | `/agenda` | 5 | 25.330 | 0 | **0** | 0/0/0 | 0/0 | `agenda.png` | **ok** |

Los 3 discriminantes MONEY son `Aportes (recibidos|de campaña)`, `Contratos con el Estado` y
`$ <monto>`; los 2 de NOTIF, `Suscribirme|Mis suscripciones|Recibir alertas` y `dar de baja`.
**Todos 0 en las 10 superficies, hidratadas.** Controles positivos apareados en §2.3.

### §1.2 Fragmentos verbatim — Grupo A

**A1 `/` — el panel de actualidad SÍ resuelve hidratado (cierra el límite del 125-05):**
```
OBSERVATORIO DEL CONGRESO · Busca cualquier proyecto de ley por tema o número de boletín
¿Cómo leer esto? Cada dato lleva su fuente, su fecha y el enlace al documento oficial.
La coincidencia temporal no implica relación: analiza cada dato con cuidado.
```
`<h2>` observados (8): `¿Cómo leer esto?` · `Movimiento reciente` · `Urgencias del Ejecutivo` ·
`Citaciones próximas` · `Sesiones de sala` · `Nuevos ingresos` · `Archivos y retiros` · `Por materia`.
El HTML servido entregaba estas secciones como shell (`hidden id="S:` = 6).

**A2 `/parlamentario/D1165` — acordeones/`detalle-colapsable` vivos (isla cliente):**
```
Ver militancias anteriores (1) | Ver detalle (1000)/Ocultar detalle | Ver detalle (112)/Ocultar detalle
Ver detalle (6)/Ocultar detalle | Ver las 11 señales de lobby po… | Comparar
```
`[aria-expanded]` = **5**. Anclas del rail presentes:
`militancias,relaciones,votos,lobby,patrimonio,cruces,financiamiento-pendiente`.

> **Cruce con el B-01 abierto del 125-02:** el botón dice literalmente `Ver detalle (1000)`. Coincide
> con lo que el 125-02 midió: el clamp de `0078` está en PROD (topa en 4000) pero el call-site sigue
> pasando **1000**. Este plan **confirma el 1000 en el DOM hidratado** y **no** lo trata como
> regresión: B-01 sigue abierto tal como lo dejó el 125-02.

**A3 `/parlamentario/S1338` — carril de lobby sin número y sin afirmar ausencia:**
```
Reuniones de lobby—
```
Un guion em, cero cifras. Es la `zona solo-Senado` del audit v10.0 (`contraparte_id` 100 % NULL en
senadores): el carril **no** dice "no hay reuniones", sólo omite la cifra.

**A4 `/proyecto/14309-04` — 11 `<h2>` incluidas las 5 que sólo existen tras Suspense:**
```
Votaciones · ¿Quién presentó este proyecto? · Idea matriz · Cuerpos legales afectados ·
Proyectos similares · ¿Dónde está hoy? · Tramitación · Valida este dato en la fuente ·
Cruces con el sector del proyecto47 parlamentarios ·
Reuniones de lobby registradas en el mismo período · Audiencias de lobby que mencionan este boletín
```
Idiom 117 hidratado:
```
Iniciativa del Ejecutivo (Mensaje).según fuente al 09 jul 2026·Senado—fuente oficial ↗
```

**A5 `/buscar?q=pensiones` — el island de filtros, enumerado por DOM (M-3):**
```
Estado: En tramitación· 12 | Archivado· 6 | Retirado· 2
Iniciativa: Moción· 19 | Mensaje· 1
Año del primer trámite: 2026· 1 | 2025· 2 | 2024· 6 | 2023· 4 | 2022· 7
Cámara de origen: C.Diputados· 14 | Senado· 6
Orden: Relevancia (por defecto) | Más recientes | Mensajes primero
searchbox q = "pensiones"
```
```
Busca sobre 3100 proyectos de ley (período legislativo 2022–2026).
```
Los 4 grupos de facetas (`<legend>`) + 16 botones + el `searchbox` están presentes hidratados.

**A6 `/parlamentarios` — island de facetas:**
```
Directorio de diputadas, diputados y senadores en ejercicio. Cada ficha enlaza a su detalle con la
fuente a la vista. · Buscar por nombre · Cámara: Todas/Cámara/Senado · Filtrar
```
26 botones, 196 links, 2 inputs hidratados.

**A7 `/red?seed=D1165` — el grafo renderizado, con nodos (isla cliente pura):**
```
Centrado en Agustín Romero Leiva y su vecindario inmediato.
Agustín Romero Leiva · Cámara de Diputadas y Diputados · 80 vecinos · 235 hechos documentados.
El orden de la columna es alfabético; la posición no implica afinidad.
```
`take_snapshot` (aquí sí fiable como prueba de presencia) listó **10 nodos vecinos clickeables** +
controles de filtro:
```
[41] DisclosureTriangle "▸ Cómo leer este diagrama" (expanded)
[3]  checkbox "Tipo de relación: Audiencia de la misma contraparte"
[92/96/100] spinbutton "Día/Mes/Año"  (Desde)   [109/113/117] (Hasta)
[137] button "Vecino: Alejandra Valdebenito Torres" (collapsed)
… 10 vecinos …
[228] button "← Anteriores" (disabled)   [230] button "Siguientes →"
```
Captura adicional del estado interactivo: `red-seed-D1165-vecino-expandido.png` (muestra la tarjeta
semilla, las aristas en abanico y la fila de filtros).

**A8 `/red?seed=S1338` — el vacío honesto:**
```
Hechos públicos que vinculan a este parlamentario con otros. Cada relación es un hecho con fuente y
fecha; no afirma intención ni causa. Centrado en el parlamentario seleccionado y su vecindario
inmediato. Aún no hay relaciones par…
```
Interactivos: sólo chrome + `link "directorio de parlamentarios"`. Cero nodos. `textContent` 13.769
vs 1.615.886 de A7 — el contraste cuantifica el vacío.

**A9 `/comparar?a=D1170&b=D1165` — estado sano (tras el hallazgo H-01):**
```
Comparar dos parlamentarios · Parlamentario A · Elige un parlamentario ·
Ignacio Achurra Díaz · Cámara | Jorge Alessandri Vergara · Cámara | …
```
Los 5 ejes presentes: `Militancia (histórica)` · `Comisiones` · `Co-autoría de proyectos` ·
`Zona electoral` · `Similitud de votación` (VSIM ON, coherente con el 125-04).

**A10 `/agenda`:**
```
Agenda legislativa · ← semana anterior · Semana 31 · 27 jul–2 ago 2026 · semana siguiente →
Citaciones de comisiones · Tabla de sala · Cobertura de la agenda
```

### §1.3 Cierre del límite «4 rutas con 0 fechas» del 125-05 — medido hidratado

El 125-05 declaró (correctamente) que no podía contar `/`, `/agenda`, `/parlamentarios` y `/red` como
aprobadas: **0 fechas** sobre el HTML servido. Medido ahora en el DOM hidratado:

| ruta | fechas es-CL (`dd mmm aaaa`) hidratadas | idiom `según … al` | `Actualizado` | lectura |
|---|---|---:|---:|---|
| `/` | **22 jul 2026, 24 jul 2026, 28 jul 2026, 10 ago 2026** | 0 | 0 | **límite cerrado**: sí hay fechas; llegan tras Suspense |
| `/agenda` | **2 ago 2026** (×4) | 0 | 0 | **límite cerrado**: sí hay fechas |
| `/parlamentarios` | **ninguna** | 0 | 0 | **no es ruta con dato fechado**: directorio de personas |
| `/red?seed=D1165` | ninguna | 0 | 0 | coincide con el 125-04: `/red` no es ruta con dato fechado |

**Observación declarada (no defecto):** en `/` y `/agenda` las fechas se rinden **desnudas**, sin el
idiom `según <fuente> al <fecha>`. Eso es consistente con el modelo de 117, que distingue
`fechaHechoCorta` (fecha del hecho, desnuda) de la fecha de captura en los *chokepoints* de
procedencia (`ProvenanceBadge`), donde el idiom sí es obligatorio y sí aparece (8/11/18/20 en
A2/A3/A4/A5). No se declara PASS de idiom donde el idiom no aplica, ni defecto por su ausencia.

### §1.4 Cierre del límite de Suspense del 125-02 (`17870-05`)

El 125-02 midió que **11 de 12** secciones de `/proyecto/17870-05` llegaban al shell como
`<!--$?--><template id="B:8">` + `animate-pulse`, con el contenido en `<div hidden id="S:8">`.
Hidratado: `textContent` = **7.100.139**, **574** links, **257** botones, **266** ocurrencias del
idiom `según … al <fecha>`, `h1` = `Ley de Presupuestos del Sector Público correspondiente al año 2026`.
**Límite cerrado**: las secciones existen y traen contenido; el shell era shell, no vacío.

### §1.5 Cierre parcial del `4.9-A1` — declarado como NO observado

El 125-05 dejó `4.9-A1` (link interno emitido por la isla `"use client"` `red-graph.tsx:210`) como no
observable sobre HTML servido. Verificación del emisor real en el código:

```
app/components/red/red-graph.tsx:210:  <Link href={`/red?seed=${vecinoId}`} className="net-b-link">
                                         Ver la red de esta persona →
```

⇒ el href es `/red?seed=<vecinoId>`, **no** `/parlamentario/<id>` (mi primer selector fue erróneo y se
corrige aquí). Medido en `/red?seed=D1165` hidratado:

| medición | valor |
|---|---:|
| `a[href^="/red?seed="]` antes de interactuar | **0** |
| texto `Ver la red de esta persona` | **0** |
| `a[href^="/red?seed="]` **después** de `click` en `button "Vecino: Alejandra Valdebenito Torres"` | **0** |

El click se ejecutó (`Clicked [137] at (531, 336)`) pero la tarjeta del vecino **no expandió** bajo
página oculta, y la captura posterior la muestra aún colapsada (`2 hechos →`).

**Veredicto honesto: `4.9-A1` queda NO OBSERVADO en el DOM.** Lo que **sí** queda probado es que su
contenedor está vivo e interactivo (10 botones `Vecino:` con nombre accesible, paginación, filtros).
**No se declara PASS** —el href no se vio— **ni defecto** —el emisor existe en el código y su isla
renderiza—. Se escala como ítem de verificación manual, no se fuerza con `$RC`/DOM sintético: fabricar
la revelación habría sido inventar la evidencia. Va al handoff (Plan 07).

### §1.6 HALLAZGO H-01 — error transitorio de datos en `/comparar` (hidratado, no reproducible)

**Observado** en la primera pasada de `/comparar?a=D1170&b=D1165`:
```
No pudimos cargar la portada
Ocurrió un error al consultar los datos. Esto es una falla técnica, no una ausencia de información:
no asumas que no hay registros.
Reintentar
```
Captura preservada: `captures/comparar-D1170-D1165-HALLAZGO-error-transitorio.png`.

**Caracterización — por qué el HTML servido no lo veía:**

| control | resultado |
|---|---|
| `curl` de `/comparar?a=D1170&b=D1165` → `No pudimos cargar la portada` | **0** ocurrencias, 109.187 bytes |
| ídem en `/comparar`, `/comparar?a=D1165&b=D1170`, `?a=D1165&b=S1338`, `?a=D1165&b=D1166` | **0** en las 5 · HTTP 200 |
| re-test con BrowserOS de las 3 variantes (incl. el par exacto) | `h1` = `Comparar dos parlamentarios` en **3/3** |

⇒ el error **sólo se manifestó hidratado** (fallo de la consulta de datos en cliente/RSC) y **no es
reproducible**: 1 de 2 observaciones del mismo par. **Clasificación: transitorio, severidad baja,
escalado — no arreglado** (un fix exigiría re-deploy y esta fase ya desplegó).

Dos notas de honestidad: (1) el copy dice **"la portada"** en `/comparar`, lo que sugiere un
error-boundary con texto reutilizado — es una observación de copy, no la causa; (2) el copy **acierta**
en lo rector: distingue explícitamente falla técnica de ausencia de dato ("no asumas que no hay
registros"), que es justo lo que el proyecto exige no confundir.

---

## §2 Recorrido — Grupos B y C

### §2.1 Grupo B — estáticas, gated e inertes (carga + captura + fragmento)

| # | URL | fila | textContent | `h1` | fragmento verbatim | veredicto |
|---|-----|------|------------:|------|--------------------|:---------:|
| B1 | `/proyecto/17870-05` | 2 | 7.100.139 | `Ley de Presupuestos del Sector Público correspondiente al año 2026` | 266 idioms `según … al`; 574 links; 257 botones (§1.4) | **ok** |
| B2 | `/metodologia` | 10 | 20.603 | `Metodología` | `Esta página describe, de forma honesta y acotada a su alcance actual, de dónde vienen los datos que se muestran, cómo se reporta cuando un dato no está disponible, y bajo qué licencia se publica cada fuente.` | **ok** |
| B3 | `/sobre` | 11 | 18.535 | `Sobre el proyecto` | `Observatorio del Congreso reúne en un solo lugar datos públicos del Congreso de Chile —proyectos de ley, su tramitación y votaciones, y la actividad de las y los parlamentarios—…` | **ok** |
| B4 | `/cuenta` | 12 | 11.847 | `Tu cuenta` | `Las suscripciones no están disponibles en este momento.` | **ok** (NOTIF OFF) |
| B5 | `/notificaciones/baja` | 13 | 12.474 | `Enlace no válido` | `Este enlace de baja no es válido o ya se usó. Si sigues recibiendo correos, escríbenos.` | **ok** (sin token) |
| B6 | `/notificaciones/confirmar` | 14 | 12.512 | `Enlace no válido` | `Este enlace de confirmación no es válido o ya expiró. Vuelve a tu cuenta e intenta seguirlo de nuevo.` | **ok** (sin token) |
| B7 | `/contraparte/S1338` | 3 | 13.452 | `Contraparte no encontrada` | `No encontramos esta página. Es posible que el identificador sea incorrecto.` | **ok** (404 por gate MONEY) |

**B4/B5/B6 son la confirmación hidratada del gate NOTIF:** el copy es inerte y honesto —"no están
disponibles", "enlace no válido"— sin ningún control de suscripción. **Cero tokens inventados**
(coherente con 113 §4.13/§4.14).

**B7 es la confirmación hidratada del gate MONEY:** `/contraparte/S1338` sirve **exactamente** el mismo
`not-found` que `/contraparte/NOEXISTE` (misma `h1`, mismo copy, 13.452 vs 13.458 bytes) ⇒ la ruta
404ea **entera**, no discrimina id válido de inválido. Es lo que 113 §4.3 predijo (`page.tsx:50-52`).

### §2.2 Grupo C — las 4 sub-superficies `not-found.tsx` (el copy que sólo viaja en el payload RSC)

Es el límite más nítido del 125-03: sobre el HTML servido `grep -o "<main" | wc -l` daba **0**, así que
el copy era invisible aunque el HTTP 404 fuera correcto. Hidratado:

| # | URL | fila | emisor | `h1` | copy verbatim | veredicto |
|---|-----|------|--------|------|---------------|:---------:|
| C1 | `/parlamentario/NOEXISTE` | 16 | **E-049** | `Parlamentario no encontrado` | `No encontramos a este parlamentario en el registro. Es posible que el identificador sea incorrecto.` + `Volver al inicio` | **ok** |
| C2 | `/proyecto/00000-00` | 17 | **E-023** | `Proyecto no encontrado` | `No encontramos el proyecto solicitado. Es posible que aún no haya sido ingresado. Puedes buscarlo directamente en las fuentes oficiales:` + `Senado ↗` `Cámara ↗` + `Volver al inicio` | **ok** |
| C3 | `/contraparte/NOEXISTE` | 18 | **E-050** | `Contraparte no encontrada` | `No encontramos esta página. Es posible que el identificador sea incorrecto.` | **ok** |
| C4 | `/red?seed=NOEXISTE` | 19 | **E-047** | `Página no encontrada` | `No encontramos esta página. Es posible que el identificador sea incorrecto.` | **ok** |

**Límite del 125-03 cerrado en las 4 filas.** Nota de calidad observada, no defecto: **C2 es el único
que ofrece salida a la fuente oficial** (`Senado ↗` / `Cámara ↗`) y el único que distingue
"no ingresado aún" de "id incorrecto"; C3 y C4 comparten copy genérico. Coherente con el principio de
trazabilidad, y mejorable — se registra sin escalar.

### §2.3 Controles positivos apareados (obligatorios: un grep de ausencia sin control positivo no vale)

El 125-04 cazó que `grep -i` + `-F` devuelve 0 **siempre** en GNU grep 3.0 justo porque tenía control
positivo. Aquí la medición es JS `RegExp.test` en la página, y se prueba capaz de acertar:

| regex de ausencia usada | control positivo | resultado |
|---|---|:---:|
| `/Aportes? (recibidos?\|de campaña)/` | `.test("Aportes recibidos")` | **true** ✓ |
| `/Contratos con el Estado/` | `.test("Contratos con el Estado")` | **true** ✓ |
| `/Suscribirme/` | `.test("Suscribirme")` | **true** ✓ |
| `/Mis suscripciones/` | `.test("Mis suscripciones")` | **true** ✓ |
| `/según [^.,;]{2,30} al \d{1,2} [a-z]{3} \d{4}/` | `.test("según Senado al 09 jul 2026")` | **true** ✓ |

⇒ los **0** de MONEY/NOTIF en las 18 filas son ausencias **medidas**, no fallos del instrumento.

### §2.4 La trampa de MONEY, re-confirmada hidratada

La palabra `Financiamiento` aparece **6 veces** en `/parlamentario/D1165` — y eso **no** significa que
MONEY esté encendido. Es el copy del propio gate OFF, verbatim:

```
Financiamiento y contratos del Estado
Pendiente de revisión legal (Ley 21.719) antes de publicarse.
```
(idéntico en `S1338`; sección `id="financiamiento-pendiente"`.)

Confirma la decisión RULE-1 del **125-04**: el criterio "`Financiamiento` → 0" era **inválido**, porque
la palabra vive en el copy del gate. Los discriminantes de **emisión** (aportes, contratos, montos) son
**0/0/0** en las 18 filas. **MONEY sigue OFF, hidratado.**

### §2.5 Emisores huérfanos — no se buscaron (según §0.6)

Cero fragmentos DOM para `E-003`, `E-008`, `E-029` y el empty-state de `E-053`. En particular **no** se
re-intentó el criterio **F-06** (`Última consulta a las fuentes` en `/`), que el 125-03 declaró
insatisfacible por vivir sólo en el huérfano `E-008`; medido de paso: **0** ocurrencias, como su
condición de huérfano predice.

### §2.6 Cierre del recorrido — cobertura y capturas

| criterio del plan | resultado |
|---|---|
| capturas en `captures/` | **23** `.png` = 21 del recorrido + `red-seed-D1165-vecino-expandido` + `comparar-…-HALLAZGO-error-transitorio` |
| una captura por URL del recorrido (21) | ✓ 10 A + 7 B + 4 C |
| las 18 filas no-EXCLUIDAS con fragmento verbatim + veredicto | ✓ §1.1/§1.2 (filas 1,2,4,5,6,7,8,9) · §2.1 (2,3,10,11,12,13,14) · §2.2 (16,17,18,19) |
| `/admin/revisar-entidades` ausente del recorrido | ✓ **no se navegó** (fila 15 `n/a — EXCLUIDA`) |
| grafo de `/red?seed=D1165` con nodos | ✓ 10 nodos vecinos + seed `80 vecinos · 235 hechos` |
| `/red?seed=S1338` vacío honesto | ✓ `Aún no hay relaciones…`, cero nodos |
| island de filtros de `/buscar` con sus interactivos | ✓ §1.2-A5 (4 grupos de facetas, 16 botones, searchbox) — por enumeración DOM, ver M-3 |
| cero superficies con veredicto vacío | ✓ 18/18 con veredicto |

**Veredictos:** 17 `ok` + **1 `hallazgo` (H-01, `/comparar`, transitorio, escalado)**.

---

## §3 Gate humano — lectura fría y juicio de copy

**Estado: ABIERTO — pendiente de respuesta del operador.**

Este subagente **no puede** cerrar este gate: exige juicio humano de copy. Se presenta el material y
se registra la respuesta verbatim. **Prohibido inferir aprobación por silencio** (T-125-18).

### §3.1 Material a leer

1. `captures/proyecto-14309-04.png` — bloque de menciones de lobby.
2. `captures/parlamentario-S1338.png` — carril de lobby.

### §3.2 Las tres preguntas

**Pregunta 1 — línea de cobertura de menciones de lobby (`COBERTURA_MENCIONES_LOBBY`, fila 5.12 de
122).** Copy servido hoy, leído del DOM hidratado:

```
195 de las 5.106 audiencias registradas con parlamentario identificado y materia publicada citan el
número de un boletín en su materia (3,8 %), según fuente al 29 jul 2026. Este recuento cubre solo esa
parte del registro.
```
¿Describe el canal **sin insinuar ocultamiento ni causalidad**? ¿El parcial se lee como parcial y nunca
como total? ¿Se entiende el idiom `según fuente al 29 jul 2026`?

**Pregunta 2 — carril de lobby de un senador.** Copy servido hoy en `/parlamentario/S1338`:
```
Reuniones de lobby—
```
Confirmar a ojo que **no muestra ningún número** y que **no afirma una ausencia en la fuente**.

**Pregunta 3 (opcional, ítem 1 de 122).** Hojear `122-CRUCES-SQL.md`: ¿sus 82 filas se auditan sin
abrir el código?

### §3.3 Respuesta del operador

```
SIN RESPUESTA DEL OPERADOR — handoff
```

Queda para `125-HANDOFF-HUMANO.md` (Plan 07), patrón v7/v9/v10/v11. El orquestador cierra este gate;
si el operador responde, su texto se registra **verbatim** en este bloque, sustituyendo la línea de
arriba.

### §3.4 Ítems que este plan escala (no arregla)

| id | ítem | por qué no se arregla aquí |
|----|------|---------------------------|
| **H-01** | error transitorio hidratado en `/comparar` (§1.6) | un fix exige re-deploy; esta fase ya desplegó |
| **4.9-A1** | href `/red?seed=<vecinoId>` no observado en DOM (§1.5) | requiere expandir la tarjeta del vecino; no se fabrica evidencia |
| copy C3/C4 | `not-found` de contraparte y red comparten copy genérico, sin salida a fuente (§2.2) | juicio de copy, no defecto funcional |
