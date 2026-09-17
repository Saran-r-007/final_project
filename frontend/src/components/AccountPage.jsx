import { useState, useEffect } from "react";
import {
  User,
  Mail,
  Lock,
  Phone,
  Save,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Shield,
  Settings,
  LogOut,
  Eye,
  EyeOff,
} from "lucide-react";
import { getProfile, updateProfile, changePassword, getSettings, updateSettings } from "../services/api";

export default function AccountPage({ onBack, onLogout, onUserUpdate }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [alert, setAlert] = useState({ type: "", message: "" });

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [emergencyPhone, setEmergencyPhone] = useState("");
  const [emergencyEmail, setEmergencyEmail] = useState("");
  const [notifMode, setNotifMode] = useState("SIMULATION");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [changingPw, setChangingPw] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [prof, sett] = await Promise.all([getProfile(), getSettings()]);
        if (cancelled) return;
        setProfile(prof);
        setUsername(prof.username || "");
        setEmail(prof.email || "");
        setEmergencyPhone(prof.emergency_phone || sett.emergency_phone || "");
        setEmergencyEmail(prof.emergency_email || sett.emergency_email || "");
        setNotifMode(prof.notification_mode || sett.notification_mode || "SIMULATION");
      } catch (err) {
        if (!cancelled) setAlert({ type: "error", message: "Failed to load profile: " + err.message });
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSaving(true);
    setAlert({ type: "", message: "" });
    try {
      await Promise.all([
        updateProfile({ username, email }),
        updateSettings({ emergency_phone: emergencyPhone, emergency_email: emergencyEmail, notification_mode: notifMode }),
      ]);
      setAlert({ type: "success", message: "Profile updated successfully." });
      if (onUserUpdate) onUserUpdate({ id: profile.id, username, email });
    } catch (err) {
      setAlert({ type: "error", message: err.message || "Failed to update profile." });
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setAlert({ type: "error", message: "New passwords do not match." });
      return;
    }
    if (newPassword.length < 6) {
      setAlert({ type: "error", message: "New password must be at least 6 characters." });
      return;
    }
    setChangingPw(true);
    setAlert({ type: "", message: "" });
    try {
      await changePassword(currentPassword, newPassword);
      setAlert({ type: "success", message: "Password changed successfully." });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setAlert({ type: "error", message: err.message || "Failed to change password." });
    } finally {
      setChangingPw(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "80px 20px" }}>
        <div style={{ width: 36, height: 36, border: "3px solid rgba(99,102,241,0.2)", borderTopColor: "#6366f1", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
        <p style={{ marginTop: 16, opacity: 0.6, fontSize: 14 }}>Loading profile...</p>
      </div>
    );
  }

  const AlertIcon = alert.type === "error" ? AlertCircle : CheckCircle2;

  return (
    <div style={{ padding: 24, maxWidth: 720, margin: "0 auto" }}>
      <style>{accountStyles}</style>

      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 28 }}>
        <button className="btn-secondary btn-icon" onClick={onBack} style={{ flexShrink: 0 }}>
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Account & Settings</h1>
          <p style={{ margin: "4px 0 0", fontSize: 13, opacity: 0.55 }}>Manage your profile and emergency notification preferences</p>
        </div>
      </div>

      {alert.message && (
        <div className={`account-alert ${alert.type === "error" ? "alert-error" : "alert-success"}`}>
          <AlertIcon size={16} />
          <span>{alert.message}</span>
        </div>
      )}

      {/* Profile Section */}
      <form onSubmit={handleSaveProfile} className="glass-panel account-section">
        <div className="section-header">
          <User size={18} style={{ color: "#818cf8" }} />
          <h2>Profile Information</h2>
        </div>

        <div className="form-grid">
          <div className="form-group">
            <label className="form-label">
              <User size={13} /> Username
            </label>
            <input
              type="text"
              className="form-input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              minLength={3}
              maxLength={30}
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">
              <Mail size={13} /> Email
            </label>
            <input
              type="email"
              className="form-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
        </div>

        <div className="section-header" style={{ marginTop: 24 }}>
          <Phone size={18} style={{ color: "#818cf8" }} />
          <h2>Emergency Contacts</h2>
        </div>
        <p style={{ fontSize: 12, color: "#64748b", marginBottom: 16 }}>
          Used for emergency alert notifications. Leave empty to use system defaults.
        </p>

        <div className="form-grid">
          <div className="form-group">
            <label className="form-label">
              <Phone size={13} /> Emergency Phone
            </label>
            <input
              type="text"
              className="form-input"
              value={emergencyPhone}
              onChange={(e) => setEmergencyPhone(e.target.value)}
              placeholder="+919597389141"
              style={{ fontFamily: "var(--font-mono)" }}
            />
          </div>
          <div className="form-group">
            <label className="form-label">
              <Mail size={13} /> Emergency Email
            </label>
            <input
              type="email"
              className="form-input"
              value={emergencyEmail}
              onChange={(e) => setEmergencyEmail(e.target.value)}
              placeholder="responder@example.com"
            />
          </div>
        </div>

        <div className="form-group" style={{ marginTop: 16 }}>
          <label className="form-label">
            <Settings size={13} /> Notification Mode
          </label>
          <select
            className="form-input"
            value={notifMode}
            onChange={(e) => setNotifMode(e.target.value)}
          >
            <option value="SIMULATION">SIMULATION (Internal audit logging only)</option>
            <option value="LIVE">LIVE (Real SMS + Email via Twilio/SMTP)</option>
          </select>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 20 }}>
          <button type="submit" className="btn-primary" disabled={saving}>
            <Save size={15} />
            {saving ? "Saving..." : "Save Profile"}
          </button>
        </div>
      </form>

      {/* Password Section */}
      <form onSubmit={handleChangePassword} className="glass-panel account-section" style={{ marginTop: 20 }}>
        <div className="section-header">
          <Lock size={18} style={{ color: "#818cf8" }} />
          <h2>Change Password</h2>
        </div>

        <div className="form-group">
          <label className="form-label">
            <Lock size={13} /> Current Password
          </label>
          <div style={{ position: "relative" }}>
            <input
              type={showCurrentPw ? "text" : "password"}
              className="form-input"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Enter current password"
              required
              style={{ paddingRight: 40 }}
            />
            <button type="button" className="pw-toggle" onClick={() => setShowCurrentPw(!showCurrentPw)} tabIndex={-1}>
              {showCurrentPw ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        <div className="form-grid" style={{ marginTop: 16 }}>
          <div className="form-group">
            <label className="form-label">
              <Lock size={13} /> New Password
            </label>
            <div style={{ position: "relative" }}>
              <input
                type={showNewPw ? "text" : "password"}
                className="form-input"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Min 6 characters"
                minLength={6}
                required
                style={{ paddingRight: 40 }}
              />
              <button type="button" className="pw-toggle" onClick={() => setShowNewPw(!showNewPw)} tabIndex={-1}>
                {showNewPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">
              <Lock size={13} /> Confirm New Password
            </label>
            <input
              type="password"
              className="form-input"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repeat new password"
              minLength={6}
              required
            />
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 20, gap: 12 }}>
          <button type="submit" className="btn-primary" disabled={changingPw}>
            <Shield size={15} />
            {changingPw ? "Changing..." : "Change Password"}
          </button>
        </div>
      </form>

      {/* Danger Zone */}
      <div className="glass-panel account-section" style={{ marginTop: 20, borderColor: "rgba(239,68,68,0.2)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#fda4af" }}>Sign out of your account</h3>
            <p style={{ margin: "4px 0 0", fontSize: 12, color: "#64748b" }}>You will need to log in again to access your account.</p>
          </div>
          <button className="btn-danger" onClick={onLogout} style={{ padding: "8px 20px" }}>
            <LogOut size={15} />
            Logout
          </button>
        </div>
      </div>
    </div>
  );
}

