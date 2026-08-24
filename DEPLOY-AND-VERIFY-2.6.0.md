# Deploy and verify version 2.6.0

1. Extract this ZIP into a new folder. Its files are at the ZIP root, so do not upload a wrapper folder.
2. Keep your existing `.env`, Supabase project, and Stripe configuration. Those connections preserve all current business data and payment functionality.
3. In the Supabase SQL Editor, run `supabase/migrations/012_multiple_contract_types.sql` once. It adds one protected type field and marks all existing contracts as Tree Service agreements without deleting or replacing anything.
4. Redeploy the included `dist` folder, or deploy the project through the same service you already use.
5. Hard-refresh the live Operations Center with Ctrl+F5 and sign in.

## Confirm the update

- The bottom of the left navigation says `Live workspace · v2.6.0`.
- Click **New contract**. Tree Service, Junk Removal, and Demolition appear before the customer and scope fields.
- Pick each type and confirm its default title and contract-number prefix change: `VTS`, `VJR`, or `VDM`.
- Open an old contract. It should still display as Tree Service and retain its customer, amount, signature, schedule, and invoice links.
- Customer signing and date selection still work. Customers can reserve one available Monday-through-Saturday workday; office staff can still schedule Sunday.
- Deposit rules remain automatic: $1,500 or less may be $0; over $1,500 through $5,000 is 30%; over $5,000 is 35%.
- Stripe remains available. Zelle remains instructions only and does not mark an invoice paid.
- **Void contract** and **Delete permanently** remain separate actions.

Running a batch file after deployment does not alter the live database or live website by itself. It only installs dependencies or creates files on the computer where it is run.
