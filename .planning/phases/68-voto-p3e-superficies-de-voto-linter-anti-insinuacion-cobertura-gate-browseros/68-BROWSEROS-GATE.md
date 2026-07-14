---
phase: 68-voto-p3e-superficies-de-voto-linter-anti-insinuacion-cobertura-gate-browseros
plan: 04
doc: BROWSEROS-GATE
type: operator-runbook
requirement: VOTO-05 (cláusula BrowserOS "comprensible" / SC#4)
gate: checkpoint:human-verify (autonomous:false) — OPERADOR
status: PENDING (esperando veredicto del operador)
created: 2026-07-14
---

# Phase 68 — Gate de comprensión BrowserOS ("comprensible")

> Runbook de operador para la **lectura fría ciudadana** sobre la sección "Votaciones"
> de la ficha del parlamentario ya desplegada. Cierra la cláusula BrowserOS de VOTO-05
> (SC#4). Es un **gate de operador**: el agente NO corre BrowserOS, NO despliega, y NO
> finge capturas. Este doc entrega el pre-flight, el procedimiento CDP y la rúbrica de
> aprobación; el operador ejecuta y registra el veredicto.

---

## 0. Por qué este gate no es automatizable

Todo lo *offline-testable* de la fase 68 ya quedó verde en los planes 01–03:

| Propiedad | Prueba | Estado |
|-----------|--------|--------|
| Linter anti-insinuación (términos prohibidos en copy renderizado) | `app/lib/anti-insinuacion-guard.test.ts` (9/9, incl. mutation self-check) | ✅ 68-01 |
| Cobertura del voto N/M por cámara en `pnpm freshness` | `packages/freshness` (`COBERTURA_VOTO_SENALES`, 20 tests) | ✅ 68-02 |
| Poda de "Votó distinto a su bancada" + "mediana de su cámara"; leyenda verbatim; cobertura UI N/M + techo | `votos-por-parlamentario.test.tsx` (70/70), `lockdown-guard` (8/8), grep 0 offenders | ✅ 68-03 |

Lo que ninguna de esas pruebas puede afirmar es la **comprensión honesta del producto
desplegado por un lector no experto**: que la superficie se *lea* como descriptiva y no
como insinuación de postura/disciplina. Esa es una lectura humana/visual sobre el HTML
real renderizado — el objeto del gate BrowserOS (threat T-68-10, Repudiation: "superficie
que pasa los tests pero se lee como insinuación en frío").

---

## 1. Pre-flight (OBLIGATORIO antes de correr el cold-read)

No abrir BrowserOS hasta que **todo** lo siguiente esté verde. Si algo está rojo, NO se
avanza al veredicto humano: se reporta y se detiene (vuelve como gap al Plan 03).

### 1.1 Gates offline (agente/CI — reproducibles)

- [ ] **Suite completa app verde, sin regresión de baseline 749+**
      `pnpm --filter ./app test`
      Baseline post-68: 749 verde tras la poda (751 − 8 de `ausencias-contexto` borrado
      + tests netos). Con el linter 68-01 montado, la suite app reporta 71 files / 758
      tests verde. Cualquier número **por debajo de 749 es regresión** → detener.
- [ ] **Suite completa monorepo verde**
      `pnpm test`
- [ ] **Typecheck limpio**
      `pnpm typecheck` (root, `tsc -b`) — sin `.rpc()` huérfano ni tipo sin usar.
- [ ] **Guard anti-insinuación verde + mutation self-check**
      `pnpm --filter ./app test anti-insinuacion-guard` → 9/9.
      El mutation self-check DEBE estar verde: prueba que el guard **muerde** ante un
      término inyectado (`rebeldía`/`score`/`mediana de su cámara`) — no es un no-op
      verde vacío. Si el self-check no corre, el gate offline no es de fiar.
- [ ] **Lockdown-guard verde (allowlist endurecido)**
      `pnpm --filter ./app test lockdown-guard` → 8/8; `rebeldias_de_parlamentario` y
      `tasa_ausencia_comparada` FUERA de `PUBLIC_RPC_ALLOWLIST`.
- [ ] **Prune grep limpio** — 0 offenders en el árbol de voto:
      `git grep -n "AusenciasContexto\|rebeldias_de_parlamentario\|tasa_ausencia_comparada\|Votó distinto a su bancada\|RebeldiaRow\|AusenciaContextoRow" -- app/components/votos-por-parlamentario.tsx`
      → debe devolver **0 líneas**.
      `ausencias-contexto.tsx` / `.test.tsx` → **inexistentes**.

### 1.2 Freshness — cobertura del voto declarada

- [ ] **`pnpm freshness` imprime la tabla "Cobertura del voto individual (VOTO-05)"**
      con N/M por cámara (Cámara `confirmado` determinista / Senado por nombre = techo
      honesto). Exit 1 es el **contrato normal** de freshness cuando otra fuente está
      STALE (p.ej. `lobby-leylobby`), NO un fallo de esta feature — leer la tabla, no el
      exit code.
      Referencia de la última corrida real: 4731 sesiones conocidas · Cámara 3765 (80%)
      confirmado · Senado 963 (20%) por nombre.

### 1.3 Datos + despliegue (OPERADOR — sin esto el cold-read no tiene qué leer)

Estas dos condiciones son **lado operador** y son la razón por la que el gate queda
PENDING al cierre del plan 68-04:

- [ ] **Backfill de votos corrido (Fases 66/67, LOCAL operador)** para que la ficha
      renderice **votos reales confirmados**, no un empty-state. Sin el backfill, la
      sección muestra el estado "Aún no hemos ingerido las votaciones…" (honesto, pero
      NO es lo que valida el gate de comprensión). El cold-read exige una ficha con
      votos confirmados atribuidos.
- [ ] **Deploy a Cloudflare** de la app con la poda 68-03 + el linter 68-01. El
      cold-read se corre sobre la **URL desplegada**, no sobre `localhost`. (Build
      OpenNext en Docker Linux; deploy `wrangler` local — creds CF NO están en `.env`,
      es acción de operador. Ver project memory: build Windows rompe el worker 500ea.)
- [ ] **Elegir una ficha real con cobertura de voto** — un diputado con votos
      `confirmado` (Cámara, por DIPID) para que se vea el arco por proyecto poblado y la
      barra de sentido con los 5 estados. Anotar la URL usada en el veredicto.

---

## 2. Procedimiento BrowserOS cold-read (CDP)

> Regla dura (RESEARCH §Environment + project memory): si el MCP BrowserOS está caído,
> **pausar y pedir levantarlo — NO fingir capturas.** Un veredicto sin lectura real es
> un fallo del gate, no una aprobación.

Gotchas del loop CDP (project memory `red-layout-b-2026-07-13`, `v6-1-...`):

1. **CDP timeout → reabrir la página**, luego `sleep 8–10s` antes de re-consultar el
   DOM (el worker SSR + hidratación necesitan margen tras el deploy).
2. `evaluate_script` usa el arg **`expression`** (no `element`).
3. `click` usa el arg **`element`**.
4. **Forzar viewport 390px** (mobile) inyectando CSS — la revisión ciudadana se lee
   primero en móvil; los touch targets 44px y la frontera `mt-12` se verifican ahí.
5. Cmdline Windows tiene tope ~32KB → si se pasan scripts largos al driver, chunkear.
6. La cascada CSS real (petróleo de enlaces, slate de pareo/ausente) SOLO se caza con
   `getComputedStyle` sobre el deploy real, no en el HTML crudo.

Pasos:

1. Abrir la URL de la ficha elegida (§1.3). Esperar hidratación (`sleep 8–10s`).
2. Navegar a `#votos` (`scroll-mt-6`); expandir el `DetalleColapsable` (default cerrado)
   con `click` sobre "Ver detalle".
3. Leer la sección **en frío**, como un ciudadano sin contexto — sin apoyarse en el
   código ni en este doc. Capturar el estado renderizado (screenshot + `getComputedStyle`
   de los sentidos si hace falta para la regla slate).
4. Contestar la rúbrica del §3 punto por punto.

---

## 3. Rúbrica de comprensión — veredicto binario "comprensible"

El veredicto es **"comprensible"** SOLO si los 6 puntos de UI-SPEC §Gate se cumplen. Un
lector frío debe entender lo siguiente **sin ayuda**, y NO debe salir con impresión de
"alineamiento / disciplina / rebeldía / cercanía política":

1. [ ] **Significado del sentido:** "A favor / En contra" = **aprobar/rechazar el
       proyecto** en esa etapa de su tramitación — NO una postura ideológica de la
       persona. (Presente la nota LOCKED "A favor / En contra se refiere a aprobar o
       rechazar el proyecto…".)
2. [ ] **Neutralidad de ausente/pareo:** el lector percibe **ausente y pareo como
       neutros (slate)**, jamás como "voto en contra". No están pintados de rojo ni en el
       mismo bucket que `no`. (Verificar por `getComputedStyle`: pareo `bg-slate-400`,
       ausente `bg-slate-300`; NUNCA rojo.)
3. [ ] **Leyenda antes del dato:** la **leyenda anti-insinuación verbatim** aparece
       ANTES que cualquier dato de voto (bloque 0, primer hijo del detalle):
       *"Un voto es un hecho observable. Ausente o pareo no equivalen a votar en contra.
       No medimos disciplina ni motivo."*
4. [ ] **Trazabilidad a la fuente:** desde **cualquier voto** el lector puede llegar al
       **proyecto** (`/proyecto/{boletin}`) y a la **votación oficial** (ProvenanceBadge
       → "fuente oficial ↗", con fuente + fecha de captura).
5. [ ] **Sin juicio:** NO hay ningún score, puntaje, ranking, adjetivo de conducta, ni
       comparación con la bancada / mediana de la cámara. Los bloques "Votó distinto a su
       bancada" y "¿Falta más o menos que la mediana de su cámara?" están **AUSENTES**
       del render (poda 68-03 verificada visualmente).
6. [ ] **Cobertura honesta:** la cobertura se lee como **declarada** (N/M por proyecto +
       techo por causa cuando aplica), NO como completitud. Nada finge exhaustividad; el
       techo por causa (si se muestra) explica por qué faltan atribuciones.

**Regla de decisión:** los 6 en verde → veredicto **"comprensible"** → gate aprobado,
VOTO-05 / SC#4 cerrado. Cualquier punto en rojo → **NO comprensible**: se listan las
correcciones concretas (§4) y vuelven como gaps al Plan 03; se re-despliega y se re-corre
el cold-read.

---

## 4. Qué es un FAIL y el loop de remediación

Ejemplos de FAIL (cada uno bloquea el veredicto):

| Síntoma en frío | Punto rúbrica | Remediación (gap → Plan 03) |
|-----------------|---------------|-----------------------------|
| El lector cree que "En contra" es la postura ideológica de la persona | 1 | Reforzar/reubicar la nota de significado a/en-contra; que preceda al arco |
| Ausente/pareo se ve rojo o adyacente a `no` como gradiente positivo→negativo | 2 | Verificar tokens en `voto-presentacion.ts` (slate 400/300); orden LOCKED si→no→abstención→pareo→ausente |
| Aparece dato de voto ANTES de la leyenda | 3 | Mover la leyenda a bloque 0 (primer hijo del detalle) |
| Algún voto sin enlace a proyecto o sin ProvenanceBadge a la fuente | 4 | Restaurar `e.enlace` / link `/proyecto/{boletin}` en el arco |
| Reaparece "Votó distinto a su bancada" / "mediana de la cámara" / cualquier score o ranking | 5 | Re-podar; el guard anti-insinuación debería haberlo cazado → añadir el término/superficie faltante al linter |
| La cobertura se lee como "esto es todo lo que votó" (completitud implícita) | 6 | Hacer la nota N/M incondicional + añadir techo por causa cuando haya causa conocida |
| MCP BrowserOS caído / captura no obtenible | (todos) | **PAUSAR** y pedir levantar el MCP — NO fingir; sin lectura real no hay veredicto |

Loop: corregir el gap en Plan 03 → verde offline (§1) → re-deploy → re-correr cold-read
(§2) → re-evaluar rúbrica (§3). Se repite hasta veredicto "comprensible".

---

## 5. Registro del veredicto (a llenar por el OPERADOR)

```
Fecha:            __________
URL de la ficha:  __________ (ficha con votos confirmados, §1.3)
Viewport:         390px (móvil) / _____
Pre-flight §1:    [ ] todo verde (suite 749+, linter 9/9 + mutation, lockdown 8/8, grep 0, freshness N/M)
Backfill 66/67:   [ ] corrido (votos reales renderizan)
Deploy CF:        [ ] hecho (deploy: __________)
MCP BrowserOS:    [ ] levantado (lectura real, no fingida)

Rúbrica §3:
  1. Significado del sentido ............ [ ] pass  [ ] fail: ______
  2. Neutralidad ausente/pareo (slate) .. [ ] pass  [ ] fail: ______
  3. Leyenda antes del dato ............. [ ] pass  [ ] fail: ______
  4. Trazabilidad a la fuente ........... [ ] pass  [ ] fail: ______
  5. Sin juicio / sin comparación ....... [ ] pass  [ ] fail: ______
  6. Cobertura declarada honestamente ... [ ] pass  [ ] fail: ______

VEREDICTO: [ ] comprensible (aprobado) — VOTO-05 / SC#4 cerrado
           [ ] NO comprensible → gaps listados arriba → Plan 03
```

---

**Estado al cierre del plan 68-04:** el pre-flight offline (§1.1, §1.2) está verde en los
planes 01–03. El gate BrowserOS (§2–§3) queda **PENDING**: requiere (a) el backfill de
votos operador-local de las Fases 66/67 y (b) un deploy a Cloudflare, ambos lado operador,
antes de que exista una ficha con votos reales sobre la cual correr la lectura fría. El
agente no ejecuta ni finge el cold-read. `resume-signal`: el operador escribe
**"comprensible"** para aprobar, o lista los puntos que fallaron (se replanifican como
gaps al Plan 03).
