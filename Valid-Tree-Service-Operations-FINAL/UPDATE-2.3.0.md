# Operations Center 2.3.0 update

This package preserves the existing Supabase data model and Stripe checkout/webhook workflow.

## Install

1. Back up the current Supabase project before deployment.
2. On an existing installation, apply `supabase/migrations/008_phone_sunday_contract_void_zelle.sql` after migrations 001–007.
3. Keep the current `.env` values and Stripe Edge Function secrets.
4. Run `BUILD-PRODUCTION.bat`, or run `npm install` followed by `npm run build`.
5. Deploy the generated `dist` folder and Supabase functions as described in the existing setup guide.

## Behavior

- Customer-facing company phone: 832-445-6535.
- Customers may reserve active Monday–Saturday availability only after signing.
- Authenticated owner/office users may schedule Sunday work from Jobs.
- Unsigned, unlinked contracts may be deleted. Signed or job-linked contracts are voided and retained with an audit entry.
- Zelle QR instructions do not create payment records or change invoice paid totals. Staff must verify receipt and use the existing manual-payment action.
- Stripe checkout creation and webhook-confirmed payment accounting are unchanged.
