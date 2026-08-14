import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const money = (value) => Number(value || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' })
const date = (value) => value ? new Date(String(value).includes('T') ? value : `${value}T12:00:00`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '—'

export default function ReceiptPage() {
  const { token } = useParams()
  const [record, setRecord] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      if (!supabase || !token) return setError('This receipt is unavailable.')
      const { data, error: rpcError } = await supabase.rpc('get_invoice_receipt', { p_token: token })
      if (rpcError || !data) setError(rpcError?.message || 'This receipt is unavailable.')
      else setRecord(data)
    }
    load()
  }, [token])

  if (error) return <main className="receipt-page"><section className="receipt-document receipt-message"><img src="/valid-tree-logo.png" alt="Valid Tree Service" /><h1>Receipt unavailable</h1><p>{error}</p></section></main>
  if (!record) return <main className="receipt-page"><section className="receipt-document receipt-message"><h1>Loading receipt…</h1></section></main>

  const { invoice, customer, company, payments = [] } = record
  const balance = Math.max(Number(invoice.amount) - Number(invoice.paid), 0)
  const paid = Number(invoice.paid) > 0
  return <main className="receipt-page">
    <button className="button primary receipt-print" onClick={() => window.print()}>Print / Save PDF</button>
    <article className="receipt-document">
      <header className="receipt-header"><img src="/valid-tree-logo.png" alt="Valid Tree Service" /><div><h1>{company.legal_name || 'Valid Tree Service LLC'}</h1><p>{company.address}</p><p>{company.phone} · {company.email}</p><p>{company.website}</p></div></header>
      <div className="receipt-accent" />
      <section className="receipt-title"><div><span>{paid ? 'Payment receipt' : 'Invoice'}</span><h2>{invoice.number}</h2></div><strong className={`receipt-stamp ${invoice.status === 'void' ? 'void' : ''}`}>{invoice.status === 'void' ? 'VOID' : paid && balance <= 0 ? 'PAID' : invoice.status?.toUpperCase()}</strong></section>
      <section className="receipt-grid"><div><span>Bill to</span><strong>{customer.full_name || 'Customer'}</strong><p>{customer.service_address}</p><p>{customer.email}</p><p>{customer.phone}</p></div><div><span>Invoice details</span><p><strong>Created:</strong> {date(invoice.created_at)}</p><p><strong>Due:</strong> {date(invoice.due_date)}</p>{invoice.last_payment_at ? <p><strong>Last payment:</strong> {date(invoice.last_payment_at)}</p> : null}</div></section>
      <table className="receipt-totals"><tbody><tr><td>Invoice total</td><td>{money(invoice.amount)}</td></tr><tr><td>Payments received</td><td>{money(invoice.paid)}</td></tr><tr className="balance"><td>Balance due</td><td>{money(balance)}</td></tr></tbody></table>
      {balance > 0 && invoice.status !== 'void' ? <section className="zelle-instructions receipt-zelle"><h3>Pay with Zelle</h3><p>Scan in your banking app and send <strong>{money(balance)}</strong> to <strong>Valid Tree Service LLC at 832-445-6535</strong>. Put invoice <strong>{invoice.number}</strong> in the memo.</p><img src="/zelle-qr.jpg" alt="Zelle QR code for Valid Tree Service LLC at 832-445-6535" /><p className="signature-warning-box">Your invoice will not be marked paid automatically. The office will verify the transfer and record it after it arrives.</p></section> : null}
      {payments.length ? <section className="receipt-payments"><h3>Payment history</h3>{payments.map((payment, index) => <div key={`${payment.payment_date}-${index}`}><span>{date(payment.payment_date)} · {payment.method || 'payment'}</span><strong>{money(payment.amount)}</strong></div>)}</section> : null}
      {invoice.status === 'void' ? <p className="receipt-void-note">This invoice was voided{invoice.void_reason ? `: ${invoice.void_reason}` : '.'}</p> : null}
      {invoice.notes ? <section className="receipt-notes"><h3>Notes</h3><p>{invoice.notes}</p></section> : null}
      <footer>Thank you for choosing {company.legal_name || 'Valid Tree Service LLC'}. · {company.phone} · {company.website}</footer>
    </article>
  </main>
}
