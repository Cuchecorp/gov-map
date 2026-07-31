import { cache } from "react";

import { createServerSupabase } from "@/lib/supabase";
import { PARLAMENTARIO_ID_RE } from "@/lib/buscar";
import { formatNombre } from "@/lib/format";
import { fechaCivilCorta } from "@/lib/dia-calendario";
import { vsimPublicEnabled } from "@/lib/vsim-gate";
import { CompararSelector } from "@/components/comparar-selector";
import { SimilitudVotacionComparar } from "@/components/similitud-votacion-comparar";
import {
  RelacionesEjeComparar,
  type EjeColumna,
} from "@/components/relaciones-eje-comparar";
import type {
  ComisionRow,
  CrossLinkRow,
  ParlamentarioListadoRow,
} from "@/lib/types";

/**
 * /comparar?a=&b= — comparación 1-a-1 de dos parlamentarios (REL-03,
 * 101-UI-SPEC §"/comparar route"). Server Component: lee los 4 ejes FACTUALES no-voto
 * (militancia histórica / comisiones / co-autoría / zona) desde RPCs PII-safe y
 * computa la INTERSECCIÓN SERVER-SIDE, cada dato con fuente + fecha, orden alfabético,
 * CERO ranking/score, vacío honesto declarado, error ≠ vacío (#34).
 *
 * GOTCHA PHASE 45 (LOCKED, load-bearing): `export const dynamic = "force-dynamic"` +
 * leer `searchParams` (Promise, Next 16) ANTES de cualquier `notFound()`. NO hay
 * notFound() en esta ruta: sin params → selectores vacíos (empty state honesto), NUNCA
 * 404/500. Un `notFound()` antes de searchParams hornearía la ruta estática → 500 con
 * contenido dinámico (memoria v6.1/v8.0).
 *
 * URL CANÓNICA: `const [a, b] = [sp.a, sp.b].filter(Boolean).sort()` — orden alfabético
 * de ids → la URL es estable sin importar en qué slot eligió el usuario. Cada id se
 * valida contra PARLAMENTARIO_ID_RE ANTES de cualquier `.rpc()` (V5 / T-101-07): un id
 * inválido se trata como NO-seleccionado (selector vacío), jamás 500 ni interpolación.
 *
 * REGLA RECTORA (§Copywriting / anti-ranking T-52-13): que dos parlamentarios
 * "comparten X" es un HECHO DECLARADO por una fuente oficial — JAMÁS un juicio de
 * bancada, afinidad ni coalición. La comparación muestra hechos con fuente y fecha; no
 * ordena ni puntúa. Petróleo SOLO en la figura de conteo de intersección y en links.
 */

export const dynamic = "force-dynamic";

/**
 * WR-01 (101-REVIEW): fecha de CONSULTA calculada POR REQUEST (la ruta es
 * force-dynamic) — día calendario chileno (tz America/Santiago), YYYY-MM-DD.
 * "En las fuentes consultadas al {fecha}" declara CUÁNDO se consultó la base,
 * jamás una fecha de captura fabricada en build-time (el hardcode "2026-07-24"
 * mentía desde el día siguiente). La fecha de la FUENTE (`fecha_captura`) se usa
 * por fila cuando la RPC la emite (comisiones → "según fuente al"); los ejes cuyas
 * filas no la traen declaran "consultado al" (honesto: es la consulta, no la fuente).
 *
 * C-03 (129-04): el FORMATO de salida es el civil chileno del resto de la app
 * ("30 jul 2026"), no el ISO `YYYY-MM-DD` que producía `en-CA`. El DÍA sigue
 * calculándose igual — `en-CA` + tz America/Santiago sobre `new Date()`, que es un
 * instante REAL con hora y por tanto SÍ debe convertirse de zona — y solo después
 * se re-formatea con `fechaCivilCorta`, que es date-only y no vuelve a convertir
 * (gotcha rector: date-only disfrazado de timestamptz). Cambia la presentación,
 * jamás el hecho.
 */
function fechaConsultaHoy(): string {
  const diaChileno = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Santiago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  return fechaCivilCorta(diaChileno) ?? diaChileno;
}

