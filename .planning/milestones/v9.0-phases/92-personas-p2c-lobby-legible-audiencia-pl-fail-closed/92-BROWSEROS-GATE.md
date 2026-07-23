# 92 — GATE BROWSEROS (deploy real)

Veredicto empírico LOCKED de la Fase 92 sobre el deploy LIVE. El gate confirma los TRES
hechos de la fase contra producción: (a) materia de lobby completa/legible + chips de
mención operando en la ficha del parlamentario; (b) sección `#lobby-menciones` en la ficha
del proyecto, SEPARADA de 0048, con leyenda anti-causal y parlamentario enlazado; (c) sin
regresión del header 91 (partido visible).

Ejecutado: 2026-07-22 — Claude (gsd-execute-phase, Plan 92-04, Task 2).

---

## Deploy

- **Build:** OpenNext en Docker `node:22-slim` (Linux — el bundle Windows 500 en runtime por
  `dynamic require` del middleware-manifest). Fuente staged a `C:/Temp/obs-build`
  (tar excl. node_modules/.git/.next/.open-next/.wrangler), `docker-cf-build.sh` +
  copy-back de `/build/app/.open-next` → `/host/app/.open-next`. Next 16, worker.js generado
  (`BUILD_OK`). `MSYS_NO_PATHCONV=1` para el mount de Docker (gotcha de memoria).
- **Deploy:** `wrangler deploy --config wrangler.jsonc` (OAuth local; CI sin creds CF) desde
  `C:/Temp/obs-build/app`. Subió 3 assets nuevos + worker.
- **Versión desplegada:** `fa4d4369-63c4-480e-ac41-4dc83094aa8b`
- **URL:** `https://observatorio-congreso.thevalis.workers.dev`
- **Arrastra los fixes UI de 91** que quedaron fuera del bundle `e0c969af` (verificado en el
  hecho (c): PartidoChip + leyenda cross-link presentes en el deploy nuevo).
- **Smoke HTTP:** `/` 200, `/parlamentario/D1132` 200, `/proyecto/16849-12` 200.

**Nota de método:** `save_screenshot` de BrowserOS falla por CDP timeout (gotcha conocido,
memoria 91-03 / quick-260722). Evidencia primaria = **DOM del deploy real** (curl sobre las
rutas LIVE + parseo del payload RSC/HTML renderizado), precedente 91-03. El DOM es la fuente
de verdad del render server-side; los chips/secciones Suspense-streameados aparecen en el
payload servido por el worker en producción.

---

## (a) Ficha parlamentario con lobby — materia completa + chips (LOB-01/LOB-02)

**Target:** `/parlamentario/D1132` (Jorge Guzmán, Evolución Política) — 8 audiencias
confirmadas cuya materia menciona boletín.

- **Materia COMPLETA y legible (LOB-01):** en la vista AGRUPADA (la que ANTES no mostraba
  materia), cada reunión renderiza `<div class="text-sm whitespace-pre-line leading-relaxed">`
  con la materia ENTERA — p.ej. la materia de "Cámara Nacional de Comercio" (02 ago 2024) se
  lee completa: *"Exponerle en su calidad de jefe de bancada las dificultades que enfrentan
  los sectores gastronómico, pymes y turismo … según propone el PDL N° 16.849-12."* (~430
  caracteres, SIN recorte, sin `line-clamp/truncate/max-h`).
- **Chips "Menciona boletín N" operando (LOB-02):** chips con `font-mono` del número
  (`16849-12`, `15322-05`, `14985-34`, …) bajo la materia, cada uno navegando a
  `/proyecto/N`. Hrefs verificados en el DOM: `/proyecto/16849-12` (×2), `/proyecto/15322-05`,
  `/proyecto/14985-34`, `/proyecto/14767-03`, `/proyecto/16743-04`, etc.
- **Fail-closed DOBLE confirmado en PROD:**
  - materia *"boletín 15.322"* (pelada tras gatillo léxico) → chip a `/proyecto/15322-05`
    (branch b + existencia). ✓
  - materia *"Ley 20422"* / *"Ley 20.730"* → SIN chip (número de ley, no boletín). ✓
  - materia sin número → SIN chip. ✓

## (b) Ficha proyecto mencionado — sección `#lobby-menciones` con leyenda (LOB-02/LOB-03)

**Target:** `/proyecto/16849-12` — la RPC `lobby_menciones_de_boletin('16849-12')` devuelve
13 filas (`total_n=13`) en PROD.

- **Carril HERMANO SEPARADO:** coexisten en el DOM las DOS secciones —
  0048 ("…coincidencia de fechas…", "mismo período") **y** la nueva
  **"Audiencias de lobby que mencionan este boletín"** — como `<section>` distintas
  (heading h2 propio, `mt-12`). NUNCA fusionadas.
- **Leyenda anti-causal LOCKED verbatim** (1×): *"…menciona el número de este boletín en el
  registro público de la Ley del Lobby (Ley 20.730). La mención es un dato del registro;
  **no implica influencia en la tramitación ni relación causal con el proyecto.**"* ✓
- **Parlamentario ENLAZADO (LOB-03, navegación bidireccional PL→audiencia→parlamentario):**
  la sección renderiza links `/parlamentario/{id}` para los parlamentarios que mencionaron
  (`D1059, D1074, D1119, D1132, D1141, D1146` — subconjunto de las 13 filas de la RPC).
- **Contraparte** en texto plano sin RUT; **materia legible** (`whitespace-pre-line`).
- **Empty-state NO presente** (correcto: este boletín tiene 13 menciones reales); 13 ≤ LIMIT
  50 → sin banner de truncación (conteo honesto).

## (c) Sin regresión del header 91 (partido visible)

En `/parlamentario/D1132`:
- **PartidoChip LIVE** (`data-slot="partido-chip"`): `aria-label="Partido: Evolución
  Política, según Cámara al 22 jul 2026"` — partido con **fuente + fecha**, fondo neutro.
- Nombre del header renderiza ("Guzmán").
- **Leyenda cross-link 91** ("afinidad" negada) presente → los 4 bloques cross-link de 91
  siguen montados.
- Confirma que el deploy `fa4d4369` **arrastra los fixes UI de 91** además de lo nuevo de 92.

---

## Veredicto

**COMPRENSIBLE — GATE APROBADO.** Los tres hechos de la Fase 92 están LIVE y verificados
empíricamente sobre `fa4d4369-63c4-480e-ac41-4dc83094aa8b`:
materia de lobby completa/legible en ambas vistas + chips de mención operando (fail-closed
doble); sección `#lobby-menciones` separada con leyenda anti-causal y parlamentario enlazado;
header 91 (partido) sin regresión. LOB-01/LOB-02/LOB-03 verificados en producción.
