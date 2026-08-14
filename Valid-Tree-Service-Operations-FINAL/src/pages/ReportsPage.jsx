import { useMemo } from 'react'
import { useWorkspace } from '../data/WorkspaceProvider'
import { companyFinancials, jobFinancials, money, sum } from '../lib/operations'
import { Metric, PageHeader } from '../components/OperationsUI'

export default function ReportsPage() {
  const ws = useWorkspace()
  const totals = useMemo(() => companyFinancials(ws.data), [ws.data])
  const rows = ws.data.jobs.map((job) => ({ job, f: jobFinancials(job, ws.data) })).sort((a, b) => b.f.revenue - a.f.revenue)
  const receivables = sum(ws.data.invoices.filter((invoice) => invoice.status !== 'void'), (invoice) => Math.max(Number(invoice.amount) - Number(invoice.paid), 0))
  const laborHours = sum(ws.data.time_entries, (item) => Number(item.regular_hours) + Number(item.overtime_hours))
  const gallons = sum(ws.data.fuel_logs, (item) => item.gallons)

  return <div className="operations-page">
    <PageHeader eyebrow="Business intelligence" title="Reports & Profitability"><button className="button secondary" onClick={() => window.print()}>Print report</button></PageHeader>
    <section className="metric-grid five">
      <Metric label="Cash collected" value={money(totals.cashCollected)} note="Payments received" />
      <Metric label="Direct job costs" value={money(totals.actualCost)} />
      <Metric label="Company overhead" value={money(totals.overheadExpenses)} />
      <Metric label="Cash after costs" value={money(totals.cashAfterCosts)} note={`${totals.cashMargin.toFixed(1)}% of collected cash remains`} tone={totals.cashAfterCosts >= 0 ? 'success' : 'danger'} />
      <Metric label="Receivables" value={money(receivables)} />
    </section>
    <div className="module-grid">
      <section className="panel full-span"><h2>Gross profit by job <small className="muted-left">before company overhead</small></h2><div className="data-table"><div className="table-head"><span>Job</span><span>Progress</span><span>Revenue</span><span>Actual cost</span><span>Profit / margin</span></div>{rows.map(({ job, f }) => <div className="table-row" key={job.id}><span><strong>{job.title}</strong><small>{job.number} · {ws.customer(job.customer_id)?.full_name || 'Customer'}</small></span><span>{Number(job.completion_percent || 0).toFixed(0)}%</span><span>{money(f.revenue)}</span><span>{money(f.actualCost)}</span><span className={f.profit < 0 ? 'negative' : 'positive'}>{money(f.profit)} · {f.margin.toFixed(1)}%</span></div>)}</div></section>
      <section className="panel"><h2>Cash position</h2><div className="stat-list"><div><span>Cash collected</span><strong>{money(totals.cashCollected)}</strong></div><div><span>Total recorded costs</span><strong>-{money(totals.totalActualCost)}</strong></div><div><span>Cash remaining</span><strong className={totals.cashAfterCosts >= 0 ? 'positive' : 'negative'}>{money(totals.cashAfterCosts)}</strong></div><div><span>Contracted / projected revenue</span><strong>{money(totals.revenue)}</strong></div><div><span>Projected profit after current costs</span><strong>{money(totals.netProfit)}</strong></div></div></section>
      <section className="panel"><h2>Operational totals</h2><div className="stat-list"><div><span>Labor hours</span><strong>{laborHours.toFixed(1)}</strong></div><div><span>Fuel gallons</span><strong>{gallons.toFixed(1)}</strong></div><div><span>Daily reports</span><strong>{ws.data.daily_reports.length}</strong></div><div><span>Production entries</span><strong>{ws.data.production_logs.length}</strong></div><div><span>Open change orders</span><strong>{ws.data.change_orders.filter((x) => !['approved', 'rejected', 'void'].includes(x.status)).length}</strong></div></div></section>
      <section className="panel full-span"><h2>All recorded costs by category</h2><p className="muted-left">Includes both job-linked expenses and general company overhead.</p><div className="stat-list">{[...new Set(ws.data.expenses.map((x) => x.category))].map((category) => <div key={category}><span>{category}</span><strong>{money(sum(ws.data.expenses.filter((x) => x.category === category), (x) => x.amount))}</strong></div>)}</div></section>
    </div>
  </div>
}
