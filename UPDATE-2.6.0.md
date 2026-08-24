# Operations Center 2.6.0

This update adds three separate agreement types to the existing Contracts page:

- Tree Service
- Junk Removal
- Demolition

Choose the agreement type when creating a contract. Each type has its own contract title, number prefix, customer-facing agreement heading, and terms. Existing records are preserved and automatically remain Tree Service contracts.

The existing signature, scheduling, deposit, invoice, Zelle, Stripe, void, print, and permanent-delete workflows continue to work. The automatic deposit policy is unchanged: $1,500 or less may be $0; over $1,500 through $5,000 is 30%; over $5,000 is 35%.

## Before using the update

Deploy `supabase/migrations/012_multiple_contract_types.sql` to the same Supabase project used by the Operations Center. Do not create a new database and do not replace the `.env` values, because the existing database is what preserves your current customers, contracts, jobs, invoices, and payments.

Then run `INSTALL-AND-START.bat` from the folder containing `package.json`. The ZIP is flat, so extracting it will not create an extra project folder inside another project folder.

Stripe and Zelle behavior was not changed. A Zelle instruction or QR code never marks an invoice paid automatically; office staff must confirm receipt and record it.
