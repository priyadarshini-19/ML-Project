"""Clinical diagnostic evaluation: Confusion Matrix and performance metrics."""
from typing import Any, Dict, List, Optional
import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
from sklearn.metrics import confusion_matrix


POSITIVE_KEYWORDS = {
    "1", "true", "yes", "y", "positive", "pos", "anomaly", "abnormal", "rare",
    "disease", "sick", "case", "malignant", "outlier", "unusual", "affected"
}
NEGATIVE_KEYWORDS = {
    "0", "false", "no", "n", "negative", "neg", "normal", "healthy", "control",
    "benign", "standard", "typical", "unaffected"
}


def find_candidate_target_columns(df: pd.DataFrame, excluded_cols: Optional[List[str]] = None) -> List[Dict[str, Any]]:
    """Identify columns in the dataset that can serve as ground truth labels."""
    excluded = set(excluded_cols or [])
    candidates = []
    n = len(df)

    for col in df.columns:
        if col in excluded:
            continue
        valid_vals = df[col].dropna().astype(str).str.strip()
        nunique = valid_vals.nunique()
        if 2 <= nunique <= 12:
            unique_list = sorted(valid_vals.unique().tolist(), key=str.casefold)
            
            # Suggest positive label based on keywords or rarity
            suggested_pos = None
            for val in unique_list:
                if val.lower() in POSITIVE_KEYWORDS:
                    suggested_pos = val
                    break
            if not suggested_pos:
                # If binary, choose the rarer class as anomaly/positive
                counts = valid_vals.value_counts()
                suggested_pos = str(counts.index[-1])  # least frequent

            candidates.append({
                "column": col,
                "unique_values": unique_list,
                "suggested_positive": suggested_pos,
                "is_binary": nunique == 2,
            })

    return candidates


