import { fechaCivilCorta } from "@/lib/dia-calendario";
import { hrefAgenda, semanaIsoDeFecha } from "@/lib/links-internos";
import Link from "next/link";
import { type Idiom } from "@/lib/idioms-panel";
import { plural } from "@/lib/plural";
import { etiquetaFuente, parseEvidenciaCitaciones } from "@/lib/panel-evidencia";
import { PanelItemProyecto } from "@/components/panel-item-proyecto";
import { BentoTile } from "@/components/bento/bento-tile";

/**
 * PanelTileComisiones — Tile 2 "Comisiones citadas esta semana" (Phase 128,
 * PANEL-02/05/07). Vista pura síncrona (RSC, JAMÁS "use client"); el wrapper
 * async que lee la RPC vive en 128-06.
 *
 * Nombre de archivo CONGELADO — declarado en `SUPERFICIES_PANEL` (anti-drift 1f).
 *
 * El ítem del tile es el PUNTO (el sujeto), no la citación: se aplana
 * `items[].puntos[]` conservando el contexto de la citación (comisión,
 * horario, fecha, enlace) para el detalle.
 *
 * Cobertura L7 (D-06/PANEL-07): FIX W-5 — el universo de dos cámaras se
 * declara como constante nombrada, atada a la definición del corpus. Un
 * tercer origen NO desaparece en silencio: si aparece una fila con
 * `cobertura_camara` fuera de `CAMARAS_CORPUS`, se declara igual (verbatim),
 * ampliando el listado de cobertura sin descartarla.
 */
export const CAMARAS_CORPUS = ["Cámara de Diputados", "Senado"] as const;

// Orden de despliegue del molde de cobertura L7 (D-06/PANEL-07): "N citaciones
// del Senado · N de la Cámara en las fuentes consultadas". El orden de
// despliegue es independiente del orden de CAMARAS_CORPUS (que solo declara
// el universo consultado, FIX W-5) — la etiqueta corta ("Cámara") evita
// repetir "de Diputados" en la segunda cláusula del molde.
const ORDEN_COBERTURA: Array<{ full: string; corta: string; molde: (n: number, primero: boolean) => string }> = [
  {
    full: "Senado",
    corta: "Senado",
    // D-06 (Phase 129): concordancia de número — `1 citación del Senado`.
    molde: (n) => `${n} ${plural(n, "citación", "citaciones")} del Senado`,
  },
  {
    full: "Cámara de Diputados",
    corta: "Cámara",
    molde: (n) => `${n} de la Cámara`,
  },
];

// WR-05: invariante del single-source movido al TIPO (`Idiom`). Cero `throw` en
// carga de módulo — ese fallo propagaba a los 6 tiles y a `/` (500).
const STEM_CITADO_EL: Idiom = "Citado el";
const STEM_SEGUN_FUENTE: Idiom = "según fuente al";
const STEM_FECHADA_EL: Idiom = "fechada el";

export interface PanelTileComisionesProps {
  filas: { cobertura_camara: string | null; conteo: number; evidencia: unknown }[];
  urgencias: Map<string, { grado: string; fecha: string }>;
  maxItems?: number;
}

interface PuntoContexto {
  boletin: string | null;
  titulo: string | null;
  enlace: string | null;
  materia: string | null;
  enCorpus: boolean;
  comision: string | null;
  horario: string | null;
  fechaCitacion: string | null;
  enlaceCitacion: string | null;
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
  // WR-04: sin fecha O sin grado el chip se omite entero (verbo sin complemento).
  if (!dia || !u.grado.trim()) return null;
  return (
    <span className="mt-1 inline-flex items-center px-[9px] py-0.5 font-mono text-[11px] font-medium text-accent-product bg-accent-product-soft rounded-full">
      {`Urgencia ${u.grado} ${STEM_FECHADA_EL} ${dia}`}
    </span>
  );
}

function DetallePunto({ punto }: { punto: PuntoContexto }) {
  const dia = fechaCivilCorta(punto.fechaCitacion);
  const segmentos = [
    dia ? `${STEM_CITADO_EL} ${dia}` : null,
    punto.comision ? `Comisión ${punto.comision}` : null,
    punto.horario ? punto.horario : null,
  ].filter(Boolean);
  return (
    <div className="text-[13px] text-muted-foreground">
      {segmentos.join(" · ")}
    </div>
  );
}

