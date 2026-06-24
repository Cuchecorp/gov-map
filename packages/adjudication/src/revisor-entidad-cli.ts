/**
 * revisor-entidad-cli (ENT-04): la COMPUERTA HUMANA del subsistema de identidad de TERCEROS.
 * ESPEJO de `revisor-cli.ts` (parlamentario) sobre la cola `revision_entidad`, vía
 * `RevisionEntidadWriter.resolverEntidad()` (RPC `resolver_entidad` atómico, con `p_tipo_entidad`).
 *
 * Subcomandos:
 *  - `list`                              → casos `estado='pendiente'` de la cola.
 *  - `show <id>`                         → caso completo (registro + candidatos + salida_modelo).
 *  - `confirm <id> --revisor <quien>`    → resuelve 'confirmado'; PROMUEVE el vínculo a
 *                                          'confirmado' metodo='humano'; audit metodo='humano'.
 *  - `reject <id> --revisor <quien> --motivo <texto>` → resuelve 'rechazado'; audit.
 *  - `correct <id> --revisor <quien> --chosen-id <Exxxxx>` → resuelve 'corregido'; el vínculo
 *                                          apunta al nuevo id 'confirmado'; audit.
 *
 * INVARIANTES (gate humano LOCKED):
 *  - La promoción a `confirmado` es EXCLUSIVA del humano: SOLO `confirm`/`correct` la producen,
 *    NUNCA el pipeline LLM. La promoción mintea `confirmarEntidad(..., "humano")` (FK branded).
 *  - Cada resolución escribe `identidad_audit` metodo='humano' con `revisor_id` + timestamp + tipo_entidad.
 *  - Validación de input ANTES de cualquier escritura: `id` numérico, `revisor` no vacío,
 *    `chosen-id` con formato /^E\d{5}$/. Un input inválido NO toca la DB.
 *  - El RPC `resolver_entidad` es atómico contra `estado='pendiente'`: si ya no está pendiente,
 *    lanza y revierte TODO (sin colaterales).
 */

import { confirmarEntidad } from "@obs/identity";
import {
  RevisionEntidadWriter,
  type CasoRevisionEntidadRow,
  type FilaVinculoEntidad,
  type DecisionAudit,
} from "./writer-revision-entidad";

const ID_REGEX = /^E\d{5}$/;

function validarId(id: number): void {
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error(`revisor-entidad: id inválido (${id}); debe ser un entero positivo`);
  }
}

function validarRevisor(revisor: string): void {
  if (typeof revisor !== "string" || revisor.trim() === "") {
    throw new Error("revisor-entidad: el --revisor no puede estar vacío (trazabilidad ENT-04)");
  }
}

function provenanceDesde(caso: CasoRevisionEntidadRow): Pick<
  FilaVinculoEntidad,
  "origen" | "fecha_captura" | "enlace"
> {
  return {
    origen: "reconciliacion",
    fecha_captura: caso.created_at ?? new Date().toISOString(),
    enlace: "",
  };
}

/** `list`: casos pendientes de la cola. */
export async function listar(w: RevisionEntidadWriter): Promise<CasoRevisionEntidadRow[]> {
  return w.listarPendientes();
}

/** `show <id>`: caso completo (registro + candidatos + salida_modelo). */
export async function mostrar(
  w: RevisionEntidadWriter,
  id: number,
): Promise<CasoRevisionEntidadRow | null> {
  validarId(id);
  return w.obtenerCaso(id);
}

/**
 * `confirm <id> --revisor <quien>`: resuelve 'confirmado' y PROMUEVE el vínculo a 'confirmado'
 * metodo='humano'. El chosen_id sale de la salida del modelo del caso.
 */
