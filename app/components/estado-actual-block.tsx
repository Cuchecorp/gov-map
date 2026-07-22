import { createServerSupabase } from "@/lib/supabase";
import { fechaCorta, relativeTimeEs } from "@/lib/format";
import { sourceLabel } from "@/lib/types";
import type { ProyectoRow, TramitacionEventoRow } from "@/lib/types";

/**
 * EstadoActualBlock — "¿Dónde está hoy?" (SC2, UI-SPEC §SC2).
 *
 * Bloque de apertura de la ficha de proyecto: responde "¿dónde está hoy?" DERIVANDO
 * de datos ya existentes (tabla `proyecto` + `tramitacion_evento`), y OMITIENDO cada
 * línea cuando el dato no es derivable — espejo de la omisión honesta de
 * `seriePatrimonio` (excluye el punto cuando el año no parsea). NUNCA fabrica un
 * estado ni usa "—" como si fuera dato (T-51-14, repudiation).
 *
 * Es un Server Component (RSC), NUNCA "use client". Un error real de DB/red se LANZA
 * (#34) — la ausencia de dato es omisión honesta, un fallo de lectura NO es "sin
 * estado". El carril es propio: no compone con otros dominios.
 */

/** Estado derivado — cada campo OPCIONAL; ausente ⇒ la línea se omite. */
export interface EstadoActual {
  /** "Etapa: {etapa} · {estado}" (campos directos de `proyecto`). */
  etapaLinea?: string;
  /** Último `tramitacion_evento` por fecha. */
  ultimoHito?: { descripcion: string; fecha: Date };
  /** Última urgencia "hace presente" sin "retira" posterior. */
  urgenciaVigente?: { tipo: string; desde: Date };
  /**
   * Estado del token de urgencia (quick 260722-eia). SIEMPRE presente cuando hay
   * tramitación (eventos.length > 0); AUSENTE sin eventos (estado "sin datos", se
   * omite — no se fabrica). Tres estados honestos:
   *   - "vigente": hay una urgencia "hace presente" sin retiro posterior.
   *   - "sin-vigente": hay tramitación pero sin urgencia vigente (hecho negativo).
   */
  urgenciaEstado?:
    | { kind: "vigente"; tipo: string; desde: Date }
    | { kind: "sin-vigente" };
  /**
   * Fuente del token de urgencia: origen + fecha_captura más reciente de los
   * eventos. Ausente si no hay eventos con fecha_captura (no fabrica coletilla).
   */
  urgenciaFuente?: { origen: string; fechaCaptura: Date };
  /** SC3 (Phase 52): citación vigente/futura más próxima (fecha >= hoy). */
  citacionVigente?: { comision: string; fecha: Date };
}

/** Fila cruda de citación aplanada desde el embed `citacion_punto × citacion`. */
export interface CitacionCruda {
  comision: string | null;
  fecha: string | null;
}

