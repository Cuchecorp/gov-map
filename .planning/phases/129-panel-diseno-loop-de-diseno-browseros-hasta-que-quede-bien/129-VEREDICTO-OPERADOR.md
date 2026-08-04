# Phase 129 — Veredicto del operador (checkpoint D-07)

**Fecha:** 2026-08-04
**Deploy presentado:** `8e0f403e-5806-411c-8289-ec416924058c` — https://observatorio-congreso.thevalis.workers.dev
**Capturas presentadas:** `assets/129-final-landing-full.png`, `129-final-landing-desktop.png`,
`129-final-panel-390.png`, `129-final-comparar.png`

## VEREDICTO: AUSENTE — CIERRE POR DECISIÓN DEL OPERADOR, DEUDA TRANSFERIDA

El operador **NO** emitió el verbatim "queda bien". El veredicto no fue silencio ni ambigüedad:
fue un **rechazo explícito con dirección de trabajo**.

En una segunda ronda del mismo checkpoint, el operador decidió **cerrar la Phase 129 tal como está**
y **transferir el rediseño a una fase propia**, posterior a la Pasada 1.

**SC1 NO se cumplió como está escrito.** El criterio exige "loop iterado hasta veredicto de cierre",
y el veredicto de cierre fue negativo. La fase se cierra por **decisión de alcance del operador**,
no por criterio cumplido. Esta distinción es deliberada: registrar esto como PASS sería un falso
verde, exactamente del tipo que esta fase gastó cuatro rondas de revisión en impedir.

### Transcripción VERBATIM de la respuesta del operador

Pregunta: *"Sobre las capturas del deploy final: ¿queda bien, o abro una iteración de diseño fuera
de presupuesto?"*

> "más iteraciones. debería quedar como dashboard clickeable con imagenes, facil de navegar y cliquear"

### Transcripción VERBATIM — segunda ronda (alcance del rediseño)

Sobre qué deben ser las "imágenes", dado que los retratos están LOCKED por decisión legal:

> "Datos hechos visual" — mini-gráficos con datos que YA existen: barras de votación, distribución
> por cámara, línea de tiempo de tramitación. Cada uno trazable a su fuente.

Sobre el alcance de "clickeable":

> "Tarjeta entera + cada dato" — el tile completo lleva a su vista expandida, y además cada elemento
> interno (proyecto, comisión, sesión, parlamentario) enlaza a su destino.

Sobre dónde ejecutarlo:

> "Fase nueva, después de la Pasada 1"

**Nota:** el operador NO reabrió la decisión legal sobre fotos. Los retratos siguen prohibidos.

### Qué falta para el cierre

1. **Rediseño del panel de portada a "dashboard clickeable con imágenes, fácil de navegar y
   cliquear"** — pedido del operador, verbatim arriba. Excede el presupuesto de 3 iteraciones de
   diseño de esta fase (agotado) y excede el alcance planificado de la 129, que era un loop de
   corrección sobre el diseño existente, no un rediseño. Pendiente de acotar con el operador
   (alcance de "imágenes", profundidad del "clickeable") y de decidir si se ejecuta como iteración
   extra de 129 o como fase nueva.
2. Todo lo demás de la 129 permanece como quedó: SC1/SC2 cerrados con salvedad, SC3 cerrado y no
   acreditable, SC4 cerrado en lo que el SC pide con el aislamiento de M-A abierto.

## Otras decisiones del operador tomadas en el mismo checkpoint

### D-129-A — Captura de 390px: buscar otro instrumento

Pregunta: qué hacer con que la captura móvil salga de un proxy local por la CSP.

> "Buscar otro instrumento"

**Efecto:** la CSP (`frame-ancestors 'none'`, lockdown SEC-02) **NO se toca**. Se abre deuda para
conseguir control de viewport real (Playwright/CDP u otro) y poder capturar 390px contra PROD sin
relajar seguridad. Hasta entonces, toda captura móvil lleva la salvedad "NO es del deploy real".

### D-129-B — Contrato LOCKED #34: enmienda AUTORIZADA

Pregunta: si autoriza enmendar #34 para que un fallo de RPC no tumbe `/comparar` entera.

> "Autorizar la enmienda"

**Efecto:** queda **autorizado** implementar el aislamiento de fallo por eje en `/comparar`: un eje
que falla declara un estado `fallo` **distinto de `vacío`** ("no pudimos cargar este eje") en vez
de propagar la excepción y tumbar la página al boundary raíz. El espíritu de #34 se conserva —
**error ≠ vacío**: un fallo DECLARADO no es una afirmación de ausencia. Se implementa en una fase
futura (hoy diferido D-1); incluye `error.tsx` propio de la ruta, porque hoy el usuario lee
"No pudimos cargar la portada" estando en `/comparar`.

**Nota de trazabilidad:** esta es una enmienda a un contrato LOCKED. El texto de `#34` en
`app/app/comparar/page.tsx:74-76` debe actualizarse citando esta autorización cuando se implemente.

### D-129-C — Rotación B26: diferida por decisión del operador

> "prefiero rotar despues"

**Efecto:** la rotación de la password de la DB queda **pendiente y asumida por el operador**, sin
fecha. No se barren los 49 archivos tracked que aún contienen el project-ref, y no se añade el
guard de CI por ahora. Riesgo aceptado conscientemente. Lo ya hecho se mantiene: el hit de
`07-01-SUMMARY.md` quedó redactado (cero fuerte, sin borrar líneas).

**Recordatorio para el operador:** dos agentes ecoaron la URL con credencial en transcripts
locales durante la corrida (no en el repo; los artefactos quedaron redactados y no hay nada en
commits). Mientras no se rote, esa credencial sigue viva en esos transcripts.
