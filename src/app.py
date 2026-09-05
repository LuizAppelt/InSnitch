import os
import re
from typing import Optional, Dict, Any
from fastapi import FastAPI, HTTPException, Query
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from src.config import BASE_DIR, GEMINI_API_KEY
from src.database import (
    init_db,
    save_profile,
    get_profile_by_username,
    get_all_profiles,
    delete_profile_by_username,
    delete_snapshot_by_id,
    save_snapshot,
    get_snapshots_for_profile,
    get_latest_two_snapshots,
    get_snapshot_users,
    save_ai_report,
    get_latest_ai_report,
    set_setting,
    get_setting
)
from src.diff_engine import calculate_diff, get_profile_history_events
from src.instagram_service import fetch_profile_data
from src.ai_reporter import generate_ai_report

# Initialize database
init_db()

app = FastAPI(
    title="InSnitch - Instagram Follow & Unfollow AI",
    version="1.0.0",
    description="Sistema inteligente InSnitch de monitoramento de seguidores, reciprocidade e unfollows do Instagram com IA."
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Helper to clean usernames from URLs or mentions
def sanitize_username(input_str: str) -> str:
    input_str = input_str.strip()
    # Match instagram.com/username pattern
    url_match = re.search(r"instagram\.com/([a-zA-Z0-9_\.]+)", input_str)
    if url_match:
        return url_match.group(1).lower()
    return input_str.replace("@", "").replace("/", "").strip().lower()

# Request models
class TrackRequest(BaseModel):
    username_or_url: str
    use_mock: Optional[bool] = None

class SettingsRequest(BaseModel):
    gemini_api_key: Optional[str] = None
    instagram_session_cookie: Optional[str] = None
    mock_mode_default: Optional[bool] = None

class ExtensionUserItem(BaseModel):
    username: str
    full_name: Optional[str] = ""
    profile_pic_url: Optional[str] = ""
    is_verified: Optional[bool] = False

class ExtensionProfileData(BaseModel):
    username: str
    full_name: Optional[str] = ""
    biography: Optional[str] = ""
    profile_pic_url: Optional[str] = ""
    is_verified: Optional[bool] = False
    is_private: Optional[bool] = False
    posts_count: Optional[int] = 0

class ExtensionImportRequest(BaseModel):
    profile: ExtensionProfileData
    followers: list[ExtensionUserItem] = []
    following: list[ExtensionUserItem] = []
    followers_count: Optional[int] = None
    following_count: Optional[int] = None
    posts_count: Optional[int] = None
    target_mode: Optional[str] = "both"

# Routes
@app.get("/")
async def root():
    return FileResponse(str(BASE_DIR / "static" / "index.html"))

@app.get("/api/profiles")
async def list_profiles():
    profiles = get_all_profiles()
    return {"profiles": profiles}

@app.post("/api/profiles/track")
async def track_profile(req: TrackRequest):
    username = sanitize_username(req.username_or_url)
    if not username:
        raise HTTPException(status_code=400, detail="Nome de usuário ou URL inválido.")

    # Determine mock vs real mode
    if req.use_mock is not None:
        use_mock = req.use_mock
    else:
        setting_val = get_setting("mock_mode_default", str(MOCK_MODE_DEFAULT))
        use_mock = setting_val.lower() in ("true", "1", "yes")

    session_cookie = get_setting("instagram_session_cookie", INSTAGRAM_SESSION_COOKIE)

    try:
        data = fetch_profile_data(
            username=username,
            use_mock=use_mock,
            session_id_cookie=session_cookie if session_cookie else None
        )
    except ValueError as ve:
        raise HTTPException(status_code=404, detail=str(ve))
    except PermissionError as pe:
        raise HTTPException(status_code=403, detail=str(pe))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Falha na coleta de dados: {str(e)}")

    # Save or update profile in DB
    profile_id = save_profile(data["profile"])

    # Get the snapshot before this new one
    latest_existing_snapshot, _ = get_latest_two_snapshots(profile_id)
    prev_snapshot_id = latest_existing_snapshot["id"] if latest_existing_snapshot else None

    # Save new snapshot
    new_snapshot_id = save_snapshot(
        profile_id=profile_id,
        followers_count=data["followers_count"],
        following_count=data["following_count"],
        posts_count=data["posts_count"],
        followers_list=data["followers"],
        following_list=data["following"],
        note=f"Scan via {'Simulação (Demo)' if use_mock else 'Instagram Real'}"
    )

    # Compute diff
    diff_result = calculate_diff(new_snapshot_id, prev_snapshot_id)

    # Generate AI report
    gemini_key = get_setting("gemini_api_key", GEMINI_API_KEY)
    ai_report_text = generate_ai_report(
        profile_data=data["profile"],
        diff_data=diff_result,
        api_key=gemini_key
    )
    save_ai_report(profile_id, new_snapshot_id, prev_snapshot_id, ai_report_text)

    # Return full package
    profile_obj = get_profile_by_username(username)
    history_events = get_profile_history_events(profile_id)

    return {
        "success": True,
        "profile": profile_obj,
        "current_snapshot_id": new_snapshot_id,
        "previous_snapshot_id": prev_snapshot_id,
        "diff": diff_result,
        "history_events": history_events,
        "ai_report": ai_report_text
    }

@app.post("/api/extension/import")
async def extension_import(req: ExtensionImportRequest):
    username = sanitize_username(req.profile.username)
    if not username:
        raise HTTPException(status_code=400, detail="Nome de usuário inválido na importação.")

    target_mode = (req.target_mode or "both").lower().strip()

    profile_dict = {
        "username": username,
        "full_name": req.profile.full_name or "",
        "biography": req.profile.biography or "",
        "profile_pic_url": req.profile.profile_pic_url or "",
        "is_verified": req.profile.is_verified,
        "is_private": req.profile.is_private,
        "posts_count": req.profile.posts_count or req.posts_count or 0
    }

    profile_id = save_profile(profile_dict)

    latest_existing_snapshot, _ = get_latest_two_snapshots(profile_id)
    prev_snapshot_id = latest_existing_snapshot["id"] if latest_existing_snapshot else None

    followers_list = [
        {
            "username": f.username.lower().strip(),
            "full_name": f.full_name or "",
            "profile_pic_url": f.profile_pic_url or "",
            "is_verified": f.is_verified or False
        }
        for f in req.followers
    ]

    following_list = [
        {
            "username": g.username.lower().strip(),
            "full_name": g.full_name or "",
            "profile_pic_url": g.profile_pic_url or "",
            "is_verified": g.is_verified or False
        }
        for g in req.following
    ]

    expected_followers = req.followers_count or req.profile.followers_count or 0
    expected_following = req.following_count or req.profile.following_count or 0

    # Handling mode-specific list preservation
    if target_mode == "following":
        # User only scanned following list: preserve previous followers if available
        if prev_snapshot_id:
            prev_followers_raw = get_snapshot_users(prev_snapshot_id, user_type="follower")
            followers_list = [
                {
                    "username": f["username"],
                    "full_name": f.get("full_name", ""),
                    "profile_pic_url": f.get("profile_pic_url", ""),
                    "is_verified": bool(f.get("is_verified", False))
                }
                for f in prev_followers_raw
            ]
        followers_count = expected_followers or len(followers_list)
        following_count = expected_following or len(following_list)
        note = "Sincronizado apenas Seguidos via Extensão"

        if expected_following > 10 and len(following_list) == 0:
            raise HTTPException(
                status_code=400,
                detail=f"A lista de seguidos retornou vazia (0 de {expected_following}). O snapshot foi cancelado para proteger o histórico."
            )

    elif target_mode == "followers":
        # User only scanned followers list: preserve previous following if available
        if prev_snapshot_id:
            prev_following_raw = get_snapshot_users(prev_snapshot_id, user_type="following")
            following_list = [
                {
                    "username": g["username"],
                    "full_name": g.get("full_name", ""),
                    "profile_pic_url": g.get("profile_pic_url", ""),
                    "is_verified": bool(g.get("is_verified", False))
                }
                for g in prev_following_raw
            ]
        followers_count = expected_followers or len(followers_list)
        following_count = expected_following or len(following_list)
        note = "Sincronizado apenas Seguidores via Extensão"

        if expected_followers > 10 and len(followers_list) == 0:
            raise HTTPException(
                status_code=400,
                detail=f"A lista de seguidores retornou vazia (0 de {expected_followers}). O snapshot foi cancelado para proteger o histórico."
            )

    else:
        # Full scan: both followers & following
        followers_count = expected_followers or len(followers_list)
        following_count = expected_following or len(following_list)
        note = "Sincronizado via Extensão do Navegador"

        if expected_followers > 10 and len(followers_list) == 0:
            raise HTTPException(
                status_code=400,
                detail=f"A lista de seguidores retornou vazia (0 de {expected_followers}). O snapshot foi cancelado para proteger o histórico de dados."
            )
        if expected_following > 10 and len(following_list) == 0:
            raise HTTPException(
                status_code=400,
                detail=f"A lista de seguidos retornou vazia (0 de {expected_following}). O snapshot foi cancelado para proteger o histórico de dados."
            )

    posts_count = req.posts_count or req.profile.posts_count or 0

    new_snapshot_id = save_snapshot(
        profile_id=profile_id,
        followers_count=followers_count,
        following_count=following_count,
        posts_count=posts_count,
        followers_list=followers_list,
        following_list=following_list,
        note=note
    )

    diff_result = calculate_diff(new_snapshot_id, prev_snapshot_id)

    gemini_key = get_setting("gemini_api_key", GEMINI_API_KEY)
    ai_report_text = generate_ai_report(
        profile_data=profile_dict,
        diff_data=diff_result,
        api_key=gemini_key
    )
    save_ai_report(profile_id, new_snapshot_id, prev_snapshot_id, ai_report_text)

    profile_obj = get_profile_by_username(username)
    history_events = get_profile_history_events(profile_id)

    return {
        "success": True,
        "message": f"Perfil @{username} sincronizado com sucesso!",
        "profile": profile_obj,
        "snapshot_id": new_snapshot_id,
        "diff": diff_result,
        "history_events": history_events,
        "ai_report": ai_report_text
    }

@app.get("/api/profiles")
async def list_profiles():
    profiles = get_all_profiles()
    return {"profiles": profiles}

@app.delete("/api/profiles/{username}")
async def delete_profile_endpoint(username: str):
    clean_username = sanitize_username(username)
    success = delete_profile_by_username(clean_username)
    if not success:
        raise HTTPException(status_code=404, detail="Perfil não encontrado para exclusão.")
    return {"success": True, "message": f"Perfil @{clean_username} excluído com sucesso."}

@app.get("/api/profiles/{username}/diff")
async def get_profile_diff(username: str):
    clean_username = sanitize_username(username)
    profile = get_profile_by_username(clean_username)
    if not profile:
        raise HTTPException(status_code=404, detail="Perfil não encontrado.")

    latest_snap, prev_snap = get_latest_two_snapshots(profile["id"])
    if not latest_snap:
        return {
            "profile": profile,
            "latest_snapshot": None,
            "previous_snapshot": None,
            "diff": {
                "is_baseline": True,
                "counts": {
                    "total_followers": 0,
                    "total_following": 0,
                    "new_followers_count": 0,
                    "lost_followers_count": 0,
                    "new_following_count": 0,
                    "lost_following_count": 0,
                    "not_following_back_count": 0,
                    "fans_count": 0,
                    "mutual_count": 0,
                    "verified_followers_count": 0,
                    "ghost_followers_count": 0
                },
                "diffs": {
                    "new_followers": [],
                    "lost_followers": [],
                    "new_following": [],
                    "lost_following": []
                },
                "reciprocity": {
                    "not_following_back": [],
                    "fans": [],
                    "mutual": [],
                    "verified": [],
                    "ghosts": []
                }
            },
            "history_events": {
                "snapshots": [],
                "all_time_events": {
                    "new_followers": [],
                    "lost_followers": [],
                    "new_following": [],
                    "lost_following": []
                },
                "all_time_counts": {
                    "total_new_followers": 0,
                    "total_lost_followers": 0,
                    "total_new_following": 0,
                    "total_lost_following": 0
                }
            },
            "ai_report": ""
        }

    prev_id = prev_snap["id"] if prev_snap else None
    diff_result = calculate_diff(latest_snap["id"], prev_id)
    ai_report = get_latest_ai_report(profile["id"])
    history_events = get_profile_history_events(profile["id"])

    return {
        "profile": profile,
        "latest_snapshot": latest_snap,
        "previous_snapshot": prev_snap,
        "diff": diff_result,
        "history_events": history_events,
        "ai_report": ai_report["report_text"] if ai_report else ""
    }

@app.get("/api/profiles/{username}/snapshots/{snapshot_id}/diff")
async def get_specific_snapshot_diff(username: str, snapshot_id: int):
    clean_username = sanitize_username(username)
    profile = get_profile_by_username(clean_username)
    if not profile:
        raise HTTPException(status_code=404, detail="Perfil não encontrado.")

    snapshots = get_snapshots_for_profile(profile["id"])
    # Find snapshot index in chronologically ordered list
    chronological = list(reversed(snapshots))
    target_idx = None
    for idx, s in enumerate(chronological):
        if s["id"] == snapshot_id:
            target_idx = idx
            break

    if target_idx is None:
        raise HTTPException(status_code=404, detail="Snapshot não encontrado.")

    prev_id = chronological[target_idx - 1]["id"] if target_idx > 0 else None
    diff_result = calculate_diff(snapshot_id, prev_id)

    return {
        "profile": profile,
        "current_snapshot": chronological[target_idx],
        "previous_snapshot": chronological[target_idx - 1] if target_idx > 0 else None,
        "diff": diff_result
    }

@app.delete("/api/profiles/{username}/snapshots/{snapshot_id}")
async def delete_specific_snapshot(username: str, snapshot_id: int):
    clean_username = sanitize_username(username)
    profile = get_profile_by_username(clean_username)
    if not profile:
        raise HTTPException(status_code=404, detail="Perfil não encontrado.")

    snapshots = get_snapshots_for_profile(profile["id"])
    if not any(s["id"] == snapshot_id for s in snapshots):
        raise HTTPException(status_code=404, detail="Snapshot não pertence a este perfil.")

    success = delete_snapshot_by_id(snapshot_id)
    if not success:
        raise HTTPException(status_code=400, detail="Erro ao excluir snapshot.")

    return {
        "success": True,
        "message": f"Varredura #{snapshot_id} excluída com sucesso."
    }

@app.get("/api/profiles/{username}/history")
async def get_profile_history(username: str):
    clean_username = sanitize_username(username)
    profile = get_profile_by_username(clean_username)
    if not profile:
        raise HTTPException(status_code=404, detail="Perfil não encontrado.")

    snapshots = get_snapshots_for_profile(profile["id"])
    # Format for chart (oldest to newest)
    chart_data = {
        "labels": [s["timestamp"] for s in reversed(snapshots)],
        "followers": [s["followers_count"] for s in reversed(snapshots)],
        "following": [s["following_count"] for s in reversed(snapshots)]
    }

    return {
        "profile": profile,
        "snapshots": snapshots,
        "chart_data": chart_data
    }

@app.post("/api/profiles/{username}/ai-report")
async def trigger_ai_report(username: str):
    clean_username = sanitize_username(username)
    profile = get_profile_by_username(clean_username)
    if not profile:
        raise HTTPException(status_code=404, detail="Perfil não encontrado.")

    latest_snap, prev_snap = get_latest_two_snapshots(profile["id"])
    if not latest_snap:
        raise HTTPException(status_code=404, detail="Nenhum snapshot encontrado.")

    prev_id = prev_snap["id"] if prev_snap else None
    diff_result = calculate_diff(latest_snap["id"], prev_id)

    gemini_key = get_setting("gemini_api_key", GEMINI_API_KEY)
    ai_report_text = generate_ai_report(
        profile_data=profile,
        diff_data=diff_result,
        api_key=gemini_key
    )
    save_ai_report(profile["id"], latest_snap["id"], prev_id, ai_report_text)

    return {
        "ai_report": ai_report_text
    }

@app.get("/api/settings")
async def get_app_settings():
    from src.config import INSTAGRAM_SESSION_COOKIE, MOCK_MODE_DEFAULT
    key = get_setting("gemini_api_key", GEMINI_API_KEY)
    cookie = get_setting("instagram_session_cookie", INSTAGRAM_SESSION_COOKIE)
    mock_mode = get_setting("mock_mode_default", str(MOCK_MODE_DEFAULT)).lower() in ("true", "1", "yes")

    return {
        "has_gemini_key": bool(key and len(key) > 5),
        "gemini_api_key_masked": f"{key[:6]}...{key[-4:]}" if (key and len(key) > 10) else "",
        "has_session_cookie": bool(cookie and len(cookie) > 5),
        "session_cookie_masked": f"{cookie[:10]}...{cookie[-6:]}" if (cookie and len(cookie) > 16) else "",
        "mock_mode_default": mock_mode
    }

@app.post("/api/settings")
async def update_app_settings(req: SettingsRequest):
    if req.gemini_api_key is not None:
        set_setting("gemini_api_key", req.gemini_api_key.strip())
    if req.instagram_session_cookie is not None:
        set_setting("instagram_session_cookie", req.instagram_session_cookie.strip())
    if req.mock_mode_default is not None:
        set_setting("mock_mode_default", "true" if req.mock_mode_default else "false")

_IMAGE_CACHE: Dict[str[bytes, str]] = {}

@app.get("/api/image-proxy")
async def image_proxy(url: str = Query(...)):
    import requests
    from fastapi.responses import Response
    
    if url in _IMAGE_CACHE:
        content, content_type = _IMAGE_CACHE[url]
        return Response(
            content=content, 
            media_type=content_type, 
            headers={"Cache-Control": "public, max-age=86400"}
        )

    try:
        resp = requests.get(
            url, 
            headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"},
            timeout=5
        )
        if resp.status_code == 200:
            content_type = resp.headers.get("Content-Type", "image/jpeg")
            if len(_IMAGE_CACHE) < 500:
                _IMAGE_CACHE[url] = (resp.content, content_type)
            return Response(
                content=resp.content, 
                media_type=content_type,
                headers={"Cache-Control": "public, max-age=86400"}
            )
    except Exception:
        pass
    # Fallback to 1x1 transparent PNG if image fails
    transparent_png = b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15c4\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82'
    return Response(content=transparent_png, media_type="image/png")

# Mount static files
app.mount("/static", StaticFiles(directory=str(BASE_DIR / "static")), name="static")