def compute_confusion_matrix_analysis(
    result_df: pd.DataFrame,
    X: Optional[np.ndarray] = None,
    numerical_cols: Optional[List[str]] = None,
    mode: str = "auto",  # 'column', 'benchmark', 'rule', or 'auto'
    target_column: Optional[str] = None,
    positive_value: Optional[str] = None,
    rule_feature: Optional[str] = None,
    rule_operator: str = ">",
    rule_threshold: Optional[float] = None,
    id_col: Optional[str] = None,
) -> Dict[str, Any]:
    """Compute confusion matrix comparing DBSCAN predictions against ground truth."""
    total_records = len(result_df)
    if total_records == 0 or "Potential_Anomaly" not in result_df.columns:
        return {
            "has_data": False,
            "message": "DBSCAN results not available for evaluation.",
        }

    y_pred = result_df["Potential_Anomaly"].astype(bool).values
    candidates = find_candidate_target_columns(
        result_df,
        excluded_cols=["Record", "DBSCAN_Cluster", "Potential_Anomaly", "Anomaly_Status", "Anomaly_Score"]
    )

    source_type = mode
    source_description = ""
    pos_label_display = "Positive / Anomaly"
    neg_label_display = "Negative / Normal"
    y_true = None

    # Auto-detection mode resolution
    if mode == "auto":
        if target_column and target_column in result_df.columns:
            source_type = "column"
        elif candidates:
            # Check if any candidate column has a recognized target/diagnosis name
            target_match = next((c for c in candidates if any(t in c["column"].lower() for t in ["target", "label", "class", "diagnosis", "disease", "rare"])), None)
            if target_match:
                target_column = target_match["column"]
                positive_value = target_match["suggested_positive"]
                source_type = "column"
            else:
                # Default to benchmark model if no explicit label column exists
                source_type = "benchmark"
        else:
            source_type = "benchmark"

    # 1. Column-based Ground Truth
    if source_type == "column":
        if not target_column or target_column not in result_df.columns:
            if candidates:
                target_column = candidates[0]["column"]
                positive_value = candidates[0]["suggested_positive"]
            else:
                source_type = "benchmark"

        if source_type == "column":
            col_series = result_df[target_column].astype(str).str.strip()
            if not positive_value:
                # Match candidate
                cand = next((c for c in candidates if c["column"] == target_column), None)
                positive_value = cand["suggested_positive"] if cand else str(col_series.value_counts().index[-1])

            y_true = (col_series.str.lower() == str(positive_value).strip().lower()).values
            pos_label_display = str(positive_value)
            neg_vals = [v for v in col_series.unique() if str(v).strip().lower() != str(positive_value).strip().lower()]
            neg_label_display = neg_vals[0] if len(neg_vals) == 1 else "Non-" + str(positive_value)
            source_description = f"Ground truth from column '{target_column}' (Positive Class = '{pos_label_display}')"

    # 2. Rule-based Ground Truth (e.g. Biomarker Extreme Elevation)
    elif source_type == "rule":
        valid_nums = numerical_cols or result_df.select_dtypes(include=[np.number]).columns.tolist()
        valid_nums = [c for c in valid_nums if c in result_df.columns and c not in ["Record", "DBSCAN_Cluster", "Anomaly_Score"]]

        if not rule_feature or rule_feature not in valid_nums:
            # Default to creatinine or highest variance numerical feature
            if "creatinine" in valid_nums:
                rule_feature = "creatinine"
                rule_threshold = 2.0
                rule_operator = ">"
            elif valid_nums:
                rule_feature = valid_nums[0]
                rule_threshold = float(result_df[rule_feature].quantile(0.95))
                rule_operator = ">"
            else:
                source_type = "benchmark"

        if source_type == "rule":
            series = pd.to_numeric(result_df[rule_feature], errors="coerce").fillna(0.0)
            thresh = float(rule_threshold) if rule_threshold is not None else float(series.mean() + 2 * series.std())
            if rule_operator == ">":
                y_true = (series > thresh).values
            elif rule_operator == ">=":
                y_true = (series >= thresh).values
            elif rule_operator == "<":
                y_true = (series < thresh).values
            elif rule_operator == "<=":
                y_true = (series <= thresh).values
            else:
                y_true = (series > thresh).values

            pos_label_display = f"{rule_feature} {rule_operator} {round(thresh, 2)}"
            neg_label_display = f"Standard {rule_feature}"
            source_description = f"Clinical Biomarker Rule: {pos_label_display}"

    # 3. Independent Benchmark Consensus (Isolation Forest)
    if source_type == "benchmark" or y_true is None:
        source_type = "benchmark"
        contamination = max(0.01, min(0.35, float((y_pred.sum() / max(1, total_records)))))
        if X is not None and X.shape[1] >= 1:
            matrix_for_if = X
        else:
            nums = result_df.select_dtypes(include=[np.number]).columns.drop(["Record", "DBSCAN_Cluster", "Anomaly_Score"], errors="ignore")
            matrix_for_if = result_df[nums].fillna(0.0).values

        clf = IsolationForest(contamination=contamination, random_state=42)
        if_preds = clf.fit_predict(matrix_for_if)
        y_true = (if_preds == -1)
        pos_label_display = "Consensus Anomaly (Isolation Forest)"
        neg_label_display = "Consensus Normal"
        source_description = f"Ensemble Consensus Benchmark (Isolation Forest with {round(contamination*100, 1)}% contamination)"

    # Compute 2x2 confusion matrix: labels=[False, True] where True is Positive
    cm = confusion_matrix(y_true, y_pred, labels=[False, True])
    tn = int(cm[0, 0])
    fp = int(cm[0, 1])
    fn = int(cm[1, 0])
    tp = int(cm[1, 1])

    actual_positives = tp + fn
    actual_negatives = tn + fp
    predicted_positives = tp + fp
    predicted_negatives = tn + fn

    # Calculate rates with zero-division safety
    def safe_div(num, den):
        return round(float(num / den), 4) if den > 0 else 0.0

    tpr = safe_div(tp, actual_positives)  # Sensitivity / Recall
    tnr = safe_div(tn, actual_negatives)  # Specificity
    ppv = safe_div(tp, predicted_positives)  # Precision
    npv = safe_div(tn, predicted_negatives)  # Negative Predictive Value
    fpr = safe_div(fp, actual_negatives)  # False Positive Rate
    fnr = safe_div(fn, actual_positives)  # False Negative Rate (Miss Rate)
    accuracy = safe_div(tp + tn, total_records)
    balanced_acc = round((tpr + tnr) / 2.0, 4)
    f1_score = round(2 * (ppv * tpr) / (ppv + tpr), 4) if (ppv + tpr) > 0 else 0.0

    # Build qualitative clinical interpretation
    insights = []
    if tpr >= 0.85:
        insights.append(f"High sensitivity ({round(tpr * 100, 1)}%): DBSCAN successfully captured the vast majority of rare/abnormal profiles.")
    elif tpr >= 0.60:
        insights.append(f"Moderate sensitivity ({round(tpr * 100, 1)}%): DBSCAN detected a substantial fraction of rare cases, but {fn} case(s) joined normal clusters.")
    else:
        insights.append(f"Low sensitivity ({round(tpr * 100, 1)}%): {fn} rare profile(s) were misclassified as standard patterns. Consider adjusting EPS or MIN_SAMPLES.")

    if tnr >= 0.95:
        insights.append(f"High specificity ({round(tnr * 100, 1)}%): Very few false alarms ({fp} standard profile(s) incorrectly flagged).")
    else:
        insights.append(f"Specificity is {round(tnr * 100, 1)}% ({fp} false alarms). Higher EPS may consolidate these points into core clusters.")

    # Compile case items for the table
    id_values = None
    if id_col and id_col in result_df.columns:
        id_values = result_df[id_col].astype(str).values
    elif "patient_id" in result_df.columns:
        id_values = result_df["patient_id"].astype(str).values
    elif "Record" in result_df.columns:
        id_values = ("Record #" + result_df["Record"].astype(str)).values

    scores = result_df["Anomaly_Score"].values if "Anomaly_Score" in result_df.columns else np.zeros(total_records)
    clusters = result_df["DBSCAN_Cluster"].values if "DBSCAN_Cluster" in result_df.columns else np.zeros(total_records)

    display_features = numerical_cols or ["age", "creatinine", "glucose", "systolic_bp", "wbc_count"]
    display_features = [c for c in display_features if c in result_df.columns][:6]

    cases = []
    for i in range(total_records):
        act = bool(y_true[i])
        prd = bool(y_pred[i])
        if act and prd:
            cat = "TP"
        elif not act and prd:
            cat = "FP"
        elif act and not prd:
            cat = "FN"
        else:
            cat = "TN"

        row_vals = {feat: round(float(result_df[feat].iloc[i]), 2) for feat in display_features if pd.notna(result_df[feat].iloc[i])}

        cases.append({
            "record": int(i + 1),
            "id": str(id_values[i]) if id_values is not None else f"Record #{i + 1}",
            "actual": pos_label_display if act else neg_label_display,
            "predicted": "Potential Anomaly" if prd else "Within Main Pattern",
            "category": cat,
            "is_anomaly": prd,
            "anomaly_score": round(float(scores[i]), 4),
            "cluster": int(clusters[i]),
            "values": row_vals,
        })

    # Available numerical features for rule mode
    avail_nums = numerical_cols or result_df.select_dtypes(include=[np.number]).columns.tolist()
    avail_nums = [c for c in avail_nums if c in result_df.columns and c not in ["Record", "DBSCAN_Cluster", "Anomaly_Score"]]

    return {
        "has_data": True,
        "source_type": source_type,
        "source_description": source_description,
        "target_column": target_column,
        "positive_value": str(positive_value) if positive_value is not None else pos_label_display,
        "pos_label_display": pos_label_display,
        "neg_label_display": neg_label_display,
        "total_records": total_records,
        "actual_positives": actual_positives,
        "actual_negatives": actual_negatives,
        "predicted_positives": predicted_positives,
        "predicted_negatives": predicted_negatives,
        "matrix": {
            "tp": tp,
            "fp": fp,
            "fn": fn,
            "tn": tn,
        },
        "rates": {
            "sensitivity": round(tpr * 100, 2),  # Recall (%)
            "specificity": round(tnr * 100, 2),  # TNR (%)
            "precision": round(ppv * 100, 2),  # PPV (%)
            "npv": round(npv * 100, 2),  # NPV (%)
            "accuracy": round(accuracy * 100, 2),  # Accuracy (%)
            "balanced_accuracy": round(balanced_acc * 100, 2),
            "f1_score": f1_score,
            "fpr": round(fpr * 100, 2),  # False alarm rate (%)
            "fnr": round(fnr * 100, 2),  # Miss rate (%)
        },
        "insights": insights,
        "cases": cases,
        "display_features": display_features,
        "available_columns": candidates,
        "available_numerical_features": avail_nums,
        "current_rule": {
            "feature": rule_feature,
            "operator": rule_operator,
            "threshold": rule_threshold,
        } if source_type == "rule" else None,
    }
