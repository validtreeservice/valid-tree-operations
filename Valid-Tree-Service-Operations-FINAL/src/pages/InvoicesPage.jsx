import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useWorkspace } from '../data/WorkspaceProvider'
import PageHeader from '../components/PageHeader'
import Modal from '../components/Modal'
import StatusBadge from '../components/StatusBadge'
import { createStripeCheckout } from '../lib/stripePayments'

const money = (value) => Number(value || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' })
const blank = { customer_id: '', amount: '', paid: '0', due_date: '', status: 'open' }

export default function InvoicesPage() {
  const workspace = useWorkspace()
  const { data, customer } = workspace
  const [params] = useSearchParams()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(blank)
  const [busyId, setBusyId] = useState('')
  const [message, setMessage] = useState(params.get('payment') === 'success' ? 'Stripe received the payment. The invoice will update after its secure confirmation arrives.' : '')
  const activeInvoices = data.invoices.filter((invoice) => invoice.status !== 'void')
  const outstanding = useMemo(() => activeInvoices.reduce((sum, invoice) => sum + Math.max(Number(invoice.amount) - Number(invoice.paid), 0), 0), [data.invoices])

  const receiptUrl = (invoice) => `${window.location.origin}/receipt/${invoice.receipt_token}`

  async function save(event) {
    event.preventDefault()
    const amount = Number(form.amount || 0)
    const paid = Math.min(Number(form.paid || 0), amount)
    const status = paid >= amount ? 'paid' : paid > 0 ? 'partial' : 'open'
    await workspace.addAndWait('invoices', { ...form, number: `INV-${new Date().getFullYear()}-${String(data.invoices.length + 70).padStart(4, '0')}`, amount, paid, manual_paid: paid, status, job_id: null })
    setOpen(false); setForm(blank)
  }

  async function recordManualPayment(invoice) {
    const balance = Math.max(Number(invoice.amount) - Number(invoice.paid), 0)
    const entered = prompt('Payment amount received outside Stripe', String(balance))
    if (!entered) return
    const amount = Number(entered)
    if (!Number.isFinite(amount) || amount <= 0 || amount > balance) return setMessage(`Enter an amount between $0.01 and ${money(balance)}.`)
    setBusyId(invoice.id)
    try {
      const paid = Number(invoice.paid || 0) + amount
      await workspace.addAndWait('payments', { invoice_id: invoice.id, job_id: invoice.job_id || null, amount, payment_date: new Date().toISOString().slice(0, 10), method: 'manual', reference: '', notes: 'Recorded manually in Operations Center', provider: 'manual', processing_fee: 0, net_amount: amount, status: 'succeeded' })
      await workspace.updateAndWait('invoices', invoice.id, { paid, manual_paid: Number(invoice.manual_paid ?? invoice.paid ?? 0) + amount, status: paid >= Number(invoice.amount) ? 'paid' : 'partial', last_payment_at: new Date().toISOString() })
      setMessage(`Recorded ${money(amount)} on ${invoice.number}. Receipt is ready to share.`)
    } catch (error) { setMessage(error.message) } finally { setBusyId('') }
  }

  async function makeCardLink(invoice) {
    setBusyId(invoice.id); setMessage('')
    try {
      const checkout = await createStripeCheckout({ invoice_id: invoice.id, payment_kind: 'balance' })
      await navigator.clipboard.writeText(checkout.url)
      setMessage(`Stripe payment link copied for ${invoice.number}. It expires in 30 minutes—send it to the customer now.`)
      await workspace.refresh()
    } catch (error) { setMessage(error.message) } finally { setBusyId('') }
  }

  async function shareReceipt(invoice) {
    const url = receiptUrl(invoice)
    const client = customer(invoice.customer_id)
    const text = `${invoice.status === 'paid' ? 'Payment receipt' : 'Invoice'} ${invoice.number} from Valid Tree Service LLC: ${url}`
    try {
      if (navigator.share) await navigator.share({ title: `${invoice.number} — Valid Tree Service LLC`, text, url })
      else { await navigator.clipboard.writeText(text); setMessage('Receipt link copied. Paste it into a text message or email.') }
    } catch (error) {
      if (error.name !== 'AbortError') { await navigator.clipboard.writeText(text); setMessage(`Receipt copied for ${client?.full_name || 'customer'}.`) }
    }
  }

  function emailReceipt(invoice) {
    const client = customer(invoice.customer_id)
    const subject = encodeURIComponent(`${invoice.status === 'paid' ? 'Payment receipt' : 'Invoice'} ${invoice.number} — Valid Tree Service LLC`)
    const body = encodeURIComponent(`Hello ${client?.full_name || ''},\n\nThank you for choosing Valid Tree Service LLC. You can view and print your ${invoice.status === 'paid' ? 'payment receipt' : 'invoice'} here:\n\n${receiptUrl(invoice)}\n\nValid Tree Service LLC\n832-445-6535`)
    window.location.href = `mailto:${encodeURIComponent(client?.email || '')}?subject=${subject}&body=${body}`
  }

  async function removeOrVoid(invoice) {
    const hasMoney = Number(invoice.paid || 0) > 0
    const hasCardSession = Boolean(invoice.stripe_checkout_session_id)
    if (!hasMoney && !hasCardSession) {
      if (!confirm(`Delete ${invoice.number}? This cannot be undone.`)) return
      await workspace.removeAndWait('invoices', invoice.id)
      return setMessage(`${invoice.number} was deleted.`)
    }
    const reason = prompt(`This invoice has payment history or a card link, so it cannot be erased safely. Enter a reason to void ${invoice.number}:`, 'Entered in error')
    if (!reason?.trim()) return
    await workspace.updateAndWait('invoices', invoice.id, { status: 'void', voided_at: new Date().toISOString(), void_reason: reason.trim(), payment_link: null })
    setMessage(`${invoice.number} was voided and retained for your records.`)
  }

  return <section>
    <PageHeader title="Invoices" description="Collect payments, send branded receipts, and preserve complete payment history." action={<button className="button primary" onClick={() => setOpen(true)}>New invoice</button>} />
    {message ? <p className="success-banner">{message}</p> : null}
    <div className="invoice-summary"><div><span>Total outstanding</span><strong>{money(outstanding)}</strong></div><div><span>Overdue</span><strong>{money(activeInvoices.filter((invoice) => invoice.status === 'overdue').reduce((sum, invoice) => sum + Number(invoice.amount) - Number(invoice.paid), 0))}</strong></div><div><span>Collected</span><strong>{money(data.invoices.reduce((sum, invoice) => sum + Number(invoice.paid), 0))}</strong></div><div><span>Stripe fees</span><strong>{money(data.invoices.reduce((sum, invoice) => sum + Number(invoice.stripe_fee || 0), 0))}</strong></div></div>
    <div className="table-wrap"><table><thead><tr><th>Invoice</th><th>Customer</th><th>Amount</th><th>Paid</th><th>Balance</th><th>Status</th><th>Actions</th></tr></thead><tbody>{data.invoices.map((invoice) => { const balance = Math.max(Number(invoice.amount) - Number(invoice.paid), 0); const disabled = busyId === invoice.id || invoice.status === 'void'; return <tr key={invoice.id}><td><strong>{invoice.number}</strong>{invoice.stripe_status ? <small className="table-subline">Stripe: {invoice.stripe_status.replaceAll('_', ' ')}</small> : null}</td><td>{customer(invoice.customer_id)?.full_name}</td><td>{money(invoice.amount)}</td><td>{money(invoice.paid)}</td><td><strong>{money(balance)}</strong></td><td><StatusBadge value={invoice.status} /></td><td><div className="invoice-actions"><button className="table-button" disabled={disabled || balance <= 0} onClick={() => makeCardLink(invoice)}>{busyId === invoice.id ? 'Working…' : 'Copy card link'}</button>{invoice.receipt_token ? <><button className="table-button" onClick={() => shareReceipt(invoice)}>Share receipt</button><button className="table-button" onClick={() => emailReceipt(invoice)}>Email receipt</button><a className="table-button" href={`/receipt/${invoice.receipt_token}`} target="_blank" rel="noreferrer">View / PDF</a></> : null}<button className="table-button" disabled={disabled || balance <= 0} onClick={() => recordManualPayment(invoice)}>Record payment</button><button className="table-button danger" onClick={() => removeOrVoid(invoice)}>{Number(invoice.paid || 0) > 0 || invoice.stripe_checkout_session_id ? 'Void' : 'Delete'}</button></div></td></tr> })}</tbody></table></div>
    <Modal title="New invoice" open={open} onClose={() => setOpen(false)}><form className="form-grid" onSubmit={save}><label className="wide">Customer<select value={form.customer_id} onChange={(event) => setForm({ ...form, customer_id: event.target.value })} required><option value="">Select…</option>{data.customers.map((item) => <option key={item.id} value={item.id}>{item.full_name}</option>)}</select></label><label>Invoice amount<input min="0.01" step=".01" type="number" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} required /></label><label>Already paid outside Stripe<input min="0" step=".01" type="number" value={form.paid} onChange={(event) => setForm({ ...form, paid: event.target.value })} /></label><label>Due date<input type="date" value={form.due_date} onChange={(event) => setForm({ ...form, due_date: event.target.value })} required /></label><div className="form-actions wide"><button type="button" className="button secondary" onClick={() => setOpen(false)}>Cancel</button><button className="button primary">Create invoice</button></div></form></Modal>
  </section>
}
