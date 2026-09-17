"""Real SMTP email test — sends an emergency notification email and verifies SMTP response."""
import httpx
import asyncio

BASE = "http://localhost:8000/api"

async def main():
    async with httpx.AsyncClient(timeout=30) as c:
        # Login as an existing user
        r = await c.post(f"{BASE}/auth/login", json={
            "username": "beta_tester_v2",
            "password": "BetaTest456"
        })
        if r.status_code != 200:
            # Signup if login fails
            r = await c.post(f"{BASE}/auth/signup", json={
                "username": "smtp_tester",
                "email": "saran2007r@gmail.com",
                "password": "Smtptest123"
            })
            assert r.status_code == 200, f"Signup failed: {r.text}"
        
        token = r.json()["token"]
        headers = {"Authorization": f"Bearer {token}"}
        print(f"Logged in successfully")

        # 1. Test notification email via /api/notifications/test
        print("\n[TEST] Sending test notification email...")
        r = await c.post(f"{BASE}/notifications/test", headers=headers)
        print(f"Status: {r.status_code}")
        data = r.json()
        print(f"Response: {data}")

        email_result = data.get("email_result", {})
        if email_result.get("success"):
            print(f"\n*** EMAIL SENT SUCCESSFULLY ***")
            print(f"    Detail: {email_result.get('detail', 'unknown')}")
        else:
            print(f"\n*** EMAIL FAILED ***")
            print(f"    Error: {email_result.get('error', 'unknown')}")

        # 2. Test emergency trigger (also sends email)
        print("\n[TEST] Triggering medical emergency alert...")
        r = await c.post(f"{BASE}/emergency/trigger", headers=headers, json={
            "alert_type": "medical",
            "details": "TEST: Real email notification test — ignore this alert",
            "contact_phone": "+919597389141",
            "contact_email": "saran2007r@gmail.com"
        })
        print(f"Status: {r.status_code}")
        data = r.json()
        trigger_notif = data.get("notification", {})
        email_result2 = trigger_notif.get("email_result", {})
        if email_result2.get("success"):
            print(f"\n*** EMERGENCY EMAIL SENT SUCCESSFULLY ***")
            print(f"    Detail: {email_result2.get('detail', 'unknown')}")
        else:
            print(f"\n*** EMERGENCY EMAIL FAILED ***")
            print(f"    Error: {email_result2.get('error', 'unknown')}")

        print(f"\nFull notification details: {trigger_notif.get('details', '')}")

asyncio.run(main())
