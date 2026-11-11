import { BlockList, isIP } from "node:net";

// Every range that is not a public unicast address: loopback, private, link-local, carrier
// NAT, documentation, multicast and reserved space. A source's address is data, so the wire
// never connects to one of these (docs/briefs/02-wire-fetch.md).
const blocked = new BlockList();
for (const [net, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.88.99.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const) {
  blocked.addSubnet(net, prefix, "ipv4");
}
for (const [net, prefix] of [
  ["::", 128],
  ["::1", 128],
  ["64:ff9b::", 96],
  ["64:ff9b:1::", 48],
  ["100::", 64],
  ["2001::", 23],
  ["2001:db8::", 32],
  ["2002::", 16],
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8],
] as const) {
  blocked.addSubnet(net, prefix, "ipv6");
}

const MAPPED = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i;

/** True only for an IP address that is safe to connect to from the wire. */
export function isPublicAddress(address: string): boolean {
  const mapped = MAPPED.exec(address);
  if (mapped?.[1]) return isPublicAddress(mapped[1]);
  const family = isIP(address);
  if (family === 4) return !blocked.check(address, "ipv4");
  if (family === 6) {
    // An IPv4 address written in hex inside ::ffff:0:0/96 is judged as that IPv4 address.
    if (/^::ffff:/i.test(address)) return false;
    return !blocked.check(address, "ipv6");
  }
  return false;
}
