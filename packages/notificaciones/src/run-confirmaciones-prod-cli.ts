// run-confirmaciones-prod-cli — entry-point del CRON EGRESO del correo de CONFIRMACIÓN del
// doble opt-in (WR-05). Cierra el loop 21.719: sin este envío ninguna suscripción puede pasar
// de 'pendiente' a 'confirmada' y el digest no tendría a quién enviar.
//
// ██████ PATRÓN EGRESO — NO es la ingesta de dos etapas ██████
// NO toca fuentes gubernamentales: lee suscripciones 'pendiente' (dentro de la ventana de
// confirmación) de la propia DB (service_role) y EMITE el correo de confirmación por Resend.
// Por eso NO hay R2, NO hay rate-limit 2-3s/host, NO hay robots.txt. Las cotas son el hard-cap
// 100/día (enforceCap) + la redacción de PII (redactEmail) en TODO log.
// SIN RESEND_API_KEY ⇒ DRY-RUN (no envía; degrade honesto).
//
// Espeja run-digest-prod-cli.ts en conexión/carga de env (BOM-safe, precedencia process.env,
// Supabase REMOTO service_role, credenciales SOLO de env) y en el fail-loud sin NOTIF_TOKEN_SECRET
// (sin él el link de confirmación saldría muerto).
//
// FLUJO:
//   1. leer suscripciones estado='pendiente' con confirm_expira_at > now() (ventana vigente).
//   2. agrupar por usuario (un correo por usuario con todos sus objetivos pendientes).
//   3. enforceCap(100) — el resto queda para mañana.
//   4. derivar el token CRUDO de confirmación por suscripción (deriveRawToken 'confirm') y
//      componer el link /notificaciones/confirmar?t=<raw>. Un correo por usuario usa el token
//      de UNA de sus suscripciones pendientes; al confirmarla, las demás se re-envían mañana.
//   5. enviar por Resend (dry-run si no hay key). NO se escribe estado: la transición a
//      'confirmada' la hace la landing cuando el usuario hace click (marcarConfirmada).
//
// Uso: tsx packages/notificaciones/src/run-confirmaciones-prod-cli.ts [--dry-run]

import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { deriveRawToken, enforceCap, HARD_CAP_DIARIO, redactEmail } from "./digest";
import { enviarConfirmacion, renderConfirmacion, type EnvioConfig } from "./resend";

const PAGE_SIZE = 1000;

/** Carga `.env` BOM-safe con PRECEDENCIA de process.env (espeja run-digest-prod-cli). */
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

interface PendienteRow {
  id: string;
  user_id: string;
  objetivo_id: string;
  confirm_expira_at: string | null;
}

/**
 * Lee las suscripciones PENDIENTES con ventana de confirmación VIGENTE (confirm_expira_at >
 * now() o NULL = sin ventana). Fail-loud: un error LANZA (el cron sale != 0).
 */
