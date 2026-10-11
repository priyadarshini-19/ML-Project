"""PCA (visualisation only) and chart-ready JSON for the frontend."""
from typing import Dict

import numpy as np
from sklearn.decomposition import PCA

MAX_POINTS = 4000


def generate_pca(X: np.ndarray, labels: np.ndarray) -> Dict:
    n_comp = 2 if X.shape[1] >= 2 else 1
    pca = PCA(n_components=n_comp, random_state=42)
    comp = pca.fit_transform(X)
    if n_comp == 1:
        comp = np.column_stack([comp[:, 0], np.zeros(len(comp))])
    var = list(pca.explained_variance_ratio_) + [0.0] * (2 - n_comp)
    rng = np.random.default_rng(42)
    anomaly_idx = np.where(labels == -1)[0]
    normal_idx = np.where(labels != -1)[0]
    budget = max(MAX_POINTS - len(anomaly_idx), 500)
    sampled = len(normal_idx) > budget
    if sampled:  # keep every anomaly, sample normal points for speed
        normal_idx = np.sort(rng.choice(normal_idx, budget, replace=False))

    def pt(i):
        return {"x": round(float(comp[i, 0]), 4), "y": round(float(comp[i, 1]), 4),
                "record": int(i + 1), "cluster": int(labels[i])}

    return {"normal": [pt(i) for i in normal_idx], "anomalies": [pt(i) for i in anomaly_idx],
            "explained_variance": [round(float(v) * 100, 2) for v in var], "sampled": bool(sampled)}


def generate_visualizations(stats: Dict, k_curve, eps: float, pca_data: Dict) -> Dict:
    bars = [{"name": f"Cluster {k}", "count": v} for k, v in stats["cluster_sizes"].items()]
    if stats["potential_anomalies"]:
        bars.append({"name": "Noise (-1)", "count": stats["potential_anomalies"]})
    return {
        "k_distance": {"curve": k_curve, "eps": eps},
        "cluster_distribution": bars,
        "anomaly_vs_normal": [{"name": "Within Main Pattern", "value": stats["normal_records"]},
                              {"name": "Potential Anomaly", "value": stats["potential_anomalies"]}],
        "pca": pca_data,
    }
