"""
Notification dispatch & audit service (SMS / Email / Call alerting).
Email is ALWAYS sent when SMTP credentials are configured (both SIMULATION and LIVE modes).
SMS/Call are only sent in LIVE mode via Twilio.

Service Contacts:
  - Medical/Ambulance: +91 99430 81908
  - Police: +91 79044 99489
  - Fire/Rescue: +91 90252 57115

Sender Email: saranr2007s@gmail.com
Sender Phone: +91 90252 57115
Receiver Email: saran2007r@gmail.com
Receiver Phone/SMS: +91 95973 89141
"""
import time
import smtplib
import traceback
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from config import settings


# Service contact mapping
SERVICE_CONTACTS = {
    "medical": {
        "label": "Medical / Ambulance",
        "phone": "+91 99430 81908",
        "tel_link": "tel:+919943081908",
    },
    "ambulance": {
        "label": "Medical / Ambulance",
        "phone": "+91 99430 81908",
        "tel_link": "tel:+919943081908",
    },
    "police": {
        "label": "Police",
        "phone": "+91 79044 99489",
        "tel_link": "tel:+917904499489",
    },
    "fire": {
        "label": "Fire / Rescue",
        "phone": "+91 90252 57115",
        "tel_link": "tel:+919025257115",
    },
    "rescue": {
        "label": "Fire / Rescue",
        "phone": "+91 90252 57115",
        "tel_link": "tel:+919025257115",
    },
}


def _classify_emergency_type(emergency_types: list) -> str:
    """Determine the primary emergency category from detected types."""
    labels = [t.get("type", "").lower() for t in emergency_types]
    for lbl in labels:
        if any(k in lbl for k in ["ambulance", "medical", "heart", "breathing", "injury", "injured", "medical emergency"]):
            return "medical"
        if any(k in lbl for k in ["police", "crime", "robbery", "shooting", "gun", "intruder", "theft"]):
            return "police"
        if any(k in lbl for k in ["fire", "rescue", "siren", "smoke", "alarm", "explosion", "arson"]):
            return "fire"
    return "medical"


def _get_service_contact(emergency_type: str) -> dict:
    """Get service contact details for the given emergency type."""
    return SERVICE_CONTACTS.get(emergency_type, SERVICE_CONTACTS["medical"])


def _send_smtp_email(to_email: str, subject: str, body: str, html_body: str = None) -> dict:
    """Send email via SMTP. Returns dict with success status and details."""
    missing = []
    if not settings.smtp_host:
        missing.append("SMTP_HOST")
    if not settings.smtp_username:
        missing.append("SMTP_USERNAME")
    if not settings.smtp_password:
        missing.append("SMTP_PASSWORD")
    if missing:
        err = f"Environment variable missing: {', '.join(missing)}. Set these in backend/.env"
        print(f"[SMTP] ERROR: {err}")
        return {"success": False, "error": err}
    if settings.smtp_password == "REPLACE_WITH_YOUR_16_CHAR_APP_PASSWORD":
        err = ("SMTP_PASSWORD is still the placeholder value. "
               "Replace it with a real 16-character Gmail App Password. "
               "Generate one at https://myaccount.google.com/apppasswords")
        print(f"[SMTP] ERROR: {err}")
        return {"success": False, "error": err}
    try:
        msg = MIMEMultipart("alternative")
        msg["From"] = settings.smtp_from_address or settings.smtp_username
        msg["To"] = to_email
        msg["Subject"] = subject
        msg.attach(MIMEText(body, "plain"))
        if html_body:
            msg.attach(MIMEText(html_body, "html"))

        print(f"[SMTP] Connecting to {settings.smtp_host}:{settings.smtp_port} ...")
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15) as server:
            server.ehlo()
            server.starttls()
            server.ehlo()
            print(f"[SMTP] TLS established. Logging in as {settings.smtp_username} ...")
            server.login(settings.smtp_username, settings.smtp_password)
            server.send_message(msg)
            print(f"[SMTP] Message sent successfully to {to_email}")
        return {"success": True, "detail": f"Email delivered to {to_email}"}
    except smtplib.SMTPAuthenticationError as e:
        err = (f"SMTP authentication failed: {e}. "
               "SMTP_USERNAME or SMTP_PASSWORD is wrong. "
               "For Gmail, SMTP_PASSWORD must be a 16-character App Password (not your regular password). "
               "Generate one at https://myaccount.google.com/apppasswords")
        print(f"[SMTP] ERROR: {err}")
        return {"success": False, "error": err}
    except smtplib.SMTPConnectError as e:
        err = (f"SMTP connection failed to {settings.smtp_host}:{settings.smtp_port}: {e}. "
               "Check SMTP_HOST and SMTP_PORT in backend/.env")
        print(f"[SMTP] ERROR: {err}")
        return {"success": False, "error": err}
    except smtplib.SMTPServerDisconnected as e:
        err = f"SMTP server disconnected unexpectedly: {e}"
        print(f"[SMTP] ERROR: {err}")
        return {"success": False, "error": err}
    except smtplib.SMTPException as e:
        err = f"SMTP error: {e}"
        print(f"[SMTP] ERROR: {err}")
        return {"success": False, "error": err}
    except Exception as e:
        tb = traceback.format_exc()
        err = f"Email send failed ({type(e).__name__}): {e}"
        print(f"[SMTP] ERROR: {err}")
        print(f"[SMTP] TRACEBACK:\n{tb}")
        return {"success": False, "error": err}


