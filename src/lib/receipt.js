export function receiptPaymentState(invoice) {
  const amount = Math.round(Number(invoice.amount || 0) * 100)
  const received = Math.round(Number(invoice.paid || 0) * 100)
  const balance = Math.max(amount - received, 0) / 100
  const paid = received > 0
  const fullyPaid = invoice.status !== 'void' && paid && received >= amount
  const label = invoice.status === 'void' ? 'VOID' : fullyPaid ? 'PAID' : paid ? 'PARTIAL' : invoice.status === 'overdue' ? 'OVERDUE' : 'OPEN'
  return { balance, paid, fullyPaid, label }
}
