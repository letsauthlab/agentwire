import { lookup } from "node:dns/promises";
import { request } from "node:https";
import type { LookupFunction } from "node:net";
import { pipeline, Readable } from "node:stream";
import { createBrotliDecompress, createGunzip, createInflate } from "node:zlib";
import type { Resolver, Transport } from "./client";

/** Every address the system resolver returns for a host. */
export const systemResolver: Resolver = async (host) => {
  const found = await lookup(host, { all: true });
  return found.map((a) => ({ address: a.address, family: a.family === 6 ? 6 : 4 }));
};

/**
 * The body of a response as a stream of plain bytes. An answer without a body (204, 304) can
 * still carry a `Content-Encoding` header, so it is never handed to a decompressor.
 */
export function bodyOf(status: number, encoding: string | undefined, body: Readable): Readable {
  if (status === 204 || status === 304) {
    body.resume();
    return Readable.from([]);
  }
  const stage =
    encoding === "gzip"
      ? createGunzip()
      : encoding === "br"
        ? createBrotliDecompress()
        : encoding === "deflate"
          ? createInflate()
          : undefined;
  if (!stage) return body;
  // pipeline passes an error of the socket on to the reader of the decompressed stream.
  return pipeline(body, stage, () => {});
}

/**
 * One https request with node:https. The connection goes to the address the client checked:
 * the lookup below hands it back instead of asking DNS a second time, so a name cannot answer
 * with a public address for the check and a private one for the connection.
 */
export const httpsTransport: Transport = ({ url, address, headers, signal }) =>
  new Promise((resolve, reject) => {
    const pinned: LookupFunction = (_host, options, callback) => {
      if (typeof options === "object" && options.all) {
        callback(null, [{ address: address.address, family: address.family }]);
      } else {
        callback(null, address.address, address.family);
      }
    };
    const req = request(
      url,
      {
        method: "GET",
        headers: { ...headers, "accept-encoding": "gzip, br" },
        signal,
        lookup: pinned,
      },
      (res) => {
        const flat: Record<string, string> = {};
        for (const [name, value] of Object.entries(res.headers)) {
          if (value !== undefined) flat[name] = Array.isArray(value) ? value.join(", ") : value;
        }
        resolve({
          status: res.statusCode ?? 0,
          headers: flat,
          body: bodyOf(res.statusCode ?? 0, flat["content-encoding"], res),
        });
      },
    );
    req.on("error", reject);
    req.end();
  });
