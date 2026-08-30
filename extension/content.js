// InSnitch Content Script - Direct In-Page Collector
console.log("[InSnitch] Content script carregado na aba do Instagram.");

// Helper to get cookie by name
function getCookie(name) {
  const match = document.cookie.match(new RegExp('(^|;\\s*)(' + name + ')=([^;]*)'));
  return match ? decodeURIComponent(match[3]) : '';
}

function getCsrfToken() {
  return getCookie('csrftoken') || getCookie('csrf_token') || '';
}

// Extract username from URL pathname
function getCurrentPageUsername() {
  const path = window.location.pathname.split('/').filter(Boolean);
  if (path.length === 0) return null;
  const reserved = ['explore', 'direct', 'reels', 'stories', 'accounts', 'p', 'reel', 'tv'];
  if (reserved.includes(path[0].toLowerCase())) return null;
  return path[0].toLowerCase();
}

// Extract profile details from API or DOM
async function extractProfileInfo(username) {
  let profile = {
    id: null,
    username: username,
    full_name: username,
    biography: "",
    profile_pic_url: "",
    is_verified: false,
    is_private: false,
    posts_count: 0,
    followers_count: 0,
    following_count: 0
  };

  function parseCount(str) {
    if (!str) return 0;
    str = String(str).replace(/\./g, '').replace(/,/g, '.').trim().toLowerCase();
    if (str.endsWith('k')) return Math.round(parseFloat(str) * 1000);
    if (str.endsWith('m')) return Math.round(parseFloat(str) * 1000000);
    return parseInt(str.replace(/[^0-9]/g, '')) || 0;
  }

  // 1. Try web_profile_info endpoint
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
        profile.id = u.id;
        profile.username = u.username;
        profile.full_name = u.full_name || "";
        profile.biography = u.biography || "";
        profile.profile_pic_url = u.profile_pic_url_hd || u.profile_pic_url || "";
        profile.is_verified = u.is_verified || false;
        profile.is_private = u.is_private || false;
        profile.posts_count = u.edge_owner_to_timeline_media?.count || 0;
        profile.followers_count = u.edge_followed_by?.count || 0;
        profile.following_count = u.edge_follow?.count || 0;
      }
    }
  } catch (e) {
    console.warn("[InSnitch] web_profile_info falhou, usando DOM fallback:", e);
  }

  // 2. DOM / Meta fallback
  try {
    const metaDesc = document.querySelector('meta[name="description"]')?.content || "";
    const followersMatch = metaDesc.match(/([0-9.,kKmM]+)\s+Followers/i) || metaDesc.match(/([0-9.,kKmM]+)\s+seguidores/i);
    const followingMatch = metaDesc.match(/([0-9.,kKmM]+)\s+Following/i) || metaDesc.match(/([0-9.,kKmM]+)\s+seguindo/i);
    const postsMatch = metaDesc.match(/([0-9.,kKmM]+)\s+Posts/i) || metaDesc.match(/([0-9.,kKmM]+)\s+publicações/i);

    if (!profile.followers_count && followersMatch) profile.followers_count = parseCount(followersMatch[1]);
    if (!profile.following_count && followingMatch) profile.following_count = parseCount(followingMatch[1]);
    if (!profile.posts_count && postsMatch) profile.posts_count = parseCount(postsMatch[1]);

    const nameEl = document.querySelector('header section h2, header section h1');
    const bioEl = document.querySelector('header section h1 + div, header section .-vDIg');
    const avatarEl = document.querySelector('header img');

    if (!profile.full_name && nameEl) profile.full_name = nameEl.innerText;
    if (!profile.biography && bioEl) profile.biography = bioEl.innerText;
    if (!profile.profile_pic_url && avatarEl) profile.profile_pic_url = avatarEl.src;
    if (!profile.is_verified) profile.is_verified = !!document.querySelector('header [title="Verificado"]');

    // 3. Fallback for numeric ID from page HTML
    if (!profile.id) {
      const html = document.documentElement.innerHTML;
      const idMatch = html.match(/"owner_user_id":"([0-9]+)"/) || 
                      html.match(new RegExp(`"id":"([0-9]+)","username":"${username}"`, "i")) ||
                      html.match(/"user_id":"([0-9]+)"/) ||
                      html.match(/"pk":"([0-9]+)"/) ||
                      html.match(/"pk_id":"([0-9]+)"/);
      if (idMatch) profile.id = idMatch[1];
    }
  } catch (domErr) {
    console.warn("[InSnitch] Erro ao extrair do DOM:", domErr);
  }

  // 4. Search endpoint fallback for ID
  if (!profile.id) {
    try {
      const searchRes = await fetch(`/api/v1/users/search/?q=${encodeURIComponent(username)}`, {
        credentials: 'include',
        headers: { 'x-ig-app-id': '936619743392459' }
      });
      if (searchRes.ok) {
        const searchData = await searchRes.json();
        const match = (searchData.users || []).find(u => u.username.toLowerCase() === username.toLowerCase());
        if (match) {
          profile.id = match.pk || match.pk_id || match.id;
          if (!profile.profile_pic_url) profile.profile_pic_url = match.profile_pic_url;
          if (!profile.full_name) profile.full_name = match.full_name;
        }
      }
    } catch (sErr) {
      console.warn("[InSnitch] Erro na busca de ID:", sErr);
    }
  }

  return profile;
}

