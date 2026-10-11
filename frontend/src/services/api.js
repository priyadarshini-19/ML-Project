const BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

async function request(path, options = {}) {
  let res;
  try {
    res = await fetch(`${BASE}/api${path}`, options);
  } catch {
    throw new Error("Cannot reach the backend. Start it with: uvicorn main:app --reload --port 8000");
  }
  if (!res.ok) {
    let detail = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (typeof body.detail === "string") detail = body.detail;
      else if (Array.isArray(body.detail)) detail = body.detail.map((d) => d.msg).join("; ");
    } catch { /* keep default message */ }
    throw new Error(detail);
  }
  return res.json();
}

const json = (body) => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

export const api = {
  downloadUrl: `${BASE}/api/download`,
  status: () => request("/status"),
  upload: (file) => {
    const fd = new FormData();
    fd.append("file", file);
    return request("/upload", { method: "POST", body: fd });
  },
  uploadSample: () => request("/upload-sample", { method: "POST" }),
  reset: () => request("/reset", { method: "POST" }),
  analyze: () => request("/analyze", { method: "POST" }),
  preprocess: (idColumns, targetColumns) =>
    request("/preprocess", json({ id_columns: idColumns, target_columns: targetColumns })),
  kdistance: (minSamples) => request(`/kdistance?min_samples=${minSamples}`),
  runDbscan: (params) => request("/dbscan", json(params)),
  results: () => request("/results"),
  visualization: () => request("/visualization"),
  correlation: () => request("/correlation"),
  confusionMatrix: (params = {}) => request(`/confusion-matrix?${new URLSearchParams(params).toString()}`),
  anomalies: (q) => request(`/anomalies?${new URLSearchParams(q).toString()}`),
  patientForm: () => request("/patient-form"),
  assessPatient: (values) => request("/assess-patient", json({ values })),
};
