# 114-HALLAZGOS — Lista CERRADA de defectos de links internos (Plan 02 → insumo del Plan 03)

**Universo:** las 95 entradas de `scripts/links-internos-manifiesto.mjs` (77/77 refs del inventario
rector 113 cubiertas por igualdad).
**Evidencia base:** `114-CORRIDA-PRE.json` / `.txt` (2026-07-28T01:06:03.406Z — 95 entradas,
PASS 94 · **FAIL 1** · MISSING-SSR 0) y `114-ANCLAS.md` (20/20 anclas `existe` por SSR).

**Disposición del 100% de los FAIL:** la corrida PRE arrojó **un único** FAIL, `4.2.b-404`, y está
dispuesto abajo como `H-01`. No hay ningún otro FAIL sin disposición.

---

## H-01 — `/proyecto/<boletín inexistente>` responde HTTP 200 en vez de 404

| Campo | Valor |
|---|---|
| **id** | `H-01` |
| **síntoma observado** | id de manifiesto `4.2.b-404` · `inventarioRef` **4.2.b-A1** · `tipo=status` · `espera=404` · **observado 200** · causa registrada: `esperaba 404, observado 200` (`114-CORRIDA-PRE.json`) |
| **emisor** | ninguno público — la entrada verifica el **contrato de la ruta**, no un href emitido. El guard vive en `app/app/proyecto/[boletin]/page.tsx:60-62` (`BOLETIN_RE`) y en `FichaSection` (`page.tsx:428-431`, `notFound()` con 0 filas) |
| **destino** | `/proyecto/00000-00` (placeholder sintético, sin sujeto real) |
| **intención** | `añadir el id al destino` — **reformulada**: corregir el **destino**, no el href. No hay href que arreglar; el defecto es del contrato HTTP de la propia ruta |
| **severidad** | media — el contenido correcto SÍ se muestra, pero el status miente |
| **justificación** | Inventario 113 §4.2.b (línea 1227-1230) declara la ruta en estado 404 disparada por `BOLETIN_RE` **y** por `FichaSection` con 0 filas. Observado contra el deploy: `00000-00` **pasa** `BOLETIN_RE` (formato válido), así que el 404 depende del segundo guard, que corre **dentro de un boundary de streaming**: el cuerpo entregado SÍ es la UI de not-found (`"No encontramos"`, `"Buscar en el Senado"`, `"Volver al inicio"` = true) pero llega junto al shell de la ficha (`id="estado"` = true) y con las cabeceras ya enviadas ⇒ el status no puede cambiar a 404. Contraste que lo prueba: `/parlamentario/D0000000` **sí** 404ea (114-01), porque allí la comprobación de existencia ocurre antes de emitir |
| **fix propuesto** | Elevar la comprobación de existencia del proyecto al componente de página (resolver `leerProyecto(boletin)` y llamar `notFound()` **antes** de devolver el árbol/abrir el streaming), dejando `FichaSection` consumiendo la lectura ya cacheada — sin tocar el copy ni los gates |

---

## No son defectos (declarados por 113)

| Observación | Causa declarada | Dónde lo declara |
|---|---|---|
| `/contraparte/<id>` → **404** | La ruta 404ea entera con **MONEY OFF**; el gate es la primera sentencia de `app/app/contraparte/[id]/page.tsx:50-52`. Ninguna superficie pública emite links hacia ella (verificado como `ausencia`, PASS) | Inventario 113 §4.3 + 114-CONTEXT «su 404 no es defecto» |
| Anclas `#dinero`, `#financiamiento`, `#contratos`, `#aportes` ausentes del DOM | **MONEY (OFF)** — el inventario marca esas filas con la cadena literal `no emitido en el deploy auditado` (§4.1 A19/A20 y §4.x de contraparte) | 113 §4.1 líneas 1040-1041; `114-ANCLAS.md` filas `ausente-declarado` |
| `/cuenta` y `/notificaciones/*` sin hrefs propios y sin `/cuenta?next=` en el DOM | **NOTIF (OFF)** — feature inerte; las rutas responden no-404 y el contenido gated es lo esperado | 113 §4 (`no emitido en el deploy auditado`) + 114-CONTEXT |
| `4.1-A5` (`verTodosHref`) no verificado | `null` en los 5 bloques ⇒ el `<a>` **no se emite**: no hay href que solicitar | 113 §4.1 A5; `EXCLUIDOS` del manifiesto (114-01) |
| **Cero anclas de DOM cliente** | MISSING-SSR = 0 en ambas corridas: ninguna ancla existe sólo en el DOM del cliente. El fallback BrowserOS no se requirió | `114-ANCLAS.md` §Anclas pendientes de BrowserOS |
| `scroll-margin` (lección v8.0) | Las `<section id=…>` no llevan `scroll-mt-*`, pero la regla global `:where([id]){scroll-margin-top:5rem}` viaja en el bundle CSS servido (`/_next/static/chunks/1wa_zok604slz.css`) ⇒ ningún ancla queda tapada por el header | `app/app/globals.css:103-108` + bundle del deploy, citado en `114-ANCLAS.md` |
| **D-01 — divergencia de inventario:** `/parlamentario/S1338` **sí** emite `href="#cruces"` y **sí** tiene `<section id="cruces">` | 113 §4.1 (líneas 1043-1045) predice que con `S1338` «A3 no ofrece la entrada `#cruces`». El link **no está roto** (emisor y destino coexisten) ⇒ no es defecto de link, es una predicción documental desactualizada del inventario. **El inventario 113 NO se edita en esta fase** (es rector y está `validado`); la divergencia queda registrada aquí y en `114-ANCLAS.md` §D-01 para quien reabra 113 | `114-01-SUMMARY.md` + `114-ANCLAS.md` |

**Cero hallazgos de régimen.** Ningún patrón declarado `ausencia` apareció con su gate OFF (9/9 PASS):
NET ON, CRUCES ON, MONEY OFF, NOTIF OFF, tal como los fija §5 del inventario. **Ningún flag fue
tocado y ninguno debe tocarse como remedio** de nada de este documento.

---

## Alcance del Plan 03

**Hallazgos a corregir:** `H-01` (único).

**Archivos de `app/` que el Plan 03 tocará:**

| Archivo | Cambio |
|---|---|
| `app/app/proyecto/[boletin]/page.tsx` | Elevar la comprobación de existencia (`leerProyecto` + `notFound()`) fuera del boundary de streaming, para que el 404 salga en las cabeceras |

**Evidencia esperada del Plan 03:** re-corrida de
`node scripts/verificar-links-internos.mjs --route /proyecto --out …/114-CORRIDA-POST` (o razonamiento
de código cuando el fix no sea observable sin deploy), suite + `tsc` + guards de régimen verdes, y
`node scripts/verificar-links-internos.selfcheck.mjs` en exit 0.

**Nota LOCKED:** el deploy de estos fixes **viaja con la Phase 125**; esta fase **JAMÁS deploya y
JAMÁS toca flags**. La verificación del 404 real contra el deploy queda anclada allí.
