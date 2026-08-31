// InSnitch Content Script - Runs inside Instagram Web tab
console.log("[InSnitch] Content script ativo na aba do Instagram.");

// Helper to get cookie by name in browser context
function getCookie(name) {
  const match = document.cookie.match(new RegExp('(^|;\\s*)(' + name + ')=([^;]*)'));
  return match ? decodeURIComponent(match[3]) : '';
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
    const csrf = getCookie('csrftoken') || '';
    const headers = {
      'x-ig-app-id': '936619743392459',
      'x-asbd-id': '129477',
      'x-requested-with': 'XMLHttpRequest',
      'Accept': '*/*'
    };
    if (csrf) headers['x-csrftoken'] = csrf;

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
    console.warn("[InSnitch] Falha ao obter dados via web_profile_info, tentando via DOM:", e);
  }

  // Fallback: Extract from DOM
  const nameEl = document.querySelector('header section h2, header section h1');
  const bioEl = document.querySelector('header section h1 + div, header section .-vDIg');
  const avatarEl = document.querySelector('header img');

  let id = null;
  const isOwnProfile = !!document.querySelector('a[href*="/accounts/edit/"], header button');
  if (isOwnProfile && getCookie('ds_user_id')) {
    id = getCookie('ds_user_id');
  }

  return {
    id: id,
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
  const seen = new Set();
  let maxId = null;
  const csrf = getCookie('csrftoken') || '';

  const headers = {
    'x-ig-app-id': '936619743392459',
    'x-asbd-id': '129477',
    'x-requested-with': 'XMLHttpRequest',
    'Accept': '*/*'
  };
  if (csrf) headers['x-csrftoken'] = csrf;

  // Up to 200 pages (~10,000 users)
  for (let page = 0; page < 200; page++) {
    // Direct i.instagram.com API endpoint
    let url = `https://i.instagram.com/api/v1/friendships/${userId}/${type}/?count=50`;
    if (maxId) {
      url += `&max_id=${encodeURIComponent(maxId)}`;
    }

    try {
      let res = await fetch(url, {
        headers: {
          ...headers,
          'User-Agent': navigator.userAgent
        },
        credentials: 'include'
      });

      // Fallback to relative endpoint if i.instagram.com is blocked
      if (!res.ok) {
        let relUrl = `/api/v1/friendships/${userId}/${type}/?count=50`;
        if (maxId) relUrl += `&max_id=${encodeURIComponent(maxId)}`;
        res = await fetch(relUrl, {
          headers: { ...headers, 'User-Agent': navigator.userAgent },
          credentials: 'include'
        });
      }

      if (!res.ok) {
        console.warn(`[InSnitch] Status ${res.status} ao coletar ${type}`);
        break;
      }

      const data = await res.json();
      const pageUsers = data.users || [];

      for (const u of pageUsers) {
        const clean = (u.username || "").toLowerCase().trim();
        if (!clean || seen.has(clean)) continue;
        seen.add(clean);

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
      await new Promise(r => setTimeout(r, 300));
    } catch (err) {
      console.error(`[InSnitch] Erro ao paginar ${type}:`, err);
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
          try {
            const searchRes = await fetch(`https://i.instagram.com/api/v1/users/search/?q=${encodeURIComponent(username)}`, {
              credentials: 'include',
              headers: { 'x-ig-app-id': '936619743392459' }
            });
            if (searchRes.ok) {
              const searchData = await searchRes.json();
              const match = (searchData.users || []).find(u => u.username.toLowerCase() === username.toLowerCase());
              if (match) {
                targetId = match.pk || match.pk_id || match.id;
                if (!profileInfo.profile_pic_url) profileInfo.profile_pic_url = match.profile_pic_url;
                if (!profileInfo.full_name) profileInfo.full_name = match.full_name;
              }
            }
          } catch (e) {}
        }

        if (!targetId) {
          sendResponse({ success: false, error: "Não foi possível resolver o ID deste perfil. Recarregue a página (F5) e tente novamente." });
          return;
        }

        const targetMode = request.targetMode || "both";
        let followers = [];
        let following = [];

        console.log(`[InSnitch] Extraindo @${profileInfo.username} (Modo: ${targetMode}, ID: ${targetId})`);

        // 2. Fetch Followers (if mode is 'both' or 'followers')
        if (targetMode === "both" || targetMode === "followers") {
          chrome.runtime.sendMessage({ action: "UPDATE_STATUS", message: "Coletando lista de seguidores..." });
          followers = await fetchUserList(targetId, "followers", (type, count) => {
            chrome.runtime.sendMessage({ action: "UPDATE_STATUS", message: `Coletando seguidores: ${count}...` });
          });

          if (profileInfo.followers_count > 10 && followers.length === 0) {
            sendResponse({ 
              success: false, 
              error: `O Instagram não retornou a lista de seguidores (0 de ${profileInfo.followers_count}). Aguarde alguns segundos e tente novamente.` 
            });
            return;
          }
        }

        // 3. Fetch Following (if mode is 'both' or 'following')
        if (targetMode === "both" || targetMode === "following") {
          chrome.runtime.sendMessage({ action: "UPDATE_STATUS", message: "Coletando quem o perfil segue..." });
          following = await fetchUserList(targetId, "following", (type, count) => {
            chrome.runtime.sendMessage({ action: "UPDATE_STATUS", message: `Coletando quem o perfil segue: ${count}...` });
          });

          if (profileInfo.following_count > 10 && following.length === 0) {
            sendResponse({ 
              success: false, 
              error: `O Instagram não retornou a lista de quem o perfil segue (0 de ${profileInfo.following_count}). Aguarde alguns segundos e tente novamente.` 
            });
            return;
          }
        }

        const packageData = {
          profile: {
            username: profileInfo.username,
            full_name: profileInfo.full_name,
            biography: profileInfo.biography,
            profile_pic_url: profileInfo.profile_pic_url,
            is_verified: profileInfo.is_verified,
            is_private: profileInfo.is_private,
            posts_count: profileInfo.posts_count,
            followers_count: profileInfo.followers_count || followers.length,
            following_count: profileInfo.following_count || following.length
          },
          followers: followers,
          following: following,
          followers_count: profileInfo.followers_count || followers.length,
          following_count: profileInfo.following_count || following.length,
          posts_count: profileInfo.posts_count,
          target_mode: targetMode
        };

        sendResponse({ success: true, data: packageData });
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true; // Keep channel open for async response
  }
});
