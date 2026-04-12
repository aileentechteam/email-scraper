# Not Just Sundays Wholesale Email Finder

Production-oriented internal lead enrichment tool for Not Just Sundays wholesale outreach.

## Best first-use flow

Use it in this order:

```bash
npm run dev -- doctor
npm run dev -- notion-sync --dry-run --limit=5
npm run dev -- notion-sync --limit=25
npm run dev -- notion-sync
```

That lets you:
- confirm your Notion schema
- preview what would be written
- test a small batch
- then run the real sync

## Current usable-state goals

This version is meant to be the first actually usable internal ops tool:

- env loads automatically from `.env`
- there is a `doctor` command to validate Notion setup before syncing
- there is a `--dry-run` mode so you can preview writes first
- sync skips rows already processed unless `--force`
- you can test with `--limit=25` before running the full table
- crawl is lightweight, cached, and robots-aware
- MVP runs with no external verifier
- V2 verifies only the top-ranked email to keep cost down

## MVP approach

- No external verifier by default
- Use inference + confidence scoring + manual review
- If you enable a verifier later, only the top-ranked email is verified
- Remaining candidates stay inferred so costs stay low

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

EMAIL_VERIFIER_PROVIDER=none
```

## Recommended Notion schema

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

Check setup first:

```bash
npm run dev -- doctor
```

Inspect one domain:

```bash
npm run dev -- inspect https://example.com
npm run dev -- inspect https://example.com --force
```

Preview a small batch without writing to Notion:

```bash
npm run dev -- notion-sync --dry-run --limit=5
```

Run a safe test batch first:

```bash
npm run dev -- notion-sync --limit=25
```

Run full sync:

```bash
npm run dev -- notion-sync
```

Force reprocess all rows:

```bash
npm run dev -- notion-sync --force
```

Typecheck:

```bash
npm run check
```

## Verification providers

Supported:

- none (recommended MVP default)
- hunter
- zerobounce
- abstract
- mailboxlayer

## Recommended rollout

### MVP

```text
- EMAIL_VERIFIER_PROVIDER=none
- no external verification spend
- use the top 2 to 3 inferred emails with confidence notes
```

### V2

```text
- turn on one low-cost verifier
- verify only the best-ranked email
- keep recommended_email_2 and recommended_email_3 inference-only
```

## Safety notes

- Inferred emails are not treated as certain facts
- Verified is reserved for strong provider outcomes only
- Catch-all and ambiguous results are downgraded
- Crawl stays lightweight and domain-limited
- `robots.txt` is checked before fetching candidate pages

## Best next improvements

- add structured CSV export
- add richer tests on real lead samples
- add a tiny web UI for non-technical use
- add retries/backoff for provider APIs
- add better company/person extraction heuristics
