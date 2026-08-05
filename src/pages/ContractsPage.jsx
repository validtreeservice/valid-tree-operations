import { useEffect, useMemo, useState } from 'react'
import { useWorkspace } from '../data/WorkspaceProvider'
import PageHeader from '../components/PageHeader'
import Modal from '../components/Modal'
import StatusBadge from '../components/StatusBadge'
import { printContract } from '../lib/contractPrint'
import { CONTRACTOR_NAME, CONTRACTOR_TITLE } from '../lib/contractTerms'

const blank = { customer_id: '', title: 'Tree Service Agreement', scope_of_work: '', total_price: '', deposit: '', service_date: '', status: 'draft' }
const money = (value) => Number(value || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' })

export default function ContractsPage() {
  const ws = useWorkspace()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(blank)
  const [selectedId, setSelectedId] = useState(null)
  const selected = ws.data.contracts.find((item) => item.id === selectedId) || null
  const next = useMemo(() => `VTS-${new Date().getFullYear()}-${String(ws.data.contracts.length + 39).padStart(4, '0')}`, [ws.data.contracts])

  useEffect(() => {
    const refresh = () => ws.refresh()
    window.addEventListener('focus', refresh)
    return () => window.removeEventListener('focus', refresh)
  }, [ws.refresh])

  function save(event) {
    event.preventDefault()
    const now = new Date().toISOString()
    const record = ws.add('contracts', { ...form, contract_number: next, total_price: Number(form.total_price), deposit: Number(form.deposit || 0), sign_token: crypto.randomUUID(), signed_at: null, signature_name: null, signature_data: null, contractor_name: CONTRACTOR_NAME, contractor_title: CONTRACTOR_TITLE, contractor_signed_at: now })
    setForm(blank); setOpen(false); setSelectedId(record.id)
  }
  function signingUrl(contract) { return `${import.meta.env.VITE_PUBLIC_SITE_URL || location.origin}/sign/${contract.sign_token}` }
  async function share(contract) { const url = signingUrl(contract); await navigator.clipboard?.writeText(url); if (!contract.signature_data) ws.update('contracts', contract.id, { status: 'sent', sent_at: new Date().toISOString() }); alert(`Signature link copied:\n${url}`) }
  function pdf(contract) { printContract({ ...contract, customers: ws.customer(contract.customer_id), settings: ws.data.settings }) }
  function openSigning(contract) { window.open(signingUrl(contract), '_blank', 'noopener,noreferrer') }

  return <section><PageHeader title="Contracts" description="Branded agreements, remote signature links, and onsite tablet acceptance." action={<button className="button primary" onClick={() => setOpen(true)}>New contract</button>} />
    <div className="contract-list">{ws.data.contracts.map((contract) => { const captured = Boolean(contract.signature_data); return <article key={contract.id}><div className="doc-icon">▤</div><button className="doc-main" onClick={() => setSelectedId(contract.id)}><span>{contract.contract_number}</span><h3>{contract.title}</h3><p>{ws.customer(contract.customer_id)?.full_name} · {contract.service_date || 'Not scheduled'}</p>{contract.status === 'signed' && !captured ? <small className="signature-warning">Signature still needs to be captured</small> : null}</button><div className="doc-value"><strong>{money(contract.total_price)}</strong><StatusBadge value={captured ? 'signed' : contract.status} /></div><div className="doc-actions"><button onClick={() => pdf(contract)}>PDF</button><button onClick={() => share(contract)}>Copy sign link</button><button className="primary-mini" onClick={() => setSelectedId(contract.id)}>Open</button></div></article> })}</div>
    <Modal title="New contract" open={open} onClose={() => setOpen(false)}><form className="form-grid" onSubmit={save}><label>Contract number<input value={next} disabled /></label><label>Customer<select required value={form.customer_id} onChange={(e) => setForm({ ...form, customer_id: e.target.value })}><option value="">Select…</option>{ws.data.customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.full_name}</option>)}</select></label><label className="wide">Title<input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label><label className="wide">Scope of work<textarea rows="8" value={form.scope_of_work} onChange={(e) => setForm({ ...form, scope_of_work: e.target.value })} required /></label><label>Total price<input type="number" min="0" step=".01" value={form.total_price} onChange={(e) => setForm({ ...form, total_price: e.target.value, deposit: (Number(e.target.value || 0) * .3).toFixed(2) })} required /></label><label>Deposit<input type="number" min="0" step=".01" value={form.deposit} onChange={(e) => setForm({ ...form, deposit: e.target.value })} /></label><label>Service date<input type="date" value={form.service_date} onChange={(e) => setForm({ ...form, service_date: e.target.value })} /></label><label>Status<select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}><option>draft</option><option>sent</option></select></label><div className="form-actions wide"><button type="button" className="button secondary" onClick={() => setOpen(false)}>Cancel</button><button className="button primary">Create contract</button></div></form></Modal>
    <Modal title={selected?.contract_number || 'Contract'} open={!!selected} onClose={() => setSelectedId(null)}>{selected ? <div className="contract-detail"><div className="detail-hero"><div><p className="eyebrow">{selected.contract_number}</p><h2>{selected.title}</h2><p>{ws.customer(selected.customer_id)?.full_name}</p></div><strong>{money(selected.total_price)}</strong></div><div className="scope-preview"><span>Scope of work</span><p>{selected.scope_of_work}</p></div><div className="detail-grid"><div><span>Deposit</span><strong>{money(selected.deposit)}</strong></div><div><span>Balance</span><strong>{money(selected.total_price - selected.deposit)}</strong></div><div><span>Service date</span><strong>{selected.service_date || 'Not scheduled'}</strong></div><div><span>Customer acceptance</span><strong>{selected.signature_data ? `Signed by ${selected.signature_name}` : 'Signature not captured'}</strong></div><div><span>Contractor acceptance</span><strong>{selected.contractor_name || CONTRACTOR_NAME} · {selected.contractor_signed_at ? new Date(selected.contractor_signed_at).toLocaleDateString() : 'Applied at creation'}</strong></div></div>
      {selected.signature_data ? <div className="saved-signature"><span>Saved customer signature</span><img src={selected.signature_data} alt="Customer electronic signature" /></div> : <p className="signature-warning-box">This contract may say “signed,” but no customer signature image is stored. Open the signing page below and have the customer sign. You do not need to create a new contract.</p>}
      <label>Administrative status<select value={selected.status === 'signed' ? 'signed' : selected.status} disabled={selected.status === 'signed'} onChange={(e) => ws.updateAndWait('contracts', selected.id, { status: e.target.value })}><option>draft</option><option>sent</option>{selected.status === 'signed' ? <option>signed</option> : null}<option>completed</option><option>cancelled</option></select></label>
      <div className="form-actions"><button className="button secondary" onClick={() => pdf(selected)}>Print / PDF</button><button className="button secondary" onClick={() => share(selected)}>Copy signature link</button><button className="button primary" onClick={() => openSigning(selected)}>{selected.signature_data ? 'View signed agreement' : 'Open onsite signing'}</button><button className="button secondary" onClick={() => ws.refresh()}>Refresh signatures</button></div></div> : null}</Modal>
  </section>
}
