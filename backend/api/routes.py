"""REST endpoints. Holds one in-memory session (single-user demo) and delegates all ML to backend/ml."""
import os
import re
from pathlib import Path
from typing import Any, Dict, List, Optional

import numpy as np
import pandas as pd
from fastapi import APIRouter, File, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from ml.anomaly_detection import detect_anomalies, generate_statistics, save_results
from ml.correlation import compute_correlation_analysis
from ml.dbscan_model import fit_dbscan, select_dbscan_parameters
from ml.evaluation import compute_confusion_matrix_analysis
from ml.preprocessing import clean_dataset, inspect_dataset, load_dataset, preprocess_dataset
from ml.visualization import generate_pca, generate_visualizations

BASE = Path(__file__).resolve().parent.parent
UPLOADS, RESULTS = BASE / "uploads", BASE / "results"
SAMPLE = BASE.parent / "sample_data" / "DEMO_synthetic_medical_profiles.csv"
MAX_BYTES = 50 * 1024 * 1024
DISCLAIMER = ("Research / Educational Use Only. Potential anomalies are not medical diagnoses. "
              "Results should be reviewed by qualified healthcare professionals.")

router = APIRouter()
S: dict = {}  # session state


def _need(*keys):
    missing = [k for k in keys if k not in S]
    if missing:
        hints = {"df": "Upload a dataset first.", "pre": "Run preprocessing first.", "result": "Run DBSCAN first."}
        raise HTTPException(409, hints[missing[0]])


class PreprocessIn(BaseModel):
    id_columns: List[str] = []
    target_columns: List[str] = []


class DbscanIn(BaseModel):
    mode: str = Field("auto", pattern="^(auto|manual)$")
    eps: Optional[float] = Field(None, gt=0)
    min_samples: Optional[int] = Field(None, ge=2)


class PatientAssessmentIn(BaseModel):
    """Raw feature values entered in the patient-details form."""
    values: Dict[str, Any]


def _store(df, name, size):
    S.clear()
    S.update(df=df, name=name, size=size)
    return {"file_name": name, "file_size": size, "rows": int(df.shape[0]), "columns": int(df.shape[1]),
            "status": "Uploaded", "is_demo": name.startswith("DEMO_")}


@router.post("/upload")
async def upload(file: UploadFile = File(...)):
    if not (file.filename or "").lower().endswith(".csv"):
        raise HTTPException(400, "Only .csv files are supported.")
    raw = await file.read()
    if not raw:
        raise HTTPException(400, "The file is empty.")
    if len(raw) > MAX_BYTES:
        raise HTTPException(413, "File is larger than 50 MB.")
    try:
        df = load_dataset(raw)
    except ValueError as e:
        raise HTTPException(422, str(e))
    safe = re.sub(r"[^A-Za-z0-9._-]", "_", file.filename)
    (UPLOADS / safe).write_bytes(raw)
    return _store(df, file.filename, len(raw))


@router.post("/upload-sample")
def upload_sample():
    if not SAMPLE.exists():
        raise HTTPException(404, "Demo dataset not found in sample_data/.")
    return _store(load_dataset(str(SAMPLE)), SAMPLE.name, SAMPLE.stat().st_size)


@router.post("/reset")
def reset():
    S.clear()
    return {"status": "reset"}


@router.get("/status")
def status():
    return {"has_dataset": "df" in S, "has_preprocessing": "pre" in S, "has_results": "result" in S,
            "file_name": S.get("name")}


@router.post("/analyze")
def analyze():
    _need("df")
    info = inspect_dataset(S["df"])
    info["file_name"], info["file_size"] = S["name"], S["size"]
    S["inspection"] = info
    return info


def _kd_payload(kp):
    return {"eps": kp["eps"], "min_samples": kp["min_samples"], "method": kp["method"],
            "k_distance_curve": kp["k_distance_curve"], "elbow_index": kp["elbow_index"]}


@router.post("/preprocess")
def preprocess(body: PreprocessIn):
    _need("df")
    df = S["df"]
    unknown = [c for c in body.id_columns + body.target_columns if c not in df.columns]
    if unknown:
        raise HTTPException(422, f"Unknown columns: {unknown}")
    try:
        cleaned = clean_dataset(df, body.id_columns, body.target_columns)
        pre = preprocess_dataset(cleaned["features"])
        kp = select_dbscan_parameters(pre["X"])
    except ValueError as e:
        raise HTTPException(422, str(e))
    S["pre"] = {**pre, "removed": cleaned["removed"], "feature_cols": cleaned["features"].columns.tolist(),
                "id_columns": body.id_columns, "target_columns": body.target_columns}
    S.pop("result", None)
    return {
        "original_features": df.columns.tolist(),
        "removed_columns": cleaned["removed"],
        "used_columns": cleaned["features"].columns.tolist(),
        "numerical_features": pre["numerical"], "categorical_features": pre["categorical"],
        "missing_values_filled": pre["missing_filled"],
        "final_feature_count": int(pre["X"].shape[1]),
        "final_feature_names": pre["feature_names"][:200],
        "matrix_shape": list(pre["X"].shape),
        "parameters": _kd_payload(kp),
    }


