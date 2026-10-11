import { ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

const XMarker = ({ cx, cy }) => {
  if (cx == null || cy == null) return null;
  return (
    <g stroke="#E8590C" strokeWidth={2.4} strokeLinecap="round">
      <line x1={cx - 5} y1={cy - 5} x2={cx + 5} y2={cy + 5} />
      <line x1={cx - 5} y1={cy + 5} x2={cx + 5} y2={cy - 5} />
    </g>
  );
};
const Dot = ({ cx, cy }) => (cx == null ? null : <circle cx={cx} cy={cy} r={3.6} fill="#2B7DE9" fillOpacity={0.55} />);

const Tip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="tip">
      <strong>Record {p.record}</strong>
      <div>Cluster: {p.cluster}</div>
      <div>PC1 {p.x}, PC2 {p.y}</div>
    </div>
  );
};

export default function PCAScatter({ pca }) {
  const [v1, v2] = pca.explained_variance;
  return (
    <div>
      <h3 className="chart-title">DBSCAN-Based Medical Profile Anomaly Detection</h3>
      <div className="legend">
        <span><svg width="14" height="14"><circle cx="7" cy="7" r="4.5" fill="#2B7DE9" fillOpacity=".6" /></svg> Main Pattern</span>
        <span><svg width="14" height="14"><path d="M2 2l10 10M12 2L2 12" stroke="#E8590C" strokeWidth="2.2" strokeLinecap="round" /></svg> Potential Anomaly</span>
      </div>
      <div className="chart" style={{ height: 420 }}>
        <ResponsiveContainer>
          <ScatterChart margin={{ top: 10, right: 20, bottom: 30, left: 10 }}>
            <CartesianGrid stroke="#e3eaf1" strokeDasharray="3 3" />
            <XAxis type="number" dataKey="x" tick={{ fontSize: 11 }} domain={["auto", "auto"]}
              label={{ value: `Principal Component 1 (${v1}% variance)`, position: "insideBottom", offset: -16, fill: "#5b6b7c", fontSize: 12 }} />
            <YAxis type="number" dataKey="y" tick={{ fontSize: 11 }} domain={["auto", "auto"]}
              label={{ value: `Principal Component 2 (${v2}%)`, angle: -90, position: "insideLeft", fill: "#5b6b7c", fontSize: 12 }} />
            <Tooltip content={<Tip />} cursor={{ strokeDasharray: "3 3" }} />
            <Scatter name="Main Pattern" data={pca.normal} shape={<Dot />} isAnimationActive={false} />
            <Scatter name="Potential Anomaly" data={pca.anomalies} shape={<XMarker />} isAnimationActive={false} />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
      <p className="muted small">
        PCA is used only to visualise the data in 2D. DBSCAN itself ran on the full scaled feature matrix.
        {pca.sampled && " Main-pattern points are sampled for display; every potential anomaly is shown."}
      </p>
    </div>
  );
}
