"""Dataset loading, inspection, column detection, cleaning and preprocessing.

All functions are dataset-agnostic: nothing here depends on fixed column names.
"""
import io
import re
from typing import Dict, List

import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

MISSING_TOKENS = ["?", "", " ", "NA", "N/A", "na", "n/a", "NaN", "nan", "NULL", "null", "None", "-"]
ID_PATTERN = re.compile(
    r"(^|[^a-z])(id|uid|uuid|pid|mrn)($|[^a-z])|(patient|record|case|sample|subject)[_\s-]?(id|no|number|num)$|^(sl|s)[_\s.]?no$|^index$|^unnamed",
    re.I)
TARGET_NAMES = ["target", "label", "class", "classification", "diagnosis", "disease", "outcome", "result"]


def load_dataset(source) -> pd.DataFrame:
    """Load a CSV from a path or raw bytes, trying common encodings and delimiters."""
    raw = bytes(source) if isinstance(source, (bytes, bytearray)) else open(source, "rb").read()
    df, last_err = None, None
    for enc in ("utf-8-sig", "latin-1"):
        try:
            df = pd.read_csv(io.BytesIO(raw), sep=None, engine="python", encoding=enc,
                             na_values=MISSING_TOKENS, skipinitialspace=True)
            break
        except Exception as exc:  # noqa: BLE001
            last_err = exc
    if df is None:
        raise ValueError(f"Could not read the file as CSV: {last_err}")
    df.columns = [str(c).strip() for c in df.columns]
    df = df.dropna(axis=1, how="all")
    for c in df.columns:
        if df[c].dtype == object:
            s = df[c].astype(str).str.strip()
            s = s.where(~s.isin(MISSING_TOKENS + ["nan", "None"]), np.nan)
            df[c] = s
            coerced = pd.to_numeric(s, errors="coerce")
            non_null = s.notna().sum()
            if non_null and coerced.notna().sum() / non_null >= 0.9:
                df[c] = coerced  # numeric column stored as text (stray tabs, '?' etc.)
    if df.shape[0] < 10:
        raise ValueError("The dataset needs at least 10 rows to run DBSCAN.")
    if df.shape[1] < 2:
        raise ValueError("The dataset needs at least 2 columns.")
    return df.reset_index(drop=True)


def _numeric_cols(df):
    return df.select_dtypes(include=[np.number]).columns.tolist()


def _categorical_cols(df):
    num = set(_numeric_cols(df))
    return [c for c in df.columns if c not in num]


def detect_columns(df: pd.DataFrame) -> Dict:
    """Suggest ID and target/label columns. These are suggestions only - the user confirms them."""
    n = len(df)
    ids, targets = [], []
    for c in df.columns:
        nunique = df[c].nunique(dropna=True)
        unique_ratio = nunique / max(n, 1)
        numeric = pd.api.types.is_numeric_dtype(df[c])
        int_like = numeric and bool((df[c].dropna() % 1 == 0).all())
        if ID_PATTERN.search(c.strip()) and unique_ratio > 0.5:
            ids.append({"column": c, "reason": "Name looks like an ID and values are mostly unique"})
        elif unique_ratio == 1 and (not numeric or int_like) and n > 20:
            ids.append({"column": c, "reason": "Every value is unique"})
    id_names = {i["column"] for i in ids}
    for c in df.columns:
        if c in id_names:
            continue
        low = c.lower().strip()
        nunique = df[c].nunique(dropna=True)
        keyword = any(low == t or low.endswith("_" + t) or low.startswith(t + "_") or t in low.split() for t in TARGET_NAMES)
        if keyword and (2 <= nunique <= 20 or nunique <= 0.1 * n):
            targets.append({"column": c, "reason": f"Name suggests a label and it has {nunique} distinct values"})
    return {"id_columns": ids, "target_columns": targets}


def inspect_dataset(df: pd.DataFrame, preview_rows: int = 10) -> Dict:
    num, cat = _numeric_cols(df), _categorical_cols(df)
    cols = [{
        "name": c,
        "dtype": "numerical" if c in num else "categorical",
        "raw_dtype": str(df[c].dtype),
        "missing": int(df[c].isna().sum()),
        "missing_pct": round(float(df[c].isna().mean() * 100), 2),
        "unique": int(df[c].nunique(dropna=True)),
    } for c in df.columns]
    head = df.head(preview_rows).astype(object)
    head = head.where(head.notna(), None)
    return {
        "rows": int(df.shape[0]), "columns": int(df.shape[1]),
        "missing_values": int(df.isna().sum().sum()),
        "duplicate_rows": int(df.duplicated().sum()),
        "numerical_columns": num, "categorical_columns": cat,
        "column_summary": cols,
        "preview": {"columns": df.columns.tolist(), "rows": head.values.tolist()},
        "detected": detect_columns(df),
    }


def clean_dataset(df: pd.DataFrame, id_columns: List[str], target_columns: List[str]) -> Dict:
    """Drop confirmed ID/target columns plus unusable features. Returns the feature frame and a removal log."""
    removed = [{"column": c, "reason": "Confirmed ID column"} for c in id_columns if c in df.columns]
    removed += [{"column": c, "reason": "Label/target column (excluded from unsupervised DBSCAN)"}
                for c in target_columns if c in df.columns and c not in id_columns]
    feats = df.drop(columns=[r["column"] for r in removed])
    for c in list(feats.columns):
        miss = feats[c].isna().mean()
        nun = feats[c].nunique(dropna=True)
        if miss > 0.6:
            removed.append({"column": c, "reason": f"{miss:.0%} of values are missing"})
            feats = feats.drop(columns=c)
        elif nun <= 1:
            removed.append({"column": c, "reason": "Constant column (no information)"})
            feats = feats.drop(columns=c)
        elif c in _categorical_cols(feats) and nun > max(30, 0.5 * len(feats)):
            removed.append({"column": c, "reason": f"Free-text / high-cardinality ({nun} unique values)"})
            feats = feats.drop(columns=c)
    if feats.shape[1] == 0:
        raise ValueError("No usable feature columns remain after cleaning. Review the removed columns.")
    return {"features": feats, "removed": removed}


def preprocess_dataset(features: pd.DataFrame) -> Dict:
    """Impute -> one-hot encode -> scale. Returns the final matrix and feature names."""
    num, cat = _numeric_cols(features), _categorical_cols(features)
    transformers = []
    if num:
        transformers.append(("num", Pipeline([("imp", SimpleImputer(strategy="median")),
                                              ("scale", StandardScaler())]), num))
    if cat:
        cat_df_cols = cat
        transformers.append(("cat", Pipeline([("imp", SimpleImputer(strategy="most_frequent")),
                                              ("enc", OneHotEncoder(handle_unknown="ignore", sparse_output=False)),
                                              ("scale", StandardScaler())]), cat_df_cols))
    ct = ColumnTransformer(transformers)
    feats = features.copy()
    for c in cat:
        feats[c] = feats[c].astype(str).where(features[c].notna(), np.nan)
    X = np.asarray(ct.fit_transform(feats), dtype=float)
    names = [n.split("__", 1)[-1] for n in ct.get_feature_names_out()]
    # Keep the fitted transformer so a newly entered patient can be represented in
    # precisely the same feature space as the uploaded dataset.
    return {"X": X, "transformer": ct, "feature_names": names, "numerical": num, "categorical": cat,
            "missing_filled": int(features.isna().sum().sum())}
