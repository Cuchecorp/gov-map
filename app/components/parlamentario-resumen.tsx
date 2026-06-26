import { cn } from "@/lib/utils";
import {
  contarCarriles,
  type CarrilEstado,
  type ConteoCarriles,
} from "@/lib/parlamentario-resumen-conteos";
import { crucesPublicEnabled } from "@/lib/cruces-gate";
import { moneyPublicEnabled } from "@/lib/money-gate";

/**
 * Resumen + índice above-fold de la ficha del parlamentario (LEG-02, UI-SPEC §1.1).
 * Se renderiza DESPUÉS de `ParlamentarioHeader` y ANTES del primer carril: un chip
 * por carril PRESENTE con su etiqueta, un conteo/estado HONESTO 3-estado, y un ancla
 * (`href="#<carril>"`) que salta al carril correspondiente.
 *
 * SPLIT pure-view / server-fetch (espejo de `LobbyView`/`LobbySection`):
 *  - `ResumenView({ chips })` es PURA → RTL la testea con fixtures, sin runtime
 *    Supabase. NO lleva `"use client"`.
 *  - `ParlamentarioResumen({ id })` es el Server Component que llama
 *    `contarCarriles(id)` y arma los chips replicando los gates de `page.tsx`.
 *
 * 3-ESTADO HONESTO (ChipConteo): un vacío es un HECHO, no una virtud. `dato` muestra
 * el número; `vacio` (ingestado, cero) muestra "sin registros"; `no_ingerido` muestra
 * "—"; `pendiente` (MONEY OFF) muestra copy honest-state. NUNCA un número fabricado;
 * `vacio`/`no_ingerido`/`pendiente` JAMÁS muestran un dígito.
 *
 * GATES (V4 Access Control, espejo byte-a-byte de page.tsx:103,121,143,170): el chip
 * de cruces existe SOLO si `crucesPublicEnabled(process.env)`; con MONEY ON el chip
 * de dinero, con MONEY OFF el chip honest-state `#financiamiento-pendiente`. El resumen
 * lista SOLO carriles efectivamente presentes en el HTML — nunca un carril ausente.
 */

// ── Chip de conteo: 3-estado honesto, render textual DISTINTO por estado ────────
function ChipConteo({ estado }: { estado: CarrilEstado }) {
  switch (estado.tipo) {
    case "dato":
      return <span className="font-mono tabular-nums">{estado.n}</span>;
    case "vacio":
      // Ingestado, cero registros → HECHO honesto, nunca densidad ni "—".
      return <span className="text-xs">sin registros</span>;
    case "no_ingerido":
      // Aún no ingerido → guion largo, distinto de "ingestado, cero".
      return (
        <span className="font-mono" aria-label="no ingerido todavía">
          —
        </span>
      );
    case "pendiente":
      // MONEY OFF honest-state → nunca un número, nunca silencio.
      return <span className="text-xs italic">pendiente</span>;
  }
}

// ── Vista pura (RTL la testea con fixtures) ──────────────────────────────────────
export interface ResumenChip {
  href: string;
  label: string;
  estado: CarrilEstado;
}

export function ResumenView({ chips }: { chips: ResumenChip[] }) {
  return (
    <nav
      aria-label="Índice de secciones"
      className="mt-6 flex flex-wrap gap-2"
    >
      {chips.map((ch) => (
        <a
          key={ch.href}
          href={ch.href}
          className={cn(
            "inline-flex items-center gap-2 min-h-11 rounded-full border",
            "border-border bg-card px-4 py-1.5 text-sm",
            "text-foreground/90 no-underline",
            "hover:border-[var(--accent-product)] hover:text-[var(--accent-product)]",
            "focus-visible:outline-2 focus-visible:outline-offset-2",
            "focus-visible:outline-[var(--accent-product)]",
          )}
        >
          <span>{ch.label}</span>
          <span className="text-muted-foreground">
            <ChipConteo estado={ch.estado} />
          </span>
        </a>
      ))}
    </nav>
  );
}

/**
 * Construcción PURA de los chips del índice a partir de los conteos + los gates
 * (testeable con `env` inyectado, sin runtime async). ORDEN LOCKED (espejo de
 * page.tsx): votos → lobby → patrimonio → cruces (gated) → MONEY.
 *
 * MONEY ON (WR-01/IN-03): DOS chips, uno por carril presente en el HTML —
 * `#dinero` (Contratos del Estado, `dineroContratos`) y `#financiamiento`
 * (Aportes SERVEL, `dineroAportes`) — para que CADA carril MONEY tenga su propia
 * entrada de índice (regla LEG-02 "un chip por carril presente") y su conteo
 * honesto propio. MONEY OFF: el único chip honest-state `#financiamiento-pendiente`.
 */
export function construirChips(
  c: ConteoCarriles,
  env: Record<string, string | undefined> = process.env,
): ResumenChip[] {
  return [
    { href: "#votos", label: "Votaciones", estado: c.votos },
    { href: "#lobby", label: "Reuniones de lobby", estado: c.lobby },
    {
      href: "#patrimonio",
      label: "Declaraciones de patrimonio",
      estado: c.patrimonio,
    },
    ...(crucesPublicEnabled(env)
      ? [
          {
            href: "#cruces",
            label: "Cruces con sectores",
            estado: c.cruces,
          },
        ]
      : []),
    ...(moneyPublicEnabled(env)
      ? [
          {
            href: "#dinero",
            label: "Contratos del Estado",
            estado: c.dineroContratos,
          },
          {
            href: "#financiamiento",
            label: "Aportes de campaña",
            estado: c.dineroAportes,
          },
        ]
      : [
          {
            href: "#financiamiento-pendiente",
            label: "Financiamiento y contratos",
            estado: { tipo: "pendiente" as const },
          },
        ]),
  ];
}

// ── Server fetch wrapper (igual rol que LobbySection) ────────────────────────────
export async function ParlamentarioResumen({ id }: { id: string }) {
  const c = await contarCarriles(id);
  return <ResumenView chips={construirChips(c)} />;
}
