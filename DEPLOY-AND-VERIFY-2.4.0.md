# Deploy and verify version 2.4.0

Running the build file after a deployment does not update the live website. It only creates a new `dist` folder on that computer.

1. Extract this replacement ZIP into a new folder.
2. Preserve the current `.env` values and all existing Supabase/Stripe secrets.
3. In the Supabase SQL Editor, apply migrations 008, 009, and 010 in numeric order if they have not already been applied.
4. Run `BUILD-PRODUCTION.bat` and wait for `Production build completed in the dist folder.`
5. Redeploy the newly generated `dist` folder. If using a dashboard upload, upload the contents of `dist`, not the source ZIP or parent folder.
6. Hard-refresh the live Operations Center with Ctrl+F5 and sign in.

## Confirm the correct live version

- The bottom of the left navigation says `Live workspace · v2.4.0`.
- Contracts: an unsigned/unlinked contract shows `Delete contract`; a signed or job-linked contract shows `Void contract`.
- A signed contract with a required deposit shows the exact amount, Stripe button, Zelle QR, and work-start notice.
- An unpaid invoice receipt shows the Zelle QR without automatically changing its paid status.
- Schedule says `Monday–Saturday work calendar`; the first customer reserves the entire date.
- Deposit boundaries are automatic: $1,500 or less is $0; $1,500.01–$5,000 is 30%; $5,000.01 and above is 35%.

For Zelle, verify the transfer in the bank and then use `Record payment` in Invoices.
