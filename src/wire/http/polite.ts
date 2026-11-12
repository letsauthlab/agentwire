import { type Client, type ClientResponse, FetchRefused } from "./client";
import { ALLOW_ALL, DISALLOW_ALL, isAllowed, parseRobots, type Robots } from "./robots";

/** The name the wire gives itself. A site owner finds out who is asking and where to complain. */
export const USER_AGENT = "Agentwire/0.1 (+https://agentwire.eu)";
/** The name robots.txt rules are matched against. */
export const ROBOTS_AGENT = "agentwire";

/** What a server sent to make the next request conditional. */
export interface Validators {
  etag?: string;
  lastModified?: string;
}

export interface PoliteOptions {
  headers?: Record<string, string>;
  maxBytes?: number;
  /** Sent as `If-None-Match` and `If-Modified-Since`. A 304 answer comes back as it is. */
  validators?: Validators;
  /** Shortest time between two requests to this host. */
  minIntervalMs?: number;
  /**
   * Skip the robots.txt check. Only for an API whose own terms allow the use; each caller says
   * why in a comment.
   */
  robotsExempt?: boolean;
}

export interface PoliteFetcher {
  get(url: string, options?: PoliteOptions): Promise<ClientResponse>;
}

export interface PoliteDeps {
  client: Client;
  /** Milliseconds, as Date.now. */
  now: () => number;
  sleep: (ms: number) => Promise<void>;
  defaultIntervalMs?: number;
}

const ROBOTS_MAX_BYTES = 500_000;

/**
 * Wraps the guarded client with manners: robots.txt is read once per host and obeyed, requests
 * to one host are spaced out, and a request can be conditional.
 */
export function createPoliteFetcher(deps: PoliteDeps): PoliteFetcher {
  const defaultInterval = deps.defaultIntervalMs ?? 1000;
  const robots = new Map<string, Promise<Robots>>();
  const queues = new Map<string, Promise<void>>();
  const last = new Map<string, number>();

  /** Runs `task` after every earlier task for the host, and not sooner than the interval. */
  function spaced<T>(host: string, interval: number, task: () => Promise<T>): Promise<T> {
    const previous = queues.get(host) ?? Promise.resolve();
    const run = previous.then(async () => {
      const wait = (last.get(host) ?? Number.NEGATIVE_INFINITY) + interval - deps.now();
      if (wait > 0) await deps.sleep(wait);
      try {
        return await task();
      } finally {
        last.set(host, deps.now());
      }
    });
    queues.set(
      host,
      run.then(
        () => {},
        () => {},
      ),
    );
    return run;
  }

  function robotsFor(url: URL, interval: number): Promise<Robots> {
    let known = robots.get(url.host);
    if (!known) {
      known = spaced(url.host, interval, () =>
        deps.client.get(`https://${url.host}/robots.txt`, { maxBytes: ROBOTS_MAX_BYTES }),
      ).then(
        (res) => {
          if (res.status === 200) {
            return parseRobots(new TextDecoder().decode(res.body), ROBOTS_AGENT);
          }
          // RFC 9309: no file means no rules; a server error or no answer means stay away.
          return res.status >= 400 && res.status < 500 ? ALLOW_ALL : DISALLOW_ALL;
        },
        (error) => {
          // An address the guard refuses is refused as such, not as a robots.txt rule.
          if (error instanceof FetchRefused && error.reason !== "timeout") throw error;
          return DISALLOW_ALL;
        },
      );
      robots.set(url.host, known);
    }
    return known;
  }

  return {
    async get(raw, options = {}) {
      let url: URL;
      try {
        url = new URL(raw);
      } catch {
        throw new FetchRefused("bad-address", "not an address");
      }
      const interval = options.minIntervalMs ?? defaultInterval;
      if (!options.robotsExempt && url.protocol === "https:") {
        const rules = await robotsFor(url, interval);
        if (!isAllowed(rules, url.pathname + url.search)) {
          throw new FetchRefused("robots", url.host);
        }
      }
      const headers: Record<string, string> = { ...options.headers };
      if (options.validators?.etag) headers["if-none-match"] = options.validators.etag;
      if (options.validators?.lastModified) {
        headers["if-modified-since"] = options.validators.lastModified;
      }
      return spaced(url.host, interval, () =>
        deps.client.get(url.href, { headers, maxBytes: options.maxBytes }),
      );
    },
  };
}

/** The validators a response offers for the next request, if any. */
export function validatorsOf(response: ClientResponse): Validators | undefined {
  const etag = response.headers.etag;
  const lastModified = response.headers["last-modified"];
  if (!etag && !lastModified) return undefined;
  return { ...(etag ? { etag } : {}), ...(lastModified ? { lastModified } : {}) };
}
