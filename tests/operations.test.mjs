import test from 'node:test'
import assert from 'node:assert/strict'
import { calculateLandClearing, companyFinancials, jobFinancials, laborCost } from '../src/lib/operations.js'
test('labor cost includes overtime multiplier', () => assert.equal(laborCost({ regular_hours: 8, overtime_hours: 2, hourly_rate: 20, overtime_multiplier: 1.5 }), 220))
test('job profitability includes approved changes and all direct cost sources', () => {
  const result = jobFinancials({ id: 'j', contract_id: 'c' }, { contracts: [{ id: 'c', total_price: 10000 }], invoices: [], job_budgets: [{ job_id: 'j', estimated_amount: 4000 }], change_orders: [{ job_id: 'j', amount: 1000, status: 'approved' }], expenses: [{ job_id: 'j', amount: 500 }], time_entries: [{ job_id: 'j', regular_hours: 10, overtime_hours: 0, hourly_rate: 30 }], fuel_logs: [{ job_id: 'j', total_cost: 200 }], maintenance_records: [{ job_id: 'j', cost: 100 }], payments: [] })
  assert.equal(result.revenue, 11000); assert.equal(result.actualCost, 1100); assert.equal(result.profit, 9900); assert.equal(result.budgetVariance, 2900)
})
test('land clearing estimator preserves target margin', () => {
  const result = calculateLandClearing({ acres: 11, density: 'medium', timber_type: 'pine', average_diameter: 12, stump_removal: true, finish_grade: true, customer_equipment: true, crew_size: 4, labor_rate: 350, fuel_daily: 700, contingency_percent: 15, overhead_percent: 15, target_margin_percent: 30 })
  assert.ok(result.workDays > 0); assert.ok(result.recommendedPrice > result.costWithOverhead); assert.ok(Math.abs((result.recommendedPrice - result.costWithOverhead) / result.recommendedPrice - .30) < .0001)
})
test('company profitability subtracts overhead once without double-counting job expenses', () => {
  const result = companyFinancials({
    jobs: [{ id: 'j', contract_id: 'c' }], contracts: [{ id: 'c', total_price: 10000 }],
    invoices: [], job_budgets: [], change_orders: [],
    expenses: [{ job_id: 'j', amount: 1000 }, { job_id: null, amount: 500 }],
    time_entries: [], fuel_logs: [], maintenance_records: [], payments: [],
  })
  assert.equal(result.revenue, 10000)
  assert.equal(result.actualCost, 1000)
  assert.equal(result.overheadExpenses, 500)
  assert.equal(result.totalActualCost, 1500)
  assert.equal(result.netProfit, 8500)
})
test('Stripe processing fees reduce job and company profit exactly once', () => {
  const data = {
    jobs: [{ id: 'j', contract_id: 'c' }], contracts: [{ id: 'c', total_price: 1000 }],
    invoices: [], job_budgets: [], change_orders: [], expenses: [], time_entries: [], fuel_logs: [], maintenance_records: [],
    payments: [
      { job_id: 'j', amount: 1000, provider: 'stripe', status: 'succeeded', processing_fee: 32 },
      { job_id: null, amount: 100, provider: 'stripe', status: 'succeeded', processing_fee: 4 },
    ],
  }
  const job = jobFinancials(data.jobs[0], data)
  const company = companyFinancials(data)
  assert.equal(job.paymentFees, 32)
  assert.equal(job.profit, 968)
  assert.equal(company.unassignedPaymentFees, 4)
  assert.equal(company.totalActualCost, 36)
  assert.equal(company.netProfit, 964)
})
test('cash profit uses payments received, not future contracted job revenue', () => {
  const result = companyFinancials({
    jobs: [{ id: 'future', contract_id: 'contract' }], contracts: [{ id: 'contract', total_price: 1250 }],
    invoices: [{ id: 'done', amount: 800, paid: 800, status: 'paid' }],
    job_budgets: [], change_orders: [], expenses: [{ job_id: null, amount: 100 }],
    time_entries: [], fuel_logs: [], maintenance_records: [], payments: [],
  })
  assert.equal(result.revenue, 1250)
  assert.equal(result.cashCollected, 800)
  assert.equal(result.cashAfterCosts, 700)
})
