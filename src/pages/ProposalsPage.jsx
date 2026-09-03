import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Modal, PageHeader } from '../components/ui'
import { useWorkspace } from '../data/WorkspaceProvider'
import useProposals from '../data/useProposals'
import ProposalRichText from '../components/ProposalRichText'
import ProposalDocument from '../components/ProposalDocument'
import { printProposal } from '../lib/proposalPrint'
import { prepareProposalPhoto } from '../lib/proposalPhotos'
import { DEFAULT_CLAUSES, PROPOSAL_TYPES, PROPOSAL_STATUSES, customerSnapshot, money, moveItem, newProposal, proposalStatus, proposalTotal, uid } from '../lib/proposals'

export default function ProposalsPage() {
  const ws = useWorkspace(), api = useProposals(), navigate = useNavigate(), [params, setParams] = useSearchParams()
  const [form, setForm] = useState(null), [dirty, setDirty] = useState(false), [busy, setBusy] = useState(false)
  const [error, setError] = useState(''), [notice, setNotice] = useState(''), [filter, setFilter] = useState('all'), [search, setSearch] = useState('')
  const [chooseTemplate, setChooseTemplate] = useState(false), [template, setTemplate] = useState(PROPOSAL_TYPES[0])
  const [library, setLibrary] = useState(false), [clause, setClause] = useState(null), [preview, setPreview] = useState(null), [share, setShare] = useState(false)
  const [confirmAction, setConfirmAction] = useState(''), [sequence, setSequence] = useState('35'), [showTrash, setShowTrash] = useState(false)
  const [paymentRef, setPaymentRef] = useState(''), [approvalRef, setApprovalRef] = useState(''), [readinessChecked, setReadinessChecked] = useState(false)
  const upload = useRef(null), latestOpen = useRef(0), previewDialog = useRef(null)
  const locked = form && form.status !== 'draft'
  useEffect(() => {
    if (preview && previewDialog.current && !previewDialog.current.open) previewDialog.current.showModal()
  }, [preview])
  useEffect(() => {
    const id = params.get('id')
    if (!id) return
    const request = ++latestOpen.current
    setBusy(true)
    api.get(id).then(row => { if (request === latestOpen.current) { setForm(row); setDirty(false); setError('') } })
      .catch(e => setError(e.message)).finally(() => setBusy(false))
  }, [params.get('id')])
  useEffect(() => {
    if (!dirty) return
    function leave(e) { e.preventDefault(); e.returnValue = '' }
    function link(e) {
      const anchor = e.target.closest('a[href]')
      if (anchor && !anchor.hash && anchor.pathname !== location.pathname && !window.confirm('Leave this proposal without saving your latest changes?')) { e.preventDefault(); e.stopPropagation() }
    }
    window.addEventListener('beforeunload', leave); document.addEventListener('click', link, true)
    return () => { window.removeEventListener('beforeunload', leave); document.removeEventListener('click', link, true) }
  }, [dirty])
  function edit(patch) { setForm(f => ({ ...f, ...patch })); setDirty(true); setNotice('') }
  function content(patch) { setForm(f => ({ ...f, content: { ...f.content, ...patch } })); setDirty(true); setNotice('') }
  function sectionChange(index, patch) { content({ sections: form.content.sections.map((s, i) => i === index ? { ...s, ...patch } : s) }) }
  async function run(action) {
    if (busy) return
    setBusy(true); setError(''); setNotice('')
    try { await action() } catch (e) { setError(e.message || 'The action could not be completed.') } finally { setBusy(false) }
  }
  async function save() {
    const saved = await api.save(form)
    setForm(saved); setDirty(false); setNotice(api.isDemo ? 'Saved in demo mode on this device only.' : 'Draft saved.')
    return saved
  }
  function start(sixAcres = false) {
    if (dirty && !window.confirm('Discard unsaved changes and start another proposal?')) return
    setParams({}); setForm(newProposal(sixAcres ? PROPOSAL_TYPES[0] : template, sixAcres)); setDirty(false)
    setChooseTemplate(false); setError(''); setNotice('')
  }
  function back() {
    if (busy || dirty && !window.confirm('Discard unsaved changes and return to proposals?')) return
    ++latestOpen.current; setForm(null); setDirty(false); setParams({}); setError(''); setNotice('')
  }
  async function showPreview(print = false) {
    try {
      const doc = form.published_snapshot || customerSnapshot(form, ws.data.settings)
      if (print) { await printProposal(doc, form.status, form.acceptance); setNotice('PDF downloaded. Check your browser downloads. No proposal was sent.') }
      else setPreview({ document: doc, status: form.status, acceptance: form.acceptance })
    } catch (e) { setError(e.message) }
  }
  async function send() {
    if (api.isDemo) { setNotice('Demo mode cannot create a customer link. Sign in to your live workspace to send.'); return }
    // Save and issue sequentially. Failed publication retains the saved draft.
    const saved = await save(), issued = await api.publish(saved, ws.data.settings)
    setForm(issued); setDirty(false); setShare(true); setNotice('Customer link created. Copy it or open the email draft below to deliver it.')
  }
  function duplicate() {
    const fresh = newProposal(form.proposal_type)
    setParams({}); setForm({ ...fresh, customer_id: form.customer_id, project_name: form.project_name + ' - revised',
      project_address: form.project_address, contact_name: form.contact_name, company_name: form.company_name,
      internal_notes: form.internal_notes, content: { ...structuredClone(form.content), description: 'Proposed revision to ' + form.number + '. This separate offer does not alter the original accepted agreement unless the parties expressly approve the stated changes in writing.\n\n' + form.content.description } })
    setDirty(true); setNotice('Separate revision draft created. The original acceptance and job remain unchanged; reconcile approved changes through a written change order.')
  }
  async function photos(files) {
    if (form.content.photos.length + files.length > 16) throw new Error('A proposal can contain up to 16 site photos.')
    const added = []
    for (const file of files) added.push(await prepareProposalPhoto(file))
    content({ photos: [...form.content.photos, ...added] })
  }
  const visible = api.rows.filter(row => Boolean(row.deleted_at) === showTrash && (filter === 'all' || proposalStatus(row) === filter) && [row.number, row.project_name, row.company_name, row.contact_name, row.project_address].join(' ').toLowerCase().includes(search.toLowerCase()))
  const allClauses = [...api.clauses, ...DEFAULT_CLAUSES]
  const field = (label, key, options = {}) => <label className={options.wide ? 'full-span' : ''}>{label}<input type={options.type || 'text'} maxLength={options.max || 300} value={form[key] || ''} onChange={e => edit({ [key]: e.target.value })} /></label>
  const contentField = (label, key, multiline = false) => <label className={multiline ? 'full-span' : ''}>{label}{multiline
    ? <textarea rows={4} maxLength={16000} value={form.content[key] || ''} onChange={e => content({ [key]: e.target.value })} />
    : <input maxLength={500} value={form.content[key] || ''} onChange={e => content({ [key]: e.target.value })} />}</label>
  let total = 0
  try { total = form ? proposalTotal(form.content) : 0 } catch { /* price validation appears on save/preview */ }
  const shareUrl = form?.share_token ? window.location.origin + '/proposal/' + form.share_token : ''
  return <section className="proposals-workspace">
    <PageHeader title={form ? form.number || 'New commercial proposal' : 'Commercial proposals'}
      description={form ? 'Scope, site conditions and commercial terms.' : 'Keep larger bids separate from residential estimates.'}
      action={!form && <div className="proposal-actions"><button className="button secondary" onClick={() => { setClause(null); setLibrary(true) }}>Saved clauses</button><button className="button primary" onClick={() => setChooseTemplate(true)}>+ New Proposal</button></div>} />
    {(error || api.error) && <div role="alert" className="error-banner">{error || api.error}</div>}
    {notice && <p role="status" className="success-banner">{notice}</p>}
    {api.isDemo && <p className="proposal-helper">Demo workspace: records stay on this device; customer delivery, acceptance and job conversion require live sign-in.</p>}
    {!form ? <>
      <div className="proposal-dashboard-toolbar">
        <label>Search proposals<input value={search} onChange={e => setSearch(e.target.value)} placeholder="Number, company, project or address" /></label>
        <label>Status<select value={filter} onChange={e => setFilter(e.target.value)}><option value="all">All statuses</option>{PROPOSAL_STATUSES.map(s => <option key={s}>{s}</option>)}</select></label>
        <button className="button secondary" disabled={api.loading} onClick={api.refresh}>Refresh</button>
        <button className="button secondary" onClick={() => setShowTrash(!showTrash)}>{showTrash ? 'Active proposals' : 'Trash / restore'}</button>
      </div>
      {api.loading ? <p role="status">Loading proposals…</p> : <div className="proposal-table-scroll"><table className="proposal-table"><thead><tr><th>Proposal / project</th><th>Customer / company</th><th>Address</th><th>Amount</th><th>Created</th><th>Expires</th><th>Status</th></tr></thead><tbody>
        {visible.map(row => <tr key={row.id}><td><button className="proposal-open" onClick={() => setParams({ id: row.id })}>{row.number}</button><span>{row.project_name}</span></td><td>{row.company_name || row.contact_name}<span>{row.company_name ? row.contact_name : ''}</span></td><td>{row.project_address || 'Not entered'}</td><td>{money(row.amount)}</td><td>{row.created_at?.slice(0, 10)}</td><td>{row.expires_at}</td><td><span className={'proposal-status ' + proposalStatus(row)}>{proposalStatus(row)}</span></td></tr>)}
      </tbody></table>{!visible.length && <div className="empty-state">{api.error ? 'Proposals will appear here once the connection is ready.' : search || filter !== 'all' ? 'No matching proposals.' : 'No commercial proposals yet. Start with a template or a blank proposal.'}</div>}</div>}
      <p className="proposal-helper">“Sent” means a customer link has been issued; use Copy Link or the email draft to deliver it. “Viewed” records link access and can include email previews.</p>
    </> : <>
      <div className="proposal-editor-actions"><div><button className="button secondary" onClick={back} disabled={busy}>← All proposals</button><span className={'proposal-status ' + proposalStatus(form)}>{proposalStatus(form)}</span>{dirty && <span>Unsaved changes</span>}</div>
        <div className="proposal-actions"><button className="button secondary" disabled={busy} onClick={() => showPreview()}>Preview</button><button className="button secondary" disabled={busy} onClick={() => showPreview(true)}>Generate PDF</button>
          {!locked && !form.deleted_at ? <><button className="button secondary" disabled={busy} onClick={() => run(save)}>Save Draft</button><button className="button primary" disabled={busy} onClick={() => setConfirmAction('send')}>Send Proposal</button>{form.number && <><button className="button secondary" disabled={busy || dirty} onClick={() => setConfirmAction('number')}>Proposal number</button><button className="button secondary" disabled={busy} onClick={() => setConfirmAction('delete')}>Delete draft</button></>}</> : !form.deleted_at && <><button className="button secondary" disabled={busy} onClick={duplicate}>Create revision</button>{form.share_token && <button className="button primary" onClick={() => setShare(true)}>Customer link</button>}</>}
        </div>
      </div>
      {form.deleted_at && <div className="proposal-locked"><h2>Draft in Trash</h2><p>The original draft is preserved and its number will not be reused.</p><button className="button primary" disabled={busy} onClick={() => run(async () => { setForm(await api.trash(form, true)); setNotice('Draft restored.'); setShowTrash(false) })}>Restore draft</button></div>}
      <p className="proposal-helper">Draft → Sent (link issued) → Viewed → Accepted → Deposit / pre-mobilization review → Ready to schedule. Signatures appear on the dedicated acceptance page in Preview and the PDF. Electronic acceptance is available on the issued customer link.</p>
      {locked && <div className="proposal-locked"><strong>{form.status === 'accepted' ? 'Accepted proposal - document locked' : 'Issued proposal - document locked'}</strong><p>{form.status === 'accepted' ? 'The signed version is preserved. Duplicate it to prepare a different offer.' : 'To make changes, withdraw this version. Its existing customer link will stop working.'}</p>
        <div className="proposal-actions">{form.status !== 'accepted' && <button className="button secondary" disabled={busy} onClick={() => run(async () => {
          if (!window.confirm('Withdraw this proposal and disable its existing customer link?')) return
          const row = await api.reopen(form); setForm(row); setDirty(false); setNotice('Link withdrawn. Edit the draft and issue a new link when ready.')
        })}>Withdraw & edit draft</button>}
        {form.status === 'accepted' && !form.readiness_cleared_at && <button className="button primary" disabled={busy || api.isDemo} onClick={() => setConfirmAction('ready')}>Review deposit & pre-mobilization</button>}
        {form.status === 'accepted' && form.readiness_cleared_at && <button className="button primary" disabled={busy || api.isDemo} onClick={() => run(async () => {
          await api.convert(form.id); await ws.refresh(); setDirty(false); navigate('/jobs'); 
        })}>Ready to schedule / create job</button>}</div>
        {form.status === 'accepted' && <p>{form.readiness_cleared_at ? 'Office manually verified pre-mobilization requirements on ' + new Date(form.readiness_cleared_at).toLocaleString() + '. This is not an automatic bank or payment-processor confirmation.' : 'Acceptance is recorded. Payment and required approvals have NOT been marked confirmed. No deposit is collected automatically.'}</p>}
        {form.acceptance && <p>Accepted by {form.acceptance.name} for {form.acceptance.company} on {new Date(form.acceptance.signed_at).toLocaleString()}.</p>}
        {form.decline_reason && <p>Customer feedback: {form.decline_reason}</p>}
      </div>}
      <fieldset disabled={busy || locked || Boolean(form.deleted_at)} className="proposal-builder">
        <section className="panel"><h2>Project & customer</h2><div className="proposal-fields">
          <label className="full-span">Existing customer<select value={form.customer_id || ''} onChange={e => {
            const customer = ws.customer(e.target.value)
            edit(customer ? { customer_id: customer.id, contact_name: customer.full_name, project_address: customer.service_address || '', content: { ...form.content, phone: customer.phone || '', email: customer.email || '' } } : { customer_id: '' })
          }}><option value="">New contact / not linked yet</option>{ws.data.customers.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}</select><small>A new contact is added to Customers when the accepted proposal becomes a job.</small></label>
          {field('Project name', 'project_name')}{field('Project address', 'project_address', { max: 1000 })}
          {field('Contact name', 'contact_name')}{field('Company name', 'company_name')}
          {contentField('Phone', 'phone')}{contentField('Email', 'email')}
          {field('Proposal date', 'proposal_date', { type: 'date' })}{field('Expiration date', 'expires_at', { type: 'date' })}
          <label className="full-span">Proposal type<select value={form.proposal_type} onChange={e => edit({ proposal_type: e.target.value })}>{PROPOSAL_TYPES.map(t => <option key={t}>{t}</option>)}</select><small>Changing the type keeps your current sections.</small></label>
          {contentField('Project description', 'description', true)}
        </div></section>
        <section className="panel"><div className="proposal-panel-heading"><h2>Scope sections</h2><button type="button" className="button secondary" onClick={() => { setClause(null); setLibrary(true) }}>Insert saved clause</button></div>
          <p className="proposal-helper">Select text and use the formatting buttons. Move sections into the exact order you want in the proposal.</p>
          {form.content.sections.map((s, index) => <div className="proposal-section-editor" key={s.id}>
            <div className="proposal-panel-heading"><strong>Section {String(index + 1).padStart(2, '0')}</strong><div className="proposal-actions">
              <button type="button" aria-label={'Move section ' + (index + 1) + ' up'} disabled={!index} onClick={() => content({ sections: moveItem(form.content.sections, index, -1) })}>↑</button>
              <button type="button" aria-label={'Move section ' + (index + 1) + ' down'} disabled={index === form.content.sections.length - 1} onClick={() => content({ sections: moveItem(form.content.sections, index, 1) })}>↓</button>
              <button type="button" onClick={() => { if (window.confirm('Remove this section from the proposal?')) content({ sections: form.content.sections.filter((_, i) => i !== index) }) }}>Remove</button>
              <button type="button" onClick={() => { setClause({ title: s.title, body: s.body }); setLibrary(true) }}>Save as clause</button>
            </div></div>
            <label>Section title<input maxLength={200} value={s.title} onChange={e => sectionChange(index, { title: e.target.value })} /></label>
            <ProposalRichText label="Description" value={s.body} onChange={body => sectionChange(index, { body })} />
          </div>)}
          <button type="button" className="button secondary" disabled={form.content.sections.length >= 60} onClick={() => content({ sections: [...form.content.sections, { id: uid(), title: '', body: '' }] })}>+ Add Section</button>
        </section>
        <section className="panel"><h2>Customer-facing pricing</h2><p className="proposal-helper">Enter your selling price only. Internal costs and margins do not belong in these fields.</p>
          <label>Pricing format<select value={form.content.pricing_mode} onChange={e => content({ pricing_mode: e.target.value })}><option value="lump_sum">Lump sum</option><option value="itemized">Itemized</option></select></label>
          {form.content.pricing_mode === 'lump_sum' ? <label>Total proposed contract value ($)<input type="number" min="0" max="999999999" step=".01" value={form.content.lump_sum} onChange={e => content({ lump_sum: e.target.value })} /></label>
            : <>{form.content.lines.map((line, i) => <div className="proposal-price-editor" key={line.id}>
              <label>Description<input value={line.label} maxLength={300} onChange={e => content({ lines: form.content.lines.map((l, j) => i === j ? { ...l, label: e.target.value } : l) })} /></label>
              <label>Amount ($)<input type="number" min="0" step=".01" disabled={line.included} value={line.amount} onChange={e => content({ lines: form.content.lines.map((l, j) => i === j ? { ...l, amount: e.target.value } : l) })} /></label>
              <label className="proposal-check"><input type="checkbox" checked={line.included} onChange={e => content({ lines: form.content.lines.map((l, j) => i === j ? { ...l, included: e.target.checked } : l) })} />Included</label>
              <button type="button" className="button secondary" onClick={() => content({ lines: form.content.lines.filter((_, j) => j !== i) })}>Remove</button>
            </div>)}<button type="button" className="button secondary" disabled={form.content.lines.length >= 100} onClick={() => content({ lines: [...form.content.lines, { id: uid(), label: '', amount: '', included: false }] })}>+ Add pricing line</button></>}
          <p className="proposal-editor-total">Total proposed contract value <strong>{money(total)}</strong></p>
        </section>
        <section className="panel"><h2>Schedule & payment terms</h2><div className="proposal-fields">
          {contentField('Anticipated duration', 'duration')}{contentField('Proposed / estimated start', 'estimated_start')}
          {contentField('Mobilization requirements', 'mobilization', true)}{contentField('Payment terms', 'payment_terms', true)}
          {contentField('Progress / milestone payments', 'milestones', true)}{contentField('Special project conditions', 'special_conditions', true)}
        </div></section>
        <section className="panel"><h2>Existing site conditions</h2><p className="proposal-helper">Add up to 16 JPG, PNG or WebP photos. The first photo also appears on the cover. Photos are optimized for the document and saved with the proposal.</p>
          <input ref={upload} type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={e => { const files = Array.from(e.target.files || []); e.target.value = ''; if (files.length) run(() => photos(files)) }} />
          <div className="proposal-photo-editors">{form.content.photos.map((photo, i) => <figure key={photo.id}><img src={photo.data} alt={'Site photo ' + (i + 1)} /><label>Caption<textarea rows={2} maxLength={1000} value={photo.caption} onChange={e => content({ photos: form.content.photos.map((p, j) => j === i ? { ...p, caption: e.target.value } : p) })} /></label><div className="proposal-actions"><button type="button" disabled={!i} onClick={() => content({ photos: moveItem(form.content.photos, i, -1) })}>Move earlier</button><button type="button" onClick={() => { if (window.confirm('Remove this photo from the proposal?')) content({ photos: form.content.photos.filter((_, j) => j !== i) }) }}>Remove photo</button></div></figure>)}</div>
        </section>
        <section className="panel"><h2>Internal office notes</h2><p className="proposal-helper">Never included in the customer link or PDF. These notes transfer to the internal job brief.</p><textarea rows={4} maxLength={20000} value={form.internal_notes} onChange={e => edit({ internal_notes: e.target.value })} /></section>
      </fieldset>
      {!locked && !form.deleted_at && <div className="proposal-bottom-save"><button className="button primary" disabled={busy} onClick={() => run(save)}>{busy ? 'Working…' : 'Save Draft'}</button><p className="proposal-helper">Generate PDF downloads a complete PDF, including the signature page. Review it before issuing a customer link.</p></div>}
    </>}
    <Modal title="Start a commercial proposal" open={chooseTemplate} onClose={() => setChooseTemplate(false)}>
      <div className="proposal-template-pick"><h3>Your six-acre clearing bid</h3><p>Pre-filled sections for the preliminary tree count, large timber, excavator work, building and roadway demolition, and full haul-off. Customer details and pricing remain blank.</p><button className="button primary" onClick={() => start(true)}>Use six-acre project template</button></div>
      <label>Or choose another starting point<select value={template} onChange={e => setTemplate(e.target.value)}>{PROPOSAL_TYPES.map(t => <option key={t}>{t}</option>)}</select></label><button className="button secondary" onClick={() => start(false)}>Create proposal</button>
    </Modal>
    <Modal title="Saved commercial clauses" open={library} onClose={() => !busy && setLibrary(false)}>
      <p className="proposal-helper">Starting language is editable, not legal advice. Review project-specific obligations with qualified counsel before issue.</p>
      {clause ? <div className="proposal-clause-edit"><label>Clause title<input maxLength={200} value={clause.title} onChange={e => setClause({ ...clause, title: e.target.value })} /></label><ProposalRichText label="Clause wording" value={clause.body} onChange={body => setClause({ ...clause, body })} /><div className="proposal-actions"><button className="button primary" disabled={busy} onClick={() => run(async () => { await api.saveClause(clause); setClause(null); setNotice('Clause saved to your library.') })}>Save clause</button><button className="button secondary" onClick={() => setClause(null)}>Back to library</button></div></div>
        : <><button className="button secondary" onClick={() => setClause({ title: '', body: '' })}>+ New clause</button>{allClauses.map(c => <div className="proposal-clause-row" key={c.id}><strong>{c.title}</strong><span>{c.standard ? 'Starting language' : 'Your saved clause'}</span><p>{c.body}</p><div className="proposal-actions">
          {form && !locked && <button className="button primary" disabled={busy || form.content.sections.length >= 60} onClick={() => { content({ sections: [...form.content.sections, { id: uid(), title: c.title, body: c.body }] }); setLibrary(false) }}>Insert as section</button>}
          <button className="button secondary" onClick={() => setClause({ ...c })}>{c.standard ? 'Customize & save' : 'Edit'}</button>
          {!c.standard && <button className="button secondary" disabled={busy} onClick={() => run(async () => { if (window.confirm('Delete this saved clause? Existing proposals keep their wording.')) await api.deleteClause(c.id) })}>Delete</button>}
        </div></div>)}</>}
      {error && <p role="alert" className="error-banner">{error}</p>}
    </Modal>
    <Modal title="Confirm proposal action" open={Boolean(confirmAction)} onClose={() => !busy && setConfirmAction('')}>
      {confirmAction === 'send' && <><h3>Issue {form?.number || 'this draft'}?</h3><p>This saves your current work, locks the issued version and creates a customer link with electronic acceptance. It does not email or text anyone. Review the complete PDF first.</p><button className="button primary" disabled={busy} onClick={() => run(async () => { await send(); setConfirmAction('') })}>Create customer link</button></>}
      {confirmAction === 'delete' && <><p>Move {form?.number} to Trash? You can restore it from Trash / restore. Accepted proposals cannot be deleted.</p><button className="button primary" disabled={busy} onClick={() => run(async () => { await api.trash(form); setConfirmAction(''); ++latestOpen.current; setForm(null); setDirty(false); setParams({}); setNotice('Draft moved to Trash. You can restore it at any time.') })}>Move draft to Trash</button></>}
      {confirmAction === 'number' && <><p>Change this saved draft’s sequence number in its existing year. Numbers must be unique. Future numbers continue above the highest reserved number; each new year starts at 0001. This does not create earlier proposals.</p><label>Sequence number<input type="number" min="1" max="999999" value={sequence} onChange={e => setSequence(e.target.value)} /></label><button className="button primary" disabled={busy} onClick={() => run(async () => { setForm(await api.renumber(form, sequence)); setConfirmAction(''); setNotice('Draft number updated; numbering history recorded.') })}>Update draft number</button></>}
      {confirmAction === 'ready' && <><h3>Manual office verification</h3><p>No payment is processed here. Check the actual payment records and all requirements in the accepted proposal, including any separate contract, utility disconnections and asbestos/environmental clearance. Do not clear this step merely because the customer signed.</p><label>Deposit/payment receipt or reference (or documented no-deposit requirement)<textarea value={paymentRef} onChange={e => setPaymentRef(e.target.value)} maxLength={2000} /></label><label>Required approvals / clearance documents and contract reference<textarea value={approvalRef} onChange={e => setApprovalRef(e.target.value)} maxLength={4000} /></label><label className="proposal-consent"><input type="checkbox" checked={readinessChecked} onChange={e => setReadinessChecked(e.target.checked)} />I personally verified the payment and required pre-mobilization documents.</label><button className="button primary" disabled={busy || !readinessChecked || paymentRef.trim().length < 5 || approvalRef.trim().length < 5} onClick={() => run(async () => { setForm(await api.clearReadiness(form, paymentRef, approvalRef)); setConfirmAction(''); setNotice('Manual office verification recorded. No funds were collected by this action.') })}>Record manual verification</button></>}
      {error && <p role="alert" className="error-banner">{error}</p>}
    </Modal>
    <Modal title="Deliver proposal" open={share} onClose={() => setShare(false)}>
      <p>The customer sees only the issued document. They can download a PDF and accept electronically.</p><p>No email has been sent automatically.</p>
      <label>Customer link<input readOnly value={shareUrl} onFocus={e => e.target.select()} /></label>
      {!form?.content.email && <p>No customer email is saved. Copy the link to deliver it yourself, or withdraw and add an email before reissuing.</p>}
      <div className="proposal-actions"><button className="button primary" onClick={() => run(async () => { await navigator.clipboard.writeText(shareUrl); setNotice('Customer link copied.'); })}>Copy link</button>
        {form?.content.email && <a className="button secondary" href={'mailto:' + encodeURIComponent(form.content.email) + '?subject=' + encodeURIComponent('Proposal ' + form.number + ' - ' + form.project_name) + '&body=' + encodeURIComponent('Hello ' + form.contact_name + ',\n\nPlease review your Valid Tree Service proposal here:\n' + shareUrl + '\n\nYou can download a PDF and accept electronically using the link. Please contact us with any questions.\n\nValid Tree Service LLC\n' + ws.data.settings.phone)}>Open email draft</a>}
      </div>{notice && <p role="status">{notice}</p>}{error && <p role="alert">{error}</p>}
    </Modal>
    {preview && <dialog ref={previewDialog} className="proposal-preview-overlay" aria-label="Proposal preview" onCancel={() => setPreview(null)}><div className="proposal-preview-toolbar"><strong>Customer-facing preview</strong><div className="proposal-actions"><button className="button primary" disabled={busy} onClick={() => run(() => printProposal(preview.document, preview.status, preview.acceptance))}>Generate PDF</button><button className="button secondary" autoFocus onClick={() => setPreview(null)}>Close preview</button></div></div>{error && <p role="alert">{error}</p>}<ProposalDocument {...preview} /><p className="proposal-response">Preview only. The customer’s ACCEPT PROPOSAL button appears on the issued link; previewing never accepts or sends this proposal.</p></dialog>}
  </section>
}
