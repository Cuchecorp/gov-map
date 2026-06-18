import { createServerSupabase } from "@/lib/supabase";
import { buscarProyectos } from "@/lib/buscar";
import { sourceLabel, type ProyectoRow } from "@/lib/types";
import { SearchResultCard } from "@/components/search-result-card";

/**
 * ProyectosSimilares — sección kNN de la ficha (UI-SPEC §6.2). Async Server
 * Component. Vecindad SEMÁNTICA sobre el embedding del proyecto actual,
 * EXCLUYENDO el propio (self-exclusion, SEM-05), top ~5, reusando
 * SearchResultCard.
 *
 * Para embeber la consulta se usa el TÍTULO+MATERIA del proyecto como texto
 * (no hay "consulta" del usuario aquí); `buscarProyectos` con `excludeBoletin`
 * delega el kNN al RPC `match_proyectos`. El RPC retorna solo (boletin,
 * similarity); las filas se hidratan desde `proyecto` (público).
 *
 * "Similar" = vecindad semántica, NUNCA "agenda relacionada", "aliado" ni
 * intención inferida (guardarraíl #2). Estado vacío honesto: "Aún no hay …
 * para mostrar" + el matiz de indexación; nunca "no existen".
 */

const TOP_SIMILARES = 5;

export async function ProyectosSimilares({ boletin }: { boletin: string }) {
  const sb = createServerSupabase();

  // Texto base para la consulta: título + materia del proyecto actual.
  const { data: actual } = await sb
    .from("proyecto")
    .select("titulo, materia")
    .eq("boletin", boletin)
    .single<Pick<ProyectoRow, "titulo" | "materia">>();

  const consulta = [actual?.titulo, actual?.materia]
    .filter((p): p is string => !!p && p.trim().length > 0)
    .join(". ");

  // Sin texto base no podemos embeber: estado vacío honesto.
  const vecinos =
    consulta.length > 0
      ? await buscarProyectos(consulta, {
          excludeBoletin: boletin,
          matchCount: TOP_SIMILARES,
        })
      : [];

  if (vecinos.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Aún no hay proyectos similares para mostrar. La similitud se calcula
        sobre los proyectos ya indexados; puede ampliarse a medida que se
        incorporan más.
      </p>
    );
  }

  // Hidratar las filas del proyecto (público) para los boletines vecinos.
  const boletines = vecinos.map((v) => v.boletin);
  const { data: proyectos } = await sb
    .from("proyecto")
    .select("*")
    .in("boletin", boletines);

  const porBoletin = new Map<string, ProyectoRow>(
    ((proyectos as ProyectoRow[]) ?? []).map((p) => [p.boletin, p]),
  );

  // Preservar el orden del kNN (mejor primero); descartar boletines sin fila.
  const ordenados = vecinos
    .map((v) => porBoletin.get(v.boletin))
    .filter((p): p is ProyectoRow => p !== undefined);

  if (ordenados.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Aún no hay proyectos similares para mostrar. La similitud se calcula
        sobre los proyectos ya indexados; puede ampliarse a medida que se
        incorporan más.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {ordenados.map((p) => (
        <SearchResultCard
          key={p.boletin}
          boletin={p.boletin}
          titulo={p.titulo}
          materia={p.materia}
          estado={p.estado}
          camaraOrigen={p.camara_origen}
          provenance={{
            capturedAt: p.fecha_captura ? new Date(p.fecha_captura) : null,
            sourceName: sourceLabel(p.origen),
            sourceUrl: p.enlace ?? null,
          }}
        />
      ))}
    </div>
  );
}
