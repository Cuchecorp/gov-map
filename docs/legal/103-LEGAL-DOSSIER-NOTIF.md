---
documento: 103-LEGAL-DOSSIER-NOTIF
alcance: NOTIF (suscripciones a proyectos/parlamentarios + digest diario por email) — Ley 21.719
signoff: approved         # pending | approved | rejected
asesor: "Operador (abogado) — pre-autorización registrada en la invocación de la corrida"
fecha_signoff: "2026-07-26"
metodo_signoff: "Pre-autorización explícita del operador (abogado) en la invocación de la corrida 2026-07-26 — VERBATIM en §9. El agente DOCUMENTA; el operador AUTORIZA."
observaciones: "El flip a PROD (NOTIF_PUBLIC_ENABLED=true, deploy-time env var del Worker) sigue gated por provisión de credenciales (publishable key + dominio verificado Resend + RESEND_API_KEY). Si la provisión no se completa, se ejecuta el Flag-OFF closure (NOTIF-05) del 103-DEPLOY-RUNBOOK §(f): flag OFF, feature parked, cero captura de emails. El sign-off legal es incondicional; la superficie ARCO-P queda dormida hasta el flip."
depende_de: "pre-autorización del operador (registrada); flip = deploy-time env var + provisión de credenciales operador"
nota: "Encender NOTIF_PUBLIC_ENABLED requiere signoff: approved (registrado aquí) Y la provisión de credenciales; el flip NUNCA se commitea (.env.example queda false), es un env var del Worker en deploy."
---

# Phase 103: Compuerta Legal — Suscripciones + digest por email (NOTIF) — Dossier 21.719

## 0. Propósito del documento y naturaleza del sign-off

Este documento estructura la **superficie de riesgo de datos personales** de la primera captura
de dato de usuario del sistema: **la dirección de email** con la que un ciudadano se suscribe a
proyectos de ley y/o parlamentarios para recibir un **digest diario por correo**. A diferencia de
los dossiers anteriores (VSIM/CRUCES/NET/MONEY), que cubrían **datos públicos de funcionarios**,
este dossier cubre **datos personales de terceros (ciudadanos-usuarios)** y por tanto entra de
lleno en el ámbito de la **Ley 21.719** (protección de datos personales, Chile).

**Sobre el sign-off.** El **operador es abogado** y **PRE-AUTORIZÓ** el checkpoint legal de esta
fase en la invocación de la corrida (2026-07-26), verbatim en §9. Por eso el front-matter registra
`signoff: approved`. **La distinción es load-bearing y se declara explícitamente:**

> **El agente DOCUMENTA la superficie de riesgo; el operador (abogado) AUTORIZA.** El agente
> **NO** provee el sign-off por sí mismo, **NO** se auto-firma, **NO** decide que la exposición sea
> lícita. `approved` refleja la autorización **humana** ya emitida por el operador-abogado, no un
> dictamen del agente.

El agente no es asesor legal; este dossier es el registro estructurado que el operador-abogado
autorizó, no un dictamen que el agente emita.

---

## 1. Qué dato se captura, cuándo y con qué base

**Único dato personal capturado:** la **dirección de email** del ciudadano-usuario, más la
**relación de suscripción** (a qué proyecto/parlamentario sigue) y el **registro de consentimiento**
(fecha, versión del texto, método). Cero RUT, cero teléfono, cero dato sensible, cero perfilado.

- **Autenticación:** OTP por email (Supabase Auth, código numérico `{{ .Token }}`) — el email es el
  identificador. La sesión vive server-side (publishable key, separada del service_role; Phase 97
  LOCKED).
- **Suscripción:** tabla `suscripcion` (migración 0069) — `user_id → auth.users` (cascade),
  `tipo ∈ {proyecto, parlamentario}`, `objetivo_id`, `estado`, `created_at`. RLS
  `to authenticated` + `(select auth.uid()) = user_id` deny-by-default: **cada usuario solo ve/toca
  sus propias filas** (pgTAP usuario-A-no-ve-B, dos-user isolation, Plan 02).
