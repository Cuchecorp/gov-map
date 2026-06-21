"use client";

/**
 * <RedGraph> — isla cliente del grafo de influencia NET (NET-02).
 *
 * PLACEHOLDER (Wave 2 / Plan 18-02). Este componente fija el CONTRATO de props
 * (`subgrafo`: el JSON plano que emite el RPC `subgrafo_red`) y la frontera
 * `'use client'` que aísla el bundle de NET del resto del sitio server-first.
 *
 * HANDOFF A PLAN 18-03: el Plan 03 reemplaza el cuerpo de este componente por el
 * grafo real con `@xyflow/react@12` (`import "@xyflow/react/dist/style.css"`,
 * nodos/aristas controlados, filtros por tipo/tiempo, tooltips Radix de
 * procedencia). La FIRMA de props NO debe cambiar para que la ruta `/red`
 * (server) siga compilando: `<RedGraph subgrafo={data} />`. Mantener el import en
 * `@/components/red/red-graph` estable.
 *
 * ANTI-INSINUACIÓN (18-CONTEXT, LOCKED): este placeholder y su reemplazo describen
 * SOLO hechos tipados con fuente y fecha; jamás una valoración ni una relación de
 * proximidad, y nunca lenguaje de causa. Cada nodo es identidad pública (nombre +
 * cámara, SIN partido/foto); cada arista es un hecho tipado con fuente y ventana
 * temporal. Grafo VACÍO (0 aristas) = estado honesto ("aún no hay relaciones para
 * mostrar"), NUNCA un error.
 */

// Contrato del JSON del RPC subgrafo_red (PII-safe: nodo = id/nombre/camara).
export interface SubgrafoNodo {
  id: string;
  nombre: string | null;
  camara: string | null;
}

export interface SubgrafoArista {
  tipo: string;
  a: string;
  b: string;
  contexto: string | null;
  desde: string | null;
  hasta: string | null;
  dataset: string;
  origen: string;
  enlace: string;
  licencia: string | null;
}

export interface Subgrafo {
  nodos: SubgrafoNodo[];
  aristas: SubgrafoArista[];
}

export interface RedGraphProps {
  /** JSON plano emitido por el RPC `subgrafo_red` (nodos + aristas). */
  subgrafo: Subgrafo | null;
}

export function RedGraph({ subgrafo }: RedGraphProps) {
  const nodos = subgrafo?.nodos ?? [];
  const aristas = subgrafo?.aristas ?? [];

  // Estado honesto: el grafo puede venir vacío (sin relaciones materializadas
  // todavía). NO es un error — se describe el hecho de que aún no hay aristas.
  if (aristas.length === 0) {
    return (
      <section aria-label="Grafo de relaciones" className="mt-8">
        <p className="text-base leading-relaxed text-muted-foreground">
          Aún no hay relaciones para mostrar para este parlamentario. Cuando
          existan hechos públicos que vinculen a dos parlamentarios (por ejemplo,
          haber recibido audiencia de la misma contraparte de lobby), aparecerán
          aquí, cada uno con su fuente y fecha.
        </p>
        {nodos.length > 0 ? (
          <ul className="mt-6 space-y-2">
            {nodos.map((n) => (
              <li key={n.id} className="text-sm">
                {n.nombre ?? n.id}
                {n.camara ? (
                  <span className="text-muted-foreground"> · {n.camara}</span>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    );
  }

  // Render mínimo de respaldo hasta que Plan 18-03 monte @xyflow/react. Lista
  // sobria de nodos y hechos tipados, cada arista con su fuente — sin valoración
  // ni medida de relación, solo el hecho y su origen.
  return (
    <section aria-label="Grafo de relaciones" className="mt-8">
      <ul className="space-y-2">
        {nodos.map((n) => (
          <li key={n.id} className="text-sm">
            {n.nombre ?? n.id}
            {n.camara ? (
              <span className="text-muted-foreground"> · {n.camara}</span>
            ) : null}
          </li>
        ))}
      </ul>
      <ul className="mt-6 space-y-3">
        {aristas.map((a, i) => (
          <li key={`${a.tipo}-${a.a}-${a.b}-${i}`} className="text-sm">
            <span>
              {a.a} — {a.b}
            </span>
            {a.contexto ? (
              <span className="text-muted-foreground"> · {a.contexto}</span>
            ) : null}{" "}
            <a
              href={a.enlace}
              className="text-primary underline underline-offset-2"
              target="_blank"
              rel="noreferrer"
            >
              fuente
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