@router.get("/kdistance")
def kdistance(min_samples: Optional[int] = Query(None, ge=2)):
    _need("df", "pre")
    kp = select_dbscan_parameters(S["pre"]["X"], min_samples)
    return _kd_payload(kp)


@router.post("/dbscan")
def dbscan(body: DbscanIn):
    _need("df", "pre")
    X = S["pre"]["X"]
    if body.mode == "manual" and (body.eps is None or body.min_samples is None):
        raise HTTPException(422, "Manual mode needs both eps and min_samples.")
    kp = select_dbscan_parameters(X, body.min_samples if body.mode == "manual" else None)
    eps = body.eps if body.mode == "manual" else kp["eps"]
    ms = kp["min_samples"]
    model = fit_dbscan(X, eps, ms)
    labels = model.labels_
    result_df = detect_anomalies(S["df"], labels, kp["k_distance_values"])
    stats = generate_statistics(labels)
    pca = generate_pca(X, labels)
    viz = generate_visualizations(stats, kp["k_distance_curve"], float(eps), pca)
    out_path = save_results(result_df, str(RESULTS / "dbscan_results.csv"))
    inspection = S.get("inspection") or inspect_dataset(S["df"])
    S["result"] = {
        "df": result_df, "viz": viz, "path": out_path, "model": model,
        "summary": {
            "dataset_name": S["name"], "is_demo": S["name"].startswith("DEMO_"),
            "rows": int(S["df"].shape[0]), "columns": int(S["df"].shape[1]),
            "features_used": int(X.shape[1]), "original_features_used": len(S["pre"]["feature_cols"]),
            "numerical_features": len(S["pre"]["numerical"]), "categorical_features": len(S["pre"]["categorical"]),
            "missing_values": inspection["missing_values"],
            "mode": body.mode, "eps": float(eps), "min_samples": ms, "eps_method": kp["method"],
            **stats, "disclaimer": DISCLAIMER,
        },
    }
    return S["result"]["summary"]


@router.get("/results")
def results():
    _need("df", "pre", "result")
    return S["result"]["summary"]


@router.get("/visualization")
def visualization():
    _need("df", "pre", "result")
    return S["result"]["viz"]


@router.get("/correlation")
def correlation():
    if "result" in S:
        if "correlation" not in S["result"]:
            pre = S["pre"]
            result_df = S["result"]["df"]
            id_col = pre.get("id_columns", [None])[0] if pre.get("id_columns") else None
            S["result"]["correlation"] = compute_correlation_analysis(
                result_df=result_df,
                numerical_cols=pre["numerical"],
                id_col=id_col,
            )
        return S["result"]["correlation"]
    elif "pre" in S and "df" in S:
        pre = S["pre"]
        id_col = pre.get("id_columns", [None])[0] if pre.get("id_columns") else None
        return compute_correlation_analysis(
            result_df=S["df"],
            numerical_cols=pre["numerical"],
            id_col=id_col,
        )
    else:
        _need("df", "pre", "result")


@router.get("/confusion-matrix")
def confusion_matrix_endpoint(
    mode: str = Query("auto", pattern="^(auto|column|benchmark|rule)$"),
    target_column: Optional[str] = None,
    positive_value: Optional[str] = None,
    rule_feature: Optional[str] = None,
    rule_operator: str = Query(">"),
    rule_threshold: Optional[float] = None,
):
    _need("df", "pre", "result")
    pre = S["pre"]
    result_df = S["result"]["df"]
    id_col = pre.get("id_columns", [None])[0] if pre.get("id_columns") else None

    # If target_column wasn't explicitly given in query, try inspection target_columns
    if not target_column and pre.get("target_columns"):
        target_column = pre["target_columns"][0]
        if mode == "auto":
            mode = "column"

    return compute_confusion_matrix_analysis(
        result_df=result_df,
        X=pre.get("X"),
        numerical_cols=pre.get("numerical"),
        mode=mode,
        target_column=target_column,
        positive_value=positive_value,
        rule_feature=rule_feature,
        rule_operator=rule_operator,
        rule_threshold=rule_threshold,
        id_col=id_col,
    )


def _patient_fields():
    """Describe the exact usable dataset columns for the dynamic patient form."""
    pre, df = S["pre"], S["df"]
    fields = []
    for column in pre["feature_cols"]:
        numeric = column in pre["numerical"]
        item = {"name": column, "type": "number" if numeric else "category"}
        if not numeric:
            # Form choices come from the uploaded dataset.  Keep a generous cap so
            # the API remains safe for a column with unexpectedly many values.
            values = df[column].dropna().astype(str).unique().tolist()
            item["options"] = sorted(values, key=str.casefold)[:100]
        fields.append(item)
    return fields


@router.get("/patient-form")
def patient_form():
    _need("df", "pre", "result")
    return {"dataset_name": S["name"], "fields": _patient_fields()}


