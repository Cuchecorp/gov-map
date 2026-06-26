import Link from "next/link";

import { createServerSupabase } from "@/lib/supabase";
import { PatrimonioChart } from "@/components/patrimonio-chart";
import { ProvenanceBadge } from "@/components/provenance-badge";
import { IdentityMarker } from "@/components/identity-marker";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { fechaCorta } from "@/lib/format";
import {
  sourceLabel,
  type DeclaracionRpcRow,
  type CompararDeclaracionRpcRow,
  type DeclaracionVersionRow,
  type DeclaracionComparacionColumna,
  type BienRpcRow,
  type TipoBien,
} from "@/lib/types";

/**
 * Sección INT Patrimonio/Intereses de la ficha del parlamentario (UI-SPEC §3). Es
 * la TERCERA sección multi-dataset de `/parlamentario/[id]` (tras #votos y #lobby),
 * apilada en su PROPIO carril (mt-12). El historial de versiones FECHADO (INT-04) y
 * la comparación lado-a-lado SOLO de datos (INT-05) son el corazón de la fase.
 *
 * ┌───────────────────────────────────────────────────────────────────────────┐
 * │ GATE DE CONTENIDO (UI-SPEC §9.1, RELEASE GATE DE LA FASE)                    │
 * │ Cubre TANTO la lista de versiones COMO la vista de comparación (cierra la    │
 * │ brecha `representado` de Phase 11: TODO campo renderizado — en la lista Y    │
 * │ en la comparación — vive en el contrato §10 con etiqueta NOUN, jamás prosa). │
 * │                                                                             │
 * │ 1. CERO VEREDICTO (la regla más fuerte, PROJECT.md hard anti-feature):      │
 * │    prohibido "enriquecimiento", "conflicto de interés", "aumentó/disminuyó",│
 * │    "incrementó", "variación", "delta"/"Δ", "creció", "pasó de", "más rico", │
 * │    "patrimonio total" (como suma computada), "%" de cambio. La comparación  │
 * │    dispone valores literales en columnas fechadas y NADA MÁS. Un campo      │
 * │    ausente lee "No declarado en esta versión" (HECHO), nunca "—" ni un gap. │
 * │ 2. CERO CAUSALIDAD: "para", "a cambio de", "antes de votar", "que resultó". │
 * │ 3. CERO AFINIDAD/PROSA CONECTIVA: "en representación de", "vinculado a",     │
 * │    "asociado con", "pasó de X a Y". Cada campo = NOUN label + valor literal. │
 * │ 4. CERO score/índice/ranking/flag: sin "patrimonio elevado", sin conflict   │
 * │    score, sin comparación-con-pares. Un conteo NEUTRO es el único agregado. │
 * │ 5. CERO adjetivo de juicio: "elevado", "sospechoso", "millonario", "opaco". │
 * │ 6. FRESCURA HONESTA (INT-04): una vieja se rotula histórica (ámbar+caveat), │
 * │    NUNCA se lee como estado actual. La más reciente se rotula por su FECHA.  │
 * │ 7. Identidad: solo `confirmado` entra; "identidad no verificada" exacto.    │
 * │ 8. PRIVACIDAD ABSOLUTA (LEGAL-03): NUNCA RUT del parlamentario, NUNCA un     │
 * │    nombre/RUT de familiar, NUNCA campo interno; el RPC no los proyecta.      │
 * │ 9. PROVENANCE + CC BY 4.0 por versión Y repetida en el caption de la         │
 * │    comparación (vista derivada, CONTEXT LOCKED).                            │
 * │ 10. Un vacío es un HECHO, no una virtud: "no ingestado" ≠ "ingestado, cero".│
 * └───────────────────────────────────────────────────────────────────────────┘
 *
 * `PatrimonioView` + `DeclaracionComparacion` son PUROS (props) → RTL los testea
 * con fixtures. `PatrimonioSection` es el Server Component que lee los RPCs y el
 * marcador de ingesta. NO hay `"use client"` (comparación SSR vía `?comparar=A,B`).
 */

const PAGE_SIZE = 10;
const CC_BY_40_URL = "https://creativecommons.org/licenses/by/4.0/";

