# Stripe card-payment setup

This integration uses Stripe-hosted Checkout. Card numbers never pass through or stay in the Valid Tree Service application.

## 1. Back up and install the update

Run `INSTALL-STRIPE-UPDATE.bat` from the delivered update folder. It backs up the current Operations Center, copies the complete update, and runs the project checks. It does not deploy or change Supabase.

## 2. Add the database update

1. Open the Valid Tree Service project in Supabase.
2. Open **SQL Editor** and choose **New query**.
3. Open `supabase/migrations/005_stripe_payments.sql` from the project in VS Code.
4. Copy the whole file into Supabase and click **Run**.
5. If Supabase warns about destructive operations or RLS, choose **Run**. This migration enables RLS on its new webhook-event table and preserves existing customers, contracts, signatures, invoices, and payments.

Run this migration only once. Re-running it is designed to be safe, but the first successful run is all that is needed.

## 3. Deploy the two secure payment functions

In the VS Code terminal, from the Operations Center folder, run:

```powershell
npx.cmd supabase login
npx.cmd supabase link --project-ref YOUR_PROJECT_REF
npx.cmd supabase secrets set STRIPE_SECRET_KEY=sk_test_YOUR_KEY PUBLIC_SITE_URL=https://operations.validtreeservice.com
npx.cmd supabase functions deploy create-stripe-checkout --no-verify-jwt
npx.cmd supabase functions deploy stripe-webhook --no-verify-jwt
```

Find `YOUR_PROJECT_REF` in the Supabase project URL. Keep Stripe in **Test mode** and copy its test secret key beginning with `sk_test_`. Never place that key in `.env`, GitHub, browser code, or chat.

## 4. Connect Stripe's webhook

1. In Stripe, remain in **Test mode**.
2. Open **Developers → Webhooks → Add endpoint**.
3. Use this endpoint, replacing the project reference:

```text
https://YOUR_PROJECT_REF.supabase.co/functions/v1/stripe-webhook
```

4. Select these events:
   - `checkout.session.completed`
   - `checkout.session.async_payment_succeeded`
   - `checkout.session.expired`
5. Create the endpoint and reveal its signing secret beginning with `whsec_`.
6. Save it securely in Supabase and redeploy the webhook:

```powershell
npx.cmd supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_YOUR_SECRET
npx.cmd supabase functions deploy stripe-webhook --no-verify-jwt
```

## 5. Verify and deploy the Operations Center

```powershell
npm.cmd run verify
npx.cmd wrangler deploy
```

Do not deploy if `npm.cmd run verify` reports an error.

## 6. Test without charging real money

1. Create or open an invoice, then click **Copy card link**.
2. Open the link and use Stripe's test card `4242 4242 4242 4242`.
3. Use any future expiration date, any three-digit CVC, and any ZIP code.
4. Return to the Operations Center and confirm:
   - a successful payment is listed;
   - the invoice paid amount/status changed;
   - Stripe's fee and net amount appear;
   - the fee reduces job or company profit exactly once.
5. Also test a signed contract's **Pay deposit securely** or **Pay balance securely** button.

## 7. Switch to real payments only after testing

Stripe test and live modes have different secret keys and webhook signing secrets. When ready, create the same webhook in Stripe live mode, replace both Supabase secrets with the live values, and redeploy both functions. Make one small real payment and refund it from Stripe to verify the full live path.

## Important operating notes

- A Checkout link expires after 30 minutes; generate a new one when needed.
- The server calculates the amount from the saved invoice/contract. Customers cannot edit the amount in their browser.
- The Stripe webhook, not the return page, marks the invoice paid.
- Manual cash/check/Zelle payments still work and remain separate from Stripe payments.
- Refunds are performed in Stripe. This first release does not automatically synchronize refunds back into the Operations Center; record a refund/adjustment manually until refund synchronization is added.
