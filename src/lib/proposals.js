// Commercial proposals are deliberately independent of residential estimates.
export const PROPOSAL_TYPES = ['Commercial Land Clearing', 'Commercial Tree Removal', 'Demolition & Site Clearing', 'Storm/Emergency Work', 'Large Residential Project', 'Custom/Blank Proposal']
export const PROPOSAL_STATUSES = ['draft', 'sent', 'viewed', 'accepted', 'declined', 'expired']
export const ACCEPTANCE_CONSENT = 'I am authorized to accept this proposal for the customer/company named below. I have reviewed the scope, exclusions, price, schedule and payment terms, and agree to use my typed signature as my electronic signature.'
export const uid = () => crypto.randomUUID()
export const todayCentral = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
export const money = value => Number(value || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' })
export function proposalStatus(row, today = todayCentral()) {
  return ['draft', 'sent', 'viewed'].includes(row.status) && row.expires_at && row.expires_at < today ? 'expired' : row.status
}
export function priceCents(value) {
  if (value === '' || value == null) return 0
  if (!/^\d{1,9}(\.\d{1,2})?$/.test(String(value))) throw new Error('Enter a non-negative dollar amount with at most two decimals.')
  const [whole, decimal = ''] = String(value).split('.')
  return Number(whole) * 100 + Number(decimal.padEnd(2, '0'))
}
export function proposalTotal(content) {
  return (content.pricing_mode === 'itemized'
    ? content.lines.reduce((sum, line) => sum + (line.included ? 0 : priceCents(line.amount)), 0)
    : priceCents(content.lump_sum)) / 100
}
export function moveItem(items, index, direction) {
  const next = [...items], target = index + direction
  if (target < 0 || target >= next.length) return next
  ;[next[index], next[target]] = [next[target], next[index]]
  return next
}
export const DEFAULT_CLAUSES = [
  ['Asbestos / environmental clearance', 'Building demolition is contingent upon receipt and review of the required asbestos inspection/survey, environmental clearance, any required abatement completion documentation, demolition authorization, permits and applicable notifications/waiting periods. No building disturbance is authorized before these conditions are satisfied. Asbestos abatement and hazardous-material remediation are excluded unless separately contracted with appropriately qualified parties.'],
  ['Hazardous materials', 'This proposal excludes handling, removal or disposal of asbestos, contaminated soil, chemicals, tanks and other hazardous or regulated materials unless expressly described in the scope. If suspect materials are encountered, affected work will stop pending assessment and a written plan.'],
  ['Unknown underground conditions', 'Buried foundations, tanks, utilities, unsuitable soils and other concealed conditions are not included unless specifically identified in the scope. Any resulting scope, price or schedule changes require written approval before additional work proceeds.'],
  ['Utilities', 'Required utility locating, private-line identification and applicable disconnections must be completed and confirmed before affected work begins. Responsibilities will be confirmed in writing. No party is relieved of its applicable utility-notification or safety obligations.'],
  ['Site access', 'Pricing assumes suitable access for the equipment and hauling described in the proposal. Customer/GC will identify approved access routes, staging areas, boundaries and protected improvements before mobilization. Changes to access or restrictions may affect price and schedule.'],
  ['Weather delays', 'Start and completion dates are estimates subject to weather, ground conditions, safe access and availability of required approvals. Material schedule changes will be communicated and coordinated with the customer/GC.'],
  ['Change orders', 'Work outside the written scope requires a written change order describing the additional work, price and schedule impact, approved by authorized representatives before proceeding.'],
  ['Hauling and disposal', 'Loading, transport and off-site disposal apply only to the materials and quantities described in the scope. Disposal will use facilities appropriate for the accepted material. Special handling, testing or regulated disposal is excluded unless expressly included.'],
  ['Customer / GC responsibilities', 'Before mobilization, the customer/GC will confirm site boundaries, designated removals, protected features, access permissions, a responsible site contact and required project documents. The parties will identify responsibility for permits, notices and utility coordination in writing.'],
  ['Final grading exclusions', 'Engineered grading, compaction testing, imported fill, drainage improvements, erosion-control design, seeding and landscaping are excluded unless specifically included. Finished elevations and restoration requirements must be stated in the agreed scope.'],
  ['Permits and notices', 'Required permits, inspections, notices and waiting periods must be confirmed before affected work begins. Responsibility and associated fees must be identified in the final scope. This proposal is not authorization to begin work without required approvals.'],
  ['Unforeseen site conditions', 'The proposal is based on the visible conditions and information available when prepared. Material differences in quantities, access, subsurface conditions or disposal classification will be documented and addressed through written agreement before affected additional work.'],
].map(([title, body], i) => ({ id: 'standard-' + i, title, body, standard: true }))

const section = (title, body = '') => ({ id: uid(), title, body })
export function templateSections(type, sixAcres = false) {
  if (sixAcres) return [
    section('Project overview', 'Proposed commercial clearing of approximately 6 acres. The preliminary estimate includes roughly 70 trees, numerous mature trees with some trunks approximately 3-5 feet in diameter, large limbs/timber, vegetation removal, building demolition and roadway demolition. Quantities, boundaries and designated removals must be verified before final agreement.'),
    section('Land clearing & tree removal', '- Remove designated trees and vegetation within the agreed clearing limits.\n- Process large-diameter trunks, limbs and timber using equipment appropriate to the confirmed site conditions.\n- Coordinate protection of retained trees, adjacent property and identified utilities.'),
    section('Stump / root removal', 'Define the designated stumps, root-removal depth and treatment of resulting voids before issuing the proposal. Stump/root work is included only to the limits expressly agreed here.'),
    section('Building demolition', DEFAULT_CLAUSES[0].body + '\n\nIdentify the designated structure, removal limits, foundations/slabs, utility disconnections and approved debris handling in the final scope.'),
    section('Roadway / pavement demolition', 'Remove the designated roadway/pavement within the agreed limits. Confirm surface type, area, thickness, base material and whether curbs or subsurface structures are included before issuing this proposal.'),
    section('Haul-off & disposal', 'Include debris loading and complete off-site haul-off of the accepted trees, vegetation, timber and demolition debris described in the agreed scope. Confirm disposal classification and any exclusions before mobilization.'),
    section('Project execution', 'Coordinate excavator operations, cutting/processing, loading and hauling with the customer/GC. Confirm equipment access, staging, truck routes, safe work zones and sequencing before mobilization.'),
    section('Project conditions & exclusions', [DEFAULT_CLAUSES[1].body, DEFAULT_CLAUSES[2].body, DEFAULT_CLAUSES[3].body, DEFAULT_CLAUSES[6].body, DEFAULT_CLAUSES[9].body].join('\n\n')),
  ]
  if (type === 'Custom/Blank Proposal') return [section('Project overview')]
  const scopes = {
    'Commercial Land Clearing': ['Clearing limits & vegetation removal', 'Stump / root removal', 'Loading, haul-off & disposal'],
    'Commercial Tree Removal': ['Designated tree removals', 'Stump treatment', 'Timber handling & haul-off'],
    'Demolition & Site Clearing': ['Demolition limits & methods', 'Roadway / pavement removal', 'Debris loading & disposal'],
    'Storm/Emergency Work': ['Storm damage & designated removals', 'Access & work sequencing', 'Debris handling & cleanup'],
    'Large Residential Project': ['Designated removals & property protection', 'Stump treatment', 'Haul-off & cleanup'],
  }
  return [section('Project overview'), ...(scopes[type] || []).map(title => section(title)),
    section('Project execution'), section('Conditions & exclusions', type === 'Demolition & Site Clearing' ? DEFAULT_CLAUSES[0].body : '')]
}
export function newProposal(type = PROPOSAL_TYPES[0], sixAcres = false) {
  const today = todayCentral(), expiry = new Date(today + 'T12:00:00Z')
  expiry.setUTCDate(expiry.getUTCDate() + 30)
  return {
    id: uid(), revision: 0, number: '', status: 'draft', customer_id: '',
    project_name: sixAcres ? 'Commercial Site Clearing & Demolition' : '', project_address: '',
    contact_name: '', company_name: '', proposal_date: today, expires_at: expiry.toISOString().slice(0, 10),
    proposal_type: type, internal_notes: '',
    content: { phone: '', email: '', description: '', sections: templateSections(type, sixAcres),
      pricing_mode: 'lump_sum', lump_sum: '', lines: [{ id: uid(), label: '', amount: '', included: false }],
      duration: '', estimated_start: '', mobilization: '', payment_terms: '', milestones: '', special_conditions: '', photos: [] },
  }
}
// Explicit allowlist: internal notes, owner IDs and any future internal costing fields never enter documents.
export function customerSnapshot(row, company) {
  const c = row.content
  return {
    number: row.number, project_name: row.project_name, project_address: row.project_address,
    contact_name: row.contact_name, company_name: row.company_name, proposal_date: row.proposal_date,
    expires_at: row.expires_at, proposal_type: row.proposal_type, amount: proposalTotal(c),
    company: { legalName: company.legalName, phone: company.phone, email: company.email, website: company.website, address: company.address },
    content: {
      phone: c.phone, email: c.email, description: c.description,
      sections: c.sections.map(({ title, body }) => ({ title, body })),
      pricing_mode: c.pricing_mode,
      lines: c.pricing_mode === 'itemized' ? c.lines.map(({ label, amount, included }) => ({ label, amount, included })) : [],
      duration: c.duration, estimated_start: c.estimated_start, mobilization: c.mobilization,
      payment_terms: c.payment_terms, milestones: c.milestones, special_conditions: c.special_conditions,
      photos: c.photos.map(({ data, caption }) => ({ data, caption })),
    },
  }
}
export function validateProposal(row, publishing = false) {
  if (!row.project_name.trim()) throw new Error('Enter a project name.')
  if (!row.proposal_date || !row.expires_at || row.expires_at < row.proposal_date) throw new Error('Choose an expiration date on or after the proposal date.')
  proposalTotal(row.content)
  if (!publishing) return
  if (row.expires_at < todayCentral()) throw new Error('Update the expiration date before sending.')
  if (!row.project_address.trim() || !row.contact_name.trim()) throw new Error('Add the project address and customer contact before sending.')
  if (!row.content.sections.length || row.content.sections.some(s => !s.title.trim() || !s.body.trim())) throw new Error('Complete or remove empty scope sections before sending.')
  if (proposalTotal(row.content) <= 0) throw new Error('Enter your customer-facing proposal price before sending.')
  if (row.content.pricing_mode === 'itemized' && row.content.lines.some(l => !l.label.trim() || (!l.included && (l.amount === '' || l.amount == null)))) throw new Error('Complete every pricing line or mark it Included.')
  if (!row.content.payment_terms.trim()) throw new Error('Add payment terms before sending.')
}
export function proposalJobNotes(row) {
  return [row.number + ' - ' + row.project_name, ...row.content.sections.map(s => s.title + '\n' + s.body), 'Payment terms\n' + row.content.payment_terms, 'Milestones\n' + row.content.milestones, 'Internal office notes\n' + row.internal_notes].join('\n\n')
}
