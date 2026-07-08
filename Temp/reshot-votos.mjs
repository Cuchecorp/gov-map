#!/usr/bin/env node
// reshot-votos.mjs — evidencia del chart "Cuándo votó" (VIZ-02, Phase 47 Plan 02).
//
// Deriva de Temp/reshot2.mjs (38-03): iframe SAME-ORIGIN in-process (rasteriza
// fullPage completo, sin clipping OOPIF). DIFERENCIA: el chart vive DENTRO del
// detalle colapsado de Votaciones (capa-2, Radix Accordion cliente, forceMount SSR
// pero oculto por `data-[state=closed]:hidden`). Para VERLO hay que EXPANDIR el
// disclosure: clickear el trigger "Ver detalle (N)" del `#votos` dentro del iframe
// (same-origin => contentDocument accesible) y dejar que Recharts mida y rasterice.
//
// Usage: node Temp/reshot-votos.mjs <pageId> <outPath> <route> [waitMs] [maxH]

const MCP = process.env.BROS_MCP_URL || "http://127.0.0.1:9200/mcp";
const BASE = process.env.PROD_BASE || "https://observatorio-congreso.thevalis.workers.dev";

const [, , pageStr, outPath, route, waitStr, maxHStr] = process.argv;
if (!pageStr || !outPath || !route) {
  console.error("uso: reshot-votos.mjs <pageId> <outPath> <route> [waitMs] [maxH]");
  process.exit(1);
}
const page = Number(pageStr);
const waitMs = Number(waitStr || 9000);
const maxH = Number(maxHStr || 12000);
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

const inject = `var f=document.getElementById('vp')||document.createElement('iframe');`
  + `f.id='vp';f.style.cssText='width:1280px;height:3200px;border:0;display:block';`
  + `document.body.style.margin='0';`
  + `if(!f.parentNode){document.body.innerHTML='';document.body.appendChild(f);}`
  + `f.src=${JSON.stringify(src)};'ok:'+f.getAttribute('src')`;

// Click del trigger "Ver detalle" DENTRO de #votos (Radix accordion). Devuelve el
// texto del botón clickeado para trazabilidad, o "NOBTN" si no lo encuentra.
const expandVotos = `(function(){var f=document.getElementById('vp');`
  + `var d=f.contentDocument;var sec=d.getElementById('votos');`
  + `if(!sec)return 'NOSEC';`
  + `var btns=[].slice.call(sec.querySelectorAll('button'));`
  + `var t=btns.find(function(b){return /Ver detalle/.test(b.textContent);});`
  + `if(!t)return 'NOBTN';t.click();return 'CLICKED:'+t.textContent.trim();})()`;

try {
  console.log("inject:", await evalJs(inject));
  await sleep(waitMs);
  console.log("expand:", await evalJs(expandVotos));
  // Recharts: dejar que ResponsiveContainer mida (ya visible) y rasterice.
  await sleep(4500);
  const grow = `(function(){var f=document.getElementById('vp');`
    + `var h=f.contentDocument.documentElement.scrollHeight;`
    + `f.style.height=Math.min(h,${maxH})+'px';`
    + `var svg=f.contentDocument.querySelector('#votos .recharts-surface');`
    + `return 'contentH:'+h+' recharts:'+(svg?'yes':'no');})()`;
  console.log(await evalJs(grow));
  await sleep(2500);
  const shotArgs = { page, path: outPath, fullPage: true, format: "png" };
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
