"""
FastAPI Audio Intelligence & Emergency Detection Backend.
Provides endpoints for auth, audio upload, multi-model analysis,
waveform generation, stem extraction, explainable reporting, history,
emergency alerts, and notification dispatch.
"""
import os
import re
import csv
import io
import json
import shutil
import uuid
import secrets
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, File, UploadFile, BackgroundTasks, HTTPException, Query, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse, PlainTextResponse, StreamingResponse
from pydantic import BaseModel, Field
from typing import Optional

from config import settings
import storage
from models import (
    JobStatus, HealthResponse, UploadResponse, AnalyzeRequest,
    JobResponse
)
from services.audio_processor import get_waveform_data
from services.pipeline import run_full_pipeline
from services.notification_service import dispatch_emergency_notification, SERVICE_CONTACTS, _classify_emergency_type, _get_service_contact


# ── Auth Dependency ────────────────────────────────────────────────────────

async def get_current_user(authorization: str = Header(None)) -> dict:
    if not authorization:
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = authorization.replace("Bearer ", "").strip()
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    user = await storage.get_user_by_session(token)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid or expired session")
    return user


# ── Request/Response Models ───────────────────────────────────────────────

class SignupRequest(BaseModel):
    username: str
    email: str
    password: str

class LoginRequest(BaseModel):
    username: str
    password: str

class ResetRequest(BaseModel):
    email: str

class ResetConfirmRequest(BaseModel):
    email: str
    code: str
    password: str

class EmergencyAlertRequest(BaseModel):
    alert_type: str
    details: str = ""
    contact_phone: str = ""
    contact_email: str = ""


@asynccontextmanager
async def lifespan(app: FastAPI):
    await storage.init_db()
    print("[Server] Database initialized.")
    print(f"[Server] Upload directory: {settings.upload_path}")
    print(f"[Server] Separated directory: {settings.separated_path}")
    print("\n[Server] Registered API routes:")
    for route in app.routes:
        if hasattr(route, "methods"):
            for method in route.methods:
                print(f"  {method:7s} {route.path}")
    print()
    yield


app = FastAPI(
    title="Context-Aware Audio Intelligence & Emergency Detection API",
    version="3.0.0",
    description="End-to-end deep learning audio understanding system with auth, history, emergency alerts, and notification dispatch.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/uploads", StaticFiles(directory=str(settings.upload_path)), name="uploads")
app.mount("/separated", StaticFiles(directory=str(settings.separated_path)), name="separated")


# ══════════════════════════════════════════════════════════════════════════
#  AUTH ENDPOINTS
# ══════════════════════════════════════════════════════════════════════════

