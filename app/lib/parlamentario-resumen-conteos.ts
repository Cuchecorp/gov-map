import "server-only";

import { cache } from "react";

import { createServerSupabase } from "@/lib/supabase";
import { crucesPublicEnabled } from "@/lib/cruces-gate";
import { moneyPublicEnabled } from "@/lib/money-gate";

/**
 * Conteos server-only para el resumen + índice above-fold de la ficha del
 * parlamentario (LEG-02). Deriva el conteo/estado HONESTO de cada carril SOLO
 * vía RPCs ya en `PUBLIC_RPC_ALLOWLIST` (`votos_de_parlamentario`,
 * `lobby_de_parlamentario`, `declaraciones_de_parlamentario`,
 * `cruces_de_parlamentario`, y —cuando MONEY ON— `contratos_de_parlamentario`/
 * `aportes_de_parlamentario`) más `.from('*_ingesta_estado')` (tablas NO-PII,
 * fuera de `PII_TABLES`). PROHIBIDO: `.from('parlamentario')`, cualquier tabla
 * PII, cualquier RPC fuera del allowlist, o crear un RPC nuevo (eso es F46+).
 * El guard `lockdown-guard.test.ts` (Block B) escanea este módulo.
 *
 * `import "server-only"` (línea 1, espejo de `cruces-gate.ts:1` /
 * `money-gate.ts:1` / `supabase.ts:1`) garantiza que el módulo —y la service
 * key que usa por debajo— NUNCA llegue al bundle del navegador.
 *
 * `cache()` deduplica la llamada dentro del request: el resumen y el heurístico
 * de apertura por default de la página comparten una sola lectura por `id`.
 *
 * 3-ESTADO HONESTO (derivarEstado): un vacío es un HECHO, no una virtud. Se
 * distingue "ingestado, cero registros" (`vacio`) de "aún no ingerido"
 * (`no_ingerido`), replicando EXACTO la regla de cada sección
 * (`noIngestado = estadoData === null && total === 0`). NUNCA se fabrica un
 * número. Un error real de RPC/`.from()` se LANZA (patrón #34), nunca se degrada
 * a vacío.
 *
 * GATES (espejo byte-a-byte de `page.tsx`): `cruces_de_parlamentario` SOLO se
 * invoca si `crucesPublicEnabled(process.env)`; los RPCs MONEY SOLO si
 * `moneyPublicEnabled(process.env)`. Con MONEY OFF el carril de dinero es
 * honest-state `pendiente` (lo arma el resumen), nunca un número.
 */

export type CarrilEstado =
  | { tipo: "dato"; n: number } // chip muestra n
  | { tipo: "vacio" } // ingestado, 0 → "sin registros"
  | { tipo: "no_ingerido" } // no ingestado → "—"
  | { tipo: "pendiente" }; // MONEY OFF honest-state

/**
 * Asistencia derivada de las filas de voto ya traídas (SC1 §2.1). `total` = nº de
 * votaciones confirmadas del parlamentario; `presentes` = las que NO son `ausente`
 * (misma regla que `VotosView`: presente = total − ausentes). `null` cuando NO hay
 * filas de voto: sin datos NO se fabrica "0 de 0" (T-51-22, honesto).
 */
export interface Asistencia {
  presentes: number;
  total: number;
}

/**
 * Desglose de votos por selección — la MISMA cifra que `VotosView` computa para
 * "Cómo votó" (fuente única → chip/capa-1/sección nunca desincronizan). Derivado de
 * las filas de `votos_de_parlamentario` ya leídas (sin segundo fetch).
 */
export interface VotosBreakdown {
  si: number;
  no: number;
  abstencion: number;
  pareo: number;
  ausente: number;
}

/** Un asunto (materia verbatim de la fuente) con su nº de audiencias de lobby. */
export interface LobbyMateria {
  materia: string;
  n: number;
}

