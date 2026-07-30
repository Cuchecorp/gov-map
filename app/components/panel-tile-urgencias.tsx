import { BentoTile } from "@/components/bento/bento-tile";
import { PanelItemProyecto } from "@/components/panel-item-proyecto";
import {
  parseEvidenciaProyectos,
  gradoUrgencia,
  etiquetaFuente,
  type ItemProyecto,
} from "@/lib/panel-evidencia";
import { fechaCivilCorta } from "@/lib/dia-calendario";

/**
 * PanelTileUrgencias — Tile 3, urgencias del Ejecutivo por GRADO y por
 * BOLETINES DISTINTOS (Phase 128, PANEL-02/03/05/07).
 *
 * REGLA DURA (T-128-11): el conteo del encabezado es `Set<boletin>`, JAMÁS el
 * número de eventos — contar eventos es exactamente el defecto D-01/O-3 manda
 * matar ("95 urgencias" cuando son 71 boletines distintos entre los 3 grados).
 *
 * Orden de los grados: FIJO, institucional (mayor a menor premura formal), NO
 * un ranking por volumen (regla B / carril anti-ranking). Vive en un array
 * constante documentado abajo.
 *
 * Items: uno por boletín (la urgencia MÁS RECIENTE de ese boletín, vía
 * `urgenciaVigentePorBoletin` inline por fecha), hasta `maxItems`. O-6 elimina
 * el link agregado de tile: cuando hay más boletines que `maxItems`, el
 * remanente se declara como TEXTO SIN LINK (fix W-6, FIJADO, cero discreción)
 * — jamás un "y N más →" con destino.
 *
 * RSC puro (JAMÁS "use client"). Nombre de archivo CONGELADO (D-05).
 */

// Orden institucional del grado (de mayor a menor premura formal) — NO es un
// ranking por volumen; el carril anti-ranking del linter y la regla B lo exigen.
const ORDEN_GRADOS = ["Discusión inmediata", "Suma", "Simple"] as const;

const MAX_ITEMS_DEFAULT = 4;

export interface FilaPanel {
  cobertura_camara: string | null;
  conteo: number;
  fecha_max: string | null;
  supresion_causa: string | null;
  evidencia: unknown;
}

interface BoletinAgrupado {
  boletin: string;
  titulo: string | null;
  enCorpus: boolean;
  enlaceFuente: string | null;
  grado: string;
  fecha: string | null;
}

function agruparPorBoletin(items: ItemProyecto[]): {
  porGrado: Map<string, Set<string>>;
  vigentePorBoletin: Map<string, BoletinAgrupado>;
} {
  const porGrado = new Map<string, Set<string>>();
  const vigentePorBoletin = new Map<string, BoletinAgrupado>();

  for (const it of items) {
    if (!it.boletin) continue;
    const grado = gradoUrgencia(it.descripcion) ?? it.descripcion ?? "";

    // Conteo por grado: Set<boletin> — nunca eventos (T-128-11).
    const set = porGrado.get(grado) ?? new Set<string>();
    set.add(it.boletin);
    porGrado.set(grado, set);

    // Vigente por boletín: la más reciente por fecha; desempate por orden de
    // aparición (última vista con fecha máxima gana — determinista, L5).
    const actual = vigentePorBoletin.get(it.boletin);
    if (!actual || (it.fecha && (!actual.fecha || it.fecha >= actual.fecha))) {
      vigentePorBoletin.set(it.boletin, {
        boletin: it.boletin,
        titulo: it.titulo,
        enCorpus: it.en_corpus,
        enlaceFuente: it.enlace,
        grado,
        fecha: it.fecha,
      });
    }
  }

  return { porGrado, vigentePorBoletin };
}

export function PanelTileUrgencias({
  filas,
  maxItems = MAX_ITEMS_DEFAULT,
}: {
  filas: FilaPanel[];
  maxItems?: number;
}) {
  // Fusiona items de todas las filas (típicamente una sola fila de urgencias).
  const items: ItemProyecto[] = [];
  let fuente: string | null = null;
  let consultadoAl: string | null = null;
  let supresionCausa: string | null = null;

  for (const f of filas) {
    if (f.supresion_causa) {
      supresionCausa = f.supresion_causa;
      consultadoAl = consultadoAl ?? f.fecha_max;
      continue;
    }
    const ev = parseEvidenciaProyectos(f.evidencia);
    items.push(...ev.items);
    fuente = fuente ?? etiquetaFuente(ev.fuente);
    consultadoAl = consultadoAl ?? ev.consultado_al ?? f.fecha_max;
  }

  const rotulo = fechaCivilCorta(consultadoAl);

  return (
    <BentoTile variant="default" span={2} asChild>
      <section className="p-6">
        <h2 className="text-lg font-semibold mb-4">
          Urgencias del Ejecutivo, por grado
        </h2>

        {supresionCausa ? (
          <p className="text-sm text-muted-foreground">
            {supresionCausa}
            {rotulo && (
              <>
                {" — en las fuentes consultadas al "}
                <span className="font-mono">{rotulo}</span>
              </>
            )}
          </p>
        ) : (
          <>
            {(() => {
              const { porGrado, vigentePorBoletin } = agruparPorBoletin(items);

              // Encabezado: "5 proyectos con Discusión inmediata · 42 con Suma · 24 con Simple"
              const segmentos: string[] = [];
              for (let i = 0; i < ORDEN_GRADOS.length; i++) {
                const grado = ORDEN_GRADOS[i];
                const set = porGrado.get(grado);
                if (!set || set.size === 0) continue;
                segmentos.push(
                  i === 0
                    ? `${set.size} proyectos con ${grado}`
                    : `${set.size} con ${grado}`,
                );
              }
              // Grados desconocidos (fallback honesto de gradoUrgencia) se
              // agregan al final, en orden de primera aparición.
              for (const [grado, set] of porGrado) {
                if ((ORDEN_GRADOS as readonly string[]).includes(grado)) continue;
                if (set.size === 0) continue;
                segmentos.push(`${set.size} con ${grado}`);
              }

              const boletines = Array.from(vigentePorBoletin.values());
              const mostrados = boletines.slice(0, maxItems);
              const restante = boletines.length - mostrados.length;

              return (
                <>
                  {segmentos.length > 0 && (
                    <p className="text-[13px] text-muted-foreground mb-3">
                      {segmentos.join(" · ")}
                    </p>
                  )}
                  <ul>
                    {mostrados.map((b) => (
                      <li
                        key={b.boletin}
                        className="border-t border-border pt-4 first:border-t-0 first:pt-0"
                      >
                        <PanelItemProyecto
                          boletin={b.boletin}
                          titulo={b.titulo}
                          enCorpus={b.enCorpus}
                          ancla="estado"
                          enlaceFuente={b.enlaceFuente}
                          detalle={
                            <>
                              Urgencia {b.grado} fechada el{" "}
                              {fechaCivilCorta(b.fecha)}
                            </>
                          }
                        />
                      </li>
                    ))}
                  </ul>
                  {restante > 0 && (
                    <p className="mt-3 text-[13px] text-muted-foreground">
                      {restante} más
                    </p>
                  )}
                </>
              );
            })()}
          </>
        )}

        <p className="mt-3 font-mono text-[11px] text-muted-foreground">
          Fuente: {fuente ?? "Tramitación"}
          {rotulo && <> · según fuente al {rotulo}</>}
        </p>
      </section>
    </BentoTile>
  );
}
