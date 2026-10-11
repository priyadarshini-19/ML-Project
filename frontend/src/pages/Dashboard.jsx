import { Link } from "react-router-dom";
import { api } from "../services/api.js";
import { useApp } from "../components/AppContext.jsx";
import { PageHeader, Card, StatCard, EmptyState, Loader, fmtNum } from "../components/ui.jsx";
import KDistanceChart from "../charts/KDistanceChart.jsx";
import ClusterBarChart from "../charts/ClusterBarChart.jsx";
import AnomalyPieChart from "../charts/AnomalyPieChart.jsx";
import PCAScatter from "../charts/PCAScatter.jsx";
import AnomalyTable from "../components/AnomalyTable.jsx";

export default function Dashboard() {
  const { results: r, viz, ready } = useApp();
  if (!ready) return <Loader text="Loading dashboard..." />;
  if (!r || !viz) return <EmptyState title="No results yet" text="Upload a dataset, run preprocessing and run DBSCAN to see the dashboard." to="/upload" action="Upload Dataset" />;

  const anomalyRate = Number(r.anomaly_percentage) || 0;
  const riskBands = [
    { label: "Minimal", max: 5, range: "0-5%", tone: "minimal" },
    { label: "Low", max: 15, range: ">5-15%", tone: "low" },
    { label: "Moderate", max: 30, range: ">15-30%", tone: "moderate" },
    { label: "High", max: 100, range: ">30%", tone: "high" },
  ];
  const activeBand = riskBands.find((band) => anomalyRate <= band.max) || riskBands[riskBands.length - 1];

  return (
    <>
      <PageHeader title="Results Dashboard" subtitle="DBSCAN-based detection of potentially unusual medical profiles">
        <a className="btn btn-primary" href={api.downloadUrl}>Download Results CSV</a>
      </PageHeader>
      {r.is_demo && <p className="callout">DEMO dataset: synthetic data for testing, not real clinical data.</p>}

      <section className={`risk-band ${activeBand.tone}`} aria-labelledby="risk-band-title">
        <div className="risk-band-heading">
          <div>
            <p className="risk-eyebrow">DBSCAN DATASET SUMMARY</p>
            <h2 id="risk-band-title">Dataset anomaly-burden band</h2>
            <p className="muted small">
              {fmtNum(r.potential_anomalies)} of {fmtNum(r.total_records)} records ({anomalyRate}%) were flagged as potential anomalies.
            </p>
          </div>
          <div className="risk-result" aria-live="polite">
            <span className="risk-result-label">{activeBand.label}</span>
            <span className="small">anomaly burden</span>
          </div>
        </div>
        <div className="risk-meter" role="meter" aria-label="Share of records flagged as potential anomalies" aria-valuemin="0" aria-valuemax="100" aria-valuenow={anomalyRate}>
          <span style={{ width: `${Math.min(100, anomalyRate)}%` }} />
        </div>
        <div className="risk-band-scale" aria-label="Anomaly-burden bands">
          {riskBands.map((band) => (
            <span key={band.label} className={band.label === activeBand.label ? "active" : ""}>
              {band.label} <small>{band.range}</small>
            </span>
          ))}
        </div>
        <p className="risk-caveat">
          These percentage bands are heuristic summaries of this dataset, not validated clinical cutoffs. DBSCAN cannot determine a person’s disease stage or diagnose severity.
        </p>
      </section>

      <div className="grid g6">
        <StatCard label="Dataset" value={r.dataset_name} />
        <StatCard label="Total records" value={fmtNum(r.total_records)} />
        <StatCard label="Features" value={r.features_used} hint="after encoding" />
        <StatCard label="Clusters" value={r.clusters} />
        <StatCard label="Potential anomalies" value={fmtNum(r.potential_anomalies)} tone="warn" />
        <StatCard label="Anomaly %" value={`${r.anomaly_percentage}%`} tone="warn" />
      </div>

      <div className="grid g2">
        <Card title="Dataset summary">
          <dl className="kv">
            <dt>Dataset name</dt><dd>{r.dataset_name}</dd>
            <dt>Rows</dt><dd>{fmtNum(r.rows)}</dd>
            <dt>Columns</dt><dd>{r.columns}</dd>
            <dt>Numerical features</dt><dd>{r.numerical_features}</dd>
            <dt>Categorical features</dt><dd>{r.categorical_features}</dd>
            <dt>Missing values</dt><dd>{fmtNum(r.missing_values)}</dd>
          </dl>
        </Card>
        <Card title="DBSCAN results">
          <dl className="kv">
            <dt>EPS</dt><dd>{r.eps} <span className="muted small">({r.mode === "auto" ? r.eps_method : "manual"})</span></dd>
            <dt>MIN_SAMPLES</dt><dd>{r.min_samples}</dd>
            <dt>Number of clusters</dt><dd>{r.clusters}</dd>
            <dt>Noise points (-1)</dt><dd>{fmtNum(r.potential_anomalies)}</dd>
            <dt>Anomaly percentage</dt><dd>{r.anomaly_percentage}%</dd>
            <dt>Main-pattern records</dt><dd>{fmtNum(r.normal_records)}</dd>
          </dl>
        </Card>
      </div>

      <h2 className="section-title">Graphs</h2>
      <div className="grid g2">
        <Card><KDistanceChart curve={viz.k_distance.curve} eps={viz.k_distance.eps} minSamples={r.min_samples} /></Card>
        <Card><ClusterBarChart data={viz.cluster_distribution} /></Card>
        <Card><AnomalyPieChart data={viz.anomaly_vs_normal} /></Card>
        <Card className="span2"><PCAScatter pca={viz.pca} /></Card>
      </div>

      <h2 className="section-title">Anomaly report</h2>
      <Card>
        <p>
          DBSCAN (EPS {r.eps}, MIN_SAMPLES {r.min_samples}) found <strong>{r.clusters}</strong> cluster{r.clusters === 1 ? "" : "s"} among{" "}
          <strong>{fmtNum(r.total_records)}</strong> records. <strong>{fmtNum(r.potential_anomalies)}</strong> records ({r.anomaly_percentage}%)
          were labelled as noise (cluster -1) and are flagged as <em>potential anomalies / potentially unusual medical profiles</em> for
          further clinical investigation.
        </p>
        {r.anomaly_percentage > 30 && <p className="callout">More than 30% of records were flagged. Try a larger EPS or smaller MIN_SAMPLES in manual mode.</p>}
        {r.potential_anomalies === 0 && <p className="callout">No noise points were found. Try a smaller EPS or larger MIN_SAMPLES in manual mode.</p>}
        <p className="muted small">{r.disclaimer}</p>
        <div className="row">
          <Link className="btn btn-primary" to="/correlation">Explore Correlation Graph &rarr;</Link>
          <a className="btn btn-ghost" href={api.downloadUrl}>Download Results CSV</a>
          <Link className="btn btn-ghost" to="/config">Adjust parameters</Link>
          <Link className="btn btn-ghost" to="/patient-assessment">Assess a patient profile</Link>
        </div>
      </Card>

      <h2 className="section-title">Feature Correlations & Biomarker Drivers</h2>
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 14 }}>
          <div>
            <h3 style={{ fontSize: "1.08rem", margin: "0 0 4px 0", color: "var(--navy)" }}>
              Pairwise Correlation Matrix & Interactive Scatter Analysis
            </h3>
            <p className="muted small" style={{ margin: 0 }}>
              Investigate relationships between clinical features (glucose, creatinine, blood pressure, etc.), inspect the interactive correlation heatmap, and see which biomarkers drive anomaly isolation.
            </p>
          </div>
          <Link className="btn btn-primary" to="/correlation">
            View Correlation Graph &rarr;
          </Link>
        </div>
      </Card>

      <h2 className="section-title">Patient / profile records</h2>
      <Card><AnomalyTable /></Card>
    </>
  );
}
