import { DetalleColapsable } from "@/components/detalle-colapsable";
import { fechaCorta } from "@/lib/format";
import type { MilitanciaRow } from "@/lib/types";

/**
 * MilitanciasDeParlamentario — sección de militancias registradas (BIO-03,
 * 91-UI-SPEC §Component 3). Su propia `<section className="mt-12">` (carril hermano,
 * frontera anti-insinuación LOCKED). Presentacional PURO (recibe `militancias` por
 * prop) → server-friendly.
 *
 * CAPA-1 (fuera del disclosure): h2 "Militancias registradas" + leyenda LOCKED + la
 * militancia VIGENTE (es_actual) con su rango `{desde} – vigente` en font-mono y la
 * etiqueta SOBRIA "Vigente" (NO badge de alarma).
 *
 * DETALLE (dentro de DetalleColapsable, cerrado): tramos históricos (es_actual=false)
 * en `<ul>` cronológico DESC, cada `<li>` = partido + rango mono `{desde} – {hasta}`.
 * Trigger "Ver militancias anteriores (N)". Si SÓLO hay vigente → NO se renderiza el
 * acordeón; se muestra la leyenda empty HONESTA (LOCKED).
 *
 * COLOR: cero color partidista (el partido nunca se codifica por color). Fechas
 * SIEMPRE en font-mono (regla LOCKED). Sin foto, sin PII, sin "trayectoria"
 * editorializada.
 */

function rango(desde: string | null, hasta: string | null): string {
  const d = desde ? fechaCorta(new Date(desde)) : "sin fecha";
  const h = hasta ? fechaCorta(new Date(hasta)) : "vigente";
  return `${d} – ${h}`;
}

export function MilitanciasDeParlamentario({
  militancias,
}: {
  militancias: MilitanciaRow[];
}) {
  // El RPC ordena vigente primero; la separación es por `es_actual` (no por índice).
  const vigente = militancias.find((m) => m.es_actual) ?? null;
  const historicas = militancias.filter((m) => !m.es_actual);

  return (
    <section id="militancias" className="mt-12">
      <h2 className="text-xl font-semibold">Militancias registradas</h2>
      <p className="text-sm text-muted-foreground mt-1">
        Afiliaciones partidarias según registro oficial, con la fecha de cada
        tramo. La militancia vigente aparece primero.
      </p>

      {vigente ? (
        <div className="mt-4">
          <p className="text-base font-semibold">{vigente.partido}</p>
          <p className="text-sm text-muted-foreground">
            <span className="font-mono">{rango(vigente.desde, null)}</span>
            <span aria-hidden="true"> · </span>
            <span>Vigente</span>
          </p>
        </div>
      ) : (
        // Sin vigente registrada: honesto por ausencia (no se fabrica "actual").
        <p className="text-sm text-muted-foreground mt-4">
          No hay militancia vigente registrada en la fuente.
        </p>
      )}

      {historicas.length > 0 ? (
        <div className="mt-4">
          <DetalleColapsable
            n={historicas.length}
            triggerLabel={`Ver militancias anteriores (${historicas.length})`}
          >
            <ul className="space-y-3">
              {historicas.map((m, i) => (
                <li key={`${m.partido}-${m.desde}-${i}`}>
                  <p className="text-base font-semibold">{m.partido}</p>
                  <p className="text-sm text-muted-foreground font-mono">
                    {rango(m.desde, m.hasta)}
                  </p>
                </li>
              ))}
            </ul>
          </DetalleColapsable>
        </div>
      ) : (
        vigente && (
          <p className="text-sm text-muted-foreground mt-4">
            Sólo se registra la militancia vigente; no hay tramos anteriores en
            la fuente.
          </p>
        )
      )}
    </section>
  );
}
