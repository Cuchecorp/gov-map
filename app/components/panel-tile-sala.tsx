import { fechaCivilCorta } from "@/lib/dia-calendario";
import { claseCamara } from "@/lib/panel-camara";
import { hrefAgenda, semanaIsoDeFecha } from "@/lib/links-internos";
import Link from "next/link";
import { type Idiom } from "@/lib/idioms-panel";
import {
  etiquetaFuente,
  parseEvidenciaSala,
  type ItemSesionSala,
} from "@/lib/panel-evidencia";
import { PanelItemProyecto } from "@/components/panel-item-proyecto";
import { BentoTile } from "@/components/bento/bento-tile";

/**
 * PanelTileSala — Tile 1 "En tabla de sala esta semana" (Phase 128, PANEL-02/05,
 * O-5: PRIMER tile del panel). Vista pura síncrona (RSC, JAMÁS "use client");
 * el wrapper async que lee la RPC vive en 128-06.
 *
 * Nombre de archivo CONGELADO — declarado en `SUPERFICIES_PANEL` (anti-drift 1f).
 *
 * Degradación honesta de Cámara (D-06/P10): la fila sintética de Cámara trae
 * `numero`/`tipo`/`hora_inicio` NULL — el encabezado dice solo el día +
 * "tabla semanal". PROHIBIDO fabricar "Sesión N.º X a las HH:MM".
 *
 * Chips L5 (O-4): yuxtaposición de DOS hechos fechados, molde EXACTO
 * "Urgencia {grado} fechada el {d}" — cero conectores causales.
 *
 * Stems verbatim de `IDIOMS_APROBADOS` (B-4 single-source): PROHIBIDO re-tipear.
 */

// WR-05: el invariante del single-source lo hace cumplir el TIPO `Idiom` (unión
// de literales de IDIOMS_APROBADOS). Un stem mal escrito no compila; ya no
// existe el `throw` en carga de módulo que tumbaba `/` entera en runtime.
const STEM_SALA_SENADO: Idiom = "En tabla de sala del";
const STEM_SALA_CAMARA: Idiom = "En tabla de sala de la Cámara del";
const STEM_SEGUN_FUENTE: Idiom = "según fuente al";
const STEM_FECHADA_EL: Idiom = "fechada el";

export interface PanelTileSalaProps {
  filas: { cobertura_camara: string | null; evidencia: unknown }[];
  urgencias: Map<string, { grado: string; fecha: string }>;
  maxItems?: number;
}

interface PuntoAplanado {
  boletin: string | null;
  titulo: string | null;
  enlace: string | null;
  materia: string | null;
  enCorpus: boolean;
}

function esCamara(cobertura: string | null): boolean {
  if (!cobertura) return false;
  const c = cobertura.toLowerCase();
  return c.includes("diputad") || c.includes("cámara") || c.includes("camara");
}

function EncabezadoSesion({
  cobertura,
  item,
}: {
  cobertura: string | null;
  item: ItemSesionSala;
}) {
  const barra = claseCamara(cobertura);
  const dia = fechaCivilCorta(item.fecha);
  const esCam = esCamara(cobertura);

  // Degradación honesta (D-06/P10): scalars NULL → solo el día + "tabla semanal".
  const sinDatosDeSesion = !item.numero && !item.tipo && !item.hora_inicio;

  let texto: string;
  if (sinDatosDeSesion) {
    texto = dia
      ? `${esCam ? STEM_SALA_CAMARA : STEM_SALA_SENADO} ${dia} · tabla semanal`
      : "tabla semanal";
  } else {
    // WR-03: el segmento de sesión se arma POR PARTES. Antes, `numero` null con
    // `tipo` presente dejaba un doble espacio interior (`.trim()` no lo toca) y
    // `tipo` null descartaba el `numero` que la fuente sí informó.
    const segmentoSesion =
      item.numero || item.tipo
        ? ["Sesión", item.numero, item.tipo ? `— ${item.tipo}` : null]
            .filter(Boolean)
            .join(" ")
        : null;
    const partes = [
      segmentoSesion,
      item.hora_inicio ? `a las ${item.hora_inicio}` : null,
      dia ? `${esCam ? STEM_SALA_CAMARA : STEM_SALA_SENADO} ${dia}` : null,
    ].filter(Boolean);
    texto = partes.join(" · ");
  }

  return (
    <div className="flex gap-[14px] items-start">
      {barra && (
        <span
          aria-hidden="true"
          className={`w-[3px] self-stretch rounded-[2px] ${barra}`}
        />
      )}
      <h3 className="text-[15px] font-semibold leading-snug">{texto}</h3>
    </div>
  );
}

function ChipUrgencia({
  boletin,
  urgencias,
}: {
  boletin: string | null;
  urgencias: Map<string, { grado: string; fecha: string }>;
}) {
  if (!boletin) return null;
  const u = urgencias.get(boletin);
  if (!u) return null;
  const dia = fechaCivilCorta(u.fecha);
  // WR-04: sin fecha O sin grado no hay hecho que declarar — el chip se omite
  // entero. `gradoUrgencia(...) ?? it.descripcion ?? ""` puede dar `""`, que
  // producía "Urgencia  fechada el 6 jul 2026" (verbo sin complemento).
  if (!dia || !u.grado.trim()) return null;
  return (
    <span className="mt-1 inline-flex items-center px-[9px] py-0.5 font-mono text-[11px] font-medium text-accent-product bg-accent-product-soft rounded-full">
      {`Urgencia ${u.grado} ${STEM_FECHADA_EL} ${dia}`}
    </span>
  );
}

