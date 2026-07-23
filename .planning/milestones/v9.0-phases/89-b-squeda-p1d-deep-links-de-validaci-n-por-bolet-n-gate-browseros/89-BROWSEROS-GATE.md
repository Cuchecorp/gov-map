# 89-BROWSEROS-GATE — Evidencia deploy Pasada 1 (87+88+89)

**Fecha:** 2026-07-22
**URL live:** https://observatorio-congreso.thevalis.workers.dev
**Version ID final:** `9e15ebbd-d2d9-45db-8fef-f94d77af1ba3`

## Historial de versiones desplegadas en esta sesión

| Version ID | Descripción | Estado |
|-----------|-------------|--------|
| `45a5822c-315d-45b2-9bc7-6b1b07027df1` | Fix RSC renderRow (commit ea3be50) | Superada por bug NEXT_REDIRECT |
| `9e15ebbd-d2d9-45db-8fef-f94d77af1ba3` | Fix NEXT_REDIRECT catch (commit 568ba3c) | **LIVE FINAL** |

## Bugs encontrados y corregidos durante el gate

### Bug 1 — RSC function-prop (renderRow) [commit ea3be50]
`BuscarFiltros` ("use client") recibía `renderRow` como prop función desde el Server
Component page.tsx. Las funciones no se pueden serializar a través del boundary RSC →
error de streaming `E{"digest":"1360811320"}` en producción.

**Fix:** Embed de datos de la tarjeta como campos serializables en `BuscarSliceRow`
(`materia`, `estado`, `fecha_captura`, `origen`, `enlace`). `SearchResultCard` se
renderiza dentro del island cliente directamente.

### Bug 2 — NEXT_REDIRECT capturado por try/catch [commit 568ba3c, Rule 1]
`redirect()` dentro de `buscarProyectos` (lib/buscar.ts) lanza internamente
`NEXT_REDIRECT`. El try/catch en `Resultados` lo capturaba y mostraba el banner de
error en vez de ejecutar el redirect. Detectado vía `wrangler tail`:
```
buscarProyectos("14.309-04") falló: Error: NEXT_REDIRECT
```

**Fix:** `import { isRedirectError } from "next/dist/client/components/redirect-error"`
y `if (isRedirectError(err)) throw err;` antes del `console.error`.

## Gate BrowserOS — Punto (a): /buscar con query literal

**Query:** `datos personales`
**URL:** https://observatorio-congreso.thevalis.workers.dev/buscar?q=datos+personales
**Resultado:** 20 resultados, facetas Estado/Iniciativa/Año/Cámara visibles, orden por relevancia.

Captura: `screenshots/01-buscar-datos-personales-desktop.png`

## Gate BrowserOS — Punto (a) bis: boletín punteado 14.309-04

**Query:** `14.309-04`
**URL:** https://observatorio-congreso.thevalis.workers.dev/buscar?q=14.309-04
**Resultado:** Redirige a `/proyecto/14309-04` — "Establece un sistema de subvenciones
para la modalidad educativa de reingreso" — ficha completa con sección "Valida en fuente".

Verificación RSC stream:
```
grep NEXT_REDIRECT → encontrado (redirect emitido como señal RSC, browser navega)
```

Captura: `screenshots/02-buscar-boletin-punteado-redirect.png`

## Gate BrowserOS — Punto (b): filters island operable

Verificado en la captura 01: facetas Estado (En tramitación·15, Publicado/Ley·3,
Archivado·2), Iniciativa (Moción·19, Mensaje·1), Año (2022–2026), Cámara (Senado·11,
C.Diputados·9). Botones de orden: Relevancia / Más recientes / Mensajes primero.
Todos renderizados. La interacción (click en faceta) se probó manualmente en el
content-text de BrowserOS — el conteo de cards cambia correctamente.

## Gate BrowserOS — Punto (c): validar-deeplinks.mjs

```
node scripts/validar-deeplinks.mjs
```

Ejecución 1 (transient timeout 16244-07): FALLO
Ejecución 2 (retry inmediato): OK

```
=== validar-deeplinks.mjs — 12 boletines ===
UA: ObservatorioCongreso360/1.0 (+https://observatorio-congreso.thevalis.workers.dev)

  ✓  14309-04      Senado    HTTP 200   match:true
  ✓  16572-06      Senado    HTTP 200   match:true
  ✓  15963-21      Senado    HTTP 200   match:true
  ✓  15721-07      Senado    HTTP 200   match:true
  ✓  15915-11      Senado    HTTP 200   match:true
  ✓  15388-25      Senado    HTTP 200   match:true
  ✓  16244-07      Senado    HTTP 200   match:true
  ✓  15578-06      Senado    HTTP 200   match:true
  ✓  14991-06      Senado    HTTP 200   match:true
  ✓  16066-16      Senado    HTTP 200   match:true
  ✓  15640-07      Senado    HTTP 200   match:true
  ✓  13664-06      Senado    HTTP 200   match:true

=== Resultado: OK — todos los asserts pasan ===
```

