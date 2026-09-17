import { useState } from "react";
import {
  Activity,
  Mail,
  Lock,
  User,
  Eye,
  EyeOff,
  ArrowRight,
  ArrowLeft,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  Shield,
  Radio,
  Zap,
  ShieldCheck,
} from "lucide-react";
import { signup, login, forgotPassword, verifyOTP, resetPassword } from "../services/api";

function AuthPage({ onAuthSuccess }) {
  const [mode, setMode] = useState("login");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState({ type: "", message: "" });

  const [form, setForm] = useState({
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
    code: "",
  });
  const [errors, setErrors] = useState({});

  const validate = () => {
    const newErrors = {};
    if (mode === "login" || mode === "signup") {
      if (!form.username || form.username.length < 3 || form.username.length > 30) {
        newErrors.username = "Username must be 3-30 characters.";
      } else if (!/^[a-zA-Z0-9]+_[0-9]+$/.test(form.username)) {
        newErrors.username = "Format: Name_Number (e.g. Saran_123). Letters, one underscore, then numbers only.";
      }
    }
    if (mode === "signup" || mode === "forgot-password") {
      if (!form.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
        newErrors.email = "Please enter a valid email address.";
      }
    }
    if (mode === "login" || mode === "signup" || mode === "reset-password") {
      if (!form.password || form.password.length < 6) {
        newErrors.password = "Password must be at least 6 characters.";
      }
    }
    if (mode === "signup" || mode === "reset-password") {
      if (form.password !== form.confirmPassword) {
        newErrors.confirmPassword = "Passwords do not match.";
      }
    }
    if (mode === "verify-otp") {
      if (!form.code || form.code.length !== 6) {
        newErrors.code = "Please enter the 6-digit code from your email.";
      }
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    if (errors[e.target.name]) {
      setErrors({ ...errors, [e.target.name]: "" });
    }
    if (alert.message) setAlert({ type: "", message: "" });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    setAlert({ type: "", message: "" });

    try {
      let res;
      if (mode === "login") {
        res = await login(form.username, form.password);
      } else if (mode === "signup") {
        res = await signup(form.username, form.email, form.password);
      } else if (mode === "forgot-password") {
        res = await forgotPassword(form.email);
        setAlert({ type: "success", message: res.message || "OTP sent to your email." });
        setMode("verify-otp");
        setLoading(false);
        return;
      } else if (mode === "verify-otp") {
        res = await verifyOTP(form.email, form.code);
        setAlert({ type: "success", message: res.message || "OTP verified. Set your new password." });
        setMode("reset-password");
        setLoading(false);
        return;
      } else if (mode === "reset-password") {
        res = await resetPassword(form.email, form.code, form.password);
        setAlert({ type: "success", message: res.message || "Password reset successful. Please login." });
        setMode("login");
        setForm({ username: "", email: "", password: "", confirmPassword: "", code: "" });
        setLoading(false);
        return;
      }

      localStorage.setItem("auth_token", res.token);
      setAlert({ type: "success", message: "Success! Redirecting..." });
      setTimeout(() => onAuthSuccess(res.user), 800);
    } catch (err) {
      let message = err.message || "An error occurred. Please try again.";
      if (message === "Failed to fetch") {
        message = "Cannot connect to server. Please make sure the backend is running on http://localhost:8000";
      }
      setAlert({
        type: "error",
        message: message,
      });
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (newMode) => {
    setMode(newMode);
    setForm({ username: "", email: "", password: "", confirmPassword: "", code: "" });
    setErrors({});
    setAlert({ type: "", message: "" });
    setShowPassword(false);
    setShowConfirmPassword(false);
  };

  const features = [
    { icon: <Activity size={20} />, text: "Real-time audio analysis" },
    { icon: <Zap size={20} />, text: "Lightning-fast processing" },
    { icon: <Shield size={20} />, text: "Secure & private" },
    { icon: <Radio size={20} />, text: "Multi-language support" },
  ];

  const AlertIcon = alert.type === "error" ? AlertCircle : CheckCircle2;

  return (
    <div className="auth-page">
      <div className="auth-brand-panel">
        <div className="auth-brand-content">
          <div className="auth-brand-logo">
            <svg viewBox="0 0 120 120" width="100" height="100">
              <defs>
                <linearGradient id="logoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#7c3aed" />
                  <stop offset="100%" stopColor="#4f46e5" />
                </linearGradient>
              </defs>
              {[50, 38, 26, 14].map((r, i) => (
                <circle
                  key={i}
                  cx="60"
                  cy="60"
                  r={r}
                  fill="none"
                  stroke="url(#logoGrad)"
                  strokeWidth={i === 0 ? 3 : 2}
                  opacity={1 - i * 0.15}
                />
              ))}
              <circle cx="60" cy="60" r="8" fill="url(#logoGrad)" />
            </svg>
            <h1>AudioMind</h1>
            <p>Contest-Aware Audio Understanding</p>
          </div>
          <div className="auth-brand-features">
            {features.map((f, i) => (
              <div className="auth-feature-item" key={i}>
                {f.icon}
                <span>{f.text}</span>
              </div>
            ))}
          </div>
          <div className="auth-brand-footer">
            <small>&copy; 2026 AudioMind. All rights reserved.</small>
          </div>
        </div>
      </div>

      <div className="auth-form-panel">
        <div className="auth-form-container">
          <div className="auth-mobile-logo">
            <svg viewBox="0 0 120 120" width="48" height="48">
              <defs>
                <linearGradient id="logoGradMobile" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#7c3aed" />
                  <stop offset="100%" stopColor="#4f46e5" />
                </linearGradient>
              </defs>
              {[50, 38, 26, 14].map((r, i) => (
                <circle
                  key={i}
                  cx="60"
                  cy="60"
                  r={r}
                  fill="none"
                  stroke="url(#logoGradMobile)"
                  strokeWidth={i === 0 ? 3 : 2}
                  opacity={1 - i * 0.15}
                />
              ))}
              <circle cx="60" cy="60" r="8" fill="url(#logoGradMobile)" />
            </svg>
          </div>

          {(mode === "verify-otp" || mode === "reset-password") && (
            <button
              className="auth-back-btn"
              type="button"
              onClick={() => switchMode(mode === "reset-password" ? "verify-otp" : "forgot-password")}
            >
              <ArrowLeft size={16} /> Back
            </button>
          )}

          <div className="auth-form-header">
            {mode === "login" && (
              <>
                <h2>Welcome back</h2>
                <p>Sign in to your account</p>
              </>
            )}
            {mode === "signup" && (
              <>
                <h2>Create account</h2>
                <p>Get started with AudioMind</p>
              </>
            )}
            {mode === "forgot-password" && (
              <>
                <h2>Reset password</h2>
                <p>Enter your registered email to receive an OTP</p>
              </>
            )}
            {mode === "verify-otp" && (
              <>
                <h2>Verify OTP</h2>
                <p>Enter the 6-digit code sent to <strong>{form.email}</strong></p>
              </>
            )}
            {mode === "reset-password" && (
              <>
                <h2>Set new password</h2>
                <p>Create a strong new password for your account</p>
              </>
            )}
          </div>

          {alert.message && (
            <div className={`auth-alert auth-alert-${alert.type}`}>
              <AlertIcon size={18} />
              <span>{alert.message}</span>
            </div>
          )}

          <form className="auth-form" onSubmit={handleSubmit}>
            {(mode === "login" || mode === "signup") && (
              <div className="auth-input-group">
                <label>{mode === "login" ? "Username or Email" : "Username"}</label>
                <div className="auth-input-wrapper">
                  <User size={18} className="auth-input-icon" />
                  <input
                    type="text"
                    name="username"
                    placeholder={mode === "login" ? "Username or email" : "Name_Number (e.g. Saran_123)"}
                    value={form.username}
                    onChange={handleChange}
                    autoComplete="username"
                  />
                </div>
                {mode === "signup" && (
                  <small className="auth-input-hint">
                    Letters, one underscore, then numbers. Example: Saran_123
                  </small>
                )}
                {errors.username && <small className="auth-input-error">{errors.username}</small>}
              </div>
            )}

            {(mode === "signup" || mode === "forgot-password") && (
              <div className="auth-input-group">
                <label>Email</label>
                <div className="auth-input-wrapper">
                  <Mail size={18} className="auth-input-icon" />
                  <input
                    type="email"
                    name="email"
                    placeholder="you@example.com"
                    value={form.email}
                    onChange={handleChange}
                    autoComplete="email"
                  />
                </div>
                {errors.email && <small className="auth-input-error">{errors.email}</small>}
              </div>
            )}

            {(mode === "login" || mode === "signup" || mode === "reset-password") && (
              <div className="auth-input-group">
                <label>{mode === "reset-password" ? "New Password" : "Password"}</label>
                <div className="auth-input-wrapper">
                  <Lock size={18} className="auth-input-icon" />
                  <input
                    type={showPassword ? "text" : "password"}
                    name="password"
                    placeholder={mode === "reset-password" ? "Enter new password" : "Enter password"}
                    value={form.password}
                    onChange={handleChange}
                    autoComplete={mode === "login" ? "current-password" : "new-password"}
                  />
                  <button
                    type="button"
                    className="auth-password-toggle"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {mode === "reset-password" && (
                  <small className="auth-input-hint">At least 6 characters</small>
                )}
                {errors.password && <small className="auth-input-error">{errors.password}</small>}
              </div>
            )}

            {(mode === "signup" || mode === "reset-password") && (
              <div className="auth-input-group">
                <label>Confirm Password</label>
                <div className="auth-input-wrapper">
                  <KeyRound size={18} className="auth-input-icon" />
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    name="confirmPassword"
                    placeholder="Confirm password"
                    value={form.confirmPassword}
                    onChange={handleChange}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    className="auth-password-toggle"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    tabIndex={-1}
                  >
                    {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {errors.confirmPassword && (
                  <small className="auth-input-error">{errors.confirmPassword}</small>
                )}
              </div>
            )}

            {mode === "verify-otp" && (
              <div className="auth-input-group">
                <label>Verification Code</label>
                <div className="auth-input-wrapper">
                  <ShieldCheck size={18} className="auth-input-icon" />
                  <input
                    type="text"
                    name="code"
                    placeholder="Enter 6-digit OTP"
                    value={form.code}
                    onChange={handleChange}
                    maxLength={6}
                    style={{ letterSpacing: "6px", textAlign: "center", fontSize: "18px", fontWeight: 700 }}
                  />
                </div>
                <small className="auth-input-hint">Check your email inbox (and spam folder)</small>
                {errors.code && <small className="auth-input-error">{errors.code}</small>}
              </div>
            )}

            <button
              type="submit"
              className="auth-btn auth-btn-primary"
              disabled={loading}
            >
              {loading ? (
                <span className="auth-btn-spinner" />
              ) : (
                <>
                  {mode === "login" && "Sign In"}
                  {mode === "signup" && "Create Account"}
                  {mode === "forgot-password" && "Send OTP"}
                  {mode === "verify-otp" && "Verify OTP"}
                  {mode === "reset-password" && "Reset Password"}
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>

          {mode === "login" && (
            <>
              <button
                className="auth-btn-link"
                type="button"
                onClick={() => switchMode("forgot-password")}
              >
                Forgot password?
              </button>
              <div className="auth-divider"><span>or</span></div>
              <p className="auth-switch">
                Don&apos;t have an account?{" "}
                <button type="button" onClick={() => switchMode("signup")}>
                  Sign up
                </button>
              </p>
            </>
          )}

          {mode === "signup" && (
            <>
              <div className="auth-divider"><span>or</span></div>
              <p className="auth-switch">
                Already have an account?{" "}
                <button type="button" onClick={() => switchMode("login")}>
                  Sign in
                </button>
              </p>
            </>
          )}

          {mode === "forgot-password" && (
            <p className="auth-switch">
              Remember your password?{" "}
              <button type="button" onClick={() => switchMode("login")}>
                Sign in
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default AuthPage;