const accountStyles = `
  .account-section {
    padding: 24px;
  }
  .section-header {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 16px;
  }
  .section-header h2 {
    margin: 0;
    font-size: 16px;
    font-weight: 700;
  }
  .form-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
  }
  @media (max-width: 600px) {
    .form-grid { grid-template-columns: 1fr; }
  }
  .form-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .form-label {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    opacity: 0.7;
  }
  .form-input {
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 8px;
    padding: 10px 14px;
    font-size: 14px;
    color: inherit;
    outline: none;
    transition: border-color 0.2s;
    font-family: var(--font-sans);
  }
  .form-input:focus {
    border-color: rgba(99,102,241,0.5);
  }
  .form-input option {
    background: #0f172a;
    color: #e2e8f0;
  }
  .pw-toggle {
    position: absolute;
    right: 10px;
    top: 50%;
    transform: translateY(-50%);
    background: none;
    border: none;
    color: #64748b;
    cursor: pointer;
    padding: 4px;
  }
  .pw-toggle:hover { color: #94a3b8; }
  .account-alert {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 16px;
    border-radius: 10px;
    margin-bottom: 20px;
    font-size: 13px;
    font-weight: 600;
  }
  .alert-success {
    background: rgba(16,185,129,0.1);
    border: 1px solid rgba(16,185,129,0.3);
    color: #6ee7b7;
  }
  .alert-error {
    background: rgba(244,63,94,0.1);
    border: 1px solid rgba(244,63,94,0.3);
    color: #fda4af;
  }
  .btn-primary {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 9px 18px;
    border: none;
    border-radius: 8px;
    background: linear-gradient(135deg, #6366f1, #8b5cf6);
    color: #fff;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: opacity 0.2s, transform 0.1s;
  }
  .btn-primary:hover { opacity: 0.9; }
  .btn-primary:active { transform: scale(0.98); }
  .btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }
  .btn-secondary {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 14px;
    border: 1px solid rgba(255,255,255,0.12);
    border-radius: 8px;
    background: rgba(255,255,255,0.05);
    color: inherit;
    font-size: 13px;
    cursor: pointer;
    transition: background 0.2s;
  }
  .btn-secondary:hover { background: rgba(255,255,255,0.1); }
  .btn-danger {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 14px;
    border: 1px solid rgba(239,68,68,0.25);
    border-radius: 8px;
    background: rgba(239,68,68,0.1);
    color: #ef4444;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s;
  }
  .btn-danger:hover { background: rgba(239,68,68,0.2); }
  .btn-icon { padding: 6px 8px; }
  .glass-panel {
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 12px;
  }
`;
