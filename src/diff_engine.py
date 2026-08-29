from typing import Dict, List, Any, Optional, Set
from src.database import get_snapshot_users

def _users_to_dict_map(users: List[Dict[str, Any]]) -> Dict[str, Dict[str, Any]]:
    return {u["username"].lower(): u for u in users}

def _is_ghost_user(user: Dict[str, Any]) -> bool:
    """Identifies potential ghost / inactive followers (no custom avatar or anonymous profile pic)."""
    pic = user.get("profile_pic_url", "")
    if not pic:
        return True
    if "anonymous_profile_picture" in pic or "default_avatar" in pic or "44884218_345707102883719" in pic:
        return True
    return False

def calculate_diff(current_snapshot_id: int, previous_snapshot_id: Optional[int] = None) -> Dict[str, Any]:
    """
    Computes exact set differences, reciprocity metrics, verified VIPs, and ghost accounts.
    """
    # 1. Fetch current users
    curr_followers_raw = get_snapshot_users(current_snapshot_id, user_type="follower")
    curr_following_raw = get_snapshot_users(current_snapshot_id, user_type="following")

    curr_followers_map = _users_to_dict_map(curr_followers_raw)
    curr_following_map = _users_to_dict_map(curr_following_raw)

    curr_followers_set: Set[str] = set(curr_followers_map.keys())
    curr_following_set: Set[str] = set(curr_following_map.keys())

    # Calculate Reciprocity for the current state
    not_following_back_set = curr_following_set - curr_followers_set
    fans_set = curr_followers_set - curr_following_set
    mutual_set = curr_followers_set & curr_following_set

    # Verified followers & Ghost followers
    verified_followers_list = [
        u for u in curr_followers_map.values() if u.get("is_verified")
    ]
    ghost_followers_list = [
        u for u in curr_followers_map.values() if _is_ghost_user(u)
    ]

    # 2. Check if previous snapshot exists
    is_baseline = previous_snapshot_id is None

    new_followers_list = []
    lost_followers_list = []
    new_following_list = []
    lost_following_list = []

    if not is_baseline and previous_snapshot_id is not None:
        prev_followers_raw = get_snapshot_users(previous_snapshot_id, user_type="follower")
        prev_following_raw = get_snapshot_users(previous_snapshot_id, user_type="following")

        prev_followers_map = _users_to_dict_map(prev_followers_raw)
        prev_following_map = _users_to_dict_map(prev_following_raw)

        prev_followers_set: Set[str] = set(prev_followers_map.keys())
        prev_following_set: Set[str] = set(prev_following_map.keys())

        # Sets diff
        new_followers_set = curr_followers_set - prev_followers_set
        lost_followers_set = prev_followers_set - curr_followers_set
        new_following_set = curr_following_set - prev_following_set
        lost_following_set = prev_following_set - curr_following_set

        # Map back to detailed objects
        new_followers_list = [curr_followers_map[u] for u in sorted(new_followers_set)]
        lost_followers_list = [prev_followers_map[u] for u in sorted(lost_followers_set)]
        new_following_list = [curr_following_map[u] for u in sorted(new_following_set)]
        lost_following_list = [prev_following_map[u] for u in sorted(lost_following_set)]

    # Map reciprocity objects
    not_following_back_list = [curr_following_map[u] for u in sorted(not_following_back_set)]
    fans_list = [curr_followers_map[u] for u in sorted(fans_set)]
    mutual_list = [curr_followers_map[u] for u in sorted(mutual_set)]

    return {
        "is_baseline": is_baseline,
        "current_snapshot_id": current_snapshot_id,
        "previous_snapshot_id": previous_snapshot_id,
        "counts": {
            "total_followers": max(len(curr_followers_raw), len(curr_followers_set)),
            "total_following": max(len(curr_following_raw), len(curr_following_set)),
            "unique_followers_count": len(curr_followers_set),
            "unique_following_count": len(curr_following_set),
            "new_followers_count": len(new_followers_list),
            "lost_followers_count": len(lost_followers_list),
            "new_following_count": len(new_following_list),
            "lost_following_count": len(lost_following_list),
            "not_following_back_count": len(not_following_back_list),
            "fans_count": len(fans_list),
            "mutual_count": len(mutual_list),
            "verified_followers_count": len(verified_followers_list),
            "ghost_followers_count": len(ghost_followers_list)
        },
        "diffs": {
            "new_followers": new_followers_list,
            "lost_followers": lost_followers_list,
            "new_following": new_following_list,
            "lost_following": lost_following_list
        },
        "reciprocity": {
            "not_following_back": not_following_back_list,
            "fans": fans_list,
            "mutual": mutual_list,
            "verified_followers": verified_followers_list,
            "ghost_followers": ghost_followers_list
        }
    }
