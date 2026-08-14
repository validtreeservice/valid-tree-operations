import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useWorkspace } from '../data/WorkspaceProvider'
import { supabase } from '../lib/supabase'

const examples = ['Create a contract for James Walker to remove one pine tree for $2,800 with a 30% deposit.', 'Who should we follow up with today?', 'Draft a friendly text for an unsigned contract.', 'Summarize tomorrow’s jobs for the foremen.']

function localReply(prompt, data, customer) {
  const p = prompt.toLowerCase()
  if (p.includes('follow up') || p.includes('follow-up')) {
    const sent = data.estimates.filter((x) => x.status === 'sent').map((x) => `${customer(x.customer_id)?.full_name}: estimate ${x.number} for $${Number(x.amount).toLocaleString()} is waiting.`)
    const unsigned = data.contracts.filter((x) => x.status === 'sent').map((x) => `${customer(x.customer_id)?.full_name}: contract ${x.contract_number} is awaiting signature.`)
    const overdue = data.invoices.filter((x) => x.status === 'overdue').map((x) => `${customer(x.customer_id)?.full_name}: invoice ${x.number} has an overdue balance of $${Number(x.amount - x.paid).toLocaleString()}.`)
    return `Today’s follow-up list:\n\n${[...overdue, ...unsigned, ...sent].map((x, i) => `${i + 1}. ${x}`).join('\n')}\n\nRecommended order: overdue balances, unsigned contracts, then open estimates.`
  }
  if (p.includes('tomorrow') || p.includes('foremen')) {
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10)
    const jobs = data.jobs.filter((x) => x.date === tomorrow)
    return jobs.length ? jobs.map((j) => `${j.start_time} — ${j.title}\n${customer(j.customer_id)?.full_name}, ${j.address}\nEquipment: ${j.equipment}\nForeman notes: ${j.foreman_notes}`).join('\n\n') : 'There are no jobs scheduled for tomorrow.'
  }
  if (p.includes('text') || p.includes('message')) return 'Hi [Customer Name], this is Valid Tree Service. I’m following up on the tree-service agreement we sent. Please let us know if you have any questions. You can review and sign it whenever convenient using the secure link. Thank you!'
  return 'I can organize that into a polished Valid Tree Service scope or contract. Review the draft before saving—especially the customer, work details, price, and date.'
}

function parseDraft(text, prompt, data) {
  const marker = 'CONTRACT_DRAFT_JSON'
  let parsed = null
  if (text.includes(marker)) {
    try { parsed = JSON.parse(text.slice(text.indexOf(marker) + marker.length).replace(/```json|```/g, '').trim()) } catch { parsed = null }
  }
  const price = prompt.match(/\$?([\d,]+)(?:\.\d{2})?/)
  const named = data.customers.find((c) => prompt.toLowerCase().includes(c.full_name.toLowerCase().split(' ')[0]))
  if (!parsed && !prompt.toLowerCase().includes('contract')) return null
  const total = Number(parsed?.total_price ?? (price ? price[1].replaceAll(',', '') : 0))
  return { customer_id: named?.id || '', title: parsed?.title || 'Tree Service Agreement', scope_of_work: parsed?.scope_of_work || prompt.replace(/create a contract( for)?/i, '').trim(), total_price: total, deposit: Number(parsed?.deposit ?? total * 0.3), service_date: parsed?.service_date || '' }
}

