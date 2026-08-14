import { supabase } from './supabase'

export async function createStripeCheckout(payload) {
  if (!supabase) throw new Error('Card payments are available in the live Operations Center only.')
  const { data, error } = await supabase.functions.invoke('create-stripe-checkout', { body: payload })
  if (error) throw new Error(error.message || 'Unable to create the Stripe checkout.')
  if (!data?.url) throw new Error(data?.error || 'Stripe did not return a checkout link.')
  return data
}

