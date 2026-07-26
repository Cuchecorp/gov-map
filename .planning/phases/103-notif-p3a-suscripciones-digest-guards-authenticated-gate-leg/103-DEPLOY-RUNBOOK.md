# 103-DEPLOY-RUNBOOK — NOTIF P3a: apply migraciones + deploy + flip + operator checkpoint (+ Flag-OFF closure)

**Plan:** 103-05 (Wave 4 — cierre de fase)
**Supabase ref:** `bctyygbmqcvizyplktuw` (sa-east-1)
**URL Worker:** https://observatorio-congreso.thevalis.workers.dev
**Autorización de la corrida:** operador (abogado) pre-autorizó el checkpoint legal 21.719 +
el flip de NOTIF (2026-07-26). Apply de 0069/0070/0071 a PROD AUTORIZADO (aditivo, RLS
deny-by-default, guard verde). Ver `docs/legal/103-LEGAL-DOSSIER-NOTIF.md` (`signoff: approved`).

> Runbook REPRODUCIBLE. Espeja 97-DEPLOY-RUNBOOK (deploy) + 72-APPLY-RUNBOOK / 102 (apply psql
> directo, NUNCA `supabase db push`). El flip es DEPLOY-TIME (env var del Worker), JAMÁS commiteado.

---

## Orden de ejecución

```
(a) apply 0069 -> 0070 -> 0071 a PROD (psql --single-transaction, cada una una vez)
(b) pgTAP 0069/0070/0071 contra el schema APLICADO (psql -tA -f) + lockdown-guard
(c) deploy (build OpenNext Docker node:22-slim + wrangler global OAuth)
(d) flip NOTIF_PUBLIC_ENABLED=true (env var del Worker; NO commiteado, NO .env.example)
(e) operator checkpoint (publishable key + OTP template + SC2 curl evidence + Resend domain/API key)
(f) Flag-OFF closure (NOTIF-05 fallback) — SI la provisión (e) NO se completa
```

**Regla de bifurcación:** (a)+(b) son ejecutables por el agente (DB URL en `.env`, apply
autorizado). (c)-(e) dependen de credenciales de operador (publishable key + dominio Resend +
`RESEND_API_KEY`) que el agente NO puede crear. Si CUALQUIERA falta → **§(f) Flag-OFF closure**:
el flag queda OFF, la feature queda parked, y la fase cierra limpio sin capturar emails.

---

## (a) Apply 0069 → 0070 → 0071 a PROD

Orden OBLIGATORIO: `0070` tiene FK `suscripcion_id → suscripcion` → `0069` primero. Cada
migración se aplica **una sola vez** (los `create table` no son re-ejecutables).

```bash
# En git-bash: MSYS_NO_PATHCONV=1 evita el mangling de rutas; PGCLIENTENCODING=UTF8 por tildes.
PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" --single-transaction -f supabase/migrations/0069_suscripcion_rls.sql
PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" --single-transaction -f supabase/migrations/0070_notificacion_envio.sql
PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" --single-transaction -f supabase/migrations/0071_consentimiento.sql
```

**schema_migrations:** cada migración lleva en su cabecera (clon de 0043) el `insert` de su
versión en `supabase_migrations.schema_migrations`. Si el archivo no lo auto-inserta, ejecutar el
`insert` documentado en la cabecera de cada `.sql` tras el apply (una vez).

Notas:
- NUNCA `supabase db push` (drift de `schema_migrations`; el header dice "supabase test db" stale).
- BOM esquivado por los archivos (guardados sin BOM). Si `psql` se queja de BOM, re-guardar UTF-8
  sin BOM.

---

## (b) pgTAP contra el schema APLICADO + lockdown-guard

Correr los tres pgTAP **contra el schema ya aplicado en PROD** (Pitfall 6: es la ÚNICA prueba de
que la RLS corre de verdad en PROD, no solo en scratch):

