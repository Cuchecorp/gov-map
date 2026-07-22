import { DetalleColapsable } from "@/components/detalle-colapsable";
import type { ComisionRow } from "@/lib/types";

/**
 * ComisionesDeParlamentario — bloque de comisiones de la bio oficial (BIO-02,
 * 91-UI-SPEC §Component 1). Presentacional PURO (recibe `comisiones` por prop) →
 * server-friendly, sin runtime Supabase. Va bajo el cargo en el header, ANTES del
 * ProvenanceBadge.
 *
 * Formato por comisión: `{nombre} · {tipo} · {cargo}`, con OMISIÓN honesta de las
 * partes ausentes (tipo '' → se omite; cargo null → se omite) — sin "· ·" colgantes.
 *
 * DISCLOSURE: máx 5 visibles; el excedente (>5) va en `DetalleColapsable` (cerrado)
 * para no dominar el header. Vacío (0) → leyenda empty HONESTA (LOCKED): "Sin
 * comisiones registradas para este parlamentario en la fuente." — NUNCA "no
 * participa en comisiones" (un vacío es un HECHO de ingesta, no una virtud).
 *
 * Cero foto, cero PII, cero color partidista.
 */
const MAX_VISIBLE = 5;

function lineaComision(c: ComisionRow): string {
  // Partes presentes-no-vacías en orden LOCKED: nombre · tipo · cargo.
  return [c.nombre, c.tipo.trim() || null, c.cargo?.trim() || null]
    .filter((p): p is string => Boolean(p))
    .join(" · ");
}

function ListaComisiones({ comisiones }: { comisiones: ComisionRow[] }) {
  return (
    <ul className="space-y-1 text-sm">
      {comisiones.map((c, i) => (
        <li key={`${c.nombre}-${i}`} className="text-foreground">
          {lineaComision(c)}
        </li>
      ))}
    </ul>
  );
}

export function ComisionesDeParlamentario({
  comisiones,
}: {
  comisiones: ComisionRow[];
}) {
  if (comisiones.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Sin comisiones registradas para este parlamentario en la fuente.
      </p>
    );
  }

  const visibles = comisiones.slice(0, MAX_VISIBLE);
  const excedente = comisiones.slice(MAX_VISIBLE);

  return (
    <div>
      <h3 className="text-sm font-semibold mb-1">Comisiones</h3>
      <ListaComisiones comisiones={visibles} />
      {excedente.length > 0 && (
        <div className="mt-4">
          <DetalleColapsable
            n={excedente.length}
            triggerLabel={`Ver las ${comisiones.length} comisiones`}
          >
            <ListaComisiones comisiones={excedente} />
          </DetalleColapsable>
        </div>
      )}
    </div>
  );
}