def _send_twilio_sms(phone: str, body: str) -> dict:
    """Send SMS via Twilio. Returns dict with success, sid, and error details."""
    # Pre-check: validate all credentials are present
    if not settings.twilio_account_sid or not settings.twilio_auth_token:
        return {"success": False, "error": "Twilio credentials not configured. Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN in backend/.env", "sid": ""}
    if not settings.twilio_from_number:
        return {"success": False, "error": "No Twilio sender number configured. Set TWILIO_FROM_NUMBER in backend/.env to a Twilio-provisioned phone number. The number must be purchased/provisioned through Twilio Console.", "sid": ""}
    if not settings.twilio_account_sid.startswith("AC"):
        return {"success": False, "error": f"Invalid TWILIO_ACCOUNT_SID format: '{settings.twilio_account_sid[:10]}...'. Must start with 'AC'. Check your Twilio Console Dashboard.", "sid": ""}

    try:
        from twilio.rest import Client
        from twilio.base.exceptions import TwilioRestException
        client = Client(settings.twilio_account_sid.strip(), settings.twilio_auth_token.strip())
        msg = client.messages.create(
            body=body,
            from_=settings.twilio_from_number.strip(),
            to=phone
        )
        print(f"[SMS] Twilio message sent successfully. SID: {msg.sid}, Status: {msg.status}")
        return {"success": True, "sid": msg.sid, "status": msg.status, "error": ""}

    except ImportError:
        return {"success": False, "error": "twilio package not installed. Run: pip install twilio", "sid": ""}
    except TwilioRestException as e:
        err_code = getattr(e, 'code', None)
        err_msg = str(e)
        # Classify specific Twilio errors
        if err_code == 20003 or "Authenticate" in err_msg:
            detail = "Twilio authentication failed. TWILIO_AUTH_TOKEN is incorrect. Check your Twilio Console."
        elif err_code == 21211:
            detail = f"Invalid 'To' phone number: {phone}. The number is not in E.164 format."
        elif err_code == 21214:
            detail = f"The 'To' phone number {phone} is not verified. Trial accounts can only send to verified numbers."
        elif err_code == 21408:
            detail = f"Permission not enabled for +{phone[1:3]} numbers. Enable 'Geo Permissions' in Twilio Console or upgrade to paid account."
        elif err_code == 21614:
            detail = f"Account not authorized to send SMS to {phone}. Upgrade your Twilio account."
        elif "20003" in err_msg:
            detail = "Twilio authentication failed. Check TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN in backend/.env."
        elif "Trial" in err_msg or "trial" in err_msg:
            detail = f"Twilio trial account restriction: {err_msg[:200]}. Upgrade to a paid Twilio account for production SMS."
        else:
            detail = f"Twilio error ({err_code}): {err_msg[:300]}"
        print(f"[SMS] FAILED: {detail}")
        return {"success": False, "error": detail, "sid": ""}
    except Exception as e:
        err_str = str(e)
        print(f"[SMS] FAILED: {err_str[:300]}")
        return {"success": False, "error": f"SMS send failed: {err_str[:300]}", "sid": ""}