```bash
PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" -tA -f supabase/tests/0069_suscripcion_rls.test.sql
PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" -tA -f supabase/tests/0070_notificacion_envio.test.sql
PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" -tA -f supabase/tests/0071_consentimiento.test.sql
```

Esperado: cada línea `ok`, **cero `not ok`** (0069 = 6, 0070 = 6, 0071 = 8 → 20/20). Prueba:
- usuario A no ve las filas de B (`(select auth.uid()) = user_id` aísla);
- `authenticated` tiene CERO grant sobre `notificacion_envio` (queue service_role-only);
- anon no tiene select en ninguna.

Guard estático post-apply:
```bash
cd app && pnpm exec vitest run lib/lockdown-guard.test.ts   # 22/22 (Block D allowlist + Block E)
```

---

## (c) Deploy (build OpenNext Docker + wrangler)

Espeja 97-DEPLOY-RUNBOOK §Runbook reproducible (verbatim). Resumen:

1. **Espejar el repo a un path sin locks** (PowerShell, NO git-bash):
   ```powershell
   Remove-Item -Recurse -Force 'C:/Temp/obs-build/node_modules'   # residuo del build anterior
   robocopy 'C:\Users\Carlo\OneDrive - pjud.cl\Documentos\GitHub\Observatorio' 'C:\Temp\obs-build' `
     /MIR /XD node_modules .open-next .next .git .turbo dist coverage /XF *.log /NFL /NDL /NP /R:1 /W:1
   ```
   **Purga del mirror:** borrar `.pnpm-store` del mirror si robocopy lo arrastró (evita locks);
   re-escribir los helper scripts del build dir tras cada `/MIR` (no están en el repo).
2. **Build DENTRO de `node:22-slim`** (NUNCA Windows/alpine — symlink EPERM):
   `corepack prepare pnpm@11` + `pnpm config set dangerouslyAllowAllBuilds true` +
   `pnpm install --frozen-lockfile` + `cd app && pnpm run cf-build`. Exit 0 → `worker.js` emitido.
3. **Deploy dentro del MISMO contenedor**, montando el OAuth del host:
   ```powershell
   docker run --rm `
     -v "C:\Temp\obs-build:/work" `
     -v "C:\Users\Carlo\AppData\Roaming\xdg.config\.wrangler:/root/.config/.wrangler" `
     -w /work node:22-slim `
     bash -lc "chmod +x /work/docker-deploy.sh && /work/docker-deploy.sh"
   ```
   (`docker-deploy.sh`: `export XDG_CONFIG_HOME=/root/.config; WRANGLER_HOME=/root/.config/.wrangler;
   cd /work/app && CI=true pnpm run deploy`).
   GOTCHA: el `wrangler` real es el npm global (`AppData/Roaming/npm/wrangler.cmd`), sombreado por
   un paquete Python en PATH → invocar por ruta absoluta o dentro del contenedor. `MSYS_NO_PATHCONV=1`
   solo si se corre desde git-bash.
4. **Verificación post-deploy (curl):** `/`, `/parlamentarios`, `/agenda`, `/buscar`,
   `/metodologia` → 200 (Camino A intacto). **Confirmar `/spike-auth` AUSENTE** (borrado en Plan 03
   → 404, ya no 500). CSP intacta (`connect-src 'self'`, `object-src 'none'`,
   `frame-ancestors 'none'`). Propagación edge ~10-30 s (500 intermitentes transitorios).

---

## (d) Flip NOTIF_PUBLIC_ENABLED=true (env var del Worker — NO commiteado)

**El flip es DEPLOY-TIME, JAMÁS commiteado.** `.env.example` queda `NOTIF_PUBLIC_ENABLED=false`
(el anti-flip guard V2 lo verifica). Para encender la superficie en el Worker vivo:

```bash
# Como env var / secret del Worker (host, wrangler global OAuth):
wrangler secret put NOTIF_PUBLIC_ENABLED    # valor: true
wrangler secret list                        # confirmar que aparece
```

(o setearlo como `[vars]` del Worker en el dashboard de Cloudflare — NUNCA en `wrangler.jsonc`
commiteado). Tras el flip + propagación: el botón "Seguir" APARECE en el DOM de ambas fichas
(gate-before-render deja de retornar `null`); `/cuenta` OTP queda operativa. **Precondición dura:**
el flip solo tiene sentido si la publishable key + el dominio Resend + `RESEND_API_KEY` están
provistos (§e); si no, ejecutar §(f) y dejar el flag SIN setear.

Verificación del flip:
```bash
cd app && pnpm exec vitest run lib/notif-antiflip-guard.test.ts   # 20/20 — .env.example sigue false
```

---

## (e) Operator checkpoint — provisión de credenciales + SC2 evidence

Estos actos los ejecuta SOLO el operador (el agente NO puede crear keys ni tocar dashboards).
Pasos exactos (mirror 97-DEPLOY-RUNBOOK §"Estado de runtime pendiente" + 97-SPIKE-EVIDENCE §SC2):

1. **Supabase publishable key + OTP template:**
   - Dashboard → Project Settings → API Keys → crear/copiar la **publishable key**
     `sb_publishable_…` (proyecto `bctyygbmqcvizyplktuw`). NO la anon legacy, NO la secret.
   - Auth → Providers → **Email ON**. Email Templates → confirmar que la plantilla OTP renderiza
     `{{ .Token }}` (código numérico), **NO** `{{ .ConfirmationURL }}`.
   - `wrangler secret put SUPABASE_PUBLISHABLE_KEY` + `wrangler secret list`. Valor también en el
     `.env` LOCAL (NUNCA `.env.example`).
2. **Resend domain + API key + DPA:**
   - Verificar un **dominio de envío** en Resend para el `from` (`resumen@<domain>`).
   - Firmar/confirmar el **DPA** de Resend (subencargado 21.719 — ver dossier §3) + validar la
     transferencia internacional ANTES del envío real.
   - Crear `RESEND_API_KEY` (`re_…`); `wrangler secret put RESEND_API_KEY` (deploy) + GH secret
     `RESEND_API_KEY` (cron). Setear `NOTIF_FROM` = `resumen@<domain>`, `NOTIF_BASE_URL` = sitio.
     Valor en `.env` LOCAL.
3. **Deploy** (§c) tras cargar los secrets.
4. **Flip** (§d): `NOTIF_PUBLIC_ENABLED=true` (env var del Worker).
5. **SC2 evidence:** correr el bloque curl de 97-SPIKE-EVIDENCE §Reproducción SC2 (dos-jarras,
   PII-redacted) confirmando `Set-Cookie` + refresh de sesión a través del pipeline OpenNext en el
   deploy vivo.
6. **BrowserOS DOM check:** flag ON ⇒ botón "Seguir" PRESENTE en ficha de proyecto y de
   parlamentario. (Opcional) `workflow_dispatch` verde de `digest-daily` (dry-run aceptable si el
   dominio Resend está pendiente); luego descomentar el `schedule:` (L-V 12:00 UTC) del cron.

**Resume-signal del operador:** "listo" con publishable key cargada + OTP template confirmado +
estado dominio/key Resend + versión de deploy + SC2 evidence + Seguir-present; **O** "flag-off"
nombrando la credencial faltante (→ §f).

---

## (f) Flag-OFF closure (NOTIF-05 fallback) — FIRST-CLASS, EJECUTABLE

**Cuándo se dispara:** la provisión (e) NO se puede completar — falta la **publishable key**, el
**dominio de envío verificado de Resend**, o el **`RESEND_API_KEY`** (RESEARCH Assumptions A2/A6).
En esta corrida esto es lo esperado: `.env` **NO** contiene `SUPABASE_PUBLISHABLE_KEY` ni
`RESEND_API_KEY` (verificado), y son actos exclusivos de operador.

Pasos EJECUTABLES de la clausura Flag-OFF:

**1. El flag QUEDA OFF (deny-by-default se mantiene).**
- **NO** setear el env var `NOTIF_PUBLIC_ENABLED` del Worker (queda ausente ⇒ `=== "true"` es
  `false` ⇒ deny). El botón "Seguir" **NO aparece** en el DOM (gate-before-render retorna `null`).
- `/cuenta` (login OTP) y las superficies de suscripción quedan gated OFF.
- El schema (0069/0070/0071) y el código quedan **shipped e inertes**: **NO se captura ningún dato
  de usuario porque nada está expuesto**. Cero email capturado, cero email enviado.

**2. Feature PARKED, no revertida.**
- Las **migraciones quedan aplicadas** (aditivas, RLS deny-by-default, seguras en reposo — no hay
  superficie que las use hasta el flip).
- El cron `digest-daily` queda **dispatch-only + dry-run** (`RESEND_API_KEY` ausente ⇒ el CLI no
  envía nada; `schedule:` sigue comentado). **NUNCA se recolecta ni envía email.**
- NO se hace `drop`/rollback de nada. Deshacer sería más riesgoso que dejar el schema inerte.

**3. Qué se DOCUMENTA (en este runbook, al cerrar la corrida):**
- **Credencial(es) faltante(s):** en esta corrida — `SUPABASE_PUBLISHABLE_KEY` (ausente en `.env`),
  dominio verificado de Resend (no provisto), `RESEND_API_KEY` (ausente en `.env`).
- **Fecha:** 2026-07-26.
- **Decisión:** el flag se dejó **deliberadamente OFF** per NOTIF-05. **La captura de email NO está
  expuesta en el deploy** (si se llegó a deployar) / no se deployó el flip.

**4. Deuda de operador (entrada para el 103-05-SUMMARY + STATE/MEMORY al cierre):**
- Ítems faltantes exactos: **(i)** publishable key `sb_publishable_…` + OTP template `{{ .Token }}`;
  **(ii)** dominio verificado de Resend + DPA firmado; **(iii)** `RESEND_API_KEY`.
- **Comando único para flipear ON una vez provisto** (tras deploy con los secrets cargados):
  ```bash
  wrangler secret put NOTIF_PUBLIC_ENABLED   # valor: true  -> redeploy/propagación
  ```
  **NINGÚN cambio a `.env.example` es necesario para flipear** (el anti-flip guard debe seguir
  verde; `.env.example` queda `false` por siempre).

**5. Consistencia legal:**
- El dossier `docs/legal/103-LEGAL-DOSSIER-NOTIF.md` mantiene `signoff: approved` — la
  pre-autorización del operador-abogado es **incondicional** (no depende de la provisión).
- Este runbook registra que **el flip NO se ejerció en esta corrida**; las superficies ARCO-P
  (unsubscribe, preference center) quedan **dormidas** hasta que se complete la provisión y se
  flipee. Nada que dar de baja porque nada se capturó.

---

## RESULTADO DE ESTA CORRIDA (registro)

> Completar por el ejecutor tras (a)/(b) y la decisión (e)-vs-(f).

- **(a) Apply a PROD:** _(pendiente de registrar tras el apply — ver 103-05-SUMMARY)_
- **(b) pgTAP contra schema aplicado:** _(pendiente — ok-counts 0069/0070/0071)_
- **(c)-(e) Deploy + flip + provisión:** BLOQUEADO por credenciales de operador ausentes
  (`SUPABASE_PUBLISHABLE_KEY` y `RESEND_API_KEY` NO están en `.env`; dominio Resend no provisto).
- **(f) Flag-OFF closure EJECUTADA:** flag OFF, feature parked (migraciones aplicadas e inertes,
  cron dry-run), cero captura de email. Deuda de operador registrada arriba (§f.4) y en el
  103-05-SUMMARY. Fecha: 2026-07-26.
