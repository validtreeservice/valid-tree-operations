import { jsPDF } from 'jspdf'
import { money } from './proposals.js'

// Real, selectable-text PDF output. No pop-up, external document service or print dialog.
const clean = value => String(value ?? '').replace(/[\u2010-\u2015]/g, '-').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\*\*([^*]+)\*\*/g, '$1').replace(/\*([^*]+)\*/g, '$1')
const date = value => value ? new Date(value.length === 10 ? value + 'T12:00:00' : value).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/Chicago' }) : 'To be confirmed'
export function createProposalPdf(doc, status = 'draft', acceptance = null, logo = null) {
  const pdf = new jsPDF({ unit: 'pt', format: 'letter', compress: true }), c = doc.content, co = doc.company || {}
  const left = 48, width = 516, bottom = 726, green = [35, 65, 43]
  let y = 58
  pdf.setProperties({ title: `${doc.number || 'Draft'} - ${doc.project_name}`, author: co.legalName || 'Valid Tree Service LLC', subject: 'Commercial proposal' })
  function page() { pdf.addPage(); y = 58 }
  function room(height) { if (y + height > bottom) page() }
  function text(value, size = 10.5, bold = false, color = [38, 48, 41], indent = 0) {
    pdf.setFont('helvetica', bold ? 'bold' : 'normal'); pdf.setFontSize(size); pdf.setTextColor(...color)
    const lines = pdf.splitTextToSize(clean(value), width - indent)
    for (const line of lines) { room(size * 1.35); pdf.text(line, left + indent, y); y += size * 1.35 }
    y += 3
  }
  function heading(value, big = false) { room(big ? 70 : 58); y += 7; text(value, big ? 23 : 12, true, green) }
  function body(value) {
    for (const p of String(value || '').split(/\n\s*\n/)) {
      for (const line of p.split('\n')) text(line, 10.5)
      y += 3
    }
  }
  function block(title, value) { if (!value) return; heading(title); body(value) }
  function signatureRow(labels) {
    room(67); y += 35; pdf.setDrawColor(100,116,104); pdf.setFont('helvetica','normal'); pdf.setFontSize(9); pdf.setTextColor(65,80,65)
    labels.forEach((label,i) => { const x=left+i*270; pdf.line(x,y,x+(labels.length>1?246:width),y); pdf.text(label,x,y+14) }); y+=30
  }
  if (logo) {
    pdf.setFillColor(...green); pdf.rect(left, 40, 138, 88, 'F'); pdf.addImage(logo, 'PNG', left + 11, 44, 116, 78)
    y = 151
  }
  text(co.legalName || 'Valid Tree Service LLC', 18, true, green)
  text([co.phone, co.email, co.website].filter(Boolean).join('  |  '), 9)
  y += 45; text(status === 'draft' ? 'DRAFT - NOT ISSUED' : 'COMMERCIAL PROPOSAL', 10, true, green)
  heading(doc.project_name || 'Commercial project proposal', true); text(doc.project_address || 'Project address to be confirmed', 12)
  y += 25; text('PREPARED FOR', 9, true, green); text(doc.company_name || doc.contact_name || 'Customer to be confirmed', 13, true)
  if (doc.company_name) text(doc.contact_name)
  text([c.phone, c.email].filter(Boolean).join('  |  '))
  y += 18; text(doc.number || 'Unissued draft', 14, true); text('Proposal date: ' + date(doc.proposal_date)); text('Valid through: ' + date(doc.expires_at)); text(doc.proposal_type, 10); text(co.address,9)
  if (c.photos?.[0]) {
    const p = pdf.getImageProperties(c.photos[0].data), h = Math.min(170, width * p.height / p.width), w = h * p.width / p.height
    room(h + 15); pdf.addImage(c.photos[0].data, p.fileType, left + (width - w) / 2, y, w, h); y += h + 15
  }
  page(); heading('Project scope', true); block('Project overview', c.description)
  c.sections.forEach((s, i) => block(`${String(i + 1).padStart(2, '0')}  ${s.title}`, s.body || 'Scope to be completed before issue.'))
  page(); heading('Price & commercial terms', true)
  if (c.pricing_mode === 'itemized') c.lines.forEach(l => block(l.label, l.included ? 'Included' : money(l.amount)))
  room(65); pdf.setFillColor(235, 242, 228); pdf.rect(left, y - 3, width, 55, 'F'); y += 14
  text('TOTAL PROPOSED CONTRACT VALUE', 9, true, green, 12); text(doc.amount > 0 ? money(doc.amount) : 'Price to be entered', 21, true, green, 12); y += 13
  block('Anticipated duration', c.duration || 'To be confirmed in writing'); block('Estimated start', c.estimated_start || 'To be confirmed in writing')
  block('Mobilization requirements', c.mobilization); block('Payment terms', c.payment_terms || 'Payment terms to be completed before issue.')
  block('Progress / milestone payments', c.milestones); block('Special project conditions', c.special_conditions)
  page()
  if (doc.document_version >= 2) {
    heading('SUBMITTED BY'); text(co.legalName || 'Valid Tree Service LLC', 14, true); text('Authorized Representative: ' + doc.submitted_by)
    signatureRow(['Signature','Date'])
  }
  heading('ACCEPTANCE OF PROPOSAL')
  body(doc.acceptance_terms || 'Acceptance covers the written scope, exclusions, price, schedule and payment terms in this proposal. Site work remains subject to the required approvals and mobilization conditions stated above.')
  if (acceptance) {
    block('Electronic signature', acceptance.signature)
    text('Authorized Representative: ' + acceptance.name); text('Company / customer: ' + acceptance.company)
    if (acceptance.title) text('Title: ' + acceptance.title)
    if (acceptance.email) text('Contact email (provided by signer): ' + acceptance.email)
    text('Electronically accepted: ' + date(acceptance.signed_at) + ' ' + new Date(acceptance.signed_at).toLocaleTimeString('en-US', { timeZone: 'America/Chicago', timeZoneName: 'short' }))
    body(acceptance.consent); block('Accepted document fingerprint (SHA-256)', acceptance.document_hash)
  } else {
    signatureRow(['Authorized Representative','Company / customer'])
    if (doc.document_version >= 2) signatureRow(['Title (if applicable)'])
    signatureRow(['Signature','Date'])
  }
  for (let i = 0; i < (c.photos || []).length; i++) {
    page(); heading(`Existing site conditions / ${String(i + 1).padStart(2, '0')}`, true)
    const photo = c.photos[i], props = pdf.getImageProperties(photo.data), h = Math.min(485, width * props.height / props.width), w = h * props.width / props.height
    pdf.addImage(photo.data, props.fileType, left + (width - w) / 2, y, w, h); y += h + 20; body(photo.caption || 'Existing project site conditions.')
  }
  for (let i = 1; i <= pdf.getNumberOfPages(); i++) {
    pdf.setPage(i); pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8); pdf.setTextColor(85, 103, 85)
    pdf.setDrawColor(190, 203, 184); pdf.line(left, 746, 564, 746)
    pdf.text(clean(`${co.legalName || 'Valid Tree Service LLC'} | ${doc.number || 'Draft'}${status === 'draft' ? ' | DRAFT' : ''}`), left, 761)
    pdf.text(`${i} / ${pdf.getNumberOfPages()}`, 564, 761, { align: 'right' })
  }
  return pdf
}
export async function downloadProposalPdf(doc, status, acceptance) {
  let logo = null
  try {
    const response = await fetch('/valid-tree-logo.png')
    if (response.ok) logo = new Uint8Array(await response.arrayBuffer())
  } catch { /* A missing logo must not prevent retention of the agreement. */ }
  const pdf = createProposalPdf(doc, status, acceptance, logo)
  pdf.save((doc.number || 'Draft-proposal').replace(/[^A-Za-z0-9_-]/g, '-') + '.pdf')
}
