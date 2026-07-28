# 114-ANCLAS — Veredicto por ancla `#id` (Plan 02, SC#2 del ROADMAP)

**Corrida:** `MSYS_NO_PATHCONV=1 node scripts/verificar-links-internos.mjs --tipo ancla --json-only --out <os.tmpdir()>/114-anclas`
**Deploy:** `https://observatorio-congreso.thevalis.workers.dev`
**Timestamp:** `2026-07-28T01:10:59.607Z` · **exit 0** · **20 entradas · PASS 20 · MISSING-SSR 0 · FAIL 0**
**Copia del JSON de la corrida:** `114-ANCLAS-RUN.json` (misma fase)

La corrida se ejecutó **con la aserción de ancla ya endurecida** (ver §Aserción). El conteo cuadra
por igualdad con el manifiesto: `MANIFIESTO.filter(tipo==='ancla').length === 20 === resultados.length`.
Ninguna fila fue rellenada: cada una tiene su `id` de manifiesto o, cuando es una fila del inventario
que el manifiesto no instancia (anclas MONEY), lo declara explícitamente en la columna `id manifiesto`.

## Aserción de ancla — probada que muerde (T-114-12)

`tieneId(html, id)` está exportada con nombre desde `scripts/verificar-links-internos.mjs` y la
ejerce `scripts/verificar-links-internos.selfcheck.mjs` (10 fixtures inline, exit 0).

- Se **endureció**: ahora remueve los bloques `<script>…</script>` antes de buscar, porque el payload
  RSC de Next.js es texto y podría contener un `id="…"` serializado sin que exista el elemento.
- Lo que ya era correcto y se dejó intacto: el atributo debe ser exactamente `id` precedido de
  whitespace (`\sid=["']…["']`), lo que descarta `aria-controls`, `aria-labelledby` y `data-id`, y la
  comilla de cierre ancla el final, lo que descarta el prefijo ajeno (`votos` ≠ `votos-extra`).
- **Prueba de mutación:** relajando `tieneId` a `String(html).includes(id)` el self-check sale
  **exit 1 con 6 fixtures en FAIL**. Revertida la relajación, exit 0.

## Método

- **SSR** = el atributo `id` aparece en el HTML servido por el deploy (evidencia = fragmento del
  elemento, ≤120 chars, sin datos personales).
- **BrowserOS** = fallback contra el DOM vivo. **No se usó**: cero anclas quedaron ausentes en SSR.

## Tabla de veredictos

