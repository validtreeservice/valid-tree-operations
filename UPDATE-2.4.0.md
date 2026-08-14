# Operations Center 2.4.0 combined update

Apply migrations 008, 009, and 010 in numeric order, then build and redeploy the newly generated `dist` folder.

This combined release includes:

- Company phone corrected to 832-445-6535.
- Automatic Monday–Saturday calendar with one customer per entire workday.
- Office-controlled Sunday scheduling.
- Safe contract deletion or audited voiding.
- Zelle instructions that never mark invoices paid automatically.
- Automatic deposit tiers enforced by the database and customer interface:
  - $1,500.00 or less: no deposit.
  - $1,500.01 through $5,000.00: 30% deposit.
  - $5,000.01 and above: 35% deposit.
- Existing signed contracts, operational data, payment history, Stripe checkout, and Stripe webhook accounting are preserved.