// Copy LOCKED (101-UI-SPEC §Copywriting → Copy table).
const HEADING = "Comparar dos parlamentarios";
const EMPTY_HEADING = "Elige dos parlamentarios para compararlos.";
const EMPTY_BODY =
  "Selecciona un parlamentario en cada columna. La comparación muestra solo hechos con fuente y fecha; no ordena ni puntúa.";

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

// ── Lectores server-only cacheados (React.cache dedup por (rpc, id)) ─────────────
// Cada lector LANZA ante un error real de DB/red (#34) — un vacío honesto es `[]` SIN
// error, jamás una degradación a "sin relaciones". Cuando A y B leen la misma RPC, el
// React.cache deduplica la llamada por id.

/** Directorio público (parlamentarios_publico_v2) — roster para selectores + zona. */
const getRoster = cache(async (): Promise<ParlamentarioListadoRow[]> => {
  const sb = createServerSupabase();
  const { data, error } = await sb.rpc("parlamentarios_publico_v2");
  if (error) {
    throw new Error(`parlamentarios_publico_v2 falló: ${error.message}`);
  }
  return (data as ParlamentarioListadoRow[] | null) ?? [];
});

/** Militancia histórica compartida (0067, secdef alias-keyed net-new). */
const getMilitanciaHistorica = cache(
  async (id: string): Promise<CrossLinkRow[]> => {
    const sb = createServerSupabase();
    const { data, error } = await sb.rpc("militancia_historica_compartida", {
      p_id: id,
    });
    if (error) {
      throw new Error(
        `militancia_historica_compartida falló para ${id}: ${error.message}`,
      );
    }
    return (data ?? []) as CrossLinkRow[];
  },
);

/** Comisiones del parlamentario (0060). Intersección por identidad COMPUESTA
 *  camara+nombre (CR-02): las cámaras tienen comisiones permanentes homónimas. */
const getComisiones = cache(async (id: string): Promise<ComisionRow[]> => {
  const sb = createServerSupabase();
  const { data, error } = await sb.rpc("comisiones_de_parlamentario", {
    p_id: id,
  });
  if (error) {
    throw new Error(`comisiones_de_parlamentario falló para ${id}: ${error.message}`);
  }
  return (data ?? []) as ComisionRow[];
});

/** Co-autores (0083, firma v2 paralela a 0064/0060). El par se decide vía
 *  `interseccionPar` (CR-01: se leen AMBAS direcciones y la ausencia solo se
 *  declara con una lista completa). Canal migrado de `coautores_de_parlamentario`
 *  (limit 20, aún consumida por /parlamentario/[id]) a `_v2` (limit 1000) para que
 *  la membresía de par no trunque en silencio (DEBT-04). */
const getCoautores = cache(async (id: string): Promise<CrossLinkRow[]> => {
  const sb = createServerSupabase();
  const { data, error } = await sb.rpc("coautores_de_parlamentario_v2", {
    p_id: id,
  });
  if (error) {
    throw new Error(`coautores_de_parlamentario_v2 falló para ${id}: ${error.message}`);
  }
  return (data ?? []) as CrossLinkRow[];
});

// ── Helpers de render ────────────────────────────────────────────────────────────

/** Lista alfabética de strings (o texto de ausencia honesta si vacía). */
function listaOAusencia(items: string[], ejeAusente: string): React.ReactNode {
  if (items.length === 0) {
    return <span>{ejeAusente}</span>;
  }
  return (
    <ul className="space-y-1">
      {items.map((it) => (
        <li key={it}>{it}</li>
      ))}
    </ul>
  );
}

/** Figura de intersección compartida (petróleo NEUTRAL de conteo). */
function InterseccionCompartida({
  n,
  sustantivo,
  lista,
}: {
  n: number;
  sustantivo: string;
  lista: string[];
}) {
  return (
    <p>
      <span className="font-semibold text-accent-product">Comparten {n}</span>{" "}
      {sustantivo}: {lista.join(", ")}.
    </p>
  );
}

/** Ausencia declarada de intersección (fuente + fecha), nunca "sin relación". */
function InterseccionAusente({ frase }: { frase: string }) {
  return <p className="text-muted-foreground">{frase}</p>;
}

/** Limitación declarada (CR-01): el par NO es determinable desde listas truncadas —
 *  se declara el límite del canal de datos, JAMÁS se afirma una ausencia. */
function InterseccionIndeterminada({ frase }: { frase: string }) {
  return <p className="text-muted-foreground">{frase}</p>;
}

