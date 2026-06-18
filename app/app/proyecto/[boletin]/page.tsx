import { Suspense } from "react";
import { notFound } from "next/navigation";

import { createServerSupabase } from "@/lib/supabase";
import { FichaHeader } from "@/components/ficha-header";
import { TimelineView } from "@/components/timeline-view";
import { VotacionCard } from "@/components/votacion-card";
import { Skeleton } from "@/components/ui/skeleton";
import type {
  ProyectoRow,
  TramitacionEventoRow,
  VotacionRow,
} from "@/lib/types";

// Boletín válido: 3-6 dígitos + sufijo opcional "-NN" (T-05-09, path injection).
const BOLETIN_RE = /^\d{3,6}(-\d{1,2})?$/;

interface PageProps {
  params: Promise<{ boletin: string }>;
}

export default async function ProyectoPage({ params }: PageProps) {
  const { boletin } = await params;

  // Validación del input no confiable del path (T-05-09). `.eq()` de supabase-js
  // ya parametriza, pero rechazamos formatos no-boletín antes de tocar la DB.
  if (!BOLETIN_RE.test(boletin)) {
    notFound();
  }

  return (
    <main className="max-w-3xl mx-auto px-4 md:px-8 py-8 md:py-16">
      <Suspense fallback={<FichaHeaderSkeleton />}>
        <FichaSection boletin={boletin} />
      </Suspense>

      <section id="timeline" className="mt-12">
        <h2 className="text-xl font-semibold mb-4">Tramitación</h2>
        <Suspense fallback={<TimelineSkeleton />}>
          <TimelineSection boletin={boletin} />
        </Suspense>
      </section>

      <section id="votaciones" className="mt-12">
        <h2 className="text-xl font-semibold mb-4">Votaciones</h2>
        <Suspense fallback={<VotacionesSkeleton />}>
          <VotacionesSection boletin={boletin} />
        </Suspense>
      </section>
    </main>
  );
}

// ── Ficha header (proyecto) ──────────────────────────────────────────────────
async function FichaSection({ boletin }: { boletin: string }) {
  const sb = createServerSupabase();
  const { data } = await sb
    .from("proyecto")
    .select("*")
    .eq("boletin", boletin)
    .single<ProyectoRow>();

  // Si el proyecto no existe → 404 (UI-SPEC §6.1 / §6.3).
  if (!data) {
    notFound();
  }

  return <FichaHeader proyecto={data} />;
}

// ── Timeline (tramitacion_evento) ────────────────────────────────────────────
async function TimelineSection({ boletin }: { boletin: string }) {
  const sb = createServerSupabase();
  const { data } = await sb
    .from("tramitacion_evento")
    .select("*")
    .eq("boletin", boletin)
    .order("fecha", { ascending: true });

  return <TimelineView eventos={(data as TramitacionEventoRow[]) ?? []} />;
}

// ── Votaciones (votacion + voto embed) ───────────────────────────────────────
async function VotacionesSection({ boletin }: { boletin: string }) {
  const sb = createServerSupabase();
  const { data } = await sb
    .from("votacion")
    .select("*, voto(*)")
    .eq("boletin", boletin)
    .order("fecha", { ascending: true });

  const votaciones = (data as VotacionRow[]) ?? [];

  if (votaciones.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Este proyecto no tiene votaciones registradas en la legislatura vigente.
      </p>
    );
  }

  return (
    <>
      {votaciones.map((v) => (
        <VotacionCard key={v.id} votacion={v} />
      ))}
    </>
  );
}

// ── Skeletons (UI-SPEC §6.2) ─────────────────────────────────────────────────
function FichaHeaderSkeleton() {
  return (
    <div className="space-y-3" aria-hidden="true">
      <div className="flex gap-2">
        <Skeleton className="h-6 w-24 rounded-full" />
        <Skeleton className="h-6 w-16 rounded-full" />
      </div>
      <Skeleton className="h-9 w-3/4" />
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-4 w-48 mt-4" />
    </div>
  );
}

function TimelineSkeleton() {
  return (
    <div className="space-y-6" aria-hidden="true">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-full" />
        </div>
      ))}
    </div>
  );
}

function VotacionesSkeleton() {
  return (
    <div className="space-y-4" aria-hidden="true">
      <Skeleton className="h-32 w-full rounded-lg" />
      <Skeleton className="h-32 w-full rounded-lg" />
    </div>
  );
}
