import { useState } from "react";
import { X, Bell, Send, CheckCircle2, Shield, Info, Smartphone, Mail, Settings } from "lucide-react";
import { configureNotifications, testNotification } from "../services/api";

export default function NotificationModal({ isOpen, onClose }) {
  const [phone, setPhone] = useState("+919597389141");
  const [email, setEmail] = useState("saran2007r@gmail.com");
  const [mode, setMode] = useState("LIVE");
  const [statusMessage, setStatusMessage] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);
  const [isTesting, setIsTesting] = useState(false);

  if (!isOpen) return null;

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      await configureNotifications(phone, email, mode);
      setIsSuccess(true);
      setStatusMessage("Configuration saved successfully!");
      setTimeout(() => {
        setStatusMessage("");
        setIsSuccess(false);
      }, 3000);
    } catch (err) {
      setIsSuccess(false);
      setStatusMessage("Error saving settings: " + err.message);
    }
  };

  const handleTestAlert = async () => {
    setIsTesting(true);
    try {
      const res = await testNotification();
      setIsSuccess(true);
      setStatusMessage(res.details || "Test alert simulated!");
      setTimeout(() => {
        setStatusMessage("");
        setIsSuccess(false);
      }, 4000);
    } catch (err) {
      setIsSuccess(false);
      setStatusMessage("Test alert failed: " + err.message);
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="glass-panel w-full max-w-lg p-6 relative animate-slide-up"
        style={{
          background: "rgba(14, 20, 34, 0.95)",
          border: "1px solid rgba(255, 255, 255, 0.12)",
          boxShadow: "0 20px 50px rgba(0,0,0,0.7), 0 0 30px rgba(99,102,241,0.15)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="btn-icon"
          style={{
            position: "absolute",
            top: 16,
            right: 16,
            width: 32,
            height: 32,
            borderRadius: "50%",
          }}
          title="Close"
        >
          <X style={{ width: 16, height: 16 }} />
        </button>

        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginBottom: 20,
            paddingBottom: 16,
            borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
          }}
        >
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              background: "rgba(245, 158, 11, 0.12)",
              border: "1px solid rgba(245, 158, 11, 0.3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <Bell style={{ width: 20, height: 20, color: "#fbbf24" }} />
          </div>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: "#f1f5f9", margin: 0 }}>
              Emergency Notification Settings
            </h3>
            <p style={{ fontSize: 11, color: "#64748b", margin: "2px 0 0" }}>
              Configure SMS, Phone Call, and Email dispatch destinations
            </p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label className="form-label" style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Smartphone style={{ width: 13, height: 13, color: "#818cf8" }} />
              Emergency Recipient Phone Number
            </label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="form-input"
              placeholder="+919597389141"
              style={{ fontFamily: "var(--font-mono)" }}
            />
          </div>

          <div>
            <label className="form-label" style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Mail style={{ width: 13, height: 13, color: "#818cf8" }} />
              Emergency Recipient Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="form-input"
              placeholder="responder@domain.com"
            />
          </div>

          <div>
            <label className="form-label" style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Settings style={{ width: 13, height: 13, color: "#818cf8" }} />
              Dispatch Mode
            </label>
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value)}
              className="form-select"
            >
              <option value="SIMULATION">SIMULATION (Verified Internal Audit Logging)</option>
              <option value="LIVE">LIVE DISPATCH (External Carrier / Twilio Gateway)</option>
            </select>
          </div>

          <div
            style={{
              padding: "12px 14px",
              borderRadius: 8,
              background: "rgba(0, 0, 0, 0.3)",
              border: "1px solid rgba(255, 255, 255, 0.05)",
              fontSize: 11,
              color: "#94a3b8",
              lineHeight: 1.5,
              display: "flex",
              gap: 8,
            }}
          >
            <Info style={{ width: 15, height: 15, color: "#818cf8", flexShrink: 0, marginTop: 2 }} />
            <div>
              <span style={{ fontWeight: 600, color: "#cbd5e1" }}>Auditable Protocol:</span> All emergency detections and simulated trigger payloads are securely recorded with millisecond timestamp verification.
            </div>
          </div>

          {statusMessage && (
            <div
              style={{
                padding: "10px 14px",
                borderRadius: 8,
                background: isSuccess ? "rgba(16,185,129,0.1)" : "rgba(244,63,94,0.1)",
                border: `1px solid ${isSuccess ? "rgba(16,185,129,0.3)" : "rgba(244,63,94,0.3)"}`,
                color: isSuccess ? "#6ee7b7" : "#fda4af",
                fontSize: 12,
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              {isSuccess ? (
                <CheckCircle2 style={{ width: 15, height: 15, color: "#34d399", flexShrink: 0 }} />
              ) : (
                <Shield style={{ width: 15, height: 15, color: "#f43f5e", flexShrink: 0 }} />
              )}
              <span>{statusMessage}</span>
            </div>
          )}

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              paddingTop: 16,
              borderTop: "1px solid rgba(255, 255, 255, 0.08)",
              gap: 12,
            }}
          >
            <button
              type="button"
              onClick={handleTestAlert}
              disabled={isTesting}
              className="btn-secondary"
              style={{ fontSize: 12, padding: "8px 14px" }}
            >
              <Send style={{ width: 13, height: 13, color: "#fbbf24" }} />
              <span>{isTesting ? "Simulating..." : "Test Trigger"}</span>
            </button>

            <button
              type="submit"
              className="btn-primary"
              style={{ fontSize: 12, padding: "8px 20px" }}
            >
              Save Configuration
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
