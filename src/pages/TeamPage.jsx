import { useState } from 'react'
import { useWorkspace } from '../data/WorkspaceProvider'
import PageHeader from '../components/PageHeader'
import Modal from '../components/Modal'
import { ErrorBanner, Field } from '../components/OperationsUI'

const blankCrew = { name: '', foreman: '', phone: '', color: '#80a84c' }
const blankStaff = { email: '', fullName: '', role: 'office' }

export default function TeamPage() {
  const ws = useWorkspace()
  const [open, setOpen] = useState(false)
  const [crewForm, setCrewForm] = useState(blankCrew)
  const [staff, setStaff] = useState(blankStaff)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  function saveCrew(event) { event.preventDefault(); ws.add('crews', crewForm); setOpen(false); setCrewForm(blankCrew) }
  async function linkStaff(event) {
    event.preventDefault(); setBusy(true); setMessage('')
    try {
      await ws.linkStaff({ email: staff.email, role: staff.role, fullName: staff.fullName })
      setMessage(`Access connected for ${staff.email}. Have them sign out and sign back in.`); setStaff(blankStaff)
    } catch (error) { setMessage(error.message) }
    finally { setBusy(false) }
  }

  return <section><PageHeader title="Team & crews" description="Connect staff to this company workspace and organize field crews." action={<button className="button primary" onClick={() => setOpen(true)}>Add crew</button>} />
    <ErrorBanner message={message && !message.startsWith('Access connected') ? message : ''} />
    {message.startsWith('Access connected') ? <p className="success-banner">{message}</p> : null}
    <div className="module-grid team-access-grid">
      <article className="panel"><p className="eyebrow">STAFF ACCESS</p><h2>Connect an existing login</h2><p>The person must already exist under Supabase Authentication. Enter the same email here to connect that login to Valid Tree Service’s records.</p><form className="form-grid" onSubmit={linkStaff}><Field label="Login email" className="wide"><input required type="email" value={staff.email} onChange={(e) => setStaff({ ...staff, email: e.target.value })} /></Field><Field label="Name"><input value={staff.fullName} onChange={(e) => setStaff({ ...staff, fullName: e.target.value })} /></Field><Field label="Access level"><select value={staff.role} onChange={(e) => setStaff({ ...staff, role: e.target.value })}><option value="office">Office — manage business records</option><option value="foreman">Foreman — jobs and field work</option><option value="crew">Crew — limited field access</option></select></Field><button className="button primary wide" disabled={busy}>{busy ? 'Connecting…' : 'Connect staff account'}</button></form></article>
      <article className="panel permissions"><div><p className="eyebrow">ROLE-BASED ACCESS</p><h2>Keep the right information in the right hands</h2><p>For your girl, choose <strong>Office</strong>. She will share your customers, estimates, contracts, jobs, invoices and expenses instead of receiving an empty workspace.</p></div><div className="role-list"><span><b>Owner</b>Everything</span><span><b>Office</b>CRM + paperwork + expenses</span><span><b>Foreman</b>Jobs + field work</span><span><b>Crew</b>Limited field access</span></div></article>
    </div>
    <div className="crew-grid">{ws.data.crews.map((crew) => <article key={crew.id}><div className="crew-color" style={{ background: crew.color }} /><div className="crew-avatar">{crew.name.split(' ').map((part) => part[0]).join('').slice(0, 2)}</div><h2>{crew.name}</h2><p>Foreman: <strong>{crew.foreman}</strong></p><span>{crew.phone || 'No phone assigned'}</span><div className="crew-load"><strong>{ws.data.jobs.filter((job) => job.crew_id === crew.id && job.status !== 'completed').length}</strong><span>upcoming jobs</span></div><button className="button secondary" onClick={() => { const name = prompt('Foreman name', crew.foreman); if (name !== null) ws.update('crews', crew.id, { foreman: name }) }}>Edit foreman</button></article>)}</div>
    <Modal title="Add crew" open={open} onClose={() => setOpen(false)}><form className="form-grid" onSubmit={saveCrew}><label>Crew name<input value={crewForm.name} onChange={(e) => setCrewForm({ ...crewForm, name: e.target.value })} required /></label><label>Foreman<input value={crewForm.foreman} onChange={(e) => setCrewForm({ ...crewForm, foreman: e.target.value })} /></label><label>Phone<input value={crewForm.phone} onChange={(e) => setCrewForm({ ...crewForm, phone: e.target.value })} /></label><label>Schedule color<input type="color" value={crewForm.color} onChange={(e) => setCrewForm({ ...crewForm, color: e.target.value })} /></label><div className="form-actions wide"><button type="button" className="button secondary" onClick={() => setOpen(false)}>Cancel</button><button className="button primary">Add crew</button></div></form></Modal>
  </section>
}
