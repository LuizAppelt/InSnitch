import time
import random
import os
from typing import Dict, List, Any, Optional
import requests
import instaloader
from src.database import get_profile_by_username, get_latest_two_snapshots, get_snapshot_users

# Mock state store to simulate realistic progressive changes across multiple scans
_MOCK_PROFILES_STATE: Dict[str, Dict[str, Any]] = {}

# Sample realistic avatars and names for mock simulation
MOCK_SAMPLE_USERS = [
    {"username": "gabriel_tech", "full_name": "Gabriel Souza", "is_verified": False, "avatar": "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80"},
    {"username": "mariana_dev", "full_name": "Mariana Lima", "is_verified": True, "avatar": "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80"},
    {"username": "lucas.silva99", "full_name": "Lucas Silva", "is_verified": False, "avatar": "https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=150&auto=format&fit=crop&q=80"},
    {"username": "carol_fotografia", "full_name": "Carolina Mendes", "is_verified": False, "avatar": "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80"},
    {"username": "rodrigo_creator", "full_name": "Rodrigo Alves", "is_verified": True, "avatar": "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80"},
    {"username": "beatriz_design", "full_name": "Beatriz Costa", "is_verified": False, "avatar": "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&auto=format&fit=crop&q=80"},
    {"username": "felipe_code", "full_name": "Felipe Rocha", "is_verified": False, "avatar": "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80"},
    {"username": "juliana.viaja", "full_name": "Juliana Martins", "is_verified": False, "avatar": "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80"},
    {"username": "andre_fitness", "full_name": "André Pereira", "is_verified": False, "avatar": "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=150&auto=format&fit=crop&q=80"},
    {"username": "camila_art", "full_name": "Camila Ribeiro", "is_verified": False, "avatar": "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80"},
    {"username": "thiago_startup", "full_name": "Thiago Dias", "is_verified": True, "avatar": "https://images.unsplash.com/photo-1628157582853-a796fa650a6a?w=150&auto=format&fit=crop&q=80"},
    {"username": "larissa.estilo", "full_name": "Larissa Barbosa", "is_verified": False, "avatar": "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80"},
    {"username": "marcos_musica", "full_name": "Marcos Vinicius", "is_verified": False, "avatar": "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150&auto=format&fit=crop&q=80"},
    {"username": "amanda_nutri", "full_name": "Amanda Duarte", "is_verified": False, "avatar": "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=150&auto=format&fit=crop&q=80"},
    {"username": "gustavo_techlead", "full_name": "Gustavo Ramos", "is_verified": True, "avatar": "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80"},
    {"username": "user_74892918", "full_name": "", "is_verified": False, "avatar": "https://instagram.fpoa8-1.fna.fbcdn.net/v/t51.2885-19/44884218_345707102883719_default_avatar.jpg"},
    {"username": "ghost_account_99", "full_name": "Sem Nome", "is_verified": False, "avatar": ""}
]

def _generate_mock_dataset(username: str) -> Dict[str, Any]:
    username = username.lower().replace("@", "").strip()

    if username not in _MOCK_PROFILES_STATE:
        base_followers = MOCK_SAMPLE_USERS[:10].copy()
        base_following = MOCK_SAMPLE_USERS[3:12].copy()
        
        _MOCK_PROFILES_STATE[username] = {
            "profile": {
                "username": username,
                "full_name": f"{username.capitalize()} Official",
                "biography": f"✨ Perfil Oficial @{username} | Criador de Conteúdo & Tech 🚀\n📍 São Paulo, Brasil",
                "profile_pic_url": "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&auto=format&fit=crop&q=80",
                "is_verified": True if "tech" in username or "official" in username else False,
                "is_private": False,
                "posts_count": 42
            },
            "followers": base_followers,
            "following": base_following,
            "scan_count": 1
        }
    else:
        state = _MOCK_PROFILES_STATE[username]
        state["scan_count"] += 1
        curr_followers = list(state["followers"])
        curr_following = list(state["following"])

        current_f_usernames = {u["username"] for u in curr_followers}
        available_new_users = [u for u in MOCK_SAMPLE_USERS if u["username"] not in current_f_usernames]

        if available_new_users:
            num_new = min(random.randint(1, 2), len(available_new_users))
            new_additions = random.sample(available_new_users, num_new)
            curr_followers.extend(new_additions)

        if len(curr_followers) > 6 and random.random() > 0.3:
            drop_idx = random.randint(0, len(curr_followers) - 1)
            curr_followers.pop(drop_idx)

        current_g_usernames = {u["username"] for u in curr_following}
        available_new_following = [u for u in MOCK_SAMPLE_USERS if u["username"] not in current_g_usernames]
        if available_new_following and random.random() > 0.5:
            curr_following.append(random.choice(available_new_following))
        if len(curr_following) > 5 and random.random() > 0.6:
            curr_following.pop(random.randint(0, len(curr_following) - 1))

        state["followers"] = curr_followers
        state["following"] = curr_following
        state["profile"]["posts_count"] += random.choice([0, 1])

    state = _MOCK_PROFILES_STATE[username]
    return {
        "profile": state["profile"],
        "followers_count": len(state["followers"]),
        "following_count": len(state["following"]),
        "posts_count": state["profile"]["posts_count"],
        "followers": state["followers"],
        "following": state["following"]
    }

