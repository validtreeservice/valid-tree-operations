# Operations 2.7.0 verification

## Completed locally

- 34 passing unit/regression tests, including existing residential estimate numbering, forms, contracts, customer approval, payments and scheduling checks.
- 28 passing isolated PostgreSQL-compatible integration checks for commercial proposals: schema installation, separate numbering, repeated saves, itemized totals, company/role isolation, blocked direct writes, frozen snapshots, explicit acceptance, document hashing, expiry, revoked links and idempotent job conversion.
- JavaScript/JSX parsing passed for all 54 source files.
- Production assets generated successfully with the portable Windows build.
- Static proposal document checks passed: expected template, correct section order, draft labeling, print page rules, no internal notes, and escaped hostile HTML.
- The built local preview returned HTTP 200.

## Not yet verified / installed

- Migration 014 has not been run on the live Supabase project.
- The production operations site has not been redeployed.
- No real customer proposal has been created, sent or signed.
- End-to-end browser interaction and visual PDF output were not tested. The PDF action uses the existing browser print/save approach; check final print pagination before sending a commercial bid.

The new schema is additive. If setup is missing, Proposals displays a focused error without adding a failed dependency to the existing workspace's table loader.
