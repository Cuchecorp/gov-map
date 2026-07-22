import { createServerSupabase } from "@/lib/supabase";
import { fechaCorta, relativeTimeEs } from "@/lib/format";
import { diaCalendarioCitacion } from "@/lib/dia-calendario";
import { sourceLabel } from "@/lib/types";
import type { ProyectoRow, TramitacionEventoRow } from "@/lib/types";
import { isoWeekOf, semanaIsoKey } from "@/lib/week-utils";

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
  /**
   * Gap #1 (Phase 94, CIT-05): citaciones PASADAS (fecha < hoy-Chile) del boletín,
   * orden DESC (más reciente primero), acotadas a ~5. Contexto temporal NEUTRO para
   * prensa que revisa un proyecto histórico — NUNCA fabrica vigencia. Ausente si 0.
   */
  citacionesPasadas?: { comision: string; fecha: Date }[];
  /**
   * Gap #2 (Phase 94, CIT-04): apariciones del boletín en `sesion_tabla_item`, con
   * su cámara, fecha y semana ISO (para el link a /agenda?semana=). Orden DESC.
   * Ausente si 0 (omit-when-not-derivable; NUNCA "no está en tabla" fabricado).
   */
  enTablaSala?: { camara: "camara" | "senado"; fecha: Date; semanaIso: string }[];
}

/** Fila cruda de citación aplanada desde el embed `citacion_punto × citacion`. */
export interface CitacionCruda {
  /**
   * Id de la CITACIÓN padre (WR-01). El embed `citacion_punto × citacion` emite
   * UNA fila por PUNTO, no por citación: un boletín listado en ≥2 puntos de la
   * misma citación (`posicion`) produce filas duplicadas con la MISMA citación.
   * El id permite deduplicar por identidad del padre antes de contar/mostrar.
   * Opcional (`null`/ausente ⇒ esa fila NO se deduplica) → los tests y llamadas
   * que no lo proveen siguen compilando y no colapsan filas legítimas.
   */
  id?: string | null;
  comision: string | null;
  fecha: string | null;
}

/**
 * Fila cruda de tabla de sala aplanada desde el embed
 * `sesion_tabla_item × sesion_sala`. `semana_iso` NO existe como columna en
 * `sesion_sala` (0010: solo `fecha` timestamptz) → la semana ISO se deriva de la
 * fecha en TS (Chile tz), espejando la convención de navegación de /agenda.
 */
export interface TablaSalaCruda {
  camara: "camara" | "senado" | null;
  fecha: string | null;
}

