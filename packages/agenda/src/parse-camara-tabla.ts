// parse-camara-tabla — extracción ESTRUCTURADA de la tabla semanal de sala de la Cámara
// desde el PDF oficial (`verDoc.aspx?prmTipo=TABLASEMANAL`), vía DeepSeek (`json_object` + zod).
//
// La Cámara NO publica la tabla de sala como dato estructurado: el único artefacto es un PDF
// con capa de texto (verificado LIVE 2026-06-23). El flujo LOCKED de 2 etapas es:
//   fetch PDF (connector) → R2 crudo (etapa 1, en ingest-run) → unpdf (capa de texto)
//     → DeepSeek extrae los ítems (etapa 2) → SesionSala[] con camara="camara".
//
// DEGRADACIÓN HONESTA (NUNCA fabricar):
//   * PDF sin capa de texto (escaneo, <200 chars no-blancos) → `extraerTextoTablaPdf` = null
//     → el caller cae al enlace PDF.
//   * El modelo no devuelve ítems válidos / la sesión no valida zod → `[]` (sin filas).
//   * El RUT NUNCA cruza al prompt: el `DeepSeekProvider` corre `assertNoRutInLlmInput`
//     fail-closed ANTES de la red — si el texto trae un RUT, lanza y el caller degrada.
//
// MODELADO (decisión tomada al implementar): UNA `SesionSala` POR SEMANA
// (`id = camara:sesion:<YYYY-Www>`), con TODOS los ítems del PDF. El PDF lista los días de la
// semana en una cabecera ("LUNES 22 …", "MARTES 23 …") y LUEGO una lista plana de materias que
// NO están asociadas a un día concreto sin ambigüedad. Asignar cada materia a un día sería
// FABRICAR el vínculo día↔ítem → se evita (regla LOCKED). `fecha` = primer día de la semana
// (o la primera fecha que el modelo lee de la cabecera, si la trae).

import {
  SesionSalaSchema,
  SesionTablaItemSchema,
  type SesionSala,
  type SesionTablaItem,
} from "./model";
import { semanaIsoKey, primerDiaSemanaIso, type SemanaIso } from "./semana-iso";
import { CAMARA_TABLA_PDF_URL } from "./connector-camara";
import type { CompletionRequest, LLMProvider } from "@obs/llm";
import { z } from "zod";

/** Origen (fuente) de las filas de tabla de sala de Cámara extraídas del PDF. */
export const ORIGEN_CAMARA_TABLA = "camara-tabla-semanal";

/**
 * Umbral de caracteres no-blancos bajo el cual el PDF se considera escaneado (sin capa de
 * texto) → degradación honesta a null (mismo umbral que `@obs/fichas` texto-fuente).
 */
const MIN_PDF_TEXT_CHARS = 200;

/** Magic bytes "%PDF-" (0x25 50 44 46 2D). */
const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46, 0x2d] as const;

function esPdf(body: Uint8Array): boolean {
  if (body.length < PDF_MAGIC.length) return false;
  for (let i = 0; i < PDF_MAGIC.length; i++) if (body[i] !== PDF_MAGIC[i]) return false;
  return true;
}

/**
 * Extrae la capa de texto del PDF de la tabla con unpdf (pdfjs serverless, JS puro). Si no es
 * un PDF, o es un escaneo (texto < MIN_PDF_TEXT_CHARS no-blancos), devuelve null — NUNCA
 * fabrica. unpdf se importa perezosamente (no carga pdfjs si no es PDF).
 */
export async function extraerTextoTablaPdf(
  body: Uint8Array,
  log: (msg: string) => void = () => {},
): Promise<string | null> {
  if (!esPdf(body)) {
    log("parse-camara-tabla: el cuerpo no es un PDF (magic bytes) → degrada");
    return null;
  }
  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(body);
  const { text } = await extractText(pdf, { mergePages: true });
  const texto = Array.isArray(text) ? text.join("\n") : String(text ?? "");
  if (texto.replace(/\s/g, "").length < MIN_PDF_TEXT_CHARS) {
    log("parse-camara-tabla: PDF sin capa de texto (escaneado) → degrada (OCR diferido)");
    return null;
  }
  return texto;
}

// ── Esquema de SALIDA del modelo (laxo; la verdad estructural es SesionTablaItemSchema) ──
const LlmItemSchema = z.object({
  /** Texto de la materia/asunto, literal del PDF. */
  materia: z.string().nullable().optional(),
  /** Boletín tal cual aparece (p.ej. "10986- 24"); se normaliza después. */
  boletin: z.string().nullable().optional(),
  /** Etiqueta de sección ("FÁCIL DESPACHO" / "ORDEN DEL DÍA" / "TABLA"). */
  seccion: z.string().nullable().optional(),
  /** Urgencia/trámite si aparece (p.ej. "SUMA (25.06.2026)"). */
  urgencia: z.string().nullable().optional(),
});
const LlmTablaSchema = z.object({
  /** Primera fecha de sesión leída de la cabecera, ISO "YYYY-MM-DD" o null. */
  fecha_primera_sesion: z.string().nullable().optional(),
  items: z.array(LlmItemSchema),
});

