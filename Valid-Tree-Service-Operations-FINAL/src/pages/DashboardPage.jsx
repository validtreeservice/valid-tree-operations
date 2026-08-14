import { Link } from 'react-router-dom'
import { useMemo } from 'react'
import { useWorkspace } from '../data/WorkspaceProvider'
import { companyFinancials, jobFinancials, money, sum } from '../lib/operations'
import { ErrorBanner, Metric, PageHeader } from '../components/OperationsUI'

export default function DashboardPage() {
  const ws = useWorkspace()
  const totals = useMemo(() => companyFinancials(ws.data), [ws.data])
  const active = ws.data.jobs.filter((job) => !['completed', 'cancelled'].includes(job.status))
  const receivables = sum(ws.data.invoices.filter((invoice) => invoice.status !== 'void'), (invoice) => Math.max(Number(invoice.amount) - Number(invoice.paid), 0))

  return <div className="operations-page">
    <PageHeader eyebrow="Houston operations center" title="Command Dashboard">
      <div className="quick-links"><Link className="button primary" to="/estimates">New estimate</Link><Link className="button secondary" to="/field-reports">Field report</Link></div>
    </PageHeader>
    <ErrorBanner message={ws.syncError} />
    <section className="metric-grid five">
      <Metric label="Cash collected" value={money(totals.cashCollected)} note="Payments actually received" />
      <Metric label="Direct job costs" value={money(totals.actualCost)} note="Expenses linked to jobs" />
      <Metric label="Company overhead" value={money(totals.overheadExpenses)} note="General expenses not linked to a job" />
      <Metric label="Cash after costs" value={money(totals.cashAfterCosts)} note={`${totals.cashMargin.toFixed(1)}% of collected cash remains`} tone={totals.cashAfterCosts >= 0 ? 'success' : 'danger'} />
      <Metric label="Receivables" value={money(receivables)} />
    </section>
    <div className="module-grid">
      <section className="panel full-span">
        <div className="panel-title"><h2>Active job health</h2><Link to="/costing">Open costing</Link></div>
        <div className="data-table"><div className="table-head"><span>Job</span><span>Progress</span><span>Budget</span><span>Actual</span><span>Projected profit</span></div>{active.map((job) => {
          const f = jobFinancials(job, ws.data)
          return <div className="table-row" key={job.id}><span><strong>{job.title}</strong><small>{job.number} · {ws.customer(job.customer_id)?.full_name}</small></span><span><div className="progress"><i style={{ width: `${job.completion_percent || 0}%` }} /></div>{Number(job.completion_percent || 0).toFixed(0)}%</span><span>{money(f.budget)}</span><span className={f.budgetVariance < 0 ? 'negative' : ''}>{money(f.actualCost)}</span><span className={f.profit >= 0 ? 'positive' : 'negative'}>{money(f.profit)}</span></div>
        })}</div>
      </section>
      <section className="panel">
        <div className="panel-title"><h2>Where the money is going</h2><Link to="/expenses">Open expenses</Link></div>
        <div className="stat-list"><div><span>Cash actually collected</span><strong>{money(totals.cashCollected)}</strong></div><div><span>Direct job costs</span><strong>{money(totals.actualCost)}</strong></div><div><span>Company overhead</span><strong>{money(totals.overheadExpenses)}</strong></div><div><span>Total business costs</span><strong>{money(totals.totalActualCost)}</strong></div><div><span>Cash remaining after costs</span><strong className={totals.cashAfterCosts >= 0 ? 'positive' : 'negative'}>{money(totals.cashAfterCosts)}</strong></div><div><span>Contracted / projected job revenue</span><strong>{money(totals.revenue)}</strong></div></div>
      </section>
      <section className="panel">
        <div className="panel-title"><h2>Today’s priorities</h2><Link to="/schedule">Schedule</Link></div>
        <div className="record-list">{ws.data.tasks.filter((task) => !task.done).slice(0, 6).map((task) => <button className="record-row actionable" key={task.id} onClick={() => ws.updateAndWait('tasks', task.id, { done: true })}><div><strong>{task.title}</strong><small>{task.due_date} · {task.assigned_label}</small></div><span>Mark done</span></button>)}</div>
      </section>
      <section className="panel">
        <h2>Attention needed</h2>
        <div className="alert-list">{ws.data.equipment.filter((item) => item.status === 'maintenance' || (item.next_service_hours && Number(item.current_hours) >= Number(item.next_service_hours))).map((item) => <Link to="/fleet" key={item.id}>Service due: {item.name}</Link>)}{ws.data.invoices.filter((item) => item.status === 'overdue').map((item) => <Link to="/invoices" key={item.id}>Overdue invoice {item.number}</Link>)}{!ws.data.invoices.some((x) => x.status === 'overdue') && !ws.data.equipment.some((x) => x.status === 'maintenance') ? <p className="muted">No urgent exceptions.</p> : null}</div>
      </section>
    </div>
  </div>
}
