import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  formatWeekLabel,
  prevISOWeek,
  nextISOWeek,
  semanaIsoKey,
  type ISOWeek,
} from "@/lib/week-utils";

/**
 * WeekNav — navegación entre semanas ISO (UI-SPEC §3). Server Component: dos
 * `<Link>` (prev/next) que actualizan el query param `semana`; la página
 * re-renderiza server-side. Sin "use client", sin JS de cliente. Los enlaces
 * llevan `aria-label` explícito; la etiqueta central muestra el rango de la
 * semana en es-CL.
 */
export function WeekNav({ year, week }: ISOWeek) {
  const prev = prevISOWeek({ year, week });
  const next = nextISOWeek({ year, week });

  return (
    <nav
      className="flex items-center justify-between gap-4 py-3 border-b border-border"
      aria-label="Navegación por semana"
    >
      <Button variant="ghost" asChild>
        <Link
          href={`/agenda?semana=${semanaIsoKey(prev.year, prev.week)}`}
          aria-label="Semana anterior"
        >
          ← semana anterior
        </Link>
      </Button>
      <span className="text-base font-semibold text-center">
        {formatWeekLabel(year, week)}
      </span>
      <Button variant="ghost" asChild>
        <Link
          href={`/agenda?semana=${semanaIsoKey(next.year, next.week)}`}
          aria-label="Semana siguiente"
        >
          semana siguiente →
        </Link>
      </Button>
    </nav>
  );
}
