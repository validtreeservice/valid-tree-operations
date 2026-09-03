import { useId, useRef } from 'react'

// Render only text and supported marks. No raw HTML or external embed URLs.
function Inline({ text }) {
  return text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).map((part, i) => part.startsWith('**') && part.endsWith('**')
    ? <strong key={i}>{part.slice(2, -2)}</strong>
    : part.startsWith('*') && part.endsWith('*') ? <em key={i}>{part.slice(1, -1)}</em> : part)
}
export function ProposalText({ text = '' }) {
  const blocks = String(text).split(/\n\s*\n/)
  return <div className="proposal-rich-output">{blocks.map((block, i) => {
    const lines = block.split('\n')
    if (lines.every(line => /^[-•] /.test(line))) return <ul key={i}>{lines.map((line, j) => <li key={j}><Inline text={line.replace(/^[-•] /, '')} /></li>)}</ul>
    if (lines.every(line => /^\d+\. /.test(line))) return <ol key={i}>{lines.map((line, j) => <li key={j}><Inline text={line.replace(/^\d+\. /, '')} /></li>)}</ol>
    return <p key={i}>{lines.map((line, j) => <span key={j}>{j > 0 && <br />}<Inline text={line} /></span>)}</p>
  })}</div>
}
export default function ProposalRichText({ label, value, onChange }) {
  const ref = useRef(null), id = useId()
  function format(kind) {
    const input = ref.current, start = input.selectionStart, end = input.selectionEnd
    const selected = value.slice(start, end) || 'Text'
    const replacement = kind === 'bold' ? '**' + selected + '**' : kind === 'italic' ? '*' + selected + '*'
      : selected.split('\n').map((line, i) => (kind === 'bullet' ? '- ' : (i + 1) + '. ') + line).join('\n')
    onChange(value.slice(0, start) + replacement + value.slice(end))
    requestAnimationFrame(() => { input.focus(); input.setSelectionRange(start, start + replacement.length) })
  }
  return <div className="proposal-rich-editor">
    <label htmlFor={id}>{label}</label>
    <div className="proposal-format" role="group" aria-label="Text formatting">
      <button type="button" onClick={() => format('bold')}><strong>Bold</strong></button>
      <button type="button" onClick={() => format('italic')}><em>Italic</em></button>
      <button type="button" onClick={() => format('bullet')}>Bullets</button>
      <button type="button" onClick={() => format('number')}>Numbered list</button>
    </div>
    <textarea id={id} ref={ref} value={value} maxLength={16000} rows={6} onChange={e => onChange(e.target.value)} />
    <details><summary>Formatted preview</summary><ProposalText text={value} /></details>
  </div>
}
