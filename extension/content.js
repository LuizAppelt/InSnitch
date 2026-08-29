// InstaTracker Content Script - Runs inside Instagram Web tab
console.log("[InstaTracker] Content script ativo na aba do Instagram.");

// Helper to get cookie by name in browser context
function getCookie(name) {
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  return match ? match[2] : null;
}

// Extract current username from URL pathname
function getCurrentPageUsername() {
  const path = window.location.pathname.split('/').filter(Boolean);
  if (path.length === 0) return null;
  const reserved = ['explore', 'direct', 'reels', 'stories', 'accounts', 'p', 'reel', 'tv'];
  if (reserved.includes(path[0].toLowerCase())) return null;
  return path[0].toLowerCase();
}

// Extract profile details from DOM or internal API
async function extractProfileInfo(username) {
  // Try fetching via internal endpoint with browser cookies
  try {
    const headers = {
      'x-ig-app-id': '936619743392459',
      'x-asbd-id': '129477',
      'x-csrftoken': getCookie('csrftoken') || '',
      'x-requested-with': 'XMLHttpRequest',
      'Accept': '*/*'
    };

    const res = await fetch(`https://www.instagram.com/api/v1/users/web_profile_info/?username=${username}`, {
      headers,
      credentials: 'include'
    });

    if (res.ok) {
      const data = await res.json();
      const u = data?.data?.user;
      if (u) {
        return {
          id: u.id,
          username: u.username,
          full_name: u.full_name || "",
          biography: u.biography || "",
          profile_pic_url: u.profile_pic_url_hd || u.profile_pic_url || "",
          is_verified: u.is_verified || false,
          is_private: u.is_private || false,
          posts_count: u.edge_owner_to_timeline_media?.count || 0,
          followers_count: u.edge_followed_by?.count || 0,
          following_count: u.edge_follow?.count || 0
        };
      }
    }
  } catch (e) {
    console.warn("[InstaTracker] Falha ao obter dados via web_profile_info, tentando via DOM:", e);
  }

  // Fallback: Extract from DOM
  const title = document.title || "";
  const nameEl = document.querySelector('header section h2, header section h1');
  const bioEl = document.querySelector('header section h1 + div, header section .-vDIg');
  const avatarEl = document.querySelector('header img');

  return {
    id: null,
    username: username,
    full_name: nameEl ? nameEl.innerText : username,
    biography: bioEl ? bioEl.innerText : "",
    profile_pic_url: avatarEl ? avatarEl.src : "",
    is_verified: !!document.querySelector('header [title="Verificado"]'),
    is_private: false,
    posts_count: 0,
    followers_count: 0,
    following_count: 0
  };
}

// Fetch user list (followers or following) with pagination
async function fetchUserList(userId, type = "followers", onProgress) {
  const users = [];
  let maxId = null;
  const csrf = getCookie('csrftoken') || '';

  const headers = {
    'x-ig-app-id': '936619743392459',
    'x-asbd-id': '129477',
    'x-csrftoken': csrf,
    'x-requested-with': 'XMLHttpRequest',
    'Accept': '*/*'
  };

  // Up to 200 pages (~5,000 users)
  for (let page = 0; page < 200; page++) {
    let url = `https://i.instagram.com/api/v1/friendships/${userId}/${type}/?count=50`;
    if (maxId) {
      url += `&max_id=${encodeURIComponent(maxId)}`;
    }

    try {
      const res = await fetch(url, {
        headers: {
          ...headers,
          'User-Agent': navigator.userAgent
        },
        credentials: 'include'
      });

      if (!res.ok) {
        console.warn(`[InstaTracker] Status ${res.status} ao coletar ${type}`);
        break;
      }

      const data = await res.json();
      const pageUsers = data.users || [];

      for (const u of pageUsers) {
        users.push({
          username: u.username,
          full_name: u.full_name || "",
          profile_pic_url: u.profile_pic_url || "",
          is_verified: u.is_verified || false
        });
      }

      if (onProgress) {
        onProgress(type, users.length);
      }

      maxId = data.next_max_id;
      if (!maxId || pageUsers.length === 0) {
        break;
      }

      // Small delay between pages
      await new Promise(r => setTimeout(r, 250));
    } catch (err) {
      console.error(`[InstaTracker] Erro ao paginar ${type}:`, err);
      break;
    }
  }

  return users;
}

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "GET_CURRENT_PROFILE") {
    const username = getCurrentPageUsername();
    sendResponse({ username });
    return true;
  }

  if (request.action === "EXTRACT_ALL_DATA") {
    (async () => {
      try {
        const username = request.username || getCurrentPageUsername();
        if (!username) {
          sendResponse({ success: false, error: "Nenhum perfil identificado na aba ativa." });
          return;
        }

        // 1. Extract Profile Info
        chrome.runtime.sendMessage({ action: "UPDATE_STATUS", message: "Obtendo dados do perfil..." });
        const profileInfo = await extractProfileInfo(username);

        // If user ID was not found, search for it
        let targetId = profileInfo.id;
        if (!targetId) {
          const searchRes = await fetch(`https://i.instagram.com/api/v1/users/search/?q=${username}`, {
            credentials: 'include',
            headers: { 'x-ig-app-id': '936619743392459' }
          });
          const searchData = await searchRes.json();
          const match = (searchData.users || []).find(u => u.username.toLowerCase() === username.toLowerCase());
          if (match) {
            targetId = match.pk || match.pk_id || match.id;
            if (!profileInfo.profile_pic_url) profileInfo.profile_pic_url = match.profile_pic_url;
            if (!profileInfo.full_name) profileInfo.full_name = match.full_name;
          }
        }

        if (!targetId) {
          sendResponse({ success: false, error: "Não foi possível resolver o ID deste perfil." });
          return;
        }

        // 2. Fetch Followers
        chrome.runtime.sendMessage({ action: "UPDATE_STATUS", message: "Coletando lista de seguidores..." });
        const followers = await fetchUserList(targetId, "followers", (type, count) => {
          chrome.runtime.sendMessage({ action: "UPDATE_STATUS", message: `Coletando seguidores: ${count}...` });
        });

        // 3. Fetch Following
        chrome.runtime.sendMessage({ action: "UPDATE_STATUS", message: "Coletando lista de seguidos..." });
        const following = await fetchUserList(targetId, "following", (type, count) => {
          chrome.runtime.sendMessage({ action: "UPDATE_STATUS", message: `Coletando seguindo: ${count}...` });
        });

        const packageData = {
          profile: {
            username: profileInfo.username,
            full_name: profileInfo.full_name,
            biography: profileInfo.biography,
            profile_pic_url: profileInfo.profile_pic_url,
            is_verified: profileInfo.is_verified,
            is_private: profileInfo.is_private,
            posts_count: profileInfo.posts_count
          },
          followers: followers,
          following: following,
          followers_count: profileInfo.followers_count || followers.length,
          following_count: profileInfo.following_count || following.length,
          posts_count: profileInfo.posts_count
        };

        sendResponse({ success: true, data: packageData });
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true; // Keep channel open for async response
  }
});
