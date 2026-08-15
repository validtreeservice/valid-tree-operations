# Operations Center 2.5.0 permanent contract deletion

This release adds a separate **Delete permanently** control to every contract while keeping **Void contract** available for signed or job-linked agreements.

Permanent deletion requires office access, the exact contract number, and a final confirmation. It removes only the contract. Related jobs, invoices, payments, change orders, and Stripe identifiers are preserved and unlinked so operational and financial history is not erased.

## Required database update

Apply this file once in the Supabase SQL Editor before deploying the new website build:

```text
supabase/migrations/011_permanent_contract_deletion.sql
```

The migration is additive and does not delete any existing record by itself. A contract is deleted only after an authorized staff member deliberately uses **Delete permanently** and completes both confirmations.
