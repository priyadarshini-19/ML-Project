import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useApp } from "../components/AppContext.jsx";
import { PageHeader, Card, StatCard, EmptyState } from "../components/ui.jsx";

export default function Preprocessing() {
  const { prep } = useApp();
  const [shown, setShown] = useState(0);

  const steps = prep && [
    ["Remove ID columns", `${prep.removed_columns.filter((r) => r.reason.startsWith("Confirmed ID")).length} removed`],
    ["Detect target/label columns", `${prep.removed_columns.filter((r) => r.reason.startsWith("Label")).length} excluded`],
    ["Handle missing numerical values", `Median imputation (${prep.numerical_features.length} columns)`],
    ["Handle missing categorical values", `Most-frequent imputation (${prep.categorical_features.length} columns)`],
    ["Encode categorical features", "One-hot encoding"],
    ["Scale numerical features", "StandardScaler (mean 0, std 1)"],
    ["Generate final feature matrix", `${prep.matrix_shape[0]} x ${prep.matrix_shape[1]}`],
  ];

  useEffect(() => {
    if (!prep) return;
    setShown(0);
    const t = setInterval(() => setShown((s) => { if (s >= 7) { clearInterval(t); return s; } return s + 1; }), 220);
    return () => clearInterval(t);
  }, [prep]);

  if (!prep) return <EmptyState title="Preprocessing has not run" text="Confirm the column roles on the inspection page to build the feature matrix." to="/inspection" action="Go to inspection" />;
  const pct = Math.round((shown / 7) * 100);

  return (
    <>
      <PageHeader title="Preprocessing Pipeline" subtitle="Every step runs in the Python backend with scikit-learn.">
        <Link to="/config" className="btn btn-primary">Continue to DBSCAN setup</Link>
      </PageHeader>
      <Card>
        <div className="progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${pct}%` }} /></div>
        <ol className="steps">
          {steps.map(([t, d], i) => (
            <li key={t} className={i < shown ? "done" : ""}>
              <span className="check" aria-hidden="true">{i < shown ? "✓" : ""}</span>
              <div><strong>{t}</strong><div className="muted small">{d}</div></div>
            </li>
          ))}
        </ol>
      </Card>
      <div className="grid g4">
        <StatCard label="Original features" value={prep.original_features.length} />
        <StatCard label="Removed columns" value={prep.removed_columns.length} />
        <StatCard label="Final input columns" value={prep.used_columns.length} />
        <StatCard label="Processed feature count" value={prep.final_feature_count} hint="after one-hot encoding" />
      </div>
      <div className="grid g2">
        <Card title="Removed columns">
          {prep.removed_columns.length === 0 ? <p className="muted">No columns were removed.</p> : (
            <ul className="plain">{prep.removed_columns.map((r) => <li key={r.column}><strong>{r.column}</strong><span className="muted small"> {r.reason}</span></li>)}</ul>
          )}
        </Card>
        <Card title="Features used by DBSCAN">
          <p className="small muted">Numerical</p>
          <div className="chips">{prep.numerical_features.map((c) => <span key={c} className="chip">{c}</span>)}</div>
          <p className="small muted">Categorical (one-hot encoded)</p>
          <div className="chips">{prep.categorical_features.map((c) => <span key={c} className="chip teal">{c}</span>)}</div>
          <p className="small muted">{prep.missing_values_filled} missing value(s) were imputed.</p>
        </Card>
      </div>
    </>
  );
}