/**
 * Un sector con sus conteos NEUTROS lado a lado (§9.1: nunca compone reunión+voto).
 * `nVotos` es 0 hoy (`tipo_senal` solo toma `'lobby_sector'`); la rama queda para
 * cuando el materializador emita señales de voto.
 */
export interface CruceSector {
  sector: string;
  nReuniones: number;
  nVotos: number;
}

/** Una declaración de patrimonio: año (de `fecha_presentacion`) + tipo verbatim. SIN montos. */
export interface PatrimonioDeclaracion {
  anio: number;
  tipo: string;
}

/** Rango de años cubierto por las declaraciones presentes. */
export interface RangoAnios {
  min: number;
  max: number;
}

/**
 * Desglose PURO de votos por selección (fuente única de "Cómo votó"). Acumula las
 * MISMAS filas que el conteo de votos ya leyó; una selección desconocida se ignora
 * (nunca fabrica una categoría). Exportado para test.
 */
export function resumirVotos(rows: { seleccion: string }[]): VotosBreakdown {
  const b: VotosBreakdown = { si: 0, no: 0, abstencion: 0, pareo: 0, ausente: 0 };
  for (const v of rows) {
    if (Object.prototype.hasOwnProperty.call(b, v.seleccion)) {
      b[v.seleccion as keyof VotosBreakdown] += 1;
    }
  }
  return b;
}

/**
 * Ranking PURO de asuntos de lobby (top-8 desc). El RPC hace left-join → una fila
 * por contraparte; se DEDUPLICA por `identificador` (una materia por audiencia),
 * se agrupa por el string `materia` verbatim y se cuentan audiencias. Omisión
 * honesta: materia null/vacía se EXCLUYE (nunca se fabrica una categoría). Exportado.
 */
export function rankearMaterias(
  filas: { identificador: string; materia: string | null }[],
): LobbyMateria[] {
  // Dedupe por audiencia: la materia se repite por contraparte del left-join.
  const materiaPorAudiencia = new Map<string, string | null>();
  for (const f of filas) {
    if (!materiaPorAudiencia.has(f.identificador)) {
      materiaPorAudiencia.set(f.identificador, f.materia);
    }
  }
  const conteo = new Map<string, number>();
  for (const materiaRaw of materiaPorAudiencia.values()) {
    const materia = (materiaRaw ?? "").trim();
    if (!materia) continue; // omisión honesta: nunca una categoría fabricada
    conteo.set(materia, (conteo.get(materia) ?? 0) + 1);
  }
  return [...conteo.entries()]
    .map(([materia, n]) => ({ materia, n }))
    .sort((a, b) => b.n - a.n || a.materia.localeCompare(b.materia, "es"))
    .slice(0, 8);
}

/**
 * Agrupación PURA de cruces por sector (nReuniones desc). `nReuniones` = suma de
 * `conteo` de señales `'lobby_sector'`; `nVotos` = suma de `conteo` de señales de
 * voto (hoy inexistentes → 0; la rama `voto*` queda reservada). Tipos futuros
 * desconocidos se IGNORAN (omisión honesta, no se inventa una dimensión). Exportado.
 */
export function agruparSectores(
  filas: { sector_etiqueta: string; tipo_senal: string; conteo: number }[],
): CruceSector[] {
  const porSector = new Map<string, { nReuniones: number; nVotos: number }>();
  for (const f of filas) {
    const acc = porSector.get(f.sector_etiqueta) ?? { nReuniones: 0, nVotos: 0 };
    if (f.tipo_senal === "lobby_sector") acc.nReuniones += f.conteo;
    else if (f.tipo_senal.startsWith("voto")) acc.nVotos += f.conteo;
    // otros tipos futuros: ignorados (no se fabrica una dimensión que la fuente no trae)
    porSector.set(f.sector_etiqueta, acc);
  }
  return [...porSector.entries()]
    .map(([sector, v]) => ({ sector, ...v }))
    .sort(
      (a, b) => b.nReuniones - a.nReuniones || a.sector.localeCompare(b.sector, "es"),
    );
}