@app.post("/api/auth/signup")
async def signup(payload: SignupRequest):
    username = payload.username.strip()
    email = payload.email.strip().lower()
    password = payload.password

    if len(username) < 3:
        raise HTTPException(status_code=400, detail="Username must be at least 3 characters.")
    if len(username) > 30:
        raise HTTPException(status_code=400, detail="Username must be at most 30 characters.")
    if not re.match(r'^[a-zA-Z0-9]+_[0-9]+$', username):
        raise HTTPException(
            status_code=400,
            detail="Username must follow the format Name_Number (e.g. Saran_123). Use letters, one underscore, then numbers. No other special characters allowed."
        )
    if not re.match(r'^[^@\s]+@[^@\s]+\.[^@\s]+$', email):
        raise HTTPException(status_code=400, detail="Invalid email format. Please use a valid Gmail or email address.")
    if len(password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters.")

    existing_user = await storage.get_user_by_username(username)
    if existing_user:
        raise HTTPException(status_code=409, detail="Username already taken. Please choose another username.")
    existing_email = await storage.get_user_by_email(email)
    if existing_email:
        raise HTTPException(status_code=409, detail="Email already registered. Please login or use a different email.")

    user_id = await storage.create_user(username, email, password)
    token = await storage.create_session(user_id)
    user = await storage.get_user(user_id)

    return {
        "token": token,
        "user": {"id": user["id"], "username": user["username"], "email": user["email"]},
        "message": "Account created successfully."
    }


@app.post("/api/auth/login")
async def login(payload: LoginRequest):
    identifier = payload.username.strip()
    password = payload.password

    user = await storage.get_user_by_username(identifier)
    if not user:
        user = await storage.get_user_by_email(identifier)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid username/email or password.")

    pwd_hash, _ = storage.hash_password(password, user["salt"])
    if pwd_hash != user["password_hash"]:
        raise HTTPException(status_code=401, detail="Invalid username/email or password.")

    token = await storage.create_session(user["id"])
    return {
        "token": token,
        "user": {"id": user["id"], "username": user["username"], "email": user["email"]},
        "message": "Logged in successfully."
    }


@app.post("/api/auth/logout")
async def logout(user: dict = Depends(get_current_user), authorization: str = Header(None)):
    token = authorization.replace("Bearer ", "").strip()
    await storage.delete_session(token)
    return {"message": "Logged out successfully."}


@app.get("/api/auth/me")
async def get_me(user: dict = Depends(get_current_user)):
    return {"id": user["id"], "username": user["username"], "email": user["email"]}


@app.post("/api/auth/forgot-password")
async def forgot_password(payload: ResetRequest):
    email = payload.email.strip().lower()
    user = await storage.get_user_by_email(email)
    if not user:
        raise HTTPException(status_code=404, detail="Email not found. Please check your email or create an account.")

    code = str(secrets.randbelow(900000) + 100000)
    await storage.set_user_reset_code(email, code, expiry_seconds=600)

    from services.notification_service import _send_smtp_email
    result = _send_smtp_email(
        to_email=email,
        subject="AudioMind - Password Reset Code",
        body=f"Your password reset code is: {code}\n\nThis code expires in 10 minutes.\nIf you did not request this, ignore this email.",
        html_body=f"""<html><body style="font-family:sans-serif;padding:20px;">
<h2>Password Reset</h2>
<p>Your verification code is:</p>
<div style="font-size:28px;font-weight:bold;letter-spacing:6px;background:#f1f5f9;padding:16px 24px;border-radius:8px;text-align:center;color:#4f46e5;margin:16px 0;">{code}</div>
<p style="color:#64748b;">This code expires in <strong>10 minutes</strong>.</p>
<p style="color:#64748b;">If you did not request a password reset, you can safely ignore this email.</p>
</body></html>"""
    )

    if result.get("success"):
        print(f"[Auth] OTP sent successfully to {email}")
        return {"message": "OTP sent successfully. Check your email inbox.", "email": email}
    else:
        error_msg = result.get("error", "Unknown error")
        print(f"[Auth] OTP email FAILED to {email}: {error_msg}")
        print(f"[Auth] Full result: {result}")
        raise HTTPException(status_code=500, detail=error_msg)


@app.post("/api/auth/verify-otp")
async def verify_otp(payload: dict):
    email = payload.get("email", "").strip().lower()
    code = payload.get("code", "").strip()

    if not email or not code:
        raise HTTPException(status_code=400, detail="Email and code are required.")

    user = await storage.get_user_by_email(email)
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    if user.get("reset_code") != code:
        raise HTTPException(status_code=400, detail="Invalid OTP code.")

    if user.get("reset_code_used"):
        raise HTTPException(status_code=400, detail="This code has already been used. Please request a new one.")

    import time
    expiry = user.get("reset_code_expiry")
    if expiry and time.time() > expiry:
        raise HTTPException(status_code=400, detail="OTP has expired. Please request a new code.")

    await storage.mark_otp_used(email)
    return {"message": "OTP verified successfully. You can now set a new password.", "email": email}


@app.post("/api/auth/reset-password")
async def reset_password(payload: ResetConfirmRequest):
    email = payload.email.strip().lower()
    code = payload.code.strip()
    password = payload.password

    if len(password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters.")

    user = await storage.get_user_by_email(email)
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    if not user.get("reset_code_used"):
        raise HTTPException(status_code=400, detail="OTP not verified. Please verify your OTP first.")

    if user.get("reset_code") != code:
        raise HTTPException(status_code=400, detail="Invalid reset code.")

    await storage.update_user_password(user["id"], password, reset_code=code)
    return {"message": "Password reset successfully. You can now log in with your new password."}


# ══════════════════════════════════════════════════════════════════════════
#  PROFILE & SETTINGS ENDPOINTS
# ══════════════════════════════════════════════════════════════════════════

class ProfileUpdateRequest(BaseModel):
    username: Optional[str] = None
    email: Optional[str] = None

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

class SettingsUpdateRequest(BaseModel):
    emergency_phone: Optional[str] = None
    emergency_email: Optional[str] = None
    notification_mode: Optional[str] = None


@app.get("/api/auth/profile")
async def get_profile(user: dict = Depends(get_current_user)):
    settings_data = await storage.get_user_settings(user["id"])
    return {
        "id": user["id"],
        "username": user["username"],
        "email": user["email"],
        "created_at": user.get("created_at"),
        "emergency_phone": settings_data.get("emergency_phone", ""),
        "emergency_email": settings_data.get("emergency_email", ""),
        "notification_mode": settings_data.get("notification_mode", "SIMULATION"),
    }


@app.put("/api/auth/profile")
async def update_profile(payload: ProfileUpdateRequest, user: dict = Depends(get_current_user)):
    if payload.username is not None:
        username = payload.username.strip()
        if len(username) < 3:
            raise HTTPException(status_code=400, detail="Username must be at least 3 characters.")
        if len(username) > 30:
            raise HTTPException(status_code=400, detail="Username must be at most 30 characters.")
        if not re.match(r'^[a-zA-Z0-9]+_[0-9]+$', username):
            raise HTTPException(
                status_code=400,
                detail="Username must follow the format Name_Number (e.g. Saran_123). Use letters, one underscore, then numbers."
            )
        existing = await storage.get_user_by_username(username)
        if existing and existing["id"] != user["id"]:
            raise HTTPException(status_code=409, detail="Username already taken. Please choose another username.")
        await storage.update_user_profile(user["id"], username=username)

    if payload.email is not None:
        email = payload.email.strip().lower()
        if not re.match(r'^[^@\s]+@[^@\s]+\.[^@\s]+$', email):
            raise HTTPException(status_code=400, detail="Invalid email format.")
        existing = await storage.get_user_by_email(email)
        if existing and existing["id"] != user["id"]:
            raise HTTPException(status_code=409, detail="Email already registered.")
        await storage.update_user_profile(user["id"], email=email)

    updated = await storage.get_user(user["id"])
    return {
        "id": updated["id"],
        "username": updated["username"],
        "email": updated["email"],
        "message": "Profile updated successfully.",
    }


@app.post("/api/auth/change-password")
async def change_password(payload: ChangePasswordRequest, user: dict = Depends(get_current_user)):
    pwd_hash, _ = storage.hash_password(payload.current_password, user["salt"])
    if pwd_hash != user["password_hash"]:
        raise HTTPException(status_code=400, detail="Current password is incorrect.")
    if len(payload.new_password) < 6:
        raise HTTPException(status_code=400, detail="New password must be at least 6 characters.")
    await storage.change_user_password(user["id"], payload.new_password)
    return {"message": "Password changed successfully."}


@app.get("/api/auth/settings")
async def get_user_notification_settings(user: dict = Depends(get_current_user)):
    settings_data = await storage.get_user_settings(user["id"])
    return settings_data


@app.put("/api/auth/settings")
async def update_user_notification_settings(payload: SettingsUpdateRequest, user: dict = Depends(get_current_user)):
    await storage.update_user_settings(
        user["id"],
        emergency_phone=payload.emergency_phone,
        emergency_email=payload.emergency_email,
        notification_mode=payload.notification_mode,
    )
    return {"message": "Settings updated successfully."}


# ══════════════════════════════════════════════════════════════════════════
#  HISTORY & REPORTS ENDPOINTS
# ══════════════════════════════════════════════════════════════════════════

@app.get("/api/history")
async def get_history(user: dict = Depends(get_current_user)):
    history = await storage.get_user_history(user["id"])
    return {"history": history, "count": len(history)}


@app.delete("/api/history/{item_id}")
async def delete_history_item(item_id: str, user: dict = Depends(get_current_user)):
    # Try audio record first
    record = await storage.get_audio_record(item_id)
    if record and record.get("user_id") == user["id"]:
        if os.path.exists(record["stored_path"]):
            try:
                os.remove(record["stored_path"])
            except Exception:
                pass
        stems_dir = settings.separated_path / item_id
        if stems_dir.exists():
            shutil.rmtree(stems_dir, ignore_errors=True)
        await storage.delete_audio_record(item_id)
        return {"status": "deleted", "id": item_id, "type": "audio_record"}

    # Try emergency event
    deleted = await storage.delete_emergency_event(item_id, user["id"])
    if deleted:
        return {"status": "deleted", "id": item_id, "type": "emergency_event"}

    raise HTTPException(status_code=404, detail="Item not found or not authorized.")


# ══════════════════════════════════════════════════════════════════════════
#  CSE/CSV EXPORT ENDPOINTS
# ══════════════════════════════════════════════════════════════════════════

@app.get("/api/cse/export")
async def export_cse_csv(user: dict = Depends(get_current_user)):
    """Generate and return a CSV file with all emergency and audio incident records from the DB."""
    import datetime

    rows = []

    # 1. Get manual emergency events
    emergency_events = await storage.get_all_emergency_events_for_user(user["id"])
    for ev in emergency_events:
        ts = ev.get("created_at", 0)
        if isinstance(ts, (int, float)) and ts > 0:
            dt = datetime.datetime.fromtimestamp(ts)
            date_str = dt.strftime("%d-%m-%Y")
            time_str = dt.strftime("%H:%M:%S")
        else:
            date_str = ""
            time_str = ""

        rows.append({
            "Incident ID": ev.get("id", ""),
            "Date": date_str,
            "Time": time_str,
            "Emergency Type": ev.get("service_label") or ev.get("alert_type", ""),
            "Detected Problem": ev.get("detected_problem") or ev.get("details", ""),
            "Service": ev.get("service_label", ""),
            "Contact Number": ev.get("service_contact", ev.get("contact_phone", "")),
            "Email Status": ev.get("email_status", "PENDING"),
            "SMS Status": ev.get("sms_status", "PENDING"),
            "Error Message": ev.get("error_message", ""),
        })

    # 2. Get audio uploads that had emergency detections
    async with storage.aiosqlite.connect(storage.DB_PATH) as db:
        db.row_factory = storage.aiosqlite.Row
        cursor = await db.execute("""
            SELECT a.id, a.original_filename, a.created_at, a.user_id,
                   ar.report_json
            FROM audio_records a
            LEFT JOIN analysis_results ar ON a.id = ar.audio_id
            WHERE a.user_id = ?
            ORDER BY a.created_at DESC
        """, (user["id"],))
        audio_rows = await cursor.fetchall()

        for row in audio_rows:
            d = dict(row)
            report_json = d.get("report_json")
            if not report_json:
                continue
            try:
                report = json.loads(report_json)
            except Exception:
                continue

            risk_score = report.get("risk_score", {})
            emergency_analysis = report.get("emergency_analysis", {})
            is_emergency = emergency_analysis.get("is_emergency", False)
            notification_status = report.get("notification_status", {})

            if not is_emergency:
                continue  # Only include audio uploads that had emergency detection

            ts = d.get("created_at", 0)
            if isinstance(ts, (int, float)) and ts > 0:
                dt = datetime.datetime.fromtimestamp(ts)
                date_str = dt.strftime("%d-%m-%Y")
                time_str = dt.strftime("%H:%M:%S")
            else:
                date_str = ""
                time_str = ""

            emergency_types = emergency_analysis.get("emergency_types", [])
            detected_problem = ", ".join([t.get("type", "") for t in emergency_types]) if emergency_types else "Emergency detected"

            # Classify service from emergency types
            from services.notification_service import _classify_emergency_type, _get_service_contact
            emg_cat = _classify_emergency_type(emergency_types) if emergency_types else "medical"
            service = _get_service_contact(emg_cat)

            email_result = notification_status.get("email_result", {})
            sms_result = notification_status.get("sms", {})
            email_status = "SENT" if email_result.get("success") else "FAILED"
            sms_status = "SENT" if sms_result.get("success") else ("NOT_SENT" if notification_status.get("mode") != "LIVE" else "FAILED")

            error_msg = ""
            if not email_result.get("success"):
                error_msg = email_result.get("error", "")
            if not sms_result.get("success") and notification_status.get("mode") == "LIVE":
                sms_err = sms_result.get("error", "")
                error_msg = (error_msg + "; " + sms_err) if error_msg else sms_err

            rows.append({
                "Incident ID": d["id"],
                "Date": date_str,
                "Time": time_str,
                "Emergency Type": service.get("label", ""),
                "Detected Problem": detected_problem,
                "Service": service.get("label", ""),
                "Contact Number": service.get("phone", ""),
                "Email Status": email_status,
                "SMS Status": sms_status,
                "Error Message": error_msg,
            })

    if not rows:
        raise HTTPException(status_code=404, detail="No emergency incident records to export.")

    # Sort by date descending
    rows.sort(key=lambda r: r.get("Date", ""), reverse=True)

    fieldnames = [
        "Incident ID", "Date", "Time", "Emergency Type", "Detected Problem",
        "Service", "Contact Number", "Email Status", "SMS Status", "Error Message",
    ]

    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=fieldnames)
    writer.writeheader()
    for row in rows:
        writer.writerow(row)

    output.seek(0)
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode("utf-8-sig")),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=emergency_incidents_{user['id']}.csv"},
    )


