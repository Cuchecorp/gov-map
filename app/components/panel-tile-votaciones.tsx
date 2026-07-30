import { createServerSupabase } from "@/lib/supabase";
import { fechaCorta } from "@/lib/format";
import { hrefProyecto } from "@/lib/links-internos";
import { LEYENDA_ANTI_INSINUACION } from "@/lib/voto-presentacion";
import { leerTitulos } from "@/components/actualidad-module";
import type { VotacionRow } from "@/lib/types";

/**
 * PanelTileVotaciones — Tile 5 "Votaciones recientes" (L4, Phase 128 PANEL-02/04/05).
 *
 * Nombre de archivo CONGELADO (declarado en `SUPERFICIES_PANEL` del guard
 * anti-insinuación). Es el ÚNICO tile del panel que NO lee la RPC 0066: lee
 * `public.votacion` directamente (tabla NO-PII, precedente vivo en
 * `actualidad-module.tsx:VotadoEstaSemana`), cero RPC nueva, cero allowlist.
 *
 * DECISIÓN A1 (research 128, ratificada por el planner — NO renegociar): el
 * tile NO se envuelve en `vsimPublicEnabled()`. Ese flag gatea la SIMILITUD de
 * votación (`/comparar`), no el hecho de votación, que ya es público sin gate
 * en `/proyecto#votaciones` — O-2 lo ratifica VISIBLE. Ningún flag se toca
 * aquí.
 *
 * REGLAS DURAS (D-04, no negociables):
 *  - Una línea por VOTACIÓN, jamás agregada por boletín (`18384-08` trae 6 el
 *    mismo día en Senado).
 *  - `resultado` null ⇒ literal exacto "resultado no informado por la fuente".
 *    Jamás se infiere el resultado desde los números.
 *  - Conteos verbatim de `total_si`/`total_no`/`total_abstencion` — cero
 *    cálculo de tasas/porcentajes/comparaciones.
 *  - Orden cronológico descendente únicamente.
 */
export interface VotacionPanelItem {
  id: string;
  boletin: string;
  titulo: string | null;
  fecha: Date;
  /** Grafía YA normalizada por el wrapper (`grafiaCamaraCiudadana`). */
  camara: string;
  /** `null` = resultado no informado por la fuente (100% de las filas de Senado). */
  resultado: string | null;
  si: number;
  no: number;
  abstencion: number;
}

/**
 * Normaliza la grafía de `votacion.camara` ("diputados"/"senado" en minúscula
 * — esa tabla no pasó por el fix del materializador) a la forma ciudadana
 * ("Cámara de Diputados"/"Senado"). Un literal desconocido se devuelve
 * verbatim (fallback honesto, jamás se inventa una cámara).
 */
export function grafiaCamaraCiudadana(raw: string): string {
  const norm = raw.trim().toLowerCase();
  if (norm === "diputados") return "Cámara de Diputados";
  if (norm === "senado") return "Senado";
  return raw;
}

function detalleVotacion(item: VotacionPanelItem): string {
  const resultado = item.resultado?.trim() || "resultado no informado por la fuente";
  return `Votación en ${item.camara} el ${fechaCorta(item.fecha)}: ${resultado} — ${item.si} a favor, ${item.no} en contra, ${item.abstencion} abstenciones`;
}

export function PanelTileVotacionesView({
  items,
  fechaFuente,
}: {
  items: VotacionPanelItem[];
  fechaFuente: Date | null;
}) {
  return (
    <section className="p-6">
      <h2 className="text-lg font-semibold mb-4">Votaciones recientes</h2>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {fechaFuente
            ? `Sin votaciones fechadas en las fuentes consultadas al ${fechaCorta(fechaFuente)}.`
            : "Sin votaciones fechadas en las fuentes consultadas."}
        </p>
      ) : (
        <ul>
          {items.map((it) => (
            <li
              key={`${it.boletin}-${it.id}`}
              className="border-t border-border pt-3 first:border-t-0 first:pt-0"
            >
              <div className="flex flex-col gap-[14px]">
                <a
                  href={hrefProyecto(it.boletin, "votaciones")}
                  className="text-[15px] font-medium leading-snug hover:underline"
                >
                  {it.titulo ? `${it.boletin} — ${it.titulo}` : it.boletin}
                </a>
                <div className="text-[13px] text-muted-foreground">
                  {detalleVotacion(it)}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-4 text-[11px] text-muted-foreground">{LEYENDA_ANTI_INSINUACION}</p>
      {fechaFuente ? (
        <p className="mt-2 text-[11px] text-muted-foreground">
          Fuente: Votaciones · según fuente al {fechaCorta(fechaFuente)}
        </p>
      ) : null}
    </section>
  );
}

/**
 * Wrapper async — lectura determinista y bounded de `public.votacion`.
 * Desempate `.order("id")` OBLIGATORIO: `order by fecha desc` solo no es
 * determinista (gotcha B-01).
 */
export async function PanelTileVotaciones({
  maxItems = 4,
}: { maxItems?: number } = {}) {
  const sb = createServerSupabase();

  const { data, error } = await sb
    .from("votacion")
    .select("id, boletin, fecha, resultado, total_si, total_no, total_abstencion, camara")
    .order("fecha", { ascending: false })
    .order("id", { ascending: false })
    .limit(maxItems);

  // #34: un error real de lectura ≠ "sin votaciones". Se lanza (nunca `?? []`).
  if (error) {
    throw new Error(`PanelTileVotaciones: no se pudo leer votacion: ${error.message}`);
  }

  const filas =
    (data as Pick<
      VotacionRow,
      "id" | "boletin" | "fecha" | "resultado" | "total_si" | "total_no" | "total_abstencion" | "camara"
    >[] | null) ?? [];

  const titulos = await leerTitulos(
    sb,
    filas.map((f) => f.boletin),
  );

  let fechaFuente: Date | null = null;
  const items: VotacionPanelItem[] = [];
  for (const f of filas) {
    if (!f.fecha) continue; // fecha inválida → no se fabrica el hecho fechado
    const fecha = new Date(f.fecha);
    if (Number.isNaN(fecha.getTime())) continue;
    if (!fechaFuente || fecha.getTime() > fechaFuente.getTime()) {
      fechaFuente = fecha;
    }
    items.push({
      id: f.id,
      boletin: f.boletin,
      titulo: titulos.get(f.boletin) ?? null,
      fecha,
      camara: grafiaCamaraCiudadana(f.camara ?? ""),
      resultado: f.resultado?.trim() || null,
      si: f.total_si,
      no: f.total_no,
      abstencion: f.total_abstencion,
    });
  }

  return <PanelTileVotacionesView items={items} fechaFuente={fechaFuente} />;
}
