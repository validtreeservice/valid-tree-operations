# Commercial Proposals - Operations 2.7.0

This adds Proposals beside Estimates. It preserves React, Supabase, customer records, jobs, invoices and authentication. Residential Estimate and Contract forms, numbering and approval routes are unchanged.

## Install on the existing operations website

1. Keep the existing Supabase project, environment settings, domain and Stripe configuration.
2. Ensure the existing migrations through 013 have already been applied.
3. In the same project's Supabase SQL Editor, run supabase/migrations/014_commercial_proposals.sql as the database administrator.
4. Publish the included dist files through the existing operations hosting project, not the public marketing website.
5. Refresh and sign in. The sidebar should show v2.7.0 with Proposals next to Estimates.

Apply the database update before deploying the app. Without migration 014, Proposals explains the missing setup; existing workspace loading and Estimates do not depend on the new tables.

## Prepare the six-acre bid

- Proposals > New Proposal > Use six-acre project template.
- Link a customer or enter the contact/company and project address.
- Confirm boundaries, preliminary quantities, stump/root scope, building details and pavement removal limits.
- Edit, move, remove or add sections. Formatting supports bold, italic, bullets and numbered lists with a formatted preview.
- Choose lump sum or itemized pricing. Enter your selling price; mark bundled lines Included.
- Enter duration, estimated start, mobilization, payment terms and milestone payments.
- Add up to 16 site photos and captions. The first photo appears on the cover. Images are optimized and EXIF/GPS metadata is removed.
- Save Draft and review Preview before generating a PDF or issuing the proposal.
- Generate PDF opens the browser Print / Save as PDF dialog. Use Letter paper and disable the browser's own headers/footers if they overlap the document footer. Content determines page count.
- Send Proposal saves and locks an issued version, then provides Copy Link and Open Email Draft. It does not send email automatically.

No customer, address, project price or site photos are fabricated. Complete the project details before issue.

## Customer acceptance and jobs

- Customer links do not require an account. Anyone with the unique link can view the issued proposal; share only with intended recipients.
- The link exposes only the frozen customer document, response status and acceptance, never internal office notes or costing fields.
- Customers can print/save, decline, or accept with a representative, company, typed electronic signature and explicit consent.
- Acceptance records the server timestamp, consent, revision and SHA-256 document hash. It is not independent identity verification or a third-party signature certificate.
- Expiration is enforced through the end of the expiration date in America/Chicago.
- Viewed means link access; automated email previews can trigger it.
- Withdraw & Edit revokes the old link. Reissue to create a fresh link.
- Accepted proposals cannot be reopened. Use Duplicate as New for a different offer.
- Convert to Job is accepted-only and idempotent. It creates an Unscheduled job preserving customer, address, scope, amount, photos, terms, acceptance and internal notes.
- Schedule it in job details. Existing crew, field-report and invoice workflows continue.
- The accepted document and photos are accessible from the link in job details. They are not duplicated into the field-report photo bucket.
- Commercial milestone invoices do not replace the full accepted job value in profitability reports. Create invoices and collect payments through the existing invoice workflow.

## Saved clauses

Includes starting language for asbestos/environmental clearance, hazardous materials, underground conditions, utilities, access, weather, change orders, hauling/disposal, customer/GC responsibility, grading, permits and unforeseen conditions.

Customize & Save creates a company clause. Editing or deleting a library clause does not rewrite existing proposals. These are editable starting points, not legal advice; have qualified counsel and relevant professionals review substantial commercial bids.

Demolition language requires inspection/clearance, appropriate abatement documentation, approvals and applicable notices before affected work. Reference checked September 2, 2026: Texas DSHS [General Asbestos FAQs](https://www.dshs.texas.gov/asbestos-program/frequently-asked-questions-faqs/frequently-asked-questions-general-asbestos-program) and [Asbestos Notifications](https://www.dshs.texas.gov/asbestos-program/notifications-asbestos-program).

## Security and storage

- Separate commercial_proposals, commercial_proposal_counters and proposal_clauses tables.
- Active owner/office staff manage proposals. RLS isolates companies. Direct proposal writes are denied; validated RPCs handle changes.
- Atomic per-company/year counter and unique constraint, independent of other document numbers.
- Revision checks prevent stale overwrites; row locks protect issue, withdrawal, acceptance and conversion.
- Optimized photos are embedded in the private proposal and frozen snapshot. At most 16 images, 350,000 encoded characters each, 6 MB total content. No public image bucket or service-role key is needed.
- Dashboard reads exclude large document fields.
- Demo mode is explicitly device-local and cannot send real links, accept customers or convert jobs.
- Installation does not send proposals, modify existing customer prices or change Stripe.

## Verification

Run npm run check, npm test and npm run parse. Standard production build: npm run build.

This Windows environment rejects anonymous child-process pipes used by the normal build. The additional npm run build:portable command uses the same installed esbuild, source, environment settings and static assets with inherited standard IO. Dependencies and Vite configuration are preserved.

For isolated PostgreSQL-compatible checks, install @electric-sql/pglite in a separate test folder, set PROPOSAL_PGLITE_PATH to its dist/index.js, and run node scripts/test-proposals-database.mjs. Tests use an in-memory fixture, never live Supabase.

After installation, verify a disposable draft and preview with your own contact details. Do not send or sign a real client proposal as a test. Confirm an existing residential estimate still opens with its original number and wording.

## Rollback

Redeploy the prior app if needed. Leave migration 014 installed to preserve any proposals and acceptances already saved. Do not drop proposal tables or alter Estimates/Contracts for rollback.
