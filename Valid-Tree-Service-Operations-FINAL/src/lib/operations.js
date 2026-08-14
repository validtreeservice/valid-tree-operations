export const COST_CATEGORIES = [
  'labor', 'fuel', 'equipment', 'rental', 'maintenance', 'subcontractor',
  'materials', 'disposal', 'permit', 'travel', 'insurance', 'other',
]

export const money = (value) => Number(value || 0).toLocaleString('en-US', {
  style: 'currency', currency: 'USD', maximumFractionDigits: 0,
})

export const number = (value) => Number(value || 0)
export const sum = (items, selector = (item) => item) => items.reduce((total, item) => total + number(selector(item)), 0)

export function laborCost(entry) {
  const regular = number(entry.regular_hours) * number(entry.hourly_rate)
  const overtime = number(entry.overtime_hours) * number(entry.hourly_rate) * number(entry.overtime_multiplier || 1.5)
  return regular + overtime
}

export function invoiceRevenue(jobId, invoices = []) {
  return sum(invoices.filter((item) => item.job_id === jobId), (item) => item.amount)
}

export function contractRevenue(job, contracts = []) {
  const contract = contracts.find((item) => item.id === job?.contract_id)
  return number(contract?.total_price)
}

export function jobFinancials(job, data) {
  const jobId = job?.id
  const approvedChanges = sum(
    (data.change_orders || []).filter((item) => item.job_id === jobId && item.status === 'approved'),
    (item) => item.amount,
  )
  const baseRevenue = invoiceRevenue(jobId, data.invoices) || contractRevenue(job, data.contracts)
  const revenue = baseRevenue + approvedChanges
  const budget = sum((data.job_budgets || []).filter((item) => item.job_id === jobId), (item) => item.estimated_amount)
  const expenses = sum((data.expenses || []).filter((item) => item.job_id === jobId), (item) => item.amount)
  const labor = sum((data.time_entries || []).filter((item) => item.job_id === jobId), laborCost)
  const fuel = sum((data.fuel_logs || []).filter((item) => item.job_id === jobId), (item) => item.total_cost ?? number(item.gallons) * number(item.price_per_gallon))
  const maintenance = sum((data.maintenance_records || []).filter((item) => item.job_id === jobId), (item) => item.cost)
  const paymentFees = sum(
    (data.payments || []).filter((item) => item.job_id === jobId && item.provider === 'stripe' && item.status === 'succeeded'),
    (item) => item.processing_fee,
  )
  const actualCost = expenses + labor + fuel + maintenance + paymentFees
  const profit = revenue - actualCost
  const margin = revenue > 0 ? (profit / revenue) * 100 : 0
  const budgetVariance = budget - actualCost
  const collected = sum((data.payments || []).filter((item) => item.job_id === jobId), (item) => item.amount)
  return { revenue, budget, expenses, labor, fuel, maintenance, paymentFees, actualCost, profit, margin, budgetVariance, collected }
}

export function companyFinancials(data) {
  const jobTotals = (data.jobs || []).reduce((result, job) => {
    const financials = jobFinancials(job, data)
    Object.keys(result).forEach((key) => { result[key] += financials[key] || 0 })
    return result
  }, { revenue: 0, budget: 0, actualCost: 0, profit: 0, collected: 0 })
  // Job-linked expenses are already counted in jobFinancials. Only unassigned
  // expenses are overhead, so company totals include each expense exactly once.
  const generalOverhead = sum(
    (data.expenses || []).filter((item) => !item.job_id),
    (item) => item.amount,
  )
  const unassignedPaymentFees = sum(
    (data.payments || []).filter((item) => !item.job_id && item.provider === 'stripe' && item.status === 'succeeded'),
    (item) => item.processing_fee,
  )
  const overheadExpenses = generalOverhead + unassignedPaymentFees
  const totalActualCost = jobTotals.actualCost + overheadExpenses
  const grossProfit = jobTotals.profit
  const netProfit = jobTotals.revenue - totalActualCost
  const netMargin = jobTotals.revenue > 0 ? (netProfit / jobTotals.revenue) * 100 : 0
  const cashCollected = sum(
    (data.invoices || []).filter((item) => item.status !== 'void'),
    (item) => item.paid,
  )
  const cashAfterCosts = cashCollected - totalActualCost
  const cashMargin = cashCollected > 0 ? (cashAfterCosts / cashCollected) * 100 : 0
  return { ...jobTotals, grossProfit, generalOverhead, unassignedPaymentFees, overheadExpenses, totalActualCost, netProfit, netMargin, cashCollected, cashAfterCosts, cashMargin }
}

const densityFactor = { light: 0.55, medium: 1, heavy: 1.65, extreme: 2.4 }
const timberFactor = { pine: 0.9, mixed: 1, hardwood: 1.25, brush: 0.55 }

export function calculateLandClearing(input) {
  const acres = Math.max(number(input.acres), 0)
  const density = densityFactor[input.density] || 1
  const timber = timberFactor[input.timber_type] || 1
  const diameter = Math.max(number(input.average_diameter), 4)
  const diameterFactor = Math.max(0.7, diameter / 12)
  const stumpFactor = input.stump_removal ? 1.35 : 1
  const gradeFactor = input.finish_grade ? 1.18 : 1
  const equipmentFactor = input.customer_equipment ? 0.72 : 1
  const baseDays = acres * 0.9 * density * timber * diameterFactor * stumpFactor * gradeFactor
  const workDays = Math.max(baseDays, acres ? 1 : 0)
  const dailyLabor = number(input.crew_size || 1) * number(input.labor_rate || 350)
  const dailyEquipment = number(input.equipment_daily || 0)
  const dailyFuel = number(input.fuel_daily || 0)
  const rentals = number(input.rental_total || 0)
  const disposal = number(input.disposal_total || 0)
  const directCost = workDays * (dailyLabor + dailyEquipment + dailyFuel) * equipmentFactor + rentals + disposal
  const contingency = directCost * number(input.contingency_percent || 0) / 100
  const overhead = (directCost + contingency) * number(input.overhead_percent || 0) / 100
  const costWithOverhead = directCost + contingency + overhead
  const margin = Math.min(Math.max(number(input.target_margin_percent || 0), 0), 95) / 100
  const recommendedPrice = margin < 1 ? costWithOverhead / (1 - margin) : costWithOverhead
  return { workDays, directCost, contingency, overhead, costWithOverhead, recommendedPrice, perAcre: acres ? recommendedPrice / acres : 0 }
}

export function similarJobs(current, jobs, data) {
  return jobs
    .filter((job) => job.id !== current?.id && job.project_type === current?.project_type)
    .map((job) => ({ job, ...jobFinancials(job, data) }))
    .sort((a, b) => Math.abs(number(a.job.acres) - number(current?.acres)) - Math.abs(number(b.job.acres) - number(current?.acres)))
    .slice(0, 5)
}
