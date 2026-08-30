import sqlite3
import json
from datetime import datetime
from typing import List, Dict, Any, Optional, Tuple
from src.config import DATABASE_PATH

def get_connection():
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    """Initializes the SQLite database tables."""
    conn = get_connection()
    cursor = conn.cursor()

    cursor.executescript("""
    CREATE TABLE IF NOT EXISTS profiles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        full_name TEXT,
        biography TEXT,
        profile_pic_url TEXT,
        is_verified INTEGER DEFAULT 0,
        is_private INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS snapshots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        profile_id INTEGER NOT NULL,
        followers_count INTEGER DEFAULT 0,
        following_count INTEGER DEFAULT 0,
        posts_count INTEGER DEFAULT 0,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        note TEXT,
        FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS snapshot_users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        snapshot_id INTEGER NOT NULL,
        username TEXT NOT NULL,
        full_name TEXT,
        profile_pic_url TEXT,
        is_verified INTEGER DEFAULT 0,
        user_type TEXT NOT NULL, -- 'follower' or 'following'
        FOREIGN KEY (snapshot_id) REFERENCES snapshots(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS ai_reports (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        profile_id INTEGER NOT NULL,
        snapshot_id INTEGER NOT NULL,
        previous_snapshot_id INTEGER,
        report_text TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE,
        FOREIGN KEY (snapshot_id) REFERENCES snapshots(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS app_settings (
        key TEXT PRIMARY KEY,
        value TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_snapshot_users_lookup 
    ON snapshot_users(snapshot_id, user_type, username);

    CREATE INDEX IF NOT EXISTS idx_snapshots_profile_time 
    ON snapshots(profile_id, timestamp DESC);
    """)

    conn.commit()
    conn.close()

def save_profile(profile_data: Dict[str, Any]) -> int:
    """Inserts or updates a tracked Instagram profile."""
    conn = get_connection()
    cursor = conn.cursor()
    
    username = profile_data["username"].lower().replace("@", "").strip()
    
    cursor.execute("""
    INSERT INTO profiles (username, full_name, biography, profile_pic_url, is_verified, is_private, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(username) DO UPDATE SET
        full_name = excluded.full_name,
        biography = excluded.biography,
        profile_pic_url = excluded.profile_pic_url,
        is_verified = excluded.is_verified,
        is_private = excluded.is_private,
        updated_at = CURRENT_TIMESTAMP;
    """, (
        username,
        profile_data.get("full_name", ""),
        profile_data.get("biography", ""),
        profile_data.get("profile_pic_url", ""),
        1 if profile_data.get("is_verified") else 0,
        1 if profile_data.get("is_private") else 0
    ))
    
    cursor.execute("SELECT id FROM profiles WHERE username = ?", (username,))
    row = cursor.fetchone()
    profile_id = row["id"]
    
    conn.commit()
    conn.close()
    return profile_id

def get_profile_by_username(username: str) -> Optional[Dict[str, Any]]:
    clean_username = username.lower().replace("@", "").strip()
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM profiles WHERE username = ?", (clean_username,))
    row = cursor.fetchone()
    conn.close()
    if row:
        return dict(row)
    return None