export default async function CompararPage({ searchParams }: PageProps) {
  // GOTCHA 45: searchParams (Promise) se lee PRIMERO; NUNCA notFound() antes.
  const sp = await searchParams;

  // Orden canónico alfabético de ids → URL estable. filter(Boolean) descarta slots
  // vacíos; sort() normaliza el orden A/B.
  const seleccion = [sp.a, sp.b]
    .filter((v): v is string => typeof v === "string" && v.length > 0)
    .sort();

  // Validar cada id contra PARLAMENTARIO_ID_RE ANTES de cualquier .rpc() (V5). Un id
  // inválido se descarta (se trata como no-seleccionado), jamás 500.
  const validos = seleccion.filter((id) => PARLAMENTARIO_ID_RE.test(id));
  const [a, b] = validos;

  // Roster para los selectores (y para el eje zona). Un error real LANZA (#34).
  const roster = await getRoster();

  const ambos = Boolean(a && b && a !== b);

  return (
    <main className="max-w-[1120px] mx-auto px-4 md:px-8 py-8 md:py-16">
      <h1 className="text-3xl font-semibold leading-tight">{HEADING}</h1>

      <CompararSelector roster={roster} a={a} b={b} />

      {!ambos ? (
        <section className="mt-12">
          <h2 className="text-xl font-semibold">{EMPTY_HEADING}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{EMPTY_BODY}</p>
        </section>
      ) : (
        <CompararEjes a={a} b={b} roster={roster} />
      )}
    </main>
  );
}

