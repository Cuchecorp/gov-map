/**
 * revisor-cli (ID-05): la COMPUERTA HUMANA del subsistema de identidad asistida.
 * Espeja el patrón de `seed-cli.ts` (entry-point por regex sobre process.argv[1],
 * parse manual de args, service role LOCAL desde env, funciones exportadas testeables
 * con un `RevisionWriter` inyectable).
 *
 * Subcomandos:
 *  - `list`                              → casos `estado='pendiente'` de la cola.
 *  - `show <id>`                         → caso completo (registro + candidatos + salida_modelo).
 *  - `confirm <id> --revisor <quien>`    → resuelve 'confirmado'; PROMUEVE el vínculo a
 *                                          'confirmado' metodo='humano'; audit metodo='humano'.
 *  - `reject <id> --revisor <quien> --motivo <texto>` → resuelve 'rechazado'; audit.
 *  - `correct <id> --revisor <quien> --chosen-id <Pxxxxx>` → resuelve 'corregido'; el vínculo
 *                                          apunta al nuevo id 'confirmado'; audit.
 *
 * INVARIANTES (riesgo existencial #1):
 *  - La promoción a `confirmado` es EXCLUSIVA del humano/determinista (A4/T-04-10): solo
 *    `confirm`/`correct` la producen, NUNCA el pipeline LLM.
 *  - Cada resolución escribe `identidad_audit` metodo='humano' con `revisor_id` + timestamp
 *    (T-04-11, append-only de 04-02).
 *  - Validación de input ANTES de cualquier escritura (V5/T-04-10): `id` numérico y `revisor`
 *    no vacío; `chosen-id` con formato /^P\d{5}$/. Un input inválido NO toca la DB.
 *  - `resolverRevision` solo afecta casos que siguen `pendiente`; si `afectadas===0` (id
 *    inexistente o ya resuelto) se lanza ANTES de escribir vínculo/audit (sin colaterales).
 */

import {
  RevisionWriter,
  type CasoRevisionRow,
  type FilaVinculo,
} from "./writer-revision";

const ID_REGEX = /^P\d{5}$/;

function validarId(id: number): void {
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error(`revisor: id inválido (${id}); debe ser un entero positivo`);
  }
}

function validarRevisor(revisor: string): void {
  if (typeof revisor !== "string" || revisor.trim() === "") {
    throw new Error("revisor: el --revisor no puede estar vacío (trazabilidad ID-05)");
  }
}

function provenanceDesde(caso: CasoRevisionRow): Pick<
  FilaVinculo,
  "origen" | "fecha_captura" | "enlace"
> {
  return {
    origen: caso.camara,
    fecha_captura: caso.created_at ?? new Date().toISOString(),
    enlace: "",
  };
}

/** `list`: casos pendientes de la cola. */
export async function listar(w: RevisionWriter): Promise<CasoRevisionRow[]> {
  return w.listarPendientes();
}

/** `show <id>`: caso completo (registro + candidatos + salida_modelo). */
export async function mostrar(
  w: RevisionWriter,
  id: number,
): Promise<CasoRevisionRow | null> {
  validarId(id);
  return w.obtenerCaso(id);
}

/**
 * `confirm <id> --revisor <quien>`: resuelve 'confirmado' y PROMUEVE el vínculo a
 * 'confirmado' metodo='humano'. El chosen_id sale de la salida del modelo del caso.
 */
export async function confirmar(
  w: RevisionWriter,
  id: number,
  revisor: string,
): Promise<void> {
  validarId(id);
  validarRevisor(revisor);

  const caso = await w.obtenerCaso(id);
  if (caso == null) {
    throw new Error(`revisor: el caso ${id} no existe`);
  }
  if (caso.estado !== "pendiente") {
    throw new Error(`revisor: el caso ${id} no está pendiente (estado=${caso.estado})`);
  }

  const chosenId = chosenIdDeCaso(caso);
  await resolverYAuditar(w, caso, {
    estado: "confirmado",
    revisor,
    decisionAudit: "confirmado",
    parlamentarioId: chosenId,
    promoverVinculo: true,
  });
}

/** `reject <id> --revisor <quien> --motivo <texto>`: resuelve 'rechazado' (no promueve). */
export async function rechazar(
  w: RevisionWriter,
  id: number,
  revisor: string,
  motivo: string,
): Promise<void> {
  validarId(id);
  validarRevisor(revisor);
  if (typeof motivo !== "string" || motivo.trim() === "") {
    throw new Error("revisor: reject requiere un --motivo no vacío");
  }

  const caso = await w.obtenerCaso(id);
  if (caso == null) {
    throw new Error(`revisor: el caso ${id} no existe`);
  }
  if (caso.estado !== "pendiente") {
    throw new Error(`revisor: el caso ${id} no está pendiente (estado=${caso.estado})`);
  }

  await resolverYAuditar(w, caso, {
    estado: "rechazado",
    revisor,
    motivo,
    decisionAudit: "rechazado",
    parlamentarioId: null,
    promoverVinculo: false,
  });
}

/**
 * `correct <id> --revisor <quien> --chosen-id <Pxxxxx>`: resuelve 'corregido' y apunta el
 * vínculo al nuevo id 'confirmado' metodo='humano'. Valida el formato del id ANTES de tocar la DB.
 */