export async function confirmar(
  w: RevisionEntidadWriter,
  id: number,
  revisor: string,
): Promise<void> {
  validarId(id);
  validarRevisor(revisor);

  const caso = await w.obtenerCaso(id);
  if (caso == null) {
    throw new Error(`revisor-entidad: el caso ${id} no existe`);
  }
  if (caso.estado !== "pendiente") {
    throw new Error(`revisor-entidad: el caso ${id} no está pendiente (estado=${caso.estado})`);
  }

  const chosenId = chosenIdDeCaso(caso);
  if (chosenId == null) {
    // Un vínculo `confirmado` es un HECHO público y DEBE apuntar a una entidad real. Si el modelo
    // no fijó un chosen_id válido, `confirm` no puede inventar a quién apunta: usar `correct`.
    throw new Error(
      `revisor-entidad: el caso ${id} no tiene chosen_id del modelo; use ` +
        `\`correct ${id} --revisor <quien> --chosen-id Exxxxx\` para fijar a qué entidad apunta`,
    );
  }
  await resolverYAuditar(w, caso, {
    estado: "confirmado",
    revisor,
    decisionAudit: "confirmado",
    entidadTerceroId: chosenId,
    promoverVinculo: true,
  });
}

/** `reject <id> --revisor <quien> --motivo <texto>`: resuelve 'rechazado' (no promueve). */
export async function rechazar(
  w: RevisionEntidadWriter,
  id: number,
  revisor: string,
  motivo: string,
): Promise<void> {
  validarId(id);
  validarRevisor(revisor);
  if (typeof motivo !== "string" || motivo.trim() === "") {
    throw new Error("revisor-entidad: reject requiere un --motivo no vacío");
  }

  const caso = await w.obtenerCaso(id);
  if (caso == null) {
    throw new Error(`revisor-entidad: el caso ${id} no existe`);
  }
  if (caso.estado !== "pendiente") {
    throw new Error(`revisor-entidad: el caso ${id} no está pendiente (estado=${caso.estado})`);
  }

  await resolverYAuditar(w, caso, {
    estado: "rechazado",
    revisor,
    motivo,
    decisionAudit: "rechazado",
    entidadTerceroId: null,
    promoverVinculo: false,
  });
}

/**
 * `correct <id> --revisor <quien> --chosen-id <Exxxxx>`: resuelve 'corregido' y apunta el vínculo
 * al nuevo id 'confirmado' metodo='humano'. Valida el formato del id ANTES de tocar la DB.
 */
export async function corregir(
  w: RevisionEntidadWriter,
  id: number,
  revisor: string,
  chosenId: string,
): Promise<void> {
  validarId(id);
  validarRevisor(revisor);
  if (!ID_REGEX.test(chosenId)) {
    throw new Error(
      `revisor-entidad: --chosen-id "${chosenId}" tiene formato inválido (se espera Exxxxx, /^E\\d{5}$/)`,
    );
  }

  const caso = await w.obtenerCaso(id);
  if (caso == null) {
    throw new Error(`revisor-entidad: el caso ${id} no existe`);
  }
  if (caso.estado !== "pendiente") {
    throw new Error(`revisor-entidad: el caso ${id} no está pendiente (estado=${caso.estado})`);
  }

  await resolverYAuditar(w, caso, {
    estado: "corregido",
    revisor,
    decisionAudit: "corregido",
    entidadTerceroId: chosenId,
    promoverVinculo: true,
  });
}

/** Extrae el chosen_id de la salida del modelo del caso (si la hay y es Exxxxx). */
function chosenIdDeCaso(caso: CasoRevisionEntidadRow): string | null {
  const salida = caso.salida_modelo as { chosen_id?: unknown } | null;
  const cid = salida?.chosen_id;
  return typeof cid === "string" && ID_REGEX.test(cid) ? cid : null;
}

interface ResolverOpts {
  estado: "confirmado" | "rechazado" | "corregido";
  revisor: string;
  motivo?: string;
  decisionAudit: DecisionAudit;
  entidadTerceroId: string | null;
  promoverVinculo: boolean;
}

/**
 * Resuelve el caso en la cola (atómico contra `estado='pendiente'` vía RPC `resolver_entidad`).
 * SOLO en confirm/correct se promueve el vínculo (metodo='humano'); la promoción mintea
 * `confirmarEntidad(..., "humano")` (FK branded — un string crudo no compilaría). Si el caso ya
 * no está pendiente, el RPC lanza y revierte todo SIN colaterales.
 */
