"""Full E2E test: Health -> Signup -> Profile -> Settings -> Login -> History -> Emergency -> Password Change"""
import httpx
import asyncio

BASE = "http://localhost:8000/api"

async def main():
    async with httpx.AsyncClient(timeout=30) as c:
        # 1. Health check
        r = await c.get(f"{BASE}/health")
        print(f"[1] GET /api/health -> {r.status_code}")
        assert r.status_code == 200
        health = r.json()
        print(f"    status: {health['status']}, models: {health.get('models_loaded', {})}")

        # 2. Signup
        r = await c.post(f"{BASE}/auth/signup", json={
            "username": "beta_tester",
            "email": "beta@test.com",
            "password": "BetaTest123"
        })
        print(f"\n[2] POST /api/auth/signup -> {r.status_code}")
        assert r.status_code == 200, f"Signup failed: {r.text}"
        data = r.json()
        token = data["token"]
        user = data["user"]
        print(f"    user: {user['username']} ({user['email']})")
        headers = {"Authorization": f"Bearer {token}"}

        # 3. Get Profile
        r = await c.get(f"{BASE}/auth/profile", headers=headers)
        print(f"\n[3] GET /api/auth/profile -> {r.status_code}")
        assert r.status_code == 200
        profile = r.json()
        print(f"    username: {profile['username']}, email: {profile['email']}")
        print(f"    emergency_phone: {profile.get('emergency_phone', '')}")
        print(f"    notification_mode: {profile.get('notification_mode', 'SIMULATION')}")

        # 4. Update Profile
        r = await c.put(f"{BASE}/auth/profile", headers=headers, json={
            "username": "beta_tester_v2"
        })
        print(f"\n[4] PUT /api/auth/profile -> {r.status_code}")
        assert r.status_code == 200
        print(f"    updated username: {r.json()['username']}")

        # 5. Update Settings
        r = await c.put(f"{BASE}/auth/settings", headers=headers, json={
            "emergency_phone": "+911234567890",
            "emergency_email": "emergency@test.com",
            "notification_mode": "SIMULATION"
        })
        print(f"\n[5] PUT /api/auth/settings -> {r.status_code}")
        assert r.status_code == 200
        print(f"    {r.json()['message']}")

        # 6. Get Settings
        r = await c.get(f"{BASE}/auth/settings", headers=headers)
        print(f"\n[6] GET /api/auth/settings -> {r.status_code}")
        assert r.status_code == 200
        sett = r.json()
        print(f"    phone: {sett['emergency_phone']}, email: {sett['emergency_email']}, mode: {sett['notification_mode']}")

        # 7. Login with new username
        r = await c.post(f"{BASE}/auth/login", json={
            "username": "beta_tester_v2",
            "password": "BetaTest123"
        })
        print(f"\n[7] POST /api/auth/login -> {r.status_code}")
        assert r.status_code == 200
        token2 = r.json()["token"]
        headers2 = {"Authorization": f"Bearer {token2}"}
        print(f"    login successful, new token issued")

        # 8. History (empty for new user)
        r = await c.get(f"{BASE}/history", headers=headers2)
        print(f"\n[8] GET /api/history -> {r.status_code}")
        assert r.status_code == 200
        hist = r.json()
        print(f"    history count: {hist.get('count', len(hist.get('history', [])))}")

        # 9. Emergency History (empty)
        r = await c.get(f"{BASE}/emergency/history", headers=headers2)
        print(f"\n[9] GET /api/emergency/history -> {r.status_code}")
        assert r.status_code == 200
        print(f"    emergency events: {len(r.json().get('events', []))}")

        # 10. Trigger Emergency Alert
        r = await c.post(f"{BASE}/emergency/trigger", headers=headers2, json={
            "alert_type": "medical",
            "details": "E2E test medical alert",
            "contact_phone": "+911234567890",
            "contact_email": "emergency@test.com"
        })
        print(f"\n[10] POST /api/emergency/trigger -> {r.status_code}")
        assert r.status_code == 200
        trigger_data = r.json()
        print(f"    event_id: {trigger_data['event_id']}, label: {trigger_data['label']}")
        print(f"    notification mode: {trigger_data['notification']['mode']}")

        # 11. Emergency History (should have 1 event)
        r = await c.get(f"{BASE}/emergency/history", headers=headers2)
        print(f"\n[11] GET /api/emergency/history -> {r.status_code}")
        assert r.status_code == 200
        events = r.json().get("events", [])
        print(f"    emergency events: {len(events)}")
        if events:
            e = events[0]
            print(f"    latest: type={e['type']}, status={e['status']}, phone={e.get('phone','')}")

        # 12. History (should have 1 emergency event)
        r = await c.get(f"{BASE}/history", headers=headers2)
        print(f"\n[12] GET /api/history -> {r.status_code}")
        assert r.status_code == 200
        hist = r.json()
        items = hist.get("history", [])
        print(f"    history items: {len(items)}")
        if items:
            h = items[0]
            print(f"    latest: type={h.get('type')}, severity={h.get('severity')}, filename={h.get('filename','')[:40]}")

        # 13. Change Password
        r = await c.post(f"{BASE}/auth/change-password", headers=headers2, json={
            "current_password": "BetaTest123",
            "new_password": "BetaTest456"
        })
        print(f"\n[13] POST /api/auth/change-password -> {r.status_code}")
        assert r.status_code == 200
        print(f"    {r.json()['message']}")

        # 14. Login with new password
        r = await c.post(f"{BASE}/auth/login", json={
            "username": "beta_tester_v2",
            "password": "BetaTest456"
        })
        print(f"\n[14] POST /api/auth/login (new password) -> {r.status_code}")
        assert r.status_code == 200
        print(f"    login with new password successful")

        # 15. Logout
        r = await c.post(f"{BASE}/auth/logout", headers=headers2)
        print(f"\n[15] POST /api/auth/logout -> {r.status_code}")
        assert r.status_code == 200
        print(f"    {r.json()['message']}")

        # 16. Me after logout (should fail)
        r = await c.get(f"{BASE}/auth/me", headers=headers2)
        print(f"\n[16] GET /api/auth/me (after logout) -> {r.status_code}")
        assert r.status_code == 401
        print(f"    correctly returned 401")

        print("\n=== ALL 16 E2E TESTS PASSED ===")

asyncio.run(main())
