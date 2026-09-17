import { useEffect, useState } from "react";
import {
  Loader2, CheckCircle2, AlertCircle, Waves,
  Cpu, Radio, Zap, Brain, ShieldAlert, BarChart2, FileText, Layers
} from "lucide-react";

const STEPS = [
  { label: "Preprocessing",       pct: 10,  icon: Waves,      color: "#06b6d4" },
  { label: "Whisper ASR",         pct: 25,  icon: FileText,   color: "#6366f1" },
  { label: "Speaker Analysis",    pct: 40,  icon: Cpu,        color: "#8b5cf6" },
  { label: "Sound Classification",pct: 55,  icon: BarChart2,  color: "#a855f7" },
  { label: "Music Analysis",      pct: 65,  icon: Radio,      color: "#d946ef" },
  { label: "Source Separation",   pct: 75,  icon: Layers,     color: "#ec4899" },
  { label: "Gemini ALM",          pct: 85,  icon: Brain,      color: "#f43f5e" },
  { label: "Risk Assessment",     pct: 92,  icon: ShieldAlert,color: "#f59e0b" },
  { label: "Final Report",        pct: 100, icon: Zap,        color: "#10b981" },
];

export default function ProcessingProgress({ jobStatus, progress, currentStep, error }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (jobStatus === "COMPLETED" || jobStatus === "FAILED") return;
    const t = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [jobStatus]);

  const formatElapsed = (s) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
  };

  const isFailed = jobStatus === "FAILED";
  const isDone = progress >= 100;

  return (
    <div className="glass-panel p-6 mb-6 animate-fade-in">
      {/* Header row */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          marginBottom: 20,
          gap: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {/* Status icon */}
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              background: isFailed
                ? "rgba(244,63,94,0.12)"
                : isDone
                ? "rgba(16,185,129,0.12)"
                : "rgba(99,102,241,0.12)",
              border: `1px solid ${
                isFailed
                  ? "rgba(244,63,94,0.3)"
                  : isDone
                  ? "rgba(16,185,129,0.3)"
                  : "rgba(99,102,241,0.3)"
              }`,
            }}
          >
            {isFailed ? (
              <AlertCircle style={{ width: 22, height: 22, color: "#f43f5e" }} />
            ) : isDone ? (
              <CheckCircle2 style={{ width: 22, height: 22, color: "#34d399" }} />
            ) : (
              <Loader2
                style={{
                  width: 22,
                  height: 22,
                  color: "#818cf8",
                  animation: "spin 1s linear infinite",
                }}
              />
            )}
          </div>

          <div>
            <div
              style={{
                fontSize: 15,
                fontWeight: 700,
                color: isFailed ? "#fda4af" : isDone ? "#6ee7b7" : "#f1f5f9",
                marginBottom: 4,
              }}
            >
              {isFailed
                ? "Pipeline Error"
                : isDone
                ? "Analysis Complete"
                : "Processing Audio — Deep Learning Pipeline"}
            </div>
            <div style={{ fontSize: 12, color: "#64748b", lineHeight: 1.5 }}>
              {error ? (
                <span style={{ color: "#fda4af" }}>{error}</span>
              ) : (
                currentStep || "Initializing neural models..."
              )}
            </div>
          </div>
        </div>

        {/* Right: Progress % + Elapsed */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 24,
              fontWeight: 800,
              color: isFailed ? "#f43f5e" : isDone ? "#34d399" : "#818cf8",
              lineHeight: 1,
            }}
          >
            {progress}%
          </span>
          {!isDone && !isFailed && (
            <span style={{ fontSize: 10, color: "#64748b", fontFamily: "var(--font-mono)" }}>
              {formatElapsed(elapsed)} elapsed
            </span>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div
        style={{
          width: "100%",
          height: 8,
          background: "rgba(255,255,255,0.05)",
          borderRadius: 6,
          overflow: "hidden",
          marginBottom: 24,
          border: "1px solid rgba(255,255,255,0.04)",
        }}
      >
        <div
          style={{
            width: `${progress}%`,
            height: "100%",
            borderRadius: 6,
            background: isFailed
              ? "linear-gradient(90deg, #f43f5e, #fb7185)"
              : "linear-gradient(90deg, #6366f1, #8b5cf6, #d946ef)",
            transition: "width 0.5s cubic-bezier(0.4,0,0.2,1)",
            boxShadow: isFailed
              ? "0 0 12px rgba(244,63,94,0.5)"
              : `0 0 12px rgba(99,102,241,${progress > 0 ? 0.5 : 0})`,
          }}
        />
      </div>

      {/* Step grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(100px, 1fr))",
          gap: 8,
        }}
      >
        {STEPS.map((step, idx) => {
          const isDone = progress >= step.pct;
          const isCurrent =
            !isFailed && !isDone && (idx === 0 || progress >= STEPS[idx - 1].pct);
          const Icon = step.icon;

          return (
            <div
              key={step.label}
              className={`pipeline-step ${isDone ? "done" : isCurrent ? "active" : "pending"}`}
            >
              <div
                style={{
                  marginBottom: 6,
                  display: "flex",
                  justifyContent: "center",
                }}
              >
                <Icon
                  style={{
                    width: 16,
                    height: 16,
                    color: isDone
                      ? "#34d399"
                      : isCurrent
                      ? step.color
                      : "#3f5068",
                    transition: "color 0.3s",
                  }}
                />
              </div>
              <div
                style={{
                  fontSize: 9,
                  fontFamily: "var(--font-mono)",
                  color: isDone ? "#34d399" : isCurrent ? "#94a3b8" : "#3f5068",
                  fontWeight: 700,
                  letterSpacing: "0.06em",
                  marginBottom: 2,
                }}
              >
                STEP {idx + 1}
              </div>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  color: isDone ? "#6ee7b7" : isCurrent ? "#f1f5f9" : "#3f5068",
                  lineHeight: 1.3,
                  transition: "color 0.3s",
                }}
              >
                {step.label}
              </div>
              {isDone && (
                <CheckCircle2
                  style={{
                    width: 12,
                    height: 12,
                    color: "#34d399",
                    marginTop: 4,
                    marginInline: "auto",
                  }}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Error details */}
      {isFailed && error && (
        <div
          style={{
            marginTop: 16,
            padding: "12px 16px",
            borderRadius: 10,
            background: "rgba(244,63,94,0.07)",
            border: "1px solid rgba(244,63,94,0.25)",
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 700, color: "#f43f5e", marginBottom: 4 }}>
            Pipeline Error Details
          </div>
          <div
            style={{
              fontSize: 12,
              color: "#94a3b8",
              fontFamily: "var(--font-mono)",
              whiteSpace: "pre-wrap",
              lineHeight: 1.5,
            }}
          >
            {error}
          </div>
        </div>
      )}
    </div>
  );
}
