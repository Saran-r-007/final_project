import { useState } from "react";
import { Layers, MessageSquare, Volume2, Music, ShieldAlert, Clock, Tag, Percent } from "lucide-react";

const TRACK_CONFIG = {
  Speech: { color: "rgba(99,102,241,0.65)", border: "rgba(99,102,241,0.9)", text: "#c7d2fe", icon: MessageSquare },
  "Sound Events": { color: "rgba(6,182,212,0.55)", border: "rgba(6,182,212,0.85)", text: "#a5f3fc", icon: Volume2 },
  Music: { color: "rgba(168,85,247,0.6)", border: "rgba(168,85,247,0.9)", text: "#e9d5ff", icon: Music },
  "Emergency / Alerts": { color: "rgba(244,63,94,0.65)", border: "rgba(244,63,94,0.95)", text: "#fecdd3", icon: ShieldAlert },
};

function formatTime(secs) {
  if (secs === undefined || secs === null) return "—";
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return m > 0
    ? `${m}:${s.toFixed(1).padStart(4, "0")}`
    : `${secs.toFixed(1)}s`;
}

function pctToWidth(val) {
  return `${Math.min(100, Math.max(0, val))}%`;
}

export default function MultiTrackTimeline({ timeline, duration, currentTime, onSeek }) {
  const [hoveredEvent, setHoveredEvent] = useState(null);
  const [showTable, setShowTable] = useState(false);

  if (!timeline || timeline.length === 0) return null;

  const totalDuration = duration || Math.max(...timeline.map((t) => t.end || 0), 10);

  // Group events by track
  const tracks = {
    Speech: timeline.filter((t) => t.track === "Speech"),
    "Sound Events": timeline.filter(
      (t) => t.track !== "Speech" && t.track !== "Music" && t.track !== "EMERGENCY"
    ),
    Music: timeline.filter((t) => t.track === "Music"),
    "Emergency / Alerts": timeline.filter((t) => t.track === "EMERGENCY"),
  };

  const playheadPct = (currentTime / totalDuration) * 100;

  // Time ticks
  const tickCount = Math.min(10, Math.floor(totalDuration / 5) + 1);
  const tickInterval = totalDuration / tickCount;

  // For table: all events sorted
  const allEvents = [...timeline].sort((a, b) => (a.start || 0) - (b.start || 0));

  const getConfidenceColor = (conf) => {
    if (!conf) return "#64748b";
    if (conf >= 0.75) return "#34d399";
    if (conf >= 0.5) return "#fbbf24";
    return "#f87171";
  };

  return (
    <div className="glass-panel p-6 mb-6 animate-fade-in">
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 16,
          paddingBottom: 14,
          borderBottom: "1px solid rgba(255,255,255,0.07)",
          flexWrap: "wrap",
          gap: 10,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: "rgba(99,102,241,0.12)",
              border: "1px solid rgba(99,102,241,0.25)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Layers style={{ width: 16, height: 16, color: "#818cf8" }} />
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#f1f5f9" }}>
              Multi-Track Temporal Timeline
            </div>
            <div style={{ fontSize: 11, color: "#64748b", marginTop: 1 }}>
              {timeline.length} events · {totalDuration.toFixed(1)}s total duration
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {/* Track legend */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {Object.entries(TRACK_CONFIG).map(([name, cfg]) => {
              const count = tracks[name]?.length || 0;
              if (count === 0) return null;
              const Icon = cfg.icon;
              return (
                <div
                  key={name}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                    padding: "3px 9px",
                    borderRadius: 5,
                    background: cfg.color.replace("0.6", "0.1").replace("0.65", "0.1"),
                    border: `1px solid ${cfg.border.replace("0.9", "0.2").replace("0.95", "0.2")}`,
                    fontSize: 10,
                    fontWeight: 600,
                    color: cfg.text,
                    whiteSpace: "nowrap",
                  }}
                >
                  <Icon style={{ width: 11, height: 11 }} />
                  {name} ({count})
                </div>
              );
            })}
          </div>

          {/* Toggle table */}
          <button
            onClick={() => setShowTable((s) => !s)}
            style={{
              padding: "5px 12px",
              borderRadius: 6,
              background: showTable ? "rgba(99,102,241,0.15)" : "rgba(255,255,255,0.04)",
              border: `1px solid ${showTable ? "rgba(99,102,241,0.4)" : "rgba(255,255,255,0.08)"}`,
              color: showTable ? "#818cf8" : "#64748b",
              fontSize: 11,
              fontWeight: 600,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            {showTable ? "Hide Table" : "Show Table"}
          </button>
        </div>
      </div>

      {/* Timeline container */}
      <div
        style={{
          background: "rgba(0,0,0,0.2)",
          borderRadius: 12,
          border: "1px solid rgba(255,255,255,0.06)",
          overflow: "hidden",
          marginBottom: showTable ? 16 : 0,
        }}
      >
        {/* Time ruler */}
        <div
          style={{
            position: "relative",
            height: 24,
            borderBottom: "1px solid rgba(255,255,255,0.06)",
            marginLeft: 120,
          }}
        >
          {Array.from({ length: tickCount + 1 }).map((_, i) => {
            const pct = (i / tickCount) * 100;
            const timeSec = i * tickInterval;
            return (
              <div
                key={i}
                style={{
                  position: "absolute",
                  left: pctToWidth(pct),
                  top: 0,
                  bottom: 0,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-start",
                }}
              >
                <div
                  style={{
                    width: 1,
                    height: "100%",
                    background: "rgba(255,255,255,0.06)",
                  }}
                />
                <span
                  style={{
                    position: "absolute",
                    bottom: 2,
                    left: 3,
                    fontFamily: "var(--font-mono)",
                    fontSize: 9,
                    color: "#3f5068",
                    whiteSpace: "nowrap",
                  }}
                >
                  {timeSec.toFixed(0)}s
                </span>
              </div>
            );
          })}
        </div>

        {/* Track rows */}
        <div style={{ position: "relative", padding: "8px 0" }}>
          {/* Playhead */}
          <div
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              left: `calc(120px + (100% - 132px) * ${playheadPct / 100})`,
              width: 2,
              background: "#f43f5e",
              boxShadow: "0 0 8px rgba(244,63,94,0.7)",
              zIndex: 20,
              pointerEvents: "none",
              transition: "left 0.1s linear",
            }}
          />

          {Object.entries(tracks).map(([trackName, events]) => {
            if (events.length === 0) return null;
            const cfg = TRACK_CONFIG[trackName] || TRACK_CONFIG["Sound Events"];
            const Icon = cfg.icon;

            return (
              <div
                key={trackName}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 0,
                  marginBottom: 6,
                  minHeight: 36,
                }}
              >
                {/* Track label */}
                <div
                  style={{
                    width: 120,
                    flexShrink: 0,
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "0 12px",
                    fontSize: 11,
                    fontWeight: 700,
                    color: "#64748b",
                  }}
                >
                  <Icon style={{ width: 12, height: 12, flexShrink: 0 }} />
                  <span
                    style={{
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {trackName}
                  </span>
                </div>

                {/* Events track */}
                <div
                  style={{
                    flex: 1,
                    position: "relative",
                    height: 32,
                    background: "rgba(0,0,0,0.15)",
                    borderRadius: 6,
                    overflow: "visible",
                    marginRight: 12,
                  }}
                >
                  {events.map((evt, idx) => {
                    const startPct = Math.max(0, (evt.start / totalDuration) * 100);
                    const endPct = Math.min(100, ((evt.end || evt.start + 1) / totalDuration) * 100);
                    const widthPct = Math.max(3, endPct - startPct);

                    return (
                      <div
                        key={idx}
                        onClick={() => onSeek && onSeek(evt.start)}
                        onMouseEnter={() => setHoveredEvent({ ...evt, _idx: idx + trackName })}
                        onMouseLeave={() => setHoveredEvent(null)}
                        style={{
                          position: "absolute",
                          top: 3,
                          bottom: 3,
                          left: `${startPct}%`,
                          width: `${widthPct}%`,
                          background: cfg.color,
                          border: `1px solid ${cfg.border}`,
                          borderRadius: 4,
                          display: "flex",
                          alignItems: "center",
                          overflow: "hidden",
                          cursor: "pointer",
                          zIndex:
                            hoveredEvent?._idx === idx + trackName ? 30 : 5,
                          transition: "filter 0.15s, transform 0.15s",
                          filter:
                            hoveredEvent?._idx === idx + trackName
                              ? "brightness(1.4)"
                              : "brightness(1)",
                          transform:
                            hoveredEvent?._idx === idx + trackName
                              ? "scaleY(1.15)"
                              : "scaleY(1)",
                        }}
                        title={`${evt.label} | ${formatTime(evt.start)} – ${formatTime(evt.end)} | Conf: ${evt.confidence ? (evt.confidence * 100).toFixed(0) + "%" : "N/A"}`}
                      >
                        <span
                          style={{
                            fontSize: 9,
                            fontWeight: 700,
                            color: cfg.text,
                            padding: "0 6px",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {evt.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Event Table */}
      {showTable && (
        <div
          style={{
            background: "rgba(0,0,0,0.18)",
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.06)",
            overflow: "hidden",
          }}
        >
          {/* Table header */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "130px 1fr 130px 110px",
              gap: 8,
              padding: "10px 14px",
              borderBottom: "1px solid rgba(255,255,255,0.06)",
              fontSize: 10,
              fontWeight: 700,
              color: "#3f5068",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              fontFamily: "var(--font-mono)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <Clock style={{ width: 10, height: 10 }} /> Timestamp
            </div>
            <div>Event Label</div>
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <Tag style={{ width: 10, height: 10 }} /> Category
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <Percent style={{ width: 10, height: 10 }} /> Confidence
            </div>
          </div>

          {/* Rows */}
          <div
            style={{
              maxHeight: 320,
              overflowY: "auto",
            }}
          >
            {allEvents.map((evt, i) => {
              const cfg = TRACK_CONFIG[evt.track] || TRACK_CONFIG["Sound Events"];
              const conf = evt.confidence;
              const confColor = getConfidenceColor(conf);

              return (
                <div
                  key={i}
                  onClick={() => onSeek && onSeek(evt.start)}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "130px 1fr 130px 110px",
                    gap: 8,
                    padding: "9px 14px",
                    fontSize: 12,
                    borderBottom: "1px solid rgba(255,255,255,0.03)",
                    cursor: "pointer",
                    transition: "background 0.15s",
                    alignItems: "center",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background = "rgba(255,255,255,0.04)")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background = "transparent")
                  }
                >
                  {/* Timestamp */}
                  <div
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 11,
                      color: "#818cf8",
                    }}
                  >
                    {formatTime(evt.start)} – {formatTime(evt.end)}
                  </div>

                  {/* Label */}
                  <div
                    style={{
                      fontWeight: 600,
                      color: "#e2e8f0",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {evt.label}
                  </div>

                  {/* Track/Category */}
                  <div>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        padding: "2px 8px",
                        borderRadius: 4,
                        background: cfg.color.replace(/[\d.]+\)$/, "0.12)"),
                        border: `1px solid ${cfg.border.replace(/[\d.]+\)$/, "0.25)")}`,
                        color: cfg.text,
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {evt.track}
                    </span>
                  </div>

                  {/* Confidence */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <div
                      style={{
                        flex: 1,
                        height: 4,
                        background: "rgba(255,255,255,0.06)",
                        borderRadius: 3,
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          width: conf ? `${conf * 100}%` : "0%",
                          height: "100%",
                          background: confColor,
                          borderRadius: 3,
                          transition: "width 0.5s ease",
                        }}
                      />
                    </div>
                    <span
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: 11,
                        fontWeight: 700,
                        color: confColor,
                        minWidth: 36,
                        textAlign: "right",
                      }}
                    >
                      {conf ? `${(conf * 100).toFixed(0)}%` : "—"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
