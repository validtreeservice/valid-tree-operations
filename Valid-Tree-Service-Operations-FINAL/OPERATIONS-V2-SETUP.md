# Valid Tree Service Operations Center v2

## Safe installation order

1. Back up the current repository and Supabase database.
2. In Supabase SQL Editor, run `supabase/migrations/002_business_operations.sql` after migration `001`.
3. Then run `supabase/migrations/003_worker_payments.sql`.
4. Confirm the new private `receipts` Storage bucket exists.
5. Keep the existing `.env` values. Never put a Supabase service-role key in this browser application.
6. Run `npm install`, then `npm run verify`.
7. Test locally with `npm run dev`.
8. Deploy only after the checklist passes. The existing Cloudflare command remains `npx wrangler deploy`.

## Daily workflow

1. Create the customer, estimate, contract, and job using the existing workflow.
2. Open Job Costing and enter the approved budget.
3. Record expenses and receipts against that job.
4. Record labor separately so regular and overtime cost remain accurate.
5. Record fuel, rentals, and maintenance from Fleet & Fuel.
6. Submit a Daily Report and Production Log from the field.
7. Put extra approved work in a change order. Only approved change orders increase revenue.
8. Review estimated versus actual profit on Dashboard and Reports.
9. Use Worker Payments to record job-linked labor and payment proof. Do not store full tax IDs in the app.

## Calculation rules

- Revenue uses job invoices when present; otherwise it uses the contract value.
- Approved change orders increase revenue.
- Actual job cost equals expenses + labor + fuel + job-linked maintenance.
- General expenses without a job remain overhead and do not distort job profitability.
- Profit is revenue minus actual job cost. Margin is profit divided by revenue.
- The estimator is a planning model. Confirm every large bid with a site walk, production assumptions, rental quotes, utilities, access, contamination, stump handling, soil and grading requirements.

## Production checklist

- Existing login/logout and all prior modules load.
- Public signing links work without authentication; print a signed test with both signatures.
- Create a budget, receipt expense, time entry, report, production entry, fuel log, repair, rental, and change order.
- Confirm a different owner account cannot read these records.
- Confirm receipts remain private under the owner-ID folder.
- Verify one known job’s totals manually.
- Check Dashboard, Search, Reports, Job Costing, and phone/tablet layouts.

## Rollback

The migration is additive. Redeploy the prior Git commit to restore the older interface. Do not delete the new tables until their data is exported.
