// caso-golden.ts — esquema zod del caso golden (D-133-F2 / D-133-C2.5), SIN ningún caso.
//
// Este archivo define la FORMA, no contiene datos. 133-a no etiqueta ni un solo caso — eso
// es 133-b, con su propia firma (ventana de 3 días hábiles de RSS que hoy no existe).
//
// `.strict()` en TODOS los objetos del esquema es el control de copyright/PII de D-133-F2:
// solo titular + descripción del RSS entran al golden, cero full-text, cero PII añadida,
// cero cruce con `parlamentario`, cero causalidad ni intención. Un campo extra no es un
// descuido tolerable — es la vía por la que el full-text (u otro dato no autorizado)
// entraría al golden set sin que ningún guard lo note. La prueba de mutación de este
// archivo (ver caso-golden.test.ts) demuestra que un campo espurio hace fallar la
// validación.
import { z } from "zod";
import { ETIQUETAS } from "./taxonomia.js";

/** El enum de etiquetas se DERIVA de `ETIQUETAS` (taxonomia.ts) — jamás se re-escribe a mano. */
const EtiquetaSchema = z.enum(ETIQUETAS as [string, ...string[]]);

const EstratoSchema = z.enum(["P", "N-alea", "N-sonda", "P-dirigido"]);

const ProcedenciaSchema = z
  .object({
    r2_path: z.string().min(1),
    url_hash: z.string().min(1),
    url_canonica: z.url(),
    outlet: z.string().min(1),
    fecha_captura: z.string().min(1),
    fecha_pub: z.string().nullable(),
  })
  .strict();

const EntradaSchema = z
  .object({
    titulo: z.string().min(1),
    descripcion: z.string(),
  })
  .strict();

const EntradaLlmSchema = z
  .object({
    titulo: z.string().min(1),
    descripcion: z.string(),
  })
  .strict();

const PrefiltroSchema = z
  .object({
    paso: z.boolean(),
    terminos: z.array(z.string()),
  })
  .strict();

/** D-133-C2.5: quién resolvió el desacuerdo entre los dos modelos que etiquetaron el caso. */
const ResueltoPorSchema = z.enum(["acuerdo", "operador", "no_arbitrado"]);

/**
 * D-133-C2.2: `justificacion_a`/`_b` citan el fragmento LITERAL que motivó la etiqueta,
 * con tope de 200 chars — una justificación larga es indicio de que el modelo está
 * razonando sobre algo que no es el fragmento citado.
 */
const RevisionSchema = z
  .object({
    etiqueta_a: EtiquetaSchema,
    etiqueta_b: EtiquetaSchema,
    justificacion_a: z.string().max(200),
    justificacion_b: z.string().max(200),
    acuerdo: z.boolean(),
    resuelto_por: ResueltoPorSchema,
    modelo_a: z.string().min(1),
    modelo_b: z.string().min(1),
    en_calibracion_humana: z.boolean(),
    etiqueta_humana: EtiquetaSchema.nullable(),
    revisado_en: z.string().min(1),
  })
  .strict();

/**
 * Refinements de coherencia interna (WR-01 de 133-REVIEW.md): sin ellos, el esquema
 * valida casos golden internamente contradictorios que corromperían en silencio la
 * métrica de 133-b. Cada regla tiene su `it` de mutación apareado en
 * `caso-golden.test.ts` (quitar la regla ⇒ el caso contradictorio vuelve a validar).
 */
export const CasoGoldenSchema = z
  .object({
    caso_id: z.string().min(1),
    procedencia: ProcedenciaSchema,
    entrada: EntradaSchema,
    entrada_llm: EntradaLlmSchema,
    estrato: EstratoSchema,
    prefiltro: PrefiltroSchema,
    etiqueta: EtiquetaSchema,
    revision: RevisionSchema,
  })
  .strict()
  .superRefine((caso, ctx) => {
    const { etiqueta_a, etiqueta_b, acuerdo, resuelto_por, en_calibracion_humana, etiqueta_humana } =
      caso.revision;

    if (acuerdo !== (etiqueta_a === etiqueta_b)) {
      ctx.addIssue({
        code: "custom",
        path: ["revision", "acuerdo"],
        message: "acuerdo debe ser exactamente (etiqueta_a === etiqueta_b)",
      });
    }

    if (acuerdo && resuelto_por !== "acuerdo") {
      ctx.addIssue({
        code: "custom",
        path: ["revision", "resuelto_por"],
        message: "acuerdo=true exige resuelto_por='acuerdo'",
      });
    }
    if (!acuerdo && resuelto_por === "acuerdo") {
      ctx.addIssue({
        code: "custom",
        path: ["revision", "resuelto_por"],
        message: "desacuerdo (acuerdo=false) no puede resolverse por 'acuerdo'",
      });
    }

    if (en_calibracion_humana && etiqueta_humana === null) {
      ctx.addIssue({
        code: "custom",
        path: ["revision", "etiqueta_humana"],
        message: "en_calibracion_humana=true exige etiqueta_humana no nula",
      });
    }

    const candidatas = [etiqueta_a, etiqueta_b, etiqueta_humana].filter(
      (v): v is string => v !== null,
    );
    if (!candidatas.includes(caso.etiqueta)) {
      ctx.addIssue({
        code: "custom",
        path: ["etiqueta"],
        message: "etiqueta debe provenir de etiqueta_a, etiqueta_b o etiqueta_humana",
      });
    }
  });

export type CasoGolden = z.infer<typeof CasoGoldenSchema>;
