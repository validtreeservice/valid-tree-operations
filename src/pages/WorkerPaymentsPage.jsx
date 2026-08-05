import { useMemo, useState } from 'react'
import { useWorkspace } from '../data/WorkspaceProvider'
import { money, sum } from '../lib/operations'
import { Empty, ErrorBanner, Field, Metric, PageHeader } from '../components/OperationsUI'

const today = () => new Date().toISOString().slice(0, 10)
const blankWorker = { full_name: '', phone: '', classification: 'unreviewed', default_rate: '', rate_type: 'day', tax_form_type: 'none', tax_form_on_file: false, tax_id_last4: '', work_authorization_reviewed: false, active: true, notes: '' }
const blankPayment = { worker_id: '', job_id: '', work_date: today(), payment_date: today(), units: 1, rate: '', amount: '', payment_method: 'business account', payment_reference: '', work_description: '', receipt_acknowledged: false, notes: '' }

export default function WorkerPaymentsPage() {
  const ws = useWorkspace()
  const [worker, setWorker] = useState(blankWorker)
  const [payment, setPayment] = useState(blankPayment)
  const [message, setMessage] = useState('')
  const year = new Date().getFullYear()
  const yearPayments = ws.data.worker_payments.filter((item) => new Date(`${item.payment_date}T12:00:00`).getFullYear() === year)
  const total = sum(yearPayments, (item) => item.amount)
  const selectedWorker = ws.data.workers.find((item) => item.id === payment.worker_id)

  function chooseWorker(id) {
    const item = ws.data.workers.find((candidate) => candidate.id === id)
    setPayment((current) => ({ ...current, worker_id: id, rate: item?.default_rate || '', amount: item?.default_rate || '' }))
  }

  async function saveWorker(event) {
    event.preventDefault(); setMessage('')
    if (worker.tax_id_last4 && !/^\d{4}$/.test(worker.tax_id_last4)) return setMessage('Enter only the final four digits of the tax ID.')
    try {
      await ws.addAndWait('workers', { ...worker, default_rate: Number(worker.default_rate), tax_id_last4: worker.tax_id_last4 || null })
      setWorker(blankWorker)
    } catch (error) { setMessage(error.message) }
  }

  async function savePayment(event) {
    event.preventDefault(); setMessage('')
    const amount = Number(payment.amount)
    if (!payment.worker_id || amount <= 0 || !payment.work_description.trim()) return setMessage('Choose a worker, describe the work, and enter an amount greater than zero.')
    try {
      const expense = await ws.addAndWait('expenses', {
        job_id: payment.job_id || null, category: 'labor', vendor: selectedWorker?.full_name || 'Worker',
        description: payment.work_description, amount, expense_date: payment.payment_date,
        payment_method: payment.payment_method, notes: `Worker payment${payment.payment_reference ? ` · ${payment.payment_reference}` : ''}`,
      })
      await ws.addAndWait('worker_payments', { ...payment, job_id: payment.job_id || null, expense_id: expense.id, units: Number(payment.units), rate: Number(payment.rate), amount })
      setPayment(blankPayment)
    } catch (error) { setMessage(error.message) }
  }

  return <div className="operations-page">
    <PageHeader eyebrow="Labor records" title="Workers & Payments" />
    <ErrorBanner message={message || ws.syncError} />
    <div className="notice legal-notice"><strong>Classification and authorization matter</strong><p>This ledger proves what you paid; it does not decide whether someone is legally an employee or contractor and it does not create work authorization. Have a Texas employment lawyer or CPA review each worker. Keep full W-9, I-9, SSN and ITIN information outside this app.</p></div>
    <section className="metric-grid three"><Metric label={`${year} worker payments`} value={money(total)} /><Metric label="Active workers" value={ws.data.workers.filter((item) => item.active).length} /><Metric label="Tax forms missing" value={ws.data.workers.filter((item) => !item.tax_form_on_file).length} tone={ws.data.workers.some((item) => !item.tax_form_on_file) ? 'danger' : ''} /></section>
    <div className="module-grid">
      <section className="panel"><h2>Add worker</h2><form className="form-grid" onSubmit={saveWorker}>
        <Field label="Full legal name"><input required value={worker.full_name} onChange={(e) => setWorker({ ...worker, full_name: e.target.value })} /></Field>
        <Field label="Phone"><input value={worker.phone} onChange={(e) => setWorker({ ...worker, phone: e.target.value })} /></Field>
        <Field label="Classification"><select value={worker.classification} onChange={(e) => setWorker({ ...worker, classification: e.target.value })}><option value="unreviewed">Needs professional review</option><option value="employee">Employee</option><option value="independent_contractor">Independent contractor</option></select></Field>
        <Field label="Default rate"><input required min="0" step=".01" type="number" value={worker.default_rate} onChange={(e) => setWorker({ ...worker, default_rate: e.target.value })} /></Field>
        <Field label="Rate type"><select value={worker.rate_type} onChange={(e) => setWorker({ ...worker, rate_type: e.target.value })}><option>hour</option><option>day</option><option>job</option><option>flat</option></select></Field>
        <Field label="Tax form"><select value={worker.tax_form_type} onChange={(e) => setWorker({ ...worker, tax_form_type: e.target.value })}><option value="none">Not received</option><option value="w9">W-9</option><option value="w4">W-4</option></select></Field>
        <Field label="Tax ID last 4 only"><input inputMode="numeric" maxLength="4" value={worker.tax_id_last4} onChange={(e) => setWorker({ ...worker, tax_id_last4: e.target.value.replace(/\D/g, '') })} /></Field>
        <div className="checks wide"><label><input type="checkbox" checked={worker.tax_form_on_file} onChange={(e) => setWorker({ ...worker, tax_form_on_file: e.target.checked })} /> Tax form on file</label><label><input type="checkbox" checked={worker.work_authorization_reviewed} onChange={(e) => setWorker({ ...worker, work_authorization_reviewed: e.target.checked })} /> Work authorization reviewed where required</label></div>
        <Field label="Notes" className="wide"><textarea value={worker.notes} onChange={(e) => setWorker({ ...worker, notes: e.target.value })} /></Field>
        <button className="button primary wide">Save worker</button>
      </form></section>
      <section className="panel"><h2>Record payment</h2><form className="form-grid" onSubmit={savePayment}>
        <Field label="Worker"><select required value={payment.worker_id} onChange={(e) => chooseWorker(e.target.value)}><option value="">Choose worker</option>{ws.data.workers.filter((item) => item.active).map((item) => <option value={item.id} key={item.id}>{item.full_name}</option>)}</select></Field>
        <Field label="Job"><select value={payment.job_id} onChange={(e) => setPayment({ ...payment, job_id: e.target.value })}><option value="">General labor / overhead</option>{ws.data.jobs.map((job) => <option value={job.id} key={job.id}>{job.number} — {job.title}</option>)}</select></Field>
        <Field label="Work date"><input type="date" value={payment.work_date} onChange={(e) => setPayment({ ...payment, work_date: e.target.value })} /></Field>
        <Field label="Payment date"><input type="date" value={payment.payment_date} onChange={(e) => setPayment({ ...payment, payment_date: e.target.value })} /></Field>
        <Field label={`Units (${selectedWorker?.rate_type || 'day'})`}><input min=".01" step=".01" type="number" value={payment.units} onChange={(e) => setPayment({ ...payment, units: e.target.value, amount: Number(e.target.value) * Number(payment.rate || 0) })} /></Field>
        <Field label="Rate"><input min="0" step=".01" type="number" value={payment.rate} onChange={(e) => setPayment({ ...payment, rate: e.target.value, amount: Number(payment.units) * Number(e.target.value) })} /></Field>
        <Field label="Amount paid"><input required min=".01" step=".01" type="number" value={payment.amount} onChange={(e) => setPayment({ ...payment, amount: e.target.value })} /></Field>
        <Field label="Method"><select value={payment.payment_method} onChange={(e) => setPayment({ ...payment, payment_method: e.target.value })}><option>business account</option><option>check</option><option>Zelle</option><option>cash</option><option>other</option></select></Field>
        <Field label="Work performed" className="wide"><textarea required value={payment.work_description} onChange={(e) => setPayment({ ...payment, work_description: e.target.value })} /></Field>
        <Field label="Transaction / check reference" className="wide"><input value={payment.payment_reference} onChange={(e) => setPayment({ ...payment, payment_reference: e.target.value })} /></Field>
        <label className="check wide"><input type="checkbox" checked={payment.receipt_acknowledged} onChange={(e) => setPayment({ ...payment, receipt_acknowledged: e.target.checked })} /> Worker acknowledged receiving this payment</label>
        <button className="button primary wide">Record payment and labor expense</button>
      </form></section>
      <section className="panel full-span"><h2>Payment ledger</h2>{yearPayments.length ? <div className="data-table"><div className="table-head"><span>Worker</span><span>Job</span><span>Work date</span><span>Method</span><span>Amount</span></div>{yearPayments.map((item) => <div className="table-row" key={item.id}><span><strong>{ws.data.workers.find((worker) => worker.id === item.worker_id)?.full_name}</strong><small>{item.work_description}</small></span><span>{ws.job(item.job_id)?.number || 'Overhead'}</span><span>{item.work_date}</span><span>{item.payment_method}{item.receipt_acknowledged ? ' · acknowledged' : ''}</span><span>{money(item.amount)}</span></div>)}</div> : <Empty>No worker payments recorded.</Empty>}</section>
    </div>
  </div>
}
