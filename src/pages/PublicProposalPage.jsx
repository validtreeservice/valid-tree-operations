import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { ACCEPTANCE_CONSENT } from '../lib/proposals'
import ProposalDocument from '../components/ProposalDocument'
import { printProposal } from '../lib/proposalPrint'

export default function PublicProposalPage() {
  const { token } = useParams()
  const [record, setRecord] = useState(null), [error, setError] = useState(''), [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false), [name, setName] = useState(''), [company, setCompany] = useState(''), [signature, setSignature] = useState(''), [consent, setConsent] = useState(false)
  const [title, setTitle] = useState(''), [email, setEmail] = useState(''), [acceptOpen, setAcceptOpen] = useState(false), [confirming, setConfirming] = useState(false)
  useEffect(() => {
    let live = true
    const meta = document.createElement('meta'); meta.name = 'robots'; meta.content = 'noindex,nofollow'; document.head.append(meta)
    setLoading(true); setRecord(null); setError(''); setConsent(false); setSignature('')
    if (supabase) supabase.rpc('get_commercial_proposal', { p_token: token }).then(({ data, error: err }) => {
      if (!live) return
      if (err || !data) setError(err?.message || 'This proposal link is unavailable.')
      else { setRecord(data); setCompany(data.document.company_name || ''); setName('') }
      setLoading(false)
    })
    else { setError('The proposal connection is unavailable. Please contact Valid Tree Service.'); setLoading(false) }
    return () => { live = false; meta.remove() }
  }, [token])
  async function respond(action) {
    let reason = ''
    if (action === 'decline') { reason = window.prompt('Optional reason for declining. Cancel to keep reviewing.', ''); if (reason == null) return }
    setBusy(true); setError('')
    try {
      const modern = record.document.document_version >= 2
      const { data, error: err } = await supabase.rpc(modern ? 'respond_commercial_proposal_v2' : 'respond_commercial_proposal', { p_token: token, p_revision: record.revision, p_action: action, p_name: name, p_company: company, p_signature: signature, p_consent: consent, p_reason: reason, ...(modern ? { p_title: title, p_email: email } : {}) })
      if (err) throw err
      setRecord(data)
    } catch (e) { setError(e.message || 'Your response was not saved. Please try again.') } finally { setBusy(false) }
  }
  return <main className="public-proposal">
    <div className="proposal-public-actions"><strong>Valid Tree Service LLC</strong>{record && <><span className={'proposal-status ' + record.status}>{record.status}</span><button className="button primary" disabled={busy} onClick={async () => { setBusy(true); try { await printProposal(record.document, record.status, record.acceptance) } catch (e) { setError(e.message) } finally { setBusy(false) } }}>Download PDF</button>{['sent','viewed'].includes(record.status) && <button className="button primary" onClick={() => { setAcceptOpen(true); requestAnimationFrame(() => document.getElementById('proposal-accept-form')?.scrollIntoView({ behavior: 'smooth' })) }}>ACCEPT PROPOSAL</button>}</>}</div>
    {loading && <p role="status">Loading proposal…</p>}
    {error && <div className="error-banner" role="alert">{error}</div>}
    {record && <>
      <ProposalDocument document={record.document} status={record.status} acceptance={record.acceptance} />
      <section className="proposal-response">
        {['sent', 'viewed'].includes(record.status) ? !acceptOpen ? <><h2>Ready to accept?</h2><p>Review the full document, including its signature page and pre-mobilization requirements.</p><button className="button primary" onClick={() => setAcceptOpen(true)}>ACCEPT PROPOSAL</button></> : <form id="proposal-accept-form" onSubmit={e => { e.preventDefault(); setConfirming(true) }}>
          <h2>ACCEPTANCE OF PROPOSAL</h2><p>{record.document.acceptance_terms}</p><p>Download a copy for your records. Your acceptance time is recorded by the server, not entered or backdated by you. Contact Valid Tree Service if you prefer a paper signature.</p>
          <fieldset disabled={busy} className="proposal-fields">
            <label>Full legal name / Authorized Representative<input value={name} maxLength={200} minLength={2} onChange={e => { setName(e.target.value); setConfirming(false) }} required /></label>
            <label>Company (if applicable)<input value={company} maxLength={300} onChange={e => { setCompany(e.target.value); setConfirming(false) }} required={record.document.document_version < 2 || Boolean(record.document.company_name)} /></label>
            {record.document.document_version >= 2 && <><label>Title (if applicable)<input value={title} maxLength={200} onChange={e => { setTitle(e.target.value); setConfirming(false) }} required={Boolean(record.document.company_name)} /></label><label>Contact email<input type="email" value={email} maxLength={300} onChange={e => { setEmail(e.target.value); setConfirming(false) }} required /></label></>}
            <label className="full-span">Type your full name as your signature<input className="proposal-typed-signature" value={signature} maxLength={200} minLength={2} onChange={e => { setSignature(e.target.value); setConfirming(false) }} autoComplete="off" required /></label>
            <label className="proposal-consent full-span"><input type="checkbox" checked={consent} onChange={e => { setConsent(e.target.checked); setConfirming(false) }} required /><span>{record.document.electronic_consent || ACCEPTANCE_CONSENT}</span></label>
            <div className="proposal-actions full-span"><button className="button primary" disabled={busy}>{busy ? 'Saving response…' : 'Review acceptance'}</button><button type="button" className="button secondary" onClick={() => respond('decline')} disabled={busy}>Decline proposal</button></div>
            {confirming && <div className="proposal-locked full-span"><h3>Confirm your acceptance</h3><p>{name} {company ? 'for ' + company : ''} will accept {record.document.number} for {Number(record.document.amount).toLocaleString('en-US', { style: 'currency', currency: 'USD' })}. The agreed document will be locked. No deposit is charged by accepting.</p><button type="button" className="button primary" disabled={busy || !consent || !signature.trim()} onClick={() => respond('accept')}>Confirm acceptance</button><button type="button" className="button secondary" onClick={() => setConfirming(false)}>Go back and correct</button></div>}
          </fieldset>
        </form> : <><h2>{record.status === 'accepted' ? 'Proposal accepted - agreed version locked' : record.status === 'expired' ? 'This proposal has expired' : 'Proposal declined'}</h2><p>{record.status === 'accepted' ? 'Download your accepted copy above. Acceptance does not collect or confirm a deposit. Valid Tree Service will coordinate the required payment and pre-mobilization documents before confirming the start date. Changes require a separately approved revision or change order.' : 'Please contact Valid Tree Service if you would like to discuss an updated proposal.'}</p></>}
      </section>
    </>}
  </main>
}
