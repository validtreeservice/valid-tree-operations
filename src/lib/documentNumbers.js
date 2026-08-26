function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function nextDocumentNumber(records, prefix, { year = new Date().getFullYear(), floor = 0, field = 'number' } = {}) {
  const pattern = new RegExp(`^${escapeRegExp(prefix)}-${year}-(\\d+)$`, 'i')
  const highest = (records || []).reduce((current, record) => {
    const match = String(record?.[field] || '').trim().match(pattern)
    if (!match) return current
    const sequence = Number(match[1])
    return Number.isFinite(sequence) ? Math.max(current, sequence) : current
  }, Number(floor) || 0)

  return `${prefix}-${year}-${String(highest + 1).padStart(4, '0')}`
}

export function nextEstimateNumber(estimates, options = {}) {
  return nextDocumentNumber(estimates, 'EST', { floor: 42, ...options })
}
