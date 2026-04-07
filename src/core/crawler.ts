import { normalizeDomain, rootUrl, unique } from "../utils/domain.js";
import { canFetchUrl } from "../utils/robots.js";
import { readCache, writeCache } from "../utils/cache.js";
import type { BusinessType, DomainClues, PersonClue } from "./types.js";

const PAGE_CANDIDATES = ["", "/contact", "/about", "/team", "/pages/about", "/pages/contact", "/press", "/wholesale", "/stockists"];
const CRAWL_CACHE_TTL_MS = 1000 * 60 * 60 * 24;

export async function gatherDomainClues(input: string, forceRefresh = false): Promise<DomainClues> {
  const domain = normalizeDomain(input);
  const cacheKey = `crawl:${domain}`;
  if (!forceRefresh) {
    const cached = await readCache<DomainClues>(cacheKey, CRAWL_CACHE_TTL_MS);
    if (cached) return cached;
  }

  const base = rootUrl(domain);
  const urls = PAGE_CANDIDATES.map((path) => `${base}${path}`);
  const visited: string[] = [];
  const snippets: string[] = [];
  const roleClues: string[] = [];
  const genericHints: string[] = [];
  const people: PersonClue[] = [];
  let companyName: string | undefined;
  const userAgent = process.env.USER_AGENT ?? "NotJustSundaysWholesaleProspector/0.1";

  for (const url of urls) {
    try {
      if (!(await canFetchUrl(url, userAgent))) continue;
      const response = await fetch(url, {
        headers: { "User-Agent": userAgent },
        signal: AbortSignal.timeout(Number(process.env.REQUEST_TIMEOUT_MS ?? 10000)),
      });
      if (!response.ok || !response.headers.get("content-type")?.includes("text/html")) continue;
      const html = await response.text();
      visited.push(url);
      const text = html
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      snippets.push(text.slice(0, 1200));
      companyName ??= extractTitleCompany(html, domain);
      people.push(...extractPeople(text, url));
      roleClues.push(...extractRoleClues(text));
      genericHints.push(...extractGenericInboxHints(text));
    } catch {
      continue;
    }
  }

  const result: DomainClues = {
    input,
    rootDomain: domain,
    companyName,
    businessType: detectBusinessType(snippets.join(" ")),
    urlsVisited: visited,
    pageTextSnippets: snippets,
    personClues: dedupePeople(people),
    roleClues: unique(roleClues.map((s) => s.toLowerCase())),
    genericInboxHints: unique(genericHints.map((s) => s.toLowerCase())),
  };

  await writeCache(cacheKey, result);
  return result;
}

function extractTitleCompany(html: string, domain: string): string | undefined {
  const match = html.match(/<title>(.*?)<\/title>/i);
  const raw = match?.[1]?.replace(/\s*\|.*$/, "").replace(/\s*-.*$/, "").trim();
  if (raw && raw.length > 1) return raw;
  return domain.split(".")[0];
}

function extractPeople(text: string, sourceUrl: string): PersonClue[] {
  const titles = ["founder", "owner", "buyer", "director", "partnerships", "wholesale", "co-founder", "ceo", "manager", "bookstore manager", "retail manager"];
  const results: PersonClue[] = [];
  const pattern = /([A-Z][a-z]+\s+[A-Z][a-z]+)\s*[\-–|,]\s*([^\.\n]{2,80})/g;
  for (const match of text.matchAll(pattern)) {
    const name = match[1]?.trim();
    const title = match[2]?.trim();
    if (!name || !title) continue;
    if (!titles.some((t) => title.toLowerCase().includes(t))) continue;
    const [firstName, lastName] = name.split(/\s+/, 2);
    results.push({ name, firstName, lastName, title, sourceUrl });
  }
  return results;
}

function extractRoleClues(text: string): string[] {
  const roles = ["buyer", "wholesale", "partnerships", "stockist", "owner", "founder", "sales", "orders", "manager", "bookstore manager", "retail manager", "ministry"];
  return roles.filter((role) => text.toLowerCase().includes(role));
}

function extractGenericInboxHints(text: string): string[] {
  const hints = ["wholesale", "stockist", "contact", "hello", "info", "sales", "orders", "support", "partnerships"];
  return hints.filter((hint) => text.toLowerCase().includes(hint));
}

function dedupePeople(people: PersonClue[]): PersonClue[] {
  const seen = new Set<string>();
  return people.filter((person) => {
    const key = `${person.name.toLowerCase()}|${person.title?.toLowerCase() ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function detectBusinessType(text: string): BusinessType {
  const lower = text.toLowerCase();
  if (lower.includes("church") && lower.includes("book")) return "church_bookstore";
  if (lower.includes("gift shop") || lower.includes("souvenir")) return "gift_shop";
  if (lower.includes("concept store")) return "concept_store";
  if (lower.includes("boutique")) return "boutique";
  if (lower.includes("retailer") || lower.includes("stockist")) return "retailer";
  if (lower.includes("shopify") || lower.includes("add to cart") || lower.includes("checkout")) return "ecommerce_brand";
  return "other";
}