export default function AiAssistantPage() {
  const { data, customer, add, isDemo } = useWorkspace()
  const navigate = useNavigate()
  const [prompt, setPrompt] = useState('')
  const [messages, setMessages] = useState([{ role: 'assistant', text: 'Tell me what happened, what needs to be created, or who needs attention. Speak naturally—like you would to your office manager.' }])
  const [listening, setListening] = useState(false)
  const [working, setWorking] = useState(false)
  const recognition = useRef(null)
  const [draft, setDraft] = useState(null)

  function listen() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) return alert('Speech recognition is not available in this browser. Chrome or Edge works best.')
    recognition.current = new SR(); recognition.current.continuous = false; recognition.current.interimResults = true
    recognition.current.onresult = (e) => setPrompt(Array.from(e.results).map((r) => r[0].transcript).join(''))
    recognition.current.onend = () => setListening(false); recognition.current.start(); setListening(true)
  }

  async function send(text = prompt) {
    if (!text.trim() || working) return
    setMessages((m) => [...m, { role: 'user', text }]); setPrompt(''); setWorking(true)
    let reply = ''
    if (!isDemo && supabase) {
      const context = { customers: data.customers, estimates: data.estimates, contracts: data.contracts.map(({ signature_data, ...c }) => c), jobs: data.jobs, invoices: data.invoices, tasks: data.tasks, settings: data.settings }
      const { data: result, error } = await supabase.functions.invoke('ai-assistant', { body: { prompt: text, context } })
      reply = error ? `AI is not configured yet: ${error.message}` : result?.text || 'No response was returned.'
    } else reply = localReply(text, data, customer)
    setMessages((m) => [...m, { role: 'assistant', text: reply.replace(/CONTRACT_DRAFT_JSON[\s\S]*/, '').trim() }])
    const nextDraft = parseDraft(reply, text, data); if (nextDraft) setDraft(nextDraft)
    setWorking(false)
  }

  function create() {
    add('contracts', { ...draft, contract_number: `VTS-${new Date().getFullYear()}-${String(data.contracts.length + 1).padStart(4, '0')}`, status: 'draft', sign_token: crypto.randomUUID(), signed_at: null })
    navigate('/contracts')
  }

  return <section className="ai-layout"><div className="ai-chat"><div className="ai-head"><div className="ai-orb">✦</div><div><p className="eyebrow">VALID AI</p><h1>Your operations copilot</h1><p>Draft paperwork, find follow-ups, prepare crews, and turn spoken details into organized work.</p></div></div>
    <div className="suggestions">{examples.map((x) => <button key={x} onClick={() => send(x)}>{x}</button>)}</div>
    <div className="messages">{messages.map((m, i) => <div className={`message ${m.role}`} key={i}><span>{m.role === 'assistant' ? '✦' : 'You'}</span><p>{m.text}</p></div>)}{working ? <div className="message assistant"><span>✦</span><p>Working…</p></div> : null}</div>
    <div className="composer"><textarea rows="3" placeholder="Try: Make a contract for Maria to remove two oaks for $4,500…" value={prompt} onChange={(e) => setPrompt(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }} /><button className={listening ? 'mic live' : 'mic'} onClick={listen}>{listening ? 'Listening…' : '◉ Speak'}</button><button className="send" onClick={() => send()} disabled={working}>Send ↑</button></div>
    <p className="ai-note">Live mode uses a secure Supabase Edge Function. Your API key never enters the browser.</p></div>
    <aside className="ai-side"><p className="eyebrow">LIVE BUSINESS SIGNALS</p><h2>AI action queue</h2>{data.tasks.filter((x) => !x.done).map((t) => <article key={t.id}><span>{String(t.type || 'task').replace('_', ' ')}</span><strong>{t.title}</strong><small>Due {t.due_date} · {t.assigned_label || 'Office'}</small></article>)}
      {draft ? <div className="draft-card"><p className="eyebrow">DRAFT READY</p><h3>{draft.title}</h3><label>Customer<select value={draft.customer_id} onChange={(e) => setDraft({ ...draft, customer_id: e.target.value })}><option value="">Select customer</option>{data.customers.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}</select></label><label>Scope<textarea rows="6" value={draft.scope_of_work} onChange={(e) => setDraft({ ...draft, scope_of_work: e.target.value })} /></label><div><span>Total</span><strong>${Number(draft.total_price).toLocaleString()}</strong></div><button className="button primary" onClick={create}>Create contract</button></div> : null}
    </aside></section>
}
