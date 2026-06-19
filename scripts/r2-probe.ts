// R2 connectivity probe — PutObject -> HeadObject -> GetObject -> DeleteObject
// on a throwaway key. Prints only OK/FAIL, never secret values.
// Run: deno run --allow-net --allow-read --allow-env scripts/r2-probe.ts
import {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "npm:@aws-sdk/client-s3@3";

function readEnv(): Record<string, string> {
  const raw = Deno.readTextFileSync(".env").replace(/^﻿/, "");
  const out: Record<string, string> = {};
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) out[m[1]] = m[2].trim();
  }
  return out;
}

const env = readEnv();
const endpoint = env.R2_ENDPOINT_URL;
const accessKeyId = env.R2_ACCESS_KEY_ID;
const secretAccessKey = env.R2_SECRET_ACCESS_KEY;
const bucket = env.R2_BUCKET;

const missing = ["R2_ENDPOINT_URL", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET"]
  .filter((k) => !env[k]);
if (missing.length) {
  console.log("FAIL: missing env vars:", missing.join(", "));
  Deno.exit(2);
}

console.log(`endpoint host: ${new URL(endpoint).host}`);
console.log(`bucket: ${bucket}`);

const s3 = new S3Client({
  region: "auto",
  endpoint,
  credentials: { accessKeyId, secretAccessKey },
  forcePathStyle: true,
});

const key = `observatorio/_probe/connectivity-test.txt`;
const body = `r2-probe ${"" + crypto.randomUUID()}`;

try {
  await s3.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: "text/plain" }));
  console.log("PUT    : OK");

  const head = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
  console.log(`HEAD   : OK (size=${head.ContentLength})`);

  const got = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  const text = await got.Body!.transformToString();
  console.log(`GET    : OK (roundtrip ${text === body ? "MATCH" : "MISMATCH"})`);

  await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
  console.log("DELETE : OK");

  console.log("\nR2 RESULT: OK — read+write+delete all succeeded.");
} catch (e) {
  const err = e as { name?: string; message?: string; $metadata?: { httpStatusCode?: number } };
  // Redact any accidental secret echo: print only name/status/short message.
  const msg = (err.message ?? "").slice(0, 200);
  console.log(`\nR2 RESULT: FAIL — ${err.name ?? "Error"} (http ${err.$metadata?.httpStatusCode ?? "?"})`);
  console.log(`detail: ${msg}`);
  Deno.exit(1);
}
