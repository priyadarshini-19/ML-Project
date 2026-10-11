import { useState } from "react";

function getCellColor(r) {
  if (r == null || isNaN(r)) return "#f8fafc";
  if (r === 1) return "#0b2a4a"; // self-correlation diagonal
  if (r > 0) {
    // 0 to 1: positive (light teal to deep teal)
    const t = Math.min(1, Math.max(0, r));
    // interpolate between #f0f9fa and #0e9aa7
    const red = Math.round(240 - t * (240 - 14));
    const green = Math.round(249 - t * (249 - 154));
    const blue = Math.round(250 - t * (250 - 167));
    return `rgb(${red}, ${green}, ${blue})`;
  } else {
    // 0 to -1: negative (light orange to deep orange)
    const t = Math.min(1, Math.max(0, -r));
    // interpolate between #fff5eb and #e8590c
    const red = Math.round(255 - t * (255 - 232));
    const green = Math.round(245 - t * (245 - 89));
    const blue = Math.round(235 - t * (235 - 12));
    return `rgb(${red}, ${green}, ${blue})`;
  }
}

function getTextColor(r) {
  if (r == null || isNaN(r)) return "#5b6b7c";
  if (Math.abs(r) > 0.52 || r === 1) return "#ffffff";
  return "#1b2b3c";
}

export default function CorrelationHeatmap({ features = [], matrix = [], selectedPair, onSelectPair }) {
  const [hoveredCell, setHoveredCell] = useState(null);

  if (!features.length || !matrix.length) {
    return <p className="muted small">No numerical feature data available for correlation heatmap.</p>;
  }

  const isSelected = (f1, f2) => {
    if (!selectedPair) return false;
    return (
      (selectedPair.x === f1 && selectedPair.y === f2) ||
      (selectedPair.x === f2 && selectedPair.y === f1)
    );
  };

  return (
    <div className="corr-heatmap-container">
      <div className="corr-heatmap-header">
        <div>
          <h3 className="chart-title">Pearson Correlation Matrix Heatmap</h3>
          <p className="muted small">
            Click any cell to plot the feature pair on the interactive scatter graph.
          </p>
        </div>
        <div className="corr-legend-bar">
          <span className="small muted">-1.0 (Inverse)</span>
          <div className="corr-gradient-strip" aria-hidden="true" />
          <span className="small muted">0 (None)</span>
          <div className="corr-gradient-strip pos" aria-hidden="true" />
          <span className="small muted">+1.0 (Direct)</span>
        </div>
      </div>

      <div className="corr-table-scroll">
        <table className="corr-heatmap-table" role="grid" aria-label="Feature Correlation Matrix">
          <thead>
            <tr>
              <th className="corr-corner-th" scope="col">Feature</th>
              {features.map((feat) => (
                <th key={feat} scope="col" className="corr-col-th" title={feat}>
                  <span className="corr-th-text">{feat}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {features.map((rowFeat, rowIdx) => (
              <tr key={rowFeat}>
                <th scope="row" className="corr-row-th" title={rowFeat}>
                  {rowFeat}
                </th>
                {features.map((colFeat, colIdx) => {
                  const r = matrix[rowIdx]?.[colIdx] ?? 0;
                  const selected = isSelected(rowFeat, colFeat);
                  const isDiagonal = rowFeat === colFeat;
                  const bgColor = getCellColor(r);
                  const fgColor = getTextColor(r);

                  return (
                    <td
                      key={colFeat}
                      className={`corr-cell ${selected ? "active-pair" : ""} ${isDiagonal ? "diagonal" : ""}`}
                      style={{ backgroundColor: bgColor, color: fgColor }}
                      onClick={() => onSelectPair && onSelectPair(rowFeat, colFeat)}
                      onMouseEnter={() => setHoveredCell({ x: rowFeat, y: colFeat, r })}
                      onMouseLeave={() => setHoveredCell(null)}
                      tabIndex={0}
                      role="gridcell"
                      aria-label={`${rowFeat} versus ${colFeat}: correlation ${r}`}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          onSelectPair && onSelectPair(rowFeat, colFeat);
                        }
                      }}
                    >
                      <span className="corr-val">{r >= 0 ? `+${r.toFixed(2)}` : r.toFixed(2)}</span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {hoveredCell && (
        <div className="corr-cell-tooltip" aria-live="polite">
          <strong>{hoveredCell.x}</strong> &harr; <strong>{hoveredCell.y}</strong>:{" "}
          <span className="badge teal">r = {hoveredCell.r > 0 ? `+${hoveredCell.r}` : hoveredCell.r}</span>
          <span className="muted small">
            {hoveredCell.x === hoveredCell.y
              ? " (Self-correlation: identical feature)"
              : ` (${Math.round(hoveredCell.r * hoveredCell.r * 100)}% shared variance)`}
          </span>
        </div>
      )}
    </div>
  );
}
