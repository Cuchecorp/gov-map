# Phase 133-a — ADDENDUM DE IMPLEMENTACIÓN

**Fecha:** 2026-08-06
**Adjudica:** **Opus**, bajo **D-133-RATIF**.
**Qué es:** las decisiones de **implementación** que el research (`133-RESEARCH.md`) demostró
necesarias para ejecutar lo ya firmado. **No re-abre ninguna decisión LOCKED** — la re-adjudicación
firmada sigue mandando. Donde el texto firmado no era literalmente implementable, aquí se fija la
**lectura fiel a su intención**, con la evidencia que la obliga.

**Regla de este documento:** cada decisión cita `ruta:línea`. Si una interpretación se aparta de la
letra de lo firmado, se dice **explícitamente** en vez de disimularlo.

---

## 🔴 HALLAZGO QUE EL OPERADOR DEBE CONOCER — los 206 tests de la Phase 132 nunca han corrido en CI

`.github/workflows/ci.yml` tiene exactamente **tres** steps de test: `./app` (`:47`), `@obs/llm`
(`:59`) y `@obs/cruces` (`:64`). **No hay step para `@obs/news`.** El paquete completo que la
Phase 132 construyó —206 tests— es **CI-dark**: corre en `pnpm test` de raíz (`package.json:11`),
que nadie ejecuta automáticamente, y jamás en un push.

Esto no invalida la verificación de la 132 (los tests existen y pasan localmente), pero sí significa
que **la 132 quedó sin red de seguridad automática**, y que cualquier regresión futura en
`packages/news` sale verde en CI. Es exactamente el patrón "paquete CI-DARK" que este repo ya pagó
en la Phase 43. Se corrige en 133-a (D-133-K2) para el paquete de news; **la deuda de raíz —CI corre
3 de ~17 workspaces— se declara y NO se arregla aquí**, porque destapar rojos de otros paquetes en
medio de esta fase es riesgo no presupuestado.

---

## D-133-J1 — El truncado compartido (interpretación de D-133-F2.1)

**Lo firmado:** *"`entrada_llm` usa la MISMA función de truncado que el pre-filtro, importada de
`prefiltro-lexico.ts` — no una constante replicada."*

**Por qué no es literal:** la única función de truncado existente es `construirTexto`
(`packages/news/src/prefiltro-lexico.ts:109-123`), privada, y hace **cuatro** cosas: despoja HTML
(`:110`,`:118`), **foldea** (quita tildes, baja a minúsculas — `fold`, `:93-100`), trunca
(`:119-121`) y **fusiona título+descripción en un solo string** (`:122`). Llamarla literalmente haría
que el golden guardara `"reforma previsional avanza en el senado..."` sin tildes, en minúsculas y
con los campos fusionados — contra el propio esquema de D-133-F2 (`titulo` y `descripcion`
**separados**) y contra D-133-C2.2 (*"cita el fragmento literal"*: un fragmento foldeado no es
literal).

**DECISIÓN:** la decisión firmada ataca **la constante replicada**, no la normalización. Se cumple:

1. Extraer `truncarDescripcion(texto: string): string` como **export** de `prefiltro-lexico.ts`,
   con la lógica actual de `:119-121` (slice a `LIMITE_DESCRIPCION + MARGEN_TRUNCADO` + corte en
   frontera de palabra). `LIMITE_DESCRIPCION` y `MARGEN_TRUNCADO` **siguen privados y sin duplicar**
   — que es lo que la decisión protege.
2. `construirTexto` se reescribe para llamarla. **Diff-cero de comportamiento**, demostrable con la
   suite existente (`prefiltro-lexico.test.ts`, incluido el test de frontera de palabra `:188-192`
   que ejercita el corte a 600). Criterio: el **conteo impreso** de la suite del paquete es idéntico
   antes y después.
3. `entrada_llm` llama a la **misma función**, aplicada a la descripción **despojada pero SIN
   foldear**, con `titulo` y `descripcion` separados.
4. **Riesgo residual que se TESTEA, no se asume:** aplicar el truncado a texto sin foldear puede
   cortar en un índice distinto que aplicarlo al foldeado si `fold` cambia la longitud. El plan
   incluye un test que compara ambos cortes sobre los **5 fixtures reales**
   (`packages/news/src/__fixtures__/*.xml`) y **declara el resultado en el reporte**.
   **Si difieren en algún fixture, el ejecutor PARA y escala** — no elige un lado en silencio.

---

## D-133-J2 — De dónde saca G1 los términos prohibidos (interpretación de D-133-A2.4)

