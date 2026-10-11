import { useEffect, useState, useCallback } from "react";
import { api } from "../services/api.js";
import { Loader, ErrorBanner, fmtNum } from "./ui.jsx";

const HIDDEN = new Set(["Potential_Anomaly"]);
const LABELS = { Anomaly_Status: "Anomaly Status", DBSCAN_Cluster: "DBSCAN Cluster", Anomaly_Score: "Anomaly Score (k-distance)" };

export default function AnomalyTable({ initialStatus = "all" }) {
  const [status, setStatus] = useState(initialStatus);
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState({ by: "Record", order: "asc" });
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { const t = setTimeout(() => { setQ(search); setPage(1); }, 300); return () => clearTimeout(t); }, [search]);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      setData(await api.anomalies({ status, search: q, sort_by: sort.by, order: sort.order, page, page_size: 15 }));
    } catch (e) { setError(e.message); }
    setLoading(false);
  }, [status, q, sort, page]);
  useEffect(() => { load(); }, [load]);

  const toggleSort = (col) => { setSort((s) => ({ by: col, order: s.by === col && s.order === "asc" ? "desc" : "asc" })); setPage(1); };
  const cols = data ? data.columns.filter((c) => !HIDDEN.has(c)) : [];
  const idx = (c) => data.columns.indexOf(c);

  return (
    <div>
      <div className="toolbar">
        <input className="input" type="search" placeholder="Search any value..." value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search records" />
        <div className="seg" role="group" aria-label="Filter">
          {[["all", "All"], ["normal", "Normal"], ["anomaly", "Potential Anomaly"]].map(([k, l]) => (
            <button key={k} className={status === k ? "active" : ""} onClick={() => { setStatus(k); setPage(1); }}>{l}</button>
          ))}
        </div>
        {data && <span className="muted small">{fmtNum(data.total)} records</span>}
      </div>
      <ErrorBanner message={error} />
      {loading && !data && <Loader text="Loading records..." />}
      {data && (
        <>
          <div className="table-wrap" style={{ opacity: loading ? 0.6 : 1 }}>
            <table className="table">
              <thead>
                <tr>
                  {cols.map((c) => (
                    <th key={c} onClick={() => toggleSort(c)} className="sortable" aria-sort={sort.by === c ? (sort.order === "asc" ? "ascending" : "descending") : "none"}>
                      {LABELS[c] || c} {sort.by === c ? (sort.order === "asc" ? "▲" : "▼") : ""}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.rows.length === 0 && <tr><td colSpan={cols.length} className="muted center">No records match this filter.</td></tr>}
                {data.rows.map((r) => (
                  <tr key={r[0]} className={r[idx("Potential_Anomaly")] ? "row-anom" : ""}>
                    {cols.map((c) => {
                      const v = r[idx(c)];
                      if (c === "Anomaly_Status")
                        return <td key={c}><span className={`badge ${v === "Potential Anomaly" ? "anom" : "ok"}`}>{v}</span></td>;
                      return <td key={c}>{v === null || v === undefined ? <span className="muted">-</span> : String(v)}</td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="pager">
            <button className="btn btn-ghost" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
            <span className="muted small">Page {data.page} of {data.pages}</span>
            <button className="btn btn-ghost" disabled={page >= data.pages} onClick={() => setPage(page + 1)}>Next</button>
          </div>
        </>
      )}
    </div>
  );
}