// ── Los 4 ejes factuales con intersección server-side ────────────────────────────
// Exportado para RTL (un named export arbitrario lo ignora el router de Next, espejo
// de CarrilesSection en la ficha): permite al test resolver el server child async y
// asertar el HTML real de los ejes + que un error de RPC LANZA (#34).
export async function CompararEjes({
  a,
  b,
  roster,
}: {
  a: string;
  b: string;
  roster: ParlamentarioListadoRow[];
}) {
  // Filas del roster (nombre + zona) para A y B. Un id ausente del roster (no debería
  // pasar tras la validación) degrada honesto: nombre = id crudo, zona null.
  const filaA = roster.find((r) => r.id === a);
  const filaB = roster.find((r) => r.id === b);
  const nombreA = filaA ? formatNombre(filaA.nombre) : a;
  const nombreB = filaB ? formatNombre(filaB.nombre) : b;

  // WR-01: fecha de consulta por request (force-dynamic) — jamás horneada en build.
  const fechaConsulta = fechaConsultaHoy();

  // Lecturas server-side en paralelo (cada una LANZA ante error real, #34).
  // CR-01: los ejes de PAR (militancia / co-autoría) se leen en AMBAS direcciones
  // (A y B): el canal de datos de las RPCs viene cap-eado (militancia: 20; co-autoría:
  // 1000 vía la v2 de 0083 — IN-03, ver el bloque de constantes de CAP_RPC/
  // CAP_RPC_COAUTORES más abajo, que es la sede de estos números) y decidir el
  // par por membresía en UNA lista truncada produciría ausencias FALSAS con
  // atribución de fuente. React.cache deduplica por (rpc, id).
  const [milA, milB, comA, comB, coautA, coautB] = await Promise.all([
    getMilitanciaHistorica(a),
    getMilitanciaHistorica(b),
    getComisiones(a),
    getComisiones(b),
    getCoautores(a),
    getCoautores(b),
  ]);

  // ── EJE 1 — Militancia (histórica) ────────────────────────────────────────────
  // Intersección de PAR (CR-01): presencia por membresía en cualquiera de las dos
  // direcciones (net-new por partido_alias, sin compartir el alias vigente); la
  // ausencia SOLO se declara con al menos una lista completa; con ambas listas
  // truncadas el par es INDETERMINADO y se declara la limitación.
  // WR-02 (101-REVIEW): la RPC 0067 es NET-NEW-ONLY — EXCLUYE los pares que
  // comparten el alias vigente aunque ADEMÁS compartan un partido histórico. Por
  // eso el copy de ausencia se AUTO-ACOTA a la semántica real ("fuera del partido
  // vigente"): dos copartidarios vigentes con historia compartida NO deben leer
  // "no comparten militancia histórica" (falso producido por la exclusión net-new,
  // no por las fuentes).
  const milPar = interseccionPar(milA, b, milB, a);
  const totalMilA = totalHonesto(milA);
  const totalMilB = totalHonesto(milB);
  const interseccionMilitancia =
    milPar.estado === "presente" ? (
      // WR-03 (101-REVIEW): la RPC matchea por partido_alias SIN predicado de
      // solape temporal — "Compartieron militancia" implicaría que estuvieron
      // JUNTOS en el partido, hecho que ninguna fuente declara. El copy afirma
      // exactamente lo que el dato soporta: ambos militaron en el mismo partido,
      // en períodos posiblemente distintos.
      <p>
        <span className="font-semibold text-accent-product">
          Militaron en un mismo partido
        </span>{" "}
        (en períodos posiblemente distintos; sin compartir el partido vigente).
      </p>
    ) : milPar.estado === "ausente" ? (
      <InterseccionAusente
        frase={`En las fuentes consultadas al ${fechaConsulta}, no registran militancia histórica compartida fuera del partido vigente.`}
      />
    ) : (
      <InterseccionIndeterminada
        frase={`Las listas consultadas al ${fechaConsulta} están truncadas (más de ${CAP_RPC} registros por parlamentario) y no permiten determinar la militancia histórica compartida fuera del partido vigente. Ver el detalle en cada ficha.`}
      />
    );
  const ejeMilitancia = (
    <RelacionesEjeComparar
      key="militancia"
      heading="Militancia (histórica)"
      a={ejeColMilitancia(nombreA, totalMilA)}
      b={ejeColMilitancia(nombreB, totalMilB)}
      interseccion={interseccionMilitancia}
      provenance={`Fuente: BCN · consultado al ${fechaConsulta}`}
    />
  );

  // ── EJE 2 — Comisiones ────────────────────────────────────────────────────────
  // CR-02: la intersección va por IDENTIDAD COMPUESTA camara+nombre, NUNCA por el
  // string del nombre solo — ambas cámaras tienen comisiones permanentes homónimas
  // (Hacienda, Constitución, Salud…): un diputado y un senador en "su" Hacienda NO
  // comparten comisión (dos órganos distintos). Misma disciplina que zonaDe (el
  // prefijo Circunscripción/Distrito impide el match cruzado). En la lista
  // compartida se muestra el nombre plano (camara idéntica por construcción).
  const keyComision = (c: ComisionRow) => `${c.camara}::${c.nombre}`;
  // WR-02 (102-REVIEW): `comisiones_de_parlamentario` (0060, bounded en 0064) capea a
  // CAP_RPC_COMISIONES filas SIN emitir `total_n`. Disciplina CR-01 aplicada al eje:
  // la ausencia de intersección solo es declarable con AMBAS listas completas — a
  // diferencia de los ejes de PAR (donde una dirección completa basta), aquí una
  // comisión compartida puede caer fuera del cap de CUALQUIERA de las dos listas.
  // Sin `total_n`, la única señal de completitud es length < cap (length === cap se
  // trata como posiblemente truncada: fail-closed hacia "indeterminado", jamás hacia
  // una ausencia falsa con atribución de fuente — el riesgo #1 del proyecto).
  const comisionesCompletas =
    comA.length < CAP_RPC_COMISIONES && comB.length < CAP_RPC_COMISIONES;
  // WR-01: la provenance del eje usa la fecha de la FUENTE por fila (máxima
  // `fecha_captura` entre las filas de A y B) cuando existe; sin filas, se declara
  // la fecha de consulta ("consultado al"), jamás una fecha de fuente fabricada.
  const fechaFuenteComisiones = [...comA, ...comB]
    .map((c) => (c.fecha_captura ?? "").slice(0, 10))
    .filter((f) => /^\d{4}-\d{2}-\d{2}$/.test(f))
    .sort()
    .at(-1);
  // C-03: el DÍA es el mismo que ya se elegía (máxima `fecha_captura` de las filas,
  // seleccionada sobre el ISO para que el `.sort()` lexicográfico siga siendo el
  // orden cronológico correcto); solo el FORMATO pasa al civil chileno.
  const provenanceComisiones = fechaFuenteComisiones
    ? `Fuente: Cámara/Senado · según fuente al ${fechaCivilCorta(fechaFuenteComisiones) ?? fechaFuenteComisiones}`
    : `Fuente: Cámara/Senado · consultado al ${fechaConsulta}`;
  const nombresComA = comA.map((c) => c.nombre);
  const nombresComB = comB.map((c) => c.nombre);
  const clavesComB = new Set(comB.map(keyComision));
  const comCompartidas = [
    ...new Set(
      comA.filter((c) => clavesComB.has(keyComision(c))).map((c) => c.nombre),
    ),
  ].sort((x, y) => x.localeCompare(y, "es"));
  const ejeComisiones = (
    <RelacionesEjeComparar
      key="comisiones"
      heading="Comisiones"
      a={{
        nombre: nombreA,
        contenido: (
          <>
            {listaOAusencia(
              [...nombresComA].sort((x, y) => x.localeCompare(y, "es")),
              `Sin registros de comisiones para ${nombreA} en las fuentes consultadas al ${fechaConsulta}.`,
            )}
            {comA.length >= CAP_RPC_COMISIONES && (
              <p className="text-muted-foreground">
                Lista posiblemente truncada: el canal entrega a lo más{" "}
                {CAP_RPC_COMISIONES} registros. Ver el detalle en la ficha.
              </p>
            )}
          </>
        ),
      }}
      b={{
        nombre: nombreB,
        contenido: (
          <>
            {listaOAusencia(
              [...nombresComB].sort((x, y) => x.localeCompare(y, "es")),
              `Sin registros de comisiones para ${nombreB} en las fuentes consultadas al ${fechaConsulta}.`,
            )}
            {comB.length >= CAP_RPC_COMISIONES && (
              <p className="text-muted-foreground">
                Lista posiblemente truncada: el canal entrega a lo más{" "}
                {CAP_RPC_COMISIONES} registros. Ver el detalle en la ficha.
              </p>
            )}
          </>
        ),
      }}
      interseccion={
        comCompartidas.length > 0 ? (
          <InterseccionCompartida
            n={comCompartidas.length}
            sustantivo={comCompartidas.length === 1 ? "comisión" : "comisiones"}
            lista={comCompartidas}
          />
        ) : comisionesCompletas ? (
          <InterseccionAusente
            frase={`En las fuentes consultadas al ${fechaConsulta}, no comparten comisiones.`}
          />
        ) : (
          <InterseccionIndeterminada
            frase={`Las listas consultadas al ${fechaConsulta} pueden estar truncadas (el canal entrega a lo más ${CAP_RPC_COMISIONES} registros por parlamentario) y no permiten determinar si comparten comisiones. Ver el detalle en cada ficha.`}
          />
        )
      }
      provenance={provenanceComisiones}
    />
  );

  // ── EJE 3 — Co-autoría de proyectos ───────────────────────────────────────────
  // DECISIÓN (count-only, ver SUMMARY): la RPC coautores_de_parlamentario devuelve
  // filas con `n_proyectos` (conteo honesto de boletines co-firmados) pero NO la
  // lista de boletines. Mostramos el count con provenance; NO fabricamos un enlace
  // a la lista (no se expande el alcance con una RPC boletines_compartidos en esta
  // pasada). CR-01: el par se decide vía `interseccionPar` (dos direcciones +
  // completitud); las columnas muestran el `total_n` honesto, jamás el .length
  // cap-eado. `n_proyectos` es simétrico (mismo valor en ambas direcciones).
  const coautPar = interseccionPar(coautA, b, coautB, a, CAP_RPC_COAUTORES);
  const nCoproyectos =
    coautPar.estado === "presente" ? (coautPar.fila.n_proyectos ?? 0) : 0;
  const totalCoautA = totalHonesto(coautA);
  const totalCoautB = totalHonesto(coautB);
  const interseccionCoautoria =
    coautPar.estado === "presente" ? (
      nCoproyectos > 0 ? (
        <p>
          <span className="font-semibold text-accent-product">
            Comparten {nCoproyectos}
          </span>{" "}
          {nCoproyectos === 1
            ? "proyecto co-firmado"
            : "proyectos co-firmados"}
          .
        </p>
      ) : (
        <p>
          <span className="font-semibold text-accent-product">
            Han co-firmado proyectos
          </span>{" "}
          (la fuente no informa el conteo).
        </p>
      )
    ) : coautPar.estado === "ausente" ? (
      <InterseccionAusente
        frase={`En las fuentes consultadas al ${fechaConsulta}, no comparten proyectos co-firmados.`}
      />
    ) : (
      <InterseccionIndeterminada
        frase={`Las listas consultadas al ${fechaConsulta} están truncadas (más de ${CAP_RPC_COAUTORES} registros por parlamentario) y no permiten determinar si comparten proyectos co-firmados. Ver el detalle en cada ficha.`}
      />
    );
  const ejeCoautoria = (
    <RelacionesEjeComparar
      key="coautoria"
      heading="Co-autoría de proyectos"
      a={ejeColCoautoria(nombreA, totalCoautA, fechaConsulta)}
      b={ejeColCoautoria(nombreB, totalCoautB, fechaConsulta)}
      interseccion={interseccionCoautoria}
      provenance={`Fuente: Cámara/Senado · consultado al ${fechaConsulta}`}
    />
  );

  // ── EJE 4 — Zona electoral ────────────────────────────────────────────────────
  // Comparar circunscripción/distrito del roster. Dos diputados → distrito/circ NULL
  // (audit 101-01: Cámara sin zona) → "no comparten zona" (ausencia declarada, jamás
  // implícita). NULL nunca hace match.
  const zonaA = zonaDe(filaA);
  const zonaB = zonaDe(filaB);
  const compartenZona =
    zonaA != null && zonaB != null && zonaA === zonaB;
  const ejeZona = (
    <RelacionesEjeComparar
      key="zona"
      heading="Zona electoral"
      a={{
        nombre: nombreA,
        contenido: (
          <span>
            {zonaA ??
              `Sin zona electoral registrada para ${nombreA} en las fuentes consultadas al ${fechaConsulta}.`}
          </span>
        ),
      }}
      b={{
        nombre: nombreB,
        contenido: (
          <span>
            {zonaB ??
              `Sin zona electoral registrada para ${nombreB} en las fuentes consultadas al ${fechaConsulta}.`}
          </span>
        ),
      }}
      interseccion={
        compartenZona ? (
          <p>
            <span className="font-semibold text-accent-product">
              Comparten zona electoral
            </span>
            : {zonaA}.
          </p>
        ) : (
          <InterseccionAusente
            frase={`En las fuentes consultadas al ${fechaConsulta}, no comparten zona.`}
          />
        )
      }
      provenance={`Fuente: Cámara/Senado · consultado al ${fechaConsulta}`}
    />
  );

  // ── EJE 5 — Similitud de votación (VSIM, GATED legal, anti-DW-NOMINATE) ────────
  // Candado B (presentación): la sección SOLO existe con `vsimPublicEnabled(process.env)`
  // ON. Con el flag OFF (PROD default) `ejeSimilitud` queda null → cero nodo DOM, cero
  // .rpc("coincidencia_votos_par") (el return null es ANTES del fetch, no CSS hidden).
  // El flip a true es acto humano con sign-off legal (docs/legal/102-LEGAL-DOSSIER-VSIM),
  // JAMÁS del agente. `vsimPublicEnabled` es el ÚNICO lector del flag (anti-flip V3):
  // nunca leer el env crudo del flag aquí — el chokepoint vsim-gate.ts es el único lector.
  let ejeSimilitud: React.ReactNode = null;
  if (vsimPublicEnabled(process.env)) {
    // Ids ya validados (PARLAMENTARIO_ID_RE) y en orden canónico [a,b].sort().
    const sb = createServerSupabase();
    const { data, error } = await sb.rpc("coincidencia_votos_par", {
      p_a: a,
      p_b: b,
    });
    // #34: un error real de la RPC LANZA — NUNCA se degrada a "sin votaciones
    // compartidas" (eso es el estado honesto M=0, no un error).
    if (error) {
      throw new Error(`coincidencia_votos_par falló para ${a}/${b}: ${error.message}`);
    }
    const fila = (data as CoincidenciaVotosPar[] | null)?.[0];
    const n = Number(fila?.n_coinciden ?? 0);
    const m = Number(fila?.m_compartidas ?? 0);
    // El % se computa en el SERVER (round entero, sin decimales); null cuando M=0.
    const pct = m > 0 ? Math.round((n / m) * 100) : null;
    // Asimetría de cobertura: A y B de cámaras distintas (nota de cobertura).
    const camaraMixta =
      filaA?.camara != null &&
      filaB?.camara != null &&
      filaA.camara !== filaB.camara;
    // C-03: mismo DÍA que antes (la parte fecha del `fecha_captura_max` que ya
    // se venía mostrando), re-formateado al civil chileno. Cero cambio de hecho.
    const fechaCaptura = fila?.fecha_captura_max
      ? fechaCivilCorta(String(fila.fecha_captura_max).slice(0, 10))
      : null;
    ejeSimilitud = (
      <SimilitudVotacionComparar
        n={n}
        m={m}
        pct={pct}
        fechaConsulta={fechaConsulta}
        fechaCaptura={fechaCaptura}
        camaraMixta={camaraMixta}
      />
    );
  }

  return (
    <>
      {ejeMilitancia}
      {ejeComisiones}
      {ejeCoautoria}
      {ejeZona}
      {ejeSimilitud}
    </>
  );
}

