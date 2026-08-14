import { createContext, useContext, useEffect, useState } from 'react'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
const AuthContext = createContext(null)

async function ensureFirstOwner(user) {
  if (!supabase || !user) return
  const { data } = await supabase.from('profiles').select('id').eq('id', user.id).maybeSingle()
  if (!data) {
    const { error } = await supabase.rpc('bootstrap_owner', { p_full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Owner' })
    // Once an owner exists, new authenticated users remain unlinked until the
    // owner connects their email from Team & Crews. That is expected.
    if (error && !/already been completed/i.test(error.message || '')) throw error
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(isSupabaseConfigured)
  useEffect(() => {
    if (!supabase) { setLoading(false); return }
    supabase.auth.getSession().then(async ({ data }) => {
      const current = data.session?.user || null
      if (current) await ensureFirstOwner(current)
      setUser(current); setLoading(false)
    })
    const { data } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const current = session?.user || null
      if (current) await ensureFirstOwner(current)
      setUser(current); setLoading(false)
    })
    return () => data.subscription.unsubscribe()
  }, [])
  const signIn = async (email, password) => {
    if (!supabase) {
      return { error: new Error('The live workspace connection is unavailable. Please refresh the page or contact support. Your login was not switched to demo mode.') }
    }
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (data?.user) await ensureFirstOwner(data.user)
    return { error }
  }
  const signOut = async () => { if (supabase) await supabase.auth.signOut(); setUser(null) }
  const demo = () => setUser({ id: 'demo-owner', email: 'owner@validtreeservice.com', user_metadata: { full_name: 'Owner' } })
  return <AuthContext.Provider value={{ user, loading, signIn, signOut, demo, isDemo: user?.id === 'demo-owner' }}>{children}</AuthContext.Provider>
}
export const useAuth = () => useContext(AuthContext)