| id manifiesto | inventarioRef | ancla | ruta destino | emisor del href | método | veredicto | evidencia |
|---|---|---|---|---|---|---|---|
| `4.1-A3-votos` | 4.1-A3 | `#votos` | `/parlamentario/D1165` | E-042 `app/components/ficha-rail.tsx:59` | SSR | existe | `<section id="votos" class="mt-12">` |
| `4.1-A3-lobby` | 4.1-A3 | `#lobby` | `/parlamentario/D1165` | E-042 `app/components/ficha-rail.tsx:59` | SSR | existe | `<section id="lobby" class="mt-12">` |
| `4.1-A3-patrimonio` | 4.1-A3 | `#patrimonio` | `/parlamentario/D1165` | E-042 `app/components/ficha-rail.tsx:59` | SSR | existe | `<section id="patrimonio" class="mt-12">` |
| `4.1-A3-cruces` | 4.1-A3 | `#cruces` | `/parlamentario/D1165` | E-042 `app/components/ficha-rail.tsx:59` | SSR | existe | `<section id="cruces" class="mt-12">` |
| `4.1-A3-S-votos` | 4.1-A3 | `#votos` | `/parlamentario/S1338` | E-042 `app/components/ficha-rail.tsx:59` | SSR | existe | `<section id="votos" class="mt-12">` |
| `4.1-A3-S-patrimonio` | 4.1-A3 | `#patrimonio` | `/parlamentario/S1338` | E-042 `app/components/ficha-rail.tsx:59` | SSR | existe | `<section id="patrimonio" class="mt-12">` |
| `4.1-A3-S-cruces` | 4.1-A3 | `#cruces` | `/parlamentario/S1338` | E-042 `app/components/ficha-rail.tsx:59` | SSR | existe | `<section id="cruces" class="mt-12">` — divergencia con el inventario, ver nota D-01 |
| `4.1-A20-pendiente` | 4.1-A20 | `#financiamiento-pendiente` | `/parlamentario/D1165` | E-042 `app/components/ficha-rail.tsx:59` (chip del placeholder MONEY OFF) | SSR | existe | `<section id="financiamiento-pendiente" class="mt-12 opacity-60">` |
| `4.2-A1-estado` | 4.2-A1 | `#estado` | `/proyecto/14309-04` | E-042 `app/components/ficha-rail.tsx:59` | SSR | existe | `<section id="estado" class="mt-12">` |
| `4.2-A1-timeline` | 4.2-A1, 4.2-A5 | `#timeline` | `/proyecto/14309-04` | E-042 `ficha-rail.tsx:59` + E-045 `capa1/tramitacion-stepper.tsx:133` | SSR | existe | `<section id="timeline" class="mt-12">` |
| `4.2-A1-votaciones` | 4.2-A1 | `#votaciones` | `/proyecto/14309-04` | E-042 `app/components/ficha-rail.tsx:59` | SSR | existe | `<section id="votaciones" class="mt-12">` |
| `4.2-A1-autores` | 4.2-A1 | `#autores` | `/proyecto/14309-04` | E-042 `app/components/ficha-rail.tsx:59` | SSR | existe | `<section id="autores" class="mt-12">` |
| `4.2-A1-lobby-tramitacion` | 4.2-A1 | `#lobby-tramitacion` | `/proyecto/14309-04` | E-042 `app/components/ficha-rail.tsx:59` | SSR | existe | `<section id="lobby-tramitacion" class="mt-12">` |
| `4.2-A1-lobby-menciones` | 4.2-A1 | `#lobby-menciones` | `/proyecto/14309-04` | E-042 `app/components/ficha-rail.tsx:59` | SSR | existe | `<section id="lobby-menciones" class="mt-12">` |
| `4.2-A1-cruces` | 4.2-A1 | `#cruces` | `/proyecto/14309-04` | E-042 `app/components/ficha-rail.tsx:59` | SSR | existe | `<section id="cruces" class="mt-12">` |
| `4.2-A1-idea-matriz` | 4.2-A1 | `#idea-matriz` | `/proyecto/14309-04` | E-042 `app/components/ficha-rail.tsx:59` | SSR | existe | `<section id="idea-matriz" class="mt-12">` |
| `4.2-A1-cuerpos-legales` | 4.2-A1 | `#cuerpos-legales` | `/proyecto/14309-04` | E-042 `app/components/ficha-rail.tsx:59` | SSR | existe | `<section id="cuerpos-legales" class="mt-12">` |
| `4.2-A1-similares` | 4.2-A1 | `#similares` | `/proyecto/14309-04` | E-042 `app/components/ficha-rail.tsx:59` | SSR | existe | `<section id="similares" class="mt-12">` |
| `4.2-A1-validacion-fuente` | 4.2-A1 | `#validacion-fuente` | `/proyecto/14309-04` | E-042 `app/components/ficha-rail.tsx:59` | SSR | existe | `<section id="validacion-fuente" class="mt-12">` |
| `4.2-A2` | 4.2-A2 | `#idea-matriz` | `/proyecto/14309-04` | E-048 `app/app/proyecto/[boletin]/page.tsx:568` ("Ver la idea matriz completa") | SSR | existe | `<section id="idea-matriz" class="mt-12">` |
| — (no instanciada: gate OFF) | 4.1-A19 | `#dinero` | `/parlamentario/D1165` | E-015 `app/components/contratos-de-parlamentario.tsx:268,281` | SSR | ausente-declarado | inventario 113 §4.1 A19: «**MONEY** (OFF) — `no emitido en el deploy auditado`»; observado: `id="dinero"` AUSENTE (coherente) |
| — (no instanciada: gate OFF) | 4.1-A20 | `#financiamiento` | `/parlamentario/D1165` | E-013 `app/components/financiamiento-de-parlamentario.tsx:420,433` | SSR | ausente-declarado | inventario 113 §4.1 A20: «**MONEY** (OFF) — `no emitido en el deploy auditado`»; observado: `id="financiamiento"` AUSENTE (coherente) |
| — (no instanciada: ruta 404 por gate) | 4.x-A2/A3 `/contraparte/[id]` | `#contratos`, `#aportes` | `/contraparte/[id]` | E-014 `contratos-por-contraparte.tsx:238,251` · E-016 `aportes-por-contraparte.tsx:290,303` | SSR | ausente-declarado | inventario 113: la ruta 404ea entera con **MONEY** OFF (gate en `app/app/contraparte/[id]/page.tsx:50-52`, 404 comprobado 2026-07-27); no hay DOM donde exigir el id |

