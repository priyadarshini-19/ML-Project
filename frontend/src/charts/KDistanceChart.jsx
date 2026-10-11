import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine } from "recharts";

export default function KDistanceChart({ curve, eps, minSamples }) {
  return (
    <div>
      <h3 className="chart-title">K-Distance Graph for DBSCAN EPS Selection</h3>
      <div className="chart" style={{ height: 300 }}>
        <ResponsiveContainer>
          <LineChart data={curve} margin={{ top: 10, right: 20, bottom: 24, left: 8 }}>
            <CartesianGrid stroke="#e3eaf1" strokeDasharray="3 3" />
            <XAxis dataKey="index" label={{ value: "Points sorted by distance", position: "insideBottom", offset: -14, fill: "#5b6b7c", fontSize: 12 }} tick={{ fontSize: 11 }} />
            <YAxis label={{ value: `Distance to ${minSamples ?? "k"}th neighbour`, angle: -90, position: "insideLeft", fill: "#5b6b7c", fontSize: 12 }} tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v) => [v, "k-distance"]} labelFormatter={(l) => `Point #${l}`} />
            <Line type="monotone" dataKey="distance" stroke="#0E9AA7" strokeWidth={2.4} dot={false} />
            {eps != null && (
              <ReferenceLine y={eps} stroke="#E8590C" strokeDasharray="6 4"
                label={{ value: `EPS = ${eps}`, position: "insideTopLeft", fill: "#E8590C", fontSize: 12 }} />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="muted small">The elbow region is used as a reference for selecting EPS.</p>
    </div>
  );
}
