import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api } from "../services/api.js";

const Ctx = createContext(null);
export const useApp = () => useContext(Ctx);

/** Holds the pipeline state. The backend keeps the data; this mirrors what the UI needs to render. */
export function AppProvider({ children }) {
  const [upload, setUpload] = useState(null);
  const [inspection, setInspection] = useState(null);
  const [prep, setPrep] = useState(null);
  const [results, setResults] = useState(null);
  const [viz, setViz] = useState(null);
  const [correlation, setCorrelation] = useState(null);
  const [ready, setReady] = useState(false);

  // Restore state after a browser refresh (backend session is still alive).
  useEffect(() => {
    (async () => {
      try {
        const st = await api.status();
        if (st.has_dataset) {
          setUpload({ file_name: st.file_name });
          setInspection(await api.analyze());
        }
        if (st.has_results) {
          const [r, v, c] = await Promise.all([
            api.results(),
            api.visualization(),
            api.correlation().catch(() => null),
          ]);
          setResults(r);
          setViz(v);
          setCorrelation(c);
        }
      } catch { /* backend offline: pages show their own errors */ }
      setReady(true);
    })();
  }, []);

  const reset = useCallback(async () => {
    try { await api.reset(); } catch { /* ignore */ }
    setUpload(null); setInspection(null); setPrep(null); setResults(null); setViz(null); setCorrelation(null);
  }, []);

  const value = {
    upload, setUpload,
    inspection, setInspection,
    prep, setPrep,
    results, setResults,
    viz, setViz,
    correlation, setCorrelation,
    reset,
    ready,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
