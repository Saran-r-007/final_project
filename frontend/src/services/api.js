/**
 * API client for the Context-Aware Audio Intelligence & Emergency Detection Backend.
 * Connects to FastAPI on http://localhost:8000
 * Supports auth, history, emergency alerts, and all existing audio intelligence endpoints.
 */

const API_BASE = import.meta.env.VITE_API_BASE_URL || (
  window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
    ? "http://localhost:8000/api"
    : "https://final-project-s35o.onrender.com/api"
);

export function getMediaBase() {
  return API_BASE.replace(/\/api$/, "");
}

function getToken() {
  return localStorage.getItem("auth_token") || "";
}

function authHeaders() {
  return { Authorization: `Bearer ${getToken()}` };
}

async function handleResponse(res) {
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Request failed" }));
    throw new Error(err.detail || `Request failed with status ${res.status}`);
  }
  return res.json();
}

// ── Auth ─────────────────────────────────────────────────────────────────

export async function signup(username, email, password) {
  const res = await fetch(`${API_BASE}/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, email, password }),
  });
  return handleResponse(res);
}

export async function login(username, password) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  return handleResponse(res);
}

export async function logout() {
  const res = await fetch(`${API_BASE}/auth/logout`, {
    method: "POST",
    headers: { ...authHeaders() },
  });
  return handleResponse(res);
}

export async function getMe() {
  const res = await fetch(`${API_BASE}/auth/me`, {
    headers: { ...authHeaders() },
  });
  return handleResponse(res);
}

export async function forgotPassword(email) {
  const res = await fetch(`${API_BASE}/auth/forgot-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  return handleResponse(res);
}

export async function verifyOTP(email, code) {
  const res = await fetch(`${API_BASE}/auth/verify-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, code }),
  });
  return handleResponse(res);
}

export async function resetPassword(email, code, password) {
  const res = await fetch(`${API_BASE}/auth/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, code, password }),
  });
  return handleResponse(res);
}

// ── Profile & Settings ─────────────────────────────────────────────────

export async function getProfile() {
  const res = await fetch(`${API_BASE}/auth/profile`, {
    headers: { ...authHeaders() },
  });
  return handleResponse(res);
}

export async function updateProfile(data) {
  const res = await fetch(`${API_BASE}/auth/profile`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(data),
  });
  return handleResponse(res);
}

export async function changePassword(currentPassword, newPassword) {
  const res = await fetch(`${API_BASE}/auth/change-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
  });
  return handleResponse(res);
}

export async function getSettings() {
  const res = await fetch(`${API_BASE}/auth/settings`, {
    headers: { ...authHeaders() },
  });
  return handleResponse(res);
}

export async function updateSettings(data) {
  const res = await fetch(`${API_BASE}/auth/settings`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(data),
  });
  return handleResponse(res);
}

// ── History ──────────────────────────────────────────────────────────────

export async function getHistory() {
  const res = await fetch(`${API_BASE}/history`, {
    headers: { ...authHeaders() },
  });
  return handleResponse(res);
}

export async function deleteHistoryItem(itemId) {
  const res = await fetch(`${API_BASE}/history/${itemId}`, {
    method: "DELETE",
    headers: { ...authHeaders() },
  });
  return handleResponse(res);
}

// ── Emergency Alerts ─────────────────────────────────────────────────────

export async function triggerEmergencyAlert(alertType, details = "", phone = "", email = "") {
  const res = await fetch(`${API_BASE}/emergency/trigger`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ alert_type: alertType, details, contact_phone: phone, contact_email: email }),
  });
  return handleResponse(res);
}

export async function getEmergencyHistory() {
  const res = await fetch(`${API_BASE}/emergency/history`, {
    headers: { ...authHeaders() },
  });
  return handleResponse(res);
}

// ── Audio Intelligence (existing, now with auth) ─────────────────────────

export async function checkHealth() {
  const res = await fetch(`${API_BASE}/health`);
  if (!res.ok) throw new Error("Backend offline");
  return res.json();
}

export async function uploadAudioFile(file) {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`${API_BASE}/upload`, {
    method: "POST",
    headers: { ...authHeaders() },
    body: formData,
  });
  return handleResponse(res);
}

export async function startAnalysis(audioId) {
  const res = await fetch(`${API_BASE}/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ audio_id: audioId }),
  });
  return handleResponse(res);
}

export async function getJobStatus(jobId) {
  const res = await fetch(`${API_BASE}/status/${jobId}`);
  if (!res.ok) throw new Error("Status check failed");
  return res.json();
}

export async function getAnalysisResults(analysisId) {
  const res = await fetch(`${API_BASE}/results/${analysisId}`);
  if (!res.ok) throw new Error("Failed to load results");
  return res.json();
}

export async function getWaveformData(audioId, points = 200) {
  const res = await fetch(`${API_BASE}/waveform/${audioId}?points=${points}`);
  if (!res.ok) throw new Error("Failed to fetch waveform");
  return res.json();
}

export async function getSeparatedStems(audioId) {
  const res = await fetch(`${API_BASE}/stems/${audioId}`);
  if (!res.ok) throw new Error("Failed to fetch stems");
  return res.json();
}

export async function exportReport(analysisId, format = "json") {
  const res = await fetch(`${API_BASE}/export/${analysisId}?format=${format}`);
  if (!res.ok) throw new Error("Export failed");
  if (format === "txt") {
    return res.text();
  }
  return res.json();
}

export async function testNotification() {
  const res = await fetch(`${API_BASE}/notifications/test`, {
    method: "POST",
    headers: { ...authHeaders() },
  });
  if (!res.ok) throw new Error("Notification test failed");
  return res.json();
}

export async function configureNotifications(phone, email, mode) {
  const params = new URLSearchParams();
  if (phone) params.append("phone", phone);
  if (email) params.append("email", email);
  if (mode) params.append("mode", mode);

  const res = await fetch(`${API_BASE}/notifications/configure?${params.toString()}`, {
    method: "POST",
    headers: { ...authHeaders() },
  });
  return handleResponse(res);
}

export async function getNotificationConfig() {
  const res = await fetch(`${API_BASE}/notifications/config`, {
    headers: { ...authHeaders() },
  });
  return handleResponse(res);
}

export async function testSMS() {
  const res = await fetch(`${API_BASE}/notifications/test-sms`, {
    method: "POST",
    headers: { ...authHeaders() },
  });
  return handleResponse(res);
}

export async function testEmail() {
  const res = await fetch(`${API_BASE}/notifications/test-email`, {
    method: "POST",
    headers: { ...authHeaders() },
  });
  return handleResponse(res);
}

export async function downloadCSECSV() {
  const res = await fetch(`${API_BASE}/cse/export`, {
    headers: { ...authHeaders() },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "CSV export failed" }));
    throw new Error(err.detail || "CSV export failed");
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `emergency_incidents_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return true;
}

export async function deleteAudio(audioId) {
  const res = await fetch(`${API_BASE}/audio/${audioId}`, {
    method: "DELETE",
    headers: { ...authHeaders() },
  });
  return handleResponse(res);
}
