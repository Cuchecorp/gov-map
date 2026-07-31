import { BentoTile } from "@/components/bento/bento-tile";
import { PanelItemProyecto } from "@/components/panel-item-proyecto";
import { parseEvidenciaProyectos, etiquetaFuente } from "@/lib/panel-evidencia";
import { fechaCivilCorta } from "@/lib/dia-calendario";
import { claseCamara } from "@/lib/panel-camara";
import { type Idiom } from "@/lib/idioms-panel";

// WR-06: stem desde el single-source (`Idiom`), no inline.
const STEM_TRAMITE_DEL: Idiom = "Trámite del";

/**
 * PanelTileMovimiento — Tile 4, movimiento reciente nombrado (velocity)
 * (Phase 128, PANEL-02/03/05/07).
 *
 * REGLA DURA (T-128-12/P2): `velocity` NO trae `descripcion` — PROHIBIDO
 * fabricar el texto del trámite. El detalle es `Trámite del {fecha} · {cámara}`
 * y nada más; el copy de ejemplo del spike ("Informe de Comisión Mixta…") NO
 * es renderizable con el dato actual.
 *
 * La cámara sale de `cobertura_camara` de la FILA (no del ítem) — grafía ya
 * única en PROD (`Cámara de Diputados` / `Senado`); si es null, se omite el
 * segmento de cámara y la barra cívica (regla A).
 *
 * Filas de dos cámaras: ambas se listan, en el orden de LLEGADA de las filas
 * — JAMÁS reordenadas por conteo cross-cámara (T-52-13).
 *
 * RSC puro (JAMÁS "use client"). Nombre de archivo CONGELADO (D-05).
 */

const MAX_ITEMS_DEFAULT = 4;

export interface FilaPanel {
  cobertura_camara: string | null;
  conteo: number;
  fecha_max: string | null;
  supresion_causa: string | null;
  evidencia: unknown;
}

interface ItemConCamara {
  boletin: string | null;
  titulo: string | null;
  enCorpus: boolean;
  enlaceFuente: string | null;
  fecha: string | null;
  cobertura: string | null;
}

export function PanelTileMovimiento({
  filas,
  maxItems = MAX_ITEMS_DEFAULT,
}: {
  filas: FilaPanel[];
  maxItems?: number;
}) {
  const itemsConCamara: ItemConCamara[] = [];
  let fuente: string | null = null;
  let consultadoAl: string | null = null;
  let supresionCausa: string | null = null;
  let totalDeclarado = 0;

  // Preserva el orden de llegada de las FILAS; dentro de cada fila, el orden
  // que trae el jsonb (T-52-13: jamás reordenar por conteo cross-cámara).
  for (const f of filas) {
    if (f.supresion_causa) {
      supresionCausa = f.supresion_causa;
      consultadoAl = consultadoAl ?? f.fecha_max;
      continue;
    }
    const ev = parseEvidenciaProyectos(f.evidencia);
    fuente = fuente ?? etiquetaFuente(ev.fuente);
    // WR-15: `velocity` es carril de HECHOS PASADOS ⇒ D-05 asigna `fecha_max`.
    consultadoAl = consultadoAl ?? f.fecha_max ?? ev.consultado_al;
    // WR-07: el total declarado de la señal (`count(*)`) manda sobre el largo
    // del array cuando este viene acotado. Aquí la unidad es el ÍTEM (no hay
    // agrupación por boletín), así que total y lista cuentan lo mismo.
    totalDeclarado += ev.total ?? ev.items.length;
    for (const it of ev.items) {
      itemsConCamara.push({
        boletin: it.boletin,
        titulo: it.titulo,
        enCorpus: it.en_corpus,
        enlaceFuente: it.enlace,
        fecha: it.fecha,
        cobertura: f.cobertura_camara,
      });
    }
  }

  const rotulo = fechaCivilCorta(consultadoAl);
  const mostrados = itemsConCamara.slice(0, maxItems);
  const restante =
    Math.max(totalDeclarado, itemsConCamara.length) - mostrados.length;

  // C-01: span 6 (antes 4) — mismo motivo que en sala: votaciones (span 4) no
  // cabía en el remanente de 2 y la fila quedaba con hueco interior.
  return (
    <BentoTile variant="default" span={6} asChild>
      <section className="p-6">
        <h2 className="text-lg font-semibold mb-4">Movimiento reciente</h2>

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
            <ul>
              {mostrados.map((it, idx) => {
                const barra = claseCamara(it.cobertura);
                return (
                  <li
                    key={`${it.boletin ?? "x"}-${idx}`}
                    className="flex gap-[14px] items-start border-t border-border pt-4 first:border-t-0 first:pt-0"
                  >
                    {barra && (
                      <span
                        aria-hidden="true"
                        className={`w-[3px] self-stretch rounded-[2px] ${barra}`}
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <PanelItemProyecto
                        boletin={it.boletin}
                        titulo={it.titulo}
                        enCorpus={it.enCorpus}
                        ancla="timeline"
                        enlaceFuente={it.enlaceFuente}
                        detalle={(() => {
                          // WR-04: sin día parseable el detalle se omite entero
                          // ("Trámite del " colgado es un verbo sin hecho).
                          const dia = fechaCivilCorta(it.fecha);
                          if (!dia) return null;
                          return (
                            <>
                              {STEM_TRAMITE_DEL} {dia}
                              {it.cobertura && <> · {it.cobertura}</>}
                            </>
                          );
                        })()}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
            {restante > 0 && (
              <p className="mt-3 text-[13px] text-muted-foreground">
                {restante} más
              </p>
            )}
          </>
        )}

        {/* WR-09: sin `fuente` en el dato, cero procedencia fabricada. */}
        <p className="mt-3 font-mono text-[11px] text-muted-foreground">
          {fuente ? `Fuente: ${fuente}` : null}
          {rotulo && (
            <>
              {fuente ? " · " : ""}según fuente al {rotulo}
            </>
          )}
        </p>
      </section>
    </BentoTile>
  );
}
