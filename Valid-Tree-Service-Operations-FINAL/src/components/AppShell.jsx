import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useState } from 'react'
import { useAuth } from './AuthProvider'

const groups = [
  ['Operate', [['/', 'Dashboard', 'D'], ['/search', 'Search', 'S'], ['/customers', 'CRM / Customers', 'C'], ['/estimates', 'Estimates', 'E'], ['/contracts', 'Contracts', 'A'], ['/jobs', 'Jobs', 'J'], ['/schedule', 'Schedule', 'K']]],
  ['Control', [['/expenses', 'Expenses', '$'], ['/costing', 'Job Costing', 'J'], ['/field-reports', 'Daily Reports', 'R'], ['/fleet', 'Fleet & Fuel', 'F'], ['/invoices', 'Invoices', 'I'], ['/reports', 'Reports', 'P']]],
  ['Grow', [['/estimator', 'Land Estimator', 'L'], ['/ai', 'AI Assistant', '*']]],
  ['Company', [['/workers', 'Worker Payments', 'W'], ['/tablet', 'Tablet Mode', 'T'], ['/team', 'Team & Crews', 'G'], ['/settings', 'Settings', 'O']]],
]
const allLinks = groups.flatMap((group) => group[1])

export default function AppShell() {
  const [open, setOpen] = useState(false)
  const { signOut, isDemo } = useAuth()
  const location = useLocation()
  return <div className="app-shell"><aside className={open ? 'sidebar open' : 'sidebar'}>
    <div className="brand"><img src="/valid-tree-logo.png" alt="Valid Tree Service" /><div><strong>VALID TREE</strong><span>Operations Center</span></div></div>
    <nav>{groups.map(([name, links]) => <div className="nav-group" key={name}><small>{name}</small>{links.map(([to, label, icon]) => <NavLink key={to} to={to} end={to === '/'} onClick={() => setOpen(false)}><i>{icon}</i>{label}</NavLink>)}</div>)}</nav>
    <div className="sidebar-foot"><span className={isDemo ? 'mode demo' : 'mode'}>{isDemo ? 'Demo workspace' : 'Live workspace'}</span><button onClick={signOut}>Sign out</button></div>
  </aside><div className="main"><header className="topbar"><button className="menu" aria-label="Open menu" onClick={() => setOpen(!open)}>☰</button><div><strong>{allLinks.find(([path]) => path === location.pathname)?.[1] || 'Valid Tree Service'}</strong><span>Houston operations center</span></div><div className="top-actions"><NavLink className="quick" to="/search">Search</NavLink><NavLink className="quick" to="/ai">Ask AI</NavLink><div className="avatar">VT</div></div></header><main className="content"><Outlet /></main></div>{open ? <button className="scrim" aria-label="Close menu" onClick={() => setOpen(false)} /> : null}</div>
}
