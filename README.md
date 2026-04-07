# Not Just Sundays Wholesale Email Finder

Production-oriented internal lead enrichment tool for Not Just Sundays wholesale outreach.

## Features

- Reads lead rows from Notion
- Finds website/domain field
- Skips processed rows unless `--force` is used
- Light, domain-limited crawl of public pages
- Respects `robots.txt` when checking candidate pages
- Extracts names, titles, and wholesale-relevant contact clues
- Infers likely business emails when none are explicitly listed
- Prioritizes owner, founder, buyer, partnerships, wholesale, manager, bookstore/ministry contacts
- Verifies emails through a pluggable provider adapter
- Writes structured results back into dedicated Notion fields
- Logs failures into a Notion error field
- Caches crawl results to reduce repeated requests

## Install

```bash
cd /home/ubuntu/shared-projects/not-just-sundays/wholesale-email-finder
npm install
cp .env.example .env
```

## Configure env

```bash
NOTION_API_KEY=
NOTION_DATABASE_ID=
NOTION_DOMAIN_PROPERTY=Website
NOTION_RECOMMENDED_EMAIL_1_PROPERTY=recommended_email_1
NOTION_RECOMMENDED_EMAIL_2_PROPERTY=recommended_email_2
NOTION_RECOMMENDED_EMAIL_3_PROPERTY=recommended_email_3
NOTION_BEST_EMAIL_PROPERTY=best_email
NOTION_CONFIDENCE_SUMMARY_PROPERTY=confidence_summary
NOTION_VERIFICATION_STATUS_PROPERTY=verification_status
NOTION_OUTREACH_NOTES_PROPERTY=outreach_notes
NOTION_PROCESSED_AT_PROPERTY=processed_at
NOTION_ERROR_PROPERTY=notes_error

EMAIL_VERIFIER_PROVIDER=hunter
HUNTER_API_KEY=
ZEROBOUNCE_API_KEY=
ABSTRACT_API_KEY=
MAILBOXLAYER_API_KEY=
```

## Notion schema assumptions

Recommended properties:

```text
Website
recommended_email_1
recommended_email_2
recommended_email_3
best_email
confidence_summary
verification_status
outreach_notes
processed_at
notes_error
```

## Commands

Inspect one domain:

```bash
npm run dev -- inspect https://example.com
npm run dev -- inspect https://example.com --force
```

Batch enrich Notion:

```bash
npm run dev -- notion-sync
npm run dev -- notion-sync --force
```

Typecheck:

```bash
npm run check
```

## Verification providers

Pick one with:

```bash
EMAIL_VERIFIER_PROVIDER=hunter
```

Supported:

- hunter
- zerobounce
- abstract
- mailboxlayer

## Safety notes

- Inferred emails are not treated as certain facts
- Verified is reserved for strong provider outcomes only
- Catch-all and ambiguous results are downgraded
- Crawl stays lightweight and domain-limited
- `robots.txt` is checked before fetching candidate pages

## Deployment options

Good MVP deployment targets:

- small cron-driven Node worker
- Railway/Render background service
- GitHub Actions scheduled job
- local ops box running on a timer