**Por qué no es literal:** `TERMINOS_PROHIBIDOS` (`app/lib/anti-insinuacion-guard.test.ts:623`) y
`NEGACIONES_LOCKED` (`:764`) **no están exportados**, viven dentro de un `.test.ts`, y
`NEGACIONES_LOCKED` importa cinco constantes de componentes `.tsx` (`:33-40`) que exigen jsdom y el
alias `@` de `app/vitest.config.ts:7`. Además `app/` **no depende de ningún `@obs/*`** por régimen
documentado en tres lugares (`app/lib/week-utils.ts:3`, `app/lib/types.ts:4`,
`app/lib/name-match-rut-guard.test.ts:79`).

**DECISIÓN — vía B, acotada:**

1. Extraer **solo** `TERMINOS_PROHIBIDOS` y sus sub-listas (`TERMINOS_LINK_EXT`,
   `TERMINOS_COBERTURA`) a `app/lib/terminos-insinuacion.ts` — módulo sin JSX y sin imports de
   componentes. El guard existente pasa a **importarlo**. Es el patrón que el propio guard ya
   argumenta para `IDIOMS_APROBADOS` (`:759-768`: *"este archivo IMPORTA el array, no lo re-tipea,
   así un stem mal escrito rompe el import en vez de divergir en silencio entre dos copias"*).
2. **`NEGACIONES_LOCKED` se queda donde está.** Mover un array que importa `.tsx` arrastraría jsdom
   al carril de news.
3. G1, desde `packages/news/src/eval/`, lee `terminos-insinuacion.ts` **por disco** (bytes, no
   import ⇒ **no se crea arista en el grafo de módulos** y la dirección `app`→`packages` no se
   invierte), con **piso duro** sobre el conteo extraído para que un fallo de extracción sea
   ruidoso y no un cero vacuo.
4. **Sobre las negaciones:** semánticamente son un conjunto que se **resta** antes de matchear
   (`:865-871`), no uno que se busca. Lo implementable y fiel: G1 aplica **la misma sustracción**
   antes del match y **asserta que la sustracción no removió nada** — si una glosa de la taxonomía
   contuviera una negación LOCKED verbatim, eso es un hallazgo que **debe fallar**.
5. **Criterio de diff-cero:** el conteo impreso de `pnpm --filter ./app test` es **idéntico antes y
   después** de tocar el guard. Se toca en el mismo commit que G3 (una sola pasada sobre el archivo
   más sensible del repo).
6. **PROHIBIDA la vía C** (replicar la lista en `packages/news`): es literalmente "la deuda de ICS en
   miniatura" que esta fase existe para evitar.

---

## D-133-J3 — El skip silencioso son DOS, y se cierran los dos

**Lo firmado** nombra `app/lib/anti-insinuacion-guard.test.ts:943-948`. **Verificado:** el mismo
`try/catch continue` está también en **`:974-978`** (test `(1b)` WR-03). Cerrar solo el primero deja
el segundo guard ciego con el mismo modo de fallo.

**DECISIÓN: se cierran ambos.** No contradice lo firmado — lo amplía en la dirección obvia de su
intención (*"un guard ciego que sale verde es el falso verde de manual"*). El reporte debe decir
**dos**, no uno: cerrar la mitad y reportarlo como cerrado sería el falso verde de esta fase.

**Habilitador verificado:** un script sobre los 14 arrays `SUPERFICIES_*` da **63 rutas declaradas,
0 faltantes**. Convertir el skip en fallo duro **no pone la suite roja hoy**. El plan **no** debe
presupuestar reparación de allowlist — pero **sí** debe re-verificar el conteo en ejecución, porque
un archivo movido entre hoy y la ejecución cambia el resultado.

---

## D-133-K1 — Dónde vive G2 y cómo enumera

**DECISIÓN: G2 vive en `packages/news/src/eval/taxonomia-superficie-guard.test.ts`** e importa
`TAXONOMIA` de su propia carpeta (single-source respetado, D-133-A2). Lee `app/` **por disco**,
localizándolo con `findWorkspaceRoot` (`packages/news/src/run-news-cli.ts:190-202`, ya exportada por
el barrel `:46`) — que **lanza** si no encuentra `pnpm-workspace.yaml`, o sea **fail-loud, no skip**.
Prohibido `resolve(dirname, "../../../../app")`: se rompe en silencio al mover el archivo.

Rechazada la alternativa `G2-app`: añadiría la **primera** dependencia `@obs/*` de `app/`, rompiendo
un régimen documentado en tres lugares. Rechazada `G2-app-replicado`: viola D-133-A2.

**Cómo enumera:**
- **Walk completo de `app/`, sin allowlist** (patrón `walkSourceFiles`,
  `app/lib/lockdown-guard.test.ts:113-135`). La sobre-cobertura es **virtud**: nunca produce un
  falso verde, solo falsos rojos ruidosos. Es lo que mata de raíz el modo de fallo P-01 del
  premortem.
- **Anti-cero-vacuo obligatorio:** el walk tiene `try { readdirSync } catch { return out }`
  (`:116-120`) ⇒ raíz mal resuelta = `[]` = verde habiendo escaneado nada. Piso realista
  (`> 100` archivos, no el `> 10` laxo del existente) **más** sanity de archivo concreto conocido
  (idiom de `anti-insinuacion-guard.test.ts:920-932`).
- **G2 NO strippea comentarios.** Es más simple y estrictamente más estricto que reusar
  `stripTsComments` (`:81-95`). Se escribe en el JSDoc para que sea decisión, no descuido.
- Los `.test.ts` quedan excluidos por el filtro de `:132` — necesario, o G2 se cazaría a sí mismo.

---

## D-133-K2 — CI: se añade el step de `@obs/news`, la deuda de raíz se declara

**DECISIÓN:** el plan añade a `.github/workflows/ci.yml` un step
`pnpm --filter @obs/news exec vitest run` con el molde de `:59`/`:64`, y su criterio de aceptación
asserta el **conteo impreso** (`Tests N passed`), jamás el exit code — `passWithNoTests: true` está
activo y los args de `vitest run` son **filtros de nombre, no rutas**.

Sin este step, G1 + G2 + `congelado.test.ts` + el test de sincronía nacen **CI-dark**: guards que
nadie corre, que es el falso verde exacto que esta fase existe para evitar.

**La deuda de raíz (CI corre 3 de ~17 workspaces) se DECLARA por escrito en el reporte y NO se
arregla aquí.** Convertir `ci.yml` a `pnpm test` podría destapar rojos de otros paquetes en medio de
133-a: riesgo no presupuestado, y la fase perdería su foco.

---

## D-133-K3 — Los guards nuevos entran al script `guards` de la raíz

**DECISIÓN:** G1, G2 y `congelado.test.ts` se añaden **por nombre** al script `guards` de la raíz
(`package.json:14`), con el molde de `@obs/dinero`/`@obs/llm`. Pasan de 17 a 20 guards de régimen.
El JSDoc de `package.json:12` declara ese script como *"el entrypoint reproducible de los guards de
régimen"*: dejar tres guards de régimen fuera es incoherente con su propia declaración.

**Jamás por glob.** El propio JSDoc lo dice (D-13): *"`vitest run src/*guard*.test.ts` sale 0 sin
correr nada"*.

**Corolario que el plan debe respetar:** G3 se implementa **modificando**
`anti-insinuacion-guard.test.ts`, no creando un archivo nuevo en `app/lib/`. Si se creara uno,
`create-view-guard.test.ts:435-442` (*"todo guard EN DISCO está listado en el script"*) se pone rojo
hasta añadirlo a `app/package.json:9` **en el mismo commit**.

---

## D-133-K4 — Alcance del `.gitattributes`

**DECISIÓN:** solo el patrón firmado, `packages/news/src/eval/**/*.json text eol=lf`. **No se
amplía a `.md`**: `CONGELADO.md` no se hashea directamente y su assert busca substrings de hash, que
un CRLF no rompe. Ampliar sin razón es alcance gratuito sobre un archivo que no existe hoy en el
repo.

**Gotchas verificados empíricamente (clon temporal), que el plan hereda:**
- `git add --renormalize` **no toca archivos ajenos**: `core.autocrlf=false` local y global, y
  ningún `.json` trackeado tiene CRLF hoy. Aun así, el plan lo corre **con pathspec acotado**.
- **`--renormalize` NO añade archivos untracked** ⇒ los JSON nuevos necesitan `git add` normal
  primero. Este es el orden que hace que el hash se mueva solo si se invierte.
- **Control positivo obligatorio:** clon limpio en un segundo directorio → los tres sha256 coinciden.
  Un hash cuya estabilidad se **asume** es peor que no tener hash.

---

## Lo que este addendum NO cambia

La taxonomía, los umbrales, el protocolo, la partición 133-a/133-b, el enrutamiento, T9, la regla de
intervalos, la refutación pre-registrada y D-133-H siguen **exactamente** como los firmó el operador
el 2026-08-06. Aquí solo se decide **cómo se implementan**, con la evidencia que obligó a cada
lectura.

---

*Phase 133-a — Addendum de implementación, Opus, 2026-08-06. Insumo: `133-RESEARCH.md`.*
