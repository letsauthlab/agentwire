interface Rule {
  allow: boolean;
  pattern: string;
}

/** The rules of a robots.txt file that apply to one client. */
export interface Robots {
  rules: Rule[];
}

export const ALLOW_ALL: Robots = { rules: [] };
export const DISALLOW_ALL: Robots = { rules: [{ allow: false, pattern: "/" }] };

/**
 * Reads a robots.txt file (RFC 9309) and keeps the group for `agent`. A group that names the
 * agent wins over the `*` group. With neither, everything is allowed.
 */
export function parseRobots(text: string, agent: string): Robots {
  const token = agent.toLowerCase();
  const groups: { agents: string[]; rules: Rule[] }[] = [];
  let current: { agents: string[]; rules: Rule[] } | undefined;
  let inAgents = false;

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, "").trim();
    const colon = line.indexOf(":");
    if (colon < 1) continue;
    const field = line.slice(0, colon).trim().toLowerCase();
    const value = line.slice(colon + 1).trim();
    if (field === "user-agent") {
      if (!current || !inAgents) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      inAgents = true;
    } else if (field === "allow" || field === "disallow") {
      inAgents = false;
      // An empty Disallow allows everything, so it adds no rule.
      if (current && value !== "") current.rules.push({ allow: field === "allow", pattern: value });
    } else {
      inAgents = false;
    }
  }

  const named = groups.filter((g) => g.agents.includes(token));
  const chosen = named.length > 0 ? named : groups.filter((g) => g.agents.includes("*"));
  return { rules: chosen.flatMap((g) => g.rules) };
}

function matches(pattern: string, path: string): boolean {
  const anchored = pattern.endsWith("$");
  const body = anchored ? pattern.slice(0, -1) : pattern;
  const source = body
    .split("*")
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");
  return new RegExp(`^${source}${anchored ? "$" : ""}`).test(path);
}

/** The longest matching rule decides; `Allow` wins a tie. `path` includes the query. */
export function isAllowed(robots: Robots, path: string): boolean {
  let best: Rule | undefined;
  for (const rule of robots.rules) {
    if (!matches(rule.pattern, path)) continue;
    if (
      !best ||
      rule.pattern.length > best.pattern.length ||
      (rule.pattern.length === best.pattern.length && rule.allow)
    ) {
      best = rule;
    }
  }
  return best?.allow ?? true;
}
