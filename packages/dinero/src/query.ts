// query — builders de URL puros del REST de ChileCompra (reemplaza el `sparql.ts` de probidad;
// Claude's Discretion). NUNCA hardcodea el ticket: lo recibe como parametro y lo encodea.
//
// Flujo de 2 pasos OBLIGATORIO (la API NO filtra ordenes por RUT):
//   Paso 1: BuscarProveedor?rutempresaproveedor=<RUT>&ticket=<T>  -> { CodigoEmpresa, NombreEmpresa }
//   Paso 2: ordenesdecompra.json?fecha=<ddmmaaaa>&CodigoProveedor=<codigo>&ticket=<T>
//           fecha = UN SOLO DIA -> iterar ventanas de dia (`fechasEntre`).

const BASE = "https://api.mercadopublico.cl/servicios/v1";

/**
 * Enmascara el `ticket` (secreto de operador) en CUALQUIER string que pueda surfacear (mensaje de
 * error, log, console). Reemplaza el valor del query param `ticket=<SECRET>` por `ticket=***` sin
 * tocar el resto de la URL/mensaje. Es la red de seguridad central de CR-01: el ticket NUNCA debe
 * aparecer en un mensaje lanzado, salida de consola o error persistido. Idempotente y null-safe.
 */
export function redactarTicket(s: string): string {
  // `ticket=` seguido de cualquier secuencia de caracteres no separadores de URL/log
  // (hasta `&`, `#`, espacio, comilla o fin de string). Insensible a mayúsculas en la clave.
  return s.replace(/(ticket=)[^&#\s"'`]*/gi, "$1***");
}

/**
 * URL del paso 1: resolver un RUT de empresa a su `CodigoEmpresa`. El RUT viaja tal cual lo da el
 * caller (con puntos+guion+DV); el ticket se encodea. NUNCA interpolar el ticket en logs.
 */
export function urlBuscarProveedor(rut: string, ticket: string): string {
  const q = new URLSearchParams({ rutempresaproveedor: rut, ticket });
  return `${BASE}/Publico/Empresas/BuscarProveedor?${q.toString()}`;
}

/**
 * URL del paso 2: ordenes de compra de un `CodigoProveedor` en UN dia (`ddmmaaaa`). El ticket se
 * encodea. La respuesta `.json` trae `{ Cantidad, Listado }`.
 */
export function urlOrdenesDeCompra(codigoProveedor: string, ddmmaaaa: string, ticket: string): string {
  const q = new URLSearchParams({ fecha: ddmmaaaa, CodigoProveedor: codigoProveedor, ticket });
  return `${BASE}/publico/ordenesdecompra.json?${q.toString()}`;
}

/** Formatea una fecha (UTC) a `ddmmaaaa` (el formato de dia que espera ChileCompra). */
export function ddmmaaaaDe(d: Date): string {
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const aaaa = String(d.getUTCFullYear());
  return `${dd}${mm}${aaaa}`;
}

/**
 * Generador de ventanas de dia entre `desde` y `hasta` (ambos `YYYY-MM-DD`, inclusive), emitiendo
 * cada dia como `ddmmaaaa`. La API pide UN dia por request -> el barrido historico itera estos.
 * Si `desde > hasta` no emite nada (no fabrica). Tope defensivo de 366 dias por llamada para no
 * generar barridos no acotados accidentalmente.
 */
export function* fechasEntre(desde: string, hasta: string, maxDias = 366): Generator<string> {
  const ini = new Date(`${desde}T00:00:00Z`);
  const fin = new Date(`${hasta}T00:00:00Z`);
  if (Number.isNaN(ini.getTime()) || Number.isNaN(fin.getTime())) return;
  let cuenta = 0;
  for (let t = ini.getTime(); t <= fin.getTime() && cuenta < maxDias; t += 86_400_000, cuenta++) {
    yield ddmmaaaaDe(new Date(t));
  }
}
