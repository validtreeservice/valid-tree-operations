// Pass the path of the Node bundle of src/lib/proposalPrint.jsx.
// This verifies document structure and escaping; it does not claim visual PDF QA.
import { createRequire } from 'node:module'
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import assert from 'node:assert/strict'
import { newProposal, customerSnapshot } from '../src/lib/proposals.js'
const require = createRequire(import.meta.url)
const { proposalHtml } = require(resolve(process.argv[2]))
const row = newProposal(undefined, true)
row.project_name = 'Commercial Site Clearing & Demolition'
row.internal_notes = 'PRIVATE_OFFICE_ONLY'
const doc = customerSnapshot(row, { legalName: 'Valid Tree Service LLC', phone: '832-445-6535', email: 'validtreeservice@gmail.com', website: 'validtreeservice.com', address: 'Houston, Texas' })
const css = await readFile(new URL('../src/styles/proposals.css', import.meta.url), 'utf8')
const logo = await readFile(new URL('../public/valid-tree-logo.png', import.meta.url))
const html = proposalHtml(doc, 'draft', null, '', css).replace('src="/valid-tree-logo.png"', 'src="data:image/png;base64,' + logo.toString('base64') + '"')
assert.doesNotMatch(html, /PRIVATE_OFFICE_ONLY/)
assert.match(html, /DRAFT - NOT ISSUED/)
assert.match(html, /Price to be entered/)
const titleInHtml = title => title.replaceAll('&', '&amp;')
for (let i = 1; i < doc.content.sections.length; i++) {
  const previous = html.indexOf('> ' + titleInHtml(doc.content.sections[i - 1].title))
  const next = html.indexOf('> ' + titleInHtml(doc.content.sections[i].title))
  assert.ok(previous >= 0 && next > previous, 'Section ordering must be preserved')
}
const hostile = structuredClone(doc)
hostile.project_name = '<script>alert("test")</script>'
hostile.content.sections[0].body = '<img src=x onerror=alert(1)>'
const safe = proposalHtml(hostile, 'draft', null, '', css)
assert.doesNotMatch(safe, /<script>|<img src=x/)
assert.match(safe, /&lt;script&gt;/)
assert.ok(safe.includes('counter(page)'))
await writeFile(resolve(process.argv[3]), html)
console.log('PASS: document structure, exact section order, draft labeling, print rules and HTML escaping.')
