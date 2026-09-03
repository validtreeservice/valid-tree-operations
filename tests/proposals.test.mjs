import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { newProposal, templateSections, PROPOSAL_TYPES, proposalTotal, priceCents, proposalStatus, moveItem, customerSnapshot, validateProposal } from '../src/lib/proposals.js'
import { jobFinancials } from '../src/lib/operations.js'

test('commercial templates are independent and every new proposal starts clean', () => {
  const first = newProposal(PROPOSAL_TYPES[0], true), next = newProposal()
  assert.notEqual(first.id, next.id)
  assert.equal(first.number, '')
  assert.equal(next.project_name, '')
  assert.equal(next.content.lump_sum, '')
  assert.match(first.content.sections.map(s => s.body).join(' '), /approximately 6 acres/)
  assert.match(first.content.sections.map(s => s.body).join(' '), /asbestos inspection/)
  for (const type of PROPOSAL_TYPES) assert.ok(templateSections(type).length >= 1)
})
test('commercial milestone invoices preserve the full accepted job value', () => {
  const job = { id: 'job', proposal_id: 'proposal', proposal_amount: 80000 }
  const result = jobFinancials(job, { invoices: [{ job_id: 'job', amount: 20000 }], contracts: [], change_orders: [{ job_id: 'job', amount: 1000, status: 'approved' }] })
  assert.equal(result.revenue, 81000)
})
test('customer prices use exact cents, Included does not add a charge', () => {
  assert.equal(priceCents('25.09'), 2509)
  const p = newProposal()
  p.content.pricing_mode = 'itemized'
  p.content.lines = [{ amount: '100.10' }, { amount: '25.20' }, { amount: '999', included: true }]
  assert.equal(proposalTotal(p.content), 125.3)
  for (const value of ['-1', '12.345', 'NaN', '1e5', 'Infinity']) assert.throws(() => priceCents(value))
})
test('section movement preserves all content and supports boundaries', () => {
  const source = ['scope', 'exclusions', 'price']
  assert.deepEqual(moveItem(source, 1, -1), ['exclusions', 'scope', 'price'])
  assert.deepEqual(moveItem(source, 0, -1), source)
  assert.deepEqual(source, ['scope', 'exclusions', 'price'])
})
test('expiry cannot overwrite acceptance or decline and includes whole expiration date', () => {
  assert.equal(proposalStatus({ status: 'sent', expires_at: '2026-09-02' }, '2026-09-02'), 'sent')
  assert.equal(proposalStatus({ status: 'viewed', expires_at: '2026-09-01' }, '2026-09-02'), 'expired')
  assert.equal(proposalStatus({ status: 'accepted', expires_at: '2026-09-01' }, '2026-09-02'), 'accepted')
  assert.equal(proposalStatus({ status: 'declined', expires_at: '2026-09-01' }, '2026-09-02'), 'declined')
})
test('customer snapshot has no internal fields or hidden alternate pricing', () => {
  const row = newProposal()
  row.owner_id = 'SECRET'; row.internal_notes = 'SECRET'
  row.content.margin = 'SECRET'; row.content.lines = [{ label: 'SECRET', amount: '2', included: false }]
  row.content.sections[0].internal = 'SECRET'
  row.content.lump_sum = '120'
  const snapshot = customerSnapshot(row, { legalName: 'Valid Tree Service LLC', apiKey: 'SECRET' })
  assert.doesNotMatch(JSON.stringify(snapshot), /SECRET/)
  assert.equal(snapshot.amount, 120)
})
test('drafts allow incomplete scopes but issuing requires a price, contact, scope and terms', () => {
  const row = newProposal(); row.project_name = 'Bid'
  assert.doesNotThrow(() => validateProposal(row))
  assert.throws(() => validateProposal(row, true))
  row.project_address = 'Houston project site'; row.contact_name = 'GC representative'
  row.content.sections = [{ title: 'Clearing', body: 'Designated tree removal.' }]
  row.content.lump_sum = '100'; row.content.payment_terms = 'As agreed.'
  assert.doesNotThrow(() => validateProposal(row, true))
})
test('new schema is additive; workspace loading does not depend on the new tables', async () => {
  const sql = await readFile(new URL('../supabase/migrations/014_commercial_proposals.sql', import.meta.url), 'utf8')
  const workspace = await readFile(new URL('../src/data/WorkspaceProvider.jsx', import.meta.url), 'utf8')
  assert.doesNotMatch(sql, /(?:alter|update|delete from|drop).*public\.(estimates|contracts)\b/i)
  assert.doesNotMatch(workspace, /commercial_proposals/)
  assert.match(sql, /last_value=commercial_proposal_counters.last_value\+1/)
  assert.match(sql, /for update/)
  assert.match(sql, /jobs_one_per_proposal/)
  assert.match(sql, /revoke all on function public.get_commercial_proposal/)
})
