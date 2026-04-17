import type { DiscoveryResult } from "./types.js";
import { toCsv } from "../utils/csv.js";

export function discoveryResultToRows(result: DiscoveryResult): Array<Record<string, string>> {
  return result.candidates.map((candidate, index) => ({
    domain: result.domain,
    company_name: result.companyName ?? "",
    business_type: result.businessType,
    rank: String(index + 1),
    email: candidate.email,
    label: candidate.label,
    confidence: String(Math.round(candidate.confidence * 100)),
    verification_status: candidate.verification.status,
    verification_provider: candidate.verification.provider,
    inferred_from: candidate.inferredFrom,
    explanation: candidate.explanation,
    best_first_outreach: result.bestFirstOutreach?.email ?? "",
    confidence_summary: result.confidenceSummary,
    outreach_notes: result.outreachNotes,
  }));
}

export function discoveryResultsToCsv(results: DiscoveryResult[]): string {
  const rows = results.flatMap(discoveryResultToRows);
  return toCsv(rows);
}
