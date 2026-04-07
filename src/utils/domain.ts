export function normalizeDomain(input: string): string {
  const trimmed = input.trim();
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  const url = new URL(withProtocol);
  return url.hostname.replace(/^www\./, "").toLowerCase();
}

export function rootUrl(domain: string): string {
  return `https://${domain}`;
}

export function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function toSlugPart(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}
