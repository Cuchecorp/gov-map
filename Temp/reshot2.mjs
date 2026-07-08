#!/usr/bin/env node
// reshot2.mjs — screenshot helper con iframe SAME-ORIGIN (Phase 38 Plan 03).
//
// Evidencia demo de la superficie de cruces en la ficha de proyecto. El harness
// es una página BrowserOS ya navegada a PROD (misma origin): un iframe same-origin
// es in-process y rasteriza COMPLETO en fullPage — a diferencia del iframe
// cross-origin de un harness file:// que solo pinta el viewport del padre (~772px,
// clipping OOPIF documentado en 54-05). Ese fue el fix del set de demo de F54.
//
// DEMO boletines (38-RESEARCH §3, verificado psql PROD):
//   /proyecto/14309-04  → 47 parlamentarios / 144 reuniones POST-APPLY (demo con filas)
//   /proyecto/14782-13  → 0 filas (sin proyecto_ficha → sin sector) = empty honesto
//   PRE-APPLY (RPC 0049 ausente): AMBOS → sección cruces degrada honesto
//     (CrucesSection → null por PGRST202; el <section id="cruces"> wrapper persiste
//      como frontier gated por crucesPublicEnabled ON; heading/filas ausentes; 200).
//
// Usage: node Temp/reshot2.mjs <pageId> <outPath> <route> [waitMs] [maxH]
//   <pageId>  id de la página harness BrowserOS (new_hidden_page a PROD; misma origin)
//   <outPath> ruta de salida absoluta (forward-slashes), p.ej. Temp/cruces-14309-preapply.png
//   <route>   ruta relativa a PROD, p.ej. "/proyecto/14309-04" (resuelve same-origin)
// En git-bash usar MSYS_NO_PATHCONV=1 para que la ruta "/proyecto/..." no se mangle.

const MCP = process.env.BROS_MCP_URL || "http://127.0.0.1:9200/mcp";
const BASE = process.env.PROD_BASE || "https://observatorio-congreso.thevalis.workers.dev";

const [, , pageStr, outPath, route, waitStr, maxHStr] = process.argv;
if (!pageStr || !outPath || !route) {
  console.error("uso: reshot2.mjs <pageId> <outPath> <route> [waitMs] [maxH]");
  console.error("demo: /proyecto/14309-04 (filas post-apply) · /proyecto/14782-13 (empty honesto)");
  process.exit(1);
}
const page = Number(pageStr);
const waitMs = Number(waitStr || 9000);
const maxH = Number(maxHStr || 12000);
// route relativa → same-origin src (resuelve contra la origin del harness PROD);
// route absoluta same-origin también válida. BASE queda documentado para claridad.
const src = /^https?:\/\//.test(route) ? route : BASE + route;

async function rpc(method, params) {
  const res = await fetch(MCP, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
    body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method, params }),
  });
  const text = await res.text();
  const dataLine = text.split("\n").find((l) => l.startsWith("data: "));
  const payload = dataLine ? dataLine.slice(6) : text;
  let parsed;
  try {
    parsed = JSON.parse(payload);
  } catch {
    throw new Error(`MCP: respuesta no parseable: ${text.slice(0, 200)}`);
  }
  if (parsed.error) throw new Error(`MCP error: ${JSON.stringify(parsed.error)}`);
  return parsed.result;
}
const callTool = async (name, args) => {
  const result = await rpc("tools/call", { name, arguments: args });
  if (result?.isError) {
    const msg = (result.content ?? []).map((c) => c?.text ?? "").join(" ").trim();
    throw new Error(`tool ${name} failed: ${msg.slice(0, 200)}`);
  }
  return result;
};
const evalJs = async (expression) => {
  const r = await callTool("evaluate_script", { page, expression });
  return (r.content ?? [])
    .filter((c) => c.type === "text")
    .map((c) => c.text)
    .join(" ")
    .split("--- Additional")[0]
    .trim();
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 1) inject/update same-origin iframe apuntando a la ruta de PROD
const inject = `var f=document.getElementById('vp')||document.createElement('iframe');`
  + `f.id='vp';f.style.cssText='width:1280px;height:3200px;border:0;display:block';`
  + `document.body.style.margin='0';`
  + `if(!f.parentNode){document.body.innerHTML='';document.body.appendChild(f);}`
  + `f.src=${JSON.stringify(src)};'ok:'+f.getAttribute('src')`;

try {
  console.log("inject:", await evalJs(inject));
  await sleep(waitMs);
  // 2) crecer el iframe a la altura de contenido (same-origin => contentDocument accesible)
  const grow = `(function(){var f=document.getElementById('vp');`
    + `var h=f.contentDocument.documentElement.scrollHeight;`
    + `f.style.height=Math.min(h,${maxH})+'px';return 'contentH:'+h;})()`;
  console.log(await evalJs(grow));
  await sleep(2500);
  const shotArgs = { page, path: outPath, fullPage: true, format: "jpeg", quality: 70 };
  try {
    await callTool("save_screenshot", shotArgs);
  } catch (e) {
    console.error("retry after:", String(e?.message ?? e).slice(0, 80));
    await sleep(3000);
    await callTool("save_screenshot", shotArgs);
  }
  console.log("SHOT_OK", outPath);
} catch (e) {
  console.error("FAIL", String(e?.message ?? e));
  process.exit(1);
}
