import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useWorkspace } from '../data/WorkspaceProvider'
import { depositPolicyLabel, requiredDeposit } from '../lib/depositPolicy'

const money = (value) => Number(value || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' })

export default function PublicEstimatePage() {
  const { token } = useParams()
  const navigate = useNavigate()
  const workspace = useWorkspace()
  const [estimate, setEstimate] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [accepting, setAccepting] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      if (!supabase || String(token).startsWith('demo-')) {
        const found = workspace.data.estimates.find((item) => item.approval_token === token)
        if (!cancelled) {
          if (!found) setError('This estimate is unavailable or has expired.')
          else setEstimate({ ...found, customer: workspace.customer(found.customer_id), company: workspace.data.settings })
          setLoading(false)
        }
        return
      }
      const { data, error: rpcError } = await supabase.rpc('get_estimate_for_approval', { p_token: token })
      if (!cancelled) {
        if (rpcError || !data) setError(rpcError?.message || 'This estimate is unavailable or has expired.')
        else setEstimate(data)
        setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [token])

  async function accept() {
    setAccepting(true)
    setError('')
    try {
      if (!supabase || String(token).startsWith('demo-')) {
        let contract = workspace.data.contracts.find((item) => item.estimate_id === estimate.id)
        if (!contract) {
          const signToken = `demo-${crypto.randomUUID()}`
          contract = await workspace.addAndWait('contracts', {
            customer_id: estimate.customer_id,
            estimate_id: estimate.id,
            contract_number: `VTS-${new Date().getFullYear()}-${String(workspace.data.contracts.length + 1).padStart(4, '0')}`,
            contract_type: 'tree_service',
            title: estimate.title || 'Tree Service Agreement',
            scope_of_work: estimate.scope || 'Tree service work described in the accepted estimate.',
            total_price: Number(estimate.amount || 0), deposit: requiredDeposit(estimate.amount), status: 'sent', sign_token: signToken,
            contractor_name: 'Mark Guerrero', contractor_title: 'Owner / Authorized Representative',
            contractor_signed_at: new Date().toISOString(), sent_at: new Date().toISOString(),
          })
        }
        await workspace.updateAndWait('estimates', estimate.id, { status: 'approved', approved_at: new Date().toISOString() })
        navigate(`/sign/${contract.sign_token}`)
        return
      }
      const { data, error: rpcError } = await supabase.rpc('accept_estimate', { p_token: token })
      if (rpcError || !data?.sign_token) throw new Error(rpcError?.message || 'The estimate could not be accepted.')
      navigate(`/sign/${data.sign_token}`)
    } catch (acceptError) {
      setError(acceptError.message)
      setAccepting(false)
    }
  }

  if (loading) return <main className="public-document-page"><section className="public-document"><h1>Loading estimate…</h1></section></main>
  if (error && !estimate) return <main className="public-document-page"><section className="public-document"><h1>Estimate unavailable</h1><p>{error}</p></section></main>

  const company = estimate.company || {}
  const customer = estimate.customer || {}
  return (
    <main className="public-document-page">
      <article className="public-document">
        <header className="public-document-header">
          <img src="/valid-tree-logo.png" alt="Valid Tree Service" />
          <div><strong>{company.legal_name || company.legalName || 'Valid Tree Service LLC'}</strong><br />{company.phone || '832-445-6535'}<br />{company.website || 'validtreeservice.com'}</div>
        </header>
        <p className="eyebrow">Professional tree service estimate</p>
        <h1>{estimate.title || 'Tree Service Estimate'}</h1>
        <div className="public-document-grid">
          <section><small>Prepared for</small><strong>{customer.full_name || 'Customer'}</strong><span>{customer.service_address || ''}</span></section>
          <section><small>Estimate</small><strong>{estimate.number || ''}</strong><span>{estimate.expires_at ? `Valid through ${estimate.expires_at}` : 'Valid until withdrawn'}</span></section>
        </div>
        <h2>Scope of work</h2>
        <div className="public-scope">{String(estimate.scope || 'Tree service work as discussed.').split('\n').map((line, index) => <p key={index}>{line}</p>)}</div>
        <div className="public-price"><span>Total estimate</span><strong>{money(estimate.amount)}</strong></div>
        <div className="public-price deposit-preview"><span>{depositPolicyLabel(estimate.amount)}</span><strong>{money(requiredDeposit(estimate.amount))}</strong></div>
        {requiredDeposit(estimate.amount) > 0 ? <p className="signature-warning-box">After signing, please pay the required deposit for work to begin on your chosen scheduled day.</p> : <p className="public-help">No deposit is required for this estimate.</p>}
        <p className="public-help">Accepting this estimate creates your service agreement. You will review and sign the complete contract before selecting an available work date.</p>
        {error ? <p className="form-message error">{error}</p> : null}
        <button className="button primary wide-button" disabled={accepting} onClick={accept}>{accepting ? 'Preparing agreement…' : 'Accept estimate & review agreement'}</button>
        <p className="sunday-note">Sunday appointments require direct approval from Valid Tree Service.</p>
      </article>
    </main>
  )
}
