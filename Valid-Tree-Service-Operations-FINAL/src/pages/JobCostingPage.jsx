import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useWorkspace } from '../data/WorkspaceProvider'
import { COST_CATEGORIES, jobFinancials, laborCost, money } from '../lib/operations'
import { Empty, ErrorBanner, Field, Metric, PageHeader, SelectJob } from '../components/OperationsUI'

const initialTime = { worker_name: '', worker_type: 'contractor', regular_hours: 8, overtime_hours: 0, hourly_rate: '', overtime_multiplier: 1.5, work_date: new Date().toISOString().slice(0, 10) }

export default function JobCostingPage() {
  const ws = useWorkspace()
  const [jobId, setJobId] = useState(ws.data.jobs[0]?.id || '')
  const [time, setTime] = useState(initialTime)
  const [budget, setBudget] = useState({ category: 'labor', description: '', estimated_amount: '' })
  const [change, setChange] = useState({ title: '', description: '', amount: '' })
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const job = ws.job(jobId)
  const financials = useMemo(() => jobFinancials(job, ws.data), [job, ws.data])
  const budgets = ws.data.job_budgets.filter((item) => item.job_id === jobId)
  const expenses = ws.data.expenses.filter((item) => item.job_id === jobId)
  const times = ws.data.time_entries.filter((item) => item.job_id === jobId)
  const changes = ws.data.change_orders.filter((item) => item.job_id === jobId)

  async function submit(collection, payload, reset) {
    setBusy(true); setMessage('')
    try { await ws.addAndWait(collection, { job_id: jobId, ...payload }); reset() }
    catch (error) { setMessage(error.message) }
    finally { setBusy(false) }
  }

  if (!ws.data.jobs.length) return <><PageHeader eyebrow="Financial control" title="Job Costing" /><Empty>Create a job before adding budgets or costs.</Empty></>
  return <div className="operations-page">
    <PageHeader eyebrow="Estimated vs. actual" title="Job Costing"><SelectJob jobs={ws.data.jobs} value={jobId} onChange={setJobId} /></PageHeader>
    <ErrorBanner message={message || ws.syncError} />
    <section className="metric-grid five"><Metric label="Revenue" value={money(financials.revenue)} /><Metric label="Budget" value={money(financials.budget)} /><Metric label="Actual cost" value={money(financials.actualCost)} tone={financials.budgetVariance < 0 ? 'danger' : ''} /><Metric label="Projected profit" value={money(financials.profit)} tone={financials.profit < 0 ? 'danger' : 'success'} /><Metric label="Margin" value={`${financials.margin.toFixed(1)}%`} note={`${money(financials.budgetVariance)} budget remaining`} /></section>
    <div className="module-grid">
      <section className="panel"><h2>Budget</h2><form className="inline-form" onSubmit={(event) => { event.preventDefault(); submit('job_budgets', { ...budget, estimated_amount: Number(budget.estimated_amount) }, () => setBudget({ category: 'labor', description: '', estimated_amount: '' })) }}><Field label="Category"><select value={budget.category} onChange={(e) => setBudget({ ...budget, category: e.target.value })}>{COST_CATEGORIES.map((item) => <option key={item}>{item}</option>)}</select></Field><Field label="Description"><input required value={budget.description} onChange={(e) => setBudget({ ...budget, description: e.target.value })} /></Field><Field label="Amount"><input required min="0" step=".01" type="number" value={budget.estimated_amount} onChange={(e) => setBudget({ ...budget, estimated_amount: e.target.value })} /></Field><button className="button primary" disabled={busy}>Add budget</button></form><div className="record-list">{budgets.length ? budgets.map((item) => <div className="record-row" key={item.id}><div><strong>{item.description}</strong><small>{item.category}</small></div><b>{money(item.estimated_amount)}</b></div>) : <Empty>No budget lines yet.</Empty>}</div></section>
      <section className="panel"><div className="panel-title"><div><h2>Linked expenses</h2><p className="muted-left">Only expenses assigned to this job appear here.</p></div><Link className="button primary" to={`/expenses?job=${jobId}`}>Add expense</Link></div><div className="record-list">{expenses.length ? expenses.map((item) => <Link to="/expenses" className="record-row actionable" key={item.id}><div><strong>{item.description}</strong><small>{item.expense_date} · {item.vendor || item.category}</small></div><b>{money(item.amount)}</b></Link>) : <Empty>No expenses linked to this job.</Empty>}</div></section>
      <section className="panel"><h2>Labor & crew time</h2><form className="form-grid" onSubmit={(event) => { event.preventDefault(); submit('time_entries', { ...time, crew_id: job?.crew_id || null, regular_hours: Number(time.regular_hours), overtime_hours: Number(time.overtime_hours), hourly_rate: Number(time.hourly_rate), overtime_multiplier: Number(time.overtime_multiplier) }, () => setTime(initialTime)) }}><Field label="Worker"><input required value={time.worker_name} onChange={(e) => setTime({ ...time, worker_name: e.target.value })} /></Field><Field label="Date"><input type="date" value={time.work_date} onChange={(e) => setTime({ ...time, work_date: e.target.value })} /></Field><Field label="Regular hours"><input min="0" step=".25" type="number" value={time.regular_hours} onChange={(e) => setTime({ ...time, regular_hours: e.target.value })} /></Field><Field label="Overtime hours"><input min="0" step=".25" type="number" value={time.overtime_hours} onChange={(e) => setTime({ ...time, overtime_hours: e.target.value })} /></Field><Field label="Hourly rate"><input required min="0" step=".01" type="number" value={time.hourly_rate} onChange={(e) => setTime({ ...time, hourly_rate: e.target.value })} /></Field><Field label="Type"><select value={time.worker_type} onChange={(e) => setTime({ ...time, worker_type: e.target.value })}><option>contractor</option><option>employee</option><option>owner</option></select></Field><button className="button primary wide" disabled={busy}>Save time</button></form><div className="record-list">{times.slice(0, 6).map((item) => <div className="record-row" key={item.id}><div><strong>{item.worker_name}</strong><small>{item.work_date} · {Number(item.regular_hours) + Number(item.overtime_hours)} hours · {item.worker_type}</small></div><b>{money(laborCost(item))}</b></div>)}</div></section>
      <section className="panel"><h2>Change orders</h2><form className="form-grid" onSubmit={(event) => { event.preventDefault(); submit('change_orders', { ...change, contract_id: job?.contract_id || null, number: `CO-${new Date().getFullYear()}-${String(ws.data.change_orders.length + 1).padStart(4, '0')}`, amount: Number(change.amount), status: 'draft' }, () => setChange({ title: '', description: '', amount: '' })) }}><Field label="Title"><input required value={change.title} onChange={(e) => setChange({ ...change, title: e.target.value })} /></Field><Field label="Amount"><input required type="number" step=".01" value={change.amount} onChange={(e) => setChange({ ...change, amount: e.target.value })} /></Field><Field label="Scope change" className="wide"><textarea required value={change.description} onChange={(e) => setChange({ ...change, description: e.target.value })} /></Field><button className="button primary wide" disabled={busy}>Create change order</button></form><div className="record-list">{changes.map((item) => <div className="record-row" key={item.id}><div><strong>{item.number} · {item.title}</strong><small>{item.status}</small></div><div><b>{money(item.amount)}</b>{item.status !== 'approved' ? <button className="text-button" onClick={() => ws.updateAndWait('change_orders', item.id, { status: 'approved', approved_at: new Date().toISOString(), approved_by: 'Customer' })}>Approve</button> : null}</div></div>)}</div></section>
    </div>
  </div>
}
