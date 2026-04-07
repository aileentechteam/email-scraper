import { readCache, writeCache } from "./cache.js";

const DEFAULT_TTL_MS = 1000 * 60 * 60 * 12;

export async function canFetchUrl(url: string, userAgent: string): Promise<boolean> {
  try {
    const parsed = new URL(url);
    const robotsUrl = `${parsed.protocol}//${parsed.hostname}/robots.txt`;
    const cacheKey = `robots:${robotsUrl}`;
    const cached = await readCache<string>(cacheKey, DEFAULT_TTL_MS);
    const body = cached ?? await fetchRobots(robotsUrl, cacheKey, userAgent);
    if (!body) return true;
    return isAllowed(body, parsed.pathname, userAgent);
  } catch {
    return true;
  }
}

async function fetchRobots(url: string, cacheKey: string, userAgent: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": userAgent },
      signal: AbortSignal.timeout(Number(process.env.REQUEST_TIMEOUT_MS ?? 10000)),
    });
    if (!response.ok) return null;
    const text = await response.text();
    await writeCache(cacheKey, text);
    return text;
  } catch {
    return null;
  }
}

function isAllowed(robotsBody: string, path: string, userAgent: string): boolean {
  const lines = robotsBody.split(/\r?\n/).map((line) => line.trim());
  const ua = userAgent.toLowerCase();
  let active = false;
  const disallow: string[] = [];

  for (const line of lines) {
    if (!line || line.startsWith("#")) continue;
    const [rawKey, ...rest] = line.split(":");
    const key = rawKey.toLowerCase();
    const value = rest.join(":").trim();
    if (key === "user-agent") active = value === "*" || ua.includes(value.toLowerCase());
    if (active && key === "disallow" && value) disallow.push(value);
  }

  return !disallow.some((rule) => path.startsWith(rule));
}
