import { useMemo, useState } from 'react'
import { useWorkspace } from '../data/WorkspaceProvider'
import PageHeader from '../components/PageHeader'
import StatusBadge from '../components/StatusBadge'

const blank = { slot_date: '', start_time: '08:00', capacity: 1, customer_note: 'Your service day is reserved exclusively for your project.' }
const readableDate = (value) => new Date(`${value}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })

export default function SchedulePage() {
  const { data, customer, crew, addAndWait, updateAndWait, removeAndWait } = useWorkspace()
  const [form, setForm] = useState(blank)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const days = [...new Set(data.jobs.map((item) => item.date).filter(Boolean))].sort()
  const slots = useMemo(() => [...(data.schedule_slots || [])]
    .filter((item) => item.slot_date >= new Date().toISOString().slice(0, 10))
    .sort((a, b) => `${a.slot_date}${a.start_time}`.localeCompare(`${b.slot_date}${b.start_time}`))
    .slice(0, 90), [data.schedule_slots])

  const bookingCount = (slot) => data.jobs.filter((job) => job.date === slot.slot_date && !['cancelled', 'void'].includes(job.status)).length

  async function addSlot(event) {
    event.preventDefault()
    setMessage('')
    if (new Date(`${form.slot_date}T12:00:00`).getDay() === 0) return setMessage('Sunday appointments require direct approval from Valid Tree Service. Choose Monday through Saturday here.')
    setBusy(true)
    try {
      await addAndWait('schedule_slots', { ...form, capacity: 1, active: true })
      setForm(blank)
      setMessage('Available workday added. One customer may reserve the entire date after signing.')
    } catch (error) { setMessage(error.message || 'The available date could not be saved.') }
    finally { setBusy(false) }
  }

  async function removeSlot(slot) {
    if (bookingCount(slot)) return setMessage('This workday has a customer booking and cannot be deleted.')
    try { await removeAndWait('schedule_slots', slot.id); setMessage('Available workday removed.') }
    catch (error) { setMessage(error.message || 'The available workday could not be removed.') }
  }

  return <section>
    <PageHeader title="Schedule" description="One customer per Monday–Saturday workday, plus office-controlled Sunday scheduling." />
    {message ? <p className={message.includes('cannot') || message.includes('Sunday') ? 'form-message error' : 'success-banner'}>{message}</p> : null}
    <div className="availability-layout">
      <form className="availability-form" onSubmit={addSlot}>
        <h2>Monday–Saturday work calendar</h2>
        <p>The installation loads the next 18 months automatically. Each available date accepts one customer only; the first reservation closes that entire day.</p>
        <div className="form-grid">
          <label>Date<input type="date" min={new Date().toISOString().slice(0, 10)} value={form.slot_date} onChange={(event) => setForm({ ...form, slot_date: event.target.value })} required /></label>
          <label>Office start time<input type="time" value={form.start_time} onChange={(event) => setForm({ ...form, start_time: event.target.value })} required /></label>
          <label className="wide">Customer note<input value={form.customer_note} onChange={(event) => setForm({ ...form, customer_note: event.target.value })} placeholder="Arrival window or preparation note" /></label>
          <button className="button primary wide" disabled={busy}>{busy ? 'Saving...' : 'Add workday'}</button>
        </div>
      </form>
      <div className="availability-list">
        <h2>Next 90 workdays</h2>
        {slots.length ? slots.map((slot) => <article key={slot.id} className="availability-card"><div><strong>{readableDate(slot.slot_date)}</strong><span>{bookingCount(slot) ? 'Reserved — day closed to other customers' : 'Available for one customer'}</span></div><div className="row-actions"><button onClick={() => updateAndWait('schedule_slots', slot.id, { active: !slot.active })}>{slot.active ? 'Pause' : 'Activate'}</button><button onClick={() => removeSlot(slot)}>Delete</button></div></article>) : <p>No customer booking dates have been added yet.</p>}
      </div>
    </div>
    <div className="schedule-legend">{data.crews.map((item) => <span key={item.id}><i style={{ background: item.color }} />{item.name}</span>)}</div>
    <div className="schedule">{days.map((day) => <div className="schedule-day" key={day}><div className="schedule-date"><strong>{new Date(`${day}T12:00`).toLocaleDateString('en-US', { weekday: 'short' })}</strong><b>{new Date(`${day}T12:00`).getDate()}</b><span>{new Date(`${day}T12:00`).toLocaleDateString('en-US', { month: 'short' })}</span></div><div className="schedule-jobs">{data.jobs.filter((job) => job.date === day).map((job) => <article key={job.id} style={{ borderLeftColor: crew(job.crew_id)?.color }}><div><strong>{job.start_time} · {job.title}</strong><span>{customer(job.customer_id)?.full_name} — {job.address}</span></div><div><small>{crew(job.crew_id)?.name || 'Unassigned'}</small><StatusBadge value={job.status} /></div></article>)}</div></div>)}</div>
  </section>
}
