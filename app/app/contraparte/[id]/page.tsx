import { Suspense } from "react";
import { notFound } from "next/navigation";

import { createServerSupabase } from "@/lib/supabase";
import { CONTRAPARTE_ID_RE } from "@/lib/buscar";
import { moneyPublicEnabled } from "@/lib/money-gate";
import { ContratosPorContraparteSection } from "@/components/contratos-por-contraparte";
import { AportesPorContraparteSection } from "@/components/aportes-por-contraparte";
import { Skeleton } from "@/components/ui/skeleton";
import type { AgregadoContraparteRpcRow } from "@/lib/types";

/**
 * /contraparte/[id] — la página ciudadana de UNA contraparte persona JURÍDICA
 * (empresa) con sus hechos MONEY agregados (MONEY-05, 16-UI-SPEC §Page Anatomy).
 *
 * Muestra DOS carriles HERMANOS separados por `mt-12` — contratos (ChileCompra) y
 * aportes (SERVEL) — cada fila trazada (ProvenanceBadge + fecha + enlace). REGLA
 * RECTORA DURA ANTI-INSINUACIÓN: la página NO renderiza NINGÚN dato de voto, ni
 * lenguaje causal/afinidad; describe hechos públicos independientes. Una contraparte
 * de dinero y un voto JAMÁS comparten una unidad de UI.
 *
 * GATE A NIVEL DE PÁGINA (LOCKED, ORDEN LOAD-BEARING):
 *   1. `if (!moneyPublicEnabled(process.env)) notFound();` — PRIMERA sentencia,
 *      ANTES de `await params`, ANTES de cualquier RPC/heading. Con OFF (default) la
 *      ruta ENTERA 404 (sirve not-found.tsx); NO se filtra h1 ni heading de carril al
 *      HTML. (Distinto de la ficha, donde el gate envuelve una <section>.)
 *   2. `const { id } = await params;` — params es Promise (Next 16).
 *   3. `if (!CONTRAPARTE_ID_RE.test(id)) notFound();` — valida ANTES de tocar la DB
 *      (V5 / T-16-08). El id es 'c:<rut_proveedor>' / 'd:<donante_nombre>'.
 *
 * La cabecera lee vía el RPC `agregado_por_contraparte` (security definer,
 * jurídica-only); un id no jurídica o inexistente → notFound() (defensa en
 * profundidad sobre el filtro del RPC). `moneyPublicEnabled` es server-only
 * (chokepoint WR-02): NUNCA leer `MONEY_PUBLIC_ENABLED` crudo.
 */

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function ContrapartePage({
  params,
  searchParams,
}: PageProps) {
  // 1. GATE A NIVEL DE PÁGINA — PRIMERA sentencia, antes de params/RPC/heading.
  //    OFF (default) → la ruta entera 404; sin filtración de DOM MONEY.
  if (!moneyPublicEnabled(process.env)) {
    notFound();
  }

  // 2. params es Promise (Next 16) → await.
  const { id } = await params;
  const sp = await searchParams;

  // 3. Validación del id ANTES de tocar la DB (V5 / T-16-08).
  if (!CONTRAPARTE_ID_RE.test(id)) {
    notFound();
  }

  return (
    <main className="max-w-3xl mx-auto px-4 md:px-8 py-8 md:py-16">
      <Suspense fallback={<HeaderSkeleton />}>
        <HeaderSection id={id} />
      </Suspense>

      {/*
        CARRIL CONTRATOS (ChileCompra). SIBLING de #aportes, NUNCA anidado. Sin voto,
        sin lenguaje causal. Su propio <h2> + Suspense + estado honesto.
      */}
      <section id="contratos">
        <h2 className="text-xl font-semibold mb-4">
          Contratos del Estado en que aparece esta empresa
        </h2>
        <Suspense fallback={<LaneSkeleton />}>
          <ContratosPorContraparteSection id={id} searchParams={sp} />
        </Suspense>
      </section>

      {/*
        CARRIL APORTES (SERVEL). SIBLING de #contratos, NUNCA anidado: el `mt-12` ES
        la frontera de carril anti-insinuación (16-UI-SPEC §9.1 / Page Anatomy). Una
        contraparte de dinero y un voto JAMÁS comparten una unidad de UI; esta página
        no tiene carril de voto en absoluto.
      */}
      <section id="aportes" className="mt-12">
        <h2 className="text-xl font-semibold mb-4">
          Aportes de campaña registrados a nombre de esta empresa
        </h2>
        <Suspense fallback={<LaneSkeleton />}>
          <AportesPorContraparteSection id={id} searchParams={sp} />
        </Suspense>
      </section>
    </main>
  );
}

// ── Cabecera (RPC agregado_por_contraparte; jurídica-only → 404 honesto) ─────────
// Exportada para RTL: prueba por comportamiento la defensa en profundidad (id
// desconocido → 404; tipo_persona no jurídica → 404), no solo por convención.
export async function HeaderSection({ id }: { id: string }) {
  const sb = createServerSupabase();
  const { data, error } = await sb.rpc("agregado_por_contraparte", { p_id: id });

  // #34: distinguir "no existe" (→ 404) de un fallo real de DB/red (→ error honesto).
  if (error) {
    throw new Error(
      `agregado_por_contraparte falló para ${id}: ${error.message}`,
    );
  }

  const agregados = (data as AgregadoContraparteRpcRow[] | null) ?? [];
  const fila = agregados[0] ?? null;

  // Id desconocido (sin fila para esta contraparte) → 404 honesto.
  if (!fila) {
    notFound();
  }

  // Defensa en profundidad sobre el filtro jurídica del RPC: una persona natural
  // NUNCA se renderiza por nombre, aunque de algún modo resolviera (T-16-07).
  const tipoPersona = (fila.tipo_persona ?? "").toLowerCase();
  if (!tipoPersona.includes("jur")) {
    notFound();
  }

  const nombre = fila.contraparte_nombre ?? "Empresa no publicada";

  return (
    <header className="mb-12">
      <div className="flex gap-2 mb-3">
        <span className="inline-flex items-center px-2.5 py-1 rounded-full border text-sm text-muted-foreground">
          Persona jurídica
        </span>
      </div>
      <h1 className="text-xl font-semibold">{nombre}</h1>
      <p className="text-sm text-muted-foreground mt-2">
        Entidad que contrata con el Estado o financia campañas — actividad pública
        fiscalizable. Se muestran hechos públicos independientes, con su fuente, sin
        juicio.
      </p>
    </header>
  );
}

// ── Skeletons (16-UI-SPEC §Loading) ──────────────────────────────────────────────
function HeaderSkeleton() {
  return (
    <div className="space-y-3 mb-12" aria-hidden="true">
      <Skeleton className="h-6 w-32 rounded-full" />
      <Skeleton className="h-7 w-3/4" />
      <Skeleton className="h-4 w-full mt-2" />
    </div>
  );
}

// Shape-matched a las Views de carril: línea de intro + atribución + 3 filas.
function LaneSkeleton() {
  return (
    <div className="space-y-4" aria-hidden="true">
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-3 w-1/2" />
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full rounded-lg" />
      ))}
    </div>
  );
}