- **Consentimiento (registro 21.719):** tabla `consentimiento` (migración 0071) —
  `version_texto`, `metodo` (default `doble_opt_in_email`), `created_at`. **Append-only** (insert +
  select-own, sin delete/update): la baja es un **evento nuevo**, no un borrado — trazabilidad plena
  de qué consintió el usuario y cuándo.
- **Cola de envío (log del digest):** tabla `notificacion_envio` (migración 0070) —
  **service_role-only** (RLS habilitada SIN policy; `authenticated` tiene CERO grant, ni lectura).
  Solo el cron EGRESO la escribe.

---

## 2. Base de licitud — consentimiento (doble opt-in)

**Base legal:** **consentimiento** del titular (Ley 21.719). Se materializa como **doble opt-in**:

1. El usuario inicia sesión por OTP (prueba de control del email).
2. Al pulsar "Seguir" en la ficha de un proyecto/parlamentario, se registra la suscripción en estado
   **no confirmado** y se envía un **email de confirmación** con un token opaco.
3. La suscripción **solo se activa** (`estado='confirmada'`) tras que el usuario haga clic en el
   enlace de confirmación (segundo opt-in). Antes de eso **no se envía digest alguno**.
4. El **acto de consentimiento** queda registrado en `consentimiento`
   (`version_texto` = versión del texto legal mostrado, `metodo='doble_opt_in_email'`, `created_at`).

**Trazabilidad:** `consentimiento` es append-only → siempre existe el registro de **qué versión del
texto** consintió el usuario y **cuándo**. Si el texto legal cambia, la nueva versión genera un nuevo
registro; el histórico no se pierde (requisito 21.719 de demostrar el consentimiento otorgado).

---

## 3. DPA / subencargado — Resend como encargado de tratamiento

El envío del digest usa **Resend** (API de correo). Para entregar el email, el sistema **transfiere
la dirección de email** del usuario a Resend → **Resend es un ENCARGADO / SUBENCARGADO de
tratamiento** (data processor) bajo la Ley 21.719.

**Superficie a validar / documentar (DPA):**

- **Contrato de encargo (DPA):** el operador debe suscribir/confirmar el **Data Processing Agreement**
  de Resend antes de enviar correo real. Resend actúa **solo por instrucción** del responsable
  (Observatorio), únicamente para **entregar** el digest — no para fines propios.
- **Minimización en el egreso:** a Resend solo se le transfiere lo estrictamente necesario para la
  entrega — la **dirección de email** y el **contenido del digest** (hechos públicos ya expuestos en
  el sitio, con fuente/fecha/enlace). **CERO RUT, cero dato sensible.**
- **PII en logs — regla dura (código, Plan 04):** el email **NUNCA** se escribe en crudo en logs, CI
  ni R2. `redactEmail` redacta la dirección en **toda** línea de log del cron EGRESO; el destinatario
  se resuelve server-side (`auth.admin.getUserById`) y **jamás** se loguea crudo. El patrón EGRESO
  (Supabase → Resend) **no** escribe R2 crudo (no es la ingesta de dos etapas).
- **Transferencia internacional:** Resend opera fuera de Chile → el operador debe verificar que la
  transferencia internacional cumpla el estándar de la Ley 21.719 (garantías adecuadas / cláusulas
  del DPA). *A confirmar por el operador-abogado.*
- **Techo de volumen:** hard-cap **100 emails/día** (en código, `enforceCap`) — free tier Resend;
  el excedente se **difiere** al día siguiente (cursor no avanza), nunca se pierde ni se envía de más.

---

## 4. Derechos ARCO-P (acceso, rectificación, cancelación, oposición, portabilidad)

- **Acceso / rectificación:** el **preference center** en `/cuenta` muestra al usuario sus
  suscripciones activas y su estado de consentimiento (lectura RLS-scoped a sus propias filas). El
  email se gestiona vía la sesión OTP (el usuario controla su propio identificador).
