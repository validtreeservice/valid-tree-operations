import { useState } from 'react'
import { useWorkspace } from '../data/WorkspaceProvider'
import { money } from '../lib/operations'
import { Empty, Field, PageHeader } from '../components/OperationsUI'

const today = () => new Date().toISOString().slice(0, 10)
export default function FleetPage() {
  const ws = useWorkspace()
  const [equipment, setEquipment] = useState({ name: '', type: 'chipper', make: '', model: '', ownership: 'owned', status: 'available', current_hours: 0, hourly_cost: 0, payment_amount: 0, payment_frequency: 'monthly' })
  const [fuel, setFuel] = useState({ equipment_id: '', job_id: '', fuel_date: today(), fuel_type: 'diesel', gallons: '', price_per_gallon: '', vendor: '' })
  const [maintenance, setMaintenance] = useState({ equipment_id: '', job_id: '', service_date: today(), service_type: 'preventive', description: '', cost: '', downtime_hours: 0 })
  const [rental, setRental] = useState({ job_id: '', equipment_name: '', vendor: '', start_date: today(), end_date: '', rate: '', rate_unit: 'day', customer_provided: false, fuel_responsibility: 'contractor', status: 'reserved' })
  return <div className="operations-page"><PageHeader eyebrow="Utilization and ownership cost" title="Fleet, Fuel & Maintenance" />
    <div className="module-grid">
      <section className="panel"><h2>Add equipment</h2><form className="form-grid" onSubmit={async (e) => { e.preventDefault(); await ws.addAndWait('equipment', { ...equipment, current_hours: Number(equipment.current_hours), hourly_cost: Number(equipment.hourly_cost), payment_amount: Number(equipment.payment_amount) }); setEquipment({ ...equipment, name: '', make: '', model: '' }) }}>
        <Field label="Name"><input required value={equipment.name} onChange={(e) => setEquipment({ ...equipment, name: e.target.value })} /></Field><Field label="Type"><input required value={equipment.type} onChange={(e) => setEquipment({ ...equipment, type: e.target.value })} /></Field>
        <Field label="Make"><input value={equipment.make} onChange={(e) => setEquipment({ ...equipment, make: e.target.value })} /></Field><Field label="Model"><input value={equipment.model} onChange={(e) => setEquipment({ ...equipment, model: e.target.value })} /></Field>
        <Field label="Ownership"><select value={equipment.ownership} onChange={(e) => setEquipment({ ...equipment, ownership: e.target.value })}>{['owned','financed','leased','customer','rented'].map((x) => <option key={x}>{x}</option>)}</select></Field>
        <Field label="Current hours"><input type="number" min="0" step=".1" value={equipment.current_hours} onChange={(e) => setEquipment({ ...equipment, current_hours: e.target.value })} /></Field>
        <Field label="Hourly cost"><input type="number" min="0" step=".01" value={equipment.hourly_cost} onChange={(e) => setEquipment({ ...equipment, hourly_cost: e.target.value })} /></Field>
        <Field label="Payment"><input type="number" min="0" step=".01" value={equipment.payment_amount} onChange={(e) => setEquipment({ ...equipment, payment_amount: e.target.value })} /></Field>
        <button className="button primary wide">Add equipment</button>
      </form></section>
      <section className="panel"><h2>Fuel log</h2><form className="form-grid" onSubmit={async (e) => { e.preventDefault(); await ws.addAndWait('fuel_logs', { ...fuel, equipment_id: fuel.equipment_id || null, job_id: fuel.job_id || null, gallons: Number(fuel.gallons), price_per_gallon: Number(fuel.price_per_gallon), total_cost: Number(fuel.gallons) * Number(fuel.price_per_gallon) }); setFuel({ ...fuel, gallons: '', price_per_gallon: '' }) }}>
        <Field label="Equipment"><select value={fuel.equipment_id} onChange={(e) => setFuel({ ...fuel, equipment_id: e.target.value })}><option value="">General fuel</option>{ws.data.equipment.map((x) => <option value={x.id} key={x.id}>{x.name}</option>)}</select></Field>
        <Field label="Job"><select value={fuel.job_id} onChange={(e) => setFuel({ ...fuel, job_id: e.target.value })}><option value="">Overhead</option>{ws.data.jobs.map((x) => <option value={x.id} key={x.id}>{x.number}</option>)}</select></Field>
        <Field label="Gallons"><input required min=".001" step=".001" type="number" value={fuel.gallons} onChange={(e) => setFuel({ ...fuel, gallons: e.target.value })} /></Field><Field label="Price / gallon"><input required min="0" step=".001" type="number" value={fuel.price_per_gallon} onChange={(e) => setFuel({ ...fuel, price_per_gallon: e.target.value })} /></Field>
        <Field label="Vendor"><input value={fuel.vendor} onChange={(e) => setFuel({ ...fuel, vendor: e.target.value })} /></Field><Field label="Date"><input type="date" value={fuel.fuel_date} onChange={(e) => setFuel({ ...fuel, fuel_date: e.target.value })} /></Field>
        <button className="button primary wide">Save fuel</button>
      </form></section>
      <section className="panel"><h2>Maintenance / repair</h2><form className="form-grid" onSubmit={async (e) => { e.preventDefault(); await ws.addAndWait('maintenance_records', { ...maintenance, equipment_id: maintenance.equipment_id, job_id: maintenance.job_id || null, cost: Number(maintenance.cost), downtime_hours: Number(maintenance.downtime_hours) }); setMaintenance({ ...maintenance, description: '', cost: '' }) }}>
        <Field label="Equipment"><select required value={maintenance.equipment_id} onChange={(e) => setMaintenance({ ...maintenance, equipment_id: e.target.value })}><option value="">Choose equipment</option>{ws.data.equipment.map((x) => <option value={x.id} key={x.id}>{x.name}</option>)}</select></Field>
        <Field label="Job"><select value={maintenance.job_id} onChange={(e) => setMaintenance({ ...maintenance, job_id: e.target.value })}><option value="">Not job-specific</option>{ws.data.jobs.map((x) => <option value={x.id} key={x.id}>{x.number}</option>)}</select></Field>
        <Field label="Type"><input value={maintenance.service_type} onChange={(e) => setMaintenance({ ...maintenance, service_type: e.target.value })} /></Field><Field label="Date"><input type="date" value={maintenance.service_date} onChange={(e) => setMaintenance({ ...maintenance, service_date: e.target.value })} /></Field>
        <Field label="Description" className="wide"><textarea required value={maintenance.description} onChange={(e) => setMaintenance({ ...maintenance, description: e.target.value })} /></Field><Field label="Cost"><input required min="0" step=".01" type="number" value={maintenance.cost} onChange={(e) => setMaintenance({ ...maintenance, cost: e.target.value })} /></Field>
        <Field label="Downtime hours"><input min="0" step=".1" type="number" value={maintenance.downtime_hours} onChange={(e) => setMaintenance({ ...maintenance, downtime_hours: e.target.value })} /></Field><button className="button primary wide">Save service</button>
      </form></section>
      <section className="panel"><h2>Rental</h2><form className="form-grid" onSubmit={async (e) => { e.preventDefault(); await ws.addAndWait('rentals', { ...rental, job_id: rental.job_id || null, rate: Number(rental.rate) }); setRental({ ...rental, equipment_name: '', vendor: '', rate: '' }) }}>
        <Field label="Equipment"><input required value={rental.equipment_name} onChange={(e) => setRental({ ...rental, equipment_name: e.target.value })} /></Field><Field label="Vendor"><input value={rental.vendor} onChange={(e) => setRental({ ...rental, vendor: e.target.value })} /></Field>
        <Field label="Job"><select value={rental.job_id} onChange={(e) => setRental({ ...rental, job_id: e.target.value })}><option value="">Unassigned</option>{ws.data.jobs.map((x) => <option value={x.id} key={x.id}>{x.number}</option>)}</select></Field><Field label="Rate"><input required type="number" min="0" step=".01" value={rental.rate} onChange={(e) => setRental({ ...rental, rate: e.target.value })} /></Field>
        <Field label="Rate unit"><select value={rental.rate_unit} onChange={(e) => setRental({ ...rental, rate_unit: e.target.value })}>{['hour','day','week','month','flat'].map((x) => <option key={x}>{x}</option>)}</select></Field><Field label="Starts"><input type="date" value={rental.start_date} onChange={(e) => setRental({ ...rental, start_date: e.target.value })} /></Field>
        <label className="check wide"><input type="checkbox" checked={rental.customer_provided} onChange={(e) => setRental({ ...rental, customer_provided: e.target.checked })} /> Customer-provided equipment</label><button className="button primary wide">Save rental</button>
      </form></section>
      <section className="panel full-span"><h2>Fleet register</h2>{ws.data.equipment.length ? <div className="data-table"><div className="table-head"><span>Equipment</span><span>Ownership</span><span>Status</span><span>Hours</span><span>Cost / hour</span></div>{ws.data.equipment.map((x) => <div className="table-row" key={x.id}><span><strong>{x.name}</strong><small>{x.make} {x.model}</small></span><span>{x.ownership}</span><span>{x.status}</span><span>{x.current_hours}</span><span>{money(x.hourly_cost)}</span></div>)}</div> : <Empty>No equipment entered.</Empty>}</section>
    </div>
  </div>
}