// ── Datos que la vista del historial necesita (forma pura, testeable) ────────────
export interface PatrimonioViewData {
  id: string;
  /** versiones confirmadas de la página actual (orden fecha_presentacion DESC). */
  versiones: DeclaracionVersionRow[];
  /** total de versiones confirmadas (para "Página N de M" + el conteo neutro). */
  totalVersiones: number;
  page: number;
  totalPages: number;
  /** `true` si la ingesta de probidad aún NO corrió para este parlamentario
   * (estado (a) "no ingestado" — distinto de "ingestado, 0 confirmadas"). */
  noIngestado: boolean;
  /** versión cuyo detalle de campos está abierto (`?ver=<versionId>`), si alguna. */
  verAbierta: string | null;
  /**
   * Serie de CONTEO de ítems declarados por versión (un punto por declaración),
   * derivada del set COMPLETO `todas` — NO la rebanada paginada `versiones`. Data
   * plana (strings+numbers) que el shell pasa al island Recharts `<PatrimonioChart>`.
   */
  serie: SeriePunto[];
}

/**
 * Un punto de la serie de patrimonio = el CONTEO de bienes por `tipo_bien` de UNA
 * versión de declaración. Forma PLANA y serializable (solo strings+numbers) que
 * cruza la frontera RSC→client island sin `Date` ni objeto. `tipo_declaracion`
 * mantiene cada versión DISTINTA: el chart NUNCA fusiona versiones incomparables
 * (periódica vs rectificación) en una serie continua (VIZ-01, anti-insinuación).
 * NUNCA lleva montos (son URIs CPLT, no cifras): el caveat lo dice server-side.
 */
export interface SeriePunto {
  /** Año de `fecha_presentacion.slice(0,4)` como number — NUNCA `new Date()`. */
  anio: number;
  /** Categoría literal de la fuente (periódica / rectificación / cese). */
  tipo_declaracion: string;
  /**
   * Identificador ESTABLE de la versión (no un índice de array que se corre al
   * reordenar). Discrimina dos declaraciones del MISMO año Y MISMO tipo para que
   * el chart NO las funda en una sola banda comparable (VIZ-01, anti-insinuación).
   */
  version_id: string;
  inmueble: number;
  mueble: number;
  actividad: number;
  pasivo: number;
  accion_derecho: number;
  valor: number;
}

/**
 * Transform PURO `DeclaracionVersionRow[]` → `SeriePunto[]`: una versión = un punto.
 * Cuenta `v.bienes` por `tipo_bien` (los 6 `TipoBien` inicializados en 0), deriva el
 * `anio` del string ISO `fecha_presentacion` (slice, sin `Date` — la salida cruza al
 * cliente y debe ser JSON plano) y arrastra `v.tipo` como `tipo_declaracion`. NUNCA
 * agrupa por año cruzando tipos de declaración, NUNCA lee `contenido`, NUNCA toca un
 * monto. El degrade `<2` lo decide el shell, no el transform (aquí `[] → []`, 1 → 1).
 */
export function seriePatrimonio(
  versiones: DeclaracionVersionRow[],
): SeriePunto[] {
  return versiones.map((v) => {
    const counts: Record<TipoBien, number> = {
      inmueble: 0,
      mueble: 0,
      actividad: 0,
      pasivo: 0,
      accion_derecho: 0,
      valor: 0,
    };
    for (const b of v.bienes) counts[b.tipo_bien]++;
    return {
      anio: Number(v.fecha_presentacion.slice(0, 4)),
      tipo_declaracion: v.tipo,
      // Discriminador estable por versión (VIZ-01): el chart no funde dos
      // declaraciones del mismo año Y mismo tipo en una sola banda.
      version_id: v.version_id,
      ...counts,
    };
  });
}

/**
 * Shell SERVER del chart de patrimonio (SSR; el island Recharts solo se monta con
 * ≥2 puntos). Renderiza SIEMPRE el caveat honesto de montos-como-URI y el footer
 * CC BY 4.0 (reusa `AtribucionCcBy`). Con <2 declaraciones muestra el degrade
 * "datos insuficientes para mostrar el conteo de ítems por año" (HECHO neutro en
 * marco de CONTEO, jamás "tendencia" — el header del chart prohíbe insinuar una
 * trayectoria) y NO monta la isla — el degrade es grep-testable sin
 * SVG. SOLO conteos; los montos NUNCA se grafican (son URIs CPLT, no cifras).
 */
