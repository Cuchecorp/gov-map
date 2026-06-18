/**
 * Writer de crudo a Cloudflare R2, content-addressed e inmutable (FND-02).
 *
 * Usa aws4fetch (SigV4 via SubtleCrypto, NUNCA hand-roll de la firma — T-01-05).
 * Key = {source}/{resource}/{date}/{sha256}.{ext}; el PUT lleva
 * `If-None-Match: *` => atomico, falla si el objeto ya existe. 412 = ya existia
 * = exito idempotente (mismo contenido => misma key => append-only sin race).
 */
import { AwsClient } from "aws4fetch";

/** sha256 hex (Web Crypto, nativo Deno/Node 22 — sin libreria externa). */
export async function sha256Hex(body: Uint8Array): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", body as BufferSource);
  return [...new Uint8Array(buf)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export interface R2Config {
  accessKeyId: string;
  secretAccessKey: string;
  /** https://<accountid>.r2.cloudflarestorage.com */
  endpoint: string;
  bucket: string;
}

export interface R2StoreOptions {
  /** fetch inyectable para tests sin red. Default: fetch global. */
  fetchFn?: typeof fetch;
}

export class R2Store {
  private readonly client: AwsClient;
  private readonly endpoint: string;
  private readonly bucket: string;
  private readonly fetchFn: typeof fetch;

  constructor(cfg: R2Config, opts: R2StoreOptions = {}) {
    this.client = new AwsClient({
      accessKeyId: cfg.accessKeyId,
      secretAccessKey: cfg.secretAccessKey,
      service: "s3",
      region: "auto",
    });
    this.endpoint = cfg.endpoint.replace(/\/+$/, "");
    this.bucket = cfg.bucket;
    this.fetchFn = opts.fetchFn ?? fetch;
  }

  /**
   * Escribe el crudo de forma idempotente. Devuelve el r2Path (key).
   * 412 (ya existia) se trata como exito. Otros !ok lanzan (sin exponer
   * credenciales en el mensaje — T-01-06).
   */
  async putImmutable(
    source: string,
    resource: string,
    date: string,
    sha: string,
    ext: string,
    body: Uint8Array,
  ): Promise<string> {
    const key = `${source}/${resource}/${date}/${sha}.${ext}`;
    const url = `${this.endpoint}/${this.bucket}/${key}`;

    // aws4fetch firma la request; inyectamos fetch para tests sin red.
    const signed = await this.client.sign(url, {
      method: "PUT",
      body: body as BodyInit,
      headers: { "If-None-Match": "*" },
    });
    const res = await this.fetchFn(signed);

    // 412 Precondition Failed => el objeto ya existia => idempotente OK.
    if (!res.ok && res.status !== 412) {
      throw new Error(`R2 PUT ${res.status} para ${key}`);
    }
    return key;
  }
}