def _send_twilio_call(phone: str, message: str) -> dict:
    if not all([settings.twilio_account_sid, settings.twilio_auth_token, settings.twilio_from_number]):
        return {"success": False, "error": "Twilio credentials not configured."}
    try:
        from twilio.rest import Client
        client = Client(settings.twilio_account_sid, settings.twilio_auth_token)
        call = client.calls.create(
            twiml=f'<Response><Say>{message}</Say></Response>',
            from_=settings.twilio_from_number, to=phone,
        )
        return {"success": True, "sid": call.sid}
    except ImportError:
        return {"success": False, "error": "twilio package not installed."}
    except Exception as e:
        return {"success": False, "error": str(e)}


def dispatch_emergency_notification(
    risk_score_data: dict,
    emergency_analysis: dict,
    audio_filename: str = "",
    mode: str = None,
    phone: str = None,
    email: str = None,
) -> dict:
    """
    Dispatches emergency notification with professional formatting.
    Email: ALWAYS sent when SMTP is configured (both SIMULATION and LIVE).
    SMS/Call: Only sent in LIVE mode via Twilio.
    """
    target_phone = phone or settings.notification_phone
    target_email = email or settings.notification_email
    active_mode = mode or settings.notification_mode

    score = risk_score_data.get("score", 0)
    severity = risk_score_data.get("severity", "INFO")
    explanation = risk_score_data.get("explanation", "")
    emergency_types = emergency_analysis.get("emergency_types", [])
    risk_factors = emergency_analysis.get("risk_factors", [])
    type_str = ", ".join([t["type"] for t in emergency_types]) if emergency_types else "Potential Disturbance"

    now = time.time()
    readable_time = time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(now))
    date_str = time.strftime("%d %B %Y", time.localtime(now))
    time_str = time.strftime("%I:%M %p", time.localtime(now))

    # Classify emergency type and get service contact
    emg_category = _classify_emergency_type(emergency_types)
    service = _get_service_contact(emg_category)
    service_label = service["label"]
    service_phone = service["phone"]
    tel_link = service["tel_link"]

    # Build risk factors text
    risk_factors_text = ""
    risk_factors_html = ""
    if risk_factors:
        risk_factors_text = "\n".join([
            f"  - {rf.get('factor', 'Unknown')} (+{rf.get('points', 0)} pts): {rf.get('description', '')}"
            for rf in risk_factors
        ])
        risk_factors_html = "\n".join([
            f'<tr><td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-weight:600;">{rf.get("factor", "Unknown")}</td><td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;color:#ef4444;font-weight:700;">+{rf.get("points", 0)} pts</td><td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-size:13px;">{rf.get("description", "")}</td></tr>'
            for rf in risk_factors
        ])

    # ── Professional Subject Line ──
    email_subject = f"[EMERGENCY ALERT - {severity}] {service_label} Required - {readable_time}"

    # ── Plain Text Body ──
    sms_body = (
        f"EMERGENCY ALERT [{severity}]\n"
        f"Date: {date_str} | Time: {time_str}\n"
        f"Type: {service_label}\n"
        f"Detected: {type_str}\n"
        f"Risk Score: {score}/100\n"
        f"Details: {explanation}\n"
        f"\nACTION REQUIRED:\n"
        f"Call {service_label}: {service_phone}\n"
        f"Call Now: {tel_link}"
    )

    email_body = (
        f"{'='*60}\n"
        f"  EMERGENCY ALERT NOTIFICATION\n"
        f"  {service_label} Required\n"
        f"{'='*60}\n\n"
        f"Severity:       {severity}\n"
        f"Risk Score:     {score}/100\n"
        f"Date:           {date_str}\n"
        f"Time:           {time_str}\n"
        f"Audio File:     {audio_filename or 'Audio Stream'}\n"
        f"Emergency Type: {service_label}\n"
        f"Detected Issue: {type_str}\n\n"
        f"Analysis Details:\n"
        f"{explanation}\n\n"
    )

    if risk_factors_text:
        email_body += (
            f"Contributing Risk Factors:\n"
            f"{risk_factors_text}\n\n"
        )

    email_body += (
        f"{'='*60}\n"
        f"  REQUIRED ACTION\n"
        f"{'='*60}\n\n"
        f"  Contact {service_label} immediately:\n"
        f"  Phone: {service_phone}\n"
        f"  Call Now: {tel_link}\n\n"
        f"  Receiver Contact: {target_phone}\n"
        f"  Receiver Email:   {target_email}\n\n"
        f"{'='*60}\n"
        f"This is an automated emergency notification from the Audio Intelligence System.\n"
        f"Sender: {settings.smtp_from_address or settings.smtp_username}\n"
    )

    # ── HTML Email Body (professional) ──
    severity_color = {"CRITICAL": "#dc2626", "WARNING": "#d97706", "INFO": "#2563eb", "PEACEFUL": "#16a34a"}.get(severity, "#6b7280")
    severity_bg = {"CRITICAL": "#fef2f2", "WARNING": "#fffbeb", "INFO": "#eff6ff", "PEACEFUL": "#f0fdf4"}.get(severity, "#f9fafb")

    email_html = f"""<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
<div style="max-width:620px;margin:20px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.1);">

  <!-- Header -->
  <div style="background:linear-gradient(135deg,{severity_color} 0%,{severity_color}dd 100%);padding:28px 32px;text-align:center;">
    <div style="font-size:32px;margin-bottom:8px;">&#x26A0;&#xFE0F;</div>
    <h1 style="color:#ffffff;margin:0 0 6px 0;font-size:22px;font-weight:800;letter-spacing:-0.5px;">
      EMERGENCY ALERT - {severity}
    </h1>
    <p style="color:rgba(255,255,255,0.9);margin:0;font-size:15px;font-weight:600;">
      {service_label} Required Immediately
    </p>
  </div>

  <!-- Severity Badge -->
  <div style="text-align:center;padding:16px 32px;background:{severity_bg};border-bottom:1px solid #e2e8f0;">
    <span style="display:inline-block;padding:6px 20px;border-radius:20px;background:{severity_color};color:#ffffff;font-size:13px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;">
      {severity} SEVERITY - Risk Score: {score}/100
    </span>
  </div>

  <!-- Details Table -->
  <div style="padding:24px 32px;">
    <h2 style="font-size:15px;font-weight:700;color:#1e293b;margin:0 0 14px 0;border-bottom:2px solid #e2e8f0;padding-bottom:8px;">
      Emergency Details
    </h2>
    <table style="width:100%;border-collapse:collapse;font-size:14px;">
      <tr><td style="padding:8px 0;color:#64748b;font-weight:600;width:140px;">Date</td><td style="padding:8px 0;color:#1e293b;">{date_str}</td></tr>
      <tr><td style="padding:8px 0;color:#64748b;font-weight:600;">Time</td><td style="padding:8px 0;color:#1e293b;">{time_str}</td></tr>
      <tr><td style="padding:8px 0;color:#64748b;font-weight:600;">Emergency Type</td><td style="padding:8px 0;color:#1e293b;font-weight:700;">{service_label}</td></tr>
      <tr><td style="padding:8px 0;color:#64748b;font-weight:600;">Detected Issue</td><td style="padding:8px 0;color:#1e293b;">{type_str}</td></tr>
      <tr><td style="padding:8px 0;color:#64748b;font-weight:600;">Audio File</td><td style="padding:8px 0;color:#1e293b;font-family:monospace;font-size:13px;">{audio_filename or 'Audio Stream'}</td></tr>
    </table>

    <!-- Explanation -->
    <div style="margin-top:18px;padding:14px 18px;background:#f8fafc;border-radius:8px;border-left:4px solid {severity_color};">
      <div style="font-size:12px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">Analysis Details</div>
      <p style="margin:0;color:#334155;font-size:14px;line-height:1.6;">{explanation}</p>
    </div>

    <!-- Risk Factors Table -->
    {f'''<div style="margin-top:18px;">
      <h2 style="font-size:15px;font-weight:700;color:#1e293b;margin:0 0 10px 0;">Contributing Risk Factors</h2>
      <table style="width:100%;border-collapse:collapse;font-size:13px;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
        <thead><tr style="background:#f1f5f9;">
          <th style="padding:8px 12px;text-align:left;font-size:11px;text-transform:uppercase;color:#64748b;">Factor</th>
          <th style="padding:8px 12px;text-align:left;font-size:11px;text-transform:uppercase;color:#64748b;">Points</th>
          <th style="padding:8px 12px;text-align:left;font-size:11px;text-transform:uppercase;color:#64748b;">Description</th>
        </tr></thead>
        <tbody>{risk_factors_html}</tbody>
      </table>
    </div>''' if risk_factors_html else ''}

    <!-- ACTION REQUIRED -->
    <div style="margin-top:24px;padding:20px;background:linear-gradient(135deg,{severity_color}11,{severity_color}08);border:2px solid {severity_color}40;border-radius:10px;text-align:center;">
      <div style="font-size:12px;font-weight:700;color:{severity_color};text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;">
        &#x1F6A8; IMMEDIATE ACTION REQUIRED
      </div>
      <p style="margin:0 0 14px 0;color:#334155;font-size:15px;font-weight:600;">
        Contact {service_label} Immediately
      </p>
      <div style="margin-bottom:14px;">
        <span style="font-family:monospace;font-size:20px;font-weight:800;color:{severity_color};letter-spacing:1px;">
          {service_phone}
        </span>
      </div>
      <a href="{tel_link}" style="display:inline-block;padding:14px 40px;background:{severity_color};color:#ffffff;font-size:16px;font-weight:700;text-decoration:none;border-radius:8px;letter-spacing:0.5px;">
        &#x1F4DE; CALL NOW
      </a>
    </div>

    <!-- Contacts -->
    <div style="margin-top:20px;padding:14px 18px;background:#f8fafc;border-radius:8px;font-size:13px;color:#64748b;">
      <div style="font-weight:600;margin-bottom:6px;">Notification Dispatched To:</div>
      <div>Phone: <span style="color:#1e293b;font-family:monospace;">{target_phone}</span></div>
      <div>Email: <span style="color:#1e293b;">{target_email}</span></div>
    </div>
  </div>

  <!-- Footer -->
  <div style="padding:16px 32px;background:#f1f5f9;text-align:center;border-top:1px solid #e2e8f0;">
    <p style="margin:0;font-size:11px;color:#94a3b8;">
      Automated emergency notification from Audio Intelligence System<br>
      Sender: {settings.smtp_from_address or settings.smtp_username} | Mode: {active_mode}
    </p>
  </div>
</div>
</body>
</html>"""

    print(f"\n[NotificationService] Dispatching alert - severity={severity}, score={score}, type={service_label}")
    print(f"[NotificationService] To: {target_email} | Mode: {active_mode}")
    print(f"[NotificationService] Service Contact: {service_phone}")

    results = {
        "sent": False,
        "mode": active_mode,
        "phone": target_phone,
        "email": target_email,
        "timestamp": now,
        "sms": {},
        "call": {},
        "email_result": {},
        "sms_sid": "",
        "email_detail": "",
        "details": "",
    }

    # ── Email: ALWAYS attempted when SMTP is configured ──
    email_res = _send_smtp_email(target_email, email_subject, email_body, email_html)
    results["email_result"] = email_res
    email_ok = email_res.get("success", False)
    results["email_detail"] = email_res.get("detail", "") if email_ok else email_res.get("error", "")

    # ── SMS: Always send text notification to receiver phone ──
    sms_ok = False
    call_ok = False
    if active_mode == "LIVE":
        sms_res = _send_twilio_sms(target_phone, sms_body)
        call_res = _send_twilio_call(
            target_phone,
            f"Emergency alert. {severity} incident detected. {service_label} required. Risk score {score} out of 100. Type: {type_str}. Please respond immediately."
        )
        results["sms"] = sms_res
        results["call"] = call_res
        sms_ok = sms_res.get("success", False)
        call_ok = call_res.get("success", False)
        results["sms_sid"] = sms_res.get("sid", "")
    else:
        results["sms"] = {"success": False, "detail": "SMS not sent in SIMULATION mode (Twilio not used)."}
        results["call"] = {"success": False, "detail": "Call not sent in SIMULATION mode (Twilio not used)."}

    results["sent"] = email_ok or sms_ok or call_ok
    results["details"] = (
        f"Email: {'SENT' if email_ok else 'FAILED'} ({email_res.get('detail', email_res.get('error', 'unknown'))}). "
        f"SMS: {'SENT' if sms_ok else 'not attempted' if active_mode != 'LIVE' else 'FAILED'}. "
        f"Call: {'SENT' if call_ok else 'not attempted' if active_mode != 'LIVE' else 'FAILED'}. "
        f"Severity: {severity} ({score}/100). "
        f"Service: {service_label} ({service_phone}). "
        f"To: {target_email}"
    )

    if email_ok:
        print(f"[NotificationService] Email SENT successfully to {target_email}")
    else:
        print(f"[NotificationService] Email FAILED: {email_res.get('error', 'unknown')}")

    return results
