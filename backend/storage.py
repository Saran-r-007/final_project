"""
SQLite-backed storage for audio records, jobs, analysis results, users, sessions, and emergency events.
Uses aiosqlite for async operations within FastAPI.
"""
import aiosqlite
import json
import time
import uuid
import hashlib
import secrets
from pathlib import Path
from config import settings
from services.notification_service import _classify_emergency_type, _get_service_contact

DB_PATH = str(settings.db_path)


async def init_db():
    """Create tables if they don't exist."""
    async with aiosqlite.connect(DB_PATH) as db:
        # Create users table
        await db.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                username TEXT UNIQUE NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                salt TEXT NOT NULL,
                reset_code TEXT,
                reset_code_expiry REAL,
                reset_code_used INTEGER DEFAULT 0,
                created_at REAL NOT NULL
            )
        """)
        # Create sessions table
        await db.execute("""
            CREATE TABLE IF NOT EXISTS sessions (
                token TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                expires_at REAL NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        """)
        # Create emergency_events table
        await db.execute("""
            CREATE TABLE IF NOT EXISTS emergency_events (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                alert_type TEXT NOT NULL,
                details TEXT,
                contact_phone TEXT,
                contact_email TEXT,
                status TEXT NOT NULL,
                created_at REAL NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        """)
        # Create original tables
        await db.execute("""
            CREATE TABLE IF NOT EXISTS audio_records (
                id TEXT PRIMARY KEY,
                original_filename TEXT NOT NULL,
                stored_path TEXT NOT NULL,
                format TEXT,
                duration REAL,
                file_size INTEGER,
                status TEXT DEFAULT 'UPLOADED',
                created_at REAL
            )
        """)
        await db.execute("""
            CREATE TABLE IF NOT EXISTS jobs (
                id TEXT PRIMARY KEY,
                audio_id TEXT NOT NULL,
                status TEXT DEFAULT 'PENDING',
                progress INTEGER DEFAULT 0,
                current_step TEXT DEFAULT '',
                analysis_id TEXT,
                error TEXT,
                created_at REAL,
                updated_at REAL,
                FOREIGN KEY (audio_id) REFERENCES audio_records(id)
            )
        """)
        await db.execute("""
            CREATE TABLE IF NOT EXISTS analysis_results (
                id TEXT PRIMARY KEY,
                audio_id TEXT NOT NULL,
                report_json TEXT,
                created_at REAL,
                FOREIGN KEY (audio_id) REFERENCES audio_records(id)
            )
        """)

        # Create user_settings table for notification preferences
        await db.execute("""
            CREATE TABLE IF NOT EXISTS user_settings (
                user_id TEXT PRIMARY KEY,
                emergency_phone TEXT DEFAULT '',
                emergency_email TEXT DEFAULT '',
                notification_mode TEXT DEFAULT 'SIMULATION',
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        """)

        # Schema migration: check if user_id exists in audio_records
        cursor = await db.execute("PRAGMA table_info(audio_records)")
        columns = [row[1] for row in await cursor.fetchall()]
        if "user_id" not in columns:
            await db.execute("ALTER TABLE audio_records ADD COLUMN user_id TEXT")

        # Schema migration: add missing columns to users table
        cursor = await db.execute("PRAGMA table_info(users)")
        user_columns = [row[1] for row in await cursor.fetchall()]
        if "reset_code_expiry" not in user_columns:
            await db.execute("ALTER TABLE users ADD COLUMN reset_code_expiry REAL")
        if "reset_code_used" not in user_columns:
            await db.execute("ALTER TABLE users ADD COLUMN reset_code_used INTEGER DEFAULT 0")

        # Schema migration: add missing columns to emergency_events
        cursor = await db.execute("PRAGMA table_info(emergency_events)")
        ee_columns = [row[1] for row in await cursor.fetchall()]
        ee_migrations = {
            "detected_problem": "TEXT DEFAULT ''",
            "service_label": "TEXT DEFAULT ''",
            "service_contact": "TEXT DEFAULT ''",
            "email_status": "TEXT DEFAULT 'PENDING'",
            "sms_status": "TEXT DEFAULT 'PENDING'",
            "email_message_id": "TEXT DEFAULT ''",
            "sms_sid": "TEXT DEFAULT ''",
            "error_message": "TEXT DEFAULT ''",
        }
        for col_name, col_def in ee_migrations.items():
            if col_name not in ee_columns:
                await db.execute(f"ALTER TABLE emergency_events ADD COLUMN {col_name} {col_def}")

        await db.commit()


# ── Password Hashing Helpers ──────────────────────────────────────────────

def hash_password(password: str, salt: str = None) -> tuple[str, str]:
    if not salt:
        salt = secrets.token_hex(16)
    pwd_bytes = password.encode('utf-8')
    salt_bytes = salt.encode('utf-8')
    h = hashlib.pbkdf2_hmac('sha256', pwd_bytes, salt_bytes, 100000)
    return h.hex(), salt


# ── User Operations ───────────────────────────────────────────────────────

async def create_user(username: str, email: str, password: str) -> str:
    user_id = uuid.uuid4().hex[:12]
    p_hash, salt = hash_password(password)
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "INSERT INTO users (id, username, email, password_hash, salt, created_at) VALUES (?, ?, ?, ?, ?, ?)",
            (user_id, username.strip(), email.strip().lower(), p_hash, salt, time.time())
        )
        await db.commit()
    return user_id


async def get_user(user_id: str) -> dict | None:
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute("SELECT * FROM users WHERE id = ?", (user_id,))
        row = await cursor.fetchone()
        return dict(row) if row else None


async def get_user_by_username(username: str) -> dict | None:
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute("SELECT * FROM users WHERE username = ?", (username.strip(),))
        row = await cursor.fetchone()
        return dict(row) if row else None


async def get_user_by_email(email: str) -> dict | None:
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute("SELECT * FROM users WHERE email = ?", (email.strip().lower(),))
        row = await cursor.fetchone()
        return dict(row) if row else None


async def update_user_password(user_id: str, password: str, reset_code: str = None):
    p_hash, salt = hash_password(password)
    async with aiosqlite.connect(DB_PATH) as db:
        if reset_code:
            await db.execute(
                "UPDATE users SET password_hash = ?, salt = ?, reset_code = NULL, reset_code_expiry = NULL, reset_code_used = 0 WHERE id = ? AND reset_code = ?",
                (p_hash, salt, user_id, reset_code)
            )
        else:
            await db.execute(
                "UPDATE users SET password_hash = ?, salt = ? WHERE id = ?",
                (p_hash, salt, user_id)
            )
        await db.commit()


async def set_user_reset_code(email: str, code: str, expiry_seconds: int = 600):
    """Store reset code with 10-minute expiry and mark as unused."""
    import time
    expiry = time.time() + expiry_seconds
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "UPDATE users SET reset_code = ?, reset_code_expiry = ?, reset_code_used = 0 WHERE email = ?",
            (code, expiry, email.strip().lower())
        )
        await db.commit()


async def mark_otp_used(email: str):
    """Mark the OTP as used so it cannot be reused."""
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "UPDATE users SET reset_code_used = 1 WHERE email = ?",
            (email.strip().lower(),)
        )
        await db.commit()


# ── User Profile Operations ──────────────────────────────────────────────

async def update_user_profile(user_id: str, username: str = None, email: str = None):
    async with aiosqlite.connect(DB_PATH) as db:
        if username is not None:
            await db.execute("UPDATE users SET username = ? WHERE id = ?", (username.strip(), user_id))
        if email is not None:
            await db.execute("UPDATE users SET email = ? WHERE id = ?", (email.strip().lower(), user_id))
        await db.commit()


async def change_user_password(user_id: str, new_password: str):
    p_hash, salt = hash_password(new_password)
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "UPDATE users SET password_hash = ?, salt = ? WHERE id = ?",
            (p_hash, salt, user_id)
        )
        await db.commit()


# ── User Settings Operations ─────────────────────────────────────────────

async def get_user_settings(user_id: str) -> dict:
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute("SELECT * FROM user_settings WHERE user_id = ?", (user_id,))
        row = await cursor.fetchone()
        if row:
            d = dict(row)
            # Use global default if user hasn't explicitly set a mode
            if not d.get("notification_mode"):
                d["notification_mode"] = settings.notification_mode
            return d
        return {
            "user_id": user_id,
            "emergency_phone": "",
            "emergency_email": "",
            "notification_mode": settings.notification_mode,
        }


async def update_user_settings(user_id: str, emergency_phone: str = None, emergency_email: str = None, notification_mode: str = None):
    async with aiosqlite.connect(DB_PATH) as db:
        existing = await get_user_settings(user_id)
        phone = emergency_phone if emergency_phone is not None else existing.get("emergency_phone", "")
        email = emergency_email if emergency_email is not None else existing.get("emergency_email", "")
        mode = notification_mode if notification_mode is not None else existing.get("notification_mode", "SIMULATION")
        await db.execute(
            "INSERT OR REPLACE INTO user_settings (user_id, emergency_phone, emergency_email, notification_mode) VALUES (?, ?, ?, ?)",
            (user_id, phone, email, mode)
        )
        await db.commit()


# ── Session Operations ────────────────────────────────────────────────────

async def create_session(user_id: str) -> str:
    token = secrets.token_hex(32)
    # 24-hour expiry
    expires_at = time.time() + 86400
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)",
            (token, user_id, expires_at)
        )
        await db.commit()
    return token


async def get_user_by_session(token: str) -> dict | None:
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        # Clean up expired sessions first
        now = time.time()
        await db.execute("DELETE FROM sessions WHERE expires_at < ?", (now,))
        await db.commit()

        cursor = await db.execute("""
            SELECT u.* FROM users u
            JOIN sessions s ON u.id = s.user_id
            WHERE s.token = ? AND s.expires_at > ?
        """, (token, now))
        row = await cursor.fetchone()
        return dict(row) if row else None


async def delete_session(token: str):
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("DELETE FROM sessions WHERE token = ?", (token,))
        await db.commit()


# ── Emergency Events ──────────────────────────────────────────────────────

async def create_emergency_event(
    user_id: str, alert_type: str, details: str, phone: str, email: str, status: str,
    detected_problem: str = "", service_label: str = "", service_contact: str = "",
    email_status: str = "PENDING", sms_status: str = "PENDING",
    email_message_id: str = "", sms_sid: str = "", error_message: str = "",
) -> str:
    event_id = uuid.uuid4().hex[:12]
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("""
            INSERT INTO emergency_events (id, user_id, alert_type, details, contact_phone, contact_email, status, created_at,
                detected_problem, service_label, service_contact, email_status, sms_status, email_message_id, sms_sid, error_message)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (event_id, user_id, alert_type, details, phone, email, status, time.time(),
              detected_problem, service_label, service_contact, email_status, sms_status,
              email_message_id, sms_sid, error_message))
        await db.commit()
    return event_id


async def update_emergency_event(event_id: str, **kwargs) -> bool:
    allowed = {"email_status", "sms_status", "email_message_id", "sms_sid", "error_message", "status",
               "detected_problem", "service_label", "service_contact"}
    fields = {k: v for k, v in kwargs.items() if k in allowed}
    if not fields:
        return False
    set_clause = ", ".join(f"{k} = ?" for k in fields)
    values = list(fields.values()) + [event_id]
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(f"UPDATE emergency_events SET {set_clause} WHERE id = ?", values)
        await db.commit()
    return True


async def delete_emergency_event(event_id: str, user_id: str) -> bool:
    async with aiosqlite.connect(DB_PATH) as db:
        cursor = await db.execute(
            "SELECT id FROM emergency_events WHERE id = ? AND user_id = ?",
            (event_id, user_id)
        )
        row = await cursor.fetchone()
        if not row:
            return False
        await db.execute("DELETE FROM emergency_events WHERE id = ? AND user_id = ?", (event_id, user_id))
        await db.commit()
    return True


async def get_all_emergency_events_for_user(user_id: str) -> list[dict]:
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute(
            "SELECT * FROM emergency_events WHERE user_id = ? ORDER BY created_at DESC",
            (user_id,)
        )
        rows = await cursor.fetchall()
        return [dict(r) for r in rows]


# ── Audio Records ─────────────────────────────────────────────────────────

async def create_audio_record(filename: str, stored_path: str, fmt: str, size: int, user_id: str = None) -> str:
    audio_id = uuid.uuid4().hex[:12]
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "INSERT INTO audio_records (id, original_filename, stored_path, format, file_size, user_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (audio_id, filename, stored_path, fmt, size, user_id, time.time())
        )
        await db.commit()
    return audio_id


async def get_audio_record(audio_id: str) -> dict | None:
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute("SELECT * FROM audio_records WHERE id = ?", (audio_id,))
        row = await cursor.fetchone()
        return dict(row) if row else None


async def update_audio_record(audio_id: str, **kwargs):
    if not kwargs:
        return
    cols = ", ".join(f"{k} = ?" for k in kwargs)
    vals = list(kwargs.values()) + [audio_id]
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(f"UPDATE audio_records SET {cols} WHERE id = ?", vals)
        await db.commit()


async def delete_audio_record(audio_id: str):
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("DELETE FROM analysis_results WHERE audio_id = ?", (audio_id,))
        await db.execute("DELETE FROM jobs WHERE audio_id = ?", (audio_id,))
        await db.execute("DELETE FROM audio_records WHERE id = ?", (audio_id,))
        await db.commit()


# ── Jobs ──────────────────────────────────────────────────────────────────

async def create_job(audio_id: str) -> str:
    job_id = uuid.uuid4().hex[:12]
    now = time.time()
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "INSERT INTO jobs (id, audio_id, status, progress, current_step, created_at, updated_at) VALUES (?, ?, 'PENDING', 0, 'Queued', ?, ?)",
            (job_id, audio_id, now, now)
        )
        await db.commit()
    return job_id


