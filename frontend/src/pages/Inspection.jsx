import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../services/api.js";
import { useApp } from "../components/AppContext.jsx";
import { PageHeader, Card, StatCard, Loader, ErrorBanner, EmptyState, fmtBytes } from "../components/ui.jsx";

export default function Inspection() {
  const { inspection, setPrep, setResults, setViz, ready } = useApp();
  const [roles, setRoles] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const nav = useNavigate();

  useEffect(() => {
    if (!inspection) return;
    const r = {};
    inspection.column_summary.forEach((c) => (r[c.name] = "feature"));
    inspection.detected.id_columns.forEach((c) => (r[c.column] = "id"));
    inspection.detected.target_columns.forEach((c) => (r[c.column] = "target"));
    setRoles(r);
  }, [inspection]);

  const reasons = useMemo(() => {
    const m = {};
    inspection?.detected.id_columns.forEach((c) => (m[c.column] = c.reason));
    inspection?.detected.target_columns.forEach((c) => (m[c.column] = c.reason));
    return m;
  }, [inspection]);

  if (!ready) return <Loader text="Loading..." />;
  if (!inspection) return <EmptyState title="No dataset analysed yet" text="Upload a CSV and click Analyze Dataset to inspect it." to="/upload" action="Upload Dataset" />;

  const pick = (role) => Object.keys(roles).filter((k) => roles[k] === role);
  const features = pick("feature").length;

  async function run() {
    setBusy(true); setError("");
    try {
      const res = await api.preprocess(pick("id"), pick("target"));
      setPrep(res); setResults(null); setViz(null);
      nav("/preprocessing");
    } catch (e) { setError(e.message); }
    setBusy(false);
  }

  return (
    <>
      <PageHeader title="Dataset Inspection" subtitle={`${inspection.file_name} (${fmtBytes(inspection.file_size)})`} />
      <div className="grid g4">
        <StatCard label="Rows" value={inspection.rows.toLocaleString()} />
        <StatCard label="Columns" value={inspection.columns} />
        <StatCard label="Missing values" value={inspection.missing_values.toLocaleString()} />
        <StatCard label="Duplicate rows" value={inspection.duplicate_rows} />
        <StatCard label="Numerical columns" value={inspection.numerical_columns.length} />
        <StatCard label="Categorical columns" value={inspection.categorical_columns.length} />
        <StatCard label="Detected ID columns" value={inspection.detected.id_columns.length} />
        <StatCard label="Detected label columns" value={inspection.detected.target_columns.length} />
      </div>

      <Card title="Confirm column roles" subtitle="Detected IDs and labels are pre-selected from column names and values. Change any role before preprocessing: ID and label columns are excluded from DBSCAN (it is unsupervised).">
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Column Name</th><th>Data Type</th><th>Missing Values</th><th>Unique Values</th><th>Role</th></tr></thead>
            <tbody>
              {inspection.column_summary.map((c) => (
                <tr key={c.name}>
                  <td><strong>{c.name}</strong>{reasons[c.name] && <div className="muted small">{reasons[c.name]}</div>}</td>
                  <td><span className={`badge ${c.dtype === "numerical" ? "info" : "teal"}`}>{c.dtype}</span></td>
                  <td>{c.missing} <span className="muted small">({c.missing_pct}%)</span></td>
                  <td>{c.unique}</td>
                  <td>
                    <select className="input sm" value={roles[c.name] || "feature"} aria-label={`Role of ${c.name}`}
                      onChange={(e) => setRoles({ ...roles, [c.name]: e.target.value })}>
                      <option value="feature">Feature</option>
                      <option value="id">ID (remove)</option>
                      <option value="target">Label / target (remove)</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ErrorBanner message={error} onClose={() => setError("")} />
        <div className="row">
          <button className="btn btn-primary" onClick={run} disabled={busy || features === 0}>
            {busy ? "Preprocessing..." : "Confirm and run preprocessing"}
          </button>
          <span className="muted small">{features} feature column(s) will be used.</span>
        </div>
      </Card>

      <Card title="Dataset preview" subtitle="First 10 rows">
        <div className="table-wrap">
          <table className="table">
            <thead><tr>{inspection.preview.columns.map((c) => <th key={c}>{c}</th>)}</tr></thead>
            <tbody>
              {inspection.preview.rows.map((r, i) => (
                <tr key={i}>{r.map((v, j) => <td key={j}>{v === null ? <span className="muted">-</span> : String(v)}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
