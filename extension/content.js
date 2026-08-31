// InSnitch Content Script - High Reliability Collector
console.log("[InSnitch] Content script carregado.");

// Helper to get cookie
function getCookie(name) {
  const match = document.cookie.match(new RegExp('(^|;\\s*)(' + name + ')=([^;]*)'));
  return match ? decodeURIComponent(match[3]) : '';
}

function getCsrfToken() {
  const match = document.cookie.match(/(?:^|;\s*)csrftoken=([^;]+)/);
  if (match && match[1]) return decodeURIComponent(match[1]);

  try {
    const html = document.documentElement.innerHTML;
    const m = html.match(/"csrf_token":"([^"]+)"/) || 
              html.match(/csrf_token=([a-zA-Z0-9_-]+)/);
    if (m && m[1]) return m[1];
  } catch (e) {}

  return '';
}

function getCurrentPageUsername() {
  const path = window.location.pathname.split('/').filter(Boolean);
  if (path.length === 0) return null;
  const reserved = ['explore', 'direct', 'reels', 'stories', 'accounts', 'p', 'reel', 'tv'];
  if (reserved.includes(path[0].toLowerCase())) return null;
  return path[0].toLowerCase();
}

function parseNumber(str) {
  if (!str) return 0;
  str = String(str).replace(/\./g, '').replace(/,/g, '.').trim().toLowerCase();
  if (str.endsWith('k')) return Math.round(parseFloat(str) * 1000);
  if (str.endsWith('m')) return Math.round(parseFloat(str) * 1000000);
  return parseInt(str.replace(/[^0-9]/g, '')) || 0;
}

// Profile info resolution
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

  // 1. Check DOM meta tags
  try {
    const metaDesc = document.querySelector('meta[name="description"]')?.content || 
                     document.querySelector('meta[property="og:description"]')?.content || "";
    if (metaDesc) {
      const fMatch = metaDesc.match(/([0-9.,kKmM]+)\s+Followers/i) || metaDesc.match(/([0-9.,kKmM]+)\s+seguidores/i);
      const foMatch = metaDesc.match(/([0-9.,kKmM]+)\s+Following/i) || metaDesc.match(/([0-9.,kKmM]+)\s+seguindo/i);
      const pMatch = metaDesc.match(/([0-9.,kKmM]+)\s+Posts/i) || metaDesc.match(/([0-9.,kKmM]+)\s+publicações/i);
      if (fMatch) profile.followers_count = parseNumber(fMatch[1]);
      if (foMatch) profile.following_count = parseNumber(foMatch[1]);
      if (pMatch) profile.posts_count = parseNumber(pMatch[1]);
    }

    const nameEl = document.querySelector('header section h2, header section h1');
    const bioEl = document.querySelector('header section h1 + div, header section .-vDIg');
    const avatarEl = document.querySelector('header img');

    if (nameEl) profile.full_name = nameEl.innerText;
    if (bioEl) profile.biography = bioEl.innerText;
    if (avatarEl) profile.profile_pic_url = avatarEl.src;
    profile.is_verified = !!document.querySelector('header [title="Verificado"]');
  } catch (e) {}

  // 2. Check if logged-in own profile
  const isOwnProfile = !!document.querySelector('a[href*="/accounts/edit/"], header a[href*="/edit/"]');
  const dsUserId = getCookie('ds_user_id');
  if (isOwnProfile && dsUserId) {
    profile.id = dsUserId;
    console.log("[InSnitch] Perfil próprio logado:", username, "ID:", dsUserId);
  }

  // 3. Try web_profile_info
  try {
    const csrf = getCsrfToken();
    const headers = {
      'x-ig-app-id': '936619743392459',
      'x-requested-with': 'XMLHttpRequest',
      'Accept': '*/*'
    };
    if (csrf) headers['x-csrftoken'] = csrf;

    const res = await fetch(`https://www.instagram.com/api/v1/users/web_profile_info/?username=${username}`, {
      headers,
      credentials: 'include'
    });

    if (res.ok) {
      const text = await res.text();
      if (!text.startsWith("<")) {
        const data = JSON.parse(text);
        const u = data?.data?.user;
        if (u) {
          profile.id = u.id;
          profile.username = u.username;
          profile.full_name = u.full_name || profile.full_name;
          profile.biography = u.biography || profile.biography;
          profile.profile_pic_url = u.profile_pic_url_hd || u.profile_pic_url || profile.profile_pic_url;
          profile.is_verified = u.is_verified || profile.is_verified;
          profile.is_private = u.is_private || false;
          profile.posts_count = u.edge_owner_to_timeline_media?.count || profile.posts_count;
          profile.followers_count = u.edge_followed_by?.count || profile.followers_count;
          profile.following_count = u.edge_follow?.count || profile.following_count;
        }
      }
    }
  } catch (e) {
    console.warn("[InSnitch] web_profile_info falhou:", e);
  }

  // 4. Fallback search endpoint for ID
  if (!profile.id) {
    try {
      const searchRes = await fetch(`/api/v1/users/search/?q=${encodeURIComponent(username)}`, {
        credentials: 'include',
        headers: { 'x-ig-app-id': '936619743392459' }
      });
      if (searchRes.ok) {
        const sData = await searchRes.json();
        const match = (sData.users || []).find(u => u.username.toLowerCase() === username.toLowerCase());
        if (match) {
          profile.id = match.pk || match.pk_id || match.id;
          if (!profile.profile_pic_url) profile.profile_pic_url = match.profile_pic_url;
          if (!profile.full_name) profile.full_name = match.full_name;
        }
      }
    } catch (e) {}
  }

  // 5. Fallback HTML regex for ID
  if (!profile.id) {
    try {
      const html = document.documentElement.innerHTML;
      const m = html.match(/"owner_user_id":"([0-9]+)"/) || 
                html.match(new RegExp(`"id":"([0-9]+)","username":"${username}"`, "i")) ||
                html.match(new RegExp(`"username":"${username}"[^{}]*"id":"([0-9]+)"`, "i")) ||
                html.match(/"user_id":"([0-9]+)"/) ||
                html.match(/"pk":"([0-9]+)"/);
      if (m && m[1]) profile.id = m[1];
    } catch (e) {}
  }

  return profile;
}

