import { useMemo, useState } from "react";
import { useWorkspace } from "../data/WorkspaceProvider";
import Modal from "../components/Modal";
import PageHeader from "../components/PageHeader";

const blank = {
  full_name: "",
  phone: "",
  email: "",
  service_address: "",
  notes: "",
};

export default function CustomersPage() {
  const { data, add, update, remove } = useWorkspace();

  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState(blank);

  const rows = useMemo(
    () =>
      data.customers.filter((customer) =>
        Object.values(customer)
          .join(" ")
          .toLowerCase()
          .includes(q.toLowerCase())
      ),
    [data.customers, q]
  );

  function save(event) {
    event.preventDefault();

    if (selected) {
      update("customers", selected.id, form);
    } else {
      add("customers", form);
    }

    setOpen(false);
    setSelected(null);
    setForm(blank);
  }

  function edit(customer) {
    setSelected(customer);
    setForm(customer);
    setOpen(true);
  }

  function deleteCustomer() {
    if (!selected) return;

    const estimates = data.estimates.filter(
      (item) => item.customer_id === selected.id
    );

    const contracts = data.contracts.filter(
      (item) => item.customer_id === selected.id
    );

    const jobs = data.jobs.filter(
      (item) => item.customer_id === selected.id
    );

    const invoices = data.invoices.filter(
      (item) => item.customer_id === selected.id
    );

    const relatedCount =
      estimates.length +
      contracts.length +
      jobs.length +
      invoices.length;

    if (relatedCount > 0) {
      alert(
        `This customer cannot be deleted yet.\n\n` +
          `${estimates.length} estimate(s)\n` +
          `${contracts.length} contract(s)\n` +
          `${jobs.length} job(s)\n` +
          `${invoices.length} invoice(s)\n\n` +
          `Delete those records first, then delete the customer.`
      );

      return;
    }

    const confirmed = window.confirm(
      `Delete ${selected.full_name}?\n\nThis cannot be undone.`
    );

    if (!confirmed) return;

    remove("customers", selected.id);
    setOpen(false);
    setSelected(null);
    setForm(blank);
  }

  return (
    <section>
      <PageHeader
        title="Customers"
        description="Every property, conversation, document, and dollar in one customer record."
        action={
          <button
            className="button primary"
            onClick={() => {
              setSelected(null);
              setForm(blank);
              setOpen(true);
            }}
          >
            New customer
          </button>
        }
      />

      <div className="toolbar">
        <input
          className="search"
          placeholder="Search name, phone, email, or address…"
          value={q}
          onChange={(event) => setQ(event.target.value)}
        />

        <span>{rows.length} customers</span>
      </div>

      <div className="customer-grid">
        {rows.map((customer) => {
          const jobs = data.jobs.filter(
            (job) => job.customer_id === customer.id
          );

          const value = data.contracts
            .filter(
              (contract) => contract.customer_id === customer.id
            )
            .reduce(
              (total, contract) =>
                total + Number(contract.total_price || 0),
              0
            );

          const signedContracts = data.contracts.filter(
            (contract) =>
              contract.customer_id === customer.id &&
              contract.status === "signed"
          ).length;

          return (
            <article
              className="customer-card"
              key={customer.id}
              onClick={() => edit(customer)}
            >
              <div className="customer-top">
                <div className="initials">
                  {customer.full_name
                    .split(" ")
                    .map((part) => part[0])
                    .slice(0, 2)
                    .join("")}
                </div>

                <div>
                  <h3>{customer.full_name}</h3>
                  <p>{customer.service_address}</p>
                </div>
              </div>

              <div className="customer-contact">
                <span>{customer.phone || "No phone"}</span>
                <span>{customer.email || "No email"}</span>
              </div>

              <div className="customer-stats">
                <div>
                  <strong>{jobs.length}</strong>
                  <span>Jobs</span>
                </div>

                <div>
                  <strong>
                    {value.toLocaleString("en-US", {
                      style: "currency",
                      currency: "USD",
                    })}
                  </strong>
                  <span>Contracted</span>
                </div>

                <div>
                  <strong>{signedContracts}</strong>
                  <span>Signed</span>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      <Modal
        title={selected ? "Customer profile" : "New customer"}
        open={open}
        onClose={() => setOpen(false)}
      >
        <form className="form-grid" onSubmit={save}>
          <label className="wide">
            Full name / company
            <input
              value={form.full_name}
              onChange={(event) =>
                setForm({
                  ...form,
                  full_name: event.target.value,
                })
              }
              required
            />
          </label>

          <label>
            Phone
            <input
              value={form.phone}
              onChange={(event) =>
                setForm({
                  ...form,
                  phone: event.target.value,
                })
              }
            />
          </label>

          <label>
            Email
            <input
              type="email"
              value={form.email}
              onChange={(event) =>
                setForm({
                  ...form,
                  email: event.target.value,
                })
              }
            />
          </label>

          <label className="wide">
            Service address
            <input
              value={form.service_address}
              onChange={(event) =>
                setForm({
                  ...form,
                  service_address: event.target.value,
                })
              }
            />
          </label>

          <label className="wide">
            Notes
            <textarea
              rows="5"
              value={form.notes}
              onChange={(event) =>
                setForm({
                  ...form,
                  notes: event.target.value,
                })
              }
            />
          </label>

          {selected ? (
            <div className="related wide">
              <h3>Customer activity</h3>

              <p>
                {
                  data.estimates.filter(
                    (item) => item.customer_id === selected.id
                  ).length
                }{" "}
                estimates ·{" "}
                {
                  data.contracts.filter(
                    (item) => item.customer_id === selected.id
                  ).length
                }{" "}
                contracts ·{" "}
                {
                  data.jobs.filter(
                    (item) => item.customer_id === selected.id
                  ).length
                }{" "}
                jobs ·{" "}
                {
                  data.invoices.filter(
                    (item) => item.customer_id === selected.id
                  ).length
                }{" "}
                invoices
              </p>
            </div>
          ) : null}

          <div className="form-actions wide">
            {selected ? (
              <button
                type="button"
                className="text-button danger"
                onClick={deleteCustomer}
              >
                Delete customer
              </button>
            ) : (
              <span />
            )}

            <button
              type="button"
              className="button secondary"
              onClick={() => setOpen(false)}
            >
              Cancel
            </button>

            <button className="button primary">
              Save customer
            </button>
          </div>
        </form>
      </Modal>
    </section>
  );
}