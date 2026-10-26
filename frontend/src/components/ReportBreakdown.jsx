import { useState } from "react";
import { getMediaBase } from "../services/api";
import {
  FileAudio, MessageSquare, Users, Trees, Music2,
  Sliders, Sparkles, ShieldCheck, BellRing, Download,
  Copy, Check, Clock, Percent, Tag, BarChart2,
  Volume2, UserCheck, Info, Layers
} from "lucide-react";

// ── helpers ─────────────────────────────────────────────────────────────────
function fmt(secs) {
  if (secs === undefined || secs === null) return "—";
  const m = Math.floor(secs / 60);
  const s = secs.toFixed(1);
  return m > 0 ? `${m}:${String(secs % 60).padStart(4, "0")}s` : `${s}s`;
}

function ConfBar({ value, max = 1 }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const color = pct >= 75 ? "#34d399" : pct >= 50 ? "#fbbf24" : "#f87171";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1 }}>
      <div
        style={{
          flex: 1,
          height: 5,
          background: "rgba(255,255,255,0.07)",
          borderRadius: 4,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            background: color,
            borderRadius: 4,
            transition: "width 0.7s ease",
          }}
        />
      </div>
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          fontWeight: 700,
          color,
          minWidth: 40,
          textAlign: "right",
        }}
      >
        {pct.toFixed(1)}%
      </span>
    </div>
  );
}

function SectionCard({ title, icon: Icon, iconColor = "#818cf8", children, subtitle }) {
  return (
    <div
      style={{
        padding: "16px 18px",
        borderRadius: 12,
        background: "rgba(0,0,0,0.22)",
        border: "1px solid rgba(255,255,255,0.07)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 14,
          paddingBottom: 12,
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 7,
            background: `${iconColor}18`,
            border: `1px solid ${iconColor}30`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Icon style={{ width: 14, height: 14, color: iconColor }} />
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#e2e8f0" }}>{title}</div>
          {subtitle && (
            <div style={{ fontSize: 10, color: "#64748b", marginTop: 1 }}>{subtitle}</div>
          )}
        </div>
      </div>
      {children}
    </div>
  );
}

function EmptyState({ message }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "16px 12px",
        color: "#3f5068",
        fontStyle: "italic",
        fontSize: 12,
      }}
    >
      <Info style={{ width: 14, height: 14, flexShrink: 0 }} />
      {message}
    </div>
  );
}

// ── TABS ──────────────────────────────────────────────────────────────────────
const TABS = [
  { id: "overview",   label: "Overview",    icon: FileAudio   },
  { id: "speech",     label: "Speech",      icon: MessageSquare },
  { id: "sounds",     label: "Sounds",      icon: Trees       },
  { id: "music",      label: "Music",       icon: Music2      },
  { id: "stems",      label: "Stems",       icon: Sliders     },
  { id: "context",    label: "Context",     icon: Sparkles    },
  { id: "emergency",  label: "Emergency",   icon: ShieldCheck },
  { id: "timeline",   label: "Timeline",    icon: Layers      },
  { id: "summary",    label: "Summary",     icon: Download    },
];

