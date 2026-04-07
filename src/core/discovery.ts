import { gatherDomainClues } from "./crawler.js";
import type { DiscoveryResult, DomainClues, EmailCandidate, EmailLabel, VerificationResult } from "./types.js";
import { clamp, toSlugPart, unique } from "../utils/domain.js";
import { createVerifier } from "../providers/index.js";

const GENERIC_PATTERNS = [
  { local: "wholesale", label: "wholesale likely" as EmailLabel, base: 0.92 },
  { local: "partnerships", label: "buyer/partnerships likely" as EmailLabel, base: 0.88 },
  { local: "sales", label: "buyer/partnerships likely" as EmailLabel, base: 0.82 },
  { local: "orders", label: "buyer/partnerships likely" as EmailLabel, base: 0.79 },
  { local: "hello", label: "generic inbox" as EmailLabel, base: 0.7 },
  { local: "contact", label: "generic inbox" as EmailLabel, base: 0.67 },
  { local: "info", label: "generic inbox" as EmailLabel, base: 0.61 },
  { local: "team", label: "generic inbox" as EmailLabel, base: 0.55 },
  { local: "support", label: "support only / low priority" as EmailLabel, base: 0.25 },
];

export async function discoverEmails(input: string, forceRefresh = false): Promise<DiscoveryResult> {
  const clues = await gatherDomainClues(input, forceRefresh);
  const verifier = createVerifier();
  const candidates = await buildCandidates(clues, verifier.verify.bind(verifier));
  candidates.sort((a, b) => a.priority - b.priority || b.confidence - a.confidence);
  const top = candidates.slice(0, 3);

  return {
    domain: clues.rootDomain,
    companyName: clues.companyName,
    businessType: clues.businessType,
    bestFirstOutreach: top[0] ?? null,
    candidates: top,
    confidenceSummary: buildConfidenceSummary(top),
    outreachNotes: buildOutreachNotes(clues, top),
  };
}

async function buildCandidates(
  clues: DomainClues,
  verify: (email: string) => Promise<VerificationResult>,
): Promise<EmailCandidate[]> {
  const rawCandidates: Array<Omit<EmailCandidate, "verification">> = [];

  for (const pattern of GENERIC_PATTERNS) {
    const local = pattern.local;
    const email = `${local}@${clues.rootDomain}`;
    const bonus = scoreGenericBonus(local, clues);
    rawCandidates.push({
      email,
      label: pattern.label,
      confidence: clamp(pattern.base + bonus, 0, 0.98),
      explanation: genericExplanation(local, clues),
      priority: priorityForLabel(pattern.label, local),
      inferredFrom: "generic_pattern",
    });
  }

  for (const person of clues.personClues.slice(0, 6)) {
    if (!person.firstName) continue;
    const first = toSlugPart(person.firstName);
    const last = person.lastName ? toSlugPart(person.lastName) : "";
    const patterns = unique([
      `${first}@${clues.rootDomain}`,
      last ? `${first}.${last}@${clues.rootDomain}` : "",
      last ? `${first}${last}@${clues.rootDomain}` : "",
    ].filter(Boolean));

    for (const email of patterns) {
      const label = labelFromTitle(person.title);
      rawCandidates.push({
        email,
        label,
        confidence: clamp(scorePersonCandidate(person, email), 0, 0.97),
        explanation: `Built from public name clue ${person.name}${person.title ? ` (${person.title})` : ""} found on ${person.sourceUrl ?? "site"}.`,
        priority: priorityForPerson(person.title),
        inferredFrom: "person_clue",
      });
    }
  }

  const deduped = dedupeBest(rawCandidates).slice(0, 10);
  const verified = await Promise.all(
    deduped.map(async (candidate) => ({
      ...candidate,
      verification: await verify(candidate.email),
    })),
  );

  return verified.map(applyVerificationAdjustments).sort((a, b) => a.priority - b.priority || b.confidence - a.confidence);
}

function scoreGenericBonus(local: string, clues: DomainClues): number {
  let bonus = 0;
  if (clues.roleClues.includes(local)) bonus += 0.08;
  if (clues.genericInboxHints.includes(local)) bonus += 0.05;
  if (local === "wholesale" && clues.businessType !== "other") bonus += 0.04;
  if (["church_bookstore", "gift_shop", "boutique", "retailer"].includes(clues.businessType) && ["wholesale", "partnerships", "orders"].includes(local)) bonus += 0.03;
  return bonus;
}

