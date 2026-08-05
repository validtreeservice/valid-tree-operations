import { useMemo, useState } from 'react'
import { Modal, PageHeader, StatusBadge } from '../components/ui'
import { useWorkspace } from '../data/WorkspaceProvider'

const blank = {
  customer_id: '',
  title: '',
  crew_id: '',
  date: '',
  start_time: '07:30',
  status: 'scheduled',
  address: '',
  foreman_notes: '',
  equipment: '',
}

function nextJobNumber(jobs) {
  const year = new Date().getFullYear()
  const highest = jobs.reduce((current, job) => {
    const match = String(job.number || '').match(/^JOB-\d{4}-(\d+)$/)
    return match ? Math.max(current, Number(match[1])) : current
  }, 89)

  return `JOB-${year}-${String(highest + 1).padStart(4, '0')}`
}

export default function JobsPage() {
  const ws = useWorkspace()
  const { data, customer, crew, updateAndWait } = ws
  const [open, setOpen] = useState(false)
  const [selectedId, setSelectedId] = useState(null)
  const [form, setForm] = useState(blank)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  const selected = useMemo(
    () => data.jobs.find((job) => job.id === selectedId) || null,
    [data.jobs, selectedId],
  )

  function openScheduler() {
    setForm(blank)
    setFormError('')
    setOpen(true)
  }

  async function save(event) {
    event.preventDefault()
    setFormError('')

    if (!form.customer_id || !form.title.trim() || !form.date) {
      setFormError('Choose a customer, enter a job title, and select the work date.')
      return
    }

    setSaving(true)
    try {
      const record = await ws.addAndWait('jobs', {
        ...form,
        title: form.title.trim(),
        crew_id: form.crew_id || null,
        start_time: form.start_time || null,
        address: form.address.trim(),
        foreman_notes: form.foreman_notes.trim(),
        equipment: form.equipment.trim(),
        number: nextJobNumber(data.jobs),
        completion_notes: '',
      })

      setOpen(false)
      setForm(blank)
      setSelectedId(record.id)
    } catch (error) {
      setFormError(error?.message || 'The job could not be scheduled. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  async function changeStatus(status) {
    if (!selected) return
    try {
      await updateAndWait('jobs', selected.id, { status })
    } catch (error) {
      window.alert(error?.message || 'The job status could not be updated.')
    }
  }

  return (
    <section>
      <PageHeader
        title="Jobs"
        description="Turn sold work into a clean field handoff with crew, equipment, notes, and completion proof."
        action={<button className="button primary" onClick={openScheduler}>Schedule job</button>}
      />

      <div className="board">
        {['scheduled', 'in progress', 'completed'].map((status) => (
          <div className="board-column" key={status}>
            <div className="board-title">
              <span>{status}</span>
              <b>{data.jobs.filter((job) => job.status === status).length}</b>
            </div>
            {data.jobs.filter((job) => job.status === status).map((job) => (
              <article className="job-card" key={job.id} onClick={() => setSelectedId(job.id)}>
                <div className="job-card-date">
                  <strong>{job.date ? new Date(`${job.date}T12:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'No date'}</strong>
                  <span>{job.start_time || 'Time TBD'}</span>
                </div>
                <h3>{job.title}</h3>
                <p>{customer(job.customer_id)?.full_name || 'Customer unavailable'}</p>
                <small>{job.address}</small>
                <div>
                  <span className="crew-pill">{crew(job.crew_id)?.name || 'Unassigned'}</span>
                  <StatusBadge value={job.status} />
                </div>
              </article>
            ))}
          </div>
        ))}
      </div>

      <Modal title="Schedule job" open={open} onClose={() => !saving && setOpen(false)}>
        <form className="form-grid" onSubmit={save}>
          {formError ? <p className="form-message error wide" role="alert">{formError}</p> : null}
          <label>
            Customer
            <select
              value={form.customer_id}
              onChange={(event) => {
                const chosen = customer(event.target.value)
                setForm({ ...form, customer_id: event.target.value, address: chosen?.service_address || '' })
              }}
              required
            >
              <option value="">Select…</option>
              {data.customers.map((item) => <option value={item.id} key={item.id}>{item.full_name}</option>)}
            </select>
          </label>
          <label>
            Crew
            <select value={form.crew_id} onChange={(event) => setForm({ ...form, crew_id: event.target.value })}>
              <option value="">Unassigned</option>
              {data.crews.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}
            </select>
          </label>
          <label className="wide">Job title<input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required /></label>
          <label>Date<input type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} required /></label>
          <label>Start time<input type="time" value={form.start_time} onChange={(event) => setForm({ ...form, start_time: event.target.value })} /></label>
          <label className="wide">Address<input value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} /></label>
          <label className="wide">Foreman notes<textarea rows="4" value={form.foreman_notes} onChange={(event) => setForm({ ...form, foreman_notes: event.target.value })} /></label>
          <label className="wide">Equipment<input value={form.equipment} onChange={(event) => setForm({ ...form, equipment: event.target.value })} /></label>
          <div className="form-actions wide">
            <button type="button" className="button secondary" disabled={saving} onClick={() => setOpen(false)}>Cancel</button>
            <button className="button primary" disabled={saving}>{saving ? 'Scheduling…' : 'Schedule job'}</button>
          </div>
        </form>
      </Modal>

      <Modal title={selected?.number || 'Job'} open={Boolean(selected)} onClose={() => setSelectedId(null)}>
        {selected ? (
          <div className="job-detail">
            <div className="detail-hero">
              <div><p className="eyebrow">{selected.number}</p><h2>{selected.title}</h2><p>{customer(selected.customer_id)?.full_name}</p></div>
              <StatusBadge value={selected.status} />
            </div>
            <div className="detail-grid">
              <div><span>Date & time</span><strong>{selected.date || 'Not scheduled'} at {selected.start_time || 'Time TBD'}</strong></div>
              <div><span>Crew</span><strong>{crew(selected.crew_id)?.name || 'Unassigned'}</strong></div>
              <div><span>Address</span><strong>{selected.address || 'Not provided'}</strong></div>
              <div><span>Equipment</span><strong>{selected.equipment || 'Not specified'}</strong></div>
            </div>
            <div className="scope-preview"><span>Foreman brief</span><p>{selected.foreman_notes || 'No notes.'}</p></div>
            <label>
              Status
              <select value={selected.status} onChange={(event) => changeStatus(event.target.value)}>
                <option>scheduled</option><option>in progress</option><option>completed</option><option>cancelled</option>
              </select>
            </label>
            <label>Completion notes<textarea rows="4" defaultValue={selected.completion_notes} onBlur={(event) => updateAndWait('jobs', selected.id, { completion_notes: event.target.value }).catch(() => window.alert('Completion notes could not be saved.'))} /></label>
            <div className="form-actions">
              <button className="button secondary" onClick={() => window.open(`/tablet?job=${selected.id}`, '_blank')}>Open field view</button>
              <button className="button primary" onClick={() => setSelectedId(null)}>Save & close</button>
            </div>
          </div>
        ) : null}
      </Modal>
    </section>
  )
}
