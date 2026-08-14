import { useState } from 'react'
import { useWorkspace } from '../data/WorkspaceProvider'
import { Empty, ErrorBanner, Field, PageHeader, SelectJob } from '../components/OperationsUI'

const date = () => new Date().toISOString().slice(0, 10)
export default function FieldReportsPage() {
  const ws = useWorkspace()
  const [jobId, setJobId] = useState(ws.data.jobs[0]?.id || '')
  const [report, setReport] = useState({ report_date: date(), weather: '', crew_size: '', hours_worked: '', work_completed: '', delays: '', safety_incidents: 'None', next_steps: '', completion_percent: '', submitted_by: '' })
  const [production, setProduction] = useState({ report_date: date(), activity: 'acres cleared', quantity: '', unit: 'acres', equipment_hours: '', downtime_hours: 0, notes: '' })
  const [message, setMessage] = useState('')
  const reports = ws.data.daily_reports.filter((item) => item.job_id === jobId)
  const logs = ws.data.production_logs.filter((item) => item.job_id === jobId)
  async function save(event) {
    event.preventDefault(); setMessage('')
    try {
      await ws.addAndWait('daily_reports', { ...report, job_id: jobId, crew_id: ws.job(jobId)?.crew_id || null, crew_size: Number(report.crew_size), hours_worked: Number(report.hours_worked), completion_percent: Number(report.completion_percent) })
      await ws.updateAndWait('jobs', jobId, { completion_percent: Number(report.completion_percent), status: Number(report.completion_percent) >= 100 ? 'completed' : 'in progress' })
      setReport({ ...report, work_completed: '', delays: '', next_steps: '' })
    } catch (error) { setMessage(error.message) }
  }
  return <div className="operations-page">
    <PageHeader eyebrow="Mobile field workflow" title="Daily Reports & Production"><SelectJob jobs={ws.data.jobs} value={jobId} onChange={setJobId} /></PageHeader>
    <ErrorBanner message={message || ws.syncError} />
    <div className="module-grid">
      <section className="panel"><h2>Daily field report</h2><form className="form-grid" onSubmit={save}>
        <Field label="Date"><input type="date" value={report.report_date} onChange={(e) => setReport({ ...report, report_date: e.target.value })} /></Field>
        <Field label="Submitted by"><input required value={report.submitted_by} onChange={(e) => setReport({ ...report, submitted_by: e.target.value })} /></Field>
        <Field label="Weather"><input value={report.weather} onChange={(e) => setReport({ ...report, weather: e.target.value })} /></Field>
        <Field label="Crew size"><input required min="0" type="number" value={report.crew_size} onChange={(e) => setReport({ ...report, crew_size: e.target.value })} /></Field>
        <Field label="Crew hours"><input required min="0" step=".25" type="number" value={report.hours_worked} onChange={(e) => setReport({ ...report, hours_worked: e.target.value })} /></Field>
        <Field label="Completion %"><input required min="0" max="100" type="number" value={report.completion_percent} onChange={(e) => setReport({ ...report, completion_percent: e.target.value })} /></Field>
        <Field label="Work completed" className="wide"><textarea required value={report.work_completed} onChange={(e) => setReport({ ...report, work_completed: e.target.value })} /></Field>
        <Field label="Delays / downtime" className="wide"><textarea value={report.delays} onChange={(e) => setReport({ ...report, delays: e.target.value })} /></Field>
        <Field label="Safety incidents" className="wide"><textarea value={report.safety_incidents} onChange={(e) => setReport({ ...report, safety_incidents: e.target.value })} /></Field>
        <Field label="Next steps" className="wide"><textarea value={report.next_steps} onChange={(e) => setReport({ ...report, next_steps: e.target.value })} /></Field>
        <button className="button primary wide">Submit report</button>
      </form></section>
      <section className="panel"><h2>Production log</h2><form className="form-grid" onSubmit={async (event) => { event.preventDefault(); await ws.addAndWait('production_logs', { ...production, job_id: jobId, quantity: Number(production.quantity), equipment_hours: Number(production.equipment_hours), downtime_hours: Number(production.downtime_hours) }); setProduction({ ...production, quantity: '', equipment_hours: '', notes: '' }) }}>
        <Field label="Activity"><input required value={production.activity} onChange={(e) => setProduction({ ...production, activity: e.target.value })} /></Field>
        <Field label="Date"><input type="date" value={production.report_date} onChange={(e) => setProduction({ ...production, report_date: e.target.value })} /></Field>
        <Field label="Quantity"><input required min="0" step=".01" type="number" value={production.quantity} onChange={(e) => setProduction({ ...production, quantity: e.target.value })} /></Field>
        <Field label="Unit"><input required value={production.unit} onChange={(e) => setProduction({ ...production, unit: e.target.value })} /></Field>
        <Field label="Equipment hours"><input min="0" step=".1" type="number" value={production.equipment_hours} onChange={(e) => setProduction({ ...production, equipment_hours: e.target.value })} /></Field>
        <Field label="Downtime hours"><input min="0" step=".1" type="number" value={production.downtime_hours} onChange={(e) => setProduction({ ...production, downtime_hours: e.target.value })} /></Field>
        <Field label="Notes" className="wide"><textarea value={production.notes} onChange={(e) => setProduction({ ...production, notes: e.target.value })} /></Field>
        <button className="button primary wide">Add production</button>
      </form>
      <div className="record-list">{logs.length ? logs.map((item) => <div className="record-row" key={item.id}><div><strong>{item.quantity} {item.unit} · {item.activity}</strong><small>{item.report_date} · {item.equipment_hours} machine hours · {item.downtime_hours} downtime</small></div></div>) : <Empty>No production logged.</Empty>}</div></section>
      <section className="panel full-span"><h2>Report history</h2><div className="record-list">{reports.length ? reports.map((item) => <div className="record-row" key={item.id}><div><strong>{item.report_date} · {item.completion_percent}% complete</strong><small>{item.work_completed}</small></div><span>{item.crew_size} people · {item.hours_worked} hours</span></div>) : <Empty>No field reports yet.</Empty>}</div></section>
    </div>
  </div>
}