# ══════════════════════════════════════════════════════════════════════════
#  SMS / EMAIL TEST ENDPOINTS
# ══════════════════════════════════════════════════════════════════════════

@app.get("/api/notifications/config")
async def get_notification_config(user: dict = Depends(get_current_user)):
    """Return safe notification config (no secrets)."""
    user_settings = await storage.get_user_settings(user["id"])
    
    # Check email provider status
    email_configured = bool(settings.smtp_host and settings.smtp_username and settings.smtp_password)
    sms_configured = bool(settings.twilio_account_sid and settings.twilio_auth_token and settings.twilio_from_number)
    
    # Detailed status messages
    email_status = "Configured" if email_configured else "Not configured (SMTP credentials missing)"
    sms_status = "Configured" if sms_configured else "Not configured (Twilio credentials missing)"
    
    if sms_configured:
        from_number = settings.twilio_from_number.strip()
        if from_number.startswith("+91"):
            sms_status = "Configured but Indian numbers require paid Twilio account (trial accounts blocked by TRAI/DLT regulations)"
        elif not settings.twilio_account_sid.startswith("AC"):
            sms_status = "Configured but Account SID format invalid (must start with AC)"
    
    return {
        "notification_phone": user_settings.get("emergency_phone") or settings.notification_phone,
        "notification_email": user_settings.get("emergency_email") or settings.notification_email,
        "notification_mode": user_settings.get("notification_mode") or settings.notification_mode,
        "sms_configured": sms_configured,
        "email_configured": email_configured,
        "sms_status": sms_status,
        "email_status": email_status,
        "service_contacts": SERVICE_CONTACTS,
    }


