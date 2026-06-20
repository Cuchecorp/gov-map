import { defineCloudflareConfig } from "@opennextjs/cloudflare";

/**
 * Config de OpenNext para Cloudflare Workers.
 *
 * MVP: sin cache incremental persistente (defaults en-memoria del Worker). Esto
 * evita depender de R2, que hoy devuelve 401 (ver memoria env-credentials-reality).
 *
 * Cuando el token R2 funcione, habilitar ISR persistente:
 *   import r2IncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache";
 *   export default defineCloudflareConfig({ incrementalCache: r2IncrementalCache });
 * y descomentar el binding NEXT_INC_CACHE_R2_BUCKET en wrangler.jsonc.
 *
 * Nota: el sitio es server-rendered desde Supabase (lectura RLS por anon key);
 * la mayoría de las rutas son dinámicas, así que el cache ISR es opcional.
 */
export default defineCloudflareConfig({});
