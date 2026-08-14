import Stripe from 'npm:stripe@^22'
import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...cors, 'Content-Type': 'application/json' },
})

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405)

  try {
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
    if (!stripeKey || !supabaseUrl || !serviceKey || !anonKey) throw new Error('Stripe or Supabase secrets are not configured.')

    const stripe = new Stripe(stripeKey)
    const admin = createClient(supabaseUrl, serviceKey)
    const authHeader = request.headers.get('Authorization') || ''
    const caller = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } })
    const body = await request.json()
    const invoiceId = String(body.invoice_id || '')
    const contractToken = String(body.contract_token || '')
    const paymentKind = body.payment_kind === 'deposit' ? 'deposit' : 'balance'
    let invoice: any = null
    let customer: any = null
    let contract: any = null

    if (invoiceId) {
      const { data: { user } } = await caller.auth.getUser()
      if (!user) return json({ error: 'Please sign in again before creating a payment link.' }, 401)
      const result = await caller.from('invoices').select('*, customers(full_name,email)').eq('id', invoiceId).single()
      if (result.error || !result.data) return json({ error: 'Invoice not found or access denied.' }, 404)
      invoice = result.data
      customer = invoice.customers
      if (invoice.contract_id) {
        const contractResult = await caller.from('contracts').select('*').eq('id', invoice.contract_id).maybeSingle()
        contract = contractResult.data
      }
    } else if (contractToken) {
      const contractResult = await admin.from('contracts').select('*, customers(full_name,email)').eq('sign_token', contractToken).eq('status', 'signed').single()
      if (contractResult.error || !contractResult.data) return json({ error: 'This signed agreement is unavailable for payment.' }, 404)
      contract = contractResult.data
      customer = contract.customers

      const existing = await admin.from('invoices').select('*').eq('contract_id', contract.id).order('created_at', { ascending: false }).limit(1).maybeSingle()
      invoice = existing.data
      if (!invoice) {
        const jobResult = await admin.from('jobs').select('id').eq('contract_id', contract.id).limit(1).maybeSingle()
        const invoiceNumber = `INV-${new Date().getFullYear()}-${contract.contract_number.replace(/[^0-9]/g, '').slice(-6)}-${crypto.randomUUID().slice(0, 4).toUpperCase()}`
        const created = await admin.from('invoices').insert({
          owner_id: contract.owner_id,
          customer_id: contract.customer_id,
          job_id: jobResult.data?.id || null,
          contract_id: contract.id,
          number: invoiceNumber,
          amount: Number(contract.total_price || 0),
          paid: 0,
          manual_paid: 0,
          status: 'open',
          due_date: contract.service_date || null,
          notes: `Created from signed contract ${contract.contract_number}`,
        }).select().single()
        if (created.error) throw created.error
        invoice = created.data
      }
    } else {
      return json({ error: 'An invoice or signed-contract token is required.' }, 400)
    }

    const total = Number(invoice.amount || 0)
    if (invoice.status === 'void') return json({ error: 'This invoice was voided and cannot accept payment.' }, 409)
    const paid = Number(invoice.paid || 0)
    const outstanding = Math.max(total - paid, 0)
    if (outstanding < 0.5) return json({ error: 'This invoice is already paid.' }, 409)

    let requested = outstanding
    if (paymentKind === 'deposit' && contract) {
      const remainingDeposit = Number(contract.deposit || 0) - paid
      if (remainingDeposit <= 0) return json({ error: 'The required deposit has already been paid.' }, 409)
      requested = Math.min(remainingDeposit, outstanding)
    }
    const cents = Math.round(requested * 100)
    if (cents < 50) return json({ error: 'The remaining card payment is below Stripe’s minimum.' }, 400)

    const siteUrl = (Deno.env.get('PUBLIC_SITE_URL') || 'https://operations.validtreeservice.com').replace(/\/$/, '')
    const returnPath = contractToken ? `/sign/${encodeURIComponent(contractToken)}` : '/invoices'
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: customer?.email || undefined,
      client_reference_id: invoice.id,
      line_items: [{
        quantity: 1,
        price_data: {
          currency: 'usd',
          unit_amount: cents,
          product_data: { name: `${invoice.number} — ${paymentKind === 'deposit' ? 'Deposit' : 'Invoice payment'}` },
        },
      }],
      metadata: {
        owner_id: invoice.owner_id,
        invoice_id: invoice.id,
        contract_id: contract?.id || invoice.contract_id || '',
        payment_kind: paymentKind,
      },
      payment_intent_data: {
        metadata: { owner_id: invoice.owner_id, invoice_id: invoice.id, payment_kind: paymentKind },
      },
      success_url: `${siteUrl}${returnPath}?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}${returnPath}?payment=cancelled`,
      expires_at: Math.floor(Date.now() / 1000) + (30 * 60),
    })

    await admin.from('invoices').update({
      payment_link: session.url,
      stripe_checkout_session_id: session.id,
      stripe_status: 'checkout_created',
    }).eq('id', invoice.id)

    return json({ ok: true, url: session.url, session_id: session.id, invoice_id: invoice.id, amount: requested })
  } catch (error) {
    console.error('create-stripe-checkout', error)
    return json({ error: error instanceof Error ? error.message : 'Unable to create payment checkout.' }, 400)
  }
})