/** Forma de la fila que emite la RPC `coincidencia_votos_par` (0068): SOLO 3
 *  agregados del par (n_coinciden / m_compartidas / fecha_captura_max), jamás la
 *  lista de votaciones individuales. */
interface CoincidenciaVotosPar {
  n_coinciden: number | string | null;
  m_compartidas: number | string | null;
  fecha_captura_max: string | null;
}

// ── Utilidades ────────────────────────────────────────────────────────────────────

// ── CR-01: intersección de PAR sobre listas cap-eadas ─────────────────────────────
// Las RPCs cross-link de PAR (0061/0067, bounded en 0064) devuelven a lo más CAP_RPC
// filas (`limit 20`, orden alfabético por nombre) + `total_n` (conteo completo ANTES
// del cap, molde WR-01 de la ficha). El eje de co-autoría (0083, firma v2 paralela a
// 0064/0060) migró a un canal SEPARADO con `limit 1000` = CAP_RPC_COAUTORES (DEBT-04:
// el cap de 20 truncaba en silencio al 85% de los pares — ver comentario junto a la
// constante). `comisiones_de_parlamentario` (0060, bounded en 0064) tiene OTRO cap
// (`limit 50` = CAP_RPC_COMISIONES) y NO emite `total_n` — su disciplina de
// completitud vive junto al eje de comisiones (WR-02). Decidir el par por membresía
// en una lista truncada produce ausencias FALSAS con atribución de fuente — el riesgo
// #1 del proyecto. Reglas:
//   * PRESENTE: B está en lista(A) o A está en lista(B) — un match es un hecho.
//   * AUSENTE: solo si al menos una de las dos listas está COMPLETA (con una lista
//     completa, la no-membresía SÍ es un hecho).
//   * INDETERMINADO: sin match y ambas listas truncadas → se declara la limitación,
//     JAMÁS se afirma ausencia.
//   * Conteos: SIEMPRE `total_n` (totalHonesto), jamás el .length cap-eado.
//
// TRES caps distintos, deliberadamente NO unificados:
//   CAP_RPC (20)            — eje de militancia histórica (RPC 0067, sigue en 20;
//                              NO se toca en esta fase — subirlo produciría ausencia
//                              FALSA con atribución de fuente, riesgo #1 del proyecto).
//   CAP_RPC_COAUTORES (1000) — eje de co-autoría (RPC v2 0083; DEBT-04, esta fase).
//   CAP_RPC_COMISIONES (50)  — eje de comisiones (RPC 0060/0064, sin total_n).