def get_all_profiles() -> List[Dict[str, Any]]:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
    SELECT p.*, 
           (SELECT COUNT(*) FROM snapshots WHERE profile_id = p.id) as total_snapshots,
           (SELECT timestamp FROM snapshots WHERE profile_id = p.id ORDER BY timestamp DESC LIMIT 1) as last_scanned
    FROM profiles p
    ORDER BY p.updated_at DESC
    """)
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

def delete_profile_by_username(username: str) -> bool:
    clean_username = username.lower().replace("@", "").strip()
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM profiles WHERE username = ?", (clean_username,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        return False
    
    profile_id = row["id"]
    cursor.execute("PRAGMA foreign_keys = ON;")
    cursor.execute("DELETE FROM profiles WHERE id = ?", (profile_id,))
    conn.commit()
    conn.close()
    return True

def save_snapshot(
    profile_id: int,
    followers_count: int,
    following_count: int,
    posts_count: int,
    followers_list: List[Dict[str, Any]],
    following_list: List[Dict[str, Any]],
    note: str = ""
) -> int:
    """Saves a new snapshot and all its associated followers and following users with strict deduplication."""
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
    INSERT INTO snapshots (profile_id, followers_count, following_count, posts_count, note)
    VALUES (?, ?, ?, ?, ?)
    """, (profile_id, followers_count, following_count, posts_count, note))
    
    snapshot_id = cursor.lastrowid

    # Insert unique followers
    users_to_insert = []
    seen_followers = set()
    for u in followers_list:
        uname = (u.get("username") or "").lower().strip()
        if not uname or uname in seen_followers:
            continue
        seen_followers.add(uname)
        users_to_insert.append((
            snapshot_id,
            uname,
            u.get("full_name", ""),
            u.get("profile_pic_url", ""),
            1 if u.get("is_verified") else 0,
            "follower"
        ))
    
    # Insert unique following
    seen_following = set()
    for u in following_list:
        uname = (u.get("username") or "").lower().strip()
        if not uname or uname in seen_following:
            continue
        seen_following.add(uname)
        users_to_insert.append((
            snapshot_id,
            uname,
            u.get("full_name", ""),
            u.get("profile_pic_url", ""),
            1 if u.get("is_verified") else 0,
            "following"
        ))

    if users_to_insert:
        cursor.executemany("""
        INSERT INTO snapshot_users (snapshot_id, username, full_name, profile_pic_url, is_verified, user_type)
        VALUES (?, ?, ?, ?, ?, ?)
        """, users_to_insert)

    conn.commit()
    conn.close()
    return snapshot_id

def get_snapshots_for_profile(profile_id: int) -> List[Dict[str, Any]]:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
    SELECT * FROM snapshots 
    WHERE profile_id = ? 
    ORDER BY timestamp DESC
    """, (profile_id,))
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

def get_snapshot_users(snapshot_id: int, user_type: Optional[str] = None) -> List[Dict[str, Any]]:
    conn = get_connection()
    cursor = conn.cursor()
    if user_type:
        cursor.execute("""
        SELECT username, full_name, profile_pic_url, is_verified, user_type
        FROM snapshot_users
        WHERE snapshot_id = ? AND user_type = ?
        """, (snapshot_id, user_type))
    else:
        cursor.execute("""
        SELECT username, full_name, profile_pic_url, is_verified, user_type
        FROM snapshot_users
        WHERE snapshot_id = ?
        """, (snapshot_id,))
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

def get_latest_two_snapshots(profile_id: int) -> Tuple[Optional[Dict[str, Any]], Optional[Dict[str, Any]]]:
    """Returns (latest_snapshot, previous_snapshot) or None for missing ones."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
    SELECT * FROM snapshots 
    WHERE profile_id = ? 
    ORDER BY timestamp DESC 
    LIMIT 2
    """, (profile_id,))
    rows = cursor.fetchall()
    conn.close()
    
    if not rows:
        return (None, None)
    if len(rows) == 1:
        return (dict(rows[0]), None)
    return (dict(rows[0]), dict(rows[1]))

def save_ai_report(profile_id: int, snapshot_id: int, previous_snapshot_id: Optional[int], report_text: str) -> int:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
    INSERT INTO ai_reports (profile_id, snapshot_id, previous_snapshot_id, report_text)
    VALUES (?, ?, ?, ?)
    """, (profile_id, snapshot_id, previous_snapshot_id, report_text))
    report_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return report_id

def get_latest_ai_report(profile_id: int) -> Optional[Dict[str, Any]]:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
    SELECT * FROM ai_reports 
    WHERE profile_id = ? 
    ORDER BY created_at DESC 
    LIMIT 1
    """, (profile_id,))
    row = cursor.fetchone()
    conn.close()
    if row:
        return dict(row)
    return None

def set_setting(key: str, value: str):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
    INSERT INTO app_settings (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
    """, (key, value))
    conn.commit()
    conn.close()

def get_setting(key: str, default: Optional[str] = None) -> Optional[str]:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT value FROM app_settings WHERE key = ?", (key,))
    row = cursor.fetchone()
    conn.close()
    if row:
        return row["value"]
    return default
