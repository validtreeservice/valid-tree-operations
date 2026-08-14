import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import Modal from '../components/Modal'
import { COST_CATEGORIES, money } from '../lib/operations'
import { Empty, ErrorBanner, Field, PageHeader } from '../components/OperationsUI'
import { useWorkspace } from '../data/WorkspaceProvider'

const today = () => new Date().toISOString().slice(0, 10)
const blank = (jobId = '') => ({ job_id: jobId, category: 'fuel', vendor: '', description: '', amount: '', expense_date: today(), payment_method: 'business account', notes: '', receipt: null })

export default function ExpensesPage() {
  const ws = useWorkspace()
  const [params] = useSearchParams()
  const [form, setForm] = useState(blank(params.get('job') || ''))
  const [selected, setSelected] = useState(null)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  const expenses = useMemo(() => ws.data.expenses.filter((item) => {
    const text = `${item.description} ${item.vendor} ${item.category} ${ws.job(item.job_id)?.number || ''}`.toLowerCase()
    return (category === 'all' || item.category === category) && text.includes(search.toLowerCase())
  }), [ws.data.expenses, ws.data.jobs, search, category])
  const total = expenses.reduce((sum, item) => sum + Number(item.amount || 0), 0)

  async function save(event) {
    event.preventDefault(); setBusy(true); setMessage('')
    try {
      let receipt_path = null
      if (form.receipt) receipt_path = await ws.uploadReceipt(form.receipt, form.job_id || 'general')
      await ws.addAndWait('expenses', { ...form, job_id: form.job_id || null, amount: Number(form.amount), receipt: undefined, receipt_path })
      setForm(blank()); setMessage('Expense saved successfully.')
    } catch (error) { setMessage(error.message) }
    finally { setBusy(false) }
  }

  async function openReceipt(item) {
    setMessage('')
    try { window.open(await ws.getReceiptUrl(item.receipt_path || item.receipt_url), '_blank', 'noopener,noreferrer') }
    catch (error) { setMessage(error.message) }
  }

  async function removeExpense(item) {
    if (!confirm(`Delete ${item.description} for ${money(item.amount)}?`)) return
    try { await ws.removeAndWait('expenses', item.id); setSelected(null) }
    catch (error) { setMessage(error.message) }
  }

  return <div className="operations-page">
    <PageHeader eyebrow="Company spending" title="Expenses" description="Keep every business expense and receipt in one ledger. Linking an expense to a job is optional." />
    <ErrorBanner message={ws.syncError || (message.includes('successfully') ? '' : message)} />
    {message.includes('successfully') ? <p className="success-banner">{message}</p> : null}
    <div className="module-grid expenses-layout">
      <section className="panel">
        <h2>Add expense</h2>
        <form className="form-grid" onSubmit={save}>
          <Field label="Job (optional)" className="wide"><select value={form.job_id} onChange={(e) => setForm({ ...form, job_id: e.target.value })}><option value="">General company expense / overhead</option>{ws.data.jobs.map((job) => <option key={job.id} value={job.id}>{job.number} — {job.title}</option>)}</select></Field>
          <Field label="Category"><select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>{COST_CATEGORIES.map((item) => <option key={item}>{item}</option>)}</select></Field>
          <Field label="Date"><input required type="date" value={form.expense_date} onChange={(e) => setForm({ ...form, expense_date: e.target.value })} /></Field>
          <Field label="Vendor"><input value={form.vendor} onChange={(e) => setForm({ ...form, vendor: e.target.value })} placeholder="Store or person paid" /></Field>
          <Field label="Amount"><input required min="0.01" step=".01" type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></Field>
          <Field label="Description" className="wide"><input required value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
          <Field label="Payment method"><select value={form.payment_method} onChange={(e) => setForm({ ...form, payment_method: e.target.value })}><option>business account</option><option>business card</option><option>check</option><option>cash</option><option>Zelle</option><option>other</option></select></Field>
          <Field label="Receipt"><input type="file" accept="image/*,.pdf" onChange={(e) => setForm({ ...form, receipt: e.target.files[0] || null })} /></Field>
          <Field label="Notes" className="wide"><textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
          <button className="button primary wide" disabled={busy}>{busy ? 'Saving…' : 'Save expense'}</button>
        </form>
      </section>
      <section className="panel full-span expense-ledger">
        <div className="panel-title"><div><h2>Expense ledger</h2><p className="muted-left">{expenses.length} records · {money(total)}</p></div></div>
        <div className="expense-filters"><input placeholder="Search vendor, description or job…" value={search} onChange={(e) => setSearch(e.target.value)} /><select value={category} onChange={(e) => setCategory(e.target.value)}><option value="all">All categories</option>{COST_CATEGORIES.map((item) => <option key={item}>{item}</option>)}</select></div>
        {expenses.length ? <div className="data-table"><div className="table-head expense-columns"><span>Date / description</span><span>Category</span><span>Job</span><span>Receipt</span><span>Amount</span></div>{expenses.map((item) => <button className="table-row expense-columns expense-row" key={item.id} onClick={() => setSelected(item)}><span><strong>{item.description}</strong><small>{item.expense_date} · {item.vendor || 'No vendor'}</small></span><span>{item.category}</span><span>{ws.job(item.job_id)?.number || 'Overhead'}</span><span>{item.receipt_path || item.receipt_url ? 'View available' : 'None'}</span><span><strong>{money(item.amount)}</strong></span></button>)}</div> : <Empty>No expenses match your filters.</Empty>}
      </section>
    </div>
    <Modal title="Expense details" open={!!selected} onClose={() => setSelected(null)}>{selected ? <div className="expense-detail"><div className="detail-hero"><div><p className="eyebrow">{selected.category}</p><h2>{selected.description}</h2><p>{selected.vendor || 'No vendor recorded'}</p></div><strong>{money(selected.amount)}</strong></div><div className="detail-grid"><div><span>Date</span><strong>{selected.expense_date}</strong></div><div><span>Job</span><strong>{ws.job(selected.job_id)?.number || 'General company expense'}</strong></div><div><span>Payment method</span><strong>{selected.payment_method || 'Not recorded'}</strong></div><div><span>Receipt</span><strong>{selected.receipt_path || selected.receipt_url ? 'Attached' : 'Not attached'}</strong></div></div>{selected.notes ? <div className="scope-preview"><span>Notes</span><p>{selected.notes}</p></div> : null}<div className="form-actions">{selected.receipt_path || selected.receipt_url ? <button className="button secondary" onClick={() => openReceipt(selected)}>Open receipt</button> : null}<button className="button secondary danger" onClick={() => removeExpense(selected)}>Delete expense</button><button className="button primary" onClick={() => setSelected(null)}>Close</button></div></div> : null}</Modal>
  </div>
}
