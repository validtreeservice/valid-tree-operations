import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { depositRate, requiredDeposit } from '../src/lib/depositPolicy.js'

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8')

test('company phone is corrected in defaults, existing data migration, and customer messages', async () => {
  const [workspace, base, update, invoices] = await Promise.all([
    read('../src/data/WorkspaceProvider.jsx'), read('../supabase/migrations/001_valid_tree_operations.sql'),
    read('../supabase/migrations/008_phone_sunday_contract_void_zelle.sql'), read('../src/pages/InvoicesPage.jsx'),
  ])
  for (const source of [workspace, base, update, invoices]) assert.match(source, /832-445-6535/)
  assert.match(update, /update public\.company_settings set phone = '832-445-6535'/i)
})

test('customers can only book non-Sundays after signing while staff can schedule Sundays', async () => {
  const [booking, update, jobs] = await Promise.all([
    read('../supabase/migrations/007_customer_approval_scheduling.sql'),
    read('../supabase/migrations/008_phone_sunday_contract_void_zelle.sql'),
    read('../src/pages/JobsPage.jsx'),
  ])
  assert.match(booking, /c\.signed_at is null then raise exception/i)
  assert.match(booking, /extract\(dow from s\.slot_date\) = 0/i)
  assert.match(update, /drop constraint if exists schedule_slots_no_sunday/i)
  assert.match(jobs, /Office scheduling includes Sundays/)
})

test('contract disposition is server-enforced and preserves signed or linked records', async () => {
  const migration = await read('../supabase/migrations/008_phone_sunday_contract_void_zelle.sql')
  assert.match(migration, /safe_void_or_delete_contract/)
  assert.match(migration, /c\.signed_at is not null or c\.signature_data is not null or exists/i)
  assert.match(migration, /status = 'cancelled', voided_at = now\(\)/i)
  assert.match(migration, /'contract_voided'/)
})

test('Zelle is instructional only and never mutates invoice payment totals', async () => {
  const [signing, receipt] = await Promise.all([read('../src/pages/SignContractPage.jsx'), read('../src/pages/ReceiptPage.jsx')])
  for (const source of [signing, receipt]) {
    assert.match(source, /zelle-qr\.jpg/)
    assert.match(source, /will not be marked paid automatically|does not automatically mark/i)
    assert.doesNotMatch(source, /provider:\s*['"]zelle['"]/i)
  }
})

test('customer booking reserves the entire workday with concurrency protection', async () => {
  const [migration, signing] = await Promise.all([
    read('../supabase/migrations/009_exclusive_workday_booking.sql'),
    read('../src/pages/SignContractPage.jsx'),
  ])
  assert.match(migration, /generate_series\(current_date, current_date \+ 550/i)
  assert.match(migration, /extract\(dow from day\) between 1 and 6/i)
  assert.match(migration, /not exists[\s\S]*existing\.date = s\.slot_date/i)
  assert.match(migration, /pg_advisory_xact_lock\(hashtext\(c\.owner_id::text \|\| ':' \|\| s\.slot_date::text\)\)/i)
  assert.match(signing, /entire day is held for your project/i)
  assert.match(signing, /Reserve this entire workday/)
})

test('automatic deposit tiers use exact boundary rules and server enforcement', async () => {
  assert.equal(requiredDeposit(1499.99), 0)
  assert.equal(requiredDeposit(1500), 0)
  assert.equal(depositRate(1500.01), 0.30)
  assert.equal(requiredDeposit(1500.01), 450)
  assert.equal(requiredDeposit(5000), 1500)
  assert.equal(depositRate(5000.01), 0.35)
  assert.equal(requiredDeposit(5000.01), 1750)
  const migration = await read('../supabase/migrations/010_automatic_deposit_policy.sql')
  assert.match(migration, /when coalesce\(p_total, 0\) > 5000 then greatest\(p_total, 0\) \* 0\.35/i)
  assert.match(migration, /when coalesce\(p_total, 0\) > 1500 then greatest\(p_total, 0\) \* 0\.30/i)
  assert.match(migration, /before insert or update of total_price, deposit, signed_at/i)
})
