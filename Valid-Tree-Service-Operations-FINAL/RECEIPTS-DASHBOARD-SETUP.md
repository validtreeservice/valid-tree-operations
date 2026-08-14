# Valid Tree Service receipt and cash-dashboard update

This update separates money already collected from future contracted work. It also adds permanent customer receipts plus safe invoice delete/void controls.

## 1. Install the files

Double-click `INSTALL-STRIPE-UPDATE.bat`. The installer preserves the current `.env`, creates a safety backup, installs the files, and runs the project checks.

## 2. Add the receipt database update

1. Open Supabase.
2. Open **SQL Editor** and choose **New query**.
3. In VS Code, open `supabase/migrations/006_invoice_receipts.sql`.
4. Copy the entire file into the Supabase query.
5. Click **Run**. If Supabase shows a safety warning, choose **Run**. The migration preserves existing invoices and payments and gives old invoices a receipt link.

## 3. Redeploy the changed payment function

In the Operations Center terminal, run:

```powershell
npx.cmd supabase functions deploy create-stripe-checkout --no-verify-jwt
```

The existing Stripe secret remains in Supabase. Do not paste it into VS Code.

## 4. Verify and deploy the Operations Center

Run:

```powershell
npm.cmd run verify
npx.cmd wrangler deploy
```

## 5. Test

1. Open **Invoices**.
2. On the paid $800 invoice, click **View / PDF**. Confirm the customer, payment, and zero balance appear.
3. Click **Share receipt** or **Email receipt**.
4. Create a small unpaid test invoice and click **Delete**.
5. A paid invoice, or one that already has a Stripe session, shows **Void** instead of Delete so payment records are not erased.
6. Open the Dashboard. Confirm **Cash collected** shows received payments. The future $1,250 job should appear only as projected/contracted revenue, not as cash already earned.

Expected with the figures previously shown: $800 cash collected minus $38 direct costs and $149 overhead equals $613 cash remaining after recorded costs.
