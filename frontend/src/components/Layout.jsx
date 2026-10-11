import { NavLink, Outlet, Link } from "react-router-dom";
import { useApp } from "./AppContext.jsx";

const STEPS = [
  { to: "/upload", label: "Upload dataset", key: "upload" },
  { to: "/inspection", label: "Inspect columns", key: "inspection" },
  { to: "/preprocessing", label: "Preprocessing", key: "prep" },
  { to: "/config", label: "DBSCAN setup", key: "prep2" },
  { to: "/dashboard", label: "Dashboard", key: "results" },
  { to: "/correlation", label: "Correlation graph", key: "corr" },
  { to: "/confusion-matrix", label: "Confusion matrix", key: "cm" },
  { to: "/anomalies", label: "Anomaly records", key: "results2" },
  { to: "/patient-assessment", label: "Assess patient", key: "results3" },
];

export default function Layout() {
  const { upload, inspection, prep, results } = useApp();
  const done = {
    upload: !!upload,
    inspection: !!inspection,
    prep: !!prep,
    prep2: !!results,
    results: !!results,
    corr: !!results,
    cm: !!results,
    results2: !!results,
    results3: !!results,
  };
  return (
    <div className="shell">
      <aside className="sidebar">
        <Link to="/" className="brand">
          <span className="brand-mark" aria-hidden="true">
            <svg viewBox="0 0 32 32" width="30" height="30">
              <circle cx="16" cy="16" r="14" fill="none" stroke="#0E9AA7" strokeWidth="2" />
              <circle cx="12" cy="14" r="2.2" fill="#0B2A4A" /><circle cx="17" cy="18" r="2.2" fill="#0B2A4A" />
              <circle cx="15" cy="11" r="2.2" fill="#0B2A4A" />
              <path d="M22 7l4 4m0-4l-4 4" stroke="#E8590C" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </span>
          <span>Rare Disease<br />Detection</span>
        </Link>
        <nav className="nav" aria-label="Workflow">
          <NavLink to="/" end className="nav-item">Home</NavLink>
          {STEPS.map((s) => (
            <NavLink key={s.to} to={s.to} className="nav-item">
              <span className={`dot ${done[s.key] ? "on" : ""}`} aria-hidden="true" />
              {s.label}
            </NavLink>
          ))}
          <NavLink to="/about" className="nav-item">About project</NavLink>
        </nav>
        <p className="sidebar-note">Research / Educational Use Only</p>
      </aside>
      <div className="content">
        <div className="notice" role="note">
          <strong>Research / Educational Use Only.</strong> Potential anomalies are not medical diagnoses.
          Results should be reviewed by qualified healthcare professionals.
        </div>
        <main className="page"><Outlet /></main>
      </div>
    </div>
  );
}
