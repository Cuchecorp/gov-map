import { cache } from "react";

import { createServerSupabase } from "@/lib/supabase";
import { PARLAMENTARIO_ID_RE } from "@/lib/buscar";
import { formatNombre } from "@/lib/format";
import { CompararSelector } from "@/components/comparar-selector";
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

// Fecha de referencia de cobertura ("en las fuentes consultadas al {fecha}"). La
// provenance por dato viaja en cada fila; esta es la declaración de ausencia honesta.
const FECHA_COBERTURA = "2026-07-24";

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

/** Comisiones del parlamentario (0060). Intersección por SET de `nombre`. */
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

/** Co-autores (0061). Se busca `b.id` en el resultado de `a` → n_proyectos (count). */
const getCoautores = cache(async (id: string): Promise<CrossLinkRow[]> => {
  const sb = createServerSupabase();
  const { data, error } = await sb.rpc("coautores_de_parlamentario", {
    p_id: id,
  });
  if (error) {
    throw new Error(`coautores_de_parlamentario falló para ${id}: ${error.message}`);
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

  // Lecturas server-side en paralelo (cada una LANZA ante error real, #34).
  const [milA, comA, comB, coautA] = await Promise.all([
    getMilitanciaHistorica(a),
    getComisiones(a),
    getComisiones(b),
    getCoautores(a),
  ]);

  // ── EJE 1 — Militancia (histórica) ────────────────────────────────────────────
  // Intersección: B aparece en el resultado net-new de A (compartieron militancia
  // histórica por partido_alias, sin compartir el alias vigente).
  const compartenMilitancia = milA.some((r) => r.id === b);
  const ejeMilitancia = (
    <RelacionesEjeComparar
      key="militancia"
      heading="Militancia (histórica)"
      a={ejeColMilitancia(nombreA, milA.length)}
      b={ejeColMilitancia(nombreB, undefined)}
      interseccion={
        compartenMilitancia ? (
          <p>
            <span className="font-semibold text-accent-product">
              Compartieron militancia
            </span>{" "}
            en algún partido (sin compartir el partido vigente).
          </p>
        ) : (
          <InterseccionAusente
            frase={`En las fuentes consultadas al ${FECHA_COBERTURA}, no comparten militancia histórica.`}
          />
        )
      }
      provenance={`Fuente: BCN · según fuente al ${FECHA_COBERTURA}`}
    />
  );

  // ── EJE 2 — Comisiones ────────────────────────────────────────────────────────
  const nombresComA = comA.map((c) => c.nombre);
  const nombresComB = comB.map((c) => c.nombre);
  const setComB = new Set(nombresComB);
  const comCompartidas = [...new Set(nombresComA.filter((n) => setComB.has(n)))].sort(
    (x, y) => x.localeCompare(y, "es"),
  );
  const ejeComisiones = (
    <RelacionesEjeComparar
      key="comisiones"
      heading="Comisiones"
      a={{
        nombre: nombreA,
        contenido: listaOAusencia(
          [...nombresComA].sort((x, y) => x.localeCompare(y, "es")),
          `Sin registros de comisiones para ${nombreA} en las fuentes consultadas al ${FECHA_COBERTURA}.`,
        ),
      }}
      b={{
        nombre: nombreB,
        contenido: listaOAusencia(
          [...nombresComB].sort((x, y) => x.localeCompare(y, "es")),
          `Sin registros de comisiones para ${nombreB} en las fuentes consultadas al ${FECHA_COBERTURA}.`,
        ),
      }}
      interseccion={
        comCompartidas.length > 0 ? (
          <InterseccionCompartida
            n={comCompartidas.length}
            sustantivo={comCompartidas.length === 1 ? "comisión" : "comisiones"}
            lista={comCompartidas}
          />
        ) : (
          <InterseccionAusente
            frase={`En las fuentes consultadas al ${FECHA_COBERTURA}, no comparten comisiones.`}
          />
        )
      }
      provenance={`Fuente: Cámara/Senado · según fuente al ${FECHA_COBERTURA}`}
    />
  );

  // ── EJE 3 — Co-autoría de proyectos ───────────────────────────────────────────
  // DECISIÓN (count-only, ver SUMMARY): la RPC coautores_de_parlamentario devuelve B
  // con `n_proyectos` (conteo honesto de boletines co-firmados) pero NO la lista de
  // boletines. Mostramos el count con provenance; NO fabricamos un enlace a la lista
  // (no se expande el alcance con una RPC boletines_compartidos en esta pasada).
  const filaCoautB = coautA.find((r) => r.id === b);
  const nCoproyectos = filaCoautB?.n_proyectos ?? 0;
  const ejeCoautoria = (
    <RelacionesEjeComparar
      key="coautoria"
      heading="Co-autoría de proyectos"
      a={{
        nombre: nombreA,
        contenido: (
          <span>
            {coautA.length === 0
              ? `Sin registros de co-autoría para ${nombreA} en las fuentes consultadas al ${FECHA_COBERTURA}.`
              : `${coautA.length} ${coautA.length === 1 ? "co-autor registrado" : "co-autores registrados"}.`}
          </span>
        ),
      }}
      b={{
        nombre: nombreB,
        contenido: (
          <span>
            {filaCoautB
              ? `Co-firmó proyectos con ${nombreA}.`
              : `Sin co-autoría registrada con ${nombreA} en las fuentes consultadas al ${FECHA_COBERTURA}.`}
          </span>
        ),
      }}
      interseccion={
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
          <InterseccionAusente
            frase={`En las fuentes consultadas al ${FECHA_COBERTURA}, no comparten proyectos co-firmados.`}
          />
        )
      }
      provenance={`Fuente: Cámara/Senado · según fuente al ${FECHA_COBERTURA}`}
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
              `Sin zona electoral registrada para ${nombreA} en las fuentes consultadas al ${FECHA_COBERTURA}.`}
          </span>
        ),
      }}
      b={{
        nombre: nombreB,
        contenido: (
          <span>
            {zonaB ??
              `Sin zona electoral registrada para ${nombreB} en las fuentes consultadas al ${FECHA_COBERTURA}.`}
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
            frase={`En las fuentes consultadas al ${FECHA_COBERTURA}, no comparten zona.`}
          />
        )
      }
      provenance={`Fuente: Cámara/Senado · según fuente al ${FECHA_COBERTURA}`}
    />
  );

  return (
    <>
      {ejeMilitancia}
      {ejeComisiones}
      {ejeCoautoria}
      {ejeZona}
    </>
  );
}

// ── Utilidades ────────────────────────────────────────────────────────────────────

/** Columna de militancia histórica: conteo honesto de con-quién-compartió (o ausencia). */
function ejeColMilitancia(nombre: string, n: number | undefined): EjeColumna {
  return {
    nombre,
    contenido: (
      <span>
        {n === undefined
          ? "Ver la ficha para el detalle de militancias."
          : n === 0
            ? `Sin militancia histórica compartida registrada para ${nombre}.`
            : `${n} ${n === 1 ? "parlamentario comparte" : "parlamentarios comparten"} militancia histórica.`}
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