/**
 * Mapeo PURO de declaraciones → año/tipo + rango. Deriva `anio` del ISO
 * `fecha_presentacion.slice(0,4)` con la MISMA guarda de `seriePatrimonio`/
 * `esHistorica` (`^\d{4}$`; año no parseable se EXCLUYE, nunca se grafica basura).
 * SIN montos, SIN conteo de ítems (los bienes viven en un RPC aparte no leído).
 * `rangoAnios` es null si no hay ningún año presente. Exportado.
 */
export function mapearPatrimonio(
  filas: { fecha_presentacion: string; tipo: string }[],
): { porDeclaracion: PatrimonioDeclaracion[]; rangoAnios: RangoAnios | null } {
  const porDeclaracion: PatrimonioDeclaracion[] = [];
  for (const f of filas) {
    const yyyy = (f.fecha_presentacion ?? "").slice(0, 4);
    const anio = Number(yyyy);
    if (!/^\d{4}$/.test(yyyy) || !Number.isFinite(anio)) continue;
    porDeclaracion.push({ anio, tipo: f.tipo });
  }
  if (porDeclaracion.length === 0) return { porDeclaracion, rangoAnios: null };
  const anios = porDeclaracion.map((d) => d.anio);
  return {
    porDeclaracion,
    rangoAnios: { min: Math.min(...anios), max: Math.max(...anios) },
  };
}

export interface ConteoCarriles {
  votos: CarrilEstado;
  lobby: CarrilEstado;
  patrimonio: CarrilEstado;
  cruces: CarrilEstado;
  /**
   * Productores capa-1 (55-02), TODOS derivados de las mismas filas ya leídas (sin
   * RPC nueva, sin montos): desglose de votos (fuente única de "Cómo votó"), ranking
   * de materias de lobby, sectores de cruces, declaraciones de patrimonio + rango.
   */
  votosBreakdown: VotosBreakdown;
  lobbyTopMaterias: LobbyMateria[];
  crucesSectores: CruceSector[];
  patrimonioPorDeclaracion: PatrimonioDeclaracion[];
  rangoAnios: RangoAnios | null;
  /**
   * Asistencia derivada de las MISMAS filas de `votos_de_parlamentario` que este
   * módulo YA lee para el conteo de votos (una sola lectura, React.cache — sin
   * segundo fetch). `null` si no hay filas (sin fabricar). El resumen la muestra
   * como chip "Presente en N de M".
   */
  asistencia: Asistencia | null;
  // WR-01/IN-03: los DOS carriles MONEY tienen conteo PROPIO (cada header/chip
  // refleja SOLO su carril). `dineroContratos` → #dinero ("Contratos del Estado");
  // `dineroAportes` → #financiamiento ("Aportes de campaña SERVEL"). NUNCA un
  // combinado: sumarlos haría que cada header sobre-declare su propio carril
  // (fabricación de densidad / anti-insinuación, en la superficie más sensible).
  dineroContratos: CarrilEstado;
  dineroAportes: CarrilEstado;
}

/**
 * Mapeo PURO conteo→estado honesto (testeable sin runtime). `ingestado` es la
 * negación de la ausencia del marcador de ingesta: `ingestado = estadoData !== null`.
 * El dato real (total>0) manda: si hay registros, el estado es `dato` aunque no
 * exista marcador.
 */
export function derivarEstado({
  total,
  ingestado,
}: {
  total: number;
  ingestado: boolean;
}): CarrilEstado {
  if (total > 0) return { tipo: "dato", n: total };
  if (ingestado) return { tipo: "vacio" };
  return { tipo: "no_ingerido" };
}

