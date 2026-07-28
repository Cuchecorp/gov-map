# 114-VERIFICACION — Fixes con evidencia antes/después y cierre de fase

**Insumo:** `114-HALLAZGOS.md` (lista CERRADA — 1 hallazgo accionable: `H-01`).
**Base PRE:** `114-CORRIDA-PRE.json` / `.txt` (95 entradas · PASS 94 · FAIL 1 · MISSING-SSR 0).
**Nota LOCKED:** esta fase **no deploya** — los fixes viajan con la **Phase 125**; ningún flag fue tocado.

---

## Fixes

**Total de hallazgos corregidos:** 1 de 1 (`H-01`). **Diferidos:** 0.

### H-01 — `/proyecto/<boletín inexistente>` respondía HTTP 200 en vez de 404

| Campo | Valor |
|---|---|
| **id de manifiesto** | `4.2.b-404` (`inventarioRef` 4.2.b-A1, `tipo=status`, `espera=404`) |
| **intención aplicada** | corregir el **destino** (contrato HTTP de la ruta), no un href — no hay emisor público |
| **archivo tocado** | `app/app/proyecto/[boletin]/page.tsx` (único) |

**ANTES** — la única comprobación de existencia vivía en `FichaSection`, **dentro** de un boundary
de streaming, en `app/app/proyecto/[boletin]/page.tsx:425-431`:

```tsx
// app/app/proyecto/[boletin]/page.tsx:425-431 (estado previo, sin cambios en el fix)
async function FichaSection({ boletin }: { boletin: string }) {
  const data = await leerProyecto(boletin);
  if (!data) {
    notFound();
  }
  return <FichaHeader proyecto={data} />;
}
```

`FichaSection` se monta bajo `<Suspense>` en `page.tsx:99-101`, así que para un boletín con formato
válido (que **pasa** `BOLETIN_RE`, `page.tsx:60-62`) pero sin fila, el shell ya se había emitido con
las cabeceras puestas: la UI de not-found se pintaba, pero el status quedaba en **200**.

**DESPUÉS** — comprobación elevada al componente de página, antes del `return` y por tanto antes de
abrir cualquier boundary de streaming (`app/app/proyecto/[boletin]/page.tsx:64-77`):

```diff
--- a/app/app/proyecto/[boletin]/page.tsx
+++ b/app/app/proyecto/[boletin]/page.tsx
@@ -61,6 +61,20 @@ export default async function ProyectoPage({ params, searchParams }: PageProps)
     notFound();
   }
 
+  // 114-03 (H-01) — El 404 de "boletín inexistente" DEBE resolverse ANTES de abrir
+  // cualquier boundary de streaming. Antes, la única comprobación de existencia vivía
+  // en `FichaSection` (dentro de un <Suspense>): para un boletín con formato válido
+  // pero sin fila, el shell ya se había emitido con las cabeceras puestas, así que el
+  // `notFound()` pintaba la UI de not-found pero el status quedaba en 200. Aquí se
+  // resuelve en el componente de página, antes del `return`, y por tanto antes de que
+  // Next envíe cabecera alguna. La lectura es la MISMA `leerProyecto` cacheada
+  // (React.cache) que consumen el rail, la ficha y la tramitación ⇒ cero query extra.
+  // `leerProyecto` LANZA ante un error real de DB/red (#34): esto no fabrica un 404 a
+  // partir de un fallo, sólo lo emite cuando la fila realmente no existe.
+  if (!(await leerProyecto(boletin))) {
+    notFound();
+  }
+
   // Período de urgencia expandido (SC2, server-driven): ?urgencias=<id>. Normalizado
```

**Qué NO cambió (invariantes preservadas):**

- `FichaSection` conserva su propio `notFound()` — guard defensivo, no se relajó nada.
- Cero query extra: `leerProyecto` es `React.cache` (`page.tsx:407-422`) y ya la consumen el rail, la
  ficha, la tramitación y la validación de fuente.
- Cero cambio de copy, de dato, de conteo, de fecha y de gate ⇒ **no se tocó el linter
  anti-insinuación** (no hubo texto visible nuevo: la UI de not-found es la ya existente
  `app/app/proyecto/[boletin]/not-found.tsx`).
- Honest-error #34 intacto: un fallo real de DB/red sigue **lanzando** desde `leerProyecto`; el 404
  sólo se emite cuando `data` es `null` (0 filas).

**Test de respaldo** (`app/app/proyecto/[boletin]/page.test.tsx`, 3 tests nuevos):

| Test | Asevera |
|---|---|
| `llama notFound() ANTES de devolver el árbol cuando el proyecto no existe` | `ProyectoPage(...)` **rechaza** con `NEXT_NOT_FOUND` sin llegar a producir markup |
| `con un boletín existente NO llama notFound() y sí devuelve el árbol` | no-regresión del camino feliz (`id="estado"` presente) |
| `la comprobación de existencia vive en la page, ANTES del primer <Suspense>` | invariante estructural: `await leerProyecto(boletin)` precede al primer `<Suspense fallback=` |

**Prueba de que el test MUERDE (mutación):** neutralizando el guard
(`if (!(await leerProyecto(boletin)))` → `if (false)`), la corrida dio **2 de 13 tests en FAIL**
(el de rechazo y el estructural). Revertida la mutación, **13/13 PASS**.

**Gates de la tarea:**

| Gate | Resultado |
|---|---|
| `git diff --stat .env .env.example` | **vacío** — cero flags tocados |
| `git diff --name-only \| grep -qE 'package\.json\|pnpm-lock\.yaml'` | sin match (exit 1) ⇒ el gate `!` sale **0** — cero paquete nuevo |
| Archivos de `app/` tocados | exactamente los 2 previstos (`page.tsx` + su test) |
| Deploy | **NO ejecutado** — viaja con la Phase 125 |
