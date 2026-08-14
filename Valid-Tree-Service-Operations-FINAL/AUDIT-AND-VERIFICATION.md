# Architecture audit and verification

## Preserved architecture

- React 19 and Vite single-page application.
- Existing React Router routes and protected application shell.
- Existing Supabase authentication and owner/workspace model.
- Existing customers, estimates, contracts, public signature links, jobs, invoices, crews, tasks, photos, settings, and audit records.
- Existing Cloudflare Workers deployment configuration.
- Existing contract signing RPCs and public signing workflow.

## Added architecture

- Additive migration `002_business_operations.sql`; no existing business table is dropped.
- Job-centered budgets, costs, labor, reports, production, fleet, fuel, repairs, rentals, change orders, payments, and estimator history.
- Owner-scoped RLS on every new business table.
- Private receipt storage with owner-folder policies.
- One calculation library used by dashboard, costing, reports, historical comparison, and tests.
- Legacy synchronous workspace methods retained for old screens; new awaited methods provide reliable error handling to new screens.
- Responsive office pages and compact phone/tablet field workflows.
- Global search across operational records.

## Automated verification completed

- Project structure and route check: passed.
- Required migration/table coverage check: passed.
- Labor and overtime calculation test: passed.
- Job profitability and approved change-order test: passed.
- Land-clearing target-margin calculation test: passed.
- Calculation modules executed using Node 24.

## Could not be fully verified in this environment

- `npm install` could not reach the npm registry; the connection timed out repeatedly.
- Because dependencies were not included in the uploaded ZIP, the Vite production build could not run here.
- The migration was reviewed statically but was not applied to the user’s live Supabase project.
- Live authentication, RLS separation between two real owner accounts, private receipt upload/download, public signing RPCs, and Cloudflare deployment require the user’s connected services.
- No real accounting or payroll provider is connected. Labor entries are job-cost records, not payroll filings.
- The estimator is a configurable planning model, not an engineering estimate or guaranteed production rate.
- Existing invoice screens track amount/paid/status. The new detailed `payments` table is ready for expansion, but the older invoice payment button still updates the invoice directly to preserve current behavior.

## Required acceptance test before production reliance

Follow `OPERATIONS-V2-SETUP.md`, apply migration 002 to a backed-up Supabase project, run `npm install && npm run verify`, and complete the production checklist. Do not rely on profitability numbers until one known job has been reconciled manually.
