import test from 'node:test'
import assert from 'node:assert/strict'
import { nextDocumentNumber, nextEstimateNumber } from '../src/lib/documentNumbers.js'

test('estimate numbering uses the highest existing number instead of record count', () => {
  const estimates = [
    { number: 'EST-2026-0043' },
    { number: 'EST-2026-0051' },
    { number: 'EST-2025-9999' },
  ]
  assert.equal(nextEstimateNumber(estimates, { year: 2026 }), 'EST-2026-0052')
})

test('deleting an earlier estimate cannot make a duplicate number', () => {
  const estimatesAfterDeletion = [
    { number: 'EST-2026-0042' },
    { number: 'EST-2026-0044' },
  ]
  assert.equal(nextEstimateNumber(estimatesAfterDeletion, { year: 2026 }), 'EST-2026-0045')
})

test('contract types advance independently using their own prefixes', () => {
  const contracts = [
    { contract_number: 'VTS-2026-0040' },
    { contract_number: 'VJR-2026-0003' },
    { contract_number: 'VDM-2026-0001' },
  ]
  assert.equal(nextDocumentNumber(contracts, 'VTS', { year: 2026, field: 'contract_number', floor: 38 }), 'VTS-2026-0041')
  assert.equal(nextDocumentNumber(contracts, 'VJR', { year: 2026, field: 'contract_number' }), 'VJR-2026-0004')
  assert.equal(nextDocumentNumber(contracts, 'VDM', { year: 2026, field: 'contract_number' }), 'VDM-2026-0002')
})

test('new estimate form clears old wording and supports all service types', async () => {
  const source = await import('node:fs/promises').then(({ readFile }) => readFile(new URL('../src/pages/EstimatesPage.jsx', import.meta.url), 'utf8'))
  assert.match(source, /setForm\(\{ \.\.\.blank \}\)/)
  assert.match(source, /Object\.values\(CONTRACT_TYPES\)/)
  assert.match(source, /getContractTypeDefinition\(estimate\.service_type\)/)
})
