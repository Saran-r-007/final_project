import { useState, useEffect, useRef } from "react";
import AuthPage from "./components/AuthPage";
import Header from "./components/Header";
import AudioInputSection from "./components/AudioInputSection";
import ProcessingProgress from "./components/ProcessingProgress";
import EmergencyBanner from "./components/EmergencyBanner";
import WaveformPlayer from "./components/WaveformPlayer";
import MultiTrackTimeline from "./components/MultiTrackTimeline";
import ReportBreakdown from "./components/ReportBreakdown";
import NotificationModal from "./components/NotificationModal";
import HistoryPage from "./components/HistoryPage";
import EmergencyPanel from "./components/EmergencyPanel";
import AccountPage from "./components/AccountPage";

import {
  checkHealth,
  getMe,
  logout as apiLogout,
  uploadAudioFile,
  startAnalysis,
  getJobStatus,
  getAnalysisResults,
  getWaveformData,
  exportReport,
} from "./services/api";

export default function App() {
  const [user, setUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [backendHealthy, setBackendHealthy] = useState(false);
  const [modelsLoaded, setModelsLoaded] = useState(null);
  const [activeView, setActiveView] = useState("dashboard");
  const [currentFile, setCurrentFile] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [audioId, setAudioId] = useState(null);
  const [jobId, setJobId] = useState(null);
  const [jobStatus, setJobStatus] = useState(null);
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState("");
  const [analysisId, setAnalysisId] = useState(null);
  const [report, setReport] = useState(null);
  const [waveformPoints, setWaveformPoints] = useState([]);
  const [currentTime, setCurrentTime] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [isNotifModalOpen, setIsNotifModalOpen] = useState(false);
  const [viewingReportId, setViewingReportId] = useState(null);

  const pollingRef = useRef(null);

  // Check auth on load
  useEffect(() => {
    const token = localStorage.getItem("auth_token");
    if (!token) {
      setAuthChecked(true);
      return;
    }
    let cancelled = false;
    getMe()
      .then((u) => { if (!cancelled) setUser(u); })
      .catch(() => localStorage.removeItem("auth_token"))
      .finally(() => { if (!cancelled) setAuthChecked(true); });
    return () => { cancelled = true; };
  }, []);

  // Check backend health on load and periodically
  useEffect(() => {
    let isMounted = true;
    const ping = async () => {
      try {
        const res = await checkHealth();
        if (isMounted) {
          setBackendHealthy(true);
          setModelsLoaded(res.models_loaded || null);
        }
      } catch {
        if (isMounted) setBackendHealthy(false);
      }
    };
    ping();
    const interval = setInterval(ping, 8000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // Poll job status
  useEffect(() => {
    if (!jobId || jobStatus === "COMPLETED" || jobStatus === "FAILED") {
      if (pollingRef.current) clearInterval(pollingRef.current);
      return;
    }

    pollingRef.current = setInterval(async () => {
      try {
        const st = await getJobStatus(jobId);
        setJobStatus(st.status);
        setProgress(st.progress);
        setCurrentStep(st.current_step);

        if (st.status === "COMPLETED" && st.analysis_id) {
          clearInterval(pollingRef.current);
          setIsProcessing(false);
          setAnalysisId(st.analysis_id);

          const rep = await getAnalysisResults(st.analysis_id);
          setReport(rep);

          if (st.audio_id) {
            const wf = await getWaveformData(st.audio_id).catch(() => ({ points: [] }));
            setWaveformPoints(wf.points || []);
          }
        } else if (st.status === "FAILED") {
          clearInterval(pollingRef.current);
          setIsProcessing(false);
          setError(st.error || "Analysis pipeline encountered an error.");
        }
      } catch (err) {
        console.error("Polling error:", err);
      }
    }, 1200);

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [jobId, jobStatus]);

  const handleAuthSuccess = (userData) => {
    setUser(userData);
  };

  const handleLogout = async () => {
    try {
      await apiLogout();
    } catch {
      // ignore logout errors
    }
    localStorage.removeItem("auth_token");
    setUser(null);
    setActiveView("dashboard");
    setReport(null);
    setCurrentFile(null);
    setAudioId(null);
    setJobId(null);
    setAnalysisId(null);
    setIsProcessing(false);
  };

  const handleNavigate = (view) => {
    setActiveView(view);
    setViewingReportId(null);
    if (view === "dashboard") {
      setReport(null);
      setError(null);
    }
  };

  const handleViewReport = async (analysisId) => {
    try {
      setViewingReportId(analysisId);
      setActiveView("dashboard");
      setIsProcessing(false);
      setError(null);
      setReport(null);
      const rep = await getAnalysisResults(analysisId);
      setReport(rep);
      if (rep.audio_info?.audio_id) {
        const wf = await getWaveformData(rep.audio_info.audio_id).catch(() => ({ points: [] }));
        setWaveformPoints(wf.points || []);
        setAudioUrl(null);
      }
    } catch (err) {
      setError("Failed to load report: " + err.message);
    }
  };

  const handleAudioSelected = async (file) => {
    try {
      setError(null);
      setReport(null);
      setCurrentFile(file);
      setIsProcessing(true);
      setProgress(5);
      setCurrentStep("Uploading audio file to server...");

      const url = URL.createObjectURL(file);
      setAudioUrl(url);

      const uploadRes = await uploadAudioFile(file);
      setAudioId(uploadRes.audio_id);

      setProgress(10);
      setCurrentStep("Initiating deep learning pipeline...");
      const analyzeRes = await startAnalysis(uploadRes.audio_id);
      setJobId(analyzeRes.job_id);
      setJobStatus(analyzeRes.status);
    } catch (err) {
      setIsProcessing(false);
      setError(err.message || "Failed to process audio.");
    }
  };

  const handleExport = async (aId, format) => {
    try {
      const data = await exportReport(aId, format);
      const blob = new Blob([format === "json" ? JSON.stringify(data, null, 2) : data], {
        type: format === "json" ? "application/json" : "text/plain",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Audio_Intelligence_Report_${aId}.${format}`;
      a.click();
    } catch (err) {
      setError("Export failed: " + err.message);
    }
  };

  // Auth check loading
  if (!authChecked) {
    return (
      <div className="auth-loading-screen">
        <div
          style={{
            width: 48,
            height: 48,
            border: "3px solid rgba(99,102,241,0.2)",
            borderTop: "3px solid #6366f1",
            borderRadius: "50%",
            animation: "spin 0.9s linear infinite",
          }}
        />
      </div>
    );
  }

  // Show auth page if not logged in
  if (!user) {
    return <AuthPage onAuthSuccess={handleAuthSuccess} />;
  }

  return (
    <div className="app-wrapper">
      {/* Header */}
      <Header
        backendHealthy={backendHealthy}
        modelsLoaded={modelsLoaded}
        onOpenNotifications={() => setIsNotifModalOpen(true)}
        user={user}
        onLogout={handleLogout}
        activeView={activeView}
        onNavigate={handleNavigate}
      />

      {/* Main Content */}
      <main className="app-content">
        {/* ── DASHBOARD VIEW ── */}
        {activeView === "dashboard" && (
          <>
            <AudioInputSection
              onAudioSelected={handleAudioSelected}
              isProcessing={isProcessing}
              currentAudioFile={currentFile}
            />

            {isProcessing && (
              <ProcessingProgress
                jobStatus={jobStatus}
                progress={progress}
                currentStep={currentStep}
                error={error}
              />
            )}

            {!isProcessing && error && (
              <div className="error-banner mb-6">
                <div style={{ fontSize: 13, color: "#fda4af", fontWeight: 600 }}>
                  {error}
                </div>
              </div>
            )}

            {report && (
              <div className="animate-fade-in">
                <EmergencyBanner report={report} />

                <WaveformPlayer
                  audioUrl={audioUrl}
                  waveformPoints={waveformPoints}
                  duration={report.audio_info?.duration || 0}
                  onSeek={(t) => setCurrentTime(t)}
                  audioInfo={report.audio_info}
                />

                <MultiTrackTimeline
                  timeline={report.timeline || []}
                  duration={report.audio_info?.duration || 0}
                  currentTime={currentTime}
                  onSeek={(t) => setCurrentTime(t)}
                />

                <ReportBreakdown
                  report={report}
                  analysisId={analysisId}
                  onExport={handleExport}
                />
              </div>
            )}
          </>
        )}

        {/* ── HISTORY VIEW ── */}
        {activeView === "history" && (
          <HistoryPage
            onBack={() => setActiveView("dashboard")}
            onViewReport={handleViewReport}
          />
        )}

        {/* ── EMERGENCY VIEW ── */}
        {activeView === "emergency" && (
          <EmergencyPanel
            onBack={() => setActiveView("dashboard")}
            user={user}
          />
        )}

        {/* ── ACCOUNT VIEW ── */}
        {activeView === "account" && (
          <AccountPage
            onBack={() => setActiveView("dashboard")}
            onLogout={handleLogout}
            onUserUpdate={(u) => setUser(u)}
          />
        )}
      </main>

      {/* Notification Configuration Modal */}
      <NotificationModal
        isOpen={isNotifModalOpen}
        onClose={() => setIsNotifModalOpen(false)}
      />
    </div>
  );
}
