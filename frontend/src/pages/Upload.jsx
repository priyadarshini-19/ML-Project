import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../services/api.js";
import { useApp } from "../components/AppContext.jsx";
import { PageHeader, Card, StatCard, Loader, ErrorBanner, fmtBytes } from "../components/ui.jsx";

export default function Upload() {
  const { upload, setUpload, setInspection, setPrep, setResults, setViz, reset } = useApp();
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const input = useRef(null);
  const nav = useNavigate();

  const clearDownstream = () => { setInspection(null); setPrep(null); setResults(null); setViz(null); };

  async function send(fn) {
    setError(""); setBusy("Reading file...");
    try { clearDownstream(); setUpload(await fn()); }
    catch (e) { setError(e.message); setUpload(null); }
    setBusy("");
  }
  const onFile = (f) => {
    if (!f) return;
    if (!f.name.toLowerCase().endsWith(".csv")) { setError("Only .csv files are supported."); return; }
    send(() => api.upload(f));
  };
  async function analyze() {
    setError(""); setBusy("Inspecting dataset...");
    try { setInspection(await api.analyze()); nav("/inspection"); }
    catch (e) { setError(e.message); }
    setBusy("");
  }

  return (
    <>
      <PageHeader title="Upload Disease Dataset" subtitle="Supported format: CSV. Any structured medical dataset works; column names are detected automatically." />
      <ErrorBanner message={error} onClose={() => setError("")} />
      <div
        className={`drop ${drag ? "over" : ""}`}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); onFile(e.dataTransfer.files[0]); }}
        onClick={() => input.current?.click()}
        role="button" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && input.current?.click()}
      >
        <input ref={input} type="file" accept=".csv,text/csv" hidden onChange={(e) => { onFile(e.target.files[0]); e.target.value = ""; }} />
        <strong>Drag and drop a CSV file here</strong>
        <span className="muted">or click to browse (max 50 MB)</span>
      </div>
      <div className="row center-row">
        <span className="muted">No dataset handy?</span>
        <button className="btn btn-ghost" onClick={() => send(() => api.uploadSample())} disabled={!!busy}>Load DEMO dataset</button>
      </div>
      {busy && <Loader text={busy} />}

      {upload?.rows && !busy && (
        <Card title="Upload status">
          {upload.is_demo && <p className="callout">DEMO dataset: synthetic, generated for testing. It is not real clinical data.</p>}
          <div className="grid g4">
            <StatCard label="File name" value={upload.file_name} />
            <StatCard label="File size" value={fmtBytes(upload.file_size)} />
            <StatCard label="Rows" value={upload.rows.toLocaleString()} />
            <StatCard label="Columns" value={upload.columns} />
          </div>
          <p><span className="badge ok">{upload.status} successfully</span> <span className="muted small">Nothing has been processed yet. Click Analyze Dataset to continue.</span></p>
          <div className="row">
            <button className="btn btn-primary" onClick={analyze}>Analyze Dataset</button>
            <button className="btn btn-ghost" onClick={reset}>Reset</button>
          </div>
        </Card>
      )}
    </>
  );
}
