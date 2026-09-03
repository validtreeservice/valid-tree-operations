import { renderToStaticMarkup } from 'react-dom/server'
import ProposalDocument from '../components/ProposalDocument'

export function proposalHtml(doc, status, acceptance, origin = '', styles = '') {
  const markup = renderToStaticMarkup(<ProposalDocument document={doc} status={status} acceptance={acceptance} />)
  const title = String(doc.number || 'Draft proposal').replace(/[<>&"']/g, '')
  // React escapes all user text, including scope text and captions.
  return '<!doctype html><html><head><meta charset="utf-8"><meta name="robots" content="noindex,nofollow"><title>' + title + '</title><style>' + styles + '</style></head><body class="proposal-print-body">' +
    markup.replace('src="/valid-tree-logo.png"', 'src="' + origin + '/valid-tree-logo.png"') + '</body></html>'
}
export function printProposal(doc, status = 'draft', acceptance = null) {
  const popup = window.open('', '_blank')
  if (!popup) throw new Error('Allow popups for this website, then try Generate PDF again.')
  popup.opener = null
  const styles = Array.from(document.styleSheets).map(sheet => {
    try { return Array.from(sheet.cssRules).map(rule => rule.cssText).join('\n') } catch { return '' }
  }).join('\n')
  popup.document.write(proposalHtml(doc, status, acceptance, window.location.origin, styles))
  popup.document.close()
  Promise.all(Array.from(popup.document.images).map(img => img.decode().catch(() => {}))).then(() => {
    if (!popup.closed) { popup.focus(); popup.print() }
  })
}
