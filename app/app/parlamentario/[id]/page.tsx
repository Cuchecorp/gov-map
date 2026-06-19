import { Suspense } from "react";
import { notFound } from "next/navigation";

import { createServerSupabase } from "@/lib/supabase";
import { PARLAMENTARIO_ID_RE } from "@/lib/buscar";
import { ParlamentarioHeader } from "@/components/parlamentario-header";
import { VotosSection } from "@/components/votos-por-parlamentario";
import { LobbySection } from "@/components/lobby-de-parlamentario";
import { Skeleton } from "@/components/ui/skeleton";
import type { ParlamentarioPublicoRow } from "@/lib/types";

/**
 * /parlamentario/[id] — la PRIMERA ficha del parlamentario (VOTE-03/04/05).
 *
 * Shell de UNA columna con secciones APILABLES e independientes: hoy solo VOTE;
 * Phase 11+ (INT lobby/patrimonio) y 14–16 (MONEY) APILAN su propia `<section>`
 * DESPUÉS, cada una con su `<h2>`, su Suspense y su empty honesto — sin anidar en
 * `#votos`. El shell mantiene válida la jerarquía h1 → h2 → h3 al crecer.
 *
 * `params`/`searchParams` son Promises (Next 16). El `[id]` se valida contra
 * PARLAMENTARIO_ID_RE ANTES de tocar la DB (V5). La cabecera se lee vía el RPC
 * `parlamentario_publico` (security definer) porque `parlamentario` es
 * deny-by-default: anon no lo lee directo (LEGAL-03).
 */

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function ParlamentarioPage({
  params,
  searchParams,
}: PageProps) {
  const { id } = await params;
  const sp = await searchParams;

  if (!PARLAMENTARIO_ID_RE.test(id)) {
    notFound();
  }

  return (
    <main className="max-w-3xl mx-auto px-4 md:px-8 py-8 md:py-16">
      <Suspense fallback={<ParlamentarioHeaderSkeleton />}>
        <HeaderSection id={id} />
      </Suspense>

      <section id="votos" className="mt-12">
        <h2 className="text-xl font-semibold mb-4">Votaciones</h2>
        <Suspense fallback={<VotosSkeleton />}>
          <VotosSection id={id} searchParams={sp} />
        </Suspense>
      </section>

      {/*
        Phase 11 — INT Lobby (§3.0). SIBLING de #votos, NUNCA anidada: el mt-12 es
        la frontera de carril (anti-insinuación §9.1). Una reunión de lobby y un
        voto JAMÁS comparten un <article>/<Card>/<li>. Su propio <h2> + Suspense +
        empty honesto.
      */}
      <section id="lobby" className="mt-12">
        <h2 className="text-xl font-semibold mb-4">Reuniones de lobby</h2>
        <Suspense fallback={<LobbySkeleton />}>
          <LobbySection id={id} searchParams={sp} />
        </Suspense>
      </section>

      {/*
        Phase 12+ APILA aquí sus secciones, cada una su propio bloque:
          <section id="patrimonio" className="mt-12"> <h2>Patrimonio e intereses</h2> …
          <section id="dinero" className="mt-12">     <h2>Contratos y financiamiento</h2> …
        Cada una: su <h2>, su <Suspense>, su empty honesto. NO anidar en otra sección
        y NUNCA componer un dato de otro bloque dentro de la misma unidad de UI.
      */}
    </main>
  );
}

// ── Cabecera (RPC parlamentario_publico, deny-by-default → 404 honesto) ────────
async function HeaderSection({ id }: { id: string }) {
  const sb = createServerSupabase();
  const { data, error } = await sb
    .rpc("parlamentario_publico", { p_id: id })
    .maybeSingle<ParlamentarioPublicoRow>();

  // #34: distinguir "no existe" (→ 404) de un fallo real de DB/red (→ error
  // honesto). `.maybeSingle()` no lanza por 0 filas; un `error` real se propaga.
  if (error) {
    throw new Error(
      `No se pudo leer el parlamentario ${id}: ${error.message}`,
    );
  }
  if (!data) {
    notFound();
  }

  return <ParlamentarioHeader parlamentario={data} />;
}

// ── Skeletons (UI-SPEC §6.2) ───────────────────────────────────────────────────
function ParlamentarioHeaderSkeleton() {
  return (
    <div className="space-y-3" aria-hidden="true">
      <div className="flex gap-2">
        <Skeleton className="h-6 w-24 rounded-full" />
      </div>
      <Skeleton className="h-9 w-3/4" />
      <Skeleton className="h-4 w-48" />
      <Skeleton className="h-4 w-56 mt-4" />
    </div>
  );
}

function VotosSkeleton() {
  return (
    <div className="space-y-4" aria-hidden="true">
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-10 w-full rounded-lg" />
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full rounded-lg" />
      ))}
    </div>
  );
}

// Shape-matched a LobbyView: línea de intro + 3 filas de audiencia (§6.2).
function LobbySkeleton() {
  return (
    <div className="space-y-4" aria-hidden="true">
      <Skeleton className="h-4 w-3/4" />
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full rounded-lg" />
      ))}
    </div>
  );
}
