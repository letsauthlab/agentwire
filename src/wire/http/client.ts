import { isIP } from "node:net";
import { isPublicAddress } from "./address";

export interface ResolvedAddress {
  address: string;
  family: 4 | 6;
}

/** Looks up every address of a host name. */
export type Resolver = (host: string) => Promise<ResolvedAddress[]>;

export interface TransportRequest {
  url: URL;
  /** The checked address to connect to. The transport must not look the host up again. */
  address: ResolvedAddress;
  headers: Record<string, string>;
  signal: AbortSignal;
}

export interface TransportResponse {
  status: number;
  /** Header names in lower case. */
  headers: Record<string, string>;
  /** The body, already decompressed. */
  body: AsyncIterable<Uint8Array>;
}

/** Makes one request, without following redirects. */
export type Transport = (request: TransportRequest) => Promise<TransportResponse>;

export interface ClientOptions {
  transport: Transport;
  resolve: Resolver;
  userAgent: string;
  /** Largest body accepted, in bytes after decompression. */
  maxBytes: number;
  /** Time allowed for one call, redirects and body included. */
  timeoutMs: number;
  maxRedirects: number;
}

export interface GetOptions {
  headers?: Record<string, string>;
  maxBytes?: number;
}

export interface ClientResponse {
  status: number;
  headers: Record<string, string>;
  body: Uint8Array;
  /** The address that answered, after redirects. */
  url: string;
}

/** A request the guarded client would not make or finish. `reason` is a fixed, safe word. */
export class FetchRefused extends Error {
  constructor(
    readonly reason:
      | "not-https"
      | "bad-address"
      | "private-address"
      | "unresolved"
      | "too-many-redirects"
      | "too-large"
      | "timeout"
      | "robots",
    detail: string,
  ) {
    super(`${reason}: ${detail}`);
    this.name = "FetchRefused";
  }
}

export interface Client {
  get(url: string, options?: GetOptions): Promise<ClientResponse>;
}

const REDIRECTS = new Set([301, 302, 303, 307, 308]);

/** Checks an address before any connection is made. Returns the parsed address. */
export function checkUrl(raw: string | URL): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new FetchRefused("bad-address", "not an address");
  }
  if (url.protocol !== "https:") throw new FetchRefused("not-https", url.protocol);
  if (url.username !== "" || url.password !== "") {
    throw new FetchRefused("bad-address", "an address must not carry credentials");
  }
  if (url.port !== "") throw new FetchRefused("bad-address", "only the default port is allowed");
  return url;
}

async function checkedAddress(url: URL, resolve: Resolver): Promise<ResolvedAddress> {
  const host = url.hostname.replace(/^\[|\]$/g, "");
  const literal = isIP(host);
  const addresses: ResolvedAddress[] =
    literal === 0
      ? await resolve(host).catch(() => {
          throw new FetchRefused("unresolved", host);
        })
      : [{ address: host, family: literal === 4 ? 4 : 6 }];
  const first = addresses[0];
  if (!first) throw new FetchRefused("unresolved", host);
  // One private address among several is enough to refuse: the name is not to be trusted.
  for (const a of addresses) {
    if (!isPublicAddress(a.address)) throw new FetchRefused("private-address", host);
  }
  return first;
}

/**
 * A client for addresses that come from data. Only https, only public addresses, a size and a
 * time limit, and every redirect is checked like the first address.
 */
export function createClient(options: ClientOptions): Client {
  return {
    async get(raw, get = {}) {
      const maxBytes = get.maxBytes ?? options.maxBytes;
      const signal = AbortSignal.timeout(options.timeoutMs);
      let url = checkUrl(raw);
      try {
        for (let hop = 0; ; hop++) {
          const address = await checkedAddress(url, options.resolve);
          const response = await options.transport({
            url,
            address,
            headers: { ...get.headers, "user-agent": options.userAgent },
            signal,
          });
          const location = response.headers.location;
          if (REDIRECTS.has(response.status) && location !== undefined) {
            if (hop >= options.maxRedirects) {
              throw new FetchRefused("too-many-redirects", url.hostname);
            }
            let next: URL;
            try {
              next = new URL(location, url);
            } catch {
              throw new FetchRefused("bad-address", "redirect to something that is no address");
            }
            url = checkUrl(next);
            continue;
          }
          const declared = Number(response.headers["content-length"]);
          if (Number.isFinite(declared) && declared > maxBytes) {
            throw new FetchRefused("too-large", `${declared} bytes declared`);
          }
          const chunks: Uint8Array[] = [];
          let size = 0;
          for await (const chunk of response.body) {
            size += chunk.byteLength;
            if (size > maxBytes) throw new FetchRefused("too-large", `more than ${maxBytes} bytes`);
            chunks.push(chunk);
          }
          return {
            status: response.status,
            headers: response.headers,
            body: Buffer.concat(chunks),
            url: url.href,
          };
        }
      } catch (error) {
        if (signal.aborted && !(error instanceof FetchRefused)) {
          throw new FetchRefused("timeout", `${options.timeoutMs} ms`);
        }
        throw error;
      }
    },
  };
}
