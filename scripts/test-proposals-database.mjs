// Isolated PostgreSQL-compatible integration checks. NEVER connects to Supabase.
// Install @electric-sql/pglite in a separate test directory and set PROPOSAL_PGLITE_PATH.
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import { newProposal } from '../src/lib/proposals.js'
const { PGlite } = await import(process.env.PROPOSAL_PGLITE_PATH ? pathToFileURL(process.env.PROPOSAL_PGLITE_PATH).href : '@electric-sql/pglite')
const db = new PGlite()
const owner = '10000000-0000-4000-8000-000000000001', other = '20000000-0000-4000-8000-000000000001', crew = '30000000-0000-4000-8000-000000000001'
await db.exec(`
create role anon; create role authenticated;
create schema auth; create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
grant usage on schema auth to anon,authenticated; grant execute on function auth.uid() to anon,authenticated;
create table public.profiles(id uuid primary key,owner_id uuid,role text,active boolean default true);
create function public.current_owner_id() returns uuid language sql stable security definer as $$select owner_id from public.profiles where id=auth.uid()$$;
create function public.my_role() returns text language sql stable security definer as $$select role from public.profiles where id=auth.uid() and active$$;
create function public.touch_updated_at() returns trigger language plpgsql as $$begin new.updated_at=now();return new;end$$;
create table public.company_settings(owner_id uuid primary key,legal_name text,phone text,email text,website text,address text);
create table public.customers(id uuid primary key default gen_random_uuid(),owner_id uuid,full_name text,phone text,email text,service_address text,notes text);
create table public.jobs(id uuid primary key default gen_random_uuid(),owner_id uuid,customer_id uuid,number text,title text,status text,address text,foreman_notes text,unique(owner_id,number));
create table public.audit_log(id serial,owner_id uuid,actor_id uuid,action text,entity_type text,entity_id uuid,metadata jsonb);
insert into auth.users values ('${owner}'),('${other}'),('${crew}');
insert into public.profiles values ('${owner}','${owner}','owner',true),('${other}','${other}','owner',true),('${crew}','${owner}','crew',true);
insert into public.company_settings values ('${owner}','Valid Tree Service LLC','832-445-6535','office@example.test','example.test','Houston');
`)
await db.exec(await readFile(new URL('../supabase/migrations/014_commercial_proposals.sql', import.meta.url), 'utf8'))
let checks = 0
async function asUser(id, role = 'authenticated') { await db.exec('reset role'); await db.query("select set_config('test.uid',$1,false)", [id]); await db.exec('set role ' + role) }
async function call(name, args = []) { return (await db.query('select * from public.' + name + '(' + args.map((_, i) => '$' + (i + 1)).join(',') + ')', args)).rows[0] }
async function rejects(fn, pattern) { await assert.rejects(fn, pattern); checks++ }
function okay(condition, message) { assert.ok(condition, message); checks++ }
function draft() {
  const p = newProposal()
  p.project_name = 'Isolated commercial test'; p.project_address = 'Houston site'; p.contact_name = 'Authorized Contact'; p.company_name = 'Test GC'
  p.content.sections = [{ id: crypto.randomUUID(), title: 'Scope', body: 'Designated clearing.' }]
  p.content.payment_terms = 'Milestone payments by written agreement.'; p.content.lump_sum = '100.10'
  p.internal_notes = 'PRIVATE_INTERNAL_SECRET'; p.content.internal_cost = 'PRIVATE_COST_SECRET'
  return p
}
try {
  await asUser(owner)
  const p = draft(), saved = await call('save_commercial_proposal', [p.id, 0, p])
  okay(saved.number.startsWith('PROP-'), 'Separate proposal number')
  okay(saved.amount === '100.10' || Number(saved.amount) === 100.10, 'Exact server price')
  okay(!JSON.stringify(saved.content).includes('PRIVATE_COST_SECRET'), 'Unknown costing fields removed')
  await rejects(() => call('save_commercial_proposal', [p.id, 0, p]), /changed|draft/i)
  const more = await Promise.all(Array.from({ length: 6 }, () => { const d = draft(); return call('save_commercial_proposal', [d.id, 0, d]) }))
  okay(new Set([saved, ...more].map(r => r.number)).size === 7, 'Distinct numbers for queued concurrent saves')
  const itemized = draft()
  itemized.content.pricing_mode = 'itemized'; itemized.content.lines = [{ label: 'Clearing', amount: '10.10', included: false }, { label: 'Demo', amount: '20.20', included: false }, { label: 'Hauling', amount: '999', included: true }]
  const itemRow = await call('save_commercial_proposal', [itemized.id, 0, itemized])
  okay(Number(itemRow.amount) === 30.30, 'Included line excluded from sum')
  const invalid = draft(); invalid.content.lump_sum = '-2'
  await rejects(() => call('save_commercial_proposal', [invalid.id, 0, invalid]), /Invalid lump/i)
  const issue = await call('publish_commercial_proposal', [p.id, saved.revision])
  okay(issue.status === 'sent' && issue.share_token, 'Issued frozen customer link')
  okay(!JSON.stringify(issue.published_snapshot).includes('PRIVATE_'), 'Internal data excluded from public snapshot')
  await rejects(() => call('save_commercial_proposal', [p.id, issue.revision, p]), /changed|draft/i)
  await rejects(() => db.query("update public.commercial_proposals set amount=1 where id=$1", [p.id]), /permission denied/i)
  await asUser(other)
  okay((await db.query('select id from public.commercial_proposals')).rows.length === 0, 'RLS isolates other company')
  await rejects(() => call('reopen_commercial_proposal', [p.id, issue.revision]), /Accepted|changed/i)
  await asUser(crew)
  okay((await db.query('select id from public.commercial_proposals')).rows.length === 0, 'Crew cannot read commercial prices')
  await rejects(() => call('save_commercial_proposal', [crypto.randomUUID(), 0, p]), /owner or office/i)
  await asUser('', 'anon')
  await rejects(() => db.query('select * from public.commercial_proposals'), /permission denied/i)
  await rejects(() => call('proposal_customer_snapshot', [null]), /permission denied/i)
  const viewed = (await call('get_commercial_proposal', [issue.share_token])).get_commercial_proposal
  okay(viewed.status === 'viewed', 'Customer access marks viewed')
  await rejects(() => call('respond_commercial_proposal', [issue.share_token, issue.revision, 'accept', 'Jane Doe', 'Test GC', 'Jane Doe', false, '']), /consent/i)
  const accepted = (await call('respond_commercial_proposal', [issue.share_token, issue.revision, 'accept', 'Jane Doe', 'Test GC', 'Jane Doe', true, ''])).respond_commercial_proposal
  okay(accepted.status === 'accepted' && accepted.acceptance.document_hash.length === 64, 'Acceptance and snapshot hash recorded')
  await rejects(() => call('respond_commercial_proposal', [issue.share_token, issue.revision, 'decline', '', '', '', false, '']), /no longer/i)
  await asUser(owner)
  await rejects(() => call('reopen_commercial_proposal', [p.id, issue.revision]), /Accepted/i)
  const job1 = (await call('convert_commercial_proposal', [p.id])).convert_commercial_proposal
  const job2 = (await call('convert_commercial_proposal', [p.id])).convert_commercial_proposal
  okay(job1 === job2, 'Conversion is idempotent')
  await db.exec('reset role')
  const job = (await db.query('select * from public.jobs where id=$1', [job1])).rows[0]
  okay(job.status === 'unscheduled' && job.address === p.project_address && Number(job.proposal_amount) === 100.10, 'Job fields transferred')
  okay(job.foreman_notes.includes('PRIVATE_INTERNAL_SECRET') && job.proposal_snapshot.content.payment_terms === p.content.payment_terms, 'Internal brief and payment snapshot retained')
  await asUser(owner)
  const withdraw = await call('publish_commercial_proposal', [more[0].id, more[0].revision])
  await call('reopen_commercial_proposal', [withdraw.id, withdraw.revision])
  await asUser('', 'anon')
  await rejects(() => call('get_commercial_proposal', [withdraw.share_token]), /unavailable/i)
  await asUser(owner)
  const exp = await call('publish_commercial_proposal', [more[1].id, more[1].revision])
  await db.exec('reset role')
  await db.query("update public.commercial_proposals set proposal_date=current_date-3,expires_at=current_date-1 where id=$1", [exp.id])
  await asUser('', 'anon')
  await rejects(() => call('respond_commercial_proposal', [exp.share_token, exp.revision, 'accept', 'Jane Doe', 'Test GC', 'Jane Doe', true, '']), /expired/i)
  const expired = (await call('get_commercial_proposal', [exp.share_token])).get_commercial_proposal
  okay(expired.status === 'expired', 'Expired link not signable')
  console.log('PASS: ' + checks + ' isolated database checks: numbering, snapshots, RLS, signatures, expiration, revocation and conversion.')
} finally { await db.close() }