@app.post("/api/notifications/test-sms")
async def test_sms(user: dict = Depends(get_current_user)):
    """Test SMS delivery. Returns real status."""
    if not all([settings.twilio_account_sid, settings.twilio_auth_token, settings.twilio_from_number]):
        raise HTTPException(
            status_code=400,
            detail="Twilio SMS credentials not configured. Required: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER in backend/.env"
        )
    user_settings = await storage.get_user_settings(user["id"])
    phone = user_settings.get("emergency_phone") or settings.notification_phone
    try:
        from services.notification_service import _send_twilio_sms
        result = _send_twilio_sms(phone, "AudioMind SMS Test: Emergency notification system is operational.")
        if result.get("success"):
            return {"success": True, "message": f"Test SMS sent to {phone}", "sid": result.get("sid")}
        else:
            raise HTTPException(status_code=500, detail=f"SMS failed: {result.get('error', 'Unknown error')}")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"SMS test failed: {str(e)}")


@app.post("/api/notifications/test-email")
async def test_email(user: dict = Depends(get_current_user)):
    """Test email delivery. Returns real status."""
    if not all([settings.smtp_host, settings.smtp_username, settings.smtp_password]):
        raise HTTPException(
            status_code=400,
            detail="SMTP email credentials not configured. Required: SMTP_HOST, SMTP_USERNAME, SMTP_PASSWORD in backend/.env"
        )
    user_settings = await storage.get_user_settings(user["id"])
    email = user_settings.get("emergency_email") or settings.notification_email
    try:
        from services.notification_service import _send_smtp_email
        result = _send_smtp_email(
            email,
            "[AudioMind] Test Email - Notification System Check",
            "This is a test email from AudioMind Emergency Detection System.\nIf you received this, email notifications are working correctly.",
        )
        if result.get("success"):
            return {"success": True, "message": f"Test email sent to {email}"}
        else:
            raise HTTPException(status_code=500, detail=f"Email failed: {result.get('error', 'Unknown error')}")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Email test failed: {str(e)}")


