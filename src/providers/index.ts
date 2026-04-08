import type { VerificationResult } from "../core/types.js";

export interface EmailVerifier {
  verify(email: string): Promise<VerificationResult>;
}

class NoopVerifier implements EmailVerifier {
  async verify(): Promise<VerificationResult> {
    return {
      provider: "none",
      status: "catch-all / uncertain",
      mxFound: undefined,
      raw: { note: "No external verifier configured. Inference-only mode." },
    };
  }
}

class HunterVerifier implements EmailVerifier {
  async verify(email: string): Promise<VerificationResult> {
    return callJsonApi(
      `https://api.hunter.io/v2/email-verifier?email=${encodeURIComponent(email)}&api_key=${process.env.HUNTER_API_KEY ?? ""}`,
      "hunter",
      (json: any) => ({
        provider: "hunter",
        status: mapStatus(json?.data?.status, json?.data?.result),
        mxFound: json?.data?.mx_records,
        catchAll: json?.data?.accept_all,
        disposable: json?.data?.disposable,
        risky: json?.data?.webmail,
        deliverability: json?.data?.result,
        raw: json,
      }),
    );
  }
}

class ZeroBounceVerifier implements EmailVerifier {
  async verify(email: string): Promise<VerificationResult> {
    return callJsonApi(
      `https://api.zerobounce.net/v2/validate?api_key=${process.env.ZEROBOUNCE_API_KEY ?? ""}&email=${encodeURIComponent(email)}`,
      "zerobounce",
      (json: any) => ({
        provider: "zerobounce",
        status: mapStatus(json?.status, json?.sub_status),
        mxFound: json?.mx_found,
        catchAll: json?.sub_status === "catch-all",
        disposable: json?.disposable,
        risky: json?.status === "unknown",
        deliverability: json?.sub_status,
        raw: json,
      }),
    );
  }
}

class AbstractVerifier implements EmailVerifier {
  async verify(email: string): Promise<VerificationResult> {
    return callJsonApi(
      `https://emailvalidation.abstractapi.com/v1/?api_key=${process.env.ABSTRACT_API_KEY ?? ""}&email=${encodeURIComponent(email)}`,
      "abstract",
      (json: any) => ({
        provider: "abstract",
        status: mapAbstract(json),
        mxFound: json?.is_mx_found?.value,
        catchAll: json?.is_catchall_email?.value,
        disposable: json?.is_disposable_email?.value,
        risky: !json?.deliverability || json?.deliverability === "UNKNOWN",
        deliverability: json?.deliverability,
        raw: json,
      }),
    );
  }
}

class MailboxlayerVerifier implements EmailVerifier {
  async verify(email: string): Promise<VerificationResult> {
    return callJsonApi(
      `https://apilayer.net/api/check?access_key=${process.env.MAILBOXLAYER_API_KEY ?? ""}&email=${encodeURIComponent(email)}&smtp=1&format=1`,
      "mailboxlayer",
      (json: any) => ({
        provider: "mailboxlayer",
        status: mapMailboxlayer(json),
        mxFound: json?.mx_found,
        catchAll: json?.catch_all,
        disposable: json?.disposable,
        risky: json?.score != null && json.score < 0.65,
        deliverability: json?.score != null ? String(json.score) : undefined,
        raw: json,
      }),
    );
  }
}

export function createVerifier(): EmailVerifier {
  switch ((process.env.EMAIL_VERIFIER_PROVIDER ?? "none").toLowerCase()) {
    case "hunter": return new HunterVerifier();
    case "zerobounce": return new ZeroBounceVerifier();
    case "abstract": return new AbstractVerifier();
    case "mailboxlayer": return new MailboxlayerVerifier();
    default: return new NoopVerifier();
  }
}

export function verificationEnabled(): boolean {
  return (process.env.EMAIL_VERIFIER_PROVIDER ?? "none").toLowerCase() !== "none";
}

async function callJsonApi(url: string, provider: string, mapper: (json: unknown) => VerificationResult): Promise<VerificationResult> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(Number(process.env.REQUEST_TIMEOUT_MS ?? 10000)) });
    if (!response.ok) {
      return { provider, status: "catch-all / uncertain", raw: { httpStatus: response.status } };
    }
    const json = await response.json();
    return mapper(json);
  } catch (error) {
    return { provider, status: "catch-all / uncertain", raw: { error: String(error) } };
  }
}

function mapStatus(status?: string, secondary?: string): VerificationResult["status"] {
  const lower = `${status ?? ""} ${secondary ?? ""}`.toLowerCase();
  if (lower.includes("deliverable") || lower.includes("valid") || lower.includes("verified")) return "verified";
  if (lower.includes("accept_all") || lower.includes("catch-all")) return "catch-all / uncertain";
  if (lower.includes("risky") || lower.includes("unknown")) return "catch-all / uncertain";
  if (lower.includes("invalid") || lower.includes("undeliverable")) return "invalid";
  return "likely valid";
}

function mapAbstract(json: any): VerificationResult["status"] {
  if (json?.is_smtp_valid?.value && json?.deliverability === "DELIVERABLE") return "verified";
  if (json?.is_catchall_email?.value) return "catch-all / uncertain";
  if (json?.is_valid_format?.value === false || json?.is_smtp_valid?.value === false) return "invalid";
  return "likely valid";
}

function mapMailboxlayer(json: any): VerificationResult["status"] {
  if (json?.format_valid && json?.smtp_check && json?.score >= 0.85) return "verified";
  if (json?.catch_all) return "catch-all / uncertain";
  if (json?.smtp_check === false || json?.format_valid === false) return "invalid";
  return "likely valid";
}
