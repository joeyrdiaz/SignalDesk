import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

/**
 * Block SSRF to private/link-local/metadata addresses for public hosting.
 * Resolves hostname and rejects non-public destinations.
 */

const BLOCKED_HOSTS = new Set([
  "localhost",
  "metadata.google.internal",
  "metadata",
  "instance-data",
]);

function isPrivateIp(ip: string): boolean {
  const v = isIP(ip);
  if (v === 4) {
    const parts = ip.split(".").map(Number);
    const [a, b] = parts;
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    if (a >= 224) return true; // multicast / reserved
    return false;
  }
  if (v === 6) {
    const lower = ip.toLowerCase();
    if (lower === "::" || lower === "::1") return true;
    if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // ULA
    if (lower.startsWith("fe80")) return true; // link-local
    if (lower.startsWith("ff")) return true; // multicast
    // IPv4-mapped
    if (lower.startsWith("::ffff:")) {
      const mapped = lower.slice("::ffff:".length);
      if (isIP(mapped) === 4) return isPrivateIp(mapped);
    }
    return false;
  }
  return true;
}

export async function assertPublicUrl(input: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new Error("Invalid URL");
  }

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("Only http(s) URLs are allowed");
  }

  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (!host || BLOCKED_HOSTS.has(host) || host.endsWith(".localhost") || host.endsWith(".local")) {
    throw new Error("URL host is not allowed");
  }

  // Direct IP literal
  if (isIP(host)) {
    if (isPrivateIp(host)) throw new Error("Private IP addresses are not allowed");
    return url;
  }

  // Resolve all addresses
  let records: { address: string; family: number }[] = [];
  try {
    records = await lookup(host, { all: true, verbatim: true });
  } catch {
    throw new Error("Could not resolve host");
  }

  if (!records.length) throw new Error("Could not resolve host");
  for (const rec of records) {
    if (isPrivateIp(rec.address)) {
      throw new Error("URL resolves to a private address");
    }
  }

  return url;
}

export const MAX_REDIRECTS = 5;
export const MAX_FETCH_BYTES = 2_000_000;

export type SafeFetchInit = Omit<RequestInit, "redirect"> & {
  maxBytes?: number;
  maxRedirects?: number;
};

/**
 * Fetch a public URL, re-validating every redirect hop (no blind follow).
 */
export async function safeFetch(
  input: string,
  init: SafeFetchInit = {}
): Promise<Response> {
  const maxBytes = init.maxBytes ?? MAX_FETCH_BYTES;
  const maxRedirects = init.maxRedirects ?? MAX_REDIRECTS;
  const { maxBytes: _ignoredMaxBytes, maxRedirects: _ignoredMaxRedirects, ...rest } =
    init;
  void _ignoredMaxBytes;
  void _ignoredMaxRedirects;

  let current = (await assertPublicUrl(input)).toString();

  for (let hop = 0; hop <= maxRedirects; hop++) {
    const res = await fetch(current, {
      ...rest,
      redirect: "manual",
    });

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (!location) {
        throw new Error("Redirect missing Location header");
      }
      let next: URL;
      try {
        next = new URL(location, current);
      } catch {
        throw new Error("Invalid redirect Location");
      }
      current = (await assertPublicUrl(next.toString())).toString();
      continue;
    }

    const declared = res.headers.get("content-length");
    if (declared && Number(declared) > maxBytes) {
      throw new Error("Response too large");
    }

    return res;
  }

  throw new Error("Too many redirects");
}

/** Read response body with a hard byte cap. */
export async function readResponseText(
  res: Response,
  maxBytes = MAX_FETCH_BYTES
): Promise<string> {
  const buf = await res.arrayBuffer();
  if (buf.byteLength > maxBytes) {
    throw new Error("Response too large");
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(buf);
}
