// @obs/agenda — parser de la tabla semanal de sala del Senado (orden del día), JSON real
// de `web-back.senado.cl/api/weekly_table`.
//
// Forma validada LIVE (06-RESEARCH): `{ data: [ { ID_SESION, NUMERO_SESION, FECHA,
//   HORA_INICIO, HORA_TERMINO, TIPO_SESION, TABLA:[{ POSICION, PARTE_SESION, MATERIA,
//   BOLETIN, ID_PROYECTO, ALIAS, QUORUM, LINK_PROYECTO }] } ] }`. `PARTE_SESION` ∈
// {"ORDEN DEL DÍA","TIEMPO DE VOTACIONES"}.
//
// Cruce por boletín: `TABLA[].BOLETIN` (nullable, p.ej. sesiones especiales sin proyecto)
// → proyecto.boletin (Fase 5). El `FECHA` viene como texto largo ("Martes 16 de Junio de
// 2026"); se conserva normalizado (la /agenda navega por sesión, no por semana ISO aquí).
// zod por fila: una sesión que no valida se descarta (T-06-04).

import {
  SesionSalaSchema,
  type SesionSala,
  type SesionTablaItem,
} from "./model";

const ORIGEN = "senado-weekly-table";
const ENLACE = "https://web-back.senado.cl/api/weekly_table?limit=100";

function normWs(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

function asStringOrNull(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = normWs(String(v));
  return s === "" ? null : s;
}

function asIntOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isInteger(n) ? n : null;
}

/**
 * Parsea el JSON (string u objeto) de `weekly_table` a `SesionSala[]` con `items[]`.
 */
export function parseSenadoTabla(
  input: string | unknown,
  opciones: { fechaCaptura?: string } = {},
): SesionSala[] {
  const root = typeof input === "string" ? JSON.parse(input) : input;
  const data: unknown[] = Array.isArray((root as { data?: unknown }).data)
    ? ((root as { data: unknown[] }).data)
    : [];
  const fechaCaptura = opciones.fechaCaptura ?? new Date().toISOString();

  const sesiones: SesionSala[] = [];

  for (const sRaw of data) {
    const s = sRaw as Record<string, unknown>;
    const idSesion = asStringOrNull(s.ID_SESION);
    if (!idSesion) continue; // sin clave natural → descarta (no fabrica)

    const fecha = asStringOrNull(s.FECHA);
    if (!fecha) continue;

    const tablaRaw: unknown[] = Array.isArray(s.TABLA) ? s.TABLA : [];
    const items: SesionTablaItem[] = [];
    for (const itemRaw of tablaRaw) {
      const it = itemRaw as Record<string, unknown>;
      const posicion = asIntOrNull(it.POSICION);
      const parteSesion = asStringOrNull(it.PARTE_SESION);
      if (posicion === null || !parteSesion) {
        // ítem sin clave mínima → descarta el ítem (no fabrica)
        continue;
      }
      items.push({
        posicion,
        parte_sesion: parteSesion,
        materia: asStringOrNull(it.MATERIA),
        boletin: asStringOrNull(it.BOLETIN),
        id_proyecto: asIntOrNull(it.ID_PROYECTO),
        alias: asStringOrNull(it.ALIAS),
        // QUORUM viene como número en la fuente → se persiste como texto crudo nullable.
        quorum: asStringOrNull(it.QUORUM),
      });
    }

    const candidata: SesionSala = {
      id: `senado:sesion:${idSesion}`,
      camara: "senado",
      fecha,
      numero: asStringOrNull(s.NUMERO_SESION),
      hora_inicio: asStringOrNull(s.HORA_INICIO),
      tipo: asStringOrNull(s.TIPO_SESION),
      items,
      origen: ORIGEN,
      fecha_captura: fechaCaptura,
      enlace: ENLACE,
    };

    const parsed = SesionSalaSchema.safeParse(candidata);
    if (!parsed.success) {
      console.warn(
        `[parse-senado-tabla] sesión descartada (drift): ${idSesion} ${fecha}`,
        parsed.error.issues,
      );
      continue;
    }
    sesiones.push(parsed.data as SesionSala);
  }

  return sesiones;
}
