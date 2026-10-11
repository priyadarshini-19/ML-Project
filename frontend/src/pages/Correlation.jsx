import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { api } from "../services/api.js";
import { useApp } from "../components/AppContext.jsx";
import { PageHeader, Card, StatCard, EmptyState, Loader, ErrorBanner } from "../components/ui.jsx";
import CorrelationHeatmap from "../charts/CorrelationHeatmap.jsx";
import CorrelationScatter from "../charts/CorrelationScatter.jsx";
import BiomarkerCorrelationBar from "../charts/BiomarkerCorrelationBar.jsx";

export default function Correlation() {
  const { results: r, correlation: cachedCorr, setCorrelation, ready } = useApp();
  const [data, setData] = useState(cachedCorr);
  const [loading, setLoading] = useState(!cachedCorr && !!r);
  const [error, setError] = useState("");

  // Feature pair currently selected for 2D scatter
  const [selectedPair, setSelectedPair] = useState({ x: "", y: "" });
  const [minAbsR, setMinAbsR] = useState(0.1);
  const [pairFilter, setPairFilter] = useState("");

  useEffect(() => {
    if (!r) return;
    if (cachedCorr) {
      setData(cachedCorr);
      if (!selectedPair.x && cachedCorr.default_pair) {
        setSelectedPair(cachedCorr.default_pair);
      }
      return;
    }

    let isMounted = true;
    setLoading(true);
    api.correlation()
      .then((res) => {
        if (!isMounted) return;
        setData(res);
        if (setCorrelation) setCorrelation(res);
        if (res.default_pair) {
          setSelectedPair(res.default_pair);
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        setError(err.message || "Failed to load correlation analysis.");
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [r, cachedCorr, setCorrelation]);

  const handleSelectPair = (x, y) => {
    setSelectedPair({ x, y });
    const scatterEl = document.getElementById("correlation-scatter-section");
    if (scatterEl) {
      scatterEl.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const handleSelectFeatureForScatter = (featName) => {
    if (!data?.features?.length) return;
    // Set as Y, pick a different feature as X
    const other = data.features.find((f) => f !== featName) || data.features[0];
    setSelectedPair({ x: other, y: featName });
    const scatterEl = document.getElementById("correlation-scatter-section");
    if (scatterEl) {
      scatterEl.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const filteredPairs = useMemo(() => {
    if (!data?.pairs) return [];
    return data.pairs.filter((p) => {
      if (p.abs_r < minAbsR) return false;
      if (!pairFilter.trim()) return true;
      const q = pairFilter.toLowerCase();
      return p.x.toLowerCase().includes(q) || p.y.toLowerCase().includes(q) || p.strength.toLowerCase().includes(q);
    });
  }, [data?.pairs, minAbsR, pairFilter]);

  if (!ready || loading) return <Loader text="Calculating feature correlations & biomarker relationships..." />;
  if (!r) {
    return (
      <EmptyState
        title="No DBSCAN results yet"
        text="Upload a dataset, run preprocessing and DBSCAN to explore feature correlations and biomarker patterns."
        to="/upload"
        action="Upload Dataset"
      />
    );
  }

  if (error) {
    return (
      <>
        <PageHeader title="Feature Correlation Graph" subtitle="Pairwise clinical feature correlations and anomaly relationships" />
        <ErrorBanner message={error} onClose={() => setError("")} />
      </>
    );
  }

  if (!data || !data.has_data) {
    return (
      <EmptyState
        title="Insufficient Numerical Features"
        text="The dataset does not have enough numerical columns to compute bivariate correlations."
        to="/dashboard"
        action="Back to Dashboard"
      />
    );
  }

  const { features, matrix, points, insights, anomaly_correlations } = data;
  const currentX = selectedPair.x || features[0] || "";
  const currentY = selectedPair.y || (features[1] || features[0] || "");

  const posP = insights?.strongest_positive;
  const negP = insights?.strongest_negative;
  const topAnom = insights?.top_anomaly_driver;

  return (
    <>
      <PageHeader
        title="Feature Correlation Analysis"
        subtitle="Bivariate correlation matrix, biomarker drivers of DBSCAN anomalies, and interactive 2D scatter plots."
      >
        <div className="head-actions">
          <Link className="btn btn-ghost" to="/dashboard">&larr; Dashboard</Link>
          <Link className="btn btn-primary" to="/confusion-matrix">Confusion Matrix &rarr;</Link>
          <a className="btn btn-ghost" href={api.downloadUrl}>Download CSV</a>
        </div>
      </PageHeader>

      {/* Summary Cards */}
      <div className="grid g4">
        <StatCard
          label="Features analyzed"
          value={features.length}
          hint="Numerical features in matrix"
        />
        <StatCard
          label="Strongest Positive (r)"
          value={posP ? `+${posP.r}` : "None"}
          hint={posP ? `${posP.x} &harr; ${posP.y}` : "-"}
        />
        <StatCard
          label="Strongest Inverse (r)"
          value={negP ? `${negP.r}` : "None"}
          hint={negP ? `${negP.x} &harr; ${negP.y}` : "-"}
          tone="warn"
        />
        <StatCard
          label="Top Anomaly Driver"
          value={topAnom ? topAnom.feature : "None"}
          hint={topAnom ? `r = +${topAnom.r_score} (${topAnom.diff_pct > 0 ? `+${topAnom.diff_pct}%` : `${topAnom.diff_pct}%`})` : "-"}
          tone="warn"
        />
      </div>

      {/* Clinical interpretation insight callout */}
      {topAnom && (
        <section className="callout" style={{ borderLeftColor: "#0E9AA7", background: "#f0f9fa" }}>
          <strong>Clinical Insight:</strong> The medical biomarker most strongly correlated with DBSCAN anomaly isolation is{" "}
          <strong style={{ color: "#0B2A4A" }}>{topAnom.feature}</strong> (isolation correlation <em>r</em> ={" "}
          <strong>{topAnom.r_score > 0 ? `+${topAnom.r_score}` : topAnom.r_score}</strong>). In this dataset, profiles flagged as potential anomalies exhibit an average {topAnom.feature} of{" "}
          <strong>{topAnom.anomaly_mean}</strong> compared to <strong>{topAnom.normal_mean}</strong> in standard profiles ({topAnom.diff_pct > 0 ? `+${topAnom.diff_pct}%` : `${topAnom.diff_pct}%`} difference).
        </section>
      )}

      {/* Interactive 2D Correlation Scatter Plot */}
      <section id="correlation-scatter-section">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 8 }}>
          <h2 className="section-title" style={{ margin: 0 }}>Interactive 2D Correlation Scatter Graph</h2>
          <div className="corr-quick-presets">
            <span className="muted small" style={{ marginRight: 6 }}>Quick Pairs:</span>
            {posP && (
              <button
                type="button"
                className="btn btn-ghost sm"
                style={{ padding: "4px 8px", fontSize: "0.78rem" }}
                onClick={() => handleSelectPair(posP.x, posP.y)}
              >
                Top Positive ({posP.x} &times; {posP.y})
              </button>
            )}
            {negP && (
              <button
                type="button"
                className="btn btn-ghost sm"
                style={{ padding: "4px 8px", fontSize: "0.78rem" }}
                onClick={() => handleSelectPair(negP.x, negP.y)}
              >
                Top Negative ({negP.x} &times; {negP.y})
              </button>
            )}
            {topAnom && features.length > 1 && (
              <button
                type="button"
                className="btn btn-ghost sm"
                style={{ padding: "4px 8px", fontSize: "0.78rem" }}
                onClick={() => {
                  const second = features.find((f) => f !== topAnom.feature) || features[0];
                  handleSelectPair(second, topAnom.feature);
                }}
              >
                Anomaly Driver ({topAnom.feature})
              </button>
            )}
          </div>
        </div>

        <Card>
          <CorrelationScatter
            points={points}
            featX={currentX}
            featY={currentY}
            allFeatures={features}
            onChangeX={(val) => setSelectedPair((p) => ({ ...p, x: val }))}
            onChangeY={(val) => setSelectedPair((p) => ({ ...p, y: val }))}
          />
        </Card>
      </section>

      {/* Heatmap & Biomarker Association side-by-side */}
      <div className="grid g2 align-start">
        <Card>
          <CorrelationHeatmap
            features={features}
            matrix={matrix}
            selectedPair={selectedPair}
            onSelectPair={handleSelectPair}
          />
        </Card>

        <Card>
          <BiomarkerCorrelationBar
            data={anomaly_correlations}
            onSelectFeature={handleSelectFeatureForScatter}
          />

          <div style={{ marginTop: 22, borderTop: "1px solid var(--line)", paddingTop: 14 }}>
            <h4 style={{ fontSize: "0.92rem", marginBottom: 6, color: "var(--navy)" }}>
              Biomarker Anomaly Profile Comparison
            </h4>
            <div className="table-wrap" style={{ maxHeight: 220 }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Biomarker</th>
                    <th>Correlation (r)</th>
                    <th>Normal Mean</th>
                    <th>Anomaly Mean</th>
                    <th>Difference</th>
                  </tr>
                </thead>
                <tbody>
                  {anomaly_correlations.map((b) => (
                    <tr key={b.feature} style={{ cursor: "pointer" }} onClick={() => handleSelectFeatureForScatter(b.feature)}>
                      <td><strong>{b.feature}</strong></td>
                      <td>
                        <span className={`badge ${b.abs_r_score >= 0.4 ? "anom" : "teal"}`}>
                          {b.r_score > 0 ? `+${b.r_score}` : b.r_score}
                        </span>
                      </td>
                      <td>{b.normal_mean}</td>
                      <td>{b.anomaly_mean}</td>
                      <td style={{ color: b.diff_pct > 15 ? "#b8420a" : b.diff_pct < -15 ? "#1f5fc0" : "inherit", fontWeight: 600 }}>
                        {b.diff_pct > 0 ? `+${b.diff_pct}%` : `${b.diff_pct}%`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="muted small" style={{ marginTop: 6 }}>
              Click any row to view that biomarker on the scatter graph.
            </p>
          </div>
        </Card>
      </div>

      {/* Top Correlated Feature Pairs Table */}
      <h2 className="section-title">All Feature Pairs Ranked by Correlation Strength</h2>
      <Card>
        <div className="toolbar">
          <input
            className="input"
            type="search"
            placeholder="Filter by feature name or strength..."
            value={pairFilter}
            onChange={(e) => setPairFilter(e.target.value)}
            aria-label="Filter feature pairs"
          />
          <div className="seg" role="group" aria-label="Correlation threshold">
            {[
              { label: "All (|r| ≥ 0)", val: 0.0 },
              { label: "|r| ≥ 0.1", val: 0.1 },
              { label: "|r| ≥ 0.2", val: 0.2 },
              { label: "|r| ≥ 0.4", val: 0.4 },
            ].map((tab) => (
              <button
                key={tab.label}
                type="button"
                className={minAbsR === tab.val ? "active" : ""}
                onClick={() => setMinAbsR(tab.val)}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <span className="muted small" style={{ marginLeft: "auto" }}>
            Showing {filteredPairs.length} of {data.pairs.length} pairs
          </span>
        </div>

        <div className="table-wrap" style={{ maxHeight: 380 }}>
          <table className="table">
            <thead>
              <tr>
                <th>Feature X</th>
                <th>Feature Y</th>
                <th>Correlation (r)</th>
                <th>Relationship Strength</th>
                <th>Shared Variance (R&sup2;)</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredPairs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="center muted" style={{ padding: "24px 0" }}>
                    No feature pairs match the active filter criteria.
                  </td>
                </tr>
              ) : (
                filteredPairs.map((pair) => {
                  const isCurrent =
                    (selectedPair.x === pair.x && selectedPair.y === pair.y) ||
                    (selectedPair.x === pair.y && selectedPair.y === pair.x);
                  return (
                    <tr key={`${pair.x}-${pair.y}`} className={isCurrent ? "row-anom" : ""}>
                      <td><strong>{pair.x}</strong></td>
                      <td><strong>{pair.y}</strong></td>
                      <td>
                        <span className={`badge ${pair.r >= 0 ? "teal" : "anom"}`}>
                          {pair.r > 0 ? `+${pair.r}` : pair.r}
                        </span>
                      </td>
                      <td>{pair.strength}</td>
                      <td>{Math.round(pair.abs_r * pair.abs_r * 100)}%</td>
                      <td>
                        <button
                          type="button"
                          className={`btn sm ${isCurrent ? "btn-primary" : "btn-ghost"}`}
                          style={{ padding: "3px 10px", fontSize: "0.78rem" }}
                          onClick={() => handleSelectPair(pair.x, pair.y)}
                        >
                          {isCurrent ? "Plotted" : "Plot Pair"}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {insights?.multicollinear_pairs?.length > 0 && (
          <div className="callout" style={{ marginTop: 14 }}>
            <strong>Multi-collinearity Notice:</strong> The following pairs have |r| &ge; 0.85:
            <ul style={{ margin: "6px 0 0", paddingLeft: 20 }}>
              {insights.multicollinear_pairs.map((m, i) => (
                <li key={i}>{m.note}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="row" style={{ marginTop: 16 }}>
          <Link className="btn btn-ghost" to="/dashboard">&larr; Back to Dashboard</Link>
          <Link className="btn btn-primary" to="/confusion-matrix">Diagnostic Confusion Matrix &rarr;</Link>
          <Link className="btn btn-ghost" to="/anomalies">View Anomaly Records</Link>
          <Link className="btn btn-ghost" to="/patient-assessment">Assess Patient Profile</Link>
        </div>
      </Card>
    </>
  );
}
