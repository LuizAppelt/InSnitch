// InSnitch Content Script - Runs inside Instagram Web tab
console.log("[InSnitch] Content script ativo na aba do Instagram.");

// Helper to get cookie by name in browser context
function getCookie(name) {
  const match = document.cookie.match(new RegExp('(^|;\\s*)(' + name + ')=([^;]*)'));
  return match ? decodeURIComponent(match[3]) : '';
}

function getCsrfToken() {
  return getCookie('csrftoken') || getCookie('csrf_token') || '';
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
      'x-csrftoken': getCsrfToken(),
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

// Fetch user list (followers or following) with pagination & deduplication
async function fetchUserList(userId, type = "followers", onProgress, options = {}) {
  const delayMs = options.delay || 750;
  const maxLimit = options.maxLimit || 10000;

  const users = [];
  const seenUsernames = new Set();
  const seenMaxIds = new Set();
  let maxId = null;
  const csrf = getCsrfToken();

  const headers = {
    'x-ig-app-id': '936619743392459',
    'x-asbd-id': '129477',
    'x-csrftoken': csrf,
    'x-requested-with': 'XMLHttpRequest',
    'Accept': '*/*'
  };

  // Up to 250 pages (~12,500 users)
  for (let page = 0; page < 250; page++) {
    if (users.length >= maxLimit) {
      console.log(`[InSnitch] Limite máximo atingido (${maxLimit} usuários) para ${type}`);
      break;
    }

    let url = `/api/v1/friendships/${userId}/${type}/?count=50`;
    if (maxId) {
      url += `&max_id=${encodeURIComponent(maxId)}`;
    }

    let pageUsers = [];
    let nextCursor = null;
    let success = false;

    // Retry loop (up to 3 attempts per page on rate-limit / network hiccup)
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        let res = await fetch(url, {
          headers: {
            ...headers,
            'User-Agent': navigator.userAgent
          },
          credentials: 'include'
        });

        if (res.status === 429) {
          const waitTime = attempt * 3000;
          console.warn(`[InSnitch] Rate-limit (429) em ${type}, aguardando ${waitTime/1000}s (tentativa ${attempt}/3)...`);
          if (onProgress) {
            onProgress(type, users.length, `Aguardando pausa anti-bloqueio (${waitTime/1000}s)...`);
          }
          await new Promise(r => setTimeout(r, waitTime));
          continue;
        }

        if (!res.ok) {
          let altUrl = `https://www.instagram.com/api/v1/friendships/${userId}/${type}/?count=50`;
          if (maxId) altUrl += `&max_id=${encodeURIComponent(maxId)}`;
          res = await fetch(altUrl, {
            headers: { ...headers, 'User-Agent': navigator.userAgent },
            credentials: 'include'
          });
        }

        if (res.ok) {
          const data = await res.json();
          pageUsers = data.users || [];
          nextCursor = data.next_max_id;
          success = true;
          break;
        } else {
          console.warn(`[InSnitch] Status ${res.status} ao coletar ${type}, tentativa ${attempt}/3`);
          await new Promise(r => setTimeout(r, 2000));
        }
      } catch (err) {
        console.warn(`[InSnitch] Erro de rede ao coletar ${type}:`, err);
        await new Promise(r => setTimeout(r, 2000));
      }
    }

    if (!success || pageUsers.length === 0) {
      break;
    }

    for (const u of pageUsers) {
      const cleanName = (u.username || "").toLowerCase().trim();
      if (!cleanName || seenUsernames.has(cleanName)) continue;
      seenUsernames.add(cleanName);

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

    maxId = nextCursor;
    if (!maxId || seenMaxIds.has(maxId)) {
      break;
    }
    seenMaxIds.add(maxId);

    // Adaptive delay between pages
    await new Promise(r => setTimeout(r, delayMs));
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
          const searchRes = await fetch(`/api/v1/users/search/?q=${encodeURIComponent(username)}`, {
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
        }

        if (!targetId) {
          sendResponse({ success: false, error: "Não foi possível resolver o ID deste perfil." });
          return;
        }

        const scanOptions = request.options || {};
        const expectedFollowers = profileInfo.followers_count || 0;
        const expectedFollowing = profileInfo.following_count || 0;

        // 2. Fetch Followers
        chrome.runtime.sendMessage({ action: "UPDATE_STATUS", message: "Coletando lista de seguidores..." });
        const followers = await fetchUserList(targetId, "followers", (type, count, extraMsg) => {
          const perc = expectedFollowers > 0 ? ` (${Math.min(100, Math.round((count / expectedFollowers) * 100))}%)` : '';
          const msg = extraMsg || `Coletando seguidores: ${count}${expectedFollowers ? ` de ${expectedFollowers}` : ''}${perc}...`;
          chrome.runtime.sendMessage({ action: "UPDATE_STATUS", message: msg });
        }, scanOptions);

        // 3. Fetch Following
        chrome.runtime.sendMessage({ action: "UPDATE_STATUS", message: "Coletando lista de seguidos..." });
        const following = await fetchUserList(targetId, "following", (type, count, extraMsg) => {
          const perc = expectedFollowing > 0 ? ` (${Math.min(100, Math.round((count / expectedFollowing) * 100))}%)` : '';
          const msg = extraMsg || `Coletando seguindo: ${count}${expectedFollowing ? ` de ${expectedFollowing}` : ''}${perc}...`;
          chrome.runtime.sendMessage({ action: "UPDATE_STATUS", message: msg });
        }, scanOptions);

        // Safeguard: Check for private accounts / empty lists on non-empty profiles
        if (profileInfo.is_private && followers.length === 0 && profileInfo.followers_count > 0) {
          sendResponse({ 
            success: false, 
            error: `Este perfil é privado (@${profileInfo.username}) e o Instagram restringe a lista de seguidores para contas que não o seguem.` 
          });
          return;
        }

        if (profileInfo.followers_count > 10 && followers.length === 0) {
          sendResponse({ 
            success: false, 
            error: `O Instagram não retornou a lista de seguidores (0 de ${profileInfo.followers_count}). Recarregue a aba do Instagram e tente novamente.` 
          });
          return;
        }

        if (profileInfo.following_count > 10 && following.length === 0) {
          sendResponse({ 
            success: false, 
            error: `O Instagram não retornou a lista de seguidos (0 de ${profileInfo.following_count}). Recarregue a aba do Instagram e tente novamente.` 
          });
          return;
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
