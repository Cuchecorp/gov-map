import { BentoTile } from "@/components/bento/bento-tile";
import { PanelItemProyecto } from "@/components/panel-item-proyecto";
import {
  parseEvidenciaProyectos,
  etiquetaFuente,
  type ItemProyecto,
} from "@/lib/panel-evidencia";
import { fechaCivilCorta } from "@/lib/dia-calendario";

/**
 * PanelTileIngresos — Tile 6, ingresos + archivos/retiros fusionados
 * (Phase 128, PANEL-02/03/05/07, D-01).
 *
 * Regla C CONSERVADA ÍNTEGRA (copy exacto de `panel-actualidad.tsx:182-201`):
 * `supresion_causa != null` ⇒ la causa es el cuerpo, VERBATIM, con el sufijo
 * "— en las fuentes consultadas al {rótulo}". Nunca lista vacía, nunca "0"
 * mudo, nunca "sin movimiento".
 *
 * Conteo del defecto D-07: los items de `archivados` se agrupan por boletín y
 * se emiten como "{N} eventos de {M} proyecto(s)" con concordancia de número
 * correcta — el literal "movimientos" está PROHIBIDO en este tile (sugiere M
 * proyectos donde hay uno).
 *
 * `cobertura_camara` de `nuevos_ingresos` (`"2022-2026 (piso de corpus)"`) es
 * una etiqueta de VENTANA, NO una cámara — no alimenta `claseCamara` ni el
 * chip de cámara (herencia 0065, D-02).
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

function agruparPorBoletin(items: ItemProyecto[]): Map<
  string,
  { boletin: string; titulo: string | null; enCorpus: boolean; enlaceFuente: string | null; fecha: string | null; descripcion: string | null; eventos: number }
> {
  const porBoletin = new Map<
    string,
    {
      boletin: string;
      titulo: string | null;
      enCorpus: boolean;
      enlaceFuente: string | null;
      fecha: string | null;
      descripcion: string | null;
      eventos: number;
    }
  >();
  for (const it of items) {
    if (!it.boletin) continue;
    const actual = porBoletin.get(it.boletin);
    if (!actual) {
      porBoletin.set(it.boletin, {
        boletin: it.boletin,
        titulo: it.titulo,
        enCorpus: it.en_corpus,
        enlaceFuente: it.enlace,
        fecha: it.fecha,
        descripcion: it.descripcion,
        eventos: 1,
      });
    } else {
      actual.eventos += 1;
      // Conserva el evento MÁS RECIENTE por fecha (mismo criterio L5).
      if (it.fecha && (!actual.fecha || it.fecha >= actual.fecha)) {
        actual.titulo = it.titulo;
        actual.enlaceFuente = it.enlace;
        actual.fecha = it.fecha;
        actual.descripcion = it.descripcion;
      }
    }
  }
  return porBoletin;
}

function seccionSubtitulo(
  filas: FilaPanel[],
): {
  items: ItemProyecto[];
  supresionCausa: string | null;
  consultadoAl: string | null;
  fuente: string | null;
} {
  const items: ItemProyecto[] = [];
  let supresionCausa: string | null = null;
  let consultadoAl: string | null = null;
  let fuente: string | null = null;
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
  return { items, supresionCausa, consultadoAl, fuente };
}

export function PanelTileIngresos({
  ingresos,
  archivados,
  maxItems = MAX_ITEMS_DEFAULT,
}: {
  ingresos: FilaPanel[];
  archivados: FilaPanel[];
  maxItems?: number;
}) {
  const seccionIngresos = seccionSubtitulo(ingresos);
  const seccionArchivados = seccionSubtitulo(archivados);

  const rotuloIngresos = fechaCivilCorta(seccionIngresos.consultadoAl);
  const rotuloArchivados = fechaCivilCorta(seccionArchivados.consultadoAl);
  const rotuloFooter = rotuloIngresos ?? rotuloArchivados;
  const fuenteFooter = seccionArchivados.fuente ?? seccionIngresos.fuente;

  const porBoletinArchivados = agruparPorBoletin(seccionArchivados.items);
  const listaArchivados = Array.from(porBoletinArchivados.values());
  const totalEventosArchivados = listaArchivados.reduce(
    (acc, b) => acc + b.eventos,
    0,
  );
  const totalProyectosArchivados = listaArchivados.length;
  const mostradosArchivados = listaArchivados.slice(0, maxItems);
  const restanteArchivados = listaArchivados.length - mostradosArchivados.length;

  return (
    <BentoTile variant="default" span={2} asChild>
      <section className="p-6">
        <h2 className="text-lg font-semibold mb-4">
          Ingresos, archivos y retiros
        </h2>

        {/* ── Subsección: Nuevos ingresos ─────────────────────────────────── */}
        <h3 className="text-[13px] font-semibold text-muted-foreground mb-2">
          Nuevos ingresos
        </h3>
        {seccionIngresos.supresionCausa ? (
          <p className="text-sm text-muted-foreground mb-4">
            {seccionIngresos.supresionCausa}
            {rotuloIngresos && (
              <>
                {" — en las fuentes consultadas al "}
                <span className="font-mono">{rotuloIngresos}</span>
              </>
            )}
          </p>
        ) : (
          <ul className="mb-4">
            {seccionIngresos.items.slice(0, maxItems).map((it, idx) => (
              <li
                key={`${it.boletin ?? "x"}-${idx}`}
                className="border-t border-border pt-4 first:border-t-0 first:pt-0"
              >
                <PanelItemProyecto
                  boletin={it.boletin}
                  titulo={it.titulo}
                  enCorpus={it.en_corpus}
                  ancla="estado"
                  enlaceFuente={it.enlace}
                  detalle={<>Ingresado el {fechaCivilCorta(it.fecha)}</>}
                />
              </li>
            ))}
          </ul>
        )}

        {/* ── Subsección: Archivos y retiros ──────────────────────────────── */}
        <h3 className="text-[13px] font-semibold text-muted-foreground mb-2">
          Archivos y retiros
        </h3>
        {seccionArchivados.supresionCausa ? (
          <p className="text-sm text-muted-foreground">
            {seccionArchivados.supresionCausa}
            {rotuloArchivados && (
              <>
                {" — en las fuentes consultadas al "}
                <span className="font-mono">{rotuloArchivados}</span>
              </>
            )}
          </p>
        ) : (
          <>
            {totalEventosArchivados > 0 && (
              <p className="text-[13px] text-muted-foreground mb-3">
                {totalEventosArchivados}{" "}
                {totalEventosArchivados === 1 ? "evento" : "eventos"} de{" "}
                {totalProyectosArchivados}{" "}
                {totalProyectosArchivados === 1 ? "proyecto" : "proyectos"}
              </p>
            )}
            <ul>
              {mostradosArchivados.map((b) => (
                <li
                  key={b.boletin}
                  className="border-t border-border pt-4 first:border-t-0 first:pt-0"
                >
                  <PanelItemProyecto
                    boletin={b.boletin}
                    titulo={b.titulo}
                    enCorpus={b.enCorpus}
                    ancla="timeline"
                    enlaceFuente={b.enlaceFuente}
                    detalle={
                      <>
                        {b.descripcion ?? "Archivo o retiro"} fechado el{" "}
                        {fechaCivilCorta(b.fecha)}
                      </>
                    }
                  />
                </li>
              ))}
            </ul>
            {restanteArchivados > 0 && (
              <p className="mt-3 text-[13px] text-muted-foreground">
                {restanteArchivados} más
              </p>
            )}
          </>
        )}

        <p className="mt-3 font-mono text-[11px] text-muted-foreground">
          Fuente: {fuenteFooter ?? "Tramitación"}
          {rotuloFooter && <> · según fuente al {rotuloFooter}</>}
        </p>
      </section>
    </BentoTile>
  );
}
