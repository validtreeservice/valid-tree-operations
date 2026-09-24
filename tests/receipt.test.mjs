import test from 'node:test'
import assert from 'node:assert/strict'
import { receiptPaymentState } from '../src/lib/receipt.js'
test('paid banner follows actual cents received and never voided status', () => {
  assert.equal(receiptPaymentState({amount:350,paid:350,status:'paid'}).fullyPaid,true)
  assert.equal(receiptPaymentState({amount:350,paid:350,status:'void'}).fullyPaid,false)
  assert.equal(receiptPaymentState({amount:350,paid:100,status:'paid'}).label,'PARTIAL')
  assert.equal(receiptPaymentState({amount:350,paid:0,status:'paid'}).label,'OPEN')
  assert.equal(receiptPaymentState({amount:350,paid:349.99,status:'partial'}).balance,.01)
  assert.equal(receiptPaymentState({amount:350,paid:349.99,status:'partial'}).fullyPaid,false)
  assert.equal(receiptPaymentState({amount:0,paid:0,status:'open'}).fullyPaid,false)
})