# ══════════════════════════════════════════════════════════════════════════
#  EMERGENCY ALERTS ENDPOINTS
# ══════════════════════════════════════════════════════════════════════════

@app.post("/api/emergency/trigger")
async def trigger_emergency_alert(
    payload: EmergencyAlertRequest,
    user: dict = Depends(get_current_user)
):
    valid_types = ["medical", "police", "fire"]
    alert_type = payload.alert_type.strip().lower()
    if alert_type not in valid_types:
        raise HTTPException(status_code=400, detail=f"Invalid alert type. Must be one of: {', '.join(valid_types)}")

    user_settings = await storage.get_user_settings(user["id"])
    phone = payload.contact_phone or user_settings.get("emergency_phone") or settings.notification_phone
    email = payload.contact_email or user_settings.get("emergency_email") or settings.notification_email
    notif_mode = user_settings.get("notification_mode") or settings.notification_mode

    type_labels = {
        "medical": "Medical / Ambulance",
        "police": "Police",
        "fire": "Fire / Rescue"
    }
    label = type_labels.get(alert_type, alert_type.title())

    test_score = {"score": 100, "severity": "CRITICAL", "explanation": f"Manual {label} alert triggered by user."}
    test_emergency = {"emergency_types": [{"type": label, "confidence": 1.0}]}

    notif_result = dispatch_emergency_notification(
        test_score, test_emergency, f"manual_{alert_type}_alert.wav",
        mode=notif_mode, phone=phone, email=email
    )

    service = _get_service_contact(alert_type)
    email_status = "FAILED"
    sms_status = "NOT_SENT"
    email_msg_id = ""
    sms_id = ""
    err_msg = ""

    if notif_result.get("email_result", {}).get("success"):
        email_status = "SENT"
        email_msg_id = notif_result.get("email_detail", "")
    else:
        email_status = "FAILED"
        err_msg = notif_result.get("email_result", {}).get("error", "")

    if notif_mode == "LIVE":
        if notif_result.get("sms", {}).get("success"):
            sms_status = "SENT"
            sms_id = notif_result.get("sms_sid", "")
        else:
            sms_status = "FAILED"
            sms_err = notif_result.get("sms", {}).get("error", "")
            err_msg = (err_msg + "; " + sms_err) if err_msg else sms_err
    else:
        sms_status = "NOT_SENT"

    event_id = await storage.create_emergency_event(
        user_id=user["id"],
        alert_type=alert_type,
        details=payload.details or f"Emergency {label} alert triggered manually.",
        phone=phone,
        email=email,
        status="DISPATCHED",
        detected_problem=f"Manual {label} alert triggered by user.",
        service_label=label,
        service_contact=service["phone"],
        email_status=email_status,
        sms_status=sms_status,
        email_message_id=email_msg_id,
        sms_sid=sms_id,
        error_message=err_msg,
    )

    return {
        "event_id": event_id,
        "alert_type": alert_type,
        "label": label,
        "notification": notif_result,
        "message": f"{label} emergency alert dispatched successfully."
    }