- **Cancelación / oposición (baja):** **unsubscribe one-click SIN login** — el footer de cada email
  lleva un enlace de baja con **token opaco** (256-bit, `raw` solo en el enlace, `sha256 hex` en DB;
  no enumerable, no reversible) + header **`List-Unsubscribe` / `List-Unsubscribe-Post: One-Click`**
  (RFC 8058). Un clic da de baja sin fricción. La baja también está disponible en `/cuenta`.
- **La baja es un evento, no un borrado silencioso:** al darse de baja se registra el evento
  (append-only en `consentimiento` / cambio de `estado` en `suscripcion`), preservando la
  trazabilidad de que el usuario ejerció su derecho de oposición y cuándo.
- **Cancelación total / borrado de cuenta:** las tablas de usuario tienen
  `user_id → auth.users ON DELETE CASCADE` → **eliminar la cuenta** (`auth.users`) **borra en
  cascada** suscripciones, consentimientos y cola de envío del usuario. El derecho de cancelación
  total se satisface por el borrado de la cuenta.
- **Portabilidad:** los datos del usuario (suscripciones + consentimiento) son legibles por él mismo
  vía RLS; la exportación estructurada, si el operador la requiere, es trivial sobre las mismas
  tablas RLS-scoped. *Alcance mínimo v10; ampliable.*

---

## 5. Política de retención

- **`consentimiento` (append-only):** se **retiene** como registro de trazabilidad del consentimiento
  otorgado (requisito 21.719 de poder demostrar el consentimiento). No se borra salvo borrado de
  cuenta (cascade). Es el registro probatorio de licitud.
- **`suscripcion`:** vive mientras el usuario esté suscrito; la baja mueve el `estado` (evento), no
  borra la fila de inmediato (trazabilidad). El borrado de cuenta la elimina en cascada.
- **`notificacion_envio` (log/cola del digest):** log operacional del cron EGRESO
  (qué se envió, cuándo, cursor idempotente). **Retención acotada recomendada:** conservar solo lo
  necesario para idempotencia y auditoría operacional (p. ej. purga periódica de filas `enviado`
  antiguas más allá de la ventana de auditoría). El email **no** se almacena en esta tabla en crudo:
  la cola referencia `user_id`/`suscripcion_id`, y el email se resuelve server-side al enviar. *La
  ventana exacta de purga la fija el operador; recomendación: retener el mínimo operacional.*
- **Borrado de cuenta = borrado total:** el `ON DELETE CASCADE` desde `auth.users` garantiza que el
  ejercicio del derecho de cancelación elimina todos los datos de usuario asociados.

---

## 6. Minimización y defensa en profundidad (candados)

- **Candado de DATOS (RLS deny-by-default):** las tres tablas son net-new post-0044
  (`ALTER DEFAULT PRIVILEGES ... REVOKE ALL FROM authenticated`) → CERO grant base a `authenticated`;
  el único grant es el `to authenticated` **allowlisted** (Block D del lockdown-guard) sobre
  `suscripcion`/`consentimiento`, y las policies `(select auth.uid()) = user_id` aíslan por fila.
  `notificacion_envio` es service_role-only (Block E: cero grant a `authenticated`). pgTAP
  usuario-A-no-ve-B **verde contra el schema aplicado** (Plan 05) es la única prueba de que la RLS
  corre de verdad en PROD (Pitfall 6).
- **Candado de PRESENTACIÓN (flag deny-by-default):** `NOTIF_PUBLIC_ENABLED` (server-only,
  `=== "true"`, default `false`, fail-closed) en `app/lib/notif-gate.ts`. Con el flag OFF, el botón
  "Seguir" **NO existe en el DOM** (gate-before-render, `return null` server-side ANTES de cualquier
  RPC); `/cuenta` y las superficies de suscripción están gated OFF → **no se captura ningún email**.