async function resolverYAuditar(
  w: RevisionEntidadWriter,
  caso: CasoRevisionEntidadRow,
  opts: ResolverOpts,
): Promise<void> {
  const resolved_at = new Date().toISOString();

  let vinculo: FilaVinculoEntidad | null = null;
  if (opts.promoverVinculo) {
    // Gate humano LOCKED: el enlace confirmado se mintea SOLO aquí, metodo='humano'. El branded
    // type prueba estructuralmente que el FK provino de una promoción legítima.
    const enlace = confirmarEntidad(opts.entidadTerceroId!, "humano");
    vinculo = {
      mencion_nombre: caso.mencion_nombre,
      mencion_normalizada: caso.mencion_normalizada,
      tipo_entidad: caso.tipo_entidad,
      entidad_tercero_id: enlace.entidadTerceroId,
      estado: "confirmado",
      metodo: "humano",
      ...provenanceDesde(caso),
    };
  }

  await w.resolverEntidad({
    casoId: caso.id,
    estado: opts.estado,
    revisor: opts.revisor,
    motivo: opts.motivo ?? null,
    resolvedAt: resolved_at,
    promover: opts.promoverVinculo,
    vinculo,
    decision: opts.decisionAudit,
    modeloVersion: caso.modelo_version ?? null,
    tipoEntidad: caso.tipo_entidad,
  });
}

// ── Entry-point CLI ──

const DEFAULT_LOCAL_URL = "http://127.0.0.1:54421";

function flag(nombre: string): string | undefined {
  const i = process.argv.indexOf(nombre);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function mainCli(): Promise<void> {
  const sub = process.argv[2];
  const idRaw = process.argv[3];
  const id = Number(idRaw);
  const revisor = flag("--revisor") ?? "";
  const motivo = flag("--motivo") ?? "";
  const chosenId = flag("--chosen-id") ?? "";

  const url = process.env.SUPABASE_LOCAL_URL ?? DEFAULT_LOCAL_URL;
  const serviceKey = process.env.SUPABASE_LOCAL_SERVICE_KEY ?? "";
  if (serviceKey === "") {
    throw new Error(
      "revisor-entidad: falta SUPABASE_LOCAL_SERVICE_KEY en el entorno (service role del Supabase LOCAL)",
    );
  }
  const w = new RevisionEntidadWriter({ url, serviceKey });

  switch (sub) {
    case "list": {
      const casos = await listar(w);
      for (const c of casos) {
        const cands = c.candidatos.map((x) => `${x.id}:${x.nombre}`).join(", ");
        console.log(`#${c.id} | ${c.mencion_nombre} | ${c.tipo_entidad} | candidatos: ${cands}`);
      }
      console.log(`\n${casos.length} caso(s) pendiente(s).`);
      break;
    }
    case "show": {
      const c = await mostrar(w, id);
      if (c == null) {
        console.log(`revisor-entidad: el caso ${id} no existe`);
        break;
      }
      console.log(JSON.stringify(c, null, 2));
      break;
    }
    case "confirm":
      await confirmar(w, id, revisor);
      console.log(`revisor-entidad: caso ${id} CONFIRMADO por ${revisor} (vínculo→confirmado).`);
      break;
    case "reject":
      await rechazar(w, id, revisor, motivo);
      console.log(`revisor-entidad: caso ${id} RECHAZADO por ${revisor} (motivo: ${motivo}).`);
      break;
    case "correct":
      await corregir(w, id, revisor, chosenId);
      console.log(`revisor-entidad: caso ${id} CORREGIDO por ${revisor} → ${chosenId} (vínculo→confirmado).`);
      break;
    default:
      throw new Error(`revisor-entidad: subcomando desconocido "${sub}" (list|show|confirm|reject|correct)`);
  }
}

const isMain =
  typeof process !== "undefined" &&
  process.argv[1] != null &&
  /revisor-entidad-cli\.(ts|js|mjs|cjs)$/.test(process.argv[1]);
if (isMain) {
  mainCli()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("revisor-entidad FALLÓ:", err instanceof Error ? err.message : err);
      process.exit(1);
    });
}
