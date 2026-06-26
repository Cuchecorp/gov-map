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

export interface ConteoCarriles {
  votos: CarrilEstado;
  lobby: CarrilEstado;
  patrimonio: CarrilEstado;
  cruces: CarrilEstado;
  dinero: CarrilEstado;
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
    const { data: votosData, error: votosError } = await sb.rpc(
      "votos_de_parlamentario",
      { p_id: id, p_limit: 1000, p_offset: 0 },
    );
    if (votosError) {
      throw new Error(
        `votos_de_parlamentario falló para ${id}: ${votosError.message}`,
      );
    }
    const votosTotal = (votosData as unknown[] | null)?.length ?? 0;
    const votos = derivarEstado({ total: votosTotal, ingestado: true });

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
    const lobbyFilas = (lobbyData as { identificador: string }[] | null) ?? [];
    const lobbyTotal = new Set(lobbyFilas.map((f) => f.identificador)).size;
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
    const patrTotal = (patrData as unknown[] | null)?.length ?? 0;
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
      const crucesTotal = (crucesData as unknown[] | null)?.length ?? 0;
      // Los cruces se materializan por cron global → con el gate ON, 0 señales es
      // "ingestado, sin registros" (`vacio`), nunca "no ingerido".
      cruces = derivarEstado({ total: crucesTotal, ingestado: true });
    }

    // ── DINERO (MONEY gated, hoy OFF) ───────────────────────────────────────────
    // Con MONEY OFF NO se invoca ningún RPC de dinero: el resumen arma el chip
    // honest-state `pendiente`. Con MONEY ON el conteo combina contratos + aportes
    // (ambos en el allowlist); 0 → `vacio`.
    let dinero: CarrilEstado = { tipo: "pendiente" };
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
      const dineroTotal =
        ((contratosData as unknown[] | null)?.length ?? 0) +
        ((aportesData as unknown[] | null)?.length ?? 0);
      dinero = derivarEstado({ total: dineroTotal, ingestado: true });
    }

    return { votos, lobby, patrimonio, cruces, dinero };
  },
);
