import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";

const CACHE_DIR = new URL("../../.cache/", import.meta.url);

export async function readCache<T>(key: string, ttlMs: number): Promise<T | null> {
  try {
    const path = cachePathFor(key);
    const raw = await readFile(path, "utf8");
    const parsed = JSON.parse(raw) as { writtenAt: number; value: T };
    if (Date.now() - parsed.writtenAt > ttlMs) return null;
    return parsed.value;
  } catch {
    return null;
  }
}

export async function writeCache<T>(key: string, value: T): Promise<void> {
  await mkdir(CACHE_DIR, { recursive: true });
  const path = cachePathFor(key);
  await writeFile(path, JSON.stringify({ writtenAt: Date.now(), value }, null, 2));
}

function cachePathFor(key: string): URL {
  const digest = createHash("sha256").update(key).digest("hex");
  return new URL(`${digest}.json`, CACHE_DIR);
}
