import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell } from "recharts";

const AnomalyBarTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="tip">
      <strong>{d.feature}</strong>
      <div>
        Correlation with Anomaly Score: <strong>{d.r_score > 0 ? `+${d.r_score}` : d.r_score}</strong>
      </div>
      <div>
        Correlation with Flag: <strong>{d.r_anomaly > 0 ? `+${d.r_anomaly}` : d.r_anomaly}</strong>
      </div>
      <div style={{ marginTop: 4 }}>
        Normal Mean: {d.normal_mean} | Anomaly Mean: {d.anomaly_mean}
      </div>
      <div className="muted small">
        Difference: {d.diff_pct > 0 ? `+${d.diff_pct}%` : `${d.diff_pct}%`}
      </div>
    </div>
  );
};

export default function BiomarkerCorrelationBar({ data = [], onSelectFeature }) {
  if (!data.length) return null;

  // Clone and sort by absolute correlation descending
  const chartData = [...data].sort((a, b) => b.abs_r_score - a.abs_r_score);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 10 }}>
        <div>
          <h3 className="chart-title">Biomarker Association with Anomalies</h3>
          <p className="muted small">
            Pearson correlation between each medical feature and the DBSCAN anomaly isolation score.
          </p>
        </div>
      </div>

      <div className="chart" style={{ height: Math.max(260, chartData.length * 36) }}>
        <ResponsiveContainer>
          <BarChart
            layout="vertical"
            data={chartData}
            margin={{ top: 8, right: 30, bottom: 8, left: 75 }}
          >
            <CartesianGrid stroke="#e3eaf1" strokeDasharray="3 3" horizontal={false} />
            <XAxis
              type="number"
              domain={[-1, 1]}
              tick={{ fontSize: 11 }}
              tickFormatter={(v) => (v > 0 ? `+${v}` : v)}
            />
            <YAxis
              type="category"
              dataKey="feature"
              tick={{ fontSize: 12, fill: "#0B2A4A", fontWeight: 500 }}
              width={75}
            />
            <Tooltip content={<AnomalyBarTooltip />} />
            <Bar
              dataKey="r_score"
              name="Correlation (r)"
              radius={[4, 4, 4, 4]}
              onClick={(entry) => onSelectFeature && onSelectFeature(entry.feature)}
              cursor="pointer"
            >
              {chartData.map((entry) => {
                const isPos = entry.r_score >= 0;
                const isStrong = entry.abs_r_score >= 0.4;
                const fill = isStrong
                  ? isPos ? "#E8590C" : "#2B7DE9"
                  : isPos ? "#f39c6b" : "#7bb3f5";
                return <Cell key={entry.feature} fill={fill} />;
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="legend center-row" style={{ marginTop: 8 }}>
        <span>
          <span style={{ display: "inline-block", width: 12, height: 12, background: "#E8590C", borderRadius: 2 }} />
          Positive Correlation (Elevated in Anomalies)
        </span>
        <span>
          <span style={{ display: "inline-block", width: 12, height: 12, background: "#2B7DE9", borderRadius: 2 }} />
          Negative Correlation (Suppressed in Anomalies)
        </span>
      </div>
    </div>
  );
}
