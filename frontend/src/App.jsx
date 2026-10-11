import { Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout.jsx";
import Home from "./pages/Home.jsx";
import Upload from "./pages/Upload.jsx";
import Inspection from "./pages/Inspection.jsx";
import Preprocessing from "./pages/Preprocessing.jsx";
import Config from "./pages/Config.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Correlation from "./pages/Correlation.jsx";
import ConfusionMatrix from "./pages/ConfusionMatrix.jsx";
import Anomalies from "./pages/Anomalies.jsx";
import PatientAssessment from "./pages/PatientAssessment.jsx";
import About from "./pages/About.jsx";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/upload" element={<Upload />} />
        <Route path="/inspection" element={<Inspection />} />
        <Route path="/preprocessing" element={<Preprocessing />} />
        <Route path="/config" element={<Config />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/correlation" element={<Correlation />} />
        <Route path="/confusion-matrix" element={<ConfusionMatrix />} />
        <Route path="/anomalies" element={<Anomalies />} />
        <Route path="/patient-assessment" element={<PatientAssessment />} />
        <Route path="/about" element={<About />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