@app.get("/api/emergency/history")
async def get_emergency_history(user: dict = Depends(get_current_user)):
    async with storage.aiosqlite.connect(storage.DB_PATH) as db:
        db.row_factory = storage.aiosqlite.Row
        cursor = await db.execute(
            "SELECT * FROM emergency_events WHERE user_id = ? ORDER BY created_at DESC",
            (user["id"],)
        )
        rows = await cursor.fetchall()
        events = []
        for r in rows:
            d = dict(r)
            events.append({
                "id": d["id"],
                "type": d["alert_type"],
                "details": d.get("details", ""),
                "detected_problem": d.get("detected_problem", ""),
                "service_label": d.get("service_label", ""),
                "service_contact": d.get("service_contact", ""),
                "phone": d.get("contact_phone", ""),
                "email": d.get("contact_email", ""),
                "status": d.get("status", "DISPATCHED"),
                "email_status": d.get("email_status", "PENDING"),
                "sms_status": d.get("sms_status", "PENDING"),
                "email_message_id": d.get("email_message_id", ""),
                "sms_sid": d.get("sms_sid", ""),
                "error_message": d.get("error_message", ""),
                "timestamp": d.get("created_at", 0),
            })
        return {"events": events}


# ══════════════════════════════════════════════════════════════════════════
#  EXISTING AUDIO INTELLIGENCE ENDPOINTS (PRESERVED)
# ══════════════════════════════════════════════════════════════════════════

