export function PageHeader({ eyebrow, title, children }) {
  return <div className="page-head"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1></div>{children ? <div className="page-actions">{children}</div> : null}</div>
}

export function Metric({ label, value, note, tone = '' }) {
  return <article className={`metric-card ${tone}`}><span>{label}</span><strong>{value}</strong>{note ? <small>{note}</small> : null}</article>
}

export function Empty({ children = 'No records yet.' }) {
  return <div className="empty-state">{children}</div>
}

export function SelectJob({ jobs, value, onChange }) {
  return <label className="compact-field"><span>Job</span><select value={value} onChange={(event) => onChange(event.target.value)}><option value="">Select a job</option>{jobs.map((job) => <option key={job.id} value={job.id}>{job.number} — {job.title}</option>)}</select></label>
}

export function Field({ label, children, className = '' }) {
  return <label className={className}><span>{label}</span>{children}</label>
}

export function ErrorBanner({ message }) {
  return message ? <div className="error-banner" role="alert">{message}</div> : null
}
