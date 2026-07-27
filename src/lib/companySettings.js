export const defaultCompanySettings = {
  legalName: 'Valid Tree Service LLC',
  address: '9315 Oak Knoll Ln, Houston, TX 77078',
  phone: '832-445-6535',
  email: 'validtreeservice@gmail.com',
  website: 'validtreeservice.com',
  tagline: 'Safety. Precision. Clean Results.',
  defaultDepositPercent: 30,
  paymentTerms:
    'Payment is due in full immediately upon substantial completion of the work described in this Agreement, unless an alternative payment schedule is stated in writing. Any deposit shown will be credited toward the total contract price.',
  cancellationPolicy:
    'The Customer may cancel this Agreement before crews, equipment, or subcontractors begin mobilization or work at the property. Once mobilization or work has begun, the Agreement may not be cancelled without payment for work performed, labor committed, materials purchased, equipment mobilization, disposal expenses, and other costs incurred by Valid Tree Service LLC.',
  utilityTerms:
    'Before excavation, stump grinding, root removal, or other ground-disturbing work, the Customer is responsible for identifying and marking privately owned or unregistered underground facilities, including irrigation systems, landscape lighting, private electrical lines, drainage systems, septic components, pool lines, and similar improvements not located through the public utility-marking service. Valid Tree Service LLC is not responsible for damage to undisclosed or improperly marked private facilities, except to the extent prohibited by law.',
  warrantyTerms:
    'Valid Tree Service LLC will perform the agreed work using reasonable care and professional tree-service practices. No guarantee is made regarding the future health, growth, stability, or survival of any tree, stump, root system, lawn, or landscaping unless a specific written warranty is included in this Agreement.',
}

const STORAGE_KEY = 'valid-tree-company-settings'

export function loadCompanySettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
    return { ...defaultCompanySettings, ...saved }
  } catch {
    return defaultCompanySettings
  }
}

export function saveCompanySettings(settings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
}
