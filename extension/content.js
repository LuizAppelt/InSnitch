// InSnitch Content Script - Smart Multi-Route Cascade Collector
console.log("[InSnitch] Content script ativo na aba do Instagram.");

// Helper to get cookie by name in browser context
function getCookie(name) {
  const match = document.cookie.match(new RegExp('(^|;\\s*)(' + name + ')=([^;]*)'));
  return match ? decodeURIComponent(match[3]) : '';
}

function getCsrfToken() {
  const match = document.cookie.match(/(?:^|;\s*)(?:csrf_token|csrftoken)=([^;]+)/);
  if (match && match[1]) return decodeURIComponent(match[1]);

  try {
    const html = document.documentElement.innerHTML;
    const m = html.match(/"csrf_token":"([^"]+)"/) || 
              html.match(/csrf_token=([a-zA-Z0-9_-]+)/) ||
              html.match(/"token":"([a-zA-Z0-9_-]+)"/);
    if (m && m[1]) return m[1];
  } catch (e) {}

  return '';
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
  try {
    const csrf = getCsrfToken();
    const headers = {
      'x-ig-app-id': '936619743392459',
      'x-asbd-id': '129477',
      'x-requested-with': 'XMLHttpRequest',
      'x-ig-www-claim': '0',
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

// Smart Multi-Route Cascade Fetcher for Single Page
async function fetchPageWithCascade(userId, type, maxId, headers) {
  const followerHashes = [
    "58712303d941c6855d4e888c5f0cd22f",
    "5a25c191486c0d78788373a41b392d44",
    "c76146de99bb02f6415203be841dd25a",
    "d54e0811ab46723cdd590bd265160295"
  ];
  const followingHashes = [
    "37479f2b8209594dde7ffb0d41ac5177",
    "d04b0a864b4b54b84c0d8294d7dda58d"
  ];

  const candidateHashes = type === "followers" ? followerHashes : followingHashes;

  const routes = [
    {
      name: "Rota 1 (REST Oficial com Superfície de Busca)",
      url: `/api/v1/friendships/${userId}/${type}/?count=50${type === 'followers' ? '&search_surface=follow_list_page' : ''}${maxId ? `&max_id=${encodeURIComponent(maxId)}` : ''}`,
      kind: "rest"
    },
    {
      name: "Rota 2 (REST Pura Direta)",
      url: `/api/v1/friendships/${userId}/${type}/?count=50${maxId ? `&max_id=${encodeURIComponent(maxId)}` : ''}`,
      kind: "rest"
    },
    {
      name: "Rota 3 (REST Nativa i.instagram.com)",
      url: `https://i.instagram.com/api/v1/friendships/${userId}/${type}/?count=50${maxId ? `&max_id=${encodeURIComponent(maxId)}` : ''}`,
      kind: "rest"
    }
  ];

  // Add GraphQL routes for each hash
  candidateHashes.forEach((hash, idx) => {
    routes.push({
      name: `Rota GraphQL ${idx + 1} (Hash: ${hash.substring(0, 6)}...)`,
      url: (() => {
        const varsObj = { id: userId, first: 50 };
        if (maxId) varsObj.after = maxId;
        return `/graphql/query/?query_hash=${hash}&variables=${encodeURIComponent(JSON.stringify(varsObj))}`;
      })(),
      kind: "graphql"
    });
  });

  for (const route of routes) {
    try {
      console.log(`[InSnitch] Testando ${route.name} para ${type}...`);
      const res = await fetch(route.url, {
        headers: {
          ...headers,
          'User-Agent': navigator.userAgent
        },
        credentials: 'include'
      });

      if (!res.ok) {
        console.warn(`[InSnitch] ${route.name} respondeu com HTTP ${res.status}`);
        continue;
      }

      const text = await res.text();
      if (!text.startsWith("{")) {
        console.warn(`[InSnitch] ${route.name} retornou HTML em vez de JSON.`);
        continue;
      }

      const data = JSON.parse(text);
      let pageUsers = [];
      let nextCursor = null;

      if (route.kind === "rest") {
        pageUsers = data.users || [];
        nextCursor = data.next_max_id;
      } else if (route.kind === "graphql") {
        const edge = type === "followers" 
          ? (data?.data?.user?.edge_followed_by || data?.data?.edge_followed_by)
          : (data?.data?.user?.edge_follow || data?.data?.edge_follow);
        const edges = edge?.edges || [];
        pageUsers = edges.map(e => ({
          username: e.node?.username,
          full_name: e.node?.full_name || "",
          profile_pic_url: e.node?.profile_pic_url || "",
          is_verified: e.node?.is_verified || false
        }));
        nextCursor = edge?.page_info?.has_next_page ? edge?.page_info?.end_cursor : null;

        if (data.errors) {
          console.warn(`[InSnitch] ${route.name} erros:`, data.errors);
        }
      }

      if (pageUsers.length > 0) {
        console.log(`[InSnitch] ✓ ${route.name} respondeu com sucesso! (${pageUsers.length} usuários obtidos)`);
        return { success: true, users: pageUsers, nextCursor: nextCursor };
      } else {
        console.warn(`[InSnitch] ${route.name} respondeu 200 mas sem usuários.`);
      }
    } catch (err) {
      console.warn(`[InSnitch] Erro ao tentar ${route.name}:`, err);
    }
  }

  return { success: false, users: [], nextCursor: null };
}

// Fetch user list (followers or following) with multi-route cascade
async function fetchUserList(userId, type = "followers", onProgress) {
  const users = [];
  const seen = new Set();
  const seenCursors = new Set();
  let maxId = null;
  const csrf = getCsrfToken();

  const headers = {
    'x-ig-app-id': '936619743392459',
    'x-asbd-id': '129477',
    'x-requested-with': 'XMLHttpRequest',
    'x-ig-www-claim': '0',
    'Accept': '*/*'
  };
  if (csrf) headers['x-csrftoken'] = csrf;

  console.log(`[InSnitch] Iniciando extração em cascata para ${type} (User ID: ${userId}, CSRF: ${csrf ? 'OK' : 'Ausente'})...`);

  // Up to 200 pages (~10,000 users)
  for (let page = 0; page < 200; page++) {
    const result = await fetchPageWithCascade(userId, type, maxId, headers);

    if (!result.success || result.users.length === 0) {
      console.log(`[InSnitch] Fim da paginação de ${type}. Total consolidado: ${users.length}`);
      break;
    }

    for (const u of result.users) {
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

    maxId = result.nextCursor;
    if (!maxId || seenCursors.has(maxId)) {
      break;
    }
    seenCursors.add(maxId);

    // Small delay between pages
    await new Promise(r => setTimeout(r, 350));
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
            const csrf = getCsrfToken();
            const searchHeaders = {
              'x-ig-app-id': '936619743392459',
              'x-requested-with': 'XMLHttpRequest',
              'x-ig-www-claim': '0'
            };
            if (csrf) searchHeaders['x-csrftoken'] = csrf;

            const searchRes = await fetch(`/api/v1/users/search/?q=${encodeURIComponent(username)}`, {
              credentials: 'include',
              headers: searchHeaders
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
