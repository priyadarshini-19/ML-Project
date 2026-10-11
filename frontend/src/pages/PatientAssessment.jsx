import { useEffect, useState } from "react";
import { useApp } from "../components/AppContext.jsx";
import { api } from "../services/api.js";
import { Card, EmptyState, ErrorBanner, Loader, PageHeader } from "../components/ui.jsx";

function labelFor(name) {
  return name.replace(/[_-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function PatientAssessment() {
  const { results, ready } = useApp();
  const [form, setForm] = useState(null);
  const [values, setValues] = useState({});
  const [assessment, setAssessment] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!results) return;
    (async () => {
      try {
        const data = await api.patientForm();
        setForm(data);
        setValues(Object.fromEntries(data.fields.map((field) => [field.name, ""])));
      } catch (e) { setError(e.message); }
    })();
  }, [results]);

  if (!ready) return <Loader text="Loading patient assessment..." />;
  if (!results) {
    return <EmptyState title="Run DBSCAN first" text="The patient assessment uses the selected EPS, fitted preprocessing, and DBSCAN core patterns from a completed run." to="/config" action="Set up DBSCAN" />;
  }
  if (!form) return <Loader text="Preparing fields from the uploaded dataset..." />;

  function change(field, value) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  async function submit(event) {
    event.preventDefault();
    setBusy(true); setError(""); setAssessment(null);
    try {
      setAssessment(await api.assessPatient(values));
    } catch (e) { setError(e.message); }
    setBusy(false);
  }

  const tone = assessment?.risk_level?.toLowerCase() || "low";
  return (
    <>
      <PageHeader title="Patient Profile Assessment" subtitle={`Enter details that match ${form.dataset_name}. The profile is assessed against the completed DBSCAN model.`} />
      <ErrorBanner message={error} onClose={() => setError("")} />

      <div className="grid g2 align-start">
        <Card title="Add patient details">
          <p className="muted small">Fields come directly from the usable columns in the uploaded dataset. Blank values use the same imputation rules as the original DBSCAN run.</p>
          <form className="patient-form" onSubmit={submit}>
            <div className="patient-form-grid">
              {form.fields.map((field) => (
                <label key={field.name}>
                  {labelFor(field.name)}
                  {field.type === "number" ? (
                    <input className="input" type="number" step="any" value={values[field.name] ?? ""} onChange={(e) => change(field.name, e.target.value)} />
                  ) : (
                    <select className="input" value={values[field.name] ?? ""} onChange={(e) => change(field.name, e.target.value)}>
                      <option value="">Not recorded</option>
                      {field.options.map((option) => <option key={option} value={option}>{option}</option>)}
                    </select>
                  )}
                </label>
              ))}
            </div>
            <button className="btn btn-primary" disabled={busy}>{busy ? "Calculating profile factor..." : "Calculate DBSCAN profile factor"}</button>
          </form>
        </Card>

        <Card title="How this assessment works">
          <ol className="assessment-steps">
            <li>Your values are imputed, encoded, and scaled with the fitted dataset pipeline.</li>
            <li>The profile is compared with DBSCAN core samples at the EPS selected for this run.</li>
            <li>A profile outside every core sample's EPS neighbourhood is flagged as a potential anomaly.</li>
          </ol>
          <p className="callout">This feature measures dataset similarity only. It does not calculate medical risk or diagnose a rare disease.</p>
        </Card>
      </div>

      {assessment && (
        <section className={`patient-risk ${tone}`} aria-live="polite">
          <div>
            <p className="risk-eyebrow">DBSCAN PROFILE RESULT</p>
            <h2>{assessment.risk_level} dataset-relative profile factor</h2>
            <p>{assessment.interpretation}</p>
          </div>
          <div className="patient-score">
            <strong>{assessment.profile_risk_factor}</strong>
            <span>/ 100</span>
            <small>EPS-distance factor</small>
          </div>
          <dl className="patient-kv">
            <dt>DBSCAN status</dt><dd>{assessment.status}</dd>
            <dt>Nearest core distance</dt><dd>{assessment.nearest_core_distance}</dd>
            <dt>Selected EPS</dt><dd>{assessment.eps}</dd>
            <dt>Matched cluster</dt><dd>{assessment.nearest_cluster ?? "No matching core pattern"}</dd>
          </dl>
          <p className="risk-caveat">{assessment.disclaimer}</p>
        </section>
      )}
    </>
  );
}
