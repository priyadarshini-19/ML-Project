import { Link } from "react-router-dom";
import { Card } from "../components/ui.jsx";

// Deterministic decorative scatter: a dense main pattern plus a few outliers (illustration only, not real data).
function rnd(seed) { let s = seed; return () => ((s = (s * 16807) % 2147483647) / 2147483647); }
function HeroPlot() {
  const r = rnd(42);
  const main = Array.from({ length: 150 }, () => {
    const a = r() * Math.PI * 2, d = Math.sqrt(r()) * 78;
    return [200 + Math.cos(a) * d * 1.25, 150 + Math.sin(a) * d * 0.9];
  });
  const odd = [[40, 40], [350, 60], [360, 250], [60, 260], [330, 150], [90, 150]];
  return (
    <svg viewBox="0 0 400 300" className="hero-plot" role="img" aria-label="Illustration: dense main cluster with a few outlying points marked with X">
      <rect width="400" height="300" rx="14" fill="#fff" />
      {[75, 150, 225].map((y) => <line key={y} x1="0" x2="400" y1={y} y2={y} stroke="#e3eaf1" />)}
      {main.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="3.4" fill="#2B7DE9" fillOpacity=".5" />)}
      {odd.map(([x, y], i) => (
        <path key={i} d={`M${x - 6} ${y - 6}l12 12m0-12l-12 12`} stroke="#E8590C" strokeWidth="2.6" strokeLinecap="round" />
      ))}
      <text x="16" y="284" fontSize="11" fill="#5b6b7c">Illustration only: eps-neighbourhood clusters and noise points (X)</text>
    </svg>
  );
}

const FLOW = [
  "CSV upload", "Inspection", "Cleaning", "Encoding", "Scaling",
  "K-distance", "EPS", "DBSCAN", "Dashboard", "Correlation graph", "Confusion matrix", "Anomalies", "Patient assessment"
];
const TECH = [
  ["React + Vite", "Dashboard UI, React Router"],
  ["Recharts", "K-distance, bar, donut, PCA, correlation scatter & biomarker charts"],
  ["FastAPI", "REST API in Python"],
  ["scikit-learn / SciPy", "DBSCAN, PCA, correlation, confusion matrix metrics, scalers, encoders, imputers"],
  ["pandas / NumPy", "Dataset handling & correlation matrices"],
];

export default function Home() {
  return (
    <>
      <section className="hero">
        <div className="hero-text">
          <h1>Rare Disease Detection</h1>
          <p className="hero-sub">Using DBSCAN-Based Anomaly Detection</p>
          <p>
            Upload any structured disease dataset. The system cleans it, picks DBSCAN parameters from the
            k-distance graph, and flags medical profiles that do not fit the dominant patterns, so they can be
            sent for further clinical investigation.
          </p>
          <div className="row">
            <Link className="btn btn-primary" to="/upload">Upload Dataset</Link>
            <Link className="btn btn-ghost" to="/dashboard">View Dashboard</Link>
          </div>
          <p className="callout">
            This is anomaly detection, not medical diagnosis. DBSCAN marks <em>potentially unusual medical profiles</em>;
            it does not tell you that a patient has a rare disease.
          </p>
        </div>
        <HeroPlot />
      </section>

      <Card title="Project workflow">
        <ol className="flow">{FLOW.map((f) => <li key={f}>{f}</li>)}</ol>
      </Card>

      <Card title="Technology stack">
        <div className="grid g3">
          {TECH.map(([t, d]) => (
            <div key={t} className="tech"><strong>{t}</strong><span className="muted small">{d}</span></div>
          ))}
        </div>
      </Card>
    </>
  );
}
