import { useState, useRef, useEffect } from "react";
import {
  Mic,
  UploadCloud,
  Square,
  Volume2,
  Music,
  Shield,
  FileAudio,
  Clock,
} from "lucide-react";

const MAX_SECONDS = 300; // 5 minutes

function formatTime(secs) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function formatBytes(bytes) {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export default function AudioInputSection({
  onAudioSelected,
  isProcessing,
  currentAudioFile,
}) {
  const [activeTab, setActiveTab] = useState("upload");
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [micAudioUrl, setMicAudioUrl] = useState(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const streamRef = useRef(null);
  const timerRef = useRef(null);
  const canvasRef = useRef(null);
  const animationFrameRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);

  const cleanupRecording = () => {
    clearInterval(timerRef.current);
    cancelAnimationFrame(animationFrameRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    analyserRef.current = null;
  };

  useEffect(() => {
    return () => {
      cleanupRecording();
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        try { mediaRecorderRef.current.stop(); } catch (_e) { /* already stopped */ }
      }
    };
  }, []);

  // ── File drop/pick ──────────────────────────────────────────────────────
  const handleFileInput = (e) => {
    const file = e.target.files?.[0];
    if (file) onAudioSelected(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    if (isProcessing) return;
    const file = e.dataTransfer.files?.[0];
    if (file) onAudioSelected(file);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    if (!isProcessing) setIsDragOver(true);
  };

  const handleDragLeave = () => setIsDragOver(false);

  // ── Live recording ──────────────────────────────────────────────────────
  const startRecording = async () => {
    try {
      audioChunksRef.current = [];
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      audioContextRef.current = audioCtx;
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;

      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);
      drawLiveVisualizer();

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: "audio/wav" });
        const url = URL.createObjectURL(blob);
        setMicAudioUrl(url);
        const file = new File([blob], `mic_recording_${Date.now()}.wav`, { type: "audio/wav" });
        onAudioSelected(file);
      };

      mediaRecorder.start(100);
      setIsRecording(true);
      setRecordingSeconds(0);
      setMicAudioUrl(null);

      timerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => {
          if (prev + 1 >= MAX_SECONDS) {
            stopRecording();
            return MAX_SECONDS;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (err) {
      console.error("Microphone access error:", err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    cleanupRecording();
  };

  const drawLiveVisualizer = () => {
    if (!canvasRef.current || !analyserRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const analyser = analyserRef.current;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const render = () => {
      animationFrameRef.current = requestAnimationFrame(render);
      analyser.getByteFrequencyData(dataArray);
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const barWidth = (canvas.width / bufferLength) * 2.5;
      let x = 0;
      for (let i = 0; i < bufferLength; i++) {
        const barHeight = (dataArray[i] / 255) * canvas.height;
        const gradient = ctx.createLinearGradient(0, canvas.height, 0, 0);
        gradient.addColorStop(0, "#6366f1");
        gradient.addColorStop(0.6, "#8b5cf6");
        gradient.addColorStop(1, "#d946ef");
        ctx.fillStyle = gradient;
        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(x, canvas.height - barHeight, Math.max(2, barWidth - 1), barHeight, 2);
        } else {
          ctx.rect(x, canvas.height - barHeight, Math.max(2, barWidth - 1), barHeight);
        }
        ctx.fill();
        x += barWidth + 1;
      }
    };
    render();
  };

  const recordingPct = (recordingSeconds / MAX_SECONDS) * 100;
  const isNearLimit = recordingSeconds > 270;

  return (
    <div className="glass-panel p-6 mb-6">
      {/* Header row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 20,
          paddingBottom: 16,
          borderBottom: "1px solid rgba(255,255,255,0.07)",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div className="tab-nav">
          <button
            onClick={() => {
              if (isRecording) stopRecording();
              setActiveTab("upload");
            }}
            className={`tab-btn ${activeTab === "upload" ? "active" : ""}`}
          >
            <UploadCloud style={{ width: 15, height: 15 }} />
            Upload Audio
          </button>
          <button
            onClick={() => setActiveTab("record")}
            className={`tab-btn ${activeTab === "record" ? "active" : ""}`}
          >
            <Mic style={{ width: 15, height: 15 }} />
            Live Microphone
          </button>
        </div>

        {/* Current file badge */}
        {currentAudioFile && (
          <div className="file-info-badge">
            <FileAudio style={{ width: 14, height: 14, color: "#818cf8", flexShrink: 0 }} />
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                color: "#a5b4fc",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                maxWidth: 220,
              }}
            >
              {currentAudioFile.name}
            </span>
            {currentAudioFile.size && (
              <span
                style={{
                  fontSize: 10,
                  color: "#64748b",
                  background: "rgba(0,0,0,0.3)",
                  padding: "1px 7px",
                  borderRadius: 4,
                  flexShrink: 0,
                }}
              >
                {formatBytes(currentAudioFile.size)}
              </span>
            )}
          </div>
        )}
      </div>

      {/* ── TAB 1: UPLOAD ── */}
      {activeTab === "upload" && (
        <div className="animate-fade-in">
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`drop-zone ${isDragOver ? "drag-over" : ""} ${isProcessing ? "disabled" : ""}`}
          >
            <input
              type="file"
              accept="audio/*"
              onChange={handleFileInput}
              disabled={isProcessing}
              style={{
                position: "absolute",
                inset: 0,
                opacity: 0,
                cursor: isProcessing ? "not-allowed" : "pointer",
                width: "100%",
                height: "100%",
              }}
              id="audioFileInput"
            />

            {/* Icon */}
            <div
              style={{
                width: 72,
                height: 72,
                borderRadius: 18,
                background: isDragOver
                  ? "rgba(99,102,241,0.2)"
                  : "rgba(99,102,241,0.08)",
                border: `1.5px solid ${isDragOver ? "rgba(99,102,241,0.5)" : "rgba(99,102,241,0.2)"}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 20,
                transition: "all 0.25s ease",
                boxShadow: isDragOver ? "0 0 30px rgba(99,102,241,0.25)" : "none",
              }}
            >
              <UploadCloud
                style={{
                  width: 34,
                  height: 34,
                  color: isDragOver ? "#818cf8" : "#6366f1",
                  transition: "color 0.2s",
                }}
              />
            </div>

            <h3
              style={{
                fontSize: 17,
                fontWeight: 700,
                color: "#f1f5f9",
                marginBottom: 8,
                textAlign: "center",
              }}
            >
              {isDragOver ? "Release to upload" : "Drag & drop your audio file"}
            </h3>

            <p
              style={{
                fontSize: 12,
                color: "#64748b",
                textAlign: "center",
                maxWidth: 400,
                lineHeight: 1.6,
                marginBottom: 20,
              }}
            >
              Supports WAV · MP3 · OGG · FLAC · M4A · WEBM · AAC
              <br />
              Up to 25 MB / 5 minutes — real-time deep learning processing
            </p>

            <span
              className="btn-primary"
              style={{ pointerEvents: "none", fontSize: 13 }}
            >
              <UploadCloud style={{ width: 15, height: 15 }} />
              Browse Audio File
            </span>

            {/* Format chips */}
            <div
              style={{
                display: "flex",
                gap: 6,
                flexWrap: "wrap",
                justifyContent: "center",
                marginTop: 18,
              }}
            >
              {["WAV", "MP3", "FLAC", "OGG", "M4A", "AAC"].map((fmt) => (
                <span
                  key={fmt}
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    padding: "3px 9px",
                    borderRadius: 5,
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    color: "#64748b",
                    fontFamily: "var(--font-mono)",
                    letterSpacing: "0.05em",
                  }}
                >
                  {fmt}
                </span>
              ))}
            </div>
          </div>

          {/* Quick 1-Click Test Samples */}
          <div
            style={{
              marginTop: 14,
              paddingTop: 14,
              borderTop: "1px solid rgba(255,255,255,0.06)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 10,
              fontSize: 11,
            }}
          >
            <span style={{ color: "#64748b", fontWeight: 600 }}>
              Or test instantly with pre-verified audio scenes:
            </span>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              <button
                type="button"
                onClick={async () => {
                  try {
                    const res = await fetch("/samples/emergency_siren.wav");
                    const blob = await res.blob();
                    const file = new File([blob], "emergency_siren.wav", { type: "audio/wav" });
                    onAudioSelected(file);
                  } catch (e) {
                    console.error(e);
                  }
                }}
                disabled={isProcessing}
                style={{
                  padding: "5px 12px",
                  borderRadius: 6,
                  background: "rgba(244,63,94,0.1)",
                  border: "1px solid rgba(244,63,94,0.3)",
                  color: "#fda4af",
                  fontWeight: 600,
                  fontSize: 11,
                  cursor: isProcessing ? "not-allowed" : "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  transition: "all 0.2s",
                }}
              >
                <Shield style={{ width: 12, height: 12, color: "#f43f5e" }} />
                <span>🚨 Emergency Siren</span>
              </button>

              <button
                type="button"
                onClick={async () => {
                  try {
                    const res = await fetch("/samples/nature_ambient.wav");
                    const blob = await res.blob();
                    const file = new File([blob], "nature_ambient.wav", { type: "audio/wav" });
                    onAudioSelected(file);
                  } catch (e) {
                    console.error(e);
                  }
                }}
                disabled={isProcessing}
                style={{
                  padding: "5px 12px",
                  borderRadius: 6,
                  background: "rgba(16,185,129,0.1)",
                  border: "1px solid rgba(16,185,129,0.3)",
                  color: "#6ee7b7",
                  fontWeight: 600,
                  fontSize: 11,
                  cursor: isProcessing ? "not-allowed" : "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  transition: "all 0.2s",
                }}
              >
                <span>🌲 Nature Ambient</span>
              </button>

              <button
                type="button"
                onClick={async () => {
                  try {
                    const res = await fetch("/samples/acoustic_music.wav");
                    const blob = await res.blob();
                    const file = new File([blob], "acoustic_music.wav", { type: "audio/wav" });
                    onAudioSelected(file);
                  } catch (e) {
                    console.error(e);
                  }
                }}
                disabled={isProcessing}
                style={{
                  padding: "5px 12px",
                  borderRadius: 6,
                  background: "rgba(168,85,247,0.1)",
                  border: "1px solid rgba(168,85,247,0.3)",
                  color: "#d8b4fe",
                  fontWeight: 600,
                  fontSize: 11,
                  cursor: isProcessing ? "not-allowed" : "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  transition: "all 0.2s",
                }}
              >
                <Music style={{ width: 12, height: 12, color: "#a855f7" }} />
                <span>🎵 Acoustic Harmony</span>
              </button>
            </div>
          </div>

          {/* Processing overlay hint */}
          {isProcessing && (
            <div
              style={{
                marginTop: 14,
                padding: "10px 16px",
                borderRadius: 8,
                background: "rgba(99,102,241,0.07)",
                border: "1px solid rgba(99,102,241,0.2)",
                display: "flex",
                alignItems: "center",
                gap: 10,
                fontSize: 12,
                color: "#a5b4fc",
              }}
            >
              <div
                style={{
                  width: 14,
                  height: 14,
                  border: "2px solid rgba(99,102,241,0.4)",
                  borderTop: "2px solid #818cf8",
                  borderRadius: "50%",
                  animation: "spin 0.9s linear infinite",
                  flexShrink: 0,
                }}
              />
              Audio processing in progress — upload will be available after completion.
            </div>
          )}
        </div>
      )}

      {/* ── TAB 2: LIVE MICROPHONE ── */}
      {activeTab === "record" && (
        <div className="animate-fade-in">
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              padding: "32px 24px",
              background: "rgba(0,0,0,0.15)",
              borderRadius: 16,
              border: "1px solid rgba(255,255,255,0.06)",
              gap: 24,
            }}
          >
            {/* Waveform canvas */}
            <div
              style={{
                width: "100%",
                maxWidth: 560,
                height: 100,
                background: "rgba(0,0,0,0.35)",
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,0.07)",
                overflow: "hidden",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {isRecording ? (
                <canvas
                  ref={canvasRef}
                  width={560}
                  height={100}
                  style={{ width: "100%", height: "100%", display: "block" }}
                />
              ) : (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    color: "#3f5068",
                    fontSize: 12,
                  }}
                >
                  <Mic style={{ width: 16, height: 16 }} />
                  Ready to capture — 5:00 max limit
                </div>
              )}
            </div>

            {/* Timer + Progress */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 10,
                width: "100%",
                maxWidth: 320,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                {isRecording && (
                  <div
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: "50%",
                      background: "#f43f5e",
                      animation: "recording-ring 1.8s ease-out infinite",
                    }}
                  />
                )}
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 36,
                    fontWeight: 800,
                    color: isNearLimit ? "#f43f5e" : "#f1f5f9",
                    letterSpacing: "0.05em",
                    lineHeight: 1,
                  }}
                >
                  {formatTime(recordingSeconds)}
                </span>
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 12,
                    color: "#3f5068",
                  }}
                >
                  / 05:00
                </span>
              </div>

              {/* Recording progress bar */}
              <div
                style={{
                  width: "100%",
                  height: 4,
                  background: "rgba(255,255,255,0.06)",
                  borderRadius: 3,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${recordingPct}%`,
                    height: "100%",
                    borderRadius: 3,
                    background: isNearLimit
                      ? "linear-gradient(90deg, #f43f5e, #fb7185)"
                      : "linear-gradient(90deg, #6366f1, #d946ef)",
                    transition: "width 1s linear",
                  }}
                />
              </div>

              {isNearLimit && (
                <span
                  style={{
                    fontSize: 10,
                    color: "#f43f5e",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                  }}
                >
                  Approaching 5-minute limit
                </span>
              )}
            </div>

            {/* Controls */}
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              {!isRecording ? (
                <button
                  onClick={startRecording}
                  disabled={isProcessing}
                  className="btn-danger"
                  style={{ padding: "12px 32px", fontSize: 14 }}
                >
                  <Mic style={{ width: 18, height: 18 }} />
                  Start Recording
                </button>
              ) : (
                <button
                  onClick={stopRecording}
                  className="btn-secondary"
                  style={{
                    padding: "12px 28px",
                    fontSize: 14,
                    borderColor: "rgba(244,63,94,0.4)",
                    color: "#fda4af",
                  }}
                >
                  <Square
                    style={{
                      width: 16,
                      height: 16,
                      color: "#f43f5e",
                      fill: "#f43f5e",
                    }}
                  />
                  Stop & Analyze
                </button>
              )}
            </div>

            {/* Tip */}
            <div
              style={{
                fontSize: 11,
                color: "#3f5068",
                textAlign: "center",
                lineHeight: 1.5,
              }}
            >
              <Clock style={{ width: 12, height: 12, display: "inline", marginRight: 4 }} />
              Recording auto-stops at 5:00 · Audio saved as WAV for processing
            </div>

            {/* Recorded preview */}
            {micAudioUrl && !isRecording && (
              <div
                style={{
                  width: "100%",
                  maxWidth: 420,
                  padding: "12px 14px",
                  borderRadius: 10,
                  background: "rgba(0,0,0,0.25)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <Volume2
                  style={{ width: 16, height: 16, color: "#6366f1", flexShrink: 0 }}
                />
                <audio src={micAudioUrl} controls style={{ flex: 1 }} />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
