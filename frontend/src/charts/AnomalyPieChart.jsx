import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from "recharts";

const COLORS = { "Within Main Pattern": "#1F9D6B", "Potential Anomaly": "#E8590C" };

export default function AnomalyPieChart({ data }) {
  return (
    <div>
      <h3 className="chart-title">Potential Anomalies vs Main Pattern</h3>
      <div className="chart" style={{ height: 280 }}>
        <ResponsiveContainer>
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius={62} outerRadius={100} paddingAngle={2}>
              {data.map((d) => <Cell key={d.name} fill={COLORS[d.name]} />)}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