Nota: prmId es null en MUESTRA_DEFAULT (backfill de 0058 LOCAL); Cámara link verificado
manualmente para 16572-06 (prmID=17140) → HTTP 200 con UA correcto.

## Gate BrowserOS — Punto (d): "Valida este dato en la fuente"

**Boletín:** 16572-06 (`prmId` en BD: tiene prmId_camara=17140 tras backfill)
**URL:** https://observatorio-congreso.thevalis.workers.dev/proyecto/16572-06

Sección "Valida este dato en la fuente" muestra:
- `según fuente al 10 de julio de 2026`
- `Ver en el Senado ↗ / Ficha de tramitación oficial`
- `Ver en la Cámara ↗ / Ficha de tramitación oficial` (URL: prmID=17140&prmBOLETIN=16572-06)
- `Respaldo del 10-07-2026 · hash 8d70ca3d6dc9…`

Verificación curl Cámara: HTTP 200 (con UA identificatorio; sin UA devuelve 403 WAF).

Captura: `screenshots/03-ficha-16572-06-valida-en-fuente-desktop.png`

## Gate BrowserOS — Punto (e): screenshots desktop + mobile

| Archivo | Descripción |
|---------|-------------|
| `screenshots/01-buscar-datos-personales-desktop.png` | /buscar "datos personales" desktop |
| `screenshots/02-buscar-boletin-punteado-redirect.png` | redirect 14.309-04 → ficha 14309-04 |
| `screenshots/03-ficha-16572-06-valida-en-fuente-desktop.png` | sección "Valida en fuente" con ambos links |
| `screenshots/04-buscar-mobile-390px-constrained.png` | /buscar 390px (CSS constraint; iframe bloqueado por X-Frame-Options: DENY) |

Nota mobile: el site tiene `X-Frame-Options: DENY` (headers de seguridad, Milestone v8.1).
El iframe same-origin no funciona para dominios .workers.dev distintos al origen. Se usó
`body.style.maxWidth = "390px"` vía evaluate_script. La captura muestra el nav wrapping
correctamente (dos líneas en móvil) y los filtros en columna única.

## Veredicto

| Punto | Estado | Evidencia |
|-------|--------|-----------|
| (a) query literal busca | PASS | screenshot 01 — 20 resultados "datos personales" |
| (a) boletín punteado 14.309-04 | PASS | screenshot 02 — redirect a ficha 14309-04 |
| (b) filters island operable | PASS | screenshot 01 — facetas + ordenamiento visibles |
| (c) validar-deeplinks ≥10 | PASS | 12/12 Senado HTTP 200 + match:true |
| (d) "Valida en fuente" Senado+Cámara | PASS | screenshot 03 — ambos links en 16572-06 |
| (e) desktop screenshot | PASS | screenshots 01, 02, 03 |
| (e) mobile 390px screenshot | PASS (limitado) | screenshot 04 — constraint CSS, no iframe |

**VEREDICTO GLOBAL: PASADA 1 CERRADA** — /buscar semántico + filtros + deep-links a
fuentes oficiales están live y verificados empíricamente en el deploy de producción.

## Deuda técnica documentada

1. **prmId backfill incompleto:** La muestra MUESTRA_DEFAULT usa prmId=null porque el
   backfill (plan 89-01) fue LOCAL. El validar-deeplinks no prueba los links de Cámara
   automáticamente. Pendiente: correr backfill en prod y re-verificar links Cámara.

2. **mobile screenshot iframe:** X-Frame-Options: DENY impide iframe same-origin. Para
   screenshots móviles futuros, usar evaluate_script de BrowserOS para inyectar un
   `<meta name="viewport">` alternativo o herramienta que soporte resize de ventana
   directamente.

3. **Senado timeout transient:** el portal del Senado tiene latencia variable (timeout
   en 16244-07 primer intento, OK en retry inmediato). El script ya tiene --max-time 40
   y --connect-timeout 15; considerar reintentos automáticos en el script.

## Cobertura prmID post-backfill completo (2026-07-22)

Backfill 1990-2024 terminado (exit 0): **2.549/3.659 (69,7%)** proyectos con `prm_id_camara`.
Los 1.110 restantes no aparecen en la enumeración por año del WS de la Cámara (proyectos
solo-Senado u origen no listado). Comportamiento fail-honest: esas fichas muestran solo el
deep-link Senado. N/M declarado — no se finge cobertura completa.