// Fetch user list (followers or following) with pagination & deduplication
async function fetchUserList(userId, type = "followers", expectedTotal = 0, onProgress, options = {}) {
  const delayMs = options.delay || 650;
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
      console.log(`[InSnitch] Limite máximo atingido (${maxLimit}) para ${type}`);
      break;
    }

    let url = `/api/v1/friendships/${userId}/${type}/?count=50`;
    if (maxId) {
      url += `&max_id=${encodeURIComponent(maxId)}`;
    }

    let pageUsers = [];
    let nextCursor = null;
    let success = false;

    // Retry loop (up to 3 attempts on 429 / hiccup)
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
          const waitTime = attempt * 2500;
          console.warn(`[InSnitch] Rate-limit (429) em ${type}, aguardando ${waitTime/1000}s...`);
          if (onProgress) {
            onProgress(type, users.length, expectedTotal, `Pausa de segurança anti-bloqueio (${waitTime/1000}s)...`);
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
          await new Promise(r => setTimeout(r, 1500));
        }
      } catch (err) {
        console.warn(`[InSnitch] Erro de rede em ${type}:`, err);
        await new Promise(r => setTimeout(r, 1500));
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
      onProgress(type, users.length, expectedTotal);
    }

    maxId = nextCursor;
    if (!maxId || seenMaxIds.has(maxId)) {
      break;
    }
    seenMaxIds.add(maxId);

    // Adaptive delay
    await new Promise(r => setTimeout(r, delayMs));
  }

  return users;
}

// Listen for messages from popup
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

        chrome.runtime.sendMessage({ action: "UPDATE_STATUS", message: "Obtendo dados do perfil..." });
        const profileInfo = await extractProfileInfo(username);

        if (!profileInfo.id) {
          sendResponse({ 
            success: false, 
            error: `Não foi possível obter o ID de @${username}. Verifique se você está conectado no Instagram.` 
          });
          return;
        }

        const scanOptions = request.options || {};
        const expectedFollowers = profileInfo.followers_count || 0;
        const expectedFollowing = profileInfo.following_count || 0;

        // 1. Fetch Followers
        chrome.runtime.sendMessage({ action: "UPDATE_STATUS", message: "Iniciando coleta de seguidores..." });
        const followers = await fetchUserList(profileInfo.id, "followers", expectedFollowers, (type, count, total, extraMsg) => {
          const perc = total > 0 ? ` (${Math.min(100, Math.round((count / total) * 100))}%)` : '';
          const msg = extraMsg || `Coletando seguidores: ${count}${total ? ` de ${total}` : ''}${perc}...`;
          chrome.runtime.sendMessage({ action: "UPDATE_STATUS", message: msg });
        }, scanOptions);

        // 2. Fetch Following
        chrome.runtime.sendMessage({ action: "UPDATE_STATUS", message: "Iniciando coleta de seguidos..." });
        const following = await fetchUserList(profileInfo.id, "following", expectedFollowing, (type, count, total, extraMsg) => {
          const perc = total > 0 ? ` (${Math.min(100, Math.round((count / total) * 100))}%)` : '';
          const msg = extraMsg || `Coletando seguindo: ${count}${total ? ` de ${total}` : ''}${perc}...`;
          chrome.runtime.sendMessage({ action: "UPDATE_STATUS", message: msg });
        }, scanOptions);

        // Safeguards
        if (profileInfo.is_private && followers.length === 0 && profileInfo.followers_count > 0) {
          sendResponse({ 
            success: false, 
            error: `Este perfil é privado (@${profileInfo.username}) e o Instagram restringe a lista de seguidores para quem não o segue.` 
          });
          return;
        }

        if (profileInfo.followers_count > 10 && followers.length === 0) {
          sendResponse({ 
            success: false, 
            error: `O Instagram não retornou a lista de seguidores (0 de ${profileInfo.followers_count}). Aguarde alguns segundos e tente novamente.` 
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
        console.error("[InSnitch] Erro na extração:", err);
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true; // Keep message channel open for async response
  }
});
