import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../services/api.js";
import { useApp } from "../components/AppContext.jsx";
import { PageHeader, Card, StatCard, ErrorBanner, EmptyState } from "../components/ui.jsx";
import KDistanceChart from "../charts/KDistanceChart.jsx";

export default function Config() {
  const { prep, setResults, setViz, setCorrelation } = useApp();
  const [mode, setMode] = useState("auto");
  const [params, setParams] = useState(null);
  const [eps, setEps] = useState("");
  const [ms, setMs] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const nav = useNavigate();

  useEffect(() => {
    if (!prep) return;
    setParams(prep.parameters); setEps(prep.parameters.eps); setMs(prep.parameters.min_samples);
  }, [prep]);

  if (!prep || !params) return <EmptyState title="Run preprocessing first" text="DBSCAN needs the processed feature matrix." to="/inspection" action="Go to inspection" />;

  async function refreshGraph() {
    setBusy("graph"); setError("");
    try {
      const p = await api.kdistance(Number(ms));
      setParams(p);
      if (mode === "auto") setEps(p.eps);
    } catch (e) { setError(e.message); }
    setBusy("");
  }

  function pickMode(m) {
    setMode(m);
    if (m === "auto") { setEps(params.eps); setMs(params.min_samples); }
  }

  async function run() {
    setBusy("run"); setError("");
    try {
      const body = mode === "auto" ? { mode: "auto" } : { mode: "manual", eps: Number(eps), min_samples: Number(ms) };
      if (mode === "manual" && (!(Number(eps) > 0) || !(Number(ms) >= 2))) throw new Error("Enter EPS > 0 and MIN_SAMPLES >= 2.");
      const res = await api.runDbscan(body);
      const [v, c] = await Promise.all([
        api.visualization(),
        api.correlation().catch(() => null),
      ]);
      setResults(res);
      setViz(v);
      if (setCorrelation) setCorrelation(c);
      nav("/dashboard");
    } catch (e) { setError(e.message); setBusy(""); }
  }

  const shownEps = mode === "auto" ? params.eps : Number(eps) || params.eps;
  return (
    <>
      <PageHeader title="DBSCAN Configuration" subtitle="Automatic selection is the default. Switch to manual to experiment with EPS and MIN_SAMPLES." />
      <ErrorBanner message={error} onClose={() => setError("")} />
      <div className="grid g2 align-start">
        <Card title="Parameters">
          <div className="seg" role="group" aria-label="Parameter mode">
            <button className={mode === "auto" ? "active" : ""} onClick={() => pickMode("auto")}>Automatic</button>
            <button className={mode === "manual" ? "active" : ""} onClick={() => pickMode("manual")}>Manual</button>
          </div>
          <div className="grid g2">
            <StatCard label="Selected EPS" value={mode === "auto" ? params.eps : eps || "-"} />
            <StatCard label="Selected MIN_SAMPLES" value={mode === "auto" ? params.min_samples : ms || "-"} />
          </div>
          {mode === "auto" ? (
            <p className="muted small">
              EPS comes from the {params.method} of the k-distance curve (k = MIN_SAMPLES). MIN_SAMPLES is set from the number of
              processed features, bounded for the dataset size.
            </p>
          ) : (
            <div className="form">
              <label>EPS<input className="input" type="number" step="0.05" min="0.01" value={eps} onChange={(e) => setEps(e.target.value)} /></label>
              <label>MIN_SAMPLES<input className="input" type="number" step="1" min="2" value={ms} onChange={(e) => setMs(e.target.value)} /></label>
              <button className="btn btn-ghost" onClick={refreshGraph} disabled={!!busy}>{busy === "graph" ? "Updating..." : "Update graph for this MIN_SAMPLES"}</button>
            </div>
          )}
          <button className="btn btn-primary wide" onClick={run} disabled={!!busy}>{busy === "run" ? "Running DBSCAN..." : "Run DBSCAN"}</button>
        </Card>
        <Card>
          <KDistanceChart curve={params.k_distance_curve} eps={shownEps} minSamples={mode === "auto" ? params.min_samples : Number(ms)} />
        </Card>
      </div>
    </>
  );
}
