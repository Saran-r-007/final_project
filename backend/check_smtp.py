"""Quick check: verify .env loads correctly and SMTP settings are valid."""
import sys
sys.path.insert(0, ".")
from config import settings

print("=== SMTP Configuration ===")
print(f"  smtp_host:     '{settings.smtp_host}'")
print(f"  smtp_port:     {settings.smtp_port}")
print(f"  smtp_username: '{settings.smtp_username}'")
print(f"  smtp_password: '{'***' if settings.smtp_password else '(empty)'}' (len={len(settings.smtp_password)})")
print(f"  smtp_from:     '{settings.smtp_from_address}'")
print(f"  notif_mode:    '{settings.notification_mode}'")
print(f"  notif_email:   '{settings.notification_email}'")
print(f"  notif_phone:   '{settings.notification_phone}'")

# Validate required fields
missing = []
if not settings.smtp_host:
    missing.append("SMTP_HOST")
if not settings.smtp_username:
    missing.append("SMTP_USERNAME")
if not settings.smtp_password:
    missing.append("SMTP_PASSWORD")
if missing:
    print(f"\n  ERROR: Missing environment variables: {', '.join(missing)}")
    print("  Set them in backend/.env")
    sys.exit(1)

if settings.smtp_password == "REPLACE_WITH_YOUR_16_CHAR_APP_PASSWORD":
    print("\n  ERROR: SMTP_PASSWORD is still the placeholder value.")
    print("  Replace it with a real 16-character Gmail App Password.")
    print("  Steps:")
    print("    1. Go to https://myaccount.google.com/security")
    print("    2. Enable 2-Step Verification (required)")
    print("    3. Go to https://myaccount.google.com/apppasswords")
    print("    4. Select app 'Mail' and device 'Windows Computer'")
    print("    5. Click Generate, copy the 16-char password (no spaces)")
    print("    6. Paste it as SMTP_PASSWORD in backend/.env")
    sys.exit(1)

# Quick SMTP connection test
import smtplib
print("\n=== SMTP Connection Test ===")
try:
    with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15) as server:
        server.ehlo()
        print(f"  Connected to {settings.smtp_host}:{settings.smtp_port}")
        server.starttls()
        server.ehlo()
        print("  TLS established")
        server.login(settings.smtp_username, settings.smtp_password)
        print("  LOGIN SUCCESSFUL")
        print("\n  SMTP is configured correctly. OTP emails will be delivered.")
except smtplib.SMTPAuthenticationError as e:
    print(f"  LOGIN FAILED (auth error): {e}")
    print("\n  The username or password is wrong.")
    print("  For Gmail: SMTP_PASSWORD must be a 16-character App Password, NOT your regular password.")
    print("  Generate one at: https://myaccount.google.com/apppasswords")
except smtplib.SMTPConnectError as e:
    print(f"  CONNECTION FAILED: {e}")
    print("\n  Check SMTP_HOST and SMTP_PORT in backend/.env")
except Exception as e:
    print(f"  ERROR: {e}")
