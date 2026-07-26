// run-digest-prod-cli — entry-point del CRON EGRESO (GH Actions L-V) del digest diario.
//
// ██████ PATRÓN EGRESO — NO es la ingesta de dos etapas ██████
// NO toca fuentes gubernamentales: lee suscripciones confirmadas + novedades de la propia
// DB (service_role) y EMITE el digest por Resend. Por eso NO hay R2, NO hay rate-limit
// 2-3s/host, NO hay robots.txt — la regla de dos etapas de CLAUDE.md NO aplica. La ÚNICA
// cota es el hard-cap 100/día (enforceCap) + la redacción de PII (redactEmail) en todo log.
// SIN RESEND_API_KEY ⇒ DRY-RUN (no envía; degrade honesto).
//
// Espeja `run-actualidad-prod-cli.ts` en la conexión/carga de env: `.env` BOM-safe con
// precedencia de process.env (CI inyecta secrets ahí), Supabase REMOTO
// (SUPABASE_API_URL + SUPABASE_SECRET_KEY = service_role), credenciales SOLO de env.
//
// FLUJO por (usuario, suscripción confirmada):
//   1. leer cursor `ultimo_evento_visto` de notificacion_envio (0 si primer envío).
//   2. computeNovedades(suscripcion, cursor) — idempotente (solo id > cursor).
//   3. enforceCap(100) — el resto queda en cola para mañana (cursor SIN avanzar).
//   4. enviarDigest por Resend (dry-run si no hay key).
//   5. SOLO en envío exitoso: upsert notificacion_envio (estado='enviado', enviado_at,
//      ultimo_evento_visto = nuevoCursor) — el cursor avanza ATÓMICAMENTE. Si falla, no.
//
// Uso: tsx packages/notificaciones/src/run-digest-prod-cli.ts [--dry-run]

import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import {
  computeNovedades,
  deriveUserBajaToken,
  enforceCap,
  filtrarConNovedades,
  HARD_CAP_DIARIO,
  nuevoCursor,
  redactEmail,
  type Suscripcion,
  type NovedadEvento,
  type DbLike,
} from "./digest";
import { enviarDigest, renderDigest, type GrupoDigest, type EnvioConfig } from "./resend";

const PAGE_SIZE = 1000;

