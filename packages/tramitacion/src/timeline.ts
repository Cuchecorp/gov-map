// timeline — fusión cronológica cross-cámara (TRAM-05).
//
// Recibe los TramitacionEvento[] ya normalizados por los parsers (Senado: tramite/urgencia/
// informe/oficio; la ola 4 además inyecta eventos `tipo:'votacion'` derivados de cada Votacion
// vía `eventoDesdeVotacion`) y los ordena por fecha ascendente. Función PURA (sin red ni DB).
//
// Reglas de orden (UI-SPEC §3.2):
//  - Empate exacto de fecha → orden estable, Cámara (camara que contenga "Diputados") antes
//    que Senado.
//  - Fechas null/no parseables → al FINAL, en orden de inserción (no se descartan en silencio).

import { type TramitacionEvento, type Votacion } from "./model";
import { parseFechaCL } from "./fecha";

/** Acepta un arreglo plano de eventos o un arreglo de arreglos (se aplana). */
type EntradaTimeline = TramitacionEvento[] | TramitacionEvento[][];

function aplanar(entrada: EntradaTimeline): TramitacionEvento[] {
  const out: TramitacionEvento[] = [];
  for (const item of entrada) {
    if (Array.isArray(item)) out.push(...(item as TramitacionEvento[]));
    else out.push(item as TramitacionEvento);
  }
  return out;
}

/** ms desde epoch, o null si la fecha no parsea (ISO directo o dd/mm/yyyy). */
function tiempo(fecha: string): number | null {
  if (!fecha) return null;
  // WR-01 (Pitfall 3): parsear con el parser chileno EXPLÍCITO PRIMERO. `new Date("03/06/2026")`
  // NO devuelve NaN — V8 lo interpreta como mm/dd (03 de junio → 06 de marzo), ordenando el
  // evento en la fecha equivocada. `parseFechaCL` reconoce dd/mm/yyyy E ISO sin ambigüedad.
  const cl = parseFechaCL(fecha);
  if (cl) return cl.getTime();
  // Último recurso para formatos que parseFechaCL no cubre (p.ej. ISO con zona explícita).
  const d = new Date(fecha);
  return Number.isNaN(d.getTime()) ? null : d.getTime();
}

/** Rango de cámara para el desempate estable: Cámara (Diputados) = 0, Senado/otros = 1. */
function rangoCamara(camara: string): number {
  return /diputados/i.test(camara) ? 0 : 1;
}

/**
 * Fusiona y ordena cronológicamente los eventos de ambas cámaras. Estable: empate de fecha →
 * Cámara antes que Senado; fechas inválidas al final en orden de inserción.
 */
export function fusionarTimeline(
  entrada: EntradaTimeline,
): TramitacionEvento[] {
  const eventos = aplanar(entrada);

  const conFecha: { e: TramitacionEvento; t: number; i: number }[] = [];
  const sinFecha: TramitacionEvento[] = [];

  eventos.forEach((e, i) => {
    const t = tiempo(e.fecha);
    if (t == null) sinFecha.push(e);
    else conFecha.push({ e, t, i });
  });

  conFecha.sort((a, b) => {
    if (a.t !== b.t) return a.t - b.t;
    const rc = rangoCamara(a.e.camara) - rangoCamara(b.e.camara);
    if (rc !== 0) return rc;
    return a.i - b.i; // estable: preserva orden de inserción
  });

  return [...conFecha.map((x) => x.e), ...sinFecha];
}

/**
 * Materializa una `Votacion` como evento de timeline (`tipo:'votacion'`). La ola 4 lo usa para
 * inyectar las votaciones de ambas cámaras en el timeline junto a los eventos de tramitación.
 */
export function eventoDesdeVotacion(v: Votacion): TramitacionEvento {
  const descripcion =
    `${v.resultado ?? "Votación"} ` +
    `(Sí ${v.total_si} · No ${v.total_no} · Abst ${v.total_abstencion} · Pareo ${v.total_pareo})`;
  return {
    boletin: v.boletin,
    fecha: v.fecha,
    camara: v.camara === "diputados" ? "C.Diputados" : "Senado",
    tipo: "votacion",
    descripcion,
    enlace: v.enlace ?? null,
    origen: v.origen,
    fecha_captura: v.fecha_captura,
  };
}
