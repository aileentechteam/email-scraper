export type BusinessType =
  | "retailer"
  | "boutique"
  | "concept_store"
  | "church_bookstore"
  | "gift_shop"
  | "ecommerce_brand"
  | "other";

export type EmailLabel =
  | "generic inbox"
  | "founder/owner likely"
  | "buyer/partnerships likely"
  | "wholesale likely"
  | "support only / low priority";

export type VerificationStatus =
  | "verified"
  | "likely valid"
  | "catch-all / uncertain"
  | "invalid";

export interface PersonClue {
  name: string;
  firstName?: string;
  lastName?: string;
  title?: string;
  sourceUrl?: string;
}

export interface DomainClues {
  input: string;
  rootDomain: string;
  companyName?: string;
  businessType: BusinessType;
  urlsVisited: string[];
  pageTextSnippets: string[];
  personClues: PersonClue[];
  roleClues: string[];
  genericInboxHints: string[];
}

export interface VerificationResult {
  status: VerificationStatus;
  provider: string;
  mxFound?: boolean;
  deliverability?: string;
  catchAll?: boolean;
  disposable?: boolean;
  risky?: boolean;
  raw?: unknown;
}

export interface EmailCandidate {
  email: string;
  label: EmailLabel;
  confidence: number;
  explanation: string;
  priority: number;
  verification: VerificationResult;
  inferredFrom: "generic_pattern" | "person_clue" | "observed_on_site";
}

export interface DiscoveryResult {
  domain: string;
  companyName?: string;
  businessType: BusinessType;
  bestFirstOutreach: EmailCandidate | null;
  candidates: EmailCandidate[];
  outreachNotes: string;
  confidenceSummary: string;
}
