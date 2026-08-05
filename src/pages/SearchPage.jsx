import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useWorkspace } from '../data/WorkspaceProvider'
import { Empty, PageHeader } from '../components/OperationsUI'

const routes = { customers: '/customers', estimates: '/estimates', contracts: '/contracts', jobs: '/jobs', invoices: '/invoices', expenses: '/costing', equipment: '/fleet' }
export default function SearchPage() {
  const ws = useWorkspace()
  const [query, setQuery] = useState('')
  const results = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (needle.length < 2) return []
    return Object.entries(routes).flatMap(([collection, route]) => (ws.data[collection] || []).filter((item) => Object.values(item).some((value) => typeof value === 'string' && value.toLowerCase().includes(needle))).map((item) => ({ collection, route, item }))).slice(0, 50)
  }, [query, ws.data])
  return <div className="operations-page"><PageHeader eyebrow="Across the company" title="Search Everything" /><input className="global-search" autoFocus placeholder="Customer, address, contract, job, equipment, vendor…" value={query} onChange={(e) => setQuery(e.target.value)} />
    <section className="panel search-results">{query.length < 2 ? <Empty>Type at least two characters.</Empty> : results.length ? results.map(({ collection, route, item }) => <Link to={route} className="search-result" key={`${collection}-${item.id}`}><span>{collection}</span><div><strong>{item.full_name || item.title || item.name || item.number || item.description}</strong><small>{item.service_address || item.address || item.vendor || item.status || ''}</small></div></Link>) : <Empty>No matching records.</Empty>}</section>
  </div>
}
