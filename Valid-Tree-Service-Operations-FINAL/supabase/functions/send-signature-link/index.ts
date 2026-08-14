import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const auth = req.headers.get('Authorization') || ''
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } })
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')
    const { contract_id, channel = 'email' } = await req.json()
    const { data: contract, error } = await supabase.from('contracts').select('id,contract_number,sign_token,customers(full_name,email,phone)').eq('id', contract_id).single()
    if (error || !contract) throw new Error('Contract not found')
    const site = Deno.env.get('PUBLIC_SITE_URL') || 'https://operations.validtreeservice.com'
    const link = `${site}/sign/${contract.sign_token}`
    // Provider integration point. Add RESEND_API_KEY and/or TWILIO secrets before enabling delivery.
    return new Response(JSON.stringify({ ok: true, channel, link, recipient: channel === 'sms' ? contract.customers?.phone : contract.customers?.email, message: `Valid Tree Service contract ${contract.contract_number}: ${link}` }), { headers: { ...cors, 'Content-Type': 'application/json' } })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } })
  }
})
