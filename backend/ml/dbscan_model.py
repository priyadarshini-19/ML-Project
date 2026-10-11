"""Automatic DBSCAN parameter selection (k-distance elbow) and DBSCAN execution."""
from typing import Dict, Optional

import numpy as np
from sklearn.cluster import DBSCAN
from sklearn.neighbors import NearestNeighbors


def default_min_samples(n_rows: int, n_dims: int) -> int:
    """Rule of thumb: about 2 x dimensionality, bounded so small/large data stay sensible."""
    return int(max(4, min(2 * n_dims, 15, max(4, n_rows // 20))))


def k_distances(X: np.ndarray, k: int) -> np.ndarray:
    k = max(2, min(k, len(X) - 1))
    nn = NearestNeighbors(n_neighbors=k + 1).fit(X)  # +1: each point is its own nearest neighbour
    dist, _ = nn.kneighbors(X)
    return dist[:, -1]


def find_elbow(sorted_d: np.ndarray) -> int:
    """Index of the point furthest below the chord joining first and last points of the curve."""
    n = len(sorted_d)
    span = sorted_d[-1] - sorted_d[0]
    if span <= 0:
        return n - 1
    x = np.linspace(0, 1, n)
    y = (sorted_d - sorted_d[0]) / span
    return int(np.argmax(x - y))


def select_dbscan_parameters(X: np.ndarray, min_samples: Optional[int] = None) -> Dict:
    n, d = X.shape
    ms = int(min_samples) if min_samples else default_min_samples(n, d)
    ms = max(2, min(ms, n - 1))
    kd = k_distances(X, ms)
    sd = np.sort(kd)
    idx = find_elbow(sd)
    # The elbow of a sorted k-distance curve normally sits in the upper tail. If the detected knee is too
    # early (flat curve) fall back to the 92nd percentile so most data is not labelled noise.
    if idx < int(0.8 * n):
        eps, method = float(np.percentile(sd, 92)), "92nd percentile fallback"
    else:
        eps, method = float(sd[idx]), "k-distance elbow"
    eps = max(eps, 1e-6)
    step = max(1, n // 400)
    curve = [{"index": int(i), "distance": round(float(sd[i]), 5)} for i in range(0, n, step)]
    if curve[-1]["index"] != n - 1:
        curve.append({"index": n - 1, "distance": round(float(sd[-1]), 5)})
    return {"eps": round(eps, 4), "min_samples": ms, "elbow_index": idx, "method": method,
            "k_distance_curve": curve, "k_distance_values": kd}


def run_dbscan(X: np.ndarray, eps: float, min_samples: int) -> np.ndarray:
    """Real scikit-learn DBSCAN on the full scaled feature matrix (not on PCA output)."""
    return fit_dbscan(X, eps, min_samples).labels_


def fit_dbscan(X: np.ndarray, eps: float, min_samples: int) -> DBSCAN:
    """Fit DBSCAN and retain its core points for assessing one new profile later."""
    return DBSCAN(eps=float(eps), min_samples=int(min_samples), n_jobs=-1).fit(X)
