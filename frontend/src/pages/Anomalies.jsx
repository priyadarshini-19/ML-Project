import { useApp } from "../components/AppContext.jsx";
import { PageHeader, Card, EmptyState, Loader } from "../components/ui.jsx";
import AnomalyTable from "../components/AnomalyTable.jsx";

export default function Anomalies() {
  const { results, ready } = useApp();
  if (!ready) return <Loader text="Loading..." />;
  if (!results) return <EmptyState title="No results yet" text="Run DBSCAN to list the potentially unusual medical profiles." to="/upload" action="Upload Dataset" />;
  return (
    <>
      <PageHeader title="Anomaly Records" subtitle="Records labelled as potential anomalies are flagged for further clinical investigation." />
      <Card><AnomalyTable initialStatus="anomaly" /></Card>
    </>
  );
}
