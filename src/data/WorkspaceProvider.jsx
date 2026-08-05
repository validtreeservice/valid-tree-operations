import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../components/AuthProvider'
import { supabase } from '../lib/supabase'

const Store = createContext(null)
const KEY = 'vts-operations-v2-demo'
const uid = () => crypto.randomUUID()
const iso = () => new Date().toISOString()
const today = () => iso().slice(0, 10)
const addDays = (days) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10)

const defaultSettings = {
  legalName: 'Valid Tree Service LLC', displayName: 'Valid Tree Service',
  phone: '', email: 'validtreeservice@gmail.com', website: 'validtreeservice.com',
  address: 'Houston, Texas', tagline: 'Safe. Skilled. Reliable.', depositPercent: 30,
  paymentTerms: 'Balance is due upon completion unless otherwise stated in writing.', reviewUrl: '',
}

const seed = {
  customers: [
    { id: 'c1', full_name: 'Maria Hernandez', phone: '(713) 555-0142', email: 'maria@example.com', service_address: '1428 Garden Oaks Blvd, Houston, TX', notes: 'Prefers text messages.', created_at: addDays(-24) },
    { id: 'c2', full_name: 'James Walker', phone: '(832) 555-0186', email: 'james@example.com', service_address: '8807 Briar Forest Dr, Houston, TX', notes: 'Gate code in job notes.', created_at: addDays(-18) },
    { id: 'c3', full_name: 'Oakridge HOA', phone: '(281) 555-0104', email: 'board@oakridge.example', service_address: 'Oakridge Community, Houston, TX', notes: 'Commercial account.', created_at: addDays(-40) },
  ],
  estimates: [
    { id: 'e1', number: 'EST-2026-0041', customer_id: 'c1', title: 'Oak removal and stump grinding', amount: 3850, status: 'sent', created_at: addDays(-8), expires_at: addDays(22) },
    { id: 'e2', number: 'EST-2026-0042', customer_id: 'c2', title: 'Canopy reduction and deadwood removal', amount: 1750, status: 'approved', created_at: addDays(-3), expires_at: addDays(27) },
  ],
  contracts: [
    { id: 'ct1', contract_number: 'VTS-2026-0038', customer_id: 'c2', title: 'Tree Service Agreement', scope_of_work: 'Crown-reduce two mature live oaks.\nRemove hazardous limbs.\nHaul generated debris.', total_price: 1750, deposit: 525, status: 'sent', service_date: addDays(5), created_at: addDays(-2), sign_token: 'demo-sign-0038' },
    { id: 'ct2', contract_number: 'VTS-2026-0037', customer_id: 'c3', title: 'Community Tree Maintenance Agreement', scope_of_work: 'Remove four declining trees.\nGrind stumps.\nChip and haul debris.', total_price: 8400, deposit: 2520, status: 'signed', service_date: addDays(1), created_at: addDays(-6), sign_token: 'demo-sign-0037', signed_at: addDays(-4), signature_name: 'Oakridge HOA' },
  ],
  crews: [
    { id: 'crew1', name: 'Crew One', foreman: 'Carlos', phone: '(713) 555-0111', color: '#80a84c', created_at: addDays(-100) },
    { id: 'crew2', name: 'Crew Two', foreman: 'Miguel', phone: '(713) 555-0112', color: '#5c8f70', created_at: addDays(-90) },
  ],
  jobs: [
    { id: 'j1', number: 'JOB-2026-0088', customer_id: 'c3', contract_id: 'ct2', title: 'Oakridge HOA removals', crew_id: 'crew1', date: addDays(1), start_time: '07:30', status: 'in progress', address: 'Oakridge Community, Houston, TX', equipment: 'Chipper, stump grinder', completion_percent: 45, acres: 1.2, project_type: 'tree_service', created_at: addDays(-5) },
    { id: 'j2', number: 'JOB-2026-0089', customer_id: 'c2', contract_id: 'ct1', title: 'Walker oak pruning', crew_id: 'crew2', date: addDays(5), start_time: '08:00', status: 'scheduled', address: '8807 Briar Forest Dr, Houston, TX', equipment: 'Bucket truck, chipper', completion_percent: 0, project_type: 'tree_service', created_at: addDays(-2) },
  ],
  invoices: [
    { id: 'i1', number: 'INV-2026-0069', customer_id: 'c3', job_id: 'j1', amount: 8400, paid: 2520, status: 'partial', due_date: addDays(2), created_at: addDays(-4) },
  ],
  tasks: [{ id: 't1', title: 'Confirm Oakridge access', type: 'job_confirmation', due_date: today(), assigned_label: 'Carlos', done: false, customer_id: 'c3', created_at: addDays(-1) }],
  job_photos: [],
  job_budgets: [
    { id: 'b1', job_id: 'j1', category: 'labor', description: 'Crew labor', estimated_amount: 2200, created_at: addDays(-4) },
    { id: 'b2', job_id: 'j1', category: 'fuel', description: 'Truck and equipment fuel', estimated_amount: 650, created_at: addDays(-4) },
  ],
  expenses: [{ id: 'x1', job_id: 'j1', category: 'materials', vendor: 'Local Supply', description: 'Protection materials', amount: 210, expense_date: today(), payment_method: 'business card', created_at: iso() }],
  time_entries: [{ id: 'te1', job_id: 'j1', crew_id: 'crew1', worker_name: 'Carlos', worker_type: 'contractor', work_date: today(), regular_hours: 8, overtime_hours: 0, hourly_rate: 35, overtime_multiplier: 1.5, created_at: iso() }],
  daily_reports: [], production_logs: [], equipment_assignments: [],
  fuel_logs: [{ id: 'f1', job_id: 'j1', equipment_id: 'eq1', fuel_date: today(), fuel_type: 'diesel', gallons: 42, price_per_gallon: 3.45, total_cost: 144.9, vendor: 'Fuel Stop', created_at: iso() }],
  equipment: [{ id: 'eq1', name: 'Brush Chipper', type: 'chipper', make: 'Bandit', model: '', ownership: 'financed', status: 'assigned', current_hours: 1280, hourly_cost: 42, payment_amount: 2200, payment_frequency: 'monthly', next_service_hours: 1300, created_at: addDays(-200) }],
  maintenance_records: [], rentals: [], change_orders: [], payments: [],
  workers: [],
  worker_payments: [],
  estimator_scenarios: [], settings: defaultSettings,
}