/** Cap del canal de datos de la RPC cross-link de PAR de militancia histórica
 *  (`limit 20` en 0067, re-emitida bounded en 0064). NO SE TOCA: es COMPARTIDO
 *  solo por el eje de militancia — subirlo contaminaría ese eje con ausencias
 *  falsas (ver control apareado anti-Pitfall-1 en page.test.tsx). */
const CAP_RPC = 20;

/** Cap del canal de co-autoría (`limit 1000` en `coautores_de_parlamentario_v2`,
 *  0083) — techo derivado de medición (máximo real 101 sobre el dominio completo
 *  de 180 parlamentarios ⇒ margen 9.9x). Separado de CAP_RPC a propósito: NO se
 *  reutiliza CAP_RPC porque eso rompería la disciplina del eje de militancia
 *  (que sigue leyendo con `limit 20` de la RPC 0067, intacta en esta fase). */
const CAP_RPC_COAUTORES = 1000;

/** Cap del canal de comisiones (`limit 50` en `comisiones_de_parlamentario`,
 *  0060 bounded en 0064) — SIN `total_n`: la completitud solo es afirmable con
 *  length < cap (WR-02). */
const CAP_RPC_COMISIONES = 50;

/** true si la lista NO está truncada (largo bajo el cap, o `total_n` ≤ largo).
 *  `cap` por defecto es CAP_RPC (eje de militancia); el eje de co-autoría pasa
 *  CAP_RPC_COAUTORES explícitamente. */
