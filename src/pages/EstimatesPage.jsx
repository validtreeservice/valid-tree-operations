import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useWorkspace } from "../data/WorkspaceProvider";
import PageHeader from "../components/PageHeader";
import Modal from "../components/Modal";
import StatusBadge from "../components/StatusBadge";

const blank = {
  customer_id: "",
  title: "",
  amount: "",
  status: "draft",
  expires_at: "",
};

const money = (value) =>
  Number(value || 0).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });

const makeToken = () =>
  crypto.randomUUID?.() ||
  `${Date.now()}-${Math.random().toString(36).slice(2)}`;

export default function EstimatesPage() {
  const navigate = useNavigate();

  const {
    data,
    customer,
    add,
    addAndWait,
    update,
    updateAndWait,
    remove,
  } = useWorkspace();

  const estimates = data.estimates || [];
  const contracts = data.contracts || [];
  const customers = data.customers || [];

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(blank);
  const [convertingId, setConvertingId] = useState(null);

  const nextEstimateNumber = useMemo(
    () =>
      `EST-${new Date().getFullYear()}-${String(
        estimates.length + 43
      ).padStart(4, "0")}`,
    [estimates.length]
  );

  const nextContractNumber = useMemo(
    () =>
      `VTS-${new Date().getFullYear()}-${String(
        contracts.length + 39
      ).padStart(4, "0")}`,
    [contracts.length]
  );

  function save(event) {
    event.preventDefault();

    add("estimates", {
      ...form,
      number: nextEstimateNumber,
      amount: Number(form.amount),
    });

    setForm(blank);
    setOpen(false);
  }

  async function convertEstimate(estimate) {
    if (convertingId) return;

    const possibleDuplicate = contracts.find(
      (contract) =>
        contract.customer_id === estimate.customer_id &&
        contract.scope_of_work === estimate.title &&
        Number(contract.total_price) === Number(estimate.amount)
    );

    if (possibleDuplicate) {
      window.alert(
        `A matching contract already exists: ${possibleDuplicate.contract_number}`
      );

      navigate("/contracts");
      return;
    }

    const depositPercent = Number(
      data.settings?.depositPercent || 30
    );

    const amount = Number(estimate.amount || 0);

    setConvertingId(estimate.id);

    try {
      await addAndWait("contracts", {
        contract_number: nextContractNumber,
        customer_id: estimate.customer_id,
        title: "Tree Service Agreement",
        scope_of_work: estimate.title,
        total_price: amount,
        deposit: Number(
          ((amount * depositPercent) / 100).toFixed(2)
        ),
        status: "draft",
service_date: null,
        sign_token: makeToken(),
        signed_at: null,
        signature_name: null,
        signature_data: null,
      });

      await updateAndWait("estimates", estimate.id, {
        status: "approved",
      });

      navigate("/contracts");
    } catch (error) {
      console.error("Contract conversion failed:", error);

      window.alert(
        `Contract could not be saved: ${
          error?.message || "Unknown error"
        }`
      );
    } finally {
      setConvertingId(null);
    }
  }

  function deleteEstimate(estimate) {
    const confirmed = window.confirm(
      `Delete estimate ${estimate.number}? This cannot be undone.`
    );

    if (!confirmed) return;

    remove("estimates", estimate.id);
  }

  return (
    <section>
      <PageHeader
        title="Estimates"
        description="Create proposals, track customer decisions, and convert approved work into contracts."
        action={
          <button
            type="button"
            className="button primary"
            onClick={() => setOpen(true)}
          >
            New estimate
          </button>
        }
      />

      <div className="pipeline">
        {["draft", "sent", "approved", "declined"].map(
          (status) => {
            const matching = estimates.filter(
              (estimate) => estimate.status === status
            );

            return (
              <div key={status}>
                <span>{status}</span>
                <strong>{matching.length}</strong>

                <small>
                  {money(
                    matching.reduce(
                      (total, estimate) =>
                        total + Number(estimate.amount || 0),
                      0
                    )
                  )}
                </small>
              </div>
            );
          }
        )}
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Estimate</th>
              <th>Customer</th>
              <th>Work</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Expires</th>
              <th>Actions</th>
            </tr>
          </thead>

          <tbody>
            {estimates.map((estimate) => (
              <tr key={estimate.id}>
                <td>
                  <strong>{estimate.number}</strong>
                </td>

                <td>
                  {customer(estimate.customer_id)?.full_name ||
                    "Unknown customer"}
                </td>

                <td>{estimate.title}</td>

                <td>
                  <strong>{money(estimate.amount)}</strong>
                </td>

                <td>
                  <StatusBadge value={estimate.status} />
                </td>

                <td>{estimate.expires_at || "—"}</td>

                <td>
                  <div className="row-actions">
                    <select
                      value={estimate.status}
                      onChange={(event) =>
                        update("estimates", estimate.id, {
                          status: event.target.value,
                        })
                      }
                    >
                      <option value="draft">Draft</option>
                      <option value="sent">Sent</option>
                      <option value="approved">Approved</option>
                      <option value="declined">Declined</option>
                    </select>

                    {estimate.status !== "declined" ? (
                      <button
                        type="button"
                        disabled={convertingId === estimate.id}
                        onClick={() =>
                          convertEstimate(estimate)
                        }
                      >
                        {convertingId === estimate.id
                          ? "Converting…"
                          : "Convert to contract"}
                      </button>
                    ) : null}

                    <button
                      type="button"
                      className="text-button danger"
                      disabled={convertingId === estimate.id}
                      onClick={() => deleteEstimate(estimate)}
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}

            {estimates.length === 0 ? (
              <tr>
                <td colSpan="7">No estimates yet.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <Modal
        title="New estimate"
        open={open}
        onClose={() => setOpen(false)}
      >
        <form className="form-grid" onSubmit={save}>
          <label>
            Estimate number
            <input value={nextEstimateNumber} disabled />
          </label>

          <label>
            Customer
            <select
              value={form.customer_id}
              onChange={(event) =>
                setForm({
                  ...form,
                  customer_id: event.target.value,
                })
              }
              required
            >
              <option value="">Select customer…</option>

              {customers.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.full_name}
                </option>
              ))}
            </select>
          </label>

          <label className="wide">
            Description and scope
            <textarea
              rows="7"
              value={form.title}
              onChange={(event) =>
                setForm({
                  ...form,
                  title: event.target.value,
                })
              }
              placeholder={`Remove one oak tree from the front yard.
Grind stump below grade.
Haul all generated debris.
Leave the property clean.`}
              required
            />
          </label>

          <label>
            Amount
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.amount}
              onChange={(event) =>
                setForm({
                  ...form,
                  amount: event.target.value,
                })
              }
              required
            />
          </label>

          <label>
            Expires
            <input
              type="date"
              value={form.expires_at}
              onChange={(event) =>
                setForm({
                  ...form,
                  expires_at: event.target.value,
                })
              }
            />
          </label>

          <label>
            Status
            <select
              value={form.status}
              onChange={(event) =>
                setForm({
                  ...form,
                  status: event.target.value,
                })
              }
            >
              <option value="draft">Draft</option>
              <option value="sent">Sent</option>
            </select>
          </label>

          <div className="form-actions wide">
            <button
              type="button"
              className="button secondary"
              onClick={() => setOpen(false)}
            >
              Cancel
            </button>

            <button type="submit" className="button primary">
              Create estimate
            </button>
          </div>
        </form>
      </Modal>
    </section>
  );
}