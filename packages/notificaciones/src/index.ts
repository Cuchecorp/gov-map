// @obs/notificaciones — patrón EGRESO (NOTIF-03/04): drena la cola notificacion_envio,
// computa novedades por suscripción vía cursor idempotente y envía el digest diario por
// Resend (fetch, hard-cap 100/día, PII redactada). NO es la ingesta de dos etapas:
// no hay fuente, no hay R2, no hay rate-limit gubernamental (ver digest.ts header).
export {
  computeNovedades,
  deriveRawToken,
  deriveUserBajaToken,
  filtrarConNovedades,
  redactEmail,
  nuevoCursor,
  enforceCap,
  notaSinNovedades,
  HARD_CAP_DIARIO,
  type DbLike,
  type QueryLike,
  type Suscripcion,
  type NovedadEvento,
  type PendingUser,
  type TokenPurpose,
} from "./digest";

export {
  enviarDigest,
  enviarConfirmacion,
  renderDigest,
  renderConfirmacion,
  type ResultadoEnvio,
  type GrupoDigest,
  type EnvioConfig,
} from "./resend";
