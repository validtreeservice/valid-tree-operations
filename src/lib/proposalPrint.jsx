import { renderToStaticMarkup } from 'react-dom/server'
import ProposalDocument from '../components/ProposalDocument'

export function proposalHtml(doc, status, acceptance, origin = '', styles = '') {
  const markup = renderToStaticMarkup(<ProposalDocument document={doc} status={status} acceptance={acceptance} />)
  const title = String(doc.number || 'Draft proposal').replace(/[<>&"']/g, '')
  // React escapes all user text, including scope text and captions.
  return '<!doctype html><html><head><meta charset="utf-8"><meta name="robots" content="noindex,nofollow"><title>' + title + '</title><style>' + styles + '</style></head><body class="proposal-print-body">' +
    markup.replace('src="/valid-tree-logo.png"', 'src="' + origin + '/valid-tree-logo.png"') + '</body></html>'
}
export async function printProposal(doc, status = 'draft', acceptance = null) {
  const { downloadProposalPdf } = await import('./proposalPdf.js')
  await downloadProposalPdf(doc, status, acceptance)
}