const SYSTEM_PROMPT = [
  "Eres un motor de extracción estructurada. Devuelve UN solo objeto JSON válido y nada más.",
  "Te paso el texto de un PDF: la TABLA SEMANAL de sala de la Cámara de Diputadas y Diputados de Chile.",
  "Extrae LITERALMENTE los asuntos/materias que la tabla lista; NO inventes, NO resumas, NO completes.",
  "Devuelve este json: {\"fecha_primera_sesion\": \"YYYY-MM-DD\"|null, \"items\": [{\"materia\": string|null, \"boletin\": string|null, \"seccion\": string|null, \"urgencia\": string|null}]}.",
  "- materia: el texto del asunto, literal.",
  "- boletin: el número de boletín si aparece (formato del PDF, p.ej. 'Boletín N° 10986- 24'); si no hay, null. NO inventes boletines.",
  "- seccion: la etiqueta de sección bajo la que aparece el ítem ('FÁCIL DESPACHO', 'ORDEN DEL DÍA', 'TABLA', etc.) o null.",
  "- urgencia: la urgencia/trámite si la tabla la indica ('SUMA', 'SIMPLE', con fecha entre paréntesis) o null.",
  "- fecha_primera_sesion: la primera fecha de sesión que aparezca en la cabecera, en ISO YYYY-MM-DD; si no es claro, null.",
  "Si la tabla no tiene asuntos (p.ej. solo acusaciones constitucionales sin boletín), igual incluye cada asunto con boletin=null. Devuelve items=[] solo si de verdad no hay ninguno.",
].join("\n");

/**
 * Normaliza un boletín al formato `NNNNN-NN`. El PDF lo imprime como "Boletín N° 10986- 24"
 * (espacio antes del sufijo); se extraen los dígitos y se recompone. Devuelve null si no casa
 * (no se fabrica un boletín).
 */
export function normalizarBoletin(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const m = String(raw).match(/(\d{3,6})\s*-\s*(\d{1,3})/);
  if (!m) return null;
  return `${m[1]}-${m[2]}`;
}

function limpiar(s: string | null | undefined): string | null {
  if (s == null) return null;
  const t = String(s).replace(/\s+/g, " ").trim();
  return t === "" ? null : t;
}

export interface ParseCamaraTablaOpts {
  /** Provider LLM (DeepSeek en prod; mock en tests). */
  provider: LLMProvider;
  /** ISO 8601 del momento de captura. Default: now. */
  fechaCaptura?: string;
  /** Reintentos del repair loop ante JSON inválido. Default del adapter (1). */
  maxRepairAttempts?: number;
  /** Sink de logs. Default: noop. */
  log?: (msg: string) => void;
}

/**
 * Parsea el TEXTO (capa de texto del PDF) de la tabla semanal de sala de la Cámara a un arreglo
 * de `SesionSala[]` (0 o 1 sesión, modelo POR SEMANA). Llama a DeepSeek con `json_object` + zod.
 *
 * Degradación honesta: si el modelo no produce ítems válidos o la sesión no valida, devuelve `[]`
 * (sin fabricar). El gate anti-RUT del provider corre antes de la red (puede lanzar → el caller
 * degrada esa corrida).
 */
export async function parseCamaraTabla(
  texto: string,
  semana: SemanaIso,
  opts: ParseCamaraTablaOpts,
): Promise<SesionSala[]> {
  const log = opts.log ?? (() => {});
  const fechaCaptura = opts.fechaCaptura ?? new Date().toISOString();
  const semanaIso = semanaIsoKey(semana.year, semana.week);

  const req: CompletionRequest = {
    system: SYSTEM_PROMPT,
    user: texto,
    criticality: "bulk",
    sensitivity: "public",
    ...(opts.maxRepairAttempts != null ? { maxRepairAttempts: opts.maxRepairAttempts } : {}),
  };

  let salida: z.infer<typeof LlmTablaSchema>;
  try {
    salida = await opts.provider.complete(req, LlmTablaSchema);
  } catch (err) {
    // RUT en el prompt (fail-closed), JSON irreparable, fallo de red: degrada honesto.
    log(
      `parse-camara-tabla: extracción LLM falló → degrada: ${err instanceof Error ? err.message : String(err)}`,
    );
    return [];
  }

  // Mapear los ítems del modelo a SesionTablaItem (posicion = orden de aparición), normalizando
  // el boletín y validando cada ítem con el schema estructural; los inválidos se descartan.
  const items: SesionTablaItem[] = [];
  salida.items.forEach((raw, i) => {
    const candidato = {
      posicion: i,
      parte_sesion: limpiar(raw.seccion) ?? "TABLA",
      materia: limpiar(raw.materia),
      boletin: normalizarBoletin(raw.boletin),
      id_proyecto: null,
      alias: null,
      quorum: limpiar(raw.urgencia),
    };
    const parsed = SesionTablaItemSchema.safeParse(candidato);
    if (parsed.success) items.push(parsed.data as SesionTablaItem);
  });

  // Sin ítems útiles → no fabricar una sesión vacía (el caller degrada al PDF).
  if (items.length === 0) {
    log("parse-camara-tabla: el modelo no devolvió ítems válidos → degrada (sin filas)");
    return [];
  }

  // fecha: la primera fecha de la cabecera si el modelo la trae en ISO válido; si no, el lunes
  // de la semana ISO (no se fabrica un día por ítem — modelo POR SEMANA).
  const fechaModelo = limpiar(salida.fecha_primera_sesion);
  const fecha =
    fechaModelo && /^\d{4}-\d{2}-\d{2}$/.test(fechaModelo)
      ? fechaModelo
      : primerDiaSemanaIso(semana.year, semana.week);

  const candidata: SesionSala = {
    id: `camara:sesion:${semanaIso}`,
    camara: "camara",
    fecha,
    numero: null,
    hora_inicio: null,
    tipo: null,
    items,
    origen: ORIGEN_CAMARA_TABLA,
    fecha_captura: fechaCaptura,
    enlace: CAMARA_TABLA_PDF_URL,
  };

  const parsed = SesionSalaSchema.safeParse(candidata);
  if (!parsed.success) {
    log(`parse-camara-tabla: sesión descartada (no valida): ${semanaIso}`);
    return [];
  }
  return [parsed.data as SesionSala];
}
