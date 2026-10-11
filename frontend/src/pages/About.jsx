import { PageHeader, Card } from "../components/ui.jsx";

const ITEMS = [
  ["What is DBSCAN?", "Density-Based Spatial Clustering of Applications with Noise. It groups records that sit close together in dense regions and treats records in sparse regions as noise. It needs no preset number of clusters."],
  ["What is anomaly detection?", "Finding records that differ from the dominant patterns in the data. Here it is unsupervised: no diagnosis labels are used, so the model only knows what is common, not what is a disease."],
  ["Why is DBSCAN suitable for unusual-profile detection?", "Noise points are a built-in output of DBSCAN, clusters can have any shape, and it works without labels. Rare conditions are rarely labelled, so a density-based approach can still surface profiles that do not fit the main groups."],
  ["What is EPS?", "The radius of a point's neighbourhood. Two records are neighbours if their distance in the scaled feature space is at most EPS. Too small flags too much as noise; too large merges everything into one cluster."],
  ["What is MIN_SAMPLES?", "The minimum number of records (including the point itself) inside EPS for a point to be a core point of a cluster."],
  ["What does cluster -1 mean?", "Noise: the record is not in a dense region and does not belong to any cluster. This project labels it Potential Anomaly."],
  ["What is PCA?", "Principal Component Analysis projects many features onto a few directions that keep as much variance as possible. It is used here only to draw the 2D chart. DBSCAN runs on the full scaled feature matrix."],
  ["How are EPS and MIN_SAMPLES chosen automatically?", "MIN_SAMPLES is about twice the number of processed features, bounded for the dataset size. EPS is read from the elbow of the sorted k-distance graph, falling back to the 92nd percentile when no clear elbow exists. Both can be overridden manually."],
];

export default function About() {
  return (
    <>
      <PageHeader title="About Project" subtitle="Rare Disease Detection Using DBSCAN-Based Anomaly Detection (B.Tech CSE, Machine Learning)" />
      <p className="callout">
        DBSCAN identifies profiles that do not fit the dominant clustering structure. These profiles are flagged as potential
        anomalies and require further clinical investigation.
      </p>
      <div className="grid g2">
        {ITEMS.map(([q, a]) => <Card key={q} title={q}><p>{a}</p></Card>)}
      </div>
      <Card title="Limitations">
        <ul className="plain">
          <li>An anomaly is only unusual relative to this dataset. It is not evidence of a rare disease.</li>
          <li>Results depend on feature choice, scaling and the EPS / MIN_SAMPLES values.</li>
          <li>Datasets with many categorical columns create many one-hot features, which makes distances less informative.</li>
          <li>Research / Educational Use Only. Results should be reviewed by qualified healthcare professionals.</li>
        </ul>
      </Card>
    </>
  );
}
