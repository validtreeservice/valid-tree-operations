import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../components/AuthProvider'
import { supabase } from '../lib/supabase'
import { customerSnapshot, proposalTotal, validateProposal, uid } from '../lib/proposals'

const DEMO_KEY = 'vts-commercial-proposals-demo-v1'
const readDemo = () => { try { return JSON.parse(localStorage.getItem(DEMO_KEY)) || { rows: [], clauses: [] } } catch { return { rows: [], clauses: [] } } }
function errorMessage(error) {
  if (['42P01', 'PGRST202', 'PGRST205'].includes(error?.code)) return 'Commercial Proposals needs database update 014 before it can save live records. Existing Estimates are unaffected.'
  return error?.message || 'The proposal could not be saved. Your edits are still open.'
}
async function resultOf(request) {
  const result = await request
  if (result.error) throw new Error(errorMessage(result.error))
  return result.data
}
export default function useProposals() {
  const { isDemo, user } = useAuth()
  const [rows, setRows] = useState([]), [clauses, setClauses] = useState([])
  const [loading, setLoading] = useState(true), [error, setError] = useState('')
  const refresh = useCallback(async () => {
    setLoading(true); setError('')
    try {
      if (isDemo) { const d = readDemo(); setRows(d.rows); setClauses(d.clauses); return }
      if (!user) { setRows([]); setClauses([]); return }
      const [r, c] = await Promise.all([
        resultOf(supabase.from('commercial_proposals').select('id,number,project_name,project_address,contact_name,company_name,amount,created_at,proposal_date,expires_at,status,revision').order('created_at', { ascending: false })),
        resultOf(supabase.from('proposal_clauses').select('*').order('title')),
      ])
      setRows(r); setClauses(c)
    } catch (e) { setError(errorMessage(e)) } finally { setLoading(false) }
  }, [isDemo, user?.id])
  useEffect(() => { refresh() }, [refresh])
  function demoPut(row) {
    const d = readDemo(), index = d.rows.findIndex(r => r.id === row.id)
    if (index < 0) d.rows.unshift(row); else d.rows[index] = row
    localStorage.setItem(DEMO_KEY, JSON.stringify(d)); setRows(d.rows)
    return row
  }
  async function get(id) {
    if (isDemo) {
      const row = readDemo().rows.find(r => r.id === id)
      if (!row) throw new Error('Proposal not found.')
      return structuredClone(row)
    }
    return resultOf(supabase.from('commercial_proposals').select('*').eq('id', id).single())
  }
  async function save(row) {
    validateProposal(row)
    if (isDemo) {
      const d = readDemo(), previous = d.rows.find(r => r.id === row.id)
      if (previous && (previous.revision !== row.revision || previous.status !== 'draft')) throw new Error('This proposal changed. Reopen it before editing.')
      const year = new Date().getFullYear()
      const next = Math.max(0, ...d.rows.filter(r => r.number.startsWith('PROP-' + year + '-')).map(r => Number(r.number.split('-').at(-1)))) + 1
      return structuredClone(demoPut({ ...row, number: row.number || 'PROP-' + year + '-' + String(next).padStart(4, '0'), revision: row.revision + 1, amount: proposalTotal(row.content), created_at: row.created_at || new Date().toISOString() }))
    }
    const saved = await resultOf(supabase.rpc('save_commercial_proposal', { p_id: row.id, p_revision: row.revision, p_data: row }))
    await refresh(); return saved
  }
  async function publish(row, company) {
    validateProposal(row, true)
    if (isDemo) return structuredClone(demoPut({ ...row, status: 'sent', revision: row.revision + 1, published_snapshot: customerSnapshot(row, company), sent_at: new Date().toISOString(), share_token: null }))
    const saved = await resultOf(supabase.rpc('publish_commercial_proposal', { p_id: row.id, p_revision: row.revision }))
    await refresh(); return saved
  }
  async function reopen(row) {
    if (isDemo) {
      if (row.status === 'accepted') throw new Error('Accepted proposals are locked.')
      return structuredClone(demoPut({ ...row, status: 'draft', revision: row.revision + 1, share_token: null, published_snapshot: null }))
    }
    const saved = await resultOf(supabase.rpc('reopen_commercial_proposal', { p_id: row.id, p_revision: row.revision }))
    await refresh(); return saved
  }
  async function saveClause(clause) {
    const title = clause.title.trim(), body = clause.body.trim()
    if (!title || !body) throw new Error('Enter a clause title and wording.')
    if (isDemo) {
      const d = readDemo(), id = clause.standard ? uid() : clause.id || uid()
      d.clauses = [...d.clauses.filter(c => c.id !== id), { id, title, body }]
      localStorage.setItem(DEMO_KEY, JSON.stringify(d)); setClauses(d.clauses); return
    }
    const owner = await resultOf(supabase.rpc('current_owner_id'))
    await resultOf(supabase.from('proposal_clauses').upsert({ id: clause.standard ? uid() : clause.id || uid(), owner_id: owner, title, body }))
    await refresh()
  }
  async function deleteClause(id) {
    if (isDemo) {
      const d = readDemo(); d.clauses = d.clauses.filter(c => c.id !== id)
      localStorage.setItem(DEMO_KEY, JSON.stringify(d)); setClauses(d.clauses); return
    }
    await resultOf(supabase.from('proposal_clauses').delete().eq('id', id)); await refresh()
  }
  return { rows, clauses, loading, error, isDemo, refresh, get, save, publish, reopen, saveClause, deleteClause,
    convert: id => resultOf(supabase.rpc('convert_commercial_proposal', { p_id: id })) }
}
