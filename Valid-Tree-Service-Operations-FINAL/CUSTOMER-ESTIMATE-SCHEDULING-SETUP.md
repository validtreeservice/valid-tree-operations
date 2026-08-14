# Customer estimate approval and scheduling setup

This update preserves existing customers, estimates, signed contracts, signatures, jobs, invoices, payments, expenses, and staff access. The migration adds new columns, a scheduling table, and customer-facing functions; it does not delete or replace existing business records.

## 1. Back up first

In Supabase, make a current database backup if your plan provides backups. Also keep a ZIP or Git commit of the currently deployed Operations Center.

## 2. Run the Supabase migration

1. Open the correct Valid Tree Service Supabase project.
2. Open **SQL Editor** and select **New query**.
3. Open `supabase/migrations/007_customer_approval_scheduling.sql` from this project.
4. Copy the entire file into the Supabase query window.
5. Select **Run**.
6. If Supabase warns that the query creates tables without RLS, choose **Run without RLS**. The migration itself enables RLS and installs the required policies before it completes.
7. Confirm the result says the query completed successfully.

Do not rerun migrations 001 through 006 if they were already installed on the live database.

## 3. Build and deploy the Operations Center

Use the same environment file, Supabase project, and Cloudflare deployment process as the currently working Operations Center. From the project folder:

```powershell
npm.cmd install
npm.cmd run verify
npx.cmd wrangler deploy
```

Only deploy after verification finishes successfully.

## 4. Add customer-facing appointment dates

1. Sign in to the Operations Center.
2. Open **Schedule**.
3. In **Customer booking availability**, add the dates, start times, and capacity customers may select.
4. Only Monday through Saturday can be offered online. Sunday work must be arranged directly with Valid Tree Service.

## 5. Send an estimate

1. Create or open an estimate.
2. Select **Copy customer link**.
3. Text or email that link to the customer.
4. The customer reviews the estimate and selects **Accept estimate & continue**.
5. The system creates one contract for that estimate and opens the signing page.
6. After signing, the customer chooses one of the dates you made available.
7. The signed contract and scheduled job remain connected to the same customer and estimate.

## 6. Test before using it for a real customer

1. Create a small test customer and estimate.
2. Copy the customer link and open it in a private/incognito browser window.
3. Accept the estimate and confirm the signing page opens.
4. Sign it and choose a non-Sunday appointment.
5. Return to the Operations Center and confirm the estimate is approved, the contract is signed, and the job appears on the chosen date.
6. Print the contract and confirm the Cleanup term states that stump grindings and chips remain onsite unless removal was included for an additional charge.

## Important limits

- The website provides a copyable customer link; it does not send SMS or email by itself.
- Customers can only choose dates that an owner or office user has made available.
- Sunday dates cannot be published through online availability. Sunday work can still be discussed and scheduled directly by Valid Tree Service.
- Existing contracts are preserved. Newly generated and currently rendered contracts use the updated shared Cleanup term.
