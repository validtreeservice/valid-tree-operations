import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const auth = req.headers.get('Authorization') || ''
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } })
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...cors, 'Content-Type': 'application/json' } })
    const { prompt, context } = await req.json()
    if (!prompt || String(prompt).length > 8000) throw new Error('A valid prompt is required.')
    const apiKey = Deno.env.get('OPENAI_API_KEY')
    if (!apiKey) throw new Error('OPENAI_API_KEY is not configured.')
    const instructions = `You are Valid AI, the operations copilot for Valid Tree Service LLC in Houston, Texas. Help office staff draft tree-service scopes, contracts, follow-ups, job briefs, and customer messages. Be precise, professional, safety-conscious, and concise. Never invent prices, dates, tree counts, equipment, or customer facts. When the user asks to create a contract, include a JSON block at the end under the exact marker CONTRACT_DRAFT_JSON with keys customer_name, title, scope_of_work, total_price, deposit, service_date. Use null for missing facts. Do not provide legal advice.`
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST', headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: Deno.env.get('OPENAI_MODEL') || 'gpt-5-mini', instructions, input: `Business context:\n${JSON.stringify(context || {}).slice(0, 20000)}\n\nUser request:\n${prompt}` })
    })
    const payload = await response.json()
    if (!response.ok) throw new Error(payload?.error?.message || 'AI request failed')
    return new Response(JSON.stringify({ text: payload.output_text || '' }), { headers: { ...cors, 'Content-Type': 'application/json' } })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } })
  }
})
