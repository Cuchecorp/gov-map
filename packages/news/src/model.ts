// model.ts — modelo puro de un ítem RSS parseado (Etapa 2, 132-04).
//
// `RssItem` es la forma normalizada de un `<item>` de cualquiera de los 5 feeds
// congelados (feeds.ts). El campo crítico es `fechaPub`: se persiste tal cual llega
// del feed (ISO CON el offset original preservado, p.ej. "-0400" de Cooperativa),
// en una columna `timestamptz` de Supabase. El offset NUNCA se normaliza a una
// timezone global — ese es el gotcha rector repetido en v9.0/v12.0 ("fecha civil
// disfrazada de timestamptz"): normalizar aquí fabricaría días que no ocurrieron
// según la fuente. Postgres resuelve el instante real desde el offset; nosotros
// solo lo transportamos intacto.

import { z } from "zod";

export const RssItemSchema = z.object({
  /** Titular del ítem, ya desenvuelto de CDATA/entidades por el parser XML. */
  titulo: z.string().min(1),
  /**
   * URL del artículo. Es la IDENTIDAD del ítem (NO `guid` — biobiochile usa
   * `guid` con forma `?p=<id>` que difiere del `link` real).
   */
  link: z.url(),
  /** `<guid>` crudo, se conserva solo para depuración/trazabilidad, nunca como identidad. */
  guid: z.string().nullable(),
  /**
   * ISO 8601 con el offset del feed preservado (p.ej. "2026-08-05T00:41:06-04:00").
   * `null` si el feed no trae `pubDate` o no parsea. Jamás normalizar a una tz global.
   */
  fechaPub: z.string().nullable(),
  /** Descripción/resumen, HTML crudo tal cual viene del feed (el despojo vive en prefiltro-lexico.ts). */
  descripcion: z.string().nullable(),
  /** Slug del feed de origen (p.ej. "biobiochile"), NO el nombre display. */
  outlet: z.string().min(1),
});

export type RssItem = z.infer<typeof RssItemSchema>;