// ── MAIN COMPONENT ────────────────────────────────────────────────────────────
export default function ReportBreakdown({ report, analysisId, onExport }) {
  const [activeTab, setActiveTab] = useState("overview");
  const [copied, setCopied] = useState(false);

  if (!report) return null;

  const {
    audio_info = {},
    speech_detection = {},
    speech_to_text = "",
    speaker_analysis = {},
    human_sounds = {},
    environmental_sounds = {},
    music_analysis = {},
    source_separation = {},
    context_understanding = "",
    emergency_analysis = {},
    risk_score = {},
    explainable_ai = {},
    recommended_response = {},
    notification_status = {},
    final_ai_summary = "",
    processing_time = 0,
    individual_events = [],
    timeline = [],
    timestamps = [],
  } = report;

  const copyTranscript = () => {
    if (speech_to_text) {
      navigator.clipboard.writeText(speech_to_text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const allSounds = [
    ...(human_sounds.sounds || []),
    ...(environmental_sounds.sounds || []),
  ];

  // Sort timeline table
  const sortedTimeline = [...(timestamps.length ? timestamps : timeline)].sort(
    (a, b) => (a.start || 0) - (b.start || 0)
  );

  const getConfColor = (c) => {
    if (!c) return "#64748b";
    if (c >= 0.75) return "#34d399";
    if (c >= 0.5) return "#fbbf24";
    return "#f87171";
  };

  return (
    <div className="glass-panel p-6 mb-6 animate-slide-up">
      {/* Tab navigation */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 4,
          marginBottom: 20,
          paddingBottom: 16,
          borderBottom: "1px solid rgba(255,255,255,0.07)",
        }}
      >
        {TABS.map((t) => {
          const Icon = t.icon;
          const isActive = activeTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              style={{
                padding: "7px 14px",
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 600,
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                cursor: "pointer",
                border: `1px solid ${isActive ? "rgba(99,102,241,0.4)" : "rgba(255,255,255,0.06)"}`,
                background: isActive
                  ? "rgba(99,102,241,0.15)"
                  : "rgba(255,255,255,0.025)",
                color: isActive ? "#a5b4fc" : "#64748b",
                transition: "all 0.18s ease",
                fontFamily: "var(--font-sans)",
                whiteSpace: "nowrap",
              }}
            >
              <Icon style={{ width: 14, height: 14 }} />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* ── TAB: OVERVIEW ── */}
      {activeTab === "overview" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Audio info cards */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
              gap: 10,
            }}
          >
            {[
              { label: "Duration", val: `${audio_info.duration?.toFixed(1) || "—"}s`, color: "#818cf8" },
              { label: "Sample Rate", val: `${(audio_info.sample_rate || 16000) / 1000}kHz`, color: "#06b6d4" },
              { label: "Format", val: (audio_info.format || "wav").toUpperCase(), color: "#a855f7" },
              { label: "File Size", val: audio_info.file_size_bytes ? `${(audio_info.file_size_bytes / 1024 / 1024).toFixed(2)} MB` : "—", color: "#f59e0b" },
              { label: "Risk Score", val: `${risk_score.score || 0}/100`, color: "#f43f5e" },
              { label: "Proc. Time", val: `${processing_time}s`, color: "#10b981" },
            ].map(({ label, val, color }) => (
              <div key={label} className="stat-card">
                <div className="stat-label">{label}</div>
                <div className="stat-value" style={{ color, fontSize: 18 }}>{val}</div>
              </div>
            ))}
          </div>

          {/* Acoustic features row */}
          {(audio_info.bpm || audio_info.rhythm_strength || audio_info.harmonic_ratio) && (
            <SectionCard title="Acoustic Fingerprint" icon={BarChart2} iconColor="#06b6d4" subtitle="Extracted by Librosa DSP">
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px,1fr))", gap: 10 }}>
                {[
                  { label: "BPM", val: audio_info.bpm || "—", color: "#818cf8" },
                  { label: "Rhythm", val: audio_info.rhythm_strength || "—", color: "#a855f7" },
                  { label: "Harmonic Ratio", val: audio_info.harmonic_ratio || "—", color: "#34d399" },
                  { label: "Brightness", val: audio_info.spectral_brightness || "—", color: "#fbbf24" },
                ].map(({ label, val, color }) => (
                  <div key={label} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    <span style={{ fontSize: 9, fontFamily: "var(--font-mono)", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</span>
                    <span style={{ fontSize: 15, fontWeight: 800, fontFamily: "var(--font-mono)", color }}>{val}</span>
                  </div>
                ))}
              </div>

              {audio_info.frequency_distribution && (
                <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 8 }}>
                  {[
                    { label: "Bass (20–250 Hz)", pct: audio_info.frequency_distribution.bass_percent, color: "#6366f1" },
                    { label: "Mid (250–4k Hz)", pct: audio_info.frequency_distribution.mid_percent, color: "#a855f7" },
                    { label: "Treble (4k+ Hz)", pct: audio_info.frequency_distribution.treble_percent, color: "#ec4899" },
                  ].map(({ label, pct, color }) => (
                    <div key={label}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#94a3b8", marginBottom: 4 }}>
                        <span>{label}</span>
                        <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, color }}>{pct}%</span>
                      </div>
                      <div style={{ height: 6, background: "rgba(255,255,255,0.06)", borderRadius: 4, overflow: "hidden" }}>
                        <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 4, transition: "width 0.7s ease" }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>
          )}
        </div>
      )}

      {/* ── TAB: SPEECH ── */}
      {activeTab === "speech" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <SectionCard
            title="Full Transcript"
            icon={MessageSquare}
            iconColor="#818cf8"
            subtitle={speech_detection.language ? `Language: ${speech_detection.language.toUpperCase()} · Confidence: ${((speech_detection.confidence || 0) * 100).toFixed(0)}%` : undefined}
          >
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
              {speech_to_text && (
                <button onClick={copyTranscript} className="btn-secondary" style={{ fontSize: 11, padding: "6px 12px" }}>
                  {copied ? <Check style={{ width: 13, height: 13, color: "#34d399" }} /> : <Copy style={{ width: 13, height: 13 }} />}
                  {copied ? "Copied!" : "Copy Transcript"}
                </button>
              )}
            </div>
            <div
              style={{
                padding: "14px 16px",
                borderRadius: 10,
                background: "rgba(0,0,0,0.25)",
                border: "1px solid rgba(255,255,255,0.06)",
                fontSize: 13,
                color: "#e2e8f0",
                lineHeight: 1.75,
                minHeight: 80,
                whiteSpace: "pre-wrap",
              }}
            >
              {speech_to_text || (
                <span style={{ color: "#3f5068", fontStyle: "italic" }}>
                  No spoken words or dialogue detected in this audio stream.
                </span>
              )}
            </div>
          </SectionCard>

          <SectionCard title="Speaker Diarization" icon={Users} iconColor="#a855f7"
            subtitle={`${speaker_analysis.num_speakers || 0} speaker(s) identified · ${speaker_analysis.confidence || "Uncertain"}`}
          >
            {speaker_analysis.speakers && speaker_analysis.speakers.length > 0 ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px,1fr))", gap: 10, marginBottom: 16 }}>
                {speaker_analysis.speakers.map((spk, idx) => (
                  <div key={idx}
                    style={{
                      padding: "12px 14px",
                      borderRadius: 10,
                      background: "rgba(168,85,247,0.07)",
                      border: "1px solid rgba(168,85,247,0.2)",
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                    }}
                  >
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 10,
                        background: "rgba(168,85,247,0.15)",
                        border: "1px solid rgba(168,85,247,0.35)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: 800,
                        fontSize: 13,
                        color: "#d8b4fe",
                        fontFamily: "var(--font-mono)",
                        flexShrink: 0,
                      }}
                    >
                      S{idx + 1}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 12, color: "#f1f5f9" }}>{spk.label || `Speaker ${idx + 1}`}</div>
                      <div style={{ fontSize: 10, color: "#64748b", marginTop: 2, fontFamily: "var(--font-mono)" }}>
                        {spk.total_duration ? `${spk.total_duration}s` : "—"} · {spk.segment_count || 0} seg(s)
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : <EmptyState message="No distinct speakers identified." />}

            {speech_detection.segments && speech_detection.segments.length > 0 && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10, fontFamily: "var(--font-mono)" }}>
                  Timed Speech Segments
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 280, overflowY: "auto" }}>
                  {speech_detection.segments.map((seg, i) => (
                    <div key={i} className="segment-item">
                      <span className="segment-timestamp">
                        {seg.start?.toFixed(1)}s – {seg.end?.toFixed(1)}s
                      </span>
                      <span style={{ fontWeight: 700, fontSize: 11, color: "#d8b4fe", flexShrink: 0, whiteSpace: "nowrap" }}>
                        [{seg.speaker || "Speaker 1"}]:
                      </span>
                      <span style={{ fontSize: 12, color: "#cbd5e1", lineHeight: 1.4 }}>{seg.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </SectionCard>
        </div>
      )}

      {/* ── TAB: SOUNDS ── */}
      {activeTab === "sounds" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          {/* Human Sounds */}
          <SectionCard title="Human Sound Events" icon={UserCheck} iconColor="#34d399"
            subtitle="Laughs, cries, coughs, breaths, footsteps"
          >
            {human_sounds.sounds && human_sounds.sounds.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {human_sounds.sounds.map((snd, idx) => (
                  <div key={idx} className="result-item">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 6 }}>
                      <span style={{ fontWeight: 700, fontSize: 12, color: "#f1f5f9" }}>{snd.label}</span>
                      {snd.start !== undefined && (
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "#818cf8", background: "rgba(99,102,241,0.1)", padding: "1px 7px", borderRadius: 4, border: "1px solid rgba(99,102,241,0.2)", flexShrink: 0 }}>
                          {snd.start?.toFixed(1)}s – {snd.end?.toFixed(1)}s
                        </span>
                      )}
                    </div>
                    <ConfBar value={snd.confidence || 0} />
                  </div>
                ))}
              </div>
            ) : <EmptyState message="No non-speech human vocalizations detected." />}
          </SectionCard>

          {/* Environmental Sounds */}
          <SectionCard title="Environmental Sounds" icon={Trees} iconColor="#22d3ee"
            subtitle="Vehicles, sirens, rain, birds, wind, machinery"
          >
            {environmental_sounds.sounds && environmental_sounds.sounds.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {environmental_sounds.sounds.map((snd, idx) => (
                  <div key={idx} className="result-item">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 6 }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 12, color: "#f1f5f9" }}>{snd.label}</div>
                        {snd.category && (
                          <div style={{ fontSize: 10, color: "#64748b", marginTop: 2 }}>{snd.category}</div>
                        )}
                      </div>
                    </div>
                    <ConfBar value={snd.confidence || 0} />
                  </div>
                ))}
              </div>
            ) : <EmptyState message="No prominent environmental sound events detected." />}
          </SectionCard>
        </div>
      )}

      {/* ── TAB: MUSIC ── */}
      {activeTab === "music" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10 }}>
            {[
              { label: "BPM", val: music_analysis.bpm || audio_info.bpm || "—", color: "#818cf8" },
              { label: "Estimated Key", val: `${music_analysis.estimated_key || "—"} ${music_analysis.estimated_scale || ""}`, color: "#a855f7" },
              { label: "Rhythm Type", val: music_analysis.rhythm_strength || audio_info.rhythm_strength || "—", color: "#d946ef" },
              { label: "Harmonic Ratio", val: music_analysis.harmonic_ratio || audio_info.harmonic_ratio || "—", color: "#34d399" },
              { label: "Brightness", val: audio_info.spectral_brightness || "—", color: "#fbbf24" },
              { label: "Genre Estimate", val: music_analysis.genre_estimate || "—", color: "#ec4899" },
              { label: "Is Music", val: music_analysis.is_music ? "YES" : "NO", color: music_analysis.is_music ? "#34d399" : "#64748b" },
              { label: "Confidence", val: music_analysis.confidence ? `${(music_analysis.confidence * 100).toFixed(0)}%` : "—", color: "#06b6d4" },
            ].map(({ label, val, color }) => (
              <div key={label} className="stat-card">
                <div className="stat-label">{label}</div>
                <div className="stat-value" style={{ color, fontSize: 16, wordBreak: "break-word" }}>{val}</div>
              </div>
            ))}
          </div>

          {audio_info.frequency_distribution && (
            <SectionCard title="Frequency Band Distribution" icon={BarChart2} iconColor="#818cf8" subtitle="STFT acoustic power spectrum">
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {[
                  { label: "Bass (20–250 Hz)", pct: audio_info.frequency_distribution.bass_percent, color: "#6366f1" },
                  { label: "Mid-range (250–4k Hz)", pct: audio_info.frequency_distribution.mid_percent, color: "#a855f7" },
                  { label: "Treble (4k+ Hz)", pct: audio_info.frequency_distribution.treble_percent, color: "#ec4899" },
                ].map(({ label, pct, color }) => (
                  <div key={label}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#94a3b8", marginBottom: 5 }}>
                      <span>{label}</span>
                      <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, color }}>{pct}%</span>
                    </div>
                    <div style={{ height: 8, background: "rgba(255,255,255,0.06)", borderRadius: 5, overflow: "hidden" }}>
                      <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 5, transition: "width 0.7s ease", boxShadow: `0 0 8px ${color}55` }} />
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>
          )}
        </div>
      )}

      {/* ── TAB: STEMS ── */}
      {activeTab === "stems" && (
        <SectionCard title="Demucs Source Separation Stems" icon={Sliders} iconColor="#a855f7"
          subtitle={source_separation.performed ? "Stems isolated & available for playback" : "Separation not performed"}
        >
          {source_separation.stems && source_separation.stems.length > 0 ? (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {source_separation.stems.map((stem, i) => (
                <div
                  key={i}
                  style={{
                    padding: "14px 16px",
                    borderRadius: 10,
                    background: "rgba(168,85,247,0.07)",
                    border: "1px solid rgba(168,85,247,0.2)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                    <span style={{ fontWeight: 800, fontSize: 13, color: "#f1f5f9", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                      {stem.name}
                    </span>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "#64748b" }}>{stem.type}</span>
                  </div>
                  {stem.file_path && (
                    <audio
                      src={`${getMediaBase()}/separated/${report.audio_info?.audio_id}/${stem.type}.mp3`}
                      controls
                    />
                  )}
                </div>
              ))}
            </div>
          ) : (
            <EmptyState message={source_separation.note || "Source separation was not performed on this audio stream."} />
          )}
        </SectionCard>
      )}

      {/* ── TAB: CONTEXT ── */}
      {activeTab === "context" && (
        <SectionCard title="Context-Aware Scene Understanding" icon={Sparkles} iconColor="#818cf8"
          subtitle="Gemini ALM contextual reasoning output"
        >
          <div
            style={{
              padding: "16px 18px",
              borderRadius: 10,
              background: "rgba(0,0,0,0.25)",
              border: "1px solid rgba(255,255,255,0.06)",
              fontSize: 13,
              color: "#e2e8f0",
              lineHeight: 1.8,
              whiteSpace: "pre-wrap",
              minHeight: 100,
            }}
          >
            {context_understanding || (
              <span style={{ color: "#3f5068", fontStyle: "italic" }}>
                No contextual scene description available.
              </span>
            )}
          </div>
        </SectionCard>
      )}

      {/* ── TAB: EMERGENCY ── */}
      {activeTab === "emergency" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <SectionCard title="Recommended Responders" icon={ShieldCheck} iconColor="#f43f5e">
              {recommended_response.responders && recommended_response.responders.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {recommended_response.responders.map((resp, i) => (
                    <div key={i}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "10px 12px",
                        borderRadius: 8,
                        background: "rgba(244,63,94,0.06)",
                        border: "1px solid rgba(244,63,94,0.2)",
                        fontSize: 12,
                        fontWeight: 700,
                        color: "#e2e8f0",
                      }}
                    >
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#f43f5e", flexShrink: 0 }} />
                      {resp}
                    </div>
                  ))}
                </div>
              ) : <EmptyState message="No external responder dispatch recommended." />}
            </SectionCard>

            <SectionCard title="Alert Dispatch Status" icon={BellRing} iconColor="#fbbf24">
              <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 12 }}>
                {[
                  { label: "Mode", val: notification_status.mode || "SIMULATION", mono: true, color: "#fbbf24" },
                  { label: "Phone", val: notification_status.phone || "—", mono: true },
                  { label: "Email", val: notification_status.email || "—" },
                  { label: "Sent", val: notification_status.sent ? "Yes" : "No", color: notification_status.sent ? "#34d399" : "#64748b" },
                ].map(({ label, val, mono, color }) => (
                  <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                    <span style={{ color: "#64748b" }}>{label}</span>
                    <span style={{
                      fontFamily: mono ? "var(--font-mono)" : "var(--font-sans)",
                      color: color || "#cbd5e1",
                      fontWeight: 600,
                      fontSize: 12,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      maxWidth: 180,
                    }}>
                      {val}
                    </span>
                  </div>
                ))}
                {notification_status.details && (
                  <div style={{ marginTop: 6, paddingTop: 10, borderTop: "1px solid rgba(255,255,255,0.06)", fontSize: 11, color: "#64748b", lineHeight: 1.5 }}>
                    {notification_status.details}
                  </div>
                )}
              </div>
            </SectionCard>
          </div>
        </div>
      )}

      {/* ── TAB: TIMELINE TABLE ── */}
      {activeTab === "timeline" && (
        <div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "140px 1fr 130px 110px",
              gap: 8,
              padding: "10px 14px",
              borderBottom: "1px solid rgba(255,255,255,0.07)",
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
            <div>Detected Event</div>
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <Tag style={{ width: 10, height: 10 }} /> Category
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <Percent style={{ width: 10, height: 10 }} /> Confidence
            </div>
          </div>

          {sortedTimeline.length > 0 ? (
            <div style={{ maxHeight: 420, overflowY: "auto" }}>
              {sortedTimeline.map((evt, i) => {
                const conf = evt.confidence;
                const confColor = getConfColor(conf);
                return (
                  <div
                    key={i}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "140px 1fr 130px 110px",
                      gap: 8,
                      padding: "9px 14px",
                      fontSize: 12,
                      borderBottom: "1px solid rgba(255,255,255,0.03)",
                      alignItems: "center",
                      transition: "background 0.15s",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.04)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "#818cf8" }}>
                      {fmt(evt.start)} – {fmt(evt.end)}
                    </div>
                    <div style={{ fontWeight: 600, color: "#e2e8f0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {evt.label}
                    </div>
                    <div>
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 4,
                        background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.2)",
                        color: "#a5b4fc", whiteSpace: "nowrap",
                      }}>
                        {evt.track || evt.category || "—"}
                      </span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ flex: 1, height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 3, overflow: "hidden" }}>
                        <div style={{ width: conf ? `${conf * 100}%` : "0%", height: "100%", background: confColor, borderRadius: 3, transition: "width 0.5s ease" }} />
                      </div>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, color: confColor, minWidth: 36, textAlign: "right" }}>
                        {conf ? `${(conf * 100).toFixed(0)}%` : "—"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState message="No timeline events with timestamps available for this audio." />
          )}
        </div>
      )}

      {/* ── TAB: SUMMARY ── */}
      {activeTab === "summary" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <SectionCard title="Final AI Executive Summary" icon={Sparkles} iconColor="#818cf8"
            subtitle={`Generated by Gemini ALM · Processing time: ${processing_time}s`}
          >
            <div
              style={{
                padding: "16px 18px",
                borderRadius: 10,
                background: "rgba(0,0,0,0.25)",
                border: "1px solid rgba(255,255,255,0.06)",
                fontSize: 13,
                color: "#e2e8f0",
                lineHeight: 1.8,
                whiteSpace: "pre-wrap",
              }}
            >
              {final_ai_summary || (
                <span style={{ color: "#3f5068", fontStyle: "italic" }}>No summary available.</span>
              )}
            </div>
          </SectionCard>

          {/* Export */}
          <SectionCard title="Export Report" icon={Download} iconColor="#34d399" subtitle="Download structured analysis data">
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <button
                onClick={() => onExport(analysisId, "json")}
                className="btn-primary"
                style={{ fontSize: 13 }}
              >
                <Download style={{ width: 15, height: 15 }} />
                Download JSON Report
              </button>
              <button
                onClick={() => onExport(analysisId, "txt")}
                className="btn-secondary"
                style={{ fontSize: 13 }}
              >
                <Download style={{ width: 15, height: 15 }} />
                Export Plain Text
              </button>
            </div>
            <div style={{ marginTop: 12, fontSize: 11, color: "#3f5068", lineHeight: 1.6 }}>
              The JSON export contains all 18 analysis sections in structured format suitable for downstream processing. The TXT export contains a human-readable summary.
            </div>
          </SectionCard>
        </div>
      )}
    </div>
  );
}
