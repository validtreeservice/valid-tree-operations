import { useMemo, useState } from 'react'
import { useWorkspace } from '../data/WorkspaceProvider'
import PageHeader from '../components/PageHeader'
import StatusBadge from '../components/StatusBadge'

const blank = { slot_date: '', start_time: '08:00', capacity: 1, customer_note: '' }
const readableDate = (value) => new Date(`${value}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })

export default function SchedulePage() {
  const { data, customer, crew, addAndWait, updateAndWait, removeAndWait } = useWorkspace()
  const [form, setForm] = useState(blank)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const days = [...new Set(data.jobs.map((item) => item.date).filter(Boolean))].sort()
  const slots = useMemo(() => [...(data.schedule_slots || [])].filter((item) => item.slot_date >= new Date().toISOString().slice(0, 10)).sort((a, b) => `${a.slot_date}${a.start_time}`.localeCompare(`${b.slot_date}${b.start_time}`)), [data.schedule_slots])

  const bookingCount = (slot) => data.jobs.filter((job) => job.schedule_slot_id === slot.id && job.status !== 'cancelled').length

  async function addSlot(event) {
    event.preventDefault(); setMessage('')
    if (new Date(`${form.slot_date}T12:00:00`).getDay() === 0) return setMessage('Sunday appointments require direct approval from Valid Tree Service. Choose Monday through Saturday here.')
    setBusy(true)
    try {
      await addAndWait('schedule_slots', { ...form, capacity: Math.max(1, Number(form.capacity || 1)), active: true })
      setForm(blank); setMessage('Available appointment added. Customers can now choose it after signing.')
    } catch (error) { setMessage(error.message || 'The available date could not be saved.') }
    finally { setBusy(false) }
  }

  async function removeSlot(slot) {
    if (bookingCount(slot)) return setMessage('This time already has a customer booking and cannot be deleted.')
    try { await removeAndWait('schedule_slots', slot.id); setMessage('Available time removed.') }
    catch (error) { setMessage(error.message || 'The available time could not be removed.') }
  }

  return <section>
    <PageHeader title="Schedule" description="Manage customer booking availability and every crew’s workload." />
    {message ? <p className={message.includes('cannot') || message.includes('Sunday') ? 'form-message error' : 'success-banner'}>{message}</p> : null}
    <div className="availability-layout">
      <form className="availability-form" onSubmit={addSlot}>
        <h2>Customer booking availability</h2>
        <p>Create the exact dates customers may choose after signing. Sunday bookings require them to contact you directly.</p>
        <div className="form-grid"><label>Date<input type="date" min={new Date().toISOString().slice(0, 10)} value={form.slot_date} onChange={(event) => setForm({ ...form, slot_date: event.target.value })} required /></label><label>Start time<input type="time" value={form.start_time} onChange={(event) => setForm({ ...form, start_time: event.target.value })} required /></label><label>Bookings allowed<input type="number" min="1" max="10" value={form.capacity} onChange={(event) => setForm({ ...form, capacity: event.target.value })} /></label><label className="wide">Customer note<input value={form.customer_note} onChange={(event) => setForm({ ...form, customer_note: event.target.value })} placeholder="Arrival window 8–9 AM" /></label><button className="button primary wide" disabled={busy}>{busy ? 'Saving…' : 'Add available time'}</button></div>
      </form>
      <div className="availability-list"><h2>Upcoming choices</h2>{slots.length ? slots.map((slot) => <article key={slot.id} className="availability-card"><div><strong>{readableDate(slot.slot_date)} at {slot.start_time}</strong><span>{bookingCount(slot)} of {slot.capacity} booked{slot.customer_note ? ` · ${slot.customer_note}` : ''}</span></div><div className="row-actions"><button onClick={() => updateAndWait('schedule_slots', slot.id, { active: !slot.active })}>{slot.active ? 'Pause' : 'Activate'}</button><button onClick={() => removeSlot(slot)}>Delete</button></div></article>) : <p>No customer booking dates have been added yet.</p>}</div>
    </div>
    <div className="schedule-legend">{data.crews.map((item) => <span key={item.id}><i style={{ background: item.color }} />{item.name}</span>)}</div>
    <div className="schedule">{days.map((day) => <div className="schedule-day" key={day}><div className="schedule-date"><strong>{new Date(`${day}T12:00`).toLocaleDateString('en-US', { weekday: 'short' })}</strong><b>{new Date(`${day}T12:00`).getDate()}</b><span>{new Date(`${day}T12:00`).toLocaleDateString('en-US', { month: 'short' })}</span></div><div className="schedule-jobs">{data.jobs.filter((job) => job.date === day).map((job) => <article key={job.id} style={{ borderLeftColor: crew(job.crew_id)?.color }}><div><strong>{job.start_time} · {job.title}</strong><span>{customer(job.customer_id)?.full_name} — {job.address}</span></div><div><small>{crew(job.crew_id)?.name || 'Unassigned'}</small><StatusBadge value={job.status} /></div></article>)}</div></div>)}</div>
  </section>
}
