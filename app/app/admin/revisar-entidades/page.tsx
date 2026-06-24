import { notFound } from "next/navigation";

import { adminRevisionEnabled } from "@/lib/admin-gate";
import { createAdminSupabase } from "@/lib/supabase-admin";

/**
 * /admin/revisar-entidades — la COLA DE REVISIÓN HUMANA protegida del subsistema de identidad de
 * TERCEROS (ENT-04). Es el equivalente web del `revisor-entidad-cli`: lista los casos
 * `revision_entidad` estado='pendiente' y los resuelve (confirmar/rechazar/corregir) vía el RPC
 * atómico `resolver_entidad`. La promoción a `confirmado` es EXCLUSIVA del humano (p_promover=true,
 * metodo='humano'); NINGÚN dudoso se auto-confirma.
 *
 * GATE A NIVEL DE PÁGINA (LOCKED, ORDEN LOAD-BEARING — espejo de /red y /contraparte/[id]):
 *   `if (!adminRevisionEnabled(process.env)) notFound();` — PRIMERA sentencia, ANTES de construir el
 *   cliente service-role, ANTES de cualquier query/heading. Con OFF (default fail-closed) la ruta
 *   ENTERA 404 (sirve not-found.tsx); NO se filtra NINGÚN heading ni DOM de la cola al HTML.
 *
 * La maestra `entidad_tercero` y la cola `revision_entidad` son PII interna deny-by-default — esta
 * superficie JAMÁS debe ser pública. La lectura usa el cliente SERVICE-ROLE (la tabla es
 * deny-by-default a `anon`); el gate va PRIMERO, así el cliente service-role nunca se construye con
 * el gate OFF. `adminRevisionEnabled` es server-only (chokepoint): la ruta enruta su visibilidad
 * SOLO por esa función, nunca leyendo `ADMIN_REVISION_ENABLED` crudo.
 */

const CHOSEN_ID_RE = /^E\d{5}$/;

/** Caso de la cola tal como lo devuelve un SELECT de `revision_entidad`. */
interface CasoRevisionEntidadRow {
  id: number;
  mencion_nombre: string;
  mencion_normalizada: string;
  tipo_entidad: "natural" | "juridica";
  estado: string;
  candidatos: { id: string; nombre: string }[];
  salida_modelo: { chosen_id?: unknown } | null;
  modelo_version: string | null;
}

/**
 * Lee los casos `estado='pendiente'` de la cola vía service-role. Filtra ESTRICTAMENTE por
 * 'pendiente' (la cola admin nunca muestra casos ya resueltos). Un error real de la query se LANZA
 * (no es "sin casos" — distinguir fallo de DB de cola vacía, #34).
 */
export async function listarPendientes(): Promise<CasoRevisionEntidadRow[]> {
  const sb = createAdminSupabase();
  const { data, error } = await sb
    .from("revision_entidad")
    .select("*")
    .eq("estado", "pendiente");
  if (error) {
    throw new Error(`revisar-entidades: listarPendientes falló: ${error.message}`);
  }
  return (data ?? []) as CasoRevisionEntidadRow[];
}

/** Extrae el chosen_id del modelo del caso (si es Exxxxx). */
function chosenIdDeCaso(caso: CasoRevisionEntidadRow): string | null {
  const cid = caso.salida_modelo?.chosen_id;
  return typeof cid === "string" && CHOSEN_ID_RE.test(cid) ? cid : null;
}

export interface ResolverEntidadAdminInput {
  casoId: number;
  accion: "confirmar" | "rechazar" | "corregir";
  revisor: string;
  /** Para confirmar/corregir: la entidad a la que apunta el vínculo (Exxxxx). */
  chosenId?: string;
  /** Para rechazar: el motivo (trazabilidad). */
  motivo?: string;
  /** Discriminador del caso (puebla identidad_audit.tipo_entidad). */
  tipoEntidad?: "natural" | "juridica";
  /** Mención del caso (para el vínculo promovido). */
  mencionNombre?: string;
  mencionNormalizada?: string;
}

/**
 * Resuelve un caso de la cola vía el RPC atómico `resolver_entidad` (UPDATE caso + UPSERT vínculo +
 * INSERT audit en una transacción). PROMOCIÓN SOLO HUMANA: confirmar/corregir promueven el vínculo a
 * `confirmado` metodo='humano' (gate humano LOCKED); rechazar no promueve. RE-CHEQUEA el gate como
 * PRIMERA sentencia: sin la superficie admin habilitada NO se puede promover (404 antes de tocar la
 * DB). Validación de input ANTES de cualquier escritura: revisor no vacío; chosen_id /^E\d{5}$/.
 */
