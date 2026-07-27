import { useState } from "react";
import { useWorkspace } from "../data/WorkspaceProvider";
import PageHeader from "../components/PageHeader";
import Modal from "../components/Modal";
import StatusBadge from "../components/StatusBadge";

const blank = {
  customer_id: "",
  amount: "",
  paid: "0",
  due_date: "",
  description: "",
};

function money(value) {
  return Number(value || 0).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

function formatDate(value) {
  if (!value) return "—";

  return new Date(`${value}T12:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getInvoiceStatus(amount, paid, dueDate) {
  const total = Number(amount || 0);
  const received = Number(paid || 0);

  if (total > 0 && received >= total) {
    return "paid";
  }

  if (received > 0) {
    return "partial";
  }

  if (dueDate) {
    const due = new Date(`${dueDate}T23:59:59`);
    const now = new Date();

    if (due < now) {
      return "overdue";
    }
  }

  return "open";
}

export default function InvoicesPage() {
  const {
    data,
    customer,
    addAndWait,
    updateAndWait,
    remove,
  } = useWorkspace();

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(blank);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const invoices = Array.isArray(data?.invoices)
    ? data.invoices
    : [];

  const customers = Array.isArray(data?.customers)
    ? data.customers
    : [];

  const outstanding = invoices.reduce((sum, invoice) => {
    const amount = Number(invoice.amount || 0);
    const paid = Number(invoice.paid || 0);

    return sum + Math.max(amount - paid, 0);
  }, 0);

  const overdue = invoices.reduce((sum, invoice) => {
    const status = getInvoiceStatus(
      invoice.amount,
      invoice.paid,
      invoice.due_date
    );

    if (status !== "overdue") return sum;

    return (
      sum +
      Math.max(
        Number(invoice.amount || 0) -
          Number(invoice.paid || 0),
        0
      )
    );
  }, 0);

  const collected = invoices.reduce(
    (sum, invoice) => sum + Number(invoice.paid || 0),
    0
  );

  async function saveInvoice(event) {
    event.preventDefault();

    const amount = Number(form.amount);
    const paid = Number(form.paid || 0);

    if (!Number.isFinite(amount) || amount <= 0) {
      window.alert("Enter a valid invoice amount.");
      return;
    }

    if (!Number.isFinite(paid) || paid < 0) {
      window.alert("Enter a valid paid amount.");
      return;
    }

    const adjustedPaid = Math.min(paid, amount);

    const status = getInvoiceStatus(
      amount,
      adjustedPaid,
      form.due_date
    );

    try {
      setSaving(true);

      await addAndWait("invoices", {
        customer_id: form.customer_id,
        amount,
        paid: adjustedPaid,
        due_date: form.due_date || null,
        status,
        description: form.description.trim(),
        number: `INV-${new Date().getFullYear()}-${String(
          invoices.length + 70
        ).padStart(4, "0")}`,
        job_id: null,
      });

      setForm(blank);
      setOpen(false);
    } catch (error) {
      console.error("Invoice creation failed:", error);

      window.alert(
        error?.message ||
          error?.details ||
          "The invoice could not be created."
      );
    } finally {
      setSaving(false);
    }
  }

  async function recordPayment(invoice) {
    const amount = Number(invoice.amount || 0);
    const alreadyPaid = Number(invoice.paid || 0);
    const balance = Math.max(amount - alreadyPaid, 0);

    if (balance <= 0) {
      window.alert("This invoice is already paid.");
      return;
    }

    const answer = window.prompt(
      `Enter payment amount.\nRemaining balance: ${money(balance)}`,
      String(balance)
    );

    if (answer === null) return;

    const payment = Number(answer);

    if (!Number.isFinite(payment) || payment <= 0) {
      window.alert("Enter a valid payment amount.");
      return;
    }

    const newPaid = Math.min(alreadyPaid + payment, amount);

    const status = getInvoiceStatus(
      amount,
      newPaid,
      invoice.due_date
    );

    try {
      await updateAndWait("invoices", invoice.id, {
        paid: newPaid,
        status,
      });
    } catch (error) {
      console.error("Payment update failed:", error);

      window.alert(
        error?.message ||
          error?.details ||
          "The payment could not be recorded."
      );
    }
  }

  async function deleteInvoice(invoice) {
    const confirmed = window.confirm(
      `Delete ${invoice.number || "this invoice"}?\n\nThis cannot be undone.`
    );

    if (!confirmed) return;

    try {
      setDeletingId(invoice.id);

      if (typeof remove !== "function") {
        throw new Error(
          "The WorkspaceProvider delete function is not available."
        );
      }

      await remove("invoices", invoice.id);
    } catch (error) {
      console.error("Invoice deletion failed:", error);

      window.alert(
        error?.message ||
          error?.details ||
          "The invoice could not be deleted."
      );
    } finally {
      setDeletingId(null);
    }
  }

  function openReceipt(invoice) {
    const invoiceCustomer = customer(invoice.customer_id);

    const amount = Number(invoice.amount || 0);
    const paid = Number(invoice.paid || 0);
    const balance = Math.max(amount - paid, 0);

    const status = getInvoiceStatus(
      amount,
      paid,
      invoice.due_date
    );

    const isPaid = status === "paid";

    const receiptWindow = window.open(
      "",
      "_blank",
      "width=900,height=850"
    );

    if (!receiptWindow) {
      window.alert(
        "The browser blocked the receipt window. Allow pop-ups and try again."
      );
      return;
    }

    const customerName =
      invoiceCustomer?.full_name || "Customer";

    const customerAddress =
      invoiceCustomer?.service_address ||
      invoiceCustomer?.address ||
      "";

    const customerPhone =
      invoiceCustomer?.phone || "";

    const customerEmail =
      invoiceCustomer?.email || "";

    const description =
      invoice.description ||
      "Professional tree service work.";

    receiptWindow.document.write(`
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8" />

          <meta
            name="viewport"
            content="width=device-width, initial-scale=1"
          />

          <title>
            ${escapeHtml(invoice.number || "Invoice")}
          </title>

          <style>
            * {
              box-sizing: border-box;
            }

            body {
              margin: 0;
              padding: 40px;
              color: #1f291d;
              background: #eef1eb;
              font-family: Arial, Helvetica, sans-serif;
            }

            .document {
              width: 100%;
              max-width: 820px;
              margin: 0 auto;
              padding: 48px;
              background: #ffffff;
              border-radius: 16px;
              box-shadow: 0 12px 35px rgba(0, 0, 0, 0.12);
            }

            .header {
              display: flex;
              justify-content: space-between;
              gap: 32px;
              padding-bottom: 28px;
              border-bottom: 3px solid #8eb957;
            }

            .company h1 {
              margin: 0 0 8px;
              color: #173d29;
              font-size: 30px;
            }

            .company p,
            .document-info p,
            .customer-info p {
              margin: 4px 0;
              color: #5d675a;
              line-height: 1.5;
            }

            .document-info {
              text-align: right;
            }

            .document-info h2 {
              margin: 0 0 12px;
              color: #173d29;
              font-size: 24px;
              letter-spacing: 1px;
              text-transform: uppercase;
            }

            .status {
              display: inline-block;
              margin-top: 8px;
              padding: 7px 13px;
              border-radius: 999px;
              background: ${
                isPaid ? "#e2f1d3" : "#fff0c9"
              };
              color: ${isPaid ? "#315a20" : "#745600"};
              font-size: 12px;
              font-weight: 700;
              text-transform: uppercase;
            }

            .customer-info {
              margin-top: 30px;
            }

            .label {
              margin: 0 0 8px;
              color: #788174;
              font-size: 12px;
              font-weight: 700;
              letter-spacing: 1px;
              text-transform: uppercase;
            }

            .customer-info h3 {
              margin: 0 0 6px;
              font-size: 20px;
            }

            .work {
              margin-top: 30px;
              padding: 20px;
              border: 1px solid #dce3d7;
              border-radius: 10px;
              background: #f8faf6;
            }

            .work p:last-child {
              margin: 8px 0 0;
              line-height: 1.6;
              white-space: pre-wrap;
            }

            table {
              width: 100%;
              margin-top: 30px;
              border-collapse: collapse;
            }

            th {
              padding: 12px 8px;
              color: #687164;
              border-bottom: 1px solid #dce3d7;
              font-size: 12px;
              letter-spacing: 0.7px;
              text-align: left;
              text-transform: uppercase;
            }

            th:last-child,
            td:last-child {
              text-align: right;
            }

            td {
              padding: 18px 8px;
              border-bottom: 1px solid #e5e9e2;
            }

            .totals {
              width: 330px;
              max-width: 100%;
              margin: 28px 0 0 auto;
            }

            .total-row {
              display: flex;
              justify-content: space-between;
              gap: 20px;
              padding: 9px 0;
            }

            .balance {
              margin-top: 8px;
              padding-top: 16px;
              border-top: 2px solid #173d29;
              color: #173d29;
              font-size: 20px;
              font-weight: 700;
            }

            .footer {
              margin-top: 45px;
              padding-top: 25px;
              border-top: 1px solid #dce3d7;
              text-align: center;
            }

            .footer h3 {
              margin: 0 0 8px;
              color: #173d29;
            }

            .footer p {
              margin: 0;
              color: #687164;
            }

            .actions {
              max-width: 820px;
              margin: 20px auto 0;
              text-align: center;
            }

            button {
              padding: 13px 22px;
              color: #14220f;
              background: #91bd5a;
              border: none;
              border-radius: 8px;
              cursor: pointer;
              font-size: 15px;
              font-weight: 700;
            }

            @media print {
              body {
                padding: 0;
                background: white;
              }

              .document {
                max-width: none;
                padding: 25px;
                border-radius: 0;
                box-shadow: none;
              }

              .actions {
                display: none;
              }
            }
          </style>
        </head>

        <body>
          <main class="document">
            <header class="header">
              <div class="company">
                <h1>Valid Tree Service LLC</h1>
                <p>Professional Tree Services</p>
                <p>Houston, Texas</p>
              </div>

              <div class="document-info">
                <h2>
                  ${isPaid ? "Payment Receipt" : "Invoice"}
                </h2>

                <p>
                  <strong>Number:</strong>
                  ${escapeHtml(invoice.number || "—")}
                </p>

                <p>
                  <strong>Due:</strong>
                  ${escapeHtml(formatDate(invoice.due_date))}
                </p>

                <span class="status">
                  ${escapeHtml(status)}
                </span>
              </div>
            </header>

            <section class="customer-info">
              <p class="label">Customer</p>

              <h3>${escapeHtml(customerName)}</h3>

              ${
                customerAddress
                  ? `<p>${escapeHtml(customerAddress)}</p>`
                  : ""
              }

              ${
                customerPhone
                  ? `<p>${escapeHtml(customerPhone)}</p>`
                  : ""
              }

              ${
                customerEmail
                  ? `<p>${escapeHtml(customerEmail)}</p>`
                  : ""
              }
            </section>

            <section class="work">
              <p class="label">Work performed</p>
              <p>${escapeHtml(description)}</p>
            </section>

            <table>
              <thead>
                <tr>
                  <th>Description</th>
                  <th>Amount</th>
                </tr>
              </thead>

              <tbody>
                <tr>
                  <td>Tree service</td>
                  <td>${money(amount)}</td>
                </tr>
              </tbody>
            </table>

            <section class="totals">
              <div class="total-row">
                <span>Invoice total</span>
                <strong>${money(amount)}</strong>
              </div>

              <div class="total-row">
                <span>Amount paid</span>
                <strong>${money(paid)}</strong>
              </div>

              <div class="total-row balance">
                <span>Balance</span>
                <span>${money(balance)}</span>
              </div>
            </section>

            <footer class="footer">
              <h3>Thank you for your business.</h3>
              <p>Keep this document for your records.</p>
            </footer>
          </main>

          <div class="actions">
            <button type="button" onclick="window.print()">
              Print or Save as PDF
            </button>
          </div>
        </body>
      </html>
    `);

    receiptWindow.document.close();
    receiptWindow.focus();
  }

  return (
    <section>
      <PageHeader
        title="Invoices"
        description="Track deposits, balances, due dates, and customer payment history."
        action={
          <button
            type="button"
            className="button primary"
            onClick={() => setOpen(true)}
          >
            New invoice
          </button>
        }
      />

      <div className="invoice-summary">
        <div>
          <span>Total outstanding</span>
          <strong>{money(outstanding)}</strong>
        </div>

        <div>
          <span>Overdue</span>
          <strong>{money(overdue)}</strong>
        </div>

        <div>
          <span>Collected</span>
          <strong>{money(collected)}</strong>
        </div>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Invoice</th>
              <th>Customer</th>
              <th>Amount</th>
              <th>Paid</th>
              <th>Balance</th>
              <th>Due</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>

          <tbody>
            {invoices.map((invoice) => {
              const amount = Number(invoice.amount || 0);
              const paid = Number(invoice.paid || 0);
              const balance = Math.max(amount - paid, 0);

              const status = getInvoiceStatus(
                amount,
                paid,
                invoice.due_date
              );

              return (
                <tr key={invoice.id}>
                  <td>
                    <strong>{invoice.number}</strong>
                  </td>

                  <td>
                    {customer(invoice.customer_id)?.full_name ||
                      "Unknown customer"}
                  </td>

                  <td>{money(amount)}</td>
                  <td>{money(paid)}</td>

                  <td>
                    <strong>{money(balance)}</strong>
                  </td>

                  <td>{formatDate(invoice.due_date)}</td>

                  <td>
                    <StatusBadge value={status} />
                  </td>

                  <td>
                    <div
                      style={{
                        display: "flex",
                        gap: "8px",
                        flexWrap: "wrap",
                      }}
                    >
                      {balance > 0 && (
                        <button
                          type="button"
                          className="table-button"
                          onClick={() =>
                            recordPayment(invoice)
                          }
                        >
                          Record payment
                        </button>
                      )}

                      <button
                        type="button"
                        className="table-button"
                        onClick={() => openReceipt(invoice)}
                      >
                        {balance <= 0
                          ? "Receipt / PDF"
                          : "Invoice / PDF"}
                      </button>

                      <button
                        type="button"
                        className="table-button"
                        onClick={() =>
                          deleteInvoice(invoice)
                        }
                        disabled={deletingId === invoice.id}
                      >
                        {deletingId === invoice.id
                          ? "Deleting…"
                          : "Delete"}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}

            {invoices.length === 0 && (
              <tr>
                <td colSpan="8">
                  No invoices have been created yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal
        title="New invoice"
        open={open}
        onClose={() => {
          setOpen(false);
          setForm(blank);
        }}
      >
        <form
          className="form-grid"
          onSubmit={saveInvoice}
        >
          <label className="wide">
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
              <option value="">Select…</option>

              {customers.map((item) => (
                <option
                  key={item.id}
                  value={item.id}
                >
                  {item.full_name}
                </option>
              ))}
            </select>
          </label>

          <label className="wide">
            Work performed

            <textarea
              rows="4"
              value={form.description}
              onChange={(event) =>
                setForm({
                  ...form,
                  description: event.target.value,
                })
              }
              placeholder="Example: Removed two oak trees, ground stumps, and hauled away debris."
              required
            />
          </label>

          <label>
            Invoice amount

            <input
              type="number"
              min="0.01"
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
            Deposit / paid

            <input
              type="number"
              min="0"
              step="0.01"
              value={form.paid}
              onChange={(event) =>
                setForm({
                  ...form,
                  paid: event.target.value,
                })
              }
            />
          </label>

          <label>
            Due date

            <input
              type="date"
              value={form.due_date}
              onChange={(event) =>
                setForm({
                  ...form,
                  due_date: event.target.value,
                })
              }
              required
            />
          </label>

          <div className="form-actions wide">
            <button
              type="button"
              className="button secondary"
              onClick={() => {
                setOpen(false);
                setForm(blank);
              }}
            >
              Cancel
            </button>

            <button
              type="submit"
              className="button primary"
              disabled={saving}
            >
              {saving ? "Creating…" : "Create invoice"}
            </button>
          </div>
        </form>
      </Modal>
    </section>
  );
}