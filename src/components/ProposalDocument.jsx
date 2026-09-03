import { ProposalText } from './ProposalRichText'
import { money } from '../lib/proposals'

const displayDate = value => value ? new Date(value.length === 10 ? value + 'T12:00:00' : value).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/Chicago' }) : 'To be confirmed'
export default function ProposalDocument({ document: doc, status = 'draft', acceptance }) {
  const c = doc.content, company = doc.company || {}
  function sections(items) {
    return items.map((s, i) => <section className="proposal-scope-block" key={i}>
      <h2><span>{String(c.sections.indexOf(s) + 1).padStart(2, '0')}</span> {s.title}</h2>
      <ProposalText text={s.body || 'Scope to be completed before issue.'} />
    </section>)
  }
  return <article className="proposal-document">
    <section className="proposal-cover">
      <header className="proposal-letterhead"><img src="/valid-tree-logo.png" alt="Valid Tree Service" /><div><strong>{company.legalName || 'Valid Tree Service LLC'}</strong><span>{company.phone}</span><span>{company.email}</span><span>{company.website}</span></div></header>
      <div className="proposal-cover-title"><p className="proposal-kicker">{status === 'draft' ? 'DRAFT - NOT ISSUED' : 'COMMERCIAL PROPOSAL'}</p>
        <h1>{doc.project_name || 'Commercial project proposal'}</h1><p>{doc.project_address || 'Project address to be confirmed'}</p></div>
      <div className="proposal-cover-meta">
        <div><span>Prepared for</span><strong>{doc.company_name || doc.contact_name || 'Customer to be confirmed'}</strong>{doc.company_name && <p>{doc.contact_name}</p>}<p>{c.email}<br />{c.phone}</p></div>
        <div><span>Proposal</span><strong>{doc.number || 'Unissued draft'}</strong><p>Date: {displayDate(doc.proposal_date)}<br />Valid through: {displayDate(doc.expires_at)}</p></div>
      </div>
      {c.photos[0] && <img className="proposal-cover-photo" src={c.photos[0].data} alt={c.photos[0].caption || 'Existing project site'} />}
      <footer className="proposal-cover-foot">{doc.proposal_type}<span>{company.address}</span></footer>
    </section>
    <div className="proposal-doc-section"><div className="proposal-section-heading"><p>{doc.number || 'Draft'} / Scope of work</p><h1>Project scope</h1></div>
      {c.description && <section className="proposal-scope-block"><h2>Project description</h2><ProposalText text={c.description} /></section>}
      {sections(c.sections)}
    </div>
    <div className="proposal-doc-section"><div className="proposal-section-heading"><p>{doc.number || 'Draft'} / Commercial terms</p><h1>Price, schedule & acceptance</h1></div>
      {c.pricing_mode === 'itemized' && <table className="proposal-price-table"><thead><tr><th>Description</th><th>Proposed value</th></tr></thead><tbody>{c.lines.map((line, i) => <tr key={i}><td>{line.label || 'Pricing line'}</td><td>{line.included ? 'Included' : money(line.amount)}</td></tr>)}</tbody></table>}
      <div className="proposal-total"><span>Total proposed contract value</span><strong>{doc.amount > 0 ? money(doc.amount) : 'Price to be entered'}</strong></div>
      <div className="proposal-terms-grid"><section><h2>Anticipated duration</h2><p>{c.duration || 'To be confirmed in writing'}</p></section><section><h2>Estimated start</h2><p>{c.estimated_start || 'To be confirmed in writing'}</p></section></div>
      {[['Mobilization requirements', c.mobilization], ['Payment terms', c.payment_terms || 'Payment terms to be completed before issue.'], ['Progress / milestone payments', c.milestones], ['Special project conditions', c.special_conditions]].filter(([, body]) => body).map(([title, body]) => <section className="proposal-scope-block" key={title}><h2>{title}</h2><ProposalText text={body} /></section>)}
      </div>
      <div className="proposal-doc-section proposal-signature-page">
      {doc.document_version >= 2 && <section className="proposal-submitted"><p className="proposal-kicker">SUBMITTED BY</p><h2>{company.legalName || 'Valid Tree Service LLC'}</h2><p>Authorized Representative: {doc.submitted_by}</p><div className="proposal-sign-lines"><p>Signature</p><p>Date</p></div></section>}
      <section className="proposal-acceptance"><h2>ACCEPTANCE OF PROPOSAL</h2>
        <p>{doc.acceptance_terms || 'Acceptance covers the written scope, exclusions, price, schedule and payment terms in this proposal. Site work remains subject to the required approvals and mobilization conditions stated above.'}</p>
        {acceptance ? <><div className="proposal-typed-signature">{acceptance.signature}</div><div className="proposal-terms-grid"><p><strong>Authorized representative</strong><br />{acceptance.name}<br />{acceptance.company}</p><p><strong>Electronically accepted</strong><br />{displayDate(acceptance.signed_at)}<br />{new Date(acceptance.signed_at).toLocaleTimeString('en-US', { timeZone: 'America/Chicago', timeZoneName: 'short' })}</p></div><p className="proposal-sign-record">{acceptance.consent}</p></>
          : <div className="proposal-sign-lines"><p>Authorized Representative</p><p>Company / customer</p>{doc.document_version >= 2 && <p>Title (if applicable)</p>}<p>Signature</p><p>Date</p></div>}
        {acceptance?.title && <p>Title: {acceptance.title}</p>}
        {acceptance?.email && <p>Contact email (provided by signer): {acceptance.email}</p>}
        {acceptance?.document_hash && <p className="proposal-sign-record">Accepted document fingerprint (SHA-256): {acceptance.document_hash}</p>}
      </section>
    </div>
    {Array.from({ length: Math.ceil(c.photos.length / 2) }, (_, page) => <div className="proposal-doc-section proposal-photo-page" key={page}><div className="proposal-section-heading"><p>{doc.number || 'Draft'} / Site documentation</p><h1>Existing site conditions</h1></div>{c.photos.slice(page * 2, page * 2 + 2).map((photo, i) => <figure key={i}><img src={photo.data} alt={photo.caption || 'Project site photo ' + (page * 2 + i + 1)} /><figcaption><strong>{String(page * 2 + i + 1).padStart(2, '0')}</strong> {photo.caption || 'Existing project site conditions.'}</figcaption></figure>)}</div>)}
    <footer className="proposal-document-footer">{company.legalName || 'Valid Tree Service LLC'} · {doc.number || 'Draft'} · {company.phone}</footer>
  </article>
}