// Fetch user list (followers or following)
async function fetchUserList(userId, type = "followers", onProgress) {
  const users = [];
  const seenUsernames = new Set();
  const seenMaxIds = new Set();
  let maxId = null;
  const csrf = getCsrfToken();

  const headers = {
    'x-ig-app-id': '936619743392459',
    'x-requested-with': 'XMLHttpRequest',
    'Accept': '*/*'
  };
  if (csrf) headers['x-csrftoken'] = csrf;

  console.log(`[InSnitch] Coletando ${type} para user ID: ${userId}...`);

  for (let page = 0; page < 100; page++) {
    let url = `/api/v1/friendships/${userId}/${type}/?count=50`;
    if (maxId) {
      url += `&max_id=${encodeURIComponent(maxId)}`;
    }

    let pageUsers = [];
    let nextCursor = null;
    let success = false;

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        let res = await fetch(url, { headers, credentials: 'include' });

        if (res.status === 429) {
          const waitTime = attempt * 2500;
          if (onProgress) onProgress(type, users.length, `Aguardando pausa anti-bloqueio (${waitTime/1000}s)...`);
          await new Promise(r => setTimeout(r, waitTime));
          continue;
        }

        if (res.ok) {
          const text = await res.text();
          if (text.startsWith("<")) {
            console.warn(`[InSnitch] Resposta foi HTML para ${type}`);
            break;
          }
          const data = JSON.parse(text);
          pageUsers = data.users || [];
          nextCursor = data.next_max_id;
          success = true;
          break;
        } else {
          console.warn(`[InSnitch] Status ${res.status} ao buscar ${type}`);
          await new Promise(r => setTimeout(r, 1500));
        }
      } catch (err) {
        console.warn(`[InSnitch] Erro de rede em ${type}:`, err);
        await new Promise(r => setTimeout(r, 1500));
      }
    }

    if (!success || pageUsers.length === 0) {
      console.log(`[InSnitch] Paginação de ${type} concluída. Total coletado: ${users.length}`);
      break;
    }

    for (const u of pageUsers) {
      const clean = (u.username || "").toLowerCase().trim();
      if (!clean || seenUsernames.has(clean)) continue;
      seenUsernames.add(clean);

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
    if (!maxId || seenMaxIds.has(maxId)) break;
    seenMaxIds.add(maxId);

    await new Promise(r => setTimeout(r, 450));
  }

  return users;
}

// Message Listener
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
            error: `Não foi possível obter o ID de @${username}. Recarregue a aba do Instagram (F5) e tente novamente.` 
          });
          return;
        }

        const targetMode = request.targetMode || "both";
        let followers = [];
        let following = [];

        console.log(`[InSnitch] Iniciando extração (@${profileInfo.username}, Modo: ${targetMode}, ID: ${profileInfo.id})`);

        // 1. Coleta de Seguidores (se modo for 'both' ou 'followers')
        if (targetMode === "both" || targetMode === "followers") {
          chrome.runtime.sendMessage({ action: "UPDATE_STATUS", message: "Coletando lista de SEGUIDORES..." });
          followers = await fetchUserList(profileInfo.id, "followers", (type, count) => {
            chrome.runtime.sendMessage({ action: "UPDATE_STATUS", message: `Coletando seguidores: ${count}...` });
          });

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
        }

        // 2. Coleta de Seguidos (se modo for 'both' ou 'following')
        if (targetMode === "both" || targetMode === "following") {
          chrome.runtime.sendMessage({ action: "UPDATE_STATUS", message: "Coletando lista de QUEM O PERFIL SEGUE (Seguindo)..." });
          following = await fetchUserList(profileInfo.id, "following", (type, count) => {
            chrome.runtime.sendMessage({ action: "UPDATE_STATUS", message: `Coletando quem o perfil segue: ${count}...` });
          });

          if (profileInfo.following_count > 10 && following.length === 0) {
            sendResponse({ 
              success: false, 
              error: `O Instagram não retornou a lista de seguidos (0 de ${profileInfo.following_count}). Aguarde alguns segundos e tente novamente.` 
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

        console.log(`[InSnitch] Sucesso (${targetMode}): ${followers.length} seguidores e ${following.length} seguidos.`);
        sendResponse({ success: true, data: packageData });

      } catch (err) {
        console.error("[InSnitch] Erro:", err);
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true;
  }
});