/** Carga `.env` BOM-safe con PRECEDENCIA de process.env (espeja run-actualidad-prod-cli). */
function loadEnv(root: string): Record<string, string> {
  const out: Record<string, string> = {};
  try {
    const raw = readFileSync(join(root, ".env"), "utf8").replace(/^﻿/, "");
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
      if (m) out[m[1]!] = m[2]!.trim().replace(/^['"]|['"]$/g, "");
    }
  } catch {
    // Sin `.env` (CI): los secrets vienen de process.env.
  }
  for (const k of [
    "SUPABASE_API_URL",
    "SUPABASE_SECRET_KEY",
    "SUPABASE_URL",
    "RESEND_API_KEY",
    "NOTIF_BASE_URL",
    "NOTIF_FROM",
    "NOTIF_TOKEN_SECRET",
  ]) {
    if (process.env[k]) out[k] = process.env[k]!;
  }
  return out;
}

function findWorkspaceRoot(start: string): string {
  let dir = start;
  for (let i = 0; i < 20; i++) {
    if (existsSync(join(dir, "pnpm-workspace.yaml"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return start;
}

type Sb = ReturnType<typeof createClient>;

interface SuscripcionRow {
  id: string;
  user_id: string;
  tipo: "proyecto" | "parlamentario";
  objetivo_id: string;
  // CR-01: el token crudo de baja se DERIVA de (secret + id) en el envío; el hash
  // guardado NO se lee para el link (ponerlo doble-hasheaba y mataba el unsubscribe).
}

/**
 * Lee las suscripciones CONFIRMADAS (estado='confirmada') paginado. El cron solo resume lo
 * confirmado por doble opt-in (21.719). Fail-loud: un error LANZA (el cron sale != 0).
 */
async function leerConfirmadas(sb: Sb, log: (m: string) => void): Promise<SuscripcionRow[]> {
  const rows: SuscripcionRow[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await sb
      .from("suscripcion")
      .select("id,user_id,tipo,objetivo_id")
      .eq("estado", "confirmada")
      .order("id", { ascending: true })
      .range(from, to);
    if (error) throw new Error(`leerConfirmadas: ${error.message}`);
    const page = (data as unknown as SuscripcionRow[] | null) ?? [];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }
  log(`digest-prod: ${rows.length} suscripciones confirmadas`);
  return rows;
}

/** Lee el cursor `ultimo_evento_visto` de la última fila enviada para (user, suscripción). */
async function leerCursor(sb: Sb, userId: string, suscripcionId: string): Promise<number> {
  const { data, error } = await sb
    .from("notificacion_envio")
    .select("ultimo_evento_visto")
    .eq("user_id", userId)
    .eq("suscripcion_id", suscripcionId)
    .eq("estado", "enviado")
    .order("enviado_at", { ascending: false })
    .range(0, 0);
  if (error) throw new Error(`leerCursor: ${error.message}`);
  const row = ((data as unknown as { ultimo_evento_visto: string | null }[] | null) ?? [])[0];
  const raw = row?.ultimo_evento_visto;
  const n = raw != null ? Number(raw) : 0;
  return Number.isFinite(n) ? n : 0;
}

async function run(): Promise<void> {
  const root = findWorkspaceRoot(process.cwd());
  const env = loadEnv(root);
  const log = (m: string) => console.log(m);

  const dryRunFlag = process.argv.includes("--dry-run");
  const url = env.SUPABASE_API_URL || env.SUPABASE_URL || "";
  const serviceKey = env.SUPABASE_SECRET_KEY || "";
  const apiKey = env.RESEND_API_KEY || "";
  const baseUrl = env.NOTIF_BASE_URL || "https://observatorio.example";
  const from = env.NOTIF_FROM || "Observatorio del Congreso 360 <resumen@dominio-verificado>";
  const tokenSecret = env.NOTIF_TOKEN_SECRET || "";

  if (!url || !serviceKey) {
    log("digest-prod: sin SUPABASE_API_URL/SECRET_KEY → nada que leer. Salida limpia.");
    return;
  }
  if (!tokenSecret) {
    // CR-01: sin el secreto NO se puede derivar el token crudo del link de baja → cada
    // link de unsubscribe saldría muerto (violación 21.719 one-click). Fail-loud: salir
    // sin enviar antes que emitir correos con links inservibles.
    log(
      "digest-prod: falta NOTIF_TOKEN_SECRET → no se pueden derivar links de baja válidos. " +
        "Salida sin enviar (evita emitir unsubscribe muerto).",
    );
    return;
  }
  if (!apiKey) {
    log("digest-prod: sin RESEND_API_KEY → DRY-RUN (no se envía ningún correo).");
  }

  const sb: Sb = createClient(url, serviceKey, { auth: { persistSession: false } });
  const envioCfg: EnvioConfig = {
    apiKey: dryRunFlag ? undefined : apiKey || undefined,
    baseUrl,
    from,
    log,
  };

  // 1. suscripciones confirmadas.
  const confirmadas = await leerConfirmadas(sb, log);
  if (confirmadas.length === 0) {
    log("digest-prod: sin suscripciones confirmadas → nada que enviar. Salida limpia.");
    return;
  }

  // 2. computar novedades por suscripción (idempotente por cursor). Agrupar por usuario:
  //    un solo correo por usuario con todos sus grupos.
  interface Pend {
    userId: string;
    grupos: { suscripcionId: string; objetivo: string; nov: NovedadEvento[]; nuevoCur: number }[];
    // CR-03: el link de baja del digest se deriva del USER_ID (no de una suscripción). El
    // digest es UN correo por usuario que agrega TODAS sus suscripciones → el one-click
    // unsubscribe debe detener el correo ENTERO. deriveUserBajaToken(secret, userId) produce
    // un token auto-autenticante (firma HMAC verificable en la landing SIN lookup en DB).
  }
  const porUsuario = new Map<string, Pend>();
  for (const s of confirmadas) {
    const cursor = await leerCursor(sb, s.user_id, s.id);
    const sus: Suscripcion = { tipo: s.tipo, objetivo_id: s.objetivo_id };
    // El cliente supabase-js real tipa su query-builder de forma más rica que DbLike
    // (subconjunto estructural que este motor necesita); el cast aísla ese subconjunto
    // (mismo idiom `as unknown` que run-actualidad-prod-cli usa para el insert).
    const nov = await computeNovedades(sus, cursor, sb as unknown as DbLike);
    let p = porUsuario.get(s.user_id);
    if (!p) {
      p = { userId: s.user_id, grupos: [] };
      porUsuario.set(s.user_id, p);
    }
    p.grupos.push({
      suscripcionId: s.id,
      objetivo: s.objetivo_id,
      nov,
      nuevoCur: nuevoCursor(nov, cursor),
    });
  }

  // 2b. WR-03: NO enviar digests vacíos. Un usuario cuyos TODOS los grupos tienen cero
  //     novedades no recibe correo — así no se quema un slot del hard-cap 100/día en un
  //     mail sin contenido (que además daña reputación anti-spam) y los usuarios CON
  //     novedades reales no quedan hambrientos detrás de envíos vacíos. La "nota sin
  //     novedades" queda SOLO para grupos vacíos de un usuario que SÍ tiene ≥1 grupo con
  //     novedades. Su cursor no avanza (no hubo envío) → si mañana hay novedades, se envía.
  const todos = Array.from(porUsuario.values());
  const usuarios = filtrarConNovedades(todos);
  const vacios = todos.length - usuarios.length;
  if (vacios > 0) {
    log(`digest-prod: ${vacios} usuario(s) sin novedades → NO se envía correo (cap y reputación preservados).`);
  }
  if (usuarios.length === 0) {
    log("digest-prod: ningún usuario con novedades → nada que enviar. Salida limpia.");
    return;
  }

  // 3. hard-cap 100/día por USUARIO (over-cap queda en cola para mañana).
  const { aEnviar, diferidos } = enforceCap(usuarios);
  if (diferidos.length > 0) {
    log(`digest-prod: cap ${HARD_CAP_DIARIO}/día → ${aEnviar.length} envíos, ${diferidos.length} diferidos a mañana (cursor sin avanzar).`);
  }

  const fecha = new Date().toISOString().slice(0, 10);
  let enviados = 0;

  for (const u of aEnviar) {
    // 4. render + envío (dry-run si no hay key). El email del usuario lo trae GoTrue por id;
    //    aquí resolvemos el destinatario vía auth admin (service_role). NUNCA se loguea crudo.
    const { data: userData, error: userErr } = await (
      sb.auth as unknown as {
        admin: { getUserById(id: string): Promise<{ data: { user: { email?: string } | null }; error: unknown }> };
      }
    ).admin.getUserById(u.userId);
    if (userErr || !userData?.user?.email) {
      log(`digest-prod: usuario ${u.userId.slice(0, 8)}… sin email resoluble → saltado`);
      continue;
    }
    const destinatario = userData.user.email;
    const grupos: GrupoDigest[] = u.grupos.map((g) => ({ objetivo: g.objetivo, novedades: g.nov }));
    // CR-03: DERIVAR el token de baja A NIVEL USUARIO (no por-suscripción). El digest agrega
    // todas las suscripciones del usuario en UN correo → el one-click unsubscribe (footer +
    // List-Unsubscribe header) debe detener el correo ENTERO. deriveUserBajaToken produce un
    // token auto-autenticante base64url(`${userId}:${HMAC(secret,'baja-user:'+userId)}`) que la
    // landing verifica por firma y usa para borrar TODAS las suscripciones del user (21.719).
    const rawBaja = deriveUserBajaToken(tokenSecret, u.userId);
    const { html, text } = renderDigest(grupos, fecha, baseUrl, rawBaja);

    const resultado = await enviarDigest(
      destinatario,
      `Tu resumen del Congreso · ${fecha}`,
      html,
      text,
      rawBaja,
      envioCfg,
    );

    // 5. avanzar cursor ATÓMICAMENTE SOLO en envío exitoso (dry-run NO escribe).
    if (resultado.sent) {
      for (const g of u.grupos) {
        const { error: insErr } = await sb.from("notificacion_envio").insert({
          user_id: u.userId,
          suscripcion_id: g.suscripcionId,
          ultimo_evento_visto: String(g.nuevoCur),
          enviado_at: new Date().toISOString(),
          estado: "enviado",
        } as unknown as never);
        // WR-04: el índice único parcial (0072) garantiza a lo más UN 'enviado'/día por
        // (user, suscripción). Un re-despacho del cron el mismo día choca con 23505
        // (unique_violation) → NO es un fallo: la fila del día YA está registrada
        // (idempotente por construcción, no solo por lectura). Se tolera y se continúa;
        // cualquier otro error SÍ es fatal (fail-loud).
        const code = (insErr as { code?: string } | null)?.code;
        if (insErr && code !== "23505") {
          throw new Error(`digest-prod: registrar envío: ${insErr.message}`);
        }
      }
      enviados++;
    } else if (!resultado.dryRun) {
      // Envío fallido reintentable: registrar 'error' sin avanzar cursor (próximo run reintenta).
      log(`digest-prod: envío no completado (${redactEmail(destinatario)}, status ${resultado.status ?? "?"}) → cursor sin avanzar`);
    }
  }

  log(`digest-prod: ${envioCfg.apiKey ? "LIVE" : "DRY-RUN"} — ${enviados} correos enviados, ${diferidos.length} diferidos.`);
}

run().catch((err) => {
  console.error("digest-prod FALLÓ:", err instanceof Error ? err.message : err);
  process.exit(1);
});
