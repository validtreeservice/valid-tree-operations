import {
  CONTRACTOR_NAME,
  CONTRACTOR_TITLE,
  getContractTypeDefinition,
} from "../lib/contractTerms";

const money = (value) =>
  Number(value || 0).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });

const formatDate = (value, fallback = "To be scheduled") => {
  if (!value) return fallback;

  const parsed = new Date(
    String(value).includes("T") ? value : `${value}T12:00:00`
  );

  if (Number.isNaN(parsed.getTime())) return String(value);

  return parsed.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
};

export default function ContractDocument({
  contract,
  customer = {},
  company = {},
  children,
}) {
  const contractType = getContractTypeDefinition(contract.contract_type);
  const balance =
    Number(contract.total_price || 0) - Number(contract.deposit || 0);

  const contractorDate =
    contract.contractor_signed_at ||
    contract.created_at ||
    new Date().toISOString();

  const contractorName = contract.contractor_name || CONTRACTOR_NAME;
  const contractorTitle = contract.contractor_title || CONTRACTOR_TITLE;

  return (
    <article className="sign-doc">
      <header>
        <img src="/valid-tree-logo.png" alt="Valid Tree Service" />

        <div>
          <strong>{company.legal_name || "Valid Tree Service LLC"}</strong>
          <span>{company.phone || "832-445-6535"}</span>
          <span>{company.email || "validtreeservice@gmail.com"}</span>
        </div>
      </header>

      <div className="sign-title">
        <div>
          <p>{contractType.agreementLabel.toUpperCase()}</p>
          <h1>{contract.title || contractType.defaultTitle}</h1>
        </div>

        <div>
          <span>Contract</span>
          <strong>{contract.contract_number}</strong>
        </div>
      </div>

      <div className="sign-parties">
        <div>
          <span>Customer</span>
          <strong>{customer.full_name || "Customer"}</strong>
          <p>{customer.service_address || "Service address not provided"}</p>
          {customer.phone ? <p>{customer.phone}</p> : null}
          {customer.email ? <p>{customer.email}</p> : null}
        </div>

        <div>
          <span>Project date</span>
          <strong>{formatDate(contract.service_date)}</strong>
          <p>Contract date: {formatDate(contract.created_at, "Today")}</p>
        </div>
      </div>

      <section>
        <h2>Scope of work</h2>

        <ul>
          {String(contract.scope_of_work || "")
            .split("\n")
            .map((line) => line.trim())
            .filter(Boolean)
            .map((line, index) => (
              <li key={index}>{line.replace(/^[-•]\s*/, "")}</li>
            ))}
        </ul>
      </section>

      <section>
        <h2>Price and payment</h2>

        <div className="price-lines">
          <p>
            <span>Contract total</span>
            <strong>{money(contract.total_price)}</strong>
          </p>

          <p>
            <span>Deposit / advance payment</span>
            <strong>{money(contract.deposit)}</strong>
          </p>

          <p className="total">
            <span>Balance due upon completion</span>
            <strong>{money(balance)}</strong>
          </p>
        </div>
      </section>

      <section className="legal">
        <h2>Terms and conditions</h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: "12px 24px",
          }}
        >
          {contractType.terms.map((term, index) => (
            <p key={term.title} style={{ margin: 0 }}>
              <strong>
                {index + 1}. {term.title}.
              </strong>{" "}
              {term.text}
            </p>
          ))}
        </div>

        {contract.terms ? (
          <div style={{ marginTop: 18 }}>
            <h3 style={{ marginBottom: 6 }}>Additional written terms</h3>
            <p style={{ whiteSpace: "pre-wrap" }}>{contract.terms}</p>
          </div>
        ) : null}
      </section>

      <section className="signature-form">
        <h2>Contractor acceptance</h2>

        <div className="detail-grid">
          <div>
            <span>Signed by</span>
            <strong style={{ fontFamily: "cursive", fontSize: 24 }}>
              {contractorName}
            </strong>
          </div>

          <div>
            <span>Date</span>
            <strong>{formatDate(contractorDate)}</strong>
          </div>

          <div>
            <span>Printed name / title</span>
            <strong>
              {contractorName} · {contractorTitle}
            </strong>
          </div>

          <div>
            <span>Company</span>
            <strong>{company.legal_name || "Valid Tree Service LLC"}</strong>
          </div>
        </div>
      </section>

      {children}

      <footer>
        {company.legal_name || "Valid Tree Service LLC"} ·{" "}
        {company.tagline || "Safety. Precision. Clean Results."}
      </footer>
    </article>
  );
}
