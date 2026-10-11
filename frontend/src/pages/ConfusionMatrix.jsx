import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { api } from "../services/api.js";
import { useApp } from "../components/AppContext.jsx";
import { PageHeader, Card, StatCard, EmptyState, Loader, ErrorBanner } from "../components/ui.jsx";
import ConfusionMatrixCard from "../charts/ConfusionMatrixCard.jsx";

export default function ConfusionMatrix() {
  const { results: r, ready } = useApp();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Mode and parameter state
  const [mode, setMode] = useState("auto");
  const [selectedColumn, setSelectedColumn] = useState("");
  const [positiveValue, setPositiveValue] = useState("");
  const [ruleFeature, setRuleFeature] = useState("");
  const [ruleOperator, setRuleOperator] = useState(">");
  const [ruleThreshold, setRuleThreshold] = useState("");

  // Filter for the cases table: 'ALL' | 'TP' | 'FN' | 'FP' | 'TN'
  const [quadrantFilter, setQuadrantFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 15;

  // Fetch confusion matrix data
  const fetchData = async (overrides = {}) => {
    setLoading(true);
    setError("");
    try {
      const activeMode = overrides.mode !== undefined ? overrides.mode : mode;
      const params = { mode: activeMode };

      if (activeMode === "column") {
        if (overrides.target_column || selectedColumn) {
          params.target_column = overrides.target_column || selectedColumn;
        }
        if (overrides.positive_value || positiveValue) {
          params.positive_value = overrides.positive_value || positiveValue;
        }
      } else if (activeMode === "rule") {
        if (overrides.rule_feature || ruleFeature) {
          params.rule_feature = overrides.rule_feature || ruleFeature;
        }
        params.rule_operator = overrides.rule_operator || ruleOperator;
        if (overrides.rule_threshold !== undefined || ruleThreshold !== "") {
          params.rule_threshold = overrides.rule_threshold !== undefined ? overrides.rule_threshold : Number(ruleThreshold);
        }
      }

      const res = await api.confusionMatrix(params);
      setData(res);

      // Synchronize state with backend response
      if (res.source_type) setMode(res.source_type);
      if (res.target_column) setSelectedColumn(res.target_column);
      if (res.positive_value) setPositiveValue(res.positive_value);
      if (res.current_rule) {
        setRuleFeature(res.current_rule.feature || "");
        setRuleOperator(res.current_rule.operator || ">");
        setRuleThreshold(res.current_rule.threshold != null ? res.current_rule.threshold : "");
      }
    } catch (err) {
      setError(err.message || "Failed to calculate confusion matrix.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!r) return;
    fetchData({ mode: "auto" });
  }, [r]);

  // When user selects a new column
  const handleColumnChange = (colName) => {
    setSelectedColumn(colName);
    const cand = data?.available_columns?.find((c) => c.column === colName);
    const pos = cand?.suggested_positive || cand?.unique_values?.[0] || "";
    setPositiveValue(pos);
    fetchData({ mode: "column", target_column: colName, positive_value: pos });
  };

  // When user switches ground truth mode tab
  const handleModeTab = (newMode) => {
    setMode(newMode);
    setQuadrantFilter("ALL");
    setPage(1);
    if (newMode === "benchmark") {
      fetchData({ mode: "benchmark" });
    } else if (newMode === "column") {
      const col = selectedColumn || data?.available_columns?.[0]?.column || "";
      const pos = positiveValue || data?.available_columns?.[0]?.suggested_positive || "";
      fetchData({ mode: "column", target_column: col, positive_value: pos });
    } else if (newMode === "rule") {
      const feat = ruleFeature || (data?.available_numerical_features?.includes("creatinine") ? "creatinine" : data?.available_numerical_features?.[0] || "");
      const thresh = ruleThreshold !== "" ? ruleThreshold : (feat === "creatinine" ? 2.0 : 100);
      fetchData({ mode: "rule", rule_feature: feat, rule_operator: ruleOperator, rule_threshold: thresh });
    }
  };

  // Filtered cases for the table
  const filteredCases = useMemo(() => {
    if (!data?.cases) return [];
    let list = data.cases;
    if (quadrantFilter !== "ALL") {
      list = list.filter((c) => c.category === quadrantFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((c) =>
        c.id.toLowerCase().includes(q) ||
        c.actual.toLowerCase().includes(q) ||
        c.predicted.toLowerCase().includes(q)
      );
    }
    return list;
  }, [data?.cases, quadrantFilter, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredCases.length / pageSize));
  const paginatedCases = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredCases.slice(start, start + pageSize);
  }, [filteredCases, page, pageSize]);

  if (!ready || (loading && !data)) return <Loader text="Calculating confusion matrix & diagnostic performance..." />;

  if (!r) {
    return (
      <EmptyState
        title="No DBSCAN results yet"
        text="Upload a dataset, run preprocessing and DBSCAN to evaluate the confusion matrix."
        to="/upload"
        action="Upload Dataset"
      />
    );
  }

  const { matrix, rates, source_description, pos_label_display, neg_label_display, insights, available_columns, available_numerical_features, display_features } = data || {};

  return (
    <>
      <PageHeader
        title="Diagnostic Confusion Matrix & Validation"
        subtitle="Evaluate DBSCAN anomaly predictions against ground-truth labels, clinical outlier rules, or ensemble reference models."
      >
        <div className="head-actions">
          <Link className="btn btn-ghost" to="/correlation">&larr; Correlation Graph</Link>
          <a className="btn btn-primary" href={api.downloadUrl}>Download CSV</a>
        </div>
      </PageHeader>

      <ErrorBanner message={error} onClose={() => setError("")} />

      {/* Ground Truth Source Configuration */}
      <Card title="Ground Truth Configuration">
        <p className="muted small" style={{ margin: "0 0 12px 0" }}>
          Select how ground truth rare disease cases are defined for this evaluation.
        </p>

        <div className="seg" role="group" aria-label="Ground Truth Mode">
          <button
            type="button"
            className={mode === "benchmark" ? "active" : ""}
            onClick={() => handleModeTab("benchmark")}
          >
            Ensemble Benchmark (Isolation Forest)
          </button>
          <button
            type="button"
            className={mode === "column" ? "active" : ""}
            onClick={() => handleModeTab("column")}
          >
            Dataset Label Column {available_columns?.length ? `(${available_columns.length})` : ""}
          </button>
          <button
            type="button"
            className={mode === "rule" ? "active" : ""}
            onClick={() => handleModeTab("rule")}
          >
            Clinical Biomarker Rule
          </button>
        </div>

        {mode === "column" && (
          <div className="cm-controls-bar">
            {available_columns?.length > 0 ? (
              <>
                <label className="cm-field-label">
                  <span className="muted small">Ground-Truth Column:</span>
                  <select
                    className="input sm"
                    value={selectedColumn}
                    onChange={(e) => handleColumnChange(e.target.value)}
                    aria-label="Select Target Column"
                  >
                    {available_columns.map((c) => (
                      <option key={c.column} value={c.column}>
                        {c.column} ({c.unique_values.length} unique)
                      </option>
                    ))}
                  </select>
                </label>

                {selectedColumn && (
                  <label className="cm-field-label">
                    <span className="muted small">Positive (Rare / Anomaly) Value:</span>
                    <select
                      className="input sm"
                      value={positiveValue}
                      onChange={(e) => {
                        setPositiveValue(e.target.value);
                        fetchData({ mode: "column", target_column: selectedColumn, positive_value: e.target.value });
                      }}
                      aria-label="Select Positive Value"
                    >
                      {available_columns
                        .find((c) => c.column === selectedColumn)
                        ?.unique_values.map((val) => (
                          <option key={val} value={val}>
                            {val}
                          </option>
                        ))}
                    </select>
                  </label>
                )}
              </>
            ) : (
              <p className="callout" style={{ margin: 0 }}>
                No categorical or label columns were detected in this dataset. Switch to <strong>Ensemble Benchmark</strong> or <strong>Clinical Biomarker Rule</strong> mode.
              </p>
            )}
          </div>
        )}

        {mode === "rule" && (
          <div className="cm-controls-bar">
            <label className="cm-field-label">
              <span className="muted small">Biomarker Feature:</span>
              <select
                className="input sm"
                value={ruleFeature}
                onChange={(e) => setRuleFeature(e.target.value)}
                aria-label="Select Biomarker Feature"
              >
                {available_numerical_features?.map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </label>

            <label className="cm-field-label">
              <span className="muted small">Condition:</span>
              <select
                className="input sm"
                value={ruleOperator}
                onChange={(e) => setRuleOperator(e.target.value)}
                aria-label="Select Operator"
              >
                <option value=">">&gt; (Greater than)</option>
                <option value=">=">&ge; (Greater than or equal)</option>
                <option value="<">&lt; (Less than)</option>
                <option value="<=">&le; (Less than or equal)</option>
              </select>
            </label>

            <label className="cm-field-label">
              <span className="muted small">Cutoff Threshold:</span>
              <input
                className="input sm"
                type="number"
                step="any"
                value={ruleThreshold}
                onChange={(e) => setRuleThreshold(e.target.value)}
                placeholder="e.g. 2.0"
                aria-label="Threshold value"
              />
            </label>

            <button
              type="button"
              className="btn btn-primary sm"
              style={{ marginTop: 18 }}
              onClick={() => fetchData({ mode: "rule", rule_feature: ruleFeature, rule_operator: ruleOperator, rule_threshold: Number(ruleThreshold) })}
            >
              Apply Rule
            </button>
          </div>
        )}

        <div className="callout" style={{ marginTop: 12, background: "#f8fafc", borderLeftColor: "#2b7de9" }}>
          <strong>Active Evaluation Benchmark:</strong> {source_description}
        </div>
      </Card>

      {/* Clinical Performance Metrics */}
      {rates && (
        <div className="grid g6">
          <StatCard
            label="Sensitivity (Recall)"
            value={`${rates.sensitivity}%`}
            hint="True rare cases detected"
            tone={rates.sensitivity >= 85 ? "ok" : rates.sensitivity >= 60 ? "warn" : "warn"}
          />
          <StatCard
            label="Specificity (TNR)"
            value={`${rates.specificity}%`}
            hint="Normal profiles cleared"
          />
          <StatCard
            label="Precision (PPV)"
            value={`${rates.precision}%`}
            hint="Flagged anomaly accuracy"
          />
          <StatCard
            label="F1-Score"
            value={rates.f1_score}
            hint="Harmonic precision-recall"
          />
          <StatCard
            label="Overall Accuracy"
            value={`${rates.accuracy}%`}
            hint="Correct classifications"
          />
          <StatCard
            label="Miss Rate (FNR)"
            value={`${rates.fnr}%`}
            hint="Undetected rare cases (FN)"
            tone={rates.fnr > 0 ? "warn" : "ok"}
          />
        </div>
      )}

      {/* Clinical Insights Banner */}
      {insights?.length > 0 && (
        <section className="callout" style={{ borderLeftColor: "#0E9AA7", background: "#f0f9fa" }}>
          <strong>Clinical Diagnostic Summary:</strong>
          <ul style={{ margin: "6px 0 0", paddingLeft: 20 }}>
            {insights.map((msg, i) => (
              <li key={i}>{msg}</li>
            ))}
          </ul>
        </section>
      )}

      {/* 2x2 Confusion Matrix Visualization */}
      <Card title="Confusion Matrix: Predicted vs Ground Truth">
        <ConfusionMatrixCard
          matrix={matrix}
          posLabel={pos_label_display}
          negLabel={neg_label_display}
          activeFilter={quadrantFilter}
          onSelectQuadrant={(q) => {
            setQuadrantFilter(q);
            setPage(1);
          }}
        />
      </Card>

      {/* Case-by-Case Breakdown Table */}
      <h2 className="section-title">
        Patient Record Classifications {quadrantFilter !== "ALL" ? `(${quadrantFilter} Only)` : ""}
      </h2>
      <Card>
        <div className="toolbar">
          <input
            className="input"
            type="search"
            placeholder="Search by Patient ID or status..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            aria-label="Search patient records"
          />

          <div className="seg" role="group" aria-label="Filter quadrant">
            {[
              { label: "All Cases", key: "ALL" },
              { label: `True Positives (${matrix?.tp ?? 0})`, key: "TP" },
              { label: `False Negatives (${matrix?.fn ?? 0})`, key: "FN" },
              { label: `False Positives (${matrix?.fp ?? 0})`, key: "FP" },
              { label: `True Negatives (${matrix?.tn ?? 0})`, key: "TN" },
            ].map((tab) => (
              <button
                key={tab.key}
                type="button"
                className={quadrantFilter === tab.key ? "active" : ""}
                onClick={() => {
                  setQuadrantFilter(tab.key);
                  setPage(1);
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <span className="muted small" style={{ marginLeft: "auto" }}>
            Showing {filteredCases.length} of {data?.total_records ?? 0} records
          </span>
        </div>

        <div className="table-wrap" style={{ maxHeight: 420 }}>
          <table className="table">
            <thead>
              <tr>
                <th>Patient ID</th>
                <th>Ground Truth ({pos_label_display})</th>
                <th>DBSCAN Prediction</th>
                <th>Classification</th>
                <th>Anomaly Score</th>
                <th>Cluster</th>
                {display_features?.map((f) => (
                  <th key={f}>{f}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginatedCases.length === 0 ? (
                <tr>
                  <td colSpan={6 + (display_features?.length || 0)} className="center muted" style={{ padding: "28px 0" }}>
                    No patient records match the active filter criteria.
                  </td>
                </tr>
              ) : (
                paginatedCases.map((c) => {
                  const tagClass =
                    c.category === "TP"
                      ? "ok"
                      : c.category === "TN"
                      ? "teal"
                      : c.category === "FP"
                      ? "anom"
                      : "anom";

                  return (
                    <tr
                      key={c.record}
                      className={c.category === "FN" ? "row-anom" : ""}
                    >
                      <td><strong>{c.id}</strong></td>
                      <td>{c.actual}</td>
                      <td>
                        <span className={`badge ${c.is_anomaly ? "anom" : "ok"}`}>
                          {c.predicted}
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${tagClass}`} style={c.category === "FN" ? { background: "#fdecec", color: "#9b1c1c", fontWeight: 700 } : {}}>
                          {c.category}
                        </span>
                      </td>
                      <td>{c.anomaly_score}</td>
                      <td>{c.cluster}</td>
                      {display_features?.map((f) => (
                        <td key={f}>{c.values[f] != null ? c.values[f] : "-"}</td>
                      ))}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="pager">
            <button
              type="button"
              className="btn btn-ghost sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              &larr; Previous
            </button>
            <span className="small muted">
              Page {page} of {totalPages}
            </span>
            <button
              type="button"
              className="btn btn-ghost sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next &rarr;
            </button>
          </div>
        )}

        <div className="row" style={{ marginTop: 18 }}>
          <Link className="btn btn-ghost" to="/correlation">&larr; Correlation Graph</Link>
          <Link className="btn btn-primary" to="/anomalies">View Anomaly Records &rarr;</Link>
          <Link className="btn btn-ghost" to="/patient-assessment">Assess Patient Profile</Link>
        </div>
      </Card>
    </>
  );
}
