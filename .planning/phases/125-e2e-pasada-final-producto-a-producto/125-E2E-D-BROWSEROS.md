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
| cadena prohibida ausente | `grep -o "se recorri" … \| wc -l` | 0 | **0** ✓ |
| huérfanos listados | `sed -n '/§0.6/,/§0.7/p' … \| grep -cE '^\| .E-0'` | 4 | **4** ✓ |
| la palabra `estratificación` presente (must_have `contains`) | `grep -o "estratificación" … \| wc -l` | ≥1 | **2** ✓ |

---

## §1 Recorrido — Grupo A (hidratación-dependientes)

*(pendiente: se llena en el Task 2)*

## §2 Recorrido — Grupos B y C

*(pendiente: se llena en el Task 2)*

## §3 Gate humano

*(pendiente: Task 3)*
