import { formatNombre } from "@/lib/format";
import type { ParlamentarioListadoRow } from "@/lib/types";

/**
 * CompararSelector — los DOS selectores server-friendly de /comparar (REL-03,
 * 101-UI-SPEC §"/comparar route" → "Selectors"). Un único form GET
 * (`action="/comparar"`, progressive-enhancement, cero JS de cliente) con dos
 * `<select>` — "Parlamentario A" y "Parlamentario B" — poblados desde el directorio
 * `parlamentarios_publico_v2` que el server ya leyó (contrato server-only: este
 * componente NUNCA toca Supabase; recibe el roster serializado).
 *
 * URL CANÓNICA (§route): el submit navega a `/comparar?a=&b=`. El orden alfabético
 * de los ids lo re-normaliza el propio page.tsx al leer searchParams (`.sort()`), así
 * que la URL queda estable sin importar en qué slot eligió el usuario. Los `defaultValue`
 * reflejan la selección vigente (a/b ya validados y ordenados por el server).
 *
 * ANTI-INSINUACIÓN: cero copy de bancada/afinidad. Las opciones listan nombre + cámara
 * como HECHO; el selector NO agrupa por partido/afinidad ni ordena por proximidad. Las
 * opciones van en el orden alfabético que emite el roster (el server lo ordena por
 * nombre). Presentacional PURO server-friendly (sin "use client").
 *
 * CANDADOS DE RÉGIMEN (§Typography/§Color): cero-hex, tokens tipográficos, petróleo en
 * focus-visible de los DOS `<select>` (mismo idiom que DirectoryFilter de
 * /parlamentarios) y, desde C-02 (129-04), también como RELLENO del CTA primario
 * `Comparar` — que es el mismo rol y las mismas clases que el botón `Buscar` del hero
 * (`search-box.tsx:129-130`). La regla "petróleo solo en focus-visible" describía los
 * controles de filtro, no el CTA primario: dejarlo con el relleno casi-negro anterior
 * hacía de /comparar el único CTA primario de la app fuera del sistema de color.
 *
 * (El literal del token anterior NO se transcribe en este archivo: el criterio de
 * cierre de C-02 es un contador `grep` sobre él, y repetirlo en un comentario lo
 * volvería vacuo.)
 */

export interface CompararSelectorProps {
  /** Directorio serializado (roster) YA leído por el server (parlamentarios_publico_v2). */
  roster: ParlamentarioListadoRow[];
  /** Id vigente del slot A (ya validado/ordenado por el server), o undefined. */
  a?: string;
  /** Id vigente del slot B (ya validado/ordenado por el server), o undefined. */
  b?: string;
}

function OpcionesRoster({ roster }: { roster: ParlamentarioListadoRow[] }) {
  return (
    <>
      {roster.map((p) => (
        <option key={p.id} value={p.id}>
          {formatNombre(p.nombre)} · {p.camara === "senado" ? "Senado" : "Cámara"}
        </option>
      ))}
    </>
  );
}

export function CompararSelector({ roster, a, b }: CompararSelectorProps) {
  return (
    <form
      method="get"
      action="/comparar"
      className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-end"
      role="search"
    >
      <label className="flex-1">
        <span className="block text-sm font-medium">Parlamentario A</span>
        <select
          name="a"
          defaultValue={a ?? ""}
          className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="">Elige un parlamentario</option>
          <OpcionesRoster roster={roster} />
        </select>
      </label>
      <label className="flex-1">
        <span className="block text-sm font-medium">Parlamentario B</span>
        <select
          name="b"
          defaultValue={b ?? ""}
          className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="">Elige un parlamentario</option>
          <OpcionesRoster roster={roster} />
        </select>
      </label>
      {/* C-02: token del CTA primario de la app — mismas clases de color que el
          botón `Buscar` del hero (`bg-accent-product text-background` +
          `hover:bg-accent-product/90`, search-box.tsx:129-130). El relleno anterior
          dejaba este botón como el ÚNICO CTA primario fuera del sistema. */}
      <button
        type="submit"
        className="rounded-lg bg-accent-product px-4 py-2 text-sm font-medium text-background hover:bg-accent-product/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        Comparar
      </button>
    </form>
  );
}
