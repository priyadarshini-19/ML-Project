import { useMemo } from "react";
import { ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

const AnomalyMarker = ({ cx, cy }) => {
  if (cx == null || cy == null) return null;
  return (
    <g stroke="#E8590C" strokeWidth={2.4} strokeLinecap="round">
      <line x1={cx - 6} y1={cy - 6} x2={cx + 6} y2={cy + 6} />
      <line x1={cx - 6} y1={cy + 6} x2={cx + 6} y2={cy - 6} />
    </g>
  );
};

const NormalMarker = ({ cx, cy }) => {
  if (cx == null || cy == null) return null;
  return <circle cx={cx} cy={cy} r={4} fill="#2B7DE9" fillOpacity={0.6} stroke="#1f5fc0" strokeWidth={0.5} />;
};

const CustomTooltip = ({ active, payload, featX, featY }) => {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  const isAnom = p.is_anomaly;

  return (
    <div className="tip" style={{ minWidth: 170 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 4 }}>
        <strong>{p.id || `Record #${p.record}`}</strong>
        <span className={`badge ${isAnom ? "anom" : "ok"}`}>
          {isAnom ? "Anomaly" : `Cluster ${p.cluster}`}
        </span>
      </div>
      <div><strong>{featX}:</strong> {p.x}</div>
      <div><strong>{featY}:</strong> {p.y}</div>
      {p.anomaly_score != null && (
        <div className="muted small" style={{ marginTop: 4 }}>
          Anomaly Score: {p.anomaly_score}
        </div>
      )}
    </div>
  );
};

export default function CorrelationScatter({
  points = [],
  featX,
  featY,
  allFeatures = [],
  onChangeX,
  onChangeY,
}) {
  const { normalData, anomalyData, stats } = useMemo(() => {
    if (!featX || !featY || !points.length) {
      return { normalData: [], anomalyData: [], stats: null };
    }

    const normals = [];
    const anomalies = [];
    const validPairs = [];

    for (const pt of points) {
      const vx = pt.values?.[featX];
      const vy = pt.values?.[featY];
      if (vx == null || vy == null || isNaN(vx) || isNaN(vy)) continue;

      const item = {
        record: pt.record,
        id: pt.id,
        cluster: pt.cluster,
        is_anomaly: pt.is_anomaly,
        anomaly_score: pt.anomaly_score,
        x: vx,
        y: vy,
      };

      if (pt.is_anomaly) {
        anomalies.push(item);
      } else {
        normals.push(item);
      }
      validPairs.push([vx, vy]);
    }

    // Linear regression calculation
    let r = 0;
    let r2 = 0;
    let slope = 0;
    let intercept = 0;

    const n = validPairs.length;
    if (n > 1) {
      let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;
      for (const [x, y] of validPairs) {
        sumX += x;
        sumY += y;
        sumXY += x * y;
        sumX2 += x * x;
        sumY2 += y * y;
      }
      const denom = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
      if (denom > 1e-9) {
        r = (n * sumXY - sumX * sumY) / denom;
        r2 = r * r;
      }
      const denomSlope = n * sumX2 - sumX * sumX;
      if (Math.abs(denomSlope) > 1e-9) {
        slope = (n * sumXY - sumX * sumY) / denomSlope;
        intercept = (sumY - slope * sumX) / n;
      }
    }

    return {
      normalData: normals,
      anomalyData: anomalies,
      stats: {
        r: Math.round(r * 1000) / 1000,
        r2: Math.round(r2 * 1000) / 1000,
        slope: Math.round(slope * 1000) / 1000,
        intercept: Math.round(intercept * 1000) / 1000,
        count: n,
      },
    };
  }, [points, featX, featY]);

  if (!featX || !featY) {
    return <p className="muted small">Select features to view correlation scatter plot.</p>;
  }

  return (
    <div className="corr-scatter-card">
      <div className="corr-scatter-toolbar">
        <div className="corr-axis-selectors">
          <label className="corr-axis-label">
            <span className="muted small">X-Axis Feature:</span>
            <select
              className="input sm"
              value={featX}
              onChange={(e) => onChangeX && onChangeX(e.target.value)}
              aria-label="Select X-Axis Feature"
            >
              {allFeatures.map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </label>

          <span className="corr-vs-badge" aria-hidden="true">&times;</span>

          <label className="corr-axis-label">
            <span className="muted small">Y-Axis Feature:</span>
            <select
              className="input sm"
              value={featY}
              onChange={(e) => onChangeY && onChangeY(e.target.value)}
              aria-label="Select Y-Axis Feature"
            >
              {allFeatures.map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </label>
        </div>

        {stats && (
          <div className="corr-scatter-stat-strip">
            <span className="stat-pill">
              <strong>r:</strong> {stats.r > 0 ? `+${stats.r}` : stats.r}
            </span>
            <span className="stat-pill">
              <strong>R&sup2;:</strong> {stats.r2}
            </span>
            <span className="stat-pill muted">
              {stats.count} plotted records
            </span>
          </div>
        )}
      </div>

      <div className="legend" style={{ marginTop: 10 }}>
        <span>
          <svg width="14" height="14" aria-hidden="true">
            <circle cx="7" cy="7" r="4.5" fill="#2B7DE9" fillOpacity=".6" />
          </svg>
          Main Pattern ({normalData.length})
        </span>
        <span>
          <svg width="14" height="14" aria-hidden="true">
            <path d="M2 2l10 10M12 2L2 12" stroke="#E8590C" strokeWidth="2.2" strokeLinecap="round" />
          </svg>
          Potential Anomaly ({anomalyData.length})
        </span>
      </div>

      <div className="chart" style={{ height: 420 }}>
        <ResponsiveContainer>
          <ScatterChart margin={{ top: 14, right: 24, bottom: 28, left: 14 }}>
            <CartesianGrid stroke="#e3eaf1" strokeDasharray="3 3" />
            <XAxis
              type="number"
              dataKey="x"
              tick={{ fontSize: 11 }}
              domain={["auto", "auto"]}
              label={{
                value: featX,
                position: "insideBottom",
                offset: -16,
                fill: "#5b6b7c",
                fontSize: 12,
                fontWeight: 600,
              }}
            />
            <YAxis
              type="number"
              dataKey="y"
              tick={{ fontSize: 11 }}
              domain={["auto", "auto"]}
              label={{
                value: featY,
                angle: -90,
                position: "insideLeft",
                fill: "#5b6b7c",
                fontSize: 12,
                fontWeight: 600,
              }}
            />
            <Tooltip
              content={<CustomTooltip featX={featX} featY={featY} />}
              cursor={{ strokeDasharray: "3 3" }}
            />
            <Scatter
              name="Main Pattern"
              data={normalData}
              shape={<NormalMarker />}
              isAnimationActive={false}
            />
            <Scatter
              name="Potential Anomaly"
              data={anomalyData}
              shape={<AnomalyMarker />}
              isAnimationActive={false}
            />
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      <p className="muted small" style={{ marginTop: 8 }}>
        Observations flagged as <strong>Potential Anomalies</strong> (cluster -1) are marked in orange. Notice how outliers deviate from the bivariate distribution clusters formed by standard medical profiles.
      </p>
    </div>
  );
}