export async function corregir(
  w: RevisionWriter,
  id: number,
  revisor: string,
  chosenId: string,
): Promise<void> {
  validarId(id);
  validarRevisor(revisor);
  if (!ID_REGEX.test(chosenId)) {
    throw new Error(
      `revisor: --chosen-id "${chosenId}" tiene formato inválido (se espera Pxxxxx, /^P\\d{5}$/)`,
    );
  }

  const caso = await w.obtenerCaso(id);
  if (caso == null) {
    throw new Error(`revisor: el caso ${id} no existe`);
  }
  if (caso.estado !== "pendiente") {
    throw new Error(`revisor: el caso ${id} no está pendiente (estado=${caso.estado})`);
  }

  await resolverYAuditar(w, caso, {
    estado: "corregido",
    revisor,
    decisionAudit: "corregido",
    parlamentarioId: chosenId,
    promoverVinculo: true,
  });
}

/** Extrae el chosen_id de la salida del modelo del caso (si la hay y es Pxxxxx). */
function chosenIdDeCaso(caso: CasoRevisionRow): string | null {
  const salida = caso.salida_modelo as { chosen_id?: unknown } | null;
  const cid = salida?.chosen_id;
  return typeof cid === "string" && ID_REGEX.test(cid) ? cid : null;
}

interface ResolverOpts {
  estado: "confirmado" | "rechazado" | "corregido";
  revisor: string;
  motivo?: string;
  decisionAudit: string;
  parlamentarioId: string | null;
  promoverVinculo: boolean;
}

/**
 * Resuelve el caso en la cola (atómico contra `estado='pendiente'`); SOLO si la
 * resolución afectó una fila (afectadas>0) promueve el vínculo (cuando corresponde) y
 * registra el audit humano. Si afectadas===0 (carrera/ya resuelto) lanza SIN colaterales.
 */
async function resolverYAuditar(
  w: RevisionWriter,
  caso: CasoRevisionRow,
  opts: ResolverOpts,
): Promise<void> {
  const resolved_at = new Date().toISOString();
  const { afectadas } = await w.resolverRevision(caso.id, {
    estado: opts.estado,
    revisor_id: opts.revisor,
    motivo: opts.motivo ?? null,
    resolved_at,
  });
  if (afectadas === 0) {
    throw new Error(
      `revisor: el caso ${caso.id} ya no estaba pendiente al resolver (no se escribió nada)`,
    );
  }

  if (opts.promoverVinculo) {
    // A4: la promoción a 'confirmado' es EXCLUSIVA del humano. metodo='humano'.
    const vinculo: FilaVinculo = {
      mencion_nombre: caso.mencion_nombre,
      mencion_normalizada: caso.mencion_normalizada,
      camara: caso.camara,
      periodo: caso.periodo,
      parlamentario_id: opts.parlamentarioId,
      estado: "confirmado",
      metodo: "humano",
      ...provenanceDesde(caso),
    };
    if (caso.vinculo_id != null) vinculo.id = caso.vinculo_id;
    await w.upsertVinculo(vinculo);
  }

  await w.appendAudit({
    vinculo_id: caso.vinculo_id ?? null,
    metodo: "humano",
    decision: opts.decisionAudit,
    confidence: null,
    modelo_version: caso.modelo_version ?? null,
    revisor_id: opts.revisor,
    evidence: [],
    conflicts: opts.motivo ? [opts.motivo] : [],
  });
}

// ── Entry-point CLI: `node revisor-cli.js <sub> <id> [--revisor x] [--motivo y] [--chosen-id Pxxxxx]` ──

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
      "revisor: falta SUPABASE_LOCAL_SERVICE_KEY en el entorno (service role del Supabase LOCAL)",
    );
  }
  const w = new RevisionWriter({ url, serviceKey });

  switch (sub) {
    case "list": {
      const casos = await listar(w);
      for (const c of casos) {
        const cands = c.candidatos.map((x) => `${x.id}:${x.nombre}`).join(", ");
        console.log(`#${c.id} | ${c.mencion_nombre} | ${c.camara}/${c.periodo} | candidatos: ${cands}`);
      }
      console.log(`\n${casos.length} caso(s) pendiente(s).`);
      break;
    }
    case "show": {
      const c = await mostrar(w, id);
      if (c == null) {
        console.log(`revisor: el caso ${id} no existe`);
        break;
      }
      console.log(JSON.stringify(c, null, 2));
      break;
    }
    case "confirm":
      await confirmar(w, id, revisor);
      console.log(`revisor: caso ${id} CONFIRMADO por ${revisor} (vínculo→confirmado).`);
      break;
    case "reject":
      await rechazar(w, id, revisor, motivo);
      console.log(`revisor: caso ${id} RECHAZADO por ${revisor} (motivo: ${motivo}).`);
      break;
    case "correct":
      await corregir(w, id, revisor, chosenId);
      console.log(`revisor: caso ${id} CORREGIDO por ${revisor} → ${chosenId} (vínculo→confirmado).`);
      break;
    default:
      throw new Error(`revisor: subcomando desconocido "${sub}" (list|show|confirm|reject|correct)`);
  }
}

const isMain =
  typeof process !== "undefined" &&
  process.argv[1] != null &&
  /revisor-cli\.(ts|js|mjs|cjs)$/.test(process.argv[1]);
if (isMain) {
  mainCli()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("revisor FALLÓ:", err instanceof Error ? err.message : err);
      process.exit(1);
    });
}
