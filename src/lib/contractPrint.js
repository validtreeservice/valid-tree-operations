import { loadCompanySettings } from './companySettings'

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function money(value) {
  return Number(value || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

function date(value) {
  if (!value) return 'To be scheduled'
  return new Date(`${value}T12:00:00`).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  })
}

export function printContract(contract) {
  const company = loadCompanySettings()
  const customer = contract.customers || {}
  const balance = Math.max(Number(contract.total_price || 0) - Number(contract.deposit || 0), 0)
  const scopeItems = String(contract.scope_of_work || '')
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => `<li>${escapeHtml(item.replace(/^[-•]\s*/, ''))}</li>`)
    .join('')

  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(contract.contract_number)} - Contract</title>
  <style>
    @page { size: Letter; margin: .45in; }
    * { box-sizing: border-box; }
    body { margin:0; color:#172018; font-family: Arial, Helvetica, sans-serif; background:#fff; }
    .document { max-width: 8.5in; margin:auto; }
    .header { display:flex; justify-content:space-between; align-items:center; gap:24px; padding:18px 22px; background:#11261a; color:white; border-radius:12px 12px 0 0; }
    .logo { width:150px; max-height:88px; object-fit:contain; }
    .company { text-align:right; font-size:12px; line-height:1.55; }
    .company strong { display:block; font-size:18px; letter-spacing:.04em; }
    .accent { height:7px; background:#82ad45; }
    .title-row { display:flex; justify-content:space-between; gap:20px; padding:24px 4px 16px; border-bottom:2px solid #d9e1d8; }
    h1 { margin:0; font-size:28px; color:#11261a; }
    .number { text-align:right; font-size:12px; color:#526052; }
    .number strong { display:block; color:#172018; font-size:16px; }
    .grid { display:grid; grid-template-columns:1fr 1fr; gap:16px; margin:18px 0; }
    .box { border:1px solid #d7dfd6; border-radius:8px; padding:14px; }
    .label { margin:0 0 6px; color:#667266; font-size:10px; font-weight:bold; letter-spacing:.12em; text-transform:uppercase; }
    .box p { margin:3px 0; font-size:13px; line-height:1.45; }
    h2 { margin:20px 0 9px; color:#11261a; font-size:15px; letter-spacing:.05em; text-transform:uppercase; }
    .scope { min-height:110px; border:1px solid #d7dfd6; border-radius:8px; padding:14px 18px; }
    .scope ul { margin:0; padding-left:20px; }
    .scope li { margin:0 0 8px; font-size:13px; line-height:1.45; }
    .pricing { width:100%; border-collapse:collapse; margin-top:8px; }
    .pricing td { padding:9px 12px; border-bottom:1px solid #dfe5de; font-size:13px; }
    .pricing td:last-child { text-align:right; font-weight:bold; }
    .pricing .total td { background:#eff5eb; color:#11261a; font-size:16px; border-bottom:0; }
    .terms { columns:2; column-gap:28px; font-size:9.5px; line-height:1.45; color:#3e493f; }
    .term { break-inside:avoid; margin:0 0 9px; }
    .term strong { color:#172018; }
    .signatures { display:grid; grid-template-columns:1fr 1fr; gap:34px; margin-top:30px; }
    .signature-line { height:42px; border-bottom:1px solid #172018; }
    .signature-meta { display:flex; justify-content:space-between; gap:10px; margin-top:5px; color:#5e695f; font-size:9px; }
    .footer { margin-top:24px; padding-top:9px; border-top:1px solid #d7dfd6; text-align:center; color:#677268; font-size:9px; }
    .no-print { position:fixed; right:18px; top:18px; padding:11px 16px; border:0; border-radius:8px; background:#82ad45; color:#0b160d; font-weight:bold; cursor:pointer; }
    @media print { .no-print { display:none; } .document { max-width:none; } }
  </style></head><body>
  <button class="no-print" onclick="window.print()">Print / Save PDF</button>
  <main class="document">
    <header class="header"><img class="logo" src="${window.location.origin}/valid-tree-logo.png" alt="Valid Tree Service logo"><div class="company"><strong>${escapeHtml(company.legalName)}</strong>${escapeHtml(company.address)}<br>${escapeHtml(company.phone)} · ${escapeHtml(company.email)}<br>${escapeHtml(company.website)}</div></header>
    <div class="accent"></div>
    <section class="title-row"><div><p class="label">Professional Tree Care Agreement</p><h1>${escapeHtml(contract.title || 'Tree Service Contract')}</h1></div><div class="number">Contract Number<strong>${escapeHtml(contract.contract_number)}</strong>Contract Date: ${date(String(contract.created_at || '').slice(0,10))}</div></section>
    <section class="grid"><div class="box"><p class="label">Customer</p><p><strong>${escapeHtml(customer.full_name || 'Customer')}</strong></p><p>${escapeHtml(customer.service_address || 'Service address not provided')}</p><p>${escapeHtml(customer.phone || '')}${customer.phone && customer.email ? ' · ' : ''}${escapeHtml(customer.email || '')}</p></div><div class="box"><p class="label">Project</p><p><strong>Scheduled service:</strong> ${date(contract.service_date)}</p><p><strong>Payment:</strong> Due upon completion</p><p><strong>Status:</strong> ${escapeHtml(contract.status || 'draft')}</p></div></section>
    <h2>Scope of Work</h2><section class="scope"><ul>${scopeItems || '<li>Scope of work to be added.</li>'}</ul></section>
    <h2>Contract Price</h2><table class="pricing"><tr><td>Agreed tree-service work</td><td>${money(contract.total_price)}</td></tr><tr><td>Deposit / advance payment</td><td>${money(contract.deposit)}</td></tr><tr class="total"><td>Balance due upon completion</td><td>${money(balance)}</td></tr></table>
    <h2>Terms and Conditions</h2><section class="terms"><p class="term"><strong>1. Payment.</strong> ${escapeHtml(company.paymentTerms)}</p><p class="term"><strong>2. Changes and additional work.</strong> Work outside the written scope requires customer approval and may result in additional charges.</p><p class="term"><strong>3. Cancellation.</strong> ${escapeHtml(company.cancellationPolicy)}</p><p class="term"><strong>4. Underground and concealed conditions.</strong> ${escapeHtml(company.utilityTerms)}</p><p class="term"><strong>5. Access and authority.</strong> The Customer confirms they are authorized to approve the work and will provide reasonable access for crews and equipment.</p><p class="term"><strong>6. Weather and safety.</strong> Work may be delayed or rescheduled when weather, site conditions, utility conflicts, or other hazards make performance unsafe or impractical.</p><p class="term"><strong>7. Cleanup.</strong> Debris generated by the agreed work will be removed and the immediate work area left reasonably clean unless otherwise stated in the scope.</p><p class="term"><strong>8. Tree condition and warranty.</strong> ${escapeHtml(company.warrantyTerms)}</p><p class="term"><strong>9. Acceptance.</strong> By signing, the Customer accepts the scope, price, payment terms, and conditions of this Agreement.</p></section>
    <section class="signatures"><div><div class="signature-line"></div><div class="signature-meta"><span>Customer Signature</span><span>Date</span></div><div class="signature-line"></div><div class="signature-meta"><span>Printed Name</span></div></div><div><div class="signature-line"></div><div class="signature-meta"><span>Valid Tree Service LLC Representative</span><span>Date</span></div><div class="signature-line"></div><div class="signature-meta"><span>Printed Name / Title</span></div></div></section>
    <footer class="footer">${escapeHtml(company.legalName)} · ${escapeHtml(company.phone)} · ${escapeHtml(company.website)} · ${escapeHtml(company.tagline)}</footer>
  </main><script>window.addEventListener('load',()=>setTimeout(()=>window.print(),350))</script></body></html>`

  const popup = window.open('', '_blank')
  if (!popup) throw new Error('Your browser blocked the PDF window. Allow popups for this site and try again.')
  popup.opener = null
  popup.document.open()
  popup.document.write(html)
  popup.document.close()
}
