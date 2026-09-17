import { useRef, useEffect, useState } from "react";
import { Play, Pause, RotateCcw, Volume2, VolumeX } from "lucide-react";

export default function WaveformPlayer({ audioUrl, waveformPoints, duration, onSeek, audioInfo }) {
  const audioRef = useRef(null);
  const canvasRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) audioRef.current.pause();
    else audioRef.current.play();
    setIsPlaying(!isPlaying);
  };

  const handleReset = () => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = 0;
    setCurrentTime(0);
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
      if (onSeek) onSeek(audioRef.current.currentTime);
    }
  };

  const handleEnded = () => setIsPlaying(false);

  const handleCanvasClick = (e) => {
    if (!canvasRef.current || !audioRef.current || !duration) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const progress = Math.max(0, Math.min(1, clickX / rect.width));
    const newTime = progress * duration;
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
    if (onSeek) onSeek(newTime);
  };

  const handleVolumeChange = (e) => {
    const v = parseFloat(e.target.value);
    setVolume(v);
    if (audioRef.current) audioRef.current.volume = v;
    setIsMuted(v === 0);
  };

  const toggleMute = () => {
    if (!audioRef.current) return;
    const next = !isMuted;
    setIsMuted(next);
    audioRef.current.volume = next ? 0 : volume;
  };

  // Render waveform
  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const W = canvas.width;
    const H = canvas.height;

    ctx.clearRect(0, 0, W, H);

    const points =
      waveformPoints && waveformPoints.length > 0
        ? waveformPoints
        : Array.from({ length: 150 }, () => Math.random() * 0.5 + 0.1);

    const barWidth = W / points.length;
    const playProgress = duration > 0 ? currentTime / duration : 0;

    points.forEach((val, i) => {
      const barH = Math.max(3, val * H * 0.88);
      const x = i * barWidth;
      const y = (H - barH) / 2;
      const isPast = i / points.length <= playProgress;

      if (isPast) {
        const g = ctx.createLinearGradient(0, y, 0, y + barH);
        g.addColorStop(0, "#818cf8");
        g.addColorStop(0.5, "#a78bfa");
        g.addColorStop(1, "#c084fc");
        ctx.fillStyle = g;
      } else {
        ctx.fillStyle = "rgba(255,255,255,0.1)";
      }

      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(x + 0.5, y, Math.max(2, barWidth - 1.5), barH, 2);
      } else {
        ctx.rect(x + 0.5, y, Math.max(2, barWidth - 1.5), barH);
      }
      ctx.fill();
    });

    // Playhead
    const phX = playProgress * W;
    ctx.fillStyle = "rgba(244,63,94,0.9)";
    ctx.fillRect(phX - 1, 0, 2, H);

    // Playhead glow
    const phGlow = ctx.createRadialGradient(phX, H / 2, 0, phX, H / 2, 20);
    phGlow.addColorStop(0, "rgba(244,63,94,0.25)");
    phGlow.addColorStop(1, "transparent");
    ctx.fillStyle = phGlow;
    ctx.fillRect(phX - 20, 0, 40, H);
  }, [waveformPoints, currentTime, duration]);

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="glass-panel p-5 mb-6">
      {audioUrl && (
        <audio
          ref={audioRef}
          src={audioUrl}
          onTimeUpdate={handleTimeUpdate}
          onEnded={handleEnded}
          style={{ display: "none" }}
        />
      )}

      {/* Top: File info strip */}
      {audioInfo && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginBottom: 14,
            padding: "8px 12px",
            borderRadius: 8,
            background: "rgba(0,0,0,0.2)",
            border: "1px solid rgba(255,255,255,0.05)",
            flexWrap: "wrap",
          }}
        >
          <Volume2 style={{ width: 14, height: 14, color: "#818cf8", flexShrink: 0 }} />
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "#cbd5e1",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              flex: 1,
              minWidth: 0,
            }}
          >
            {audioInfo.filename || "Recording"}
          </span>
          {[
            { label: "Duration", val: `${audioInfo.duration?.toFixed(1)}s` },
            { label: "Sample Rate", val: `${audioInfo.sample_rate || 16000} Hz` },
            { label: "Format", val: (audioInfo.format || "wav").toUpperCase() },
          ].map(({ label, val }) => (
            <div
              key={label}
              style={{ display: "flex", alignItems: "center", gap: 5 }}
            >
              <span style={{ fontSize: 10, color: "#475569", letterSpacing: "0.05em" }}>
                {label.toUpperCase()}
              </span>
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  color: "#94a3b8",
                  fontWeight: 600,
                }}
              >
                {val}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Controls row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 12,
          flexWrap: "wrap",
        }}
      >
        {/* Play/Pause */}
        <button
          onClick={togglePlay}
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            background: isPlaying
              ? "rgba(99,102,241,0.15)"
              : "linear-gradient(135deg, #6366f1, #8b5cf6)",
            border: "1px solid rgba(99,102,241,0.4)",
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            flexShrink: 0,
            boxShadow: "0 4px 16px rgba(99,102,241,0.35)",
            transition: "all 0.2s ease",
          }}
        >
          {isPlaying ? (
            <Pause style={{ width: 18, height: 18 }} />
          ) : (
            <Play style={{ width: 18, height: 18, marginLeft: 2 }} />
          )}
        </button>

        {/* Reset */}
        <button onClick={handleReset} className="btn-icon" title="Restart">
          <RotateCcw style={{ width: 15, height: 15 }} />
        </button>

        {/* Time display */}
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 14,
            color: "#94a3b8",
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          <span style={{ fontWeight: 700, color: "#f1f5f9", fontSize: 16 }}>
            {formatTime(currentTime)}
          </span>
          <span style={{ color: "#3f5068" }}>/</span>
          <span>{formatTime(duration || 0)}</span>
        </div>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Volume */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button onClick={toggleMute} className="btn-icon" title="Toggle mute">
            {isMuted ? (
              <VolumeX style={{ width: 14, height: 14 }} />
            ) : (
              <Volume2 style={{ width: 14, height: 14 }} />
            )}
          </button>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={isMuted ? 0 : volume}
            onChange={handleVolumeChange}
            style={{
              width: 80,
              accentColor: "#6366f1",
              cursor: "pointer",
            }}
          />
        </div>

        <span
          style={{
            fontSize: 11,
            color: "#3f5068",
            whiteSpace: "nowrap",
          }}
        >
          Click waveform to seek
        </span>
      </div>

      {/* Waveform canvas */}
      <div
        onClick={handleCanvasClick}
        style={{
          position: "relative",
          width: "100%",
          height: 100,
          background: "rgba(0,0,0,0.3)",
          borderRadius: 12,
          border: "1px solid rgba(255,255,255,0.07)",
          overflow: "hidden",
          cursor: "pointer",
        }}
      >
        <canvas
          ref={canvasRef}
          width={1000}
          height={100}
          style={{ width: "100%", height: "100%", display: "block" }}
        />
      </div>
    </div>
  );
}