/** Lee un marcador `*_ingesta_estado` y devuelve si la ingesta de ese carril ya corrió. */
async function ingestaCorrio(
  sb: ReturnType<typeof createServerSupabase>,
  tabla: "lobby_ingesta_estado" | "probidad_ingesta_estado",
  id: string,
): Promise<boolean> {
  const { data, error } = await sb
    .from(tabla)
    .select("parlamentario_id")
    .eq("parlamentario_id", id)
    .maybeSingle<{ parlamentario_id: string }>();
  // #34: un error real de DB/red NO es "no ingestado". Se lanza.
  if (error) {
    throw new Error(`${tabla} falló para ${id}: ${error.message}`);
  }
  return data !== null;
}

/**
 * Cuenta los carriles de la ficha `id` derivando el 3-estado honesto de cada uno.
 * Server-only, deduplicado por request con `cache()`.
 */
export const contarCarriles = cache(
  async (id: string): Promise<ConteoCarriles> => {
    const sb = createServerSupabase();

    // ── VOTOS ─────────────────────────────────────────────────────────────────
    // El RPC devuelve una fila por votación confirmada (orden fecha DESC). No
    // existe `votos_ingesta_estado`: los votos son un dataset poblado a nivel
    // global, así que un parlamentario con 0 votos es "ingestado, sin registros"
    // (`vacio`), NUNCA "no ingerido" (no podemos afirmar honestamente lo segundo).
    // WR-03 (conocido, dormante ~10 votaciones): el conteo es `length` con
    // `p_limit: 1000`. Para >1000 votos confirmados mostraría "1000" como si
    // fuera el total exacto. Se DEJA ASÍ A PROPÓSITO: es el espejo BYTE-A-BYTE
    // del mismo cap en `VotosSection` (mismo RPC, mismo p_limit), así chip y
    // sección SIEMPRE coinciden. Una presentación honesta "1000+" exigiría
    // cambiarlo en AMBOS lados a la vez (chip + "Emitió N votos" de VotosView)
    // para no desincronizarlos; el fix real es un RPC de conteo dedicado (F46+),
    // NO introducir aquí un RPC nuevo (queda fuera del allowlist/alcance F45).
    const { data: votosData, error: votosError } = await sb.rpc(
      "votos_de_parlamentario",
      { p_id: id, p_limit: 1000, p_offset: 0 },
    );
    if (votosError) {
      throw new Error(
        `votos_de_parlamentario falló para ${id}: ${votosError.message}`,
      );
    }
    const votosRows =
      (votosData as { seleccion: string }[] | null) ?? [];
    const votosTotal = votosRows.length;
    const votos = derivarEstado({ total: votosTotal, ingestado: true });
    // Desglose por selección desde las MISMAS filas (fuente única de "Cómo votó";
    // capa-1/chip/sección nunca desincronizan). Sin segundo fetch.
    const votosBreakdown = resumirVotos(votosRows);

    // Asistencia derivada de las MISMAS filas (no un segundo fetch): presente =
    // seleccion !== 'ausente' (regla idéntica a VotosView). Sin filas → null:
    // no se fabrica un "0 de 0" (T-51-22, honesto).
    const asistencia =
      votosTotal > 0
        ? {
            total: votosTotal,
            presentes: votosRows.filter((v) => v.seleccion !== "ausente")
              .length,
          }
        : null;

    // ── LOBBY ─────────────────────────────────────────────────────────────────
    // El RPC trae left-join (una fila por contraparte) → el conteo de audiencias
    // es el número de `identificador` distintos. El marcador `lobby_ingesta_estado`
    // distingue `vacio` de `no_ingerido` (regla idéntica a LobbySection).
    const { data: lobbyData, error: lobbyError } = await sb.rpc(
      "lobby_de_parlamentario",
      { p_id: id },
    );
    if (lobbyError) {
      throw new Error(
        `lobby_de_parlamentario falló para ${id}: ${lobbyError.message}`,
      );
    }
    // Se lee TAMBIÉN `.materia` (mismo RPC ya invocado, sin fetch nuevo) para el
    // ranking de asuntos de capa-1 (asunto verbatim de la fuente).
    const lobbyFilas =
      (lobbyData as { identificador: string; materia: string | null }[] | null) ??
      [];
    const lobbyTotal = new Set(lobbyFilas.map((f) => f.identificador)).size;
    const lobbyTopMaterias = rankearMaterias(lobbyFilas);
    const lobbyIngestado = await ingestaCorrio(sb, "lobby_ingesta_estado", id);
    const lobby = derivarEstado({
      total: lobbyTotal,
      ingestado: lobbyIngestado,
    });

    // ── PATRIMONIO ──────────────────────────────────────────────────────────────
    // El RPC devuelve una fila por versión de declaración (modelarVersiones es 1:1).
    // El marcador `probidad_ingesta_estado` distingue `vacio` de `no_ingerido`.
    const { data: patrData, error: patrError } = await sb.rpc(
      "declaraciones_de_parlamentario",
      { p_id: id },
    );
    if (patrError) {
      throw new Error(
        `declaraciones_de_parlamentario falló para ${id}: ${patrError.message}`,
      );
    }
    // Se leen los escalares `fecha_presentacion`/`tipo` (mismo RPC, sin fetch
    // nuevo, SIN tocar `bienes_de_parlamentario` → sin montos ni conteo de ítems).
    const patrFilas =
      (patrData as { fecha_presentacion: string; tipo: string }[] | null) ?? [];
    const patrTotal = patrFilas.length;
    const { porDeclaracion: patrimonioPorDeclaracion, rangoAnios } =
      mapearPatrimonio(patrFilas);
    const patrIngestado = await ingestaCorrio(sb, "probidad_ingesta_estado", id);
    const patrimonio = derivarEstado({
      total: patrTotal,
      ingestado: patrIngestado,
    });

    // ── CRUCES (gated, hoy ON) ──────────────────────────────────────────────────
    // SOLO se invoca el RPC si el Candado B de cruces está abierto (espejo de
    // page.tsx). Con el gate OFF el resumen NO emite el chip de cruces, así que
    // este estado queda inerte (`no_ingerido` como default seguro, jamás leído).
    let cruces: CarrilEstado = { tipo: "no_ingerido" };
    // Default seguro con el gate OFF: `[]` (igual que `cruces` queda inerte).
    let crucesSectores: CruceSector[] = [];
    if (crucesPublicEnabled(process.env)) {
      const { data: crucesData, error: crucesError } = await sb.rpc(
        "cruces_de_parlamentario",
        { p_id: id },
      );
      if (crucesError) {
        throw new Error(
          `cruces_de_parlamentario falló para ${id}: ${crucesError.message}`,
        );
      }
      // Se leen los campos reales (mismo RPC, sin fetch nuevo) para agrupar por
      // sector. El `total` de la CTA sigue siendo `.length` (byte-parity con el rail).
      const crucesFilas =
        (crucesData as
          | {
              sector_id: string;
              sector_etiqueta: string;
              tipo_senal: string;
              conteo: number;
            }[]
          | null) ?? [];
      const crucesTotal = crucesFilas.length;
      crucesSectores = agruparSectores(crucesFilas);
      // Los cruces se materializan por cron global → con el gate ON, 0 señales es
      // "ingestado, sin registros" (`vacio`), nunca "no ingerido".
      cruces = derivarEstado({ total: crucesTotal, ingestado: true });
    }

    // ── DINERO (MONEY gated, hoy OFF) ───────────────────────────────────────────
    // Con MONEY OFF NO se invoca ningún RPC de dinero: el resumen arma el chip
    // honest-state `pendiente`. Con MONEY ON cada carril MONEY tiene su PROPIO
    // conteo (WR-01/IN-03): contratos → #dinero, aportes → #financiamiento; ambos
    // RPCs en el allowlist; 0 → `vacio`. JAMÁS se combinan (cada header refleja
    // SOLO lo que su sección renderiza).
    let dineroContratos: CarrilEstado = { tipo: "pendiente" };
    let dineroAportes: CarrilEstado = { tipo: "pendiente" };
    if (moneyPublicEnabled(process.env)) {
      const { data: contratosData, error: contratosError } = await sb.rpc(
        "contratos_de_parlamentario",
        { p_id: id },
      );
      if (contratosError) {
        throw new Error(
          `contratos_de_parlamentario falló para ${id}: ${contratosError.message}`,
        );
      }
      const { data: aportesData, error: aportesError } = await sb.rpc(
        "aportes_de_parlamentario",
        { p_id: id },
      );
      if (aportesError) {
        throw new Error(
          `aportes_de_parlamentario falló para ${id}: ${aportesError.message}`,
        );
      }
      const contratosTotal = (contratosData as unknown[] | null)?.length ?? 0;
      const aportesTotal = (aportesData as unknown[] | null)?.length ?? 0;
      dineroContratos = derivarEstado({ total: contratosTotal, ingestado: true });
      dineroAportes = derivarEstado({ total: aportesTotal, ingestado: true });
    }

    return {
      votos,
      lobby,
      patrimonio,
      cruces,
      dineroContratos,
      dineroAportes,
      asistencia,
      votosBreakdown,
      lobbyTopMaterias,
      crucesSectores,
      patrimonioPorDeclaracion,
      rangoAnios,
    };
  },
);