**Cero `ausente`.** Las 20 entradas del manifiesto resolvieron `existe` por SSR; las 3 filas extra son
del inventario bajo gate MONEY OFF y están **declaradas** por 113, no son defectos.

### D-01 — divergencia de inventario (no es defecto de link)

Inventario 113 §4.1 (línea 1043-1045): «con `S1338` … la `<section id="cruces">` no pinta detalle
(`conteos.cruces.tipo !== "dato"`, `page.tsx:682`) **y por tanto A3 no ofrece la entrada `#cruces`**».
Observado en el deploy: `/parlamentario/S1338` **sí** emite `href="#cruces"` **y sí** tiene
`<section id="cruces" class="mt-12">`. El ancla **no está rota** (emisor y destino coexisten); lo que
diverge es la predicción del inventario sobre el chip. Se reporta a `114-HALLAZGOS.md` como
`## No son defectos` con intención de corrección documental, no de código. El inventario 113 **no se editó**.

### scroll-margin (lección v8.0) — verificado, sin hallazgo

Ninguna `<section id=…>` lleva clase `scroll-mt-*` (0 ocurrencias en las 3 rutas). El precedente v8.0
está cubierto por una regla **global** en `app/app/globals.css:103-108`:

```css
:where([id]) { scroll-margin-top: 5rem; }
```

Comprobado **en el bundle servido** por el deploy (`/_next/static/chunks/1wa_zok604slz.css`), donde
aparece minificada como `:where([id]){scroll-margin-top:5rem}`. Por tanto **ningún ancla existente
queda tapada por el header sticky** y no se abre hallazgo por este motivo.

## Anclas pendientes de BrowserOS

**ninguna — todas las anclas resolvieron por SSR.**
`fallback BrowserOS no requerido — 0 anclas ausentes en SSR` (MISSING-SSR = 0 tanto en la corrida
PRE de 114-01 como en esta re-corrida con la aserción endurecida). Cero screenshots, cero PII (T-114-04).

### Registro del fallback (Task 2)

`fallback BrowserOS no requerido — 0 anclas ausentes en SSR`.

**BrowserOS NO se abrió**, y esta es la rama válida del plan, no una omisión: el fallback existe para
distinguir un ancla de DOM cliente de un ancla rota, y no hubo ninguna candidata. Esto también evita
gratuitamente el riesgo T-114-05 (ráfagas sobre el MCP) y T-114-04 (evidencia con PII arrastrada del
DOM de una ficha). La única comprobación que el plan pedía anotar "por cada ancla que sí existe" —el
`scroll-margin` de la lección v8.0— se resolvió con evidencia **más fuerte** que una observación de
`getComputedStyle`: la regla `:where([id]){scroll-margin-top:5rem}` leída del **bundle CSS que sirve
el deploy**, que cubre por construcción los 20 destinos (todos son `[id]`).
