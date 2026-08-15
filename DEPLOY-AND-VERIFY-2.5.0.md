# Deploy and verify version 2.5.0

Running a build file after deployment does not change the live website. It only creates a new `dist` folder on that computer.

1. Extract this ZIP into a new folder. The ZIP is flat, so its files appear directly in that folder without another project folder inside it.
2. Preserve all existing Supabase and Stripe settings and secrets.
3. In Supabase SQL Editor, run `supabase/migrations/011_permanent_contract_deletion.sql` once.
4. The included `dist` folder is already built for version 2.5.0. Redeploy the contents of that `dist` folder.
5. If you choose to run `BUILD-PRODUCTION.bat` first, wait for the success message and then deploy the regenerated `dist` contents. Running the batch file by itself never changes the live website or database.
6. Hard-refresh the live Operations Center with Ctrl+F5 and sign in.

## Confirm the update

- The bottom of the left navigation says `Live workspace · v2.5.0`.
- Open any contract. **Delete permanently** appears even if the contract is signed, scheduled, completed, or voided.
- Signed or job-linked contracts also retain the separate **Void contract** option.
- Permanent deletion requires typing the exact contract number and accepting a final warning.
- If related jobs, invoices, change orders, payments, or Stripe records exist, they remain saved and are unlinked from the deleted contract.

No batch or build file directly changes the live database. The database function becomes available only after migration 011 is run in Supabase.
