import { readFileSync } from "node:fs";
import {
  type Client,
  createClient,
  type ResolvedAddress,
  type TransportResponse,
} from "@/wire/http/client";
import { createPoliteFetcher, type PoliteFetcher } from "@/wire/http/polite";

export const fixture = (name: string): string => readFileSync(`tests/fixtures/${name}`, "utf8");

export interface Route {
  status?: number;
  headers?: Record<string, string>;
  body?: string | Uint8Array;
}

export interface FakeNet {
  client: Client;
  fetcher: PoliteFetcher;
  /** Every request the transport saw, in order. */
  requests: { url: string; headers: Record<string, string>; address: string }[];
  /** Every pause the rate limit asked for, in milliseconds. */
  sleeps: number[];
  routes: Record<string, Route | ((headers: Record<string, string>) => Route)>;
}

/**
 * A network made of a table: address to answer. An address that is not in the table answers
 * 404, so a missing robots.txt allows everything. Time only moves when the fetcher sleeps.
 */
export function fakeNet(
  routes: FakeNet["routes"],
  options: { hosts?: Record<string, ResolvedAddress[]>; maxBytes?: number } = {},
): FakeNet {
  const requests: FakeNet["requests"] = [];
  const sleeps: number[] = [];
  let clock = 0;
  const client = createClient({
    userAgent: "Agentwire-test",
    maxBytes: options.maxBytes ?? 1_000_000,
    timeoutMs: 5000,
    maxRedirects: 3,
    resolve: async (host) => options.hosts?.[host] ?? [{ address: "93.184.216.34", family: 4 }],
    transport: async ({ url, headers, address }): Promise<TransportResponse> => {
      requests.push({ url: url.href, headers, address: address.address });
      const found = routes[url.href];
      const route = typeof found === "function" ? found(headers) : (found ?? { status: 404 });
      const body =
        typeof route.body === "string" ? new TextEncoder().encode(route.body) : route.body;
      return {
        status: route.status ?? 200,
        headers: route.headers ?? {},
        body: (async function* () {
          if (body) yield body;
        })(),
      };
    },
  });
  const fetcher = createPoliteFetcher({
    client,
    now: () => clock,
    sleep: async (ms) => {
      sleeps.push(ms);
      clock += ms;
    },
  });
  return { client, fetcher, requests, sleeps, routes };
}
