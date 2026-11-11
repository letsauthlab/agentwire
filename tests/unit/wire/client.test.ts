import { Readable } from "node:stream";
import { gzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { isPublicAddress } from "@/wire/http/address";
import { FetchRefused } from "@/wire/http/client";
import { bodyOf } from "@/wire/http/transport";
import { fakeNet } from "./helpers";

const refusal = async (promise: Promise<unknown>): Promise<string> => {
  const error = await promise.then(
    () => undefined,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(FetchRefused);
  return (error as FetchRefused).reason;
};

describe("isPublicAddress", () => {
  it("accepts public addresses", () => {
    for (const a of ["93.184.216.34", "1.1.1.1", "2606:4700:4700::1111"]) {
      expect(isPublicAddress(a), a).toBe(true);
    }
  });

  it("refuses loopback, private, link-local and other special ranges", () => {
    for (const a of [
      "127.0.0.1",
      "10.1.2.3",
      "172.16.0.1",
      "192.168.1.1",
      "169.254.169.254",
      "100.64.0.1",
      "0.0.0.0",
      "224.0.0.1",
      "::1",
      "::",
      "fe80::1",
      "fd00::1",
      "::ffff:127.0.0.1",
      "::ffff:7f00:1",
      "64:ff9b::7f00:1",
      "not an address",
    ]) {
      expect(isPublicAddress(a), a).toBe(false);
    }
  });
});

describe("the guarded client", () => {
  it("fetches a public https address and names itself", async () => {
    const net = fakeNet({ "https://example.org/feed": { body: "hello" } });
    const response = await net.client.get("https://example.org/feed");
    expect(new TextDecoder().decode(response.body)).toBe("hello");
    expect(net.requests[0]?.headers["user-agent"]).toBe("Agentwire-test");
  });

  it("refuses anything that is not plain https on the default port", async () => {
    const net = fakeNet({});
    expect(await refusal(net.client.get("http://example.org/"))).toBe("not-https");
    expect(await refusal(net.client.get("file:///etc/passwd"))).toBe("not-https");
    expect(await refusal(net.client.get("https://user:pw@example.org/"))).toBe("bad-address");
    expect(await refusal(net.client.get("https://example.org:8443/"))).toBe("bad-address");
    expect(await refusal(net.client.get("no address"))).toBe("bad-address");
    expect(net.requests).toEqual([]);
  });

  it("refuses a private address, written out or behind a name", async () => {
    const net = fakeNet(
      {},
      {
        hosts: {
          "intranet.example": [{ address: "10.0.0.5", family: 4 }],
          "mixed.example": [
            { address: "93.184.216.34", family: 4 },
            { address: "127.0.0.1", family: 4 },
          ],
          "gone.example": [],
        },
      },
    );
    expect(await refusal(net.client.get("https://127.0.0.1/"))).toBe("private-address");
    expect(await refusal(net.client.get("https://[::1]/"))).toBe("private-address");
    expect(await refusal(net.client.get("https://169.254.169.254/latest/"))).toBe(
      "private-address",
    );
    expect(await refusal(net.client.get("https://intranet.example/"))).toBe("private-address");
    expect(await refusal(net.client.get("https://mixed.example/"))).toBe("private-address");
    expect(await refusal(net.client.get("https://gone.example/"))).toBe("unresolved");
    expect(net.requests).toEqual([]);
  });

  it("connects to the address it checked", async () => {
    const net = fakeNet({ "https://example.org/": { body: "ok" } });
    await net.client.get("https://example.org/");
    expect(net.requests[0]?.address).toBe("93.184.216.34");
  });

  it("follows a redirect and checks the new address", async () => {
    const net = fakeNet({
      "https://example.org/old": { status: 301, headers: { location: "/new" } },
      "https://example.org/new": { body: "moved" },
    });
    const response = await net.client.get("https://example.org/old");
    expect(response.url).toBe("https://example.org/new");
    expect(new TextDecoder().decode(response.body)).toBe("moved");
  });

  it("refuses a redirect to plain http", async () => {
    const net = fakeNet({
      "https://example.org/": { status: 302, headers: { location: "http://example.org/plain" } },
    });
    expect(await refusal(net.client.get("https://example.org/"))).toBe("not-https");
    expect(net.requests).toHaveLength(1);
  });

  it("refuses a redirect to a private address", async () => {
    const net = fakeNet(
      { "https://example.org/": { status: 307, headers: { location: "https://inside.example/" } } },
      { hosts: { "inside.example": [{ address: "192.168.0.10", family: 4 }] } },
    );
    expect(await refusal(net.client.get("https://example.org/"))).toBe("private-address");
    expect(net.requests).toHaveLength(1);
  });

  it("stops after too many redirects", async () => {
    const net = fakeNet({
      "https://example.org/loop": { status: 302, headers: { location: "/loop" } },
    });
    expect(await refusal(net.client.get("https://example.org/loop"))).toBe("too-many-redirects");
    expect(net.requests).toHaveLength(4);
  });

  it("refuses an oversized response, declared or not", async () => {
    const big = "x".repeat(2000);
    const net = fakeNet(
      {
        "https://example.org/declared": { headers: { "content-length": "2000" }, body: big },
        "https://example.org/silent": { body: big },
        "https://example.org/small": { body: "fits" },
      },
      { maxBytes: 1000 },
    );
    expect(await refusal(net.client.get("https://example.org/declared"))).toBe("too-large");
    expect(await refusal(net.client.get("https://example.org/silent"))).toBe("too-large");
    expect((await net.client.get("https://example.org/small")).status).toBe(200);
    expect((await net.client.get("https://example.org/silent", { maxBytes: 5000 })).status).toBe(
      200,
    );
  });
});

describe("the transport", () => {
  const read = async (body: Readable) => Buffer.concat(await body.toArray()).toString();

  it("decompresses a gzip body and passes a plain one on", async () => {
    expect(await read(bodyOf(200, "gzip", Readable.from([gzipSync("hello")])))).toBe("hello");
    expect(await read(bodyOf(200, undefined, Readable.from([Buffer.from("plain")])))).toBe("plain");
  });

  it("reads no body from a 304 answer, even one that names an encoding", async () => {
    expect(await read(bodyOf(304, "gzip", Readable.from([])))).toBe("");
  });
});
