import unittest
import os
import tempfile
import sqlite3
from unittest.mock import patch

# Test diff engine and database logic
from src.database import (
    init_db,
    save_profile,
    save_snapshot,
    get_snapshots_for_profile,
    get_latest_two_snapshots
)
from src.diff_engine import calculate_diff

class TestDiffEngine(unittest.TestCase):
    
    @classmethod
    def setUpClass(cls):
        # Initialize DB
        init_db()

    def test_diff_calculation_lifecycle(self):
        # 1. Create a test profile
        profile_data = {
            "username": "test_influencer",
            "full_name": "Test Influencer Official",
            "biography": "Tech & Lifestyle",
            "profile_pic_url": "https://example.com/avatar.jpg",
            "is_verified": True,
            "is_private": False
        }
        profile_id = save_profile(profile_data)
        self.assertIsNotNone(profile_id)

        # 2. Snapshot T0 (Baseline)
        followers_t0 = [
            {"username": "user1", "full_name": "User One", "is_verified": False},
            {"username": "user2", "full_name": "User Two", "is_verified": False},
            {"username": "user3", "full_name": "User Three", "is_verified": True},
        ]
        following_t0 = [
            {"username": "user2", "full_name": "User Two", "is_verified": False},
            {"username": "user4", "full_name": "User Four", "is_verified": False},
        ]

        snap_id_t0 = save_snapshot(
            profile_id=profile_id,
            followers_count=len(followers_t0),
            following_count=len(following_t0),
            posts_count=10,
            followers_list=followers_t0,
            following_list=following_t0,
            note="Baseline T0"
        )

        diff_t0 = calculate_diff(snap_id_t0, None)
        self.assertTrue(diff_t0["is_baseline"])
        self.assertEqual(diff_t0["counts"]["total_followers"], 3)
        self.assertEqual(diff_t0["counts"]["total_following"], 2)
        # Reciprocity at T0:
        # Following: user2, user4. Followers: user1, user2, user3.
        # Not following back: user4 (you follow user4, but user4 is not in followers)
        # Fans: user1, user3 (follow you, but you don't follow them)
        # Mutual: user2
        self.assertEqual(diff_t0["counts"]["not_following_back_count"], 1)
        self.assertEqual(diff_t0["counts"]["fans_count"], 2)
        self.assertEqual(diff_t0["counts"]["mutual_count"], 1)

        # 3. Snapshot T1 (Changes):
        # Followers: user2, user3, user5 (user1 unfollowed, user5 followed)
        # Following: user2, user6 (user4 unfollowed by you, user6 followed by you)
        followers_t1 = [
            {"username": "user2", "full_name": "User Two", "is_verified": False},
            {"username": "user3", "full_name": "User Three", "is_verified": True},
            {"username": "user5", "full_name": "User Five", "is_verified": False},
        ]
        following_t1 = [
            {"username": "user2", "full_name": "User Two", "is_verified": False},
            {"username": "user6", "full_name": "User Six", "is_verified": False},
        ]

        snap_id_t1 = save_snapshot(
            profile_id=profile_id,
            followers_count=len(followers_t1),
            following_count=len(following_t1),
            posts_count=11,
            followers_list=followers_t1,
            following_list=following_t1,
            note="Snapshot T1"
        )

        diff_t1 = calculate_diff(snap_id_t1, snap_id_t0)
        self.assertFalse(diff_t1["is_baseline"])

        # Check new followers: ['user5']
        new_followers = [u["username"] for u in diff_t1["diffs"]["new_followers"]]
        self.assertEqual(new_followers, ["user5"])

        # Check lost followers: ['user1']
        lost_followers = [u["username"] for u in diff_t1["diffs"]["lost_followers"]]
        self.assertEqual(lost_followers, ["user1"])

        # Check new following: ['user6']
        new_following = [u["username"] for u in diff_t1["diffs"]["new_following"]]
        self.assertEqual(new_following, ["user6"])

        # Check lost following: ['user4']
        lost_following = [u["username"] for u in diff_t1["diffs"]["lost_following"]]
        self.assertEqual(lost_following, ["user4"])

if __name__ == "__main__":
    unittest.main()