- **Guard anti-flip (Plan 01):** `notif-antiflip-guard` (3 vectores V1/V2/V3 + mutation self-check)
  congela: (1) el chokepoint sigue `=== "true"`; (2) `.env.example` sigue `=false`; (3) ninguna ruta
  lee el env crudo fuera del único chokepoint. **El flip es DEPLOY-TIME (env var del Worker), JAMÁS
  commiteado.** Un commit del agente que relaje el default o meta el flip en `.env.example` rompe CI.
- **Lockdown-guard extendido al rol `authenticated` (Plan 01, NOTIF-02):** primer commit de la fase;
  antes anon/public era ciego a `to authenticated`. Block D = allowlist positiva
  `USER_OWNED_TABLES = {suscripcion, consentimiento}`; Block E = `notificacion_envio` cero grant a
  `authenticated`. Muerde cualquier over-grant fuera de la allowlist.
- **Linter anti-insinuación:** `SUPERFICIES_NOTIF` registrado ANTES del copy (Wave-0). El copy del
  digest declara que **NO es instantáneo** (promesa falsa bajo crons) y **no afirma intención ni
  causalidad** (regla rectora PROJECT.md).

El doble candado (datos + presentación) + guard anti-flip + lockdown authenticated + linter son
defensa en profundidad: aunque el flag se encienda por error, la RLS aísla; aunque un grant se relaje,
el flag oculta la captura; el guard protege el default; el lockdown muerde el over-grant.

---

## 7. Superficie de riesgo para el asesor (preguntas a validar)

> Preparatorio. El operador-abogado ya pre-autorizó (§9); estas preguntas quedan como checklist de
> lo que la autorización cubre.

1. **¿El doble opt-in + registro de consentimiento append-only satisface la base de licitud
   (consentimiento) de la Ley 21.719?** *Cubierto por la pre-autorización.*
2. **¿El DPA de Resend (encargado) + la minimización del egreso (solo email + hechos públicos) +
   la redacción de PII en logs cubren la transferencia a un subencargado internacional?** *A validar
   el DPA firmado y la transferencia internacional antes del envío real.*
3. **¿El unsubscribe one-click login-less (token opaco + List-Unsubscribe) + el borrado en cascada
   satisfacen ARCO-P?** *Cubierto por diseño.*
4. **¿La retención (consentimiento append-only probatorio + purga acotada de la cola) es adecuada?**
   *Ventana de purga a fijar por el operador.*

---

## 8. Evidencia del estado del sistema (código + schema)

- **Schema (Plan 02):** 0069/0070/0071 con RLS deny-by-default; pgTAP dos-user isolation 20/20 verde
  contra scratch DB post-0044-fiel. **Apply a PROD + pgTAP contra el schema aplicado = Plan 05**
  (este plan; evidencia en 103-DEPLOY-RUNBOOK).
- **Superficies (Plan 03):** `/cuenta` OTP + preference center; SeguirButton gated (ausente del DOM
  con flag OFF); confirmar/baja login-less con token opaco noindex; `notif-service.ts` service_role
  dedicado (único acceso user-table service_role sancionado por lockdown vía `NOTIF_SERVICE_TS`).
- **EGRESO (Plan 04):** `@obs/notificaciones` — `computeNovedades` idempotente por cursor,
  `enforceCap` 100/día, `redactEmail` en todo log, envío por `fetch` (cero SDK nuevo), List-Unsubscribe
  one-click, dry-run sin `RESEND_API_KEY`. digest-daily.yml GATED (dispatch-only).
- **Guards (Plan 01):** lockdown authenticated 22/22 + notif-antiflip 20/20.

---

## 9. Sign-off del operador (pre-autorización VERBATIM) y consumo por el gate

**Pre-autorización del operador (abogado), invocación de la corrida 2026-07-26 — VERBATIM:**

> **"autorizo desde ya el checkpoint legal (soy abogado)"**

