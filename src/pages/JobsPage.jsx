import { useState } from "react";
import { useWorkspace } from "../data/WorkspaceProvider";
import PageHeader from "../components/PageHeader";
import Modal from "../components/Modal";
import StatusBadge from "../components/StatusBadge";

const blank = {
  customer_id: "",
  title: "",
  crew_id: "",
  date: "",
  start_time: "07:30",
  status: "scheduled",
  address: "",
  foreman_notes: "",
  equipment: "",
};

export default function JobsPage() {
const {
  data,
  customer,
  crew,
  addAndWait,
  update,
  remove,
} = useWorkspace();

  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState(blank);

async function save(e) {
  e.preventDefault();

  try {
    const payload = {
      ...form,
      crew_id: form.crew_id || null,
      number: `JOB-${new Date().getFullYear()}-${String(
        data.jobs.length + 90
      ).padStart(4, "0")}`,
      completion_notes: "",
    };

    const rec = await addAndWait("jobs", payload);

    setOpen(false);
    setForm(blank);
    setSelected(rec);
  } catch (error) {
    console.error("Job insert failed:", error);

    window.alert(
      error?.message ||
        error?.details ||
        "The job could not be saved."
    );
  }
}

  async function deleteJob() {
    if (!selected) return;

    const confirmed = window.confirm(
      `Delete ${selected.number || "this job"}? This cannot be undone.`
    );

    if (!confirmed) return;

    try {
      await remove("jobs", selected.id);
      setSelected(null);
    } catch (error) {
      console.error("Failed to delete job:", error);
      window.alert(
        error?.message || "The job could not be deleted."
      );
    }
  }

  function updateStatus(status) {
    if (!selected) return;

    update("jobs", selected.id, { status });

    setSelected((current) => ({
      ...current,
      status,
    }));
  }

  return (
    <section>
      <PageHeader
        title="Jobs"
        description="Turn sold work into a clean field handoff with crew, equipment, notes, and completion proof."
        action={
          <button
            type="button"
            className="button primary"
            onClick={() => setOpen(true)}
          >
            Schedule job
          </button>
        }
      />

      <div className="board">
        {["scheduled", "in progress", "completed"].map((status) => (
          <div className="board-column" key={status}>
            <div className="board-title">
              <span>{status}</span>

              <b>
                {
                  data.jobs.filter(
                    (job) => job.status === status
                  ).length
                }
              </b>
            </div>

            {data.jobs
              .filter((job) => job.status === status)
              .map((job) => (
                <article
                  className="job-card"
                  key={job.id}
                  onClick={() => setSelected(job)}
                >
                  <div className="job-card-date">
                    <strong>
                      {job.date
                        ? new Date(
                            `${job.date}T12:00`
                          ).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          })
                        : "No date"}
                    </strong>

                    <span>{job.start_time}</span>
                  </div>

                  <h3>{job.title}</h3>

                  <p>
                    {customer(job.customer_id)?.full_name}
                  </p>

                  <small>{job.address}</small>

                  <div>
                    <span className="crew-pill">
                      {crew(job.crew_id)?.name || "Unassigned"}
                    </span>

                    <StatusBadge value={job.status} />
                  </div>
                </article>
              ))}
          </div>
        ))}
      </div>

      <Modal
        title="Schedule job"
        open={open}
        onClose={() => {
          setOpen(false);
          setForm(blank);
        }}
      >
        <form className="form-grid" onSubmit={save}>
          <label>
            Customer

            <select
              value={form.customer_id}
              onChange={(e) => {
                const selectedCustomer = customer(
                  e.target.value
                );

                setForm({
                  ...form,
                  customer_id: e.target.value,
                  address:
                    selectedCustomer?.service_address || "",
                });
              }}
              required
            >
              <option value="">Select…</option>

              {data.customers.map((item) => (
                <option value={item.id} key={item.id}>
                  {item.full_name}
                </option>
              ))}
            </select>
          </label>

          <label>
            Crew

            <select
              value={form.crew_id}
              onChange={(e) =>
                setForm({
                  ...form,
                  crew_id: e.target.value,
                })
              }
            >
              <option value="">Unassigned</option>

              {data.crews.map((item) => (
                <option value={item.id} key={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>

          <label className="wide">
            Job title

            <input
              value={form.title}
              onChange={(e) =>
                setForm({
                  ...form,
                  title: e.target.value,
                })
              }
              required
            />
          </label>

          <label>
            Date

            <input
              type="date"
              value={form.date}
              onChange={(e) =>
                setForm({
                  ...form,
                  date: e.target.value,
                })
              }
              required
            />
          </label>

          <label>
            Start time

            <input
              type="time"
              value={form.start_time}
              onChange={(e) =>
                setForm({
                  ...form,
                  start_time: e.target.value,
                })
              }
            />
          </label>

          <label className="wide">
            Address

            <input
              value={form.address}
              onChange={(e) =>
                setForm({
                  ...form,
                  address: e.target.value,
                })
              }
            />
          </label>

          <label className="wide">
            Foreman notes

            <textarea
              rows="4"
              value={form.foreman_notes}
              onChange={(e) =>
                setForm({
                  ...form,
                  foreman_notes: e.target.value,
                })
              }
            />
          </label>

          <label className="wide">
            Equipment

            <input
              value={form.equipment}
              onChange={(e) =>
                setForm({
                  ...form,
                  equipment: e.target.value,
                })
              }
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
            >
              Schedule job
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        title={selected?.number || "Job"}
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
      >
        {selected ? (
          <div className="job-detail">
            <div className="detail-hero">
              <div>
                <p className="eyebrow">
                  {selected.number}
                </p>

                <h2>{selected.title}</h2>

                <p>
                  {
                    customer(selected.customer_id)
                      ?.full_name
                  }
                </p>
              </div>

              <StatusBadge value={selected.status} />
            </div>

            <div className="detail-grid">
              <div>
                <span>Date &amp; time</span>

                <strong>
                  {selected.date || "Not scheduled"} at{" "}
                  {selected.start_time || "No time"}
                </strong>
              </div>

              <div>
                <span>Crew</span>

                <strong>
                  {crew(selected.crew_id)?.name ||
                    "Unassigned"}
                </strong>
              </div>

              <div>
                <span>Address</span>

                <strong>
                  {selected.address || "Not specified"}
                </strong>
              </div>

              <div>
                <span>Equipment</span>

                <strong>
                  {selected.equipment || "Not specified"}
                </strong>
              </div>
            </div>

            <div className="scope-preview">
              <span>Foreman brief</span>

              <p>
                {selected.foreman_notes || "No notes."}
              </p>
            </div>

            <label>
              Status

              <select
                value={selected.status}
                onChange={(e) =>
                  updateStatus(e.target.value)
                }
              >
                <option value="scheduled">
                  scheduled
                </option>

                <option value="in progress">
                  in progress
                </option>

                <option value="completed">
                  completed
                </option>

                <option value="cancelled">
                  cancelled
                </option>
              </select>
            </label>

            <label>
              Completion notes

              <textarea
                key={selected.id}
                rows="4"
                defaultValue={
                  selected.completion_notes || ""
                }
                onBlur={(e) =>
                  update("jobs", selected.id, {
                    completion_notes: e.target.value,
                  })
                }
              />
            </label>

            <div className="form-actions">
              <button
                type="button"
                className="button danger"
                onClick={deleteJob}
              >
                Delete job
              </button>

              <button
                type="button"
                className="button secondary"
                onClick={() =>
                  window.open(
                    `/tablet?job=${selected.id}`,
                    "_blank"
                  )
                }
              >
                Open field view
              </button>

              <button
                type="button"
                className="button primary"
                onClick={() => setSelected(null)}
              >
                Save &amp; close
              </button>
            </div>
          </div>
        ) : null}
      </Modal>
    </section>
  );
}