async def update_job(job_id: str, **kwargs):
    kwargs["updated_at"] = time.time()
    cols = ", ".join(f"{k} = ?" for k in kwargs)
    vals = list(kwargs.values()) + [job_id]
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(f"UPDATE jobs SET {cols} WHERE id = ?", vals)
        await db.commit()


async def get_job(job_id: str) -> dict | None:
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute("SELECT * FROM jobs WHERE id = ?", (job_id,))
        row = await cursor.fetchone()
        return dict(row) if row else None


# ── Analysis Results ──────────────────────────────────────────────────────

async def save_analysis(audio_id: str, report: dict) -> str:
    analysis_id = uuid.uuid4().hex[:12]
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "INSERT INTO analysis_results (id, audio_id, report_json, created_at) VALUES (?, ?, ?, ?)",
            (analysis_id, audio_id, json.dumps(report), time.time())
        )
        await db.commit()
    return analysis_id


async def get_analysis(analysis_id: str) -> dict | None:
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute("SELECT * FROM analysis_results WHERE id = ?", (analysis_id,))
        row = await cursor.fetchone()
        if row:
            d = dict(row)
            d["report"] = json.loads(d.pop("report_json", "{}"))
            return d
        return None


async def get_analysis_by_audio(audio_id: str) -> dict | None:
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute(
            "SELECT * FROM analysis_results WHERE audio_id = ? ORDER BY created_at DESC LIMIT 1",
            (audio_id,)
        )
        row = await cursor.fetchone()
        if row:
            d = dict(row)
            d["report"] = json.loads(d.pop("report_json", "{}"))
            return d
        return None