@app.get("/api/health", response_model=HealthResponse)
async def health_check():
    models = {"whisper": "available"}
    # Check AST
    try:
        import importlib
        importlib.import_module("services.sound_classifier")
        models["ast"] = "available"
    except Exception:
        models["ast"] = "unavailable"
    # Check Demucs
    import shutil as _shutil
    models["demucs"] = "available" if _shutil.which("demucs") else "unavailable (subprocess)"
    # Check Gemini
    models["gemini"] = "configured" if (settings.gemini_api_key and not settings.gemini_api_key.startswith("your_")) else "not configured"
    return HealthResponse(
        status="ok",
        models_loaded=models
    )


@app.post("/api/upload", response_model=UploadResponse)
async def upload_audio(file: UploadFile = File(...), user: dict = Depends(get_current_user)):
    allowed_exts = {".wav", ".mp3", ".ogg", ".flac", ".m4a", ".webm", ".aac"}
    orig_ext = Path(file.filename).suffix.lower() if file.filename else ".wav"
    if orig_ext not in allowed_exts:
        orig_ext = ".wav"

    unique_id = uuid.uuid4().hex[:12]
    saved_filename = f"{unique_id}_{file.filename or 'recording.wav'}"
    target_path = settings.upload_path / saved_filename

    try:
        with open(target_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save upload: {e}")

    file_size = target_path.stat().st_size
    fmt = orig_ext.lstrip(".")

    audio_id = await storage.create_audio_record(
        filename=file.filename or "microphone_recording.wav",
        stored_path=str(target_path),
        fmt=fmt,
        size=file_size,
        user_id=user["id"],
    )

    return UploadResponse(
        audio_id=audio_id,
        filename=file.filename or "recording.wav",
        format=fmt,
        size_bytes=file_size,
        message="Audio uploaded and ready for analysis."
    )


@app.post("/api/analyze", response_model=JobResponse)
async def start_analysis(payload: AnalyzeRequest, background_tasks: BackgroundTasks, user: dict = Depends(get_current_user)):
    record = await storage.get_audio_record(payload.audio_id)
    if not record:
        raise HTTPException(status_code=404, detail="Audio file not found.")

    job_id = await storage.create_job(payload.audio_id)
    background_tasks.add_task(run_full_pipeline, job_id, payload.audio_id, user["id"])

    return JobResponse(
        job_id=job_id,
        audio_id=payload.audio_id,
        status=JobStatus.PENDING,
        progress=0,
        current_step="Queued for multi-model processing...",
    )


@app.get("/api/status/{job_id}", response_model=JobResponse)
async def check_job_status(job_id: str):
    job = await storage.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")

    return JobResponse(
        job_id=job["id"],
        audio_id=job["audio_id"],
        status=JobStatus(job["status"]),
        progress=job["progress"],
        current_step=job.get("current_step", ""),
        analysis_id=job.get("analysis_id"),
        error=job.get("error"),
    )


@app.get("/api/results/{analysis_id}")
async def get_analysis_results(analysis_id: str):
    res = await storage.get_analysis(analysis_id)
    if not res:
        raise HTTPException(status_code=404, detail="Analysis report not found.")
    return res["report"]


@app.get("/api/waveform/{audio_id}")
async def get_waveform(audio_id: str, points: int = Query(200, ge=50, le=1000)):
    record = await storage.get_audio_record(audio_id)
    if not record:
        raise HTTPException(status_code=404, detail="Audio record not found.")

    stored_path = record["stored_path"]
    if not os.path.exists(stored_path):
        raise HTTPException(status_code=404, detail="Audio file missing on disk.")

    wf = get_waveform_data(stored_path, num_points=points)
    return {"audio_id": audio_id, "points": wf, "count": len(wf)}


@app.get("/api/stems/{audio_id}")
async def get_separated_stems(audio_id: str):
    stem_dir = settings.separated_path / audio_id
    if not stem_dir.exists():
        return {"audio_id": audio_id, "performed": False, "stems": [], "message": "No separated stems available."}

    stems = []
    for f in stem_dir.iterdir():
        if f.is_file() and f.suffix.lower() in [".mp3", ".wav"]:
            stems.append({
                "name": f.stem.replace("_", " ").title(),
                "type": f.stem,
                "url": f"/separated/{audio_id}/{f.name}",
                "filename": f.name,
            })

    return {"audio_id": audio_id, "performed": len(stems) > 0, "stems": stems}


@app.get("/api/export/{analysis_id}")
async def export_analysis(analysis_id: str, format: str = Query("json", enum=["json", "txt"])):
    res = await storage.get_analysis(analysis_id)
    if not res:
        raise HTTPException(status_code=404, detail="Analysis report not found.")

    report = res["report"]

    if format == "txt":
        txt_content = (
            f"==========================================================\n"
            f"  CONTEXT-AWARE AUDIO INTELLIGENCE & EMERGENCY REPORT\n"
            f"==========================================================\n\n"
            f"File: {report.get('audio_info', {}).get('filename', 'Unknown')}\n"
            f"Duration: {report.get('audio_info', {}).get('duration', 0)}s\n"
            f"Risk Score: {report.get('risk_score', {}).get('score', 0)}/100 ({report.get('risk_score', {}).get('severity', 'PEACEFUL')})\n"
            f"Explanation: {report.get('risk_score', {}).get('explanation', '')}\n\n"
            f"----------------------------------------------------------\n"
            f"  SPEECH & TRANSCRIPT\n"
            f"----------------------------------------------------------\n"
            f"{report.get('speech_to_text') or '[No speech detected]'}\n\n"
            f"----------------------------------------------------------\n"
            f"  DETECTED SOUND EVENTS\n"
            f"----------------------------------------------------------\n"
        )
        for s in report.get("individual_events", []):
            txt_content += f"- {s.get('label')} (Confidence: {s.get('confidence', 0):.1%}, Category: {s.get('category')})\n"

        txt_content += (
            f"\n----------------------------------------------------------\n"
            f"  FINAL AI SUMMARY\n"
            f"----------------------------------------------------------\n"
            f"{report.get('final_ai_summary', '')}\n"
        )
        return PlainTextResponse(txt_content, media_type="text/plain")

    return JSONResponse(content=report)


@app.post("/api/notifications/test")
async def test_notification(user: dict = Depends(get_current_user)):
    user_settings = await storage.get_user_settings(user["id"])
    test_phone = user_settings.get("emergency_phone") or settings.notification_phone
    test_email = user_settings.get("emergency_email") or settings.notification_email
    test_mode = user_settings.get("notification_mode") or settings.notification_mode

    test_score = {"score": 85, "severity": "CRITICAL", "explanation": "Manual test notification dispatch from user dashboard."}
    test_emergency = {"emergency_types": [{"type": "Simulated Alert Test", "confidence": 1.0}]}
    res = dispatch_emergency_notification(
        test_score, test_emergency, "manual_test.wav",
        mode=test_mode, phone=test_phone, email=test_email
    )
    return res


@app.post("/api/notifications/configure")
async def configure_notifications(
    phone: str = Query(None), email: str = Query(None), mode: str = Query(None),
    user: dict = Depends(get_current_user)
):
    if phone:
        settings.notification_phone = phone
    if email:
        settings.notification_email = email
    if mode:
        settings.notification_mode = mode.upper()

    # Also persist to user_settings in DB
    await storage.update_user_settings(
        user["id"],
        emergency_phone=phone,
        emergency_email=email,
        notification_mode=mode.upper() if mode else None,
    )

    return {
        "phone": phone or settings.notification_phone,
        "email": email or settings.notification_email,
        "mode": (mode or settings.notification_mode).upper() if mode else settings.notification_mode,
        "message": "Notification preferences updated."
    }


@app.delete("/api/audio/{audio_id}")
async def delete_audio(audio_id: str):
    record = await storage.get_audio_record(audio_id)
    if not record:
        raise HTTPException(status_code=404, detail="Record not found.")

    if os.path.exists(record["stored_path"]):
        try:
            os.remove(record["stored_path"])
        except Exception:
            pass

    stems_dir = settings.separated_path / audio_id
    if stems_dir.exists():
        shutil.rmtree(stems_dir, ignore_errors=True)

    await storage.delete_audio_record(audio_id)
    return {"status": "deleted", "audio_id": audio_id}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
