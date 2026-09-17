import {
  ShieldAlert, AlertTriangle, Info, CheckCircle2, Music,
  BellRing, Sparkles, Flame, Shield, Smartphone, Mail, Phone
} from "lucide-react";

const SERVICE_CONTACTS = {
  medical: { label: 'Medical / Ambulance', phone: '+91 99430 81908', telLink: 'tel:+919943081908' },
  police: { label: 'Police', phone: '+91 79044 99489', telLink: 'tel:+917904499489' },
  fire: { label: 'Fire / Rescue', phone: '+91 90252 57115', telLink: 'tel:+919025257115' },
};

function classifyEmergencyType(emergencyTypes) {
  const labels = emergencyTypes.map(t => t.type.toLowerCase());
  for (const lbl of labels) {
    if (/ambulance|medical|heart|breathing|injury|injured/.test(lbl)) return 'medical';
    if (/police|crime|robbery|shooting|gun|intruder|theft/.test(lbl)) return 'police';
    if (/fire|rescue|siren|smoke|alarm|explosion/.test(lbl)) return 'fire';
  }
  return 'medical';
}

const SEVERITY_CONFIG = {
  CRITICAL: {
    border: "rgba(244,63,94,0.45)",
    bg: "rgba(244,63,94,0.07)",
    glow: "0 0 40px rgba(244,63,94,0.2)",
    text: "#f43f5e",
    textLight: "#fda4af",
    badge: "tag-critical",
    gaugeColor: "#f43f5e",
    gaugeGlow: "rgba(244,63,94,0.6)",
    icon: ShieldAlert,
    pulse: true,
  },
  WARNING: {
    border: "rgba(245,158,11,0.4)",
    bg: "rgba(245,158,11,0.06)",
    glow: "0 0 30px rgba(245,158,11,0.15)",
    text: "#f59e0b",
    textLight: "#fcd34d",
    badge: "tag-warning",
    gaugeColor: "#f59e0b",
    gaugeGlow: "rgba(245,158,11,0.5)",
    icon: AlertTriangle,
    pulse: false,
  },
  INFO: {
    border: "rgba(59,130,246,0.35)",
    bg: "rgba(59,130,246,0.05)",
    glow: "none",
    text: "#3b82f6",
    textLight: "#93c5fd",
    badge: "tag-info",
    gaugeColor: "#3b82f6",
    gaugeGlow: "rgba(59,130,246,0.4)",
    icon: Info,
    pulse: false,
  },
  PEACEFUL: {
    border: "rgba(16,185,129,0.35)",
    bg: "rgba(16,185,129,0.05)",
    glow: "none",
    text: "#10b981",
    textLight: "#6ee7b7",
    badge: "tag-peaceful",
    gaugeColor: "#10b981",
    gaugeGlow: "rgba(16,185,129,0.4)",
    icon: CheckCircle2,
    pulse: false,
  },
  MUSIC: {
    border: "rgba(168,85,247,0.35)",
    bg: "rgba(168,85,247,0.05)",
    glow: "none",
    text: "#a855f7",
    textLight: "#d8b4fe",
    badge: "tag-music",
    gaugeColor: "#a855f7",
    gaugeGlow: "rgba(168,85,247,0.4)",
    icon: Music,
    pulse: false,
  },
};

// SVG arc gauge
function RiskGauge({ score, color, glow }) {
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const arcLength = circumference * 0.75; // 270-degree arc
  const filled = arcLength * (Math.min(100, Math.max(0, score)) / 100);
  const offset = arcLength - filled;

  return (
    <svg width="100" height="100" style={{ flexShrink: 0 }}>
      {/* Background arc */}
      <circle
        cx="50"
        cy="50"
        r={radius}
        fill="none"
        stroke="rgba(255,255,255,0.06)"
        strokeWidth="8"
        strokeLinecap="round"
        strokeDasharray={`${arcLength} ${circumference - arcLength}`}
        strokeDashoffset="0"
        transform="rotate(135 50 50)"
      />
      {/* Filled arc */}
      <circle
        cx="50"
        cy="50"
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth="8"
        strokeLinecap="round"
        strokeDasharray={`${arcLength} ${circumference - arcLength}`}
        strokeDashoffset={offset}
        transform="rotate(135 50 50)"
        style={{
          filter: `drop-shadow(0 0 6px ${glow})`,
          transition: "stroke-dashoffset 1.2s cubic-bezier(0.4,0,0.2,1)",
        }}
      />
      {/* Score text */}
      <text
        x="50"
        y="46"
        textAnchor="middle"
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 18,
          fontWeight: 800,
          fill: color,
        }}
      >
        {score}
      </text>
      <text
        x="50"
        y="60"
        textAnchor="middle"
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 9,
          fill: "rgba(255,255,255,0.35)",
        }}
      >
        / 100
      </text>
    </svg>
  );
}

