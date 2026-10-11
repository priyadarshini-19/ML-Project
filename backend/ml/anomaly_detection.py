"""Turn DBSCAN labels into anomaly flags, statistics and downloadable results."""
from typing import Dict

import numpy as np
import pandas as pd

NORMAL = "Within Main Pattern"
ANOMALY = "Potential Anomaly"


def detect_anomalies(df: pd.DataFrame, labels: np.ndarray, scores: np.ndarray) -> pd.DataFrame:
    out = df.copy()
    out.insert(0, "Record", np.arange(1, len(df) + 1))
    out["DBSCAN_Cluster"] = labels.astype(int)
    out["Potential_Anomaly"] = labels == -1
    out["Anomaly_Status"] = np.where(labels == -1, ANOMALY, NORMAL)
    out["Anomaly_Score"] = np.round(scores, 4)
    return out


def generate_statistics(labels: np.ndarray) -> Dict:
    total = int(len(labels))
    anomalies = int((labels == -1).sum())
    ids, counts = np.unique(labels[labels != -1], return_counts=True)
    return {
        "total_records": total,
        "clusters": int(len(ids)),
        "potential_anomalies": anomalies,
        "normal_records": total - anomalies,
        "anomaly_percentage": round(anomalies / total * 100, 2) if total else 0.0,
        "cluster_sizes": {int(i): int(c) for i, c in zip(ids, counts)},
    }


def save_results(result_df: pd.DataFrame, path: str) -> str:
    """Save original columns + DBSCAN_Cluster + Potential_Anomaly (+ status and k-distance score)."""
    result_df.drop(columns=["Record"]).to_csv(path, index=False)
    return path
