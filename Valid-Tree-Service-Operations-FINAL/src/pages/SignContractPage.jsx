import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import ContractDocument from '../components/ContractDocument'
import { supabase } from '../lib/supabase'
import { createStripeCheckout } from '../lib/stripePayments'
import { useWorkspace } from '../data/WorkspaceProvider'

function SignaturePad({ onChange }) {
  const canvasRef = useRef(null)
  const drawing = useRef(false)
  const drawn = useRef(false)
  const last = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const ratio = Math.max(window.devicePixelRatio || 1, 1)
    canvas.width = Math.round(rect.width * ratio)
    canvas.height = Math.round(180 * ratio)
    const context = canvas.getContext('2d', { alpha: false })
    context.setTransform(ratio, 0, 0, ratio, 0, 0)
    context.fillStyle = '#fff'
    context.fillRect(0, 0, rect.width, 180)
    context.strokeStyle = '#132318'
    context.lineWidth = 2.25
    context.lineCap = 'round'
    context.lineJoin = 'round'
  }, [])

  const point = (event) => {
    const rect = canvasRef.current.getBoundingClientRect()
    return { x: event.clientX - rect.left, y: event.clientY - rect.top }
  }

  function start(event) {
    event.preventDefault()
    drawing.current = true
    last.current = point(event)
    drawn.current = true
    try { canvasRef.current.setPointerCapture(event.pointerId) } catch {}
  }

  function move(event) {
    if (!drawing.current) return
    event.preventDefault()
    const next = point(event)
    const context = canvasRef.current.getContext('2d')
    context.beginPath()
    context.moveTo(last.current.x, last.current.y)
    context.lineTo(next.x, next.y)
    context.stroke()
    last.current = next
  }

  function end(event) {
    if (!drawing.current) return
    drawing.current = false
    try { canvasRef.current.releasePointerCapture(event.pointerId) } catch {}
    if (drawn.current) onChange(canvasRef.current.toDataURL('image/png'))
  }

  function clear() {
    const canvas = canvasRef.current
    const context = canvas.getContext('2d')
    context.save()
    context.setTransform(1, 0, 0, 1, 0, 0)
    context.fillStyle = '#fff'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.restore()
    drawn.current = false
    onChange('')
  }

  return <div className="sig-pad">
    <canvas ref={canvasRef} aria-label="Signature drawing area" onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerCancel={end} style={{ width: '100%', height: 180, background: '#fff', touchAction: 'none' }} />
    <button type="button" onClick={clear}>Clear signature</button>
  </div>
}

function formatSlot(slotDate, startTime) {
  const parsed = new Date(`${slotDate}T${startTime || '12:00:00'}`)
  if (Number.isNaN(parsed.getTime())) return `${slotDate} ${startTime || ''}`.trim()
  return parsed.toLocaleString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
}