/** Fecha ISO parseable → Date válida, o null (nunca "Invalid Date"). */
function fechaValida(raw: string | null | undefined): Date | null {
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Deduplica citaciones por identidad del PADRE (`id`, WR-01). El embed
 * `citacion_punto × citacion` devuelve una fila por PUNTO: una citación cuyo
 * orden del día lista el mismo boletín en dos puntos aparece dos veces con el
 * MISMO `id`. Se conserva la PRIMERA aparición de cada `id`. Las filas sin `id`
 * (tests/legacy que no lo proveen) NO se colapsan — se dejan pasar tal cual,
 * porque sin identidad no hay forma honesta de decidir si son la misma citación.
 */
function dedupPorCitacion(citaciones: CitacionCruda[]): CitacionCruda[] {
  const vistos = new Set<string>();
  return citaciones.filter((c) => {
    if (c.id == null) return true;
    if (vistos.has(c.id)) return false;
    vistos.add(c.id);
    return true;
  });
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

/**
 * Día calendario YYYY-MM-DD en Chile del INSTANTE ACTUAL "hoy" (en-CA emite ISO;
 * DST-safe vía tzdb). OJO: esto es correcto SOLO para `hoy` (un timestamp real con
 * hora — el server corre en UTC, así que a las 21:00 CL ya está en el día UTC
 * siguiente). Las FECHAS de citación/sala NO se convierten con esto: son date-only
 * a medianoche UTC y su día es la parte fecha UTC (`diaCalendarioCitacion`, ver
 * `@/lib/dia-calendario`) — convertirlas de zona fabricaría el día anterior.
 */
const DIA_CALENDARIO_CHILE_HOY = new Intl.DateTimeFormat("en-CA", {
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
  const hoyChile = DIA_CALENDARIO_CHILE_HOY.format(hoy); // día-Chile del instante

  // WR-01: deduplicar por id de citación (mismo padre en ≥2 puntos = una citación).
  const futuras = dedupPorCitacion(citaciones)
    .map((c) => ({ c, d: fechaValida(c.fecha) }))
    .filter(
      (x): x is { c: CitacionCruda; d: Date } =>
        x.d !== null &&
        !!x.c.comision?.trim() &&
        // Día publicado de la citación (parte fecha UTC, contrato date-only) vs hoy-Chile.
        diaCalendarioCitacion(x.d)! >= hoyChile,
    )
    .sort((a, b) => a.d.getTime() - b.d.getTime());

  const prox = futuras[0];
  return prox ? { comision: prox.c.comision!.trim(), fecha: prox.d } : null;
}

/**
 * Citaciones PASADAS del boletín (gap #1, CIT-05 — omit-when-not-derivable). Espejo
 * de `citacionVigente` pero con predicado ESTRICTO `fecha < hoy-Chile` (una citación
 * de HOY sigue siendo vigente, la trae `citacionVigente`, NO se duplica aquí). Orden
 * DESC (más reciente primero), acotado a 5. Descarta las sin comisión o fecha válida.
 * Devuelve `[]` si ninguna es derivable → el campo se omite (la línea no se renderiza;
 * NUNCA "no fue citado" fabricado). La marca "(sesión pasada)" es contexto temporal
 * neutro: jamás inventa vigencia para una pasada.
 */
export function citacionesPasadas(
  citaciones: CitacionCruda[],
  hoy: Date = new Date(),
): { comision: string; fecha: Date }[] {
  const hoyChile = DIA_CALENDARIO_CHILE_HOY.format(hoy); // día-Chile del instante

  // WR-01: deduplicar por id de citación ANTES de contar/renderizar — un boletín
  // en ≥2 puntos de la misma citación NO debe producir dos líneas idénticas.
  return dedupPorCitacion(citaciones)
    .map((c) => ({ c, d: fechaValida(c.fecha) }))
    .filter(
      (x): x is { c: CitacionCruda; d: Date } =>
        x.d !== null &&
        !!x.c.comision?.trim() &&
        // Día publicado de la citación (parte fecha UTC, contrato date-only) vs hoy-Chile.
        diaCalendarioCitacion(x.d)! < hoyChile,
    )
    .sort((a, b) => b.d.getTime() - a.d.getTime()) // DESC: más reciente primero
    .slice(0, 5)
    .map((x) => ({ comision: x.c.comision!.trim(), fecha: x.d }));
}

/**
 * Semana ISO ("YYYY-Www") de una fila de tabla de sala — la clave de navegación de
 * /agenda. `sesion_sala.fecha` es date-only a medianoche UTC (contrato, ver
 * `@/lib/dia-calendario`): su día publicado es la PARTE FECHA UTC, NO una conversión
 * a tz Chile (que retrocedería un día y podría corrimiento de semana ISO). Se toma
 * ese día publicado y se calcula su semana ISO sobre él (a medianoche UTC, para que
 * `isoWeekOf` — que opera en UTC — no cruce de huso).
 */
function semanaIsoChile(fecha: Date): string {
  const diaPublicado = diaCalendarioCitacion(fecha)!; // YYYY-MM-DD (día publicado)
  const [y, m, d] = diaPublicado.split("-").map(Number);
  const { year, week } = isoWeekOf(new Date(Date.UTC(y, m - 1, d)));
  return semanaIsoKey(year, week);
}

/**
 * Apariciones del boletín en la tabla de sala (gap #2, CIT-04 —
 * omit-when-not-derivable). De las filas crudas `sesion_tabla_item × sesion_sala`,
 * mapea `{ camara, fecha, semanaIso }`, descarta las sin cámara o fecha válida, y
 * ordena DESC (más reciente primero). Devuelve `[]` si ninguna es derivable → el
 * campo se omite (línea no renderizada; NUNCA "no está en tabla" fabricado).
 */
export function enTablaSala(
  filas: TablaSalaCruda[],
): { camara: "camara" | "senado"; fecha: Date; semanaIso: string }[] {
  // WR-02: deduplicar por (cámara, día publicado) ANTES de contar/renderizar. El
  // embed `sesion_tabla_item × sesion_sala` emite una fila por ÍTEM: una sesión
  // que lista el mismo boletín en dos ítems (dos `parte_sesion`, o re-listado)
  // traería la MISMA sesión repetida, inflando "En tabla de sala N veces" y
  // duplicando el link a la misma semana. Dos DÍAS distintos de la misma cámara
  // siguen siendo dos apariciones legítimas (no se colapsan).
  const vistos = new Set<string>();
  return filas
    .map((f) => ({ f, d: fechaValida(f.fecha) }))
    .filter(
      (x): x is { f: TablaSalaCruda; d: Date } =>
        x.d !== null && (x.f.camara === "camara" || x.f.camara === "senado"),
    )
    .sort((a, b) => b.d.getTime() - a.d.getTime()) // DESC: más reciente primero
    .filter((x) => {
      // Clave de sesión = cámara + día publicado (parte fecha UTC, contrato
      // date-only). Se conserva la primera fila por (cámara, día).
      const clave = `${x.f.camara}:${diaCalendarioCitacion(x.d)}`;
      if (vistos.has(clave)) return false;
      vistos.add(clave);
      return true;
    })
    .map((x) => ({
      camara: x.f.camara as "camara" | "senado",
      fecha: x.d,
      semanaIso: semanaIsoChile(x.d),
    }));
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
  tablaSala: TablaSalaCruda[] = [],
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

  // Gap #1 (CIT-05): citaciones pasadas; si 0, el campo se omite.
  const pasadas = citacionesPasadas(citaciones, hoy);
  if (pasadas.length > 0) est.citacionesPasadas = pasadas;

  // Gap #2 (CIT-04): tabla de sala; si 0, el campo se omite.
  const sala = enTablaSala(tablaSala);
  if (sala.length > 0) est.enTablaSala = sala;

  return est;
}

/**
 * Presentación pura del bloque (RTL la testea con fixtures). Cada línea se renderiza
 * sólo si su dato existe. Superficie `--background` (NO petróleo, UI-SPEC §0.3),
 * padding `p-6` (lg). Heading factual neutro permitido ("¿Dónde está hoy?").
 */
export function EstadoActualView({ estado }: { estado: EstadoActual }) {
  const {
    etapaLinea,
    ultimoHito,
    urgenciaEstado,
    urgenciaFuente,
    citacionVigente,
    citacionesPasadas,
    enTablaSala,
  } = estado;

  // Sin ninguna línea derivable → no se renderiza el bloque (cero contenido
  // fabricado). El resto de la ficha cubre la información. Incluye los campos
  // nuevos (gap #1/#2): el bloque se pinta si hay CUALQUIER línea derivable.
  if (
    !etapaLinea &&
    !ultimoHito &&
    !urgenciaEstado &&
    !citacionVigente &&
    !citacionesPasadas &&
    !enTablaSala
  )
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
        {/*
          Gap #1 (CIT-05): citaciones PASADAS. Contexto temporal NEUTRO para prensa
          que revisa un proyecto histórico — la marca "(sesión pasada)" es sobria en
          `text-muted-foreground`, NUNCA alarma/destructive (§Color). Fecha en mono.
          El sub-bloque se omite por completo si el campo está ausente.
        */}
        {citacionesPasadas &&
          citacionesPasadas.map((c, i) => (
            <p key={`pasada-${i}`}>
              Citado el{" "}
              <span className="font-mono">{fechaCorta(c.fecha)}</span> en{" "}
              {c.comision}{" "}
              <span className="text-sm text-muted-foreground">
                (sesión pasada)
              </span>
            </p>
          ))}
        {/*
          Gap #2 (CIT-04): tabla de sala. Una aparición → línea con link petróleo
          (regla accent #2) a /agenda?semana=. Varias → conteo honesto + lista de
          cada semana. Se omite si el campo está ausente (nunca "no está en tabla").
        */}
        {enTablaSala && enTablaSala.length === 1 && (
          <p>
            En tabla de sala de la {camaraNombre(enTablaSala[0].camara)} del{" "}
            <span className="font-mono">{fechaCorta(enTablaSala[0].fecha)}</span>{" "}
            <a
              href={`/agenda?semana=${enTablaSala[0].semanaIso}`}
              className="text-accent-product underline underline-offset-2"
            >
              ver en la agenda
            </a>
          </p>
        )}
        {enTablaSala && enTablaSala.length > 1 && (
          <p>
            En tabla de sala {enTablaSala.length} veces:{" "}
            {enTablaSala.map((s, i) => (
              <span key={`sala-${i}`}>
                {i > 0 && ", "}
                <a
                  href={`/agenda?semana=${s.semanaIso}`}
                  className="text-accent-product underline underline-offset-2"
                >
                  {camaraNombre(s.camara)},{" "}
                  <span className="font-mono">{fechaCorta(s.fecha)}</span>
                </a>
              </span>
            ))}
          </p>
        )}
      </div>
    </section>
  );
}

/** Nombre legible de la cámara para el copy de la tabla de sala. */
function camaraNombre(c: "camara" | "senado"): string {
  return c === "senado" ? "Senado" : "Cámara";
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
    { data: itemsSala, error: salaError },
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
    // lo mínimo para derivar la citación vigente/futura y las pasadas (gap #1).
    sb
      .from("citacion_punto")
      // WR-01: se selecciona `id` de la citación padre para deduplicar por
      // identidad — el embed emite una fila por PUNTO, así que un boletín en ≥2
      // puntos de la misma citación traería la misma citación repetida.
      .select("citacion:citacion(id, comision, fecha, semana_iso)")
      .eq("boletin", boletin),
    // Gap #2 (CIT-04): tabla de sala del boletín vía embed
    // `sesion_tabla_item × sesion_sala` (no-PII, public-read 0010). `sesion_sala`
    // NO guarda semana_iso (0010) → solo camara + fecha; la semana se deriva en TS.
    sb
      .from("sesion_tabla_item")
      .select("sesion:sesion_sala(camara, fecha)")
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
  // #34: un fallo real de lectura de la tabla de sala ≠ "no está en tabla". Se
  // lanza (espejo de las otras 3 lecturas), NUNCA se degrada a línea vacía.
  if (salaError) {
    throw new Error(
      `EstadoActualBlock: no se pudo leer la tabla de sala de ${boletin}: ${salaError.message}`,
    );
  }

  // Proyecto ausente → sin bloque (la page ya resuelve el 404 en su FichaSection).
  if (!proyecto) return null;

  // Aplana el embed a filas `{ comision, fecha }`. Supabase tipa el embed to-one
  // como objeto | array según el shape de la relación; se normaliza a objeto.
  type PuntoEmbed = {
    citacion:
      | { id: string | null; comision: string | null; fecha: string | null }
      | { id: string | null; comision: string | null; fecha: string | null }[]
      | null;
  };
  const citaciones: CitacionCruda[] = ((puntos as PuntoEmbed[] | null) ?? [])
    .flatMap((p) => {
      const c = p.citacion;
      if (!c) return [];
      return Array.isArray(c) ? c : [c];
    })
    // WR-01: se conserva `id` para deduplicar por identidad del padre.
    .map((c) => ({ id: c.id, comision: c.comision, fecha: c.fecha }));

  // Gap #2: aplana el embed de sala a `{ camara, fecha }`. Supabase tipa el embed
  // to-one como objeto | array según el shape de la relación; se normaliza a objeto.
  type SalaEmbed = {
    sesion:
      | { camara: "camara" | "senado" | null; fecha: string | null }
      | { camara: "camara" | "senado" | null; fecha: string | null }[]
      | null;
  };
  const tablaSala: TablaSalaCruda[] = ((itemsSala as SalaEmbed[] | null) ?? [])
    .flatMap((i) => {
      const s = i.sesion;
      if (!s) return [];
      return Array.isArray(s) ? s : [s];
    })
    .map((s) => ({ camara: s.camara, fecha: s.fecha }));

  const estado = derivarEstadoActual(
    proyecto,
    (eventos as TramitacionEventoRow[]) ?? [],
    citaciones,
    new Date(),
    tablaSala,
  );
  return <EstadoActualView estado={estado} />;
}
