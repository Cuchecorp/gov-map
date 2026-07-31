import { BentoTile } from "@/components/bento/bento-tile";
import { PanelItemProyecto } from "@/components/panel-item-proyecto";
import {
  parseEvidenciaProyectos,
  etiquetaFuente,
  type ItemProyecto,
} from "@/lib/panel-evidencia";
import { fechaCivilCorta } from "@/lib/dia-calendario";
import { plural } from "@/lib/plural";
import { type Idiom } from "@/lib/idioms-panel";

// WR-06: stems desde el single-source (`Idiom`), no inline.
const STEM_INGRESADO_EL: Idiom = "Ingresado el";
const STEM_FECHADO_EL: Idiom = "fechado el";

/** WR-08: vacío CON causa declarada — Regla C prohíbe la lista muda. */
const VACIO_SIN_FILAS = "sin filas para esta ventana en las fuentes consultadas";

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
  total: number;
  supresionCausa: string | null;
  consultadoAl: string | null;
  fuente: string | null;
} {
  const items: ItemProyecto[] = [];
  // Invariante H (`panel-actualidad.tsx:49-50`): el remanente se respalda con el
  // TOTAL REAL del jsonb, jamás con `items.length` a secas — el día que la RPC
  // capee `items` en el `jsonb_agg`, el largo del array subdeclara en silencio.
  let total = 0;
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
    total += ev.total ?? ev.items.length;
    fuente = fuente ?? etiquetaFuente(ev.fuente);
    // WR-15: ingresos/archivados son carril de HECHOS PASADOS ⇒ D-05 asigna
    // `fecha_max` (fecha del último hecho), no `consultado_al` (agenda futura).
    consultadoAl = consultadoAl ?? f.fecha_max ?? ev.consultado_al;
  }
  return { items, total, supresionCausa, consultadoAl, fuente };
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

  // CR-02 (129-REVIEW): la subsección de ingresos cortaba a `maxItems` SIN
  // declarar el remanente — la RPC emite los ingresos de la ventana 7d sin cap
  // (`0081` §2), así que el ciudadano veía 4 de N y NADA en el DOM se lo decía.
  // Violaba la invariante H del orquestador. Mismo idiom que
  // `panel-tile-movimiento.tsx:92-93`: la unidad de esta lista es el ÍTEM (no hay
  // agrupación), así que `total` del jsonb y el largo de la lista cuentan lo
  // mismo y `Math.max` sólo protege de un `total` subdeclarado.
  const mostradosIngresos = seccionIngresos.items.slice(0, maxItems);
  const restanteIngresos =
    Math.max(seccionIngresos.total, seccionIngresos.items.length) -
    mostradosIngresos.length;

  const porBoletinArchivados = agruparPorBoletin(seccionArchivados.items);
  const listaArchivados = Array.from(porBoletinArchivados.values());
  const totalEventosArchivados = listaArchivados.reduce(
    (acc, b) => acc + b.eventos,
    0,
  );
  const totalProyectosArchivados = listaArchivados.length;
  // WR-06 (129-REVIEW): EXCEPCIÓN DOCUMENTADA a la invariante H — aquí el
  // remanente NO se respalda con `seccionArchivados.total`, y es deliberado:
  // ese total cuenta EVENTOS (archivo, retiro…) mientras la lista de esta
  // subsección agrupa por BOLETÍN (`agruparPorBoletin`). Son unidades distintas,
  // así que el swap NO es directo: 12 eventos de 3 boletines con maxItems=4
  // daría "8 más" sobre una lista que ya muestra los 3 proyectos completos —
  // mentiría al alza. La unidad del "N más" tiene que ser la de la lista que
  // trunca, y aquí esa unidad es el proyecto.
  //
  // Riesgo asumido y declarado: si algún día la RPC capea `items` en el
  // `jsonb_agg`, esta cuenta subdeclarará en silencio. La corrección entonces NO
  // es usar `total`, sino que la RPC emita un total POR BOLETÍN.
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
        ) : seccionIngresos.items.length === 0 ? (
          // WR-08: sin causa de supresión Y sin ítems (la señal no vino en la
          // RPC) se emitía un `<ul>` mudo bajo el `<h3>`. Regla C: nunca lista
          // vacía — la ausencia se declara con su causa.
          <p className="text-sm text-muted-foreground mb-4">{VACIO_SIN_FILAS}</p>
        ) : (
          <>
          <ul className="mb-4">
            {mostradosIngresos.map((it, idx) => (
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
                  detalle={(() => {
                    // WR-04: sin día parseable, cero "Ingresado el " colgado.
                    const dia = fechaCivilCorta(it.fecha);
                    return dia ? (
                      <>
                        {STEM_INGRESADO_EL} {dia}
                      </>
                    ) : null;
                  })()}
                />
              </li>
            ))}
          </ul>
          {restanteIngresos > 0 && (
            <p className="-mt-1 mb-4 text-[13px] text-muted-foreground">
              {restanteIngresos} más
            </p>
          )}
          </>
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
        ) : listaArchivados.length === 0 ? (
          // WR-08: mismo criterio que la subsección de ingresos.
          <p className="text-sm text-muted-foreground">{VACIO_SIN_FILAS}</p>
        ) : (
          <>
            {totalEventosArchivados > 0 && (
              <p className="text-[13px] text-muted-foreground mb-3">
                {totalEventosArchivados}{" "}
                {plural(totalEventosArchivados, "evento", "eventos")} de{" "}
                {totalProyectosArchivados}{" "}
                {plural(totalProyectosArchivados, "proyecto", "proyectos")}
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
                    detalle={(() => {
                      // WR-04: sin día parseable, cero "…fechado el " colgado.
                      const dia = fechaCivilCorta(b.fecha);
                      return dia ? (
                        <>
                          {b.descripcion ?? "Archivo o retiro"}{" "}
                          {STEM_FECHADO_EL} {dia}
                        </>
                      ) : null;
                    })()}
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

        {/* WR-09: sin `fuente` en el dato, cero procedencia fabricada. */}
        <p className="mt-3 font-mono text-[11px] text-muted-foreground">
          {fuenteFooter ? `Fuente: ${fuenteFooter}` : null}
          {rotuloFooter && (
            <>
              {fuenteFooter ? " · " : ""}según fuente al {rotuloFooter}
            </>
          )}
        </p>
      </section>
    </BentoTile>
  );
}