export function PanelTileSala({
  filas,
  urgencias,
  maxItems = 4,
}: PanelTileSalaProps) {
  // Aplanar puntos con contexto de la sesión (cobertura + item), preservando
  // el ORDEN de llegada de las filas y el orden `posicion` ASC dentro de cada
  // tabla (jamás reordenar — T-52-13, regla B).
  const bloques: {
    cobertura: string | null;
    item: ItemSesionSala;
    puntos: PuntoAplanado[];
  }[] = [];

  let totalDeclarado = 0;
  let consultadoAl: string | null = null;
  let etiquetaFuenteTile: string | null = null;
  let semanaParaHref: string | null = null;

  for (const fila of filas) {
    const ev = parseEvidenciaSala(fila.evidencia);
    if (ev.consultado_al) consultadoAl = ev.consultado_al;
    // CR-04/D-02: la etiqueta sale DEL DATO (`etiquetaFuente`), jamás de un
    // literal fijo disparado por la mera presencia de `dataset`.
    etiquetaFuenteTile = etiquetaFuenteTile ?? etiquetaFuente(ev.fuente);
    for (const item of ev.items) {
      const puntosOrdenados = [...item.tabla].sort(
        (a, b) => (a.posicion ?? 0) - (b.posicion ?? 0),
      );
      const puntos: PuntoAplanado[] = puntosOrdenados.map((p) => ({
        boletin: p.boletin,
        titulo: p.titulo,
        enlace: p.enlace,
        materia: p.materia,
        enCorpus: p.en_corpus,
      }));
      bloques.push({ cobertura: fila.cobertura_camara, item, puntos });
      totalDeclarado += item.tabla_total ?? item.tabla.length;
      // WR-13: una sola línea. El condicional previo por `tabla_total > 0` era
      // lógica muerta (la línea siguiente reasignaba con la MISMA expresión).
      // La semana del "y N más" es, explícitamente, la del PRIMER bloque con
      // fecha parseable — que puede ser el de cualquiera de las dos cámaras.
      semanaParaHref ??= semanaIsoDeFecha(item.fecha);
    }
  }

  // Presupuesto de 4 (O-7) sobre los puntos aplanados de TODOS los bloques.
  // WR-02: el recorte se resuelve ANTES del JSX (cero mutación durante el
  // render, frágil ante re-render/Suspense) y solo se emiten los bloques con al
  // menos un punto visible — un `EncabezadoSesion` seguido de un `<ul>` vacío se
  // lee como "esa sesión no tiene puntos", que es falso.
  const puntosAplanadosGlobal = bloques.flatMap((b) => b.puntos);
  let presupuesto = maxItems;
  const bloquesVisibles: {
    cobertura: string | null;
    item: ItemSesionSala;
    puntos: PuntoAplanado[];
  }[] = [];
  for (const b of bloques) {
    if (presupuesto <= 0) break;
    const visiblesDelBloque = b.puntos.slice(0, presupuesto);
    if (visiblesDelBloque.length === 0) continue;
    presupuesto -= visiblesDelBloque.length;
    bloquesVisibles.push({ ...b, puntos: visiblesDelBloque });
  }
  const mostrados = maxItems - presupuesto;

  const totalPuntos = totalDeclarado || puntosAplanadosGlobal.length;
  const mostrarMas = totalPuntos > mostrados;
  // WR-01: el remanente honesto es "total − mostrados", no "total − maxItems":
  // `tabla_total` viene de un `count(*)` independiente (0081) y puede superar la
  // longitud del array de ítems, con lo que se pintan menos de `maxItems`.
  const restantes = totalPuntos - mostrados;

  // C-01: span 6 (antes 4). La grilla es de 6 columnas y el orden D-01/O-5 es
  // LOCKED; con span 4 esta fila dejaba un hueco interior de 2 columnas porque
  // el tile siguiente (comisiones, span 4) no cabía en el remanente.
  return (
    <BentoTile variant="default" span={6} asChild>
      <section className="p-6">
        <h2 className="text-lg font-semibold mb-4">
          En tabla de sala esta semana
        </h2>
        {bloquesVisibles.map((bloque, i) => (
          <div key={i} className="mb-4">
            <EncabezadoSesion cobertura={bloque.cobertura} item={bloque.item} />
            <ul>
              {bloque.puntos.map((p, j) => {
                return (
                  <li
                    key={j}
                    className="border-t border-border pt-3 first:border-t-0 first:pt-0"
                  >
                    <PanelItemProyecto
                      boletin={p.boletin}
                      titulo={p.titulo}
                      enCorpus={p.enCorpus}
                      ancla="estado"
                      textoAlterno={p.materia}
                      enlaceFuente={p.enlace}
                      detalle={<ChipUrgencia boletin={p.boletin} urgencias={urgencias} />}
                    />
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
        {mostrarMas && (
          // WR-11: link INTERNO ⇒ next/link (prefetch + navegación client-side),
          // como el resto del árbol (citacion-card, search-result-card).
          <Link
            href={hrefAgenda("tabla-sala", semanaParaHref)}
            className="text-[13px] text-accent-product hover:underline"
          >
            {`y ${restantes} más →`}
          </Link>
        )}
        <p className="mt-2 font-mono text-[11px] text-muted-foreground">
          {etiquetaFuenteTile ? `Fuente: ${etiquetaFuenteTile} · ` : ""}
          {consultadoAl
            ? `${STEM_SEGUN_FUENTE} ${fechaCivilCorta(consultadoAl)}`
            : null}
        </p>
      </section>
    </BentoTile>
  );
}