function genericExplanation(local: string, clues: DomainClues): string {
  if (local === "wholesale") return `Wholesale-specific inbox pattern on ${clues.rootDomain}; strongest likely route for Not Just Sundays wholesale outreach.`;
  if (local === "partnerships") return `Partnerships mailbox pattern fits retail/wholesale conversations and outbound collaboration outreach.`;
  if (local === "sales" || local === "orders") return `Commercial inbox pattern likely handled by order operations, retail coordination, or business development.`;
  if (local === "hello" || local === "contact" || local === "info") return `General business inbox pattern used as fallback when no stronger buyer or owner route is visible.`;
  return `Useful fallback inbox pattern on ${clues.rootDomain}, but likely lower priority for wholesale outreach.`;
}

function scorePersonCandidate(person: DomainClues["personClues"][number], email: string): number {
  const title = person.title?.toLowerCase() ?? "";
  let score = 0.68;
  if (title.includes("buyer") || title.includes("partnership") || title.includes("wholesale")) score += 0.2;
  if (title.includes("manager") || title.includes("bookstore") || title.includes("retail")) score += 0.13;
  if (title.includes("founder") || title.includes("owner") || title.includes("ceo")) score += 0.14;
  if (title.includes("ministry")) score += 0.11;
  if (email.includes(".")) score += 0.02;
  return score;
}

function labelFromTitle(title?: string): EmailLabel {
  const lower = title?.toLowerCase() ?? "";
  if (lower.includes("buyer") || lower.includes("partnership") || lower.includes("wholesale")) return "buyer/partnerships likely";
  if (lower.includes("founder") || lower.includes("owner") || lower.includes("ceo") || lower.includes("manager") || lower.includes("bookstore") || lower.includes("retail")) return "founder/owner likely";
  return "generic inbox";
}

function priorityForLabel(label: EmailLabel, local: string): number {
  if (local === "wholesale") return 1;
  if (label === "buyer/partnerships likely") return 2;
  if (label === "founder/owner likely") return 3;
  if (label === "generic inbox") return 4;
  return 5;
}

function priorityForPerson(title?: string): number {
  const lower = title?.toLowerCase() ?? "";
  if (lower.includes("buyer") || lower.includes("partnership") || lower.includes("wholesale")) return 1;
  if (lower.includes("manager") || lower.includes("retail") || lower.includes("bookstore") || lower.includes("ministry")) return 2;
  if (lower.includes("founder") || lower.includes("owner") || lower.includes("ceo")) return 3;
  return 4;
}

function dedupeBest(candidates: Array<Omit<EmailCandidate, "verification">>): Array<Omit<EmailCandidate, "verification">> {
  const map = new Map<string, Omit<EmailCandidate, "verification">>();
  for (const candidate of candidates) {
    const current = map.get(candidate.email);
    if (!current || candidate.priority < current.priority || candidate.confidence > current.confidence) map.set(candidate.email, candidate);
  }
  return [...map.values()];
}

function applyVerificationAdjustments(candidate: EmailCandidate): EmailCandidate {
  const v = candidate.verification;
  let confidence = candidate.confidence;
  if (v.status === "verified") confidence += 0.08;
  if (v.status === "likely valid") confidence += 0.02;
  if (v.status === "catch-all / uncertain") confidence -= 0.12;
  if (v.status === "invalid") confidence = Math.min(confidence, 0.15);
  if (v.disposable || v.risky) confidence -= 0.1;
  return { ...candidate, confidence: clamp(confidence, 0, 0.99) };
}

function buildConfidenceSummary(candidates: EmailCandidate[]): string {
  if (!candidates.length) return "No strong outreach emails found.";
  return candidates
    .map((candidate) => `${candidate.email}: ${Math.round(candidate.confidence * 100)}% (${candidate.verification.status})`)
    .join(" | ");
}

function buildOutreachNotes(clues: DomainClues, candidates: EmailCandidate[]): string {
  const businessType = clues.businessType.replace(/_/g, " ");
  const best = candidates[0];
  const roleHint = clues.personClues[0]?.title ?? clues.roleClues[0] ?? "no direct role clue";
  return `Business type looks like ${businessType}. Best outreach route is ${best?.email ?? "none"} because it maps most closely to wholesale/buyer access. Public role clue: ${roleHint}. Use softer retail/wholesale positioning for first touch.`;
}