function listaCompleta(filas: CrossLinkRow[], cap: number = CAP_RPC): boolean {
  if (filas.length < cap) return true;
  const total = filas[0]?.total_n;
  return typeof total === "number" && total <= filas.length;
}

/** Total REAL del eje (`total_n` antes del cap). Fallback defensivo a filas.length
 *  si la RPC no emitiera la columna (espejo de totalReal en la ficha). */
function totalHonesto(filas: CrossLinkRow[]): number {
  const n = filas[0]?.total_n;
  return typeof n === "number" ? n : filas.length;
}

type InterseccionPar =
  | { estado: "presente"; fila: CrossLinkRow }
  | { estado: "ausente" }
  | { estado: "indeterminado" };

/** Decide la intersección del par (A,B) desde las DOS direcciones cap-eadas.
 *  `cap` por defecto es CAP_RPC (eje de militancia, byte-equivalente en
 *  comportamiento a antes de esta fase); el eje de co-autoría pasa
 *  CAP_RPC_COAUTORES explícitamente. */
function interseccionPar(
  listaA: CrossLinkRow[],
  idB: string,
  listaB: CrossLinkRow[],
  idA: string,
  cap: number = CAP_RPC,
): InterseccionPar {
  const fila =
    listaA.find((r) => r.id === idB) ?? listaB.find((r) => r.id === idA);
  if (fila) return { estado: "presente", fila };
  if (listaCompleta(listaA, cap) || listaCompleta(listaB, cap)) {
    return { estado: "ausente" };
  }
  return { estado: "indeterminado" };
}

