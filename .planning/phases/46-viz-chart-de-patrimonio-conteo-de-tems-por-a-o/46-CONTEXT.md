# Phase 46: VIZ — Chart de patrimonio (conteo de ítems por año) - Context

**Gathered:** 2026-06-26
**Status:** Ready for planning
**Source:** UI-SPEC + DATA-INVENTORY de Phase 44 (`.planning/phases/44-legibilidad-auditoria-plan/`)

<domain>
## Phase Boundary

**Entrega:** un gráfico descriptivo dentro de la sección de patrimonio de `/parlamentario/[id]` (en el acordeón creado en F45) que muestra la **evolución del CONTEO de ítems declarados por año**.

**EN SCOPE:**
- Instalar **Recharts** en `app/`.
- Componente de chart (isla `"use client"`): serie temporal del **conteo** de bienes/pasivos/inmuebles por `declaracion.fecha_presentacion`, rotulado por tipo de declaración.
- Caveat honesto de montos-como-URI; degrade honesto con <2 declaraciones.
- Validar que el build OpenNext/Cloudflare no se rompe con Recharts.

**FUERA DE SCOPE:**
- Montos/cifras de patrimonio (son URIs `moneda_*`, no números → gap de ingesta; NO se grafican).
- RPCs nuevas o cambios de datos.
- Otros charts (votos/ausencias/autoría → fases gated F47/F48/F49).
- Cambiar la navegación/acordeón (eso es F45, prerequisito).
</domain>

<decisions>
## Implementation Decisions (LOCKED — UI-SPEC §2 + DATA-INVENTORY)

- **Librería: Recharts** (React-first, para gráficos estándar; el CLAUDE.md lo nombra para "gráficos estándar"). **NO está instalado** → `pnpm add recharts` es parte de la fase. **visx** queda reservado para el timeline a medida (fuera de v5).
- **Dato a graficar = CONTEO de ítems por año**, NO montos. Razón: `monto_deuda`/`valor_plaza` son URIs (`datos.cplt.cl/.../moneda_<hash>`), no cifras (ver `44-DATA-INVENTORY.md` chart #2). Graficar magnitud requiere re-ingesta CPLT (otra fase). Caveat visible: "Montos no disponibles como cifra en la fuente".
- **Fuente de datos:** RPCs YA allowlisted `declaraciones_de_parlamentario` (devuelve `fecha_presentacion`, `tipo`) y `bienes_de_parlamentario` (devuelve `fecha_presentacion`, `tipo_bien`, `contenido jsonb`). **Sin RPC nueva.**
- **Eje X = `declaracion.fecha_presentacion`** (tipo `date`, 2016-2026, 11 años). **Rotular el tipo de declaración** (periódica vs rectificación vs cese) — no mezclar versiones incomparables.
- **Patrón técnico:** chart = isla `"use client"` (Recharts es cliente); el resto de la sección/ficha sigue SSR. La data se computa server-side (en el Server Component de patrimonio) y se pasa serializada al chart cliente — NO mover la query al navegador.
- **Honestidad:** descriptivo, ejes/leyendas neutros ("N.º de bienes declarados por año"); sin verbo causal (negative-match del vocabulario prohibido §6/§9.1 verde); fuente+fecha+enlace (CC BY 4.0 CPLT) al pie, igual que las tablas. Degrade "datos insuficientes para una tendencia" con <2 declaraciones.

### Claude's Discretion
- Tipo de chart Recharts (área apilada / barras agrupadas / líneas) — elegir el que comunique mejor el conteo por tipo a lo largo del tiempo.
- Qué tipos de ítem agregar en la serie (bienes, pasivos, inmuebles, vehículos, etc.) y si se apilan o se muestran como series separadas.
- Ubicación del componente (`app/components/patrimonio-chart.tsx` o similar) y cómo el Server Component de patrimonio le pasa los conteos.
- Animación / `prefers-reduced-motion`.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Plan y datos
- `.planning/phases/44-legibilidad-auditoria-plan/UI-SPEC.md` — §2 (decisión Recharts + gap de stack), §3 (tabla de RPCs: patrimonio reusa RPCs existentes, sin RPC nueva).
- `.planning/phases/44-legibilidad-auditoria-plan/44-DATA-INVENTORY.md` — chart #2 (cobertura real, montos-como-URI, mezcla de tipos de declaración).
- `.planning/phases/45-.../45-CONTEXT.md` — el acordeón de patrimonio donde vive este chart (F45 es prerequisito).

### Código
- `app/components/patrimonio-de-parlamentario.tsx` — sección de patrimonio actual (PatrimonioView): aquí se inserta el chart, dentro del cuerpo del acordeón de F45. Leer cómo consume los RPCs hoy.
- `app/app/parlamentario/[id]/page.tsx` — el carril `#patrimonio`.
- `app/package.json` — confirmar que recharts NO está; agregarlo.
- `app/lib/lockdown-guard.test.ts` — guard (debe seguir verde; no RPC nueva, no `.from('parlamentario')`).
- `.planning/phases/19-...-frontend/DESIGN-SYSTEM.md` — §1 color (civic tokens), §6 voz editorial ES, vocabulario prohibido VALLADO (negative-match).

### Build / deploy
- Build OpenNext en **Docker Linux** (Windows rompe el worker → 500); deploy `wrangler` = checkpoint operador. Validar que Recharts no rompe el bundle del worker antes de dar la fase por verde.
</canonical_refs>

<specifics>
## Specific Ideas

- Cobertura real (de PROD, `44-DATA-INVENTORY.md`): `declaracion`=1060 filas, 136 parlamentarios, 11 años (2016-2026); **135 con ≥2 años** → serie viable. `pasivo`=1820, `inmueble`=2841.
- Test: agregar tests de render del chart (presencia, caveat de montos, degrade <2 declaraciones, fuente al pie). Suite `app/` + `tsc -b` verdes. El negative-match de vocabulario prohibido debe pasar sobre el copy del chart.
</specifics>

<deferred>
## Deferred Ideas

- Magnitud monetaria del patrimonio (requiere re-ingesta dereferenciando montos URI de CPLT) → fase de ingesta futura.
- Charts de votos/ausencias/autoría/comparativos → F47/F48/F49 (gated por datos).
</deferred>

---

*Phase: 46-viz-chart-de-patrimonio-conteo-de-items-por-ano*
*Context derivado del UI-SPEC + DATA-INVENTORY de Phase 44 — 2026-06-26*