export default function SignContractPage() {
  const { token } = useParams()
  const workspace = useWorkspace()
  const [contract, setContract] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [signature, setSignature] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [paymentBusy, setPaymentBusy] = useState('')
  const [scheduleData, setScheduleData] = useState(null)
  const [scheduleLoading, setScheduleLoading] = useState(false)
  const [scheduleError, setScheduleError] = useState('')
  const [bookingSlotId, setBookingSlotId] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      if (token.startsWith('demo-') || !supabase) {
        const item = workspace.data.contracts.find((candidate) => candidate.sign_token === token)
        if (!cancelled && item) {
          const customer = workspace.customer(item.customer_id)
          setContract({ ...item, customer, company: { legal_name: workspace.data.settings.legalName, phone: workspace.data.settings.phone, email: workspace.data.settings.email, tagline: workspace.data.settings.tagline } })
          setName(item.signature_name || customer?.full_name || '')
          setEmail(item.signer_email || customer?.email || '')
        } else if (!cancelled) setError('This agreement is unavailable.')
        setLoading(false)
        return
      }
      const { data, error: rpcError } = await supabase.rpc('get_contract_for_signing', { p_token: token })
      if (cancelled) return
      if (rpcError || !data) setError(rpcError?.message || 'This agreement is unavailable.')
      else {
        setContract(data)
        setName(data.signature_name || data.customer?.full_name || '')
        setEmail(data.signer_email || data.customer?.email || '')
      }
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [token])

  useEffect(() => {
    if (!contract?.signed_at) return
    let cancelled = false
    async function loadSchedule() {
      setScheduleLoading(true)
      setScheduleError('')
      if (token.startsWith('demo-') || !supabase) {
        const today = new Date().toISOString().slice(0, 10)
        const slots = (workspace.data.schedule_slots || [])
          .filter((slot) => slot.active !== false && slot.slot_date >= today && new Date(`${slot.slot_date}T12:00:00`).getDay() !== 0)
          .map((slot) => ({ ...slot, booked: workspace.data.jobs.filter((job) => job.schedule_slot_id === slot.id && job.status !== 'cancelled').length }))
          .filter((slot) => slot.booked < Number(slot.capacity || 1))
        if (!cancelled) setScheduleData({ booked: Boolean(contract.service_date), service_date: contract.service_date || '', start_time: contract.start_time || '', slots })
        setScheduleLoading(false)
        return
      }
      const { data, error: rpcError } = await supabase.rpc('get_contract_schedule_options', { p_token: token })
      if (!cancelled) {
        if (rpcError) setScheduleError(rpcError.message)
        else setScheduleData({ ...data, booked: Boolean(data?.booked_slot_id || data?.service_date) })
        setScheduleLoading(false)
      }
    }
    loadSchedule()
    return () => { cancelled = true }
  }, [contract?.signed_at, contract?.service_date, token])

  async function sign(event) {
    event.preventDefault()
    setError('')
    if (!name.trim()) return setError("Please enter the customer's printed name.")
    if (!signature.startsWith('data:image/png;base64,')) return setError('Please draw the customer signature in the signature box.')
    if (!agreed) return setError('Please confirm acceptance of the agreement.')
    setSubmitting(true)
    const signedAt = new Date().toISOString()
    const consent = 'I reviewed and agree to the complete scope, price, payment terms, and numbered terms and conditions shown in this agreement, and I intend my electronic signature to be legally binding.'
    if (token.startsWith('demo-') || !supabase) {
      await workspace.updateAndWait('contracts', contract.id, { status: 'signed', signed_at: signedAt, signature_name: name.trim(), signer_email: email.trim(), signature_data: signature, consent_text: consent })
      setContract((current) => ({ ...current, status: 'signed', signed_at: signedAt, signature_name: name.trim(), signer_email: email.trim(), signature_data: signature }))
      setSubmitting(false)
      return
    }
    const { data, error: rpcError } = await supabase.rpc('submit_contract_signature', { p_token: token, p_name: name.trim(), p_email: email.trim(), p_signature_data: signature, p_user_agent: navigator.userAgent, p_consent_text: consent })
    if (rpcError || !data?.ok) setError(rpcError?.message || 'The signature could not be saved. Please contact Valid Tree Service.')
    else setContract((current) => ({ ...current, status: 'signed', signed_at: data.signed_at || signedAt, signature_name: name.trim(), signer_email: email.trim(), signature_data: signature }))
    setSubmitting(false)
  }

  async function pay(paymentKind) {
    setError('')
    setPaymentBusy(paymentKind)
    try {
      const checkout = await createStripeCheckout({ contract_token: token, payment_kind: paymentKind })
      window.location.assign(checkout.url)
    } catch (paymentError) {
      setError(paymentError.message)
      setPaymentBusy('')
    }
  }

  async function book(slot) {
    setBookingSlotId(slot.id)
    setScheduleError('')
    try {
      if (new Date(`${slot.slot_date}T12:00:00`).getDay() === 0) throw new Error('Sunday appointments require direct approval from Valid Tree Service.')
      if (token.startsWith('demo-') || !supabase) {
        await workspace.updateAndWait('contracts', contract.id, { service_date: slot.slot_date, start_time: slot.start_time, schedule_slot_id: slot.id })
        const existing = workspace.data.jobs.find((job) => job.contract_id === contract.id)
        const values = { customer_id: contract.customer_id, contract_id: contract.id, schedule_slot_id: slot.id, title: contract.title, description: contract.scope_of_work, date: slot.slot_date, start_time: slot.start_time, address: contract.customer?.service_address || '', status: 'scheduled' }
        if (existing) await workspace.updateAndWait('jobs', existing.id, values)
        else await workspace.addAndWait('jobs', values)
        setContract((current) => ({ ...current, service_date: slot.slot_date, start_time: slot.start_time, schedule_slot_id: slot.id }))
        setScheduleData((current) => ({ ...current, booked: true, service_date: slot.slot_date, start_time: slot.start_time }))
      } else {
        const { data, error: rpcError } = await supabase.rpc('book_contract_schedule', { p_token: token, p_slot_id: slot.id })
        if (rpcError || !data?.ok) throw new Error(rpcError?.message || data?.message || 'This appointment could not be reserved.')
        setContract((current) => ({ ...current, service_date: data.slot_date, start_time: data.start_time, schedule_slot_id: slot.id }))
        setScheduleData((current) => ({ ...current, booked: true, service_date: data.slot_date, start_time: data.start_time }))
      }
    } catch (bookingError) {
      setScheduleError(bookingError.message)
    } finally {
      setBookingSlotId('')
    }
  }

  if (loading) return <main className="sign-page"><div className="sign-error"><img src="/valid-tree-logo.png" alt="Valid Tree Service" /><h1>Loading agreement...</h1></div></main>
  if (!contract) return <main className="sign-page"><div className="sign-error"><img src="/valid-tree-logo.png" alt="Valid Tree Service" /><h1>This agreement is unavailable.</h1><p>{error}</p></div></main>

  const isSigned = Boolean(contract.signature_data && contract.signed_at)
  const paymentReturned = new URLSearchParams(window.location.search).get('payment')

  return <main className="sign-page">
    <ContractDocument contract={contract} customer={contract.customer || {}} company={contract.company || {}}>
      {isSigned ? <section className="signature-form">
        <h2>Customer acceptance</h2>
        <div className="sign-success compact">
          <div className="success-mark">✓</div>
          <h1>Agreement signed</h1>
          <p>Signed by <strong>{contract.signature_name}</strong> on {new Date(contract.signed_at).toLocaleString('en-US')}.</p>
          <img className="completed-signature" src={contract.signature_data} alt="Customer electronic signature" />
          {paymentReturned === 'success' ? <p className="success-banner">Thank you. Stripe received your payment and Valid Tree Service will receive confirmation.</p> : null}
          {paymentReturned === 'cancelled' ? <p className="signature-warning-box">Card checkout was cancelled. No payment was recorded.</p> : null}
          {error ? <p className="form-message error">{error}</p> : null}
          <div className="contract-payment-actions">
            {Number(contract.deposit || 0) > 0 ? <button type="button" className="button primary" disabled={!!paymentBusy} onClick={() => pay('deposit')}>{paymentBusy === 'deposit' ? 'Opening secure checkout...' : 'Pay deposit securely'}</button> : null}
            <button type="button" className="button primary" disabled={!!paymentBusy} onClick={() => pay('balance')}>{paymentBusy === 'balance' ? 'Opening secure checkout...' : 'Pay balance securely'}</button>
            <button type="button" className="button secondary" onClick={() => window.print()}>Print / Save signed agreement</button>
          </div>
          <small className="payment-security-note">Card details are entered securely on Stripe and are never stored by Valid Tree Service.</small>
          {Number(contract.deposit || 0) > 0 ? <section className="zelle-instructions">
            <h2>Pay the {Number(contract.deposit).toLocaleString('en-US', { style: 'currency', currency: 'USD' })} deposit with Zelle</h2>
            <p>Scan this code in your bank's Zelle feature and send payment to <strong>Valid Tree Service LLC at 832-445-6535</strong>. Include your contract number <strong>{contract.contract_number}</strong> in the memo.</p>
            <img src="/zelle-qr.jpg" alt="Zelle QR code for Valid Tree Service LLC at 832-445-6535" />
            <p className="signature-warning-box">Sending Zelle does not automatically mark this contract or any invoice paid. The office will verify the deposit and record it after it arrives.</p>
          </section> : null}
        </div>

        <section className="customer-schedule-panel">
          <h2>Choose your service date</h2>
          <p>Select one of the available appointment times below. Your choice will be added to Valid Tree Service's live schedule.</p>
          <p className="sunday-notice">Sunday appointments require direct approval from Valid Tree Service.</p>
          {scheduleLoading ? <p className="muted-left">Loading available dates...</p> : null}
          {scheduleError ? <p className="form-message error">{scheduleError}</p> : null}
          {scheduleData?.booked ? <div className="schedule-confirmed"><strong>Appointment reserved</strong><span>{formatSlot(scheduleData.service_date, scheduleData.start_time)}</span></div> : null}
          {!scheduleLoading && !scheduleData?.booked && scheduleData?.slots?.length ? <div className="schedule-choice-grid">
            {scheduleData.slots.map((slot) => <button key={slot.id} type="button" className="schedule-choice" disabled={!!bookingSlotId} onClick={() => book(slot)}>
              <strong>{formatSlot(slot.slot_date, slot.start_time)}</strong>
              <span>{bookingSlotId === slot.id ? 'Reserving...' : slot.customer_note || 'Choose this appointment'}</span>
            </button>)}
          </div> : null}
          {!scheduleLoading && !scheduleData?.booked && scheduleData && !scheduleData.slots?.length ? <p className="signature-warning-box">No online appointment times are currently available. Please contact Valid Tree Service so we can arrange your date directly.</p> : null}
        </section>
      </section> : <form className="signature-form" onSubmit={sign}>
        <h2>Customer acceptance</h2>
        {contract.status === 'signed' ? <p className="signature-warning-box">The contract was marked signed, but no signature was captured. Please sign below to complete the record.</p> : null}
        {error ? <p className="form-message error">{error}</p> : null}
        <label>Printed name<input value={name} onChange={(event) => setName(event.target.value)} required /></label>
        <label>Email for receipt<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
        <label>Signature<SignaturePad onChange={setSignature} /></label>
        <label className="accept"><input type="checkbox" checked={agreed} onChange={(event) => setAgreed(event.target.checked)} required /><span>I reviewed and agree to the complete scope, price, payment terms, and all numbered terms and conditions shown above. I intend my electronic signature to be legally binding.</span></label>
        <button className="button primary wide-button" disabled={!agreed || !signature || !name.trim() || submitting}>{submitting ? 'Saving signature...' : 'Sign agreement'}</button>
      </form>}
    </ContractDocument>
  </main>
}
