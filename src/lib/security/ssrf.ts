import dns from 'node:dns/promises';

/**
 * IP ranges to reject:
 * 127.0.0.0/8 - Loopback
 * 10.0.0.0/8 - Private Class A
 * 172.16.0.0/12 - Private Class B
 * 192.168.0.0/16 - Private Class C
 * 169.254.0.0/16 - Link-local / Cloud metadata (e.g. AWS/GCP 169.254.169.254)
 * 0.0.0.0/8 - Current network ("this" host)
 * 100.64.0.0/10 - Shared address space (CGNAT)
 * 198.18.0.0/15 - Benchmark testing
 * 224.0.0.0/4 - Multicast
 * 240.0.0.0/4 - Reserved
 * 255.255.255.255 - Broadcast
 *
 * IPv6:
 * ::1 - Loopback
 * :: - Unspecified
 * fc00::/7 - Unique local addresses (ULA)
 * fe80::/10 - Link-local unicast
 * ::ffff:0:0/96 - IPv4-mapped IPv6
 */

function ipV4ToNumber(ip: string): number {
  return ip
    .split('.')
    .reduce((acc, octet) => ((acc << 8) + parseInt(octet, 10)) >>> 0, 0);
}

function inSubnetV4(ipNum: number, subnet: string, maskBits: number): boolean {
  const subnetNum = ipV4ToNumber(subnet);
  const mask = maskBits === 0 ? 0 : (~0 << (32 - maskBits)) >>> 0;
  return (ipNum & mask) === (subnetNum & mask);
}

export function isPrivateOrReservedIP(ip: string): boolean {
  const cleanIp = ip.trim();

  // IPv4 check
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(cleanIp)) {
    const octets = cleanIp.split('.').map(o => parseInt(o, 10));
    if (octets.some(o => isNaN(o) || o < 0 || o > 255)) return true;

    const ipNum = ipV4ToNumber(cleanIp);

    if (inSubnetV4(ipNum, '127.0.0.0', 8)) return true; // Loopback
    if (inSubnetV4(ipNum, '10.0.0.0', 8)) return true; // 10.0.0.0/8
    if (inSubnetV4(ipNum, '172.16.0.0', 12)) return true; // 172.16.0.0/12
    if (inSubnetV4(ipNum, '192.168.0.0', 16)) return true; // 192.168.0.0/16
    if (inSubnetV4(ipNum, '169.254.0.0', 16)) return true; // Link-local / metadata
    if (inSubnetV4(ipNum, '0.0.0.0', 8)) return true; // 0.0.0.0/8
    if (inSubnetV4(ipNum, '100.64.0.0', 10)) return true; // CGNAT
    if (inSubnetV4(ipNum, '198.18.0.0', 15)) return true; // Benchmark
    if (inSubnetV4(ipNum, '224.0.0.0', 4)) return true; // Multicast
    if (inSubnetV4(ipNum, '240.0.0.0', 4)) return true; // Reserved
    if (cleanIp === '255.255.255.255') return true;

    return false;
  }

  // IPv6 check
  const lower = cleanIp.toLowerCase();
  if (lower === '::1' || lower === '::' || lower === '0:0:0:0:0:0:0:1' || lower === '0:0:0:0:0:0:0:0') {
    return true;
  }

  // IPv4-mapped IPv6 (e.g. ::ffff:127.0.0.1)
  const v4Mapped = lower.match(/^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
  if (v4Mapped && v4Mapped[1]) {
    return isPrivateOrReservedIP(v4Mapped[1]);
  }

  // Unique local: fc00::/7 (fc00... or fd00...)
  if (/^f[cd][0-9a-f]{2}:/i.test(lower)) return true;

  // Link-local: fe80::/10 (fe80, fe90, fea0, feb0...)
  if (/^fe[89ab][0-9a-f]:/i.test(lower)) return true;

  return false;
}

export async function validateSafeUrl(urlString: string): Promise<{ valid: boolean; reason?: string; url?: URL }> {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(urlString);
  } catch {
    return { valid: false, reason: 'Invalid URL structure' };
  }

  // 1. Strict protocol allowlist (HTTPS only)
  if (parsedUrl.protocol !== 'https:') {
    return { valid: false, reason: 'Only HTTPS URLs are allowed for external medical lookups.' };
  }

  const hostname = parsedUrl.hostname.trim();
  if (!hostname) {
    return { valid: false, reason: 'Empty hostname' };
  }

  // Block obvious localhost / local addresses immediately
  if (
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal')
  ) {
    return { valid: false, reason: 'Local/Internal hostnames are forbidden.' };
  }

  // If hostname is directly an IP literal
  if (isPrivateOrReservedIP(hostname)) {
    return { valid: false, reason: 'Private or reserved IP address is forbidden.' };
  }

  // 2. DNS resolution check
  try {
    const addresses = await dns.lookup(hostname, { all: true });
    if (!addresses || addresses.length === 0) {
      return { valid: false, reason: 'Hostname failed DNS resolution.' };
    }

    for (const record of addresses) {
      if (isPrivateOrReservedIP(record.address)) {
        return {
          valid: false,
          reason: `Resolved IP (${record.address}) is in a forbidden private/reserved range.`
        };
      }
    }
  } catch (err: any) {
    return { valid: false, reason: `DNS lookup failed: ${err.message}` };
  }

  return { valid: true, url: parsedUrl };
}

/**
 * Reads a response stream up to maxBytes to prevent response amplification attacks.
 */
export async function readStreamWithLimit(
  body: ReadableStream<Uint8Array> | null,
  maxBytes: number = 512 * 1024
): Promise<string> {
  if (!body) return '';

  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        totalBytes += value.length;
        if (totalBytes > maxBytes) {
          chunks.push(value.subarray(0, maxBytes - (totalBytes - value.length)));
          break;
        }
        chunks.push(value);
      }
    }
  } finally {
    reader.releaseLock();
  }

  const combined = new Uint8Array(Math.min(totalBytes, maxBytes));
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.length;
  }

  return new TextDecoder('utf-8').decode(combined);
}
