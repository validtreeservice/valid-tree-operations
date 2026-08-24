import test from 'node:test'
import assert from 'node:assert/strict'
import {
  CONTRACT_TYPES,
  getContractTerms,
  getContractTypeDefinition,
  normalizeContractType,
} from '../src/lib/contractTerms.js'

test('old contracts safely remain tree-service contracts', () => {
  assert.equal(normalizeContractType(undefined), 'tree_service')
  assert.equal(normalizeContractType('unknown'), 'tree_service')
  assert.equal(getContractTypeDefinition().label, 'Tree Service')
})

test('each selectable contract type has its own identifier and agreement language', () => {
  assert.deepEqual(Object.keys(CONTRACT_TYPES), ['tree_service', 'junk_removal', 'demolition'])
  assert.equal(new Set(Object.values(CONTRACT_TYPES).map((item) => item.numberPrefix)).size, 3)
  assert.equal(new Set(Object.values(CONTRACT_TYPES).map((item) => item.defaultTitle)).size, 3)
  const termText = (type) => getContractTerms(type).map((term) => `${term.title} ${term.text}`).join(' ')
  assert.match(termText('tree_service'), /tree work/i)
  assert.match(termText('junk_removal'), /prohibited|hazardous/i)
  assert.match(termText('demolition'), /utilities|permits/i)
})

test('customer-facing contract labels match the selected service', () => {
  assert.equal(getContractTypeDefinition('tree_service').agreementLabel, 'Professional Tree Care Agreement')
  assert.equal(getContractTypeDefinition('junk_removal').agreementLabel, 'Junk Removal Service Agreement')
  assert.equal(getContractTypeDefinition('demolition').agreementLabel, 'Demolition Service Agreement')
})