Con esta pre-autorización, el front-matter registra `signoff: approved`, `fecha_signoff: 2026-07-26`,
`asesor: Operador (abogado)`. **El agente documentó esta superficie; el operador-abogado autorizó.**
El agente no se auto-firma ni emite dictamen: `approved` refleja la autorización humana ya emitida.

### 9.1 Consumo por el gate y condición del flip

- El flip de `NOTIF_PUBLIC_ENABLED` **requiere** `signoff: approved` (registrado aquí) **Y** la
  provisión de credenciales operador (publishable key + dominio verificado Resend + `RESEND_API_KEY`).
- El **sign-off legal es incondicional** (la pre-autorización no está sujeta a la provisión). **Pero**
  si la provisión de credenciales no se completa en esta corrida, se ejecuta el **Flag-OFF closure
  (NOTIF-05)** del `103-DEPLOY-RUNBOOK §(f)`: el flag queda **OFF**, la feature queda **parked**
  (migraciones aplicadas pero inertes, cron dry-run), y **no se captura ni envía ningún email**. La
  superficie ARCO-P queda **dormida** hasta que se complete la provisión y se flipee.
- El flip es **DEPLOY-TIME** (env var del Worker), **JAMÁS** commiteado; `.env.example` queda `false`.

### 9.2 Actos exclusivos del operador (provisión de credenciales)

El agente NO puede ejecutar estos actos; se registran como deuda de operador (detalle en el
103-DEPLOY-RUNBOOK):

1. Crear la publishable key `sb_publishable_…` + confirmar plantilla OTP `{{ .Token }}` +
   `wrangler secret put SUPABASE_PUBLISHABLE_KEY`.
2. Verificar un dominio de envío en Resend + firmar/confirmar el DPA + crear `RESEND_API_KEY` +
   cargarlo como wrangler secret (deploy) y GH secret (cron).
3. Deploy (build OpenNext Docker + wrangler) + flip `NOTIF_PUBLIC_ENABLED=true` (env var del Worker).
4. Evidencia SC2 (curl block de 97-SPIKE-EVIDENCE, PII-redacted).

---

## 10. Checklist de sign-off (registro)

- **Responsable / asesor:** Operador (abogado) — pre-autorización en la invocación de la corrida.
- **Fecha del sign-off (ISO 8601):** 2026-07-26.
- **Alcance cubierto:** NOTIF (suscripciones + digest por email; captura de la dirección de email de
  ciudadanos-usuarios), Ley 21.719.
- **Método:** pre-autorización explícita del operador-abogado (VERBATIM §9). El agente documenta.

**Checklist (cubierto por la pre-autorización):**

- [x] Base de licitud (consentimiento, doble opt-in, registro append-only): documentada.
- [x] DPA / subencargado Resend (minimización del egreso + PII redaction + techo 100/día): documentada;
      *DPA firmado + transferencia internacional a validar antes del envío real (operador).*
- [x] Derechos ARCO-P (unsubscribe one-click login-less + preference center + borrado en cascada):
      documentados.
- [x] Retención (consentimiento probatorio append-only + purga acotada de la cola): documentada;
      *ventana de purga a fijar por el operador.*
- [x] Minimización + defensa en profundidad (RLS deny-by-default, flag deny-by-default, guard
      anti-flip, lockdown authenticated, linter): documentada.
- [x] Decisión de sign-off: **approved** (pre-autorización del operador-abogado, VERBATIM §9).

---

> **Recordatorio final:** el agente **DOCUMENTA** la superficie de riesgo de datos personales; el
> **operador-abogado AUTORIZA** (pre-autorización registrada VERBATIM §9). El agente no se auto-firma
> ni emite dictamen. El flip a PROD es deploy-time + gated por provisión; si la provisión falla, se
> ejecuta el Flag-OFF closure (NOTIF-05) del 103-DEPLOY-RUNBOOK §(f) y la feature queda parked sin
> capturar emails.
