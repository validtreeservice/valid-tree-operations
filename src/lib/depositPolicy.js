export function depositRate(totalPrice) {
  const total = Number(totalPrice || 0)
  if (total > 5000) return 0.35
  if (total > 1500) return 0.30
  return 0
}

export function requiredDeposit(totalPrice) {
  const total = Math.max(Number(totalPrice || 0), 0)
  return Math.round(total * depositRate(total) * 100) / 100
}

export function depositPolicyLabel(totalPrice) {
  const rate = depositRate(totalPrice)
  return rate ? `${Math.round(rate * 100)}% required deposit` : 'No deposit required'
}
