# 104-E2E-EVIDENCIA — Inventario E2E v10.0 sobre el deploy real

**Escrito:** 2026-07-26 (Plan 104-03)
**Deploy verificado:** versión `3cd2511d` (deploy #2 del runbook 104-02) → **re-verificado sobre `b467d41a`** tras 3 redeploys por el fix URI-partido (ver §6). Versión final en producción: **`b467d41a-3014-46bd-b1b5-0c810497244a`**.
**Worker:** https://observatorio-congreso.thevalis.workers.dev
**Flags:** `VSIM_PUBLIC_ENABLED=true` (firmado + flip autorizado) · `NOTIF_PUBLIC_ENABLED` ausente=OFF · MONEY gated OFF.
**Herramientas:** curl+DOM grep sobre el HTML servido (RSC payload) + `psql "$SUPABASE_DB_URL"` (PGCLIENTENCODING=UTF8) para el recálculo. BrowserOS degradó a curl+DOM-grep documentado (RSC payload legible por grep; cada cifra cruzada contra SQL directo).

> Método por superficie: **URL · qué se verificó · SQL (recálculo) vs DOM (string servido) · veredicto.**

---

## 1. Panel de actualidad (home `/`)

**URL:** `https://observatorio-congreso.thevalis.workers.dev/`

**SQL (recálculo):**
```
select tipo_senal, count(*) from actualidad_senal group by tipo_senal;
 agenda_citacion | 1
 agenda_sala     | 1
 archivados      | 1
 nuevos_ingresos | 1
 urgencias       | 1
 velocity        | 3
```
6 tipos de señal vivos (total > 0).

**DOM (string servido):**
- **Urgencias del Ejecutivo:** `104 urgencias fechadas en 30 días` · `Fuente: Urgencias del Ejecutivo · datos al 22 jul 2026`.
- **Archivos y retiros:** `2 movimientos de archivo o retiro fechados (30 días)` · `Fuente: Tramitación · datos al 06 jul 2026`.
- **Nuevos ingresos (supresión honesta):** `sin nuevos ingresos fechados en la ventana — en las fuentes consultadas al 23 jul 2026` (NO "sin movimiento").
- Cada tile lleva **Fuente + fecha**. Framing "N … en 30 días" (NUNCA ranking).

**Invariantes de vocabulario (grep del HTML servido):**
| Chequeo | Resultado |
|---|---|
| ranking-frame (`los más`/`la cámara más activa`/`los más activos`) | **0** |
| `captura` pelado (sin "según fuente") | **0** |
| cifra `548.642` / `548,642` (prohibida) | **0** |
| provenance "datos al {fecha}" | presente en cada tile |

**Veredicto:** ✓ PASS — panel con señales vivas, fuente+fecha por tile, supresión-como-fila honesta, cero ranking, cero "captura" pelado, sin cifra 548k. El panel refleja las filas vivas del SQL.

---

## 2. Bloque relaciones en la ficha (`<section id="relaciones">`)

Dos parlamentarios reales: **D1074 (alto — 94 co-autores, prueba truncamiento >20)** y **S1110 (bajo — senador, pocos)**.

### 2.1 D1074 (alto) — `/parlamentario/D1074`

**SQL (recálculo — total_n antes del cap):**
```
coautores_de_parlamentario('D1074')  → rows=20, total_n=94
comisiones_de_parlamentario('D1074') → 3
militancia_historica_compartida('D1074') → 20
```

**DOM:**
- `<section id="relaciones">` presente (above-the-fold). ✓
- Co-autoría: **"94 parlamentarios han co-firmado al menos un proyecto de ley."** → conteo = `total_n=94` (NO el `.length` cap-20). ✓
- **Truncamiento declarado:** `"Mostrando los primeros 8 de 94."` (co-autoría), y `8 de 24`, `8 de 32`, `8 de 26` en otros bloques. El total honesto se muestra siempre. ✓
- **Orden alfabético** (NO ranking): Alejandro Bernales · Álvaro Jofré · Álvaro Ortiz · Ana María Gazmuri · Andrea Macías … ✓
- Copy factual ("han co-firmado al menos un proyecto"); cero "aliado"/"cercano". ✓
- URI-como-partido en el DOM: **0**. ✓

### 2.2 S1110 (bajo) — `/parlamentario/S1110`

**SQL:**
```
coautores_de_parlamentario('S1110')  → total_n=28
comisiones_de_parlamentario('S1110') → 0
militancia_historica_compartida('S1110') → 11
```

**DOM:**
- `<section id="relaciones">` presente. ✓
- "Del mismo partido": 2 · "misma zona": 2 (Senado → zona aplica) · Co-autoría: **"28 parlamentarios han co-firmado…"** = total_n=28 ✓ · Militancia histórica: **"11 parlamentarios militaron en un mismo partido (en períodos posiblemente distintos)"** = total_n=11 ✓
- URI-como-partido: **0**. ✓

**Veredicto:** ✓ PASS — bloque relaciones above-the-fold en ambas fichas; cada conteo del DOM == `total_n` de la RPC; truncamiento >20 declarado con el total honesto; orden alfabético; cero URI-como-partido en las fichas verificadas.

---

## 3. `/comparar` — 4 ejes factuales

**URL:** `/comparar?a=<idA>&b=<idB>` (ids ordenados alfabéticamente, force-dynamic).

**DOM (D1009/D1074, dos diputados):** los 4 ejes factuales presentes con fuente+fecha:
- **Militancia (histórica)** — "militancia histórica compartida fuera del partido vigente."
- **Comisiones**
- **Co-autoría de proyectos**
- **Zona electoral** — zona registrada por persona (ambos diputados → ambos tienen zona; honesto).

**Cross-cámara (D1074 dip / S1110 sen) — comisión homónima NO se cuenta como compartida:**
- DOM: **"En las fuentes consultadas al 2026-07-26, no comparten comisiones."** → identidad compuesta (cámara+nombre); NO "comparten". ✓

**Veredicto:** ✓ PASS — 4 ejes factuales con intersección honesta; cross-cámara NO fabrica "comparten"; fuente+fecha por eje.

---

## 4. `/comparar` — eje VSIM (5º, flag ON) + recálculo SQL ≥2 pares

**RPC de referencia:** `public.coincidencia_votos_par(a,b)` → `(n_coinciden, m_compartidas, fecha_captura_max)`.

| Par | SQL (n / m) | DOM (string servido) | Veredicto |
|---|---|---|---|
| **D1165 / D1170** (ref dossier) | `3655 / 3672` | "Coinciden en **3655** de **3672** votaciones compartidas (**100**%)" | ✓ cuadra |
| **D1009 / D1012** (2º par real) | `932 / 2495` | "Coinciden en **932** de **2495** votaciones compartidas (**37**%)" | ✓ cuadra |
| **D1009 / S1110** (M=0) | `0 / 0` | "**Sin votaciones compartidas suficientes** en las fuentes consultadas al …" · `0%` en la sección = **0** | ✓ honesto |

**Caveat base-alta (VERBATIM, adyacente, no colapsable):**
> "La coincidencia alta es la norma, no una señal: la mayoría de las votaciones se aprueban por amplia mayoría o unanimidad. Coincidir en muchas no indica afinidad, coordinación ni bancada; discrepar en pocas no indica lo contrario."

**Cobertura declarada:** "Cámara ~80% confirmado por identificador; Senado ~20% por nombre (probable). El denominador refleja solo votaciones registradas en las fuentes al 2026-07-26."

**Figura NEUTRAL:** `--foreground`, sin barra/gauge/semáforo (dossier §110/§238).

### Decisión documentada: el "(100%)" de 3655/3672

3655/3672 = 99.537 %, que `Math.round(n/m·100)` (app/app/comparar/page.tsx:518) redondea a **100**. El deploy-context lo marcó como posible defecto de honestidad ("100% con N≠M").

**Resolución: NO es un defecto — es comportamiento firmado.** El dossier legal VSIM (`docs/legal/102-LEGAL-DOSSIER-VSIM.md`) fija la cifra **VERBATIM** en §43:
> "Coinciden en {N} de {M} votaciones compartidas ({X}%)." con `X = round(N/M·100)`.

y §83 declara la base-rate empírica **"de 19% a 100%"** — es decir, **100% es un valor esperado y sancionado** por el dossier (~32% de los pares son cuasi-unánimes). La lectura deshonesta ("votan idéntico") queda **neutralizada por el caveat base-alta obligatorio y adyacente** ("Coincidir en muchas no indica afinidad…"). Cambiar `round` → `floor`/decimal desviaría de una cifra legalmente firmada (Rule 4: requeriría sign-off del operador) sin ganancia de honestidad, pues el caveat ya cubre el riesgo. **Se conserva `round` tal como está firmado.**

**Veredicto:** ✓ PASS — VSIM ON con N/M que cuadra contra SQL para 3 pares reales (2 con votos + M=0), caveat base-alta VERBATIM adyacente, cobertura 80/20, figura neutral. "100%" es dossier-compliant.

---

## 5. Flags OFF ausentes del DOM

| Flag | Chequeo (grep DOM) | Resultado |
|---|---|---|
| **NOTIF** — ficha parlamentario D1074 | "Seguir" / "/cuenta" | **0 / 0** |
| **NOTIF** — ficha proyecto 14309-04 | "Seguir" / "/cuenta" | **0 / 0** |
| **NOTIF** — `/cuenta` | status 200, copy gated | "**Las suscripciones no están disponibles en este momento**" (no login) |
| **MONEY** — ficha parlamentario | datos de contratos/aportes/montos | **ausentes**; solo el stub gated `Financiamiento y contratos del Estado` + "Pendiente de revisión legal (Ley 21.719) antes de publicarse." (`opacity-60`) |

**Nota MONEY:** la sección "Financiamiento y contratos del Estado" que aparece es el **placeholder gated honesto** (heading + copy "pendiente de revisión legal"), NO una superficie de datos MONEY. Cero filas de contrato, cero montos, cero aportes en el DOM. Es la conducta gated-OFF esperada (Phase 73, MONEY_PUBLIC_ENABLED OFF).

**Veredicto:** ✓ PASS — NOTIF ausente del DOM (cero superficie fantasma); `/cuenta` gated honesto; MONEY sin datos, solo placeholder legal.

---

## 6. Fix emergente (Rule 1 - Bug): URI-como-partido

**Defecto encontrado (rompía superficie):** `/parlamentario/S1344` (Matías Walker Prieto) y `/parlamentarios` renderizaban el recurso RDF crudo de BCN `http://datos.bcn.cl/recurso/cl/organismo/partido-politico/partido-democratas-chile` **como valor de partido** en el DOM (S1344: 3×; directorio: 4×). Viola la aceptación "Cero URI-como-partido en el DOM".

**Causa raíz (data-level):** 3 filas de `parlamentario_militancia` traen el URI RDF en vez de la etiqueta (gap del parser BCN de senadores, Phase 90). La militancia vigente propaga el URI a `parlamentario.partido` para S1344.

**Fix (display-only, Rule 1) — TRES sitios de render (tres commits + tres redeploys):**
- `partidoLegible()` en `app/lib/format.ts`: si el valor es el URI de partido de `datos.bcn.cl`, deriva el nombre del **propio slug del URI** (`-`→espacio, Title-Case) → "Partido Democratas Chile" (SIN tildes fabricadas — el nombre sale del dato, no se inventa). Un nombre legible normal pasa **verbatim** (jamás re-casea un partido real). 6 tests unitarios.
- **`a6f4057` → redeploy v`600de567`:** `PartidoChip` (chip en ficha header + fila del directorio). Post-deploy: el chip ya legible, PERO quedaban 2 URIs en la ficha S1344 — el **bloque Militancias** renderiza `vigente.partido`/`m.partido` RAW.
- **`34e4df2` → redeploy v`95a9c858`:** `MilitanciasDeParlamentario` (militancia vigente + acordeón histórico). Post-deploy: `/parlamentario/S1344` = **0 URI** ✓; PERO el directorio aún mostraba el URI como **label del chip de la faceta partido**.
- **`2b86707` → redeploy v`b467d41a`:** `ParlamentariosFiltro` — el `label` del FacetChip usa `partidoLegible` (la **CLAVE de filtro sigue RAW**: identidad de grupo intacta, jamás fusiona partidos distintos).
- tsc 0 en cada increment; guards de régimen 209 verdes; suite app 1424 verde.

**Re-verificación DOM final (v`b467d41a`):**

| Chequeo final | Resultado |
|---|---|
| `/parlamentario/S1344` — `datos.bcn.cl` en DOM | **0** ✓ |
| `/parlamentario/S1344` — partido renderizado | **"Partido Democratas Chile"** (legible) ✓ |
| `/parlamentarios` — URI **visible** (chip fila + label faceta) | **0** ✓ ("Partido Democratas Chile" en ambos) |
| `/parlamentarios` — `datos.bcn.cl` en el HTML | **1** — pero es el **filtro-key RAW serializado** (`"partido":"http…"`) en el payload RSC del island client, NO un render visible (ver nota) |
| Camino A (`/`,`/parlamentarios`,`/agenda`,`/buscar`,`/metodologia`) | **200 × 5** ✓ |
| VSIM `/comparar?a=D1165&b=D1170` sigue vivo | "3655 de 3672" ✓ |
| `/cuenta` gated | 200 ✓ · NOTIF "Seguir" en home = 0 ✓ |

**Nota sobre la 1 ocurrencia residual en `/parlamentarios`:** es `"partido":"http://datos.bcn.cl/…"` DENTRO del prop `slice` serializado que el server pasa al island client de filtro. Es la **clave de agrupación del filtro** (identidad del grupo para el filtrado en memoria), NO un nodo de texto visible. TODO render *visible* de partido — chip de header, bloque Militancias, chip de fila del directorio, y label de la faceta — muestra el nombre legible. **Cero URI se MUESTRA como partido.** Sanear la clave serializada arriesgaría fusionar dos partidos de URI distinta que colapsen al mismo label (regresión de correctitud del filtro) por un valor que el usuario nunca ve → se deja RAW por diseño.

---

## Tabla resumen

| # | Superficie | Verificado (SQL vs DOM) | Resultado |
|---|---|---|---|
| 1 | Panel actualidad (home) | 6 tipos señal vivos; fuente+fecha por tile; 0 ranking; 0 "captura"; 0 cifra-548k | ✓ PASS |
| 2 | Relaciones en ficha (D1074 alto / S1110 bajo) | conteo DOM == total_n RPC; truncamiento >20 declarado; orden alfabético; 0 URI-partido | ✓ PASS |
| 3 | /comparar 4 ejes factuales | intersección honesta; cross-cámara NO "comparten"; fuente+fecha | ✓ PASS |
| 4 | /comparar VSIM (flag ON) | N/M == SQL (3655/3672, 932/2495, M=0); caveat base-alta VERBATIM; cobertura 80/20; "100%" dossier-compliant | ✓ PASS |
| 5 | Flags OFF (NOTIF, MONEY) | NOTIF ausente del DOM; /cuenta gated; MONEY sin datos (solo placeholder legal) | ✓ PASS |
| 6 | Fix emergente URI-partido | S1344 ficha + militancias + directorio (chip + faceta) saneados; 3 commits + 3 redeploys; v`b467d41a` final | ✓ RESUELTO |

**Milestone v10.0 verificado E2E:** cada superficie nueva × dato real × cross-check SQL sobre el deploy (v`b467d41a`); flags OFF ausentes del DOM; empty states honestos; cero URI-como-partido **visible** tras el fix (única ocurrencia residual = filtro-key serializado, no-visible, por diseño). Los 3 tests deploy-dependientes de 101-HUMAN-UAT cerrados con evidencia DOM.