async function leerPendientes(sb: Sb, ahoraIso: string, log: (m: string) => void): Promise<PendienteRow[]> {
  const rows: PendienteRow[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await sb
      .from("suscripcion")
      .select("id,user_id,objetivo_id,confirm_expira_at")
      .eq("estado", "pendiente")
      // Ventana vigente O sin ventana (NULL). `or` de PostgREST: gt|is.
      .or(`confirm_expira_at.gt.${ahoraIso},confirm_expira_at.is.null`)
      .order("id", { ascending: true })
      .range(from, to);
    if (error) throw new Error(`leerPendientes: ${error.message}`);
    const page = (data as unknown as PendienteRow[] | null) ?? [];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }
  log(`confirmaciones-prod: ${rows.length} suscripciones pendientes con ventana vigente`);
  return rows;
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
    log("confirmaciones-prod: sin SUPABASE_API_URL/SECRET_KEY → nada que leer. Salida limpia.");
    return;
  }
  if (!tokenSecret) {
    // WR-05: sin el secreto NO se puede derivar el token crudo del link de confirmación →
    // cada correo saldría con un link muerto. Fail-loud: salir sin enviar.
    log(
      "confirmaciones-prod: falta NOTIF_TOKEN_SECRET → no se pueden derivar links de " +
        "confirmación válidos. Salida sin enviar (evita emitir links muertos).",
    );
    return;
  }
  if (!apiKey) {
    log("confirmaciones-prod: sin RESEND_API_KEY → DRY-RUN (no se envía ningún correo).");
  }

  const sb: Sb = createClient(url, serviceKey, { auth: { persistSession: false } });
  const envioCfg: EnvioConfig = {
    apiKey: dryRunFlag ? undefined : apiKey || undefined,
    baseUrl,
    from,
    log,
  };

  const ahoraIso = new Date().toISOString();
  const pendientes = await leerPendientes(sb, ahoraIso, log);
  if (pendientes.length === 0) {
    log("confirmaciones-prod: sin pendientes vigentes → nada que confirmar. Salida limpia.");
    return;
  }

  // Agrupar por usuario: un correo por usuario. Se usa el token de LA PRIMERA suscripción
  // pendiente del usuario; al confirmarla, sus demás pendientes se re-ofrecen mañana.
  interface Pend {
    userId: string;
    confirmSuscripcionId: string;
    objetivos: string[];
  }
  const porUsuario = new Map<string, Pend>();
  for (const s of pendientes) {
    let p = porUsuario.get(s.user_id);
    if (!p) {
      p = { userId: s.user_id, confirmSuscripcionId: s.id, objetivos: [] };
      porUsuario.set(s.user_id, p);
    }
    p.objetivos.push(s.objetivo_id);
  }

  const usuarios = Array.from(porUsuario.values());
  // Hard-cap 100/día por USUARIO (over-cap queda para mañana).
  const { aEnviar, diferidos } = enforceCap(usuarios);
  if (diferidos.length > 0) {
    log(`confirmaciones-prod: cap ${HARD_CAP_DIARIO}/día → ${aEnviar.length} envíos, ${diferidos.length} diferidos a mañana.`);
  }

  let enviados = 0;
  for (const u of aEnviar) {
    // Resolver el email del usuario vía auth admin (service_role). NUNCA se loguea crudo.
    const { data: userData, error: userErr } = await (
      sb.auth as unknown as {
        admin: { getUserById(id: string): Promise<{ data: { user: { email?: string } | null }; error: unknown }> };
      }
    ).admin.getUserById(u.userId);
    if (userErr || !userData?.user?.email) {
      log(`confirmaciones-prod: usuario ${u.userId.slice(0, 8)}… sin email resoluble → saltado`);
      continue;
    }
    const destinatario = userData.user.email;
    // WR-05: DERIVAR el token CRUDO de confirmación (mismo HMAC que la app usó al suscribir).
    // hashToken(rawConfirm) === el confirm_token_hash guardado → el link
    // /notificaciones/confirmar?t=rawConfirm resuelve la fila y marcarConfirmada la confirma.
    const rawConfirm = deriveRawToken(tokenSecret, "confirm", u.confirmSuscripcionId);
    const confirmUrl = `${baseUrl}/notificaciones/confirmar?t=${rawConfirm}`;
    const { html, text } = renderConfirmacion(u.objetivos, confirmUrl);

    const resultado = await enviarConfirmacion(destinatario, html, text, envioCfg);
    if (resultado.sent) enviados++;
    else if (!resultado.dryRun) {
      log(`confirmaciones-prod: envío no completado (${redactEmail(destinatario)}, status ${resultado.status ?? "?"})`);
    }
  }

  log(`confirmaciones-prod: ${envioCfg.apiKey ? "LIVE" : "DRY-RUN"} — ${enviados} confirmaciones enviadas, ${diferidos.length} diferidas.`);
}

run().catch((err) => {
  console.error("confirmaciones-prod FALLÓ:", err instanceof Error ? err.message : err);
  process.exit(1);
});