export async function resolverEntidadAdmin(
  input: ResolverEntidadAdminInput,
): Promise<number | null> {
  // GATE re-chequeado en la acción (defensa en profundidad: nunca promover con la superficie OFF).
  if (!adminRevisionEnabled(process.env)) {
    notFound();
  }

  // Validación ANTES de tocar la DB (trazabilidad ENT-04).
  if (typeof input.revisor !== "string" || input.revisor.trim() === "") {
    throw new Error("revisar-entidades: el revisor no puede estar vacío (trazabilidad ENT-04)");
  }

  const promover = input.accion === "confirmar" || input.accion === "corregir";
  const estado =
    input.accion === "confirmar"
      ? "confirmado"
      : input.accion === "corregir"
        ? "corregido"
        : "rechazado";

  let vinculo: Record<string, unknown> | null = null;
  if (promover) {
    const chosenId = input.chosenId ?? "";
    if (!CHOSEN_ID_RE.test(chosenId)) {
      // Un vínculo `confirmado` es un HECHO público y DEBE apuntar a una entidad real (Exxxxx).
      throw new Error(
        `revisar-entidades: chosen-id "${chosenId}" inválido (se espera Exxxxx) — no se puede promover`,
      );
    }
    if (!input.tipoEntidad) {
      throw new Error("revisar-entidades: falta tipoEntidad para promover el vínculo");
    }
    // Gate humano LOCKED: el vínculo confirmado se mintea aquí, metodo='humano'.
    vinculo = {
      mencion_nombre: input.mencionNombre ?? "",
      mencion_normalizada: input.mencionNormalizada ?? "",
      tipo_entidad: input.tipoEntidad,
      entidad_tercero_id: chosenId,
      estado: "confirmado",
      metodo: "humano",
      origen: "revision-admin",
      fecha_captura: new Date().toISOString(),
      enlace: "",
    };
  }

  const sb = createAdminSupabase();
  const { data, error } = await sb.rpc("resolver_entidad", {
    p_caso_id: input.casoId,
    p_estado: estado,
    p_revisor: input.revisor,
    p_motivo: input.motivo ?? null,
    p_resolved_at: new Date().toISOString(),
    p_promover: promover,
    p_vinculo: vinculo,
    p_decision: estado,
    p_modelo_version: null,
    p_tipo_entidad: input.tipoEntidad ?? null,
  });
  if (error) {
    // El RPC lanza si el caso ya no estaba pendiente (carrera) y revierte TODO.
    throw new Error(`revisar-entidades: resolver_entidad falló: ${error.message}`);
  }
  return (data as number | null) ?? null;
}

export default async function RevisarEntidadesPage() {
  // GATE A NIVEL DE PÁGINA — PRIMERA sentencia, antes del cliente service-role / query / heading.
  // OFF (default) → la ruta entera 404; sin filtración del DOM de la cola PII.
  if (!adminRevisionEnabled(process.env)) {
    notFound();
  }

  const casos = await listarPendientes();

  return (
    <main className="max-w-3xl mx-auto px-4 md:px-8 py-8 md:py-16">
      <h1 className="text-xl font-semibold">
        Revisión de identidades de terceros (interno)
      </h1>
      <p className="text-sm text-muted-foreground mt-2">
        Cola de adjudicación humana de la maestra <code>entidad_tercero</code>. Cada promoción a
        &ldquo;confirmado&rdquo; la realiza una persona; ningún caso se confirma automáticamente.
        Superficie interna protegida — no es una página pública.
      </p>

      {casos.length === 0 ? (
        <p className="text-base text-muted-foreground mt-8">
          No hay casos pendientes de revisión.
        </p>
      ) : (
        <ul className="mt-8 space-y-4">
          {casos.map((c) => {
            const chosen = chosenIdDeCaso(c);
            return (
              <li key={c.id} className="border rounded-lg p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{c.mencion_nombre}</span>
                  <span className="text-sm text-muted-foreground">{c.tipo_entidad}</span>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Caso #{c.id} · candidatos:{" "}
                  {c.candidatos.map((x) => `${x.id}:${x.nombre}`).join(", ") || "—"}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Propuesta del modelo: {chosen ?? "sin chosen_id (requiere corregir)"}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
