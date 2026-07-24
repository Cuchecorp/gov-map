import type { ReactNode } from "react";

/**
 * RelacionesEjeComparar — render presentacional de UN eje factual de /comparar
 * (REL-03, 101-UI-SPEC §"/comparar route"). Dispone lado-a-lado el valor A y el
 * valor B (md:grid-cols-2) y, debajo full-width, la línea de INTERSECCIÓN factual
 * ("Comparten N: …") — la figura del conteo en `text-accent-product` (petróleo
 * NEUTRAL de conteo, JAMÁS señal de afinidad/proximidad).
 *
 * REGLAS LOCKED (§Color / §Copywriting / anti-ranking T-52-13):
 *  - CERO ranking/score: el conteo de intersección es un HECHO, nunca un orden ni un
 *    puntaje. Las listas van SIEMPRE en orden alfabético (lo fija el server).
 *  - PETRÓLEO SOLO en la figura de intersección (conteo) y en links — nunca como
 *    "estos dos están cerca/alineados".
 *  - VACÍO HONESTO DECLARADO: un eje sin dato compartido declara la ausencia con
 *    fuente/fecha ("En las fuentes consultadas al {fecha}, no comparten {eje}."),
 *    NUNCA presentada como "no hay relación". El server pasa el copy ya resuelto.
 *  - CADA DATO con fuente + fecha en `text-xs text-muted-foreground`.
 *  - Presentacional PURO (server-friendly): recibe todo serializado por el server;
 *    NUNCA toca Supabase, NUNCA re-ordena, NUNCA re-cuenta.
 *
 * FRONTERA mt-12 (§Spacing): cada eje es su propia `<section className="mt-12">`
 * HERMANA — la frontera anti-insinuación entre ejes se preserva (un eje factual y
 * otro JAMÁS se funden en un `<article>` que insinúe un vínculo compuesto).
 */

export interface EjeColumna {
  /** Nombre display del parlamentario (columna A o B), ya `formatNombre`-ado. */
  nombre: string;
  /**
   * Contenido factual de la columna para este eje (lista de comisiones/militancias/
   * co-autorías, o un texto de ausencia). El server arma el ReactNode.
   */
  contenido: ReactNode;
}

export interface RelacionesEjeCompararProps {
  /** Heading LOCKED del eje: "Militancia (histórica)" · "Comisiones" · etc. */
  heading: string;
  /** Columna A (izquierda). */
  a: EjeColumna;
  /** Columna B (derecha). */
  b: EjeColumna;
  /**
   * Línea de intersección factual YA resuelta por el server:
   *  - Con dato compartido: "Comparten {N}: {lista alfabética}." (figura petróleo).
   *  - Sin dato compartido: la ausencia declarada con fuente/fecha.
   * El server decide el copy; aquí solo se pinta. `interseccionN` gobierna el
   * resaltado petróleo de la figura (solo cuando hay conteo > 0).
   */
  interseccion: ReactNode;
  /** Provenance del eje (fuente + fecha), en micro-texto muted. */
  provenance: string;
}

export function RelacionesEjeComparar({
  heading,
  a,
  b,
  interseccion,
  provenance,
}: RelacionesEjeCompararProps) {
  return (
    <section className="mt-12">
      <h2 className="text-xl font-semibold">{heading}</h2>
      {/* A / B lado-a-lado (1 col móvil, 2 cols md+). */}
      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 md:gap-6 gap-4">
        <div>
          <p className="text-base font-semibold">{a.nombre}</p>
          <div className="mt-2 text-sm text-muted-foreground">{a.contenido}</div>
        </div>
        <div>
          <p className="text-base font-semibold">{b.nombre}</p>
          <div className="mt-2 text-sm text-muted-foreground">{b.contenido}</div>
        </div>
      </div>
      {/* Intersección full-width (figura petróleo NEUTRAL de conteo). */}
      <div className="mt-4 text-sm">{interseccion}</div>
      {/* Provenance del eje (fuente + fecha). */}
      <p className="mt-2 text-xs text-muted-foreground">{provenance}</p>
    </section>
  );
}
