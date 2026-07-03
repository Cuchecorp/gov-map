import { createServerSupabase } from "@/lib/supabase";
import { fechaCorta, relativeTimeEs } from "@/lib/format";
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

/**
 * Deriva las (hasta) 3 líneas del bloque, omitiendo cada una cuando el dato no es
 * derivable. PURO y exportado para test. CERO fabricación.
 */
export function derivarEstadoActual(
  proyecto: Pick<ProyectoRow, "etapa" | "estado">,
  eventos: TramitacionEventoRow[],
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

  return est;
}

/**
 * Presentación pura del bloque (RTL la testea con fixtures). Cada línea se renderiza
 * sólo si su dato existe. Superficie `--background` (NO petróleo, UI-SPEC §0.3),
 * padding `p-6` (lg). Heading factual neutro permitido ("¿Dónde está hoy?").
 */
export function EstadoActualView({ estado }: { estado: EstadoActual }) {
  const { etapaLinea, ultimoHito, urgenciaVigente } = estado;

  // Sin ninguna línea derivable → no se renderiza el bloque (cero contenido
  // fabricado). El resto de la ficha cubre la información.
  if (!etapaLinea && !ultimoHito && !urgenciaVigente) return null;

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
        {urgenciaVigente && (
          <p>
            Urgencia {urgenciaVigente.tipo} vigente desde el{" "}
            <span className="font-mono">
              {fechaCorta(urgenciaVigente.desde)}
            </span>{" "}
            (
            <span className="font-mono">
              {relativeTimeEs(urgenciaVigente.desde)}
            </span>
            ).
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

  const [{ data: proyecto, error: proyectoError }, { data: eventos, error: eventosError }] =
    await Promise.all([
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

  // Proyecto ausente → sin bloque (la page ya resuelve el 404 en su FichaSection).
  if (!proyecto) return null;

  const estado = derivarEstadoActual(
    proyecto,
    (eventos as TramitacionEventoRow[]) ?? [],
  );
  return <EstadoActualView estado={estado} />;
}