export function PanelTileComisiones({
  filas,
  urgencias,
  maxItems = 4,
}: PanelTileComisionesProps) {
  const puntos: PuntoContexto[] = [];
  let puntosTotalDeclarado = 0;
  let consultadoAl: string | null = null;
  let etiquetaFuenteTile: string | null = null;
  let semanaParaHref: string | null = null;

  // Cobertura L7: acumula conteo por cámara vista, sobre CAMARAS_CORPUS +
  // cualquier tercer origen que aparezca (no desaparece en silencio, W-5).
  const conteoPorCamara = new Map<string, number>();
  for (const c of CAMARAS_CORPUS) conteoPorCamara.set(c, 0);
  // CR-03: las filas con `cobertura_camara: null` tampoco desaparecen — se
  // acumulan aparte y se declaran como segmento propio ("sin cámara informada").
  let conteoSinCamara = 0;
  for (const fila of filas) {
    const clave = fila.cobertura_camara ?? null;
    if (clave) {
      conteoPorCamara.set(clave, (conteoPorCamara.get(clave) ?? 0) + fila.conteo);
    } else {
      conteoSinCamara += fila.conteo;
    }
  }

  // CR-03: el molde renderizado itera TODOS los orígenes acumulados, no solo
  // ORDEN_COBERTURA. Los 2 canónicos siempre se declaran (con 0 explícito, cero
  // mudo); cualquier tercer origen se suma VERBATIM al final, sin mapa. Afirmar
  // "…en las fuentes consultadas" sobre un denominador que descarta orígenes es
  // exactamente lo que PANEL-07 prohíbe.
  const segmentosCobertura: string[] = [
    ...ORDEN_COBERTURA.map((c, i) =>
      c.molde(conteoPorCamara.get(c.full) ?? 0, i === 0),
    ),
    ...[...conteoPorCamara.entries()]
      .filter(([k]) => !ORDEN_COBERTURA.some((c) => c.full === k))
      .map(([k, n]) => `${n} de ${k}`),
  ];
  if (conteoSinCamara > 0) {
    segmentosCobertura.push(`${conteoSinCamara} sin cámara informada`);
  }

  for (const fila of filas) {
    const ev = parseEvidenciaCitaciones(fila.evidencia);
    if (ev.consultado_al) consultadoAl = ev.consultado_al;
    // CR-04/D-02: etiqueta DESDE EL DATO, jamás un literal fijo.
    etiquetaFuenteTile = etiquetaFuenteTile ?? etiquetaFuente(ev.fuente);
    for (const item of ev.items) {
      puntosTotalDeclarado += item.puntos_total ?? item.puntos.length;
      const semana = item.semana_iso ?? semanaIsoDeFecha(item.fecha);
      if (!semanaParaHref) semanaParaHref = semana;
      for (const p of item.puntos) {
        puntos.push({
          boletin: p.boletin,
          titulo: p.titulo,
          enlace: p.enlace,
          materia: p.materia,
          enCorpus: p.en_corpus,
          comision: item.comision,
          horario: item.horario,
          fechaCitacion: item.fecha,
          enlaceCitacion: item.enlace,
        });
      }
    }
  }

  const totalPuntos = puntosTotalDeclarado || puntos.length;
  const puntosVisibles = puntos.slice(0, maxItems);
  // WR-01: remanente atado a lo REALMENTE mostrado. `puntos_total` es un
  // `count(*)` independiente (0081) que puede superar el largo del array.
  const mostrarMas = totalPuntos > puntosVisibles.length;
  const restantes = totalPuntos - puntosVisibles.length;

  return (
    <BentoTile variant="default" span={4} asChild>
      <section className="p-6">
        <h2 className="text-lg font-semibold mb-4">
          Comisiones citadas esta semana
        </h2>
        <ul>
          {puntosVisibles.map((p, i) => (
            <li
              key={i}
              className="border-t border-border pt-3 first:border-t-0 first:pt-0"
            >
              <PanelItemProyecto
                boletin={p.boletin}
                titulo={p.titulo}
                enCorpus={p.enCorpus}
                ancla="estado"
                textoAlterno={p.materia}
                enlaceFuente={p.boletin ? p.enlace : p.enlaceCitacion}
                detalle={
                  <>
                    <DetallePunto punto={p} />
                    <ChipUrgencia boletin={p.boletin} urgencias={urgencias} />
                  </>
                }
              />
            </li>
          ))}
        </ul>
        {mostrarMas && (
          // WR-11: link interno ⇒ next/link (prefetch, sin full reload).
          <Link
            href={hrefAgenda("citaciones", semanaParaHref)}
            className="text-[13px] text-accent-product hover:underline"
          >
            {`y ${restantes} más →`}
          </Link>
        )}
        {/* Cobertura L7: denominador obligatorio, cero mudo (T-128-09) */}
        <p className="mt-2 text-[13px]">
          {`${segmentosCobertura.join(" · ")} en las fuentes consultadas`}
        </p>
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
