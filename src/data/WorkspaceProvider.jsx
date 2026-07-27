import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../components/AuthProvider'
import { supabase } from '../lib/supabase'

const Store = createContext(null)
const KEY = 'vts-operations-final-demo'
const uid = () => crypto.randomUUID()
const now = new Date()
const addDays = (n) => new Date(now.getTime() + n * 86400000).toISOString().slice(0, 10)

const defaultSettings = {
  legalName: 'Valid Tree Service LLC', displayName: 'Valid Tree Service',
  phone: '', email: 'validtreeservice@gmail.com', website: 'validtreeservice.com',
  address: 'Houston, Texas', tagline: 'Safe. Skilled. Reliable.', depositPercent: 30,
  paymentTerms: 'Balance is due upon completion unless otherwise stated in writing.', reviewUrl: ''
}

const seed = {
  customers: [
    { id: 'c1', full_name: 'Maria Hernandez', phone: '(713) 555-0142', email: 'maria@example.com', service_address: '1428 Garden Oaks Blvd, Houston, TX', notes: 'Prefers text messages.', created_at: addDays(-24) },
    { id: 'c2', full_name: 'James Walker', phone: '(832) 555-0186', email: 'james@example.com', service_address: '8807 Briar Forest Dr, Houston, TX', notes: 'Gate code in job notes.', created_at: addDays(-18) },
    { id: 'c3', full_name: 'Oakridge HOA', phone: '(281) 555-0104', email: 'board@oakridge.example', service_address: 'Oakridge Community, Houston, TX', notes: 'Commercial account. Certificate of insurance required.', created_at: addDays(-40) }
  ],
  estimates: [
    { id: 'e1', number: 'EST-2026-0041', customer_id: 'c1', title: 'Oak removal and stump grinding', amount: 3850, status: 'sent', created_at: addDays(-8), expires_at: addDays(22) },
    { id: 'e2', number: 'EST-2026-0042', customer_id: 'c2', title: 'Canopy reduction and deadwood removal', amount: 1750, status: 'approved', created_at: addDays(-3), expires_at: addDays(27) }
  ],
  contracts: [
    { id: 'ct1', contract_number: 'VTS-2026-0038', customer_id: 'c2', title: 'Tree Service Agreement', scope_of_work: 'Crown-reduce two mature live oaks over the residence.\nRemove dead and hazardous limbs.\nRaise canopy over driveway to approximately 14 feet.\nHaul all generated debris and leave work area broom clean.', total_price: 1750, deposit: 525, status: 'sent', service_date: addDays(5), created_at: addDays(-2), sign_token: 'demo-sign-0038', signed_at: null, signature_name: null, signature_data: null },
    { id: 'ct2', contract_number: 'VTS-2026-0037', customer_id: 'c3', title: 'Community Tree Maintenance Agreement', scope_of_work: 'Remove four marked declining trees.\nGrind stumps 6–8 inches below grade.\nChip and haul debris.\nCoordinate work zones with HOA manager.', total_price: 8400, deposit: 2520, status: 'signed', service_date: addDays(1), created_at: addDays(-6), sign_token: 'demo-sign-0037', signed_at: addDays(-4), signature_name: 'Oakridge HOA', signature_data: null }
  ],
  jobs: [
    { id: 'j1', number: 'JOB-2026-0088', customer_id: 'c3', contract_id: 'ct2', title: 'Oakridge HOA removals', crew_id: 'crew1', date: addDays(1), start_time: '07:30', status: 'scheduled', address: 'Oakridge Community, Houston, TX', foreman_notes: 'Meet HOA manager at clubhouse. Cone off walking trail. Upload before/after photos.', equipment: 'Crane, chipper, stump grinder', completion_notes: '', photos: [] },
    { id: 'j2', number: 'JOB-2026-0089', customer_id: 'c2', contract_id: 'ct1', title: 'Walker oak pruning', crew_id: 'crew2', date: addDays(5), start_time: '08:00', status: 'scheduled', address: '8807 Briar Forest Dr, Houston, TX', foreman_notes: 'Call customer 30 minutes before arrival. Protect driveway.', equipment: 'Bucket truck, chipper', completion_notes: '', photos: [] }
  ],
  invoices: [
    { id: 'i1', number: 'INV-2026-0069', customer_id: 'c3', job_id: 'j1', amount: 8400, paid: 2520, status: 'partial', due_date: addDays(2), created_at: addDays(-4) },
    { id: 'i2', number: 'INV-2026-0064', customer_id: 'c1', job_id: null, amount: 950, paid: 0, status: 'overdue', due_date: addDays(-7), created_at: addDays(-22) }
  ],
  crews: [
    { id: 'crew1', name: 'Crew One', foreman: 'Carlos', phone: '(713) 555-0111', color: '#80a84c' },
    { id: 'crew2', name: 'Crew Two', foreman: 'Miguel', phone: '(713) 555-0112', color: '#5c8f70' },
    { id: 'crew3', name: 'Crew Three', foreman: 'Unassigned', phone: '', color: '#a8874c' },
    { id: 'crew4', name: 'Crew Four', foreman: 'Unassigned', phone: '', color: '#777777' }
  ],
  tasks: [
    { id: 't1', title: 'Follow up on Hernandez estimate', type: 'follow_up', due_date: addDays(0), assigned_label: 'Office', done: false, customer_id: 'c1' },
    { id: 't2', title: 'Confirm Oakridge access and parking', type: 'job_confirmation', due_date: addDays(0), assigned_label: 'Carlos', done: false, customer_id: 'c3' },
    { id: 't3', title: 'Collect Walker contract signature', type: 'signature', due_date: addDays(2), assigned_label: 'Office', done: false, customer_id: 'c2' }
  ],
  job_photos: [], settings: defaultSettings
}