async def delete_analysis(analysis_id: str):
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("DELETE FROM analysis_results WHERE id = ?", (analysis_id,))
        await db.commit()


# ── Unified History Retrieval ─────────────────────────────────────────────

async def get_user_history(user_id: str) -> list[dict]:
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        
        # 1. Fetch upload history
        cursor = await db.execute("""
            SELECT 
                a.id as id,
                a.original_filename,
                a.format,
                a.duration,
                a.file_size,
                a.created_at,
                j.status as job_status,
                j.progress as job_progress,
                j.error as job_error,
                ar.id as analysis_id,
                ar.report_json
            FROM audio_records a
            LEFT JOIN jobs j ON a.id = j.audio_id
            LEFT JOIN analysis_results ar ON a.id = ar.audio_id
            WHERE a.user_id = ?
            ORDER BY a.created_at DESC
        """, (user_id,))
        upload_rows = await cursor.fetchall()
        
        history = []
        for row in upload_rows:
            item = dict(row)
            report = None
            if item.get("report_json"):
                try:
                    report = json.loads(item["report_json"])
                except Exception:
                    pass
            item.pop("report_json", None)
            
            risk_score = 0
            severity = "PEACEFUL"
            explanation = ""
            detected_incident = "None"
            confidence = 1.0
            notification_status = "None"
            transcript = ""
            service_label = ""
            service_contact = ""
            email_status = "PENDING"
            sms_status = "PENDING"
            
            if report:
                risk_score = report.get("risk_score", {}).get("score", 0)
                severity = report.get("risk_score", {}).get("severity", "PEACEFUL")
                explanation = report.get("risk_score", {}).get("explanation", "")
                
                emergency_analysis = report.get("emergency_analysis", {})
                emergency_types = emergency_analysis.get("emergency_types", [])
                if emergency_types:
                    detected_incident = ", ".join([t["type"] for t in emergency_types])
                    confidence = emergency_types[0].get("confidence", 1.0)
                
                transcript = report.get("speech_to_text", "")
                notification_res = report.get("notification_status", {})
                if notification_res:
                    notification_status = f"{notification_res.get('mode', 'SIMULATION')} dispatch to {notification_res.get('phone', '')} and {notification_res.get('email', '')}"
                    
                    # Extract notification status fields
                    email_result = notification_res.get("email_result", {})
                    sms_result = notification_res.get("sms", {})
                    email_status = "SENT" if email_result.get("success") else "FAILED"
                    sms_status = "SENT" if sms_result.get("success") else ("NOT_SENT" if notification_res.get("mode") != "LIVE" else "FAILED")
                    
                    # Extract service info from emergency types
                    if emergency_types:
                        emg_cat = _classify_emergency_type(emergency_types)
                        svc = _get_service_contact(emg_cat)
                        service_label = svc.get("label", "")
                        service_contact = svc.get("phone", "")
            
            history.append({
                "id": item["id"],
                "analysis_id": item["analysis_id"] or "",
                "type": "AUDIO_UPLOAD",
                "filename": item["original_filename"],
                "format": item["format"],
                "duration": item["duration"],
                "file_size": item["file_size"],
                "risk_score": risk_score,
                "severity": severity,
                "explanation": explanation or item.get("job_error") or item.get("job_status") or "Uploaded",
                "detected_incident": detected_incident,
                "confidence": confidence,
                "notification_status": notification_status,
                "transcript": transcript,
                "created_at": item["created_at"],
                "service_label": service_label,
                "service_contact": service_contact,
                "email_status": email_status,
                "sms_status": sms_status,
                "email_message_id": "",
                "sms_sid": "",
                "error_message": "",
            })
            
        # 2. Fetch manual emergency triggers
        cursor = await db.execute("""
            SELECT * FROM emergency_events 
            WHERE user_id = ? 
            ORDER BY created_at DESC
        """, (user_id,))
        event_rows = await cursor.fetchall()
        
        for row in event_rows:
            item = dict(row)
            history.append({
                "id": item["id"],
                "analysis_id": "",
                "type": "EMERGENCY_ALERT",
                "filename": f"Manual {item['alert_type'].title()} Dispatch",
                "format": "N/A",
                "duration": 0.0,
                "file_size": 0,
                "risk_score": 100,
                "severity": "CRITICAL",
                "explanation": item.get("detected_problem") or item["details"],
                "detected_incident": f"Manual {item['alert_type'].upper()}",
                "confidence": 1.0,
                "notification_status": f"Dispatched: Phone: {item['contact_phone']}, Email: {item['contact_email']}",
                "transcript": "",
                "created_at": item["created_at"],
                "detected_problem": item.get("detected_problem", ""),
                "service_label": item.get("service_label", ""),
                "service_contact": item.get("service_contact", ""),
                "email_status": item.get("email_status", "PENDING"),
                "sms_status": item.get("sms_status", "PENDING"),
                "email_message_id": item.get("email_message_id", ""),
                "sms_sid": item.get("sms_sid", ""),
                "error_message": item.get("error_message", ""),
            })
            
        # Sort consolidated history by created_at descending
        history.sort(key=lambda x: x["created_at"], reverse=True)
        return history