/**
 * Estado HONESTO "desconocido" de TODOS los carriles (`no_ingerido` → "—").
 * Es el fallback seguro de `contarCarrilesSeguro`: un fallo de conteo NUNCA
 * fabrica densidad (jamás un número) y nunca afirma "vacío/sin registros"
 * (que sería una afirmación positiva sobre la fuente). "—" es lo más honesto
 * disponible: "no podemos mostrar el conteo ahora". PURO (testeable).
 */
export function conteosDesconocidos(): ConteoCarriles {
  return {
    votos: { tipo: "no_ingerido" },
    lobby: { tipo: "no_ingerido" },
    patrimonio: { tipo: "no_ingerido" },
    cruces: { tipo: "no_ingerido" },
    dineroContratos: { tipo: "no_ingerido" },
    dineroAportes: { tipo: "no_ingerido" },
    // Sin conteo confiable no se afirma asistencia (jamás un "0 de 0" fabricado).
    asistencia: null,
    // Productores capa-1 en su forma vacía honesta (nunca fabrica densidad).
    votosBreakdown: { si: 0, no: 0, abstencion: 0, pareo: 0, ausente: 0 },
    lobbyTopMaterias: [],
    crucesSectores: [],
    patrimonioPorDeclaracion: [],
    rangoAnios: null,
  };
}

/**
 * WR-02: lectura de conteos a prueba de fallos para el SHELL de la ficha.
 *
 * `contarCarriles` aplica el patrón #34 (lanza ante un error real de RPC/`.from()`)
 * — correcto para una SECCIÓN de datos (UI de error honesta), pero los CONTEOS
 * alimentan el resumen/índice y los headers de TODOS los acordeones: un fallo
 * transitorio en un solo carril NO debe tumbar la ficha entera (cabecera incluida).
 * Aquí el fallo se DEGRADA a estado honesto "desconocido" (—) y se loguea para
 * observabilidad. Sigue deduplicado por request (reusa el `cache()` de abajo).
 *
 * Las SECCIONES de datos conservan su propio #34 (cada `*Section` lanza su error
 * real bajo su Suspense): la degradación honesta es SOLO del índice/headers, no
 * del contenido de cada carril.
 */
export async function contarCarrilesSeguro(
  id: string,
): Promise<ConteoCarriles> {
  try {
    return await contarCarriles(id);
  } catch (e) {
    console.error(
      `contarCarriles degradó a estado honesto "desconocido" para ${id}:`,
      e,
    );
    return conteosDesconocidos();
  }
}
