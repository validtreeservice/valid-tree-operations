import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useWorkspace } from '../data/WorkspaceProvider'

const money = (n) => Number(n || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' })

function SignaturePad({ value, onChange }) {
  const canvasRef = useRef(null);
  const drawingRef = useRef(false);
  const lastPointRef = useRef(null);
  const savedImageRef = useRef(value || "");

  function configureCanvas(canvas) {
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    canvas.width = Math.max(1, Math.round(rect.width * dpr));
    canvas.height = Math.max(1, Math.round(rect.height * dpr));

    const ctx = canvas.getContext("2d");

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#132318";

    return { ctx, rect };
  }

  function redrawSavedSignature() {
    const canvas = canvasRef.current;
    const savedImage = savedImageRef.current;

    if (!canvas || !savedImage) return;

    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext("2d");
    const image = new Image();

    image.onload = () => {
      ctx.clearRect(0, 0, rect.width, rect.height);
      ctx.drawImage(image, 0, 0, rect.width, rect.height);
    };

    image.src = savedImage;
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    configureCanvas(canvas);
    redrawSavedSignature();

    const handleResize = () => {
      configureCanvas(canvas);
      redrawSavedSignature();
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  useEffect(() => {
    savedImageRef.current = value || "";

    if (value) {
      redrawSavedSignature();
    }
  }, [value]);

  function getPoint(event) {
    const rect = canvasRef.current.getBoundingClientRect();

    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
  }

  function start(event) {
    event.preventDefault();

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const point = getPoint(event);

    drawingRef.current = true;
    lastPointRef.current = point;

    try {
      canvas.setPointerCapture(event.pointerId);
    } catch {
      // Pointer capture is optional.
    }

    ctx.beginPath();
    ctx.arc(point.x, point.y, 1.1, 0, Math.PI * 2);
    ctx.fillStyle = "#132318";
    ctx.fill();
  }

  function move(event) {
    if (!drawingRef.current) return;

    event.preventDefault();

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const currentPoint = getPoint(event);
    const previousPoint = lastPointRef.current;

    if (!previousPoint) return;

    ctx.beginPath();
    ctx.moveTo(previousPoint.x, previousPoint.y);
    ctx.lineTo(currentPoint.x, currentPoint.y);
    ctx.stroke();

    lastPointRef.current = currentPoint;
  }

  function end(event) {
    if (!drawingRef.current) return;

    event.preventDefault();

    drawingRef.current = false;
    lastPointRef.current = null;

    const canvas = canvasRef.current;

    try {
      canvas.releasePointerCapture(event.pointerId);
    } catch {
      // Pointer may already be released.
    }

    const imageData = canvas.toDataURL("image/png");

    savedImageRef.current = imageData;
    onChange(imageData);

    requestAnimationFrame(redrawSavedSignature);
  }

  function clear() {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const rect = canvas.getBoundingClientRect();

    ctx.clearRect(0, 0, rect.width, rect.height);

    drawingRef.current = false;
    lastPointRef.current = null;
    savedImageRef.current = "";

    onChange("");
  }

  return (
    <div className="sig-pad">
      <canvas
        ref={canvasRef}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
        style={{ touchAction: "none" }}
      />

      <button type="button" onClick={clear}>
        Clear
      </button>
    </div>
  );
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
  const [done, setDone] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    async function load() {
      if (token.startsWith('demo-') || !supabase) {
        const c = workspace.data.contracts.find((x) => x.sign_token === token)
        if (c) setContract({ ...c, customer: workspace.customer(c.customer_id), company: { legal_name: workspace.data.settings.legalName, phone: workspace.data.settings.phone, email: workspace.data.settings.email, tagline: workspace.data.settings.tagline, payment_terms: workspace.data.settings.paymentTerms } })
        else setError('This agreement is unavailable.')
        setLoading(false); return
      }
      const { data, error: rpcError } = await supabase.rpc('get_contract_for_signing', { p_token: token })
      if (rpcError || !data) setError(rpcError?.message || 'This agreement is unavailable.')
      else { setContract(data); setEmail(data.customer?.email || '') }
      setLoading(false)
    }
    load()
  }, [token])

  async function sign(e) {
    e.preventDefault(); if (!signature) return setError('Please sign in the signature box.')
    setSubmitting(true); setError('')
    const consent = 'I reviewed and agree to the scope, price, and terms, and intend my electronic signature to be legally binding.'
    const createDemoJob = () => {
  const existingJob = workspace.data.jobs.find(
    (job) => job.contract_id === contract.id
  );

  if (existingJob) return;

  const customer = contract.customer || workspace.customer(contract.customer_id);

  workspace.add("jobs", {
    number: `JOB-${new Date().getFullYear()}-${String(
      workspace.data.jobs.length + 90
    ).padStart(4, "0")}`,
    contract_id: contract.id,
    customer_id: contract.customer_id,
    title: contract.scope_of_work || contract.title || "Tree Service Job",
    crew_id: "",
    date: contract.service_date || new Date().toISOString().slice(0, 10),
    start_time: "07:30",
    status: "scheduled",
    address: customer?.service_address || "",
    foreman_notes: contract.scope_of_work || "",
    equipment: "",
    completion_notes: "",
    photos: [],
  });
};
    if (token.startsWith('demo-') || !supabase) {
    workspace.update("contracts", contract.id, {
  status: "signed",
  signed_at: new Date().toISOString(),
  signature_name: name,
  signer_email: email,
  signature_data: signature,
  acceptance_user_agent: navigator.userAgent,
  consent_text: consent,
});

createDemoJob();

setDone(true);
setSubmitting(false);
return;
    }
    const { data, error: rpcError } = await supabase.rpc('submit_contract_signature', { p_token: token, p_name: name, p_email: email, p_signature_data: signature, p_user_agent: navigator.userAgent, p_consent_text: consent })
    if (rpcError || !data?.ok) setError(rpcError?.message || 'The signature could not be saved. Please call Valid Tree Service.')
else {
  const { error: jobError } = await supabase.rpc(
    "create_job_from_signed_contract",
    { p_token: token }
  );

  if (jobError) {
    console.error("Signed, but job creation failed:", jobError);
  }

  setDone(true);
}
    setSubmitting(false)
  }

  if (loading) return <main className="sign-page"><div className="sign-error"><img src="/valid-tree-logo.png" alt="Valid Tree Service" /><h1>Loading agreement…</h1></div></main>
  if (error && !contract) return <main className="sign-page"><div className="sign-error"><img src="/valid-tree-logo.png" alt="Valid Tree Service" /><h1>This agreement is unavailable.</h1><p>{error}</p></div></main>
  if (done || contract?.signed_at) return <main className="sign-page"><div className="sign-success"><img src="/valid-tree-logo.png" alt="Valid Tree Service" /><div className="success-mark">✓</div><h1>Agreement signed</h1><p>Valid Tree Service has received your acceptance of contract <strong>{contract.contract_number}</strong>.</p><button className="button primary" onClick={() => window.print()}>Print confirmation</button></div></main>

  const customer = contract.customer || {}
  const company = contract.company || {}
  return <main className="sign-page"><article className="sign-doc">
    <header><img src="/valid-tree-logo.png" alt="Valid Tree Service" /><div><strong>{company.legal_name || 'Valid Tree Service LLC'}</strong><span>{company.phone}</span><span>{company.email}</span></div></header>
    <div className="sign-title"><div><p>PROFESSIONAL TREE CARE AGREEMENT</p><h1>{contract.title}</h1></div><div><span>Contract</span><strong>{contract.contract_number}</strong></div></div>
    <div className="sign-parties"><div><span>Customer</span><strong>{customer.full_name}</strong><p>{customer.service_address}</p></div><div><span>Project date</span><strong>{contract.service_date || 'To be scheduled'}</strong><p>Houston, Texas</p></div></div>
    <section><h2>Scope of work</h2><ul>{String(contract.scope_of_work || '').split('\n').filter(Boolean).map((x, i) => <li key={i}>{x}</li>)}</ul></section>
    <section><h2>Price and payment</h2><div className="price-lines"><p><span>Contract total</span><strong>{money(contract.total_price)}</strong></p><p><span>Deposit</span><strong>{money(contract.deposit)}</strong></p><p className="total"><span>Balance due</span><strong>{money(Number(contract.total_price) - Number(contract.deposit))}</strong></p></div></section>
    <section className="legal"><h2>Agreement terms</h2><p>{contract.terms || company.payment_terms || 'The customer authorizes Valid Tree Service LLC to perform the work described above. Changes outside the written scope require approval and may result in additional charges. Work may be delayed for unsafe weather, site conditions, utility conflicts, or other hazards.'}</p></section>
    <form className="signature-form" onSubmit={sign}><h2>Accept and sign</h2>
      {error ? <p className="form-message error">{error}</p> : null}
      <label>Printed name<input value={name} onChange={(e) => setName(e.target.value)} required /></label>
      <label>Email for receipt<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
<SignaturePad
  value={signature}
  onChange={setSignature}
/>
      <label className="accept"><input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} required /><span>I have reviewed and agree to the scope, price, and terms above. I intend my electronic signature to be legally binding.</span></label>
      <button className="button primary wide-button" disabled={!agreed || submitting}>{submitting ? 'Saving signature…' : 'Sign agreement'}</button>
      <small>The signed record includes the date, time, consent text, document token, and browser information for audit purposes.</small>
    </form><footer>{company.legal_name || 'Valid Tree Service LLC'} · {company.tagline || 'Safe. Skilled. Reliable.'}</footer>
  </article></main>
}
