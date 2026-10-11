import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell } from "recharts";

export default function ClusterBarChart({ data }) {
  return (
    <div>
      <h3 className="chart-title">DBSCAN Cluster Distribution</h3>
      <div className="chart" style={{ height: 280 }}>
        <ResponsiveContainer>
          <BarChart data={data} margin={{ top: 10, right: 12, bottom: 4, left: 0 }}>
            <CartesianGrid stroke="#e3eaf1" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
            <Tooltip />
            <Bar dataKey="count" name="Records" radius={[6, 6, 0, 0]}>
              {data.map((d) => <Cell key={d.name} fill={d.name.startsWith("Noise") ? "#E8590C" : "#0E9AA7"} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
