import { useMemo, useState } from 'react'
import { useWorkspace } from '../data/WorkspaceProvider'
import PageHeader from '../components/PageHeader'
import Modal from '../components/Modal'
import StatusBadge from '../components/StatusBadge'
import { CONTRACT_TYPES, getContractTypeDefinition, normalizeContractType } from '../lib/contractTerms'
import { nextDocumentNumber, nextEstimateNumber } from '../lib/documentNumbers'

const blank = { service_type: 'tree_service', customer_id: '', title: '', scope: '', amount: '', status: 'draft', expires_at: '' }
const money = (value) => Number(value || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' })
const isDuplicateNumberError = (error) => error?.code === '23505' || /duplicate key|already exists|unique constraint/i.test(error?.message || '')
const isMissingServiceTypeError = (error) => /service_type.*(column|schema cache)|column.*service_type/i.test(error?.message || '')

export default function EstimatesPage() {
  const { data, customer, addAndWait, updateAndWait, removeAndWait } = useWorkspace()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(blank)
  const [busy, setBusy] = useState(false)
  const [deletingId, setDeletingId] = useState('')
  const [message, setMessage] = useState('')
  const next = useMemo(() => nextEstimateNumber(data.estimates), [data.estimates])

  function openNewEstimate() {
    setMessage('')
    setForm({ ...blank })
    setOpen(true)
  }

  function closeNewEstimate() {
    if (busy) return
    setForm({ ...blank })
    setOpen(false)
  }

  const approvalLink = (estimate) => `${window.location.origin}/estimate/${estimate.approval_token}`

  async function save(event) {
    event.preventDefault()
    setBusy(true); setMessage('')
    try {
      const baseRecord = {
        ...form,
        amount: Number(form.amount),
        scope: form.scope || form.title,
        approval_token: crypto.randomUUID(),
      }
      let candidate = next
      let saved = false
      for (let attempt = 0; attempt < 100 && !saved; attempt += 1) {
        try {
          await addAndWait('estimates', { ...baseRecord, number: candidate })
          saved = true
        } catch (error) {
          if (isMissingServiceTypeError(error) && baseRecord.service_type === 'tree_service') {
            const legacyRecord = { ...baseRecord, number: candidate }
            delete legacyRecord.service_type
            await addAndWait('estimates', legacyRecord)
            saved = true
          } else if (isMissingServiceTypeError(error)) {
            throw new Error('Install the included estimate-service update before creating junk-removal or demolition estimates.')
          } else if (isDuplicateNumberError(error)) {
            candidate = nextEstimateNumber([...data.estimates, { number: candidate }])
          } else {
            throw error
          }
        }
      }
      if (!saved) throw new Error('The next available estimate number could not be reserved. Refresh the page and try once more.')
      setForm({ ...blank }); setOpen(false)
    } catch (error) { setMessage(error.message || 'The estimate could not be saved.') }
    finally { setBusy(false) }
  }

  async function share(estimate) {
    try {
      let token = estimate.approval_token
      if (!token) {
        token = crypto.randomUUID()
        await updateAndWait('estimates', estimate.id, { approval_token: token })
      }
      const link = `${window.location.origin}/estimate/${token}`
      await navigator.clipboard.writeText(link)
      await updateAndWait('estimates', estimate.id, { status: estimate.status === 'draft' ? 'sent' : estimate.status, sent_at: new Date().toISOString() })
      setMessage('Customer estimate link copied. Paste it into a text or email.')
    } catch (error) { setMessage(error.message || 'The estimate link could not be copied.') }
  }

  async function convert(estimate) {
    const existing = data.contracts.find((item) => item.estimate_id === estimate.id)
    if (existing) return window.open(`/sign/${existing.sign_token}`, '_blank')
    const person = customer(estimate.customer_id)
    const definition = getContractTypeDefinition(estimate.service_type)
    try {
      const contract = await addAndWait('contracts', {
        contract_number: nextDocumentNumber(data.contracts, definition.numberPrefix, { field: 'contract_number', floor: definition.key === 'tree_service' ? 38 : 0 }),
        contract_type: definition.key,
        customer_id: estimate.customer_id,
        estimate_id: estimate.id,
        title: definition.defaultTitle,
        scope_of_work: estimate.scope || estimate.title,
        total_price: Number(estimate.amount || 0),
        deposit: 0,
        status: 'draft',
        service_date: '',
        sign_token: crypto.randomUUID(),
        signed_at: null,
      })
      await updateAndWait('estimates', estimate.id, { status: 'approved', approved_at: new Date().toISOString() })
      setMessage(`Contract created for ${person?.full_name || 'customer'}.`)
      window.open(`/sign/${contract.sign_token}`, '_blank')
    } catch (error) { setMessage(error.message || 'The contract could not be created.') }
  }

  async function deleteEstimate(estimate) {
    const linkedContract = data.contracts.find((item) => item.estimate_id === estimate.id)
    const contractNotice = linkedContract ? ' The signed or existing contract will be preserved.' : ''
    const confirmed = window.confirm(
      `Delete ${estimate.number}? This permanently removes the estimate and its customer approval link.${contractNotice}`,
    )
    if (!confirmed) return

    setDeletingId(estimate.id)
    setMessage('')
    try {
      await removeAndWait('estimates', estimate.id)
      setMessage(`${estimate.number} deleted.${linkedContract ? ' Its contract was preserved.' : ''}`)
    } catch (error) {
      setMessage(error.message || 'The estimate could not be deleted.')
    } finally {
      setDeletingId('')
    }
  }

  return <section>
    <PageHeader title="Estimates" description="Send professional estimates that customers can accept and sign online." action={<button className="button primary" onClick={openNewEstimate}>New estimate</button>} />
    {message ? <p className="success-banner">{message}</p> : null}
    <div className="pipeline">{['draft', 'sent', 'approved', 'declined'].map((status) => <div key={status}><span>{status}</span><strong>{data.estimates.filter((item) => item.status === status).length}</strong><small>{money(data.estimates.filter((item) => item.status === status).reduce((sum, item) => sum + Number(item.amount || 0), 0))}</small></div>)}</div>
    <div className="table-wrap"><table><thead><tr><th>Estimate</th><th>Customer</th><th>Work</th><th>Amount</th><th>Status</th><th>Expires</th><th>Actions</th></tr></thead><tbody>
      {data.estimates.map((estimate) => <tr key={estimate.id}><td><strong>{estimate.number}</strong></td><td>{customer(estimate.customer_id)?.full_name}</td><td>{estimate.title}<small>{getContractTypeDefinition(estimate.service_type).label}</small></td><td><strong>{money(estimate.amount)}</strong></td><td><StatusBadge value={estimate.status} /></td><td>{estimate.expires_at || '—'}</td><td><div className="row-actions"><button onClick={() => share(estimate)}>Copy customer link</button>{estimate.approval_token ? <button onClick={() => window.open(approvalLink(estimate), '_blank')}>Preview</button> : null}<button onClick={() => convert(estimate)}>{estimate.status === 'approved' ? 'Open contract' : 'Convert'}</button><button className="danger" disabled={deletingId === estimate.id} onClick={() => deleteEstimate(estimate)}>{deletingId === estimate.id ? 'Deleting…' : 'Delete'}</button></div></td></tr>)}
    </tbody></table></div>
    <Modal title="New estimate" open={open} onClose={closeNewEstimate}><form className="form-grid" onSubmit={save}>
      <label>Estimate number<input value={next} readOnly aria-describedby="estimate-number-help" /><small id="estimate-number-help">Automatically uses the next unused number.</small></label>
      <label>Service type<select value={form.service_type} onChange={(event) => setForm({ ...form, service_type: normalizeContractType(event.target.value) })}>{Object.values(CONTRACT_TYPES).map((type) => <option key={type.key} value={type.key}>{type.label}</option>)}</select></label>
      <label>Customer<select value={form.customer_id} onChange={(event) => setForm({ ...form, customer_id: event.target.value })} required><option value="">Select…</option>{data.customers.map((item) => <option key={item.id} value={item.id}>{item.full_name}</option>)}</select></label>
      <label className="wide">Title<input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Oak removal and stump grinding" required /></label>
      <label className="wide">Detailed scope<textarea rows="6" value={form.scope} onChange={(event) => setForm({ ...form, scope: event.target.value })} placeholder="Describe exactly what is included, cleanup, haul-off, and stump work." required /></label>
      <label>Amount<input type="number" min="0" step="0.01" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} required /></label>
      <label>Expires<input type="date" value={form.expires_at} onChange={(event) => setForm({ ...form, expires_at: event.target.value })} /></label>
      <div className="form-actions wide"><button className="button secondary" type="button" onClick={closeNewEstimate}>Cancel</button><button className="button primary" disabled={busy}>{busy ? 'Saving…' : 'Create estimate'}</button></div>
    </form></Modal>
  </section>
}
