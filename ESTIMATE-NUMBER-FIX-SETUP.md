# Estimate number fix — one-time setup

This release stops duplicate estimate numbers, clears old wording from every new estimate form, and lets estimates create the correct tree-service, junk-removal, or demolition agreement.

## Apply the database safeguard

1. Sign in to the Supabase project used by the Operations Center.
2. Open **SQL Editor** and choose **New query**.
3. Open `supabase/migrations/013_estimate_numbering_and_service_types.sql` from this package.
4. Copy the entire file into the SQL Editor and select **Run**.
5. Refresh the Operations Center.

The update is additive. It does not delete or renumber existing customers, estimates, contracts, signatures, jobs, invoices, payments, or other records. Existing estimates are kept as tree-service estimates unless a different type is selected on a new estimate.

## Quick check

1. Open **Estimates** and select **New estimate**.
2. Confirm the number shown is higher than the highest number already in the list.
3. Select **Tree Service**, enter the new title and detailed scope, and save.
4. Reopen **New estimate** and confirm the title and scope are blank and the next number increased.
