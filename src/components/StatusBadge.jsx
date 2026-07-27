export default function StatusBadge({ value }) {
  const normalized = String(value || '').toLowerCase()
  return <span className={`status-badge status-${normalized}`}>{normalized.replaceAll('_', ' ')}</span>
}