/** Fecha ISO parseable → Date válida, o null (nunca "Invalid Date"). */
function fechaValida(raw: string | null | undefined): Date | null {
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Urgencia vigente derivada de los eventos (T-51-14). Recorre los eventos en orden
 * cronológico: un "retira ... urgencia" limpia la vigencia; un "hace presente ...
 * urgencia {tipo}" la establece con el tipo capturado. El resultado es la ÚLTIMA
 * urgencia presentada sin un retiro posterior. Si no hay ninguna derivable → null
 * (la línea se omite; NO hay campo `urgencia_actual` en la tabla `proyecto`).
 */
export function urgenciaVigente(
  eventos: TramitacionEventoRow[],
): { tipo: string; desde: Date } | null {
  const orden = [...eventos]
    .map((e) => ({ e, d: fechaValida(e.fecha) }))
    .filter((x): x is { e: TramitacionEventoRow; d: Date } => x.d !== null)
    .sort((a, b) => a.d.getTime() - b.d.getTime());

  let vigente: { tipo: string; desde: Date } | null = null;
  for (const { e, d } of orden) {
    const desc = e.descripcion ?? "";
    if (!/urgencia/i.test(desc)) continue;
    if (/retira/i.test(desc)) {
      vigente = null;
      continue;
    }
    if (/hace\s+presente/i.test(desc)) {
      const m = desc.match(/urgencia\s+([^.,;]+)/i);
      const tipo = m ? m[1].trim() : "";
      if (tipo) vigente = { tipo, desde: d };
    }
  }
  return vigente;
}

/** Día calendario YYYY-MM-DD en Chile (en-CA emite ISO; DST-safe vía tzdb). */
const DIA_CALENDARIO_CHILE = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Santiago",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/**
 * Citación vigente/futura más próxima (SC3, Phase 52 — omit-when-not-derivable).
 * Recorre las citaciones crudas del boletín, descarta las sin comisión o sin fecha
 * válida, se queda con las del día calendario de HOY o futuras (una citación de HOY
 * sigue vigente) y devuelve la de MENOR fecha (la más próxima). Si ninguna es
 * derivable → null (la línea se omite; espejo de `urgenciaVigente`). CERO fabricación.
 *
 * "HOY" es el día calendario de CHILE, no la medianoche del server (WR-04): en
 * Workers el server corre en UTC, así que desde las ~20:00 de Chile el server ya
 * está en el día UTC siguiente y una citación de HOY (convención del conector:
 * fecha impresa almacenada a medianoche UTC) expiraría horas antes — mientras la
 * sesión aún puede estar en curso. Se compara por FECHA DE CALENDARIO (string
 * YYYY-MM-DD): hoy en America/Santiago vs. el día UTC de la citación (espejo de
 * cómo se almacena) — cero aritmética en la zona del server. Es el mismo pitfall
 * de timezone que 0048 documenta para el lado SQL.
 */
export function citacionVigente(
  citaciones: CitacionCruda[],
  hoy: Date = new Date(),
): { comision: string; fecha: Date } | null {
  const hoyChile = DIA_CALENDARIO_CHILE.format(hoy); // YYYY-MM-DD

  const futuras = citaciones
    .map((c) => ({ c, d: fechaValida(c.fecha) }))
    .filter(
      (x): x is { c: CitacionCruda; d: Date } =>
        x.d !== null &&
        !!x.c.comision?.trim() &&
        x.d.toISOString().slice(0, 10) >= hoyChile,
    )
    .sort((a, b) => a.d.getTime() - b.d.getTime());

  const prox = futuras[0];
  return prox ? { comision: prox.c.comision!.trim(), fecha: prox.d } : null;
}

/**
 * Deriva las líneas del bloque, omitiendo cada una cuando el dato no es
 * derivable. PURO y exportado para test. CERO fabricación. `citaciones`/`hoy` son
 * opcionales → la firma previa (2 args) sigue compilando.
 */
export function derivarEstadoActual(
  proyecto: Pick<ProyectoRow, "etapa" | "estado">,
  eventos: TramitacionEventoRow[],
  citaciones: CitacionCruda[] = [],
  hoy: Date = new Date(),
): EstadoActual {
  const est: EstadoActual = {};

  // Etapa/estado: campos directos de la tabla. Se compone con las partes presentes;
  // si faltan AMBAS, la línea se omite (nunca "—").
  const etapa = proyecto.etapa?.trim() || null;
  const estado = proyecto.estado?.trim() || null;
  if (etapa && estado) est.etapaLinea = `Etapa: ${etapa} · ${estado}`;
  else if (etapa) est.etapaLinea = `Etapa: ${etapa}`;
  else if (estado) est.etapaLinea = `Estado: ${estado}`;

  // Último hito: el `tramitacion_evento` más reciente (por fecha válida) con
  // descripción. Sin eventos (o sin fecha/descripción) → se omite.
  const conFecha = eventos
    .map((e) => ({ e, d: fechaValida(e.fecha) }))
    .filter(
      (x): x is { e: TramitacionEventoRow; d: Date } =>
        x.d !== null && !!x.e.descripcion?.trim(),
    )
    .sort((a, b) => a.d.getTime() - b.d.getTime());
  const ultimo = conFecha[conFecha.length - 1];
  if (ultimo) {
    est.ultimoHito = { descripcion: ultimo.e.descripcion.trim(), fecha: ultimo.d };
  }

  // Urgencia vigente: derivada de presenta/retira; si no derivable, se omite.
  const urg = urgenciaVigente(eventos);
  if (urg) est.urgenciaVigente = urg;

  // Token de urgencia 3-estado (quick 260722-eia). SIEMPRE presente cuando hay
  // tramitación; ausente sin eventos (estado "sin datos", omitido — no fabrica).
  if (eventos.length > 0) {
    est.urgenciaEstado = urg
      ? { kind: "vigente", tipo: urg.tipo, desde: urg.desde }
      : { kind: "sin-vigente" };

    // Fuente del token: origen + fecha_captura MÁS RECIENTE de los eventos
    // (mismo patrón "más reciente" que TramitacionSection). Si ningún evento
    // tiene fecha_captura válida, se omite la coletilla (no fabrica).
    const fuente = eventos
      .map((e) => ({ e, d: fechaValida(e.fecha_captura) }))
      .filter((x): x is { e: TramitacionEventoRow; d: Date } => x.d !== null)
      .sort((a, b) => a.d.getTime() - b.d.getTime())
      .at(-1);
    if (fuente) {
      est.urgenciaFuente = { origen: fuente.e.origen, fechaCaptura: fuente.d };
    }
  }

  // SC3: citación vigente/futura más próxima; si no derivable, se omite.
  const cit = citacionVigente(citaciones, hoy);
  if (cit) est.citacionVigente = cit;

  return est;
}

/**
 * Presentación pura del bloque (RTL la testea con fixtures). Cada línea se renderiza
 * sólo si su dato existe. Superficie `--background` (NO petróleo, UI-SPEC §0.3),
 * padding `p-6` (lg). Heading factual neutro permitido ("¿Dónde está hoy?").
 */
export function EstadoActualView({ estado }: { estado: EstadoActual }) {
  const { etapaLinea, ultimoHito, urgenciaEstado, urgenciaFuente, citacionVigente } =
    estado;

  // Sin ninguna línea derivable → no se renderiza el bloque (cero contenido
  // fabricado). El resto de la ficha cubre la información.
  if (!etapaLinea && !ultimoHito && !urgenciaEstado && !citacionVigente)
    return null;

  return (
    <section
      id="estado-actual"
      className="mt-6 rounded-lg border bg-background p-6"
    >
      <h2 className="text-xl font-semibold mb-3">¿Dónde está hoy?</h2>
      <div className="space-y-1.5 text-base leading-relaxed">
        {etapaLinea && <p>{etapaLinea}</p>}
        {ultimoHito && (
          <p>
            Último hito: {ultimoHito.descripcion} —{" "}
            <span className="font-mono">{fechaCorta(ultimoHito.fecha)}</span>
          </p>
        )}
        {/*
          Token de urgencia SIEMPRE visible cuando hay tramitación (quick
          260722-eia): 3 estados honestos. (a) "vigente" → hecho fechado; (b)
          "sin-vigente" → hecho NEGATIVO honesto (nunca "—", nunca adjetivo). Sin
          eventos, urgenciaEstado es ausente y el token se omite. La coletilla de
          fuente ("según {fuente} al {fecha}") solo si urgenciaFuente existe.
        */}
        {urgenciaEstado && (
          <p>
            {urgenciaEstado.kind === "vigente" ? (
              <>
                Urgencia {urgenciaEstado.tipo} vigente desde el{" "}
                <span className="font-mono">
                  {fechaCorta(urgenciaEstado.desde)}
                </span>{" "}
                (
                <span className="font-mono">
                  {relativeTimeEs(urgenciaEstado.desde)}
                </span>
                ).
              </>
            ) : (
              <>Sin urgencia vigente.</>
            )}
            {urgenciaFuente && (
              <span className="text-sm text-muted-foreground">
                {" "}
                según {sourceLabel(urgenciaFuente.origen)} al{" "}
                <span className="font-mono">
                  {fechaCorta(urgenciaFuente.fechaCaptura)}
                </span>
                .
              </span>
            )}
          </p>
        )}
        {/*
          SC3 (Phase 52): línea de citación vigente/futura. Hecho de tramitación
          (compone dentro del bloque estado-actual, NUNCA con lobby/voto). Se
          omite por completo si no hay citación derivable (nunca "—").
        */}
        {citacionVigente && (
          <p>
            Citado en {citacionVigente.comision} el{" "}
            <span className="font-mono">
              {fechaCorta(citacionVigente.fecha)}
            </span>
            .
          </p>
        )}
      </div>
    </section>
  );
}

/**
 * Server Component: lee `proyecto` (etapa/estado) + `tramitacion_evento`, deriva el
 * estado honesto y lo renderiza. Un error real de DB/red se LANZA (#34); la ausencia
 * de filas es omisión honesta (bloque vacío → null), NUNCA un estado fabricado.
 */
export async function EstadoActualBlock({ boletin }: { boletin: string }) {
  const sb = createServerSupabase();

  const [
    { data: proyecto, error: proyectoError },
    { data: eventos, error: eventosError },
    { data: puntos, error: citacionError },
  ] = await Promise.all([
    sb
      .from("proyecto")
      .select("etapa, estado")
      .eq("boletin", boletin)
      .maybeSingle<Pick<ProyectoRow, "etapa" | "estado">>(),
    sb
      .from("tramitacion_evento")
      .select("*")
      .eq("boletin", boletin)
      .order("fecha", { ascending: true }),
    // SC3: citaciones del boletín vía embed `citacion_punto × citacion` (tablas
    // no-PID/no-PII, public-read 0010; guard-permitidas). Sólo comisión + fecha:
    // lo mínimo para derivar la citación vigente/futura más próxima.
    sb
      .from("citacion_punto")
      .select("citacion:citacion(comision, fecha, semana_iso)")
      .eq("boletin", boletin),
  ]);

  // #34: un fallo real de DB/red ≠ "sin estado". Se lanza para la UI de error
  // honesta en vez de fabricar un bloque vacío (que se leería como "sin datos").
  if (proyectoError) {
    throw new Error(
      `EstadoActualBlock: no se pudo leer el proyecto ${boletin}: ${proyectoError.message}`,
    );
  }
  if (eventosError) {
    throw new Error(
      `EstadoActualBlock: no se pudo leer la tramitación de ${boletin}: ${eventosError.message}`,
    );
  }
  if (citacionError) {
    throw new Error(
      `EstadoActualBlock: no se pudo leer la citación de ${boletin}: ${citacionError.message}`,
    );
  }

  // Proyecto ausente → sin bloque (la page ya resuelve el 404 en su FichaSection).
  if (!proyecto) return null;

  // Aplana el embed a filas `{ comision, fecha }`. Supabase tipa el embed to-one
  // como objeto | array según el shape de la relación; se normaliza a objeto.
  type PuntoEmbed = {
    citacion:
      | { comision: string | null; fecha: string | null }
      | { comision: string | null; fecha: string | null }[]
      | null;
  };
  const citaciones: CitacionCruda[] = ((puntos as PuntoEmbed[] | null) ?? [])
    .flatMap((p) => {
      const c = p.citacion;
      if (!c) return [];
      return Array.isArray(c) ? c : [c];
    })
    .map((c) => ({ comision: c.comision, fecha: c.fecha }));

  const estado = derivarEstadoActual(
    proyecto,
    (eventos as TramitacionEventoRow[]) ?? [],
    citaciones,
  );
  return <EstadoActualView estado={estado} />;
}
