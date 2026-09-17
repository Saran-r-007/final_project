"""Quick test: Signup -> DB -> Login -> /api/auth/me"""
import asyncio
import sys
sys.path.insert(0, ".")

import storage

async def test():
    await storage.init_db()
    print("[1] DB initialized OK")

    # Check tables
    import aiosqlite
    async with aiosqlite.connect(storage.DB_PATH) as db:
        cursor = await db.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = [r[0] for r in await cursor.fetchall()]
        print(f"[2] Tables: {tables}")

    # Create user
    try:
        uid = await storage.create_user("TestUser_99", "test99@example.com", "securepass123")
        print(f"[3] Created user id={uid}")
    except Exception as e:
        print(f"[3] CREATE FAILED: {e}")
        return

    # Get user
    user = await storage.get_user(uid)
    print(f"[4] get_user: {user}")

    # Get by username
    user2 = await storage.get_user_by_username("TestUser_99")
    print(f"[5] get_user_by_username: {user2 is not None}")

    # Create session
    token = await storage.create_session(uid)
    print(f"[6] Session token: {token[:16]}...")

    # Verify session -> user
    user3 = await storage.get_user_by_session(token)
    print(f"[7] get_user_by_session: {user3 is not None}, username={user3.get('username') if user3 else None}")

    # Verify password check
    pwd_hash, _ = storage.hash_password("securepass123", user2["salt"])
    print(f"[8] Password match: {pwd_hash == user2['password_hash']}")

    # Wrong password
    wrong_hash, _ = storage.hash_password("wrongpass", user2["salt"])
    print(f"[9] Wrong password match: {wrong_hash == user2['password_hash']}")

    # Cleanup
    await storage.delete_session(token)
    async with aiosqlite.connect(storage.DB_PATH) as db:
        await db.execute("DELETE FROM users WHERE id = ?", (uid,))
        await db.commit()
    print("[10] Cleanup done")

asyncio.run(test())