def fetch_instagram_data_real(
    username: str, 
    session_id_cookie: Optional[str] = None
) -> Dict[str, Any]:
    """
    Fetches real Instagram followers and following using the authenticated session cookie.
    """
    clean_username = username.lower().replace("@", "").strip()

    if not session_id_cookie:
        raise PermissionError(
            "Nenhum cookie de sessão configurado. Configure seu cookie 'sessionid' nas Configurações para realizar varreduras reais no Instagram."
        )

    # Extract ds_user_id from sessionid if present
    user_id = session_id_cookie.split("%3A")[0].split(":")[0]

    session = requests.Session()
    session.cookies.set("sessionid", session_id_cookie, domain=".instagram.com")
    session.cookies.set("ds_user_id", user_id, domain=".instagram.com")

    mobile_headers = {
        "User-Agent": "Instagram 278.0.0.19.115 Android (33/13; 420dpi; 1080x2400; samsung; SM-G991B; o1s; exynos2100)",
        "Accept-Language": "pt-BR, en-US",
        "X-IG-App-ID": "1217981644879628",
        "X-IG-Capabilities": "3677",
        "X-IG-Connection-Type": "WIFI",
    }

    # 1. Resolve user profile via search/lookup
    search_url = f"https://i.instagram.com/api/v1/users/search/?q={clean_username}"
    try:
        s_resp = session.get(search_url, headers=mobile_headers, timeout=10)
    except Exception as e:
        raise RuntimeError(f"Erro de conexão com o Instagram: {str(e)}")

    if s_resp.status_code == 403 or s_resp.status_code == 401:
        raise PermissionError("Sessão do Instagram expirada ou inválida. Por favor, atualize o cookie 'sessionid' nas Configurações.")

    if s_resp.status_code != 200:
        raise RuntimeError(f"Erro retornado pelo Instagram (HTTP {s_resp.status_code}).")

    users_found = s_resp.json().get("users", [])
    target_user = None
    for u in users_found:
        if u.get("username", "").lower() == clean_username:
            target_user = u
            break

    if not target_user:
        # Fallback to first exact match or first result
        if users_found:
            target_user = users_found[0]
        else:
            raise ValueError(f"O perfil @{clean_username} não foi encontrado no Instagram.")

    target_id = target_user.get("pk")
    is_private = target_user.get("is_private", False)

    # 2. Fetch followers list with pagination (up to 5,000 users)
    followers_list = []
    max_id = None
    for page in range(200):
        f_url = f"https://i.instagram.com/api/v1/friendships/{target_id}/followers/"
        if max_id:
            f_url += f"?max_id={max_id}"
        
        try:
            r_f = session.get(f_url, headers=mobile_headers, timeout=10)
            if r_f.status_code != 200:
                break
            data = r_f.json()
            users = data.get("users", [])
            for f in users:
                followers_list.append({
                    "username": f.get("username", ""),
                    "full_name": f.get("full_name", ""),
                    "profile_pic_url": f.get("profile_pic_url", ""),
                    "is_verified": f.get("is_verified", False)
                })
            max_id = data.get("next_max_id")
            if not max_id or not users:
                break
            time.sleep(0.15)
        except Exception:
            break

    # 3. Fetch following list with pagination (up to 5,000 users)
    following_list = []
    max_id = None
    for page in range(200):
        g_url = f"https://i.instagram.com/api/v1/friendships/{target_id}/following/"
        if max_id:
            g_url += f"?max_id={max_id}"
        
        try:
            r_g = session.get(g_url, headers=mobile_headers, timeout=10)
            if r_g.status_code != 200:
                break
            data = r_g.json()
            users = data.get("users", [])
            for g in users:
                following_list.append({
                    "username": g.get("username", ""),
                    "full_name": g.get("full_name", ""),
                    "profile_pic_url": g.get("profile_pic_url", ""),
                    "is_verified": g.get("is_verified", False)
                })
            max_id = data.get("next_max_id")
            if not max_id or not users:
                break
            time.sleep(0.15)
        except Exception:
            break

    return {
        "profile": {
            "username": target_user.get("username", clean_username),
            "full_name": target_user.get("full_name", ""),
            "biography": target_user.get("biography", ""),
            "profile_pic_url": target_user.get("profile_pic_url", ""),
            "is_verified": target_user.get("is_verified", False),
            "is_private": is_private,
            "posts_count": target_user.get("media_count", 0)
        },
        "followers_count": len(followers_list),
        "following_count": len(following_list),
        "posts_count": target_user.get("media_count", 0),
        "followers": followers_list,
        "following": following_list
    }

def fetch_profile_data(
    username: str, 
    use_mock: bool = False,
    session_id_cookie: Optional[str] = None
) -> Dict[str, Any]:
    """
    Unified entrypoint to fetch Instagram profile data either in Mock Demo mode or Real Instagram mode.
    """
    if use_mock:
        return _generate_mock_dataset(username)
    else:
        return fetch_instagram_data_real(
            username=username,
            session_id_cookie=session_id_cookie
        )