def _normalise_patient_values(values: Dict[str, Any]) -> pd.DataFrame:
    """Validate submitted values and construct one row in original feature order."""
    pre = S["pre"]
    feature_columns = pre["feature_cols"]
    unexpected = sorted(set(values) - set(feature_columns))
    if unexpected:
        raise HTTPException(422, f"Unknown patient fields: {unexpected}")

    row = {}
    populated = 0
    for column in feature_columns:
        raw = values.get(column)
        if raw is None or (isinstance(raw, str) and not raw.strip()):
            row[column] = np.nan
            continue
        if column in pre["numerical"]:
            try:
                value = float(raw)
            except (TypeError, ValueError):
                raise HTTPException(422, f"{column} must be a number.")
            if not np.isfinite(value):
                raise HTTPException(422, f"{column} must be a finite number.")
            row[column] = value
        else:
            row[column] = str(raw).strip()
        populated += 1
    if not populated:
        raise HTTPException(422, "Enter at least one patient detail before assessing the profile.")
    return pd.DataFrame([row], columns=feature_columns)


@router.post("/assess-patient")
def assess_patient(body: PatientAssessmentIn):
    """Assess a new profile against the already fitted DBSCAN dataset model.

    DBSCAN has no native ``predict`` operation.  A profile joins a learned pattern
    when it falls within EPS of any fitted core sample; otherwise it is treated as
    a noise-like, potentially unusual profile.  This is an out-of-sample heuristic,
    not a clinical risk or diagnosis.
    """
    _need("df", "pre", "result")
    patient = _normalise_patient_values(body.values)
    pre, result = S["pre"], S["result"]
    X_patient = np.asarray(pre["transformer"].transform(patient), dtype=float)
    model = result["model"]
    core_indexes = model.core_sample_indices_
    if len(core_indexes) == 0:
        raise HTTPException(422, "The current DBSCAN run has no core samples. Adjust parameters and run DBSCAN again.")

    core_X = pre["X"][core_indexes]
    distances = np.linalg.norm(core_X - X_patient[0], axis=1)
    nearest_index = int(np.argmin(distances))
    nearest_distance = float(distances[nearest_index])
    eps = float(result["summary"]["eps"])
    ratio = nearest_distance / eps if eps else float("inf")
    within_pattern = nearest_distance <= eps
    nearest_cluster = int(model.labels_[core_indexes[nearest_index]])

    if not within_pattern:
        level, status = "High", "Potential anomaly"
        interpretation = "No DBSCAN core pattern was found within the selected EPS neighbourhood."
    elif ratio >= 0.75:
        level, status = "Moderate", "Boundary profile"
        interpretation = "The profile falls within a learned pattern, but near its EPS boundary."
    else:
        level, status = "Low", "Within learned pattern"
        interpretation = "The profile is close to a learned DBSCAN core pattern."

    submitted = patient.astype(object).where(patient.notna(), None).iloc[0].to_dict()
    return {
        "status": status,
        "risk_level": level,
        "profile_risk_factor": round(min(100.0, ratio * 100), 1),
        "nearest_core_distance": round(nearest_distance, 4),
        "eps": eps,
        "nearest_cluster": nearest_cluster if within_pattern else None,
        "interpretation": interpretation,
        "patient": submitted,
        "disclaimer": ("This is a DBSCAN similarity result relative to the uploaded dataset, not a medical risk "
                       "score, diagnosis, or treatment recommendation."),
    }


@router.get("/anomalies")
def anomalies(status: str = Query("all", pattern="^(all|normal|anomaly)$"), search: str = "",
              sort_by: Optional[str] = None, order: str = Query("asc", pattern="^(asc|desc)$"),
              page: int = Query(1, ge=1), page_size: int = Query(25, ge=5, le=200)):
    _need("df", "pre", "result")
    df: pd.DataFrame = S["result"]["df"]
    if status == "normal":
        df = df[~df["Potential_Anomaly"]]
    elif status == "anomaly":
        df = df[df["Potential_Anomaly"]]
    if search.strip():
        hay = df.astype(str).agg(" ".join, axis=1).str.lower()
        df = df[hay.str.contains(search.strip().lower(), regex=False)]
    if sort_by:
        if sort_by not in df.columns:
            raise HTTPException(422, f"Unknown sort column: {sort_by}")
        df = df.sort_values(sort_by, ascending=(order == "asc"), na_position="last", kind="mergesort")
    total = len(df)
    chunk = df.iloc[(page - 1) * page_size: page * page_size]
    chunk = chunk.astype(object).where(chunk.notna(), None)
    cols = chunk.columns.tolist()
    return {"columns": cols, "rows": chunk.values.tolist(), "total": total, "page": page,
            "page_size": page_size, "pages": max(1, -(-total // page_size))}


@router.get("/download")
def download():
    _need("df", "pre", "result")
    stem = os.path.splitext(S["name"])[0]
    return FileResponse(S["result"]["path"], media_type="text/csv", filename=f"{stem}_dbscan_results.csv")
