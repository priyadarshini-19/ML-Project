"""Feature correlation and anomaly relationship analysis."""
from typing import Any, Dict, List, Optional
import numpy as np
import pandas as pd


def _strength_label(r: float) -> str:
    abs_r = abs(r)
    if abs_r >= 0.8:
        level = "Very strong"
    elif abs_r >= 0.6:
        level = "Strong"
    elif abs_r >= 0.4:
        level = "Moderate"
    elif abs_r >= 0.2:
        level = "Weak"
    else:
        return "Negligible"
    direction = "positive" if r > 0 else "negative"
    return f"{level} {direction}"


def compute_correlation_analysis(
    result_df: pd.DataFrame,
    numerical_cols: List[str],
    id_col: Optional[str] = None,
    max_scatter_points: int = 2500,
) -> Dict[str, Any]:
    """Compute pairwise Pearson correlations among numerical features,

    correlations with anomaly indicators, and data points for interactive plotting.
    """
    # Filter numerical columns that actually exist in result_df
    valid_cols = [c for c in numerical_cols if c in result_df.columns]

    if not valid_cols:
        return {
            "has_data": False,
            "message": "No numerical features available for correlation analysis.",
            "features": [],
            "matrix": [],
            "pairs": [],
            "anomaly_correlations": [],
            "points": [],
            "insights": {},
            "default_pair": None,
        }

    # Extract numerical sub-dataframe and impute NaNs with median for stable correlation
    num_df = result_df[valid_cols].copy()
    for col in valid_cols:
        # If all NaN or constant, keep as is
        median_val = num_df[col].median()
        if pd.isna(median_val):
            median_val = 0.0
        num_df[col] = num_df[col].fillna(median_val)

    # Compute correlation matrix
    corr_matrix = num_df.corr(method="pearson").fillna(0.0)

    # Ensure finite floats
    features = list(corr_matrix.columns)
    matrix_values: List[List[float]] = []
    for row in corr_matrix.values:
        clean_row = [round(float(np.nan_to_num(val, nan=0.0)), 4) for val in row]
        matrix_values.append(clean_row)

    # Compute pairwise relationships
    pairs = []
    multicollinear = []
    n = len(features)
    for i in range(n):
        for j in range(i + 1, n):
            feat_a = features[i]
            feat_b = features[j]
            r = round(float(matrix_values[i][j]), 4)
            abs_r = round(abs(r), 4)
            strength = _strength_label(r)
            pair_obj = {
                "x": feat_a,
                "y": feat_b,
                "r": r,
                "abs_r": abs_r,
                "strength": strength,
                "direction": "positive" if r >= 0 else "negative",
            }
            pairs.append(pair_obj)
            if abs_r >= 0.85:
                multicollinear.append({
                    "features": [feat_a, feat_b],
                    "r": r,
                    "note": f"{feat_a} and {feat_b} share {round(r*r*100, 1)}% variance, suggesting high redundancy.",
                })

    pairs.sort(key=lambda p: p["abs_r"], reverse=True)

    # Correlation with Anomaly_Score and Potential_Anomaly
    anomaly_correlations = []
    has_score = "Anomaly_Score" in result_df.columns
    has_anomaly = "Potential_Anomaly" in result_df.columns

    anomaly_mask = result_df["Potential_Anomaly"].astype(bool) if has_anomaly else pd.Series(False, index=result_df.index)
    normal_mask = ~anomaly_mask

    for feat in features:
        series = num_df[feat].astype(float)
        r_score = 0.0
        r_anom = 0.0

        if has_score:
            score_series = result_df["Anomaly_Score"].astype(float).fillna(0.0)
            if series.std() > 1e-9 and score_series.std() > 1e-9:
                r_val = np.corrcoef(series, score_series)[0, 1]
                r_score = round(float(np.nan_to_num(r_val, nan=0.0)), 4)

        if has_anomaly and anomaly_mask.any() and normal_mask.any():
            anom_series = anomaly_mask.astype(float)
            if series.std() > 1e-9:
                r_val = np.corrcoef(series, anom_series)[0, 1]
                r_anom = round(float(np.nan_to_num(r_val, nan=0.0)), 4)

        norm_mean = float(series[normal_mask].mean()) if normal_mask.any() else 0.0
        anom_mean = float(series[anomaly_mask].mean()) if anomaly_mask.any() else 0.0
        
        diff_pct = 0.0
        if abs(norm_mean) > 1e-6:
            diff_pct = round(((anom_mean - norm_mean) / abs(norm_mean)) * 100, 1)

        direction = "similar"
        if diff_pct > 15 or r_score > 0.25:
            direction = "higher_in_anomalies"
        elif diff_pct < -15 or r_score < -0.25:
            direction = "lower_in_anomalies"

        anomaly_correlations.append({
            "feature": feat,
            "r_score": r_score,
            "r_anomaly": r_anom,
            "abs_r_score": abs(r_score),
            "normal_mean": round(norm_mean, 2),
            "anomaly_mean": round(anom_mean, 2),
            "diff_pct": diff_pct,
            "direction": direction,
            "strength": _strength_label(r_score),
        })

    anomaly_correlations.sort(key=lambda item: item["abs_r_score"], reverse=True)

    # Sample points for interactive scatter chart
    total_rows = len(result_df)
    anomaly_indices = np.where(anomaly_mask)[0] if has_anomaly else np.array([], dtype=int)
    normal_indices = np.where(normal_mask)[0] if has_anomaly else np.arange(total_rows)

    budget = max(max_scatter_points - len(anomaly_indices), 400)
    if len(normal_indices) > budget:
        rng = np.random.default_rng(42)
        selected_normal = np.sort(rng.choice(normal_indices, budget, replace=False))
        keep_indices = np.sort(np.concatenate([anomaly_indices, selected_normal]))
    else:
        keep_indices = np.arange(total_rows)

    points = []
    clusters = result_df["DBSCAN_Cluster"].values if "DBSCAN_Cluster" in result_df.columns else np.zeros(total_rows, dtype=int)
    scores = result_df["Anomaly_Score"].values if has_score else np.zeros(total_rows, dtype=float)
    anom_bools = anomaly_mask.values

    # Determine identifier column if present
    id_values = None
    if id_col and id_col in result_df.columns:
        id_values = result_df[id_col].astype(str).values
    elif "patient_id" in result_df.columns:
        id_values = result_df["patient_id"].astype(str).values
    elif "Record" in result_df.columns:
        id_values = ("Record #" + result_df["Record"].astype(str)).values

    for idx in keep_indices:
        val_dict = {}
        for feat in features:
            val = float(num_df[feat].iloc[idx])
            val_dict[feat] = round(val, 2)

        pt = {
            "record": int(idx + 1),
            "id": str(id_values[idx]) if id_values is not None else f"Record {idx + 1}",
            "cluster": int(clusters[idx]),
            "is_anomaly": bool(anom_bools[idx]),
            "anomaly_score": round(float(scores[idx]), 4),
            "values": val_dict,
        }
        points.append(pt)

    # Key insights
    pos_pairs = [p for p in pairs if p["r"] > 0]
    neg_pairs = [p for p in pairs if p["r"] < 0]
    strongest_pos = max(pos_pairs, key=lambda p: p["r"]) if pos_pairs else None
    strongest_neg = min(neg_pairs, key=lambda p: p["r"]) if neg_pairs else None
    top_anomaly_driver = anomaly_correlations[0] if anomaly_correlations else None

    # Choose default pair: either top anomaly driver + 2nd feature, or top correlated pair
    if pairs:
        default_pair = {"x": pairs[0]["x"], "y": pairs[0]["y"]}
    elif len(features) >= 2:
        default_pair = {"x": features[0], "y": features[1]}
    else:
        default_pair = None

    return {
        "has_data": True,
        "features": features,
        "matrix": matrix_values,
        "pairs": pairs,
        "anomaly_correlations": anomaly_correlations,
        "points": points,
        "total_records": total_rows,
        "points_count": len(points),
        "is_sampled": len(points) < total_rows,
        "insights": {
            "strongest_positive": strongest_pos,
            "strongest_negative": strongest_neg,
            "top_anomaly_driver": top_anomaly_driver,
            "multicollinear_pairs": multicollinear,
        },
        "default_pair": default_pair,
    }
