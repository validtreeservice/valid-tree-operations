import { useMemo, useState } from "react";
import { useWorkspace } from "../data/WorkspaceProvider";
import PageHeader from "../components/PageHeader";
import Modal from "../components/Modal";
import StatusBadge from "../components/StatusBadge";
import { printContract } from "../lib/contractPrint";

const blankContract = {
  customer_id: "",
  title: "Tree Service Agreement",
  scope_of_work: "",
  total_price: "",
  deposit: "",
  service_date: "",
  status: "draft",
};

const money = (value) =>
  Number(value || 0).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });

const makeToken = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

export default function ContractsPage() {
const { data, customer, add, update, remove } = useWorkspace();

  const contracts = data.contracts || [];
  const customers = data.customers || [];

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(blankContract);
  const [selected, setSelected] = useState(null);

  const nextContractNumber = useMemo(() => {
    const year = new Date().getFullYear();
    const sequence = contracts.length + 39;

    return `VTS-${year}-${String(sequence).padStart(4, "0")}`;
  }, [contracts.length]);

  function openNewContract() {
    setEditingId(null);
    setForm(blankContract);
    setEditorOpen(true);
  }

  function openEditContract(contract) {
    setEditingId(contract.id);

    setForm({
      customer_id: contract.customer_id || "",
      title: contract.title || "Tree Service Agreement",
      scope_of_work: contract.scope_of_work || "",
      total_price: contract.total_price ?? "",
      deposit: contract.deposit ?? "",
      service_date: contract.service_date || "",
      status: contract.status || "draft",
    });

    setEditorOpen(true);
  }

  function closeEditor() {
    setEditorOpen(false);
    setEditingId(null);
    setForm(blankContract);
  }

  function saveContract(event) {
    event.preventDefault();

    const totalPrice = Number(form.total_price || 0);
    const deposit = Number(form.deposit || 0);

    if (!form.customer_id) {
      alert("Please select a customer.");
      return;
    }

    if (!form.scope_of_work.trim()) {
      alert("Please enter the scope of work.");
      return;
    }

    if (totalPrice <= 0) {
      alert("Please enter a valid contract price.");
      return;
    }

    const values = {
      ...form,
      total_price: totalPrice,
      deposit,
    };

    if (editingId) {
      update("contracts", editingId, values);

      const updatedContract = {
        ...contracts.find((contract) => contract.id === editingId),
        ...values,
      };

      setSelected(updatedContract);
    } else {
      const createdContract = add("contracts", {
        ...values,
        contract_number: nextContractNumber,
        sign_token: makeToken(),
        signed_at: null,
        signature_name: null,
        signature_data: null,
      });

      setSelected(createdContract);
    }

    closeEditor();
  }

  async function copySignatureLink(contract) {
    const baseUrl =
      import.meta.env.VITE_PUBLIC_SITE_URL || window.location.origin;

    const signatureUrl = `${baseUrl}/sign/${contract.sign_token}`;

    try {
      await navigator.clipboard.writeText(signatureUrl);
      update("contracts", contract.id, { status: "sent" });

      if (selected?.id === contract.id) {
        setSelected({ ...selected, status: "sent" });
      }

      alert(`Signature link copied:\n\n${signatureUrl}`);
    } catch {
      window.prompt("Copy this signature link:", signatureUrl);
    }
  }

  function generatePdf(contract) {
    printContract({
      ...contract,
      customers: customer(contract.customer_id),
      settings: data.settings,
    });
  }

  function duplicateContract(contract) {
    const duplicated = add("contracts", {
      customer_id: contract.customer_id,
      contract_number: nextContractNumber,
      title: `${contract.title} - Copy`,
      scope_of_work: contract.scope_of_work,
      total_price: Number(contract.total_price || 0),
      deposit: Number(contract.deposit || 0),
      service_date: "",
      status: "draft",
      sign_token: makeToken(),
      signed_at: null,
      signature_name: null,
      signature_data: null,
    });

    setSelected(duplicated);
    alert(`Contract ${duplicated.contract_number} was created.`);
  }

  function changeStatus(contract, status) {
    update("contracts", contract.id, { status });

    const updatedContract = {
      ...contract,
      status,
    };

    setSelected(updatedContract);
  }

  return (
    <section>
      <PageHeader
        title="Contracts"
        description="Create branded agreements, generate PDFs, and collect customer signatures remotely or onsite."
        action={
          <button className="button primary" onClick={openNewContract}>
            New contract
          </button>
        }
      />

      <div className="contract-list">
        {contracts.length === 0 ? (
          <article>
            <div className="doc-main">
              <h3>No contracts yet</h3>
              <p>Create your first customer agreement.</p>
            </div>
          </article>
        ) : (
          contracts.map((contract) => {
            const contractCustomer = customer(contract.customer_id);

            return (
              <article key={contract.id}>
                <div className="doc-icon">▤</div>

                <button
                  className="doc-main"
                  onClick={() => setSelected(contract)}
                >
                  <span>{contract.contract_number}</span>
                  <h3>{contract.title}</h3>
                  <p>
                    {contractCustomer?.full_name || "Unknown customer"} ·{" "}
                    {contract.service_date || "Not scheduled"}
                  </p>
                </button>

                <div className="doc-value">
                  <strong>{money(contract.total_price)}</strong>
                  <StatusBadge value={contract.status} />
                </div>

                <div className="doc-actions">
                  <button onClick={() => generatePdf(contract)}>PDF</button>

                  <button onClick={() => copySignatureLink(contract)}>
                    Copy sign link
                  </button>

                  <button
                    className="primary-mini"
                    onClick={() => setSelected(contract)}
                  >
                    Open
                  </button>
                </div>
              </article>
            );
          })
        )}
      </div>

      <Modal
        title={editingId ? "Edit contract" : "New contract"}
        open={editorOpen}
        onClose={closeEditor}
      >
        <form className="form-grid" onSubmit={saveContract}>
          <label>
            Contract number
            <input
              value={
                editingId
                  ? contracts.find((contract) => contract.id === editingId)
                      ?.contract_number || ""
                  : nextContractNumber
              }
              disabled
            />
          </label>

          <label>
            Customer
            <select
              required
              value={form.customer_id}
              onChange={(event) =>
                setForm({
                  ...form,
                  customer_id: event.target.value,
                })
              }
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
            Contract title
            <input
              value={form.title}
              onChange={(event) =>
                setForm({
                  ...form,
                  title: event.target.value,
                })
              }
              required
            />
          </label>

          <label className="wide">
            Scope of work
            <textarea
              rows="10"
              value={form.scope_of_work}
              onChange={(event) =>
                setForm({
                  ...form,
                  scope_of_work: event.target.value,
                })
              }
              placeholder={`Example:
Remove one mature oak tree from the front yard.
Grind stump approximately 6–8 inches below grade.
Haul all generated debris.
Leave the work area broom clean.`}
              required
            />
          </label>

          <label>
            Total contract price
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.total_price}
              onChange={(event) => {
                const price = Number(event.target.value || 0);
                const depositPercent = Number(
                  data.settings?.depositPercent || 30
                );

                setForm({
                  ...form,
                  total_price: event.target.value,
                  deposit: ((price * depositPercent) / 100).toFixed(2),
                });
              }}
              required
            />
          </label>

          <label>
            Deposit
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.deposit}
              onChange={(event) =>
                setForm({
                  ...form,
                  deposit: event.target.value,
                })
              }
            />
          </label>

          <label>
            Service date
            <input
              type="date"
              value={form.service_date}
              onChange={(event) =>
                setForm({
                  ...form,
                  service_date: event.target.value,
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
              <option value="signed">Signed</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </label>

          <div className="form-actions wide">
            <button
              type="button"
              className="button secondary"
              onClick={closeEditor}
            >
              Cancel
            </button>

            <button className="button primary">
              {editingId ? "Save changes" : "Create contract"}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        title={selected?.contract_number || "Contract"}
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
      >
        {selected ? (
          <div className="contract-detail">
            <div className="detail-hero">
              <div>
                <p className="eyebrow">{selected.contract_number}</p>
                <h2>{selected.title}</h2>
                <p>
                  {customer(selected.customer_id)?.full_name ||
                    "Unknown customer"}
                </p>
              </div>

              <strong>{money(selected.total_price)}</strong>
            </div>

            <div className="scope-preview">
              <span>Scope of work</span>
              <p style={{ whiteSpace: "pre-wrap" }}>
                {selected.scope_of_work}
              </p>
            </div>

            <div className="detail-grid">
              <div>
                <span>Deposit</span>
                <strong>{money(selected.deposit)}</strong>
              </div>

              <div>
                <span>Remaining balance</span>
                <strong>
                  {money(
                    Number(selected.total_price || 0) -
                      Number(selected.deposit || 0)
                  )}
                </strong>
              </div>

              <div>
                <span>Service date</span>
                <strong>{selected.service_date || "Not scheduled"}</strong>
              </div>

              <div>
                <span>Signature</span>
                <strong>
                  {selected.signed_at
                    ? `Signed by ${selected.signature_name || "customer"}`
                    : "Awaiting customer"}
                </strong>
              </div>
            </div>

            <label>
              Contract status
              <select
                value={selected.status}
                onChange={(event) =>
                  changeStatus(selected, event.target.value)
                }
              >
                <option value="draft">Draft</option>
                <option value="sent">Sent</option>
                <option value="signed">Signed</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </label>

            <div className="form-actions">
              <button
                className="button secondary"
                onClick={() => openEditContract(selected)}
              >
                Edit
              </button>

              <button
                className="button secondary"
                onClick={() => duplicateContract(selected)}
              >
                Duplicate
              </button>
<button
  className="button secondary"
  onClick={() => {
    const confirmed = window.confirm(
      `Delete ${selected.contract_number}? This cannot be undone.`
    );

    if (!confirmed) return;

    remove("contracts", selected.id);
    setSelected(null);
  }}
>
  Delete contract
</button>
              <button
                className="button secondary"
                onClick={() => generatePdf(selected)}
              >
                Print / PDF
              </button>

              <button
                className="button secondary"
                onClick={() => copySignatureLink(selected)}
              >
                Copy signature link
              </button>

              <button
                className="button primary"
                onClick={() =>
                  window.open(`/sign/${selected.sign_token}`, "_blank")
                }
              >
                Open signing page
              </button>
            </div>
          </div>
        ) : null}
      </Modal>
    </section>
  );
}