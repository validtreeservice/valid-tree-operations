import Stripe from 'npm:stripe@^22'
import { createClient } from 'npm:@supabase/supabase-js@2'

Deno.serve(async (request) => {
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 })
  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')!
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')!
  const stripe = new Stripe(stripeKey)
  const cryptoProvider = Stripe.createSubtleCryptoProvider()
  const signature = request.headers.get('stripe-signature') || ''
  const rawBody = await request.text()
  let event: Stripe.Event

  try {
    event = await stripe.webhooks.constructEventAsync(rawBody, signature, webhookSecret, undefined, cryptoProvider)
  } catch (error) {
    console.error('Invalid Stripe signature', error)
    return new Response('Invalid signature', { status: 400 })
  }

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const duplicate = await admin.from('stripe_webhook_events').select('id').eq('id', event.id).maybeSingle()
  if (duplicate.data) return Response.json({ received: true, duplicate: true })

  try {
    if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
      const session = event.data.object as Stripe.Checkout.Session
      if (session.payment_status !== 'paid') return Response.json({ received: true, pending: true })
      const invoiceId = session.metadata?.invoice_id
      const ownerId = session.metadata?.owner_id
      if (!invoiceId || !ownerId) throw new Error('Stripe session is missing invoice metadata.')

      const invoiceResult = await admin.from('invoices').select('*').eq('id', invoiceId).single()
      if (invoiceResult.error || !invoiceResult.data) throw new Error('Invoice was not found for this Stripe payment.')
      const invoice = invoiceResult.data
      const paymentIntentId = typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id
      let fee = 0
      let net = Number(session.amount_total || 0) / 100

      if (paymentIntentId) {
        const intent = await stripe.paymentIntents.retrieve(paymentIntentId, { expand: ['latest_charge.balance_transaction'] })
        const charge = typeof intent.latest_charge === 'object' ? intent.latest_charge as Stripe.Charge : null
        const transaction = charge && typeof charge.balance_transaction === 'object' ? charge.balance_transaction as Stripe.BalanceTransaction : null
        if (transaction) {
          fee = Number(transaction.fee || 0) / 100
          net = Number(transaction.net || 0) / 100
        }
      }

      const amount = Number(session.amount_total || 0) / 100
      const paymentId = paymentIntentId || session.id
      const paymentRecord = {
        owner_id: ownerId,
        invoice_id: invoiceId,
        job_id: invoice.job_id || null,
        amount,
        payment_date: new Date().toISOString().slice(0, 10),
        method: 'card',
        reference: paymentId,
        notes: `Stripe Checkout ${session.id}`,
        provider: 'stripe',
        provider_payment_id: paymentId,
        provider_session_id: session.id,
        processing_fee: fee,
        net_amount: net,
        status: 'succeeded',
      }
      const saved = await admin.from('payments').upsert(paymentRecord, { onConflict: 'provider,provider_payment_id', ignoreDuplicates: true })
      if (saved.error) throw saved.error

      const stripePayments = await admin.from('payments').select('amount, processing_fee, net_amount').eq('invoice_id', invoiceId).eq('provider', 'stripe').eq('status', 'succeeded')
      if (stripePayments.error) throw stripePayments.error
      const stripePaid = (stripePayments.data || []).reduce((sum, item) => sum + Number(item.amount || 0), 0)
      const stripeFees = (stripePayments.data || []).reduce((sum, item) => sum + Number(item.processing_fee || 0), 0)
      const stripeNet = (stripePayments.data || []).reduce((sum, item) => sum + Number(item.net_amount || 0), 0)
      const paid = Math.min(Number(invoice.amount || 0), Number(invoice.manual_paid || 0) + stripePaid)
      const invoiceUpdate = await admin.from('invoices').update({
        paid,
        status: paid >= Number(invoice.amount || 0) ? 'paid' : 'partial',
        stripe_payment_intent_id: paymentIntentId || null,
        stripe_checkout_session_id: session.id,
        stripe_status: 'paid',
        stripe_fee: stripeFees,
        stripe_net: stripeNet,
        last_payment_at: new Date().toISOString(),
      }).eq('id', invoiceId)
      if (invoiceUpdate.error) throw invoiceUpdate.error

      await admin.from('stripe_webhook_events').insert({ id: event.id, owner_id: ownerId, event_type: event.type })
    } else if (event.type === 'checkout.session.expired') {
      const session = event.data.object as Stripe.Checkout.Session
      if (session.metadata?.invoice_id) await admin.from('invoices').update({ stripe_status: 'expired' }).eq('id', session.metadata.invoice_id)
      await admin.from('stripe_webhook_events').insert({ id: event.id, owner_id: session.metadata?.owner_id || null, event_type: event.type })
    }
    return Response.json({ received: true })
  } catch (error) {
    console.error('stripe-webhook processing failed', event.id, error)
    return new Response('Webhook processing failed', { status: 500 })
  }
})