const collections = [
  'customers', 'estimates', 'contracts', 'jobs', 'invoices', 'crews', 'tasks', 'job_photos',
  'job_budgets', 'expenses', 'time_entries', 'daily_reports', 'production_logs', 'equipment',
  'equipment_assignments', 'fuel_logs', 'maintenance_records', 'rentals', 'change_orders',
  'payments', 'workers', 'worker_payments', 'estimator_scenarios',
]

const settingsFromDb = (s) => s ? ({
  legalName: s.legal_name, displayName: s.display_name, phone: s.phone || '', email: s.email || '',
  website: s.website || '', address: s.address || '', tagline: s.tagline || '',
  depositPercent: Number(s.deposit_percent || 30), paymentTerms: s.payment_terms || '', reviewUrl: s.review_url || '',
}) : defaultSettings
const settingsToDb = (s) => ({ legal_name: s.legalName, display_name: s.displayName, phone: s.phone, email: s.email, website: s.website, address: s.address, tagline: s.tagline, deposit_percent: Number(s.depositPercent || 30), payment_terms: s.paymentTerms, review_url: s.reviewUrl })

export function WorkspaceProvider({ children }) {
  const { user, isDemo } = useAuth()
  const [data, setData] = useState(() => { try { return { ...seed, ...JSON.parse(localStorage.getItem(KEY)) } } catch { return seed } })
  const [loading, setLoading] = useState(false)
  const [syncError, setSyncError] = useState('')
  const [ownerId, setOwnerId] = useState(null)

  const loadLive = useCallback(async () => {
    if (!supabase || !user || isDemo) return
    setLoading(true); setSyncError('')
    try {
      const { data: profile, error: profileError } = await supabase.from('profiles').select('owner_id, role, active').eq('id', user.id).maybeSingle()
      if (profileError) throw profileError
      if (!profile) throw new Error('This login is not connected to the Valid Tree Service company workspace. The owner must open Team & Crews, enter this login email under Staff Access, choose Office, and click Connect staff account. Then sign out and sign back in.')
      if (!profile.active) throw new Error('This staff login is inactive. Ask the company owner to reactivate it before continuing.')
      const { data: liveOwnerId, error: ownerError } = await supabase.rpc('current_owner_id')
      if (ownerError) throw ownerError
      const resolvedOwner = liveOwnerId || user.id
      setOwnerId(resolvedOwner)
      const results = await Promise.all(collections.map((name) => supabase.from(name).select('*').order('created_at', { ascending: false })))
      const settingsResult = await supabase.from('company_settings').select('*').maybeSingle()
      const next = { settings: settingsFromDb(settingsResult.data) }
      results.forEach((result, index) => {
        if (result.error) throw new Error(`${collections[index]}: ${result.error.message}`)
        next[collections[index]] = result.data || []
      })
      setData(next)
    } catch (error) {
      setSyncError(error.message || 'Unable to synchronize operations data.')
    } finally {
      setLoading(false)
    }
  }, [user, isDemo])

  useEffect(() => { if (isDemo || !user) localStorage.setItem(KEY, JSON.stringify(data)) }, [data, isDemo, user])
  useEffect(() => { loadLive() }, [loadLive])

  const mutate = useCallback(async (action, collection, idOrItem, patch) => {
    setSyncError('')
    if (action === 'add') {
      const record = { id: uid(), created_at: iso(), ...idOrItem }
      setData((current) => ({ ...current, [collection]: [record, ...(current[collection] || [])] }))
      if (!isDemo && supabase && user) {
        const { error } = await supabase.from(collection).insert({ ...record, owner_id: ownerId || user.id })
        if (error) { setSyncError(error.message); await loadLive(); throw error }
      }
      return record
    }
    if (action === 'update') {
      setData((current) => ({ ...current, [collection]: current[collection].map((item) => item.id === idOrItem ? { ...item, ...patch } : item) }))
      if (!isDemo && supabase) {
        const { error } = await supabase.from(collection).update(patch).eq('id', idOrItem)
        if (error) { setSyncError(error.message); await loadLive(); throw error }
      }
      return { id: idOrItem, ...patch }
    }
    setData((current) => ({ ...current, [collection]: current[collection].filter((item) => item.id !== idOrItem) }))
    if (!isDemo && supabase) {
      const { error } = await supabase.from(collection).delete().eq('id', idOrItem)
      if (error) { setSyncError(error.message); await loadLive(); throw error }
    }
    return true
  }, [isDemo, user, ownerId, loadLive])

  // Legacy methods remain synchronous so existing estimate/contract/job modals
  // can immediately select the record they just created.
  const add = (collection, item) => {
    const record = { id: uid(), created_at: iso(), ...item }
    setData((current) => ({ ...current, [collection]: [record, ...(current[collection] || [])] }))
    if (!isDemo && supabase && user) supabase.from(collection).insert({ ...record, owner_id: ownerId || user.id }).then(({ error }) => { if (error) { setSyncError(error.message); loadLive() } })
    return record
  }
  const update = (collection, id, patch) => {
    setData((current) => ({ ...current, [collection]: current[collection].map((item) => item.id === id ? { ...item, ...patch } : item) }))
    if (!isDemo && supabase) supabase.from(collection).update(patch).eq('id', id).then(({ error }) => { if (error) { setSyncError(error.message); loadLive() } })
  }
  const remove = (collection, id) => {
    setData((current) => ({ ...current, [collection]: current[collection].filter((item) => item.id !== id) }))
    if (!isDemo && supabase) supabase.from(collection).delete().eq('id', id).then(({ error }) => { if (error) { setSyncError(error.message); loadLive() } })
  }
  const uploadReceipt = async (file, jobId = 'general') => {
    if (isDemo || !supabase || !user) return URL.createObjectURL(file)
    const path = `${ownerId || user.id}/${jobId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '-')}`
    const { error } = await supabase.storage.from('receipts').upload(path, file, { upsert: false })
    if (error) throw error
    return path
  }
  const getReceiptUrl = async (path) => {
    if (!path) throw new Error('No receipt is attached to this expense.')
    if (path.startsWith('blob:') || path.startsWith('data:') || path.startsWith('http')) return path
    if (!supabase) throw new Error('Receipt storage is not configured.')
    const { data: signed, error } = await supabase.storage.from('receipts').createSignedUrl(path, 300)
    if (error) throw error
    return signed.signedUrl
  }
  const linkStaff = async ({ email, role = 'office', fullName = '' }) => {
    if (!supabase || isDemo) throw new Error('Staff linking is available in the live workspace only.')
    const { data: profile, error } = await supabase.rpc('owner_link_staff', {
      p_email: email.trim(), p_role: role, p_full_name: fullName.trim() || null,
    })
    if (error) throw error
    return profile
  }
  const saveSettings = async (settings) => {
    setData((current) => ({ ...current, settings }))
    if (!isDemo && supabase && user) {
      const { error } = await supabase.from('company_settings').upsert({ owner_id: ownerId || user.id, ...settingsToDb(settings) })
      if (error) { setSyncError(error.message); throw error }
    }
  }

  const value = useMemo(() => ({
    data, setData, add, update, remove,
    addAndWait: (collection, item) => mutate('add', collection, item),
    updateAndWait: (collection, id, patch) => mutate('update', collection, id, patch),
    removeAndWait: (collection, id) => mutate('remove', collection, id),
    customer: (id) => data.customers?.find((item) => item.id === id),
    crew: (id) => data.crews?.find((item) => item.id === id),
    job: (id) => data.jobs?.find((item) => item.id === id),
    equipmentItem: (id) => data.equipment?.find((item) => item.id === id),
    reset: () => setData(seed), saveSettings, uploadReceipt, getReceiptUrl, linkStaff,
    loading, syncError, refresh: loadLive, isDemo,
  }), [data, loading, syncError, loadLive, isDemo])

  return <Store.Provider value={value}>{children}</Store.Provider>
}

export const useWorkspace = () => useContext(Store)
