"""Generates a SYNTHETIC demo CSV (not real clinical data). Run: python make_demo_data.py"""
import numpy as np, pandas as pd
from pathlib import Path

rng = np.random.default_rng(7)
n_norm, n_odd = 380, 20
sex = rng.choice(["Male", "Female"], n_norm)
norm = pd.DataFrame({
    "age": rng.normal(45, 12, n_norm).clip(18, 85).round(),
    "systolic_bp": rng.normal(122, 10, n_norm).round(),
    "glucose": rng.normal(98, 12, n_norm).round(1),
    "creatinine": rng.normal(0.95, 0.15, n_norm).clip(0.4).round(2),
    "hemoglobin": rng.normal(14, 1.1, n_norm).round(1),
    "wbc_count": rng.normal(7000, 1100, n_norm).round(),
    "bmi": rng.normal(25, 3.2, n_norm).round(1),
    "sex": sex,
    "smoker": rng.choice(["No", "Yes"], n_norm, p=[0.8, 0.2]),
})
odd = pd.DataFrame({
    "age": rng.uniform(5, 85, n_odd).round(),
    "systolic_bp": rng.choice([85, 95, 175, 195], n_odd) + rng.normal(0, 5, n_odd).round(),
    "glucose": rng.choice([50, 60, 220, 300], n_odd) + rng.normal(0, 8, n_odd).round(1),
    "creatinine": rng.uniform(2.2, 6.0, n_odd).round(2),
    "hemoglobin": rng.choice([6.5, 8, 18.5], n_odd) + rng.normal(0, 0.4, n_odd).round(1),
    "wbc_count": rng.choice([2200, 3000, 16000, 21000], n_odd) + rng.normal(0, 300, n_odd).round(),
    "bmi": rng.choice([14, 16, 39, 45], n_odd) + rng.normal(0, 1, n_odd).round(1),
    "sex": rng.choice(["Male", "Female"], n_odd),
    "smoker": rng.choice(["No", "Yes"], n_odd),
})
df = pd.concat([norm, odd], ignore_index=True).sample(frac=1, random_state=3).reset_index(drop=True)
# sprinkle missing values
for col in ["glucose", "creatinine", "hemoglobin", "smoker"]:
    df.loc[rng.choice(len(df), 12, replace=False), col] = np.nan
df.insert(0, "patient_id", [f"DEMO-{i:04d}" for i in range(1, len(df) + 1)])
out = Path(__file__).resolve().parent.parent / "sample_data" / "DEMO_synthetic_medical_profiles.csv"
df.to_csv(out, index=False)
print("Wrote", out, df.shape)
