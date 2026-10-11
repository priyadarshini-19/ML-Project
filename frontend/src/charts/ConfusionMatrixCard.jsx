export default function ConfusionMatrixCard({
  matrix = { tp: 0, fp: 0, fn: 0, tn: 0 },
  posLabel = "Positive",
  negLabel = "Negative",
  activeFilter = "ALL",
  onSelectQuadrant,
}) {
  const { tp = 0, fp = 0, fn = 0, tn = 0 } = matrix;
  const actualPos = tp + fn;
  const actualNeg = tn + fp;
  const predPos = tp + fp;
  const predNeg = tn + fn;
  const total = actualPos + actualNeg;

  const pct = (num, den) => (den > 0 ? `${Math.round((num / den) * 1000) / 10}%` : "0%");

  return (
    <div className="cm-wrapper">
      <div className="cm-axis-header">
        <span className="cm-axis-title">PREDICTED BY DBSCAN</span>
      </div>

      <div className="cm-container">
        {/* Left header column for Actual */}
        <div className="cm-y-axis">
          <span className="cm-y-label">GROUND TRUTH (ACTUAL)</span>
        </div>

        {/* Matrix Grid */}
        <div className="cm-grid">
          {/* Header row: Predicted labels */}
          <div className="cm-col-label">
            <strong>PREDICTED ANOMALY</strong>
            <span className="small muted">DBSCAN Cluster -1 ({predPos})</span>
          </div>
          <div className="cm-col-label">
            <strong>PREDICTED NORMAL</strong>
            <span className="small muted">DBSCAN Main Pattern ({predNeg})</span>
          </div>

          {/* Row 1: Actual Positive */}
          <div
            className={`cm-cell cm-tp ${activeFilter === "TP" ? "active-cm" : ""}`}
            onClick={() => onSelectQuadrant && onSelectQuadrant(activeFilter === "TP" ? "ALL" : "TP")}
            role="button"
            tabIndex={0}
            aria-label={`True Positives: ${tp} cases. Click to filter.`}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                onSelectQuadrant && onSelectQuadrant(activeFilter === "TP" ? "ALL" : "TP");
              }
            }}
          >
            <div className="cm-cell-top">
              <span className="cm-tag tp">TRUE POSITIVE (TP)</span>
              <span className="cm-share">{pct(tp, actualPos)} of actual</span>
            </div>
            <div className="cm-count">{tp}</div>
            <div className="cm-desc">
              Actual: <strong>{posLabel}</strong> &rarr; DBSCAN: <strong>Anomaly</strong>
            </div>
            <div className="cm-subtext">Correctly detected rare profile</div>
          </div>

          <div
            className={`cm-cell cm-fn ${activeFilter === "FN" ? "active-cm" : ""}`}
            onClick={() => onSelectQuadrant && onSelectQuadrant(activeFilter === "FN" ? "ALL" : "FN")}
            role="button"
            tabIndex={0}
            aria-label={`False Negatives: ${fn} cases. Click to filter.`}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                onSelectQuadrant && onSelectQuadrant(activeFilter === "FN" ? "ALL" : "FN");
              }
            }}
          >
            <div className="cm-cell-top">
              <span className="cm-tag fn">FALSE NEGATIVE (FN)</span>
              <span className="cm-share">{pct(fn, actualPos)} of actual</span>
            </div>
            <div className="cm-count">{fn}</div>
            <div className="cm-desc">
              Actual: <strong>{posLabel}</strong> &rarr; DBSCAN: <strong>Normal</strong>
            </div>
            <div className="cm-subtext">Clinically critical: missed detection</div>
          </div>

          {/* Row 2: Actual Negative */}
          <div
            className={`cm-cell cm-fp ${activeFilter === "FP" ? "active-cm" : ""}`}
            onClick={() => onSelectQuadrant && onSelectQuadrant(activeFilter === "FP" ? "ALL" : "FP")}
            role="button"
            tabIndex={0}
            aria-label={`False Positives: ${fp} cases. Click to filter.`}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                onSelectQuadrant && onSelectQuadrant(activeFilter === "FP" ? "ALL" : "FP");
              }
            }}
          >
            <div className="cm-cell-top">
              <span className="cm-tag fp">FALSE POSITIVE (FP)</span>
              <span className="cm-share">{pct(fp, actualNeg)} of actual</span>
            </div>
            <div className="cm-count">{fp}</div>
            <div className="cm-desc">
              Actual: <strong>{negLabel}</strong> &rarr; DBSCAN: <strong>Anomaly</strong>
            </div>
            <div className="cm-subtext">False alarm: standard profile flagged</div>
          </div>

          <div
            className={`cm-cell cm-tn ${activeFilter === "TN" ? "active-cm" : ""}`}
            onClick={() => onSelectQuadrant && onSelectQuadrant(activeFilter === "TN" ? "ALL" : "TN")}
            role="button"
            tabIndex={0}
            aria-label={`True Negatives: ${tn} cases. Click to filter.`}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                onSelectQuadrant && onSelectQuadrant(activeFilter === "TN" ? "ALL" : "TN");
              }
            }}
          >
            <div className="cm-cell-top">
              <span className="cm-tag tn">TRUE NEGATIVE (TN)</span>
              <span className="cm-share">{pct(tn, actualNeg)} of actual</span>
            </div>
            <div className="cm-count">{tn}</div>
            <div className="cm-desc">
              Actual: <strong>{negLabel}</strong> &rarr; DBSCAN: <strong>Normal</strong>
            </div>
            <div className="cm-subtext">Correctly cleared standard profile</div>
          </div>
        </div>
      </div>

      <div className="cm-footer">
        <span className="muted small">
          Click any cell to filter the patient breakdown table below. Total evaluated records: <strong>{total}</strong>.
        </span>
        {activeFilter !== "ALL" && (
          <button
            type="button"
            className="link small"
            style={{ fontWeight: 600, color: "var(--teal)" }}
            onClick={() => onSelectQuadrant && onSelectQuadrant("ALL")}
          >
            Clear cell filter (showing {activeFilter})
          </button>
        )}
      </div>
    </div>
  );
}