function PatrimonioChartShell({ serie }: { serie: SeriePunto[] }) {
  return (
    <section aria-label="Bienes declarados por año" className="my-6">
      {serie.length < 2 ? (
        <p className="text-sm text-muted-foreground">
          Datos insuficientes para mostrar el conteo de ítems por año: se
          necesitan al menos dos declaraciones.
        </p>
      ) : (
        <PatrimonioChart serie={serie} />
      )}
      {/* Caveat honesto: los montos vienen como URIs en la fuente, no como cifra. */}
      <p className="mt-2 text-sm text-muted-foreground">
        Montos no disponibles como cifra en la fuente. El gráfico muestra el N.º de
        bienes declarados por año, nunca su valor.
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        <AtribucionCcBy />
      </p>
    </section>
  );
}

function buildHistorialHref(id: string, page: number): string {
  const qs = new URLSearchParams({ patrimonioPage: String(page) }).toString();
  return `/parlamentario/${id}?${qs}#patrimonio`;
}

function buildVerHref(id: string, versionId: string | null): string {
  const qs = new URLSearchParams();
  if (versionId) qs.set("ver", versionId);
  const q = qs.toString();
  return `/parlamentario/${id}${q ? `?${q}` : ""}#patrimonio`;
}

// ── Atribución CC BY 4.0 VISIBLE (intro + caption de comparación) ───────────────
function AtribucionCcBy() {
  return (
    <span>
      Fuente: InfoProbidad — Consejo para la Transparencia. Datos bajo licencia CC
      BY 4.0.{" "}
      <a
        href={CC_BY_40_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="underline underline-offset-2 hover:text-foreground"
        aria-label="Ver licencia CC BY 4.0 (abre en nueva pestaña)"
      >
        Ver licencia ↗
      </a>
    </span>
  );
}

// ── Bienes declarados por versión: orden fijo + etiquetas NOUN (§3.3) ────────────

/**
 * Orden FIJO de los grupos de bienes (UI-SPEC §3.3). Cada entrada lleva su label
 * humano en español; el conteo se anexa al renderizar ("Bienes inmuebles (N)").
 * Un conteo por grupo es el ÚNICO agregado permitido (factual, NEUTRO) — NUNCA
 * una suma de montos, delta ni veredicto (PROJECT.md hard anti-feature, LOCKED).
 */
const ORDEN_GRUPOS_BIENES: ReadonlyArray<{ tipo: TipoBien; label: string }> = [
  { tipo: "inmueble", label: "Bienes inmuebles" },
  { tipo: "actividad", label: "Actividades e intereses" },
  { tipo: "accion_derecho", label: "Acciones y derechos" },
  { tipo: "valor", label: "Valores" },
  { tipo: "mueble", label: "Bienes muebles" },
  { tipo: "pasivo", label: "Pasivos" },
];

/**
 * Mapa clave camelCase del `contenido` jsonb → etiqueta NOUN en español. Una clave
 * desconocida cae a la clave cruda (degradación honesta, nunca se oculta el dato).
 */
const ETIQUETAS_CONTENIDO: Readonly<Record<string, string>> = {
  // inmueble
  ubicadoEn: "Ubicado en",
  rolAvaluo: "Rol de avalúo",
  numInscripcion: "N° inscripción",
  fojas: "Fojas",
  anio: "Año",
  esSuDomicilio: "Es su domicilio",
  // mueble
  nombre: "Nombre",
  descripcion: "Descripción",
  modelo: "Modelo",
  anioFabricacion: "Año de fabricación",
  matricula: "Matrícula",
  numeroInscripcion: "N° inscripción",
  anioInscripcion: "Año de inscripción",
  tonelaje: "Tonelaje",
  // actividad
  objeto: "Objeto",
  vinculo: "Vínculo",
  remunerado: "Remunerado",
  haceDoceMeses: "Hace 12 meses",
  // pasivo
  tipoObligacion: "Tipo de obligación",
  acreedor: "Acreedor",
  montoDeuda: "Monto de la deuda",
  // accion_derecho
  rutJuridica: "RUT (persona jurídica)",
  cantidadAcciones: "Cantidad de acciones",
  fechaAdquisicion: "Fecha de adquisición",
  esControlador: "Es controlador",
  gravamenes: "Gravámenes",
  // valor
  entidadEmisora: "Entidad emisora",
  tipoAccionDerecho: "Tipo",
  cantidadRepresenta: "Cantidad",
  valorPlaza: "Valor de plaza",
  paisQueEmite: "País emisor",
  tipoGravamen: "Tipo de gravamen",
};

/** Etiqueta NOUN para una clave de `contenido`; clave cruda si es desconocida. */
export function etiquetaBien(clave: string): string {
  return ETIQUETAS_CONTENIDO[clave] ?? clave;
}

/**
 * Agrupa los bienes de UNA versión por `tipo_bien` en el orden fijo §3.3. Omite
 * grupos vacíos. El UI NO computa nada salvo el conteo NEUTRO por grupo.
 */
export function agruparBienesPorTipo(
  bienes: BienRpcRow[],
): Array<{ tipo: TipoBien; label: string; bienes: BienRpcRow[] }> {
  return ORDEN_GRUPOS_BIENES.map(({ tipo, label }) => ({
    tipo,
    label,
    bienes: bienes.filter((b) => b.tipo_bien === tipo),
  })).filter((g) => g.bienes.length > 0);
}

/** Pares clave→valor literal de un `contenido`, etiqueta NOUN + valor verbatim. */
export function paresDeContenido(
  contenido: Record<string, unknown>,
): Array<{ etiqueta: string; valor: string }> {
  return Object.entries(contenido).map(([clave, valor]) => ({
    etiqueta: etiquetaBien(clave),
    // Valor LITERAL verbatim (string como vino de la fuente; otros tipos → String()).
    valor: typeof valor === "string" ? valor : String(valor),
  }));
}

/**
 * Bienes de UNA versión, agrupados por tipo en orden fijo. Cada bien dispone su
 * `contenido` como un <dl> de etiqueta NOUN → valor literal. SOLO datos: CERO
 * suma, CERO delta, CERO veredicto. Si la versión no declara bienes, muestra una
 * línea muted honesta (vacío = HECHO, no "no tiene patrimonio").
 */
function BienesDeVersion({ bienes }: { bienes: BienRpcRow[] }) {
  const grupos = agruparBienesPorTipo(bienes);

  if (grupos.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Esta versión no declara bienes en las fuentes consultadas.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {grupos.map((grupo) => (
        <section key={grupo.tipo}>
          {/* Conteo NEUTRO por grupo — único agregado permitido (§3.6), factual. */}
          <h4 className="text-sm font-semibold">
            {grupo.label} ({grupo.bienes.length})
          </h4>
          <ul className="mt-1 flex flex-col gap-2">
            {grupo.bienes.map((bien, bi) => {
              const pares = paresDeContenido(bien.contenido);
              return (
                <li
                  key={`${grupo.tipo}-${bi}`}
                  className="border-l-2 border-muted pl-3"
                >
                  <dl className="grid grid-cols-1 gap-1 sm:grid-cols-[max-content_1fr] sm:gap-x-4">
                    {pares.map((p, pi) => (
                      <div key={`${grupo.tipo}-${bi}-${pi}`} className="contents">
                        <dt className="text-sm text-muted-foreground">
                          {p.etiqueta}:
                        </dt>
                        {/* Valor LITERAL verbatim de la fuente — nunca computado. */}
                        <dd className="text-base">{p.valor}</dd>
                      </div>
                    ))}
                  </dl>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

// ── Una versión de declaración (fila del historial) ─────────────────────────────
function VersionRow({
  id,
  version,
  abierta,
}: {
  id: string;
  version: DeclaracionVersionRow;
  abierta: boolean;
}) {
  const captured = version.fecha_captura
    ? new Date(version.fecha_captura)
    : null;
  const fechaTexto = fechaCorta(new Date(version.fecha_presentacion));
  const noConfirmado = version.parlamentario_estado_vinculo !== "confirmado";

  return (
    <li className="flex flex-col gap-2 py-4 border-t first:border-t-0">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        {/* Fecha de presentación PROMINENTE (mono, text-base, labeled). INT-04. */}
        <span className="font-mono text-base leading-none">
          Presentada el {fechaTexto}
        </span>
        {/* Tipo de declaración: label literal de la fuente, muted, sin editorializar. */}
        <span className="text-sm text-muted-foreground">{version.tipo}</span>
        {/* ProvenanceBadge por versión (obligatorio); ámbar = frescura. */}
        <span className="ml-auto">
          <ProvenanceBadge
            capturedAt={captured}
            sourceName={sourceLabel(version.origen)}
            sourceUrl={version.enlace}
          />
        </span>
      </div>

      {/* Caveat de frescura §6.4: una vieja se marca histórica, nunca "actual". */}
      {version.es_historica && (
        <p className="text-sm text-amber-700">
          Esta es una declaración histórica, presentada el {fechaTexto}. No
          representa necesariamente el estado actual.
        </p>
      )}

      {/* Guarda de identidad §3.4: una mención no-confirmada lleva IdentityMarker. */}
      {noConfirmado && version.parlamentario_mencion && (
        <p className="text-sm text-muted-foreground">
          <span>Declarante según la fuente: {version.parlamentario_mencion}</span>
          <IdentityMarker />
        </p>
      )}

      {/*
        Campos declarados: <dl> NOUN label + valor literal verbatim (§3.3). Se
        muestran inline (escaneable); para una declaración larga, el detalle
        completo se abre server-driven con `?ver=<versionId>`. Cada valor es
        verbatim de la fuente — el UI NO computa ni resume nada.
      */}
      {version.campos.length > 0 ? (
        <dl className="grid grid-cols-1 gap-1 sm:grid-cols-[max-content_1fr] sm:gap-x-4">
          {(abierta ? version.campos : version.campos.slice(0, 4)).map((c, i) => (
            <div key={`${version.version_id}-${i}`} className="contents">
              <dt className="text-sm text-muted-foreground">{c.etiqueta}:</dt>
              <dd className="text-base">{c.valor}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="text-sm text-muted-foreground">
          Esta versión no detalla campos en la fuente.
        </p>
      )}
      {!abierta && version.campos.length > 4 && (
        <Link
          href={buildVerHref(id, version.version_id)}
          className="text-primary underline underline-offset-2 inline-flex items-center min-h-[44px] text-sm self-start"
        >
          Ver detalle de la declaración
        </Link>
      )}

      {/* Bienes declarados de esta versión (agrupados por tipo, solo datos). */}
      <BienesDeVersion bienes={version.bienes} />
    </li>
  );
}

// ── Vista pura del historial (RTL la testea con fixtures) ───────────────────────
export function PatrimonioView({ data }: { data: PatrimonioViewData }) {
  const { id, versiones, totalVersiones, page, totalPages, noIngestado } = data;

  const intro = (
    <div className="mb-4 space-y-1">
      <p className="text-sm text-muted-foreground">
        Declaraciones de patrimonio e intereses presentadas ante el Consejo para
        la Transparencia (InfoProbidad). Cada versión se muestra tal como la
        declaró el parlamentario, con su fecha de presentación.
      </p>
      <p className="text-sm text-muted-foreground">
        <AtribucionCcBy />
      </p>
    </div>
  );

  // Estado (a) — NO ingestado: NUNCA se lee como "limpio"/"no tiene patrimonio".
  if (noIngestado) {
    return (
      <>
        {intro}
        <p className="text-sm text-muted-foreground">
          Aún no hemos ingerido las declaraciones de patrimonio e intereses de
          este parlamentario. Esto no significa que no haya declarado — los datos
          de InfoProbidad se están incorporando.
        </p>
      </>
    );
  }

  // Estado (b) — ingestado, cero versiones confirmadas.
  if (totalVersiones === 0) {
    return (
      <>
        {intro}
        <p className="text-sm text-muted-foreground">
          No se registran declaraciones de patrimonio e intereses confirmadas para
          este parlamentario, según InfoProbidad.
        </p>
      </>
    );
  }

  // Estado (c) — con versiones.
  return (
    <div>
      {intro}

      {/* Conteo NEUTRO — único agregado permitido (§3.6), sin score/ranking. */}
      <p className="text-sm text-muted-foreground mb-4">
        {totalVersiones}{" "}
        {totalVersiones === 1
          ? "versión registrada"
          : "versiones registradas"}
        .
      </p>

      {/* Chart del conteo de ítems por año (VIZ-01/02/03): isla cliente Recharts
          montada solo con ≥2 declaraciones, con caveat de montos + footer CC BY. */}
      <PatrimonioChartShell serie={data.serie} />

      <ul>
        {versiones.map((v) => (
          <VersionRow
            key={v.version_id}
            id={id}
            version={v}
            abierta={data.verAbierta === v.version_id}
          />
        ))}
      </ul>

      {totalPages > 1 && (
        <nav
          className="flex items-center justify-between gap-4 mt-4 text-sm"
          aria-label="Paginación de declaraciones"
        >
          {page > 1 ? (
            <Link
              href={buildHistorialHref(id, page - 1)}
              className="text-primary underline underline-offset-2 inline-flex items-center min-h-[44px]"
            >
              Anteriores
            </Link>
          ) : (
            <span aria-hidden="true" />
          )}
          <span className="text-muted-foreground font-mono">
            Página {page} de {totalPages}
          </span>
          {page < totalPages ? (
            <Link
              href={buildHistorialHref(id, page + 1)}
              className="text-primary underline underline-offset-2 inline-flex items-center min-h-[44px]"
            >
              Siguientes
            </Link>
          ) : (
            <span aria-hidden="true" />
          )}
        </nav>
      )}
    </div>
  );
}

// ── Vista pura de la COMPARACIÓN lado-a-lado (SOLO DATOS, CERO veredicto) ────────
export function DeclaracionComparacion({
  columnas,
  totalVersiones,
}: {
  id: string;
  /** columnas seleccionadas (`?comparar=A,B`), ya resueltas a etiqueta→valor. */
  columnas: DeclaracionComparacionColumna[];
  /** total de versiones confirmadas registradas (para el hecho neutro). */
  totalVersiones: number;
}) {
  // Hecho neutro (no deficiencia) si no hay ≥2 versiones para comparar (§6.1).
  if (columnas.length < 2) {
    return (
      <div className="mt-8">
        <h3 className="text-sm font-semibold mb-2">Comparar versiones</h3>
        <p className="text-sm text-muted-foreground">
          Se necesita más de una versión para comparar. Hay {totalVersiones}{" "}
          {totalVersiones === 1 ? "versión registrada" : "versiones registradas"}.
        </p>
      </div>
    );
  }

  // Unión ordenada de TODAS las etiquetas presentes en cualquier columna →
  // una fila por campo declarado. El UI NO computa nada: solo dispone valores.
  const etiquetas = Array.from(
    new Set(columnas.flatMap((c) => Object.keys(c.valores))),
  ).sort();

  return (
    <div className="mt-8">
      <h3 className="text-sm font-semibold mb-2">Comparar versiones</h3>
      <Table>
        <TableCaption>
          Comparación de declaraciones. Cada columna es una versión, fechada por
          su fecha de presentación. Se muestran solo los datos declarados, sin
          cálculo ni interpretación. <AtribucionCcBy />
        </TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead scope="col">Campo</TableHead>
            {columnas.map((c, i) => (
              <TableHead key={`col-${i}`} scope="col" className="font-mono">
                Presentada el {fechaCorta(new Date(c.fecha_presentacion))}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {etiquetas.map((etiqueta) => (
            <TableRow key={etiqueta}>
              <TableHead scope="row" className="font-normal text-foreground">
                {etiqueta}
              </TableHead>
              {columnas.map((c, i) => {
                const presente = Object.prototype.hasOwnProperty.call(
                  c.valores,
                  etiqueta,
                );
                return (
                  <TableCell key={`${etiqueta}-${i}`}>
                    {/* Valor literal verbatim; ausente = HECHO, nunca "—" ni gap coloreado. */}
                    {presente ? (
                      c.valores[etiqueta]
                    ) : (
                      <span className="text-muted-foreground">
                        No declarado en esta versión
                      </span>
                    )}
                  </TableCell>
                );
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* ProvenanceBadge por columna (obligatorio), bajo la tabla. */}
      <div className="flex flex-wrap gap-3 mt-3">
        {columnas.map((c, i) => (
          <ProvenanceBadge
            key={`prov-${i}`}
            capturedAt={c.fecha_captura ? new Date(c.fecha_captura) : null}
            sourceName={sourceLabel(c.origen)}
            sourceUrl={c.enlace}
          />
        ))}
      </div>
    </div>
  );
}

// ── Helpers de modelado RPC → forma de vista ────────────────────────────────────

/**
 * Modela las filas crudas del RPC `declaraciones_de_parlamentario` (campos
 * escalares por versión) en `DeclaracionVersionRow[]`. El RPC SOLO devuelve
 * confirmadas → todas se atribuyen al parlamentario `p_id`. `es_historica` se
 * deriva por frescura (más vieja que el umbral de periodo legislativo).
 */
export function modelarVersiones(
  filas: DeclaracionRpcRow[],
  p_id: string,
  bienesPorFuente: Map<string, BienRpcRow[]> = new Map(),
  now: Date = new Date(),
): DeclaracionVersionRow[] {
  return filas.map((f) => {
    const campos: Array<{ etiqueta: string; valor: string }> = [];
    if (f.cargo) campos.push({ etiqueta: "Cargo", valor: f.cargo });
    if (f.organismo) campos.push({ etiqueta: "Organismo", valor: f.organismo });
    return {
      declaracion_id: f.fuente_id,
      version_id: f.fuente_id,
      tipo: f.tipo,
      fecha_presentacion: f.fecha_presentacion,
      // El RPC solo emite confirmadas → la atribución es a p_id.
      parlamentario_id: p_id,
      parlamentario_estado_vinculo: "confirmado",
      parlamentario_mencion: "",
      campos,
      origen: f.origen,
      fecha_captura: f.fecha_captura,
      enlace: f.enlace,
      licencia: "CC BY 4.0",
      es_historica: esHistorica(f.fecha_presentacion, now),
      // Bienes de ESTA versión (por fuente_id); default [] si no hay ninguno.
      bienes: bienesPorFuente.get(f.fuente_id) ?? [],
    } satisfies DeclaracionVersionRow;
  });
}

/** Agrupa las filas de `bienes_de_parlamentario` por `fuente_id` (su versión). */
export function agruparBienesPorFuente(
  filas: BienRpcRow[],
): Map<string, BienRpcRow[]> {
  const porFuente = new Map<string, BienRpcRow[]>();
  for (const b of filas) {
    const arr = porFuente.get(b.fuente_id);
    if (arr) arr.push(b);
    else porFuente.set(b.fuente_id, [b]);
  }
  return porFuente;
}

/**
 * `true` si la declaración es de un periodo legislativo anterior (umbral de
 * dominio para "histórica" — > ~1 año), distinto del umbral 48h de frescura de
 * captura. Una vieja se marca histórica + ámbar, nunca se lee como actual.
 */
export function esHistorica(
  fechaPresentacion: string,
  now: Date = new Date(),
): boolean {
  const presentada = new Date(fechaPresentacion).getTime();
  const unAnioMs = 365 * 24 * 60 * 60 * 1000;
  return now.getTime() - presentada > unAnioMs;
}

/**
 * Modela las filas crudas del RPC `comparar_declaraciones` (una fila por
 * versión × campo, etiqueta/valor literal) en columnas por `fecha_presentacion`.
 * El UI NO computa NADA: cada celda es el valor literal de esa versión.
 */
export function modelarColumnas(
  filas: CompararDeclaracionRpcRow[],
  fechasOrden: string[],
): DeclaracionComparacionColumna[] {
  const porFecha = new Map<string, DeclaracionComparacionColumna>();
  for (const f of filas) {
    let col = porFecha.get(f.fecha_presentacion);
    if (!col) {
      col = {
        fecha_presentacion: f.fecha_presentacion,
        origen: f.origen,
        fecha_captura: f.fecha_captura,
        enlace: f.enlace,
        licencia: f.licencia,
        valores: {},
      };
      porFecha.set(f.fecha_presentacion, col);
    }
    // Campo declarado: etiqueta NOUN → valor literal (verbatim, "" → omitido).
    if (f.valor != null && f.valor !== "") {
      col.valores[f.etiqueta] = f.valor;
    }
  }
  // Orden de columnas = orden pedido (fechas seleccionadas), DESC por defecto.
  const orden = fechasOrden.length
    ? fechasOrden
    : Array.from(porFecha.keys()).sort().reverse();
  return orden
    .map((fecha) => porFecha.get(fecha))
    .filter((c): c is DeclaracionComparacionColumna => c != null);
}

// ── Server Component: lee los RPCs + el marcador de ingesta ──────────────────────
export async function PatrimonioSection({
  id,
  searchParams,
}: {
  id: string;
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const sb = createServerSupabase();

  const single = (k: string): string | undefined => {
    const v = searchParams[k];
    return Array.isArray(v) ? v[0] : v;
  };

  const page = Math.max(1, Number.parseInt(single("patrimonioPage") ?? "1", 10) || 1);
  const verAbierta = single("ver") ?? null;
  const compararRaw = single("comparar");
  const fechasComparar = compararRaw
    ? compararRaw.split(",").map((s) => s.trim()).filter(Boolean)
    : [];

  // Historial (el RPC solo devuelve confirmadas, orden fecha_presentacion DESC).
  const { data: rpcData, error: rpcError } = await sb.rpc(
    "declaraciones_de_parlamentario",
    { p_id: id },
  );
  // #34: error real de DB/red ≠ "sin declaraciones". Se lanza → UI de error honesta.
  if (rpcError) {
    throw new Error(
      `declaraciones_de_parlamentario falló para ${id}: ${rpcError.message}`,
    );
  }
  const filas = (rpcData as DeclaracionRpcRow[] | null) ?? [];

  // Bienes declarados por versión (RPC aparte). #34: error real de DB/red ≠ "sin
  // bienes" → se LANZA (degradación honesta, mismo patrón que declaraciones).
  const { data: bienesData, error: bienesError } = await sb.rpc(
    "bienes_de_parlamentario",
    { p_id: id },
  );
  if (bienesError) {
    throw new Error(
      `bienes_de_parlamentario falló para ${id}: ${bienesError.message}`,
    );
  }
  const bienesPorFuente = agruparBienesPorFuente(
    (bienesData as BienRpcRow[] | null) ?? [],
  );

  const todas = modelarVersiones(filas, id, bienesPorFuente);

  // Estado (a) vs (b): AUSENCIA de fila en probidad_ingesta_estado = "no ingestado".
  const { data: estadoData, error: estadoError } = await sb
    .from("probidad_ingesta_estado")
    .select("parlamentario_id")
    .eq("parlamentario_id", id)
    .maybeSingle<{ parlamentario_id: string }>();
  if (estadoError) {
    throw new Error(
      `probidad_ingesta_estado falló para ${id}: ${estadoError.message}`,
    );
  }
  const noIngestado = estadoData === null && todas.length === 0;

  // Paginación server-driven.
  const totalVersiones = todas.length;
  const totalPages = Math.max(1, Math.ceil(totalVersiones / PAGE_SIZE));
  const pageClamped = Math.min(page, totalPages);
  const start = (pageClamped - 1) * PAGE_SIZE;
  const versiones = todas.slice(start, start + PAGE_SIZE);

  // Comparación SSR (`?comparar=A,B`) — solo si pidieron ≥2 fechas.
  let columnas: DeclaracionComparacionColumna[] = [];
  if (fechasComparar.length >= 2) {
    const { data: cmpData, error: cmpError } = await sb.rpc(
      "comparar_declaraciones",
      { p_id: id, fechas: fechasComparar },
    );
    if (cmpError) {
      throw new Error(
        `comparar_declaraciones falló para ${id}: ${cmpError.message}`,
      );
    }
    columnas = modelarColumnas(
      (cmpData as CompararDeclaracionRpcRow[] | null) ?? [],
      fechasComparar,
    );
  }

  return (
    <>
      <PatrimonioView
        data={{
          id,
          versiones,
          totalVersiones,
          page: pageClamped,
          totalPages,
          noIngestado,
          verAbierta,
          // Serie del chart desde el SET COMPLETO `todas` (todos los años), NO la
          // rebanada paginada `versiones`. Cero query nueva, cero RPC nueva.
          serie: seriePatrimonio(todas),
        }}
      />
      {totalVersiones > 0 && (
        <DeclaracionComparacion
          id={id}
          columnas={columnas}
          totalVersiones={totalVersiones}
        />
      )}
    </>
  );
}
