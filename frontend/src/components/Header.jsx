import {
  Activity,
  Bell,
  ShieldAlert,
  LogOut,
  User,
  Clock,
  Siren,
  LayoutDashboard,
  Settings,
} from "lucide-react";

export default function Header({
  backendHealthy,
  modelsLoaded,
  onOpenNotifications,
  user,
  onLogout,
  activeView,
  onNavigate,
}) {
  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "history", label: "History", icon: Clock },
    { id: "emergency", label: "Emergency", icon: Siren },
    { id: "account", label: "Account", icon: Settings },
  ];

  return (
    <header style={{ paddingTop: 20, paddingBottom: 0, marginBottom: 28 }}>
      {/* Top bar */}
      <div className="glass-panel p-5 flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Left: Brand */}
        <div className="flex items-center gap-4">
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 14,
              background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 55%, #d946ef 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 6px 24px rgba(99,102,241,0.45), 0 0 0 1px rgba(99,102,241,0.2)",
              flexShrink: 0,
            }}
          >
            <Activity style={{ width: 28, height: 28, color: "#fff" }} />
          </div>

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1
                style={{
                  fontSize: 22,
                  fontWeight: 800,
                  letterSpacing: "-0.03em",
                  color: "#f1f5f9",
                  lineHeight: 1.2,
                  margin: 0,
                }}
              >
                Context-Aware{" "}
                <span className="gradient-text">Audio Intelligence</span>
              </h1>
              <span className="tag-badge tag-info">ALM v3.0</span>
            </div>
            <p
              style={{
                fontSize: 11,
                color: "#64748b",
                marginTop: 4,
                letterSpacing: "0.02em",
              }}
            >
              Deep Learning · Multi-Modal Scene Analysis · Emergency Detection
            </p>
          </div>
        </div>

        {/* Right: Status + Actions */}
        <div className="flex items-center gap-3 flex-wrap justify-center">
          {/* Backend status */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "7px 14px",
              borderRadius: 8,
              background: backendHealthy
                ? "rgba(16,185,129,0.08)"
                : "rgba(244,63,94,0.08)",
              border: `1px solid ${
                backendHealthy
                  ? "rgba(16,185,129,0.25)"
                  : "rgba(244,63,94,0.25)"
              }`,
            }}
          >
            <div
              style={{ position: "relative", width: 8, height: 8, flexShrink: 0 }}
            >
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: backendHealthy ? "#34d399" : "#f43f5e",
                }}
              />
              {backendHealthy && (
                <div
                  style={{
                    position: "absolute",
                    inset: -2,
                    borderRadius: "50%",
                    background: "#34d399",
                    opacity: 0.5,
                    animation: "ping 1.5s cubic-bezier(0,0,0.2,1) infinite",
                  }}
                />
              )}
            </div>
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: backendHealthy ? "#6ee7b7" : "#fda4af",
                whiteSpace: "nowrap",
              }}
            >
              {backendHealthy ? "Pipeline Ready" : "Backend Offline"}
            </span>
          </div>

          {/* Alert config button */}
          <button
            onClick={onOpenNotifications}
            className="btn-secondary"
            style={{ fontSize: 12, padding: "7px 14px" }}
            title="Configure Emergency Alert Notifications"
          >
            <Bell style={{ width: 14, height: 14, color: "#fbbf24" }} />
            <span className="hidden sm:inline">Alert Config</span>
          </button>

          {/* User badge + Logout */}
          {user && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "5px 12px",
                borderRadius: 8,
                background: "rgba(99,102,241,0.08)",
                border: "1px solid rgba(99,102,241,0.2)",
              }}
            >
              <div
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: "50%",
                  background: "linear-gradient(135deg, #6366f1, #d946ef)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <User style={{ width: 13, height: 13, color: "#fff" }} />
              </div>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: "#a5b4fc",
                  maxWidth: 160,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                Logged in as {user.username}
              </span>
              <button
                onClick={onLogout}
                className="btn-icon"
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 6,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
                title="Sign Out"
              >
                <LogOut style={{ width: 13, height: 13, color: "#fda4af" }} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Navigation tabs */}
      <div
        className="glass-panel"
        style={{
          marginTop: 10,
          padding: "6px 8px",
          display: "flex",
          gap: 4,
          justifyContent: "center",
        }}
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 7,
                padding: "8px 18px",
                borderRadius: 8,
                border: "none",
                cursor: "pointer",
                fontSize: 13,
                fontWeight: 600,
                transition: "all 0.2s ease",
                background: isActive
                  ? "rgba(99,102,241,0.15)"
                  : "transparent",
                color: isActive ? "#a5b4fc" : "#64748b",
                fontFamily: "var(--font-sans)",
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = "rgba(255,255,255,0.04)";
                  e.currentTarget.style.color = "#94a3b8";
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.color = "#64748b";
                }
              }}
            >
              <Icon style={{ width: 15, height: 15 }} />
              {item.label}
              {item.id === "emergency" && (
                <span
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    background: "#f43f5e",
                    animation: "recording-ring 2s ease-out infinite",
                  }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Offline warning strip */}
      {!backendHealthy && (
        <div
          className="error-banner"
          style={{ marginTop: 10, borderRadius: 10 }}
        >
          <ShieldAlert style={{ width: 18, height: 18, color: "#f43f5e", flexShrink: 0 }} />
          <div>
            <div
              style={{ fontSize: 13, fontWeight: 700, color: "#fda4af" }}
            >
              Backend Unavailable
            </div>
            <div
              style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}
            >
              The deep learning pipeline is offline. Start the FastAPI server on{" "}
              <span
                style={{ fontFamily: "var(--font-mono)", color: "#818cf8" }}
              >
                http://localhost:8000
              </span>{" "}
              to enable audio analysis.
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
