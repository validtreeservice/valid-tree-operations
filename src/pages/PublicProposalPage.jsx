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
  useEffect(() => {
    let live = true
    const meta = document.createElement('meta'); meta.name = 'robots'; meta.content = 'noindex,nofollow'; document.head.append(meta)
    setLoading(true); setRecord(null); setError(''); setConsent(false); setSignature('')
    if (supabase) supabase.rpc('get_commercial_proposal', { p_token: token }).then(({ data, error: err }) => {
      if (!live) return
      if (err || !data) setError(err?.message || 'This proposal link is unavailable.')
      else { setRecord(data); setCompany(data.document.company_name || data.document.contact_name); setName(data.document.contact_name) }
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
      const { data, error: err } = await supabase.rpc('respond_commercial_proposal', { p_token: token, p_revision: record.revision, p_action: action, p_name: name, p_company: company, p_signature: signature, p_consent: consent, p_reason: reason })
      if (err) throw err
      setRecord(data)
    } catch (e) { setError(e.message || 'Your response was not saved. Please try again.') } finally { setBusy(false) }
  }
  return <main className="public-proposal">
    <div className="proposal-public-actions"><strong>Valid Tree Service LLC</strong>{record && <><span className={'proposal-status ' + record.status}>{record.status}</span><button className="button primary" onClick={() => { try { printProposal(record.document, record.status, record.acceptance) } catch (e) { setError(e.message) } }}>Download / Print PDF</button></>}</div>
    {loading && <p role="status">Loading proposal…</p>}
    {error && <div className="error-banner" role="alert">{error}</div>}
    {record && <>
      <ProposalDocument document={record.document} status={record.status} acceptance={record.acceptance} />
      <section className="proposal-response">
        {['sent', 'viewed'].includes(record.status) ? <form onSubmit={e => { e.preventDefault(); respond('accept') }}>
          <h2>Accept this proposal</h2><p>Review every section above. Download a copy for your records before accepting.</p>
          <fieldset disabled={busy} className="proposal-fields">
            <label>Authorized representative<input value={name} maxLength={200} minLength={2} onChange={e => setName(e.target.value)} required /></label>
            <label>Company / customer<input value={company} maxLength={300} onChange={e => setCompany(e.target.value)} required /></label>
            <label className="full-span">Type your full name as your signature<input className="proposal-typed-signature" value={signature} maxLength={200} minLength={2} onChange={e => setSignature(e.target.value)} autoComplete="off" required /></label>
            <label className="proposal-consent full-span"><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} required /><span>{ACCEPTANCE_CONSENT}</span></label>
            <div className="proposal-actions full-span"><button className="button primary" disabled={busy}>{busy ? 'Saving response…' : 'Accept & sign proposal'}</button><button type="button" className="button secondary" onClick={() => respond('decline')} disabled={busy}>Decline proposal</button></div>
          </fieldset>
        </form> : <><h2>{record.status === 'accepted' ? 'Proposal accepted' : record.status === 'expired' ? 'This proposal has expired' : 'Proposal declined'}</h2><p>{record.status === 'accepted' ? 'Your signature has been saved. Valid Tree Service will coordinate the next steps and mobilization requirements with you.' : 'Please contact Valid Tree Service if you would like to discuss an updated proposal.'}</p></>}
      </section>
    </>}
  </main>
}