/** Columna de militancia histórica: conteo honesto (`total_n` antes del cap).
 *  WR-03: "militaron en un mismo partido" — sin afirmar coincidencia temporal.
 *  WR-06: la RPC 0067 es NET-NEW-ONLY (excluye a todo par que comparte el alias
 *  vigente, aunque ADEMÁS comparta un partido histórico) → un total_n=0 NO es una
 *  ausencia absoluta en las fuentes. Tanto la ausencia como el conteo se ACOTAN a
 *  la semántica real de la RPC ("fuera del / sin contar el partido vigente"),
 *  espejo del copy de intersección (WR-02, línea de InterseccionAusente). */
function ejeColMilitancia(nombre: string, n: number): EjeColumna {
  return {
    nombre,
    contenido: (
      <span>
        {n === 0
          ? `Sin militancia histórica compartida fuera del partido vigente registrada para ${nombre}.`
          : `${n} ${n === 1 ? "parlamentario militó" : "parlamentarios militaron"} en un mismo partido que ${nombre} (en períodos posiblemente distintos; sin contar el partido vigente compartido).`}
      </span>
    ),
  };
}

/** Columna de co-autoría: conteo honesto (`total_n` antes del cap). */
function ejeColCoautoria(nombre: string, n: number, fecha: string): EjeColumna {
  return {
    nombre,
    contenido: (
      <span>
        {n === 0
          ? `Sin registros de co-autoría para ${nombre} en las fuentes consultadas al ${fecha}.`
          : `${n} ${n === 1 ? "co-autor registrado" : "co-autores registrados"}.`}
      </span>
    ),
  };
}

/**
 * Zona electoral legible del roster: circunscripción (senado) o distrito (cámara).
 * NULL si la fuente no la registra (Cámara: audit 101-01 → distrito NULL) → nunca
 * fabricada, nunca hace match.
 */
function zonaDe(fila: ParlamentarioListadoRow | undefined): string | null {
  if (!fila) return null;
  if (fila.circunscripcion != null && fila.circunscripcion !== "") {
    return `Circunscripción ${fila.circunscripcion}`;
  }
  if (fila.distrito != null && fila.distrito !== "") {
    return `Distrito ${fila.distrito}`;
  }
  return null;
}
