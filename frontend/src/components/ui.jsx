import { Link } from "react-router-dom";

export const PageHeader = ({ title, subtitle, children }) => (
  <header className="page-head">
    <div>
      <h1>{title}</h1>
      {subtitle && <p className="muted">{subtitle}</p>}
    </div>
    {children && <div className="head-actions">{children}</div>}
  </header>
);

export const StatCard = ({ label, value, tone, hint }) => (
  <div className={`stat ${tone || ""}`}>
    <div className="stat-label">{label}</div>
    <div className="stat-value" title={String(value)}>{value}</div>
    {hint && <div className="stat-hint">{hint}</div>}
  </div>
);

export const Card = ({ title, subtitle, children, className = "" }) => (
  <section className={`card ${className}`}>
    {title && <h2 className="card-title">{title}</h2>}
    {subtitle && <p className="muted small">{subtitle}</p>}
    {children}
  </section>
);

export const Loader = ({ text = "Working..." }) => (
  <div className="loader" role="status"><span className="spinner" />{text}</div>
);

export const ErrorBanner = ({ message, onClose }) =>
  message ? (
    <div className="error" role="alert">
      <span>{message}</span>
      {onClose && <button className="link" onClick={onClose}>Dismiss</button>}
    </div>
  ) : null;

export const EmptyState = ({ title, text, to, action }) => (
  <div className="empty">
    <h2>{title}</h2>
    <p className="muted">{text}</p>
    {to && <Link className="btn btn-primary" to={to}>{action}</Link>}
  </div>
);

export const fmtBytes = (b) => (b < 1024 ? `${b} B` : b < 1048576 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1048576).toFixed(2)} MB`);
export const fmtNum = (n) => (typeof n === "number" ? n.toLocaleString() : n);