export default function EmergencyBanner({ report }) {
  if (!report || !report.risk_score) return null;

  const { score, severity, explanation } = report.risk_score;
  const emergencyAnalysis = report.emergency_analysis || {};
  const isEmergency = emergencyAnalysis.is_emergency;
  const emergencyTypes = emergencyAnalysis.emergency_types || [];
  const riskFactors = emergencyAnalysis.risk_factors || [];
  const explainableAi = report.explainable_ai || {};
  const notif = report.notification_status || {};

  const cfg = SEVERITY_CONFIG[severity] || SEVERITY_CONFIG.INFO;
  const Icon = cfg.icon;

  const emgCategory = classifyEmergencyType(emergencyTypes);
  const service = SERVICE_CONTACTS[emgCategory];

  return (
    <div
      className="glass-panel p-6 mb-6 animate-slide-up"
      style={{
        border: `1px solid ${cfg.border}`,
        background: cfg.bg,
        boxShadow: cfg.glow,
      }}
    >
      {/* Top row: gauge + info + notification badge */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 20,
          marginBottom: 20,
          paddingBottom: 20,
          borderBottom: "1px solid rgba(255,255,255,0.07)",
          flexWrap: "wrap",
        }}
      >
        {/* Left: Gauge + Labels */}
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <RiskGauge score={score} color={cfg.gaugeColor} glow={cfg.gaugeGlow} />

          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <span className={`tag-badge ${cfg.badge}`} style={{ fontSize: 11, padding: "4px 12px" }}>
                <Icon style={{ width: 12, height: 12 }} />
                {severity}
              </span>
              {isEmergency && (
                <span
                  className="tag-badge tag-critical"
                  style={{
                    animation: "pulse-ring 2s infinite ease-in-out",
                    fontSize: 10,
                  }}
                >
                  <Flame style={{ width: 11, height: 11 }} />
                  ACTIVE EMERGENCY
                </span>
              )}
            </div>

            <h2
              style={{
                fontSize: 18,
                fontWeight: 800,
                color: "#f1f5f9",
                marginBottom: 6,
                lineHeight: 1.2,
              }}
            >
              {isEmergency
                ? "Emergency / Threat Signals Detected"
                : severity === "PEACEFUL"
                ? "Peaceful Audio — No Threats Identified"
                : "Standard Audio Profile Verified"}
            </h2>

            <p style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.6, maxWidth: 520 }}>
              {explanation}
            </p>

            {/* Emergency types */}
            {emergencyTypes.length > 0 && (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
                {emergencyTypes.map((et, i) => (
                  <span key={i} className="tag-badge tag-critical" style={{ fontSize: 10 }}>
                    <Shield style={{ width: 10, height: 10 }} />
                    {et.type}
                    {et.confidence && (
                      <span style={{ opacity: 0.7 }}>
                        {" "}({(et.confidence * 100).toFixed(0)}%)
                      </span>
                    )}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: Notification badge + Service Contact */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'flex-end' }}>
          {isEmergency && service && (
            <div
              style={{
                padding: "10px 16px",
                borderRadius: 10,
                background: "rgba(244,63,94,0.07)",
                border: "1px solid rgba(244,63,94,0.25)",
                minWidth: 200,
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 700, color: "#fda4af", marginBottom: 6 }}>
                Contact {service.label}:
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <a
                  href={service.telLink}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '6px 14px',
                    borderRadius: 6,
                    background: 'rgba(244,63,94,0.15)',
                    border: '1px solid rgba(244,63,94,0.35)',
                    color: '#fda4af',
                    textDecoration: 'none',
                    fontWeight: 700,
                    fontSize: 13,
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  <Phone style={{ width: 14, height: 14 }} />
                  {service.phone}
                </a>
              </div>
            </div>
          )}
          {notif.sent && (
            <div
              style={{
                padding: "12px 16px",
                borderRadius: 10,
                background: "rgba(245,158,11,0.07)",
                border: "1px solid rgba(245,158,11,0.25)",
                minWidth: 220,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 7,
                  marginBottom: 8,
                  fontSize: 12,
                  fontWeight: 700,
                  color: "#fbbf24",
                }}
              >
                <BellRing style={{ width: 15, height: 15, animation: "bounce-subtle 2s ease-in-out infinite" }} />
                Alert Dispatched ({notif.mode || "SIMULATION"})
              </div>
              <div style={{ fontSize: 11, color: "#94a3b8", lineHeight: 1.7 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <Smartphone style={{ width: 12, height: 12, color: "#818cf8", flexShrink: 0 }} />
                  <span style={{ fontFamily: "var(--font-mono)", color: "#cbd5e1" }}>
                    {notif.phone}
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                  <Mail style={{ width: 12, height: 12, color: "#818cf8", flexShrink: 0 }} />
                  <span style={{ color: "#cbd5e1" }}>{notif.email}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom row: Risk Factors + XAI Evidence */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 16,
        }}
      >
        {/* Risk Factors */}
        <div
          style={{
            padding: "14px 16px",
            borderRadius: 10,
            background: "rgba(0,0,0,0.2)",
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 7,
              marginBottom: 12,
              fontSize: 12,
              fontWeight: 700,
              color: "#94a3b8",
            }}
          >
            <AlertTriangle style={{ width: 14, height: 14, color: "#fbbf24" }} />
            Contributing Risk Factors ({riskFactors.length})
          </div>

          {riskFactors.length === 0 ? (
            <div style={{ fontSize: 12, color: "#3f5068", fontStyle: "italic" }}>
              No alarming acoustic risk factors detected.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {riskFactors.map((rf, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                    gap: 8,
                    padding: "8px 10px",
                    borderRadius: 8,
                    background: "rgba(0,0,0,0.25)",
                    border: "1px solid rgba(255,255,255,0.04)",
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#e2e8f0" }}>
                      {rf.factor}
                    </div>
                    {rf.description && (
                      <div style={{ fontSize: 11, color: "#64748b", marginTop: 2, lineHeight: 1.4 }}>
                        {rf.description}
                      </div>
                    )}
                  </div>
                  {rf.points !== undefined && (
                    <span
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: 11,
                        fontWeight: 800,
                        color: "#f43f5e",
                        background: "rgba(244,63,94,0.1)",
                        padding: "2px 8px",
                        borderRadius: 5,
                        border: "1px solid rgba(244,63,94,0.25)",
                        flexShrink: 0,
                        whiteSpace: "nowrap",
                      }}
                    >
                      +{rf.points} pts
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* XAI Evidence */}
        <div
          style={{
            padding: "14px 16px",
            borderRadius: 10,
            background: "rgba(0,0,0,0.2)",
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 7,
              marginBottom: 12,
              fontSize: 12,
              fontWeight: 700,
              color: "#94a3b8",
            }}
          >
            <Sparkles style={{ width: 14, height: 14, color: "#818cf8" }} />
            Explainable AI Evidence
          </div>

          {explainableAi.evidence && explainableAi.evidence.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              {explainableAi.evidence.map((ev, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 8,
                    padding: "8px 10px",
                    borderRadius: 8,
                    background: "rgba(0,0,0,0.2)",
                    border: "1px solid rgba(255,255,255,0.04)",
                    fontSize: 12,
                    color: "#cbd5e1",
                    lineHeight: 1.4,
                  }}
                >
                  <div
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: "#818cf8",
                      flexShrink: 0,
                      marginTop: 4,
                    }}
                  />
                  {ev}
                </div>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: 12, color: "#3f5068", fontStyle: "italic" }}>
              Continuous baseline acoustic signals — no anomalous patterns.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
