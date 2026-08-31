import unittest
from fastapi.testclient import TestClient
from src.app import app

client = TestClient(app)

class TestExtensionImportModes(unittest.TestCase):
    def test_import_following_mode(self):
        payload = {
            "profile": {
                "username": "test_mode_user",
                "full_name": "Test Mode User",
                "biography": "Bio test",
                "profile_pic_url": "https://example.com/pic.jpg",
                "is_verified": False,
                "is_private": False,
                "posts_count": 10
            },
            "followers": [],
            "following": [
                {
                    "username": "friend1",
                    "full_name": "Friend One",
                    "profile_pic_url": "",
                    "is_verified": False
                },
                {
                    "username": "friend2",
                    "full_name": "Friend Two",
                    "profile_pic_url": "",
                    "is_verified": True
                }
            ],
            "followers_count": 500,
            "following_count": 2,
            "posts_count": 10,
            "target_mode": "following"
        }
        res = client.post("/api/extension/import", json=payload)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertTrue(data["success"])
        self.assertEqual(data["diff"]["counts"]["total_following"], 2)

    def test_import_followers_mode(self):
        payload = {
            "profile": {
                "username": "test_mode_user_2",
                "full_name": "Test User 2",
                "biography": "Bio test 2",
                "profile_pic_url": "",
                "is_verified": False,
                "is_private": False,
                "posts_count": 5
            },
            "followers": [
                {
                    "username": "fan1",
                    "full_name": "Fan One",
                    "profile_pic_url": "",
                    "is_verified": False
                }
            ],
            "following": [],
            "followers_count": 1,
            "following_count": 300,
            "posts_count": 5,
            "target_mode": "followers"
        }
        res = client.post("/api/extension/import", json=payload)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertTrue(data["success"])
        self.assertEqual(data["diff"]["counts"]["total_followers"], 1)

if __name__ == "__main__":
    unittest.main()
