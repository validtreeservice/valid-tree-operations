# Deploy and verify version 2.6.1

1. Extract this ZIP into a new folder. The files are at the ZIP root.
2. Keep the existing `.env`, Supabase project, and Stripe configuration so all current business records and payment connections remain in place.
3. In Supabase **SQL Editor**, run `supabase/migrations/013_estimate_numbering_and_service_types.sql` once.
4. Redeploy the included `dist` folder, or deploy the project through the same service already in use.
5. Hard-refresh the live Operations Center with **Ctrl+F5** and sign in.

## Confirm the fix

- The bottom of the left navigation says `Live workspace · v2.6.1`.
- Open **Estimates** and select **New estimate**. The displayed number is one higher than the highest estimate number already used, even when older records were deleted.
- Enter a new title and detailed scope, save it, then reopen **New estimate**. The title and scope are blank instead of carrying forward old wording.
- Tree Service, Junk Removal, and Demolition are available as estimate types.
- Converting or accepting an estimate creates the matching agreement and prefix: `VTS`, `VJR`, or `VDM`.

Migration 013 is additive and does not delete or renumber any existing customer, estimate, contract, signature, job, invoice, payment, or other operational record.
