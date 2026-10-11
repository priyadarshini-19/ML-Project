# Rare Disease Detection Using DBSCAN-Based Anomaly Detection

B.Tech CSE (Machine Learning) project: a full-stack web app that uploads any structured disease CSV, preprocesses it,
selects DBSCAN parameters from the k-distance graph, runs **scikit-learn DBSCAN**, and flags noise points (cluster `-1`)
as **Potential Anomalies / unusual medical profiles** for further clinical investigation.

> **Research / Educational Use Only.** DBSCAN does not diagnose rare diseases. Potential anomalies are not medical
> diagnoses and must be reviewed by qualified healthcare professionals.

## Stack
- Frontend: React 18, React Router, Recharts, Vite
- Backend: Python, FastAPI, pandas, NumPy, scikit-learn (DBSCAN, PCA, StandardScaler, OneHotEncoder, SimpleImputer)

## Setup (exact commands)

### 1. Install Python
Install Python 3.10+ from https://www.python.org/downloads/ (tick "Add Python to PATH" on Windows). Check: `python --version`

### 2. Create a virtual environment
```bash
cd rare-disease-dbscan/backend
python -m venv .venv
# macOS / Linux
source .venv/bin/activate
# Windows (PowerShell)
.venv\Scripts\Activate.ps1
```

### 3. Install backend requirements
```bash
pip install -r requirements.txt
```

### 4. Start the FastAPI server
```bash
uvicorn main:app --reload --port 8000
```
API docs: http://localhost:8000/docs

### 5. Install Node.js
Install Node.js 18+ (LTS) from https://nodejs.org. Check: `node --version`

### 6. Install frontend dependencies (new terminal)
```bash
cd rare-disease-dbscan/frontend
npm install
```

### 7. Start the React development server
```bash
npm run dev
```

### 8. Open the website
http://localhost:5173

### 9. Upload a CSV
Go to **Upload Dataset**, drag in a CSV (or click **Load DEMO dataset**), then click **Analyze Dataset**.

### 10. Run anomaly detection
1. On **Inspection**, confirm which columns are ID / label (they are removed), then **Confirm and run preprocessing**.
2. On **Preprocessing**, review the pipeline, then **Continue to DBSCAN setup**.
3. On **DBSCAN setup**, keep *Automatic* (or switch to *Manual*) and click **Run DBSCAN**.
4. The **Dashboard** shows cards, charts, PCA, the anomaly report and a searchable table. Use **Download Results CSV**.
5. Open **Correlation graph** (right after Dashboard) to inspect the Pearson correlation matrix heatmap, interactive 2D scatter regression plots across any pair of clinical features, and biomarker anomaly correlation rankings.
6. Open **Confusion matrix** (right after Correlation graph) to evaluate DBSCAN anomaly predictions against ground-truth labels, clinical biomarker criteria, or ensemble consensus benchmarks (calculates Sensitivity, Specificity, Precision, F1-Score, and case-by-case breakdowns).
7. Open **Assess patient**, enter the dataset-style patient details, then calculate the DBSCAN profile factor. It compares the new profile with the completed model's core patterns; it is a dataset-similarity result, not a medical risk score or diagnosis.

If the backend runs on another address, copy `frontend/.env.example` to `frontend/.env` and set `VITE_API_URL`.

## Using your own CSV instead of the demo
Just upload it on the Upload page; column names are never hard-coded. To replace the demo file, put your CSV in
`sample_data/` named `DEMO_synthetic_medical_profiles.csv` (the "Load DEMO dataset" button reads that file) or edit `SAMPLE`
in `backend/api/routes.py`. The demo data is **synthetic** (`backend/make_demo_data.py`) and is not real clinical data.

## How the pipeline works
| Step | Code |
|---|---|
| Load CSV (encoding/delimiter sniffing, `?`/blank to NaN, numeric-as-text fix) | `ml/preprocessing.py: load_dataset` |
| Inspect, suggest ID/label columns | `inspect_dataset`, `detect_columns` |
| Drop confirmed ID/label columns, constant, >60% missing, free-text columns | `clean_dataset` |
| Median / most-frequent imputation, one-hot encoding, standard scaling | `preprocess_dataset` |
| k-distance curve, elbow EPS, MIN_SAMPLES rule | `ml/dbscan_model.py: select_dbscan_parameters` |
| DBSCAN on the full scaled matrix | `run_dbscan` |
| Flags, statistics, CSV output | `ml/anomaly_detection.py` |
| PCA (visualisation only), chart data | `ml/visualization.py` |
| Feature correlation matrix, 2D scatter & biomarker anomaly ranking | `ml/correlation.py: compute_correlation_analysis` |
| Diagnostic Confusion Matrix & validation metrics | `ml/evaluation.py: compute_confusion_matrix_analysis` |

Label detection is by name **and** value count, and is only a suggestion: you confirm or change every role. The downloaded CSV
contains the original columns plus `DBSCAN_Cluster`, `Potential_Anomaly`, `Anomaly_Status` and `Anomaly_Score`
(distance to the k-th nearest neighbour in scaled space; larger = more isolated).

## API
`POST /api/upload`, `POST /api/upload-sample`, `POST /api/analyze`, `POST /api/preprocess`, `GET /api/kdistance`,
`POST /api/dbscan`, `GET /api/results`, `GET /api/correlation`, `GET /api/confusion-matrix`, `GET /api/anomalies`, `GET /api/visualization`, `GET /api/patient-form`,
`POST /api/assess-patient`, `GET /api/download`, `POST /api/reset`.
The backend keeps one in-memory session (single-user demo).

## Moving your Colab code into the backend
Each Colab cell maps to one function: upload/read CSV to `load_dataset`; imputing/encoding/scaling to `preprocess_dataset`;
k-distance plot to `select_dbscan_parameters` (returns the curve and EPS); `DBSCAN(...).fit` to `run_dbscan`;
`labels == -1` to `detect_anomalies`; PCA scatter to `generate_pca`. Keep the function signatures and return values and the
frontend will keep working. Replace `plt.show()` calls with returned data.

## Limitations
Anomalies are relative to the uploaded dataset only; results depend on features, scaling, EPS and MIN_SAMPLES; many categorical
columns inflate dimensionality; the session is single-user.
