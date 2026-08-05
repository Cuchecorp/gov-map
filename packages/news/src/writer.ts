// writer — NewsWriter inyectable (upsert idempotente por CLAVE NATURAL) + fake in-memory.
//
// El writer persiste el modelo de noticias (Etapa 2, 132-05) de forma IDEMPOTENTE por clave
// natural (migración 0084):
//   * noticia            → PK `url_hash`
//   * noticia_url_vista  → PK `url_hash`
//
// Correr la carga 2× con el mismo input NO duplica filas (upsert, no insert). La impl real
// (SupabaseNewsWriter) vive en writer-supabase.ts; aquí van la interfaz y un fake in-memory
// (Map por clave natural) para los tests sin red ni DB.

/** Fila de `noticia` — ítem que pasó el pre-filtro léxico (D-05/D-06). */
export interface NoticiaRow {
  url_hash: string;
  url: string;
  url_canonica: string;
  titular: string;
  outlet: string;
  fecha_pub: string | null;
  descripcion: string | null;
  r2_path: string;
  contenido_hash: string | null;
  estado: "pendiente" | "clasificada" | "descartada";
}

/**
 * Fila de `noticia_url_vista` — seen-ledger de idempotencia + conteo de descartes por causa.
 *
 * `estado='pendiente'` (0085, CR-02) es el marcado PROVISIONAL neutro: se escribe ANTES de
 * evaluar el pre-filtro, con `causa=null` siempre. La causa final (`prefiltro_lexico`) solo se
 * escribe DESPUÉS de que la decisión se tomó y el destino quedó confirmado — un veredicto
 * escrito antes de conocer el resultado es una mentira que el dedup convierte en pérdida
 * permanente del dato.
 */
export interface UrlVistaRow {
  url_hash: string;
  url_canonica: string;
  outlet: string;
  estado: "pasa" | "descarta" | "pendiente";
  causa: "prefiltro_lexico" | "duplicado" | null;
}

/** Writer idempotente inyectable. Cada método upserta por la clave natural de su entidad. */
export interface NewsWriter {
  upsertNoticias(filas: NoticiaRow[]): Promise<void>;
  marcarVistas(filas: UrlVistaRow[]): Promise<void>;
  /** Conteo de entradas del ledger agrupadas por `causa` (para el reporte del CLI). */
  contarPorCausa(): Promise<Record<string, number>>;
  /**
   * Dedup nivel 1 (D-13): qué hashes de la lista YA están RESUELTOS en `noticia_url_vista`
   * (`estado in ('pasa','descarta')`). Los `pendiente` NO cuentan como vistos (CR-02): deben
   * re-evaluarse en la corrida siguiente porque un fallo transitorio pudo haberlos dejado sin
   * causa final.
   */
  urlsYaVistas(hashes: string[]): Promise<Set<string>>;
}

/**
 * Writer fake in-memory: Map por clave natural (`url_hash`) → upsert idempotente verificable
 * en tests. Re-correr con el mismo input deja los mismos conteos (no duplica).
 */
export class InMemoryNewsWriter implements NewsWriter {
  readonly noticias = new Map<string, NoticiaRow>();
  readonly vistas = new Map<string, UrlVistaRow>();

  async upsertNoticias(filas: NoticiaRow[]): Promise<void> {
    for (const f of filas) this.noticias.set(f.url_hash, f);
  }

  async marcarVistas(filas: UrlVistaRow[]): Promise<void> {
    for (const f of filas) this.vistas.set(f.url_hash, f);
  }

  async contarPorCausa(): Promise<Record<string, number>> {
    const out: Record<string, number> = {};
    for (const v of this.vistas.values()) {
      const key = v.causa ?? "sin_causa";
      out[key] = (out[key] ?? 0) + 1;
    }
    return out;
  }

  async urlsYaVistas(hashes: string[]): Promise<Set<string>> {
    return new Set(
      hashes.filter((h) => {
        const v = this.vistas.get(h);
        return v !== undefined && v.estado !== "pendiente";
      }),
    );
  }
}
