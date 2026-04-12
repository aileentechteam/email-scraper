export interface NotionFieldMap {
  domainProperty: string;
  recommended1: string;
  recommended2: string;
  recommended3: string;
  bestEmail: string;
  confidenceSummary: string;
  verificationStatus: string;
  outreachNotes: string;
  processedAt: string;
  error: string;
}

export function getNotionFieldMap(): NotionFieldMap {
  return {
    domainProperty: process.env.NOTION_DOMAIN_PROPERTY ?? "Website",
    recommended1: process.env.NOTION_RECOMMENDED_EMAIL_1_PROPERTY ?? "recommended_email_1",
    recommended2: process.env.NOTION_RECOMMENDED_EMAIL_2_PROPERTY ?? "recommended_email_2",
    recommended3: process.env.NOTION_RECOMMENDED_EMAIL_3_PROPERTY ?? "recommended_email_3",
    bestEmail: process.env.NOTION_BEST_EMAIL_PROPERTY ?? "best_email",
    confidenceSummary: process.env.NOTION_CONFIDENCE_SUMMARY_PROPERTY ?? "confidence_summary",
    verificationStatus: process.env.NOTION_VERIFICATION_STATUS_PROPERTY ?? "verification_status",
    outreachNotes: process.env.NOTION_OUTREACH_NOTES_PROPERTY ?? "outreach_notes",
    processedAt: process.env.NOTION_PROCESSED_AT_PROPERTY ?? "processed_at",
    error: process.env.NOTION_ERROR_PROPERTY ?? "notes_error",
  };
}

export function requiredEnvMissing(): string[] {
  const required = ["NOTION_API_KEY", "NOTION_DATABASE_ID"];
  return required.filter((key) => !process.env[key]);
}
