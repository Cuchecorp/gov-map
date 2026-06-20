import { Suspense } from "react";

import { createServerSupabase } from "@/lib/supabase";
import { MAX_QUERY_CHARS } from "@/lib/buscar";
import type { ParlamentarioListadoRow } from "@/lib/types";
import { ParlamentarioDirectoryRow } from "@/components/parlamentario-directory-row";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * /parlamentarios — directorio de parlamentarios (SC2). Server Component.
 *
 * Cierra la brecha de descubrimiento: hoy solo `/parlamentario/[id]` por id
 * directo. El listado lee el RPC público `parlamentarios_publico()` (0026,
 * security definer) — el ÚNICO canal anon a la maestra deny-by-default; NUNCA
 * trae partido/rut/email (LEGAL-03). Filtra por cámara y por nombre server-side.
 *
 * `searchParams.camara`/`q` son input NO confiable (Next 16: SIEMPRE Promise):
 *   - `camara` se whitelist a {diputados,senado}; cualquier otro valor se descarta.
 *   - `q` se trimea y capea a MAX_QUERY_CHARS (V5). `.rpc()` parametriza; el filtro
 *     de nombre es en memoria sobre 186 filas, jamás se interpola en SQL (T-21-02-02).
 *
 * Honest-states (SC4, DESIGN-SYSTEM §7): un fallo de DB LANZA (banner de error,
 * nunca "sin resultados", #34); `[]` genuino tras filtro muestra honest-empty.
 */

type CamaraFiltro = "diputados" | "senado";

interface PageProps {
  searchParams: Promise<{ camara?: string | string[]; q?: string | string[] }>;
}

function normalizarCamara(raw: string | string[] | undefined): CamaraFiltro | undefined {
  const v = typeof raw === "string" ? raw : undefined;
  return v === "diputados" || v === "senado" ? v : undefined;
}

export default async function ParlamentariosPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const camara = normalizarCamara(sp.camara);
  const q = (typeof sp.q === "string" ? sp.q : "").trim().slice(0, MAX_QUERY_CHARS);

  return (
    <main className="max-w-5xl mx-auto px-4 md:px-8 py-8 md:py-16">
      <h1 className="text-3xl font-semibold leading-tight">Parlamentarios</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Directorio de diputadas, diputados y senadores en ejercicio. Cada ficha
        enlaza a su detalle con la fuente a la vista.
      </p>

      <DirectoryFilter camara={camara} q={q} />

      <Suspense key={`${camara ?? ""}::${q}`} fallback={<DirectorySkeleton />}>
        <DirectoryList camara={camara} q={q} />
      </Suspense>
    </main>
  );
}

// ── Filtro SSR-first (form GET, progressive-enhancement; sin JS de cliente) ─────
function DirectoryFilter({ camara, q }: { camara?: CamaraFiltro; q: string }) {
  return (
    <form
      method="get"
      action="/parlamentarios"
      className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-end"
      role="search"
    >
      <label className="flex-1">
        <span className="block text-sm font-medium">Buscar por nombre</span>
        <input
          type="search"
          name="q"
          defaultValue={q}
          maxLength={MAX_QUERY_CHARS}
          placeholder="Nombre o apellido"
          className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </label>
      <label className="sm:w-56">
        <span className="block text-sm font-medium">Cámara</span>
        <select
          name="camara"
          defaultValue={camara ?? ""}
          className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="">Todas</option>
          <option value="diputados">Cámara</option>
          <option value="senado">Senado</option>
        </select>
      </label>
      <button
        type="submit"
        className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        Filtrar
      </button>
    </form>
  );
}

// ── Lista: RPC + filtro server-side; error ≠ empty (honest degradation) ─────────
export async function DirectoryList({
  camara,
  q,
}: {
  camara?: CamaraFiltro;
  q: string;
}) {
  const sb = createServerSupabase();
  const { data, error } = await sb.rpc("parlamentarios_publico");
  if (error) {
    // #34: un fallo real de DB/red es un ERROR, nunca "Sin parlamentarios".
    throw new Error(`parlamentarios_publico falló: ${error.message}`);
  }

  let rows = (data as ParlamentarioListadoRow[] | null) ?? [];
  // camara es NOT NULL en la maestra → filtro seguro. NO se filtra por
  // region/distrito como eje primario (Pitfall 5: nullable → perdería senadores).
  if (camara) rows = rows.filter((r) => r.camara === camara);
  if (q) {
    const needle = q.toLowerCase();
    rows = rows.filter((r) => r.nombre.toLowerCase().includes(needle));
  }

  if (rows.length === 0) {
    // honest-empty: un filtro sin resultados, distinto del banner de error.
    return (
      <div className="mt-8 rounded-lg border border-border bg-muted/40 px-6 py-8 text-center text-sm text-muted-foreground">
        <p className="font-semibold text-foreground">
          Sin parlamentarios para este filtro.
        </p>
        <p className="mt-1">Prueba con otro nombre o cambia la cámara.</p>
      </div>
    );
  }

  return (
    <>
      <p className="mt-6 text-sm text-muted-foreground">
        {rows.length === 1
          ? "1 parlamentario"
          : `${rows.length} parlamentarios`}
      </p>
      <ul className="mt-4 space-y-3">
        {rows.map((r) => (
          <li key={r.id}>
            <ParlamentarioDirectoryRow parlamentario={r} />
          </li>
        ))}
      </ul>
    </>
  );
}

// ── Skeleton (shape-matched: filas del directorio) ──────────────────────────────
function DirectorySkeleton() {
  return (
    <div className="mt-8 space-y-3" aria-hidden="true">
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="rounded-lg border border-border bg-card px-4 py-3"
        >
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-48" />
          </div>
          <Skeleton className="mt-2 h-4 w-32" />
        </div>
      ))}
    </div>
  );
}