const collections = ['customers', 'estimates', 'contracts', 'jobs', 'invoices', 'crews', 'tasks', 'job_photos']
const settingsFromDb = (s) => s ? ({
  legalName: s.legal_name, displayName: s.display_name, phone: s.phone || '', email: s.email || '',
  website: s.website || '', address: s.address || '', tagline: s.tagline || '',
  depositPercent: Number(s.deposit_percent || 30), paymentTerms: s.payment_terms || '', reviewUrl: s.review_url || ''
}) : defaultSettings
const settingsToDb = (s) => ({ legal_name: s.legalName, display_name: s.displayName, phone: s.phone, email: s.email, website: s.website, address: s.address, tagline: s.tagline, deposit_percent: Number(s.depositPercent || 30), payment_terms: s.paymentTerms, review_url: s.reviewUrl })

export function WorkspaceProvider({ children }) {
  const { user, isDemo } = useAuth()
  const [data, setData] = useState(() => { try { return JSON.parse(localStorage.getItem(KEY)) || seed } catch { return seed } })
  const [loading, setLoading] = useState(false)
  const [syncError, setSyncError] = useState('')
  const [ownerId, setOwnerId] = useState(null)

  const loadLive = useCallback(async () => {
    if (!supabase || !user || isDemo) return
    setLoading(true); setSyncError('')
    const { data: liveOwnerId } = await supabase.rpc('current_owner_id')
    setOwnerId(liveOwnerId || user.id)
    const results = await Promise.all(collections.map((name) => supabase.from(name).select('*').order('created_at', { ascending: false })))
    const settingsResult = await supabase.from('company_settings').select('*').maybeSingle()
    const next = { settings: settingsFromDb(settingsResult.data) }
    results.forEach((result, index) => {
      if (result.error) setSyncError(result.error.message)
      next[collections[index]] = result.data || []
    })
    setData(next); setLoading(false)
  }, [user, isDemo])

  useEffect(() => {
    if (isDemo || !user) localStorage.setItem(KEY, JSON.stringify(data))
  }, [data, isDemo, user])
  useEffect(() => { loadLive() }, [loadLive])

const add = (collection, item) => {
  const record = {
    id: uid(),
    created_at: new Date().toISOString(),
    ...item,
  };

  setData((current) => ({
    ...current,
    [collection]: [record, ...(current[collection] || [])],
  }));

  if (!isDemo && supabase && user) {
    const payload = {
      ...record,
      owner_id: ownerId || user.id,
    };

    supabase
      .from(collection)
      .insert(payload)
      .then(({ error }) => {
        if (error) {
          console.error(`Failed to add ${collection}:`, error);
          setSyncError(error.message);
          loadLive();
        }
      });
  }

  return record;
};

const addAndWait = async (collection, item) => {
  const record = {
    id: uid(),
    created_at: new Date().toISOString(),
    ...item,
  };

  if (isDemo || !supabase || !user) {
    setData((current) => ({
      ...current,
      [collection]: [record, ...(current[collection] || [])],
    }));

    return record;
  }

  const payload = {
    ...record,
    owner_id: ownerId || user.id,
  };

  const { data: savedRecord, error } = await supabase
    .from(collection)
    .insert(payload)
    .select()
    .single();

  if (error) {
    console.error(`Failed to add ${collection}:`, error);
    setSyncError(error.message);
    throw error;
  }

  setData((current) => ({
    ...current,
    [collection]: [
      savedRecord,
      ...(current[collection] || []).filter(
        (existing) => existing.id !== savedRecord.id
      ),
    ],
  }));

  return savedRecord;
};

const update = (collection, id, patch) => {
  setData((current) => ({
    ...current,
    [collection]: (current[collection] || []).map((item) =>
      item.id === id ? { ...item, ...patch } : item
    ),
  }));

  if (!isDemo && supabase) {
    supabase
      .from(collection)
      .update(patch)
      .eq("id", id)
      .then(({ error }) => {
        if (error) {
          console.error(`Failed to update ${collection}:`, error);
          setSyncError(error.message);
          loadLive();
        }
      });
  }
};

const updateAndWait = async (collection, id, patch) => {
  if (isDemo || !supabase) {
    setData((current) => ({
      ...current,
      [collection]: (current[collection] || []).map((item) =>
        item.id === id ? { ...item, ...patch } : item
      ),
    }));

    return;
  }

  const { error } = await supabase
    .from(collection)
    .update(patch)
    .eq("id", id);

  if (error) {
    console.error(`Failed to update ${collection}:`, error);
    setSyncError(error.message);
    throw error;
  }

  setData((current) => ({
    ...current,
    [collection]: (current[collection] || []).map((item) =>
      item.id === id ? { ...item, ...patch } : item
    ),
  }));
};

const remove = (collection, id) => {
  setData((current) => ({
    ...current,
    [collection]: (current[collection] || []).filter(
      (item) => item.id !== id
    ),
  }));

  if (!isDemo && supabase) {
    supabase
      .from(collection)
      .delete()
      .eq("id", id)
      .then(({ error }) => {
        if (error) {
          console.error(`Failed to delete ${collection}:`, error);
          setSyncError(error.message);
          loadLive();
        }
      });
  }
};

  const saveSettings = (settings) => {
    setData((d) => ({ ...d, settings }))
    if (!isDemo && supabase && user) supabase.from('company_settings').upsert({ owner_id: ownerId || user.id, ...settingsToDb(settings) }).then(({ error }) => { if (error) setSyncError(error.message) })
  }

  const customer = (id) => data.customers?.find((x) => x.id === id)
  const crew = (id) => data.crews?.find((x) => x.id === id)
  const reset = () => setData(seed)
const value = useMemo(
  () => ({
    data,
    setData,
    add,
    addAndWait,
    update,
    updateAndWait,
    remove,
    customer,
    crew,
    reset,
    saveSettings,
    loading,
    syncError,
    refresh: loadLive,
    isDemo,
  }),
  [data, loading, syncError, loadLive, isDemo, ownerId]
);
  return <Store.Provider value={value}>{children}</Store.Provider>
}
export const useWorkspace = () => useContext(Store)
