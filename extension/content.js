// InSnitch Content Script - Runs inside Instagram Web tab
console.log("[InSnitch] Content script ativo na aba do Instagram.");

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

// Fetch user list (followers or following) with pagination & deduplication
async function fetchUserList(userId, type = "followers", onProgress) {
  const users = [];
  const seenUsernames = new Set();
  const seenMaxIds = new Set();
  let maxId = null;
  const csrf = getCookie('csrftoken') || '';

  const headers = {
    'x-ig-app-id': '936619743392459',
    'x-asbd-id': '129477',
    'x-csrftoken': csrf,
    'x-requested-with': 'XMLHttpRequest',
    'Accept': '*/*'
  };

  // Up to 200 pages (~10,000 users)
  for (let page = 0; page < 200; page++) {
    let url = type === "followers" 
      ? `/api/v1/friendships/${userId}/followers/?count=50&search_surface=follow_list_page`
      : `/api/v1/friendships/${userId}/following/?count=50`;

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

      // Retry once on rate limit / 429
      if (res.status === 429) {
        console.warn(`[InSnitch] Rate-limit detectado ao coletar ${type}, aguardando 1.5s...`);
        await new Promise(r => setTimeout(r, 1500));
        res = await fetch(url, {
          headers: { ...headers, 'User-Agent': navigator.userAgent },
          credentials: 'include'
        });
      }

      let pageUsers = [];
      let nextCursor = null;

      if (res.ok) {
        const data = await res.json();
        pageUsers = data.users || [];
        nextCursor = data.next_max_id;
      } else {
        // Fallback: GraphQL query
        console.warn(`[InSnitch] REST falhou com status ${res.status}, tentando GraphQL para ${type}...`);
        const queryHash = type === "followers" ? "58712303d941c6855d4e888c5f0cd22f" : "37479f2b8209594dde7ffb0d41ac5177";
        const variables = JSON.stringify({ id: userId, first: 50, after: maxId || "" });
        const gqlUrl = `/graphql/query/?query_hash=${queryHash}&variables=${encodeURIComponent(variables)}`;
        const gqlRes = await fetch(gqlUrl, { headers, credentials: 'include' });
        if (gqlRes.ok) {
          const gqlData = await gqlRes.json();
          const edge = type === "followers" ? gqlData?.data?.user?.edge_followed_by : gqlData?.data?.user?.edge_follow;
          const edges = edge?.edges || [];
          pageUsers = edges.map(e => ({
            username: e.node?.username,
            full_name: e.node?.full_name || "",
            profile_pic_url: e.node?.profile_pic_url || "",
            is_verified: e.node?.is_verified || false
          }));
          nextCursor = edge?.page_info?.has_next_page ? edge?.page_info?.end_cursor : null;
        } else {
          console.error(`[InSnitch] Falha em REST e GraphQL para ${type}`);
          break;
        }
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

      maxId = nextCursor;

      if (onProgress) {
        onProgress(type, users.length);
      }

      maxId = data.next_max_id;
      if (!maxId || seenMaxIds.has(maxId) || pageUsers.length === 0) {
        break;
      }
      seenMaxIds.add(maxId);

      // Delay between pages to respect Instagram limits
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

        // Safeguard: Check for empty lists on non-empty profiles
        if (profileInfo.followers_count > 10 && followers.length === 0) {
          sendResponse({ 
            success: false, 
            error: `O Instagram não retornou a lista de seguidores (0 de ${profileInfo.followers_count}). Aguarde alguns segundos e tente novamente.` 
          });
          return;
        }

        if (profileInfo.following_count > 10 && following.length === 0) {
          sendResponse({ 
            success: false, 
            error: `O Instagram não retornou a lista de seguidos (0 de ${profileInfo.following_count}). Aguarde alguns segundos e tente novamente.` 
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
